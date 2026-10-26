import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DiscordState } from '../types.ts';
import { InlineNotice, TextButton } from '@ada/plugin-sdk/ui';
import { Dialog } from '@ada/plugin-sdk/ui';
import { ConnectionStatus } from '@ada/plugin-sdk/ui';
import brand from '../assets/brand.svg';
import './settings.css';

export type DiscordInput = { action: 'connect'; token: string } | { action: 'disconnect' };

export function DiscordConnection({ connection }: { connection(input?: DiscordInput): Promise<DiscordState> }) {
  const [state, setState] = useState<DiscordState>(), [setup, setSetup] = useState(false), [pending, setPending] = useState<'connect' | 'disconnect' | 'refresh'>(), [error, setError] = useState(''), [hasToken, setHasToken] = useState(false);
  const token = useRef<HTMLInputElement | null>(null), mounted = useRef(false), request = useRef(0), inputId = useId(), detailsId = useId();
  const attachToken = useCallback((element: HTMLInputElement | null) => {
    if (token.current && token.current !== element) token.current.value = '';
    token.current = element;
  }, []);
  function clearToken() { if (token.current) token.current.value = ''; setHasToken(false); }
  function closeSetup() { clearToken(); setSetup(false); }
  async function act(input?: DiscordInput) {
    const current = ++request.current; setPending(input?.action ?? 'refresh'); setError('');
    try {
      const next = await connection(input);
      if (!mounted.current || current !== request.current) return;
      setState(next);
      if (input?.action === 'connect' && next.connected) closeSetup();
      else if (input?.action === 'connect') setError('Discord did not connect. Enter your token again to retry.');
    } catch {
      if (!mounted.current || current !== request.current) return;
      setError(input?.action === 'connect' ? 'Discord connection failed. Enter your token again to retry.' : input?.action === 'disconnect' ? 'Discord could not be disconnected. Try again.' : 'Discord settings are unavailable. Try again.');
    } finally { if (mounted.current && current === request.current) setPending(undefined); }
  }
  useEffect(() => {
    mounted.current = true; void act();
    return () => { mounted.current = false; request.current++; if (token.current) token.current.value = ''; };
  }, []);
  return <section className="provider-connection calendar-settings" aria-label="Discord connection">
    <div className="provider-heading"><h4 className="settings-section-title"><span className="brand-icon brand-icon-compact" aria-hidden="true"><img src={brand} alt="" draggable={false} /></span>Discord</h4>{pending ? <span role="status">{pending === 'connect' ? 'Connecting...' : pending === 'disconnect' ? 'Disconnecting...' : 'Loading'}</span> : state ? <ConnectionStatus connected={state.connected} /> : <span role="status">Unavailable</span>}</div>
    <p className="setting-detail">Read-only access to DMs, guilds, channels and friends. Ada cannot send messages or change your account.</p>
    {state?.connected && state.account && <p className="setting-detail">Connected as {state.account.displayName || state.account.username}.</p>}
    <p className="setting-detail">Discord does not support automation of normal user accounts. Connecting may put your account at risk.</p>
    <div className="calendar-actions">
      <TextButton disabled={Boolean(pending) || !state} onClick={() => { clearToken(); setError(''); setSetup(true); }}>{state?.connected ? 'Replace Discord token' : 'Connect Discord'}</TextButton>
      {state?.connected && <TextButton disabled={Boolean(pending)} onClick={() => { clearToken(); void act({ action: 'disconnect' }); }}>Disconnect</TextButton>}
      {!state && !pending && <TextButton onClick={() => void act()}>Retry</TextButton>}
    </div>
    {!setup && (error || state?.error) && <InlineNotice tone="warning">{error || 'Discord needs attention. Reconnect to check your access.'}</InlineNotice>}
    {setup && <Dialog title="Connect Discord" onClose={closeSetup}><div className="calendar-settings">
      <p className="setting-detail" id={detailsId}>Your token is encrypted for your Windows account on the Ada server. Discord content you ask Ada to read can enter task history and the selected model's context.</p>
      <form className="provider-connect" aria-busy={pending === 'connect'} onSubmit={event => {
        event.preventDefault(); const value = token.current?.value.trim() ?? ''; clearToken();
        if (pending || !value) return;
        void act({ action: 'connect', token: value });
      }}>
        <label htmlFor={inputId}>Discord account token</label>
        <input ref={attachToken} id={inputId} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby={detailsId} disabled={Boolean(pending)} onChange={event => setHasToken(Boolean(event.currentTarget.value.trim()))} />
        <div className="calendar-actions"><TextButton type="submit" disabled={Boolean(pending) || !hasToken}>{pending === 'connect' ? 'Connecting...' : 'Connect'}</TextButton><TextButton onClick={closeSetup}>Cancel</TextButton></div>
      </form>
      {error && <InlineNotice tone="warning">{error}</InlineNotice>}
    </div></Dialog>}
  </section>;
}
