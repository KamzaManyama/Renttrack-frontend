// ============================================================
// manager-properties.js — Properties, Units & Tenants
// ============================================================

let allProperties      = [];
let allCategories      = [];
let allTechs           = [];
let selectedPropId     = null;
let pendingPropCSVRows = [];
let allUnits           = [];
let unitsPage          = 1;
var UNITS_PER_PAGE = UNITS_PER_PAGE || 20;

// ── Shared form data loader ────────────────────────────────────
async function ensureFormData() {
  if (!allProperties.length || !allCategories.length || !allTechs.length) {
    const [pr, cr, tr] = await Promise.all([
      GET('/api/properties'),
      GET('/api/categories'),
      GET('/api/users?role=technician'),
    ]);
    allProperties = pr.data || [];
    allCategories = cr.data || [];
    allTechs      = tr.data || [];
  }
}

// ── Properties ────────────────────────────────────────────────
async function loadProperties() {
  try {
    const resp = await GET('/api/properties');
    allProperties = resp.data || [];
    const grid = document.getElementById('prop-grid');
    if (!allProperties.length) {
      grid.innerHTML = `<div style="text-align:center;padding:64px;color:var(--muted);grid-column:1/-1">
        <div style="font-size:32px;margin-bottom:12px;opacity:.3">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
        </div>
        <div style="font-weight:600;margin-bottom:6px">No properties yet</div>
        <div style="font-size:13px">Add your first property or import via CSV.</div>
      </div>`;
      return;
    }
    grid.innerHTML = allProperties.map(p => `
      <div class="prop-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:700;margin-bottom:2px">${p.name}</div>
            ${p.owner_name ? `<div style="font-size:12px;color:var(--muted);margin-bottom:2px">Owner: <strong>${p.owner_name}</strong></div>` : ''}
            <div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.address}${p.city ? ', '+p.city : ''}${p.province ? ', '+p.province : ''}</div>
          </div>
          <div style="width:38px;height:38px;border-radius:10px;background:var(--blue-dim);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:10px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
        </div>
        <div style="display:flex;gap:0;font-size:13px;margin-bottom:14px;padding:10px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
          <div style="flex:1;text-align:center;border-right:1px solid var(--border)">
            <div style="font-size:20px;font-weight:700;line-height:1">${p.unit_count || 0}</div>
            <div style="color:var(--muted);font-size:11px;margin-top:2px">Units</div>
          </div>
          <div style="flex:1;text-align:center;border-right:1px solid var(--border)">
            <div style="font-size:20px;font-weight:700;line-height:1;color:${(p.open_tickets||0)>0?'#b91c1c':'var(--text)'}">${p.open_tickets || 0}</div>
            <div style="color:var(--muted);font-size:11px;margin-top:2px">Open Tickets</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="font-size:20px;font-weight:700;line-height:1;color:${(p.occupied_units||0)>0?'#15803d':'var(--muted)'}">${p.occupied_units || 0}</div>
            <div style="color:var(--muted);font-size:11px;margin-top:2px">Occupied</div>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" style="width:100%" onclick="viewPropertyUnits('${p.id}','${p.name}')">View Units &amp; Tenants</button>
      </div>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function createProperty() {
  const name     = document.getElementById('p-name').value.trim();
  const owner    = document.getElementById('p-owner').value.trim();
  const address  = document.getElementById('p-address').value.trim();
  const city     = document.getElementById('p-city').value.trim();
  const province = document.getElementById('p-province').value.trim();
  const postal   = document.getElementById('p-postal').value.trim();
  const type     = document.getElementById('p-type').value;
  const desc     = document.getElementById('p-desc').value.trim();

  ['p-name','p-address'].forEach(id => clearErr(id));
  let valid = true;
  if (!name)    { fErr('p-name', 'Property name is required'); valid = false; }
  if (!address) { fErr('p-address', 'Street address is required'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('btn-create-prop');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await POST('/api/properties', {
      name, address,
      owner_name:   owner    || undefined,
      city:         city     || undefined,
      province:     province || undefined,
      postal_code:  postal   || undefined,
      type:         type     || undefined,
      description:  desc     || undefined,
    });
    toast('Property added');
    closeModal('prop-modal');
    ['p-name','p-owner','p-address','p-city','p-province','p-postal','p-desc'].forEach(id => { document.getElementById(id).value = ''; });
    allProperties = [];
    loadProperties();
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Add Property'; }
}

function viewPropertyUnits(propId, propName) {
  selectedPropId = propId;
  const navEl = Array.from(document.querySelectorAll('.nav-item')).find(n => n.textContent.trim().startsWith('Units'));
  showPage('units', navEl);
  // Set value after showPage so the element is visible and populated
  const sel = document.getElementById('units-prop-filter');
  if (sel) {
    // If options not populated yet, initUnitsPage will handle it via selectedPropId
    if (sel.querySelector(`option[value="${propId}"]`)) {
      sel.value = propId;
      loadUnits();
    }
    // else initUnitsPage will populate and auto-select via selectedPropId
  }
}

// ── Property CSV ───────────────────────────────────────────────
function downloadPropTemplate() {
  const csv = 'name,address,city,province,postal_code,owner_name,type,description\nGreenfields Estate,123 Main St,Johannesburg,Gauteng,2000,John Smith,residential,\nSunset Apartments,45 Beach Road,Cape Town,Western Cape,8001,Jane Doe,residential,Beachfront complex\n';
  triggerDownload(csv, 'properties-template.csv', 'text/csv');
}

function previewPropCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const rows = parseCSV(e.target.result);
    if (!rows.length) { toast('CSV file is empty', 'error'); return; }
    const headers = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
    const missing = ['name','address'].filter(r => !headers.includes(r));
    if (missing.length) { toast(`Missing required columns: ${missing.join(', ')}`, 'error'); return; }
    pendingPropCSVRows = rows;
    document.getElementById('prop-csv-preview').innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:8px">${rows.length} properties found</div>
      <div class="table-wrap" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
        <table style="font-size:12px">
          <thead><tr><th>Name</th><th>Address</th><th>City</th><th>Owner</th></tr></thead>
          <tbody>${rows.slice(0,10).map(r=>`<tr><td style="font-weight:500">${r.name||'—'}</td><td>${r.address||'—'}</td><td>${r.city||'—'}</td><td>${r.owner_name||'—'}</td></tr>`).join('')}
          ${rows.length>10?`<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:8px">...and ${rows.length-10} more</td></tr>`:''}
          </tbody>
        </table>
      </div>`;
    document.getElementById('btn-import-props').disabled = false;
  };
  reader.readAsText(file);
}

async function importPropertiesCSV() {
  if (!pendingPropCSVRows.length) return;
  const btn = document.getElementById('btn-import-props');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  let created = 0, errors = [];
  for (const row of pendingPropCSVRows) {
    const name = (row.name||'').trim(), address = (row.address||'').trim();
    if (!name || !address) { errors.push('Row skipped: missing name or address'); continue; }
    try {
      await POST('/api/properties', {
        name, address,
        city:        row.city?.trim()        || undefined,
        province:    row.province?.trim()    || undefined,
        postal_code: row.postal_code?.trim() || undefined,
        owner_name:  row.owner_name?.trim()  || undefined,
        type:        row.type?.trim()        || undefined,
        description: row.description?.trim() || undefined,
      });
      created++;
    } catch (e) { errors.push(`${name}: ${e.message}`); }
  }
  btn.disabled = false; btn.innerHTML = 'Import Properties';
  closeModal('prop-csv-modal');
  pendingPropCSVRows = [];
  document.getElementById('prop-csv-file').value = '';
  document.getElementById('prop-csv-preview').innerHTML = '';
  document.getElementById('btn-import-props').disabled = true;
  toast(`${created} properties imported${errors.length ? `, ${errors.length} errors` : ''}`);
  allProperties = [];
  loadProperties();
}

// ── Units & Tenants ────────────────────────────────────────────
async function initUnitsPage() {
  if (!allProperties.length) {
    const resp = await GET('/api/properties').catch(()=>({data:[]}));
    allProperties = resp.data || [];
  }
  const sel = document.getElementById('units-prop-filter');
  sel.innerHTML = '<option value="">— Select a property —</option>' +
    allProperties.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  if (selectedPropId) {
    sel.value = selectedPropId;
    if (sel.value === selectedPropId) {
      loadUnits();
    } else {
      // Option not in list yet — add it then load
      const opt = document.createElement('option');
      opt.value = selectedPropId;
      opt.textContent = selectedPropId;
      sel.appendChild(opt);
      sel.value = selectedPropId;
      loadUnits();
    }
  }
}

async function loadUnits() {
  const propId = document.getElementById('units-prop-filter').value;
  selectedPropId = propId;
  const addUnitBtn = document.getElementById('btn-add-unit');
  if (addUnitBtn) addUnitBtn.style.display = propId ? '' : 'none';
  if (!propId) {
    document.getElementById('units-body').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">Select a property above.</td></tr>';
    document.getElementById('units-pagination').innerHTML = '';
    return;
  }
  document.getElementById('units-body').innerHTML = '<tr class="loading-row"><td colspan="8">Loading...</td></tr>';
  try {
    const unitsR = await GET(`/api/properties/${propId}/units`);
    allUnits = unitsR.data || [];
    unitsPage = 1;
    if (!allUnits.length) {
      document.getElementById('units-body').innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">No units found. Add one above.</td></tr>';
      document.getElementById('units-pagination').innerHTML = '';
      return;
    }
    // Fetch occupancy for all units in parallel
    const occupancyMap = {};
    await Promise.all(allUnits.map(async u => {
      const r = await GET(`/api/units/${u.id}/occupants/current`).catch(()=>({data:null}));
      occupancyMap[u.id] = r.data;
    }));
    // Attach occupancy to units for rendering
    allUnits = allUnits.map(u => ({ ...u, _occupant: occupancyMap[u.id] || null }));
    renderUnits();
  } catch (e) { toast(e.message, 'error'); }
}

function renderUnits() {
  const start = (unitsPage-1) * UNITS_PER_PAGE;
  const page  = allUnits.slice(start, start + UNITS_PER_PAGE);
  document.getElementById('units-body').innerHTML = page.map(u => {
    const occ = u._occupant;
    return `<tr>
      <td style="font-weight:600">Unit ${u.unit_number}</td>
      <td style="font-size:12px;color:var(--muted)">${u.floor ?? '—'}</td>
      <td style="font-size:12px;color:var(--muted);text-transform:capitalize">${u.type||'—'}</td>
      <td style="font-weight:500">${occ ? occ.name : '<span style="color:var(--muted)">Vacant</span>'}</td>
      <td style="font-size:12px;color:var(--muted)">${occ ? occ.email : '—'}</td>
      <td style="font-size:12px;color:var(--muted)">${occ ? (occ.phone||'—') : '—'}</td>
      <td style="font-size:12px;color:var(--muted)">${occ ? fmtDate(occ.move_in_date) : '—'}</td>
      <td>
        ${occ
          ? `<button class="btn btn-outline btn-sm" onclick="moveOut('${occ.user_id||occ.id}')">Move Out</button>`
          : `<button class="btn btn-primary btn-sm" onclick="openMoveIn('${u.id}')">Move In</button>`}
      </td>
    </tr>`;
  }).join('');

  const total = allUnits.length;
  const pages = Math.ceil(total / UNITS_PER_PAGE);
  const occupied = allUnits.filter(u => u._occupant).length;
  document.getElementById('units-pagination').innerHTML = total > UNITS_PER_PAGE ? `
    <span style="color:var(--muted);font-size:13px">${total} units &nbsp;|&nbsp; ${occupied} occupied &nbsp;|&nbsp; Page ${unitsPage} of ${pages}</span>
    <span style="margin-left:auto;display:flex;gap:6px">
      <button class="btn btn-outline btn-sm" onclick="unitsPage--;renderUnits()" ${unitsPage<=1?'disabled':''}>Prev</button>
      <button class="btn btn-outline btn-sm" onclick="unitsPage++;renderUnits()" ${unitsPage>=pages?'disabled':''}>Next</button>
    </span>` : `<span style="color:var(--muted);font-size:13px">${total} units &nbsp;|&nbsp; ${occupied} occupied</span>`;
}

async function createUnit() {
  const num   = document.getElementById('u-number').value.trim();
  const floor = document.getElementById('u-floor').value;
  const type  = document.getElementById('u-type').value;
  const desc  = document.getElementById('u-desc').value.trim();
  clearErr('u-number');
  if (!num) { fErr('u-number', 'Unit number is required'); return; }
  const btn = document.getElementById('btn-create-unit');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await POST(`/api/properties/${selectedPropId}/units`, {
      unit_number: num, floor: floor ? parseInt(floor) : undefined, type, description: desc || undefined,
    });
    toast('Unit added');
    closeModal('unit-modal');
    ['u-number','u-floor','u-desc'].forEach(id => { document.getElementById(id).value = ''; });
    loadUnits();
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Add Unit'; }
}

let moveInUnitId = null;
async function openMoveIn(unitId) {
  moveInUnitId = unitId;
  const resp = await GET('/api/users?role=tenant').catch(()=>({data:[]}));
  const sel = document.getElementById('mi-tenant');
  sel.innerHTML = '<option value="">— Select tenant —</option>' +
    (resp.data||[]).map(t=>`<option value="${t.id}">${t.name} (${t.email})</option>`).join('');
  document.getElementById('mi-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('mi-notes').value = '';
  ['mi-tenant','mi-date'].forEach(id => clearErr(id));
  openModal('movein-modal');
}

async function confirmMoveIn() {
  const userId = document.getElementById('mi-tenant').value;
  const date   = document.getElementById('mi-date').value;
  const notes  = document.getElementById('mi-notes').value.trim();
  ['mi-tenant','mi-date'].forEach(id => clearErr(id));
  let valid = true;
  if (!userId) { fErr('mi-tenant','Select a tenant'); valid = false; }
  if (!date)   { fErr('mi-date','Move-in date is required'); valid = false; }
  if (!valid) return;
  const btn = document.getElementById('btn-movein');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await POST(`/api/units/${moveInUnitId}/occupants/move-in`, { user_id:userId, move_in_date:date, notes:notes||undefined });
    toast('Tenant moved in');
    closeModal('movein-modal');
    loadUnits();
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Confirm Move In'; }
}

async function moveOut(userId) {
  if (!confirm('Move out this tenant? This action will be recorded.')) return;
  const today = new Date().toISOString().split('T')[0];
  try {
    await POST('/api/occupants/move-out', { user_id:userId, move_out_date:today, reason:'lease_ended' });
    toast('Tenant moved out');
    loadUnits();
  } catch (e) { toast(e.message, 'error'); }
}

// ── CSV & Download Utilities ───────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,'').toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
    const row  = {};
    headers.forEach((h,i) => { row[h] = vals[i]||''; });
    return row;
  });
}
function triggerDownload(content, filename, mime) {
  const blob = new Blob([content],{type:mime});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}