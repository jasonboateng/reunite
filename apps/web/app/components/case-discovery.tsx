'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import type { CaseSummary } from '../lib/api';
import { API_BASE_URL } from '../lib/api';

export default function CaseDiscovery({
  cases,
  initialQuery = ''
}: {
  cases: CaseSummary[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const visibleCases = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return cases;

    return cases.filter((caseItem) =>
      [caseItem.id, caseItem.name, caseItem.region, caseItem.lastSeen]
        .join(' ')
        .toLowerCase()
        .includes(search)
    );
  }, [cases, query]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = query.trim();
    router.push(search ? `/cases?q=${encodeURIComponent(search)}` : '/cases');
  };

  return (
    <>
      <section className="citizen-search-hero">
        <Link href="/" className="search-wordmark" aria-label="REUNITE home">
          reunite<span>.</span>
        </Link>
        <h1>Search missing person cases</h1>
            <p className="hero-text">
          Enter a name or Reunite case reference to find an active report.
        </p>
        <form className="case-search" role="search" onSubmit={handleSearch}>
          <label className="visually-hidden" htmlFor="case-search">Search by name or case number</label>
          <span className="search-icon" aria-hidden="true" />
          <input
            id="case-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or case reference"
          />
          <button type="submit" className="search-submit">Search cases</button>
        </form>
        <p className="search-help">Only reports approved for public viewing appear in search.</p>
        <p className="family-report-prompt">
        Need to report someone missing? <Link href="/auth/register?next=%2Ffamily%2Fcases%2Fnew">Create a family report</Link>
        </p>
      </section>

      <section className="recent-cases" aria-labelledby="recent-cases-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PUBLIC REPORTS</p>
            <h2 id="recent-cases-title">Recent cases</h2>
          </div>
          <span className="public-data-note">Only family-approved details are shown</span>
        </div>

        {visibleCases.length ? (
          <div className="case-card-grid">
            {visibleCases.map((caseItem) => (
              <Link
                href={`/cases/${encodeURIComponent(caseItem.id)}`}
                className="public-case-card"
                key={caseItem.id}
                aria-label={`View case ${caseItem.id}, ${caseItem.name}`}
              >
                <div className="case-photo-wrap">
                  {/* The image is family-approved; the placeholder is used when no public photo exists. */}
                  <Image
                    className="case-photo"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 33vw"
                    src={caseItem.imageAssetId ? `${API_BASE_URL}/api/media/${encodeURIComponent(caseItem.imageAssetId)}` : '/person-placeholder.svg'}
                    unoptimized={Boolean(caseItem.imageAssetId)}
                    alt={caseItem.imageAssetId ? `Family-approved photo of ${caseItem.name}` : `Portrait placeholder for ${caseItem.name}`}
                  />
                  <span className={`status-badge ${caseItem.status.toLowerCase() === 'urgent' ? 'urgent' : caseItem.status.toLowerCase() === 'review' ? 'review' : 'active'}`}>
                    {caseItem.status}
                  </span>
                </div>
                <div className="public-case-card-copy">
                  <div className="case-card-heading">
                    <div>
                      <span className="case-card-id">{caseItem.id}</span>
                      <h3>{caseItem.name}</h3>
                    </div>
                  </div>
                  {caseItem.age || caseItem.region ? <p>{caseItem.age ? `${caseItem.age} yrs` : null}{caseItem.age && caseItem.region ? <span aria-hidden="true"> - </span> : null}{caseItem.region}</p> : null}
                  {caseItem.lastSeen ? <p className="case-card-last-seen">Last seen {caseItem.lastSeen}</p> : null}
                  <span className="case-card-action">View case and share a sighting</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No matching public cases</h3>
            <p>Try a different name, case number, or region.</p>
          </div>
        )}
      </section>
    </>
  );
}



