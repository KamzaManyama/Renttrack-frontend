// ─────────────────────────────────────────────────────────────
//  register.js  –  Tenant self-registration flow
//
//  Changes vs original:
//  1. No longer requires ?company=slug in the URL.
//  2. Step 0: loads all companies from /api/companies and shows
//     a dropdown so the tenant picks their company first.
//  3. After picking a company the slug is resolved and the rest
//     of the flow (properties → units → submit) works as before.
// ─────────────────────────────────────────────────────────────

const API = (typeof ENV !== 'undefined' && ENV.API_BASE_URL) ? ENV.API_BASE_URL : 'http://localhost:3000';

let selectedSlug = null;   // set after company is chosen
let uploadedFile  = null;

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  // If a ?company=slug was still passed in the URL, pre-select it
  const urlSlug = new URLSearchParams(location.search).get('company');

  await loadCompanies(urlSlug);   // always load the dropdown

  if (urlSlug) {
    // Try to resolve the slug from the URL so we can pre-select
    try {
      const res  = await fetch(`${API}/api/register/${urlSlug}/company`);
      const json = await res.json();
      if (res.ok && json.success) {
        applyCompany(json.data);
        return;
      }
    } catch (_) {}
  }

  // Show the form right away (company picker is step 0)
  document.getElementById('reg-form-wrap').style.display = '';
  document.getElementById('login-link-bar').style.display = '';
  goToStep(1);
})();

// ── Load companies dropdown ───────────────────────────────────
async function loadCompanies(preSelectSlug) {
  const sel = document.getElementById('company-select');
  try {
    const res  = await fetch(`${API}/api/companies/public`);
    const json = await res.json();
    const list = json.data || [];
    list.forEach(c => {
      const o = document.createElement('option');
      o.value = c.slug;
      o.textContent = c.name;
      if (preSelectSlug && c.slug === preSelectSlug) o.selected = true;
      sel.appendChild(o);
    });
  } catch (e) {
    showToast('Could not load companies. Please refresh.', 'error');
  }
}

// ── Company selected ──────────────────────────────────────────
async function onCompanyChange() {
  const slug = document.getElementById('company-select').value;
  clearErr('company-select');
  if (!slug) {
    document.getElementById('company-name').textContent = 'RentTrack';
    document.title = 'Register | RentTrack';
    document.getElementById('slug-text').textContent = '—';
    selectedSlug = null;
    return;
  }
  try {
    const res  = await fetch(`${API}/api/register/${slug}/company`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast('Could not load company details.', 'error');
      return;
    }
    applyCompany(json.data);
  } catch (e) {
    showToast('Could not load company details.', 'error');
  }
}

function applyCompany(data) {
  selectedSlug = data.slug;
  document.getElementById('company-name').textContent = data.name;
  document.getElementById('slug-text').textContent    = data.slug;
  document.title = `Register | ${data.name}`;
  document.getElementById('reg-form-wrap').style.display = '';
  document.getElementById('login-link-bar').style.display = '';
  goToStep(1);
}

// ── Load properties for the selected company ──────────────────
async function loadProperties() {
  const sel = document.getElementById('property-select');
  sel.innerHTML = '<option value="">— Select a property —</option>';
  if (!selectedSlug) return;
  try {
    const res  = await fetch(`${API}/api/register/${selectedSlug}/properties`);
    const json = await res.json();
    (json.data || []).forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = `${p.name} — ${p.address}`;
      sel.appendChild(o);
    });
  } catch (e) {
    showToast('Could not load properties. Please refresh.', 'error');
  }
}

// ── Load vacant units for the selected property ───────────────
async function loadUnits() {
  const propId  = document.getElementById('property-select').value;
  const group   = document.getElementById('unit-group');
  const unitSel = document.getElementById('unit-select');
  clearErr('property');
  if (!propId) { group.style.display = 'none'; return; }
  group.style.display = '';
  unitSel.innerHTML   = '<option value="">Loading units…</option>';
  unitSel.disabled    = true;
  try {
    const res   = await fetch(`${API}/api/register/properties/${propId}/vacant-units`);
    const json  = await res.json();
    const units = json.data || [];
    unitSel.disabled = false;
    if (!units.length) {
      unitSel.innerHTML = '<option value="">No vacant units available</option>';
    } else {
      unitSel.innerHTML = '<option value="">— Select your unit —</option>' +
        units.map(u =>
          `<option value="${u.id}">Unit ${u.unit_number}${u.type ? ' · ' + u.type : ''}${u.floor != null ? ' · Floor ' + u.floor : ''}</option>`
        ).join('');
    }
  } catch (e) {
    unitSel.disabled  = false;
    unitSel.innerHTML = '<option value="">Could not load units</option>';
    showToast('Could not load units. Please try again.', 'error');
  }
}

