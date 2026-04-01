// ─────────────────────────────────────────────────────────────
//  tenant.js  —  RentTrack Tenant Portal
//  Covers: auth guard, dashboard, tickets, new ticket,
//          notifications, profile, ticket detail modal,
//          image attachments upload + lightbox viewer.
// ─────────────────────────────────────────────────────────────

const __ENV__  = window.__ENV__ || {};
const API      = (__ENV__.API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'rt_token';
const USER_KEY  = 'rt_user';

// ── Auth helpers ──────────────────────────────────────────────
function getToken()   { return localStorage.getItem(TOKEN_KEY); }
function getUser()    { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
function saveUser(u)  { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

async function apiFetch(path, opts = {}) {
  const res  = await fetch(`${API}${path}`, {
    headers: authHeaders(),
    ...opts,
  });
  const json = await res.json();
  if (res.status === 401) { logout(); return null; }
  return json;
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/login.html';
}

// ── Guard: redirect to login if not authenticated ─────────────
(function authGuard() {
  if (!getToken()) window.location.href = '/login.html';
})();

// ── State ─────────────────────────────────────────────────────
let allTickets    = [];
let currentPage   = 1;
const PAGE_SIZE   = 10;
let filterStatus  = '';
let searchQuery   = '';
let activeTicketId = null;
let ntImages      = [];     // staged files for new ticket
let currentModalTicket = null;

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const user = getUser();
  if (!user) { logout(); return; }

  // Seed sidebar with cached user while fresh data loads
  applyUserToUI(user);

  // Load fresh /auth/me
  const meRes = await apiFetch('/api/auth/me');
  if (meRes?.success) {
    saveUser(meRes.data);
    applyUserToUI(meRes.data);
  }

  await Promise.all([loadDashboard(), loadTickets(), loadNotifCount()]);
  loadProperties();
  loadCategories();
  initSwipeGesture();
});

function applyUserToUI(user) {
  if (!user) return;
  const initials = (user.name || 'T').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarEl = document.getElementById('sb-avatar');
  if (avatarEl) {
    if (user.profile_photo) {
      avatarEl.innerHTML = `<img src="${user.profile_photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      avatarEl.textContent = initials;
    }
  }
  setText('sb-name',   user.name || '');
  setText('sb-app-name', __ENV__.APP_NAME || 'RentTrack');
  setText('mobileAppName', __ENV__.APP_NAME || 'RentTrack');
}

// ─────────────────────────────────────────────────────────────
// PAGE ROUTING
// ─────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:    'Dashboard',
  tickets:      'My Tickets',
  'new-ticket': 'Log New Issue',
  notifications:'Notifications',
  profile:      'My Profile',
};

function showPage(id, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById(`page-${id}`);
  if (page) page.classList.add('active');
  if (navEl) navEl.classList.add('active');
  setText('page-title', PAGE_TITLES[id] || '');

  if (id === 'notifications') loadNotifications();
  if (id === 'profile')       loadProfile();
  if (id === 'tickets')       renderTickets();
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
async function loadDashboard() {
  const res = await apiFetch('/api/tickets');
  if (!res?.success) return;
  allTickets = res.data || [];

  const open     = allTickets.filter(t => t.status === 'open').length;
  const progress = allTickets.filter(t => t.status === 'in_progress').length;
  const done     = allTickets.filter(t => ['completed','closed'].includes(t.status)).length;

  setText('stat-open',     open);
  setText('stat-progress', progress);
  setText('stat-done',     done);
  setText('stat-total',    allTickets.length);

  const recent = [...allTickets].slice(0, 5);
  const grid   = document.getElementById('dash-tickets-grid');
  if (grid) grid.innerHTML = recent.length ? recent.map(ticketCard).join('') : emptyState('No tickets yet');
}

// ─────────────────────────────────────────────────────────────
// TICKETS
// ─────────────────────────────────────────────────────────────
async function loadTickets() {
  const res = await apiFetch('/api/tickets');
  if (!res?.success) return;
  allTickets = res.data || [];
  renderTickets();
  updateTicketDot();
}

function renderTickets() {
  let tickets = allTickets;

  if (filterStatus) tickets = tickets.filter(t => t.status === filterStatus);
  if (searchQuery)  tickets = tickets.filter(t =>
    t.title.toLowerCase().includes(searchQuery) ||
    (t.ticket_number || '').toLowerCase().includes(searchQuery)
  );

  const totalPages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = 1;
  const paged = tickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const grid = document.getElementById('tickets-grid');
  if (grid) grid.innerHTML = paged.length ? paged.map(ticketCard).join('') : emptyState('No tickets found');

  renderPagination(totalPages);
}

function ticketCard(t) {
  const statusClass = {
    open: 'status-open', in_progress: 'status-progress', on_hold: 'status-hold',
    completed: 'status-done', closed: 'status-done', assigned: 'status-assigned',
    cancelled: 'status-cancelled',
  }[t.status] || 'status-open';

  const priorityClass = { urgent: 'priority-urgent', high: 'priority-high', medium: 'priority-medium', low: 'priority-low' }[t.priority] || '';
  const date = t.created_at ? new Date(t.created_at).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' }) : '';

  return `
    <div class="ticket-card" onclick="openTicketModal('${t.id}')">
      <div class="ticket-card-header">
        <span class="ticket-number">${esc(t.ticket_number || '')}</span>
        <span class="status-badge ${statusClass}">${formatStatus(t.status)}</span>
      </div>
      <div class="ticket-title">${esc(t.title)}</div>
      <div class="ticket-meta">
        <span class="${priorityClass}">${capitalize(t.priority || 'medium')} priority</span>
        ${t.property_name ? `<span>· ${esc(t.property_name)}</span>` : ''}
        ${t.unit_number   ? `<span>· Unit ${esc(t.unit_number)}</span>` : ''}
      </div>
      <div class="ticket-date">${date}</div>
    </div>`;
}

function filterStatus(el) {
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  filterStatus = el.dataset.status;
  currentPage  = 1;
  renderTickets();
}

function searchTickets() {
  searchQuery = (document.getElementById('ticket-search')?.value || '').toLowerCase();
  currentPage = 1;
  renderTickets();
}

function renderPagination(totalPages) {
  const el = document.getElementById('tickets-pagination');
  if (!el || totalPages <= 1) { if (el) el.innerHTML = ''; return; }
  let html = `<button class="btn btn-ghost btn-sm" ${currentPage===1?'disabled':''} onclick="goPage(${currentPage-1})">← Prev</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="btn btn-sm ${i===currentPage?'btn-primary':'btn-ghost'}" onclick="goPage(${i})">${i}</button>`;
  }
  html += `<button class="btn btn-ghost btn-sm" ${currentPage===totalPages?'disabled':''} onclick="goPage(${currentPage+1})">Next →</button>`;
  el.innerHTML = html;
}

function goPage(n) { currentPage = n; renderTickets(); }

function updateTicketDot() {
  const dot  = document.getElementById('ticket-dot');
  const open = allTickets.filter(t => t.status === 'open').length;
  if (dot) dot.style.display = open > 0 ? '' : 'none';
}

// ─────────────────────────────────────────────────────────────
// TICKET DETAIL MODAL
// ─────────────────────────────────────────────────────────────
async function openTicketModal(id) {
  activeTicketId = id;
  document.getElementById('ticket-modal').classList.add('active');
  document.getElementById('modal-ticket-content').innerHTML = loadingSpinner();
  document.getElementById('updates-list').innerHTML = loadingSpinner();
  document.getElementById('modal-details').innerHTML = '';
  document.getElementById('update-msg').value = '';

  // Load ticket + updates + attachments in parallel
  const [tRes, uRes, aRes] = await Promise.all([
    apiFetch(`/api/tickets/${id}`),
    apiFetch(`/api/tickets/${id}/updates`),
    apiFetch(`/api/tickets/${id}/attachments`),
  ]);

  if (!tRes?.success) {
    document.getElementById('modal-ticket-content').innerHTML = '<p style="color:var(--red);padding:16px">Could not load ticket.</p>';
    return;
  }

  const ticket      = tRes.data;
  const updates     = uRes?.data || [];
  const attachments = aRes?.data || [];
  currentModalTicket = ticket;

  setText('modal-ticket-num', ticket.ticket_number || 'Ticket');
  renderModalContent(ticket, attachments);
  renderUpdates(updates);
  renderModalDetails(ticket);
}

function renderModalContent(t, attachments) {
  const statusClass = {
    open:'status-open', in_progress:'status-progress', on_hold:'status-hold',
    completed:'status-done', closed:'status-done', assigned:'status-assigned',
  }[t.status] || 'status-open';

  const images = attachments.filter(a => a.file_type === 'image');
  const docs   = attachments.filter(a => a.file_type !== 'image');

  const imgHtml = images.length ? `
    <div style="margin-top:16px">
      <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">
        Photos (${images.length})
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${images.map((img, i) => `
          <div style="position:relative;width:88px;height:88px;border-radius:8px;overflow:hidden;cursor:pointer;border:1px solid var(--border)"
               onclick="openLightbox(${i}, ${JSON.stringify(images.map(x => x.file_url)).replace(/"/g, '&quot;')})">
            <img src="${esc(img.file_url)}" alt="${esc(img.file_name || 'photo')}"
                 style="width:100%;height:100%;object-fit:cover"
                 onerror="this.parentElement.innerHTML='<div style=\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f3f4f6;font-size:20px\'>🖼️</div>'">
          </div>`).join('')}
      </div>
    </div>` : '';

  const docHtml = docs.length ? `
    <div style="margin-top:12px">
      ${docs.map(d => `
        <a href="${esc(d.file_url)}" target="_blank" download="${esc(d.file_name || 'file')}"
           style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--text);text-decoration:none;margin-bottom:6px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          ${esc(d.file_name || 'Download file')}
        </a>`).join('')}
    </div>` : '';

  document.getElementById('modal-ticket-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <h4 style="margin:0;font-size:16px;font-weight:700;flex:1">${esc(t.title)}</h4>
      <span class="status-badge ${statusClass}">${formatStatus(t.status)}</span>
    </div>
    ${t.description ? `<p style="margin:12px 0 0;font-size:14px;color:var(--muted-text,#555);line-height:1.6">${esc(t.description)}</p>` : ''}
    ${imgHtml}
    ${docHtml}`;
}

function renderUpdates(updates) {
  const list = document.getElementById('updates-list');
  if (!updates.length) {
    list.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:12px 0">No updates yet.</p>';
    return;
  }
  list.innerHTML = updates.map(u => {
    const date = new Date(u.created_at).toLocaleString('en-ZA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    const isStatus = !!u.status_change;
    return `
      <div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:600">${esc(u.user_name || 'Staff')}</span>
          <span style="font-size:11px;color:var(--muted)">${date}</span>
        </div>
        ${isStatus
          ? `<div style="font-size:12px;color:var(--muted);font-style:italic">Status changed to <strong>${formatStatus(u.status_change)}</strong></div>`
          : `<div style="font-size:13px;line-height:1.5">${esc(u.message || '')}</div>`}
      </div>`;
  }).join('');
}

function renderModalDetails(t) {
  const rows = [
    ['Property',  t.property_name],
    ['Unit',      t.unit_number],
    ['Category',  t.category_name],
    ['Priority',  capitalize(t.priority)],
    ['Assigned',  t.assigned_to_name],
    ['Created',   t.created_at ? new Date(t.created_at).toLocaleString('en-ZA') : '—'],
  ].filter(([, v]) => v);

  document.getElementById('modal-details').innerHTML = `
    <div style="margin-top:12px">
      ${rows.map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">
          <span style="color:var(--muted)">${k}</span>
          <span style="font-weight:500">${esc(String(v))}</span>
        </div>`).join('')}
    </div>`;
}

function modalTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('modal-updates').style.display = tab === 'updates' ? '' : 'none';
  document.getElementById('modal-details').style.display = tab === 'details' ? '' : 'none';
}

async function postUpdate() {
  const msg = (document.getElementById('update-msg')?.value || '').trim();
  if (!msg || !activeTicketId) return;

  const btn = document.querySelector('.comment-box .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  const res = await apiFetch(`/api/tickets/${activeTicketId}/updates`, {
    method: 'POST',
    body:   JSON.stringify({ message: msg }),
  });

  if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send`; }

  if (res?.success) {
    document.getElementById('update-msg').value = '';
    const uRes = await apiFetch(`/api/tickets/${activeTicketId}/updates`);
    if (uRes?.success) renderUpdates(uRes.data);
    // Refresh ticket list silently
    loadTickets();
  }
}

function closeModal() {
  document.getElementById('ticket-modal')?.classList.remove('active');
  activeTicketId = null;
  currentModalTicket = null;
}

// ─────────────────────────────────────────────────────────────
// LIGHTBOX — image viewer
// ─────────────────────────────────────────────────────────────
let lbImages = [];
let lbIndex  = 0;

function openLightbox(index, urls) {
  lbImages = urls;
  lbIndex  = index;
  renderLightbox();
}

function renderLightbox() {
  // Remove existing
  document.getElementById('rt-lightbox')?.remove();

  const lb = document.createElement('div');
  lb.id = 'rt-lightbox';
  lb.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;
    display:flex;align-items:center;justify-content:center;flex-direction:column;
  `;

  lb.innerHTML = `
    <!-- Close -->
    <button onclick="closeLightbox()" style="position:absolute;top:16px;right:16px;background:none;border:none;color:white;font-size:28px;cursor:pointer;line-height:1">✕</button>

    <!-- Counter -->
    <div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.7);font-size:13px">
      ${lbIndex + 1} / ${lbImages.length}
    </div>

    <!-- Image -->
    <img id="lb-img" src="${esc(lbImages[lbIndex])}"
         style="max-width:90vw;max-height:80vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.6)"
         onerror="this.alt='Image failed to load'">

    <!-- Prev / Next -->
    ${lbImages.length > 1 ? `
      <button onclick="lbPrev()" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;color:white;width:44px;height:44px;border-radius:50%;font-size:20px;cursor:pointer">‹</button>
      <button onclick="lbNext()" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;color:white;width:44px;height:44px;border-radius:50%;font-size:20px;cursor:pointer">›</button>
    ` : ''}

    <!-- Thumbnails -->
    ${lbImages.length > 1 ? `
      <div style="display:flex;gap:8px;margin-top:16px;overflow-x:auto;max-width:90vw;padding:4px">
        ${lbImages.map((url, i) => `
          <img src="${esc(url)}" onclick="lbGoto(${i})"
               style="width:56px;height:56px;object-fit:cover;border-radius:6px;cursor:pointer;opacity:${i===lbIndex?1:.5};border:2px solid ${i===lbIndex?'white':'transparent'};flex-shrink:0">`
        ).join('')}
      </div>
    ` : ''}
  `;

  // Close on backdrop click
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.body.appendChild(lb);

  // Keyboard nav
  document.addEventListener('keydown', lbKeyHandler);
}

function lbKeyHandler(e) {
  if (e.key === 'ArrowRight') lbNext();
  if (e.key === 'ArrowLeft')  lbPrev();
  if (e.key === 'Escape')     closeLightbox();
}

function lbNext() { lbIndex = (lbIndex + 1) % lbImages.length; renderLightbox(); }
function lbPrev() { lbIndex = (lbIndex - 1 + lbImages.length) % lbImages.length; renderLightbox(); }
function lbGoto(i) { lbIndex = i; renderLightbox(); }
function closeLightbox() {
  document.getElementById('rt-lightbox')?.remove();
  document.removeEventListener('keydown', lbKeyHandler);
}

// ─────────────────────────────────────────────────────────────
// NEW TICKET
// ─────────────────────────────────────────────────────────────
async function loadProperties() {
  const res = await apiFetch('/api/properties');
  if (!res?.success) return;
  const sel = document.getElementById('nt-property');
  if (!sel) return;
  res.data.forEach(p => {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.name;
    sel.appendChild(o);
  });

  // Auto-fill property + unit from tenancy
  const unitRes = await apiFetch('/api/auth/my-unit');
  if (unitRes?.success && unitRes.data) {
    const u = unitRes.data;
    sel.value = u.property_id || '';
    await loadUnits();
    const unitSel = document.getElementById('nt-unit');
    if (unitSel) unitSel.value = u.unit_id || '';
    const hint = document.getElementById('nt-unit-hint');
    const hintTxt = document.getElementById('nt-unit-hint-text');
    if (hint && hintTxt) {
      hintTxt.textContent = `Auto-filled: ${u.property_name}, Unit ${u.unit_number}`;
      hint.style.display = '';
    }
  }
}

async function loadUnits() {
  const propId = document.getElementById('nt-property')?.value;
  const sel    = document.getElementById('nt-unit');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select unit (optional) —</option>';
  if (!propId) return;
  const res = await apiFetch(`/api/properties/${propId}/units`);
  if (!res?.success) return;
  res.data.forEach(u => {
    const o = document.createElement('option');
    o.value = u.id; o.textContent = `Unit ${u.unit_number}`;
    sel.appendChild(o);
  });
}

async function loadCategories() {
  const res = await apiFetch('/api/categories');
  if (!res?.success) return;
  const sel = document.getElementById('nt-category');
  if (!sel) return;
  res.data.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    sel.appendChild(o);
  });
}

// ── Image staging ─────────────────────────────────────────────
function ntDragOver(e)  { e.preventDefault(); document.getElementById('nt-dropzone')?.classList.add('drag-over'); }
function ntDragLeave()  { document.getElementById('nt-dropzone')?.classList.remove('drag-over'); }
function ntDrop(e)      { e.preventDefault(); ntDragLeave(); ntAddFiles(Array.from(e.dataTransfer.files)); }
function ntFilesSelected(e) { ntAddFiles(Array.from(e.target.files)); e.target.value = ''; }

function ntAddFiles(files) {
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  if (!imageFiles.length) { showModal('warning', 'No images', 'Only image files (JPG, PNG, etc.) are accepted.'); return; }

  const remaining = 5 - ntImages.length;
  const toAdd     = imageFiles.slice(0, remaining);

  toAdd.forEach(file => {
    if (file.size > 5 * 1024 * 1024) { showModal('warning', 'File too large', `${file.name} is over 5 MB.`); return; }
    const reader = new FileReader();
    reader.onload = e => {
      ntImages.push({ file, dataUrl: e.target.result });
      renderNtPreviews();
    };
    reader.readAsDataURL(file);
  });

  if (imageFiles.length > remaining) {
    showModal('info', 'Limit reached', `Only ${remaining} more photo(s) can be added (max 5).`);
  }
}

function renderNtPreviews() {
  const grid = document.getElementById('nt-preview-grid');
  if (!grid) return;
  grid.innerHTML = ntImages.map((img, i) => `
    <div style="position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      <img src="${img.dataUrl}" style="width:100%;height:100%;object-fit:cover">
      <button onclick="ntRemoveImage(${i})"
              style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);border:none;color:white;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:18px;padding:0">✕</button>
    </div>`).join('');
}

function ntRemoveImage(i) { ntImages.splice(i, 1); renderNtPreviews(); }

function clearNewTicket() {
  ['nt-title','nt-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['nt-property','nt-unit','nt-category'].forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });
  document.getElementById('nt-priority').value = 'medium';
  ntImages = [];
  renderNtPreviews();
  ['nt-title-err','nt-property-err'].forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = ''; el.style.display = 'none'; } });
  const hint = document.getElementById('nt-unit-hint'); if (hint) hint.style.display = 'none';
}

async function submitTicket() {
  const title    = (document.getElementById('nt-title')?.value || '').trim();
  const propId   = document.getElementById('nt-property')?.value;
  let valid = true;

  const titleErr = document.getElementById('nt-title-err');
  const propErr  = document.getElementById('nt-property-err');
  if (titleErr) { titleErr.textContent = ''; titleErr.style.display = 'none'; }
  if (propErr)  { propErr.textContent  = ''; propErr.style.display  = 'none'; }

  if (!title)  { if (titleErr) { titleErr.textContent = 'Title is required'; titleErr.style.display = ''; } valid = false; }
  if (!propId) { if (propErr)  { propErr.textContent  = 'Property is required'; propErr.style.display = ''; } valid = false; }
  if (!valid) return;

  const btn = document.getElementById('submit-ticket-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="border-color:rgba(255,255,255,.3);border-top-color:white;width:14px;height:14px;margin-right:6px"></span>Submitting…';

  const body = {
    title,
    description:  document.getElementById('nt-desc')?.value || '',
    property_id:  propId,
    unit_id:      document.getElementById('nt-unit')?.value || undefined,
    category_id:  document.getElementById('nt-category')?.value || undefined,
    priority:     document.getElementById('nt-priority')?.value || 'medium',
  };

  const res = await apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify(body) });

  if (!res?.success) {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit Ticket';
    showModal('error', 'Failed', res?.message || 'Could not create ticket. Please try again.');
    return;
  }

  const ticketId = res.data.id;

  // Upload images as attachments
  if (ntImages.length) {
    await Promise.allSettled(ntImages.map(img =>
      apiFetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          file_url:  img.dataUrl,
          file_name: img.file.name,
          file_size: img.file.size,
          mime_type: img.file.type,
        }),
      })
    ));
  }

  clearNewTicket();
  btn.disabled = false;
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit Ticket';

  showModal('success', 'Ticket Submitted!', `Your ticket "${title}" (${res.data.ticket_number}) has been submitted and the team has been notified.`);
  await loadTickets();
  await loadDashboard();
  showPage('tickets', document.querySelectorAll('.nav-item')[1]);
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
async function loadNotifCount() {
  const res = await apiFetch('/api/notifications');
  if (!res?.success) return;
  const unread = (res.data || []).filter(n => !n.is_read).length;
  const dot = document.getElementById('notif-dot');
  if (dot) dot.style.display = unread > 0 ? '' : 'none';
}

async function loadNotifications() {
  const res = await apiFetch('/api/notifications');
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!res?.success || !res.data.length) {
    list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted);font-size:14px">No notifications</div>`;
    return;
  }
  list.innerHTML = res.data.map(n => {
    const date = new Date(n.created_at).toLocaleString('en-ZA', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    return `
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:flex-start;${n.is_read?'':'background:var(--highlight,#f0f7ff)'}"
           onclick="markRead('${n.id}', this)">
        <div style="width:8px;height:8px;border-radius:50%;background:${n.is_read?'transparent':'var(--blue)'}; margin-top:5px;flex-shrink:0"></div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:${n.is_read?'400':'600'};margin-bottom:2px">${esc(n.title)}</div>
          <div style="font-size:12px;color:var(--muted)">${esc(n.message || '')}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">${date}</div>
        </div>
      </div>`;
  }).join('');
  loadNotifCount();
}

