import { formatCurrency, openModal, inputField, selectField, getFormData } from '../utils.js?v=5';
import { createChart, COLORS, VIVID_PALETTE } from '../charts/chart-config.js';

// ============================================================================
// FISCALITÉ FRANÇAISE DES DONATIONS — Barèmes et constantes
// ============================================================================

// Abattement parent→enfant (art. 779 CGI) — renouvelable tous les 15 ans
const ABATTEMENT_PARENT_ENFANT = 100000;
const RENOUVELLEMENT_ANNEES = 15;

// Don familial de sommes d'argent (art. 790 G CGI, loi TEPA 2007)
// Conditions : donateur < 80 ans, donataire ≥ 18 ans, renouvelable tous les 15 ans
const DON_FAMILIAL_TEPA = 31865;
const AGE_MAX_DONATEUR_TEPA = 80;
const AGE_MIN_DONATAIRE_TEPA = 18;

// Don exceptionnel (Sarkozy 2020 prolongé) — don d'argent pour construction/rénovation/création entreprise
// 100 000 € exonérés sous conditions (temporaire, vérifie les dates)
// Non modélisé ici car temporaire

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

// Barème fiscal du démembrement (art. 669 CGI) — valeur de l'usufruit par tranche d'âge
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

// Assurance-vie — fiscalité au décès (art. 990 I CGI — primes versées avant 70 ans)
const AV_ABATTEMENT_PAR_BENEFICIAIRE = 152500;
const AV_TAUX_1 = 0.20; // Jusqu'à 700 000 € après abattement
const AV_SEUIL_1 = 700000;
const AV_TAUX_2 = 0.3125; // Au-delà

// Assurance-vie — primes versées après 70 ans (art. 757 B CGI)
const AV_ABATTEMENT_APRES_70 = 30500; // Abattement global (partagé entre bénéficiaires)

// ============================================================================
// FONCTIONS DE CALCUL
// ============================================================================

function getUsufruitRate(ageDonateur) {
  for (const tranche of BAREME_USUFRUIT) {
    if (ageDonateur <= tranche.ageMax) return tranche;
  }
  return BAREME_USUFRUIT[BAREME_USUFRUIT.length - 1];
}

function calculerDroitsDonation(montantTaxable) {
  if (montantTaxable <= 0) return 0;
  let droits = 0;
  for (const t of TRANCHES_DONATION) {
    if (montantTaxable <= t.min) break;
    const taxable = Math.min(montantTaxable, t.max) - t.min;
    droits += taxable * t.taux;
  }
  return Math.round(droits);
}

function calculerFiscaliteAV(capitalParBeneficiaire, primesAvant70, primesApres70, nbBeneficiaires) {
  let taxeAvant70 = 0;
  if (primesAvant70 > 0) {
    const partParBenef = primesAvant70 / nbBeneficiaires;
    const apresAbattement = Math.max(0, partParBenef - AV_ABATTEMENT_PAR_BENEFICIAIRE);
    const tranche1 = Math.min(apresAbattement, AV_SEUIL_1);
    const tranche2 = Math.max(0, apresAbattement - AV_SEUIL_1);
    taxeAvant70 = (tranche1 * AV_TAUX_1 + tranche2 * AV_TAUX_2) * nbBeneficiaires;
  }
  let taxeApres70 = 0;
  if (primesApres70 > 0) {
    const totalTaxable = Math.max(0, primesApres70 - AV_ABATTEMENT_APRES_70);
    taxeApres70 = calculerDroitsDonation(totalTaxable / nbBeneficiaires) * nbBeneficiaires;
  }
  return { taxeAvant70: Math.round(taxeAvant70), taxeApres70: Math.round(taxeApres70), total: Math.round(taxeAvant70 + taxeApres70) };
}

