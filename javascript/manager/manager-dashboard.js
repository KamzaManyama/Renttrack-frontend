// ============================================================
// manager-dashboard.js — Dashboard & Ticket Metrics
// STATUS_COLORS and PRIORITY_COLORS come from app.js
// ============================================================

// ── Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [tkR, scR, prR, usrR] = await Promise.all([
      GET('/api/tickets'),
      GET('/api/schedules'),
      GET('/api/properties'),
      GET('/api/users?role=technician'),
    ]);
    const tickets = tkR.data || [];
    let open = 0, ip = 0, urgent = 0, done = 0;
    const today = new Date().toDateString();
    tickets.forEach(t => {
      if (['open', 'assigned'].includes(t.status)) open++;
      if (t.status === 'in_progress') ip++;
      if (t.priority === 'urgent' && !['completed', 'closed', 'cancelled'].includes(t.status)) urgent++;
      if (t.status === 'completed' && new Date(t.completed_at || t.updated_at).toDateString() === today) done++;
    });
    document.getElementById('k-open').textContent     = open;
    document.getElementById('k-progress').textContent = ip;
    document.getElementById('k-urgent').textContent   = urgent;
    document.getElementById('k-done').textContent     = done;
    document.getElementById('k-props').textContent    = (prR.data || []).length;
    document.getElementById('k-staff').textContent    = (usrR.data || []).filter(u => u.status === 'active').length;

    const urgentTk = tickets
      .filter(t => ['urgent', 'high'].includes(t.priority) && !['completed', 'closed', 'cancelled'].includes(t.status))
      .slice(0, 8);
    document.getElementById('dash-urgent').innerHTML = urgentTk.length
      ? urgentTk.map(t => `<tr>
          <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">${t.ticket_number}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${t.title}</td>
          <td>${badge(t.priority, PRIORITY_COLORS)}</td>
          <td>${badge(t.status, STATUS_COLORS)}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">No urgent tickets — all clear.</td></tr>';

    const scheds = (scR.data || []).slice(0, 5);
    document.getElementById('dash-sched').innerHTML = scheds.length
      ? scheds.map(s => `<tr>
          <td style="font-weight:500;font-size:13px">${s.title}</td>
          <td style="font-size:12px;color:var(--muted)">${s.property_name || '—'}</td>
          <td style="font-size:12px;color:var(--muted)">${fmtDate(s.next_due_date)}</td>
        </tr>`).join('')
      : '<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--muted)">No schedules.</td></tr>';
  } catch (e) { toast(e.message, 'error'); }
}

// ── Chart helpers ──────────────────────────────────────────────
var _charts = _charts || {};
function destroyChart(key) {
  if (_charts[key]) { _charts[key].destroy(); delete _charts[key]; }
}
function buildChart(key, canvasId, config) {
  destroyChart(key);
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  _charts[key] = new Chart(canvas.getContext('2d'), config);
}

// ── Ticket Metrics ─────────────────────────────────────────────
async function metricsTab(tab, el) {
  document.querySelectorAll('#page-metrics .tab-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const container = document.getElementById('metrics-content');
  container.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted)">Loading...</div>';
  try {
    if (tab === 'overview') {
      const resp = await GET('/api/reports/tickets');
      const r = resp.data || {};
      const bs = r.by_status || {};
      const bp = r.by_priority || {};
      container.innerHTML = `
        <div class="kpi-grid" style="margin-bottom:24px">
          <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value">${r.total || 0}</div></div>
          <div class="kpi"><div class="kpi-label">Open</div><div class="kpi-value" style="color:#1d4ed8">${bs.open || 0}</div></div>
          <div class="kpi"><div class="kpi-label">Assigned</div><div class="kpi-value" style="color:#4338ca">${bs.assigned || 0}</div></div>
          <div class="kpi"><div class="kpi-label">In Progress</div><div class="kpi-value" style="color:#b45309">${bs.in_progress || 0}</div></div>
          <div class="kpi"><div class="kpi-label">Completed</div><div class="kpi-value" style="color:#15803d">${bs.completed || 0}</div></div>
          <div class="kpi"><div class="kpi-label">Avg Resolution</div><div class="kpi-value">${r.avg_resolution_days ? Number(r.avg_resolution_days).toFixed(1)+'d' : '—'}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div class="card"><div class="card-header"><h3>By Status</h3></div>
            <div style="padding:20px;height:260px;display:flex;align-items:center;justify-content:center"><canvas id="chart-status"></canvas></div>
          </div>
          <div class="card"><div class="card-header"><h3>By Priority</h3></div>
            <div style="padding:20px;height:260px;display:flex;align-items:center;justify-content:center"><canvas id="chart-priority"></canvas></div>
          </div>
        </div>`;
      buildChart('status', 'chart-status', {
        type: 'doughnut',
        data: { labels: ['Open','Assigned','In Progress','On Hold','Completed','Cancelled'],
          datasets: [{ data: [bs.open||0,bs.assigned||0,bs.in_progress||0,bs.on_hold||0,bs.completed||0,bs.cancelled||0],
            backgroundColor: ['#3b82f6','#6366f1','#f59e0b','#94a3b8','#22c55e','#e2e8f0'], borderWidth:2, borderColor:'#fff' }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:12}, padding:12 } } } }
      });
      buildChart('priority', 'chart-priority', {
        type: 'doughnut',
        data: { labels: ['Urgent','High','Medium','Low'],
          datasets: [{ data: [bp.urgent||0,bp.high||0,bp.medium||0,bp.low||0],
            backgroundColor: ['#ef4444','#f97316','#eab308','#22c55e'], borderWidth:2, borderColor:'#fff' }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{size:12}, padding:12 } } } }
      });

    } else if (tab === 'technicians') {
      const resp = await GET('/api/reports/technicians');
      const rows = resp.data || [];
      container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
          <div class="card"><div class="card-header"><h3>Assigned vs Completed</h3></div>
            <div style="padding:20px;height:260px"><canvas id="chart-tech-bar"></canvas></div>
          </div>
          <div class="card"><div class="card-header"><h3>Completion Rate</h3></div>
            <div style="padding:20px;height:260px"><canvas id="chart-tech-rate"></canvas></div>
          </div>
        </div>
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Technician</th><th>Assigned</th><th>Completed</th><th>Rate</th><th>Avg Hours</th></tr></thead>
          <tbody>${rows.length ? rows.map(r => {
            const rate = r.total > 0 ? Math.round((r.completed/r.total)*100) : 0;
            const col  = rate >= 80 ? '#22c55e' : rate >= 50 ? '#f59e0b' : '#ef4444';
            return `<tr>
              <td style="font-weight:600">${r.technician}</td>
              <td>${r.total||0}</td>
              <td style="color:#15803d;font-weight:600">${r.completed||0}</td>
              <td><div style="display:flex;align-items:center;gap:8px">
                <div style="flex:1;height:6px;background:#e2e8f0;border-radius:3px;min-width:80px">
                  <div style="height:100%;width:${rate}%;background:${col};border-radius:3px"></div>
                </div>
                <span style="font-size:12px;font-weight:700;min-width:36px">${rate}%</span>
              </div></td>
              <td style="color:var(--muted)">${r.avg_hours ? Number(r.avg_hours).toFixed(1)+'h' : '—'}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted)">No data.</td></tr>'}
          </tbody></table></div></div>`;
      if (rows.length) {
        buildChart('tech-bar','chart-tech-bar',{
          type:'bar', data:{ labels:rows.map(r=>r.technician),
            datasets:[
              { label:'Assigned',  data:rows.map(r=>r.total||0),     backgroundColor:'#93c5fd' },
              { label:'Completed', data:rows.map(r=>r.completed||0), backgroundColor:'#4ade80' },
            ]},
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
        });
        buildChart('tech-rate','chart-tech-rate',{
          type:'bar', data:{ labels:rows.map(r=>r.technician),
            datasets:[{ label:'Completion %', data:rows.map(r=>r.total>0?Math.round((r.completed/r.total)*100):0),
              backgroundColor:rows.map(r=>{ const rt=r.total>0?(r.completed/r.total)*100:0; return rt>=80?'#4ade80':rt>=50?'#fbbf24':'#f87171'; }) }]},
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
            scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'}}} }
        });
      }

    } else if (tab === 'properties') {
      const [tkR, prR] = await Promise.all([GET('/api/tickets'), GET('/api/properties')]);
      const tickets = tkR.data || [];
      const props   = prR.data || [];
      const pm = {};
      props.forEach(p => { pm[p.id] = { name:p.name, open:0, total:0, urgent:0 }; });
      tickets.forEach(t => {
        if (!t.property_id || !pm[t.property_id]) return;
        pm[t.property_id].total++;
        if (['open','assigned','in_progress'].includes(t.status)) pm[t.property_id].open++;
        if (t.priority==='urgent' && !['completed','closed','cancelled'].includes(t.status)) pm[t.property_id].urgent++;
      });
      const rows = Object.values(pm).sort((a,b)=>b.open-a.open);
      container.innerHTML = `
        <div class="card" style="margin-bottom:20px"><div class="card-header"><h3>Open Tickets per Property</h3></div>
          <div style="padding:20px;height:280px"><canvas id="chart-prop-bar"></canvas></div>
        </div>
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Property</th><th>Total</th><th>Open</th><th>Urgent Open</th></tr></thead>
          <tbody>${rows.map(r=>`<tr>
            <td style="font-weight:600">${r.name}</td><td>${r.total}</td>
            <td style="color:${r.open>0?'#1d4ed8':'var(--muted)'};font-weight:${r.open>0?600:400}">${r.open}</td>
            <td style="color:${r.urgent>0?'#b91c1c':'var(--muted)'};font-weight:${r.urgent>0?600:400}">${r.urgent}</td>
          </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted)">No data.</td></tr>'}
          </tbody></table></div></div>`;
      if (rows.length) {
        buildChart('prop-bar','chart-prop-bar',{
          type:'bar', data:{ labels:rows.map(r=>r.name),
            datasets:[
              { label:'Open',   data:rows.map(r=>r.open),   backgroundColor:'#60a5fa' },
              { label:'Urgent', data:rows.map(r=>r.urgent), backgroundColor:'#f87171' },
            ]},
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
        });
      }

    } else if (tab === 'costs') {
      const resp = await GET('/api/reports/costs');
      const r = resp.data || {};
      const parts = Number(r.total_parts||0), labour = Number(r.total_labour||0);
      container.innerHTML = `
        <div class="kpi-grid" style="margin-bottom:24px">
          <div class="kpi"><div class="kpi-label">Parts Cost</div><div class="kpi-value">R${parts.toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Labour Cost</div><div class="kpi-value">R${labour.toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Grand Total</div><div class="kpi-value" style="color:#1d4ed8">R${Number(r.total||0).toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Tickets with Costs</div><div class="kpi-value">${r.tickets_with_costs||0}</div></div>
        </div>
        <div style="max-width:360px;margin:0 auto"><div class="card">
          <div class="card-header"><h3>Cost Breakdown</h3></div>
          <div style="padding:24px;height:280px;display:flex;align-items:center;justify-content:center"><canvas id="chart-costs"></canvas></div>
        </div></div>`;
      buildChart('costs','chart-costs',{
        type:'doughnut',
        data:{ labels:['Parts','Labour'], datasets:[{ data:[parts,labour], backgroundColor:['#60a5fa','#4ade80'], borderWidth:3, borderColor:'#fff' }] },
        options:{ responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{position:'bottom'}, tooltip:{callbacks:{label:ctx=>` R${Number(ctx.parsed).toFixed(2)}`}} } }
      });
    }
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:#b91c1c">${e.message}</div>`;
  }
}