import { formatCurrency, openModal, inputField, selectField, getFormData } from '../utils.js?v=8';
import { createChart, VIVID_PALETTE, createVerticalGradient, COLORS } from '../charts/chart-config.js';

// ============================================================================
// PROJECTION ENFANTS — Miroir de la page Projection, dédié aux enfants
// ============================================================================

const CHILD_ENVELOPPES = [
  { value: 'CTO', label: 'CTO' },
  { value: 'PEA', label: 'PEA' },
  { value: 'AV', label: 'Assurance Vie' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'Livrets', label: 'Livrets (épargne)' },
];

const CHILD_CATEGORIES = [
  { value: 'ETF', label: 'ETF (Tracker)' },
  { value: 'Action', label: 'Action individuelle' },
  { value: 'Crypto', label: 'Cryptomonnaie' },
  { value: 'Autre', label: 'Autre' },
];

const CHILD_COLORS = ['#a855f7', '#06b6d4'];
const DEFAULT_RENDEMENT = 0.07;
const FIXED_GROUP_KEYS = ['ETF (CTO)', 'Actions (CTO)', 'ETF (PEA)', 'Actions (PEA)', 'Bitcoin', 'Assurance Vie', 'Livrets'];

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
  if (env === 'Livrets') return 'Livrets';
  return 'ETF (CTO)';
}

function getTaxRate(groupKey, envelopeAge) {
  if (groupKey.includes('(PEA)')) return envelopeAge >= 5 ? PS_RATE : PFU_RATE;
  if (groupKey === 'Assurance Vie') return envelopeAge >= 8 ? AV_RATE_AFTER8 : PFU_RATE;
  if (groupKey === 'Livrets') return 0; // Livret A, LDDS : exonérés
  // CTO, Bitcoin → flat tax
  return PFU_RATE;
}

// ─── Projection engine for one child ─────────────────────────────────────────

const DONATION_SOURCES = [
  { value: 'cash', label: 'Cash du parent' },
  { value: 'cto', label: 'CTO du parent' },
  { value: 'immo', label: 'Immobilier du parent' },
];

const DONATION_DEST = [
  { value: 'CTO', label: 'CTO' },
  { value: 'PEA', label: 'PEA' },
  { value: 'AV', label: 'Assurance Vie' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'livrets', label: 'Livrets' },
];

function getDonationsForChild(store, enfantId) {
  const hypotheses = store.get('hypotheses') || [];
  const donations = {};
  for (const h of hypotheses) {
    if (h.theme !== 'donation') continue;
    const ids = h.enfantIds || [];
    // If no enfantIds specified, donation applies to all children
    if (ids.length > 0 && !ids.includes(enfantId)) continue;
    const cfg = store.get('donationConfig') || { enfants: [] };
    const nbEnfants = (ids.length === 0) ? (cfg.enfants || []).length : ids.length;
    const perChild = (h.montant || 0) / Math.max(nbEnfants, 1);
    const year = h.annee || new Date().getFullYear();
    donations[year] = (donations[year] || 0) + perChild;
  }
  return donations;
}

