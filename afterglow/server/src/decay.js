// Territory decay job. Control must be earned continuously: a venue your crew
// stops showing up to slowly bleeds points and starts "fading" on the map.
// This is the scheduled counterpart to the check-in's control gain.
import { pool } from "./db.js";

// Tunables. With a daily run, 3% bleed ~= half-life of about 3 weeks of silence.
export const DECAY = {
  GRACE_DAYS: 3,    // no decay for venues active within this window
  FADE_DAYS: 14,    // venues silent this long render as "fading"
  RATE: 0.03,       // fraction of points removed per run for inactive venues
};

export async function decayTick() {
  // Bleed control at venues with no recent activity (or never active).
  const bled = await pool.query(
    `UPDATE control_ledger cl
        SET points = points * (1 - $1::numeric), updated_at = now()
       FROM venue v
      WHERE v.id = cl.venue_id
        AND (v.last_active IS NULL OR v.last_active < now() - make_interval(days => $2::int))`,
    [DECAY.RATE, DECAY.GRACE_DAYS]
  );

  // Mark venues fading once they've been silent past the fade threshold.
  await pool.query(
    `UPDATE venue
        SET fading = (last_active IS NULL OR last_active < now() - make_interval(days => $1::int))`,
    [DECAY.FADE_DAYS]
  );

  console.log(`[decay] bled control at ${bled.rowCount} (venue,crew) rows`);
  return bled.rowCount;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  decayTick().then(() => pool.end());
}
