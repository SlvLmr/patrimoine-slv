// ============================================================================
// BOURSE — Suivi de marché avec cours réels (Yahoo Finance) + Chart.js
// ============================================================================

import { createChart } from '../charts/chart-config.js';

const WATCHLIST_STORAGE_KEY = 'patrimoine-slv-watchlist';
const PRICE_CACHE_KEY = 'patrimoine-slv-prices';
const PRICE_CACHE_TTL = 15 * 60 * 1000; // 15 min

// ISIN → Yahoo Finance ticker mapping
const ISIN_TO_YAHOO = {
  'FR0000120073': 'AI.PA',       // Air Liquide
  'FR0000121972': 'SU.PA',       // Schneider Electric
  'FR0010307819': 'LR.PA',       // Legrand
  'FR0000131104': 'BNP.PA',      // BNP Paribas
  'FR0000120271': 'TTE.PA',      // TotalEnergies
  'FR0000121014': 'MC.PA',       // LVMH
  'FR0000120321': 'OR.PA',       // L'Oréal
  'FR0000125007': 'SGO.PA',      // Saint-Gobain
  'FR0000125338': 'CAP.PA',      // Capgemini
  'FR0000130809': 'SAN.PA',      // Sanofi
  'FR0000127771': 'VIV.PA',      // Vivendi
  'FR0000120578': 'SAF.PA',      // Safran
  'FR0000073272': 'SAF.PA',      // Safran (alternate)
  'FR0000051807': 'TEP.PA',      // Teleperformance
  'FR0010220475': 'CW8.PA',      // Amundi MSCI World
  'FR0011550185': 'EWLD.PA',     // Lyxor PEA MSCI World
  'FR0011550193': 'PSP5.PA',     // Lyxor PEA S&P 500
  'FR0013412020': 'PAEEM.PA',    // Amundi PEA Emerging Markets
  'FR0011869353': 'PUST.PA',     // Lyxor PEA Nasdaq-100
  'FR0013412038': 'PCEU.PA',     // Amundi PEA MSCI Europe
  'FR0011550177': 'PTPXE.PA',    // Lyxor PEA Japan Topix
  'FR0013400256': 'ESE.PA',      // Stoxx 600
  'LU1681043599': 'CW8.PA',     // Amundi MSCI World (alt)
  'LU0392494562': 'MWRD.DE',    // ComStage MSCI World
  'IE00BK5BQT80': 'VWRA.L',     // Vanguard FTSE All-World
  'IE00B4L5Y983': 'EUNL.DE',    // iShares Core MSCI World
  'IE00B3RBWM25': 'VWRL.L',     // Vanguard FTSE All-World (Dist)
  'IE00BJ0KDQ92': 'VUSA.L',     // Vanguard S&P 500
  'IE00B5BMR087': 'CSPX.L',     // iShares Core S&P 500
  'IE00B4L5YC18': 'IS3N.DE',    // iShares Core EM
};

// Display symbol for cards
const KNOWN_SYMBOLS = {
  'FR0000120073': 'AI', 'FR0000121972': 'SU', 'FR0010307819': 'LR',
  'FR0000131104': 'BNP', 'FR0000120271': 'TTE', 'FR0000121014': 'MC',
  'FR0000120321': 'OR', 'FR0000125007': 'SGO', 'FR0000125338': 'CAP',
  'FR0000130809': 'SAN', 'FR0000127771': 'VIV', 'FR0000120578': 'SAF',
  'FR0000073272': 'SAF', 'FR0000051807': 'TEP', 'FR0010220475': 'CW8',
  'FR0011550185': 'EWLD', 'FR0011550193': 'PSP5', 'FR0013412020': 'PAEEM',
  'FR0011869353': 'PUST', 'FR0013412038': 'PCEU', 'FR0011550177': 'PTPXE',
  'FR0013400256': 'ESE', 'LU1681043599': 'CW8', 'LU0392494562': 'MWRD',
  'IE00BK5BQT80': 'VWRA', 'IE00B4L5Y983': 'EUNL', 'IE00B3RBWM25': 'VWRL',
  'IE00BJ0KDQ92': 'VUSA', 'IE00B5BMR087': 'CSPX', 'IE00B4L5YC18': 'IS3N',
};