// Simuler un plan de donations échelonnées sur N années
function simulerPlanDonation(config) {
  const {
    ageDonateur,
    nbEnfants,
    patrimoine, // { immobilier, financier, cto, assuranceVie }
    donations,  // array of { type, montant, annee, enfantIdx }
    projectionYears,
    rendementPatrimoine,
  } = config;

  const currentYear = new Date().getFullYear();
  const snapshots = [];

  // Track per-child: abattement used, TEPA used, last donation year for renewal
  const enfantsState = Array.from({ length: nbEnfants }, () => ({
    abattementUtilise: 0,
    tepaUtilise: 0,
    lastAbattementYear: null,
    lastTepaYear: null,
    totalDonsRecus: 0,
    totalDroitsPaies: 0,
  }));

  let patrimoineRestant = { ...patrimoine };

  for (let year = 0; year <= projectionYears; year++) {
    const calYear = currentYear + year;
    const ageThisYear = ageDonateur + year;

    // Renew abattements if 15 years passed
    enfantsState.forEach(e => {
      if (e.lastAbattementYear && (calYear - e.lastAbattementYear) >= RENOUVELLEMENT_ANNEES) {
        e.abattementUtilise = 0;
        e.lastAbattementYear = null;
      }
      if (e.lastTepaYear && (calYear - e.lastTepaYear) >= RENOUVELLEMENT_ANNEES) {
        e.tepaUtilise = 0;
        e.lastTepaYear = null;
      }
    });

    // Process donations for this year
    const donationsThisYear = donations.filter(d => d.annee === calYear);
    let droitsThisYear = 0;
    let donsThisYear = 0;

    for (const don of donationsThisYear) {
      const enfantIdx = don.enfantIdx || 0;
      const enfant = enfantsState[Math.min(enfantIdx, nbEnfants - 1)];
      let montantDon = don.montant;
      let assietteTaxable = montantDon;

      // Démembrement: la donation porte sur la nue-propriété seulement
      if (don.type === 'demembrement') {
        const bareme = getUsufruitRate(ageThisYear);
        assietteTaxable = montantDon * bareme.nuePropriete;
      }

      // CTO: purge des plus-values (pas de taxe PV pour le donateur)
      // L'assiette = valeur des titres au jour de la donation (déjà dans montantDon)

      // Appliquer l'abattement parent→enfant
      const abattementRestant = ABATTEMENT_PARENT_ENFANT - enfant.abattementUtilise;
      let exonere = Math.min(assietteTaxable, Math.max(0, abattementRestant));
      if (exonere > 0) {
        enfant.abattementUtilise += exonere;
        if (!enfant.lastAbattementYear) enfant.lastAbattementYear = calYear;
        assietteTaxable -= exonere;
      }

      // Don TEPA (sommes d'argent uniquement, donateur < 80 ans)
      if ((don.type === 'argent' || don.type === 'tepa') && ageThisYear < AGE_MAX_DONATEUR_TEPA) {
        const tepaRestant = DON_FAMILIAL_TEPA - enfant.tepaUtilise;
        const exonereTepa = Math.min(assietteTaxable, Math.max(0, tepaRestant));
        if (exonereTepa > 0) {
          enfant.tepaUtilise += exonereTepa;
          if (!enfant.lastTepaYear) enfant.lastTepaYear = calYear;
          assietteTaxable -= exonereTepa;
        }
      }

      // Calcul des droits sur le montant taxable restant
      const droits = calculerDroitsDonation(assietteTaxable);
      enfant.totalDonsRecus += montantDon;
      enfant.totalDroitsPaies += droits;
      droitsThisYear += droits;
      donsThisYear += montantDon;

      // Déduire du patrimoine
      if (don.type === 'immobilier' || don.type === 'demembrement') {
        patrimoineRestant.immobilier = Math.max(0, (patrimoineRestant.immobilier || 0) - montantDon);
      } else if (don.type === 'cto') {
        patrimoineRestant.cto = Math.max(0, (patrimoineRestant.cto || 0) - montantDon);
      } else if (don.type === 'assurance_vie') {
        patrimoineRestant.assuranceVie = Math.max(0, (patrimoineRestant.assuranceVie || 0) - montantDon);
      } else {
        patrimoineRestant.financier = Math.max(0, (patrimoineRestant.financier || 0) - montantDon);
      }
    }

    // Growth du patrimoine restant
    const rend = rendementPatrimoine || 0.03;
    if (year > 0) {
      patrimoineRestant.immobilier = (patrimoineRestant.immobilier || 0) * (1 + 0.02);
      patrimoineRestant.financier = (patrimoineRestant.financier || 0) * (1 + rend);
      patrimoineRestant.cto = (patrimoineRestant.cto || 0) * (1 + rend);
      patrimoineRestant.assuranceVie = (patrimoineRestant.assuranceVie || 0) * (1 + rend);
    }

    const totalPatrimoine = (patrimoineRestant.immobilier || 0) + (patrimoineRestant.financier || 0) +
      (patrimoineRestant.cto || 0) + (patrimoineRestant.assuranceVie || 0);

    snapshots.push({
      annee: year,
      calYear,
      age: ageThisYear,
      patrimoine: Math.round(totalPatrimoine),
      immobilier: Math.round(patrimoineRestant.immobilier || 0),
      financier: Math.round(patrimoineRestant.financier || 0),
      cto: Math.round(patrimoineRestant.cto || 0),
      assuranceVie: Math.round(patrimoineRestant.assuranceVie || 0),
      donsThisYear: Math.round(donsThisYear),
      droitsThisYear: Math.round(droitsThisYear),
      enfants: enfantsState.map(e => ({ ...e })),
    });
  }

  return snapshots;
}

