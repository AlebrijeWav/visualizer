const form = document.getElementById('filter-form');
const grid = document.getElementById('grid');
const resultsCount = document.getElementById('results-count');
const resultsTitle = document.getElementById('results-title');
const sortSelect = document.getElementById('sort-select');
const neighborhoodSelect = document.getElementById('neighborhood-select');

function currentParams() {
  const fd = new FormData(form);
  const params = Object.fromEntries(fd.entries());
  params.sort = sortSelect.value;
  return params;
}

function cardHtml(listing) {
  const img = placeholderImage(listing.image_seed, listing.neighborhood);
  const typeBadge = listing.listing_type === 'rent'
    ? '<span class="badge rent">For Rent</span>'
    : '<span class="badge">For Sale</span>';
  const featuredBadge = listing.featured ? '<span class="badge featured">Featured</span>' : '';
  return `
    <a class="card" href="listing.html?id=${listing.id}">
      <div class="card-media">
        <img src="${img}" alt="${escapeXml(listing.title)}" loading="lazy" />
        ${featuredBadge}
        ${typeBadge}
      </div>
      <div class="card-body">
        <div class="card-price">${formatPrice(listing)}</div>
        <div class="card-title">${escapeXml(listing.title)}</div>
        <div class="card-address">${escapeXml(listing.address)}</div>
        <div class="card-stats">
          <span>${formatBeds(listing.beds)}</span>
          <span>${listing.baths} ba</span>
          ${listing.sqft ? `<span>${listing.sqft.toLocaleString()} sqft</span>` : ''}
        </div>
      </div>
    </a>`;
}

async function loadNeighborhoods() {
  const list = await api('/neighborhoods');
  for (const n of list) {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    neighborhoodSelect.appendChild(opt);
  }
  const urlParams = new URLSearchParams(location.search);
  if (urlParams.get('neighborhood')) neighborhoodSelect.value = urlParams.get('neighborhood');
  if (urlParams.get('listing_type')) form.listing_type.value = urlParams.get('listing_type');
}

async function loadListings() {
  grid.innerHTML = '<div class="empty-state">Loading listings…</div>';
  const params = currentParams();
  try {
    const listings = await api('/listings' + qs(params));
    if (!listings.length) {
      grid.innerHTML = '<div class="empty-state">No listings match your search. Try widening your filters.</div>';
      resultsCount.textContent = '';
      return;
    }
    grid.innerHTML = listings.map(cardHtml).join('');
    resultsCount.textContent = `${listings.length} listing${listings.length === 1 ? '' : 's'}`;
    resultsTitle.textContent = params.neighborhood ? `Listings in ${params.neighborhood}` : 'All listings';
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Something went wrong loading listings: ${escapeXml(err.message)}</div>`;
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  loadListings();
});
sortSelect.addEventListener('change', loadListings);

(async function init() {
  await loadNeighborhoods();
  loadListings();
})();
