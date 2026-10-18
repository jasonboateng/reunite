import ModeratorCaseDetail from './moderator-case-detail';
export default function ModeratorCasePage({ params }: { params: { id: string } }) { return <ModeratorCaseDetail caseId={params.id} />; }
