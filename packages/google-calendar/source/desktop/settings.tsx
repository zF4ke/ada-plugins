import { useEffect, useState } from 'react';
import type { CalendarState } from '../types.ts';
import { Dialog } from '@ada/plugin-sdk/ui';
import { InlineNotice, TextButton, openExternalLink } from '@ada/plugin-sdk/ui';
import brand from '../assets/brand.svg';
import './settings.css';

const sectionHeading = { fontSize: 'var(--text-heading-size, 16px)', lineHeight: '24px' };

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
  function cloud(path: string) {
    const url = new URL(path, 'https://console.cloud.google.com');
    try { const project = new URL(state?.apiSetup?.calendar ?? '').searchParams.get('project'); if (project) url.searchParams.set('project', project); } catch { /* New connections use the project selected in Google Cloud. */ }
    return url.toString();
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
      <TextButton onClick={() => setSetup(true)}>{state?.configured ? 'Google setup guide' : 'Set up Google connection'}</TextButton>
      <TextButton disabled={busy || !state?.configured || state.authorizing} onClick={() => void act({ action: 'authorize', access: state?.permissions?.calendar === 'read-write' || state?.permissions?.tasks === 'read-write' ? 'read-write' : 'read-only' })}>{state?.connected ? 'Reconnect with Google' : 'Connect with Google'}</TextButton>
      {state?.configured && <TextButton icon="edit" disabled={busy || state.authorizing} onClick={() => void act({ action: 'authorize', access: state.permissions?.calendar === 'read-write' && state.permissions?.tasks === 'read-write' ? 'read-only' : 'read-write' })}>{state.permissions?.calendar === 'read-write' && state.permissions?.tasks === 'read-write' ? 'Use read-only access' : 'Allow changes'}</TextButton>}
      {state?.configured && <TextButton disabled={busy} onClick={() => void act({ action: 'disconnect' })}>Disconnect</TextButton>}
    </div>
    {setup && <Dialog size="wide" title="Google Calendar and Tasks setup" onClose={() => setSetup(false)}><div className="calendar-settings calendar-setup">
      <p>Use your own Google Cloud project. The buttons below open Google Cloud; complete each change there, then return to Ada.</p>
      {state?.configured && <p className="calendar-returning">Already have a client? Keep it. To leave Testing, follow step 2, then reconnect in step 4. You do not need to enter your credentials again.</p>}
      <ol className="calendar-setup-steps">
        <li><h4 className="settings-section-title" style={sectionHeading}>Choose a project and enable both APIs</h4>
          <p>Open Google Cloud. Use the project picker at the top to create or select a project. Keep that same project selected for every step.</p>
          <div className="calendar-actions"><TextButton onClick={() => void openExternalLink(cloud('/home/dashboard'))}>Open Google Cloud</TextButton></div>
          <p>Open each API below and choose <strong>Enable</strong>. Calendar and Tasks are separate APIs; both are needed.</p>
          <div className="calendar-actions">
            <TextButton onClick={() => void openExternalLink(cloud('/apis/library/calendar-json.googleapis.com'))}>Calendar API</TextButton>
            <TextButton onClick={() => void openExternalLink(cloud('/apis/library/tasks.googleapis.com'))}>Tasks API</TextButton>
          </div>
        </li>
        <li><h4 className="settings-section-title" style={sectionHeading}>Set up Google sign-in for lasting access</h4>
          <p>In <strong>Google Auth Platform</strong>, choose <strong>Get started</strong> if prompted. Enter an app name such as Ada and your contact email. For a personal Google account, choose <strong>External</strong> as the audience.</p>
          <div className="calendar-actions"><TextButton onClick={() => void openExternalLink(cloud('/auth/branding'))}>Google Auth setup</TextButton><TextButton onClick={() => void openExternalLink(cloud('/auth/audience'))}>Publishing status</TextButton></div>
          <p>On <strong>Audience</strong>, choose <strong>Publish app</strong> and confirm. Check that the status says <strong>In production</strong>. Testing grants expire after seven days; production removes that testing limit.</p>
          <p>Publishing status and Google verification are separate. Personal use does not require verification, but Google may show an unverified-app warning. Only continue for the client you created.</p>
        </li>
        <li><h4 className="settings-section-title" style={sectionHeading}>Create a Desktop app client</h4>
          <p>Under <strong>Clients</strong>, choose <strong>Create client</strong>, select <strong>Desktop app</strong> as the application type, give it a name and choose <strong>Create</strong>. Copy its client ID and client secret below.</p>
          <div className="calendar-actions"><TextButton onClick={() => void openExternalLink(cloud('/auth/clients'))}>Open OAuth clients</TextButton></div>
          {state?.configured && <p>Skip these fields unless you are replacing your client. Saving a different client requires signing in again.</p>}
          <form className="provider-connect" onSubmit={event => { event.preventDefault(); void act({ action: 'configure', clientId, clientSecret }); }}>
            <label htmlFor="calendar-client-id">Google client ID</label><input id="calendar-client-id" autoComplete="off" value={clientId} onChange={event => setId(event.target.value)} disabled={busy} />
            <label htmlFor="calendar-client-secret">Google client secret</label><input id="calendar-client-secret" type="password" autoComplete="off" value={clientSecret} onChange={event => setSecret(event.target.value)} disabled={busy} />
            <TextButton type="submit" disabled={busy || !clientId || !clientSecret}>Save OAuth client</TextButton>
          </form>
        </li>
        <li><h4 className="settings-section-title" style={sectionHeading}>Connect in Ada and check both services</h4>
          <p>Return to the connection page and choose <strong>Connect with Google</strong> or <strong>Reconnect with Google</strong>. Sign in on the Ada server PC and approve Calendar and Tasks access.</p>
          <p>Read-only access is enough to check events and to-dos. Choose <strong>Allow changes</strong> only if you want Ada to edit them. Then choose <strong>Check access</strong> and confirm both services show access.</p>
          <p>After leaving Testing, reconnect once to replace the expired grant. Changing the publishing status does not repair an old token.</p>
          <div className="calendar-actions"><TextButton onClick={() => setSetup(false)}>Back to connection</TextButton></div>
        </li>
      </ol>
      <p>Credentials stay encrypted on your Ada server. Events and tasks you ask Ada to read can enter task history and model context.</p>
      {error && <InlineNotice tone="warning">{error}</InlineNotice>}
    </div></Dialog>}
    {!setup && (error || state?.error) && <InlineNotice tone="warning">{error || state?.error}</InlineNotice>}
    {!setup && state?.setupUrl && <TextButton onClick={() => void openExternalLink(state.setupUrl!)}>Enable Calendar API</TextButton>}
    {!setup && state?.tasks?.error && <InlineNotice tone="warning">{state.tasks.error}</InlineNotice>}
    {!setup && state?.tasks?.setupUrl && <TextButton onClick={() => void openExternalLink(state.tasks!.setupUrl!)}>Enable Tasks API</TextButton>}
  </section>;
}
