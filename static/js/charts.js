function C() {
  const s = getComputedStyle(document.documentElement);
  const g = n => s.getPropertyValue(n).trim();
  return {
    text:   g('--text'),
    muted:  g('--text-muted'),
    border: g('--border'),
    teal:   g('--teal'),
    amber:  g('--amber'),
    coral:  g('--coral'),
    blue:   g('--blue'),
    gray:   g('--gray'),
  };
}

// ── Safe width: works even when parent tab is display:none ─────────────────
function safeWidth(el) {
  if (!el) return 600;
  
  // Try the element itself first
  let w = el.getBoundingClientRect().width;
  if (w > 50) return Math.floor(w) - 8;

  // Walk up — tab pane might be hidden, but .container is always visible
  let node = el.parentElement;
  while (node && node !== document.body) {
    w = node.getBoundingClientRect().width;
    if (w > 50) {
      const style = getComputedStyle(node);
      const pad = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);
      return Math.max(Math.floor(w - pad) - 16, 400);
    }
    node = node.parentElement;
  }
  // Fallback: 90% of viewport
  return Math.max(Math.floor(window.innerWidth * 0.85), 500);
}

// ── ISO date string array → Unix seconds array ─────────────────────────────
function parseDates(arr) {
  return arr.map(d => Date.parse(d) / 1000);
}

// ── Chart instance registry ────────────────────────────────────────────────
window._chartRegistry = window._chartRegistry || {};

function destroyChart(id) {
  if (window._chartRegistry[id]) {
    try { window._chartRegistry[id].destroy(); } catch (_) {}
    delete window._chartRegistry[id];
  }
  const el = document.getElementById(id);
  if (el) el.innerHTML = '';
}

// ── Axis factories ─────────────────────────────────────────────────────────
function dateAxis(label) {
  const col = C();
  return {
    label, labelSize: 20,
    labelFont: '600 12px "Sora",sans-serif',
    font:      '11px "IBM Plex Mono",monospace',
    stroke:    col.muted,
    grid:  { show: true, stroke: col.border, width: 1 },
    ticks: { show: true, stroke: col.border },
    space: 70,
    rotate: -30,
    values: (u, ts) => ts.map(t =>
      t == null ? '' :
      new Date(t * 1000).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    ),
  };
}

function numAxis(label, sizePx, fmt) {
  const col = C();
  return {
    label, labelSize: 20,
    labelFont: '600 12px "Sora",sans-serif',
    font:      '11px "IBM Plex Mono",monospace',
    stroke:    col.muted,
    grid:  { show: true, stroke: col.border, width: 1 },
    ticks: { show: true, stroke: col.border },
    size:  sizePx || 70,
    values: fmt ? (u, vs) => vs.map(v => v == null ? '' : fmt(v)) : undefined,
  };
}

// ── Binary search: count of sorted[] values ≤ x ───────────────────────────
function countLE(sorted, x) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    sorted[m] <= x ? (lo = m + 1) : (hi = m);
  }
  return lo;
}

