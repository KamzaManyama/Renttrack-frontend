// ─────────────────────────────────────────────────────────────
//  register.js  —  Tenant self-registration
//
//  Flow:
//   1. Page loads → fetches all active companies from the new
//      public endpoint GET /api/register/companies and populates
//      the company dropdown (no auth token required).
//   2. Tenant picks their company → slug is resolved → brand
//      name + slug pill update in the header.
//   3. Step 1 : personal details (name, email, phone, password)
//   4. Step 2 : property dropdown loads for that company,
//                then unit dropdown loads when property is chosen
//   5. Step 3 : optional document upload + submit
//   6. Success screen shown on 201 response.
//
//  Magic-link support: if ?company=slug is in the URL the
//  company is pre-selected automatically, skipping the picker.
// ─────────────────────────────────────────────────────────────

const API = (typeof ENV !== 'undefined' && ENV.API_BASE_URL)
  ? ENV.API_BASE_URL
  : 'http://localhost:3000';

let selectedSlug = null;   // resolved after company is chosen
let uploadedFile  = null;

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  const urlSlug = new URLSearchParams(location.search).get('company');

  // Always populate the company dropdown first
  await loadCompanies(urlSlug);

  // If a slug came in the URL, try to resolve and pre-select it
  if (urlSlug) {
    try {
      const res  = await fetch(`${API}/api/register/${urlSlug}/company`);
      const json = await res.json();
      if (res.ok && json.success) {
        applyCompany(json.data);
        return;
      }
    } catch (_) { /* fall through and let the user pick manually */ }
  }

  // Show the form (company picker is always visible at the top)
  document.getElementById('reg-form-wrap').style.display = '';
  goToStep(1);
})();

// ── Company dropdown — populated from the new public route ────
async function loadCompanies(preSelectSlug) {
  const sel = document.getElementById('company-select');
  try {
    const res  = await fetch(`${API}/api/register/companies`);
    const json = await res.json();
    const list = Array.isArray(json.data) ? json.data : [];

    if (!list.length) {
      showToast('No companies available. Contact your administrator.', 'error');
      return;
    }

    list.forEach(c => {
      const opt       = document.createElement('option');
      opt.value       = c.slug;
      opt.textContent = c.name;
      if (preSelectSlug && c.slug === preSelectSlug) opt.selected = true;
      sel.appendChild(opt);
    });
  } catch (e) {
    showToast('Could not load companies — please refresh the page.', 'error');
  }
}

// ── Called when the company <select> changes ──────────────────
async function onCompanyChange() {
  const slug = document.getElementById('company-select').value;
  clearErr('company-select');

  if (!slug) {
    selectedSlug = null;
    document.getElementById('company-name').textContent = 'RentTrack';
    document.getElementById('slug-text').textContent    = '—';
    document.title = 'Register | RentTrack';
    return;
  }

  try {
    const res  = await fetch(`${API}/api/register/${slug}/company`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      showToast('Could not load company details — try again.', 'error');
      return;
    }
    applyCompany(json.data);
  } catch (e) {
    showToast('Could not load company details — check your connection.', 'error');
  }
}

// Apply resolved company data to the page
function applyCompany(data) {
  selectedSlug = data.slug;
  document.getElementById('company-name').textContent = data.name;
  document.getElementById('slug-text').textContent    = data.slug;
  document.title = `Register | ${data.name}`;
  document.getElementById('reg-form-wrap').style.display = '';
}

// ── Load properties (called when entering Step 2) ─────────────
async function loadProperties() {
  const sel = document.getElementById('property-select');
  sel.innerHTML = '<option value="">— Select a property —</option>';

  if (!selectedSlug) return;

  try {
    const res  = await fetch(`${API}/api/register/${selectedSlug}/properties`);
    const json = await res.json();
    (json.data || []).forEach(p => {
      const opt       = document.createElement('option');
      opt.value       = p.id;
      opt.textContent = `${p.name} — ${p.address}`;
      sel.appendChild(opt);
    });
  } catch (e) {
    showToast('Could not load properties — please refresh.', 'error');
  }
}

// ── Load vacant units when a property is chosen ───────────────
async function loadUnits() {
  const propId  = document.getElementById('property-select').value;
  const group   = document.getElementById('unit-group');
  const unitSel = document.getElementById('unit-select');

  clearErr('property');

  if (!propId) {
    group.style.display = 'none';
    return;
  }

  group.style.display   = '';
  unitSel.innerHTML     = '<option value="">Loading units…</option>';
  unitSel.disabled      = true;

  try {
    const res   = await fetch(`${API}/api/register/properties/${propId}/vacant-units`);
    const json  = await res.json();
    const units = json.data || [];

    unitSel.disabled = false;

    if (!units.length) {
      unitSel.innerHTML = '<option value="">No vacant units available</option>';
    } else {
      unitSel.innerHTML =
        '<option value="">— Select your unit —</option>' +
        units.map(u =>
          `<option value="${u.id}">` +
            `Unit ${u.unit_number}` +
            `${u.type  ? ' · ' + u.type          : ''}` +
            `${u.floor != null ? ' · Floor ' + u.floor : ''}` +
          `</option>`
        ).join('');
    }
  } catch (e) {
    unitSel.disabled  = false;
    unitSel.innerHTML = '<option value="">Could not load units</option>';
    showToast('Could not load units — please try again.', 'error');
  }
}

