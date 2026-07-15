-- Optional artist logins for local/role testing.
-- Emails are placeholders — change in Users UI before production.

INSERT OR IGNORE INTO users (
  id, email, name, role, artist_id, active, created_at, updated_at
) VALUES
(
  'user_artist_flyingsnail',
  'flyingsnail@catandcobra.com',
  'Flying Snail',
  'artist',
  'flyingsnail',
  1,
  datetime('now'),
  datetime('now')
),
(
  'user_artist_nolandvoid',
  'nolandvoid@catandcobra.com',
  'Noland Void',
  'artist',
  'nolandvoid',
  1,
  datetime('now'),
  datetime('now')
),
(
  'user_artist_baphometaphysics',
  'baphometaphysics@catandcobra.com',
  'Baphometaphysics',
  'artist',
  'baphometaphysics',
  1,
  datetime('now'),
  datetime('now')
),
(
  'user_artist_deeziebeezie',
  'deeziebeezie@catandcobra.com',
  'Deezie Beezie',
  'artist',
  'deeziebeezie',
  1,
  datetime('now'),
  datetime('now')
);
