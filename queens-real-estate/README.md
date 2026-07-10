# Queens Nest Realty

A real estate listings site for Queens, NYC — Node/Express + SQLite backend, plain HTML/CSS/JS frontend (no build step, no framework).

## Run it

```
cd queens-real-estate
npm install
npm run seed     # populates the SQLite db with sample Queens listings (first run only)
npm start        # serves the site + API on http://localhost:3000
```

Then open http://localhost:3000.

## Pages

- **`/index.html`** — browse listings, search by keyword, filter by neighborhood/type/beds/price, sort by price.
- **`/listing.html?id=N`** — listing detail page with photo gallery placeholder, stats, description, and a contact-the-agent inquiry form.
- **`/admin.html`** — add a new listing (published immediately) and delete existing ones.

## API

| Method | Path                          | Description                                   |
|--------|-------------------------------|------------------------------------------------|
| GET    | `/api/listings`                | List listings. Query params: `neighborhood`, `listing_type` (`sale`/`rent`), `minPrice`, `maxPrice`, `beds`, `q`, `sort` (`price_asc`/`price_desc`). |
| GET    | `/api/listings/:id`             | Single listing.                                |
| POST   | `/api/listings`                 | Create a listing.                              |
| PUT    | `/api/listings/:id`             | Update a listing.                              |
| DELETE | `/api/listings/:id`             | Delete a listing.                              |
| GET    | `/api/neighborhoods`            | List of Queens neighborhoods used for filters.  |
| POST   | `/api/listings/:id/inquiries`   | Submit a contact inquiry for a listing.         |

Data lives in `server/listings.db` (SQLite, created on first run).

## Listing photos

Listing images are generated client-side as deterministic SVGs keyed off each listing's `image_seed`, so every listing — including new ones added through the admin form — gets a distinct-looking placeholder without depending on any external image host.
