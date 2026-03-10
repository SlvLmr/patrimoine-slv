import { formatCurrency, formatPercent, formatDate, openModal, getFormData, inputField, selectField } from '../utils.js';

const ENVELOPPES = [
  { value: 'PEA', label: 'PEA' },
  { value: 'AV', label: 'Assurance Vie' },
  { value: 'CTO', label: 'Compte-Titres (CTO)' },
  { value: 'PEE', label: 'PEE (Épargne entreprise)' },
  { value: 'PER', label: 'PER' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'Autre', label: 'Autre' }
];

const CATEGORIES = [
  { value: 'ETF', label: 'ETF (Tracker)' },
  { value: 'Action', label: 'Action individuelle' },
  { value: 'Obligation', label: 'Obligation / Fonds euros' },
  { value: 'OPCVM', label: 'OPCVM / Fonds actif' },
  { value: 'SCPI', label: 'SCPI' },
  { value: 'Crypto', label: 'Cryptomonnaie' },
  { value: 'Autre', label: 'Autre' }
];

function pvBadge(pv) {
  if (!pv || pv === 0) return '';
  const cls = pv >= 0 ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red';
  return `<span class="text-xs px-2 py-0.5 rounded-full ${cls}">${pv >= 0 ? '+' : ''}${formatCurrency(pv)}</span>`;
}

