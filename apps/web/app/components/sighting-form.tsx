'use client';

import { FormEvent, useState } from 'react';
import { API_BASE_URL } from '../lib/api';
import ImageUpload from './image-upload';

type Coordinates = { latitude: string; longitude: string };

export default function SightingForm({ caseId }: { caseId: string }) {
  const [coordinates, setCoordinates] = useState<Coordinates>({ latitude: '', longitude: '' });
  const [description, setDescription] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [imageAssetId, setImageAssetId] = useState('');

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage('This browser cannot access location. Enter the coordinates manually.');
      setMessageIsError(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinates({
          latitude: coords.latitude.toFixed(6),
          longitude: coords.longitude.toFixed(6)
        });
        setMessage('Location attached. Add a place description to help the family.');
        setMessageIsError(false);
      },
      () => {
        setMessage('Location access was not granted. You can enter coordinates manually.');
        setMessageIsError(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submitSighting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setMessageIsError(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/sightings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description,
            observedAt,
            location,
            latitude: Number(coordinates.latitude),
            longitude: Number(coordinates.longitude),
            imageAssetId: imageAssetId || undefined
          })
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to submit sighting.');

      setMessage(result.message);
      setMessageIsError(false);
      setDescription('');
      setObservedAt('');
      setLocation('');
      setImageAssetId('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit sighting.');
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="sighting-form" onSubmit={submitSighting}>
      <div className="field">
        <label htmlFor="sighting-description">What did you see?</label>
        <textarea
          id="sighting-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the person and what happened. Do not approach if it could put anyone at risk."
          required
          minLength={10}
          maxLength={2000}
        />
      </div>
      <div className="field">
        <label htmlFor="sighting-time">When did you see them?</label>
        <input
          id="sighting-time"
          type="datetime-local"
          value={observedAt}
          onChange={(event) => setObservedAt(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="sighting-place">Place or nearby landmark</label>
        <input
          id="sighting-place"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="e.g. Madina market, Accra"
          required
          maxLength={200}
        />
      </div>

      <div className="location-capture">
        <div>
          <strong>Location pin required</strong>
          <p>
            Coordinates are shared with the family for review. They are not published automatically.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={useCurrentLocation}>
          Use my location
        </button>
      </div>

      <div className="coordinate-fields">
        <div className="field">
          <label htmlFor="latitude">Latitude</label>
          <input
            id="latitude"
            type="number"
            step="any"
            min="-90"
            max="90"
            value={coordinates.latitude}
            onChange={(event) => setCoordinates((current) => ({ ...current, latitude: event.target.value }))}
            placeholder="e.g. 5.6037"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="longitude">Longitude</label>
          <input
            id="longitude"
            type="number"
            step="any"
            min="-180"
            max="180"
            value={coordinates.longitude}
            onChange={(event) => setCoordinates((current) => ({ ...current, longitude: event.target.value }))}
            placeholder="e.g. -0.1870"
            required
          />
        </div>
      </div>

      <ImageUpload kind="sighting-photo" caseId={caseId} value={imageAssetId} onChange={setImageAssetId} />

      <div className="sighting-submit-row">
        <p>Every sighting goes to the family for approval before it can appear publicly.</p>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? 'Sending sighting…' : 'Send sighting'}
        </button>
      </div>

      {message ? (
        <p className={`status-message${messageIsError ? ' error' : ''}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
