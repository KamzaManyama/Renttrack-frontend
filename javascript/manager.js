// ============================================================
// manager.js — Navigation & Shared Utilities
// ============================================================

document.getElementById('sb-app-name').textContent = (typeof ENV !== 'undefined' && ENV.APP_NAME) ? ENV.APP_NAME : 'RentTrack';
document.title = `${(typeof ENV !== 'undefined' && ENV.APP_NAME) ? ENV.APP_NAME : 'RentTrack'} — Manager`;

if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; throw new Error('Not logged in'); }
const user = Auth.user;
if (!user || !['manager','maintenance_admin'].includes(user.role)) { window.location.href = 'login.html'; throw new Error('Unauthorized'); }

document.getElementById('sb-name').textContent       = user?.name || '—';
document.getElementById('sb-avatar').textContent     = (user?.name || 'M')[0].toUpperCase();
document.getElementById('sb-role').textContent       = (user?.role || '').replace('_',' ');
document.getElementById('sb-role-label').textContent = user?.role === 'manager' ? 'Manager Portal' : 'Maintenance Admin';

// ── Navigation ─────────────────────────────────────────────────
function showPage(id, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${id}`).classList.add('active');
  if (navEl) navEl.classList.add('active');
  const titles = {
    dashboard: 'Dashboard',
    tickets: 'Tickets',
    approvals: 'Registration Approvals',
    metrics: 'Ticket Metrics',
    schedules: 'Maintenance Schedules',
    properties: 'Properties',
    units: 'Units & Tenants',
    billing: 'Billing & Payments',
    users: 'Users',
    reports: 'Reports',
    profile: 'My Profile',
    notifications: 'Notifications',
  };
  document.getElementById('page-title').textContent = titles[id] || '';
  document.getElementById('topbar-actions').innerHTML = '';

  if (id === 'dashboard')   loadDashboard();
  if (id === 'tickets')     loadTickets();
  if (id === 'approvals')   loadApprovals();
  if (id === 'metrics')     { metricsTab('overview', document.querySelector('#page-metrics .tab-btn.active') || document.querySelector('#page-metrics .tab-btn')); }
  if (id === 'schedules')   loadSchedules();
  if (id === 'properties')  loadProperties();
  if (id === 'units')       initUnitsPage();
  if (id === 'billing')     { billingTab('invoices', document.querySelector('#page-billing .tab-btn')); }
  if (id === 'users')       loadUsers();
  if (id === 'reports')     { reportTab('tickets', document.querySelector('#page-reports .tab-btn')); }
  if (id === 'profile')     loadProfile();
  if (id === 'notifications') loadNotifications();
}

function logout() {
  Auth.clear();
  sessionStorage.setItem('rt_logged_out', '1');
  window.location.replace('login.html');
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-backdrop').forEach(b => {
  b.addEventListener('click', e => { if (e.target === b) b.classList.remove('open'); });
});

function togglePassword(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

function fErr(id, msg) {
  document.getElementById(id)?.classList.add('error');
  const e = document.getElementById(`${id}-err`);
  if (e) { e.textContent = msg; e.classList.add('show'); }
}
function clearErr(id) {
  document.getElementById(id)?.classList.remove('error');
  const e = document.getElementById(`${id}-err`);
  if (e) { e.textContent = ''; e.classList.remove('show'); }
}

// ── Reports ────────────────────────────────────────────────────
async function reportTab(tab, el) {
  document.querySelectorAll('#page-reports .tab-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const container = document.getElementById('report-content');
  container.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted)">Loading...</div>';
  try {
    if (tab === 'tickets') {
      const resp = await GET('/api/reports/tickets');
      const r = resp.data || {};
      container.innerHTML = `<div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Total Tickets</div><div class="kpi-value">${r.total || 0}</div></div>
        <div class="kpi"><div class="kpi-label">Open</div><div class="kpi-value" style="color:#1d4ed8">${r.by_status?.open || 0}</div></div>
        <div class="kpi"><div class="kpi-label">In Progress</div><div class="kpi-value" style="color:#b45309">${r.by_status?.in_progress || 0}</div></div>
        <div class="kpi"><div class="kpi-label">Completed</div><div class="kpi-value" style="color:#15803d">${r.by_status?.completed || 0}</div></div>
        <div class="kpi"><div class="kpi-label">Avg Resolution</div><div class="kpi-value">${r.avg_resolution_days ? Number(r.avg_resolution_days).toFixed(1) + 'd' : '—'}</div></div>
        <div class="kpi"><div class="kpi-label">Urgent</div><div class="kpi-value" style="color:#b91c1c">${r.by_priority?.urgent || 0}</div></div>
      </div>`;
    } else if (tab === 'technicians') {
      const resp = await GET('/api/reports/technicians');
      const rows = resp.data || [];
      container.innerHTML = `<div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Technician</th><th>Total Assigned</th><th>Completed</th><th>Avg Hours</th></tr></thead>
        <tbody>${rows.map(r => `<tr><td style="font-weight:600">${r.technician}</td><td>${r.total || 0}</td><td style="color:#15803d;font-weight:600">${r.completed || 0}</td><td>${r.avg_hours ? Number(r.avg_hours).toFixed(1) : '—'}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">No data available.</td></tr>'}
        </tbody></table></div></div>`;
    } else if (tab === 'costs') {
      const resp = await GET('/api/reports/costs');
      const r = resp.data || {};
      container.innerHTML = `<div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Parts Cost</div><div class="kpi-value">R${Number(r.total_parts || 0).toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-label">Labour Cost</div><div class="kpi-value">R${Number(r.total_labour || 0).toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-label">Grand Total</div><div class="kpi-value">R${Number(r.total || 0).toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-label">Tickets with Costs</div><div class="kpi-value">${r.tickets_with_costs || 0}</div></div>
      </div>`;
    }
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:#b91c1c">${e.message}</div>`;
  }
}

