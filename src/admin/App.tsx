import { useMemo, useState, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { ArtistsPage } from './pages/Artists';
import { GalleryPage } from './pages/Gallery';
import { Placeholder } from './pages/Placeholder';
import type { Role } from './lib/api';

type NavId =
  | 'dashboard'
  | 'users'
  | 'artists'
  | 'gallery'
  | 'clients'
  | 'bookings'
  | 'promotions'
  | 'flash'
  | 'guests'
  | 'blog'
  | 'aftercare'
  | 'marketplace'
  | 'payments'
  | 'analytics'
  | 'social'
  | 'campaigns';

interface NavItem {
  id: NavId;
  label: string;
  phase: 1 | 2 | 3 | 4 | 5;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Inicio', phase: 1 },
  { id: 'users', label: 'Usuarios', phase: 1 },
  { id: 'artists', label: 'Artistas', phase: 1 },
  { id: 'gallery', label: 'Galería', phase: 1 },
  { id: 'clients', label: 'Clientes', phase: 2 },
  { id: 'bookings', label: 'Bookings', phase: 2 },
  { id: 'promotions', label: 'Promociones', phase: 3 },
  { id: 'flash', label: 'Flash tattoos', phase: 2 },
  { id: 'guests', label: 'Artistas invitados', phase: 2 },
  { id: 'blog', label: 'Blog', phase: 3 },
  { id: 'aftercare', label: 'Aftercare', phase: 3 },
  { id: 'marketplace', label: 'Marketplace', phase: 4 },
  { id: 'payments', label: 'Pagos', phase: 4, roles: ['system_admin'] },
  { id: 'analytics', label: 'Visitas', phase: 5 },
  { id: 'social', label: 'Redes sociales', phase: 5 },
  { id: 'campaigns', label: 'Campañas', phase: 5 },
];

function canSee(item: NavItem, role: Role | undefined): boolean {
  if (!role) return false;
  if (role === 'system_admin') return true;
  if (item.roles && !item.roles.includes(role)) return false;
  return true;
}

function Shell() {
  const { user, loading, logout } = useAuth();
  const [nav, setNav] = useState<NavId>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);

  const items = useMemo(() => NAV.filter((n) => canSee(n, user?.role)), [user?.role]);

  if (loading) {
    return (
      <div className="admin-login">
        <p className="admin-muted">Cargando…</p>
      </div>
    );
  }

  if (!user) return <Login />;

  let body: ReactNode;
  switch (nav) {
    case 'dashboard':
      body = <Dashboard onNavigate={setNav} />;
      break;
    case 'users':
      body = <UsersPage />;
      break;
    case 'artists':
      body = <ArtistsPage />;
      break;
    case 'gallery':
      body = <GalleryPage />;
      break;
    default: {
      const item = NAV.find((n) => n.id === nav)!;
      body = (
        <Placeholder
          title={item.label}
          blurb={`Módulo de la fase ${item.phase}. El menú ya está listo; la funcionalidad llega en siguientes fases.`}
        />
      );
    }
  }

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="admin-brand">
          <strong>Cat &amp; Cobra</strong>
          <span>Administración</span>
        </div>
        <nav>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={nav === item.id ? 'active' : ''}
              onClick={() => {
                setNav(item.id);
                setMenuOpen(false);
              }}
            >
              {item.label}
              {item.phase > 1 && <em>pronto</em>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <p className="admin-muted sm">{user.email}</p>
          <button type="button" className="admin-btn ghost sm" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-btn ghost sm menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
          >
            Menú
          </button>
          <span className="admin-muted sm">{user.role}</span>
        </header>
        <main className="admin-content">{body}</main>
      </div>
      {menuOpen && (
        <button
          type="button"
          className="admin-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
