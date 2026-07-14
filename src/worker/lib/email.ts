import type { Env } from '../env';

export async function sendOtpEmail(
  env: Env,
  to: string,
  code: string,
): Promise<{ sent: boolean; devCode?: string }> {
  const subject = 'Your Cat & Cobra login code';
  const text = `Your login code is ${code}. It expires in ${env.OTP_TTL_MINUTES || '10'} minutes.\n\nIf you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px">
      <h1 style="font-size:20px;margin:0 0 12px">Cat &amp; Cobra Admin</h1>
      <p style="margin:0 0 16px;color:#444">Your login code:</p>
      <p style="font-size:32px;letter-spacing:0.25em;font-weight:700;margin:0 0 16px">${code}</p>
      <p style="margin:0;color:#666;font-size:14px">Expires in ${env.OTP_TTL_MINUTES || '10'} minutes. If you did not request this, ignore this email.</p>
    </div>
  `;

  const isDev = env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'dev';

  try {
    await env.EMAIL.send({
      to,
      from: { email: env.EMAIL_FROM || 'noreply@terrerov.com', name: env.EMAIL_FROM_NAME || 'Cat & Cobra' },
      subject,
      text,
      html,
    });
    return { sent: true, ...(isDev ? { devCode: code } : {}) };
  } catch (e) {
    // Local/dev without Email Sending onboarded: log code so login still works.
    console.error('[email] send failed', e);
    if (isDev) {
      console.log(`[dev OTP] ${to} => ${code}`);
      return { sent: false, devCode: code };
    }
    throw e;
  }
}
