// Browser requests go through the Next.js proxy in production so session
// cookies stay first-party. Server-rendered pages can call the API directly.
export const API_BASE_URL = typeof window !== 'undefined' && process.env.NODE_ENV === 'production'
  ? ''
  : process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export type CaseSummary = {
  id: string;
  name: string;
  age?: string;
  region?: string;
  status: string;
  lastSeen?: string;
  imageAssetId?: string;
};

export type CaseDetail = {
  id: string;
  name: string;
  age?: string;
  region?: string;
  lastSeen?: string;
  status: string;
  description: string;
  imageAssetId?: string;
};

export type PublicSighting = { id: string; description: string; observedAt: string; location: string; imageAssetId?: string };

export async function fetchCases(): Promise<CaseSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/cases`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Case search is temporarily unavailable (${response.status}).`);
  }
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error('The cases service returned invalid data.');
  return data.items;
}

export async function fetchCaseById(id: string): Promise<CaseDetail | null> {
  const response = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Case details are temporarily unavailable (${response.status}).`);
  return await response.json();
}

export async function fetchPublicSightings(id: string): Promise<PublicSighting[]> {
  const response = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(id)}/sightings`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Public sightings are temporarily unavailable (${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error('The sightings service returned invalid data.');
  return data.items;
}

export async function submitReport(payload: Record<string, string | number | undefined>) {
  const response = await fetch(`${API_BASE_URL}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response;
}
