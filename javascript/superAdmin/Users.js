// ── Users (cross-company) ────────────────────────────────────
// For super_admin: loads all companies into the filter dropdown,
// then calls GET /api/users?role=&companyId= (no X-Company-Slug needed).
// For manager/maintenance_admin: company filter is hidden; the backend
// scopes the query to their own company automatically via the JWT.

async function loadAllUsers() {
  const isSuperAdmin = Auth.user?.role === 'super_admin';

  // Only super_admin sees the company filter dropdown
  const companyFilterWrap = document.getElementById('company-filter-wrap');
  if (companyFilterWrap) {
    companyFilterWrap.style.display = isSuperAdmin ? '' : 'none';
  }

  if (isSuperAdmin) {
    // Populate company dropdown (cached after first load)
    if (allCompanies.length === 0) {
      const resp = await GET('/api/companies').catch(() => ({ data: [] }));
      allCompanies = resp.data || [];
    }
    const sel = document.getElementById('company-filter');
    if (sel) {
      sel.innerHTML =
        '<option value="">— All Companies —</option>' +
        allCompanies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  }

  loadUsers();
}

async function loadUsers() {
  document.getElementById('users-body').innerHTML =
    `<tr class="loading-row"><td colspan="6">Loading…</td></tr>`;

  const isSuperAdmin = Auth.user?.role === 'super_admin';

  // Build query string
  const params = new URLSearchParams();
  const role = document.getElementById('role-filter')?.value;
  if (role) params.set('role', role);

  if (isSuperAdmin) {
    // Optional: scope to one company when super_admin picks from dropdown
    const companyId = document.getElementById('company-filter')?.value;
    if (companyId) params.set('companyId', companyId);
    // No X-Company-Slug header needed — backend uses companyId query param
  }

  const qs = params.toString() ? `?${params.toString()}` : '';

  try {
    const res = await fetch(`${API}/api/users${qs}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    allUsers  = data.data || [];
    usersPage = 1;
    renderUsers(isSuperAdmin);
  } catch (e) {
    toast(e.message, 'error');
  }
}

const ROLE_COLORS = {
  super_admin:       { bg: '#faf5ff', fg: '#7c3aed' },
  manager:           { bg: '#ede9fe', fg: '#5b21b6' },
  maintenance_admin: { bg: '#dbeafe', fg: '#1d4ed8' },
  technician:        { bg: '#e0f2fe', fg: '#0369a1' },
  tenant:            { bg: '#f0fdf4', fg: '#15803d' },
  staff:             { bg: '#fef9c3', fg: '#a16207' },
};

const STATUS_BADGE = {
  active:    { bg: '#dcfce7', fg: '#166534' },
  inactive:  { bg: '#f1f5f9', fg: '#94a3b8' },
  suspended: { bg: '#fee2e2', fg: '#b91c1c' },
  pending:   { bg: '#fef3c7', fg: '#b45309' },
};

// isSuperAdmin — when true, renders the Company column from u.company_name
// (returned by the updated backend JOIN); otherwise hides it.
function renderUsers(isSuperAdmin = false) {
  const start = (usersPage - 1) * USERS_PER;
  const page  = allUsers.slice(start, start + USERS_PER);
  const tbody = document.getElementById('users-body');

  if (!allUsers.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">No users found.</td></tr>`;
    document.getElementById('users-pagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = page.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:30px;height:30px;border-radius:50%;background:var(--sa-grad);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;flex-shrink:0">
            ${(u.name || '?')[0].toUpperCase()}
          </div>
          <span style="font-weight:600">${u.name}</span>
        </div>
      </td>
      <td style="font-size:12px;color:var(--muted)">${u.email}</td>
      <td>${badge(u.role, ROLE_COLORS)}</td>
      <td style="font-size:12px;color:var(--muted)">
        ${isSuperAdmin
          ? (u.company_name || '—')
          : (allCompanies.find(c => c.id === u.company_id)?.name || '—')}
      </td>
      <td>${badge(u.status, STATUS_BADGE)}</td>
      <td style="font-size:12px;color:var(--muted)">${u.last_login ? timeAgo(u.last_login) : 'Never'}</td>
    </tr>
  `).join('');

  const total = allUsers.length;
  const pages = Math.ceil(total / USERS_PER);
  document.getElementById('users-pagination').innerHTML = `
    <span>${total} user${total !== 1 ? 's' : ''}</span>
    <span style="margin-left:auto;display:flex;gap:6px">
      <button class="btn btn-outline btn-sm" onclick="usersPage--;renderUsers(${isSuperAdmin})" ${usersPage <= 1 ? 'disabled' : ''}>← Prev</button>
      <span style="padding:5px 10px;font-weight:600">${usersPage}/${pages || 1}</span>
      <button class="btn btn-outline btn-sm" onclick="usersPage++;renderUsers(${isSuperAdmin})" ${usersPage >= pages ? 'disabled' : ''}>Next →</button>
    </span>`;
}

function fErr(id, msg) {
  document.getElementById(id)?.classList.add('error');
  const e = document.getElementById(`${id}-err`);
  if (e) { e.textContent = msg; e.classList.add('show'); }
}

loadDashboard();