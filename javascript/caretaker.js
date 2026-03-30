/* Init */
document.getElementById('sb-app-name').textContent  = (typeof ENV!=='undefined'&&ENV.APP_NAME)||'RentTrack';
document.getElementById('mobileAppName').textContent = (typeof ENV!=='undefined'&&ENV.APP_NAME)||'RentTrack';
document.title = `${(typeof ENV!=='undefined'&&ENV.APP_NAME)||'RentTrack'} — Caretaker`;

if(typeof Auth!=='undefined'){
  if(!Auth.isLoggedIn()){window.location.href='login.html';}
  const user=Auth.user;
  if(!['caretaker', 'maintenance_admin', 'manager'].includes(user?.role)){window.location.href='login.html';}
  if(user){
    document.getElementById('sb-name').textContent=user.name||'—';
    document.getElementById('sb-avatar').textContent=(user.name||'C')[0].toUpperCase();
  }
}

/* Mobile sidebar */
function toggleSidebar(){const s=document.getElementById('sidebar'),o=document.getElementById('menuOverlay'),b=document.getElementById('burgerMenu'),open=s.classList.toggle('open');o.classList.toggle('active',open);b.classList.toggle('active',open);document.body.style.overflow=open?'hidden':'';}
function closeSidebarMobile(){if(window.innerWidth<=768&&document.getElementById('sidebar').classList.contains('open'))toggleSidebar();}
window.addEventListener('resize',()=>{if(window.innerWidth>768){document.getElementById('sidebar').classList.remove('open');document.getElementById('menuOverlay').classList.remove('active');document.getElementById('burgerMenu').classList.remove('active');document.body.style.overflow='';}});
let _tx=0;
document.addEventListener('touchstart',e=>{_tx=e.changedTouches[0].screenX;},{passive:true});
document.addEventListener('touchend',e=>{if(window.innerWidth>768)return;const dx=e.changedTouches[0].screenX-_tx,sb=document.getElementById('sidebar');if(dx>50&&_tx<30&&!sb.classList.contains('open'))toggleSidebar();if(dx<-50&&_tx>200&&sb.classList.contains('open'))toggleSidebar();},{passive:true});
document.addEventListener('DOMContentLoaded',()=>{if(window.innerWidth<=768&&!localStorage.getItem('swipeHintShown')){const h=document.getElementById('swipeHint');h.classList.add('show');localStorage.setItem('swipeHintShown','true');setTimeout(()=>h.classList.remove('show'),3000);}});

/* Notification modal */
let _nt=null;
function showNotification(title,message,icon=''){document.getElementById('notification-icon').textContent=icon;document.getElementById('notification-title').textContent=title;document.getElementById('notification-message').textContent=message;document.getElementById('notification-modal').classList.add('active');clearTimeout(_nt);_nt=setTimeout(closeNotificationModal,4000);}
function closeNotificationModal(){document.getElementById('notification-modal').classList.remove('active');}
function toast(msg,type){showNotification(type==='error'?'Error':'Done',msg,type==='error'?'⚠':'✓');}

