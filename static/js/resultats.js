function initTheme() {
  const html   = document.documentElement;
  const toggle = document.getElementById('themeToggle');

  function applyTheme(t) {
    html.setAttribute('data-theme', t);
    toggle.textContent = t === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', t);
    if (window._lastApiResponse && typeof rebuildChartsForTheme === 'function') {
      rebuildChartsForTheme(window._lastApiResponse);
    }
  }

  const saved = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);

  toggle.addEventListener('click', () =>
    applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
  );
}

// ── Tab switching — lazy chart build on first show ─────────────────────────
function initTabs() {
  const nav = document.getElementById('tabsNav');
  if (!nav) return;

  // Chart tabs that need rebuilding on show
  const chartTabs = new Set([
    't-hanning', 't-returns', 't-sn', 't-ks',
    't-pval', 't-ecdf', 't-mm',
  ]);

  // Track which tabs have been rendered at least once
  const rendered = new Set();

  nav.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const tabId = btn.dataset.tab;

    // Swap active button
    nav.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Swap active pane
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const pane = document.getElementById(tabId);
    if (pane) pane.classList.add('active');

    // Build or resize charts when tab becomes visible
    if (window._lastApiResponse && chartTabs.has(tabId)) {
      if (!rendered.has(tabId)) {
        rendered.add(tabId);
        // Small delay to ensure the tab is fully visible
        setTimeout(() => {
          if (typeof buildSingleChart === 'function') {
            buildSingleChart(tabId, window._lastApiResponse);
          }
        }, 50);
      } else {
        // Already rendered, just resize
        setTimeout(() => {
          if (typeof resizeChartsInTab === 'function') {
            resizeChartsInTab(tabId);
          }
        }, 30);
      }
    }
  });
}

// ── Compute stats from prices array ──────────────────────────────────────
function computeStats(prices) {
  const n    = prices.length;
  const mn   = Math.min(...prices);
  const mx   = Math.max(...prices);
  const mean = prices.reduce((a, b) => a + b, 0) / n;
  const variance = prices.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std  = Math.sqrt(variance);
  const skew = prices.reduce((a, b) => a + ((b - mean) / std) ** 3, 0) / n;
  const kurt = prices.reduce((a, b) => a + ((b - mean) / std) ** 4, 0) / n - 3;
  return { n, mn, mx, mean, variance, skew, kurt };
}

// ── Populate stats tab ─────────────────────────────────────────────────────
function populateStats(R) {
  const hasBE = R.NBobs != null;

  let n, mn, mx, mean, variance, skew, kurt;
  if (hasBE) {
    n        = R.NBobs;
    mn       = R.Min;
    mx       = R.Max;
    mean     = R.moyenne;
    variance = R.variance;
    skew     = R.skewness;
    kurt     = R.kurtosis;
  } else {
    const s = computeStats(R.chart_data.prices);
    n        = s.n;
    mn       = s.mn.toFixed(4);
    mx       = s.mx.toFixed(4);
    mean     = s.mean.toFixed(4);
    variance = s.variance.toFixed(4);
    skew     = s.skew.toFixed(4);
    kurt     = s.kurt.toFixed(4);
  }

  const cap = document.getElementById('stats-caption');
  if (cap) cap.textContent = `Table des statistiques descriptives pour : ${R.name}`;

  document.getElementById('st-n').textContent    = n;
  document.getElementById('st-min').textContent  = mn;
  document.getElementById('st-max').textContent  = mx;
  document.getElementById('st-mean').textContent = mean;
  document.getElementById('st-var').textContent  = variance;
  document.getElementById('st-skew').textContent = skew;
  document.getElementById('st-kurt').textContent = kurt;
}

