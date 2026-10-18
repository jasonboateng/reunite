import PublicProfileEditor from './public-profile-editor';

export default function FamilyPublicProfilePage({ params }: { params: { id: string } }) {
  return <PublicProfileEditor caseId={params.id} />;
}
