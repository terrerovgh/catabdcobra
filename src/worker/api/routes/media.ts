import { Hono } from 'hono';
import type { Env } from '../../env';
import { newId, nowIso } from '../../lib/crypto';
import { err, ok } from '../../lib/response';
import { mapMedia } from '../../lib/mediaMap';
import { canManageAllMedia, requireAuth, type AppVars } from '../middleware';
import galleryIndex from '../../data/gallery-index.json';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB

export const mediaRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>();

/** Public file serve — R2 objects (static files go through ASSETS /gallery/*). */
export async function serveMediaFile(c: {
  env: Env;
  req: { param: (k: string) => string };
}): Promise<Response> {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    `SELECT r2_key, content_type, source, source_path FROM media WHERE id = ?`,
  )
    .bind(id)
    .first<{
      r2_key: string;
      content_type: string | null;
      source: string | null;
      source_path: string | null;
    }>();
  if (!row) return err('not_found', 'Not found', 404);

  if (row.source === 'static' && row.source_path) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/catandcobra/gallery/${encodeURIComponent(row.source_path)}`,
      },
    });
  }

  const obj = await c.env.MEDIA.get(row.r2_key);
  if (!obj) return err('not_found', 'File missing', 404);

  const headers = new Headers();
  headers.set(
    'Content-Type',
    row.content_type || obj.httpMetadata?.contentType || 'application/octet-stream',
  );
  headers.set('Cache-Control', 'public, max-age=86400');
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
  return new Response(obj.body, { headers });
}

mediaRoutes.use('*', requireAuth);

mediaRoutes.get('/', async (c) => {
  const me = c.get('user');
  const artistFilter = c.req.query('artist_id');
  const galleryOnly = c.req.query('gallery') === '1';
  const profileOnly = c.req.query('profile') === '1';
  const source = c.req.query('source'); // static | r2
  const q = (c.req.query('q') || '').trim().toLowerCase();

  let sql = `SELECT * FROM media WHERE 1=1`;
  const binds: unknown[] = [];

  if (!canManageAllMedia(me.role)) {
    if (!me.artist_id) return ok({ media: [], total: 0 });
    sql += ` AND artist_id = ?`;
    binds.push(me.artist_id);
  } else if (artistFilter) {
    sql += ` AND artist_id = ?`;
    binds.push(artistFilter);
  }

  if (galleryOnly) sql += ` AND show_in_gallery = 1`;
  if (profileOnly) sql += ` AND show_in_profile = 1`;
  if (source === 'static' || source === 'r2') {
    sql += ` AND source = ?`;
    binds.push(source);
  }

  sql += ` ORDER BY sort_order ASC, artist_id ASC, source_path ASC, created_at DESC LIMIT 2000`;

  const stmt = c.env.DB.prepare(sql);
  let { results } = binds.length ? await stmt.bind(...binds).all() : await stmt.all();

  let media = results.map((r) => mapMedia(r as Record<string, unknown>));
  if (q) {
    media = media.filter((m) => {
      const hay = [
        m.id,
        m.artist_id,
        m.style_id,
        m.design_id,
        m.slug,
        m.title,
        m.source_path,
        ...(Array.isArray(m.tags) ? m.tags : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return ok({ media, total: media.length });
});

/**
 * Upsert all images from the build-time gallery index (src/assets/gallery).
 * Does not overwrite user-edited fields when meta_locked=1.
 */
mediaRoutes.post('/sync-static', async (c) => {
  const me = c.get('user');
  if (!canManageAllMedia(me.role)) {
    return err('forbidden', 'Only owner/admin can sync gallery folder', 403);
  }

  const pieces = (galleryIndex as { pieces: Array<Record<string, unknown>> }).pieces || [];
  const ts = nowIso();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const p of pieces) {
    const id = String(p.id);
    const sourcePath = String(p.source_path || p.filename);
    const existing = await c.env.DB.prepare(`SELECT id, meta_locked FROM media WHERE id = ? OR source_path = ?`)
      .bind(id, sourcePath)
      .first<{ id: string; meta_locked: number }>();

    if (!existing) {
      await c.env.DB.prepare(
        `INSERT INTO media (
          id, r2_key, artist_id, style_id, design_id, slug, variant,
          title, caption, alt_en, alt_es, tags_json, ai_meta_json,
          show_in_gallery, show_in_profile, sort_order,
          width, height, bytes, content_type, created_at, updated_at,
          source, source_path, meta_locked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, '[]', NULL, 0, 0, 0, NULL, NULL, ?, ?, ?, ?, 'static', ?, 0)`,
      )
        .bind(
          id,
          `static:${sourcePath}`,
          p.artist_id ?? null,
          p.style_id ?? null,
          p.design_id ?? null,
          p.slug ?? null,
          p.variant ?? null,
          p.bytes ?? null,
          p.content_type ?? 'image/jpeg',
          ts,
          ts,
          sourcePath,
        )
        .run();
      inserted++;
      continue;
    }

    if (existing.meta_locked) {
      skipped++;
      continue;
    }

    // Refresh structural fields from filename; keep show flags / text if already set by user
    // Only refresh artist/style/design/slug/variant/bytes when not locked
    await c.env.DB.prepare(
      `UPDATE media SET
        r2_key = ?, source = 'static', source_path = ?,
        artist_id = COALESCE(artist_id, ?),
        style_id = COALESCE(style_id, ?),
        design_id = COALESCE(design_id, ?),
        slug = COALESCE(slug, ?),
        variant = COALESCE(variant, ?),
        bytes = ?, content_type = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        `static:${sourcePath}`,
        sourcePath,
        p.artist_id ?? null,
        p.style_id ?? null,
        p.design_id ?? null,
        p.slug ?? null,
        p.variant ?? null,
        p.bytes ?? null,
        p.content_type ?? 'image/jpeg',
        ts,
        existing.id,
      )
      .run();
    updated++;
  }

  // Mark static rows missing from folder as not in gallery (don't delete — keep metadata)
  const keep = new Set(pieces.map((p) => String(p.source_path || p.filename)));
  const { results: staticRows } = await c.env.DB.prepare(
    `SELECT id, source_path FROM media WHERE source = 'static'`,
  ).all<{ id: string; source_path: string }>();

  let missing = 0;
  for (const row of staticRows || []) {
    if (row.source_path && !keep.has(row.source_path)) {
      await c.env.DB.prepare(
        `UPDATE media SET show_in_gallery = 0, show_in_profile = 0, updated_at = ? WHERE id = ?`,
      )
        .bind(ts, row.id)
        .run();
      missing++;
    }
  }

  return ok({
    folder_count: pieces.length,
    inserted,
    updated,
    skipped_locked: skipped,
    missing_from_folder: missing,
  });
});

