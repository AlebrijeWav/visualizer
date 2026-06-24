# CLAUDE.md — Afterglow

> Context file for Claude Code. Read this first. It indexes everything in `docs/` and `data/`.

## What we're building

**Afterglow** is a territory-control game layered over electronic-music nightlife — think
"Untappd for raving" crossed with a map-based control game. You check into shows (verified by
GPS geofence), earn XP, and your **crew** captures **venues**. The map of NYC shows which crew
currently controls each venue. Territory decays if your crew stops showing up.

Five mechanics (full detail in `docs/PRODUCT.md`):
1. Venue territory control (capture by checking in; "mayors"; decay over time)
2. Artist fandom territories
3. Festival stage gameplay
4. Music-discovery rewards (new genres/venues/artists)
5. City-vs-city crew wars

## Current status — WORKING PROTOTYPE

`prototype/index.html` is a single self-contained HTML app. It runs with no build step and no
backend. What works today:
- Real interactive map (Leaflet + CARTO dark tiles) with 6 real NYC venues plotted by lat/lng
- Venues colored by the crew that controls them; tap for a territory breakdown + mayor
- **Real GPS** (`navigator.geolocation.watchPosition`) with a Haversine geofence gate on check-in;
  the geofence distance + inside/outside state update **live** while the sheet is open; geofence
  circle drawn to scale on the map; "Jump to venue (demo)" to test on-site
- Check-in flow → XP with bonuses (new artist/venue/genre, full-set dwell) → territory shift →
  "TERRITORY FLIPPED" when your crew takes the lead → badges
- Passport (level, XP, artist collection, badges), Crew Wars + City-vs-City leaderboards
- Verified upcoming lineups per venue, shaped like a live API response
- **Progress persists** across reloads (localStorage: XP, collection, badges, venue control
  ledger); Passport has a "Reset progress" button for clean demos

## How to run

Open `prototype/index.html` in any modern browser, or:
```
npx serve prototype
```
Allow the location permission to test GPS. (You won't be standing at a Brooklyn venue, so real
distance will correctly refuse check-in — use "Jump to venue (demo)" to exercise the full flow.)

## Repo map

- `prototype/index.html` — the working prototype (source of truth for UX + design)
- `data/venues.json` — 6 venues, coords, geofence radii, control state, **verified lineups**
- `data/crews.json` — the 5 crews and their colors (the color system IS the crews)
- `docs/PRODUCT.md` — concept, mechanics, why nightlife fits, MVP cut
- `docs/DATA-SOURCES.md` — Edmtrain / RA / Dice strategy + the legal constraints (READ before integrating)
- `docs/VERIFICATION.md` — geofence design, dwell, anti-spoofing phases
- `docs/DESIGN.md` — design tokens, type, the crew=color invariant
- `docs/ROADMAP.md` — phased build plan + next tasks

## Architecture

**Now:** single HTML file, Leaflet, CARTO tiles, hardcoded data, all client-side.

**Planned (not yet chosen — decide early):**
- Client: mobile-first. Strong options: React Native / Expo (native geofencing in background)
  or a Next.js PWA. Geofencing in the *background* is the deciding factor — see `docs/VERIFICATION.md`.
- Backend: an API + a scheduled **sync worker** that pulls Edmtrain/RA into our own DB.
  Use **Postgres + PostGIS** for venue geo + radius queries.
- The check-in verification endpoint is server-authoritative (never trust client-reported location alone).

## Guardrails (please keep these invariant)

- **Crews are the color palette.** Each crew owns one hex; the map reads as contested colored
  territory. Don't introduce a generic accent that competes with crew colors. (`docs/DESIGN.md`)
- **Never put API keys in the client.** Edmtrain/RA calls happen server-side only.
- **`data/venues.json` lineups are a verified snapshot from 2026-06-24 and WILL go stale.**
  The whole point of the sync worker is to replace this snapshot with live data. Don't treat the
  hardcoded shows as permanent.
- **Respect data-source terms** (`docs/DATA-SOURCES.md`): Edmtrain forbids combining its data with
  other sources into a competing discovery app and requires cache <24h; RA has no official API
  (its GraphQL endpoint is unofficial). Check ToS before building the integration.
- Verification is layered and phased — geofence is phase 1, not the final answer.

## Open decisions

- Client framework (native geofencing need likely points to React Native/Expo)
- Primary data source + whether the product is positioned as "discovery" (ToS risk) or "check-in game"
- Anti-fraud roadmap for check-ins (the make-or-break risk)
- Cold-start scene to seed first (recommended: Brooklyn house/techno, the 6 venues here)
