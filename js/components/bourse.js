import { createChart, createVerticalGradient } from '../charts/chart-config.js';

const WATCHLIST_STORAGE_KEY = 'patrimoine-slv-watchlist';

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

// Resolve ISIN or ticker to Yahoo Finance ticker via search API
const tickerCache = {};
async function resolveIsinToTicker(identifier) {
  if (tickerCache[identifier]) return tickerCache[identifier];

  // If it's not an ISIN, treat it as a direct Yahoo ticker
  if (!isIsin(identifier)) {
    tickerCache[identifier] = identifier.toUpperCase();
    return identifier.toUpperCase();
  }

  try {
    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(identifier)}&quotesCount=1&newsCount=0`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(searchUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    const quote = data.quotes?.[0];
    if (quote?.symbol) {
      tickerCache[identifier] = quote.symbol;
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
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
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
  if (!isinLower) return null;
  return placements.find(p => {
    const pIsin = (p.isin || '').toLowerCase();
    const pNom = (p.nom || '').toLowerCase();
    if (pIsin && (pIsin.includes(isinLower) || isinLower.includes(pIsin))) return true;
    if (pNom && pNom.includes(item.name?.toLowerCase()?.split(' ')[0] || '___')) return true;
    return false;
  }) || null;
}

function formatNum(v, decimals = 2) {
  return Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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

      <div class="card-dark rounded-xl p-4">
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <div class="w-2 h-2 rounded-full bg-accent-green animate-pulse" id="market-indicator"></div>
          <span id="market-status">Chargement des cours...</span>
        </div>
      </div>

      <!-- Quotes grid with mini charts -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="quotes-grid">
        ${watchlist.map(item => `
        <div class="card-dark rounded-xl p-5 kpi-card relative group" id="quote-${sid(item.isin)}" draggable="true" data-isin="${item.isin}" style="cursor:grab">
          <button class="btn-remove-ticker absolute top-2 right-2 w-6 h-6 rounded-full bg-dark-600/80 text-gray-500 hover:bg-accent-amber/20 hover:text-accent-amber transition opacity-0 group-hover:opacity-100 flex items-center justify-center z-10" data-isin="${item.isin}" title="Retirer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs px-2 py-0.5 rounded-full ${item.type === 'ETF' ? 'bg-accent-green/10 text-accent-green' : item.type === 'Crypto' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'}">${item.type}</span>
            <span class="text-xs text-gray-600 quote-ticker-label">—</span>
          </div>
          <p class="text-sm font-medium text-gray-200 mb-1 truncate">${item.name}</p>
          <p class="text-xs text-gray-600 mb-2">${item.isin}</p>
          <div class="quote-chart mb-2" style="height:80px">
            <canvas id="chart-${sid(item.isin)}"></canvas>
          </div>
          <div class="quote-price">
            <div class="flex items-center justify-between">
              <span class="text-lg font-bold text-gray-300">—</span>
              <span class="text-xs text-gray-500">—</span>
            </div>
          </div>
          ${(() => {
            const actif = findMatchingActif(item, placements);
            if (!actif || (!actif.quantite && !actif.pru)) return '';
            const qty = Number(actif.quantite) || 0;
            const pru = Number(actif.pru) || 0;
            const valTotale = Number(actif.valeur) || 0;
            return `
            <div class="mt-3 pt-3 border-t border-dark-400/20 space-y-1.5 portfolio-info">
              <p class="text-[10px] uppercase tracking-wider text-accent-amber/60 font-semibold mb-1">Mon portefeuille</p>
              <div class="flex justify-between text-xs">
                <span class="text-accent-amber/70">Parts</span>
                <span class="text-accent-amber font-medium">${Number.isInteger(qty) ? formatNum(qty, 0) : formatNum(qty, 4)}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-accent-amber/70">PRU</span>
                <span class="text-accent-amber font-medium">${formatNum(pru)} €</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-accent-amber/70">Valeur totale</span>
                <span class="text-accent-amber font-semibold">${formatNum(valTotale)} €</span>
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

async function loadAllQuotes(store) {
  const watchlist = loadWatchlist();
  const placements = store?.get?.('actifs.placements') || [];
  const statusEl = document.getElementById('market-status');
  const indicatorEl = document.getElementById('market-indicator');

  if (statusEl) statusEl.textContent = 'Chargement des cours...';

  const results = await Promise.allSettled(
    watchlist.map(item => fetchQuoteWithHistory(item.isin))
  );

  let loadedCount = 0;

  results.forEach((result, i) => {
    const item = watchlist[i];
    const id = sid(item.isin);
    const quote = result.status === 'fulfilled' ? result.value : null;
    const actif = findMatchingActif(item, placements);
    const pru = actif ? Number(actif.pru) || 0 : 0;

    const card = document.getElementById(`quote-${id}`);
    if (card) {
      // Show resolved ticker
      const tickerLabel = card.querySelector('.quote-ticker-label');
      if (tickerLabel && quote?.ticker) {
        tickerLabel.textContent = quote.ticker;
      }

      const priceDiv = card.querySelector('.quote-price');
      if (quote) {
        loadedCount++;
        // Chart color: green if in profit (price > PRU), red if at loss
        const isUp = pru > 0 ? quote.price >= pru : quote.change >= 0;

        // Mini chart with PRU line
        if (quote.chartPoints && quote.chartPoints.length > 1) {
          renderMiniChart(`chart-${id}`, quote.chartPoints, isUp, pru > 0 ? pru : null);
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
      } else {
        priceDiv.innerHTML = `<p class="text-sm text-accent-amber/60">Erreur de chargement</p>`;
      }
    }

  });

  if (statusEl) {
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    statusEl.textContent = `${loadedCount}/${watchlist.length} cours chargés — Dernière mise à jour : ${now}`;
  }
  if (indicatorEl) {
    indicatorEl.className = loadedCount > 0
      ? 'w-2 h-2 rounded-full bg-accent-green'
      : 'w-2 h-2 rounded-full bg-accent-amber';
  }
}

export function mount(store, navigate) {
  loadAllQuotes(store);

  document.getElementById('btn-refresh-quotes')?.addEventListener('click', () => {
    loadAllQuotes(store);
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
