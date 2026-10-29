export type GoogleWriteKind = 'event' | 'task';
export type GoogleWritePlan = { service: 'calendar' | 'tasks'; url: URL; method: 'POST' | 'PATCH' | 'DELETE'; body?: Record<string, unknown>; etag?: string };
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const time = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && date(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24 && Number.isFinite(Date.parse(value));
function text(value: unknown, label: string, max: number, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max) throw new Error(`Invalid ${label}.`);
  return value;
}

/** Narrow scheduling contract. Attendees, arbitrary API fields and account mutations are not accepted. */
export function googleWritePlan(kind: GoogleWriteKind, args: Record<string, unknown>): GoogleWritePlan {
  const event = kind === 'event';
  const allowed = new Set(['action', 'itemId', 'etag', ...(event ? ['calendarId', 'summary', 'description', 'location', 'start', 'end', 'timeZone', 'meet'] : ['taskListId', 'title', 'notes', 'dueDate', 'completed'])]);
  if (Object.keys(args).some(key => !allowed.has(key)) || !['create', 'update', 'delete'].includes(String(args.action))) throw new Error('Invalid Google write action or fields.');
  const creating = args.action === 'create', deleting = args.action === 'delete';
  const container = text(event ? args.calendarId : args.taskListId, event ? 'calendar ID' : 'task list ID', 1000);
  const id = creating ? undefined : text(args.itemId, 'item ID from the last read', 1000);
  if ([container, id].some(value => value === '.' || value === '..')) throw new Error('Invalid Google item identity. Use the exact ID from a read.');
  const etag = creating ? undefined : text(args.etag, 'ETag from the last read', 1000);
  if (etag && /[\r\n]/.test(etag)) throw new Error('Invalid ETag.');
  if (creating && (args.itemId !== undefined || args.etag !== undefined)) throw new Error('Create does not accept an existing item identity.');
  const url = new URL(event ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(container)}/events` : `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(container)}/tasks`);
  if (id) url.pathname += '/' + encodeURIComponent(id);
  if (event) url.searchParams.set('sendUpdates', 'none');
  const body: Record<string, unknown> = {};
  for (const [field, max] of event ? [['summary', 1000], ['description', 8000], ['location', 1000]] as const : [['title', 1024], ['notes', 8192]] as const) {
    if (args[field] !== undefined) body[field] = text(args[field], field, max, field !== 'summary' && field !== 'title');
  }
  if (event && (creating || args.start !== undefined || args.end !== undefined || args.timeZone !== undefined)) {
    const allDay = date(args.start) && date(args.end);
    if (!allDay && (!time(args.start) || !time(args.end))) throw new Error('Provide both start and end as RFC3339 timestamps, or YYYY-MM-DD all-day dates.');
    if (Date.parse(String(args.end)) <= Date.parse(String(args.start))) throw new Error('Event end must follow its start. All-day end dates are exclusive.');
    if (allDay) {
      if (args.timeZone !== undefined) throw new Error('All-day dates do not accept a timezone.');
      body.start = { date: args.start }; body.end = { date: args.end };
    } else {
      const zone = text(args.timeZone, 'IANA timezone', 100);
      try { new Intl.DateTimeFormat('en', { timeZone: zone }); } catch { throw new Error('Use a valid IANA timezone.'); }
      body.start = { dateTime: args.start, timeZone: zone }; body.end = { dateTime: args.end, timeZone: zone };
    }
  }
  // A Google Meet link is a conference request on the event. Google creates the link; Ada reports it back.
  if (event && args.meet !== undefined) {
    if (typeof args.meet !== 'boolean') throw new Error('meet must be true or false.');
    if (deleting) throw new Error('Delete does not accept meet.');
    // Google only applies or clears conferencing when the request declares conferenceDataVersion=1. A new event has nothing to clear.
    if (args.meet || !creating) {
      body.conferenceData = args.meet ? { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } : null;
      url.searchParams.set('conferenceDataVersion', '1');
    }
  }
  if (!event && args.dueDate !== undefined) {
    if (args.dueDate !== null && !date(args.dueDate)) throw new Error('Tasks accept a scheduled YYYY-MM-DD date, without a time. Use a Calendar event for timed work.');
    body.due = args.dueDate === null ? null : `${args.dueDate}T00:00:00.000Z`;
  }
  if (!event && args.completed !== undefined) {
    if (typeof args.completed !== 'boolean') throw new Error('Completed must be true or false.');
    body.status = args.completed ? 'completed' : 'needsAction';
    if (!args.completed) body.completed = null;
  }
  if (creating && !body[event ? 'summary' : 'title']) throw new Error(event ? 'An event needs a summary.' : 'A task needs a title.');
  if (!creating && !deleting && !Object.keys(body).length) throw new Error('Choose at least one field to update, or meet: true or false to add or remove a Google Meet link.');
  if (deleting && Object.keys(body).length) throw new Error('Delete accepts only the container, item identity and ETag.');
  return { service: event ? 'calendar' : 'tasks', url, method: creating ? 'POST' : deleting ? 'DELETE' : 'PATCH', ...(deleting ? {} : { body }), ...(etag ? { etag } : {}) };
}

export function googleWriteMatches(actual: unknown, expected: unknown, field = ''): boolean {
  if (expected === null) return actual == null;
  if (expected === '' && ['description', 'location', 'notes'].includes(field)) return actual == null || actual === '';
  if (field === 'dateTime' && typeof actual === 'string' && typeof expected === 'string') return Date.parse(actual) === Date.parse(expected);
  if (field === 'due' && typeof actual === 'string' && typeof expected === 'string') return actual.slice(0, 10) === expected.slice(0, 10);
  if (expected && typeof expected === 'object') return Boolean(actual && typeof actual === 'object' && Object.entries(expected).every(([key, value]) => googleWriteMatches((actual as Record<string, unknown>)[key], value, key)));
  return actual === expected;
}
