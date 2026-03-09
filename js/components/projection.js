import { formatCurrency, formatPercent, computeProjection, inputField, getFormData } from '../utils.js';
import { createChart, COLORS, createVerticalGradient } from '../charts/chart-config.js';

export function render(store) {
  const params = store.get('parametres');
  const snapshots = computeProjection(store);
  const groupKeys = snapshots.groupKeys || [];
  const last = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const evolution = (last?.patrimoineNet || 0) - (first?.patrimoineNet || 0);
  const evolutionPct = first?.patrimoineNet ? evolution / Math.abs(first.patrimoineNet) : 0;

  // Color map for placement groups
  const groupColors = {
    'PEA ETF': 'text-emerald-400',
    'PEA Actions': 'text-sky-400',
    'PEA-PME ETF': 'text-teal-400',
    'PEA-PME Actions': 'text-cyan-400',
    'Assurance Vie': 'text-pink-400',
    'CTO': 'text-orange-400',
    'PER': 'text-indigo-400',
    'Crypto': 'text-yellow-400',
    'Autre': 'text-gray-400'
  };
  const defaultGroupColor = 'text-blue-400';

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-100">Projection patrimoniale</h1>

      <!-- Parameters -->
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Paramètres de simulation</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Horizon (années)</label>
            <input type="number" id="param-years" value="${params.projectionYears}" min="1" max="50" step="1"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Âge fin d'année</label>
            <input type="number" id="param-age" value="${params.ageFinAnnee || 43}" min="18" max="100" step="1"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Âge retraite taux plein</label>
            <input type="number" id="param-retraite" value="${params.ageRetraite || 64}" min="55" max="70" step="1"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Inflation annuelle</label>
            <input type="number" id="param-inflation" value="${params.inflationRate}" min="0" max="0.2" step="0.005"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Rendement immobilier</label>
            <input type="number" id="param-rend-immo" value="${params.rendementImmobilier}" min="0" max="0.3" step="0.005"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Rendement placements</label>
            <input type="number" id="param-rend-plac" value="${params.rendementPlacements}" min="0" max="0.3" step="0.005"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Rendement épargne</label>
            <input type="number" id="param-rend-epar" value="${params.rendementEpargne}" min="0" max="0.3" step="0.005"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div class="flex items-end">
            <button id="btn-update-projection" class="w-full px-4 py-2.5 bg-gradient-to-r from-accent-green to-accent-blue text-white rounded-lg hover:opacity-90 transition font-medium">
              Recalculer
            </button>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Patrimoine net aujourd'hui</p>
          <p class="text-2xl font-bold text-gray-200">${formatCurrency(first?.patrimoineNet || 0)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-blue">
          <p class="text-sm text-gray-400 mb-2">Dans ${params.projectionYears} ans</p>
          <p class="text-2xl font-bold gradient-text">${formatCurrency(last?.patrimoineNet || 0)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <p class="text-sm text-gray-400 mb-2">Évolution</p>
          <div class="flex items-center gap-3">
            <p class="text-2xl font-bold ${evolution >= 0 ? 'text-accent-green' : 'text-accent-red'}">
              ${evolution >= 0 ? '+' : ''}${formatCurrency(evolution)}
            </p>
            ${evolutionPct ? `
            <span class="text-sm px-2 py-0.5 rounded-full ${evolution >= 0 ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}">
              ${evolution >= 0 ? '+' : ''}${(evolutionPct * 100).toFixed(0)}%
            </span>` : ''}
          </div>
        </div>
      </div>

      <!-- Charts -->
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Évolution du patrimoine</h2>
        <div class="h-80">
          <canvas id="chart-projection"></canvas>
        </div>
      </div>

      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Répartition des actifs dans le temps</h2>
        <div class="h-80">
          <canvas id="chart-repartition-temps"></canvas>
        </div>
      </div>

      <!-- Detailed Table -->
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-5 border-b border-dark-400/30">
          <h2 class="text-lg font-semibold text-gray-200">Détail année par année</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-dark-800/50 text-gray-500">
              <tr>
                <th class="px-3 py-3 text-left">Année</th>
                <th class="px-3 py-3 text-center">Âge</th>
                <th class="px-3 py-3 text-right">Immobilier</th>
                ${groupKeys.map(k => `<th class="px-3 py-3 text-right">${k}</th>`).join('')}
                <th class="px-3 py-3 text-right">Épargne</th>
                <th class="px-3 py-3 text-right">Intérêts annuels</th>
                <th class="px-3 py-3 text-right">Cash après impôt</th>
                <th class="px-3 py-3 text-right">Total actifs</th>
                <th class="px-3 py-3 text-right">Dette</th>
                <th class="px-3 py-3 text-right font-semibold">Patrimoine net</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${snapshots.map(s => {
                const isRetirement = s.isRetraite;
                const rowClass = isRetirement
                  ? 'bg-amber-500/10 border-l-4 border-l-amber-400'
                  : s.annee === 0
                    ? 'bg-accent-blue/5'
                    : '';
                return `
              <tr class="hover:bg-dark-600/30 transition ${rowClass}">
                <td class="px-3 py-2 font-medium text-gray-300">
                  ${s.annee === 0 ? 'Actuel' : `+${s.annee} an${s.annee > 1 ? 's' : ''}`}
                  ${isRetirement ? '<span class="ml-1 text-xs text-amber-400 font-semibold">RETRAITE</span>' : ''}
                </td>
                <td class="px-3 py-2 text-center ${isRetirement ? 'text-amber-400 font-bold' : 'text-gray-400'}">${s.age} ans</td>
                <td class="px-3 py-2 text-right text-purple-400/80">${formatCurrency(s.immobilier)}</td>
                ${groupKeys.map(k => `<td class="px-3 py-2 text-right ${groupColors[k] || defaultGroupColor}">${formatCurrency(s.placementDetail[k] || 0)}</td>`).join('')}
                <td class="px-3 py-2 text-right text-amber-400/80">${formatCurrency(s.epargne)}</td>
                <td class="px-3 py-2 text-right ${s.interetsAnnuels > 0 ? 'text-lime-400/80' : 'text-gray-600'}">${s.annee === 0 ? '—' : formatCurrency(s.interetsAnnuels)}</td>
                <td class="px-3 py-2 text-right ${s.cashApresImpot >= 0 ? 'text-teal-400/80' : 'text-accent-red/70'}">${formatCurrency(s.cashApresImpot)}</td>
                <td class="px-3 py-2 text-right text-gray-300">${formatCurrency(s.totalActifs)}</td>
                <td class="px-3 py-2 text-right text-accent-red/70">${formatCurrency(s.totalDette)}</td>
                <td class="px-3 py-2 text-right font-semibold ${s.patrimoineNet >= 0 ? 'text-accent-green' : 'text-accent-red'}">${formatCurrency(s.patrimoineNet)}</td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  const snapshots = computeProjection(store);
  const groupKeys = snapshots.groupKeys || [];
  const labels = snapshots.map(s => s.annee === 0 ? 'Actuel' : `+${s.annee}`);

  // Line chart with gradient fills
  if (document.getElementById('chart-projection')) {
    const canvas = document.getElementById('chart-projection');
    const ctx2d = canvas.getContext('2d');

    const gradActifs = ctx2d.createLinearGradient(0, 0, canvas.width, 0);
    gradActifs.addColorStop(0, '#00d4aa');
    gradActifs.addColorStop(1, '#38bdf8');

    const gradDette = ctx2d.createLinearGradient(0, 0, canvas.width, 0);
    gradDette.addColorStop(0, '#ff4757');
    gradDette.addColorStop(1, '#ec4899');

    const gradNet = ctx2d.createLinearGradient(0, 0, canvas.width, 0);
    gradNet.addColorStop(0, '#5b7fff');
    gradNet.addColorStop(1, '#a855f7');

    createChart('chart-projection', {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total actifs',
            data: snapshots.map(s => s.totalActifs),
            borderColor: gradActifs,
            backgroundColor: createVerticalGradient(ctx2d, '#00d4aa', 0.25, 0.0),
            fill: true,
            tension: 0.45,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#00d4aa',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            borderWidth: 2.5
          },
          {
            label: 'Dette',
            data: snapshots.map(s => s.totalDette),
            borderColor: gradDette,
            backgroundColor: createVerticalGradient(ctx2d, '#ff4757', 0.15, 0.0),
            fill: true,
            tension: 0.45,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#ff4757',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            borderWidth: 2.5
          },
          {
            label: 'Patrimoine net',
            data: snapshots.map(s => s.patrimoineNet),
            borderColor: gradNet,
            backgroundColor: createVerticalGradient(ctx2d, '#5b7fff', 0.3, 0.0),
            fill: true,
            tension: 0.45,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#5b7fff',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
            borderWidth: 3
          }
        ]
      },
      options: {
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: COLORS.gridText }
          },
          y: {
            grid: { color: COLORS.grid },
            ticks: {
              color: COLORS.gridText,
              callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
            }
          }
        }
      }
    });
  }

  // Stacked area chart - now with detailed groups
  if (document.getElementById('chart-repartition-temps')) {
    const canvas = document.getElementById('chart-repartition-temps');
    const ctx2d = canvas.getContext('2d');

    const chartColors = ['#a855f7', '#10b981', '#38bdf8', '#f472b6', '#f97316', '#818cf8', '#eab308', '#6b7280'];
    const datasets = [];

    // Immobilier
    datasets.push({
      label: 'Immobilier',
      data: snapshots.map(s => s.immobilier),
      borderColor: '#a855f7',
      backgroundColor: createVerticalGradient(ctx2d, '#a855f7', 0.5, 0.05),
      fill: true,
      tension: 0.45,
      pointRadius: 0,
      borderWidth: 2
    });

    // Each placement group
    groupKeys.forEach((k, i) => {
      const color = chartColors[(i + 1) % chartColors.length];
      datasets.push({
        label: k,
        data: snapshots.map(s => s.placementDetail[k] || 0),
        borderColor: color,
        backgroundColor: createVerticalGradient(ctx2d, color, 0.5, 0.05),
        fill: true,
        tension: 0.45,
        pointRadius: 0,
        borderWidth: 2
      });
    });

    // Épargne
    datasets.push({
      label: 'Épargne',
      data: snapshots.map(s => s.epargne),
      borderColor: '#f59e0b',
      backgroundColor: createVerticalGradient(ctx2d, '#f59e0b', 0.5, 0.05),
      fill: true,
      tension: 0.45,
      pointRadius: 0,
      borderWidth: 2
    });

    createChart('chart-repartition-temps', {
      type: 'line',
      data: { labels, datasets },
      options: {
        interaction: { intersect: false, mode: 'index' },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: COLORS.gridText }
          },
          y: {
            stacked: true,
            grid: { color: COLORS.grid },
            ticks: {
              color: COLORS.gridText,
              callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
            }
          }
        }
      }
    });
  }

  // Update params
  document.getElementById('btn-update-projection')?.addEventListener('click', () => {
    store.set('parametres.projectionYears', parseInt(document.getElementById('param-years').value) || 30);
    store.set('parametres.ageFinAnnee', parseInt(document.getElementById('param-age').value) || 43);
    store.set('parametres.ageRetraite', parseInt(document.getElementById('param-retraite').value) || 64);
    store.set('parametres.inflationRate', parseFloat(document.getElementById('param-inflation').value) || 0.02);
    store.set('parametres.rendementImmobilier', parseFloat(document.getElementById('param-rend-immo').value) || 0.02);
    store.set('parametres.rendementPlacements', parseFloat(document.getElementById('param-rend-plac').value) || 0.05);
    store.set('parametres.rendementEpargne', parseFloat(document.getElementById('param-rend-epar').value) || 0.02);
    navigate('projection');
  });
}
