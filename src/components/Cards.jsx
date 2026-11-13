import { Link } from 'react-router-dom';
import { money, sqft, bedLabel } from '../utils/format.js';

const Card = ({ to, color, emoji, tag, title, sub, children, footer }) => (
  <div className="card">
    <Link to={to} className="card-link">
      <div className="thumb" style={{ background: color }}>{emoji}</div>
      <div className="card-body">
        <span className="tag">{tag}</span>
        <h3>{title}</h3>
        <span className="muted small">{sub}</span>
        {children}
      </div>
    </Link>
    <div className="card-actions">{footer}</div>
  </div>
);

export const StatusPill = ({ status }) => <span className={`status s-${status.toLowerCase()}`}>{status}</span>;

export const priceFrom = (units) => {
  const open = units.filter((u) => u.status !== 'Sold');
  return open.length ? Math.min(...open.map((u) => u.price)) : null;
};

export function CommunityCard({ community: c, properties, units }) {
  const from = priceFrom(units);
  return (
    <Card to={`/community/${c.id}`} color={c.color} emoji={c.emoji} tag="Community" title={c.name} sub={c.city}
      footer={<span className="price">{from ? `From ${money(from)}` : 'Sold out'}<span className="muted small"> · {properties.length} properties</span></span>}>
      <p className="clamp">{c.description}</p>
    </Card>
  );
}

export function PropertyCard({ property: p, community, units }) {
  const from = priceFrom(units);
  const open = units.filter((u) => u.status === 'Available').length;
  return (
    <Card to={`/property/${p.id}`} color={p.color} emoji={p.emoji} tag={p.type} title={p.name}
      sub={`${community?.name}, ${community?.city} · Handover ${p.handover}`}
      footer={<span className="price">{from ? `From ${money(from)}` : 'Sold out'}<span className="muted small"> · {open} available</span></span>}>
      <p className="clamp">{p.description}</p>
    </Card>
  );
}

export function UnitCard({ unit: u, property, community }) {
  return (
    <Card to={`/unit/${u.id}`} color={property?.color} emoji={property?.emoji} tag={`Unit ${u.unitNo}`}
      title={`${bedLabel(u.bedrooms)} ${property?.type.toLowerCase()}`}
      sub={`${property?.name}, ${community?.name}`}
      footer={<span className="price">{money(u.price)} <StatusPill status={u.status} /></span>}>
      <span className="muted small">{sqft(u.areaSqft)} · Floor {u.floor} · {u.view} view</span>
    </Card>
  );
}
