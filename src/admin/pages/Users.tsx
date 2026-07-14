import { useEffect, useState, type FormEvent } from 'react';
import { api, type Artist, type Role, type User } from '../lib/api';
import { useAuth } from '../lib/auth';

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [form, setForm] = useState({
    email: '',
    name: '',
    role: 'artist' as Role,
    artist_id: '',
  });

  const canManage = me?.role === 'system_admin' || me?.role === 'owner';

  async function load() {
    try {
      const [u, a] = await Promise.all([api.listUsers(), api.listArtists()]);
      setUsers(u.users);
      setArtists(a.artists);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    try {
      await api.createUser({
        email: form.email,
        name: form.name || undefined,
        role: form.role,
        artist_id:
          form.role === 'artist' || form.role === 'owner' ? form.artist_id || null : null,
      });
      setShowForm(false);
      setForm({ email: '', name: '', role: 'artist', artist_id: '' });
      setOkMsg('Usuario creado. Ya puede pedir código OTP con ese correo.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear');
    }
  }

  async function toggleActive(u: User) {
    setOkMsg(null);
    try {
      await api.updateUser(u.id, { active: !u.active });
      setOkMsg(u.active ? 'Usuario desactivado' : 'Usuario activado');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  }

  async function saveName(id: string) {
    setOkMsg(null);
    try {
      await api.updateUser(id, { name: editName });
      setEditingId(null);
      setOkMsg('Nombre actualizado');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-header row">
        <div>
          <h1>Usuarios</h1>
          <p className="admin-muted">
            Solo correos en esta lista pueden recibir el código de login.
          </p>
        </div>
        {canManage && (
          <button type="button" className="admin-btn primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancelar' : 'Invitar usuario'}
          </button>
        )}
      </header>

      {error && <p className="admin-error">{error}</p>}
      {okMsg && <p className="admin-ok">{okMsg}</p>}

      {showForm && canManage && (
        <form className="admin-form panel" onSubmit={onCreate}>
          <label>
            Correo
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            Rol
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            >
              {me?.role === 'system_admin' && <option value="system_admin">system_admin</option>}
              {me?.role === 'system_admin' && <option value="owner">owner</option>}
              <option value="artist">artist</option>
            </select>
          </label>
          {(form.role === 'artist' || form.role === 'owner') && (
            <label>
              Artista vinculado
              <select
                value={form.artist_id}
                onChange={(e) => setForm((f) => ({ ...f, artist_id: e.target.value }))}
                required={form.role === 'artist'}
              >
                <option value="">—</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.handle}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" className="admin-btn primary">
            Crear
          </button>
        </form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Correo</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Artista</th>
              <th>Activo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  {editingId === u.id ? (
                    <span className="admin-row" style={{ flexWrap: 'nowrap' }}>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ minWidth: 120 }}
                      />
                      <button type="button" className="admin-btn primary sm" onClick={() => saveName(u.id)}>
                        OK
                      </button>
                    </span>
                  ) : (
                    u.name || '—'
                  )}
                </td>
                <td>
                  <span className="admin-badge">{u.role}</span>
                </td>
                <td>{u.artist_id || '—'}</td>
                <td>{u.active ? 'sí' : 'no'}</td>
                <td>
                  <span className="admin-row" style={{ gap: '0.35rem' }}>
                    {(canManage || me?.id === u.id) && (
                      <button
                        type="button"
                        className="admin-btn ghost sm"
                        onClick={() => {
                          setEditingId(u.id);
                          setEditName(u.name || '');
                        }}
                      >
                        Nombre
                      </button>
                    )}
                    {canManage && (
                      <button type="button" className="admin-btn ghost sm" onClick={() => toggleActive(u)}>
                        {u.active ? 'Desactivar' : 'Activar'}
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
