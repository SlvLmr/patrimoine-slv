import { inputField, selectField, getFormData, openModal } from '../utils.js?v=10';

export const ENVELOPPES = [
  { value: 'PEA', label: 'PEA' },
  { value: 'AV', label: 'Assurance Vie' },
  { value: 'CTO TR', label: 'CTO TR (Trade Republic)' },
  { value: 'CTO BB', label: 'CTO BB (Boursobank)' },
  { value: 'PEE', label: 'PEE (Épargne entreprise)' },
  { value: 'PER', label: 'PER' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'Livrets', label: 'Livrets (épargne)' },
  { value: 'Autre', label: 'Autre' }
];

export const CATEGORIES = [
  { value: 'ETF', label: 'ETF (Tracker)' },
  { value: 'Action', label: 'Action individuelle' },
  { value: 'Obligation', label: 'Obligation / Fonds euros' },
  { value: 'OPCVM', label: 'OPCVM / Fonds actif' },
  { value: 'SCPI', label: 'SCPI' },
  { value: 'Crypto', label: 'Cryptomonnaie' },
  { value: 'Autre', label: 'Autre' }
];

function dcaOverrideRow(o = {}, currentYear) {
  return `<div class="flex items-center gap-1.5 dca-override-row">
    <input type="number" class="dca-ov-year input-field w-20 text-center text-xs py-1" value="${o.fromYear || ''}" placeholder="Début" min="${currentYear}" max="${currentYear + 50}" step="1">
    <input type="number" class="dca-ov-end-year input-field w-20 text-center text-xs py-1" value="${o.endYear || ''}" placeholder="Fin" min="${currentYear}" max="${currentYear + 50}" step="1">
    <input type="number" class="dca-ov-amount input-field flex-1 text-xs py-1" value="${o.dcaMensuel || ''}" placeholder="€/mois" step="10">
    <button type="button" class="dca-ov-remove text-accent-red/60 hover:text-accent-red text-xs px-0.5">✕</button>
  </div>`;
}

function cashInjRow(inj = {}, currentYear) {
  return `<div class="flex items-center gap-1.5 cash-inj-row">
    <input type="number" class="cash-inj-year input-field w-20 text-center text-xs py-1" value="${inj.year || ''}" placeholder="Année" min="${currentYear}" max="${currentYear + 50}" step="1">
    <input type="number" class="cash-inj-amount input-field flex-1 text-xs py-1 text-accent-green" value="${inj.montant || ''}" placeholder="Montant €" step="100">
    <button type="button" class="cash-inj-remove text-accent-red/60 hover:text-accent-red text-xs px-0.5">✕</button>
  </div>`;
}

function peeContribRow(c = {}, currentYear) {
  return `<div class="flex items-center gap-1.5 pee-contrib-row">
    <input type="number" class="pee-contrib-year input-field w-20 text-center text-xs py-1" value="${c.year || ''}" min="${currentYear}" max="${currentYear + 50}" step="1">
    <input type="number" class="pee-contrib-amount input-field flex-1 text-xs py-1 text-emerald-400" value="${c.montant || ''}" placeholder="Montant annuel €" step="100">
    <button type="button" class="pee-contrib-remove text-accent-red/60 hover:text-accent-red text-xs px-0.5">✕</button>
  </div>`;
}

