// How the smoke test acts as different users: each label registers its own account and keeps its session cookie.
// extraChecks covers the account endpoints themselves.
const BASE = (process.env.BASE_URL || 'http://localhost:3000') + '/api';
const PASSWORD = 'smoke-pass-123';
export const MISSING_IDENTITY_STATUS = 401; // what the API answers when nobody is signed in

const post = (path, body, headers = {}) =>
  fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const cookieOf = (res) => (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).find((c) => c.startsWith('sid=')) || null;
const jsonHeaders = (cookie) => ({ 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) });

const sessions = new Map();
export function identity(label) {
  // Cache the promise so concurrent callers for one label register only once.
  if (!sessions.has(label)) {
    sessions.set(label, (async () => {
      const res = await post('/auth/register', { name: label, email: `${label}@smoke.test`.toLowerCase(), password: PASSWORD });
      const cookie = cookieOf(res);
      if (res.status !== 201 || !cookie) throw new Error(`Smoke test could not register ${label} (${res.status})`);
      return jsonHeaders(cookie);
    })());
  }
  return sessions.get(label);
}

export async function extraChecks(check, call) {
  const id = 'acct-' + Math.random().toString(36).slice(2, 10);
  const email = `${id}@smoke.test`;
  const me = async (cookie) => (await call('/auth/me', { headers: jsonHeaders(cookie) })).body?.user;

  const res = await post('/auth/register', { name: 'Acct Test', email, password: PASSWORD });
  const cookie = cookieOf(res);
  const setCookie = (res.headers.getSetCookie?.() || []).join(' ').toLowerCase();
  check('register creates an account and a session', res.status === 201 && !!cookie);
  check('session cookie is HttpOnly + SameSite=Lax', setCookie.includes('httponly') && setCookie.includes('samesite=lax'));
  check('/auth/me returns the user, never the password hash', (await me(cookie))?.email === email && !JSON.stringify(await me(cookie)).includes('hash'));
  check('/auth/me is null when signed out', (await me(null)) === null);

  check('duplicate email rejected (409)', (await post('/auth/register', { email, password: PASSWORD })).status === 409);
  check('duplicate email is case-insensitive', (await post('/auth/register', { email: email.toUpperCase(), password: PASSWORD })).status === 409);
  check('short password rejected (400)', (await post('/auth/register', { email: `x${email}`, password: 'short' })).status === 400);
  check('invalid email rejected (400)', (await post('/auth/register', { email: 'nope', password: PASSWORD })).status === 400);

  const bad = await post('/auth/login', { email, password: 'wrong-password' });
  const unknown = await post('/auth/login', { email: `nobody-${email}`, password: 'wrong-password' });
  check('wrong password rejected (401)', bad.status === 401);
  check('unknown email gives the same answer as a wrong password', unknown.status === 401 && (await bad.json()).error === (await unknown.json()).error);

  const login = await post('/auth/login', { email, password: PASSWORD });
  const second = cookieOf(login);
  check('login works and starts a separate session', login.status === 200 && !!second && second !== cookie);

  const evil = await post('/auth/logout', {}, { Origin: 'https://evil.example', Cookie: cookie });
  check('cross-site POST is blocked (403)', evil.status === 403 && !!(await me(cookie)));

  const changed = await post('/auth/password', { currentPassword: PASSWORD, newPassword: PASSWORD + '-new' }, { Cookie: cookie });
  check('password change works', changed.status === 200);
  check('password change signs out other sessions', (await me(second)) === null && !!(await me(cookie)));
  check('old password no longer works', (await post('/auth/login', { email, password: PASSWORD })).status === 401);

  await post('/auth/logout', {}, { Cookie: cookie });
  check('logout ends the session', (await me(cookie)) === null);

  // Brute force: five failures for one account from one address lock further attempts for a while.
  const target = `lock-${id}@smoke.test`;
  let last = 0;
  for (let i = 0; i < 6; i++) last = (await post('/auth/login', { email: target, password: 'guess-' + i })).status;
  check('repeated failed logins are rate limited (429)', last === 429);
}