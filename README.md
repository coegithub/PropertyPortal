# Property EOI Portal

React + Vite frontend and Node.js/Express API, run as **one server on one port**, with data in **Neon serverless Postgres**.

## Run it

Requires Node.js 22.9 or newer.

1. Create a free project at [neon.tech](https://neon.tech) and copy its connection string (Connect button).
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Run:

```
npm install
npm run dev        # http://localhost:3000
```

Changes under `src/` reload in the browser instantly. After changing `server/` or `shared/`, restart `npm run dev`.
On first start the server creates the tables and loads the sample data. `npm run db:reset` wipes everything and reloads it.

## Test

```
npm run dev        # in one terminal
npm run smoke      # in another: exercises the API end to end
npm run db:reset   # clean up the test data
```

## Deploy

```
npm ci --include=dev
npm run build      # React app -> dist/
npm start          # API + app on PORT (default 3000)
```

Or build the included `Dockerfile` (`docker build -t eoi-portal .`). A `render.yaml` blueprint is included for Render.
Set `DATABASE_URL` as a secret on the platform. The server stores nothing on disk, so it can be redeployed or scaled freely.

| Variable       | Default | Purpose                         |
|----------------|---------|---------------------------------|
| `DATABASE_URL` | none    | Neon Postgres connection string |
| `PORT`         | `3000`  | Port the server listens on      |

## Features

- Sign in / create an account (email + password)
- Search communities, properties and units, with filters for city, property type, bedrooms, price and availability (kept in the URL)
- Detail pages for each community, property (with its unit list) and unit
- Submit an EOI against a community, property or unit; view, and withdraw, your own EOIs

## API

| Method | Path                     | Description                                              |
|--------|--------------------------|----------------------------------------------------------|
| GET    | `/api/health`            | Health check (includes DB status)                        |
| GET    | `/api/catalog`           | Communities, properties and units                        |
| GET    | `/api/eois`              | EOIs of the signed-in user                               |
| GET    | `/api/eois/:id`          | One EOI                                                  |
| POST   | `/api/eois`              | Submit `{ targetType, targetId, buyer, budget, notes, consent }` |
| POST   | `/api/eois/:id/withdraw` | Withdraw your own EOI                                    |

The server looks up names, prices and availability in the database and never trusts them from the browser. Only one active EOI per person per selection is allowed (enforced by a unique index); sold units reject new EOIs.

## Next steps

- **Schema changes:** tables use `CREATE TABLE IF NOT EXISTS` at startup. Switch to a migration tool (e.g. node-pg-migrate) once the schema starts changing.

## Accounts

Visitors can browse without signing in. Booking, checkout and "my" pages need an account (email + password). Passwords are stored as scrypt hashes and sessions are HttpOnly cookies. To start fresh, `npm run db:reset` also removes all accounts.
