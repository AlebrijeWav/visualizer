// XP + level rules. Single source of truth, mirroring the prototype's claim()
// so the server awards exactly what the UI was mocking. The prototype is the
// UX source of truth; this is the authoritative scorer.

export const XP = {
  CHECKIN: 50,        // checked in (geofence verified)
  FULL_SET: 25,       // stayed for the full set (dwell)
  NEW_ARTIST: 30,     // first time seeing this artist live
  NEW_VENUE: 40,      // first check-in at this venue
  NEW_GENRE: 35,      // first time in this genre
};

// Control points added to the checker-in's crew on a verified check-in.
export const CONTROL_POINTS = { FULL_SET: 12, PARTIAL: 6 };

export const LEVELS = [0, 200, 500, 900, 1500, 2400, 3600];
export const RANKS = [
  "Newcomer", "Regular", "Resident", "Headliner",
  "Local Legend", "Nightmayor", "Citywide Icon",
];

export function levelFor(xp) {
  let l = 1;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) l = i + 1;
  return l;
}

export function rankFor(xp) {
  return RANKS[Math.min(levelFor(xp), RANKS.length) - 1];
}

// Build the itemized XP breakdown for a verified check-in.
// `firsts` = { artist:bool, venue:bool, genre:bool }
export function scoreCheckin({ fullSet, firsts, artist, genreLabel }) {
  const lines = [{ label: "Checked in (geofence verified)", points: XP.CHECKIN }];
  if (fullSet) lines.push({ label: "Stayed full set", points: XP.FULL_SET });
  if (firsts.artist) lines.push({ label: `First time: ${artist}`, points: XP.NEW_ARTIST });
  if (firsts.venue) lines.push({ label: "New venue captured", points: XP.NEW_VENUE });
  if (firsts.genre) lines.push({ label: `Discovered ${genreLabel}`, points: XP.NEW_GENRE });
  const total = lines.reduce((a, b) => a + b.points, 0);
  return { lines, total };
}