/* Badges */
const SC={open:'badge-open',in_progress:'badge-in-progress',assigned:'badge-assigned',completed:'badge-completed',closed:'badge-closed',on_hold:'badge-medium'};
const PC={urgent:'badge-urgent',high:'badge-high',medium:'badge-medium',low:'badge-low'};
const SI={
  open:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
  assigned:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  in_progress:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
  on_hold:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>`,
  completed:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  closed:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
};
const PI={
  urgent:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  high:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>`,
  medium:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  low:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>`,
};
function mb(label,cls,icon){return `<span class="badge ${cls}">${icon||''}${label}</span>`;}

/* Pagination builder */
function buildPagination(containerId,total,perPage,curPage,fnName){
  const el=document.getElementById(containerId);
  const pages=Math.ceil(total/perPage);
  if(pages<=1){el.innerHTML='';return;}
  let ph='';
  for(let i=1;i<=pages;i++){
    if(pages<=7||Math.abs(i-curPage)<=2||i===1||i===pages){
      ph+=`<button class="pagination-page ${i===curPage?'active':''}" onclick="${fnName}(${i})">${i}</button>`;
    } else if(!ph.endsWith('…')){ph+=`<span class="pagination-page" style="cursor:default;color:var(--muted)">…</span>`;}
  }
  el.innerHTML=`<span class="pagination-info">${total} record${total!==1?'s':''}</span>
    <div class="pagination-pages" style="display:flex;gap:4px;align-items:center;">
      <button class="pagination-btn" onclick="${fnName}(${curPage-1})" ${curPage<=1?'disabled':''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>${ph}
      <button class="pagination-btn" onclick="${fnName}(${curPage+1})" ${curPage>=pages?'disabled':''}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>`;
}

/* State */
let allTickets=[], filteredTickets=[];
let technicians=[], workload=[];
let schedules=[];
let currentTicketFilter='all';
let openTicketId=null;
let ticketsPage=1, completedPage=1, techniciansPage=1, schedulesPage=1;
const TPP=12, CPP=15, TECHP=10, SCHEDP=10;

/* Navigation */
function showPage(id,navEl){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById(`page-${id}`).classList.add('active');
  if(navEl)navEl.classList.add('active');
  const t={dashboard:'Dashboard',tickets:'All Tickets',technicians:'Technicians',schedules:'Maintenance Schedules',history:'Ticket History',notifications:'Notifications'};
  document.getElementById('page-title').textContent=t[id]||'';
  if(id==='dashboard')loadDashboard();
  if(id==='tickets')loadAllTickets();
  if(id==='technicians')loadTechnicians();
  if(id==='schedules')loadSchedules();
  if(id==='history')loadHistory();
  if(id==='notifications')loadNotifications();
}
function logout(){if(typeof Auth!=='undefined')Auth.clear();window.location.href='login.html';}
function refreshCurrent(){const a=document.querySelector('.page.active');if(a?.id==='page-dashboard')loadDashboard();if(a?.id==='page-tickets')loadAllTickets();if(a?.id==='page-technicians')loadTechnicians();if(a?.id==='page-schedules')loadSchedules();if(a?.id==='page-history')loadHistory();if(a?.id==='page-notifications')loadNotifications();}

/* Dashboard */
async function loadDashboard(){
  try{
    const [ticketsRes, techRes, schedulesRes] = await Promise.all([
      GET('/api/tickets'),
      GET('/api/users?role=technician'),
      GET('/api/schedules')
    ]);
    
    allTickets = ticketsRes.data || [];
    const techniciansList = techRes.data || [];
    schedules = schedulesRes.data || [];
    
    // Build workload from tickets assigned to each technician
    workload = techniciansList.map(tech => {
      const assignedTickets = allTickets.filter(t =>
        t.assigned_to === tech.id && !['completed','closed'].includes(t.status)
      );
      return { ...tech, tickets: assignedTickets, currentWorkload: assignedTickets.length };
    });
    
    // Stats
    const openCount = allTickets.filter(t => ['open', 'assigned', 'in_progress'].includes(t.status)).length;
    const urgentCount = allTickets.filter(t => t.priority === 'urgent' && !['completed', 'closed'].includes(t.status)).length;
    const overdueCount = allTickets.filter(t => t.due_date && new Date(t.due_date) < new Date() && !['completed', 'closed'].includes(t.status)).length;
    const scheduledToday = schedules.filter(s => s.scheduled_date === new Date().toISOString().split('T')[0] && !s.completed).length;
    
    document.getElementById('stats-open').textContent = openCount;
    document.getElementById('stats-urgent').textContent = urgentCount;
    document.getElementById('stats-overdue').textContent = overdueCount;
    document.getElementById('stats-scheduled').textContent = scheduledToday;
    
    // Recent tickets
    const recent = allTickets
      .filter(t => !['completed', 'closed'].includes(t.status))
      .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
    
    document.getElementById('recent-tickets').innerHTML = recent.length
      ? recent.map(t => `
        <div class="recent-ticket-item" onclick="openTicketModal('${t.id}')">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;margin-top:12px;">
              <span class="badge ${SC[t.status]}">${SI[t.status]||''}${t.status.replace(/_/g,' ')}</span>
              <span class="badge ${PC[t.priority]}">${PI[t.priority]||''}${t.priority}</span>
            </div>
            <div style="font-weight:600;margin-bottom:2px;">${t.ticket_number} - ${t.title}</div>
            <div style="font-size:12px;color:var(--muted);display:flex;gap:12px;">
              <span>${t.property_name} ${t.unit_number ? '• Unit '+t.unit_number : ''}</span>
              <span>${typeof timeAgo==='function'?timeAgo(t.created_at):t.created_at}</span>
            </div>
          </div>
        </div>
      `).join('')
      : '<div style="text-align:center;padding:32px;color:var(--muted)">No active tickets</div>';
    
    // Technician workload
    document.getElementById('tech-workload').innerHTML = workload.length
      ? workload.map(w => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light);">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="tech-avatar">${w.name[0].toUpperCase()}</div>
            <div>
              <div style="font-weight:600">${w.name}</div>
              <div style="font-size:11px;color:var(--muted)">${w.tickets?.length || 0} active jobs</div>
            </div>
          </div>
          <div class="workload-bar">
            <div class="workload-fill" style="width:${Math.min(100, (w.currentWorkload/10)*100)}%"></div>
          </div>
        </div>
      `).join('')
      : '<div style="text-align:center;padding:16px;color:var(--muted)">No technicians found</div>';
      
  }catch(e){toast(e.message,'error');}
}

