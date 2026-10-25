// apps/server/src/plugins/builtin/discord/client.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { access, mkdir as mkdir2, readFile as readFile2, rm as rm2, stat, writeFile } from "node:fs/promises";
import { dirname as dirname2 } from "node:path";
import { join as join2 } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

// packages/security/src/dpapi.ts
import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";
var script = `Add-Type -AssemblyName System.Security
$ErrorActionPreference = 'Stop'
$inputData = [Console]::In.ReadToEnd() | ConvertFrom-Json
$bytes = [Convert]::FromBase64String($inputData.value)
$entropy = [Text.Encoding]::UTF8.GetBytes('Ada/provider-credentials/v1')
if ($inputData.operation -eq 'protect') {
  $result = [Security.Cryptography.ProtectedData]::Protect($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
} else {
  $result = [Security.Cryptography.ProtectedData]::Unprotect($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
}
[Console]::Out.Write([Convert]::ToBase64String($result))`;
var powershell = () => join(process.env.SystemRoot ?? "C:/Windows", "System32/WindowsPowerShell/v1.0/powershell.exe");
var unavailable = () => new Error("Windows could not protect or open the credential.");
var input = (operation, value) => JSON.stringify({ operation, value: value.toString("base64") });
async function protect(operation, value) {
  if (process.platform !== "win32") throw unavailable();
  return new Promise((resolve2, reject) => {
    const child = spawn(powershell(), ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
    let result = "";
    const timer = setTimeout(() => child.kill(), 15e3);
    child.stdout.on("data", (data) => {
      result += data.toString();
      if (result.length > 5e4) child.kill();
    });
    child.once("error", () => {
      clearTimeout(timer);
      reject(unavailable());
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || !result) reject(unavailable());
      else resolve2(Buffer.from(result, "base64"));
    });
    child.stdin.on("error", () => {
    });
    child.stdin.end(input(operation, value));
  });
}

// packages/security/src/protected-json.ts
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
async function saveProtectedJson(path, value, protection = protect) {
  const bytes = Buffer.from(JSON.stringify(value));
  const encrypted = await protection("protect", bytes);
  if (!(await protection("unprotect", encrypted)).equals(bytes)) throw new Error("Credential protection verification failed.");
  await mkdir(dirname(path), { recursive: true });
  const destination = `${path}.dpapi`, temporary = `${destination}.${randomUUID()}.staging`;
  try {
    const file = await open(temporary, "wx", 384);
    try {
      await file.writeFile(encrypted);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, destination);
    await rm(path, { force: true });
  } finally {
    await rm(temporary, { force: true });
  }
}