mediaRoutes.post('/upload', async (c) => {
  const me = c.get('user');
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return err('bad_request', 'Expected multipart form data');
  }

  const file = form.get('file');
  if (!(file instanceof File)) return err('bad_request', 'file required');
  if (!ALLOWED_TYPES.has(file.type)) {
    return err('bad_request', 'Only JPEG, PNG, WebP, GIF allowed');
  }
  if (file.size > MAX_BYTES) return err('bad_request', 'File too large (max 12MB)');

  let artistId = String(form.get('artist_id') ?? me.artist_id ?? '').trim() || null;
  if (!canManageAllMedia(me.role)) {
    artistId = me.artist_id;
    if (!artistId) return err('forbidden', 'No artist linked to account', 403);
  }

  const id = newId('media');
  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : file.type === 'image/gif'
          ? 'gif'
          : 'jpg';
  const r2Key = `media/${artistId || 'studio'}/${id}.${ext}`;
  const buf = await file.arrayBuffer();

  await c.env.MEDIA.put(r2Key, buf, {
    httpMetadata: { contentType: file.type },
    customMetadata: { mediaId: id },
  });

  const styleId = String(form.get('style_id') ?? '') || null;
  const designId = String(form.get('design_id') ?? '') || null;
  const slug = String(form.get('slug') ?? '') || null;
  const variantRaw = String(form.get('variant') ?? '');
  const variant = variantRaw === 'fresh' || variantRaw === 'healed' ? variantRaw : null;
  const title = String(form.get('title') ?? '') || null;
  // Only published when explicitly selected (default off).
  const showGallery = form.get('show_in_gallery') === '1' ? 1 : 0;
  const showProfile = form.get('show_in_profile') === '1' ? 1 : 0;
  const ts = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO media (
      id, r2_key, artist_id, style_id, design_id, slug, variant,
      title, caption, alt_en, alt_es, tags_json, ai_meta_json,
      show_in_gallery, show_in_profile, sort_order,
      width, height, bytes, content_type, created_at, updated_at,
      source, source_path, meta_locked
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, '[]', NULL, ?, ?, 0, NULL, NULL, ?, ?, ?, ?, 'r2', NULL, 0)`,
  )
    .bind(
      id,
      r2Key,
      artistId,
      styleId,
      designId,
      slug,
      variant,
      title,
      showGallery,
      showProfile,
      file.size,
      file.type,
      ts,
      ts,
    )
    .run();

  const row = await c.env.DB.prepare(`SELECT * FROM media WHERE id = ?`).bind(id).first();
  return ok({ media: mapMedia(row as Record<string, unknown>) }, { status: 201 });
});

mediaRoutes.patch('/:id', async (c) => {
  const me = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM media WHERE id = ?`).bind(id).first();
  if (!existing) return err('not_found', 'Media not found', 404);

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

  const fields = {
    artist_id: body.artist_id !== undefined ? body.artist_id : e.artist_id,
    style_id: body.style_id !== undefined ? body.style_id : e.style_id,
    design_id: body.design_id !== undefined ? body.design_id : e.design_id,
    slug: body.slug !== undefined ? body.slug : e.slug,
    variant: body.variant !== undefined ? body.variant : e.variant,
    title: body.title !== undefined ? body.title : e.title,
    caption: body.caption !== undefined ? body.caption : e.caption,
    alt_en: body.alt_en !== undefined ? body.alt_en : e.alt_en,
    alt_es: body.alt_es !== undefined ? body.alt_es : e.alt_es,
    tags_json:
      body.tags !== undefined
        ? JSON.stringify(Array.isArray(body.tags) ? body.tags : [])
        : e.tags_json,
    ai_meta_json:
      body.ai_meta !== undefined
        ? JSON.stringify(body.ai_meta)
        : body.ai_meta_json !== undefined
          ? body.ai_meta_json
          : e.ai_meta_json,
    show_in_gallery:
      body.show_in_gallery !== undefined ? (body.show_in_gallery ? 1 : 0) : e.show_in_gallery,
    show_in_profile:
      body.show_in_profile !== undefined ? (body.show_in_profile ? 1 : 0) : e.show_in_profile,
    sort_order: body.sort_order !== undefined ? body.sort_order : e.sort_order,
    meta_locked:
      body.meta_locked !== undefined
        ? body.meta_locked
          ? 1
          : 0
        : // auto-lock when user edits content fields
          body.title !== undefined ||
            body.caption !== undefined ||
            body.alt_en !== undefined ||
            body.alt_es !== undefined ||
            body.tags !== undefined ||
            body.show_in_gallery !== undefined ||
            body.show_in_profile !== undefined ||
            body.artist_id !== undefined
          ? 1
          : e.meta_locked,
  };

  if (!canManageAllMedia(me.role)) {
    fields.artist_id = e.artist_id;
  }

  await c.env.DB.prepare(
    `UPDATE media SET
      artist_id = ?, style_id = ?, design_id = ?, slug = ?, variant = ?,
      title = ?, caption = ?, alt_en = ?, alt_es = ?, tags_json = ?,
      ai_meta_json = ?, show_in_gallery = ?, show_in_profile = ?,
      sort_order = ?, meta_locked = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      fields.artist_id,
      fields.style_id,
      fields.design_id,
      fields.slug,
      fields.variant,
      fields.title,
      fields.caption,
      fields.alt_en,
      fields.alt_es,
      fields.tags_json,
      fields.ai_meta_json,
      fields.show_in_gallery,
      fields.show_in_profile,
      fields.sort_order,
      fields.meta_locked,
      nowIso(),
      id,
    )
    .run();

  const row = await c.env.DB.prepare(`SELECT * FROM media WHERE id = ?`).bind(id).first();
  return ok({ media: mapMedia(row as Record<string, unknown>) });
});

mediaRoutes.post('/bulk', async (c) => {
  const me = c.get('user');
  if (!canManageAllMedia(me.role) && me.role !== 'artist') {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  let body: {
    ids?: string[];
    patch?: Record<string, unknown>;
  };
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }

  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (!ids.length) return err('bad_request', 'ids required');
  if (ids.length > 200) return err('bad_request', 'max 200 ids');

  const patch = body.patch || {};
  let updated = 0;
  for (const id of ids) {
    const existing = await c.env.DB.prepare(`SELECT * FROM media WHERE id = ?`).bind(id).first();
    if (!existing) continue;
    const e = existing as Record<string, unknown>;
    if (!canManageAllMedia(me.role) && e.artist_id !== me.artist_id) continue;

    // Reuse patch endpoint logic via direct update of allowed fields
    const show_in_gallery =
      patch.show_in_gallery !== undefined ? (patch.show_in_gallery ? 1 : 0) : e.show_in_gallery;
    const show_in_profile =
      patch.show_in_profile !== undefined ? (patch.show_in_profile ? 1 : 0) : e.show_in_profile;
    let artist_id = e.artist_id;
    if (patch.artist_id !== undefined && canManageAllMedia(me.role)) {
      artist_id = patch.artist_id;
    }

    await c.env.DB.prepare(
      `UPDATE media SET artist_id = ?, show_in_gallery = ?, show_in_profile = ?, meta_locked = 1, updated_at = ? WHERE id = ?`,
    )
      .bind(artist_id, show_in_gallery, show_in_profile, nowIso(), id)
      .run();
    updated++;
  }

  return ok({ updated });
});

mediaRoutes.delete('/:id', async (c) => {
  const me = c.get('user');
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(`SELECT * FROM media WHERE id = ?`).bind(id).first();
  if (!existing) return err('not_found', 'Media not found', 404);

  const e = existing as Record<string, unknown>;
  if (!canManageAllMedia(me.role) && e.artist_id !== me.artist_id) {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  // Don't delete static originals from disk — only hide + remove DB row for r2
  if (e.source === 'static') {
    await c.env.DB.prepare(
      `UPDATE media SET show_in_gallery = 0, show_in_profile = 0, meta_locked = 1, updated_at = ? WHERE id = ?`,
    )
      .bind(nowIso(), id)
      .run();
    return ok({ deleted: false, hidden: true });
  }

  await c.env.MEDIA.delete(String(e.r2_key));
  await c.env.DB.prepare(`DELETE FROM media WHERE id = ?`).bind(id).run();
  return ok({ deleted: true });
});
