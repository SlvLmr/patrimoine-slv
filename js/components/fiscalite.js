import { formatCurrency, openModal, inputField, selectField, getFormData, computeProjection } from '../utils.js?v=5';
import { createChart, COLORS } from '../charts/chart-config.js';

// ============================================================================
// FISCALITE SUCCESSION — Page unifiee
// ============================================================================

// --- Constants fiscales ---
const ABATTEMENT_PARENT_ENFANT = 100000;
const RENOUVELLEMENT_ANNEES = 15;
const DON_FAMILIAL_TEPA = 31865;
const AGE_MAX_DONATEUR_TEPA = 80;

const TRANCHES_DONATION = [
  { min: 0,       max: 8072,    taux: 0.05 },
  { min: 8072,    max: 12109,   taux: 0.10 },
  { min: 12109,   max: 15932,   taux: 0.15 },
  { min: 15932,   max: 552324,  taux: 0.20 },
  { min: 552324,  max: 902838,  taux: 0.30 },
  { min: 902838,  max: 1805677, taux: 0.40 },
  { min: 1805677, max: Infinity, taux: 0.45 }
];

const BAREME_USUFRUIT = [
  { ageMax: 20, usufruit: 0.90, nuePropriete: 0.10 },
  { ageMax: 30, usufruit: 0.80, nuePropriete: 0.20 },
  { ageMax: 40, usufruit: 0.70, nuePropriete: 0.30 },
  { ageMax: 50, usufruit: 0.60, nuePropriete: 0.40 },
  { ageMax: 60, usufruit: 0.50, nuePropriete: 0.50 },
  { ageMax: 70, usufruit: 0.40, nuePropriete: 0.60 },
  { ageMax: 80, usufruit: 0.30, nuePropriete: 0.70 },
  { ageMax: 90, usufruit: 0.20, nuePropriete: 0.80 },
  { ageMax: Infinity, usufruit: 0.10, nuePropriete: 0.90 }
];

const AV_ABATTEMENT_PAR_BENEFICIAIRE = 152500;
const AV_TAUX_1 = 0.20;
const AV_SEUIL_1 = 700000;
const AV_TAUX_2 = 0.3125;

const ABATTEMENTS_REF = [
  { lien: 'Enfant', montant: 100000, renouvellement: '15 ans' },
  { lien: 'Don familial TEPA (< 80 ans)', montant: 31865, renouvellement: '15 ans, cumulable' },
  { lien: 'Petit-enfant', montant: 31865, renouvellement: '15 ans' },
  { lien: 'Conjoint / PACS', montant: 80724, renouvellement: '15 ans' },
  { lien: 'Frere / soeur', montant: 15932, renouvellement: '15 ans' },
  { lien: 'Neveu / niece', montant: 7967, renouvellement: '15 ans' },
  { lien: 'Arriere-petit-enfant', montant: 5310, renouvellement: '15 ans' },
];

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculerDroitsDonation(montantTaxable) {
  if (montantTaxable <= 0) return 0;
  let droits = 0;
  for (const t of TRANCHES_DONATION) {
    if (montantTaxable <= t.min) break;
    droits += (Math.min(montantTaxable, t.max) - t.min) * t.taux;
  }
  return Math.round(droits);
}

function getUsufruitRate(age) {
  for (const t of BAREME_USUFRUIT) {
    if (age <= t.ageMax) return t;
  }
  return BAREME_USUFRUIT[BAREME_USUFRUIT.length - 1];
}

function calculerSuccessionParEnfant(patrimoineHorsAV, nbEnfants, avParEnfant) {
  if (nbEnfants === 0) return { partBrute: 0, abattement: 0, taxable: 0, droits: 0, avDroits: 0 };
  const partBrute = patrimoineHorsAV / nbEnfants;
  const taxable = Math.max(0, partBrute - ABATTEMENT_PARENT_ENFANT);
  const droits = calculerDroitsDonation(taxable);

  const avTaxable = Math.max(0, avParEnfant - AV_ABATTEMENT_PAR_BENEFICIAIRE);
  const avTranche1 = Math.min(avTaxable, AV_SEUIL_1);
  const avTranche2 = Math.max(0, avTaxable - AV_SEUIL_1);
  const avDroits = Math.round(avTranche1 * AV_TAUX_1 + avTranche2 * AV_TAUX_2);

  return { partBrute, taxable, droits, avDroits };
}