// ══════════════════════════════════════════════════════════════════════════
// CHART 1 — Adj Close (Xₜ) vs Hanning filtered (Yₜ) + breakpoint
// ══════════════════════════════════════════════════════════════════════════
function buildPriceChart(id, R) {
  destroyChart(id);
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.style.overflow = 'hidden';
  wrap.style.display = 'block';

  const D   = R.chart_data;
  const col = C();
  const xs  = parseDates(D.dates);
  const bpTs = Date.parse(R.bp_date) / 1000;

  const smXs  = parseDates(D.sm_dates);
  const smMap = new Map(smXs.map((t, i) => [t, D.smoothed[i]]));
  const smAligned = xs.map(t => smMap.has(t) ? smMap.get(t) : null);

  const width = safeWidth(wrap);
  
  const inst = new uPlot({
    width:  width,
    height: 340,
    cursor: { show: true },
    legend: { show: true, live: true, font: '12px "IBM Plex Mono",monospace' },
    padding: [12, 16, 8, 4],
    axes: [ dateAxis('Date'), numAxis('Adj Close', 78, v => v.toFixed(1)) ],
    series: [
      { value: (u, v) => v == null ? '--' : new Date(v * 1000).toISOString().slice(0, 10) },
      { label: 'Adj Close Xₜ', stroke: col.gray, width: 1, alpha: 0.5,
        value: (u, v) => v == null ? '--' : v.toFixed(2) },
      { label: 'Hanning Yₜ',   stroke: col.blue, width: 2.2,
        value: (u, v) => v == null ? '--' : v.toFixed(2) },
    ],
    hooks: {
      draw: [(u) => {
        const ctx = u.ctx;
        const xPx = Math.round(u.valToPos(bpTs, 'x'));
        const { top: yT, height: yH, left: x0, width: xW } = u.bbox;
        ctx.save();
        ctx.fillStyle = 'rgba(14,158,116,0.05)';
        ctx.fillRect(x0, yT, xPx - x0, yH);
        ctx.fillStyle = 'rgba(217,119,6,0.06)';
        ctx.fillRect(xPx, yT, x0 + xW - xPx, yH);
        ctx.strokeStyle = col.coral;
        ctx.lineWidth   = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(xPx, yT); ctx.lineTo(xPx, yT + yH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col.coral;
        ctx.font = '600 11px "IBM Plex Mono",monospace';
        ctx.fillText('k̂ ' + R.bp_date, xPx + 6, yT + 16);
        ctx.restore();
      }],
    },
  }, [xs, D.prices, smAligned], wrap);

  window._chartRegistry[id] = inst;
}

// ══════════════════════════════════════════════════════════════════════════
// CHART 2 — Yₜ coloured by regime
// ══════════════════════════════════════════════════════════════════════════
function buildReturnsChart(id, R) {
  destroyChart(id);
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.style.overflow = 'hidden';
  wrap.style.display = 'block';

  const D   = R.chart_data;
  const col = C();
  const xs  = parseDates(D.Y_dates);
  const k   = R.k_hat;
  const bpTs = Date.parse(R.bp_date) / 1000;

  const y1 = D.Y.map((v, i) => i <  k ? v : null);
  const y2 = D.Y.map((v, i) => i >= k ? v : null);

  const width = safeWidth(wrap);
  
  const inst = new uPlot({
    width:  width,
    height: 300,
    cursor: { show: true },
    legend: { show: true, live: true, font: '12px "IBM Plex Mono",monospace' },
    padding: [12, 16, 8, 4],
    axes: [ dateAxis('Date'), numAxis('Yₜ', 78, v => v.toFixed(1)) ],
    series: [
      { value: (u, v) => v == null ? '--' : new Date(v * 1000).toISOString().slice(0, 10) },
      { label: `Régime 1  n=${k}`,            stroke: col.teal,  width: 1.6,
        value: (u, v) => v == null ? '--' : v.toFixed(3) },
      { label: `Régime 2  n=${D.Y.length-k}`, stroke: col.amber, width: 1.6,
        value: (u, v) => v == null ? '--' : v.toFixed(3) },
    ],
    hooks: {
      draw: [(u) => {
        const ctx = u.ctx;
        const xPx = Math.round(u.valToPos(bpTs, 'x'));
        const { top: yT, height: yH } = u.bbox;
        ctx.save();
        ctx.strokeStyle = col.coral; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(xPx, yT); ctx.lineTo(xPx, yT + yH); ctx.stroke();
        ctx.restore();
      }],
    },
  }, [xs, y1, y2], wrap);

  window._chartRegistry[id] = inst;
}

// ══════════════════════════════════════════════════════════════════════════
// CHART 3 — KS scan D(k)
// ══════════════════════════════════════════════════════════════════════════
function buildKSScanChart(id, R) {
  destroyChart(id);
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.style.overflow = 'hidden';
  wrap.style.display = 'block';

  const D    = R.chart_data;
  const col  = C();
  const ks   = D.scan_k.map(Number);
  const crit = ks.map(() => 0.108);
  const kHat = R.k_hat;
  const ki   = D.scan_k.indexOf(kHat);
  const dKhat = ki >= 0 ? D.scan_D[ki] : R.D;

  const width = safeWidth(wrap);
  
  const inst = new uPlot({
    width:  width,
    height: 300,
    cursor: { show: true },
    legend: { show: true, live: true, font: '12px "IBM Plex Mono",monospace' },
    padding: [12, 16, 8, 4],
    axes: [
      numAxis('Candidat k', 60, v => Math.round(v).toString()),
      numAxis('D(k)',        65, v => v.toFixed(3)),
    ],
    series: [
      { value: (u, v) => v == null ? '--' : 'k = ' + Math.round(v) },
      { label: 'D(k)',             stroke: col.blue, width: 1.8,
        value: (u, v) => v == null ? '--' : v.toFixed(4) },
      { label: 'D critique 0.108', stroke: col.gray, width: 1.4,
        value: (u, v) => v == null ? '--' : v.toFixed(3) },
    ],
    hooks: {
      draw: [(u) => {
        const ctx  = u.ctx;
        const xPx  = Math.round(u.valToPos(kHat,  'x'));
        const yPx  = Math.round(u.valToPos(dKhat, 'y'));
        ctx.save();
        ctx.strokeStyle = col.coral; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(xPx, u.bbox.top); ctx.lineTo(xPx, u.bbox.top + u.bbox.height);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col.coral; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xPx,     yPx - 7);
        ctx.lineTo(xPx + 5, yPx);
        ctx.lineTo(xPx,     yPx + 7);
        ctx.lineTo(xPx - 5, yPx);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = col.coral; ctx.font = '600 11px "IBM Plex Mono",monospace';
        ctx.fillText(`k̂=${kHat}  D=${dKhat.toFixed(4)}`, xPx + 10, yPx - 4);
        ctx.restore();
      }],
    },
  }, [ks, D.scan_D, crit], wrap);

  window._chartRegistry[id] = inst;
}

