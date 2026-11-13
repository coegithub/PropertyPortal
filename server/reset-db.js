// Deletes all tables and data, then recreates them with the seed catalog.
// Usage: npm run db:reset
import { dropAll, initDb, closeDb } from './db.js';
import { dropAuth, initAuth } from './identity.js';

try {
  await dropAll();
  await dropAuth();
  await initDb();
  await initAuth();
  console.log('Database reset.');
} catch (err) {
  console.error('Reset failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
