import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

type Role = 'family' | 'moderator' | 'reviewer' | 'admin';
type UserRecord = { id: string; email: string; role: Role; roles?: Role[] };

const revoke = process.argv[2] === '--revoke';
const email = process.argv[revoke ? 3 : 2]?.trim().toLowerCase();
const mongoUri = process.env.MONGODB_URI;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Usage: npm --workspace apps/api run admin:${revoke ? 'revoke' : 'grant'} -- person@example.com`);
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
      console.error(`No account exists for ${email}. The account holder must register before administrator access can be changed.`);
      process.exitCode = 1;
      return;
    }
    const currentRoles = user.roles ?? [user.role];
    const hasAdmin = currentRoles.includes('admin');
    if (hasAdmin === !revoke) {
      console.log(`${email} ${revoke ? 'does not have' : 'already has'} administrator access.`);
      return;
    }
    if (revoke && await users.countDocuments({ $or: [{ role: 'admin' }, { roles: 'admin' }] }) <= 1) {
      console.error('Cannot revoke the last administrator account. Grant admin access to another trusted account first.');
      process.exitCode = 1;
      return;
    }
    const roles = revoke ? currentRoles.filter((role) => role !== 'admin') : Array.from(new Set([...currentRoles, 'admin' as const]));
    if (!roles.length) {
      console.error('Administrator access cannot be the account’s only role.');
      process.exitCode = 1;
      return;
    }
    const role = roles.includes(user.role) ? user.role : roles[0];
    const roleFilter = user.roles ? { roles: user.roles } : { role: user.role, roles: { $exists: false } };
    const saved = await users.updateOne({ id: user.id, ...roleFilter }, { $set: { role, roles } });
    if (saved.modifiedCount !== 1) {
      console.error('This account’s roles changed while you were updating them. Reload and try again.');
      process.exitCode = 1;
      return;
    }
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: 'operator-cli', action: revoke ? 'admin.role-revoked' : 'admin.role-granted',
      entityType: 'user', entityId: user.id, email: user.email, roles, createdAt: new Date().toISOString()
    });
    console.log(`Administrator access ${revoke ? 'revoked' : 'granted'} for ${email}.`);
  } catch {
    console.error('Could not change administrator access. Check the MongoDB connection and account details.');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

void main();
