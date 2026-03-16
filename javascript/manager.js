document.getElementById('sb-app-name').textContent = ENV.APP_NAME || 'RentTrack';
document.title = `${ENV.APP_NAME || 'RentTrack'} — Manager`;

if (!Auth.isLoggedIn()) { window.location.href = 'login.html'; }
const user = Auth.user;
if (!['manager','maintenance_admin'].includes(user?.role)) { window.location.href = 'login.html'; }

document.getElementById('sb-name').textContent       = user?.name || '—';
document.getElementById('sb-avatar').textContent     = (user?.name || 'M')[0].toUpperCase();
document.getElementById('sb-role').textContent       = (user?.role || '').replace('_',' ');
document.getElementById('sb-role-label').textContent = user?.role === 'manager' ? 'Manager Portal' : 'Maintenance Admin';

// ── State ─────────────────────────────────────────────────────
let allTickets=[], filteredTk=[], tkPage=1, tkStatus='';
let allUsers=[], filteredUsers=[], usersRole='';
let allProperties=[], allCategories=[], allTechs=[];
let selectedPropId = null;
const PER = 15;

// ── Navigation ─────────────────────────────────────────────────
function showPage(id, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${id}`).classList.add('active');
  if (navEl) navEl.classList.add('active');
  const titles = {dashboard:'Dashboard',tickets:'Tickets',schedules:'Maintenance Schedules',properties:'Properties',units:'Units & Tenants',users:'Users',reports:'Reports',notifications:'Notifications'};
  document.getElementById('page-title').textContent = titles[id] || '';
  document.getElementById('topbar-actions').innerHTML = '';
  if (id==='dashboard')     loadDashboard();
  if (id==='tickets')       loadTickets();
  if (id==='schedules')     loadSchedules();
  if (id==='properties')    loadProperties();
  if (id==='units')         initUnitsPage();
  if (id==='users')         loadUsers();
  if (id==='reports')       { reportTab('tickets', document.querySelector('.tab-btn')); }
  if (id==='notifications') loadNotifications();
}

function logout()       { Auth.clear(); sessionStorage.setItem('rt_logged_out','1'); window.location.replace('login.html'); }
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-backdrop').forEach(b => b.addEventListener('click', e => { if (e.target === b) b.classList.remove('open'); }));

// ── Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [tkR, scR, prR, usrR] = await Promise.all([
      GET('/api/tickets'), GET('/api/schedules'),
      GET('/api/properties'), GET('/api/users?role=technician'),
    ]);
    const tickets = tkR.data || [];
    let open=0,ip=0,urgent=0,done=0;
    const today = new Date().toDateString();
    tickets.forEach(t => {
      if (['open','assigned'].includes(t.status)) open++;
      if (t.status==='in_progress') ip++;
      if (t.priority==='urgent' && !['completed','closed','cancelled'].includes(t.status)) urgent++;
      if (t.status==='completed' && new Date(t.completed_at||t.updated_at).toDateString()===today) done++;
    });
    document.getElementById('k-open').textContent     = open;
    document.getElementById('k-progress').textContent = ip;
    document.getElementById('k-urgent').textContent   = urgent;
    document.getElementById('k-done').textContent     = done;
    document.getElementById('k-props').textContent    = (prR.data||[]).length;
    document.getElementById('k-staff').textContent    = (usrR.data||[]).filter(u=>u.status==='active').length;

    const urgentTk = tickets.filter(t=>['urgent','high'].includes(t.priority)&&!['completed','closed','cancelled'].includes(t.status)).slice(0,8);
    document.getElementById('dash-urgent').innerHTML = urgentTk.length
      ? urgentTk.map(t=>`<tr style="cursor:pointer" onclick="openTicketModal('${t.id}')"><td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">${t.ticket_number}</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${t.title}</td><td>${badge(t.priority,PRIORITY_COLORS)}</td><td>${badge(t.status,STATUS_COLORS)}</td></tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">No urgent tickets 🎉</td></tr>';

    const scheds = (scR.data||[]).slice(0,5);
    document.getElementById('dash-sched').innerHTML = scheds.length
      ? scheds.map(s=>`<tr><td style="font-weight:500;font-size:13px">${s.title}</td><td style="font-size:12px;color:var(--muted)">${s.property_name||'—'}</td><td style="font-size:12px;color:var(--muted)">${fmtDate(s.next_due_date)}</td></tr>`).join('')
      : '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--muted)">No schedules</td></tr>';
  } catch(e) { toast(e.message,'error'); }
}

