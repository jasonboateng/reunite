'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../../../lib/api';

type Invitation = { id: string; email: string; status: 'pending' | 'accepted' | 'revoked' | 'expired'; createdAt: string; expiresAt: string; acceptedAt?: string };
type CaseInfo = { id: string; caseNumber: string; name: string };

export default function ModeratorManager({ caseId }: { caseId: string }) {
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [items, setItems] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const router = useRouter();
  const endpoint = `${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}/moderators`;

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { credentials: 'include' });
      if (response.status === 401) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/family/cases/${caseId}/moderators`)}`);
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load case moderators.');
      setCaseInfo(result.case);
      setItems(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load case moderators.');
    } finally {
      setLoading(false);
    }
  }, [caseId, endpoint, router]);

  useEffect(() => { void load(); }, [load]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setInviteUrl('');
    try {
      const response = await fetch(`${endpoint}/invitations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to invite this moderator.');
      setEmail('');
      if (result.inviteUrl) {
        setInviteUrl(result.inviteUrl);
        setNotice(result.emailSent ? 'Invitation email sent. You can also copy the case-specific link below.' : 'Invitation created, but email delivery is not configured or failed. Copy the link and send it to the invited person.');
      } else {
        setNotice('Existing moderator assigned to this case.');
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to invite this moderator.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(invitationId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${endpoint}/invitations/${encodeURIComponent(invitationId)}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Unable to revoke this invitation.');
      }
      setInviteUrl('');
      setNotice('Moderator access removed. This account can no longer access the case.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to revoke this invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice('Invitation link copied. Send it only to the person you invited.');
    } catch {
      setNotice('Copy was blocked by this browser. Select and copy the invitation link below.');
    }
  }

  return <div className="module-page moderator-manager-page">
    <Link href="/family/dashboard" className="back-link"> Family dashboard</Link>
    <div className="page-header"><div><p className="eyebrow">FAMILY CASE - MODERATORS</p><h1>Manage case access</h1><p>{caseInfo ? `${caseInfo.name} - ${caseInfo.caseNumber}` : caseId}</p></div></div>
    <div className="prototype-banner" role="note"><strong>Access is limited to this case.</strong><span>Invited moderators can view assigned case information. The invitation expires after 7 days. You can revoke pending invitations or remove an accepted moderator's access at any time.</span></div>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {notice ? <p className="status-message" role="status">{notice}</p> : null}

    <form className="form-panel moderator-invite-form" onSubmit={invite}>
      <div className="section-heading"><p className="eyebrow">ADD A MODERATOR</p><h2>Invite by email</h2></div>
      <div className="field"><label htmlFor="moderator-email">Moderator email address</label><input id="moderator-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Working...' : 'Create invitation'}</button>
      {inviteUrl ? <div className="invite-link-panel"><label htmlFor="invite-link">One-time invitation link</label><div><input id="invite-link" readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="secondary-button" onClick={() => void copyLink()}>Copy link</button></div><p>This link grants access to this case after the recipient accepts it. It can be used once and expires in 7 days.</p></div> : null}
    </form>

    <section className="moderator-list-section"><div className="section-heading"><p className="eyebrow">CASE ACCESS</p><h2>Invitations and moderators</h2></div>
      {loading ? <div className="empty-state"><p>Loading case access...</p></div> : items.length ? <div className="table-shell"><table><thead><tr><th>Email</th><th>Status</th><th>Invited</th><th>Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.email}</td><td><span className={`status-badge ${item.status === 'accepted' ? 'active' : item.status === 'pending' ? 'review' : 'urgent'}`}>{item.status}</span></td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{item.status === 'pending' || item.status === 'accepted' ? <button type="button" className="invite-revoke-button" disabled={busy} onClick={() => void revoke(item.id)}>{item.status === 'accepted' ? 'Remove access' : 'Revoke invite'}</button> : item.acceptedAt ? `Accepted ${new Date(item.acceptedAt).toLocaleDateString()}` : '-'}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>No moderators assigned</h3><p>Create an invitation for someone to support this case.</p></div>}
    </section>
  </div>;
}
