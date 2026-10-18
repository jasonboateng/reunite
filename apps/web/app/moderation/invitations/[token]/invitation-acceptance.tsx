'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../../lib/api';

type InvitationInfo = { email: string; caseNumber: string; personName: string; expiresAt: string };

export default function InvitationAcceptance({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/moderation/invitations/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'This invitation is unavailable.');
        setInvitation(result);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'This invitation is unavailable.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/moderation/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to accept this invitation.');
      router.push('/moderation');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to accept this invitation.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="module-page family-login-page invitation-accept-page">
    <p className="eyebrow">REUNITE · MODERATOR INVITATION</p>
    <h1>Join a case review team</h1>
    {loading ? <p>Checking invitation…</p> : invitation ? <>
      <p>You have been invited to support <strong>{invitation.personName}</strong> ({invitation.caseNumber}) as a moderator.</p>
      <div className="panel-card account-status"><strong>Invitation for {invitation.email}</strong><span>This grants access to this case only. Invitation expires {new Date(invitation.expiresAt).toLocaleString()}.</span></div>
      <form className="form-panel family-auth-form" onSubmit={accept}>
        <div className="field"><label htmlFor="invite-name">Your name <span className="field-hint">Enter this if you are creating a new REUNITE account</span></label><input id="invite-name" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="field"><label htmlFor="invite-password">Create a password or enter your current account password</label><input id="invite-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /><span className="field-hint">At least 12 characters. If you already have an account, enter its current password.</span></div>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Accepting invitation…' : 'Accept and open assigned cases'}</button>
      </form>
    </> : <div className="empty-state"><h2>Invitation unavailable</h2><p>{error}</p></div>}
    {error && invitation ? <p className="status-message error" role="alert">{error}</p> : null}
    <Link href="/" className="text-link">Back to REUNITE</Link>
  </section>;
}