function buildPlacementFormBody(item) {
  const overrides = item.dcaOverrides || [];
  const overridesHtml = overrides.map((o, i) => `
    <div class="flex items-center gap-2 dca-override-row" data-idx="${i}">
      <div class="flex-1">
        <input type="number" class="dca-ov-year w-full px-2 py-1.5 bg-dark-800 border border-dark-400/50 rounded text-gray-200 text-sm" value="${o.fromYear || ''}" placeholder="Année" min="1" max="50" step="1">
      </div>
      <span class="text-gray-500 text-xs">→</span>
      <div class="flex-1">
        <input type="number" class="dca-ov-amount w-full px-2 py-1.5 bg-dark-800 border border-dark-400/50 rounded text-gray-200 text-sm" value="${o.dcaMensuel || ''}" placeholder="€/mois" step="10">
      </div>
      <button type="button" class="dca-ov-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
    </div>
  `).join('');

  const injections = item.cashInjections || [];
  const injectionsHtml = injections.map((inj, i) => `
    <div class="flex items-center gap-2 cash-inj-row" data-idx="${i}">
      <div class="flex-1">
        <input type="number" class="cash-inj-year w-full px-2 py-1.5 bg-dark-800 border border-dark-400/50 rounded text-gray-200 text-sm" value="${inj.year || ''}" placeholder="Année" min="1" max="50" step="1">
      </div>
      <span class="text-gray-500 text-xs">→</span>
      <div class="flex-1">
        <input type="number" class="cash-inj-amount w-full px-2 py-1.5 bg-dark-800 border border-accent-green/30 rounded text-accent-green text-sm" value="${inj.montant || ''}" placeholder="Montant €" step="100">
      </div>
      <button type="button" class="cash-inj-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
    </div>
  `).join('');

  return `
    ${inputField('nom', 'Nom du titre', item.nom || '', 'text', 'placeholder="Ex: Amundi MSCI World"')}
    ${selectField('enveloppe', 'Enveloppe', ENVELOPPES, item.enveloppe || item.type || '')}
    ${selectField('categorie', 'Catégorie', CATEGORIES, item.categorie || '')}
    ${inputField('isin', 'ISIN / Ticker', item.isin || item.ticker || '', 'text', 'placeholder="Ex: LU1681043599 ou CW8"')}
    <div class="grid grid-cols-2 gap-3">
      ${inputField('quantite', 'Quantité', item.quantite || '', 'number', 'step="0.0001" placeholder="Ex: 15.5"')}
      ${inputField('pru', 'PRU (€)', item.pru || '', 'number', 'step="0.01" placeholder="Prix de revient unitaire"')}
    </div>
    ${inputField('valeur', 'Valeur totale actuelle (€)', item.valeur || '', 'number', 'step="0.01"')}
    <div class="mt-2 pt-3 border-t border-dark-400/30">
      <p class="text-sm font-medium text-gray-300 mb-3">Investissement programmé</p>
      ${inputField('apport', 'Apport initial (€)', item.apport || '', 'number', 'step="100" placeholder="Capital de départ"')}
      ${inputField('dcaMensuel', 'DCA mensuel (€/mois)', item.dcaMensuel || '', 'number', 'step="10" placeholder="Apport mensuel automatisé"')}

      <div class="mt-2">
        <label class="block text-xs font-medium text-gray-400 mb-1.5">Modifier le DCA par période</label>
        <div id="dca-overrides-list" class="space-y-2 mb-2">
          ${overridesHtml}
        </div>
        <button type="button" id="btn-add-dca-override" class="text-xs text-accent-blue hover:text-accent-blue/80 font-medium">+ Ajouter une période</button>
        <p class="text-xs text-gray-600 mt-1">Ex: À partir de l'année 5, passer le DCA à 500€/mois</p>
      </div>

      <div class="mt-3">
        <label class="block text-xs font-medium text-gray-400 mb-1.5">Apports exceptionnels</label>
        <div id="cash-injections-list" class="space-y-2 mb-2">
          ${injectionsHtml}
        </div>
        <button type="button" id="btn-add-cash-injection" class="text-xs text-accent-green hover:text-accent-green/80 font-medium">+ Ajouter un apport</button>
        <p class="text-xs text-gray-600 mt-1">Ex: Année 3, injecter 5 000€ en une fois</p>
      </div>
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

function collectDcaOverrides() {
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

function collectCashInjections() {
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

function initPlacementFormListeners(modal) {
  // Auto-compute Valeur = Quantité × PRU
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

  // Toggle Air Liquide fields
  const cb = modal.querySelector('#field-isAirLiquide');
  const fields = modal.querySelector('#air-liquide-fields');
  if (cb && fields) {
    cb.addEventListener('change', () => {
      fields.classList.toggle('hidden', !cb.checked);
    });
  }

  // DCA override management
  const addBtn = modal.querySelector('#btn-add-dca-override');
  const list = modal.querySelector('#dca-overrides-list');
  if (addBtn && list) {
    addBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 dca-override-row';
      row.innerHTML = `
        <div class="flex-1">
          <input type="number" class="dca-ov-year w-full px-2 py-1.5 bg-dark-800 border border-dark-400/50 rounded text-gray-200 text-sm" placeholder="Année" min="1" max="50" step="1">
        </div>
        <span class="text-gray-500 text-xs">→</span>
        <div class="flex-1">
          <input type="number" class="dca-ov-amount w-full px-2 py-1.5 bg-dark-800 border border-dark-400/50 rounded text-gray-200 text-sm" placeholder="€/mois" step="10">
        </div>
        <button type="button" class="dca-ov-remove text-accent-red/60 hover:text-accent-red text-sm px-1">✕</button>
      `;
      list.appendChild(row);
      row.querySelector('.dca-ov-remove').addEventListener('click', () => row.remove());
    });

    // Remove buttons for existing rows
    list.querySelectorAll('.dca-ov-remove').forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.dca-override-row').remove());
    });
  }

  // Cash injection management
  const addInjBtn = modal.querySelector('#btn-add-cash-injection');
  const injList = modal.querySelector('#cash-injections-list');
  if (addInjBtn && injList) {
    addInjBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 cash-inj-row';
      row.innerHTML = `
        <div class="flex-1">
          <input type="number" class="cash-inj-year w-full px-2 py-1.5 bg-dark-800 border border-dark-400/50 rounded text-gray-200 text-sm" placeholder="Année" min="1" max="50" step="1">
        </div>
        <span class="text-gray-500 text-xs">→</span>
        <div class="flex-1">
          <input type="number" class="cash-inj-amount w-full px-2 py-1.5 bg-dark-800 border border-accent-green/30 rounded text-accent-green text-sm" placeholder="Montant €" step="100">
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
}

