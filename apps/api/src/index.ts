import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import casesRoutes from './routes/cases.js';
import authRoutes from './routes/auth.js';
import moderatorRoutes from './routes/moderators.js';
import reviewRoutes from './routes/review.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import mediaRoutes from './routes/media.js';
import { connectToDatabase } from './db.js';

const server = Fastify({
  logger: true
});

async function initializeServer() {
  const frontendOrigins = (process.env.FRONTEND_ORIGIN ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Local development commonly uses either hostname for the same machine.
  // Browsers treat these as different origins, so allow both loopback names
  // in development while keeping production origins explicit.
  if (process.env.NODE_ENV !== 'production') {
    for (const origin of [...frontendOrigins]) {
      try {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          const alternate = new URL(origin);
          alternate.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
          frontendOrigins.push(alternate.origin);
        }
      } catch {
        // Invalid origins are left out of the CORS allowlist.
      }
    }
  }

  await server.register(cors, {
    origin: frontendOrigins,
    credentials: true
  });

}

async function start() {
  try {
    await initializeServer();
    const connection = await connectToDatabase();
    if (!connection) throw new Error('MONGODB_URI is required to run REUNITE with real data.');
    await server.register(authRoutes, { db: connection.db });
    await server.register(moderatorRoutes, { db: connection.db });
    await server.register(reviewRoutes, { db: connection.db });
    await server.register(notificationRoutes, { db: connection.db });
    await server.register(adminRoutes, { db: connection.db });
    await server.register(mediaRoutes, { db: connection.db });
    await server.register(casesRoutes, { db: connection.db });
    server.addHook('onClose', async () => { await connection.client.close(); });
    await server.listen({
      port: Number(process.env.API_PORT ?? process.env.PORT) || 4000,
      host: process.env.API_HOST || '0.0.0.0'
    });
    console.log('REUNITE API listening on http://localhost:4000');
  } catch (error) {
    console.error('Failed to start REUNITE API', error);
    process.exit(1);
  }
}

start();

export default server;
