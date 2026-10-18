'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../lib/api';

type QueueCase = { id: string; caseNumber: string; name: string; age: string; region: string; lastSeen: string; visibility: string; publicProfile?: { requested?: boolean }; createdAt: string };

export default function ReviewerWorkspace() {
  const [items, setItems] = useState<QueueCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/review/cases`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { router.replace('/auth/login?next=%2Freview'); return; }
        if (!response.ok) throw new Error(result.error || 'Unable to load the report review queue.');
        setItems(result.items);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load the report review queue.'))
      .finally(() => setLoading(false));
  }, [router]);

  return <div className="module-page reviewer-queue-page">
    <div className="page-header"><div><p className="eyebrow">INTAKE REVIEW</p><h1>Unassigned report queue</h1><p>Only reports awaiting review without an accepted family moderator assignment appear here.</p></div></div>
    <div className="prototype-banner"><strong>Private review workspace</strong><span>Review report evidence and family consent. Publishing is available only when the family has explicitly selected public details and requested publication.</span></div>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {loading ? <div className="empty-state">Loading reports…</div> : !error && items.length ? <div className="table-shell"><table><thead><tr><th>Reference</th><th>Person</th><th>Region</th><th>Reported</th><th>Family publication request</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><span className="case-badge">{item.caseNumber}</span></td><td>{item.name}{item.age && item.age !== 'Unknown' ? `, age ${item.age}` : ''}</td><td>{item.region}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td><td>{item.publicProfile?.requested ? <span className="status-badge active">Requested</span> : <span className="status-badge review">Not requested</span>}</td><td><Link className="moderator-open-link" href={`/review/cases/${encodeURIComponent(item.id)}`}>Review report</Link></td></tr>)}</tbody></table></div> : !error ? <div className="empty-state"><h3>No reports awaiting unassigned review</h3><p>New private family reports will appear here unless a family has assigned a moderator.</p></div> : null}
  </div>;
}
