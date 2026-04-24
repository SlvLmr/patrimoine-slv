const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const currencyFormatterCents = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('fr-FR');

export function formatCurrency(value) {
  return currencyFormatter.format(value);
}

export function formatCurrencyCents(value) {
  return currencyFormatterCents.format(value);
}

export function formatPercent(value) {
  return percentFormatter.format(value);
}

export function formatNumber(value) {
  return numberFormatter.format(value);
}

export function parseNumberInput(str) {
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/\s/g, '').replace(',', '.')) || 0;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR');
}

// Modal helper - dark Finary theme
export function openModal(title, bodyHtml, onConfirm) {
  const existing = document.getElementById('app-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'app-modal';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-dark-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-dark-400/50">
      <div class="p-6 border-b border-dark-400/50 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-100">${title}</h3>
        <button id="modal-close-x" class="text-gray-400 hover:text-gray-100 transition text-2xl leading-none px-1">&times;</button>
      </div>
      <div class="p-6" id="modal-body">
        ${bodyHtml}
      </div>
      <div class="p-4 border-t border-dark-400/50 flex justify-end gap-3">
        <button id="modal-cancel" class="px-4 py-2 text-gray-400 hover:text-gray-200 transition rounded-lg hover:bg-dark-500">Annuler</button>
        <button id="modal-confirm" class="px-5 py-2 bg-gradient-to-r from-accent-green to-accent-blue text-white rounded-lg hover:opacity-90 transition font-medium">Confirmer</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#modal-cancel').addEventListener('click', () => modal.remove());
  modal.querySelector('#modal-close-x').addEventListener('click', () => modal.remove());

  if (onConfirm) {
    const confirmAndClose = () => { onConfirm(); modal.remove(); };
    modal.querySelector('#modal-confirm').addEventListener('click', confirmAndClose);
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirmAndClose(); }
    });
  }

  setTimeout(() => {
    const firstInput = modal.querySelector('input, select');
    if (firstInput) firstInput.focus();
  }, 100);

  return modal;
}

export function closeModal() {
  const modal = document.getElementById('app-modal');
  if (modal) modal.remove();
}

// Group placement items by envelope+category display key
export function getPlacementGroupKey(p) {
  const env = p.enveloppe || 'Autre';
  const cat = p.categorie || '';
  if (env === 'PEA') {
    if (cat.includes('ETF')) return 'PEA ETF';
    if (cat.includes('Action')) return 'PEA Actions';
    return 'PEA Autre';
  }
  if (env === 'AV') return 'Assurance Vie';
  if (env === 'CTO TR') return 'CTO TR';
  if (env === 'CTO BB') return 'CTO BB';
  if (env === 'CTO') {
    const nom = (p.nom || '').toUpperCase();
    if (nom.includes('BB')) return 'CTO BB';
    if (nom.includes('TR')) return 'CTO TR';
    return 'CTO';
  }
  if (env === 'PEE') return 'PEE';
  if (env === 'Livrets') return 'Livrets';
  return env; // PER, Crypto, Autre
}

// Get the applicable DCA for a given year for a placement
function getDcaForYear(placement, year) {
  const baseDca = Number(placement.dcaMensuel) || 0;
  // Stop DCA after end year
  const finAnnee = Number(placement.dcaFinAnnee) || 0;
  if (finAnnee > 0 && year > finAnnee) return 0;

  const overrides = (placement.dcaOverrides || []).sort((a, b) => a.fromYear - b.fromYear);
  if (!overrides.length) return baseDca;

  // Find the most recent override that applies (fromYear <= year)
  let applicable = baseDca;
  for (const ov of overrides) {
    if (ov.fromYear <= year) {
      applicable = Number(ov.dcaMensuel) || 0;
    }
  }
  return applicable;
}

