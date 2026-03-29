import { formatCurrency, formatPercent, openModal, getFormData, inputField } from '../utils.js?v=8';

export function render(store) {
  const emprunts = store.get('passifs.emprunts');
  const totalDette = store.totalPassifs();
  const totalMensualites = emprunts.reduce((s, e) => s + (Number(e.mensualite) || 0), 0);
  const totalRevenus = store.totalRevenus();
  const tauxEndettement = totalRevenus > 0 ? totalMensualites / totalRevenus : 0;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-100">Gestion des passifs</h1>

      <!-- KPI -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card glow-red">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-red/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Dette totale</p>
          </div>
          <p class="text-2xl font-bold text-accent-red">${formatCurrency(totalDette)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-blue/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Mensualités</p>
          </div>
          <p class="text-2xl font-bold text-gray-200">${formatCurrency(totalMensualites)}<span class="text-sm font-normal text-gray-500">/mois</span></p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg ${tauxEndettement > 0.35 ? 'bg-accent-red/20' : 'bg-accent-green/20'} flex items-center justify-center">
              <svg class="w-5 h-5 ${tauxEndettement > 0.35 ? 'text-accent-red' : 'text-accent-green'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Taux d'endettement</p>
          </div>
          <p class="text-2xl font-bold ${tauxEndettement > 0.35 ? 'text-accent-red' : 'text-accent-green'}">${formatPercent(tauxEndettement)}</p>
          ${tauxEndettement > 0.35 ? '<p class="text-xs text-accent-red/70 mt-1">Au-dessus du seuil de 35%</p>' : ''}
        </div>
      </div>

      <!-- Table -->
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-5 border-b border-dark-400/30 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-accent-red/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/>
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-gray-200">Emprunts</h2>
          </div>
          <button id="btn-add-emprunt" class="px-4 py-2 bg-gradient-to-r from-accent-red to-accent-red text-white text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter</button>
        </div>
        ${emprunts.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-dark-800/50 text-gray-500">
              <tr>
                <th class="px-5 py-3 text-left">Nom</th>
                <th class="px-5 py-3 text-right">Capital restant</th>
                <th class="px-5 py-3 text-right">Taux</th>
                <th class="px-5 py-3 text-right">Mensualité</th>
                <th class="px-5 py-3 text-right">Durée restante</th>
                <th class="px-5 py-3 text-right">Avancement</th>
                <th class="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${emprunts.map(e => {
                const paidPct = e.capitalInitial ? Math.min(100, ((Number(e.capitalInitial) - Number(e.capitalRestant)) / Number(e.capitalInitial)) * 100) : 0;
                return `
              <tr class="hover:bg-dark-600/30 transition">
                <td class="px-5 py-3 font-medium text-gray-200">${e.nom}</td>
                <td class="px-5 py-3 text-right text-accent-red">${formatCurrency(e.capitalRestant)}</td>
                <td class="px-5 py-3 text-right text-gray-400">${formatPercent(e.tauxInteret || 0)}</td>
                <td class="px-5 py-3 text-right text-gray-300">${formatCurrency(e.mensualite)}</td>
                <td class="px-5 py-3 text-right text-gray-400">${e.dureeRestanteMois || 0} mois</td>
                <td class="px-5 py-3 text-right">
                  <div class="flex items-center gap-2 justify-end">
                    <div class="progress-bar h-1.5 w-16">
                      <div class="progress-bar-fill h-full bg-accent-green" style="width: ${paidPct}%"></div>
                    </div>
                    <span class="text-xs text-gray-500">${paidPct.toFixed(0)}%</span>
                  </div>
                </td>
                <td class="px-5 py-3 text-center">
                  <button data-edit-emprunt="${e.id}" class="text-accent-blue hover:text-accent-blue/80 mr-3 text-xs font-medium">Modifier</button>
                  <button data-del-emprunt="${e.id}" class="text-accent-red/60 hover:text-accent-red text-xs font-medium">Suppr.</button>
                </td>
              </tr>
              `;}).join('')}
            </tbody>
          </table>
        </div>
        ` : '<p class="p-5 text-gray-600 text-sm">Aucun emprunt enregistré.</p>'}
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  const content = document.getElementById('app-content');

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
      navigate('passifs');
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
