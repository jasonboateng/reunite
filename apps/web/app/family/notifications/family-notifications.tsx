'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../lib/api';

type Notification = { id: string; type: string; title: string; message: string; caseId: string; caseNumber: string; href: string; createdAt: string; readAt?: string };

export default function FamilyNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const router = useRouter();

  async function load() {
    const response = await fetch(`${API_BASE_URL}/api/family/notifications`, { credentials: 'include' });
    const result = await response.json();
    if (response.status === 401) { router.replace('/auth/login?next=%2Ffamily%2Fnotifications'); return; }
    if (!response.ok) throw new Error(result.error || 'Unable to load notifications.');
    setItems(result.items);
    setUnreadCount(result.unreadCount);
  }

  useEffect(() => {
    load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load notifications.')).finally(() => setLoading(false));
  }, [router]);

  async function markRead(id: string) {
    setBusy(id); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/family/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update this notification.');
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - (items.find((item) => item.id === id && !item.readAt) ? 1 : 0)));
      setNotice('Notification marked as read.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update this notification.'); }
    finally { setBusy(''); }
  }

  async function markAllRead() {
    setBusy('all'); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/family/notifications/read-all`, { method: 'POST', credentials: 'include' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update notifications.');
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setUnreadCount(0); setNotice(`${result.markedRead} notification${result.markedRead === 1 ? '' : 's'} marked as read.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update notifications.'); }
    finally { setBusy(''); }
  }

  async function openNotification(item: Notification) {
    if (!item.readAt) await markRead(item.id);
    const destination = item.href.startsWith('/family/') || item.href.startsWith('/cases/') ? item.href : '/family/dashboard';
    router.push(destination);
  }

  return <div className="module-page family-notifications-page">
    <Link href="/family/dashboard" className="back-link"> Your cases</Link>
    <div className="page-header"><div><p className="eyebrow">FAMILY WORKSPACE</p><h1>Notifications</h1><p>{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You're up to date.'}</p></div>{unreadCount ? <button className="secondary-button" type="button" onClick={() => void markAllRead()} disabled={busy !== ''}>{busy === 'all' ? 'Updating...' : 'Mark all as read'}</button> : null}</div>
    <div className="prototype-banner"><strong>Private account updates</strong><span>Notification details are visible only after you sign in. Email alerts, when configured, contain no private case information.</span></div>
    {error ? <p className="status-message error" role="alert">{error}</p> : null}
    {notice ? <p className="status-message" role="status">{notice}</p> : null}
    {loading ? <div className="empty-state">Loading notifications...</div> : items.length ? <section className="family-notification-list" aria-label="Your notifications">{items.map((item) => <article className={`family-notification-card${item.readAt ? ' is-read' : ' is-unread'}`} key={item.id}>
      <button className="notification-open" type="button" onClick={() => void openNotification(item)}><span className="notification-type">{item.type}</span><strong>{item.title}</strong><span className="notification-message">{item.message}</span><span className="notification-meta">{item.caseNumber} - {new Date(item.createdAt).toLocaleString()}</span></button>
      {!item.readAt ? <button className="notification-mark-read" type="button" onClick={() => void markRead(item.id)} disabled={busy !== ''}>{busy === item.id ? 'Saving...' : 'Mark read'}</button> : <span className="notification-read-label">Read</span>}
    </article>)}</section> : !error ? <div className="empty-state"><h3>No notifications yet</h3><p>New sightings and case review decisions will appear here.</p></div> : null}
  </div>;
}