export function buildPlacementFormBody(item) {
  const currentYear = new Date().getFullYear();
  const isPEE = (item.enveloppe || item.type || '') === 'PEE';

  const overridesHtml = (item.dcaOverrides || []).map(o => dcaOverrideRow(o, currentYear)).join('');
  const injectionsHtml = (item.cashInjections || []).map(inj => cashInjRow(inj, currentYear)).join('');
  const peeContribsHtml = (item.peeContributions || []).map(c => peeContribRow(c, currentYear)).join('');

  return `
    <div class="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 items-end">
      <div class="col-span-3">
        ${inputField('nom', 'Nom du titre', item.nom || '', 'text', 'placeholder="Ex: Amundi MSCI World"')}
      </div>
      <div>${selectField('enveloppe', 'Enveloppe', ENVELOPPES, item.enveloppe || item.type || '')}</div>
      <div>${selectField('categorie', 'Catégorie', CATEGORIES, item.categorie || '')}</div>
      <div>${inputField('isin', 'ISIN / Ticker', item.isin || item.ticker || '', 'text', 'placeholder="LU168..."')}</div>
    </div>

    <div class="grid grid-cols-3 gap-3 mt-1">
      ${inputField('dateOuverture', "Ouverture enveloppe", item.dateOuverture || '', 'date')}
      ${inputField('quantite', 'Quantité', item.quantite || '', 'number', 'step="0.0001" placeholder="15.5"')}
      ${inputField('pru', 'PRU (€)', item.pru || '', 'number', 'step="0.01" placeholder="51.45"')}
    </div>

    <div class="grid grid-cols-2 gap-3 mt-1">
      ${inputField('valeur', 'Valeur actuelle (€)', item.valeur || '', 'number', 'step="0.01"')}
      ${inputField('fraisAnnuels', 'Frais annuels (%)', item.fraisAnnuels || '', 'number', 'step="0.01" min="0" max="10" placeholder="0.25"')}
    </div>

    <!-- DCA section (non-PEE) -->
    <div id="dca-section" class="${isPEE ? 'hidden' : ''} mt-3 pt-3 border-t border-dark-400/30">
      <p class="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">Investissement programmé</p>
      <div class="grid grid-cols-3 gap-3">
        ${inputField('apport', 'Apport initial (€)', item.apport || '', 'number', 'step="100" placeholder="Capital"')}
        ${inputField('dcaMensuel', 'DCA (€/mois)', item.dcaMensuel || '', 'number', 'step="10" placeholder="Mensuel"')}
        ${inputField('dcaFinAnnee', 'Fin DCA', item.dcaFinAnnee || '', 'number', `step="1" min="${currentYear}" max="${currentYear + 50}" placeholder="Illimité"`)}
      </div>

      <div class="mt-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Périodes DCA</span>
          <button type="button" id="btn-add-dca-override" class="text-[10px] text-accent-blue hover:text-accent-blue/80 font-medium">+ Période</button>
        </div>
        <div id="dca-overrides-list" class="space-y-1">
          ${overridesHtml}
        </div>
      </div>

      <div class="mt-2">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Apports exceptionnels</span>
          <button type="button" id="btn-add-cash-injection" class="text-[10px] text-accent-green hover:text-accent-green/80 font-medium">+ Apport</button>
        </div>
        <div id="cash-injections-list" class="space-y-1">
          ${injectionsHtml}
        </div>
      </div>
    </div>

    <!-- PEE annual contributions section -->
    <div id="pee-section" class="${isPEE ? '' : 'hidden'} mt-3 pt-3 border-t border-dark-400/30">
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs font-semibold text-gray-300 uppercase tracking-wide">Versements annuels PEE</p>
        <button type="button" id="btn-add-pee-contrib" class="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium">+ Année</button>
      </div>
      <div id="pee-contribs-list" class="space-y-1">
        ${peeContribsHtml}
      </div>
    </div>

    <div class="mt-3 pt-3 border-t border-dark-400/30">
      <div class="flex items-center gap-3 mb-2">
        <input type="checkbox" id="field-isAirLiquide" class="w-3.5 h-3.5 rounded bg-dark-800 border-dark-400" ${item.isAirLiquide ? 'checked' : ''}>
        <label for="field-isAirLiquide" class="text-xs font-medium text-gray-300">Mode Air Liquide</label>
        <span class="text-[10px] text-gray-600">(Actions gratuites + prime fidélité)</span>
      </div>
      <div id="air-liquide-fields" class="${item.isAirLiquide ? '' : 'hidden'}">
        <div class="grid grid-cols-2 gap-3">
          ${inputField('dividendeParAction', 'Dividende/action (€)', item.dividendeParAction || '3.30', 'number', 'step="0.01"')}
          ${inputField('croissanceDividende', 'Croissance div./an (%)', ((parseFloat(item.croissanceDividende) || 0.08) * 100).toFixed(1), 'number', 'step="1" min="0" max="100"')}
        </div>
        <div class="flex items-center gap-3 mt-2 mb-2">
          <input type="checkbox" id="field-loyaltyEligible" class="w-3.5 h-3.5 rounded bg-dark-800 border-dark-400" ${item.loyaltyEligible ? 'checked' : ''}>
          <label for="field-loyaltyEligible" class="text-xs text-gray-300">Prime de fidélité (+10% dividendes & actions gratuites)</label>
        </div>
        <div class="p-2 bg-dark-800/50 rounded-lg text-[10px] text-gray-500 space-y-0.5">
          <p><strong class="text-gray-400">Actions gratuites :</strong> 1 pour 10, tous les 2 ans</p>
          <p><strong class="text-gray-400">Fidélité :</strong> +10% dividendes et attributions (après 2 ans nominatif)</p>
          <p><strong class="text-gray-400">Dividendes :</strong> réinvestis automatiquement</p>
        </div>
      </div>
    </div>
  `;
}

