// ============================================================
// manager-bulk-import.js
// Handles: Properties, Properties+Units, Units only, Tenants
// ============================================================

let _bulkTab       = 'properties';
let _bulkRows      = [];
let _inlineUnits   = [];   // units staged in the property modal

// ── Tab switching ──────────────────────────────────────────────
function switchBulkTab(tab, el) {
  _bulkTab = tab;
  _bulkRows = [];
  document.querySelectorAll('.bulk-tab').forEach(b => {
    b.style.borderBottomColor = 'transparent';
    b.style.color = 'var(--muted)';
  });
  el.style.borderBottomColor = 'var(--blue)';
  el.style.color = 'var(--blue)';

  document.getElementById('bulk-csv-file').value = '';
  document.getElementById('bulk-csv-preview').innerHTML = '';
  document.getElementById('btn-import-bulk').disabled = true;
  document.getElementById('bulk-import-summary').textContent = '';

  const info = {
    'properties': '<strong>Required:</strong> property_name, address<br><strong>Optional:</strong> city, province, postal_code, owner_name, type, description',
    'properties-units': '<strong>Required:</strong> property_name, address, unit_number<br><strong>Optional:</strong> city, province, postal_code, owner_name, property_type, unit_type, floor, unit_description<br><em style="color:#64748b">One row per unit. If a property name repeats, it is treated as the same property.</em>',
    'units-only': '<strong>Required:</strong> property_name, unit_number<br><strong>Optional:</strong> floor, type, description<br><em style="color:#64748b">property_name must match an existing property exactly.</em>',
    'staff': '<strong>Required:</strong> first_name, last_name, email, role<br><strong>Optional:</strong> phone, id_number, employee_number, status<br><em style="color:#64748b">Valid roles: technician, maintenance_admin, manager, property_owner. Existing users (matched by email) are updated. New users receive a password setup link.</em>',
  };
  document.getElementById('bulk-info-box').innerHTML = info[tab] || '';
}

function switchPropTab(tab, el) {
  ['details','units'].forEach(t => {
    document.getElementById('prop-tab-'+t).style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.prop-modal-tab').forEach(b => {
    b.style.borderBottomColor = 'transparent';
    b.style.color = 'var(--muted)';
  });
  el.style.borderBottomColor = 'var(--blue)';
  el.style.color = 'var(--blue)';
  document.getElementById('btn-go-units').style.display = tab === 'details' ? '' : 'none';
}

// ── Template downloads ─────────────────────────────────────────
function downloadBulkTemplate() {
  const templates = {
    'properties': [
      'property_name,address,city,province,postal_code,owner_name,type,description',
      'Greenfields Estate,123 Main St,Johannesburg,Gauteng,2000,John Smith,residential,Managed complex',
      'Sunset Offices,45 Beach Rd,Cape Town,Western Cape,8001,Jane Doe,commercial,',
    ],
    'properties-units': [
      'property_name,address,city,province,postal_code,owner_name,property_type,unit_number,unit_type,floor,unit_description',
      'Greenfields Estate,123 Main St,Johannesburg,Gauteng,2000,John Smith,residential,101,apartment,1,',
      'Greenfields Estate,123 Main St,Johannesburg,Gauteng,2000,John Smith,residential,102,apartment,1,Corner unit',
      'Greenfields Estate,123 Main St,Johannesburg,Gauteng,2000,John Smith,residential,201,apartment,2,',
      'Sunset Offices,45 Beach Rd,Cape Town,Western Cape,8001,Jane Doe,commercial,A1,commercial,1,Ground floor office',
    ],
    'units-only': [
      'property_name,unit_number,unit_type,floor,description',
      'Greenfields Estate,301,apartment,3,',
      'Greenfields Estate,302,studio,3,North-facing',
      'Greenfields Estate,P1,parking,0,Basement bay 1',
    ],
    'staff': [
      'first_name,last_name,email,role,phone,id_number,employee_number,status',
      'John,Smith,john.smith@company.com,technician,0821234567,9001015009087,EMP-001,active',
      'Jane,Doe,jane.doe@company.com,maintenance_admin,0831234567,,EMP-002,active',
      'Bob,Manager,bob@company.com,manager,0841234567,,,active',
      'Alice,Owner,alice@propertyco.com,property_owner,0851234567,,,active',
    ],
  };
  const rows = templates[_bulkTab] || templates['properties'];
  triggerDownload(rows.join('\n'), `${_bulkTab}-template.csv`, 'text/csv');
}