// ── Step navigation ───────────────────────────────────────────
function nextToStep2() {
  if (validateStep1()) {
    loadProperties();
    goToStep(2);
  }
}

function nextToStep3() {
  if (validateStep2()) goToStep(3);
}

function goToStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    dot.classList.toggle('completed', i < n);
    dot.classList.toggle('active',    i === n);
  }
}

// ── Validation ────────────────────────────────────────────────
function v(id) {
  return (document.getElementById(id)?.value || '').trim();
}

function validateStep1() {
  let ok = true;
  ['firstname', 'lastname', 'email', 'phone', 'password', 'password2'].forEach(clearErr);

  if (!selectedSlug) {
    showErr('company-select', 'Please select your company first');
    ok = false;
  }
  if (!v('firstname'))                                                 { showErr('firstname', 'First name is required'); ok = false; }
  if (!v('lastname'))                                                  { showErr('lastname',  'Last name is required');  ok = false; }
  if (!v('email') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) { showErr('email',     'Valid email required');   ok = false; }
  if (!v('phone'))                                                     { showErr('phone',     'Phone is required');      ok = false; }
  if (!v('password') || v('password').length < 8)                     { showErr('password',  'Minimum 8 characters');   ok = false; }
  if (document.getElementById('password').value !==
      document.getElementById('password2').value)                     { showErr('password2', 'Passwords do not match'); ok = false; }

  return ok;
}

function validateStep2() {
  let ok = true;
  clearErr('property');
  clearErr('unit');
  if (!v('property-select')) { showErr('property', 'Please select a property'); ok = false; }
  if (!v('unit-select'))     { showErr('unit',     'Please select a unit');     ok = false; }
  return ok;
}

function showErr(id, msg) {
  const el = document.getElementById(`${id}-err`);
  if (el) { el.textContent = msg; el.classList.add('show'); }
  document.getElementById(id)?.classList.add('error');
}

function clearErr(id) {
  const el = document.getElementById(`${id}-err`);
  if (el) { el.textContent = ''; el.classList.remove('show'); }
  document.getElementById(id)?.classList.remove('error');
}

// ── Document upload ───────────────────────────────────────────
function handleFileSelect(e) {
  if (e.target.files[0]) processFile(e.target.files[0]);
}

function handleDrop(e) {
  e.preventDefault();
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
}

function processFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast('File must be under 5 MB', 'error');
    return;
  }
  uploadedFile = file;
  document.getElementById('dropzone').classList.add('has-file');
  document.getElementById('doc-label').innerHTML =
    `<strong style="color:var(--success)">${file.name}</strong><br>` +
    `<span style="font-size:10px">${(file.size / 1024).toFixed(0)} KB — click to change</span>`;
}

// ── Submit ────────────────────────────────────────────────────
async function submitRegistration() {
  if (!selectedSlug) {
    showToast('Please select your company before submitting.', 'error');
    goToStep(1);
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Submitting…';

  try {
    const body = {
      name:        [v('firstname'), v('lastname')].filter(Boolean).join(' '),
      email:       v('email').toLowerCase(),
      phone:       v('phone'),
      password:    document.getElementById('password').value,
      role:        'tenant',
      id_number:   v('id-number')        || undefined,
      property_id: v('property-select')  || undefined,
      unit_id:     v('unit-select')      || undefined,
    };

    const res  = await fetch(`${API}/api/register/${selectedSlug}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const json = await res.json();

    if (!res.ok || !json.success) {
      showToast(json.message || 'Registration failed — please try again.', 'error');
      btn.disabled  = false;
      btn.innerHTML = 'Submit Registration';
      return;
    }

    // ── Success ──────────────────────────────────────────────
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-success').classList.add('active');
    document.querySelectorAll('.step-dot').forEach(d => d.classList.add('completed'));
    document.getElementById('login-link-bar').style.display = 'none';

  } catch (e) {
    showToast('Something went wrong — please check your connection.', 'error');
    btn.disabled  = false;
    btn.innerHTML = 'Submit Registration';
  }
}

// ── Password toggle ───────────────────────────────────────────
function togglePw(id) {
  const el = document.getElementById(id);
  el.type  = el.type === 'password' ? 'text' : 'password';
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const el    = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast toast-${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 4500);
}
