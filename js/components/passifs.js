import { formatCurrency, formatPercent, openModal, getFormData, inputField } from '../utils.js';

export function render(store) {
  const emprunts = store.get('passifs.emprunts');
  const totalDette = store.totalPassifs();
  const totalMensualites = emprunts.reduce((s, e) => s + (Number(e.mensualite) || 0), 0);
  const totalRevenus = store.totalRevenus();
  const tauxEndettement = totalRevenus > 0 ? totalMensualites / totalRevenus : 0;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Gestion des passifs</h1>

      <!-- KPI -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Dette totale</p>
          <p class="text-2xl font-bold text-red-500">${formatCurrency(totalDette)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Mensualités totales</p>
          <p class="text-2xl font-bold text-gray-800">${formatCurrency(totalMensualites)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Taux d'endettement</p>
          <p class="text-2xl font-bold ${tauxEndettement > 0.35 ? 'text-red-600' : 'text-emerald-600'}">${formatPercent(tauxEndettement)}</p>
          ${tauxEndettement > 0.35 ? '<p class="text-xs text-red-500 mt-1">Au-dessus du seuil recommandé de 35%</p>' : ''}
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-5 border-b border-gray-100 flex justify-between items-center">
          <h2 class="text-lg font-semibold text-gray-700">Emprunts</h2>
          <button id="btn-add-emprunt" class="px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition">+ Ajouter</button>
        </div>
        ${emprunts.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500">
              <tr>
                <th class="px-5 py-3 text-left">Nom</th>
                <th class="px-5 py-3 text-right">Capital restant</th>
                <th class="px-5 py-3 text-right">Taux</th>
                <th class="px-5 py-3 text-right">Mensualité</th>
                <th class="px-5 py-3 text-right">Durée restante</th>
                <th class="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${emprunts.map(e => `
              <tr class="hover:bg-gray-50">
                <td class="px-5 py-3 font-medium">${e.nom}</td>
                <td class="px-5 py-3 text-right">${formatCurrency(e.capitalRestant)}</td>
                <td class="px-5 py-3 text-right">${formatPercent(e.tauxInteret || 0)}</td>
                <td class="px-5 py-3 text-right">${formatCurrency(e.mensualite)}</td>
                <td class="px-5 py-3 text-right">${e.dureeRestanteMois || 0} mois</td>
                <td class="px-5 py-3 text-center">
                  <button data-edit-emprunt="${e.id}" class="text-indigo-600 hover:text-indigo-800 mr-2">Modifier</button>
                  <button data-del-emprunt="${e.id}" class="text-red-500 hover:text-red-700">Supprimer</button>
                </td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : '<p class="p-5 text-gray-400 text-sm">Aucun emprunt enregistré.</p>'}
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  const content = document.getElementById('app-content');

  const empruntForm = () => `
    ${inputField('nom', "Nom de l'emprunt", '', 'text', 'placeholder="Ex: Prêt immobilier RP"')}
    ${inputField('capitalInitial', 'Capital initial (€)', '', 'number', 'step="1000"')}
    ${inputField('capitalRestant', 'Capital restant dû (€)', '', 'number', 'step="1000"')}
    ${inputField('tauxInteret', 'Taux d\'intérêt annuel', '0.02', 'number', 'step="0.001" min="0" max="1"')}
    ${inputField('mensualite', 'Mensualité (€)', '', 'number', 'step="10"')}
    ${inputField('dureeRestanteMois', 'Durée restante (mois)', '', 'number', 'step="1"')}
    ${inputField('dateDebut', 'Date de début', '', 'date')}
  `;

  document.getElementById('btn-add-emprunt')?.addEventListener('click', () => {
    openModal('Ajouter un emprunt', empruntForm(), () => {
      const data = getFormData(document.getElementById('modal-body'));
      store.addItem('passifs.emprunts', data);
      navigate('passifs');
    });
  });

  content.querySelectorAll('[data-edit-emprunt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editEmprunt;
      const item = store.get('passifs.emprunts').find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', "Nom de l'emprunt", item.nom)}
        ${inputField('capitalInitial', 'Capital initial (€)', item.capitalInitial, 'number', 'step="1000"')}
        ${inputField('capitalRestant', 'Capital restant dû (€)', item.capitalRestant, 'number', 'step="1000"')}
        ${inputField('tauxInteret', 'Taux d\'intérêt annuel', item.tauxInteret || 0.02, 'number', 'step="0.001" min="0" max="1"')}
        ${inputField('mensualite', 'Mensualité (€)', item.mensualite, 'number', 'step="10"')}
        ${inputField('dureeRestanteMois', 'Durée restante (mois)', item.dureeRestanteMois, 'number', 'step="1"')}
        ${inputField('dateDebut', 'Date de début', item.dateDebut || '', 'date')}
      `;
      openModal("Modifier l'emprunt", body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        store.updateItem('passifs.emprunts', id, data);
        navigate('passifs');
      });
    });
  });

  content.querySelectorAll('[data-del-emprunt]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cet emprunt ?')) {
        store.removeItem('passifs.emprunts', btn.dataset.delEmprunt);
        navigate('passifs');
      }
    });
  });
}
