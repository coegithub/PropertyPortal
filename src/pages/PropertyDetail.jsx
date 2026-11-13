import { Link, useParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';
import LoadState from '../components/LoadState.jsx';
import { StatusPill, priceFrom } from '../components/Cards.jsx';
import { money, sqft, bedLabel } from '../utils/format.js';

export default function PropertyDetail() {
  const { id } = useParams();
  const { status, maps, units } = useStore();
  if (status !== 'ready') return <LoadState />;
  const p = maps.property.get(id);
  if (!p)
    return (
      <div className="empty"><h2>Property not found</h2><Link to="/" className="btn">Back to search</Link></div>
    );
  const c = maps.community.get(p.communityId);
  const pUnits = units.filter((u) => u.propertyId === p.id);
  const from = priceFrom(pUnits);

  return (
    <>
      <Link to={`/community/${c.id}`} className="back">← {c.name}</Link>
      <div className="detail">
        <div className="detail-img" style={{ background: p.color }}>{p.emoji}</div>
        <div className="detail-info">
          <span className="tag">{p.type}</span>
          <h1>{p.name}</h1>
          <p className="muted">{c.name}, {c.city} · Handover {p.handover}</p>
          <p>{p.description}</p>
          <div className="price big">{from ? `From ${money(from)}` : 'Sold out'}</div>
          <Link to={`/eoi/new?type=property&id=${p.id}`} className="btn">Submit EOI for this property</Link>
        </div>
      </div>
      <h2>Units</h2>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Unit</th><th>Layout</th><th>Area</th><th>Floor</th><th>View</th><th>Price</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {pUnits.map((u) => (
              <tr key={u.id}>
                <td><Link to={`/unit/${u.id}`}><strong>{u.unitNo}</strong></Link></td>
                <td>{bedLabel(u.bedrooms)} · {u.bathrooms} bath</td>
                <td>{sqft(u.areaSqft)}</td>
                <td>{u.floor}</td>
                <td>{u.view}</td>
                <td>{money(u.price)}</td>
                <td><StatusPill status={u.status} /></td>
                <td>
                  {u.status !== 'Sold' && <Link to={`/eoi/new?type=unit&id=${u.id}`} className="btn small-btn">Submit EOI</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
