/** App-level types. Binding `Env` comes from `worker-configuration.d.ts` (`wrangler types`). */

export type Role = 'system_admin' | 'owner' | 'artist';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  artist_id: string | null;
  active: number;
}

/** Alias of the generated Cloudflare Env interface for module imports. */
export type Env = Cloudflare.Env;