// apps/server/src/plugins/builtin/discord/client.ts
var DiscordError = class extends Error {
  constructor(code, message2) {
    super(message2);
    this.code = code;
  }
  code;
};
var invalid = () => {
  throw new DiscordError("invalid_input", "Choose a supported Discord read operation with valid IDs and page bounds.");
};
var badResponse = () => {
  throw new DiscordError("invalid_response", "Discord returned an invalid or oversized response.");
};
var object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : badResponse();
var id = (value) => typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
var responseId = (value) => id(value) ? value : badResponse();
var text = (value, maximum) => typeof value === "string" && value.length <= maximum ? value : badResponse();
var integer = (value, maximum = 1e3) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum ? Number(value) : badResponse();
var array = (value, maximum) => Array.isArray(value) && value.length <= maximum ? value : badResponse();
var optionalId = (value) => value === void 0 || value === null ? void 0 : responseId(value);
function user(value) {
  const row = object(value);
  return { id: responseId(row.id), username: text(row.username, 100), displayName: row.global_name == null ? null : text(row.global_name, 100), bot: row.bot === true };
}
function channel(value) {
  const row = object(value), guildId = optionalId(row.guild_id), parentId = optionalId(row.parent_id), lastMessageId = optionalId(row.last_message_id);
  return {
    id: responseId(row.id),
    type: integer(row.type),
    name: row.name == null ? null : text(row.name, 100),
    ...guildId ? { guildId } : {},
    ...parentId ? { parentId } : {},
    ...lastMessageId ? { lastMessageId } : {},
    ...typeof row.topic === "string" ? { topic: text(row.topic, 1e4) } : {},
    recipients: row.recipients === void 0 ? [] : array(row.recipients, 1e3).map(user)
  };
}
function timestamp(value) {
  const result = text(value, 64);
  if (!Number.isFinite(Date.parse(result))) badResponse();
  return result;
}
function safeUrl(value) {
  const result = text(value, 8192);
  try {
    const url = new URL(result);
    if (url.protocol !== "https:" || url.username || url.password) return void 0;
    return url.toString();
  } catch {
    return void 0;
  }
}
function message(value, expectedChannel) {
  const row = object(value), channelId = responseId(row.channel_id), guildId = optionalId(row.guild_id);
  if (expectedChannel && channelId !== expectedChannel) badResponse();
  const reference = row.message_reference == null ? void 0 : object(row.message_reference);
  return {
    id: responseId(row.id),
    channelId,
    ...guildId ? { guildId } : {},
    type: integer(row.type),
    author: user(row.author),
    ...typeof row.hit === "boolean" ? { searchHit: row.hit } : {},
    content: text(row.content, 2e5),
    timestamp: timestamp(row.timestamp),
    editedTimestamp: row.edited_timestamp == null ? null : timestamp(row.edited_timestamp),
    attachments: array(row.attachments ?? [], 100).map((value2) => {
      const attachment = object(value2), url = attachment.url == null ? void 0 : safeUrl(attachment.url);
      return {
        id: responseId(attachment.id),
        filename: text(attachment.filename, 1024),
        bytes: integer(attachment.size, Number.MAX_SAFE_INTEGER),
        ...attachment.content_type === void 0 ? {} : { contentType: text(attachment.content_type, 200) },
        ...url ? { url } : {}
      };
    }),
    mentions: array(row.mentions ?? [], 1e3).map((value2) => responseId(object(value2).id)),
    ...reference ? { reference: {
      ...optionalId(reference.message_id) ? { messageId: responseId(reference.message_id) } : {},
      ...optionalId(reference.channel_id) ? { channelId: responseId(reference.channel_id) } : {},
      ...optionalId(reference.guild_id) ? { guildId: responseId(reference.guild_id) } : {},
      ...reference.type === void 0 ? {} : { type: integer(reference.type) }
    } } : {},
    embeds: array(row.embeds ?? [], 20).map((value2) => {
      const embed = object(value2), url = embed.url === void 0 ? void 0 : safeUrl(embed.url);
      return {
        ...embed.title === void 0 ? {} : { title: text(embed.title, 1024) },
        ...embed.description === void 0 ? {} : { description: text(embed.description, 16e3) },
        ...url ? { url } : {},
        fields: array(embed.fields ?? [], 100).map((value3) => {
          const field = object(value3);
          return { name: text(field.name, 1024), value: text(field.value, 16e3) };
        })
      };
    })
  };
}
function redact(value, token) {
  if (typeof value === "string") return value.replaceAll(token, "[redacted]");
  if (Array.isArray(value)) return value.map((item) => redact(item, token));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item, token)]));
  return value;
}
function route(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return invalid();
  const url = new URL("https://discord.com/api/v10/users/@me");
  const fields = (allowed) => {
    if (Object.keys(request).some((key) => !["action", ...allowed].includes(key))) invalid();
  };
  const snowflake = (value) => id(value) ? value : invalid();
  const limit = (value, maximum, fallback = maximum) => value === void 0 ? fallback : Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= maximum ? Number(value) : invalid();
  let count, cursor;
  switch (request.action) {
    case "account":
      fields([]);
      break;
    case "guilds":
      fields(["limit", "after"]);
      url.pathname += "/guilds";
      count = limit(request.limit, 200);
      url.searchParams.set("limit", String(count));
      if (request.after !== void 0) {
        cursor = snowflake(request.after);
        url.searchParams.set("after", cursor);
      }
      break;
    case "channels":
      fields(["guildId"]);
      url.pathname = `/api/v10/guilds/${snowflake(request.guildId)}/channels`;
      break;
    case "private_channels":
      fields([]);
      url.pathname += "/channels";
      break;
    case "relationships":
      fields([]);
      url.pathname += "/relationships";
      break;
    case "messages":
      fields(["channelId", "limit", "before", "after"]);
      url.pathname = `/api/v10/channels/${snowflake(request.channelId)}/messages`;
      count = limit(request.limit, 100, 50);
      url.searchParams.set("limit", String(count));
      if (request.before !== void 0 && request.after !== void 0) invalid();
      if (request.before !== void 0) {
        cursor = snowflake(request.before);
        url.searchParams.set("before", cursor);
      }
      if (request.after !== void 0) {
        cursor = snowflake(request.after);
        url.searchParams.set("after", cursor);
      }
      break;
    case "message":
      fields(["channelId", "messageId"]);
      url.pathname = `/api/v10/channels/${snowflake(request.channelId)}/messages`;
      url.searchParams.set("around", snowflake(request.messageId));
      url.searchParams.set("limit", "1");
      count = 1;
      break;
    case "search":
      fields(["scope", "scopeId", "text", "limit", "offset", "authorId", "before", "after"]);
      if (!["guild", "channel"].includes(request.scope) || typeof request.text !== "string" || !request.text.trim() || request.text.length > 1024) invalid();
      url.pathname = `/api/v10/${request.scope === "guild" ? "guilds" : "channels"}/${snowflake(request.scopeId)}/messages/search`;
      count = limit(request.limit, 25);
      url.searchParams.set("limit", String(count));
      url.searchParams.set("content", request.text);
      url.searchParams.set("sort_by", "timestamp");
      url.searchParams.set("sort_order", "desc");
      if (request.offset !== void 0) {
        if (!Number.isSafeInteger(request.offset) || request.offset < 0 || request.offset > 9975) invalid();
        url.searchParams.set("offset", String(request.offset));
      }
      if (request.authorId !== void 0) url.searchParams.set("author_id", snowflake(request.authorId));
      if (request.before !== void 0) url.searchParams.set("max_id", snowflake(request.before));
      if (request.after !== void 0) url.searchParams.set("min_id", snowflake(request.after));
      break;
    default:
      invalid();
  }
  return { url, key: url.pathname, limit: count, cursor };
}
var DiscordConnection = class {
  constructor(directory, options = {}) {
    this.options = options;
    this.path = join2(directory, "discord.credentials");
    this.fetcher = options.fetcher ?? fetch;
    this.protection = options.protection ?? protect;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? (async (milliseconds, signal) => {
      await pause(milliseconds, void 0, { signal });
    });
  }
  options;
  saved;
  loaded = false;
  loading;
  generation = 0;
  error;
  session = new AbortController();
  operations = Promise.resolve();
  credentials = Promise.resolve();
  nextRequest = 0;
  globalUntil = 0;
  routeUntil = /* @__PURE__ */ new Map();
  routeBucket = /* @__PURE__ */ new Map();
  bucketUntil = /* @__PURE__ */ new Map();
  fetcher;
  protection;
  now;
  sleep;
  path;
  async load() {
    if (this.loaded) return;
    const generation = this.generation;
    this.loading ??= (async () => {
      if (this.options.storage) {
        const value = await this.options.storage.read();
        if (value !== void 0) {
          const saved = value;
          if (saved.version !== 1 || !this.validToken(saved.token) || !saved.account || saved.account.bot) throw new DiscordError("credentials_unavailable", "Protected Discord credentials are unavailable. Reconnect in Settings.");
          if (generation === this.generation) this.saved = saved;
        }
        this.loaded = true;
        return;
      }
      try {
        await access(this.path + ".disabled");
        this.loaded = true;
        this.error = "Discord is disconnected. Reconnect in Settings.";
        return;
      } catch (error) {
        if (error.code !== "ENOENT") throw new DiscordError("credentials_unavailable", "Protected Discord credentials are unavailable. Reconnect in Settings.");
      }
      let encrypted;
      try {
        if ((await stat(this.path + ".dpapi")).size > 32768) throw new Error();
        encrypted = await readFile2(this.path + ".dpapi");
      } catch (error) {
        if (error.code === "ENOENT") {
          this.loaded = true;
          return;
        }
        throw new DiscordError("credentials_unavailable", "Protected Discord credentials are unavailable. Reconnect in Settings.");
      }
      try {
        const bytes = await this.protection("unprotect", encrypted);
        try {
          const value = object(JSON.parse(bytes.toString("utf8")));
          if (value.version !== 1 || !this.validToken(value.token)) throw new Error();
          const account = object(value.account);
          const saved = { version: 1, token: value.token, account: { id: responseId(account.id), username: text(account.username, 100), displayName: account.displayName == null ? null : text(account.displayName, 100), bot: account.bot === true } };
          if (saved.account.bot) throw new Error();
          if (generation === this.generation) this.saved = saved;
        } finally {
          bytes.fill(0);
        }
        this.loaded = true;
      } catch {
        if (generation === this.generation) this.saved = void 0;
        throw new DiscordError("credentials_unavailable", "Protected Discord credentials are unavailable. Reconnect in Settings.");
      }
    })().finally(() => {
      this.loading = void 0;
    });
    await this.loading;
  }
  validToken(token) {
    return typeof token === "string" && /^[A-Za-z0-9._-]{20,4096}$/.test(token);
  }
  async state() {
    try {
      await this.load();
      return { connected: Boolean(this.saved), access: "read-only", ...this.saved ? { account: structuredClone(this.saved.account) } : {}, ...this.error ? { error: this.error } : {} };
    } catch {
      return { connected: false, access: "read-only", error: "Protected Discord credentials are unavailable. Reconnect in Settings." };
    }
  }
  reset() {
    ++this.generation;
    this.session.abort();
    this.session = new AbortController();
    this.saved = void 0;
    this.loaded = true;
    this.error = void 0;
  }
  close() {
    this.reset();
  }
  async connect(token, signal = new AbortController().signal) {
    if (!this.validToken(token)) throw new DiscordError("invalid_input", "Enter a Discord user token in the dedicated password field.");
    this.reset();
    const generation = this.generation;
    const operation = this.credentials.catch(() => void 0).then(async () => {
      await this.loading?.catch(() => void 0);
      this.saved = void 0;
      if (this.options.storage) await this.options.storage.disconnect();
      else {
        await mkdir2(dirname2(this.path), { recursive: true });
        await writeFile(this.path + ".disabled", "disconnected\n", { mode: 384 });
        await rm2(this.path + ".dpapi", { force: true });
      }
      const combined = AbortSignal.any([signal, this.session.signal, AbortSignal.timeout(3e4)]);
      const data = await this.enqueue(() => this.request(route({ action: "account" }), token, generation, combined));
      this.assertCurrent(generation, combined);
      const account = user(data.value);
      if (account.bot) throw new DiscordError("invalid_input", "Connect a personal Discord user account token.");
      const saved = { version: 1, token, account: redact(account, token) };
      try {
        if (this.options.storage) await this.options.storage.write(saved);
        else await saveProtectedJson(this.path, saved, this.protection);
      } catch {
        throw new DiscordError("credentials_unavailable", "Windows could not save protected Discord credentials. The account is disconnected.");
      }
      this.assertCurrent(generation, combined);
      if (!this.options.storage) await rm2(this.path + ".disabled", { force: true });
      this.assertCurrent(generation, combined);
      this.saved = saved;
      this.error = void 0;
      return this.state();
    });
    this.credentials = operation;
    try {
      return await operation;
    } catch (error) {
      if (generation === this.generation) this.saved = void 0;
      throw this.safeError(error, signal);
    }
  }
  async disconnect() {
    this.reset();
    const operation = this.credentials.catch(() => void 0).then(async () => {
      await this.loading?.catch(() => void 0);
      this.saved = void 0;
      if (this.options.storage) await this.options.storage.disconnect();
      else {
        await mkdir2(dirname2(this.path), { recursive: true });
        await writeFile(this.path + ".disabled", "disconnected\n", { mode: 384 });
        await rm2(this.path + ".dpapi", { force: true });
        await rm2(this.path + ".disabled", { force: true });
      }
    });
    this.credentials = operation;
    try {
      await operation;
    } catch {
      throw new DiscordError("credentials_unavailable", "Discord disconnected in this process, but its saved credential could not be removed.");
    }
    return this.state();
  }
  enqueue(operation) {
    const result = this.operations.catch(() => void 0).then(operation);
    this.operations = result.catch(() => void 0);
    return result;
  }
  safeError(error, signal) {
    if (signal.aborted) return new DiscordError("cancelled", "Discord read cancelled.");
    return error instanceof DiscordError ? error : new DiscordError("unavailable", "Discord could not be reached. Try again later.");
  }
  assertCurrent(generation, signal) {
    if (generation !== this.generation || signal.aborted) throw new DiscordError("cancelled", "Discord connection changed or the read was cancelled.");
  }
  async json(response) {
    const reader = response.body?.getReader();
    if (!reader) return badResponse();
    const chunks = [];
    let bytes = 0;
    try {
      for (; ; ) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > 8 * 1024 * 1024) badResponse();
        chunks.push(part.value);
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      await reader.cancel().catch(() => void 0);
      return badResponse();
    } finally {
      reader.releaseLock();
    }
  }
  seconds(value) {
    const number = typeof value === "string" && value.trim() ? Number(value) : value;
    return typeof number === "number" && Number.isFinite(number) && number >= 0 && number <= 86400 ? number : void 0;
  }
  async request(route2, token, generation, signal) {
    for (let attempt = 0; attempt < 3; attempt++) {
      this.assertCurrent(generation, signal);
      const bucket = this.routeBucket.get(route2.key), until = Math.max(this.nextRequest, this.globalUntil, this.routeUntil.get(route2.key) ?? 0, bucket ? this.bucketUntil.get(bucket) ?? 0 : 0);
      const wait = Math.max(0, until - this.now());
      if (wait > 1e4) throw new DiscordError("rate_limited", "Discord rate limit is active. Try again later.");
      if (wait) await this.sleep(wait, signal);
      this.assertCurrent(generation, signal);
      this.nextRequest = this.now() + 250;
      const response = await this.fetcher(route2.url, { method: "GET", headers: { Authorization: token, Accept: "application/json" }, redirect: "error", signal });
      this.assertCurrent(generation, signal);
      if (response.redirected || response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => void 0);
        throw new DiscordError("unavailable", "Discord redirected a read request. No redirected request is allowed.");
      }
      const reset = this.seconds(response.headers.get("x-ratelimit-reset-after")), bucketId = response.headers.get("x-ratelimit-bucket");
      if (bucketId && bucketId.length <= 200) this.routeBucket.set(route2.key, `${bucketId}:${route2.url.pathname.match(/\/(?:channels|guilds)\/(\d+)/)?.[1] ?? "account"}`);
      if (response.headers.get("x-ratelimit-remaining") === "0" && reset !== void 0) {
        const deadline = this.now() + reset * 1e3;
        this.routeUntil.set(route2.key, deadline);
        const key = this.routeBucket.get(route2.key);
        if (key) this.bucketUntil.set(key, deadline);
      }
      if (response.status === 401) {
        await response.body?.cancel().catch(() => void 0);
        this.reset();
        this.error = "Discord rejected the saved token. Reconnect in Settings.";
        if (this.options.storage) await this.options.storage.disconnect().catch(() => void 0);
        else {
          await writeFile(this.path + ".disabled", "disconnected\n", { mode: 384 }).catch(() => void 0);
          await rm2(this.path + ".dpapi", { force: true }).catch(() => void 0);
        }
        throw new DiscordError("not_connected", this.error);
      }
      if (response.status === 403 || response.status === 404) {
        await response.body?.cancel().catch(() => void 0);
        throw new DiscordError(response.status === 403 ? "access_denied" : "not_found", response.status === 403 ? "Discord denied access to this resource. No retry was made." : "The requested Discord resource was not found or is inaccessible.");
      }
      if (response.status === 429) {
        const body = object(await this.json(response)), seconds = this.seconds(body.retry_after) ?? this.seconds(response.headers.get("retry-after"));
        if (seconds === void 0) throw new DiscordError("rate_limited", "Discord rate limit is active. Try again later.");
        const deadline = this.now() + Math.max(50, seconds * 1e3);
        this.routeUntil.set(route2.key, deadline);
        const key = this.routeBucket.get(route2.key);
        if (key) this.bucketUntil.set(key, deadline);
        if (body.global === true || response.headers.get("x-ratelimit-global") === "true") this.globalUntil = deadline;
        if (attempt === 2) throw new DiscordError("rate_limited", "Discord rate limit is active. Try again later.");
        continue;
      }
      if (response.status === 202 && route2.url.pathname.endsWith("/messages/search")) {
        const body = object(await this.json(response)), retry = Math.max(0.25, this.seconds(body.retry_after) ?? 2);
        this.routeUntil.set(route2.key, this.now() + retry * 1e3);
        return { value: null, indexing: retry };
      }
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => void 0);
        throw new DiscordError("unavailable", "Discord could not complete this read request. Try again later.");
      }
      return { value: await this.json(response) };
    }
    throw new DiscordError("rate_limited", "Discord rate limit is active. Try again later.");
  }
  async execute(request, signal) {
    const target = route(request);
    await this.load();
    if (!this.saved) throw new DiscordError("not_connected", "Connect Discord in Settings first.");
    const saved = this.saved, generation = this.generation, combined = AbortSignal.any([signal, this.session.signal, AbortSignal.timeout(3e4)]);
    try {
      const result = await this.enqueue(() => this.request(target, saved.token, generation, combined));
      this.assertCurrent(generation, combined);
      const base = { provider: "discord", access: "read-only", retrievedAt: new Date(this.now()).toISOString(), accountId: saved.account.id };
      let output;
      switch (request.action) {
        case "account": {
          const account = user(result.value);
          if (account.id !== saved.account.id) badResponse();
          output = { ...base, action: "account", account, coverage: "Account identity only. No private account settings are returned." };
          break;
        }
        case "guilds": {
          const guilds = array(result.value, 200).map((value) => {
            const row = object(value);
            return { id: responseId(row.id), name: text(row.name, 200), owner: row.owner === true, ...typeof row.permissions === "string" ? { permissions: text(row.permissions, 100) } : {} };
          });
          if (guilds.length > target.limit || new Set(guilds.map((item) => item.id)).size !== guilds.length || request.after && guilds.some((item) => BigInt(item.id) <= BigInt(request.after))) badResponse();
          const nextAfter = guilds.length === target.limit ? guilds.reduce((maximum, item) => BigInt(item.id) > BigInt(maximum) ? item.id : maximum, "0") : null;
          output = { ...base, action: "guilds", guilds, nextAfter, coverage: "One guild page. Guild membership does not establish channel or message access." };
          break;
        }
        case "channels":
        case "private_channels": {
          const channels = array(result.value, 5e3).map(channel);
          if (new Set(channels.map((item) => item.id)).size !== channels.length || request.action === "channels" && channels.some((item) => item.guildId && item.guildId !== request.guildId)) badResponse();
          output = { ...base, action: request.action, channels, coverage: request.action === "channels" ? "Guild channel metadata. Threads are not enumerated, and listing does not establish message access." : "Active private conversations only. This is not a complete historical DM directory." };
          break;
        }
        case "relationships": {
          const relationships = array(result.value, 5e3).map((value) => {
            const row = object(value), account = user(row.user);
            const relationshipId = responseId(row.id);
            if (account.id !== relationshipId) badResponse();
            return { id: relationshipId, type: integer(row.type), user: account, nickname: row.nickname == null ? null : text(row.nickname, 100) };
          });
          output = { ...base, action: "relationships", relationships, coverage: "Current returned relationships. Preserve numeric type: 1 is friend, 2 blocked, 3 incoming request, 4 outgoing request. Other types are not friends." };
          break;
        }
        case "messages":
        case "message": {
          const values = array(result.value, 100).map((value) => message(value, request.channelId));
          if (new Set(values.map((item) => item.id)).size !== values.length || values.length > target.limit) badResponse();
          if (request.action === "message") {
            const found = values.find((value) => value.id === request.messageId);
            if (!found) throw new DiscordError("not_found", "The requested message was not returned. Neighboring messages were not substituted.");
            output = { ...base, action: "message", message: found, coverage: "Exact message identity verified through an around query. Attachment bytes were not downloaded." };
            break;
          }
          if (request.before && values.some((value) => BigInt(value.id) >= BigInt(request.before)) || request.after && values.some((value) => BigInt(value.id) <= BigInt(request.after))) badResponse();
          const ids = values.map((value) => BigInt(value.id)), nextBefore = ids.length ? String(ids.reduce((a, b) => a < b ? a : b)) : null, nextAfter = ids.length ? String(ids.reduce((a, b) => a > b ? a : b)) : null;
          output = { ...base, action: "messages", messages: values, nextBefore, nextAfter, coverage: "One bounded history page. An empty or short page does not prove complete history, message deletion, or access to message content. Attachment bytes were not downloaded." };
          break;
        }
        case "search": {
          if (result.indexing !== void 0) {
            output = { ...base, action: "search", messages: [], totalResults: null, nextOffset: null, indexing: true, retryAfterSeconds: result.indexing, coverage: "Discord is building its search index. This is not a zero-match result. Retry after the indicated delay." };
            break;
          }
          const body = object(result.value), groups = array(body.messages, 25), messages = groups.flatMap((group) => array(group, 25).map((value) => message(value, request.scope === "channel" ? request.scopeId : void 0)));
          if (request.scope === "guild" && messages.some((value) => value.guildId && value.guildId !== request.scopeId)) badResponse();
          const totalResults = body.total_results === void 0 ? null : integer(body.total_results, Number.MAX_SAFE_INTEGER), offset = request.offset ?? 0;
          const nextOffset = offset + target.limit <= 9975 && (totalResults === null || offset + target.limit < totalResults) ? offset + target.limit : null;
          output = { ...base, action: "search", messages: [...new Map(messages.map((item) => [item.id, item])).values()], totalResults, nextOffset, indexing: false, coverage: "Scoped search discovery only. Results and counts can change; a short page is not proof of completion. searchHit=false identifies surrounding context rather than a match. Search is not a history or deletion audit." };
          break;
        }
      }
      return redact(output, saved.token);
    } catch (error) {
      throw this.safeError(error, signal);
    }
  }
  async capture(request, persistence, signal, authorizeResume = async () => true) {
    if (!request || !id(request.channelId) || !Array.isArray(request.messageIds) || !request.messageIds.length || request.messageIds.length > 25 || request.messageIds.some((value) => !id(value)) || new Set(request.messageIds).size !== request.messageIds.length || Object.keys(request).some((key) => !["channelId", "messageIds"].includes(key))) invalid();
    const captured = [];
    await this.load();
    const generation = this.generation, combined = AbortSignal.any([signal, this.session.signal]);
    for (const messageId of request.messageIds) {
      if (signal.aborted) throw new DiscordError("cancelled", "Discord capture cancelled. Previously captured sources remain.");
      const result = await this.execute({ action: "message", channelId: request.channelId, messageId }, combined);
      if (result.action !== "message") return badResponse();
      const value = result.message;
      const retained = { ...value, attachments: value.attachments.map(({ url: _url, ...attachment }) => attachment) };
      const namespace = `discord/${result.accountId}/${request.channelId}`, prior = await persistence.knowledge("sourceIdentity", namespace, messageId);
      if (signal.aborted || !await authorizeResume() || signal.aborted) throw new DiscordError("cancelled", "Discord capture authority changed. Previously captured sources remain.");
      this.assertCurrent(generation, combined);
      const source = await persistence.knowledge("capture", {
        id: randomUUID2(),
        causeId: randomUUID2(),
        ...prior ? { baseRevisionId: prior.revisionId } : {},
        source: {
          kind: "source",
          origin: "import",
          text: JSON.stringify({ provider: "discord", accountId: result.accountId, message: retained }),
          author: value.author.displayName ?? value.author.username,
          occurredAt: value.timestamp,
          external: { namespace, id: messageId }
        }
      });
      captured.push({ messageId, recordId: source.recordId, revisionId: source.revisionId });
    }
    return { provider: "discord", captured, coverage: "Only these exact messages were captured as imported evidence. Repeating capture deduplicates unchanged messages and retains edits as revisions. No history completeness or deletion audit is implied." };
  }
};

