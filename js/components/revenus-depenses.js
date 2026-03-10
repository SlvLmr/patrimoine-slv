import { formatCurrency, openModal, getFormData, inputField, selectField } from '../utils.js?v=5';
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
    return `${formatCurrency(montant)}/an`;
  }
  return `${formatCurrency(montant)}/mois`;
}

function formatLisseLabel(item) {
  if (item.frequence === 'Annuel') {
    return `≈ ${formatCurrency(getMensuelLisse(item))}/mois`;
  }
  return '';
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
      <div class="grid grid-cols-1 sm:grid-cols-${hasAnnualItems ? '4' : '3'} gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Revenus mensuels</p>
          </div>
          <p class="text-2xl font-bold text-accent-green">${formatCurrency(revMensuelDirect)}</p>
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
          <p class="text-2xl font-bold text-accent-red">${formatCurrency(depMensuelDirect)}</p>
        </div>
        ${hasAnnualItems ? `
        <div class="card-dark rounded-xl p-5 kpi-card glow-amber">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-amber/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Mensuel lissé</p>
          </div>
          <p class="text-2xl font-bold text-accent-amber">${formatCurrency(totalR - totalD)}</p>
          <p class="text-xs text-gray-500 mt-1">Rev. ${formatCurrency(totalR)} − Dép. ${formatCurrency(totalD)}</p>
        </div>
        ` : ''}
        <div class="card-dark rounded-xl p-5 kpi-card glow-blue">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg ${balance >= 0 ? 'bg-accent-blue/20' : 'bg-accent-red/20'} flex items-center justify-center">
              <svg class="w-5 h-5 ${balance >= 0 ? 'text-accent-blue' : 'text-accent-red'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Balance annuelle</p>
          </div>
          <p class="text-2xl font-bold ${balance >= 0 ? 'text-accent-blue' : 'text-accent-red'}">${formatCurrency(balance * 12)}</p>
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
              <span class="text-xs text-gray-400">${formatCurrency(revenus.reduce((s, r) => s + getMensuelLisse(r), 0))}/mois</span>
            </div>
            <div class="flex items-center gap-3">
              <button id="btn-add-revenu" class="px-3 py-1 bg-accent-green/20 text-accent-green text-xs rounded-lg hover:bg-accent-green/30 transition font-medium" onclick="event.stopPropagation()">+ Ajouter</button>
              <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </summary>
          ${revenus.length > 0 ? `
          <div class="divide-y divide-dark-400/20">
            ${revenus.map(r => `
            <div class="flex items-center justify-between px-4 py-1 hover:bg-dark-600/30 transition group/row">
              <div class="flex items-center gap-3 min-w-0">
                <p class="text-xs text-gray-200 truncate">${r.nom}</p>
                <p class="text-[10px] text-gray-600 flex-shrink-0">${r.type || 'Autre'}${r.frequence === 'Annuel' ? ' · Annuel' : ''}</p>
              </div>
              <div class="flex items-center gap-3 flex-shrink-0">
                ${r.frequence === 'Annuel' ? `<span class="text-[10px] text-gray-500">${formatLisseLabel(r)}</span>` : ''}
                <span class="text-xs font-medium text-gray-100 whitespace-nowrap">${formatFreqLabel(r)}</span>
                <button data-edit-rev="${r.id}" class="opacity-0 group-hover/row:opacity-100 text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium transition">Mod.</button>
                <button data-del-rev="${r.id}" class="opacity-0 group-hover/row:opacity-100 text-accent-red/60 hover:text-accent-red text-[10px] font-medium transition">✕</button>
              </div>
            </div>
            `).join('')}
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
              ${g.total > 0 ? `<span class="text-xs text-gray-400">${formatCurrency(g.total)}/mois</span>` : ''}
            </div>
            <div class="flex items-center gap-3">
              <button class="btn-add-depense px-3 py-1 bg-accent-red/20 text-accent-red text-xs rounded-lg hover:bg-accent-red/30 transition font-medium" data-type="${g.key}" onclick="event.stopPropagation()">+ Ajouter</button>
              <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </summary>
          ${g.items.length > 0 ? `
          <div class="divide-y divide-dark-400/20">
            ${g.items.map(d => `
            <div class="flex items-center justify-between px-4 py-1 hover:bg-dark-600/30 transition group/row">
              <div class="flex items-center gap-3 min-w-0">
                <p class="text-xs text-gray-200 truncate">${d.nom}</p>
                <p class="text-[10px] text-gray-600 flex-shrink-0">${d.categorie || 'Autre'}${d.frequence === 'Annuel' ? ' · Annuel' : ''}</p>
              </div>
              <div class="flex items-center gap-3 flex-shrink-0">
                ${d.frequence === 'Annuel' ? `<span class="text-[10px] text-gray-500">${formatLisseLabel(d)}</span>` : ''}
                <span class="text-xs font-medium text-gray-100 whitespace-nowrap">${formatFreqLabel(d)}</span>
                <button data-edit-dep="${d.id}" class="opacity-0 group-hover/row:opacity-100 text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium transition">Mod.</button>
                <button data-del-dep="${d.id}" class="opacity-0 group-hover/row:opacity-100 text-accent-red/60 hover:text-accent-red text-[10px] font-medium transition">✕</button>
              </div>
            </div>
            `).join('')}
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
      ${inputField('montantMensuel', 'Montant (€)', '', 'number', 'step="50"')}
    `;
    openModal('Ajouter un revenu', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      store.addItem('revenus', data);
      navigate('revenus-depenses');
    });
  });

  content.querySelectorAll('[data-edit-rev]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editRev;
      const item = store.get('revenus').find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Libellé', item.nom)}
        ${selectField('type', 'Type', revenuTypes, item.type)}
        ${selectField('frequence', 'Fréquence', FREQ_OPTIONS, item.frequence || 'Mensuel')}
        ${inputField('montantMensuel', 'Montant (€)', item.montantMensuel, 'number', 'step="50"')}
      `;
      openModal('Modifier le revenu', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        store.updateItem('revenus', id, data);
        navigate('revenus-depenses');
      });
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
        ${inputField('montantMensuel', 'Montant (€)', '', 'number', 'step="10"')}
      `;
      openModal(`Ajouter — ${DEPENSE_TYPES.find(t => t.key === typeDepense)?.label || 'Dépense'}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.typeDepense = typeDepense;
        store.addItem('depenses', data);
        navigate('revenus-depenses');
      });
    });
  });

  content.querySelectorAll('[data-edit-dep]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editDep;
      const item = store.get('depenses').find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Libellé', item.nom)}
        ${selectField('categorie', 'Catégorie', depCategories, item.categorie)}
        ${selectField('typeDepense', 'Type de dépense', depTypeOptions, item.typeDepense || 'Fixe')}
        ${selectField('frequence', 'Fréquence', FREQ_OPTIONS, item.frequence || 'Mensuel')}
        ${inputField('montantMensuel', 'Montant (€)', item.montantMensuel, 'number', 'step="10"')}
      `;
      openModal('Modifier la dépense', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        store.updateItem('depenses', id, data);
        navigate('revenus-depenses');
      });
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
