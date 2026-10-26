import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { protect } from '@ada/plugin-sdk/security';
import { saveProtectedJson, type Protection } from '@ada/plugin-sdk/security';
import type { DiscordUser, DiscordGuild, DiscordChannel, DiscordMessage, DiscordRelationship, DiscordReadRequest, DiscordReadResult, DiscordState } from '../types.ts';
import type { DiscordImports } from '../types.ts';
import type { CredentialStorage } from '@ada/plugin-sdk/server';

export class DiscordError extends Error {
  constructor(readonly code: 'invalid_input' | 'not_connected' | 'credentials_unavailable' | 'access_denied' | 'not_found' | 'rate_limited' | 'unavailable' | 'invalid_response' | 'cancelled', message: string) { super(message); }
}
const invalid = (): never => { throw new DiscordError('invalid_input', 'Choose a supported Discord read operation with valid IDs and page bounds.'); };
const badResponse = (): never => { throw new DiscordError('invalid_response', 'Discord returned an invalid or oversized response.'); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : badResponse();
const id = (value: unknown) => typeof value === 'string' && /^[1-9][0-9]{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
const responseId = (value: unknown) => id(value) ? value as string : badResponse();
const text = (value: unknown, maximum: number) => typeof value === 'string' && value.length <= maximum ? value : badResponse();
const integer = (value: unknown, maximum = 1000) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum ? Number(value) : badResponse();
const array = (value: unknown, maximum: number): unknown[] => Array.isArray(value) && value.length <= maximum ? value : badResponse();
const optionalId = (value: unknown) => value === undefined || value === null ? undefined : responseId(value);
function user(value: unknown): DiscordUser {
  const row = object(value);
  return { id: responseId(row.id), username: text(row.username, 100), displayName: row.global_name == null ? null : text(row.global_name, 100), bot: row.bot === true };
}
function channel(value: unknown): DiscordChannel {
  const row = object(value), guildId = optionalId(row.guild_id), parentId = optionalId(row.parent_id), lastMessageId = optionalId(row.last_message_id);
  return { id: responseId(row.id), type: integer(row.type), name: row.name == null ? null : text(row.name, 100),
    ...(guildId ? { guildId } : {}), ...(parentId ? { parentId } : {}), ...(lastMessageId ? { lastMessageId } : {}),
    ...(typeof row.topic === 'string' ? { topic: text(row.topic, 10_000) } : {}), recipients: row.recipients === undefined ? [] : array(row.recipients, 1000).map(user) };
}
function timestamp(value: unknown) { const result = text(value, 64); if (!Number.isFinite(Date.parse(result))) badResponse(); return result; }
function safeUrl(value: unknown) {
  const result = text(value, 8192);
  try { const url = new URL(result); if (url.protocol !== 'https:' || url.username || url.password) return undefined; return url.toString(); }
  catch { return undefined; }
}
function message(value: unknown, expectedChannel?: string): DiscordMessage {
  const row = object(value), channelId = responseId(row.channel_id), guildId = optionalId(row.guild_id);
  if (expectedChannel && channelId !== expectedChannel) badResponse();
  const reference = row.message_reference == null ? undefined : object(row.message_reference);
  return { id: responseId(row.id), channelId, ...(guildId ? { guildId } : {}), type: integer(row.type), author: user(row.author),
    ...(typeof row.hit === 'boolean' ? { searchHit: row.hit } : {}),
    content: text(row.content, 200_000), timestamp: timestamp(row.timestamp), editedTimestamp: row.edited_timestamp == null ? null : timestamp(row.edited_timestamp),
    attachments: array(row.attachments ?? [], 100).map(value => { const attachment = object(value), url = attachment.url == null ? undefined : safeUrl(attachment.url);
      return { id: responseId(attachment.id), filename: text(attachment.filename, 1024), bytes: integer(attachment.size, Number.MAX_SAFE_INTEGER),
        ...(attachment.content_type === undefined ? {} : { contentType: text(attachment.content_type, 200) }), ...(url ? { url } : {}) }; }),
    mentions: array(row.mentions ?? [], 1000).map(value => responseId(object(value).id)),
    ...(reference ? { reference: { ...(optionalId(reference.message_id) ? { messageId: responseId(reference.message_id) } : {}),
      ...(optionalId(reference.channel_id) ? { channelId: responseId(reference.channel_id) } : {}), ...(optionalId(reference.guild_id) ? { guildId: responseId(reference.guild_id) } : {}),
      ...(reference.type === undefined ? {} : { type: integer(reference.type) }) } } : {}),
    embeds: array(row.embeds ?? [], 20).map(value => { const embed = object(value), url = embed.url === undefined ? undefined : safeUrl(embed.url);
      return { ...(embed.title === undefined ? {} : { title: text(embed.title, 1024) }), ...(embed.description === undefined ? {} : { description: text(embed.description, 16_000) }),
        ...(url ? { url } : {}), fields: array(embed.fields ?? [], 100).map(value => { const field = object(value); return { name: text(field.name, 1024), value: text(field.value, 16_000) }; }) }; }) };
}
function redact<T>(value: T, token: string): T {
  if (typeof value === 'string') return value.replaceAll(token, '[redacted]') as T;
  if (Array.isArray(value)) return value.map(item => redact(item, token)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, token)])) as T;
  return value;
}
type Route = { url: URL; key: string; limit?: number; cursor?: string };
function route(request: DiscordReadRequest): Route {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return invalid();
  const url = new URL('https://discord.com/api/v10/users/@me');
  const fields = (allowed: string[]) => { if (Object.keys(request).some(key => !['action', ...allowed].includes(key))) invalid(); };
  const snowflake = (value: unknown): string => id(value) ? value as string : invalid();
  const limit = (value: unknown, maximum: number, fallback = maximum) => value === undefined ? fallback : Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= maximum ? Number(value) : invalid();
  let count: number | undefined, cursor: string | undefined;
  switch (request.action) {
    case 'account': fields([]); break;
    case 'guilds':
      fields(['limit', 'after']); url.pathname += '/guilds'; count = limit(request.limit, 200); url.searchParams.set('limit', String(count));
      if (request.after !== undefined) { cursor = snowflake(request.after); url.searchParams.set('after', cursor); } break;
    case 'channels': fields(['guildId']); url.pathname = `/api/v10/guilds/${snowflake(request.guildId)}/channels`; break;
    case 'private_channels': fields([]); url.pathname += '/channels'; break;
    case 'relationships': fields([]); url.pathname += '/relationships'; break;
    case 'messages':
      fields(['channelId', 'limit', 'before', 'after']); url.pathname = `/api/v10/channels/${snowflake(request.channelId)}/messages`;
      count = limit(request.limit, 100, 50); url.searchParams.set('limit', String(count));
      if (request.before !== undefined && request.after !== undefined) invalid();
      if (request.before !== undefined) { cursor = snowflake(request.before); url.searchParams.set('before', cursor); }
      if (request.after !== undefined) { cursor = snowflake(request.after); url.searchParams.set('after', cursor); } break;
    case 'message':
      fields(['channelId', 'messageId']); url.pathname = `/api/v10/channels/${snowflake(request.channelId)}/messages`;
      url.searchParams.set('around', snowflake(request.messageId)); url.searchParams.set('limit', '1'); count = 1; break;
    case 'search':
      fields(['scope', 'scopeId', 'text', 'limit', 'offset', 'authorId', 'before', 'after']);
      if (!['guild', 'channel'].includes(request.scope) || typeof request.text !== 'string' || !request.text.trim() || request.text.length > 1024) invalid();
      url.pathname = `/api/v10/${request.scope === 'guild' ? 'guilds' : 'channels'}/${snowflake(request.scopeId)}/messages/search`;
      count = limit(request.limit, 25); url.searchParams.set('limit', String(count)); url.searchParams.set('content', request.text); url.searchParams.set('sort_by', 'timestamp'); url.searchParams.set('sort_order', 'desc');
      if (request.offset !== undefined) { if (!Number.isSafeInteger(request.offset) || request.offset < 0 || request.offset > 9975) invalid(); url.searchParams.set('offset', String(request.offset)); }
      if (request.authorId !== undefined) url.searchParams.set('author_id', snowflake(request.authorId));
      if (request.before !== undefined) url.searchParams.set('max_id', snowflake(request.before));
      if (request.after !== undefined) url.searchParams.set('min_id', snowflake(request.after)); break;
    default: invalid();
  }
  // No caller can supply an origin, path, method, headers or arbitrary query fields.
  return { url, key: url.pathname, limit: count, cursor };
}
type Saved = { version: 1; token: string; account: DiscordUser };
type Options = { fetcher?: typeof fetch; protection?: Protection; storage?: CredentialStorage; now?: () => number; sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void> };
const instances = new Map<string, DiscordConnection>();
export function discordConnection(directory: string) { let connection = instances.get(directory); if (!connection) { connection = new DiscordConnection(directory); instances.set(directory, connection); } return connection; }

