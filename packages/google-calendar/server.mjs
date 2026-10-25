// apps/server/src/plugins/builtin/google-calendar/client.ts
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { join as join2 } from "node:path";

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
  return new Promise((resolve, reject) => {
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
      else resolve(Buffer.from(result, "base64"));
    });
    child.stdin.on("error", () => {
    });
    child.stdin.end(input(operation, value));
  });
}

// apps/server/src/models/json.ts
var ModelError = class extends Error {
  constructor(code, message, retryable = false, retryAfterMs) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
  code;
  retryable;
  retryAfterMs;
};

// apps/server/src/models/credentials.ts
async function protect2(operation, value) {
  try {
    return await protect(operation, value);
  } catch {
    throw new ModelError("credentials_unavailable", "Windows could not protect or open the credential.");
  }
}

// apps/server/src/plugins/builtin/google-calendar/write.ts
var date = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
var time = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && date(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24 && Number.isFinite(Date.parse(value));
function text(value, label, max, empty = false) {
  if (typeof value !== "string" || !empty && !value.trim() || value.length > max) throw new Error(`Invalid ${label}.`);
  return value;
}
function googleWritePlan(kind, args) {
  const event = kind === "event";
  const allowed = /* @__PURE__ */ new Set(["action", "itemId", "etag", ...event ? ["calendarId", "summary", "description", "location", "start", "end", "timeZone"] : ["taskListId", "title", "notes", "dueDate", "completed"]]);
  if (Object.keys(args).some((key) => !allowed.has(key)) || !["create", "update", "delete"].includes(String(args.action))) throw new Error("Invalid Google write action or fields.");
  const creating = args.action === "create", deleting = args.action === "delete";
  const container = text(event ? args.calendarId : args.taskListId, event ? "calendar ID" : "task list ID", 1e3);
  const id = creating ? void 0 : text(args.itemId, "item ID from the last read", 1e3);
  if ([container, id].some((value) => value === "." || value === "..")) throw new Error("Invalid Google item identity. Use the exact ID from a read.");
  const etag = creating ? void 0 : text(args.etag, "ETag from the last read", 1e3);
  if (etag && /[\r\n]/.test(etag)) throw new Error("Invalid ETag.");
  if (creating && (args.itemId !== void 0 || args.etag !== void 0)) throw new Error("Create does not accept an existing item identity.");
  const url = new URL(event ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(container)}/events` : `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(container)}/tasks`);
  if (id) url.pathname += "/" + encodeURIComponent(id);
  if (event) url.searchParams.set("sendUpdates", "none");
  const body = {};
  for (const [field, max] of event ? [["summary", 1e3], ["description", 8e3], ["location", 1e3]] : [["title", 1024], ["notes", 8192]]) {
    if (args[field] !== void 0) body[field] = text(args[field], field, max, field !== "summary" && field !== "title");
  }
  if (event && (creating || args.start !== void 0 || args.end !== void 0 || args.timeZone !== void 0)) {
    const allDay = date(args.start) && date(args.end);
    if (!allDay && (!time(args.start) || !time(args.end))) throw new Error("Provide both start and end as RFC3339 timestamps, or YYYY-MM-DD all-day dates.");
    if (Date.parse(String(args.end)) <= Date.parse(String(args.start))) throw new Error("Event end must follow its start. All-day end dates are exclusive.");
    if (allDay) {
      if (args.timeZone !== void 0) throw new Error("All-day dates do not accept a timezone.");
      body.start = { date: args.start };
      body.end = { date: args.end };
    } else {
      const zone = text(args.timeZone, "IANA timezone", 100);
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
      } catch {
        throw new Error("Use a valid IANA timezone.");
      }
      body.start = { dateTime: args.start, timeZone: zone };
      body.end = { dateTime: args.end, timeZone: zone };
    }
  }
  if (!event && args.dueDate !== void 0) {
    if (args.dueDate !== null && !date(args.dueDate)) throw new Error("Tasks accept a scheduled YYYY-MM-DD date, without a time. Use a Calendar event for timed work.");
    body.due = args.dueDate === null ? null : `${args.dueDate}T00:00:00.000Z`;
  }
  if (!event && args.completed !== void 0) {
    if (typeof args.completed !== "boolean") throw new Error("Completed must be true or false.");
    body.status = args.completed ? "completed" : "needsAction";
    if (!args.completed) body.completed = null;
  }
  if (creating && !body[event ? "summary" : "title"]) throw new Error(event ? "An event needs a summary." : "A task needs a title.");
  if (!creating && !deleting && !Object.keys(body).length) throw new Error("Choose at least one field to update.");
  if (deleting && Object.keys(body).length) throw new Error("Delete accepts only the container, item identity and ETag.");
  return { service: event ? "calendar" : "tasks", url, method: creating ? "POST" : deleting ? "DELETE" : "PATCH", ...deleting ? {} : { body }, ...etag ? { etag } : {} };
}
function googleWriteMatches(actual, expected, field = "") {
  if (expected === null) return actual == null;
  if (expected === "" && ["description", "location", "notes"].includes(field)) return actual == null || actual === "";
  if (field === "dateTime" && typeof actual === "string" && typeof expected === "string") return Date.parse(actual) === Date.parse(expected);
  if (field === "due" && typeof actual === "string" && typeof expected === "string") return actual.slice(0, 10) === expected.slice(0, 10);
  if (expected && typeof expected === "object") return Boolean(actual && typeof actual === "object" && Object.entries(expected).every(([key, value]) => googleWriteMatches(actual[key], value, key)));
  return actual === expected;
}

// apps/server/src/plugins/builtin/google-calendar/client.ts
var calendarScopes = ["https://www.googleapis.com/auth/calendar.calendarlist.readonly", "https://www.googleapis.com/auth/calendar.events.readonly"];
var tasksReadScope = "https://www.googleapis.com/auth/tasks.readonly";
var googleReadScopes = [...calendarScopes, tasksReadScope];
var calendarWriteScope = "https://www.googleapis.com/auth/calendar.events";
var tasksWriteScope = "https://www.googleapis.com/auth/tasks";
var googleWriteScopes = [calendarScopes[0], calendarWriteScope, tasksWriteScope];
var allowedScopes = [...googleReadScopes, ...googleWriteScopes];
var timestamp = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
var CalendarError = class extends Error {
  constructor(message, code = "calendar_unavailable", retryable = false, setupUrl) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.setupUrl = setupUrl;
  }
  code;
  retryable;
  setupUrl;
};
var GoogleWriteUncertain = class extends CalendarError {
  constructor() {
    super("Google may have applied this change, but its result could not be verified. Read the destination before retrying to avoid duplicates.", "write_uncertain");
  }
};
var GoogleCalendar = class {
  constructor(directory, fetcher = fetch, storage, deferredAuthorization = false) {
    this.directory = directory;
    this.fetcher = fetcher;
    this.storage = storage;
    this.deferredAuthorization = deferredAuthorization;
  }
  directory;
  fetcher;
  storage;
  deferredAuthorization;
  saved = { clientId: "", clientSecret: "" };
  loaded = false;
  loading;
  exchanging = false;
  generation = 0;
  writes = Promise.resolve();
  listener;
  timer;
  error;
  access = "unverified";
  checkedAt;
  setupUrl;
  pendingAuthorization;
  tasks = { access: "unverified" };
  async load() {
    if (this.loaded) return;
    if (!this.loading) this.loading = (async () => {
      try {
        this.saved = this.storage ? await this.storage.read() ?? this.saved : JSON.parse((await protect2("unprotect", await readFile(join2(this.directory, "google-calendar.dpapi")))).toString());
      } catch (error) {
        if (error.code !== "ENOENT") throw new CalendarError("Could not open protected Google Calendar credentials.");
      }
      this.loaded = true;
    })().finally(() => {
      this.loading = void 0;
    });
    await this.loading;
  }
  async save(generation) {
    const value = JSON.stringify(this.saved);
    const work = this.writes.then(async () => {
      if (this.storage) {
        if (generation === this.generation) await this.storage.write(JSON.parse(value));
        return;
      }
      const encrypted = await protect2("protect", Buffer.from(value));
      if (generation !== this.generation) return;
      const path = join2(this.directory, "google-calendar.dpapi");
      await writeFile(path + ".next", encrypted, { mode: 384 });
      await rename(path + ".next", path);
    });
    this.writes = work.catch(() => void 0);
    await work;
  }
  async state() {
    try {
      await this.load();
      return {
        configured: Boolean(this.saved.clientId),
        connected: Boolean(this.saved.refresh),
        authorizing: Boolean(this.listener) || this.exchanging,
        ...this.apiUrl("calendar") ? { apiSetup: { calendar: this.apiUrl("calendar"), tasks: this.apiUrl("tasks") } } : {},
        ...this.saved.refresh ? { permissions: { calendar: this.saved.scopes?.includes(calendarWriteScope) ? "read-write" : "read-only", tasks: this.saved.scopes?.includes(tasksWriteScope) ? "read-write" : "read-only" }, access: this.access, tasks: this.saved.scopes?.some((scope) => [tasksReadScope, tasksWriteScope].includes(scope)) ? { ...this.tasks } : { access: "permission-needed" }, ...this.checkedAt ? { checkedAt: this.checkedAt } : {}, ...this.setupUrl ? { setupUrl: this.setupUrl } : {} } : {},
        ...this.error ? { error: this.error } : {}
      };
    } catch {
      return { configured: false, connected: false, authorizing: false, error: "Protected Google Calendar credentials are unavailable." };
    }
  }
  stop() {
    clearTimeout(this.timer);
    this.listener?.close();
    this.listener = void 0;
    this.exchanging = false;
    this.pendingAuthorization = void 0;
  }
  close() {
    this.stop();
    ++this.generation;
  }
  hasPendingAuthorization() {
    return Boolean(this.pendingAuthorization);
  }
  async completeAuthorization() {
    const pending = this.pendingAuthorization;
    if (!pending) return this.state();
    this.pendingAuthorization = void 0;
    try {
      await this.exchange(pending.body, pending.generation, true, pending.access);
    } catch {
      if (pending.generation === this.generation) this.error = "Google authorization failed. Check the OAuth client and try again.";
    } finally {
      if (pending.generation === this.generation) this.exchanging = false;
    }
    return this.state();
  }
  resetAccess() {
    this.access = "unverified";
    this.checkedAt = void 0;
    this.setupUrl = void 0;
    this.tasks = { access: "unverified" };
  }
  apiUrl(service) {
    const project = this.saved.clientId.match(/^(\d+)-/)?.[1];
    return project ? `https://console.cloud.google.com/apis/api/${service === "calendar" ? "calendar-json.googleapis.com" : "tasks.googleapis.com"}/overview?project=${project}` : void 0;
  }
  async configure(clientId, clientSecret) {
    if (typeof clientId !== "string" || !/^[a-zA-Z0-9._-]{10,250}\.apps\.googleusercontent\.com$/.test(clientId) || typeof clientSecret !== "string" || !clientSecret || clientSecret.length > 500 || /\s/.test(clientSecret)) throw new CalendarError("Enter the client ID and secret from a Google Desktop app OAuth client.");
    await this.load();
    this.stop();
    const g = ++this.generation;
    this.saved = { clientId, clientSecret };
    this.error = void 0;
    this.resetAccess();
    await this.save(g);
    return this.state();
  }
  async disconnect() {
    try {
      await this.load();
    } catch {
      this.loaded = true;
    }
    this.stop();
    const g = ++this.generation;
    const token = this.saved.refresh;
    this.saved = { clientId: "", clientSecret: "" };
    this.error = void 0;
    this.resetAccess();
    await this.writes;
    if (g === this.generation) {
      if (this.storage) await this.storage.disconnect();
      else await rm(join2(this.directory, "google-calendar.dpapi"), { force: true });
    }
    let revoked = true;
    if (token) {
      try {
        const response = await this.fetcher("https://oauth2.googleapis.com/revoke", { method: "POST", body: new URLSearchParams({ token }), redirect: "error", signal: AbortSignal.timeout(1e4) });
        revoked = response.ok;
      } catch {
        revoked = false;
      }
    }
    if (!revoked && g === this.generation) this.error = "Disconnected locally. Google revocation failed. Remove Ada access in your Google Account permissions.";
    return this.state();
  }
  async authorize(access = "read-only") {
    if (access !== "read-only" && access !== "read-write") throw new CalendarError("Choose read-only or read-write Google access.");
    await this.load();
    if (!this.saved.clientId) throw new CalendarError("Configure a Google Desktop app OAuth client first.");
    this.stop();
    this.error = void 0;
    this.resetAccess();
    const g = ++this.generation;
    const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
    let redirect = "";
    const server = createServer((request, response) => {
      const url2 = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.headers.host !== new URL(redirect).host || request.method !== "GET" || url2.pathname !== "/oauth/callback" || url2.searchParams.get("state") !== state || url2.searchParams.getAll("state").length !== 1) {
        response.writeHead(400);
        response.end("Invalid authorization callback.");
        return;
      }
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      this.stop();
      const code = url2.searchParams.get("code");
      if (url2.searchParams.has("error") || !code || url2.searchParams.getAll("code").length !== 1 || code.length > 4096) {
        this.error = "Google authorization was cancelled or denied.";
        response.end("Google Calendar was not connected. Return to Ada.");
        return;
      }
      this.exchanging = true;
      if (this.deferredAuthorization) {
        this.pendingAuthorization = { body: new URLSearchParams({ code, client_id: this.saved.clientId, client_secret: this.saved.clientSecret, redirect_uri: redirect, grant_type: "authorization_code", code_verifier: verifier }), generation: g, access };
        response.end("Google authorization received. Return to Ada to finish connecting.");
        return;
      }
      void this.exchange(new URLSearchParams({ code, client_id: this.saved.clientId, client_secret: this.saved.clientSecret, redirect_uri: redirect, grant_type: "authorization_code", code_verifier: verifier }), g, true, access).then(() => {
        response.end(g === this.generation ? "Google connected. Return to Ada to check granted access." : "Authorization cancelled.");
      }).catch(() => {
        if (g === this.generation) this.error = "Google authorization failed. Check the OAuth client and try again.";
        response.end("Google was not connected. Return to Ada.");
      }).finally(() => {
        if (g === this.generation) this.exchanging = false;
      });
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    this.listener = server;
    const address = server.address();
    if (!address || typeof address === "string") throw new CalendarError("Could not start Google authorization.");
    redirect = `http://127.0.0.1:${address.port}/oauth/callback`;
    this.timer = setTimeout(() => {
      if (g === this.generation) {
        this.stop();
        this.error = "Google authorization expired. Connect again.";
        ++this.generation;
      }
    }, 3e5);
    this.timer.unref();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: this.saved.clientId, redirect_uri: redirect, response_type: "code", scope: (access === "read-write" ? googleWriteScopes : googleReadScopes).join(" "), state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", access_type: "offline", prompt: "consent", include_granted_scopes: "false" }).toString();
    return { url: url.toString() };
  }
  async exchange(body, g, initial = false, requested = "read-only") {
    const response = await this.fetcher("https://oauth2.googleapis.com/token", { method: "POST", body, redirect: "error", signal: AbortSignal.timeout(15e3) });
    if (!response.ok) {
      if (!initial && (response.status === 400 || response.status === 401) && g === this.generation) {
        this.saved = { clientId: this.saved.clientId, clientSecret: this.saved.clientSecret };
        this.error = "Google access expired or was revoked. Reconnect in Settings.";
        await this.save(g);
      }
      throw new CalendarError("Google rejected the calendar authorization. Reconnect in Settings.");
    }
    const data = await this.json(response);
    const scopes = typeof data.scope === "string" ? data.scope.split(" ") : [];
    if (initial && (!scopes.includes(calendarScopes[0]) || !scopes.some((s) => [calendarScopes[1], calendarWriteScope].includes(s)) || requested === "read-only" && scopes.some((s) => [calendarWriteScope, tasksWriteScope].includes(s))) || scopes.some((s) => !allowedScopes.includes(s)) || data.token_type?.toLowerCase() !== "bearer" || typeof data.access_token !== "string" || !data.access_token || data.access_token.length > 1e4 || initial && (typeof data.refresh_token !== "string" || !data.refresh_token || data.refresh_token.length > 1e4)) throw new CalendarError("Google did not grant the required permissions.");
    if (g !== this.generation) throw new CalendarError("Calendar connection changed.");
    this.saved = { ...this.saved, ...typeof data.scope === "string" ? { scopes } : {}, access: data.access_token, refresh: typeof data.refresh_token === "string" ? data.refresh_token : this.saved.refresh, expires: Date.now() + Math.min(Number(data.expires_in) || 3600, 3600) * 1e3 };
    await this.save(g);
  }
  async json(response) {
    const reader = response.body?.getReader();
    if (!reader) throw new CalendarError("Google returned an empty response.");
    let bytes = 0;
    const chunks = [];
    try {
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 2e6) throw new CalendarError("Google response exceeded the size limit.");
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      await reader.cancel().catch(() => void 0);
      throw new CalendarError("Google returned an invalid calendar response.");
    }
  }
  async readError(response, service, operation = "read") {
    const label = service === "calendar" ? "Google Calendar" : "Google Tasks";
    const data = await this.json(response).catch(() => ({}));
    const reasons = new Set([
      ...Array.isArray(data?.error?.errors) ? data.error.errors : [],
      ...Array.isArray(data?.error?.details) ? data.error.details : []
    ].map((item) => item?.reason));
    if (reasons.has("accessNotConfigured") || reasons.has("SERVICE_DISABLED")) {
      return new CalendarError(
        `Google ${service === "calendar" ? "Calendar" : "Tasks"} API is disabled for this OAuth client's project. Enable it in Google Cloud, then choose Check access.`,
        "api_disabled",
        false,
        this.apiUrl(service)
      );
    }
    if (response.status === 401) return new CalendarError(`${label} access expired. Reconnect in Settings.`, "authorization_expired");
    if (reasons.has("insufficientPermissions") || reasons.has("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) return new CalendarError(`Google did not grant the required ${operation === "read" ? "read-only" : "write"} permissions for ${service === "calendar" ? "Calendar" : "Tasks"}. Reconnect with Google in Settings.`, "permissions");
    if (response.status === 429 || ["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"].some((reason) => reasons.has(reason))) return new CalendarError(`${label} rate limit reached. Try later.`, "rate_limit", true);
    if (response.status === 404) return new CalendarError(`This ${service === "calendar" ? "calendar" : "task list"} was not found or is not shared with the connected Google account.`, "not_found");
    if (response.status === 403) return new CalendarError(`The connected Google account cannot ${operation === "read" ? "read" : "change"} this ${service === "calendar" ? "calendar" : "task list"}. Check its permissions.`, "forbidden");
    if (response.status === 400) return new CalendarError(operation === "read" ? "Google rejected the requested read filters. Check the date range and list identity." : "Google rejected this change. Check its fields and whether this item supports editing.", "invalid_request");
    return new CalendarError(`${label} is temporarily unavailable. Try again later.`, "calendar_unavailable", response.status >= 500);
  }
  async check() {
    await this.load();
    if (!this.saved.refresh) throw new CalendarError("Connect Google Calendar in Settings first.");
    try {
      await this.read("calendars", { count: 1 }, AbortSignal.timeout(3e4));
    } catch {
    }
    try {
      await this.read("task-lists", { count: 1 }, AbortSignal.timeout(3e4));
    } catch {
    }
    return this.state();
  }
  async write(kind, args, signal, authorize) {
    const plan = googleWritePlan(kind, args);
    await this.load();
    const g = this.generation;
    const scope = kind === "event" ? calendarWriteScope : tasksWriteScope;
    if (!this.saved.refresh || !this.saved.scopes?.includes(scope)) throw new CalendarError("Write access has not been granted for this Google service. Choose Allow changes in Google Settings and authorize with Google.", "write_permission_required");
    signal.throwIfAborted();
    if (!this.saved.access || (this.saved.expires ?? 0) < Date.now() + 6e4) await this.exchange(new URLSearchParams({ client_id: this.saved.clientId, client_secret: this.saved.clientSecret, refresh_token: this.saved.refresh, grant_type: "refresh_token" }), g);
    const active = async () => {
      signal.throwIfAborted();
      if (g !== this.generation || !await authorize() || g !== this.generation) throw new CalendarError("Google change cancelled before dispatch.", "cancelled");
      signal.throwIfAborted();
    };
    await active();
    const headers = { Authorization: `Bearer ${this.saved.access}`, "Content-Type": "application/json", ...plan.etag ? { "If-Match": plan.etag } : {} };
    if (plan.etag) {
      const currentUrl = new URL(plan.url);
      currentUrl.search = "";
      const current = await this.fetcher(currentUrl, { method: "GET", headers: { Authorization: headers.Authorization }, redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(2e4)]) });
      if (!current.ok) throw await this.readError(current, plan.service);
      const existing = await this.json(current);
      if (existing.etag !== plan.etag || existing.id !== args.itemId) throw new CalendarError("This Google item changed since the last read. Read it again before editing.", "write_conflict");
    }
    await active();
    let response;
    try {
      response = await this.fetcher(plan.url, { method: plan.method, headers, ...plan.body ? { body: JSON.stringify(plan.body) } : {}, redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(2e4)]) });
    } catch {
      throw new GoogleWriteUncertain();
    }
    if (response.status === 412 || response.status === 409) {
      await response.body?.cancel();
      throw new CalendarError("This Google item changed or conflicts with another entry. Read it again before retrying.", "write_conflict");
    }
    if (response.status >= 500) {
      await response.body?.cancel();
      throw new GoogleWriteUncertain();
    }
    if (!response.ok) throw await this.readError(response, plan.service, "write");
    try {
      const changed = plan.method === "DELETE" ? { id: args.itemId } : await this.json(response);
      if (typeof changed?.id !== "string" || !changed.id || plan.method !== "POST" && changed.id !== args.itemId) throw new GoogleWriteUncertain();
      const verifyUrl = new URL(plan.url);
      verifyUrl.search = "";
      if (plan.method === "POST") verifyUrl.pathname += "/" + encodeURIComponent(changed.id);
      const verify = await this.fetcher(verifyUrl, { method: "GET", headers: { Authorization: headers.Authorization }, redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(2e4)]) });
      if (g !== this.generation) throw new GoogleWriteUncertain();
      if (plan.method === "DELETE") {
        if (verify.ok) {
          const item2 = await this.json(verify);
          if (item2.id !== changed.id || !(kind === "task" ? item2.deleted === true : item2.status === "cancelled")) throw new GoogleWriteUncertain();
        } else if (verify.status !== 404 && verify.status !== 410) {
          await verify.body?.cancel();
          throw new GoogleWriteUncertain();
        } else await verify.body?.cancel();
        return { service: plan.service, action: args.action, verified: true, id: changed.id, deleted: true };
      }
      if (!verify.ok) {
        await verify.body?.cancel();
        throw new GoogleWriteUncertain();
      }
      const item = await this.json(verify);
      if (item.id !== changed.id || !googleWriteMatches(item, plan.body)) throw new GoogleWriteUncertain();
      const result = { service: plan.service, action: args.action, verified: true, item, ...kind === "task" ? { scheduledDatePrecision: "date-only" } : {} };
      const secrets = [this.saved.clientSecret, this.saved.access, this.saved.refresh].filter((value) => Boolean(value));
      const redact = (value) => {
        if (typeof value === "string") {
          for (const secret of secrets) value = value.replaceAll(secret, "[redacted]");
          return value;
        }
        if (Array.isArray(value)) return value.map(redact);
        if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item2]) => [redact(key), redact(item2)]));
        return value;
      };
      return redact(result);
    } catch {
      throw new GoogleWriteUncertain();
    }
  }
  async read(kind, args, signal) {
    await this.load();
    const g = this.generation;
    if (!this.saved.refresh) throw new CalendarError("Connect Google Calendar in Settings first.");
    const count = args.count ?? 50;
    if (!Number.isInteger(count) || Number(count) < 1 || Number(count) > 100) throw new CalendarError("Count must be between 1 and 100.");
    const url = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
    url.searchParams.set("maxResults", String(count));
    if (kind === "events") {
      if (typeof args.calendarId !== "string" || !args.calendarId || args.calendarId.length > 1e3 || !timestamp(args.timeMin) || !timestamp(args.timeMax) || Date.parse(args.timeMax) <= Date.parse(args.timeMin) || Date.parse(args.timeMax) - Date.parse(args.timeMin) > 366 * 864e5) throw new CalendarError("Choose a calendar and a valid RFC3339 time range of at most 366 days.");
      url.pathname = "/calendar/v3/calendars/" + encodeURIComponent(args.calendarId) + "/events";
      url.searchParams.set("timeMin", args.timeMin);
      url.searchParams.set("timeMax", args.timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
    }
    const tasks = kind === "task-lists" || kind === "tasks";
    if (tasks) {
      url.hostname = "tasks.googleapis.com";
      url.pathname = "/tasks/v1/users/@me/lists";
    }
    if (kind === "tasks") {
      if (typeof args.taskListId !== "string" || !args.taskListId || args.taskListId.length > 1e3) throw new CalendarError("Choose a task list from calendar_task_lists.");
      url.pathname = `/tasks/v1/lists/${encodeURIComponent(args.taskListId)}/tasks`;
      if (args.includeCompleted !== void 0 && typeof args.includeCompleted !== "boolean") throw new CalendarError("Include completed must be true or false.");
      url.searchParams.set("showCompleted", String(args.includeCompleted === true));
      url.searchParams.set("showHidden", String(args.includeCompleted === true));
      url.searchParams.set("showDeleted", "false");
      url.searchParams.set("showAssigned", "true");
      for (const field of ["dueMin", "dueMax"]) if (args[field] !== void 0) {
        if (!timestamp(args[field])) throw new CalendarError("Task date filters need RFC3339 timestamps. Omit them to include undated tasks.");
        url.searchParams.set(field, args[field]);
      }
      if (typeof args.dueMin === "string" && typeof args.dueMax === "string" && Date.parse(args.dueMax) <= Date.parse(args.dueMin)) throw new CalendarError("The end of the task date range must follow its start.");
    }
    if (args.pageToken !== void 0) {
      if (typeof args.pageToken !== "string" || args.pageToken.length > 2e3) throw new CalendarError("Invalid page token.");
      url.searchParams.set("pageToken", args.pageToken);
    }
    signal.throwIfAborted();
    try {
      if (tasks && !this.saved.scopes?.some((scope) => [tasksReadScope, tasksWriteScope].includes(scope))) throw new CalendarError("Google Tasks permission has not been granted. Reconnect with Google in Settings to add Tasks access.", "tasks_permission_required");
      const refresh = () => this.exchange(new URLSearchParams({ client_id: this.saved.clientId, client_secret: this.saved.clientSecret, refresh_token: this.saved.refresh, grant_type: "refresh_token" }), g);
      if (!this.saved.access || (this.saved.expires ?? 0) < Date.now() + 6e4) await refresh();
      if (g !== this.generation) throw new CalendarError("Calendar disconnected.");
      const request = () => this.fetcher(url, { method: "GET", headers: { Authorization: `Bearer ${this.saved.access}` }, redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(2e4)]) });
      let response = await request();
      if (response.status === 401) {
        await response.body?.cancel();
        signal.throwIfAborted();
        await refresh();
        if (g !== this.generation) throw new CalendarError("Calendar disconnected.");
        signal.throwIfAborted();
        response = await request();
      }
      if (!response.ok) throw await this.readError(response, tasks ? "tasks" : "calendar");
      const data = await this.json(response);
      if (g !== this.generation) throw new CalendarError("Calendar disconnected.");
      if (!data || typeof data !== "object" || Array.isArray(data) || data.items !== void 0 && !Array.isArray(data.items)) throw new CalendarError("Google returned an invalid calendar response.", "invalid_response", true);
      const result = { provider: "google", access: "read-only", service: tasks ? "tasks" : "calendar", ...kind === "tasks" ? { scheduledDatePrecision: "date-only", dateMeaning: "The due field is the scheduled calendar day. It is not a deadline and has no readable scheduled time." } : {}, retrievedAt: (/* @__PURE__ */ new Date()).toISOString(), items: Array.isArray(data.items) ? data.items.slice(0, Number(count)) : [], ...typeof data.nextPageToken === "string" ? { nextPageToken: data.nextPageToken } : {} };
      const secrets = [this.saved.clientSecret, this.saved.access, this.saved.refresh].filter((value) => Boolean(value));
      const redact = (value) => {
        if (typeof value === "string") {
          for (const secret of secrets) value = value.replaceAll(secret, "[redacted]");
          return value;
        }
        if (Array.isArray(value)) return value.map(redact);
        if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key), redact(item)]));
        return value;
      };
      if (tasks) this.tasks = { access: "ready", checkedAt: (/* @__PURE__ */ new Date()).toISOString() };
      else {
        this.access = "ready";
        this.checkedAt = (/* @__PURE__ */ new Date()).toISOString();
        this.error = void 0;
        this.setupUrl = void 0;
      }
      return redact(result);
    } catch (error) {
      if (g !== this.generation || signal.aborted) throw error;
      const failure2 = error instanceof CalendarError ? error : new CalendarError(`Google ${tasks ? "Tasks" : "Calendar"} could not be reached. Check the connection and try again.`, "transport", true);
      if (tasks) this.tasks = { access: "blocked", checkedAt: (/* @__PURE__ */ new Date()).toISOString(), error: failure2.message, ...failure2.setupUrl ? { setupUrl: failure2.setupUrl } : {} };
      else {
        this.access = "blocked";
        this.checkedAt = (/* @__PURE__ */ new Date()).toISOString();
        this.error = failure2.message;
        this.setupUrl = failure2.setupUrl;
      }
      throw failure2;
    }
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