function computeChildProjection(enfant, horizonYears, store) {
  const livrets = enfant.livrets || [];
  const placements = enfant.placements || [];
  const currentYear = new Date().getFullYear();
  const rendements = enfant.rendementPlacements || {};
  const baseAge = childAge(enfant.dateNaissance);
  const donationsByYear = store ? getDonationsForChild(store, enfant.id) : {};
  // Merge manual scenarios
  for (const sc of (enfant.scenarios || [])) {
    const amt = Number(sc.montant) || 0;
    if (!amt) continue;
    if (sc.frequency === 'once') {
      donationsByYear[sc.year] = (donationsByYear[sc.year] || 0) + amt;
    } else {
      const start = sc.year || currentYear;
      const end = sc.endYear || (currentYear + horizonYears);
      const yearly = sc.frequency === 'monthly' ? amt * 12 : amt;
      for (let yr = start; yr <= end; yr++) {
        donationsByYear[yr] = (donationsByYear[yr] || 0) + yearly;
      }
    }
  }

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
  // Remaining months in current year (like parent projection)
  const currentMonth = new Date().getMonth(); // 0-based
  const remainingMonths = 12 - currentMonth;

  for (let y = 0; y <= horizonYears; y++) {
    // --- Grow FIRST, then snapshot (so year 0 = end of current year) ---
    const monthsInPeriod = (y === 0) ? remainingMonths : 12;
    const periodFraction = monthsInPeriod / 12;

    livretTotal *= (1 + avgLivretRate * periodFraction);
    const calYear = currentYear + y;
    for (const k of groupKeys) {
      // Compute effective monthly DCA respecting overrides and end year
      const monthlyDca = groups[k].reduce((s, p) => {
        const baseDca = Number(p.dcaMensuel) || 0;
        const finAnnee = Number(p.dcaFinAnnee) || 0;
        if (finAnnee > 0 && calYear > finAnnee) return s;
        const overrides = (p.dcaOverrides || []).sort((a, b) => a.fromYear - b.fromYear);
        let applicable = baseDca;
        for (const ov of overrides) {
          if (ov.fromYear <= calYear) applicable = Number(ov.dcaMensuel) || 0;
        }
        return s + applicable;
      }, 0);
      const rend = groups[k].reduce((s, p) => {
        const r = rendements[p.id] !== undefined ? rendements[p.id] : DEFAULT_RENDEMENT;
        return Math.max(s, r);
      }, DEFAULT_RENDEMENT);
      const periodDca = monthlyDca * monthsInPeriod;
      // Cash injections for this year
      const cashInj = groups[k].reduce((s, p) => {
        return s + (p.cashInjections || [])
          .filter(inj => inj.year === calYear)
          .reduce((ss, inj) => ss + (Number(inj.montant) || 0), 0);
      }, 0);
      gVal[k] = gVal[k] * (1 + rend * periodFraction) + periodDca + cashInj;
      gApp[k] += periodDca + cashInj;
    }

    // Inject donations after growth
    const donation = donationsByYear[calYear] || 0;

    const placTotal = groupKeys.reduce((s, k) => s + gVal[k], 0);
    const totalApports = groupKeys.reduce((s, k) => s + gApp[k], 0);
    const totalGains = placTotal - totalApports;
    const detail = {}, apports = {}, gains = {}, netImpot = {}, taxes = {}, taxRates = {};
    let totalNetImpot = 0;
    let totalTaxes = 0;
    for (const k of groupKeys) {
      detail[k] = Math.round(gVal[k]);
      apports[k] = Math.round(gApp[k]);
      const gain = gVal[k] - gApp[k];
      gains[k] = Math.round(gain);
      const taxRate = getTaxRate(k, y);
      const taxAmount = Math.max(0, gain) * taxRate;
      taxes[k] = Math.round(taxAmount);
      taxRates[k] = taxRate;
      const net = gApp[k] + gain * (1 - taxRate);
      netImpot[k] = Math.round(net);
      totalNetImpot += net;
      totalTaxes += taxAmount;
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
      totalTaxes: Math.round(totalTaxes),
      total: Math.round(livretTotal + placTotal),
      totalNet: Math.round(livretTotal + totalNetImpot),
      donation: Math.round(donation),
      placementDetail: { ...detail },
      placementApports: { ...apports },
      placementGains: { ...gains },
      placementNetImpot: { ...netImpot },
      placementTaxes: { ...taxes },
      placementTaxRates: { ...taxRates },
    });
  }
  snapshots.groupKeys = groupKeys;
  return snapshots;
}

// ─── Render ──────────────────────────────────────────────────────────────────

// Helpers exported for projection.js unified page
export { getEnfants, childAge, CHILD_COLORS };

