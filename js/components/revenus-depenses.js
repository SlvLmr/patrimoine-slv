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
      <h1 class="text-2xl font-bold text-gray-100">Revenus & Dépenses</h1>

      <!-- KPI -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Revenus mensuels</p>
          </div>
          <p class="text-2xl font-bold text-accent-green">${formatCurrency(totalR)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-red">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-red/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Dépenses mensuelles</p>
          </div>
          <p class="text-2xl font-bold text-accent-red">${formatCurrency(totalD)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-blue">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg ${balance >= 0 ? 'bg-accent-blue/20' : 'bg-accent-red/20'} flex items-center justify-center">
              <svg class="w-5 h-5 ${balance >= 0 ? 'text-accent-blue' : 'text-accent-red'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Balance mensuelle</p>
          </div>
          <p class="text-2xl font-bold ${balance >= 0 ? 'text-accent-blue' : 'text-accent-red'}">${formatCurrency(balance)}</p>
        </div>
      </div>

      ${(totalR > 0 || totalD > 0) ? `
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Revenus vs Dépenses</h2>
        <div class="h-48">
          <canvas id="chart-rev-dep"></canvas>
        </div>
      </div>
      ` : ''}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Revenus -->
        <div class="card-dark rounded-xl overflow-hidden">
          <div class="p-5 border-b border-dark-400/30 flex justify-between items-center">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-accent-green"></div>
              <h2 class="text-lg font-semibold text-gray-200">Revenus</h2>
            </div>
            <button id="btn-add-revenu" class="px-4 py-2 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter</button>
          </div>
          ${revenus.length > 0 ? `
          <div class="divide-y divide-dark-400/20">
            ${revenus.map(r => `
            <div class="flex items-center justify-between px-5 py-3 hover:bg-dark-600/30 transition">
              <div>
                <p class="font-medium text-sm text-gray-200">${r.nom}</p>
                <p class="text-xs text-gray-600">${r.type || 'Autre'}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-medium text-accent-green">${formatCurrency(r.montantMensuel)}/mois</span>
                <button data-edit-rev="${r.id}" class="text-accent-blue hover:text-accent-blue/80 text-xs font-medium">Modifier</button>
                <button data-del-rev="${r.id}" class="text-accent-red/60 hover:text-accent-red text-xs font-medium">Suppr.</button>
              </div>
            </div>
            `).join('')}
          </div>
          ` : '<p class="p-5 text-gray-600 text-sm">Aucun revenu enregistré.</p>'}
        </div>

        <!-- Dépenses -->
        <div class="card-dark rounded-xl overflow-hidden">
          <div class="p-5 border-b border-dark-400/30 flex justify-between items-center">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-accent-red"></div>
              <h2 class="text-lg font-semibold text-gray-200">Dépenses</h2>
            </div>
            <button id="btn-add-depense" class="px-4 py-2 bg-gradient-to-r from-accent-red to-accent-red text-white text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter</button>
          </div>
          ${depenses.length > 0 ? `
          <div class="divide-y divide-dark-400/20">
            ${depenses.map(d => `
            <div class="flex items-center justify-between px-5 py-3 hover:bg-dark-600/30 transition">
              <div>
                <p class="font-medium text-sm text-gray-200">${d.nom}</p>
                <p class="text-xs text-gray-600">${d.categorie || 'Autre'}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="font-medium text-accent-red">${formatCurrency(d.montantMensuel)}/mois</span>
                <button data-edit-dep="${d.id}" class="text-accent-blue hover:text-accent-blue/80 text-xs font-medium">Modifier</button>
                <button data-del-dep="${d.id}" class="text-accent-red/60 hover:text-accent-red text-xs font-medium">Suppr.</button>
              </div>
            </div>
            `).join('')}
          </div>
          ` : '<p class="p-5 text-gray-600 text-sm">Aucune dépense enregistrée.</p>'}
        </div>
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  const content = document.getElementById('app-content');
  const totalR = store.totalRevenus();
  const totalD = store.totalDepenses();

  // Chart - dark theme
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
          x: {
            grid: { display: false },
            ticks: { color: COLORS.gridText }
          },
          y: {
            grid: { color: COLORS.grid },
            ticks: {
              color: COLORS.gridText,
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
