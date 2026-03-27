// ============================================================
// manager-tickets.js — Tickets page for manager portal
// ============================================================

let _allTickets  = [];
let _tkPage      = 1;
let _tkStatus    = '';
let _tkProperty  = '';
let _tkPriority  = '';
var TK_PER_PAGE = TK_PER_PAGE || 20;

// ── Load ───────────────────────────────────────────────────────
async function loadTickets() {
  document.getElementById('tk-body').innerHTML =
    `<tr class="loading-row"><td colspan="9">Loading...</td></tr>`;
  try {
    const q = _tkStatus ? `?status=${_tkStatus}` : '';
    const resp = await GET(`/api/tickets${q}`);
    _allTickets = resp.data || [];
    _tkPage = 1;

    // Populate property filter dropdown
    const propSel = document.getElementById('tk-property');
    if (propSel && propSel.options.length <= 1) {
      const seen = {};
      _allTickets.forEach(t => {
        if (t.property_id && t.property_name && !seen[t.property_id]) {
          seen[t.property_id] = true;
          const opt = document.createElement('option');
          opt.value = t.property_id;
          opt.textContent = t.property_name;
          propSel.appendChild(opt);
        }
      });
    }
    renderTickets();
  } catch(e) { toast(e.message, 'error'); }
}

// ── Filter pill click ──────────────────────────────────────────
function filterTickets(el) {
  el.closest('.filter-pills').querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  _tkStatus = el.dataset.tkstatus || '';
  loadTickets();
}