// ── Notifications ─────────────────────────────────────────────
async function loadNotifications() {
  const list = document.getElementById('notif-list');
  list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Loading...</div>';
  try {
    const resp = await GET('/api/notifications');
    const notifs = resp.data || [];
    let unread = 0;
    list.innerHTML = notifs.length
      ? notifs.map(n => {
          if (!n.is_read) unread++;
          return `<div style="display:flex;gap:14px;align-items:flex-start;padding:16px 20px;border-bottom:1px solid var(--border);${!n.is_read ? 'background:#fafbff;' : ''}cursor:pointer" onclick="readNotif('${n.id}',this)">
            <div style="width:8px;height:8px;border-radius:50%;background:${n.is_read ? 'transparent' : 'var(--blue)'};margin-top:6px;flex-shrink:0"></div>
            <div style="flex:1">
              <div style="font-weight:${n.is_read ? 500 : 700};font-size:13.5px;margin-bottom:3px">${n.title || 'Notification'}</div>
              <div style="font-size:13px;color:var(--text-2)">${n.message || ''}</div>
              <div style="font-size:11.5px;color:var(--muted);margin-top:6px">${timeAgo(n.created_at)}</div>
            </div>
          </div>`;
        }).join('')
      : '<div style="text-align:center;padding:48px;color:var(--muted)">No notifications.</div>';
    if (unread > 0) document.getElementById('notif-dot').style.display = 'inline-block';
  } catch (e) { toast(e.message, 'error'); }
}

async function readNotif(id, el) {
  try {
    await PUT(`/api/notifications/${id}/read`, {});
    el.style.background = 'transparent';
  } catch (e) {}
}

