import { randomUUID } from 'node:crypto';
import type { Db, WithId } from 'mongodb';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { CaseRecord, ReportInput, SightingInput, SightingRecord } from '../types.js';
import { getFamilyUser } from './auth.js';
import { createFamilyNotification } from '../notifications.js';

type RoutesOptions = { db: Db };
type StoredCase = CaseRecord & {
  ownerId: string;
  caseNumber: string;
  publicReference: string;
  visibility: 'private' | 'public';
  publicDescription?: string;
  flyerProfile?: { fields: string[]; summary: string };
  publicProfile?: { fields: string[]; summary: string; requested: boolean; requestedAt: string };
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function toPublicCase(caseItem: WithId<StoredCase>) {
  const fields = new Set(caseItem.publicProfile?.fields ?? []);
  return {
    id: caseItem.id,
    ...(fields.has('name') ? { name: caseItem.name } : {}),
    ...(fields.has('age') ? { age: caseItem.age } : {}),
    ...(fields.has('region') ? { region: caseItem.region } : {}),
    ...(fields.has('lastSeen') ? { lastSeen: caseItem.lastSeen } : {}),
    ...(fields.has('photo') && caseItem.imageAssetId ? { imageAssetId: caseItem.imageAssetId } : {}),
    status: caseItem.status,
    description: fields.has('summary') ? caseItem.publicProfile?.summary ?? '' : '',
    ...(caseItem.status === 'Found' && caseItem.closedAt ? { foundAt: caseItem.closedAt } : {})
  };
}

function isSightingInput(body: unknown): body is SightingInput {
  if (!body || typeof body !== 'object') return false;
  const input = body as Partial<SightingInput>;
  return typeof input.description === 'string'
    && input.description.trim().length >= 10
    && input.description.length <= 2000
    && typeof input.observedAt === 'string'
    && Number.isFinite(Date.parse(input.observedAt))
    && typeof input.location === 'string'
    && input.location.trim().length > 0
    && input.location.length <= 200
    && typeof input.latitude === 'number'
    && Number.isFinite(input.latitude)
    && input.latitude >= -90
    && input.latitude <= 90
    && typeof input.longitude === 'number'
    && Number.isFinite(input.longitude)
    && input.longitude >= -180
    && input.longitude <= 180
    && (input.imageAssetId === undefined || (typeof input.imageAssetId === 'string' && input.imageAssetId.length <= 100));
}

function isReportInput(body: unknown): body is ReportInput {
  if (!body || typeof body !== 'object') return false;
  const input = body as Partial<ReportInput>;
  return typeof input.fullName === 'string' && input.fullName.trim().length > 0 && input.fullName.length <= 120
    && (input.age === undefined || (typeof input.age === 'number' && Number.isFinite(input.age) && input.age >= 0 && input.age <= 120))
    && typeof input.region === 'string' && input.region.trim().length > 0 && input.region.length <= 100
    && typeof input.lastSeen === 'string' && input.lastSeen.trim().length > 0 && input.lastSeen.length <= 200
    && typeof input.contact === 'string' && input.contact.trim().length > 0 && input.contact.length <= 100
    && typeof input.notes === 'string' && input.notes.trim().length >= 10 && input.notes.length <= 5000
    && (input.caseType === undefined || (typeof input.caseType === 'string' && input.caseType.length <= 100))
    && (input.evidence === undefined || (Array.isArray(input.evidence) && input.evidence.every((item) => typeof item === 'string' && item.length <= 500)))
    && (input.imageAssetId === undefined || (typeof input.imageAssetId === 'string' && input.imageAssetId.length <= 100));
}

const casesRoutes: FastifyPluginAsync<RoutesOptions> = async (fastify, { db }) => {
  const cases = db.collection<StoredCase>('cases');
  const sightings = db.collection<SightingRecord & { createdAt: string }>('sightings');
  const auditLogs = db.collection<{ action: string; entityId: string; createdAt: string; before?: { visibility?: string } }>('auditLogs');

  async function wasPublicWhenMarkedFound(caseId: string) {
    const markedFound = await auditLogs.findOne(
      { action: 'case.marked-found', entityId: caseId, 'before.visibility': 'public' },
      { sort: { createdAt: -1 }, projection: { _id: 0, createdAt: 1 } }
    );
    if (!markedFound) return false;
    const laterWithdrawal = await auditLogs.findOne({
      action: 'case.publication-consent-withdrawn', entityId: caseId,
      createdAt: { $gt: markedFound.createdAt }
    }, { projection: { _id: 1 } });
    return !laterWithdrawal;
  }

  async function isPubliclyAvailable(caseItem: WithId<StoredCase>) {
    if (!caseItem.publicProfile?.fields?.includes('name')) return false;
    if ((caseItem.status === 'Active' || caseItem.status === 'Found')
      && caseItem.visibility === 'public' && caseItem.publicProfile.requested === true) return true;
    return caseItem.status === 'Found' && wasPublicWhenMarkedFound(caseItem.id);
  }

  fastify.get('/api/health', async () => ({
    status: 'ok',
    service: 'reunite-api',
    database: 'connected',
    timestamp: new Date().toISOString()
  }));

  fastify.get('/api/cases', async () => {
    const activeCases = await cases.find({ visibility: 'public', status: 'Active', 'publicProfile.requested': true, 'publicProfile.fields': 'name' }).sort({ createdAt: -1 }).toArray();
    const foundCandidates = await cases.find({ status: 'Found', 'publicProfile.fields': 'name' }).sort({ updatedAt: -1 }).toArray();
    const foundCases = await Promise.all(foundCandidates.map(async (item) => await isPubliclyAvailable(item) ? item : null));
    const publicCases = [...activeCases, ...foundCases.filter((item): item is WithId<StoredCase> => item !== null)]
      .sort((left, right) => Date.parse(right.updatedAt || right.createdAt) - Date.parse(left.updatedAt || left.createdAt));
    return { total: publicCases.length, items: publicCases.map(toPublicCase) };
  });

  fastify.get('/api/cases/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const foundCase = await cases.findOne({ id, 'publicProfile.fields': 'name' });
    if (!foundCase || !await isPubliclyAvailable(foundCase)) return reply.code(404).send({ error: 'This public case was not found.' });
    return toPublicCase(foundCase);
  });

  fastify.get('/api/cases/:id/sightings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const foundCase = await cases.findOne({ id, 'publicProfile.fields': 'name' });
    if (!foundCase || !await isPubliclyAvailable(foundCase)) return reply.code(404).send({ error: 'This public case was not found.' });
    if (foundCase.status === 'Found') return { total: 0, items: [] };
    const items = await sightings.find({ caseId: id, status: 'approved', public: true }, {
      projection: { _id: 0, id: 1, description: 1, observedAt: 1, location: 1, imageAssetId: 1 }
    }).sort({ submittedAt: -1 }).toArray();
    return { total: items.length, items };
  });

  fastify.get('/api/family/cases', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to view your cases.' });
    const baseItems = await cases.find({ ownerId: user.id }, {
      projection: { _id: 0, id: 1, caseNumber: 1, name: 1, age: 1, region: 1, lastSeen: 1, status: 1, reviewState: 1, reviewNote: 1, imageAssetId: 1, createdAt: 1, updatedAt: 1 }
    }).sort({ createdAt: -1 }).toArray();
    const caseIds = baseItems.map((item) => item.id);
    const counts = caseIds.length ? await sightings.aggregate<{ _id: { caseId: string; status: string }; count: number }>([
      { $match: { caseId: { $in: caseIds } } },
      { $group: { _id: { caseId: '$caseId', status: '$status' }, count: { $sum: 1 } } }
    ]).toArray() : [];
    const countMap = new Map(counts.map((entry) => [`${entry._id.caseId}:${entry._id.status}`, entry.count]));
    const items = baseItems.map((item) => ({
      ...item,
      pendingSightings: countMap.get(`${item.id}:pending-family-review`) ?? 0,
      approvedSightings: countMap.get(`${item.id}:approved`) ?? 0
    }));
    return { total: items.length, items };
  });

  fastify.get('/api/family/cases/:id/sightings', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to review sightings.' });
    const { id } = request.params as { id: string };
    const ownedCase = await cases.findOne({ id, ownerId: user.id }, { projection: { id: 1, caseNumber: 1, name: 1 } });
    if (!ownedCase) return reply.code(404).send({ error: 'This family case was not found.' });
    const items = await sightings.find({ caseId: id }).sort({ submittedAt: -1 }).toArray();
    return { case: ownedCase, total: items.length, items };
  });

  fastify.get('/api/family/cases/:id', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to edit your case.' });
    const { id } = request.params as { id: string };
    const foundCase = await cases.findOne({ id, ownerId: user.id }, {
      projection: { _id: 0, id: 1, caseNumber: 1, name: 1, age: 1, region: 1, lastSeen: 1, description: 1, contact: 1, status: 1, visibility: 1, imageAssetId: 1 }
    });
    if (!foundCase) return reply.code(404).send({ error: 'This family case was not found.' });
    return { case: foundCase };
  });

  fastify.put('/api/family/cases/:id', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to edit your case.' });
    const { id } = request.params as { id: string };
    const body = request.body as { name?: unknown; age?: unknown; region?: unknown; lastSeen?: unknown; description?: unknown; contact?: unknown; imageAssetId?: unknown } | undefined;
    if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120
      || typeof body.age !== 'string' || !(body.age === 'Unknown' || (/^\d{1,3}$/.test(body.age) && Number(body.age) <= 120))
      || typeof body.region !== 'string' || !body.region.trim() || body.region.length > 100
      || typeof body.lastSeen !== 'string' || !body.lastSeen.trim() || body.lastSeen.length > 200
      || typeof body.description !== 'string' || body.description.trim().length < 10 || body.description.length > 5000
      || typeof body.contact !== 'string' || !body.contact.trim() || body.contact.length > 100
      || (body.imageAssetId !== undefined && body.imageAssetId !== null && (typeof body.imageAssetId !== 'string' || body.imageAssetId.length > 100))) {
      return reply.code(400).send({ error: 'Check the name, age, region, last seen details, report notes, and contact information.' });
    }
    const foundCase = await cases.findOne({ id, ownerId: user.id });
    if (!foundCase) return reply.code(404).send({ error: 'This family case was not found.' });
    if (foundCase.status === 'Found') return reply.code(409).send({ error: 'A found case is closed and cannot be edited.' });

    const nextImageAssetId = body.imageAssetId === undefined ? foundCase.imageAssetId : (typeof body.imageAssetId === 'string' ? body.imageAssetId : undefined);
    if (nextImageAssetId && nextImageAssetId !== foundCase.imageAssetId) {
      const mediaAsset = await db.collection('mediaAssets').findOne({ id: nextImageAssetId, ownerId: user.id, caseId: id, kind: 'case-photo', uploadedAt: { $exists: true } });
      if (!mediaAsset) return reply.code(400).send({ error: 'Upload a case photo to this case before saving.' });
    }

    const next = {
      name: body.name.trim(), age: body.age, region: body.region.trim(), lastSeen: body.lastSeen.trim(),
      description: body.description.trim(), contact: body.contact.trim(), ...(nextImageAssetId ? { imageAssetId: nextImageAssetId } : {})
    };
    const changedFields = Object.keys(next).filter((field) => next[field as keyof typeof next] !== foundCase[field as keyof typeof next]);
    if (!nextImageAssetId && foundCase.imageAssetId) changedFields.push('imageAssetId');
    if (!changedFields.length) return { message: 'No case details changed.', case: { id, status: foundCase.status, visibility: foundCase.visibility } };

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { ...next, updatedAt: now, reviewState: 'pending', 'publicProfile.requested': false, 'publicProfile.requestedAt': '' };
    if (foundCase.visibility === 'public') {
      update.visibility = 'private';
      update.status = 'Review';
    }
    const saved = await cases.updateOne({ id, ownerId: user.id, status: foundCase.status, ...(foundCase.updatedAt ? { updatedAt: foundCase.updatedAt } : {}) }, { $set: update, $unset: { reviewNote: '', ...(!nextImageAssetId && foundCase.imageAssetId ? { imageAssetId: '' } : {}) } });
    if (saved.modifiedCount !== 1) return reply.code(409).send({ error: 'The case changed while you were editing it. Reload and try again.' });
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: user.id, action: 'case.details-updated', entityType: 'case', entityId: id,
      changedFields, before: { status: foundCase.status, visibility: foundCase.visibility },
      after: { status: update.status ?? foundCase.status, visibility: update.visibility ?? foundCase.visibility }, createdAt: now
    });
    request.log.info({ caseId: id, actorId: user.id, changedFields }, 'Family updated private case details; publication consent reset');
    return { message: 'Case details saved. If this case was public, it is now private and requires a new family publication request and moderator review.', case: { id, status: update.status ?? foundCase.status, visibility: update.visibility ?? foundCase.visibility } };
  });

  fastify.patch('/api/family/cases/:id/status', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to close your case.' });
    const { id } = request.params as { id: string };
    const body = request.body as { status?: unknown; note?: unknown } | undefined;
    if (!body || body.status !== 'Found' || (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 500))) {
      return reply.code(400).send({ error: 'Choose Found and enter an optional resolution note of 500 characters or fewer.' });
    }
    const foundCase = await cases.findOne({ id, ownerId: user.id });
    if (!foundCase) return reply.code(404).send({ error: 'This family case was not found.' });
    if (foundCase.status === 'Found') return reply.code(409).send({ error: 'This case is already marked found.' });
    const now = new Date().toISOString();
    const wasPublic = foundCase.visibility === 'public'
      && foundCase.publicProfile?.requested === true
      && foundCase.publicProfile.fields.includes('name');
    const update: Record<string, unknown> = {
      status: 'Found', visibility: wasPublic ? 'public' : 'private',
      updatedAt: now, closedAt: now, closedBy: user.id,
      resolutionNote: typeof body.note === 'string' ? body.note.trim() : '',
      ...(!wasPublic ? { 'publicProfile.requested': false, 'publicProfile.requestedAt': '' } : {})
    };
    const result = await cases.updateOne(
      { id, ownerId: user.id, status: foundCase.status },
      { $set: update }
    );
    if (result.modifiedCount !== 1) return reply.code(409).send({ error: 'The case changed while you were closing it. Reload and try again.' });
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: user.id, action: 'case.marked-found', entityType: 'case', entityId: id,
      before: { status: foundCase.status, visibility: foundCase.visibility }, after: { status: 'Found', visibility: update.visibility },
      hasResolutionNote: typeof body.note === 'string' && body.note.trim().length > 0, createdAt: now
    });
    request.log.info({ caseId: id, actorId: user.id, remainedPublic: wasPublic }, 'Family marked case found');
    return {
      message: wasPublic
        ? 'Case marked found. Its family-approved public details remain visible for transparency, and new sightings are closed.'
        : 'Case marked found. It remains private because it was not publicly shared, and new public sightings are closed.',
      case: { id, status: 'Found', visibility: update.visibility, closedAt: now }
    };
  });

  fastify.get('/api/family/cases/:id/flyer', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to create a case flyer.' });
    const { id } = request.params as { id: string };
    const foundCase = await cases.findOne({ id, ownerId: user.id }, {
      projection: { _id: 0, id: 1, caseNumber: 1, name: 1, age: 1, region: 1, lastSeen: 1, description: 1, contact: 1, imageAssetId: 1, flyerProfile: 1 }
    });
    if (!foundCase) return reply.code(404).send({ error: 'This family case was not found.' });
    return { case: foundCase };
  });

  fastify.get('/api/family/cases/:id/public-profile', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to manage public case details.' });
    const { id } = request.params as { id: string };
    const foundCase = await cases.findOne({ id, ownerId: user.id }, {
      projection: { _id: 0, id: 1, caseNumber: 1, name: 1, age: 1, region: 1, lastSeen: 1, status: 1, visibility: 1, imageAssetId: 1, publicProfile: 1 }
    });
    if (!foundCase) return reply.code(404).send({ error: 'This family case was not found.' });
    return { case: foundCase };
  });

  fastify.put('/api/family/cases/:id/public-profile', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to manage public case details.' });
    const { id } = request.params as { id: string };
    const body = request.body as { fields?: unknown; summary?: unknown; requestPublication?: unknown } | undefined;
    const allowedFields = new Set(['name', 'age', 'region', 'lastSeen', 'summary', 'photo']);
    if (!body || !Array.isArray(body.fields) || body.fields.length > allowedFields.size
      || !body.fields.every((field) => typeof field === 'string' && allowedFields.has(field))
      || new Set(body.fields).size !== body.fields.length
      || typeof body.summary !== 'string' || body.summary.length > 1000
      || typeof body.requestPublication !== 'boolean') {
      return reply.code(400).send({ error: 'Choose public fields, enter an optional summary of up to 1,000 characters, and choose whether to request publication.' });
    }
    const foundCase = await cases.findOne({ id, ownerId: user.id });
    if (!foundCase) return reply.code(404).send({ error: 'This family case was not found.' });
    if (body.requestPublication && foundCase.status === 'Found') return reply.code(409).send({ error: 'A found case cannot be published.' });
    if (body.requestPublication && !body.fields.includes('name')) return reply.code(400).send({ error: "Select the person's name before requesting publication." });
    if (body.fields.includes('photo') && !foundCase.imageAssetId) return reply.code(400).send({ error: 'Upload a case photo before including it in the public profile.' });
    if (body.fields.includes('summary') && body.summary.trim().length < 10) return reply.code(400).send({ error: 'Add at least 10 characters to the summary or leave it off the public profile.' });

    const now = new Date().toISOString();
    const previous = foundCase.publicProfile;
    const changed = JSON.stringify({ fields: previous?.fields ?? [], summary: previous?.summary ?? '', requested: previous?.requested ?? false })
      !== JSON.stringify({ fields: body.fields, summary: body.summary.trim(), requested: body.requestPublication });
    const publicProfile = {
      fields: body.fields as string[], summary: body.summary.trim(), requested: body.requestPublication,
      requestedAt: body.requestPublication ? (changed ? now : previous?.requestedAt ?? now) : ''
    };
    const update: Record<string, unknown> = { publicProfile, updatedAt: now };
    if (changed) update.reviewState = 'pending';
    if (changed && foundCase.visibility === 'public') {
      update.visibility = 'private';
      if (foundCase.status !== 'Found') update.status = 'Review';
    }
    await cases.updateOne({ id, ownerId: user.id }, { $set: update, ...(changed ? { $unset: { reviewNote: '' } } : {}) });
    if (changed) await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: user.id, action: body.requestPublication ? 'case.publication-requested' : 'case.publication-consent-withdrawn',
      entityType: 'case', entityId: id, before: { fields: previous?.fields ?? [], requested: previous?.requested ?? false },
      after: { fields: publicProfile.fields, requested: publicProfile.requested, visibility: update.visibility ?? foundCase.visibility }, createdAt: now
    });
    return { message: body.requestPublication ? 'Public details saved. An assigned moderator must verify and publish the case.' : 'Public details saved and publication consent withdrawn.', publicProfile, visibility: update.visibility ?? foundCase.visibility };
  });

  fastify.put('/api/family/cases/:id/flyer', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to save a case flyer.' });
    const { id } = request.params as { id: string };
    const body = request.body as { fields?: unknown; summary?: unknown } | undefined;
    const allowedFields = new Set(['name', 'age', 'region', 'lastSeen', 'summary', 'contact']);
    if (!body || !Array.isArray(body.fields) || body.fields.length > allowedFields.size
      || !body.fields.every((field) => typeof field === 'string' && allowedFields.has(field))
      || new Set(body.fields).size !== body.fields.length
      || typeof body.summary !== 'string' || body.summary.length > 1000) {
      return reply.code(400).send({ error: 'Choose the flyer details to include and enter a summary of 1,000 characters or fewer.' });
    }
    const foundCase = await cases.findOne({ id, ownerId: user.id });
    if (!foundCase) return reply.code(404).send({ error: 'This family case was not found.' });
    if (!body.fields.includes('name')) return reply.code(400).send({ error: "A flyer must include the missing person's name." });
    if (body.fields.includes('summary') && body.summary.trim().length < 10) {
      return reply.code(400).send({ error: 'Add at least 10 characters to the summary or leave it off the flyer.' });
    }

    const before = foundCase.flyerProfile ?? { fields: [], summary: '' };
    const flyerProfile = { fields: body.fields as string[], summary: body.summary.trim() };
    await cases.updateOne({ id, ownerId: user.id }, { $set: { flyerProfile, updatedAt: new Date().toISOString() } });
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: user.id, action: 'case.flyer-updated', entityType: 'case', entityId: id,
      before: { fields: before.fields }, after: { fields: flyerProfile.fields }, createdAt: new Date().toISOString()
    });
    return { message: 'Flyer details saved privately.', flyerProfile };
  });

  fastify.patch('/api/family/cases/:id/sightings/:sightingId/review', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to review sightings.' });
    const { id, sightingId } = request.params as { id: string; sightingId: string };
    const body = request.body as { decision?: unknown } | undefined;
    if (!body || (body.decision !== 'approved' && body.decision !== 'rejected')) {
      return reply.code(400).send({ error: 'Choose approve or reject for this sighting.' });
    }
    const ownedCase = await cases.findOne({ id, ownerId: user.id }, { projection: { id: 1, status: 1, visibility: 1 } });
    if (!ownedCase) return reply.code(404).send({ error: 'This family case was not found.' });
    const sighting = await sightings.findOne({ id: sightingId, caseId: id });
    if (!sighting) return reply.code(404).send({ error: 'This sighting was not found.' });

    const visibility = false;
    const updated = await sightings.updateOne(
      { id: sightingId, caseId: id, status: sighting.status },
      { $set: { status: body.decision, public: visibility, reviewedAt: new Date().toISOString(), reviewedBy: user.id } }
    );
    if (updated.modifiedCount !== 1) return reply.code(409).send({ error: 'This sighting changed while you were reviewing it. Reload and try again.' });
    const createdAt = new Date().toISOString();
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: user.id, action: `sighting.${body.decision}`, entityType: 'sighting',
      entityId: sightingId, caseId: id, before: { status: sighting.status, public: sighting.public },
      after: { status: body.decision, public: visibility }, createdAt
    });
    request.log.info({ caseId: id, sightingId, decision: body.decision, actorId: user.id }, 'Family reviewed sighting');
    return { id: sightingId, status: body.decision, public: visibility };
  });

  fastify.patch('/api/family/cases/:id/sightings/:sightingId/visibility', async (request, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Sign in to change sighting visibility.' });
    const { id, sightingId } = request.params as { id: string; sightingId: string };
    const body = request.body as { public?: unknown } | undefined;
    if (!body || typeof body.public !== 'boolean') return reply.code(400).send({ error: 'Choose whether the approved sighting should be public.' });
    const ownedCase = await cases.findOne({ id, ownerId: user.id }, { projection: { id: 1, status: 1, visibility: 1 } });
    if (!ownedCase) return reply.code(404).send({ error: 'This family case was not found.' });
    if (body.public && (ownedCase.status !== 'Active' || ownedCase.visibility !== 'public')) return reply.code(409).send({ error: 'A sighting can only be published while its case is public and active.' });
    const sighting = await sightings.findOne({ id: sightingId, caseId: id, status: 'approved' });
    if (!sighting) return reply.code(409).send({ error: 'Only approved sightings can be made public.' });
    if (sighting.public === body.public) return { id: sightingId, status: sighting.status, public: sighting.public };

    const updated = await sightings.updateOne(
      { id: sightingId, caseId: id, status: 'approved', public: sighting.public },
      { $set: { public: body.public, visibilityUpdatedAt: new Date().toISOString(), visibilityUpdatedBy: user.id } }
    );
    if (updated.modifiedCount !== 1) return reply.code(409).send({ error: 'This sighting changed while you were updating it. Reload and try again.' });
    const createdAt = new Date().toISOString();
    await db.collection('auditLogs').insertOne({
      id: randomUUID(), actorId: user.id, action: body.public ? 'sighting.made-public' : 'sighting.made-private',
      entityType: 'sighting', entityId: sightingId, caseId: id,
      before: { status: sighting.status, public: sighting.public }, after: { status: sighting.status, public: body.public }, createdAt
    });
    request.log.info({ caseId: id, sightingId, public: body.public, actorId: user.id }, 'Family changed sighting visibility');
    return { id: sightingId, status: sighting.status, public: body.public };
  });

  fastify.post('/api/cases/:id/sightings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const foundCase = await cases.findOne({ id, visibility: 'public', status: 'Active', 'publicProfile.requested': true, 'publicProfile.fields': 'name' }, { projection: { id: 1, ownerId: 1, caseNumber: 1, name: 1 } });
    if (!foundCase) return reply.code(404).send({ error: 'This public case was not found.' });
    if (!isSightingInput(request.body)) {
      return reply.code(400).send({ error: 'Provide a sighting description, observation time, place, and valid map coordinates.' });
    }

    const sightingId = `S-${randomUUID()}`;
    const submittedAt = new Date().toISOString();
    if (request.body.imageAssetId) {
      const mediaAsset = await db.collection('mediaAssets').findOne({ id: request.body.imageAssetId, caseId: id, kind: 'sighting-photo', uploadedAt: { $exists: true }, attachedToId: { $exists: false } });
      if (!mediaAsset) return reply.code(400).send({ error: 'Upload a sighting photo for this case before submitting.' });
      await db.collection('mediaAssets').updateOne({ id: mediaAsset.id, attachedToId: { $exists: false } }, { $set: { attachedToId: sightingId } });
    }
    await sightings.insertOne({
      ...request.body,
      description: request.body.description.trim(),
      location: request.body.location.trim(),
      id: sightingId,
      caseId: id,
      ...(request.body.imageAssetId ? { imageAssetId: request.body.imageAssetId } : {}),
      status: 'pending-family-review',
      public: false,
      submittedAt,
      createdAt: submittedAt
    });

    await createFamilyNotification(db, {
      userId: foundCase.ownerId,
      caseId: id,
      caseNumber: foundCase.caseNumber,
      eventKey: `sighting:${sightingId}`,
      type: 'sighting',
      title: 'New sighting submitted',
      message: `A citizen submitted a sighting for ${foundCase.name}. Review it privately before deciding whether to approve it.`,
      href: `/family/cases/${encodeURIComponent(id)}/sightings`
    });

    request.log.info({ caseId: id, sightingId }, 'Sighting saved for family review');
    return reply.code(201).send({
      message: 'Sighting sent to the family for review. It will not appear publicly unless they approve it.',
      sightingId,
      status: 'pending-family-review'
    });
  });

  fastify.post('/api/reports', async (request: FastifyRequest, reply) => {
    const user = await getFamilyUser(request, db);
    if (!user) return reply.code(401).send({ error: 'Create an account or sign in before submitting a family report.' });
    if (!isReportInput(request.body)) {
      return reply.code(400).send({ error: 'Provide a name, age (if known), region, last seen details, contact, and case description.' });
    }
    const body = request.body;
    const id = `R-${randomUUID()}`;
    const now = new Date().toISOString();
    const newCase: StoredCase = {
      id,
      caseNumber: id,
      publicReference: id,
      ownerId: user.id,
      name: body.fullName.trim(),
      age: String(body.age ?? 'Unknown'),
      gender: 'Unknown',
      region: body.region.trim(),
      lastSeen: body.lastSeen.trim(),
      location: body.region.trim(),
      status: 'Review',
      description: body.notes.trim(),
      reporter: user.name,
      contact: body.contact.trim(),
      source: 'Family report',
      evidence: body.evidence ?? [],
      ...(body.imageAssetId ? { imageAssetId: body.imageAssetId } : {}),
      visibility: 'private',
      createdAt: now,
      updatedAt: now
    };
    try {
      if (body.imageAssetId) {
        const mediaAsset = await db.collection('mediaAssets').findOne({ id: body.imageAssetId, ownerId: user.id, kind: 'case-photo', uploadedAt: { $exists: true }, caseId: { $exists: false } });
        if (!mediaAsset) return reply.code(400).send({ error: 'Upload a case photo to this account before submitting the report.' });
        const attached = await db.collection('mediaAssets').updateOne({ id: mediaAsset.id, caseId: { $exists: false } }, { $set: { caseId: id } });
        if (attached.modifiedCount !== 1) return reply.code(409).send({ error: 'This photo is already attached to another case. Upload it again and retry.' });
      }
      await cases.insertOne(newCase);
    } catch (error) {
      request.log.error({ err: error, caseId: id, ownerId: user.id }, 'Family report could not be persisted');
      throw error;
    }

    request.log.info({ caseId: id }, 'Private case report saved to MongoDB for review');
    return reply.code(201).send({
      message: 'Report received and saved privately for review.',
      case: { id, status: newCase.status }
    });
  });
};

export default casesRoutes;
