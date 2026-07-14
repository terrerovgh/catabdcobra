const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;

export type Role = 'system_admin' | 'owner' | 'artist';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  artist_id: string | null;
  active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Artist {
  id: string;
  handle: string;
  studio_role: 'owner' | 'resident' | 'guest';
  styles: string[];
  styles_json?: string;
  bio_en: string | null;
  bio_es: string | null;
  instagram: string | null;
  mood: string;
  accent: string;
  portrait_key: string | null;
  active: boolean;
  sort_order: number;
}

export interface MediaItem {
  id: string;
  r2_key: string;
  artist_id: string | null;
  style_id: string | null;
  design_id: string | null;
  slug: string | null;
  variant: 'fresh' | 'healed' | null;
  title: string | null;
  caption: string | null;
  alt_en: string | null;
  alt_es: string | null;
  tags: string[];
  ai_meta_json?: string | null;
  /** Public website gallery + home featured. */
  show_in_gallery: boolean;
  show_on_web?: boolean;
  /** Public artist profile samples. */
  show_in_profile: boolean;
  sort_order: number;
  url: string;
  content_type?: string;
  bytes?: number;
  source?: 'static' | 'r2' | string;
  source_path?: string | null;
  meta_locked?: boolean;
  group_sort?: number;
}

export interface MediaGroup {
  id: string;
  name: string;
  slug: string | null;
  kind: 'carousel' | 'set' | string;
  artist_id: string | null;
  description: string | null;
  active: boolean;
  sort_order: number;
  item_count?: number;
  items?: MediaItem[];
  created_at?: string;
  updated_at?: string;
}

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: { code: string; message: string } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const json = (await res.json()) as ApiOk<T> | ApiErr;
  if (!json.ok) {
    throw new Error(json.error?.message || `Request failed (${res.status})`);
  }
  return json.data;
}

export const api = {
  requestCode: (email: string) =>
    request<{ message: string; devCode?: string }>('/auth/request-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verify: (email: string, code: string) =>
    request<{ user: User }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  logout: () => request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' }),
  session: () => request<{ user: User | null }>('/auth/session'),
  me: () => request<{ user: User }>('/auth/me'),

  listUsers: () => request<{ users: User[] }>('/users'),
  createUser: (body: Partial<User> & { email: string; role: Role }) =>
    request<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: Partial<User>) =>
    request<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string) =>
    request<{ deleted: boolean }>(`/users/${id}`, { method: 'DELETE' }),

  listArtists: () => request<{ artists: Artist[] }>('/artists'),
  createArtist: (body: Partial<Artist> & { handle: string }) =>
    request<{ artist: Artist }>('/artists', { method: 'POST', body: JSON.stringify(body) }),
  updateArtist: (id: string, body: Partial<Artist>) =>
    request<{ artist: Artist }>(`/artists/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteArtist: (id: string) =>
    request<{ deleted: boolean }>(`/artists/${id}`, { method: 'DELETE' }),

  listMedia: (q?: {
    artist_id?: string;
    source?: string;
    gallery?: boolean;
    profile?: boolean;
    q?: string;
  }) => {
    const params = new URLSearchParams();
    if (q?.artist_id) params.set('artist_id', q.artist_id);
    if (q?.source) params.set('source', q.source);
    if (q?.gallery) params.set('gallery', '1');
    if (q?.profile) params.set('profile', '1');
    if (q?.q) params.set('q', q.q);
    const qs = params.toString();
    return request<{ media: MediaItem[]; total: number }>(`/media${qs ? `?${qs}` : ''}`);
  },
  syncStaticMedia: () =>
    request<{
      folder_count: number;
      inserted: number;
      updated: number;
      skipped_locked: number;
      missing_from_folder: number;
    }>('/media/sync-static', { method: 'POST', body: '{}' }),
  uploadMedia: (form: FormData) =>
    request<{ media: MediaItem }>('/media/upload', { method: 'POST', body: form }),
  updateMedia: (id: string, body: Record<string, unknown>) =>
    request<{ media: MediaItem }>(`/media/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  bulkMedia: (ids: string[], patch: Record<string, unknown>) =>
    request<{ updated: number }>('/media/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, patch }),
    }),
  deleteMedia: (id: string) =>
    request<{ deleted: boolean; hidden?: boolean }>(`/media/${id}`, { method: 'DELETE' }),

  listGroups: (q?: { artist_id?: string }) => {
    const params = new URLSearchParams();
    if (q?.artist_id) params.set('artist_id', q.artist_id);
    const qs = params.toString();
    return request<{ groups: MediaGroup[] }>(`/groups${qs ? `?${qs}` : ''}`);
  },
  getGroup: (id: string) => request<{ group: MediaGroup }>(`/groups/${id}`),
  createGroup: (body: {
    name: string;
    slug?: string;
    kind?: 'carousel' | 'set';
    artist_id?: string | null;
    description?: string;
    media_ids?: string[];
  }) => request<{ group: MediaGroup }>('/groups', { method: 'POST', body: JSON.stringify(body) }),
  updateGroup: (id: string, body: Record<string, unknown>) =>
    request<{ group: MediaGroup }>(`/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  addGroupItems: (id: string, media_ids: string[]) =>
    request<{ group: MediaGroup }>(`/groups/${id}/items`, {
      method: 'POST',
      body: JSON.stringify({ media_ids }),
    }),
  removeGroupItem: (id: string, mediaId: string) =>
    request<{ group: MediaGroup }>(`/groups/${id}/items/${mediaId}`, { method: 'DELETE' }),
  deleteGroup: (id: string) =>
    request<{ deleted: boolean }>(`/groups/${id}`, { method: 'DELETE' }),

  stats: () =>
    request<{
      users: number;
      artists: number;
      media: { total: number; in_gallery: number; in_profile: number };
      role: Role;
    }>('/stats'),
};

export function mediaUrl(item: MediaItem): string {
  if (item.url?.startsWith('http')) return item.url;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (item.url?.startsWith('/catandcobra')) return item.url;
  if (item.source === 'static' && item.source_path) {
    return `${base}/gallery/${encodeURIComponent(item.source_path)}`;
  }
  return `${base}${item.url?.startsWith('/') ? item.url : `/${item.url}`}`;
}
