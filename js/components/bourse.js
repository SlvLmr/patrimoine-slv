import { createChart, createVerticalGradient } from '../charts/chart-config.js';

const WATCHLIST_STORAGE_KEY = 'patrimoine-slv-watchlist';
const QUOTES_CACHE_KEY = 'patrimoine-slv-quotes-cache';
const REFRESH_SLOTS = [
  { h: 8, m: 30 },
  { h: 12, m: 30 },
  { h: 17, m: 30 },
  { h: 20, m: 30 }
];

// Well-known ISIN → Yahoo Finance ticker mappings (avoids unreliable search API)
const KNOWN_TICKERS = {
  // French stocks
  'FR0000120073': 'AI.PA',     // Air Liquide
  'FR0000121972': 'SU.PA',     // Schneider Electric
  'FR0010307819': 'LR.PA',     // Legrand
  'FR0000131104': 'BNP.PA',    // BNP Paribas
  'FR0000120271': 'TTE.PA',    // TotalEnergies
  'FR0000121014': 'MC.PA',     // LVMH
  'FR0000120321': 'OR.PA',     // L'Oréal
  'FR0000125007': 'SGO.PA',    // Saint-Gobain
  'FR0000125338': 'CAP.PA',    // Capgemini
  'FR0000130809': 'SAN.PA',    // Sanofi
  'FR0000127771': 'VIV.PA',    // Vivendi
  'FR0000120578': 'SAF.PA',    // Safran
  'FR0000073272': 'SAF.PA',    // Safran (alternate)
  'FR0000051807': 'TEP.PA',    // Teleperformance
  'FR0010220475': 'CW8.PA',    // Amundi MSCI World
  // PEA ETFs (Euronext Paris)
  'FR0011550185': 'EWLD.PA',   // Lyxor PEA MSCI World
  'FR0011550193': 'PSP5.PA',   // Lyxor PEA S&P 500
  'FR0013412020': 'PAEEM.PA',  // Amundi PEA Emerging Markets
  'FR0011869353': 'PUST.PA',   // Lyxor PEA Nasdaq-100
  'FR0013412038': 'PCEU.PA',   // Amundi PEA MSCI Europe
  'FR0011550177': 'PTPXE.PA',  // Lyxor PEA Japan Topix
  'LU1681043599': 'CW8.PA',    // Amundi MSCI World (alt)
  'LU0392494562': 'MWRD.DE',   // ComStage MSCI World
  // International ETFs
  'IE00BK5BQT80': 'VWRA.L',   // Vanguard FTSE All-World
  'IE00B4L5Y983': 'IWDA.AS',   // iShares Core MSCI World
  'IE00B3RBWM25': 'VWRL.AS',   // Vanguard FTSE All-World (Dist)
  'IE00BJ0KDQ92': 'VUSA.L',    // Vanguard S&P 500
  'IE00B5BMR087': 'CSPX.L',    // iShares Core S&P 500
  'IE00B4L5YC18': 'EMIM.AS',   // iShares Core EM
};

