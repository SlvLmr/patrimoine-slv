// ============================================================================
// BOURSE — Suivi de marché avec sparklines Chart.js
// ============================================================================

import { createChart } from '../charts/chart-config.js';

const WATCHLIST_STORAGE_KEY = 'patrimoine-slv-watchlist';

// ISIN → display symbol mapping
const KNOWN_SYMBOLS = {
  'FR0000120073': { sym: 'AI', exchange: 'Euronext' },
  'FR0000121972': { sym: 'SU', exchange: 'Euronext' },
  'FR0010307819': { sym: 'LR', exchange: 'Euronext' },
  'FR0000131104': { sym: 'BNP', exchange: 'Euronext' },
  'FR0000120271': { sym: 'TTE', exchange: 'Euronext' },
  'FR0000121014': { sym: 'MC', exchange: 'Euronext' },
  'FR0000120321': { sym: 'OR', exchange: 'Euronext' },
  'FR0000125007': { sym: 'SGO', exchange: 'Euronext' },
  'FR0000125338': { sym: 'CAP', exchange: 'Euronext' },
  'FR0000130809': { sym: 'SAN', exchange: 'Euronext' },
  'FR0000127771': { sym: 'VIV', exchange: 'Euronext' },
  'FR0000120578': { sym: 'SAF', exchange: 'Euronext' },
  'FR0000073272': { sym: 'SAF', exchange: 'Euronext' },
  'FR0000051807': { sym: 'TEP', exchange: 'Euronext' },
  'FR0010220475': { sym: 'CW8', exchange: 'Euronext' },
  'FR0011550185': { sym: 'EWLD', exchange: 'Euronext' },
  'FR0011550193': { sym: 'PSP5', exchange: 'Euronext' },
  'FR0013412020': { sym: 'PAEEM', exchange: 'Euronext' },
  'FR0011869353': { sym: 'PUST', exchange: 'Euronext' },
  'FR0013412038': { sym: 'PCEU', exchange: 'Euronext' },
  'FR0011550177': { sym: 'PTPXE', exchange: 'Euronext' },
  'FR0013400256': { sym: 'MWRD', exchange: 'Euronext' },
  'LU1681043599': { sym: 'CW8', exchange: 'Euronext' },
  'LU0392494562': { sym: 'MWRD', exchange: 'Xetra' },
  'IE00BK5BQT80': { sym: 'VWRA', exchange: 'LSE' },
  'IE00B4L5Y983': { sym: 'EUNL', exchange: 'Xetra' },
  'IE00B3RBWM25': { sym: 'VWRL', exchange: 'LSE' },
  'IE00BJ0KDQ92': { sym: 'VUSA', exchange: 'LSE' },
  'IE00B5BMR087': { sym: 'CSPX', exchange: 'LSE' },
  'IE00B4L5YC18': { sym: 'IS3N', exchange: 'Xetra' },
};

function getSymbolDisplay(isin) {
  const upper = (isin || '').toUpperCase().trim();
  if (KNOWN_SYMBOLS[upper]) return KNOWN_SYMBOLS[upper].sym;
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

// Seeded random for consistent sparklines per ticker
function seededRandom(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = ((s << 5) - s + seed.charCodeAt(i)) | 0;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  };
}

function generateSparklineData(isin, basePrice, points = 30) {
  const rng = seededRandom(isin + '_spark');
  const data = [];
  let price = basePrice * (0.92 + rng() * 0.08); // start slightly below
  const volatility = basePrice > 1000 ? 0.012 : basePrice > 100 ? 0.015 : 0.02;
  const drift = (basePrice - price) / points; // drift towards current price

  for (let i = 0; i < points; i++) {
    data.push(Math.round(price * 100) / 100);
    price += drift + price * volatility * (rng() - 0.45);
    if (price < basePrice * 0.7) price = basePrice * 0.75;
    if (price > basePrice * 1.3) price = basePrice * 1.25;
  }
  // Last point = base price
  data.push(Math.round(basePrice * 100) / 100);
  return data;
}

