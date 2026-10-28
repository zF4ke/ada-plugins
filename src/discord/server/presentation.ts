import type { DiscordMessage, DiscordReadResult, DiscordUser } from '../types.ts';

type MessagePage = Extract<DiscordReadResult, { action: 'messages' | 'search' }>;
type ReferencedMessage = Omit<DiscordMessage, 'author' | 'channelId'> & { authorRef: number; channelRef: number };
export type CompactDiscordRead = Omit<MessagePage, 'messages'> & {
  format: 'discord-message-refs-v1'; authors: DiscordUser[]; channels: string[]; messages: ReferencedMessage[];
};

/** Share repeated presentation metadata while leaving retained originals and message text intact. */
export function compactDiscordRead(result: DiscordReadResult): DiscordReadResult | CompactDiscordRead {
  if (result.action !== 'messages' && result.action !== 'search' || !result.messages.length) return result;
  const authors: DiscordUser[] = [], channels: string[] = [], authorIndexes = new Map<string, number>(), channelIndexes = new Map<string, number>();
  const messages = result.messages.map(message => {
    const authorKey = JSON.stringify(message.author);
    let authorRef = authorIndexes.get(authorKey), channelRef = channelIndexes.get(message.channelId);
    if (authorRef === undefined) { authorRef = authors.length; authors.push(message.author); authorIndexes.set(authorKey, authorRef); }
    if (channelRef === undefined) { channelRef = channels.length; channels.push(message.channelId); channelIndexes.set(message.channelId, channelRef); }
    return Object.fromEntries(Object.entries(message).map(([key, value]) => key === 'author' ? ['authorRef', authorRef] : key === 'channelId' ? ['channelRef', channelRef] : [key, value])) as ReferencedMessage;
  });
  const compact = { format: 'discord-message-refs-v1' as const, authors, channels, ...result, messages };
  return Buffer.byteLength(JSON.stringify(compact)) < Buffer.byteLength(JSON.stringify(result)) ? compact : result;
}

/** Expand the per-page references without changing property order or any serialized field. */
export function expandDiscordRead(result: DiscordReadResult | CompactDiscordRead): DiscordReadResult {
  if (!('format' in result)) return result;
  const reference = <T>(values: T[], index: unknown): T => {
    if (!Number.isSafeInteger(index) || Number(index) < 0 || Number(index) >= values.length) throw new Error('Invalid Discord presentation reference.');
    return values[Number(index)]!;
  };
  return Object.fromEntries(Object.entries(result).filter(([key]) => !['format', 'authors', 'channels'].includes(key)).map(([key, value]) => key === 'messages'
    ? [key, result.messages.map(message => Object.fromEntries(Object.entries(message).map(([field, item]) => field === 'authorRef' ? ['author', reference(result.authors, item)] : field === 'channelRef' ? ['channelId', reference(result.channels, item)] : [field, item])))]
    : [key, value])) as DiscordReadResult;
}
