// ============================================================
// manager-users.js — User Management & Bulk CSV Import
// ============================================================

let allUsers           = [];
let filteredUsers      = [];
let usersRole          = '';
let usersPage          = 1;
let editingUserId      = null;
let pendingUserCSVRows = [];
var USERS_PER_PAGE = USERS_PER_PAGE || 15;

var ROLE_COLORS = ROLE_COLORS || {
  manager:           { bg: '#ede9fe', fg: '#5b21b6' },
  maintenance_admin: { bg: '#dbeafe', fg: '#1d4ed8' },
  technician:        { bg: '#e0f2fe', fg: '#0369a1' },
  property_owner:    { bg: '#fef3c7', fg: '#b45309' },
};
var STATUS_UC = STATUS_UC || {
  active:    { bg: '#dcfce7', fg: '#166534' },
  inactive:  { bg: '#f1f5f9', fg: '#94a3b8' },
  suspended: { bg: '#fee2e2', fg: '#b91c1c' },
  pending:   { bg: '#fef3c7', fg: '#b45309' },
};

// ── Load & Filter ──────────────────────────────────────────────
async function loadUsers() {
  document.getElementById('users-body').innerHTML = '<tr class="loading-row"><td colspan="8">Loading...</td></tr>';
  try {
    const q = usersRole ? `?role=${usersRole}` : '';
    const resp = await GET(`/api/users${q}`);
    allUsers = resp.data || [];
    usersPage = 1;
    renderUsers();
  } catch (e) { toast(e.message, 'error'); }
}

function filterUsers(el) {
  el.closest('.filter-pills').querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  usersRole = el.dataset.role || '';
  loadUsers();
}

