import { Hono } from 'hono';
import type { Env } from '../../env';
import { ok } from '../../lib/response';
import { canManageAllMedia, canManageUsers, requireAuth, type AppVars } from '../middleware';

export const statsRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>();

statsRoutes.use('*', requireAuth);

statsRoutes.get('/', async (c) => {
  const me = c.get('user');

  const artists = await c.env.DB.prepare(
    `SELECT COUNT(*) as c FROM artists WHERE active = 1`,
  ).first<{ c: number }>();

  let usersCount = 0;
  if (canManageUsers(me.role)) {
    const users = await c.env.DB.prepare(`SELECT COUNT(*) as c FROM users`).first<{ c: number }>();
    usersCount = users?.c ?? 0;
  }

  let mediaSql = `SELECT
    COUNT(*) as total,
    SUM(CASE WHEN show_in_gallery = 1 THEN 1 ELSE 0 END) as in_gallery,
    SUM(CASE WHEN show_in_profile = 1 THEN 1 ELSE 0 END) as in_profile
    FROM media WHERE 1=1`;
  const binds: unknown[] = [];
  if (!canManageAllMedia(me.role)) {
    if (!me.artist_id) {
      return ok({
        users: usersCount,
        artists: artists?.c ?? 0,
        media: { total: 0, in_gallery: 0, in_profile: 0 },
        role: me.role,
      });
    }
    mediaSql += ` AND artist_id = ?`;
    binds.push(me.artist_id);
  }

  const stmt = c.env.DB.prepare(mediaSql);
  const media = binds.length
    ? await stmt.bind(...binds).first<{ total: number; in_gallery: number; in_profile: number }>()
    : await stmt.first<{ total: number; in_gallery: number; in_profile: number }>();

  return ok({
    users: usersCount,
    artists: artists?.c ?? 0,
    media: {
      total: media?.total ?? 0,
      in_gallery: media?.in_gallery ?? 0,
      in_profile: media?.in_profile ?? 0,
    },
    role: me.role,
  });
});
