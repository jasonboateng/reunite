import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <section className="module-page privacy-page">
      <p className="eyebrow">PRIVACY AND SAFETY</p>
      <h1>Your information deserves care.</h1>
      <p>
        Public case pages show only information approved for public viewing. Family contact details
        and sightings remain private unless the family explicitly chooses to share them.
      </p>
      <p>
        A submitted sighting is sent to the family for review. Its location is not automatically
        published. Share only information you believe is safe and useful.
      </p>
      <Link href="/" className="text-link">Return to case search →</Link>
    </section>
  );
}
