const form = document.getElementById('admin-form');
const msg = document.getElementById('admin-msg');
const listingList = document.getElementById('listing-list');

function rowHtml(listing) {
  return `
    <div class="admin-row" data-id="${listing.id}">
      <span>${escapeXml(listing.title)} — ${escapeXml(listing.neighborhood)} · $${listing.price.toLocaleString()}${listing.listing_type === 'rent' ? '/mo' : ''}</span>
      <button data-id="${listing.id}">Delete</button>
    </div>`;
}

async function loadList() {
  const listings = await api('/listings');
  listingList.innerHTML = listings.map(rowHtml).join('') || '<p style="color:var(--muted); font-family:Helvetica,sans-serif; font-size:14px;">No listings yet.</p>';
  listingList.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this listing?')) return;
      await api(`/listings/${btn.dataset.id}`, { method: 'DELETE' });
      loadList();
    });
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  msg.className = 'admin-msg';

  const payload = {
    title: document.getElementById('title').value,
    neighborhood: document.getElementById('neighborhood').value,
    property_type: document.getElementById('property_type').value,
    address: document.getElementById('address').value,
    listing_type: document.getElementById('listing_type').value,
    price: document.getElementById('price').value,
    beds: document.getElementById('beds').value,
    baths: document.getElementById('baths').value,
    sqft: document.getElementById('sqft').value || null,
    description: document.getElementById('description').value,
    featured: document.getElementById('featured').checked,
  };

  try {
    await api('/listings', { method: 'POST', body: JSON.stringify(payload) });
    msg.textContent = 'Listing published successfully.';
    msg.classList.add('ok');
    form.reset();
    loadList();
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('err');
  }
});

loadList();
