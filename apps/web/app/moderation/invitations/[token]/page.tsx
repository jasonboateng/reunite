import InvitationAcceptance from './invitation-acceptance';

export default function AcceptModeratorInvitationPage({ params }: { params: { token: string } }) {
  return <InvitationAcceptance token={params.token} />;
}