export function collectDcaOverrides() {
  const rows = document.querySelectorAll('.dca-override-row');
  const overrides = [];
  rows.forEach(row => {
    const year = parseInt(row.querySelector('.dca-ov-year')?.value);
    const endYear = parseInt(row.querySelector('.dca-ov-end-year')?.value) || null;
    const amount = parseFloat(row.querySelector('.dca-ov-amount')?.value);
    if (year > 0 && !isNaN(amount)) {
      const entry = { fromYear: year, dcaMensuel: amount };
      if (endYear) entry.endYear = endYear;
      overrides.push(entry);
    }
  });
  return overrides.sort((a, b) => a.fromYear - b.fromYear);
}

export function collectCashInjections() {
  const rows = document.querySelectorAll('.cash-inj-row');
  const injections = [];
  rows.forEach(row => {
    const year = parseInt(row.querySelector('.cash-inj-year')?.value);
    const montant = parseFloat(row.querySelector('.cash-inj-amount')?.value);
    if (year > 0 && !isNaN(montant) && montant !== 0) {
      injections.push({ year, montant });
    }
  });
  return injections.sort((a, b) => a.year - b.year);
}

export function collectPeeContributions() {
  const rows = document.querySelectorAll('.pee-contrib-row');
  const contribs = [];
  rows.forEach(row => {
    const year = parseInt(row.querySelector('.pee-contrib-year')?.value);
    const montant = parseFloat(row.querySelector('.pee-contrib-amount')?.value);
    if (year > 0 && !isNaN(montant) && montant > 0) {
      contribs.push({ year, montant });
    }
  });
  return contribs.sort((a, b) => a.year - b.year);
}

function createDcaOverrideRowElement() {
  const currentYear = new Date().getFullYear();
  const row = document.createElement('div');
  row.className = 'flex items-center gap-1.5 dca-override-row';
  row.innerHTML = `
    <input type="number" class="dca-ov-year input-field w-20 text-center text-xs py-1" placeholder="Début" min="${currentYear}" max="${currentYear + 50}" step="1">
    <input type="number" class="dca-ov-end-year input-field w-20 text-center text-xs py-1" placeholder="Fin" min="${currentYear}" max="${currentYear + 50}" step="1">
    <input type="number" class="dca-ov-amount input-field flex-1 text-xs py-1" placeholder="€/mois" step="10">
    <button type="button" class="dca-ov-remove text-accent-red/60 hover:text-accent-red text-xs px-0.5">✕</button>
  `;
  row.querySelector('.dca-ov-remove').addEventListener('click', () => row.remove());
  return row;
}

function createCashInjRowElement() {
  const currentYear = new Date().getFullYear();
  const row = document.createElement('div');
  row.className = 'flex items-center gap-1.5 cash-inj-row';
  row.innerHTML = `
    <input type="number" class="cash-inj-year input-field w-20 text-center text-xs py-1" placeholder="Année" min="${currentYear}" max="${currentYear + 50}" step="1">
    <input type="number" class="cash-inj-amount input-field flex-1 text-xs py-1 text-accent-green" placeholder="Montant €" step="100">
    <button type="button" class="cash-inj-remove text-accent-red/60 hover:text-accent-red text-xs px-0.5">✕</button>
  `;
  row.querySelector('.cash-inj-remove').addEventListener('click', () => row.remove());
  return row;
}

function createPeeContribRowElement() {
  const currentYear = new Date().getFullYear();
  const row = document.createElement('div');
  row.className = 'flex items-center gap-1.5 pee-contrib-row';
  row.innerHTML = `
    <input type="number" class="pee-contrib-year input-field w-20 text-center text-xs py-1" value="${currentYear}" min="${currentYear}" max="${currentYear + 50}" step="1">
    <input type="number" class="pee-contrib-amount input-field flex-1 text-xs py-1 text-emerald-400" placeholder="Montant annuel €" step="100">
    <button type="button" class="pee-contrib-remove text-accent-red/60 hover:text-accent-red text-xs px-0.5">✕</button>
  `;
  row.querySelector('.pee-contrib-remove').addEventListener('click', () => row.remove());
  return row;
}

