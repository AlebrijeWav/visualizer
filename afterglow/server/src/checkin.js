// Server-authoritative check-in. The client reports its location, but the
// SERVER recomputes the distance (PostGIS) and decides verification, XP, and
// territory. Never trust client-reported distance. (docs/VERIFICATION.md)
import { tx } from "./db.js";
import { scoreCheckin, CONTROL_POINTS, levelFor, rankFor } from "./scoring.js";

export class CheckinError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

const GENRE_LABEL = {
  house: "House", techno: "Techno", disco: "Disco",
  bass: "Bass", dnb: "Drum & Bass",
};

export async function performCheckin({ handle, venueId, eventId = null, artist = null, fullSet = false, lat, lng }) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new CheckinError(400, "bad_location", "lat and lng are required numbers");
  }

  return tx(async (c) => {
    const user = (await c.query(`SELECT id, crew_id, xp FROM app_user WHERE handle=$1`, [handle])).rows[0];
    if (!user) throw new CheckinError(404, "no_user", `unknown user @${handle}`);
    if (!user.crew_id) throw new CheckinError(409, "no_crew", "join a crew before checking in");

    // Authoritative distance + geofence gate, computed in the DB.
    const v = (await c.query(
      `SELECT id, name, hood, geofence_radius_m AS radius,
              ST_Distance(geog, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography) AS dist
       FROM venue WHERE id=$1`,
      [venueId, lng, lat]
    )).rows[0];
    if (!v) throw new CheckinError(404, "no_venue", `unknown venue ${venueId}`);

    const distance = Math.round(v.dist);
    const verified = distance <= v.radius;

    if (!verified) {
      // Record the rejected attempt for anti-fraud analytics; award nothing.
      await c.query(
        `INSERT INTO checkin (user_id, venue_id, event_id, artist, full_set, lat, lng, distance_m, verified, xp_awarded)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,0)`,
        [user.id, venueId, eventId, artist, fullSet, lat, lng, distance]
      );
      throw new CheckinError(403, "out_of_range",
        `${distance - v.radius}m outside the ${v.radius}m geofence`,
        { distance, radius: v.radius });
    }

    // Resolve genre from the lineup; fall back to any known genre for the artist.
    let genre = null;
    if (artist) {
      genre = (await c.query(
        `SELECT genre FROM event_artist ea
         JOIN event e ON e.id = ea.event_id
         WHERE ea.artist=$1 AND ($2::bigint IS NULL OR ea.event_id=$2) AND e.venue_id=$3
         LIMIT 1`,
        [artist, eventId, venueId]
      )).rows[0]?.genre ?? null;
    }

    // "First time" detection from this user's verified history.
    const firsts = {
      artist: artist ? !(await seen(c, user.id, "artist", artist)) : false,
      venue: !(await seenVenue(c, user.id, venueId)),
      genre: genre ? !(await seen(c, user.id, "genre", genre)) : false,
    };

    const { lines, total } = scoreCheckin({
      fullSet, firsts, artist,
      genreLabel: GENRE_LABEL[genre] || genre,
    });

    // Territory: who led before vs after this crew's points land.
    const leaderBefore = await leader(c, venueId);
    const add = fullSet ? CONTROL_POINTS.FULL_SET : CONTROL_POINTS.PARTIAL;
    await c.query(
      `INSERT INTO control_ledger (venue_id, crew_id, points) VALUES ($1,$2,$3)
       ON CONFLICT (venue_id, crew_id) DO UPDATE SET points=control_ledger.points+$3, updated_at=now()`,
      [venueId, user.crew_id, add]
    );
    await c.query(`UPDATE venue SET last_active=now(), fading=false WHERE id=$1`, [venueId]);
    const leaderAfter = await leader(c, venueId);
    const flipped = leaderBefore !== user.crew_id && leaderAfter === user.crew_id;

    // Persist the verified check-in + XP.
    await c.query(
      `INSERT INTO checkin (user_id, venue_id, event_id, artist, genre, full_set, lat, lng, distance_m, verified, xp_awarded)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10)`,
      [user.id, venueId, eventId, artist, genre, fullSet, lat, lng, distance, total]
    );
    const newXp = user.xp + total;
    await c.query(`UPDATE app_user SET xp=$2 WHERE id=$1`, [user.id, newXp]);

    // Badges (mirrors the prototype's earn rules).
    const earned = [];
    if (firsts.genre && genre === "techno") earned.push("Techno Tourist");
    if (firsts.venue && v.hood) earned.push(`${v.hood.split(",")[0]} Pioneer`);
    if (flipped) earned.push(`Took ${v.name}`);
    for (const key of earned) {
      await c.query(
        `INSERT INTO badge (user_id, key) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [user.id, key]
      );
    }

    const share = await shareOf(c, venueId, user.crew_id);
    return {
      verified: true,
      venue: { id: v.id, name: v.name },
      artist,
      distanceM: distance,
      xpGained: total,
      lines,
      totalXp: newXp,
      level: levelFor(newXp),
      rank: rankFor(newXp),
      flipped,
      share,
      crew: user.crew_id,
      badges: earned,
    };
  });
}

async function seen(c, userId, col, val) {
  const r = await c.query(
    `SELECT 1 FROM checkin WHERE user_id=$1 AND verified AND ${col === "artist" ? "artist" : "genre"}=$2 LIMIT 1`,
    [userId, val]
  );
  return r.rowCount > 0;
}
async function seenVenue(c, userId, venueId) {
  const r = await c.query(
    `SELECT 1 FROM checkin WHERE user_id=$1 AND verified AND venue_id=$2 LIMIT 1`,
    [userId, venueId]
  );
  return r.rowCount > 0;
}
async function leader(c, venueId) {
  const r = await c.query(
    `SELECT crew_id FROM control_ledger WHERE venue_id=$1 ORDER BY points DESC LIMIT 1`,
    [venueId]
  );
  return r.rows[0]?.crew_id ?? null;
}
async function shareOf(c, venueId, crewId) {
  // Total is computed over ALL crews at the venue, then we pick our crew's row.
  // (Filtering by crew_id before a window SUM would make the share always 100%.)
  const r = await c.query(
    `SELECT round(100 * cl.points / NULLIF(t.total,0)) AS pct
     FROM control_ledger cl
     CROSS JOIN (SELECT SUM(points) AS total FROM control_ledger WHERE venue_id=$1) t
     WHERE cl.venue_id=$1 AND cl.crew_id=$2`,
    [venueId, crewId]
  );
  return r.rows[0]?.pct != null ? Number(r.rows[0].pct) : null;
}
