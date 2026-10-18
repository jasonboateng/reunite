import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { getAdminUser, getAuthenticatedUser } from './auth.js';

type Options = { db: Db };
type AdminUser = { id: string; name: string; email: string; role: 'family' | 'moderator' | 'reviewer' | 'admin'; roles?: Array<'family' | 'moderator' | 'reviewer' | 'admin'>; createdAt: string };

const adminRoutes: FastifyPluginAsync<Options> = async (fastify, { db }) => {
  const users = db.collection<AdminUser>('users');
  const cases = db.collection<{ id: string; status: string; visibility?: string }>('cases');
  const auditLogs = db.collection('auditLogs');

  async function adminGate(request: FastifyRequest, reply: FastifyReply) {
    const signedIn = await getAuthenticatedUser(request, db);
    if (!signedIn) { reply.code(401).send({ error: 'Sign in to access platform administration.' }); return null; }
    const admin = await getAdminUser(request, db);
    if (!admin) { reply.code(403).send({ error: 'This account does not have administrator access.' }); return null; }
    return admin;
  }

  fastify.get('/api/admin/overview', async (request, reply) => {
    const admin = await adminGate(request, reply);
    if (!admin) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [usersTotal, reviewers, pendingCases, publicCases, foundCases, audit24h, moderationActions] = await Promise.all([
      users.countDocuments(),
      users.countDocuments({ roles: 'reviewer' }),
      cases.countDocuments({ status: 'Review' }),
      cases.countDocuments({ visibility: 'public', status: 'Active' }),
      cases.countDocuments({ status: 'Found' }),
      auditLogs.countDocuments({ createdAt: { $gte: since } }),
      db.collection('moderationActions').countDocuments()
    ]);
    return { generatedAt: new Date().toISOString(), metrics: { users: usersTotal, reviewers, pendingCases, publicCases, foundCases, auditEventsLast24Hours: audit24h, moderationActions } };
  });

  fastify.get('/api/admin/users', async (request, reply) => {
    const admin = await adminGate(request, reply);
    if (!admin) return;
    const { email } = request.query as { email?: string };
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const filter: any = normalizedEmail ? { email: normalizedEmail } : { roles: { $in: ['reviewer'] as const } };
    const items = await users.find(filter, { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, roles: 1, createdAt: 1 } })
      .sort({ createdAt: -1 }).limit(100).toArray();
    return { total: items.length, items: items.map((user) => ({ ...user, roles: user.roles ?? [user.role] })) };
  });

  fastify.patch('/api/admin/users/:userId/reviewer-access', async (request, reply) => {
    const admin = await adminGate(request, reply);
    if (!admin) return;
    const { userId } = request.params as { userId: string };
    const body = request.body as { enabled?: unknown } | undefined;
    if (!body || typeof body.enabled !== 'boolean') return reply.code(400).send({ error: 'Choose whether reviewer access should be enabled.' });
    const target = await users.findOne({ id: userId }, { projection: { _id: 0, id: 1, email: 1, name: 1, role: 1, roles: 1 } });
    if (!target) return reply.code(404).send({ error: 'This account was not found.' });
    const currentRoles = target.roles ?? [target.role];
    const hasReviewer = currentRoles.includes('reviewer');
    if (hasReviewer === body.enabled) return { user: { id: target.id, name: target.name, email: target.email, roles: currentRoles }, changed: false };
    const roles = body.enabled ? Array.from(new Set([...currentRoles, 'reviewer' as const])) : currentRoles.filter((role) => role !== 'reviewer');
    if (!roles.length) return reply.code(409).send({ error: 'Reviewer access cannot be the account's only role. Preserve a family, moderator, or admin role.' });
    const now = new Date().toISOString();
    const roleFilter = target.roles ? { roles: target.roles } : { role: target.role, roles: { $exists: false } };
    const primaryRole = roles.includes(target.role) ? target.role : roles[0];
    const saved = await users.updateOne({ id: userId, ...roleFilter }, { $set: { roles, role: primaryRole } });
    if (saved.modifiedCount !== 1) return reply.code(409).send({ error: 'This account's roles changed while you were updating them. Reload and try again.' });
    await auditLogs.insertOne({
      id: randomUUID(), actorId: admin.id, action: body.enabled ? 'reviewer.role-granted' : 'reviewer.role-revoked',
      entityType: 'user', entityId: userId, email: target.email, roles, createdAt: now
    });
    request.log.info({ adminId: admin.id, userId, reviewerEnabled: body.enabled }, 'Administrator changed reviewer access');
    return { user: { id: target.id, name: target.name, email: target.email, roles }, changed: true };
  });

  fastify.get('/api/admin/audit', async (request, reply) => {
    const admin = await adminGate(request, reply);
    if (!admin) return;
    const query = request.query as { offset?: string; limit?: string; action?: string };
    const parsedOffset = Number.parseInt(query.offset ?? '0', 10);
    const parsedLimit = Number.parseInt(query.limit ?? '50', 10);
    const offset = Number.isFinite(parsedOffset) ? Math.max(0, Math.min(parsedOffset, 100000)) : 0;
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 100)) : 50;
    const action = typeof query.action === 'string' ? query.action.trim().slice(0, 100) : '';
    const filter = action ? { action } : {};
    const [items, total] = await Promise.all([
      auditLogs.find(filter, { projection: { _id: 0, id: 1, actorId: 1, action: 1, entityType: 1, entityId: 1, caseId: 1, inviteId: 1, moderationActionId: 1, email: 1, invitedEmail: 1, roles: 1, before: 1, after: 1, assessment: 1, severity: 1, createdAt: 1 } })
        .sort({ createdAt: -1, id: -1 }).skip(offset).limit(limit).toArray(),
      auditLogs.countDocuments(filter)
    ]);
    return { items, total, offset, limit, pageSize: limit };
  });
};

export default adminRoutes;