async function markRead(id, el) {
  el?.querySelector('div:first-child')?.setAttribute('style', 'width:8px;height:8px;border-radius:50%;background:transparent;margin-top:5px;flex-shrink:0');
  el?.style.removeProperty('background');
  await apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
  loadNotifCount();
}

async function markAllRead() {
  await apiFetch('/api/notifications/read-all', { method: 'PUT' });
  loadNotifications();
}

// ─────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────
async function loadProfile() {
  const res = await apiFetch('/api/auth/me');
  if (!res?.success) return;
  const u = res.data;
  saveUser(u);

  // Avatar
  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    if (u.profile_photo) {
      avatarEl.innerHTML = `<img src="${u.profile_photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      const initials = (u.name || 'T').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      avatarEl.textContent = initials;
    }
  }

  setText('profile-name-display',  u.name);
  setText('profile-email-display', u.email);
  setText('profile-role-display',  capitalize(u.role));
  setText('profile-last-login',    u.last_login ? new Date(u.last_login).toLocaleDateString('en-ZA') : 'Never');

  setVal('profile-name',  u.name);
  setVal('profile-email', u.email);
  setVal('profile-phone', u.phone || '');

  // Clear password fields
  ['current-password','new-password','confirm-password'].forEach(id => setVal(id, ''));
}

function showProfile() {
  showPage('profile', null);
  // Also set nav active
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
}

async function saveProfileChanges() {
  const name  = (document.getElementById('profile-name')?.value  || '').trim();
  const email = (document.getElementById('profile-email')?.value || '').trim();
  const phone = (document.getElementById('profile-phone')?.value || '').trim();
  const curPw = document.getElementById('current-password')?.value || '';
  const newPw = document.getElementById('new-password')?.value || '';
  const conPw = document.getElementById('confirm-password')?.value || '';

  let hasError = false;

  // Validate
  if (!name)  { showModal('warning', 'Validation', 'Name is required.'); return; }
  if (!email) { showModal('warning', 'Validation', 'Email is required.'); return; }

  // Profile update
  const profileRes = await apiFetch('/api/auth/profile', {
    method: 'PUT',
    body:   JSON.stringify({ name, email, phone }),
  });
  if (!profileRes?.success) {
    showModal('error', 'Update Failed', profileRes?.message || 'Could not update profile.');
    hasError = true;
  }

  // Password change (only if fields are filled)
  if (curPw || newPw || conPw) {
    if (!curPw) { showModal('warning', 'Password', 'Enter your current password.'); return; }
    if (newPw.length < 8) { showModal('warning', 'Password', 'New password must be at least 8 characters.'); return; }
    if (newPw !== conPw)  { showModal('warning', 'Password', 'New passwords do not match.'); return; }

    const pwRes = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body:   JSON.stringify({ current_password: curPw, new_password: newPw }),
    });
    if (!pwRes?.success) {
      showModal('error', 'Password Error', pwRes?.message || 'Could not change password.');
      hasError = true;
    } else {
      ['current-password','new-password','confirm-password'].forEach(id => setVal(id, ''));
    }
  }

  if (!hasError) {
    showModal('success', 'Saved!', 'Your profile has been updated successfully.');
    loadProfile();
    applyUserToUI(getUser());
  }
}

async function handleProfilePhoto(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showModal('warning', 'Too large', 'Profile photo must be under 5 MB.'); return; }

  const reader = new FileReader();
  reader.onload = async ev => {
    const dataUrl = ev.target.result;
    const res = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body:   JSON.stringify({ profile_photo: dataUrl }),
    });
    if (res?.success) {
      const u = getUser();
      if (u) { u.profile_photo = dataUrl; saveUser(u); }
      loadProfile();
      applyUserToUI(getUser());
    } else {
      showModal('error', 'Upload Failed', res?.message || 'Could not update photo.');
    }
  };
  reader.readAsDataURL(file);
}

function togglePassword(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION / CONFIRM MODALS
// ─────────────────────────────────────────────────────────────
const ICONS = {
  success: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info:    `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

function showModal(type, title, message) {
  const el = document.getElementById('notification-modal');
  if (!el) return;
  document.getElementById('notification-icon').innerHTML    = ICONS[type] || ICONS.info;
  document.getElementById('notification-title').textContent = title;
  document.getElementById('notification-message').textContent = message;
  el.classList.add('active');
}

function closeNotificationModal() {
  document.getElementById('notification-modal')?.classList.remove('active');
}

function openConfirmModal(title, message, onConfirm) {
  const el = document.getElementById('confirm-modal');
  if (!el) return;
  document.getElementById('confirm-icon').innerHTML    = ICONS.warning;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  const btn = document.getElementById('confirm-yes-btn');
  if (btn) { btn.onclick = () => { closeConfirmModal(); onConfirm(); }; }
  el.classList.add('active');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal')?.classList.remove('active');
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR / MOBILE
// ─────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('menuOverlay');
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('active');
}

function closeSidebarMobile() {
  if (window.innerWidth > 768) return;
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('menuOverlay')?.classList.remove('active');
}

function initSwipeGesture() {
  let startX = 0;
  document.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientX - startX;
    if (startX < 30 && diff > 60)  toggleSidebar();
    if (diff < -60) { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('menuOverlay')?.classList.remove('active'); }
  }, { passive: true });

  // Hide swipe hint after first touch
  const hint = document.getElementById('swipeHint');
  if (hint) document.addEventListener('touchstart', () => { hint.style.display = 'none'; }, { once: true });
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text ?? ''; }
function setVal(id, val)   { const el = document.getElementById(id); if (el) el.value = val ?? ''; }

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function formatStatus(s) {
  return { open:'Open', in_progress:'In Progress', on_hold:'On Hold', completed:'Completed', closed:'Closed', assigned:'Assigned', cancelled:'Cancelled' }[s] || capitalize(s);
}

function loadingSpinner() {
  return `<div style="text-align:center;padding:32px;color:var(--muted)"><div class="spinner" style="margin:0 auto 10px;width:22px;height:22px;border-color:rgba(0,0,0,.1);border-top-color:var(--blue)"></div>Loading…</div>`;
}

function emptyState(msg) {
  return `<div style="padding:40px;text-align:center;color:var(--muted);font-size:14px">${esc(msg)}</div>`;
}