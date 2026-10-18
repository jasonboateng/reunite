import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

type UserRecord = { id: string; email: string; role: 'family' | 'moderator' | 'reviewer' | 'admin'; roles?: Array<'family' | 'moderator' | 'reviewer' | 'admin'> };

const revoke = process.argv[2] === '--revoke';
const email = process.argv[revoke ? 3 : 2]?.trim().toLowerCase();
const mongoUri = process.env.MONGODB_URI;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Usage: npm --workspace apps/api run reviewer:${revoke ? 'revoke' : 'grant'} -- person@example.com`);
  process.exit(1);
}
if (!mongoUri) {
  console.error('MONGODB_URI is required. Run this command from the configured API workspace.');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(mongoUri as string);
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE || process.env.MONGODB_DB || undefined);
    const users = db.collection<UserRecord>('users');
    const user = await users.findOne({ email }, { projection: { id: 1, email: 1, role: 1, roles: 1 } });
    if (!user) {
      console.error(`No account exists for ${email}. The account holder must register before reviewer access can be changed.`);
      process.exitCode = 1;
      return;
    }
    const currentRoles = user.roles ?? [user.role];
    const roles = revoke ? currentRoles.filter((role) => role !== 'reviewer') : Array.from(new Set([...currentRoles, 'reviewer' as const]));
    if (currentRoles.includes('reviewer') === !revoke) {
      console.log(`${email} ${revoke ? 'does not have' : 'already has'} reviewer access.`);
      return;
    }
    await users.updateOne({ id: user.id }, { $set: { roles } });
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: 'operator-cli', action: revoke ? 'reviewer.role-revoked' : 'reviewer.role-granted',
      entityType: 'user', entityId: user.id, email: user.email, roles, createdAt: new Date().toISOString()
    });
    console.log(`Reviewer access ${revoke ? 'revoked' : 'granted'} for ${email}.`);
  } catch {
    console.error('Could not change reviewer access. Check the MongoDB connection and account details.');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

void main();
