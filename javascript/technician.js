/* ════════════════════════════════════════════════════════════════
   caretaker.js  —  RentTrack Technician Portal
   All original code preserved exactly.
   Profile functions added at the bottom.
   ════════════════════════════════════════════════════════════════ */

/* ── Init ─────────────────────────────────────────────────── */
const __ENV__ = window.__ENV__ || {};
document.getElementById('sb-app-name').textContent  = __ENV__.APP_NAME || 'RentTrack';
document.getElementById('mobileAppName').textContent = __ENV__.APP_NAME || 'RentTrack';
document.title = `${__ENV__.APP_NAME || 'RentTrack'} — Technician`;

if (typeof Auth !== 'undefined') {
  if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; }
  const user = Auth.user;
  if (!['technician', 'staff'].includes(user?.role)) { window.location.href = 'login.html'; }
  if (user) {
    document.getElementById('sb-name').textContent = user.name || '—';
    // Use photo if available, else initial
    _applyAvatarEl(document.getElementById('sb-avatar'), user);
  }
}

/* ── Avatar helper ────────────────────────────────────────── */
function _applyAvatarEl(el, user) {
  if (!el) return;
  if (user?.profile_photo) {
    el.innerHTML = `<img src="${_hesc(user.profile_photo)}"
      style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`;
  } else {
    el.textContent = ((user?.name) || 'T')[0].toUpperCase();
  }
}

/* ── Mobile Sidebar ───────────────────────────────────────── */
function toggleSidebar() {
  const s = document.getElementById('sidebar'), o = document.getElementById('menuOverlay'), b = document.getElementById('burgerMenu');
  const open = s.classList.toggle('open');
  o.classList.toggle('active', open); b.classList.toggle('active', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeSidebarMobile() {
  if (window.innerWidth <= 768 && document.getElementById('sidebar').classList.contains('open')) toggleSidebar();
}
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('menuOverlay').classList.remove('active');
    document.getElementById('burgerMenu').classList.remove('active');
    document.body.style.overflow = '';
  }
});
let _tx = 0;
document.addEventListener('touchstart', e => { _tx = e.changedTouches[0].screenX; }, { passive: true });
document.addEventListener('touchend', e => {
  if (window.innerWidth > 768) return;
  const dx = e.changedTouches[0].screenX - _tx, sb = document.getElementById('sidebar');
  if (dx > 50 && _tx < 30 && !sb.classList.contains('open')) toggleSidebar();
  if (dx < -50 && _tx > 200 && sb.classList.contains('open')) toggleSidebar();
}, { passive: true });
document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth <= 768 && !localStorage.getItem('swipeHintShown')) {
    const h = document.getElementById('swipeHint');
    if (h) { h.classList.add('show'); localStorage.setItem('swipeHintShown', 'true'); setTimeout(() => h.classList.remove('show'), 3000); }
  }
});

/* ── Notification modal ───────────────────────────────────── */
let _nt = null;
function showNotification(title, message, icon = '') {
  document.getElementById('notification-icon').textContent  = icon;
  document.getElementById('notification-title').textContent = title;
  document.getElementById('notification-message').textContent = message;
  document.getElementById('notification-modal').classList.add('active');
  clearTimeout(_nt); _nt = setTimeout(closeNotificationModal, 4000);
}
function closeNotificationModal() { document.getElementById('notification-modal').classList.remove('active'); }
function toast(msg, type) { showNotification(type === 'error' ? 'Error' : 'Done', msg, type === 'error' ? '⚠' : '✓'); }

