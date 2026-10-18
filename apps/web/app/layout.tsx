import type { Metadata } from 'next';
import Link from 'next/link';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800']
});

export const metadata: Metadata = {
  title: 'REUNITE | Report. Find. Reunite.',
  description: 'Ghana's citizen-powered missing persons reporting platform.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={montserrat.className}>
        <div className="app-shell">
          <header className="topbar">
            <div className="brand-wrap">
              <Link href="/" className="brand-link" aria-label="REUNITE home">
                <div className="brand-mark">R</div>
                <div>
                  <p className="brand-name">reunite<span>.</span></p>
                </div>
              </Link>
            </div>

            <nav aria-label="Main navigation" className="main-nav">
              <Link href="/about" className="nav-link">About</Link>
              <Link href="/privacy" className="nav-link">Privacy</Link>
            </nav>
            <div className="topbar-actions">
              <Link href="/auth/login" className="secondary-button family-login">
                Family login
              </Link>
            </div>
          </header>

          <main>{children}</main>

          <footer className="site-footer">
            <Link href="/" className="footer-brand" aria-label="REUNITE home">reunite<span>.</span></Link>
            <span>Family reports and community search</span>
            <Link href="/privacy">Privacy and safety</Link>
          </footer>
        </div>
      </body>
    </html>
  );
}
