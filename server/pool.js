// Shared Postgres plumbing (Neon serverless). Domain SQL lives in db.js.
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Neon's Pool talks to Postgres over WebSockets, which supports interactive transactions.
neonConfig.webSocketConstructor = ws;

let pool = null;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.'
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    pool.on('error', (err) => console.error('Postgres pool error:', err.message));
  }
  return pool;
}

// An Error that the Express error handler turns into an HTTP response with this status.
export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// Neon free projects scale to zero, so the first connection after idle can take several seconds.
// Retry connection-level failures; real SQL errors (5-character SQLSTATE codes) fail immediately.
export async function retry(fn, { tries = 4, delayMs = 2000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isSqlError = typeof err.code === 'string' && err.code.length === 5;
      if (isSqlError || attempt >= tries) throw err;
      console.warn(`Database not ready (${err.message}); retrying…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function ping() {
  await getPool().query('SELECT 1');
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = null;
}
