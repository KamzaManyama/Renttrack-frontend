// ── Announcements ─────────────────────────────────────────────
// Uses the shared api() helpers (GET / POST / PUT / DELETE)
// defined in your app.js — same pattern as every other page.

let announcements                = [];
let currentEditingAnnouncementId = null;

// ── Load & render list ────────────────────────────────────────
async function loadAnnouncements() {
  const priority = document.getElementById('announcement-filter')?.value || 'all';
  const status   = document.getElementById('announcement-status')?.value  || 'all';
  const search   = document.getElementById('announcement-search')?.value  || '';

  const params = new URLSearchParams();
  if (priority !== 'all') params.set('priority', priority);
  if (status   !== 'all') params.set('status',   status);
  if (search.trim())      params.set('search',   search.trim());

  const container = document.getElementById('announcements-container');
  if (container) container.innerHTML = `
    <div style="padding:48px;text-align:center;color:var(--muted)">Loading…</div>`;

  try {
    const qs   = params.toString() ? `?${params}` : '';
    const json = await GET(`/api/announcements${qs}`);
    announcements = json.data || [];
    renderAnnouncementList();
  } catch (e) {
    if (container) container.innerHTML = `
      <div style="padding:48px;text-align:center;color:var(--muted)">
        Failed to load: ${e.message}
      </div>`;
    toast(e.message, 'error');
  }
}

