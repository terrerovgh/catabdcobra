import { Hono } from 'hono';
import type { Env } from '../../env';
import { newId, nowIso } from '../../lib/crypto';
import { err, ok } from '../../lib/response';
import { mapMedia } from '../../lib/mediaMap';
import { canManageAllMedia, requireAuth, type AppVars } from '../middleware';

export const groupsRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>();

groupsRoutes.use('*', requireAuth);

async function loadGroup(env: Env, id: string) {
  const group = await env.DB.prepare(`SELECT * FROM media_groups WHERE id = ?`).bind(id).first();
  if (!group) return null;

  const { results } = await env.DB.prepare(
    `SELECT m.*, gi.sort_order AS group_sort
     FROM media_group_items gi
     JOIN media m ON m.id = gi.media_id
     WHERE gi.group_id = ?
     ORDER BY gi.sort_order ASC, m.created_at DESC`,
  )
    .bind(id)
    .all();

  return {
    ...group,
    active: Boolean((group as { active: number }).active),
    items: results.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...mapMedia(row),
        group_sort: row.group_sort,
      };
    }),
  };
}

groupsRoutes.get('/', async (c) => {
  const me = c.get('user');
  let sql = `SELECT g.*,
    (SELECT COUNT(*) FROM media_group_items gi WHERE gi.group_id = g.id) AS item_count
    FROM media_groups g WHERE 1=1`;
  const binds: unknown[] = [];

  if (!canManageAllMedia(me.role)) {
    if (!me.artist_id) return ok({ groups: [] });
    sql += ` AND (g.artist_id = ? OR g.artist_id IS NULL)`;
    binds.push(me.artist_id);
  }

  const artistFilter = c.req.query('artist_id');
  if (artistFilter && canManageAllMedia(me.role)) {
    sql += ` AND g.artist_id = ?`;
    binds.push(artistFilter);
  }

  sql += ` ORDER BY g.sort_order ASC, g.created_at DESC`;

  const stmt = c.env.DB.prepare(sql);
  const { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

  return ok({
    groups: results.map((r) => {
      const row = r as Record<string, unknown>;
      return { ...row, active: Boolean(row.active), item_count: Number(row.item_count || 0) };
    }),
  });
});

groupsRoutes.get('/:id', async (c) => {
  const group = await loadGroup(c.env, c.req.param('id'));
  if (!group) return err('not_found', 'Group not found', 404);

  const me = c.get('user');
  if (
    !canManageAllMedia(me.role) &&
    group.artist_id &&
    group.artist_id !== me.artist_id
  ) {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  return ok({ group });
});

groupsRoutes.post('/', async (c) => {
  const me = c.get('user');
  let body: {
    name?: string;
    slug?: string;
    kind?: 'carousel' | 'set';
    artist_id?: string | null;
    description?: string;
    media_ids?: string[];
  };
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }

  const name = String(body.name || '').trim();
  if (!name) return err('bad_request', 'name required');

  let artistId = body.artist_id ?? me.artist_id ?? null;
  if (!canManageAllMedia(me.role)) {
    artistId = me.artist_id;
    if (!artistId) return err('forbidden', 'No artist linked', 403);
  }

  const id = newId('grp');
  const ts = nowIso();
  const kind = body.kind === 'set' ? 'set' : 'carousel';
  const slug =
    (body.slug && String(body.slug).trim()) ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  await c.env.DB.prepare(
    `INSERT INTO media_groups (id, name, slug, kind, artist_id, description, active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
  )
    .bind(id, name, slug, kind, artistId, body.description ?? null, ts, ts)
    .run();

  const mediaIds = Array.isArray(body.media_ids) ? body.media_ids.map(String) : [];
  let order = 0;
  for (const mid of mediaIds) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO media_group_items (group_id, media_id, sort_order) VALUES (?, ?, ?)`,
    )
      .bind(id, mid, order++)
      .run();
  }

  const group = await loadGroup(c.env, id);
  return ok({ group }, { status: 201 });
});

