// API smoke test for the EOI portal. Run against a live server: npm run smoke
// Leaves test EOIs and @smoke.test users behind; run `npm run db:reset` afterwards.
import { identity, extraChecks, MISSING_IDENTITY_STATUS } from './smoke-identity.mjs';

const BASE = (process.env.BASE_URL || 'http://localhost:3000') + '/api';
const ID = 'smoke-' + Math.random().toString(36).slice(2, 10);
const headers = (id = ID) => identity(id);
const buyer = { fullName: 'Smoke Test', email: 'smoke@example.com', phone: '+971 50 123 4567' };

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failed++;
};
const call = async (path, opts = {}) => {
  const res = await fetch(BASE + path, opts);
  return { status: res.status, body: await res.json().catch(() => null) };
};
const eoi = async (targetType, targetId, extra = {}, id = ID) =>
  call('/eois', {
    method: 'POST', headers: await headers(id),
    body: JSON.stringify({ targetType, targetId, buyer, consent: true, ...extra }),
  });

const health = await call('/health');
check('health reports db up', health.body?.db === 'up');

const { body: cat } = await call('/catalog');
check('catalog has communities, properties and units', cat.communities.length > 0 && cat.properties.length > 0 && cat.units.length > 0);
check('unit prices are numbers', typeof cat.units[0].price === 'number');

const unit = cat.units.find((u) => u.status === 'Available');
const sold = cat.units.find((u) => u.status === 'Sold');
const prop = cat.properties[0];
const comm = cat.communities[0];
if (!unit || !sold) { console.log('Need an Available and a Sold unit. Run `npm run db:reset` and retry.'); process.exit(1); }

// Unit EOI: the server snapshots the price and name from the database.
const u1 = await eoi('unit', unit.id, { budget: 1234567, notes: 'Prefer a high floor' });
check('unit EOI created (201)', u1.status === 201, String(u1.body?.id));
check('server snapshotted the unit price', u1.body?.targetPrice === unit.price);
check('server derived the property and community', u1.body?.propertyId === unit.propertyId && !!u1.body?.communityId);
check('status starts as Submitted', u1.body?.status === 'Submitted');
check('budget stored as a number', u1.body?.budget === 1234567);

const p1 = await eoi('property', prop.id);
check('property EOI created', p1.status === 201 && p1.body.targetPrice === null && p1.body.targetName === prop.name);
const c1 = await eoi('community', comm.id);
check('community EOI created', c1.status === 201 && c1.body.targetName === comm.name);

check('duplicate active EOI rejected (409)', (await eoi('unit', unit.id)).status === 409);
const race = await Promise.all(Array.from({ length: 5 }, () => eoi('unit', cat.units.filter((u) => u.status === 'Available')[1].id, {}, `${ID}-race`)));
check('concurrent duplicates yield exactly one EOI', race.filter((r) => r.status === 201).length === 1);

check('sold unit rejected (409)', (await eoi('unit', sold.id)).status === 409);
check('unknown unit rejected (404)', (await eoi('unit', 'nope')).status === 404);
check('unknown community rejected (404)', (await eoi('community', 'nope')).status === 404);
check('bad target type rejected (400)', (await eoi('planet', 'x')).status === 400);
check('invalid email rejected', (await call('/eois', {
  method: 'POST', headers: await headers(),
  body: JSON.stringify({ targetType: 'property', targetId: prop.id, buyer: { ...buyer, email: 'x' }, consent: true }),
})).status === 400);
check('missing consent rejected', (await eoi('property', cat.properties[1].id, { consent: false })).status === 400);
check('negative budget rejected', (await eoi('property', cat.properties[1].id, { budget: -5 })).status === 400);
check('bad JSON rejected (400)', (await call('/eois', { method: 'POST', headers: await headers(), body: '{bad' })).status === 400);

const mine = await call('/eois', { headers: await headers() });
check('EOIs listed for the owner', mine.body.length === 3 && mine.body.some((e) => e.id === u1.body.id));
check('EOI fetchable by id', (await call('/eois/' + u1.body.id, { headers: await headers() })).status === 200);
const other = await headers('someone-else-1');
check('other user sees no EOIs', (await call('/eois', { headers: other })).body.length === 0);
check('other user gets 404 for the EOI', (await call('/eois/' + u1.body.id, { headers: other })).status === 404);
check('other user cannot withdraw it (404)', (await call(`/eois/${u1.body.id}/withdraw`, { method: 'POST', headers: other })).status === 404);

const w = await call(`/eois/${u1.body.id}/withdraw`, { method: 'POST', headers: await headers() });
check('owner can withdraw', w.status === 200 && w.body.status === 'Withdrawn');
check('withdrawing twice is rejected (409)', (await call(`/eois/${u1.body.id}/withdraw`, { method: 'POST', headers: await headers() })).status === 409);
check('can re-submit after withdrawing', (await eoi('unit', unit.id)).status === 201);

check('signed-out EOI list rejected', (await call('/eois')).status === MISSING_IDENTITY_STATUS);
check('signed-out submit rejected', (await call('/eois', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === MISSING_IDENTITY_STATUS);
check('unknown /api path is JSON 404', (await call('/nope')).status === 404);

await extraChecks(check, call);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed. Run `npm run db:reset` to clean up.');
process.exit(failed ? 1 : 0);
