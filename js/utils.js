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
      <div class="p-6 border-b border-dark-400/50">
        <h3 class="text-lg font-semibold text-gray-100">${title}</h3>
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

  if (onConfirm) {
    modal.querySelector('#modal-confirm').addEventListener('click', () => {
      onConfirm();
      modal.remove();
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
function getPlacementGroupKey(p) {
  const env = p.enveloppe || 'Autre';
  const cat = p.categorie || '';
  if (env === 'PEA') {
    if (cat.includes('ETF')) return 'PEA ETF';
    if (cat.includes('Action')) return 'PEA Actions';
    return 'PEA Autre';
  }
  if (env === 'AV') return 'Assurance Vie';
  if (env === 'CTO') return 'CTO';
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
  const inflation = params.inflationRate || 0.02;
  const ageFinAnnee = params.ageFinAnnee || 43;
  const ageRetraite = params.ageRetraite || 64;
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

  // Build per-placement simulation state
  const placSims = state.actifs.placements.map(p => ({
    groupKey: getPlacementGroupKey(p),
    value: Number(p.valeur) || 0,
    rendement: Number(p.rendement) || (params.rendementPlacements || 0.05),
    dcaMensuel: Number(p.dcaMensuel) || 0,
    dcaOverrides: (p.dcaOverrides || []).sort((a, b) => a.fromYear - b.fromYear),
    isAirLiquide: !!p.isAirLiquide,
    loyaltyEligible: !!p.loyaltyEligible,
    quantite: Number(p.quantite) || 0,
    prixAction: (Number(p.quantite) > 0 && Number(p.valeur) > 0)
      ? Number(p.valeur) / Number(p.quantite) : 0,
    dividendeParAction: Number(p.dividendeParAction) || 3.30,
    croissanceDividende: Number(p.croissanceDividende) || 0.08,
    _source: p
  }));

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

  for (let year = 0; year <= years; year++) {
    // Inject heritage
    if (heritageByYear[year]) {
      immo += heritageByYear[year].immo;
      heritage += heritageByYear[year].liq;
    }

    let totalDette = emprunts.reduce((s, e) => s + Math.max(0, e.capitalRestant), 0);
    let mensualitesTotales = emprunts
      .filter(e => e.capitalRestant > 0)
      .reduce((s, e) => s + e.mensualite, 0);

    // Aggregate placement values by group
    const groupValues = {};
    groupKeys.forEach(k => { groupValues[k] = 0; });
    placSims.forEach(ps => { groupValues[ps.groupKey] += ps.value; });

    const totalPlacements = groupKeys.reduce((s, k) => s + groupValues[k], 0);
    const totalActifs = immo + totalPlacements + epar + heritage;
    const patrimoineNet = totalActifs - totalDette;

    // Compute interest for this year
    let interetsAnnuels = 0;
    if (year > 0) {
      interetsAnnuels += immo * rendImmo / (1 + rendImmo);
      placSims.forEach(ps => {
        if (!ps.isAirLiquide) {
          interetsAnnuels += ps.value * ps.rendement / (1 + ps.rendement);
        }
      });
      interetsAnnuels += epar * rendEpar / (1 + rendEpar);
      if (heritage > 0) interetsAnnuels += heritage * rendEpar / (1 + rendEpar);
    }

    // Cash après impôt = annual savings capacity
    const cashApresImpot = Math.round((revenus - depenses - mensualitesTotales) * 12);

    const detail = {};
    groupKeys.forEach(k => { detail[k] = Math.round(groupValues[k]); });

    snapshots.push({
      annee: year,
      age: ageFinAnnee + year,
      isRetraite: (ageFinAnnee + year) === ageRetraite,
      immobilier: Math.round(immo),
      placementDetail: detail,
      placements: Math.round(totalPlacements),
      epargne: Math.round(epar),
      heritage: Math.round(heritage),
      totalActifs: Math.round(totalActifs),
      totalDette: Math.round(totalDette),
      patrimoineNet: Math.round(patrimoineNet),
      interetsAnnuels: Math.round(interetsAnnuels),
      cashApresImpot,
      revenusMensuels: Math.round(revenus),
      depensesMensuelles: Math.round(depenses),
      mensualites: Math.round(mensualitesTotales),
      capaciteEpargne: Math.round(revenus - depenses - mensualitesTotales)
    });

    if (year === years) break;

    // --- Grow assets for next year ---

    // Immobilier
    immo *= (1 + rendImmo);

    // Épargne: interest only (Livret A, LDD, etc.)
    epar *= (1 + rendEpar);

    // Héritage liquide: same interest rate as épargne
    if (heritage > 0) heritage *= (1 + rendEpar);

    // Per-placement growth + DCA + Air Liquide
    placSims.forEach(ps => {
      if (ps.isAirLiquide) {
        // Air Liquide special logic
        const loyaltyMultiplier = ps.loyaltyEligible ? 1.10 : 1.0;

        // Share price appreciation
        ps.prixAction *= (1 + ps.rendement);

        // Dividends (reinvested into more shares)
        const dividendTotal = ps.quantite * ps.dividendeParAction * loyaltyMultiplier;
        interetsAnnuels += dividendTotal; // count dividends as interest
        if (ps.prixAction > 0) {
          ps.quantite += dividendTotal / ps.prixAction; // reinvest dividends
        }

        // Free shares every 2 years (year 2, 4, 6...)
        if (year > 0 && year % 2 === 0) {
          const freeShares = Math.floor(ps.quantite / 10) * loyaltyMultiplier;
          ps.quantite += freeShares;
        }

        // DCA: buy more shares monthly
        const dca = getDcaForYear(ps, year + 1);
        if (dca > 0 && ps.prixAction > 0) {
          const annualDca = dca * 12;
          ps.quantite += annualDca / ps.prixAction;
        }

        // Grow dividend per share
        ps.dividendeParAction *= (1 + ps.croissanceDividende);

        // Update value
        ps.value = ps.quantite * ps.prixAction;

      } else {
        // Standard placement: rendement + DCA
        ps.value *= (1 + ps.rendement);

        const dca = getDcaForYear(ps, year + 1);
        if (dca > 0) {
          ps.value += dca * 12;
        }
      }
    });

    // Emprunts amortization
    emprunts = emprunts.map(e => {
      if (e.capitalRestant <= 0) return e;
      let capital = e.capitalRestant;
      for (let m = 0; m < 12; m++) {
        const interetMensuel = capital * (e.tauxAnnuel / 12);
        const amortissement = Math.min(capital, e.mensualite - interetMensuel);
        capital = Math.max(0, capital - amortissement);
      }
      return { ...e, capitalRestant: capital, dureeRestanteMois: Math.max(0, e.dureeRestanteMois - 12) };
    });

    revenus *= (1 + inflation);
    depenses *= (1 + inflation);
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
