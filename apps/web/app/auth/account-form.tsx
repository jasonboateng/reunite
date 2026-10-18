'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../lib/api';

export function AccountForm({ mode, nextPath }: { mode: 'login' | 'register'; nextPath?: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, email, password } : { email, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
      const requested = nextPath;
      const roles: string[] = result.user?.roles ?? [result.user?.role];
      const fallback = roles.includes('admin') ? '/admin' : roles.includes('reviewer') ? '/review' : roles.includes('family') ? '/family/dashboard' : roles.includes('moderator') ? '/moderation' : '/';
      const next = requested?.startsWith('/family/') || requested === '/report' || requested === '/moderation' || requested === '/review' || requested?.startsWith('/review/') || requested === '/admin' || requested?.startsWith('/admin/') ? requested : fallback;
      router.push(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to connect to the account service.');
    } finally {
      setBusy(false);
    }
  }

  const register = mode === 'register';
  const link = nextPath ? `?next=${encodeURIComponent(nextPath)}` : '';
  return <section className="module-page family-login-page">
    <p className="eyebrow">FAMILY ACCOUNT</p>
    <h1>{register ? 'Create your account' : 'Family sign in'}</h1>
    <p>{register ? 'Create an account to submit and manage private family reports.' : 'Sign in to access the cases linked to your account.'}</p>
    <form className="form-panel family-auth-form" onSubmit={submit}>
      {register && <div className="field"><label htmlFor="account-name">Your name</label><input id="account-name" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} required /></div>}
      <div className="field"><label htmlFor="account-email">Email address</label><input id="account-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
      <div className="field"><label htmlFor="account-password">Password</label><input id="account-password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /><span className="field-hint">{register ? 'Use at least 12 characters.' : 'Enter your account password.'}</span></div>
      <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait...' : register ? 'Create account' : 'Sign in'}</button>
      {error && <p className="status-message error" role="alert">{error}</p>}
    </form>
    <p className="account-switch">{register ? 'Already registered?' : 'New to REUNITE?'} <Link href={register ? `/auth/login${link}` : `/auth/register${link}`}>{register ? 'Sign in' : 'Create an account'}</Link></p>
    <p className="prototype-note">Account details and reports are stored in the configured MongoDB database. Use a unique password.</p>
  </section>;
}