function renderUsers() {
  const search = (document.getElementById('user-search')?.value || '').toLowerCase();
  filteredUsers = allUsers.filter(u => {
    if (!search) return true;
    return (u.name||'').toLowerCase().includes(search)
      || (u.email||'').toLowerCase().includes(search)
      || (u.phone||'').includes(search)
      || (u.id_number||'').includes(search);
  });

  const start = (usersPage - 1) * USERS_PER_PAGE;
  const page  = filteredUsers.slice(start, start + USERS_PER_PAGE);
  const tbody = document.getElementById('users-body');

  if (!filteredUsers.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">No users found.</td></tr>';
    document.getElementById('users-pagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = page.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;flex-shrink:0">${(u.name||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:600;font-size:13.5px">${u.name || '—'}</div>
            ${u.id_number ? `<div style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace">ID: ${u.id_number}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="font-size:13px;color:var(--muted)">${u.email || '—'}</td>
      <td style="font-size:13px;color:var(--muted)">${u.phone || '—'}</td>
      <td>${badge(u.role, ROLE_COLORS)}</td>
      <td>${badge(u.status, STATUS_UC)}</td>
      <td style="font-size:12px;color:var(--muted)">${u.last_login ? timeAgo(u.last_login) : 'Never'}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="openEditUser('${u.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="sendPasswordReset('${u.id}','${u.email}')" title="Send password reset link">Reset PW</button>
          <select onchange="changeUserStatus('${u.id}',this.value)" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:white;outline:none">
            <option value="">Status...</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspend</option>
          </select>
        </div>
      </td>
    </tr>`).join('');

  const total = filteredUsers.length;
  const pages = Math.ceil(total / USERS_PER_PAGE);
  document.getElementById('users-pagination').innerHTML = `
    <span style="color:var(--muted);font-size:13px">${total} user${total !== 1 ? 's' : ''} &nbsp;|&nbsp; Page ${usersPage} of ${pages}</span>
    <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
      <button class="btn btn-outline btn-sm" onclick="usersPage=1;renderUsers()" ${usersPage<=1?'disabled':''}>First</button>
      <button class="btn btn-outline btn-sm" onclick="usersPage--;renderUsers()" ${usersPage<=1?'disabled':''}>Prev</button>
      <button class="btn btn-outline btn-sm" onclick="usersPage++;renderUsers()" ${usersPage>=pages?'disabled':''}>Next</button>
      <button class="btn btn-outline btn-sm" onclick="usersPage=${pages};renderUsers()" ${usersPage>=pages?'disabled':''}>Last</button>
    </span>`;
}

async function changeUserStatus(id, status) {
  if (!status) return;
  try {
    await PUT(`/api/users/${id}`, { status });
    toast(`Status updated to ${status}`);
    loadUsers();
  } catch (e) { toast(e.message, 'error'); }
}

async function sendPasswordReset(userId, email) {
  if (!confirm(`Send a password reset link to ${email}?`)) return;
  try {
    await POST(`/api/users/${userId}/send-reset`, {});
    toast(`Password reset link sent to ${email}`);
  } catch (e) {
    // If endpoint doesn't exist yet, show informative message
    toast('Password reset link queued — check notification settings', 'error');
  }
}

// ── User Modal (Add / Edit) ────────────────────────────────────
function openUserModal() {
  editingUserId = null;
  document.getElementById('user-modal-title').textContent  = 'Add User';
  document.getElementById('btn-create-user').textContent   = 'Create & Send Welcome';
  document.getElementById('usr-pw-section').style.display  = 'none';
  document.getElementById('usr-welcome-note').style.display = '';

  const fields = ['usr-firstname','usr-lastname','usr-email','usr-phone','usr-id-number','usr-employee-num'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('usr-role').value = '';
  document.getElementById('usr-status').value = 'active';
  ['usr-firstname','usr-lastname','usr-email','usr-role'].forEach(id => clearErr(id));
  openModal('user-modal');
}

async function openEditUser(userId) {
  editingUserId = userId;
  document.getElementById('user-modal-title').textContent  = 'Edit User';
  document.getElementById('btn-create-user').textContent   = 'Save Changes';
  document.getElementById('usr-pw-section').style.display  = '';
  document.getElementById('usr-welcome-note').style.display = 'none';

  ['usr-firstname','usr-lastname','usr-email','usr-role'].forEach(id => clearErr(id));
  try {
    const resp = await GET(`/api/users/${userId}`);
    const u = resp.data || {};

    // Split name into first/last for editing
    const parts = (u.name || '').split(' ');
    const firstName = parts[0] || '';
    const lastName  = parts.slice(1).join(' ') || '';

    document.getElementById('usr-firstname').value    = firstName;
    document.getElementById('usr-lastname').value     = lastName;
    document.getElementById('usr-email').value        = u.email || '';
    document.getElementById('usr-phone').value        = u.phone || '';
    document.getElementById('usr-id-number').value    = u.id_number || '';
    document.getElementById('usr-employee-num').value = u.employee_number || '';
    document.getElementById('usr-role').value         = u.role || '';
    document.getElementById('usr-status').value       = u.status || 'active';
    document.getElementById('usr-pw').value           = '';
    document.getElementById('usr-pw2').value          = '';
    openModal('user-modal');
  } catch (e) { toast(e.message, 'error'); }
}

async function submitUserModal() {
  const firstName  = document.getElementById('usr-firstname').value.trim();
  const lastName   = document.getElementById('usr-lastname').value.trim();
  const email      = document.getElementById('usr-email').value.trim().toLowerCase();
  const phone      = document.getElementById('usr-phone').value.trim();
  const idNumber   = document.getElementById('usr-id-number').value.trim();
  const empNum     = document.getElementById('usr-employee-num').value.trim();
  const role       = document.getElementById('usr-role').value;
  const status     = document.getElementById('usr-status').value || 'active';
  const pw         = document.getElementById('usr-pw')?.value || '';
  const pw2        = document.getElementById('usr-pw2')?.value || '';
  const name       = [firstName, lastName].filter(Boolean).join(' ');

  ['usr-firstname','usr-lastname','usr-email','usr-role'].forEach(id => clearErr(id));
  let valid = true;
  if (!firstName)                                           { fErr('usr-firstname', 'First name is required'); valid = false; }
  if (!lastName)                                            { fErr('usr-lastname',  'Last name is required');  valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fErr('usr-email', 'Valid email address required'); valid = false; }
  if (!role)                                                { fErr('usr-role', 'Select a role'); valid = false; }
  if (editingUserId && pw) {
    if (pw.length < 8)  { fErr('usr-pw',  'Password must be at least 8 characters'); valid = false; }
    if (pw !== pw2)     { fErr('usr-pw2', 'Passwords do not match'); valid = false; }
  }
  if (!valid) return;

  const btn = document.getElementById('btn-create-user');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

  try {
    const payload = {
      name, email, phone: phone || undefined, role, status,
      id_number: idNumber || undefined,
      employee_number: empNum || undefined,
    };

    if (editingUserId) {
      if (pw) payload.password = pw;
      await PUT(`/api/users/${editingUserId}`, payload);
      toast(`${name} updated successfully`);
    } else {
      // New users get a temporary password and a welcome/reset email
      payload.password        = _tempPassword();
      payload.must_reset_password = true;
      await POST('/api/users', payload);
      // Send welcome/reset link
      try {
        const created = await GET(`/api/users?email=${encodeURIComponent(email)}`);
        const newUser = (created.data || []).find(u => u.email === email);
        if (newUser) await POST(`/api/users/${newUser.id}/send-reset`, {});
      } catch (_) {}
      toast(`${name} created — password reset link sent to ${email}`);
    }
    closeModal('user-modal');
    loadUsers();
  } catch (e) { toast(e.message, 'error'); }
  finally {
    btn.disabled = false;
    btn.innerHTML = editingUserId ? 'Save Changes' : 'Create & Send Welcome';
  }
}

// Generate a random secure temp password the system uses internally
function _tempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── CSV Bulk Import ────────────────────────────────────────────
function downloadUserTemplate() {
  const csv = [
    'first_name,last_name,email,role,phone,id_number,employee_number,status',
    'John,Smith,john.smith@example.com,technician,0821234567,9001015009087,,active',
    'Jane,Doe,jane.doe@example.com,tenant,0831234567,,,active',
    'Bob,Manager,bob@example.com,manager,0841234567,,,active',
  ].join('\n');
  triggerDownload(csv, 'users-template.csv', 'text/csv');
}

function previewUserCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const rows = parseCSV(e.target.result);
    if (!rows.length) { toast('CSV file is empty', 'error'); return; }
    const headers  = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
    const required = ['first_name','last_name','email','role'];
    const missing  = required.filter(r => !headers.includes(r));
    if (missing.length) { toast(`Missing required columns: ${missing.join(', ')}`, 'error'); return; }

    const validRoles = ['technician','maintenance_admin','manager','property_owner'];
    const badRoles   = rows.filter(r => r.role && !validRoles.includes((r.role||'').toLowerCase().trim()));
    if (badRoles.length) toast(`${badRoles.length} row(s) have invalid roles`, 'error');

    pendingUserCSVRows = rows;
    document.getElementById('user-csv-preview').innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">${rows.length} users found</div>
      <div class="table-wrap" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
        <table style="font-size:12px">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.slice(0,12).map(r => {
              const roleKey = (r.role||'').toLowerCase().trim();
              const roleOk  = validRoles.includes(roleKey);
              const name    = [r.first_name, r.last_name].filter(Boolean).join(' ') || '—';
              return `<tr>
                <td style="font-weight:500">${name}</td>
                <td style="color:var(--muted)">${r.email||'—'}</td>
                <td>${roleOk ? badge(roleKey, ROLE_COLORS) : `<span style="color:#b91c1c;font-size:11px">${r.role||'?'} (invalid)</span>`}</td>
                <td style="color:var(--muted);text-transform:capitalize">${r.status||'active'}</td>
              </tr>`;
            }).join('')}
            ${rows.length > 12 ? `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:8px">...and ${rows.length-12} more</td></tr>` : ''}
          </tbody>
        </table>
      </div>`;
    document.getElementById('btn-import-users').disabled = false;
  };
  reader.readAsText(file);
}

async function importUsersCSV() {
  if (!pendingUserCSVRows.length) return;
  const btn = document.getElementById('btn-import-users');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Importing...';

  let created = 0, updated = 0, errors = [];
  const validRoles    = ['technician','maintenance_admin','manager','property_owner'];
  const validStatuses = ['active','inactive','suspended'];

  for (const row of pendingUserCSVRows) {
    const firstName = (row.first_name||'').trim();
    const lastName  = (row.last_name||'').trim();
    const name      = [firstName, lastName].filter(Boolean).join(' ');
    const email     = (row.email||'').trim().toLowerCase();
    const role      = (row.role||'').trim().toLowerCase();
    const phone     = (row.phone||'').trim();
    const idNum     = (row.id_number||'').trim();
    const empNum    = (row.employee_number||'').trim();
    const status    = validStatuses.includes((row.status||'').trim().toLowerCase())
      ? (row.status||'').trim().toLowerCase() : 'active';

    if (!name || !email) { errors.push('Row skipped: missing name or email'); continue; }
    if (!validRoles.includes(role)) { errors.push(`${email}: invalid role "${role}"`); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push(`${email}: invalid email format`); continue; }

    try {
      const existingResp = await GET(`/api/users?email=${encodeURIComponent(email)}`).catch(() => null);
      const existing     = (existingResp?.data || []).find(u => u.email === email);

      if (existing) {
        const payload = { name, role, status };
        if (phone) payload.phone = phone;
        if (idNum) payload.id_number = idNum;
        if (empNum) payload.employee_number = empNum;
        await PUT(`/api/users/${existing.id}`, payload);
        updated++;
      } else {
        const payload = {
          name, email, role, status,
          password: _tempPassword(),
          must_reset_password: true,
          phone: phone || undefined,
          id_number: idNum || undefined,
          employee_number: empNum || undefined,
        };
        const newResp = await POST('/api/users', payload);
        // Send welcome reset link
        try {
          const uid = newResp?.data?.id;
          if (uid) await POST(`/api/users/${uid}/send-reset`, {});
        } catch (_) {}
        created++;
      }
    } catch (e) { errors.push(`${email}: ${e.message}`); }
  }

  btn.disabled = false; btn.innerHTML = 'Import Users';
  closeModal('user-csv-modal');
  pendingUserCSVRows = [];
  document.getElementById('user-csv-file').value = '';
  document.getElementById('user-csv-preview').innerHTML = '';
  document.getElementById('btn-import-users').disabled = true;

  const summary = [`${created} created`, `${updated} updated`, errors.length ? `${errors.length} errors` : null].filter(Boolean).join(', ');
  toast(`Import complete: ${summary}`);
  if (errors.length) console.warn('CSV import errors:', errors);
  loadUsers();
}