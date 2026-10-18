import IntakeReview from './intake-review';

export default function IntakeReviewPage({ params }: { params: { id: string } }) {
  return <IntakeReview caseId={params.id} />;
}
