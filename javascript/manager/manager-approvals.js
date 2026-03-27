// ============================================================
// manager-approvals.js — Registration approvals queue
// ============================================================

var _allRegs    = [];
var _regsPage   = 1;
var _regStatus  = 'pending';
var _rejectId   = null;
const REGS_PER_PAGE = 20;

const REG_STATUS_COLORS = {
  pending:  { bg: '#fef3c7', fg: '#b45309' },
  approved: { bg: '#dcfce7', fg: '#166534' },
  rejected: { bg: '#fee2e2', fg: '#b91c1c' },
};

// ── Load ───────────────────────────────────────────────────────
async function loadApprovals() {
  document.getElementById('regs-body').innerHTML =
    '<tr class="loading-row"><td colspan="10">Loading...</td></tr>';
  try {
    const q    = _regStatus ? `?status=${_regStatus}` : '';
    const resp = await GET(`/api/registrations${q}`);
    _allRegs   = resp.data || [];
    _regsPage  = 1;
    renderRegs();
  } catch(e) { toast(e.message, 'error'); }
}

function filterRegs(el) {
  el.closest('.filter-pills').querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  _regStatus = el.dataset.regstatus || '';
  loadApprovals();
}

function renderRegs() {
  const tbody = document.getElementById('regs-body');
  if (!_allRegs.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:48px;color:var(--muted)">
      ${_regStatus === 'pending' ? 'No pending registrations — all clear.' : 'No registrations found.'}
    </td></tr>`;
    document.getElementById('regs-pagination').innerHTML = '';
    return;
  }

  const start = (_regsPage - 1) * REGS_PER_PAGE;
  const page  = _allRegs.slice(start, start + REGS_PER_PAGE);

  tbody.innerHTML = page.map(r => `
    <tr>
      <td>
        <div style="font-weight:600;font-size:13.5px">${r.name}</div>
        <div style="font-size:11px;color:var(--muted);text-transform:capitalize">${r.role}</div>
      </td>
      <td style="font-size:13px;color:var(--muted)">${r.email}</td>
      <td style="font-size:13px;color:var(--muted)">${r.phone || '—'}</td>
      <td style="font-size:12px;color:var(--muted)">${r.property_name || '—'}</td>
      <td style="font-size:12px;color:var(--muted)">${r.unit_number ? 'Unit ' + r.unit_number : '—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">${r.id_number || '—'}</td>
      <td>
        ${r.document_url
          ? `<a href="${r.document_url}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
               View
             </a>`
          : '<span style="color:var(--muted);font-size:12px">None</span>'}
      </td>
      <td style="font-size:12px;color:var(--muted);white-space:nowrap">${timeAgo(r.created_at)}</td>
      <td>${badge(r.status, REG_STATUS_COLORS)}</td>
      <td>
        ${r.status === 'pending' ? `
          <div style="display:flex;gap:6px">
            <button class="btn btn-primary btn-sm" onclick="approveReg('${r.id}','${r.name}')">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="openRejectModal('${r.id}')">Reject</button>
          </div>` : ''}
        ${r.status === 'rejected' && r.rejection_reason ? `
          <span style="font-size:11px;color:var(--muted);font-style:italic">${r.rejection_reason}</span>` : ''}
      </td>
    </tr>`).join('');

  const total = _allRegs.length;
  const pages = Math.ceil(total / REGS_PER_PAGE);
  document.getElementById('regs-pagination').innerHTML = total > REGS_PER_PAGE ? `
    <span style="color:var(--muted);font-size:13px">${total} registration${total !== 1 ? 's' : ''}</span>
    <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
      <button class="btn btn-outline btn-sm" onclick="_regsPage--;renderRegs()" ${_regsPage<=1?'disabled':''}>Prev</button>
      <span style="padding:5px 10px;font-weight:600;font-size:13px">${_regsPage}/${pages}</span>
      <button class="btn btn-outline btn-sm" onclick="_regsPage++;renderRegs()" ${_regsPage>=pages?'disabled':''}>Next</button>
    </span>` :
    `<span style="color:var(--muted);font-size:13px">${total} registration${total !== 1 ? 's' : ''}</span>`;
}

// ── Approve ────────────────────────────────────────────────────
async function approveReg(id, name) {
  if (!confirm(`Approve registration for ${name}? This will create their account and grant them access.`)) return;
  try {
    await POST(`/api/registrations/${id}/approve`, {});
    toast(`${name} approved — account created`);
    refreshApprovalsBadge();
    loadApprovals();
  } catch(e) { toast(e.message, 'error'); }
}

// ── Reject ─────────────────────────────────────────────────────
function openRejectModal(id) {
  _rejectId = id;
  document.getElementById('reject-reason').value = '';
  openModal('reject-modal');
}

async function confirmReject() {
  if (!_rejectId) return;
  const reason = document.getElementById('reject-reason').value.trim();
  const btn    = document.getElementById('btn-confirm-reject');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await POST(`/api/registrations/${_rejectId}/reject`, { reason: reason || undefined });
    toast('Registration rejected');
    closeModal('reject-modal');
    _rejectId = null;
    refreshApprovalsBadge();
    loadApprovals();
  } catch(e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Reject Registration'; }
}

// ── Badge count on nav ─────────────────────────────────────────
async function refreshApprovalsBadge() {
  try {
    const resp  = await GET('/api/registrations/pending-count');
    const count = resp.data?.count || 0;
    const badge = document.getElementById('approvals-badge');
    if (badge) {
      badge.textContent    = count;
      badge.style.display  = count > 0 ? 'inline-block' : 'none';
    }
  } catch(_) {}
}

// Load badge count on page init
refreshApprovalsBadge();