// ── Populate metric cards ─────────────────────────────────────────────────
function populateMetrics(R) {
  document.getElementById('mc-khat').textContent   = R.k_hat;
  document.getElementById('mc-bpdate').textContent = R.bp_date;
  document.getElementById('mc-D').textContent      = R.D.toFixed(4);
  document.getElementById('mc-pval').textContent   = R.p_value.toExponential(3);
  document.getElementById('mc-theta').textContent  = R.theta.toFixed(4);
  document.getElementById('mc-mu1').textContent    = 'μ = ' + R.mu1.toFixed(4);
  document.getElementById('mc-sig1').textContent   = 'σ = ' + R.sigma1.toFixed(4) + '  n=' + R.n1;
  document.getElementById('mc-mu2').textContent    = 'μ = ' + R.mu2.toFixed(4);
  document.getElementById('mc-sig2').textContent   = 'σ = ' + R.sigma2.toFixed(4) + '  n=' + R.n2;

  const pCard = document.getElementById('mc-pcard');
  const pVal  = document.getElementById('mc-pval');
  pCard.classList.add(R.reject_H0 ? 'c-coral' : 'c-teal');
  pVal.classList.add(R.reject_H0  ? 'v-coral' : 'v-teal');
}

// ── Populate verdict ──────────────────────────────────────────────────────
function populateVerdict(R) {
  const banner = document.getElementById('verdictBanner');
  const icon   = document.getElementById('verdictIcon');
  const text   = document.getElementById('verdictText');

  banner.className = 'verdict-banner ' + (R.reject_H0 ? 'reject' : 'accept');
  icon.textContent = R.reject_H0 ? '✗' : '✓';

  if (R.reject_H0) {
    text.innerHTML =
      `<strong>H₀ REJETÉE</strong> — Rupture structurelle significative en
       <strong>k̂ = ${R.k_hat} (${R.bp_date})</strong>,
       D = ${R.D.toFixed(4)}, p = ${R.p_value.toExponential(3)}.`;
  } else {
    text.innerHTML =
      `<strong>H₀ NON REJETÉE</strong> — Aucune rupture à α = 5 %
       (D = ${R.D.toFixed(4)}, p = ${R.p_value.toExponential(3)}).`;
  }
}

// ── Populate MLE + KS tables ──────────────────────────────────────────────
function populateTables(R) {
  document.getElementById('mle-n1').textContent    = R.n1;
  document.getElementById('mle-mu1').textContent   = R.mu1.toFixed(6);
  document.getElementById('mle-sig1').textContent  = R.sigma1.toFixed(6);
  document.getElementById('mle-n2').textContent    = R.n2;
  document.getElementById('mle-mu2').textContent   = R.mu2.toFixed(6);
  document.getElementById('mle-sig2').textContent  = R.sigma2.toFixed(6);
  document.getElementById('mle-theta').textContent = R.theta.toFixed(6);
  document.getElementById('mle-negll').textContent = R.neg_ll != null ? R.neg_ll.toFixed(2) : '—';

  document.getElementById('ks-khat').textContent   = R.k_hat;
  document.getElementById('ks-date').textContent   = R.bp_date;
  document.getElementById('ks-D').textContent      = R.D.toFixed(6);
  document.getElementById('ks-pval').textContent   = R.p_value.toExponential(4);
  document.getElementById('ks-n1').textContent     = R.n1;
  document.getElementById('ks-n2').textContent     = R.n2;

  const vEl = document.getElementById('ks-verdict');
  vEl.textContent      = R.verdict;
  vEl.style.color      = R.reject_H0 ? 'var(--coral)' : 'var(--teal)';
  vEl.style.fontWeight = '700';
}

