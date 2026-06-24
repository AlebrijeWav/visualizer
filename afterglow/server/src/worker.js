// Background worker: keeps the event cache fresh (<24h, per Edmtrain terms) and
// applies territory decay on a schedule. For a single-process dev setup this is
// fine; in production prefer a real scheduler (pg_cron, or a cron-triggered
// invocation of `npm run sync` / `npm run decay`) so the API stays stateless.
import { pool } from "./db.js";
import { syncAll } from "./sync.js";
import { decayTick } from "./decay.js";

const HOUR = 3600_000;
const SYNC_EVERY = 1 * HOUR;     // well under the 24h freshness rule
const DECAY_EVERY = 24 * HOUR;   // decay constants in decay.js assume ~daily

async function safe(label, fn) {
  try { await fn(); } catch (err) { console.error(`[worker] ${label} failed:`, err.message); }
}

console.log("[worker] starting — running sync + decay once, then on interval");
await safe("sync", syncAll);
await safe("decay", decayTick);

setInterval(() => safe("sync", syncAll), SYNC_EVERY);
setInterval(() => safe("decay", decayTick), DECAY_EVERY);

const shutdown = async () => { await pool.end(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
