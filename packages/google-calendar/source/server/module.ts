import type { PluginModule, PluginWorkerContext } from '@ada/plugin-sdk/server';
import { GoogleCalendar, CalendarError, GoogleWriteUncertain, type GoogleRead } from './client.ts';
import { googleWritePlan, type GoogleWriteKind } from './write.ts';
import { InvocationServices, failure, success } from '@ada/plugin-sdk/server';

const services = new InvocationServices();
const calendar = new GoogleCalendar('', services.fetch, services.credentials(), true);
const reads: Record<string, GoogleRead> = { calendar_list: 'calendars', calendar_events: 'events', calendar_task_lists: 'task-lists', calendar_tasks: 'tasks' };
const writes: Record<string, GoogleWriteKind> = { calendar_write_event: 'event', calendar_write_task: 'task' };
const run = (operation: (input: Record<string, unknown>, context: PluginWorkerContext) => Promise<unknown>) => async (input: unknown, context: PluginWorkerContext) => services.run(context, async () => {
  try { context.signal.throwIfAborted(); return success(await operation(input as Record<string, unknown>, context)); }
  catch (error) {
    const result = failure(error, context.signal);
    return { ...result, ...(error instanceof GoogleWriteUncertain ? { outcome: 'failed' as const } : {}), value: { ...result.value as object,
      ...(error instanceof GoogleWriteUncertain ? { effectMayHaveOccurred: true, goalVerified: false, requiresInspection: true } : {}),
      ...(error instanceof CalendarError ? { code: error.code, retryable: error.retryable, ...(error.setupUrl ? { setupUrl: error.setupUrl } : {}) } : {}) } };
  }
});
const handlers: PluginModule['handlers'] = {
  state: run(async () => ({ ...await calendar.state(), authorizationPending: calendar.hasPendingAuthorization() })), configure: run(async input => calendar.configure(input.clientId, input.clientSecret)),
  authorize: run(async input => calendar.authorize(input.access)), complete: run(async () => calendar.completeAuthorization()),
  check: run(async () => calendar.check()), disconnect: run(async () => calendar.disconnect()),
  recover_read: async () => ({ outcome: 'failed', released: true, value: { error: 'The Google read was interrupted. Read again if needed. No request was replayed.' } }),
  recover_write: async () => ({ outcome: 'failed', released: true, value: { error: 'This Google change was interrupted. It may already have happened. Read the destination before retrying; no request was replayed.', code: 'write_uncertain', retryable: false, effectMayHaveOccurred: true, goalVerified: false, requiresInspection: true } }),
};
for (const [name, kind] of Object.entries(reads)) handlers[name] = run(async (input, context) => calendar.read(kind, input, context.signal));
for (const [name, kind] of Object.entries(writes)) {
  handlers[name] = run(async (input, context) => calendar.write(kind, input, context.signal, async () => !context.signal.aborted));
  handlers[name + '_prepare'] = async input => { googleWritePlan(kind, input as Record<string, unknown>); return { resources: [] }; };
}
export default { handlers, deactivate() { calendar.close(); } } satisfies PluginModule;
