const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'listings.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    neighborhood TEXT NOT NULL,
    address TEXT NOT NULL,
    listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
    property_type TEXT NOT NULL,
    price INTEGER NOT NULL,
    beds INTEGER NOT NULL,
    baths REAL NOT NULL,
    sqft INTEGER,
    description TEXT,
    image_seed TEXT NOT NULL,
    lat REAL,
    lng REAL,
    featured INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

module.exports = db;
