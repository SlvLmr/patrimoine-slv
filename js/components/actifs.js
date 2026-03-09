import { formatCurrency, formatPercent, openModal, getFormData, inputField, selectField } from '../utils.js';

export function render(store) {
  const state = store.getAll();
  const { immobilier, placements, epargne } = state.actifs;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Gestion des actifs</h1>

      <!-- Immobilier -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-700">Immobilier</h2>
          <button id="btn-add-immo" class="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition">+ Ajouter</button>
        </div>
        ${immobilier.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500">
              <tr>
                <th class="px-5 py-3 text-left">Nom</th>
                <th class="px-5 py-3 text-right">Valeur d'achat</th>
                <th class="px-5 py-3 text-right">Valeur actuelle</th>
                <th class="px-5 py-3 text-right">Loyer mensuel</th>
                <th class="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${immobilier.map(i => `
              <tr class="hover:bg-gray-50">
                <td class="px-5 py-3 font-medium">${i.nom}</td>
                <td class="px-5 py-3 text-right">${formatCurrency(i.valeurAchat)}</td>
                <td class="px-5 py-3 text-right font-medium">${formatCurrency(i.valeurActuelle)}</td>
                <td class="px-5 py-3 text-right">${formatCurrency(i.loyerMensuel || 0)}</td>
                <td class="px-5 py-3 text-center">
                  <button data-edit-immo="${i.id}" class="text-indigo-600 hover:text-indigo-800 mr-2">Modifier</button>
                  <button data-del-immo="${i.id}" class="text-red-500 hover:text-red-700">Supprimer</button>
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : '<p class="p-5 text-gray-400 text-sm">Aucun bien immobilier enregistré.</p>'}
      </div>

      <!-- Placements -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-700">Placements financiers</h2>
          <button id="btn-add-plac" class="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition">+ Ajouter</button>
        </div>
        ${placements.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500">
              <tr>
                <th class="px-5 py-3 text-left">Nom</th>
                <th class="px-5 py-3 text-left">Type</th>
                <th class="px-5 py-3 text-right">Valeur</th>
                <th class="px-5 py-3 text-right">Rendement</th>
                <th class="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${placements.map(i => `
              <tr class="hover:bg-gray-50">
                <td class="px-5 py-3 font-medium">${i.nom}</td>
                <td class="px-5 py-3">${i.type || '—'}</td>
                <td class="px-5 py-3 text-right font-medium">${formatCurrency(i.valeur)}</td>
                <td class="px-5 py-3 text-right">${formatPercent(i.rendement || 0)}</td>
                <td class="px-5 py-3 text-center">
                  <button data-edit-plac="${i.id}" class="text-indigo-600 hover:text-indigo-800 mr-2">Modifier</button>
                  <button data-del-plac="${i.id}" class="text-red-500 hover:text-red-700">Supprimer</button>
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : '<p class="p-5 text-gray-400 text-sm">Aucun placement enregistré.</p>'}
      </div>

      <!-- Épargne -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-700">Épargne</h2>
          <button id="btn-add-epar" class="px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition">+ Ajouter</button>
        </div>
        ${epargne.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500">
              <tr>
                <th class="px-5 py-3 text-left">Nom</th>
                <th class="px-5 py-3 text-right">Solde</th>
                <th class="px-5 py-3 text-right">Taux</th>
                <th class="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${epargne.map(i => `
              <tr class="hover:bg-gray-50">
                <td class="px-5 py-3 font-medium">${i.nom}</td>
                <td class="px-5 py-3 text-right font-medium">${formatCurrency(i.solde)}</td>
                <td class="px-5 py-3 text-right">${formatPercent(i.tauxInteret || 0)}</td>
                <td class="px-5 py-3 text-center">
                  <button data-edit-epar="${i.id}" class="text-indigo-600 hover:text-indigo-800 mr-2">Modifier</button>
                  <button data-del-epar="${i.id}" class="text-red-500 hover:text-red-700">Supprimer</button>
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : '<p class="p-5 text-gray-400 text-sm">Aucun compte d\'épargne enregistré.</p>'}
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
    const types = [
      { value: 'AV', label: 'Assurance Vie' },
      { value: 'PEA', label: 'PEA' },
      { value: 'CTO', label: 'Compte-Titres' },
      { value: 'PER', label: 'PER' },
      { value: 'Crypto', label: 'Crypto' },
      { value: 'Autre', label: 'Autre' }
    ];
    const body = `
      ${inputField('nom', 'Nom', '', 'text', 'placeholder="Ex: AV Linxea Spirit"')}
      ${selectField('type', 'Type de placement', types)}
      ${inputField('valeur', 'Valeur actuelle (€)', '', 'number', 'step="100"')}
      ${inputField('rendement', 'Rendement annuel estimé', '0.05', 'number', 'step="0.005" min="0" max="1"')}
    `;
    openModal('Ajouter un placement', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      store.addItem('actifs.placements', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-plac]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editPlac;
      const item = store.get('actifs.placements').find(i => i.id === id);
      if (!item) return;
      const types = [
        { value: 'AV', label: 'Assurance Vie' },
        { value: 'PEA', label: 'PEA' },
        { value: 'CTO', label: 'Compte-Titres' },
        { value: 'PER', label: 'PER' },
        { value: 'Crypto', label: 'Crypto' },
        { value: 'Autre', label: 'Autre' }
      ];
      const body = `
        ${inputField('nom', 'Nom', item.nom)}
        ${selectField('type', 'Type de placement', types, item.type)}
        ${inputField('valeur', 'Valeur actuelle (€)', item.valeur, 'number', 'step="100"')}
        ${inputField('rendement', 'Rendement annuel estimé', item.rendement || 0.05, 'number', 'step="0.005" min="0" max="1"')}
      `;
      openModal('Modifier le placement', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
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
