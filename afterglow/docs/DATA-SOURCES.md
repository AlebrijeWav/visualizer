# Data sources

No single source covers NYC electronic nightlife — especially DIY/warehouse shows. Plan to stitch a
primary feed + supplements + direct submissions, and pull it all into our own DB via a sync worker.

## Options

### Edmtrain API  (recommended primary)
- Official, electronic-music-specific, free client API key, clean JSON.
- Query by `venueIds` / `artistIds` / location; lineups include back-to-back (b2b) flags.
- Docs: https://edmtrain.com/api-documentation  ·  Key: https://edmtrain.com/developer-api
- **Terms to respect (https://edmtrain.com/api-terms-of-use):**
  - May NOT combine Edmtrain events with other sources to build a competing **discovery** service.
  - Cached data must be **<24h** old when displayed; drop past events.
  - Must show their event link unmodified; can't sell/lease access; key is per-app, not shareable.
  - Implication: positioning Afterglow as a **check-in game** (not a discovery app) matters legally.
    Read the terms before integrating; consider emailing them about the use case.

### Resident Advisor (RA)  (supplement, gray area)
- No official public API. Site runs on an internal **GraphQL** endpoint (`POST https://ra.co/graphql`),
  and every event page embeds **JSON-LD** (`<script type="application/ld+json">`) with the full lineup.
- Richest underground/Brooklyn coverage, but scraping is ToS-gray and RA's own app is a competitor.
- Club IDs we already mapped are in `data/venues.json` (e.g. Pacha 105938, Knockdown 69401).

### Dice.fm  (supplement)
- Where a lot of Brooklyn DIY/club shows sell (Elsewhere, Public Records). No official public API.

### Others
- Ticketmaster Discovery API (official, broad, misses underground), Bandsintown/Songkick (artist-centric).

## Architecture: sync worker
- Scheduled job (e.g. hourly) hits the primary API server-side, normalizes to our `events` shape,
  upserts into Postgres. Honor the 24h cache rule.
- Normalized shape already used by the prototype:
  `event = { venueId, date, src, sourceUrl, artists: [ { name, genre } ] }`
- Where it plugs in: prototype `syncVenueEvents(id)` is the stub; its comments hold the real endpoints.
- **API keys live in server env only.** Never ship them to the client.

## Genre tagging
Edmtrain/RA don't always give a clean single genre. Plan a mapping layer (artist -> genre) seeded from
the APIs + a manual override table, since the discovery mechanic depends on genre buckets.
