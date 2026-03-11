import { formatCurrencyCents, openModal, getFormData, inputField, selectField } from '../utils.js?v=5';
import { createChart, COLORS } from '../charts/chart-config.js';

const DEPENSE_TYPES = [
  { key: 'Fixe', label: 'Dépenses fixes', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { key: 'Variable', label: 'Dépenses variables', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z' },
  { key: 'Abonnement', label: 'Abonnements', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { key: 'Investissement', label: 'Investissements', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
];

const FREQ_OPTIONS = [
  { value: 'Mensuel', label: 'Mensuel' },
  { value: 'Annuel', label: 'Annuel' },
];

function getMensuelLisse(item) {
  const montant = Number(item.montantMensuel) || 0;
  return item.frequence === 'Annuel' ? montant / 12 : montant;
}

function getDepensesByType(depenses, typeKey) {
  return depenses.filter(d => (d.typeDepense || 'Fixe') === typeKey);
}

function sumLisse(items) {
  return items.reduce((s, d) => s + getMensuelLisse(d), 0);
}

function formatFreqLabel(item) {
  const montant = Number(item.montantMensuel) || 0;
  if (item.frequence === 'Annuel') {
    return `${formatCurrencyCents(montant)}/an`;
  }
  return `${formatCurrencyCents(montant)}/mois`;
}

function formatLisseLabel(item) {
  if (item.frequence === 'Annuel') {
    return `≈ ${formatCurrencyCents(getMensuelLisse(item))}/mois`;
  }
  return '';
}

function montantFields(mensuel, lisse, annuel) {
  const cls = 'w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition';
  return `
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Mensuel (€)</label>
        <input type="number" id="field-valMensuel" value="${mensuel}" step="any" class="${cls}">
      </div>
      <div>
        <label class="block text-sm font-medium text-accent-amber/80 mb-1.5">Lissé (€)</label>
        <input type="number" id="field-valLisse" value="${lisse}" step="any" class="${cls}">
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Annuel (€)</label>
        <input type="number" id="field-valAnnuel" value="${annuel}" step="any" class="${cls}">
      </div>
    </div>
  `;
}

function setupMontantSync() {
  const freqEl = document.getElementById('field-frequence');
  const mEl = document.getElementById('field-valMensuel');
  const lEl = document.getElementById('field-valLisse');
  const aEl = document.getElementById('field-valAnnuel');
  if (!mEl || !lEl || !aEl) return;

  const round2 = v => Math.round(v * 100) / 100;

  mEl.addEventListener('input', () => {
    const v = parseFloat(mEl.value) || 0;
    if (freqEl) freqEl.value = 'Mensuel';
    lEl.value = v || '';
    aEl.value = v ? round2(v * 12) : '';
  });

  aEl.addEventListener('input', () => {
    const v = parseFloat(aEl.value) || 0;
    if (freqEl) freqEl.value = 'Annuel';
    mEl.value = 0;
    lEl.value = v ? round2(v / 12) : '';
  });

  lEl.addEventListener('input', () => {
    const v = parseFloat(lEl.value) || 0;
    const freq = freqEl?.value || 'Mensuel';
    aEl.value = v ? round2(v * 12) : '';
    if (freq === 'Mensuel') {
      mEl.value = v || '';
    }
  });

  if (freqEl) {
    freqEl.addEventListener('change', () => {
      const l = parseFloat(lEl.value) || 0;
      if (freqEl.value === 'Mensuel') {
        mEl.value = l || '';
        aEl.value = l ? round2(l * 12) : '';
      } else {
        mEl.value = 0;
        aEl.value = l ? round2(l * 12) : '';
      }
    });
  }
}

function getMontantFromModal() {
  const freq = document.getElementById('field-frequence')?.value || 'Mensuel';
  const mensuel = parseFloat(document.getElementById('field-valMensuel')?.value) || 0;
  const annuel = parseFloat(document.getElementById('field-valAnnuel')?.value) || 0;
  return freq === 'Annuel' ? annuel : mensuel;
}

export function render(store) {
  const revenus = store.get('revenus');
  const depenses = store.get('depenses');
  const totalR = store.totalRevenus();
  const totalD = store.totalDepenses();
  const balance = totalR - totalD;

  // Compute direct monthly totals (only items marked mensuel)
  const revMensuelDirect = revenus.filter(r => r.frequence !== 'Annuel').reduce((s, r) => s + (Number(r.montantMensuel) || 0), 0);
  const depMensuelDirect = depenses.filter(d => d.frequence !== 'Annuel').reduce((s, d) => s + (Number(d.montantMensuel) || 0), 0);

  // Check if there are any annual items
  const hasAnnualItems = revenus.some(r => r.frequence === 'Annuel') || depenses.some(d => d.frequence === 'Annuel');

  const depenseGroups = DEPENSE_TYPES.map(t => {
    const items = getDepensesByType(depenses, t.key);
    return { ...t, items, total: sumLisse(items) };
  });

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-100">Revenus & Dépenses</h1>

      <!-- KPI -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Revenus mensuels</p>
          </div>
          <p class="text-2xl font-bold text-accent-green">${formatCurrencyCents(revMensuelDirect)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Revenus mensuels lissés</p>
          </div>
          <p class="text-2xl font-bold text-accent-green">${formatCurrencyCents(totalR)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Revenus annuels</p>
          </div>
          <p class="text-2xl font-bold text-accent-green">${formatCurrencyCents(totalR * 12)}</p>
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
          <p class="text-2xl font-bold text-accent-red">${formatCurrencyCents(depMensuelDirect)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-red">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-red/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Dépenses mensuelles lissées</p>
          </div>
          <p class="text-2xl font-bold text-accent-red">${formatCurrencyCents(totalD)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-red">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-red/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Dépenses annuelles</p>
          </div>
          <p class="text-2xl font-bold text-accent-red">${formatCurrencyCents(totalD * 12)}</p>
        </div>
      </div>

      <!-- Revenus & Dépenses — blocs empilés, pliables -->
      <div class="flex items-center justify-end mb-2 gap-2">
        <button id="btn-seed-revenus" class="px-3 py-1.5 text-gray-500 hover:text-accent-amber text-xs rounded-lg hover:bg-dark-500 transition">Défaut revenus</button>
        <button id="btn-seed-depenses" class="px-3 py-1.5 text-gray-500 hover:text-accent-amber text-xs rounded-lg hover:bg-dark-500 transition">Défaut dépenses</button>
      </div>
      <div class="space-y-3">
        <!-- Revenus -->
        <details open class="card-dark rounded-xl overflow-hidden group">
          <summary class="flex items-center justify-between px-4 py-3 cursor-pointer select-none">
            <div class="flex items-center gap-3">
              <div class="w-7 h-7 rounded-lg bg-accent-green/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </div>
              <h2 class="text-sm font-semibold text-gray-200">Revenus</h2>
              <span class="text-xs text-gray-400">${formatCurrencyCents(revenus.reduce((s, r) => s + getMensuelLisse(r), 0))}/mois</span>
            </div>
            <div class="flex items-center gap-3">
              <button id="btn-add-revenu" class="px-3 py-1 bg-accent-green/20 text-accent-green text-xs rounded-lg hover:bg-accent-green/30 transition font-medium" onclick="event.stopPropagation()">+ Ajouter</button>
              <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </summary>
          ${revenus.length > 0 ? `
          <div class="grid grid-cols-[1fr_7rem_7rem_7rem_1.2rem] items-center px-4 py-1 border-b border-dark-400/30">
            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Source</span>
            <span class="text-[10px] text-gray-500 uppercase tracking-wider text-right">Mensuel</span>
            <span class="text-[10px] text-accent-amber/60 uppercase tracking-wider text-right">Mensuel lissé</span>
            <span class="text-[10px] text-gray-500 uppercase tracking-wider text-right">Annuel</span>
            <span></span>
          </div>
          <div class="divide-y divide-dark-400/20">
            ${revenus.map(r => {
              const montant = Number(r.montantMensuel) || 0;
              const mensuel = r.frequence === 'Annuel' ? 0 : montant;
              const lisse = getMensuelLisse(r);
              const annuel = lisse * 12;
              return `
            <div class="grid grid-cols-[1fr_7rem_7rem_7rem_1.2rem] items-center px-4 py-1.5 hover:bg-dark-600/30 transition group/row cursor-pointer" data-edit-rev="${r.id}">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex flex-col gap-0.5 opacity-0 group-hover/row:opacity-100 transition flex-shrink-0">
                  <button data-move-rev-up="${r.id}" class="text-gray-500 hover:text-gray-300 leading-none text-[10px]" onclick="event.stopPropagation()">▲</button>
                  <button data-move-rev-down="${r.id}" class="text-gray-500 hover:text-gray-300 leading-none text-[10px]" onclick="event.stopPropagation()">▼</button>
                </div>
                <p class="text-xs text-gray-200 truncate">${r.nom}</p>
                <p class="text-[10px] font-light text-gray-500 flex-shrink-0">${r.type || 'Autre'}${r.frequence === 'Annuel' ? ' · Annuel' : ''}</p>
              </div>
              <span class="text-xs text-right whitespace-nowrap ${mensuel > 0 ? 'text-gray-100 font-medium' : 'text-gray-600'}">${formatCurrencyCents(mensuel)}</span>
              <span class="text-xs text-right whitespace-nowrap ${r.frequence === 'Annuel' ? 'text-accent-amber font-medium' : 'text-gray-400'}">${formatCurrencyCents(lisse)}</span>
              <span class="text-xs text-right whitespace-nowrap ${r.frequence === 'Annuel' ? 'text-gray-100 font-medium' : 'text-gray-400'}">${formatCurrencyCents(annuel)}</span>
              <button data-del-rev="${r.id}" class="opacity-0 group-hover/row:opacity-100 text-accent-red/60 hover:text-accent-red text-[10px] font-medium transition text-right" onclick="event.stopPropagation()">✕</button>
            </div>`;
            }).join('')}
          </div>
          <div class="grid grid-cols-[1fr_7rem_7rem_7rem_1.2rem] items-center px-4 py-2 border-t border-dark-400/40 bg-dark-700/30">
            <span class="text-xs font-bold text-gray-300 uppercase">Totaux</span>
            <span class="text-xs font-bold text-gray-100 text-right">${formatCurrencyCents(revenus.reduce((s, r) => s + (r.frequence === 'Annuel' ? 0 : (Number(r.montantMensuel) || 0)), 0))}</span>
            <span class="text-xs font-bold text-accent-amber text-right">${formatCurrencyCents(revenus.reduce((s, r) => s + getMensuelLisse(r), 0))}</span>
            <span class="text-xs font-bold text-gray-100 text-right">${formatCurrencyCents(revenus.reduce((s, r) => s + getMensuelLisse(r), 0) * 12)}</span>
            <span></span>
          </div>
          ` : '<p class="px-4 py-3 text-gray-600 text-xs">Aucun revenu.</p>'}
        </details>

        <!-- 4 blocs dépenses -->
        ${depenseGroups.map(g => `
        <details open class="card-dark rounded-xl overflow-hidden group">
          <summary class="flex items-center justify-between px-4 py-3 cursor-pointer select-none">
            <div class="flex items-center gap-3">
              <div class="w-7 h-7 rounded-lg bg-accent-red/15 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-accent-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${g.icon}"/>
                </svg>
              </div>
              <h2 class="text-sm font-semibold text-gray-200">${g.label}</h2>
              ${g.total > 0 ? `<span class="text-xs text-gray-400">${formatCurrencyCents(g.total)}/mois</span>` : ''}
            </div>
            <div class="flex items-center gap-3">
              <button class="btn-add-depense px-3 py-1 bg-accent-red/20 text-accent-red text-xs rounded-lg hover:bg-accent-red/30 transition font-medium" data-type="${g.key}" onclick="event.stopPropagation()">+ Ajouter</button>
              <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </summary>
          ${g.items.length > 0 ? `
          <div class="grid grid-cols-[1fr_7rem_7rem_7rem_1.2rem] items-center px-4 py-1 border-b border-dark-400/30">
            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Poste</span>
            <span class="text-[10px] text-gray-500 uppercase tracking-wider text-right">Mensuel</span>
            <span class="text-[10px] text-accent-amber/60 uppercase tracking-wider text-right">Mensuel lissé</span>
            <span class="text-[10px] text-gray-500 uppercase tracking-wider text-right">Annuel</span>
            <span></span>
          </div>
          <div class="divide-y divide-dark-400/20">
            ${g.items.map(d => {
              const montant = Number(d.montantMensuel) || 0;
              const mensuel = d.frequence === 'Annuel' ? 0 : montant;
              const lisse = getMensuelLisse(d);
              const annuel = lisse * 12;
              return `
            <div class="grid grid-cols-[1fr_7rem_7rem_7rem_1.2rem] items-center px-4 py-1.5 hover:bg-dark-600/30 transition group/row cursor-pointer" data-edit-dep="${d.id}" data-dep-type="${g.key}">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex flex-col gap-0.5 opacity-0 group-hover/row:opacity-100 transition flex-shrink-0">
                  <button data-move-dep-up="${d.id}" class="text-gray-500 hover:text-gray-300 leading-none text-[10px]" onclick="event.stopPropagation()">▲</button>
                  <button data-move-dep-down="${d.id}" class="text-gray-500 hover:text-gray-300 leading-none text-[10px]" onclick="event.stopPropagation()">▼</button>
                </div>
                <p class="text-xs text-gray-200 truncate">${d.nom}</p>
                <p class="text-[10px] font-light text-gray-500 flex-shrink-0">${d.categorie || 'Autre'}${d.frequence === 'Annuel' ? ' · Annuel' : ''}</p>
              </div>
              <span class="text-xs text-right whitespace-nowrap ${mensuel > 0 ? 'text-gray-100 font-medium' : 'text-gray-600'}">${formatCurrencyCents(mensuel)}</span>
              <span class="text-xs text-right whitespace-nowrap ${d.frequence === 'Annuel' ? 'text-accent-amber font-medium' : 'text-gray-400'}">${formatCurrencyCents(lisse)}</span>
              <span class="text-xs text-right whitespace-nowrap ${d.frequence === 'Annuel' ? 'text-gray-100 font-medium' : 'text-gray-400'}">${formatCurrencyCents(annuel)}</span>
              <button data-del-dep="${d.id}" class="opacity-0 group-hover/row:opacity-100 text-accent-red/60 hover:text-accent-red text-[10px] font-medium transition text-right" onclick="event.stopPropagation()">✕</button>
            </div>`;
            }).join('')}
          </div>
          <div class="grid grid-cols-[1fr_7rem_7rem_7rem_1.2rem] items-center px-4 py-2 border-t border-dark-400/40 bg-dark-700/30">
            <span class="text-xs font-bold text-gray-300 uppercase">Total</span>
            <span class="text-xs font-bold text-gray-100 text-right">${formatCurrencyCents(g.items.reduce((s, d) => s + (d.frequence === 'Annuel' ? 0 : (Number(d.montantMensuel) || 0)), 0))}</span>
            <span class="text-xs font-bold text-accent-amber text-right">${formatCurrencyCents(g.total)}</span>
            <span class="text-xs font-bold text-gray-100 text-right">${formatCurrencyCents(g.total * 12)}</span>
            <span></span>
          </div>
          ` : '<p class="px-4 py-3 text-gray-600 text-xs">Aucune dépense.</p>'}
        </details>
        `).join('')}
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  const content = document.getElementById('app-content');

  // Revenus
  const revenuTypes = [
    { value: 'Salaire', label: 'Salaire' },
    { value: '13ème mois', label: '13ème mois' },
    { value: 'Intéressement', label: 'Intéressement' },
    { value: 'Participation', label: 'Participation' },
    { value: 'Prime', label: 'Prime' },
    { value: 'Loyers', label: 'Revenus locatifs' },
    { value: 'Dividendes', label: 'Dividendes' },
    { value: 'Freelance', label: 'Freelance' },
    { value: 'Autre', label: 'Autre' }
  ];

  document.getElementById('btn-seed-revenus')?.addEventListener('click', () => {
    if (confirm('Remplacer tous les revenus par les données par défaut ?')) {
      store.resetSection('revenus');
      navigate('revenus-depenses');
    }
  });

  document.getElementById('btn-seed-depenses')?.addEventListener('click', () => {
    if (confirm('Remplacer toutes les dépenses par les données par défaut ?')) {
      store.resetSection('depenses');
      navigate('revenus-depenses');
    }
  });

  document.getElementById('btn-add-revenu')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Libellé', '', 'text', 'placeholder="Ex: Salaire net"')}
      ${selectField('type', 'Type', revenuTypes)}
      ${selectField('frequence', 'Fréquence', FREQ_OPTIONS, 'Mensuel')}
      ${montantFields('', '', '')}
    `;
    openModal('Ajouter un revenu', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.montantMensuel = getMontantFromModal();
      store.addItem('revenus', data);
      navigate('revenus-depenses');
    });
    setupMontantSync();
  });

  content.querySelectorAll('[data-edit-rev]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editRev;
      const item = store.get('revenus').find(i => i.id === id);
      if (!item) return;
      const montant = Number(item.montantMensuel) || 0;
      const freq = item.frequence || 'Mensuel';
      const mensuel = freq === 'Annuel' ? 0 : montant;
      const lisse = freq === 'Annuel' ? Math.round(montant / 12 * 100) / 100 : montant;
      const annuel = freq === 'Annuel' ? montant : montant * 12;
      const body = `
        ${inputField('nom', 'Libellé', item.nom)}
        ${selectField('type', 'Type', revenuTypes, item.type)}
        ${selectField('frequence', 'Fréquence', FREQ_OPTIONS, freq)}
        ${montantFields(mensuel, lisse, annuel)}
      `;
      openModal('Modifier le revenu', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.montantMensuel = getMontantFromModal();
        store.updateItem('revenus', id, data);
        navigate('revenus-depenses');
      });
      setupMontantSync();
    });
  });

  // Move revenu up/down
  content.querySelectorAll('[data-move-rev-up]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.moveRevUp;
      const revenus = store.get('revenus');
      const idx = revenus.findIndex(r => r.id === id);
      if (idx > 0) {
        [revenus[idx - 1], revenus[idx]] = [revenus[idx], revenus[idx - 1]];
        store.set('revenus', revenus);
        navigate('revenus-depenses');
      }
    });
  });

  content.querySelectorAll('[data-move-rev-down]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.moveRevDown;
      const revenus = store.get('revenus');
      const idx = revenus.findIndex(r => r.id === id);
      if (idx >= 0 && idx < revenus.length - 1) {
        [revenus[idx], revenus[idx + 1]] = [revenus[idx + 1], revenus[idx]];
        store.set('revenus', revenus);
        navigate('revenus-depenses');
      }
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

  const depTypeOptions = [
    { value: 'Fixe', label: 'Fixe' },
    { value: 'Variable', label: 'Variable' },
    { value: 'Abonnement', label: 'Abonnement' },
    { value: 'Investissement', label: 'Investissement' },
  ];

  // Add depense — one button per group
  content.querySelectorAll('.btn-add-depense').forEach(btn => {
    btn.addEventListener('click', () => {
      const typeDepense = btn.dataset.type;
      const body = `
        ${inputField('nom', 'Libellé', '', 'text', 'placeholder="Ex: Loyer"')}
        ${selectField('categorie', 'Catégorie', depCategories)}
        ${selectField('frequence', 'Fréquence', FREQ_OPTIONS, 'Mensuel')}
        ${montantFields('', '', '')}
      `;
      openModal(`Ajouter — ${DEPENSE_TYPES.find(t => t.key === typeDepense)?.label || 'Dépense'}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.montantMensuel = getMontantFromModal();
        data.typeDepense = typeDepense;
        store.addItem('depenses', data);
        navigate('revenus-depenses');
      });
      setupMontantSync();
    });
  });

  content.querySelectorAll('[data-edit-dep]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editDep;
      const item = store.get('depenses').find(i => i.id === id);
      if (!item) return;
      const montant = Number(item.montantMensuel) || 0;
      const freq = item.frequence || 'Mensuel';
      const mensuel = freq === 'Annuel' ? 0 : montant;
      const lisse = freq === 'Annuel' ? Math.round(montant / 12 * 100) / 100 : montant;
      const annuel = freq === 'Annuel' ? montant : montant * 12;
      const body = `
        ${inputField('nom', 'Libellé', item.nom)}
        ${selectField('categorie', 'Catégorie', depCategories, item.categorie)}
        ${selectField('typeDepense', 'Type de dépense', depTypeOptions, item.typeDepense || 'Fixe')}
        ${selectField('frequence', 'Fréquence', FREQ_OPTIONS, freq)}
        ${montantFields(mensuel, lisse, annuel)}
      `;
      openModal('Modifier la dépense', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.montantMensuel = getMontantFromModal();
        store.updateItem('depenses', id, data);
        navigate('revenus-depenses');
      });
      setupMontantSync();
    });
  });

  // Move depense up/down
  content.querySelectorAll('[data-move-dep-up]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.moveDepUp;
      const depenses = store.get('depenses');
      const idx = depenses.findIndex(d => d.id === id);
      if (idx <= 0) return;
      // Swap within same type group
      const item = depenses[idx];
      const type = item.typeDepense || 'Fixe';
      // Find previous item of same type
      for (let i = idx - 1; i >= 0; i--) {
        if ((depenses[i].typeDepense || 'Fixe') === type) {
          [depenses[i], depenses[idx]] = [depenses[idx], depenses[i]];
          break;
        }
      }
      store.set('depenses', depenses);
      navigate('revenus-depenses');
    });
  });

  content.querySelectorAll('[data-move-dep-down]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.moveDepDown;
      const depenses = store.get('depenses');
      const idx = depenses.findIndex(d => d.id === id);
      if (idx < 0 || idx >= depenses.length - 1) return;
      const item = depenses[idx];
      const type = item.typeDepense || 'Fixe';
      // Find next item of same type
      for (let i = idx + 1; i < depenses.length; i++) {
        if ((depenses[i].typeDepense || 'Fixe') === type) {
          [depenses[i], depenses[idx]] = [depenses[idx], depenses[i]];
          break;
        }
      }
      store.set('depenses', depenses);
      navigate('revenus-depenses');
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
