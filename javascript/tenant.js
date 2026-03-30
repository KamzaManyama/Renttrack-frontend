/* ── Init ─────────────────────────────────────────────────── */
document.getElementById('sb-app-name').textContent   = (typeof ENV !== 'undefined' && ENV.APP_NAME) || 'RentTrack';
document.getElementById('mobileAppName').textContent  = (typeof ENV !== 'undefined' && ENV.APP_NAME) || 'RentTrack';
document.title = `${(typeof ENV !== 'undefined' && ENV.APP_NAME) || 'RentTrack'} — Tenant Portal`;

if (typeof Auth !== 'undefined') {
  if (!Auth.isLoggedIn()) { window.location.replace('login.html'); }
  const user = Auth.user;
  if (user && !['tenant','staff'].includes(user.role)) { window.location.replace('caretaker.html'); }
  if (user) {
    document.getElementById('sb-name').textContent   = user.name || '—';
    document.getElementById('sb-avatar').textContent = (user.name || 'T')[0].toUpperCase();
  }
}

/* ── Mobile Sidebar ───────────────────────────────────────── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('menuOverlay');
  const burger  = document.getElementById('burgerMenu');
  const isOpen  = sidebar.classList.toggle('open');
  overlay.classList.toggle('active', isOpen);
  burger.classList.toggle('active', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeSidebarMobile() {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) toggleSidebar();
  }
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('menuOverlay').classList.remove('active');
    document.getElementById('burgerMenu').classList.remove('active');
    document.body.style.overflow = '';
  }
});

/* Swipe gesture */
let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
document.addEventListener('touchend', e => {
  if (window.innerWidth > 768) return;
  const dx = e.changedTouches[0].screenX - touchStartX;
  const sidebar = document.getElementById('sidebar');
  if (dx > 50  && touchStartX < 30 && !sidebar.classList.contains('open')) toggleSidebar();
  if (dx < -50 && touchStartX > 200 && sidebar.classList.contains('open'))  toggleSidebar();
}, { passive: true });

/* Swipe hint */
document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth <= 768 && !localStorage.getItem('swipeHintShown')) {
    const h = document.getElementById('swipeHint');
    h.classList.add('show');
    localStorage.setItem('swipeHintShown', 'true');
    setTimeout(() => h.classList.remove('show'), 3000);
  }
});

/* ── Notification Modal ───────────────────────────────────── */
let _notifTimer = null;
function showNotification(title, message, icon = '') {
  document.getElementById('notification-icon').textContent    = icon;
  document.getElementById('notification-title').textContent   = title;
  document.getElementById('notification-message').textContent = message;
  document.getElementById('notification-modal').classList.add('active');
  clearTimeout(_notifTimer);
  _notifTimer = setTimeout(closeNotificationModal, 4000);
}
function closeNotificationModal() {
  document.getElementById('notification-modal').classList.remove('active');
}

/* Confirm Modal */
function showConfirm(title, message, onConfirm, icon = '') {
  document.getElementById('confirm-icon').textContent    = icon;
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  const btn = document.getElementById('confirm-yes-btn');
  btn.onclick = () => { onConfirm(); closeConfirmModal(); };
  document.getElementById('confirm-modal').classList.add('active');
}
function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.remove('active');
}

/* ── State ────────────────────────────────────────────────── */
let allTickets = [], filteredTickets = [], currentPage = 1, currentStatus = '', openTicketId = null;
const PER_PAGE = 10;

/* ── Attachment state ─────────────────────────────────────── */
const NT_MAX_FILES = 5;
const NT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
let ntFiles = []; // [{ id, file, dataUrl }]

/* ── Status / Priority config ─────────────────────────────── */
const STATUS_CLASS = {
  open:        'badge-open',
  in_progress: 'badge-in-progress',
  assigned:    'badge-assigned',
  completed:   'badge-completed',
  closed:      'badge-closed',
};
const PRIORITY_CLASS = {
  urgent: 'badge-urgent',
  high:   'badge-high',
  medium: 'badge-medium',
  low:    'badge-low',
};
const STATUS_ICON = {
  open:        `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  in_progress: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
  assigned:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  completed:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  closed:      `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
};
const PRIORITY_ICON = {
  urgent: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  high:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>`,
  medium: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  low:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>`,
};

