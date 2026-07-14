import { Hono } from 'hono';
import type { Env } from '../../env';
import { newId, nowIso } from '../../lib/crypto';
import { err, ok } from '../../lib/response';
import { canManageAllArtists, requireAuth, type AppVars } from '../middleware';

type ArtistBody = {
  id?: string;
  handle?: string;
  studio_role?: 'owner' | 'resident' | 'guest';
  styles?: string[];
  bio_en?: string;
  bio_es?: string;
  instagram?: string;
  mood?: string;
  accent?: string;
  portrait_key?: string | null;
  active?: boolean;
  sort_order?: number;
};

function parseStyles(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function mapArtist(row: Record<string, unknown>) {
  return {
    ...row,
    styles: parseStyles(String(row.styles_json ?? '[]')),
    active: Boolean(row.active),
  };
}

export const artistsRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>();

artistsRoutes.use('*', requireAuth);

artistsRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM artists ORDER BY sort_order ASC, handle ASC`,
  ).all();
  return ok({ artists: results.map((r) => mapArtist(r as Record<string, unknown>)) });
});

artistsRoutes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM artists WHERE id = ?`)
    .bind(c.req.param('id'))
    .first();
  if (!row) return err('not_found', 'Artist not found', 404);
  return ok({ artist: mapArtist(row as Record<string, unknown>) });
});

artistsRoutes.post('/', async (c) => {
  const me = c.get('user');
  if (!canManageAllArtists(me.role)) {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  let body: ArtistBody;
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }

  const handle = String(body.handle ?? '').trim();
  if (!handle) return err('bad_request', 'handle required');

  const id =
    (body.id && /^[a-z0-9_-]+$/i.test(body.id) ? body.id : null) ||
    handle.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
    newId('artist');

  const studioRole = body.studio_role ?? 'resident';
  if (!['owner', 'resident', 'guest'].includes(studioRole)) {
    return err('bad_request', 'Invalid studio_role');
  }

  const ts = nowIso();
  try {
    await c.env.DB.prepare(
      `INSERT INTO artists (
        id, handle, studio_role, styles_json, bio_en, bio_es, instagram,
        mood, accent, portrait_key, active, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        handle,
        studioRole,
        JSON.stringify(body.styles ?? []),
        body.bio_en ?? null,
        body.bio_es ?? null,
        body.instagram ?? null,
        body.mood ?? 'cat',
        body.accent ?? '#d98565',
        body.portrait_key ?? null,
        body.active === false ? 0 : 1,
        body.sort_order ?? 0,
        ts,
        ts,
      )
      .run();
  } catch (e) {
    if (String(e).includes('UNIQUE') || String(e).includes('PRIMARY')) {
      return err('conflict', 'Artist id already exists', 409);
    }
    throw e;
  }

  const row = await c.env.DB.prepare(`SELECT * FROM artists WHERE id = ?`).bind(id).first();
  return ok({ artist: mapArtist(row as Record<string, unknown>) }, { status: 201 });
});

artistsRoutes.patch('/:id', async (c) => {
  const me = c.get('user');
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare(`SELECT * FROM artists WHERE id = ?`).bind(id).first();
  if (!existing) return err('not_found', 'Artist not found', 404);

  const isSelf = me.role === 'artist' && me.artist_id === id;
  if (!canManageAllArtists(me.role) && !isSelf) {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  let body: ArtistBody;
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }

  const e = existing as Record<string, unknown>;
  const handle = body.handle !== undefined ? String(body.handle).trim() : String(e.handle);
  let studioRole = String(e.studio_role);
  let stylesJson = String(e.styles_json);
  let active = Number(e.active);
  let sortOrder = Number(e.sort_order);

  if (canManageAllArtists(me.role)) {
    if (body.studio_role) studioRole = body.studio_role;
    if (body.styles) stylesJson = JSON.stringify(body.styles);
    if (body.active !== undefined) active = body.active ? 1 : 0;
    if (body.sort_order !== undefined) sortOrder = body.sort_order;
  }

  await c.env.DB.prepare(
    `UPDATE artists SET
      handle = ?, studio_role = ?, styles_json = ?, bio_en = ?, bio_es = ?,
      instagram = ?, mood = ?, accent = ?, portrait_key = ?, active = ?,
      sort_order = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      handle,
      studioRole,
      stylesJson,
      body.bio_en !== undefined ? body.bio_en : e.bio_en,
      body.bio_es !== undefined ? body.bio_es : e.bio_es,
      body.instagram !== undefined ? body.instagram : e.instagram,
      body.mood !== undefined ? body.mood : e.mood,
      body.accent !== undefined ? body.accent : e.accent,
      body.portrait_key !== undefined ? body.portrait_key : e.portrait_key,
      active,
      sortOrder,
      nowIso(),
      id,
    )
    .run();

  const row = await c.env.DB.prepare(`SELECT * FROM artists WHERE id = ?`).bind(id).first();
  return ok({ artist: mapArtist(row as Record<string, unknown>) });
});

artistsRoutes.delete('/:id', async (c) => {
  const me = c.get('user');
  if (!canManageAllArtists(me.role)) {
    return err('forbidden', 'Insufficient permissions', 403);
  }
  const id = c.req.param('id');
  const r = await c.env.DB.prepare(`DELETE FROM artists WHERE id = ?`).bind(id).run();
  if (!r.meta.changes) return err('not_found', 'Artist not found', 404);
  return ok({ deleted: true });
});
