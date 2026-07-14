-- Cat & Cobra admin — Phase 1 schema

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL CHECK (role IN ('system_admin', 'owner', 'artist')),
  artist_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_artist ON users (artist_id);

CREATE TABLE login_codes (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_login_codes_email ON login_codes (email);
CREATE INDEX idx_login_codes_expires ON login_codes (expires_at);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE artists (
  id TEXT PRIMARY KEY NOT NULL,
  handle TEXT NOT NULL,
  studio_role TEXT NOT NULL CHECK (studio_role IN ('owner', 'resident', 'guest')),
  styles_json TEXT NOT NULL DEFAULT '[]',
  bio_en TEXT,
  bio_es TEXT,
  instagram TEXT,
  mood TEXT NOT NULL DEFAULT 'cat',
  accent TEXT NOT NULL DEFAULT '#d98565',
  portrait_key TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_artists_active ON artists (active);

CREATE TABLE media (
  id TEXT PRIMARY KEY NOT NULL,
  r2_key TEXT NOT NULL,
  artist_id TEXT,
  style_id TEXT,
  design_id TEXT,
  slug TEXT,
  variant TEXT CHECK (variant IS NULL OR variant IN ('fresh', 'healed')),
  title TEXT,
  caption TEXT,
  alt_en TEXT,
  alt_es TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  ai_meta_json TEXT,
  show_in_gallery INTEGER NOT NULL DEFAULT 1,
  show_in_profile INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  content_type TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_media_artist ON media (artist_id);
CREATE INDEX idx_media_gallery ON media (show_in_gallery);
CREATE INDEX idx_media_profile ON media (show_in_profile);

-- Future-phase stubs (empty, ready for migrations later)
CREATE TABLE clients (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY NOT NULL,
  client_id TEXT,
  artist_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  starts_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE promotions (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  active INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE flash_designs (
  id TEXT PRIMARY KEY NOT NULL,
  artist_id TEXT,
  title TEXT,
  media_id TEXT,
  price_cents INTEGER,
  available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE blog_posts (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT,
  title_es TEXT,
  body_en TEXT,
  body_es TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
