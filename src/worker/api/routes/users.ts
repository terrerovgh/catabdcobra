import { Hono } from 'hono';
import type { Env, Role } from '../../env';
import { newId, nowIso } from '../../lib/crypto';
import { err, ok } from '../../lib/response';
import { canManageUsers, requireAuth, type AppVars } from '../middleware';

const ROLES: Role[] = ['system_admin', 'owner', 'artist'];

export const usersRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>();

usersRoutes.use('*', requireAuth);

usersRoutes.get('/', async (c) => {
  const me = c.get('user');
  if (!canManageUsers(me.role)) {
    // Artists only see themselves
    const self = await c.env.DB.prepare(
      `SELECT id, email, name, role, artist_id, active, created_at, updated_at FROM users WHERE id = ?`,
    )
      .bind(me.id)
      .first();
    return ok({ users: self ? [self] : [] });
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, email, name, role, artist_id, active, created_at, updated_at
     FROM users ORDER BY created_at ASC`,
  ).all();
  return ok({ users: results });
});

usersRoutes.post('/', async (c) => {
  const me = c.get('user');
  if (!canManageUsers(me.role)) return err('forbidden', 'Insufficient permissions', 403);

  let body: {
    email?: string;
    name?: string;
    role?: Role;
    artist_id?: string | null;
    active?: boolean;
  };
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }

  const email = String(body.email ?? '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return err('bad_request', 'Valid email required');
  }

  let role: Role = body.role ?? 'artist';
  if (!ROLES.includes(role)) return err('bad_request', 'Invalid role');

  // Owner cannot create system_admin or other owners (only system_admin can)
  if (me.role === 'owner' && (role === 'system_admin' || role === 'owner')) {
    return err('forbidden', 'Owners can only create artist accounts', 403);
  }

  const artistId = body.artist_id ?? null;
  if (role === 'artist' && !artistId) {
    return err('bad_request', 'artist_id required for artist role');
  }

  const id = newId('user');
  const ts = nowIso();
  try {
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, name, role, artist_id, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        email,
        body.name ?? null,
        role,
        role === 'artist' || role === 'owner' ? artistId : null,
        body.active === false ? 0 : 1,
        ts,
        ts,
      )
      .run();
  } catch (e) {
    const msg = String(e);
    if (msg.includes('UNIQUE')) return err('conflict', 'Email already registered', 409);
    throw e;
  }

  const user = await c.env.DB.prepare(
    `SELECT id, email, name, role, artist_id, active, created_at, updated_at FROM users WHERE id = ?`,
  )
    .bind(id)
    .first();
  return ok({ user }, { status: 201 });
});

usersRoutes.patch('/:id', async (c) => {
  const me = c.get('user');
  const id = c.req.param('id');

  const target = await c.env.DB.prepare(
    `SELECT id, email, name, role, artist_id, active FROM users WHERE id = ?`,
  )
    .bind(id)
    .first<{
      id: string;
      email: string;
      name: string | null;
      role: Role;
      artist_id: string | null;
      active: number;
    }>();
  if (!target) return err('not_found', 'User not found', 404);

  // Self can update name only
  const isSelf = me.id === id;
  if (!isSelf && !canManageUsers(me.role)) {
    return err('forbidden', 'Insufficient permissions', 403);
  }

  let body: {
    name?: string;
    role?: Role;
    artist_id?: string | null;
    active?: boolean;
  };
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }

  let name = target.name;
  let role = target.role;
  let artistId = target.artist_id;
  let active = target.active;

  if (body.name !== undefined) name = String(body.name);

  if (!isSelf || canManageUsers(me.role)) {
    if (body.role !== undefined) {
      if (!canManageUsers(me.role)) return err('forbidden', 'Cannot change role', 403);
      if (!ROLES.includes(body.role)) return err('bad_request', 'Invalid role');
      if (me.role === 'owner' && (body.role === 'system_admin' || body.role === 'owner')) {
        return err('forbidden', 'Owners cannot assign this role', 403);
      }
      if (me.role === 'owner' && target.role === 'system_admin') {
        return err('forbidden', 'Cannot modify system admin', 403);
      }
      role = body.role;
    }
    if (body.artist_id !== undefined && canManageUsers(me.role)) {
      artistId = body.artist_id;
    }
    if (body.active !== undefined && canManageUsers(me.role)) {
      if (me.role === 'owner' && target.role === 'system_admin') {
        return err('forbidden', 'Cannot modify system admin', 403);
      }
      active = body.active ? 1 : 0;
    }
  }

  await c.env.DB.prepare(
    `UPDATE users SET name = ?, role = ?, artist_id = ?, active = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(name, role, artistId, active, nowIso(), id)
    .run();

  const user = await c.env.DB.prepare(
    `SELECT id, email, name, role, artist_id, active, created_at, updated_at FROM users WHERE id = ?`,
  )
    .bind(id)
    .first();
  return ok({ user });
});

usersRoutes.delete('/:id', async (c) => {
  const me = c.get('user');
  if (me.role !== 'system_admin') {
    return err('forbidden', 'Only system admin can delete users', 403);
  }
  const id = c.req.param('id');
  if (id === me.id) return err('bad_request', 'Cannot delete yourself');

  const r = await c.env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id).run();
  if (!r.meta.changes) return err('not_found', 'User not found', 404);
  return ok({ deleted: true });
});
