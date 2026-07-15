import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  api,
  mediaUrl,
  type Artist,
  type MediaGroup,
  type MediaItem,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { suggestImageMetadata } from '../lib/aiMeta';

const STYLES = [
  'horror',
  'anime',
  'neo-traditional',
  'fantasy',
  'pop-culture',
  'black-gray',
  'realism',
];
const DESIGNS = [
  'character',
  'portrait',
  'animal',
  'occult',
  'flash',
  'nature',
  'lettering',
  'sleeve',
  'abstract',
  'other',
];

type Tab = 'all' | 'carousels';

export function GalleryPage() {
  const { user: me } = useAuth();
  const [tab, setTab] = useState<Tab>('all');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [groups, setGroups] = useState<MediaGroup[]>([]);
  const [activeGroup, setActiveGroup] = useState<MediaGroup | null>(null);
  const [filterArtist, setFilterArtist] = useState('');
  const [filterVis, setFilterVis] = useState<'all' | 'gallery' | 'profile' | 'hidden'>('all');
  const [filterSource, setFilterSource] = useState<'all' | 'static' | 'r2'>('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [aiBusy, setAiBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [upload, setUpload] = useState({
    artist_id: me?.artist_id ?? '',
    style_id: '',
    design_id: '',
    show_in_gallery: false,
    show_in_profile: false,
  });

  const canManage = me?.role === 'system_admin' || me?.role === 'owner';

  const loadMedia = useCallback(async () => {
    const q: Parameters<typeof api.listMedia>[0] = {};
    if (filterArtist) q.artist_id = filterArtist;
    if (filterSource !== 'all') q.source = filterSource;
    if (search.trim()) q.q = search.trim();
    if (filterVis === 'gallery') q.gallery = true;
    if (filterVis === 'profile') q.profile = true;

    const { media: list } = await api.listMedia(q);
    let rows = list;
    if (filterVis === 'hidden') {
      rows = list.filter((m) => !m.show_in_gallery && !m.show_in_profile);
    }
    setMedia(rows);
  }, [filterArtist, filterSource, filterVis, search]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, g] = await Promise.all([api.listArtists(), api.listGroups()]);
      setArtists(a.artists);
      setGroups(g.groups);
      await loadMedia();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [loadMedia]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Auto-sync folder once if empty
  useEffect(() => {
    if (!canManage || loading) return;
    if (media.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        setSyncing(true);
        const res = await api.syncStaticMedia();
        if (cancelled) return;
        setOkMsg(
          `Sincronizada carpeta: ${res.folder_count} archivos (${res.inserted} nuevas)`,
        );
        await loadMedia();
      } catch {
        /* ignore auto-sync errors */
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // only when first loaded empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, canManage]);

  const artistLabel = useMemo(() => {
    const map = new Map(artists.map((a) => [a.id, a.handle]));
    return (id: string | null) => (id ? map.get(id) || id : '—');
  }, [artists]);

  async function onSync() {
    setSyncing(true);
    setOkMsg(null);
    setError(null);
    try {
      const res = await api.syncStaticMedia();
      setOkMsg(
        `Carpeta: ${res.folder_count} · nuevas ${res.inserted} · actualizadas ${res.updated} · bloqueadas ${res.skipped_locked}`,
      );
      await loadMedia();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fileInput = formEl.elements.namedItem('file') as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    if (upload.artist_id) fd.append('artist_id', upload.artist_id);
    if (upload.style_id) fd.append('style_id', upload.style_id);
    if (upload.design_id) fd.append('design_id', upload.design_id);
    fd.append('show_in_gallery', upload.show_in_gallery ? '1' : '0');
    fd.append('show_in_profile', upload.show_in_profile ? '1' : '0');
    setUploading(true);
    setOkMsg(null);
    try {
      const { media: created } = await api.uploadMedia(fd);
      formEl.reset();
      setSelected(created);
      setOkMsg('Imagen subida a R2');
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  async function saveSelected(patch: Record<string, unknown>) {
    if (!selected) return;
    try {
      const { media: updated } = await api.updateMedia(selected.id, patch);
      setSelected(updated);
      setMedia((list) => list.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  async function runAi() {
    if (!selected) return;
    setAiBusy(true);
    setOkMsg(null);
    try {
      const suggestion = await suggestImageMetadata({
        fileOrUrl: mediaUrl(selected),
        artistId: selected.artist_id,
        styleId: selected.style_id,
        designId: selected.design_id,
        useModel: false,
      });
      await saveSelected({
        title: suggestion.title,
        caption: suggestion.caption,
        alt_en: suggestion.alt_en,
        alt_es: suggestion.alt_es,
        tags: suggestion.tags,
        style_id: suggestion.style_id ?? selected.style_id,
        design_id: suggestion.design_id ?? selected.design_id,
        ai_meta: suggestion,
      });
      setOkMsg('Sugerencias IA aplicadas — revísalas y ajusta');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IA falló');
    } finally {
      setAiBusy(false);
    }
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCheckAll() {
    if (checked.size === media.length) setChecked(new Set());
    else setChecked(new Set(media.map((m) => m.id)));
  }

  async function bulkPatch(patch: Record<string, unknown>, label: string) {
    if (!checked.size) return;
    setOkMsg(null);
    try {
      const { updated } = await api.bulkMedia([...checked], patch);
      setOkMsg(`${label}: ${updated} imágenes`);
      setChecked(new Set());
      await loadMedia();
      if (selected && checked.has(selected.id)) {
        const fresh = await api.listMedia();
        const row = fresh.media.find((m) => m.id === selected.id);
        if (row) setSelected(row);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en acción masiva');
    }
  }

  async function createCarouselFromSelection() {
    if (!checked.size) {
      setError('Selecciona al menos una imagen');
      return;
    }
    const name = groupName.trim() || `Carrusel ${new Date().toLocaleDateString('es')}`;
    try {
      const { group } = await api.createGroup({
        name,
        kind: 'carousel',
        artist_id: filterArtist || me?.artist_id || null,
        media_ids: [...checked],
      });
      setOkMsg(`Carrusel “${group.name}” creado con ${checked.size} piezas`);
      setGroupName('');
      setChecked(new Set());
      const g = await api.listGroups();
      setGroups(g.groups);
      setTab('carousels');
      const full = await api.getGroup(group.id);
      setActiveGroup(full.group);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el carrusel');
    }
  }

  async function openGroup(id: string) {
    try {
      const { group } = await api.getGroup(id);
      setActiveGroup(group);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al abrir grupo');
    }
  }

  async function addCheckedToGroup() {
    if (!activeGroup || !checked.size) return;
    try {
      const { group } = await api.addGroupItems(activeGroup.id, [...checked]);
      setActiveGroup(group);
      setOkMsg(`Añadidas ${checked.size} al carrusel`);
      setChecked(new Set());
      const g = await api.listGroups();
      setGroups(g.groups);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al añadir');
    }
  }

  async function removeFromGroup(mediaId: string) {
    if (!activeGroup) return;
    try {
      const { group } = await api.removeGroupItem(activeGroup.id, mediaId);
      setActiveGroup(group);
      const g = await api.listGroups();
      setGroups(g.groups);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al quitar');
    }
  }

  async function deleteGroup() {
    if (!activeGroup) return;
    if (!confirm(`¿Eliminar el carrusel “${activeGroup.name}”?`)) return;
    try {
      await api.deleteGroup(activeGroup.id);
      setActiveGroup(null);
      const g = await api.listGroups();
      setGroups(g.groups);
      setOkMsg('Carrusel eliminado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header row">
        <div>
          <h1>Galería</h1>
          <p className="admin-muted">
            Solo las imágenes marcadas <strong>En la web</strong> aparecen en el sitio público.
            Por defecto no se publican hasta que las selecciones.
          </p>
        </div>
        <div className="admin-row" style={{ alignItems: 'center' }}>
          {canManage && (
            <button type="button" className="admin-btn primary" disabled={syncing} onClick={() => void onSync()}>
              {syncing ? 'Sincronizando…' : 'Sincronizar carpeta'}
            </button>
          )}
        </div>
      </header>

      <div className="admin-tabs">
        <button type="button" className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
          Todas las imágenes ({media.length})
        </button>
        <button
          type="button"
          className={tab === 'carousels' ? 'active' : ''}
          onClick={() => setTab('carousels')}
        >
          Carruseles ({groups.length})
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {okMsg && <p className="admin-ok">{okMsg}</p>}

      {tab === 'all' && (
        <>
          <div className="admin-toolbar panel">
            <div className="admin-row">
              {canManage && (
                <label>
                  Artista
                  <select value={filterArtist} onChange={(e) => setFilterArtist(e.target.value)}>
                    <option value="">Todos</option>
                    {artists.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.handle}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Publicación web
                <select
                  value={filterVis}
                  onChange={(e) => setFilterVis(e.target.value as typeof filterVis)}
                >
                  <option value="all">Todas (archivo)</option>
                  <option value="gallery">Publicadas en la web</option>
                  <option value="profile">En perfil artista</option>
                  <option value="hidden">No publicadas</option>
                </select>
              </label>
              <label>
                Origen
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
                >
                  <option value="all">Carpeta + R2</option>
                  <option value="static">Solo carpeta</option>
                  <option value="r2">Solo subidas</option>
                </select>
              </label>
              <label>
                Buscar
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="slug, tag, título…"
                />
              </label>
            </div>

            {!!checked.size && (
              <div className="admin-bulk-bar">
                <span>
                  <strong>{checked.size}</strong> seleccionadas
                </span>
                <button
                  type="button"
                  className="admin-btn primary sm"
                  onClick={() => bulkPatch({ show_in_gallery: true }, 'Publicadas en la web')}
                >
                  ✓ Publicar en la web
                </button>
                <button
                  type="button"
                  className="admin-btn ghost sm"
                  onClick={() => bulkPatch({ show_in_gallery: false }, 'Quitadas de la web')}
                >
                  Quitar de la web
                </button>
                <button
                  type="button"
                  className="admin-btn ghost sm"
                  onClick={() => bulkPatch({ show_in_profile: true }, 'Perfil ON')}
                >
                  → Perfil artista
                </button>
                <button
                  type="button"
                  className="admin-btn ghost sm"
                  onClick={() => bulkPatch({ show_in_profile: false }, 'Perfil OFF')}
                >
                  Quitar de perfil
                </button>
                {canManage && (
                  <label className="bulk-artist">
                    Asignar a
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        void bulkPatch({ artist_id: v === '__none__' ? null : v }, 'Artista');
                        e.target.value = '';
                      }}
                    >
                      <option value="">—</option>
                      <option value="__none__">Sin artista</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.handle}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <input
                  className="group-name-input"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nombre del carrusel"
                />
                <button type="button" className="admin-btn primary sm" onClick={() => void createCarouselFromSelection()}>
                  Crear carrusel
                </button>
                {activeGroup && (
                  <button type="button" className="admin-btn ghost sm" onClick={() => void addCheckedToGroup()}>
                    Añadir a “{activeGroup.name}”
                  </button>
                )}
                <button type="button" className="admin-btn ghost sm" onClick={() => setChecked(new Set())}>
                  Limpiar
                </button>
              </div>
            )}
          </div>

          {canManage && (
            <details className="panel upload-details">
              <summary>Subir nueva imagen (R2)</summary>
              <form className="admin-form" onSubmit={onUpload} style={{ marginTop: '0.75rem' }}>
                <label>
                  Archivo
                  <input
                    name="file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    required
                  />
                </label>
                <div className="admin-row">
                  <label>
                    Artista
                    <select
                      value={upload.artist_id}
                      onChange={(e) => setUpload((u) => ({ ...u, artist_id: e.target.value }))}
                    >
                      <option value="">Estudio</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.handle}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estilo
                    <select
                      value={upload.style_id}
                      onChange={(e) => setUpload((u) => ({ ...u, style_id: e.target.value }))}
                    >
                      <option value="">—</option>
                      {STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Diseño
                    <select
                      value={upload.design_id}
                      onChange={(e) => setUpload((u) => ({ ...u, design_id: e.target.value }))}
                    >
                      <option value="">—</option>
                      {DESIGNS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="admin-row checks">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={upload.show_in_gallery}
                      onChange={(e) => setUpload((u) => ({ ...u, show_in_gallery: e.target.checked }))}
                    />
                    Publicar en la web
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={upload.show_in_profile}
                      onChange={(e) => setUpload((u) => ({ ...u, show_in_profile: e.target.checked }))}
                    />
                    Mostrar en perfil artista
                  </label>
                </div>
                <button type="submit" className="admin-btn primary" disabled={uploading}>
                  {uploading ? 'Subiendo…' : 'Subir'}
                </button>
              </form>
            </details>
          )}

          <div className="admin-gallery-layout">
            <div>
              <div className="admin-select-all">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={media.length > 0 && checked.size === media.length}
                    onChange={toggleCheckAll}
                  />
                  Seleccionar todas ({media.length})
                </label>
              </div>
              <div className="admin-media-grid dense">
                {loading && <p className="admin-muted">Cargando…</p>}
                {!loading &&
                  media.map((m) => (
                    <div
                      key={m.id}
                      className={`admin-media-card ${selected?.id === m.id ? 'active' : ''} ${checked.has(m.id) ? 'checked' : ''}`}
                    >
                      <label className="check-overlay">
                        <input
                          type="checkbox"
                          checked={checked.has(m.id)}
                          onChange={() => toggleCheck(m.id)}
                        />
                      </label>
                      <button type="button" className="thumb-btn" onClick={() => setSelected(m)}>
                        <img src={mediaUrl(m)} alt={m.alt_en || m.title || m.slug || m.id} loading="lazy" />
                      </button>
                      <div className="card-meta">
                        <span className="flags">
                          <span className={m.show_in_gallery ? 'on-web' : 'off-web'} title="En la web">
                            {m.show_in_gallery ? 'WEB' : '—'}
                          </span>
                          {m.show_in_profile ? ' ·P' : ''}
                          {m.source === 'static' ? ' 📁' : ' ☁'}
                        </span>
                        <span className="artist-mini">{artistLabel(m.artist_id)}</span>
                      </div>
                    </div>
                  ))}
                {!loading && !media.length && (
                  <p className="admin-muted">
                    No hay imágenes. Pulsa “Sincronizar carpeta” o sube un archivo.
                  </p>
                )}
              </div>
            </div>

            {selected && (
              <aside className="admin-form panel editor sticky-editor">
                <img className="editor-preview" src={mediaUrl(selected)} alt="" />
                <p className="admin-muted sm">
                  {selected.source === 'static' ? 'Carpeta' : 'R2'} · {selected.source_path || selected.id}
                </p>

                {canManage && (
                  <label>
                    Artista (quién)
                    <select
                      value={selected.artist_id ?? ''}
                      onChange={(e) => {
                        const artist_id = e.target.value || null;
                        setSelected({ ...selected, artist_id });
                        void saveSelected({ artist_id });
                      }}
                    >
                      <option value="">Sin asignar</option>
                      {artists.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.handle}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="web-publish-box">
                  <label className="check publish-main">
                    <input
                      type="checkbox"
                      checked={!!selected.show_in_gallery}
                      onChange={(e) => {
                        const show_in_gallery = e.target.checked;
                        setSelected({ ...selected, show_in_gallery });
                        void saveSelected({ show_in_gallery });
                      }}
                    />
                    <span>
                      <strong>Mostrar en la web</strong>
                      <em className="admin-muted sm">
                        Si no está marcado, no aparece en galería ni home del sitio público.
                      </em>
                    </span>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={!!selected.show_in_profile}
                      onChange={(e) => {
                        const show_in_profile = e.target.checked;
                        setSelected({ ...selected, show_in_profile });
                        void saveSelected({ show_in_profile });
                      }}
                    />
                    También en perfil del artista
                  </label>
                </div>

                <label>
                  Título
                  <input
                    value={selected.title ?? ''}
                    onChange={(e) => setSelected({ ...selected, title: e.target.value })}
                    onBlur={() => saveSelected({ title: selected.title })}
                  />
                </label>
                <label>
                  Caption
                  <textarea
                    rows={2}
                    value={selected.caption ?? ''}
                    onChange={(e) => setSelected({ ...selected, caption: e.target.value })}
                    onBlur={() => saveSelected({ caption: selected.caption })}
                  />
                </label>
                <label>
                  Alt (EN)
                  <input
                    value={selected.alt_en ?? ''}
                    onChange={(e) => setSelected({ ...selected, alt_en: e.target.value })}
                    onBlur={() => saveSelected({ alt_en: selected.alt_en })}
                  />
                </label>
                <label>
                  Alt (ES)
                  <input
                    value={selected.alt_es ?? ''}
                    onChange={(e) => setSelected({ ...selected, alt_es: e.target.value })}
                    onBlur={() => saveSelected({ alt_es: selected.alt_es })}
                  />
                </label>
                <label>
                  Tags (coma)
                  <input
                    value={(selected.tags ?? []).join(', ')}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        tags: e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                    onBlur={() => saveSelected({ tags: selected.tags })}
                  />
                </label>
                <div className="admin-row">
                  <label>
                    Estilo
                    <select
                      value={selected.style_id ?? ''}
                      onChange={(e) => {
                        const style_id = e.target.value || null;
                        setSelected({ ...selected, style_id });
                        void saveSelected({ style_id });
                      }}
                    >
                      <option value="">—</option>
                      {STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Diseño
                    <select
                      value={selected.design_id ?? ''}
                      onChange={(e) => {
                        const design_id = e.target.value || null;
                        setSelected({ ...selected, design_id });
                        void saveSelected({ design_id });
                      }}
                    >
                      <option value="">—</option>
                      {DESIGNS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="button" className="admin-btn primary" disabled={aiBusy} onClick={() => void runAi()}>
                  {aiBusy ? 'Analizando…' : 'Sugerir metadatos (IA)'}
                </button>
                {selected.source !== 'static' && (
                  <button
                    type="button"
                    className="admin-btn danger sm"
                    onClick={async () => {
                      if (!confirm('¿Eliminar esta imagen de R2?')) return;
                      await api.deleteMedia(selected.id);
                      setSelected(null);
                      await loadMedia();
                    }}
                  >
                    Eliminar de R2
                  </button>
                )}
                {selected.source === 'static' && (
                  <p className="admin-muted sm">
                    Archivo de carpeta: no se borra del disco. Usa “ocultar” (G/P) para esconderla.
                  </p>
                )}
              </aside>
            )}
          </div>
        </>
      )}

      {tab === 'carousels' && (
        <div className="admin-gallery-layout">
          <div>
            <div className="admin-card" style={{ marginBottom: '1rem' }}>
              <h2>Carruseles / grupos</h2>
              <p className="admin-muted sm">
                Agrupa piezas para swipe decks o sets. Crea desde la pestaña “Todas” seleccionando
                imágenes, o edita aquí.
              </p>
            </div>
            <div className="admin-artist-grid">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`admin-card clickable ${activeGroup?.id === g.id ? 'ring' : ''}`}
                  onClick={() => void openGroup(g.id)}
                >
                  <h2>{g.name}</h2>
                  <p className="admin-muted sm">
                    {g.kind} · {g.item_count ?? 0} piezas · {artistLabel(g.artist_id)}
                  </p>
                </button>
              ))}
              {!groups.length && <p className="admin-muted">Aún no hay carruseles.</p>}
            </div>
          </div>

          {activeGroup && (
            <aside className="admin-form panel editor sticky-editor">
              <h2 style={{ margin: 0 }}>{activeGroup.name}</h2>
              <p className="admin-muted sm">
                {activeGroup.kind} · slug {activeGroup.slug || '—'}
              </p>
              <label>
                Nombre
                <input
                  value={activeGroup.name}
                  onChange={(e) => setActiveGroup({ ...activeGroup, name: e.target.value })}
                  onBlur={() =>
                    void api.updateGroup(activeGroup.id, { name: activeGroup.name }).then((r) => {
                      setActiveGroup(r.group);
                      return api.listGroups().then((g) => setGroups(g.groups));
                    })
                  }
                />
              </label>
              <label>
                Descripción
                <textarea
                  rows={2}
                  value={activeGroup.description ?? ''}
                  onChange={(e) =>
                    setActiveGroup({ ...activeGroup, description: e.target.value })
                  }
                  onBlur={() =>
                    void api
                      .updateGroup(activeGroup.id, { description: activeGroup.description })
                      .then((r) => setActiveGroup(r.group))
                  }
                />
              </label>
              {canManage && (
                <label>
                  Artista del grupo
                  <select
                    value={activeGroup.artist_id ?? ''}
                    onChange={(e) => {
                      const artist_id = e.target.value || null;
                      void api.updateGroup(activeGroup.id, { artist_id }).then((r) => {
                        setActiveGroup(r.group);
                        return api.listGroups().then((g) => setGroups(g.groups));
                      });
                    }}
                  >
                    <option value="">Estudio</option>
                    {artists.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.handle}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="admin-media-grid dense">
                {(activeGroup.items || []).map((m) => (
                  <div key={m.id} className="admin-media-card">
                    <img src={mediaUrl(m)} alt="" loading="lazy" />
                    <button
                      type="button"
                      className="admin-btn danger sm"
                      style={{ margin: '0.25rem' }}
                      onClick={() => void removeFromGroup(m.id)}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              <p className="admin-muted sm">
                Para añadir más: ve a “Todas”, selecciona y usa “Añadir a…” (abre este grupo
                primero).
              </p>
              <button type="button" className="admin-btn danger sm" onClick={() => void deleteGroup()}>
                Eliminar carrusel
              </button>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
