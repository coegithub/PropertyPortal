import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';
import { CommunityCard, PropertyCard, UnitCard } from '../components/Cards.jsx';
import LoadState from '../components/LoadState.jsx';

const TABS = [['all', 'All'], ['communities', 'Communities'], ['properties', 'Properties'], ['units', 'Units']];
const has = (text, term) => text.toLowerCase().includes(term);

export default function Home() {
  const { communities, properties, units, status, maps } = useStore();
  const [params, setParams] = useSearchParams();

  const q = params.get('q') || '';
  const tab = params.get('tab') || 'all';
  const city = params.get('city') || '';
  const ptype = params.get('type') || '';
  const beds = params.get('beds') || '';
  const maxPrice = Number(params.get('max')) || 0;
  const availableOnly = params.get('avail') === '1';

  const update = (key, val) => {
    const next = new URLSearchParams(params);
    if (!val) next.delete(key);
    else next.set(key, val);
    setParams(next, { replace: true });
  };

  const cities = useMemo(() => [...new Set(communities.map((c) => c.city))].sort(), [communities]);
  const types = useMemo(() => [...new Set(properties.map((p) => p.type))].sort(), [properties]);

  const unitFilters = Boolean(beds || maxPrice || availableOnly);
  const term = q.trim().toLowerCase();

  const result = useMemo(() => {
    const comm = (id) => maps.community.get(id);
    const prop = (id) => maps.property.get(id);

    const unitOk = (u) => {
      const p = prop(u.propertyId);
      const c = comm(p.communityId);
      if (city && c.city !== city) return false;
      if (ptype && p.type !== ptype) return false;
      if (beds && u.bedrooms !== Number(beds)) return false;
      if (maxPrice && u.price > maxPrice) return false;
      if (availableOnly && u.status !== 'Available') return false;
      return true;
    };
    const okUnits = units.filter(unitOk);
    const unitsOf = new Map();
    for (const u of okUnits) unitsOf.set(u.propertyId, [...(unitsOf.get(u.propertyId) || []), u]);

    const unitText = (u) => {
      const p = prop(u.propertyId);
      const c = comm(p.communityId);
      return `${u.unitNo} ${u.view} ${u.bedrooms === 0 ? 'studio' : u.bedrooms + ' bedroom'} ${p.name} ${p.type} ${c.name} ${c.city}`;
    };
    const propText = (p) => `${p.name} ${p.type} ${p.description} ${p.handover} ${comm(p.communityId).name} ${comm(p.communityId).city}`;
    const commText = (c) => `${c.name} ${c.city} ${c.description}`;

    const matchedUnits = okUnits.filter((u) => !term || has(unitText(u), term));
    const matchedProps = properties.filter((p) => {
      const c = comm(p.communityId);
      if (city && c.city !== city) return false;
      if (ptype && p.type !== ptype) return false;
      if (unitFilters && !unitsOf.has(p.id)) return false;
      return !term || has(propText(p), term);
    });
    const matchedComms = communities.filter((c) => {
      if (city && c.city !== city) return false;
      const props = properties.filter((p) => p.communityId === c.id && (!ptype || p.type === ptype));
      if ((ptype || unitFilters) && !props.some((p) => (unitFilters ? unitsOf.has(p.id) : true))) return false;
      return !term || has(commText(c), term);
    });
    return { matchedUnits, matchedProps, matchedComms };
  }, [communities, properties, units, maps, term, city, ptype, beds, maxPrice, availableOnly, unitFilters]);

  const allUnits = (pred) => units.filter(pred);
  const show = (t) => tab === 'all' || tab === t;
  const total =
    (show('communities') ? result.matchedComms.length : 0) +
    (show('properties') ? result.matchedProps.length : 0) +
    (show('units') ? result.matchedUnits.length : 0);

  return (
    <>
      <section className="hero">
        <h1>Find your next home</h1>
        <p>Search communities, properties and units, then register your expression of interest in a few clicks.</p>
      </section>

      <div className="toolbar">
        <input type="search" placeholder="Search by name, city, unit number, view…" value={q}
          onChange={(e) => update('q', e.target.value)} className="input search" />
      </div>
      <div className="toolbar">
        <select className="input" value={city} onChange={(e) => update('city', e.target.value)} aria-label="City">
          <option value="">Any city</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="input" value={ptype} onChange={(e) => update('type', e.target.value)} aria-label="Property type">
          <option value="">Any property type</option>
          {types.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select className="input" value={beds} onChange={(e) => update('beds', e.target.value)} aria-label="Bedrooms">
          <option value="">Any bedrooms</option>
          <option value="0">Studio</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} bedroom{n > 1 && 's'}</option>)}
        </select>
        <select className="input" value={maxPrice || ''} onChange={(e) => update('max', e.target.value)} aria-label="Maximum price">
          <option value="">Any price</option>
          {[1000000, 2000000, 3000000, 5000000, 10000000].map((n) => (
            <option key={n} value={n}>Up to AED {n / 1000000}M</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={availableOnly} onChange={(e) => update('avail', e.target.checked ? '1' : '')} />
          Available units only
        </label>
      </div>

      <div className="chips">
        {TABS.map(([key, label]) => (
          <button key={key} className={`chip ${tab === key ? 'active' : ''}`}
            onClick={() => update('tab', key === 'all' ? '' : key)}>{label}</button>
        ))}
      </div>

      {status !== 'ready' ? (
        <LoadState />
      ) : total === 0 ? (
        <div className="empty">
          <h3>Nothing matches your search</h3>
          <button className="btn ghost" onClick={() => setParams({})}>Clear filters</button>
        </div>
      ) : (
        <>
          <p className="muted small">{total} result{total !== 1 && 's'}</p>
          {show('communities') && result.matchedComms.length > 0 && (
            <>
              <h2>Communities</h2>
              <div className="grid">
                {result.matchedComms.map((c) => (
                  <CommunityCard key={c.id} community={c}
                    properties={properties.filter((p) => p.communityId === c.id)}
                    units={allUnits((u) => maps.property.get(u.propertyId).communityId === c.id)} />
                ))}
              </div>
            </>
          )}
          {show('properties') && result.matchedProps.length > 0 && (
            <>
              <h2>Properties</h2>
              <div className="grid">
                {result.matchedProps.map((p) => (
                  <PropertyCard key={p.id} property={p} community={maps.community.get(p.communityId)}
                    units={allUnits((u) => u.propertyId === p.id)} />
                ))}
              </div>
            </>
          )}
          {show('units') && result.matchedUnits.length > 0 && (
            <>
              <h2>Units</h2>
              <div className="grid">
                {result.matchedUnits.map((u) => {
                  const p = maps.property.get(u.propertyId);
                  return <UnitCard key={u.id} unit={u} property={p} community={maps.community.get(p.communityId)} />;
                })}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
