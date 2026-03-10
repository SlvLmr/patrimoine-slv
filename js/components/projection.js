import { formatCurrency, formatPercent, computeProjection, inputField, selectField, getFormData, getPlacementGroupKey, openModal } from '../utils.js?v=5';
import { createChart, COLORS, createVerticalGradient, VIVID_PALETTE } from '../charts/chart-config.js';
import { openAddPlacementModal, openEditPlacementModal } from './placement-form.js?v=5';
import { openHeritageModal } from './heritage.js?v=5';

export function render(store) {
  const params = store.get('parametres');
  const snapshots = computeProjection(store);
  const groupKeys = snapshots.groupKeys || [];
  const rendementPlacements = params.rendementPlacements || {};
  const placements = (store.getAll().actifs?.placements || []);
  const heritageItems = store.get('heritage') || [];
  const capitalTransfers = params.capitalTransfers || [];
  const currentCalendarYear = new Date().getFullYear();
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
    'PEE': 'text-emerald-400',
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
              <svg class="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              ${[
                ['param-years', 'Horizon', params.projectionYears, '1', '50', '1', ''],
                ['param-age', 'Âge', params.ageFinAnnee || 43, '18', '100', '1', ''],
                ['param-inflation', 'Inflation', ((params.inflationRate || 0) * 100).toFixed(1), '0', '20', '0.5', '%'],
                ['param-rend-immo', 'Immo', ((params.rendementImmobilier || 0) * 100).toFixed(1), '0', '30', '0.5', '%'],
                ['param-rend-epar', 'Épargne', ((params.rendementEpargne || 0) * 100).toFixed(1), '0', '30', '0.5', '%'],
              ].map(([id, label, val, min, max, step, suffix]) => `
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500">${label}</span>
                <input type="number" id="${id}" value="${val}" min="${min}" max="${max}" step="${step}"
                  class="param-input w-14 px-1.5 py-1 text-sm bg-dark-800 border border-dark-400/30 rounded text-gray-300 focus:ring-1 focus:ring-accent-blue/30 text-center">
                ${suffix ? `<span class="text-xs text-gray-500">${suffix}</span>` : ''}
              </div>`).join('')}
            </div>
            <div class="w-px h-4 bg-dark-400/30 hidden sm:block"></div>
            <div class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500">Retraite</span>
                <input type="number" id="param-retraite" value="${params.ageRetraite || 64}" min="55" max="70" step="1"
                  class="param-input w-12 px-1 py-1 text-sm bg-dark-800 border border-dark-400/30 rounded text-gray-300 focus:ring-1 focus:ring-accent-blue/30 text-center">
              </div>
              <div class="flex items-center gap-1 px-2 py-1 rounded bg-amber-400/5 border border-amber-400/20">
                <span class="text-xs text-amber-400/80">Légal</span>
                <input type="number" id="param-retraite-legal-age" value="${params.ageRetraiteTauxLegal || 64}" min="55" max="70" step="1"
                  class="param-input w-12 px-1 py-0.5 text-sm bg-transparent border-0 text-gray-300 focus:ring-0 text-center">
                <input type="number" id="param-pension-legal" value="${params.pensionTauxLegal || 2442}" min="0" max="20000" step="10"
                  class="param-input w-18 px-1 py-0.5 text-sm bg-transparent border-0 text-amber-400/80 focus:ring-0 text-center font-semibold">
                <span class="text-[10px] text-gray-500">€</span>
              </div>
              <div class="flex items-center gap-1 px-2 py-1 rounded bg-cyan-400/5 border border-cyan-400/20">
                <span class="text-xs text-cyan-400/80">Plein</span>
                <input type="number" id="param-retraite-plein-age" value="${params.ageRetraiteTauxPlein || 65}" min="55" max="70" step="1"
                  class="param-input w-12 px-1 py-0.5 text-sm bg-transparent border-0 text-gray-300 focus:ring-0 text-center">
                <input type="number" id="param-pension-plein" value="${params.pensionTauxPlein || 2642}" min="0" max="20000" step="10"
                  class="param-input w-18 px-1 py-0.5 text-sm bg-transparent border-0 text-cyan-400/80 focus:ring-0 text-center font-semibold">
                <span class="text-[10px] text-gray-500">€</span>
              </div>
              <div class="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/8 border border-purple-500/25">
                <span class="text-xs text-purple-400">Souhaité</span>
                <input type="number" id="param-retraite-souhaitee" value="${params.ageRetraiteSouhaitee || 60}" min="40" max="70" step="1"
                  class="param-input w-12 px-1 py-0.5 text-sm bg-transparent border-0 text-purple-400 focus:ring-0 text-center font-semibold">
              </div>
            </div>
          </div>

          <!-- Row 2: Placements as compact grid -->
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Placements</span>
              <button id="proj-add-plac-global" class="ml-2 w-7 h-7 flex items-center justify-center rounded-lg bg-accent-green/20 text-accent-green hover:bg-accent-green/35 transition text-lg font-bold shadow-sm shadow-accent-green/10" title="Ajouter un placement">+</button>
            </div>
            ${(() => {
                const groupIcons = {
                  'PEA Actions': '<svg class="w-2.5 h-2.5 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
                  'PEA ETF': '<svg class="w-2.5 h-2.5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
                  'Crypto': '<svg class="w-2.5 h-2.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                  'Assurance Vie': '<svg class="w-2.5 h-2.5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
                  'PEE': '<svg class="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>',
                  'CTO': '<svg class="w-2.5 h-2.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>',
                };
                const defaultIcon = '<svg class="w-2.5 h-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>';
                const renderCard = (p) => {
                  const gk = getPlacementGroupKey(p);
                  const currentRend = rendementPlacements[p.id] !== undefined ? rendementPlacements[p.id] : (Number(p.rendement) || 0.05);
                  const icon = groupIcons[gk] || defaultIcon;
                  const dcaLabel = p.dcaMensuel ? `<span class="text-[9px] text-gray-600">${p.dcaMensuel}€/m</span>` : '';
                  return `<div class="group/card flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-dark-800/30 border border-dark-400/15 hover:border-accent-blue/40 hover:bg-dark-700/40 transition cursor-pointer placement-row" draggable="true" data-placement-id="${p.id}">
                    ${icon}
                    <span class="text-sm text-gray-200 truncate max-w-[7rem] font-medium proj-edit-plac" data-id="${p.id}" title="${p.nom}">${p.nom}</span>
                    ${dcaLabel}
                    <span class="text-[10px] text-gray-500 ml-auto">${gk}</span>
                    <input type="number" class="param-input plac-rend w-14 px-1.5 py-1 text-sm bg-dark-900/60 border border-dark-400/25 rounded text-gray-200 focus:ring-1 focus:ring-accent-blue/30 text-center font-medium"
                      value="${(currentRend * 100).toFixed(1)}" min="-20" max="50" step="0.5" onclick="event.stopPropagation()">
                    <span class="text-[10px] text-gray-500">%</span>
                    <button class="proj-del-plac opacity-0 group-hover/card:opacity-100 ml-0.5 text-accent-red/50 hover:text-accent-red text-xs transition" data-id="${p.id}" onclick="event.stopPropagation()" title="Supprimer">✕</button>
                  </div>`;
                };
                return `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
              ${placements.length > 0 ? placements.map(renderCard).join('') : '<p class="col-span-full text-center text-gray-600 text-sm py-3">Aucun placement — cliquez sur + pour en ajouter</p>'}
            </div>`;
              })()}
          </div>

          <!-- Row 3: Heritage -->
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Héritage</span>
              <button id="proj-add-heritage" class="ml-2 w-7 h-7 flex items-center justify-center rounded-lg bg-accent-amber/20 text-accent-amber hover:bg-accent-amber/35 transition text-lg font-bold shadow-sm shadow-accent-amber/10" title="Ajouter un héritage">+</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
              ${heritageItems.length > 0 ? heritageItems.map(h => {
                const isImmo = h.type === 'Immobilier';
                const yearLabel = h.dateInjection ? new Date(h.dateInjection).getFullYear() : '?';
                return `<div class="group/card flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-dark-800/30 border border-dark-400/15 hover:border-accent-amber/40 hover:bg-dark-700/40 transition cursor-pointer heritage-row" data-heritage-id="${h.id}">
                  <svg class="w-2.5 h-2.5 shrink-0 ${isImmo ? 'text-accent-green' : 'text-accent-amber'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    ${isImmo
                      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3"/>'
                      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>'}
                  </svg>
                  <span class="text-sm text-gray-200 truncate max-w-[7rem] font-medium" title="${h.nom}">${h.nom}</span>
                  <span class="text-[9px] text-gray-600">${formatCurrency(h.montant)}</span>
                  <span class="text-[10px] text-gray-500 ml-auto">${yearLabel}</span>
                  <button class="proj-del-heritage opacity-0 group-hover/card:opacity-100 ml-0.5 text-accent-red/50 hover:text-accent-red text-xs transition" data-id="${h.id}" onclick="event.stopPropagation()" title="Supprimer">✕</button>
                </div>`;
              }).join('') : '<p class="col-span-full text-center text-gray-600 text-sm py-2">Aucun héritage — cliquez sur + pour en ajouter</p>'}
            </div>
          </div>

          <!-- Row 4: Capital Transfers -->
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
              <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transferts de capital</span>
              <button id="proj-add-transfer" class="ml-2 w-7 h-7 flex items-center justify-center rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/35 transition text-lg font-bold shadow-sm shadow-purple-500/10" title="Ajouter un transfert">+</button>
            </div>
            <div class="space-y-1" id="capital-transfers-list">
              ${capitalTransfers.length > 0 ? capitalTransfers.map(t => {
                const destPlacement = placements.find(p => p.id === t.destinationId);
                const destName = destPlacement ? destPlacement.nom : '(supprimé)';
                const sourceLabel = t.source === 'heritage' ? 'Héritage' : 'Épargne';
                const freqLabel = t.frequency === 'annual' ? '/an' : 'une fois';
                return `<div class="group/card flex items-center gap-2 px-2.5 py-1.5 rounded bg-dark-800/30 border border-dark-400/15 hover:border-purple-400/40 hover:bg-dark-700/40 transition cursor-pointer transfer-row" data-transfer-id="${t.id}">
                  <svg class="w-2.5 h-2.5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full ${t.source === 'heritage' ? 'bg-accent-amber/10 text-accent-amber' : 'bg-accent-cyan/10 text-accent-cyan'}">${sourceLabel}</span>
                  <span class="text-gray-500 text-xs">→</span>
                  <span class="text-sm text-gray-200 font-medium truncate max-w-[8rem]">${destName}</span>
                  <span class="text-[9px] text-gray-600">${formatCurrency(t.montant)} ${freqLabel}</span>
                  <span class="text-[10px] text-gray-500 ml-auto">${t.startYear}</span>
                  ${t.endYear ? `<span class="text-[10px] text-gray-600">→ ${t.endYear}</span>` : ''}
                  <button class="proj-del-transfer opacity-0 group-hover/card:opacity-100 ml-0.5 text-accent-red/50 hover:text-accent-red text-xs transition" data-id="${t.id}" onclick="event.stopPropagation()" title="Supprimer">✕</button>
                </div>`;
              }).join('') : '<p class="text-center text-gray-600 text-sm py-2">Aucun transfert — cliquez sur + pour planifier un mouvement de capital</p>'}
            </div>
            <p class="text-xs text-gray-600 mt-1">Ex: En 2035, injecter 50 000€ d'héritage dans l'Assurance Vie</p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end">
            <button id="btn-update-projection" class="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 rounded hover:opacity-90 transition">
              Recalculer
            </button>
          </div>
        </div>
      </details>

      <!-- Summary -->
      ${(() => {
        const targetYears = [20, 25, 30];
        const firstNet = first?.patrimoineNet || 0;
        const firstImmo = first?.immobilier || 0;
        const firstFin = first?.totalLiquiditesNettes || 0;
        return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">${first?.label || 'Fin ' + new Date().getFullYear()}</p>
          <p class="text-2xl font-bold text-gray-200">${formatCurrency(firstNet)}</p>
          <div class="flex gap-3 mt-2 text-xs text-gray-500">
            <span>Immo ${formatCurrency(firstImmo)}</span>
            <span>·</span>
            <span>Liq. ${formatCurrency(firstFin)}</span>
          </div>
        </div>
        ${targetYears.map((targetYr, i) => {
          const targetCalYear = currentCalendarYear + targetYr;
          const snap = snapshots.find(s => s.calendarYear === targetCalYear) || snapshots[snapshots.length - 1];
          const net = snap?.patrimoineNet || 0;
          const immo = snap?.immobilier || 0;
          const liq = snap?.totalLiquiditesNettes || 0;
          const evol = net - firstNet;
          const evolPct = firstNet ? evol / Math.abs(firstNet) : 0;
          const glows = ['glow-blue', 'glow-green', 'glow-blue'];
          return `
        <div class="card-dark rounded-xl p-5 kpi-card ${glows[i]}">
          <p class="text-sm text-gray-400 mb-2">Fin ${targetCalYear} <span class="text-gray-600">(+${targetYr} ans)</span></p>
          <p class="text-2xl font-bold gradient-text">${formatCurrency(net)}</p>
          <div class="flex gap-3 mt-2 text-xs">
            <span class="text-pink-400">Immo ${formatCurrency(immo)}</span>
            <span class="text-gray-600">·</span>
            <span class="text-purple-400">Liq. ${formatCurrency(liq)}</span>
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
            <thead class="bg-dark-800/50 text-gray-500 text-xs">
              <tr>
                <th class="px-2 py-1.5 text-center">Année</th>
                <th class="px-2 py-1.5 text-center border-r-2 border-dark-300/40">Âge</th>
                <th class="px-2 py-1.5 text-center">Actions</th>
                <th class="px-2 py-1.5 text-center italic font-light">+ Intérêts</th>
                <th class="px-2 py-1.5 text-center">ETF</th>
                <th class="px-2 py-1.5 text-center italic font-light">+ Intérêts</th>
                <th class="px-2 py-1.5 text-center">Bitcoin</th>
                <th class="px-2 py-1.5 text-center italic font-light">+ Intérêts</th>
                <th class="px-2 py-1.5 text-center">CTO</th>
                <th class="px-2 py-1.5 text-center italic font-light">+ Intérêts</th>
                <th class="px-2 py-1.5 text-center font-semibold">Total - Flat Tax</th>
                <th class="px-2 py-1.5 text-center border-l-2 border-dark-300/40">Assurance Vie</th>
                <th class="px-2 py-1.5 text-center">PEE</th>
                <th class="px-2 py-1.5 text-center border-l-2 border-dark-300/40">Épargne</th>
                <th class="px-2 py-1.5 text-center">Héritage</th>
                <th class="px-2 py-1.5 text-center">Immobilier</th>
                <th class="px-2 py-1.5 text-center font-semibold">Total liquidités</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${snapshots.map(s => {
                const isRetirement = s.isRetraite;
                const isFiveYear = s.annee > 0 && s.annee % 5 === 0;
                const rowClass = isRetirement
                  ? 'bg-accent-amber/10 border-l-4 border-l-accent-amber'
                  : s.annee === 0
                    ? 'bg-accent-blue/5'
                    : '';
                const borderTop = isFiveYear ? 'border-t-[3px] border-t-gray-500/40' : '';
                return `
              <tr class="hover:bg-dark-600/30 transition ${rowClass} ${borderTop} text-xs">
                <td class="px-2 py-1 text-center font-medium text-gray-200">
                  ${s.label}
                  ${isRetirement ? '<span class="ml-1 text-[10px] text-accent-amber font-semibold">RET.</span>' : ''}
                </td>
                <td class="px-2 py-1 text-center border-r-2 border-dark-300/40 ${isRetirement ? 'text-accent-amber font-bold' : 'text-gray-200'}">${s.age}</td>
                <td class="px-2 py-1 text-center text-gray-200">${formatCurrency(s.placementApports['PEA Actions'] || 0)}</td>
                <td class="px-2 py-1 text-center text-gray-300 italic font-light">${formatCurrency(s.placementGains['PEA Actions'] || 0)}</td>
                <td class="px-2 py-1 text-center text-gray-200">${formatCurrency(s.placementApports['PEA ETF'] || 0)}</td>
                <td class="px-2 py-1 text-center text-gray-300 italic font-light">${formatCurrency(s.placementGains['PEA ETF'] || 0)}</td>
                <td class="px-2 py-1 text-center text-gray-200">${formatCurrency(s.placementApports['Crypto'] || 0)}</td>
                <td class="px-2 py-1 text-center text-gray-300 italic font-light">${formatCurrency(s.placementGains['Crypto'] || 0)}</td>
                <td class="px-2 py-1 text-center text-gray-200">${formatCurrency(s.placementApports['CTO'] || 0)}</td>
                <td class="px-2 py-1 text-center text-gray-300 italic font-light">${formatCurrency(s.placementGains['CTO'] || 0)}</td>
                <td class="px-2 py-1 text-center font-semibold text-accent-cyan">${formatCurrency(s.cashApresImpot)}</td>
                <td class="px-2 py-1 text-center text-gray-200 border-l-2 border-dark-300/40">${formatCurrency(s.placementDetail['Assurance Vie'] || 0)}</td>
                <td class="px-2 py-1 text-center text-gray-200">${formatCurrency(s.placementDetail['PEE'] || 0)}</td>
                <td class="px-2 py-1 text-center text-gray-200 border-l-2 border-dark-300/40">${formatCurrency(s.epargne)}</td>
                <td class="px-2 py-1 text-center text-gray-200">${formatCurrency(s.heritage)}</td>
                <td class="px-2 py-1 text-center text-gray-200">${formatCurrency(s.immobilier)}</td>
                <td class="px-2 py-1 text-center font-semibold text-accent-green">${formatCurrency(s.totalLiquiditesNettes)}</td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Stratégie d'investissement — éditable -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-5 py-3 cursor-pointer select-none">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-semibold text-gray-200">Ma stratégie d'investissement</h2>
            <span class="text-[10px] text-gray-600 italic">Cliquer pour modifier</span>
          </div>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 class="text-sm font-semibold text-accent-amber mb-2">Enveloppes & plafonds</h3>
              <div id="strat-enveloppes" contenteditable="true" class="editable-block min-h-[120px] p-3 rounded-lg bg-dark-800/40 border border-dark-400/20 text-sm text-gray-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent-blue/30 whitespace-pre-wrap">${(params.strategie?.enveloppes || `PEA : plafond 150 000 € de versements (gains exonérés d'IR après 5 ans)
Assurance Vie : pas de plafond, fiscalité avantageuse après 8 ans
CTO : pas de plafond, flat tax 30% sur les plus-values
PER : déductible du revenu imposable, bloqué jusqu'à la retraite
Crypto : flat tax 30% sur les plus-values réalisées`).replace(/</g, '&lt;')}</div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-accent-cyan mb-2">Répartition cible & DCA</h3>
              <div id="strat-repartition" contenteditable="true" class="editable-block min-h-[120px] p-3 rounded-lg bg-dark-800/40 border border-dark-400/20 text-sm text-gray-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent-blue/30 whitespace-pre-wrap">${(params.strategie?.repartition || `Objectif : remplir le PEA en priorité (avantage fiscal)
DCA mensuel ETF World : ... €/mois
DCA mensuel Actions : ... €/mois
DCA mensuel Crypto : ... €/mois
Quand le PEA est plein → basculer le DCA vers le CTO`).replace(/</g, '&lt;')}</div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-accent-green mb-2">Moyens supplémentaires</h3>
              <div id="strat-moyens" contenteditable="true" class="editable-block min-h-[120px] p-3 rounded-lg bg-dark-800/40 border border-dark-400/20 text-sm text-gray-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent-blue/30 whitespace-pre-wrap">${(params.strategie?.moyens || `Capacité d'épargne mensuelle : ... €
Prime annuelle / 13e mois : ... €
Revenus complémentaires (dividendes, loyers) : ... €
Héritage prévu : ...`).replace(/</g, '&lt;')}</div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-purple-400 mb-2">Objectifs & horizon</h3>
              <div id="strat-objectifs" contenteditable="true" class="editable-block min-h-[120px] p-3 rounded-lg bg-dark-800/40 border border-dark-400/20 text-sm text-gray-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent-blue/30 whitespace-pre-wrap">${(params.strategie?.objectifs || `Retraite anticipée à ... ans
Patrimoine cible : ... €
Rente mensuelle visée : ... €/mois
Stratégie de sortie : ...`).replace(/</g, '&lt;')}</div>
            </div>
          </div>
        </div>
      </details>

      <!-- Formules de calcul -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-5 py-3 cursor-pointer select-none">
          <h2 class="text-lg font-semibold text-gray-200">Comment sont calculées les projections</h2>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-5 space-y-4 text-sm text-gray-400 leading-relaxed">

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-accent-green font-semibold mb-1">Intérêts composés (placements)</h3>
              <p>Chaque mois : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">valeur × (1 + rendement / 12)</code></p>
              <p class="mt-1 text-xs text-gray-500">Le DCA mensuel est ajouté <em>avant</em> la croissance du mois. L'effet boule de neige : les intérêts génèrent eux-mêmes des intérêts.</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-accent-amber font-semibold mb-1">Plafond PEA (150 000 €)</h3>
              <p>Seuls les <em>versements</em> comptent (pas les gains). Quand le plafond est atteint, le DCA excédentaire bascule automatiquement vers le CTO.</p>
              <p class="mt-1 text-xs text-gray-500">Les gains dans le PEA ne sont pas plafonnés : votre PEA peut valoir bien plus que 150k€.</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-accent-cyan font-semibold mb-1">Fiscalité PEA (après 5 ans)</h3>
              <p>Prélèvements sociaux seuls : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">gains × 17.2%</code></p>
              <p class="mt-1 text-xs text-gray-500">Avant 5 ans, c'est la flat tax complète (30%). Après 5 ans, exonération d'impôt sur le revenu → seulement 17.2% de cotisations sociales.</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-blue-400 font-semibold mb-1">Flat Tax CTO / Crypto (30%)</h3>
              <p>Sur les plus-values : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">gains × 30%</code></p>
              <p class="mt-1 text-xs text-gray-500">Le PFU (Prélèvement Forfaitaire Unique) = 12.8% d'IR + 17.2% de prélèvements sociaux. Appliqué uniquement sur les gains, pas sur le capital investi.</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-pink-400 font-semibold mb-1">Immobilier</h3>
              <p>Croissance annuelle : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">valeur × (1 + rendement immo)</code></p>
              <p class="mt-1 text-xs text-gray-500">Appliqué proportionnellement au nombre de mois restants la 1ère année.</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-purple-400 font-semibold mb-1">Épargne (livrets)</h3>
              <p>Croissance annuelle : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">solde × (1 + taux moyen pondéré)</code></p>
              <p class="mt-1 text-xs text-gray-500">Le taux est la moyenne pondérée par le solde de chaque livret. Les intérêts des livrets réglementés sont nets d'impôt.</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-gray-300 font-semibold mb-1">Inflation</h3>
              <p>Les revenus et dépenses augmentent chaque année : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">montant × (1 + inflation)</code></p>
              <p class="mt-1 text-xs text-gray-500">Simule la hausse du coût de la vie. Les placements ne sont pas ajustés (rendement nominal).</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-gray-300 font-semibold mb-1">Total - Flat Tax</h3>
              <p><code class="text-gray-300 bg-dark-900/60 px-1 rounded">Σ valeur placements − Σ impôts sur gains</code></p>
              <p class="mt-1 text-xs text-gray-500">C'est ce que vous toucheriez si vous vendiez tout aujourd'hui, après avoir payé les impôts sur chaque enveloppe selon sa fiscalité propre.</p>
            </div>
          </div>

        </div>
      </details>
    </div>
  `;
}

function openTransferModal(store, navigate, editItem = null) {
  const placements = store.get('actifs.placements') || [];
  const currentYear = new Date().getFullYear();
  const destOptions = placements.map(p => ({
    value: p.id,
    label: `${p.nom} (${p.enveloppe || p.type})`
  }));

  const title = editItem ? 'Modifier le transfert' : 'Planifier un transfert de capital';
  const body = `
    ${selectField('source', 'Source du capital', [
      { value: 'epargne', label: 'Épargne (livrets, fonds euros)' },
      { value: 'heritage', label: 'Héritage (liquidités)' }
    ], editItem?.source || 'epargne')}
    ${selectField('destinationId', 'Destination (placement)', destOptions, editItem?.destinationId || '')}
    ${inputField('montant', 'Montant (€)', editItem?.montant || '', 'number', 'min="0" step="1000" placeholder="50000"')}
    ${selectField('frequency', 'Fréquence', [
      { value: 'once', label: 'Une seule fois' },
      { value: 'annual', label: 'Chaque année' }
    ], editItem?.frequency || 'once')}
    ${inputField('startYear', 'Année de début', editItem?.startYear || currentYear + 1, 'number', `min="${currentYear}" max="${currentYear + 50}" step="1"`)}
    <div id="transfer-end-year-wrapper">
      ${inputField('endYear', 'Année de fin (si récurrent)', editItem?.endYear || '', 'number', `min="${currentYear}" max="${currentYear + 50}" step="1" placeholder="Optionnel"`)}
    </div>
    <div class="p-3 bg-dark-800/50 rounded-lg text-xs text-gray-500 space-y-1 mt-2">
      <p><strong class="text-gray-400">Comment ça marche :</strong></p>
      <p>Le montant est prélevé de la source (épargne ou héritage liquide) et injecté dans le placement choisi à l'année indiquée.</p>
      <p>Si récurrent, le transfert se répète chaque année entre l'année de début et de fin.</p>
    </div>
  `;

  const modal = openModal(title, body, () => {
    const data = getFormData(document.getElementById('modal-body'));
    if (!data.destinationId || !data.montant || !data.startYear) return;
    data.montant = Number(data.montant);
    data.startYear = Number(data.startYear);
    if (data.endYear) data.endYear = Number(data.endYear);
    else delete data.endYear;

    const transfers = store.get('parametres')?.capitalTransfers || [];
    if (editItem) {
      const idx = transfers.findIndex(t => t.id === editItem.id);
      if (idx !== -1) transfers[idx] = { ...transfers[idx], ...data };
    } else {
      data.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      transfers.push(data);
    }
    store.set('parametres.capitalTransfers', transfers);
    navigate('projection');
  });

  // Toggle end year visibility based on frequency
  const freqSelect = modal.querySelector('#field-frequency');
  const endWrapper = modal.querySelector('#transfer-end-year-wrapper');
  if (freqSelect && endWrapper) {
    const toggle = () => endWrapper.style.display = freqSelect.value === 'annual' ? '' : 'none';
    toggle();
    freqSelect.addEventListener('change', toggle);
  }
}

export function mount(store, navigate) {
  const snapshots = computeProjection(store);
  const groupKeys = snapshots.groupKeys || [];
  const labels = snapshots.map(s => s.label);

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

    // Total liquidités nettes (hidden by default, toggle via legend)
    datasets.push({
      label: 'Total liquidités nettes',
      data: snapshots.map(s => s.totalLiquiditesNettes),
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
    const toLabel = (v) => `Fin ${currentYear + v}`;

    // Dashed vertical lines only (no labels to avoid overlap)
    if (inRange(retraiteSouhaiteeOffset)) {
      milestoneAnnotations.retraiteSouhaitee = {
        type: 'line',
        xMin: toLabel(retraiteSouhaiteeOffset),
        xMax: toLabel(retraiteSouhaiteeOffset),
        borderColor: 'rgba(168,85,247,0.4)',
        borderWidth: 1,
        borderDash: [6, 4]
      };
    }
    if (inRange(retraiteTauxLegalOffset)) {
      milestoneAnnotations.retraiteLegal = {
        type: 'line',
        xMin: toLabel(retraiteTauxLegalOffset),
        xMax: toLabel(retraiteTauxLegalOffset),
        borderColor: 'rgba(245,158,11,0.4)',
        borderWidth: 1,
        borderDash: [6, 4]
      };
    }
    if (inRange(retraiteTauxPleinOffset)) {
      milestoneAnnotations.retraitePlein = {
        type: 'line',
        xMin: toLabel(retraiteTauxPleinOffset),
        xMax: toLabel(retraiteTauxPleinOffset),
        borderColor: 'rgba(34,211,238,0.4)',
        borderWidth: 1,
        borderDash: [6, 4]
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

  // Enter key triggers Recalculer on any param input
  document.querySelectorAll('.param-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-update-projection')?.click();
      }
    });
  });

  // Update params
  document.getElementById('btn-update-projection')?.addEventListener('click', () => {
    store.set('parametres.projectionYears', parseInt(document.getElementById('param-years').value) || 30);
    store.set('parametres.ageFinAnnee', parseInt(document.getElementById('param-age').value) || 43);
    store.set('parametres.ageRetraite', parseInt(document.getElementById('param-retraite').value) || 64);
    store.set('parametres.inflationRate', (parseFloat(document.getElementById('param-inflation').value) || 2) / 100);
    store.set('parametres.rendementImmobilier', (parseFloat(document.getElementById('param-rend-immo').value) || 2) / 100);
    store.set('parametres.rendementEpargne', (parseFloat(document.getElementById('param-rend-epar').value) || 2) / 100);
    // Global envelope rendements removed — now controlled per-placement via .plac-rend inputs

    // Per-placement rendement overrides
    const rendementPlacements = {};
    document.querySelectorAll('.placement-row').forEach(row => {
      const pid = row.dataset.placementId;
      const rendInput = row.querySelector('.plac-rend');
      if (rendInput) {
        rendementPlacements[pid] = (parseFloat(rendInput.value) || 5) / 100;
      }
    });
    store.set('parametres.rendementPlacements', rendementPlacements);

    // Retirement milestones
    store.set('parametres.ageRetraiteTauxLegal', parseInt(document.getElementById('param-retraite-legal-age').value) || 64);
    store.set('parametres.pensionTauxLegal', parseInt(document.getElementById('param-pension-legal').value) || 2442);
    store.set('parametres.ageRetraiteTauxPlein', parseInt(document.getElementById('param-retraite-plein-age').value) || 65);
    store.set('parametres.pensionTauxPlein', parseInt(document.getElementById('param-pension-plein').value) || 2642);
    store.set('parametres.ageRetraiteSouhaitee', parseInt(document.getElementById('param-retraite-souhaitee').value) || 60);

    navigate('projection');
  });

  // --- Placement CRUD from projection ---
  // Global add button
  document.getElementById('proj-add-plac-global')?.addEventListener('click', () => {
    openAddPlacementModal(store, navigate, 'projection', null);
  });

  // Click on placement card to edit
  document.querySelectorAll('.proj-edit-plac').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditPlacementModal(store, navigate, 'projection', el.dataset.id);
    });
  });

  // Also make the whole card clickable (except input/button)
  document.querySelectorAll('.placement-row[data-placement-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      openEditPlacementModal(store, navigate, 'projection', row.dataset.placementId);
    });
  });

  // Drag-and-drop reorder placements
  {
    let draggedId = null;
    const cards = document.querySelectorAll('.placement-row[data-placement-id]');
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedId = card.dataset.placementId;
        card.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.style.opacity = '';
        document.querySelectorAll('.placement-row').forEach(c => c.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const targetId = card.dataset.placementId;
        if (!draggedId || draggedId === targetId) return;
        const placements = store.get('actifs.placements');
        const fromIdx = placements.findIndex(p => p.id === draggedId);
        const toIdx = placements.findIndex(p => p.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = placements.splice(fromIdx, 1);
        placements.splice(toIdx, 0, moved);
        store.set('actifs.placements', placements);
        navigate('projection');
      });
    });
  }

  // Delete placement from projection
  document.querySelectorAll('.proj-del-plac').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Supprimer ce placement ?')) {
        store.removeItem('actifs.placements', btn.dataset.id);
        navigate('projection');
      }
    });
  });

  // --- Heritage CRUD from projection ---
  document.getElementById('proj-add-heritage')?.addEventListener('click', () => {
    openHeritageModal(store, navigate, null, 'projection');
  });

  document.querySelectorAll('.heritage-row[data-heritage-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const item = (store.get('heritage') || []).find(h => h.id === row.dataset.heritageId);
      if (item) openHeritageModal(store, navigate, item, 'projection');
    });
  });

  document.querySelectorAll('.proj-del-heritage').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Supprimer cet héritage ?')) {
        store.removeItem('heritage', btn.dataset.id);
        navigate('projection');
      }
    });
  });

  // --- Capital Transfers CRUD ---
  document.getElementById('proj-add-transfer')?.addEventListener('click', () => {
    openTransferModal(store, navigate);
  });

  document.querySelectorAll('.transfer-row[data-transfer-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const transfers = store.get('parametres')?.capitalTransfers || [];
      const item = transfers.find(t => t.id === row.dataset.transferId);
      if (item) openTransferModal(store, navigate, item);
    });
  });

  document.querySelectorAll('.proj-del-transfer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Supprimer ce transfert ?')) {
        const transfers = (store.get('parametres')?.capitalTransfers || []).filter(t => t.id !== btn.dataset.id);
        store.set('parametres.capitalTransfers', transfers);
        navigate('projection');
      }
    });
  });

  // Auto-save editable strategy blocks on blur
  const stratFields = [
    { id: 'strat-enveloppes', key: 'enveloppes' },
    { id: 'strat-repartition', key: 'repartition' },
    { id: 'strat-moyens', key: 'moyens' },
    { id: 'strat-objectifs', key: 'objectifs' }
  ];
  stratFields.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('blur', () => {
        const current = store.get('parametres')?.strategie || {};
        current[key] = el.innerText;
        store.set('parametres.strategie', current);
      });
    }
  });
}