// ── CSV preview ────────────────────────────────────────────────
function previewBulkCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _bulkRows = parseCSV(e.target.result);
    if (!_bulkRows.length) { toast('CSV file is empty or unreadable', 'error'); return; }

    const validation = _validateBulkRows(_bulkRows, _bulkTab);
    if (validation.fatal) { toast(validation.fatal, 'error'); return; }

    _renderBulkPreview(_bulkRows, _bulkTab, validation);
    document.getElementById('btn-import-bulk').disabled = false;
    document.getElementById('bulk-import-summary').textContent =
      `${_bulkRows.length} rows · ${validation.errors.length} warnings`;
  };
  reader.readAsText(file);
}

function _validateBulkRows(rows, tab) {
  const errors = [];
  const requiredMap = {
    'properties':       ['property_name','address'],
    'properties-units': ['property_name','address','unit_number'],
    'units-only':       ['property_name','unit_number'],
    'staff':            ['first_name','last_name','email','role'],
  };
  const required = requiredMap[tab] || [];
  const headers  = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
  const missing  = required.filter(r => !headers.includes(r));
  if (missing.length) return { fatal: `Missing required columns: ${missing.join(', ')}` };

  rows.forEach((row, i) => {
    required.forEach(col => {
      if (!(row[col] || '').trim()) errors.push(`Row ${i+2}: missing ${col}`);
    });
    if (tab === 'staff') {
      const validRoles = ['technician','maintenance_admin','manager','property_owner'];
      const role = (row.role || '').trim().toLowerCase();
      if (role && !validRoles.includes(role)) errors.push(`Row ${i+2}: invalid role "${row.role}"`);
    }
  });
  return { errors, fatal: null };
}

