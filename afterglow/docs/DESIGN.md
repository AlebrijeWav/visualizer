# Design system

The prototype (`prototype/index.html`) is the visual source of truth. Keep these invariants.

## Signature idea
**Crews ARE the color palette.** The map reads as contested colored territory because each crew owns
exactly one saturated hue. Don't add a generic brand accent that competes with crew colors — the
"brand" is the dark canvas + the crew colors fighting over it.

## Crew colors (also in data/crews.json)
- Low End Theory (player) `#16E0C8` teal
- Sundown Society `#FF3D81` magenta
- After Hours Club `#B388FF` lilac
- Bassline Brigade `#FFB627` amber
- Warehouse Union `#9DFF3D` lime

## Surface tokens
- ink `#0B0A14`  ink2 `#15131F`  ink3 `#1F1B2E`  line `#2A2540`
- text `#ECEAF5`  dim `#8C84A8`

## Type
- Display (poster-condensed, big numbers, venue + crew names): **Anton**
- Body / UI: **Space Grotesk**
- Data / stats / coordinates: **Space Mono**

## Motion
Restrained: venue markers pulse; controlled venues glow; "fading" venues shimmer; geofence ring pings
when inside; reward pops once. Respect `prefers-reduced-motion`.

## Map
Leaflet + CARTO `dark_all` tiles (no key needed). Venues are `divIcon` markers colored by controlling
crew with a crown on venues the player's crew leads. Geofence is an `L.circle` (radius in meters);
venue dots are pixel-sized.
