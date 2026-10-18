import FamilyCaseEditor from './family-case-editor';

export default function FamilyCaseEditPage({ params }: { params: { id: string } }) {
  return <FamilyCaseEditor caseId={params.id} />;
}
