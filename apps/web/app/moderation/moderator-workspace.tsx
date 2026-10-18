'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../lib/api';

type AssignedCase = { id: string; caseNumber: string; name: string; age: string; region: string; lastSeen: string; status: string };

export default function ModeratorWorkspace() {
  const [items, setItems] = useState<AssignedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/moderation/cases`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { router.replace('/auth/login?next=%2Fmoderation'); return; }
        if (!response.ok) throw new Error(result.error || 'Unable to load assigned cases.');
        setItems(result.items);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load assigned cases.'))
      .finally(() => setLoading(false));
  }, [router]);

  return <div className="module-page">
    <div className="page-header"><div><p className="eyebrow">MODERATOR WORKSPACE</p><h1>Assigned cases</h1><p>Case access is limited to assignments accepted by this account.</p></div></div>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {loading ? <div className="empty-state"><p>Loading assigned cases...</p></div> : !error && items.length ? <div className="table-shell"><table><thead><tr><th>Case reference</th><th>Person</th><th>Region</th><th>Last seen</th><th>Status</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><span className="case-badge">{item.caseNumber}</span></td><td>{item.name}{item.age && item.age !== 'Unknown' ? `, age ${item.age}` : ''}</td><td>{item.region}</td><td>{item.lastSeen}</td><td>{item.status}</td><td><Link className="moderator-open-link" href={`/moderation/cases/${encodeURIComponent(item.id)}`}>Open case</Link></td></tr>)}</tbody></table></div> : !error ? <div className="empty-state"><h3>No case assignments</h3><p>Cases assigned to your account will appear here after you accept an invitation.</p></div> : null}
  </div>;
}