// apps/server/src/plugins/builtin/support.ts
import { AsyncLocalStorage } from "node:async_hooks";
var InvocationServices = class {
  calls = new AsyncLocalStorage();
  run(context, operation) {
    return this.calls.run(context, operation);
  }
  context() {
    const value = this.calls.getStore();
    if (!value) throw new Error("No active plugin invocation.");
    return value;
  }
  async broker(method, input2) {
    return this.context().broker(method, input2);
  }
  credentials(slot = "account") {
    let revision;
    const load = async () => {
      const value = await this.broker("credential.read", { slot });
      revision = value.revision;
      return value.disconnected ? void 0 : value.value;
    };
    return {
      read: load,
      write: async (value) => {
        if (revision === void 0) await load();
        const saved = await this.broker("credential.write", { slot, value, expectedRevision: revision });
        revision = saved.revision;
      },
      disconnect: async () => {
        if (revision === void 0) await load();
        const saved = await this.broker("credential.disconnect", { slot, expectedRevision: revision });
        revision = saved.revision;
      }
    };
  }
  fetch = async (input2, init = {}) => {
    const context = this.context();
    context.signal.throwIfAborted();
    init.signal?.throwIfAborted();
    const request = input2 instanceof Request ? input2 : void 0;
    const headers = new Headers(request?.headers);
    new Headers(init.headers).forEach((value2, key) => headers.set(key, value2));
    let body = init.body;
    if (body instanceof URLSearchParams) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
      body = body.toString();
    }
    if (body !== void 0 && body !== null && typeof body !== "string") throw new Error("Provider requests require a bounded text body.");
    const value = await context.broker("network.fetch", { url: request?.url ?? String(input2), method: init.method ?? request?.method ?? "GET", headers: Object.fromEntries(headers), ...body ? { body } : {}, maximumBytes: 2e6, timeoutMs: 3e4 });
    context.signal.throwIfAborted();
    init.signal?.throwIfAborted();
    return new Response(value.status === 204 || value.status === 205 || value.status === 304 ? null : Buffer.from(value.body, value.encoding === "base64" ? "base64" : "utf8"), { status: value.status, headers: value.headers });
  };
};
var success = (value) => ({ outcome: "succeeded", released: true, value });
function failure(error, signal) {
  return { outcome: signal.aborted ? "cancelled" : "failed", released: true, value: { error: error instanceof Error ? error.message : "The integration could not complete this action." } };
}

// node_modules/@streamparser/json/dist/mjs/utils/bufferedString.js
var NonBufferedString = class {
  constructor() {
    this.decoder = new TextDecoder("utf-8", { fatal: true });
    this.pending = [];
    this.string = "";
    this.byteLength = 0;
  }
  appendChar(char) {
    this.pending.push(String.fromCharCode(char));
    this.byteLength += 1;
  }
  appendBuf(buf, start = 0, end = buf.length) {
    this.pending.push(this.decoder.decode(buf.subarray(start, end)));
    this.byteLength += end - start;
  }
  appendCharCode(code) {
    this.pending.push(String.fromCharCode(code));
  }
  reset() {
    this.pending = [];
    this.string = "";
    this.byteLength = 0;
  }
  // Folds only the pieces appended since the last call into `string`, so
  // repeated calls (one per chunk when emitting partial tokens) stay linear
  // overall instead of re-joining the whole accumulated string every time.
  toString() {
    if (this.pending.length > 0) {
      this.string += this.pending.join("");
      this.pending = [];
    }
    return this.string;
  }
};
var BufferedString = class {
  /**
   * @param bufferSize The size, in bytes, of the buffer to accumulate into.
   */
  constructor(bufferSize) {
    this.decoder = new TextDecoder("utf-8", { fatal: true });
    this.bufferOffset = 0;
    this.string = "";
    this.byteLength = 0;
    this.buffer = new Uint8Array(bufferSize);
  }
  appendChar(char) {
    if (this.bufferOffset >= this.buffer.length)
      this.flushStringBuffer();
    this.buffer[this.bufferOffset++] = char;
    this.byteLength += 1;
  }
  appendBuf(buf, start = 0, end = buf.length) {
    const size = end - start;
    if (this.bufferOffset + size > this.buffer.length)
      this.flushStringBuffer();
    if (size > this.buffer.length) {
      this.string += this.decoder.decode(buf.subarray(start, end));
      this.byteLength += size;
      return;
    }
    this.buffer.set(buf.subarray(start, end), this.bufferOffset);
    this.bufferOffset += size;
    this.byteLength += size;
  }
  appendCharCode(code) {
    this.flushStringBuffer();
    this.string += String.fromCharCode(code);
  }
  flushStringBuffer() {
    this.string += this.decoder.decode(this.buffer.subarray(0, this.bufferOffset));
    this.bufferOffset = 0;
  }
  reset() {
    this.string = "";
    this.bufferOffset = 0;
    this.byteLength = 0;
  }
  toString() {
    this.flushStringBuffer();
    return this.string;
  }
};

// node_modules/@streamparser/json/dist/mjs/utils/types/tokenType.js
var TokenType;
(function(TokenType2) {
  TokenType2[TokenType2["LEFT_BRACE"] = 0] = "LEFT_BRACE";
  TokenType2[TokenType2["RIGHT_BRACE"] = 1] = "RIGHT_BRACE";
  TokenType2[TokenType2["LEFT_BRACKET"] = 2] = "LEFT_BRACKET";
  TokenType2[TokenType2["RIGHT_BRACKET"] = 3] = "RIGHT_BRACKET";
  TokenType2[TokenType2["COLON"] = 4] = "COLON";
  TokenType2[TokenType2["COMMA"] = 5] = "COMMA";
  TokenType2[TokenType2["TRUE"] = 6] = "TRUE";
  TokenType2[TokenType2["FALSE"] = 7] = "FALSE";
  TokenType2[TokenType2["NULL"] = 8] = "NULL";
  TokenType2[TokenType2["STRING"] = 9] = "STRING";
  TokenType2[TokenType2["NUMBER"] = 10] = "NUMBER";
  TokenType2[TokenType2["SEPARATOR"] = 11] = "SEPARATOR";
})(TokenType || (TokenType = {}));
var tokenType_default = TokenType;