// ══════════════════════════════════════════════════════════════════════════
// CHART 4a / 4b — Skew-Normal density (FIXED)
// ══════════════════════════════════════════════════════════════════════════
function buildSNChart(id, xg, pdf, mu, sigma, theta, strokeColor) {
  destroyChart(id);
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.style.overflow = 'hidden';
  wrap.style.display = 'block';
  
  // Force a minimum height for the container
  wrap.style.minHeight = '280px';
  
  const col    = C();
  const stroke = strokeColor || col.teal;
  const fill   = stroke === col.amber
    ? 'rgba(245,158,11,0.12)'
    : 'rgba(16,185,129,0.12)';

  // Get width - wait a tiny bit for the container to be visible
  let width = safeWidth(wrap);
  if (width < 300) width = 500;
  
  const inst = new uPlot({
    width:  width,
    height: 260,
    cursor: { show: true },
    legend: { show: true, live: true, font: '12px "IBM Plex Mono",monospace' },
    padding: [12, 16, 8, 4],
    axes: [
      numAxis('Yₜ',      60, v => v.toFixed(2)),
      numAxis('Densité', 65, v => v.toFixed(4)),
    ],
    series: [
      { value: (u, v) => v == null ? '--' : 'Yₜ = ' + v.toFixed(3) },
      {
        label:  `SN  μ=${mu.toFixed(4)}  σ=${sigma.toFixed(4)}  θ=${theta.toFixed(3)}`,
        stroke: stroke, width: 2.5, fill: fill,
        value: (u, v) => v == null ? '--' : v.toFixed(5),
      },
    ],
  }, [xg, pdf], wrap);

  window._chartRegistry[id] = inst;
  return inst;
}

// ══════════════════════════════════════════════════════════════════════════
// CHART 5 — ECDF comparison with KS gap marker
// ══════════════════════════════════════════════════════════════════════════
function buildECDFChart(id, R) {
  destroyChart(id);
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.style.overflow = 'hidden';
  wrap.style.display = 'block';

  const D   = R.chart_data;
  const col = C();
  const k   = R.k_hat;

  const seg1 = [...D.Y.slice(0, k)].sort((a, b) => a - b);
  const seg2 = [...D.Y.slice(k)].sort((a, b) => a - b);
  const n1   = seg1.length;
  const n2   = seg2.length;

  const allX = [...new Set([...seg1, ...seg2])].sort((a, b) => a - b);
  const F1   = allX.map(x => countLE(seg1, x) / n1);
  const F2   = allX.map(x => countLE(seg2, x) / n2);

  const gaps = allX.map((_, i) => Math.abs(F1[i] - F2[i]));
  const gi   = gaps.indexOf(Math.max(...gaps));
  const gx   = allX[gi];
  const glo  = Math.min(F1[gi], F2[gi]);
  const ghi  = Math.max(F1[gi], F2[gi]);

  const width = safeWidth(wrap);
  
  const inst = new uPlot({
    width:  width,
    height: 300,
    cursor: { show: true },
    legend: { show: true, live: true, font: '12px "IBM Plex Mono",monospace' },
    padding: [12, 16, 8, 4],
    axes: [
      numAxis('Yₜ',     65, v => v.toFixed(1)),
      numAxis('Fₙ(x)', 55, v => v.toFixed(2)),
    ],
    series: [
      { value: (u, v) => v == null ? '--' : 'Yₜ = ' + v.toFixed(3) },
      { label: `F₁(x)  n=${n1}`, stroke: col.teal,  width: 2.2,
        value: (u, v) => v == null ? '--' : v.toFixed(4) },
      { label: `F₂(x)  n=${n2}`, stroke: col.amber, width: 2.2,
        value: (u, v) => v == null ? '--' : v.toFixed(4) },
    ],
    hooks: {
      draw: [(u) => {
        const ctx  = u.ctx;
        const xPx  = u.valToPos(gx,  'x');
        const yLo  = u.valToPos(glo, 'y');
        const yHi  = u.valToPos(ghi, 'y');
        ctx.save();
        ctx.strokeStyle = col.coral; ctx.lineWidth = 3; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(xPx, yLo); ctx.lineTo(xPx, yHi); ctx.stroke();
        ctx.fillStyle = col.coral; ctx.font = '700 11px "IBM Plex Mono",monospace';
        ctx.fillText(`D=${R.D.toFixed(4)}`, xPx + 6, (yLo + yHi) / 2);
        ctx.restore();
      }],
    },
  }, [allX, F1, F2], wrap);

  window._chartRegistry[id] = inst;
}

