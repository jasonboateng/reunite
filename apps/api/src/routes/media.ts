import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import type { FastifyPluginAsync } from 'fastify';
import { v2 as cloudinary } from 'cloudinary';
import { getAuthenticatedUser, getFamilyUser } from './auth.js';

type MediaOptions = { db: Db };
type MediaKind = 'case-photo' | 'sighting-photo';
type MediaAsset = {
  id: string;
  publicId: string;
  ownerId?: string;
  caseId?: string;
  kind: MediaKind;
  format: 'jpg';
  createdAt: string;
  uploadedAt?: string;
};

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
}

const mediaRoutes: FastifyPluginAsync<MediaOptions> = async (fastify, { db }) => {
  const media = db.collection<MediaAsset>('mediaAssets');

  fastify.post('/api/media/signature', async (request, reply) => {
    const config = configureCloudinary();
    if (!config) return reply.code(503).send({ error: 'Image storage is not configured. Add the Cloudinary credentials to apps/api/.env and restart the API.' });

    const body = request.body as { kind?: unknown; caseId?: unknown } | undefined;
    if (!body || (body.kind !== 'case-photo' && body.kind !== 'sighting-photo')
      || (body.caseId !== undefined && (typeof body.caseId !== 'string' || body.caseId.length > 100))) {
      return reply.code(400).send({ error: 'Choose a valid image upload purpose.' });
    }

    let ownerId: string | undefined;
    let caseId: string | undefined;
    if (body.kind === 'case-photo') {
      const family = await getFamilyUser(request, db);
      if (!family) return reply.code(401).send({ error: 'Sign in with your family account before uploading a case photo.' });
      ownerId = family.id;
      if (typeof body.caseId === 'string') {
        const ownedCase = await db.collection('cases').findOne({ id: body.caseId, ownerId: family.id }, { projection: { id: 1 } });
        if (!ownedCase) return reply.code(404).send({ error: 'This family case was not found.' });
        caseId = body.caseId;
      }
    } else {
      if (typeof body.caseId !== 'string') return reply.code(400).send({ error: 'Choose a public case for this sighting photo.' });
      const publicCase = await db.collection('cases').findOne({ id: body.caseId, visibility: 'public', status: 'Active', 'publicProfile.requested': true, 'publicProfile.fields': 'name' }, { projection: { id: 1 } });
      if (!publicCase) return reply.code(404).send({ error: 'This public case was not found.' });
      caseId = body.caseId;
    }

    const id = randomUUID();
    const publicId = body.kind === 'case-photo'
      ? `reunite/cases/${ownerId}/${id}`
      : `reunite/sightings/${caseId}/${id}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signedParams = { format: 'jpg', overwrite: false, public_id: publicId, timestamp, type: 'authenticated' };
    const signature = cloudinary.utils.api_sign_request(signedParams, config.apiSecret);
    await media.insertOne({ id, publicId, ...(ownerId ? { ownerId } : {}), ...(caseId ? { caseId } : {}), kind: body.kind, format: 'jpg', createdAt: new Date().toISOString() });

    return {
      cloudName: config.cloudName,
      apiKey: config.apiKey,
      timestamp,
      signature,
      publicId,
      type: 'authenticated',
      format: 'jpg',
      overwrite: false,
      mediaId: id
    };
  });

  fastify.post('/api/media/complete', async (request, reply) => {
    const config = configureCloudinary();
    if (!config) return reply.code(503).send({ error: 'Image storage is not configured.' });
    const body = request.body as { mediaId?: unknown } | undefined;
    if (!body || typeof body.mediaId !== 'string') return reply.code(400).send({ error: 'A media upload reference is required.' });
    const asset = await media.findOne({ id: body.mediaId });
    if (!asset) return reply.code(404).send({ error: 'This image upload was not found.' });

    if (asset.kind === 'case-photo') {
      const user = await getFamilyUser(request, db);
      if (!user || user.id !== asset.ownerId) return reply.code(403).send({ error: 'You cannot complete this case photo upload.' });
    }

    try {
      const result = await cloudinary.api.resource(asset.publicId, { resource_type: 'image', type: 'authenticated' });
      if (result.format !== 'jpg' || result.public_id !== asset.publicId) return reply.code(400).send({ error: 'Cloudinary returned an unexpected image.' });
      const uploadedAt = new Date().toISOString();
      await media.updateOne({ id: asset.id }, { $set: { uploadedAt } });
      return { mediaId: asset.id, uploaded: true };
    } catch (error) {
      request.log.warn({ mediaId: asset.id, error }, 'Cloudinary image upload could not be verified');
      return reply.code(400).send({ error: 'The image has not finished uploading. Try again.' });
    }
  });

  fastify.get('/api/media/:mediaId', async (request, reply) => {
    const { mediaId } = request.params as { mediaId: string };
    const asset = await media.findOne({ id: mediaId, uploadedAt: { $exists: true } });
    if (!asset) return reply.code(404).send({ error: 'This image was not found.' });

    const user = await getAuthenticatedUser(request, db);
    const caseItem = asset.caseId
      ? await db.collection('cases').findOne({ id: asset.caseId })
      : asset.ownerId
        ? await db.collection('cases').findOne({ imageAssetId: asset.id, ownerId: asset.ownerId })
        : null;
    if (!caseItem) return reply.code(404).send({ error: 'This image was not found.' });

    const publicCase = caseItem.visibility === 'public' && caseItem.status === 'Active'
      && caseItem.publicProfile?.requested === true && caseItem.publicProfile?.fields?.includes('name');
    const familyOwns = user && user.id === caseItem.ownerId && (user.roles ?? [user.role]).includes('family');
    const moderatorAssigned = user && (user.roles ?? [user.role]).includes('moderator')
      ? Boolean(await db.collection('moderatorInvitations').findOne({ caseId: caseItem.id, moderatorId: user.id, status: 'accepted' }, { projection: { id: 1 } }))
      : false;
    const intakeReviewer = user && (user.roles ?? [user.role]).includes('reviewer') && caseItem.status === 'Review';
    let allowed = Boolean(familyOwns || moderatorAssigned || intakeReviewer);

    if (asset.kind === 'case-photo') {
      allowed ||= Boolean(publicCase && caseItem.publicProfile?.fields?.includes('photo') && caseItem.imageAssetId === asset.id);
    } else {
      const sighting = await db.collection('sightings').findOne({ caseId: caseItem.id, imageAssetId: asset.id }, { projection: { status: 1, public: 1 } });
      allowed ||= Boolean(publicCase && sighting?.status === 'approved' && sighting.public === true);
    }
    if (!allowed) return reply.code(404).send({ error: 'This image was not found.' });

    const config = configureCloudinary();
    if (!config) return reply.code(503).send({ error: 'Image storage is not configured.' });
    const downloadUrl = cloudinary.utils.private_download_url(asset.publicId, asset.format, {
      resource_type: 'image', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60
    });
    reply.header('Cache-Control', 'private, no-store').header('X-Content-Type-Options', 'nosniff');
    return reply.redirect(downloadUrl);
  });
};

export default mediaRoutes;
