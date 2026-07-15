import type { AuthUser, Env } from '../env';
import { addDaysIso, newId, nowIso, sha256Hex } from './crypto';

export const SESSION_COOKIE = 'cc_session';
export const COOKIE_PATH = '/catandcobra';

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function sessionCookieHeader(token: string, maxAgeSec: number, secure = true): string {
  const securePart = secure ? 'Secure; ' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=${COOKIE_PATH}; HttpOnly; ${securePart}SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function clearSessionCookieHeader(secure = true): string {
  const securePart = secure ? 'Secure; ' : '';
  return `${SESSION_COOKIE}=; Path=${COOKIE_PATH}; HttpOnly; ${securePart}SameSite=Lax; Max-Age=0`;
}

export async function createSession(env: Env, userId: string): Promise<string> {
  const token = newId('sess');
  const tokenHash = await sha256Hex(token);
  const days = Number(env.SESSION_TTL_DAYS || '14') || 14;
  const id = newId('s');
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, tokenHash, addDaysIso(days), nowIso())
    .run();
  return token;
}

export async function destroySession(env: Env, token: string | undefined): Promise<void> {
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`).bind(tokenHash).run();
}

export async function getUserFromRequest(env: Env, request: Request): Promise<AuthUser | null> {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.artist_id, u.active
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
     LIMIT 1`,
  )
    .bind(tokenHash, nowIso())
    .first<AuthUser>();

  return row ?? null;
}
