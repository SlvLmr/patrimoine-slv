import { createChart, createVerticalGradient } from '../charts/chart-config.js';

const WATCHLIST_STORAGE_KEY = 'patrimoine-slv-watchlist';

const DEFAULT_WATCHLIST = [
  { isin: 'FR0011550185', ticker: 'EWLD.PA', name: 'Lyxor PEA MSCI World', type: 'ETF' },
  { isin: 'FR0011550193', ticker: 'PSP5.PA', name: 'Lyxor PEA S&P 500', type: 'ETF' },
  { isin: 'FR0013412020', ticker: 'PAEEM.PA', name: 'Amundi PEA Emerging Markets', type: 'ETF' },
  { isin: 'IE00BK5BQT80', ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World', type: 'ETF' },
  { isin: null, ticker: 'AI.PA', name: 'Air Liquide', type: 'Action' },
  { isin: null, ticker: 'SU.PA', name: 'Schneider Electric', type: 'Action' },
  { isin: null, ticker: 'LR.PA', name: 'Legrand', type: 'Action' },
  { isin: null, ticker: 'BTC-USD', name: 'Bitcoin', type: 'Crypto' }
];

function loadWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_WATCHLIST.map(w => ({ ...w }));
}

function saveWatchlist(list) {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(list));
}

function sid(ticker) {
  return ticker.replace(/[^a-zA-Z0-9]/g, '');
}

async function fetchQuoteWithHistory(ticker) {
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

    return { price: currentPrice, previousClose, change, changePct, currency, chartPoints };
  } catch (e) {
    console.error(`Failed to fetch ${ticker}:`, e);
    return null;
  }
}

function formatPrice(value, currency) {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', minimumFractionDigits: 2 }).format(value);
}

function renderMiniChart(canvasId, chartPoints, isUp) {
  const color = isUp ? '#c9a76c' : '#b8976c';
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
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
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
        y: { display: false }
      }
    }
  });
}