function renderAnnouncementList() {
  const container = document.getElementById('announcements-container');
  const empty     = document.getElementById('announcements-empty');
  if (!container) return;

  if (!announcements.length) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  const PRIORITY_ICONS = { info: 'ℹ️', warning: '⚠️', important: '🚨' };
  const STATUS_STYLES  = {
    sent:      'background:#dcfce7;color:#166534',
    scheduled: 'background:#fef3c7;color:#b45309',
    draft:     'background:#f1f5f9;color:#64748b',
  };

  container.innerHTML = announcements.map(a => {
    const date        = a.sent_at || a.scheduled_at || a.created_at;
    const dateStr     = date ? new Date(date).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' }) : '—';
    const icon        = PRIORITY_ICONS[a.priority] || 'ℹ️';
    const statusStyle = STATUS_STYLES[a.status] || STATUS_STYLES.draft;
    const sentTo      = a.recipient_count > 0 ? `📨 Sent to ${a.recipient_count} manager${a.recipient_count !== 1 ? 's' : ''}` : '';
    const reads       = a.read_count     > 0 ? `👁️ ${a.read_count} read${a.read_count !== 1 ? 's' : ''}` : '';
    const canEdit     = a.status !== 'sent';

    return `
      <div class="announcement-card" data-id="${a.id}">
        <div class="announcement-header" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span class="badge badge-${a.priority}" style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">${icon} ${annCap(a.priority)}</span>
          <span style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:99px;${statusStyle}">${annCap(a.status)}</span>
          <span style="font-size:11px;color:var(--muted)">${dateStr}</span>
        </div>
        <h4 style="margin:0 0 6px;font-size:14px;font-weight:700">${annEsc(a.title)}</h4>
        <p style="margin:0 0 10px;font-size:13px;color:var(--muted);line-height:1.5">
          ${annEsc(a.message.substring(0, 120))}${a.message.length > 120 ? '…' : ''}
        </p>
        ${reads || sentTo ? `
          <div style="display:flex;gap:16px;font-size:12px;color:var(--muted);margin-bottom:10px">
            ${reads  ? `<span>${reads}</span>`  : ''}
            ${sentTo ? `<span>${sentTo}</span>` : ''}
          </div>` : ''}
        <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border)">
          <button class="btn btn-ghost btn-sm" onclick="viewAnnouncement('${a.id}')">View</button>
          ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="editAnnouncement('${a.id}')">Edit</button>` : ''}
          ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="sendAnnouncementNow('${a.id}')" style="color:#7c3aed;font-weight:600">Send</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="deleteAnnouncement('${a.id}')" style="color:#ef4444">Delete</button>
        </div>
      </div>`;
  }).join('');
}

// ── Filter ────────────────────────────────────────────────────
function filterAnnouncements() {
  loadAnnouncements();
}

// ── New announcement modal ────────────────────────────────────
function openAnnouncementModal() {
  resetAnnouncementForm();
  annSetText('announcement-modal-title', 'New Announcement');
  document.getElementById('send-announcement-btn').innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    Send Now`;
  currentEditingAnnouncementId = null;
  loadCompaniesIntoSelector([]);
  openModal('announcement-modal');
}

// ── Edit modal ────────────────────────────────────────────────
async function editAnnouncement(id) {
  try {
    const json = await GET(`/api/announcements/${id}`);
    const a    = json.data;
    announcements = announcements.map(x => x.id === id ? a : x);

    annSetText('announcement-modal-title', 'Edit Announcement');
    document.getElementById('ann-title').value    = a.title    || '';
    document.getElementById('ann-priority').value = a.priority || 'info';
    document.getElementById('ann-audience').value = a.audience || 'all';
    document.getElementById('ann-message').value  = a.message  || '';

    const ch = Array.isArray(a.channels) ? a.channels : [];
    document.getElementById('send-email').checked    = ch.includes('email');
    document.getElementById('send-inapp').checked    = ch.includes('in_app');
    document.getElementById('send-sms').checked      = ch.includes('sms');
    document.getElementById('send-whatsapp').checked = ch.includes('whatsapp');

    if (a.scheduled_at) {
      document.getElementById('schedule-checkbox').checked      = true;
      document.getElementById('schedule-options').style.display = 'block';
      const local = new Date(a.scheduled_at);
      local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
      document.getElementById('ann-schedule').value = local.toISOString().slice(0, 16);
    } else {
      document.getElementById('schedule-checkbox').checked      = false;
      document.getElementById('schedule-options').style.display = 'none';
      document.getElementById('ann-schedule').value             = '';
    }

    updateTitleCounter();
    updateMessageCounter();
    updatePriorityPreview();
    toggleCompanySelector();
    await loadCompaniesIntoSelector(a.company_ids || []);

    document.getElementById('send-announcement-btn').innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/></svg>
      Update`;
    currentEditingAnnouncementId = id;
    openModal('announcement-modal');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── View modal ────────────────────────────────────────────────
async function viewAnnouncement(id) {
  try {
    const json = await GET(`/api/announcements/${id}`);
    const a    = json.data;
    const date = a.sent_at || a.scheduled_at || a.created_at;

    annSetText('view-ann-title',   a.title);
    annSetText('view-ann-message', a.message);
    annSetText('view-ann-date',
      date ? new Date(date).toLocaleString('en-ZA', {
        day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
      }) : '—'
    );
    annSetText('view-ann-recipients',
      a.recipient_count > 0
        ? `Sent to ${a.recipient_count} manager${a.recipient_count !== 1 ? 's' : ''}`
        : 'Not sent yet'
    );
    annSetText('view-ann-reads',
      a.read_count > 0 ? `${a.read_count} read${a.read_count !== 1 ? 's' : ''}` : '0 reads'
    );

    const badge = document.getElementById('view-ann-badge');
    if (badge) { badge.textContent = annCap(a.priority); badge.className = `badge badge-${a.priority}`; }

    const editBtn = document.getElementById('view-ann-edit-btn');
    if (editBtn) editBtn.style.display = a.status !== 'sent' ? '' : 'none';

    currentEditingAnnouncementId = id;
    openModal('view-announcement-modal');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Delete ────────────────────────────────────────────────────
function deleteAnnouncement(id) {
  const a = announcements.find(x => x.id === id);
  annSetText('delete-ann-message',
    `This will permanently delete "${a ? a.title : 'this announcement'}". This action cannot be undone.`
  );
  currentEditingAnnouncementId = id;
  openModal('delete-announcement-modal');
}

async function confirmDeleteAnnouncement() {
  closeModal('delete-announcement-modal');
  try {
    await DELETE(`/api/announcements/${currentEditingAnnouncementId}`);
    announcements = announcements.filter(a => a.id !== currentEditingAnnouncementId);
    currentEditingAnnouncementId = null;
    renderAnnouncementList();
    toast('Announcement deleted successfully', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Quick-send from card ──────────────────────────────────────
async function sendAnnouncementNow(id) {
  try {
    const json = await POST(`/api/announcements/${id}/send`);
    announcements = announcements.map(a => a.id === id ? json.data : a);
    renderAnnouncementList();
    toast(`Sent to ${json.data.recipient_count} manager(s)`, 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Send / Update from modal ──────────────────────────────────
async function sendAnnouncement() {
  const title   = document.getElementById('ann-title').value.trim();
  const message = document.getElementById('ann-message').value.trim();

  if (!title)   { toast('Please enter a title',   'error'); document.getElementById('ann-title').focus();   return; }
  if (!message) { toast('Please enter a message', 'error'); document.getElementById('ann-message').focus(); return; }

  const isScheduled  = document.getElementById('schedule-checkbox').checked;
  const scheduleDate = document.getElementById('ann-schedule').value;
  if (isScheduled && !scheduleDate) { toast('Please select a schedule date/time', 'error'); return; }

  const channels = [];
  if (document.getElementById('send-email').checked)    channels.push('email');
  if (document.getElementById('send-inapp').checked)    channels.push('in_app');
  if (document.getElementById('send-sms').checked)      channels.push('sms');
  if (document.getElementById('send-whatsapp').checked) channels.push('whatsapp');
  if (!channels.length) { toast('Select at least one delivery channel', 'error'); return; }

  const audience = document.getElementById('ann-audience').value;
  let company_ids = null;
  if (audience === 'specific') {
    const sel = document.getElementById('ann-companies');
    company_ids = Array.from(sel.selectedOptions).map(o => o.value);
    if (!company_ids.length) { toast('Select at least one company', 'error'); return; }
  }

  const payload = {
    title, message,
    priority:     document.getElementById('ann-priority').value,
    audience,
    channels,
    company_ids,
    scheduled_at: isScheduled ? new Date(scheduleDate).toISOString() : null,
  };

  const btn = document.getElementById('send-announcement-btn');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Saving…';
  btn.disabled  = true;

  try {
    let saved;

    if (currentEditingAnnouncementId) {
      const json = await PUT(`/api/announcements/${currentEditingAnnouncementId}`, payload);
      saved = json.data;
      announcements = announcements.map(a => a.id === saved.id ? saved : a);
    } else {
      const json = await POST('/api/announcements', payload);
      saved = json.data;
      announcements.unshift(saved);
    }

    if (!isScheduled) {
      btn.innerHTML = '<span class="spinner"></span> Sending…';
      const sentJson = await POST(`/api/announcements/${saved.id}/send`);
      announcements  = announcements.map(a => a.id === saved.id ? sentJson.data : a);
      toast(`Sent to ${sentJson.data.recipient_count} manager(s)`, 'success');
    } else {
      toast(`Scheduled for ${new Date(scheduleDate).toLocaleString('en-ZA')}`, 'success');
    }

    closeModal('announcement-modal');
    renderAnnouncementList();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled  = false;
  }
}

// ── Save as draft ─────────────────────────────────────────────
async function saveAnnouncementDraft() {
  const title   = document.getElementById('ann-title').value.trim();
  const message = document.getElementById('ann-message').value.trim();
  if (!title || !message) { toast('Title and message required to save draft', 'error'); return; }

  const channels = [];
  if (document.getElementById('send-email').checked)    channels.push('email');
  if (document.getElementById('send-inapp').checked)    channels.push('in_app');
  if (document.getElementById('send-sms').checked)      channels.push('sms');
  if (document.getElementById('send-whatsapp').checked) channels.push('whatsapp');

  const payload = {
    title, message,
    priority: document.getElementById('ann-priority').value,
    audience: document.getElementById('ann-audience').value,
    channels,
    status:   'draft',
  };

  try {
    if (currentEditingAnnouncementId) {
      const json = await PUT(`/api/announcements/${currentEditingAnnouncementId}`, payload);
      announcements = announcements.map(a => a.id === json.data.id ? json.data : a);
    } else {
      const json = await POST('/api/announcements', payload);
      announcements.unshift(json.data);
    }
    renderAnnouncementList();
    closeModal('announcement-modal');
    toast('Saved as draft', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Edit from view modal ──────────────────────────────────────
function editFromView() {
  closeModal('view-announcement-modal');
  editAnnouncement(currentEditingAnnouncementId);
}

// ── Load companies into selector ──────────────────────────────
async function loadCompaniesIntoSelector(selectedIds = []) {
  const sel = document.getElementById('ann-companies');
  if (!sel) return;
  try {
    const json      = await GET('/api/companies');
    const companies = json.data || [];
    sel.innerHTML   = companies.map(c =>
      `<option value="${c.id}" ${(selectedIds || []).includes(c.id) ? 'selected' : ''}>${annEsc(c.name)}</option>`
    ).join('');
  } catch { /* non-critical */ }
}

// ── Form helpers ──────────────────────────────────────────────
function updateTitleCounter() {
  const v  = document.getElementById('ann-title')?.value || '';
  const el = document.getElementById('title-counter');
  if (el) el.textContent = `${v.length}/200`;
  updatePriorityPreview();
}

function updateMessageCounter() {
  const v  = document.getElementById('ann-message')?.value || '';
  const el = document.getElementById('message-counter');
  if (el) el.textContent = `${v.length}/2000`;
  updatePriorityPreview();
}

function updatePriorityPreview() {
  const priority = document.getElementById('ann-priority')?.value || 'info';
  const title    = document.getElementById('ann-title')?.value.trim()   || 'Announcement title…';
  const message  = document.getElementById('ann-message')?.value.trim() || 'Announcement message…';
  const badge    = document.getElementById('preview-badge');
  if (badge) { badge.textContent = annCap(priority); badge.className = `badge badge-${priority}`; }
  const pt = document.getElementById('preview-title');   if (pt) pt.textContent = title;
  const pm = document.getElementById('preview-message'); if (pm) pm.textContent = message;
}

function toggleCompanySelector() {
  const audience = document.getElementById('ann-audience')?.value;
  const sel      = document.getElementById('company-selector');
  if (sel) sel.style.display = audience === 'specific' ? 'block' : 'none';
}

function toggleSchedule() {
  const checked = document.getElementById('schedule-checkbox')?.checked;
  const opts    = document.getElementById('schedule-options');
  if (opts) opts.style.display = checked ? 'block' : 'none';
}

function selectAllCompanies() {
  const sel = document.getElementById('ann-companies');
  if (sel) for (const o of sel.options) o.selected = true;
}
function deselectAllCompanies() {
  const sel = document.getElementById('ann-companies');
  if (sel) for (const o of sel.options) o.selected = false;
}

function resetAnnouncementForm() {
  document.getElementById('ann-title').value    = '';
  document.getElementById('ann-priority').value = 'info';
  document.getElementById('ann-audience').value = 'all';
  document.getElementById('ann-message').value  = '';
  document.getElementById('schedule-checkbox').checked      = false;
  document.getElementById('schedule-options').style.display = 'none';
  document.getElementById('ann-schedule').value             = '';
  document.getElementById('send-email').checked             = true;
  document.getElementById('send-inapp').checked             = true;
  document.getElementById('send-sms').checked               = false;
  document.getElementById('send-whatsapp').checked          = false;
  document.getElementById('company-selector').style.display = 'none';
  updateTitleCounter();
  updateMessageCounter();
  updatePriorityPreview();
}

// ── Tiny helpers (prefixed to avoid conflicts) ────────────────
function annSetText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function annCap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }
function annEsc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const titleInput   = document.getElementById('ann-title');
  const messageInput = document.getElementById('ann-message');
  if (titleInput)   titleInput.addEventListener('input', updateTitleCounter);
  if (messageInput) messageInput.addEventListener('input', updateMessageCounter);
  loadAnnouncements();
});