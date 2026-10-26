import { useEffect, useState } from 'react';
import type { CalendarState } from '../types.ts';
import { Dialog } from '@ada/plugin-sdk/ui';
import { InlineNotice, TextButton, openExternalLink } from '@ada/plugin-sdk/ui';
import brand from '../assets/brand.svg';
import './settings.css';

export type CalendarInput = { action: 'configure' | 'authorize' | 'disconnect' | 'check'; clientId?: string; clientSecret?: string; access?: 'read-only' | 'read-write' };
export function GoogleCalendarSettings({ connection }: { connection(input?: CalendarInput): Promise<CalendarState> }) {
  const [state, setState] = useState<CalendarState>(), [clientId, setId] = useState(''), [clientSecret, setSecret] = useState(''), [setup, setSetup] = useState(false), [busy, setBusy] = useState(false), [checking, setChecking] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const refresh = () => { void connection().then(value => { if (alive) setState(value); }).catch(() => { if (alive) setError('Calendar settings are unavailable.'); }); };
    refresh(); const timer = setInterval(refresh, 2000);
    return () => { alive = false; clearInterval(timer); };
  }, [connection]);
  async function act(input?: CalendarInput) {
    setBusy(true); setChecking(input?.action === 'check'); setError('');
    try { setState(await connection(input)); setSecret(''); setId(''); if (input?.action === 'configure') setSetup(false); }
    catch { setError('Calendar connection failed. Check the Google configuration and try again.'); }
    finally { setBusy(false); setChecking(false); }
  }
  return <section className="provider-connection calendar-settings" aria-label="Google Calendar connection">
    <div className="provider-heading"><h4 className="settings-section-title"><span className="brand-icon brand-icon-compact" aria-hidden="true"><img src={brand} alt="" draggable={false} /></span>Google Calendar and Tasks</h4><span role="status">{checking ? 'Checking access' : state?.authorizing ? 'Waiting for Google' : state?.connected ? state.access === 'blocked' ? 'Read access blocked' : state.access === 'ready' ? state.tasks && state.tasks.access !== 'ready' ? 'Calendar connected' : 'Connected' : 'Signed in, access not checked' : state ? 'Not connected' : error ? 'Unavailable' : 'Loading'}</span></div>
    <p className="setting-detail">Find events and to-dos. Allow changes to schedule events, edit tasks and mark them complete when you ask.</p>
    {state?.connected && state.tasks && <div className="calendar-services">
      <div><span>Calendar events</span><span>{state.access === 'ready' ? state.permissions?.calendar === 'read-write' ? 'Read and write' : 'Read-only' : state.access === 'blocked' ? 'Blocked' : 'Not checked'}</span></div>
      <div><span>Google Tasks</span><span>{state.tasks.access === 'ready' ? state.permissions?.tasks === 'read-write' ? 'Read and write' : 'Read-only' : state.tasks.access === 'permission-needed' ? 'Reconnect to grant access' : state.tasks.access === 'blocked' ? 'Blocked' : 'Not checked'}</span></div>
    </div>}
    <div className="calendar-actions">
      {state?.connected && <TextButton disabled={busy || state.authorizing} onClick={() => void act({ action: 'check' })}>Check access</TextButton>}
      <TextButton onClick={() => setSetup(true)}>{state?.configured ? 'Edit Google configuration' : 'Set up Google connection'}</TextButton>
      <TextButton disabled={busy || !state?.configured || state.authorizing} onClick={() => void act({ action: 'authorize', access: state?.permissions?.calendar === 'read-write' || state?.permissions?.tasks === 'read-write' ? 'read-write' : 'read-only' })}>{state?.connected ? 'Reconnect with Google' : 'Connect with Google'}</TextButton>
      {state?.configured && <TextButton icon="edit" disabled={busy || state.authorizing} onClick={() => void act({ action: 'authorize', access: state.permissions?.calendar === 'read-write' && state.permissions?.tasks === 'read-write' ? 'read-only' : 'read-write' })}>{state.permissions?.calendar === 'read-write' && state.permissions?.tasks === 'read-write' ? 'Use read-only access' : 'Allow changes'}</TextButton>}
      {state?.configured && <TextButton disabled={busy} onClick={() => void act({ action: 'disconnect' })}>Disconnect</TextButton>}
    </div>
    {setup && <Dialog title="Google Calendar and Tasks setup" onClose={() => setSetup(false)}><div className="calendar-settings">
      <p className="setting-detail">Create a Desktop app OAuth client in Google Cloud, then enter its credentials below. Enable both APIs in that same project. Add your account as a test user if the app is in testing, and sign in on the Ada server PC.</p>
      <div className="calendar-actions">
        <TextButton onClick={() => void openExternalLink(state?.apiSetup?.calendar ?? 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com')}>Enable Calendar API</TextButton>
        <TextButton onClick={() => void openExternalLink(state?.apiSetup?.tasks ?? 'https://console.cloud.google.com/apis/library/tasks.googleapis.com')}>Enable Tasks API</TextButton>
      </div>
      <p className="setting-detail">These buttons open Google Cloud. Choose Enable there, then return and check access.</p>
      <form className="provider-connect" onSubmit={event => { event.preventDefault(); void act({ action: 'configure', clientId, clientSecret }); }}>
        <label htmlFor="calendar-client-id">Google client ID</label><input id="calendar-client-id" autoComplete="off" value={clientId} onChange={event => setId(event.target.value)} disabled={busy} />
        <label htmlFor="calendar-client-secret">Google client secret</label><input id="calendar-client-secret" type="password" autoComplete="off" value={clientSecret} onChange={event => setSecret(event.target.value)} disabled={busy} />
        <TextButton type="submit" disabled={busy || !clientId || !clientSecret}>Save OAuth client</TextButton>
      </form>
      <p className="setting-detail">Credentials stay encrypted for your Windows account on the server. Requested events and tasks can enter task history and model context. Google testing grants may expire after seven days.</p>
      {error && <InlineNotice tone="warning">{error}</InlineNotice>}
    </div></Dialog>}
    {!setup && (error || state?.error) && <InlineNotice tone="warning">{error || state?.error}</InlineNotice>}
    {!setup && state?.setupUrl && <TextButton onClick={() => void openExternalLink(state.setupUrl!)}>Enable Calendar API</TextButton>}
    {!setup && state?.tasks?.error && <InlineNotice tone="warning">{state.tasks.error}</InlineNotice>}
    {!setup && state?.tasks?.setupUrl && <TextButton onClick={() => void openExternalLink(state.tasks!.setupUrl!)}>Enable Tasks API</TextButton>}
  </section>;
}