// ── Populate interpretation ───────────────────────────────────────────────
function populateInterp(R) {
  const el = document.getElementById('interpText');

  const asymDir = R.theta < -0.5 ? 'gauche (queue gauche plus lourde)'
                : R.theta >  0.5 ? 'droite (queue droite plus lourde)'
                : 'quasi-symétrique';

  const muTrend  = R.mu2 < R.mu1
    ? `Le rendement moyen a <strong>diminué</strong> (${R.mu1.toFixed(4)} → ${R.mu2.toFixed(4)}) — dégradation.`
    : `Le rendement moyen a <strong>augmenté</strong> (${R.mu1.toFixed(4)} → ${R.mu2.toFixed(4)}) — amélioration.`;

  const sigTrend = R.sigma2 > R.sigma1
    ? `La volatilité a <strong>augmenté</strong> (${R.sigma1.toFixed(4)} → ${R.sigma2.toFixed(4)}) en Régime 2.`
    : `La volatilité a <strong>diminué</strong> (${R.sigma1.toFixed(4)} → ${R.sigma2.toFixed(4)}) en Régime 2.`;

  if (R.reject_H0) {
    el.innerHTML = `
      <p>Le test KS à deux échantillons <strong>rejette H₀</strong>
         (p = ${R.p_value.toExponential(3)} &lt; 0.05), confirmant une rupture structurelle
         au point <strong>k̂ = ${R.k_hat} (${R.bp_date})</strong>.</p>
      <div class="chart-grid-2" style="margin:1rem 0;">
        <div class="regime-box" style="border-color:var(--teal);">
          <div style="color:var(--teal);font-weight:700;margin-bottom:8px;">Régime 1 — n = ${R.n1}</div>
          μ₁ = ${R.mu1.toFixed(6)}<br>σ₁ = ${R.sigma1.toFixed(6)}
        </div>
        <div class="regime-box" style="border-color:var(--amber);">
          <div style="color:var(--amber);font-weight:700;margin-bottom:8px;">Régime 2 — n = ${R.n2}</div>
          μ₂ = ${R.mu2.toFixed(6)}<br>σ₂ = ${R.sigma2.toFixed(6)}
        </div>
      </div>
      <p>θ partagé = ${R.theta.toFixed(4)} → distribution asymétrique à <strong>${asymDir}</strong>.</p>
      <p>${muTrend}</p>
      <p>${sigTrend}</p>
    `;
  } else {
    el.innerHTML = `
      <p>Le test KS <strong>ne rejette pas H₀</strong> à α = 5 %
         (D = ${R.D.toFixed(4)}, p = ${R.p_value.toExponential(3)}).</p>
      <p>La série filtrée de <strong>${R.name}</strong>
         apparaît <strong>stationnaire</strong> sur la période d'observation.</p>
    `;
  }
}

// ── Full DOM population ───────────────────────────────────────────────────
function populateUI(R) {
  document.getElementById('navName').textContent   = R.name;
  document.getElementById('navTicker').textContent = R.company || R.ticker || '';
  document.getElementById('pageTitle').textContent = R.name;
  if (R.url) document.getElementById('yahooLink').href = R.url;

  populateMetrics(R);
  populateVerdict(R);
  populateTables(R);
  populateStats(R);
  populateInterp(R);
}

// ── Error display ─────────────────────────────────────────────────────────
function showError(msg) {
  const loadingState = document.getElementById('loadingState');
  if (loadingState) {
    loadingState.innerHTML = `
      <div style="color:var(--coral);font-family:var(--font-mono);text-align:center;padding:2rem;">
        <div style="font-size:1.5rem;margin-bottom:8px;">⚠</div>
        <div>${msg}</div>
      </div>`;
  }
}

// ── Show content, hide loader ─────────────────────────────────────────────
function showContent() {
  const loadingState = document.getElementById('loadingState');
  const mainContent = document.getElementById('mainContent');
  if (loadingState) loadingState.style.display = 'none';
  if (mainContent) mainContent.style.display = 'block';
}

// ── Main entry point ──────────────────────────────────────────────────────
function initResultats(ticker) {
  initTheme();
  initTabs();

  fetch('/results', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ticker }),
  })
  .then(res => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then(R => {
    window._lastApiResponse = R;
    populateUI(R);
    showContent();

    // Build only the visible tab's charts initially
    setTimeout(() => {
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab && activeTab.dataset.tab) {
        const tabId = activeTab.dataset.tab;
        if (typeof buildSingleChart === 'function') {
          buildSingleChart(tabId, R);
        }
      }
    }, 100);
  })
  .catch(err => {
    showError('Erreur : ' + err.message);
  });
}

// Make functions globally available
window.initResultats = initResultats;