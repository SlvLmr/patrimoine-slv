import { formatCurrency, openModal, inputField, selectField, getFormData } from '../utils.js?v=5';
import { createChart, VIVID_PALETTE, createVerticalGradient, COLORS } from '../charts/chart-config.js';

// ============================================================================
// PROJECTION ENFANTS — Portefeuille & projection dédiée par enfant
// ============================================================================

const CHILD_ENVELOPPES = [
  { value: 'CTO', label: 'Compte-Titres (CTO)' },
  { value: 'AV', label: 'Assurance Vie' },
  { value: 'Crypto', label: 'Crypto' },
];

const CHILD_CATEGORIES = [
  { value: 'ETF', label: 'ETF (Tracker)' },
  { value: 'Action', label: 'Action individuelle' },
  { value: 'Crypto', label: 'Cryptomonnaie' },
  { value: 'Autre', label: 'Autre' },
];

const CHILD_COLORS = ['#a855f7', '#06b6d4']; // purple, cyan

function getEnfants(store) {
  const cfg = store.get('donationConfig') || { enfants: [] };
  return cfg.enfants || [];
}

function saveEnfants(store, enfants) {
  const cfg = store.get('donationConfig') || {};
  cfg.enfants = enfants;
  store.set('donationConfig', cfg);
}

