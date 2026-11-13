# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev        # Express + Vite dev middleware on http://localhost:3000
npm run build      # vite build -> dist/
npm start          # production: serves dist/ + API (requires a prior build)
npm run smoke      # API smoke test against a running server (BASE_URL, default http://localhost:3000)
npm run db:reset   # DROPS all tables, recreates schema, reseeds (destructive)
```

- Requires Node >= 22.9 (scripts use `--env-file-if-exists=.env`). `DATABASE_URL` (Neon Postgres) must be set in `.env`, or the server exits on startup.
- No linter or unit tests. `npm run smoke` is the regression check for the API; run `npm run db:reset` afterwards because it leaves test data behind.
- `npm run dev` deliberately has no `node --watch`: on Windows it restarted the server in a loop whenever Vite wrote to `node_modules/.vite`. Frontend edits hot-reload; restart manually after editing `server/` or `shared/`.
- `.env` holds live credentials and is git-ignored. Never paste connection strings into chat or commit them.

## Architecture

Deployed as one artifact: a single Express process (`server/index.js`) serves both the API and the React SPA on one port.

- `/api/*` -> `server/api.js`, mounted before the SPA handler; unknown `/api` paths return JSON 404.
- Dev: Vite runs in middleware mode inside Express (HMR on the same HTTP server). Prod (`--prod` or `NODE_ENV=production`): `express.static(dist)` plus an `index.html` catch-all so React Router handles client routes.
- `initDb()` runs before `listen`: schema is `CREATE TABLE IF NOT EXISTS` inline in `server/db.js`, seed data loads only into an empty table. No migration tool yet.
- `server/pool.js` holds the Neon `Pool` (WebSockets, required for interactive transactions), `httpError(status, msg)` and a connection `retry` for Neon cold starts. All domain SQL is in `server/db.js`.
- Express 4 does not catch async errors: every handler in `api.js` is wrapped with `wrap()`. The error handler in `index.js` returns `err.message` only for status < 500.
- Postgres `numeric` comes back as strings and `timestamp` as local-time `Date`: convert in `db.js` mappers (`Number(...)`, `to_char(...)`) and keep API response shapes stable, since the frontend depends on them.

### Trust boundary
The server is authoritative for prices, availability and totals. Clients send only identifiers and user input; the server recomputes everything from the database. Payment is mocked (only a card's last 4 digits or a method name ever reach the server).

### Identity (accounts)
Users register and sign in with email + password (`server/identity.js`, no extra dependencies). Passwords are hashed with scrypt; a session is a random token in an HttpOnly, SameSite=Lax cookie, and only its SHA-256 hash is stored in the `sessions` table. `attachUser` runs before every `/api` route: it rejects cross-site writes (Origin must match Host) and sets `req.user`.

- `clientId(req)` in `server/identity.js` returns the signed-in user's id (the owner id used in the `client_id` columns) and throws 401 when nobody is signed in. Handlers in `api.js` must always scope records by it and answer 404, not 403, for other users' records.
- Routes (`/api/auth/*`): `GET /me` (`{user: null}` when signed out), `POST /register`, `POST /login`, `POST /logout`, `POST /password` (signs out other devices). Failed logins are rate limited in memory per email+address (single-process; move to Postgres or Redis before running several instances).
- Records made anonymously in the same browser (old `X-Client-Id`) are handed to the account on register/login via `claimRecords` in `server/db.js`.
- Frontend: `AuthContext` (`useAuth`) loads `/auth/me`; wrap any page that needs an account in `<RequireAuth>` in `App.jsx`. A 401 from any API call signs the user out in the UI. `src/services/auth.js` holds the account calls; everything goes through `src/services/http.js`.
- Not included: email verification, password reset, social login, roles. Add them server-side in `identity.js`; password reset needs an email provider. Never log passwords or tokens.

### Frontend state
`src/context/StoreContext.jsx` holds the catalog fetched from the API (`status`: loading/ready/error). Pages render `<LoadState />` until it is `ready`: anything that derives data from the catalog (EOI form, detail pages) must wait, or it misfires on first render. Call `refresh*()` after any mutation so the UI matches the database. `src/services/http.js` is the only place that calls `fetch`; `api.js` (and `auth.js` with accounts) only define the calls.

## EOI domain specifics

- Hierarchy: `communities` -> `properties` -> `units` (seed in `shared/properties.js`, loaded only into an empty database). Unit `status` is Available / Reserved / Sold.
- `eois` is the record customers create (`client_id` = user id). It stores a snapshot (`target_name`, `target_price`) plus `buyer` jsonb (name, email, phone), optional `budget` and `notes`. Statuses: Submitted, Withdrawn (staff statuses and an admin UI do not exist yet; they need roles in `identity.js`).
- `POST /api/eois` accepts only `{targetType: community|property|unit, targetId, buyer, budget?, notes?, consent: true}`. `createEoi` in `server/db.js` re-reads the selection from the database; sold units give 409. Do not take names or prices from the client.
- A partial unique index (`eois_one_active_idx`) allows one non-withdrawn EOI per user per selection; a duplicate is a 409. Do not replace it with check-then-insert.
- The catalog is small and served whole by `GET /api/catalog`; search and filters run in the browser (`src/pages/Home.jsx`, state in URL params `q, tab, city, type, beds, max, avail`). Move to server-side search if the catalog grows to thousands of rows.
- Currency is AED, formatted in `src/utils/format.js` only. Browsing is public; the EOI form and My EOIs need an account (`<RequireAuth>` in `App.jsx`).
- UI wording: keep EOI terms in the UI; there is no cart, wishlist or payment.
