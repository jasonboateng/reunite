'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../lib/api';

type FamilyCase = { id: string; caseNumber: string; name: string; age: string; region: string; lastSeen: string; status: string; reviewState?: string; reviewNote?: string; createdAt: string; pendingSightings: number; approvedSightings: number };
type FamilyUser = { name: string; email: string };

export function FamilyDashboard() {
  const [user, setUser] = useState<FamilyUser | null>(null);
  const [cases, setCases] = useState<FamilyCase[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const [accountResponse, casesResponse, notificationsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/family/cases`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/family/notifications`, { credentials: 'include' })
        ]);
        if (accountResponse.status === 401 || casesResponse.status === 401 || notificationsResponse.status === 401) {
          router.replace('/auth/login?next=%2Ffamily%2Fdashboard');
          return;
        }
        if (!accountResponse.ok || !casesResponse.ok || !notificationsResponse.ok) throw new Error('Unable to load your family workspace.');
        const account = await accountResponse.json();
        const result = await casesResponse.json();
        const notificationData = await notificationsResponse.json();
        setUser(account.user);
        setCases(result.items);
        setUnreadNotifications(notificationData.unreadCount);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Unable to load your family workspace.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  async function signOut() {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    router.push('/');
    router.refresh();
  }

  return <div className="module-page">
    <div className="page-header family-dashboard-heading"><div><p className="eyebrow">FAMILY WORKSPACE</p><h1>Your cases</h1><p>{user ? `Signed in as ${user.name} · ${user.email}` : 'Private cases belonging to your account'}</p></div><div className="family-dashboard-actions"><Link className="secondary-button" href="/family/profile">Profile</Link><Link className="secondary-button" href="/family/notifications">Notifications{unreadNotifications ? ` (${unreadNotifications})` : ''}</Link><Link className="primary-button" href="/family/cases/new">Create a case</Link></div></div>
    <div className="prototype-banner" role="note"><strong>Private family records</strong><span>Only cases submitted while signed in to this account appear here. All new reports remain private pending review.</span></div>
    <div className="stats-grid family-stats"><div className="stat-card blue"><strong>{loading ? '…' : cases.length}</strong><span>Your cases</span></div><div className="stat-card amber"><strong>{loading ? '…' : cases.filter((item) => item.status === 'Review').length}</strong><span>Cases pending review</span></div><div className="stat-card slate"><strong>{loading ? '…' : cases.reduce((sum, item) => sum + item.pendingSightings, 0)}</strong><span>Sightings awaiting review</span></div><div className="stat-card green"><strong>{loading ? '…' : cases.reduce((sum, item) => sum + item.approvedSightings, 0)}</strong><span>Approved sightings</span></div></div>
    <section className="family-case-list"><div className="section-heading"><p className="eyebrow">CASE MANAGEMENT</p><h2>Recent cases</h2></div>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
      {loading ? <div className="empty-state"><p>Loading your cases…</p></div> : !error && cases.length ? <div className="table-shell"><table><thead><tr><th>Case reference</th><th>Person</th><th>Region</th><th>Last seen</th><th>Status</th><th>Case tools</th></tr></thead><tbody>{cases.map((item) => <tr key={item.id}><td><span className="case-badge">{item.caseNumber}</span></td><td>{item.name}{item.age && item.age !== 'Unknown' ? `, age ${item.age}` : ''}</td><td>{item.region}</td><td>{item.lastSeen}</td><td><span className={`status-badge ${item.status === 'Found' ? 'found' : item.status === 'Urgent' ? 'urgent' : item.status === 'Active' ? 'active' : 'review'}`}>{item.status}</span>{item.reviewState === 'changes-requested' || item.reviewState === 'declined' ? <small className="family-review-note"><strong>{item.reviewState === 'declined' ? 'Review declined' : 'Changes requested'}:</strong> {item.reviewNote}</small> : null}</td><td className="family-case-tools"><Link href={`/family/cases/${encodeURIComponent(item.id)}/edit`}>{item.status === 'Found' ? 'Case details' : 'Edit / close'}</Link>{item.status !== 'Found' ? <><Link href={`/family/cases/${encodeURIComponent(item.id)}/sightings`}>{item.pendingSightings} sightings</Link><Link href={`/family/cases/${encodeURIComponent(item.id)}/flyer`}>Create flyer</Link><Link href={`/family/cases/${encodeURIComponent(item.id)}/public-profile`}>Public details</Link><Link href={`/family/cases/${encodeURIComponent(item.id)}/moderators`}>Moderators</Link></> : null}</td></tr>)}</tbody></table></div> : !error ? <div className="empty-state"><h3>No cases in your account yet</h3><p>Reports you submit will be listed here.</p><Link className="text-link" href="/family/cases/new">Start a case report →</Link></div> : null}
    </section>
    <button className="family-signout" type="button" onClick={() => void signOut()}>Sign out</button>
  </div>;
}

export function CreateFamilyCase() {
  return <section className="module-page family-login-page">
    <p className="eyebrow">NEW CASE</p>
    <h1>Submit a missing person report</h1>
    <p>Your report is saved privately under your family account and remains pending review.</p>
    <Link className="primary-button" href="/report">Continue to report form</Link>
  </section>;
}