// ══════════════════════════════════════════════════════════════════════════
// CHART 6 — p-value scan  (log₁₀)
// ══════════════════════════════════════════════════════════════════════════
function buildPValueChart(id, R) {
  destroyChart(id);
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.style.overflow = 'hidden';
  wrap.style.display = 'block';

  const D   = R.chart_data;
  const col = C();
  const ks  = D.scan_k.map(Number);
  const logP  = D.scan_p.map(p => (p > 0 ? Math.max(Math.log10(p), -300) : -300));
  const alpha = ks.map(() => Math.log10(0.05));

  const width = safeWidth(wrap);
  
  const inst = new uPlot({
    width:  width,
    height: 260,
    cursor: { show: true },
    legend: { show: true, live: true, font: '12px "IBM Plex Mono",monospace' },
    padding: [12, 16, 8, 4],
    axes: [
      numAxis('Candidat k', 60, v => Math.round(v).toString()),
      numAxis('log₁₀(p)',   75, v => v.toFixed(0)),
    ],
    series: [
      { value: (u, v) => v == null ? '--' : 'k = ' + Math.round(v) },
      { label: 'log₁₀(p-valeur)',   stroke: col.blue,  width: 1.6,
        value: (u, v) => v == null ? '--' : v.toFixed(1) },
      { label: 'α = 0.05  (−1.30)', stroke: col.coral, width: 1.4,
        value: (u, v) => v == null ? '--' : v.toFixed(2) },
    ],
    hooks: {
      draw: [(u) => {
        const ctx = u.ctx;
        const xPx = Math.round(u.valToPos(R.k_hat, 'x'));
        ctx.save();
        ctx.strokeStyle = col.amber; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(xPx, u.bbox.top); ctx.lineTo(xPx, u.bbox.top + u.bbox.height);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col.amber; ctx.font = '600 11px "IBM Plex Mono",monospace';
        ctx.fillText(`k̂=${R.k_hat}`, xPx + 6, u.bbox.top + 16);
        ctx.restore();
      }],
    },
  }, [ks, logP, alpha], wrap);

  window._chartRegistry[id] = inst;
}

// ══════════════════════════════════════════════════════════════════════════
// CHART 7 — Moving average  Mₕ(t)  h = 15
// ══════════════════════════════════════════════════════════════════════════
function buildMovingAverageChart(id, R) {
  destroyChart(id);
  const wrap = document.getElementById(id);
  if (!wrap) return;
  wrap.style.overflow = 'hidden';
  wrap.style.display = 'block';

  const D   = R.chart_data;
  const col = C();
  const xs  = parseDates(D.dates);
  const h   = 15;
  const n   = D.prices.length;

  const ma = D.prices.map((_, t) => {
    if (t < h || t >= n - h) return null;
    let s = 0;
    for (let j = -h; j <= h; j++) s += D.prices[t + j];
    return s / (2 * h + 1);
  });

  const width = safeWidth(wrap);
  
  const inst = new uPlot({
    width:  width,
    height: 300,
    cursor: { show: true },
    legend: { show: true, live: true, font: '12px "IBM Plex Mono",monospace' },
    padding: [12, 16, 8, 4],
    axes: [ dateAxis('Date'), numAxis('Adj Close', 78, v => v.toFixed(1)) ],
    series: [
      { value: (u, v) => v == null ? '--' : new Date(v * 1000).toISOString().slice(0, 10) },
      { label: 'Adj Close Xₜ',     stroke: col.gray,  width: 1,   alpha: 0.5,
        value: (u, v) => v == null ? '--' : v.toFixed(2) },
      { label: 'Moy. Mobile h=15', stroke: col.coral, width: 2.2,
        value: (u, v) => v == null ? '--' : v.toFixed(2) },
    ],
  }, [xs, D.prices, ma], wrap);

  window._chartRegistry[id] = inst;
}

