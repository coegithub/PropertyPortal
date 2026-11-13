import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getEoi, withdrawEoi } from '../services/api.js';
import { money } from '../utils/format.js';
import { EoiStatus, TYPE_LABEL } from './Eois.jsx';

export default function EoiDetail() {
  const { id } = useParams();
  const created = useLocation().state?.created;
  const [eoi, setEoi] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEoi(null);
    setError('');
    getEoi(id).then((e) => !cancelled && setEoi(e)).catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id]);

  async function withdraw() {
    if (!window.confirm('Withdraw this EOI?')) return;
    setBusy(true);
    setError('');
    try {
      setEoi(await withdrawEoi(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !eoi)
    return (
      <div className="empty">
        <h2>EOI not found</h2>
        <p className="muted">{error}</p>
        <Link to="/eois" className="btn">Back to my EOIs</Link>
      </div>
    );
  if (!eoi) return <p className="muted">Loading…</p>;

  const link = { community: `/community/${eoi.communityId}`, property: `/property/${eoi.propertyId}`, unit: `/unit/${eoi.unitId}` }[eoi.targetType];

  return (
    <>
      {created && (
        <div className="success">
          <div className="big-emoji">✅</div>
          <h1>EOI submitted</h1>
          <p className="muted">Thank you. Our sales team will contact you at {eoi.buyer.email}.</p>
        </div>
      )}
      <Link to="/eois" className="back">← My EOIs</Link>
      <div className="panel">
        <div className="row">
          <h2 style={{ margin: 0 }}>{eoi.id}</h2>
          <EoiStatus status={eoi.status} />
        </div>
        <p className="muted small">Submitted {new Date(eoi.date).toLocaleString()}</p>

        <h3>Selection</h3>
        <p>
          <Link to={link}><u>{eoi.targetName}</u></Link> <span className="muted">({TYPE_LABEL[eoi.targetType]})</span>
        </p>
        {eoi.targetPrice != null && <p>List price when submitted: <strong>{money(eoi.targetPrice)}</strong></p>}
        {eoi.budget != null && <p>Your budget: <strong>{money(eoi.budget)}</strong></p>}

        <h3>Contact</h3>
        <p>{eoi.buyer.fullName}<br />{eoi.buyer.email}<br />{eoi.buyer.phone}</p>
        {eoi.notes && (<><h3>Notes</h3><p style={{ whiteSpace: 'pre-wrap' }}>{eoi.notes}</p></>)}

        {error && <p className="alert" role="alert">{error}</p>}
        {eoi.status === 'Submitted' && (
          <button className="btn ghost" onClick={withdraw} disabled={busy}>{busy ? 'Withdrawing…' : 'Withdraw EOI'}</button>
        )}
      </div>
    </>
  );
}
