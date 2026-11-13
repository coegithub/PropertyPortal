import { Link, useParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';
import LoadState from '../components/LoadState.jsx';
import { StatusPill } from '../components/Cards.jsx';
import { money, sqft, bedLabel } from '../utils/format.js';

export default function UnitDetail() {
  const { id } = useParams();
  const { status, maps } = useStore();
  if (status !== 'ready') return <LoadState />;
  const u = maps.unit.get(id);
  if (!u)
    return (
      <div className="empty"><h2>Unit not found</h2><Link to="/" className="btn">Back to search</Link></div>
    );
  const p = maps.property.get(u.propertyId);
  const c = maps.community.get(p.communityId);

  return (
    <>
      <Link to={`/property/${p.id}`} className="back">← {p.name}</Link>
      <div className="detail">
        <div className="detail-img" style={{ background: p.color }}>{p.emoji}</div>
        <div className="detail-info">
          <span className="tag">Unit {u.unitNo}</span>
          <h1>{bedLabel(u.bedrooms)} {p.type.toLowerCase()}</h1>
          <p className="muted">{p.name} · {c.name}, {c.city}</p>
          <StatusPill status={u.status} />
          <div className="price big">{money(u.price)}</div>
          <ul className="facts">
            <li><span>Bedrooms</span><strong>{u.bedrooms === 0 ? 'Studio' : u.bedrooms}</strong></li>
            <li><span>Bathrooms</span><strong>{u.bathrooms}</strong></li>
            <li><span>Area</span><strong>{sqft(u.areaSqft)}</strong></li>
            <li><span>Floor</span><strong>{u.floor}</strong></li>
            <li><span>View</span><strong>{u.view}</strong></li>
            <li><span>Handover</span><strong>{p.handover}</strong></li>
          </ul>
          {u.status === 'Sold' ? (
            <p className="muted">This unit has been sold. Browse other units in <Link to={`/property/${p.id}`}><u>{p.name}</u></Link>.</p>
          ) : (
            <Link to={`/eoi/new?type=unit&id=${u.id}`} className="btn">Submit EOI for this unit</Link>
          )}
        </div>
      </div>
    </>
  );
}
