import { formatCurrency, formatDate, openModal, inputField, selectField, getFormData } from '../utils.js?v=5';
import { createChart, COLORS, createVerticalGradient } from '../charts/chart-config.js';

function heritageTotal(items) {
  return items.reduce((s, i) => s + (Number(i.montant) || 0), 0);
}

function heritageTotalByType(items, type) {
  return items.filter(i => i.type === type).reduce((s, i) => s + (Number(i.montant) || 0), 0);
}

export function render(store) {
  const items = store.get('heritage') || [];
  const total = heritageTotal(items);
  const totalImmo = heritageTotalByType(items, 'Immobilier');
  const totalLiq = heritageTotalByType(items, 'Liquidité');

  // Group by provenance (origin person)
  const byProvenance = {};
  items.forEach(item => {
    const key = item.provenance || 'Non précisé';
    if (!byProvenance[key]) byProvenance[key] = [];
    byProvenance[key].push(item);
  });

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-100">Héritage</h1>
        <button id="btn-add-heritage"
          class="px-4 py-2.5 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 rounded-lg hover:opacity-90 transition font-medium text-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Ajouter un héritage
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Héritage total estimé</p>
          <p class="text-2xl font-bold gradient-text">${formatCurrency(total)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full" style="background: ${COLORS.immobilier}"></div>
            <p class="text-sm text-gray-400">Immobilier</p>
          </div>
          <p class="text-2xl font-bold text-accent-green">${formatCurrency(totalImmo)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-blue">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full" style="background: ${COLORS.placements}"></div>
            <p class="text-sm text-gray-400">Liquidités</p>
          </div>
          <p class="text-2xl font-bold text-accent-amber">${formatCurrency(totalLiq)}</p>
        </div>
      </div>

      ${items.length > 0 ? `
      <!-- Chart -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Répartition par type</h2>
          <div class="h-56">
            <canvas id="chart-heritage-type"></canvas>
          </div>
        </div>
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Timeline des héritages</h2>
          <div class="h-56">
            <canvas id="chart-heritage-timeline"></canvas>
          </div>
        </div>
      </div>

      <!-- Grouped by provenance -->
      ${Object.entries(byProvenance).map(([provenance, provItems]) => {
        const provTotal = heritageTotal(provItems);
        return `
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-5 border-b border-dark-400/30 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-accent-green/20 to-accent-amber/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-200">${provenance}</h2>
              <p class="text-xs text-gray-500">${provItems.length} élément${provItems.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <p class="text-lg font-bold gradient-text">${formatCurrency(provTotal)}</p>
        </div>
        <div class="divide-y divide-dark-400/20">
          ${provItems.map(item => `
          <div class="p-4 hover:bg-dark-600/30 transition flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: ${item.type === 'Immobilier' ? COLORS.immobilier : COLORS.placements}20">
                <svg class="w-5 h-5" style="color: ${item.type === 'Immobilier' ? COLORS.immobilier : COLORS.placements}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  ${item.type === 'Immobilier'
                    ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3"/>'
                    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
                </svg>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-200">${item.nom}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs px-2 py-0.5 rounded-full ${item.type === 'Immobilier' ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-amber/10 text-accent-amber'}">${item.type}</span>
                  ${item.dateInjection ? `<span class="text-xs text-gray-500">Prévu : ${formatDate(item.dateInjection)}</span>` : ''}
                </div>
                ${item.description ? `<p class="text-xs text-gray-500 mt-1">${item.description}</p>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-3">
              <p class="text-lg font-semibold text-gray-100">${formatCurrency(item.montant)}</p>
              <div class="flex gap-1">
                <button data-edit-heritage="${item.id}" class="p-1.5 rounded-lg hover:bg-dark-500 transition text-gray-500 hover:text-accent-green" title="Modifier">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button data-delete-heritage="${item.id}" class="p-1.5 rounded-lg hover:bg-dark-500 transition text-gray-500 hover:text-accent-red" title="Supprimer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          `).join('')}
        </div>
      </div>
        `;
      }).join('')}

      ` : `
      <!-- Empty state -->
      <div class="card-dark rounded-xl p-12 text-center">
        <div class="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent-green/20 to-accent-amber/20 flex items-center justify-center mb-6">
          <svg class="w-10 h-10 text-accent-green/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-300 mb-2">Aucun héritage enregistré</h2>
        <p class="text-gray-500 max-w-md mx-auto mb-6">Ajoutez ici les biens et liquidités que vous prévoyez de recevoir en héritage, avec une date estimée d'injection dans votre patrimoine.</p>
        <button id="btn-add-heritage-empty"
          class="px-5 py-2.5 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 rounded-lg hover:opacity-90 transition font-medium text-sm inline-flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Ajouter mon premier héritage
        </button>
      </div>
      `}
    </div>
  `;
}

export function openHeritageModal(store, navigate, editItem = null, targetPage = 'heritage') {
  const title = editItem ? 'Modifier l\'héritage' : 'Ajouter un héritage';
  const body = `
    ${inputField('nom', 'Nom / Description', editItem?.nom || '', 'text', 'placeholder="Ex: Maison familiale, Assurance-vie maman..."')}
    ${selectField('type', 'Type', [
      { value: 'Immobilier', label: 'Immobilier' },
      { value: 'Liquidité', label: 'Liquidité' }
    ], editItem?.type || 'Immobilier')}
    ${inputField('montant', 'Montant estimé (€)', editItem?.montant || '', 'number', 'min="0" step="1000" placeholder="150000"')}
    ${inputField('provenance', 'Provenance (personne)', editItem?.provenance || '', 'text', 'placeholder="Ex: Parents, Grand-mère..."')}
    ${inputField('dateInjection', 'Date estimée d\'injection', editItem?.dateInjection || '', 'date')}
    <div class="mb-4">
      <label for="field-description" class="block text-sm font-medium text-gray-300 mb-1.5">Notes (optionnel)</label>
      <textarea name="description" id="field-description" rows="2"
        class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 placeholder-gray-600
        focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green/40 transition"
        placeholder="Détails supplémentaires...">${editItem?.description || ''}</textarea>
    </div>
  `;

  openModal(title, body, () => {
    const modal = document.getElementById('app-modal');
    const data = getFormData(modal.querySelector('#modal-body'));
    const desc = modal.querySelector('#field-description')?.value || '';
    data.description = desc;

    if (!data.nom || !data.montant) return;

    if (editItem) {
      store.updateItem('heritage', editItem.id, data);
    } else {
      store.addItem('heritage', data);
    }
    navigate(targetPage);
  });
}

export function mount(store, navigate) {
  const items = store.get('heritage') || [];

  const addBtn = document.getElementById('btn-add-heritage');
  const addBtnEmpty = document.getElementById('btn-add-heritage-empty');

  const openAdd = () => openHeritageModal(store, navigate);
  addBtn?.addEventListener('click', openAdd);
  addBtnEmpty?.addEventListener('click', openAdd);

  document.querySelectorAll('[data-edit-heritage]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items.find(i => i.id === btn.dataset.editHeritage);
      if (item) openHeritageModal(store, navigate, item);
    });
  });

  document.querySelectorAll('[data-delete-heritage]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cet élément d\'héritage ?')) {
        store.removeItem('heritage', btn.dataset.deleteHeritage);
        navigate('heritage');
      }
    });
  });

  // Charts
  if (items.length > 0) {
    const totalImmo = heritageTotalByType(items, 'Immobilier');
    const totalLiq = heritageTotalByType(items, 'Liquidité');

    if (document.getElementById('chart-heritage-type') && (totalImmo > 0 || totalLiq > 0)) {
      const data = [];
      const labels = [];
      const colors = [];

      if (totalImmo > 0) { data.push(totalImmo); labels.push('Immobilier'); colors.push(COLORS.immobilier); }
      if (totalLiq > 0) { data.push(totalLiq); labels.push('Liquidités'); colors.push(COLORS.placements); }

      createChart('chart-heritage-type', {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8, borderRadius: 4 }] },
        options: {
          cutout: '70%',
          plugins: {
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = ((ctx.raw / total) * 100).toFixed(1);
                  return ` ${ctx.label}: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(ctx.raw)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    if (document.getElementById('chart-heritage-timeline')) {
      const byYear = {};
      items.forEach(item => {
        const year = item.dateInjection ? new Date(item.dateInjection).getFullYear() : 'Non daté';
        if (!byYear[year]) byYear[year] = { immo: 0, liq: 0 };
        if (item.type === 'Immobilier') byYear[year].immo += Number(item.montant) || 0;
        else byYear[year].liq += Number(item.montant) || 0;
      });

      const years = Object.keys(byYear).sort();
      createChart('chart-heritage-timeline', {
        type: 'bar',
        data: {
          labels: years,
          datasets: [
            { label: 'Immobilier', data: years.map(y => byYear[y].immo), backgroundColor: COLORS.immobilier + 'cc', borderColor: COLORS.immobilier, borderWidth: 1, borderRadius: 6 },
            { label: 'Liquidités', data: years.map(y => byYear[y].liq), backgroundColor: COLORS.placements + 'cc', borderColor: COLORS.placements, borderWidth: 1, borderRadius: 6 }
          ]
        },
        options: {
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: COLORS.gridText } },
            y: { stacked: true, grid: { color: COLORS.grid }, ticks: { color: COLORS.gridText, callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) } }
          }
        }
      });
    }
  }
}
