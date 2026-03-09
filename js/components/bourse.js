const WATCHLIST = [
  { isin: 'FR0011550185', ticker: 'EWLD.PA', name: 'Lyxor PEA MSCI World', type: 'ETF' },
  { isin: 'FR0011550193', ticker: 'PSP5.PA', name: 'Lyxor PEA S&P 500', type: 'ETF' },
  { isin: 'FR0013412020', ticker: 'PAEEM.PA', name: 'Amundi PEA Emerging Markets', type: 'ETF' },
  { isin: 'IE00BK5BQT80', ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World', type: 'ETF' },
  { isin: null, ticker: 'AI.PA', name: 'Air Liquide', type: 'Action' },
  { isin: null, ticker: 'SU.PA', name: 'Schneider Electric', type: 'Action' },
  { isin: null, ticker: 'LR.PA', name: 'Legrand', type: 'Action' },
  { isin: null, ticker: 'BTC-USD', name: 'Bitcoin', type: 'Crypto' }
];

async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const closes = data.chart.result[0].indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter(c => c !== null);
    const currentPrice = meta.regularMarketPrice || validCloses[validCloses.length - 1] || 0;
    const previousClose = meta.chartPreviousClose || meta.previousClose || validCloses[validCloses.length - 2] || currentPrice;
    const change = currentPrice - previousClose;
    const changePct = previousClose ? (change / previousClose) * 100 : 0;
    const currency = meta.currency || 'EUR';

    return {
      price: currentPrice,
      previousClose,
      change,
      changePct,
      currency,
      marketState: meta.currentTradingPeriod?.regular ? 'regular' : 'closed'
    };
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

export function render(store) {
  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-100">Bourse Live</h1>
        <button id="btn-refresh-quotes" class="px-4 py-2 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Actualiser
        </button>
      </div>

      <div class="card-dark rounded-xl p-4">
        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <div class="w-2 h-2 rounded-full bg-accent-green animate-pulse" id="market-indicator"></div>
          <span id="market-status">Chargement des cours...</span>
        </div>
      </div>

      <!-- Quotes grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="quotes-grid">
        ${WATCHLIST.map(item => `
        <div class="card-dark rounded-xl p-5 kpi-card" id="quote-${item.ticker.replace(/[^a-zA-Z0-9]/g, '')}">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs px-2 py-0.5 rounded-full ${item.type === 'ETF' ? 'bg-accent-green/10 text-accent-green' : item.type === 'Crypto' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'}">${item.type}</span>
            <span class="text-xs text-gray-600">${item.ticker}</span>
          </div>
          <p class="text-sm font-medium text-gray-200 mb-1 truncate">${item.name}</p>
          ${item.isin ? `<p class="text-xs text-gray-600 mb-2">${item.isin}</p>` : '<p class="text-xs text-gray-600 mb-2">&nbsp;</p>'}
          <div class="quote-price">
            <p class="text-2xl font-bold text-gray-300">—</p>
            <p class="text-sm text-gray-500 mt-1">—</p>
          </div>
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
              </tr>
            </thead>
            <tbody id="quotes-table-body" class="divide-y divide-dark-400/20">
              ${WATCHLIST.map(item => `
              <tr class="hover:bg-dark-600/30 transition" id="row-${item.ticker.replace(/[^a-zA-Z0-9]/g, '')}">
                <td class="px-5 py-3 font-medium text-gray-200">${item.name}</td>
                <td class="px-5 py-3 text-gray-400">${item.ticker}</td>
                <td class="px-5 py-3"><span class="text-xs px-2 py-0.5 rounded-full ${item.type === 'ETF' ? 'bg-accent-green/10 text-accent-green' : item.type === 'Crypto' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'}">${item.type}</span></td>
                <td class="px-5 py-3 text-right font-medium text-gray-300 quote-cell-price">—</td>
                <td class="px-5 py-3 text-right quote-cell-change">—</td>
                <td class="px-5 py-3 text-right text-gray-500 quote-cell-prev">—</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function loadAllQuotes() {
  const statusEl = document.getElementById('market-status');
  const indicatorEl = document.getElementById('market-indicator');

  if (statusEl) statusEl.textContent = 'Chargement des cours...';

  const results = await Promise.allSettled(
    WATCHLIST.map(item => fetchQuote(item.ticker))
  );

  let loadedCount = 0;

  results.forEach((result, i) => {
    const item = WATCHLIST[i];
    const safeId = item.ticker.replace(/[^a-zA-Z0-9]/g, '');
    const quote = result.status === 'fulfilled' ? result.value : null;

    // Update card
    const card = document.getElementById(`quote-${safeId}`);
    if (card) {
      const priceDiv = card.querySelector('.quote-price');
      if (quote) {
        loadedCount++;
        const isUp = quote.change >= 0;
        priceDiv.innerHTML = `
          <p class="text-2xl font-bold ${isUp ? 'text-accent-green' : 'text-accent-red'}">${formatPrice(quote.price, quote.currency)}</p>
          <p class="text-sm mt-1 ${isUp ? 'text-accent-green' : 'text-accent-red'}">
            ${isUp ? '▲' : '▼'} ${isUp ? '+' : ''}${quote.change.toFixed(2)} (${isUp ? '+' : ''}${quote.changePct.toFixed(2)}%)
          </p>
        `;
      } else {
        priceDiv.innerHTML = `<p class="text-sm text-accent-red/60">Erreur de chargement</p>`;
      }
    }

    // Update table row
    const row = document.getElementById(`row-${safeId}`);
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
    statusEl.textContent = `${loadedCount}/${WATCHLIST.length} cours chargés — Dernière mise à jour : ${now}`;
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
}
