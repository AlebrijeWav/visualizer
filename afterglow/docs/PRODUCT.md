# Product

## Pitch
A game layer over going out to electronic-music events. Raving already has the ingredients fitness
apps fake: tribal artist fandoms, collecting behavior ("seen 50 artists this year"), and status
("been to 20 venues"). Afterglow turns that into territory you and your crew fight for on a city map.

## The five mechanics
1. **Venue territory control** — checking in earns control points for your crew. Top contributor at a
   venue is its **mayor**. Control **decays** if your crew stops attending, so you have to keep showing
   up. Rival crews contest each venue. (Foursquare's mayor mechanic + a control meter.)
2. **Artist fandom territories** — capture territory for artists; cities skew toward different artists.
3. **Festival stage gameplay** — at festivals, stages become contested zones; full-set dwell + bonuses
   for discovering smaller artists; live leaderboard during the event.
4. **Music discovery** — XP for first-time genres/venues/artists; badges for house/techno/disco/bass/DnB.
5. **City-vs-city crew wars** — NYC vs Chicago vs Denver, monthly seasons.

## Why it can work
The activity (going out) already exists and is social, repeat, and identity-driven. The game doesn't
have to manufacture motivation — it has to capture and amplify it.

## Hardest problems (decide deliberately)
- **Check-in fraud** is the whole product. If people can fake attendance, territory is meaningless.
  Geofence is phase 1; layered proof is phase 2 (see VERIFICATION.md).
- **Cold start.** Empty maps are dead maps. Seed ONE scene hard (Brooklyn house/techno, the 6 venues
  in data/) rather than launching citywide.
- **Underground coverage.** No single feed has DIY/warehouse shows; data is a stitched problem.

## Thinnest real MVP
Check in (geofence-verified) -> log artist + venue -> earn XP -> see friends' stats. Territory control
is the hook, but you can validate whether ravers want to log shows at all before building crew warfare.
