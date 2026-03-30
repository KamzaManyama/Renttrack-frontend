// ── Billing & Subscriptions ───────────────────────────────────
// Uses shared GET / POST / PUT / DELETE helpers from app.js.
// All routes are /api/billing/* and require super_admin token.

let billingPlans         = [];
let billingSubscriptions = [];
let billingInvoices      = [];
let currentSubId         = null;   // subscription being edited
let currentInvId         = null;   // invoice being acted on

// ══════════════════════════════════════════════════════════════
// INIT — load everything when page becomes visible
// ══════════════════════════════════════════════════════════════
async function loadBilling() {
  await Promise.all([
    loadBillingSummary(),
    loadSubscriptions(),
    loadPlans(),        // needed for dropdowns
  ]);
}

// ══════════════════════════════════════════════════════════════
// SUMMARY CARDS
// ══════════════════════════════════════════════════════════════
async function loadBillingSummary() {
  try {
    const json = await GET('/api/billing/summary');
    const s    = json.data;

    billingSetText('billing-mrr',
      `R ${Number(s.mrr).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`);
    billingSetText('billing-active-subs',  s.activeSubscriptions  ?? 0);
    billingSetText('billing-trial-subs',   s.trialSubscriptions   ?? 0);
    billingSetText('billing-pending-inv',  s.pendingInvoices      ?? 0);
    billingSetText('billing-pending-total',
      `R ${Number(s.pendingInvoicesTotal ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`);
  } catch (e) {
    console.error('Billing summary error:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// SUBSCRIPTIONS TABLE
// ══════════════════════════════════════════════════════════════
async function loadSubscriptions() {
  const search = document.getElementById('billing-search')?.value || '';
  const status = document.getElementById('billing-status-filter')?.value || 'all';

  const params = new URLSearchParams();
  if (search.trim())      params.set('search', search.trim());
  if (status !== 'all')   params.set('status', status);

  const tbody = document.getElementById('subscriptions-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty">Loading…</td></tr>`;

  try {
    const qs   = params.toString() ? `?${params}` : '';
    const json = await GET(`/api/billing/subscriptions${qs}`);
    billingSubscriptions = json.data || [];
    renderSubscriptions();
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty">${e.message}</td></tr>`;
    toast(e.message, 'error');
  }
}

function renderSubscriptions() {
  const tbody = document.getElementById('subscriptions-body');
  if (!tbody) return;

  if (!billingSubscriptions.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">No subscriptions found.</td></tr>`;
    return;
  }

  const STATUS_STYLES = {
    active:    'background:#dcfce7;color:#166534',
    trial:     'background:#fef3c7;color:#b45309',
    past_due:  'background:#fee2e2;color:#b91c1c',
    cancelled: 'background:#f1f5f9;color:#64748b',
    suspended: 'background:#fee2e2;color:#991b1b',
  };

  tbody.innerHTML = billingSubscriptions.map(s => {
    const price      = Number(s.effective_price || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 });
    const nextDate   = s.current_period_end
      ? fmtDate(s.current_period_end) : '—';
    const statusStyle = STATUS_STYLES[s.status] || STATUS_STYLES.cancelled;

    return `
      <tr>
        <td>
          <div style="font-weight:600">${billingEsc(s.company_name)}</div>
          <div style="font-size:11px;color:var(--muted)">${s.property_count ?? 0} propert${s.property_count === 1 ? 'y' : 'ies'} · ${s.user_count ?? 0} users</div>
        </td>
        <td>${billingEsc(s.plan_name)}</td>
        <td style="text-transform:capitalize">${s.billing_cycle}</td>
        <td style="font-weight:600">R ${price}</td>
        <td><span class="badge" style="${statusStyle};padding:2px 10px;border-radius:99px;font-size:11px">${billingCap(s.status)}</span></td>
        <td style="font-size:12px">${nextDate}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="openEditSubscription('${s.id}')">Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="openNewInvoice('${s.company_id}','${s.id}')">Invoice</button>
            ${s.status !== 'cancelled' ? `<button class="btn btn-ghost btn-sm" onclick="cancelSubscription('${s.id}')" style="color:#ef4444">Cancel</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// Filter called by search/select onchange
function filterBilling() { loadSubscriptions(); }

// ══════════════════════════════════════════════════════════════
// PLANS — load into select dropdowns
// ══════════════════════════════════════════════════════════════
async function loadPlans() {
  try {
    const json  = await GET('/api/billing/plans');
    billingPlans = json.data || [];
    // Populate any plan selects
    ['sub-plan-select', 'edit-sub-plan'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = billingPlans.map(p =>
        `<option value="${p.id}">${billingEsc(p.name)} — R ${Number(p.price_monthly).toLocaleString('en-ZA')}/mo</option>`
      ).join('');
    });
  } catch (e) {
    console.error('Plans load error:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// NEW SUBSCRIPTION MODAL
// ══════════════════════════════════════════════════════════════
async function openNewSubscription() {
  // Populate company select with companies that don't have a subscription yet
  const sel = document.getElementById('sub-company-select');
  if (sel) {
    try {
      const json      = await GET('/api/companies');
      const companies = json.data || [];
      // Filter out companies that already have a sub
      const existingIds = new Set(billingSubscriptions.map(s => s.company_id));
      const available   = companies.filter(c => !existingIds.has(c.id));
      sel.innerHTML = available.length
        ? available.map(c => `<option value="${c.id}">${billingEsc(c.name)}</option>`).join('')
        : '<option value="">No companies available</option>';
    } catch { sel.innerHTML = '<option value="">Failed to load</option>'; }
  }
  openModal('new-subscription-modal');
}

async function saveNewSubscription() {
  const company_id    = document.getElementById('sub-company-select')?.value;
  const plan_id       = document.getElementById('sub-plan-select')?.value;
  const billing_cycle = document.getElementById('sub-cycle')?.value || 'monthly';
  const trial_days    = parseInt(document.getElementById('sub-trial-days')?.value || '0', 10);
  const price_override = document.getElementById('sub-price-override')?.value?.trim();
  const notes         = document.getElementById('sub-notes')?.value?.trim();

  if (!company_id) { toast('Select a company', 'error'); return; }
  if (!plan_id)    { toast('Select a plan',    'error'); return; }

  const btn = document.getElementById('save-sub-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = 'Saving…'; btn.disabled = true;

  try {
    const payload = {
      company_id, plan_id, billing_cycle,
      trial_days: trial_days || 0,
      price_override: price_override ? Number(price_override) : null,
      notes: notes || null,
    };
    await POST('/api/billing/subscriptions', payload);
    closeModal('new-subscription-modal');
    toast('Subscription created', 'success');
    await Promise.all([loadBillingSummary(), loadSubscriptions()]);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.innerHTML = orig; btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════
// EDIT SUBSCRIPTION MODAL
// ══════════════════════════════════════════════════════════════
async function openEditSubscription(id) {
  currentSubId = id;
  try {
    const json = await GET(`/api/billing/subscriptions/${id}`);
    const s    = json.data;

    const planSel = document.getElementById('edit-sub-plan');
    if (planSel) {
      if (!billingPlans.length) await loadPlans();
      planSel.value = s.plan_id;
    }
    const cycleSel = document.getElementById('edit-sub-cycle');
    if (cycleSel) cycleSel.value = s.billing_cycle;

    const statusSel = document.getElementById('edit-sub-status');
    if (statusSel) statusSel.value = s.status;

    const priceEl = document.getElementById('edit-sub-price');
    if (priceEl) priceEl.value = s.price_override ?? '';

    const notesEl = document.getElementById('edit-sub-notes');
    if (notesEl) notesEl.value = s.notes ?? '';

    openModal('edit-subscription-modal');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function saveEditSubscription() {
  const plan_id       = document.getElementById('edit-sub-plan')?.value;
  const billing_cycle = document.getElementById('edit-sub-cycle')?.value;
  const status        = document.getElementById('edit-sub-status')?.value;
  const price_override = document.getElementById('edit-sub-price')?.value?.trim();
  const notes         = document.getElementById('edit-sub-notes')?.value?.trim();

  const btn = document.getElementById('save-edit-sub-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = 'Saving…'; btn.disabled = true;

  try {
    await PUT(`/api/billing/subscriptions/${currentSubId}`, {
      plan_id, billing_cycle, status,
      price_override: price_override ? Number(price_override) : null,
      notes: notes || null,
    });
    closeModal('edit-subscription-modal');
    toast('Subscription updated', 'success');
    await Promise.all([loadBillingSummary(), loadSubscriptions()]);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.innerHTML = orig; btn.disabled = false;
  }
}

async function cancelSubscription(id) {
  const sub = billingSubscriptions.find(s => s.id === id);
  if (!confirm(`Cancel subscription for ${sub?.company_name ?? 'this company'}? This cannot be undone.`)) return;
  try {
    await PUT(`/api/billing/subscriptions/${id}`, { status: 'cancelled' });
    toast('Subscription cancelled', 'success');
    await Promise.all([loadBillingSummary(), loadSubscriptions()]);
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════
async function loadInvoices(companyId = null) {
  const params = new URLSearchParams();
  if (companyId) params.set('company_id', companyId);

  const tbody = document.getElementById('invoices-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="empty">Loading…</td></tr>`;

  try {
    const qs   = params.toString() ? `?${params}` : '';
    const json = await GET(`/api/billing/invoices${qs}`);
    billingInvoices = json.data || [];
    renderInvoices();
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="empty">${e.message}</td></tr>`;
  }
}

function renderInvoices() {
  const tbody = document.getElementById('invoices-body');
  if (!tbody) return;

  if (!billingInvoices.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">No invoices found.</td></tr>`;
    return;
  }

  const STATUS_STYLES = {
    open:          'background:#fef3c7;color:#b45309',
    paid:          'background:#dcfce7;color:#166534',
    void:          'background:#f1f5f9;color:#64748b',
    draft:         'background:#e0e7ff;color:#4338ca',
    uncollectible: 'background:#fee2e2;color:#b91c1c',
  };

  tbody.innerHTML = billingInvoices.map(inv => {
    const amount = `R ${Number(inv.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
    const style  = STATUS_STYLES[inv.status] || STATUS_STYLES.open;
    return `
      <tr>
        <td style="font-weight:600;font-size:12px">${inv.invoice_number}</td>
        <td>${billingEsc(inv.company_name)}</td>
        <td style="font-weight:600">${amount}</td>
        <td>${inv.due_date ? fmtDate(inv.due_date) : '—'}</td>
        <td><span class="badge" style="${style};padding:2px 10px;border-radius:99px;font-size:11px">${billingCap(inv.status)}</span></td>
        <td>
          <div style="display:flex;gap:6px">
            ${inv.status === 'open' ? `<button class="btn btn-ghost btn-sm" onclick="payInvoice('${inv.id}')" style="color:#059669;font-weight:600">Mark Paid</button>` : ''}
            ${inv.status === 'open' ? `<button class="btn btn-ghost btn-sm" onclick="voidInvoice('${inv.id}')" style="color:#ef4444">Void</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// Open "new invoice" modal — pre-fill company & subscription
function openNewInvoice(companyId, subscriptionId) {
  const compSel = document.getElementById('inv-company-id');
  if (compSel) compSel.value = companyId;
  const subInput = document.getElementById('inv-subscription-id');
  if (subInput) subInput.value = subscriptionId || '';

  // Pre-fill amount from subscription effective_price
  const sub = billingSubscriptions.find(s => s.id === subscriptionId);
  const amtEl = document.getElementById('inv-amount');
  if (amtEl && sub) amtEl.value = Number(sub.effective_price).toFixed(2);

  // Set due date to 30 days from now
  const dueEl = document.getElementById('inv-due-date');
  if (dueEl) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    dueEl.value = d.toISOString().split('T')[0];
  }

  openModal('new-invoice-modal');
}

async function saveNewInvoice() {
  const company_id      = document.getElementById('inv-company-id')?.value;
  const subscription_id = document.getElementById('inv-subscription-id')?.value;
  const amount          = document.getElementById('inv-amount')?.value;
  const due_date        = document.getElementById('inv-due-date')?.value;
  const notes           = document.getElementById('inv-notes')?.value?.trim();

  if (!company_id) { toast('Company is required',      'error'); return; }
  if (!amount)     { toast('Amount is required',       'error'); return; }
  if (isNaN(Number(amount)) || Number(amount) <= 0) {
    toast('Enter a valid amount', 'error'); return;
  }

  const btn = document.getElementById('save-invoice-btn');
  const orig = btn.innerHTML;
  btn.innerHTML = 'Saving…'; btn.disabled = true;

  try {
    await POST('/api/billing/invoices', {
      company_id,
      subscription_id: subscription_id || null,
      amount: Number(amount),
      due_date:  due_date || null,
      notes:     notes   || null,
    });
    closeModal('new-invoice-modal');
    toast('Invoice created', 'success');
    await Promise.all([loadBillingSummary(), loadInvoices()]);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.innerHTML = orig; btn.disabled = false;
  }
}

async function payInvoice(id) {
  if (!confirm('Mark this invoice as paid?')) return;
  try {
    await POST(`/api/billing/invoices/${id}/pay`);
    toast('Invoice marked as paid', 'success');
    await Promise.all([loadBillingSummary(), loadInvoices()]);
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function voidInvoice(id) {
  if (!confirm('Void this invoice? This cannot be undone.')) return;
  try {
    await POST(`/api/billing/invoices/${id}/void`);
    toast('Invoice voided', 'success');
    await Promise.all([loadBillingSummary(), loadInvoices()]);
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════
async function exportBillingReport() {
  const btn = event.target.closest('button');
  const orig = btn.innerHTML;
  btn.innerHTML = 'Exporting…'; btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/billing/export`, {
      headers: { 'Authorization': `Bearer ${Auth.token}`, 'X-Company-Slug': SLUG },
    });
    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `billing-report-${new Date().toISOString().split('T')[0]}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.innerHTML = orig; btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
function billingSetText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function billingCap(str) { return str ? str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : ''; }
function billingEsc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ══════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
  // Wire search input
  const searchEl = document.getElementById('billing-search');
  if (searchEl) searchEl.addEventListener('input', () => loadSubscriptions());
  loadBilling();
});