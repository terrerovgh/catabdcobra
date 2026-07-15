import { createMiddleware } from 'hono/factory';
import type { AuthUser, Env, Role } from '../env';
import { getUserFromRequest } from '../lib/session';
import { err } from '../lib/response';

export type AppVars = {
  user: AuthUser;
};

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: AppVars }>(
  async (c, next) => {
    const user = await getUserFromRequest(c.env, c.req.raw);
    if (!user) {
      return err('unauthorized', 'Authentication required', 401);
    }
    c.set('user', user);
    await next();
  },
);

export function requireRoles(...roles: Role[]) {
  return createMiddleware<{ Bindings: Env; Variables: AppVars }>(async (c, next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      return err('forbidden', 'Insufficient permissions', 403);
    }
    await next();
  });
}

export function canManageUsers(role: Role): boolean {
  return role === 'system_admin' || role === 'owner';
}

export function canManageAllArtists(role: Role): boolean {
  return role === 'system_admin' || role === 'owner';
}

export function canManageAllMedia(role: Role): boolean {
  return role === 'system_admin' || role === 'owner';
}
