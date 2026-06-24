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
- [ ] Postgres + PostGIS schema: users, crews, venues, events, checkins, control_ledger
- [ ] Auth + accounts; crew membership
- [ ] Sync worker: pull Edmtrain/RA -> normalize to `events` shape -> upsert (honor 24h cache)
- [ ] Server-authoritative check-in endpoint: recompute Haversine, award XP, update control ledger
- [ ] Territory decay job (scheduled control-point decay per venue)

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
