-- Source tracking for static folder vs R2 uploads
ALTER TABLE media ADD COLUMN source TEXT NOT NULL DEFAULT 'r2';
ALTER TABLE media ADD COLUMN source_path TEXT;
ALTER TABLE media ADD COLUMN meta_locked INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_media_source ON media (source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_source_path ON media (source_path) WHERE source_path IS NOT NULL;

-- Carousel / image groups
CREATE TABLE media_groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  kind TEXT NOT NULL DEFAULT 'carousel' CHECK (kind IN ('carousel', 'set')),
  artist_id TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_media_groups_artist ON media_groups (artist_id);

CREATE TABLE media_group_items (
  group_id TEXT NOT NULL REFERENCES media_groups (id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, media_id)
);

CREATE INDEX idx_media_group_items_media ON media_group_items (media_id);
