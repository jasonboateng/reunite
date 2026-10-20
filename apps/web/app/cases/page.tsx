import CaseDiscovery from '../components/case-discovery';
import { fetchCases } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function CasesPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const cases = await fetchCases();
  const initialStatus = searchParams.status === 'found' || searchParams.status === 'active'
    ? searchParams.status
    : 'all';

  return <CaseDiscovery cases={cases} initialQuery={searchParams.q ?? ''} initialStatus={initialStatus} />;
}
