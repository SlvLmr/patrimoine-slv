// ============================================================================
// BOURSE — Suivi de marché via TradingView (aucun proxy, charts instantanés)
// ============================================================================

const WATCHLIST_STORAGE_KEY = 'patrimoine-slv-watchlist';

// ISIN → TradingView symbol mapping
const KNOWN_TV_SYMBOLS = {
  // French stocks (Euronext Paris)
  'FR0000120073': 'EURONEXT:AI',      // Air Liquide
  'FR0000121972': 'EURONEXT:SU',      // Schneider Electric
  'FR0010307819': 'EURONEXT:LR',      // Legrand
  'FR0000131104': 'EURONEXT:BNP',     // BNP Paribas
  'FR0000120271': 'EURONEXT:TTE',     // TotalEnergies
  'FR0000121014': 'EURONEXT:MC',      // LVMH
  'FR0000120321': 'EURONEXT:OR',      // L'Oréal
  'FR0000125007': 'EURONEXT:SGO',     // Saint-Gobain
  'FR0000125338': 'EURONEXT:CAP',     // Capgemini
  'FR0000130809': 'EURONEXT:SAN',     // Sanofi
  'FR0000127771': 'EURONEXT:VIV',     // Vivendi
  'FR0000120578': 'EURONEXT:SAF',     // Safran
  'FR0000073272': 'EURONEXT:SAF',     // Safran (alternate)
  'FR0000051807': 'EURONEXT:TEP',     // Teleperformance
  'FR0010220475': 'EURONEXT:CW8',     // Amundi MSCI World
  // PEA ETFs (Euronext Paris)
  'FR0011550185': 'EURONEXT:EWLD',    // Lyxor PEA MSCI World
  'FR0011550193': 'EURONEXT:PSP5',    // Lyxor PEA S&P 500
  'FR0013412020': 'EURONEXT:PAEEM',   // Amundi PEA Emerging Markets
  'FR0011869353': 'EURONEXT:PUST',    // Lyxor PEA Nasdaq-100
  'FR0013412038': 'EURONEXT:PCEU',    // Amundi PEA MSCI Europe
  'FR0011550177': 'EURONEXT:PTPXE',   // Lyxor PEA Japan Topix
  'LU1681043599': 'EURONEXT:CW8',     // Amundi MSCI World (alt ISIN)
  'LU0392494562': 'XETR:MWRD',       // ComStage MSCI World
  // International ETFs
  'IE00BK5BQT80': 'LSE:VWRA',        // Vanguard FTSE All-World
  'IE00B4L5Y983': 'XETR:EUNL',       // iShares Core MSCI World
  'IE00B3RBWM25': 'LSE:VWRL',        // Vanguard FTSE All-World (Dist)
  'IE00BJ0KDQ92': 'LSE:VUSA',        // Vanguard S&P 500
  'IE00B5BMR087': 'LSE:CSPX',        // iShares Core S&P 500
  'IE00B4L5YC18': 'XETR:IS3N',       // iShares Core EM
};

// Persistent user-defined symbol overrides (for custom entries)
const TV_SYMBOL_CACHE_KEY = 'patrimoine-slv-tv-symbols';
function loadTVSymbolCache() {
  try { return JSON.parse(localStorage.getItem(TV_SYMBOL_CACHE_KEY) || '{}'); } catch { return {}; }
}
function saveTVSymbolCache(cache) {
  localStorage.setItem(TV_SYMBOL_CACHE_KEY, JSON.stringify(cache));
}

