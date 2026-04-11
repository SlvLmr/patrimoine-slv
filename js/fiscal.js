/**
 * Fiscal calculations for donations (French tax law)
 */

// Barème progressif droits de donation en ligne directe (article 777 CGI)
const TRANCHES = [
  { limit: 8072, rate: 0.05 },
  { limit: 12109, rate: 0.10 },
  { limit: 15932, rate: 0.15 },
  { limit: 552324, rate: 0.20 },
  { limit: 902838, rate: 0.30 },
  { limit: 1805677, rate: 0.40 },
  { limit: Infinity, rate: 0.45 }
];

// Barème fiscal démembrement (article 669 CGI)
// nue-propriété en fonction de l'âge de l'usufruitier (donateur)
const DEMEMBREMENT = [
  { maxAge: 20, np: 0.10 },
  { maxAge: 30, np: 0.20 },
  { maxAge: 40, np: 0.30 },
  { maxAge: 50, np: 0.40 },
  { maxAge: 60, np: 0.50 },
  { maxAge: 70, np: 0.60 },
  { maxAge: 80, np: 0.70 },
  { maxAge: 90, np: 0.80 },
  { maxAge: Infinity, np: 0.90 }
];

export const ABATTEMENT_100K = 100000;
export const DON_SARKOZY_MAX = 31865;
export const RENOUVELLEMENT_ANS = 15;
export const PFU = 0.314;

// AV succession
export const AV_ABAT_AVANT_70 = 152500; // per beneficiary
export const AV_TAUX_1 = 0.20;          // up to 700k after abattement
export const AV_SEUIL_1 = 700000;
export const AV_TAUX_2 = 0.3145;        // above 700k
export const AV_PRIMES_APRES_70_ABAT = 30500; // all beneficiaries combined

/**
 * Calculate progressive donation tax (ligne directe)
 */
export function calculerDroitsBareme(montantTaxable) {
  if (montantTaxable <= 0) return 0;
  let droits = 0;
  let prev = 0;
  for (const t of TRANCHES) {
    const tranche = Math.min(montantTaxable, t.limit) - prev;
    if (tranche <= 0) break;
    droits += tranche * t.rate;
    prev = t.limit;
  }
  return Math.round(droits);
}

/**
 * Get nue-propriété percentage based on donor age
 */
export function valeurNuePropriete(ageDonateur) {
  for (const d of DEMEMBREMENT) {
    if (ageDonateur <= d.maxAge) return d.np;
  }
  return 0.90;
}

/**
 * Calculate available abattement 100k for a beneficiary at a given year
 * Takes into account 15-year renewal
 */
export function abattementDisponible(beneficiaire, annee, historique) {
  const hist = (historique[beneficiaire] || {}).abattement100k || [];
  let used = 0;
  for (const h of hist) {
    if (annee - h.annee < RENOUVELLEMENT_ANS) {
      used += h.montant;
    }
  }
  return Math.max(0, ABATTEMENT_100K - used);
}

/**
 * Calculate available Don Sarkozy for a beneficiary
 * Donor must be < 80, beneficiary must be 18+
 */
export function sarkozyDisponible(beneficiaire, annee, ageDonateur, historique) {
  if (ageDonateur >= 80) return 0;
  const hist = (historique[beneficiaire] || {}).sarkozy || [];
  let used = 0;
  for (const h of hist) {
    if (annee - h.annee < RENOUVELLEMENT_ANS) {
      used += h.montant;
    }
  }
  return Math.max(0, DON_SARKOZY_MAX - used);
}

/**
 * Record a donation in the tracking history
 */
export function enregistrerDonation(historique, beneficiaire, annee, abattementUtilise, sarkozyUtilise) {
  if (!historique[beneficiaire]) historique[beneficiaire] = { abattement100k: [], sarkozy: [] };
  if (abattementUtilise > 0) {
    historique[beneficiaire].abattement100k.push({ annee, montant: abattementUtilise });
  }
  if (sarkozyUtilise > 0) {
    historique[beneficiaire].sarkozy.push({ annee, montant: sarkozyUtilise });
  }
}

/**
 * Calculate full fiscal impact of a donation movement
 * @param {Object} mvt - The movement object
 * @param {number} ageDonateur - Donor's age at time of donation
 * @param {number} annee - Calendar year
 * @param {Object} historique - Donation tracking history (mutated)
 * @returns {Object} Fiscal details
 */