// ── Tickets ────────────────────────────────────────────────────
async function loadTickets() {
  document.getElementById('tk-body').innerHTML = `<tr class="loading-row"><td colspan="9">Loading…</td></tr>`;
  try {
    const q = tkStatus ? `?status=${tkStatus}` : '';
    const resp = await GET(`/api/tickets${q}`);
    allTickets = resp.data || [];
    tkPage = 1;
    renderTk();
  } catch(e) { toast(e.message,'error'); }
}

function filterTk(el) {
  el.closest('.filter-pills').querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  tkStatus = el.dataset.status||'';
  loadTickets();
}

function renderTk() {
  const search = (document.getElementById('tk-search')?.value||'').toLowerCase();
  const prio   = document.getElementById('tk-priority')?.value||'';
  filteredTk = allTickets.filter(t => {
    const ms = !search || t.title.toLowerCase().includes(search) || t.ticket_number.toLowerCase().includes(search);
    const mp = !prio || t.priority===prio;
    return ms && mp;
  });
  const start = (tkPage-1)*PER;
  const page  = filteredTk.slice(start,start+PER);
  const tbody = document.getElementById('tk-body');
  if (!filteredTk.length) {
    tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">No tickets found.</td></tr>`;
    document.getElementById('tk-pagination').innerHTML='';
    return;
  }
  tbody.innerHTML = page.map(t=>`
    <tr style="cursor:pointer" onclick="openTicketModal('${t.id}')">
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">${t.ticket_number}</td>
      <td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.title}</td>
      <td style="font-size:12px;color:var(--muted)">${t.property_name||'—'}</td>
      <td style="font-size:12px;color:var(--muted)">${t.category_name||'—'}</td>
      <td>${badge(t.priority,PRIORITY_COLORS)}</td>
      <td>${badge(t.status,STATUS_COLORS)}</td>
      <td style="font-size:12px;color:var(--muted)">${t.assigned_to_name||'<em>Unassigned</em>'}</td>
      <td style="font-size:12px;color:var(--muted)">${timeAgo(t.created_at)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openTicketModal('${t.id}')">View</button></td>
    </tr>`).join('');
  const total=filteredTk.length, pages=Math.ceil(total/PER);
  document.getElementById('tk-pagination').innerHTML=`
    <span>${total} ticket${total!==1?'s':''}</span>
    <span style="margin-left:auto;display:flex;gap:6px">
      <button class="btn btn-outline btn-sm" onclick="tkPage--;renderTk()" ${tkPage<=1?'disabled':''}>← Prev</button>
      <span style="padding:5px 10px;font-weight:600">${tkPage}/${pages}</span>
      <button class="btn btn-outline btn-sm" onclick="tkPage++;renderTk()" ${tkPage>=pages?'disabled':''}>Next →</button>
    </span>`;
}