function _renderBulkPreview(rows, tab, validation) {
  const preview = document.getElementById('bulk-csv-preview');
  const colMap = {
    'properties':       ['property_name','address','city','owner_name','type'],
    'properties-units': ['property_name','unit_number','unit_type','floor','address'],
    'units-only':       ['property_name','unit_number','unit_type','floor'],
    'staff':            ['first_name','last_name','email','role','status'],
  };
  const cols = colMap[tab] || colMap['properties'];
  const show = rows.slice(0, 8);

  preview.innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text)">
      ${rows.length} rows found
      ${validation.errors.length ? `<span style="color:#b45309;font-weight:500;margin-left:8px">${validation.errors.length} warning${validation.errors.length!==1?'s':''}</span>` : '<span style="color:#15803d;font-weight:500;margin-left:8px">All rows valid</span>'}
    </div>
    ${validation.errors.length ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:#92400e;max-height:80px;overflow-y:auto">${validation.errors.slice(0,5).join('<br>')}${validation.errors.length>5?`<br>...and ${validation.errors.length-5} more`:''}</div>` : ''}
    <div class="table-wrap" style="max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
      <table style="font-size:12px">
        <thead>
          <tr>${cols.map(c=>`<th style="background:var(--surface)">${c.replace('_',' ')}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${show.map(r=>`<tr>${cols.map(c=>`<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[c]||'<span style="color:var(--muted)">—</span>'}</td>`).join('')}</tr>`).join('')}
          ${rows.length > 8 ? `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--muted);padding:8px">...and ${rows.length-8} more rows</td></tr>` : ''}
        </tbody>
      </table>
    </div>`;
}

// ── Run import ─────────────────────────────────────────────────
async function runBulkImport() {
  if (!_bulkRows.length) return;
  const btn = document.getElementById('btn-import-bulk');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Importing...';

  try {
    let result;
    if (_bulkTab === 'properties')        result = await _importProperties(_bulkRows);
    if (_bulkTab === 'properties-units')  result = await _importPropertiesAndUnits(_bulkRows);
    if (_bulkTab === 'units-only')        result = await _importUnitsOnly(_bulkRows);
    if (_bulkTab === 'staff')             result = await _importTenants(_bulkRows);

    closeModal('prop-csv-modal');
    _bulkRows = [];
    document.getElementById('bulk-csv-file').value = '';
    document.getElementById('bulk-csv-preview').innerHTML = '';
    btn.disabled = true;
    btn.innerHTML = 'Import';

    const parts = Object.entries(result).map(([k,v]) => `${v} ${k}`).filter(s => !s.startsWith('0'));
    toast(`Import complete: ${parts.join(', ')}`);
    allProperties = [];
    loadProperties();
  } catch(e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Import';
  }
}

async function _importProperties(rows) {
  let created = 0, updated = 0, errors = 0;
  for (const row of rows) {
    const name    = (row.property_name || '').trim();
    const address = (row.address || '').trim();
    if (!name || !address) { errors++; continue; }
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
    } catch(e) { errors++; }
  }
  return { created, errors };
}

async function _importPropertiesAndUnits(rows) {
  let propsCreated = 0, unitsCreated = 0, errors = 0;
  // Group rows by property name to avoid duplicate property creation
  const propMap = {};
  for (const row of rows) {
    const pname = (row.property_name || '').trim();
    if (!pname) { errors++; continue; }
    if (!propMap[pname]) propMap[pname] = { row, units: [] };
    if ((row.unit_number || '').trim()) propMap[pname].units.push(row);
  }

  for (const [pname, data] of Object.entries(propMap)) {
    const row     = data.row;
    const address = (row.address || '').trim();
    if (!address) { errors++; continue; }

    let propId;
    try {
      // Try to find existing property first
      const existing = (allProperties.length ? allProperties : (await GET('/api/properties')).data || [])
        .find(p => p.name.toLowerCase() === pname.toLowerCase());
      if (existing) {
        propId = existing.id;
      } else {
        const resp = await POST('/api/properties', {
          name:        pname,
          address,
          city:        row.city?.trim()          || undefined,
          province:    row.province?.trim()      || undefined,
          postal_code: row.postal_code?.trim()   || undefined,
          owner_name:  row.owner_name?.trim()    || undefined,
          type:        (row.property_type || row.type || '').trim() || undefined,
          description: row.description?.trim()   || undefined,
        });
        propId = resp.data?.id;
        propsCreated++;
      }
    } catch(e) { errors++; continue; }

    // Create units for this property
    for (const urow of data.units) {
      const unum = (urow.unit_number || '').trim();
      if (!unum || !propId) continue;
      try {
        await POST(`/api/properties/${propId}/units`, {
          unit_number: unum,
          type:        (urow.unit_type || '').trim()        || 'apartment',
          floor:       urow.floor ? parseInt(urow.floor)    : undefined,
          description: urow.unit_description?.trim()        || undefined,
        });
        unitsCreated++;
      } catch(e) { errors++; }
    }
  }
  return { 'properties created': propsCreated, 'units created': unitsCreated, errors };
}

async function _importUnitsOnly(rows) {
  let created = 0, errors = 0;
  // Refresh property list
  const propsResp = await GET('/api/properties');
  const props = propsResp.data || [];

  for (const row of rows) {
    const pname = (row.property_name || '').trim();
    const unum  = (row.unit_number   || '').trim();
    if (!pname || !unum) { errors++; continue; }

    const prop = props.find(p => p.name.toLowerCase() === pname.toLowerCase());
    if (!prop) { errors++; console.warn(`Property not found: "${pname}"`); continue; }

    try {
      await POST(`/api/properties/${prop.id}/units`, {
        unit_number: unum,
        type:        (row.unit_type || row.type || '').trim() || 'apartment',
        floor:       row.floor ? parseInt(row.floor)          : undefined,
        description: row.description?.trim()                  || undefined,
      });
      created++;
    } catch(e) { errors++; }
  }
  return { 'units created': created, errors };
}

async function _importTenants(rows) {
  let created = 0, updated = 0, errors = 0;
  const validRoles    = ['technician','maintenance_admin','manager','property_owner'];
  const validStatuses = ['active','inactive','suspended'];

  for (const row of rows) {
    const firstName = (row.first_name || '').trim();
    const lastName  = (row.last_name  || '').trim();
    const name      = [firstName, lastName].filter(Boolean).join(' ');
    const email     = (row.email  || '').trim().toLowerCase();
    const role      = (row.role   || '').trim().toLowerCase();
    const phone     = (row.phone  || '').trim();
    const idNum     = (row.id_number || '').trim();
    const empNum    = (row.employee_number || '').trim();
    const status    = validStatuses.includes((row.status || '').trim().toLowerCase())
      ? (row.status || '').trim().toLowerCase() : 'active';

    if (!name || !email || !role) { errors++; continue; }
    if (!validRoles.includes(role)) { errors++; continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors++; continue; }

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
        const resp = await POST('/api/users', {
          name, email, role, status,
          password: _tempPassword(),
          must_reset_password: true,
          phone: phone || undefined,
          id_number: idNum || undefined,
          employee_number: empNum || undefined,
        });
        try {
          const uid = resp?.data?.id;
          if (uid) await POST(`/api/users/${uid}/send-reset`, {});
        } catch(_) {}
        created++;
      }
    } catch(e) { errors++; }
  }
  return { created, updated, errors };
}

// ── Inline unit builder inside property modal ─────────────────
function addInlineUnit() {
  const placeholder = document.getElementById('no-units-placeholder');
  if (placeholder) placeholder.remove();

  const uid  = `iu-${Date.now()}`;
  const row  = document.createElement('div');
  row.id     = uid;
  row.style  = 'display:grid;grid-template-columns:1fr 80px 130px 32px;gap:8px;align-items:end';
  row.innerHTML = `
    <div class="form-group" style="margin:0">
      <label style="font-size:10px">Unit number *</label>
      <input type="text" placeholder="e.g. 101" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;width:100%;outline:none" oninput="syncInlineUnits()"/>
    </div>
    <div class="form-group" style="margin:0">
      <label style="font-size:10px">Floor</label>
      <input type="number" placeholder="1" min="0" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;width:100%;outline:none" oninput="syncInlineUnits()"/>
    </div>
    <div class="form-group" style="margin:0">
      <label style="font-size:10px">Type</label>
      <select style="padding:7px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:13px;width:100%;outline:none;background:white" onchange="syncInlineUnits()">
        <option value="apartment">Apartment</option>
        <option value="house">House</option>
        <option value="studio">Studio</option>
        <option value="commercial">Commercial</option>
        <option value="parking">Parking</option>
      </select>
    </div>
    <button onclick="removeInlineUnit('${uid}')" style="padding:7px;border:1.5px solid #fecaca;background:#fef2f2;border-radius:7px;color:#b91c1c;cursor:pointer;height:34px;margin-bottom:1px">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  document.getElementById('inline-units-list').appendChild(row);
  syncInlineUnits();
}

function removeInlineUnit(uid) {
  document.getElementById(uid)?.remove();
  const list = document.getElementById('inline-units-list');
  if (!list.children.length) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px;border:1.5px dashed var(--border);border-radius:10px" id="no-units-placeholder">No units added yet. Click "Add Unit" to start.</div>';
  }
  syncInlineUnits();
}

