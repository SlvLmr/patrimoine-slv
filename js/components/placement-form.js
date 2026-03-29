import { inputField, selectField, getFormData, openModal } from '../utils.js?v=8';

export const ENVELOPPES = [
  { value: 'PEA', label: 'PEA' },
  { value: 'AV', label: 'Assurance Vie' },
  { value: 'CTO', label: 'Compte-Titres (CTO)' },
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

export function buildPlacementFormBody(item) {
  const currentYear = new Date().getFullYear();
  const isPEE = (item.enveloppe || item.type || '') === 'PEE';

  // DCA overrides (non-PEE)
  const overrides = item.dcaOverrides || [];
  const overridesHtml = overrides.map((o, i) => `
    <div class="flex items-center gap-2 dca-override-row" data-idx="${i}">
      <div class="flex-1">
        <input type="number" class="dca-ov-year w-full input-field" value="${o.fromYear || ''}" placeholder="Ex: ${currentYear + 1}" min="${currentYear}" max="${currentYear + 50}" step="1">
      </div>
      <span class="text-gray-500 text-xs">→</span>
      <div class="flex-1">
        <input type="number" class="dca-ov-amount w-full input-field" value="${o.dcaMensuel || ''}" placeholder="€/mois" step="10">
      </div>
      <button type="button" class="dca-ov-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
    </div>
  `).join('');

  // Cash injections (non-PEE)
  const injections = item.cashInjections || [];
  const injectionsHtml = injections.map((inj, i) => `
    <div class="flex items-center gap-2 cash-inj-row" data-idx="${i}">
      <div class="flex-1">
        <input type="number" class="cash-inj-year w-full input-field" value="${inj.year || ''}" placeholder="Ex: ${currentYear + 1}" min="${currentYear}" max="${currentYear + 50}" step="1">
      </div>
      <span class="text-gray-500 text-xs">→</span>
      <div class="flex-1">
        <input type="number" class="cash-inj-amount w-full input-field text-accent-green" value="${inj.montant || ''}" placeholder="Montant €" step="100">
      </div>
      <button type="button" class="cash-inj-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
    </div>
  `).join('');

  // PEE annual contributions
  const peeContribs = item.peeContributions || [];
  const peeContribsHtml = peeContribs.map((c, i) => `
    <div class="flex items-center gap-2 pee-contrib-row" data-idx="${i}">
      <div class="w-24">
        <input type="number" class="pee-contrib-year w-full input-field text-center" value="${c.year || ''}" min="${currentYear}" max="${currentYear + 50}" step="1">
      </div>
      <span class="text-gray-500 text-xs">→</span>
      <div class="flex-1">
        <input type="number" class="pee-contrib-amount w-full input-field text-emerald-400" value="${c.montant || ''}" placeholder="Montant annuel €" step="100">
      </div>
      <button type="button" class="pee-contrib-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
    </div>
  `).join('');

  return `
    ${inputField('nom', 'Nom du titre', item.nom || '', 'text', 'placeholder="Ex: Amundi MSCI World"')}
    ${selectField('enveloppe', 'Enveloppe', ENVELOPPES, item.enveloppe || item.type || '')}
    ${selectField('categorie', 'Catégorie', CATEGORIES, item.categorie || '')}
    ${inputField('isin', 'ISIN / Ticker', item.isin || item.ticker || '', 'text', 'placeholder="Ex: LU1681043599 ou CW8"')}
    ${inputField('dateOuverture', "Date d'ouverture de l'enveloppe", item.dateOuverture || '', 'date', 'placeholder="Date d\'ouverture PEA/AV/CTO"')}
    <div class="grid grid-cols-2 gap-3">
      ${inputField('quantite', 'Quantité', item.quantite || '', 'number', 'step="0.0001" placeholder="Ex: 15.5"')}
      ${inputField('pru', 'PRU (€)', item.pru || '', 'number', 'step="0.01" placeholder="Prix de revient unitaire"')}
    </div>
    ${inputField('valeur', 'Valeur totale actuelle (€)', item.valeur || '', 'number', 'step="0.01"')}

    <!-- DCA section (non-PEE) -->
    <div id="dca-section" class="${isPEE ? 'hidden' : ''} mt-2 pt-3 border-t border-dark-400/30">
      <p class="text-sm font-medium text-gray-300 mb-3">Investissement programmé</p>
      ${inputField('apport', 'Apport initial (€)', item.apport || '', 'number', 'step="100" placeholder="Capital de départ"')}
      <div class="grid grid-cols-2 gap-3">
        ${inputField('dcaMensuel', 'DCA mensuel (€/mois)', item.dcaMensuel || '', 'number', 'step="10" placeholder="Apport mensuel"')}
        ${inputField('dcaFinAnnee', 'Fin du DCA (année)', item.dcaFinAnnee || '', 'number', `step="1" min="${currentYear}" max="${currentYear + 50}" placeholder="Illimité"`)}
      </div>

      <div class="mt-2">
        <label class="block text-xs font-medium text-gray-400 mb-1.5">Modifier le DCA par période</label>
        <div id="dca-overrides-list" class="space-y-2 mb-2">
          ${overridesHtml}
        </div>
        <button type="button" id="btn-add-dca-override" class="text-xs text-accent-blue hover:text-accent-blue/80 font-medium">+ Ajouter une période</button>
        <p class="text-xs text-gray-600 mt-1">Ex: À partir de 2030, passer le DCA à 500€/mois</p>
      </div>

      <div class="mt-3">
        <label class="block text-xs font-medium text-gray-400 mb-1.5">Apports exceptionnels</label>
        <div id="cash-injections-list" class="space-y-2 mb-2">
          ${injectionsHtml}
        </div>
        <button type="button" id="btn-add-cash-injection" class="text-xs text-accent-green hover:text-accent-green/80 font-medium">+ Ajouter un apport</button>
        <p class="text-xs text-gray-600 mt-1">Ex: En 2029, injecter 5 000€ en une fois</p>
      </div>
    </div>

    <!-- PEE annual contributions section -->
    <div id="pee-section" class="${isPEE ? '' : 'hidden'} mt-2 pt-3 border-t border-dark-400/30">
      <p class="text-sm font-medium text-gray-300 mb-1">Versements annuels</p>
      <p class="text-xs text-gray-600 mb-3">Renseignez le montant total versé (ou prévu) chaque année</p>
      <div id="pee-contribs-list" class="space-y-2 mb-2">
        ${peeContribsHtml}
      </div>
      <button type="button" id="btn-add-pee-contrib" class="text-xs text-emerald-400 hover:text-emerald-300 font-medium">+ Ajouter une année</button>
    </div>

    <div class="mt-2 pt-3 border-t border-dark-400/30">
      <div class="flex items-center gap-3 mb-3">
        <input type="checkbox" id="field-isAirLiquide" class="w-4 h-4 rounded bg-dark-800 border-dark-400" ${item.isAirLiquide ? 'checked' : ''}>
        <label for="field-isAirLiquide" class="text-sm font-medium text-gray-300">Mode Air Liquide</label>
        <span class="text-xs text-gray-500">(Actions gratuites + prime de fidélité)</span>
      </div>
      <div id="air-liquide-fields" class="${item.isAirLiquide ? '' : 'hidden'}">
        ${inputField('dividendeParAction', 'Dividende par action (€)', item.dividendeParAction || '3.30', 'number', 'step="0.01"')}
        ${inputField('croissanceDividende', 'Croissance dividende/an (%)', ((parseFloat(item.croissanceDividende) || 0.08) * 100).toFixed(1), 'number', 'step="1" min="0" max="100"')}
        <div class="flex items-center gap-3 mb-4">
          <input type="checkbox" id="field-loyaltyEligible" class="w-4 h-4 rounded bg-dark-800 border-dark-400" ${item.loyaltyEligible ? 'checked' : ''}>
          <label for="field-loyaltyEligible" class="text-sm text-gray-300">Prime de fidélité (+10% dividendes & actions gratuites)</label>
        </div>
        <div class="p-3 bg-dark-800/50 rounded-lg text-xs text-gray-500 space-y-1">
          <p><strong class="text-gray-400">Actions gratuites :</strong> 1 pour 10 détenues, tous les 2 ans</p>
          <p><strong class="text-gray-400">Prime fidélité :</strong> +10% sur dividendes et attributions (après 2 ans en nominatif)</p>
          <p><strong class="text-gray-400">Dividendes :</strong> réinvestis automatiquement dans la projection</p>
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
    const amount = parseFloat(row.querySelector('.dca-ov-amount')?.value);
    if (year > 0 && !isNaN(amount)) {
      overrides.push({ fromYear: year, dcaMensuel: amount });
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

function createPeeContribRow() {
  const currentYear = new Date().getFullYear();
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2 pee-contrib-row';
  row.innerHTML = `
    <div class="w-24">
      <input type="number" class="pee-contrib-year w-full input-field text-center" value="${currentYear}" min="${currentYear}" max="${currentYear + 50}" step="1">
    </div>
    <span class="text-gray-500 text-xs">→</span>
    <div class="flex-1">
      <input type="number" class="pee-contrib-amount w-full input-field text-emerald-400" placeholder="Montant annuel €" step="100">
    </div>
    <button type="button" class="pee-contrib-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
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
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 dca-override-row';
      row.innerHTML = `
        <div class="flex-1">
          <input type="number" class="dca-ov-year w-full input-field" placeholder="Ex: ${new Date().getFullYear() + 1}" min="${new Date().getFullYear()}" max="${new Date().getFullYear() + 50}" step="1">
        </div>
        <span class="text-gray-500 text-xs">→</span>
        <div class="flex-1">
          <input type="number" class="dca-ov-amount w-full input-field" placeholder="€/mois" step="10">
        </div>
        <button type="button" class="dca-ov-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
      `;
      list.appendChild(row);
      row.querySelector('.dca-ov-remove').addEventListener('click', () => row.remove());
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
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 cash-inj-row';
      row.innerHTML = `
        <div class="flex-1">
          <input type="number" class="cash-inj-year w-full input-field" placeholder="Ex: ${new Date().getFullYear() + 1}" min="${new Date().getFullYear()}" max="${new Date().getFullYear() + 50}" step="1">
        </div>
        <span class="text-gray-500 text-xs">→</span>
        <div class="flex-1">
          <input type="number" class="cash-inj-amount w-full input-field text-accent-green" placeholder="Montant €" step="100">
        </div>
        <button type="button" class="cash-inj-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
      `;
      injList.appendChild(row);
      row.querySelector('.cash-inj-remove').addEventListener('click', () => row.remove());
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
      // Auto-increment year from last row
      const existingRows = peeList.querySelectorAll('.pee-contrib-row');
      const row = createPeeContribRow();
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
