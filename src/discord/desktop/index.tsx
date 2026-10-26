import type { PluginBinding } from '@ada/plugin-sdk/server';
import type { DiscordState } from '../types.ts';
import { DiscordConnection, type DiscordInput } from './settings.tsx';
import { useCallback } from 'react';

export default function DiscordSettings({ action }: { binding: PluginBinding; action(id: string, input: Record<string, unknown>, expectedRevision?: number): Promise<unknown> }) {
  const connection = useCallback(async (input?: DiscordInput): Promise<DiscordState> => {
    const { action: id, ...args } = input ?? { action: 'state' };
    const value = await action(id, args);
    if (!value || typeof value !== 'object' || typeof (value as DiscordState).connected !== 'boolean' || (value as DiscordState).access !== 'read-only') throw new Error('Discord connection state is unavailable.');
    return value as DiscordState;
  }, [action]);
  return <DiscordConnection connection={connection} />;
}
