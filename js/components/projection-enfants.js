import { formatCurrency, openModal, inputField, selectField, getFormData } from '../utils.js?v=5';
import { createChart, VIVID_PALETTE, createVerticalGradient, COLORS } from '../charts/chart-config.js';

// ============================================================================
// PROJECTION ENFANTS — Miroir de la page Projection, dédié aux enfants
// ============================================================================

const CHILD_ENVELOPPES = [
  { value: 'CTO', label: 'CTO' },
  { value: 'PEA', label: 'PEA' },
  { value: 'AV', label: 'Assurance Vie' },
  { value: 'Crypto', label: 'Crypto' },
];

const CHILD_CATEGORIES = [
  { value: 'ETF', label: 'ETF (Tracker)' },
  { value: 'Action', label: 'Action individuelle' },
  { value: 'Crypto', label: 'Cryptomonnaie' },
  { value: 'Autre', label: 'Autre' },
];

const CHILD_COLORS = ['#a855f7', '#06b6d4'];
const DEFAULT_RENDEMENT = 0.07;
const FIXED_GROUP_KEYS = ['ETF (CTO)', 'Actions (CTO)', 'ETF (PEA)', 'Actions (PEA)', 'Bitcoin', 'Assurance Vie'];

// ─── Fiscalité ───────────────────────────────────────────────────────────────
const PFU_RATE = 0.314;   // Flat tax: 14.2% IR + 17.2% PS
const PS_RATE  = 0.172;   // Prélèvements sociaux seuls
const AV_RATE_AFTER8 = 0.247; // AV > 8 ans: 17.2% PS + 7.5% IR

function getEnfants(store) {
  const cfg = store.get('donationConfig') || { enfants: [] };
  return cfg.enfants || [];
}
function saveEnfants(store, enfants) {
  const cfg = store.get('donationConfig') || {};
  cfg.enfants = enfants;
  store.set('donationConfig', cfg);
}
function childAge(dob) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function getChildGroupKey(p) {
  const env = p.enveloppe || 'CTO';
  const cat = p.categorie || '';
  if (env === 'CTO') {
    if (cat.includes('ETF')) return 'ETF (CTO)';
    if (cat.includes('Action')) return 'Actions (CTO)';
    return 'ETF (CTO)'; // default CTO → ETF (CTO)
  }
  if (env === 'PEA') {
    if (cat.includes('Action')) return 'Actions (PEA)';
    return 'ETF (PEA)'; // default PEA → ETF (PEA)
  }
  if (env === 'Crypto') return 'Bitcoin';
  if (env === 'AV') return 'Assurance Vie';
  return 'ETF (CTO)';
}

function getTaxRate(groupKey, envelopeAge) {
  if (groupKey.includes('(PEA)')) return envelopeAge >= 5 ? PS_RATE : PFU_RATE;
  if (groupKey === 'Assurance Vie') return envelopeAge >= 8 ? AV_RATE_AFTER8 : PFU_RATE;
  // CTO, Bitcoin → flat tax
  return PFU_RATE;
}

// ─── Projection engine for one child ─────────────────────────────────────────

