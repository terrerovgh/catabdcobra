import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '../env';
import type { AppVars } from './middleware';
import { authRoutes } from './routes/auth';
import { usersRoutes } from './routes/users';
import { artistsRoutes } from './routes/artists';
import { mediaRoutes, serveMediaFile } from './routes/media';
import { publicRoutes } from './routes/public';
import { statsRoutes } from './routes/stats';
import { groupsRoutes } from './routes/groups';
import { err } from '../lib/response';

export function createApiApp() {
  const app = new Hono<{ Bindings: Env; Variables: AppVars }>().basePath('/api');

  app.use(
    '*',
    cors({
      origin: (origin) => origin || '*',
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  app.get('/health', (c) => c.json({ ok: true, data: { service: 'cat-and-cobra-api' } }));

  // Public media files (no session)
  app.get('/media/file/:id', (c) => serveMediaFile(c));

  app.route('/auth', authRoutes);
  app.route('/users', usersRoutes);
  app.route('/artists', artistsRoutes);
  app.route('/media', mediaRoutes);
  app.route('/groups', groupsRoutes);
  app.route('/public', publicRoutes);
  app.route('/stats', statsRoutes);

  app.notFound((c) => err('not_found', `No route ${c.req.method} ${c.req.path}`, 404));

  app.onError((e, c) => {
    console.error('[api]', e);
    return err('internal', 'Internal server error', 500);
  });

  return app;
}
