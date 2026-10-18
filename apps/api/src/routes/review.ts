import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUser, getReviewerUser } from './auth.js';
import { createFamilyNotification } from '../notifications.js';

type ReviewerCase = {
  id: string;
  caseNumber: string;
  ownerId: string;
  name: string;
  age: string;
  gender: string;
  region: string;
  lastSeen: string;
  location: string;
  status: string;
  description: string;
  reporter: string;
  contact: string;
  evidence: string[];
  imageAssetId?: string;
  visibility: 'private' | 'public';
  publicProfile?: { fields: string[]; summary: string; requested: boolean; requestedAt: string };
  reviewState?: 'pending' | 'changes-requested' | 'declined' | 'verified';
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
};

type Options = { db: Db };

const reviewRoutes: FastifyPluginAsync<Options> = async (fastify, { db }) => {
  const cases = db.collection<ReviewerCase>('cases');
  const invitations = db.collection<{ caseId: string; status: string; moderatorId?: string }>('moderatorInvitations');

  async function assignedCaseIds() {
    const assignments = await invitations.find({ status: 'accepted', moderatorId: { $type: 'string' } }, { projection: { caseId: 1 } }).toArray();
    return Array.from(new Set(assignments.map((assignment) => assignment.caseId)));
  }

  async function reviewerGate(request: FastifyRequest, reply: FastifyReply) {
    const signedIn = await getAuthenticatedUser(request, db);
    if (!signedIn) { reply.code(401).send({ error: 'Sign in to access report review.' }); return null; }
    const reviewer = await getReviewerUser(request, db);
    if (!reviewer) { reply.code(403).send({ error: 'This account does not have report reviewer access.' }); return null; }
    return reviewer;
  }

  fastify.get('/api/review/cases', async (request, reply) => {
    const reviewer = await reviewerGate(request, reply);
    if (!reviewer) return;
    const assignedIds = await assignedCaseIds();
    const items = await cases.find({
      status: 'Review', id: { $nin: assignedIds }, $or: [{ reviewState: 'pending' }, { reviewState: { $exists: false } }]
    }, { projection: { _id: 0, id: 1, caseNumber: 1, name: 1, age: 1, region: 1, lastSeen: 1, visibility: 1, 'publicProfile.requested': 1, reviewState: 1, createdAt: 1 } })
      .sort({ createdAt: 1 }).toArray();
    return { total: items.length, items };
  });

  fastify.get('/api/review/cases/:caseId', async (request, reply) => {
    const reviewer = await reviewerGate(request, reply);
    if (!reviewer) return;
    const { caseId } = request.params as { caseId: string };
    if ((await assignedCaseIds()).includes(caseId)) return reply.code(404).send({ error: 'This report has a family-assigned moderator and is not in the unassigned review queue.' });
    const caseInfo = await cases.findOne({ id: caseId, status: 'Review', $or: [{ reviewState: 'pending' }, { reviewState: { $exists: false } }] }, {
      projection: { _id: 0, id: 1, caseNumber: 1, name: 1, age: 1, gender: 1, region: 1, lastSeen: 1, location: 1, description: 1, reporter: 1, contact: 1, evidence: 1, imageAssetId: 1, status: 1, visibility: 1, publicProfile: 1, reviewState: 1, createdAt: 1, updatedAt: 1 }
    });
    if (!caseInfo) return reply.code(404).send({ error: 'This report is no longer in the unassigned review queue.' });
    return { case: caseInfo };
  });

  fastify.post('/api/review/cases/:caseId/decision', async (request, reply) => {
    const reviewer = await reviewerGate(request, reply);
    if (!reviewer) return;
    const { caseId } = request.params as { caseId: string };
    const body = request.body as { decision?: unknown; note?: unknown } | undefined;
    if (!body || !['publish', 'changes-requested', 'declined'].includes(String(body.decision))) {
      return reply.code(400).send({ error: 'Choose publish, request changes, or decline this report.' });
    }
    if (body.decision !== 'publish' && (typeof body.note !== 'string' || body.note.trim().length < 10 || body.note.length > 1000)) {
      return reply.code(400).send({ error: 'Add a private review reason of 10 to 1,000 characters.' });
    }
    if ((await assignedCaseIds()).includes(caseId)) return reply.code(409).send({ error: 'A family-assigned moderator now has access. This report is no longer in the unassigned queue.' });
    const caseInfo = await cases.findOne({ id: caseId, status: 'Review', $or: [{ reviewState: 'pending' }, { reviewState: { $exists: false } }] });
    if (!caseInfo) return reply.code(404).send({ error: 'This report is no longer awaiting unassigned review.' });
    const now = new Date().toISOString();
    const expectedStateFilter = caseInfo.reviewState ? { reviewState: caseInfo.reviewState } : { reviewState: { $exists: false } };

    if (body.decision === 'publish') {
      if (!caseInfo.publicProfile?.requested || !caseInfo.publicProfile.fields.includes('name')) {
        return reply.code(409).send({ error: 'The family must request publication and select the person's name first.' });
      }
      const saved = await cases.updateOne({
        id: caseId, status: 'Review', updatedAt: caseInfo.updatedAt,
        ...expectedStateFilter,
        'publicProfile.requested': true,
        'publicProfile.requestedAt': caseInfo.publicProfile.requestedAt,
        'publicProfile.fields': 'name'
      }, { $set: { status: 'Active', visibility: 'public', reviewState: 'verified', reviewedAt: now, reviewedBy: reviewer.id, publishedAt: now, publishedBy: reviewer.id, updatedAt: now }, $unset: { reviewNote: '' } });
      if (saved.modifiedCount !== 1) return reply.code(409).send({ error: 'This report changed while you reviewed it. Reload the queue and review it again.' });
      const actionId = randomUUID();
      await db.collection('moderationActions').insertOne({ id: actionId, type: 'intake-published', caseId, reviewerId: reviewer.id, createdAt: now });
      await db.collection('auditLogs').insertOne({ id: randomUUID(), actorId: reviewer.id, action: 'reviewer.case-published', entityType: 'case', entityId: caseId, moderationActionId: actionId, createdAt: now });
      await createFamilyNotification(db, {
        userId: caseInfo.ownerId, caseId, caseNumber: caseInfo.caseNumber, eventKey: `review-published:${caseId}:${now}`,
        type: 'publication', title: 'Your case is now public', message: 'A reviewer verified your report and published the public details you selected.',
        href: `/cases/${encodeURIComponent(caseId)}`
      });
      request.log.info({ caseId, reviewerId: reviewer.id }, 'Reviewer verified and published family-approved report');
      return { message: 'Report verified and published using only the family-selected details.', case: { id: caseId, status: 'Active', visibility: 'public' } };
    }

    const decision = body.decision as 'changes-requested' | 'declined';
    const saved = await cases.updateOne({ id: caseId, status: 'Review', updatedAt: caseInfo.updatedAt, ...expectedStateFilter }, {
      $set: {
        visibility: 'private', reviewState: decision, reviewNote: (body.note as string).trim(),
        reviewedAt: now, reviewedBy: reviewer.id, 'publicProfile.requested': false, 'publicProfile.requestedAt': '', updatedAt: now
      }
    });
    if (saved.modifiedCount !== 1) return reply.code(409).send({ error: 'This report changed while you reviewed it. Reload the queue and review it again.' });
    const actionId = randomUUID();
    await db.collection('moderationActions').insertOne({ id: actionId, type: decision === 'declined' ? 'intake-declined' : 'intake-changes-requested', caseId, reviewerId: reviewer.id, note: (body.note as string).trim(), createdAt: now });
    await db.collection('auditLogs').insertOne({ id: randomUUID(), actorId: reviewer.id, action: decision === 'declined' ? 'reviewer.case-declined' : 'reviewer.case-changes-requested', entityType: 'case', entityId: caseId, moderationActionId: actionId, createdAt: now });
    await createFamilyNotification(db, {
      userId: caseInfo.ownerId, caseId, caseNumber: caseInfo.caseNumber, eventKey: `review-${decision}:${caseId}:${now}`,
      type: 'review', title: decision === 'declined' ? 'Report review decision' : 'Case updates requested',
      message: (body.note as string).trim(), href: `/family/cases/${encodeURIComponent(caseId)}/edit`
    });
    request.log.info({ caseId, reviewerId: reviewer.id, decision }, 'Reviewer updated report intake status');
    return { message: decision === 'declined' ? 'Report declined and kept private. The family can edit it and request a new review.' : 'Changes requested. The case remains private until the family updates it and requests another review.', case: { id: caseId, status: 'Review', reviewState: decision, visibility: 'private' } };
  });
};

export default reviewRoutes;
