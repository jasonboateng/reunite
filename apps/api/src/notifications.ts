import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { sendFamilyNotificationEmail } from './email.js';

export type FamilyNotificationInput = {
  userId: string;
  caseId: string;
  caseNumber: string;
  eventKey: string;
  type: 'sighting' | 'review' | 'publication' | 'moderator';
  title: string;
  message: string;
  href: string;
};

export async function createFamilyNotification(db: Db, input: FamilyNotificationInput) {
  const notifications = db.collection('notifications');
  const now = new Date().toISOString();
  const notificationId = randomUUID();
  try {
    await notifications.insertOne({
      id: notificationId, ...input, createdAt: now,
      emailStatus: process.env.SMTP_HOST ? 'pending' : 'not-configured'
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return;
    throw error;
  }
  if (!process.env.SMTP_HOST) return;

  void deliverNotificationEmail(db, notifications, notificationId, input);
}

async function deliverNotificationEmail(db: Db, notifications: ReturnType<Db['collection']>, notificationId: string, input: FamilyNotificationInput) {
  try {
    const user = await db.collection<{ id: string; email: string }>('users').findOne({ id: input.userId }, { projection: { email: 1 } });
    if (!user?.email) {
      await notifications.updateOne({ id: notificationId }, { $set: { emailStatus: 'unavailable' } });
      return;
    }
    const sent = await sendFamilyNotificationEmail({ to: user.email, caseNumber: input.caseNumber });
    await notifications.updateOne({ id: notificationId }, { $set: { emailStatus: sent ? 'sent' : 'not-configured' } });
  } catch {
    await notifications.updateOne({ id: notificationId }, { $set: { emailStatus: 'failed' } });
    console.warn(`Family notification email delivery failed for notification ${notificationId}.`);
  }
}
