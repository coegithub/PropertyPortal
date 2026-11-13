// Accounts and sessions (opt-in: scaffold with --auth). Replaces the anonymous identity.js.
//   - Passwords: scrypt (node:crypto) with a random salt per user. No extra dependencies.
//   - Sessions: random 256-bit token in an HttpOnly, SameSite=Lax cookie. Only its SHA-256 hash is stored,
//     so a leaked database cannot be replayed as logins.
//   - CSRF: SameSite cookie + Origin must match Host on every state-changing request.
//   - Brute force: in-memory rate limits (per process; move to Postgres/Redis if you run several instances).
import { Router } from 'express';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { getPool, httpError, retry } from './pool.js';
import { claimRecords } from './db.js';

const scrypt = promisify(crypto.scrypt);

const COOKIE = 'sid';
const SESSION_DAYS = 30;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000; // slide the expiry at most once a day
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128; // scrypt is deliberately slow: cap the input so it cannot be abused

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used  timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
`;

export async function initAuth() {
  await retry(() => getPool().query(SCHEMA));
  const sweep = () => getPool().query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
  await sweep();
  setInterval(sweep, 6 * 60 * 60 * 1000).unref();
}

export async function dropAuth() {
  await getPool().query('DROP TABLE IF EXISTS sessions, users');
}

// ---- passwords ----

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltB64, hashB64] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// Checked when the email is unknown so "no such user" costs the same time as "wrong password".
let dummyHash = null;
const getDummyHash = () => (dummyHash ||= hashPassword(crypto.randomBytes(12).toString('hex')));

// ---- rate limiting (in memory) ----

const hits = new Map(); // key -> { count, resetAt }
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
}, 10 * 60 * 1000).unref();

function overLimit(key, max) {
  const e = hits.get(key);
  return !!e && e.resetAt > Date.now() && e.count >= max;
}
function recordHit(key, windowMs) {
  const now = Date.now();
  const e = hits.get(key);
  if (!e || e.resetAt <= now) hits.set(key, { count: 1, resetAt: now + windowMs });
  else e.count++;
}
const tooMany = () => httpError(429, 'Too many attempts. Please wait a few minutes and try again.');
const isLoopback = (ip) => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

// ---- sessions ----

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setSessionCookie(req, res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure, // true behind an HTTPS proxy in production (index.js sets trust proxy)
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

async function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await getPool().query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3::int))`,
    [sha256(token), userId, SESSION_DAYS]
  );
  setSessionCookie(req, res, token);
}

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

// Runs before every /api route: rejects cross-site writes, then sets req.user from the session cookie (or null).
export async function attachUser(req, res, next) {
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('Origin');
      if (origin) {
        let host = null;
        try { host = new URL(origin).host; } catch { /* malformed */ }
        if (host !== req.get('Host')) throw httpError(403, 'Cross-site request blocked');
      }
    }
    req.user = null;
    const token = readCookie(req, COOKIE);
    if (!token) return next();
    const { rows } = await getPool().query(
      `SELECT u.id, u.email, u.name, s.last_used FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [sha256(token)]
    );
    if (!rows[0]) return next();
    req.user = publicUser(rows[0]);
    if (Date.now() - new Date(rows[0].last_used).getTime() > REFRESH_AFTER_MS) {
      await getPool().query(
        `UPDATE sessions SET last_used = now(), expires_at = now() + make_interval(days => $2::int) WHERE token_hash = $1`,
        [sha256(token), SESSION_DAYS]
      );
      setSessionCookie(req, res, token);
    }
    next();
  } catch (err) {
    next(err);
  }
}

// The id that owns records (orders/bookings): the signed-in user's id. Throws 401 when signed out.
export function clientId(req) {
  if (!req.user) throw httpError(401, 'Please sign in to continue');
  return req.user.id;
}

// ---- routes: mounted at /api/auth ----

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const authRouter = Router();

function readCredentials(body, { needName = false } = {}) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Enter a valid email address');
  if (needName) {
    if (password.length < PASSWORD_MIN) throw httpError(400, `Password must be at least ${PASSWORD_MIN} characters`);
    if (password.toLowerCase() === email) throw httpError(400, 'Password must not be your email address');
  }
  if (password.length > PASSWORD_MAX) throw httpError(400, `Password must be at most ${PASSWORD_MAX} characters`);
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : '';
  return { email, password, name: name || email.split('@')[0] };
}

// Hand over anything this browser created before signing in (anonymous X-Client-Id records).
async function claimAnonymous(req, userId) {
  const anon = req.get('X-Client-Id');
  if (anon && /^[\w-]{8,64}$/.test(anon) && anon !== userId) await claimRecords(anon, userId);
}

authRouter.get('/me', (req, res) => res.json({ user: req.user }));

authRouter.post('/register', wrap(async (req, res) => {
  if (!isLoopback(req.ip)) { // local scripts (the smoke test) are exempt; real traffic arrives via the proxy IP
    if (overLimit(`reg:${req.ip}`, 20)) throw tooMany();
    recordHit(`reg:${req.ip}`, 60 * 60 * 1000);
  }
  const { email, password, name } = readCredentials(req.body, { needName: true });
  let user;
  try {
    const { rows } = await getPool().query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, name, await hashPassword(password)]
    );
    user = rows[0];
  } catch (err) {
    if (err.code === '23505') throw httpError(409, 'An account with this email already exists');
    throw err;
  }
  await claimAnonymous(req, user.id);
  await startSession(req, res, user.id);
  res.status(201).json({ user: publicUser(user) });
}));

authRouter.post('/login', wrap(async (req, res) => {
  const { email, password } = readCredentials(req.body);
  const keys = [`login:${req.ip}:${email}`, `loginip:${req.ip}`];
  // The per-address cap skips loopback so local dev and the smoke test never lock themselves out.
  if (overLimit(keys[0], 5) || (!isLoopback(req.ip) && overLimit(keys[1], 50))) throw tooMany();

  const { rows } = await getPool().query('SELECT id, email, name, password_hash FROM users WHERE email = $1', [email]);
  const ok = await verifyPassword(password, rows[0]?.password_hash ?? (await getDummyHash()));
  if (!rows[0] || !ok) {
    recordHit(keys[0], 15 * 60 * 1000);
    recordHit(keys[1], 15 * 60 * 1000);
    throw httpError(401, 'Incorrect email or password');
  }
  hits.delete(keys[0]);
  await claimAnonymous(req, rows[0].id);
  await startSession(req, res, rows[0].id);
  res.json({ user: publicUser(rows[0]) });
}));

authRouter.post('/logout', wrap(async (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) await getPool().query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}));

// Changing the password signs out every other device.
authRouter.post('/password', wrap(async (req, res) => {
  const userId = clientId(req);
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') throw httpError(400, 'Both passwords are required');
  if (newPassword.length < PASSWORD_MIN || newPassword.length > PASSWORD_MAX)
    throw httpError(400, `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`);
  const { rows } = await getPool().query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows[0] || !(await verifyPassword(currentPassword.slice(0, PASSWORD_MAX), rows[0].password_hash)))
    throw httpError(403, 'Current password is incorrect');
  await getPool().query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, await hashPassword(newPassword)]);
  await getPool().query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [userId, sha256(readCookie(req, COOKIE) || '')]);
  res.json({ ok: true });
}));
