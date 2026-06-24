-- Afterglow — Phase 1 schema (Postgres + PostGIS)
-- Mirrors the data model sketch in docs/ROADMAP.md.
-- Run with: psql "$DATABASE_URL" -f db/schema.sql   (or: npm run migrate)

CREATE EXTENSION IF NOT EXISTS postgis;    -- geo point + radius queries
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- Crews ARE the color palette (see docs/DESIGN.md). One saturated hex each.
CREATE TABLE IF NOT EXISTS crew (
  id     text PRIMARY KEY,            -- 'lowend'
  name   text NOT NULL,
  short  text NOT NULL,               -- 'LET'
  color  text NOT NULL               -- '#16E0C8'
);

CREATE TABLE IF NOT EXISTS app_user (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle     text UNIQUE NOT NULL,
  crew_id    text REFERENCES crew(id),
  xp         integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venue (
  id                text PRIMARY KEY,           -- 'pacha'
  name              text NOT NULL,
  alias             text,
  hood              text,
  cap               text,
  address           text,
  geofence_radius_m integer NOT NULL,
  geog              geography(Point, 4326) NOT NULL,  -- ST_MakePoint(lng, lat)
  fading            boolean NOT NULL DEFAULT false,
  last_active       timestamptz
);
CREATE INDEX IF NOT EXISTS venue_geog_gix ON venue USING gist (geog);

CREATE TABLE IF NOT EXISTS event (
  id         bigserial PRIMARY KEY,
  venue_id   text NOT NULL REFERENCES venue(id),
  event_date date NOT NULL,
  src        text NOT NULL,                -- 'ra.co' | 'edmtrain' | 'dice.fm'
  source_url text,
  synced_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, event_date, src)       -- idempotent upsert key for the sync worker
);
CREATE INDEX IF NOT EXISTS event_venue_date_idx ON event (venue_id, event_date);

CREATE TABLE IF NOT EXISTS event_artist (
  event_id  bigint NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  artist    text NOT NULL,
  genre     text,
  b2b_order integer,
  PRIMARY KEY (event_id, artist)
);

CREATE TABLE IF NOT EXISTS checkin (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES app_user(id),
  venue_id   text NOT NULL REFERENCES venue(id),
  event_id   bigint REFERENCES event(id),
  artist     text,
  genre      text,
  full_set   boolean NOT NULL DEFAULT false,
  lat        double precision NOT NULL,     -- client-reported, kept for audit only
  lng        double precision NOT NULL,
  distance_m integer NOT NULL,              -- recomputed server-side (authoritative)
  verified   boolean NOT NULL,
  xp_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkin_user_idx  ON checkin (user_id);
CREATE INDEX IF NOT EXISTS checkin_venue_idx ON checkin (venue_id);

-- Crew control per venue. leader/share are DERIVED (see venue_control view).
CREATE TABLE IF NOT EXISTS control_ledger (
  venue_id   text NOT NULL REFERENCES venue(id),
  crew_id    text NOT NULL REFERENCES crew(id),
  points     double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, crew_id)
);

CREATE TABLE IF NOT EXISTS badge (
  user_id   uuid NOT NULL REFERENCES app_user(id),
  key       text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- Derived leader + share per (venue, crew). The client never computes control;
-- it reads it from here so the map's colors are server-authoritative.
CREATE OR REPLACE VIEW venue_control AS
SELECT
  cl.venue_id,
  cl.crew_id,
  cl.points,
  cl.points / NULLIF(SUM(cl.points) OVER (PARTITION BY cl.venue_id), 0) AS share,
  rank() OVER (PARTITION BY cl.venue_id ORDER BY cl.points DESC) AS rnk
FROM control_ledger cl;
