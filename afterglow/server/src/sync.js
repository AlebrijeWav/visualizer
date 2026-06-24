// Sync worker. Pulls upcoming events from the primary feed, normalizes them to
// our event shape, and upserts into Postgres. Honors the data-source terms in
// docs/DATA-SOURCES.md: keep cache <24h fresh and DROP past events.
//
// The real fetch is server-side ONLY (keys never reach the client). Until a key
// is configured, fetchVenueEvents() falls back to the verified snapshot in
// ../data so the pipeline is runnable end-to-end.
import { readFile } from "node:fs/promises";
import { pool, tx } from "./db.js";

// Normalized shape (same one the prototype's syncVenueEvents stub returns):
//   { date: 'YYYY-MM-DD', src, sourceUrl?, artists: [ { name, genre } ] }

async function fetchFromEdmtrain(venueId) {
  // GET https://edmtrain.com/api/events?venueIds={id}&client={KEY}
  // Map Edmtrain's response -> normalized shape here. Requires EDMTRAIN_CLIENT_KEY.
  throw new Error("edmtrain fetch not implemented — set EDMTRAIN_CLIENT_KEY and map the response");
}

// Snapshot fallback so the worker runs without external calls / keys.
async function fetchFromSnapshot(venueId) {
  const doc = JSON.parse(
    await readFile(new URL("../../data/venues.json", import.meta.url), "utf8")
  );
  const v = doc.venues.find((x) => x.id === venueId);
  return (v?.events || []).map((e) => ({
    date: e.date, src: e.src, sourceUrl: e.sourceUrl ?? null, artists: e.artists,
  }));
}

export async function fetchVenueEvents(venueId) {
  if (process.env.EDMTRAIN_CLIENT_KEY) return fetchFromEdmtrain(venueId);
  return fetchFromSnapshot(venueId);
}

export async function syncVenue(venueId) {
  const events = await fetchVenueEvents(venueId);
  let upserts = 0;
  await tx(async (c) => {
    for (const e of events) {
      const { rows } = await c.query(
        `INSERT INTO event (venue_id, event_date, src, source_url) VALUES ($1,$2,$3,$4)
         ON CONFLICT (venue_id, event_date, src)
           DO UPDATE SET source_url=EXCLUDED.source_url, synced_at=now()
         RETURNING id`,
        [venueId, e.date, e.src, e.sourceUrl]
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
      upserts++;
    }
    // Terms: drop past events so we never display stale lineups.
    await c.query(`DELETE FROM event WHERE venue_id=$1 AND event_date < current_date`, [venueId]);
  });
  return upserts;
}

export async function syncAll() {
  const { rows } = await pool.query(`SELECT id FROM venue`);
  let total = 0;
  for (const { id } of rows) {
    try {
      total += await syncVenue(id);
    } catch (err) {
      console.error(`[sync] ${id} failed:`, err.message);
    }
  }
  console.log(`[sync] upserted ${total} events across ${rows.length} venues`);
  return total;
}

// Allow `npm run sync` as a one-shot.
if (import.meta.url === `file://${process.argv[1]}`) {
  syncAll().then(() => pool.end());
}
