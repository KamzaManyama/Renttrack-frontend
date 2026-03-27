document.getElementById('sb-app-name').textContent = ENV.APP_NAME || 'RentTrack';
document.title = `${ENV.APP_NAME || 'RentTrack'} — Super Admin`;

if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; }
if (Auth.user?.role !== 'super_admin') { window.location.href = 'login.html'; }

const user = Auth.user;
document.getElementById('sb-name').textContent   = user?.name || '—';
document.getElementById('sb-avatar').textContent = (user?.name || 'S')[0].toUpperCase();

// ── State ────────────────────────────────────────────────────
let allCompanies = [], allUsers = [], filteredUsers = [], usersPage = 1;
const USERS_PER = 20;

// ── Navigation ───────────────────────────────────────────────
function showPage(id, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${id}`).classList.add('active');
  if (navEl) navEl.classList.add('active');
  const titles = { dashboard:'Dashboard', companies:'Companies', users:'System Users' };
  document.getElementById('page-title').textContent = titles[id] || '';
  document.getElementById('topbar-actions').innerHTML = '';
  if (id === 'dashboard') loadDashboard();
  if (id === 'companies') loadCompanies();
  if (id === 'users')     loadAllUsers();
}

function logout() { Auth.clear(); sessionStorage.setItem('rt_logged_out','1'); window.location.replace('login.html'); }
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-backdrop').forEach(b => b.addEventListener('click', e => { if (e.target === b) b.classList.remove('open'); }));

// ── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const resp = await GET('/api/companies');
    allCompanies = resp.data || [];
    document.getElementById('st-companies').textContent  = allCompanies.length;
    document.getElementById('st-active').textContent     = allCompanies.filter(c => c.status === 'active').length;
    document.getElementById('st-trial').textContent      = allCompanies.filter(c => c.status === 'trial').length;
    document.getElementById('st-suspended').textContent  = allCompanies.filter(c => c.status === 'suspended').length;
    document.getElementById('companies-count').textContent = allCompanies.length;

    document.getElementById('dash-companies-body').innerHTML = allCompanies.length
      ? allCompanies.map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td><span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted)">${c.slug}</span></td>
            <td style="font-size:12px;color:var(--muted)">${c.domain || '—'}</td>
            <td><span class="badge status-pill-${c.status}">${c.status}</span></td>
            <td style="font-size:12px;color:var(--muted)">${fmtDate(c.created_at)}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="openEditCompany(${JSON.stringify(c).replace(/"/g,'&quot;')})">Edit</button></td>
          </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">No companies found.</td></tr>';
  } catch(e) { toast(e.message, 'error'); }
}

// ── Companies ────────────────────────────────────────────────
async function loadCompanies() {
  document.getElementById('companies-body').innerHTML = `<tr class="loading-row"><td colspan="7">Loading…</td></tr>`;
  try {
    const resp = await GET('/api/companies');
    allCompanies = resp.data || [];
    document.getElementById('companies-count').textContent = allCompanies.length;
    document.getElementById('companies-body').innerHTML = allCompanies.length
      ? allCompanies.map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td><span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted)">${c.slug}</span></td>
            <td style="font-size:12px;color:var(--muted)">${c.domain || '—'}</td>
            <td><span class="badge status-pill-${c.status}">${c.status}</span></td>
            <td><span style="display:inline-flex;align-items:center;gap:6px;font-size:12px"><span style="width:12px;height:12px;border-radius:3px;background:${c.primary_color||'#007AFF'};border:1px solid rgba(0,0,0,.1);flex-shrink:0"></span>${c.primary_color||'—'}</span></td>
            <td style="font-size:12px;color:var(--muted)">${fmtDate(c.created_at)}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="openEditCompany(${JSON.stringify(c).replace(/"/g,'&quot;')})">Edit</button>
            </td>
          </tr>`).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--muted)">No companies yet.</td></tr>';
  } catch(e) { toast(e.message, 'error'); }
}

function openCompanyModal() {
  ['c-name','c-slug','c-domain'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('c-status').value = 'trial';
  document.getElementById('c-color').value = '#007AFF';
  openModal('company-modal');
}

async function saveCompany() {
  const name  = document.getElementById('c-name').value.trim();
  const slug  = document.getElementById('c-slug').value.trim().toLowerCase().replace(/\s+/g,'-');
  const domain = document.getElementById('c-domain').value.trim();
  const status = document.getElementById('c-status').value;
  const primary_color = document.getElementById('c-color').value;

  let valid = true;
  if (!name) { fErr('c-name','Name required'); valid=false; }
  if (!slug) { fErr('c-slug','Slug required'); valid=false; }
  if (!valid) return;

  const btn = document.getElementById('btn-save-company');
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span>`;
  try {
    await POST('/api/companies', { name, slug, domain: domain||undefined, status, primary_color });
    toast('Company created');
    closeModal('company-modal');
    loadCompanies();
    loadDashboard();
  } catch(e) { toast(e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='Create Company'; }
}

function openEditCompany(c) {
  document.getElementById('edit-c-id').value    = c.id;
  document.getElementById('edit-c-name').value  = c.name;
  document.getElementById('edit-c-slug').value  = c.slug;
  document.getElementById('edit-c-domain').value = c.domain || '';
  document.getElementById('edit-c-status').value = c.status;
  document.getElementById('edit-c-color').value  = c.primary_color || '#007AFF';
  openModal('edit-company-modal');
}

async function updateCompany() {
  const id   = document.getElementById('edit-c-id').value;
  const name = document.getElementById('edit-c-name').value.trim();
  const slug = document.getElementById('edit-c-slug').value.trim();
  const domain = document.getElementById('edit-c-domain').value.trim();
  const status = document.getElementById('edit-c-status').value;
  const primary_color = document.getElementById('edit-c-color').value;

  const btn = document.getElementById('btn-update-company');
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span>`;
  try {
    await PUT(`/api/companies/${id}`, { name, slug, domain: domain||undefined, status, primary_color });
    toast('Company updated');
    closeModal('edit-company-modal');
    loadCompanies();
    loadDashboard();
  } catch(e) { toast(e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='Save Changes'; }
}

async function deleteCompany() {
  const id   = document.getElementById('edit-c-id').value;
  const name = document.getElementById('edit-c-name').value;
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await DELETE(`/api/companies/${id}`);
    toast('Company deleted');
    closeModal('edit-company-modal');
    loadCompanies();
    loadDashboard();
  } catch(e) { toast(e.message,'error'); }
}