export function calculerFiscaliteDonation(mvt, ageDonateur, annee, historique) {
  const montant = Math.abs(mvt.montant);
  const beneficiaire = mvt.beneficiaire || 'default';

  const result = {
    montantBrut: montant,
    assietteFiscale: montant,
    abattement100k: 0,
    donSarkozy: 0,
    montantTaxable: 0,
    droits: 0,
    pvPurgee: 0,
    economiePV: 0,
    valeurNP: null
  };

  switch (mvt.donationType) {
    case 'abattement_100k': {
      const dispo = abattementDisponible(beneficiaire, annee, historique);
      result.abattement100k = Math.min(montant, dispo);
      result.montantTaxable = Math.max(0, montant - result.abattement100k);
      result.droits = calculerDroitsBareme(result.montantTaxable);
      enregistrerDonation(historique, beneficiaire, annee, result.abattement100k, 0);
      break;
    }

    case 'don_sarkozy': {
      // Cumulates abattement 100k + don Sarkozy 31,865€
      const dispoAb = abattementDisponible(beneficiaire, annee, historique);
      const dispoSk = sarkozyDisponible(beneficiaire, annee, ageDonateur, historique);
      result.abattement100k = Math.min(montant, dispoAb);
      const restant = Math.max(0, montant - result.abattement100k);
      result.donSarkozy = Math.min(restant, dispoSk);
      result.montantTaxable = Math.max(0, montant - result.abattement100k - result.donSarkozy);
      result.droits = calculerDroitsBareme(result.montantTaxable);
      enregistrerDonation(historique, beneficiaire, annee, result.abattement100k, result.donSarkozy);
      break;
    }

    case 'demembrement': {
      // Donation en nue-propriété : assiette fiscale réduite selon âge
      const np = valeurNuePropriete(ageDonateur);
      result.valeurNP = np;
      result.assietteFiscale = Math.round(montant * np);
      const dispo = abattementDisponible(beneficiaire, annee, historique);
      result.abattement100k = Math.min(result.assietteFiscale, dispo);
      result.montantTaxable = Math.max(0, result.assietteFiscale - result.abattement100k);
      result.droits = calculerDroitsBareme(result.montantTaxable);
      enregistrerDonation(historique, beneficiaire, annee, result.abattement100k, 0);
      break;
    }

    case 'purge_pv_cto': {
      // Don de titres CTO : purge de la plus-value latente
      const pvRatio = mvt.pvRatio || 0; // ratio PV/valeur (0 to 1)
      result.pvPurgee = Math.round(montant * pvRatio);
      result.economiePV = Math.round(result.pvPurgee * PFU);
      const dispo = abattementDisponible(beneficiaire, annee, historique);
      result.abattement100k = Math.min(montant, dispo);
      result.montantTaxable = Math.max(0, montant - result.abattement100k);
      result.droits = calculerDroitsBareme(result.montantTaxable);
      enregistrerDonation(historique, beneficiaire, annee, result.abattement100k, 0);
      break;
    }

    case 'donation_av': {
      // Assurance Vie — régime dépend de l'âge du donateur
      if (ageDonateur < 70) {
        // Primes avant 70 ans : abattement 152,500€/bénéficiaire, puis 20%/31.45%
        const abat = AV_ABAT_AVANT_70;
        result.abattement100k = Math.min(montant, abat);
        const apresAbat = Math.max(0, montant - abat);
        if (apresAbat <= AV_SEUIL_1) {
          result.droits = Math.round(apresAbat * AV_TAUX_1);
        } else {
          result.droits = Math.round(AV_SEUIL_1 * AV_TAUX_1 + (apresAbat - AV_SEUIL_1) * AV_TAUX_2);
        }
      } else {
        // Primes après 70 ans : 30,500€ abattement global, puis barème classique
        result.abattement100k = Math.min(montant, AV_PRIMES_APRES_70_ABAT);
        result.montantTaxable = Math.max(0, montant - AV_PRIMES_APRES_70_ABAT);
        result.droits = calculerDroitsBareme(result.montantTaxable);
      }
      // AV donations don't consume the 100k abattement
      break;
    }
  }

  return result;
}
