import { formatCurrency, openModal, inputField, selectField, getFormData } from '../utils.js?v=5';
import { createChart, COLORS, VIVID_PALETTE } from '../charts/chart-config.js';

// ============================================================================
// FISCALITÉ FRANÇAISE DES DONATIONS — Barèmes et constantes
// ============================================================================

const ABATTEMENT_PARENT_ENFANT = 100000;
const RENOUVELLEMENT_ANNEES = 15;
const DON_FAMILIAL_TEPA = 31865;
const AGE_MAX_DONATEUR_TEPA = 80;

// Barème des droits de donation en ligne directe (art. 777 CGI)
const TRANCHES_DONATION = [
  { min: 0,       max: 8072,    taux: 0.05 },
  { min: 8072,    max: 12109,   taux: 0.10 },
  { min: 12109,   max: 15932,   taux: 0.15 },
  { min: 15932,   max: 552324,  taux: 0.20 },
  { min: 552324,  max: 902838,  taux: 0.30 },
  { min: 902838,  max: 1805677, taux: 0.40 },
  { min: 1805677, max: Infinity, taux: 0.45 }
];

// Barème fiscal du démembrement (art. 669 CGI)
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

// Assurance-vie (art. 990 I CGI — primes avant 70 ans)
const AV_ABATTEMENT_PAR_BENEFICIAIRE = 152500;
const AV_TAUX_1 = 0.20;
const AV_SEUIL_1 = 700000;
const AV_TAUX_2 = 0.3125;
const AV_ABATTEMENT_APRES_70 = 30500;

// ============================================================================
// FONCTIONS DE CALCUL
// ============================================================================

function getUsufruitRate(age) {
  for (const t of BAREME_USUFRUIT) {
    if (age <= t.ageMax) return t;
  }
  return BAREME_USUFRUIT[BAREME_USUFRUIT.length - 1];
}

function calculerDroitsDonation(montantTaxable) {
  if (montantTaxable <= 0) return 0;
  let droits = 0;
  for (const t of TRANCHES_DONATION) {
    if (montantTaxable <= t.min) break;
    droits += (Math.min(montantTaxable, t.max) - t.min) * t.taux;
  }
  return Math.round(droits);
}

function detailTranches(montantTaxable) {
  if (montantTaxable <= 0) return [];
  const details = [];
  for (const t of TRANCHES_DONATION) {
    if (montantTaxable <= t.min) break;
    const base = Math.min(montantTaxable, t.max) - t.min;
    details.push({ min: t.min, max: Math.min(montantTaxable, t.max), taux: t.taux, base, droits: Math.round(base * t.taux) });
  }
  return details;
}

// Calcul succession : part de chaque enfant après abattement + barème
function calculerSuccessionParEnfant(patrimoineNet, nbEnfants, avParEnfant) {
  if (nbEnfants === 0) return { partBrute: 0, abattement: 0, taxable: 0, droits: 0, avDroits: 0, partNette: 0 };

  // Hors AV : réparti en parts égales
  const partBrute = patrimoineNet / nbEnfants;
  const abattement = ABATTEMENT_PARENT_ENFANT;
  const taxable = Math.max(0, partBrute - abattement);
  const droits = calculerDroitsDonation(taxable);

  // AV : abattement spécifique 152 500 € par bénéficiaire (primes avant 70 ans)
  const avTaxable = Math.max(0, avParEnfant - AV_ABATTEMENT_PAR_BENEFICIAIRE);
  const avTranche1 = Math.min(avTaxable, AV_SEUIL_1);
  const avTranche2 = Math.max(0, avTaxable - AV_SEUIL_1);
  const avDroits = Math.round(avTranche1 * AV_TAUX_1 + avTranche2 * AV_TAUX_2);

  const partNette = partBrute + avParEnfant - droits - avDroits;
  return { partBrute, abattement, taxable, droits, avParEnfant, avDroits, partNette, tranches: detailTranches(taxable) };
}

