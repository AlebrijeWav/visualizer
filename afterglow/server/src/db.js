import pg from "pg";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL is not set — copy .env.example to .env");
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const q = (text, params) => pool.query(text, params);

// Run a function inside a transaction with a dedicated client.
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
