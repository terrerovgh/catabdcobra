import { useEffect, useState, type FormEvent } from 'react';
import { api, type Artist } from '../lib/api';
import { useAuth } from '../lib/auth';

const STYLE_OPTIONS = [
  'horror',
  'anime',
  'neo-traditional',
  'fantasy',
  'pop-culture',
  'black-gray',
  'realism',
];

const emptyForm = {
  id: '',
  handle: '',
  studio_role: 'resident' as Artist['studio_role'],
  styles: [] as string[],
  bio_en: '',
  bio_es: '',
  instagram: '',
  mood: 'cat',
  accent: '#d98565',
};

export function ArtistsPage() {
  const { user: me } = useAuth();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const canCreate = me?.role === 'system_admin' || me?.role === 'owner';

  async function load() {
    try {
      const { artists: list } = await api.listArtists();
      setArtists(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startEdit(a: Artist) {
    setCreating(false);
    setEditing(a.id);
    setForm({
      id: a.id,
      handle: a.handle,
      studio_role: a.studio_role,
      styles: a.styles ?? [],
      bio_en: a.bio_en ?? '',
      bio_es: a.bio_es ?? '',
      instagram: a.instagram ?? '',
      mood: a.mood,
      accent: a.accent,
    });
  }

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    try {
      if (creating) {
        await api.createArtist({
          id: form.id || undefined,
          handle: form.handle,
          studio_role: form.studio_role,
          styles: form.styles,
          bio_en: form.bio_en,
          bio_es: form.bio_es,
          instagram: form.instagram,
          mood: form.mood,
          accent: form.accent,
        });
        setOkMsg('Artista creado');
      } else if (editing) {
        await api.updateArtist(editing, {
          handle: form.handle,
          studio_role: form.studio_role,
          styles: form.styles,
          bio_en: form.bio_en,
          bio_es: form.bio_es,
          instagram: form.instagram,
          mood: form.mood,
          accent: form.accent,
        });
        setOkMsg('Artista actualizado');
      }
      setCreating(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  function toggleStyle(s: string) {
    setForm((f) => ({
      ...f,
      styles: f.styles.includes(s) ? f.styles.filter((x) => x !== s) : [...f.styles, s],
    }));
  }

  const showForm = creating || editing;

  return (
    <div className="admin-page">
      <header className="admin-page-header row">
        <div>
          <h1>Artistas</h1>
          <p className="admin-muted">Roster del estudio, bios y acentos de perfil.</p>
        </div>
        {canCreate && (
          <button type="button" className="admin-btn primary" onClick={startCreate}>
            Añadir artista
          </button>
        )}
      </header>

      {error && <p className="admin-error">{error}</p>}
      {okMsg && <p className="admin-ok">{okMsg}</p>}

      {showForm && (
        <form className="admin-form panel" onSubmit={onSave}>
          {creating && (
            <label>
              Id (slug)
              <input
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                placeholder="auto desde el handle si vacío"
              />
            </label>
          )}
          <label>
            Handle
            <input
              required
              value={form.handle}
              onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
            />
          </label>
          <label>
            Rol en el estudio
            <select
              value={form.studio_role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  studio_role: e.target.value as Artist['studio_role'],
                }))
              }
              disabled={me?.role === 'artist'}
            >
              <option value="owner">owner</option>
              <option value="resident">resident</option>
              <option value="guest">guest</option>
            </select>
          </label>
          <fieldset className="admin-check-grid">
            <legend>Estilos</legend>
            {STYLE_OPTIONS.map((s) => (
              <label key={s} className="check">
                <input
                  type="checkbox"
                  checked={form.styles.includes(s)}
                  onChange={() => toggleStyle(s)}
                />
                {s}
              </label>
            ))}
          </fieldset>
          <label>
            Bio (EN)
            <textarea
              rows={3}
              value={form.bio_en}
              onChange={(e) => setForm((f) => ({ ...f, bio_en: e.target.value }))}
            />
          </label>
          <label>
            Bio (ES)
            <textarea
              rows={3}
              value={form.bio_es}
              onChange={(e) => setForm((f) => ({ ...f, bio_es: e.target.value }))}
            />
          </label>
          <label>
            Instagram
            <input
              value={form.instagram}
              onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
            />
          </label>
          <div className="admin-row">
            <label>
              Mood
              <select
                value={form.mood}
                onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value }))}
              >
                <option value="cat">cat</option>
                <option value="cobra">cobra</option>
              </select>
            </label>
            <label>
              Acento
              <input
                type="color"
                value={form.accent}
                onChange={(e) => setForm((f) => ({ ...f, accent: e.target.value }))}
              />
            </label>
          </div>
          <div className="admin-row">
            <button type="submit" className="admin-btn primary">
              Guardar
            </button>
            <button
              type="button"
              className="admin-btn ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="admin-artist-grid">
        {artists.map((a) => {
          const canEdit =
            me?.role === 'system_admin' ||
            me?.role === 'owner' ||
            (me?.role === 'artist' && me.artist_id === a.id);
          return (
            <article key={a.id} className="admin-card artist-card">
              <div className="swatch" style={{ background: a.accent }} />
              <h2>{a.handle}</h2>
              <p className="admin-muted">
                {a.id} · {a.studio_role} · {a.mood}
              </p>
              <p className="tags">{(a.styles ?? []).join(' · ')}</p>
              <p className="bio">{a.bio_es || a.bio_en}</p>
              {canEdit && (
                <button type="button" className="admin-btn ghost sm" onClick={() => startEdit(a)}>
                  Editar
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
