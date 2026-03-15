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

  // --- Gauges per child (abattement + TEPA + AV + 15-year renewal) ---
  const avParEnfant = nbEnfants > 0 ? patrimoine.assuranceVie / nbEnfants : 0;
  function childGauges(enfantId) {
    const results = donResultsParEnfant[enfantId] || [];
    const lastResult = results[results.length - 1];
    const abattRestant = lastResult ? lastResult.abattementRestant : ABATTEMENT_PARENT_ENFANT;
    const abattUtilise = ABATTEMENT_PARENT_ENFANT - abattRestant;
    const abattPct = Math.round((abattUtilise / ABATTEMENT_PARENT_ENFANT) * 100);
    const tepaRestant = lastResult ? lastResult.tepaRestant : DON_FAMILIAL_TEPA;
    const tepaUtilise = DON_FAMILIAL_TEPA - tepaRestant;
    const tepaPct = Math.round((tepaUtilise / DON_FAMILIAL_TEPA) * 100);
    // AV: assurance vie abattement 152 500 € par bénéficiaire
    const avUtilise = Math.min(avParEnfant, AV_ABATTEMENT_PAR_BENEFICIAIRE);
    const avRestant = Math.max(0, AV_ABATTEMENT_PAR_BENEFICIAIRE - avParEnfant);
    const avPct = Math.round((avParEnfant / AV_ABATTEMENT_PAR_BENEFICIAIRE) * 100);
    // 15-year renewal: find first donation year for this child
    const enfDons = donations.filter(d => d.enfantId === enfantId).sort((a, b) => a.annee - b.annee);
    const firstDonYear = enfDons.length > 0 ? enfDons[0].annee : null;
    const renewalYear = firstDonYear ? firstDonYear + RENOUVELLEMENT_ANNEES : null;
    const yearsUntilRenewal = renewalYear ? renewalYear - currentYear : null;
    return { abattRestant, abattUtilise, abattPct, tepaRestant, tepaUtilise, tepaPct, avUtilise, avRestant, avPct, firstDonYear, renewalYear, yearsUntilRenewal };
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
          <div class="space-y-4">
            ${enfants.map(enf => {
              const age = getAge(enf.dateNaissance);
              const g = childGauges(enf.id);
              const enfDons = donations.filter(d => d.enfantId === enf.id).sort((a, b) => a.annee - b.annee);
              const enfResults = donResultsParEnfant[enf.id] || [];
              return `
              <div class="bg-dark-800/50 rounded-lg border border-dark-400/20 group">
                <div class="flex flex-col md:flex-row">
                  <!-- LEFT: Child info + gauges -->
                  <div class="p-4 md:w-64 md:min-w-[256px] md:border-r border-dark-400/15 flex-shrink-0">
                    <div class="flex items-center justify-between mb-3">
                      <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-full bg-pink-500/15 flex items-center justify-center text-pink-300 text-sm font-bold">
                          ${(enf.prenom || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p class="text-sm font-semibold text-gray-200">${enf.prenom || 'Sans nom'}</p>
                          <p class="text-[11px] text-gray-500">${age !== null ? age + ' ans' : 'Age inconnu'}</p>
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

                    <!-- Gauge 1: Abattement 100k -->
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-1">
                        <span class="text-gray-500 flex items-center gap-1">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                          Abattement
                        </span>
                        <span class="text-gray-400">${formatCurrency(g.abattUtilise)} / ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}</span>
                      </div>
                      <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all ${g.abattPct >= 100 ? 'bg-red-500' : g.abattPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${Math.min(100, g.abattPct)}%"></div>
                      </div>
                      <div class="flex justify-between mt-0.5">
                        <span class="text-[10px] ${g.abattRestant > 0 ? 'text-emerald-400' : 'text-red-400'}">${formatCurrency(g.abattRestant)} restant</span>
                        ${g.renewalYear ? `<span class="text-[10px] text-amber-400/70" title="L'abattement se renouvelle 15 ans apres la 1ere donation">Renouv. ${g.renewalYear}</span>` : ''}
                      </div>
                    </div>

                    <!-- Gauge 2: TEPA -->
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-1">
                        <span class="text-gray-500 flex items-center gap-1">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          TEPA
                        </span>
                        <span class="text-gray-400">${formatCurrency(g.tepaUtilise)} / ${formatCurrency(DON_FAMILIAL_TEPA)}</span>
                      </div>
                      <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all ${g.tepaPct >= 100 ? 'bg-red-500' : g.tepaPct >= 50 ? 'bg-amber-500' : 'bg-cyan-500'}" style="width: ${Math.min(100, g.tepaPct)}%"></div>
                      </div>
                      <div class="flex justify-between mt-0.5">
                        <span class="text-[10px] ${g.tepaRestant > 0 ? 'text-cyan-400' : 'text-red-400'}">${g.tepaRestant > 0 ? formatCurrency(g.tepaRestant) + ' disponible' : 'Utilise'}</span>
                        <span class="text-[10px] text-gray-600">< 80 ans</span>
                      </div>
                    </div>

                    <!-- Gauge 3: Assurance Vie -->
                    <div>
                      <div class="flex justify-between text-[11px] mb-1">
                        <span class="text-gray-500 flex items-center gap-1">
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                          Assurance Vie
                        </span>
                        <span class="text-gray-400">${formatCurrency(g.avUtilise)} / ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}</span>
                      </div>
                      <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all ${g.avPct >= 100 ? 'bg-red-500' : g.avPct >= 50 ? 'bg-amber-500' : 'bg-purple-500'}" style="width: ${Math.min(100, g.avPct)}%"></div>
                      </div>
                      <div class="flex justify-between mt-0.5">
                        <span class="text-[10px] ${g.avRestant > 0 ? 'text-purple-400' : 'text-red-400'}">${g.avRestant > 0 ? formatCurrency(g.avRestant) + ' disponible' : 'Sature'}</span>
                        <span class="text-[10px] text-gray-600">Art. 990 I</span>
                      </div>
                    </div>
                  </div>

                  <!-- RIGHT: Donation table per child -->
                  <div class="flex-1 p-4">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs text-gray-500 font-medium">Plan de donations</span>
                      <button data-add-donation-enfant="${enf.id}"
                        class="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 transition text-[11px] flex items-center gap-1 border border-emerald-500/15">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                        </svg>
                        Ajouter
                      </button>
                    </div>
                    ${enfDons.length === 0 ? `
                      <p class="text-gray-600 text-xs text-center py-4">Aucune donation planifiee</p>
                    ` : `
                      <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                          <thead>
                            <tr class="border-b border-dark-400/30 text-gray-500 text-[10px]">
                              <th class="text-left py-1.5 px-1.5 font-medium">Type</th>
                              <th class="text-right py-1.5 px-1.5 font-medium">Montant</th>
                              <th class="text-center py-1.5 px-1.5 font-medium">Annee</th>
                              <th class="text-right py-1.5 px-1.5 font-medium">Exonere</th>
                              <th class="text-right py-1.5 px-1.5 font-medium">Taxable</th>
                              <th class="text-right py-1.5 px-1.5 font-medium">Droits</th>
                              <th class="text-right py-1.5 px-1.5 font-medium">Abatt. rest.</th>
                              <th class="py-1.5 px-0.5"></th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-dark-400/15">
                            ${enfDons.map(don => {
                              const r = enfResults.find(x => x.id === don.id);
                              return `
                              <tr class="hover:bg-dark-600/20 transition group">
                                <td class="py-1.5 px-1.5">
                                  <span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    don.type === 'don_tepa' ? 'bg-cyan-500/10 text-cyan-400' :
                                    don.type === 'donation_nue_propriete' ? 'bg-purple-500/10 text-purple-400' :
                                    don.type === 'donation_cto' ? 'bg-blue-500/10 text-blue-400' :
                                    'bg-emerald-500/10 text-emerald-400'
                                  }">${donationTypeLabel(don.type)}</span>
                                </td>
                                <td class="py-1.5 px-1.5 text-right text-gray-200 font-medium">${formatCurrency(don.montant)}</td>
                                <td class="py-1.5 px-1.5 text-center text-gray-400">${don.annee}</td>
                                <td class="py-1.5 px-1.5 text-right text-emerald-400">${r ? formatCurrency(r.exonere) : '-'}</td>
                                <td class="py-1.5 px-1.5 text-right text-amber-400">${r ? formatCurrency(r.taxable) : '-'}</td>
                                <td class="py-1.5 px-1.5 text-right ${r && r.droits > 0 ? 'text-red-400' : 'text-emerald-400'} font-medium">${r ? formatCurrency(r.droits) : '-'}</td>
                                <td class="py-1.5 px-1.5 text-right text-gray-500 text-[10px]">${r ? formatCurrency(r.abattementRestant) : '-'}</td>
                                <td class="py-1.5 px-0.5">
                                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                    <button data-edit-donation="${don.id}" class="p-0.5 rounded hover:bg-dark-500 text-gray-500 hover:text-emerald-300 transition" title="Modifier">
                                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                    </button>
                                    <button data-delete-donation="${don.id}" class="p-0.5 rounded hover:bg-dark-500 text-gray-500 hover:text-red-400 transition" title="Supprimer">
                                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>
                      ${g.renewalYear && g.renewalYear > currentYear ? `
                      <div class="mt-2 text-[10px] text-amber-400/60 flex items-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Renouvellement abattements en ${g.renewalYear} (cycle 15 ans)
                      </div>
                      ` : ''}
                    `}
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        `}
      </div>

      <!-- ============================================================ -->
      <!-- SECTION 2b : PROJECTION SLIDER -->
      <!-- ============================================================ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            Projection dans le temps
          </h3>
          <div class="flex items-center gap-2">
            <span id="fisc-slider-label" class="text-sm font-medium text-sky-400">Aujourd'hui</span>
            <span id="fisc-slider-age" class="text-xs text-gray-500">${ageDonateur} ans</span>
          </div>
        </div>
        <input type="range" id="fisc-year-slider" min="0" max="${params.projectionYears || 30}" value="0" step="1"
          class="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-sky-500
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:shadow-sky-500/30 [&::-webkit-slider-thumb]:cursor-grab
          [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-sky-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab">
        <div class="flex justify-between mt-1 text-xs text-gray-600">
          <span>${currentYear}</span>
          <span>+10 ans</span>
          <span>+20 ans</span>
          <span>+${params.projectionYears || 30} ans</span>
        </div>
        <!-- Projected KPIs (updated by slider) -->
        <div id="fisc-projected-kpis" class="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4" style="display:none">
          <div class="card-dark rounded-xl p-3 text-center border border-sky-500/20">
            <p class="text-xs text-gray-500 mb-1">Immobilier</p>
            <p id="fisc-proj-immo" class="text-lg font-bold text-amber-400">-</p>
            <p id="fisc-proj-immo-delta" class="text-[10px] text-gray-600"></p>
          </div>
          <div class="card-dark rounded-xl p-3 text-center border border-sky-500/20">
            <p class="text-xs text-gray-500 mb-1">Placements (hors AV)</p>
            <p id="fisc-proj-plac" class="text-lg font-bold text-blue-400">-</p>
            <p id="fisc-proj-plac-delta" class="text-[10px] text-gray-600"></p>
          </div>
          <div class="card-dark rounded-xl p-3 text-center border border-sky-500/20">
            <p class="text-xs text-gray-500 mb-1">Assurance Vie</p>
            <p id="fisc-proj-av" class="text-lg font-bold text-purple-400">-</p>
            <p id="fisc-proj-av-delta" class="text-[10px] text-gray-600"></p>
          </div>
          <div class="card-dark rounded-xl p-3 text-center border border-sky-500/20">
            <p class="text-xs text-gray-500 mb-1">Épargne</p>
            <p id="fisc-proj-epar" class="text-lg font-bold text-emerald-400">-</p>
            <p id="fisc-proj-epar-delta" class="text-[10px] text-gray-600"></p>
          </div>
          <div class="card-dark rounded-xl p-3 text-center border border-sky-500/20">
            <p class="text-xs text-gray-500 mb-1">Patrimoine net</p>
            <p id="fisc-proj-net" class="text-lg font-bold gradient-text">-</p>
            <p id="fisc-proj-net-delta" class="text-[10px] text-gray-600"></p>
          </div>
        </div>

        <!-- Impact comparison -->
        ${nbEnfants > 0 ? `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
            <p id="fisc-succ-sans-amount" class="text-3xl font-bold text-red-400">${formatCurrency(totalDroitsSans)}</p>
            <p id="fisc-succ-sans-detail" class="text-xs text-gray-500 mt-1">${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} — abattement ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} chacun</p>
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
            <p id="fisc-succ-avec-amount" class="text-3xl font-bold text-emerald-400">${formatCurrency(totalFiscaliteAvec)}</p>
            <div id="fisc-succ-avec-detail">
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
        </div>
        ` : ''}
      </div>

      <!-- ============================================================ -->
      <!-- SECTION 2c : TIMELINE CONSEILS FINANCIERS -->
      <!-- ============================================================ -->
      <div class="card-dark rounded-xl p-5">
        <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          Conseils financiers personnalises
        </h3>
        <div id="fisc-timeline" class="relative pl-6">
          <div class="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/40 via-sky-500/30 to-transparent"></div>
          <p class="text-gray-500 text-sm">Chargement de l'analyse...</p>
        </div>
      </div>

      <!-- Donation totals summary -->
      ${donations.length > 0 ? `
      <div class="card-dark rounded-xl p-4">
        <div class="flex flex-wrap gap-4 text-sm">
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
      </div>
      ` : ''}

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

  // --- Add donation per child ---
  document.querySelectorAll('[data-add-donation-enfant]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getConfig(store);
      const enfantId = btn.dataset.addDonationEnfant;
      const enf = (c.enfants || []).find(e => e.id === enfantId);
      if (!enf) return;
      openDonationModal(store, refresh, c.enfants, null, enfantId);
    });
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

  // --- Projection slider + Timeline ---
  const patrimoine = getPatrimoineFromStore(store);
  const nbEnfants = enfants.length;

  let snapshots = [];
  try {
    snapshots = computeProjection(store);
  } catch (e) {
    console.error('Projection error:', e);
  }

  const projGroupKeys = snapshots.groupKeys || [];
  const currentYear = new Date().getFullYear();

  // Slider update
  const slider = document.getElementById('fisc-year-slider');
  const sliderLabel = document.getElementById('fisc-slider-label');
  const sliderAge = document.getElementById('fisc-slider-age');
  const projKpis = document.getElementById('fisc-projected-kpis');

  if (slider && snapshots.length > 0) {
    slider.max = snapshots.length - 1;

    // Pre-compute original succession values for reset on yearIdx === 0
    const origSansAmount = document.getElementById('fisc-succ-sans-amount');
    const origSansDetail = document.getElementById('fisc-succ-sans-detail');
    const origAvecAmount = document.getElementById('fisc-succ-avec-amount');
    const origAvecDetail = document.getElementById('fisc-succ-avec-detail');
    const origSansText = origSansAmount ? origSansAmount.textContent : '';
    const origSansDetailText = origSansDetail ? origSansDetail.textContent : '';
    const origAvecText = origAvecAmount ? origAvecAmount.textContent : '';
    const origAvecDetailHTML = origAvecDetail ? origAvecDetail.innerHTML : '';

    const updateSlider = (yearIdx) => {
      const s = snapshots[yearIdx];
      if (!s) return;

      if (yearIdx === 0) {
        sliderLabel.textContent = "Aujourd'hui";
        if (projKpis) projKpis.style.display = 'none';
      } else {
        sliderLabel.textContent = `Fin ${s.calendarYear} (+${yearIdx} an${yearIdx > 1 ? 's' : ''})`;
        if (projKpis) projKpis.style.display = '';
      }
      sliderAge.textContent = `${s.age} ans`;

      // Update succession tax blocks based on projected patrimoine
      if (nbEnfants > 0) {
        if (yearIdx === 0) {
          // Reset to original values
          if (origSansAmount) origSansAmount.textContent = origSansText;
          if (origSansDetail) origSansDetail.textContent = origSansDetailText;
          if (origAvecAmount) origAvecAmount.textContent = origAvecText;
          if (origAvecDetail) origAvecDetail.innerHTML = origAvecDetailHTML;
        } else {
          // Compute projected patrimoine breakdown
          const projAV = projGroupKeys.filter(k => k === 'Assurance Vie').reduce((sum, k) => sum + (s.placementDetail[k] || 0), 0);
          const projPatrimoineHorsAV = s.patrimoineNet - projAV;
          const projAge = s.age;

          // Sans optimisation: succession on full projected patrimoine
          const projSuccSans = calculerSuccessionParEnfant(projPatrimoineHorsAV, nbEnfants, projAV / nbEnfants);
          const projTotalDroitsSans = (projSuccSans.droits + projSuccSans.avDroits) * nbEnfants;

          if (origSansAmount) origSansAmount.textContent = formatCurrency(projTotalDroitsSans);
          if (origSansDetail) origSansDetail.textContent = `${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} — abattement ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} chacun`;

          // Avec strategie: consider donations planned up to projected year
          const cfg = getConfig(store);
          const projDonations = (cfg.donations || []).filter(d => d.annee <= s.calendarYear);
          let projTotalDroitsDonation = 0;
          let projTotalDonne = 0;
          for (const enf of enfants) {
            const dons = projDonations.filter(d => d.enfantId === enf.id).sort((a, b) => a.annee - b.annee);
            const results = simulerDonations(enf, dons, ageDonateur);
            projTotalDonne += results.reduce((sum, r) => sum + r.exonere + r.taxable, 0);
            projTotalDroitsDonation += results.reduce((sum, r) => sum + r.droits, 0);
          }

          const projResiduelHorsAV = Math.max(0, projPatrimoineHorsAV - projTotalDonne);
          const projSuccAvec = calculerSuccessionParEnfant(projResiduelHorsAV, nbEnfants, projAV / nbEnfants);
          const projTotalDroitsResiduelle = (projSuccAvec.droits + projSuccAvec.avDroits) * nbEnfants;
          const projTotalFiscaliteAvec = projTotalDroitsDonation + projTotalDroitsResiduelle;
          const projEconomie = projTotalDroitsSans - projTotalFiscaliteAvec;
          const projEconomiePct = projTotalDroitsSans > 0 ? (projEconomie / projTotalDroitsSans * 100).toFixed(0) : 0;

          if (origAvecAmount) origAvecAmount.textContent = formatCurrency(projTotalFiscaliteAvec);
          if (origAvecDetail) {
            if (projEconomie > 0) {
              origAvecDetail.innerHTML = `
              <div class="mt-2 flex items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                  ${formatCurrency(projEconomie)} economies
                </span>
                <span class="text-xs text-gray-500">(${projEconomiePct}% de reduction)</span>
              </div>`;
            } else {
              origAvecDetail.innerHTML = `<p class="text-xs text-gray-500 mt-1">Ajoute des donations pour reduire les droits</p>`;
            }
          }
        }
      }

      if (yearIdx === 0) return;

      const first = snapshots[0];
      // Compute AV and hors-AV from projection groups
      const avValue = projGroupKeys.filter(k => k === 'Assurance Vie').reduce((sum, k) => sum + (s.placementDetail[k] || 0), 0);
      const placHorsAV = s.placements - avValue;
      const firstAV = projGroupKeys.filter(k => k === 'Assurance Vie').reduce((sum, k) => sum + (first.placementDetail[k] || 0), 0);
      const firstPlacHorsAV = first.placements - firstAV;

      const updateKpi = (id, value, deltaId, baseValue) => {
        const el = document.getElementById(id);
        const deltaEl = document.getElementById(deltaId);
        if (el) el.textContent = formatCurrency(value);
        if (deltaEl) {
          const delta = value - baseValue;
          const sign = delta >= 0 ? '+' : '';
          deltaEl.textContent = `${sign}${formatCurrency(delta)}`;
          deltaEl.className = `text-[10px] ${delta >= 0 ? 'text-emerald-500' : 'text-red-400'}`;
        }
      };

      updateKpi('fisc-proj-immo', s.immobilier, 'fisc-proj-immo-delta', first.immobilier);
      updateKpi('fisc-proj-plac', placHorsAV, 'fisc-proj-plac-delta', firstPlacHorsAV);
      updateKpi('fisc-proj-av', avValue, 'fisc-proj-av-delta', firstAV);
      updateKpi('fisc-proj-epar', s.epargne, 'fisc-proj-epar-delta', first.epargne);
      updateKpi('fisc-proj-net', s.patrimoineNet, 'fisc-proj-net-delta', first.patrimoineNet);
    };

    slider.addEventListener('input', (e) => updateSlider(parseInt(e.target.value)));
  }

  // --- Timeline generation ---
  const timelineContainer = document.getElementById('fisc-timeline');
  if (timelineContainer && snapshots.length > 0) {
    const events = [];
    let avDonationTriggered = false;
    let peaCeilingTriggered = false;
    let millionTriggered = false;
    let halfMillionTriggered = false;
    let twoMillionTriggered = false;
    let debtFreeTriggered = false;
    let fireTriggered = false;

    // PEA 5-year milestone
    const peaPlacements = (store.getAll().actifs.placements || []).filter(p => (p.enveloppe || '').startsWith('PEA'));
    const peaDates = peaPlacements.map(p => p.dateOuverture).filter(Boolean).map(d => new Date(d));
    const earliestPEA = peaDates.length > 0 ? new Date(Math.min(...peaDates)) : null;
    if (earliestPEA) {
      const pea5Year = earliestPEA.getFullYear() + 5;
      const projMax = currentYear + (params.projectionYears || 30);
      if (pea5Year >= currentYear && pea5Year <= projMax) {
        events.push({ year: pea5Year, age: ageDonateur + (pea5Year - currentYear), type: 'fiscal', icon: 'shield', color: 'emerald',
          title: 'PEA : fiscalite avantageuse',
          desc: `Ton PEA aura 5 ans. Les retraits seront soumis uniquement aux prelevements sociaux (17.2% au lieu de 31.4%). Conserve-le absolument, ne le casse pas.`
        });
      }
    }

    // AV 8-year milestone
    const avPlacements = (store.getAll().actifs.placements || []).filter(p => (p.enveloppe || '') === 'AV');
    const avDates = avPlacements.map(p => p.dateOuverture).filter(Boolean).map(d => new Date(d));
    const earliestAV = avDates.length > 0 ? new Date(Math.min(...avDates)) : null;
    if (earliestAV) {
      const av8Year = earliestAV.getFullYear() + 8;
      const projMax = currentYear + (params.projectionYears || 30);
      if (av8Year >= currentYear && av8Year <= projMax) {
        events.push({ year: av8Year, age: ageDonateur + (av8Year - currentYear), type: 'fiscal', icon: 'clock', color: 'amber',
          title: 'Assurance Vie : maturite fiscale',
          desc: `Ton AV aura 8 ans. Tu beneficies d'un abattement annuel de 4 600 EUR sur les gains et d'une fiscalite reduite (24.7% vs 31.4%).`
        });
      }
    }

    // Abattement renewal reminder (every 15 years from first donation)
    if (donations.length > 0) {
      const firstDonYear = Math.min(...donations.map(d => d.annee));
      const renewalYear = firstDonYear + RENOUVELLEMENT_ANNEES;
      const projMax = currentYear + (params.projectionYears || 30);
      if (renewalYear <= projMax) {
        events.push({ year: renewalYear, age: ageDonateur + (renewalYear - currentYear), type: 'donation', icon: 'gift', color: 'pink',
          title: 'Renouvellement des abattements',
          desc: `Les abattements de 100 000 EUR par enfant se renouvellent. Tu peux planifier un nouveau cycle de donations en franchise de droits. ${nbEnfants > 0 ? `Soit ${formatCurrency(ABATTEMENT_PARENT_ENFANT * nbEnfants)} au total pour tes ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''}.` : ''}`
        });
      }
    }

    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];
      const prevS = i > 0 ? snapshots[i - 1] : null;

      // AV reaching 300K -> donation
      const avTotal = projGroupKeys.filter(k => k === 'Assurance Vie').reduce((sum, k) => sum + (s.placementDetail[k] || 0), 0);
      if (!avDonationTriggered && avTotal >= 300000) {
        avDonationTriggered = true;
        events.push({ year: s.calendarYear, age: s.age, type: 'donation', icon: 'gift', color: 'purple',
          title: 'Donation via Assurance Vie',
          desc: `L'AV atteint ${formatCurrency(avTotal)}. C'est le moment d'envisager des donations aux enfants : 150 000 EUR par enfant via le cadre fiscal avantageux de l'AV (abattement de 152 500 EUR par beneficiaire sur les capitaux deces). Pense a mettre a jour les clauses beneficiaires.`,
          montant: 300000
        });
      }

      // PEA ceiling
      if (!peaCeilingTriggered) {
        const peaApports = projGroupKeys.filter(k => k.startsWith('PEA')).reduce((sum, k) => sum + (s.placementApports[k] || 0), 0);
        if (peaApports >= 145000) {
          peaCeilingTriggered = true;
          const peaValue = projGroupKeys.filter(k => k.startsWith('PEA')).reduce((sum, k) => sum + (s.placementDetail[k] || 0), 0);
          events.push({ year: s.calendarYear, age: s.age, type: 'strategie', icon: 'flag', color: 'blue',
            title: 'Plafond PEA atteint',
            desc: `Tes apports PEA approchent le plafond de 150 000 EUR (valeur : ${formatCurrency(peaValue)}). Ne casse surtout pas ton PEA, ses gains continueront de composer en franchise d'impot. Les versements seront rediriges automatiquement.`
          });
        }
      }

      // Patrimoine milestones
      if (!halfMillionTriggered && s.patrimoineNet >= 500000) {
        halfMillionTriggered = true;
        events.push({ year: s.calendarYear, age: s.age, type: 'cap', icon: 'star', color: 'amber',
          title: 'Cap des 500 000 EUR',
          desc: `Patrimoine net de ${formatCurrency(s.patrimoineNet)}. Les interets composes accelerent. Verifie ton allocation cible et pense a diversifier.`
        });
      }
      if (!millionTriggered && s.patrimoineNet >= 1000000) {
        millionTriggered = true;
        events.push({ year: s.calendarYear, age: s.age, type: 'cap', icon: 'star', color: 'amber',
          title: 'Millionnaire !',
          desc: `Patrimoine net de ${formatCurrency(s.patrimoineNet)}. Consulte un CGP pour optimiser ta fiscalite et anticiper la transmission. Envisage des donations anticipees (abattement 100 000 EUR/enfant renouvelable tous les 15 ans).`
        });
      }
      if (!twoMillionTriggered && s.patrimoineNet >= 2000000) {
        twoMillionTriggered = true;
        events.push({ year: s.calendarYear, age: s.age, type: 'cap', icon: 'star', color: 'purple',
          title: 'Cap des 2 000 000 EUR',
          desc: `Attention a l'IFI si ta part immobiliere depasse 1.3M EUR net. Planifie des donations en nue-propriete pour reduire la base taxable tout en conservant l'usufruit.`
        });
      }

      // Debt-free
      if (!debtFreeTriggered && prevS && prevS.totalDette > 0 && s.totalDette <= 0) {
        debtFreeTriggered = true;
        events.push({ year: s.calendarYear, age: s.age, type: 'cap', icon: 'check', color: 'emerald',
          title: 'Plus aucune dette !',
          desc: `Tous tes emprunts sont rembourses. Ta capacite d'epargne augmente de ${formatCurrency(prevS.mensualites)}/mois. Redirige ce montant vers tes placements.`
        });
      }

      // FIRE
      if (!fireTriggered && s.depensesMensuelles > 0) {
        const depAn = s.depensesMensuelles * 12;
        if (s.totalLiquiditesNettes >= depAn * 25) {
          fireTriggered = true;
          events.push({ year: s.calendarYear, age: s.age, type: 'strategie', icon: 'fire', color: 'orange',
            title: 'Independance financiere (FIRE)',
            desc: `Tes liquidites nettes (${formatCurrency(s.totalLiquiditesNettes)}) representent 25x tes depenses annuelles. En theorie, tu pourrais vivre de tes placements avec la regle des 4%.`
          });
        }
      }

      // Retirement
      if (s.isRetraite) {
        events.push({ year: s.calendarYear, age: s.age, type: 'retraite', icon: 'sun', color: 'cyan',
          title: 'Depart a la retraite',
          desc: `Patrimoine net projete : ${formatCurrency(s.patrimoineNet)}, dont ${formatCurrency(s.totalLiquiditesNettes)} en liquidites nettes apres impots.`
        });
      }
    }

    events.sort((a, b) => a.year - b.year);

    const iconSvgs = {
      gift: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a4 4 0 00-4-4 4 4 0 014 4zm0 0V6a4 4 0 014-4 4 4 0 01-4 4zM5 8h14M5 8a2 2 0 00-2 2v1h18v-1a2 2 0 00-2-2M3 11v5a2 2 0 002 2h14a2 2 0 002-2v-5"/></svg>',
      flag: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z"/></svg>',
      star: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>',
      check: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
      shield: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
      clock: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      sun: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>',
      fire: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/></svg>'
    };

    const colorClasses = {
      purple: { dot: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
      blue: { dot: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
      amber: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
      emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
      cyan: { dot: 'bg-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
      orange: { dot: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
      pink: { dot: 'bg-pink-500', bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
    };

    let html = '';
    events.forEach((evt) => {
      const cc = colorClasses[evt.color] || colorClasses.blue;
      const icon = iconSvgs[evt.icon] || iconSvgs.star;
      html += `
        <div class="relative mb-5 last:mb-0">
          <div class="absolute -left-[18px] top-1 w-5 h-5 rounded-full ${cc.dot} flex items-center justify-center text-white shadow-lg">
            ${icon}
          </div>
          <div class="${cc.bg} border ${cc.border} rounded-lg p-4 ml-2">
            <div class="flex items-center gap-2 mb-1">
              <span class="${cc.text} font-bold text-sm">${evt.year}</span>
              <span class="text-gray-500 text-xs">${evt.age} ans</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded ${cc.bg} ${cc.text} font-medium uppercase tracking-wider">${evt.type}</span>
            </div>
            <h4 class="text-gray-200 font-semibold text-sm mb-1">${evt.title}</h4>
            <p class="text-gray-400 text-xs leading-relaxed">${evt.desc}</p>
          </div>
        </div>`;
    });

    timelineContainer.innerHTML = html || '<p class="text-gray-500 text-sm">Ajoute des placements et des parametres de projection pour voir les conseils personnalises.</p>';
  }

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

function openDonationModal(store, refresh, enfants, editDon = null, preselectedEnfantId = null) {
  const currentYear = new Date().getFullYear();
  const title = editDon ? 'Modifier la donation' : 'Planifier une donation';

  const enfantOptions = enfants.map(e => ({ value: e.id, label: e.prenom || 'Sans nom' }));
  const typeOptions = DONATION_TYPES;
  const selectedEnfantId = editDon?.enfantId || preselectedEnfantId || enfants[0]?.id || '';

  const body = `
    ${selectField('enfantId', 'Enfant', enfantOptions, selectedEnfantId)}
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
