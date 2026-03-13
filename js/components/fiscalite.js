import { formatCurrency, openModal, inputField, selectField, getFormData, computeProjection } from '../utils.js?v=5';
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

// Épargne de sécurité : on ne touche JAMAIS à ce matelas
// Règle : 6 mois de dépenses mensuelles, minimum 15 000 €
const EPARGNE_SECURITE_MOIS = 6;
const EPARGNE_SECURITE_PLANCHER = 15000;

// ============================================================================
// FONCTIONS DE CALCUL
// ============================================================================

function calculerEpargneSecurite(store) {
  const state = store.getAll();
  const depensesMensuelles = (state.depenses || []).reduce((s, i) => {
    const montant = Number(i.montantMensuel) || 0;
    return s + (i.frequence === 'Annuel' ? montant / 12 : montant);
  }, 0);
  return Math.max(EPARGNE_SECURITE_PLANCHER, Math.round(depensesMensuelles * EPARGNE_SECURITE_MOIS));
}

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
// CONSEILLER FISCAL — Recommandations personnalisées
// ============================================================================

function genererConseils(patrimoine, snap, enfants, donations, ageDonateur, currentYear, store) {
  const nbEnfants = enfants.length;
  if (nbEnfants === 0) return [];

  const conseils = [];
  const ageSnap = snap?.age || ageDonateur;
  const yearSnap = snap?.calendarYear || currentYear;
  const liquidites = (snap?.placements || 0) + (snap?.epargne || 0);
  const state = store.getAll();
  const epargneSecurite = calculerEpargneSecurite(store);
  // Cash disponible pour les donations = cash total - épargne de sécurité
  const cashDonnable = Math.max(0, patrimoine.epargne + patrimoine.comptesCourants - epargneSecurite);

  // Analyser les donations déjà planifiées par enfant
  const donParEnfant = {};
  for (const enf of enfants) {
    const dons = (donations || []).filter(d => d.enfantId === enf.id);
    const totalDonne = dons.reduce((s, d) => s + d.montant, 0);
    const hasTepa = dons.some(d => d.type === 'don_tepa');
    const hasNP = dons.some(d => d.type === 'donation_nue_propriete');
    const hasCTO = dons.some(d => d.type === 'donation_cto');
    donParEnfant[enf.id] = { totalDonne, hasTepa, hasNP, hasCTO, count: dons.length };
  }

  // =====================================================================
  // PHASE 1 — Donations sans cash (nue-propriété, CTO)
  // Ces donations ne nécessitent AUCUNE liquidité. C'est le point de départ.
  // =====================================================================

  // --- CONSEIL 1 : Donation nue-propriété immobilière (PRIORITÉ ABSOLUE) ---
  if (patrimoine.immobilier > 0) {
    const enfantsSansNP = enfants.filter(e => !donParEnfant[e.id]?.hasNP);
    if (enfantsSansNP.length > 0) {
      const rate = getUsufruitRate(ageSnap);
      const valeurNP = Math.round(patrimoine.immobilier * rate.nuePropriete);
      const valeurNPParEnfant = Math.round(valeurNP / nbEnfants);
      const taxableParEnfant = Math.max(0, valeurNPParEnfant - ABATTEMENT_PARENT_ENFANT);
      const droitsNP = calculerDroitsDonation(taxableParEnfant) * nbEnfants;
      const droitsSucc = calculerDroitsDonation(Math.max(0, patrimoine.immobilier / nbEnfants - ABATTEMENT_PARENT_ENFANT)) * nbEnfants;
      const economie = droitsSucc - droitsNP;

      if (economie > 0) {
        let ageOptimal = null;
        for (const tranche of BAREME_USUFRUIT) {
          const npTest = Math.round(patrimoine.immobilier * tranche.nuePropriete / nbEnfants);
          if (npTest <= ABATTEMENT_PARENT_ENFANT) { ageOptimal = tranche.ageMax === 20 ? 20 : tranche.ageMax; break; }
        }

        conseils.push({
          priorite: 1,
          icon: '🏠',
          phase: 1,
          titre: `Donation en nue-propriété (${(rate.nuePropriete * 100).toFixed(0)}% à ${ageSnap} ans)`,
          description: `C'est la première chose à faire : donnez la nue-propriété de votre immobilier (${formatCurrency(patrimoine.immobilier)}) tout en conservant l'usufruit. Vous continuez à habiter et percevoir les loyers. Ça ne vous coûte rien en cash, juste les frais de notaire (~1,5%). La base taxable n'est que de ${formatCurrency(valeurNP)} au lieu de ${formatCurrency(patrimoine.immobilier)}.${ageOptimal && ageSnap <= ageOptimal ? ` À ${ageOptimal} ans ou avant, la NP par enfant (${formatCurrency(valeurNPParEnfant)}) passe dans l'abattement = 0 € de droits.` : ''}`,
          economie,
          action: `${formatCurrency(patrimoine.immobilier)} transmis sans sortir un euro de cash`,
          detail: `Art. 669 CGI. À votre décès, l'usufruit s'éteint automatiquement et vos enfants deviennent pleins propriétaires sans droits supplémentaires. Plus vous donnez jeune, plus la nue-propriété est faible. Aucune liquidité nécessaire.`,
          suggestions: enfantsSansNP.map(e => ({
            enfantId: e.id,
            type: 'donation_nue_propriete',
            montant: patrimoine.immobilier / nbEnfants,
            annee: yearSnap
          }))
        });
      }
    }
  }

  // --- CONSEIL 2 : Donation CTO (transfert de titres, pas de vente) ---
  if (patrimoine.cto > 0) {
    const enfantsSansCTO = enfants.filter(e => !donParEnfant[e.id]?.hasCTO);
    if (enfantsSansCTO.length > 0) {
      const ctoParEnfant = Math.round(patrimoine.cto / nbEnfants);
      const taxableParEnfant = Math.max(0, ctoParEnfant - ABATTEMENT_PARENT_ENFANT);
      const pvEstimee = patrimoine.cto * 0.30;
      const flatTaxEvitee = Math.round(pvEstimee * 0.30);

      conseils.push({
        priorite: 1,
        icon: '📈',
        phase: 1,
        titre: `Donation CTO : purger ${formatCurrency(pvEstimee)} de plus-values`,
        description: `Comme la nue-propriété, la donation de titres CTO ne nécessite aucun cash. Vous transférez directement les titres (${formatCurrency(patrimoine.cto)}) à vos enfants. Les plus-values latentes sont purgées, vos enfants repartent à zéro de PV.`,
        economie: flatTaxEvitee,
        action: `Transfert de titres sans vente — PV purgées + ${formatCurrency(flatTaxEvitee)} de flat tax évitée`,
        detail: `La donation de titres purge les plus-values latentes (le donataire reçoit les titres avec un nouveau PRU au cours du jour). Si le CTO par enfant est ≤ ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}, aucun droit de donation non plus. Aucune liquidité nécessaire.`,
        suggestions: enfantsSansCTO.map(e => ({
          enfantId: e.id,
          type: 'donation_cto',
          montant: ctoParEnfant,
          annee: yearSnap
        }))
      });
    }
  }

  // =====================================================================
  // PHASE 2 — Donations en cash (quand le capital le permet)
  // On ne donne du cash QUE si on a constitué assez de patrimoine
  // et on préserve TOUJOURS l'épargne de sécurité (${EPARGNE_SECURITE_MOIS} mois de dépenses).
  // =====================================================================

  // --- CONSEIL 3 : Don TEPA (Sarkozy) — uniquement si cash disponible ---
  if (ageSnap < AGE_MAX_DONATEUR_TEPA) {
    const enfantsSansTepa = enfants.filter(e => !donParEnfant[e.id]?.hasTepa);
    if (enfantsSansTepa.length > 0) {
      const totalTepa = DON_FAMILIAL_TEPA * enfantsSansTepa.length;
      const anneeLimit = currentYear + (AGE_MAX_DONATEUR_TEPA - ageDonateur);
      const cashSuffisant = cashDonnable >= totalTepa;

      conseils.push({
        priorite: 2,
        icon: '🎁',
        phase: 2,
        titre: `Don familial TEPA : ${formatCurrency(DON_FAMILIAL_TEPA)} par enfant`,
        description: cashSuffisant
          ? `Vous avez assez de liquidités (après épargne de sécurité de ${formatCurrency(epargneSecurite)}). Donnez ${formatCurrency(DON_FAMILIAL_TEPA)} supplémentaires à chaque enfant en espèces, totalement exonérés. Vous avez jusqu'à vos 80 ans (${anneeLimit}).`
          : `Il vous manque des liquidités pour le moment. Vous avez ${formatCurrency(cashDonnable)} de disponible après votre épargne de sécurité (${formatCurrency(epargneSecurite)}), contre ${formatCurrency(totalTepa)} nécessaires. Constituez d'abord votre capital. Vous avez jusqu'à vos 80 ans (${anneeLimit}).`,
        economie: enfantsSansTepa.length * calculerDroitsDonation(DON_FAMILIAL_TEPA),
        action: cashSuffisant
          ? `${formatCurrency(totalTepa)} exonérés — cash disponible`
          : `À planifier quand votre épargne le permettra`,
        detail: `Art. 790 G CGI (loi TEPA 2007). Conditions : donateur < 80 ans, donataire majeur, somme d'argent. Cumulable avec l'abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}. Votre épargne de sécurité (${formatCurrency(epargneSecurite)}) est préservée.`,
        suggestions: cashSuffisant ? enfantsSansTepa.map(e => ({
          enfantId: e.id,
          type: 'don_tepa',
          montant: DON_FAMILIAL_TEPA,
          annee: yearSnap
        })) : []
      });
    }
  }

  // --- CONSEIL 4 : Don manuel dans l'abattement — uniquement si cash suffisant ---
  const enfantsSansAbatt = enfants.filter(e => (donParEnfant[e.id]?.totalDonne || 0) < ABATTEMENT_PARENT_ENFANT);
  if (enfantsSansAbatt.length > 0) {
    const tepaDejaPrevu = enfants.some(e => donParEnfant[e.id]?.hasTepa) ? 0 : DON_FAMILIAL_TEPA * enfantsSansAbatt.length;
    const cashApresTEPA = Math.max(0, cashDonnable - tepaDejaPrevu);
    const montantParEnfant = Math.min(ABATTEMENT_PARENT_ENFANT, Math.floor(cashApresTEPA / Math.max(1, enfantsSansAbatt.length)));
    const totalExonere = montantParEnfant * enfantsSansAbatt.length;
    const economie = enfantsSansAbatt.length * calculerDroitsDonation(montantParEnfant);
    const cashSuffisant = montantParEnfant >= 10000;

    if (economie > 0 || !cashSuffisant) {
      conseils.push({
        priorite: cashSuffisant ? 2 : 3,
        icon: '💰',
        phase: 2,
        titre: cashSuffisant
          ? `Don manuel de ${formatCurrency(montantParEnfant)} par enfant`
          : `Don manuel : constituez d'abord votre capital`,
        description: cashSuffisant
          ? `Après épargne de sécurité (${formatCurrency(epargneSecurite)}) et CTO + nue-propriété, vous pouvez donner ${formatCurrency(montantParEnfant)} à ${enfantsSansAbatt.map(e => e.prenom).join(', ')} dans l'abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}.`
          : `Votre cash disponible après épargne de sécurité (${formatCurrency(epargneSecurite)}) ne permet pas encore un don manuel significatif. Concentrez-vous d'abord sur les donations sans cash (nue-propriété, CTO) et constituez votre capital. L'abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} par enfant sera là quand vous serez prêt.`,
        economie: cashSuffisant ? economie : 0,
        action: cashSuffisant
          ? `${formatCurrency(totalExonere)} transmis à 0 € de droits (épargne de sécurité préservée)`
          : `Priorité : nue-propriété et CTO d'abord, cash quand le capital sera constitué`,
        detail: `Abattement art. 779 CGI : ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} par parent par enfant, renouvelable tous les ${RENOUVELLEMENT_ANNEES} ans. On ne touche jamais à l'épargne de sécurité (${formatCurrency(epargneSecurite)}).`,
        suggestions: cashSuffisant ? enfantsSansAbatt.map(e => ({
          enfantId: e.id,
          type: 'don_manuel',
          montant: montantParEnfant,
          annee: yearSnap
        })) : []
      });
    }
  }

  // --- CONSEIL 5 : Assurance-vie avant 70 ans ---
  if (ageSnap < 70) {
    const avParEnfant = patrimoine.assuranceVie / nbEnfants;
    const avManque = AV_ABATTEMENT_PAR_BENEFICIAIRE - avParEnfant;
    if (avManque > 10000) {
      const annees70 = 70 - ageDonateur;
      conseils.push({
        priorite: 3,
        icon: '🛡️',
        titre: `Assurance-vie : ${formatCurrency(avManque * nbEnfants)} à placer avant 70 ans`,
        description: `Chaque enfant bénéficie d'un abattement de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} sur l'AV (primes versées avant 70 ans). Il vous manque ${formatCurrency(avManque)} par bénéficiaire pour maximiser cet avantage. Vous avez ${annees70} ans pour le faire.`,
        economie: Math.round(avManque * nbEnfants * 0.20),
        action: `Maximiser l'AV avant vos 70 ans (${currentYear + annees70})`,
        detail: `Art. 990 I CGI. Les primes versées avant 70 ans bénéficient d'un abattement de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} par bénéficiaire, puis 20% jusqu'à 700k€, puis 31.25%. Les primes après 70 ans n'ont qu'un abattement global de 30 500 €.`,
        suggestions: []
      });
    }
  }

  // --- CONSEIL 6 : Échelonnement sur 15 ans ---
  const totalAbattPossible = (ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA) * nbEnfants;
  const totalDejaPrevu = (donations || []).reduce((s, d) => s + d.montant, 0);
  if (totalDejaPrevu > 0 && ageSnap + RENOUVELLEMENT_ANNEES < 85) {
    const prochainRenouvellement = yearSnap + RENOUVELLEMENT_ANNEES;
    const ageRenouvellement = ageSnap + RENOUVELLEMENT_ANNEES;
    conseils.push({
      priorite: 3,
      icon: '📅',
      titre: `2e vague de donations en ${prochainRenouvellement} (${ageRenouvellement} ans)`,
      description: `Les abattements se renouvellent tous les 15 ans. Si vous donnez maintenant, vous pourrez redonner ${formatCurrency(totalAbattPossible)} exonérés en ${prochainRenouvellement} (vous aurez ${ageRenouvellement} ans).`,
      economie: nbEnfants * calculerDroitsDonation(ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA),
      action: `Planifier un 2e cycle de donations dans ${RENOUVELLEMENT_ANNEES} ans`,
      detail: `L'abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} et le TEPA de ${formatCurrency(DON_FAMILIAL_TEPA)} se reconstituent intégralement après 15 ans (période glissante à compter de la déclaration).`,
      suggestions: []
    });
  }

  // --- CONSEIL 7 : Stratégie d'investissement PEA → AV → CTO ---
  // NOTE : Le PEA est une enveloppe d'épargne à long terme. On ne retire JAMAIS
  // du PEA pour faire des donations. Le PEA sert à faire croître le patrimoine.
  const allPlacements = state.actifs?.placements || [];
  const peaPlacements = allPlacements.filter(p => (p.enveloppe || '').toUpperCase().startsWith('PEA') && (p.enveloppe || '').toUpperCase() !== 'PEE');
  const peaApports = peaPlacements.reduce((s, p) => s + (Number(p.pru || 0) * Number(p.quantite || 0)), 0);
  const PLAFOND_PEA = 150000;
  const peaRestant = Math.max(0, PLAFOND_PEA - peaApports);
  const dcaMensuelTotal = allPlacements.reduce((s, p) => s + (Number(p.dcaMensuel) || 0), 0);

  if (peaRestant < 20000 && dcaMensuelTotal > 0) {
    const avParEnfant = patrimoine.assuranceVie / Math.max(1, nbEnfants);
    const avManqueParEnfant = Math.max(0, AV_ABATTEMENT_PAR_BENEFICIAIRE - avParEnfant);
    const avManqueTotal = avManqueParEnfant * nbEnfants;
    const peePlein = peaRestant <= 0;

    if (avManqueTotal > 10000 && ageSnap < 70) {
      const mensuelRecommande = Math.min(dcaMensuelTotal, Math.ceil(avManqueTotal / ((70 - ageDonateur) * 12)));
      conseils.push({
        priorite: 3,
        icon: '🔄',
        type: 'investissement',
        titre: `${peePlein ? 'PEA plein' : 'PEA bientôt plein'} : basculez ${formatCurrency(mensuelRecommande)}/mois vers l'AV`,
        description: `Votre PEA ${peePlein ? 'a atteint' : 'approche de'} son plafond de ${formatCurrency(PLAFOND_PEA)}${peePlein ? '' : ` (reste ${formatCurrency(peaRestant)})`}. Gardez-le tel quel (ne retirez jamais du PEA pour donner). Redirigez vos versements vers l'AV : il manque ${formatCurrency(avManqueParEnfant)} par enfant pour atteindre l'abattement de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}.`,
        economie: Math.round(avManqueTotal * 0.20),
        action: `AV avant CTO : ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/enfant exonéré au décès`,
        detail: `Ordre de priorité pour les VERSEMENTS : 1) PEA (17.2% après 5 ans, plafond ${formatCurrency(PLAFOND_PEA)}) → 2) AV (abattement ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/bénéficiaire au décès) → 3) CTO (flat tax 30%, mais donnable). Le PEA est intouchable : il sert à faire croître votre patrimoine, pas à financer des donations.`,
        suggestions: []
      });
    } else if (peePlein) {
      conseils.push({
        priorite: 3,
        icon: '🔄',
        type: 'investissement',
        titre: `PEA plein${avManqueTotal <= 10000 ? ', AV optimisée' : ''} : orientez vers le CTO`,
        description: `${avManqueTotal <= 10000 ? 'Votre AV couvre déjà l\'abattement de vos bénéficiaires. ' : ''}Continuez sur le CTO : pas de plafond, et vous pourrez donner les titres à vos enfants pour purger les PV tous les 15 ans. Gardez votre PEA intact.`,
        economie: 0,
        action: `CTO + donation périodique de titres = croissance + optimisation fiscale`,
        detail: `Le CTO a une fiscalité moins avantageuse (flat tax 30%) mais offre une flexibilité totale. La stratégie : accumuler sur CTO, puis donner les titres aux enfants dans la limite de l'abattement → purge des PV + transmission exonérée. Ne touchez jamais à votre PEA.`,
        suggestions: []
      });
    }
  } else if (peaRestant > 0 && dcaMensuelTotal > 0) {
    const moisRestants = Math.ceil(peaRestant / dcaMensuelTotal);
    conseils.push({
      priorite: 3,
      icon: '📊',
      type: 'investissement',
      titre: `Continuez de remplir le PEA (encore ${formatCurrency(peaRestant)})`,
      description: `Le PEA reste l'enveloppe la plus avantageuse (17.2% après 5 ans vs 30% flat tax). Au rythme actuel (${formatCurrency(dcaMensuelTotal)}/mois), plafond atteint dans ~${moisRestants} mois. Ensuite, privilégiez l'AV pour l'abattement successoral (${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/enfant).`,
      economie: 0,
      action: `PEA → AV → CTO : l'ordre optimal pour les versements`,
      detail: `1) PEA : gains exonérés d'IR après 5 ans (PS 17.2% seulement). 2) AV : ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} exonérés par bénéficiaire au décès + fiscalité réduite après 8 ans. 3) CTO : aucun plafond, flat tax 30%, mais donation aux enfants purge les PV. Le PEA n'est PAS une source pour les donations.`,
      suggestions: []
    });
  }

  // --- CONSEIL GLOBAL : résumé du plan en 2 phases ---
  const totalEcoConseils = conseils.reduce((s, c) => s + c.economie, 0);
  const conseilsPhase1 = conseils.filter(c => c.phase === 1);
  const conseilsPhase2 = conseils.filter(c => c.phase === 2);
  if (conseils.length > 1) {
    const phase1Txt = conseilsPhase1.length > 0
      ? `Phase 1 (immédiat, 0 € de cash) : ${conseilsPhase1.map(c => c.titre.split(':')[0].trim()).join(' + ')}.`
      : '';
    const phase2Txt = conseilsPhase2.length > 0
      ? `Phase 2 (quand le capital sera constitué) : donations en espèces dans l'abattement.`
      : '';
    conseils.unshift({
      priorite: 0,
      icon: '🎯',
      titre: `Plan en 2 phases : jusqu'à ${formatCurrency(totalEcoConseils)} d'économie`,
      description: `${phase1Txt}${phase1Txt && phase2Txt ? ' ' : ''}${phase2Txt} Votre épargne de sécurité (${formatCurrency(epargneSecurite)}) est toujours préservée. On ne touche jamais au PEA.`,
      economie: totalEcoConseils,
      action: null,
      detail: null,
      suggestions: [],
      isGlobal: true
    });
  }

  return conseils.sort((a, b) => a.priorite - b.priorite);
}