function getYahooTicker(isin) {
  const upper = (isin || '').toUpperCase().trim();
  if (ISIN_TO_YAHOO[upper]) return ISIN_TO_YAHOO[upper];
  // Crypto
  if (upper.endsWith('-USD') || upper.endsWith('-EUR')) return upper;
  if (upper === 'BTC' || upper === 'BITCOIN') return 'BTC-USD';
  if (upper === 'ETH' || upper === 'ETHEREUM') return 'ETH-USD';
  // Already a Yahoo ticker
  if (upper.includes('.') || upper.includes('-')) return upper;
  // Bare US ticker
  return upper;
}

function getSymbolDisplay(isin) {
  const upper = (isin || '').toUpperCase().trim();
  if (KNOWN_SYMBOLS[upper]) return KNOWN_SYMBOLS[upper];
  if (upper.includes('.')) return upper.split('.')[0];
  if (upper.includes(':')) return upper.split(':')[1];
  return upper;
}

const DEFAULT_WATCHLIST = [
  { isin: 'FR0011550185', name: 'Lyxor PEA MSCI World', type: 'ETF' },
  { isin: 'FR0011550193', name: 'Lyxor PEA S&P 500', type: 'ETF' },
  { isin: 'FR0013412020', name: 'Amundi PEA Emerging Markets', type: 'ETF' },
  { isin: 'IE00BK5BQT80', name: 'Vanguard FTSE All-World', type: 'ETF' },
  { isin: 'FR0000120073', name: 'Air Liquide', type: 'Action' },
  { isin: 'FR0000121972', name: 'Schneider Electric', type: 'Action' },
  { isin: 'FR0010307819', name: 'Legrand', type: 'Action' }
];

function loadWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const filtered = parsed.filter(w => w.isin);
      if (filtered.length !== parsed.length) localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(filtered));
      if (filtered.length > 0) return filtered;
    }
  } catch {}
  return DEFAULT_WATCHLIST.map(w => ({ ...w }));
}

function saveWatchlist(list) { localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list)); }

function sid(isin) { return (isin || '').replace(/[^a-zA-Z0-9]/g, ''); }

function findMatchingActif(item, placements) {
  if (!placements || !placements.length) return null;
  const isinLower = (item.isin || '').toLowerCase();
  const nameLower = (item.name || '').toLowerCase();
  if (!isinLower) return null;
  return placements.find(p => {
    const pIsin = (p.isin || '').toLowerCase();
    const pNom = (p.nom || '').toLowerCase();
    const pTicker = (p.ticker || '').toLowerCase();
    if (pIsin && pIsin === isinLower) return true;
    if (pTicker && pTicker === isinLower) return true;
    if (pIsin && (pIsin.includes(isinLower) || isinLower.includes(pIsin))) return true;
    if (pNom && nameLower) {
      if (pNom.includes(nameLower) || nameLower.includes(pNom)) return true;
      const firstWord = nameLower.split(' ')[0];
      if (firstWord.length >= 3 && pNom.includes(firstWord)) return true;
    }
    if (p.categorie === 'Crypto' && pNom && nameLower) {
      const pFirstWord = pNom.split(' ')[0];
      const iFirstWord = nameLower.split(' ')[0];
      if (pFirstWord.length >= 3 && pFirstWord === iFirstWord) return true;
    }
    return false;
  }) || null;
}

