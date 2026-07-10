const content = document.getElementById('content');

function getId() {
  return new URLSearchParams(location.search).get('id');
}

function renderListing(listing) {
  document.title = `${listing.title} — Queens Nest Realty`;
  const mainImg = placeholderImage(listing.image_seed, listing.neighborhood);
  const sideImg1 = placeholderImage(listing.image_seed + '-b', listing.property_type);
  const sideImg2 = placeholderImage(listing.image_seed + '-c', listing.address.split(',')[0]);

  content.innerHTML = `
    <div class="container">
      <div class="detail-gallery">
        <div class="main-img"><img src="${mainImg}" alt="${escapeXml(listing.title)}"></div>
        <div class="side-imgs">
          <img src="${sideImg1}" alt="">
          <img src="${sideImg2}" alt="">
        </div>
      </div>
    </div>

    <div class="detail-body container">
      <div class="detail-main">
        <h1>${escapeXml(listing.title)}</h1>
        <div class="detail-address">${escapeXml(listing.address)} &middot; ${escapeXml(listing.neighborhood)}, Queens</div>
        <div class="detail-price">${formatPrice(listing).replace('<span', '<span style="font-size:14px"')}</div>

        <div class="stat-row">
          <div><span class="stat-num">${formatBeds(listing.beds)}</span><span class="stat-label">Bedrooms</span></div>
          <div><span class="stat-num">${listing.baths}</span><span class="stat-label">Bathrooms</span></div>
          ${listing.sqft ? `<div><span class="stat-num">${listing.sqft.toLocaleString()}</span><span class="stat-label">Sq Ft</span></div>` : ''}
          <div><span class="stat-num">${escapeXml(listing.property_type)}</span><span class="stat-label">Type</span></div>
        </div>

        <p class="detail-description">${escapeXml(listing.description || '')}</p>
      </div>

      <div class="contact-card">
        <h3>Contact the agent</h3>
        <form id="inquiry-form">
          <label for="name">Name</label>
          <input type="text" id="name" required />
          <label for="email">Email</label>
          <input type="email" id="email" required />
          <label for="phone">Phone (optional)</label>
          <input type="tel" id="phone" />
          <label for="message">Message</label>
          <textarea id="message" placeholder="I'd like to schedule a tour of this property...">I'd like to schedule a tour of this property.</textarea>
          <button type="submit">Send Inquiry</button>
        </form>
        <div class="form-success" id="form-success">Thanks! An agent will reach out shortly.</div>
      </div>
    </div>
  `;

  document.getElementById('inquiry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      await api(`/listings/${listing.id}/inquiries`, {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('name').value,
          email: document.getElementById('email').value,
          phone: document.getElementById('phone').value,
          message: document.getElementById('message').value,
        }),
      });
      document.getElementById('form-success').classList.add('show');
      e.target.reset();
    } catch (err) {
      alert('Could not send inquiry: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Inquiry';
    }
  });
}

(async function init() {
  const id = getId();
  if (!id) {
    content.innerHTML = '<div class="empty-state">No listing specified.</div>';
    return;
  }
  try {
    const listing = await api(`/listings/${id}`);
    renderListing(listing);
  } catch (err) {
    content.innerHTML = `<div class="empty-state">${escapeXml(err.message)}</div>`;
  }
})();