// Calcul de l'impact d'une donation sur l'abattement restant
function simulerDonations(enfant, donations, ageDonateur) {
  const currentYear = new Date().getFullYear();
  // Track abattement usage over rolling 15-year windows
  let abattementUtilise = 0;
  let tepaUtilise = 0;
  const results = [];

  for (const don of donations) {
    const yearsSinceFirst = don.annee - (donations[0]?.annee || currentYear);
    // Check if 15 years passed → abattement resets
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
      // TEPA first if applicable
      if (don.type === 'don_tepa' && ageDon < AGE_MAX_DONATEUR_TEPA) {
        const tepaDisponible = DON_FAMILIAL_TEPA - tepaUtilise;
        const tepaUse = Math.min(montantRestant, tepaDisponible);
        tepaUtilise += tepaUse;
        exonere += tepaUse;
        montantRestant -= tepaUse;
        detail = `TEPA: ${formatCurrency(tepaUse)} exonéré`;
      }
      // Abattement classique
      const abattDisponible = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
      const abattUse = Math.min(montantRestant, abattDisponible);
      abattementUtilise += abattUse;
      exonere += abattUse;
      montantRestant -= abattUse;
      if (abattUse > 0) detail += (detail ? ' + ' : '') + `Abatt.: ${formatCurrency(abattUse)}`;

      taxable = montantRestant;
      droits = calculerDroitsDonation(taxable);

    } else if (don.type === 'donation_nue_propriete') {
      // Nue-propriété : taxe uniquement sur la valeur de la nue-propriété
      const rate = getUsufruitRate(ageDon);
      const valeurNP = Math.round(don.montant * rate.nuePropriete);
      detail = `Nue-prop. ${(rate.nuePropriete * 100).toFixed(0)}% = ${formatCurrency(valeurNP)} (usufruit conservé)`;
      montantRestant = valeurNP;

      const abattDisponible = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
      const abattUse = Math.min(montantRestant, abattDisponible);
      abattementUtilise += abattUse;
      exonere += abattUse;
      montantRestant -= abattUse;

      taxable = montantRestant;
      droits = calculerDroitsDonation(taxable);

    } else if (don.type === 'donation_cto') {
      // CTO : donation des titres → purge des plus-values
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
// LECTURE DU PATRIMOINE DEPUIS LE STORE
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
  // Pour la succession : l'AV est hors succession, calculée séparément
  const patrimoineHorsAV = patrimoineNet - assuranceVie;

  return { immobilier, placements, cto, assuranceVie, epargne, comptesCourants, emprunts, totalActifs, patrimoineNet, patrimoineHorsAV };
}

// ============================================================================
// CONFIG ENFANTS & DONATIONS (persisté dans le store)
// ============================================================================

function getConfig(store) {
  return store.get('donationConfig') || {
    enfants: [],
    donations: [] // { id, enfantId, type, montant, annee, label }
  };
}

function saveConfig(store, cfg) {
  store.set('donationConfig', cfg);
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
  const nbEnfants = enfants.length;

  // === CALCUL SUCCESSION SANS DONATION ===
  const succSansdon = nbEnfants > 0
    ? calculerSuccessionParEnfant(patrimoine.patrimoineHorsAV, nbEnfants, patrimoine.assuranceVie / nbEnfants)
    : null;
  const totalDroitsSansdon = succSansdon ? (succSansdon.droits + succSansdon.avDroits) * nbEnfants : 0;

  // === CALCUL AVEC DONATIONS ===
  let totalDonneParEnfant = {};
  let totalDroitsDonation = 0;
  let donationsParEnfant = {};

  for (const enf of enfants) {
    const dons = (cfg.donations || [])
      .filter(d => d.enfantId === enf.id)
      .sort((a, b) => a.annee - b.annee);
    const results = simulerDonations(enf, dons, ageDonateur);
    donationsParEnfant[enf.id] = results;
    totalDonneParEnfant[enf.id] = results.reduce((s, r) => s + r.exonere + r.taxable, 0);
    totalDroitsDonation += results.reduce((s, r) => s + r.droits, 0);
  }

  // Succession résiduelle (patrimoine diminué des donations)
  const totalDonne = Object.values(totalDonneParEnfant).reduce((s, v) => s + v, 0);
  const patrimoineResiduelHorsAV = Math.max(0, patrimoine.patrimoineHorsAV - totalDonne);
  const succAvecdon = nbEnfants > 0
    ? calculerSuccessionParEnfant(patrimoineResiduelHorsAV, nbEnfants, patrimoine.assuranceVie / nbEnfants)
    : null;
  const totalDroitsSuccResiduelle = succAvecdon ? (succAvecdon.droits + succAvecdon.avDroits) * nbEnfants : 0;
  const totalFiscaliteAvecdon = totalDroitsDonation + totalDroitsSuccResiduelle;
  const economie = totalDroitsSansdon - totalFiscaliteAvecdon;

  // === TYPES DE DONATION ===
  const typeDonOptions = [
    { value: 'don_manuel', label: 'Don manuel (argent)' },
    { value: 'don_tepa', label: 'Don familial TEPA (argent, < 80 ans)' },
    { value: 'donation_nue_propriete', label: 'Donation nue-propriété (immobilier)' },
    { value: 'donation_cto', label: 'Donation CTO (titres, purge PV)' },
  ];

  return `
    <div class="max-w-6xl mx-auto space-y-6">

      <!-- TITRE -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-100">Simulateur de donations</h1>
          <p class="text-sm text-gray-400 mt-1">Planifiez vos donations pour optimiser la transmission à vos enfants</p>
        </div>
      </div>

      <!-- ROW 1 : PATRIMOINE + ENFANTS -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <!-- PATRIMOINE (lecture depuis le store) -->
        <div class="card-dark rounded-xl p-5">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-lg bg-accent-blue/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
              </svg>
            </div>
            <h2 class="text-sm font-bold text-gray-200">Votre patrimoine</h2>
            <span class="ml-auto text-lg font-bold text-accent-green">${formatCurrency(patrimoine.patrimoineNet)}</span>
          </div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between text-gray-300">
              <span>Immobilier</span><span class="font-medium">${formatCurrency(patrimoine.immobilier)}</span>
            </div>
            <div class="flex justify-between text-gray-300">
              <span>Placements (hors AV)</span><span class="font-medium">${formatCurrency(patrimoine.placements)}</span>
            </div>
            ${patrimoine.cto > 0 ? `<div class="flex justify-between text-gray-400 text-xs pl-3">
              <span>dont CTO</span><span>${formatCurrency(patrimoine.cto)}</span>
            </div>` : ''}
            <div class="flex justify-between text-gray-300">
              <span>Assurance-vie</span><span class="font-medium">${formatCurrency(patrimoine.assuranceVie)}</span>
            </div>
            <div class="flex justify-between text-gray-300">
              <span>Épargne</span><span class="font-medium">${formatCurrency(patrimoine.epargne)}</span>
            </div>
            <div class="flex justify-between text-gray-300">
              <span>Comptes courants</span><span class="font-medium">${formatCurrency(patrimoine.comptesCourants)}</span>
            </div>
            ${patrimoine.emprunts > 0 ? `
            <div class="border-t border-dark-400/20 pt-2 flex justify-between text-accent-red">
              <span>Emprunts</span><span class="font-medium">-${formatCurrency(patrimoine.emprunts)}</span>
            </div>` : ''}
            <div class="border-t border-dark-400/20 pt-2">
              <div class="flex justify-between text-gray-400 text-xs">
                <span>Hors AV (soumis aux droits de succession)</span>
                <span class="font-medium">${formatCurrency(patrimoine.patrimoineHorsAV)}</span>
              </div>
              <div class="flex justify-between text-gray-400 text-xs mt-1">
                <span>AV (fiscalité spécifique art. 990 I)</span>
                <span class="font-medium">${formatCurrency(patrimoine.assuranceVie)}</span>
              </div>
            </div>
          </div>
          <div class="mt-3 px-3 py-2 rounded-lg bg-dark-800/50 text-xs text-gray-400">
            <span class="text-gray-300 font-medium">Votre âge :</span> ${ageDonateur} ans (${currentYear})
          </div>
        </div>

        <!-- ENFANTS -->
        <div class="card-dark rounded-xl p-5">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-lg bg-accent-purple/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <h2 class="text-sm font-bold text-gray-200">Vos enfants</h2>
            <button id="btn-add-enfant" class="ml-auto px-3 py-1 bg-accent-purple text-dark-900 text-xs font-bold rounded-lg hover:opacity-90 transition">+ Ajouter</button>
          </div>
          ${enfants.length === 0 ? `
            <div class="text-center py-8 text-gray-500">
              <p class="text-sm">Ajoutez vos enfants pour lancer la simulation</p>
            </div>
          ` : `
            <div class="space-y-2">
              ${enfants.map((enf, i) => {
                const age = enf.dateNaissance ? Math.floor((Date.now() - new Date(enf.dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000)) : '?';
                const nbDons = (cfg.donations || []).filter(d => d.enfantId === enf.id).length;
                return `
                <div class="flex items-center gap-3 bg-dark-800/40 rounded-lg px-3 py-2 group">
                  <div class="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center text-sm font-bold text-gray-300">${(enf.prenom || '?')[0].toUpperCase()}</div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-200 truncate">${enf.prenom || 'Sans nom'}</p>
                    <p class="text-xs text-gray-500">${age} ans${enf.dateNaissance ? ` · né(e) le ${new Date(enf.dateNaissance).toLocaleDateString('fr-FR')}` : ''} · ${nbDons} donation${nbDons > 1 ? 's' : ''}</p>
                  </div>
                  <button class="enfant-edit text-accent-blue/70 hover:text-accent-blue text-xs opacity-0 group-hover:opacity-100 transition" data-id="${enf.id}">Modifier</button>
                  <button class="enfant-delete text-accent-red/50 hover:text-accent-red text-xs opacity-0 group-hover:opacity-100 transition" data-id="${enf.id}">✕</button>
                </div>`;
              }).join('')}
            </div>
          `}
        </div>
      </div>

      ${nbEnfants === 0 ? '' : `
      <!-- ROW 2 : COMPARATIF KPI -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Sans donation -->
        <div class="card-dark rounded-xl p-5 border border-accent-red/20">
          <p class="text-xs text-gray-400 mb-1 uppercase tracking-wide">Sans donation (succession seule)</p>
          <p class="text-2xl font-bold text-accent-red">${formatCurrency(totalDroitsSansdon)}</p>
          <p class="text-xs text-gray-500 mt-1">de droits à payer par vos ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''}</p>
          <div class="mt-3 text-xs text-gray-400 space-y-1">
            <div class="flex justify-between"><span>Part/enfant (hors AV)</span><span>${formatCurrency(succSansdon.partBrute)}</span></div>
            <div class="flex justify-between"><span>Abattement</span><span class="text-accent-green">-${formatCurrency(succSansdon.abattement)}</span></div>
            <div class="flex justify-between"><span>Taxable</span><span>${formatCurrency(succSansdon.taxable)}</span></div>
            <div class="flex justify-between"><span>Droits succession/enfant</span><span class="text-accent-red">${formatCurrency(succSansdon.droits)}</span></div>
            ${patrimoine.assuranceVie > 0 ? `
            <div class="border-t border-dark-400/15 pt-1 flex justify-between"><span>AV/enfant</span><span>${formatCurrency(succSansdon.avParEnfant)}</span></div>
            <div class="flex justify-between"><span>Droits AV/enfant</span><span class="text-accent-red">${formatCurrency(succSansdon.avDroits)}</span></div>
            ` : ''}
          </div>
        </div>

        <!-- Avec donations -->
        <div class="card-dark rounded-xl p-5 border border-accent-green/20">
          <p class="text-xs text-gray-400 mb-1 uppercase tracking-wide">Avec vos donations planifiées</p>
          <p class="text-2xl font-bold text-accent-green">${formatCurrency(totalFiscaliteAvecdon)}</p>
          <p class="text-xs text-gray-500 mt-1">total (droits donations + succession résiduelle)</p>
          <div class="mt-3 text-xs text-gray-400 space-y-1">
            <div class="flex justify-between"><span>Droits sur donations</span><span>${formatCurrency(totalDroitsDonation)}</span></div>
            <div class="flex justify-between"><span>Total donné</span><span>${formatCurrency(totalDonne)}</span></div>
            <div class="flex justify-between"><span>Patrimoine résiduel (hors AV)</span><span>${formatCurrency(patrimoineResiduelHorsAV)}</span></div>
            <div class="flex justify-between"><span>Droits succession résiduelle</span><span>${formatCurrency(totalDroitsSuccResiduelle)}</span></div>
          </div>
        </div>

        <!-- Économie -->
        <div class="card-dark rounded-xl p-5 border ${economie > 0 ? 'border-accent-cyan/30' : 'border-dark-400/20'}">
          <p class="text-xs text-gray-400 mb-1 uppercase tracking-wide">Économie réalisée</p>
          <p class="text-2xl font-bold ${economie > 0 ? 'text-accent-cyan' : 'text-gray-500'}">${economie > 0 ? '+' : ''}${formatCurrency(economie)}</p>
          <p class="text-xs text-gray-500 mt-1">${economie > 0 ? 'en moins de droits grâce aux donations' : 'ajoutez des donations pour voir l\'impact'}</p>
          ${totalDroitsSansdon > 0 ? `
          <div class="mt-3">
            <div class="flex items-center gap-2">
              <div class="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden">
                <div class="h-full bg-accent-cyan rounded-full transition-all" style="width: ${Math.min(100, Math.max(0, economie / totalDroitsSansdon * 100))}%"></div>
              </div>
              <span class="text-xs font-medium ${economie > 0 ? 'text-accent-cyan' : 'text-gray-500'}">${totalDroitsSansdon > 0 ? Math.round(economie / totalDroitsSansdon * 100) : 0}%</span>
            </div>
          </div>` : ''}
        </div>
      </div>

      <!-- ROW 3 : PLAN DE DONATION PAR ENFANT -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </div>
          <h2 class="text-sm font-bold text-gray-200">Plan de donations par enfant</h2>
          <button id="btn-add-donation" class="ml-auto px-3 py-1 bg-accent-green text-dark-900 text-xs font-bold rounded-lg hover:opacity-90 transition">+ Ajouter une donation</button>
        </div>

        ${enfants.map(enf => {
          const dons = donationsParEnfant[enf.id] || [];
          const totalDonneEnf = totalDonneParEnfant[enf.id] || 0;
          const totalDroitsEnf = dons.reduce((s, r) => s + r.droits, 0);
          const lastDon = dons[dons.length - 1];
          const abattRestant = lastDon ? lastDon.abattementRestant : ABATTEMENT_PARENT_ENFANT;
          const tepaRestant = lastDon ? lastDon.tepaRestant : DON_FAMILIAL_TEPA;

          return `
          <div class="mb-4 last:mb-0">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-6 h-6 rounded-full bg-dark-600 flex items-center justify-center text-xs font-bold text-gray-300">${(enf.prenom || '?')[0].toUpperCase()}</div>
              <span class="text-sm font-medium text-gray-200">${enf.prenom || 'Sans nom'}</span>
              <span class="text-xs text-gray-500">· Total donné : ${formatCurrency(totalDonneEnf)} · Droits : ${formatCurrency(totalDroitsEnf)}</span>
              <div class="ml-auto flex gap-3 text-xs">
                <span class="px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green/80">Abatt. restant : ${formatCurrency(abattRestant)}</span>
                <span class="px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue/80">TEPA restant : ${formatCurrency(tepaRestant)}</span>
              </div>
            </div>
            ${dons.length === 0 ? `
              <div class="text-xs text-gray-500 pl-8 py-2">Aucune donation planifiée</div>
            ` : `
              <div class="pl-8 space-y-1">
                ${dons.map((d, idx) => {
                  const originalIdx = (cfg.donations || []).findIndex(od => od.id === d.id);
                  return `
                  <div class="flex items-center gap-2 text-xs bg-dark-800/30 rounded-lg px-3 py-2 group border border-dark-400/10 hover:border-dark-400/30 transition">
                    <span class="text-gray-500 w-10">${d.annee}</span>
                    <span class="text-gray-300 font-medium">${formatCurrency(d.montant)}</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] ${
                      d.type === 'don_tepa' ? 'bg-accent-blue/10 text-accent-blue' :
                      d.type === 'donation_nue_propriete' ? 'bg-amber-500/10 text-amber-400' :
                      d.type === 'donation_cto' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-accent-green/10 text-accent-green'
                    }">${typeDonOptions.find(o => o.value === d.type)?.label || d.type}</span>
                    ${d.exonere > 0 ? `<span class="text-accent-green text-[10px]">${formatCurrency(d.exonere)} exonéré</span>` : ''}
                    ${d.droits > 0 ? `<span class="text-accent-red text-[10px]">${formatCurrency(d.droits)} droits</span>` : `<span class="text-accent-green text-[10px]">0 € droits</span>`}
                    <span class="text-gray-500 text-[10px] ml-auto hidden group-hover:inline">${d.detail}</span>
                    <button class="don-delete text-accent-red/40 hover:text-accent-red opacity-0 group-hover:opacity-100 transition" data-idx="${originalIdx}">✕</button>
                  </div>`;
                }).join('')}
              </div>
            `}
          </div>`;
        }).join('')}
      </div>

      <!-- ROW 4 : GRAPHIQUE TIMELINE -->
      <div class="card-dark rounded-xl p-5">
        <h2 class="text-sm font-bold text-gray-200 mb-3">Timeline des donations</h2>
        <div style="height: 300px">
          <canvas id="chart-donations"></canvas>
        </div>
      </div>

      <!-- ROW 5 : BARÈME USUFRUIT (référence) -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center gap-2 px-5 py-3 cursor-pointer select-none">
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          <span class="text-sm font-medium text-gray-300">Barème usufruit / nue-propriété (art. 669 CGI)</span>
        </summary>
        <div class="px-5 pb-4">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-gray-500 border-b border-dark-400/20">
                <th class="text-left py-1 font-medium">Âge de l'usufruitier</th>
                <th class="text-right py-1 font-medium">Usufruit</th>
                <th class="text-right py-1 font-medium">Nue-propriété</th>
              </tr>
            </thead>
            <tbody>
              ${BAREME_USUFRUIT.map(t => {
                const label = t.ageMax === Infinity ? '≥ 91 ans' : `≤ ${t.ageMax} ans`;
                const isCurrentRange = ageDonateur <= t.ageMax && (BAREME_USUFRUIT.indexOf(t) === 0 || ageDonateur > BAREME_USUFRUIT[BAREME_USUFRUIT.indexOf(t) - 1].ageMax);
                return `<tr class="${isCurrentRange ? 'text-accent-cyan font-medium' : 'text-gray-400'} border-b border-dark-400/10">
                  <td class="py-1">${label} ${isCurrentRange ? '← vous' : ''}</td>
                  <td class="text-right py-1">${(t.usufruit * 100).toFixed(0)}%</td>
                  <td class="text-right py-1">${(t.nuePropriete * 100).toFixed(0)}%</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </details>

      <!-- ROW 6 : BARÈME DROITS DONATION (référence) -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center gap-2 px-5 py-3 cursor-pointer select-none">
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          <span class="text-sm font-medium text-gray-300">Barème des droits de donation en ligne directe (art. 777 CGI)</span>
        </summary>
        <div class="px-5 pb-4">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-gray-500 border-b border-dark-400/20">
                <th class="text-left py-1 font-medium">Tranche (après abattement)</th>
                <th class="text-right py-1 font-medium">Taux</th>
              </tr>
            </thead>
            <tbody>
              ${TRANCHES_DONATION.map(t => `
                <tr class="text-gray-400 border-b border-dark-400/10">
                  <td class="py-1">${formatCurrency(t.min)} → ${t.max === Infinity ? '∞' : formatCurrency(t.max)}</td>
                  <td class="text-right py-1">${(t.taux * 100).toFixed(0)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="mt-2 text-xs text-gray-500 space-y-1">
            <p>Abattement parent → enfant : <span class="text-gray-300">${formatCurrency(ABATTEMENT_PARENT_ENFANT)}</span> (renouvelable tous les ${RENOUVELLEMENT_ANNEES} ans)</p>
            <p>Don familial TEPA (art. 790 G) : <span class="text-gray-300">${formatCurrency(DON_FAMILIAL_TEPA)}</span> supplémentaires (donateur < 80 ans)</p>
            <p>AV avant 70 ans (art. 990 I) : <span class="text-gray-300">${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}</span> d'abattement par bénéficiaire</p>
          </div>
        </div>
      </details>
      `}
    </div>
  `;
}

// ============================================================================
// MOUNT
// ============================================================================

export function mount(store, navigate) {
  const params = store.get('parametres') || {};
  const ageDonateur = params.ageFinAnnee || 43;
  const currentYear = new Date().getFullYear();
  const cfg = getConfig(store);
  const enfants = cfg.enfants || [];

  // --- Ajouter enfant ---
  document.getElementById('btn-add-enfant')?.addEventListener('click', () => {
    openModal('Ajouter un enfant', `
      ${inputField('prenom', 'Prénom', '', 'text')}
      ${inputField('dateNaissance', 'Date de naissance', '', 'date')}
    `, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.prenom) return;
      const c = getConfig(store);
      if (!c.enfants) c.enfants = [];
      c.enfants.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), prenom: data.prenom, dateNaissance: data.dateNaissance });
      saveConfig(store, c);
      navigate('fiscalite');
    });
  });

  // --- Modifier enfant ---
  document.querySelectorAll('.enfant-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const c = getConfig(store);
      const enf = (c.enfants || []).find(e => e.id === id);
      if (!enf) return;
      openModal('Modifier l\'enfant', `
        ${inputField('prenom', 'Prénom', enf.prenom || '', 'text')}
        ${inputField('dateNaissance', 'Date de naissance', enf.dateNaissance || '', 'date')}
      `, () => {
        const data = getFormData(document.getElementById('modal-body'));
        enf.prenom = data.prenom || enf.prenom;
        enf.dateNaissance = data.dateNaissance || enf.dateNaissance;
        saveConfig(store, c);
        navigate('fiscalite');
      });
    });
  });

  // --- Supprimer enfant ---
  document.querySelectorAll('.enfant-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const c = getConfig(store);
      c.enfants = (c.enfants || []).filter(e => e.id !== id);
      c.donations = (c.donations || []).filter(d => d.enfantId !== id);
      saveConfig(store, c);
      navigate('fiscalite');
    });
  });

  // --- Ajouter donation ---
  document.getElementById('btn-add-donation')?.addEventListener('click', () => {
    if (enfants.length === 0) return;
    const enfantOptions = enfants.map(e => ({ value: e.id, label: e.prenom || 'Sans nom' }));
    const typeOptions = [
      { value: 'don_manuel', label: 'Don manuel (argent)' },
      { value: 'don_tepa', label: 'Don familial TEPA (< 80 ans)' },
      { value: 'donation_nue_propriete', label: 'Nue-propriété (immobilier)' },
      { value: 'donation_cto', label: 'Donation CTO (titres)' },
    ];
    openModal('Ajouter une donation', `
      ${selectField('enfantId', 'Enfant', enfantOptions)}
      ${selectField('type', 'Type de donation', typeOptions)}
      ${inputField('montant', 'Montant (€)', '', 'number')}
      ${inputField('annee', 'Année', currentYear.toString(), 'number')}
    `, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.montant || !data.annee) return;
      const c = getConfig(store);
      if (!c.donations) c.donations = [];
      c.donations.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        enfantId: data.enfantId,
        type: data.type,
        montant: Number(data.montant),
        annee: Number(data.annee),
      });
      saveConfig(store, c);
      navigate('fiscalite');
    });
  });

  // --- Supprimer donation ---
  document.querySelectorAll('.don-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const c = getConfig(store);
      if (c.donations && c.donations[idx] !== undefined) {
        c.donations.splice(idx, 1);
        saveConfig(store, c);
        navigate('fiscalite');
      }
    });
  });

  // --- Chart timeline ---
  const canvas = document.getElementById('chart-donations');
  if (canvas && enfants.length > 0) {
    const allDonations = cfg.donations || [];
    if (allDonations.length > 0) {
      const years = [...new Set(allDonations.map(d => d.annee))].sort();
      const minYear = Math.min(...years, currentYear);
      const maxYear = Math.max(...years, currentYear + 5);
      const labels = [];
      for (let y = minYear; y <= maxYear; y++) labels.push(y.toString());

      const palette = [VIVID_PALETTE[0], VIVID_PALETTE[1], VIVID_PALETTE[2], VIVID_PALETTE[3], VIVID_PALETTE[4]];
      const datasets = enfants.map((enf, i) => {
        const data = labels.map(yearStr => {
          const y = parseInt(yearStr);
          return allDonations.filter(d => d.enfantId === enf.id && d.annee === y).reduce((s, d) => s + d.montant, 0);
        });
        return {
          label: enf.prenom || `Enfant ${i + 1}`,
          data,
          backgroundColor: palette[i % palette.length] + '80',
          borderColor: palette[i % palette.length],
          borderWidth: 1,
        };
      });

      createChart(canvas, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#9ca3af', font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
              }
            }
          },
          scales: {
            x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
            y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', callback: v => formatCurrency(v) } }
          }
        }
      });
    } else {
      canvas.parentElement.innerHTML = '<p class="text-center text-gray-500 text-sm py-12">Ajoutez des donations pour voir la timeline</p>';
    }
  }
}