// ── Render (client-side search + filter) ──────────────────────
function renderTickets() {
  const search   = (document.getElementById('tk-search')?.value || '').toLowerCase();
  const propF    = document.getElementById('tk-property')?.value || '';
  const prioF    = document.getElementById('tk-priority-filter')?.value || '';

  const filtered = _allTickets.filter(t => {
    const ms = !search ||
      (t.title||'').toLowerCase().includes(search) ||
      (t.ticket_number||'').toLowerCase().includes(search) ||
      (t.created_by_name||'').toLowerCase().includes(search) ||
      (t.unit_number||'').toLowerCase().includes(search);
    const mp = !propF || t.property_id === propF;
    const mr = !prioF || t.priority === prioF;
    return ms && mp && mr;
  });

  const tbody = document.getElementById('tk-body');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">No tickets found.</td></tr>`;
    document.getElementById('tk-pagination').innerHTML = '';
    return;
  }

  const start = (_tkPage - 1) * TK_PER_PAGE;
  const page  = filtered.slice(start, start + TK_PER_PAGE);

  tbody.innerHTML = page.map(t => `
    <tr style="cursor:pointer" onclick="openTicketDetail('${t.id}')">
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted);white-space:nowrap">${t.ticket_number || '—'}</td>
      <td style="max-width:220px">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.title}</div>
        ${t.category_name ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${t.category_name}</div>` : ''}
      </td>
      <td style="font-size:12px;color:var(--muted)">
        <div>${t.property_name || '—'}</div>
        ${t.unit_number ? `<div style="font-size:11px">Unit ${t.unit_number}</div>` : ''}
      </td>
      <td style="font-size:12px;color:var(--muted)">${t.created_by_name || '—'}</td>
      <td>${badge(t.priority, PRIORITY_COLORS)}</td>
      <td>${badge(t.status, STATUS_COLORS)}</td>
      <td style="font-size:12px;color:var(--muted)">${t.assigned_to_name || '<span style="color:#94a3b8;font-style:italic">Unassigned</span>'}</td>
      <td style="font-size:12px;color:var(--muted);white-space:nowrap">${timeAgo(t.created_at)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openTicketDetail('${t.id}')">View</button>
      </td>
    </tr>`).join('');

  const total = filtered.length;
  const pages = Math.ceil(total / TK_PER_PAGE);
  document.getElementById('tk-pagination').innerHTML = `
    <span style="color:var(--muted)">${total} ticket${total !== 1 ? 's' : ''}</span>
    <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
      <button class="btn btn-outline btn-sm" onclick="_tkPage--;renderTickets()" ${_tkPage <= 1 ? 'disabled' : ''}>Prev</button>
      <span style="padding:5px 10px;font-weight:600;font-size:13px">${_tkPage} / ${pages}</span>
      <button class="btn btn-outline btn-sm" onclick="_tkPage++;renderTickets()" ${_tkPage >= pages ? 'disabled' : ''}>Next</button>
    </span>`;
}

// ── Ticket detail modal ────────────────────────────────────────
async function openTicketDetail(id) {
  openModal('ticket-detail-modal');
  document.getElementById('tdm-body').innerHTML =
    '<div style="text-align:center;padding:48px;color:var(--muted)">Loading...</div>';
  try {
    const [tkR, updR, techR] = await Promise.all([
      GET(`/api/tickets/${id}`),
      GET(`/api/tickets/${id}/updates`),
      GET('/api/users?role=technician'),
    ]);
    const t       = tkR.data;
    const updates = updR.data || [];
    const techs   = techR.data || [];

    document.getElementById('tdm-ref').textContent = t.ticket_number || 'Ticket';

    const statusOptions = ['open','assigned','in_progress','on_hold','completed','closed','cancelled'];

    document.getElementById('tdm-body').innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${badge(t.status, STATUS_COLORS)}
        ${badge(t.priority, PRIORITY_COLORS)}
        ${t.category_name ? `<span class="badge" style="background:#f1f5f9;color:#475569">${t.category_name}</span>` : ''}
        ${t.source ? `<span class="badge" style="background:#f0fdf4;color:#15803d">${t.source}</span>` : ''}
      </div>

      <h3 style="font-size:17px;font-weight:700;margin-bottom:10px;line-height:1.4">${t.title}</h3>
      <div style="font-size:13.5px;color:var(--text-2);line-height:1.65;padding:14px 16px;background:var(--surface);border-radius:10px;margin-bottom:16px">
        ${t.description || '<em style="color:var(--muted)">No description provided.</em>'}
      </div>

      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <span>Property: <strong style="color:var(--text-2)">${t.property_name || '—'}</strong></span>
        ${t.unit_number ? `<span>Unit: <strong>${t.unit_number}</strong></span>` : ''}
        <span>Submitted by: <strong>${t.created_by_name || '—'}</strong></span>
        <span>Submitted: <strong>${fmtDate(t.created_at)}</strong></span>
        ${t.due_date ? `<span>Due: <strong style="color:${new Date(t.due_date) < new Date() ? '#b91c1c' : 'var(--text-2)'}">${fmtDate(t.due_date)}</strong></span>` : ''}
        ${t.parts_cost != null ? `<span>Parts: <strong>R${Number(t.parts_cost).toFixed(2)}</strong></span>` : ''}
        ${t.labour_cost != null ? `<span>Labour: <strong>R${Number(t.labour_cost).toFixed(2)}</strong></span>` : ''}
        ${t.total_cost != null ? `<span>Total: <strong style="color:var(--text)">R${Number(t.total_cost).toFixed(2)}</strong></span>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div>
          <label style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px">Update Status</label>
          <div style="display:flex;gap:8px">
            <select id="tdm-status" style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:white;outline:none">
              ${statusOptions.map(s => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${s.replace('_',' ')}</option>`).join('')}
            </select>
            <button class="btn btn-outline btn-sm" onclick="tkUpdateStatus('${id}')">Update</button>
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px">Assign Technician</label>
          <div style="display:flex;gap:8px">
            <select id="tdm-tech" style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:white;outline:none">
              <option value="">— Unassigned —</option>
              ${techs.map(tc => `<option value="${tc.id}" ${t.assigned_to === tc.id ? 'selected' : ''}>${tc.name}</option>`).join('')}
            </select>
            <button class="btn btn-outline btn-sm" onclick="tkAssign('${id}')">Assign</button>
          </div>
        </div>
      </div>

      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:12px">Updates &amp; Comments</div>
        <div id="tdm-updates">
          ${updates.length
            ? updates.map(u => `
                <div class="update-item">
                  <div class="update-avatar">${(u.user_name || '?')[0].toUpperCase()}</div>
                  <div class="update-body">
                    <div class="update-meta">
                      <strong>${u.user_name || 'System'}</strong>
                      <span>${timeAgo(u.created_at)}</span>
                      ${u.is_internal ? `<span class="badge" style="background:#fef3c7;color:#b45309;font-size:10px">Internal</span>` : ''}
                    </div>
                    <div class="update-msg">${u.message || ''}</div>
                  </div>
                </div>`).join('')
            : '<p style="color:var(--muted);font-size:13px;padding:12px 0">No updates yet.</p>'}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end">
          <textarea id="tdm-comment" rows="2" placeholder="Add a comment..." style="flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;resize:none;outline:none"></textarea>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);white-space:nowrap;cursor:pointer">
              <input type="checkbox" id="tdm-internal"> Internal note
            </label>
            <button class="btn btn-primary btn-sm" onclick="tkPostComment('${id}')">Send</button>
          </div>
        </div>
      </div>`;
  } catch(e) {
    document.getElementById('tdm-body').innerHTML =
      `<div style="text-align:center;padding:48px;color:#b91c1c">${e.message}</div>`;
  }
}

async function tkUpdateStatus(id) {
  const status = document.getElementById('tdm-status').value;
  try {
    await POST(`/api/tickets/${id}/status`, { status });
    toast(`Status updated to ${status.replace('_', ' ')}`);
    loadTickets();
    openTicketDetail(id);
  } catch(e) { toast(e.message, 'error'); }
}

async function tkAssign(id) {
  const techId = document.getElementById('tdm-tech').value;
  if (!techId) { toast('Select a technician first', 'error'); return; }
  try {
    await POST(`/api/tickets/${id}/assign`, { technician_id: techId });
    toast('Technician assigned');
    loadTickets();
    openTicketDetail(id);
  } catch(e) { toast(e.message, 'error'); }
}

async function tkPostComment(id) {
  const msg         = document.getElementById('tdm-comment').value.trim();
  const is_internal = document.getElementById('tdm-internal')?.checked || false;
  if (!msg) return;
  try {
    await POST(`/api/tickets/${id}/updates`, { message: msg, is_internal });
    document.getElementById('tdm-comment').value = '';
    toast('Comment added');
    openTicketDetail(id);
  } catch(e) { toast(e.message, 'error'); }
}