import { Router } from 'express';
import * as db from './db.js';
import { attachUser, authRouter, clientId } from './identity.js';

const api = Router();

const fail = (res, status, error) => res.status(status).json({ error });

// Express 4 doesn't catch errors from async handlers, so pass them on to the error handler.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Who is calling is decided in identity.js: clientId(req) is the signed-in user's id (401 when signed out).
api.use(attachUser);
if (authRouter) api.use('/auth', authRouter);

api.get('/health', wrap(async (req, res) => {
  try {
    await db.ping();
    res.json({ ok: true, db: 'up' });
  } catch {
    res.status(503).json({ ok: false, db: 'down' });
  }
}));

// The whole browsable catalog (small): communities, properties and units. Search and filters run in the browser.
api.get('/catalog', wrap(async (req, res) => {
  res.json(await db.getCatalog());
}));

api.get('/eois', wrap(async (req, res) => {
  res.json(await db.listEois(clientId(req)));
}));

api.get('/eois/:id', wrap(async (req, res) => {
  const eoi = await db.getEoi(req.params.id, clientId(req));
  if (!eoi) return fail(res, 404, 'EOI not found');
  res.json(eoi);
}));

api.post('/eois/:id/withdraw', wrap(async (req, res) => {
  const eoi = await db.withdrawEoi(req.params.id, clientId(req));
  if (!eoi) return fail(res, 404, 'EOI not found');
  res.json(eoi);
}));

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

api.post('/eois', wrap(async (req, res) => {
  const cid = clientId(req);
  const { targetType, targetId, buyer, budget, notes, consent } = req.body || {};

  if (!['community', 'property', 'unit'].includes(targetType)) return fail(res, 400, 'Choose a community, property or unit');
  if (typeof targetId !== 'string' || !targetId || targetId.length > 100) return fail(res, 400, 'Invalid selection');

  if (!buyer || typeof buyer !== 'object') return fail(res, 400, 'Your contact details are required');
  const b = { fullName: str(buyer.fullName, 120), email: str(buyer.email, 200), phone: str(buyer.phone, 40) };
  for (const f of Object.keys(b)) if (!b[f]) return fail(res, 400, `Missing field: ${f}`);
  if (!/^\S+@\S+\.\S+$/.test(b.email)) return fail(res, 400, 'Invalid email');
  if (!/^[+\d][\d\s().-]{5,}$/.test(b.phone)) return fail(res, 400, 'Invalid phone number');

  let budgetValue = null;
  if (budget !== undefined && budget !== null && budget !== '') {
    budgetValue = Number(budget);
    if (!Number.isFinite(budgetValue) || budgetValue <= 0 || budgetValue > 1e10) return fail(res, 400, 'Invalid budget');
  }
  if (consent !== true) return fail(res, 400, 'Please confirm that the EOI is non-binding and that we may contact you');

  // Name, price and availability come from the database, never from the client.
  const eoi = await db.createEoi({
    clientId: cid, targetType, targetId, buyer: b, budget: budgetValue, notes: str(notes, 1000),
  });
  res.status(201).json(eoi);
}));

export default api;
