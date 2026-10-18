'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { API_BASE_URL } from '../lib/api';

type UploadKind = 'case-photo' | 'sighting-photo';
type UploadSignature = { cloudName: string; apiKey: string; timestamp: number; signature: string; publicId: string; type: string; format: string; overwrite: boolean; mediaId: string };

export default function ImageUpload({ kind, caseId, value, existingImageUrl, onChange }: { kind: UploadKind; caseId?: string; value: string; existingImageUrl?: string; onChange: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPEG, PNG, or WebP image.'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('Choose an image smaller than 8 MB.'); return; }

    const localPreview = URL.createObjectURL(file);
    setPreview((current) => { if (current) URL.revokeObjectURL(current); return localPreview; });
    setBusy(true);
    onChange('');
    try {
      const signatureResponse = await fetch(`${API_BASE_URL}/api/media/signature`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, ...(caseId ? { caseId } : {}) })
      });
      const signature = await signatureResponse.json() as UploadSignature & { error?: string };
      if (!signatureResponse.ok) throw new Error(signature.error || 'Unable to prepare secure image upload.');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signature.apiKey);
      formData.append('timestamp', String(signature.timestamp));
      formData.append('signature', signature.signature);
      formData.append('public_id', signature.publicId);
      formData.append('type', signature.type);
      formData.append('format', signature.format);
      formData.append('overwrite', String(signature.overwrite));
      const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`, { method: 'POST', body: formData });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok || uploaded.public_id !== signature.publicId || uploaded.format !== 'jpg') {
        throw new Error(uploaded.error?.message || 'Cloudinary could not store this image.');
      }

      const completeResponse = await fetch(`${API_BASE_URL}/api/media/complete`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId: signature.mediaId })
      });
      const completed = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completed.error || 'We could not verify the uploaded image.');
      onChange(signature.mediaId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Image upload failed. Please try again.');
      setPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; });
    } finally { setBusy(false); }
  }

  const label = kind === 'case-photo' ? 'Missing person photo' : 'Sighting photo';
  return <div className="field image-upload-field">
    <label htmlFor={`image-${kind}-${caseId ?? 'new'}`}>{label}</label>
    <input id={`image-${kind}-${caseId ?? 'new'}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event)} disabled={busy} />
    <span className="field-hint">JPEG, PNG, or WebP - up to 8 MB. Images are stored privately and shared only with the people authorized to view this case.</span>
    {busy ? <p role="status" className="status-message">Uploading securely...</p> : null}
    {error ? <p role="alert" className="status-message error">{error}</p> : null}
    {value && (preview || existingImageUrl) ? <div className="image-upload-preview"><img src={preview || existingImageUrl} alt="Selected image preview" /><span>Image ready</span><button type="button" className="text-link" onClick={() => { onChange(''); setPreview((current) => { if (current) URL.revokeObjectURL(current); return ''; }); }}>Remove image</button></div> : null}
  </div>;
}