// node_modules/@streamparser/json/dist/mjs/utils/utf-8.js
var charset;
(function(charset2) {
  charset2[charset2["BACKSPACE"] = 8] = "BACKSPACE";
  charset2[charset2["FORM_FEED"] = 12] = "FORM_FEED";
  charset2[charset2["NEWLINE"] = 10] = "NEWLINE";
  charset2[charset2["CARRIAGE_RETURN"] = 13] = "CARRIAGE_RETURN";
  charset2[charset2["TAB"] = 9] = "TAB";
  charset2[charset2["SPACE"] = 32] = "SPACE";
  charset2[charset2["EXCLAMATION_MARK"] = 33] = "EXCLAMATION_MARK";
  charset2[charset2["QUOTATION_MARK"] = 34] = "QUOTATION_MARK";
  charset2[charset2["NUMBER_SIGN"] = 35] = "NUMBER_SIGN";
  charset2[charset2["DOLLAR_SIGN"] = 36] = "DOLLAR_SIGN";
  charset2[charset2["PERCENT_SIGN"] = 37] = "PERCENT_SIGN";
  charset2[charset2["AMPERSAND"] = 38] = "AMPERSAND";
  charset2[charset2["APOSTROPHE"] = 39] = "APOSTROPHE";
  charset2[charset2["LEFT_PARENTHESIS"] = 40] = "LEFT_PARENTHESIS";
  charset2[charset2["RIGHT_PARENTHESIS"] = 41] = "RIGHT_PARENTHESIS";
  charset2[charset2["ASTERISK"] = 42] = "ASTERISK";
  charset2[charset2["PLUS_SIGN"] = 43] = "PLUS_SIGN";
  charset2[charset2["COMMA"] = 44] = "COMMA";
  charset2[charset2["HYPHEN_MINUS"] = 45] = "HYPHEN_MINUS";
  charset2[charset2["FULL_STOP"] = 46] = "FULL_STOP";
  charset2[charset2["SOLIDUS"] = 47] = "SOLIDUS";
  charset2[charset2["DIGIT_ZERO"] = 48] = "DIGIT_ZERO";
  charset2[charset2["DIGIT_ONE"] = 49] = "DIGIT_ONE";
  charset2[charset2["DIGIT_TWO"] = 50] = "DIGIT_TWO";
  charset2[charset2["DIGIT_THREE"] = 51] = "DIGIT_THREE";
  charset2[charset2["DIGIT_FOUR"] = 52] = "DIGIT_FOUR";
  charset2[charset2["DIGIT_FIVE"] = 53] = "DIGIT_FIVE";
  charset2[charset2["DIGIT_SIX"] = 54] = "DIGIT_SIX";
  charset2[charset2["DIGIT_SEVEN"] = 55] = "DIGIT_SEVEN";
  charset2[charset2["DIGIT_EIGHT"] = 56] = "DIGIT_EIGHT";
  charset2[charset2["DIGIT_NINE"] = 57] = "DIGIT_NINE";
  charset2[charset2["COLON"] = 58] = "COLON";
  charset2[charset2["SEMICOLON"] = 59] = "SEMICOLON";
  charset2[charset2["LESS_THAN_SIGN"] = 60] = "LESS_THAN_SIGN";
  charset2[charset2["EQUALS_SIGN"] = 61] = "EQUALS_SIGN";
  charset2[charset2["GREATER_THAN_SIGN"] = 62] = "GREATER_THAN_SIGN";
  charset2[charset2["QUESTION_MARK"] = 63] = "QUESTION_MARK";
  charset2[charset2["COMMERCIAL_AT"] = 64] = "COMMERCIAL_AT";
  charset2[charset2["LATIN_CAPITAL_LETTER_A"] = 65] = "LATIN_CAPITAL_LETTER_A";
  charset2[charset2["LATIN_CAPITAL_LETTER_B"] = 66] = "LATIN_CAPITAL_LETTER_B";
  charset2[charset2["LATIN_CAPITAL_LETTER_C"] = 67] = "LATIN_CAPITAL_LETTER_C";
  charset2[charset2["LATIN_CAPITAL_LETTER_D"] = 68] = "LATIN_CAPITAL_LETTER_D";
  charset2[charset2["LATIN_CAPITAL_LETTER_E"] = 69] = "LATIN_CAPITAL_LETTER_E";
  charset2[charset2["LATIN_CAPITAL_LETTER_F"] = 70] = "LATIN_CAPITAL_LETTER_F";
  charset2[charset2["LATIN_CAPITAL_LETTER_G"] = 71] = "LATIN_CAPITAL_LETTER_G";
  charset2[charset2["LATIN_CAPITAL_LETTER_H"] = 72] = "LATIN_CAPITAL_LETTER_H";
  charset2[charset2["LATIN_CAPITAL_LETTER_I"] = 73] = "LATIN_CAPITAL_LETTER_I";
  charset2[charset2["LATIN_CAPITAL_LETTER_J"] = 74] = "LATIN_CAPITAL_LETTER_J";
  charset2[charset2["LATIN_CAPITAL_LETTER_K"] = 75] = "LATIN_CAPITAL_LETTER_K";
  charset2[charset2["LATIN_CAPITAL_LETTER_L"] = 76] = "LATIN_CAPITAL_LETTER_L";
  charset2[charset2["LATIN_CAPITAL_LETTER_M"] = 77] = "LATIN_CAPITAL_LETTER_M";
  charset2[charset2["LATIN_CAPITAL_LETTER_N"] = 78] = "LATIN_CAPITAL_LETTER_N";
  charset2[charset2["LATIN_CAPITAL_LETTER_O"] = 79] = "LATIN_CAPITAL_LETTER_O";
  charset2[charset2["LATIN_CAPITAL_LETTER_P"] = 80] = "LATIN_CAPITAL_LETTER_P";
  charset2[charset2["LATIN_CAPITAL_LETTER_Q"] = 81] = "LATIN_CAPITAL_LETTER_Q";
  charset2[charset2["LATIN_CAPITAL_LETTER_R"] = 82] = "LATIN_CAPITAL_LETTER_R";
  charset2[charset2["LATIN_CAPITAL_LETTER_S"] = 83] = "LATIN_CAPITAL_LETTER_S";
  charset2[charset2["LATIN_CAPITAL_LETTER_T"] = 84] = "LATIN_CAPITAL_LETTER_T";
  charset2[charset2["LATIN_CAPITAL_LETTER_U"] = 85] = "LATIN_CAPITAL_LETTER_U";
  charset2[charset2["LATIN_CAPITAL_LETTER_V"] = 86] = "LATIN_CAPITAL_LETTER_V";
  charset2[charset2["LATIN_CAPITAL_LETTER_W"] = 87] = "LATIN_CAPITAL_LETTER_W";
  charset2[charset2["LATIN_CAPITAL_LETTER_X"] = 88] = "LATIN_CAPITAL_LETTER_X";
  charset2[charset2["LATIN_CAPITAL_LETTER_Y"] = 89] = "LATIN_CAPITAL_LETTER_Y";
  charset2[charset2["LATIN_CAPITAL_LETTER_Z"] = 90] = "LATIN_CAPITAL_LETTER_Z";
  charset2[charset2["LEFT_SQUARE_BRACKET"] = 91] = "LEFT_SQUARE_BRACKET";
  charset2[charset2["REVERSE_SOLIDUS"] = 92] = "REVERSE_SOLIDUS";
  charset2[charset2["RIGHT_SQUARE_BRACKET"] = 93] = "RIGHT_SQUARE_BRACKET";
  charset2[charset2["CIRCUMFLEX_ACCENT"] = 94] = "CIRCUMFLEX_ACCENT";
  charset2[charset2["LOW_LINE"] = 95] = "LOW_LINE";
  charset2[charset2["GRAVE_ACCENT"] = 96] = "GRAVE_ACCENT";
  charset2[charset2["LATIN_SMALL_LETTER_A"] = 97] = "LATIN_SMALL_LETTER_A";
  charset2[charset2["LATIN_SMALL_LETTER_B"] = 98] = "LATIN_SMALL_LETTER_B";
  charset2[charset2["LATIN_SMALL_LETTER_C"] = 99] = "LATIN_SMALL_LETTER_C";
  charset2[charset2["LATIN_SMALL_LETTER_D"] = 100] = "LATIN_SMALL_LETTER_D";
  charset2[charset2["LATIN_SMALL_LETTER_E"] = 101] = "LATIN_SMALL_LETTER_E";
  charset2[charset2["LATIN_SMALL_LETTER_F"] = 102] = "LATIN_SMALL_LETTER_F";
  charset2[charset2["LATIN_SMALL_LETTER_G"] = 103] = "LATIN_SMALL_LETTER_G";
  charset2[charset2["LATIN_SMALL_LETTER_H"] = 104] = "LATIN_SMALL_LETTER_H";
  charset2[charset2["LATIN_SMALL_LETTER_I"] = 105] = "LATIN_SMALL_LETTER_I";
  charset2[charset2["LATIN_SMALL_LETTER_J"] = 106] = "LATIN_SMALL_LETTER_J";
  charset2[charset2["LATIN_SMALL_LETTER_K"] = 107] = "LATIN_SMALL_LETTER_K";
  charset2[charset2["LATIN_SMALL_LETTER_L"] = 108] = "LATIN_SMALL_LETTER_L";
  charset2[charset2["LATIN_SMALL_LETTER_M"] = 109] = "LATIN_SMALL_LETTER_M";
  charset2[charset2["LATIN_SMALL_LETTER_N"] = 110] = "LATIN_SMALL_LETTER_N";
  charset2[charset2["LATIN_SMALL_LETTER_O"] = 111] = "LATIN_SMALL_LETTER_O";
  charset2[charset2["LATIN_SMALL_LETTER_P"] = 112] = "LATIN_SMALL_LETTER_P";
  charset2[charset2["LATIN_SMALL_LETTER_Q"] = 113] = "LATIN_SMALL_LETTER_Q";
  charset2[charset2["LATIN_SMALL_LETTER_R"] = 114] = "LATIN_SMALL_LETTER_R";
  charset2[charset2["LATIN_SMALL_LETTER_S"] = 115] = "LATIN_SMALL_LETTER_S";
  charset2[charset2["LATIN_SMALL_LETTER_T"] = 116] = "LATIN_SMALL_LETTER_T";
  charset2[charset2["LATIN_SMALL_LETTER_U"] = 117] = "LATIN_SMALL_LETTER_U";
  charset2[charset2["LATIN_SMALL_LETTER_V"] = 118] = "LATIN_SMALL_LETTER_V";
  charset2[charset2["LATIN_SMALL_LETTER_W"] = 119] = "LATIN_SMALL_LETTER_W";
  charset2[charset2["LATIN_SMALL_LETTER_X"] = 120] = "LATIN_SMALL_LETTER_X";
  charset2[charset2["LATIN_SMALL_LETTER_Y"] = 121] = "LATIN_SMALL_LETTER_Y";
  charset2[charset2["LATIN_SMALL_LETTER_Z"] = 122] = "LATIN_SMALL_LETTER_Z";
  charset2[charset2["LEFT_CURLY_BRACKET"] = 123] = "LEFT_CURLY_BRACKET";
  charset2[charset2["VERTICAL_LINE"] = 124] = "VERTICAL_LINE";
  charset2[charset2["RIGHT_CURLY_BRACKET"] = 125] = "RIGHT_CURLY_BRACKET";
  charset2[charset2["TILDE"] = 126] = "TILDE";
})(charset || (charset = {}));
var escapedSequences = {
  [
    34
    /* charset.QUOTATION_MARK */
  ]: 34,
  [
    92
    /* charset.REVERSE_SOLIDUS */
  ]: 92,
  [
    47
    /* charset.SOLIDUS */
  ]: 47,
  [
    98
    /* charset.LATIN_SMALL_LETTER_B */
  ]: 8,
  [
    102
    /* charset.LATIN_SMALL_LETTER_F */
  ]: 12,
  [
    110
    /* charset.LATIN_SMALL_LETTER_N */
  ]: 10,
  [
    114
    /* charset.LATIN_SMALL_LETTER_R */
  ]: 13,
  [
    116
    /* charset.LATIN_SMALL_LETTER_T */
  ]: 9
};

