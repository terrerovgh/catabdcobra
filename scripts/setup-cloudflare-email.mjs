#!/usr/bin/env node
/**
 * Configure Cloudflare Email Sending for Cat & Cobra OTP.
 *
 * Requires: wrangler OAuth (npx wrangler login) WITHOUT CLOUDFLARE_API_TOKEN in .env
 * Account ID: 1ddbfa86148b21137f5125cbdd637e8c
 * Zone: terrerov.com
 *
 * Usage:
 *   node scripts/setup-cloudflare-email.mjs
 *   node scripts/setup-cloudflare-email.mjs --test-to you@example.com
 */
import { spawnSync } from 'node:child_process';

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || '1ddbfa86148b21137f5125cbdd637e8c';
const DOMAIN = process.env.EMAIL_DOMAIN || 'terrerov.com';
const FROM = process.env.EMAIL_FROM || `noreply@${DOMAIN}`;

function run(cmd, args) {
  const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT };
  delete env.CLOUDFLARE_API_TOKEN; // avoid blocking OAuth / wrong perms
  const r = spawnSync(cmd, args, { encoding: 'utf8', env, shell: false });
  return {
    code: r.status ?? 1,
    out: `${r.stdout || ''}${r.stderr || ''}`,
  };
}

function step(title) {
  console.log(`\n=== ${title} ===`);
}

step('Whoami');
const who = run('npx', ['wrangler', 'whoami']);
console.log(who.out.trim().split('\n').slice(0, 15).join('\n'));

step(`Enable Email Sending for ${DOMAIN}`);
const enable = run('npx', ['wrangler', 'email', 'sending', 'enable', DOMAIN]);
console.log(enable.out.trim());

step('List Email Sending domains');
const list = run('npx', ['wrangler', 'email', 'sending', 'list']);
console.log(list.out.trim());

step(`DNS status for ${DOMAIN}`);
const dns = run('npx', ['wrangler', 'email', 'sending', 'dns', 'get', DOMAIN]);
console.log(dns.out.trim());

const testTo = process.argv.includes('--test-to')
  ? process.argv[process.argv.indexOf('--test-to') + 1]
  : null;

if (testTo) {
  step(`Send test email ${FROM} → ${testTo}`);
  const send = run('npx', [
    'wrangler',
    'email',
    'sending',
    'send',
    '--from',
    FROM,
    '--to',
    testTo,
    '--subject',
    'Cat & Cobra · test OTP mail',
    '--text',
    'If you received this, Email Sending is working for Cat & Cobra.',
  ]);
  console.log(send.out.trim());
  if (send.code !== 0) {
    console.log(`
If you see email.sending_disabled (10203) or Unauthorized (2036):
  1. Open https://dash.cloudflare.com/${ACCOUNT}/email-service/sending
  2. Click "Onboard Domain" → select ${DOMAIN}
  3. Wait for DNS (SPF/DKIM/DMARC on cf-bounce.*) — usually 5–15 minutes
  4. Re-run: node scripts/setup-cloudflare-email.mjs --test-to ${testTo}
`);
  }
} else {
  console.log(`
Next:
  node scripts/setup-cloudflare-email.mjs --test-to your@email.com

Dashboard (if CLI fails):
  https://dash.cloudflare.com/${ACCOUNT}/email-service/sending
`);
}

// Exit non-zero if enable failed with hard errors
if (/email\.sending_disabled|10203/i.test(enable.out + list.out)) {
  process.exitCode = 2;
}
