import type { PluginModule, PluginWorkerContext } from '@ada/plugin-sdk/server';
import type { DiscordReadRequest } from '../types.ts';
import type { DiscordImports } from '../types.ts';
import { DiscordConnection } from './client.ts';
import { InvocationServices, failure, success } from '@ada/plugin-sdk/server';
import { prepareBrokeredDiscordExport } from './export.ts';
import { compactDiscordRead } from './presentation.ts';

const services = new InvocationServices();
const connection = new DiscordConnection('', { fetcher: services.fetch, storage: services.credentials() });
const run = (operation: (input: Record<string, unknown>, context: PluginWorkerContext) => Promise<unknown>) => async (input: unknown, context: PluginWorkerContext) => services.run(context, async () => {
  try { context.signal.throwIfAborted(); return success(await operation(input as Record<string, unknown>, context)); }
  catch (error) { return failure(error, context.signal); }
});
const imports = { knowledge: async (method: string, ...args: unknown[]) => {
  if (method === 'sourceIdentity') return services.broker('import.retain', { action: 'source-identity', namespace: args[0], id: args[1] });
  if (method === 'capture') return services.broker('import.retain', { action: 'source-capture', value: args[0] });
  throw new Error('Unsupported external evidence import.');
} } as DiscordImports;
export default {
  deactivate() { connection.close(); },
  handlers: {
    state: run(async () => connection.state()), connect: run(async (input, context) => connection.connect(input.token, context.signal)), disconnect: run(async () => connection.disconnect()),
    discord_read: run(async (input, context) => compactDiscordRead(await connection.execute(input as DiscordReadRequest, context.signal))),
    capture_discord_messages: run(async (input, context) => connection.capture(input as { channelId: string; messageIds: string[] }, imports, context.signal, async () => !context.signal.aborted)),
    prepare_discord_import_prepare: async (input, context) => services.run(context, async () => {
      const args = input as { path: string; output: string };
      return { resources: [await context.broker('import.retain', { action: 'resource', path: '', mode: 'read' }), await context.broker('import.retain', { action: 'resource', path: args.output, mode: 'write' })] };
    }),
    prepare_discord_import: run(async (input, context) => prepareBrokeredDiscordExport(input as { path: string; output: string }, context)),
    recover_read: async () => ({ outcome: 'failed', released: true, value: { error: 'The Discord read was interrupted. Read again if needed. No request was replayed.' } }),
    recover_import: async () => ({ outcome: 'failed', released: true, value: { error: 'The import was interrupted. Previously retained originals remain available. Inspect the destination before repeating it. No import was replayed.', effectMayHaveOccurred: true, requiresInspection: true } }),
  },
} satisfies PluginModule;
