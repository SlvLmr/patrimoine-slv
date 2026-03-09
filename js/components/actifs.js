import { formatCurrency, formatPercent, openModal, getFormData, inputField, selectField } from '../utils.js';

function pvBadge(pv) {
  if (!pv || pv === 0) return '';
  const cls = pv >= 0 ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red';
  return `<span class="text-xs px-2 py-0.5 rounded-full ${cls}">${pv >= 0 ? '+' : ''}${formatCurrency(pv)}</span>`;
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
            <div class="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-gray-200">Immobilier</h2>
          </div>
          <button id="btn-add-immo" class="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter</button>
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
          <button id="btn-add-plac" class="px-4 py-2 bg-gradient-to-r from-accent-green to-teal-500 text-white text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter</button>
        </div>

        ${placements.length > 0 ? `
        <!-- Grouped by envelope -->
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
                    <th class="px-5 py-2 text-left">ISIN / Ticker</th>
                    <th class="px-5 py-2 text-right">Qté</th>
                    <th class="px-5 py-2 text-right">PRU</th>
                    <th class="px-5 py-2 text-right">Valeur</th>
                    <th class="px-5 py-2 text-right">+/- Value</th>
                    <th class="px-5 py-2 text-right">Rend.</th>
                    <th class="px-5 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-dark-400/10">
                  ${items.map(i => {
                    const pv = i.quantite && i.pru ? (Number(i.valeur) - Number(i.pru) * Number(i.quantite)) : 0;
                    const pvPct = i.pru && i.quantite ? (Number(i.valeur) / (Number(i.pru) * Number(i.quantite)) - 1) : 0;
                    return `
                  <tr class="hover:bg-dark-600/30 transition group">
                    <td class="px-5 py-3">
                      <div class="font-medium text-gray-200">${i.nom}</div>
                      ${i.categorie ? `<span class="text-xs text-gray-600">${i.categorie}</span>` : ''}
                    </td>
                    <td class="px-5 py-3 text-gray-500 text-xs font-mono">${i.isin || i.ticker || '—'}</td>
                    <td class="px-5 py-3 text-right text-gray-400">${i.quantite || '—'}</td>
                    <td class="px-5 py-3 text-right text-gray-400">${i.pru ? formatCurrency(i.pru) : '—'}</td>
                    <td class="px-5 py-3 text-right font-medium text-gray-200">${formatCurrency(i.valeur)}</td>
                    <td class="px-5 py-3 text-right">
                      ${pv !== 0 ? `
                        <div class="${pv >= 0 ? 'text-accent-green' : 'text-accent-red'} text-xs font-medium">
                          ${pv >= 0 ? '+' : ''}${formatCurrency(pv)}
                          <span class="text-gray-600 ml-1">(${pvPct >= 0 ? '+' : ''}${(pvPct * 100).toFixed(1)}%)</span>
                        </div>
                      ` : '<span class="text-gray-600">—</span>'}
                    </td>
                    <td class="px-5 py-3 text-right text-gray-400">${i.rendement ? formatPercent(i.rendement) : '—'}</td>
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
            <div class="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-gray-200">Épargne</h2>
          </div>
          <button id="btn-add-epar" class="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter</button>
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
                <td class="px-5 py-3 text-right font-medium text-amber-400">${formatCurrency(i.solde)}</td>
                <td class="px-5 py-3 text-right text-gray-400">${formatPercent(i.tauxInteret || 0)}</td>
                <td class="px-5 py-3 text-right text-gray-500">${i.plafond ? formatCurrency(i.plafond) : '—'}</td>
                <td class="px-5 py-3 text-right">
                  ${i.plafond ? `
                  <div class="flex items-center gap-2 justify-end">
                    <div class="progress-bar h-1.5 w-16">
                      <div class="progress-bar-fill h-full bg-amber-500" style="width: ${fillPct}%"></div>
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

  // --- Placements (ETF, Actions, Fonds, Crypto...) ---
  document.getElementById('btn-add-plac')?.addEventListener('click', () => {
    const enveloppes = [
      { value: 'PEA', label: 'PEA' },
      { value: 'PEA-PME', label: 'PEA-PME' },
      { value: 'AV', label: 'Assurance Vie' },
      { value: 'CTO', label: 'Compte-Titres (CTO)' },
      { value: 'PER', label: 'PER' },
      { value: 'Crypto', label: 'Crypto' },
      { value: 'Autre', label: 'Autre' }
    ];
    const categories = [
      { value: 'ETF', label: 'ETF (Tracker)' },
      { value: 'Action', label: 'Action individuelle' },
      { value: 'Obligation', label: 'Obligation / Fonds euros' },
      { value: 'OPCVM', label: 'OPCVM / Fonds actif' },
      { value: 'SCPI', label: 'SCPI' },
      { value: 'Crypto', label: 'Cryptomonnaie' },
      { value: 'Autre', label: 'Autre' }
    ];
    const body = `
      ${inputField('nom', 'Nom du titre', '', 'text', 'placeholder="Ex: Amundi MSCI World"')}
      ${selectField('enveloppe', 'Enveloppe', enveloppes)}
      ${selectField('categorie', 'Catégorie', categories)}
      ${inputField('isin', 'ISIN / Ticker', '', 'text', 'placeholder="Ex: LU1681043599 ou CW8"')}
      <div class="grid grid-cols-2 gap-3">
        ${inputField('quantite', 'Quantité', '', 'number', 'step="0.0001" placeholder="Ex: 15.5"')}
        ${inputField('pru', 'PRU (€)', '', 'number', 'step="0.01" placeholder="Prix de revient unitaire"')}
      </div>
      ${inputField('valeur', 'Valeur totale actuelle (€)', '', 'number', 'step="0.01"')}
      ${inputField('rendement', 'Rendement annuel estimé', '0.05', 'number', 'step="0.005" min="0" max="1"')}
    `;
    openModal('Ajouter un placement', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      // Also store type from enveloppe for backwards compat
      data.type = data.enveloppe;
      store.addItem('actifs.placements', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-plac]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editPlac;
      const item = store.get('actifs.placements').find(i => i.id === id);
      if (!item) return;
      const enveloppes = [
        { value: 'PEA', label: 'PEA' },
        { value: 'PEA-PME', label: 'PEA-PME' },
        { value: 'AV', label: 'Assurance Vie' },
        { value: 'CTO', label: 'Compte-Titres (CTO)' },
        { value: 'PER', label: 'PER' },
        { value: 'Crypto', label: 'Crypto' },
        { value: 'Autre', label: 'Autre' }
      ];
      const categories = [
        { value: 'ETF', label: 'ETF (Tracker)' },
        { value: 'Action', label: 'Action individuelle' },
        { value: 'Obligation', label: 'Obligation / Fonds euros' },
        { value: 'OPCVM', label: 'OPCVM / Fonds actif' },
        { value: 'SCPI', label: 'SCPI' },
        { value: 'Crypto', label: 'Cryptomonnaie' },
        { value: 'Autre', label: 'Autre' }
      ];
      const body = `
        ${inputField('nom', 'Nom du titre', item.nom)}
        ${selectField('enveloppe', 'Enveloppe', enveloppes, item.enveloppe || item.type)}
        ${selectField('categorie', 'Catégorie', categories, item.categorie)}
        ${inputField('isin', 'ISIN / Ticker', item.isin || item.ticker || '', 'text')}
        <div class="grid grid-cols-2 gap-3">
          ${inputField('quantite', 'Quantité', item.quantite || '', 'number', 'step="0.0001"')}
          ${inputField('pru', 'PRU (€)', item.pru || '', 'number', 'step="0.01"')}
        </div>
        ${inputField('valeur', 'Valeur totale actuelle (€)', item.valeur, 'number', 'step="0.01"')}
        ${inputField('rendement', 'Rendement annuel estimé', item.rendement || 0.05, 'number', 'step="0.005" min="0" max="1"')}
      `;
      openModal('Modifier le placement', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.type = data.enveloppe;
        store.updateItem('actifs.placements', id, data);
        navigate('actifs');
      });
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
      ${inputField('tauxInteret', 'Taux d\'intérêt annuel', '0.03', 'number', 'step="0.001" min="0" max="1"')}
      ${inputField('plafond', 'Plafond (€)', '22950', 'number', 'step="100"')}
    `;
    openModal('Ajouter un compte d\'épargne', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
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
        ${inputField('tauxInteret', 'Taux d\'intérêt annuel', item.tauxInteret || 0.03, 'number', 'step="0.001" min="0" max="1"')}
        ${inputField('plafond', 'Plafond (€)', item.plafond || 22950, 'number', 'step="100"')}
      `;
      openModal('Modifier le compte d\'épargne', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
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
