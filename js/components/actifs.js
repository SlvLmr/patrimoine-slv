import { formatCurrency, formatPercent, openModal, getFormData, inputField, selectField } from '../utils.js';

const ENVELOPPES = [
  { value: 'PEA', label: 'PEA' },
  { value: 'AV', label: 'Assurance Vie' },
  { value: 'CTO', label: 'Compte-Titres (CTO)' },
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

  // Group placements by envelope
  const envelopeGroups = {};
  placements.forEach(p => {
    const env = p.enveloppe || p.type || 'Autre';
    if (!envelopeGroups[env]) envelopeGroups[env] = [];
    envelopeGroups[env].push(p);
  });

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-100">Gestion des actifs</h1>
      </div>

      <!-- Immobilier -->
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-5 border-b border-dark-400/30 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-gray-200">Immobilier</h2>
          </div>
          <button id="btn-add-immo" class="px-4 py-2 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter</button>
        </div>
        ${immobilier.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-dark-800/50 text-gray-500">
              <tr>
                <th class="px-5 py-3 text-left">Nom</th>
                <th class="px-5 py-3 text-right">Valeur d'achat</th>
                <th class="px-5 py-3 text-right">Valeur actuelle</th>
                <th class="px-5 py-3 text-right">+/- Value</th>
                <th class="px-5 py-3 text-right">Loyer</th>
                <th class="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${immobilier.map(i => {
                const pv = (Number(i.valeurActuelle) || 0) - (Number(i.valeurAchat) || 0);
                return `
              <tr class="hover:bg-dark-600/30 transition">
                <td class="px-5 py-3 font-medium text-gray-200">${i.nom}</td>
                <td class="px-5 py-3 text-right text-gray-400">${formatCurrency(i.valeurAchat)}</td>
                <td class="px-5 py-3 text-right font-medium text-gray-200">${formatCurrency(i.valeurActuelle)}</td>
                <td class="px-5 py-3 text-right">${pvBadge(pv)}</td>
                <td class="px-5 py-3 text-right text-gray-400">${formatCurrency(i.loyerMensuel || 0)}/m</td>
                <td class="px-5 py-3 text-center">
                  <button data-edit-immo="${i.id}" class="text-accent-blue hover:text-accent-blue/80 mr-3 text-xs font-medium">Modifier</button>
                  <button data-del-immo="${i.id}" class="text-accent-red/60 hover:text-accent-red text-xs font-medium">Suppr.</button>
                </td>
              </tr>
              `;}).join('')}
            </tbody>
          </table>
        </div>
        ` : '<p class="p-5 text-gray-600 text-sm">Aucun bien immobilier enregistré.</p>'}
      </div>

      <!-- Placements financiers -->
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-5 border-b border-dark-400/30 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-gray-200">Placements financiers</h2>
            <span class="text-xs text-gray-500 bg-dark-600 px-2 py-0.5 rounded-full">${placements.length} ligne${placements.length > 1 ? 's' : ''}</span>
          </div>
          <button id="btn-add-plac" class="px-4 py-2 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter</button>
        </div>

        ${placements.length > 0 ? `
        ${Object.entries(envelopeGroups).map(([env, items]) => {
          const envTotal = items.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
          return `
          <div class="border-b border-dark-400/20 last:border-0">
            <div class="px-5 py-3 bg-dark-800/30 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-accent-blue uppercase tracking-wider">${env}</span>
                <span class="text-xs text-gray-600">${items.length} titre${items.length > 1 ? 's' : ''}</span>
              </div>
              <span class="text-sm font-semibold text-gray-300">${formatCurrency(envTotal)}</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-gray-600 text-xs">
                  <tr>
                    <th class="px-5 py-2 text-left">Nom</th>
                    <th class="px-5 py-2 text-right">Valeur</th>
                    <th class="px-5 py-2 text-right">DCA</th>
                    <th class="px-5 py-2 text-right">+/- Value</th>
                    <th class="px-5 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-dark-400/10">
                  ${items.map(i => {
                    const pv = i.quantite && i.pru ? (Number(i.valeur) - Number(i.pru) * Number(i.quantite)) : 0;
                    const pvPct = i.pru && i.quantite ? (Number(i.valeur) / (Number(i.pru) * Number(i.quantite)) - 1) : 0;
                    const dcaLabel = i.dcaMensuel ? `${formatCurrency(i.dcaMensuel)}/m` : '—';
                    return `
                  <tr class="hover:bg-dark-600/30 transition group">
                    <td class="px-5 py-3">
                      <div class="flex items-center gap-2">
                        <span class="font-medium text-gray-200">${i.nom}</span>
                        ${i.isAirLiquide ? '<span class="text-xs bg-accent-green/15 text-accent-green px-1.5 py-0.5 rounded">AI</span>' : ''}
                      </div>
                      ${i.categorie ? `<span class="text-xs text-gray-600">${i.categorie}</span>` : ''}
                    </td>
                    <td class="px-5 py-3 text-right font-medium text-gray-200">${formatCurrency(i.valeur)}</td>
                    <td class="px-5 py-3 text-right text-gray-400 text-xs">${dcaLabel}</td>
                    <td class="px-5 py-3 text-right">
                      ${pv !== 0 ? `
                        <div class="${pv >= 0 ? 'text-accent-green' : 'text-accent-red'} text-xs font-medium">
                          ${pv >= 0 ? '+' : ''}${formatCurrency(pv)}
                          <span class="text-gray-600 ml-1">(${pvPct >= 0 ? '+' : ''}${(pvPct * 100).toFixed(1)}%)</span>
                        </div>
                      ` : '<span class="text-gray-600">—</span>'}
                    </td>
                    <td class="px-5 py-3 text-center opacity-50 group-hover:opacity-100 transition">
                      <button data-edit-plac="${i.id}" class="text-accent-blue hover:text-accent-blue/80 mr-2 text-xs font-medium">Modifier</button>
                      <button data-del-plac="${i.id}" class="text-accent-red/60 hover:text-accent-red text-xs font-medium">Suppr.</button>
                    </td>
                  </tr>
                  `;}).join('')}
                </tbody>
              </table>
            </div>
          </div>
          `;}).join('')}
        ` : '<p class="p-5 text-gray-600 text-sm">Aucun placement enregistré.</p>'}
      </div>

      <!-- Épargne -->
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-5 border-b border-dark-400/30 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-accent-amber/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-gray-200">Épargne</h2>
          </div>
          <button id="btn-add-epar" class="px-4 py-2 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter</button>
        </div>
        ${epargne.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-dark-800/50 text-gray-500">
              <tr>
                <th class="px-5 py-3 text-left">Nom</th>
                <th class="px-5 py-3 text-right">Solde</th>
                <th class="px-5 py-3 text-right">Taux</th>
                <th class="px-5 py-3 text-right">Plafond</th>
                <th class="px-5 py-3 text-right">Remplissage</th>
                <th class="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${epargne.map(i => {
                const fillPct = i.plafond ? Math.min(100, (Number(i.solde) / Number(i.plafond)) * 100) : 0;
                return `
              <tr class="hover:bg-dark-600/30 transition">
                <td class="px-5 py-3 font-medium text-gray-200">${i.nom}</td>
                <td class="px-5 py-3 text-right font-medium text-accent-amber">${formatCurrency(i.solde)}</td>
                <td class="px-5 py-3 text-right text-gray-400">${formatPercent(i.tauxInteret || 0)}</td>
                <td class="px-5 py-3 text-right text-gray-500">${i.plafond ? formatCurrency(i.plafond) : '—'}</td>
                <td class="px-5 py-3 text-right">
                  ${i.plafond ? `
                  <div class="flex items-center gap-2 justify-end">
                    <div class="progress-bar h-1.5 w-16">
                      <div class="progress-bar-fill h-full bg-accent-amber" style="width: ${fillPct}%"></div>
                    </div>
                    <span class="text-xs text-gray-500">${fillPct.toFixed(0)}%</span>
                  </div>
                  ` : '—'}
                </td>
                <td class="px-5 py-3 text-center">
                  <button data-edit-epar="${i.id}" class="text-accent-blue hover:text-accent-blue/80 mr-3 text-xs font-medium">Modifier</button>
                  <button data-del-epar="${i.id}" class="text-accent-red/60 hover:text-accent-red text-xs font-medium">Suppr.</button>
                </td>
              </tr>
              `;}).join('')}
            </tbody>
          </table>
        </div>
        ` : '<p class="p-5 text-gray-600 text-sm">Aucun compte d\'épargne enregistré.</p>'}
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
}
