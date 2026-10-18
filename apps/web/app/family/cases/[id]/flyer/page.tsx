import FlyerBuilder from './flyer-builder';

export default function FamilyFlyerPage({ params }: { params: { id: string } }) {
  return <FlyerBuilder caseId={params.id} />;
}
