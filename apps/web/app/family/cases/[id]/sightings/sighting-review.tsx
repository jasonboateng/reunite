'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../../../lib/api';
import Image from 'next/image';

type Sighting = {
  id: string;
  description: string;
  observedAt: string;
  location: string;
  latitude: number;
  longitude: number;
  status: 'pending-family-review' | 'approved' | 'rejected';
  public: boolean;
  imageAssetId?: string;
  submittedAt: string;
};
type CaseInfo = { id: string; caseNumber: string; name: string };

function statusLabel(status: Sighting['status']) {
  if (status === 'pending-family-review') return 'Pending family review';
  return status === 'approved' ? 'Approved' : 'Rejected';
}

export default function SightingReview({ caseId }: { caseId: string }) {
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [items, setItems] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const router = useRouter();

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}/sightings`, { credentials: 'include' });
      if (response.status === 401) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/family/cases/${caseId}/sightings`)}`);
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load sightings.');
      setCaseInfo(result.case);
      setItems(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load sightings.');
    } finally {
      setLoading(false);
    }
  }, [caseId, router]);

  useEffect(() => { void load(); }, [load]);

  async function update(sightingId: string, action: 'approve' | 'reject' | 'publish' | 'hide') {
    setBusyId(sightingId);
    setError('');
    setNotice('');
    try {
      const visibilityAction = action === 'publish' || action === 'hide';
      const response = await fetch(
        `${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}/sightings/${encodeURIComponent(sightingId)}/${visibilityAction ? 'visibility' : 'review'}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visibilityAction ? { public: action === 'publish' } : { decision: action === 'approve' ? 'approved' : 'rejected' })
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update this sighting.');
      setItems((current) => current.map((item) => item.id === sightingId ? { ...item, status: result.status, public: result.public } : item));
      setNotice(visibilityAction ? (result.public ? 'Sighting approved for public viewing.' : 'Sighting removed from public viewing.') : (result.status === 'approved' ? 'Sighting approved. Choose separately whether to make it public.' : 'Sighting rejected.'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this sighting.');
    } finally {
      setBusyId('');
    }
  }

  const pending = items.filter((item) => item.status === 'pending-family-review');
  const reviewed = items.filter((item) => item.status !== 'pending-family-review');

  return <div className="module-page sighting-review-page">
    <Link href="/family/dashboard" className="back-link">← Family dashboard</Link>
    <div className="page-header"><div><p className="eyebrow">FAMILY CASE · SIGHTING REVIEW</p><h1>{caseInfo ? `${caseInfo.name}` : 'Sighting review'}</h1><p>{caseInfo?.caseNumber || caseId} · Review incoming observations for this case.</p></div></div>
    <div className="prototype-banner" role="note"><strong>Location privacy</strong><span>Coordinates are visible only in this family workspace. Approving a sighting and publishing it are separate decisions; coordinates are never included in the public view.</span></div>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {notice ? <p className="status-message" role="status">{notice}</p> : null}
    {loading ? <div className="empty-state"><p>Loading sightings…</p></div> : <>
      <section className="family-sighting-section"><div className="section-heading"><p className="eyebrow">NEEDS YOUR DECISION</p><h2>Pending sightings <span className="queue-count">{pending.length}</span></h2></div>
        {pending.length ? <div className="sighting-review-list">{pending.map((item) => <article className="panel-card sighting-review-card" key={item.id}>
          <div className="sighting-review-top"><span className="case-badge">{item.id}</span><span className="status-badge review">{statusLabel(item.status)}</span></div>
          <p className="review-observation">{item.description}</p>
          {item.imageAssetId ? <Image className="review-sighting-photo" src={`${API_BASE_URL}/api/media/${encodeURIComponent(item.imageAssetId)}`} alt="Sighting evidence photo" width={800} height={450} unoptimized /> : null}
          <dl className="sighting-review-facts"><div><dt>Observed</dt><dd>{new Date(item.observedAt).toLocaleString()}</dd></div><div><dt>Place</dt><dd>{item.location}</dd></div><div><dt>Coordinates · private</dt><dd>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</dd></div><div><dt>Submitted</dt><dd>{new Date(item.submittedAt).toLocaleString()}</dd></div></dl>
          <div className="sighting-review-actions"><button className="primary-button" disabled={busyId === item.id} onClick={() => void update(item.id, 'approve')}>{busyId === item.id ? 'Saving…' : 'Approve sighting'}</button><button className="secondary-button review-reject-button" disabled={busyId === item.id} onClick={() => void update(item.id, 'reject')}>Reject</button></div>
        </article>)}</div> : <div className="empty-state"><h3>No sightings waiting for review</h3><p>New citizen reports for this case will appear here.</p></div>}
      </section>
      <section className="family-sighting-section"><div className="section-heading"><p className="eyebrow">PREVIOUS DECISIONS</p><h2>Reviewed sightings <span className="queue-count">{reviewed.length}</span></h2></div>
        {reviewed.length ? <div className="sighting-review-list">{reviewed.map((item) => <article className="panel-card sighting-review-card" key={item.id}>
          <div className="sighting-review-top"><span className="case-badge">{item.id}</span><span className={`status-badge ${item.status === 'approved' ? 'active' : 'urgent'}`}>{statusLabel(item.status)}</span></div>
          <p className="review-observation">{item.description}</p>
          {item.imageAssetId ? <Image className="review-sighting-photo" src={`${API_BASE_URL}/api/media/${encodeURIComponent(item.imageAssetId)}`} alt="Sighting evidence photo" width={800} height={450} unoptimized /> : null}
          <dl className="sighting-review-facts"><div><dt>Observed</dt><dd>{new Date(item.observedAt).toLocaleString()}</dd></div><div><dt>Place</dt><dd>{item.location}</dd></div><div><dt>Coordinates · private</dt><dd>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</dd></div></dl>
          {item.status === 'approved' ? <div className="sighting-review-actions"><span className={`visibility-state ${item.public ? 'is-public' : ''}`}>{item.public ? 'Public sighting' : 'Private sighting'}</span><button className={item.public ? 'secondary-button' : 'primary-button'} disabled={busyId === item.id} onClick={() => void update(item.id, item.public ? 'hide' : 'publish')}>{busyId === item.id ? 'Saving…' : item.public ? 'Remove from public view' : 'Make public'}</button></div> : null}
        </article>)}</div> : <div className="empty-state"><p>Reviewed sightings will appear here.</p></div>}
      </section>
    </>}
  </div>;
}
