import { formatCurrency, parseNumberInput } from '../utils.js?v=8';
import { createChart, COLORS } from '../charts/chart-config.js';

// ─── Simulateur Succession Pro ───────────────────────────────────────────────
// Standalone — Comprehensive French inheritance tax optimizer
// Supports: couple, children, grandchildren, all optimization levers

const STORAGE_KEY = 'sim-succession-saves';

// ─── French Tax Constants ────────────────────────────────────────────────────

const ABATTEMENT_ENFANT = 100000;        // Art. 779 CGI — per parent per child
const ABATTEMENT_PETIT_ENFANT = 31865;   // Art. 790 B CGI — per parent per grandchild
const DON_TEPA = 31865;                  // Art. 790 G CGI — cash gift < 80 yo
const AGE_MAX_TEPA = 80;
const CYCLE_ANNEES = 15;                 // Abattement renewal period
const AV_ABATTEMENT = 152500;            // Art. 990 I CGI — per beneficiary (primes < 70)
const AV_TAUX_1 = 0.20;
const AV_SEUIL_1 = 700000;
const AV_TAUX_2 = 0.3125;

const BAREME_DONATION = [
  { limit: 8072, rate: 0.05 },
  { limit: 12109, rate: 0.10 },
  { limit: 15932, rate: 0.15 },
  { limit: 552324, rate: 0.20 },
  { limit: 902838, rate: 0.30 },
  { limit: 1805677, rate: 0.40 },
  { limit: Infinity, rate: 0.45 },
];

const BAREME_USUFRUIT = [
  { ageMax: 20, usufruit: 0.90 }, { ageMax: 30, usufruit: 0.80 },
  { ageMax: 40, usufruit: 0.70 }, { ageMax: 50, usufruit: 0.60 },
  { ageMax: 60, usufruit: 0.50 }, { ageMax: 70, usufruit: 0.40 },
  { ageMax: 80, usufruit: 0.30 }, { ageMax: 90, usufruit: 0.20 },
  { ageMax: Infinity, usufruit: 0.10 },
];

function calculerDroits(montantTaxable) {
  if (montantTaxable <= 0) return 0;
  let droits = 0, prev = 0;
  for (const t of BAREME_DONATION) {
    const tranche = Math.min(montantTaxable, t.limit) - prev;
    if (tranche <= 0) break;
    droits += tranche * t.rate;
    prev = t.limit;
  }
  return droits;
}

function getNuePropriete(age) {
  for (const b of BAREME_USUFRUIT) {
    if (age <= b.ageMax) return 1 - b.usufruit;
  }
  return 0.90;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  ageDonateur1: 55, ageDonateur2: 53, couple: true,
  nbEnfants: 2, nbPetitsEnfants: 0,
  immobilier: 400000, placementsFinanciers: 150000, assuranceVie: 100000,
  epargne: 50000, cto: 30000, dettes: 80000,
  // Levers
  leverDonationCash: true,
  leverTEPA: true,
  leverDemembrement: true,
  leverAV: true,
  leverCouple: true,
  leverGrandchildren: false,
  leverDonationCTO: true,
  lever2eCycle: false,
};

const FIELD_IDS = [
  'succ-age1', 'succ-age2', 'succ-enfants', 'succ-petits-enfants',
  'succ-immobilier', 'succ-placements', 'succ-av', 'succ-epargne', 'succ-cto', 'succ-dettes',
];

// ─── Save / Load ─────────────────────────────────────────────────────────────