function simulerDonations(enfant, donations, ageDonateur) {
  const currentYear = new Date().getFullYear();
  let abattementUtilise = 0;
  let tepaUtilise = 0;
  const results = [];

  for (const don of donations) {
    const yearsSinceFirst = don.annee - (donations[0]?.annee || currentYear);
    if (yearsSinceFirst >= RENOUVELLEMENT_ANNEES) {
      abattementUtilise = 0;
      tepaUtilise = 0;
    }

    const ageDon = ageDonateur + (don.annee - currentYear);
    let montantRestant = don.montant;
    let exonere = 0;
    let taxable = 0;
    let droits = 0;
    let detail = '';

    if (don.type === 'don_manuel' || don.type === 'don_tepa') {
      if (don.type === 'don_tepa' && ageDon < AGE_MAX_DONATEUR_TEPA) {
        const tepaDisponible = DON_FAMILIAL_TEPA - tepaUtilise;
        const tepaUse = Math.min(montantRestant, tepaDisponible);
        tepaUtilise += tepaUse;
        exonere += tepaUse;
        montantRestant -= tepaUse;
        detail = `TEPA: ${formatCurrency(tepaUse)} exonere`;
      }
      const abattDisponible = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
      const abattUse = Math.min(montantRestant, abattDisponible);
      abattementUtilise += abattUse;
      exonere += abattUse;
      montantRestant -= abattUse;
      if (abattUse > 0) detail += (detail ? ' + ' : '') + `Abatt.: ${formatCurrency(abattUse)}`;
      taxable = montantRestant;
      droits = calculerDroitsDonation(taxable);

    } else if (don.type === 'donation_nue_propriete') {
      const rate = getUsufruitRate(ageDon);
      const valeurNP = Math.round(don.montant * rate.nuePropriete);
      detail = `Nue-prop. ${(rate.nuePropriete * 100).toFixed(0)}% = ${formatCurrency(valeurNP)}`;
      montantRestant = valeurNP;
      const abattDisponible = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
      const abattUse = Math.min(montantRestant, abattDisponible);
      abattementUtilise += abattUse;
      exonere += abattUse;
      montantRestant -= abattUse;
      taxable = montantRestant;
      droits = calculerDroitsDonation(taxable);

    } else if (don.type === 'donation_cto') {
      detail = `CTO: purge des PV latentes`;
      const abattDisponible = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
      const abattUse = Math.min(montantRestant, abattDisponible);
      abattementUtilise += abattUse;
      exonere += abattUse;
      montantRestant -= abattUse;
      taxable = montantRestant;
      droits = calculerDroitsDonation(taxable);
    }

    results.push({
      ...don,
      ageDonateur: ageDon,
      exonere,
      taxable,
      droits,
      detail,
      abattementRestant: ABATTEMENT_PARENT_ENFANT - abattementUtilise,
      tepaRestant: DON_FAMILIAL_TEPA - tepaUtilise
    });
  }
  return results;
}

// ============================================================================
// PATRIMOINE FROM STORE
// ============================================================================

