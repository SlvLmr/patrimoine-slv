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

  // --- CONSEIL 1 : Don manuel + TEPA pour utiliser l'abattement ---
  const enfantsSansAbatt = enfants.filter(e => (donParEnfant[e.id]?.totalDonne || 0) < ABATTEMENT_PARENT_ENFANT);
  if (enfantsSansAbatt.length > 0 && liquidites > 50000) {
    const montantParEnfant = Math.min(ABATTEMENT_PARENT_ENFANT, Math.floor(liquidites / nbEnfants));
    const totalExonere = montantParEnfant * enfantsSansAbatt.length;
    const droitsSiSuccession = enfantsSansAbatt.length * calculerDroitsDonation(Math.max(0, montantParEnfant));
    // Pas de droits si dans l'abattement → l'économie c'est les droits qu'ils auraient payés sur cette tranche en succession
    const economie = enfantsSansAbatt.length * calculerDroitsDonation(montantParEnfant);

    if (economie > 0) {
      conseils.push({
        priorite: 1,
        icon: '💰',
        titre: `Don manuel de ${formatCurrency(montantParEnfant)} par enfant`,
        description: `Donnez ${formatCurrency(montantParEnfant)} à ${enfantsSansAbatt.map(e => e.prenom).join(', ')} en utilisant l'abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}. Chaque enfant recevra cette somme sans payer aucun droit.`,
        economie,
        action: `${formatCurrency(totalExonere)} transmis à 0 € de droits`,
        detail: `Abattement art. 779 CGI : ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} par parent par enfant, renouvelable tous les ${RENOUVELLEMENT_ANNEES} ans.`,
        suggestions: enfantsSansAbatt.map(e => ({
          enfantId: e.id,
          type: 'don_manuel',
          montant: montantParEnfant,
          annee: yearSnap
        }))
      });
    }
  }

  // --- CONSEIL 2 : Don TEPA (Sarkozy) ---
  if (ageSnap < AGE_MAX_DONATEUR_TEPA) {
    const enfantsSansTepa = enfants.filter(e => !donParEnfant[e.id]?.hasTepa);
    if (enfantsSansTepa.length > 0) {
      const totalTepa = DON_FAMILIAL_TEPA * enfantsSansTepa.length;
      const anneeLimit = currentYear + (AGE_MAX_DONATEUR_TEPA - ageDonateur);

      conseils.push({
        priorite: 2,
        icon: '🎁',
        titre: `Don familial TEPA : ${formatCurrency(DON_FAMILIAL_TEPA)} par enfant`,
        description: `En plus de l'abattement classique, vous pouvez donner ${formatCurrency(DON_FAMILIAL_TEPA)} supplémentaires à chaque enfant en espèces, totalement exonérés. Vous avez jusqu'à vos 80 ans (${anneeLimit}).`,
        economie: enfantsSansTepa.length * calculerDroitsDonation(DON_FAMILIAL_TEPA),
        action: `${formatCurrency(totalTepa)} supplémentaires exonérés`,
        detail: `Art. 790 G CGI (loi TEPA 2007). Conditions : donateur < 80 ans, donataire majeur, somme d'argent. Cumulable avec l'abattement de ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}.`,
        suggestions: enfantsSansTepa.map(e => ({
          enfantId: e.id,
          type: 'don_tepa',
          montant: DON_FAMILIAL_TEPA,
          annee: yearSnap
        }))
      });
    }
  }

  // --- CONSEIL 3 : Donation nue-propriété immobilière ---
  if (patrimoine.immobilier > 0) {
    const enfantsSansNP = enfants.filter(e => !donParEnfant[e.id]?.hasNP);
    if (enfantsSansNP.length > 0) {
      const rate = getUsufruitRate(ageSnap);
      const valeurNP = Math.round(patrimoine.immobilier * rate.nuePropriete);
      const valeurNPParEnfant = Math.round(valeurNP / nbEnfants);
      const taxableParEnfant = Math.max(0, valeurNPParEnfant - ABATTEMENT_PARENT_ENFANT);
      const droitsNP = calculerDroitsDonation(taxableParEnfant) * nbEnfants;
      // Si on attend le décès, les enfants paient sur la pleine propriété
      const droitsSucc = calculerDroitsDonation(Math.max(0, patrimoine.immobilier / nbEnfants - ABATTEMENT_PARENT_ENFANT)) * nbEnfants;
      const economie = droitsSucc - droitsNP;

      if (economie > 0) {
        // Trouver l'âge optimal (quand NP par enfant = abattement)
        let ageOptimal = null;
        for (const tranche of BAREME_USUFRUIT) {
          const npTest = Math.round(patrimoine.immobilier * tranche.nuePropriete / nbEnfants);
          if (npTest <= ABATTEMENT_PARENT_ENFANT) { ageOptimal = tranche.ageMax === 20 ? 20 : tranche.ageMax; break; }
        }

        conseils.push({
          priorite: 1,
          icon: '🏠',
          titre: `Donation en nue-propriété (${(rate.nuePropriete * 100).toFixed(0)}% à ${ageSnap} ans)`,
          description: `Donnez la nue-propriété de votre immobilier (${formatCurrency(patrimoine.immobilier)}) tout en conservant l'usufruit (vous continuez à habiter/percevoir les loyers). La base taxable n'est que de ${formatCurrency(valeurNP)} au lieu de ${formatCurrency(patrimoine.immobilier)}.${ageOptimal && ageSnap <= ageOptimal ? ` À ${ageOptimal} ans ou avant, la NP par enfant (${formatCurrency(valeurNPParEnfant)}) passe dans l'abattement = 0 € de droits.` : ''}`,
          economie,
          action: `${formatCurrency(patrimoine.immobilier)} transmis, base taxable réduite à ${formatCurrency(valeurNP)}`,
          detail: `Art. 669 CGI. À votre décès, l'usufruit s'éteint automatiquement et vos enfants deviennent pleins propriétaires sans droits supplémentaires. Plus vous donnez jeune, plus la nue-propriété est faible.`,
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

  // --- CONSEIL 4 : Donation CTO (purge PV) ---
  if (patrimoine.cto > 0) {
    const enfantsSansCTO = enfants.filter(e => !donParEnfant[e.id]?.hasCTO);
    if (enfantsSansCTO.length > 0) {
      const ctoParEnfant = Math.round(patrimoine.cto / nbEnfants);
      const taxableParEnfant = Math.max(0, ctoParEnfant - ABATTEMENT_PARENT_ENFANT);
      const droitsDonation = calculerDroitsDonation(taxableParEnfant) * nbEnfants;
      // Hypothèse : 30% de PV latente, flat tax 30%
      const pvEstimee = patrimoine.cto * 0.30;
      const flatTaxEvitee = Math.round(pvEstimee * 0.30);

      conseils.push({
        priorite: 2,
        icon: '📈',
        titre: `Donation CTO : purger ${formatCurrency(pvEstimee)} de plus-values`,
        description: `En donnant vos titres CTO (${formatCurrency(patrimoine.cto)}), les plus-values latentes sont purgées. Vos enfants repartent avec un nouveau prix de revient = valeur au jour de la donation. Économie estimée de flat tax : ${formatCurrency(flatTaxEvitee)}.`,
        economie: flatTaxEvitee,
        action: `PV purgées + base dans l'abattement si ≤ ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}/enfant`,
        detail: `La donation de titres purge les plus-values latentes (le donataire reçoit les titres avec un nouveau PRU au cours du jour). Si le CTO par enfant est ≤ ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}, aucun droit de donation non plus.`,
        suggestions: enfantsSansCTO.map(e => ({
          enfantId: e.id,
          type: 'donation_cto',
          montant: ctoParEnfant,
          annee: yearSnap
        }))
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

  // --- CONSEIL 7 : Stratégie d'investissement PEA → CTO vs AV ---
  const allPlacements = state.actifs?.placements || [];
  const peaPlacements = allPlacements.filter(p => (p.enveloppe || '').toUpperCase().startsWith('PEA') && (p.enveloppe || '').toUpperCase() !== 'PEE');
  const peaApports = peaPlacements.reduce((s, p) => s + (Number(p.pru || 0) * Number(p.quantite || 0)), 0);
  const PLAFOND_PEA = 150000;
  const peaRestant = Math.max(0, PLAFOND_PEA - peaApports);
  const dcaMensuelTotal = allPlacements.reduce((s, p) => s + (Number(p.dcaMensuel) || 0), 0);

  if (peaRestant < 20000 && dcaMensuelTotal > 0) {
    // PEA quasi plein ou plein → conseiller sur la réorientation
    const avParEnfant = patrimoine.assuranceVie / Math.max(1, nbEnfants);
    const avManqueParEnfant = Math.max(0, AV_ABATTEMENT_PAR_BENEFICIAIRE - avParEnfant);
    const avManqueTotal = avManqueParEnfant * nbEnfants;
    const peePlein = peaRestant <= 0;

    if (avManqueTotal > 10000 && ageSnap < 70) {
      // Recommander AV en priorité pour l'avantage successoral
      const mensuelRecommande = Math.min(dcaMensuelTotal, Math.ceil(avManqueTotal / ((70 - ageDonateur) * 12)));
      conseils.push({
        priorite: 2,
        icon: '🔄',
        type: 'investissement',
        titre: `${peePlein ? 'PEA plein' : 'PEA bientôt plein'} : basculez ${formatCurrency(mensuelRecommande)}/mois vers l'AV`,
        description: `Votre PEA ${peePlein ? 'a atteint' : 'approche de'} son plafond de ${formatCurrency(PLAFOND_PEA)}${peePlein ? '' : ` (reste ${formatCurrency(peaRestant)})`}. Il manque ${formatCurrency(avManqueParEnfant)} d'AV par enfant pour atteindre l'abattement de ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}. En plaçant ${formatCurrency(mensuelRecommande)}/mois en AV, vous maximisez l'avantage fiscal à la transmission.`,
        economie: Math.round(avManqueTotal * 0.20),
        action: `AV avant CTO : ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/enfant exonéré vs 0 € sur CTO`,
        detail: `Ordre de priorité recommandé : 1) PEA (17.2% après 5 ans, plafond ${formatCurrency(PLAFOND_PEA)}) → 2) AV (abattement ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/bénéficiaire au décès, fiscalité réduite après 8 ans) → 3) CTO (flat tax 30%, mais donation possible pour purger les PV). L'AV est préférable au CTO tant que l'abattement successoral n'est pas maximisé.`,
        suggestions: []
      });
    } else if (peePlein) {
      // AV déjà maximisée ou donateur > 70 → CTO avec stratégie de donation
      conseils.push({
        priorite: 3,
        icon: '🔄',
        type: 'investissement',
        titre: `PEA plein${avManqueTotal <= 10000 ? ', AV optimisée' : ''} : orientez vers le CTO`,
        description: `${avManqueTotal <= 10000 ? 'Votre AV couvre déjà l\'abattement de vos bénéficiaires. ' : ''}Continuez sur le CTO : pas de plafond, et vous pourrez donner les titres à vos enfants pour purger les plus-values (économie de flat tax 30%). Planifiez une donation CTO tous les 15 ans dans la limite de l'abattement.`,
        economie: 0,
        action: `CTO + donation périodique = croissance + optimisation fiscale`,
        detail: `Le CTO a une fiscalité moins avantageuse (flat tax 30%) mais offre une flexibilité totale. La stratégie : accumuler sur CTO, puis donner les titres aux enfants dans la limite de l'abattement → purge des PV + transmission exonérée.`,
        suggestions: []
      });
    }
  } else if (peaRestant > 0 && dcaMensuelTotal > 0) {
    // PEA pas encore plein → rappeler de prioriser le PEA
    const moisRestants = Math.ceil(peaRestant / dcaMensuelTotal);
    const avParEnfant = patrimoine.assuranceVie / Math.max(1, nbEnfants);
    conseils.push({
      priorite: 3,
      icon: '📊',
      type: 'investissement',
      titre: `Continuez de remplir le PEA (encore ${formatCurrency(peaRestant)})`,
      description: `Le PEA reste l'enveloppe la plus avantageuse (17.2% après 5 ans vs 30% flat tax). Au rythme actuel (${formatCurrency(dcaMensuelTotal)}/mois), plafond atteint dans ~${moisRestants} mois. Ensuite, privilégiez l'AV pour l'abattement successoral (${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}/enfant).`,
      economie: 0,
      action: `PEA → AV → CTO : l'ordre optimal`,
      detail: `1) PEA : gains exonérés d'IR après 5 ans (PS 17.2% seulement). 2) AV : ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} exonérés par bénéficiaire au décès + fiscalité réduite après 8 ans. 3) CTO : aucun plafond, flat tax 30%, mais donation aux enfants purge les PV.`,
      suggestions: []
    });
  }

  // --- CONSEIL GLOBAL : résumé du plan optimal ---
  const totalEcoConseils = conseils.reduce((s, c) => s + c.economie, 0);
  if (conseils.length > 1) {
    conseils.unshift({
      priorite: 0,
      icon: '🎯',
      titre: `Plan optimal : économisez jusqu'à ${formatCurrency(totalEcoConseils)}`,
      description: `En combinant toutes ces stratégies, vous pourriez réduire la facture fiscale de vos enfants de ${formatCurrency(totalEcoConseils)} par rapport à une succession sans préparation. Voici le détail ci-dessous.`,
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
  const epargneTotal = (state.actifs?.epargne || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const ccTotal = (state.actifs?.comptesCourants || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const liquiditesTotal = ctoTotal + epargneTotal + ccTotal;

  // Construire la recommandation concrète cycle 1
  function buildDonationPlan(montantTotal, label) {
    const lines = [];
    let reste = montantTotal;

    // 1) TEPA en espèces (virement)
    const tepaTotal = DON_FAMILIAL_TEPA * nbEnfants;
    if (reste > 0 && tepaTotal > 0) {
      const tepa = Math.min(tepaTotal, reste);
      lines.push(`Virement de ${formatCurrency(tepa)} (don TEPA, ${formatCurrency(DON_FAMILIAL_TEPA)}/enfant, art. 790 G)`);
      reste -= tepa;
    }

    // 2) Donation CTO (purge des plus-values)
    if (reste > 0 && ctoTotal > 0) {
      const donCTO = Math.min(ctoTotal, reste);
      lines.push(`Donation de ${formatCurrency(donCTO)} via le CTO (purge des plus-values à 0 % de droits)`);
      reste -= donCTO;
    }

    // 3) Reste en espèces (livrets, comptes courants)
    if (reste > 0) {
      lines.push(`Virement de ${formatCurrency(reste)} en espèces (abattement ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}/enfant)`);
      reste = 0;
    }

    return lines.join(' + ');
  }

  // 1. Premier cycle de donations
  const cycle1Plan = buildDonationPlan(abattTotal, '1er cycle');
  events.push({
    age: startAge,
    annee: startYear,
    icon: '🎯',
    color: 'accent-green',
    type: 'donation_cycle',
    titre: `Donner ${formatCurrency(abattTotal)} à 0 € de droits`,
    description: cycle1Plan,
    impactParEnfant: enfants.map(enf => ({
      prenom: enf.prenom,
      id: enf.id,
      montantRecu: montantParEnfantCycle1,
      droitsAvant: avantCycle1.droits,
      droitsApres: apresCycle1.droits,
      economie: avantCycle1.droits - apresCycle1.droits,
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
        impactParEnfant: enfants.map(enf => ({
          prenom: enf.prenom, id: enf.id,
          montantRecu: 0,
          detail: avManque > 0 ? `Objectif AV : ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)} exonérés au décès (art. 990 I)` : `CTO : donnable aux enfants (purge des PV)`,
        }))
      });
    }
  }

  // 3. Nue-propriété immobilière — conseil direct
  if (startPatrimoine.immobilier > 0) {
    let bestAge = null;
    for (const t of BAREME_USUFRUIT) {
      const npParEnfant = Math.round(startPatrimoine.immobilier * t.nuePropriete / nbEnfants);
      if (npParEnfant <= ABATTEMENT_PARENT_ENFANT) {
        bestAge = t.ageMax === 20 ? 20 : (BAREME_USUFRUIT.indexOf(t) === 0 ? 20 : BAREME_USUFRUIT[BAREME_USUFRUIT.indexOf(t) - 1].ageMax + 1);
        break;
      }
    }
    if (bestAge && bestAge >= ageDonateur) {
      const rate = getUsufruitRate(bestAge);
      const npTotal = Math.round(startPatrimoine.immobilier * rate.nuePropriete);
      const npParEnfant = Math.round(npTotal / nbEnfants);
      const taxableNP = Math.max(0, npParEnfant - ABATTEMENT_PARENT_ENFANT);
      const droitsNPParEnfant = calculerDroitsDonation(taxableNP);
      const droitsSuccImmoParEnfant = calculerDroitsDonation(Math.max(0, startPatrimoine.immobilier / nbEnfants - ABATTEMENT_PARENT_ENFANT));
      const zeroDrops = taxableNP === 0;
      events.push({
        age: bestAge,
        annee: currentYear + (bestAge - ageDonateur),
        icon: '🏠',
        color: 'accent-amber',
        type: 'nue_propriete',
        titre: `Donation de ${formatCurrency(npTotal)} en nue-propriété`,
        description: zeroDrops
          ? `Donnez la nue-propriété de vos biens immobiliers (${formatCurrency(startPatrimoine.immobilier)}) à vos enfants. Valeur fiscale NP = ${(rate.nuePropriete * 100).toFixed(0)}% = ${formatCurrency(npParEnfant)}/enfant → dans l'abattement = 0 € de droits. Vous gardez l'usufruit (habiter/louer).`
          : `Donnez la nue-propriété de vos biens immobiliers (${formatCurrency(startPatrimoine.immobilier)}). NP = ${(rate.nuePropriete * 100).toFixed(0)}% = ${formatCurrency(npParEnfant)}/enfant. Droits : ${formatCurrency(droitsNPParEnfant)}/enfant au lieu de ${formatCurrency(droitsSuccImmoParEnfant)} à la succession.`,
        impactParEnfant: enfants.map(enf => ({
          prenom: enf.prenom, id: enf.id,
          montantRecu: npParEnfant,
          droitsAvant: droitsSuccImmoParEnfant,
          droitsApres: droitsNPParEnfant,
          economie: droitsSuccImmoParEnfant - droitsNPParEnfant,
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
    const montantCycle2 = canTepa ? montantParEnfantCycle1 : ABATTEMENT_PARENT_ENFANT;
    const totalCycle2 = montantCycle2 * nbEnfants;
    events.push({
      age: age2,
      annee: cycle2Year,
      icon: '🔄',
      color: 'accent-cyan',
      type: 'donation_cycle',
      titre: `Re-donner ${formatCurrency(totalCycle2)} à 0 € de droits`,
      description: `Abattements reconstitués (15 ans écoulés). Donnez ${formatCurrency(montantCycle2)}/enfant${canTepa ? ` (${formatCurrency(ABATTEMENT_PARENT_ENFANT)} abattement + ${formatCurrency(DON_FAMILIAL_TEPA)} TEPA)` : ` (abattement seul, TEPA perdu après 80 ans)`}. Patrimoine projeté : ${formatCurrency(cycle2Snap.patrimoineNet || 0)}.`,
      impactParEnfant: enfants.map(enf => ({
        prenom: enf.prenom, id: enf.id,
        montantRecu: montantCycle2,
        droitsAvant: calculerDroitsDonation(montantCycle2),
        droitsApres: 0,
        economie: calculerDroitsDonation(montantCycle2),
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
      impactParEnfant: enfants.map(enf => ({
        prenom: enf.prenom, id: enf.id,
        montantRecu: DON_FAMILIAL_TEPA,
        droitsAvant: calculerDroitsDonation(DON_FAMILIAL_TEPA),
        droitsApres: 0,
        economie: calculerDroitsDonation(DON_FAMILIAL_TEPA),
      }))
    });
  }

  // 7. 3ème cycle (30 ans après le 1er)
  const age3 = startAge + 2 * RENOUVELLEMENT_ANNEES;
  if (age3 < 90) {
    const cycle3Year = startYear + 2 * RENOUVELLEMENT_ANNEES;
    const canTepa3 = age3 < AGE_MAX_DONATEUR_TEPA;
    const montantCycle3 = canTepa3 ? montantParEnfantCycle1 : ABATTEMENT_PARENT_ENFANT;
    const totalCycle3 = montantCycle3 * nbEnfants;
    events.push({
      age: age3,
      annee: cycle3Year,
      icon: '🔄',
      color: 'accent-cyan',
      type: 'donation_cycle',
      titre: `Re-donner ${formatCurrency(totalCycle3)} à 0 € de droits`,
      description: `Abattements reconstitués (30 ans depuis le 1er cycle). Donnez ${formatCurrency(montantCycle3)}/enfant${canTepa3 ? '' : ' (TEPA indisponible après 80 ans)'}.`,
      impactParEnfant: enfants.map(enf => ({
        prenom: enf.prenom, id: enf.id,
        montantRecu: montantCycle3,
        droitsAvant: calculerDroitsDonation(montantCycle3),
        droitsApres: 0,
        economie: calculerDroitsDonation(montantCycle3),
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
    const borderColor = c.type === 'investissement' ? 'border-accent-blue' : 'border-accent-amber';
    const stepColor = c.type === 'investissement' ? 'bg-accent-blue text-dark-900' : 'bg-accent-amber text-dark-900';
    return `
    <details class="group rounded-xl overflow-hidden border-l-4 ${borderColor} bg-dark-800/20 hover:bg-dark-800/40 transition">
      <summary class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none [&::-webkit-details-marker]:hidden list-none">
        <div class="w-7 h-7 rounded-lg ${stepColor} flex items-center justify-center text-xs font-black shrink-0">${stepNum}</div>
        <span class="text-base shrink-0">${c.icon}</span>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-bold text-gray-100">${c.titre}</h3>
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

function renderImpactHTML(totalDroitsSansdon, succSansdon, totalFiscaliteAvecdon, totalDonne, totalDroitsDonation, patrimoineResiduelHorsAV, totalDroitsSuccResiduelle, economie, patrimoine) {
  const pctEco = totalDroitsSansdon > 0 ? Math.round(economie / totalDroitsSansdon * 100) : 0;
  return `
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-xl p-4 bg-dark-800/40 border border-accent-red/20 text-center">
        <p class="text-[10px] text-gray-500 mb-2">Si vous ne faites rien</p>
        <p class="text-2xl font-bold text-accent-red">${formatCurrency(totalDroitsSansdon)}</p>
        <p class="text-[10px] text-gray-500 mt-1">de droits de succession</p>
        ${succSansdon ? `<details class="mt-2 text-left">
          <summary class="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400">Détail du calcul</summary>
          <div class="mt-1 text-[10px] text-gray-500 space-y-0.5">
            <p>Chaque enfant hérite de ${formatCurrency(succSansdon.partBrute)}</p>
            <p>Après abattement de ${formatCurrency(succSansdon.abattement)}, il reste ${formatCurrency(succSansdon.taxable)} taxable</p>
            <p>= ${formatCurrency(succSansdon.droits)} de droits par enfant</p>
            ${patrimoine.assuranceVie > 0 ? `<p>+ ${formatCurrency(succSansdon.avDroits)} de droits sur l'AV par enfant</p>` : ''}
          </div>
        </details>` : ''}
      </div>
      <div class="rounded-xl p-4 bg-dark-800/40 border border-accent-green/20 text-center">
        <p class="text-[10px] text-gray-500 mb-2">Avec vos donations</p>
        <p class="text-2xl font-bold text-accent-green">${formatCurrency(totalFiscaliteAvecdon)}</p>
        <p class="text-[10px] text-gray-500 mt-1">total droits à payer</p>
        <details class="mt-2 text-left">
          <summary class="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400">Détail du calcul</summary>
          <div class="mt-1 text-[10px] text-gray-500 space-y-0.5">
            <p>Vous donnez ${formatCurrency(totalDonne)} de votre vivant</p>
            <p>Droits sur ces donations : ${formatCurrency(totalDroitsDonation)}</p>
            <p>Il reste ${formatCurrency(patrimoineResiduelHorsAV)} à la succession</p>
            <p>Droits succession résiduelle : ${formatCurrency(totalDroitsSuccResiduelle)}</p>
          </div>
        </details>
      </div>
      <div class="rounded-xl p-4 ${economie > 0 ? 'bg-gradient-to-br from-accent-cyan/10 to-accent-green/5 border border-accent-cyan/30' : 'bg-dark-800/40 border border-dark-400/20'} text-center">
        <p class="text-[10px] text-gray-500 mb-2">Vos enfants économisent</p>
        <p class="text-2xl font-bold ${economie > 0 ? 'text-accent-cyan' : 'text-gray-500'}">${formatCurrency(economie)}</p>
        <p class="text-[10px] text-gray-500 mt-1">${economie > 0 ? 'en moins de droits' : 'ajoutez des donations ci-dessous'}</p>
        ${totalDroitsSansdon > 0 ? `
        <div class="mt-2 flex items-center gap-2">
          <div class="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
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
            <p class="text-[11px] text-gray-500 text-center mt-1 px-3 leading-snug">${ev.description}</p>
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

  // === CONSEILS PERSONNALISÉS ===
  const conseils = nbEnfants > 0
    ? genererConseils(patrimoine, snap, enfants, cfg.donations || [], ageDonateur, currentYear, store)
    : [];

  // === ANNÉE DE DÉPART DU PLAN ===
  const abattTotalParEnfant = ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA;
  const abattTotalFamille = abattTotalParEnfant * nbEnfants;
  let anneeDepart = null;
  let ageDepart = null;
  if (nbEnfants > 0) {
    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];
      const liq = (s.patrimoineNet || 0) - (s.immobilier || 0);
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
          <h1 class="text-xl font-bold text-gray-100">Simulateur de donations</h1>
          <p class="text-sm text-gray-400 mt-1">Planifiez vos donations pour optimiser la transmission à vos enfants</p>
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
      ` : ''}

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
            <svg class="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            <div>
              <h3 class="text-xs font-bold text-gray-200">Impact de vos donations</h3>
              <p class="text-[10px] text-gray-500" id="impact-subtitle">Basé sur votre patrimoine en ${snap?.calendarYear || currentYear} (${snap?.age || ageDonateur} ans)</p>
            </div>
          </div>
          <div id="impact-container">
            ${renderImpactHTML(totalDroitsSansdon, succSansdon, totalFiscaliteAvecdon, totalDonne, totalDroitsDonation, patrimoineResiduelHorsAV, totalDroitsSuccResiduelle, economie, patrimoine)}
          </div>
        </div>
        `}
      </div>

      <!-- PLAN D'ACTION RECOMMANDÉ (timeline) — above conseils -->
      ${timeline.length > 0 ? `
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h2 class="text-sm font-bold text-gray-200">Plan d'action recommandé</h2>
          <span class="text-xs text-gray-500 ml-2">Cliquez sur une étape pour voir l'impact</span>
          <div class="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg ${anneeDepart ? 'bg-accent-green/10 border border-accent-green/20' : 'bg-accent-amber/10 border border-accent-amber/20'}">
            <svg class="w-3.5 h-3.5 ${anneeDepart ? 'text-accent-green' : 'text-accent-amber'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <div>
              <p class="text-[10px] text-gray-400 leading-none">Début du plan</p>
              <div class="flex items-center gap-1">
                <input type="number" id="annee-depart-input" min="${currentYear}" max="${currentYear + (params.projectionYears || 30)}" value="${cfg.anneeDepartPlan || anneeDepart || currentYear}"
                  class="w-16 text-sm font-bold ${anneeDepart ? 'text-accent-green' : 'text-accent-amber'} bg-transparent border-none outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
                <span class="text-[10px] text-gray-400" id="annee-depart-age">(${ageDonateur + ((cfg.anneeDepartPlan || anneeDepart || currentYear) - currentYear)} ans)</span>
              </div>
            </div>
          </div>
        </div>
        <div id="timeline-container">
          ${renderTimelineHTML(timeline, ageDonateur)}
        </div>
      </div>
      ` : ''}

      <!-- CONSEILLER FISCAL (mis à jour dynamiquement par le slider) -->
      ${conseils.length > 0 ? `
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-amber/30 to-accent-amber/10 flex items-center justify-center">
            <svg class="w-4 h-4 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-200">Conseiller fiscal & investissement</h2>
            <p class="text-[10px] text-gray-500" id="conseils-subtitle">Recommandations basées sur votre patrimoine en ${snap?.calendarYear || currentYear}</p>
          </div>
        </div>
        <div class="space-y-2" id="conseils-container">
          ${renderConseilsHTML(conseils, enfants)}
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

  // Helper: rebuild timeline with current state
  function rebuildTimeline(snapPatrimoine) {
    const c = getConfig(store);
    const anneeDepart = computeAnneeDepart();
    const planStartYear = c.anneeDepartPlan || anneeDepart || currentYear;
    const timeline = genererTimeline(snapshots, snapPatrimoine || patrimoine, enfants, ageDonateur, currentYear, store, planStartYear);
    const container = document.getElementById('timeline-container');
    if (container) {
      container.innerHTML = renderTimelineHTML(timeline, ageDonateur);
      bindTimelineEvents(timeline);
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

      // Rebuild conseils
      const conseilsContainer = document.getElementById('conseils-container');
      const conseilsSubtitle = document.getElementById('conseils-subtitle');
      if (conseilsContainer && nbEnfants > 0) {
        const newConseils = genererConseils(snapPatrimoine, s, enfants, cfg.donations || [], ageDonateur, currentYear, store);
        conseilsContainer.innerHTML = renderConseilsHTML(newConseils, enfants);
        if (conseilsSubtitle) conseilsSubtitle.textContent = `Recommandations basées sur votre patrimoine en ${s.calendarYear}`;
        bindConseilApply();
      }

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

  // --- Initial timeline binding ---
  {
    const anneeDepart = computeAnneeDepart();
    const planStartYear = cfg.anneeDepartPlan || anneeDepart || currentYear;
    const timeline = genererTimeline(snapshots, patrimoine, enfants, ageDonateur, currentYear, store, planStartYear);
    bindTimelineEvents(timeline);
  }

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
