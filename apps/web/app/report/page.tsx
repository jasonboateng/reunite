'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../lib/api';
import ImageUpload from '../components/image-upload';

const initialForm = {
  fullName: '',
  age: '',
  region: 'Greater Accra',
  caseType: 'Missing person',
  lastSeen: '',
  contact: '',
  notes: '',
  evidence: ''
};

export default function ReportPage() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [imageAssetId, setImageAssetId] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
      .then((response) => {
        if (response.status === 401) {
          router.replace('/auth/login?next=%2Freport');
          return;
        }
        if (!response.ok) throw new Error('Unable to verify your account.');
        setCheckingAccount(false);
      })
      .catch(() => {
        setMessage('The account service is unavailable. Please try again shortly.');
        setCheckingAccount(false);
      });
  }, [router]);

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          age: Number(form.age) || undefined,
          region: form.region,
          caseType: form.caseType,
          lastSeen: form.lastSeen,
          contact: form.contact,
          notes: form.notes,
          evidence: form.evidence ? [form.evidence] : undefined,
          imageAssetId: imageAssetId || undefined
        })
      });

      const responseText = await response.text();
      let data: { error?: string; message?: string } = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        // Vercel or the API host can return an HTML error page instead of JSON.
      }
      if (!response.ok) {
        if (response.status === 401) {
          router.replace('/auth/login?next=%2Freport');
          return;
        }
        throw new Error(
          data.error ||
            `The report service could not save this report (HTTP ${response.status}). Please try again shortly.`
        );
      }

      setMessage(data.message || 'Report submitted successfully.');
      setForm(initialForm);
      setImageAssetId('');
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : 'Unable to submit report';
      setMessage(errMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">FAMILY REPORT</p>
          <h1>Report a missing person</h1>
        </div>
      </div>

      <p className="prototype-note">Reports are saved privately under your family account. They will not appear in public search until approved.</p>
      {checkingAccount ? <div className="empty-state"><p>Checking your family account...</p></div> : null}

      {!checkingAccount ? <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-panel">
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" type="text" value={form.fullName} onChange={(event) => handleChange('fullName', event.target.value)} placeholder="Enter full name" required />
            </div>

            <div className="field">
              <label htmlFor="age">Age</label>
              <input id="age" type="number" value={form.age} onChange={(event) => handleChange('age', event.target.value)} placeholder="Age" />
            </div>

            <div className="field">
              <label htmlFor="region">Region</label>
              <select id="region" value={form.region} onChange={(event) => handleChange('region', event.target.value)}>
                <option>Greater Accra</option>
                <option>Ashanti</option>
                <option>Eastern</option>
                <option>Northern</option>
                <option>Western</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="caseType">Case type</label>
              <select id="caseType" value={form.caseType} onChange={(event) => handleChange('caseType', event.target.value)}>
                <option>Missing person</option>
                <option>Critical risk</option>
                <option>Medical concern</option>
              </select>
            </div>
          </div>

          <div className="form-panel">
            <div className="field">
              <label htmlFor="lastSeen">Last seen</label>
              <input id="lastSeen" type="text" value={form.lastSeen} onChange={(event) => handleChange('lastSeen', event.target.value)} placeholder="Location and date" required />
            </div>

            <div className="field">
              <label htmlFor="contact">Family contact</label>
              <input id="contact" type="tel" value={form.contact} onChange={(event) => handleChange('contact', event.target.value)} placeholder="Phone number" required />
            </div>

            <div className="field">
              <label htmlFor="notes">Case details</label>
              <textarea id="notes" value={form.notes} onChange={(event) => handleChange('notes', event.target.value)} placeholder="Describe clothing, distinguishing features, and context of the disappearance" minLength={10} maxLength={5000} required />
            </div>

            <ImageUpload kind="case-photo" value={imageAssetId} onChange={setImageAssetId} />

            <div className="field">
              <label htmlFor="evidence">Attach evidence</label>
              <input id="evidence" type="text" value={form.evidence} onChange={(event) => handleChange('evidence', event.target.value)} placeholder="Add evidence note or file reference" />
            </div>

            <div className="form-actions">
              <button className="secondary-button" type="button">Save draft</button>
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit report'}
              </button>
            </div>

            {message ? <p className="status-message">{message}</p> : null}
          </div>
        </div>
      </form> : null}
    </div>
  );
}
