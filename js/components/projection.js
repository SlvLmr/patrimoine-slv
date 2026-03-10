import { formatCurrency, formatPercent, computeProjection, inputField, getFormData, getPlacementGroupKey } from '../utils.js';
import { createChart, COLORS, createVerticalGradient, VIVID_PALETTE } from '../charts/chart-config.js';

export function render(store) {
  const params = store.get('parametres');
  const snapshots = computeProjection(store);
  const groupKeys = snapshots.groupKeys || [];
  const rendementPlacements = params.rendementPlacements || {};
  const cashInjections = params.cashInjections || {};
  const placements = (store.getAll().actifs?.placements || []);
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

      <!-- Parameters — collapsible -->
      <details class="card-dark rounded-xl group" open>
        <summary class="flex items-center justify-between px-4 py-2 cursor-pointer select-none">
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            <h2 class="text-sm font-semibold text-gray-400">Paramètres</h2>
          </div>
          <svg class="w-3.5 h-3.5 text-gray-600 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-4 pb-3 space-y-2.5">
          <!-- Row 1: Simulation + Retraite inline -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div class="flex items-center gap-1.5">
              <svg class="w-3 h-3 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              ${[
                ['param-years', 'Horizon', params.projectionYears, '1', '50', '1', ''],
                ['param-age', 'Âge', params.ageFinAnnee || 43, '18', '100', '1', ''],
                ['param-inflation', 'Inflation', ((params.inflationRate || 0) * 100).toFixed(1), '0', '20', '0.5', '%'],
                ['param-rend-immo', 'Immo', ((params.rendementImmobilier || 0) * 100).toFixed(1), '0', '30', '0.5', '%'],
                ['param-rend-epar', 'Épargne', ((params.rendementEpargne || 0) * 100).toFixed(1), '0', '30', '0.5', '%'],
              ].map(([id, label, val, min, max, step, suffix]) => `
              <div class="flex items-center gap-0.5">
                <span class="text-[11px] text-gray-500">${label}</span>
                <input type="number" id="${id}" value="${val}" min="${min}" max="${max}" step="${step}"
                  class="w-12 px-1 py-0.5 text-xs bg-dark-800 border border-dark-400/30 rounded text-gray-300 focus:ring-1 focus:ring-accent-blue/30 text-center">
                ${suffix ? `<span class="text-[11px] text-gray-500">${suffix}</span>` : ''}
              </div>`).join('')}
            </div>
            <div class="w-px h-4 bg-dark-400/30 hidden sm:block"></div>
            <div class="flex items-center gap-1.5">
              <svg class="w-3 h-3 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <div class="flex items-center gap-0.5">
                <span class="text-[11px] text-gray-500">Retraite</span>
                <input type="number" id="param-retraite" value="${params.ageRetraite || 64}" min="55" max="70" step="1"
                  class="w-10 px-1 py-0.5 text-xs bg-dark-800 border border-dark-400/30 rounded text-gray-300 focus:ring-1 focus:ring-accent-blue/30 text-center">
              </div>
              <div class="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-400/5 border border-amber-400/20">
                <span class="text-[11px] text-amber-400/80">Légal</span>
                <input type="number" id="param-retraite-legal-age" value="${params.ageRetraiteTauxLegal || 64}" min="55" max="70" step="1"
                  class="w-10 px-0.5 py-0 text-xs bg-transparent border-0 text-gray-300 focus:ring-0 text-center">
                <input type="number" id="param-pension-legal" value="${params.pensionTauxLegal || 2442}" min="0" max="20000" step="10"
                  class="w-16 px-0.5 py-0 text-xs bg-transparent border-0 text-amber-400/80 focus:ring-0 text-center font-semibold">
                <span class="text-[9px] text-gray-500">€</span>
              </div>
              <div class="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-400/5 border border-cyan-400/20">
                <span class="text-[11px] text-cyan-400/80">Plein</span>
                <input type="number" id="param-retraite-plein-age" value="${params.ageRetraiteTauxPlein || 65}" min="55" max="70" step="1"
                  class="w-10 px-0.5 py-0 text-xs bg-transparent border-0 text-gray-300 focus:ring-0 text-center">
                <input type="number" id="param-pension-plein" value="${params.pensionTauxPlein || 2642}" min="0" max="20000" step="10"
                  class="w-16 px-0.5 py-0 text-xs bg-transparent border-0 text-cyan-400/80 focus:ring-0 text-center font-semibold">
                <span class="text-[9px] text-gray-500">€</span>
              </div>
              <div class="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/8 border border-purple-500/25">
                <span class="text-[11px] text-purple-400">Souhaité</span>
                <input type="number" id="param-retraite-souhaitee" value="${params.ageRetraiteSouhaitee || 60}" min="40" max="70" step="1"
                  class="w-10 px-0.5 py-0 text-xs bg-transparent border-0 text-purple-400 focus:ring-0 text-center font-semibold">
              </div>
            </div>
          </div>

          <!-- Row 2: Placements as compact grid -->
          ${placements.length > 0 ? `
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <span class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Placements</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
              ${placements.map(p => {
                const gk = getPlacementGroupKey(p);
                const currentRend = rendementPlacements[p.id] !== undefined
                  ? rendementPlacements[p.id]
                  : (Number(p.rendement) || 0.05);
                const injections = cashInjections[p.id] || [];
                const groupIcons = {
                  'PEA Actions': '<svg class="w-2.5 h-2.5 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
                  'PEA ETF': '<svg class="w-2.5 h-2.5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
                  'Crypto': '<svg class="w-2.5 h-2.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                  'Assurance Vie': '<svg class="w-2.5 h-2.5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
                  'CTO': '<svg class="w-2.5 h-2.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>',
                };
                const icon = groupIcons[gk] || '<svg class="w-2.5 h-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>';
                return `
              <div class="flex items-center gap-1 px-2 py-1 rounded bg-dark-800/30 border border-dark-400/15 hover:border-dark-400/30 transition placement-row" data-placement-id="${p.id}">
                ${icon}
                <span class="text-xs text-gray-200 truncate max-w-[7rem] font-medium" title="${p.nom}">${p.nom}</span>
                <span class="text-[9px] text-gray-500 ml-auto">${gk}</span>
                <input type="number" class="plac-rend w-14 px-1 py-0.5 text-xs bg-dark-900/60 border border-dark-400/25 rounded text-gray-200 focus:ring-1 focus:ring-accent-blue/30 text-center font-medium"
                  value="${(currentRend * 100).toFixed(1)}" min="-20" max="50" step="0.5">
                <span class="text-[9px] text-gray-500">%</span>
                <div class="flex items-center gap-0.5 cash-injections-container">
                  ${injections.map(inj => `
                  <div class="flex items-center gap-0.5 cash-inj-row">
                    <input type="number" class="cash-inj-year w-8 px-0.5 py-0 text-[9px] bg-dark-900/60 border border-dark-400/25 rounded text-gray-400 text-center" value="${inj.year}" min="1" max="50" placeholder="An">
                    <input type="number" class="cash-inj-amount w-12 px-0.5 py-0 text-[9px] bg-dark-900/60 border border-accent-green/20 rounded text-accent-green text-center" value="${inj.montant}" step="100" placeholder="€">
                    <button class="cash-inj-remove text-gray-700 hover:text-red-400 text-[9px] leading-none" title="Supprimer">&times;</button>
                  </div>`).join('')}
                </div>
                <button class="cash-inj-add text-[8px] text-accent-blue/50 hover:text-accent-blue transition" title="Apport ponctuel">+</button>
              </div>`;
              }).join('')}
            </div>
          </div>` : ''}

          <!-- Actions -->
          <div class="flex justify-end">
            <button id="btn-update-projection" class="px-4 py-1.5 text-xs font-semibold bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 rounded hover:opacity-90 transition">
              Recalculer
            </button>
          </div>
        </div>
      </details>

      <!-- Summary -->
      ${(() => {
        const milestones = [20, 25, 30];
        const firstNet = first?.patrimoineNet || 0;
        const firstImmo = first?.immobilier || 0;
        const firstFin = (first?.placements || 0) + (first?.epargne || 0) + (first?.heritage || 0);
        return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Patrimoine actuel</p>
          <p class="text-2xl font-bold text-gray-200">${formatCurrency(firstNet)}</p>
          <div class="flex gap-3 mt-2 text-xs text-gray-500">
            <span>Immo ${formatCurrency(firstImmo)}</span>
            <span>·</span>
            <span>Fin ${formatCurrency(firstFin)}</span>
          </div>
        </div>
        ${milestones.map((yr, i) => {
          const snap = snapshots[yr] || snapshots[snapshots.length - 1];
          const net = snap?.patrimoineNet || 0;
          const immo = snap?.immobilier || 0;
          const fin = (snap?.placements || 0) + (snap?.epargne || 0) + (snap?.heritage || 0);
          const dette = snap?.totalDette || 0;
          const evol = net - firstNet;
          const evolPct = firstNet ? evol / Math.abs(firstNet) : 0;
          const glows = ['glow-blue', 'glow-green', 'glow-blue'];
          return `
        <div class="card-dark rounded-xl p-5 kpi-card ${glows[i]}">
          <p class="text-sm text-gray-400 mb-2">Dans ${yr} ans</p>
          <p class="text-2xl font-bold gradient-text">${formatCurrency(net)}</p>
          <div class="flex gap-3 mt-2 text-xs">
            <span class="text-pink-400">Immo ${formatCurrency(immo)}</span>
            <span class="text-gray-600">·</span>
            <span class="text-purple-400">Fin ${formatCurrency(fin)}</span>
            ${dette > 0 ? `<span class="text-gray-600">·</span><span class="text-red-400/70">Dette −${formatCurrency(dette)}</span>` : ''}
          </div>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-sm ${evol >= 0 ? 'text-accent-green' : 'text-accent-red'}">${evol >= 0 ? '+' : ''}${formatCurrency(evol)}</span>
            <span class="text-xs px-1.5 py-0.5 rounded-full ${evol >= 0 ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}">
              ${evol >= 0 ? '+' : ''}${(evolPct * 100).toFixed(0)}%
            </span>
          </div>
        </div>`;
        }).join('')}
      </div>`;
      })()}

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

    const retraiteTauxPleinOffset = (Number(params.ageRetraiteTauxPlein) || 65) - ageFinAnnee;
    const retraiteTauxLegalOffset = (Number(params.ageRetraiteTauxLegal) || 64) - ageFinAnnee;
    const retraiteSouhaiteeOffset = (Number(params.ageRetraiteSouhaitee) || 60) - ageFinAnnee;

    const milestoneAnnotations = {};
    const projYears = params.projectionYears || 30;
    const inRange = (v) => v >= 0 && v <= projYears;
    const toLabel = (v) => v === 0 ? 'Actuel' : `+${v}`;

    if (inRange(retraiteSouhaiteeOffset)) {
      milestoneAnnotations.retraiteSouhaitee = {
        type: 'line',
        xMin: toLabel(retraiteSouhaiteeOffset),
        xMax: toLabel(retraiteSouhaiteeOffset),
        borderColor: 'rgba(168,85,247,0.45)',
        borderWidth: 1,
        borderDash: [6, 4],
        label: {
          display: true,
          content: `Souhaité · ${params.ageRetraiteSouhaitee} ans`,
          position: 'start',
          yAdjust: -6,
          backgroundColor: 'rgba(168,85,247,0.85)',
          color: '#fff',
          font: { size: 10, weight: '600' },
          padding: { top: 3, bottom: 3, left: 6, right: 6 },
          borderRadius: 4
        }
      };
    }
    if (inRange(retraiteTauxLegalOffset)) {
      milestoneAnnotations.retraiteLegal = {
        type: 'line',
        xMin: toLabel(retraiteTauxLegalOffset),
        xMax: toLabel(retraiteTauxLegalOffset),
        borderColor: 'rgba(245,158,11,0.45)',
        borderWidth: 1,
        borderDash: [6, 4],
        label: {
          display: true,
          content: `Légal · ${Number(params.pensionTauxLegal || 0).toLocaleString('fr-FR')} €`,
          position: 'start',
          yAdjust: 14,
          backgroundColor: 'rgba(245,158,11,0.8)',
          color: '#fff',
          font: { size: 10, weight: '600' },
          padding: { top: 3, bottom: 3, left: 6, right: 6 },
          borderRadius: 4
        }
      };
    }
    if (inRange(retraiteTauxPleinOffset)) {
      milestoneAnnotations.retraitePlein = {
        type: 'line',
        xMin: toLabel(retraiteTauxPleinOffset),
        xMax: toLabel(retraiteTauxPleinOffset),
        borderColor: 'rgba(34,211,238,0.45)',
        borderWidth: 1,
        borderDash: [6, 4],
        label: {
          display: true,
          content: `Taux plein · ${Number(params.pensionTauxPlein || 0).toLocaleString('fr-FR')} €`,
          position: 'start',
          yAdjust: 34,
          backgroundColor: 'rgba(34,211,238,0.8)',
          color: '#fff',
          font: { size: 10, weight: '600' },
          padding: { top: 3, bottom: 3, left: 6, right: 6 },
          borderRadius: 4
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

    // Per-placement overrides
    const rendementPlacements = {};
    const cashInjections = {};
    document.querySelectorAll('.placement-row').forEach(row => {
      const pid = row.dataset.placementId;
      const rendInput = row.querySelector('.plac-rend');
      if (rendInput) {
        rendementPlacements[pid] = (parseFloat(rendInput.value) || 5) / 100;
      }
      const injRows = row.querySelectorAll('.cash-inj-row');
      if (injRows.length > 0) {
        const injs = [];
        injRows.forEach(ir => {
          const year = parseInt(ir.querySelector('.cash-inj-year')?.value);
          const montant = parseFloat(ir.querySelector('.cash-inj-amount')?.value);
          if (year > 0 && !isNaN(montant) && montant !== 0) {
            injs.push({ year, montant });
          }
        });
        if (injs.length > 0) cashInjections[pid] = injs;
      }
    });
    store.set('parametres.rendementPlacements', rendementPlacements);
    store.set('parametres.cashInjections', cashInjections);

    // Retirement milestones
    store.set('parametres.ageRetraiteTauxLegal', parseInt(document.getElementById('param-retraite-legal-age').value) || 64);
    store.set('parametres.pensionTauxLegal', parseInt(document.getElementById('param-pension-legal').value) || 2442);
    store.set('parametres.ageRetraiteTauxPlein', parseInt(document.getElementById('param-retraite-plein-age').value) || 65);
    store.set('parametres.pensionTauxPlein', parseInt(document.getElementById('param-pension-plein').value) || 2642);
    store.set('parametres.ageRetraiteSouhaitee', parseInt(document.getElementById('param-retraite-souhaitee').value) || 60);

    navigate('projection');
  });

  // Dynamic add/remove cash injection rows
  document.querySelectorAll('.cash-inj-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.placement-row');
      const container = row.querySelector('.cash-injections-container');
      const div = document.createElement('div');
      div.className = 'flex items-center gap-0.5 cash-inj-row';
      div.innerHTML = `
        <input type="number" class="cash-inj-year w-12 px-1 py-0.5 text-[10px] bg-dark-800 border border-dark-400/40 rounded text-gray-300 text-center" min="1" max="50" placeholder="An" title="Année">
        <input type="number" class="cash-inj-amount w-16 px-1 py-0.5 text-[10px] bg-dark-800 border border-accent-green/30 rounded text-accent-green text-center" step="100" placeholder="€" title="Montant">
        <button class="cash-inj-remove text-gray-600 hover:text-red-400 text-xs leading-none" title="Supprimer">&times;</button>
      `;
      container.appendChild(div);
      div.querySelector('.cash-inj-remove').addEventListener('click', () => div.remove());
    });
  });

  document.querySelectorAll('.cash-inj-remove').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.cash-inj-row').remove());
  });
}
