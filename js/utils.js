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
  if (env === 'CTO') return 'CTO';
  if (env === 'PEE') return 'PEE';
  return env; // PER, Crypto, Autre
}

// Get the applicable DCA for a given year for a placement
function getDcaForYear(placement, year) {
  const baseDca = Number(placement.dcaMensuel) || 0;
  const overrides = placement.dcaOverrides || [];
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
export function computeProjection(store) {
  const state = store.getAll();
  const params = state.parametres;
  const years = params.projectionYears || 30;
  const now = new Date();
  const currentCalendarYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based (0=Jan, 11=Dec)
  const remainingMonths = 12 - currentMonth; // months left including current month
  const inflation = params.inflationRate || 0.02;
  const ageFinAnnee = params.ageFinAnnee || 43;
  const ageRetraite = params.ageRetraite || 64;
  const ageRetraitePEE = ageRetraite;
  const rendImmo = params.rendementImmobilier || 0.02;

  const totalImmo = state.actifs.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const totalEpar = state.actifs.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);

  // Weighted average rendement for epargne
  let eparRendTotal = 0, eparWeightTotal = 0;
  state.actifs.epargne.forEach(e => {
    const sol = Number(e.solde) || 0;
    const taux = Number(e.tauxInteret) || (params.rendementEpargne || 0.02);
    eparRendTotal += taux * sol;
    eparWeightTotal += sol;
  });
  const rendEpar = eparWeightTotal > 0 ? eparRendTotal / eparWeightTotal : (params.rendementEpargne || 0.02);

  // Capital transfers (épargne/héritage → placement)
  const capitalTransfers = params.capitalTransfers || [];

  // Build per-placement simulation state
  const rendementPlacements = params.rendementPlacements || {};
  const cashInjectionsParams = params.cashInjections || {};
  const placSims = state.actifs.placements.map(p => {
    const gk = getPlacementGroupKey(p);
    // Priority: per-placement override (from projection UI) > placement's own rendement > fallback 5%
    const rend = rendementPlacements[p.id] !== undefined
      ? rendementPlacements[p.id]
      : (Number(p.rendement) || 0.05);
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
    value: initialValue,
    apportInitial: Number(p.apport) || initialValue, // real money invested (for PEA ceiling)
    rendement: rend,
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

  // CTO overflow placement: receives PEA DCA when ceiling is reached
  const rendCTO = params.rendementCTO || 0.05;
  const ctoOverflow = {
    groupKey: 'CTO',
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
  placSims.push(ctoOverflow);

  // Discover unique group keys from placements
  const groupKeysSet = new Set();
  placSims.forEach(ps => groupKeysSet.add(ps.groupKey));
  const groupKeys = [...groupKeysSet].sort();

  let emprunts = state.passifs.emprunts.map(e => ({
    capitalRestant: Number(e.capitalRestant) || 0,
    tauxAnnuel: Number(e.tauxInteret) || 0,
    mensualite: Number(e.mensualite) || 0,
    dureeRestanteMois: Number(e.dureeRestanteMois) || 0
  }));

  const revenusMensuels = state.revenus.reduce((s, i) => s + (Number(i.montantMensuel) || 0), 0);
  const depensesMensuelles = state.depenses.reduce((s, i) => s + (Number(i.montantMensuel) || 0), 0);

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

  const snapshots = [];
  let immo = totalImmo;
  let epar = totalEpar;
  let heritage = 0;
  let revenus = revenusMensuels;
  let depenses = depensesMensuelles;

  // Track cumulative apports and gains per placement for tax computation
  const PEA_PLAFOND = 150000;
  let peaApportsCumules = 0;
  placSims.forEach(ps => {
    ps.totalApports = ps.value; // initial value counts as apport (for gains tracking)
    ps.totalGains = 0;
    if (ps.groupKey.startsWith('PEA')) {
      // Use real apport (not market value) for PEA ceiling tracking
      peaApportsCumules += ps.apportInitial;
    }
  });
  let cumulInterets = 0;
  const PFU_RATE = 0.314;  // Prélèvement Forfaitaire Unique: 14.2% IR + 17.2% PS
  const PS_RATE = 0.172;   // Prélèvements sociaux seuls (PEA > 5 ans, PEE)
  const AV_IR_AFTER8 = 0.075; // AV après 8 ans: 7.5% IR (hors abattement)
  const AV_ABATTEMENT = 4600; // Abattement annuel AV > 8 ans (célibataire)

  // Compute tax rate for a placement based on envelope type and age
  function getPlacementTaxRate(ps, simulationYear) {
    const envelopeAge = ps.envelopeAgeAtStart + simulationYear;
    const gk = ps.groupKey;
    const isPEA = gk.startsWith('PEA');
    const isAV = gk === 'Assurance Vie';
    const isPEE = ps.isPEE;

    if (isPEA) {
      // PEA: after 5 years → only social charges; before → full PFU
      return envelopeAge >= 5 ? PS_RATE : PFU_RATE;
    }
    if (isAV) {
      // AV: after 8 years → PS 17.2% + 7.5% IR (simplified, ignoring abatement for now)
      // before 8 years → PFU 31.4%
      return envelopeAge >= 8 ? (PS_RATE + AV_IR_AFTER8) : PFU_RATE;
    }
    if (isPEE) {
      // PEE: only social charges on gains (no IR)
      return PS_RATE;
    }
    // CTO, Crypto, PER, Autre → PFU 31.4%
    return PFU_RATE;
  }

  const cashOutYear = params.cashOutYear ? Number(params.cashOutYear) : null;
  let cashedOut = false;

  for (let year = 0; year <= years; year++) {
    // Inject heritage
    if (heritageByYear[year]) {
      immo += heritageByYear[year].immo;
      heritage += heritageByYear[year].liq;
    }

    // --- Grow assets FIRST, then snapshot (so year 0 = end of current year) ---
    const monthsInPeriod = (year === 0) ? remainingMonths : 12;
    const periodFraction = monthsInPeriod / 12;

    // Immobilier
    immo *= (1 + rendImmo * periodFraction);

    // Épargne
    epar *= (1 + rendEpar * periodFraction);

    // Héritage liquide
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

      const destSim = placSims.find(ps => ps.id === transfer.destinationId);
      if (!destSim) continue;
      // Skip transfers to PEE after souhaité retirement (PEE is liquidated at end of that year)
      if (destSim.isPEE && currentAge > ageRetraitePEE) continue;

      // Monthly: multiply by months in period; annual/once: lump sum
      const multiplier = transfer.frequency === 'monthly' ? monthsInPeriod : 1;
      let amount = (Number(transfer.montant) || 0) * multiplier;

      // Debit from source
      if (transfer.source === 'heritage') {
        amount = Math.min(amount, Math.max(0, heritage));
        heritage -= amount;
      } else if (transfer.source?.startsWith('placement:')) {
        // Debit from a specific placement
        const srcId = transfer.source.replace('placement:', '');
        const srcSim = placSims.find(ps => ps.id === srcId && ps.id !== transfer.destinationId);
        if (srcSim) {
          amount = Math.min(amount, Math.max(0, srcSim.value));
          srcSim.value -= amount;
        } else {
          amount = 0;
        }
      } else {
        // Default: épargne
        amount = Math.min(amount, Math.max(0, epar));
        epar -= amount;
      }
      if (amount > 0) {
        destSim.value += amount;
        destSim.totalApports += amount;
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
    // Collect PEA overflow per month to redirect to CTO
    const ctoOverflowMonthly = new Array(monthsInPeriod).fill(0);

    let interetsAnnuels = 0;
    if (!cashedOut) {
    placSims.forEach(ps => {
      if (ps.id === '__cto_overflow__') return; // handled separately after
      // PEE: skip growth/DCA after souhaité retirement (liquidated at end of that year)
      if (ps.isPEE && currentAge > ageRetraitePEE) return;
      const prevValue = ps.value;
      const prevApports = ps.totalApports;

      if (ps.isAirLiquide) {
        const loyaltyMultiplier = ps.loyaltyEligible ? 1.10 : 1.0;
        const monthlyRate = ps.rendement / 12;
        const dca = getDcaForYear(ps, currentCalendarYear + year);
        const isPEA = ps.groupKey.startsWith('PEA');
        const monthlyDca = (dca > 0 && ps.prixAction > 0) ? dca : 0;

        // Month-by-month simulation for proper compound interest on DCA
        let dividendPaid = false;
        for (let m = 0; m < monthsInPeriod; m++) {
          // Monthly DCA buys shares at current price (respect PEA ceiling)
          if (monthlyDca > 0) {
            let dcaThisMonth = monthlyDca;
            if (isPEA) {
              const room = Math.max(0, PEA_PLAFOND - peaApportsCumules);
              dcaThisMonth = Math.min(dcaThisMonth, room);
              const overflow = monthlyDca - dcaThisMonth;
              if (overflow > 0) ctoOverflowMonthly[m] += overflow;
            }
            if (dcaThisMonth > 0) {
              ps.quantite += dcaThisMonth / ps.prixAction;
              ps.totalApports += dcaThisMonth;
              if (isPEA) peaApportsCumules += dcaThisMonth;
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
              ps.quantite += dividendTotal / ps.prixAction;
            }
          }
        }

        if (year > 0 && year % 2 === 0) {
          const freeShares = Math.floor(ps.quantite / 10) * loyaltyMultiplier;
          ps.quantite += freeShares;
        }

        ps.dividendeParAction *= (1 + ps.croissanceDividende * periodFraction);
        ps.value = ps.quantite * ps.prixAction;

      } else {
        // Month-by-month simulation for proper compound interest on DCA
        const monthlyRate = ps.rendement / 12;
        const dca = getDcaForYear(ps, currentCalendarYear + year);
        const monthlyDca = dca > 0 ? dca : 0;
        const isPEA = ps.groupKey.startsWith('PEA');
        for (let m = 0; m < monthsInPeriod; m++) {
          // Respect PEA ceiling on contributions
          if (monthlyDca > 0) {
            let dcaThisMonth = monthlyDca;
            if (isPEA) {
              const room = Math.max(0, PEA_PLAFOND - peaApportsCumules);
              dcaThisMonth = Math.min(dcaThisMonth, room);
              const overflow = monthlyDca - dcaThisMonth;
              if (overflow > 0) ctoOverflowMonthly[m] += overflow;
            }
            if (dcaThisMonth > 0) {
              ps.value += dcaThisMonth;
              ps.totalApports += dcaThisMonth;
              if (isPEA) peaApportsCumules += dcaThisMonth;
            }
          }
          ps.value *= (1 + monthlyRate);
        }
      }

      // Cash injections (respect PEA ceiling)
      const isPEAPlacement = ps.groupKey.startsWith('PEA');
      for (const inj of ps.cashInjections) {
        if (inj.year === currentCalendarYear + year) {
          let amount = Number(inj.montant) || 0;
          if (isPEAPlacement) {
            amount = Math.min(amount, Math.max(0, PEA_PLAFOND - peaApportsCumules));
          }
          if (amount > 0) {
            if (ps.isAirLiquide && ps.prixAction > 0) {
              ps.quantite += amount / ps.prixAction;
              ps.value = ps.quantite * ps.prixAction;
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
    });

    // CTO overflow: simulate month-by-month with redirected PEA DCA
    {
      const prevValue = ctoOverflow.value;
      const prevApports = ctoOverflow.totalApports;
      const monthlyRate = ctoOverflow.rendement / 12;
      for (let m = 0; m < monthsInPeriod; m++) {
        if (ctoOverflowMonthly[m] > 0) {
          ctoOverflow.value += ctoOverflowMonthly[m];
          ctoOverflow.totalApports += ctoOverflowMonthly[m];
        }
        ctoOverflow.value *= (1 + monthlyRate);
      }
      ctoOverflow.totalGains = ctoOverflow.value - ctoOverflow.totalApports;
      const apportsThisPeriod = ctoOverflow.totalApports - prevApports;
      interetsAnnuels += ctoOverflow.value - prevValue - apportsThisPeriod;
    }
    } // end if (!cashedOut)

    // Interest on épargne/héritage
    interetsAnnuels += epar * rendEpar * periodFraction / (1 + rendEpar * periodFraction);
    if (heritage > 0) interetsAnnuels += heritage * rendEpar * periodFraction / (1 + rendEpar * periodFraction);

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
    placSims.forEach(ps => {
      const gains = Math.max(0, ps.totalGains);
      const taxRate = getPlacementTaxRate(ps, year);
      const tax = gains * taxRate;
      totalTaxes += tax;
      totalApports += ps.totalApports;
      totalGainsAllPlacements += gains;
      // Accumulate per group
      groupTaxes[ps.groupKey] = (groupTaxes[ps.groupKey] || 0) + tax;
      groupTaxRates[ps.groupKey] = taxRate; // last one wins (same rate per group)
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

    const totalPlacements = groupKeys.reduce((s, k) => s + groupValues[k], 0);

    // Cash après impôt = total placement value - taxes on gains
    const cashApresImpot = Math.round(totalPlacements - totalTaxes);

    // Total liquidités nettes = placements after tax + épargne + heritage + comptes courants
    const ccTotal = (state.actifs.comptesCourants || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
    const totalLiquiditesNettes = Math.round(cashApresImpot + epar + heritage + ccTotal);

    const detail = {};
    const detailApports = {};
    const detailGains = {};
    const detailTaxes = {};
    const detailTaxRates = {};
    groupKeys.forEach(k => {
      detail[k] = Math.round(groupValues[k]);
      detailApports[k] = Math.round(groupApports[k]);
      detailGains[k] = Math.round(groupGains[k]);
      detailTaxes[k] = Math.round(groupTaxes[k] || 0);
      detailTaxRates[k] = groupTaxRates[k] || 0;
    });

    snapshots.push({
      annee: year,
      calendarYear: currentCalendarYear + year,
      label: `Fin ${currentCalendarYear + year}`,
      age: ageFinAnnee + year,
      isRetraite: (ageFinAnnee + year) === ageRetraite,
      immobilier: Math.round(immo),
      placementDetail: detail,
      placementApports: detailApports,
      placementGains: detailGains,
      placementTaxes: detailTaxes,
      placementTaxRates: detailTaxRates,
      placements: Math.round(totalPlacements),
      epargne: Math.round(epar),
      heritage: Math.round(heritage),
      interetsAnnuels: Math.round(Math.max(0, interetsAnnuels)),
      interetsCumules: Math.round(cumulInterets),
      totalApports: Math.round(totalApports),
      totalTaxes: Math.round(totalTaxes),
      cashApresImpot,
      totalLiquiditesNettes,
      totalDette: Math.round(totalDette),
      patrimoineNet: Math.round(immo + totalPlacements + epar + heritage - totalDette),
      revenusMensuels: Math.round(revenus),
      depensesMensuelles: Math.round(depenses),
      mensualites: Math.round(mensualitesTotales),
      capaciteEpargne: Math.round(revenus - depenses - mensualitesTotales)
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
      data[el.name] = el.type === 'number' ? parseNumberInput(el.value) : el.value;
    }
  });
  return data;
}