export function render(store) {
  const state = store.getAll();
  const { immobilier, placements, epargne } = state.actifs;
  const emprunts = store.get('passifs.emprunts');
  const heritageItems = store.get('heritage') || [];

  // Group placements by envelope
  const envelopeGroups = {};
  placements.forEach(p => {
    const env = p.enveloppe || p.type || 'Autre';
    if (!envelopeGroups[env]) envelopeGroups[env] = [];
    envelopeGroups[env].push(p);
  });

  // Passifs KPIs
  const totalDette = store.totalPassifs();
  const totalMensualites = emprunts.reduce((s, e) => s + (Number(e.mensualite) || 0), 0);
  const totalRevenus = store.totalRevenus();
  const tauxEndettement = totalRevenus > 0 ? totalMensualites / totalRevenus : 0;

  // Totals for column headers
  const totalImmo = immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const totalPlac = placements.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const totalEpar = epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const totalHeritage = heritageItems.reduce((s, i) => s + (Number(i.montant) || 0), 0);

  const sections = [
    {
      key: 'immobilier',
      label: 'Immobilier',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      color: 'accent-green',
      total: totalImmo,
      count: immobilier.length,
      btnId: 'btn-add-immo',
    },
    {
      key: 'epargne',
      label: 'Épargne',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'accent-amber',
      total: totalEpar,
      count: epargne.length,
      btnId: 'btn-add-epar',
    },
    {
      key: 'placements',
      label: 'Placements',
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      color: 'accent-green',
      total: totalPlac,
      count: placements.length,
      btnId: 'btn-add-plac',
    },
    {
      key: 'emprunts',
      label: 'Emprunts',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5',
      color: 'accent-red',
      total: totalDette,
      count: emprunts.length,
      btnId: 'btn-add-emprunt',
    },
    {
      key: 'heritage',
      label: 'Héritage',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'accent-cyan',
      total: totalHeritage,
      count: heritageItems.length,
      btnId: 'btn-add-heritage',
    },
  ];

  // Build content for each section
  function renderImmoContent() {
    if (immobilier.length === 0) return '<p class="px-2 py-1 text-gray-600 text-xs">Aucun bien immobilier.</p>';
    return `<div class="space-y-1 p-2">${immobilier.map(i => {
      const pv = (Number(i.valeurActuelle) || 0) - (Number(i.valeurAchat) || 0);
      return `
        <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-200 text-xs">${i.nom}</span>
            ${pvBadge(pv)}
          </div>
          <div class="flex items-center justify-between text-[11px] text-gray-400">
            <span>${formatCurrency(i.valeurActuelle)}</span>
            <span>${formatCurrency(i.loyerMensuel || 0)}/m</span>
          </div>
          <div class="flex gap-2 mt-1">
            <button data-edit-immo="${i.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
            <button data-del-immo="${i.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function renderPlacContent() {
    if (placements.length === 0) return '<p class="px-2 py-1 text-gray-600 text-xs">Aucun placement.</p>';
    return `<div class="p-2">${Object.entries(envelopeGroups).map(([env, items]) => {
      const envTotal = items.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
      return `
        <div class="mb-1">
          <div class="flex items-center justify-between px-1 py-1">
            <span class="text-[10px] font-bold text-accent-blue uppercase tracking-wider">${env}</span>
            <span class="text-[10px] font-semibold text-gray-400">${formatCurrency(envTotal)}</span>
          </div>
          ${items.map(i => {
            const pv = i.quantite && i.pru ? (Number(i.valeur) - Number(i.pru) * Number(i.quantite)) : 0;
            const dcaLabel = i.dcaMensuel ? `${formatCurrency(i.dcaMensuel)}/m` : '';
            return `
            <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition mb-0.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1">
                  <span class="font-medium text-gray-200 text-xs">${i.nom}</span>
                  ${i.isAirLiquide ? '<span class="text-[9px] bg-accent-green/15 text-accent-green px-1 rounded">AI</span>' : ''}
                </div>
                <span class="font-medium text-gray-200 text-xs">${formatCurrency(i.valeur)}</span>
              </div>
              <div class="flex items-center justify-between text-[10px]">
                ${dcaLabel ? `<span class="text-gray-500">DCA ${dcaLabel}</span>` : '<span></span>'}
                ${pv !== 0 ? `<span class="${pv >= 0 ? 'text-accent-green' : 'text-accent-red'}">${pv >= 0 ? '+' : ''}${formatCurrency(pv)}</span>` : ''}
              </div>
              <div class="flex gap-2 mt-0.5">
                <button data-edit-plac="${i.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
                <button data-del-plac="${i.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
              </div>
            </div>`;
          }).join('')}
        </div>`;
    }).join('')}</div>`;
  }

  function renderEparContent() {
    if (epargne.length === 0) return '<p class="px-2 py-1 text-gray-600 text-xs">Aucun compte d\'épargne.</p>';
    return `<div class="space-y-1 p-2">${epargne.map(i => {
      const fillPct = i.plafond ? Math.min(100, (Number(i.solde) / Number(i.plafond)) * 100) : 0;
      return `
        <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-200 text-xs">${i.nom}</span>
            <span class="font-medium text-accent-amber text-xs">${formatCurrency(i.solde)}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-gray-400">
            <span>${formatPercent(i.tauxInteret || 0)}</span>
            ${i.plafond ? `<span>${formatCurrency(i.plafond)}</span>` : ''}
          </div>
          ${i.plafond ? `
          <div class="flex items-center gap-1">
            <div class="progress-bar h-1 flex-1">
              <div class="progress-bar-fill h-full bg-accent-amber" style="width: ${fillPct}%"></div>
            </div>
            <span class="text-[10px] text-gray-500">${fillPct.toFixed(0)}%</span>
          </div>` : ''}
          <div class="flex gap-2 mt-1">
            <button data-edit-epar="${i.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
            <button data-del-epar="${i.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function renderEmpruntContent() {
    // KPI row
    const kpiRow = `
      <div class="grid grid-cols-3 gap-1 p-2 pb-1">
        <div class="bg-dark-800/40 rounded p-1.5 text-center">
          <p class="text-[10px] text-gray-500">Dette</p>
          <p class="text-xs font-bold text-accent-red">${formatCurrency(totalDette)}</p>
        </div>
        <div class="bg-dark-800/40 rounded p-1.5 text-center">
          <p class="text-[10px] text-gray-500">Mensualités</p>
          <p class="text-xs font-bold text-gray-200">${formatCurrency(totalMensualites)}</p>
        </div>
        <div class="bg-dark-800/40 rounded p-1.5 text-center">
          <p class="text-[10px] text-gray-500">Endettement</p>
          <p class="text-xs font-bold ${tauxEndettement > 0.35 ? 'text-accent-red' : 'text-accent-green'}">${formatPercent(tauxEndettement)}</p>
        </div>
      </div>`;

    if (emprunts.length === 0) return kpiRow + '<p class="px-2 py-1 text-gray-600 text-xs">Aucun emprunt.</p>';
    return kpiRow + `<div class="space-y-1 p-2">${emprunts.map(e => {
      const paidPct = e.capitalInitial ? Math.min(100, ((Number(e.capitalInitial) - Number(e.capitalRestant)) / Number(e.capitalInitial)) * 100) : 0;
      return `
        <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-200 text-xs">${e.nom}</span>
            <span class="font-medium text-accent-red text-xs">${formatCurrency(e.capitalRestant)}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-gray-400">
            <span>${formatPercent(e.tauxInteret || 0)}</span>
            <span>${formatCurrency(e.mensualite)}/m · ${e.dureeRestanteMois || 0} mois</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="progress-bar h-1 flex-1">
              <div class="progress-bar-fill h-full bg-accent-green" style="width: ${paidPct}%"></div>
            </div>
            <span class="text-[10px] text-gray-500">${paidPct.toFixed(0)}%</span>
          </div>
          <div class="flex gap-2 mt-0.5">
            <button data-edit-emprunt="${e.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
            <button data-del-emprunt="${e.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function renderHeritageContent() {
    if (heritageItems.length === 0) return '<p class="px-2 py-1 text-gray-600 text-xs">Aucun héritage prévu.</p>';
    return `<div class="space-y-1 p-2">${heritageItems.map(h => `
        <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-200 text-xs">${h.nom}</span>
            <span class="font-medium text-accent-cyan text-xs">${formatCurrency(h.montant)}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-gray-400">
            <span class="${h.type === 'Immobilier' ? 'text-accent-green' : 'text-accent-amber'}">${h.type || 'Liquidité'}</span>
            ${h.dateInjection ? `<span>${formatDate(h.dateInjection)}</span>` : ''}
          </div>
          ${h.provenance ? `<div class="text-[10px] text-gray-500">${h.provenance}</div>` : ''}
          <div class="flex gap-2 mt-1">
            <button data-edit-heritage="${h.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
            <button data-del-heritage="${h.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
          </div>
        </div>`).join('')}</div>`;
  }

  const contentRenderers = {
    immobilier: renderImmoContent,
    placements: renderPlacContent,
    epargne: renderEparContent,
    emprunts: renderEmpruntContent,
    heritage: renderHeritageContent,
  };

  const renderColumn = (s) => `
    <div class="card-dark rounded-xl overflow-hidden flex flex-col">
      <div class="px-3 py-2.5 border-b border-dark-400/30">
        <div class="flex items-center gap-2 mb-1.5">
          <div class="w-6 h-6 rounded bg-${s.color}/20 flex items-center justify-center flex-shrink-0">
            <svg class="w-3 h-3 text-${s.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${s.icon}"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-xs font-semibold text-gray-200">${s.label}</h2>
            <p class="text-[10px] text-gray-500">${s.count} élément${s.count > 1 ? 's' : ''}</p>
          </div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold ${s.key === 'emprunts' ? 'text-accent-red' : 'text-gray-200'}">${formatCurrency(s.total)}</span>
          <button id="${s.btnId}" class="px-2 py-1 bg-gradient-to-r ${s.key === 'emprunts' ? 'from-accent-red to-accent-red text-white' : s.key === 'heritage' ? 'from-accent-cyan to-accent-cyan text-dark-900' : 'from-accent-green to-accent-amber text-dark-900'} text-[10px] rounded hover:opacity-90 transition font-medium">+ Ajouter</button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        ${contentRenderers[s.key]()}
      </div>
    </div>`;

  const row1 = sections.filter(s => ['immobilier', 'epargne', 'placements'].includes(s.key));
  const row2 = sections.filter(s => ['emprunts', 'heritage'].includes(s.key));

  return `
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-gray-100">Actifs et passifs</h1>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-3">
        ${row1.map(renderColumn).join('')}
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
        ${row2.map(renderColumn).join('')}
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  const content = document.getElementById('app-content');

  // --- Immobilier ---
  document.getElementById('btn-add-immo')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Nom du bien', '', 'text', 'placeholder="Ex: Appartement Paris 11"')}
      ${inputField('valeurAchat', "Valeur d'achat (€)", '', 'number', 'step="1000"')}
      ${inputField('valeurActuelle', 'Valeur actuelle (€)', '', 'number', 'step="1000"')}
      ${inputField('loyerMensuel', 'Loyer mensuel (€)', '0', 'number', 'step="50"')}
      ${inputField('chargesMensuelles', 'Charges mensuelles (€)', '0', 'number', 'step="10"')}
      ${inputField('dateAchat', "Date d'achat", '', 'date')}
    `;
    openModal('Ajouter un bien immobilier', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      store.addItem('actifs.immobilier', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-immo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editImmo;
      const item = store.get('actifs.immobilier').find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Nom du bien', item.nom)}
        ${inputField('valeurAchat', "Valeur d'achat (€)", item.valeurAchat, 'number', 'step="1000"')}
        ${inputField('valeurActuelle', 'Valeur actuelle (€)', item.valeurActuelle, 'number', 'step="1000"')}
        ${inputField('loyerMensuel', 'Loyer mensuel (€)', item.loyerMensuel || 0, 'number', 'step="50"')}
        ${inputField('chargesMensuelles', 'Charges mensuelles (€)', item.chargesMensuelles || 0, 'number', 'step="10"')}
        ${inputField('dateAchat', "Date d'achat", item.dateAchat || '', 'date')}
      `;
      openModal('Modifier le bien', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        store.updateItem('actifs.immobilier', id, data);
        navigate('actifs');
      });
    });
  });

  content.querySelectorAll('[data-del-immo]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer ce bien immobilier ?')) {
        store.removeItem('actifs.immobilier', btn.dataset.delImmo);
        navigate('actifs');
      }
    });
  });

  // --- Placements ---
  document.getElementById('btn-add-plac')?.addEventListener('click', () => {
    const body = buildPlacementFormBody({});
    const modal = openModal('Ajouter un placement', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.type = data.enveloppe;
      data.croissanceDividende = (data.croissanceDividende || 0) / 100;
      data.dcaOverrides = collectDcaOverrides();
      data.cashInjections = collectCashInjections();
      data.isAirLiquide = document.getElementById('field-isAirLiquide')?.checked || false;
      data.loyaltyEligible = document.getElementById('field-loyaltyEligible')?.checked || false;
      store.addItem('actifs.placements', data);
      navigate('actifs');
    });
    initPlacementFormListeners(modal);
  });

  content.querySelectorAll('[data-edit-plac]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editPlac;
      const item = store.get('actifs.placements').find(i => i.id === id);
      if (!item) return;
      const body = buildPlacementFormBody(item);
      const modal = openModal('Modifier le placement', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.type = data.enveloppe;
        data.rendement = (data.rendement || 0) / 100;
        data.croissanceDividende = (data.croissanceDividende || 0) / 100;
        data.dcaOverrides = collectDcaOverrides();
        data.isAirLiquide = document.getElementById('field-isAirLiquide')?.checked || false;
        data.loyaltyEligible = document.getElementById('field-loyaltyEligible')?.checked || false;
        store.updateItem('actifs.placements', id, data);
        navigate('actifs');
      });
      initPlacementFormListeners(modal);
    });
  });

  content.querySelectorAll('[data-del-plac]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer ce placement ?')) {
        store.removeItem('actifs.placements', btn.dataset.delPlac);
        navigate('actifs');
      }
    });
  });

  // --- Épargne ---
  document.getElementById('btn-add-epar')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Nom du compte', '', 'text', 'placeholder="Ex: Livret A"')}
      ${inputField('solde', 'Solde actuel (€)', '', 'number', 'step="100"')}
      ${inputField('tauxInteret', 'Taux d\'intérêt annuel (%)', '3.0', 'number', 'step="0.1" min="0" max="100"')}
      ${inputField('plafond', 'Plafond (€)', '22950', 'number', 'step="100"')}
    `;
    openModal('Ajouter un compte d\'épargne', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.tauxInteret = (data.tauxInteret || 0) / 100;
      store.addItem('actifs.epargne', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-epar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editEpar;
      const item = store.get('actifs.epargne').find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Nom du compte', item.nom)}
        ${inputField('solde', 'Solde actuel (€)', item.solde, 'number', 'step="100"')}
        ${inputField('tauxInteret', 'Taux d\'intérêt annuel (%)', ((item.tauxInteret || 0.03) * 100).toFixed(1), 'number', 'step="0.1" min="0" max="100"')}
        ${inputField('plafond', 'Plafond (€)', item.plafond || 22950, 'number', 'step="100"')}
      `;
      openModal('Modifier le compte d\'épargne', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.tauxInteret = (data.tauxInteret || 0) / 100;
        store.updateItem('actifs.epargne', id, data);
        navigate('actifs');
      });
    });
  });

  content.querySelectorAll('[data-del-epar]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer ce compte d\'épargne ?')) {
        store.removeItem('actifs.epargne', btn.dataset.delEpar);
        navigate('actifs');
      }
    });
  });

  // --- Emprunts (Passifs) ---
  const empruntForm = (item = {}) => `
    ${inputField('nom', "Nom de l'emprunt", item.nom || '', 'text', 'placeholder="Ex: Prêt immobilier RP"')}
    ${inputField('capitalInitial', 'Capital initial (€)', item.capitalInitial || '', 'number', 'step="1000"')}
    ${inputField('capitalRestant', 'Capital restant dû (€)', item.capitalRestant || '', 'number', 'step="1000"')}
    ${inputField('tauxInteret', 'Taux d\'intérêt annuel (%)', ((parseFloat(item.tauxInteret) || 0.02) * 100).toFixed(2), 'number', 'step="0.1" min="0" max="100"')}
    ${inputField('mensualite', 'Mensualité (€)', item.mensualite || '', 'number', 'step="10"')}
    ${inputField('dureeRestanteMois', 'Durée restante (mois)', item.dureeRestanteMois || '', 'number', 'step="1"')}
    ${inputField('dateDebut', 'Date de début', item.dateDebut || '', 'date')}
  `;

  document.getElementById('btn-add-emprunt')?.addEventListener('click', () => {
    openModal('Ajouter un emprunt', empruntForm(), () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.tauxInteret = (data.tauxInteret || 0) / 100;
      store.addItem('passifs.emprunts', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-emprunt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editEmprunt;
      const item = store.get('passifs.emprunts').find(i => i.id === id);
      if (!item) return;
      openModal("Modifier l'emprunt", empruntForm(item), () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.tauxInteret = (data.tauxInteret || 0) / 100;
        store.updateItem('passifs.emprunts', id, data);
        navigate('actifs');
      });
    });
  });

  content.querySelectorAll('[data-del-emprunt]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cet emprunt ?')) {
        store.removeItem('passifs.emprunts', btn.dataset.delEmprunt);
        navigate('actifs');
      }
    });
  });

  // --- Héritage ---
  const heritageForm = (item = {}) => `
    ${inputField('nom', 'Nom / Description', item.nom || '', 'text', 'placeholder="Ex: Maison familiale"')}
    ${selectField('type', 'Type', [
      { value: 'Immobilier', label: 'Immobilier' },
      { value: 'Liquidité', label: 'Liquidité' }
    ], item.type || 'Immobilier')}
    ${inputField('montant', 'Montant estimé (€)', item.montant || '', 'number', 'min="0" step="1000"')}
    ${inputField('provenance', 'Provenance', item.provenance || '', 'text', 'placeholder="Ex: Parents"')}
    ${inputField('dateInjection', "Date estimée d'injection", item.dateInjection || '', 'date')}
  `;

  document.getElementById('btn-add-heritage')?.addEventListener('click', () => {
    openModal('Ajouter un héritage', heritageForm(), () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.nom || !data.montant) return;
      store.addItem('heritage', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-heritage]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editHeritage;
      const item = (store.get('heritage') || []).find(i => i.id === id);
      if (!item) return;
      openModal("Modifier l'héritage", heritageForm(item), () => {
        const data = getFormData(document.getElementById('modal-body'));
        if (!data.nom || !data.montant) return;
        store.updateItem('heritage', id, data);
        navigate('actifs');
      });
    });
  });

  content.querySelectorAll('[data-del-heritage]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cet héritage ?')) {
        store.removeItem('heritage', btn.dataset.delHeritage);
        navigate('actifs');
      }
    });
  });
}
