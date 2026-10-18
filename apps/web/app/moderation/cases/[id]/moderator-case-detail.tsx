'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../../lib/api';
import Image from 'next/image';

type CaseInfo = { id: string; caseNumber: string; name: string; age: string; region: string; lastSeen: string; status: string; description: string; imageAssetId?: string; createdAt: string; visibility?: string; publicProfile?: { fields: string[]; summary: string; requested: boolean } };
type Sighting = { id: string; description: string; observedAt: string; location: string; latitude: number; longitude: number; status: string; public: boolean; submittedAt: string; imageAssetId?: string };
type Action = { id: string; type: 'sighting-assessment' | 'case-escalation'; sightingId?: string; assessment?: string; severity?: string; note: string; createdAt: string };

export default function ModeratorCaseDetail({ caseId }: { caseId: string }) {
  const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/moderation/cases/${encodeURIComponent(caseId)}`, { credentials: 'include' })
      .then(async (response) => {
        const result = await response.json();
        if (response.status === 401) { router.replace(`/auth/login?next=${encodeURIComponent(`/moderation/cases/${caseId}`)}`); return; }
        if (!response.ok) throw new Error(result.error || 'Unable to open this case.');
        setCaseInfo(result.case);
        setSightings(result.sightings);
        setActions(result.actions);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to open this case.'));
  }, [caseId, router]);

  async function submitAssessment(event: FormEvent<HTMLFormElement>, sightingId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(sightingId);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/moderation/cases/${encodeURIComponent(caseId)}/sightings/${encodeURIComponent(sightingId)}/reviews`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment: data.get('assessment'), note: data.get('note') })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save the review.');
      setActions((current) => [result.action, ...current]);
      form.reset();
      setNotice('Private moderator assessment saved. The family still decides whether to approve or publish the sighting.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the review.');
    } finally {
      setBusy('');
    }
  }

  async function submitEscalation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy('escalation');
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/moderation/cases/${encodeURIComponent(caseId)}/escalations`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: data.get('severity'), note: data.get('note') })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to record the escalation.');
      setActions((current) => [result.action, ...current]);
      form.reset();
      setNotice(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record the escalation.');
    } finally {
      setBusy('');
    }
  }

  async function publishCase() {
    setBusy('publication'); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/moderation/cases/${encodeURIComponent(caseId)}/publication`, {
        method: 'POST', credentials: 'include'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to publish this case.');
      setCaseInfo((current) => current ? { ...current, status: result.case.status, visibility: result.case.visibility } : current);
      setNotice(result.message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to publish this case.'); }
    finally { setBusy(''); }
  }

  const escalationActions = actions.filter((action) => action.type === 'case-escalation');
  return <div className="module-page moderator-case-page"><Link href="/moderation" className="back-link"> Assigned cases</Link>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {notice ? <p className="status-message" role="status">{notice}</p> : null}
    {caseInfo ? <>
      <div className="page-header"><div><p className="eyebrow">ASSIGNED CASE - MODERATOR ACCESS</p><h1>{caseInfo.name}</h1><p>{caseInfo.caseNumber} - {caseInfo.region} - {caseInfo.status}</p></div></div>
      <section className="panel-card moderator-case-information"><div className="section-heading"><p className="eyebrow">CASE INFORMATION</p><h2>Family report details</h2></div>{caseInfo.imageAssetId ? <Image className="review-sighting-photo" src={`${API_BASE_URL}/api/media/${encodeURIComponent(caseInfo.imageAssetId)}`} alt={`Private case photo of ${caseInfo.name}`} width={800} height={600} unoptimized /> : null}<div className="case-facts"><div><span>Age</span><strong>{caseInfo.age}</strong></div><div><span>Region</span><strong>{caseInfo.region}</strong></div><div><span>Last seen</span><strong>{caseInfo.lastSeen}</strong></div></div><p className="case-description">{caseInfo.description}</p></section>
      <section className="panel-card case-publication-review"><div className="section-heading"><p className="eyebrow">FAMILY CONSENT</p><h2>Public profile review</h2></div>
        {caseInfo.publicProfile?.requested ? <><p>The family requested publication of these details: {caseInfo.publicProfile.fields.join(', ')}.</p>{caseInfo.publicProfile.fields.includes('summary') ? <p className="case-description">{caseInfo.publicProfile.summary}</p> : null}<p>Current visibility: <strong>{caseInfo.visibility ?? 'private'}</strong> - Case status: <strong>{caseInfo.status}</strong></p>
          <button className="primary-button" type="button" onClick={() => void publishCase()} disabled={busy === 'publication' || (caseInfo.visibility === 'public' && caseInfo.status === 'Active') || caseInfo.status === 'Urgent'}>{busy === 'publication' ? 'Publishing...' : caseInfo.visibility === 'public' && caseInfo.status === 'Active' ? 'Published' : 'Verify and publish selected details'}</button>
        </> : <p>The family has not requested public publication. You can review the private report while it remains visible only to its owner and assigned moderators.</p>}
      </section>
      <div className="prototype-banner" role="note"><strong>Moderator decisions are private assessments.</strong><span>They do not approve, reject, or publish sightings. The family retains those decisions.</span></div>

      <section className="moderator-escalation-section"><div className="section-heading"><p className="eyebrow">CASE SAFETY</p><h2>Record an escalation</h2></div>
        <form className="panel-card moderator-action-form" onSubmit={submitEscalation}>
          <div className="field"><label htmlFor="escalation-severity">Severity</label><select id="escalation-severity" name="severity"><option value="high">High</option><option value="urgent">Urgent</option></select></div>
          <div className="field"><label htmlFor="escalation-note">Reason and recommended follow-up</label><textarea id="escalation-note" name="note" minLength={10} maxLength={1200} required placeholder="Record the concern and the action you recommend." /></div>
          <button className="primary-button" type="submit" disabled={busy === 'escalation'}>{busy === 'escalation' ? 'Saving...' : 'Record escalation'}</button>
        </form>
        {escalationActions.length ? <div className="moderator-action-history">{escalationActions.map((action) => <article key={action.id}><span className="status-badge urgent">{action.severity} escalation</span><p>{action.note}</p><small>{new Date(action.createdAt).toLocaleString()}</small></article>)}</div> : null}
      </section>

      <section className="moderator-sighting-section"><div className="section-heading"><p className="eyebrow">EVIDENCE REVIEW</p><h2>Sightings on this case <span className="queue-count">{sightings.length}</span></h2></div>
        {sightings.length ? <div className="moderator-sighting-list">{sightings.map((sighting) => {
          const latestAssessment = actions.find((action) => action.type === 'sighting-assessment' && action.sightingId === sighting.id);
          return <article className="panel-card moderator-sighting-card" key={sighting.id}>
            <div className="sighting-review-top"><span className="case-badge">{sighting.id}</span><span className="status-badge review">Family status: {sighting.status}</span></div>
            <p className="review-observation">{sighting.description}</p>
            {sighting.imageAssetId ? <Image className="review-sighting-photo" src={`${API_BASE_URL}/api/media/${encodeURIComponent(sighting.imageAssetId)}`} alt="Sighting evidence photo" width={800} height={450} unoptimized /> : null}
            <dl className="sighting-review-facts"><div><dt>Observed</dt><dd>{new Date(sighting.observedAt).toLocaleString()}</dd></div><div><dt>Place</dt><dd>{sighting.location}</dd></div><div><dt>Coordinates - assigned case</dt><dd>{sighting.latitude.toFixed(5)}, {sighting.longitude.toFixed(5)}</dd></div><div><dt>Family visibility</dt><dd>{sighting.public ? 'Public' : 'Private'}</dd></div></dl>
            {latestAssessment ? <div className="latest-assessment"><strong>Latest assessment: {latestAssessment.assessment?.replaceAll('-', ' ')}</strong><p>{latestAssessment.note}</p><small>{new Date(latestAssessment.createdAt).toLocaleString()}</small></div> : null}
            <form className="moderator-action-form inline-review-form" onSubmit={(event) => void submitAssessment(event, sighting.id)}>
              <div className="field"><label htmlFor={`assessment-${sighting.id}`}>Assessment</label><select id={`assessment-${sighting.id}`} name="assessment"><option value="credible-lead">Credible lead</option><option value="inconclusive">Inconclusive</option><option value="requires-follow-up">Requires follow-up</option></select></div>
              <div className="field"><label htmlFor={`note-${sighting.id}`}>Private review note</label><textarea id={`note-${sighting.id}`} name="note" minLength={10} maxLength={1200} required placeholder="Explain the assessment for the family and moderation record." /></div>
              <button className="secondary-button" type="submit" disabled={busy === sighting.id}>{busy === sighting.id ? 'Saving...' : 'Save private assessment'}</button>
            </form>
          </article>;
        })}</div> : <div className="empty-state"><h3>No sightings have been submitted</h3><p>Citizen sightings for this case will appear here for moderator assessment.</p></div>}
      </section>
    </> : !error ? <div className="empty-state"><p>Loading assigned case...</p></div> : null}
  </div>;
}
