import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactDiscordRead, expandDiscordRead } from '../src/discord/server/presentation.ts';

const author = { id: '100000000000000001', username: 'fixture', displayName: 'Fixture author', bot: false };
const message = index => ({ id: String(100000000000000100n + BigInt(index)), channelId: '100000000000000002', guildId: '100000000000000003', type: 0,
  author: { ...author }, content: 'Olá, 日本語 😀\n"quoted" \\ text ' + index, timestamp: '2026-10-28T10:00:00.000Z', editedTimestamp: null,
  attachments: [], mentions: [], embeds: [] });
const page = messages => ({ provider: 'discord', access: 'read-only', retrievedAt: '2026-10-28T10:01:00.000Z', accountId: author.id,
  action: 'messages', messages, nextBefore: messages.at(-1)?.id ?? null, nextAfter: messages[0]?.id ?? null, coverage: 'One page, not a complete history.' });
const size = value => Buffer.byteLength(JSON.stringify(value));

test('100 messages keep exact serialized fields and text while sharing repeated metadata', () => {
  const original = page(Array.from({ length: 100 }, (_, index) => message(index)));
  original.messages[3].reference = { messageId: original.messages[1].id, channelId: original.messages[1].channelId, guildId: original.messages[1].guildId, type: 0 };
  original.messages[4].attachments = [{ id: '100000000000000009', filename: '日本語.txt', bytes: 42, contentType: 'text/plain', url: 'https://example.invalid/attachment?expires=1' }];
  original.messages[5].embeds = [{ title: 'Título', description: 'A complete description.', url: 'https://example.invalid/', fields: [{ name: 'Nome', value: '内容' }] }];
  const before = JSON.stringify(original), compact = compactDiscordRead(original);
  assert.equal(compact.format, 'discord-message-refs-v1');
  assert.equal(compact.authors.length, 1); assert.equal(compact.channels.length, 1);
  assert.deepEqual(compact.messages.map(item => item.content), original.messages.map(item => item.content));
  assert.equal(JSON.stringify(expandDiscordRead(JSON.parse(JSON.stringify(compact)))), before);
  assert.equal(JSON.stringify(original), before);
  assert.ok(size(compact) < size(original) * .8);
});

test('same author ID with changed metadata stays distinct, as do channels and property orders', () => {
  const original = page(Array.from({ length: 100 }, (_, index) => {
    const value = message(index);
    if (index % 2) value.author = { ...author, displayName: 'Changed name', bot: true };
    if (index % 3) value.channelId = '100000000000000004';
    if (index % 4 === 0) value.author = { username: author.username, id: author.id, displayName: author.displayName, bot: false };
    return Object.fromEntries(Object.entries(value).reverse());
  }));
  const compact = compactDiscordRead(original);
  assert.equal(compact.authors.length, 3); assert.equal(compact.channels.length, 2);
  assert.equal(JSON.stringify(expandDiscordRead(compact)), JSON.stringify(original));
});

test('search pagination, surrounding-context flags and optional fields round trip', () => {
  const original = { ...page(Array.from({ length: 25 }, (_, index) => ({ ...message(index), searchHit: index % 2 === 0 }))),
    action: 'search', totalResults: 103, nextOffset: 25, indexing: false };
  delete original.nextBefore; delete original.nextAfter;
  const compact = compactDiscordRead(original);
  assert.equal(JSON.stringify(expandDiscordRead(compact)), JSON.stringify(original));
  assert.equal(compact.nextOffset, 25); assert.equal(compact.totalResults, 103);
});

test('empty and indexing pages, small exact messages and non-message reads retain their old shapes', () => {
  const empty = page([]), indexing = { ...empty, action: 'search', totalResults: null, nextOffset: null, indexing: true, retryAfterSeconds: 2 };
  const exact = { ...page([]), action: 'message', message: message(0) }; delete exact.messages;
  const account = { ...page([]), action: 'account', account: author }; delete account.messages;
  for (const original of [empty, indexing, exact, account, page([message(0)])]) assert.equal(compactDiscordRead(original), original);
});

test('unique metadata never forces a larger response and invalid compact references fail clearly', () => {
  const unique = page(Array.from({ length: 100 }, (_, index) => ({ ...message(index), author: { ...author, id: String(100000000000001000n + BigInt(index)) }, channelId: String(100000000000002000n + BigInt(index)) })));
  assert.equal(compactDiscordRead(unique), unique);
  const compact = compactDiscordRead(page(Array.from({ length: 100 }, (_, index) => message(index))));
  for (const invalid of [-1, .5, 100, null, '0']) {
    const changed = structuredClone(compact); changed.messages[0].authorRef = invalid;
    assert.throws(() => expandDiscordRead(changed), /Invalid Discord presentation reference/);
  }
});