// Generate an optimal donation strategy
function genererStrategieOptimale(ageDonateur, nbEnfants, patrimoine, projectionYears) {
  const strategies = [];
  const currentYear = new Date().getFullYear();
  const bareme = getUsufruitRate(ageDonateur);

  // 1. Donation de nue-propriété immobilière (le plus tôt = le plus avantageux)
  if ((patrimoine.immobilier || 0) > 0) {
    strategies.push({
      titre: 'Donation de nue-propriété immobilière',
      description: `À ${ageDonateur} ans, la nue-propriété vaut ${Math.round(bareme.nuePropriete * 100)}% de la valeur du bien (usufruit retenu: ${Math.round(bareme.usufruit * 100)}%). Vous conservez l'usage et les revenus du bien. Au décès, l'enfant récupère la pleine propriété SANS droits supplémentaires.`,
      avantage: `L'assiette taxable est réduite de ${Math.round(bareme.usufruit * 100)}% par rapport à une donation en pleine propriété.`,
      montantOptimal: patrimoine.immobilier,
      economie: Math.round(patrimoine.immobilier * bareme.usufruit),
      type: 'demembrement',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3',
      color: 'accent-green'
    });
  }

  // 2. Abattement 100k€ par enfant (tous les 15 ans)
  const totalAbattement = ABATTEMENT_PARENT_ENFANT * nbEnfants;
  strategies.push({
    titre: `Abattement ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} × ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''}`,
    description: `Chaque parent peut donner ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} à chaque enfant tous les ${RENOUVELLEMENT_ANNEES} ans en franchise de droits. Si vous êtes en couple, c'est ${formatCurrency(ABATTEMENT_PARENT_ENFANT * 2)} par enfant.`,
    avantage: `Total exonéré (1 parent): ${formatCurrency(totalAbattement)}. En couple: ${formatCurrency(totalAbattement * 2)}.`,
    montantOptimal: totalAbattement,
    economie: calculerDroitsDonation(totalAbattement),
    type: 'argent',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'accent-amber'
  });

  // 3. Don TEPA (31 865€ supplémentaires par enfant)
  if (ageDonateur < AGE_MAX_DONATEUR_TEPA) {
    const totalTepa = DON_FAMILIAL_TEPA * nbEnfants;
    strategies.push({
      titre: `Don familial TEPA : ${formatCurrency(DON_FAMILIAL_TEPA)} × ${nbEnfants}`,
      description: `En plus de l'abattement classique, chaque parent peut donner ${formatCurrency(DON_FAMILIAL_TEPA)} en espèces à chaque enfant majeur, si le donateur a moins de ${AGE_MAX_DONATEUR_TEPA} ans. Renouvelable tous les ${RENOUVELLEMENT_ANNEES} ans.`,
      avantage: `Exonération supplémentaire: ${formatCurrency(totalTepa)}. Cumulable avec l'abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}.`,
      montantOptimal: totalTepa,
      economie: calculerDroitsDonation(totalTepa),
      type: 'tepa',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z',
      color: 'accent-cyan'
    });
  }

  // 4. Donation de titres CTO (purge des plus-values)
  if ((patrimoine.cto || 0) > 0) {
    strategies.push({
      titre: 'Donation de titres CTO — Purge des plus-values',
      description: `Donner des titres détenus en CTO permet de purger les plus-values latentes : le donataire reçoit les titres avec une valeur d'acquisition = valeur au jour de la donation. Aucune imposition de la PV pour le donateur.`,
      avantage: `Économie de flat tax (30%) sur les plus-values. Si PV latente de 50%, économie d'environ ${formatCurrency(Math.round((patrimoine.cto || 0) * 0.5 * 0.30))} de flat tax.`,
      montantOptimal: patrimoine.cto,
      economie: Math.round((patrimoine.cto || 0) * 0.5 * 0.30),
      type: 'cto',
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      color: 'accent-blue'
    });
  }

  // 5. Assurance-vie
  if ((patrimoine.assuranceVie || 0) > 0) {
    strategies.push({
      titre: 'Assurance-vie — Clause bénéficiaire optimisée',
      description: `L'assurance-vie bénéficie d'un abattement de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} par bénéficiaire pour les primes versées avant 70 ans (art. 990 I CGI). Au-delà : 20% jusqu'à ${formatCurrency(AV_SEUIL_1)}, puis 31,25%. Primes après 70 ans : abattement global de ${formatCurrency(AV_ABATTEMENT_APRES_70)} puis barème des successions.`,
      avantage: `Avec ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} bénéficiaires: ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE * nbEnfants)} exonérés (primes avant 70 ans). Hors succession civile.`,
      montantOptimal: patrimoine.assuranceVie,
      economie: Math.round(AV_ABATTEMENT_PAR_BENEFICIAIRE * nbEnfants * 0.20),
      type: 'assurance_vie',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      color: 'purple-400'
    });
  }

  // 6. Présent d'usage
  strategies.push({
    titre: 'Présents d\'usage (anniversaires, Noël...)',
    description: `Les cadeaux offerts à l'occasion d'événements familiaux (Noël, anniversaire, mariage, réussite d'examen...) ne sont pas taxables s'ils restent proportionnés à vos revenus et patrimoine. Pas de seuil fixe — la jurisprudence retient environ 2 à 2,5% du patrimoine ou du revenu annuel.`,
    avantage: `Non déclarable, non taxable, non rapportable à la succession. Ne consomme aucun abattement.`,
    montantOptimal: 0,
    economie: 0,
    type: 'usage',
    icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
    color: 'pink-400'
  });

  return strategies;
}

// ============================================================================
// RENDER
// ============================================================================

