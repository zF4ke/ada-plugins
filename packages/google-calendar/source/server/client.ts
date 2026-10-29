import { createServer, type Server } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { protect } from '@ada/plugin-sdk/security';
import type { CalendarState } from '../types.ts';
import { googleWritePlan, googleWriteMatches, type GoogleWriteKind } from './write.ts';
import type { CredentialStorage } from '@ada/plugin-sdk/server';

export const calendarScopes = ['https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events.readonly'];
export const tasksReadScope = 'https://www.googleapis.com/auth/tasks.readonly';
export const googleReadScopes = [...calendarScopes, tasksReadScope];
export const calendarWriteScope = 'https://www.googleapis.com/auth/calendar.events';
export const tasksWriteScope = 'https://www.googleapis.com/auth/tasks';
export const googleWriteScopes = [calendarScopes[0]!, calendarWriteScope, tasksWriteScope];
const allowedScopes = [...googleReadScopes, ...googleWriteScopes];
export type GoogleRead = 'calendars' | 'events' | 'task-lists' | 'tasks';
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
type Saved = { clientId: string; clientSecret: string; access?: string; refresh?: string; expires?: number; scopes?: string[] };
export type { CalendarState } from '../types.ts';
export class CalendarError extends Error {
  constructor(message: string, readonly code = 'calendar_unavailable', readonly retryable = false, readonly setupUrl?: string) { super(message); }
}
export class GoogleWriteUncertain extends CalendarError {
  constructor() { super('Google may have applied this change, but its result could not be verified. Read the destination before retrying to avoid duplicates.', 'write_uncertain'); }
}
const instances = new Map<string, GoogleCalendar>();
export function googleCalendar(directory: string) { let value = instances.get(directory); if (!value) { value = new GoogleCalendar(directory); instances.set(directory, value); } return value; }
export class GoogleCalendar {
  private saved: Saved = { clientId: '', clientSecret: '' };
  private loaded = false;
  private loading?: Promise<void>;
  private exchanging = false;
  private generation = 0;
  private writes: Promise<void> = Promise.resolve();
  private listener?: Server;
  private timer?: NodeJS.Timeout;
  private error?: string;
  private access: CalendarState['access'] = 'unverified';
  private checkedAt?: string;
  private setupUrl?: string;
  private pendingAuthorization?: { body: URLSearchParams; generation: number; access: 'read-only' | 'read-write' };
  private tasks: NonNullable<CalendarState['tasks']> = { access: 'unverified' };
  constructor(private directory: string, private fetcher: typeof fetch = fetch, private storage?: CredentialStorage, private deferredAuthorization = false) {}
  private async load() {
    if (this.loaded) return;
    if (!this.loading) this.loading = (async () => {
      try { this.saved = this.storage ? (await this.storage.read() as Saved | undefined) ?? this.saved : JSON.parse((await protect('unprotect', await readFile(join(this.directory, 'google-calendar.dpapi')))).toString()); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new CalendarError('Could not open protected Google Calendar credentials.'); }
      this.loaded = true;
    })().finally(() => { this.loading = undefined; });
    await this.loading;
  }
  private async save(generation: number) {
    const value = JSON.stringify(this.saved);
    const work = this.writes.then(async () => {
      if (this.storage) { if (generation === this.generation) await this.storage.write(JSON.parse(value)); return; }
      const encrypted = await protect('protect', Buffer.from(value));
      if (generation !== this.generation) return;
      const path = join(this.directory, 'google-calendar.dpapi');
      await writeFile(path + '.next', encrypted, { mode: 0o600 });
      await rename(path + '.next', path);
    });
    this.writes = work.catch(() => undefined); await work;
  }
  async state(): Promise<CalendarState> {
    try { await this.load(); return { configured: Boolean(this.saved.clientId), connected: Boolean(this.saved.refresh), authorizing: Boolean(this.listener) || this.exchanging,
      ...(this.apiUrl('calendar') ? { apiSetup: { calendar: this.apiUrl('calendar')!, tasks: this.apiUrl('tasks')! } } : {}),
      ...(this.saved.refresh ? { permissions: { calendar: this.saved.scopes?.includes(calendarWriteScope) ? 'read-write' as const : 'read-only' as const, tasks: this.saved.scopes?.includes(tasksWriteScope) ? 'read-write' as const : 'read-only' as const }, access: this.access, tasks: this.saved.scopes?.some(scope => [tasksReadScope, tasksWriteScope].includes(scope)) ? { ...this.tasks } : { access: 'permission-needed' as const }, ...(this.checkedAt ? { checkedAt: this.checkedAt } : {}), ...(this.setupUrl ? { setupUrl: this.setupUrl } : {}) } : {}), ...(this.error ? { error: this.error } : {}) }; }
    catch { return { configured: false, connected: false, authorizing: false, error: 'Protected Google Calendar credentials are unavailable.' }; }
  }
  private stop() { clearTimeout(this.timer); this.listener?.close(); this.listener = undefined; this.exchanging = false; this.pendingAuthorization = undefined; }
  close() { this.stop(); ++this.generation; }
  hasPendingAuthorization() { return Boolean(this.pendingAuthorization); }
  async completeAuthorization() {
    const pending = this.pendingAuthorization;
    if (!pending) return this.state();
    this.pendingAuthorization = undefined;
    try { await this.exchange(pending.body, pending.generation, true, pending.access); }
    catch { if (pending.generation === this.generation) this.error = 'Google authorization failed. Check the OAuth client and try again.'; }
    finally { if (pending.generation === this.generation) this.exchanging = false; }
    return this.state();
  }
  private resetAccess() { this.access = 'unverified'; this.checkedAt = undefined; this.setupUrl = undefined; this.tasks = { access: 'unverified' }; }
  private apiUrl(service: 'calendar' | 'tasks') {
    const project = this.saved.clientId.match(/^(\d+)-/)?.[1];
    return project ? `https://console.cloud.google.com/apis/api/${service === 'calendar' ? 'calendar-json.googleapis.com' : 'tasks.googleapis.com'}/overview?project=${project}` : undefined;
  }
  async configure(clientId: unknown, clientSecret: unknown) {
    if (typeof clientId !== 'string' || !/^[a-zA-Z0-9._-]{10,250}\.apps\.googleusercontent\.com$/.test(clientId) || typeof clientSecret !== 'string' || !clientSecret || clientSecret.length > 500 || /\s/.test(clientSecret)) throw new CalendarError('Enter the client ID and secret from a Google Desktop app OAuth client.');
    await this.load(); this.stop(); const g = ++this.generation;
    this.saved = { clientId, clientSecret }; this.error = undefined; this.resetAccess(); await this.save(g); return this.state();
  }
  async disconnect() {
    try { await this.load(); } catch { this.loaded = true; }
    this.stop(); const g = ++this.generation; const token = this.saved.refresh;
    this.saved = { clientId: '', clientSecret: '' }; this.error = undefined; this.resetAccess();
    await this.writes; if (g === this.generation) { if (this.storage) await this.storage.disconnect(); else await rm(join(this.directory, 'google-calendar.dpapi'), { force: true }); }
    let revoked = true;
    if (token) { try { const response = await this.fetcher('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token }), redirect: 'error', signal: AbortSignal.timeout(10000) }); revoked = response.ok; } catch { revoked = false; } }
    if (!revoked && g === this.generation) this.error = 'Disconnected locally. Google revocation failed. Remove Ada access in your Google Account permissions.';
    return this.state();
  }
  async authorize(access: unknown = 'read-only') {
    if (access !== 'read-only' && access !== 'read-write') throw new CalendarError('Choose read-only or read-write Google access.');
    await this.load(); if (!this.saved.clientId) throw new CalendarError('Configure a Google Desktop app OAuth client first.');
    this.stop(); this.error = undefined; this.resetAccess(); const g = ++this.generation;
    const state = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
    let redirect = '';
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.headers.host !== new URL(redirect).host || request.method !== 'GET' || url.pathname !== '/oauth/callback' || url.searchParams.get('state') !== state || url.searchParams.getAll('state').length !== 1) { response.writeHead(400); response.end('Invalid authorization callback.'); return; }
      response.setHeader('Content-Type', 'text/plain; charset=utf-8'); response.setHeader('Cache-Control', 'no-store');
      this.stop();
      const code = url.searchParams.get('code');
      if (url.searchParams.has('error') || !code || url.searchParams.getAll('code').length !== 1 || code.length > 4096) { this.error = 'Google authorization was cancelled or denied.'; response.end('Google Calendar was not connected. Return to Ada.'); return; }
      this.exchanging = true;
      if (this.deferredAuthorization) {
        this.pendingAuthorization = { body: new URLSearchParams({ code, client_id: this.saved.clientId, client_secret: this.saved.clientSecret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }), generation: g, access };
        response.end('Google authorization received. Return to Ada to finish connecting.'); return;
      }
      void this.exchange(new URLSearchParams({ code, client_id: this.saved.clientId, client_secret: this.saved.clientSecret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }), g, true, access).then(() => { response.end(g === this.generation ? 'Google connected. Return to Ada to check granted access.' : 'Authorization cancelled.'); }).catch(() => { if (g === this.generation) this.error = 'Google authorization failed. Check the OAuth client and try again.'; response.end('Google was not connected. Return to Ada.'); }).finally(() => { if (g === this.generation) this.exchanging = false; });
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    this.listener = server; const address = server.address(); if (!address || typeof address === 'string') throw new CalendarError('Could not start Google authorization.');
    redirect = `http://127.0.0.1:${address.port}/oauth/callback`;
    this.timer = setTimeout(() => { if (g === this.generation) { this.stop(); this.error = 'Google authorization expired. Connect again.'; ++this.generation; } }, 300000); this.timer.unref();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: this.saved.clientId, redirect_uri: redirect, response_type: 'code', scope: (access === 'read-write' ? googleWriteScopes : googleReadScopes).join(' '), state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false' }).toString();
    return { url: url.toString() };
  }
  private async exchange(body: URLSearchParams, g: number, initial = false, requested: 'read-only' | 'read-write' = 'read-only') {
    const response = await this.fetcher('https://oauth2.googleapis.com/token', { method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      if (!initial && (response.status === 400 || response.status === 401) && g === this.generation) { this.saved = { clientId: this.saved.clientId, clientSecret: this.saved.clientSecret }; this.error = 'Google access expired or was revoked. Reconnect in Settings.'; await this.save(g); }
      throw new CalendarError('Google rejected the calendar authorization. Reconnect in Settings.');
    }
    const data = await this.json(response);
    const scopes: string[] = typeof data.scope === 'string' ? data.scope.split(' ') : [];
    if ((initial && (!scopes.includes(calendarScopes[0]!) || !scopes.some(s => [calendarScopes[1], calendarWriteScope].includes(s)) || requested === 'read-only' && scopes.some(s => [calendarWriteScope, tasksWriteScope].includes(s)))) || scopes.some((s: string) => !allowedScopes.includes(s)) || data.token_type?.toLowerCase() !== 'bearer' || typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > 10000 || (initial && (typeof data.refresh_token !== 'string' || !data.refresh_token || data.refresh_token.length > 10000))) throw new CalendarError('Google did not grant the required permissions.');
    if (g !== this.generation) throw new CalendarError('Calendar connection changed.');
    this.saved = { ...this.saved, ...(typeof data.scope === 'string' ? { scopes } : {}), access: data.access_token, refresh: typeof data.refresh_token === 'string' ? data.refresh_token : this.saved.refresh, expires: Date.now() + Math.min(Number(data.expires_in) || 3600, 3600) * 1000 };
    await this.save(g);
  }
  private async json(response: Response) {
    const reader = response.body?.getReader(); if (!reader) throw new CalendarError('Google returned an empty response.');
    let bytes = 0; const chunks: Uint8Array[] = [];
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 2000000) throw new CalendarError('Google response exceeded the size limit.'); chunks.push(value); } return JSON.parse(Buffer.concat(chunks).toString()); }
    catch { await reader.cancel().catch(() => undefined); throw new CalendarError('Google returned an invalid calendar response.'); }
  }
  private async readError(response: Response, service: 'calendar' | 'tasks', operation: 'read' | 'write' = 'read') {
    const label = service === 'calendar' ? 'Google Calendar' : 'Google Tasks';
    const data = await this.json(response).catch(() => ({}));
    const reasons = new Set([...(Array.isArray(data?.error?.errors) ? data.error.errors : []),
      ...(Array.isArray(data?.error?.details) ? data.error.details : [])].map(item => item?.reason));
    if (reasons.has('accessNotConfigured') || reasons.has('SERVICE_DISABLED')) {
      return new CalendarError(`Google ${service === 'calendar' ? 'Calendar' : 'Tasks'} API is disabled for this OAuth client's project. Enable it in Google Cloud, then choose Check access.`,
        'api_disabled', false, this.apiUrl(service));
    }
    if (response.status === 401) return new CalendarError(`${label} access expired. Reconnect in Settings.`, 'authorization_expired');
    if (reasons.has('insufficientPermissions') || reasons.has('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) return new CalendarError(`Google did not grant the required ${operation === 'read' ? 'read-only' : 'write'} permissions for ${service === 'calendar' ? 'Calendar' : 'Tasks'}. Reconnect with Google in Settings.`, 'permissions');
    if (response.status === 429 || ['rateLimitExceeded', 'userRateLimitExceeded', 'quotaExceeded'].some(reason => reasons.has(reason))) return new CalendarError(`${label} rate limit reached. Try later.`, 'rate_limit', true);
    if (response.status === 404) return new CalendarError(`This ${service === 'calendar' ? 'calendar' : 'task list'} was not found or is not shared with the connected Google account.`, 'not_found');
    if (response.status === 403) return new CalendarError(`The connected Google account cannot ${operation === 'read' ? 'read' : 'change'} this ${service === 'calendar' ? 'calendar' : 'task list'}. Check its permissions.`, 'forbidden');
    if (response.status === 400) return new CalendarError(operation === 'read' ? 'Google rejected the requested read filters. Check the date range and list identity.' : 'Google rejected this change. Check its fields and whether this item supports editing.', 'invalid_request');
    return new CalendarError(`${label} is temporarily unavailable. Try again later.`, 'calendar_unavailable', response.status >= 500);
  }
  async check() {
    await this.load();
    if (!this.saved.refresh) throw new CalendarError('Connect Google Calendar in Settings first.');
    try { await this.read('calendars', { count: 1 }, AbortSignal.timeout(30000)); } catch { /* The read records a sanitized access error for Settings. */ }
    try { await this.read('task-lists', { count: 1 }, AbortSignal.timeout(30000)); } catch { /* Tasks has separate permissions and access status. */ }
    return this.state();
  }
  async write(kind: GoogleWriteKind, args: Record<string, unknown>, signal: AbortSignal, authorize: () => Promise<boolean>) {
    const plan = googleWritePlan(kind, args);
    await this.load(); const g = this.generation;
    const scope = kind === 'event' ? calendarWriteScope : tasksWriteScope;
    if (!this.saved.refresh || !this.saved.scopes?.includes(scope)) throw new CalendarError('Write access has not been granted for this Google service. Choose Allow changes in Google Settings and authorize with Google.', 'write_permission_required');
    signal.throwIfAborted();
    if (!this.saved.access || (this.saved.expires ?? 0) < Date.now() + 60000) await this.exchange(new URLSearchParams({ client_id: this.saved.clientId, client_secret: this.saved.clientSecret, refresh_token: this.saved.refresh, grant_type: 'refresh_token' }), g);
    const active = async () => { signal.throwIfAborted(); if (g !== this.generation || !await authorize() || g !== this.generation) throw new CalendarError('Google change cancelled before dispatch.', 'cancelled'); signal.throwIfAborted(); };
    await active();
    const headers = { Authorization: `Bearer ${this.saved.access}`, 'Content-Type': 'application/json', ...(plan.etag ? { 'If-Match': plan.etag } : {}) };
    if (plan.etag) {
      const currentUrl = new URL(plan.url); currentUrl.search = '';
      const current = await this.fetcher(currentUrl, { method: 'GET', headers: { Authorization: headers.Authorization }, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
      if (!current.ok) throw await this.readError(current, plan.service);
      const existing = await this.json(current);
      if (existing.etag !== plan.etag || existing.id !== args.itemId) throw new CalendarError('This Google item changed since the last read. Read it again before editing.', 'write_conflict');
    }
    await active();
    let response: Response;
    try { response = await this.fetcher(plan.url, { method: plan.method, headers, ...(plan.body ? { body: JSON.stringify(plan.body) } : {}), redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) }); }
    catch { throw new GoogleWriteUncertain(); }
    if (response.status === 412 || response.status === 409) { await response.body?.cancel(); throw new CalendarError('This Google item changed or conflicts with another entry. Read it again before retrying.', 'write_conflict'); }
    if (response.status >= 500) { await response.body?.cancel(); throw new GoogleWriteUncertain(); }
    if (!response.ok) throw await this.readError(response, plan.service, 'write');
    try {
      const changed = plan.method === 'DELETE' ? { id: args.itemId } : await this.json(response);
      if (typeof changed?.id !== 'string' || !changed.id || plan.method !== 'POST' && changed.id !== args.itemId) throw new GoogleWriteUncertain();
      const verifyUrl = new URL(plan.url); verifyUrl.search = '';
      if (plan.method === 'POST') verifyUrl.pathname += '/' + encodeURIComponent(changed.id);
      const verify = await this.fetcher(verifyUrl, { method: 'GET', headers: { Authorization: headers.Authorization }, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
      if (g !== this.generation) throw new GoogleWriteUncertain();
      if (plan.method === 'DELETE') {
        if (verify.ok) {
          const item = await this.json(verify);
          if (item.id !== changed.id || !(kind === 'task' ? item.deleted === true : item.status === 'cancelled')) throw new GoogleWriteUncertain();
        } else if (verify.status !== 404 && verify.status !== 410) { await verify.body?.cancel(); throw new GoogleWriteUncertain(); }
        else await verify.body?.cancel();
        return { service: plan.service, action: args.action, verified: true, id: changed.id, deleted: true };
      }
      if (!verify.ok) { await verify.body?.cancel(); throw new GoogleWriteUncertain(); }
      const item = await this.json(verify);
      // The Meet request is not echoed back; Google attaches a conference instead.
      const { conferenceData: requestedConference, ...expected } = plan.body ?? {};
      if (item.id !== changed.id || !googleWriteMatches(item, expected) || (requestedConference && !item.conferenceData && !item.hangoutLink)) throw new GoogleWriteUncertain();
      const meetLink = typeof item.hangoutLink === 'string' ? item.hangoutLink : undefined;
      const result = { service: plan.service, action: args.action, verified: true, item, ...(meetLink ? { meetLink } : {}), ...(kind === 'task' ? { scheduledDatePrecision: 'date-only' } : {}) };
      const secrets = [this.saved.clientSecret, this.saved.access, this.saved.refresh].filter((value): value is string => Boolean(value));
      const redact = (value: unknown): unknown => {
        if (typeof value === 'string') { for (const secret of secrets) value = (value as string).replaceAll(secret, '[redacted]'); return value; }
        if (Array.isArray(value)) return value.map(redact);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key), redact(item)]));
        return value;
      };
      return redact(result) as typeof result;
    } catch { throw new GoogleWriteUncertain(); }
  }
  async read(kind: GoogleRead, args: Record<string, unknown>, signal: AbortSignal) {
    await this.load(); const g = this.generation; if (!this.saved.refresh) throw new CalendarError('Connect Google Calendar in Settings first.');
    const count = args.count ?? 50; if (!Number.isInteger(count) || Number(count) < 1 || Number(count) > 100) throw new CalendarError('Count must be between 1 and 100.');
    const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList'); url.searchParams.set('maxResults', String(count));
    if (kind === 'events') {
      if (typeof args.calendarId !== 'string' || !args.calendarId || args.calendarId.length > 1000 || !timestamp(args.timeMin) || !timestamp(args.timeMax) || Date.parse(args.timeMax) <= Date.parse(args.timeMin) || Date.parse(args.timeMax) - Date.parse(args.timeMin) > 366 * 86400000) throw new CalendarError('Choose a calendar and a valid RFC3339 time range of at most 366 days.');
      url.pathname = '/calendar/v3/calendars/' + encodeURIComponent(args.calendarId) + '/events'; url.searchParams.set('timeMin', args.timeMin); url.searchParams.set('timeMax', args.timeMax); url.searchParams.set('singleEvents', 'true'); url.searchParams.set('orderBy', 'startTime');
    }
    const tasks = kind === 'task-lists' || kind === 'tasks';
    if (tasks) { url.hostname = 'tasks.googleapis.com'; url.pathname = '/tasks/v1/users/@me/lists'; }
    if (kind === 'tasks') {
      if (typeof args.taskListId !== 'string' || !args.taskListId || args.taskListId.length > 1000) throw new CalendarError('Choose a task list from calendar_task_lists.');
      url.pathname = `/tasks/v1/lists/${encodeURIComponent(args.taskListId)}/tasks`;
      if (args.includeCompleted !== undefined && typeof args.includeCompleted !== 'boolean') throw new CalendarError('Include completed must be true or false.');
      url.searchParams.set('showCompleted', String(args.includeCompleted === true));
      url.searchParams.set('showHidden', String(args.includeCompleted === true));
      url.searchParams.set('showDeleted', 'false'); url.searchParams.set('showAssigned', 'true');
      for (const field of ['dueMin','dueMax']) if (args[field] !== undefined) {
        if (!timestamp(args[field])) throw new CalendarError('Task date filters need RFC3339 timestamps. Omit them to include undated tasks.');
        url.searchParams.set(field, args[field]);
      }
      if (typeof args.dueMin === 'string' && typeof args.dueMax === 'string' && Date.parse(args.dueMax) <= Date.parse(args.dueMin)) throw new CalendarError('The end of the task date range must follow its start.');
    }
    if (args.pageToken !== undefined) { if (typeof args.pageToken !== 'string' || args.pageToken.length > 2000) throw new CalendarError('Invalid page token.'); url.searchParams.set('pageToken', args.pageToken); }
    signal.throwIfAborted();
    try {
      if (tasks && !this.saved.scopes?.some(scope => [tasksReadScope, tasksWriteScope].includes(scope))) throw new CalendarError('Google Tasks permission has not been granted. Reconnect with Google in Settings to add Tasks access.', 'tasks_permission_required');
      const refresh = () => this.exchange(new URLSearchParams({ client_id: this.saved.clientId, client_secret: this.saved.clientSecret, refresh_token: this.saved.refresh!, grant_type: 'refresh_token' }), g);
      if (!this.saved.access || (this.saved.expires ?? 0) < Date.now() + 60000) await refresh();
      if (g !== this.generation) throw new CalendarError('Calendar disconnected.');
      const request = () => this.fetcher(url, { method: 'GET', headers: { Authorization: `Bearer ${this.saved.access}` }, redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
      let response = await request();
      if (response.status === 401) {
        await response.body?.cancel(); signal.throwIfAborted(); await refresh();
        if (g !== this.generation) throw new CalendarError('Calendar disconnected.');
        signal.throwIfAborted(); response = await request();
      }
      if (!response.ok) throw await this.readError(response, tasks ? 'tasks' : 'calendar');
      const data = await this.json(response); if (g !== this.generation) throw new CalendarError('Calendar disconnected.');
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.items !== undefined && !Array.isArray(data.items)) throw new CalendarError('Google returned an invalid calendar response.', 'invalid_response', true);
      const result = { provider: 'google', access: 'read-only', service: tasks ? 'tasks' : 'calendar', ...(kind === 'tasks' ? { scheduledDatePrecision: 'date-only', dateMeaning: 'The due field is the scheduled calendar day. It is not a deadline and has no readable scheduled time.' } : {}), retrievedAt: new Date().toISOString(), items: Array.isArray(data.items) ? data.items.slice(0, Number(count)) : [], ...(typeof data.nextPageToken === 'string' ? { nextPageToken: data.nextPageToken } : {}) };
      const secrets = [this.saved.clientSecret, this.saved.access, this.saved.refresh].filter((value): value is string => Boolean(value));
      const redact = (value: unknown): unknown => {
        if (typeof value === 'string') { for (const secret of secrets) value = (value as string).replaceAll(secret, '[redacted]'); return value; }
        if (Array.isArray(value)) return value.map(redact);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key), redact(item)]));
        return value;
      };
      if (tasks) this.tasks = { access: 'ready', checkedAt: new Date().toISOString() };
      else { this.access = 'ready'; this.checkedAt = new Date().toISOString(); this.error = undefined; this.setupUrl = undefined; }
      return redact(result) as typeof result;
    } catch (error) {
      if (g !== this.generation || signal.aborted) throw error;
      const failure = error instanceof CalendarError ? error : new CalendarError(`Google ${tasks ? 'Tasks' : 'Calendar'} could not be reached. Check the connection and try again.`, 'transport', true);
      if (tasks) this.tasks = { access: 'blocked', checkedAt: new Date().toISOString(), error: failure.message, ...(failure.setupUrl ? { setupUrl: failure.setupUrl } : {}) };
      else { this.access = 'blocked'; this.checkedAt = new Date().toISOString(); this.error = failure.message; this.setupUrl = failure.setupUrl; }
      throw failure;
    }
  }
}