function computeChildProjection(enfant, horizonYears) {
  const livrets = enfant.livrets || [];
  const placements = enfant.placements || [];
  const currentYear = new Date().getFullYear();
  const rendements = enfant.rendementPlacements || {};
  const baseAge = childAge(enfant.dateNaissance);

  let livretTotal = livrets.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  const avgLivretRate = livrets.length > 0
    ? livrets.reduce((s, l) => s + (Number(l.taux) || 0) * (Number(l.montant) || 0), 0) / (livretTotal || 1) / 100
    : 0.03;

  // Group placements — always include all fixed columns
  const groupKeys = [...FIXED_GROUP_KEYS];
  const groups = {};
  for (const k of groupKeys) groups[k] = [];
  for (const p of placements) {
    const gk = getChildGroupKey(p);
    if (!groups[gk]) { groups[gk] = []; groupKeys.push(gk); }
    groups[gk].push(p);
  }

  // Init per-group tracking
  const gVal = {}, gApp = {}, gGain = {};
  for (const k of groupKeys) {
    gVal[k] = groups[k].reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
    gApp[k] = groups[k].reduce((s, p) => s + (Number(p.apport) || 0), 0);
    gGain[k] = gVal[k] - gApp[k];
  }

  const snapshots = [];
  for (let y = 0; y <= horizonYears; y++) {
    const placTotal = groupKeys.reduce((s, k) => s + gVal[k], 0);
    const totalApports = groupKeys.reduce((s, k) => s + gApp[k], 0);
    const totalGains = placTotal - totalApports;
    const detail = {}, apports = {}, gains = {}, netImpot = {};
    let totalNetImpot = 0;
    for (const k of groupKeys) {
      detail[k] = Math.round(gVal[k]);
      apports[k] = Math.round(gApp[k]);
      const gain = gVal[k] - gApp[k];
      gains[k] = Math.round(gain);
      const tax = getTaxRate(k, y);
      const net = gApp[k] + gain * (1 - tax);
      netImpot[k] = Math.round(net);
      totalNetImpot += net;
    }

    snapshots.push({
      annee: y,
      calendarYear: currentYear + y,
      label: `${currentYear + y}`,
      age: baseAge !== null ? baseAge + y : null,
      livrets: Math.round(livretTotal),
      placements: Math.round(placTotal),
      totalApports: Math.round(totalApports),
      totalGains: Math.round(totalGains),
      totalNetImpot: Math.round(totalNetImpot),
      total: Math.round(livretTotal + placTotal),
      totalNet: Math.round(livretTotal + totalNetImpot),
      placementDetail: { ...detail },
      placementApports: { ...apports },
      placementGains: { ...gains },
      placementNetImpot: { ...netImpot },
    });

    // Grow
    livretTotal *= (1 + avgLivretRate);
    for (const k of groupKeys) {
      const monthlyDca = groups[k].reduce((s, p) => s + (Number(p.dcaMensuel) || 0), 0);
      const rend = groups[k].reduce((s, p) => {
        const r = rendements[p.id] !== undefined ? rendements[p.id] : DEFAULT_RENDEMENT;
        return Math.max(s, r);
      }, DEFAULT_RENDEMENT);
      const yearlyDca = monthlyDca * 12;
      gVal[k] = gVal[k] * (1 + rend) + yearlyDca;
      gApp[k] += yearlyDca;
    }
  }
  snapshots.groupKeys = groupKeys;
  return snapshots;
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function render(store) {
  const enfants = getEnfants(store);
  const activeTab = store.get('_peActiveTab') || '0';

  if (enfants.length === 0) {
    return `<div class="space-y-6">
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

  const idx = activeTab === 'compare' ? -1 : (parseInt(activeTab) || 0);
  const enf = enfants[idx] || enfants[0];

  // Tabs
  const tabs = `
    <div class="flex gap-1 bg-dark-800/50 rounded-xl p-1 border border-dark-400/15">
      ${enfants.map((e, i) => `
      <button class="pe-tab flex-1 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-150
        ${String(i) === activeTab ? 'bg-dark-600 text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700/30'
      }" data-tab="${i}">
        <span class="inline-block w-2 h-2 rounded-full mr-1.5" style="background:${CHILD_COLORS[i % CHILD_COLORS.length]}"></span>
        ${e.prenom || 'Enfant ' + (i + 1)}${childAge(e.dateNaissance) !== null ? ' · ' + childAge(e.dateNaissance) + ' ans' : ''}
      </button>`).join('')}
      ${enfants.length >= 2 ? `
      <button class="pe-tab flex-1 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-150
        ${'compare' === activeTab ? 'bg-dark-600 text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700/30'
      }" data-tab="compare">Comparatif</button>` : ''}
    </div>`;

  if (activeTab === 'compare') {
    return `<div class="space-y-6">${renderHeader(enfants)}${tabs}${renderComparatif(enfants, store)}</div>`;
  }

  const horizonYears = Number(enf.horizonYears) || 20;
  const snapshots = computeChildProjection(enf, horizonYears);
  const groupKeys = snapshots.groupKeys || [];
  const placements = enf.placements || [];
  const rendements = enf.rendementPlacements || {};
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  return `
    <div class="space-y-6">
      ${renderHeader(enfants)}
      ${tabs}

      <!-- Parameters -->
      <details open class="card-dark rounded-xl border border-dark-400/15 overflow-hidden">
        <summary class="px-5 py-3 cursor-pointer flex items-center justify-between hover:bg-dark-700/30 transition select-none">
          <span class="text-sm font-semibold text-gray-200">Paramètres</span>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-4 space-y-3 border-t border-dark-400/15">
          <!-- Horizon -->
          <div class="flex items-center gap-4 mt-3">
            <label class="text-xs text-gray-500">Horizon</label>
            <input type="number" id="pe-horizon" value="${horizonYears}" min="1" max="40" step="1"
              class="w-16 bg-dark-800 border border-dark-400/50 rounded-lg px-2 py-1.5 text-sm text-gray-200 text-center focus:outline-none focus:border-accent-green transition">
            <span class="text-xs text-gray-500">ans</span>
          </div>
          <!-- Placements grid -->
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <span class="text-xs font-bold text-gray-300 uppercase tracking-wide">Placements</span>
              <button id="pe-add-plac" class="ml-2 w-7 h-7 flex items-center justify-center rounded-lg bg-accent-green/25 text-accent-green hover:bg-accent-green/40 transition text-lg font-bold" data-child-idx="${idx}" title="Ajouter">+</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
              ${placements.length > 0 ? placements.map(p => {
                const gk = getChildGroupKey(p);
                const rend = rendements[p.id] !== undefined ? rendements[p.id] : DEFAULT_RENDEMENT;
                const dca = Number(p.dcaMensuel) || 0;
                return `<div class="group/card flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-dark-800/30 border border-dark-400/15 hover:border-accent-blue/40 hover:bg-dark-700/40 transition">
                  <span class="text-sm text-gray-200 truncate max-w-[7rem] font-medium pe-edit-plac cursor-pointer" data-child-idx="${idx}" data-placement-id="${p.id}" title="${p.nom}">${p.nom}</span>
                  ${dca > 0 ? `<span class="text-[9px] text-gray-600">${dca}\u20ac/m</span>` : ''}
                  <span class="text-[10px] text-gray-500 ml-auto">${gk}</span>
                  <input type="number" class="pe-plac-rend w-14 px-1.5 py-1 text-sm bg-dark-900/60 border border-dark-400/25 rounded text-gray-200 focus:ring-1 focus:ring-accent-blue/30 text-center font-medium"
                    value="${(rend * 100).toFixed(1)}" min="-20" max="50" step="0.5" data-child-idx="${idx}" data-placement-id="${p.id}" onclick="event.stopPropagation()">
                  <span class="text-[10px] text-gray-500">%</span>
                  <button class="pe-del-plac opacity-0 group-hover/card:opacity-100 ml-0.5 text-accent-red/50 hover:text-accent-red text-xs transition" data-child-idx="${idx}" data-placement-id="${p.id}" onclick="event.stopPropagation()" title="Supprimer">\u2715</button>
                </div>`;
              }).join('') : '<p class="col-span-full text-center text-gray-600 text-sm py-3">Aucun placement — cliquez sur + pour en ajouter</p>'}
            </div>
          </div>
        </div>
      </details>

      <!-- KPI Cards -->
      ${renderKPICards(snapshots, first, last, horizonYears)}

      <!-- Chart -->
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Répartition des actifs dans le temps</h2>
        <div class="h-80">
          <canvas id="pe-chart-child"></canvas>
        </div>
      </div>

      <!-- Detailed Table -->
      ${renderTable(snapshots, groupKeys)}
    </div>`;
}

function renderHeader(enfants) {
  return `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center">
        <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
      </div>
      <div>
        <h1 class="text-xl font-bold text-gray-100">Enfants</h1>
        <p class="text-xs text-gray-500">Projection patrimoniale · ${enfants.length} enfant${enfants.length > 1 ? 's' : ''}</p>
      </div>
    </div>`;
}

function renderKPICards(snapshots, first, last, horizonYears) {
  const currentYear = new Date().getFullYear();
  const firstTotal = first?.total || 0;
  const targetYears = [5, 10, horizonYears].filter((v, i, a) => a.indexOf(v) === i && v > 0);

  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card-dark rounded-xl p-5">
        <p class="text-sm text-gray-400 mb-2">${first?.label || currentYear}</p>
        <p class="text-2xl font-bold text-gray-200">${formatCurrency(firstTotal)}</p>
        <div class="flex gap-3 mt-2 text-xs text-gray-500">
          <span>Livrets ${formatCurrency(first?.livrets || 0)}</span><span>·</span><span>Invest. ${formatCurrency(first?.placements || 0)}</span>
        </div>
      </div>
      ${targetYears.map((yr, i) => {
        const snap = snapshots.find(s => s.annee === yr) || last;
        const net = snap?.total || 0;
        const evol = net - firstTotal;
        const evolPct = firstTotal ? ((evol / Math.abs(firstTotal)) * 100).toFixed(0) : '0';
        return `
      <div class="card-dark rounded-xl p-5">
        <p class="text-sm text-gray-400 mb-2">${snap?.label || ''} <span class="text-gray-600">(+${yr} ans)</span></p>
        <p class="text-2xl font-bold gradient-text">${formatCurrency(net)}</p>
        <div class="flex gap-3 mt-2 text-xs">
          <span class="text-amber-400">Livrets ${formatCurrency(snap?.livrets || 0)}</span><span class="text-gray-600">·</span><span class="text-purple-400">Invest. ${formatCurrency(snap?.placements || 0)}</span>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <span class="text-sm ${evol >= 0 ? 'text-accent-green' : 'text-accent-red'}">${evol >= 0 ? '+' : ''}${formatCurrency(evol)}</span>
          <span class="text-xs px-1.5 py-0.5 rounded-full ${evol >= 0 ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}">${evol >= 0 ? '+' : ''}${evolPct}%</span>
        </div>
      </div>`;
      }).join('')}
    </div>`;
}

function renderTable(snapshots, groupKeys) {
  return `
    <div class="card-dark rounded-xl overflow-hidden">
      <div class="p-5 border-b border-dark-400/30">
        <h2 class="text-lg font-semibold text-gray-200">Détail année par année</h2>
        <p class="text-[10px] text-gray-600 mt-1">CTO/Crypto: flat tax 31,4% · PEA &gt;5 ans: 17,2% PS · PEA &lt;5 ans: 31,4% · AV &gt;8 ans: 24,7% · AV &lt;8 ans: 31,4%</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm table-fixed">
          <thead class="bg-dark-800/50 text-gray-500 text-[10px]">
            <tr>
              <th class="w-[72px] px-1 py-1.5 text-center">Année</th>
              <th class="w-[28px] px-0 py-1.5 text-center">An</th>
              <th class="w-[32px] px-0 py-1.5 text-center border-r-2 border-dark-300/40">Âge</th>
              ${groupKeys.map((k, i) => `<th class="px-1 py-1.5 text-center ${i === groupKeys.length - 1 ? 'border-r-2 border-dark-300/40' : ''}">${k}</th>`).join('')}
              <th class="px-1 py-1.5 text-center font-semibold text-gray-400">Apports</th>
              <th class="px-1 py-1.5 text-center font-semibold text-accent-green/70">Gain</th>
              <th class="px-1 py-1.5 text-center font-semibold border-r-2 border-dark-300/40">Net imp.</th>
              <th class="px-1 py-1.5 text-center border-r-2 border-dark-300/40">Livrets</th>
              <th class="px-1 py-1.5 text-center font-semibold text-accent-green">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-400/20">
            ${snapshots.map(s => {
              const isFiveYear = s.annee > 0 && s.annee % 5 === 0;
              const bt = isFiveYear ? 'border-t-2 border-t-dark-300/40' : '';
              const rowClass = s.annee === 0 ? 'bg-accent-blue/5' : '';
              return `
            <tr class="hover:bg-dark-600/30 transition ${rowClass} text-[11px]">
              <td class="px-1 py-1 text-center font-medium text-gray-200 ${bt}">${s.label}</td>
              <td class="px-0 py-1 text-center text-gray-500 ${bt}">${s.annee + 1}</td>
              <td class="px-0 py-1 text-center text-gray-400 border-r-2 border-dark-300/40 ${bt}">${s.age !== null ? s.age : '–'}</td>
              ${groupKeys.map((k, i) => {
                const val = s.placementDetail[k] || 0;
                const ap = s.placementApports[k] || 0;
                const extra = i === groupKeys.length - 1 ? 'border-r-2 border-dark-300/40' : '';
                return `<td class="px-1 py-0.5 text-center text-gray-200 ${bt} ${extra}">${val > 0 ? `${formatCurrency(val)}<div class="text-[8px] text-gray-500">${formatCurrency(ap)}</div>` : `<span class="text-gray-600">${formatCurrency(0)}</span>`}</td>`;
              }).join('')}
              <td class="px-1 py-0.5 text-center text-gray-400 font-semibold ${bt}">${formatCurrency(s.totalApports)}</td>
              <td class="px-1 py-0.5 text-center font-semibold ${bt} ${s.totalGains >= 0 ? 'text-accent-green/70' : 'text-red-400/70'}">${s.totalGains >= 0 ? '+' : ''}${formatCurrency(s.totalGains)}</td>
              <td class="px-1 py-0.5 text-center font-semibold text-gray-300 border-r-2 border-dark-300/40 ${bt}">${formatCurrency(s.totalNetImpot)}</td>
              <td class="px-1 py-1 text-center text-gray-200 border-r-2 border-dark-300/40 ${bt}">${formatCurrency(s.livrets)}</td>
              <td class="px-1 py-1 text-center font-semibold text-accent-green ${bt}">${formatCurrency(s.totalNet)}</td>
            </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ─── Comparatif ──────────────────────────────────────────────────────────────

function renderComparatif(enfants, store) {
  if (enfants.length < 2) return '<p class="text-gray-500 text-sm text-center py-8">Ajoutez au moins 2 enfants.</p>';
  return `
    <div class="space-y-6">
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="px-5 py-3.5 border-b border-dark-400/10">
          <h3 class="text-sm font-semibold text-gray-200">Comparatif</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead><tr class="border-b border-dark-400/15 text-gray-500">
              <th class="text-left px-5 py-3 font-medium"></th>
              ${enfants.map((e, i) => `<th class="text-right px-5 py-3 font-medium" style="color:${CHILD_COLORS[i % CHILD_COLORS.length]}">${e.prenom || 'Enfant ' + (i + 1)}</th>`).join('')}
            </tr></thead>
            <tbody class="divide-y divide-dark-400/10">
              ${[
                { label: 'Livrets', fn: e => formatCurrency((e.livrets || []).reduce((s, l) => s + (Number(l.montant) || 0), 0)) },
                { label: 'Investissements', fn: e => formatCurrency((e.placements || []).reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0)) },
                { label: 'Apports', fn: e => formatCurrency((e.placements || []).reduce((s, p) => s + (Number(p.apport) || 0), 0)) },
                { label: 'Gains', fn: e => {
                  const v = (e.placements || []).reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
                  const a = (e.placements || []).reduce((s, p) => s + (Number(p.apport) || 0), 0);
                  const g = v - a;
                  return `<span class="${g >= 0 ? 'text-emerald-400' : 'text-red-400'}">${g >= 0 ? '+' : ''}${formatCurrency(g)}</span>`;
                }},
                { label: 'Total', fn: e => {
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
      <div class="card-dark rounded-xl p-6">
        <h3 class="text-lg font-semibold text-gray-200 mb-4">Projection comparée</h3>
        <div class="h-80"><canvas id="pe-chart-compare"></canvas></div>
      </div>
    </div>`;
}

// ─── Charts ──────────────────────────────────────────────────────────────────

function drawChildChart(enfant, horizonYears) {
  const canvas = document.getElementById('pe-chart-child');
  if (!canvas) return;
  const snapshots = computeChildProjection(enfant, horizonYears);
  const labels = snapshots.map(s => s.label);
  const ctx = canvas.getContext('2d');
  const datasets = [];

  const livretColor = '#f59e0b';
  datasets.push({ label: 'Livrets', data: snapshots.map(s => s.livrets), borderColor: livretColor, backgroundColor: createVerticalGradient(ctx, livretColor, 0.15, 0.02), fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 });

  const palette = ['#3b82f6', '#a855f7', '#06b6d4', '#ec4899', '#f97316'];
  (snapshots.groupKeys || []).forEach((k, ki) => {
    const hasData = snapshots.some(s => (s.placementDetail[k] || 0) > 0);
    if (!hasData) return;
    const color = palette[ki % palette.length];
    datasets.push({ label: k, data: snapshots.map(s => s.placementDetail[k] || 0), borderColor: color, backgroundColor: createVerticalGradient(ctx, color, 0.15, 0.02), fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 });
  });

  datasets.push({ label: 'Total', data: snapshots.map(s => s.total), borderColor: '#c9a76c', borderWidth: 2.5, borderDash: [6, 3], tension: 0.4, pointRadius: 0, fill: false });

  createChart('pe-chart-child', { type: 'line', data: { labels, datasets }, options: {
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: { grid: { display: false }, ticks: { color: COLORS.gridText, maxTicksLimit: 12 } },
      y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.gridText, callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) } }
    }
  }});
}

