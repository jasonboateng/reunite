'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../../../lib/api';
import ImageUpload from '../../../../components/image-upload';

type FamilyCase = { id: string; caseNumber: string; name: string; age: string; region: string; lastSeen: string; description: string; contact: string; status: string; visibility: string; imageAssetId?: string };

export default function FamilyCaseEditor({ caseId }: { caseId: string }) {
  const [caseInfo, setCaseInfo] = useState<FamilyCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [imageAssetId, setImageAssetId] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { router.replace(`/auth/login?next=${encodeURIComponent(`/family/cases/${caseId}/edit`)}`); return; }
        if (!response.ok) throw new Error(result.error || 'Unable to load this case.');
        setCaseInfo(result.case);
        setImageAssetId(result.case.imageAssetId ?? '');
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load this case.'))
      .finally(() => setLoading(false));
  }, [caseId, router]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caseInfo) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), age: form.get('age'), region: form.get('region'), lastSeen: form.get('lastSeen'), description: form.get('description'), contact: form.get('contact'), imageAssetId: imageAssetId || (caseInfo.imageAssetId ? null : undefined) })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save this case.');
      setNotice(result.message);
      setCaseInfo((current) => current ? { ...current, ...Object.fromEntries(form.entries()) as Partial<FamilyCase>, imageAssetId: imageAssetId || undefined, status: result.case.status, visibility: result.case.visibility } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save this case.'); }
    finally { setBusy(false); }
  }

  async function markFound() {
    if (!window.confirm('Mark this person as found? This closes public sighting submissions and removes the case from public search.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}/status`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Found' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to close this case.');
      setCaseInfo((current) => current ? { ...current, status: 'Found', visibility: 'private' } : current);
      setNotice(result.message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to close this case.'); }
    finally { setBusy(false); }
  }

  return <div className="module-page family-case-edit-page">
    <Link href="/family/dashboard" className="back-link"> Your cases</Link>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {notice ? <p className="status-message" role="status">{notice}</p> : null}
    {loading ? <div className="empty-state">Loading case details...</div> : null}
    {caseInfo ? <>
      <div className="page-header"><div><p className="eyebrow">CASE MANAGEMENT</p><h1>{caseInfo.status === 'Found' ? 'Case closed' : 'Update case details'}</h1><p>{caseInfo.caseNumber} - {caseInfo.name}</p></div></div>
      {caseInfo.status === 'Found' ? <div className="prototype-banner"><strong>Marked found</strong><span>This case is closed. If it was already public, its family-approved details remain visible in search with a Found label. Private cases stay private.</span></div> : <>
        <div className="prototype-banner"><strong>Updates need a fresh review</strong><span>Saving changes removes a published case from public search and withdraws its prior publication request. You can select public details and request publication again afterward.</span></div>
        <form className="panel-card family-case-edit-form" onSubmit={(event) => void save(event)}>
          <div className="field"><label htmlFor="case-name">Person's name</label><input id="case-name" name="name" required maxLength={120} defaultValue={caseInfo.name} /></div>
          <div className="field"><label htmlFor="case-age">Age</label><input id="case-age" name="age" required maxLength={3} defaultValue={caseInfo.age} /><small>Enter an age from 0 to 120, or "Unknown".</small></div>
          <div className="field"><label htmlFor="case-region">Region</label><input id="case-region" name="region" required maxLength={100} defaultValue={caseInfo.region} /></div>
          <div className="field"><label htmlFor="case-last-seen">Last seen details</label><input id="case-last-seen" name="lastSeen" required maxLength={200} defaultValue={caseInfo.lastSeen} /></div>
          <div className="field"><label htmlFor="case-description">Private report notes</label><textarea id="case-description" name="description" required minLength={10} maxLength={5000} defaultValue={caseInfo.description} /></div>
          <div className="field"><label htmlFor="case-contact">Family contact</label><input id="case-contact" name="contact" required maxLength={100} defaultValue={caseInfo.contact} /></div>
          <ImageUpload kind="case-photo" caseId={caseId} value={imageAssetId} existingImageUrl={caseInfo.imageAssetId ? `${API_BASE_URL}/api/media/${encodeURIComponent(caseInfo.imageAssetId)}` : undefined} onChange={setImageAssetId} />
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save case details'}</button>
        </form>
        <section className="case-close-section"><div><p className="eyebrow">RESOLUTION</p><h2>Person has been found?</h2><p>Already-public cases stay visible with a Found label for transparency. Private reports stay private. New sightings close.</p></div><button className="case-close-button" type="button" onClick={() => void markFound()} disabled={busy}>Mark as found</button></section>
      </>}
    </> : null}
  </div>;
}
