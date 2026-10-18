import SightingReview from './sighting-review';

export default function FamilySightingsPage({ params }: { params: { id: string } }) {
  return <SightingReview caseId={params.id} />;
}
