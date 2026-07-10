// Shared helpers used across pages.

const PALETTES = [
  ['#b5502e', '#e0a370'],
  ['#3a5a45', '#8fb89c'],
  ['#22506b', '#7fb3d5'],
  ['#6b3fa0', '#c9a8e8'],
  ['#7a5c2e', '#e0c088'],
  ['#5a2e3f', '#c98fa3'],
];

function hashSeed(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Deterministic SVG "photo" placeholder generated from a listing's image_seed,
// so every listing (including ones added via the admin form) gets a stable,
// distinct-looking card image without depending on any external image host.
function placeholderImage(seed, label) {
  const h = hashSeed(seed || 'default');
  const [c1, c2] = PALETTES[h % PALETTES.length];
  if (label && label.length > 18) label = label.slice(0, 17) + '…';
  const rows = 3 + (h % 3);
  const buildings = [];
  const width = 400, height = 300;
  const bw = width / rows;
  for (let i = 0; i < rows; i++) {
    const bh = 60 + ((h >> (i + 2)) % 140);
    const x = i * bw;
    const y = height - bh;
    buildings.push(`<rect x="${x + 4}" y="${y}" width="${bw - 8}" height="${bh}" fill="rgba(255,255,255,0.16)" rx="2"/>`);
  }
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  ${buildings.join('')}
  <text x="${width / 2}" y="${height - 18}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="rgba(255,255,255,0.9)" letter-spacing="1">${escapeXml(label || '')}</text>
</svg>`.trim();
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function escapeXml(str) {
  return String(str).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function formatPrice(listing) {
  const n = listing.price.toLocaleString('en-US');
  return listing.listing_type === 'rent' ? `$${n}<span class="period">/mo</span>` : `$${n}`;
}

function formatBeds(beds) {
  return beds === 0 ? 'Studio' : `${beds} bd`;
}

async function api(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.set(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}
