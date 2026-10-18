import { AccountForm } from '../account-form';

type LoginPageProps = { searchParams?: { next?: string | string[] } };

export default function FamilyLoginPage({ searchParams }: LoginPageProps) {
  const nextPath = typeof searchParams?.next === 'string' ? searchParams.next : undefined;
  return <AccountForm mode="login" nextPath={nextPath} />;
}
