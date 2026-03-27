// ── System Metrics ────────────────────────────────────────────
// Uses the shared GET() helper from app.js — same pattern as every
// other page. Export uses a direct fetch() because it returns a CSV
// blob, not JSON, so the shared api() wrapper can't handle it.

let growthChart       = null;
let distributionChart = null;
let currentMetric     = 'companies';
let metricsData       = null;

document.addEventListener('DOMContentLoaded', function () {
  fixPlaceholderOverlay('growth-chart-placeholder');
  fixPlaceholderOverlay('distribution-placeholder');
  loadMetrics();
});

function fixPlaceholderOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.position = 'absolute';
  el.style.inset    = '0';
  if (el.parentElement) el.parentElement.style.position = 'relative';
}

// ── Load & render all sections ────────────────────────────────
async function loadMetrics() {
  const timeframe = document.getElementById('metrics-timeframe')?.value || 'month';
  showLoadingStates();

  try {
    // Uses shared GET() — goes to API base URL with correct auth headers
    const json = await GET(`/api/metrics?timeframe=${timeframe}`);
    // Response: { success: true, data: { summary, distribution, growth, dailyMetrics } }
    metricsData = json.data;

    updateMetricCards(metricsData.summary);
    updateGrowthChart(metricsData.growth);
    updateDistributionChart(metricsData.distribution);
    updateMetricsTable(metricsData.dailyMetrics);

  } catch (error) {
    console.error('Metrics load error:', error);
    showErrorStates(error.message);
  }
}

// ── Loading / error states ────────────────────────────────────
function showLoadingStates() {
  ['metric-active-companies', 'metric-trial-companies',
   'metric-suspended-companies', 'metric-avg-users'].forEach(id => setText(id, '…'));

  const placeholder = document.getElementById('growth-chart-placeholder');
  if (placeholder) placeholder.style.display = 'flex';

  if (growthChart)       { growthChart.destroy();       growthChart       = null; }
  if (distributionChart) { distributionChart.destroy(); distributionChart = null; }
}

