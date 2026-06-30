# Afterglow server — Phase 1

Server-authoritative check-in API + sync/decay workers. Implements the Phase 1
items in [`../docs/ROADMAP.md`](../docs/ROADMAP.md). Postgres + PostGIS; plain
Node + Express, no framework lock-in. The prototype (`../prototype/index.html`)
is the UX source of truth; this makes the same rules authoritative on the server.

## Why server-authoritative
The client reports its location; the **server** recomputes distance with PostGIS
and decides verification, XP, and territory. The client is never trusted for
distance. See [`../docs/VERIFICATION.md`](../docs/VERIFICATION.md).

## Setup
```bash
cp .env.example .env          # set DATABASE_URL (a PostGIS-enabled Postgres)
npm install
npm run migrate               # create schema (psql -f db/schema.sql)
npm run seed                  # load the verified snapshot from ../data
npm run dev                   # API on :8787
npm run worker                # sync + decay loop (separate process)
```
Need a database fast: `docker run -e POSTGRES_PASSWORD=afterglow -e POSTGRES_USER=afterglow -e POSTGRES_DB=afterglow -p 5432:5432 postgis/postgis`.

## Endpoints
| Method | Path             | Purpose                                            |
|--------|------------------|----------------------------------------------------|
| GET    | `/health`        | DB connectivity probe                              |
| GET    | `/venues`        | All venues + derived leader/share/fading (map)     |
| GET    | `/venues/:id`    | Control breakdown, mayor, upcoming lineup          |
| GET    | `/users/:handle` | Passport: xp, level, collection counts, badges     |
| GET    | `/wars`          | Crew totals (control held across all venues)       |
| POST   | `/checkin`       | Authoritative check-in (geofence + XP + territory) |

### Check in
```bash
curl -sX POST localhost:8787/checkin -H 'content-type: application/json' -d '{
  "handle":"you","venueId":"elsewhere","artist":"Eli Escobar",
  "fullSet":true,"lat":40.7069,"lng":-73.9231
}'
```
Inside the geofence → itemized XP, level, `flipped` if your crew took the lead,
and any new badges. Outside → `403 out_of_range` with how far past the radius
you are (and the attempt is logged for anti-fraud analytics).

## Workers
- **sync** (`src/sync.js`) — normalizes feed events to our shape, upserts, drops
  past events. Falls back to the `../data` snapshot until `EDMTRAIN_CLIENT_KEY`
  is set. Honors the <24h freshness rule (`../docs/DATA-SOURCES.md`). API keys
  are server-only.
- **decay** (`src/decay.js`) — bleeds control at venues with no recent activity
  and flags them `fading`. The scheduled counterpart to check-in's control gain.

Run them ad hoc with `npm run sync` / `npm run decay`, or together via
`npm run worker`. In production prefer pg_cron or external cron over the
in-process loop.

## Layout
```
db/schema.sql     PostGIS schema + venue_control view
src/db.js         pg pool + tx() helper
src/scoring.js    XP rules + levels (mirrors the prototype)
src/checkin.js    server-authoritative check-in
src/sync.js       sync worker (feed -> normalized -> upsert)
src/decay.js      territory decay job
src/server.js     Express API
src/worker.js     sync + decay scheduler
src/seed.js       load ../data snapshot (idempotent)
```
