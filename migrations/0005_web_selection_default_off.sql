-- Public site only shows media with show_in_gallery = 1 (and profile with show_in_profile = 1).
-- Reset so nothing appears on the web until an admin explicitly selects it.
UPDATE media SET show_in_gallery = 0, show_in_profile = 0, updated_at = datetime('now');