// ============================================================================
// TIMELINE DE VIE — Plan d'action recommandé
// ============================================================================

function genererTimeline(snapshots, patrimoine, enfants, ageDonateur, currentYear, store, planStartYear) {
  const nbEnfants = enfants.length;
  if (nbEnfants === 0 || snapshots.length === 0) return [];

  const startYear = planStartYear || currentYear;
  const startAge = ageDonateur + (startYear - currentYear);

  const events = [];
  const state = store.getAll();
  const allPlacements = state.actifs?.placements || [];
  const peaPlacements = allPlacements.filter(p => (p.enveloppe || '').toUpperCase().startsWith('PEA') && (p.enveloppe || '').toUpperCase() !== 'PEE');
  const peaApports = peaPlacements.reduce((s, p) => s + (Number(p.pru || 0) * Number(p.quantite || 0)), 0);
  const PLAFOND_PEA = 150000;
  const dcaMensuelPEA = peaPlacements.reduce((s, p) => s + (Number(p.dcaMensuel) || 0), 0);
  const peaRestant = Math.max(0, PLAFOND_PEA - peaApports);

  // Patrimoine à l'année de départ (snapshot)
  const startIdx = Math.max(0, Math.min(snapshots.length - 1, startYear - currentYear));
  const startSnap = snapshots[startIdx] || snapshots[0];
  const startPatrimoine = {
    ...patrimoine,
    immobilier: startSnap.immobilier || 0,
    placements: startSnap.placements || 0,
    assuranceVie: patrimoine.assuranceVie,
    patrimoineNet: startSnap.patrimoineNet || 0,
  };

  // Helper: compute succession cost per child (without donations)
  const succSansDon = (patNet, av) => {
    const part = patNet / nbEnfants;
    const taxable = Math.max(0, part - ABATTEMENT_PARENT_ENFANT);
    return { droits: calculerDroitsDonation(taxable), partBrute: part };
  };

  // Données patrimoniales détaillées pour conseils précis
  const abattTotal = (ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA) * nbEnfants;
  const montantParEnfantCycle1 = ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA;
  const avantCycle1 = succSansDon(startPatrimoine.patrimoineNet - startPatrimoine.assuranceVie, startPatrimoine.assuranceVie);
  const residuelApresCycle1 = Math.max(0, (startPatrimoine.patrimoineNet - startPatrimoine.assuranceVie) - abattTotal);
  const apresCycle1 = succSansDon(residuelApresCycle1, startPatrimoine.assuranceVie);

  // Calcul de la répartition concrète du 1er cycle par véhicule
  const ctoPlacements = allPlacements.filter(p => {
    const env = (p.enveloppe || p.type || '').toUpperCase();
    return env.includes('CTO') || env.includes('COMPTE TITRE');
  });
  const ctoTotal = ctoPlacements.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const peaValeur = peaPlacements.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const epargneTotal = (state.actifs?.epargne || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const ccTotal = (state.actifs?.comptesCourants || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);

  // Sources claires :
  // - Cash (CC + livrets) APRÈS épargne de sécurité : donnable par virement
  // - CTO : donnable par transfert de titres (pas de vente, purge PV)
  // - PEA : ON N'Y TOUCHE JAMAIS — c'est une enveloppe d'épargne, pas une source de donation
  // - AV : régime propre, pas pour les donations
  // - Immobilier : uniquement via nue-propriété (pas de cash nécessaire)
  const epargneSecurite = calculerEpargneSecurite(store);
  const cashImmediat = Math.max(0, epargneTotal + ccTotal - epargneSecurite);

  // Donnable = cash après sécurité + CTO (transfert de titres)
  // PEA exclu : un fiscaliste ne recommanderait jamais de retirer du PEA pour donner
  const donnableTotal = cashImmediat + ctoTotal;

  const donnableCycle1 = Math.min(abattTotal, donnableTotal);
  const donnableParEnfantCycle1 = Math.round(donnableCycle1 / nbEnfants);

  // Construire le plan d'actions concret avec sources détaillées
  // RÈGLES : 1) PEA = intouchable  2) Épargne de sécurité = intouchable
  function buildDonationPlan(montantTotal) {
    const steps = [];
    let reste = montantTotal;

    // 1) Donation de titres CTO (transfert direct, pas de vente, 0 cash)
    if (reste > 0 && ctoTotal > 0) {
      const donCTO = Math.min(ctoTotal, reste);
      const pvEstCTO = Math.round(donCTO * 0.30);
      const flatTaxEvitee = Math.round(pvEstCTO * 0.30);
      steps.push({
        action: `Transférez ${formatCurrency(donCTO)} de titres depuis le CTO`,
        source: `CTO actuel : ${formatCurrency(ctoTotal)} — aucun cash nécessaire`,
        detail: `Transfert de titres (pas de vente). Les PV latentes (~${formatCurrency(pvEstCTO)}) sont purgées = ${formatCurrency(flatTaxEvitee)} de flat tax évitée. C'est la donation la plus efficiente.`,
        type: 'cto',
        montant: donCTO,
        bonus: flatTaxEvitee,
      });
      reste -= donCTO;
    }

    // 2) Don TEPA en espèces (si cash disponible après sécurité)
    const tepaTotal = DON_FAMILIAL_TEPA * nbEnfants;
    const tepaPossible = Math.min(tepaTotal, reste, cashImmediat);
    if (tepaPossible > 0) {
      steps.push({
        action: `Virez ${formatCurrency(tepaPossible)} depuis vos comptes courants/livrets`,
        source: `Cash disponible (après épargne de sécurité de ${formatCurrency(epargneSecurite)}) : ${formatCurrency(cashImmediat)}`,
        detail: `Don familial TEPA (${formatCurrency(DON_FAMILIAL_TEPA)}/enfant, art. 790 G). Simple virement bancaire + déclaration Cerfa 2735 dans le mois.`,
        type: 'cash',
        montant: tepaPossible,
      });
      reste -= tepaPossible;
    }

    // 3) Reste en cash (livrets/CC) au-delà du TEPA
    const cashRestant = Math.max(0, cashImmediat - tepaPossible);
    if (reste > 0 && cashRestant > 0) {
      const cashDon = Math.min(cashRestant, reste);
      steps.push({
        action: `Virez ${formatCurrency(cashDon)} supplémentaires (livrets/comptes)`,
        source: `Cash restant après TEPA : ${formatCurrency(cashRestant)} (sécurité préservée)`,
        detail: `Don manuel classique dans l'abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}/enfant (art. 779 CGI). 0 € de droits.`,
        type: 'cash',
        montant: cashDon,
      });
      reste -= cashDon;
    }

    // 4) Manque — pas de retrait PEA, on attend de constituer le capital
    if (reste > 0) {
      steps.push({
        action: `Il manque ${formatCurrency(reste)} — constituez votre capital d'abord`,
        source: `À constituer via votre épargne mensuelle`,
        detail: `Pas de panique : continuez à épargner (PEA, AV, CTO). Quand vos liquidités hors sécurité le permettront, vous pourrez compléter. On ne touche ni au PEA ni à l'épargne de sécurité pour les donations.`,
        type: 'manque',
        montant: reste,
      });
    }

    return steps;
  }

  // 1. Premier cycle de donations
  const cycle1Steps = buildDonationPlan(donnableCycle1);
  const partiel = donnableCycle1 < abattTotal;
  events.push({
    age: startAge,
    annee: startYear,
    icon: '🎯',
    color: 'accent-green',
    type: 'donation_cycle',
    titre: partiel
      ? `Donner ${formatCurrency(donnableCycle1)} (sur ${formatCurrency(abattTotal)} possibles)`
      : `Donner ${formatCurrency(donnableCycle1)} à 0 € de droits`,
    description: `Abattement disponible : ${formatCurrency(montantParEnfantCycle1)}/enfant (${formatCurrency(ABATTEMENT_PARENT_ENFANT)} classique + ${formatCurrency(DON_FAMILIAL_TEPA)} TEPA). Épargne de sécurité préservée : ${formatCurrency(epargneSecurite)}. PEA non touché.`,
    actionSteps: cycle1Steps,
    sourcesSummary: {
      cash: cashImmediat,
      cto: ctoTotal,
      epargneSecurite,
      total: donnableTotal,
    },
    conseilExpert: [
      {
        titre: 'Commencez par la nue-propriété : 0 € de cash',
        detail: `La donation de nue-propriété immobilière est le premier levier à actionner. Vous ne sortez aucune liquidité, vous conservez l'usufruit (habitation ou loyers), et la base taxable est réduite grâce au barème de l'art. 669 CGI. C'est la stratégie la plus efficace quand on n'a pas encore constitué un capital suffisant pour les donations en espèces.`,
        tag: 'Priorité n°1'
      },
      {
        titre: 'Privilégiez la donation-partage au don manuel',
        detail: `La donation-partage (acte notarié) fige la valeur des biens au jour de la donation. Au contraire, un don manuel sera "rapporté" à la valeur au jour du décès lors de la succession, ce qui peut créer des inégalités entre enfants et augmenter la base taxable. Coût notaire : ~1,5% du montant donné, mais l'économie à long terme est bien supérieure.`,
        tag: 'Sécurisation'
      },
      {
        titre: 'Les deux parents doivent donner chacun',
        detail: `Chaque parent dispose de son propre abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} + ${formatCurrency(DON_FAMILIAL_TEPA)} TEPA par enfant. Si votre conjoint(e) donne aussi, vous doublez la capacité : ${formatCurrency((ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA) * 2)}/enfant au lieu de ${formatCurrency(ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA)}.`,
        tag: 'Levier x2'
      },
      {
        titre: 'Ne touchez jamais à votre PEA pour donner',
        detail: `Le PEA est une enveloppe d'épargne à long terme avec un avantage fiscal majeur (17,2% après 5 ans vs 30% flat tax). Un fiscaliste ne vous recommanderait jamais de retirer du PEA pour financer des donations. Laissez-le croître. Les donations se font avec le cash excédentaire (après sécurité) et les transferts de titres CTO.`,
        tag: 'Règle d\'or'
      },
      {
        titre: `Épargne de sécurité : ${formatCurrency(epargneSecurite)} intouchables`,
        detail: `Votre matelas de sécurité (${EPARGNE_SECURITE_MOIS} mois de dépenses, min. ${formatCurrency(EPARGNE_SECURITE_PLANCHER)}) ne doit jamais servir aux donations. Les donations se font uniquement avec l'excédent de trésorerie. Si vous n'avez pas assez de cash après sécurité, priorisez les donations sans cash (nue-propriété, transfert CTO) et attendez de constituer le capital.`,
        tag: 'Protection'
      },
      ...(partiel ? [{
        titre: `Il manque ${formatCurrency(abattTotal - donnableCycle1)} — patience, pas de PEA`,
        detail: `Vos liquidités disponibles après épargne de sécurité (${formatCurrency(donnableTotal)}) ne couvrent pas l'abattement complet (${formatCurrency(abattTotal)}). C'est normal. Continuez à épargner et utilisez le curseur ci-dessus pour trouver la bonne année. En attendant, faites les donations sans cash (nue-propriété, CTO).`,
        tag: 'Préparation'
      }] : [])
    ],
    impactParEnfant: enfants.map(enf => ({
      prenom: enf.prenom,
      id: enf.id,
      montantRecu: donnableParEnfantCycle1,
      droitsAvant: avantCycle1.droits,
      droitsApres: apresCycle1.droits,
      economie: avantCycle1.droits - apresCycle1.droits,
    })),
    suggestions: enfants.map(enf => ({
      enfantId: enf.id,
      type: 'don_manuel',
      montant: donnableParEnfantCycle1,
      annee: startYear
    }))
  });

  // 2. PEA plein → rediriger vers AV puis CTO
  if (dcaMensuelPEA > 0 && peaRestant > 0) {
    const moisPEA = Math.ceil(peaRestant / dcaMensuelPEA);
    const anneePEA = currentYear + Math.floor(moisPEA / 12);
    const agePEA = ageDonateur + Math.floor(moisPEA / 12);
    if (agePEA < ageDonateur + 30) {
      const avParEnfant = startPatrimoine.assuranceVie / Math.max(1, nbEnfants);
      const avManque = Math.max(0, AV_ABATTEMENT_PAR_BENEFICIAIRE - avParEnfant);
      const redirectAV = avManque > 0 ? `Redirigez ${formatCurrency(dcaMensuelPEA)}/mois vers l'assurance-vie (${formatCurrency(avManque * nbEnfants)} à verser pour atteindre ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/enfant exonérés au décès).` : `Redirigez ${formatCurrency(dcaMensuelPEA)}/mois vers le CTO.`;
      events.push({
        age: agePEA,
        annee: anneePEA,
        icon: '📊',
        color: 'accent-blue',
        type: 'pea_plein',
        titre: `PEA plein — basculer sur ${avManque > 0 ? 'AV' : 'CTO'}`,
        description: redirectAV,
        conseilExpert: [
          ...(avManque > 0 ? [{
            titre: 'AV : choisissez un contrat multi-support en gestion libre',
            detail: `Privilégiez un contrat avec des ETF (frais ~0,5%/an) plutôt qu'un contrat bancaire classique (2-3% de frais). Mettez vos enfants comme bénéficiaires de la clause (rédigez-la sur-mesure, pas la clause type). Pour maximiser la transmission : un contrat par enfant bénéficiaire permet plus de flexibilité. Versez avant vos 70 ans pour profiter de l'abattement de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/bénéficiaire (art. 990 I).`,
            tag: 'AV optimale'
          }] : [{
            titre: 'CTO : accumulez puis donnez tous les 15 ans',
            detail: `Investissez sur CTO en ETF capitalisants (pas de dividendes = pas de flat tax annuelle). Tous les 15 ans, donnez les titres à vos enfants dans la limite de l'abattement : vous purgez les plus-values ET transmettez à 0 € de droits. C'est la stratégie "accumulation-donation" la plus efficace pour un patrimoine en croissance.`,
            tag: 'Stratégie CTO'
          }]),
          {
            titre: 'Ne fermez jamais votre PEA : il date et se bonifie',
            detail: `Même plein, votre PEA conserve son avantage fiscal (17,2% après 5 ans vs 30% flat tax). Vous pouvez continuer à arbitrer à l'intérieur sans fiscalité. En revanche, un retrait partiel avant 5 ans entraîne la clôture. Après 5 ans, les retraits partiels sont possibles sans clôture.`,
            tag: 'Rappel'
          }
        ],
        impactParEnfant: enfants.map(enf => ({
          prenom: enf.prenom, id: enf.id,
          montantRecu: 0,
          detail: avManque > 0 ? `Objectif AV : ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} exonérés au décès (art. 990 I)` : `CTO : donnable aux enfants (purge des PV)`,
        }))
      });
    }
  }

  // 3. Nue-propriété immobilière — PRIORITÉ : c'est le 1er levier, 0 cash
  if (startPatrimoine.immobilier > 0) {
    // Trouver l'âge optimal (quand NP par enfant rentre dans l'abattement)
    let bestAge = null;
    for (const t of BAREME_USUFRUIT) {
      const npParEnfant = Math.round(startPatrimoine.immobilier * t.nuePropriete / nbEnfants);
      if (npParEnfant <= ABATTEMENT_PARENT_ENFANT) {
        bestAge = t.ageMax === 20 ? 20 : (BAREME_USUFRUIT.indexOf(t) === 0 ? 20 : BAREME_USUFRUIT[BAREME_USUFRUIT.indexOf(t) - 1].ageMax + 1);
        break;
      }
    }
    // On propose de le faire DÈS MAINTENANT (ou à l'âge optimal si trop tôt = NP trop haute)
    const npAge = bestAge && bestAge > ageDonateur ? Math.min(bestAge, startAge) : startAge;
    const useCurrentAge = npAge <= startAge;
    const rate = getUsufruitRate(useCurrentAge ? startAge : bestAge);
    const npTotal = Math.round(startPatrimoine.immobilier * rate.nuePropriete);
    const npParEnfant = Math.round(npTotal / nbEnfants);
    const taxableNP = Math.max(0, npParEnfant - ABATTEMENT_PARENT_ENFANT);
    const droitsNPParEnfant = calculerDroitsDonation(taxableNP);
    const droitsSuccImmoParEnfant = calculerDroitsDonation(Math.max(0, startPatrimoine.immobilier / nbEnfants - ABATTEMENT_PARENT_ENFANT));
    const zeroDrops = taxableNP === 0;
    const displayAge = useCurrentAge ? startAge : bestAge;
    if (droitsSuccImmoParEnfant > 0 || zeroDrops) {
      events.push({
        age: displayAge,
        annee: currentYear + (displayAge - ageDonateur),
        icon: '🏠',
        color: 'accent-amber',
        type: 'nue_propriete',
        titre: `Nue-propriété : ${formatCurrency(npTotal)} transmis sans cash`,
        description: zeroDrops
          ? `C'est le premier réflexe : pas besoin de cash, juste un rendez-vous chez le notaire. Vous transférez la nue-propriété de vos biens (${formatCurrency(startPatrimoine.immobilier)}). La valeur fiscale n'est que de ${(rate.nuePropriete * 100).toFixed(0)}% = ${formatCurrency(npParEnfant)}/enfant → dans l'abattement = 0 € de droits. Vous gardez l'usufruit (habitation, loyers).${bestAge && bestAge > startAge ? ` Âge optimal pour 0 € de droits : ${bestAge} ans.` : ''}`
          : `C'est le premier réflexe : pas besoin de cash, juste un rendez-vous chez le notaire. Vous transférez la nue-propriété de vos biens (${formatCurrency(startPatrimoine.immobilier)}). NP = ${(rate.nuePropriete * 100).toFixed(0)}% = ${formatCurrency(npParEnfant)}/enfant. Droits : ${formatCurrency(droitsNPParEnfant)}/enfant au lieu de ${formatCurrency(droitsSuccImmoParEnfant)} à la succession. Vous gardez l'usufruit.${bestAge && bestAge > startAge ? ` Si vous attendez ${bestAge} ans, la NP sera dans l'abattement = 0 € de droits.` : ''}`,
        conseilExpert: [
          {
            titre: 'Le double avantage du démembrement : décote + extinction gratuite',
            detail: `1) Vous ne payez de droits que sur la nue-propriété (${(rate.nuePropriete * 100).toFixed(0)}% de la valeur). 2) À votre décès, l'usufruit s'éteint automatiquement et vos enfants deviennent pleins propriétaires SANS aucun droit supplémentaire. C'est le mécanisme le plus puissant pour transmettre l'immobilier : la plus-value entre la donation et le décès échappe totalement aux droits de succession.`,
            tag: 'Mécanisme clé'
          },
          {
            titre: 'Passez par une SCI familiale pour plus de souplesse',
            detail: `Au lieu de donner l'immeuble directement, logez-le dans une SCI et donnez les parts en nue-propriété. Avantages : donation progressive (10% des parts, puis 20%, etc.), décote de 15-20% pour illiquidité des parts, gestion facilitée (vous gardez la gérance via l'usufruit), et pas de frais notariés à chaque donation de parts. Vous pouvez aussi insérer des clauses d'agrément pour garder le contrôle.`,
            tag: 'Stratégie avancée'
          },
          {
            titre: 'Attention : ne donnez pas trop tôt si le bien prend de la valeur',
            detail: `Le barème du démembrement est fixé par l'art. 669 CGI par tranches de 10 ans. Si votre bien va fortement s'apprécier, il peut être optimal de donner plus tard (NP plus élevée mais sur un bien qui a pris de la valeur dans les mains de vos enfants, sans droits). Inversement, si vous visez 0 € de droits, donnez au moment où NP/enfant ≤ ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}.`,
            tag: 'Timing'
          },
          {
            titre: 'Clause de retour conventionnel : protégez-vous',
            detail: `Insérez systématiquement une clause de retour conventionnel dans l'acte de donation. Si votre enfant décède avant vous, le bien vous revient automatiquement sans droits de succession. Sans cette clause, le bien tomberait dans la succession de votre enfant (et serait taxé à nouveau).`,
            tag: 'Protection'
          },
          {
            titre: 'Réserve d\'usufruit : vous gardez tous vos droits',
            detail: `En vous réservant l'usufruit, vous conservez le droit d'habiter le bien ou de percevoir les loyers. Vos enfants ne peuvent ni vendre ni louer sans votre accord. Vous pouvez même prévoir une clause de quasi-usufruit sur le prix de vente en cas de cession du bien.`,
            tag: 'Sécurité'
          }
        ],
        impactParEnfant: enfants.map(enf => ({
          prenom: enf.prenom, id: enf.id,
          montantRecu: npParEnfant,
          droitsAvant: droitsSuccImmoParEnfant,
          droitsApres: droitsNPParEnfant,
          economie: droitsSuccImmoParEnfant - droitsNPParEnfant,
        })),
        suggestions: enfants.map(enf => ({
          enfantId: enf.id,
          type: 'donation_nue_propriete',
          montant: Math.round(startPatrimoine.immobilier / nbEnfants),
          annee: currentYear + (displayAge - ageDonateur)
        }))
      });
    }
  }

  // 4. 2ème cycle (15 ans après)
  const age2 = startAge + RENOUVELLEMENT_ANNEES;
  if (age2 < 85) {
    const cycle2Year = startYear + RENOUVELLEMENT_ANNEES;
    const cycle2Idx = Math.max(0, Math.min(snapshots.length - 1, cycle2Year - currentYear));
    const cycle2Snap = snapshots[cycle2Idx] || startSnap;
    const liqCycle2 = (cycle2Snap.placements || 0) + (cycle2Snap.epargne || 0);
    const canTepa = age2 < AGE_MAX_DONATEUR_TEPA;
    const maxCycle2 = (canTepa ? montantParEnfantCycle1 : ABATTEMENT_PARENT_ENFANT) * nbEnfants;
    const donnableCycle2 = Math.min(maxCycle2, liqCycle2);
    const donnableParEnfantC2 = Math.round(donnableCycle2 / nbEnfants);
    const partielC2 = donnableCycle2 < maxCycle2;
    events.push({
      age: age2,
      annee: cycle2Year,
      icon: '🔄',
      color: 'accent-cyan',
      type: 'donation_cycle',
      titre: partielC2
        ? `Re-donner ${formatCurrency(donnableCycle2)} (sur ${formatCurrency(maxCycle2)} possibles)`
        : `Re-donner ${formatCurrency(maxCycle2)} à 0 € de droits`,
      description: `Abattements reconstitués après 15 ans. Vous pourrez re-donner ${formatCurrency(donnableParEnfantC2)}/enfant${canTepa ? ` (abattement ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} + TEPA ${formatCurrency(DON_FAMILIAL_TEPA)})` : ` (TEPA indisponible après 80 ans, abattement seul)`}. Placements projetés à cette date : ${formatCurrency(liqCycle2)}. La source (CTO titres, cash excédentaire) dépendra de votre allocation à ce moment.`,
      conseilExpert: [
        {
          titre: 'Le rappel fiscal est glissant : calculez au jour près',
          detail: `Le délai de 15 ans se calcule à compter de la date de déclaration (pas au 1er janvier). Si vous avez donné le 15 mars ${startYear}, l'abattement se reconstitue le 16 mars ${cycle2Year}. Donnez le jour même du renouvellement pour ne pas perdre un seul jour. Anticipez les rendez-vous notariés (prévoir 2-3 mois avant la date cible).`,
          tag: 'Précision'
        },
        {
          titre: 'Donnez les titres CTO accumulés sur 15 ans',
          detail: `Si vous avez accumulé sur un CTO entre les deux cycles, c'est le moment idéal pour donner ces titres. Les plus-values latentes (potentiellement significatives sur 15 ans de capitalisation) seront intégralement purgées. Vos enfants repartent à 0 de plus-value, et la donation est exonérée dans l'abattement. Double gain : pas de droits + pas de flat tax.`,
          tag: 'Purge PV'
        },
        ...(canTepa ? [{
          titre: `TEPA encore disponible : ${formatCurrency(DON_FAMILIAL_TEPA)}/enfant en plus`,
          detail: `Vous aurez ${age2} ans au 2e cycle : le don TEPA (art. 790 G) reste accessible jusqu'à 80 ans. N'oubliez pas de le cumuler à nouveau. Déclarez-le séparément (Cerfa 2735) pour bien distinguer les deux abattements.`,
          tag: 'Rappel TEPA'
        }] : [{
          titre: 'TEPA perdu : compensez par d\'autres stratégies',
          detail: `À ${age2} ans, le don TEPA n'est plus accessible (limite à 80 ans). Pour compenser, maximisez les donations de titres CTO (purge des PV), les présents d'usage, et assurez-vous que l'assurance-vie est bien calibrée (${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/bénéficiaire).`,
          tag: 'Compensation'
        }]),
        {
          titre: 'Pensez aux petits-enfants si patrimoine important',
          detail: `Chaque grand-parent bénéficie d'un abattement de ${formatCurrency(31865)} par petit-enfant (art. 790 B CGI), renouvelable aussi tous les 15 ans. Si votre patrimoine dépasse la capacité d'abattement de vos enfants, incluez les petits-enfants dans votre stratégie de transmission.`,
          tag: 'Génération suivante'
        }
      ],
      impactParEnfant: enfants.map(enf => ({
        prenom: enf.prenom, id: enf.id,
        montantRecu: donnableParEnfantC2,
        droitsAvant: calculerDroitsDonation(donnableParEnfantC2),
        droitsApres: 0,
        economie: calculerDroitsDonation(donnableParEnfantC2),
      })),
      suggestions: enfants.map(enf => ({
        enfantId: enf.id,
        type: 'don_manuel',
        montant: donnableParEnfantC2,
        annee: cycle2Year
      }))
    });
  }

  // 5. Avant 70 ans : verser en assurance-vie
  if (ageDonateur < 70) {
    const avParEnfant = startPatrimoine.assuranceVie / Math.max(1, nbEnfants);
    const avManque = AV_ABATTEMENT_PAR_BENEFICIAIRE - avParEnfant;
    if (avManque > 10000) {
      const totalAVerser = avManque * nbEnfants;
      const annees = 69 - ageDonateur;
      const mensuel = Math.ceil(totalAVerser / Math.max(1, annees) / 12);
      events.push({
        age: 69,
        annee: currentYear + (69 - ageDonateur),
        icon: '🛡️',
        color: 'accent-purple',
        type: 'av_deadline',
        titre: `Verser ${formatCurrency(totalAVerser)} en assurance-vie`,
        description: `Versez ${formatCurrency(mensuel)}/mois pendant ${annees} ans pour atteindre ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/enfant avant vos 70 ans. Après 70 ans, l'abattement tombe à ${formatCurrency(AV_ABATTEMENT_APRES_70)} global (art. 757 B). Chaque enfant récupère ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} hors succession à 0 % de droits.`,
        conseilExpert: [
          {
            titre: 'Avant 70 ans vs après 70 ans : un gouffre fiscal',
            detail: `Avant 70 ans (art. 990 I) : abattement de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} PAR bénéficiaire, puis 20% jusqu'à 700k€, puis 31,25%. Après 70 ans (art. 757 B) : abattement de seulement ${formatCurrency(AV_ABATTEMENT_APRES_70)} GLOBAL (tous bénéficiaires confondus), puis barème classique des droits de succession. La différence est colossale : avec ${nbEnfants} enfants, c'est ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE * nbEnfants)} d'abattement avant 70 ans vs ${formatCurrency(AV_ABATTEMENT_APRES_70)} après.`,
            tag: 'Urgence'
          },
          {
            titre: 'Rédigez une clause bénéficiaire sur-mesure',
            detail: `Ne gardez jamais la clause type "mon conjoint, à défaut mes enfants". Rédigez une clause démembrée : "l'usufruit à mon conjoint, la nue-propriété à mes enfants par parts égales". Ainsi, le conjoint touche les revenus (rachats partiels) et les enfants récupèrent le capital au second décès, le tout en franchise de droits grâce à l'abattement de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/enfant.`,
            tag: 'Clause clé'
          },
          {
            titre: 'Ouvrez un contrat par bénéficiaire',
            detail: `Un contrat séparé par enfant offre plus de souplesse : vous pouvez ajuster les montants individuellement, modifier la clause d'un seul contrat sans toucher les autres, et vos enfants pourront gérer leur contrat indépendamment au dénouement. C'est aussi plus simple pour le traitement successoral.`,
            tag: 'Organisation'
          },
          {
            titre: 'Versez massivement juste avant 70 ans si besoin',
            detail: `Rien n'interdit un versement unique important à 69 ans. Si vous n'avez pas pu verser régulièrement, un versement massif juste avant la limite fonctionne aussi bien fiscalement. Utilisez vos liquidités excédentaires (après épargne de sécurité) pour maximiser l'AV avant la deadline.`,
            tag: 'Dernière chance'
          },
          {
            titre: 'Après 70 ans : l\'AV reste intéressante pour les intérêts',
            detail: `Même après 70 ans, les intérêts et plus-values générés sur les primes versées sont TOTALEMENT exonérés de droits de succession. Seules les primes versées sont taxées (après l'abattement de ${formatCurrency(AV_ABATTEMENT_APRES_70)}). Sur un contrat dynamique, les intérêts peuvent représenter 50-100% des primes sur 15-20 ans. Continuez donc à verser, mais en sachant que le régime est moins favorable.`,
            tag: 'Après 70 ans'
          }
        ],
        impactParEnfant: enfants.map(enf => ({
          prenom: enf.prenom, id: enf.id,
          montantRecu: avManque,
          droitsAvant: Math.round(avManque * 0.20),
          droitsApres: 0,
          economie: Math.round(avManque * 0.20),
          detail: `${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} transmis hors succession (art. 990 I)`,
        }))
      });
    }
  }

  // 6. 80 ans : dernier don TEPA
  if (ageDonateur < AGE_MAX_DONATEUR_TEPA) {
    const totalTepa = DON_FAMILIAL_TEPA * nbEnfants;
    events.push({
      age: 79,
      annee: currentYear + (79 - ageDonateur),
      icon: '⏰',
      color: 'accent-red',
      type: 'tepa_deadline',
      titre: `Dernier virement TEPA : ${formatCurrency(totalTepa)}`,
      description: `Faites un virement de ${formatCurrency(DON_FAMILIAL_TEPA)} par enfant avant vos 80 ans (art. 790 G). C'est un simple virement bancaire, exonéré de droits. Après 80 ans, cette exonération disparaît définitivement.`,
      conseilExpert: [
        {
          titre: 'Date d\'anniversaire = deadline absolue',
          detail: `Le don TEPA doit être fait AVANT le jour de votre 80e anniversaire (pas le jour même). Programmez le virement au moins 1 semaine avant pour éviter les délais bancaires. Déclarez-le dans le mois suivant avec le Cerfa 2735 (gratuit, pas besoin de notaire). Gardez une preuve du virement et une copie du cerfa.`,
          tag: 'Deadline'
        },
        {
          titre: 'TEPA : cumulable avec TOUS les autres abattements',
          detail: `Le don TEPA de ${formatCurrency(DON_FAMILIAL_TEPA)} a son propre compteur, indépendant de l'abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}. Il est aussi cumulable avec l'abattement petit-enfant (${formatCurrency(31865)}), l'abattement arrière-petit-enfant (${formatCurrency(5310)}), et même avec les présents d'usage. C'est un bonus pur, ne le gaspillez pas.`,
          tag: 'Cumul'
        },
        {
          titre: 'Les deux parents peuvent faire un TEPA chacun',
          detail: `Votre conjoint(e) peut aussi donner ${formatCurrency(DON_FAMILIAL_TEPA)} par enfant avant ses 80 ans. C'est donc ${formatCurrency(DON_FAMILIAL_TEPA * 2)} par enfant au total pour le couple. Si votre conjoint n'a pas assez de trésorerie, faites-lui d'abord une donation entre époux (exonérée à ${formatCurrency(80724)}) pour qu'il/elle puisse ensuite donner aux enfants.`,
          tag: 'Levier couple'
        },
        {
          titre: 'Dernière occasion de transmettre des liquidités exonérées',
          detail: `Après 80 ans, il n'existe plus aucun dispositif spécifique pour transmettre des espèces en franchise de droits (hors abattement classique s'il est reconstitué). Le TEPA est littéralement votre dernière cartouche. Si vous hésitez, rappelez-vous qu'un euro donné maintenant vaut plus qu'un euro hérité taxé à 20-45%.`,
          tag: 'Urgence'
        }
      ],
      impactParEnfant: enfants.map(enf => ({
        prenom: enf.prenom, id: enf.id,
        montantRecu: DON_FAMILIAL_TEPA,
        droitsAvant: calculerDroitsDonation(DON_FAMILIAL_TEPA),
        droitsApres: 0,
        economie: calculerDroitsDonation(DON_FAMILIAL_TEPA),
      })),
      suggestions: enfants.map(enf => ({
        enfantId: enf.id,
        type: 'don_tepa',
        montant: DON_FAMILIAL_TEPA,
        annee: currentYear + (79 - ageDonateur)
      }))
    });
  }

  // 7. 3ème cycle (30 ans après le 1er)
  const age3 = startAge + 2 * RENOUVELLEMENT_ANNEES;
  if (age3 < 90) {
    const cycle3Year = startYear + 2 * RENOUVELLEMENT_ANNEES;
    const cycle3Idx = Math.max(0, Math.min(snapshots.length - 1, cycle3Year - currentYear));
    const cycle3Snap = snapshots[cycle3Idx] || startSnap;
    const liqCycle3 = (cycle3Snap.placements || 0) + (cycle3Snap.epargne || 0);
    const canTepa3 = age3 < AGE_MAX_DONATEUR_TEPA;
    const maxCycle3 = (canTepa3 ? montantParEnfantCycle1 : ABATTEMENT_PARENT_ENFANT) * nbEnfants;
    const donnableCycle3 = Math.min(maxCycle3, liqCycle3);
    const donnableParEnfantC3 = Math.round(donnableCycle3 / nbEnfants);
    const partielC3 = donnableCycle3 < maxCycle3;
    events.push({
      age: age3,
      annee: cycle3Year,
      icon: '🔄',
      color: 'accent-cyan',
      type: 'donation_cycle',
      titre: partielC3
        ? `Re-donner ${formatCurrency(donnableCycle3)} (sur ${formatCurrency(maxCycle3)} possibles)`
        : `Re-donner ${formatCurrency(maxCycle3)} à 0 € de droits`,
      description: `3e cycle : abattements reconstitués après 30 ans. Vous pourrez re-donner ${formatCurrency(donnableParEnfantC3)}/enfant${canTepa3 ? '' : ' (TEPA indisponible après 80 ans)'}. Placements projetés : ${formatCurrency(liqCycle3)}. La source exacte dépendra de votre portefeuille à ce moment.`,
      conseilExpert: [
        {
          titre: 'Bilan patrimonial à cet âge : adaptez la stratégie',
          detail: `À ${age3} ans, votre situation aura évolué. Réévaluez : vos besoins en revenus (dépendance éventuelle), la valeur réelle de votre patrimoine, et la situation fiscale de vos enfants. Un conseil patrimonial à ce stade peut révéler des opportunités nouvelles (donation de parts de SCPI, rachat partiel d'AV pour re-donner, etc.).`,
          tag: 'Réévaluation'
        },
        {
          titre: 'Donnez les titres CTO accumulés sur 30 ans',
          detail: `Sur 30 ans de capitalisation, les plus-values latentes sur un CTO peuvent représenter 200-400% du capital investi. Les donner plutôt que les vendre permet d'éviter la flat tax de 30% sur ces gains considérables, tout en utilisant l'abattement reconstitué. C'est le moment où la stratégie "accumulation-donation" montre toute sa puissance.`,
          tag: 'Purge PV massive'
        },
        {
          titre: 'Incluez les petits-enfants dans ce cycle',
          detail: `Si vos petits-enfants sont majeurs, vous pouvez leur donner ${formatCurrency(31865)}/petit-enfant (art. 790 B) en plus des donations aux enfants. Avec le don TEPA grand-parent (${formatCurrency(31865)}, art. 790 G si < 80 ans), c'est un levier supplémentaire puissant pour réduire la masse successorale.`,
          tag: 'Multi-générationnel'
        }
      ],
      impactParEnfant: enfants.map(enf => ({
        prenom: enf.prenom, id: enf.id,
        montantRecu: donnableParEnfantC3,
        droitsAvant: calculerDroitsDonation(donnableParEnfantC3),
        droitsApres: 0,
        economie: calculerDroitsDonation(donnableParEnfantC3),
      })),
      suggestions: enfants.map(enf => ({
        enfantId: enf.id,
        type: 'don_manuel',
        montant: donnableParEnfantC3,
        annee: cycle3Year
      }))
    });
  }

  return events.sort((a, b) => a.age - b.age);
}