// ── Step navigation ───────────────────────────────────────────
function nextToStep2() { if (validateStep1()) { loadProperties(); goToStep(2); } }
function nextToStep3() { if (validateStep2()) goToStep(3); }

function goToStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');
  for (let i = 1; i <= 3; i++) {
    const d = document.getElementById(`dot-${i}`);
    if (!d) continue;
    d.classList.toggle('completed', i < n);
    d.classList.toggle('active',    i === n);
  }
}

// ── Validation helpers ────────────────────────────────────────
function v(id) { return (document.getElementById(id)?.value || '').trim(); }

function validateStep0() {
  clearErr('company-select');
  if (!selectedSlug) { showErr('company-select', 'Please select a company'); return false; }
  return true;
}

function validateStep1() {
  let ok = true;
  ['firstname', 'lastname', 'email', 'phone', 'password', 'password2'].forEach(clearErr);
  if (!v('firstname'))                                                { showErr('firstname', 'First name is required'); ok = false; }
  if (!v('lastname'))                                                 { showErr('lastname',  'Last name is required');  ok = false; }
  if (!v('email') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))){ showErr('email',    'Valid email required');    ok = false; }
  if (!v('phone'))                                                    { showErr('phone',    'Phone is required');       ok = false; }
  if (!v('password') || v('password').length < 8)                    { showErr('password', 'Min 8 characters');        ok = false; }
  if (document.getElementById('password').value !== document.getElementById('password2').value) {
    showErr('password2', 'Passwords do not match'); ok = false;
  }
  // Also make sure a company was chosen before proceeding
  if (!selectedSlug) { showErr('company-select', 'Please select a company first'); ok = false; }
  return ok;
}

function validateStep2() {
  let ok = true;
  clearErr('property'); clearErr('unit');
  if (!v('property-select')) { showErr('property', 'Select a property'); ok = false; }
  if (!v('unit-select'))     { showErr('unit',     'Select a unit');     ok = false; }
  return ok;
}

function showErr(id, msg) {
  const e = document.getElementById(`${id}-err`);
  if (e) { e.textContent = msg; e.classList.add('show'); }
  document.getElementById(id)?.classList.add('error');
}
function clearErr(id) {
  const e = document.getElementById(`${id}-err`);
  if (e) { e.textContent = ''; e.classList.remove('show'); }
  document.getElementById(id)?.classList.remove('error');
}

// ── Document upload ───────────────────────────────────────────
function handleFileSelect(e) { if (e.target.files[0]) processFile(e.target.files[0]); }
function handleDrop(e)        { e.preventDefault(); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }
function processFile(file) {
  if (file.size > 5 * 1024 * 1024) { showToast('File must be under 5MB', 'error'); return; }
  uploadedFile = file;
  document.getElementById('dropzone').classList.add('has-file');
  document.getElementById('doc-label').innerHTML =
    `<strong style="color:var(--success)">${file.name}</strong><br>
     <span style="font-size:10px">${(file.size / 1024).toFixed(0)} KB — click to change</span>`;
}

// ── Submit ────────────────────────────────────────────────────
async function submitRegistration() {
  if (!selectedSlug) { showToast('Please select a company first.', 'error'); goToStep(1); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Submitting…';

  try {
    const body = {
      name:        [v('firstname'), v('lastname')].filter(Boolean).join(' '),
      email:       v('email').toLowerCase(),
      phone:       v('phone'),
      password:    document.getElementById('password').value,
      id_number:   v('id-number') || undefined,
      property_id: v('property-select') || undefined,
      unit_id:     v('unit-select') || undefined,
      role:        'tenant',
    };

    const res  = await fetch(`${API}/api/register/${selectedSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      showToast(json.message || 'Registration failed. Please try again.', 'error');
      btn.disabled = false;
      btn.innerHTML = 'Submit Registration';
      return;
    }

    // Success!
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-success').classList.add('active');
    document.querySelectorAll('.step-dot').forEach(d => d.classList.add('completed'));
    document.getElementById('login-link-bar').style.display = 'none';

  } catch (e) {
    showToast('Something went wrong. Please check your connection.', 'error');
    btn.disabled  = false;
    btn.innerHTML = 'Submit Registration';
  }
}

// ── Misc helpers ──────────────────────────────────────────────
function togglePw(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 4500);
}
