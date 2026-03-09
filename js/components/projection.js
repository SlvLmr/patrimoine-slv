import { formatCurrency, formatPercent, computeProjection, inputField, getFormData } from '../utils.js';
import { createChart, COLORS } from '../charts/chart-config.js';

export function render(store) {
  const params = store.get('parametres');
  const snapshots = computeProjection(store);
  const last = snapshots[snapshots.length - 1];

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Projection patrimoniale</h1>

      <!-- Parameters -->
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-700 mb-4">Paramètres de simulation</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Horizon (années)</label>
            <input type="number" id="param-years" value="${params.projectionYears}" min="1" max="50" step="1"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Inflation annuelle</label>
            <input type="number" id="param-inflation" value="${params.inflationRate}" min="0" max="0.2" step="0.005"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rendement immobilier</label>
            <input type="number" id="param-rend-immo" value="${params.rendementImmobilier}" min="0" max="0.3" step="0.005"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rendement placements</label>
            <input type="number" id="param-rend-plac" value="${params.rendementPlacements}" min="0" max="0.3" step="0.005"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rendement épargne</label>
            <input type="number" id="param-rend-epar" value="${params.rendementEpargne}" min="0" max="0.3" step="0.005"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
          </div>
          <div class="flex items-end">
            <button id="btn-update-projection" class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              Recalculer
            </button>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Patrimoine net aujourd'hui</p>
          <p class="text-2xl font-bold text-gray-800">${formatCurrency(snapshots[0]?.patrimoineNet || 0)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Patrimoine net dans ${params.projectionYears} ans</p>
          <p class="text-2xl font-bold text-indigo-600">${formatCurrency(last?.patrimoineNet || 0)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Évolution</p>
          <p class="text-2xl font-bold text-emerald-600">
            ${snapshots[0]?.patrimoineNet ? `+${formatCurrency((last?.patrimoineNet || 0) - snapshots[0].patrimoineNet)}` : '—'}
          </p>
        </div>
      </div>

      <!-- Chart -->
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-700 mb-4">Évolution du patrimoine</h2>
        <div class="h-80">
          <canvas id="chart-projection"></canvas>
        </div>
      </div>

      <!-- Stacked area chart -->
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-700 mb-4">Répartition des actifs dans le temps</h2>
        <div class="h-80">
          <canvas id="chart-repartition-temps"></canvas>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-5 border-b border-gray-100">
          <h2 class="text-lg font-semibold text-gray-700">Détail année par année</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 text-gray-500">
              <tr>
                <th class="px-4 py-3 text-left">Année</th>
                <th class="px-4 py-3 text-right">Immobilier</th>
                <th class="px-4 py-3 text-right">Placements</th>
                <th class="px-4 py-3 text-right">Épargne</th>
                <th class="px-4 py-3 text-right">Total actifs</th>
                <th class="px-4 py-3 text-right">Dette</th>
                <th class="px-4 py-3 text-right font-semibold">Patrimoine net</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${snapshots.map(s => `
              <tr class="hover:bg-gray-50 ${s.annee === 0 ? 'bg-indigo-50/50' : ''}">
                <td class="px-4 py-2 font-medium">${s.annee === 0 ? 'Actuel' : `+${s.annee} an${s.annee > 1 ? 's' : ''}`}</td>
                <td class="px-4 py-2 text-right">${formatCurrency(s.immobilier)}</td>
                <td class="px-4 py-2 text-right">${formatCurrency(s.placements)}</td>
                <td class="px-4 py-2 text-right">${formatCurrency(s.epargne)}</td>
                <td class="px-4 py-2 text-right">${formatCurrency(s.totalActifs)}</td>
                <td class="px-4 py-2 text-right text-red-500">${formatCurrency(s.totalDette)}</td>
                <td class="px-4 py-2 text-right font-semibold ${s.patrimoineNet >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(s.patrimoineNet)}</td>
              </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  const snapshots = computeProjection(store);
  const labels = snapshots.map(s => s.annee === 0 ? 'Actuel' : `+${s.annee}`);

  // Line chart
  if (document.getElementById('chart-projection')) {
    createChart('chart-projection', {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total actifs',
            data: snapshots.map(s => s.totalActifs),
            borderColor: COLORS.placements,
            backgroundColor: COLORS.placements + '20',
            fill: false,
            tension: 0.3,
            pointRadius: 2
          },
          {
            label: 'Dette',
            data: snapshots.map(s => s.totalDette),
            borderColor: COLORS.dette,
            backgroundColor: COLORS.dette + '20',
            fill: false,
            tension: 0.3,
            pointRadius: 2
          },
          {
            label: 'Patrimoine net',
            data: snapshots.map(s => s.patrimoineNet),
            borderColor: COLORS.patrimoine,
            backgroundColor: COLORS.patrimoine + '20',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 3
          }
        ]
      },
      options: {
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: COLORS.grid },
            ticks: {
              callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
            }
          }
        }
      }
    });
  }

  // Stacked area
  if (document.getElementById('chart-repartition-temps')) {
    createChart('chart-repartition-temps', {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Immobilier',
            data: snapshots.map(s => s.immobilier),
            borderColor: COLORS.immobilier,
            backgroundColor: COLORS.immobilier + '40',
            fill: true,
            tension: 0.3,
            pointRadius: 0
          },
          {
            label: 'Placements',
            data: snapshots.map(s => s.placements),
            borderColor: COLORS.placements,
            backgroundColor: COLORS.placements + '40',
            fill: true,
            tension: 0.3,
            pointRadius: 0
          },
          {
            label: 'Épargne',
            data: snapshots.map(s => s.epargne),
            borderColor: COLORS.epargne,
            backgroundColor: COLORS.epargne + '40',
            fill: true,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        scales: {
          x: { grid: { display: false } },
          y: {
            stacked: true,
            grid: { color: COLORS.grid },
            ticks: {
              callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
            }
          }
        }
      }
    });
  }

  // Update params
  document.getElementById('btn-update-projection')?.addEventListener('click', () => {
    store.set('parametres.projectionYears', parseInt(document.getElementById('param-years').value) || 20);
    store.set('parametres.inflationRate', parseFloat(document.getElementById('param-inflation').value) || 0.02);
    store.set('parametres.rendementImmobilier', parseFloat(document.getElementById('param-rend-immo').value) || 0.02);
    store.set('parametres.rendementPlacements', parseFloat(document.getElementById('param-rend-plac').value) || 0.05);
    store.set('parametres.rendementEpargne', parseFloat(document.getElementById('param-rend-epar').value) || 0.02);
    navigate('projection');
  });
}