function getSaves() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function writeSaves(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
function saveCurrentInputs(name) { const saves = getSaves(); saves.push({ name, date: new Date().toISOString(), inputs: getInputs() }); writeSaves(saves); }
function deleteSave(i) { const s = getSaves(); s.splice(i, 1); writeSaves(s); }
function loadSave(index) {
  const save = getSaves()[index]; if (!save) return;
  const map = {
    'succ-age1': save.inputs.ageDonateur1, 'succ-age2': save.inputs.ageDonateur2,
    'succ-enfants': save.inputs.nbEnfants, 'succ-petits-enfants': save.inputs.nbPetitsEnfants,
    'succ-immobilier': save.inputs.immobilier, 'succ-placements': save.inputs.placementsFinanciers,
    'succ-av': save.inputs.assuranceVie, 'succ-epargne': save.inputs.epargne,
    'succ-cto': save.inputs.cto, 'succ-dettes': save.inputs.dettes,
  };
  for (const [id, val] of Object.entries(map)) {
    const el = document.getElementById(id); const r = document.getElementById(id + '-range');
    if (el && val !== undefined) { el.value = val; if (r) r.value = val; }
  }
  // Checkboxes
  const cb = document.getElementById('succ-couple'); if (cb) cb.checked = save.inputs.couple ?? true;
  ['leverDonationCash', 'leverTEPA', 'leverDemembrement', 'leverAV', 'leverCouple', 'leverGrandchildren', 'leverDonationCTO', 'lever2eCycle'].forEach(k => {
    const el = document.getElementById('succ-' + k); if (el) el.checked = save.inputs[k] ?? false;
  });
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

function getInputs() {
  const v = (id) => parseNumberInput(document.getElementById(id)?.value);
  const c = (id) => document.getElementById(id)?.checked ?? false;
  return {
    ageDonateur1: v('succ-age1'), ageDonateur2: v('succ-age2'),
    couple: c('succ-couple'),
    nbEnfants: Math.max(v('succ-enfants'), 0),
    nbPetitsEnfants: Math.max(v('succ-petits-enfants'), 0),
    immobilier: v('succ-immobilier'), placementsFinanciers: v('succ-placements'),
    assuranceVie: v('succ-av'), epargne: v('succ-epargne'),
    cto: v('succ-cto'), dettes: v('succ-dettes'),
    leverDonationCash: c('succ-leverDonationCash'),
    leverTEPA: c('succ-leverTEPA'),
    leverDemembrement: c('succ-leverDemembrement'),
    leverAV: c('succ-leverAV'),
    leverCouple: c('succ-leverCouple'),
    leverGrandchildren: c('succ-leverGrandchildren'),
    leverDonationCTO: c('succ-leverDonationCTO'),
    lever2eCycle: c('succ-lever2eCycle'),
  };
}

// ─── Computation Engine ──────────────────────────────────────────────────────

function compute(inp) {
  const nbDonateurs = (inp.couple && inp.leverCouple) ? 2 : 1;
  const nbEnfants = Math.max(inp.nbEnfants, 1);
  const nbPE = inp.nbPetitsEnfants;
  const ageRef = inp.ageDonateur1;

  const totalActifs = inp.immobilier + inp.placementsFinanciers + inp.assuranceVie + inp.epargne + inp.cto;
  const patrimoineNet = totalActifs - inp.dettes;
  const patrimoineHorsAV = patrimoineNet - inp.assuranceVie;

  // ─── SCENARIO 0: No optimization (brut) ────────────────────────────────
  const partBruteEnfant = patrimoineHorsAV / nbEnfants;
  const droitsBrut = nbEnfants * calculerDroits(Math.max(partBruteEnfant - ABATTEMENT_ENFANT, 0));
  // AV brut
  const avParEnfant = inp.assuranceVie / nbEnfants;
  const avTaxableParEnfant = Math.max(avParEnfant - AV_ABATTEMENT, 0);
  const droitsAVBrut = nbEnfants * calculerAVTax(avTaxableParEnfant);
  const totalDroitsBrut = droitsBrut + droitsAVBrut;

  // ─── Build optimization levers ─────────────────────────────────────────
  const levers = [];
  let patrimoineRestant = patrimoineHorsAV;
  let abattementUtilise = 0; // per parent per child, cumulated across levers
  let totalDonsExoneres = 0;
  let totalDroitsDonation = 0;

  // Lever: Démembrement (nue-propriété sur immobilier)
  if (inp.leverDemembrement && inp.immobilier > 0) {
    const np = getNuePropriete(ageRef);
    const valeurNP = inp.immobilier * np;
    const donNPParEnfant = valeurNP / nbEnfants;
    const abattDispo = (ABATTEMENT_ENFANT * nbDonateurs) - abattementUtilise;
    const exonereParEnfant = Math.min(donNPParEnfant, abattDispo);
    const taxableParEnfant = Math.max(donNPParEnfant - exonereParEnfant, 0);
    const droitsNP = nbEnfants * calculerDroits(taxableParEnfant);
    const exonereTotal = exonereParEnfant * nbEnfants;

    // At death, usufruct collapses — no more tax on the full value
    const valeurEvitee = inp.immobilier; // Full value removed from estate
    const droitsEvites = nbEnfants * calculerDroits(Math.max((valeurEvitee / nbEnfants) - ABATTEMENT_ENFANT, 0));

    levers.push({
      id: 'demembrement', label: 'Démembrement immobilier',
      desc: `Nue-propriété ${Math.round(np * 100)} % — ${formatCurrency(Math.round(valeurNP))} transmis`,
      color: 'amber',
      montantTransmis: valeurNP,
      exonere: exonereTotal,
      droitsDonation: droitsNP,
      droitsEvites: Math.max(droitsEvites - droitsNP, 0),
      economie: Math.max(droitsEvites - droitsNP, 0),
    });

    patrimoineRestant -= inp.immobilier; // Immobilier sort de la succession
    abattementUtilise += exonereParEnfant / nbDonateurs;
    totalDonsExoneres += exonereTotal;
    totalDroitsDonation += droitsNP;
  }

  // Lever: Donation CTO (purge des plus-values)
  if (inp.leverDonationCTO && inp.cto > 0) {
    const donCTOParEnfant = inp.cto / nbEnfants;
    const abattDispo = Math.max((ABATTEMENT_ENFANT * nbDonateurs) - abattementUtilise, 0);
    const exonereParEnfant = Math.min(donCTOParEnfant, abattDispo);
    const taxableParEnfant = Math.max(donCTOParEnfant - exonereParEnfant, 0);
    const droitsCTO = nbEnfants * calculerDroits(taxableParEnfant);
    // Bonus: purge plus-values latentes (estimée ~30% de gain, flat tax 30%)
    const pvEstimee = inp.cto * 0.3;
    const flatTaxEvitee = pvEstimee * 0.30;

    levers.push({
      id: 'cto', label: 'Donation titres CTO',
      desc: `${formatCurrency(inp.cto)} — purge des plus-values latentes`,
      color: 'purple',
      montantTransmis: inp.cto,
      exonere: exonereParEnfant * nbEnfants,
      droitsDonation: droitsCTO,
      droitsEvites: flatTaxEvitee,
      economie: flatTaxEvitee + Math.max(nbEnfants * calculerDroits(Math.max(donCTOParEnfant - ABATTEMENT_ENFANT, 0)) - droitsCTO, 0),
    });

    patrimoineRestant -= inp.cto;
    abattementUtilise += exonereParEnfant / nbDonateurs;
    totalDonsExoneres += exonereParEnfant * nbEnfants;
    totalDroitsDonation += droitsCTO;
  }

  // Lever: TEPA (don familial de sommes d'argent)
  if (inp.leverTEPA && ageRef < AGE_MAX_TEPA) {
    const tepaParEnfant = DON_TEPA * nbDonateurs;
    const tepaTotal = tepaParEnfant * nbEnfants;
    const droitsEvitesTepa = nbEnfants * calculerDroitsMarginaux(tepaParEnfant, partBruteEnfant - ABATTEMENT_ENFANT);

    levers.push({
      id: 'tepa', label: 'Don TEPA (Art. 790 G)',
      desc: `${formatCurrency(tepaTotal)} exonéré (< 80 ans)`,
      color: 'cyan',
      montantTransmis: tepaTotal,
      exonere: tepaTotal,
      droitsDonation: 0,
      droitsEvites: droitsEvitesTepa,
      economie: droitsEvitesTepa,
    });

    patrimoineRestant -= tepaTotal;
    totalDonsExoneres += tepaTotal;
  }

  // Lever: Donation cash classique (abattement 100k)
  if (inp.leverDonationCash) {
    const abattDispo = Math.max((ABATTEMENT_ENFANT * nbDonateurs) - abattementUtilise, 0);
    const donCashParEnfant = Math.min(abattDispo, Math.max(patrimoineRestant / nbEnfants, 0));
    const cashTotal = donCashParEnfant * nbEnfants;

    if (cashTotal > 0) {
      const droitsEvitesCash = nbEnfants * calculerDroitsMarginaux(donCashParEnfant, Math.max(partBruteEnfant - ABATTEMENT_ENFANT, 0));

      levers.push({
        id: 'cash', label: 'Donation cash (abattement)',
        desc: `${formatCurrency(cashTotal)} dans l'abattement ${formatCurrency(ABATTEMENT_ENFANT)}/parent/enfant`,
        color: 'blue',
        montantTransmis: cashTotal,
        exonere: cashTotal,
        droitsDonation: 0,
        droitsEvites: droitsEvitesCash,
        economie: droitsEvitesCash,
      });

      patrimoineRestant -= cashTotal;
      totalDonsExoneres += cashTotal;
    }
  }

  // Lever: Grandchildren
  if (inp.leverGrandchildren && nbPE > 0) {
    const abattPE = ABATTEMENT_PETIT_ENFANT * nbDonateurs * nbPE;
    const droitsEvitesPE = nbPE * calculerDroitsMarginaux(ABATTEMENT_PETIT_ENFANT * nbDonateurs, 0);

    levers.push({
      id: 'grandchildren', label: 'Donation petits-enfants',
      desc: `${formatCurrency(abattPE)} exonéré via abattement petits-enfants`,
      color: 'green',
      montantTransmis: abattPE,
      exonere: abattPE,
      droitsDonation: 0,
      droitsEvites: droitsEvitesPE,
      economie: droitsEvitesPE,
    });

    patrimoineRestant -= abattPE;
    totalDonsExoneres += abattPE;
  }

  // Lever: Assurance-vie optimization
  if (inp.leverAV && inp.assuranceVie > 0) {
    const avOptimise = Math.min(inp.assuranceVie, AV_ABATTEMENT * nbEnfants);
    const avExonere = avOptimise;
    const droitsAVOptimise = nbEnfants * calculerAVTax(Math.max((inp.assuranceVie / nbEnfants) - AV_ABATTEMENT, 0));
    const econAV = droitsAVBrut - droitsAVOptimise;

    levers.push({
      id: 'av', label: 'Assurance-vie (Art. 990 I)',
      desc: `${formatCurrency(AV_ABATTEMENT)}/bénéficiaire exonéré (primes < 70 ans)`,
      color: 'teal',
      montantTransmis: inp.assuranceVie,
      exonere: avExonere,
      droitsDonation: droitsAVOptimise,
      droitsEvites: econAV,
      economie: econAV,
    });
  }

  // Lever: 2e cycle 15 ans
  if (inp.lever2eCycle && ageRef + CYCLE_ANNEES < 90) {
    const cycle2Abatt = ABATTEMENT_ENFANT * nbDonateurs * nbEnfants;
    const cycle2TEPA = (ageRef + CYCLE_ANNEES < AGE_MAX_TEPA && inp.leverTEPA) ? DON_TEPA * nbDonateurs * nbEnfants : 0;
    const cycle2Total = cycle2Abatt + cycle2TEPA;
    const economie2 = nbEnfants * calculerDroits(ABATTEMENT_ENFANT * nbDonateurs);

    levers.push({
      id: 'cycle2', label: `2e cycle (dans ${CYCLE_ANNEES} ans)`,
      desc: `Renouvellement à ${ageRef + CYCLE_ANNEES} ans — ${formatCurrency(cycle2Total)} exonéré`,
      color: 'indigo',
      montantTransmis: cycle2Total,
      exonere: cycle2Total,
      droitsDonation: 0,
      droitsEvites: economie2,
      economie: economie2,
    });
  }

  // ─── Succession résiduelle optimisée ───────────────────────────────────
  const patrimoineResiduelHorsAV = Math.max(patrimoineRestant, 0);
  const partResiduelleEnfant = patrimoineResiduelHorsAV / nbEnfants;
  const droitsResiduel = nbEnfants * calculerDroits(Math.max(partResiduelleEnfant - Math.max(ABATTEMENT_ENFANT - abattementUtilise, 0), 0));

  const droitsAVOptimise = inp.leverAV ? nbEnfants * calculerAVTax(Math.max((inp.assuranceVie / nbEnfants) - AV_ABATTEMENT, 0)) : droitsAVBrut;

  const totalDroitsOptimise = droitsResiduel + totalDroitsDonation + droitsAVOptimise;
  const economieGlobale = totalDroitsBrut - totalDroitsOptimise;
  const tauxImposition = patrimoineNet > 0 ? totalDroitsOptimise / patrimoineNet : 0;
  const tauxImpositionBrut = patrimoineNet > 0 ? totalDroitsBrut / patrimoineNet : 0;

  // ─── Réserve héréditaire ───────────────────────────────────────────────
  // Quotité disponible = 1/(nbEnfants+1) ; réserve = nbEnfants/(nbEnfants+1)
  const quotiteDisponible = 1 / (nbEnfants + 1);
  const reserveHereditaire = patrimoineNet * (1 - quotiteDisponible);
  const partReserveParEnfant = reserveHereditaire / nbEnfants;

  // ─── Waterfall data ────────────────────────────────────────────────────
  const waterfall = [{ label: 'Droits bruts', value: totalDroitsBrut, color: '#ef4444' }];
  let runningTotal = totalDroitsBrut;
  for (const l of levers) {
    if (l.economie > 0) {
      runningTotal -= l.economie;
      waterfall.push({ label: l.label, value: -l.economie, running: Math.max(runningTotal, 0), color: leverColor(l.color) });
    }
  }
  waterfall.push({ label: 'Droits optimisés', value: Math.max(totalDroitsOptimise, 0), color: '#22c55e' });

  // ─── Timeline data (15-year cycles) ────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const timeline = [];
  for (const l of levers) {
    if (l.id === 'cycle2') {
      timeline.push({ year: currentYear + CYCLE_ANNEES, age: ageRef + CYCLE_ANNEES, label: l.label, color: l.color, amount: l.montantTransmis });
    } else {
      timeline.push({ year: currentYear, age: ageRef, label: l.label, color: l.color, amount: l.montantTransmis });
    }
  }

  return {
    patrimoineNet, patrimoineHorsAV, totalActifs,
    totalDroitsBrut, totalDroitsOptimise, economieGlobale,
    tauxImpositionBrut, tauxImposition,
    levers, waterfall, timeline,
    reserveHereditaire, partReserveParEnfant, quotiteDisponible,
    nbDonateurs, nbEnfants, nbPE, ageRef,
    droitsAVBrut, droitsAVOptimise,
    totalDonsExoneres, totalDroitsDonation,
  };
}

function calculerAVTax(taxable) {
  if (taxable <= 0) return 0;
  if (taxable <= AV_SEUIL_1) return taxable * AV_TAUX_1;
  return AV_SEUIL_1 * AV_TAUX_1 + (taxable - AV_SEUIL_1) * AV_TAUX_2;
}

// Droits marginaux: how much tax is saved by removing 'montant' from a taxable base of 'base'
function calculerDroitsMarginaux(montant, base) {
  if (base <= 0 || montant <= 0) return calculerDroits(montant) * 0; // might be 0 anyway
  return calculerDroits(base) - calculerDroits(Math.max(base - montant, 0));
}

function leverColor(name) {
  const map = { amber: '#f59e0b', purple: '#a855f7', cyan: '#06b6d4', blue: '#3b82f6', green: '#22c55e', teal: '#14b8a6', indigo: '#6366f1' };
  return map[name] || '#6366f1';
}

// ─── Render ──────────────────────────────────────────────────────────────────

function simInput(id, label, val, unit, min, max, step) {
  return `<div>
    <div class="flex items-center justify-between mb-1.5">
      <label for="${id}" class="text-sm text-gray-400">${label}</label>
      <div class="flex items-center gap-1.5">
        <input type="number" id="${id}" value="${val}" min="${min}" max="${max}" step="${step}"
          class="w-24 input-field [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
        <span class="text-xs text-gray-500 w-12">${unit}</span>
      </div>
    </div>
    <input type="range" id="${id}-range" min="${min}" max="${max}" step="${step}" value="${val}"
      class="w-full h-1.5 bg-dark-600 rounded-full appearance-none cursor-pointer accent-rose-500
      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-500 [&::-webkit-slider-thumb]:shadow-lg
      [&::-webkit-slider-thumb]:cursor-pointer">
  </div>`;
}

function toggleLever(id, label, defaultOn, desc) {
  return `<label class="flex items-start gap-3 p-3 rounded-xl bg-dark-800/40 hover:bg-dark-800/60 transition cursor-pointer group">
    <input type="checkbox" id="succ-${id}" ${defaultOn ? 'checked' : ''}
      class="mt-0.5 w-4 h-4 rounded bg-dark-900 border-dark-400 text-accent-green cursor-pointer">
    <div class="flex-1 min-w-0">
      <span class="text-sm text-gray-300 font-medium group-hover:text-gray-100 transition">${label}</span>
      <p class="text-xs text-gray-600 mt-0.5">${desc}</p>
    </div>
  </label>`;
}

export function render() {
  const d = DEFAULTS;
  return `
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
          </svg>
        </div>
        Succession Pro
      </h2>
      <p class="text-gray-500 text-sm mt-1">Optimise ta transmission — Compare l'impact de chaque levier fiscal</p>
      <div class="mt-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
        <p class="text-xs text-rose-400/80"><span class="font-semibold">Outil autonome</span> — Indépendant de tes données personnelles. Simule différents scénarios patrimoniaux.</p>
      </div>
    </div>

    <!-- Save bar -->
    <div class="card-dark rounded-2xl overflow-hidden">
      <button id="succ-save-toggle" class="w-full flex items-center justify-between px-4 py-3 hover:bg-dark-600/30 transition">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
          <span class="text-sm font-medium text-gray-400">Sauvegardes</span>
          <span id="succ-save-count" class="text-xs text-gray-600"></span>
        </div>
        <svg id="succ-save-chevron" class="w-4 h-4 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div id="succ-save-panel" class="hidden px-4 pb-4">
        <div id="succ-save-content" class="flex items-center gap-2 flex-wrap"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- LEFT: Inputs -->
      <div class="lg:col-span-5 space-y-4">

        <!-- Famille -->
        <div class="card-dark rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            Famille
          </h3>
          ${simInput('succ-age1', 'Âge donateur principal', d.ageDonateur1, 'ans', 25, 95, 1)}
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" id="succ-couple" checked class="w-4 h-4 rounded bg-dark-900 border-dark-400 text-accent-green">
            <span class="text-sm text-gray-400">En couple (double les abattements)</span>
          </label>
          <div id="succ-age2-wrap">${simInput('succ-age2', 'Âge conjoint', d.ageDonateur2, 'ans', 25, 95, 1)}</div>
          ${simInput('succ-enfants', 'Nombre d\'enfants', d.nbEnfants, '', 0, 10, 1)}
          ${simInput('succ-petits-enfants', 'Nombre de petits-enfants', d.nbPetitsEnfants, '', 0, 20, 1)}
        </div>

        <!-- Patrimoine -->
        <div class="card-dark rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Patrimoine estimé
          </h3>
          ${simInput('succ-immobilier', 'Immobilier (valeur nette)', d.immobilier, '€', 0, 10000000, 10000)}
          ${simInput('succ-placements', 'Placements financiers', d.placementsFinanciers, '€', 0, 5000000, 5000)}
          ${simInput('succ-av', 'Assurance-vie', d.assuranceVie, '€', 0, 5000000, 5000)}
          ${simInput('succ-epargne', 'Épargne (livrets, etc.)', d.epargne, '€', 0, 2000000, 1000)}
          ${simInput('succ-cto', 'CTO (Compte-Titres)', d.cto, '€', 0, 2000000, 1000)}
          ${simInput('succ-dettes', 'Dettes restantes', d.dettes, '€', 0, 5000000, 5000)}
        </div>

        <!-- Leviers d'optimisation -->
        <div class="card-dark rounded-2xl p-5 space-y-3">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            Leviers d'optimisation
          </h3>
          <p class="text-xs text-gray-600">Active/désactive chaque levier pour voir son impact sur les droits de succession.</p>
          <div class="space-y-2">
            ${toggleLever('leverDemembrement', 'Démembrement immobilier', d.leverDemembrement, 'Donner la nue-propriété, conserver l\'usufruit (Art. 669 CGI)')}
            ${toggleLever('leverDonationCTO', 'Donation titres CTO', d.leverDonationCTO, 'Purge les plus-values latentes, économise la flat tax')}
            ${toggleLever('leverTEPA', 'Don TEPA (Sarkozy 2007)', d.leverTEPA, formatCurrency(DON_TEPA) + ' exonéré par donateur si < 80 ans (Art. 790 G)')}
            ${toggleLever('leverDonationCash', 'Donation cash classique', d.leverDonationCash, formatCurrency(ABATTEMENT_ENFANT) + ' d\'abattement par parent par enfant (Art. 779)')}
            ${toggleLever('leverCouple', 'Mode couple (×2)', d.leverCouple, 'Double tous les abattements (2 donateurs)')}
            ${toggleLever('leverGrandchildren', 'Petits-enfants', d.leverGrandchildren, formatCurrency(ABATTEMENT_PETIT_ENFANT) + ' d\'abattement par donateur par petit-enfant')}
            ${toggleLever('leverAV', 'Assurance-vie optimisée', d.leverAV, formatCurrency(AV_ABATTEMENT) + ' exonéré par bénéficiaire (primes < 70 ans)')}
            ${toggleLever('lever2eCycle', '2e cycle dans 15 ans', d.lever2eCycle, 'Les abattements se renouvellent tous les 15 ans')}
          </div>
        </div>
      </div>

      <!-- RIGHT: Results -->
      <div class="lg:col-span-7 space-y-4">

        <!-- Big comparison -->
        <div id="succ-hero" class="grid grid-cols-3 gap-3"></div>

        <!-- Levers impact -->
        <div class="card-dark rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Impact de chaque levier</h3>
          <div id="succ-levers-list" class="space-y-2"></div>
          <div id="succ-no-levers" class="hidden text-center py-6 text-gray-600 text-sm">Aucun levier activé</div>
        </div>

        <!-- Waterfall chart -->
        <div class="card-dark rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Cascade d'optimisation</h3>
          <div class="h-80">
            <canvas id="succ-waterfall"></canvas>
          </div>
        </div>

        <!-- Conseils d'expert -->
        <div class="card-dark rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            Conseils d'expert
          </h3>
          <div id="succ-tips" class="space-y-2"></div>
        </div>

        <!-- Reserve héréditaire -->
        <div class="card-dark rounded-2xl p-5" id="succ-reserve-card">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Réserve héréditaire</h3>
          <div id="succ-reserve"></div>
        </div>

        <!-- Baremes reference -->
        <div class="card-dark rounded-2xl overflow-hidden">
          <button id="succ-bareme-toggle" class="w-full flex items-center justify-between px-5 py-3 hover:bg-dark-600/30 transition">
            <span class="text-sm font-medium text-gray-400">Barèmes de référence</span>
            <svg id="succ-bareme-chevron" class="w-4 h-4 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="succ-bareme-panel" class="hidden px-5 pb-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">Droits de donation (ligne directe)</h4>
                <table class="w-full text-xs">
                  <tbody>
                    ${BAREME_DONATION.map((b, i) => {
                      const prev = i > 0 ? BAREME_DONATION[i - 1].limit : 0;
                      const from = formatCurrency(prev);
                      const to = b.limit === Infinity ? '+' : formatCurrency(b.limit);
                      return `<tr class="table-row"><td class="py-1 text-gray-400">${from} → ${to}</td><td class="py-1 text-right text-gray-300">${(b.rate * 100)} %</td></tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">Usufruit / Nue-propriété (Art. 669)</h4>
                <table class="w-full text-xs">
                  <tbody>
                    ${BAREME_USUFRUIT.map(b => {
                      const ageLabel = b.ageMax === Infinity ? '> 90 ans' : '≤ ' + b.ageMax + ' ans';
                      return `<tr class="table-row"><td class="py-1 text-gray-400">${ageLabel}</td><td class="py-1 text-right text-blue-400">${Math.round(b.usufruit * 100)} %</td><td class="py-1 text-right text-amber-400">${Math.round((1 - b.usufruit) * 100)} %</td></tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div class="info-box">
          <p class="text-xs text-gray-600">Simulation indicative basée sur le droit fiscal français en vigueur. Ne constitue pas un conseil juridique ou fiscal. Consultez un notaire pour votre situation personnelle.</p>
        </div>
      </div>
    </div>
  </div>
  `;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mount() {
  FIELD_IDS.forEach(id => {
    const input = document.getElementById(id);
    const range = document.getElementById(id + '-range');
    if (!input) return;
    input.addEventListener('input', () => { if (range) range.value = input.value; recalculate(); });
    if (range) range.addEventListener('input', () => { input.value = range.value; recalculate(); });
  });

  // Checkboxes
  const checkIds = ['succ-couple', 'succ-leverDonationCash', 'succ-leverTEPA', 'succ-leverDemembrement',
    'succ-leverAV', 'succ-leverCouple', 'succ-leverGrandchildren', 'succ-leverDonationCTO', 'succ-lever2eCycle'];
  checkIds.forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      // Toggle age2 visibility
      const wrap = document.getElementById('succ-age2-wrap');
      if (wrap) wrap.style.display = document.getElementById('succ-couple')?.checked ? '' : 'none';
      recalculate();
    });
  });

  // Collapsibles
  document.getElementById('succ-save-toggle')?.addEventListener('click', () => {
    document.getElementById('succ-save-panel').classList.toggle('hidden');
    document.getElementById('succ-save-chevron').classList.toggle('rotate-180');
  });
  document.getElementById('succ-bareme-toggle')?.addEventListener('click', () => {
    document.getElementById('succ-bareme-panel').classList.toggle('hidden');
    document.getElementById('succ-bareme-chevron').classList.toggle('rotate-180');
  });

  refreshSaveBar();
  recalculate();
}

function refreshSaveBar() {
  const container = document.getElementById('succ-save-content');
  const countEl = document.getElementById('succ-save-count');
  if (!container) return;
  const saves = getSaves();
  if (countEl) countEl.textContent = saves.length > 0 ? `(${saves.length})` : '';

  const options = saves.map((s, i) => {
    const d = new Date(s.date);
    return `<option value="${i}">${s.name} — ${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</option>`;
  }).join('');

  container.innerHTML = `
    <select id="succ-save-select" class="flex-1 min-w-0 input-field"><option value="">Choisir…</option>${options}</select>
    <button id="succ-load-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 transition disabled:opacity-30" ${saves.length === 0 ? 'disabled' : ''}>Charger</button>
    <button id="succ-delete-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-30" ${saves.length === 0 ? 'disabled' : ''}>Suppr.</button>
    <span class="mx-1 h-5 w-px bg-dark-400/50 hidden sm:block"></span>
    <button id="succ-save-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition">Sauvegarder</button>
  `;
  document.getElementById('succ-save-btn')?.addEventListener('click', () => { const n = prompt('Nom du scénario :'); if (n?.trim()) { saveCurrentInputs(n.trim()); refreshSaveBar(); } });
  document.getElementById('succ-load-btn')?.addEventListener('click', () => { const i = parseInt(document.getElementById('succ-save-select')?.value); if (!isNaN(i)) { loadSave(i); recalculate(); } });
  document.getElementById('succ-delete-btn')?.addEventListener('click', () => { const i = parseInt(document.getElementById('succ-save-select')?.value); if (!isNaN(i)) { deleteSave(i); refreshSaveBar(); } });
}

function recalculate() {
  const inputs = getInputs();
  const r = compute(inputs);
  renderHero(r);
  renderLevers(r);
  renderWaterfall(r);
  renderTips(r, inputs);
  renderReserve(r);
}

// ─── Hero Cards ──────────────────────────────────────────────────────────────

function renderHero(r) {
  const el = document.getElementById('succ-hero');
  if (!el) return;

  const pctSaved = r.totalDroitsBrut > 0 ? (r.economieGlobale / r.totalDroitsBrut * 100) : 0;

  el.innerHTML = `
    <div class="card-dark rounded-2xl p-4 bg-red-500/5 border border-red-500/10">
      <p class="text-xs text-gray-500 uppercase tracking-wider">Sans optimisation</p>
      <p class="text-xl font-bold text-red-400 mt-1">${formatCurrency(Math.round(r.totalDroitsBrut))}</p>
      <p class="text-xs text-gray-600 mt-0.5">Taux effectif : ${(r.tauxImpositionBrut * 100).toFixed(1)} %</p>
    </div>
    <div class="card-dark rounded-2xl p-4 bg-gradient-to-br from-green-500/5 to-emerald-500/5 border border-green-500/10">
      <p class="text-xs text-gray-500 uppercase tracking-wider">Avec optimisation</p>
      <p class="text-xl font-bold text-accent-green mt-1">${formatCurrency(Math.round(Math.max(r.totalDroitsOptimise, 0)))}</p>
      <p class="text-xs text-gray-600 mt-0.5">Taux effectif : ${(r.tauxImposition * 100).toFixed(1)} %</p>
    </div>
    <div class="card-dark rounded-2xl p-4 bg-gradient-to-br from-accent-green/5 to-accent-cyan/5 border border-accent-green/10">
      <p class="text-xs text-gray-500 uppercase tracking-wider">Économie</p>
      <p class="text-xl font-bold text-accent-cyan mt-1">${formatCurrency(Math.round(Math.max(r.economieGlobale, 0)))}</p>
      <p class="text-xs text-accent-green/70 mt-0.5">${pctSaved.toFixed(0)} % de droits en moins</p>
    </div>
  `;
}

// ─── Levers List ─────────────────────────────────────────────────────────────

function renderLevers(r) {
  const list = document.getElementById('succ-levers-list');
  const empty = document.getElementById('succ-no-levers');
  if (!list) return;

  if (r.levers.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  list.innerHTML = r.levers.map(l => {
    const pct = r.totalDroitsBrut > 0 ? (l.economie / r.totalDroitsBrut * 100) : 0;
    return `
      <div class="flex items-center gap-3 p-3 rounded-xl bg-dark-800/40 border border-dark-400/20">
        <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: ${leverColor(l.color)}"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-sm font-medium text-gray-300">${l.label}</h4>
            <span class="text-sm font-bold text-accent-green flex-shrink-0">-${formatCurrency(Math.round(l.economie))}</span>
          </div>
          <p class="text-[11px] text-gray-600 mt-0.5">${l.desc}</p>
          <div class="mt-1.5 h-1 bg-dark-600 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all" style="width: ${Math.min(pct, 100).toFixed(1)}%; background: ${leverColor(l.color)}"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Waterfall Chart ─────────────────────────────────────────────────────────

function renderWaterfall(r) {
  const canvas = document.getElementById('succ-waterfall');
  if (!canvas) return;

  // Build floating bar data for waterfall
  const labels = r.waterfall.map(w => w.label);
  const colors = r.waterfall.map(w => w.color);

  // For a waterfall: each bar goes from running total before to running total after
  const dataLow = [];
  const dataHigh = [];
  let running = 0;

  for (let i = 0; i < r.waterfall.length; i++) {
    const w = r.waterfall[i];
    if (i === 0) {
      // First bar: 0 to value
      dataLow.push(0);
      dataHigh.push(w.value);
      running = w.value;
    } else if (i === r.waterfall.length - 1) {
      // Last bar: 0 to final
      dataLow.push(0);
      dataHigh.push(w.value);
    } else {
      // Reduction bar
      const newRunning = running + w.value; // w.value is negative
      dataLow.push(Math.max(newRunning, 0));
      dataHigh.push(running);
      running = Math.max(newRunning, 0);
    }
  }

  createChart('succ-waterfall', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Base',
          data: dataLow,
          backgroundColor: 'transparent',
          borderWidth: 0,
          stack: 'stack',
        },
        {
          label: 'Montant',
          data: dataHigh.map((h, i) => h - dataLow[i]),
          backgroundColor: colors,
          borderRadius: 4,
          stack: 'stack',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: COLORS.gridText, font: { size: 10 }, maxRotation: 45 },
        },
        y: {
          stacked: true,
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.gridText, font: { size: 11 }, callback: v => v >= 1000 ? Math.round(v / 1000) + ' k€' : v + ' €' },
          beginAtZero: true,
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(11,11,15,0.95)', titleColor: '#e8d5b0', bodyColor: '#a0a0a5',
          borderColor: 'rgba(56,56,63,0.6)', borderWidth: 1, padding: 12, cornerRadius: 10,
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 0) return null;
              const i = ctx.dataIndex;
              const w = r.waterfall[i];
              if (i === 0) return ` Droits bruts : ${formatCurrency(Math.round(w.value))}`;
              if (i === r.waterfall.length - 1) return ` Droits optimisés : ${formatCurrency(Math.round(w.value))}`;
              return ` ${w.label} : -${formatCurrency(Math.round(Math.abs(w.value)))}`;
            }
          }
        },
      }
    }
  });
}

// ─── Conseils d'expert ───────────────────────────────────────────────────────

function renderTips(r, inp) {
  const el = document.getElementById('succ-tips');
  if (!el) return;

  const tips = [];
  const age = inp.ageDonateur1;
  const np = getNuePropriete(age);

  // Tip: TEPA timing
  if (age < AGE_MAX_TEPA && age >= 70) {
    tips.push({ icon: '⏳', text: `Vous avez ${AGE_MAX_TEPA - age} ans pour profiter du don TEPA (exonéré avant 80 ans). Agissez rapidement.`, priority: 'high' });
  } else if (age >= AGE_MAX_TEPA && inp.leverTEPA) {
    tips.push({ icon: '⛔', text: `Le don TEPA n'est plus possible après 80 ans. Ce levier est désactivé pour vous.`, priority: 'warn' });
  }

  // Tip: Démembrement age-optimal
  if (inp.immobilier > 0) {
    if (age <= 50) {
      tips.push({ icon: '🏠', text: `Nue-propriété à ${Math.round(np * 100)} % : le démembrement est très avantageux à votre âge. Plus vous attendez, moins la décote est forte.` });
    } else if (age <= 60) {
      tips.push({ icon: '🏠', text: `Nue-propriété à ${Math.round(np * 100)} % : bon moment pour démembrer. La décote baisse de 10 points tous les 10 ans.` });
    } else if (age > 70) {
      tips.push({ icon: '🏠', text: `À ${age} ans, la nue-propriété ne vaut que ${Math.round(np * 100)} % — la décote est faible. Le démembrement reste utile mais l'avantage diminue.` });
    }
  }

  // Tip: AV
  if (inp.assuranceVie > 0 && inp.assuranceVie < AV_ABATTEMENT * r.nbEnfants) {
    const cible = AV_ABATTEMENT * r.nbEnfants;
    tips.push({ icon: '🛡️', text: `Votre AV est sous le plafond d'exonération (${formatCurrency(cible)} pour ${r.nbEnfants} enfant(s)). Verser davantage avant 70 ans pour maximiser l'avantage.` });
  } else if (inp.assuranceVie > AV_ABATTEMENT * r.nbEnfants && age < 70) {
    tips.push({ icon: '🛡️', text: `L'excédent AV au-delà de ${formatCurrency(AV_ABATTEMENT)} par bénéficiaire sera taxé à 20 % puis 31,25 %. Diversifiez les bénéficiaires si possible.` });
  }

  // Tip: 2e cycle
  if (!inp.lever2eCycle && age + CYCLE_ANNEES < 85) {
    tips.push({ icon: '🔄', text: `Dans ${CYCLE_ANNEES} ans (à ${age + CYCLE_ANNEES} ans), vos abattements se renouvellent. Anticipez un 2e cycle de donations.` });
  }

  // Tip: Couple
  if (inp.couple && !inp.leverCouple) {
    tips.push({ icon: '💑', text: `Activer le mode couple double tous les abattements. Chaque parent donne séparément à chaque enfant.` });
  }

  // Tip: Petits-enfants
  if (r.nbPE === 0 && r.nbEnfants > 0) {
    tips.push({ icon: '👶', text: `Penser aux petits-enfants : ${formatCurrency(ABATTEMENT_PETIT_ENFANT)} d'abattement par donateur, cumulable avec les abattements enfants.` });
  }

  // Tip: Global effectiveness
  if (r.economieGlobale > 0 && r.totalDroitsBrut > 0) {
    const pct = (r.economieGlobale / r.totalDroitsBrut * 100).toFixed(0);
    if (parseInt(pct) >= 80) {
      tips.push({ icon: '✅', text: `Stratégie très efficace : ${pct} % d'économie. Votre transmission est déjà bien optimisée.` });
    }
  }

  // Tip: high patrimoine, no action
  if (r.levers.length === 0 && r.patrimoineNet > 200000) {
    tips.push({ icon: '⚠️', text: `Avec ${formatCurrency(r.patrimoineNet)} de patrimoine net, activez au moins les abattements classiques pour réduire la facture fiscale.`, priority: 'high' });
  }

  if (tips.length === 0) {
    tips.push({ icon: '💡', text: `Activez des leviers à gauche pour voir les conseils personnalisés apparaître ici.` });
  }

  el.innerHTML = tips.map(t => {
    const borderClass = t.priority === 'high' ? 'border-amber-500/20 bg-amber-500/5' :
      t.priority === 'warn' ? 'border-red-500/20 bg-red-500/5' : 'border-dark-400/20 bg-dark-800/30';
    return `<div class="flex items-start gap-2.5 p-2.5 rounded-xl ${borderClass}">
      <span class="text-sm flex-shrink-0 mt-px">${t.icon}</span>
      <p class="text-xs text-gray-400 leading-relaxed">${t.text}</p>
    </div>`;
  }).join('');
}

// ─── Réserve Héréditaire ─────────────────────────────────────────────────────

function renderReserve(r) {
  const el = document.getElementById('succ-reserve');
  if (!el) return;

  const qd = r.quotiteDisponible;
  const pctReserve = (1 - qd) * 100;
  const pctDispo = qd * 100;

  el.innerHTML = `
    <div class="flex items-center gap-4 mb-3">
      <div class="flex-1 text-center">
        <p class="text-xs text-gray-500">Réserve</p>
        <p class="text-sm font-bold text-blue-400">${pctReserve.toFixed(0)} % · ${formatCurrency(Math.round(r.reserveHereditaire))}</p>
      </div>
      <div class="flex-1 text-center">
        <p class="text-xs text-gray-500">Quotité disponible</p>
        <p class="text-sm font-bold text-amber-400">${pctDispo.toFixed(0)} % · ${formatCurrency(Math.round(r.patrimoineNet * qd))}</p>
      </div>
    </div>
    <div class="h-5 rounded-full overflow-hidden flex bg-dark-600">
      <div class="h-full flex items-center justify-center text-[10px] font-semibold text-blue-100" style="width: ${pctReserve}%; background: rgba(59,130,246,0.4)">Réserve</div>
      <div class="h-full flex items-center justify-center text-[10px] font-semibold text-amber-100" style="width: ${pctDispo}%; background: rgba(245,158,11,0.4)">Libre</div>
    </div>
  `;
}