function findMatchingActif(item, placements) {
  if (!placements || !placements.length) return null;
  const tickerLower = item.ticker?.toLowerCase() || '';
  const isinLower = item.isin?.toLowerCase() || '';
  return placements.find(p => {
    const pIsin = (p.isin || '').toLowerCase();
    const pNom = (p.nom || '').toLowerCase();
    if (isinLower && pIsin && pIsin.includes(isinLower)) return true;
    if (isinLower && pIsin && isinLower.includes(pIsin)) return true;
    if (tickerLower && pIsin && pIsin.includes(tickerLower)) return true;
    if (tickerLower && pNom && pNom.includes(tickerLower.split('.')[0])) return true;
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
        <div class="card-dark rounded-xl p-5 kpi-card relative group" id="quote-${sid(item.ticker)}">
          <button class="btn-remove-ticker absolute top-2 right-2 w-6 h-6 rounded-full bg-dark-600/80 text-gray-500 hover:bg-accent-red/20 hover:text-accent-red transition opacity-0 group-hover:opacity-100 flex items-center justify-center" data-ticker="${item.ticker}" title="Retirer">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs px-2 py-0.5 rounded-full ${item.type === 'ETF' ? 'bg-accent-green/10 text-accent-green' : item.type === 'Crypto' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'}">${item.type}</span>
            <span class="text-xs text-gray-600">${item.ticker}</span>
          </div>
          <p class="text-sm font-medium text-gray-200 mb-1 truncate">${item.name}</p>
          ${item.isin ? `<p class="text-xs text-gray-600 mb-2">${item.isin}</p>` : '<p class="text-xs text-gray-600 mb-2">&nbsp;</p>'}
          <div class="quote-chart mb-2" style="height:80px">
            <canvas id="chart-${sid(item.ticker)}"></canvas>
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
              <p class="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1">Mon portefeuille</p>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Parts</span>
                <span class="text-gray-300 font-medium">${formatNum(qty, 4)}</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">PRU</span>
                <span class="text-gray-300 font-medium">${formatNum(pru)} €</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Valeur totale</span>
                <span class="text-accent-green font-semibold">${formatNum(valTotale)} €</span>
              </div>
            </div>`;
          })()}
        </div>
        `).join('')}
      </div>

      <!-- Detailed table -->
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-5 border-b border-dark-400/30">
          <h2 class="text-lg font-semibold text-gray-200">Détail des cotations</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-dark-800/50 text-gray-500">
              <tr>
                <th class="px-5 py-3 text-left">Nom</th>
                <th class="px-5 py-3 text-left">Ticker</th>
                <th class="px-5 py-3 text-left">Type</th>
                <th class="px-5 py-3 text-right">Cours</th>
                <th class="px-5 py-3 text-right">Variation</th>
                <th class="px-5 py-3 text-right">Clôture préc.</th>
                <th class="px-5 py-3 text-right">Parts</th>
                <th class="px-5 py-3 text-right">PRU</th>
                <th class="px-5 py-3 text-right">Valeur totale</th>
              </tr>
            </thead>
            <tbody id="quotes-table-body" class="divide-y divide-dark-400/20">
              ${watchlist.map(item => {
                const actif = findMatchingActif(item, placements);
                const qty = actif ? Number(actif.quantite) || 0 : 0;
                const pru = actif ? Number(actif.pru) || 0 : 0;
                const valTotale = actif ? Number(actif.valeur) || 0 : 0;
                return `
              <tr class="hover:bg-dark-600/30 transition" id="row-${sid(item.ticker)}">
                <td class="px-5 py-3 font-medium text-gray-200">${item.name}</td>
                <td class="px-5 py-3 text-gray-400">${item.ticker}</td>
                <td class="px-5 py-3"><span class="text-xs px-2 py-0.5 rounded-full ${item.type === 'ETF' ? 'bg-accent-green/10 text-accent-green' : item.type === 'Crypto' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'}">${item.type}</span></td>
                <td class="px-5 py-3 text-right font-medium text-gray-300 quote-cell-price">—</td>
                <td class="px-5 py-3 text-right quote-cell-change">—</td>
                <td class="px-5 py-3 text-right text-gray-500 quote-cell-prev">—</td>
                <td class="px-5 py-3 text-right text-gray-300">${qty ? formatNum(qty, 4) : '<span class="text-gray-600">—</span>'}</td>
                <td class="px-5 py-3 text-right text-gray-300">${pru ? formatNum(pru) + ' €' : '<span class="text-gray-600">—</span>'}</td>
                <td class="px-5 py-3 text-right font-medium ${valTotale ? 'text-accent-green' : 'text-gray-600'}">${valTotale ? formatNum(valTotale) + ' €' : '—'}</td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal ajout titre -->
    <div id="modal-add-ticker" class="fixed inset-0 z-50 hidden">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" id="modal-overlay-add"></div>
      <div class="flex items-center justify-center min-h-screen p-4">
        <div class="relative bg-dark-800 border border-dark-400 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <h3 class="text-lg font-semibold text-gray-100">Ajouter un titre</h3>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Ticker Yahoo Finance</label>
            <input id="input-ticker" type="text" placeholder="Ex: EWLD.PA, AAPL, BTC-USD" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
            <p class="text-xs text-gray-600 mt-1">Format : ticker Yahoo (ex: EWLD.PA pour Euronext Paris)</p>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Nom (optionnel)</label>
            <input id="input-name" type="text" placeholder="Ex: Lyxor MSCI World" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">ISIN (optionnel)</label>
            <input id="input-isin" type="text" placeholder="Ex: FR0011550185" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
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

async function loadAllQuotes() {
  const watchlist = loadWatchlist();
  const statusEl = document.getElementById('market-status');
  const indicatorEl = document.getElementById('market-indicator');

  if (statusEl) statusEl.textContent = 'Chargement des cours...';

  const results = await Promise.allSettled(
    watchlist.map(item => fetchQuoteWithHistory(item.ticker))
  );

  let loadedCount = 0;

  results.forEach((result, i) => {
    const item = watchlist[i];
    const id = sid(item.ticker);
    const quote = result.status === 'fulfilled' ? result.value : null;

    const card = document.getElementById(`quote-${id}`);
    if (card) {
      const priceDiv = card.querySelector('.quote-price');
      if (quote) {
        loadedCount++;
        const isUp = quote.change >= 0;

        // Mini chart
        if (quote.chartPoints && quote.chartPoints.length > 1) {
          renderMiniChart(`chart-${id}`, quote.chartPoints, isUp);
        }

        priceDiv.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-lg font-bold ${isUp ? 'text-accent-green' : 'text-accent-red'}">${formatPrice(quote.price, quote.currency)}</span>
            <span class="text-xs font-medium ${isUp ? 'text-accent-green' : 'text-accent-red'}">
              ${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${quote.changePct.toFixed(2)}%
            </span>
          </div>
        `;
      } else {
        priceDiv.innerHTML = `<p class="text-sm text-accent-red/60">Erreur de chargement</p>`;
      }
    }

    const row = document.getElementById(`row-${id}`);
    if (row && quote) {
      const isUp = quote.change >= 0;
      row.querySelector('.quote-cell-price').innerHTML = `<span class="font-medium text-gray-200">${formatPrice(quote.price, quote.currency)}</span>`;
      row.querySelector('.quote-cell-change').innerHTML = `
        <span class="${isUp ? 'text-accent-green' : 'text-accent-red'} font-medium">
          ${isUp ? '+' : ''}${quote.change.toFixed(2)} (${isUp ? '+' : ''}${quote.changePct.toFixed(2)}%)
        </span>`;
      row.querySelector('.quote-cell-prev').textContent = formatPrice(quote.previousClose, quote.currency);
    }
  });

  if (statusEl) {
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    statusEl.textContent = `${loadedCount}/${watchlist.length} cours chargés — Dernière mise à jour : ${now}`;
  }
  if (indicatorEl) {
    indicatorEl.className = loadedCount > 0
      ? 'w-2 h-2 rounded-full bg-accent-green'
      : 'w-2 h-2 rounded-full bg-accent-red';
  }
}