function formatNum(v, decimals = 2) {
  return Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ============================================================================
// YAHOO FINANCE API
// ============================================================================

function loadPriceCache() {
  try {
    const raw = localStorage.getItem(PRICE_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function savePriceCache(cache) {
  localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
}

async function fetchYahooChart(yahooTicker) {
  // Use Yahoo Finance v8 chart API — returns 1 month of daily data
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?range=1mo&interval=1d&includePrePost=false`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Yahoo ${resp.status}`);
  const json = await resp.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No data');

  const closes = result.indicators?.quote?.[0]?.close || [];
  const timestamps = result.timestamp || [];
  const currency = result.meta?.currency || 'EUR';
  const currentPrice = result.meta?.regularMarketPrice || closes[closes.length - 1] || 0;

  // Filter out nulls and build clean data
  const data = [];
  const labels = [];
  for (let i = 0; i < closes.length; i++) {
    if (closes[i] != null) {
      data.push(Math.round(closes[i] * 100) / 100);
      const d = new Date(timestamps[i] * 1000);
      labels.push(d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    }
  }

  return { data, labels, currentPrice, currency };
}

async function fetchAllPrices(watchlist) {
  const cache = loadPriceCache();
  const now = Date.now();
  const results = {};

  const promises = watchlist.map(async (item) => {
    const yahooTicker = getYahooTicker(item.isin);
    const cacheKey = yahooTicker;

    // Check cache
    if (cache[cacheKey] && (now - cache[cacheKey].ts) < PRICE_CACHE_TTL) {
      results[item.isin] = cache[cacheKey];
      return;
    }

    try {
      const chartData = await fetchYahooChart(yahooTicker);
      const entry = { ...chartData, ts: now };
      cache[cacheKey] = entry;
      results[item.isin] = entry;
    } catch {
      // Use cached data even if expired, or fallback
      if (cache[cacheKey]) {
        results[item.isin] = cache[cacheKey];
      }
    }
  });

  await Promise.allSettled(promises);
  savePriceCache(cache);
  return results;
}

// Seeded random fallback for when API fails
function seededRandom(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  return function() { s = (s * 16807 + 0) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
}

function generateFallbackData(isin, basePrice) {
  const rng = seededRandom(isin + '_spark');
  const data = [];
  let price = basePrice * (0.92 + rng() * 0.08);
  const drift = (basePrice - price) / 30;
  for (let i = 0; i < 30; i++) {
    data.push(Math.round(price * 100) / 100);
    const vol = basePrice > 1000 ? 0.012 : basePrice > 100 ? 0.015 : 0.02;
    price += drift + price * vol * (rng() - 0.45);
  }
  data.push(Math.round(basePrice * 100) / 100);
  const labels = data.map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (data.length - 1 - i));
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  });
  return { data, labels, currentPrice: basePrice, currency: 'EUR' };
}

// No-op exports for app.js compatibility
export async function backgroundRefresh() {}
export function getNextRefreshTime() {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); return tomorrow;
}

// ============================================================================
// RENDER
// ============================================================================

export function render(store) {
  const watchlist = loadWatchlist();
  const placements = store?.get?.('actifs.placements') || [];

  return `
    <div class="max-w-6xl mx-auto space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-green-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3v18h18M9 17V9m4 8V5m4 12v-4"/>
              </svg>
            </div>
            Bourse
          </h2>
          <p class="text-gray-500 text-sm mt-1">Suivi de ton portefeuille et de ta watchlist</p>
        </div>
        <button id="btn-add-ticker" class="px-4 py-2 bg-dark-600 border border-dark-400 text-gray-300 text-sm rounded-lg hover:bg-dark-500 transition font-medium flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Ajouter un titre
        </button>
      </div>

      <!-- Graphique principal -->
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="flex items-center gap-2 px-4 py-3 border-b border-dark-400/20">
          <div class="w-2 h-2 rounded-full bg-accent-green animate-pulse" id="bourse-status-dot"></div>
          <span class="text-xs text-gray-400" id="active-symbol-label">Chargement des cours...</span>
        </div>
        <div class="px-4 py-2" style="height:320px">
          <canvas id="bourse-main-chart"></canvas>
        </div>
      </div>

      <!-- Grille des titres (compact) -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2" id="quotes-grid">
        ${watchlist.map((item, idx) => {
          const sym = getSymbolDisplay(item.isin);
          const actif = findMatchingActif(item, placements);
          const hasPortfolio = actif && (actif.quantite || actif.pru);
          const qty = hasPortfolio ? (Number(actif.quantite) || 0) : 0;
          const pru = hasPortfolio ? (Number(actif.pru) || 0) : 0;
          const valTotale = hasPortfolio ? (Number(actif.valeur) || 0) : 0;

          return `
          <div class="card-dark rounded-xl p-2.5 cursor-pointer relative group hover:ring-1 hover:ring-accent-green/30 transition ticker-card ${idx === 0 ? 'ring-1 ring-accent-green/40' : ''}"
               data-isin="${item.isin}" data-name="${item.name}" data-sym="${sym}" draggable="true">
            <div class="absolute top-1 right-1 flex items-center gap-0.5 z-10 opacity-0 group-hover:opacity-100 transition">
              <button class="btn-move-up w-4 h-4 rounded-full bg-dark-600/80 text-gray-500 hover:text-accent-amber transition flex items-center justify-center" data-isin="${item.isin}">
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
              </button>
              <button class="btn-move-down w-4 h-4 rounded-full bg-dark-600/80 text-gray-500 hover:text-accent-amber transition flex items-center justify-center" data-isin="${item.isin}">
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <button class="btn-remove-ticker w-4 h-4 rounded-full bg-dark-600/80 text-gray-500 hover:text-accent-red transition flex items-center justify-center" data-isin="${item.isin}">
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="text-[9px] px-1 py-0.5 rounded ${item.type === 'ETF' ? 'bg-accent-green/10 text-accent-green' : item.type === 'Crypto' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'}">${item.type}</span>
              <span class="text-[10px] font-bold text-gray-400">${sym}</span>
            </div>
            <p class="text-xs font-medium text-gray-200 truncate">${item.name}</p>

            <!-- Price (updated dynamically) -->
            <div class="flex items-baseline gap-1.5 mt-1" id="price-${sid(item.isin)}">
              <span class="text-sm font-bold text-gray-100 price-value">—</span>
              <span class="text-[10px] font-semibold price-change"></span>
            </div>

            <!-- Mini sparkline -->
            <div style="height:40px" class="mt-1">
              <canvas id="spark-${sid(item.isin)}"></canvas>
            </div>

            ${hasPortfolio ? `
              <div class="mt-1.5 pt-1.5 border-t border-dark-400/20 flex justify-between text-[10px]">
                <span class="text-gray-500">${Number.isInteger(qty) ? formatNum(qty, 0) : formatNum(qty, 4)} parts</span>
                <span class="text-gray-300 font-medium">${formatNum(valTotale)} €</span>
              </div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Modal ajout titre -->
    <div id="modal-add-ticker" class="fixed inset-0 z-50 hidden">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="modal-overlay-add"></div>
      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="relative bg-dark-800 border border-dark-400 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-100">Ajouter un titre</h3>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Code ISIN ou Ticker</label>
            <input id="input-isin" type="text" placeholder="Ex: FR0011550185, AAPL, BTC-USD" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Nom</label>
            <input id="input-name" type="text" placeholder="Ex: Air Liquide" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Type</label>
            <select id="input-type" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition">
              <option value="ETF">ETF / Tracker</option>
              <option value="Action">Action</option>
              <option value="Crypto">Crypto</option>
            </select>
          </div>
          <div class="flex gap-3 pt-2">
            <button id="btn-cancel-add" class="flex-1 px-4 py-2.5 bg-dark-600 text-gray-300 text-sm rounded-lg hover:bg-dark-500 transition">Annuler</button>
            <button id="btn-confirm-add" class="flex-1 px-4 py-2.5 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium">Ajouter</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// CHART HELPERS
// ============================================================================

function renderSparkline(canvasId, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext('2d');
  const h = canvas.parentElement.clientHeight || 40;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, color + '30');
  gradient.addColorStop(1, color + '00');

  createChart(canvasId, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: gradient,
        borderWidth: 1.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 400 },
      scales: { x: { display: false }, y: { display: false } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11,11,15,0.95)', titleColor: '#e8d5b0',
          bodyColor: '#a0a0a5', borderColor: 'rgba(56,56,63,0.6)', borderWidth: 1,
          padding: 6, cornerRadius: 6, displayColors: false,
          callbacks: { title: () => '', label: (item) => `${formatNum(item.raw)} €` }
        }
      }
    }
  });
}

function renderMainChart(name, chartInfo, color) {
  const labelEl = document.getElementById('active-symbol-label');
  if (labelEl) labelEl.textContent = `${name} — 30 jours`;

  const canvas = document.getElementById('bourse-main-chart');
  if (!canvas || !chartInfo.data.length) return;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(1, color + '00');

  createChart('bourse-main-chart', {
    type: 'line',
    data: {
      labels: chartInfo.labels,
      datasets: [{
        label: name,
        data: chartInfo.data,
        borderColor: color,
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        pointHitRadius: 12,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      scales: {
        x: { grid: { color: 'rgba(42,42,47,0.3)' }, ticks: { color: '#555', font: { size: 10 }, maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(42,42,47,0.3)' }, ticks: { color: '#555', font: { size: 11 },
          callback: v => v >= 10000 ? (v / 1000).toFixed(0) + 'k€' : v >= 1000 ? (v / 1000).toFixed(1) + 'k€' : formatNum(v) + ' €'
        }}
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11,11,15,0.95)', titleColor: '#e8d5b0',
          bodyColor: '#a0a0a5', borderColor: 'rgba(56,56,63,0.6)', borderWidth: 1,
          padding: 12, cornerRadius: 10, displayColors: false,
          callbacks: { label: (item) => ` ${formatNum(item.raw)} €` }
        }
      }
    }
  });
}

// ============================================================================
// MOUNT
// ============================================================================

const TYPE_COLORS = { 'Action': '#60a5fa', 'ETF': '#34d399', 'Crypto': '#fbbf24' };

export function mount(store, navigate) {
  const watchlist = loadWatchlist();
  const placements = store?.get?.('actifs.placements') || [];

  // Chart data store (filled by API or fallback)
  const chartStore = {};

  // 1. Render immediately with fallback data from portfolio
  watchlist.forEach(item => {
    const actif = findMatchingActif(item, placements);
    const qty = actif ? (Number(actif.quantite) || 0) : 0;
    const pru = actif ? (Number(actif.pru) || 0) : 0;
    const val = actif ? (Number(actif.valeur) || 0) : 0;
    const price = (qty > 0 && val > 0) ? val / qty : pru || 100;
    const color = TYPE_COLORS[item.type] || '#60a5fa';
    const fallback = generateFallbackData(item.isin, price);
    chartStore[item.isin] = { ...fallback, color, name: item.name };

    // Show portfolio price immediately
    updatePriceDisplay(item.isin, price, null);
    renderSparkline(`spark-${sid(item.isin)}`, fallback.data, color);
  });

  // Show first chart immediately
  if (watchlist.length > 0) {
    const first = watchlist[0];
    const cs = chartStore[first.isin];
    if (cs) renderMainChart(first.name, cs, cs.color);
  }

  // 2. Fetch real data in background
  fetchAllPrices(watchlist).then(prices => {
    const dot = document.getElementById('bourse-status-dot');

    let anyReal = false;
    watchlist.forEach(item => {
      const priceData = prices[item.isin];
      if (priceData && priceData.data.length > 0) {
        anyReal = true;
        const color = TYPE_COLORS[item.type] || '#60a5fa';
        chartStore[item.isin] = { ...priceData, color, name: item.name };

        // Update price display
        const lastPrice = priceData.currentPrice || priceData.data[priceData.data.length - 1];
        const firstPrice = priceData.data[0];
        const changePct = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice * 100) : 0;
        updatePriceDisplay(item.isin, lastPrice, changePct);

        // Re-render sparkline with real data
        renderSparkline(`spark-${sid(item.isin)}`, priceData.data, color);
      }
    });

    if (dot) {
      dot.className = anyReal
        ? 'w-2 h-2 rounded-full bg-accent-green animate-pulse'
        : 'w-2 h-2 rounded-full bg-accent-amber animate-pulse';
    }

    // Re-render main chart with real data for active card
    const activeCard = document.querySelector('.ticker-card.ring-1');
    if (activeCard) {
      const isin = activeCard.dataset.isin;
      const name = activeCard.dataset.name;
      const cs = chartStore[isin];
      if (cs) renderMainChart(name, cs, cs.color);
    }
  });

  function updatePriceDisplay(isin, price, changePct) {
    const el = document.getElementById(`price-${sid(isin)}`);
    if (!el) return;
    const priceEl = el.querySelector('.price-value');
    const changeEl = el.querySelector('.price-change');
    if (priceEl && price > 0) priceEl.textContent = `${formatNum(price)} €`;
    if (changeEl && changePct != null) {
      changeEl.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`;
      changeEl.className = `text-[10px] font-semibold ${changePct >= 0 ? 'text-accent-green' : 'text-accent-red'}`;
    }
  }

  // Click card → show main chart
  document.querySelectorAll('.ticker-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-move-up, .btn-move-down, .btn-remove-ticker')) return;
      const isin = card.dataset.isin;
      const name = card.dataset.name;
      const cs = chartStore[isin];
      if (!cs) return;

      document.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('ring-1', 'ring-accent-green/40'));
      card.classList.add('ring-1', 'ring-accent-green/40');
      renderMainChart(name, cs, cs.color);
      document.getElementById('bourse-main-chart')?.closest('.card-dark')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // Modal
  const modal = document.getElementById('modal-add-ticker');
  document.getElementById('btn-add-ticker')?.addEventListener('click', () => modal?.classList.remove('hidden'));
  document.getElementById('btn-cancel-add')?.addEventListener('click', () => modal?.classList.add('hidden'));
  document.getElementById('modal-overlay-add')?.addEventListener('click', () => modal?.classList.add('hidden'));

  document.getElementById('input-isin')?.addEventListener('input', (e) => {
    const val = e.target.value.trim().toUpperCase();
    const typeSelect = document.getElementById('input-type');
    if (typeSelect && (val.includes('-USD') || val.includes('-EUR') || val.includes('CRYPTO:'))) typeSelect.value = 'Crypto';
  });

  document.getElementById('btn-confirm-add')?.addEventListener('click', () => {
    const isin = document.getElementById('input-isin')?.value?.trim();
    if (!isin) return;
    const name = document.getElementById('input-name')?.value?.trim() || isin;
    const type = document.getElementById('input-type')?.value || 'ETF';
    const wl = loadWatchlist();
    if (wl.some(w => w.isin.toLowerCase() === isin.toLowerCase())) { alert('Ce titre est déjà dans ta liste.'); return; }
    wl.push({ isin, name, type });
    saveWatchlist(wl);
    modal?.classList.add('hidden');
    navigate('bourse');
  });

  // Remove / Move
  document.querySelectorAll('.btn-remove-ticker').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wl = loadWatchlist();
      const updated = wl.filter(w => w.isin !== btn.dataset.isin);
      if (updated.length < wl.length) { saveWatchlist(updated); navigate('bourse'); }
    });
  });

  document.querySelectorAll('.btn-move-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wl = loadWatchlist();
      const idx = wl.findIndex(w => w.isin === btn.dataset.isin);
      if (idx > 0) { [wl[idx - 1], wl[idx]] = [wl[idx], wl[idx - 1]]; saveWatchlist(wl); navigate('bourse'); }
    });
  });

  document.querySelectorAll('.btn-move-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wl = loadWatchlist();
      const idx = wl.findIndex(w => w.isin === btn.dataset.isin);
      if (idx >= 0 && idx < wl.length - 1) { [wl[idx], wl[idx + 1]] = [wl[idx + 1], wl[idx]]; saveWatchlist(wl); navigate('bourse'); }
    });
  });

  // Drag & drop
  const grid = document.getElementById('quotes-grid');
  if (grid) {
    let draggedEl = null;
    grid.addEventListener('dragstart', (e) => { const c = e.target.closest('.ticker-card'); if (c) { draggedEl = c; c.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; } });
    grid.addEventListener('dragend', (e) => { const c = e.target.closest('.ticker-card'); if (c) c.style.opacity = '1'; grid.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('ring', 'ring-accent-amber/40')); draggedEl = null; });
    grid.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const t = e.target.closest('.ticker-card'); if (t && t !== draggedEl) { grid.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('ring', 'ring-accent-amber/40')); t.classList.add('ring', 'ring-accent-amber/40'); } });
    grid.addEventListener('dragleave', (e) => { const t = e.target.closest('.ticker-card'); if (t) t.classList.remove('ring', 'ring-accent-amber/40'); });
    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      const target = e.target.closest('.ticker-card');
      if (!target || !draggedEl || target === draggedEl) return;
      target.classList.remove('ring', 'ring-accent-amber/40');
      const allCards = [...grid.querySelectorAll('.ticker-card')];
      const fromIdx = allCards.indexOf(draggedEl), toIdx = allCards.indexOf(target);
      if (fromIdx < 0 || toIdx < 0) return;
      grid.insertBefore(draggedEl, fromIdx < toIdx ? target.nextSibling : target);
      const wl = loadWatchlist();
      const reordered = [...grid.querySelectorAll('.ticker-card')].map(c => wl.find(w => w.isin === c.dataset.isin)).filter(Boolean);
      saveWatchlist(reordered);
    });
  }
}
