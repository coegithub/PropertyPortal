import { useStore } from '../context/StoreContext.jsx';

// Shows a loading or error message while the catalog loads. Returns null once it is ready.
export default function LoadState() {
  const { status, refreshCatalog } = useStore();
  if (status === 'loading') return <p className="muted">Loading…</p>;
  if (status === 'error')
    return (
      <div className="empty">
        <h3>Couldn't load the properties</h3>
        <p className="muted">The server may be down. Please try again.</p>
        <button className="btn" onClick={refreshCatalog}>Retry</button>
      </div>
    );
  return null;
}
