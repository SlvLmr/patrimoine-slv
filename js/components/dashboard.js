import { formatCurrency, formatPercent } from '../utils.js';
import { createChart, COLORS, PALETTE, GRADIENT_PAIRS, createVerticalGradient, createSliceGradient } from '../charts/chart-config.js';

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

  // Calculate allocation percentages
  const allocItems = [];
  if (immoTotal > 0) allocItems.push({ label: 'Immobilier', value: immoTotal, color: COLORS.immobilier, pct: ((immoTotal / totalActifs) * 100).toFixed(1) });
  if (placTotal > 0) allocItems.push({ label: 'Placements', value: placTotal, color: COLORS.placements, pct: ((placTotal / totalActifs) * 100).toFixed(1) });
  if (eparTotal > 0) allocItems.push({ label: 'Épargne', value: eparTotal, color: COLORS.epargne, pct: ((eparTotal / totalActifs) * 100).toFixed(1) });

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-100">Tableau de bord</h1>
        <p class="text-sm text-gray-500">Vue d'ensemble</p>
      </div>

      <!-- Main patrimoine card -->
      <div class="net-worth-display rounded-2xl p-8 text-center">
        <p class="text-sm text-gray-400 mb-2 uppercase tracking-wider">Patrimoine Net</p>
        <p class="text-5xl font-bold gradient-text mb-3">${formatCurrency(patrimoineNet)}</p>
        <div class="flex items-center justify-center gap-6 text-sm">
          <span class="text-gray-400">Actifs: <span class="text-accent-green font-medium">${formatCurrency(totalActifs)}</span></span>
          <span class="text-gray-500">|</span>
          <span class="text-gray-400">Passifs: <span class="text-accent-red font-medium">${formatCurrency(totalPassifs)}</span></span>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card glow-purple">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Immobilier</p>
          </div>
          <p class="text-2xl font-bold text-purple-400">${formatCurrency(immoTotal)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Placements</p>
          </div>
          <p class="text-2xl font-bold text-accent-green">${formatCurrency(placTotal)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Épargne</p>
          </div>
          <p class="text-2xl font-bold text-amber-400">${formatCurrency(eparTotal)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-blue">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-blue/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Capacité d'épargne</p>
          </div>
          <p class="text-2xl font-bold ${capacite >= 0 ? 'text-accent-blue' : 'text-accent-red'}">${formatCurrency(capacite)}<span class="text-sm font-normal text-gray-500">/mois</span></p>
        </div>
      </div>

      ${hasData ? `
      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Répartition des actifs</h2>
          <div class="h-64 relative">
            <canvas id="chart-repartition"></canvas>
          </div>
          <!-- Allocation bars -->
          <div class="mt-4 space-y-3">
            ${allocItems.map(item => `
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-400">${item.label}</span>
                <span class="text-gray-300 font-medium">${item.pct}% — ${formatCurrency(item.value)}</span>
              </div>
              <div class="progress-bar h-2">
                <div class="progress-bar-fill h-full" style="width: ${item.pct}%; background: ${item.color}"></div>
              </div>
            </div>
            `).join('')}
          </div>
        </div>
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Actifs vs Passifs</h2>
          <div class="h-64">
            <canvas id="chart-actifs-passifs"></canvas>
          </div>
        </div>
      </div>

      <!-- Detail Tables -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="card-dark rounded-xl p-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-3 h-3 rounded-full bg-purple-500"></div>
            <h3 class="font-semibold text-gray-200">Immobilier</h3>
          </div>
          ${state.actifs.immobilier.length > 0 ? state.actifs.immobilier.map(i => `
            <div class="flex justify-between py-2.5 border-b border-dark-400/30">
              <span class="text-gray-400 text-sm">${i.nom}</span>
              <span class="font-medium text-sm text-gray-200">${formatCurrency(i.valeurActuelle)}</span>
            </div>
          `).join('') : '<p class="text-gray-600 text-sm">Aucun bien</p>'}
        </div>
        <div class="card-dark rounded-xl p-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-3 h-3 rounded-full bg-accent-green"></div>
            <h3 class="font-semibold text-gray-200">Placements</h3>
          </div>
          ${state.actifs.placements.length > 0 ? state.actifs.placements.map(i => `
            <div class="flex justify-between py-2.5 border-b border-dark-400/30">
              <div>
                <span class="text-gray-400 text-sm">${i.nom}</span>
                ${i.type ? `<span class="ml-2 text-xs px-1.5 py-0.5 rounded bg-dark-500 text-gray-500">${i.type}</span>` : ''}
              </div>
              <span class="font-medium text-sm text-gray-200">${formatCurrency(i.valeur)}</span>
            </div>
          `).join('') : '<p class="text-gray-600 text-sm">Aucun placement</p>'}
        </div>
        <div class="card-dark rounded-xl p-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-3 h-3 rounded-full bg-amber-500"></div>
            <h3 class="font-semibold text-gray-200">Épargne</h3>
          </div>
          ${state.actifs.epargne.length > 0 ? state.actifs.epargne.map(i => `
            <div class="flex justify-between py-2.5 border-b border-dark-400/30">
              <span class="text-gray-400 text-sm">${i.nom}</span>
              <span class="font-medium text-sm text-gray-200">${formatCurrency(i.solde)}</span>
            </div>
          `).join('') : '<p class="text-gray-600 text-sm">Aucune épargne</p>'}
        </div>
      </div>
      ` : `
      <div class="card-dark rounded-xl p-12 text-center">
        <div class="mb-6">
          <div class="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent-green/20 to-accent-blue/20 flex items-center justify-center mb-4">
            <svg class="w-10 h-10 text-accent-green/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
          </div>
        </div>
        <h2 class="text-xl font-semibold text-gray-300 mb-2">Commencez par ajouter vos données</h2>
        <p class="text-gray-500 max-w-md mx-auto">Rendez-vous dans les sections Actifs, Passifs et Revenus & Dépenses pour renseigner votre patrimoine.</p>
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

  // Doughnut chart with gradient slices
  if (document.getElementById('chart-repartition')) {
    const canvas = document.getElementById('chart-repartition');
    const ctx2d = canvas.getContext('2d');
    const data = [];
    const labels = [];
    const gradColors = [];
    const borderColors = [];
    const gradientPairsMap = [
      ['#a855f7', '#ec4899'],  // purple→pink for immobilier
      ['#00d4aa', '#38bdf8'],  // green→cyan for placements
      ['#f59e0b', '#ff4757'],  // amber→red for epargne
    ];
    let idx = 0;
    if (immoTotal > 0) { data.push(immoTotal); labels.push('Immobilier'); gradColors.push(createSliceGradient(ctx2d, gradientPairsMap[0][0], gradientPairsMap[0][1])); borderColors.push(gradientPairsMap[0][0]); idx++; }
    if (placTotal > 0) { data.push(placTotal); labels.push('Placements'); gradColors.push(createSliceGradient(ctx2d, gradientPairsMap[1][0], gradientPairsMap[1][1])); borderColors.push(gradientPairsMap[1][0]); idx++; }
    if (eparTotal > 0) { data.push(eparTotal); labels.push('Épargne'); gradColors.push(createSliceGradient(ctx2d, gradientPairsMap[2][0], gradientPairsMap[2][1])); borderColors.push(gradientPairsMap[2][0]); idx++; }

    if (data.length > 0) {
      createChart('chart-repartition', {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: gradColors,
            borderWidth: 0,
            hoverOffset: 10,
            borderRadius: 4
          }]
        },
        options: {
          cutout: '68%',
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
  }

  // Bar chart with gradient fills
  if (document.getElementById('chart-actifs-passifs')) {
    const canvas = document.getElementById('chart-actifs-passifs');
    const ctx2d = canvas.getContext('2d');
    const gradActifs = ctx2d.createLinearGradient(0, 0, canvas.width, 0);
    gradActifs.addColorStop(0, '#00d4aa');
    gradActifs.addColorStop(1, '#5b7fff');
    const gradPassifs = ctx2d.createLinearGradient(0, 0, canvas.width, 0);
    gradPassifs.addColorStop(0, '#ff4757');
    gradPassifs.addColorStop(1, '#ec4899');

    createChart('chart-actifs-passifs', {
      type: 'bar',
      data: {
        labels: ['Actifs', 'Passifs'],
        datasets: [{
          data: [totalActifs, totalPassifs],
          backgroundColor: [gradActifs, gradPassifs],
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
              color: COLORS.gridText,
              callback: v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: 'compact' }).format(v)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: COLORS.gridText }
          }
        }
      }
    });
  }
}
