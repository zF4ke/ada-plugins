import type { PluginBinding } from '../../../../../packages/protocol/src/plugins.ts';
import type { CalendarState } from '../../../../../packages/protocol/src/google-calendar.ts';
import { GoogleCalendarSettings, type CalendarInput } from './settings.tsx';
import { useCallback } from 'react';

function state(value: unknown): CalendarState & { authorizationPending?: boolean } {
  if (!value || typeof value !== 'object' || typeof (value as CalendarState).configured !== 'boolean' || typeof (value as CalendarState).connected !== 'boolean' || typeof (value as CalendarState).authorizing !== 'boolean') throw new Error('Google connection state is unavailable.');
  return value as CalendarState & { authorizationPending?: boolean };
}
export default function GoogleConnection({ action }: { binding: PluginBinding; action(id: string, input: Record<string, unknown>, expectedRevision?: number): Promise<unknown> }) {
  const connection = useCallback(async (input?: CalendarInput) => {
    if (input) { const { action: id, ...args } = input; const result = await action(id, args); if (id !== 'authorize') return state(result); }
    const value = state(await action('state', {}));
    return value.authorizationPending ? state(await action('complete', {})) : value;
  }, [action]);
  return <GoogleCalendarSettings connection={connection} />;
}