// Persistent ticker cache in localStorage (survives page reloads)
const TICKER_CACHE_KEY = 'patrimoine-slv-ticker-cache';
function loadTickerCache() {
  try { return JSON.parse(localStorage.getItem(TICKER_CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveTickerCache(cache) {
  localStorage.setItem(TICKER_CACHE_KEY, JSON.stringify(cache));
}

// Multiple CORS proxies for resilience — ordered by reliability
const CORS_PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Track which proxy index worked last to try it first next time
let lastWorkingProxyIdx = 0;

async function fetchWithProxy(url, timeoutMs = 10000) {
  // Try direct fetch first (works in some environments / extensions)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) return await res.json();
  } catch { /* direct fetch blocked by CORS, expected */ }

  // Try proxies, starting with the last one that worked
  const order = [];
  for (let j = 0; j < CORS_PROXIES.length; j++) {
    order.push((lastWorkingProxyIdx + j) % CORS_PROXIES.length);
  }

  for (const idx of order) {
    const proxyUrl = CORS_PROXIES[idx](url);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      lastWorkingProxyIdx = idx; // remember which proxy worked
      return json;
    } catch (e) {
      console.warn(`Proxy ${idx} failed for ${url}:`, e.message);
    }
  }
  throw new Error('All proxies failed');
}

function getLastSlotTime() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let lastSlot = null;
  for (const slot of REFRESH_SLOTS) {
    const slotTime = new Date(today.getTime() + slot.h * 3600000 + slot.m * 60000);
    if (now >= slotTime) lastSlot = slotTime;
  }
  if (!lastSlot) {
    // Before first slot today → use last slot from yesterday
    const yesterday = new Date(today.getTime() - 86400000);
    const last = REFRESH_SLOTS[REFRESH_SLOTS.length - 1];
    lastSlot = new Date(yesterday.getTime() + last.h * 3600000 + last.m * 60000);
  }
  return lastSlot;
}

function getNextSlotTime() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const slot of REFRESH_SLOTS) {
    const slotTime = new Date(today.getTime() + slot.h * 3600000 + slot.m * 60000);
    if (now < slotTime) return slotTime;
  }
  // After last slot today → first slot tomorrow
  const tomorrow = new Date(today.getTime() + 86400000);
  const first = REFRESH_SLOTS[0];
  return new Date(tomorrow.getTime() + first.h * 3600000 + first.m * 60000);
}

function loadQuotesCache() {
  try {
    const raw = localStorage.getItem(QUOTES_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveQuotesCache(data) {
  localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
}

function isCacheFresh() {
  const cache = loadQuotesCache();
  if (!cache || !cache.timestamp) return false;
  const lastSlot = getLastSlotTime();
  return cache.timestamp >= lastSlot.getTime();
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
      // Migration: remove items without ISIN
      const filtered = parsed.filter(w => w.isin);
      if (filtered.length !== parsed.length) {
        localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(filtered));
      }
      if (filtered.length > 0) return filtered;
    }
  } catch {}
  return DEFAULT_WATCHLIST.map(w => ({ ...w }));
}

function saveWatchlist(list) {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list));
}

function sid(isin) {
  return (isin || '').replace(/[^a-zA-Z0-9]/g, '');
}

// Check if a string looks like an ISIN (2 letters + 10 alphanumeric)
function isIsin(str) {
  return /^[A-Z]{2}[A-Z0-9]{10}$/i.test(str);
}

// Resolve ISIN or ticker to Yahoo Finance ticker
// Priority: hardcoded map → persistent cache → Yahoo search API (last resort)
const tickerCacheMem = {};
async function resolveIsinToTicker(identifier) {
  const upper = identifier.toUpperCase();

  // Memory cache
  if (tickerCacheMem[upper]) return tickerCacheMem[upper];

  // Not an ISIN → direct ticker
  if (!isIsin(upper)) {
    tickerCacheMem[upper] = upper;
    return upper;
  }

  // Hardcoded well-known mapping
  if (KNOWN_TICKERS[upper]) {
    tickerCacheMem[upper] = KNOWN_TICKERS[upper];
    return KNOWN_TICKERS[upper];
  }

  // Persistent localStorage cache (from previous successful lookups)
  const persisted = loadTickerCache();
  if (persisted[upper]) {
    tickerCacheMem[upper] = persisted[upper];
    return persisted[upper];
  }

  // Last resort: Yahoo Finance search API
  try {
    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(identifier)}&quotesCount=1&newsCount=0`;
    const data = await fetchWithProxy(searchUrl);
    const quote = data.quotes?.[0];
    if (quote?.symbol) {
      tickerCacheMem[upper] = quote.symbol;
      // Persist for future use
      persisted[upper] = quote.symbol;
      saveTickerCache(persisted);
      return quote.symbol;
    }
  } catch (e) {
    console.warn(`Ticker lookup failed for ${identifier}:`, e);
  }
  return null;
}

async function fetchQuoteWithHistory(isin) {
  const ticker = await resolveIsinToTicker(isin);
  if (!ticker) return null;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1mo&interval=1d`;
  try {
    const data = await fetchWithProxy(url);
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter(c => c !== null);
    const currentPrice = meta.regularMarketPrice || validCloses[validCloses.length - 1] || 0;
    const previousClose = meta.chartPreviousClose || meta.previousClose || validCloses[validCloses.length - 2] || currentPrice;
    const change = currentPrice - previousClose;
    const changePct = previousClose ? (change / previousClose) * 100 : 0;
    const currency = meta.currency || 'EUR';

    const chartPoints = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000),
      close: closes[i]
    })).filter(d => d.close !== null);

    return { ticker, price: currentPrice, previousClose, change, changePct, currency, chartPoints };
  } catch (e) {
    console.error(`Failed to fetch ${isin} (${ticker}):`, e);
    return null;
  }
}

