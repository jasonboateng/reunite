import type { Db } from 'mongodb';
import type { FastifyPluginAsync } from 'fastify';
import { getFamilyUser } from './auth.js';

type Options = { db: Db };

const notificationRoutes: FastifyPluginAsync<Options> = async (fastify, { db }) => {
  const notifications = db.collection('notifications');

  fastify.get('/api/family/notifications', async (request, reply) => {
    const family = await getFamilyUser(request, db);
    if (!family) return reply.code(401).send({ error: 'Sign in to view your notifications.' });
    const [items, unreadCount] = await Promise.all([
      notifications.find({ userId: family.id }, {
        projection: { _id: 0, id: 1, type: 1, title: 1, message: 1, caseId: 1, caseNumber: 1, href: 1, createdAt: 1, readAt: 1 }
      }).sort({ createdAt: -1 }).limit(100).toArray(),
      notifications.countDocuments({ userId: family.id, readAt: { $exists: false } })
    ]);
    return { items, unreadCount };
  });

  fastify.patch('/api/family/notifications/:id/read', async (request, reply) => {
    const family = await getFamilyUser(request, db);
    if (!family) return reply.code(401).send({ error: 'Sign in to update your notifications.' });
    const { id } = request.params as { id: string };
    const result = await notifications.updateOne({ id, userId: family.id, readAt: { $exists: false } }, { $set: { readAt: new Date().toISOString() } });
    if (result.matchedCount === 0) {
      const existing = await notifications.findOne({ id, userId: family.id }, { projection: { id: 1 } });
      if (!existing) return reply.code(404).send({ error: 'This notification was not found.' });
    }
    return { id, read: true };
  });

  fastify.post('/api/family/notifications/read-all', async (request, reply) => {
    const family = await getFamilyUser(request, db);
    if (!family) return reply.code(401).send({ error: 'Sign in to update your notifications.' });
    const result = await notifications.updateMany({ userId: family.id, readAt: { $exists: false } }, { $set: { readAt: new Date().toISOString() } });
    return { markedRead: result.modifiedCount };
  });
};

export default notificationRoutes;
