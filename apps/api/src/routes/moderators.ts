import { randomBytes, randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { FastifyPluginAsync } from 'fastify';
import { AppUser, createSession, getAuthenticatedUser, getFamilyUser, getModeratorUser, hashPassword, tokenDigest, verifyPassword } from './auth.js';
import { sendModeratorInvitationEmail } from '../email.js';
import { createFamilyNotification } from '../notifications.js';

type Options = { db: Db };
type CaseForAccess = { id: string; caseNumber: string; name: string; age: string; region: string; lastSeen: string; status: string; description?: string; imageAssetId?: string; createdAt: string; visibility?: 'private' | 'public'; publicProfile?: { fields: string[]; summary: string; requested: boolean; requestedAt: string } };
type ReviewSighting = { id: string; caseId: string; description: string; observedAt: string; location: string; latitude: number; longitude: number; status: string; public: boolean; submittedAt: string };
type Invitation = {
  id: string;
  tokenHash?: string;
  caseId: string;
  caseNumber: string;
  email: string;
  invitedBy: string;
  moderatorId?: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: Date;
  acceptedAt?: string;
};

const moderatorRoutes: FastifyPluginAsync<Options> = async (fastify, { db }) => {
  const cases = db.collection<CaseForAccess & { ownerId: string }>('cases');
  const invitations = db.collection<Invitation>('moderatorInvitations');
  const users = db.collection<AppUser>('users');
  const sightings = db.collection<ReviewSighting>('sightings');
  const moderationActions = db.collection('moderationActions');

  fastify.get('/api/family/cases/:caseId/moderators', async (request, reply) => {
    const family = await getFamilyUser(request, db);
    if (!family) return reply.code(401).send({ error: 'Sign in to manage case moderators.' });
    const { caseId } = request.params as { caseId: string };
    const ownedCase = await cases.findOne({ id: caseId, ownerId: family.id }, { projection: { id: 1, caseNumber: 1, name: 1 } });
    if (!ownedCase) return reply.code(404).send({ error: 'This family case was not found.' });
    const records = await invitations.find({ caseId }, {
      projection: { _id: 0, id: 1, email: 1, status: 1, createdAt: 1, expiresAt: 1, acceptedAt: 1 }
    }).sort({ createdAt: -1 }).toArray();
    const now = new Date();
    const items = records.map((item) => ({
      ...item,
      status: item.status === 'pending' && item.expiresAt <= now ? 'expired' : item.status
    }));
    return { case: ownedCase, items };
  });

  fastify.post('/api/family/cases/:caseId/moderators/invitations', async (request, reply) => {
    const family = await getFamilyUser(request, db);
    if (!family) return reply.code(401).send({ error: 'Sign in to invite a case moderator.' });
    const { caseId } = request.params as { caseId: string };
    const body = request.body as { email?: unknown } | undefined;
    if (!body || typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
      return reply.code(400).send({ error: 'Enter a valid email address for the moderator.' });
    }
    const email = body.email.trim().toLowerCase();
    if (email === family.email) return reply.code(400).send({ error: 'You cannot invite your own family account as a moderator.' });
    const ownedCase = await cases.findOne({ id: caseId, ownerId: family.id }, { projection: { id: 1, caseNumber: 1, name: 1 } });
    if (!ownedCase) return reply.code(404).send({ error: 'This family case was not found.' });

    const existingModerator = await users.findOne({ email, $or: [{ role: 'moderator' }, { roles: 'moderator' }] }, { projection: { id: 1 } });
    const duplicate = await invitations.findOne({ caseId, email, status: 'pending', expiresAt: { $gt: new Date() } });
    if (duplicate) return reply.code(409).send({ error: 'An invitation for this email is already pending. Revoke it before creating a replacement.' });
    if (existingModerator) {
      const alreadyAssigned = await invitations.findOne({ caseId, email, moderatorId: existingModerator.id, status: 'accepted' }, { projection: { id: 1 } });
      if (alreadyAssigned) return reply.code(409).send({ error: 'This moderator already has access to the case.' });
    }

    const now = new Date();
    const invitationId = randomUUID();
    if (existingModerator) {
      const invitation: Invitation = {
        id: invitationId, caseId, caseNumber: ownedCase.caseNumber, email, invitedBy: family.id,
        moderatorId: existingModerator.id, status: 'accepted', createdAt: now.toISOString(),
        acceptedAt: now.toISOString(), expiresAt: now
      };
      await invitations.insertOne(invitation);
      await db.collection('auditLogs').insertOne({ id: randomUUID(), actorId: family.id, action: 'moderator.assigned', entityType: 'case', entityId: caseId, inviteId: invitationId, invitedEmail: email, createdAt: now.toISOString() });
      return reply.code(201).send({ assigned: true, invitation: { id: invitationId, email, status: 'accepted', acceptedAt: invitation.acceptedAt } });
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const invitation: Invitation = {
      id: invitationId, tokenHash: tokenDigest(token), caseId, caseNumber: ownedCase.caseNumber,
      email, invitedBy: family.id, status: 'pending', createdAt: now.toISOString(), expiresAt
    };
    await invitations.insertOne(invitation);
    await db.collection('auditLogs').insertOne({ id: randomUUID(), actorId: family.id, action: 'moderator.invited', entityType: 'case', entityId: caseId, inviteId: invitationId, invitedEmail: email, expiresAt, createdAt: now.toISOString() });
    const origin = process.env.FRONTEND_ORIGIN ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    const inviteUrl = `${origin.replace(/\/$/, '')}/moderation/invitations/${token}`;
    let emailSent = false;
    try {
      emailSent = await sendModeratorInvitationEmail({ to: email, caseNumber: ownedCase.caseNumber, inviteUrl, expiresAt });
    } catch {
      request.log.warn({ caseId, invitationId }, 'Moderator invitation email could not be delivered; manual link remains available');
    }
    return reply.code(201).send({
      assigned: false,
      invitation: { id: invitationId, email, status: 'pending', expiresAt },
      inviteUrl,
      emailSent
    });
  });

  fastify.delete('/api/family/cases/:caseId/moderators/invitations/:invitationId', async (request, reply) => {
    const family = await getFamilyUser(request, db);
    if (!family) return reply.code(401).send({ error: 'Sign in to manage case moderator access.' });
    const { caseId, invitationId } = request.params as { caseId: string; invitationId: string };
    const ownedCase = await cases.findOne({ id: caseId, ownerId: family.id }, { projection: { id: 1 } });
    if (!ownedCase) return reply.code(404).send({ error: 'This family case was not found.' });
    const invitation = await invitations.findOne({ id: invitationId, caseId, status: { $in: ['pending', 'accepted'] } }, {
      projection: { id: 1, email: 1, status: 1 }
    });
    if (!invitation) return reply.code(404).send({ error: 'An active invitation or moderator assignment with that reference was not found.' });
    const now = new Date().toISOString();
    const result = await invitations.updateOne(
      { id: invitationId, caseId, status: invitation.status },
      { $set: { status: 'revoked', revokedAt: now }, $unset: { tokenHash: '' } }
    );
    if (result.matchedCount !== 1) return reply.code(404).send({ error: 'A pending invitation with that reference was not found.' });
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: family.id,
      action: invitation.status === 'accepted' ? 'moderator.assignment-revoked' : 'moderator.invitation-revoked',
      entityType: 'case', entityId: caseId, inviteId: invitationId, invitedEmail: invitation.email, createdAt: now
    });
    return reply.code(204).send();
  });

  fastify.get('/api/moderation/invitations/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const invitation = await invitations.findOne({ tokenHash: tokenDigest(token), status: 'pending', expiresAt: { $gt: new Date() } });
    if (!invitation) return reply.code(410).send({ error: 'This invitation is invalid, expired, or has already been used.' });
    const caseInfo = await cases.findOne({ id: invitation.caseId }, { projection: { _id: 0, caseNumber: 1, name: 1 } });
    return { email: invitation.email, caseNumber: invitation.caseNumber, personName: caseInfo?.name ?? 'a missing person', expiresAt: invitation.expiresAt };
  });

  fastify.post('/api/moderation/invitations/:token/accept', async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = request.body as { name?: unknown; password?: unknown } | undefined;
    if (!body || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128
      || (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 100))) {
      return reply.code(400).send({ error: 'Use a password of at least 12 characters and enter your name if you are creating an account.' });
    }
    const invitation = await invitations.findOne({ tokenHash: tokenDigest(token), status: 'pending', expiresAt: { $gt: new Date() } });
    if (!invitation) return reply.code(410).send({ error: 'This invitation is invalid, expired, or has already been used.' });

    const existingUser = await users.findOne({ email: invitation.email });
    let user: AppUser;
    let rolesToSave: Array<'family' | 'moderator' | 'reviewer' | 'admin'> | undefined;
    if (existingUser) {
      if (!(await verifyPassword(body.password, existingUser.passwordHash))) return reply.code(401).send({ error: 'This email already has an account. Enter its current password to accept the invitation.' });
      user = existingUser;
      rolesToSave = Array.from(new Set([...(user.roles ?? [user.role]), 'moderator' as const]));
    } else {
      if (typeof body.name !== 'string' || body.name.trim().length < 2) return reply.code(400).send({ error: 'Enter your name to create your moderator account.' });
      user = {
        id: randomUUID(), name: body.name.trim(), email: invitation.email, role: 'moderator', roles: ['moderator'],
        passwordHash: await hashPassword(body.password), createdAt: new Date().toISOString()
      };
      try {
        await users.insertOne(user);
      } catch (error) {
        if ((error as { code?: number }).code === 11000) return reply.code(409).send({ error: 'An account with this email was just created. Sign in, then reopen the invitation.' });
        throw error;
      }
    }

    const acceptedAt = new Date().toISOString();
    const consumed = await invitations.updateOne(
      { id: invitation.id, status: 'pending', expiresAt: { $gt: new Date() } },
      { $set: { status: 'accepted', moderatorId: user.id, acceptedAt }, $unset: { tokenHash: '' } }
    );
    if (consumed.modifiedCount !== 1) return reply.code(409).send({ error: 'This invitation was already accepted. Sign in to continue.' });
    if (rolesToSave) {
      await users.updateOne({ id: user.id }, { $set: { roles: rolesToSave } });
      user = { ...user, roles: rolesToSave };
    }
    await db.collection('auditLogs').insertOne({ id: randomUUID(), actorId: user.id, action: 'moderator.invitation-accepted', entityType: 'case', entityId: invitation.caseId, inviteId: invitation.id, invitedBy: invitation.invitedBy, createdAt: acceptedAt });
    const familyCase = await cases.findOne({ id: invitation.caseId }, { projection: { ownerId: 1, caseNumber: 1 } });
    if (familyCase) await createFamilyNotification(db, {
      userId: familyCase.ownerId, caseId: invitation.caseId, caseNumber: familyCase.caseNumber,
      eventKey: `moderator-accepted:${invitation.id}`, type: 'moderator', title: 'Moderator invitation accepted',
      message: `A moderator accepted your invitation to support case ${familyCase.caseNumber}.`,
      href: `/family/cases/${encodeURIComponent(invitation.caseId)}/moderators`
    });
    await createSession(db, user.id, reply);
    return reply.code(200).send({ user: { id: user.id, name: user.name, email: user.email, role: user.role, roles: user.roles ?? [user.role] } });
  });

  fastify.get('/api/moderation/cases', async (request, reply) => {
    const signedIn = await getAuthenticatedUser(request, db);
    if (!signedIn) return reply.code(401).send({ error: 'Sign in to access moderator cases.' });
    const moderator = await getModeratorUser(request, db);
    if (!moderator) return reply.code(403).send({ error: 'This account does not have moderator access.' });
    const assignments = await invitations.find({ moderatorId: moderator.id, status: 'accepted' }, { projection: { caseId: 1 } }).toArray();
    const ids = Array.from(new Set(assignments.map((item) => item.caseId)));
    const items = ids.length ? await cases.find({ id: { $in: ids } }, {
      projection: { _id: 0, id: 1, caseNumber: 1, name: 1, age: 1, region: 1, lastSeen: 1, status: 1, createdAt: 1 }
    }).sort({ createdAt: -1 }).toArray() : [];
    return { total: items.length, items };
  });

  fastify.get('/api/moderation/cases/:caseId', async (request, reply) => {
    const signedIn = await getAuthenticatedUser(request, db);
    if (!signedIn) return reply.code(401).send({ error: 'Sign in to access moderator cases.' });
    const moderator = await getModeratorUser(request, db);
    if (!moderator) return reply.code(403).send({ error: 'This account does not have moderator access.' });
    const { caseId } = request.params as { caseId: string };
    const assigned = await invitations.findOne({ caseId, moderatorId: moderator.id, status: 'accepted' }, { projection: { id: 1 } });
    if (!assigned) return reply.code(404).send({ error: 'This case is not assigned to your moderator account.' });
    const caseInfo = await cases.findOne({ id: caseId }, { projection: { _id: 0, id: 1, caseNumber: 1, name: 1, age: 1, region: 1, lastSeen: 1, status: 1, description: 1, imageAssetId: 1, createdAt: 1, visibility: 1, publicProfile: 1 } });
    if (!caseInfo) return reply.code(404).send({ error: 'This case was not found.' });
    const [caseSightings, actions] = await Promise.all([
      sightings.find({ caseId }, { projection: { _id: 0 } }).sort({ submittedAt: -1 }).toArray(),
      moderationActions.find({ caseId }).sort({ createdAt: -1 }).limit(100).toArray()
    ]);
    return { case: caseInfo, sightings: caseSightings, actions };
  });

  fastify.post('/api/moderation/cases/:caseId/publication', async (request, reply) => {
    const signedIn = await getAuthenticatedUser(request, db);
    if (!signedIn) return reply.code(401).send({ error: 'Sign in to publish an assigned case.' });
    const moderator = await getModeratorUser(request, db);
    if (!moderator) return reply.code(403).send({ error: 'This account does not have moderator access.' });
    const { caseId } = request.params as { caseId: string };
    const assigned = await invitations.findOne({ caseId, moderatorId: moderator.id, status: 'accepted' }, { projection: { id: 1 } });
    if (!assigned) return reply.code(404).send({ error: 'This case is not assigned to your moderator account.' });
    const caseInfo = await cases.findOne({ id: caseId });
    if (!caseInfo) return reply.code(404).send({ error: 'This case was not found.' });
    if (!caseInfo.publicProfile?.requested || !caseInfo.publicProfile.fields.includes('name')) {
      return reply.code(409).send({ error: 'The family has not requested publication with a selected public name.' });
    }
    if (caseInfo.status === 'Urgent') return reply.code(409).send({ error: 'Resolve the urgent case status before publishing.' });
    if (caseInfo.visibility === 'public' && caseInfo.status === 'Active') return { message: 'This case is already published.', case: { id: caseId, status: caseInfo.status, visibility: caseInfo.visibility } };
    if (caseInfo.status !== 'Review') return reply.code(409).send({ error: 'Only a case awaiting review can be published.' });

    const now = new Date().toISOString();
    const updated = await cases.updateOne(
      { id: caseId, 'publicProfile.requested': true, 'publicProfile.requestedAt': caseInfo.publicProfile.requestedAt, 'publicProfile.fields': 'name', status: 'Review' },
      { $set: { visibility: 'public', status: 'Active', publishedAt: now, publishedBy: moderator.id, updatedAt: now } }
    );
    if (updated.modifiedCount !== 1) return reply.code(409).send({ error: "The family's publication settings or case status changed. Reload and review again." });
    const action = { id: randomUUID(), type: 'case-published', caseId, moderatorId: moderator.id, createdAt: now };
    await moderationActions.insertOne(action);
    await db.collection('auditLogs').insertOne({ id: randomUUID(), actorId: moderator.id, action: 'moderator.case-published', entityType: 'case', entityId: caseId, moderationActionId: action.id, createdAt: now });
    await createFamilyNotification(db, {
      userId: caseInfo.ownerId, caseId, caseNumber: caseInfo.caseNumber, eventKey: `moderator-published:${caseId}:${now}`,
      type: 'publication', title: 'Your case is now public', message: 'Your assigned moderator verified and published the public details you selected.',
      href: `/cases/${encodeURIComponent(caseId)}`
    });
    request.log.info({ caseId, moderatorId: moderator.id }, 'Moderator published family-approved case');
    return { message: 'Case verified and published using the family-selected public details.', case: { id: caseId, status: 'Active', visibility: 'public' } };
  });

  fastify.post('/api/moderation/cases/:caseId/sightings/:sightingId/reviews', async (request, reply) => {
    const signedIn = await getAuthenticatedUser(request, db);
    if (!signedIn) return reply.code(401).send({ error: 'Sign in to review assigned sightings.' });
    const moderator = await getModeratorUser(request, db);
    if (!moderator) return reply.code(403).send({ error: 'This account does not have moderator access.' });
    const { caseId, sightingId } = request.params as { caseId: string; sightingId: string };
    const body = request.body as { assessment?: unknown; note?: unknown } | undefined;
    const assessments = ['credible-lead', 'inconclusive', 'requires-follow-up'];
    if (!body || typeof body.assessment !== 'string' || !assessments.includes(body.assessment)
      || typeof body.note !== 'string' || body.note.trim().length < 10 || body.note.length > 1200) {
      return reply.code(400).send({ error: 'Choose an assessment and add a private note of 10 to 1,200 characters.' });
    }
    const assigned = await invitations.findOne({ caseId, moderatorId: moderator.id, status: 'accepted' }, { projection: { id: 1 } });
    if (!assigned) return reply.code(404).send({ error: 'This case is not assigned to your moderator account.' });
    const sighting = await sightings.findOne({ id: sightingId, caseId }, { projection: { id: 1 } });
    if (!sighting) return reply.code(404).send({ error: 'This sighting was not found on the assigned case.' });

    const action = {
      id: randomUUID(), type: 'sighting-assessment', caseId, sightingId, moderatorId: moderator.id,
      assessment: body.assessment, note: body.note.trim(), createdAt: new Date().toISOString()
    };
    await moderationActions.insertOne(action);
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: moderator.id, action: 'moderator.sighting-assessed', entityType: 'sighting',
      entityId: sightingId, caseId, moderationActionId: action.id, assessment: action.assessment, createdAt: action.createdAt
    });
    request.log.info({ caseId, sightingId, moderatorId: moderator.id, assessment: action.assessment }, 'Moderator recorded private sighting assessment');
    return reply.code(201).send({ action });
  });

  fastify.post('/api/moderation/cases/:caseId/escalations', async (request, reply) => {
    const signedIn = await getAuthenticatedUser(request, db);
    if (!signedIn) return reply.code(401).send({ error: 'Sign in to escalate an assigned case.' });
    const moderator = await getModeratorUser(request, db);
    if (!moderator) return reply.code(403).send({ error: 'This account does not have moderator access.' });
    const { caseId } = request.params as { caseId: string };
    const body = request.body as { severity?: unknown; note?: unknown } | undefined;
    if (!body || (body.severity !== 'high' && body.severity !== 'urgent')
      || typeof body.note !== 'string' || body.note.trim().length < 10 || body.note.length > 1200) {
      return reply.code(400).send({ error: 'Choose a severity and add an escalation note of 10 to 1,200 characters.' });
    }
    const assigned = await invitations.findOne({ caseId, moderatorId: moderator.id, status: 'accepted' }, { projection: { id: 1 } });
    if (!assigned) return reply.code(404).send({ error: 'This case is not assigned to your moderator account.' });
    const action = {
      id: randomUUID(), type: 'case-escalation', caseId, moderatorId: moderator.id,
      severity: body.severity, note: body.note.trim(), createdAt: new Date().toISOString()
    };
    await moderationActions.insertOne(action);
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: moderator.id, action: 'moderator.case-escalated', entityType: 'case',
      entityId: caseId, moderationActionId: action.id, severity: action.severity, createdAt: action.createdAt
    });
    request.log.info({ caseId, moderatorId: moderator.id, severity: action.severity }, 'Moderator recorded case escalation');
    return reply.code(201).send({ action, message: 'Escalation recorded in the moderation log.' });
  });
};

export default moderatorRoutes;
