import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useStore } from '../context/StoreContext.jsx';
import LoadState from '../components/LoadState.jsx';
import { createEoi } from '../services/api.js';
import { money, sqft, bedLabel } from '../utils/format.js';

// Describes the selection from the catalog (display only: the server re-reads everything on submit).
function describe(type, id, maps) {
  if (type === 'community') {
    const c = maps.community.get(id);
    return c && { title: c.name, sub: `Community · ${c.city}`, emoji: c.emoji, color: c.color };
  }
  if (type === 'property') {
    const p = maps.property.get(id);
    const c = p && maps.community.get(p.communityId);
    return p && { title: p.name, sub: `${p.type} · ${c.name}, ${c.city}`, emoji: p.emoji, color: p.color };
  }
  const u = maps.unit.get(id);
  const p = u && maps.property.get(u.propertyId);
  const c = p && maps.community.get(p.communityId);
  return u && {
    title: `${p.name} · Unit ${u.unitNo}`,
    sub: `${bedLabel(u.bedrooms)} ${p.type.toLowerCase()} · ${sqft(u.areaSqft)} · ${c.name}`,
    price: u.price, sold: u.status === 'Sold', emoji: p.emoji, color: p.color,
  };
}

export default function EoiForm() {
  const [params] = useSearchParams();
  const type = params.get('type');
  const id = params.get('id');
  const { user } = useAuth();
  const { status, maps, notify, refreshCatalog } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: user?.name || '', email: user?.email || '', phone: '', budget: '', notes: '', consent: false });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status !== 'ready') return <LoadState />;
  const target = ['community', 'property', 'unit'].includes(type) ? describe(type, id, maps) : null;
  if (!target)
    return (
      <div className="empty">
        <h2>Choose what you're interested in</h2>
        <p className="muted">Pick a community, property or unit first.</p>
        <Link to="/" className="btn">Search properties</Link>
      </div>
    );

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const eoi = await createEoi({
        targetType: type,
        targetId: id,
        buyer: { fullName: form.fullName, email: form.email, phone: form.phone },
        budget: form.budget === '' ? null : Number(form.budget),
        notes: form.notes,
        consent: form.consent,
      });
      notify('EOI submitted');
      navigate(`/eois/${eoi.id}`, { replace: true, state: { created: true } });
    } catch (err) {
      setError(err.message);
      refreshCatalog(); // availability may have changed
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1>Submit your EOI</h1>
      <form className="two-col" onSubmit={submit}>
        <div className="panel">
          <h3>Your details</h3>
          <label className="field">Full name
            <input className="input" required maxLength={120} value={form.fullName} onChange={set('fullName')} autoComplete="name" />
          </label>
          <div className="field-row">
            <label className="field">Email
              <input className="input" type="email" required maxLength={200} value={form.email} onChange={set('email')} autoComplete="email" />
            </label>
            <label className="field">Phone
              <input className="input" type="tel" required maxLength={40} value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="+971 50 123 4567" />
            </label>
          </div>
          <label className="field">Budget (AED, optional)
            <input className="input" type="number" min="1" step="1000" value={form.budget} onChange={set('budget')} />
          </label>
          <label className="field">Notes (optional)
            <textarea className="input" rows={4} maxLength={1000} value={form.notes} onChange={set('notes')}
              placeholder="Preferred floor, payment plan, viewing times…" />
          </label>
          <label className="check">
            <input type="checkbox" checked={form.consent} onChange={set('consent')} required />
            I understand this EOI is non-binding and agree to be contacted about it.
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
        </div>

        <aside className="summary">
          <h3>Your selection</h3>
          <div className="line-thumb" style={{ background: target.color }}>{target.emoji}</div>
          <strong>{target.title}</strong>
          <span className="muted small">{target.sub}</span>
          {target.price != null && <div className="row total"><span>List price</span><span>{money(target.price)}</span></div>}
          {target.sold && <p className="alert">This unit has been sold.</p>}
          <button className="btn full" disabled={submitting || target.sold}>{submitting ? 'Submitting…' : 'Submit EOI'}</button>
          <Link to="/" className="btn ghost full">Cancel</Link>
        </aside>
      </form>
    </>
  );
}
