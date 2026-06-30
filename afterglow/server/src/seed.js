// Seed the DB from the verified snapshot in ../data. Idempotent (upserts), so
// it doubles as a "reset to snapshot" for development. In production this data
// comes from the sync worker (see sync.js / docs/DATA-SOURCES.md), not here.
import { readFile } from "node:fs/promises";
import { pool, tx } from "./db.js";

const read = async (rel) =>
  JSON.parse(await readFile(new URL(rel, import.meta.url), "utf8"));

async function main() {
  const crewsDoc = await read("../../data/crews.json");
  const venuesDoc = await read("../../data/venues.json");
  const crews = crewsDoc.crews;
  const venues = venuesDoc.venues;

  await tx(async (c) => {
    // crews
    for (const [id, cr] of Object.entries(crews)) {
      await c.query(
        `INSERT INTO crew (id, name, short, color) VALUES ($1,$2,$3,$4)
         ON CONFLICT (id) DO UPDATE SET name=$2, short=$3, color=$4`,
        [id, cr.name, cr.short, cr.color]
      );
    }

    // venues + control ledger + events
    for (const v of venues) {
      await c.query(
        `INSERT INTO venue (id, name, alias, hood, cap, address, geofence_radius_m, geog, fading)
         VALUES ($1,$2,$3,$4,$5,$6,$7, ST_SetSRID(ST_MakePoint($8,$9),4326)::geography, $10)
         ON CONFLICT (id) DO UPDATE SET
           name=$2, alias=$3, hood=$4, cap=$5, address=$6, geofence_radius_m=$7,
           geog=ST_SetSRID(ST_MakePoint($8,$9),4326)::geography, fading=$10`,
        [v.id, v.name, v.alias ?? null, v.hood ?? null, v.cap ?? null, v.address ?? null,
         v.geofenceRadius, v.lng, v.lat, !!v.fading]
      );

      for (const [crewId, points] of Object.entries(v.control || {})) {
        await c.query(
          `INSERT INTO control_ledger (venue_id, crew_id, points) VALUES ($1,$2,$3)
           ON CONFLICT (venue_id, crew_id) DO UPDATE SET points=$3, updated_at=now()`,
          [v.id, crewId, points]
        );
      }

      for (const e of v.events || []) {
        const { rows } = await c.query(
          `INSERT INTO event (venue_id, event_date, src, source_url) VALUES ($1,$2,$3,$4)
           ON CONFLICT (venue_id, event_date, src)
             DO UPDATE SET source_url=EXCLUDED.source_url, synced_at=now()
           RETURNING id`,
          [v.id, e.date, e.src, e.sourceUrl ?? null]
        );
        const eventId = rows[0].id;
        for (let i = 0; i < e.artists.length; i++) {
          const a = e.artists[i];
          await c.query(
            `INSERT INTO event_artist (event_id, artist, genre, b2b_order) VALUES ($1,$2,$3,$4)
             ON CONFLICT (event_id, artist) DO UPDATE SET genre=$3, b2b_order=$4`,
            [eventId, a.name, a.genre ?? null, e.artists.length > 1 ? i : null]
          );
        }
      }
    }

    // demo player + seeded history so "first time" bonuses are testable
    const playerCrew = crewsDoc.playerCrew;
    const you = await upsertUser(c, "you", playerCrew, 640);
    await seedCheckin(c, you, "elsewhere", "Loud Luxury", "house");
    await seedCheckin(c, you, "goodroom", "Mister Sunday", "disco");

    // venue mayors from the snapshot become real users (top contributor),
    // each placed in that venue's leading crew so the mayor is derivable.
    for (const v of venues) {
      if (!v.mayor || v.mayor === "you") continue;
      const leadCrew = Object.entries(v.control).sort((a, b) => b[1] - a[1])[0][0];
      const u = await upsertUser(c, v.mayor, leadCrew, 1200);
      // 3 checkins so they out-contribute the demo player at that venue
      for (let i = 0; i < 3; i++) {
        const first = (v.events[0]?.artists[0]) || { name: null, genre: null };
        await seedCheckin(c, u, v.id, first.name, first.genre);
      }
    }
  });

  console.log("Seed complete.");
  await pool.end();
}

async function upsertUser(c, handle, crewId, xp) {
  const { rows } = await c.query(
    `INSERT INTO app_user (handle, crew_id, xp) VALUES ($1,$2,$3)
     ON CONFLICT (handle) DO UPDATE SET crew_id=$2, xp=$3
     RETURNING id`,
    [handle, crewId, xp]
  );
  return rows[0].id;
}

// A verified historical check-in at the venue's exact coords (distance 0).
async function seedCheckin(c, userId, venueId, artist, genre) {
  const { rows } = await c.query(
    `SELECT ST_Y(geog::geometry) AS lat, ST_X(geog::geometry) AS lng FROM venue WHERE id=$1`,
    [venueId]
  );
  if (!rows[0]) return;
  await c.query(
    `INSERT INTO checkin (user_id, venue_id, artist, genre, full_set, lat, lng, distance_m, verified, xp_awarded)
     VALUES ($1,$2,$3,$4,true,$5,$6,0,true,0)`,
    [userId, venueId, artist, genre, rows[0].lat, rows[0].lng]
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
