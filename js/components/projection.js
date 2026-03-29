import { formatCurrency, formatPercent, computeProjection, inputField, selectField, getFormData, getPlacementGroupKey, openModal } from '../utils.js?v=7';
import { createChart, COLORS, createVerticalGradient, VIVID_PALETTE } from '../charts/chart-config.js';
import { openAddPlacementModal, openEditPlacementModal } from './placement-form.js?v=5';
import { openHeritageModal } from './heritage.js?v=5';
import * as ProjectionEnfants from './projection-enfants.js?v=20260329m';
import { getEnfants, childAge, CHILD_COLORS } from './projection-enfants.js?v=20260329m';

// ─── Unified tab bar (Moi + enfants + Comparatif) ─────────────────────────

function renderProjTabs(store) {
  const activeTab = store.get('_projTab') || 'moi';
  const enfants = getEnfants(store);
  const userInfo = store.getAll().userInfo || {};
  const prenom = (userInfo.prenom || '').trim() || 'Moi';

  return `
    <div class="flex gap-1 bg-dark-800/50 rounded-xl p-1 border border-dark-400/15 mb-6">
      <button class="proj-tab flex-1 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-150
        ${'moi' === activeTab ? 'bg-dark-600 text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700/30'
      }" data-proj-tab="moi">
        <svg class="inline w-3.5 h-3.5 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        ${prenom}
      </button>
      ${enfants.map((e, i) => `
      <button class="proj-tab flex-1 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-150
        ${'child-' + i === activeTab ? 'bg-dark-600 text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700/30'
      }" data-proj-tab="child-${i}">
        <span class="inline-block w-2 h-2 rounded-full mr-1.5" style="background:${CHILD_COLORS[i % CHILD_COLORS.length]}"></span>
        ${e.prenom || 'Enfant ' + (i + 1)}${childAge(e.dateNaissance) !== null ? ' \u00b7 ' + childAge(e.dateNaissance) + ' ans' : ''}
      </button>`).join('')}
    </div>`;
}

