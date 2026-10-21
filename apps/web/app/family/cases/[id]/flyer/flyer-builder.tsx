'use client';

import Link from 'next/link';
import { toBlob } from 'html-to-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../../../lib/api';

type FlyerField = 'name' | 'age' | 'region' | 'lastSeen' | 'summary' | 'contact';
type FlyerCase = { id: string; caseNumber: string; name: string; age: string; region: string; lastSeen: string; description: string; contact: string; imageAssetId?: string; flyerProfile?: { fields: FlyerField[]; summary: string } };
const fieldOptions: { id: FlyerField; label: string; note: string }[] = [
  { id: 'name', label: "Person's name", note: 'Required on every flyer' },
  { id: 'age', label: 'Age', note: 'Shown only when selected' },
  { id: 'region', label: 'Region', note: 'Shown only when selected' },
  { id: 'lastSeen', label: 'Last seen details', note: 'Shown only when selected' },
  { id: 'summary', label: 'Family-written summary', note: 'Write a short public-safe description' },
  { id: 'contact', label: 'Family contact number', note: 'Anyone with this flyer can see it' }
];

export default function FlyerBuilder({ caseId }: { caseId: string }) {
  const [caseItem, setCaseItem] = useState<FlyerCase | null>(null);
  const [fields, setFields] = useState<FlyerField[]>(['name', 'region', 'lastSeen']);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [siteOrigin, setSiteOrigin] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const flyerRef = useRef<HTMLElement>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}/flyer`, { credentials: 'include' });
      if (response.status === 401) {
        router.replace(`/auth/login?next=${encodeURIComponent(`/family/cases/${caseId}/flyer`)}`);
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load this case flyer.');
      setCaseItem(result.case);
      if (result.case.flyerProfile) {
        setFields(result.case.flyerProfile.fields);
        setSummary(result.case.flyerProfile.summary);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this case flyer.');
    } finally {
      setLoading(false);
    }
  }, [caseId, router]);

  useEffect(() => {
    setSiteOrigin(window.location.origin);
    void load();
  }, [load]);

  const selected = useMemo(() => new Set(fields), [fields]);
  function toggleField(field: FlyerField) {
    if (field === 'name') return;
    setFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/family/cases/${encodeURIComponent(caseId)}/flyer`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, summary })
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          router.replace(`/auth/login?next=${encodeURIComponent(`/family/cases/${caseId}/flyer`)}`);
          return;
        }
        throw new Error(result.error || 'Unable to save flyer details.');
      }
      setDirty(false);
      setNotice(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save flyer details.');
    } finally {
      setSaving(false);
    }
  }

  async function saveFlyerImage() {
    const flyer = flyerRef.current;
    if (!flyer) return;

    setSavingImage(true);
    setError('');
    setNotice('');
    try {
      const blob = await toBlob(flyer, {
        pixelRatio: 2,
        cacheBust: true,
        fetchRequestInit: { credentials: 'same-origin' }
      });
      if (!blob) throw new Error('The flyer image could not be created.');

      const safeCaseNumber = caseItem?.caseNumber.replace(/[^a-z0-9-]/gi, '-') || 'case';
      const filename = `reunite-${safeCaseNumber}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ title: 'REUNITE case flyer', files: [file] });
          setNotice('Choose Photos or Gallery in the share menu to save the flyer.');
          return;
        } catch (cause) {
          if (cause instanceof Error && cause.name === 'AbortError') return;
        }
        downloadFlyer(blob, filename);
        setNotice('Flyer downloaded. Open it and choose Photos or Gallery to save it.');
      } else {
        downloadFlyer(blob, filename);
        setNotice('Flyer image downloaded.');
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setError(cause instanceof Error ? cause.message : 'Unable to save the flyer image.');
    } finally {
      setSavingImage(false);
    }
  }

  function downloadFlyer(blob: Blob, filename: string) {
    const imageUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
  }

  if (loading) return <div className="module-page"><div className="empty-state"><p>Loading flyer details...</p></div></div>;
  if (!caseItem) return <div className="module-page"><div className="empty-state"><h2>Flyer unavailable</h2><p>{error || 'This case could not be loaded.'}</p><Link className="text-link" href="/family/dashboard">Back to dashboard</Link></div></div>;

  const caseUrl = `${siteOrigin}/cases/${encodeURIComponent(caseItem.id)}`;
  const initials = caseItem.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return <div className="module-page flyer-builder-page">
    <Link href="/family/dashboard" className="back-link"> Family dashboard</Link>
    <div className="page-header"><div><p className="eyebrow">FAMILY CASE - FLYER</p><h1>Build a case flyer</h1><p>Choose what to print and check the preview before sharing.</p></div></div>
    <div className="prototype-banner" role="note"><strong>This flyer is private until you print or share it.</strong><span>Only the details selected below appear on the flyer. Saving these choices does not publish the case to public search.</span></div>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {notice ? <p className="status-message" role="status">{notice}</p> : null}

    <div className="flyer-builder-grid">
      <section className="form-panel flyer-settings" aria-labelledby="flyer-settings-title">
        <div className="section-heading"><p className="eyebrow">SHARING CHOICES</p><h2 id="flyer-settings-title">Details to include</h2></div>
        <div className="flyer-field-list">{fieldOptions.map((field) => <label className="flyer-field-option" key={field.id}>
          <input type="checkbox" checked={selected.has(field.id)} disabled={field.id === 'name'} onChange={() => toggleField(field.id)} />
          <span><strong>{field.label}</strong><small>{field.id === 'name' ? caseItem.name : field.note}</small></span>
        </label>)}</div>
        {selected.has('summary') ? <div className="field flyer-summary-field"><label htmlFor="flyer-summary">Public-safe summary</label><textarea id="flyer-summary" maxLength={1000} minLength={10} value={summary} onChange={(event) => { setSummary(event.target.value); setDirty(true); }} placeholder="Describe identifying clothing or other helpful details. Leave out private medical or family information." /><span className="field-hint">{summary.length}/1,000 characters. This text will be printed.</span></div> : null}
        {selected.has('contact') ? <div className="flyer-contact-preview"><strong>Contact shown on flyer</strong><span>{caseItem.contact}</span></div> : null}
        <p className="flyer-privacy-note">A phone number can be copied or photographed by anyone who sees this flyer. Include it only if you are comfortable sharing it widely.</p>
        <div className="form-actions"><button className="secondary-button" type="button" onClick={() => void saveFlyerImage()} disabled={savingImage || !selected.has('name')}>{savingImage ? 'Creating image...' : 'Save flyer image / gallery'}</button><button className="secondary-button" type="button" onClick={() => window.print()} disabled={!selected.has('name')}>Print / Save as PDF</button><button className="primary-button" type="button" onClick={() => void save()} disabled={saving || !dirty}>{saving ? 'Saving...' : dirty ? 'Save flyer choices' : 'Choices saved'}</button></div>
        <p className="flyer-export-help">On phones, choose Photos or Gallery from the share menu. On computers, the PNG downloads.</p>
      </section>

      <section className="flyer-preview-wrap" aria-label="Flyer preview">
        <article ref={flyerRef} className="missing-person-flyer">
          <header className="flyer-brand"><span className="flyer-brand-mark">R</span><span>REUNITE <small>REPORT - FIND - REUNITE</small></span></header>
          <p className="flyer-alert-label">MISSING PERSON</p>
          <div className="flyer-portrait">{caseItem.imageAssetId ? <img crossOrigin="anonymous" src={`${API_BASE_URL}/api/media/${encodeURIComponent(caseItem.imageAssetId)}`} alt={`Photo of ${caseItem.name}`} /> : <span aria-hidden="true">{initials || 'R'}</span>}</div>
          {selected.has('name') ? <h2>{caseItem.name}</h2> : null}
          <div className="flyer-detail-list">
            {selected.has('age') && caseItem.age !== 'Unknown' ? <p><strong>Age</strong><span>{caseItem.age}</span></p> : null}
            {selected.has('region') ? <p><strong>Region</strong><span>{caseItem.region}</span></p> : null}
            {selected.has('lastSeen') ? <p><strong>Last seen</strong><span>{caseItem.lastSeen}</span></p> : null}
            {selected.has('summary') && summary.trim() ? <p className="flyer-summary"><span>{summary}</span></p> : null}
            {selected.has('contact') ? <p><strong>Family contact</strong><span>{caseItem.contact}</span></p> : null}
          </div>
          <div className="flyer-callout"><strong>Have information?</strong><span>Submit a sighting through REUNITE using this case reference.</span></div>
          <div className="flyer-reference"><span>CASE REFERENCE</span><strong>{caseItem.caseNumber}</strong></div>
          {caseUrl ? <p className="flyer-url">{caseUrl}</p> : null}
          <footer>Share information responsibly. Do not approach or confront anyone.</footer>
        </article>
        {!selected.has('name') ? <p className="flyer-preview-help">A name is required before this flyer can be printed.</p> : null}
      </section>
    </div>
  </div>;
}
