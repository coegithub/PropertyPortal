// Single server for the whole app:
//   /api/*      -> Express API
//   everything  -> React app (Vite dev middleware in dev, built files from dist/ in prod)
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, closeDb } from './db.js';
import { initAuth } from './identity.js';
import api from './api.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

try {
  await initDb();
  await initAuth();
  console.log('Connected to Postgres');
} catch (err) {
  console.error(`Could not start: ${err.message}`);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
app.disable('x-powered-by');
// Behind Render/Fly/etc. the proxy terminates HTTPS: trust it so req.secure and req.ip are right.
if (isProd) app.set('trust proxy', 1);

app.use('/api', express.json({ limit: '100kb' }), api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

if (isProd) {
  const dist = path.join(rootDir, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('No build found in dist/. Run "npm run build" first.');
    process.exit(1);
  }
  // Hashed asset files never change, so let browsers cache them for a long time.
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist));
  // Send index.html for any other page so React Router can handle the URL.
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: rootDir,
    appType: 'spa',
    server: {
      middlewareMode: true,
      hmr: { server },
      watch: { ignored: ['**/data/**', '**/server/**'] },
    },
  });
  app.use(vite.middlewares);
}

app.use((err, req, res, next) => {
  if (!err.status || err.status >= 500) console.error(err);
  res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`Property EOI Portal running at http://localhost:${PORT} (${isProd ? 'production' : 'development'})`);
});

// Finish in-flight requests and close database connections on shutdown.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(async () => {
      await closeDb().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
