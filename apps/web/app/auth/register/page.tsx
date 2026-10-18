import { AccountForm } from '../account-form';

type RegisterPageProps = { searchParams?: { next?: string | string[] } };

export default function FamilyRegisterPage({ searchParams }: RegisterPageProps) {
  const nextPath = typeof searchParams?.next === 'string' ? searchParams.next : undefined;
  return <AccountForm mode="register" nextPath={nextPath} />;
}
