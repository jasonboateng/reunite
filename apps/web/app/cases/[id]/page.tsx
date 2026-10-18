import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import SightingForm from '../../components/sighting-form';
import { API_BASE_URL, fetchCaseById, fetchPublicSightings } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const caseItem = await fetchCaseById(params.id);

  if (!caseItem) notFound();
  const publicSightings = await fetchPublicSightings(params.id);

  return (
    <div className="module-page case-detail-page">
      <Link href="/cases" className="back-link">← Back to public cases</Link>

      <section className="case-detail-heading">
        <div>
          <p className="eyebrow">PUBLIC MISSING PERSON CASE</p>
          <span className="case-card-id">{caseItem.id}</span>
          <h1>{caseItem.name}</h1>
          <p className="case-detail-subtitle">
            {[caseItem.age ? `${caseItem.age} years old` : null, caseItem.region].filter(Boolean).join(' · ')}
          </p>
          <span className={`status-badge ${caseItem.status.toLowerCase() === 'urgent' ? 'urgent' : 'active'}`}>
            {caseItem.status === 'Urgent' ? 'Urgent search' : 'Open case'}
          </span>
        </div>
        <div className="case-detail-photo-wrap">
          <Image
            className="case-detail-photo"
            fill
            priority
            sizes="190px"
            src={caseItem.imageAssetId ? `${API_BASE_URL}/api/media/${encodeURIComponent(caseItem.imageAssetId)}` : '/person-placeholder.svg'}
            unoptimized={Boolean(caseItem.imageAssetId)}
            alt={caseItem.imageAssetId ? `Family-approved photo of ${caseItem.name}` : `Portrait placeholder for ${caseItem.name}`}
          />
        </div>
      </section>

      <div className="case-detail-grid">
        <div className="case-detail-main">
          <section className="panel-card">
            <div className="section-heading">
              <p className="eyebrow">WHAT THE FAMILY SHARED</p>
              <h2>Case information</h2>
            </div>
            {caseItem.description ? <p className="case-description">{caseItem.description}</p> : null}
            <div className="case-facts">
              {caseItem.lastSeen ? <div>
                <span>Last seen</span>
                <strong>{caseItem.lastSeen}</strong>
              </div> : null}
              <div>
                <span>Case reference</span>
                <strong>{caseItem.id}</strong>
              </div>
            </div>
            <p className="privacy-note">
              Family contact details and unapproved sighting information are private and are not shown here.
            </p>
          </section>

          {publicSightings.length ? <section className="panel-card public-sightings" aria-labelledby="public-sightings-heading">
            <div className="section-heading"><p className="eyebrow">FAMILY-APPROVED UPDATES</p><h2 id="public-sightings-heading">Public sightings</h2></div>
            <div className="public-sighting-list">{publicSightings.map((sighting) => <article key={sighting.id}>
              {sighting.imageAssetId ? <Image className="public-sighting-photo" src={`${API_BASE_URL}/api/media/${encodeURIComponent(sighting.imageAssetId)}`} alt="Family-approved sighting photo" width={640} height={360} unoptimized /> : null}<p>{sighting.description}</p><div><span>{new Date(sighting.observedAt).toLocaleString()}</span><span>{sighting.location}</span></div>
            </article>)}</div>
            <p className="privacy-note">Exact coordinates and private family details are not included.</p>
          </section> : null}

          <section className="panel-card sighting-panel" aria-labelledby="sighting-heading">
            <div className="section-heading">
              <p className="eyebrow">HAVE YOU SEEN THEM?</p>
              <h2 id="sighting-heading">Share a sighting</h2>
              <p>Include when and where you saw them. The family reviews every sighting before it can be shared publicly.</p>
            </div>
            <SightingForm caseId={caseItem.id} />
          </section>
        </div>

        <aside className="case-detail-aside">
          <section className="panel-card safety-card">
            <p className="eyebrow">PLEASE STAY SAFE</p>
            <h2>Share information, not risk.</h2>
            <p>Do not follow or confront anyone. If there is immediate danger, contact local emergency services first.</p>
          </section>
          <section className="panel-card">
            <p className="eyebrow">HOW SIGHTINGS WORK</p>
            <ol className="sighting-steps">
              <li>Your sighting is sent privately to the family.</li>
              <li>The family can approve or reject it.</li>
              <li>Only sightings the family chooses to publish become visible on the case.</li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