/* ── Navigation ───────────────────────────────────────────── */
function showPage(id, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${id}`).classList.add('active');
  if (navEl) navEl.classList.add('active');
  const titles = { dashboard:'Dashboard', tickets:'My Tickets', 'new-ticket':'Log New Issue', notifications:'Notifications' };
  document.getElementById('page-title').textContent = titles[id] || '';
  if (id === 'tickets')       loadMyTickets();
  if (id === 'notifications') loadNotifications();
  if (id === 'new-ticket')    loadFormData();
  if (id === 'dashboard')     loadDashboard();
}

function logout() {
  if (typeof Auth !== 'undefined') Auth.clear();
  sessionStorage.setItem('rt_logged_out', '1');
  window.location.replace('login.html');
}

/* ── Ticket Card Renderer ─────────────────────────────────── */
function renderTicketCard(t) {
  const statusLabel   = (t.status || 'unknown').replace('_', ' ');
  const priorityLabel = t.priority || 'unknown';
  const statusClass   = STATUS_CLASS[t.status]   || 'badge-closed';
  const priorityClass = PRIORITY_CLASS[t.priority] || 'badge-medium';
  const statusIcon    = STATUS_ICON[t.status]   || '';
  const priorityIcon  = PRIORITY_ICON[t.priority] || '';
  const priorityCardClass = `priority-${t.priority || 'medium'}`;

  return `
    <div class="ticket-card ${priorityCardClass}" onclick="openTicket('${t.id}')">
      <div class="ticket-header">
        <div class="ticket-title-section">
          <h4>${t.title || 'Untitled'}</h4>
          <span class="ticket-number">${t.ticket_number || '—'}</span>
        </div>
      </div>
      <div class="ticket-badges">
        <span class="badge ${statusClass}">${statusIcon} ${statusLabel}</span>
        <span class="badge ${priorityClass}">${priorityIcon} ${priorityLabel}</span>
        ${t.category_name ? `<span class="badge badge-category">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          ${t.category_name}
        </span>` : ''}
      </div>
      <div class="ticket-meta">
        <span class="ticket-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${t.property_name || '—'}
        </span>
        ${t.unit_number ? `<span class="ticket-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Unit ${t.unit_number}
        </span>` : ''}
        <span class="ticket-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${t.assigned_to_name || 'Unassigned'}
        </span>
        <span class="ticket-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${typeof timeAgo === 'function' ? timeAgo(t.created_at) : t.created_at}
        </span>
      </div>
    </div>
  `;
}

/* ── Dashboard ────────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const resp = await GET('/api/tickets');
    const allT = resp.data || [];
    let op=0, ip=0, done=0;
    allT.forEach(t => {
      if (['open','assigned'].includes(t.status)) op++;
      if (t.status === 'in_progress') ip++;
      if (['completed','closed'].includes(t.status)) done++;
    });
    document.getElementById('stat-open').textContent     = op;
    document.getElementById('stat-progress').textContent = ip;
    document.getElementById('stat-done').textContent     = done;
    document.getElementById('stat-total').textContent    = allT.length;
    if (op > 0) document.getElementById('ticket-dot').style.display = 'inline-block';

    const grid = document.getElementById('dash-tickets-grid');
    if (!allT.length) {
      grid.innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px">No tickets yet. Log your first issue!</div>`;
      return;
    }
    grid.innerHTML = allT.slice(0,5).map(renderTicketCard).join('');
  } catch(e) { showNotification('Error', e.message, '⚠'); }
}

/* ── My Tickets ───────────────────────────────────────────── */
async function loadMyTickets() {
  document.getElementById('tickets-grid').innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">Loading tickets…</div>`;
  try {
    const q = currentStatus ? `?status=${currentStatus}` : '';
    const resp = await GET(`/api/tickets${q}`);
    allTickets = resp.data || [];
    applySearch();
  } catch(e) { showNotification('Error', e.message, '⚠'); }
}

function applySearch() {
  const term = document.getElementById('ticket-search').value.toLowerCase();
  filteredTickets = term
    ? allTickets.filter(t => t.title.toLowerCase().includes(term) || (t.ticket_number||'').toLowerCase().includes(term))
    : [...allTickets];
  currentPage = 1;
  renderTicketsGrid();
}
function searchTickets() { applySearch(); }

function filterStatus(el) {
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  currentStatus = el.dataset.status;
  loadMyTickets();
}