// node_modules/@streamparser/json/dist/mjs/tokenizer.js
var TokenizerStates;
(function(TokenizerStates2) {
  TokenizerStates2[TokenizerStates2["START"] = 0] = "START";
  TokenizerStates2[TokenizerStates2["ENDED"] = 1] = "ENDED";
  TokenizerStates2[TokenizerStates2["ERROR"] = 2] = "ERROR";
  TokenizerStates2[TokenizerStates2["TRUE1"] = 3] = "TRUE1";
  TokenizerStates2[TokenizerStates2["TRUE2"] = 4] = "TRUE2";
  TokenizerStates2[TokenizerStates2["TRUE3"] = 5] = "TRUE3";
  TokenizerStates2[TokenizerStates2["FALSE1"] = 6] = "FALSE1";
  TokenizerStates2[TokenizerStates2["FALSE2"] = 7] = "FALSE2";
  TokenizerStates2[TokenizerStates2["FALSE3"] = 8] = "FALSE3";
  TokenizerStates2[TokenizerStates2["FALSE4"] = 9] = "FALSE4";
  TokenizerStates2[TokenizerStates2["NULL1"] = 10] = "NULL1";
  TokenizerStates2[TokenizerStates2["NULL2"] = 11] = "NULL2";
  TokenizerStates2[TokenizerStates2["NULL3"] = 12] = "NULL3";
  TokenizerStates2[TokenizerStates2["STRING_DEFAULT"] = 13] = "STRING_DEFAULT";
  TokenizerStates2[TokenizerStates2["STRING_AFTER_BACKSLASH"] = 14] = "STRING_AFTER_BACKSLASH";
  TokenizerStates2[TokenizerStates2["STRING_UNICODE_DIGIT_1"] = 15] = "STRING_UNICODE_DIGIT_1";
  TokenizerStates2[TokenizerStates2["STRING_UNICODE_DIGIT_2"] = 16] = "STRING_UNICODE_DIGIT_2";
  TokenizerStates2[TokenizerStates2["STRING_UNICODE_DIGIT_3"] = 17] = "STRING_UNICODE_DIGIT_3";
  TokenizerStates2[TokenizerStates2["STRING_UNICODE_DIGIT_4"] = 18] = "STRING_UNICODE_DIGIT_4";
  TokenizerStates2[TokenizerStates2["STRING_INCOMPLETE_CHAR"] = 19] = "STRING_INCOMPLETE_CHAR";
  TokenizerStates2[TokenizerStates2["NUMBER_AFTER_INITIAL_MINUS"] = 20] = "NUMBER_AFTER_INITIAL_MINUS";
  TokenizerStates2[TokenizerStates2["NUMBER_AFTER_INITIAL_ZERO"] = 21] = "NUMBER_AFTER_INITIAL_ZERO";
  TokenizerStates2[TokenizerStates2["NUMBER_AFTER_INITIAL_NON_ZERO"] = 22] = "NUMBER_AFTER_INITIAL_NON_ZERO";
  TokenizerStates2[TokenizerStates2["NUMBER_AFTER_FULL_STOP"] = 23] = "NUMBER_AFTER_FULL_STOP";
  TokenizerStates2[TokenizerStates2["NUMBER_AFTER_DECIMAL"] = 24] = "NUMBER_AFTER_DECIMAL";
  TokenizerStates2[TokenizerStates2["NUMBER_AFTER_E"] = 25] = "NUMBER_AFTER_E";
  TokenizerStates2[TokenizerStates2["NUMBER_AFTER_E_AND_SIGN"] = 26] = "NUMBER_AFTER_E_AND_SIGN";
  TokenizerStates2[TokenizerStates2["NUMBER_AFTER_E_AND_DIGIT"] = 27] = "NUMBER_AFTER_E_AND_DIGIT";
  TokenizerStates2[TokenizerStates2["SEPARATOR"] = 28] = "SEPARATOR";
  TokenizerStates2[TokenizerStates2["BOM_OR_START"] = 29] = "BOM_OR_START";
  TokenizerStates2[TokenizerStates2["BOM"] = 30] = "BOM";
})(TokenizerStates || (TokenizerStates = {}));
function TokenizerStateToString(tokenizerState) {
  return [
    "START",
    "ENDED",
    "ERROR",
    "TRUE1",
    "TRUE2",
    "TRUE3",
    "FALSE1",
    "FALSE2",
    "FALSE3",
    "FALSE4",
    "NULL1",
    "NULL2",
    "NULL3",
    "STRING_DEFAULT",
    "STRING_AFTER_BACKSLASH",
    "STRING_UNICODE_DIGIT_1",
    "STRING_UNICODE_DIGIT_2",
    "STRING_UNICODE_DIGIT_3",
    "STRING_UNICODE_DIGIT_4",
    "STRING_INCOMPLETE_CHAR",
    "NUMBER_AFTER_INITIAL_MINUS",
    "NUMBER_AFTER_INITIAL_ZERO",
    "NUMBER_AFTER_INITIAL_NON_ZERO",
    "NUMBER_AFTER_FULL_STOP",
    "NUMBER_AFTER_DECIMAL",
    "NUMBER_AFTER_E",
    "NUMBER_AFTER_E_AND_SIGN",
    "NUMBER_AFTER_E_AND_DIGIT",
    "SEPARATOR",
    "BOM_OR_START",
    "BOM"
  ][tokenizerState];
}
var defaultOpts = {
  stringBufferSize: 0,
  numberBufferSize: 0,
  separator: void 0,
  emitPartialTokens: false
};
var TokenizerError = class _TokenizerError extends Error {
  /**
   * @param message What went wrong.
   */
  constructor(message2) {
    super(message2);
    Object.setPrototypeOf(this, _TokenizerError.prototype);
  }
};
function validateBufferSize(name, size) {
  if (size === void 0)
    return;
  if (!Number.isInteger(size) || size < 0) {
    throw new TokenizerError(`Invalid "${name}": ${size}. Expected a non-negative integer.`);
  }
}
function utf8SequenceLength(leadByte) {
  if (leadByte >= 194 && leadByte <= 223)
    return 2;
  if (leadByte <= 239)
    return 3;
  return 4;
}
function multiByteRunEnd(buffer, start) {
  let j = start;
  while (j < buffer.length && buffer[j] >= 128) {
    const seqLength = utf8SequenceLength(buffer[j]);
    if (j + seqLength > buffer.length)
      break;
    j += seqLength;
  }
  return j;
}
var Tokenizer = class {
  /**
   * @param opts How to tokenize. See {@linkcode TokenizerOptions}.
   */
  constructor(opts) {
    this.state = 29;
    this.bomIndex = 0;
    this.separatorIndex = 0;
    this.escapedCharsByteLength = 0;
    this.bytes_remaining = 0;
    this.bytes_in_sequence = 0;
    this.char_split_buffer = new Uint8Array(4);
    this.encoder = new TextEncoder();
    this.offset = -1;
    this.streamByteLength = 0;
    opts = Object.assign(Object.assign({}, defaultOpts), opts);
    validateBufferSize("stringBufferSize", opts.stringBufferSize);
    validateBufferSize("numberBufferSize", opts.numberBufferSize);
    this.emitPartialTokens = opts.emitPartialTokens === true;
    this.bufferedString = opts.stringBufferSize && opts.stringBufferSize > 4 ? new BufferedString(opts.stringBufferSize) : new NonBufferedString();
    this.bufferedNumber = opts.numberBufferSize && opts.numberBufferSize > 0 ? new BufferedString(opts.numberBufferSize) : new NonBufferedString();
    this.separator = opts.separator;
    this.separatorBytes = opts.separator ? this.encoder.encode(opts.separator) : void 0;
  }
  /** Whether the tokenizer is ended, and thus no longer accepting data. */
  get isEnded() {
    return this.state === 1;
  }
  // Appends the code unit decoded from one \uXXXX escape, matching
  // JSON.parse's handling of surrogates: a valid high/low surrogate pair
  // combines into one character; an unpaired high or low surrogate is kept
  // as a raw UTF-16 code unit rather than replaced or dropped (JS strings
  // are free to contain lone surrogates; only encoding them as UTF-8 bytes
  // is lossy, which is why appendCharCode -- not the encoder -- is used for
  // them).
  appendUnicodeCodeUnit(intVal) {
    if (this.highSurrogate !== void 0) {
      if (intVal >= 56320 && intVal <= 57343) {
        const unicodeString2 = String.fromCharCode(this.highSurrogate, intVal);
        const unicodeBuffer2 = this.encoder.encode(unicodeString2);
        this.bufferedString.appendBuf(unicodeBuffer2);
        this.escapedCharsByteLength += 6 - unicodeBuffer2.byteLength;
        this.highSurrogate = void 0;
        return;
      }
      this.flushPendingHighSurrogate();
    }
    if (intVal >= 55296 && intVal <= 56319) {
      this.highSurrogate = intVal;
      this.escapedCharsByteLength += 6;
      return;
    }
    if (intVal >= 56320 && intVal <= 57343) {
      this.bufferedString.appendCharCode(intVal);
      this.escapedCharsByteLength += 6;
      return;
    }
    const unicodeString = String.fromCharCode(intVal);
    const unicodeBuffer = this.encoder.encode(unicodeString);
    this.bufferedString.appendBuf(unicodeBuffer);
    this.escapedCharsByteLength += 6 - unicodeBuffer.byteLength;
  }
  flushPendingHighSurrogate() {
    if (this.highSurrogate !== void 0) {
      this.bufferedString.appendCharCode(this.highSurrogate);
      this.highSurrogate = void 0;
    }
  }
  // Stash the leading bytes of a multi-byte character split across the chunk
  // boundary; STRING_INCOMPLETE_CHAR completes it from the next chunk.
  startIncompleteChar(buffer, start) {
    this.bytes_in_sequence = utf8SequenceLength(buffer[start]);
    this.bytes_remaining = start + this.bytes_in_sequence - buffer.length;
    this.char_split_buffer.set(buffer.subarray(start));
    this.state = 19;
  }
  /**
   * Pushes the next chunk of the JSON stream into the tokenizer.
   *
   * Tokenizing happens synchronously, so every token in `input` is emitted
   * through {@linkcode Tokenizer.onToken} before this returns. A chunk may end
   * anywhere, including in the middle of a multi-byte character; the rest of it
   * is picked up from the next chunk.
   *
   * @param input The chunk to tokenize: a string, a `TypedArray`, or any
   * iterable of utf-8 byte values.
   * @throws {TokenizerError} If the data is not valid JSON and no
   * {@linkcode Tokenizer.onError} callback has been set.
   */
  write(input2) {
    try {
      let buffer;
      if (input2 instanceof Uint8Array) {
        buffer = input2;
      } else if (typeof input2 === "string") {
        if (this.pendingStringSurrogate !== void 0) {
          input2 = this.pendingStringSurrogate + input2;
          this.pendingStringSurrogate = void 0;
        }
        const lastCharCode = input2.charCodeAt(input2.length - 1);
        if (lastCharCode >= 55296 && lastCharCode <= 56319) {
          this.pendingStringSurrogate = input2[input2.length - 1];
          input2 = input2.slice(0, -1);
        }
        buffer = this.encoder.encode(input2);
      } else if (ArrayBuffer.isView(input2)) {
        buffer = new Uint8Array(input2.buffer, input2.byteOffset, input2.byteLength);
      } else if (input2 !== null && typeof input2 === "object" && typeof input2[Symbol.iterator] === "function") {
        buffer = Uint8Array.from(input2);
      } else {
        throw new TypeError("Unexpected type. The `write` function only accepts Iterables (e.g. Arrays, Sets, Generators), TypedArrays and Strings.");
      }
      for (let i = 0; i < buffer.length; i += 1) {
        const n = buffer[i];
        switch (this.state) {
          // @ts-expect-error fall through case
          case 29:
            if (n === 239) {
              this.bom = [239, 187, 191];
              this.bomIndex += 1;
              this.state = 30;
              continue;
            }
            if (input2 instanceof Uint16Array) {
              if (n === 254) {
                this.bom = [254, 255];
                this.bomIndex += 1;
                this.state = 30;
                continue;
              }
              if (n === 255) {
                this.bom = [255, 254];
                this.bomIndex += 1;
                this.state = 30;
                continue;
              }
            }
            if (input2 instanceof Uint32Array) {
              if (n === 0) {
                this.bom = [0, 0, 254, 255];
                this.bomIndex += 1;
                this.state = 30;
                continue;
              }
              if (n === 255) {
                this.bom = [255, 254, 0, 0];
                this.bomIndex += 1;
                this.state = 30;
                continue;
              }
            }
          case 0:
            this.offset += 1;
            if (this.separatorBytes && n === this.separatorBytes[0]) {
              if (this.separatorBytes.length === 1) {
                this.state = 0;
                this.onToken({
                  token: tokenType_default.SEPARATOR,
                  value: this.separator,
                  offset: this.offset + this.separatorBytes.length - 1
                });
                continue;
              }
              this.state = 28;
              continue;
            }
            if (n === 32 || n === 10 || n === 13 || n === 9) {
              continue;
            }
            if (n === 123) {
              this.onToken({
                token: tokenType_default.LEFT_BRACE,
                value: "{",
                offset: this.offset
              });
              continue;
            }
            if (n === 125) {
              this.onToken({
                token: tokenType_default.RIGHT_BRACE,
                value: "}",
                offset: this.offset
              });
              continue;
            }
            if (n === 91) {
              this.onToken({
                token: tokenType_default.LEFT_BRACKET,
                value: "[",
                offset: this.offset
              });
              continue;
            }
            if (n === 93) {
              this.onToken({
                token: tokenType_default.RIGHT_BRACKET,
                value: "]",
                offset: this.offset
              });
              continue;
            }
            if (n === 58) {
              this.onToken({
                token: tokenType_default.COLON,
                value: ":",
                offset: this.offset
              });
              continue;
            }
            if (n === 44) {
              this.onToken({
                token: tokenType_default.COMMA,
                value: ",",
                offset: this.offset
              });
              continue;
            }
            if (n === 116) {
              this.state = 3;
              continue;
            }
            if (n === 102) {
              this.state = 6;
              continue;
            }
            if (n === 110) {
              this.state = 10;
              continue;
            }
            if (n === 34) {
              this.bufferedString.reset();
              this.escapedCharsByteLength = 0;
              this.state = 13;
              continue;
            }
            if (n >= 49 && n <= 57) {
              this.bufferedNumber.reset();
              this.bufferedNumber.appendChar(n);
              this.state = 22;
              continue;
            }
            if (n === 48) {
              this.bufferedNumber.reset();
              this.bufferedNumber.appendChar(n);
              this.state = 21;
              continue;
            }
            if (n === 45) {
              this.bufferedNumber.reset();
              this.bufferedNumber.appendChar(n);
              this.state = 20;
              continue;
            }
            break;
          // STRING
          case 13:
            if (n === 34) {
              this.flushPendingHighSurrogate();
              const string = this.bufferedString.toString();
              this.state = 0;
              this.onToken({
                token: tokenType_default.STRING,
                value: string,
                offset: this.offset
              });
              this.offset += this.escapedCharsByteLength + this.bufferedString.byteLength + 1;
              continue;
            }
            if (n === 92) {
              this.state = 14;
              continue;
            }
            if (n >= 128) {
              this.flushPendingHighSurrogate();
              const runEnd = multiByteRunEnd(buffer, i);
              if (runEnd > i) {
                this.bufferedString.appendBuf(buffer, i, runEnd);
                i = runEnd - 1;
              }
              if (runEnd < buffer.length && buffer[runEnd] >= 128) {
                this.startIncompleteChar(buffer, runEnd);
                i = buffer.length - 1;
              }
              continue;
            }
            if (n >= 32) {
              this.flushPendingHighSurrogate();
              let j = i;
              while (j < buffer.length) {
                const b = buffer[j];
                if (b < 32 || b >= 128 || b === 34 || b === 92)
                  break;
                j += 1;
              }
              if (j - i >= 16) {
                this.bufferedString.appendBuf(buffer, i, j);
              } else {
                for (let k = i; k < j; k += 1)
                  this.bufferedString.appendChar(buffer[k]);
              }
              i = j - 1;
              continue;
            }
            break;
          case 19: {
            const available = Math.min(this.bytes_remaining, buffer.length - i);
            this.char_split_buffer.set(buffer.subarray(i, i + available), this.bytes_in_sequence - this.bytes_remaining);
            this.bytes_remaining -= available;
            if (this.bytes_remaining > 0) {
              i = buffer.length - 1;
              continue;
            }
            this.bufferedString.appendBuf(this.char_split_buffer, 0, this.bytes_in_sequence);
            i += available - 1;
            this.state = 13;
            continue;
          }
          case 14: {
            const controlChar = escapedSequences[n];
            if (controlChar) {
              this.flushPendingHighSurrogate();
              this.bufferedString.appendChar(controlChar);
              this.escapedCharsByteLength += 1;
              this.state = 13;
              continue;
            }
            if (n === 117) {
              this.unicode = "";
              this.state = 15;
              continue;
            }
            break;
          }
          case 15:
          case 16:
          case 17:
            if (n >= 48 && n <= 57 || n >= 65 && n <= 70 || n >= 97 && n <= 102) {
              this.unicode += String.fromCharCode(n);
              this.state += 1;
              continue;
            }
            break;
          case 18:
            if (n >= 48 && n <= 57 || n >= 65 && n <= 70 || n >= 97 && n <= 102) {
              const intVal = parseInt(this.unicode + String.fromCharCode(n), 16);
              this.appendUnicodeCodeUnit(intVal);
              this.state = 13;
              continue;
            }
            break;
          // Number
          case 20:
            if (n === 48) {
              this.bufferedNumber.appendChar(n);
              this.state = 21;
              continue;
            }
            if (n >= 49 && n <= 57) {
              this.bufferedNumber.appendChar(n);
              this.state = 22;
              continue;
            }
            break;
          case 21:
            if (n === 46) {
              this.bufferedNumber.appendChar(n);
              this.state = 23;
              continue;
            }
            if (n === 101 || n === 69) {
              this.bufferedNumber.appendChar(n);
              this.state = 25;
              continue;
            }
            i -= 1;
            this.state = 0;
            this.emitNumber();
            continue;
          case 22:
            if (n >= 48 && n <= 57) {
              this.bufferedNumber.appendChar(n);
              continue;
            }
            if (n === 46) {
              this.bufferedNumber.appendChar(n);
              this.state = 23;
              continue;
            }
            if (n === 101 || n === 69) {
              this.bufferedNumber.appendChar(n);
              this.state = 25;
              continue;
            }
            i -= 1;
            this.state = 0;
            this.emitNumber();
            continue;
          case 23:
            if (n >= 48 && n <= 57) {
              this.bufferedNumber.appendChar(n);
              this.state = 24;
              continue;
            }
            break;
          case 24:
            if (n >= 48 && n <= 57) {
              this.bufferedNumber.appendChar(n);
              continue;
            }
            if (n === 101 || n === 69) {
              this.bufferedNumber.appendChar(n);
              this.state = 25;
              continue;
            }
            i -= 1;
            this.state = 0;
            this.emitNumber();
            continue;
          // @ts-expect-error fall through case
          case 25:
            if (n === 43 || n === 45) {
              this.bufferedNumber.appendChar(n);
              this.state = 26;
              continue;
            }
          case 26:
            if (n >= 48 && n <= 57) {
              this.bufferedNumber.appendChar(n);
              this.state = 27;
              continue;
            }
            break;
          case 27:
            if (n >= 48 && n <= 57) {
              this.bufferedNumber.appendChar(n);
              continue;
            }
            i -= 1;
            this.state = 0;
            this.emitNumber();
            continue;
          // TRUE
          case 3:
            if (n === 114) {
              this.state = 4;
              continue;
            }
            break;
          case 4:
            if (n === 117) {
              this.state = 5;
              continue;
            }
            break;
          case 5:
            if (n === 101) {
              this.state = 0;
              this.onToken({
                token: tokenType_default.TRUE,
                value: true,
                offset: this.offset
              });
              this.offset += 3;
              continue;
            }
            break;
          // FALSE
          case 6:
            if (n === 97) {
              this.state = 7;
              continue;
            }
            break;
          case 7:
            if (n === 108) {
              this.state = 8;
              continue;
            }
            break;
          case 8:
            if (n === 115) {
              this.state = 9;
              continue;
            }
            break;
          case 9:
            if (n === 101) {
              this.state = 0;
              this.onToken({
                token: tokenType_default.FALSE,
                value: false,
                offset: this.offset
              });
              this.offset += 4;
              continue;
            }
            break;
          // NULL
          case 10:
            if (n === 117) {
              this.state = 11;
              continue;
            }
            break;
          case 11:
            if (n === 108) {
              this.state = 12;
              continue;
            }
            break;
          case 12:
            if (n === 108) {
              this.state = 0;
              this.onToken({
                token: tokenType_default.NULL,
                value: null,
                offset: this.offset
              });
              this.offset += 3;
              continue;
            }
            break;
          case 28:
            this.separatorIndex += 1;
            if (!this.separatorBytes || n !== this.separatorBytes[this.separatorIndex]) {
              break;
            }
            if (this.separatorIndex === this.separatorBytes.length - 1) {
              this.state = 0;
              this.onToken({
                token: tokenType_default.SEPARATOR,
                value: this.separator,
                offset: this.offset + this.separatorIndex
              });
              this.separatorIndex = 0;
            }
            continue;
          // BOM support
          case 30:
            if (n === this.bom[this.bomIndex]) {
              if (this.bomIndex === this.bom.length - 1) {
                this.state = 0;
                this.bom = void 0;
                this.bomIndex = 0;
                continue;
              }
              this.bomIndex += 1;
              continue;
            }
            break;
          case 1:
            if (n === 32 || n === 10 || n === 13 || n === 9) {
              continue;
            }
        }
        throw new TokenizerError(`Unexpected "${String.fromCharCode(n)}" at chunk position "${i}" (absolute position "${this.streamByteLength + i}") in state ${TokenizerStateToString(this.state)}`);
      }
      this.streamByteLength += buffer.length;
      if (this.emitPartialTokens) {
        switch (this.state) {
          case 3:
          case 4:
          case 5:
            this.onToken({
              token: tokenType_default.TRUE,
              value: true,
              offset: this.offset,
              partial: true
            });
            break;
          case 6:
          case 7:
          case 8:
          case 9:
            this.onToken({
              token: tokenType_default.FALSE,
              value: false,
              offset: this.offset,
              partial: true
            });
            break;
          case 10:
          case 11:
          case 12:
            this.onToken({
              token: tokenType_default.NULL,
              value: null,
              offset: this.offset,
              partial: true
            });
            break;
          case 13: {
            const string = this.bufferedString.toString();
            this.onToken({
              token: tokenType_default.STRING,
              value: string,
              offset: this.offset,
              partial: true
            });
            break;
          }
          case 21:
          case 22:
          case 24:
          case 27:
            try {
              this.onToken({
                token: tokenType_default.NUMBER,
                value: this.parseNumber(this.bufferedNumber.toString()),
                offset: this.offset,
                partial: true
              });
            } catch (_a) {
            }
        }
      }
    } catch (err) {
      this.error(err);
    }
  }
  emitNumber() {
    this.onToken({
      token: tokenType_default.NUMBER,
      value: this.parseNumber(this.bufferedNumber.toString()),
      offset: this.offset
    });
    this.offset += this.bufferedNumber.byteLength - 1;
  }
  /**
   * Turns the characters of a JSON number into a JavaScript value.
   *
   * Equivalent to `Number(numberStr)`. Override it to handle numbers that a
   * JavaScript number can't represent, for example by keeping them as strings.
   *
   * @param numberStr The number, as it appeared in the JSON stream.
   * @returns The parsed number.
   */
  parseNumber(numberStr) {
    return Number(numberStr);
  }
  /**
   * Puts the tokenizer in an error state and reports `err` through
   * {@linkcode Tokenizer.onError}. The tokenizer can't be used afterwards.
   *
   * @param err What went wrong.
   */
  error(err) {
    if (this.state !== 1) {
      this.state = 2;
    }
    this.onError(err);
  }
  /**
   * Signals that the stream is over, flushing any number that was still being
   * tokenized and then ending the tokenizer, which can't be used afterwards.
   *
   * @throws {TokenizerError} If the stream ended in the middle of a token and no
   * {@linkcode Tokenizer.onError} callback has been set.
   */
  end() {
    switch (this.state) {
      case 21:
      case 22:
      case 24:
      case 27:
        this.state = 1;
        this.emitNumber();
        this.onEnd();
        break;
      case 29:
      case 0:
      case 2:
        this.state = 1;
        this.onEnd();
        break;
      default:
        this.error(new TokenizerError(`Tokenizer ended in the middle of a token (state: ${TokenizerStateToString(this.state)}). Either not all the data was received or the data was invalid.`));
    }
  }
  /**
   * Called with every token found in the stream. Override it to consume them;
   * by default it throws.
   *
   * @param parsedToken The token and where it was found.
   */
  // biome-ignore lint/correctness/noUnusedFunctionParameters: override point; the parameter is part of the public signature
  onToken(parsedToken) {
    throw new TokenizerError(`Can't emit tokens before the "onToken" callback has been set up.`);
  }
  /**
   * Called when the data can't be tokenized. Override it to handle errors
   * asynchronously; by default it throws, so the error surfaces out of the
   * {@linkcode Tokenizer.write} or {@linkcode Tokenizer.end} call that caused it.
   *
   * @param err What went wrong.
   */
  onError(err) {
    throw err;
  }
  /** Called once the tokenizer has ended. Override it to react to that; by default it does nothing. */
  onEnd() {
  }
};