function syncInlineUnits() {
  const rows = document.querySelectorAll('#inline-units-list > div[id^="iu-"]');
  _inlineUnits = Array.from(rows).map(row => {
    const inputs = row.querySelectorAll('input, select');
    return {
      unit_number: inputs[0]?.value?.trim(),
      floor:       inputs[1]?.value ? parseInt(inputs[1].value) : undefined,
      type:        inputs[2]?.value || 'apartment',
    };
  }).filter(u => u.unit_number);
  const count = document.getElementById('prop-unit-count');
  if (count) count.textContent = _inlineUnits.length;
}

function openBulkUnitEntry() {
  const count = parseInt(prompt('How many units to add at once?', '10') || '0');
  if (!count || count < 1) return;
  const placeholder = document.getElementById('no-units-placeholder');
  if (placeholder) placeholder.remove();
  for (let i = 0; i < Math.min(count, 50); i++) addInlineUnit();
}

// ── Create property WITH inline units ─────────────────────────
async function createPropertyWithUnits() {
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
  if (!name)    { fErr('p-name',    'Property name is required'); valid = false; }
  if (!address) { fErr('p-address', 'Street address is required'); valid = false; }
  if (!valid) {
    // Switch to details tab to show errors
    switchPropTab('details', document.querySelector('[data-tab="details"]'));
    return;
  }

  const btn = document.getElementById('btn-create-prop');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const resp = await POST('/api/properties', {
      name, address,
      owner_name:  owner    || undefined,
      city:        city     || undefined,
      province:    province || undefined,
      postal_code: postal   || undefined,
      type:        type     || undefined,
      description: desc     || undefined,
    });
    const propId = resp.data?.id;

    // Create any inline units
    syncInlineUnits();
    let unitsCreated = 0, unitErrors = 0;
    if (propId && _inlineUnits.length) {
      for (const u of _inlineUnits) {
        try {
          await POST(`/api/properties/${propId}/units`, u);
          unitsCreated++;
        } catch(e) { unitErrors++; }
      }
    }

    const msg = unitsCreated > 0
      ? `Property added with ${unitsCreated} unit${unitsCreated!==1?'s':''}${unitErrors?`, ${unitErrors} unit errors`:''}`
      : 'Property added';
    toast(msg);
    closeModal('prop-modal');

    // Reset form
    ['p-name','p-owner','p-address','p-city','p-province','p-postal','p-desc'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('inline-units-list').innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px;border:1.5px dashed var(--border);border-radius:10px" id="no-units-placeholder">No units added yet. Click "Add Unit" to start.</div>';
    _inlineUnits = [];
    if (document.getElementById('prop-unit-count')) document.getElementById('prop-unit-count').textContent = '0';

    allProperties = [];
    loadProperties();
  } catch(e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = 'Save Property'; }
}

// Keep old createProperty as alias for backward compat
function createProperty() { createPropertyWithUnits(); }