function renderTicketsGrid() {
  const start = (currentPage-1)*PER_PAGE;
  const page  = filteredTickets.slice(start, start+PER_PAGE);
  const grid  = document.getElementById('tickets-grid');

  if (!filteredTickets.length) {
    grid.innerHTML = `<div style="text-align:center;padding:48px;color:var(--muted);font-size:13px">No tickets found.</div>`;
    document.getElementById('tickets-pagination').innerHTML = '';
    return;
  }
  grid.innerHTML = page.map(renderTicketCard).join('');

  const total = filteredTickets.length;
  const pages = Math.ceil(total / PER_PAGE);
  let pagesHtml = '';
  for (let i = 1; i <= pages; i++) {
    if (pages <= 7 || Math.abs(i - currentPage) <= 2 || i === 1 || i === pages) {
      pagesHtml += `<button class="pagination-page ${i===currentPage?'active':''}" onclick="changePage(${i})">${i}</button>`;
    }
  }
  document.getElementById('tickets-pagination').innerHTML = `
    <span class="pagination-info">${total} ticket${total!==1?'s':''}</span>
    <div class="pagination-pages" style="display:flex;gap:4px;align-items:center;">
      <button class="pagination-btn" onclick="changePage(${currentPage-1})" ${currentPage<=1?'disabled':''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      ${pagesHtml}
      <button class="pagination-btn" onclick="changePage(${currentPage+1})" ${currentPage>=pages?'disabled':''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>`;
}