// node_modules/@streamparser/json/dist/mjs/tokenparser.js
var TokenParserState;
(function(TokenParserState2) {
  TokenParserState2[TokenParserState2["VALUE"] = 0] = "VALUE";
  TokenParserState2[TokenParserState2["KEY"] = 1] = "KEY";
  TokenParserState2[TokenParserState2["COLON"] = 2] = "COLON";
  TokenParserState2[TokenParserState2["COMMA"] = 3] = "COMMA";
  TokenParserState2[TokenParserState2["ENDED"] = 4] = "ENDED";
  TokenParserState2[TokenParserState2["ERROR"] = 5] = "ERROR";
  TokenParserState2[TokenParserState2["SEPARATOR"] = 6] = "SEPARATOR";
})(TokenParserState || (TokenParserState = {}));
function TokenParserStateToString(state) {
  return ["VALUE", "KEY", "COLON", "COMMA", "ENDED", "ERROR", "SEPARATOR"][state];
}
function setProperty(obj, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
    return;
  }
  obj[key] = value;
}
var defaultOpts2 = {
  paths: void 0,
  keepStack: true,
  separator: void 0,
  emitPartialValues: false
};
var TokenParserError = class _TokenParserError extends Error {
  /**
   * @param message What went wrong.
   */
  constructor(message2) {
    super(message2);
    Object.setPrototypeOf(this, _TokenParserError.prototype);
  }
};
var TokenParser = class {
  /**
   * @param opts What to emit and how. See {@linkcode TokenParserOptions}.
   * @throws {TokenParserError} If any of the configured `paths` is not a valid selector.
   */
  constructor(opts) {
    this.state = 0;
    this.mode = void 0;
    this.key = void 0;
    this.value = void 0;
    this.stack = [];
    this.memberCount = 0;
    opts = Object.assign(Object.assign({}, defaultOpts2), opts);
    if (opts.paths) {
      const root = { children: /* @__PURE__ */ new Map(), terminal: false };
      let matchEverything = false;
      for (const path of opts.paths) {
        if (path === void 0 || path === "$*") {
          matchEverything = true;
          continue;
        }
        if (!path.startsWith("$"))
          throw new TokenParserError(`Invalid selector "${path}". Should start with "$".`);
        const segments = path.split(".").slice(1);
        if (segments.includes(""))
          throw new TokenParserError(`Invalid selector "${path}". ".." syntax not supported.`);
        let node = root;
        for (const segment of segments) {
          let child = node.children.get(segment);
          if (!child) {
            child = { children: /* @__PURE__ */ new Map(), terminal: false };
            node.children.set(segment, child);
          }
          node = child;
        }
        node.terminal = true;
      }
      if (!matchEverything)
        this.selectorTrie = root;
    }
    this.keepStack = opts.keepStack || false;
    this.separator = opts.separator;
    if (!opts.emitPartialValues) {
      this.emitPartial = () => {
      };
    }
  }
  shouldEmit() {
    if (!this.selectorTrie)
      return true;
    return this.matchesSelector(this.selectorTrie, 0);
  }
  // Depth-first walk of the selector trie down the current value's key path:
  //   [stack[1].key, ..., stack[n-1].key, this.key]   (n = stack.length)
  // A value matches iff some branch reaches a terminal node at the exact depth.
  // Recursion (rather than an explicit frontier) keeps the common single-path
  // walk allocation-free and short-circuits on the first match, like the old
  // rescan did, while collapsing its O(number of selectors) cost to O(depth).
  matchesSelector(node, level) {
    const keyCount = this.stack.length;
    if (level === keyCount)
      return node.terminal;
    const key = level < keyCount - 1 ? this.stack[level + 1].key : this.key;
    const wildcard = node.children.get("*");
    if (wildcard && this.matchesSelector(wildcard, level + 1))
      return true;
    const hasLiteralChild = node.children.size > (wildcard ? 1 : 0);
    if (hasLiteralChild) {
      const segment = key === null || key === void 0 ? void 0 : key.toString();
      if (segment !== void 0) {
        const child = node.children.get(segment);
        if (child && this.matchesSelector(child, level + 1))
          return true;
      }
    }
    return false;
  }
  push() {
    this.stack.push({
      key: this.key,
      value: this.value,
      mode: this.mode,
      emit: this.shouldEmit(),
      memberCount: this.memberCount
    });
  }
  pop() {
    const value = this.value;
    let emit;
    ({
      key: this.key,
      value: this.value,
      mode: this.mode,
      emit,
      memberCount: this.memberCount
    } = this.stack.pop());
    this.state = this.mode !== void 0 ? 3 : 0;
    this.emit(value, emit);
  }
  emit(value, emit) {
    if (!this.keepStack && this.value && this.stack.every((item) => !item.emit)) {
      if (Array.isArray(this.value)) {
        this.value.length -= 1;
      } else {
        delete this.value[this.key];
      }
    }
    if (emit) {
      this.onValue({
        value,
        key: this.key,
        parent: this.value,
        stack: this.stack
      });
    }
    if (this.stack.length === 0) {
      if (this.separator) {
        this.state = 6;
      } else if (this.separator === void 0) {
        this.end();
      }
    }
  }
  emitPartial(value) {
    if (!this.shouldEmit())
      return;
    if (this.state === 1) {
      this.onValue({
        value: void 0,
        key: value,
        parent: this.value,
        stack: this.stack,
        partial: true
      });
      return;
    }
    this.onValue({
      value,
      key: this.key,
      parent: this.value,
      stack: this.stack,
      partial: true
    });
  }
  /** Whether the token parser is ended, and thus no longer accepting tokens. */
  get isEnded() {
    return this.state === 4;
  }
  /**
   * Pushes the next token into the parser.
   *
   * Parsing happens synchronously, so every value that the token completes is
   * emitted through {@linkcode TokenParser.onValue} before this returns.
   *
   * @param parsedTokenInfo The token to process, as emitted by a tokenizer.
   * @throws {TokenParserError} If the token can't appear at this point of the
   * JSON document and no {@linkcode TokenParser.onError} callback has been set.
   */
  write({ token, value, partial }) {
    try {
      if (partial) {
        if (this.state !== 0 && this.state !== 1) {
          throw new TokenParserError(`Unexpected partial ${tokenType_default[token]} (${JSON.stringify(value)}) in state ${TokenParserStateToString(this.state)}`);
        }
        this.emitPartial(value);
        return;
      }
      if (this.state === 0) {
        if (token === tokenType_default.STRING || token === tokenType_default.NUMBER || token === tokenType_default.TRUE || token === tokenType_default.FALSE || token === tokenType_default.NULL) {
          if (this.mode === 0) {
            setProperty(this.value, this.key, value);
            this.state = 3;
            this.memberCount++;
          } else if (this.mode === 1) {
            this.value.push(value);
            this.state = 3;
            this.memberCount++;
          }
          this.emit(value, this.shouldEmit());
          return;
        }
        if (token === tokenType_default.LEFT_BRACE) {
          this.memberCount++;
          this.push();
          if (this.mode === 0) {
            const val = {};
            setProperty(this.value, this.key, val);
            this.value = val;
          } else if (this.mode === 1) {
            const val = {};
            this.value.push(val);
            this.value = val;
          } else {
            this.value = {};
          }
          this.mode = 0;
          this.state = 1;
          this.key = void 0;
          this.memberCount = 0;
          this.emitPartial();
          return;
        }
        if (token === tokenType_default.LEFT_BRACKET) {
          this.memberCount++;
          this.push();
          if (this.mode === 0) {
            const val = [];
            setProperty(this.value, this.key, val);
            this.value = val;
          } else if (this.mode === 1) {
            const val = [];
            this.value.push(val);
            this.value = val;
          } else {
            this.value = [];
          }
          this.mode = 1;
          this.state = 0;
          this.key = 0;
          this.memberCount = 0;
          this.emitPartial();
          return;
        }
        if (this.mode === 1 && token === tokenType_default.RIGHT_BRACKET && this.memberCount === 0) {
          this.pop();
          return;
        }
      }
      if (this.state === 1) {
        if (token === tokenType_default.STRING) {
          this.key = value;
          this.state = 2;
          this.emitPartial();
          return;
        }
        if (token === tokenType_default.RIGHT_BRACE && this.memberCount === 0) {
          this.pop();
          return;
        }
      }
      if (this.state === 2) {
        if (token === tokenType_default.COLON) {
          this.state = 0;
          return;
        }
      }
      if (this.state === 3) {
        if (token === tokenType_default.COMMA) {
          if (this.mode === 1) {
            this.state = 0;
            this.key += 1;
            return;
          }
          if (this.mode === 0) {
            this.state = 1;
            return;
          }
        }
        if (token === tokenType_default.RIGHT_BRACE && this.mode === 0 || token === tokenType_default.RIGHT_BRACKET && this.mode === 1) {
          this.pop();
          return;
        }
      }
      if (this.state === 6) {
        if (token === tokenType_default.SEPARATOR && value === this.separator) {
          this.state = 0;
          return;
        }
      }
      if (token === tokenType_default.SEPARATOR && this.state !== 6 && Array.from(value).map((n) => n.charCodeAt(0)).every(
        (n) => n === 32 || n === 10 || n === 13 || n === 9
        /* charset.TAB */
      )) {
        return;
      }
      throw new TokenParserError(`Unexpected ${tokenType_default[token]} (${JSON.stringify(value)}) in state ${TokenParserStateToString(this.state)}`);
    } catch (err) {
      this.error(err);
    }
  }
  /**
   * Puts the token parser in an error state and reports `err` through
   * {@linkcode TokenParser.onError}. The parser can't be used afterwards.
   *
   * @param err What went wrong.
   */
  error(err) {
    if (this.state !== 4) {
      this.state = 5;
    }
    this.onError(err);
  }
  /**
   * Signals that there are no more tokens, ending the token parser, which can't
   * be used afterwards.
   *
   * @throws {Error} If the JSON document was left half-parsed and no
   * {@linkcode TokenParser.onError} callback has been set.
   */
  end() {
    if (this.state !== 0 && this.state !== 6 || this.stack.length > 0) {
      this.error(new Error(`Parser ended in mid-parsing (state: ${TokenParserStateToString(this.state)}). Either not all the data was received or the data was invalid.`));
    } else {
      this.state = 4;
      this.onEnd();
    }
  }
  /**
   * Called with every value that matches the configured `paths`. Override it to
   * consume them; by default it throws.
   *
   * @param parsedElementInfo The value and where it was found. Its `parent` and
   * `stack` are live references into the parser's in-progress structures, so use
   * `cloneParsedElementInfo` to snapshot them if they need to outlive the call.
   */
  // biome-ignore lint/correctness/noUnusedFunctionParameters: override point; the parameter is part of the public signature
  onValue(parsedElementInfo) {
    throw new TokenParserError(`Can't emit data before the "onValue" callback has been set up.`);
  }
  /**
   * Called when the tokens don't add up to valid JSON. Override it to handle
   * errors asynchronously; by default it throws, so the error surfaces out of the
   * {@linkcode TokenParser.write} or {@linkcode TokenParser.end} call that caused it.
   *
   * @param err What went wrong.
   */
  onError(err) {
    throw err;
  }
  /** Called once the token parser has ended. Override it to react to that; by default it does nothing. */
  onEnd() {
  }
};