async function markAllRead() {
  try {
    await PUT('/api/notifications/read-all', {});
    toast('All notifications marked as read');
    document.getElementById('notif-dot').style.display = 'none';
    loadNotifications();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Boot ───────────────────────────────────────────────────────
// Scripts load synchronously at bottom of body so DOM is ready,
// but we guard with readyState in case of any async edge cases.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => loadDashboard());
} else {
  loadDashboard();
}

// ── Notification Filtering ────────────────────────────────────
let _allNotifs = [];
let _notifFilter = 'all';

function filterNotifs(el) {
  el.closest('.filter-pills').querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  _notifFilter = el.dataset.nfilter || 'all';
  renderNotifList();
}

function renderNotifList() {
  const filtered = _allNotifs.filter(n => {
    if (_notifFilter === 'unread') return !n.is_read;
    if (_notifFilter === 'system') return n.type === 'system';
    if (_notifFilter === 'maintenance') return n.type === 'maintenance';
    return true;
  });
  const list = document.getElementById('notif-list');
  list.innerHTML = filtered.length
    ? filtered.map(n => {
        const typeClass = `notif-type-${n.type || 'general'}`;
        const typeLabel = (n.type || 'general').charAt(0).toUpperCase() + (n.type || 'general').slice(1);
        return `<div class="notif-item ${!n.is_read ? 'unread' : ''}" onclick="readNotif('${n.id}', this)">
          <div class="notif-dot" style="background:${n.is_read ? 'transparent' : 'var(--blue, #007AFF)'}"></div>
          <div style="flex:1;min-width:0">
            <div class="notif-type-badge ${typeClass}">${typeLabel}</div>
            <div style="font-weight:${n.is_read ? 500 : 700};font-size:13.5px;margin-bottom:3px">${n.title || 'Notification'}</div>
            <div style="font-size:13px;color:var(--text-2);line-height:1.5">${n.message || ''}</div>
            <div style="font-size:11.5px;color:var(--muted);margin-top:6px">${timeAgo(n.created_at)}</div>
          </div>
        </div>`;
      }).join('')
    : '<div style="text-align:center;padding:48px;color:var(--muted)">No notifications.</div>';
}

// Override loadNotifications to use the new renderer
var _origLoadNotifications = loadNotifications;
loadNotifications = async function() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Loading...</div>';
  try {
    const resp = await GET('/api/notifications');
    _allNotifs = resp.data || [];
    renderNotifList();
    const unread = _allNotifs.filter(n => !n.is_read).length;
    if (unread > 0) document.getElementById('notif-dot').style.display = 'inline-block';
  } catch (e) { toast(e.message, 'error'); }
};

// ── Compose & Broadcast ───────────────────────────────────────
function previewNotification() {
  const title   = document.getElementById('cn-title').value.trim();
  const message = document.getElementById('cn-message').value.trim();
  const recip   = document.getElementById('cn-recipients').value;
  const type    = document.getElementById('cn-type').value;
  const preview = document.getElementById('cn-preview');
  if (!title && !message) return;
  document.getElementById('cn-preview-title').textContent   = title || '(no title)';
  document.getElementById('cn-preview-message').textContent = message || '(no message)';
  document.getElementById('cn-preview-meta').textContent    = `To: ${recip} users  |  Type: ${type}`;
  preview.style.display = '';
}

async function sendNotification() {
  const title   = document.getElementById('cn-title').value.trim();
  const message = document.getElementById('cn-message').value.trim();
  const recip   = document.getElementById('cn-recipients').value;
  const type    = document.getElementById('cn-type').value;

  ['cn-title','cn-message'].forEach(id => clearErr(id));
  let valid = true;
  if (!title)   { fErr('cn-title',   'Title is required'); valid = false; }
  if (!message) { fErr('cn-message', 'Message is required'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('btn-send-notif');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await POST('/api/notifications/broadcast', {
      title, message,
      recipient_role: recip === 'all' ? undefined : recip,
      type,
    });
    toast(`Notification sent to ${recip === 'all' ? 'all users' : recip + 's'}`);
    closeModal('compose-modal');
    document.getElementById('cn-title').value   = '';
    document.getElementById('cn-message').value = '';
    document.getElementById('cn-preview').style.display = 'none';
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Send Notification'; }
}

async function sendQuickBroadcast() {
  const message = document.getElementById('quick-message').value.trim();
  const recip   = document.getElementById('quick-recipients').value;
  if (!message) { toast('Type a message first', 'error'); return; }
  try {
    await POST('/api/notifications/broadcast', {
      title: 'Message from Management',
      message,
      recipient_role: recip === 'all' ? undefined : recip,
      type: 'general',
    });
    toast(`Sent to ${recip === 'all' ? 'all users' : recip + 's'}`);
    document.getElementById('quick-message').value = '';
  } catch (e) { toast(e.message, 'error'); }
}

function saveNotifPrefs() {
  const prefs = {
    maintenance: document.getElementById('notif-toggle-maintenance')?.checked,
    tickets:     document.getElementById('notif-toggle-tickets')?.checked,
    urgent:      document.getElementById('notif-toggle-urgent')?.checked,
    occupancy:   document.getElementById('notif-toggle-occupancy')?.checked,
  };
  // Persist to local storage until a preferences API endpoint is available
  localStorage.setItem('notif_prefs', JSON.stringify(prefs));
  toast('Notification preferences saved');
}