export function render(store) {
  const params = store.get('parametres') || {};
  const donationConfig = store.get('donationConfig') || {};
  const ageDonateur = donationConfig.ageDonateur || params.ageFinAnnee || 43;
  const nbEnfants = donationConfig.nbEnfants || 2;
  const projectionYears = donationConfig.projectionYears || 30;
  const rendement = donationConfig.rendementPatrimoine || 0.03;

  // Fetch patrimoine from store data
  const actifs = store.get('actifs') || {};
  const totalImmo = (actifs.immobilier || []).reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const totalCTO = (actifs.placements || []).filter(p => (p.enveloppe || '') === 'CTO' || (p.enveloppe || '') === 'Crypto').reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalAV = (actifs.placements || []).filter(p => (p.enveloppe || '') === 'AV').reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalFinancier = (actifs.epargne || []).reduce((s, i) => s + (Number(i.solde) || 0), 0) +
    (actifs.placements || []).filter(p => !['CTO', 'Crypto', 'AV'].includes(p.enveloppe || '')).reduce((s, p) => s + (Number(p.valeur) || 0), 0);

  const patrimoine = {
    immobilier: donationConfig.immobilier ?? totalImmo,
    financier: donationConfig.financier ?? totalFinancier,
    cto: donationConfig.cto ?? totalCTO,
    assuranceVie: donationConfig.assuranceVie ?? totalAV,
  };
  const totalPatrimoine = patrimoine.immobilier + patrimoine.financier + patrimoine.cto + patrimoine.assuranceVie;

  // Get strategies
  const strategies = genererStrategieOptimale(ageDonateur, nbEnfants, patrimoine, projectionYears);

  // Saved donation plan
  const donations = donationConfig.donations || [];

  // Simulate
  const snapshots = simulerPlanDonation({
    ageDonateur,
    nbEnfants,
    patrimoine: JSON.parse(JSON.stringify(patrimoine)),
    donations,
    projectionYears,
    rendementPatrimoine: rendement,
  });

  const lastSnap = snapshots[snapshots.length - 1];
  const totalDonsDonnés = donations.reduce((s, d) => s + (d.montant || 0), 0);
  const totalDroits = lastSnap?.enfants?.reduce((s, e) => s + e.totalDroitsPaies, 0) || 0;
  const tauxEffectif = totalDonsDonnés > 0 ? totalDroits / totalDonsDonnés : 0;

  // Barème usufruit for display
  const baremeActuel = getUsufruitRate(ageDonateur);

  // Compute scenario: sans donation (succession au décès)
  // Simplified: tout le patrimoine taxé au barème des successions avec abattement 100k/enfant
  const patrimoineAuDeces = totalPatrimoine * Math.pow(1 + rendement, projectionYears);
  const partParEnfant = patrimoineAuDeces / nbEnfants;
  const droitsSuccessionParEnfant = calculerDroitsDonation(Math.max(0, partParEnfant - ABATTEMENT_PARENT_ENFANT));
  const totalDroitsSuccession = droitsSuccessionParEnfant * nbEnfants;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-100">Fiscalité — Simulateur de donations</h1>
      <p class="text-sm text-gray-500">Optimisez la transmission de votre patrimoine à vos enfants en échelonnant les donations dans le temps.</p>

      <!-- Paramètres -->
      <details class="card-dark rounded-xl group" open>
        <summary class="flex items-center justify-between px-4 py-2 cursor-pointer select-none">
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Paramètres</h2>
          </div>
          <svg class="w-3.5 h-3.5 text-gray-600 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-4 pb-3 space-y-3">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            ${[
              ['don-age', 'Âge donateur', ageDonateur, '25', '95', '1', 'ans'],
              ['don-enfants', 'Enfants', nbEnfants, '1', '10', '1', ''],
              ['don-years', 'Horizon', projectionYears, '5', '50', '1', 'ans'],
              ['don-rendement', 'Rendement', (rendement * 100).toFixed(1), '0', '15', '0.5', '%'],
            ].map(([id, label, val, min, max, step, suffix]) => `
            <div class="flex items-center gap-1">
              <span class="text-xs text-gray-500">${label}</span>
              <input type="number" id="${id}" value="${val}" min="${min}" max="${max}" step="${step}"
                class="don-param w-14 px-1.5 py-1 text-sm bg-dark-800 border border-dark-400/30 rounded text-gray-300 focus:ring-1 focus:ring-accent-blue/30 text-center">
              ${suffix ? `<span class="text-xs text-gray-500">${suffix}</span>` : ''}
            </div>`).join('')}
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span class="text-xs text-gray-500 font-semibold">Patrimoine :</span>
            ${[
              ['don-immo', 'Immobilier', Math.round(patrimoine.immobilier)],
              ['don-financier', 'Financier', Math.round(patrimoine.financier)],
              ['don-cto', 'CTO/Crypto', Math.round(patrimoine.cto)],
              ['don-av', 'Assurance-vie', Math.round(patrimoine.assuranceVie)],
            ].map(([id, label, val]) => `
            <div class="flex items-center gap-1">
              <span class="text-xs text-gray-500">${label}</span>
              <input type="number" id="${id}" value="${val}" min="0" step="1000"
                class="don-param w-24 px-1.5 py-1 text-sm bg-dark-800 border border-dark-400/30 rounded text-gray-300 focus:ring-1 focus:ring-accent-blue/30 text-center">
              <span class="text-xs text-gray-500">€</span>
            </div>`).join('')}
            <span class="text-xs text-gray-400 font-semibold ml-2">Total: ${formatCurrency(totalPatrimoine)}</span>
          </div>
          <div class="flex justify-end">
            <button id="btn-update-donation" class="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 rounded hover:opacity-90 transition">
              Recalculer
            </button>
          </div>
        </div>
      </details>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Sans donation (succession)</p>
          <p class="text-2xl font-bold text-accent-red">${formatCurrency(totalDroitsSuccession)}</p>
          <p class="text-xs text-gray-500 mt-1">Droits estimés au décès (dans ${projectionYears} ans)</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <p class="text-sm text-gray-400 mb-2">Avec plan de donations</p>
          <p class="text-2xl font-bold text-accent-green">${formatCurrency(totalDroits)}</p>
          <p class="text-xs text-gray-500 mt-1">Droits sur ${formatCurrency(totalDonsDonnés)} de dons</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-blue">
          <p class="text-sm text-gray-400 mb-2">Économie</p>
          <p class="text-2xl font-bold gradient-text">${formatCurrency(Math.max(0, totalDroitsSuccession - totalDroits))}</p>
          <p class="text-xs text-gray-500 mt-1">Taux effectif: ${(tauxEffectif * 100).toFixed(1)}%</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Abattements disponibles</p>
          <p class="text-2xl font-bold text-gray-200">${formatCurrency((ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA) * nbEnfants)}</p>
          <p class="text-xs text-gray-500 mt-1">${formatCurrency(ABATTEMENT_PARENT_ENFANT)} + ${formatCurrency(DON_FAMILIAL_TEPA)} TEPA × ${nbEnfants}</p>
        </div>
      </div>

      <!-- Stratégies recommandées -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-200">Stratégies de donation optimales</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${strategies.map(s => `
          <div class="p-4 rounded-xl bg-dark-800/40 border border-dark-400/20 hover:border-${s.color}/40 transition space-y-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-${s.color}/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 text-${s.color}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${s.icon}"/></svg>
              </div>
              <h3 class="text-sm font-semibold text-gray-200">${s.titre}</h3>
            </div>
            <p class="text-xs text-gray-400 leading-relaxed">${s.description}</p>
            <p class="text-xs text-${s.color} font-medium">${s.avantage}</p>
            ${s.montantOptimal > 0 ? `<button class="strat-add-donation text-xs px-3 py-1.5 rounded-lg bg-${s.color}/15 text-${s.color} hover:bg-${s.color}/25 transition font-medium" data-type="${s.type}" data-montant="${s.montantOptimal}">+ Ajouter au plan</button>` : ''}
          </div>`).join('')}
        </div>
      </div>

      <!-- Barème usufruit -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-5 py-3 cursor-pointer select-none">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-semibold text-gray-200">Barème du démembrement (art. 669 CGI)</h2>
            <span class="text-xs px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green">Vous: ${ageDonateur} ans → NP = ${Math.round(baremeActuel.nuePropriete * 100)}%</span>
          </div>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-4">
          <table class="w-full text-sm">
            <thead class="text-gray-500 text-xs">
              <tr>
                <th class="text-left py-1.5">Âge de l'usufruitier</th>
                <th class="text-center py-1.5">Usufruit</th>
                <th class="text-center py-1.5">Nue-propriété</th>
                <th class="text-center py-1.5">Exemple sur ${formatCurrency(patrimoine.immobilier || 300000)}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${BAREME_USUFRUIT.map(b => {
                const isActive = ageDonateur <= b.ageMax && (b === BAREME_USUFRUIT[0] || ageDonateur > BAREME_USUFRUIT[BAREME_USUFRUIT.indexOf(b) - 1].ageMax);
                const immVal = patrimoine.immobilier || 300000;
                return `
              <tr class="${isActive ? 'bg-accent-green/10 font-semibold' : ''} text-gray-300">
                <td class="py-1.5 px-2">${b.ageMax === Infinity ? '91 ans et +' : `≤ ${b.ageMax} ans`} ${isActive ? '<span class="text-accent-green text-xs">← vous</span>' : ''}</td>
                <td class="py-1.5 text-center text-gray-400">${Math.round(b.usufruit * 100)}%</td>
                <td class="py-1.5 text-center ${isActive ? 'text-accent-green' : 'text-gray-200'}">${Math.round(b.nuePropriete * 100)}%</td>
                <td class="py-1.5 text-center text-gray-400">${formatCurrency(Math.round(immVal * b.nuePropriete))}</td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
          <p class="text-xs text-gray-600 mt-3">Plus vous donnez tôt, plus la nue-propriété est faible → moins de droits. À votre décès, l'usufruit s'éteint et l'enfant reçoit la pleine propriété sans taxation supplémentaire.</p>
        </div>
      </details>

      <!-- Plan de donations -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-200">Mon plan de donations</h2>
          <button id="btn-add-donation" class="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 rounded-lg hover:opacity-90 transition flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Ajouter une donation
          </button>
        </div>
        ${donations.length > 0 ? `
        <div class="space-y-1.5">
          ${donations.map((d, i) => {
            const typeLabels = { argent: 'Don d\'argent', tepa: 'Don TEPA', demembrement: 'Nue-propriété', cto: 'Titres CTO', assurance_vie: 'Assurance-vie', immobilier: 'Immobilier PP', usage: 'Présent d\'usage' };
            const typeColors = { argent: 'accent-amber', tepa: 'accent-cyan', demembrement: 'accent-green', cto: 'accent-blue', assurance_vie: 'purple-400', immobilier: 'accent-green', usage: 'pink-400' };
            const color = typeColors[d.type] || 'gray-400';
            return `
          <div class="group/card flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/30 border border-dark-400/15 hover:border-${color}/40 transition">
            <span class="text-xs px-2 py-0.5 rounded-full bg-${color}/10 text-${color}">${typeLabels[d.type] || d.type}</span>
            <span class="text-sm text-gray-200 font-medium">${formatCurrency(d.montant)}</span>
            <span class="text-xs text-gray-500">→ Enfant ${(d.enfantIdx || 0) + 1}</span>
            <span class="text-xs text-gray-500 ml-auto">${d.annee}</span>
            <button class="don-delete opacity-0 group-hover/card:opacity-100 text-accent-red/50 hover:text-accent-red text-xs transition" data-idx="${i}">✕</button>
          </div>`;
          }).join('')}
        </div>
        ` : `
        <p class="text-center text-gray-600 text-sm py-6">Aucune donation planifiée. Utilisez les stratégies ci-dessus ou ajoutez manuellement.</p>
        `}
      </div>

      <!-- Timeline chart -->
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Évolution du patrimoine après donations</h2>
        <div class="h-80">
          <canvas id="chart-donations-timeline"></canvas>
        </div>
      </div>

      <!-- Barème des droits -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-5 py-3 cursor-pointer select-none">
          <h2 class="text-lg font-semibold text-gray-200">Barème des droits de donation en ligne directe</h2>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-4">
          <p class="text-xs text-gray-500 mb-3">Après abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} par enfant (renouvelable tous les ${RENOUVELLEMENT_ANNEES} ans)</p>
          <table class="w-full text-sm">
            <thead class="text-gray-500 text-xs">
              <tr>
                <th class="text-left py-1.5">Tranche (après abattement)</th>
                <th class="text-center py-1.5">Taux</th>
                <th class="text-center py-1.5">Droits max cumulés</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${(() => {
                let cumul = 0;
                return TRANCHES_DONATION.map(t => {
                  const largeur = t.max === Infinity ? '∞' : formatCurrency(t.max - t.min);
                  const droitsMax = t.max === Infinity ? '-' : formatCurrency(Math.round((t.max - t.min) * t.taux));
                  cumul += t.max === Infinity ? 0 : Math.round((t.max - t.min) * t.taux);
                  return `
              <tr class="text-gray-300">
                <td class="py-1.5 px-2">${formatCurrency(t.min)} → ${t.max === Infinity ? '∞' : formatCurrency(t.max)}</td>
                <td class="py-1.5 text-center font-semibold">${Math.round(t.taux * 100)}%</td>
                <td class="py-1.5 text-center text-gray-400">${formatCurrency(cumul)}</td>
              </tr>`;
                }).join('');
              })()}
            </tbody>
          </table>

          <div class="mt-4 p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
            <h3 class="text-sm font-semibold text-accent-cyan mb-2">Simulateur rapide</h3>
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-500">Montant donné :</span>
              <input type="number" id="quick-don-montant" value="200000" min="0" step="10000" class="w-28 px-2 py-1 text-sm bg-dark-800 border border-dark-400/30 rounded text-gray-300 text-center">
              <span class="text-xs text-gray-500">€ →</span>
              <span id="quick-don-result" class="text-sm font-semibold text-accent-green">
                Après abattement: ${formatCurrency(Math.max(0, 200000 - ABATTEMENT_PARENT_ENFANT))} taxable → Droits: ${formatCurrency(calculerDroitsDonation(Math.max(0, 200000 - ABATTEMENT_PARENT_ENFANT)))}
              </span>
            </div>
          </div>
        </div>
      </details>

      <!-- Assurance-vie détail -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-5 py-3 cursor-pointer select-none">
          <h2 class="text-lg font-semibold text-gray-200">Assurance-vie — Fiscalité au décès</h2>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-accent-green font-semibold mb-2">Primes versées AVANT 70 ans (art. 990 I)</h3>
              <p class="text-sm text-gray-400">Abattement de <strong class="text-gray-200">${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}</strong> par bénéficiaire.</p>
              <p class="text-sm text-gray-400 mt-1">Au-delà : <strong class="text-gray-200">20%</strong> jusqu'à ${formatCurrency(AV_SEUIL_1)}, puis <strong class="text-gray-200">31,25%</strong>.</p>
              <p class="text-xs text-gray-600 mt-2">Avec ${nbEnfants} enfants : ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE * nbEnfants)} totalement exonérés.</p>
            </div>
            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-accent-amber font-semibold mb-2">Primes versées APRÈS 70 ans (art. 757 B)</h3>
              <p class="text-sm text-gray-400">Abattement global de <strong class="text-gray-200">${formatCurrency(AV_ABATTEMENT_APRES_70)}</strong> (partagé entre bénéficiaires).</p>
              <p class="text-sm text-gray-400 mt-1">Au-delà : barème des droits de succession en ligne directe.</p>
              <p class="text-xs text-gray-600 mt-2">Les intérêts acquis sont exonérés (seules les primes sont taxées).</p>
            </div>
          </div>
          <div class="p-3 rounded-lg bg-dark-800/30 border border-accent-cyan/20">
            <h3 class="text-accent-cyan font-semibold mb-2">Stratégie optimale</h3>
            <ul class="text-sm text-gray-400 space-y-1 list-disc list-inside">
              <li>Maximisez les versements <strong class="text-gray-200">avant 70 ans</strong> pour profiter de l'abattement de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/bénéficiaire</li>
              <li>Désignez chaque enfant comme bénéficiaire pour multiplier les abattements</li>
              <li>L'AV est <strong class="text-gray-200">hors succession civile</strong> : pas de rapport, pas d'atteinte à la réserve héréditaire (dans les limites du "manifestement excessif")</li>
              <li>Clause bénéficiaire démembrée possible : usufruit au conjoint, nue-propriété aux enfants</li>
            </ul>
          </div>
        </div>
      </details>

      <!-- Récapitulatif des règles -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-5 py-3 cursor-pointer select-none">
          <h2 class="text-lg font-semibold text-gray-200">Règles fiscales — Aide-mémoire</h2>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-5 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-accent-amber font-semibold mb-1">Abattement classique</h3>
              <p class="text-sm text-gray-400">${formatCurrency(ABATTEMENT_PARENT_ENFANT)} par parent et par enfant, tous les ${RENOUVELLEMENT_ANNEES} ans.</p>
              <p class="text-xs text-gray-600 mt-1">En couple : ${formatCurrency(ABATTEMENT_PARENT_ENFANT * 2)} par enfant.</p>
            </div>
            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-accent-cyan font-semibold mb-1">Don TEPA (loi Sarkozy)</h3>
              <p class="text-sm text-gray-400">${formatCurrency(DON_FAMILIAL_TEPA)} supplémentaires en espèces par parent/enfant.</p>
              <p class="text-xs text-gray-600 mt-1">Donateur &lt; ${AGE_MAX_DONATEUR_TEPA} ans, donataire ≥ ${AGE_MIN_DONATAIRE_TEPA} ans. Renouvelable tous les ${RENOUVELLEMENT_ANNEES} ans.</p>
            </div>
            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-accent-green font-semibold mb-1">Donation CTO — Purge PV</h3>
              <p class="text-sm text-gray-400">Donner des titres CTO efface les plus-values latentes. Le donataire acquiert les titres à leur valeur au jour du don.</p>
              <p class="text-xs text-gray-600 mt-1">Pas de flat tax (30%) sur la PV pour le donateur.</p>
            </div>
            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-accent-green font-semibold mb-1">Démembrement immobilier</h3>
              <p class="text-sm text-gray-400">Donner la nue-propriété : assiette réduite. Au décès, reconstruction gratuite de la pleine propriété.</p>
              <p class="text-xs text-gray-600 mt-1">Plus le donateur est jeune, plus la NP est faible → moins de droits.</p>
            </div>
            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-pink-400 font-semibold mb-1">Présents d'usage</h3>
              <p class="text-sm text-gray-400">Cadeaux à l'occasion d'événements (Noël, anniversaire, mariage...) non taxables et non rapportables.</p>
              <p class="text-xs text-gray-600 mt-1">Pas de seuil fixe — proportionné aux revenus/patrimoine (~2-2,5%).</p>
            </div>
            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-purple-400 font-semibold mb-1">Donation-partage</h3>
              <p class="text-sm text-gray-400">Avantage : les biens sont évalués au jour de la donation (pas de réévaluation au décès). Évite les conflits entre héritiers.</p>
              <p class="text-xs text-gray-600 mt-1">Nécessite un acte notarié. Peut inclure immobilier, titres, argent.</p>
            </div>
          </div>
        </div>
      </details>

      <!-- Détail par enfant -->
      ${lastSnap && lastSnap.enfants ? `
      <div class="card-dark rounded-xl p-5">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Détail par enfant</h2>
        <div class="grid grid-cols-1 ${nbEnfants > 1 ? 'md:grid-cols-' + Math.min(nbEnfants, 4) : ''} gap-4">
          ${lastSnap.enfants.map((e, i) => `
          <div class="p-4 rounded-xl bg-dark-800/40 border border-dark-400/20">
            <h3 class="text-sm font-semibold text-gray-200 mb-3">Enfant ${i + 1}</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-gray-500">Total reçu</span><span class="text-gray-200 font-medium">${formatCurrency(e.totalDonsRecus)}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Droits payés</span><span class="text-accent-red">${formatCurrency(e.totalDroitsPaies)}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">Abattement utilisé</span><span class="text-gray-300">${formatCurrency(e.abattementUtilise)} / ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}</span></div>
              <div class="flex justify-between"><span class="text-gray-500">TEPA utilisé</span><span class="text-gray-300">${formatCurrency(e.tepaUtilise)} / ${formatCurrency(DON_FAMILIAL_TEPA)}</span></div>
              <div class="w-full bg-dark-600 rounded-full h-1.5 mt-1">
                <div class="bg-accent-green h-1.5 rounded-full" style="width: ${Math.min(100, (e.abattementUtilise / ABATTEMENT_PARENT_ENFANT) * 100)}%"></div>
              </div>
            </div>
          </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Table année par année -->
      ${snapshots.some(s => s.donsThisYear > 0) ? `
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-5 border-b border-dark-400/30">
          <h2 class="text-lg font-semibold text-gray-200">Détail année par année</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-dark-800/50 text-gray-500 text-xs">
              <tr>
                <th class="px-3 py-2 text-left">Année</th>
                <th class="px-3 py-2 text-center">Âge</th>
                <th class="px-3 py-2 text-center">Donations</th>
                <th class="px-3 py-2 text-center">Droits</th>
                <th class="px-3 py-2 text-center">Taux effectif</th>
                <th class="px-3 py-2 text-center">Patrimoine restant</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${snapshots.filter(s => s.donsThisYear > 0).map(s => {
                const taux = s.donsThisYear > 0 ? s.droitsThisYear / s.donsThisYear : 0;
                return `
              <tr class="text-gray-300 hover:bg-dark-600/30 transition">
                <td class="px-3 py-2 font-medium">${s.calYear}</td>
                <td class="px-3 py-2 text-center">${s.age} ans</td>
                <td class="px-3 py-2 text-center text-accent-amber font-medium">${formatCurrency(s.donsThisYear)}</td>
                <td class="px-3 py-2 text-center ${s.droitsThisYear > 0 ? 'text-accent-red' : 'text-accent-green'}">${formatCurrency(s.droitsThisYear)}</td>
                <td class="px-3 py-2 text-center text-gray-400">${(taux * 100).toFixed(1)}%</td>
                <td class="px-3 py-2 text-center">${formatCurrency(s.patrimoine)}</td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    </div>
  `;
}

// ============================================================================
// MOUNT
// ============================================================================

export function mount(store, navigate) {
  const donationConfig = store.get('donationConfig') || {};
  const params = store.get('parametres') || {};

  // Chart
  const snapshots = (() => {
    const ageDonateur = donationConfig.ageDonateur || params.ageFinAnnee || 43;
    const nbEnfants = donationConfig.nbEnfants || 2;
    const projectionYears = donationConfig.projectionYears || 30;
    const rendement = donationConfig.rendementPatrimoine || 0.03;
    const actifs = store.get('actifs') || {};
    const totalImmo = (actifs.immobilier || []).reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
    const totalCTO = (actifs.placements || []).filter(p => ['CTO', 'Crypto'].includes(p.enveloppe || '')).reduce((s, p) => s + (Number(p.valeur) || 0), 0);
    const totalAV = (actifs.placements || []).filter(p => (p.enveloppe || '') === 'AV').reduce((s, p) => s + (Number(p.valeur) || 0), 0);
    const totalFinancier = (actifs.epargne || []).reduce((s, i) => s + (Number(i.solde) || 0), 0) +
      (actifs.placements || []).filter(p => !['CTO', 'Crypto', 'AV'].includes(p.enveloppe || '')).reduce((s, p) => s + (Number(p.valeur) || 0), 0);
    return simulerPlanDonation({
      ageDonateur, nbEnfants,
      patrimoine: {
        immobilier: donationConfig.immobilier ?? totalImmo,
        financier: donationConfig.financier ?? totalFinancier,
        cto: donationConfig.cto ?? totalCTO,
        assuranceVie: donationConfig.assuranceVie ?? totalAV,
      },
      donations: donationConfig.donations || [],
      projectionYears, rendementPatrimoine: rendement,
    });
  })();

  if (document.getElementById('chart-donations-timeline') && snapshots.length > 0) {
    const labels = snapshots.map(s => s.calYear.toString());
    createChart('chart-donations-timeline', {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Patrimoine total',
            data: snapshots.map(s => s.patrimoine),
            borderColor: VIVID_PALETTE[0],
            backgroundColor: VIVID_PALETTE[0] + '20',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2.5
          },
          {
            label: 'Donations cumulées',
            data: snapshots.map((s, i) => snapshots.slice(0, i + 1).reduce((sum, ss) => sum + ss.donsThisYear, 0)),
            borderColor: VIVID_PALETTE[1],
            backgroundColor: VIVID_PALETTE[1] + '20',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2.5
          },
          {
            label: 'Droits cumulés',
            data: snapshots.map((s, i) => snapshots.slice(0, i + 1).reduce((sum, ss) => sum + ss.droitsThisYear, 0)),
            borderColor: '#ff4757',
            backgroundColor: '#ff475720',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2
          }
        ]
      },
      options: {
        scales: {
          x: { grid: { display: false }, ticks: { color: COLORS.gridText } },
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

  // Update params
  document.getElementById('btn-update-donation')?.addEventListener('click', () => {
    const cfg = store.get('donationConfig') || {};
    cfg.ageDonateur = parseInt(document.getElementById('don-age')?.value) || 43;
    cfg.nbEnfants = parseInt(document.getElementById('don-enfants')?.value) || 2;
    cfg.projectionYears = parseInt(document.getElementById('don-years')?.value) || 30;
    cfg.rendementPatrimoine = (parseFloat(document.getElementById('don-rendement')?.value) || 3) / 100;
    cfg.immobilier = parseInt(document.getElementById('don-immo')?.value) || 0;
    cfg.financier = parseInt(document.getElementById('don-financier')?.value) || 0;
    cfg.cto = parseInt(document.getElementById('don-cto')?.value) || 0;
    cfg.assuranceVie = parseInt(document.getElementById('don-av')?.value) || 0;
    store.set('donationConfig', cfg);
    navigate('fiscalite');
  });

  // Enter key on params
  document.querySelectorAll('.don-param').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-update-donation')?.click();
      }
    });
  });

  // Quick simulator
  document.getElementById('quick-don-montant')?.addEventListener('input', (e) => {
    const montant = parseInt(e.target.value) || 0;
    const taxable = Math.max(0, montant - ABATTEMENT_PARENT_ENFANT);
    const droits = calculerDroitsDonation(taxable);
    const resultEl = document.getElementById('quick-don-result');
    if (resultEl) {
      resultEl.innerHTML = `Après abattement: ${formatCurrency(taxable)} taxable → Droits: <strong class="text-accent-green">${formatCurrency(droits)}</strong> (${montant > 0 ? ((droits / montant) * 100).toFixed(1) : '0.0'}%)`;
    }
  });

  // Add donation modal
  const openDonationModal = (presetType, presetMontant) => {
    const currentYear = new Date().getFullYear();
    const nbEnfants = (store.get('donationConfig') || {}).nbEnfants || 2;
    const enfantOptions = Array.from({ length: nbEnfants }, (_, i) => ({ value: String(i), label: `Enfant ${i + 1}` }));

    const body = `
      ${selectField('type', 'Type de donation', [
        { value: 'argent', label: 'Don d\'argent (espèces, virement)' },
        { value: 'tepa', label: 'Don familial TEPA (espèces)' },
        { value: 'demembrement', label: 'Nue-propriété (démembrement immobilier)' },
        { value: 'cto', label: 'Titres CTO (purge des plus-values)' },
        { value: 'assurance_vie', label: 'Rachat assurance-vie pour donation' },
        { value: 'immobilier', label: 'Immobilier en pleine propriété' },
      ], presetType || 'argent')}
      ${inputField('montant', 'Montant (€)', presetMontant || '', 'number', 'min="0" step="1000" placeholder="100000"')}
      ${inputField('annee', 'Année', currentYear, 'number', `min="${currentYear}" max="${currentYear + 50}" step="1"`)}
      ${selectField('enfantIdx', 'Bénéficiaire', enfantOptions, '0')}
    `;

    openModal('Planifier une donation', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.montant || !data.annee) return;
      const cfg = store.get('donationConfig') || {};
      if (!cfg.donations) cfg.donations = [];
      cfg.donations.push({
        type: data.type,
        montant: Number(data.montant),
        annee: Number(data.annee),
        enfantIdx: Number(data.enfantIdx || 0),
      });
      store.set('donationConfig', cfg);
      navigate('fiscalite');
    });
  };

  document.getElementById('btn-add-donation')?.addEventListener('click', () => openDonationModal());

  // Strategy quick-add buttons
  document.querySelectorAll('.strat-add-donation').forEach(btn => {
    btn.addEventListener('click', () => {
      openDonationModal(btn.dataset.type, btn.dataset.montant);
    });
  });

  // Delete donations
  document.querySelectorAll('.don-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const cfg = store.get('donationConfig') || {};
      if (cfg.donations) {
        cfg.donations.splice(idx, 1);
        store.set('donationConfig', cfg);
        navigate('fiscalite');
      }
    });
  });
}
