import { formatCurrency, formatPercent, computeProjection, inputField, getFormData, getPlacementGroupKey } from '../utils.js';
import { createChart, COLORS, createVerticalGradient, VIVID_PALETTE } from '../charts/chart-config.js';

export function render(store) {
  const params = store.get('parametres');
  const snapshots = computeProjection(store);
  const groupKeys = snapshots.groupKeys || [];
  const rendementGroupes = params.rendementGroupes || {};
  const last = snapshots[snapshots.length - 1];
  const first = snapshots[0];
  const evolution = (last?.patrimoineNet || 0) - (first?.patrimoineNet || 0);
  const evolutionPct = first?.patrimoineNet ? evolution / Math.abs(first.patrimoineNet) : 0;

  // Color map for placement groups
  const groupColors = {
    'PEA ETF': 'text-accent-green',
    'PEA Actions': 'text-accent-amber',
    'Assurance Vie': 'text-accent-cyan',
    'CTO': 'text-accent-blue',
    'PER': 'text-accent-green',
    'Crypto': 'text-accent-amber',
    'Autre': 'text-gray-400'
  };
  const defaultGroupColor = 'text-accent-green';

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-100">Projection patrimoniale</h1>

      <!-- Parameters -->
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Paramètres de simulation</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Inflation annuelle (%)</label>
            <input type="number" id="param-inflation" value="${((params.inflationRate || 0) * 100).toFixed(1)}" min="0" max="20" step="0.5"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
        </div>
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Rendements annuels</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Immobilier (%)</label>
            <input type="number" id="param-rend-immo" value="${((params.rendementImmobilier || 0) * 100).toFixed(1)}" min="0" max="30" step="0.5"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Livrets / Épargne (%)</label>
            <input type="number" id="param-rend-epar" value="${((params.rendementEpargne || 0) * 100).toFixed(1)}" min="0" max="30" step="0.5"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          ${groupKeys.map(k => {
            const val = rendementGroupes[k] !== undefined ? rendementGroupes[k] : (params.rendementPlacements || 0.05);
            return `<div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">${k} (%)</label>
            <input type="number" data-group-key="${k}" class="param-rend-group w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition"
              value="${(val * 100).toFixed(1)}" min="0" max="50" step="0.5">
          </div>`;
          }).join('')}
          <div class="flex items-end">
            <button id="btn-update-projection" class="w-full px-4 py-2.5 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 rounded-lg hover:opacity-90 transition font-medium">
              Recalculer
            </button>
          </div>
        </div>
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-4">Jalons retraite</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Taux légal (année)</label>
            <input type="number" id="param-retraite-legal-annee" value="${params.anneeRetraiteTauxLegal || 2047}" min="2025" max="2080" step="1"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Pension légale (€/mois)</label>
            <input type="number" id="param-pension-legal" value="${params.pensionTauxLegal || 2442}" min="0" max="20000" step="10"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Taux plein (année)</label>
            <input type="number" id="param-retraite-plein-annee" value="${params.anneeRetraiteTauxPlein || 2048}" min="2025" max="2080" step="1"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Pension taux plein (€/mois)</label>
            <input type="number" id="param-pension-plein" value="${params.pensionTauxPlein || 2642}" min="0" max="20000" step="10"
              class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
          </div>
          <div>
            <label class="block text-sm font-medium text-purple-400 mb-1.5">Départ souhaité (âge)</label>
            <input type="number" id="param-retraite-souhaitee" value="${params.ageRetraiteSouhaitee || 60}" min="40" max="70" step="1"
              class="w-full px-3 py-2.5 bg-dark-800 border border-purple-500/50 rounded-lg text-purple-400 focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition font-medium">
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
                  ? 'bg-accent-amber/10 border-l-4 border-l-accent-amber'
                  : s.annee === 0
                    ? 'bg-accent-blue/5'
                    : '';
                return `
              <tr class="hover:bg-dark-600/30 transition ${rowClass}">
                <td class="px-3 py-2 font-medium text-gray-300">
                  ${s.annee === 0 ? 'Actuel' : `+${s.annee} an${s.annee > 1 ? 's' : ''}`}
                  ${isRetirement ? '<span class="ml-1 text-xs text-accent-amber font-semibold">RETRAITE</span>' : ''}
                </td>
                <td class="px-3 py-2 text-center ${isRetirement ? 'text-accent-amber font-bold' : 'text-gray-400'}">${s.age} ans</td>
                <td class="px-3 py-2 text-right text-accent-green">${formatCurrency(s.immobilier)}</td>
                ${groupKeys.map(k => `<td class="px-3 py-2 text-right ${groupColors[k] || defaultGroupColor}">${formatCurrency(s.placementDetail[k] || 0)}</td>`).join('')}
                <td class="px-3 py-2 text-right text-accent-amber">${formatCurrency(s.epargne)}</td>
                <td class="px-3 py-2 text-right ${s.interetsAnnuels > 0 ? 'text-accent-cyan' : 'text-gray-600'}">${s.annee === 0 ? '—' : formatCurrency(s.interetsAnnuels)}</td>
                <td class="px-3 py-2 text-right ${s.cashApresImpot >= 0 ? 'text-accent-green' : 'text-accent-red/70'}">${formatCurrency(s.cashApresImpot)}</td>
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

  // Asset breakdown chart with optional patrimoine net toggle
  if (document.getElementById('chart-repartition-temps')) {
    const canvas = document.getElementById('chart-repartition-temps');
    const ctx2d = canvas.getContext('2d');

    let colorIdx = 0;
    const nextColor = () => VIVID_PALETTE[colorIdx++ % VIVID_PALETTE.length];
    const datasets = [];

    // Immobilier
    const immColor = nextColor();
    datasets.push({
      label: 'Immobilier',
      data: snapshots.map(s => s.immobilier),
      borderColor: immColor,
      backgroundColor: createVerticalGradient(ctx2d, immColor, 0.18, 0.02),
      fill: true,
      tension: 0.45,
      pointRadius: 0,
      borderWidth: 3,
      hidden: true
    });

    // Each placement group
    groupKeys.forEach((k) => {
      const color = nextColor();
      datasets.push({
        label: k,
        data: snapshots.map(s => s.placementDetail[k] || 0),
        borderColor: color,
        backgroundColor: createVerticalGradient(ctx2d, color, 0.18, 0.02),
        fill: true,
        tension: 0.45,
        pointRadius: 0,
        borderWidth: 3
      });
    });

    // Épargne
    const epColor = nextColor();
    datasets.push({
      label: 'Épargne',
      data: snapshots.map(s => s.epargne),
      borderColor: epColor,
      backgroundColor: createVerticalGradient(ctx2d, epColor, 0.18, 0.02),
      fill: true,
      tension: 0.45,
      pointRadius: 0,
      borderWidth: 3
    });

    // Héritage (show if any heritage items are configured)
    const heritageItems = store.get('heritage') || [];
    if (heritageItems.length > 0) {
      const herColor = nextColor();
      datasets.push({
        label: 'Héritage',
        data: snapshots.map(s => s.heritage),
        borderColor: herColor,
        backgroundColor: createVerticalGradient(ctx2d, herColor, 0.18, 0.02),
        fill: true,
        tension: 0.45,
        pointRadius: 0,
        borderWidth: 3
      });
    }

    // Patrimoine net (hidden by default, toggle via legend)
    datasets.push({
      label: 'Patrimoine net',
      data: snapshots.map(s => s.patrimoineNet),
      borderColor: '#dbb88a',
      backgroundColor: createVerticalGradient(ctx2d, '#dbb88a', 0.25, 0.02),
      fill: true,
      tension: 0.45,
      pointRadius: 0,
      borderWidth: 3,
      borderDash: [6, 3],
      hidden: true
    });

    // Retirement milestones as vertical annotations
    const params = store.get('parametres');
    const currentYear = new Date().getFullYear();
    const ageFinAnnee = params.ageFinAnnee || 43;

    const retraiteTauxPleinOffset = (params.anneeRetraiteTauxPlein || 2048) - currentYear;
    const retraiteTauxLegalOffset = (params.anneeRetraiteTauxLegal || 2047) - currentYear;
    const retraiteSouhaiteeOffset = (params.ageRetraiteSouhaitee || 60) - ageFinAnnee;

    const milestoneAnnotations = {};
    if (retraiteTauxLegalOffset >= 0 && retraiteTauxLegalOffset <= (params.projectionYears || 30)) {
      milestoneAnnotations.retraiteLegal = {
        type: 'line',
        xMin: retraiteTauxLegalOffset,
        xMax: retraiteTauxLegalOffset,
        borderColor: '#f59e0b',
        borderWidth: 2,
        borderDash: [4, 4],
        label: {
          display: true,
          content: `Taux légal (${params.anneeRetraiteTauxLegal}) — ${(params.pensionTauxLegal || 0).toLocaleString('fr-FR')} €/mois`,
          position: 'start',
          backgroundColor: 'rgba(245,158,11,0.15)',
          color: '#f59e0b',
          font: { size: 11, weight: 'bold' },
          padding: 6
        }
      };
    }
    if (retraiteTauxPleinOffset >= 0 && retraiteTauxPleinOffset <= (params.projectionYears || 30)) {
      milestoneAnnotations.retraitePlein = {
        type: 'line',
        xMin: retraiteTauxPleinOffset,
        xMax: retraiteTauxPleinOffset,
        borderColor: '#22d3ee',
        borderWidth: 2,
        borderDash: [4, 4],
        label: {
          display: true,
          content: `Taux plein (${params.anneeRetraiteTauxPlein}) — ${(params.pensionTauxPlein || 0).toLocaleString('fr-FR')} €/mois`,
          position: 'center',
          backgroundColor: 'rgba(34,211,238,0.15)',
          color: '#22d3ee',
          font: { size: 11, weight: 'bold' },
          padding: 6
        }
      };
    }
    if (retraiteSouhaiteeOffset >= 0 && retraiteSouhaiteeOffset <= (params.projectionYears || 30)) {
      milestoneAnnotations.retraiteSouhaitee = {
        type: 'line',
        xMin: retraiteSouhaiteeOffset,
        xMax: retraiteSouhaiteeOffset,
        borderColor: '#a855f7',
        borderWidth: 2.5,
        label: {
          display: true,
          content: `Départ souhaité (${params.ageRetraiteSouhaitee} ans)`,
          position: 'end',
          backgroundColor: 'rgba(168,85,247,0.15)',
          color: '#a855f7',
          font: { size: 11, weight: 'bold' },
          padding: 6
        }
      };
    }

    createChart('chart-repartition-temps', {
      type: 'line',
      data: { labels, datasets },
      options: {
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          annotation: {
            annotations: milestoneAnnotations
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: COLORS.gridText }
          },
          y: {
            stacked: false,
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
    store.set('parametres.inflationRate', (parseFloat(document.getElementById('param-inflation').value) || 2) / 100);
    store.set('parametres.rendementImmobilier', (parseFloat(document.getElementById('param-rend-immo').value) || 2) / 100);
    store.set('parametres.rendementEpargne', (parseFloat(document.getElementById('param-rend-epar').value) || 2) / 100);

    // Per-group rendement overrides
    const groupInputs = document.querySelectorAll('.param-rend-group');
    const rendementGroupes = {};
    groupInputs.forEach(input => {
      const key = input.dataset.groupKey;
      rendementGroupes[key] = (parseFloat(input.value) || 5) / 100;
    });
    store.set('parametres.rendementGroupes', rendementGroupes);

    // Retirement milestones
    store.set('parametres.anneeRetraiteTauxLegal', parseInt(document.getElementById('param-retraite-legal-annee').value) || 2047);
    store.set('parametres.pensionTauxLegal', parseInt(document.getElementById('param-pension-legal').value) || 2442);
    store.set('parametres.anneeRetraiteTauxPlein', parseInt(document.getElementById('param-retraite-plein-annee').value) || 2048);
    store.set('parametres.pensionTauxPlein', parseInt(document.getElementById('param-pension-plein').value) || 2642);
    store.set('parametres.ageRetraiteSouhaitee', parseInt(document.getElementById('param-retraite-souhaitee').value) || 60);

    navigate('projection');
  });
}