// ── Ticket Modal ───────────────────────────────────────────────
async function openTicketModal(id) {
  openModal('ticket-modal');
  document.getElementById('modal-tk-body').innerHTML = '<p style="color:var(--muted)">Loading…</p>';
  try {
    const [tkR, updR, techR] = await Promise.all([
      GET(`/api/tickets/${id}`), GET(`/api/tickets/${id}/updates`), GET('/api/users?role=technician'),
    ]);
    const t=tkR.data, updates=updR.data||[], techs=techR.data||[];
    document.getElementById('modal-tk-num').textContent = t.ticket_number;
    const statusOptions=['open','assigned','in_progress','on_hold','completed','closed','cancelled'];
    document.getElementById('modal-tk-body').innerHTML=`
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        ${badge(t.status,STATUS_COLORS)} ${badge(t.priority,PRIORITY_COLORS)}
        ${t.category_name?`<span class="badge" style="background:#f1f5f9;color:#475569">${t.category_name}</span>`:''}
      </div>
      <h4 style="font-size:16px;font-weight:700;margin-bottom:8px">${t.title}</h4>
      <p style="font-size:13.5px;color:var(--text-2);line-height:1.6;margin-bottom:14px">${t.description||'<em style="color:var(--muted)">No description</em>'}</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <span>📍 <strong style="color:var(--text-2)">${t.property_name||'—'}</strong></span>
        ${t.unit_number?`<span>🚪 Unit <strong>${t.unit_number}</strong></span>`:''}
        <span>👤 Reported by <strong>${t.created_by_name||'—'}</strong></span>
        <span>📅 ${fmtDate(t.created_at)}</span>
        ${t.due_date?`<span>⏰ Due ${fmtDate(t.due_date)}</span>`:''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div>
          <label style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px">Update Status</label>
          <div style="display:flex;gap:8px">
            <select id="modal-status" style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:white;outline:none">
              ${statusOptions.map(s=>`<option value="${s}" ${t.status===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}
            </select>
            <button class="btn btn-outline btn-sm" onclick="updateStatus('${id}')">Update</button>
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:5px">Assign Technician</label>
          <div style="display:flex;gap:8px">
            <select id="modal-tech" style="flex:1;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;background:white;outline:none">
              <option value="">— Unassigned —</option>
              ${techs.map(tc=>`<option value="${tc.id}" ${t.assigned_to===tc.id?'selected':''}>${tc.name}</option>`).join('')}
            </select>
            <button class="btn btn-outline btn-sm" onclick="assignTech('${id}')">Assign</button>
          </div>
        </div>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;margin-bottom:12px">Updates &amp; Comments</div>
        <div id="modal-updates-list">
          ${updates.length
            ? updates.map(u=>`<div class="update-item"><div class="update-avatar">${(u.user_name||'?')[0].toUpperCase()}</div><div class="update-body"><div class="update-meta"><strong>${u.user_name||'System'}</strong><span>${timeAgo(u.created_at)}</span>${u.is_internal?`<span class="badge" style="background:#fef3c7;color:#b45309;font-size:10px">Internal</span>`:''}</div><div class="update-msg">${u.message||''}</div></div></div>`).join('')
            : '<p style="color:var(--muted);font-size:13px">No updates yet.</p>'}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end">
          <textarea id="modal-comment" rows="2" placeholder="Add a comment…" style="flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-family:inherit;font-size:13px;resize:none;outline:none"></textarea>
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);margin-bottom:8px"><input type="checkbox" id="modal-internal"/> Internal</label>
          <button class="btn btn-primary btn-sm" style="margin-bottom:1px" onclick="postComment('${id}')">Send</button>
        </div>
      </div>`;
  } catch(e) { toast(e.message,'error'); }
}

async function updateStatus(id) {
  const status = document.getElementById('modal-status').value;
  try { await POST(`/api/tickets/${id}/status`,{status}); toast(`Status → ${status.replace('_',' ')}`); loadTickets(); openTicketModal(id); } catch(e) { toast(e.message,'error'); }
}
async function assignTech(id) {
  const techId = document.getElementById('modal-tech').value;
  if (!techId) { toast('Select a technician','error'); return; }
  try { await POST(`/api/tickets/${id}/assign`,{technician_id:techId}); toast('Assigned'); loadTickets(); openTicketModal(id); } catch(e) { toast(e.message,'error'); }
}
async function postComment(id) {
  const msg = document.getElementById('modal-comment').value.trim();
  if (!msg) return;
  const is_internal = document.getElementById('modal-internal')?.checked||false;
  try { await POST(`/api/tickets/${id}/updates`,{message:msg,is_internal}); document.getElementById('modal-comment').value=''; toast('Comment added'); openTicketModal(id); } catch(e) { toast(e.message,'error'); }
}

// ── New Ticket ─────────────────────────────────────────────────
async function openNewTicketModal() {
  await ensureFormData();
  const propSel = document.getElementById('nt-property');
  propSel.innerHTML = '<option value="">—</option>' + allProperties.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  const catSel = document.getElementById('nt-category');
  catSel.innerHTML = '<option value="">— Optional —</option>' + allCategories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const techSel = document.getElementById('nt-assign');
  techSel.innerHTML = '<option value="">— Unassigned —</option>' + allTechs.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  document.getElementById('nt-unit').innerHTML = '<option value="">— Optional —</option>';
  ['nt-title','nt-desc'].forEach(id=>document.getElementById(id).value='');
  openModal('new-ticket-modal');
}
async function loadNtUnits() {
  const pid = document.getElementById('nt-property').value;
  const sel = document.getElementById('nt-unit');
  sel.innerHTML = '<option value="">Loading…</option>';
  if (!pid) { sel.innerHTML='<option value="">— Optional —</option>'; return; }
  const resp = await GET(`/api/properties/${pid}/units`).catch(()=>({data:[]}));
  sel.innerHTML = '<option value="">— Optional —</option>' + (resp.data||[]).map(u=>`<option value="${u.id}">Unit ${u.unit_number}</option>`).join('');
}
async function createTicket() {
  const title    = document.getElementById('nt-title').value.trim();
  const propId   = document.getElementById('nt-property').value;
  const unitId   = document.getElementById('nt-unit').value;
  const catId    = document.getElementById('nt-category').value;
  const priority = document.getElementById('nt-priority').value;
  const techId   = document.getElementById('nt-assign').value;
  const desc     = document.getElementById('nt-desc').value.trim();
  let valid=true;
  if (!title||title.length<3) { fErr('nt-title','Title required (min 3 chars)'); valid=false; }
  if (!propId) { fErr('nt-property','Select a property'); valid=false; }
  if (!valid) return;
  const btn=document.getElementById('btn-create-ticket');
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span>`;
  try {
    const resp = await POST('/api/tickets',{title,property_id:propId,unit_id:unitId||undefined,category_id:catId||undefined,priority,description:desc||undefined});
    if (techId && resp.data?.id) {
      await POST(`/api/tickets/${resp.data.id}/assign`,{technician_id:techId}).catch(()=>{});
    }
    toast('Ticket created'); closeModal('new-ticket-modal'); loadTickets();
  } catch(e) { toast(e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='Create Ticket'; }
}

// ── Schedules ─────────────────────────────────────────────────
async function loadSchedules() {
  document.getElementById('sched-body').innerHTML=`<tr class="loading-row"><td colspan="8">Loading…</td></tr>`;
  try {
    const resp = await GET('/api/schedules');
    const schedules = resp.data||[];
    const today=new Date();
    document.getElementById('sched-body').innerHTML = schedules.length
      ? schedules.map(s=>{
          const overdue=new Date(s.next_due_date)<today;
          return `<tr><td style="font-weight:500">${s.title}</td><td style="font-size:12px;color:var(--muted)">${s.property_name||'—'}</td><td style="font-size:12px;color:var(--muted)">${s.category_name||'—'}</td><td><span class="badge" style="background:#f1f5f9;color:#475569">${s.frequency_type}</span></td><td style="color:${overdue?'#b91c1c':'var(--text-2)'}"><strong>${fmtDate(s.next_due_date)}</strong>${overdue?' ⚠️':''}</td><td style="font-size:12px;color:var(--muted)">${s.assigned_to_name||'Unassigned'}</td><td>${badge(s.is_active?'active':'inactive',{active:{bg:'#dcfce7',fg:'#166534'},inactive:{bg:'#f1f5f9',fg:'#94a3b8'}})}</td><td><button class="btn btn-ghost btn-sm" onclick="toggleSchedule('${s.id}',${!s.is_active})">${s.is_active?'Pause':'Resume'}</button></td></tr>`;
        }).join('')
      : '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">No schedules.</td></tr>';
  } catch(e) { toast(e.message,'error'); }
}
async function toggleSchedule(id,state) {
  try { await PUT(`/api/schedules/${id}`,{is_active:state}); toast(state?'Resumed':'Paused'); loadSchedules(); } catch(e) { toast(e.message,'error'); }
}
async function openSchedModal() {
  await ensureFormData();
  document.getElementById('sc-property').innerHTML='<option value="">—</option>'+allProperties.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('sc-category').innerHTML='<option value="">— Optional —</option>'+allCategories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('sc-tech').innerHTML='<option value="">— Unassigned —</option>'+allTechs.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  document.getElementById('sc-due').value=new Date().toISOString().split('T')[0];
  openModal('sched-modal');
}
async function createSchedule() {
  const title=document.getElementById('sc-title').value.trim();
  const propId=document.getElementById('sc-property').value;
  const catId=document.getElementById('sc-category').value;
  const freq=document.getElementById('sc-freq').value;
  const due=document.getElementById('sc-due').value;
  const tech=document.getElementById('sc-tech').value;
  const priority=document.getElementById('sc-priority').value;
  const desc=document.getElementById('sc-desc').value.trim();
  let valid=true;
  if (!title) { fErr('sc-title','Title required'); valid=false; }
  if (!propId) { fErr('sc-property','Select a property'); valid=false; }
  if (!due)   { fErr('sc-due','Date required'); valid=false; }
  if (!valid) return;
  const btn=document.getElementById('btn-create-sched');
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span>`;
  try {
    await POST('/api/schedules',{title,property_id:propId,category_id:catId||undefined,frequency_type:freq,next_due_date:due,assigned_to:tech||undefined,priority,description:desc||undefined});
    toast('Schedule created'); closeModal('sched-modal'); loadSchedules(); allProperties=[];
  } catch(e) { toast(e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='Create'; }
}

// ── Properties ─────────────────────────────────────────────────
async function loadProperties() {
  try {
    const resp = await GET('/api/properties');
    allProperties = resp.data||[];
    const grid=document.getElementById('prop-grid');
    if (!allProperties.length) { grid.innerHTML='<div style="text-align:center;padding:48px;color:var(--muted)">No properties yet.</div>'; return; }
    grid.innerHTML=allProperties.map(p=>`
      <div class="prop-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div><div style="font-size:15px;font-weight:700">${p.name}</div><div style="font-size:12px;color:var(--muted);margin-top:3px">${p.address}${p.city?', '+p.city:''}</div></div>
          <div style="width:38px;height:38px;border-radius:10px;background:var(--blue-dim);display:flex;align-items:center;justify-content:center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
        </div>
        <div style="display:flex;gap:16px;font-size:13px;margin-bottom:14px">
          <span><strong>${p.unit_count||0}</strong> <span style="color:var(--muted)">units</span></span>
          <span><strong style="color:${(p.open_tickets||0)>0?'#b91c1c':'var(--text)'}">${p.open_tickets||0}</strong> <span style="color:var(--muted)">open tickets</span></span>
        </div>
        <button class="btn btn-outline btn-sm" style="width:100%" onclick="viewPropertyUnits('${p.id}','${p.name}')">View Units</button>
      </div>`).join('');
  } catch(e) { toast(e.message,'error'); }
}
async function createProperty() {
  const name=document.getElementById('p-name').value.trim(), address=document.getElementById('p-address').value.trim();
  const city=document.getElementById('p-city').value.trim(), province=document.getElementById('p-province').value.trim(), postal=document.getElementById('p-postal').value.trim();
  let valid=true;
  if (!name)    { fErr('p-name','Name required'); valid=false; }
  if (!address) { fErr('p-address','Address required'); valid=false; }
  if (!valid) return;
  const btn=document.getElementById('btn-create-prop');
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span>`;
  try {
    await POST('/api/properties',{name,address,city:city||undefined,province:province||undefined,postal_code:postal||undefined});
    toast('Property added'); closeModal('prop-modal');
    ['p-name','p-address','p-city','p-province','p-postal'].forEach(id=>document.getElementById(id).value='');
    loadProperties();
  } catch(e) { toast(e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='Add Property'; }
}
function viewPropertyUnits(propId, propName) {
  selectedPropId = propId;
  showPage('units', document.querySelectorAll('.nav-item')[5]);
  document.getElementById('units-prop-filter').value = propId;
  loadUnits();
}

// ── Units & Tenants ────────────────────────────────────────────
async function initUnitsPage() {
  if (!allProperties.length) {
    const resp = await GET('/api/properties').catch(()=>({data:[]}));
    allProperties = resp.data||[];
  }
  const sel = document.getElementById('units-prop-filter');
  sel.innerHTML = '<option value="">— Select a property —</option>' + allProperties.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  if (selectedPropId) { sel.value=selectedPropId; loadUnits(); }
}

async function loadUnits() {
  const propId = document.getElementById('units-prop-filter').value;
  selectedPropId = propId;
  document.getElementById('btn-add-unit').style.display = propId ? '' : 'none';
  if (!propId) { document.getElementById('units-body').innerHTML='<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Select a property above.</td></tr>'; return; }
  document.getElementById('units-body').innerHTML=`<tr class="loading-row"><td colspan="8">Loading…</td></tr>`;
  try {
    const [unitsR, tenantsR] = await Promise.all([
      GET(`/api/properties/${propId}/units`),
      GET('/api/users?role=tenant'),
    ]);
    const units = unitsR.data||[];
    if (!units.length) { document.getElementById('units-body').innerHTML='<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">No units. Add one above.</td></tr>'; return; }
    // fetch occupancy for each unit
    const occupancyMap = {};
    await Promise.all(units.map(async u => {
      const r = await GET(`/api/units/${u.id}/occupants/current`).catch(()=>({data:null}));
      occupancyMap[u.id] = r.data;
    }));
    document.getElementById('units-body').innerHTML = units.map(u => {
      const occ = occupancyMap[u.id];
      return `<tr>
        <td style="font-weight:600">Unit ${u.unit_number}</td>
        <td style="font-size:12px;color:var(--muted)">${u.floor??'—'}</td>
        <td style="font-size:12px;color:var(--muted);text-transform:capitalize">${u.type||'—'}</td>
        <td style="font-weight:500">${occ ? occ.name : '<span style="color:var(--muted)">Vacant</span>'}</td>
        <td style="font-size:12px;color:var(--muted)">${occ ? occ.email : '—'}</td>
        <td style="font-size:12px;color:var(--muted)">${occ ? (occ.phone||'—') : '—'}</td>
        <td style="font-size:12px;color:var(--muted)">${occ ? fmtDate(occ.move_in_date) : '—'}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          ${occ
            ? `<button class="btn btn-outline btn-sm" onclick="moveOut('${occ.user_id||occ.id}')">Move Out</button>`
            : `<button class="btn btn-primary btn-sm" onclick="openMoveIn('${u.id}')">Move In</button>`}
        </td>
      </tr>`;
    }).join('');
  } catch(e) { toast(e.message,'error'); }
}

async function createUnit() {
  const num  = document.getElementById('u-number').value.trim();
  const floor = document.getElementById('u-floor').value;
  const type = document.getElementById('u-type').value;
  const desc = document.getElementById('u-desc').value.trim();
  if (!num) { fErr('u-number','Unit number required'); return; }
  const btn=document.getElementById('btn-create-unit');
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span>`;
  try {
    await POST(`/api/properties/${selectedPropId}/units`,{unit_number:num,floor:floor?parseInt(floor):undefined,type,description:desc||undefined});
    toast('Unit added'); closeModal('unit-modal'); loadUnits();
  } catch(e) { toast(e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='Add Unit'; }
}

let moveInUnitId = null;
async function openMoveIn(unitId) {
  moveInUnitId = unitId;
  const resp = await GET('/api/users?role=tenant').catch(()=>({data:[]}));
  const sel = document.getElementById('mi-tenant');
  sel.innerHTML = '<option value="">— Select tenant —</option>' + (resp.data||[]).map(t=>`<option value="${t.id}">${t.name} (${t.email})</option>`).join('');
  document.getElementById('mi-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('mi-notes').value = '';
  openModal('movein-modal');
}
async function confirmMoveIn() {
  const userId = document.getElementById('mi-tenant').value;
  const date   = document.getElementById('mi-date').value;
  const notes  = document.getElementById('mi-notes').value.trim();
  let valid=true;
  if (!userId) { fErr('mi-tenant','Select a tenant'); valid=false; }
  if (!date)   { fErr('mi-date','Date required'); valid=false; }
  if (!valid) return;
  const btn=document.getElementById('btn-movein');
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span>`;
  try {
    await POST(`/api/units/${moveInUnitId}/occupants/move-in`,{user_id:userId,move_in_date:date,notes:notes||undefined});
    toast('Tenant moved in'); closeModal('movein-modal'); loadUnits();
  } catch(e) { toast(e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='Confirm Move In'; }
}
async function moveOut(userId) {
  if (!confirm('Move out this tenant?')) return;
  const today = new Date().toISOString().split('T')[0];
  try {
    await POST('/api/occupants/move-out',{user_id:userId,move_out_date:today,reason:'lease_ended'});
    toast('Tenant moved out'); loadUnits();
  } catch(e) { toast(e.message,'error'); }
}

// ── Users ──────────────────────────────────────────────────────
async function loadUsers() {
  document.getElementById('users-body').innerHTML=`<tr class="loading-row"><td colspan="7">Loading…</td></tr>`;
  try {
    const q = usersRole ? `?role=${usersRole}` : '';
    const resp = await GET(`/api/users${q}`);
    filteredUsers = resp.data||[];
    renderUsers();
  } catch(e) { toast(e.message,'error'); }
}
function filterUsers(el) {
  el.closest('.filter-pills').querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  usersRole = el.dataset.role||'';
  loadUsers();
}
const ROLE_COLORS={manager:{bg:'#ede9fe',fg:'#5b21b6'},maintenance_admin:{bg:'#dbeafe',fg:'#1d4ed8'},technician:{bg:'#e0f2fe',fg:'#0369a1'},tenant:{bg:'#f0fdf4',fg:'#15803d'},staff:{bg:'#fef9c3',fg:'#a16207'}};
const STATUS_UC={active:{bg:'#dcfce7',fg:'#166534'},inactive:{bg:'#f1f5f9',fg:'#94a3b8'},suspended:{bg:'#fee2e2',fg:'#b91c1c'},pending:{bg:'#fef3c7',fg:'#b45309'}};
function renderUsers() {
  const tbody=document.getElementById('users-body');
  if (!filteredUsers.length) { tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted)">No users found.</td></tr>`; return; }
  tbody.innerHTML=filteredUsers.map(u=>`
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px"><div style="width:30px;height:30px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:11px;flex-shrink:0">${u.name[0].toUpperCase()}</div><span style="font-weight:600">${u.name}</span></div></td>
      <td style="font-size:13px;color:var(--muted)">${u.email}</td>
      <td style="font-size:13px;color:var(--muted)">${u.phone||'—'}</td>
      <td>${badge(u.role,ROLE_COLORS)}</td>
      <td>${badge(u.status,STATUS_UC)}</td>
      <td style="font-size:12px;color:var(--muted)">${u.last_login?timeAgo(u.last_login):'Never'}</td>
      <td><select onchange="changeUserStatus('${u.id}',this.value)" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:white;outline:none"><option value="">Change…</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspend</option></select></td>
    </tr>`).join('');
}
async function changeUserStatus(id,status) {
  if (!status) return;
  try { await PUT(`/api/users/${id}`,{status}); toast(`Status → ${status}`); loadUsers(); } catch(e) { toast(e.message,'error'); }
}
function openUserModal() {
  ['usr-name','usr-email','usr-phone','usr-pw','usr-pw2'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('usr-role').value='';
  openModal('user-modal');
}
async function createUser() {
  const name=document.getElementById('usr-name').value.trim(), email=document.getElementById('usr-email').value.trim();
  const phone=document.getElementById('usr-phone').value.trim(), role=document.getElementById('usr-role').value;
  const pw=document.getElementById('usr-pw').value, pw2=document.getElementById('usr-pw2').value;
  ['usr-name','usr-email','usr-role','usr-pw','usr-pw2'].forEach(id=>{document.getElementById(id).classList.remove('error');document.getElementById(`${id}-err`).classList.remove('show');});
  let valid=true;
  if (!name||name.length<2) { fErr('usr-name','Name required'); valid=false; }
  if (!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fErr('usr-email','Valid email required'); valid=false; }
  if (!role) { fErr('usr-role','Select a role'); valid=false; }
  if (!pw||pw.length<8) { fErr('usr-pw','Min 8 characters'); valid=false; }
  if (pw!==pw2) { fErr('usr-pw2','Passwords do not match'); valid=false; }
  if (!valid) return;
  const btn=document.getElementById('btn-create-user');
  btn.disabled=true; btn.innerHTML=`<span class="spinner"></span>`;
  try {
    await POST('/api/users',{name,email,phone:phone||undefined,password:pw,role});
    toast(`User "${name}" created`); closeModal('user-modal'); loadUsers();
  } catch(e) { toast(e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='Create User'; }
}

// ── Reports ────────────────────────────────────────────────────
let currentReportTab='tickets';
async function reportTab(tab,el) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  currentReportTab=tab; loadReport(tab);
}
async function loadReport(tab) {
  const el=document.getElementById('report-content');
  el.innerHTML='<div style="text-align:center;padding:48px;color:var(--muted)">Loading…</div>';
  try {
    if (tab==='tickets') {
      const resp=await GET('/api/reports/tickets'); const r=resp.data||{};
      el.innerHTML=`<div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value">${r.total||0}</div></div>
        <div class="kpi"><div class="kpi-label">Open</div><div class="kpi-value" style="color:#1d4ed8">${r.by_status?.open||0}</div></div>
        <div class="kpi"><div class="kpi-label">In Progress</div><div class="kpi-value" style="color:#b45309">${r.by_status?.in_progress||0}</div></div>
        <div class="kpi"><div class="kpi-label">Completed</div><div class="kpi-value" style="color:#15803d">${r.by_status?.completed||0}</div></div>
        <div class="kpi"><div class="kpi-label">Avg Resolution</div><div class="kpi-value">${r.avg_resolution_days?Number(r.avg_resolution_days).toFixed(1)+'d':'—'}</div></div>
        <div class="kpi"><div class="kpi-label">Urgent</div><div class="kpi-value" style="color:#b91c1c">${r.by_priority?.urgent||0}</div></div>
      </div>`;
    } else if (tab==='technicians') {
      const resp=await GET('/api/reports/technicians'); const rows=resp.data||[];
      el.innerHTML=`<div class="card"><div class="table-wrap"><table><thead><tr><th>Technician</th><th>Total</th><th>Completed</th><th>Avg (hrs)</th></tr></thead><tbody>
        ${rows.map(r=>`<tr><td style="font-weight:600">${r.technician}</td><td>${r.total||0}</td><td style="color:#15803d;font-weight:600">${r.completed||0}</td><td>${r.avg_hours?Number(r.avg_hours).toFixed(1):'—'}</td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">No data</td></tr>'}
      </tbody></table></div></div>`;
    } else if (tab==='costs') {
      const resp=await GET('/api/reports/costs'); const r=resp.data||{};
      el.innerHTML=`<div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Parts Cost</div><div class="kpi-value">R${Number(r.total_parts||0).toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-label">Labour Cost</div><div class="kpi-value">R${Number(r.total_labour||0).toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-label">Grand Total</div><div class="kpi-value">R${Number(r.total||0).toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-label">Tickets with Costs</div><div class="kpi-value">${r.tickets_with_costs||0}</div></div>
      </div>`;
    }
  } catch(e) { el.innerHTML=`<div style="text-align:center;padding:48px;color:#b91c1c">${e.message}</div>`; }
}

// ── Notifications ─────────────────────────────────────────────
async function loadNotifications() {
  const list=document.getElementById('notif-list');
  list.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">Loading…</div>';
  try {
    const resp=await GET('/api/notifications'); const notifs=resp.data||[];
    let unread=0;
    list.innerHTML=notifs.length
      ? notifs.map(n=>{if(!n.is_read)unread++;return `<div style="display:flex;gap:14px;align-items:flex-start;padding:16px 20px;border-bottom:1px solid var(--border);${!n.is_read?'background:#fafbff;':''}cursor:pointer" onclick="readNotif('${n.id}',this)"><div style="width:8px;height:8px;border-radius:50%;background:${n.is_read?'transparent':'var(--blue)'};margin-top:6px;flex-shrink:0"></div><div style="flex:1"><div style="font-weight:${n.is_read?500:700};font-size:13.5px;margin-bottom:3px">${n.title||'Notification'}</div><div style="font-size:13px;color:var(--text-2)">${n.message||''}</div><div style="font-size:11.5px;color:var(--muted);margin-top:6px">${timeAgo(n.created_at)}</div></div></div>`;}).join('')
      : '<div style="text-align:center;padding:48px;color:var(--muted)">No notifications.</div>';
    if(unread>0) document.getElementById('notif-dot').style.display='inline-block';
  } catch(e) { toast(e.message,'error'); }
}
async function readNotif(id,el) { try { await PUT(`/api/notifications/${id}/read`,{}); el.style.background='transparent'; el.querySelector('div').style.background='transparent'; } catch(e){} }
async function markAllRead() { try { await PUT('/api/notifications/read-all',{}); toast('All read'); document.getElementById('notif-dot').style.display='none'; loadNotifications(); } catch(e){ toast(e.message,'error'); } }

// ── Helpers ────────────────────────────────────────────────────
async function ensureFormData() {
  if (!allProperties.length || !allCategories.length || !allTechs.length) {
    const [pr,cr,tr] = await Promise.all([GET('/api/properties'),GET('/api/categories'),GET('/api/users?role=technician')]);
    allProperties = pr.data||[]; allCategories = cr.data||[]; allTechs = tr.data||[];
  }
}
function fErr(id,msg) {
  document.getElementById(id)?.classList.add('error');
  const e=document.getElementById(`${id}-err`);
  if(e){e.textContent=msg;e.classList.add('show');}
}

loadDashboard();