// Projection engine - per-placement simulation with DCA and Air Liquide
// overrides: optional object to override store values for scenario comparisons
//   { rendementPlacements, rendementImmobilier, rendementEpargne, inflation,
//     dcaMultiplier, extraDcaByGroup, extraTransfers, projectionYears }
export function computeProjection(store, overrides = {}) {
  const state = store.getAll();
  const params = state.parametres;
  const years = overrides.projectionYears || params.projectionYears || 30;
  const now = new Date();
  const currentCalendarYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based (0=Jan, 11=Dec)
  const remainingMonths = 12 - currentMonth; // months left including current month
  const inflation = overrides.inflation ?? params.inflationRate ?? 0.02;
  const ageFinAnnee = params.ageFinAnnee || 43;
  const ageRetraite = params.ageRetraite || 64;
  const ageRetraitePEE = ageRetraite;
  const rendImmo = overrides.rendementImmobilier ?? params.rendementImmobilier ?? 0.02;

  const totalImmo = state.actifs.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const totalEpar = state.actifs.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);

  // Weighted average rendement for epargne
  let eparRendTotal = 0, eparWeightTotal = 0;
  state.actifs.epargne.forEach(e => {
    const sol = Number(e.solde) || 0;
    const taux = Number(e.tauxInteret) || 0.02;
    eparRendTotal += taux * sol;
    eparWeightTotal += sol;
  });
  const rendEpar = overrides.rendementEpargne ?? (eparWeightTotal > 0 ? eparRendTotal / eparWeightTotal : 0.02);

  // Actualisations: real values entered by user for past years
  const actualisations = params.actualisations || {};

  // Capital transfers (épargne/héritage → placement)
  const capitalTransfers = params.capitalTransfers || [];

  // Surplus annuel (manually entered yearly surplus → adds to liquidités)
  const surplusAnnuel = state.surplusAnnuel || [];
  const surplusByYear = {};
  surplusAnnuel.forEach(s => { surplusByYear[Number(s.year)] = Number(s.montant) || 0; });

  // Mouvements par année (new system: array of transfers per year)
  const mouvementsParAnnee = state.mouvementsParAnnee || {};

  // Build per-placement simulation state
  const rendementPlacements = params.rendementPlacements || {};
  const cashInjectionsParams = params.cashInjections || {};
  // Per-group rendement overrides from profile (e.g. { 'PEA ETF': 0.10, 'CTO': 0.08, ... })
  const overrideRendGroupes = overrides.rendementGroupes || {};
  const overrideRendPlac = overrides.rendementPlacements; // global fallback override
  const placSims = state.actifs.placements.map(p => {
    const gk = getPlacementGroupKey(p);
    // Determine sub-group for profile matching:
    // PEA Actions = individual stocks in PEA (Air Liquide, Schneider, Legrand, etc.)
    // PEA ETF = ETFs in PEA
    const isPEA = gk.startsWith('PEA');
    const isAction = isPEA && !p.isin?.startsWith?.('IE') && !p.isin?.startsWith?.('LU') && !p.isin?.startsWith?.('FR001') && (p.isAirLiquide || p.quantite > 0);
    const profileGroupKey = isPEA ? (isAction ? 'PEA Actions' : 'PEA ETF') : gk;
    // Priority: per-group profile override > global override > per-placement override > placement's own rendement > fallback
    const defaultRend = params.rendementPlacementsDefaut || 0.05;
    let rend;
    if (overrideRendGroupes[profileGroupKey] !== undefined) {
      rend = overrideRendGroupes[profileGroupKey];
    } else if (overrideRendGroupes[gk] !== undefined) {
      rend = overrideRendGroupes[gk];
    } else if (overrideRendPlac !== undefined) {
      rend = overrideRendPlac;
    } else if (rendementPlacements[p.id] !== undefined) {
      rend = rendementPlacements[p.id];
    } else {
      rend = Number(p.rendement) || defaultRend;
    }
    // Annual fees (frais annuels) reduce the effective rendement
    const fraisAnnuels = Number(p.fraisAnnuels) || 0;
    const fraisRate = fraisAnnuels / 100; // convert percentage to decimal
    const rendAfterFees = rend - fraisRate;
    // Cash injections: placement-level (actifs) takes priority, fallback to parametres
    const placInj = p.cashInjections || [];
    const paramInj = cashInjectionsParams[p.id] || [];
    const mergedInj = placInj.length > 0 ? placInj : paramInj;
    // Use valeur if set, otherwise fall back to apport as starting capital
    const initialValue = (Number(p.valeur) || 0) || (Number(p.apport) || 0);
    // Compute envelope age in years at simulation start
    const enveloppe = p.enveloppe || p.type || '';
    const dateOuv = p.dateOuverture ? new Date(p.dateOuverture) : null;
    const envelopeAgeAtStart = dateOuv ? (now - dateOuv) / (365.25 * 24 * 3600 * 1000) : 0;
    return {
    groupKey: gk,
    id: p.id,
    nom: p.nom || '',
    value: initialValue,
    apportInitial: Number(p.apport) || initialValue, // real money invested (for PEA ceiling)
    rendement: rendAfterFees,
    rendementBrut: rend,
    fraisRate: fraisRate,
    enveloppe,
    envelopeAgeAtStart,
    dcaMensuel: Number(p.dcaMensuel) || 0,
    dcaOverrides: (p.dcaOverrides || []).sort((a, b) => a.fromYear - b.fromYear),
    cashInjections: mergedInj.sort((a, b) => a.year - b.year),
    peeContributions: (p.peeContributions || []).sort((a, b) => a.year - b.year),
    isPEE: (p.enveloppe || p.type) === 'PEE',
    isAirLiquide: !!p.isAirLiquide,
    loyaltyEligible: !!p.loyaltyEligible,
    quantite: Number(p.quantite) || 0,
    prixAction: (Number(p.quantite) > 0 && Number(p.valeur) > 0)
      ? Number(p.valeur) / Number(p.quantite) : 0,
    dividendeParAction: Number(p.dividendeParAction) || 3.30,
    croissanceDividende: Number(p.croissanceDividende) || 0.08,
    _source: p
  };
  });

  // PEA overflow: when PEA ceiling is reached, DCA is redirected to configured targets
  // Users can configure peaOverflowTargets: [{ category: 'cto'|'av'|'bitcoin'|'epargne', pct }]
  // If no targets configured, falls back to a virtual CTO placement
  const peaOverflowTargets = params.peaOverflowTargets || [];

  // Compute average rendement per category from existing placements
  const categoryRendements = {};
  const catGroups = { cto: [], av: [], bitcoin: [] };
  placSims.forEach(ps => {
    if (ps.groupKey.startsWith('CTO')) catGroups.cto.push(ps.rendement);
    else if (ps.groupKey === 'Assurance Vie') catGroups.av.push(ps.rendement);
    else if (ps.groupKey === 'Crypto') catGroups.bitcoin.push(ps.rendement);
  });
  const defaultRendPlac = params.rendementPlacementsDefaut || 0.05;
  categoryRendements.cto = catGroups.cto.length > 0 ? catGroups.cto.reduce((a, b) => a + b, 0) / catGroups.cto.length : defaultRendPlac;
  categoryRendements.av = catGroups.av.length > 0 ? catGroups.av.reduce((a, b) => a + b, 0) / catGroups.av.length : 0.02;
  categoryRendements.bitcoin = catGroups.bitcoin.length > 0 ? catGroups.bitcoin.reduce((a, b) => a + b, 0) / catGroups.bitcoin.length : defaultRendPlac;
  categoryRendements.epargne = rendEpar;

  const rendCTO = categoryRendements.cto;
  const firstCtoGk = placSims.find(ps => ps.groupKey.startsWith('CTO'))?.groupKey || 'CTO';
  const ctoOverflow = {
    groupKey: firstCtoGk,
    id: '__cto_overflow__',
    value: 0,
    rendement: rendCTO,
    dcaMensuel: 0,
    dcaOverrides: [],
    cashInjections: [],
    isAirLiquide: false,
    totalApports: 0,
    totalGains: 0
  };
  // Only add CTO overflow as a real sim if needed (no targets configured, or targets don't cover 100%)
  const overflowTargetTotal = peaOverflowTargets.reduce((s, t) => s + (Number(t.pct) || 0), 0);
  const needsCTOFallback = overflowTargetTotal < 100;
  if (needsCTOFallback || peaOverflowTargets.length === 0) {
    placSims.push(ctoOverflow);
  }

  // AV overflow: when AV ceiling (300k) is reached, DCA is redirected to configured targets
  const avOverflowTargets = params.avOverflowTargets || [];
  const rendAVFallback = categoryRendements.cto;
  const avOverflow = {
    groupKey: firstCtoGk,
    id: '__av_overflow__',
    value: 0,
    rendement: rendAVFallback,
    dcaMensuel: 0,
    dcaOverrides: [],
    cashInjections: [],
    isAirLiquide: false,
    totalApports: 0,
    totalGains: 0
  };
  const avOverflowTargetTotal = avOverflowTargets.reduce((s, t) => s + (Number(t.pct) || 0), 0);
  const needsAVCTOFallback = avOverflowTargetTotal < 100;
  if (needsAVCTOFallback || avOverflowTargets.length === 0) {
    placSims.push(avOverflow);
  }

  // Discover unique group keys from placements with custom sort order
  const groupKeysSet = new Set();
  placSims.forEach(ps => groupKeysSet.add(ps.groupKey));
  const GROUP_KEY_ORDER = ['PEA Actions', 'PEA ETF', 'PEA Autre', 'CTO TR', 'CTO BB', 'CTO', 'Crypto', 'Assurance Vie', 'PEE', 'PER', 'Livrets'];
  const groupKeys = [...groupKeysSet].sort((a, b) => {
    const ia = GROUP_KEY_ORDER.indexOf(a);
    const ib = GROUP_KEY_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  let emprunts = state.passifs.emprunts.map(e => ({
    capitalRestant: Number(e.capitalRestant) || 0,
    tauxAnnuel: Number(e.tauxInteret) || 0,
    mensualite: Number(e.mensualite) || 0,
    dureeRestanteMois: Number(e.dureeRestanteMois) || 0
  }));

  const revenusMensuels = state.revenus.filter(i => !i.informatif).reduce((s, i) => {
    const montant = Number(i.montantMensuel) || 0;
    return s + (i.frequence === 'Annuel' ? montant / 12 : montant);
  }, 0);
  const depensesMensuelles = state.depenses.reduce((s, i) => {
    const montant = Number(i.montantMensuel) || 0;
    return s + (i.frequence === 'Annuel' ? montant / 12 : montant);
  }, 0);

  // Trade Republic features: saveback (1% CB → BTC) & round-up (arrondi → CTO)
  // Estimate monthly TR spending from suiviDepenses or depenses tagged as investment on TR
  const trDepensesMensuelles = state.depenses
    .filter(d => d.typeDepense !== 'Investissement')
    .reduce((s, d) => {
      const m = Number(d.montantMensuel) || 0;
      return s + (d.frequence === 'Annuel' ? m / 12 : m);
    }, 0);
  const trSavebackPct = params.trSavebackPct || 0.01;
  const trRoundupPct = params.trRoundupPct || 0.03;
  const trSavebackMensuel = trDepensesMensuelles * trSavebackPct; // → BTC (free, not deducted)
  const trRoundupMensuel = trDepensesMensuelles * trRoundupPct; // average round-up → CTO (deducted)
  // Inject saveback into Crypto (BTC) placement DCA
  const cryptoPlac = placSims.find(ps => ps.groupKey === 'Crypto');
  if (cryptoPlac) {
    cryptoPlac.dcaMensuel += trSavebackMensuel;
    // Saveback is free money (not from your pocket), so don't count as expense
  }
  // Inject round-up into CTO overflow (deducted from capacity)
  if (ctoOverflow) {
    ctoOverflow.dcaMensuel += trRoundupMensuel;
  }

  // Heritage injections by year offset
  const heritageItems = (state.heritage || []).filter(h => h.dateInjection && h.montant);
  const currentYear = new Date().getFullYear();
  const heritageByYear = {};
  heritageItems.forEach(h => {
    const injectionYear = new Date(h.dateInjection).getFullYear();
    const yearOffset = injectionYear - currentYear;
    if (yearOffset >= 0 && yearOffset <= years) {
      if (!heritageByYear[yearOffset]) heritageByYear[yearOffset] = { immo: 0, liq: 0 };
      if (h.type === 'Immobilier') heritageByYear[yearOffset].immo += Number(h.montant) || 0;
      else heritageByYear[yearOffset].liq += Number(h.montant) || 0;
    }
  });

  const ccTotal = (state.actifs.comptesCourants || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const snapshots = [];
  let immo = totalImmo;
  let epar = totalEpar;
  let heritage = 0;
  let donation = 0;
  let surplus = 0;
  let revenus = revenusMensuels;
  let depenses = depensesMensuelles;

  // Track cumulative apports and gains per placement for tax computation
  const PEA_PLAFOND = 150000;  // Plafond sur les apports uniquement
  const AV_PLAFOND = 300000;   // Plafond sur la valeur totale (apports + gains)
  let peaApportsCumules = 0;
  placSims.forEach(ps => {
    ps.totalApports = ps.value; // initial value counts as apport (for gains tracking)
    ps.totalGains = 0;
    if (ps.groupKey.startsWith('PEA')) {
      // Use real apport (not market value) for PEA ceiling tracking
      peaApportsCumules += ps.apportInitial;
    }
  });
  // Helper: find a placement sim by overflow category
  function findSimByCategory(cat, excludeId) {
    if (cat === 'cto') return placSims.find(ps => ps.groupKey.startsWith('CTO') && ps.id !== (excludeId || ''));
    if (cat === 'cto_tr') return placSims.find(ps => ps.groupKey === 'CTO TR');
    if (cat === 'cto_bb') return placSims.find(ps => ps.groupKey === 'CTO BB');
    if (cat === 'av') return placSims.find(ps => ps.groupKey === 'Assurance Vie');
    if (cat === 'bitcoin') return placSims.find(ps => ps.groupKey === 'Crypto');
    return null;
  }
  // Helper: compute total current value of all AV placements (for value-based ceiling)
  const getAvTotalValue = () => placSims.filter(p => p.groupKey === 'Assurance Vie').reduce((sum, p) => sum + p.value, 0);
  let cumulInterets = 0;
  let fraisCumules = 0;
  const PFU_RATE = params.tauxPFU || 0.30;   // Prélèvement Forfaitaire Unique: 12.8% IR + 17.2% PS
  const PS_RATE = params.tauxPS || 0.172;   // Prélèvements sociaux seuls (PEA > 5 ans, PEE)
  const AV_IR_AFTER8 = params.tauxAVIR || 0.075; // AV après 8 ans: 7.5% IR (versements < 150k€)
  const AV_IR_AFTER8_OVER150K = 0.128;     // AV après 8 ans: 12.8% IR (versements > 150k€)
  const AV_VERSEMENTS_SEUIL = 150000;      // Seuil versements AV pour taux réduit
  const AV_ABATTEMENT = 4600; // Abattement annuel AV > 8 ans (célibataire)

  // Compute tax rate for a placement based on envelope type and age
  function getPlacementTaxRate(ps, simulationYear) {
    const envelopeAge = ps.envelopeAgeAtStart + simulationYear;
    const gk = ps.groupKey;
    const isPEA = gk.startsWith('PEA');
    const isAV = gk === 'Assurance Vie';
    const isPEE = ps.isPEE;

    if (isPEA) {
      return envelopeAge >= 5 ? PS_RATE : PFU_RATE;
    }
    if (isAV) {
      if (envelopeAge < 8) return PFU_RATE;
      const totalAVApports = placSims.filter(p => p.groupKey === 'Assurance Vie').reduce((s, p) => s + p.totalApports, 0);
      const irRate = totalAVApports > AV_VERSEMENTS_SEUIL ? AV_IR_AFTER8_OVER150K : AV_IR_AFTER8;
      return PS_RATE + irRate;
    }
    if (isPEE) {
      return PS_RATE;
    }
    return PFU_RATE;
  }

  // Compute AV tax with abattement (€4,600 single / €9,200 couple)
  function computeAVTax(gains, envelopeAge, totalAVApports) {
    if (gains <= 0) return gains * PFU_RATE;
    if (envelopeAge < 8) return gains * PFU_RATE;
    const irRate = totalAVApports > AV_VERSEMENTS_SEUIL ? AV_IR_AFTER8_OVER150K : AV_IR_AFTER8;
    const ps = gains * PS_RATE;
    const gainsAfterAbattement = Math.max(0, gains - AV_ABATTEMENT);
    const ir = gainsAfterAbattement * irRate;
    return ps + ir;
  }

  const cashOutYear = params.cashOutYear ? Number(params.cashOutYear) : null;
  let cashedOut = false;

  for (let year = 0; year <= years; year++) {
    // Inject heritage
    if (heritageByYear[year]) {
      immo += heritageByYear[year].immo;
      heritage += heritageByYear[year].liq;
    }

    // Inject surplus annuel (adds to liquidités/épargne)
    const calYearForSurplus = currentCalendarYear + year;
    if (surplusByYear[calYearForSurplus]) {
      surplus += surplusByYear[calYearForSurplus];
      epar += surplusByYear[calYearForSurplus];
    }

    // --- Grow assets FIRST, then snapshot (so year 0 = end of current year) ---
    const monthsInPeriod = (year === 0) ? remainingMonths : 12;
    const periodFraction = monthsInPeriod / 12;

    // Immobilier
    immo *= (1 + rendImmo * periodFraction);

    // Épargne (save pre-growth values for interest tracking)
    const eparAvantCroissance = epar;
    epar *= (1 + rendEpar * periodFraction);

    // Héritage liquide
    const heritageAvantCroissance = heritage;
    if (heritage > 0) heritage *= (1 + rendEpar * periodFraction);

    const currentAge = ageFinAnnee + year;
    // Capital transfers (épargne/héritage/CTO → placement) — skip after cash out
    const calYear = currentYear + year;
    if (!cashedOut) for (const transfer of capitalTransfers) {
      const startY = Number(transfer.startYear);
      const endY = transfer.endYear ? Number(transfer.endYear) : startY;
      const inRange = calYear >= startY && calYear <= endY;
      const isOnce = (!transfer.frequency || transfer.frequency === 'once') && calYear === startY;
      const isRecurring = (transfer.frequency === 'annual' || transfer.frequency === 'monthly') && inRange;
      if (!isOnce && !isRecurring) continue;

      const isDonation = transfer.destinationId === '__donation__';
      const isEpargne = transfer.destinationId === '__cat_epargne__';
      const isSurplusDest = transfer.destinationId === 'surplus';
      // Resolve category-level destination IDs to actual placements
      let destSim = null;
      if (!isDonation && !isEpargne && !isSurplusDest) {
        const catMap = { '__cat_pea__': 'PEA', '__cat_cto__': 'CTO', '__cat_cto_tr__': 'CTO TR', '__cat_cto_bb__': 'CTO BB', '__cat_bitcoin__': 'Crypto', '__cat_av__': 'Assurance Vie' };
        const catGroupKey = catMap[transfer.destinationId];
        if (catGroupKey) {
          if (catGroupKey === 'PEA') {
            destSim = placSims.find(ps => ps.groupKey.startsWith('PEA'));
          } else if (catGroupKey === 'Assurance Vie') {
            destSim = placSims.find(ps => ps.groupKey === 'Assurance Vie');
          } else if (catGroupKey === 'CTO') {
            destSim = placSims.find(ps => ps.groupKey.startsWith('CTO'));
          } else if (catGroupKey === 'CTO TR') {
            destSim = placSims.find(ps => ps.groupKey === 'CTO TR');
          } else if (catGroupKey === 'CTO BB') {
            destSim = placSims.find(ps => ps.groupKey === 'CTO BB');
          } else if (catGroupKey === 'Crypto') {
            destSim = placSims.find(ps => ps.groupKey === 'Crypto');
          }
        } else {
          destSim = placSims.find(ps => ps.id === transfer.destinationId);
        }
      }
      if (!destSim && !isDonation && !isEpargne && !isSurplusDest) continue;
      // Skip transfers to PEE after souhaité retirement (PEE is liquidated at end of that year)
      if (destSim && destSim.isPEE && currentAge > ageRetraitePEE) continue;

      // Monthly: multiply by months in period; annual/once: lump sum
      const multiplier = transfer.frequency === 'monthly' ? monthsInPeriod : 1;
      let amount = (Number(transfer.montant) || 0) * multiplier;

      // Debit from source
      if (transfer.source === 'heritage') {
        amount = Math.min(amount, Math.max(0, heritage));
        heritage -= amount;
      } else if (transfer.source === 'epargne') {
        amount = Math.min(amount, Math.max(0, epar));
        epar -= amount;
      } else if (transfer.source === 'surplus') {
        amount = Math.min(amount, Math.max(0, surplus));
        surplus -= amount;
      } else if (transfer.source === '__donation__') {
        amount = Math.min(amount, Math.max(0, donation));
        donation -= amount;
      } else if (transfer.source?.startsWith('__cat_')) {
        // Category-level source: debit from matching placements
        const srcCatMap = { '__cat_pea__': 'PEA', '__cat_cto__': 'CTO', '__cat_cto_tr__': 'CTO TR', '__cat_cto_bb__': 'CTO BB', '__cat_bitcoin__': 'Crypto', '__cat_av__': 'Assurance Vie', '__cat_pee__': 'PEE' };
        const srcGroupKey = srcCatMap[transfer.source];
        const srcSims = srcGroupKey ? placSims.filter(ps => {
          if (srcGroupKey === 'PEA') return ps.groupKey.startsWith('PEA');
          if (srcGroupKey === 'CTO') return ps.groupKey.startsWith('CTO');
          return ps.groupKey === srcGroupKey;
        }) : [];
        const totalAvailable = srcSims.reduce((sum, ps) => sum + Math.max(0, ps.value), 0);
        amount = Math.min(amount, totalAvailable);
        let remaining = amount;
        for (const ps of srcSims) {
          if (remaining <= 0) break;
          const debit = Math.min(remaining, Math.max(0, ps.value));
          ps.value -= debit;
          remaining -= debit;
        }
      } else {
        // Default: épargne
        amount = Math.min(amount, Math.max(0, epar));
        epar -= amount;
      }
      if (amount > 0) {
        if (isDonation) {
          donation += amount;
        } else if (isEpargne) {
          epar += amount;
        } else if (isSurplusDest) {
          surplus += amount;
        } else {
          // Respect PEA/AV ceiling on capital transfers
          const destIsPEA = destSim.groupKey.startsWith('PEA');
          const destIsAV = destSim.groupKey === 'Assurance Vie';
          if (destIsPEA) {
            amount = Math.min(amount, Math.max(0, PEA_PLAFOND - peaApportsCumules));
          }
          if (destIsAV) {
            amount = Math.min(amount, Math.max(0, AV_PLAFOND - getAvTotalValue()));
          }
          if (amount > 0) {
            destSim.value += amount;
            destSim.totalApports += amount;
            if (destIsPEA) peaApportsCumules += amount;
          }
        }
      }
    }

    // Process mouvements for this year
    const mouvementsThisYear = mouvementsParAnnee[calYear];
    if (mouvementsThisYear && Array.isArray(mouvementsThisYear)) {
      for (const mvt of mouvementsThisYear) {
        let amount = Math.abs(Number(mvt.montant) || 0);
        if (amount <= 0) continue;

        // Helper: find placSim by groupKey
        const findPlacSim = (gk) => {
          if (gk === 'PEA') return placSims.find(ps => ps.groupKey.startsWith('PEA'));
          return placSims.find(ps => ps.groupKey === gk);
        };

        // Debit from source
        if (mvt.source && mvt.source !== 'Autre') {
          if (mvt.source === 'Épargne') {
            amount = Math.min(amount, Math.max(0, epar));
            epar -= amount;
          } else if (mvt.source === 'Héritage') {
            amount = Math.min(amount, Math.max(0, heritage));
            heritage -= amount;
          } else if (mvt.source === 'Immo') {
            amount = Math.min(amount, Math.max(0, immo));
            immo -= amount;
          } else {
            // Placement group key (PEA ETF, CTO TR, Ass. Vie, etc.)
            const srcSim = findPlacSim(mvt.source);
            if (srcSim) {
              amount = Math.min(amount, Math.max(0, srcSim.value));
              srcSim.value -= amount;
            }
          }
        }

        // Credit to destination
        if (amount > 0 && mvt.destination && mvt.destination !== 'Autre') {
          if (mvt.destination === 'Épargne') {
            epar += amount;
            surplus += amount;
          } else if (mvt.destination === 'Héritage') {
            heritage += amount;
          } else if (mvt.destination === 'Immo') {
            immo += amount;
          } else {
            const destSim = findPlacSim(mvt.destination);
            if (destSim) {
              // Respect PEA ceiling
              if (destSim.groupKey.startsWith('PEA')) {
                amount = Math.min(amount, Math.max(0, PEA_PLAFOND - peaApportsCumules));
                if (amount > 0) peaApportsCumules += amount;
              }
              if (amount > 0) {
                destSim.value += amount;
                destSim.totalApports += amount;
              }
            }
          }
        }

        // Track donations
        if (mvt.type === 'donation') {
          donation += amount;
        }
      }
    }

    // Cash out: liquidate all placements into épargne (after tax)
    if (cashOutYear && calYear >= cashOutYear && !cashedOut) {
      cashedOut = true;
      placSims.forEach(ps => {
        if (ps.value <= 0) return;
        const gains = Math.max(0, ps.totalGains);
        const taxRate = getPlacementTaxRate(ps, year);
        const taxes = gains * taxRate;
        epar += ps.value - taxes;
        ps.value = 0;
        ps.totalApports = 0;
        ps.totalGains = 0;
      });
      // Also liquidate heritage into épargne
      if (heritage > 0) {
        epar += heritage;
        heritage = 0;
      }
    }

    // Per-placement growth + DCA (skipped after cash out)
    // Collect PEA and AV overflow per month to redirect
    const ctoOverflowMonthly = new Array(monthsInPeriod).fill(0);
    const avOverflowMonthly = new Array(monthsInPeriod).fill(0);

    // Track effective monthly DCA per group (after PEA/AV ceiling caps + overflow redistribution)
    const effectiveDcaByGroup = {};
    groupKeys.forEach(k => { effectiveDcaByGroup[k] = 0; });

    let interetsAnnuels = 0;
    if (!cashedOut) {
    placSims.forEach(ps => {
      if (ps.id === '__cto_overflow__' || ps.id === '__av_overflow__') return; // handled separately after
      // PEE: skip growth/DCA after souhaité retirement (liquidated at end of that year)
      if (ps.isPEE && currentAge > ageRetraitePEE) return;
      const prevValue = ps.value;
      const prevApports = ps.totalApports;

      if (ps.isAirLiquide) {
        const loyaltyMultiplier = ps.loyaltyEligible ? 1.10 : 1.0;
        const monthlyRate = ps.rendement / 12;
        const dca = getDcaForYear(ps, currentCalendarYear + year);
        const isPEA = ps.groupKey.startsWith('PEA');
        const isAV = ps.groupKey === 'Assurance Vie';
        const monthlyDca = (dca > 0 && ps.prixAction > 0) ? dca : 0;

        // Month-by-month simulation for proper compound interest on DCA
        let dividendPaid = false;
        for (let m = 0; m < monthsInPeriod; m++) {
          // Monthly DCA buys shares at current price (respect PEA/AV ceiling)
          if (monthlyDca > 0) {
            let dcaThisMonth = monthlyDca;
            if (isPEA) {
              const room = Math.max(0, PEA_PLAFOND - peaApportsCumules);
              dcaThisMonth = Math.min(dcaThisMonth, room);
              const overflow = monthlyDca - dcaThisMonth;
              if (overflow > 0) ctoOverflowMonthly[m] += overflow;
            }
            if (isAV) {
              const room = Math.max(0, AV_PLAFOND - getAvTotalValue());
              dcaThisMonth = Math.min(dcaThisMonth, room);
              const overflow = monthlyDca - dcaThisMonth;
              if (overflow > 0) avOverflowMonthly[m] += overflow;
            }
            if (dcaThisMonth > 0) {
              if (isPEA && ps.prixAction > 0) {
                // PEA: whole shares only, remainder stays as cash in PEA
                const wholeShares = Math.floor(dcaThisMonth / ps.prixAction);
                const spent = wholeShares * ps.prixAction;
                ps.quantite += wholeShares;
                ps.totalApports += spent;
                if (isPEA) peaApportsCumules += spent;
                effectiveDcaByGroup[ps.groupKey] = (effectiveDcaByGroup[ps.groupKey] || 0) + spent;
                // Unspent remainder carries over (simplified: lost in sim)
              } else {
                ps.quantite += dcaThisMonth / ps.prixAction;
                ps.totalApports += dcaThisMonth;
                effectiveDcaByGroup[ps.groupKey] = (effectiveDcaByGroup[ps.groupKey] || 0) + dcaThisMonth;
              }
            }
          }
          // Monthly price growth
          ps.prixAction *= (1 + monthlyRate);

          // Dividends paid once per year around month 6
          if (!dividendPaid && m >= 5 && monthsInPeriod >= 6) {
            dividendPaid = true;
            const dividendTotal = ps.quantite * ps.dividendeParAction * loyaltyMultiplier;
            interetsAnnuels += dividendTotal;
            if (ps.prixAction > 0) {
              if (isPEA) {
                // PEA: reinvest dividends in whole shares only
                const wholeShares = Math.floor(dividendTotal / ps.prixAction);
                ps.quantite += wholeShares;
              } else {
                ps.quantite += dividendTotal / ps.prixAction;
              }
            }
          }
        }

        if (year > 0 && year % 2 === 0) {
          const baseShares = Math.floor(ps.quantite / 10);
          const loyaltyBonus = ps.loyaltyEligible ? Math.floor(baseShares * 0.10) : 0;
          ps.quantite += baseShares + loyaltyBonus;
        }

        ps.dividendeParAction *= (1 + ps.croissanceDividende * periodFraction);
        ps.value = ps.quantite * ps.prixAction;

      } else {
        // Month-by-month simulation for proper compound interest on DCA
        const monthlyRate = ps.rendement / 12;
        const dca = getDcaForYear(ps, currentCalendarYear + year);
        const monthlyDca = dca > 0 ? dca : 0;
        const isPEA = ps.groupKey.startsWith('PEA');
        const isAV = ps.groupKey === 'Assurance Vie';
        for (let m = 0; m < monthsInPeriod; m++) {
          // Respect PEA/AV ceiling on contributions
          if (monthlyDca > 0) {
            let dcaThisMonth = monthlyDca;
            if (isPEA) {
              const room = Math.max(0, PEA_PLAFOND - peaApportsCumules);
              dcaThisMonth = Math.min(dcaThisMonth, room);
              const overflow = monthlyDca - dcaThisMonth;
              if (overflow > 0) ctoOverflowMonthly[m] += overflow;
            }
            if (isAV) {
              const room = Math.max(0, AV_PLAFOND - getAvTotalValue());
              dcaThisMonth = Math.min(dcaThisMonth, room);
              const overflow = monthlyDca - dcaThisMonth;
              if (overflow > 0) avOverflowMonthly[m] += overflow;
            }
            if (dcaThisMonth > 0) {
              ps.value += dcaThisMonth;
              ps.totalApports += dcaThisMonth;
              if (isPEA) peaApportsCumules += dcaThisMonth;
              effectiveDcaByGroup[ps.groupKey] = (effectiveDcaByGroup[ps.groupKey] || 0) + dcaThisMonth;
            }
          }
          ps.value *= (1 + monthlyRate);
        }
      }

      // Cash injections (respect PEA/AV ceiling)
      const isPEAPlacement = ps.groupKey.startsWith('PEA');
      const isAVPlacement = ps.groupKey === 'Assurance Vie';
      for (const inj of ps.cashInjections) {
        if (inj.year === currentCalendarYear + year) {
          let amount = Number(inj.montant) || 0;
          if (isPEAPlacement) {
            amount = Math.min(amount, Math.max(0, PEA_PLAFOND - peaApportsCumules));
          }
          if (isAVPlacement) {
            amount = Math.min(amount, Math.max(0, AV_PLAFOND - getAvTotalValue()));
          }
          if (amount > 0) {
            if (ps.isAirLiquide && ps.prixAction > 0) {
              if (isPEAPlacement) {
                // PEA: whole shares only
                const wholeShares = Math.floor(amount / ps.prixAction);
                const spent = wholeShares * ps.prixAction;
                ps.quantite += wholeShares;
                ps.value = ps.quantite * ps.prixAction;
                amount = spent; // adjust apport to actual spent
              } else {
                ps.quantite += amount / ps.prixAction;
                ps.value = ps.quantite * ps.prixAction;
              }
            } else {
              ps.value += amount;
            }
            ps.totalApports += amount;
            if (isPEAPlacement) peaApportsCumules += amount;
          }
        }
      }

      // PEE annual contributions (injected as lump sum per year)
      if (ps.isPEE && ps.peeContributions.length > 0) {
        for (const contrib of ps.peeContributions) {
          if (contrib.year === currentCalendarYear + year) {
            const amount = Number(contrib.montant) || 0;
            if (amount > 0) {
              ps.value += amount;
              ps.totalApports += amount;
            }
          }
        }
      }

      // Track gains (use actual apports delta, not theoretical DCA, due to PEA ceiling)
      const apportsThisPeriod = ps.totalApports - prevApports;
      ps.totalGains = ps.value - ps.totalApports;
      interetsAnnuels += ps.value - prevValue - apportsThisPeriod;
      // Estimate fees impact: approximate cost of annual fees on average value over the period
      if (ps.fraisRate > 0) {
        const avgValue = (prevValue + ps.value) / 2;
        fraisCumules += avgValue * ps.fraisRate * (monthsInPeriod / 12);
      }
    });

    // AV value cap: if total AV value exceeds 300K (from growth), cap at 300K
    // and redirect excess to overflow targets. DCA is already stopped by the ceiling check above.
    {
      const avTotalNow = getAvTotalValue();
      if (avTotalNow > AV_PLAFOND) {
        const excess = avTotalNow - AV_PLAFOND;
        // Distribute excess proportionally from AV placements
        const avPlacements = placSims.filter(p => p.groupKey === 'Assurance Vie');
        avPlacements.forEach(ps => {
          const ratio = ps.value / avTotalNow;
          const psExcess = excess * ratio;
          ps.value -= psExcess;
          ps.totalGains = ps.value - ps.totalApports;
        });
        // Redirect excess to AV overflow targets
        let distributed = 0;
        for (const target of avOverflowTargets) {
          if (target.category === 'av') continue; // avoid circular
          const share = excess * (target.pct || 0) / 100;
          if (share <= 0) continue;
          if (target.category === 'epargne') {
            epar += share;
            distributed += share;
          } else if (target.category === 'donation') {
            donation += share;
            distributed += share;
          } else {
            const targetSim = findSimByCategory(target.category, '__av_overflow__');
            if (targetSim) {
              targetSim.value += share;
              targetSim.totalApports += share;
              distributed += share;
            }
          }
        }
        const remainder = excess - distributed;
        if (remainder > 0 && needsAVCTOFallback) {
          avOverflow.value += remainder;
          avOverflow.totalApports += remainder;
        }
      }
    }

    // PEA overflow: distribute to configured category targets (or fallback CTO)
    {
      // Distribute overflow to user-configured category targets
      for (let m = 0; m < monthsInPeriod; m++) {
        if (ctoOverflowMonthly[m] <= 0) continue;
        let distributed = 0;
        for (const target of peaOverflowTargets) {
          const share = ctoOverflowMonthly[m] * (target.pct || 0) / 100;
          if (share <= 0) continue;

          if (target.category === 'epargne') {
            // Épargne: add directly to savings pool
            epar += share;
            distributed += share;
          } else if (target.category === 'donation') {
            donation += share;
            distributed += share;
          } else {
            // Find first placement matching the category group key
            const targetSim = findSimByCategory(target.category);
            const gk = targetSim?.groupKey;
            if (targetSim) {
              targetSim.value += share;
              targetSim.totalApports += share;
              effectiveDcaByGroup[gk] = (effectiveDcaByGroup[gk] || 0) + share;
              distributed += share;
            }
          }
        }
        // Remainder goes to CTO fallback
        const remainder = ctoOverflowMonthly[m] - distributed;
        if (remainder > 0 && needsCTOFallback) {
          ctoOverflow.value += remainder;
          ctoOverflow.totalApports += remainder;
          effectiveDcaByGroup[ctoOverflow.groupKey] = (effectiveDcaByGroup[ctoOverflow.groupKey] || 0) + remainder;
        }
      }

      // Apply monthly growth to all target placements (already handled in main loop above)
      // Only need to grow CTO fallback here since it's skipped in the main loop
      if (needsCTOFallback) {
        const prevValue = ctoOverflow.value;
        const prevApports = ctoOverflow.totalApports;
        const monthlyRate = ctoOverflow.rendement / 12;
        // Re-simulate growth (the values were injected above, now compound)
        // Note: growth is approximate since injections happen throughout the period
        // For simplicity, apply period-end growth
        const growthOnly = ctoOverflow.value * (Math.pow(1 + monthlyRate, monthsInPeriod) - 1);
        ctoOverflow.value += growthOnly;
        ctoOverflow.totalGains = ctoOverflow.value - ctoOverflow.totalApports;
        const apportsThisPeriod = ctoOverflow.totalApports - prevApports;
        interetsAnnuels += ctoOverflow.value - prevValue - apportsThisPeriod;
      }
    }

    // AV overflow: distribute to configured category targets (or fallback CTO)
    {
      const categoryToGroupKey = { cto: 'CTO', av: 'Assurance Vie', bitcoin: 'Crypto' };

      for (let m = 0; m < monthsInPeriod; m++) {
        if (avOverflowMonthly[m] <= 0) continue;
        let distributed = 0;
        for (const target of avOverflowTargets) {
          const share = avOverflowMonthly[m] * (target.pct || 0) / 100;
          if (share <= 0) continue;

          if (target.category === 'epargne') {
            epar += share;
            distributed += share;
          } else if (target.category === 'donation') {
            donation += share;
            distributed += share;
          } else {
            const gk = categoryToGroupKey[target.category];
            const targetSim = gk ? placSims.find(ps => ps.groupKey === gk && ps.id !== '__av_overflow__') : null;
            if (targetSim) {
              targetSim.value += share;
              targetSim.totalApports += share;
              effectiveDcaByGroup[gk] = (effectiveDcaByGroup[gk] || 0) + share;
              distributed += share;
            }
          }
        }
        const remainder = avOverflowMonthly[m] - distributed;
        if (remainder > 0 && needsAVCTOFallback) {
          avOverflow.value += remainder;
          avOverflow.totalApports += remainder;
          effectiveDcaByGroup[avOverflow.groupKey] = (effectiveDcaByGroup[avOverflow.groupKey] || 0) + remainder;
        }
      }

      if (needsAVCTOFallback) {
        const prevValue = avOverflow.value;
        const prevApports = avOverflow.totalApports;
        const monthlyRate = avOverflow.rendement / 12;
        const growthOnly = avOverflow.value * (Math.pow(1 + monthlyRate, monthsInPeriod) - 1);
        avOverflow.value += growthOnly;
        avOverflow.totalGains = avOverflow.value - avOverflow.totalApports;
        const apportsThisPeriod = avOverflow.totalApports - prevApports;
        interetsAnnuels += avOverflow.value - prevValue - apportsThisPeriod;
      }
    }
    } // end if (!cashedOut)

    // Interest on épargne/héritage (use pre-growth values to avoid double counting)
    interetsAnnuels += eparAvantCroissance * (Math.pow(1 + rendEpar, periodFraction) - 1);
    if (heritageAvantCroissance > 0) interetsAnnuels += heritageAvantCroissance * (Math.pow(1 + rendEpar, periodFraction) - 1);

    cumulInterets += Math.max(0, interetsAnnuels);

    // Emprunts
    let totalDette = emprunts.reduce((s, e) => s + Math.max(0, e.capitalRestant), 0);
    let mensualitesTotales = emprunts
      .filter(e => e.capitalRestant > 0)
      .reduce((s, e) => s + e.mensualite, 0);

    emprunts = emprunts.map(e => {
      if (e.capitalRestant <= 0) return e;
      let capital = e.capitalRestant;
      for (let m = 0; m < monthsInPeriod; m++) {
        const interetMensuel = capital * (e.tauxAnnuel / 12);
        const amortissement = Math.min(capital, e.mensualite - interetMensuel);
        capital = Math.max(0, capital - amortissement);
      }
      return { ...e, capitalRestant: capital, dureeRestanteMois: Math.max(0, e.dureeRestanteMois - monthsInPeriod) };
    });

    // Compute tax on gains per placement using envelope-specific rates
    let totalTaxes = 0;
    let totalApports = 0;
    let totalGainsAllPlacements = 0;
    const groupTaxes = {};
    const groupTaxRates = {};
    // Accumulate AV gains and apports across all AV placements for shared abattement
    let totalAVGains = 0;
    let totalAVApports = 0;
    placSims.forEach(ps => {
      if (ps.groupKey === 'Assurance Vie') {
        totalAVGains += Math.max(0, ps.totalGains);
        totalAVApports += ps.totalApports;
      }
    });
    const avIrRate = totalAVApports > AV_VERSEMENTS_SEUIL ? AV_IR_AFTER8_OVER150K : AV_IR_AFTER8;
    let avAbattementRemaining = AV_ABATTEMENT;

    placSims.forEach(ps => {
      const gains = Math.max(0, ps.totalGains);
      let tax;
      if (ps.groupKey === 'Assurance Vie' && (ps.envelopeAgeAtStart + year) >= 8) {
        const avShare = totalAVGains > 0 ? gains / totalAVGains : 0;
        const abattementForThis = Math.min(gains, avAbattementRemaining * avShare);
        const ps_tax = gains * PS_RATE;
        const ir_tax = Math.max(0, gains - abattementForThis) * avIrRate;
        tax = ps_tax + ir_tax;
      } else {
        const taxRate = getPlacementTaxRate(ps, year);
        tax = gains * taxRate;
      }
      totalTaxes += tax;
      totalApports += ps.totalApports;
      totalGainsAllPlacements += gains;
      groupTaxes[ps.groupKey] = (groupTaxes[ps.groupKey] || 0) + tax;
      groupTaxRates[ps.groupKey] = getPlacementTaxRate(ps, year);
    });

    // Aggregate placement values, apports and gains by group
    const groupValues = {};
    const groupApports = {};
    const groupGains = {};
    groupKeys.forEach(k => { groupValues[k] = 0; groupApports[k] = 0; groupGains[k] = 0; });
    placSims.forEach(ps => {
      groupValues[ps.groupKey] += ps.value;
      groupApports[ps.groupKey] += ps.totalApports;
      groupGains[ps.groupKey] += Math.max(0, ps.totalGains);
    });

    const detail = {};
    const detailApports = {};
    const detailGains = {};
    const detailTaxes = {};
    const detailTaxRates = {};

    // Check if user has entered real values for this calendar year
    const calYearStr = String(currentCalendarYear + year);
    const actu = actualisations[calYearStr];
    const hasActu = actu && (actu.placements || actu.epargne !== undefined || actu.immobilier !== undefined || actu.surplus !== undefined || actu.donation !== undefined);

    // If actualisation exists, override simulation state with real values
    // so future years project from actual performance
    if (hasActu) {
      if (actu.placements) {
        placSims.forEach(ps => {
          if (ps.id === '__cto_overflow__') return;
          if (actu.placements[ps.id] !== undefined) {
            const realValue = Number(actu.placements[ps.id]);
            // Adjust gains: new gains = real value - apports
            ps.totalGains = realValue - ps.totalApports;
            ps.value = realValue;
            if (ps.isAirLiquide && ps.prixAction > 0) {
              ps.quantite = realValue / ps.prixAction;
            }
          }
        });
        // Recompute group values after actualisation
        groupKeys.forEach(k => { groupValues[k] = 0; groupApports[k] = 0; groupGains[k] = 0; });
        placSims.forEach(ps => {
          groupValues[ps.groupKey] = (groupValues[ps.groupKey] || 0) + ps.value;
          groupApports[ps.groupKey] = (groupApports[ps.groupKey] || 0) + ps.totalApports;
          groupGains[ps.groupKey] = (groupGains[ps.groupKey] || 0) + Math.max(0, ps.totalGains);
        });
        // Recompute taxes from scratch
        totalTaxes = 0;
        totalApports = 0;
        groupKeys.forEach(k => { groupTaxes[k] = 0; });
        placSims.forEach(ps => {
          const gains = Math.max(0, ps.totalGains);
          const taxRate = getPlacementTaxRate(ps, year);
          const tax = gains * taxRate;
          totalTaxes += tax;
          totalApports += ps.totalApports;
          groupTaxes[ps.groupKey] = (groupTaxes[ps.groupKey] || 0) + tax;
        });
      }
      if (actu.epargne !== undefined) {
        epar = Number(actu.epargne);
      }
      if (actu.immobilier !== undefined) {
        immo = Number(actu.immobilier);
      }
      if (actu.surplus !== undefined) {
        surplus = Number(actu.surplus);
      }
      if (actu.donation !== undefined) {
        donation = Number(actu.donation);
      }
    }

    // Compute final totals (after potential actualisation override)
    const finalTotalPlacements = groupKeys.reduce((s, k) => s + (groupValues[k] || 0), 0);
    const finalCashApresImpot = Math.round(finalTotalPlacements - totalTaxes);
    const finalTotalLiquiditesNettes = Math.round(finalCashApresImpot + epar + heritage + ccTotal);

    groupKeys.forEach(k => {
      detail[k] = Math.round(groupValues[k] || 0);
      detailApports[k] = Math.round(groupApports[k] || 0);
      detailGains[k] = Math.round(groupGains[k] || 0);
      detailTaxes[k] = Math.round(groupTaxes[k] || 0);
      detailTaxRates[k] = groupTaxRates[k] || 0;
    });

    // Convert accumulated DCA totals to monthly averages
    const dcaMensuelEffectif = {};
    groupKeys.forEach(k => {
      dcaMensuelEffectif[k] = monthsInPeriod > 0 ? Math.round((effectiveDcaByGroup[k] || 0) / monthsInPeriod) : 0;
    });

    snapshots.push({
      annee: year,
      calendarYear: currentCalendarYear + year,
      label: `Fin ${currentCalendarYear + year}`,
      age: ageFinAnnee + year,
      isRetraite: (ageFinAnnee + year) === ageRetraite,
      isActualise: !!hasActu,
      placementById: Object.fromEntries(placSims.filter(ps => ps.id !== '__cto_overflow__').map(ps => [ps.id, Math.round(ps.value)])),
      immobilier: Math.round(immo),
      placementDetail: detail,
      dcaMensuelEffectif,
      placementApports: detailApports,
      placementGains: detailGains,
      placementTaxes: detailTaxes,
      placementTaxRates: detailTaxRates,
      placements: Math.round(finalTotalPlacements),
      surplus: Math.round(surplus),
      epargne: Math.round(epar),
      heritage: Math.round(heritage),
      interetsAnnuels: Math.round(Math.max(0, interetsAnnuels)),
      interetsCumules: Math.round(cumulInterets),
      fraisCumules: Math.round(fraisCumules),
      totalApports: Math.round(totalApports),
      totalTaxes: Math.round(Math.max(0, totalTaxes)),
      cashApresImpot: finalCashApresImpot,
      totalLiquiditesNettes: finalTotalLiquiditesNettes,
      totalDette: Math.round(totalDette),
      patrimoineNet: Math.round(immo + finalTotalLiquiditesNettes),
      revenusMensuels: Math.round(revenus),
      depensesMensuelles: Math.round(depenses),
      mensualites: Math.round(mensualitesTotales),
      capaciteEpargne: Math.round(revenus - depenses - mensualitesTotales),
      donation: Math.round(donation)
    });

    // PEE: liquidate after snapshot so the final value is visible in the table
    if (currentAge === ageRetraitePEE) {
      placSims.forEach(ps => {
        if (!ps.isPEE || ps.value <= 0) return;
        const gains = Math.max(0, ps.totalGains);
        const taxRate = getPlacementTaxRate(ps, year);
        const taxes = gains * taxRate;
        epar += ps.value - taxes;
        ps.value = 0;
        ps.totalApports = 0;
        ps.totalGains = 0;
      });
    }

    if (year === years) break;

    revenus *= (1 + inflation * periodFraction);
    depenses *= (1 + inflation * periodFraction);
  }

  // Attach metadata
  snapshots.groupKeys = groupKeys;
  snapshots.ageRetraite = ageRetraite;

  return snapshots;
}

// Tax calculation
export async function computeTax(revenuImposable, nbParts) {
  try {
    const resp = await fetch('./data/tax-brackets.json');
    const data = await resp.json();
    const tranches = data.tranches;

    const quotient = revenuImposable / nbParts;
    let impotParPart = 0;

    for (const tranche of tranches) {
      const max = tranche.max ?? Infinity;
      if (quotient > tranche.min) {
        const taxable = Math.min(quotient, max) - tranche.min;
        impotParPart += taxable * tranche.taux;
      }
    }

    const impotBrut = Math.round(impotParPart * nbParts);

    let decote = 0;
    const seuil = nbParts <= 1 ? data.decote.seuil_celibataire : data.decote.seuil_couple;
    if (impotBrut < seuil) {
      decote = Math.round(seuil * data.decote.coeff - impotBrut * data.decote.coeff);
      decote = Math.max(0, decote);
    }

    const impotNet = Math.max(0, impotBrut - decote);
    const tauxMoyen = revenuImposable > 0 ? impotNet / revenuImposable : 0;

    let tauxMarginal = 0;
    for (const tranche of tranches) {
      const max = tranche.max ?? Infinity;
      if (quotient >= tranche.min && quotient <= max) {
        tauxMarginal = tranche.taux;
        break;
      }
    }

    return {
      revenuImposable,
      nbParts,
      quotientFamilial: Math.round(quotient),
      impotBrut,
      decote,
      impotNet,
      tauxMoyen,
      tauxMarginal,
      tranches: data.tranches,
      pfu: data.pfu
    };
  } catch (e) {
    console.error('Erreur calcul fiscal:', e);
    return null;
  }
}

// Input field helper - dark theme
export function inputField(name, label, value = '', type = 'text', extra = '') {
  return `
    <div class="mb-4">
      <label for="${name}" class="block text-sm font-medium text-gray-300 mb-1.5">${label}</label>
      <input type="${type}" name="${name}" id="field-${name}" value="${value}"
        class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 placeholder-gray-600
        focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition" ${extra}>
    </div>
  `;
}

export function selectField(name, label, options, selected = '') {
  const opts = options.map(o => {
    const val = typeof o === 'string' ? o : o.value;
    const text = typeof o === 'string' ? o : o.label;
    return `<option value="${val}" ${val === selected ? 'selected' : ''}>${text}</option>`;
  }).join('');
  return `
    <div class="mb-4">
      <label for="${name}" class="block text-sm font-medium text-gray-300 mb-1.5">${label}</label>
      <select name="${name}" id="field-${name}"
        class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200
        focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
        ${opts}
      </select>
    </div>
  `;
}

export function getFormData(container) {
  const data = {};
  container.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.name) {
      if (el.type === 'checkbox') {
        data[el.name] = el.checked;
      } else {
        data[el.name] = el.type === 'number' ? parseNumberInput(el.value) : el.value;
      }
    }
  });
  return data;
}