function getPatrimoineFromStore(store) {
  const state = store.getAll();
  const actifs = state.actifs || {};
  const passifs = state.passifs || {};
  const immobilier = (actifs.immobilier || []).reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const placements = (actifs.placements || []).filter(p => {
    const env = (p.enveloppe || p.type || '').toUpperCase();
    return !env.includes('AV') && !env.includes('ASSURANCE') && !env.includes('VIE');
  }).reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const cto = (actifs.placements || []).filter(p => {
    const env = (p.enveloppe || p.type || '').toUpperCase();
    return env.includes('CTO') || env.includes('COMPTE TITRE');
  }).reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const assuranceVie = (actifs.placements || []).filter(p => {
    const env = (p.enveloppe || p.type || '').toUpperCase();
    return env.includes('AV') || env.includes('ASSURANCE') || env.includes('VIE');
  }).reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const epargne = (actifs.epargne || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const comptesCourants = (actifs.comptesCourants || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const emprunts = (passifs.emprunts || []).reduce((s, i) => s + (Number(i.capitalRestant) || 0), 0);
  const totalActifs = immobilier + placements + epargne + comptesCourants + assuranceVie;
  const patrimoineNet = totalActifs - emprunts;
  const patrimoineHorsAV = patrimoineNet - assuranceVie;
  return { immobilier, placements, cto, assuranceVie, epargne, comptesCourants, emprunts, totalActifs, patrimoineNet, patrimoineHorsAV };
}

// ============================================================================
// CONFIG (enfants + donations) — persisted in store
// ============================================================================

function getConfig(store) {
  return store.get('donationConfig') || { enfants: [], donations: [] };
}

function saveConfig(store, cfg) {
  store.set('donationConfig', cfg);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getAge(dateNaissance) {
  if (!dateNaissance) return null;
  const born = new Date(dateNaissance);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age--;
  return age;
}

// ============================================================================
// DONATION TYPE LABELS
// ============================================================================

const DONATION_TYPES = [
  { value: 'don_manuel', label: 'Don manuel' },
  { value: 'don_tepa', label: 'Don TEPA (Art. 790 G)' },
  { value: 'donation_nue_propriete', label: 'Donation nue-propriete' },
  { value: 'donation_cto', label: 'Donation titres CTO' },
];

function donationTypeLabel(type) {
  return DONATION_TYPES.find(t => t.value === type)?.label || type;
}

// ============================================================================
// RENDER
// ============================================================================

export function render(store) {
  const params = store.get('parametres') || {};
  const ageDonateur = params.ageFinAnnee || 43;
  const currentYear = new Date().getFullYear();
  const patrimoine = getPatrimoineFromStore(store);
  const cfg = getConfig(store);
  const enfants = cfg.enfants || [];
  const donations = cfg.donations || [];
  const nbEnfants = enfants.length;

  // --- Succession without optimization ---
  const succSans = nbEnfants > 0
    ? calculerSuccessionParEnfant(patrimoine.patrimoineHorsAV, nbEnfants, patrimoine.assuranceVie / nbEnfants)
    : null;
  const totalDroitsSans = succSans ? (succSans.droits + succSans.avDroits) * nbEnfants : 0;

  // --- Simulate donations per child ---
  let totalDroitsDonation = 0;
  let totalDonne = 0;
  const donResultsParEnfant = {};

  for (const enf of enfants) {
    const dons = donations.filter(d => d.enfantId === enf.id).sort((a, b) => a.annee - b.annee);
    const results = simulerDonations(enf, dons, ageDonateur);
    donResultsParEnfant[enf.id] = results;
    totalDonne += results.reduce((s, r) => s + r.exonere + r.taxable, 0);
    totalDroitsDonation += results.reduce((s, r) => s + r.droits, 0);
  }

  // --- Residual succession after donations ---
  const patrimoineResiduelHorsAV = Math.max(0, patrimoine.patrimoineHorsAV - totalDonne);
  const succAvec = nbEnfants > 0
    ? calculerSuccessionParEnfant(patrimoineResiduelHorsAV, nbEnfants, patrimoine.assuranceVie / nbEnfants)
    : null;
  const totalDroitsSuccResiduelle = succAvec ? (succAvec.droits + succAvec.avDroits) * nbEnfants : 0;
  const totalFiscaliteAvec = totalDroitsDonation + totalDroitsSuccResiduelle;
  const economie = totalDroitsSans - totalFiscaliteAvec;
  const economiePct = totalDroitsSans > 0 ? (economie / totalDroitsSans * 100).toFixed(0) : 0;

  // --- Waterfall data ---
  const waterfallLabels = ['Droits bruts'];
  const waterfallValues = [totalDroitsSans];
  const waterfallColors = ['rgba(239,68,68,0.7)'];

  // Collect unique donation types used
  const typesUsed = [...new Set(donations.map(d => d.type))];
  let running = totalDroitsSans;
  for (const type of typesUsed) {
    const donsOfType = donations.filter(d => d.type === type);
    let typeReduction = 0;
    for (const don of donsOfType) {
      const enfResult = donResultsParEnfant[don.enfantId];
      if (enfResult) {
        const r = enfResult.find(er => er.id === don.id);
        if (r) typeReduction += r.exonere; // amount that was tax-free thanks to this donation
      }
    }
    // Approximate the tax saved by this type: droits on exonere amount
    const taxSaved = calculerDroitsDonation(typeReduction);
    if (taxSaved > 0) {
      waterfallLabels.push(donationTypeLabel(type));
      waterfallValues.push(-taxSaved);
      waterfallColors.push('rgba(34,197,94,0.7)');
      running -= taxSaved;
    }
  }

  // AV optimization (separate regime)
  if (succSans && succAvec && succSans.avDroits > succAvec.avDroits) {
    const avSaved = (succSans.avDroits - succAvec.avDroits) * nbEnfants;
    if (avSaved > 0) {
      waterfallLabels.push('Assurance Vie');
      waterfallValues.push(-avSaved);
      waterfallColors.push('rgba(59,130,246,0.7)');
      running -= avSaved;
    }
  }

  waterfallLabels.push('Droits optimises');
  waterfallValues.push(Math.max(0, totalFiscaliteAvec));
  waterfallColors.push('rgba(251,191,36,0.85)');

  // --- Abattement gauge per child ---
  function abattementGauge(enfantId) {
    const results = donResultsParEnfant[enfantId] || [];
    const lastResult = results[results.length - 1];
    const restant = lastResult ? lastResult.abattementRestant : ABATTEMENT_PARENT_ENFANT;
    const utilise = ABATTEMENT_PARENT_ENFANT - restant;
    const pct = Math.round((utilise / ABATTEMENT_PARENT_ENFANT) * 100);
    return { restant, utilise, pct };
  }

  return `
    <div class="max-w-5xl mx-auto space-y-6">

      <!-- HEADER -->
      <div>
        <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
            </svg>
          </div>
          Succession
        </h2>
        <p class="text-gray-500 text-sm mt-1">Planifie ta transmission et optimise la fiscalite pour tes proches</p>
      </div>

      <!-- ============================================================ -->
      <!-- SECTION 1 : FAMILLE -->
      <!-- ============================================================ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg class="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Famille
          </h3>
          <button id="btn-add-enfant"
            class="px-3 py-1.5 bg-gradient-to-r from-pink-500/20 to-rose-500/20 text-pink-300 rounded-lg hover:from-pink-500/30 hover:to-rose-500/30 transition text-sm flex items-center gap-1.5 border border-pink-500/20">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Ajouter un enfant
          </button>
        </div>

        ${enfants.length === 0 ? `
          <p class="text-gray-500 text-sm text-center py-6">Aucun enfant enregistre. Ajoute tes enfants pour simuler la succession.</p>
        ` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${enfants.map(enf => {
              const age = getAge(enf.dateNaissance);
              const gauge = abattementGauge(enf.id);
              return `
              <div class="bg-dark-800/50 rounded-lg p-3 border border-dark-400/20 group">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-pink-500/15 flex items-center justify-center text-pink-300 text-sm font-bold">
                      ${(enf.prenom || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p class="text-sm font-medium text-gray-200">${enf.prenom || 'Sans nom'}</p>
                      <p class="text-xs text-gray-500">${age !== null ? age + ' ans' : 'Age inconnu'}</p>
                    </div>
                  </div>
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button data-edit-enfant="${enf.id}" class="p-1 rounded hover:bg-dark-500 text-gray-500 hover:text-pink-300 transition" title="Modifier">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button data-delete-enfant="${enf.id}" class="p-1 rounded hover:bg-dark-500 text-gray-500 hover:text-red-400 transition" title="Supprimer">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
                <!-- Abattement gauge -->
                <div class="mt-1">
                  <div class="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Abattement utilise</span>
                    <span>${formatCurrency(gauge.utilise)} / ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}</span>
                  </div>
                  <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all ${gauge.pct >= 100 ? 'bg-red-500' : gauge.pct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${Math.min(100, gauge.pct)}%"></div>
                  </div>
                  <p class="text-xs mt-1 ${gauge.restant > 0 ? 'text-emerald-400' : 'text-red-400'}">${formatCurrency(gauge.restant)} restant</p>
                </div>
              </div>`;
            }).join('')}
          </div>
        `}
      </div>

      <!-- ============================================================ -->
      <!-- SECTION 2 : PATRIMOINE (auto from store, read-only) -->
      <!-- ============================================================ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            Patrimoine actuel
          </h3>
          <span class="text-xs text-gray-600">Donnees issues de ton portefeuille</span>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="card-dark rounded-xl p-3 text-center border border-dark-400/20">
            <p class="text-xs text-gray-500 mb-1">Immobilier</p>
            <p class="text-lg font-bold text-amber-400">${formatCurrency(patrimoine.immobilier)}</p>
          </div>
          <div class="card-dark rounded-xl p-3 text-center border border-dark-400/20">
            <p class="text-xs text-gray-500 mb-1">Placements (hors AV)</p>
            <p class="text-lg font-bold text-blue-400">${formatCurrency(patrimoine.placements)}</p>
          </div>
          <div class="card-dark rounded-xl p-3 text-center border border-dark-400/20">
            <p class="text-xs text-gray-500 mb-1">Assurance Vie</p>
            <p class="text-lg font-bold text-purple-400">${formatCurrency(patrimoine.assuranceVie)}</p>
          </div>
          <div class="card-dark rounded-xl p-3 text-center border border-dark-400/20">
            <p class="text-xs text-gray-500 mb-1">Épargne</p>
            <p class="text-lg font-bold text-emerald-400">${formatCurrency(patrimoine.epargne)}</p>
          </div>
          <div class="card-dark rounded-xl p-3 text-center border border-dark-400/20">
            <p class="text-xs text-gray-500 mb-1">Patrimoine net</p>
            <p class="text-lg font-bold gradient-text">${formatCurrency(patrimoine.patrimoineNet)}</p>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- SECTION 3 : IMPACT COMPARISON -->
      <!-- ============================================================ -->
      ${nbEnfants > 0 ? `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Sans optimisation -->
        <div class="card-dark rounded-xl p-5 border border-red-500/20">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-300">Sans optimisation</p>
              <p class="text-xs text-gray-600">Droits de succession bruts</p>
            </div>
          </div>
          <p class="text-3xl font-bold text-red-400">${formatCurrency(totalDroitsSans)}</p>
          <p class="text-xs text-gray-500 mt-1">${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} — abattement ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} chacun</p>
        </div>

        <!-- Avec strategie -->
        <div class="card-dark rounded-xl p-5 border border-emerald-500/20">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-300">Avec votre strategie</p>
              <p class="text-xs text-gray-600">Droits apres donations planifiees</p>
            </div>
          </div>
          <p class="text-3xl font-bold text-emerald-400">${formatCurrency(totalFiscaliteAvec)}</p>
          ${economie > 0 ? `
          <div class="mt-2 flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
              ${formatCurrency(economie)} economies
            </span>
            <span class="text-xs text-gray-500">(${economiePct}% de reduction)</span>
          </div>
          ` : `
          <p class="text-xs text-gray-500 mt-1">Ajoute des donations pour reduire les droits</p>
          `}
        </div>
      </div>
      ` : `
      <div class="card-dark rounded-xl p-8 text-center">
        <p class="text-gray-400">Ajoute au moins un enfant pour voir l'impact fiscal de ta strategie de transmission.</p>
      </div>
      `}

      <!-- ============================================================ -->
      <!-- SECTION 4 : PLAN DE DONATIONS -->
      <!-- ============================================================ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Plan de donations
          </h3>
          <button id="btn-add-donation"
            class="px-3 py-1.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 rounded-lg hover:from-emerald-500/30 hover:to-teal-500/30 transition text-sm flex items-center gap-1.5 border border-emerald-500/20 ${nbEnfants === 0 ? 'opacity-40 cursor-not-allowed' : ''}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            Ajouter une donation
          </button>
        </div>

        ${donations.length === 0 ? `
          <p class="text-gray-500 text-sm text-center py-6">
            ${nbEnfants === 0
              ? 'Ajoute d\'abord tes enfants ci-dessus.'
              : 'Aucune donation planifiee. Ajoute des donations pour optimiser ta transmission.'}
          </p>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-dark-400/30 text-gray-500 text-xs">
                  <th class="text-left py-2 px-2 font-medium">Enfant</th>
                  <th class="text-left py-2 px-2 font-medium">Type</th>
                  <th class="text-right py-2 px-2 font-medium">Montant</th>
                  <th class="text-center py-2 px-2 font-medium">Annee</th>
                  <th class="text-right py-2 px-2 font-medium">Exonere</th>
                  <th class="text-right py-2 px-2 font-medium">Taxable</th>
                  <th class="text-right py-2 px-2 font-medium">Droits</th>
                  <th class="text-right py-2 px-2 font-medium">Abatt. restant</th>
                  <th class="py-2 px-1"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-dark-400/15">
                ${donations.map(don => {
                  const enf = enfants.find(e => e.id === don.enfantId);
                  const results = donResultsParEnfant[don.enfantId] || [];
                  const r = results.find(x => x.id === don.id);
                  return `
                  <tr class="hover:bg-dark-600/20 transition group">
                    <td class="py-2.5 px-2 text-gray-300">${enf?.prenom || '?'}</td>
                    <td class="py-2.5 px-2 text-gray-400">${donationTypeLabel(don.type)}</td>
                    <td class="py-2.5 px-2 text-right text-gray-200 font-medium">${formatCurrency(don.montant)}</td>
                    <td class="py-2.5 px-2 text-center text-gray-400">${don.annee}</td>
                    <td class="py-2.5 px-2 text-right text-emerald-400">${r ? formatCurrency(r.exonere) : '-'}</td>
                    <td class="py-2.5 px-2 text-right text-amber-400">${r ? formatCurrency(r.taxable) : '-'}</td>
                    <td class="py-2.5 px-2 text-right ${r && r.droits > 0 ? 'text-red-400' : 'text-emerald-400'} font-medium">${r ? formatCurrency(r.droits) : '-'}</td>
                    <td class="py-2.5 px-2 text-right text-gray-500 text-xs">${r ? formatCurrency(r.abattementRestant) : '-'}</td>
                    <td class="py-2.5 px-1">
                      <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button data-edit-donation="${don.id}" class="p-1 rounded hover:bg-dark-500 text-gray-500 hover:text-emerald-300 transition" title="Modifier">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button data-delete-donation="${don.id}" class="p-1 rounded hover:bg-dark-500 text-gray-500 hover:text-red-400 transition" title="Supprimer">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Totals row -->
          <div class="mt-3 pt-3 border-t border-dark-400/20 flex flex-wrap gap-4 text-sm">
            <div>
              <span class="text-gray-500">Total donne :</span>
              <span class="text-gray-200 font-medium ml-1">${formatCurrency(totalDonne)}</span>
            </div>
            <div>
              <span class="text-gray-500">Total droits donation :</span>
              <span class="${totalDroitsDonation > 0 ? 'text-red-400' : 'text-emerald-400'} font-medium ml-1">${formatCurrency(totalDroitsDonation)}</span>
            </div>
            <div>
              <span class="text-gray-500">Patrimoine residuel :</span>
              <span class="text-gray-200 font-medium ml-1">${formatCurrency(patrimoineResiduelHorsAV)}</span>
            </div>
          </div>
        `}
      </div>

      <!-- ============================================================ -->
      <!-- SECTION 5 : WATERFALL CHART -->
      <!-- ============================================================ -->
      ${nbEnfants > 0 && donations.length > 0 ? `
      <div class="card-dark rounded-xl p-5">
        <h3 class="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          Impact des optimisations
        </h3>
        <div class="h-64">
          <canvas id="chart-waterfall"></canvas>
        </div>
      </div>
      ` : ''}

      <!-- ============================================================ -->
      <!-- SECTION 6 : EDUCATION (collapsible) -->
      <!-- ============================================================ -->
      <details class="card-dark rounded-xl overflow-hidden group" id="section-education">
        <summary class="p-5 cursor-pointer flex items-center justify-between hover:bg-dark-600/20 transition">
          <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
            Comprendre les abattements
          </h3>
          <svg class="w-5 h-5 text-gray-500 transform transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </summary>
        <div class="px-5 pb-5 space-y-4">
          <p class="text-sm text-gray-400">
            Chaque parent peut transmettre un certain montant en franchise de droits, selon le lien de parente.
            Ces abattements se renouvellent tous les 15 ans, ce qui permet de planifier plusieurs cycles de donations.
          </p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-dark-400/30 text-gray-500 text-xs">
                  <th class="text-left py-2 px-3 font-medium">Lien de parente</th>
                  <th class="text-right py-2 px-3 font-medium">Abattement</th>
                  <th class="text-right py-2 px-3 font-medium">Renouvellement</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-dark-400/15">
                ${ABATTEMENTS_REF.map(a => `
                <tr class="hover:bg-dark-600/20 transition">
                  <td class="py-2 px-3 text-gray-300">${a.lien}</td>
                  <td class="py-2 px-3 text-right font-medium text-emerald-400">${formatCurrency(a.montant)}</td>
                  <td class="py-2 px-3 text-right text-gray-500">${a.renouvellement}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <p class="text-xs text-gray-600 mt-2">
            Le don familial TEPA (art. 790 G CGI) est cumulable avec l'abattement classique enfant de 100 000 euros.
            Il faut que le donateur ait moins de 80 ans et le donataire soit majeur.
          </p>
        </div>
      </details>

      <!-- ============================================================ -->
      <!-- SECTION 7 : BAREMES FISCAUX (collapsible) -->
      <!-- ============================================================ -->
      <details class="card-dark rounded-xl overflow-hidden group" id="section-baremes">
        <summary class="p-5 cursor-pointer flex items-center justify-between hover:bg-dark-600/20 transition">
          <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
            Baremes fiscaux
          </h3>
          <svg class="w-5 h-5 text-gray-500 transform transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </summary>
        <div class="px-5 pb-5 space-y-6">
          <!-- Tax brackets -->
          <div>
            <h4 class="text-sm font-medium text-gray-300 mb-3">Bareme des droits de donation en ligne directe</h4>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-dark-400/30 text-gray-500 text-xs">
                    <th class="text-left py-2 px-3 font-medium">Tranche</th>
                    <th class="text-right py-2 px-3 font-medium">Taux</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-dark-400/15">
                  ${TRANCHES_DONATION.map(t => `
                  <tr class="hover:bg-dark-600/20 transition">
                    <td class="py-1.5 px-3 text-gray-400">${formatCurrency(t.min)} - ${t.max === Infinity ? 'au-dela' : formatCurrency(t.max)}</td>
                    <td class="py-1.5 px-3 text-right font-medium text-amber-400">${(t.taux * 100).toFixed(0)}%</td>
                  </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Usufruit table -->
          <div>
            <h4 class="text-sm font-medium text-gray-300 mb-3">Bareme de l'usufruit (Art. 669 CGI)</h4>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-dark-400/30 text-gray-500 text-xs">
                    <th class="text-left py-2 px-3 font-medium">Age du donateur</th>
                    <th class="text-right py-2 px-3 font-medium">Usufruit</th>
                    <th class="text-right py-2 px-3 font-medium">Nue-propriete</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-dark-400/15">
                  ${BAREME_USUFRUIT.filter(b => b.ageMax !== Infinity).map(b => `
                  <tr class="hover:bg-dark-600/20 transition ${ageDonateur <= b.ageMax && (BAREME_USUFRUIT.indexOf(b) === 0 || ageDonateur > BAREME_USUFRUIT[BAREME_USUFRUIT.indexOf(b) - 1].ageMax) ? 'bg-pink-500/5 border-l-2 border-pink-400' : ''}">
                    <td class="py-1.5 px-3 text-gray-400">${b.ageMax === 20 ? '< 21' : (BAREME_USUFRUIT[BAREME_USUFRUIT.indexOf(b) - 1]?.ageMax || 0) + 1 + ' - ' + b.ageMax} ans</td>
                    <td class="py-1.5 px-3 text-right text-gray-400">${(b.usufruit * 100).toFixed(0)}%</td>
                    <td class="py-1.5 px-3 text-right font-medium text-pink-400">${(b.nuePropriete * 100).toFixed(0)}%</td>
                  </tr>
                  `).join('')}
                  <tr class="hover:bg-dark-600/20 transition">
                    <td class="py-1.5 px-3 text-gray-400">91 ans et +</td>
                    <td class="py-1.5 px-3 text-right text-gray-400">10%</td>
                    <td class="py-1.5 px-3 text-right font-medium text-pink-400">90%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-xs text-gray-600 mt-2">
              Plus le donateur est jeune, plus l'usufruit est eleve et donc la nue-propriete (base taxable) est faible.
              C'est pourquoi il est avantageux de donner tot.
            </p>
          </div>

          <!-- Assurance Vie -->
          <div>
            <h4 class="text-sm font-medium text-gray-300 mb-2">Assurance Vie (Art. 990 I CGI)</h4>
            <div class="text-sm text-gray-400 space-y-1">
              <p>Abattement : <span class="text-purple-400 font-medium">${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}</span> par beneficiaire (primes versees avant 70 ans)</p>
              <p>De ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} a ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE + AV_SEUIL_1)} : <span class="text-amber-400 font-medium">20%</span></p>
              <p>Au-dela de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE + AV_SEUIL_1)} : <span class="text-red-400 font-medium">31,25%</span></p>
            </div>
          </div>
        </div>
      </details>

    </div>
  `;
}

// ============================================================================
// MOUNT — Event listeners
// ============================================================================

export function mount(store, navigate) {
  const cfg = getConfig(store);
  const enfants = cfg.enfants || [];
  const donations = cfg.donations || [];
  const params = store.get('parametres') || {};
  const ageDonateur = params.ageFinAnnee || 43;

  // --- Refresh helper ---
  function refresh() {
    navigate('fiscalite');
  }

  // --- Add child ---
  document.getElementById('btn-add-enfant')?.addEventListener('click', () => {
    openEnfantModal(store, refresh);
  });

  // --- Edit child ---
  document.querySelectorAll('[data-edit-enfant]').forEach(btn => {
    btn.addEventListener('click', () => {
      const enf = enfants.find(e => e.id === btn.dataset.editEnfant);
      if (enf) openEnfantModal(store, refresh, enf);
    });
  });

  // --- Delete child ---
  document.querySelectorAll('[data-delete-enfant]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cet enfant et toutes ses donations ?')) {
        const c = getConfig(store);
        c.enfants = (c.enfants || []).filter(e => e.id !== btn.dataset.deleteEnfant);
        c.donations = (c.donations || []).filter(d => d.enfantId !== btn.dataset.deleteEnfant);
        saveConfig(store, c);
        refresh();
      }
    });
  });

  // --- Add donation ---
  document.getElementById('btn-add-donation')?.addEventListener('click', () => {
    const c = getConfig(store);
    if ((c.enfants || []).length === 0) return;
    openDonationModal(store, refresh, c.enfants);
  });

  // --- Edit donation ---
  document.querySelectorAll('[data-edit-donation]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getConfig(store);
      const don = (c.donations || []).find(d => d.id === btn.dataset.editDonation);
      if (don) openDonationModal(store, refresh, c.enfants, don);
    });
  });

  // --- Delete donation ---
  document.querySelectorAll('[data-delete-donation]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cette donation ?')) {
        const c = getConfig(store);
        c.donations = (c.donations || []).filter(d => d.id !== btn.dataset.deleteDonation);
        saveConfig(store, c);
        refresh();
      }
    });
  });

  // --- Waterfall chart ---
  const patrimoine = getPatrimoineFromStore(store);
  const nbEnfants = enfants.length;

  if (nbEnfants > 0 && donations.length > 0 && document.getElementById('chart-waterfall')) {
    // Recompute waterfall data
    const succSans = calculerSuccessionParEnfant(patrimoine.patrimoineHorsAV, nbEnfants, patrimoine.assuranceVie / nbEnfants);
    const totalDroitsSans = (succSans.droits + succSans.avDroits) * nbEnfants;

    const donResultsParEnfant = {};
    let totalDroitsDonation = 0;
    let totalDonne = 0;
    for (const enf of enfants) {
      const dons = donations.filter(d => d.enfantId === enf.id).sort((a, b) => a.annee - b.annee);
      const results = simulerDonations(enf, dons, ageDonateur);
      donResultsParEnfant[enf.id] = results;
      totalDonne += results.reduce((s, r) => s + r.exonere + r.taxable, 0);
      totalDroitsDonation += results.reduce((s, r) => s + r.droits, 0);
    }

    const patrimoineResiduelHorsAV = Math.max(0, patrimoine.patrimoineHorsAV - totalDonne);
    const succAvec = calculerSuccessionParEnfant(patrimoineResiduelHorsAV, nbEnfants, patrimoine.assuranceVie / nbEnfants);
    const totalDroitsSuccResiduelle = (succAvec.droits + succAvec.avDroits) * nbEnfants;
    const totalFiscaliteAvec = totalDroitsDonation + totalDroitsSuccResiduelle;

    // Build waterfall bars
    const waterfallLabels = ['Droits bruts'];
    const waterfallData = [totalDroitsSans];
    const waterfallBg = ['rgba(239,68,68,0.7)'];
    const waterfallBorder = ['rgba(239,68,68,1)'];

    const typesUsed = [...new Set(donations.map(d => d.type))];
    let running = totalDroitsSans;
    for (const type of typesUsed) {
      const donsOfType = donations.filter(d => d.type === type);
      let typeExonere = 0;
      for (const don of donsOfType) {
        const enfResult = donResultsParEnfant[don.enfantId];
        if (enfResult) {
          const r = enfResult.find(er => er.id === don.id);
          if (r) typeExonere += r.exonere;
        }
      }
      const taxSaved = calculerDroitsDonation(typeExonere);
      if (taxSaved > 0) {
        waterfallLabels.push(donationTypeLabel(type));
        waterfallData.push(-taxSaved);
        waterfallBg.push('rgba(34,197,94,0.6)');
        waterfallBorder.push('rgba(34,197,94,1)');
        running -= taxSaved;
      }
    }

    waterfallLabels.push('Droits optimises');
    waterfallData.push(Math.max(0, totalFiscaliteAvec));
    waterfallBg.push('rgba(251,191,36,0.7)');
    waterfallBorder.push('rgba(251,191,36,1)');

    // Convert to floating bar format for waterfall
    const floatingData = [];
    let cumulative = 0;
    for (let i = 0; i < waterfallData.length; i++) {
      const val = waterfallData[i];
      if (i === 0) {
        // First bar: starts at 0
        floatingData.push([0, val]);
        cumulative = val;
      } else if (i === waterfallData.length - 1) {
        // Last bar: final total
        floatingData.push([0, val]);
      } else {
        // Intermediate: negative delta
        const newCum = cumulative + val;
        floatingData.push([newCum, cumulative]);
        cumulative = newCum;
      }
    }

    createChart('chart-waterfall', {
      type: 'bar',
      data: {
        labels: waterfallLabels,
        datasets: [{
          data: floatingData,
          backgroundColor: waterfallBg,
          borderColor: waterfallBorder,
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: 'x',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const val = ctx.raw;
                if (Array.isArray(val)) {
                  const amount = Math.abs(val[1] - val[0]);
                  return ` ${formatCurrency(amount)}`;
                }
                return ` ${formatCurrency(val)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: COLORS.gridText, font: { size: 11 } }
          },
          y: {
            grid: { color: COLORS.grid },
            ticks: {
              color: COLORS.gridText,
              callback: v => formatCurrency(v)
            }
          }
        }
      }
    });
  }
}

// ============================================================================
// MODAL: Add/Edit Child
// ============================================================================

function openEnfantModal(store, refresh, editEnfant = null) {
  const title = editEnfant ? 'Modifier l\'enfant' : 'Ajouter un enfant';
  const body = `
    ${inputField('prenom', 'Prenom', editEnfant?.prenom || '', 'text', 'placeholder="Ex: Emma, Lucas..."')}
    ${inputField('dateNaissance', 'Date de naissance', editEnfant?.dateNaissance || '', 'date')}
  `;

  openModal(title, body, () => {
    const modal = document.getElementById('app-modal');
    const data = getFormData(modal.querySelector('#modal-body'));
    if (!data.prenom) return;

    const c = getConfig(store);
    if (editEnfant) {
      c.enfants = (c.enfants || []).map(e =>
        e.id === editEnfant.id ? { ...e, prenom: data.prenom, dateNaissance: data.dateNaissance } : e
      );
    } else {
      c.enfants = c.enfants || [];
      c.enfants.push({ id: generateId(), prenom: data.prenom, dateNaissance: data.dateNaissance });
    }
    saveConfig(store, c);
    refresh();
  });
}

// ============================================================================
// MODAL: Add/Edit Donation
// ============================================================================

function openDonationModal(store, refresh, enfants, editDon = null) {
  const currentYear = new Date().getFullYear();
  const title = editDon ? 'Modifier la donation' : 'Planifier une donation';

  const enfantOptions = enfants.map(e => ({ value: e.id, label: e.prenom || 'Sans nom' }));
  const typeOptions = DONATION_TYPES;

  const body = `
    ${selectField('enfantId', 'Enfant', enfantOptions, editDon?.enfantId || enfants[0]?.id || '')}
    ${selectField('type', 'Type de donation', typeOptions, editDon?.type || 'don_manuel')}
    ${inputField('montant', 'Montant (euros)', editDon?.montant || '', 'number', 'min="0" step="1000" placeholder="100000"')}
    ${inputField('annee', 'Annee cible', editDon?.annee || currentYear, 'number', `min="${currentYear}" max="${currentYear + 50}" step="1"`)}
    <p class="text-xs text-gray-600 mt-1">
      Les abattements se renouvellent tous les 15 ans. Le don TEPA necessite que le donateur ait moins de 80 ans.
    </p>
  `;

  openModal(title, body, () => {
    const modal = document.getElementById('app-modal');
    const data = getFormData(modal.querySelector('#modal-body'));
    if (!data.enfantId || !data.montant || !data.annee) return;

    const c = getConfig(store);
    c.donations = c.donations || [];

    if (editDon) {
      c.donations = c.donations.map(d =>
        d.id === editDon.id
          ? { ...d, enfantId: data.enfantId, type: data.type, montant: Number(data.montant), annee: Number(data.annee) }
          : d
      );
    } else {
      c.donations.push({
        id: generateId(),
        enfantId: data.enfantId,
        type: data.type,
        montant: Number(data.montant),
        annee: Number(data.annee)
      });
    }
    saveConfig(store, c);
    refresh();
  });
}
