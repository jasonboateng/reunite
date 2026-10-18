import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Db } from 'mongodb';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'reunite_session';
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type AppRole = 'family' | 'moderator' | 'reviewer' | 'admin';
export type AppUser = { id: string; name: string; email: string; role: AppRole; roles?: AppRole[]; createdAt: string; passwordHash: string };
type Session = { tokenHash: string; userId: string; expireAt: Date; createdAt: string };
type AuthOptions = { db: Db };

function readCookie(request: FastifyRequest, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

export function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(reply: FastifyReply, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_LIFETIME_MS / 1000}${secure}`);
}

export async function getAuthenticatedUser(request: FastifyRequest, db: Db): Promise<Pick<AppUser, 'id' | 'name' | 'email' | 'role' | 'roles'> | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await db.collection<Session>('sessions').findOne({ tokenHash: tokenDigest(token), expireAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await db.collection<AppUser>('users').findOne({ id: session.userId });
  return user ? { id: user.id, name: user.name, email: user.email, role: user.role, roles: user.roles ?? [user.role] } : null;
}

export async function getFamilyUser(request: FastifyRequest, db: Db) {
  const user = await getAuthenticatedUser(request, db);
  return user && (user.roles ?? [user.role]).includes('family') ? user : null;
}

export async function getModeratorUser(request: FastifyRequest, db: Db) {
  const user = await getAuthenticatedUser(request, db);
  return user && (user.roles ?? [user.role]).includes('moderator') ? user : null;
}

export async function getReviewerUser(request: FastifyRequest, db: Db) {
  const user = await getAuthenticatedUser(request, db);
  return user && (user.roles ?? [user.role]).includes('reviewer') ? user : null;
}

export async function getAdminUser(request: FastifyRequest, db: Db) {
  const user = await getAuthenticatedUser(request, db);
  return user && (user.roles ?? [user.role]).includes('admin') ? user : null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [scheme, salt, expected] = encoded.split(':');
  if (scheme !== 'scrypt' || !salt || !expected) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

export async function createSession(db: Db, userId: string, reply: FastifyReply) {
  const token = randomBytes(32).toString('base64url');
  const createdAt = new Date();
  await db.collection<Session>('sessions').insertOne({
    tokenHash: tokenDigest(token),
    userId,
    createdAt: createdAt.toISOString(),
    expireAt: new Date(createdAt.getTime() + SESSION_LIFETIME_MS)
  });
  setSessionCookie(reply, token);
}

const authRoutes: FastifyPluginAsync<AuthOptions> = async (fastify, { db }) => {
  const users = db.collection<AppUser>('users');

  fastify.post('/api/auth/register', async (request, reply) => {
    const body = request.body as { name?: unknown; email?: unknown; password?: unknown } | undefined;
    if (!body || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 100
      || typeof body.email !== 'string' || body.email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
      || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) {
      return reply.code(400).send({ error: 'Enter your name, a valid email address, and a password of at least 12 characters.' });
    }

    const email = body.email.trim().toLowerCase();
    const existingUser = await users.findOne({ email }, { projection: { id: 1 } });
    if (existingUser) return reply.code(409).send({ error: 'An account with this email already exists. Sign in instead.' });

    const user: AppUser = {
      id: randomUUID(),
      name: body.name.trim(),
      email,
      role: 'family',
      roles: ['family'],
      passwordHash: await hashPassword(body.password),
      createdAt: new Date().toISOString()
    };
    try {
      await users.insertOne(user);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return reply.code(409).send({ error: 'An account with this email already exists. Sign in instead.' });
      throw error;
    }
    await createSession(db, user.id, reply);
    return reply.code(201).send({ user: { id: user.id, name: user.name, email: user.email, role: user.role, roles: user.roles } });
  });

  fastify.post('/api/auth/login', async (request, reply) => {
    const body = request.body as { email?: unknown; password?: unknown } | undefined;
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length > 128) {
      return reply.code(400).send({ error: 'Enter your email address and password.' });
    }
    const user = await users.findOne({ email: body.email.trim().toLowerCase() });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Email or password is incorrect.' });
    }
    await createSession(db, user.id, reply);
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role, roles: user.roles ?? [user.role] } };
  });

  fastify.get('/api/auth/me', async (request, reply) => {
    const user = await getAuthenticatedUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to continue.' });
    return { user };
  });

  fastify.post('/api/auth/logout', async (request, reply) => {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) await db.collection<Session>('sessions').deleteOne({ tokenHash: tokenDigest(token) });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    reply.header('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
    return reply.code(204).send();
  });
};

export default authRoutes;

