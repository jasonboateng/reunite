'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../lib/api';

type Account = { name: string; email: string; role: string };

export default function FamilyProfilePage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 401) { router.replace('/auth/login?next=%2Ffamily%2Fprofile'); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load your account.');
        setAccount(data.user);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load your account.'));
  }, [router]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
      if (!response.ok) throw new Error('Unable to sign out. Please try again.');
      router.replace('/');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out. Please try again.');
      setSigningOut(false);
    }
  };

  return <div className="module-page">
    <Link href="/family/dashboard" className="back-link">← Your cases</Link>
    <div className="page-header"><div><p className="eyebrow">ACCOUNT</p><h1>Your profile</h1><p>Account details used for your family reports and notifications.</p></div></div>
    {error ? <div className="inline-alert" role="alert">{error}</div> : null}
    {account ? <section className="panel-card"><dl className="account-details">
      <div><dt>Name</dt><dd>{account.name}</dd></div>
      <div><dt>Email</dt><dd>{account.email}</dd></div>
      <div><dt>Account type</dt><dd>{account.role === 'family' ? 'Family reporter' : account.role}</dd></div>
    </dl><button className="secondary-button" type="button" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? 'Signing out…' : 'Sign out'}</button></section> : !error ? <div className="empty-state">Loading your profile…</div> : null}
  </div>;
}
