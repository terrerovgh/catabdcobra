import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type NavTarget = 'users' | 'artists' | 'gallery';

export function Dashboard({ onNavigate }: { onNavigate?: (id: NavTarget) => void }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<{
    users: number;
    artists: number;
    media: { total: number; in_gallery: number; in_profile: number };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .stats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'));
  }, []);

  const canUsers = user?.role === 'system_admin' || user?.role === 'owner';

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Inicio</h1>
        <p className="admin-muted">
          Sesión: <strong>{user?.email}</strong> · rol <strong>{user?.role}</strong>
        </p>
      </header>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-cards">
        {canUsers && (
          <button type="button" className="admin-card clickable" onClick={() => onNavigate?.('users')}>
            <h2>Usuarios</h2>
            <p className="stat-num">{stats ? stats.users : '—'}</p>
            <p className="admin-muted sm">Allowlist OTP y roles</p>
          </button>
        )}
        <button type="button" className="admin-card clickable" onClick={() => onNavigate?.('artists')}>
          <h2>Artistas</h2>
          <p className="stat-num">{stats ? stats.artists : '—'}</p>
          <p className="admin-muted sm">Activos en el roster</p>
        </button>
        <button type="button" className="admin-card clickable" onClick={() => onNavigate?.('gallery')}>
          <h2>Galería</h2>
          <p className="stat-num">{stats ? stats.media.total : '—'}</p>
          <p className="admin-muted sm">
            {stats
              ? `${stats.media.in_gallery} en galería · ${stats.media.in_profile} en perfil`
              : 'Medios en R2'}
          </p>
        </button>
      </div>

      <div className="admin-cards" style={{ marginTop: '1rem' }}>
        <div className="admin-card">
          <h2>Fase 1 lista</h2>
          <ul>
            <li>Login por código al correo</li>
            <li>Roles: system_admin, owner, artist</li>
            <li>Usuarios, artistas y galería</li>
            <li>Metadatos con ayuda de IA en el navegador</li>
          </ul>
        </div>
        <div className="admin-card">
          <h2>Próximas fases</h2>
          <ul>
            <li>Clientes y bookings</li>
            <li>Flash, promos, invitados</li>
            <li>Blog, aftercare, marketplace</li>
            <li>Pagos, visitas, redes, campañas</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
