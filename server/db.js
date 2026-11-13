// Postgres data layer (Neon serverless). All SQL lives in this file.
import { randomBytes } from 'node:crypto';
import { getPool, httpError, retry, ping, closeDb } from './pool.js';
import { COMMUNITIES, PROPERTIES, UNITS } from '../shared/properties.js';

export { httpError, ping, closeDb };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS communities (
  id text PRIMARY KEY, name text NOT NULL, city text NOT NULL,
  description text NOT NULL DEFAULT '', emoji text NOT NULL DEFAULT '', color text NOT NULL DEFAULT '#eeeeee',
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS properties (
  id text PRIMARY KEY, community_id text NOT NULL REFERENCES communities(id),
  name text NOT NULL, type text NOT NULL, handover text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '', emoji text NOT NULL DEFAULT '', color text NOT NULL DEFAULT '#eeeeee',
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS units (
  id text PRIMARY KEY, property_id text NOT NULL REFERENCES properties(id),
  unit_no text NOT NULL, bedrooms integer NOT NULL, bathrooms integer NOT NULL,
  area_sqft integer NOT NULL, floor integer NOT NULL, price numeric(14,2) NOT NULL CHECK (price >= 0),
  view text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'Available',
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS eois (
  id           text PRIMARY KEY,
  client_id    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'Submitted',
  target_type  text NOT NULL CHECK (target_type IN ('community','property','unit')),
  target_id    text NOT NULL,
  community_id text NOT NULL REFERENCES communities(id),
  property_id  text REFERENCES properties(id),
  unit_id      text REFERENCES units(id),
  target_name  text NOT NULL,
  target_price numeric(14,2),
  budget       numeric(14,2),
  buyer        jsonb NOT NULL,
  notes        text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS eois_client_created_idx ON eois (client_id, created_at DESC);
-- One live EOI per person per selection, enforced by the database (race-safe).
CREATE UNIQUE INDEX IF NOT EXISTS eois_one_active_idx ON eois (client_id, target_type, target_id) WHERE status <> 'Withdrawn';
`;

async function bulkInsert(db, table, cols, rows) {
  const params = [];
  const tuples = rows.map((r, i) => {
    params.push(...cols.map((c) => r[c]), i);
    const b = i * (cols.length + 1);
    return `(${cols.map((_, j) => `$${b + j + 1}`).join(', ')}, $${b + cols.length + 1})`;
  });
  await db.query(
    `INSERT INTO ${table} (${cols.join(', ')}, position) VALUES ${tuples.join(', ')} ON CONFLICT (id) DO NOTHING`,
    params
  );
}

// Creates the tables if needed and loads the seed catalog into an empty database.
export async function initDb() {
  const db = getPool();
  await retry(() => db.query(SCHEMA));

  const { rows } = await db.query('SELECT count(*)::int AS n FROM communities');
  if (rows[0].n > 0) return;

  await bulkInsert(db, 'communities', ['id', 'name', 'city', 'description', 'emoji', 'color'], COMMUNITIES);
  await bulkInsert(db, 'properties', ['id', 'community_id', 'name', 'type', 'handover', 'description', 'emoji', 'color'],
    PROPERTIES.map((p) => ({ ...p, community_id: p.communityId })));
  await bulkInsert(db, 'units', ['id', 'property_id', 'unit_no', 'bedrooms', 'bathrooms', 'area_sqft', 'floor', 'price', 'view', 'status'],
    UNITS.map((u) => ({ ...u, property_id: u.propertyId, unit_no: u.unitNo, area_sqft: u.areaSqft })));
  console.log(`Seeded ${COMMUNITIES.length} communities, ${PROPERTIES.length} properties, ${UNITS.length} units`);
}

export async function dropAll() {
  await getPool().query('DROP TABLE IF EXISTS eois, units, properties, communities');
}

// Postgres returns numeric columns as strings, so convert them back to numbers.
const toCommunity = (r) => ({ id: r.id, name: r.name, city: r.city, description: r.description, emoji: r.emoji, color: r.color });
const toProperty = (r) => ({
  id: r.id, communityId: r.community_id, name: r.name, type: r.type, handover: r.handover,
  description: r.description, emoji: r.emoji, color: r.color,
});
const toUnit = (r) => ({
  id: r.id, propertyId: r.property_id, unitNo: r.unit_no, bedrooms: r.bedrooms, bathrooms: r.bathrooms,
  areaSqft: r.area_sqft, floor: r.floor, price: Number(r.price), view: r.view, status: r.status,
});
const toEoi = (r) => ({
  id: r.id,
  date: new Date(r.created_at).toISOString(),
  status: r.status,
  targetType: r.target_type,
  targetId: r.target_id,
  communityId: r.community_id,
  propertyId: r.property_id,
  unitId: r.unit_id,
  targetName: r.target_name,
  targetPrice: r.target_price == null ? null : Number(r.target_price),
  budget: r.budget == null ? null : Number(r.budget),
  buyer: r.buyer,
  notes: r.notes,
});

export async function getCatalog() {
  const db = getPool();
  const [c, p, u] = await Promise.all([
    db.query('SELECT * FROM communities ORDER BY position, id'),
    db.query('SELECT * FROM properties ORDER BY position, id'),
    db.query('SELECT * FROM units ORDER BY position, id'),
  ]);
  return { communities: c.rows.map(toCommunity), properties: p.rows.map(toProperty), units: u.rows.map(toUnit) };
}

// Used by auth: hands EOIs made anonymously in this browser to the user who just signed in.
export async function claimRecords(fromId, toId) {
  await getPool().query(
    `UPDATE eois SET client_id = $2 WHERE client_id = $1
       AND NOT EXISTS (SELECT 1 FROM eois e2 WHERE e2.client_id = $2 AND e2.target_type = eois.target_type
                       AND e2.target_id = eois.target_id AND e2.status <> 'Withdrawn')`,
    [fromId, toId]
  );
}

export async function listEois(clientId) {
  const { rows } = await getPool().query(
    'SELECT * FROM eois WHERE client_id = $1 ORDER BY created_at DESC LIMIT 100', [clientId]);
  return rows.map(toEoi);
}

export async function getEoi(id, clientId) {
  const { rows } = await getPool().query('SELECT * FROM eois WHERE id = $1 AND client_id = $2', [id, clientId]);
  return rows[0] ? toEoi(rows[0]) : null;
}

// Resolves the selection from the database. Name, price and hierarchy are never taken from the client.
async function resolveTarget(db, targetType, targetId) {
  if (targetType === 'community') {
    const { rows } = await db.query('SELECT id, name FROM communities WHERE id = $1', [targetId]);
    if (!rows[0]) throw httpError(404, 'Community not found');
    return { communityId: rows[0].id, propertyId: null, unitId: null, name: rows[0].name, price: null };
  }
  if (targetType === 'property') {
    const { rows } = await db.query('SELECT id, name, community_id FROM properties WHERE id = $1', [targetId]);
    if (!rows[0]) throw httpError(404, 'Property not found');
    return { communityId: rows[0].community_id, propertyId: rows[0].id, unitId: null, name: rows[0].name, price: null };
  }
  const { rows } = await db.query(
    `SELECT u.id, u.unit_no, u.price, u.status, p.id AS property_id, p.name AS property_name, p.community_id
       FROM units u JOIN properties p ON p.id = u.property_id WHERE u.id = $1`, [targetId]);
  const u = rows[0];
  if (!u) throw httpError(404, 'Unit not found');
  if (u.status === 'Sold') throw httpError(409, 'This unit has been sold and no longer accepts EOIs.');
  return {
    communityId: u.community_id, propertyId: u.property_id, unitId: u.id,
    name: `${u.property_name} · Unit ${u.unit_no}`, price: Number(u.price),
  };
}

export async function createEoi({ clientId, targetType, targetId, buyer, budget, notes }) {
  const db = getPool();
  const t = await resolveTarget(db, targetType, targetId);
  const id = `EOI-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;
  try {
    const { rows } = await db.query(
      `INSERT INTO eois (id, client_id, target_type, target_id, community_id, property_id, unit_id,
                         target_name, target_price, budget, buyer, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [id, clientId, targetType, targetId, t.communityId, t.propertyId, t.unitId, t.name, t.price, budget,
       JSON.stringify(buyer), notes]
    );
    return toEoi(rows[0]);
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'You already have an active EOI for this selection.');
    throw err;
  }
}

export async function withdrawEoi(id, clientId) {
  const { rows } = await getPool().query(
    `UPDATE eois SET status = 'Withdrawn' WHERE id = $1 AND client_id = $2 AND status = 'Submitted' RETURNING *`,
    [id, clientId]);
  if (rows[0]) return toEoi(rows[0]);
  const existing = await getEoi(id, clientId);
  if (!existing) return null;
  throw httpError(409, `An EOI that is ${existing.status.toLowerCase()} cannot be withdrawn.`);
}
