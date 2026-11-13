import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEois } from '../services/api.js';
import { money } from '../utils/format.js';

export const EoiStatus = ({ status }) => <span className={`status s-${status.toLowerCase()}`}>{status}</span>;
export const TYPE_LABEL = { community: 'Community', property: 'Property', unit: 'Unit' };

export default function Eois() {
  const [eois, setEois] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    getEois().then(setEois).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error)
    return (
      <div className="empty">
        <h3>Couldn't load your EOIs</h3>
        <p className="muted">{error}</p>
        <button className="btn" onClick={load}>Retry</button>
      </div>
    );
  if (!eois) return <p className="muted">Loading EOIs…</p>;

  if (eois.length === 0)
    return (
      <div className="empty">
        <div className="big-emoji">📝</div>
        <h2>No EOIs yet</h2>
        <p className="muted">Find a community, property or unit you like and submit your first EOI.</p>
        <Link to="/" className="btn">Search properties</Link>
      </div>
    );

  return (
    <>
      <h1>My EOIs</h1>
      <div className="list">
        {eois.map((e) => (
          <Link to={`/eois/${e.id}`} key={e.id} className="order-row">
            <div>
              <strong>{e.targetName}</strong>
              <div className="muted small">{TYPE_LABEL[e.targetType]} · {e.id} · {new Date(e.date).toLocaleDateString()}</div>
            </div>
            <EoiStatus status={e.status} />
            <strong>{e.targetPrice != null ? money(e.targetPrice) : e.budget != null ? `Budget ${money(e.budget)}` : '—'}</strong>
          </Link>
        ))}
      </div>
    </>
  );
}