export function initPlacementFormListeners(modal) {
  const qtyInput = modal.querySelector('#field-quantite');
  const pruInput = modal.querySelector('#field-pru');
  const valeurInput = modal.querySelector('#field-valeur');
  if (qtyInput && pruInput && valeurInput) {
    const autoCalc = () => {
      const qty = parseFloat(qtyInput.value);
      const pru = parseFloat(pruInput.value);
      if (qty > 0 && pru > 0) {
        valeurInput.value = (qty * pru).toFixed(2);
      }
    };
    qtyInput.addEventListener('input', autoCalc);
    pruInput.addEventListener('input', autoCalc);
  }

  // Toggle DCA vs PEE sections based on enveloppe
  const enveloppeSelect = modal.querySelector('#field-enveloppe');
  const dcaSection = modal.querySelector('#dca-section');
  const peeSection = modal.querySelector('#pee-section');
  if (enveloppeSelect && dcaSection && peeSection) {
    enveloppeSelect.addEventListener('change', () => {
      const isPEE = enveloppeSelect.value === 'PEE';
      dcaSection.classList.toggle('hidden', isPEE);
      peeSection.classList.toggle('hidden', !isPEE);
    });
  }

  const cb = modal.querySelector('#field-isAirLiquide');
  const fields = modal.querySelector('#air-liquide-fields');
  if (cb && fields) {
    cb.addEventListener('change', () => {
      fields.classList.toggle('hidden', !cb.checked);
    });
  }

  // DCA overrides listeners
  const addBtn = modal.querySelector('#btn-add-dca-override');
  const list = modal.querySelector('#dca-overrides-list');
  if (addBtn && list) {
    addBtn.addEventListener('click', () => {
      list.appendChild(createDcaOverrideRowElement());
    });
    list.querySelectorAll('.dca-ov-remove').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.dca-override-row').remove());
    });
  }

  // Cash injections listeners
  const addInjBtn = modal.querySelector('#btn-add-cash-injection');
  const injList = modal.querySelector('#cash-injections-list');
  if (addInjBtn && injList) {
    addInjBtn.addEventListener('click', () => {
      injList.appendChild(createCashInjRowElement());
    });
    injList.querySelectorAll('.cash-inj-remove').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.cash-inj-row').remove());
    });
  }

  // PEE contributions listeners
  const addPeeBtn = modal.querySelector('#btn-add-pee-contrib');
  const peeList = modal.querySelector('#pee-contribs-list');
  if (addPeeBtn && peeList) {
    addPeeBtn.addEventListener('click', () => {
      const existingRows = peeList.querySelectorAll('.pee-contrib-row');
      const row = createPeeContribRowElement();
      if (existingRows.length > 0) {
        const lastYear = parseInt(existingRows[existingRows.length - 1].querySelector('.pee-contrib-year')?.value) || new Date().getFullYear();
        row.querySelector('.pee-contrib-year').value = lastYear + 1;
      }
      peeList.appendChild(row);
      row.querySelector('.pee-contrib-amount').focus();
    });
    peeList.querySelectorAll('.pee-contrib-remove').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.pee-contrib-row').remove());
    });
  }
}

function collectFormAndSave(store, navigate, targetPage, placementId) {
  const data = getFormData(document.getElementById('modal-body'));
  data.type = data.enveloppe;
  delete data.rendement; // rendement is managed from projection page
  data.croissanceDividende = (data.croissanceDividende || 0) / 100;
  data.dcaOverrides = collectDcaOverrides();
  data.cashInjections = collectCashInjections();
  data.peeContributions = collectPeeContributions();
  data.isAirLiquide = document.getElementById('field-isAirLiquide')?.checked || false;
  data.loyaltyEligible = document.getElementById('field-loyaltyEligible')?.checked || false;

  if (placementId) {
    store.updateItem('actifs.placements', placementId, data);
  } else {
    store.addItem('actifs.placements', data);
  }
  navigate(targetPage);
}

// Helper to open add placement modal from any page
export function openAddPlacementModal(store, navigate, targetPage, prefilledEnvelope) {
  const body = buildPlacementFormBody(prefilledEnvelope ? { enveloppe: prefilledEnvelope } : {});
  const modal = openModal('Ajouter un placement', body, () => {
    collectFormAndSave(store, navigate, targetPage, null);
  });
  initPlacementFormListeners(modal);
}

// Helper to open edit placement modal from any page
export function openEditPlacementModal(store, navigate, targetPage, placementId) {
  const item = store.get('actifs.placements').find(i => i.id === placementId);
  if (!item) return;
  const body = buildPlacementFormBody(item);
  const modal = openModal('Modifier le placement', body, () => {
    collectFormAndSave(store, navigate, targetPage, placementId);
  });
  initPlacementFormListeners(modal);
}