// apps/server/src/plugins/builtin/google-calendar/module.ts
var services = new InvocationServices();
var calendar = new GoogleCalendar("", services.fetch, services.credentials(), true);
var reads = { calendar_list: "calendars", calendar_events: "events", calendar_task_lists: "task-lists", calendar_tasks: "tasks" };
var writes = { calendar_write_event: "event", calendar_write_task: "task" };
var run = (operation) => async (input2, context) => services.run(context, async () => {
  try {
    context.signal.throwIfAborted();
    return success(await operation(input2, context));
  } catch (error) {
    const result = failure(error, context.signal);
    return { ...result, ...error instanceof GoogleWriteUncertain ? { outcome: "failed" } : {}, value: {
      ...result.value,
      ...error instanceof GoogleWriteUncertain ? { effectMayHaveOccurred: true, goalVerified: false, requiresInspection: true } : {},
      ...error instanceof CalendarError ? { code: error.code, retryable: error.retryable, ...error.setupUrl ? { setupUrl: error.setupUrl } : {} } : {}
    } };
  }
});
var handlers = {
  state: run(async () => ({ ...await calendar.state(), authorizationPending: calendar.hasPendingAuthorization() })),
  configure: run(async (input2) => calendar.configure(input2.clientId, input2.clientSecret)),
  authorize: run(async (input2) => calendar.authorize(input2.access)),
  complete: run(async () => calendar.completeAuthorization()),
  check: run(async () => calendar.check()),
  disconnect: run(async () => calendar.disconnect()),
  recover_read: async () => ({ outcome: "failed", released: true, value: { error: "The Google read was interrupted. Read again if needed. No request was replayed." } }),
  recover_write: async () => ({ outcome: "failed", released: true, value: { error: "This Google change was interrupted. It may already have happened. Read the destination before retrying; no request was replayed.", code: "write_uncertain", retryable: false, effectMayHaveOccurred: true, goalVerified: false, requiresInspection: true } })
};
for (const [name, kind] of Object.entries(reads)) handlers[name] = run(async (input2, context) => calendar.read(kind, input2, context.signal));
for (const [name, kind] of Object.entries(writes)) {
  handlers[name] = run(async (input2, context) => calendar.write(kind, input2, context.signal, async () => !context.signal.aborted));
  handlers[name + "_prepare"] = async (input2) => {
    googleWritePlan(kind, input2);
    return { resources: [] };
  };
}
var module_default = { handlers, deactivate() {
  calendar.close();
} };
export {
  module_default as default
};