function childAge(dateNaissance) {
  if (!dateNaissance) return null;
  return Math.floor((Date.now() - new Date(dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Compute projection for a single child ──────────────────────────────────

function computeChildProjection(enfant, horizonAge) {
  const age = childAge(enfant.dateNaissance) || 0;
  const years = Math.max(1, horizonAge - age);
  const livrets = enfant.livrets || [];
  const placements = enfant.placements || [];
  const currentYear = new Date().getFullYear();

  // Total livrets with compound interest
  let livretTotal = livrets.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const avgLivretRate = livrets.length > 0
    ? livrets.reduce((s, l) => s + (Number(l.taux) || 0) * (Number(l.montant) || 0), 0) / (livretTotal || 1) / 100
    : 0.03;

  // Placements grouped
  const groupKeys = [];
  const groupMap = {};
  for (const p of placements) {
    const env = p.enveloppe || 'CTO';
    const cat = p.categorie || '';
    let key = env;
    if (env === 'CTO') {
      if (cat.includes('ETF')) key = 'CTO ETF';
      else if (cat.includes('Action')) key = 'CTO Actions';
      else if (cat === 'Crypto') key = 'Crypto';
      else key = 'CTO';
    } else if (env === 'Crypto') {
      key = 'Crypto';
    } else if (env === 'AV') {
      key = 'Assurance Vie';
    }
    if (!groupMap[key]) { groupMap[key] = []; groupKeys.push(key); }
    groupMap[key].push(p);
  }

  const snapshots = [];
  // Track per-group values
  const groupValues = {};
  const groupApports = {};
  for (const k of groupKeys) {
    groupValues[k] = groupMap[k].reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
    groupApports[k] = groupMap[k].reduce((s, p) => s + (Number(p.apport) || 0), 0);
  }

  const defaultRendement = 0.07; // 7% par défaut pour les placements

  for (let y = 0; y <= years; y++) {
    const yearLivret = livretTotal;
    const yearPlacTotal = groupKeys.reduce((s, k) => s + groupValues[k], 0);
    const detail = {};
    for (const k of groupKeys) detail[k] = Math.round(groupValues[k]);

    snapshots.push({
      annee: y,
      calendarYear: currentYear + y,
      label: `${currentYear + y}`,
      age: age + y,
      livrets: Math.round(yearLivret),
      placements: Math.round(yearPlacTotal),
      total: Math.round(yearLivret + yearPlacTotal),
      placementDetail: { ...detail },
    });

    // Grow livrets
    livretTotal *= (1 + avgLivretRate);

    // Grow placements + DCA
    for (const k of groupKeys) {
      const monthlyDca = groupMap[k].reduce((s, p) => s + (Number(p.dcaMensuel) || 0), 0);
      groupValues[k] = groupValues[k] * (1 + defaultRendement) + monthlyDca * 12;
      groupApports[k] += monthlyDca * 12;
    }
  }

  snapshots.groupKeys = groupKeys;
  return snapshots;
}

// ─── Render child tab content ────────────────────────────────────────────────

function renderChildTab(enfant, index) {
  const age = childAge(enfant.dateNaissance);
  const livrets = enfant.livrets || [];
  const placements = enfant.placements || [];
  const totalLivrets = livrets.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const totalPlacements = placements.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalPatrimoine = totalLivrets + totalPlacements;

  // Gains calculation
  const totalApports = placements.reduce((s, p) => s + (Number(p.apport) || 0), 0);
  const totalGains = totalPlacements - totalApports;
  const gainsPct = totalApports > 0 ? ((totalGains / totalApports) * 100).toFixed(1) : '0.0';

  return `
    <div class="space-y-6">
      <!-- Hero card -->
      <div class="card-dark rounded-2xl border border-dark-400/15 p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wider">Patrimoine total</p>
            <p class="text-3xl font-bold text-gray-100 mt-1">${formatCurrency(totalPatrimoine)}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-500">Performance</p>
            <p class="text-lg font-bold ${totalGains >= 0 ? 'text-emerald-400' : 'text-red-400'}">${totalGains >= 0 ? '+' : ''}${formatCurrency(totalGains)} <span class="text-sm">(${totalGains >= 0 ? '+' : ''}${gainsPct}%)</span></p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="rounded-xl bg-dark-600/20 border border-dark-400/10 p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Livrets</p>
            <p class="text-lg font-bold text-amber-400 mt-0.5">${formatCurrency(totalLivrets)}</p>
          </div>
          <div class="rounded-xl bg-dark-600/20 border border-dark-400/10 p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Investissements</p>
            <p class="text-lg font-bold text-blue-400 mt-0.5">${formatCurrency(totalPlacements)}</p>
          </div>
        </div>
      </div>

      <!-- Livrets -->
      <div class="card-dark rounded-xl border border-dark-400/15 overflow-hidden">
        <div class="px-5 py-3.5 border-b border-dark-400/10 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-200">Livrets d'épargne</h3>
          <p class="text-xs text-gray-500">${livrets.length} compte${livrets.length > 1 ? 's' : ''}</p>
        </div>
        <div class="divide-y divide-dark-400/10">
          ${livrets.length === 0 ? `
          <div class="px-5 py-4 text-center">
            <p class="text-xs text-gray-500 italic">Aucun livret — ajoutez-en dans la page Compte</p>
          </div>` : livrets.map(l => `
          <div class="px-5 py-3 flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-200 font-medium">${l.nom || 'Livret'}</p>
              <p class="text-[10px] text-gray-500">Taux : ${Number(l.taux || 0).toFixed(1)} %</p>
            </div>
            <p class="text-sm font-bold text-gray-200">${formatCurrency(Number(l.montant) || 0)}</p>
          </div>`).join('')}
        </div>
      </div>

      <!-- Investissements -->
      <div class="card-dark rounded-xl border border-dark-400/15 overflow-hidden">
        <div class="px-5 py-3.5 border-b border-dark-400/10 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-200">Investissements</h3>
          <button class="pe-add-placement px-3 py-1.5 rounded-lg text-[11px] font-medium bg-gradient-to-r from-accent-green to-accent-blue text-white hover:opacity-90 transition flex items-center gap-1" data-child-idx="${index}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
            Ajouter
          </button>
        </div>
        ${placements.length === 0 ? `
        <div class="px-5 py-8 text-center">
          <p class="text-gray-500 text-sm">Aucun placement</p>
          <p class="text-[11px] text-gray-600 mt-1">Ajoutez des ETF, actions ou crypto pour commencer le suivi</p>
        </div>` : `
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-dark-400/15 text-gray-500">
                <th class="text-left px-5 py-2.5 font-medium">Nom</th>
                <th class="text-left px-3 py-2.5 font-medium">Env.</th>
                <th class="text-right px-3 py-2.5 font-medium">Apport</th>
                <th class="text-right px-3 py-2.5 font-medium">Valeur</th>
                <th class="text-right px-3 py-2.5 font-medium">+/−</th>
                <th class="text-right px-3 py-2.5 font-medium">DCA</th>
                <th class="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/10">
              ${placements.map(p => {
                const val = Number(p.valeur) || Number(p.apport) || 0;
                const apport = Number(p.apport) || 0;
                const pv = p.quantite && p.pru ? (val - Number(p.pru) * Number(p.quantite)) : (val - apport);
                const pvPct = apport > 0 ? ((pv / apport) * 100).toFixed(1) : '0.0';
                const dca = Number(p.dcaMensuel) || 0;
                return `
              <tr class="hover:bg-dark-600/20 transition">
                <td class="px-5 py-3">
                  <p class="text-sm text-gray-200 font-medium">${p.nom || '—'}</p>
                  <p class="text-[10px] text-gray-500">${p.categorie || ''}</p>
                </td>
                <td class="px-3 py-3"><span class="text-[10px] px-1.5 py-0.5 rounded bg-dark-600/50 text-gray-400">${p.enveloppe || 'CTO'}</span></td>
                <td class="px-3 py-3 text-right text-gray-400">${formatCurrency(apport)}</td>
                <td class="px-3 py-3 text-right text-gray-200 font-medium">${formatCurrency(val)}</td>
                <td class="px-3 py-3 text-right font-medium ${pv >= 0 ? 'text-emerald-400' : 'text-red-400'}">${pv >= 0 ? '+' : ''}${formatCurrency(pv)} <span class="text-[9px]">(${pv >= 0 ? '+' : ''}${pvPct}%)</span></td>
                <td class="px-3 py-3 text-right text-gray-400">${dca > 0 ? `${formatCurrency(dca)}/m` : '—'}</td>
                <td class="px-3 py-3 text-right">
                  <div class="flex items-center gap-1 justify-end">
                    <button class="pe-edit-placement p-1 rounded hover:bg-dark-500 text-gray-500 hover:text-accent-green transition" data-child-idx="${index}" data-placement-id="${p.id}" title="Modifier">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button class="pe-del-placement p-1 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition" data-child-idx="${index}" data-placement-id="${p.id}" title="Supprimer">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`}
      </div>

      <!-- Projection chart -->
      <div class="card-dark rounded-xl border border-dark-400/15 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-gray-200">Projection</h3>
          <div class="flex items-center gap-2">
            <label class="text-[10px] text-gray-500">Horizon</label>
            <select id="pe-horizon-${index}" class="bg-dark-800 border border-dark-400/50 rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent-green transition">
              <option value="18" ${age && age < 18 ? 'selected' : ''}>18 ans</option>
              <option value="21">21 ans</option>
              <option value="25" ${!age || age >= 18 ? 'selected' : ''}>25 ans</option>
              <option value="30">30 ans</option>
            </select>
          </div>
        </div>
        <div class="h-72">
          <canvas id="pe-chart-${index}"></canvas>
        </div>
      </div>
    </div>`;
}

// ─── Render comparatif tab ───────────────────────────────────────────────────

function renderComparatif(enfants) {
  if (enfants.length < 2) return '<p class="text-gray-500 text-sm text-center py-8">Ajoutez au moins 2 enfants pour voir le comparatif.</p>';

  return `
    <div class="space-y-6">
      <!-- Table comparatif -->
      <div class="card-dark rounded-xl border border-dark-400/15 overflow-hidden">
        <div class="px-5 py-3.5 border-b border-dark-400/10">
          <h3 class="text-sm font-semibold text-gray-200">Comparatif</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-dark-400/15 text-gray-500">
                <th class="text-left px-5 py-3 font-medium"></th>
                ${enfants.map((e, i) => `<th class="text-right px-5 py-3 font-medium" style="color: ${CHILD_COLORS[i % CHILD_COLORS.length]}">${e.prenom || 'Enfant ' + (i + 1)}</th>`).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/10">
              ${[
                { label: 'Âge', fn: e => { const a = childAge(e.dateNaissance); return a !== null ? a + ' ans' : '—'; } },
                { label: 'Livrets', fn: e => formatCurrency((e.livrets || []).reduce((s, l) => s + (Number(l.montant) || 0), 0)) },
                { label: 'Investissements', fn: e => formatCurrency((e.placements || []).reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0)) },
                { label: 'Total apports', fn: e => formatCurrency((e.placements || []).reduce((s, p) => s + (Number(p.apport) || 0), 0)) },
                { label: 'Gains', fn: e => {
                  const val = (e.placements || []).reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
                  const app = (e.placements || []).reduce((s, p) => s + (Number(p.apport) || 0), 0);
                  const g = val - app;
                  return `<span class="${g >= 0 ? 'text-emerald-400' : 'text-red-400'}">${g >= 0 ? '+' : ''}${formatCurrency(g)}</span>`;
                }},
                { label: 'Patrimoine total', fn: e => {
                  const l = (e.livrets || []).reduce((s, li) => s + (Number(li.montant) || 0), 0);
                  const p = (e.placements || []).reduce((s, pl) => s + (Number(pl.valeur) || Number(pl.apport) || 0), 0);
                  return `<span class="text-gray-200 font-bold">${formatCurrency(l + p)}</span>`;
                }},
              ].map(row => `
              <tr class="hover:bg-dark-600/20 transition">
                <td class="px-5 py-3 text-gray-400 font-medium">${row.label}</td>
                ${enfants.map(e => `<td class="px-5 py-3 text-right text-gray-300">${row.fn(e)}</td>`).join('')}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Chart comparatif -->
      <div class="card-dark rounded-xl border border-dark-400/15 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-gray-200">Projection comparée</h3>
          <div class="flex items-center gap-2">
            <label class="text-[10px] text-gray-500">Horizon</label>
            <select id="pe-horizon-compare" class="bg-dark-800 border border-dark-400/50 rounded-lg px-2.5 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent-green transition">
              <option value="18">18 ans</option>
              <option value="25" selected>25 ans</option>
              <option value="30">30 ans</option>
            </select>
          </div>
        </div>
        <div class="h-72">
          <canvas id="pe-chart-compare"></canvas>
        </div>
      </div>
    </div>`;
}

// ─── Main render ─────────────────────────────────────────────────────────────

export function render(store) {
  const enfants = getEnfants(store);
  const activeTab = store.get('_peActiveTab') || (enfants.length > 0 ? '0' : 'compare');

  if (enfants.length === 0) {
    return `
    <div class="space-y-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-100">Enfants</h1>
          <p class="text-xs text-gray-500">Ajoutez des enfants dans la page Compte pour commencer</p>
        </div>
      </div>
    </div>`;
  }

  return `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-100">Enfants</h1>
          <p class="text-xs text-gray-500">Portefeuille & projection · ${enfants.length} enfant${enfants.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 bg-dark-800/50 rounded-xl p-1 border border-dark-400/15">
        ${enfants.map((e, i) => `
        <button class="pe-tab flex-1 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-150
          ${String(i) === activeTab
            ? 'bg-dark-600 text-gray-100 shadow-sm'
            : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700/30'
          }" data-tab="${i}">
          <span class="inline-block w-2 h-2 rounded-full mr-1.5" style="background: ${CHILD_COLORS[i % CHILD_COLORS.length]}"></span>
          ${e.prenom || 'Enfant ' + (i + 1)}${childAge(e.dateNaissance) !== null ? ` · ${childAge(e.dateNaissance)} ans` : ''}
        </button>`).join('')}
        ${enfants.length >= 2 ? `
        <button class="pe-tab flex-1 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-150
          ${'compare' === activeTab
            ? 'bg-dark-600 text-gray-100 shadow-sm'
            : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700/30'
          }" data-tab="compare">
          <svg class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          Comparatif
        </button>` : ''}
      </div>

      <!-- Tab content -->
      <div id="pe-tab-content">
        ${activeTab === 'compare'
          ? renderComparatif(enfants)
          : renderChildTab(enfants[parseInt(activeTab)] || enfants[0], parseInt(activeTab) || 0)
        }
      </div>
    </div>`;
}

// ─── Chart drawing ───────────────────────────────────────────────────────────

function drawChildChart(enfant, index, horizonAge) {
  const canvasId = `pe-chart-${index}`;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const snapshots = computeChildProjection(enfant, horizonAge);
  const labels = snapshots.map(s => s.label);
  const ctx = canvas.getContext('2d');

  const datasets = [];

  // Livrets
  const livretColor = '#f59e0b';
  datasets.push({
    label: 'Livrets',
    data: snapshots.map(s => s.livrets),
    borderColor: livretColor,
    backgroundColor: createVerticalGradient(ctx, livretColor, 0.15, 0.02),
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    borderWidth: 2,
  });

  // Placement groups
  const palette = ['#3b82f6', '#a855f7', '#06b6d4', '#ec4899', '#f97316'];
  (snapshots.groupKeys || []).forEach((k, ki) => {
    const color = palette[ki % palette.length];
    datasets.push({
      label: k,
      data: snapshots.map(s => s.placementDetail[k] || 0),
      borderColor: color,
      backgroundColor: createVerticalGradient(ctx, color, 0.15, 0.02),
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2,
    });
  });

  // Total line
  datasets.push({
    label: 'Total',
    data: snapshots.map(s => s.total),
    borderColor: '#c9a76c',
    borderWidth: 2.5,
    borderDash: [6, 3],
    tension: 0.4,
    pointRadius: 0,
    fill: false,
  });

  createChart(canvasId, {
    type: 'line',
    data: { labels, datasets },
    options: {
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: { grid: { display: false }, ticks: { color: COLORS.gridText, maxTicksLimit: 10 } },
        y: {
          grid: { color: COLORS.grid },
          ticks: {
            color: COLORS.gridText,
            callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
          }
        }
      }
    }
  });
}

function drawCompareChart(enfants, horizonAge) {
  const canvasId = 'pe-chart-compare';
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const datasets = [];
  let maxLen = 0;
  let labels = [];

  enfants.forEach((enf, i) => {
    const snapshots = computeChildProjection(enf, horizonAge);
    if (snapshots.length > maxLen) {
      maxLen = snapshots.length;
      labels = snapshots.map(s => s.label);
    }
    const color = CHILD_COLORS[i % CHILD_COLORS.length];
    datasets.push({
      label: enf.prenom || 'Enfant ' + (i + 1),
      data: snapshots.map(s => s.total),
      borderColor: color,
      backgroundColor: createVerticalGradient(ctx, color, 0.12, 0.02),
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2.5,
    });
  });

  createChart(canvasId, {
    type: 'line',
    data: { labels, datasets },
    options: {
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: { grid: { display: false }, ticks: { color: COLORS.gridText, maxTicksLimit: 10 } },
        y: {
          grid: { color: COLORS.grid },
          ticks: {
            color: COLORS.gridText,
            callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
          }
        }
      }
    }
  });
}

// ─── Placement modal ─────────────────────────────────────────────────────────

function buildPlacementForm(item = {}) {
  return `
    <div class="space-y-3">
      ${inputField('nom', 'Nom du titre', item.nom || '', 'text', 'placeholder="Ex: MSCI World ETF"')}
      <div class="grid grid-cols-2 gap-3">
        ${selectField('enveloppe', 'Enveloppe', CHILD_ENVELOPPES, item.enveloppe || 'CTO')}
        ${selectField('categorie', 'Catégorie', CHILD_CATEGORIES, item.categorie || 'ETF')}
      </div>
      <div class="grid grid-cols-2 gap-3">
        ${inputField('quantite', 'Quantité', item.quantite || '', 'number', 'step="0.0001"')}
        ${inputField('pru', 'PRU (€)', item.pru || '', 'number', 'step="0.01"')}
      </div>
      <div class="grid grid-cols-2 gap-3">
        ${inputField('apport', 'Apport total (€)', item.apport || '', 'number', 'step="1"')}
        ${inputField('valeur', 'Valeur actuelle (€)', item.valeur || '', 'number', 'step="1"')}
      </div>
      ${inputField('dcaMensuel', 'DCA mensuel (€/mois)', item.dcaMensuel || '', 'number', 'step="1"')}
    </div>`;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mount(store, navigate) {
  const enfants = getEnfants(store);
  const activeTab = store.get('_peActiveTab') || (enfants.length > 0 ? '0' : 'compare');

  function refresh() {
    const el = document.getElementById('app-content');
    if (el) { el.innerHTML = render(store); mount(store, navigate); }
  }

  // Tab switching
  document.querySelectorAll('.pe-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      store.set('_peActiveTab', btn.dataset.tab);
      refresh();
    });
  });

  // Draw charts
  if (activeTab === 'compare') {
    const sel = document.getElementById('pe-horizon-compare');
    const horizon = parseInt(sel?.value) || 25;
    drawCompareChart(enfants, horizon);
    sel?.addEventListener('change', () => drawCompareChart(enfants, parseInt(sel.value) || 25));
  } else {
    const idx = parseInt(activeTab) || 0;
    const enf = enfants[idx];
    if (enf) {
      const sel = document.getElementById(`pe-horizon-${idx}`);
      const horizon = parseInt(sel?.value) || 25;
      drawChildChart(enf, idx, horizon);
      sel?.addEventListener('change', () => drawChildChart(enf, idx, parseInt(sel.value) || 25));
    }
  }

  // Add placement
  document.querySelectorAll('.pe-add-placement').forEach(btn => {
    btn.addEventListener('click', () => {
      const childIdx = parseInt(btn.dataset.childIdx);
      openModal('Ajouter un placement', buildPlacementForm(), () => {
        const data = getFormData(document.getElementById('modal-body'));
        const enfs = getEnfants(store);
        if (!enfs[childIdx]) return;
        if (!enfs[childIdx].placements) enfs[childIdx].placements = [];
        data.id = generateId();
        enfs[childIdx].placements.push(data);
        saveEnfants(store, enfs);
        refresh();
      });
    });
  });

  // Edit placement
  document.querySelectorAll('.pe-edit-placement').forEach(btn => {
    btn.addEventListener('click', () => {
      const childIdx = parseInt(btn.dataset.childIdx);
      const placementId = btn.dataset.placementId;
      const enfs = getEnfants(store);
      const enf = enfs[childIdx];
      if (!enf) return;
      const item = (enf.placements || []).find(p => p.id === placementId);
      if (!item) return;
      openModal('Modifier le placement', buildPlacementForm(item), () => {
        const data = getFormData(document.getElementById('modal-body'));
        Object.assign(item, data);
        saveEnfants(store, enfs);
        refresh();
      });
    });
  });

  // Delete placement
  document.querySelectorAll('.pe-del-placement').forEach(btn => {
    btn.addEventListener('click', () => {
      const childIdx = parseInt(btn.dataset.childIdx);
      const placementId = btn.dataset.placementId;
      const enfs = getEnfants(store);
      const enf = enfs[childIdx];
      if (!enf) return;
      const item = (enf.placements || []).find(p => p.id === placementId);
      if (item && confirm(`Supprimer « ${item.nom || 'ce placement'} » ?`)) {
        enf.placements = (enf.placements || []).filter(p => p.id !== placementId);
        saveEnfants(store, enfs);
        refresh();
      }
    });
  });
}
