import { JSONParser, TokenType } from '@streamparser/json';
import { dirname, relative, resolve, isAbsolute } from 'node:path';
import type { PluginWorkerContext } from '@ada/plugin-sdk/server';
export type ExportReader = { read(buffer: Buffer, offset: number, length: number, position: number): Promise<{ bytesRead: number }> };
export type ExportWorkspace = { root: string; path(path: string): Promise<string>; isFile(path: string): Promise<boolean> };

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a Discord export object.');
  return value as ObjectValue;
};
const known = ['guild', 'channel', 'dateRange', 'exportedAt', 'messageCount'];
export type RetainedAttachment = { recordId: string; revisionId: string; hash: string; bytes: number; mediaType: string };
export type Summary = { messages: number; attachments: number; retained: number; missing: number; remote: number; namespace: string };
function line(id: string, value: unknown, author?: string, occurredAt?: string) {
  const text = JSON.stringify(value);
  if (text.length > 4_000_000) throw new Error('A Discord record exceeds the source size limit.');
  return Buffer.from(JSON.stringify({ id, text, ...(author ? { author } : {}), ...(occurredAt ? { occurredAt } : {}) }) + '\n');
}

export async function* normalize(input: ExportReader, files: ExportWorkspace, sourcePath: string, original: unknown, signal: AbortSignal,
  retain: (path: string) => Promise<RetainedAttachment>, finish: (summary: Summary) => void) {
  const parser = new JSONParser({ paths: ['$.messages.*', ...known.map(key => `$.${key}`)], keepStack: false });
  const metadata: ObjectValue = {}, keys = new Set<string>(), ids = new Set<string>();
  const pending: ObjectValue[] = [];
  const decoder = new TextDecoder('utf8', { fatal: true, ignoreBOM: true });
  let depth = 0, keyExpected = false, valueExpected = false, rootKey = '', hasMessages = false, total = 0, lastValue = 0;
  let messages = 0, attachments = 0, retained = 0, missing = 0, remote = 0;
  const retainedFiles = new Map<string, RetainedAttachment>();
  parser.onToken = ({ token, value }) => {
    if (depth === 0 && !keys.size && token !== TokenType.LEFT_BRACE && total <= 32768) throw new Error('Expected one Discord export object.');
    if (depth === 1 && keyExpected && token === TokenType.STRING) {
      rootKey = String(value); keyExpected = false;
      if (keys.has(rootKey) || keys.size >= 1000) throw new Error('Duplicate or excessive export metadata fields.');
      keys.add(rootKey);
    } else if (depth === 1 && token === TokenType.COLON) valueExpected = true;
    else if (depth === 1 && valueExpected) {
      valueExpected = false;
      if (rootKey === 'messages') { if (token !== TokenType.LEFT_BRACKET) throw new Error('Discord messages must be an array.'); hasMessages = true; }
    }
    if (token === TokenType.LEFT_BRACE || token === TokenType.LEFT_BRACKET) { depth++; if (depth > 128) throw new Error('The export nesting is too deep.'); if (depth === 1) keyExpected = true; }
    if (token === TokenType.RIGHT_BRACE || token === TokenType.RIGHT_BRACKET) depth--;
    if (depth === 1 && token === TokenType.COMMA) keyExpected = true;
    if (token === TokenType.NUMBER && typeof value === 'number' && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Error('The export contains a number that cannot be retained exactly.');
  };
  parser.onValue = ({ key, value, stack }) => {
    lastValue = total;
    if (stack.length === 2 && stack[1]?.key === 'messages' && typeof key === 'number') pending.push(object(value));
    else if (stack.length === 1 && typeof key === 'string') metadata[key] = value;
  };
  const buffer = Buffer.alloc(32768);
  while (true) {
    signal.throwIfAborted();
    const { bytesRead } = await input.read(buffer, 0, buffer.length, total);
    if (!bytesRead) break;
    total += bytesRead;
    if (total - lastValue > 24_000_000) throw new Error('A Discord record exceeds the parser size limit.');
    decoder.decode(buffer.subarray(0, bytesRead), { stream: true });
    parser.write(buffer.subarray(0, bytesRead));
    while (pending.length) {
      const message = pending.shift()!;
      if (typeof message.id !== 'string' || !/^\d+$/.test(message.id) || ids.has(message.id) || typeof message.content !== 'string' ||
        typeof message.timestamp !== 'string' || !Number.isFinite(Date.parse(message.timestamp))) throw new Error('Invalid or duplicate Discord message identity, content or timestamp.');
      ids.add(message.id); messages++;
      const author = object(message.author);
      yield line(message.id, { format: 'discord-export-message-v1', message }, typeof author.name === 'string' ? author.name : undefined, message.timestamp);
      const forwarded = message.forwardedMessage ? object(message.forwardedMessage) : undefined;
      for (const [isForwarded, owner] of [[false, message], [true, forwarded]] as const) {
        if (!owner) continue;
        const values = owner.attachments ?? [];
        if (!Array.isArray(values)) throw new Error('Invalid Discord attachment list.');
        for (const [index, raw] of values.entries()) {
          const attachment = object(raw);
          if (typeof attachment.url !== 'string' || typeof attachment.fileName !== 'string') throw new Error('Invalid Discord attachment reference.');
          let availability = 'missing', path: string | undefined;
          if (/^https?:\/\//i.test(attachment.url)) { availability = 'remote'; remote++; }
          else {
            try {
              path = relative(files.root, resolve(dirname(sourcePath), attachment.url));
              if (await files.isFile(path)) availability = 'local';
            } catch { path = undefined; }
            if (availability !== 'local') missing++;
          }
          attachments++;
          let asset: RetainedAttachment | undefined;
          if (availability === 'local' && path) {
            asset = retainedFiles.get(path.toLowerCase());
            if (!asset) { asset = await retain(path); retainedFiles.set(path.toLowerCase(), asset); }
            retained++;
          }
          yield line(`attachment/${message.id}/${isForwarded ? 'forwarded' : 'own'}/${index}`, {
            format: 'discord-attachment-reference-v1', messageId: message.id, forwarded: isForwarded, attachment, availability,
            ...(availability === 'local' ? { workspacePath: path } : {}), retainedBytes: !!asset,
            ...(asset ? { asset, extraction: 'pending' } : { extraction: 'unavailable' }),
          });
        }
      }
    }
  }
  decoder.decode();
  if (!parser.isEnded) parser.end();
  if (!hasMessages || metadata.messageCount !== messages) throw new Error('Discord export is incomplete or its message count does not match.');
  const channel = object(metadata.channel);
  if (typeof channel.id !== 'string' || !/^\d+$/.test(channel.id)) throw new Error('The export has no valid channel identity.');
  const summary = { messages, attachments, retained, missing, remote, namespace: `discord/channel/${channel.id}` };
  yield line('export-metadata', { format: 'discord-export-metadata-v1', original, ...metadata, ...summary,
    unknownRootFields: [...keys].filter(key => key !== 'messages' && !known.includes(key)),
    uncertainty: 'Exporter-produced content may contain formatted mentions or synthesized system messages. Forwarded authorship is not established by the outer author. Only attachments with retainedBytes=true have retained bytes; retention does not imply extraction or interpretation. Unknown root fields remain in the original export.' });
  finish(summary);
}

export async function prepareBrokeredDiscordExport(args: { path: string; output: string }, context: PluginWorkerContext) {
  const call = (action: string, input: Record<string, unknown>) => context.broker('import.retain', { action, ...input });
  const root = resolve('/ada-plugin-workspace');
  const files: ExportWorkspace = {
    root,
    async path(path) {
      if (typeof path !== 'string' || isAbsolute(path) || path.includes(':') || path.includes('\0')) throw new Error('Use a relative workspace path.');
      const target = resolve(root, path), local = relative(root, target);
      if (!local || local.startsWith('..') || isAbsolute(local)) throw new Error('The path leaves this task workspace.');
      return target;
    },
    async isFile(path) { return (await call('stat', { path }) as { file: boolean }).file; },
  };
  if ((await files.path(args.path)).toLowerCase() === (await files.path(args.output)).toLowerCase()) throw new Error('Use a new output path.');
  const original = await call('asset-retain', { path: args.path, purpose: 'Original Discord export.' }) as RetainedAttachment;
  const input: ExportReader = { async read(buffer, offset, length, position) {
    const value = await call('asset-read', { hash: original.hash, bytes: original.bytes, offset: position, length: Math.min(length, 32768) }) as { base64: string };
    const chunk = Buffer.from(value.base64, 'base64'); chunk.copy(buffer, offset); return { bytesRead: chunk.length };
  } };
  let summary: Summary | undefined;
  const stream = await call('file-begin', { path: args.output }) as { id: string };
  try {
    for await (const chunk of normalize(input, files, await files.path(args.path), original, context.signal,
      async path => await call('asset-retain', { path, purpose: 'Original Discord attachment.' }) as RetainedAttachment,
      value => { summary = value; })) {
      for (let offset = 0; offset < chunk.length; offset += 32768) await call('file-write', { id: stream.id, base64: chunk.subarray(offset, offset + 32768).toString('base64') });
    }
    const output = await call('file-finish', { id: stream.id });
    return { output, original, ...summary, next: 'Import the generated JSONL with import_sources and the returned namespace. Local attachments have retained asset identities in their records and await extraction or image inspection. Missing and remote references require follow-up; they were not downloaded or read.' };
  } catch (error) { await call('file-abort', { id: stream.id }).catch(() => undefined); throw error; }
  finally { await call('asset-close', { hash: original.hash }).catch(() => undefined); }
}

