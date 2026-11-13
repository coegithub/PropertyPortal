import { Link, useParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';
import LoadState from '../components/LoadState.jsx';
import { PropertyCard, priceFrom } from '../components/Cards.jsx';
import { money } from '../utils/format.js';

export default function CommunityDetail() {
  const { id } = useParams();
  const { status, maps, properties, units } = useStore();
  if (status !== 'ready') return <LoadState />;
  const c = maps.community.get(id);
  if (!c)
    return (
      <div className="empty"><h2>Community not found</h2><Link to="/" className="btn">Back to search</Link></div>
    );
  const props = properties.filter((p) => p.communityId === c.id);
  const cUnits = units.filter((u) => props.some((p) => p.id === u.propertyId));
  const from = priceFrom(cUnits);

  return (
    <>
      <Link to="/" className="back">← Back to search</Link>
      <div className="detail">
        <div className="detail-img" style={{ background: c.color }}>{c.emoji}</div>
        <div className="detail-info">
          <span className="tag">Community</span>
          <h1>{c.name}</h1>
          <p className="muted">{c.city}</p>
          <p>{c.description}</p>
          <p className="muted">{props.length} properties · {cUnits.filter((u) => u.status === 'Available').length} units available</p>
          <div className="price big">{from ? `From ${money(from)}` : 'Sold out'}</div>
          <Link to={`/eoi/new?type=community&id=${c.id}`} className="btn">Submit EOI for this community</Link>
        </div>
      </div>
      <h2>Properties in {c.name}</h2>
      <div className="grid">
        {props.map((p) => (
          <PropertyCard key={p.id} property={p} community={c} units={units.filter((u) => u.propertyId === p.id)} />
        ))}
      </div>
    </>
  );
}