export function mount(store, navigate) {
  loadAllQuotes();

  document.getElementById('btn-refresh-quotes')?.addEventListener('click', () => {
    loadAllQuotes();
  });

  // Open add modal
  const modal = document.getElementById('modal-add-ticker');
  document.getElementById('btn-add-ticker')?.addEventListener('click', () => {
    modal?.classList.remove('hidden');
  });
  document.getElementById('modal-overlay-add')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });
  document.getElementById('btn-cancel-add')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  // Confirm add
  document.getElementById('btn-confirm-add')?.addEventListener('click', () => {
    const ticker = document.getElementById('input-ticker')?.value?.trim();
    if (!ticker) return;
    const name = document.getElementById('input-name')?.value?.trim() || ticker;
    const isin = document.getElementById('input-isin')?.value?.trim() || null;
    const type = document.getElementById('input-type')?.value || 'ETF';

    const watchlist = loadWatchlist();
    if (watchlist.some(w => w.ticker.toLowerCase() === ticker.toLowerCase())) {
      alert('Ce ticker est déjà dans votre liste.');
      return;
    }

    watchlist.push({ isin, ticker, name, type });
    saveWatchlist(watchlist);
    modal?.classList.add('hidden');
    navigate('bourse');
  });

  // Remove ticker
  document.querySelectorAll('.btn-remove-ticker').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticker = btn.dataset.ticker;
      const watchlist = loadWatchlist();
      const updated = watchlist.filter(w => w.ticker !== ticker);
      if (updated.length < watchlist.length) {
        saveWatchlist(updated);
        navigate('bourse');
      }
    });
  });
}