/* All Tickets (Caretaker sees ALL tickets) */
async function loadAllTickets(){
  try{
    const resp=await GET('/api/tickets');
    allTickets=resp.data||[];
    currentTicketFilter='all';
    ticketsPage=1;
    document.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active'));
    document.querySelector('.filter-pill[data-status="all"]').classList.add('active');
    applyTicketFilters();
  }catch(e){toast(e.message,'error');}
}

function filterTickets(el){
  document.querySelectorAll('.filter-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  currentTicketFilter=el.dataset.status||'all';
  ticketsPage=1;
  applyTicketFilters();
}

function applyTicketFilters(){
  const s=(document.getElementById('ticket-search')?.value||'').toLowerCase();
  const statusMap = {
    'all': () => true,
    'open': t => ['open', 'assigned', 'in_progress', 'on_hold'].includes(t.status),
    'completed': t => ['completed', 'closed'].includes(t.status),
    'urgent': t => t.priority === 'urgent' && !['completed', 'closed'].includes(t.status),
    'unassigned': t => !t.assigned_to && !['completed', 'closed'].includes(t.status)
  };
  
  const filterFn = statusMap[currentTicketFilter] || (() => true);
  
  let f = allTickets.filter(t => {
    const matchesSearch = !s || 
      t.title.toLowerCase().includes(s) || 
      (t.ticket_number||'').toLowerCase().includes(s) ||
      (t.property_name||'').toLowerCase().includes(s) ||
      (t.unit_number||'').toLowerCase().includes(s);
    return matchesSearch && filterFn(t);
  });
  
  f.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  renderTicketsGrid(f);
}

function renderTicketsGrid(tickets){
  const container = document.getElementById('tickets-grid');
  if(!tickets.length){
    container.innerHTML = `<div style="text-align:center;padding:56px 24px;color:var(--muted);font-size:13px;">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.2;margin:0 auto 14px;display:block"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p>No tickets found.</p>
    </div>`;
    document.getElementById('tickets-pagination').innerHTML = '';
    return;
  }
  
  if(ticketsPage > Math.ceil(tickets.length/TPP)) ticketsPage = 1;
  const page = tickets.slice((ticketsPage-1)*TPP, ticketsPage*TPP);
  
  container.innerHTML = `
    <div class="table-responsive">
      <table class="tickets-table">
        <thead>
          <tr>
            <th>Ticket #</th>
            <th>Title</th>
            <th>Property/Unit</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assigned To</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${page.map(t => {
            const statusLabel = (t.status||'unknown').replace(/_/g,' ');
            const createdDate = typeof timeAgo === 'function' ? timeAgo(t.created_at) : t.created_at;
            const location = t.unit_number ? `${t.property_name} • Unit ${t.unit_number}` : t.property_name;
            
            return `
              <tr onclick="openTicketModal('${t.id}')" style="cursor:pointer;">
                <td><span class="ticket-number">${t.ticket_number||'—'}</span></td>
                <td>
                  <div class="ticket-title-cell">${t.title||'Untitled'}</div>
                  ${t.description ? `<div class="ticket-description-preview">${t.description.substring(0,60)}${t.description.length>60?'...':''}</div>` : ''}
                </td>
                <td>${location||'—'}</td>
                <td>${mb(statusLabel, SC[t.status]||'badge-closed', SI[t.status]||'')}</td>
                <td>${mb(t.priority||'unknown', PC[t.priority]||'badge-medium', PI[t.priority]||'')}</td>
                <td>${t.assigned_to_name || '—'}</td>
                <td><span class="date-cell">${createdDate}</span></td>
                <td onclick="event.stopPropagation();">
                  <div class="table-actions">
                    <button class="btn-icon" onclick="openAssignModal('${t.id}')" title="Assign">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                    </button>
                    ${!['completed','closed'].includes(t.status) ? `
                      <button class="btn-icon" onclick="quickCloseTicket('${t.id}')" title="Close">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  buildPagination('tickets-pagination', tickets.length, TPP, ticketsPage, 'changeTicketsPage');
}

function changeTicketsPage(p){
  const max=Math.ceil(filteredTickets.length/TPP);
  if(p<1||p>max)return;
  ticketsPage=p;
  applyTicketFilters();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* Technicians Management */
async function loadTechnicians(){
  try{
    const [techRes, ticketsRes] = await Promise.all([
      GET('/api/users?role=technician'),
      GET('/api/tickets')
    ]);
    technicians = techRes.data || [];
    const allTix = ticketsRes.data || [];
    // Build workload locally from tickets
    workload = technicians.map(tech => {
      const assignedTickets = allTix.filter(t =>
        t.assigned_to === tech.id && !['completed','closed'].includes(t.status)
      );
      return { ...tech, tickets: assignedTickets, currentWorkload: assignedTickets.length };
    });
    techniciansPage = 1;
    renderTechnicians();
  }catch(e){toast(e.message,'error');}
}

function renderTechnicians(){
  const grid = document.getElementById('technicians-grid');
  if(!technicians.length){
    grid.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted)">No technicians found</div>';
    return;
  }
  
  const page = technicians.slice((techniciansPage-1)*TECHP, techniciansPage*TECHP);
  
  grid.innerHTML = page.map(tech => {
    const workload_data = workload.find(w => w.id === tech.id) || { currentWorkload: 0, tickets: [] };
    return `
    <div class="tech-card">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div class="tech-avatar-large">${tech.name[0].toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:16px;">${tech.name}</div>
          <div style="font-size:13px;color:var(--muted);display:flex;gap:8px;margin-top:2px;">
            <span>${tech.email}</span>
            ${tech.phone ? `<span>• ${tech.phone}</span>` : ''}
          </div>
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span>Current Workload</span>
          <span style="font-weight:600">${workload_data.currentWorkload} active jobs</span>
        </div>
        <div class="workload-bar-large">
          <div class="workload-fill" style="width:${Math.min(100, (workload_data.currentWorkload/15)*100)}%"></div>
        </div>
      </div>
      ${workload_data.tickets?.length ? `
      <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Assigned Jobs:</div>
      <div style="max-height:120px;overflow-y:auto;">
        ${workload_data.tickets.slice(0,3).map(t => `
          <div style="padding:6px 0;border-bottom:1px solid var(--border-light);font-size:12px;display:flex;justify-content:space-between;">
            <span>${t.ticket_number}</span>
            <span class="badge ${SC[t.status]}" style="font-size:10px;">${t.status.replace(/_/g,' ')}</span>
          </div>
        `).join('')}
        ${workload_data.tickets.length > 3 ? `<div style="font-size:11px;color:var(--muted);padding:4px 0;">+${workload_data.tickets.length-3} more</div>` : ''}
      </div>
      ` : '<div style="font-size:12px;color:var(--muted);padding:8px 0;">No active jobs assigned</div>'}
    </div>
    `;
  }).join('');
  
  buildPagination('technicians-pagination', technicians.length, TECHP, techniciansPage, 'changeTechniciansPage');
}

function changeTechniciansPage(p){
  const max = Math.ceil(technicians.length/TECHP);
  if(p<1||p>max)return;
  techniciansPage = p;
  renderTechnicians();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* Ticket Assignment Modal */
let currentAssignTicketId = null;

async function openAssignModal(ticketId){
  currentAssignTicketId = ticketId;
  
  try{
    const [ticketRes, techRes] = await Promise.all([
      GET(`/api/tickets/${ticketId}`),
      GET('/api/users?role=technician')
    ]);
    
    const ticket = ticketRes.data;
    const techs = techRes.data || [];
    
    document.getElementById('assign-ticket-info').textContent = `${ticket.ticket_number} - ${ticket.title}`;
    
    const list = document.getElementById('technicians-list');
    list.innerHTML = techs.map(tech => `
      <div class="assign-tech-item" onclick="selectTechnician('${tech.id}')" id="tech-${tech.id}">
        <div style="display:flex;align-items:center;gap:12px;flex:1;">
          <div class="tech-avatar">${tech.name[0].toUpperCase()}</div>
          <div>
            <div style="font-weight:600">${tech.name}</div>
            <div style="font-size:11px;color:var(--muted)">${tech.email}</div>
          </div>
        </div>
        ${ticket.assigned_to === tech.id ? '<span class="badge badge-completed">Current</span>' : ''}
      </div>
    `).join('');
    
    document.getElementById('assign-modal').classList.add('open');
  }catch(e){toast(e.message,'error');}
}

function selectTechnician(techId){
  document.querySelectorAll('.assign-tech-item').forEach(el => {
    el.classList.remove('selected');
  });
  document.getElementById(`tech-${techId}`).classList.add('selected');
  document.getElementById('assign-btn').disabled = false;
  document.getElementById('assign-btn').onclick = () => confirmAssign(techId);
}

async function confirmAssign(techId){
  try{
    await POST(`/api/tickets/${currentAssignTicketId}/assign`, { technician_id: techId });
    toast('Ticket assigned successfully');
    closeAssignModal();
    loadAllTickets();
  }catch(e){toast(e.message,'error');}
}

function closeAssignModal(){
  document.getElementById('assign-modal').classList.remove('open');
  currentAssignTicketId = null;
}

/* Create Ticket Modal */
async function openCreateTicketModal(){
  try{
    const [propsRes, catsRes] = await Promise.all([
      GET('/api/properties'),
      GET('/api/categories')
    ]);
    
    const properties = propsRes.data || [];
    const categories = catsRes.data || [];
    
    const propertySelect = document.getElementById('create-property');
    propertySelect.innerHTML = '<option value="">Select Property</option>' + 
      properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    
    const categorySelect = document.getElementById('create-category');
    categorySelect.innerHTML = '<option value="">Select Category</option>' + 
      categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    document.getElementById('create-ticket-modal').classList.add('open');
  }catch(e){toast(e.message,'error');}
}

async function loadUnitsForProperty(){
  const propertyId = document.getElementById('create-property').value;
  if(!propertyId) return;
  
  try{
    const resp = await GET(`/api/properties/${propertyId}/units`);
    const units = resp.data || [];
    const unitSelect = document.getElementById('create-unit');
    unitSelect.innerHTML = '<option value="">Select Unit (Optional)</option>' + 
      units.map(u => `<option value="${u.id}">Unit ${u.unit_number}</option>`).join('');
  }catch(e){toast(e.message,'error');}
}

async function submitNewTicket(){
  const data = {
    title: document.getElementById('create-title').value,
    description: document.getElementById('create-description').value,
    property_id: document.getElementById('create-property').value,
    unit_id: document.getElementById('create-unit').value || null,
    category_id: document.getElementById('create-category').value,
    priority: document.getElementById('create-priority').value,
    created_by: Auth.user?.id
  };
  
  if(!data.title || !data.property_id || !data.category_id){
    toast('Please fill all required fields', 'error');
    return;
  }
  
  try{
    await POST('/api/tickets', data);
    toast('Ticket created successfully');
    closeCreateTicketModal();
    if(document.querySelector('.page.active')?.id === 'page-tickets'){
      loadAllTickets();
    }
  }catch(e){toast(e.message,'error');}
}

function closeCreateTicketModal(){
  document.getElementById('create-ticket-modal').classList.remove('open');
  document.getElementById('create-title').value = '';
  document.getElementById('create-description').value = '';
  document.getElementById('create-property').value = '';
  document.getElementById('create-unit').innerHTML = '<option value="">Select Unit (Optional)</option>';
  document.getElementById('create-category').value = '';
  document.getElementById('create-priority').value = 'medium';
}

/* Quick Close Ticket */
async function quickCloseTicket(id){
  if(!confirm('Are you sure you want to close this ticket?')) return;
  try{
    await POST(`/api/tickets/${id}/status`, {status: 'closed'});
    toast('Ticket closed');
    loadAllTickets();
  }catch(e){toast(e.message,'error');}
}

/* Ticket Detail Modal */
async function openTicketModal(id){
  openTicketId=id;
  document.getElementById('ticket-modal').classList.add('open');
  document.getElementById('modal-tk-body').innerHTML=`<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px;"><div class="spinner" style="border-color:rgba(0,0,0,.1);border-top-color:var(--tech);margin:0 auto 12px;width:22px;height:22px;"></div>Loading…</div>`;
  document.getElementById('modal-tk-badges').innerHTML='';
  document.getElementById('modal-updates-list').innerHTML='';
  
  try{
    const [tkR, updR, techR] = await Promise.all([
      GET(`/api/tickets/${id}`),
      GET(`/api/tickets/${id}/updates`),
      GET('/api/users?role=technician')
    ]);
    
    const t=tkR.data;
    const updates=updR.data||[];
    const technicians=techR.data||[];
    
    document.getElementById('modal-tk-num').textContent = t.ticket_number||'—';
    document.getElementById('modal-tk-badges').innerHTML = `
      ${mb((t.status||'unknown').replace(/_/g,' '),SC[t.status]||'badge-closed',SI[t.status]||'')}
      ${mb(t.priority||'unknown',PC[t.priority]||'badge-medium',PI[t.priority]||'')}
      ${t.category_name?`<span class="badge badge-category"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>${t.category_name}</span>`:''}
    `;
    
    // Technician select for reassignment
    const techSelect = `
      <div style="margin:16px 0;padding:16px;background:var(--surface);border-radius:var(--radius-sm);border:1px solid var(--border-light);">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:8px;">Assigned Technician</label>
        <div style="display:flex;gap:8px;">
          <select id="modal-tech-select" class="form-control" style="flex:1;">
            <option value="">Unassigned</option>
            ${technicians.map(tech => `<option value="${tech.id}" ${t.assigned_to === tech.id ? 'selected' : ''}>${tech.name}</option>`).join('')}
          </select>
          <button class="btn btn-primary" onclick="reassignTechnician()">Update</button>
        </div>
      </div>
    `;
    
    document.getElementById('modal-tk-body').innerHTML = `
      <h4 style="font-size:18px;font-weight:700;margin-bottom:10px;color:var(--text);text-transform:capitalize;line-height:1.3;">${t.title||'Untitled'}</h4>
      ${t.description?`<div style="font-size:13.5px;color:var(--text-2);line-height:1.65;padding:14px 16px;background:var(--surface);border-radius:var(--radius-sm);border:1px solid var(--border-light);margin-bottom:4px;">${t.description}</div>`:''}
      ${techSelect}
      <div class="detail-grid">
        <div class="detail-block">
          <div class="detail-block-label"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>Location</div>
          <div class="detail-block-value">${t.property_name||'—'}</div>
          ${t.unit_number?`<div class="detail-block-sub"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Unit ${t.unit_number}</div>`:''}
        </div>
        <div class="detail-block">
          <div class="detail-block-label"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Report Details</div>
          <div class="detail-block-sub"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Reported by <strong>${t.created_by_name||'—'}</strong></div>
          <div class="detail-block-sub"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${typeof fmtDate==='function'?fmtDate(t.created_at):t.created_at}</div>
          ${t.due_date?`<div class="detail-block-sub" style="color:#b91c1c;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Due ${typeof fmtDate==='function'?fmtDate(t.due_date):t.due_date}</div>`:''}
        </div>
      </div>
      ${!['completed','closed'].includes(t.status) ? `
      <div style="margin-top:16px;display:flex;gap:8px;">
        <button class="btn btn-primary" onclick="quickCloseTicket('${t.id}')" style="flex:1;">Close Ticket</button>
      </div>
      ` : ''}
    `;
    
    document.getElementById('modal-updates-list').innerHTML = updates.length
      ? updates.map(u=>`<div class="update-item"><div class="update-avatar">${(u.user_name||'?')[0].toUpperCase()}</div><div class="update-body"><div class="update-meta"><strong>${u.user_name||'System'}</strong><span>${typeof timeAgo==='function'?timeAgo(u.created_at):u.created_at}</span>${u.is_internal?`<span class="badge badge-medium" style="font-size:10px;">Internal</span>`:''}</div><div class="update-msg">${u.message||''}</div></div></div>`).join('')
      : '<p style="color:var(--muted);font-size:13px;padding:8px 0;">No updates yet.</p>';
      
  }catch(e){toast(e.message,'error');}
}

async function reassignTechnician(){
  const techId = document.getElementById('modal-tech-select').value;
  try{
    await POST(`/api/tickets/${openTicketId}/assign`, { technician_id: techId || null });
    toast('Assignment updated');
    openTicketModal(openTicketId);
  }catch(e){toast(e.message,'error');}
}

function closeTicketModal(){
  document.getElementById('ticket-modal').classList.remove('open');
  openTicketId=null;
}

/* Maintenance Schedules */
async function loadSchedules(){
  try{
    const resp = await GET('/api/schedules');
    schedules = resp.data || [];
    schedulesPage = 1;
    renderSchedules();
  }catch(e){toast(e.message,'error');}
}

function renderSchedules(){
  const grid = document.getElementById('schedules-grid');
  if(!schedules.length){
    grid.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted)">No maintenance schedules found</div>';
    return;
  }
  
  const page = schedules.slice((schedulesPage-1)*SCHEDP, schedulesPage*SCHEDP);
  
  grid.innerHTML = `
    <div class="table-responsive">
      <table class="schedules-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Property/Area</th>
            <th>Description</th>
            <th>Due Date</th>
            <th>Assigned To</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${page.map(s => {
            const dueDate = typeof fmtDate === 'function' ? fmtDate(s.scheduled_date) : s.scheduled_date;
            const location = s.area_name ? `${s.property_name} • ${s.area_name}` : s.property_name;
            
            return `
              <tr class="${s.completed ? 'schedule-completed' : ''}">
                <td>
                  <div class="schedule-title-cell">${s.title}</div>
                </td>
                <td>${location}</td>
                <td>
                  <div class="schedule-description-preview">${s.description ? (s.description.substring(0,50) + (s.description.length>50?'...':'')) : '—'}</div>
                </td>
                <td><span class="date-cell ${!s.completed && new Date(s.scheduled_date) < new Date() ? 'overdue' : ''}">${dueDate}</span></td>
                <td>${s.assigned_to_name || '—'}</td>
                <td>
                  ${s.completed 
                    ? '<span class="badge badge-completed">Completed</span>'
                    : '<span class="badge badge-in-progress">Scheduled</span>'
                  }
                </td>
                <td>
                  ${!s.completed ? `
                    <button class="btn btn-primary btn-sm" onclick="markScheduleDone('${s.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                      Complete
                    </button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  buildPagination('schedules-pagination', schedules.length, SCHEDP, schedulesPage, 'changeSchedulesPage');
}

async function markScheduleDone(id){
  try{
    const today = new Date().toISOString().split('T')[0];
    await PUT(`/api/schedules/${id}`, { is_active: false, last_run_date: today });
    toast('Schedule marked as completed');
    loadSchedules();
  }catch(e){toast(e.message,'error');}
}

function changeSchedulesPage(p){
  const max = Math.ceil(schedules.length/SCHEDP);
  if(p<1||p>max)return;
  schedulesPage = p;
  renderSchedules();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* Ticket History by Block/Unit */
async function loadHistory(){
  try{
    const [propsRes, ticketsRes] = await Promise.all([
      GET('/api/properties'),
      GET('/api/tickets?status=completed')
    ]);
    
    const properties = propsRes.data || [];
    const completedTickets = ticketsRes.data || [];
    
    const propertySelect = document.getElementById('history-property');
    propertySelect.innerHTML = '<option value="">Select Block/Property</option>' + 
      properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    
    // Show recent history
    const recent = completedTickets
      .sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 20);
    
    renderHistoryTable(recent);
  }catch(e){toast(e.message,'error');}
}

async function loadHistoryByProperty(){
  const propertyId = document.getElementById('history-property').value;
  if(!propertyId) return;
  
  try{
    const resp = await GET(`/api/tickets?property_id=${propertyId}&status=completed,closed`);
    renderHistoryTable(resp.data || []);
  }catch(e){toast(e.message,'error');}
}

async function loadHistoryByUnit(){
  const unitId = document.getElementById('history-unit').value;
  if(!unitId) return;
  
  try{
    const resp = await GET(`/api/tickets?unit_id=${unitId}&status=completed,closed`);
    renderHistoryTable(resp.data || []);
  }catch(e){toast(e.message,'error');}
}

function renderHistoryTable(tickets){
  const tbody = document.getElementById('history-table-body');
  if(!tickets.length){
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--muted)">No ticket history found</td></tr>';
    return;
  }
  
  tbody.innerHTML = tickets.map(t => `
    <tr onclick="openTicketModal('${t.id}')">
      <td>${t.ticket_number || '—'}</td>
      <td>${t.title}</td>
      <td>${t.property_name || '—'}</td>
      <td>${t.unit_number || '—'}</td>
      <td><span class="badge ${SC[t.status]}">${SI[t.status]||''}${t.status.replace(/_/g,' ')}</span></td>
      <td>${t.assigned_to_name || 'Unassigned'}</td>
      <td>${typeof fmtDate==='function'?fmtDate(t.updated_at):t.updated_at}</td>
    </tr>
  `).join('');
}

/* Notifications */
async function loadNotifications(){
  const list=document.getElementById('notif-list');
  list.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px;">Loading…</div>';
  try{
    const resp=await GET('/api/notifications');
    const notifs=resp.data||[];
    let unread=0;
    
    list.innerHTML=notifs.length?notifs.map(n=>{
      if(!n.is_read) unread++;
      return `<div style="display:flex;align-items:flex-start;gap:14px;padding:16px 20px;border-bottom:1px solid var(--border-light);cursor:pointer;transition:background .15s;${!n.is_read?'background:#f0f9ff;':''}" id="notif-${n.id}" onclick="readNotif('${n.id}')">
        <div style="width:8px;height:8px;border-radius:50%;margin-top:6px;flex-shrink:0;background:${n.is_read?'transparent':'var(--tech)'}"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:${n.is_read?500:700};font-size:13.5px;margin-bottom:3px;color:var(--text)">${n.title||'Notification'}</div>
          <div style="font-size:13px;color:var(--text-2);line-height:1.5;">${n.message||''}</div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:6px;display:flex;align-items:center;gap:4px;">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${typeof timeAgo==='function'?timeAgo(n.created_at):n.created_at}
          </div>
        </div>
      </div>`;
    }).join('') : '<div style="text-align:center;padding:48px;color:var(--muted);font-size:13px;">No notifications yet.</div>';
    
    document.getElementById('notif-dot').style.display=unread>0?'inline-block':'none';
  }catch(e){toast(e.message,'error');}
}

async function readNotif(id){
  try{
    await PUT(`/api/notifications/${id}/read`,{});
    const el=document.getElementById(`notif-${id}`);
    if(el){
      el.style.background='transparent';
      const d=el.querySelector('div[style*="border-radius:50%"]');
      if(d) d.style.background='transparent';
    }
  }catch(e){}
}

async function markAllRead(){
  try{
    await PUT('/api/notifications/read-all',{});
    document.getElementById('notif-dot').style.display='none';
    toast('All notifications marked as read');
    loadNotifications();
  }catch(e){toast(e.message,'error');}
}

/* Event Listeners */
document.getElementById('ticket-modal').addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeTicketModal();
});
document.getElementById('assign-modal').addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeAssignModal();
});
document.getElementById('create-ticket-modal').addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeCreateTicketModal();
});

// Search debouncing
let searchTimeout;
document.getElementById('ticket-search')?.addEventListener('input',()=>{
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(applyTicketFilters, 300);
});

// Load initial page
loadDashboard();