/** An on-demand REST reader. Credentials never enter admitted operation arguments. */
export class DiscordConnection {
  private saved?: Saved;
  private loaded = false;
  private loading?: Promise<void>;
  private generation = 0;
  private error?: string;
  private session = new AbortController();
  private operations: Promise<unknown> = Promise.resolve();
  private credentials: Promise<unknown> = Promise.resolve();
  private nextRequest = 0;
  private globalUntil = 0;
  private readonly routeUntil = new Map<string, number>();
  private readonly routeBucket = new Map<string, string>();
  private readonly bucketUntil = new Map<string, number>();
  private readonly fetcher: typeof fetch;
  private readonly protection: Protection;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private readonly path: string;
  constructor(directory: string, private options: Options = {}) {
    this.path = join(directory, 'discord.credentials'); this.fetcher = options.fetcher ?? fetch; this.protection = options.protection ?? protect;
    this.now = options.now ?? Date.now; this.sleep = options.sleep ?? (async (milliseconds, signal) => { await pause(milliseconds, undefined, { signal }); });
  }
  private async load() {
    if (this.loaded) return;
    const generation = this.generation;
    this.loading ??= (async () => {
      if (this.options.storage) {
        const value = await this.options.storage.read();
        if (value !== undefined) {
          const saved = value as Saved;
          if (saved.version !== 1 || !this.validToken(saved.token) || !saved.account || saved.account.bot) throw new DiscordError('credentials_unavailable', 'Protected Discord credentials are unavailable. Reconnect in Settings.');
          if (generation === this.generation) this.saved = saved;
        }
        this.loaded = true; return;
      }
      try { await access(this.path + '.disabled'); this.loaded = true; this.error = 'Discord is disconnected. Reconnect in Settings.'; return; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new DiscordError('credentials_unavailable', 'Protected Discord credentials are unavailable. Reconnect in Settings.'); }
      let encrypted: Buffer;
      try { if ((await stat(this.path + '.dpapi')).size > 32_768) throw new Error(); encrypted = await readFile(this.path + '.dpapi'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { this.loaded = true; return; } throw new DiscordError('credentials_unavailable', 'Protected Discord credentials are unavailable. Reconnect in Settings.'); }
      try {
        const bytes = await this.protection('unprotect', encrypted);
        try {
          const value = object(JSON.parse(bytes.toString('utf8')));
          if (value.version !== 1 || !this.validToken(value.token)) throw new Error();
          const account = object(value.account);
          const saved: Saved = { version: 1, token: value.token as string, account: { id: responseId(account.id), username: text(account.username, 100), displayName: account.displayName == null ? null : text(account.displayName, 100), bot: account.bot === true } };
          if (saved.account.bot) throw new Error();
          if (generation === this.generation) this.saved = saved;
        } finally { bytes.fill(0); }
        this.loaded = true;
      } catch { if (generation === this.generation) this.saved = undefined; throw new DiscordError('credentials_unavailable', 'Protected Discord credentials are unavailable. Reconnect in Settings.'); }
    })().finally(() => { this.loading = undefined; });
    await this.loading;
  }
  private validToken(token: unknown): token is string { return typeof token === 'string' && /^[A-Za-z0-9._-]{20,4096}$/.test(token); }
  async state(): Promise<DiscordState> {
    try { await this.load(); return { connected: Boolean(this.saved), access: 'read-only', ...(this.saved ? { account: structuredClone(this.saved.account) } : {}), ...(this.error ? { error: this.error } : {}) }; }
    catch { return { connected: false, access: 'read-only', error: 'Protected Discord credentials are unavailable. Reconnect in Settings.' }; }
  }
  private reset() { ++this.generation; this.session.abort(); this.session = new AbortController(); this.saved = undefined; this.loaded = true; this.error = undefined; }
  close() { this.reset(); }
  async connect(token: unknown, signal: AbortSignal = new AbortController().signal): Promise<DiscordState> {
    if (!this.validToken(token)) throw new DiscordError('invalid_input', 'Enter a Discord user token in the dedicated password field.');
    this.reset(); const generation = this.generation;
    const operation = this.credentials.catch(() => undefined).then(async () => {
      await this.loading?.catch(() => undefined); this.saved = undefined;
      if (this.options.storage) await this.options.storage.disconnect();
      else { await mkdir(dirname(this.path), { recursive: true }); await writeFile(this.path + '.disabled', 'disconnected\n', { mode: 0o600 }); await rm(this.path + '.dpapi', { force: true }); }
      const combined = AbortSignal.any([signal, this.session.signal, AbortSignal.timeout(30_000)]);
      const data = await this.enqueue(() => this.request(route({ action: 'account' }), token, generation, combined));
      this.assertCurrent(generation, combined);
      const account = user(data.value); if (account.bot) throw new DiscordError('invalid_input', 'Connect a personal Discord user account token.');
      const saved: Saved = { version: 1, token, account: redact(account, token) };
      try { if (this.options.storage) await this.options.storage.write(saved); else await saveProtectedJson(this.path, saved, this.protection); }
      catch { throw new DiscordError('credentials_unavailable', 'Windows could not save protected Discord credentials. The account is disconnected.'); }
      this.assertCurrent(generation, combined); if (!this.options.storage) await rm(this.path + '.disabled', { force: true });
      this.assertCurrent(generation, combined); this.saved = saved; this.error = undefined;
      return this.state();
    });
    this.credentials = operation;
    try { return await operation; }
    catch (error) { if (generation === this.generation) this.saved = undefined; throw this.safeError(error, signal); }
  }
  async disconnect(): Promise<DiscordState> {
    this.reset();
    const operation = this.credentials.catch(() => undefined).then(async () => {
      await this.loading?.catch(() => undefined); this.saved = undefined;
      if (this.options.storage) await this.options.storage.disconnect();
      else { await mkdir(dirname(this.path), { recursive: true }); await writeFile(this.path + '.disabled', 'disconnected\n', { mode: 0o600 }); await rm(this.path + '.dpapi', { force: true }); await rm(this.path + '.disabled', { force: true }); }
    });
    this.credentials = operation;
    try { await operation; } catch { throw new DiscordError('credentials_unavailable', 'Discord disconnected in this process, but its saved credential could not be removed.'); }
    return this.state();
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> { const result = this.operations.catch(() => undefined).then(operation); this.operations = result.catch(() => undefined); return result; }
  private safeError(error: unknown, signal: AbortSignal) {
    if (signal.aborted) return new DiscordError('cancelled', 'Discord read cancelled.');
    return error instanceof DiscordError ? error : new DiscordError('unavailable', 'Discord could not be reached. Try again later.');
  }
  private assertCurrent(generation: number, signal: AbortSignal) {
    if (generation !== this.generation || signal.aborted) throw new DiscordError('cancelled', 'Discord connection changed or the read was cancelled.');
  }
  private async json(response: Response) {
    const reader = response.body?.getReader(); if (!reader) return badResponse();
    const chunks: Uint8Array[] = []; let bytes = 0;
    try {
      for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 8 * 1024 * 1024) badResponse(); chunks.push(part.value); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch { await reader.cancel().catch(() => undefined); return badResponse(); }
    finally { reader.releaseLock(); }
  }
  private seconds(value: unknown) { const number = typeof value === 'string' && value.trim() ? Number(value) : value; return typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 86_400 ? number : undefined; }
  private async request(route: Route, token: string, generation: number, signal: AbortSignal): Promise<{ value: unknown; indexing?: number }> {
    for (let attempt = 0; attempt < 3; attempt++) {
      this.assertCurrent(generation, signal);
      const bucket = this.routeBucket.get(route.key), until = Math.max(this.nextRequest, this.globalUntil, this.routeUntil.get(route.key) ?? 0, bucket ? this.bucketUntil.get(bucket) ?? 0 : 0);
      const wait = Math.max(0, until - this.now());
      if (wait > 10_000) throw new DiscordError('rate_limited', 'Discord rate limit is active. Try again later.');
      if (wait) await this.sleep(wait, signal);
      this.assertCurrent(generation, signal); this.nextRequest = this.now() + 250;
      const response = await this.fetcher(route.url, { method: 'GET', headers: { Authorization: token, Accept: 'application/json' }, redirect: 'error', signal });
      this.assertCurrent(generation, signal);
      if (response.redirected || response.status >= 300 && response.status < 400) { await response.body?.cancel().catch(() => undefined); throw new DiscordError('unavailable', 'Discord redirected a read request. No redirected request is allowed.'); }
      const reset = this.seconds(response.headers.get('x-ratelimit-reset-after')), bucketId = response.headers.get('x-ratelimit-bucket');
      if (bucketId && bucketId.length <= 200) this.routeBucket.set(route.key, `${bucketId}:${route.url.pathname.match(/\/(?:channels|guilds)\/(\d+)/)?.[1] ?? 'account'}`);
      if (response.headers.get('x-ratelimit-remaining') === '0' && reset !== undefined) {
        const deadline = this.now() + reset * 1000; this.routeUntil.set(route.key, deadline);
        const key = this.routeBucket.get(route.key); if (key) this.bucketUntil.set(key, deadline);
      }
      if (response.status === 401) {
        await response.body?.cancel().catch(() => undefined); this.reset(); this.error = 'Discord rejected the saved token. Reconnect in Settings.';
        if (this.options.storage) await this.options.storage.disconnect().catch(() => undefined);
        else { await writeFile(this.path + '.disabled', 'disconnected\n', { mode: 0o600 }).catch(() => undefined); await rm(this.path + '.dpapi', { force: true }).catch(() => undefined); }
        throw new DiscordError('not_connected', this.error);
      }
      if (response.status === 403 || response.status === 404) { await response.body?.cancel().catch(() => undefined); throw new DiscordError(response.status === 403 ? 'access_denied' : 'not_found', response.status === 403 ? 'Discord denied access to this resource. No retry was made.' : 'The requested Discord resource was not found or is inaccessible.'); }
      if (response.status === 429) {
        const body = object(await this.json(response)), seconds = this.seconds(body.retry_after) ?? this.seconds(response.headers.get('retry-after'));
        if (seconds === undefined) throw new DiscordError('rate_limited', 'Discord rate limit is active. Try again later.');
        const deadline = this.now() + Math.max(50, seconds * 1000); this.routeUntil.set(route.key, deadline);
        const key = this.routeBucket.get(route.key); if (key) this.bucketUntil.set(key, deadline);
        if (body.global === true || response.headers.get('x-ratelimit-global') === 'true') this.globalUntil = deadline;
        if (attempt === 2) throw new DiscordError('rate_limited', 'Discord rate limit is active. Try again later.');
        continue;
      }
      if (response.status === 202 && route.url.pathname.endsWith('/messages/search')) {
        const body = object(await this.json(response)), retry = Math.max(.25, this.seconds(body.retry_after) ?? 2);
        this.routeUntil.set(route.key, this.now() + retry * 1000); return { value: null, indexing: retry };
      }
      if (response.status !== 200) { await response.body?.cancel().catch(() => undefined); throw new DiscordError('unavailable', 'Discord could not complete this read request. Try again later.'); }
      return { value: await this.json(response) };
    }
    throw new DiscordError('rate_limited', 'Discord rate limit is active. Try again later.');
  }
  async execute(request: DiscordReadRequest, signal: AbortSignal): Promise<DiscordReadResult> {
    const target = route(request); await this.load();
    if (!this.saved) throw new DiscordError('not_connected', 'Connect Discord in Settings first.');
    const saved = this.saved, generation = this.generation, combined = AbortSignal.any([signal, this.session.signal, AbortSignal.timeout(30_000)]);
    try {
      const result = await this.enqueue(() => this.request(target, saved.token, generation, combined)); this.assertCurrent(generation, combined);
      const base = { provider: 'discord' as const, access: 'read-only' as const, retrievedAt: new Date(this.now()).toISOString(), accountId: saved.account.id };
      let output: DiscordReadResult;
      switch (request.action) {
        case 'account': { const account = user(result.value); if (account.id !== saved.account.id) badResponse(); output = { ...base, action: 'account', account, coverage: 'Account identity only. No private account settings are returned.' }; break; }
        case 'guilds': {
          const guilds: DiscordGuild[] = array(result.value, 200).map(value => { const row = object(value); return { id: responseId(row.id), name: text(row.name, 200), owner: row.owner === true, ...(typeof row.permissions === 'string' ? { permissions: text(row.permissions, 100) } : {}) }; });
          if (guilds.length > target.limit! || new Set(guilds.map(item => item.id)).size !== guilds.length || request.after && guilds.some(item => BigInt(item.id) <= BigInt(request.after!))) badResponse();
          const nextAfter = guilds.length === target.limit ? guilds.reduce((maximum, item) => BigInt(item.id) > BigInt(maximum) ? item.id : maximum, '0') : null;
          output = { ...base, action: 'guilds', guilds, nextAfter, coverage: 'One guild page. Guild membership does not establish channel or message access.' }; break;
        }
        case 'channels': case 'private_channels': {
          const channels = array(result.value, 5000).map(channel);
          if (new Set(channels.map(item => item.id)).size !== channels.length || request.action === 'channels' && channels.some(item => item.guildId && item.guildId !== request.guildId)) badResponse();
          output = { ...base, action: request.action, channels, coverage: request.action === 'channels' ? 'Guild channel metadata. Threads are not enumerated, and listing does not establish message access.' : 'Active private conversations only. This is not a complete historical DM directory.' }; break;
        }
        case 'relationships': {
          const relationships: DiscordRelationship[] = array(result.value, 5000).map(value => { const row = object(value), account = user(row.user); const relationshipId = responseId(row.id); if (account.id !== relationshipId) badResponse(); return { id: relationshipId, type: integer(row.type), user: account, nickname: row.nickname == null ? null : text(row.nickname, 100) }; });
          output = { ...base, action: 'relationships', relationships, coverage: 'Current returned relationships. Preserve numeric type: 1 is friend, 2 blocked, 3 incoming request, 4 outgoing request. Other types are not friends.' }; break;
        }
        case 'messages': case 'message': {
          const values = array(result.value, 100).map(value => message(value, request.channelId));
          if (new Set(values.map(item => item.id)).size !== values.length || values.length > target.limit!) badResponse();
          if (request.action === 'message') { const found = values.find(value => value.id === request.messageId); if (!found) throw new DiscordError('not_found', 'The requested message was not returned. Neighboring messages were not substituted.'); output = { ...base, action: 'message', message: found, coverage: 'Exact message identity verified through an around query. Attachment bytes were not downloaded.' }; break; }
          if (request.before && values.some(value => BigInt(value.id) >= BigInt(request.before!)) || request.after && values.some(value => BigInt(value.id) <= BigInt(request.after!))) badResponse();
          const ids = values.map(value => BigInt(value.id)), nextBefore = ids.length ? String(ids.reduce((a, b) => a < b ? a : b)) : null, nextAfter = ids.length ? String(ids.reduce((a, b) => a > b ? a : b)) : null;
          output = { ...base, action: 'messages', messages: values, nextBefore, nextAfter, coverage: 'One bounded history page. An empty or short page does not prove complete history, message deletion, or access to message content. Attachment bytes were not downloaded.' }; break;
        }
        case 'search': {
          if (result.indexing !== undefined) { output = { ...base, action: 'search', messages: [], totalResults: null, nextOffset: null, indexing: true, retryAfterSeconds: result.indexing, coverage: 'Discord is building its search index. This is not a zero-match result. Retry after the indicated delay.' }; break; }
          const body = object(result.value), groups = array(body.messages, 25), messages = groups.flatMap(group => array(group, 25).map(value => message(value, request.scope === 'channel' ? request.scopeId : undefined)));
          if (request.scope === 'guild' && messages.some(value => value.guildId && value.guildId !== request.scopeId)) badResponse();
          const totalResults = body.total_results === undefined ? null : integer(body.total_results, Number.MAX_SAFE_INTEGER), offset = request.offset ?? 0;
          const nextOffset = offset + target.limit! <= 9975 && (totalResults === null || offset + target.limit! < totalResults) ? offset + target.limit! : null;
          output = { ...base, action: 'search', messages: [...new Map(messages.map(item => [item.id, item])).values()], totalResults, nextOffset, indexing: false, coverage: 'Scoped search discovery only. Results and counts can change; a short page is not proof of completion. searchHit=false identifies surrounding context rather than a match. Search is not a history or deletion audit.' }; break;
        }
      }
      return redact(output, saved.token);
    } catch (error) { throw this.safeError(error, signal); }
  }
  async capture(request: { channelId: string; messageIds: string[] }, persistence: DiscordImports, signal: AbortSignal, authorizeResume: () => Promise<boolean> = async () => true) {
    if (!request || !id(request.channelId) || !Array.isArray(request.messageIds) || !request.messageIds.length || request.messageIds.length > 25 || request.messageIds.some(value => !id(value)) || new Set(request.messageIds).size !== request.messageIds.length || Object.keys(request).some(key => !['channelId', 'messageIds'].includes(key))) invalid();
    const captured: { messageId: string; recordId: string; revisionId: string }[] = [];
    await this.load(); const generation = this.generation, combined = AbortSignal.any([signal, this.session.signal]);
    for (const messageId of request.messageIds) {
      if (signal.aborted) throw new DiscordError('cancelled', 'Discord capture cancelled. Previously captured sources remain.');
      const result = await this.execute({ action: 'message', channelId: request.channelId, messageId }, combined);
      if (result.action !== 'message') return badResponse();
      const value = result.message;
      // Expiring CDN signatures are availability metadata, not message revisions.
      const retained = { ...value, attachments: value.attachments.map(({ url: _url, ...attachment }) => attachment) };
      const namespace = `discord/${result.accountId}/${request.channelId}`, prior = await persistence.knowledge('sourceIdentity', namespace, messageId);
      if (signal.aborted || !await authorizeResume() || signal.aborted) throw new DiscordError('cancelled', 'Discord capture authority changed. Previously captured sources remain.');
      this.assertCurrent(generation, combined);
      const source = await persistence.knowledge('capture', { id: randomUUID(), causeId: randomUUID(), ...(prior ? { baseRevisionId: prior.revisionId } : {}),
        source: { kind: 'source', origin: 'import', text: JSON.stringify({ provider: 'discord', accountId: result.accountId, message: retained }), author: value.author.displayName ?? value.author.username,
          occurredAt: value.timestamp, external: { namespace, id: messageId } } });
      captured.push({ messageId, recordId: source.recordId, revisionId: source.revisionId });
    }
    return { provider: 'discord', captured, coverage: 'Only these exact messages were captured as imported evidence. Repeating capture deduplicates unchanged messages and retains edits as revisions. No history completeness or deletion audit is implied.' };
  }
}