// Batch fetch: resolve all tickers, then use batch Yahoo endpoints
async function fetchAllQuotesBatch(watchlist) {
  // Step 1: Resolve all tickers in parallel (most are in KNOWN_TICKERS, instant)
  const tickerResults = await Promise.allSettled(
    watchlist.map(item => resolveIsinToTicker(item.isin))
  );
  const isinToTicker = {};
  const tickerToIsin = {};
  const tickers = [];
  tickerResults.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      const isin = watchlist[i].isin;
      isinToTicker[isin] = r.value;
      tickerToIsin[r.value] = isin;
      tickers.push(r.value);
    }
  });
  if (tickers.length === 0) return {};

  const symbolsParam = tickers.join(',');
  const quotesMap = {};

  // Step 2: Fetch spark (chart data) and quote (prices) in parallel — 2 calls total
  const sparkUrl = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbolsParam)}&range=1mo&interval=1d`;
  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolsParam)}`;

  const [sparkResult, quoteResult] = await Promise.allSettled([
    fetchWithProxy(sparkUrl, 8000),
    fetchWithProxy(quoteUrl, 8000)
  ]);

  // Parse quote data
  const quoteData = {};
  if (quoteResult.status === 'fulfilled' && quoteResult.value?.quoteResponse?.result) {
    for (const q of quoteResult.value.quoteResponse.result) {
      quoteData[q.symbol] = q;
    }
  }

  // Parse spark data
  const sparkData = {};
  if (sparkResult.status === 'fulfilled' && sparkResult.value?.spark?.result) {
    for (const item of sparkResult.value.spark.result) {
      if (item.response?.[0]?.indicators?.quote?.[0]?.close) {
        sparkData[item.symbol] = item.response[0];
      }
    }
  }

  // Step 3: Combine into quotesMap keyed by ISIN
  for (const ticker of tickers) {
    const isin = tickerToIsin[ticker];
    const q = quoteData[ticker];
    const s = sparkData[ticker];

    if (!q && !s) continue;

    const price = q?.regularMarketPrice || 0;
    const previousClose = q?.regularMarketPreviousClose || q?.previousClose || price;
    const change = q?.regularMarketChange ?? (price - previousClose);
    const changePct = q?.regularMarketChangePercent ?? (previousClose ? (change / previousClose) * 100 : 0);
    const currency = q?.currency || 'EUR';

    let chartPoints = [];
    if (s) {
      const timestamps = s.timestamp || [];
      const closes = s.indicators?.quote?.[0]?.close || [];
      chartPoints = timestamps.map((ts, i) => ({
        date: new Date(ts * 1000),
        close: closes[i]
      })).filter(d => d.close !== null);
    }

    if (price > 0 || chartPoints.length > 0) {
      quotesMap[isin] = { ticker, price, previousClose, change, changePct, currency, chartPoints };
    }
  }

  return quotesMap;
}

function formatPrice(value, currency) {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', minimumFractionDigits: 2 }).format(value);
}

