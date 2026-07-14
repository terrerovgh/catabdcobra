export function Placeholder({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>{title}</h1>
        <p className="admin-muted">{blurb}</p>
      </header>
      <div className="admin-placeholder">
        <span className="admin-badge">Próximamente</span>
        <p>
          Esta sección está prevista para una fase posterior. La navegación ya está preparada para no
          rediseñar el panel después.
        </p>
      </div>
    </div>
  );
}
