// Afterglow Phase 1 API. Read endpoints feed the map/passport/wars views;
// POST /checkin is the one write that matters and is server-authoritative.
import express from "express";
import "dotenv/config";
import { pool } from "./db.js";
import { performCheckin, CheckinError } from "./checkin.js";
import { levelFor, rankFor } from "./scoring.js";

const app = express();
app.use(express.json());

// Permissive CORS for local dev so the static prototype (served on another
// port / file origin) can call the API. Lock this down before any deploy.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "content-type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  if (err instanceof CheckinError) {
    return res.status(err.status).json({ error: err.code, message: err.message, ...err.extra });
  }
  console.error(err);
  res.status(500).json({ error: "internal", message: err.message });
});

app.get("/health", wrap(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
}));

// All venues with derived control (leader crew, share, fading) for the map.
app.get("/venues", wrap(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT v.id, v.name, v.alias, v.hood, v.cap, v.fading, v.geofence_radius_m AS radius,
           ST_Y(v.geog::geometry) AS lat, ST_X(v.geog::geometry) AS lng,
           led.crew_id AS leader, cr.color AS leader_color,
           round(100 * led.points / NULLIF(tot.total,0)) AS leader_share
    FROM venue v
    LEFT JOIN LATERAL (
      SELECT crew_id, points FROM control_ledger WHERE venue_id=v.id ORDER BY points DESC LIMIT 1
    ) led ON true
    LEFT JOIN crew cr ON cr.id = led.crew_id
    LEFT JOIN LATERAL (
      SELECT SUM(points) AS total FROM control_ledger WHERE venue_id=v.id
    ) tot ON true
    ORDER BY v.name`);
  res.json(rows);
}));

// One venue: full control breakdown + mayor + upcoming lineup.
app.get("/venues/:id", wrap(async (req, res) => {
  const id = req.params.id;
  const venue = (await pool.query(
    `SELECT id, name, alias, hood, cap, address, fading, geofence_radius_m AS radius,
            ST_Y(geog::geometry) AS lat, ST_X(geog::geometry) AS lng
     FROM venue WHERE id=$1`, [id])).rows[0];
  if (!venue) return res.status(404).json({ error: "no_venue" });

  const control = (await pool.query(
    `SELECT cl.crew_id, cr.name, cr.color, cl.points,
            round(100 * cl.points / NULLIF(SUM(cl.points) OVER (),0)) AS share
     FROM control_ledger cl JOIN crew cr ON cr.id=cl.crew_id
     WHERE cl.venue_id=$1 ORDER BY cl.points DESC`, [id])).rows;

  // Mayor = top contributor (most verified check-ins) at this venue.
  const mayor = (await pool.query(
    `SELECT u.handle, count(*) AS checkins
     FROM checkin c JOIN app_user u ON u.id=c.user_id
     WHERE c.venue_id=$1 AND c.verified
     GROUP BY u.handle ORDER BY count(*) DESC LIMIT 1`, [id])).rows[0]?.handle ?? null;

  const events = (await pool.query(
    `SELECT e.id, e.event_date, e.src, e.source_url,
            json_agg(json_build_object('name', ea.artist, 'genre', ea.genre)
                     ORDER BY ea.b2b_order NULLS FIRST) AS artists
     FROM event e LEFT JOIN event_artist ea ON ea.event_id=e.id
     WHERE e.venue_id=$1 AND e.event_date >= current_date
     GROUP BY e.id ORDER BY e.event_date`, [id])).rows;

  res.json({ ...venue, control, mayor, events });
}));

// Passport for one user.
app.get("/users/:handle", wrap(async (req, res) => {
  const u = (await pool.query(
    `SELECT id, handle, crew_id, xp FROM app_user WHERE handle=$1`, [req.params.handle])).rows[0];
  if (!u) return res.status(404).json({ error: "no_user" });
  const stats = (await pool.query(
    `SELECT count(DISTINCT artist)   FILTER (WHERE artist IS NOT NULL)   AS artists,
            count(DISTINCT venue_id)                                     AS venues,
            count(DISTINCT genre)    FILTER (WHERE genre IS NOT NULL)    AS genres
     FROM checkin WHERE user_id=$1 AND verified`, [u.id])).rows[0];
  const badges = (await pool.query(
    `SELECT key FROM badge WHERE user_id=$1 ORDER BY earned_at`, [u.id])).rows.map((r) => r.key);
  const seenArtists = (await pool.query(
    `SELECT DISTINCT artist FROM checkin WHERE user_id=$1 AND verified AND artist IS NOT NULL`,
    [u.id])).rows.map((r) => r.artist);
  res.json({
    handle: u.handle, crew: u.crew_id, xp: u.xp,
    level: levelFor(u.xp), rank: rankFor(u.xp),
    artists: Number(stats.artists), venues: Number(stats.venues), genres: Number(stats.genres),
    seenArtists, badges,
  });
}));

// Crew wars: total control held across all venues, per crew.
app.get("/wars", wrap(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT cr.id, cr.name, cr.color, COALESCE(SUM(cl.points),0) AS points
     FROM crew cr LEFT JOIN control_ledger cl ON cl.crew_id=cr.id
     GROUP BY cr.id ORDER BY points DESC`);
  res.json(rows);
}));

// The one authoritative write.
app.post("/checkin", wrap(async (req, res) => {
  const { handle, venueId, eventId, artist, fullSet, lat, lng } = req.body || {};
  if (!handle || !venueId) {
    return res.status(400).json({ error: "bad_request", message: "handle and venueId are required" });
  }
  const result = await performCheckin({ handle, venueId, eventId, artist, fullSet: !!fullSet, lat, lng });
  res.json(result);
}));

const PORT = process.env.PORT || 8787;
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => console.log(`Afterglow API on :${PORT}`));
}

export default app;
