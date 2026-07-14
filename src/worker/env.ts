export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  MEDIA: R2Bucket;
  EMAIL: {
    send(message: {
      to: string | string[];
      from: string | { email: string; name?: string };
      subject: string;
      html?: string;
      text?: string;
      replyTo?: string;
    }): Promise<{ messageId?: string }>;
  };
  SESSION_TTL_DAYS: string;
  OTP_TTL_MINUTES: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
  ENVIRONMENT: string;
}

export type Role = 'system_admin' | 'owner' | 'artist';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  artist_id: string | null;
  active: number;
}