export function render(store, { embedded = false } = {}) {
  const enfants = getEnfants(store);
  const activeTab = store.get('_peActiveTab') || '0';

  if (enfants.length === 0) {
    return embedded
      ? '<p class="text-gray-500 text-sm text-center py-8">Ajoutez des enfants dans la page Compte pour commencer.</p>'
      : `<div class="space-y-6">
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
    return embedded
      ? `<div class="space-y-6">${renderComparatif(enfants, store)}</div>`
      : `<div class="space-y-6">${renderHeader(enfants)}${tabs}${renderComparatif(enfants, store)}</div>`;
  }

  const horizonYears = Number(enf.horizonYears) || 20;
  const snapshots = computeChildProjection(enf, horizonYears, store);
  const groupKeys = snapshots.groupKeys || [];
  const placements = enf.placements || [];
  const rendements = enf.rendementPlacements || {};
  const scenarios = enf.scenarios || [];
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  const srcLabels = { cash: 'Cash', cto: 'CTO', immo: 'Immo.' };
  const destLabels = { CTO: 'CTO', PEA: 'PEA', AV: 'Assurance Vie', Crypto: 'Crypto', livrets: 'Livrets' };
  const freqLabels = { once: '\u00d71', annual: '/an', monthly: '/mois' };

  return `
    <div class="space-y-6">
      ${embedded ? '' : renderHeader(enfants)}
      ${embedded ? '' : tabs}

      <!-- Parameters — collapsible -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-4 py-2 cursor-pointer select-none">
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Paramètres</h2>
          </div>
          <svg class="w-3.5 h-3.5 text-gray-600 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-4 pb-3 space-y-2.5">
          <!-- Horizon -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500">Horizon</span>
                <input type="number" id="pe-horizon" value="${horizonYears}" min="1" max="40" step="1"
                  class="param-input input-field w-14 text-center">
                <span class="text-xs text-gray-500">ans</span>
              </div>
            </div>
          </div>
          <!-- Placements grid -->
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <span class="text-base font-bold text-gray-300 uppercase tracking-wide">Placements</span>
              <button id="pe-add-plac" class="ml-2 w-8 h-8 flex items-center justify-center rounded-lg bg-accent-green/25 text-accent-green hover:bg-accent-green/40 transition text-xl font-bold shadow-sm shadow-accent-green/20" data-child-idx="${idx}" title="Ajouter">+</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
              ${placements.length > 0 ? placements.map(p => {
                const gk = getChildGroupKey(p);
                const rend = rendements[p.id] !== undefined ? rendements[p.id] : DEFAULT_RENDEMENT;
                const dca = Number(p.dcaMensuel) || 0;
                const groupIcons = {
                  'ETF (CTO)': '<svg class="w-2.5 h-2.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>',
                  'Actions (CTO)': '<svg class="w-2.5 h-2.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
                  'ETF (PEA)': '<svg class="w-2.5 h-2.5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
                  'Actions (PEA)': '<svg class="w-2.5 h-2.5 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
                  'Bitcoin': '<svg class="w-2.5 h-2.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                  'Assurance Vie': '<svg class="w-2.5 h-2.5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
                  'Livrets': '<svg class="w-2.5 h-2.5 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>',
                };
                const icon = groupIcons[gk] || '<svg class="w-2.5 h-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>';
                return `<div class="group/card flex items-center gap-1.5 px-2.5 py-1.5 rounded row-item hover:border-accent-blue/40 hover:bg-dark-700/40 transition">
                  ${icon}
                  <span class="text-sm text-gray-200 truncate max-w-[7rem] font-medium pe-edit-plac cursor-pointer" data-child-idx="${idx}" data-placement-id="${p.id}" title="${p.nom}">${p.nom}</span>
                  ${dca > 0 ? `<span class="text-[9px] text-gray-600">${dca}\u20ac/m</span>` : ''}
                  <span class="text-[10px] text-gray-500 ml-auto">${gk}</span>
                  <input type="number" class="pe-plac-rend input-field w-14 text-center font-medium"
                    value="${(rend * 100).toFixed(1)}" min="-20" max="50" step="0.5" data-child-idx="${idx}" data-placement-id="${p.id}" onclick="event.stopPropagation()">
                  <span class="text-[10px] text-gray-500">%</span>
                  <button class="pe-del-plac btn-delete" data-child-idx="${idx}" data-placement-id="${p.id}" onclick="event.stopPropagation()" title="Supprimer">\u2715</button>
                </div>`;
              }).join('') : '<p class="col-span-full text-center text-gray-600 text-sm py-3">Aucun placement \u2014 cliquez sur + pour en ajouter</p>'}
            </div>
          </div>
          <!-- Scénarios de donation -->
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
              <span class="text-base font-bold text-gray-300 uppercase tracking-wide">Sc\u00e9narios de donation</span>
              <button id="pe-add-scenario" class="ml-2 w-8 h-8 flex items-center justify-center rounded-lg bg-pink-500/25 text-pink-400 hover:bg-pink-500/40 transition text-xl font-bold shadow-sm shadow-pink-500/20" data-child-idx="${idx}" title="Ajouter un sc\u00e9nario">+</button>
            </div>
            <div class="space-y-1">
              ${scenarios.length > 0 ? scenarios.map(sc => {
                const srcBg = sc.source === 'immo' ? 'bg-accent-green/10 text-accent-green' : sc.source === 'cto' ? 'bg-purple-500/10 text-purple-300' : 'bg-accent-cyan/10 text-accent-cyan';
                return `<div class="group/card flex items-center gap-1.5 px-2 py-1 rounded row-item hover:border-pink-400/40 hover:bg-dark-700/40 transition cursor-pointer pe-edit-scenario" data-child-idx="${idx}" data-scenario-id="${sc.id}">
                  <svg class="w-2.5 h-2.5 text-pink-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                  <span class="text-[9px] px-1 py-0.5 rounded-full ${srcBg}">${srcLabels[sc.source] || 'Cash'}</span>
                  <span class="text-gray-500 text-[9px]">\u2192</span>
                  <span class="text-xs text-gray-200 font-medium">${destLabels[sc.destination] || sc.destination}</span>
                  <span class="text-[9px] text-gray-600">${formatCurrency(sc.montant)} ${freqLabels[sc.frequency] || '\u00d71'}</span>
                  <span class="text-[10px] text-gray-500 ml-auto">${sc.year}</span>
                  ${sc.endYear ? `<span class="text-[10px] text-gray-600">\u2192${sc.endYear}</span>` : ''}
                  <button class="pe-del-scenario btn-delete" data-child-idx="${idx}" data-scenario-id="${sc.id}" onclick="event.stopPropagation()" title="Supprimer">\u2715</button>
                </div>`;
              }).join('') : '<p class="text-center text-gray-600 text-xs py-1">Aucun scénario — les donations de la page Hypothèses apparaissent automatiquement</p>'}
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
        <p class="text-[10px] text-gray-600 mt-1">Valeurs brutes. Survolez pour voir apports / gains / impôts. CTO/Crypto: flat tax 31,4% · PEA &gt;5 ans: 17,2% PS · PEA &lt;5 ans: 31,4% · AV &gt;8 ans: 24,7% · AV &lt;8 ans: 31,4%</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm table-fixed">
          <thead class="bg-dark-800/50 text-gray-500 text-[10px] whitespace-nowrap">
            <tr>
              <th class="w-[72px] px-1 py-1.5 text-center">Année</th>
              <th class="w-[28px] px-0 py-1.5 text-center">An</th>
              <th class="w-[32px] px-0 py-1.5 text-center border-r-2 border-dark-300/40">Âge</th>
              ${groupKeys.map((k, i) => `<th class="px-1 py-1.5 text-center ${i === groupKeys.length - 1 ? 'border-r-2 border-dark-300/40' : ''}">${k}</th>`).join('')}
              <th class="px-1 py-1.5 text-center font-semibold text-gray-400">Apports</th>
              <th class="px-1 py-1.5 text-center font-semibold text-accent-green/70">Gain</th>
              <th class="px-1 py-1.5 text-center font-semibold border-r-2 border-dark-300/40">Net imp.</th>
              <th class="px-1 py-1.5 text-center border-r-2 border-dark-300/40">Livrets</th>
              <th class="px-1 py-1.5 text-center text-pink-300/70">Donation</th>
              <th class="px-1 py-1.5 text-center font-semibold text-accent-green">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-dark-400/20">
            ${snapshots.map(s => {
              const isFiveYear = s.annee > 0 && s.annee % 5 === 0;
              const bt = isFiveYear ? 'border-t-2 border-t-dark-300/40' : '';
              const rowClass = s.annee === 0 ? 'bg-accent-blue/5' : '';
              const placCell = (k, extra, idx) => {
                const val = s.placementDetail[k] || 0;
                const ap = s.placementApports[k] || 0;
                const ga = s.placementGains[k] || 0;
                const tx = s.placementTaxes?.[k] || 0;
                const rate = s.placementTaxRates?.[k] || 0;
                const rateStr = rate > 0 ? ` <span class="text-gray-500">(${Math.round(rate * 100)}%)</span>` : '';
                const tipAlign = idx <= 1 ? 'proj-tip-left' : '';
                const tip = val > 0 ? `<div class="proj-tip"><div class="flex justify-between gap-3"><span class="text-gray-400">Apports</span><span class="text-gray-200">${formatCurrency(ap)}</span></div><div class="flex justify-between gap-3"><span class="text-gray-400">Gains</span><span class="${ga >= 0 ? 'text-accent-green' : 'text-red-400'}">${ga >= 0 ? '+' : ''}${formatCurrency(ga)}</span></div><div class="flex justify-between gap-3"><span class="text-gray-400">Impôts${rateStr}</span><span class="text-red-400">-${formatCurrency(tx)}</span></div><div class="border-t border-dark-400/40 mt-1 pt-1 flex justify-between gap-3"><span class="text-gray-300 font-medium">Net</span><span class="text-accent-cyan font-semibold">${formatCurrency(val - tx)}</span></div></div>` : '';
                return `<td class="px-1 py-0.5 text-center text-gray-200 ${bt} ${extra} ${val > 0 ? `proj-tip-wrap ${tipAlign}` : ''}">${val > 0 ? `${formatCurrency(val)}<div class="text-[8px] text-gray-500">${formatCurrency(ap)}</div>${tip}` : `<span class="text-gray-600">${formatCurrency(0)}</span>`}</td>`;
              };
              return `
            <tr class="hover:bg-dark-600/30 transition ${rowClass} text-[11px] group/row">
              <td class="px-1 py-1 text-center font-medium text-gray-200 ${bt}">
                <span class="inline-flex items-center gap-0.5">
                  ${s.label}
                  ${s.isActualise ? '<span class="text-[8px] text-accent-green" title="Actualisé">&#10003;</span>' : ''}
                  <button class="btn-actualiser-child text-[9px] text-gray-600 hover:text-accent-cyan transition opacity-0 group-hover/row:opacity-100 ml-0.5" data-year="${s.calendarYear}" title="Actualiser avec les valeurs réelles">&#9998;</button>
                </span>
              </td>
              <td class="px-0 py-1 text-center text-gray-500 ${bt}">${s.annee + 1}</td>
              <td class="px-0 py-1 text-center text-gray-400 border-r-2 border-dark-300/40 ${bt}">${s.age !== null ? s.age : '–'}</td>
              ${groupKeys.map((k, i) => placCell(k, i === groupKeys.length - 1 ? 'border-r-2 border-dark-300/40' : '', i)).join('')}
              <td class="px-1 py-0.5 text-center text-gray-400 font-semibold ${bt}">${formatCurrency(s.totalApports)}</td>
              <td class="px-1 py-0.5 text-center font-semibold ${bt} ${s.totalGains >= 0 ? 'text-accent-green/70' : 'text-red-400/70'}">${s.totalGains >= 0 ? '+' : ''}${formatCurrency(s.totalGains)}</td>
              <td class="px-1 py-0.5 text-center font-semibold text-accent-cyan border-r-2 border-dark-300/40 ${bt} proj-tip-wrap">${formatCurrency(s.totalNetImpot)}<div class="text-[8px] text-gray-500">${formatCurrency(s.totalApports)}</div><div class="proj-tip"><div class="flex justify-between gap-3"><span class="text-gray-400">Placements</span><span class="text-gray-200">${formatCurrency(s.placements)}</span></div><div class="flex justify-between gap-3"><span class="text-gray-400">Apports</span><span class="text-gray-200">${formatCurrency(s.totalApports)}</span></div><div class="flex justify-between gap-3"><span class="text-gray-400">Impôts</span><span class="text-red-400">-${formatCurrency(s.totalTaxes)}</span></div><div class="border-t border-dark-400/40 mt-1 pt-1 flex justify-between gap-3"><span class="text-gray-300 font-medium">Net</span><span class="text-accent-cyan font-semibold">${formatCurrency(s.totalNetImpot)}</span></div></div></td>
              <td class="px-1 py-1 text-center text-gray-200 border-r-2 border-dark-300/40 ${bt}">${formatCurrency(s.livrets)}</td>
              <td class="px-1 py-1 text-center text-[11px] text-pink-300/70 ${bt}">${s.donation > 0 ? formatCurrency(s.donation) : '<span class="text-gray-700">-</span>'}</td>
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

function drawChildChart(enfant, horizonYears, store) {
  const canvas = document.getElementById('pe-chart-child');
  if (!canvas) return;
  const snapshots = computeChildProjection(enfant, horizonYears, store);
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

function drawCompareChart(enfants, store) {
  const canvas = document.getElementById('pe-chart-compare');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const datasets = [];
  let labels = [];
  enfants.forEach((enf, i) => {
    const hz = Number(enf.horizonYears) || 20;
    const snaps = computeChildProjection(enf, hz, store);
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
  const currentYear = new Date().getFullYear();
  const overrides = item.dcaOverrides || [];
  const overridesHtml = overrides.map((o, i) => `
    <div class="flex items-center gap-2 dca-override-row" data-idx="${i}">
      <div class="flex-1">
        <input type="number" class="dca-ov-year w-full input-field" value="${o.fromYear || ''}" placeholder="Ex: ${currentYear + 1}" min="${currentYear}" max="${currentYear + 50}" step="1">
      </div>
      <span class="text-gray-500 text-xs">→</span>
      <div class="flex-1">
        <input type="number" class="dca-ov-amount w-full input-field" value="${o.dcaMensuel || ''}" placeholder="€/mois" step="10">
      </div>
      <button type="button" class="dca-ov-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
    </div>
  `).join('');

  const injections = item.cashInjections || [];
  const injectionsHtml = injections.map((inj, i) => `
    <div class="flex items-center gap-2 cash-inj-row" data-idx="${i}">
      <div class="flex-1">
        <input type="number" class="cash-inj-year w-full input-field" value="${inj.year || ''}" placeholder="Ex: ${currentYear + 1}" min="${currentYear}" max="${currentYear + 50}" step="1">
      </div>
      <span class="text-gray-500 text-xs">→</span>
      <div class="flex-1">
        <input type="number" class="cash-inj-amount w-full input-field text-accent-green" value="${inj.montant || ''}" placeholder="Montant €" step="100">
      </div>
      <button type="button" class="cash-inj-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
    </div>
  `).join('');

  return `<div class="space-y-3">
    ${inputField('nom', 'Nom du titre', item.nom || '', 'text', 'placeholder="Ex: MSCI World ETF"')}
    <div class="grid grid-cols-2 gap-3">
      ${selectField('enveloppe', 'Enveloppe', CHILD_ENVELOPPES, item.enveloppe || 'CTO')}
      ${selectField('categorie', 'Catégorie', CHILD_CATEGORIES, item.categorie || 'ETF')}
    </div>
    ${inputField('isin', 'ISIN / Ticker', item.isin || '', 'text', 'placeholder="Ex: LU1681043599"')}
    ${inputField('dateOuverture', "Date d'ouverture de l'enveloppe", item.dateOuverture || '', 'date')}
    <div class="grid grid-cols-2 gap-3">
      ${inputField('quantite', 'Quantité', item.quantite || '', 'number', 'step="0.0001" placeholder="Ex: 15.5"')}
      ${inputField('pru', 'PRU (€)', item.pru || '', 'number', 'step="0.01" placeholder="Prix de revient unitaire"')}
    </div>
    ${inputField('valeur', 'Valeur totale actuelle (€)', item.valeur || '', 'number', 'step="0.01"')}

    <div class="mt-2 pt-3 border-t border-dark-400/30">
      <p class="text-sm font-medium text-gray-300 mb-3">Investissement programmé</p>
      ${inputField('apport', 'Apport initial (€)', item.apport || '', 'number', 'step="100" placeholder="Capital de départ"')}
      <div class="grid grid-cols-2 gap-3">
        ${inputField('dcaMensuel', 'DCA mensuel (€/mois)', item.dcaMensuel || '', 'number', 'step="10" placeholder="Apport mensuel"')}
        ${inputField('dcaFinAnnee', 'Fin du DCA (année)', item.dcaFinAnnee || '', 'number', `step="1" min="${currentYear}" max="${currentYear + 50}" placeholder="Illimité"`)}
      </div>

      <div class="mt-2">
        <label class="block text-xs font-medium text-gray-400 mb-1.5">Modifier le DCA par période</label>
        <div id="dca-overrides-list" class="space-y-2 mb-2">
          ${overridesHtml}
        </div>
        <button type="button" id="btn-add-dca-override" class="text-xs text-accent-blue hover:text-accent-blue/80 font-medium">+ Ajouter une période</button>
        <p class="text-xs text-gray-600 mt-1">Ex: À partir de 2030, passer le DCA à 500€/mois</p>
      </div>

      <div class="mt-3">
        <label class="block text-xs font-medium text-gray-400 mb-1.5">Apports exceptionnels</label>
        <div id="cash-injections-list" class="space-y-2 mb-2">
          ${injectionsHtml}
        </div>
        <button type="button" id="btn-add-cash-injection" class="text-xs text-accent-green hover:text-accent-green/80 font-medium">+ Ajouter un apport</button>
        <p class="text-xs text-gray-600 mt-1">Ex: En 2029, injecter 5 000€ en une fois</p>
      </div>
    </div>
  </div>`;
}

function collectChildDcaOverrides() {
  const rows = document.querySelectorAll('.dca-override-row');
  const overrides = [];
  rows.forEach(row => {
    const year = parseInt(row.querySelector('.dca-ov-year')?.value);
    const amount = parseFloat(row.querySelector('.dca-ov-amount')?.value);
    if (year > 0 && !isNaN(amount)) {
      overrides.push({ fromYear: year, dcaMensuel: amount });
    }
  });
  return overrides.sort((a, b) => a.fromYear - b.fromYear);
}

function collectChildCashInjections() {
  const rows = document.querySelectorAll('.cash-inj-row');
  const injections = [];
  rows.forEach(row => {
    const year = parseInt(row.querySelector('.cash-inj-year')?.value);
    const montant = parseFloat(row.querySelector('.cash-inj-amount')?.value);
    if (year > 0 && !isNaN(montant) && montant !== 0) {
      injections.push({ year, montant });
    }
  });
  return injections.sort((a, b) => a.year - b.year);
}

function initChildPlacementFormListeners(modal) {
  const currentYear = new Date().getFullYear();

  // Auto-calc Quantité × PRU = Valeur
  const qtyInput = modal.querySelector('#field-quantite');
  const pruInput = modal.querySelector('#field-pru');
  const valInput = modal.querySelector('#field-valeur');
  if (qtyInput && pruInput && valInput) {
    const autoCalc = () => {
      const q = parseFloat(qtyInput.value) || 0;
      const p = parseFloat(pruInput.value) || 0;
      if (q > 0 && p > 0) valInput.value = (q * p).toFixed(2);
    };
    qtyInput.addEventListener('input', autoCalc);
    pruInput.addEventListener('input', autoCalc);
  }

  // DCA override add/remove
  modal.querySelector('#btn-add-dca-override')?.addEventListener('click', () => {
    const list = modal.querySelector('#dca-overrides-list');
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 dca-override-row';
    row.innerHTML = `
      <div class="flex-1"><input type="number" class="dca-ov-year w-full input-field" placeholder="Ex: ${currentYear + 1}" min="${currentYear}" max="${currentYear + 50}" step="1"></div>
      <span class="text-gray-500 text-xs">→</span>
      <div class="flex-1"><input type="number" class="dca-ov-amount w-full input-field" placeholder="€/mois" step="10"></div>
      <button type="button" class="dca-ov-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
    `;
    row.querySelector('.dca-ov-remove').addEventListener('click', () => row.remove());
    list.appendChild(row);
  });
  modal.querySelectorAll('.dca-ov-remove').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.dca-override-row').remove());
  });

  // Cash injection add/remove
  modal.querySelector('#btn-add-cash-injection')?.addEventListener('click', () => {
    const list = modal.querySelector('#cash-injections-list');
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 cash-inj-row';
    row.innerHTML = `
      <div class="flex-1"><input type="number" class="cash-inj-year w-full input-field" placeholder="Ex: ${currentYear + 1}" min="${currentYear}" max="${currentYear + 50}" step="1"></div>
      <span class="text-gray-500 text-xs">→</span>
      <div class="flex-1"><input type="number" class="cash-inj-amount w-full input-field text-accent-green" placeholder="Montant €" step="100"></div>
      <button type="button" class="cash-inj-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
    `;
    row.querySelector('.cash-inj-remove').addEventListener('click', () => row.remove());
    list.appendChild(row);
  });
  modal.querySelectorAll('.cash-inj-remove').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.cash-inj-row').remove());
  });
}

// ─── Scenario modal ─────────────────────────────────────────────────────────

function openScenarioModal(store, childIdx, editItem, refresh) {
  const currentYear = new Date().getFullYear();
  const body = `<div class="space-y-3">
    ${selectField('source', 'Source (du parent)', DONATION_SOURCES, editItem?.source || 'cash')}
    ${selectField('destination', 'Destination (enfant)', DONATION_DEST, editItem?.destination || 'CTO')}
    ${inputField('montant', 'Montant (\u20ac)', editItem?.montant || '', 'number', 'min="0" step="100" placeholder="50000"')}
    ${selectField('frequency', 'Fréquence', [
      { value: 'once', label: 'Une seule fois' },
      { value: 'annual', label: 'Annuel' },
      { value: 'monthly', label: 'Mensuel' },
    ], editItem?.frequency || 'once')}
    ${inputField('year', 'Année', editItem?.year || currentYear + 1, 'number', `min="${currentYear}" max="${currentYear + 50}" step="1"`)}
    <div id="pe-scenario-end-wrapper">
      ${inputField('endYear', 'Année de fin (si récurrent)', editItem?.endYear || '', 'number', `min="${currentYear}" max="${currentYear + 50}" step="1" placeholder="Optionnel"`)}
    </div>
  </div>`;

  const modal = openModal(editItem ? 'Modifier le scénario' : 'Ajouter un scénario de donation', body, () => {
    const data = getFormData(document.getElementById('modal-body'));
    if (!data.montant || !data.year) return;
    data.montant = Number(data.montant);
    data.year = Number(data.year);
    if (data.endYear) data.endYear = Number(data.endYear); else delete data.endYear;

    const enfs = getEnfants(store);
    if (!enfs[childIdx]) return;
    if (!enfs[childIdx].scenarios) enfs[childIdx].scenarios = [];
    if (editItem) {
      const sc = enfs[childIdx].scenarios.find(s => s.id === editItem.id);
      if (sc) Object.assign(sc, data);
    } else {
      data.id = generateId();
      enfs[childIdx].scenarios.push(data);
    }
    saveEnfants(store, enfs);
    refresh();
  });

  const freqSel = modal.querySelector('#field-frequency');
  const endWrap = modal.querySelector('#pe-scenario-end-wrapper');
  if (freqSel && endWrap) {
    const toggle = () => endWrap.style.display = freqSel.value !== 'once' ? '' : 'none';
    toggle();
    freqSel.addEventListener('change', toggle);
  }
}

// ─── Actualisation modal for children ────────────────────────────────────────

function openChildActualisationModal(store, navigate, calendarYear, snapshots, childIdx) {
  const enfants = getEnfants(store);
  const enf = enfants[childIdx];
  if (!enf) return;
  const placements = enf.placements || [];
  const actualisations = enf.actualisations || {};
  const existing = actualisations[String(calendarYear)] || {};
  const existingPlac = existing.placements || {};

  const snapshot = snapshots.find(s => s.calendarYear === calendarYear);
  if (!snapshot) return;

  const placementRows = placements.map(p => {
    const gk = getChildGroupKey(p);
    const projValue = snapshot.placementDetail?.[gk] || 0;
    const realValue = existingPlac[p.id] !== undefined ? existingPlac[p.id] : '';
    return `
      <div class="flex items-center gap-2 py-2 border-b border-dark-400/20">
        <div class="flex-1 min-w-0">
          <div class="text-sm text-gray-200 truncate">${p.nom || gk}</div>
          <div class="text-[10px] text-gray-500">${gk} · Projeté : ${formatCurrency(projValue)}</div>
        </div>
        <input type="number" name="plac-${p.id}" value="${realValue}"
          placeholder="${formatCurrency(projValue).replace(/[^\d\s]/g, '').trim()}"
          class="input-field w-28 placeholder-gray-700" step="1">
      </div>`;
  }).join('');

  const body = `
    <p class="text-xs text-gray-500 mb-4">Saisissez les valeurs réelles de fin ${calendarYear} pour ${enf.prenom || 'cet enfant'}. Les champs vides conservent la valeur projetée.</p>
    <div class="mb-4">
      <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Placements</h4>
      <div class="max-h-[40vh] overflow-y-auto pr-1">${placementRows}</div>
    </div>
    <div class="border-t border-dark-400/30 pt-4 space-y-3">
      <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Livrets</h4>
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-300 flex-1">Livrets d'épargne</label>
        <input type="number" name="actu-livrets" value="${existing.livrets !== undefined ? existing.livrets : ''}"
          placeholder="${formatCurrency(snapshot.livrets).replace(/[^\d\s]/g, '').trim()}"
          class="input-field w-28 placeholder-gray-700" step="1">
      </div>
    </div>
    ${Object.keys(existingPlac).length > 0 || existing.livrets !== undefined
      ? '<div class="mt-4 pt-3 border-t border-dark-400/30"><button id="actu-clear" class="text-xs text-red-400 hover:text-red-300 transition">Supprimer cette actualisation</button></div>'
      : ''}
  `;

  const modal = openModal(`Actualiser fin ${calendarYear} — ${enf.prenom || 'Enfant'}`, body, () => {
    const modalBody = document.getElementById('modal-body');
    const actu = { placements: {} };
    let hasAny = false;
    placements.forEach(p => {
      const input = modalBody.querySelector(`[name="plac-${p.id}"]`);
      if (input && input.value !== '') { actu.placements[p.id] = Number(input.value); hasAny = true; }
    });
    const livInput = modalBody.querySelector('[name="actu-livrets"]');
    if (livInput && livInput.value !== '') { actu.livrets = Number(livInput.value); hasAny = true; }

    const enfs = getEnfants(store);
    if (!enfs[childIdx].actualisations) enfs[childIdx].actualisations = {};
    if (hasAny) {
      if (Object.keys(actu.placements).length === 0) delete actu.placements;
      enfs[childIdx].actualisations[String(calendarYear)] = actu;
    } else {
      delete enfs[childIdx].actualisations[String(calendarYear)];
    }
    saveEnfants(store, enfs);
    navigate('projection');
  });

  modal.querySelector('#actu-clear')?.addEventListener('click', () => {
    const enfs = getEnfants(store);
    if (enfs[childIdx].actualisations) delete enfs[childIdx].actualisations[String(calendarYear)];
    saveEnfants(store, enfs);
    modal.remove();
    navigate('projection');
  });
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mount(store, navigate, { embedded = false } = {}) {
  const enfants = getEnfants(store);
  const activeTab = store.get('_peActiveTab') || '0';
  const idx = activeTab === 'compare' ? -1 : (parseInt(activeTab) || 0);
  const enf = enfants[idx] || enfants[0];

  function refresh() {
    navigate('projection');
  }

  // Internal tabs (only when NOT embedded — parent handles tabs)
  if (!embedded) {
    document.querySelectorAll('.pe-tab').forEach(btn => {
      btn.addEventListener('click', () => { store.set('_peActiveTab', btn.dataset.tab); refresh(); });
    });
  }

  // Chart
  if (activeTab === 'compare') {
    drawCompareChart(enfants, store);
  } else if (enf) {
    drawChildChart(enf, Number(enf.horizonYears) || 20, store);
  }

  // Horizon change
  document.getElementById('pe-horizon')?.addEventListener('change', (e) => {
    const enfs = getEnfants(store);
    if (enfs[idx]) { enfs[idx].horizonYears = parseInt(e.target.value) || 20; saveEnfants(store, enfs); refresh(); }
  });

  // Add scenario
  document.getElementById('pe-add-scenario')?.addEventListener('click', () => openScenarioModal(store, idx, null, refresh));
  // Edit scenario
  document.querySelectorAll('.pe-edit-scenario').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci = parseInt(btn.dataset.childIdx);
      const sid = btn.dataset.scenarioId;
      const enfs = getEnfants(store);
      const sc = (enfs[ci]?.scenarios || []).find(s => s.id === sid);
      if (sc) openScenarioModal(store, ci, sc, refresh);
    });
  });
  // Delete scenario
  document.querySelectorAll('.pe-del-scenario').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci = parseInt(btn.dataset.childIdx);
      const sid = btn.dataset.scenarioId;
      const enfs = getEnfants(store);
      if (!enfs[ci]) return;
      enfs[ci].scenarios = (enfs[ci].scenarios || []).filter(s => s.id !== sid);
      saveEnfants(store, enfs);
      refresh();
    });
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
    const modal = openModal('Ajouter un placement', buildPlacementForm(), () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.dcaOverrides = collectChildDcaOverrides();
      data.cashInjections = collectChildCashInjections();
      const enfs = getEnfants(store);
      if (!enfs[idx]) return;
      if (!enfs[idx].placements) enfs[idx].placements = [];
      data.id = generateId();
      enfs[idx].placements.push(data);
      saveEnfants(store, enfs);
      refresh();
    });
    if (modal) initChildPlacementFormListeners(modal);
  });

  // Edit placement (click on name)
  document.querySelectorAll('.pe-edit-plac').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci = parseInt(btn.dataset.childIdx);
      const pid = btn.dataset.placementId;
      const enfs = getEnfants(store);
      const item = (enfs[ci]?.placements || []).find(p => p.id === pid);
      if (!item) return;
      const modal = openModal('Modifier le placement', buildPlacementForm(item), () => {
        Object.assign(item, getFormData(document.getElementById('modal-body')));
        item.dcaOverrides = collectChildDcaOverrides();
        item.cashInjections = collectChildCashInjections();
        saveEnfants(store, enfs);
        refresh();
      });
      if (modal) initChildPlacementFormListeners(modal);
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

  // Actualisation buttons (pencil) on child projection table
  if (enf && idx >= 0) {
    const horizonYears = Number(enf.horizonYears) || 20;
    const snapshots = computeChildProjection(enf, horizonYears, store);
    document.querySelectorAll('.btn-actualiser-child').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const year = parseInt(btn.dataset.year);
        openChildActualisationModal(store, navigate, year, snapshots, idx);
      });
    });
  }
}