function resolveToTVSymbol(identifier) {
  const upper = (identifier || '').toUpperCase().trim();
  if (!upper) return null;

  // Known ISIN mapping
  if (KNOWN_TV_SYMBOLS[upper]) return KNOWN_TV_SYMBOLS[upper];

  // User-defined override
  const userCache = loadTVSymbolCache();
  if (userCache[upper]) return userCache[upper];

  // Crypto tickers (BTC-USD → CRYPTO:BTCUSD)
  if (upper.endsWith('-USD')) return `CRYPTO:${upper.replace('-USD', 'USD')}`;
  if (upper.endsWith('-EUR')) return `CRYPTO:${upper.replace('-EUR', 'EUR')}`;

  // Already a TradingView symbol (contains ':')
  if (upper.includes(':')) return upper;

  // Yahoo-style ticker (.PA → EURONEXT:, .L → LSE:, .AS → XETR:)
  if (upper.endsWith('.PA')) return `EURONEXT:${upper.replace('.PA', '')}`;
  if (upper.endsWith('.L')) return `LSE:${upper.replace('.L', '')}`;
  if (upper.endsWith('.AS')) return `XETR:${upper.replace('.AS', '')}`;
  if (upper.endsWith('.DE')) return `XETR:${upper.replace('.DE', '')}`;

  // Bare ticker — try as-is (TradingView will resolve)
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

// No-op exports for app.js compatibility (background refresh no longer needed)
export async function backgroundRefresh() {}
export function getNextRefreshTime() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
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
          <p class="text-gray-500 text-sm mt-1">Cours et graphiques en temps réel via TradingView</p>
        </div>
        <button id="btn-add-ticker" class="px-4 py-2 bg-dark-600 border border-dark-400 text-gray-300 text-sm rounded-lg hover:bg-dark-500 transition font-medium flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Ajouter un titre
        </button>
      </div>

      <!-- Graphique principal TradingView -->
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="flex items-center gap-2 px-4 py-3 border-b border-dark-400/20">
          <div class="w-2 h-2 rounded-full bg-accent-green animate-pulse"></div>
          <span class="text-xs text-gray-400">Cliquez sur un titre pour afficher son graphique</span>
          <span class="text-[10px] text-gray-600 ml-auto" id="active-symbol-label">—</span>
        </div>
        <div id="tv-main-chart" style="height:420px"></div>
      </div>

      <!-- Grille des titres -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" id="quotes-grid">
        ${watchlist.map((item, idx) => {
          const tvSymbol = resolveToTVSymbol(item.isin);
          const actif = findMatchingActif(item, placements);
          const hasPortfolio = actif && (actif.quantite || actif.pru);

          return `
          <div class="card-dark rounded-xl p-3 cursor-pointer relative group hover:ring-1 hover:ring-accent-green/30 transition ticker-card ${idx === 0 ? 'ring-1 ring-accent-green/40' : ''}"
               data-isin="${item.isin}" data-tv-symbol="${tvSymbol || ''}" data-name="${item.name}">
            <div class="absolute top-1.5 right-1.5 flex items-center gap-0.5 z-10 opacity-0 group-hover:opacity-100 transition">
              <button class="btn-move-up w-5 h-5 rounded-full bg-dark-600/80 text-gray-500 hover:bg-accent-amber/20 hover:text-accent-amber transition flex items-center justify-center" data-isin="${item.isin}" title="Monter">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
              </button>
              <button class="btn-move-down w-5 h-5 rounded-full bg-dark-600/80 text-gray-500 hover:bg-accent-amber/20 hover:text-accent-amber transition flex items-center justify-center" data-isin="${item.isin}" title="Descendre">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <button class="btn-remove-ticker w-5 h-5 rounded-full bg-dark-600/80 text-gray-500 hover:bg-accent-red/20 hover:text-accent-red transition flex items-center justify-center" data-isin="${item.isin}" title="Retirer">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div class="flex items-center gap-2 mb-2">
              <span class="text-[10px] px-1.5 py-0.5 rounded-full ${item.type === 'ETF' ? 'bg-accent-green/10 text-accent-green' : item.type === 'Crypto' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'}">${item.type}</span>
              <span class="text-[10px] text-gray-600 truncate">${tvSymbol || item.isin}</span>
            </div>
            <p class="text-sm font-medium text-gray-200 truncate">${item.name}</p>

            <!-- Mini widget TradingView -->
            <div id="tv-mini-${sid(item.isin)}" class="mt-2" style="height:120px; overflow:hidden; border-radius:8px;"></div>

            ${hasPortfolio ? (() => {
              const qty = Number(actif.quantite) || 0;
              const pru = Number(actif.pru) || 0;
              const valTotale = Number(actif.valeur) || 0;
              return `
              <div class="mt-2 pt-2 border-t border-dark-400/20 space-y-1">
                <p class="text-[9px] uppercase tracking-wider text-accent-amber/60 font-semibold">Mon portefeuille</p>
                <div class="flex justify-between text-[11px]">
                  <span class="text-accent-amber/70">${Number.isInteger(qty) ? formatNum(qty, 0) : formatNum(qty, 4)} parts</span>
                  <span class="text-accent-amber font-medium">PRU ${formatNum(pru)} €</span>
                </div>
                <div class="flex justify-between text-[11px]">
                  <span class="text-accent-amber/70">Valeur</span>
                  <span class="text-accent-amber font-semibold">${formatNum(valTotale)} €</span>
                </div>
              </div>`;
            })() : ''}
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
            <label class="block text-sm text-gray-400 mb-1">Code ISIN, Ticker, ou Symbole TradingView</label>
            <input id="input-isin" type="text" placeholder="Ex: FR0011550185, AAPL, BTC-USD, EURONEXT:CW8" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
            <p class="text-xs text-gray-600 mt-1">ISIN pour les titres européens — Ticker direct ou symbole TradingView (ex: EURONEXT:AI) pour les autres</p>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Symbole TradingView (optionnel)</label>
            <input id="input-tv-symbol" type="text" placeholder="Ex: EURONEXT:AI, NASDAQ:AAPL, CRYPTO:BTCUSD" class="w-full bg-dark-700 border border-dark-400 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
            <p class="text-xs text-gray-600 mt-1">Si le graphique ne s'affiche pas, entrez le symbole exact TradingView ici</p>
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Nom (optionnel)</label>
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
// TRADINGVIEW WIDGET HELPERS
// ============================================================================

function createTVMiniWidget(containerId, symbol) {
  const container = document.getElementById(containerId);
  if (!container || !symbol) return;

  // Clear any existing widget
  container.innerHTML = '';

  const widgetDiv = document.createElement('div');
  widgetDiv.className = 'tradingview-widget-container__widget';
  widgetDiv.style.width = '100%';
  widgetDiv.style.height = '100%';
  container.appendChild(widgetDiv);

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
  script.async = true;
  script.textContent = JSON.stringify({
    symbol: symbol,
    width: '100%',
    height: '100%',
    locale: 'fr',
    dateRange: '1M',
    colorTheme: 'dark',
    isTransparent: true,
    autosize: true,
    largeChartUrl: ''
  });
  container.appendChild(script);
}

function createTVMainChart(containerId, symbol) {
  const container = document.getElementById(containerId);
  if (!container || !symbol) return;

  container.innerHTML = '';

  const widgetDiv = document.createElement('div');
  widgetDiv.className = 'tradingview-widget-container__widget';
  widgetDiv.style.width = '100%';
  widgetDiv.style.height = '100%';
  container.appendChild(widgetDiv);

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async = true;
  script.textContent = JSON.stringify({
    symbol: symbol,
    width: '100%',
    height: '100%',
    autosize: true,
    interval: 'D',
    timezone: 'Europe/Paris',
    theme: 'dark',
    style: '1',
    locale: 'fr',
    backgroundColor: 'rgba(11, 11, 15, 1)',
    gridColor: 'rgba(42, 42, 47, 0.3)',
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    calendar: false,
    hide_volume: false,
    support_host: 'https://www.tradingview.com'
  });
  container.appendChild(script);
}

// ============================================================================
// MOUNT
// ============================================================================

export function mount(store, navigate) {
  const watchlist = loadWatchlist();

  // Render mini widgets for each card (progressive, one per frame)
  let widgetIdx = 0;
  function renderNextMiniWidget() {
    if (widgetIdx >= watchlist.length) return;
    const item = watchlist[widgetIdx++];
    const tvSymbol = resolveToTVSymbol(item.isin);
    if (tvSymbol) {
      createTVMiniWidget(`tv-mini-${sid(item.isin)}`, tvSymbol);
    }
    requestAnimationFrame(renderNextMiniWidget);
  }
  requestAnimationFrame(renderNextMiniWidget);

  // Load main chart with the first item
  if (watchlist.length > 0) {
    const firstSymbol = resolveToTVSymbol(watchlist[0].isin);
    if (firstSymbol) {
      createTVMainChart('tv-main-chart', firstSymbol);
      const label = document.getElementById('active-symbol-label');
      if (label) label.textContent = `${watchlist[0].name} (${firstSymbol})`;
    }
  }

  // Click on a card → load that symbol in the main chart
  document.querySelectorAll('.ticker-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger on button clicks
      if (e.target.closest('.btn-move-up, .btn-move-down, .btn-remove-ticker')) return;

      const tvSymbol = card.dataset.tvSymbol;
      const name = card.dataset.name;
      if (!tvSymbol) return;

      // Update active card highlight
      document.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('ring-1', 'ring-accent-green/40'));
      card.classList.add('ring-1', 'ring-accent-green/40');

      // Load chart
      createTVMainChart('tv-main-chart', tvSymbol);
      const label = document.getElementById('active-symbol-label');
      if (label) label.textContent = `${name} (${tvSymbol})`;

      // Scroll to chart
      document.getElementById('tv-main-chart')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // Open add modal
  const modal = document.getElementById('modal-add-ticker');
  document.getElementById('btn-add-ticker')?.addEventListener('click', () => {
    modal?.classList.remove('hidden');
  });
  document.getElementById('btn-cancel-add')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });
  document.getElementById('modal-overlay-add')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  // Auto-detect type from ticker input
  document.getElementById('input-isin')?.addEventListener('input', (e) => {
    const val = e.target.value.trim().toUpperCase();
    const typeSelect = document.getElementById('input-type');
    if (typeSelect) {
      if (val.includes('-USD') || val.includes('-EUR') || val.includes('CRYPTO:')) {
        typeSelect.value = 'Crypto';
      }
    }
  });

  // Confirm add
  document.getElementById('btn-confirm-add')?.addEventListener('click', () => {
    const isin = document.getElementById('input-isin')?.value?.trim();
    if (!isin) return;
    const name = document.getElementById('input-name')?.value?.trim() || isin;
    const type = document.getElementById('input-type')?.value || 'ETF';
    const tvSymbolOverride = document.getElementById('input-tv-symbol')?.value?.trim();

    const wl = loadWatchlist();
    if (wl.some(w => w.isin.toLowerCase() === isin.toLowerCase())) {
      alert('Ce titre est déjà dans votre liste.');
      return;
    }

    wl.push({ isin, name, type });
    saveWatchlist(wl);

    // Save TradingView symbol override if provided
    if (tvSymbolOverride) {
      const cache = loadTVSymbolCache();
      cache[isin.toUpperCase()] = tvSymbolOverride;
      saveTVSymbolCache(cache);
    }

    modal?.classList.add('hidden');
    navigate('bourse');
  });

  // Remove ticker
  document.querySelectorAll('.btn-remove-ticker').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isin = btn.dataset.isin;
      const wl = loadWatchlist();
      const updated = wl.filter(w => w.isin !== isin);
      if (updated.length < wl.length) {
        saveWatchlist(updated);
        navigate('bourse');
      }
    });
  });

  // Move up / down
  document.querySelectorAll('.btn-move-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isin = btn.dataset.isin;
      const wl = loadWatchlist();
      const idx = wl.findIndex(w => w.isin === isin);
      if (idx > 0) {
        [wl[idx - 1], wl[idx]] = [wl[idx], wl[idx - 1]];
        saveWatchlist(wl);
        navigate('bourse');
      }
    });
  });

  document.querySelectorAll('.btn-move-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isin = btn.dataset.isin;
      const wl = loadWatchlist();
      const idx = wl.findIndex(w => w.isin === isin);
      if (idx >= 0 && idx < wl.length - 1) {
        [wl[idx], wl[idx + 1]] = [wl[idx + 1], wl[idx]];
        saveWatchlist(wl);
        navigate('bourse');
      }
    });
  });

  // Drag and drop reordering
  const grid = document.getElementById('quotes-grid');
  if (grid) {
    let draggedEl = null;

    grid.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.ticker-card');
      if (!card) return;
      draggedEl = card;
      card.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragend', (e) => {
      const card = e.target.closest('.ticker-card');
      if (card) card.style.opacity = '1';
      grid.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('ring', 'ring-accent-amber/40'));
      draggedEl = null;
    });

    grid.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.ticker-card');
      if (target && target !== draggedEl) {
        grid.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('ring', 'ring-accent-amber/40'));
        target.classList.add('ring', 'ring-accent-amber/40');
      }
    });

    grid.addEventListener('dragleave', (e) => {
      const target = e.target.closest('.ticker-card');
      if (target) target.classList.remove('ring', 'ring-accent-amber/40');
    });

    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      const target = e.target.closest('.ticker-card');
      if (!target || !draggedEl || target === draggedEl) return;
      target.classList.remove('ring', 'ring-accent-amber/40');

      const allCards = [...grid.querySelectorAll('.ticker-card')];
      const fromIdx = allCards.indexOf(draggedEl);
      const toIdx = allCards.indexOf(target);
      if (fromIdx < 0 || toIdx < 0) return;

      if (fromIdx < toIdx) {
        grid.insertBefore(draggedEl, target.nextSibling);
      } else {
        grid.insertBefore(draggedEl, target);
      }

      const wl = loadWatchlist();
      const reordered = [...grid.querySelectorAll('.ticker-card')].map(card => {
        const isin = card.dataset.isin;
        return wl.find(w => w.isin === isin);
      }).filter(Boolean);
      saveWatchlist(reordered);
    });
  }
}
