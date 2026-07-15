import { Hono } from 'hono';
import type { AuthUser, Env } from '../../env';
import { issueLoginCode, isRateLimited, verifyLoginCode } from '../../lib/otp';
import { sendOtpEmail } from '../../lib/email';
import {
  clearSessionCookieHeader,
  createSession,
  destroySession,
  getUserFromRequest,
  parseCookies,
  SESSION_COOKIE,
  sessionCookieHeader,
} from '../../lib/session';
import { err, ok } from '../../lib/response';
import { requireAuth, type AppVars } from '../middleware';

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function clientIp(request: Request): string | null {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    null
  );
}

export const authRoutes = new Hono<{ Bindings: Env; Variables: AppVars }>();

authRoutes.post('/request-code', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }
  const email = normalizeEmail((body as { email?: unknown })?.email);
  if (!email) return err('bad_request', 'Valid email required');

  // Always same message — do not reveal allowlist.
  const generic = ok({ message: 'If that email is allowed, a code was sent.' });

  if (await isRateLimited(c.env, email)) {
    return err('rate_limited', 'Too many requests. Try again later.', 429);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, active FROM users WHERE email = ? LIMIT 1`,
  )
    .bind(email)
    .first<{ id: string; active: number }>();

  if (!user || !user.active) {
    return generic;
  }

  const code = await issueLoginCode(c.env, email, clientIp(c.req.raw));
  const result = await sendOtpEmail(c.env, email, code);

  const data: { message: string; devCode?: string } = {
    message: 'If that email is allowed, a code was sent.',
  };
  if (result.devCode && (c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === 'dev')) {
    data.devCode = result.devCode;
  }
  return ok(data);
});

authRoutes.post('/verify', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return err('bad_request', 'Invalid JSON body');
  }
  const email = normalizeEmail((body as { email?: unknown })?.email);
  const code = String((body as { code?: unknown })?.code ?? '').trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return err('bad_request', 'Email and 6-digit code required');
  }

  const check = await verifyLoginCode(c.env, email, code);
  if (!check.ok) {
    const messages = {
      invalid: 'Invalid code',
      expired: 'Code expired',
      locked: 'Too many attempts. Request a new code.',
    } as const;
    return err(check.reason, messages[check.reason], 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, email, name, role, artist_id, active FROM users WHERE email = ? AND active = 1 LIMIT 1`,
  )
    .bind(email)
    .first<AuthUser>();

  if (!user) return err('unauthorized', 'User not found or inactive', 401);

  const token = await createSession(c.env, user.id);
  const days = Number(c.env.SESSION_TTL_DAYS || '14') || 14;
  const maxAge = days * 86_400;
  const host = new URL(c.req.url).hostname;
  const secure =
    c.env.ENVIRONMENT !== 'development' &&
    c.env.ENVIRONMENT !== 'dev' &&
    host !== 'localhost' &&
    host !== '127.0.0.1';

  return new Response(JSON.stringify({ ok: true, data: { user } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': sessionCookieHeader(token, maxAge, secure),
    },
  });
});

authRoutes.post('/logout', async (c) => {
  const cookies = parseCookies(c.req.header('Cookie') ?? null);
  await destroySession(c.env, cookies[SESSION_COOKIE]);
  const host = new URL(c.req.url).hostname;
  const secure =
    c.env.ENVIRONMENT !== 'development' &&
    c.env.ENVIRONMENT !== 'dev' &&
    host !== 'localhost' &&
    host !== '127.0.0.1';
  return new Response(JSON.stringify({ ok: true, data: { loggedOut: true } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookieHeader(secure),
    },
  });
});

authRoutes.get('/me', requireAuth, async (c) => {
  return ok({ user: c.get('user') });
});

// Unauthenticated probe for SPA bootstrap
authRoutes.get('/session', async (c) => {
  const user = await getUserFromRequest(c.env, c.req.raw);
  if (!user) return ok({ user: null });
  return ok({ user });
});
