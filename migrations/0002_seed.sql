-- Seed artists (ids match src/data/artists.ts) and bootstrap admin users.
-- Replace bootstrap emails via wrangler vars / re-run with your addresses.

INSERT OR IGNORE INTO artists (
  id, handle, studio_role, styles_json, bio_en, bio_es, instagram, mood, accent,
  active, sort_order, created_at, updated_at
) VALUES
(
  'doomkitten',
  '@doomkitten',
  'owner',
  '["horror","neo-traditional"]',
  'Studio owner. Horror and neo-traditional specialist with national TV credits and a soft spot for rescue cats — the mind behind the studio''s animal-adoption ink events.',
  'Dueño del estudio. Especialista en horror y neotradicional con créditos en TV nacional y debilidad por los gatos rescatados: la mente detrás de los eventos de adopción y tinta del estudio.',
  'https://instagram.com/doomkitten',
  'cobra',
  '#e08a6c',
  1, 0, datetime('now'), datetime('now')
),
(
  'flyingsnail',
  '@flyingsnail.ink',
  'resident',
  '["anime","fantasy","pop-culture"]',
  'Fantasy, anime and cartoon worlds rendered in saturated color. If it made your inner nerd happy, it belongs on skin.',
  'Mundos de fantasía, anime y caricatura en color saturado. Si le dio alegría a tu lado nerd, merece estar en la piel.',
  'https://instagram.com/flyingsnail.ink',
  'cat',
  '#f0a8a0',
  1, 1, datetime('now'), datetime('now')
),
(
  'nolandvoid',
  '@nolandvoid_art',
  'resident',
  '["black-gray","realism","pop-culture"]',
  'Intricate black & gray and realism, famous for translating video-game art to skin — ask about the Hollow Knight pieces.',
  'Negro y gris intrincado y realismo, famoso por traducir el arte de videojuegos a la piel: pregunta por las piezas de Hollow Knight.',
  'https://instagram.com/nolandvoid_art',
  'cobra',
  '#87a794',
  1, 2, datetime('now'), datetime('now')
),
(
  'baphometaphysics',
  '@baphometaphysics',
  'resident',
  '["horror","black-gray","fantasy"]',
  'Custom design and alternative concepts, heavy on symbolism and fine detail — bring the strange idea nobody else would get.',
  'Diseño personalizado y conceptos alternativos, con mucho simbolismo y detalle fino: trae esa idea rara que nadie más entendería.',
  'https://instagram.com/baphometaphysics',
  'cobra',
  '#5f8271',
  1, 3, datetime('now'), datetime('now')
),
(
  'deeziebeezie',
  '@deeziebeezie',
  'resident',
  '["neo-traditional","pop-culture","anime"]',
  'Consistent, versatile and endlessly friendly — the artist that makes first-timers feel at home.',
  'Consistente, versátil e infinitamente amigable: el artista que hace sentir en casa a quienes se tatúan por primera vez.',
  'https://instagram.com/deeziebeezie',
  'cat',
  '#cf7051',
  1, 4, datetime('now'), datetime('now')
);

-- Bootstrap system admin (change email after first login via Users UI or SQL).
INSERT OR IGNORE INTO users (
  id, email, name, role, artist_id, active, created_at, updated_at
) VALUES (
  'user_system_admin',
  'admin@terrerov.com',
  'System Admin',
  'system_admin',
  NULL,
  1,
  datetime('now'),
  datetime('now')
);

-- Studio owner linked to doomkitten
INSERT OR IGNORE INTO users (
  id, email, name, role, artist_id, active, created_at, updated_at
) VALUES (
  'user_owner_doomkitten',
  'owner@catandcobra.com',
  'Doomkitten',
  'owner',
  'doomkitten',
  1,
  datetime('now'),
  datetime('now')
);
