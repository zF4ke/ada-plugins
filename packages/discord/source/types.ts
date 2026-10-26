export type DiscordUser = { id: string; username: string; displayName: string | null; bot: boolean };
export type DiscordState = { connected: boolean; access: 'read-only'; account?: DiscordUser; error?: string };
export type DiscordGuild = { id: string; name: string; owner: boolean; permissions?: string };
export type DiscordChannel = { id: string; type: number; guildId?: string; parentId?: string; name: string | null; topic?: string; recipients: DiscordUser[]; lastMessageId?: string };
export type DiscordRelationship = { id: string; type: number; user: DiscordUser; nickname: string | null };
export type DiscordAttachment = { id: string; filename: string; bytes: number; contentType?: string; url?: string };
export type DiscordMessage = { id: string; channelId: string; guildId?: string; type: number; author: DiscordUser; content: string; searchHit?: boolean;
  timestamp: string; editedTimestamp: string | null; attachments: DiscordAttachment[]; mentions: string[];
  reference?: { messageId?: string; channelId?: string; guildId?: string; type?: number };
  embeds: { title?: string; description?: string; url?: string; fields: { name: string; value: string }[] }[] };
export type DiscordReadRequest =
  { action: 'account' } |
  { action: 'guilds'; limit?: number; after?: string } |
  { action: 'channels'; guildId: string } |
  { action: 'private_channels' } |
  { action: 'relationships' } |
  { action: 'messages'; channelId: string; limit?: number; before?: string; after?: string } |
  { action: 'message'; channelId: string; messageId: string } |
  { action: 'search'; scope: 'guild' | 'channel'; scopeId: string; text: string; limit?: number; offset?: number; authorId?: string; before?: string; after?: string };
export type DiscordReadResult = { provider: 'discord'; access: 'read-only'; retrievedAt: string; accountId: string; coverage: string } & (
  { action: 'account'; account: DiscordUser } |
  { action: 'guilds'; guilds: DiscordGuild[]; nextAfter: string | null } |
  { action: 'channels' | 'private_channels'; channels: DiscordChannel[] } |
  { action: 'relationships'; relationships: DiscordRelationship[] } |
  { action: 'messages'; messages: DiscordMessage[]; nextBefore: string | null; nextAfter: string | null } |
  { action: 'message'; message: DiscordMessage } |
  { action: 'search'; messages: DiscordMessage[]; totalResults: number | null; nextOffset: number | null; indexing: boolean; retryAfterSeconds?: number }
);

export type DiscordImports = {
  knowledge(method: 'sourceIdentity', namespace: string, id: string): Promise<{ revisionId: string } | null>;
  knowledge(method: 'capture', input: { id: string; causeId: string; baseRevisionId?: string; source: { kind: 'source'; origin: 'import'; text: string; author: string; occurredAt: string; external: { namespace: string; id: string } } }): Promise<{ recordId: string; revisionId: string }>;
};