// No-op exports for app.js compatibility
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
          <div class="w-2 h-2 rounded-full bg-accent-green animate-pulse"></div>
          <span class="text-xs text-gray-400" id="active-symbol-label">Clique sur un titre pour afficher son graphique</span>
        </div>
        <div class="px-4 py-2" style="height:320px">
          <canvas id="bourse-main-chart"></canvas>
        </div>
      </div>

      <!-- Grille des titres -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" id="quotes-grid">
        ${watchlist.map((item, idx) => {
          const sym = getSymbolDisplay(item.isin);
          const actif = findMatchingActif(item, placements);
          const hasPortfolio = actif && (actif.quantite || actif.pru);
          const qty = hasPortfolio ? (Number(actif.quantite) || 0) : 0;
          const pru = hasPortfolio ? (Number(actif.pru) || 0) : 0;
          const valTotale = hasPortfolio ? (Number(actif.valeur) || 0) : 0;
          const investTotal = qty * pru;
          const pnl = investTotal > 0 ? valTotale - investTotal : 0;
          const pnlPct = investTotal > 0 ? ((pnl / investTotal) * 100) : 0;
          const currentPrice = (qty > 0 && valTotale > 0) ? valTotale / qty : pru;

          return `
          <div class="card-dark rounded-xl p-3 cursor-pointer relative group hover:ring-1 hover:ring-accent-green/30 transition ticker-card ${idx === 0 ? 'ring-1 ring-accent-green/40' : ''}"
               data-isin="${item.isin}" data-name="${item.name}" data-sym="${sym}" data-price="${currentPrice}" draggable="true">
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

            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] px-1.5 py-0.5 rounded-full ${item.type === 'ETF' ? 'bg-accent-green/10 text-accent-green' : item.type === 'Crypto' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-blue/10 text-accent-blue'}">${item.type}</span>
              <span class="text-xs font-bold text-gray-300">${sym}</span>
            </div>
            <p class="text-sm font-medium text-gray-200 truncate mb-1">${item.name}</p>

            ${currentPrice > 0 ? `
            <div class="flex items-baseline gap-2 mb-1">
              <span class="text-lg font-bold text-gray-100">${formatNum(currentPrice)} €</span>
              ${pnlPct !== 0 ? `<span class="text-xs font-semibold ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}">${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%</span>` : ''}
            </div>` : ''}

            <!-- Sparkline -->
            <div style="height:60px" class="mt-1">
              <canvas id="spark-${sid(item.isin)}"></canvas>
            </div>

            ${hasPortfolio ? `
              <div class="mt-2 pt-2 border-t border-dark-400/20 space-y-1">
                <div class="flex justify-between text-[11px]">
                  <span class="text-gray-500">${Number.isInteger(qty) ? formatNum(qty, 0) : formatNum(qty, 4)} parts</span>
                  <span class="text-gray-400 font-medium">PRU ${formatNum(pru)} €</span>
                </div>
                <div class="flex justify-between text-[11px]">
                  <span class="text-gray-500">Valeur</span>
                  <span class="text-gray-200 font-semibold">${formatNum(valTotale)} €</span>
                </div>
                ${pnl !== 0 ? `
                <div class="flex justify-between text-[11px]">
                  <span class="text-gray-500">P&L</span>
                  <span class="font-semibold ${pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}">${pnl >= 0 ? '+' : ''}${formatNum(pnl)} €</span>
                </div>` : ''}
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
// SPARKLINE CHART HELPERS
// ============================================================================

function renderSparkline(canvasId, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data.length) return;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight || 60);
  gradient.addColorStop(0, color + '30');
  gradient.addColorStop(1, color + '00');

  // Generate labels (last N days)
  const labels = data.map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (data.length - 1 - i));
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  });

  createChart(canvasId, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: gradient,
        borderWidth: 1.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      scales: {
        x: { display: false },
        y: { display: false }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11,11,15,0.95)',
          titleColor: '#e8d5b0',
          bodyColor: '#a0a0a5',
          borderColor: 'rgba(56,56,63,0.6)',
          borderWidth: 1,
          padding: 8,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (item) => `${formatNum(item.raw)} €`
          }
        }
      }
    }
  });
}

