import { formatCurrency } from '../utils.js';
import { createChart, COLORS, PALETTE, destroyAllCharts } from '../charts/chart-config.js';

export function render(store) {
  const totalActifs = store.totalActifs();
  const totalPassifs = store.totalPassifs();
  const patrimoineNet = store.patrimoineNet();
  const capacite = store.capaciteEpargne();
  const state = store.getAll();

  const immoTotal = state.actifs.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const placTotal = state.actifs.placements.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const eparTotal = state.actifs.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);

  const hasData = totalActifs > 0 || totalPassifs > 0;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Tableau de bord</h1>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Total Actifs</p>
          <p class="text-2xl font-bold text-indigo-600">${formatCurrency(totalActifs)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Total Passifs</p>
          <p class="text-2xl font-bold text-red-500">${formatCurrency(totalPassifs)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Patrimoine Net</p>
          <p class="text-2xl font-bold ${patrimoineNet >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatCurrency(patrimoineNet)}</p>
        </div>
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p class="text-sm text-gray-500 mb-1">Capacité d'épargne / mois</p>
          <p class="text-2xl font-bold ${capacite >= 0 ? 'text-blue-600' : 'text-red-600'}">${formatCurrency(capacite)}</p>
        </div>
      </div>

      ${hasData ? `
      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 class="text-lg font-semibold text-gray-700 mb-4">Répartition des actifs</h2>
          <div class="h-64">
            <canvas id="chart-repartition"></canvas>
          </div>
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 class="text-lg font-semibold text-gray-700 mb-4">Actifs vs Passifs</h2>
          <div class="h-64">
            <canvas id="chart-actifs-passifs"></canvas>
          </div>
        </div>
      </div>

      <!-- Detail Tables -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-700 mb-3">Immobilier</h3>
          ${state.actifs.immobilier.length > 0 ? state.actifs.immobilier.map(i => `
            <div class="flex justify-between py-2 border-b border-gray-50">
              <span class="text-gray-600 text-sm">${i.nom}</span>
              <span class="font-medium text-sm">${formatCurrency(i.valeurActuelle)}</span>
            </div>
          `).join('') : '<p class="text-gray-400 text-sm">Aucun bien</p>'}
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-700 mb-3">Placements</h3>
          ${state.actifs.placements.length > 0 ? state.actifs.placements.map(i => `
            <div class="flex justify-between py-2 border-b border-gray-50">
              <span class="text-gray-600 text-sm">${i.nom}</span>
              <span class="font-medium text-sm">${formatCurrency(i.valeur)}</span>
            </div>
          `).join('') : '<p class="text-gray-400 text-sm">Aucun placement</p>'}
        </div>
        <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 class="font-semibold text-gray-700 mb-3">Épargne</h3>
          ${state.actifs.epargne.length > 0 ? state.actifs.epargne.map(i => `
            <div class="flex justify-between py-2 border-b border-gray-50">
              <span class="text-gray-600 text-sm">${i.nom}</span>
              <span class="font-medium text-sm">${formatCurrency(i.solde)}</span>
            </div>
          `).join('') : '<p class="text-gray-400 text-sm">Aucune épargne</p>'}
        </div>
      </div>
      ` : `
      <div class="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
        <div class="text-6xl mb-4 text-gray-300">
          <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-500 mb-2">Commencez par ajouter vos données</h2>
        <p class="text-gray-400">Rendez-vous dans les sections Actifs, Passifs et Revenus & Dépenses pour renseigner votre patrimoine.</p>
      </div>
      `}
    </div>
  `;
}

export function mount(store) {
  const state = store.getAll();
  const immoTotal = state.actifs.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const placTotal = state.actifs.placements.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const eparTotal = state.actifs.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const totalActifs = store.totalActifs();
  const totalPassifs = store.totalPassifs();

  if (totalActifs === 0 && totalPassifs === 0) return;

  // Doughnut chart
  if (document.getElementById('chart-repartition')) {
    const data = [];
    const labels = [];
    const colors = [];
    if (immoTotal > 0) { data.push(immoTotal); labels.push('Immobilier'); colors.push(COLORS.immobilier); }
    if (placTotal > 0) { data.push(placTotal); labels.push('Placements'); colors.push(COLORS.placements); }
    if (eparTotal > 0) { data.push(eparTotal); labels.push('Épargne'); colors.push(COLORS.epargne); }

    if (data.length > 0) {
      createChart('chart-repartition', {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 8
          }]
        },
        options: {
          cutout: '65%',
          plugins: {
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = ((ctx.raw / total) * 100).toFixed(1);
                  return `${ctx.label}: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(ctx.raw)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  // Bar chart
  if (document.getElementById('chart-actifs-passifs')) {
    createChart('chart-actifs-passifs', {
      type: 'bar',
      data: {
        labels: ['Actifs', 'Passifs'],
        datasets: [{
          data: [totalActifs, totalPassifs],
          backgroundColor: [COLORS.placements, COLORS.dette],
          borderRadius: 8,
          barThickness: 60
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: COLORS.grid },
            ticks: {
              callback: v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: 'compact' }).format(v)
            }
          },
          y: {
            grid: { display: false }
          }
        }
      }
    });
  }
}
