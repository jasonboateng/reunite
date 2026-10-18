import Link from 'next/link';

export const metadata = {
  title: 'About REUNITE',
  description: 'How REUNITE helps families, witnesses, and reviewers work together safely.'
};

export default function AboutPage() {
  return (
    <div className="module-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">ABOUT REUNITE</p>
          <h1>Helping families and communities find missing people</h1>
          <p>REUNITE is a Ghana-focused platform for family reports, public case discovery, and community sightings.</p>
        </div>
      </div>

      <section className="panel-card">
        <h2>How it works</h2>
        <ol>
          <li>Families create an account and submit a private report.</li>
          <li>Families choose which details may be shared publicly. A reviewer verifies the request before publication.</li>
          <li>Citizens can search public cases and send sightings directly to the family for review.</li>
        </ol>
      </section>

      <section className="panel-card">
        <h2>Privacy and safety come first</h2>
        <p>Reports and sightings are private by default. Family contact details, evidence, and precise sighting locations are not shown on public case pages. Families review sightings and decide separately whether an approved sighting can be shared.</p>
        <p>If someone may be in immediate danger, contact local emergency services. Do not approach a person if doing so could put anyone at risk.</p>
      </section>

      <div className="family-dashboard-actions">
        <Link className="primary-button" href="/auth/register?next=%2Ffamily%2Fcases%2Fnew">Create a family report</Link>
        <Link className="secondary-button" href="/cases">Search public cases</Link>
      </div>
    </div>
  );
}