function renderMainChart(isin, name, data, color) {
  const labelEl = document.getElementById('active-symbol-label');
  if (labelEl) labelEl.textContent = `${name} — 30 derniers jours`;

  const canvas = document.getElementById('bourse-main-chart');
  if (!canvas || !data.length) return;

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(1, color + '00');

  const labels = data.map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (data.length - 1 - i));
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  });

  createChart('bourse-main-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: name,
        data,
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
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800 },
      scales: {
        x: {
          grid: { color: 'rgba(42,42,47,0.3)' },
          ticks: { color: '#555', font: { size: 10 }, maxTicksLimit: 10 }
        },
        y: {
          grid: { color: 'rgba(42,42,47,0.3)' },
          ticks: {
            color: '#555',
            font: { size: 11 },
            callback: v => v >= 1000 ? (v / 1000).toFixed(1) + ' k€' : formatNum(v) + ' €'
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11,11,15,0.95)',
          titleColor: '#e8d5b0',
          bodyColor: '#a0a0a5',
          borderColor: 'rgba(56,56,63,0.6)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            label: (item) => ` ${formatNum(item.raw)} €`
          }
        }
      }
    }
  });
}

// ============================================================================
// MOUNT
// ============================================================================

const TYPE_COLORS = {
  'Action': '#60a5fa',
  'ETF': '#34d399',
  'Crypto': '#fbbf24',
};

export function mount(store, navigate) {
  const watchlist = loadWatchlist();
  const placements = store?.get?.('actifs.placements') || [];

  // Build sparkline data for each card
  const sparkData = {};
  watchlist.forEach(item => {
    const actif = findMatchingActif(item, placements);
    const qty = actif ? (Number(actif.quantite) || 0) : 0;
    const pru = actif ? (Number(actif.pru) || 0) : 0;
    const val = actif ? (Number(actif.valeur) || 0) : 0;
    const price = (qty > 0 && val > 0) ? val / qty : pru || 100;
    const color = TYPE_COLORS[item.type] || '#60a5fa';
    sparkData[item.isin] = { data: generateSparklineData(item.isin, price), color, price, name: item.name };
  });

  // Render all sparklines
  watchlist.forEach(item => {
    const sd = sparkData[item.isin];
    if (sd) renderSparkline(`spark-${sid(item.isin)}`, sd.data, sd.color);
  });

  // Render main chart with first item
  if (watchlist.length > 0) {
    const first = watchlist[0];
    const sd = sparkData[first.isin];
    if (sd) renderMainChart(first.isin, first.name, sd.data, sd.color);
  }

  // Click card → show main chart
  document.querySelectorAll('.ticker-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-move-up, .btn-move-down, .btn-remove-ticker')) return;
      const isin = card.dataset.isin;
      const name = card.dataset.name;
      const sd = sparkData[isin];
      if (!sd) return;

      document.querySelectorAll('.ticker-card').forEach(c => c.classList.remove('ring-1', 'ring-accent-green/40'));
      card.classList.add('ring-1', 'ring-accent-green/40');

      renderMainChart(isin, name, sd.data, sd.color);
      document.getElementById('bourse-main-chart')?.closest('.card-dark')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // Modal
  const modal = document.getElementById('modal-add-ticker');
  document.getElementById('btn-add-ticker')?.addEventListener('click', () => modal?.classList.remove('hidden'));
  document.getElementById('btn-cancel-add')?.addEventListener('click', () => modal?.classList.add('hidden'));
  document.getElementById('modal-overlay-add')?.addEventListener('click', () => modal?.classList.add('hidden'));

  // Auto-detect crypto
  document.getElementById('input-isin')?.addEventListener('input', (e) => {
    const val = e.target.value.trim().toUpperCase();
    const typeSelect = document.getElementById('input-type');
    if (typeSelect && (val.includes('-USD') || val.includes('-EUR') || val.includes('CRYPTO:'))) {
      typeSelect.value = 'Crypto';
    }
  });

  // Confirm add
  document.getElementById('btn-confirm-add')?.addEventListener('click', () => {
    const isin = document.getElementById('input-isin')?.value?.trim();
    if (!isin) return;
    const name = document.getElementById('input-name')?.value?.trim() || isin;
    const type = document.getElementById('input-type')?.value || 'ETF';

    const wl = loadWatchlist();
    if (wl.some(w => w.isin.toLowerCase() === isin.toLowerCase())) {
      alert('Ce titre est déjà dans votre liste.');
      return;
    }

    wl.push({ isin, name, type });
    saveWatchlist(wl);
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