function showErrorStates(msg = 'Error') {
  ['metric-active-companies', 'metric-trial-companies',
   'metric-suspended-companies', 'metric-avg-users'].forEach(id => setText(id, '—'));

  const tbody = document.getElementById('metrics-table-body');
  if (tbody) tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align:center;padding:40px;color:var(--muted)">
        Failed to load metrics: ${msg}
      </td>
    </tr>`;

  if (typeof toast === 'function') toast(msg, 'error');
}

// ── Metric cards ──────────────────────────────────────────────
function updateMetricCards(summary) {
  setText('metric-active-companies',    summary.activeCompanies    ?? 0);
  setText('metric-trial-companies',     summary.trialCompanies     ?? 0);
  setText('metric-suspended-companies', summary.suspendedCompanies ?? 0);
  setText('metric-avg-users',           summary.avgUsersPerCompany ?? 0);
  updateMetricSubtitles(summary);
}

function updateMetricSubtitles(summary) {
  const total = summary.totalCompanies || 1;

  setSubtitle('metric-active-companies',
    `${Math.round(((summary.activeCompanies ?? 0) / total) * 100)}% of total`);

  setSubtitle('metric-trial-companies',
    `${Math.round(((summary.trialCompanies ?? 0) / total) * 100)}% of total`);

  setSubtitle('metric-suspended-companies',
    (summary.suspendedCompanies ?? 0) > 0
      ? `${summary.suspendedCompanies} suspended`
      : 'All healthy');

  setSubtitle('metric-avg-users', 'avg per active company');
}

// ── Growth chart ──────────────────────────────────────────────
function changeChartMetric(metric) {
  currentMetric = metric;
  document.querySelectorAll('[onclick^="changeChartMetric"]').forEach(b => b.classList.remove('active'));
  if (event && event.currentTarget) event.currentTarget.classList.add('active');
  if (metricsData?.growth) updateGrowthChart(metricsData.growth);
}

function updateGrowthChart(growthData) {
  const canvas      = document.getElementById('growth-chart');
  const placeholder = document.getElementById('growth-chart-placeholder');
  if (!canvas) return;

  if (placeholder) placeholder.style.display = 'none';
  if (growthChart) { growthChart.destroy(); growthChart = null; }

  const cfgMap = {
    companies: { label: 'Companies',     color: '#7c3aed' },
    users:     { label: 'Users',         color: '#3b82f6' },
    tickets:   { label: 'Tickets',       color: '#f97316' },
  };
  const cfg = cfgMap[currentMetric] || cfgMap.companies;

  growthChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels:   growthData.labels || [],
      datasets: [{
        label:           cfg.label,
        data:            growthData[currentMetric] || [],
        borderColor:     cfg.color,
        backgroundColor: cfg.color + '20',
        borderWidth: 2, fill: true, tension: 0.4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend:  { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#e2e8f0' } },
        x: { grid: { display: false } },
      },
    },
  });
}

// ── Distribution doughnut ─────────────────────────────────────
function updateDistributionChart(distributionData) {
  const canvas      = document.getElementById('distribution-chart');
  const placeholder = document.getElementById('distribution-placeholder');
  if (!canvas) return;

  if (placeholder) {
    placeholder.innerHTML = `
      <div style="display:flex;gap:16px;margin-bottom:16px;">
        <div><span style="display:inline-block;width:12px;height:12px;background:#7c3aed;border-radius:3px;margin-right:4px;"></span>Active: ${distributionData.active ?? 0}</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#f97316;border-radius:3px;margin-right:4px;"></span>Trial: ${distributionData.trial ?? 0}</div>
      </div>
      <div style="display:flex;gap:16px;">
        <div><span style="display:inline-block;width:12px;height:12px;background:#ef4444;border-radius:3px;margin-right:4px;"></span>Suspended: ${distributionData.suspended ?? 0}</div>
        <div><span style="display:inline-block;width:12px;height:12px;background:#64748b;border-radius:3px;margin-right:4px;"></span>Inactive: ${distributionData.inactive ?? 0}</div>
      </div>`;
    placeholder.style.display = 'none';
  }

  if (distributionChart) { distributionChart.destroy(); distributionChart = null; }

  distributionChart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels:   ['Active', 'Trial', 'Suspended', 'Inactive'],
      datasets: [{
        data: [
          distributionData.active    ?? 0,
          distributionData.trial     ?? 0,
          distributionData.suspended ?? 0,
          distributionData.inactive  ?? 0,
        ],
        backgroundColor: ['#7c3aed', '#f97316', '#ef4444', '#64748b'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } } },
      cutout: '60%',
    },
  });
}

// ── Daily metrics table ───────────────────────────────────────
function updateMetricsTable(dailyMetrics) {
  const tbody = document.getElementById('metrics-table-body');
  if (!tbody) return;

  if (!dailyMetrics?.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:40px;color:var(--muted)">
          No data available for selected timeframe
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = dailyMetrics.map(day => {
    const change = day.change ?? 0;
    const [badgeStyle, changeLabel] = change > 0
      ? ['background:#dcfce7;color:#166534', `↑ +${change}`]
      : change < 0
        ? ['background:#fee2e2;color:#b91c1c', `↓ ${change}`]
        : ['background:#fef3c7;color:#b45309', '→ 0'];

    return `
      <tr>
        <td>${fmtDate(day.date)}</td>
        <td><strong>${day.companies ?? 0}</strong></td>
        <td>${day.activeCompanies ?? 0}</td>
        <td>${day.users ?? 0}</td>
        <td>${formatNumber(day.tickets ?? 0)}</td>
        <td>${day.properties ?? 0}</td>
        <td>
          <span class="badge" style="${badgeStyle};padding:2px 8px;border-radius:99px;font-size:11px">
            ${changeLabel}
          </span>
        </td>
      </tr>`;
  }).join('');
}

// ── Export CSV ────────────────────────────────────────────────
// Cannot use GET() because the response is a CSV blob, not JSON.
// Uses direct fetch() with the correct API base URL and auth token.
async function exportMetricsReport() {
  const btn = event.target.closest('button');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = 'Exporting…';
  btn.disabled  = true;

  try {
    const timeframe = document.getElementById('metrics-timeframe')?.value || 'month';
    const res = await fetch(`${API}/api/metrics/export?timeframe=${timeframe}`, {
      headers: {
        'Authorization':  `Bearer ${Auth.token}`,
        'X-Company-Slug': SLUG,
      },
    });
    if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `metrics-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Export error:', error);
    if (typeof toast === 'function') toast(error.message, 'error');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled  = false;
  }
}

// ── Refresh ───────────────────────────────────────────────────
async function refreshMetrics() {
  const btn = event.target.closest('button');
  const originalHtml = btn.innerHTML;
  btn.innerHTML = 'Refreshing…';
  btn.disabled  = true;
  await loadMetrics();
  btn.innerHTML = originalHtml;
  btn.disabled  = false;
}

// ── DOM helpers ───────────────────────────────────────────────
function setText(id, value) {
  const el = document.getElementById(id); if (el) el.textContent = value;
}
function setSubtitle(cardId, text) {
  const el = document.getElementById(cardId);
  if (el?.nextElementSibling) el.nextElementSibling.textContent = text;
}
function formatNumber(num) { return Number(num).toLocaleString('en-ZA'); }