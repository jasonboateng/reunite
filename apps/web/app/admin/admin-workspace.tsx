'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../lib/api';

type OverviewMetrics = {
  users: number;
  reviewers: number;
  pendingCases: number;
  publicCases: number;
  foundCases: number;
  auditEventsLast24Hours: number;
  moderationActions: number;
};

type Overview = {
  generatedAt: string;
  metrics: OverviewMetrics;
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: 'family' | 'moderator' | 'reviewer' | 'admin';
  roles?: Array<'family' | 'moderator' | 'reviewer' | 'admin'>;
  createdAt: string;
};

type AuditEntry = {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  email?: string;
  roles?: Array<'family' | 'moderator' | 'reviewer' | 'admin'>;
  createdAt: string;
};

export default function AdminWorkspace() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const router = useRouter();

  async function loadAdminData() {
    const [overviewResponse, usersResponse, auditResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/admin/overview`, { credentials: 'include' }),
      fetch(`${API_BASE_URL}/api/admin/users`, { credentials: 'include' }),
      fetch(`${API_BASE_URL}/api/admin/audit?limit=20`, { credentials: 'include' })
    ]);

    if (overviewResponse.status === 401 || usersResponse.status === 401 || auditResponse.status === 401) {
      router.replace('/auth/login?next=%2Fadmin');
      return;
    }

    if (overviewResponse.status === 403 || usersResponse.status === 403 || auditResponse.status === 403) {
      throw new Error('This account does not have administrator access.');
    }

    if (!overviewResponse.ok || !usersResponse.ok || !auditResponse.ok) {
      throw new Error('Unable to load the administrator console.');
    }

    const overviewData = await overviewResponse.json();
    const usersData = await usersResponse.json();
    const auditData = await auditResponse.json();

    setOverview(overviewData);
    setUsers(usersData.items ?? []);
    setAuditLog(auditData.items ?? []);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        await loadAdminData();
      } catch (cause) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load the administrator console.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [router]);

  async function toggleReviewerAccess(userId: string, enabled: boolean) {
    setUpdatingUserId(userId);
    setError('');

    const response = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}/reviewer-access`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });

    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      router.replace('/auth/login?next=%2Fadmin');
      return;
    }

    if (!response.ok) {
      throw new Error(result.error || 'Unable to update reviewer access.');
    }

    setUsers((current) => current.map((user) => user.id === userId ? { ...user, roles: result.user.roles } : user));
    setOverview((current) => {
      if (!current) return current;
      const nextReviewers = Math.max(0, current.metrics.reviewers + (enabled ? 1 : -1));
      return { ...current, metrics: { ...current.metrics, reviewers: nextReviewers } };
    });
    await loadAdminData();
    setUpdatingUserId(null);
  }

  const metrics = overview?.metrics;

  return <div className="module-page">
    <div className="page-header">
      <div>
        <p className="eyebrow">ADMIN CONSOLE</p>
        <h1>Platform operations</h1>
        <p>Operational oversight, audit visibility, and reviewer-access management.</p>
      </div>
      <Link className="secondary-button" href="/auth/login?next=%2Fadmin">Refresh access</Link>
    </div>

    <div className="prototype-banner" role="note">
      <strong>Operator-managed admin access</strong>
      <span>Admin privileges remain provisioned only through the REUNITE operator CLI. This console never grants or revokes administrator roles.</span>
    </div>

    {error ? <p className="status-message error" role="alert">{error}</p> : null}

    {loading ? <div className="empty-state"><p>Loading administrator console…</p></div> : null}

    {!loading && metrics ? <>
      <div className="stats-grid">
        <div className="stat-card blue"><strong>{metrics.users}</strong><span>Total accounts</span></div>
        <div className="stat-card green"><strong>{metrics.reviewers}</strong><span>Reviewers</span></div>
        <div className="stat-card amber"><strong>{metrics.pendingCases}</strong><span>Pending review</span></div>
        <div className="stat-card slate"><strong>{metrics.publicCases}</strong><span>Public cases</span></div>
        <div className="stat-card red"><strong>{metrics.foundCases}</strong><span>Found cases</span></div>
        <div className="stat-card teal"><strong>{metrics.auditEventsLast24Hours}</strong><span>Audit events (24h)</span></div>
      </div>

      <section className="admin-panel">
        <div className="section-heading">
          <p className="eyebrow">REVIEWER ACCESS</p>
          <h2>Reviewer management</h2>
        </div>

        {users.length ? <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Role set</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const roles = user.roles ?? [user.role];
                const hasReviewer = roles.includes('reviewer');
                return <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong><br />
                    <span>{user.email}</span>
                  </td>
                  <td>{roles.join(', ') || 'family'}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      className={hasReviewer ? 'secondary-button' : 'primary-button'}
                      disabled={updatingUserId === user.id}
                      onClick={() => {
                        void toggleReviewerAccess(user.id, !hasReviewer).catch((cause) => {
                          const message = cause instanceof Error ? cause.message : 'Unable to update reviewer access.';
                          setError(message);
                          setUpdatingUserId(null);
                        });
                      }}
                    >
                      {updatingUserId === user.id ? 'Saving…' : hasReviewer ? 'Remove reviewer access' : 'Grant reviewer access'}
                    </button>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div> : <div className="empty-state"><h3>No reviewer accounts</h3><p>Reviewer access is granted through the operator CLI for trusted accounts.</p></div>}
      </section>

      <section className="admin-panel">
        <div className="section-heading">
          <p className="eyebrow">AUDIT LOG</p>
          <h2>Recent system actions</h2>
        </div>

        {auditLog.length ? <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((entry) => <tr key={entry.id}>
                <td>{new Date(entry.createdAt).toLocaleString()}</td>
                <td>{entry.action}</td>
                <td>{entry.actorId === 'operator-cli' ? 'Operator CLI' : entry.actorId}</td>
                <td>{entry.entityType} / {entry.entityId}{entry.email ? ` · ${entry.email}` : ''}</td>
              </tr>)}
            </tbody>
          </table>
        </div> : <div className="empty-state"><h3>No audit events</h3><p>Platform actions will appear here once activity is recorded.</p></div>}
      </section>
    </> : null}
  </div>;
}