// node_modules/@streamparser/json/dist/mjs/jsonparser.js
var JSONParser = class {
  /**
   * @param opts How to tokenize and what to emit. See {@linkcode JSONParserOptions}.
   */
  constructor(opts = {}) {
    this.tokenizer = new Tokenizer(opts);
    this.tokenParser = new TokenParser(opts);
    this.tokenizer.onToken = this.tokenParser.write.bind(this.tokenParser);
    this.tokenizer.onEnd = () => {
      if (!this.tokenParser.isEnded)
        this.tokenParser.end();
    };
    this.tokenParser.onError = this.tokenizer.error.bind(this.tokenizer);
    this.tokenParser.onEnd = () => {
      if (!this.tokenizer.isEnded)
        this.tokenizer.end();
    };
  }
  /** Whether the parser is ended, and thus no longer accepting data. */
  get isEnded() {
    return this.tokenizer.isEnded && this.tokenParser.isEnded;
  }
  /**
   * Pushes the next chunk of the JSON stream into the parser.
   *
   * Parsing happens synchronously, so every value that the chunk completes is
   * emitted through {@linkcode JSONParser.onValue} before this returns.
   *
   * @param input The chunk to parse: a string, a `TypedArray`, or any iterable
   * of utf-8 byte values.
   * @throws {Error} If the data is not valid JSON and no
   * {@linkcode JSONParser.onError} callback has been set.
   */
  write(input2) {
    this.tokenizer.write(input2);
  }
  /**
   * Signals that the stream is over, ending the parser, which can't be used
   * afterwards.
   *
   * @throws {Error} If the JSON document was left half-parsed and no
   * {@linkcode JSONParser.onError} callback has been set.
   */
  end() {
    this.tokenizer.end();
  }
  /** Sets the callback to be called with every token found in the stream. */
  set onToken(cb) {
    this.tokenizer.onToken = (parsedToken) => {
      cb(parsedToken);
      this.tokenParser.write(parsedToken);
    };
  }
  /** Sets the callback to be called with every value that matches the configured `paths`. */
  set onValue(cb) {
    this.tokenParser.onValue = cb;
  }
  /**
   * Sets the callback to be called when the data can't be parsed. Without one,
   * errors are thrown out of the {@linkcode JSONParser.write} or
   * {@linkcode JSONParser.end} call that caused them.
   */
  set onError(cb) {
    this.tokenizer.onError = cb;
  }
  /** Sets the callback to be called once the parser has ended. */
  set onEnd(cb) {
    this.tokenParser.onEnd = () => {
      if (!this.tokenizer.isEnded)
        this.tokenizer.end();
      cb.call(this.tokenParser);
    };
  }
};

