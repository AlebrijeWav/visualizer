# Check-in verification

Fraud-resistance is the core of the product. Build it in phases; the prototype implements phase 1.

## Phase 1 — Geofence (implemented in prototype)
- Each venue has `lat`, `lng`, `geofenceRadius` (meters) in `data/venues.json`.
- Distance = **Haversine** between device location and venue. Allow check-in only when distance <= radius.
- Radius is tuned per venue: outdoor/large (Pacha 160m, Nowadays 120m) vs small club (Public Records 70m).
  Too tight = false rejects at the door; too loose = check-ins from the parking lot.
- **Dwell = the full-set bonus.** On a real device this is background region monitoring detecting
  ENTER + sustained presence, not a manual toggle:
  - iOS: `CLLocationManager` + `CLCircularRegion` region monitoring.
  - Android: Geofencing API (enter/dwell/exit transitions).
  - This background requirement is a strong reason to go **React Native / Expo** over a pure web PWA
    (browser geolocation can't reliably run in the background).
- Server-authoritative: the client reports location, the **server** recomputes distance and decides.
  Never grant XP/territory on the client's say-so alone.

## Known weakness
GPS is spoofable (mock-location apps, jailbreak tweaks). Phase 1 stops casual cheating, not determined
cheating. Don't ship territory stakes that matter (prizes, rankings with value) on phase 1 alone.

## Phase 2 — Layered proof (for full points / contested venues)
Combine signals; require more for higher-value rewards:
- On-site **QR / rotating code** at the door or on screens (server-issued, short-lived).
- **BLE beacon** in the venue the app must hear.
- **Ticket scan / linked ticketing** (Dice/RA/Edmtrain order) tying a real purchase to the check-in.
- Mock-location detection, device attestation, velocity/teleport checks (impossible travel between checks).
- Rate limits + anomaly detection on crew control swings.

## Phase 3 — Trust + social proof
- Friends co-present at the same event corroborate each other.
- Reputation weighting: established accounts' check-ins count more; new accounts ramp up.
