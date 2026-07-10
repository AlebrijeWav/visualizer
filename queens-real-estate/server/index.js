const path = require('path');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const NEIGHBORHOODS = [
  'Astoria', 'Long Island City', 'Sunnyside', 'Ridgewood', 'Jackson Heights',
  'Elmhurst', 'Forest Hills', 'Rego Park', 'Flushing', 'Bayside', 'Douglaston',
];

function serializeListing(row) {
  return {
    ...row,
    featured: !!row.featured,
  };
}

// GET /api/listings?neighborhood=&type=&minPrice=&maxPrice=&beds=&q=
app.get('/api/listings', (req, res) => {
  const { neighborhood, listing_type, minPrice, maxPrice, beds, q, sort } = req.query;

  const clauses = [];
  const params = {};

  if (neighborhood) {
    clauses.push('neighborhood = @neighborhood');
    params.neighborhood = neighborhood;
  }
  if (listing_type && ['sale', 'rent'].includes(listing_type)) {
    clauses.push('listing_type = @listing_type');
    params.listing_type = listing_type;
  }
  if (minPrice) {
    clauses.push('price >= @minPrice');
    params.minPrice = Number(minPrice);
  }
  if (maxPrice) {
    clauses.push('price <= @maxPrice');
    params.maxPrice = Number(maxPrice);
  }
  if (beds) {
    clauses.push('beds >= @beds');
    params.beds = Number(beds);
  }
  if (q) {
    clauses.push('(title LIKE @q OR address LIKE @q OR neighborhood LIKE @q OR description LIKE @q)');
    params.q = `%${q}%`;
  }

  let orderBy = 'featured DESC, created_at DESC';
  if (sort === 'price_asc') orderBy = 'price ASC';
  if (sort === 'price_desc') orderBy = 'price DESC';

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM listings ${where} ORDER BY ${orderBy}`).all(params);

  res.json(rows.map(serializeListing));
});

app.get('/api/neighborhoods', (_req, res) => {
  res.json(NEIGHBORHOODS);
});

app.get('/api/listings/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Listing not found' });
  res.json(serializeListing(row));
});

app.post('/api/listings', (req, res) => {
  const b = req.body || {};
  const required = ['title', 'neighborhood', 'address', 'listing_type', 'property_type', 'price', 'beds', 'baths'];
  const missing = required.filter((f) => b[f] === undefined || b[f] === '');
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }
  if (!['sale', 'rent'].includes(b.listing_type)) {
    return res.status(400).json({ error: 'listing_type must be "sale" or "rent"' });
  }

  const info = db.prepare(`
    INSERT INTO listings
      (title, neighborhood, address, listing_type, property_type, price, beds, baths, sqft, description, image_seed, lat, lng, featured)
    VALUES
      (@title, @neighborhood, @address, @listing_type, @property_type, @price, @beds, @baths, @sqft, @description, @image_seed, @lat, @lng, @featured)
  `).run({
    title: b.title,
    neighborhood: b.neighborhood,
    address: b.address,
    listing_type: b.listing_type,
    property_type: b.property_type,
    price: Number(b.price),
    beds: Number(b.beds),
    baths: Number(b.baths),
    sqft: b.sqft ? Number(b.sqft) : null,
    description: b.description || '',
    image_seed: b.image_seed || b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    lat: b.lat ? Number(b.lat) : null,
    lng: b.lng ? Number(b.lng) : null,
    featured: b.featured ? 1 : 0,
  });

  const created = db.prepare('SELECT * FROM listings WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serializeListing(created));
});

app.put('/api/listings/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Listing not found' });

  const b = req.body || {};
  const merged = {
    title: b.title ?? existing.title,
    neighborhood: b.neighborhood ?? existing.neighborhood,
    address: b.address ?? existing.address,
    listing_type: b.listing_type ?? existing.listing_type,
    property_type: b.property_type ?? existing.property_type,
    price: b.price !== undefined ? Number(b.price) : existing.price,
    beds: b.beds !== undefined ? Number(b.beds) : existing.beds,
    baths: b.baths !== undefined ? Number(b.baths) : existing.baths,
    sqft: b.sqft !== undefined ? Number(b.sqft) : existing.sqft,
    description: b.description ?? existing.description,
    image_seed: b.image_seed ?? existing.image_seed,
    lat: b.lat !== undefined ? Number(b.lat) : existing.lat,
    lng: b.lng !== undefined ? Number(b.lng) : existing.lng,
    featured: b.featured !== undefined ? (b.featured ? 1 : 0) : existing.featured,
    id: existing.id,
  };

  db.prepare(`
    UPDATE listings SET
      title=@title, neighborhood=@neighborhood, address=@address, listing_type=@listing_type,
      property_type=@property_type, price=@price, beds=@beds, baths=@baths, sqft=@sqft,
      description=@description, image_seed=@image_seed, lat=@lat, lng=@lng, featured=@featured
    WHERE id=@id
  `).run(merged);

  const updated = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  res.json(serializeListing(updated));
});

app.delete('/api/listings/:id', (req, res) => {
  const info = db.prepare('DELETE FROM listings WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Listing not found' });
  res.status(204).end();
});

app.post('/api/listings/:id/inquiries', (req, res) => {
  const listing = db.prepare('SELECT id FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const { name, email, phone, message } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const info = db.prepare(`
    INSERT INTO inquiries (listing_id, name, email, phone, message)
    VALUES (@listing_id, @name, @email, @phone, @message)
  `).run({ listing_id: req.params.id, name, email, phone: phone || null, message: message || null });

  res.status(201).json({ id: info.lastInsertRowid });
});

app.listen(PORT, () => {
  console.log(`Queens real estate server running on http://localhost:${PORT}`);
});