function drawCompareChart(enfants) {
  const canvas = document.getElementById('pe-chart-compare');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const datasets = [];
  let labels = [];
  enfants.forEach((enf, i) => {
    const hz = Number(enf.horizonYears) || 20;
    const snaps = computeChildProjection(enf, hz);
    if (snaps.length > labels.length) labels = snaps.map(s => s.label);
    datasets.push({ label: enf.prenom || 'Enfant ' + (i + 1), data: snaps.map(s => s.total), borderColor: CHILD_COLORS[i % CHILD_COLORS.length], backgroundColor: createVerticalGradient(ctx, CHILD_COLORS[i % CHILD_COLORS.length], 0.12, 0.02), fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2.5 });
  });
  createChart('pe-chart-compare', { type: 'line', data: { labels, datasets }, options: {
    interaction: { intersect: false, mode: 'index' },
    scales: {
      x: { grid: { display: false }, ticks: { color: COLORS.gridText, maxTicksLimit: 12 } },
      y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.gridText, callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) } }
    }
  }});
}

// ─── Placement modal ─────────────────────────────────────────────────────────

function buildPlacementForm(item = {}) {
  return `<div class="space-y-3">
    ${inputField('nom', 'Nom du titre', item.nom || '', 'text', 'placeholder="Ex: MSCI World ETF"')}
    <div class="grid grid-cols-2 gap-3">
      ${selectField('enveloppe', 'Enveloppe', CHILD_ENVELOPPES, item.enveloppe || 'CTO')}
      ${selectField('categorie', 'Catégorie', CHILD_CATEGORIES, item.categorie || 'ETF')}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${inputField('quantite', 'Quantité', item.quantite || '', 'number', 'step="0.0001"')}
      ${inputField('pru', 'PRU (\u20ac)', item.pru || '', 'number', 'step="0.01"')}
    </div>
    <div class="grid grid-cols-2 gap-3">
      ${inputField('apport', 'Apport total (\u20ac)', item.apport || '', 'number', 'step="1"')}
      ${inputField('valeur', 'Valeur actuelle (\u20ac)', item.valeur || '', 'number', 'step="1"')}
    </div>
    ${inputField('dcaMensuel', 'DCA mensuel (\u20ac/mois)', item.dcaMensuel || '', 'number', 'step="1"')}
  </div>`;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mount(store, navigate) {
  const enfants = getEnfants(store);
  const activeTab = store.get('_peActiveTab') || '0';
  const idx = activeTab === 'compare' ? -1 : (parseInt(activeTab) || 0);
  const enf = enfants[idx] || enfants[0];

  function refresh() {
    const el = document.getElementById('app-content');
    if (el) { el.innerHTML = render(store); mount(store, navigate); }
  }

  // Tabs
  document.querySelectorAll('.pe-tab').forEach(btn => {
    btn.addEventListener('click', () => { store.set('_peActiveTab', btn.dataset.tab); refresh(); });
  });

  // Chart
  if (activeTab === 'compare') {
    drawCompareChart(enfants);
  } else if (enf) {
    drawChildChart(enf, Number(enf.horizonYears) || 20);
  }

  // Horizon change
  document.getElementById('pe-horizon')?.addEventListener('change', (e) => {
    const enfs = getEnfants(store);
    if (enfs[idx]) { enfs[idx].horizonYears = parseInt(e.target.value) || 20; saveEnfants(store, enfs); refresh(); }
  });

  // Rendement change
  document.querySelectorAll('.pe-plac-rend').forEach(inp => {
    inp.addEventListener('change', () => {
      const ci = parseInt(inp.dataset.childIdx);
      const pid = inp.dataset.placementId;
      const enfs = getEnfants(store);
      if (!enfs[ci]) return;
      if (!enfs[ci].rendementPlacements) enfs[ci].rendementPlacements = {};
      enfs[ci].rendementPlacements[pid] = parseFloat(inp.value) / 100;
      saveEnfants(store, enfs);
      refresh();
    });
  });

  // Add placement
  document.getElementById('pe-add-plac')?.addEventListener('click', () => {
    openModal('Ajouter un placement', buildPlacementForm(), () => {
      const data = getFormData(document.getElementById('modal-body'));
      const enfs = getEnfants(store);
      if (!enfs[idx]) return;
      if (!enfs[idx].placements) enfs[idx].placements = [];
      data.id = generateId();
      enfs[idx].placements.push(data);
      saveEnfants(store, enfs);
      refresh();
    });
  });

  // Edit placement (click on name)
  document.querySelectorAll('.pe-edit-plac').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci = parseInt(btn.dataset.childIdx);
      const pid = btn.dataset.placementId;
      const enfs = getEnfants(store);
      const item = (enfs[ci]?.placements || []).find(p => p.id === pid);
      if (!item) return;
      openModal('Modifier le placement', buildPlacementForm(item), () => {
        Object.assign(item, getFormData(document.getElementById('modal-body')));
        saveEnfants(store, enfs);
        refresh();
      });
    });
  });

  // Delete placement
  document.querySelectorAll('.pe-del-plac').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci = parseInt(btn.dataset.childIdx);
      const pid = btn.dataset.placementId;
      const enfs = getEnfants(store);
      const enf = enfs[ci];
      if (!enf) return;
      const item = (enf.placements || []).find(p => p.id === pid);
      if (item && confirm(`Supprimer \u00ab ${item.nom || 'ce placement'} \u00bb ?`)) {
        enf.placements = (enf.placements || []).filter(p => p.id !== pid);
        saveEnfants(store, enfs);
        refresh();
      }
    });
  });
}
