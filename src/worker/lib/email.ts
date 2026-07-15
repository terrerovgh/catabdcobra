import type { Env } from '../env';

export async function sendOtpEmail(
  env: Env,
  to: string,
  code: string,
): Promise<{ sent: boolean; devCode?: string; error?: string }> {
  const subject = 'Your Cat & Cobra login code';
  const minutes = env.OTP_TTL_MINUTES || '10';
  const text = `Your login code is ${code}. It expires in ${minutes} minutes.\n\nIf you did not request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#f0e7c9;color:#57462f">
      <h1 style="font-size:20px;margin:0 0 12px">Cat &amp; Cobra Admin</h1>
      <p style="margin:0 0 16px">Your one-time login code:</p>
      <p style="font-size:32px;letter-spacing:0.25em;font-weight:700;margin:0 0 16px;font-family:ui-monospace,monospace">${code}</p>
      <p style="margin:0;color:#7d6a4e;font-size:14px">Expires in ${minutes} minutes. If you did not request this, ignore this email.</p>
    </div>
  `;

  const isDev = env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'dev';
  const fromEmail = env.EMAIL_FROM || 'noreply@terrerov.com';
  const fromName = env.EMAIL_FROM_NAME || 'Cat & Cobra';

  try {
    const result = await env.EMAIL.send({
      to,
      from: { email: fromEmail, name: fromName },
      subject,
      text,
      html,
    });
    console.log(
      JSON.stringify({
        event: 'otp_email_sent',
        to,
        from: fromEmail,
        messageId: (result as { messageId?: string })?.messageId,
      }),
    );
    return { sent: true, ...(isDev ? { devCode: code } : {}) };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const codeStr = err?.code || 'EMAIL_SEND_FAILED';
    const message = err?.message || String(e);
    console.error(
      JSON.stringify({
        event: 'otp_email_failed',
        to,
        from: fromEmail,
        code: codeStr,
        message,
      }),
    );
    // Always log OTP so login is never blocked while Email Sending is disabled.
    console.log(`[otp-fallback] to=${to} code=${code} reason=${codeStr}`);

    if (isDev) {
      return { sent: false, devCode: code, error: codeStr };
    }
    return { sent: false, error: codeStr };
  }
}