/* ── Badges ───────────────────────────────────────────────── */
const SC = { open:'badge-open', in_progress:'badge-in-progress', assigned:'badge-assigned', completed:'badge-completed', closed:'badge-closed', on_hold:'badge-medium' };
const PC = { urgent:'badge-urgent', high:'badge-high', medium:'badge-medium', low:'badge-low' };
const SI = {
  open:        `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  assigned:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  in_progress: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
  on_hold:     `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>`,
  completed:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  closed:      `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
};
const PI = {
  urgent: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  high:   `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>`,
  medium: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  low:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>`,
};
function mb(label, cls, icon) { return `<span class="badge ${cls}">${icon || ''}${label}</span>`; }

/* ── Pagination builder ───────────────────────────────────── */
function buildPagination(containerId, total, perPage, curPage, fnName) {
  const el = document.getElementById(containerId);
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) { el.innerHTML = ''; return; }
  let ph = '';
  for (let i = 1; i <= pages; i++) {
    if (pages <= 7 || Math.abs(i - curPage) <= 2 || i === 1 || i === pages) {
      ph += `<button class="pagination-page ${i === curPage ? 'active' : ''}" onclick="${fnName}(${i})">${i}</button>`;
    } else if (!ph.endsWith('…')) { ph += `<span class="pagination-page" style="cursor:default;color:var(--muted)">…</span>`; }
  }
  el.innerHTML = `<span class="pagination-info">${total} record${total !== 1 ? 's' : ''}</span>
    <div class="pagination-pages" style="display:flex;gap:4px;align-items:center;">
      <button class="pagination-btn" onclick="${fnName}(${curPage - 1})" ${curPage <= 1 ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>${ph}
      <button class="pagination-btn" onclick="${fnName}(${curPage + 1})" ${curPage >= pages ? 'disabled' : ''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>`;
}

/* ── State ────────────────────────────────────────────────── */
let activeJobs = [], allCompleted = [], filteredCompleted = [];
let currentJobFilter = '', openJobId = null;
let jobsPage = 1, completedPage = 1;
const JPP = 12, CPP = 15;

/* ── Navigation ───────────────────────────────────────────── */
function showPage(id, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${id}`);
  if (!pageEl) return;
  pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  const t = { jobs: 'My Jobs', completed: 'Completed Jobs', notifications: 'Notifications', profile: 'My Profile' };
  document.getElementById('page-title').textContent = t[id] || '';
  if (id === 'jobs')          loadJobs();
  if (id === 'completed')     loadCompleted();
  if (id === 'notifications') loadNotifications();
  if (id === 'profile')       loadProfile();
}

function logout() {
  if (typeof Auth !== 'undefined') Auth.clear();
  sessionStorage.setItem('rt_logged_out', '1');
  window.location.replace('login.html');
}

function refreshCurrent() {
  const a = document.querySelector('.page.active');
  if (a?.id === 'page-jobs')          loadJobs();
  if (a?.id === 'page-completed')     loadCompleted();
  if (a?.id === 'page-notifications') loadNotifications();
  if (a?.id === 'page-profile')       loadProfile();
}

/* ── My Jobs ──────────────────────────────────────────────── */
async function loadJobs() {
  try {
    const resp = await GET('/api/tickets'); const all = resp.data || [];
    activeJobs = all.filter(t => !['completed', 'closed', 'cancelled'].includes(t.status));
    let a = 0, ip = 0, u = 0, h = 0;
    activeJobs.forEach(t => { if (t.status === 'assigned') a++; if (t.status === 'in_progress') ip++; if (t.priority === 'urgent') u++; if (t.status === 'on_hold') h++; });
    document.getElementById('st-assigned').textContent  = a;
    document.getElementById('st-inprogress').textContent = ip;
    document.getElementById('st-urgent').textContent    = u;
    document.getElementById('st-hold').textContent      = h;
    document.getElementById('jobs-dot').style.display   = a > 0 ? 'inline-block' : 'none';
    currentJobFilter = ''; jobsPage = 1;
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    document.querySelector('.filter-pill[data-status=""]')?.classList.add('active');
    applyJobFilters();
  } catch (e) { toast(e.message, 'error'); }
}

function filterJobs(el) {
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active'); currentJobFilter = el.dataset.status || ''; jobsPage = 1; applyJobFilters();
}

function applyJobFilters() {
  const s = (document.getElementById('job-search')?.value || '').toLowerCase();
  const prio = { urgent: 0, high: 1, medium: 2, low: 3 };
  let f = activeJobs.filter(t => {
    const ms = !s || t.title.toLowerCase().includes(s) || (t.ticket_number || '').toLowerCase().includes(s);
    const mf = !currentJobFilter || t.status === currentJobFilter;
    return ms && mf;
  });
  f.sort((a, b) => (prio[a.priority] ?? 4) - (prio[b.priority] ?? 4) || new Date(b.created_at) - new Date(a.created_at));
  renderJobsGrid(f);
}

function renderJobsGrid(f) {
  const grid = document.getElementById('jobs-grid');
  if (!f.length) {
    grid.innerHTML = `<div style="text-align:center;padding:56px 24px;color:var(--muted);grid-column:1/-1;font-size:13px;">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.2;margin:0 auto 14px;display:block"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <p>No active jobs${currentJobFilter ? ' with status "' + currentJobFilter.replace(/_/g, ' ') + '"' : ''}.</p>
    </div>`;
    document.getElementById('jobs-pagination').innerHTML = ''; return;
  }
  if (jobsPage > Math.ceil(f.length / JPP)) jobsPage = 1;
  const page = f.slice((jobsPage - 1) * JPP, jobsPage * JPP);
  grid.innerHTML = page.map(t => {
    const sl = (t.status || 'unknown').replace(/_/g, ' ');
    const pl = t.priority || 'unknown';
    const acts = t.status === 'assigned'
      ? `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();quickStatus('${t.id}','in_progress')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start Job</button>`
      : t.status === 'in_progress'
      ? `<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();quickStatus('${t.id}','completed')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Complete</button>
         <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();quickStatus('${t.id}','on_hold')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>Hold</button>`
      : t.status === 'on_hold'
      ? `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();quickStatus('${t.id}','in_progress')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Resume</button>` : '';
    return `<div class="job-card priority-${t.priority || 'medium'}" onclick="openJobModal('${t.id}')">
      <div class="job-card-title">${_hesc(t.title || 'Untitled')}</div>
      <div class="job-card-number">${_hesc(t.ticket_number || '—')}</div>
      <div class="job-card-badges">
        ${mb(sl, SC[t.status] || 'badge-closed', SI[t.status] || '')}
        ${mb(pl, PC[t.priority] || 'badge-medium', PI[t.priority] || '')}
        ${t.category_name ? `<span class="badge badge-category"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>${_hesc(t.category_name)}</span>` : ''}
      </div>
      <div class="job-card-meta">
        <span class="job-card-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${_hesc(t.property_name || '—')}</span>
        ${t.unit_number ? `<span class="job-card-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Unit ${_hesc(t.unit_number)}</span>` : ''}
        <span class="job-card-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${typeof timeAgo === 'function' ? timeAgo(t.created_at) : t.created_at}</span>
      </div>
      <div class="job-card-actions">
        ${acts}
        <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="event.stopPropagation();openJobModal('${t.id}')">Details <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></button>
      </div>
    </div>`;
  }).join('');
  buildPagination('jobs-pagination', f.length, JPP, jobsPage, 'changeJobsPage');
}

function changeJobsPage(p) {
  const s = (document.getElementById('job-search')?.value || '').toLowerCase();
  const prio = { urgent: 0, high: 1, medium: 2, low: 3 };
  let f = activeJobs.filter(t => {
    const ms = !s || t.title.toLowerCase().includes(s) || (t.ticket_number || '').toLowerCase().includes(s);
    const mf = !currentJobFilter || t.status === currentJobFilter;
    return ms && mf;
  });
  f.sort((a, b) => (prio[a.priority] ?? 4) - (prio[b.priority] ?? 4) || new Date(b.created_at) - new Date(a.created_at));
  const max = Math.ceil(f.length / JPP); if (p < 1 || p > max) return;
  jobsPage = p; renderJobsGrid(f); window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function quickStatus(id, status) {
  try {
    await POST(`/api/tickets/${id}/status`, { status });
    const m = { completed: 'Job completed', in_progress: 'Job started', on_hold: 'Job put on hold' };
    toast(m[status] || 'Status updated'); loadJobs();
  } catch (e) { toast(e.message, 'error'); }
}

/* ── Job detail modal ─────────────────────────────────────── */
async function openJobModal(id) {
  openJobId = id;
  document.getElementById('job-modal').classList.add('open');
  document.getElementById('modal-tk-body').innerHTML = `<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px;"><div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--tech);margin:0 auto 12px;width:22px;height:22px;"></div>Loading…</div>`;
  document.getElementById('modal-tk-badges').innerHTML = '';
  document.getElementById('modal-updates-list').innerHTML = '';
  try {
    const [tkR, updR, attR] = await Promise.all([
      GET(`/api/tickets/${id}`),
      GET(`/api/tickets/${id}/updates`),
      GET(`/api/tickets/${id}/attachments`).catch(() => ({ data: [] })),
    ]);
    const t = tkR.data, updates = updR.data || [], attachments = attR.data || [];
    document.getElementById('modal-tk-num').textContent = t.ticket_number || '—';
    document.getElementById('modal-tk-badges').innerHTML = `
      ${mb((t.status || 'unknown').replace(/_/g, ' '), SC[t.status] || 'badge-closed', SI[t.status] || '')}
      ${mb(t.priority || 'unknown', PC[t.priority] || 'badge-medium', PI[t.priority] || '')}
      ${t.category_name ? `<span class="badge badge-category"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>${_hesc(t.category_name)}</span>` : ''}`;

    const sel = document.getElementById('modal-status-sel');
    const next = t.status === 'assigned' ? 'in_progress' : t.status === 'in_progress' ? 'completed' : 'in_progress';
    Array.from(sel.options).forEach(o => o.selected = o.value === next);

    // Images from attachments
    const images = attachments.filter(a => a.file_type === 'image' || (a.mime_type || '').startsWith('image/'));
    const imgUrls = images.map(a => a.file_url);
    const imgHtml = images.length ? `
      <div style="margin-top:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px">Photos (${images.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${images.map((a, i) => `
            <div onclick='_lbOpen(${i},${JSON.stringify(imgUrls)})'
                 style="width:80px;height:80px;border-radius:8px;overflow:hidden;cursor:pointer;border:1.5px solid var(--border);flex-shrink:0">
              <img src="${_hesc(a.file_url)}" alt="${_hesc(a.file_name || 'photo')}"
                   style="width:100%;height:100%;object-fit:cover;display:block"
                   onerror="this.parentElement.innerHTML='<div style=\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f3f4f6;font-size:22px\'>🖼️</div>'">
            </div>`).join('')}
        </div>
      </div>` : '';

    document.getElementById('modal-tk-body').innerHTML = `
      <h4 style="font-size:18px;font-weight:700;margin-bottom:10px;color:var(--text);text-transform:capitalize;line-height:1.3;">${_hesc(t.title || 'Untitled')}</h4>
      ${t.description ? `<div style="font-size:13.5px;color:var(--text-2);line-height:1.65;padding:14px 16px;background:var(--surface);border-radius:var(--radius-sm);border:1px solid var(--border-light);margin-bottom:4px;">${_hesc(t.description)}</div>` : ''}
      <div class="detail-grid">
        <div class="detail-block">
          <div class="detail-block-label"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>Location</div>
          <div class="detail-block-value">${_hesc(t.property_name || '—')}</div>
          ${t.unit_number ? `<div class="detail-block-sub"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Unit ${_hesc(t.unit_number)}</div>` : ''}
          ${t.area_name ? `<div class="detail-block-sub">${_hesc(t.area_name)}</div>` : ''}
        </div>
        <div class="detail-block">
          <div class="detail-block-label"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:3px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Report Details</div>
          <div class="detail-block-sub"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Reported by <strong style="color:var(--text);margin-left:3px">${_hesc(t.created_by_name || '—')}</strong></div>
          <div class="detail-block-sub" style="margin-top:4px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${typeof fmtDate === 'function' ? fmtDate(t.created_at) : t.created_at}</div>
          ${t.due_date ? `<div class="detail-block-sub" style="margin-top:4px;color:#b91c1c;font-weight:600;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Due ${typeof fmtDate === 'function' ? fmtDate(t.due_date) : t.due_date}</div>` : ''}
        </div>
      </div>
      ${imgHtml}`;

    document.getElementById('modal-updates-list').innerHTML = updates.length
      ? updates.map(u => `
          <div class="update-item">
            <div class="update-avatar">${_hesc((u.user_name || '?')[0].toUpperCase())}</div>
            <div class="update-body">
              <div class="update-meta">
                <strong>${_hesc(u.user_name || 'System')}</strong>
                <span>${typeof timeAgo === 'function' ? timeAgo(u.created_at) : u.created_at}</span>
                ${u.is_internal ? `<span class="badge badge-medium" style="font-size:10px;">Internal</span>` : ''}
              </div>
              ${u.status_change
                ? `<div class="update-msg" style="font-style:italic;color:var(--muted)">Status changed to <strong>${u.status_change.replace(/_/g, ' ')}</strong></div>`
                : `<div class="update-msg">${_hesc(u.message || '')}</div>`}
            </div>
          </div>`).join('')
      : '<p style="color:var(--muted);font-size:13px;padding:8px 0;">No updates yet.</p>';

  } catch (e) { toast(e.message, 'error'); }
}

function closeJobModal() { document.getElementById('job-modal').classList.remove('open'); openJobId = null; }

async function quickUpdateStatus() {
  const status = document.getElementById('modal-status-sel').value;
  try {
    await POST(`/api/tickets/${openJobId}/status`, { status });
    const m = { completed: 'Job marked complete', in_progress: 'Job started', on_hold: 'Job put on hold' };
    toast(m[status] || 'Status updated'); closeJobModal(); loadJobs();
  } catch (e) { toast(e.message, 'error'); }
}

async function postComment() {
  const msg = document.getElementById('modal-comment').value.trim(); if (!msg) return;
  try {
    await POST(`/api/tickets/${openJobId}/updates`, { message: msg, is_internal: false });
    document.getElementById('modal-comment').value = ''; toast('Update posted'); openJobModal(openJobId);
  } catch (e) { toast(e.message, 'error'); }
}

/* ── Completed ────────────────────────────────────────────── */
async function loadCompleted() {
  document.getElementById('completed-body').innerHTML = `<tr class="loading-row"><td colspan="6" style="text-align:center;padding:32px;">Loading…</td></tr>`;
  document.getElementById('completed-pagination').innerHTML = '';
  try {
    const resp = await GET('/api/tickets?status=completed');
    allCompleted = resp.data || []; filteredCompleted = [...allCompleted]; completedPage = 1; renderCompletedTable();
  } catch (e) { toast(e.message, 'error'); }
}

function applyCompletedSearch() {
  const s = (document.getElementById('completed-search')?.value || '').toLowerCase();
  filteredCompleted = s ? allCompleted.filter(t => t.title.toLowerCase().includes(s) || (t.ticket_number || '').toLowerCase().includes(s) || (t.property_name || '').toLowerCase().includes(s)) : [...allCompleted];
  completedPage = 1; renderCompletedTable();
}

function renderCompletedTable() {
  const tbody = document.getElementById('completed-body');
  if (!filteredCompleted.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);font-size:13px;">No completed jobs found.</td></tr>`;
    document.getElementById('completed-pagination').innerHTML = ''; return;
  }
  const page = filteredCompleted.slice((completedPage - 1) * CPP, completedPage * CPP);
  tbody.innerHTML = page.map(t => `
    <tr onclick="openJobModal('${t.id}')">
      <td data-label="Ticket #"><span style="font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--muted);font-weight:500;">${_hesc(t.ticket_number || '—')}</span></td>
      <td data-label="Title"><span style="font-weight:500;text-transform:capitalize;color:var(--text);">${_hesc(t.title || '—')}</span></td>
      <td data-label="Property / Unit">
        <div style="font-size:13px;color:var(--text-2);font-weight:500;">${_hesc(t.property_name || '—')}</div>
        ${t.unit_number ? `<div style="font-size:11.5px;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Unit ${_hesc(t.unit_number)}</div>` : ''}
      </td>
      <td data-label="Category"><span style="font-size:12.5px;color:var(--text-2);">${_hesc(t.category_name || '—')}</span></td>
      <td data-label="Priority">${mb(t.priority || 'unknown', PC[t.priority] || 'badge-medium', PI[t.priority] || '')}</td>
      <td data-label="Completed"><span style="font-size:12.5px;color:var(--muted);">${typeof fmtDate === 'function' ? fmtDate(t.completed_at || t.updated_at) : (t.completed_at || t.updated_at)}</span></td>
    </tr>`).join('');
  buildPagination('completed-pagination', filteredCompleted.length, CPP, completedPage, 'changeCompletedPage');
}

function changeCompletedPage(p) {
  const max = Math.ceil(filteredCompleted.length / CPP); if (p < 1 || p > max) return;
  completedPage = p; renderCompletedTable(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Notifications ────────────────────────────────────────── */
async function loadNotifications() {
  const list = document.getElementById('notif-list');
  list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px;">Loading…</div>';
  try {
    const resp = await GET('/api/notifications'); const notifs = resp.data || []; let unread = 0;
    list.innerHTML = notifs.length
      ? notifs.map(n => {
          if (!n.is_read) unread++;
          return `<div style="display:flex;align-items:flex-start;gap:14px;padding:16px 20px;border-bottom:1px solid var(--border-light);cursor:pointer;transition:background .15s;${!n.is_read ? 'background:#f0f9ff;' : ''}"
                       id="notif-${n.id}" onclick="readNotif('${n.id}')">
            <div style="width:8px;height:8px;border-radius:50%;margin-top:6px;flex-shrink:0;background:${n.is_read ? 'transparent' : 'var(--tech)'}"></div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:${n.is_read ? 500 : 700};font-size:13.5px;margin-bottom:3px;color:var(--text)">${_hesc(n.title || 'Notification')}</div>
              <div style="font-size:13px;color:var(--text-2);line-height:1.5;">${_hesc(n.message || '')}</div>
              <div style="font-size:11.5px;color:var(--muted);margin-top:6px;display:flex;align-items:center;gap:4px;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${typeof timeAgo === 'function' ? timeAgo(n.created_at) : n.created_at}
              </div>
            </div>
          </div>`;
        }).join('')
      : '<div style="text-align:center;padding:48px;color:var(--muted);font-size:13px;">No notifications yet.</div>';
    document.getElementById('notif-dot').style.display = unread > 0 ? 'inline-block' : 'none';
  } catch (e) { toast(e.message, 'error'); }
}

async function readNotif(id) {
  try {
    await PUT(`/api/notifications/${id}/read`, {});
    const el = document.getElementById(`notif-${id}`);
    if (el) { el.style.background = 'transparent'; const d = el.querySelector('div[style*="border-radius:50%"]'); if (d) d.style.background = 'transparent'; }
  } catch (e) { /* silent */ }
}

async function markAllRead() {
  try {
    await PUT('/api/notifications/read-all', {});
    document.getElementById('notif-dot').style.display = 'none';
    toast('All notifications marked as read'); loadNotifications();
  } catch (e) { toast(e.message, 'error'); }
}

/* ════════════════════════════════════════════════════════════
   PROFILE
   Called by showPage('profile') — which is triggered when the
   sidebar avatar/name is clicked.
   ════════════════════════════════════════════════════════════ */

async function loadProfile() {
  try {
    const res = await GET('/api/auth/me');
    const u   = res.data;
    if (!u) return;

    // Sync Auth cache
    if (typeof Auth !== 'undefined' && Auth.user) Object.assign(Auth.user, u);

    // Avatar in profile card
    const avatarEl = document.getElementById('profile-avatar');
    if (avatarEl) {
      if (u.profile_photo) {
        avatarEl.innerHTML = `<img src="${_hesc(u.profile_photo)}"
          style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`;
      } else {
        const initials = (u.name || 'T').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        avatarEl.textContent = initials;
      }
    }

    // Display fields
    _st('profile-name-display',  u.name  || '—');
    _st('profile-email-display', u.email || '—');
    _st('profile-role-display',  _cap(u.role || ''));
    _st('profile-last-login',    u.last_login
      ? new Date(u.last_login).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Never');

    // Form fields
    _sv('profile-name',  u.name  || '');
    _sv('profile-email', u.email || '');
    _sv('profile-phone', u.phone || '');

    // Clear password fields
    ['current-password', 'new-password', 'confirm-password'].forEach(id => _sv(id, ''));

    // Sync sidebar avatar + name with fresh data
    _applyAvatarEl(document.getElementById('sb-avatar'), u);
    _st('sb-name', u.name || '');
    _st('sb-role', _cap(u.role || ''));

  } catch (e) { toast('Could not load profile: ' + e.message, 'error'); }
}

async function saveProfileChanges() {
  const name  = (document.getElementById('profile-name')?.value  || '').trim();
  const email = (document.getElementById('profile-email')?.value || '').trim();
  const phone = (document.getElementById('profile-phone')?.value || '').trim();
  const curPw = document.getElementById('current-password')?.value || '';
  const newPw = document.getElementById('new-password')?.value    || '';
  const conPw = document.getElementById('confirm-password')?.value || '';

  if (!name)  { toast('Name is required.', 'error');  return; }
  if (!email) { toast('Email is required.', 'error'); return; }

  let anyError = false;

  // Save profile info
  try {
    await PUT('/api/auth/profile', { name, email, phone: phone || undefined });
  } catch (e) {
    toast(e.message || 'Could not update profile.', 'error'); anyError = true;
  }

  // Change password only if any field has been filled in
  if (curPw || newPw || conPw) {
    if (!curPw)           { toast('Enter your current password.',        'error'); return; }
    if (newPw.length < 8) { toast('New password must be 8+ characters.', 'error'); return; }
    if (newPw !== conPw)  { toast('New passwords do not match.',          'error'); return; }
    try {
      await POST('/api/auth/change-password', { current_password: curPw, new_password: newPw });
      ['current-password', 'new-password', 'confirm-password'].forEach(id => _sv(id, ''));
    } catch (e) {
      toast(e.message || 'Could not change password.', 'error'); anyError = true;
    }
  }

  if (!anyError) {
    toast('Profile saved successfully.', 'success');
    loadProfile();
  }
}

async function handleProfilePhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Photo must be under 5 MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      await PUT('/api/auth/profile', { profile_photo: ev.target.result });
      toast('Profile photo updated.', 'success');
      loadProfile();
    } catch (e) { toast(e.message, 'error'); }
  };
  reader.readAsDataURL(file);
}

function togglePassword(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

/* ── Image lightbox ───────────────────────────────────────── */
let _lbUrls = [], _lbIdx = 0;

function _lbOpen(index, urls) { _lbUrls = urls; _lbIdx = index; _lbRender(); }

function _lbRender() {
  document.getElementById('_rt-lb')?.remove();
  const lb = document.createElement('div');
  lb.id = '_rt-lb';
  lb.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
  lb.innerHTML = `
    <button onclick="_lbClose()" style="position:absolute;top:16px;right:20px;background:rgba(255,255,255,.12);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
    <div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.6);font-size:13px;white-space:nowrap">${_lbIdx + 1} / ${_lbUrls.length}</div>
    <img src="${_hesc(_lbUrls[_lbIdx])}" style="max-width:90vw;max-height:78vh;object-fit:contain;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.7)" onerror="this.alt='Could not load image'">
    ${_lbUrls.length > 1 ? `
      <button onclick="_lbPrev()" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;color:#fff;width:44px;height:44px;border-radius:50%;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>
      <button onclick="_lbNext()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;color:#fff;width:44px;height:44px;border-radius:50%;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center">›</button>
      <div style="display:flex;gap:8px;margin-top:16px;overflow-x:auto;max-width:90vw;padding:4px 0">
        ${_lbUrls.map((url, i) => `<img src="${_hesc(url)}" onclick="_lbGoto(${i})" style="width:54px;height:54px;object-fit:cover;border-radius:6px;cursor:pointer;flex-shrink:0;opacity:${i === _lbIdx ? 1 : .45};border:2px solid ${i === _lbIdx ? 'white' : 'transparent'};transition:opacity .2s">`).join('')}
      </div>` : ''}`;
  lb.addEventListener('click', e => { if (e.target === lb) _lbClose(); });
  document.body.appendChild(lb);
  document.addEventListener('keydown', _lbKey);
}
function _lbKey(e) { if (e.key === 'ArrowRight') _lbNext(); if (e.key === 'ArrowLeft') _lbPrev(); if (e.key === 'Escape') _lbClose(); }
function _lbNext() { _lbIdx = (_lbIdx + 1) % _lbUrls.length; _lbRender(); }
function _lbPrev() { _lbIdx = (_lbIdx - 1 + _lbUrls.length) % _lbUrls.length; _lbRender(); }
function _lbGoto(i) { _lbIdx = i; _lbRender(); }
function _lbClose() { document.getElementById('_rt-lb')?.remove(); document.removeEventListener('keydown', _lbKey); }

/* ── Utilities ────────────────────────────────────────────── */
function _hesc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _st(id, v)  { const el = document.getElementById(id); if (el) el.textContent = v; }
function _sv(id, v)  { const el = document.getElementById(id); if (el) el.value = v; }
function _cap(s)     { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

/* ── Modal backdrop close ─────────────────────────────────── */
document.getElementById('job-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeJobModal(); });


function showProfile() {
  showPage('profile', null);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
}

/* ── Boot ─────────────────────────────────────────────────── */
loadJobs();