const pruLinePlugin = {
  id: 'pruLine',
  afterDraw(chart) {
    const pru = chart.options.plugins.pruLine?.value;
    if (!pru) return;
    const yScale = chart.scales.y;
    if (!yScale) return;
    const yPixel = yScale.getPixelForValue(pru);
    if (yPixel < chart.chartArea.top || yPixel > chart.chartArea.bottom) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(201, 167, 108, 0.5)';
    ctx.lineWidth = 1;
    ctx.moveTo(chart.chartArea.left, yPixel);
    ctx.lineTo(chart.chartArea.right, yPixel);
    ctx.stroke();
    // Label
    ctx.fillStyle = 'rgba(201, 167, 108, 0.7)';
    ctx.font = '9px Inter';
    ctx.textAlign = 'right';
    ctx.fillText('PRU', chart.chartArea.right - 2, yPixel - 3);
    ctx.restore();
  }
};

function renderMiniChart(canvasId, chartPoints, isUp, pru) {
  const color = isUp ? '#22c55e' : '#ef4444';
  const labels = chartPoints.map(d => d.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
  const values = chartPoints.map(d => d.close);

  createChart(canvasId, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        pointHoverBackgroundColor: color,
        tension: 0.35,
        fill: true,
        backgroundColor: function(context) {
          const { ctx } = context.chart;
          return createVerticalGradient(ctx, color, 0.25, 0.0);
        }
      }]
    },
    plugins: pru ? [pruLinePlugin] : [],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        pruLine: { value: pru || null },
        tooltip: {
          backgroundColor: 'rgba(11, 11, 15, 0.95)',
          titleColor: '#e8d5b0',
          bodyColor: '#a0a0a5',
          borderColor: 'rgba(56, 56, 63, 0.6)',
          borderWidth: 1,
          padding: 8,
          cornerRadius: 8,
          titleFont: { size: 11, family: 'Inter' },
          bodyFont: { size: 11, family: 'Inter' },
          displayColors: false,
          callbacks: {
            label: (ctx) => ctx.parsed.y?.toFixed(2) || ''
          }
        }
      },
      scales: {
        x: { display: false },
        y: {
          display: false,
          ...(pru ? { suggestedMin: Math.min(pru, ...values) * 0.998, suggestedMax: Math.max(pru, ...values) * 1.002 } : {})
        }
      }
    }
  });
}

