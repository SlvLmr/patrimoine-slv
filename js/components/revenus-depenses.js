import { formatCurrency, openModal, getFormData, inputField, selectField } from '../utils.js';
import { createChart, COLORS } from '../charts/chart-config.js';

export function render(store) {
  const revenus = store.get('revenus');
  const depenses = store.get('depenses');
  const totalR = store.totalRevenus();
  const totalD = store.totalDepenses();
  const balance = totalR - totalD;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Revenus & Dépenses</h1>

      <!-- KPI -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Revenus mensuels</p>
          <p class="text-2xl font-bold text-emerald-600">${formatCurrency(totalR)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Dépenses mensuelles</p>
          <p class="text-2xl font-bold text-rose-500">${formatCurrency(totalD)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Balance mensuelle</p>
          <p class="text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}">${formatCurrency(balance)}</p>
        </div>
      </div>

      ${(totalR > 0 || totalD > 0) ? `
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-700 mb-4">Revenus vs Dépenses</h2>
        <div class="h-48">
          <canvas id="chart-rev-dep"></canvas>
        </div>
      </div>
      ` : ''}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Revenus -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-700">Revenus</h2>
            <button id="btn-add-revenu" class="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition">+ Ajouter</button>
          </div>
          ${revenus.length > 0 ? `
          <div class="divide-y divide-gray-50">
            ${revenus.map(r => `
            <div class="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
              <div>
                <p class="font-medium text-sm">${r.nom}</p>
                <p class="text-xs text-gray-400">${r.type || 'Autre'}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-medium text-emerald-600">${formatCurrency(r.montantMensuel)}/mois</span>
                <button data-edit-rev="${r.id}" class="text-indigo-600 hover:text-indigo-800 text-sm">Modifier</button>
                <button data-del-rev="${r.id}" class="text-red-500 hover:text-red-700 text-sm">Suppr.</button>
              </div>
            </div>
            `).join('')}
          </div>
          ` : '<p class="p-5 text-gray-400 text-sm">Aucun revenu enregistré.</p>'}
        </div>

        <!-- Dépenses -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="p-5 border-b border-gray-100 flex justify-between items-center">
            <h2 class="text-lg font-semibold text-gray-700">Dépenses</h2>
            <button id="btn-add-depense" class="px-4 py-2 bg-rose-500 text-white text-sm rounded-lg hover:bg-rose-600 transition">+ Ajouter</button>
          </div>
          ${depenses.length > 0 ? `
          <div class="divide-y divide-gray-50">
            ${depenses.map(d => `
            <div class="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
              <div>
                <p class="font-medium text-sm">${d.nom}</p>
                <p class="text-xs text-gray-400">${d.categorie || 'Autre'}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-medium text-rose-500">${formatCurrency(d.montantMensuel)}/mois</span>
                <button data-edit-dep="${d.id}" class="text-indigo-600 hover:text-indigo-800 text-sm">Modifier</button>
                <button data-del-dep="${d.id}" class="text-red-500 hover:text-red-700 text-sm">Suppr.</button>
              </div>
            </div>
            `).join('')}
          </div>
          ` : '<p class="p-5 text-gray-400 text-sm">Aucune dépense enregistrée.</p>'}
        </div>
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  const content = document.getElementById('app-content');
  const totalR = store.totalRevenus();
  const totalD = store.totalDepenses();

  // Chart
  if (document.getElementById('chart-rev-dep') && (totalR > 0 || totalD > 0)) {
    createChart('chart-rev-dep', {
      type: 'bar',
      data: {
        labels: ['Mensuel', 'Annuel'],
        datasets: [
          {
            label: 'Revenus',
            data: [totalR, totalR * 12],
            backgroundColor: COLORS.revenus,
            borderRadius: 6
          },
          {
            label: 'Dépenses',
            data: [totalD, totalD * 12],
            backgroundColor: COLORS.depenses,
            borderRadius: 6
          }
        ]
      },
      options: {
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: COLORS.grid },
            ticks: {
              callback: v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: 'compact' }).format(v)
            }
          }
        }
      }
    });
  }

  // Revenus
  const revenuTypes = [
    { value: 'Salaire', label: 'Salaire' },
    { value: 'Loyers', label: 'Revenus locatifs' },
    { value: 'Dividendes', label: 'Dividendes' },
    { value: 'Freelance', label: 'Freelance' },
    { value: 'Autre', label: 'Autre' }
  ];

  document.getElementById('btn-add-revenu')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Libellé', '', 'text', 'placeholder="Ex: Salaire net"')}
      ${selectField('type', 'Type', revenuTypes)}
      ${inputField('montantMensuel', 'Montant mensuel (€)', '', 'number', 'step="50"')}
    `;
    openModal('Ajouter un revenu', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      store.addItem('revenus', data);
      navigate('revenus-depenses');
    });
  });

  content.querySelectorAll('[data-edit-rev]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editRev;
      const item = store.get('revenus').find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Libellé', item.nom)}
        ${selectField('type', 'Type', revenuTypes, item.type)}
        ${inputField('montantMensuel', 'Montant mensuel (€)', item.montantMensuel, 'number', 'step="50"')}
      `;
      openModal('Modifier le revenu', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        store.updateItem('revenus', id, data);
        navigate('revenus-depenses');
      });
    });
  });

  content.querySelectorAll('[data-del-rev]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer ce revenu ?')) {
        store.removeItem('revenus', btn.dataset.delRev);
        navigate('revenus-depenses');
      }
    });
  });

  // Dépenses
  const depCategories = [
    { value: 'Logement', label: 'Logement' },
    { value: 'Alimentation', label: 'Alimentation' },
    { value: 'Transport', label: 'Transport' },
    { value: 'Santé', label: 'Santé' },
    { value: 'Loisirs', label: 'Loisirs' },
    { value: 'Abonnements', label: 'Abonnements' },
    { value: 'Assurances', label: 'Assurances' },
    { value: 'Éducation', label: 'Éducation' },
    { value: 'Autre', label: 'Autre' }
  ];

  document.getElementById('btn-add-depense')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Libellé', '', 'text', 'placeholder="Ex: Loyer"')}
      ${selectField('categorie', 'Catégorie', depCategories)}
      ${inputField('montantMensuel', 'Montant mensuel (€)', '', 'number', 'step="10"')}
    `;
    openModal('Ajouter une dépense', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      store.addItem('depenses', data);
      navigate('revenus-depenses');
    });
  });

  content.querySelectorAll('[data-edit-dep]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editDep;
      const item = store.get('depenses').find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Libellé', item.nom)}
        ${selectField('categorie', 'Catégorie', depCategories, item.categorie)}
        ${inputField('montantMensuel', 'Montant mensuel (€)', item.montantMensuel, 'number', 'step="10"')}
      `;
      openModal('Modifier la dépense', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        store.updateItem('depenses', id, data);
        navigate('revenus-depenses');
      });
    });
  });

  content.querySelectorAll('[data-del-dep]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cette dépense ?')) {
        store.removeItem('depenses', btn.dataset.delDep);
        navigate('revenus-depenses');
      }
    });
  });
}
