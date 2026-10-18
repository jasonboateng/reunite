import ModeratorManager from './moderator-manager';

export default function FamilyModeratorsPage({ params }: { params: { id: string } }) {
  return <ModeratorManager caseId={params.id} />;
}
