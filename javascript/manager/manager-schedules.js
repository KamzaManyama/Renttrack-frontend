// ============================================================
// manager-schedules.js — Maintenance Schedules
// ============================================================

async function loadSchedules() {
  document.getElementById('sched-body').innerHTML = '<tr class="loading-row"><td colspan="8">Loading...</td></tr>';
  try {
    const resp = await GET('/api/schedules');
    const schedules = resp.data || [];
    const today = new Date();
    document.getElementById('sched-body').innerHTML = schedules.length
      ? schedules.map(s => {
          const overdue = new Date(s.next_due_date) < today;
          return `<tr>
            <td style="font-weight:500">${s.title}</td>
            <td style="font-size:12px;color:var(--muted)">${s.property_name || '—'}</td>
            <td style="font-size:12px;color:var(--muted)">${s.category_name || '—'}</td>
            <td><span class="badge" style="background:#f1f5f9;color:#475569;text-transform:capitalize">${s.frequency_type}</span></td>
            <td style="color:${overdue ? '#b91c1c' : 'var(--text-2)'}">
              <strong>${fmtDate(s.next_due_date)}</strong>
              ${overdue ? ' <span style="font-size:11px;font-weight:600;color:#b91c1c">OVERDUE</span>' : ''}
            </td>
            <td style="font-size:12px;color:var(--muted)">${s.assigned_to_name || 'Unassigned'}</td>
            <td>${badge(s.is_active ? 'active' : 'inactive', { active: { bg: '#dcfce7', fg: '#166534' }, inactive: { bg: '#f1f5f9', fg: '#94a3b8' } })}</td>
            <td>
              <button class="btn btn-ghost btn-sm" onclick="toggleSchedule('${s.id}',${!s.is_active})">
                ${s.is_active ? 'Pause' : 'Resume'}
              </button>
            </td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">No maintenance schedules. Add one above.</td></tr>';
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleSchedule(id, state) {
  try {
    await PUT(`/api/schedules/${id}`, { is_active: state });
    toast(state ? 'Schedule resumed' : 'Schedule paused');
    loadSchedules();
  } catch (e) { toast(e.message, 'error'); }
}

async function openSchedModal() {
  await ensureFormData();
  document.getElementById('sc-property').innerHTML = '<option value="">—</option>' +
    allProperties.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('sc-category').innerHTML = '<option value="">— Optional —</option>' +
    allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('sc-tech').innerHTML = '<option value="">— Unassigned —</option>' +
    allTechs.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  document.getElementById('sc-due').value = new Date().toISOString().split('T')[0];
  ['sc-title','sc-desc'].forEach(id => { document.getElementById(id).value = ''; });
  ['sc-title','sc-property','sc-due'].forEach(id => clearErr(id));
  openModal('sched-modal');
}

async function createSchedule() {
  const title    = document.getElementById('sc-title').value.trim();
  const propId   = document.getElementById('sc-property').value;
  const catId    = document.getElementById('sc-category').value;
  const freq     = document.getElementById('sc-freq').value;
  const due      = document.getElementById('sc-due').value;
  const tech     = document.getElementById('sc-tech').value;
  const priority = document.getElementById('sc-priority').value;
  const desc     = document.getElementById('sc-desc').value.trim();

  ['sc-title','sc-property','sc-due'].forEach(id => clearErr(id));
  let valid = true;
  if (!title)  { fErr('sc-title', 'Title is required'); valid = false; }
  if (!propId) { fErr('sc-property', 'Select a property'); valid = false; }
  if (!due)    { fErr('sc-due', 'Due date is required'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('btn-create-sched');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await POST('/api/schedules', {
      title,
      property_id: propId,
      category_id: catId || undefined,
      frequency_type: freq,
      next_due_date: due,
      assigned_to: tech || undefined,
      priority,
      description: desc || undefined,
    });
    toast('Schedule created');
    closeModal('sched-modal');
    allProperties = [];
    loadSchedules();
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Create Schedule'; }
}