// node_modules/@streamparser/json/dist/mjs/utils/types/stackElement.js
var TokenParserMode;
(function(TokenParserMode2) {
  TokenParserMode2[TokenParserMode2["OBJECT"] = 0] = "OBJECT";
  TokenParserMode2[TokenParserMode2["ARRAY"] = 1] = "ARRAY";
})(TokenParserMode || (TokenParserMode = {}));

// apps/server/src/plugins/builtin/discord/export.ts
import { dirname as dirname3, relative, resolve, isAbsolute } from "node:path";
var object2 = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a Discord export object.");
  return value;
};
var known = ["guild", "channel", "dateRange", "exportedAt", "messageCount"];
function line(id2, value, author, occurredAt) {
  const text2 = JSON.stringify(value);
  if (text2.length > 4e6) throw new Error("A Discord record exceeds the source size limit.");
  return Buffer.from(JSON.stringify({ id: id2, text: text2, ...author ? { author } : {}, ...occurredAt ? { occurredAt } : {} }) + "\n");
}
async function* normalize(input2, files, sourcePath, original, signal, retain, finish) {
  const parser = new JSONParser({ paths: ["$.messages.*", ...known.map((key) => `$.${key}`)], keepStack: false });
  const metadata = {}, keys = /* @__PURE__ */ new Set(), ids = /* @__PURE__ */ new Set();
  const pending = [];
  const decoder = new TextDecoder("utf8", { fatal: true, ignoreBOM: true });
  let depth = 0, keyExpected = false, valueExpected = false, rootKey = "", hasMessages = false, total = 0, lastValue = 0;
  let messages = 0, attachments = 0, retained = 0, missing = 0, remote = 0;
  const retainedFiles = /* @__PURE__ */ new Map();
  parser.onToken = ({ token, value }) => {
    if (depth === 0 && !keys.size && token !== tokenType_default.LEFT_BRACE && total <= 32768) throw new Error("Expected one Discord export object.");
    if (depth === 1 && keyExpected && token === tokenType_default.STRING) {
      rootKey = String(value);
      keyExpected = false;
      if (keys.has(rootKey) || keys.size >= 1e3) throw new Error("Duplicate or excessive export metadata fields.");
      keys.add(rootKey);
    } else if (depth === 1 && token === tokenType_default.COLON) valueExpected = true;
    else if (depth === 1 && valueExpected) {
      valueExpected = false;
      if (rootKey === "messages") {
        if (token !== tokenType_default.LEFT_BRACKET) throw new Error("Discord messages must be an array.");
        hasMessages = true;
      }
    }
    if (token === tokenType_default.LEFT_BRACE || token === tokenType_default.LEFT_BRACKET) {
      depth++;
      if (depth > 128) throw new Error("The export nesting is too deep.");
      if (depth === 1) keyExpected = true;
    }
    if (token === tokenType_default.RIGHT_BRACE || token === tokenType_default.RIGHT_BRACKET) depth--;
    if (depth === 1 && token === tokenType_default.COMMA) keyExpected = true;
    if (token === tokenType_default.NUMBER && typeof value === "number" && (!Number.isFinite(value) || Number.isInteger(value) && !Number.isSafeInteger(value))) throw new Error("The export contains a number that cannot be retained exactly.");
  };
  parser.onValue = ({ key, value, stack }) => {
    lastValue = total;
    if (stack.length === 2 && stack[1]?.key === "messages" && typeof key === "number") pending.push(object2(value));
    else if (stack.length === 1 && typeof key === "string") metadata[key] = value;
  };
  const buffer = Buffer.alloc(32768);
  while (true) {
    signal.throwIfAborted();
    const { bytesRead } = await input2.read(buffer, 0, buffer.length, total);
    if (!bytesRead) break;
    total += bytesRead;
    if (total - lastValue > 24e6) throw new Error("A Discord record exceeds the parser size limit.");
    decoder.decode(buffer.subarray(0, bytesRead), { stream: true });
    parser.write(buffer.subarray(0, bytesRead));
    while (pending.length) {
      const message2 = pending.shift();
      if (typeof message2.id !== "string" || !/^\d+$/.test(message2.id) || ids.has(message2.id) || typeof message2.content !== "string" || typeof message2.timestamp !== "string" || !Number.isFinite(Date.parse(message2.timestamp))) throw new Error("Invalid or duplicate Discord message identity, content or timestamp.");
      ids.add(message2.id);
      messages++;
      const author = object2(message2.author);
      yield line(message2.id, { format: "discord-export-message-v1", message: message2 }, typeof author.name === "string" ? author.name : void 0, message2.timestamp);
      const forwarded = message2.forwardedMessage ? object2(message2.forwardedMessage) : void 0;
      for (const [isForwarded, owner] of [[false, message2], [true, forwarded]]) {
        if (!owner) continue;
        const values = owner.attachments ?? [];
        if (!Array.isArray(values)) throw new Error("Invalid Discord attachment list.");
        for (const [index, raw] of values.entries()) {
          const attachment = object2(raw);
          if (typeof attachment.url !== "string" || typeof attachment.fileName !== "string") throw new Error("Invalid Discord attachment reference.");
          let availability = "missing", path;
          if (/^https?:\/\//i.test(attachment.url)) {
            availability = "remote";
            remote++;
          } else {
            try {
              path = relative(files.root, resolve(dirname3(sourcePath), attachment.url));
              if (await files.isFile(path)) availability = "local";
            } catch {
              path = void 0;
            }
            if (availability !== "local") missing++;
          }
          attachments++;
          let asset;
          if (availability === "local" && path) {
            asset = retainedFiles.get(path.toLowerCase());
            if (!asset) {
              asset = await retain(path);
              retainedFiles.set(path.toLowerCase(), asset);
            }
            retained++;
          }
          yield line(`attachment/${message2.id}/${isForwarded ? "forwarded" : "own"}/${index}`, {
            format: "discord-attachment-reference-v1",
            messageId: message2.id,
            forwarded: isForwarded,
            attachment,
            availability,
            ...availability === "local" ? { workspacePath: path } : {},
            retainedBytes: !!asset,
            ...asset ? { asset, extraction: "pending" } : { extraction: "unavailable" }
          });
        }
      }
    }
  }
  decoder.decode();
  if (!parser.isEnded) parser.end();
  if (!hasMessages || metadata.messageCount !== messages) throw new Error("Discord export is incomplete or its message count does not match.");
  const channel2 = object2(metadata.channel);
  if (typeof channel2.id !== "string" || !/^\d+$/.test(channel2.id)) throw new Error("The export has no valid channel identity.");
  const summary = { messages, attachments, retained, missing, remote, namespace: `discord/channel/${channel2.id}` };
  yield line("export-metadata", {
    format: "discord-export-metadata-v1",
    original,
    ...metadata,
    ...summary,
    unknownRootFields: [...keys].filter((key) => key !== "messages" && !known.includes(key)),
    uncertainty: "Exporter-produced content may contain formatted mentions or synthesized system messages. Forwarded authorship is not established by the outer author. Only attachments with retainedBytes=true have retained bytes; retention does not imply extraction or interpretation. Unknown root fields remain in the original export."
  });
  finish(summary);
}
async function prepareBrokeredDiscordExport(args, context) {
  const call = (action, input3) => context.broker("import.retain", { action, ...input3 });
  const root = resolve("/ada-plugin-workspace");
  const files = {
    root,
    async path(path) {
      if (typeof path !== "string" || isAbsolute(path) || path.includes(":") || path.includes("\0")) throw new Error("Use a relative workspace path.");
      const target = resolve(root, path), local = relative(root, target);
      if (!local || local.startsWith("..") || isAbsolute(local)) throw new Error("The path leaves this task workspace.");
      return target;
    },
    async isFile(path) {
      return (await call("stat", { path })).file;
    }
  };
  if ((await files.path(args.path)).toLowerCase() === (await files.path(args.output)).toLowerCase()) throw new Error("Use a new output path.");
  const original = await call("asset-retain", { path: args.path, purpose: "Original Discord export." });
  const input2 = { async read(buffer, offset, length, position) {
    const value = await call("asset-read", { hash: original.hash, bytes: original.bytes, offset: position, length: Math.min(length, 32768) });
    const chunk = Buffer.from(value.base64, "base64");
    chunk.copy(buffer, offset);
    return { bytesRead: chunk.length };
  } };
  let summary;
  const stream = await call("file-begin", { path: args.output });
  try {
    for await (const chunk of normalize(
      input2,
      files,
      await files.path(args.path),
      original,
      context.signal,
      async (path) => await call("asset-retain", { path, purpose: "Original Discord attachment." }),
      (value) => {
        summary = value;
      }
    )) {
      for (let offset = 0; offset < chunk.length; offset += 32768) await call("file-write", { id: stream.id, base64: chunk.subarray(offset, offset + 32768).toString("base64") });
    }
    const output = await call("file-finish", { id: stream.id });
    return { output, original, ...summary, next: "Import the generated JSONL with import_sources and the returned namespace. Local attachments have retained asset identities in their records and await extraction or image inspection. Missing and remote references require follow-up; they were not downloaded or read." };
  } catch (error) {
    await call("file-abort", { id: stream.id }).catch(() => void 0);
    throw error;
  } finally {
    await call("asset-close", { hash: original.hash }).catch(() => void 0);
  }
}

// apps/server/src/plugins/builtin/discord/module.ts
var services = new InvocationServices();
var connection = new DiscordConnection("", { fetcher: services.fetch, storage: services.credentials() });
var run = (operation) => async (input2, context) => services.run(context, async () => {
  try {
    context.signal.throwIfAborted();
    return success(await operation(input2, context));
  } catch (error) {
    return failure(error, context.signal);
  }
});
var imports = { knowledge: async (method, ...args) => {
  if (method === "sourceIdentity") return services.broker("import.retain", { action: "source-identity", namespace: args[0], id: args[1] });
  if (method === "capture") return services.broker("import.retain", { action: "source-capture", value: args[0] });
  throw new Error("Unsupported external evidence import.");
} };
var module_default = {
  deactivate() {
    connection.close();
  },
  handlers: {
    state: run(async () => connection.state()),
    connect: run(async (input2, context) => connection.connect(input2.token, context.signal)),
    disconnect: run(async () => connection.disconnect()),
    discord_read: run(async (input2, context) => connection.execute(input2, context.signal)),
    capture_discord_messages: run(async (input2, context) => connection.capture(input2, imports, context.signal, async () => !context.signal.aborted)),
    prepare_discord_import_prepare: async (input2, context) => services.run(context, async () => {
      const args = input2;
      return { resources: [await context.broker("import.retain", { action: "resource", path: "", mode: "read" }), await context.broker("import.retain", { action: "resource", path: args.output, mode: "write" })] };
    }),
    prepare_discord_import: run(async (input2, context) => prepareBrokeredDiscordExport(input2, context)),
    recover_read: async () => ({ outcome: "failed", released: true, value: { error: "The Discord read was interrupted. Read again if needed. No request was replayed." } }),
    recover_import: async () => ({ outcome: "failed", released: true, value: { error: "The import was interrupted. Previously retained originals remain available. Inspect the destination before repeating it. No import was replayed.", effectMayHaveOccurred: true, requiresInspection: true } })
  }
};
export {
  module_default as default
};
