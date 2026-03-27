// ============================================================
// manager-billing.js — Billing & Payments
// ============================================================

async function billingTab(tab, el) {
  document.querySelectorAll('#page-billing .tab-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  const container = document.getElementById('billing-content');
  container.innerHTML = '<div style="text-align:center;padding:48px;color:var(--muted)">Loading...</div>';
  try {
    if (tab === 'invoices') {
      const resp = await GET('/api/billing/invoices').catch(() => ({ data: [] }));
      const invoices = resp.data || [];
      container.innerHTML = `
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Invoice #</th><th>Tenant</th><th>Property / Unit</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead>
              <tbody>
                ${invoices.length
                  ? invoices.map(inv => `<tr>
                      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">${inv.invoice_number || inv.id?.slice(0,8)}</td>
                      <td style="font-weight:500">${inv.tenant_name || '—'}</td>
                      <td style="font-size:12px;color:var(--muted)">${inv.property_name || '—'}${inv.unit_number ? ` / Unit ${inv.unit_number}` : ''}</td>
                      <td style="font-weight:600">R${Number(inv.amount || 0).toFixed(2)}</td>
                      <td style="font-size:12px;color:var(--muted)">${fmtDate(inv.due_date)}</td>
                      <td>${badge(inv.status || 'pending', { paid: { bg: '#dcfce7', fg: '#166534' }, pending: { bg: '#fef3c7', fg: '#b45309' }, overdue: { bg: '#fee2e2', fg: '#b91c1c' }, cancelled: { bg: '#f1f5f9', fg: '#94a3b8' } })}</td>
                    </tr>`).join('')
                  : '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">No invoices found.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;
    } else if (tab === 'payments') {
      const resp = await GET('/api/billing/payments').catch(() => ({ data: [] }));
      const payments = resp.data || [];
      container.innerHTML = `
        <div class="card">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Tenant</th><th>Amount</th><th>Method</th><th>Reference</th><th>Status</th></tr></thead>
              <tbody>
                ${payments.length
                  ? payments.map(p => `<tr>
                      <td style="font-size:12px;color:var(--muted)">${fmtDate(p.payment_date || p.created_at)}</td>
                      <td style="font-weight:500">${p.tenant_name || '—'}</td>
                      <td style="font-weight:600;color:#15803d">R${Number(p.amount || 0).toFixed(2)}</td>
                      <td style="font-size:12px;color:var(--muted);text-transform:capitalize">${p.payment_method || '—'}</td>
                      <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--muted)">${p.reference || '—'}</td>
                      <td>${badge(p.status || 'completed', { completed: { bg: '#dcfce7', fg: '#166534' }, pending: { bg: '#fef3c7', fg: '#b45309' }, failed: { bg: '#fee2e2', fg: '#b91c1c' } })}</td>
                    </tr>`).join('')
                  : '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">No payment records found.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;
    } else if (tab === 'summary') {
      const resp = await GET('/api/reports/costs').catch(() => ({ data: {} }));
      const r = resp.data || {};
      const billingResp = await GET('/api/billing/summary').catch(() => ({ data: {} }));
      const b = billingResp.data || {};
      container.innerHTML = `
        <div class="kpi-grid" style="margin-bottom:20px">
          <div class="kpi"><div class="kpi-label">Total Invoiced</div><div class="kpi-value">R${Number(b.total_invoiced || 0).toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Total Collected</div><div class="kpi-value" style="color:#15803d">R${Number(b.total_collected || 0).toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Outstanding</div><div class="kpi-value" style="color:#b45309">R${Number(b.total_outstanding || 0).toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Overdue</div><div class="kpi-value" style="color:#b91c1c">R${Number(b.total_overdue || 0).toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Maintenance Costs</div><div class="kpi-value">R${Number(r.total || 0).toFixed(2)}</div></div>
          <div class="kpi"><div class="kpi-label">Active Tenants</div><div class="kpi-value">${b.active_tenants || '—'}</div></div>
        </div>`;
    }
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:48px;color:var(--muted)">Billing module data unavailable. Connect billing API to enable this section.</div>`;
  }
}