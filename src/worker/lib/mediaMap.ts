export function parseTags(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function mapMedia(row: Record<string, unknown>) {
  const source = String(row.source || 'r2');
  const sourcePath = row.source_path ? String(row.source_path) : null;
  const id = String(row.id);
  // Static originals live under /gallery/<filename>; R2 via API file route
  const url =
    source === 'static' && sourcePath
      ? `/catandcobra/gallery/${encodeURIComponent(sourcePath)}`
      : `/catandcobra/api/media/file/${id}`;

  const showInGallery = Boolean(row.show_in_gallery);
  const showInProfile = Boolean(row.show_in_profile);
  return {
    ...row,
    source,
    source_path: sourcePath,
    tags: parseTags(String(row.tags_json ?? '[]')),
    /** Show on public website gallery / home (admin selection). */
    show_in_gallery: showInGallery,
    show_on_web: showInGallery,
    /** Show on artist profile on the public site. */
    show_in_profile: showInProfile,
    meta_locked: Boolean(row.meta_locked),
    url,
  };
}
