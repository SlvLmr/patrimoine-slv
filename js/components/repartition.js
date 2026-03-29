import { formatCurrency, formatPercent, computeProjection, getPlacementGroupKey, openModal, getFormData } from '../utils.js?v=9';
import { createChart, VIVID_PALETTE, GRADIENT_PAIRS, createVerticalGradient, createSliceGradient, legendStrikethroughPlugin } from '../charts/chart-config.js';
import { openAddPlacementModal, openEditPlacementModal } from './placement-form.js?v=7';

// Color map for envelope groups
const GROUP_COLORS = {
  'PEA ETF': { color: '#3b82f6', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  'PEA Actions': { color: '#f59e0b', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  'PEA Autre': { color: '#eab308', bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'Assurance Vie': { color: '#06b6d4', bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'CTO': { color: '#a855f7', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'CTO TR': { color: '#a855f7', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'CTO BB': { color: '#c084fc', bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  'Crypto': { color: '#f97316', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  'PEE': { color: '#14b8a6', bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
  'PER': { color: '#ec4899', bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  'Or': { color: '#eab308', bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'Argent': { color: '#94a3b8', bg: 'bg-slate-400/15', text: 'text-slate-400', border: 'border-slate-400/30' },
};
const DEFAULT_GROUP = { color: '#6366f1', bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' };

// Distinct colors for individual action cards & donut slices
const ACTION_CARD_COLORS = [
  { color: '#f59e0b', text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  { color: '#3b82f6', text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  { color: '#10b981', text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  { color: '#f43f5e', text: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10' },
  { color: '#8b5cf6', text: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10' },
  { color: '#06b6d4', text: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
  { color: '#ec4899', text: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10' },
  { color: '#14b8a6', text: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/10' },
];

function getGroupStyle(gk) {
  return GROUP_COLORS[gk] || DEFAULT_GROUP;
}

// Get DCA for a given year from a placement
function getDcaForYear(placement, year) {
  const baseDca = Number(placement.dcaMensuel) || 0;
  const finAnnee = Number(placement.dcaFinAnnee) || 0;
  if (finAnnee > 0 && year > finAnnee) return 0;
  const overrides = (placement.dcaOverrides || []).sort((a, b) => a.fromYear - b.fromYear);
  if (!overrides.length) return baseDca;
  let applicable = baseDca;
  for (const ov of overrides) {
    if (ov.fromYear <= year) applicable = Number(ov.dcaMensuel) || 0;
  }
  return applicable;
}

export function render(store) {
  const params = store.get('parametres');
  const currentYear = new Date().getFullYear();
  const years = params.projectionYears || 30;

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
              </svg>
            </div>
            Répartition
          </h2>
          <p class="text-gray-500 text-sm mt-1">Allocation et suivi de tes investissements par enveloppe</p>
        </div>
        <button id="rep-add-placement" class="flex items-center gap-2 px-4 py-2 bg-accent-green/20 text-accent-green rounded-xl hover:bg-accent-green/30 transition text-sm font-medium">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Ajouter un placement
        </button>
      </div>

      <!-- Time Slider -->
      <div class="card-dark rounded-2xl px-6 py-4">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 flex-shrink-0">
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span class="text-sm text-gray-400">Année</span>
          </div>
          <input type="range" id="rep-slider" min="0" max="${years}" value="0" step="1"
            class="flex-1 h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-amber-500"
            style="accent-color: #c9a76c;">
          <div class="flex items-center gap-2 flex-shrink-0 min-w-[120px] justify-end">
            <span id="rep-year-label" class="text-lg font-bold text-accent-amber">${currentYear}</span>
            <span id="rep-age-label" class="text-sm text-gray-500">(${params.ageFinAnnee || 43} ans)</span>
          </div>
        </div>
        <div class="flex justify-between mt-1 px-1">
          <span class="text-[10px] text-gray-600">${currentYear}</span>
          <span class="text-[10px] text-gray-600">${currentYear + years}</span>
        </div>
        <div id="rep-kpi" class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4"></div>
      </div>

      <!-- Diversification Score Widget (updated dynamically in mount) -->
      <div id="diversification-widget"></div>

      <!-- Flow + Actions + PEE -->
      <div class="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div class="card-dark rounded-2xl p-5 flex flex-col">
          <div class="flex items-center justify-between mb-4 flex-shrink-0">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
              <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Flux mensuels</h2>
            </div>
            <span class="text-[10px] text-gray-600">Cliquez sur un placement pour le modifier</span>
          </div>
          <div id="rep-flow" class="space-y-0 flex-1 flex flex-col"></div>
        </div>
        <div class="flex flex-col gap-4">
          <div class="card-dark rounded-2xl px-5 py-4 flex flex-col overflow-hidden">
            <div class="flex items-center gap-2 mb-3 flex-shrink-0">
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Mes Actions</h3>
            </div>
            <div id="rep-actions-list" class="space-y-2 overflow-y-auto"></div>
          </div>
          <div class="card-dark rounded-2xl px-5 py-4 flex flex-col overflow-hidden">
            <div class="flex items-center gap-2 mb-3 flex-shrink-0">
              <svg class="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Mon PEE</h3>
            </div>
            <div id="rep-pee-list" class="space-y-2 overflow-y-auto"></div>
          </div>
        </div>
      </div>

      <!-- Evolution Chart -->
      <div class="card-dark rounded-2xl p-5 min-w-0 overflow-hidden">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Evolution</h2>
        </div>
        <div class="relative" style="height: 320px;">
          <canvas id="rep-chart-area"></canvas>
        </div>
      </div>

      <!-- DCA Evolution Chart -->
      <div class="card-dark rounded-2xl p-5">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">DCA mensuel par enveloppe</h2>
        </div>
        <div class="relative" style="height: 280px;">
          <canvas id="rep-chart-dca"></canvas>
        </div>
      </div>

      <!-- Detailed table -->
      <div class="card-dark rounded-2xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
            <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Détail par placement</h2>
            <span id="rep-table-year" class="text-sm text-gray-500 ml-1"></span>
          </div>
          <button id="rep-add-placement-bottom" class="flex items-center gap-1.5 px-3 py-1.5 bg-accent-green/15 text-accent-green rounded-lg hover:bg-accent-green/25 transition text-xs font-medium">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Ajouter
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-gray-500 text-xs uppercase tracking-wider border-b border-dark-400/30">
                <th class="text-left py-2 px-2">Placement</th>
                <th class="text-left py-2 px-2">Enveloppe</th>
                <th class="text-right py-2 px-2">DCA/mois</th>
                <th class="text-right py-2 px-2">Valeur</th>
                <th class="text-right py-2 px-2">% total</th>
                <th class="py-2 px-1 w-16"></th>
              </tr>
            </thead>
            <tbody id="rep-table-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  let snapshots = computeProjection(store);
  let params = store.get('parametres');
  let placements = store.getAll().actifs?.placements || [];
  const currentYear = new Date().getFullYear();
  let groupKeys = snapshots.groupKeys || [];
  const ageFinAnnee = params.ageFinAnnee || 43;
  const CHILD_FLOW_COLORS = ['#a855f7', '#06b6d4', '#f59e0b', '#ec4899'];

  function refresh() {
    snapshots = computeProjection(store);
    params = store.get('parametres');
    placements = store.getAll().actifs?.placements || [];
    groupKeys = snapshots.groupKeys || [];
    buildAreaChart();
    buildDCAChart();
    const slider = document.getElementById('rep-slider');
    updateForYear(slider ? parseInt(slider.value) : 0);
  }

  function updateDiversificationScore(snap) {
    const widget = document.getElementById('diversification-widget');
    if (!widget) return;

    // Build envelope totals from projected snapshot (excludes immobilier)
    const envelopeTotals = {};
    const allPlacements = [];
    const assetClasses = new Set();

    placements.forEach(p => {
      const env = p.enveloppe || p.type || 'Autre';
      const val = snap.placementById?.[p.id] || Number(p.valeur) || Number(p.apport) || 0;
      if (val <= 0) return;
      envelopeTotals[env] = (envelopeTotals[env] || 0) + val;
      allPlacements.push({ nom: p.nom || 'Sans nom', val });

      const cat = p.categorie || '';
      const envLc = env.toLowerCase();
      if (cat === 'ETF') assetClasses.add('ETF');
      else if (cat === 'Action') assetClasses.add('Actions');
      else if (cat === 'Obligation' || cat === 'OPCVM') assetClasses.add('Obligations');
      else if (cat === 'SCPI') assetClasses.add('Immobilier');
      else if (cat === 'Crypto' || envLc === 'crypto') assetClasses.add('Crypto');
      else if (envLc === 'livrets') assetClasses.add('Epargne');
      else assetClasses.add('Autre');
    });

    // Include epargne but NOT immobilier
    const epargne = store.get('actifs.epargne') || [];
    const eparTotal = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
    if (eparTotal > 0) {
      envelopeTotals['Epargne'] = eparTotal;
      allPlacements.push({ nom: 'Epargne', val: eparTotal });
      assetClasses.add('Epargne');
    }

    const totalAll = Object.values(envelopeTotals).reduce((s, v) => s + v, 0);
    if (totalAll <= 0) { widget.innerHTML = ''; return; }

    const envelopeCount = Object.keys(envelopeTotals).filter(k => envelopeTotals[k] > 0).length;

    // Envelope concentration score (30 pts)
    let scoreEnv = 30, maxEnvPct = 0, maxEnvName = '';
    Object.entries(envelopeTotals).forEach(([env, val]) => { const pct = val / totalAll; if (pct > maxEnvPct) { maxEnvPct = pct; maxEnvName = env; } });
    if (maxEnvPct > 0.6) scoreEnv = Math.round(30 * (1 - (maxEnvPct - 0.6) / 0.4));
    else if (maxEnvPct > 0.4) scoreEnv = Math.round(30 * (0.7 + 0.3 * (1 - (maxEnvPct - 0.4) / 0.2)));
    scoreEnv = Math.max(0, Math.min(30, scoreEnv));

    // Placement concentration score (30 pts)
    let scorePlac = 30, maxPlacPct = 0, maxPlacName = '';
    if (allPlacements.length > 0) {
      allPlacements.forEach(p => { const pct = p.val / totalAll; if (pct > maxPlacPct) { maxPlacPct = pct; maxPlacName = p.nom; } });
      if (maxPlacPct > 0.5) scorePlac = Math.round(30 * (1 - (maxPlacPct - 0.5) / 0.5));
      else if (maxPlacPct > 0.25) scorePlac = Math.round(30 * (0.6 + 0.4 * (1 - (maxPlacPct - 0.25) / 0.25)));
    } else { scorePlac = 0; }
    scorePlac = Math.max(0, Math.min(30, scorePlac));

    // Asset class diversity (25 pts)
    const numCl = assetClasses.size;
    const scoreAsset = numCl >= 5 ? 25 : numCl === 4 ? 20 : numCl === 3 ? 15 : numCl === 2 ? 10 : numCl === 1 ? 5 : 0;

    // Envelope count (15 pts)
    const scoreEnvCnt = envelopeCount >= 4 ? 15 : envelopeCount === 3 ? 12 : envelopeCount === 2 ? 8 : envelopeCount === 1 ? 4 : 0;

    const total = scoreEnv + scorePlac + scoreAsset + scoreEnvCnt;
    const color = total > 70 ? 'text-emerald-400' : total >= 40 ? 'text-amber-400' : 'text-red-400';
    const ringCol = total > 70 ? '#10b981' : total >= 40 ? '#f59e0b' : '#ef4444';
    const R = 40, C = 2 * Math.PI * R, off = C - total / 100 * C;

    const insights = [];
    if (maxEnvPct > 0.4) insights.push('Concentration ' + maxEnvName + ' : ' + formatPercent(maxEnvPct));
    if (maxPlacPct > 0.25 && allPlacements.length > 1) insights.push((maxPlacName.length > 20 ? maxPlacName.slice(0, 20) + '…' : maxPlacName) + ' : ' + formatPercent(maxPlacPct) + ' du total');
    if (envelopeCount >= 3) insights.push('Diversification enveloppes : bonne (' + envelopeCount + ')');
    else if (envelopeCount === 2) insights.push('Diversification enveloppes : correcte (' + envelopeCount + ')');
    else insights.push('Diversification enveloppes : à améliorer');
    if (numCl >= 4) insights.push("Classes d'actifs : bien diversifié (" + numCl + ' types)');
    else if (numCl <= 2 && numCl > 0) insights.push("Classes d'actifs : peu diversifié (" + numCl + ' type' + (numCl > 1 ? 's' : '') + ')');

    widget.innerHTML = `
      <div class="card-dark rounded-xl p-5 shadow-lg shadow-gray-500/20">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-gray-500/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">Score de diversification</h2>
        </div>
        <div class="flex items-center gap-6">
          <div class="relative flex-shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="${R}" fill="none" stroke="#374151" stroke-width="8"/>
              <circle cx="50" cy="50" r="${R}" fill="none" stroke="${ringCol}" stroke-width="8"
                stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"
                transform="rotate(-90 50 50)" style="transition: stroke-dashoffset 0.5s ease"/>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="${color} text-2xl font-bold">${total}</span>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
              <span>Concentration enveloppe</span><span class="text-right text-gray-400">${scoreEnv}/30</span>
              <span>Concentration placement</span><span class="text-right text-gray-400">${scorePlac}/30</span>
              <span>Classes d'actifs</span><span class="text-right text-gray-400">${scoreAsset}/25</span>
              <span>Nb enveloppes</span><span class="text-right text-gray-400">${scoreEnvCnt}/15</span>
            </div>
            ${insights.length > 0 ? `<div class="space-y-1 border-t border-dark-400/30 pt-2">${insights.slice(0, 3).map(i => '<p class="text-xs text-gray-500">' + i + '</p>').join('')}</div>` : ''}
          </div>
        </div>
      </div>`;
  }

  // Add placement buttons
  document.getElementById('rep-add-placement')?.addEventListener('click', () => {
    openAddPlacementModal(store, navigate, 'repartition');
  });
  document.getElementById('rep-add-placement-bottom')?.addEventListener('click', () => {
    openAddPlacementModal(store, navigate, 'repartition');
  });

  // Build charts
  buildAreaChart();
  buildDCAChart();

  // Initial update
  updateForYear(0);

  // Slider handler
  const slider = document.getElementById('rep-slider');
  if (slider) {
    slider.addEventListener('input', () => {
      updateForYear(parseInt(slider.value));
    });
  }

  function updateForYear(yearIdx) {
    const snap = snapshots[yearIdx];
    if (!snap) return;

    const calYear = currentYear + yearIdx;
    const age = ageFinAnnee + yearIdx;

    // Update labels
    const yearLabel = document.getElementById('rep-year-label');
    const ageLabel = document.getElementById('rep-age-label');
    if (yearLabel) yearLabel.textContent = calYear;
    if (ageLabel) ageLabel.textContent = `(${age} ans)`;

    // Compute DCA per placement for this year
    const dcaByPlacement = placements.map(p => ({
      ...p,
      gk: getPlacementGroupKey(p),
      dca: getDcaForYear(p, calYear)
    }));

    const totalDCA = dcaByPlacement.reduce((s, p) => s + p.dca, 0);
    const nbWithDCA = dcaByPlacement.filter(p => p.dca > 0).length;

    // DCA by group
    const dcaByGroup = {};
    dcaByPlacement.forEach(p => {
      if (!dcaByGroup[p.gk]) dcaByGroup[p.gk] = 0;
      dcaByGroup[p.gk] += p.dca;
    });

    // Children DCA
    const donationConfig = store.get('donationConfig') || {};
    const enfants = donationConfig.enfants || [];
    const childrenDCA = enfants.map((enf, idx) => {
      const childPlacements = (enf.placements || []).map(p => ({
        ...p,
        dca: getDcaForYear(p, calYear)
      }));
      const totalChildDCA = childPlacements.reduce((s, p) => s + p.dca, 0);
      return { enf, idx, placements: childPlacements, totalDCA: totalChildDCA };
    }).filter(c => c.totalDCA > 0);
    const totalChildrenDCA = childrenDCA.reduce((s, c) => s + c.totalDCA, 0);

    const totalPlacements = snap.placements || 0;

    updateKPI(totalDCA, nbWithDCA, snap, totalPlacements);
    updateActions(snap);
    updatePEE(snap, calYear);
    updateFlow(dcaByPlacement, dcaByGroup, totalDCA, calYear, childrenDCA, totalChildrenDCA);
    updateTable(dcaByPlacement, snap, totalPlacements, calYear);
    updateDiversificationScore(snap);
  }

  function updateKPI(totalDCA, nbWithDCA, snap, totalPlacements) {
    const kpiEl = document.getElementById('rep-kpi');
    if (!kpiEl) return;

    kpiEl.innerHTML = `
      <div class="card-dark rounded-xl px-4 py-3 text-center">
        <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">DCA mensuel</p>
        <p class="text-xl font-bold text-accent-amber">${formatCurrency(totalDCA)}</p>
        <p class="text-[10px] text-gray-600 mt-0.5">${formatCurrency(totalDCA * 12)}/an</p>
      </div>
      <div class="card-dark rounded-xl px-4 py-3 text-center">
        <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Placements actifs</p>
        <p class="text-xl font-bold text-blue-400">${nbWithDCA}</p>
        <p class="text-[10px] text-gray-600 mt-0.5">avec DCA</p>
      </div>
      <div class="card-dark rounded-xl px-4 py-3 text-center">
        <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Patrimoine investi</p>
        <p class="text-xl font-bold text-accent-green">${formatCurrency(totalPlacements)}</p>
        <div class="flex justify-center gap-3 mt-1">
          <p class="text-[10px] text-gray-500"><span class="text-gray-400">${formatCurrency(snap.totalApports)}</span> apports</p>
          <p class="text-[10px] ${totalPlacements - snap.totalApports >= 0 ? 'text-emerald-600' : 'text-red-500'}"><span class="${totalPlacements - snap.totalApports >= 0 ? 'text-emerald-400' : 'text-red-400'}">${totalPlacements - snap.totalApports >= 0 ? '+' : ''}${formatCurrency(totalPlacements - snap.totalApports)}</span> gains</p>
        </div>
      </div>
    `;
  }

  function updateActions(snap) {
    const listEl = document.getElementById('rep-actions-list');
    if (!listEl) return;

    const actions = placements
      .filter(p => (p.categorie || '') === 'Action' && Number(p.quantite) > 0 && Number(p.pru) > 0)
      .map((p, i) => {
        const projectedValue = snap.placementById?.[p.id] || Number(p.valeur) || (Number(p.quantite) * Number(p.pru));
        const nomLower = (p.nom || '').toLowerCase();
        const STOCK_COLORS = {
          'air liquide': { color: '#3b82f6', text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
          'schneider':   { color: '#10b981', text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
          'legrand':     { color: '#f59e0b', text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
        };
        const stockMatch = Object.entries(STOCK_COLORS).find(([k]) => nomLower.includes(k));
        return {
          id: p.id,
          nom: p.nom || 'Action',
          quantite: Number(p.quantite),
          pru: Number(p.pru),
          valeur: projectedValue,
          enveloppe: p.enveloppe || '',
          style: stockMatch ? stockMatch[1] : ACTION_CARD_COLORS[i % ACTION_CARD_COLORS.length],
        };
      })
      .sort((a, b) => b.valeur - a.valeur);

    if (!actions.length) {
      listEl.innerHTML = '<p class="text-xs text-gray-600 text-center py-4">Aucune action individuelle</p>';
      return;
    }

    const totalApportActions = actions.reduce((s, a) => s + (a.quantite * a.pru), 0);
    const totalActions = actions.reduce((s, a) => s + a.valeur, 0);

    // Total header
    const headerHTML = `
      <div class="flex justify-center mb-0.5">
        <div class="card-dark rounded-lg px-3 py-1.5 text-center inline-block border border-amber-500/20">
          <p class="text-[9px] text-gray-500 uppercase tracking-widest">Total investi</p>
          <p class="text-base font-extrabold text-amber-400">${formatCurrency(totalApportActions)}</p>
        </div>
      </div>
    `;

    // SVG curved connectors
    const svgHTML = `
      <div id="rep-actions-svg-wrap" class="hidden lg:block" style="height:25px;">
        <svg id="rep-actions-svg" class="w-full" style="height:25px;" fill="none">
          <defs>
            <filter id="glow-actions" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.5"/></filter>
          </defs>
        </svg>
      </div>
    `;

    // Action cards
    const cardsHTML = actions.map((a, i) => {
      const pct = totalActions > 0 ? (a.valeur / totalActions * 100).toFixed(1) : 0;
      const apport = a.quantite * a.pru;
      const s = a.style;
      return `
        <div id="rep-action-card-${i}" class="card-dark rounded-xl px-3 py-2 ${s.border} border transition hover:border-opacity-60">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <div class="w-2 h-2 rounded-full flex-shrink-0" style="background: ${s.color}"></div>
              <span class="text-xs font-semibold ${s.text} truncate">${a.nom}</span>
            </div>
            <span class="text-[10px] text-gray-500 flex-shrink-0">${pct}%</span>
          </div>
          <div class="w-full h-0.5 bg-dark-600 rounded-full overflow-hidden mb-1.5">
            <div class="h-full rounded-full" style="width: ${pct}%; background: ${s.color}"></div>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-xs font-bold text-gray-200">${formatCurrency(apport)}</p>
            <p class="text-[10px] text-gray-500">valorisé ${formatCurrency(a.valeur)}</p>
          </div>
          <div class="flex items-center gap-2 mt-0.5">
            <p class="text-[10px] text-gray-600">${a.quantite} parts</p>
            <p class="text-[10px] text-gray-600">PRU ${formatCurrency(a.pru)}</p>
          </div>
        </div>
      `;
    }).join('');

    listEl.innerHTML = headerHTML + svgHTML + `
      <div id="rep-actions-cards" class="grid grid-cols-1 gap-2 flex-1">${cardsHTML}</div>
    `;

    // Draw curved connectors
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawActionConnectors(actions);
      });
    });
  }

  function drawActionConnectors(actions) {
    const svg = document.getElementById('rep-actions-svg');
    const wrap = document.getElementById('rep-actions-svg-wrap');
    if (!svg || !wrap) return;

    const wrapRect = wrap.getBoundingClientRect();
    const w = wrapRect.width;
    if (w <= 0) return;
    const h = 25;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.querySelectorAll('path, circle').forEach(el => el.remove());

    const mid = w / 2;

    const cards = actions.map((a, i) => {
      const el = document.getElementById(`rep-action-card-${i}`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { cx: r.left + r.width / 2 - wrapRect.left, color: a.style.color };
    }).filter(Boolean);

    cards.forEach(({ cx, color }) => {
      const d = `M ${mid} 0 C ${mid} ${h * 0.55}, ${cx} ${h * 0.55}, ${cx} ${h}`;

      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', color);
      glow.setAttribute('stroke-width', '4');
      glow.setAttribute('fill', 'none');
      glow.setAttribute('opacity', '0.2');
      glow.setAttribute('filter', 'url(#glow-actions)');
      svg.appendChild(glow);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', d);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('fill', 'none');
      line.setAttribute('opacity', '0.6');
      svg.appendChild(line);

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', h);
      dot.setAttribute('r', '2');
      dot.setAttribute('fill', color);
      dot.setAttribute('opacity', '0.7');
      svg.appendChild(dot);
    });

    if (cards.length > 0) {
      const topDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      topDot.setAttribute('cx', mid);
      topDot.setAttribute('cy', '0');
      topDot.setAttribute('r', '2.5');
      topDot.setAttribute('fill', '#f59e0b');
      topDot.setAttribute('opacity', '0.8');
      svg.appendChild(topDot);
    }
  }

  function updatePEE(snap, calYear) {
    const listEl = document.getElementById('rep-pee-list');
    if (!listEl) return;

    const peePlacements = placements.filter(p => (p.enveloppe || p.type) === 'PEE');
    if (!peePlacements.length) {
      listEl.innerHTML = '<p class="text-xs text-gray-600 text-center py-4">Aucun placement PEE</p>';
      return;
    }

    const peeStyle = { color: '#14b8a6', text: 'text-teal-400', border: 'border-teal-500/30', bg: 'bg-teal-500/10' };
    const totalPEE = peePlacements.reduce((s, p) => s + (snap.placementById?.[p.id] || Number(p.valeur) || 0), 0);
    const totalApport = peePlacements.reduce((s, p) => s + (Number(p.apport) || Number(p.valeur) || 0), 0);

    // Annual contributions for current year
    const annualContrib = peePlacements.reduce((s, p) => {
      const contribs = p.peeContributions || [];
      const thisYear = contribs.find(c => c.year === calYear);
      return s + (thisYear ? Number(thisYear.montant) || 0 : 0);
    }, 0);

    const headerHTML = `
      <div class="flex justify-center mb-2">
        <div class="card-dark rounded-lg px-3 py-1.5 text-center inline-block border border-teal-500/20">
          <p class="text-[9px] text-gray-500 uppercase tracking-widest">Valorisation</p>
          <p class="text-base font-extrabold text-teal-400">${formatCurrency(totalPEE)}</p>
        </div>
      </div>
    `;

    const cardsHTML = peePlacements.map(p => {
      const val = snap.placementById?.[p.id] || Number(p.valeur) || 0;
      const apport = Number(p.apport) || Number(p.valeur) || 0;
      const contribs = p.peeContributions || [];
      const thisYearContrib = contribs.find(c => c.year === calYear);
      const annuel = thisYearContrib ? Number(thisYearContrib.montant) || 0 : 0;
      return `
        <div class="card-dark rounded-xl px-3 py-2 ${peeStyle.border} border transition hover:border-opacity-60">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <div class="w-2 h-2 rounded-full flex-shrink-0" style="background: ${peeStyle.color}"></div>
              <span class="text-xs font-semibold ${peeStyle.text} truncate">${p.nom || 'PEE'}</span>
            </div>
            ${annuel > 0 ? `<span class="text-[10px] text-teal-400/70">${formatCurrency(annuel)}/an</span>` : ''}
          </div>
          <div class="flex items-center justify-between">
            <p class="text-xs font-bold text-gray-200">${formatCurrency(apport)}</p>
            <p class="text-[10px] text-gray-500">valorisé ${formatCurrency(val)}</p>
          </div>
        </div>
      `;
    }).join('');

    listEl.innerHTML = headerHTML + cardsHTML;
  }

  function updateFlow(dcaByPlacement, dcaByGroup, totalDCA, calYear, childrenDCA = [], totalChildrenDCA = 0) {
    const flowEl = document.getElementById('rep-flow');
    if (!flowEl) return;

    // Merge CTO sub-groups (CTO TR, CTO BB, CTO) into single "CTO" for display
    const mergedDcaByGroup = {};
    for (const [gk, v] of Object.entries(dcaByGroup)) {
      if (gk.startsWith('CTO')) {
        mergedDcaByGroup['CTO'] = (mergedDcaByGroup['CTO'] || 0) + v;
      } else {
        mergedDcaByGroup[gk] = (mergedDcaByGroup[gk] || 0) + v;
      }
    }
    // Also remap dcaByPlacement group keys for CTO
    const mergedDcaByPlacement = dcaByPlacement.map(p => p.gk.startsWith('CTO') ? { ...p, gk: 'CTO' } : p);

    // Sort groups by DCA amount descending
    const sortedGroups = Object.entries(mergedDcaByGroup)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    // Source card
    const grandTotal = totalDCA + totalChildrenDCA;
    const sourceHTML = `
      <div class="flex justify-center mb-2">
        <div class="card-dark rounded-xl px-5 py-3 text-center inline-block border border-accent-amber/20">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Investissement mensuel total</p>
          <p class="text-2xl font-extrabold text-accent-amber">${formatCurrency(grandTotal)}</p>
          ${totalChildrenDCA > 0 ? `<p class="text-[10px] text-gray-500 mt-0.5">${formatCurrency(totalDCA)} moi · ${formatCurrency(totalChildrenDCA)} enfants</p>` : ''}
        </div>
      </div>
    `;

    // SVG connector
    const connectorHTML = `
      <div id="rep-flow-svg-wrap" class="hidden lg:block" style="height:45px;">
        <svg id="rep-flow-svg" class="w-full" style="height:45px;" fill="none">
          <defs>
            <filter id="glow-flow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
          </defs>
        </svg>
      </div>
    `;

    // Destination cards with inline editing
    const destCardsHTML = sortedGroups.map(([gk, amount]) => {
      const style = getGroupStyle(gk);
      const pct = totalDCA > 0 ? (amount / totalDCA * 100).toFixed(1) : 0;
      const placementsInGroup = mergedDcaByPlacement.filter(p => p.gk === gk && p.dca > 0);

      return `
        <div id="rep-flow-card-${gk.replace(/\s+/g, '-')}" class="card-dark rounded-xl p-3 ${style.border} border hover:border-opacity-60 transition">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full" style="background: ${style.color}"></div>
              <span class="text-sm font-semibold ${style.text} whitespace-nowrap">${gk === 'Assurance Vie' ? 'Ass. Vie' : gk}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-gray-200">${formatCurrency(amount)}</span>
              <span class="text-[10px] text-gray-500">${pct}%</span>
            </div>
          </div>
          <div class="w-full h-1.5 bg-dark-600 rounded-full overflow-hidden mb-2">
            <div class="h-full rounded-full transition-all duration-500" style="width: ${pct}%; background: ${style.color}"></div>
          </div>
          <div class="space-y-1">
            ${placementsInGroup.map(p => `
              <div class="flex items-center justify-between group/item hover:bg-dark-700/40 rounded px-1.5 py-0.5 -mx-1.5 transition cursor-pointer" data-edit-placement="${p.id}">
                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                  <span class="text-[11px] text-gray-400 truncate" title="${p.nom}">${p.nom}</span>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <input type="number" class="rep-inline-dca input-field w-14 px-1 py-0.5 text-[11px] text-center"
                    value="${p.dca}" min="0" step="10" data-dca-id="${p.id}" title="Modifier le DCA mensuel">
                  <span class="text-[10px] text-gray-600">€/m</span>
                  <button class="rep-edit-btn opacity-0 group-hover/item:opacity-100 text-gray-500 hover:text-accent-blue transition" data-edit-id="${p.id}" title="Modifier">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button class="rep-del-btn opacity-0 group-hover/item:opacity-100 text-gray-500 hover:text-red-400 transition" data-del-id="${p.id}" title="Supprimer">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Add empty state with add button
    const emptyGroupHTML = totalDCA <= 0 ? `
      <div class="flex flex-col items-center justify-center py-8 text-center">
        <p class="text-gray-600 text-sm mb-3">Aucun investissement programmé pour ${calYear}</p>
        <button class="rep-add-inline flex items-center gap-1.5 px-3 py-2 bg-accent-green/15 text-accent-green rounded-lg hover:bg-accent-green/25 transition text-sm font-medium">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          Ajouter un placement
        </button>
      </div>
    ` : '';

    // Children DCA cards
    const childrenCardsHTML = childrenDCA.length > 0 ? `
      <div class="mt-4 pt-4 border-t border-dark-400/20">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">DCA Enfants</span>
          <span class="text-xs font-bold text-gray-300 ml-auto">${formatCurrency(totalChildrenDCA)}/mois</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 ${childrenDCA.length >= 3 ? 'lg:grid-cols-3' : ''} gap-2">
          ${childrenDCA.map(c => {
            const color = CHILD_FLOW_COLORS[c.idx % CHILD_FLOW_COLORS.length];
            const pct = grandTotal > 0 ? (c.totalDCA / grandTotal * 100).toFixed(1) : 0;
            return `
            <div class="card-dark rounded-xl p-3 border hover:border-opacity-60 transition" style="border-color: ${color}30">
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-2">
                  <div class="w-2.5 h-2.5 rounded-full" style="background: ${color}"></div>
                  <span class="text-sm font-semibold" style="color: ${color}">${c.enf.prenom || 'Enfant ' + (c.idx + 1)}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-gray-200">${formatCurrency(c.totalDCA)}</span>
                  <span class="text-[10px] text-gray-500">${pct}%</span>
                </div>
              </div>
              <div class="w-full h-1.5 bg-dark-600 rounded-full overflow-hidden mb-2">
                <div class="h-full rounded-full transition-all duration-500" style="width: ${pct}%; background: ${color}"></div>
              </div>
              <div class="space-y-1">
                ${c.placements.filter(p => p.dca > 0).map(p => `
                  <div class="flex items-center justify-between px-1.5 py-0.5 -mx-1.5">
                    <span class="text-[11px] text-gray-400 truncate flex-1" title="${p.nom}">${p.nom}</span>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                      <span class="text-[11px] text-gray-300 font-medium">${p.dca}</span>
                      <span class="text-[10px] text-gray-600">€/m</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    ` : '';

    flowEl.innerHTML = (totalDCA > 0 ? sourceHTML + connectorHTML : '') + `
      <div id="rep-flow-cards" class="grid grid-cols-1 sm:grid-cols-2 ${sortedGroups.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-2 flex-1">
        ${destCardsHTML}
      </div>
      ${childrenCardsHTML}
      ${emptyGroupHTML}
    `;

    // Attach event listeners
    attachFlowListeners();

    // Draw SVG connectors
    if (totalDCA > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          drawFlowConnectors(sortedGroups);
        });
      });
    }
  }

  function attachFlowListeners() {
    // Inline DCA editing
    document.querySelectorAll('.rep-inline-dca').forEach(input => {
      input.addEventListener('click', (e) => e.stopPropagation());
      input.addEventListener('change', (e) => {
        e.stopPropagation();
        const id = input.dataset.dcaId;
        const newDCA = parseFloat(input.value) || 0;
        store.updateItem('actifs.placements', id, { dcaMensuel: newDCA });
        refresh();
      });
    });

    // Edit buttons
    document.querySelectorAll('.rep-edit-btn, [data-edit-placement]').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't trigger if clicking on inline input or other buttons
        if (e.target.closest('.rep-inline-dca') || e.target.closest('.rep-del-btn') || e.target.closest('.rep-edit-btn')) {
          if (e.target.closest('.rep-edit-btn')) {
            e.stopPropagation();
            const id = e.target.closest('.rep-edit-btn').dataset.editId;
            openEditPlacementModal(store, navigate, 'repartition', id);
          }
          return;
        }
        const id = el.dataset.editPlacement;
        if (id) openEditPlacementModal(store, navigate, 'repartition', id);
      });
    });

    // Delete buttons
    document.querySelectorAll('.rep-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.delId;
        const p = placements.find(p => p.id === id);
        if (p && confirm(`Supprimer "${p.nom}" ?`)) {
          store.removeItem('actifs.placements', id);
          refresh();
        }
      });
    });

    // Inline add buttons
    document.querySelectorAll('.rep-add-inline').forEach(btn => {
      btn.addEventListener('click', () => {
        openAddPlacementModal(store, navigate, 'repartition');
      });
    });
  }

  function drawFlowConnectors(sortedGroups) {
    const svg = document.getElementById('rep-flow-svg');
    const wrap = document.getElementById('rep-flow-svg-wrap');
    if (!svg || !wrap) return;

    const wrapRect = wrap.getBoundingClientRect();
    const w = wrapRect.width;
    if (w <= 0) return;
    const h = 45;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    svg.querySelectorAll('path, circle').forEach(el => el.remove());

    const mid = w / 2;

    const cards = sortedGroups.map(([gk]) => {
      const el = document.getElementById(`rep-flow-card-${gk.replace(/\s+/g, '-')}`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { cx: r.left + r.width / 2 - wrapRect.left, color: getGroupStyle(gk).color };
    }).filter(Boolean);

    cards.forEach(({ cx, color }) => {
      const d = `M ${mid} 0 C ${mid} ${h * 0.55}, ${cx} ${h * 0.55}, ${cx} ${h}`;

      const glow2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow2.setAttribute('d', d);
      glow2.setAttribute('stroke', color);
      glow2.setAttribute('stroke-width', '6');
      glow2.setAttribute('fill', 'none');
      glow2.setAttribute('opacity', '0.15');
      glow2.setAttribute('filter', 'url(#glow-flow)');
      svg.appendChild(glow2);

      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glow.setAttribute('d', d);
      glow.setAttribute('stroke', color);
      glow.setAttribute('stroke-width', '3');
      glow.setAttribute('fill', 'none');
      glow.setAttribute('opacity', '0.35');
      glow.setAttribute('filter', 'url(#glow-flow)');
      svg.appendChild(glow);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', d);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('fill', 'none');
      line.setAttribute('opacity', '0.6');
      svg.appendChild(line);

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', h);
      dot.setAttribute('r', '2.5');
      dot.setAttribute('fill', color);
      dot.setAttribute('opacity', '0.7');
      svg.appendChild(dot);
    });

    if (cards.length > 0) {
      const topDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      topDot.setAttribute('cx', mid);
      topDot.setAttribute('cy', '0');
      topDot.setAttribute('r', '3');
      topDot.setAttribute('fill', '#c9a76c');
      topDot.setAttribute('opacity', '0.8');
      svg.appendChild(topDot);
    }
  }

  function updateTable(dcaByPlacement, snap, totalPlacements, calYear) {
    const tableYearEl = document.getElementById('rep-table-year');
    if (tableYearEl) tableYearEl.textContent = `- ${calYear}`;

    const tbody = document.getElementById('rep-table-body');
    if (!tbody) return;

    const placementById = snap.placementById || {};

    const rows = dcaByPlacement
      .map(p => ({
        id: p.id,
        nom: p.nom,
        gk: p.gk,
        dca: p.dca,
        value: placementById[p.id] || 0,
        style: getGroupStyle(p.gk)
      }))
      .sort((a, b) => b.value - a.value);

    tbody.innerHTML = rows.map(r => {
      const pct = totalPlacements > 0 ? (r.value / totalPlacements * 100).toFixed(1) : 0;
      return `
        <tr class="border-b border-dark-400/15 hover:bg-dark-700/30 transition group/row">
          <td class="py-2 px-2">
            <div class="flex items-center gap-2 cursor-pointer rep-table-edit" data-id="${r.id}">
              <div class="w-1.5 h-1.5 rounded-full" style="background: ${r.style.color}"></div>
              <span class="text-gray-200 font-medium hover:text-accent-blue transition">${r.nom}</span>
            </div>
          </td>
          <td class="py-2 px-2">
            <span class="text-[11px] px-2 py-0.5 rounded-full ${r.style.bg} ${r.style.text}">${r.gk}</span>
          </td>
          <td class="py-1.5 px-2 text-right">
            <input type="number" class="rep-table-dca input-field w-20 ${r.dca > 0 ? 'text-accent-amber' : 'text-gray-600'}"
              value="${r.dca}" min="0" step="10" data-dca-id="${r.id}">
          </td>
          <td class="py-2 px-2 text-right text-gray-200 font-medium">${formatCurrency(r.value)}</td>
          <td class="py-2 px-2 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <div class="w-16 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width: ${Math.min(pct, 100)}%; background: ${r.style.color}"></div>
              </div>
              <span class="text-[11px] text-gray-400 w-10 text-right">${pct}%</span>
            </div>
          </td>
          <td class="py-2 px-1 text-right">
            <div class="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition">
              <button class="rep-tbl-edit text-gray-500 hover:text-accent-blue transition" data-id="${r.id}" title="Modifier">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button class="rep-tbl-del text-gray-500 hover:text-red-400 transition" data-id="${r.id}" title="Supprimer">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Total row
    const totalDCA = rows.reduce((s, r) => s + r.dca, 0);
    tbody.innerHTML += `
      <tr class="border-t border-dark-400/40">
        <td class="py-2 px-2 text-gray-300 font-semibold" colspan="2">Total</td>
        <td class="py-2 px-2 text-right text-accent-amber font-bold">${formatCurrency(totalDCA)}</td>
        <td class="py-2 px-2 text-right text-gray-100 font-bold">${formatCurrency(totalPlacements)}</td>
        <td class="py-2 px-2 text-right text-gray-400 text-[11px]">100%</td>
        <td></td>
      </tr>
    `;

    // Attach table listeners
    attachTableListeners();
  }

  function attachTableListeners() {
    // Inline DCA editing in table
    document.querySelectorAll('.rep-table-dca').forEach(input => {
      input.addEventListener('change', () => {
        const id = input.dataset.dcaId;
        const newDCA = parseFloat(input.value) || 0;
        store.updateItem('actifs.placements', id, { dcaMensuel: newDCA });
        refresh();
      });
    });

    // Edit from table
    document.querySelectorAll('.rep-table-edit, .rep-tbl-edit').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        openEditPlacementModal(store, navigate, 'repartition', id);
      });
    });

    // Delete from table
    document.querySelectorAll('.rep-tbl-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const p = placements.find(p => p.id === id);
        if (p && confirm(`Supprimer "${p.nom}" ?`)) {
          store.removeItem('actifs.placements', id);
          refresh();
        }
      });
    });
  }

  function buildAreaChart() {
    const canvas = document.getElementById('rep-chart-area');
    if (!canvas) return;

    const labels = snapshots.map(s => s.calendarYear);

    const datasets = groupKeys.map((gk, i) => {
      const style = getGroupStyle(gk);
      return {
        label: gk,
        data: snapshots.map(s => (s.placementDetail || {})[gk] || 0),
        backgroundColor: style.color + '40',
        borderColor: style.color,
        borderWidth: 1.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 10,
        order: groupKeys.length - i
      };
    });

    datasets.push({
      label: 'Épargne',
      data: snapshots.map(s => s.epargne || 0),
      backgroundColor: '#6366f140',
      borderColor: '#6366f1',
      borderWidth: 1.5,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHitRadius: 10,
      order: 0
    });

    datasets.push({
      label: 'Immobilier',
      data: snapshots.map(s => s.immobilier || 0),
      backgroundColor: '#8b691440',
      borderColor: '#8b6914',
      borderWidth: 1.5,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHitRadius: 10,
      order: -1
    });

    createChart('rep-chart-area', {
      type: 'line',
      data: { labels, datasets },
      plugins: [legendStrikethroughPlugin],
      options: {
        scales: {
          x: {
            grid: { color: 'rgba(56,56,63,0.2)' },
            ticks: { color: '#6b6b75', font: { size: 10 }, maxTicksLimit: 10 }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(56,56,63,0.2)' },
            ticks: {
              color: '#6b6b75',
              font: { size: 10 },
              callback: v => v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? Math.round(v / 1000) + 'k' : v
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            onClick: (e, legendItem, legend) => {
              const idx = legendItem.datasetIndex;
              const ci = legend.chart;
              const meta = ci.getDatasetMeta(idx);
              meta.hidden = meta.hidden === null ? true : !meta.hidden;
              ci.update();
            },
            labels: {
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
              color: '#e5e7eb',
              font: { size: 10, family: 'Inter' },
              generateLabels: (chart) => {
                return chart.data.datasets.map((ds, i) => {
                  const meta = chart.getDatasetMeta(i);
                  const hidden = meta.hidden;
                  return {
                    text: ds.label,
                    fillStyle: hidden ? 'transparent' : ds.backgroundColor,
                    strokeStyle: hidden ? '#555' : ds.borderColor,
                    lineWidth: hidden ? 1 : ds.borderWidth,
                    fontColor: hidden ? '#555' : '#e5e7eb',
                    textDecoration: hidden ? 'line-through' : '',
                    hidden: false,
                    datasetIndex: i,
                    pointStyle: 'circle'
                  };
                });
              }
            }
          }
        }
      }
    });
  }

  function buildDCAChart() {
    const canvas = document.getElementById('rep-chart-dca');
    if (!canvas) return;

    const labels = snapshots.map(s => s.calendarYear);

    const dcaDataByGroup = {};
    groupKeys.forEach(gk => { dcaDataByGroup[gk] = []; });

    snapshots.forEach(s => {
      const effectif = s.dcaMensuelEffectif || {};
      groupKeys.forEach(gk => {
        dcaDataByGroup[gk].push(effectif[gk] || 0);
      });
    });

    const activeGroups = groupKeys.filter(gk =>
      dcaDataByGroup[gk].some(v => v > 0)
    );

    const datasets = activeGroups.map((gk) => {
      const style = getGroupStyle(gk);
      return {
        label: gk,
        data: dcaDataByGroup[gk],
        backgroundColor: style.color + '80',
        borderColor: style.color,
        borderWidth: 1,
        borderRadius: 3,
      };
    });

    createChart('rep-chart-dca', {
      type: 'bar',
      data: { labels, datasets },
      plugins: [legendStrikethroughPlugin],
      options: {
        scales: {
          x: {
            stacked: true,
            grid: { color: 'rgba(56,56,63,0.2)' },
            ticks: { color: '#6b6b75', font: { size: 10 }, maxTicksLimit: 10 }
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(56,56,63,0.2)' },
            ticks: {
              color: '#6b6b75',
              font: { size: 10 },
              callback: v => formatCurrency(v)
            }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            onClick: (e, legendItem, legend) => {
              const idx = legendItem.datasetIndex;
              const ci = legend.chart;
              const meta = ci.getDatasetMeta(idx);
              meta.hidden = meta.hidden === null ? true : !meta.hidden;
              ci.update();
            },
            labels: {
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 8,
              boxHeight: 8,
              color: '#e5e7eb',
              font: { size: 10, family: 'Inter' },
              generateLabels: (chart) => {
                return chart.data.datasets.map((ds, i) => {
                  const meta = chart.getDatasetMeta(i);
                  const hidden = meta.hidden;
                  return {
                    text: ds.label,
                    fillStyle: hidden ? 'transparent' : ds.backgroundColor,
                    strokeStyle: hidden ? '#555' : ds.borderColor,
                    lineWidth: hidden ? 1 : ds.borderWidth,
                    fontColor: hidden ? '#555' : '#e5e7eb',
                    textDecoration: hidden ? 'line-through' : '',
                    hidden: false,
                    datasetIndex: i,
                    pointStyle: 'circle'
                  };
                });
              }
            }
          }
        }
      }
    });
  }

  // Redraw connectors on resize
  window.addEventListener('resize', () => {
    const slider = document.getElementById('rep-slider');
    if (slider) updateForYear(parseInt(slider.value));
  });
}