// ============================================================================
// HTML HELPERS — réutilisés par render et par le slider
// ============================================================================

function renderConseilsHTML(conseils, enfants) {
  if (conseils.length === 0) return '';
  let stepNum = 0;
  return conseils.map((c, idx) => {
    if (c.isGlobal) {
      return `
      <div class="relative bg-gradient-to-r from-accent-green/10 via-accent-cyan/5 to-accent-blue/10 border border-accent-green/20 rounded-xl p-4 overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-accent-green/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div class="relative flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-accent-green/20 flex items-center justify-center text-xl shrink-0">${c.icon}</div>
          <div>
            <h3 class="text-sm font-bold text-accent-green">${c.titre}</h3>
            <p class="text-xs text-gray-300 mt-0.5">${c.description}</p>
          </div>
        </div>
      </div>`;
    }
    stepNum++;
    const isPhase1 = c.phase === 1;
    const isPhase2 = c.phase === 2;
    const isInvest = c.type === 'investissement';
    const borderColor = isPhase1 ? 'border-accent-green' : isInvest ? 'border-accent-blue' : 'border-accent-amber';
    const stepColor = isPhase1 ? 'bg-accent-green text-dark-900' : isInvest ? 'bg-accent-blue text-dark-900' : 'bg-accent-amber text-dark-900';
    const phaseLabel = isPhase1 ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-accent-green/15 text-accent-green">Sans cash</span>'
      : isPhase2 ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-accent-amber/15 text-accent-amber">Quand capital prêt</span>'
      : '';
    return `
    <details class="group rounded-xl overflow-hidden border-l-4 ${borderColor} bg-dark-800/20 hover:bg-dark-800/40 transition">
      <summary class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none [&::-webkit-details-marker]:hidden list-none">
        <div class="w-7 h-7 rounded-lg ${stepColor} flex items-center justify-center text-xs font-black shrink-0">${stepNum}</div>
        <span class="text-base shrink-0">${c.icon}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold text-gray-100">${c.titre}</h3>
            ${phaseLabel}
          </div>
        </div>
        ${c.economie > 0 ? `<div class="text-right shrink-0 mr-2">
          <p class="text-sm font-bold text-accent-green">-${formatCurrency(c.economie)}</p>
          <p class="text-[9px] text-gray-500 uppercase">de droits</p>
        </div>` : ''}
        <svg class="w-4 h-4 text-gray-500 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </summary>
      <div class="px-4 pb-4 border-t border-dark-400/10 ml-10">
        <p class="text-xs text-gray-400 leading-relaxed mt-3 mb-2">${c.description}</p>
        ${c.action ? `
          <div class="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-accent-cyan/5 border border-accent-cyan/15">
            <span class="w-1.5 h-1.5 rounded-full bg-accent-cyan shrink-0"></span>
            <p class="text-xs text-accent-cyan font-medium">${c.action}</p>
          </div>` : ''}
        ${c.detail ? `
          <div class="mt-2 px-3 py-2 rounded-lg bg-dark-900/40 border border-dark-400/10">
            <p class="text-[10px] text-gray-500 leading-relaxed">${c.detail}</p>
          </div>
        ` : ''}
        ${c.suggestions && c.suggestions.length > 0 ? `
          <div class="mt-3 flex gap-2 flex-wrap">
            ${c.suggestions.map(s => `
              <button class="conseil-apply px-3 py-1.5 rounded-lg bg-accent-green/10 text-accent-green text-[11px] font-medium hover:bg-accent-green/20 border border-accent-green/20 transition"
                data-enfant-id="${s.enfantId}" data-type="${s.type}" data-montant="${s.montant}" data-annee="${s.annee}">
                + Appliquer pour ${enfants.find(e => e.id === s.enfantId)?.prenom || '?'}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </details>`;
  }).join('');
}

// Unified plan rendering — merges timeline + conseils into a single vertical flow
function renderPlanUnifieHTML(timeline, enfants) {
  if (!timeline || timeline.length === 0) return '<p class="text-sm text-gray-500 text-center py-4">Ajoutez des enfants pour voir votre plan</p>';

  const totalEconomie = timeline.reduce((s, ev) =>
    s + (ev.impactParEnfant || []).reduce((s2, c) => s2 + (c.economie || 0), 0), 0);

  const TAG_COLORS = {
    'Sécurisation': 'accent-blue', 'Levier x2': 'accent-green', 'Levier couple': 'accent-green',
    'Optimisation': 'accent-cyan', 'Bonus': 'accent-purple', 'Préparation': 'accent-amber',
    'Mécanisme clé': 'accent-cyan', 'Stratégie avancée': 'accent-purple', 'Timing': 'accent-amber',
    'Protection': 'accent-red', 'Sécurité': 'accent-red', 'Précision': 'accent-cyan',
    'Purge PV': 'accent-green', 'Purge PV massive': 'accent-green', 'Rappel TEPA': 'accent-amber',
    'Compensation': 'accent-amber', 'Génération suivante': 'accent-purple', 'Multi-générationnel': 'accent-purple',
    'Réévaluation': 'accent-blue', 'AV optimale': 'accent-purple', 'Stratégie CTO': 'accent-green',
    'Rappel': 'accent-amber', 'Urgence': 'accent-red', 'Clause clé': 'accent-purple',
    'Organisation': 'accent-blue', 'Dernière chance': 'accent-red', 'Après 70 ans': 'accent-amber',
    'Deadline': 'accent-red', 'Cumul': 'accent-cyan', 'Attention PEA': 'accent-amber',
  };

  const heroHTML = totalEconomie > 0 ? `
    <div class="relative bg-gradient-to-r from-accent-green/10 via-accent-cyan/5 to-accent-blue/10 border border-accent-green/20 rounded-xl p-4 mb-4 overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-accent-green/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div class="relative flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-accent-green/20 flex items-center justify-center text-xl shrink-0">🎯</div>
        <div>
          <h3 class="text-sm font-bold text-accent-green">Objectif : économiser ${formatCurrency(totalEconomie)} de droits</h3>
          <p class="text-xs text-gray-300 mt-0.5">Suivez ces ${timeline.length} étapes adaptées à votre profil. Chaque montant tient compte de vos liquidités réelles.</p>
        </div>
      </div>
    </div>` : '';

  let stepNum = 0;
  const stepsHTML = timeline.map((ev, idx) => {
    stepNum++;
    const stepEco = (ev.impactParEnfant || []).reduce((s, e) => s + (e.economie || 0), 0);
    const isInvest = ev.type === 'pea_plein';
    const borderColor = `border-${ev.color}`;
    const stepBg = `bg-${ev.color}`;

    return `
    <details class="group plan-step rounded-xl overflow-hidden border-l-4 ${borderColor} bg-dark-800/20 hover:bg-dark-800/40 transition" data-event-idx="${idx}">
      <summary class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none [&::-webkit-details-marker]:hidden list-none">
        <div class="w-8 h-8 rounded-lg ${stepBg} text-dark-900 flex items-center justify-center text-xs font-black shrink-0">${stepNum}</div>
        <span class="text-lg shrink-0">${ev.icon}</span>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-bold text-gray-100">${ev.titre}</h3>
          <p class="text-[10px] text-gray-500 mt-0.5 flex items-center gap-2">
            <span class="px-1.5 py-0.5 rounded bg-${ev.color}/10 text-${ev.color} font-bold">${ev.annee}</span>
            <span>${ev.age} ans</span>
          </p>
        </div>
        ${stepEco > 0 ? `<div class="text-right shrink-0 mr-2">
          <p class="text-sm font-bold text-accent-green">-${formatCurrency(stepEco)}</p>
          <p class="text-[9px] text-gray-500 uppercase tracking-wide">de droits</p>
        </div>` : isInvest ? `<div class="text-right shrink-0 mr-2">
          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-accent-blue/15 text-accent-blue">Stratégie</span>
        </div>` : ''}
        <svg class="w-4 h-4 text-gray-500 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </summary>
      <div class="px-4 pb-4 border-t border-dark-400/10 ml-11">
        <p class="text-xs text-gray-400 leading-relaxed mt-3 mb-3">${ev.description}</p>

        ${ev.actionSteps && ev.actionSteps.length > 0 ? `
        <div class="mb-3 space-y-1.5">
          <p class="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-2">Actions concrètes</p>
          ${ev.actionSteps.map((step, si) => {
            const typeColors = {
              cash: { bg: 'bg-accent-green/8', border: 'border-accent-green/20', icon: '💶', label: 'text-accent-green' },
              cto: { bg: 'bg-accent-purple/8', border: 'border-accent-purple/20', icon: '📈', label: 'text-accent-purple' },
              pea: { bg: 'bg-accent-amber/8', border: 'border-accent-amber/20', icon: '⚠️', label: 'text-accent-amber' },
              manque: { bg: 'bg-accent-red/8', border: 'border-accent-red/20', icon: '🔴', label: 'text-accent-red' },
            };
            const tc = typeColors[step.type] || typeColors.cash;
            return `
            <div class="rounded-lg ${tc.bg} border ${tc.border} px-3 py-2">
              <div class="flex items-start gap-2">
                <span class="text-sm shrink-0 mt-0.5">${tc.icon}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold ${tc.label}">${step.action}</p>
                  <p class="text-[10px] text-gray-500 mt-0.5">${step.source}</p>
                  <p class="text-[10px] text-gray-400 mt-0.5">${step.detail}</p>
                </div>
                <span class="text-[11px] font-bold text-gray-300 whitespace-nowrap shrink-0">${formatCurrency(step.montant)}</span>
              </div>
            </div>`;
          }).join('')}
          ${ev.sourcesSummary ? `
          <div class="mt-2 px-3 py-2 rounded-lg bg-dark-900/40 border border-dark-400/15">
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
              <span class="text-gray-500">Cash dispo (après sécurité) : <span class="text-gray-300 font-medium">${formatCurrency(ev.sourcesSummary.cash)}</span></span>
              ${ev.sourcesSummary.cto > 0 ? `<span class="text-gray-500">CTO (transfert titres) : <span class="text-gray-300 font-medium">${formatCurrency(ev.sourcesSummary.cto)}</span></span>` : ''}
              ${ev.sourcesSummary.epargneSecurite ? `<span class="text-gray-500">Sécurité préservée : <span class="text-accent-green font-medium">${formatCurrency(ev.sourcesSummary.epargneSecurite)}</span></span>` : ''}
              <span class="text-gray-500 ml-auto">Total mobilisable : <span class="text-accent-cyan font-bold">${formatCurrency(ev.sourcesSummary.total)}</span></span>
            </div>
          </div>` : ''}
        </div>` : ''}

        ${ev.impactParEnfant && ev.impactParEnfant.some(c => c.droitsAvant !== undefined && c.economie > 0) ? `
        <div class="grid grid-cols-1 ${ev.impactParEnfant.length >= 2 ? 'md:grid-cols-' + Math.min(ev.impactParEnfant.length, 4) : ''} gap-2 mb-3">
          ${ev.impactParEnfant.map((child, i) => {
            const color = CHILD_COLORS[i % CHILD_COLORS.length];
            return child.droitsAvant !== undefined ? `
            <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-900/40 border border-${color}/15">
              <div class="w-6 h-6 rounded-full bg-${color}/20 border border-${color}/30 flex items-center justify-center text-[10px] font-bold text-${color}">${(child.prenom || '?')[0].toUpperCase()}</div>
              <div class="flex-1 min-w-0">
                <p class="text-[11px] font-medium text-gray-300">${child.prenom}</p>
                ${child.montantRecu ? `<p class="text-[10px] text-gray-500">Reçoit ${formatCurrency(child.montantRecu)}</p>` : ''}
              </div>
              ${child.economie > 0 ? `<span class="text-[11px] font-bold text-accent-green whitespace-nowrap">-${formatCurrency(child.economie)}</span>` : ''}
            </div>` : '';
          }).join('')}
        </div>` : ''}

        ${ev.suggestions && ev.suggestions.length > 0 ? `
        <div class="flex gap-2 flex-wrap mb-3">
          ${ev.suggestions.map(s => `
            <button class="conseil-apply px-3 py-1.5 rounded-lg bg-accent-green/10 text-accent-green text-[11px] font-medium hover:bg-accent-green/20 border border-accent-green/20 transition"
              data-enfant-id="${s.enfantId}" data-type="${s.type}" data-montant="${s.montant}" data-annee="${s.annee}">
              + Appliquer pour ${enfants.find(e => e.id === s.enfantId)?.prenom || '?'}
            </button>
          `).join('')}
        </div>` : ''}

        ${ev.conseilExpert && ev.conseilExpert.length > 0 ? `
        <details class="group/tips rounded-lg overflow-hidden bg-dark-900/20 border border-dark-400/10">
          <summary class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none [&::-webkit-details-marker]:hidden list-none text-[11px] text-accent-amber font-medium">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
            ${ev.conseilExpert.length} conseil${ev.conseilExpert.length > 1 ? 's' : ''} d'expert
            <svg class="w-3 h-3 ml-auto text-gray-500 transition-transform group-open/tips:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </summary>
          <div class="px-3 pb-3 pt-1 border-t border-dark-400/5 space-y-1.5">
            ${ev.conseilExpert.map(tip => {
              const tagColor = TAG_COLORS[tip.tag] || 'accent-cyan';
              return `
              <details class="group/tip rounded-lg overflow-hidden bg-dark-900/30 border border-dark-400/10 hover:border-${tagColor}/20 transition">
                <summary class="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none [&::-webkit-details-marker]:hidden list-none">
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-${tagColor}/15 text-${tagColor} shrink-0">${tip.tag}</span>
                  <span class="text-[11px] font-medium text-gray-300 flex-1">${tip.titre}</span>
                  <svg class="w-3 h-3 text-gray-500 shrink-0 transition-transform group-open/tip:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </summary>
                <div class="px-3 pb-2 pt-1 border-t border-dark-400/5">
                  <p class="text-[11px] text-gray-400 leading-relaxed">${tip.detail}</p>
                </div>
              </details>`;
            }).join('')}
          </div>
        </details>` : ''}
      </div>
    </details>`;
  }).join('');

  return heroHTML + `<div class="space-y-2">${stepsHTML}</div>`;
}

function renderImpactHTML(totalDroitsSansdon, succSansdon, totalFiscaliteAvecdon, totalDonne, totalDroitsDonation, patrimoineResiduelHorsAV, totalDroitsSuccResiduelle, economie, patrimoine) {
  const pctEco = totalDroitsSansdon > 0 ? Math.round(economie / totalDroitsSansdon * 100) : 0;
  return `
    <div class="grid grid-cols-3 gap-2">
      <div class="rounded-lg px-3 py-2 bg-dark-800/40 border border-accent-red/20 text-center">
        <p class="text-[10px] text-gray-500 mb-1">Si vous ne faites rien</p>
        <p class="text-lg font-bold text-accent-red">${formatCurrency(totalDroitsSansdon)}</p>
        <p class="text-[10px] text-gray-500">de droits de succession</p>
        ${succSansdon ? `<details class="mt-1 text-left">
          <summary class="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400">Détail</summary>
          <div class="mt-1 text-[10px] text-gray-500 space-y-0.5">
            <p>Part par enfant : ${formatCurrency(succSansdon.partBrute)}</p>
            <p>Taxable : ${formatCurrency(succSansdon.taxable)} → ${formatCurrency(succSansdon.droits)} droits/enfant</p>
            ${patrimoine.assuranceVie > 0 ? `<p>+ ${formatCurrency(succSansdon.avDroits)} droits AV/enfant</p>` : ''}
          </div>
        </details>` : ''}
      </div>
      <div class="rounded-lg px-3 py-2 bg-dark-800/40 border border-accent-green/20 text-center">
        <p class="text-[10px] text-gray-500 mb-1">Avec vos donations</p>
        <p class="text-lg font-bold text-accent-green">${formatCurrency(totalFiscaliteAvecdon)}</p>
        <p class="text-[10px] text-gray-500">total droits à payer</p>
        <details class="mt-1 text-left">
          <summary class="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400">Détail</summary>
          <div class="mt-1 text-[10px] text-gray-500 space-y-0.5">
            <p>Donné : ${formatCurrency(totalDonne)} · Droits : ${formatCurrency(totalDroitsDonation)}</p>
            <p>Résiduel : ${formatCurrency(patrimoineResiduelHorsAV)} → ${formatCurrency(totalDroitsSuccResiduelle)} droits</p>
          </div>
        </details>
      </div>
      <div class="rounded-lg px-3 py-2 ${economie > 0 ? 'bg-gradient-to-br from-accent-cyan/10 to-accent-green/5 border border-accent-cyan/30' : 'bg-dark-800/40 border border-dark-400/20'} text-center">
        <p class="text-[10px] text-gray-500 mb-1">Vos enfants économisent</p>
        <p class="text-lg font-bold ${economie > 0 ? 'text-accent-cyan' : 'text-gray-500'}">${formatCurrency(economie)}</p>
        <p class="text-[10px] text-gray-500">${economie > 0 ? 'en moins de droits' : 'ajoutez des donations ci-dessous'}</p>
        ${totalDroitsSansdon > 0 ? `
        <div class="mt-1 flex items-center gap-2">
          <div class="flex-1 h-1 bg-dark-600 rounded-full overflow-hidden">
            <div class="h-full bg-accent-cyan rounded-full transition-all" style="width: ${Math.min(100, Math.max(0, pctEco))}%"></div>
          </div>
          <span class="text-[10px] font-bold ${economie > 0 ? 'text-accent-cyan' : 'text-gray-500'}">${pctEco}%</span>
        </div>` : ''}
      </div>
    </div>
  `;
}

const CHILD_COLORS = ['accent-purple', 'accent-cyan', 'accent-green', 'accent-amber', 'accent-blue', 'accent-red'];

function renderTimelineHTML(timeline, ageDonateur) {
  if (!timeline || timeline.length === 0) return '<p class="text-sm text-gray-500 text-center py-4">Ajoutez des enfants pour voir le plan</p>';
  return `
    <div class="pb-2">
      <div class="grid relative" style="padding-top:4px;grid-template-columns:repeat(${timeline.length}, 1fr)">
        <div class="absolute top-[19px] left-[20px] right-[20px] h-[2px] bg-dark-400/30 rounded-full"></div>
        ${timeline.map((ev, i) => {
          const isPast = ev.age < ageDonateur;
          const isCurrent = ev.age >= ageDonateur && ev.age <= ageDonateur + 2;
          return `
          <div class="timeline-event flex flex-col items-center relative cursor-pointer group/ev ${isPast ? 'opacity-40' : ''}" data-event-idx="${i}">
            <div class="w-9 h-9 rounded-full border-2 ${isCurrent ? `border-${ev.color} bg-${ev.color}/20 ring-4 ring-${ev.color}/10` : `border-dark-400/50 bg-dark-700`} flex items-center justify-center text-base z-10 relative group-hover/ev:scale-110 transition-transform">
              ${ev.icon}
            </div>
            <span class="text-[11px] font-bold text-${ev.color} mt-2 px-1.5 py-0.5 rounded bg-${ev.color}/10">${ev.annee} <span class="text-gray-500">(${ev.age} ans)</span></span>
            <p class="text-xs font-medium text-gray-200 text-center mt-2 px-3 leading-snug">${ev.titre}</p>
            <details class="mt-1 px-2 text-center">
              <summary class="text-[10px] text-${ev.color} cursor-pointer hover:underline font-medium inline-flex items-center gap-1 mx-auto">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                Conseil${ev.conseilExpert && ev.conseilExpert.length > 0 ? ` (${ev.conseilExpert.length} tips)` : ''}
              </summary>
              <div class="mt-1 text-left">
                <p class="text-[11px] text-gray-500 text-center leading-snug">${ev.description}</p>
                ${ev.conseilExpert && ev.conseilExpert.length > 0 ? `
                <div class="mt-2 space-y-1">
                  ${ev.conseilExpert.slice(0, 2).map(tip => `
                    <p class="text-[10px] text-accent-amber/80 leading-snug">→ ${tip.titre}</p>
                  `).join('')}
                  ${ev.conseilExpert.length > 2 ? `<p class="text-[10px] text-gray-600">+ ${ev.conseilExpert.length - 2} autres conseils (cliquez pour voir l'impact)</p>` : ''}
                </div>` : ''}
              </div>
            </details>
            <span class="text-[10px] text-${ev.color} mt-2 opacity-0 group-hover/ev:opacity-100 transition font-medium">Voir l'impact &rarr;</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div id="timeline-impact-panel" class="hidden mt-4"></div>
  `;
}

function renderImpactPanel(ev) {
  if (!ev || !ev.impactParEnfant || ev.impactParEnfant.length === 0) return '';
  const nbEnfants = ev.impactParEnfant.length;
  const totalEconomie = ev.impactParEnfant.reduce((s, e) => s + (e.economie || 0), 0);

  const hasConseilExpert = ev.conseilExpert && ev.conseilExpert.length > 0;
  const TAG_COLORS = {
    'Sécurisation': 'accent-blue',
    'Levier x2': 'accent-green',
    'Levier couple': 'accent-green',
    'Optimisation': 'accent-cyan',
    'Bonus': 'accent-purple',
    'Préparation': 'accent-amber',
    'Mécanisme clé': 'accent-cyan',
    'Stratégie avancée': 'accent-purple',
    'Timing': 'accent-amber',
    'Protection': 'accent-red',
    'Sécurité': 'accent-red',
    'Précision': 'accent-cyan',
    'Purge PV': 'accent-green',
    'Purge PV massive': 'accent-green',
    'Rappel TEPA': 'accent-amber',
    'Compensation': 'accent-amber',
    'Génération suivante': 'accent-purple',
    'Multi-générationnel': 'accent-purple',
    'Réévaluation': 'accent-blue',
    'AV optimale': 'accent-purple',
    'Stratégie CTO': 'accent-green',
    'Rappel': 'accent-amber',
    'Urgence': 'accent-red',
    'Clause clé': 'accent-purple',
    'Organisation': 'accent-blue',
    'Dernière chance': 'accent-red',
    'Après 70 ans': 'accent-amber',
    'Deadline': 'accent-red',
    'Cumul': 'accent-cyan',
  };

  return `
    <div class="rounded-xl border border-${ev.color}/20 bg-dark-800/30 p-4 animate-fadeIn">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-lg">${ev.icon}</span>
        <div>
          <h3 class="text-sm font-bold text-gray-200">${ev.titre} — ${ev.annee}</h3>
          ${totalEconomie > 0 ? `<p class="text-[10px] text-accent-green">Economie totale : ${formatCurrency(totalEconomie)} de droits</p>` : ''}
        </div>
        <button class="close-impact-panel ml-auto w-6 h-6 rounded-full bg-dark-600/50 text-gray-500 hover:text-gray-300 flex items-center justify-center transition text-xs">&times;</button>
      </div>

      <div class="grid grid-cols-1 ${nbEnfants >= 2 ? 'md:grid-cols-' + Math.min(nbEnfants, 4) : ''} gap-3">
        ${ev.impactParEnfant.map((child, i) => {
          const color = CHILD_COLORS[i % CHILD_COLORS.length];
          const hasBeforeAfter = child.droitsAvant !== undefined && child.droitsApres !== undefined;
          return `
          <div class="rounded-xl p-4 bg-dark-900/40 border border-${color}/20 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-16 h-16 bg-${color}/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div class="relative">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-8 h-8 rounded-full bg-${color}/20 border border-${color}/30 flex items-center justify-center text-xs font-bold text-${color}">
                  ${(child.prenom || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p class="text-sm font-bold text-gray-200">${child.prenom || 'Enfant'}</p>
                  ${child.montantRecu ? `<p class="text-[10px] text-gray-500">Reçoit ${formatCurrency(child.montantRecu)}</p>` : ''}
                </div>
              </div>

              ${hasBeforeAfter ? `
              <div class="flex items-center gap-2 mb-2">
                <div class="flex-1 text-center p-2 rounded-lg bg-accent-red/5 border border-accent-red/10">
                  <p class="text-[9px] text-gray-500 uppercase">Sans action</p>
                  <p class="text-sm font-bold text-accent-red">${formatCurrency(child.droitsAvant)}</p>
                  <p class="text-[9px] text-gray-500">de droits</p>
                </div>
                <svg class="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                <div class="flex-1 text-center p-2 rounded-lg bg-accent-green/5 border border-accent-green/10">
                  <p class="text-[9px] text-gray-500 uppercase">Avec action</p>
                  <p class="text-sm font-bold text-accent-green">${formatCurrency(child.droitsApres)}</p>
                  <p class="text-[9px] text-gray-500">de droits</p>
                </div>
              </div>
              ${child.economie > 0 ? `
              <div class="text-center px-2 py-1.5 rounded-lg bg-accent-cyan/5 border border-accent-cyan/15">
                <span class="text-xs font-bold text-accent-cyan">-${formatCurrency(child.economie)} economises</span>
              </div>` : ''}
              ` : ''}

              ${child.detail ? `<p class="text-[10px] text-gray-500 mt-2">${child.detail}</p>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>

      ${hasConseilExpert ? `
      <div class="mt-4 pt-4 border-t border-${ev.color}/10">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-6 h-6 rounded-lg bg-accent-amber/20 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <h4 class="text-xs font-bold text-accent-amber">Conseils d'expert fiscaliste</h4>
        </div>
        <div class="space-y-2">
          ${ev.conseilExpert.map(tip => {
            const tagColor = TAG_COLORS[tip.tag] || 'accent-cyan';
            return `
            <details class="group/tip rounded-lg overflow-hidden bg-dark-900/30 border border-dark-400/10 hover:border-${tagColor}/20 transition">
              <summary class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none [&::-webkit-details-marker]:hidden list-none">
                <span class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-${tagColor}/15 text-${tagColor} shrink-0">${tip.tag}</span>
                <span class="text-[11px] font-medium text-gray-300 flex-1">${tip.titre}</span>
                <svg class="w-3 h-3 text-gray-500 shrink-0 transition-transform group-open/tip:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div class="px-3 pb-3 pt-1 border-t border-dark-400/5">
                <p class="text-[11px] text-gray-400 leading-relaxed">${tip.detail}</p>
              </div>
            </details>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>
  `;
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

  // === PROJECTION ===
  const snapshots = computeProjection(store);
  const selectedYear = cfg.selectedProjectionYear || currentYear;
  const snapshotIdx = Math.max(0, Math.min(snapshots.length - 1, selectedYear - currentYear));
  const snap = snapshots[snapshotIdx] || snapshots[0];

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

  // === ANNÉE DE DÉPART DU PLAN ===
  // Le plan peut commencer immédiatement avec la nue-propriété (pas besoin de cash).
  // L'année de départ pour les donations cash = quand les liquidités (hors sécurité, hors PEA)
  // permettent de couvrir l'abattement.
  const abattTotalParEnfant = ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA;
  const abattTotalFamille = abattTotalParEnfant * nbEnfants;
  const epargneSecuriteCalc = calculerEpargneSecurite(store);
  let anneeDepart = null;
  let ageDepart = null;
  if (nbEnfants > 0) {
    // Le plan commence maintenant (nue-propriété ne requiert pas de cash)
    // mais on cherche quand les donations cash seront possibles
    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];
      // Liquidités hors immobilier, hors PEA, après épargne de sécurité
      const liq = Math.max(0, (s.patrimoineNet || 0) - (s.immobilier || 0) - epargneSecuriteCalc);
      if (liq >= abattTotalFamille) {
        anneeDepart = s.calendarYear;
        ageDepart = s.age;
        break;
      }
    }
  }

  // === TIMELINE DE VIE ===
  const planStartYear = cfg.anneeDepartPlan || anneeDepart || currentYear;
  const timeline = genererTimeline(snapshots, patrimoine, enfants, ageDonateur, currentYear, store, planStartYear);

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
          <h1 class="text-xl font-bold text-gray-100">Stratégie de transmission</h1>
          <p class="text-sm text-gray-400 mt-1">Phase 1 : nue-propriété (sans cash) · Phase 2 : donations quand le capital le permet</p>
        </div>
      </div>

      ${nbEnfants === 0 ? `
      <div class="card-dark rounded-xl p-6 text-center">
        <div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-accent-purple/20 flex items-center justify-center">
          <svg class="w-6 h-6 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </div>
        <p class="text-sm text-gray-400 mb-3">Ajoutez vos enfants dans l'onglet <strong class="text-accent-purple">Enfants</strong> pour lancer la simulation</p>
        <button id="btn-go-enfants" class="px-4 py-2 bg-accent-purple text-dark-900 text-xs font-bold rounded-lg hover:opacity-90 transition">Aller dans Enfants</button>
      </div>
      ` : `
      <!-- DASHBOARD — Vue d'ensemble -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-200">Vue d'ensemble</h2>
            <p class="text-[10px] text-gray-500">${ageDonateur} ans · ${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} · Patrimoine net ${formatCurrency(patrimoine.patrimoineNet)}</p>
          </div>
          <button id="btn-add-donation-top" class="ml-auto px-3 py-1.5 bg-accent-green text-dark-900 text-xs font-bold rounded-lg hover:opacity-90 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Enregistrer une donation
          </button>
        </div>

        <!-- Comparatif succession -->
        <div class="grid grid-cols-3 gap-3 mb-5">
          <div class="rounded-xl p-3 bg-accent-red/5 border border-accent-red/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase mb-1">Sans optimisation</p>
            <p class="text-xl font-bold text-accent-red">${formatCurrency(totalDroitsSansdon)}</p>
            <p class="text-[10px] text-gray-500">de droits de succession</p>
          </div>
          <div class="rounded-xl p-3 bg-accent-green/5 border border-accent-green/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase mb-1">Avec vos donations</p>
            <p class="text-xl font-bold text-accent-green">${formatCurrency(totalFiscaliteAvecdon)}</p>
            <p class="text-[10px] text-gray-500">total droits à payer</p>
          </div>
          <div class="rounded-xl p-3 ${economie > 0 ? 'bg-gradient-to-br from-accent-cyan/10 to-accent-green/5 border border-accent-cyan/20' : 'bg-dark-800/40 border border-dark-400/15'} text-center">
            <p class="text-[10px] text-gray-500 uppercase mb-1">Économie</p>
            <p class="text-xl font-bold ${economie > 0 ? 'text-accent-cyan' : 'text-gray-500'}">${formatCurrency(economie)}</p>
            <p class="text-[10px] text-gray-500">${totalDroitsSansdon > 0 ? Math.round(economie / totalDroitsSansdon * 100) + '% économisé' : 'ajoutez des donations'}</p>
          </div>
        </div>

        <!-- Jauges par enfant -->
        <div class="grid grid-cols-1 ${nbEnfants >= 2 ? 'md:grid-cols-' + Math.min(nbEnfants, 3) : ''} gap-3">
          ${enfants.map((enf, i) => {
            const dons = donationsParEnfant[enf.id] || [];
            const totalDonneEnf = totalDonneParEnfant[enf.id] || 0;
            const lastDon = dons[dons.length - 1];
            const abattRestant = lastDon ? lastDon.abattementRestant : ABATTEMENT_PARENT_ENFANT;
            const tepaRestant = lastDon ? lastDon.tepaRestant : DON_FAMILIAL_TEPA;
            const abattUsedPct = Math.min(100, Math.round((1 - abattRestant / ABATTEMENT_PARENT_ENFANT) * 100));
            const tepaUsed = tepaRestant < DON_FAMILIAL_TEPA;
            const color = CHILD_COLORS[i % CHILD_COLORS.length];
            const droitsEnf = dons.reduce((s, r) => s + r.droits, 0);

            return `
            <div class="rounded-xl p-4 bg-dark-800/30 border border-dark-400/10 hover:border-${color}/20 transition">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-8 h-8 rounded-full bg-${color}/20 border border-${color}/30 flex items-center justify-center text-xs font-bold text-${color}">
                  ${(enf.prenom || '?')[0].toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold text-gray-200">${enf.prenom || 'Sans nom'}</p>
                  <p class="text-[10px] text-gray-500">${dons.length > 0 ? `${dons.length} donation${dons.length > 1 ? 's' : ''} · ${formatCurrency(totalDonneEnf)} donné` : 'Aucune donation'}</p>
                </div>
                ${droitsEnf > 0 ? `<span class="text-[10px] text-accent-red font-medium">${formatCurrency(droitsEnf)} droits</span>` : dons.length > 0 ? `<span class="text-[10px] text-accent-green font-medium">0 € droits</span>` : ''}
              </div>

              <!-- Jauge abattement -->
              <div class="mb-2">
                <div class="flex justify-between text-[10px] mb-1">
                  <span class="text-gray-500">Abattement ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}</span>
                  <span class="${abattUsedPct > 0 ? 'text-' + color : 'text-gray-500'} font-medium">${abattUsedPct}% utilisé</span>
                </div>
                <div class="h-2 bg-dark-600 rounded-full overflow-hidden">
                  <div class="h-full bg-${color} rounded-full transition-all" style="width:${abattUsedPct}%"></div>
                </div>
                <p class="text-[10px] text-gray-500 mt-0.5">Restant : ${formatCurrency(abattRestant)}</p>
              </div>

              <!-- TEPA -->
              <div class="flex items-center justify-between text-[10px] px-2 py-1.5 rounded-lg ${tepaUsed ? 'bg-dark-600/30' : 'bg-accent-cyan/5 border border-accent-cyan/10'}">
                <span class="text-gray-400">TEPA (${formatCurrency(DON_FAMILIAL_TEPA)})</span>
                <span class="${tepaUsed ? 'text-gray-400' : 'text-accent-cyan'} font-medium">${tepaUsed ? `${formatCurrency(tepaRestant)} restant` : 'Disponible'}</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
      `}

      <!-- SIMULATEUR PROJECTION -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <h2 class="text-sm font-bold text-gray-200">Projection du patrimoine</h2>
          <span class="text-xs text-gray-500 ml-2">Simulez à quelle année vous pourriez donner</span>
        </div>

        <div class="flex items-center gap-4 mb-4">
          <label class="text-sm text-gray-300 whitespace-nowrap">Année :</label>
          <input type="range" id="projection-year-slider" min="${currentYear}" max="${currentYear + (params.projectionYears || 30)}" value="${selectedYear}" step="1"
            class="flex-1 h-2 bg-dark-600 rounded-full appearance-none cursor-pointer accent-accent-cyan">
          <span id="projection-year-label" class="text-sm font-bold text-accent-cyan min-w-[4rem] text-center">${selectedYear}</span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div class="bg-dark-800/40 rounded-lg p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase">Patrimoine net</p>
            <p class="text-lg font-bold text-accent-green" id="proj-patrimoine">${formatCurrency(snap?.patrimoineNet || 0)}</p>
          </div>
          <div class="bg-dark-800/40 rounded-lg p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase">Immobilier</p>
            <p class="text-lg font-bold text-pink-400" id="proj-immobilier">${formatCurrency(snap?.immobilier || 0)}</p>
          </div>
          <div class="bg-dark-800/40 rounded-lg p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase">Placements</p>
            <p class="text-lg font-bold text-purple-400" id="proj-placements">${formatCurrency(snap?.placements || 0)}</p>
          </div>
          <div class="bg-dark-800/40 rounded-lg p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase">Épargne</p>
            <p class="text-lg font-bold text-amber-400" id="proj-epargne">${formatCurrency(snap?.epargne || 0)}</p>
          </div>
        </div>

        <div class="flex items-center gap-4 text-xs text-gray-400">
          <span class="text-gray-300 font-medium" id="proj-age-label">À ${snap?.age || ageDonateur} ans (fin ${snap?.calendarYear || currentYear})</span>
          <span id="proj-cap-epargne">Capacité d'épargne : ${formatCurrency((snap?.capaciteEpargne || 0) * 12)}/an</span>
        </div>

        ${nbEnfants === 0 ? '' : `
        <!-- IMPACT DES DONATIONS — intégré sous le slider -->
        <div class="mt-4 pt-4 border-t border-dark-400/20">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            </div>
            <div>
              <h2 class="text-sm font-bold text-gray-200">Impact de vos donations</h2>
              <p class="text-[10px] text-gray-500" id="impact-subtitle">Basé sur votre patrimoine en ${snap?.calendarYear || currentYear} (${snap?.age || ageDonateur} ans)</p>
            </div>
          </div>
          <div id="impact-container">
            ${renderImpactHTML(totalDroitsSansdon, succSansdon, totalFiscaliteAvecdon, totalDonne, totalDroitsDonation, patrimoineResiduelHorsAV, totalDroitsSuccResiduelle, economie, patrimoine)}
          </div>
        </div>
        `}
      </div>

      <!-- STRATÉGIE PATRIMONIALE UNIFIÉE -->
      ${timeline.length > 0 ? `
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-green/30 to-accent-cyan/10 flex items-center justify-center">
            <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-200">Votre stratégie patrimoniale</h2>
            <p class="text-[10px] text-gray-500" id="plan-subtitle">${timeline.length} étapes · Nue-propriété dès maintenant · Donations cash ${anneeDepart ? `dès ${anneeDepart}` : 'quand le capital le permettra'}</p>
          </div>
          <div class="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg ${anneeDepart ? 'bg-accent-green/10 border border-accent-green/20' : 'bg-accent-amber/10 border border-accent-amber/20'}">
            <svg class="w-3.5 h-3.5 ${anneeDepart ? 'text-accent-green' : 'text-accent-amber'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <div>
              <p class="text-[10px] text-gray-400 leading-none">Donations cash dès</p>
              <div class="flex items-center gap-1">
                <input type="number" id="annee-depart-input" min="${currentYear}" max="${currentYear + (params.projectionYears || 30)}" value="${cfg.anneeDepartPlan || anneeDepart || currentYear}"
                  class="w-16 text-sm font-bold ${anneeDepart ? 'text-accent-green' : 'text-accent-amber'} bg-transparent border-none outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
                <span class="text-[10px] text-gray-400" id="annee-depart-age">(${ageDonateur + ((cfg.anneeDepartPlan || anneeDepart || currentYear) - currentYear)} ans)</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Principes -->
        <div class="grid grid-cols-3 gap-2 mb-4">
          <div class="rounded-lg px-3 py-2 bg-accent-green/5 border border-accent-green/15 text-center">
            <p class="text-[10px] font-bold text-accent-green uppercase">Phase 1 — immédiat</p>
            <p class="text-[10px] text-gray-400 mt-0.5">Nue-propriété + CTO</p>
            <p class="text-[10px] text-gray-500">0 € de cash</p>
          </div>
          <div class="rounded-lg px-3 py-2 bg-accent-amber/5 border border-accent-amber/15 text-center">
            <p class="text-[10px] font-bold text-accent-amber uppercase">Phase 2 — quand prêt</p>
            <p class="text-[10px] text-gray-400 mt-0.5">Donations en espèces</p>
            <p class="text-[10px] text-gray-500">Cash excédentaire uniquement</p>
          </div>
          <div class="rounded-lg px-3 py-2 bg-accent-red/5 border border-accent-red/15 text-center">
            <p class="text-[10px] font-bold text-accent-red uppercase">On ne touche jamais</p>
            <p class="text-[10px] text-gray-400 mt-0.5">PEA · Épargne de sécurité</p>
            <p class="text-[10px] text-gray-500">${formatCurrency(epargneSecuriteCalc)} protégés</p>
          </div>
        </div>

        <div id="plan-container">
          ${renderPlanUnifieHTML(timeline, enfants)}
        </div>
      </div>
      ` : ''}

      ${nbEnfants === 0 ? '' : `
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
  const nbEnfants = enfants.length;

  // --- Slider projection ---
  const snapshots = computeProjection(store);
  const patrimoine = getPatrimoineFromStore(store);
  const slider = document.getElementById('projection-year-slider');

  // Current timeline data (updated on slider move or plan start year change)
  let currentTimeline = null;

  // Helper: compute anneeDepart
  function computeAnneeDepart() {
    if (nbEnfants === 0) return null;
    const abattTotalFamille = (ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA) * nbEnfants;
    for (const s of snapshots) {
      const liq = (s.patrimoineNet || 0) - (s.immobilier || 0);
      if (liq >= abattTotalFamille) return s.calendarYear;
    }
    return null;
  }

  // Helper: bind timeline click events
  function bindTimelineEvents(timeline) {
    currentTimeline = timeline;
    document.querySelectorAll('.timeline-event').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.eventIdx);
        const ev = timeline[idx];
        if (!ev) return;

        // Highlight selected
        document.querySelectorAll('.timeline-event').forEach(e => e.classList.remove('ring-2', 'ring-accent-green', 'ring-accent-cyan', 'ring-accent-amber', 'ring-accent-purple', 'ring-accent-red', 'ring-accent-blue'));
        el.classList.add('ring-2', `ring-${ev.color}`);

        // Show impact panel
        const panel = document.getElementById('timeline-impact-panel');
        if (panel) {
          panel.innerHTML = renderImpactPanel(ev);
          panel.classList.remove('hidden');

          // Bind close button
          panel.querySelector('.close-impact-panel')?.addEventListener('click', () => {
            panel.classList.add('hidden');
            document.querySelectorAll('.timeline-event').forEach(e => e.classList.remove('ring-2', 'ring-accent-green', 'ring-accent-cyan', 'ring-accent-amber', 'ring-accent-purple', 'ring-accent-red', 'ring-accent-blue'));
          });

          // Smooth scroll into view
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  // Helper: rebuild unified plan with current state
  function rebuildTimeline(snapPatrimoine) {
    const c = getConfig(store);
    const anneeDepart = computeAnneeDepart();
    const planStartYear = c.anneeDepartPlan || anneeDepart || currentYear;
    const timeline = genererTimeline(snapshots, snapPatrimoine || patrimoine, enfants, ageDonateur, currentYear, store, planStartYear);
    currentTimeline = timeline;
    const container = document.getElementById('plan-container');
    const subtitle = document.getElementById('plan-subtitle');
    if (container) {
      container.innerHTML = renderPlanUnifieHTML(timeline, enfants);
      bindConseilApply();
    }
    if (subtitle) {
      subtitle.textContent = `${timeline.length} étapes personnalisées · Début en ${planStartYear}`;
    }
  }

  // Helper to rebind "Appliquer" buttons after rebuilding conseils HTML
  function bindConseilApply() {
    document.querySelectorAll('.conseil-apply').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = getConfig(store);
        if (!c.donations) c.donations = [];
        c.donations.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          enfantId: btn.dataset.enfantId,
          type: btn.dataset.type,
          montant: Number(btn.dataset.montant),
          annee: Number(btn.dataset.annee),
        });
        saveConfig(store, c);
        navigate('fiscalite');
      });
    });
  }

  if (slider) {
    slider.addEventListener('input', () => {
      const year = parseInt(slider.value);
      const idx = Math.max(0, Math.min(snapshots.length - 1, year - currentYear));
      const s = snapshots[idx] || snapshots[0];

      document.getElementById('projection-year-label').textContent = year;
      document.getElementById('proj-patrimoine').textContent = formatCurrency(s.patrimoineNet);
      document.getElementById('proj-immobilier').textContent = formatCurrency(s.immobilier);
      document.getElementById('proj-placements').textContent = formatCurrency(s.placements);
      document.getElementById('proj-epargne').textContent = formatCurrency(s.epargne);
      document.getElementById('proj-cap-epargne').textContent = `Capacité d'épargne : ${formatCurrency((s.capaciteEpargne || 0) * 12)}/an`;
      document.getElementById('proj-age-label').textContent = `À ${s.age} ans (fin ${s.calendarYear})`;

      // Update per-child donation capacities
      const liqEls = document.querySelectorAll('.proj-liq-enfant');
      const exoEls = document.querySelectorAll('.proj-exo-enfant');
      const droitsEls = document.querySelectorAll('.proj-droits-enfant');
      const liquidites = s.patrimoineNet - (s.immobilier || 0);
      const partParEnfant = nbEnfants > 0 ? Math.round(liquidites / nbEnfants) : 0;
      const abattMax = ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA;
      const donnableExonere = Math.min(partParEnfant, abattMax);

      liqEls.forEach(el => el.textContent = formatCurrency(partParEnfant));
      exoEls.forEach(el => el.textContent = formatCurrency(donnableExonere));
      droitsEls.forEach(el => el.textContent = formatCurrency(calculerDroitsDonation(Math.max(0, partParEnfant - ABATTEMENT_PARENT_ENFANT))));

      // Update nue-propriété if present
      const npVal = document.getElementById('proj-np-val');
      const npEnf = document.getElementById('proj-np-enfant');
      if (npVal) {
        const immo = s.immobilier || 0;
        const rate = getUsufruitRate(s.age);
        npVal.textContent = formatCurrency(Math.round(immo * rate.nuePropriete));
        if (npEnf) npEnf.textContent = formatCurrency(Math.round(immo * rate.nuePropriete / Math.max(1, nbEnfants)));
      }

      // Build synthetic patrimoine for this snapshot
      const snapPatrimoine = {
        ...patrimoine,
        immobilier: s.immobilier || 0,
        placements: (s.placements || 0),
        patrimoineNet: s.patrimoineNet || 0,
        patrimoineHorsAV: (s.patrimoineNet || 0) - patrimoine.assuranceVie,
      };

      // Rebuild impact section with patrimoine at selected year
      const impactContainer = document.getElementById('impact-container');
      const impactSubtitle = document.getElementById('impact-subtitle');
      if (impactContainer && nbEnfants > 0) {
        const avParEnfant = snapPatrimoine.assuranceVie ? snapPatrimoine.assuranceVie / nbEnfants : 0;
        const snapSuccSansdon = calculerSuccessionParEnfant(snapPatrimoine.patrimoineHorsAV, nbEnfants, avParEnfant);
        const snapTotalSansdon = (snapSuccSansdon.droits + snapSuccSansdon.avDroits) * nbEnfants;

        let snapTotalDroitsDonation = 0;
        let snapTotalDonne = 0;
        for (const enf of enfants) {
          const dons = (cfg.donations || []).filter(d => d.enfantId === enf.id).sort((a, b) => a.annee - b.annee);
          const results = simulerDonations(enf, dons, ageDonateur);
          snapTotalDonne += results.reduce((sum, r) => sum + r.exonere + r.taxable, 0);
          snapTotalDroitsDonation += results.reduce((sum, r) => sum + r.droits, 0);
        }

        const snapResiduelHorsAV = Math.max(0, snapPatrimoine.patrimoineHorsAV - snapTotalDonne);
        const snapSuccAvecdon = calculerSuccessionParEnfant(snapResiduelHorsAV, nbEnfants, avParEnfant);
        const snapTotalSuccResiduelle = (snapSuccAvecdon.droits + snapSuccAvecdon.avDroits) * nbEnfants;
        const snapTotalAvecdon = snapTotalDroitsDonation + snapTotalSuccResiduelle;
        const snapEconomie = snapTotalSansdon - snapTotalAvecdon;

        impactContainer.innerHTML = renderImpactHTML(
          snapTotalSansdon, snapSuccSansdon, snapTotalAvecdon,
          snapTotalDonne, snapTotalDroitsDonation, snapResiduelHorsAV,
          snapTotalSuccResiduelle, snapEconomie, snapPatrimoine
        );
        if (impactSubtitle) impactSubtitle.textContent = `Basé sur votre patrimoine en ${s.calendarYear} (${s.age} ans)`;
      }

      // Rebuild timeline with updated patrimoine
      rebuildTimeline(snapPatrimoine);
    });

    // Save selected year on change
    slider.addEventListener('change', () => {
      const c = getConfig(store);
      c.selectedProjectionYear = parseInt(slider.value);
      saveConfig(store, c);
    });
  }

  // --- Début du plan (année de départ) ---
  const anneeDepartInput = document.getElementById('annee-depart-input');
  if (anneeDepartInput) {
    anneeDepartInput.addEventListener('change', () => {
      const val = parseInt(anneeDepartInput.value);
      if (!isNaN(val)) {
        const c = getConfig(store);
        c.anneeDepartPlan = val;
        saveConfig(store, c);
        navigate('fiscalite');
      }
    });
  }

  // --- Navigate to enfants page ---
  document.getElementById('btn-go-enfants')?.addEventListener('click', () => {
    navigate('enfants');
  });

  // --- Initial plan binding ---
  {
    const anneeDepart = computeAnneeDepart();
    const planStartYear = cfg.anneeDepartPlan || anneeDepart || currentYear;
    const timeline = genererTimeline(snapshots, patrimoine, enfants, ageDonateur, currentYear, store, planStartYear);
    currentTimeline = timeline;
  }

  // --- Ajouter donation (shared handler) ---
  function openAddDonationModal() {
    if (enfants.length === 0) return;
    const enfantOptions = enfants.map(e => ({ value: e.id, label: e.prenom || 'Sans nom' }));
    const typeOptions = [
      { value: 'don_manuel', label: 'Don manuel (argent)' },
      { value: 'don_tepa', label: 'Don familial TEPA (< 80 ans)' },
      { value: 'donation_nue_propriete', label: 'Nue-propriété (immobilier)' },
      { value: 'donation_cto', label: 'Donation CTO (titres)' },
    ];
    openModal('Enregistrer une donation', `
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
  }
  document.getElementById('btn-add-donation')?.addEventListener('click', openAddDonationModal);
  document.getElementById('btn-add-donation-top')?.addEventListener('click', openAddDonationModal);

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

  // --- Appliquer un conseil (bind initial + rebind dynamique via slider) ---
  bindConseilApply();

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
