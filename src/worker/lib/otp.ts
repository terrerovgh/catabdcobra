import type { Env } from '../env';
import { addMinutesIso, newId, nowIso, randomDigits, sha256Hex, timingSafeEqual } from './crypto';

const MAX_ATTEMPTS = 5;

export async function issueLoginCode(
  env: Env,
  email: string,
  ip: string | null,
): Promise<string> {
  const minutes = Number(env.OTP_TTL_MINUTES || '10') || 10;
  const code = randomDigits(6);
  const codeHash = await sha256Hex(code);

  // Invalidate unused codes for this email
  await env.DB.prepare(
    `UPDATE login_codes SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL`,
  )
    .bind(nowIso(), email)
    .run();

  await env.DB.prepare(
    `INSERT INTO login_codes (id, email, code_hash, expires_at, attempts, consumed_at, ip, created_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?)`,
  )
    .bind(newId('otp'), email, codeHash, addMinutesIso(minutes), ip, nowIso())
    .run();

  return code;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'expired' | 'locked' };

export async function verifyLoginCode(
  env: Env,
  email: string,
  code: string,
): Promise<VerifyResult> {
  const row = await env.DB.prepare(
    `SELECT id, code_hash, expires_at, attempts
     FROM login_codes
     WHERE email = ? AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
  )
    .bind(email)
    .first<{ id: string; code_hash: string; expires_at: string; attempts: number }>();

  if (!row) return { ok: false, reason: 'invalid' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'locked' };
  if (row.expires_at < nowIso()) return { ok: false, reason: 'expired' };

  const hash = await sha256Hex(code.trim());
  if (!timingSafeEqual(hash, row.code_hash)) {
    await env.DB.prepare(`UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?`)
      .bind(row.id)
      .run();
    return { ok: false, reason: 'invalid' };
  }

  await env.DB.prepare(`UPDATE login_codes SET consumed_at = ? WHERE id = ?`)
    .bind(nowIso(), row.id)
    .run();

  return { ok: true };
}

/** Simple rate limit: max N request-code per email in window. */
export async function isRateLimited(
  env: Env,
  email: string,
  windowMinutes = 15,
  max = 5,
): Promise<boolean> {
  const since = addMinutesIso(-windowMinutes);
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM login_codes WHERE email = ? AND created_at > ?`,
  )
    .bind(email, since)
    .first<{ c: number }>();
  return (row?.c ?? 0) >= max;
}