// ══════════════════════════════════════════════════════════════════════════
// BUILD SINGLE CHART - Based on tab ID
// ══════════════════════════════════════════════════════════════════════════
function buildSingleChart(tabId, R) {
  if (!R || !R.chart_data) return;
  const D = R.chart_data;
  const col = C();
  
  console.log('Building chart for tab:', tabId); // Debug log
  
  switch(tabId) {
    case 't-hanning':
      buildPriceChart('ch-price', R);
      break;
    case 't-returns':
      buildReturnsChart('ch-returns', R);
      break;
    case 't-sn':
      buildSNChart('ch-sn1', D.xg1, D.pdf1, R.mu1, R.sigma1, R.theta, col.teal);
      buildSNChart('ch-sn2', D.xg2, D.pdf2, R.mu2, R.sigma2, R.theta, col.amber);
      break;
    case 't-ks':
      buildKSScanChart('ch-ks', R);
      break;
    case 't-pval':
      buildPValueChart('ch-pval', R);
      break;
    case 't-ecdf':
      buildECDFChart('ch-ecdf', R);
      break;
    case 't-mm':
      buildMovingAverageChart('ch-mm', R);
      break;
    default:
      // Build all for initial load
      buildAllCharts(R);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// RESIZE CHARTS IN SPECIFIC TAB
// ══════════════════════════════════════════════════════════════════════════
function resizeChartsInTab(tabId) {
  const chartIds = {
    't-hanning': ['ch-price'],
    't-returns': ['ch-returns'],
    't-sn': ['ch-sn1', 'ch-sn2'],
    't-ks': ['ch-ks'],
    't-pval': ['ch-pval'],
    't-ecdf': ['ch-ecdf'],
    't-mm': ['ch-mm']
  };
  
  const ids = chartIds[tabId] || [];
  ids.forEach(id => {
    const u = window._chartRegistry[id];
    if (u && u.root) {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) {
        const w = safeWidth(el);
        if (Math.abs(w - u.width) > 10 && w > 200) {
          u.setSize({ width: w, height: u.height });
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// RESIZE ALL CHARTS
// ══════════════════════════════════════════════════════════════════════════
function resizeAllCharts() {
  Object.entries(window._chartRegistry).forEach(([id, u]) => {
    if (u && u.root) {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) {
        const w = safeWidth(el);
        if (Math.abs(w - u.width) > 10 && w > 200) {
          u.setSize({ width: w, height: u.height });
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════
// BUILD ALL CHARTS
// ══════════════════════════════════════════════════════════════════════════
function buildAllCharts(R) {
  if (!R || !R.chart_data) return;
  const D   = R.chart_data;
  const col = C();

  buildPriceChart('ch-price',       R);
  buildReturnsChart('ch-returns',   R);
  buildKSScanChart('ch-ks',         R);
  buildSNChart('ch-sn1', D.xg1, D.pdf1, R.mu1, R.sigma1, R.theta, col.teal);
  buildSNChart('ch-sn2', D.xg2, D.pdf2, R.mu2, R.sigma2, R.theta, col.amber);
  buildPValueChart('ch-pval',       R);
  buildECDFChart('ch-ecdf',         R);
  buildMovingAverageChart('ch-mm',  R);
  
  setTimeout(resizeAllCharts, 150);
}

// ── Theme toggle callback ──────────────────────────────────────────────────
function rebuildChartsForTheme(R) {
  if (R) buildAllCharts(R);
}

// ── Debounced window resize ────────────────────────────────────────────────
let _rt = null;
window.addEventListener('resize', () => {
  clearTimeout(_rt);
  _rt = setTimeout(() => {
    if (!window._lastApiResponse) return;
    resizeAllCharts();
  }, 160);
});

// Make functions globally available
window.buildAllCharts = buildAllCharts;
window.buildSingleChart = buildSingleChart;
window.resizeAllCharts = resizeAllCharts;
window.resizeChartsInTab = resizeChartsInTab;
window.rebuildChartsForTheme = rebuildChartsForTheme;