groupsRoutes.patch('/:id', async (c) => {
  const me = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM media_groups WHERE id = ?`).bind(id).first();
  if (!existing) return err('not_found', 'Group not found', 404);

  const e = existing as Record<string, unknown>;
  if (!canManageAllMedia(me.role) && e.artist_id !== me.artist_id) {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }

  const name = body.name !== undefined ? String(body.name) : String(e.name);
  const slug = body.slug !== undefined ? String(body.slug) : e.slug;
  const kind = body.kind !== undefined ? body.kind : e.kind;
  const description = body.description !== undefined ? body.description : e.description;
  let artistId = e.artist_id;
  if (body.artist_id !== undefined && canManageAllMedia(me.role)) {
    artistId = body.artist_id;
  }
  const active = body.active !== undefined ? (body.active ? 1 : 0) : e.active;
  const sortOrder = body.sort_order !== undefined ? body.sort_order : e.sort_order;

  await c.env.DB.prepare(
    `UPDATE media_groups SET name = ?, slug = ?, kind = ?, artist_id = ?, description = ?, active = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(name, slug, kind, artistId, description, active, sortOrder, nowIso(), id)
    .run();

  // Replace items if media_ids provided
  if (Array.isArray(body.media_ids)) {
    await c.env.DB.prepare(`DELETE FROM media_group_items WHERE group_id = ?`).bind(id).run();
    let order = 0;
    for (const mid of body.media_ids.map(String)) {
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO media_group_items (group_id, media_id, sort_order) VALUES (?, ?, ?)`,
      )
        .bind(id, mid, order++)
        .run();
    }
  }

  const group = await loadGroup(c.env, id);
  return ok({ group });
});

groupsRoutes.post('/:id/items', async (c) => {
  const me = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM media_groups WHERE id = ?`).bind(id).first();
  if (!existing) return err('not_found', 'Group not found', 404);
  const e = existing as Record<string, unknown>;
  if (!canManageAllMedia(me.role) && e.artist_id !== me.artist_id) {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  let body: { media_ids?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }
  const mediaIds = Array.isArray(body.media_ids) ? body.media_ids.map(String) : [];
  if (!mediaIds.length) return err('bad_request', 'media_ids required');

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), -1) as m FROM media_group_items WHERE group_id = ?`,
  )
    .bind(id)
    .first<{ m: number }>();
  let order = (maxRow?.m ?? -1) + 1;

  for (const mid of mediaIds) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO media_group_items (group_id, media_id, sort_order) VALUES (?, ?, ?)`,
    )
      .bind(id, mid, order++)
      .run();
  }

  const group = await loadGroup(c.env, id);
  return ok({ group });
});

groupsRoutes.delete('/:id/items/:mediaId', async (c) => {
  const me = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM media_groups WHERE id = ?`).bind(id).first();
  if (!existing) return err('not_found', 'Group not found', 404);
  const e = existing as Record<string, unknown>;
  if (!canManageAllMedia(me.role) && e.artist_id !== me.artist_id) {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  await c.env.DB.prepare(`DELETE FROM media_group_items WHERE group_id = ? AND media_id = ?`)
    .bind(id, c.req.param('mediaId'))
    .run();

  const group = await loadGroup(c.env, id);
  return ok({ group });
});

groupsRoutes.delete('/:id', async (c) => {
  const me = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM media_groups WHERE id = ?`).bind(id).first();
  if (!existing) return err('not_found', 'Group not found', 404);
  const e = existing as Record<string, unknown>;
  if (!canManageAllMedia(me.role) && e.artist_id !== me.artist_id) {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  await c.env.DB.prepare(`DELETE FROM media_group_items WHERE group_id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM media_groups WHERE id = ?`).bind(id).run();
  return ok({ deleted: true });
});