export function render(store) {
  const activeTab = store.get('_projTab') || 'moi';

  // Child tab → delegate to projection-enfants
  if (activeTab.startsWith('child-')) {
    // Sync _peActiveTab so projection-enfants renders the right child
    const peTab = activeTab.replace('child-', '');
    store.set('_peActiveTab', peTab);
    const childContent = ProjectionEnfants.render(store, { embedded: true });
    // Strip the header and internal tabs from projection-enfants output,
    // replace with our unified header + tabs
    return `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          Projection
        </h2>
        <p class="text-gray-500 text-sm mt-1">Simule l\u2019\u00e9volution de ton patrimoine dans le temps</p>
      </div>
      ${renderProjTabs(store)}
      <div id="proj-child-content">${childContent}</div>
    </div>`;
  }

  // "Moi" tab → original projection content
  const params = store.get('parametres');
  const snapshots = computeProjection(store);
  const groupKeys = snapshots.groupKeys || [];
  const rendementPlacements = params.rendementPlacements || {};
  const placements = (store.getAll().actifs?.placements || []);
  const heritageItems = store.get('heritage') || [];
  const capitalTransfers = params.capitalTransfers || [];
  const surplusAnnuel = store.get('surplusAnnuel') || [];
  const surplusByYear = {};
  surplusAnnuel.forEach(s => { surplusByYear[Number(s.year)] = Number(s.montant) || 0; });
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
    'CTO TR': 'text-accent-blue',
    'CTO BB': 'text-purple-400',
    'PER': 'text-accent-green',
    'Crypto': 'text-accent-amber',
    'PEE': 'text-emerald-400',
    'Livrets': 'text-sky-300',
    'Autre': 'text-gray-400'
  };
  const defaultGroupColor = 'text-accent-green';

  return `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          Projection
        </h2>
        <p class="text-gray-500 text-sm mt-1">Simule l'évolution de ton patrimoine dans le temps</p>
      </div>
      ${renderProjTabs(store)}

      <!-- Parameters — collapsible -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-4 py-2 cursor-pointer select-none">
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Paramètres</h2>
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
              ].map(([id, label, val, min, max, step, suffix]) => `
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500">${label}</span>
                <input type="number" id="${id}" value="${val}" min="${min}" max="${max}" step="${step}"
                  class="param-input input-field w-14 text-center">
                ${suffix ? `<span class="text-xs text-gray-500">${suffix}</span>` : ''}
              </div>`).join('')}
            </div>
            <div class="w-px h-4 bg-dark-400/30 hidden sm:block"></div>
            <div class="flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500">Retraite</span>
                <input type="number" id="param-retraite" value="${params.ageRetraite || 64}" min="55" max="70" step="1"
                  class="param-input input-field w-12 text-center">
              </div>
            </div>
          </div>

          <!-- Row 2: Placements as compact grid -->
          <div>
            <div class="flex items-center gap-1.5 mb-1">
              <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <span class="text-base font-bold text-gray-300 uppercase tracking-wide">Placements</span>
              <button id="proj-add-plac-global" class="ml-2 w-8 h-8 flex items-center justify-center rounded-lg bg-accent-green/25 text-accent-green hover:bg-accent-green/40 transition text-xl font-bold shadow-sm shadow-accent-green/20" title="Ajouter un placement">+</button>
              <button id="btn-actu-rapide" class="ml-1 flex items-center gap-1 px-2.5 py-1.5 bg-dark-700/60 text-gray-400 text-[11px] rounded hover:bg-dark-600 hover:text-gray-300 transition font-medium" title="Actualisation rapide DCA">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Actu. rapide
              </button>
            </div>
            ${(() => {
                const groupIcons = {
                  'PEA Actions': '<svg class="w-2.5 h-2.5 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>',
                  'PEA ETF': '<svg class="w-2.5 h-2.5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>',
                  'Crypto': '<svg class="w-2.5 h-2.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
                  'Assurance Vie': '<svg class="w-2.5 h-2.5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
                  'PEE': '<svg class="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>',
                  'CTO': '<svg class="w-2.5 h-2.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>',
                  'CTO TR': '<svg class="w-2.5 h-2.5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>',
                  'CTO BB': '<svg class="w-2.5 h-2.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"/></svg>',
                };
                const defaultIcon = '<svg class="w-2.5 h-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>';
                const stockColors = {
                  'air liquide': 'text-accent-blue',
                  'schneider': 'text-accent-green',
                  'legrand': 'text-amber-400',
                };
                const renderCard = (p) => {
                  const gk = getPlacementGroupKey(p);
                  const currentRend = rendementPlacements[p.id] !== undefined ? rendementPlacements[p.id] : (Number(p.rendement) || 0.05);
                  const nomLower = (p.nom || '').toLowerCase();
                  const stockColor = Object.entries(stockColors).find(([k]) => nomLower.includes(k));
                  let icon = groupIcons[gk] || defaultIcon;
                  if (stockColor) {
                    icon = icon.replace(/text-(?:accent-\w+|amber-\d+|emerald-\d+|sky-\d+|gray-\d+)/, stockColor[1]);
                  }
                  const dcaBase = Number(p.dcaMensuel) || 0;
                  const dcaMaxOv = (p.dcaOverrides || []).reduce((m, ov) => Math.max(m, Number(ov.dcaMensuel) || 0), 0);
                  const dcaEff = Math.max(dcaBase, dcaMaxOv);
                  const dcaLabel = dcaEff > 0 ? `<span class="text-[9px] text-gray-600">${dcaEff}€/m${dcaBase === 0 ? ' (prog.)' : ''}</span>` : '';
                  return `<div class="group/card flex items-center gap-1.5 px-2.5 py-1.5 rounded row-item hover:border-accent-blue/40 hover:bg-dark-700/40 transition cursor-grab active:cursor-grabbing placement-row" draggable="true" data-placement-id="${p.id}">
                    <svg class="w-3 h-4 text-gray-600 flex-shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
                      <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
                      <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
                    </svg>
                    ${icon}
                    <span class="text-[11px] text-gray-200 whitespace-nowrap font-medium proj-edit-plac" data-id="${p.id}" title="${p.nom}">${p.nom}</span>
                    ${dcaLabel}
                    <span class="text-[10px] text-gray-500 ml-auto">${gk}</span>
                    <input type="number" class="param-input plac-rend input-field w-14 text-center font-medium"
                      value="${(currentRend * 100).toFixed(1)}" min="-20" max="50" step="0.5" onclick="event.stopPropagation()">
                    <span class="text-[10px] text-gray-500">%</span>
                    <button class="proj-del-plac btn-delete" data-id="${p.id}" onclick="event.stopPropagation()" title="Supprimer">✕</button>
                  </div>`;
                };
                return `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
              ${placements.length > 0 ? placements.map(renderCard).join('') : '<p class="col-span-full text-center text-gray-600 text-sm py-3">Aucun placement — cliquez sur + pour en ajouter</p>'}
            </div>`;
              })()}
          </div>

          <!-- Row 2a: Livrets d'épargne -->
          ${(() => {
            const epargne = store.get('actifs.epargne') || [];
            if (epargne.length === 0) return '';
            const totalEpargne = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
            return `
          <div class="mt-1">
            <div class="flex items-center gap-1.5 mb-1">
              <svg class="w-3 h-3 text-sky-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              <span class="text-base font-bold text-gray-300 uppercase tracking-wide">Livrets d'épargne</span>
              <span class="text-base font-bold text-sky-300 ml-1">${formatCurrency(totalEpargne)}</span>
            </div>
          </div>`;
          })()}

          <!-- Row 2b: PEA overflow redirection -->
          ${(() => {
            const peaPlacements = placements.filter(p => {
              const env = (p.enveloppe || p.type || '').toUpperCase();
              return env.startsWith('PEA') && env !== 'PEE';
            });
            // Consider both base dcaMensuel and dcaOverrides to detect future DCA
            const peaDCA = peaPlacements.reduce((s, p) => {
              const base = Number(p.dcaMensuel) || 0;
              const maxOverride = (p.dcaOverrides || []).reduce((m, ov) => Math.max(m, Number(ov.dcaMensuel) || 0), 0);
              return s + Math.max(base, maxOverride);
            }, 0);
            if (peaDCA <= 0) return '';

            const peaApports = peaPlacements.reduce((s, p) => s + ((Number(p.pru) || 0) * (Number(p.quantite) || 0) || Number(p.apport) || Number(p.valeur) || 0), 0);
            const peaRestant = Math.max(0, 150000 - peaApports);
            const moisRestant = peaDCA > 0 ? Math.ceil(peaRestant / peaDCA) : 0;

            // Compute average CTO rendement from configured placements
            const ctoPlacs = placements.filter(p => (p.enveloppe || '').toUpperCase() === 'CTO');
            const avgCTORend = ctoPlacs.length > 0
              ? ctoPlacs.reduce((s, p) => s + (rendementPlacements[p.id] !== undefined ? rendementPlacements[p.id] : (Number(p.rendement) || 0.05)), 0) / ctoPlacs.length
              : 0.05;

            // Category options for overflow targets
            const overflowCategories = [
              { value: 'cto', label: 'CTO (tous)' },
              { value: 'cto_tr', label: 'CTO TR' },
              { value: 'cto_bb', label: 'CTO BB' },
              { value: 'av', label: 'Assurance Vie' },
              { value: 'bitcoin', label: 'Bitcoin' },
              { value: 'epargne', label: 'Épargne' },
              { value: 'donation', label: 'Donation' },
              { value: 'epargne', label: 'Épargne' },
            ];

            // Current overflow targets from params
            const overflowTargets = params.peaOverflowTargets || [];
            // If no targets configured, default to empty (will show CTO default)
            const hasTargets = overflowTargets.length > 0;
            const totalPct = overflowTargets.reduce((s, t) => s + (Number(t.pct) || 0), 0);

            return `
          <div class="mt-2 p-3 rounded-xl bg-dark-800/30 border border-dark-400/15">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-3.5 h-3.5 text-accent-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
              <span class="text-sm font-semibold text-gray-300">Quand le PEA est plein</span>
              <span class="text-[10px] text-gray-500 ml-1">→ rediriger ${formatCurrency(peaDCA)}/mois vers :</span>
              <span class="text-[10px] ${peaRestant <= 0 ? 'text-accent-red' : 'text-gray-600'} ml-auto">${peaRestant <= 0 ? 'PEA déjà plein' : `Plein dans ~${moisRestant} mois`} (versé : ${formatCurrency(peaApports)} / 150 000 €)</span>
            </div>
            <div class="space-y-1.5" id="pea-overflow-targets">
              ${hasTargets ? overflowTargets.map((t, idx) => {
                const catLabel = overflowCategories.find(c => c.value === t.category)?.label || t.category;
                return `
              <div class="flex items-center gap-2 text-sm overflow-target-row" data-idx="${idx}">
                <select class="overflow-target-select input-field flex-1">
                  ${overflowCategories.map(c => `<option value="${c.value}" ${c.value === t.category ? 'selected' : ''}>${c.label}</option>`).join('')}
                </select>
                <input type="number" class="overflow-target-pct input-field w-16 text-center" value="${t.pct || 100}" min="1" max="100" step="1">
                <span class="text-[10px] text-gray-500">%</span>
                <span class="text-[10px] text-gray-600">${formatCurrency(peaDCA * (t.pct || 100) / 100)}/m</span>
                <button class="overflow-target-delete btn-delete" data-idx="${idx}">✕</button>
              </div>`;
              }).join('') : `
              <div class="flex items-center gap-2 text-sm text-gray-500">
                <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>Par défaut : tout bascule vers le CTO (${(avgCTORend * 100).toFixed(1)}%/an)</span>
              </div>
              `}
              ${totalPct < 100 && hasTargets ? `<p class="text-[10px] text-accent-amber">Attention : ${totalPct}% alloué — les ${100 - totalPct}% restants iront vers le CTO</p>` : ''}
            </div>
            <button id="btn-add-overflow-target" class="mt-2 text-[11px] text-accent-amber hover:text-accent-amber/80 transition flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              Ajouter une cible
            </button>
          </div>`;
          })()}

          <!-- Row 2c: AV overflow redirection -->
          ${(() => {
            const avPlacements = placements.filter(p => {
              const env = (p.enveloppe || p.type || '').toUpperCase();
              return env === 'AV';
            });
            // Consider both base dcaMensuel and dcaOverrides to detect future DCA
            const avDCA = avPlacements.reduce((s, p) => {
              const base = Number(p.dcaMensuel) || 0;
              const maxOverride = (p.dcaOverrides || []).reduce((m, ov) => Math.max(m, Number(ov.dcaMensuel) || 0), 0);
              return s + Math.max(base, maxOverride);
            }, 0);
            if (avDCA <= 0) return '';

            const avApports = avPlacements.reduce((s, p) => s + ((Number(p.pru) || 0) * (Number(p.quantite) || 0) || Number(p.apport) || Number(p.valeur) || 0), 0);
            const avRestant = Math.max(0, 300000 - avApports);
            const moisRestantAV = avDCA > 0 ? Math.ceil(avRestant / avDCA) : 0;

            // Compute average CTO rendement from configured placements
            const ctoPlacs = placements.filter(p => (p.enveloppe || '').toUpperCase() === 'CTO');
            const avgCTORendAV = ctoPlacs.length > 0
              ? ctoPlacs.reduce((s, p) => s + (rendementPlacements[p.id] !== undefined ? rendementPlacements[p.id] : (Number(p.rendement) || 0.05)), 0) / ctoPlacs.length
              : 0.05;

            // Category options for AV overflow targets
            const avOverflowCategories = [
              { value: 'cto', label: 'CTO (tous)' },
              { value: 'cto_tr', label: 'CTO TR' },
              { value: 'cto_bb', label: 'CTO BB' },
              { value: 'bitcoin', label: 'Bitcoin' },
              { value: 'epargne', label: 'Épargne' },
              { value: 'donation', label: 'Donation' },
            ];

            const avOverflowTargets = params.avOverflowTargets || [];
            const hasAVTargets = avOverflowTargets.length > 0;
            const totalAVPct = avOverflowTargets.reduce((s, t) => s + (Number(t.pct) || 0), 0);

            return `
          <div class="mt-2 p-3 rounded-xl bg-dark-800/30 border border-dark-400/15">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-3.5 h-3.5 text-accent-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
              <span class="text-sm font-semibold text-gray-300">Quand l'Assurance Vie est pleine</span>
              <span class="text-[10px] text-gray-500 ml-1">→ rediriger ${formatCurrency(avDCA)}/mois vers :</span>
              <span class="text-[10px] ${avRestant <= 0 ? 'text-accent-red' : 'text-gray-600'} ml-auto">${avRestant <= 0 ? 'AV déjà pleine' : `Pleine dans ~${moisRestantAV} mois`} (versé : ${formatCurrency(avApports)} / 300 000 €)</span>
            </div>
            <div class="space-y-1.5" id="av-overflow-targets">
              ${hasAVTargets ? avOverflowTargets.map((t, idx) => {
                const catLabel = avOverflowCategories.find(c => c.value === t.category)?.label || t.category;
                return `
              <div class="flex items-center gap-2 text-sm av-overflow-target-row" data-idx="${idx}">
                <select class="av-overflow-target-select input-field flex-1">
                  ${avOverflowCategories.map(c => `<option value="${c.value}" ${c.value === t.category ? 'selected' : ''}>${c.label}</option>`).join('')}
                </select>
                <input type="number" class="av-overflow-target-pct input-field w-16 text-center" value="${t.pct || 100}" min="1" max="100" step="1">
                <span class="text-[10px] text-gray-500">%</span>
                <span class="text-[10px] text-gray-600">${formatCurrency(avDCA * (t.pct || 100) / 100)}/m</span>
                <button class="av-overflow-target-delete btn-delete" data-idx="${idx}">✕</button>
              </div>`;
              }).join('') : `
              <div class="flex items-center gap-2 text-sm text-gray-500">
                <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span>Par défaut : tout bascule vers le CTO (${(avgCTORendAV * 100).toFixed(1)}%/an)</span>
              </div>
              `}
              ${totalAVPct < 100 && hasAVTargets ? `<p class="text-[10px] text-accent-cyan">Attention : ${totalAVPct}% alloué — les ${100 - totalAVPct}% restants iront vers le CTO</p>` : ''}
            </div>
            <button id="btn-add-av-overflow-target" class="mt-2 text-[11px] text-accent-cyan hover:text-accent-cyan/80 transition flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
              Ajouter une cible
            </button>
          </div>`;
          })()}

          <!-- Row 3: Capital Transfers + Heritage side by side -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <!-- Capital Transfers -->
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                <span class="text-base font-bold text-gray-300 uppercase tracking-wide">Transferts</span>
                <button id="proj-add-transfer" class="ml-2 w-8 h-8 flex items-center justify-center rounded-lg bg-purple-500/25 text-purple-400 hover:bg-purple-500/40 transition text-xl font-bold shadow-sm shadow-purple-500/20" title="Ajouter un transfert">+</button>
              </div>
              <div class="space-y-1">
                ${capitalTransfers.length > 0 ? capitalTransfers.map(t => {
                  const catDestNames = { '__cat_pea__': 'PEA', '__cat_cto__': 'CTO', '__cat_cto_tr__': 'CTO TR', '__cat_cto_bb__': 'CTO BB', '__cat_bitcoin__': 'Bitcoin', '__cat_av__': 'Assurance Vie', '__cat_epargne__': 'Epargne', 'surplus': 'Surplus', '__donation__': 'Donation', '__cto_overflow__': 'CTO' };
                  const destPlacement = placements.find(p => p.id === t.destinationId);
                  const destName = catDestNames[t.destinationId] || (destPlacement ? destPlacement.nom : '(supprimé)');
                  const catSrcNames = { '__cat_pea__': 'PEA', '__cat_cto__': 'CTO', '__cat_cto_tr__': 'CTO TR', '__cat_cto_bb__': 'CTO BB', '__cat_bitcoin__': 'Bitcoin', '__cat_av__': 'Assurance Vie', '__cat_pee__': 'PEE', 'epargne': 'Epargne', 'surplus': 'Surplus', 'heritage': 'Héritage', '__donation__': 'Donation' };
                  const sourceLabel = catSrcNames[t.source] || t.source;
                  const sourceBg = t.source === 'heritage' ? 'bg-accent-amber/10 text-accent-amber' : t.source === 'epargne' ? 'bg-accent-cyan/10 text-accent-cyan' : 'bg-purple-500/10 text-purple-300';
                  const freqLabels = { annual: '/an', monthly: '/mois', once: '×1' };
                  const freqLabel = freqLabels[t.frequency] || '×1';
                  return `<div class="group/card flex items-center gap-1.5 px-2 py-1 rounded row-item hover:border-purple-400/40 hover:bg-dark-700/40 transition cursor-pointer transfer-row" data-transfer-id="${t.id}">
                    <svg class="w-2.5 h-2.5 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                    <span class="text-[9px] px-1 py-0.5 rounded-full ${sourceBg}">${sourceLabel}</span>
                    <span class="text-gray-500 text-[9px]">→</span>
                    <span class="text-xs text-gray-200 font-medium truncate max-w-[6rem]">${destName}</span>
                    <span class="text-[9px] text-gray-600">${formatCurrency(t.montant)} ${freqLabel}</span>
                    <span class="text-[10px] text-gray-500 ml-auto">${t.startYear}</span>
                    ${t.endYear ? `<span class="text-[10px] text-gray-600">→${t.endYear}</span>` : ''}
                    <button class="proj-del-transfer btn-delete" data-id="${t.id}" onclick="event.stopPropagation()" title="Supprimer">✕</button>
                  </div>`;
                }).join('') : '<p class="text-center text-gray-600 text-xs py-1">Aucun transfert planifié</p>'}
              </div>
            </div>

            <!-- Heritage -->
            <div>
              <div class="flex items-center gap-1.5 mb-1">
                <svg class="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span class="text-base font-bold text-gray-300 uppercase tracking-wide">Héritage</span>
                <button id="proj-add-heritage" class="ml-2 w-8 h-8 flex items-center justify-center rounded-lg bg-accent-amber/25 text-accent-amber hover:bg-accent-amber/40 transition text-xl font-bold shadow-sm shadow-accent-amber/20" title="Ajouter un héritage">+</button>
              </div>
              <div class="space-y-1">
                ${heritageItems.length > 0 ? heritageItems.map(h => {
                  const isImmo = h.type === 'Immobilier';
                  const yearLabel = h.dateInjection ? new Date(h.dateInjection).getFullYear() : '?';
                  return `<div class="group/card flex items-center gap-1.5 px-2 py-1 rounded row-item hover:border-accent-amber/40 hover:bg-dark-700/40 transition cursor-pointer heritage-row" data-heritage-id="${h.id}">
                    <svg class="w-2.5 h-2.5 shrink-0 ${isImmo ? 'text-accent-green' : 'text-accent-amber'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      ${isImmo
                        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3"/>'
                        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>'}
                    </svg>
                    <span class="text-xs text-gray-200 truncate max-w-[7rem] font-medium" title="${h.nom}">${h.nom}</span>
                    <span class="text-[9px] text-gray-600">${formatCurrency(h.montant)}</span>
                    <span class="text-[10px] text-gray-500 ml-auto">${yearLabel}</span>
                    <button class="proj-del-heritage btn-delete" data-id="${h.id}" onclick="event.stopPropagation()" title="Supprimer">✕</button>
                  </div>`;
                }).join('') : '<p class="text-center text-gray-600 text-xs py-1">Aucun héritage</p>'}
              </div>
            </div>
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
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-200">Répartition des actifs dans le temps</h2>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1 px-2 py-1 rounded bg-red-500/8 border border-red-500/25">
              <svg class="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              <span class="text-xs text-red-400 font-medium">Cash out</span>
              <input type="number" id="param-cashout-year" value="${params.cashOutYear || ''}" min="${currentCalendarYear}" max="${currentCalendarYear + 50}" step="1"
                class="param-input w-16 px-1 py-0.5 text-sm bg-transparent border-0 text-red-400 focus:ring-0 text-center font-semibold" placeholder="année">
            </div>
            <div class="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/8 border border-purple-500/25">
              <span class="text-xs text-purple-400">Souhaité</span>
              <input type="number" id="param-retraite-souhaitee" value="${params.ageRetraiteSouhaitee || 60}" min="40" max="70" step="1"
                class="param-input w-12 px-1 py-0.5 text-sm bg-transparent border-0 text-purple-400 focus:ring-0 text-center font-semibold">
              <input type="number" id="param-salaire" value="${params.salaireNet || 1650}" min="0" max="50000" step="10"
                class="param-input w-18 px-1 py-0.5 text-sm bg-transparent border-0 text-purple-400/80 focus:ring-0 text-center font-semibold">
              <span class="text-[10px] text-gray-500">€</span>
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
          </div>
        </div>
        <div class="relative">
          <div id="chart-slide-0" class="h-80">
            <canvas id="chart-repartition-temps"></canvas>
          </div>
          <div id="chart-slide-1" class="h-80 hidden">
            <canvas id="chart-repartition-stacked"></canvas>
          </div>
          <!-- Navigation arrows -->
          <button id="chart-prev" class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-dark-700/80 border border-dark-400/30 text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition flex items-center justify-center hidden">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button id="chart-next" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-dark-700/80 border border-dark-400/30 text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
          <!-- Dots indicator -->
          <div class="flex justify-center gap-2 mt-2">
            <div id="chart-dot-0" class="w-2 h-2 rounded-full bg-accent-amber transition"></div>
            <div id="chart-dot-1" class="w-2 h-2 rounded-full bg-dark-400 transition"></div>
          </div>
        </div>
      </div>

      <!-- Detailed Table -->
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-5 border-b border-dark-400/30">
          <h2 class="text-lg font-semibold text-gray-200">Détail année par année</h2>
          <p class="text-[10px] text-gray-600 mt-1">Valeurs brutes. Survolez pour voir apports / gains / impôts. PEA &lt;5 ans: 31,4% · PEA &gt;5 ans: 17,2% · AV &lt;8 ans: 31,4% · AV &gt;8 ans: 24,7% · CTO/Crypto: 31,4% · PEE: 17,2%</p>
        </div>
        <div>
          <table class="w-full text-sm table-fixed">
            <thead class="bg-dark-800/50 text-gray-500 text-[10px] whitespace-nowrap">
              <tr>
                <th class="w-[72px] px-1 py-1.5 text-center">Année</th>
                <th class="w-[28px] px-0 py-1.5 text-center">An</th>
                <th class="w-[32px] px-0 py-1.5 text-center border-r-2 border-dark-300/40">Âge</th>
                ${groupKeys.map((gk, i) => `<th class="px-1 py-1.5 text-center ${i === groupKeys.length - 1 ? 'border-r-2 border-dark-300/40' : ''}">${gk}</th>`).join('')}
                <th class="px-1 py-1.5 text-center font-semibold text-gray-400">Apports</th>
                <th class="px-1 py-1.5 text-center font-semibold text-accent-green/70">Gain</th>
                <th class="px-1 py-1.5 text-center font-semibold border-r-2 border-dark-300/40">Net imp.</th>
                <th class="px-1 py-1.5 text-center">Surplus</th>
                <th class="px-1 py-1.5 text-center">Épargne</th>
                <th class="px-1 py-1.5 text-center">Hérit.</th>
                <th class="px-1 py-1.5 text-center border-r-2 border-dark-300/40">Immo.</th>
                <th class="px-1 py-1.5 text-center font-semibold">Liq.</th>
                <th class="px-1 py-1.5 text-center">Donation</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${snapshots.map(s => {
                const isRetirement = s.isRetraite;
                const isFiveYear = (s.annee + 1) > 1 && (s.annee + 1) % 5 === 0;
                const rowClass = isRetirement
                  ? 'bg-accent-amber/10 border-l-4 border-l-accent-amber'
                  : s.annee === 0
                    ? 'bg-accent-blue/5'
                    : '';
                const bt = isFiveYear ? 'border-t-2 border-t-dark-300/40' : '';
                // Helper: render a placement cell with tooltip
                const placCell = (gk, extraClass = '') => {
                  const val = s.placementDetail[gk] || 0;
                  const ap = s.placementApports[gk] || 0;
                  const ga = s.placementGains[gk] || 0;
                  const tx = s.placementTaxes?.[gk] || 0;
                  const rate = s.placementTaxRates?.[gk] || 0;
                  const rateStr = rate > 0 ? ` <span class="text-gray-500">(${Math.round(rate * 100)}%)</span>` : '';
                  const tip = val > 0 ? `<div class="proj-tip"><div class="flex justify-between gap-3"><span class="text-gray-400">Apports</span><span class="text-gray-200">${formatCurrency(ap)}</span></div><div class="flex justify-between gap-3"><span class="text-gray-400">Gains</span><span class="${ga >= 0 ? 'text-accent-green' : 'text-red-400'}">${ga >= 0 ? '+' : ''}${formatCurrency(ga)}</span></div><div class="flex justify-between gap-3"><span class="text-gray-400">Impôts${rateStr}</span><span class="text-red-400">-${formatCurrency(tx)}</span></div><div class="border-t border-dark-400/40 mt-1 pt-1 flex justify-between gap-3"><span class="text-gray-300 font-medium">Net</span><span class="text-accent-cyan font-semibold">${formatCurrency(val - tx)}</span></div></div>` : '';
                  return `<td class="px-1 py-0.5 text-center text-[11px] text-gray-200 ${bt} ${extraClass} ${val > 0 ? 'proj-tip-wrap' : ''}">${val > 0 ? `${formatCurrency(val)}<div class="text-[8px] text-gray-500 leading-tight">${formatCurrency(ap)}</div>${tip}` : '<span class="text-gray-700">-</span>'}</td>`;
                };
                const totalGain = s.cashApresImpot - s.totalApports;
                return `
              <tr class="hover:bg-dark-600/30 transition ${rowClass} text-[11px] group/row">
                <td class="px-1 py-1 text-center font-medium text-gray-200 truncate ${bt}">
                  <span class="inline-flex items-center gap-0.5">
                    ${s.label}${isRetirement ? ' <span class="text-[9px] text-accent-amber font-semibold">R</span>' : ''}
                    ${s.isActualise ? '<span class="text-[8px] text-accent-green" title="Actualisé">&#10003;</span>' : ''}
                    <button class="btn-actualiser text-[9px] text-gray-600 hover:text-accent-cyan transition opacity-0 group-hover/row:opacity-100 ml-0.5" data-year="${s.calendarYear}" title="Actualiser avec les valeurs réelles">&#9998;</button>
                  </span>
                </td>
                <td class="px-0 py-1 text-center text-gray-500 ${bt}">${s.annee + 1}</td>
                <td class="px-0 py-1 text-center border-r-2 border-dark-300/40 ${bt} ${isRetirement ? 'text-accent-amber font-bold' : 'text-gray-200'}">${s.age}</td>
                ${groupKeys.map((gk, i) => placCell(gk, i === groupKeys.length - 1 ? 'border-r-2 border-dark-300/40' : '')).join('')}
                <td class="px-1 py-0.5 text-center text-[11px] text-gray-400 font-semibold ${bt}">${formatCurrency(s.totalApports)}</td>
                <td class="px-1 py-0.5 text-center font-semibold text-[11px] ${bt} ${totalGain >= 0 ? 'text-accent-green/70' : 'text-red-400/70'}">${totalGain >= 0 ? '+' : ''}${formatCurrency(totalGain)}</td>
                <td class="px-1 py-0.5 text-center font-semibold text-accent-cyan border-r-2 border-dark-300/40 text-[11px] ${bt} proj-tip-wrap">${formatCurrency(s.cashApresImpot)}<div class="text-[8px] text-gray-500 leading-tight">${formatCurrency(s.totalApports)}</div><div class="proj-tip"><div class="flex justify-between gap-3"><span class="text-gray-400">Placements</span><span class="text-gray-200">${formatCurrency(s.placements)}</span></div><div class="flex justify-between gap-3"><span class="text-gray-400">Apports</span><span class="text-gray-200">${formatCurrency(s.totalApports)}</span></div><div class="flex justify-between gap-3"><span class="text-gray-400">Impôts</span><span class="text-red-400">-${formatCurrency(s.totalTaxes)}</span></div><div class="border-t border-dark-400/40 mt-1 pt-1 flex justify-between gap-3"><span class="text-gray-300 font-medium">Net</span><span class="text-accent-cyan font-semibold">${formatCurrency(s.cashApresImpot)}</span></div></div></td>
                <td class="px-0 py-0 text-center text-[11px] ${bt}"><input type="number" class="surplus-input w-full bg-transparent text-center text-[11px] text-gray-200 border-0 outline-none focus:bg-dark-600/50 focus:text-accent-cyan px-0 py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" data-year="${s.calendarYear}" value="${surplusByYear[s.calendarYear] || ''}" placeholder="-" step="100" min="0"></td>
                <td class="px-1 py-1 text-center text-[11px] text-gray-200 ${bt}">${formatCurrency(s.epargne)}</td>
                <td class="px-1 py-1 text-center text-[11px] text-gray-200 ${bt}">${formatCurrency(s.heritage)}</td>
                <td class="px-1 py-1 text-center text-[11px] text-gray-200 border-r-2 border-dark-300/40 ${bt}">${formatCurrency(s.immobilier)}</td>
                <td class="px-1 py-1 text-center font-semibold text-accent-green text-[11px] ${bt}">${formatCurrency(s.totalLiquiditesNettes)}</td>
                <td class="px-1 py-1 text-center text-[11px] text-pink-300/70 ${bt}">${s.donation > 0 ? formatCurrency(s.donation) : '<span class="text-gray-700">-</span>'}</td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Stratégie d'investissement — éditable -->
      ${(() => {
        // Compute real data for strategy defaults
        const state = store.getAll();
        const allPlac = state.actifs?.placements || [];
        const revenus = (state.revenus || []).reduce((s, i) => s + (Number(i.montantMensuel) || 0), 0);
        const depenses = (state.depenses || []).reduce((s, i) => s + (Number(i.montantMensuel) || 0), 0);
        const mensualitesEmprunt = (state.passifs?.emprunts || []).reduce((s, e) => s + (Number(e.mensualite) || 0), 0);
        const capaciteEpargne = revenus - depenses - mensualitesEmprunt;

        // Group DCA by group key
        const dcaByGroup = {};
        allPlac.forEach(p => {
          const gk = getPlacementGroupKey(p);
          const base = Number(p.dcaMensuel) || 0;
          const maxOverride = (p.dcaOverrides || []).reduce((m, ov) => Math.max(m, Number(ov.dcaMensuel) || 0), 0);
          const dca = Math.max(base, maxOverride);
          if (dca > 0) dcaByGroup[gk] = (dcaByGroup[gk] || 0) + dca;
        });

        // PEA total apports
        const peaApports = allPlac
          .filter(p => (p.enveloppe || p.type || '').startsWith('PEA'))
          .reduce((s, p) => s + ((Number(p.valeur) || 0) || (Number(p.apport) || 0)), 0);

        // Heritage total
        const hTotal = heritageItems.reduce((s, h) => s + (Number(h.montant) || 0), 0);
        const hYears = heritageItems.map(h => h.dateInjection ? new Date(h.dateInjection).getFullYear() : '?');

        // Enveloppes text
        const enveloppes = allPlac.length > 0 ? (() => {
          const envSet = new Set();
          allPlac.forEach(p => envSet.add(p.enveloppe || p.type || 'Autre'));
          const lines = [];
          if (envSet.has('PEA')) lines.push(`PEA : plafond 150 000 € (versé ${formatCurrency(peaApports)}) — gains exonérés d'IR après 5 ans`);
          if (envSet.has('AV') || allPlac.some(p => (p.enveloppe || p.type || '').includes('AV'))) lines.push('Assurance Vie : pas de plafond, fiscalité avantageuse après 8 ans');
          if (envSet.has('CTO') || allPlac.some(p => getPlacementGroupKey(p).startsWith('CTO'))) lines.push('CTO : pas de plafond, flat tax 31,4% sur les plus-values');
          if (envSet.has('PEE')) lines.push('PEE : abondement employeur, bloqué 5 ans');
          if (envSet.has('PER')) lines.push('PER : déductible du revenu imposable, bloqué jusqu\'à la retraite');
          if (envSet.has('Crypto') || allPlac.some(p => getPlacementGroupKey(p) === 'Crypto')) lines.push('Crypto : flat tax 31,4% sur les plus-values réalisées');
          return lines.join('\n');
        })() : 'Aucun placement configuré';

        // DCA text
        const dcaLines = ['Objectif : remplir le PEA en priorité (avantage fiscal)'];
        Object.entries(dcaByGroup).sort((a, b) => b[1] - a[1]).forEach(([gk, dca]) => {
          dcaLines.push(`DCA mensuel ${gk} : ${formatCurrency(dca)}/mois`);
        });
        const totalDCA = Object.values(dcaByGroup).reduce((s, v) => s + v, 0);
        if (totalDCA > 0) dcaLines.push(`Total DCA : ${formatCurrency(totalDCA)}/mois`);
        dcaLines.push('Quand le PEA est plein → basculer le DCA vers le CTO');
        const repartition = dcaLines.join('\n');

        // Moyens
        const moyensLines = [];
        moyensLines.push(`Capacité d'épargne mensuelle : ${formatCurrency(capaciteEpargne)}`);
        moyensLines.push(`Revenus : ${formatCurrency(revenus)}/mois — Dépenses : ${formatCurrency(depenses)}/mois`);
        if (mensualitesEmprunt > 0) moyensLines.push(`Crédits : ${formatCurrency(mensualitesEmprunt)}/mois`);
        if (hTotal > 0) moyensLines.push(`Héritage prévu : ${formatCurrency(hTotal)} (${hYears.join(', ')})`);
        const moyens = moyensLines.join('\n');

        // Objectifs
        const ageRetraiteSouhaitee = params.ageRetraiteSouhaitee || 60;
        const cashOutLabel = params.cashOutYear ? `Cash out en ${params.cashOutYear}` : 'Non défini';
        const objectifsLines = [
          `Retraite souhaitée à ${ageRetraiteSouhaitee} ans`,
          `Patrimoine actuel : ${formatCurrency(first?.patrimoineNet || 0)}`,
          `Patrimoine projeté (fin) : ${formatCurrency(last?.patrimoineNet || 0)}`,
          `Pension légale : ${formatCurrency(params.pensionTauxLegal || 2442)}/mois — Taux plein : ${formatCurrency(params.pensionTauxPlein || 2642)}/mois`,
          `Stratégie de sortie : ${cashOutLabel}`
        ];
        const objectifs = objectifsLines.join('\n');

        return `
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-5 py-3 cursor-pointer select-none">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-semibold text-gray-200">Ma stratégie d'investissement</h2>
            <span class="text-[10px] text-gray-600 italic">Cliquer pour modifier</span>
          </div>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-5 space-y-4">
          <div class="flex justify-end mb-2">
            <button id="strat-refresh" class="text-[10px] text-gray-600 hover:text-accent-blue transition flex items-center gap-1" title="Régénérer depuis les données actuelles">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Actualiser depuis mes données
            </button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 class="text-sm font-semibold text-accent-amber mb-2">Enveloppes & plafonds</h3>
              <div id="strat-enveloppes" contenteditable="true" class="editable-block min-h-[120px] p-3 rounded-lg row-item text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"
                data-default="${enveloppes.replace(/"/g, '&quot;').replace(/</g, '&lt;')}">${(params.strategie?.enveloppes || enveloppes).replace(/</g, '&lt;')}</div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-accent-cyan mb-2">Répartition cible & DCA</h3>
              <div id="strat-repartition" contenteditable="true" class="editable-block min-h-[120px] p-3 rounded-lg row-item text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"
                data-default="${repartition.replace(/"/g, '&quot;').replace(/</g, '&lt;')}">${(params.strategie?.repartition || repartition).replace(/</g, '&lt;')}</div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-accent-green mb-2">Moyens supplémentaires</h3>
              <div id="strat-moyens" contenteditable="true" class="editable-block min-h-[120px] p-3 rounded-lg row-item text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"
                data-default="${moyens.replace(/"/g, '&quot;').replace(/</g, '&lt;')}">${(params.strategie?.moyens || moyens).replace(/</g, '&lt;')}</div>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-purple-400 mb-2">Objectifs & horizon</h3>
              <div id="strat-objectifs" contenteditable="true" class="editable-block min-h-[120px] p-3 rounded-lg row-item text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"
                data-default="${objectifs.replace(/"/g, '&quot;').replace(/</g, '&lt;')}">${(params.strategie?.objectifs || objectifs).replace(/</g, '&lt;')}</div>
            </div>
          </div>
        </div>
      </details>`;
      })()}

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
              <p class="mt-1 text-xs text-gray-500">Avant 5 ans, c'est la flat tax complète (31,4%). Après 5 ans, exonération d'impôt sur le revenu → seulement 17.2% de cotisations sociales.</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-blue-400 font-semibold mb-1">Flat Tax CTO / Crypto (31,4%)</h3>
              <p>Sur les plus-values : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">gains × 31,4%</code></p>
              <p class="mt-1 text-xs text-gray-500">Le PFU (Prélèvement Forfaitaire Unique) = 14.2% d'IR + 17.2% de prélèvements sociaux. Appliqué uniquement sur les gains, pas sur le capital investi.</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-teal-400 font-semibold mb-1">Assurance Vie</h3>
              <p>Avant 8 ans : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">gains × 31,4% (PFU)</code></p>
              <p>Après 8 ans : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">gains × 24.7% (17.2% PS + 7.5% IR)</code></p>
              <p class="mt-1 text-xs text-gray-500">Après 8 ans, abattement de 4 600 € (célibataire) ou 9 200 € (couple) sur les gains avant le calcul du 7.5%. Non modélisé ici pour simplifier.</p>
            </div>

            <div class="p-3 rounded-lg bg-dark-800/30 border border-dark-400/15">
              <h3 class="text-emerald-400 font-semibold mb-1">PEE</h3>
              <p>Prélèvements sociaux uniquement : <code class="text-gray-300 bg-dark-900/60 px-1 rounded">gains × 17.2%</code></p>
              <p class="mt-1 text-xs text-gray-500">Le PEE est exonéré d'impôt sur le revenu après 5 ans de blocage. Seuls les prélèvements sociaux (17.2%) s'appliquent sur les gains.</p>
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
              <h3 class="text-gray-300 font-semibold mb-1">Net d'impôts (toutes enveloppes)</h3>
              <p><code class="text-gray-300 bg-dark-900/60 px-1 rounded">Σ valeur placements − Σ impôts sur gains (par enveloppe)</code></p>
              <p class="mt-1 text-xs text-gray-500">C'est ce que vous toucheriez si vous vendiez tout aujourd'hui. Chaque enveloppe est taxée selon sa fiscalité propre : PEA (17.2% ou 31.4%), AV (24.7% ou 31.4%), CTO/Crypto (31.4%), PEE (17.2%).</p>
            </div>
          </div>

        </div>
      </details>
    </div>
  `;
}

function openActualisationModal(store, navigate, calendarYear, snapshots) {
  const placements = store.get('actifs.placements') || [];
  const params = store.get('parametres') || {};
  const actualisations = params.actualisations || {};
  const existing = actualisations[String(calendarYear)] || {};
  const existingPlac = existing.placements || {};

  // Find the snapshot for this year to show projected values
  const snapshot = snapshots.find(s => s.calendarYear === calendarYear);
  if (!snapshot) return;

  const placementRows = placements.map(p => {
    const projValue = snapshot.placementById?.[p.id] || 0;
    const realValue = existingPlac[p.id] !== undefined ? existingPlac[p.id] : '';
    const env = p.enveloppe || '';
    const cat = p.categorie || '';
    const label = p.nom || `${env} ${cat}`.trim();
    return `
      <div class="flex items-center gap-2 py-2 border-b border-dark-400/20">
        <div class="flex-1 min-w-0">
          <div class="text-sm text-gray-200 truncate">${label}</div>
          <div class="text-[10px] text-gray-500">${getPlacementGroupKey(p)} · Projeté : ${formatCurrency(projValue)}</div>
        </div>
        <input type="number" name="plac-${p.id}" value="${realValue}"
          placeholder="${formatCurrency(projValue).replace(/[^\d\s]/g, '').trim()}"
          class="input-field w-28 placeholder-gray-700"
          step="1">
      </div>
    `;
  }).join('');

  const body = `
    <p class="text-xs text-gray-500 mb-4">Saisissez les valeurs réelles de fin ${calendarYear} pour chaque placement. Les champs vides conservent la valeur projetée.</p>

    <div class="mb-4">
      <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Placements</h4>
      <div class="max-h-[40vh] overflow-y-auto pr-1">
        ${placementRows}
      </div>
    </div>

    <div class="border-t border-dark-400/30 pt-4 space-y-3">
      <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Autres actifs</h4>
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-300 flex-1">Épargne</label>
        <input type="number" name="actu-epargne" value="${existing.epargne !== undefined ? existing.epargne : ''}"
          placeholder="${formatCurrency(snapshot.epargne).replace(/[^\d\s]/g, '').trim()}"
          class="input-field w-28 placeholder-gray-700"
          step="1">
      </div>
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-300 flex-1">Immobilier</label>
        <input type="number" name="actu-immobilier" value="${existing.immobilier !== undefined ? existing.immobilier : ''}"
          placeholder="${formatCurrency(snapshot.immobilier).replace(/[^\d\s]/g, '').trim()}"
          class="input-field w-28 placeholder-gray-700"
          step="1">
      </div>
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-300 flex-1">Surplus</label>
        <input type="number" name="actu-surplus" value="${existing.surplus !== undefined ? existing.surplus : ''}"
          placeholder="${formatCurrency(snapshot.surplus || 0).replace(/[^\d\s]/g, '').trim()}"
          class="input-field w-28 placeholder-gray-700"
          step="1">
      </div>
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-300 flex-1">Donation</label>
        <input type="number" name="actu-donation" value="${existing.donation !== undefined ? existing.donation : ''}"
          placeholder="${formatCurrency(snapshot.donation || 0).replace(/[^\d\s]/g, '').trim()}"
          class="input-field w-28 placeholder-gray-700"
          step="1">
      </div>
    </div>

    ${Object.keys(existingPlac).length > 0 || existing.epargne !== undefined || existing.immobilier !== undefined || existing.surplus !== undefined || existing.donation !== undefined
      ? '<div class="mt-4 pt-3 border-t border-dark-400/30"><button id="actu-clear" class="text-xs text-red-400 hover:text-red-300 transition">Supprimer cette actualisation</button></div>'
      : ''}
  `;

  const modal = openModal(`Actualiser fin ${calendarYear}`, body, () => {
    const modalBody = document.getElementById('modal-body');
    const actu = { placements: {} };
    let hasAny = false;

    // Collect placement values
    placements.forEach(p => {
      const input = modalBody.querySelector(`[name="plac-${p.id}"]`);
      if (input && input.value !== '') {
        actu.placements[p.id] = Number(input.value);
        hasAny = true;
      }
    });

    // Collect épargne/immobilier
    const eparInput = modalBody.querySelector('[name="actu-epargne"]');
    if (eparInput && eparInput.value !== '') {
      actu.epargne = Number(eparInput.value);
      hasAny = true;
    }
    const immoInput = modalBody.querySelector('[name="actu-immobilier"]');
    if (immoInput && immoInput.value !== '') {
      actu.immobilier = Number(immoInput.value);
      hasAny = true;
    }
    const surplusInput = modalBody.querySelector('[name="actu-surplus"]');
    if (surplusInput && surplusInput.value !== '') {
      actu.surplus = Number(surplusInput.value);
      hasAny = true;
    }
    const donationInput = modalBody.querySelector('[name="actu-donation"]');
    if (donationInput && donationInput.value !== '') {
      actu.donation = Number(donationInput.value);
      hasAny = true;
    }

    // Save
    const allActu = { ...actualisations };
    if (hasAny) {
      if (Object.keys(actu.placements).length === 0) delete actu.placements;
      allActu[String(calendarYear)] = actu;
    } else {
      delete allActu[String(calendarYear)];
    }
    store.set('parametres.actualisations', allActu);
    navigate('projection');
  });

  // Clear button
  modal.querySelector('#actu-clear')?.addEventListener('click', () => {
    const allActu = { ...actualisations };
    delete allActu[String(calendarYear)];
    store.set('parametres.actualisations', allActu);
    modal.remove();
    navigate('projection');
  });
}

function openTransferModal(store, navigate, editItem = null) {
  const placements = store.get('actifs.placements') || [];
  const heritageItems = store.get('heritage') || [];
  const currentYear = new Date().getFullYear();

  // Build dynamic source options from all placements + épargne + héritage
  // Include CTO overflow (virtual placement for PEA ceiling overflow)
  const sourceOptions = [
    { value: '__cat_pea__', label: 'PEA' },
    { value: '__cat_cto__', label: 'CTO (tous)' },
    { value: '__cat_cto_tr__', label: 'CTO TR' },
    { value: '__cat_cto_bb__', label: 'CTO BB' },
    { value: '__cat_bitcoin__', label: 'Bitcoin' },
    { value: '__cat_av__', label: 'Assurance Vie' },
    { value: '__cat_pee__', label: 'PEE' },
    { value: 'epargne', label: 'Epargne' },
    { value: 'surplus', label: 'Surplus' },
    { value: 'heritage', label: 'Héritage' },
    { value: '__donation__', label: 'Donation' }
  ];

  const destOptions = [
    { value: '__cat_pea__', label: 'PEA' },
    { value: '__cat_cto__', label: 'CTO (tous)' },
    { value: '__cat_cto_tr__', label: 'CTO TR' },
    { value: '__cat_cto_bb__', label: 'CTO BB' },
    { value: '__cat_bitcoin__', label: 'Bitcoin' },
    { value: '__cat_av__', label: 'Assurance Vie' },
    { value: '__cat_epargne__', label: 'Epargne' },
    { value: 'surplus', label: 'Surplus' },
    { value: '__donation__', label: 'Donation' }
  ];

  const title = editItem ? 'Modifier le transfert' : 'Planifier un transfert de capital';
  const body = `
    ${selectField('source', 'Source du capital', sourceOptions, editItem?.source || 'epargne')}
    ${selectField('destinationId', 'Destination (placement)', destOptions, editItem?.destinationId || '')}
    ${inputField('montant', 'Montant (€)', editItem?.montant || '', 'number', 'min="0" step="100" placeholder="50000"')}
    ${selectField('frequency', 'Fréquence', [
      { value: 'once', label: 'Une seule fois' },
      { value: 'monthly', label: 'Mensuel' },
      { value: 'annual', label: 'Annuel' }
    ], editItem?.frequency || 'once')}
    ${inputField('startYear', 'Année de début', editItem?.startYear || currentYear + 1, 'number', `min="${currentYear}" max="${currentYear + 50}" step="1"`)}
    <div id="transfer-end-year-wrapper">
      ${inputField('endYear', 'Année de fin (si récurrent)', editItem?.endYear || '', 'number', `min="${currentYear}" max="${currentYear + 50}" step="1" placeholder="Optionnel"`)}
    </div>
    <div class="p-3 bg-dark-800/50 rounded-lg text-xs text-gray-500 space-y-1 mt-2">
      <p><strong class="text-gray-400">Comment ça marche :</strong></p>
      <p>Le montant est prélevé de la source et injecté dans le placement choisi.</p>
      <p>Mensuel : le montant est transféré chaque mois. Annuel : une fois par an. Les deux respectent la période début/fin.</p>
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
    const toggle = () => endWrapper.style.display = (freqSelect.value === 'annual' || freqSelect.value === 'monthly') ? '' : 'none';
    toggle();
    freqSelect.addEventListener('change', toggle);
  }
}