function changePage(p) {
  if (p < 1 || p > Math.ceil(filteredTickets.length/PER_PAGE)) return;
  currentPage = p;
  renderTicketsGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Ticket Detail Modal ──────────────────────────────────── */
function badgeHtml(label, cls, iconHtml) {
  return `<span class="badge ${cls}">${iconHtml || ''} ${label}</span>`;
}

async function openTicket(id) {
  openTicketId = id;
  document.getElementById('ticket-modal').classList.add('open');
  document.getElementById('modal-ticket-content').innerHTML = `
    <div style="text-align:center;padding:32px;color:var(--muted);font-size:13px">
      <div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--blue);margin:0 auto 12px;width:24px;height:24px;"></div>
      Loading…
    </div>`;
  document.getElementById('updates-list').innerHTML = '';

  try {
    const [tkResp, updResp, attResp] = await Promise.all([
      GET(`/api/tickets/${id}`),
      GET(`/api/tickets/${id}/updates`),
      GET(`/api/tickets/${id}/attachments`).catch(() => ({ data: [] })),
    ]);
    const t           = tkResp.data;
    const updates     = updResp.data || [];
    const attachments = attResp.data || [];

    document.getElementById('modal-ticket-num').textContent = t.ticket_number || '—';

    const statusLabel   = (t.status||'unknown').replace('_',' ');
    const priorityLabel = t.priority || 'unknown';

    // Build attachments gallery if any
    const attHtml = attachments.length ? `
      <div style="margin-top:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">
          Photos (${attachments.length})
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${attachments.map(a => `
            <a href="${a.file_url}" target="_blank" rel="noopener"
              style="width:80px;height:80px;border-radius:8px;overflow:hidden;display:block;border:1.5px solid var(--border);flex-shrink:0;">
              <img src="${a.file_url}" alt="${a.file_name || 'photo'}"
                style="width:100%;height:100%;object-fit:cover;display:block;">
            </a>`).join('')}
        </div>
      </div>` : '';

    document.getElementById('modal-ticket-content').innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
        ${badgeHtml(statusLabel,   STATUS_CLASS[t.status]   || 'badge-closed', STATUS_ICON[t.status]   || '')}
        ${badgeHtml(priorityLabel, PRIORITY_CLASS[t.priority] || 'badge-medium', PRIORITY_ICON[t.priority] || '')}
        ${t.category_name ? `<span class="badge badge-category">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          ${t.category_name}
        </span>` : ''}
      </div>
      <div class="ticket-detail-title">${t.title || 'Untitled'}</div>
      <div class="ticket-detail-desc">${t.description || '<em style="color:var(--muted)">No description provided.</em>'}</div>
      <div class="ticket-detail-meta">
        <span class="ticket-detail-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${t.property_name || '—'}
        </span>
        ${t.unit_number ? `<span class="ticket-detail-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Unit ${t.unit_number}
        </span>` : ''}
        <span class="ticket-detail-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
          ${t.assigned_to_name || 'Unassigned'}
        </span>
        <span class="ticket-detail-meta-item">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${typeof fmtDate === 'function' ? fmtDate(t.created_at) : t.created_at}
        </span>
      </div>
      ${attHtml}
    `;

    document.getElementById('updates-list').innerHTML = updates.length
      ? updates.map(u => `
          <div class="update-item">
            <div class="update-avatar">${(u.user_name||'?')[0].toUpperCase()}</div>
            <div class="update-body">
              <div class="update-meta">
                <strong>${u.user_name || 'System'}</strong>
                <span>${typeof timeAgo === 'function' ? timeAgo(u.created_at) : u.created_at}</span>
                ${u.is_internal ? `<span class="badge badge-medium" style="font-size:10px;">Internal</span>` : ''}
              </div>
              <div class="update-msg">${u.message || ''}</div>
            </div>
          </div>
        `).join('')
      : '<p style="color:var(--muted);font-size:13px;padding:12px 0">No updates yet.</p>';

  } catch(e) { showNotification('Error', e.message, '⚠'); }
}

function closeModal() {
  document.getElementById('ticket-modal').classList.remove('open');
  openTicketId = null;
}

function modalTab(tab, el) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('modal-updates').style.display = tab === 'updates' ? '' : 'none';
  document.getElementById('modal-details').style.display = tab === 'details' ? '' : 'none';
}

async function postUpdate() {
  const msg = document.getElementById('update-msg').value.trim();
  if (!msg) return;
  try {
    await POST(`/api/tickets/${openTicketId}/updates`, { message: msg });
    document.getElementById('update-msg').value = '';
    showNotification('Success', 'Comment added successfully.', '✓');
    openTicket(openTicketId);
  } catch(e) { showNotification('Error', e.message, '⚠'); }
}

/* ── New Ticket Form ──────────────────────────────────────── */
// Store occupancy for submit enforcement
let _tenantOccupancy = null;

async function loadFormData() {
  try {
    const [catResp, myUnitResp] = await Promise.all([
      GET('/api/categories'),
      GET('/api/auth/my-unit').catch(() => ({ data: null })),
    ]);

    _tenantOccupancy = myUnitResp.data; // cache for submitTicket enforcement

    // Categories are fine to load normally
    document.getElementById('nt-category').innerHTML =
      '<option value="">— Select category —</option>' +
      (catResp.data||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const propSel = document.getElementById('nt-property');
    const unitSel = document.getElementById('nt-unit');
    const hint    = document.getElementById('nt-unit-hint');

    if (_tenantOccupancy) {
      // Only show the ONE property this tenant belongs to — no other options
      propSel.innerHTML = `<option value="${_tenantOccupancy.property_id}">${_tenantOccupancy.property_name}</option>`;
      propSel.value     = _tenantOccupancy.property_id;

      // Only show the ONE unit this tenant lives in — no other options
      unitSel.innerHTML = `<option value="${_tenantOccupancy.unit_id}">Unit ${_tenantOccupancy.unit_number}</option>`;
      unitSel.value     = _tenantOccupancy.unit_id;

      // Style as read-only display — pointer-events off so nothing is clickable
      [propSel, unitSel].forEach(el => {
        el.style.pointerEvents  = 'none';
        el.style.background     = 'var(--surface, #f8fafc)';
        el.style.color          = 'var(--text)';
        el.style.cursor         = 'default';
        el.style.border         = '1.5px solid var(--border)';
        el.setAttribute('aria-readonly', 'true');
      });

      if (hint) {
        hint.style.display  = 'flex';
        const span = document.getElementById('nt-unit-hint-text');
        if (span) span.textContent =
          `${_tenantOccupancy.property_name} · Unit ${_tenantOccupancy.unit_number}`;
      }
    } else {
      // No active tenancy — tenant portal shouldn't normally reach here,
      // but degrade gracefully by loading all properties
      const propResp = await GET('/api/properties').catch(() => ({ data: [] }));
      propSel.innerHTML =
        '<option value="">— Select property —</option>' +
        (propResp.data||[]).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
      if (hint) hint.style.display = 'none';
    }

  } catch(e) { showNotification('Error', 'Could not load form data: ' + e.message, '⚠'); }
}

async function loadUnits() {
  // When a tenant has an active occupancy loadFormData handles everything.
  // This function only runs for staff/managers without a fixed unit.
  if (_tenantOccupancy) return;
  const propId = document.getElementById('nt-property').value;
  const sel = document.getElementById('nt-unit');
  sel.innerHTML = '<option value="">Loading…</option>';
  if (!propId) { sel.innerHTML = '<option value="">— Select unit (optional) —</option>'; return; }
  try {
    const resp = await GET(`/api/properties/${propId}/units`);
    sel.innerHTML = '<option value="">— Select unit (optional) —</option>' +
      (resp.data||[]).map(u => `<option value="${u.id}">Unit ${u.unit_number}</option>`).join('');
  } catch(e) { sel.innerHTML = '<option value="">No units found</option>'; }
}

function clearErrors_nt() {
  ['nt-title','nt-property'].forEach(id => {
    document.getElementById(id).classList.remove('error');
    const err = document.getElementById(`${id}-err`);
    if (err) { err.textContent = ''; err.classList.remove('show'); }
  });
}

async function submitTicket() {
  clearErrors_nt();
  const title    = document.getElementById('nt-title').value.trim();
  // Always use the server-verified occupancy — never trust the form value directly
  const propId = _tenantOccupancy
    ? _tenantOccupancy.property_id
    : document.getElementById('nt-property').value;
  const unitId = _tenantOccupancy
    ? _tenantOccupancy.unit_id
    : document.getElementById('nt-unit').value;
  const catId    = document.getElementById('nt-category').value;
  const priority = document.getElementById('nt-priority').value;
  const desc     = document.getElementById('nt-desc').value.trim();
  let valid = true;

  if (!title)              { setErr('nt-title', 'Issue title is required.'); valid = false; }
  else if (title.length < 5) { setErr('nt-title', 'Title must be at least 5 characters.'); valid = false; }
  if (!propId)             { setErr('nt-property', 'Please select a property.'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('submit-ticket-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Submitting…`;

  try {
    const ticketResp = await POST('/api/tickets', {
      title, property_id: propId,
      unit_id:     unitId  || undefined,
      category_id: catId   || undefined,
      priority, description: desc || undefined,
    });
    const ticket = ticketResp.data;

    // Upload any attached photos
    if (ntFiles.length) {
      btn.innerHTML = `<span class="spinner"></span> Uploading ${ntFiles.length} photo${ntFiles.length > 1 ? 's' : ''}…`;
      for (const item of ntFiles) {
        try {
          await POST(`/api/tickets/${ticket.id}/attachments`, {
            file_url:  item.dataUrl,
            file_name: item.file.name,
            file_size: item.file.size,
            mime_type: item.file.type,
          });
        } catch (attErr) {
          // Non-fatal — ticket is already created
          console.warn('Photo upload failed:', item.file.name, attErr.message);
        }
      }
    }

    showNotification('Ticket submitted', `${ticket.ticket_number} has been received!`, '✓');
    clearNewTicket();
    showPage('tickets', document.querySelectorAll('.nav-item')[1]);
    loadMyTickets();
  } catch(e) { showNotification('Error', e.message, '⚠'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Submit Ticket`;
  }
}

function setErr(id, msg) {
  document.getElementById(id).classList.add('error');
  const e = document.getElementById(`${id}-err`);
  if (e) { e.textContent = msg; e.classList.add('show'); }
}

function clearNewTicket() {
  ['nt-title','nt-desc'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('nt-category').selectedIndex = 0;
  document.getElementById('nt-priority').value = 'medium';
  clearErrors_nt();
  ntClearFiles();
  // Re-run loadFormData so property/unit prefill and locks are restored
  loadFormData();
}

/* ── Photo attachment handlers ────────────────────────────── */
function ntFilesSelected(event) {
  ntAddFiles(Array.from(event.target.files));
  event.target.value = '';
}

function ntDragOver(event) {
  event.preventDefault();
  const dz = document.getElementById('nt-dropzone');
  if (dz) { dz.style.borderColor = 'var(--blue)'; dz.style.background = 'rgba(59,130,246,.04)'; }
}

function ntDragLeave() {
  const dz = document.getElementById('nt-dropzone');
  if (dz) { dz.style.borderColor = ''; dz.style.background = ''; }
}

function ntDrop(event) {
  event.preventDefault();
  ntDragLeave();
  ntAddFiles(Array.from(event.dataTransfer.files).filter(f => f.type.startsWith('image/')));
}

function ntAddFiles(files) {
  for (const file of files) {
    if (ntFiles.length >= NT_MAX_FILES) {
      showNotification('Too many photos', `Maximum ${NT_MAX_FILES} photos allowed.`, '⚠'); break;
    }
    if (!file.type.startsWith('image/')) {
      showNotification('Invalid file', `${file.name}: only images are supported.`, '⚠'); continue;
    }
    if (file.size > NT_MAX_BYTES) {
      showNotification('File too large', `${file.name} exceeds the 5 MB limit.`, '⚠'); continue;
    }
    const itemId = `ntf-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const reader = new FileReader();
    reader.onload = e => {
      ntFiles.push({ id: itemId, file, dataUrl: e.target.result });
      ntRenderPreviews();
    };
    reader.readAsDataURL(file);
  }
}

function ntRemoveFile(itemId) {
  ntFiles = ntFiles.filter(f => f.id !== itemId);
  ntRenderPreviews();
}

function ntClearFiles() {
  ntFiles = [];
  ntRenderPreviews();
}

function ntRenderPreviews() {
  const grid = document.getElementById('nt-preview-grid');
  const dz   = document.getElementById('nt-dropzone');
  if (!grid) return;

  // Hide drop zone once limit is reached
  if (dz) dz.style.display = ntFiles.length >= NT_MAX_FILES ? 'none' : '';

  grid.innerHTML = ntFiles.map(item => `
    <div style="position:relative;width:80px;height:80px;border-radius:8px;overflow:hidden;border:1.5px solid var(--border);flex-shrink:0;">
      <img src="${item.dataUrl}" alt="${item.file.name}"
        style="width:100%;height:100%;object-fit:cover;display:block;">
      <button onclick="ntRemoveFile('${item.id}')"
        style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.65);border:none;color:#fff;font-size:11px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">
        ✕
      </button>
    </div>`
  ).join('');
}

/* ── Notifications ────────────────────────────────────────── */
async function loadNotifications() {
  const list = document.getElementById('notif-list');
  list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">Loading…</div>';
  try {
    const resp   = await GET('/api/notifications');
    const notifs = resp.data || [];
    if (!notifs.length) {
      list.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted);font-size:13px">No notifications yet.</div>';
      return;
    }
    let unread = 0;
    list.innerHTML = notifs.map(n => {
      if (!n.is_read) unread++;
      return `
        <div style="display:flex;align-items:flex-start;gap:14px;padding:16px 20px;border-bottom:1px solid var(--border-light);cursor:pointer;transition:background .15s;${!n.is_read ? 'background:#f7f9ff;' : ''}"
          id="notif-${n.id}" onclick="readNotif('${n.id}')">
          <div style="width:8px;height:8px;border-radius:50%;margin-top:6px;flex-shrink:0;background:${n.is_read ? 'transparent' : 'var(--blue)'}"></div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:${n.is_read ? 500 : 700};font-size:13.5px;margin-bottom:3px;color:var(--text)">${n.title || 'Notification'}</div>
            <div style="font-size:13px;color:var(--text-2);line-height:1.5">${n.message || ''}</div>
            <div style="font-size:11.5px;color:var(--muted);margin-top:6px;display:flex;align-items:center;gap:4px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${typeof timeAgo === 'function' ? timeAgo(n.created_at) : n.created_at}
            </div>
          </div>
        </div>`;
    }).join('');
    document.getElementById('notif-dot').style.display = unread > 0 ? 'inline-block' : 'none';
  } catch(e) { showNotification('Error', e.message, '⚠'); }
}

async function readNotif(id) {
  try {
    await PUT(`/api/notifications/${id}/read`, {});
    const el = document.getElementById(`notif-${id}`);
    if (el) {
      el.style.background = 'transparent';
      const dot = el.querySelector('div[style*="border-radius:50%"]');
      if (dot) dot.style.background = 'transparent';
    }
  } catch(e) {}
}

async function markAllRead() {
  try {
    await PUT('/api/notifications/read-all', {});
    document.getElementById('notif-dot').style.display = 'none';
    showNotification('All read', 'All notifications marked as read.', '✓');
    loadNotifications();
  } catch(e) { showNotification('Error', e.message, '⚠'); }
}

/* ── Close modal on backdrop click ───────────────────────── */
document.getElementById('ticket-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

/* ── Boot ─────────────────────────────────────────────────── */
loadDashboard();