function findMatchingActif(item, placements) {
  if (!placements || !placements.length) return null;
  const isinLower = (item.isin || '').toLowerCase();
  const nameLower = (item.name || '').toLowerCase();
  if (!isinLower) return null;

  return placements.find(p => {
    const pIsin = (p.isin || '').toLowerCase();
    const pNom = (p.nom || '').toLowerCase();
    const pTicker = (p.ticker || '').toLowerCase();

    // Exact ISIN/ticker match
    if (pIsin && pIsin === isinLower) return true;
    if (pTicker && pTicker === isinLower) return true;

    // Substring ISIN match (for partial ISINs)
    if (pIsin && (pIsin.includes(isinLower) || isinLower.includes(pIsin))) return true;

    // Name matching: compare full names and first words
    if (pNom && nameLower) {
      // Full name contains
      if (pNom.includes(nameLower) || nameLower.includes(pNom)) return true;
      // First word match (at least 3 chars to avoid false positives)
      const firstWord = nameLower.split(' ')[0];
      if (firstWord.length >= 3 && pNom.includes(firstWord)) return true;
    }

    // Categorie crypto + name match (e.g. "Bitcoin" in placements matches "Bitcoin" watchlist)
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

// Background refresh: fetch quotes and cache them (no DOM needed)
export async function backgroundRefresh() {
  if (isCacheFresh()) return; // already up to date
  const watchlist = loadWatchlist();
  let quotesMap = {};
  try {
    quotesMap = await fetchAllQuotesBatch(watchlist);
  } catch (e) {
    console.warn('Batch background refresh failed, falling back to individual:', e);
    // Fallback to individual fetches
    const results = await Promise.allSettled(
      watchlist.map(item => fetchQuoteWithHistory(item.isin))
    );
    results.forEach((result, j) => {
      if (result.status === 'fulfilled' && result.value) {
        quotesMap[watchlist[j].isin] = result.value;
      }
    });
  }
  if (Object.keys(quotesMap).length > 0) saveQuotesCache(quotesMap);
}

// Expose next slot time for scheduling
export function getNextRefreshTime() {
  return getNextSlotTime();
}

export function render(store) {
  const watchlist = loadWatchlist();
  const placements = store?.get?.('actifs.placements') || [];

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h1 class="text-2xl font-bold text-gray-100">Bourse Live</h1>
        <div class="flex items-center gap-2">
          <button id="btn-add-ticker" class="px-4 py-2 bg-dark-600 border border-dark-400 text-gray-300 text-sm rounded-lg hover:bg-dark-500 transition font-medium flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Ajouter un titre
          </button>
          <button id="btn-refresh-quotes" class="px-4 py-2 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Actualiser
          </button>
        </div>
      </div>

      <div class="card-dark rounded-xl p-3">
        <div class="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
          <div class="w-2 h-2 rounded-full bg-accent-green animate-pulse" id="market-indicator"></div>
          <span id="market-status">Chargement des cours...</span>
        </div>
        <p class="text-[10px] text-gray-600">Rafraîchissement auto : 8h30 · 12h30 · 17h30 · 20h30 — Bouton "Actualiser" pour forcer</p>
      </div>

      <!-- Quotes grid with mini charts -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" id="quotes-grid">
        ${watchlist.map(item => `
        <div class="card-dark rounded-xl p-3 kpi-card relative group" id="quote-${sid(item.isin)}" draggable="true" data-isin="${item.isin}" style="cursor:grab">
          <div class="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition z-10">
            <button class="btn-move-up w-5 h-5 rounded-full bg-dark-600/80 text-gray-500 hover:bg-accent-amber/20 hover:text-accent-amber transition flex items-center justify-center" data-isin="${item.isin}" title="Monter">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
              </svg>
            </button>
            <button class="btn-move-down w-5 h-5 rounded-full bg-dark-600/80 text-gray-500 hover:bg-accent-amber/20 hover:text-accent-amber transition flex items-center justify-center" data-isin="${item.isin}" title="Descendre">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            <button class="btn-remove-ticker w-5 h-5 rounded-full bg-dark-600/80 text-gray-500 hover:bg-accent-amber/20 hover:text-accent-amber transition flex items-center justify-center" data-isin="${item.isin}" title="Retirer">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] px-1.5 py-0.5 rounded-full ${item.type === 'ETF' ? 'bg-accent-green/10 text-accent-green' : item.type === 'Crypto' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'}">${item.type}</span>
            <span class="text-[10px] text-gray-600 quote-ticker-label">—</span>
          </div>
          <p class="text-xs font-medium text-gray-200 mb-0.5 truncate">${item.name}</p>
          <p class="text-[10px] text-gray-600 mb-1">${item.isin}</p>
          <div class="quote-chart mb-1" style="height:55px">
            <canvas id="chart-${sid(item.isin)}"></canvas>
          </div>
          <div class="quote-price">
            <div class="flex items-center justify-between">
              <span class="text-sm font-bold text-gray-300">—</span>
              <span class="text-[10px] text-gray-500">—</span>
            </div>
          </div>
          ${(() => {
            const actif = findMatchingActif(item, placements);
            if (!actif || (!actif.quantite && !actif.pru)) return '';
            const qty = Number(actif.quantite) || 0;
            const pru = Number(actif.pru) || 0;
            const valTotale = Number(actif.valeur) || 0;
            const invested = qty * pru;
            return `
            <div class="mt-2 pt-2 border-t border-dark-400/20 space-y-1 portfolio-info" data-qty="${qty}" data-pru="${pru}" data-invested="${invested}">
              <p class="text-[9px] uppercase tracking-wider text-accent-amber/60 font-semibold mb-0.5">Mon portefeuille</p>
              <div class="flex justify-between text-[11px]">
                <span class="text-accent-amber/70">Parts</span>
                <span class="text-accent-amber font-medium">${Number.isInteger(qty) ? formatNum(qty, 0) : formatNum(qty, 4)}</span>
              </div>
              <div class="flex justify-between text-[11px]">
                <span class="text-accent-amber/70">PRU</span>
                <span class="text-accent-amber font-medium">${formatNum(pru)} €</span>
              </div>
              <div class="flex justify-between text-[11px]">
                <span class="text-accent-amber/70">Valeur totale</span>
                <span class="text-accent-amber font-semibold portfolio-val-totale">${formatNum(valTotale)} €</span>
              </div>
              <div class="flex justify-between text-[11px] portfolio-gain-row" style="display:none">
                <span class="text-accent-amber/70">+/- value</span>
                <span class="font-semibold portfolio-gain-value">—</span>
              </div>
            </div>`;
          })()}
        </div>
        `).join('')}
      </div>

    </div>

    <!-- Modal ajout titre -->
    <div id="modal-add-ticker" class="fixed inset-0 z-50 hidden">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="modal-overlay-add"></div>
      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="relative bg-dark-800 border border-dark-400 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-100">Ajouter un titre</h3>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Code ISIN ou Ticker Yahoo</label>
            <input id="input-isin" type="text" placeholder="Ex: FR0011550185 ou BTC-USD" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
            <p class="text-xs text-gray-600 mt-1">ISIN pour actions/ETF — Ticker Yahoo pour crypto (ex: BTC-USD, ETH-USD, SOL-USD)</p>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Nom (optionnel)</label>
            <input id="input-name" type="text" placeholder="Ex: Lyxor MSCI World" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
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

// Apply prices/text to cards immediately, queue charts for progressive rendering
function applyQuotesToUI(quotesMap, store) {
  const watchlist = loadWatchlist();
  const placements = store?.get?.('actifs.placements') || [];
  let loadedCount = 0;
  const chartQueue = [];

  watchlist.forEach(item => {
    const id = sid(item.isin);
    const quote = quotesMap[item.isin] || null;
    const actif = findMatchingActif(item, placements);
    const pru = actif ? Number(actif.pru) || 0 : 0;

    const card = document.getElementById(`quote-${id}`);
    if (!card) return;

    const tickerLabel = card.querySelector('.quote-ticker-label');
    if (tickerLabel && quote?.ticker) tickerLabel.textContent = quote.ticker;

    const priceDiv = card.querySelector('.quote-price');
    if (quote) {
      loadedCount++;
      const isUp = pru > 0 ? quote.price >= pru : quote.change >= 0;

      // Queue chart rendering instead of doing it synchronously
      if (quote.chartPoints && quote.chartPoints.length > 1) {
        chartQueue.push({ canvasId: `chart-${id}`, chartPoints: quote.chartPoints, isUp, pru: pru > 0 ? pru : null });
      }

      const dayUp = quote.change >= 0;
      priceDiv.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-lg font-bold ${isUp ? 'text-accent-green' : 'text-red-500'}">${formatPrice(quote.price, quote.currency)}</span>
          <span class="text-xs font-medium ${dayUp ? 'text-accent-green' : 'text-red-500'}">
            ${dayUp ? '▲' : '▼'} ${dayUp ? '+' : ''}${quote.changePct.toFixed(2)}%
          </span>
        </div>
      `;

      const portfolioInfo = card.querySelector('.portfolio-info');
      if (portfolioInfo) {
        const qty = Number(portfolioInfo.dataset.qty) || 0;
        const invested = Number(portfolioInfo.dataset.invested) || 0;
        if (qty > 0 && invested > 0) {
          const liveValue = qty * quote.price;
          const gain = liveValue - invested;
          const gainPct = (gain / invested) * 100;
          const gainPositive = gain >= 0;
          const sym = quote.currency === 'USD' ? '$' : '€';

          const valEl = portfolioInfo.querySelector('.portfolio-val-totale');
          if (valEl) valEl.textContent = `${formatNum(liveValue)} ${sym}`;

          const gainRow = portfolioInfo.querySelector('.portfolio-gain-row');
          const gainVal = portfolioInfo.querySelector('.portfolio-gain-value');
          if (gainRow && gainVal) {
            gainRow.style.display = '';
            gainVal.className = `font-semibold ${gainPositive ? 'text-accent-green' : 'text-accent-red'}`;
            gainVal.textContent = `${gainPositive ? '+' : ''}${formatNum(gain)} ${sym} (${gainPositive ? '+' : ''}${gainPct.toFixed(1)}%)`;
          }
        }
      }
    } else {
      priceDiv.innerHTML = `<p class="text-sm text-accent-amber/60">Erreur de chargement</p>`;
    }
  });

  // Render charts progressively — one per animation frame to avoid UI freeze
  renderChartsProgressively(chartQueue);

  return loadedCount;
}

function renderChartsProgressively(queue) {
  let i = 0;
  function next() {
    if (i >= queue.length) return;
    const { canvasId, chartPoints, isUp, pru } = queue[i++];
    renderMiniChart(canvasId, chartPoints, isUp, pru);
    requestAnimationFrame(next);
  }
  requestAnimationFrame(next);
}

function updateStatus(loadedCount, total, fromCache) {
  const statusEl = document.getElementById('market-status');
  const indicatorEl = document.getElementById('market-indicator');
  const nextSlot = getNextSlotTime();
  const nextStr = nextSlot.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const cache = loadQuotesCache();
  const lastUpdate = cache?.timestamp ? new Date(cache.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

  if (statusEl) {
    statusEl.textContent = `${loadedCount}/${total} cours${fromCache ? ' (cache)' : ''} — MAJ : ${lastUpdate} — Prochaine : ${nextStr}`;
  }
  if (indicatorEl) {
    indicatorEl.className = loadedCount > 0
      ? `w-2 h-2 rounded-full ${fromCache ? 'bg-accent-amber' : 'bg-accent-green'}`
      : 'w-2 h-2 rounded-full bg-red-500';
  }
}

async function loadAllQuotes(store, forceRefresh = false) {
  const watchlist = loadWatchlist();
  const statusEl = document.getElementById('market-status');

  // Try cache first
  if (!forceRefresh && isCacheFresh()) {
    const cache = loadQuotesCache();
    if (cache?.data) {
      if (statusEl) statusEl.textContent = 'Chargement depuis le cache...';
      const count = applyQuotesToUI(cache.data, store);
      updateStatus(count, watchlist.length, true);
      return;
    }
  }

  if (statusEl) statusEl.textContent = 'Chargement des cours...';

  let quotesMap = {};

  // Try batch fetch first (2 API calls for all tickers)
  try {
    quotesMap = await fetchAllQuotesBatch(watchlist);
  } catch (e) {
    console.warn('Batch fetch failed, falling back to individual:', e);
  }

  // Fallback: fetch individually for any missing tickers
  const missing = watchlist.filter(item => !quotesMap[item.isin]);
  if (missing.length > 0) {
    const fallbackResults = await Promise.allSettled(
      missing.map(item => fetchQuoteWithHistory(item.isin))
    );
    fallbackResults.forEach((result, j) => {
      if (result.status === 'fulfilled' && result.value) {
        quotesMap[missing[j].isin] = result.value;
      }
    });
  }

  // Save to cache
  if (Object.keys(quotesMap).length > 0) {
    saveQuotesCache(quotesMap);
  }

  const count = applyQuotesToUI(quotesMap, store);
  updateStatus(count, watchlist.length, false);
}

export function mount(store, navigate) {
  loadAllQuotes(store);

  document.getElementById('btn-refresh-quotes')?.addEventListener('click', () => {
    loadAllQuotes(store, true);
  });

  // Open add modal
  const modal = document.getElementById('modal-add-ticker');
  document.getElementById('btn-add-ticker')?.addEventListener('click', () => {
    modal?.classList.remove('hidden');
  });
  document.getElementById('btn-cancel-add')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  // Auto-detect type from ticker input
  document.getElementById('input-isin')?.addEventListener('input', (e) => {
    const val = e.target.value.trim().toUpperCase();
    const typeSelect = document.getElementById('input-type');
    if (typeSelect && val.includes('-USD') || val.includes('-EUR')) {
      typeSelect.value = 'Crypto';
    }
  });

  // Confirm add
  document.getElementById('btn-confirm-add')?.addEventListener('click', () => {
    const isin = document.getElementById('input-isin')?.value?.trim();
    if (!isin) return;
    const name = document.getElementById('input-name')?.value?.trim() || isin;
    const type = document.getElementById('input-type')?.value || 'ETF';

    const watchlist = loadWatchlist();
    if (watchlist.some(w => w.isin.toLowerCase() === isin.toLowerCase())) {
      alert('Ce titre est déjà dans votre liste.');
      return;
    }

    watchlist.push({ isin, name, type });
    saveWatchlist(watchlist);
    modal?.classList.add('hidden');
    navigate('bourse');
  });

  // Remove ticker
  document.querySelectorAll('.btn-remove-ticker').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isin = btn.dataset.isin;
      const watchlist = loadWatchlist();
      const updated = watchlist.filter(w => w.isin !== isin);
      if (updated.length < watchlist.length) {
        saveWatchlist(updated);
        navigate('bourse');
      }
    });
  });

  // Move up / Move down buttons
  document.querySelectorAll('.btn-move-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isin = btn.dataset.isin;
      const watchlist = loadWatchlist();
      const idx = watchlist.findIndex(w => w.isin === isin);
      if (idx > 0) {
        [watchlist[idx - 1], watchlist[idx]] = [watchlist[idx], watchlist[idx - 1]];
        saveWatchlist(watchlist);
        navigate('bourse');
      }
    });
  });

  document.querySelectorAll('.btn-move-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isin = btn.dataset.isin;
      const watchlist = loadWatchlist();
      const idx = watchlist.findIndex(w => w.isin === isin);
      if (idx >= 0 && idx < watchlist.length - 1) {
        [watchlist[idx], watchlist[idx + 1]] = [watchlist[idx + 1], watchlist[idx]];
        saveWatchlist(watchlist);
        navigate('bourse');
      }
    });
  });

  // Drag and drop reordering
  const grid = document.getElementById('quotes-grid');
  if (grid) {
    let draggedEl = null;

    grid.addEventListener('dragstart', (e) => {
      const card = e.target.closest('[draggable="true"]');
      if (!card) return;
      draggedEl = card;
      card.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragend', (e) => {
      const card = e.target.closest('[draggable="true"]');
      if (card) card.style.opacity = '1';
      grid.querySelectorAll('[draggable="true"]').forEach(c => c.classList.remove('ring', 'ring-accent-amber/40'));
      draggedEl = null;
    });

    grid.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('[draggable="true"]');
      if (target && target !== draggedEl) {
        grid.querySelectorAll('[draggable="true"]').forEach(c => c.classList.remove('ring', 'ring-accent-amber/40'));
        target.classList.add('ring', 'ring-accent-amber/40');
      }
    });

    grid.addEventListener('dragleave', (e) => {
      const target = e.target.closest('[draggable="true"]');
      if (target) target.classList.remove('ring', 'ring-accent-amber/40');
    });

    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      const target = e.target.closest('[draggable="true"]');
      if (!target || !draggedEl || target === draggedEl) return;
      target.classList.remove('ring', 'ring-accent-amber/40');

      // Swap positions in DOM
      const allCards = [...grid.querySelectorAll('[draggable="true"]')];
      const fromIdx = allCards.indexOf(draggedEl);
      const toIdx = allCards.indexOf(target);
      if (fromIdx < 0 || toIdx < 0) return;

      if (fromIdx < toIdx) {
        grid.insertBefore(draggedEl, target.nextSibling);
      } else {
        grid.insertBefore(draggedEl, target);
      }

      // Persist new order
      const watchlist = loadWatchlist();
      const reordered = [...grid.querySelectorAll('[draggable="true"]')].map(card => {
        const isin = card.dataset.isin;
        return watchlist.find(w => w.isin === isin);
      }).filter(Boolean);
      saveWatchlist(reordered);
    });
  }
}
