# Roadmap

## Done
- Concept + five mechanics defined
- Working prototype: real Leaflet map, real GPS geofence, check-in -> XP -> territory loop,
  passport, crew + city wars
- 6 NYC venues with verified upcoming lineups + geofence radii (data/venues.json)
- Data-source + verification strategy documented

## Next — phase 0: decisions
- [ ] Pick client framework (lean React Native/Expo for background geofencing — see VERIFICATION.md)
- [ ] Pick primary data source + confirm positioning vs Edmtrain ToS
- [ ] Choose the seed scene (recommended: the 6 Brooklyn/Queens venues here)

## Phase 1: real backend
Scaffolded and verified end-to-end against PostGIS in `server/` (see `server/README.md`).
- [x] Postgres + PostGIS schema: users, crews, venues, events, checkins, control_ledger (`server/db/schema.sql`)
- [ ] Auth + accounts; crew membership (currently handle-based; real auth still TODO)
- [x] Sync worker: pull feed -> normalize to `events` shape -> upsert, drop past events, honor 24h cache (`server/src/sync.js`; snapshot fallback until `EDMTRAIN_CLIENT_KEY` set)
- [x] Server-authoritative check-in endpoint: recompute distance in PostGIS, gate on geofence, award XP, update control ledger + badges + flip detection (`server/src/checkin.js`)
- [x] Territory decay job (scheduled control-point decay + fading per venue) (`server/src/decay.js`)
- [ ] Real `event_date` semantics beyond the snapshot; genre mapping table (`docs/DATA-SOURCES.md`)

## Phase 2: the app
- [ ] Port prototype UI to the chosen client; wire to the API
- [ ] Background geofence dwell detection (CLCircularRegion / Android Geofencing API)
- [ ] Friends / social graph; co-presence corroboration
- [ ] Anti-fraud phase 2: QR / BLE / ticket-link, mock-location + teleport detection

## Phase 3: depth
- [ ] Artist fandom territories
- [ ] Festival stage mode + live festival leaderboard
- [ ] Seasons, rewards, partnerships with venues/promoters

## Data model sketch (for Postgres)
- venue(id, name, hood, lat, lng, geofence_radius_m, ...)
- event(id, venue_id, date, src, source_url) ; event_artist(event_id, artist, genre, b2b_order)
- checkin(id, user_id, venue_id, event_id, artist, full_set, lat, lng, distance_m, verified, created_at)
- control_ledger(venue_id, crew_id, points, updated_at)  -- leader/share derived
- user(id, handle, crew_id, xp) ; badge(user_id, key, earned_at)
