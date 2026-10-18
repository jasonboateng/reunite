import { MongoClient, type Db } from 'mongodb';

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || process.env.MONGODB_DB || undefined;

/** Create the initial REUNITE collections if they do not exist, then add their indexes. */
async function ensureCollections(db: Db) {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  const required = ['users', 'sessions', 'cases', 'sightings', 'mediaAssets', 'moderatorInvitations', 'moderationActions', 'auditLogs', 'notifications'];

  for (const name of required) {
    if (!existing.has(name)) await db.createCollection(name);
  }

  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } }, name: 'users_email_unique' }),
    db.collection('users').createIndex({ id: 1 }, { unique: true, name: 'users_id_unique' }),
    db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true, name: 'sessions_token_unique' }),
    db.collection('sessions').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0, name: 'sessions_expiry' }),
    db.collection('cases').createIndex({ caseNumber: 1 }, { unique: true, partialFilterExpression: { caseNumber: { $type: 'string' } }, name: 'cases_case_number_unique' }),
    db.collection('cases').createIndex({ status: 1, region: 1 }, { name: 'cases_status_region' }),
    db.collection('cases').createIndex({ status: 1, reviewState: 1, createdAt: 1 }, { name: 'cases_intake_review_queue' }),
    db.collection('cases').createIndex({ ownerId: 1, createdAt: -1 }, { name: 'cases_family_dashboard' }),
    db.collection('sightings').createIndex({ caseId: 1, status: 1, submittedAt: -1 }, { name: 'sightings_case_review' }),
    db.collection('mediaAssets').createIndex({ id: 1 }, { unique: true, name: 'media_asset_id' }),
    db.collection('mediaAssets').createIndex({ publicId: 1 }, { unique: true, name: 'media_asset_public_id' }),
    db.collection('mediaAssets').createIndex({ caseId: 1, kind: 1, createdAt: -1 }, { name: 'media_case_assets' }),
    db.collection('moderatorInvitations').createIndex({ caseId: 1, email: 1, status: 1 }, { name: 'moderator_invites_case_email_status' }),
    db.collection('moderatorInvitations').createIndex({ tokenHash: 1 }, { unique: true, partialFilterExpression: { tokenHash: { $type: 'string' } }, name: 'moderator_invite_token_unique' }),
    db.collection('moderatorInvitations').createIndex({ moderatorId: 1, status: 1 }, { name: 'moderator_assignments' }),
    db.collection('moderationActions').createIndex({ caseId: 1, type: 1, createdAt: -1 }, { name: 'moderation_case_actions' }),
    db.collection('moderationActions').createIndex({ sightingId: 1, createdAt: -1 }, { name: 'moderation_sighting_actions' }),
    db.collection('auditLogs').createIndex({ entityType: 1, entityId: 1, createdAt: -1 }, { name: 'audit_entity_timeline' }),
    db.collection('auditLogs').createIndex({ createdAt: -1, id: -1 }, { name: 'audit_recent_events' }),
    db.collection('notifications').createIndex({ userId: 1, createdAt: -1 }, { name: 'family_notifications' }),
    db.collection('notifications').createIndex({ userId: 1, readAt: 1 }, { name: 'family_notifications_unread' }),
    db.collection('notifications').createIndex({ eventKey: 1 }, { unique: true, partialFilterExpression: { eventKey: { $type: 'string' } }, name: 'family_notification_event_unique' })
  ]);
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db } | null> {
  if (!mongoUri) {
    console.error('MONGODB_URI is not configured; API cannot start without MongoDB.');
    return null;
  }

  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db(databaseName);
    await ensureCollections(db);
    console.log(`MongoDB connected; REUNITE collections are ready in database "${db.databaseName}".`);
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}