export function mount(store, navigate) {
  // ── Unified tab clicks
  document.querySelectorAll('.proj-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      store.set('_projTab', btn.dataset.projTab);
      const el = document.getElementById('app-content');
      if (el) { el.innerHTML = render(store); mount(store, navigate); }
    });
  });

  const activeTab = store.get('_projTab') || 'moi';

  // If child tab, delegate mount to projection-enfants
  if (activeTab.startsWith('child-')) {
    ProjectionEnfants.mount(store, navigate, { embedded: true });
    return;
  }

  // ── "Moi" tab: original projection mount
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

    // Stacked area chart (second slide)
    if (document.getElementById('chart-repartition-stacked')) {
      const canvasStacked = document.getElementById('chart-repartition-stacked');
      const ctxStacked = canvasStacked.getContext('2d');

      let sColorIdx = 0;
      const sNextColor = () => VIVID_PALETTE[sColorIdx++ % VIVID_PALETTE.length];
      const stackedDatasets = [];

      // Immobilier
      const sImmColor = sNextColor();
      stackedDatasets.push({
        label: 'Immobilier',
        data: snapshots.map(s => s.immobilier),
        borderColor: sImmColor,
        backgroundColor: sImmColor + '99',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 1.5
      });

      // Each placement group
      groupKeys.forEach((k) => {
        const color = sNextColor();
        stackedDatasets.push({
          label: k,
          data: snapshots.map(s => s.placementDetail[k] || 0),
          borderColor: color,
          backgroundColor: color + '99',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 1.5
        });
      });

      // Épargne
      const sEpColor = sNextColor();
      stackedDatasets.push({
        label: 'Épargne',
        data: snapshots.map(s => s.epargne),
        borderColor: sEpColor,
        backgroundColor: sEpColor + '99',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 1.5
      });

      // Héritage
      const sHeritageItems = store.get('heritage') || [];
      if (sHeritageItems.length > 0) {
        const sHerColor = sNextColor();
        stackedDatasets.push({
          label: 'Héritage',
          data: snapshots.map(s => s.heritage),
          borderColor: sHerColor,
          backgroundColor: sHerColor + '99',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 1.5
        });
      }

      createChart('chart-repartition-stacked', {
        type: 'line',
        data: { labels, datasets: stackedDatasets },
        options: {
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            annotation: { annotations: milestoneAnnotations },
            tooltip: {
              callbacks: {
                footer: (items) => {
                  const total = items.reduce((s, i) => s + (i.parsed.y || 0), 0);
                  return 'Total : ' + new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(total);
                }
              }
            }
          },
          scales: {
            x: {
              stacked: true,
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

    // Chart slide navigation
    let currentSlide = 0;
    const slides = [document.getElementById('chart-slide-0'), document.getElementById('chart-slide-1')];
    const dots = [document.getElementById('chart-dot-0'), document.getElementById('chart-dot-1')];
    const prevBtn = document.getElementById('chart-prev');
    const nextBtn = document.getElementById('chart-next');

    function showSlide(idx) {
      slides.forEach((s, i) => { if (s) s.classList.toggle('hidden', i !== idx); });
      dots.forEach((d, i) => { if (d) { d.classList.toggle('bg-accent-amber', i === idx); d.classList.toggle('bg-dark-400', i !== idx); }});
      if (prevBtn) prevBtn.classList.toggle('hidden', idx === 0);
      if (nextBtn) nextBtn.classList.toggle('hidden', idx === slides.length - 1);
      currentSlide = idx;
    }

    prevBtn?.addEventListener('click', () => { if (currentSlide > 0) showSlide(currentSlide - 1); });
    nextBtn?.addEventListener('click', () => { if (currentSlide < slides.length - 1) showSlide(currentSlide + 1); });
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

    // Salaire
    store.set('parametres.salaireNet', parseInt(document.getElementById('param-salaire').value) || 1650);

    // Retirement milestones
    store.set('parametres.ageRetraiteTauxLegal', parseInt(document.getElementById('param-retraite-legal-age').value) || 64);
    store.set('parametres.pensionTauxLegal', parseInt(document.getElementById('param-pension-legal').value) || 2442);
    store.set('parametres.ageRetraiteTauxPlein', parseInt(document.getElementById('param-retraite-plein-age').value) || 65);
    store.set('parametres.pensionTauxPlein', parseInt(document.getElementById('param-pension-plein').value) || 2642);
    store.set('parametres.ageRetraiteSouhaitee', parseInt(document.getElementById('param-retraite-souhaitee').value) || 60);

    const cashOutVal = document.getElementById('param-cashout-year')?.value;
    store.set('parametres.cashOutYear', cashOutVal ? parseInt(cashOutVal) : null);

    navigate('projection');
  });

  // --- Placement CRUD from projection ---
  // Global add button
  document.getElementById('proj-add-plac-global')?.addEventListener('click', () => {
    openAddPlacementModal(store, navigate, 'projection', null);
  });

  // --- Actualisation rapide DCA ---
  document.getElementById('btn-actu-rapide')?.addEventListener('click', () => {
    const placements = store.get('actifs.placements') || [];
    const dcaItems = placements.filter(p => {
      const base = Number(p.dcaMensuel) || 0;
      const maxOverride = (p.dcaOverrides || []).reduce((m, ov) => Math.max(m, Number(ov.dcaMensuel) || 0), 0);
      return Math.max(base, maxOverride) > 0;
    });
    if (dcaItems.length === 0) {
      alert('Aucun placement avec DCA actif. Éditez un placement et renseignez un montant DCA mensuel.');
      return;
    }

    const now = new Date();
    const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const rows = dcaItems.map(p => {
      const currentVal = Number(p.valeur) || Number(p.apport) || 0;
      const baseDca = Number(p.dcaMensuel) || 0;
      const maxOverrideDca = (p.dcaOverrides || []).reduce((m, ov) => Math.max(m, Number(ov.dcaMensuel) || 0), 0);
      const dca = Math.max(baseDca, maxOverrideDca);
      const estimated = currentVal + dca;
      const gk = getPlacementGroupKey(p);
      return `
        <div class="flex items-center gap-3 py-2.5 border-b border-dark-400/30 last:border-0" data-actu-id="${p.id}">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-medium text-gray-200">${p.nom}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-dark-600 text-gray-400">${gk}</span>
            </div>
            <div class="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
              <span>DCA ${formatCurrency(dca)}/m</span>
              <span>·</span>
              <span>Estimé ${formatCurrency(estimated)}</span>
            </div>
          </div>
          <div class="w-32">
            <input type="number" class="actu-val input-field w-full" value="${estimated}" step="0.01">
          </div>
        </div>`;
    }).join('');

    const body = `
      <p class="text-xs text-gray-400 mb-3">Mettez à jour la valeur réelle de vos placements DCA après exécution chez votre courtier.</p>
      <div class="bg-dark-800/30 rounded-lg px-3 py-1">
        ${rows}
      </div>
    `;

    openModal(`Actualisation — ${moisLabel}`, body, () => {
      const modalBody = document.getElementById('modal-body');
      modalBody.querySelectorAll('[data-actu-id]').forEach(row => {
        const id = row.dataset.actuId;
        const val = parseFloat(row.querySelector('.actu-val').value);
        if (!isNaN(val)) {
          store.updateItem('actifs.placements', id, { valeur: val });
        }
      });
      navigate('projection');
    });
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

  // Actualisation buttons (enter real values for past years)
  document.querySelectorAll('.btn-actualiser').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const year = parseInt(btn.dataset.year);
      openActualisationModal(store, navigate, year, snapshots);
    });
  });

  // Refresh strategy blocks from data
  document.getElementById('strat-refresh')?.addEventListener('click', () => {
    ['strat-enveloppes', 'strat-repartition', 'strat-moyens', 'strat-objectifs'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.dataset.default) {
        el.textContent = el.dataset.default;
      }
    });
    // Clear saved strategy so defaults regenerate
    store.set('parametres.strategie', {});
  });

  // --- Surplus annuel inline editing ---
  document.querySelectorAll('.surplus-input').forEach(input => {
    input.addEventListener('change', () => {
      const year = parseInt(input.dataset.year);
      const montant = Number(input.value) || 0;
      const surplus = store.get('surplusAnnuel') || [];
      const existing = surplus.find(s => Number(s.year) === year);
      if (montant > 0) {
        if (existing) {
          existing.montant = montant;
        } else {
          surplus.push({ year, montant });
        }
      } else {
        const idx = surplus.findIndex(s => Number(s.year) === year);
        if (idx >= 0) surplus.splice(idx, 1);
      }
      store.set('surplusAnnuel', surplus);
      navigate('projection');
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

  // --- PEA Overflow Targets ---
  function saveOverflowTargets() {
    const rows = document.querySelectorAll('.overflow-target-row');
    const targets = [];
    rows.forEach(row => {
      const select = row.querySelector('.overflow-target-select');
      const pctInput = row.querySelector('.overflow-target-pct');
      if (select && pctInput) {
        targets.push({
          category: select.value,
          pct: Math.max(1, Math.min(100, parseInt(pctInput.value) || 100))
        });
      }
    });
    store.set('parametres.peaOverflowTargets', targets);
    navigate('projection');
  }

  document.querySelectorAll('.overflow-target-select, .overflow-target-pct').forEach(el => {
    el.addEventListener('change', saveOverflowTargets);
  });

  document.querySelectorAll('.overflow-target-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const targets = (store.get('parametres')?.peaOverflowTargets || []);
      const idx = parseInt(btn.dataset.idx);
      targets.splice(idx, 1);
      store.set('parametres.peaOverflowTargets', targets);
      navigate('projection');
    });
  });

  document.getElementById('btn-add-overflow-target')?.addEventListener('click', () => {
    const targets = store.get('parametres')?.peaOverflowTargets || [];
    const categories = ['cto', 'av', 'bitcoin', 'epargne'];
    // Find first category not already targeted
    const usedCats = new Set(targets.map(t => t.category));
    const available = categories.find(c => !usedCats.has(c));
    const remainingPct = Math.max(1, 100 - targets.reduce((s, t) => s + (t.pct || 0), 0));

    targets.push({
      category: available || 'cto',
      pct: remainingPct
    });
    store.set('parametres.peaOverflowTargets', targets);
    navigate('projection');
  });

  // --- AV Overflow Targets ---
  function saveAVOverflowTargets() {
    const rows = document.querySelectorAll('.av-overflow-target-row');
    const targets = [];
    rows.forEach(row => {
      const select = row.querySelector('.av-overflow-target-select');
      const pctInput = row.querySelector('.av-overflow-target-pct');
      if (select && pctInput) {
        targets.push({
          category: select.value,
          pct: Math.max(1, Math.min(100, parseInt(pctInput.value) || 100))
        });
      }
    });
    store.set('parametres.avOverflowTargets', targets);
    navigate('projection');
  }

  document.querySelectorAll('.av-overflow-target-select, .av-overflow-target-pct').forEach(el => {
    el.addEventListener('change', saveAVOverflowTargets);
  });

  document.querySelectorAll('.av-overflow-target-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const targets = (store.get('parametres')?.avOverflowTargets || []);
      const idx = parseInt(btn.dataset.idx);
      targets.splice(idx, 1);
      store.set('parametres.avOverflowTargets', targets);
      navigate('projection');
    });
  });

  document.getElementById('btn-add-av-overflow-target')?.addEventListener('click', () => {
    const targets = store.get('parametres')?.avOverflowTargets || [];
    const categories = ['cto', 'bitcoin', 'epargne'];
    const usedCats = new Set(targets.map(t => t.category));
    const available = categories.find(c => !usedCats.has(c));
    const remainingPct = Math.max(1, 100 - targets.reduce((s, t) => s + (t.pct || 0), 0));

    targets.push({
      category: available || 'cto',
      pct: remainingPct
    });
    store.set('parametres.avOverflowTargets', targets);
    navigate('projection');
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
