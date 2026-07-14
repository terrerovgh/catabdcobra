import { Hono } from 'hono';
import type { Env } from '../../env';
import { ok } from '../../lib/response';
import { mapMedia, parseTags } from '../../lib/mediaMap';
import type { AppVars } from '../middleware';

export const publicRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>();

publicRoutes.get('/artists', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, handle, studio_role, styles_json, bio_en, bio_es, instagram, mood, accent, sort_order
     FROM artists WHERE active = 1 ORDER BY sort_order ASC, handle ASC`,
  ).all();

  return ok({
    artists: results.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id,
        handle: row.handle,
        studio_role: row.studio_role,
        styles: parseTags(String(row.styles_json ?? '[]')),
        bio: { en: row.bio_en, es: row.bio_es },
        instagram: row.instagram,
        mood: row.mood,
        accent: row.accent,
        sort_order: row.sort_order,
      };
    }),
  });
});

publicRoutes.get('/gallery', async (c) => {
  const artistId = c.req.query('artist_id');
  let sql = `SELECT * FROM media WHERE show_in_gallery = 1`;
  const binds: unknown[] = [];
  if (artistId) {
    sql += ` AND artist_id = ?`;
    binds.push(artistId);
  }
  sql += ` ORDER BY sort_order ASC, created_at DESC LIMIT 500`;

  const stmt = c.env.DB.prepare(sql);
  const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

  return ok({
    media: results.map((r) => {
      const m = mapMedia(r as Record<string, unknown>);
      return {
        id: m.id,
        artist_id: m.artist_id,
        style_id: m.style_id,
        design_id: m.design_id,
        slug: m.slug,
        variant: m.variant,
        title: m.title,
        caption: m.caption,
        alt: { en: m.alt_en, es: m.alt_es },
        tags: m.tags,
        sort_order: m.sort_order,
        url: m.url,
      };
    }),
  });
});

publicRoutes.get('/profile-gallery/:artistId', async (c) => {
  const artistId = c.req.param('artistId');
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM media WHERE artist_id = ? AND show_in_profile = 1
     ORDER BY sort_order ASC, created_at DESC LIMIT 200`,
  )
    .bind(artistId)
    .all();

  return ok({
    media: results.map((r) => {
      const m = mapMedia(r as Record<string, unknown>);
      return {
        id: m.id,
        style_id: m.style_id,
        design_id: m.design_id,
        slug: m.slug,
        variant: m.variant,
        title: m.title,
        caption: m.caption,
        alt: { en: m.alt_en, es: m.alt_es },
        tags: m.tags,
        url: m.url,
      };
    }),
  });
});

/** Public carousel by id or slug */
publicRoutes.get('/carousels/:idOrSlug', async (c) => {
  const key = c.req.param('idOrSlug');
  const group = await c.env.DB.prepare(
    `SELECT * FROM media_groups WHERE (id = ? OR slug = ?) AND active = 1 LIMIT 1`,
  )
    .bind(key, key)
    .first();
  if (!group) return ok({ group: null });

  const { results } = await c.env.DB.prepare(
    `SELECT m.*, gi.sort_order AS group_sort
     FROM media_group_items gi
     JOIN media m ON m.id = gi.media_id
     WHERE gi.group_id = ?
     ORDER BY gi.sort_order ASC`,
  )
    .bind((group as { id: string }).id)
    .all();

  return ok({
    group: {
      ...(group as object),
      items: results.map((r) => mapMedia(r as Record<string, unknown>)),
    },
  });
});
