import CaseDiscovery from './components/case-discovery';
import { fetchCases } from './lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cases = await fetchCases();

  return (
    <CaseDiscovery cases={cases} />
  );
}
