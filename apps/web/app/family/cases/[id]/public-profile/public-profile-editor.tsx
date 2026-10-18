'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../../../lib/api';

type CaseData = { id: string; caseNumber: string; name: string; age: string; region: string; lastSeen: string; status: string; visibility: string; imageAssetId?: string; publicProfile?: { fields: string[]; summary: string; requested: boolean } };
const choices = [
  ['name', 'Person's name'], ['age', 'Age'], ['region', 'Region'], ['lastSeen', 'Last seen details'], ['summary', 'Family-written summary'], ['photo', 'Missing person photo']
] as const;

export default function PublicProfileEditor({ caseId }: { caseId: string }) {
  const [caseInfo, setCaseInfo] = useState<CaseData | null>(null);
  const [fields, setFields] = useState<string[]>(['name']);
  const [summary, setSummary] = useState('');
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}/public-profile`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { router.replace(`/auth/login?next=${encodeURIComponent(`/family/cases/${caseId}/public-profile`)}`); return; }
        if (!response.ok) throw new Error(result.error || 'Unable to load public case settings.');
        setCaseInfo(result.case);
        if (result.case.publicProfile) {
          setFields(Array.isArray(result.case.publicProfile.fields) ? result.case.publicProfile.fields : ['name']);
          setSummary(typeof result.case.publicProfile.summary === 'string' ? result.case.publicProfile.summary : '');
          setRequested(result.case.publicProfile.requested === true);
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load public case settings.'))
      .finally(() => setLoading(false));
  }, [caseId, router]);

  function toggle(field: string) {
    if (field === 'name') return;
    setFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}/public-profile`, {
        method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, summary, requestPublication: requested })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save public case settings.');
      setNotice(result.message);
      setCaseInfo((current) => current ? { ...current, visibility: result.visibility } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save public case settings.'); }
    finally { setBusy(false); }
  }

  return <div className="module-page family-public-profile"><Link href="/family/dashboard" className="back-link"> Your cases</Link>
    {loading ? <div className="empty-state">Loading public profile settings...</div> : null}
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {notice ? <p className="status-message" role="status">{notice}</p> : null}
    {caseInfo ? <>
      <div className="page-header"><div><p className="eyebrow">PUBLIC CASE DETAILS</p><h1>Choose what people can see</h1><p>{caseInfo.caseNumber} - {caseInfo.name}</p></div></div>
      <div className="prototype-banner" role="note"><strong>Private until verified</strong><span>Your report, contact information, evidence, exact location, and sighting coordinates stay private. Only the fields selected below can appear on the public case page. An assigned moderator must verify and publish your request.</span></div>
      <form className="panel-card public-profile-form" onSubmit={(event) => void save(event)}>
        <fieldset className="public-profile-fields"><legend>Details to show publicly</legend>
          {choices.map(([value, label]) => <label key={value} className="check-row"><input type="checkbox" checked={fields.includes(value)} disabled={value === 'name' || (value === 'photo' && !caseInfo.imageAssetId)} onChange={() => toggle(value)} /><span>{label}{value === 'name' ? ' (required)' : value === 'photo' && !caseInfo.imageAssetId ? ' (upload a photo in case details first)' : ''}</span></label>)}
        </fieldset>
        {fields.includes('summary') ? <div className="field"><label htmlFor="public-summary">Family-written public summary</label><textarea id="public-summary" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={1000} minLength={10} required placeholder="Share only information you want visible to everyone." /><small>{summary.length}/1,000 characters</small></div> : null}
        <label className="check-row consent-row"><input type="checkbox" checked={requested} onChange={(event) => setRequested(event.target.checked)} /><span>I request publication of these selected details after moderator verification.</span></label>
        {caseInfo.visibility === 'public' ? <p className="status-message">This case is currently public. Changing these settings will make it private until an assigned moderator reviews and republishes it.</p> : null}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save public settings'}</button>
      </form>
    </> : null}
  </div>;
}
