'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../../lib/api';
import Image from 'next/image';

type CaseInfo = { id: string; caseNumber: string; name: string; age: string; region: string; lastSeen: string; location: string; description: string; reporter: string; contact: string; evidence: string[]; imageAssetId?: string; visibility: string; status: string; createdAt: string; publicProfile?: { fields: string[]; summary: string; requested: boolean } };
type Decision = 'changes-requested' | 'declined';

export default function IntakeReview({ caseId }: { caseId: string }) {
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/review/cases/${encodeURIComponent(caseId)}`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { router.replace(`/auth/login?next=${encodeURIComponent(`/review/cases/${caseId}`)}`); return; }
        if (!response.ok) throw new Error(result.error || 'Unable to open this report.');
        setCaseInfo(result.case);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to open this report.'))
      .finally(() => setLoading(false));
  }, [caseId, router]);

  async function decide(decision: 'publish' | Decision, note?: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/review/cases/${encodeURIComponent(caseId)}/decision`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save the review decision.');
      setNotice(result.message);
      if (decision === 'publish') setCaseInfo((current) => current ? { ...current, status: 'Active', visibility: 'public' } : current);
      else setCaseInfo(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save the review decision.'); }
    finally { setBusy(false); }
  }

  function submitNoteDecision(event: FormEvent<HTMLFormElement>, decision: Decision) {
    event.preventDefault();
    const note = new FormData(event.currentTarget).get('note');
    void decide(decision, typeof note === 'string' ? note : '');
  }

  return <div className="module-page intake-review-page"><Link href="/review" className="back-link"> Review queue</Link>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {notice ? <p className="status-message" role="status">{notice} {caseInfo ? null : <Link href="/review">Return to queue</Link>}</p> : null}
    {loading ? <div className="empty-state">Loading report...</div> : null}
    {caseInfo ? <>
      <div className="page-header"><div><p className="eyebrow">PRIVATE INTAKE REVIEW - {caseInfo.caseNumber}</p><h1>{caseInfo.name}</h1><p>{caseInfo.region} - Submitted {new Date(caseInfo.createdAt).toLocaleDateString()}</p></div></div>
      <div className="review-private-warning"><strong>Confidential report information</strong><span>Use only for case review. Contact details, evidence, and private notes are never included in public case data.</span></div>
      <section className="panel-card intake-report-card"><div className="section-heading"><p className="eyebrow">FAMILY REPORT</p><h2>Reported details</h2></div>{caseInfo.imageAssetId ? <Image className="review-sighting-photo" src={`${API_BASE_URL}/api/media/${encodeURIComponent(caseInfo.imageAssetId)}`} alt={`Private case photo of ${caseInfo.name}`} width={800} height={600} unoptimized /> : null}<dl className="intake-facts"><div><dt>Age</dt><dd>{caseInfo.age}</dd></div><div><dt>Last seen</dt><dd>{caseInfo.lastSeen}</dd></div><div><dt>Last known area</dt><dd>{caseInfo.location}</dd></div><div><dt>Reporter</dt><dd>{caseInfo.reporter}</dd></div><div><dt>Family contact</dt><dd>{caseInfo.contact}</dd></div></dl><h3>Private report notes</h3><p className="case-description">{caseInfo.description}</p>{caseInfo.evidence.length ? <><h3>Submitted evidence references</h3><ul className="intake-evidence">{caseInfo.evidence.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></> : null}</section>
      <section className="panel-card intake-consent-card"><div className="section-heading"><p className="eyebrow">PUBLICATION CONSENT</p><h2>Family-selected public details</h2></div>
        {caseInfo.publicProfile?.requested ? <><p>Family requested publication of: <strong>{caseInfo.publicProfile.fields.join(', ')}</strong>.</p>{caseInfo.publicProfile.fields.includes('summary') ? <p className="case-description">{caseInfo.publicProfile.summary}</p> : null}</> : <p>The family has not requested publication. This report can be sent back for changes or declined, but cannot be published.</p>}
        <p>Only the selected fields would be visible publicly. Report notes, family contact, evidence, and exact location remain private.</p>
      </section>
      <section className="intake-decision-section"><div className="section-heading"><p className="eyebrow">REVIEW DECISION</p><h2>Record an outcome</h2></div>
        <button className="primary-button" type="button" disabled={busy || caseInfo.status !== 'Review' || !caseInfo.publicProfile?.requested || !caseInfo.publicProfile.fields.includes('name')} onClick={() => void decide('publish')}>{busy ? 'Saving...' : caseInfo.status === 'Active' ? 'Published' : 'Verify and publish selected details'}</button>
        {(!caseInfo.publicProfile?.requested || !caseInfo.publicProfile.fields.includes('name')) ? <p className="field-hint">Publication stays disabled until the family requests it and selects the person's name.</p> : null}
        <div className="intake-decision-grid">{(['changes-requested', 'declined'] as const).map((decision) => <form className="panel-card intake-note-form" key={decision} onSubmit={(event) => submitNoteDecision(event, decision)}><h3>{decision === 'declined' ? 'Decline this report' : 'Request family changes'}</h3><p>{decision === 'declined' ? 'Keep the report private. The family can edit it and request another review.' : 'Keep the report private and explain what the family should correct.'}</p><div className="field"><label htmlFor={`${decision}-note`}>Private reason shown to the family</label><textarea id={`${decision}-note`} name="note" minLength={10} maxLength={1000} required /></div><button className={decision === 'declined' ? 'case-close-button' : 'secondary-button'} type="submit" disabled={busy}>{busy ? 'Saving...' : decision === 'declined' ? 'Decline report' : 'Request changes'}</button></form>)}</div>
      </section>
    </> : null}
  </div>;
}
