export type CaseStatus = 'Active' | 'Review' | 'Urgent' | 'Found';

export interface CaseRecord {
  id: string;
  name: string;
  age: string;
  gender: string;
  region: string;
  lastSeen: string;
  location: string;
  status: CaseStatus;
  description: string;
  reporter: string;
  contact: string;
  source: string;
  evidence: string[];
  imageUrl?: string;
  imageAssetId?: string;
}

export interface SightingInput {
  description: string;
  observedAt: string;
  location: string;
  latitude: number;
  longitude: number;
  imageAssetId?: string;
}

export interface SightingRecord extends SightingInput {
  id: string;
  caseId: string;
  status: 'pending-family-review' | 'approved' | 'rejected';
  public: boolean;
  submittedAt: string;
}

export interface ReportInput {
  fullName: string;
  age: number;
  region: string;
  caseType: string;
  lastSeen: string;
  contact: string;
  notes: string;
  evidence?: string[];
  imageAssetId?: string;
}
