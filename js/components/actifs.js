import { formatCurrency, formatPercent, formatDate, openModal, getFormData, inputField, selectField } from '../utils.js?v=5';
import { ENVELOPPES, CATEGORIES, openAddPlacementModal, openEditPlacementModal } from './placement-form.js?v=5';

const ENVELOPE_COLORS = {
  PEA: 'accent-green',
  AV: 'accent-amber',
  CTO: 'accent-blue',
  PEE: 'accent-cyan',
  PER: 'accent-green',
  Crypto: 'accent-red',
  Autre: 'gray-400',
};

const ENVELOPE_ICONS = {
  PEA: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  AV: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  CTO: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  PEE: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  PER: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  Crypto: 'M13 10V3L4 14h7v7l9-11h-7z',
  Autre: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
};


function pvBadge(pv) {
  if (!pv || pv === 0) return '';
  const cls = pv >= 0 ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red';
  return `<span class="text-xs px-2 py-0.5 rounded-full ${cls}">${pv >= 0 ? '+' : ''}${formatCurrency(pv)}</span>`;
}


export function render(store) {
  const state = store.getAll();
  const { immobilier, placements, epargne } = state.actifs;
  const emprunts = store.get('passifs.emprunts');
  const heritageItems = store.get('heritage') || [];

  // Group placements by envelope
  const envelopeGroups = {};
  placements.forEach(p => {
    const env = p.enveloppe || p.type || 'Autre';
    if (!envelopeGroups[env]) envelopeGroups[env] = [];
    envelopeGroups[env].push(p);
  });

  // Passifs KPIs
  const totalDette = store.totalPassifs();
  const totalMensualites = emprunts.reduce((s, e) => s + (Number(e.mensualite) || 0), 0);
  const totalRevenus = store.totalRevenus();
  const tauxEndettement = totalRevenus > 0 ? totalMensualites / totalRevenus : 0;

  // Totals for column headers
  const totalImmo = immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const totalPlac = placements.reduce((s, i) => s + (Number(i.valeur) || Number(i.apport) || 0), 0);
  const totalEpar = epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const totalHeritage = heritageItems.reduce((s, i) => s + (Number(i.montant) || 0), 0);

  // Fixed sections
  const fixedSections = {
    immobilier: {
      key: 'immobilier',
      label: 'Immobilier',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      color: 'accent-green',
      total: totalImmo,
      count: immobilier.length,
      btnId: 'btn-add-immo',
    },
    epargne: {
      key: 'epargne',
      label: 'Épargne',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'accent-amber',
      total: totalEpar,
      count: epargne.length,
      btnId: 'btn-add-epar',
    },
    emprunts: {
      key: 'emprunts',
      label: 'Emprunts',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5',
      color: 'accent-red',
      total: totalDette,
      count: emprunts.length,
      btnId: 'btn-add-emprunt',
    },
    heritage: {
      key: 'heritage',
      label: 'Héritage',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'accent-cyan',
      total: totalHeritage,
      count: heritageItems.length,
      btnId: 'btn-add-heritage',
    },
  };

  // Dynamic envelope sections from placements
  const envelopeSections = Object.entries(envelopeGroups).map(([env, items]) => {
    const envMeta = ENVELOPPES.find(e => e.value === env);
    const envTotal = items.reduce((s, i) => s + (Number(i.valeur) || Number(i.apport) || 0), 0);
    return {
      key: `plac-${env}`,
      envKey: env,
      label: envMeta ? envMeta.label : env,
      icon: ENVELOPE_ICONS[env] || ENVELOPE_ICONS.Autre,
      color: ENVELOPE_COLORS[env] || 'gray-400',
      total: envTotal,
      count: items.length,
      btnId: `btn-add-plac-${env}`,
      items,
    };
  });

  // Build content for each section
  function renderImmoContent() {
    if (immobilier.length === 0) return '<p class="px-2 py-1 text-gray-600 text-xs">Aucun bien immobilier.</p>';
    return `<div class="space-y-1 p-2">${immobilier.map(i => {
      const pv = (Number(i.valeurActuelle) || 0) - (Number(i.valeurAchat) || 0);
      return `
        <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-200 text-xs">${i.nom}</span>
            ${pvBadge(pv)}
          </div>
          <div class="flex items-center justify-between text-[11px] text-gray-400">
            <span>${formatCurrency(i.valeurActuelle)}</span>
            <span>${formatCurrency(i.loyerMensuel || 0)}/m</span>
          </div>
          <div class="flex gap-2 mt-1">
            <button data-edit-immo="${i.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
            <button data-del-immo="${i.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function renderEnvelopeContent(items) {
    if (!items || items.length === 0) return '<p class="px-2 py-1 text-gray-600 text-xs">Aucun placement.</p>';
    // Group by category within envelope
    const catGroups = {};
    items.forEach(i => {
      const cat = i.categorie || 'Autre';
      if (!catGroups[cat]) catGroups[cat] = [];
      catGroups[cat].push(i);
    });
    const cats = Object.keys(catGroups);
    const showCatHeaders = cats.length > 1;
    return `<div class="p-2">${cats.map(cat => {
      const catItems = catGroups[cat];
      const catMeta = CATEGORIES.find(c => c.value === cat);
      const catLabel = catMeta ? catMeta.label : cat;
      return `
        <div class="mb-1">
          ${showCatHeaders ? `<div class="px-1 py-0.5 mb-0.5"><span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">${catLabel}</span></div>` : ''}
          ${catItems.map(i => {
            const pv = i.quantite && i.pru ? ((Number(i.valeur) || Number(i.apport) || 0) - Number(i.pru) * Number(i.quantite)) : 0;
            const dcaBase = Number(i.dcaMensuel) || 0;
            const dcaMax = (i.dcaOverrides || []).reduce((m, ov) => Math.max(m, Number(ov.dcaMensuel) || 0), 0);
            const dcaEffective = Math.max(dcaBase, dcaMax);
            const dcaLabel = dcaEffective > 0 ? `${formatCurrency(dcaEffective)}/m${dcaBase === 0 ? ' (programmé)' : ''}` : '';
            return `
            <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition mb-0.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1">
                  <span class="font-medium text-gray-200 text-xs">${i.nom}</span>
                  ${i.isAirLiquide ? '<span class="text-[9px] bg-accent-green/15 text-accent-green px-1 rounded">AI</span>' : ''}
                  ${!showCatHeaders && i.categorie ? `<span class="text-[9px] text-gray-500">${i.categorie}</span>` : ''}
                </div>
                <span class="font-medium text-gray-200 text-xs">${formatCurrency(Number(i.valeur) || Number(i.apport) || 0)}</span>
              </div>
              <div class="flex items-center justify-between text-[10px]">
                ${dcaLabel ? `<span class="text-gray-500">DCA ${dcaLabel}</span>` : '<span></span>'}
                ${pv !== 0 ? `<span class="${pv >= 0 ? 'text-accent-green' : 'text-accent-red'}">${pv >= 0 ? '+' : ''}${formatCurrency(pv)}</span>` : ''}
              </div>
              <div class="flex gap-2 mt-0.5">
                <button data-edit-plac="${i.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
                <button data-del-plac="${i.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
              </div>
            </div>`;
          }).join('')}
        </div>`;
    }).join('')}</div>`;
  }

  function renderEparContent() {
    if (epargne.length === 0) return '<p class="px-2 py-1 text-gray-600 text-xs">Aucun compte d\'épargne.</p>';
    return `<div class="space-y-1 p-2">${epargne.map(i => {
      const fillPct = i.plafond ? Math.min(100, (Number(i.solde) / Number(i.plafond)) * 100) : 0;
      return `
        <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-200 text-xs">${i.nom}</span>
            <span class="font-medium text-accent-amber text-xs">${formatCurrency(i.solde)}</span>
          </div>
          ${i.plafond ? `<div class="flex items-center justify-between text-[10px] text-gray-400">
            <span></span>
            <span>${formatCurrency(i.plafond)}</span>
          </div>` : ''}
          ${i.plafond ? `
          <div class="flex items-center gap-1">
            <div class="progress-bar h-1 flex-1">
              <div class="progress-bar-fill h-full bg-accent-amber" style="width: ${fillPct}%"></div>
            </div>
            <span class="text-[10px] text-gray-500">${fillPct.toFixed(0)}%</span>
          </div>` : ''}
          <div class="flex gap-2 mt-1">
            <button data-edit-epar="${i.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
            <button data-del-epar="${i.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function renderEmpruntContent() {
    // KPI row
    const kpiRow = `
      <div class="grid grid-cols-3 gap-1 p-2 pb-1">
        <div class="bg-dark-800/40 rounded p-1.5 text-center">
          <p class="text-[10px] text-gray-500">Dette</p>
          <p class="text-xs font-bold text-accent-red">${formatCurrency(totalDette)}</p>
        </div>
        <div class="bg-dark-800/40 rounded p-1.5 text-center">
          <p class="text-[10px] text-gray-500">Mensualités</p>
          <p class="text-xs font-bold text-gray-200">${formatCurrency(totalMensualites)}</p>
        </div>
        <div class="bg-dark-800/40 rounded p-1.5 text-center">
          <p class="text-[10px] text-gray-500">Endettement</p>
          <p class="text-xs font-bold ${tauxEndettement > 0.35 ? 'text-accent-red' : 'text-accent-green'}">${formatPercent(tauxEndettement)}</p>
        </div>
      </div>`;

    if (emprunts.length === 0) return kpiRow + '<p class="px-2 py-1 text-gray-600 text-xs">Aucun emprunt.</p>';
    return kpiRow + `<div class="space-y-1 p-2">${emprunts.map(e => {
      const paidPct = e.capitalInitial ? Math.min(100, ((Number(e.capitalInitial) - Number(e.capitalRestant)) / Number(e.capitalInitial)) * 100) : 0;
      return `
        <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-200 text-xs">${e.nom}</span>
            <span class="font-medium text-accent-red text-xs">${formatCurrency(e.capitalRestant)}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-gray-400">
            <span>${formatPercent(e.tauxInteret || 0)}</span>
            <span>${formatCurrency(e.mensualite)}/m · ${e.dureeRestanteMois || 0} mois</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="progress-bar h-1 flex-1">
              <div class="progress-bar-fill h-full bg-accent-green" style="width: ${paidPct}%"></div>
            </div>
            <span class="text-[10px] text-gray-500">${paidPct.toFixed(0)}%</span>
          </div>
          <div class="flex gap-2 mt-0.5">
            <button data-edit-emprunt="${e.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
            <button data-del-emprunt="${e.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
          </div>
        </div>`;
    }).join('')}</div>`;
  }

  function renderHeritageContent() {
    if (heritageItems.length === 0) return '<p class="px-2 py-1 text-gray-600 text-xs">Aucun héritage prévu.</p>';
    return `<div class="space-y-1 p-2">${heritageItems.map(h => `
        <div class="bg-dark-800/40 rounded p-2 hover:bg-dark-600/30 transition">
          <div class="flex items-center justify-between">
            <span class="font-medium text-gray-200 text-xs">${h.nom}</span>
            <span class="font-medium text-accent-cyan text-xs">${formatCurrency(h.montant)}</span>
          </div>
          <div class="flex items-center justify-between text-[10px] text-gray-400">
            <span class="${h.type === 'Immobilier' ? 'text-accent-green' : 'text-accent-amber'}">${h.type || 'Liquidité'}</span>
            ${h.dateInjection ? `<span>${formatDate(h.dateInjection)}</span>` : ''}
          </div>
          ${h.provenance ? `<div class="text-[10px] text-gray-500">${h.provenance}</div>` : ''}
          <div class="flex gap-2 mt-1">
            <button data-edit-heritage="${h.id}" class="text-accent-blue hover:text-accent-blue/80 text-[10px] font-medium">Modifier</button>
            <button data-del-heritage="${h.id}" class="text-accent-red/60 hover:text-accent-red text-[10px] font-medium">Suppr.</button>
          </div>
        </div>`).join('')}</div>`;
  }

  const contentRenderers = {
    immobilier: renderImmoContent,
    epargne: renderEparContent,
    emprunts: renderEmpruntContent,
    heritage: renderHeritageContent,
  };
  // Add dynamic envelope renderers
  envelopeSections.forEach(es => {
    contentRenderers[es.key] = () => renderEnvelopeContent(es.items);
  });

  const renderColumn = (s) => {
    const isEnvelope = s.key.startsWith('plac-');
    const collapseByDefault = isEnvelope && (s.envKey === 'PEA' || s.envKey === 'CTO');
    const btnColorClass = s.key === 'emprunts' ? 'from-accent-red to-accent-red text-white'
      : s.key === 'heritage' ? 'from-accent-cyan to-accent-cyan text-dark-900'
      : isEnvelope ? `from-${s.color} to-${s.color} text-dark-900`
      : 'from-accent-green to-accent-amber text-dark-900';
    return `
    <details ${collapseByDefault ? '' : 'open'} class="card-dark rounded-xl overflow-hidden flex flex-col group/block">
      <summary class="px-3 py-2.5 border-b border-dark-400/30 cursor-pointer select-none" style="list-style:none">
        <div class="flex items-center gap-2 mb-1.5">
          <div class="w-8 h-8 rounded-lg bg-${s.color}/20 flex items-center justify-center flex-shrink-0">
            <svg class="w-4 h-4 text-${s.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${s.icon}"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-bold text-gray-200">${s.label}</h2>
            <p class="text-[10px] text-gray-500">${s.count} élément${s.count > 1 ? 's' : ''}</p>
          </div>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open/block:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold ${s.key === 'emprunts' ? 'text-accent-red' : 'text-gray-200'}">${formatCurrency(s.total)}</span>
          <button id="${s.btnId}" class="px-2 py-1 bg-gradient-to-r ${btnColorClass} text-[10px] rounded hover:opacity-90 transition font-medium" onclick="event.stopPropagation(); event.preventDefault();">+ Ajouter</button>
        </div>
      </summary>
      <div class="flex-1 overflow-y-auto">
        ${contentRenderers[s.key]()}
      </div>
    </details>`;
  };

  // Row 1: Immobilier + Épargne
  const row1 = [fixedSections.immobilier, fixedSections.epargne];
  // Row 2: Dynamic envelope blocks (placements by envelope)
  const envCols = envelopeSections.length <= 2 ? 2 : envelopeSections.length <= 3 ? 3 : 4;
  // Row 3: Emprunts + Héritage
  const row3 = [fixedSections.emprunts, fixedSections.heritage];

  const addPlacBtn = envelopeSections.length === 0
    ? `<div class="flex justify-center"><button id="btn-add-plac" class="px-4 py-2 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter un placement</button></div>`
    : `<div class="flex items-center justify-between">
        <button id="btn-actu-rapide" class="flex items-center gap-1.5 px-3 py-1.5 bg-dark-600 text-gray-300 text-xs rounded hover:bg-dark-500 transition font-medium">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Actualisation rapide
        </button>
        <button id="btn-add-plac" class="px-3 py-1.5 bg-dark-600 text-gray-300 text-xs rounded hover:bg-dark-500 transition font-medium">+ Nouveau placement</button>
      </div>`;

  return `
    <div class="space-y-4">
      <h1 class="text-2xl font-bold text-gray-100">Actifs et passifs</h1>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
        ${row1.map(renderColumn).join('')}
      </div>

      ${envelopeSections.length > 0 ? `
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-${envCols} gap-3">
        ${envelopeSections.map(renderColumn).join('')}
      </div>` : ''}
      ${addPlacBtn}

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-3">
        ${row3.map(renderColumn).join('')}
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  const content = document.getElementById('app-content');

  // --- Immobilier ---
  document.getElementById('btn-add-immo')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Nom du bien', '', 'text', 'placeholder="Ex: Appartement Paris 11"')}
      ${inputField('valeurAchat', "Valeur d'achat (€)", '', 'number', 'step="1000"')}
      ${inputField('valeurActuelle', 'Valeur actuelle (€)', '', 'number', 'step="1000"')}
      ${inputField('loyerMensuel', 'Loyer mensuel (€)', '0', 'number', 'step="50"')}
      ${inputField('chargesMensuelles', 'Charges mensuelles (€)', '0', 'number', 'step="10"')}
      ${inputField('dateAchat', "Date d'achat", '', 'date')}
    `;
    openModal('Ajouter un bien immobilier', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      store.addItem('actifs.immobilier', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-immo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editImmo;
      const item = store.get('actifs.immobilier').find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Nom du bien', item.nom)}
        ${inputField('valeurAchat', "Valeur d'achat (€)", item.valeurAchat, 'number', 'step="1000"')}
        ${inputField('valeurActuelle', 'Valeur actuelle (€)', item.valeurActuelle, 'number', 'step="1000"')}
        ${inputField('loyerMensuel', 'Loyer mensuel (€)', item.loyerMensuel || 0, 'number', 'step="50"')}
        ${inputField('chargesMensuelles', 'Charges mensuelles (€)', item.chargesMensuelles || 0, 'number', 'step="10"')}
        ${inputField('dateAchat', "Date d'achat", item.dateAchat || '', 'date')}
      `;
      openModal('Modifier le bien', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        store.updateItem('actifs.immobilier', id, data);
        navigate('actifs');
      });
    });
  });

  content.querySelectorAll('[data-del-immo]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer ce bien immobilier ?')) {
        store.removeItem('actifs.immobilier', btn.dataset.delImmo);
        navigate('actifs');
      }
    });
  });

  // --- Placements ---
  // General add placement button
  document.getElementById('btn-add-plac')?.addEventListener('click', () => openAddPlacementModal(store, navigate, 'actifs', null));

  // Per-envelope add buttons
  content.querySelectorAll('[id^="btn-add-plac-"]').forEach(btn => {
    const env = btn.id.replace('btn-add-plac-', '');
    btn.addEventListener('click', () => openAddPlacementModal(store, navigate, 'actifs', env));
  });

  content.querySelectorAll('[data-edit-plac]').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditPlacementModal(store, navigate, 'actifs', btn.dataset.editPlac);
    });
  });

  content.querySelectorAll('[data-del-plac]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer ce placement ?')) {
        store.removeItem('actifs.placements', btn.dataset.delPlac);
        navigate('actifs');
      }
    });
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
      const env = p.enveloppe || p.type || '';
      const envColor = ENVELOPE_COLORS[env] || 'gray-400';
      return `
        <div class="flex items-center gap-3 py-2.5 border-b border-dark-400/30 last:border-0" data-actu-id="${p.id}">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-medium text-gray-200">${p.nom}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-${envColor}/15 text-${envColor}">${env}</span>
            </div>
            <div class="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
              <span>DCA ${formatCurrency(dca)}/m</span>
              <span>·</span>
              <span>Estimé ${formatCurrency(estimated)}</span>
            </div>
          </div>
          <div class="w-32">
            <input type="number" class="actu-val w-full px-2 py-1.5 bg-dark-800 border border-dark-400/50 rounded text-gray-200 text-sm text-right focus:border-accent-blue/50 focus:outline-none" value="${estimated}" step="0.01">
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
      navigate('actifs');
    });
  });

  // --- Épargne ---
  document.getElementById('btn-add-epar')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Nom du compte', '', 'text', 'placeholder="Ex: Livret A"')}
      ${inputField('solde', 'Solde actuel (€)', '', 'number', 'step="100"')}
      ${inputField('tauxInteret', 'Taux d\'intérêt annuel (%)', '3.0', 'number', 'step="0.1" min="0" max="100"')}
      ${inputField('plafond', 'Plafond (€)', '22950', 'number', 'step="100"')}
    `;
    openModal('Ajouter un compte d\'épargne', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.tauxInteret = (data.tauxInteret || 0) / 100;
      store.addItem('actifs.epargne', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-epar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editEpar;
      const item = store.get('actifs.epargne').find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Nom du compte', item.nom)}
        ${inputField('solde', 'Solde actuel (€)', item.solde, 'number', 'step="100"')}
        ${inputField('tauxInteret', 'Taux d\'intérêt annuel (%)', ((item.tauxInteret || 0.03) * 100).toFixed(1), 'number', 'step="0.1" min="0" max="100"')}
        ${inputField('plafond', 'Plafond (€)', item.plafond || 22950, 'number', 'step="100"')}
      `;
      openModal('Modifier le compte d\'épargne', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.tauxInteret = (data.tauxInteret || 0) / 100;
        store.updateItem('actifs.epargne', id, data);
        navigate('actifs');
      });
    });
  });

  content.querySelectorAll('[data-del-epar]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer ce compte d\'épargne ?')) {
        store.removeItem('actifs.epargne', btn.dataset.delEpar);
        navigate('actifs');
      }
    });
  });

  // --- Emprunts (Passifs) ---
  const empruntForm = (item = {}) => `
    ${inputField('nom', "Nom de l'emprunt", item.nom || '', 'text', 'placeholder="Ex: Prêt immobilier RP"')}
    ${inputField('capitalInitial', 'Capital initial (€)', item.capitalInitial || '', 'number', 'step="1000"')}
    ${inputField('capitalRestant', 'Capital restant dû (€)', item.capitalRestant || '', 'number', 'step="1000"')}
    ${inputField('tauxInteret', 'Taux d\'intérêt annuel (%)', ((parseFloat(item.tauxInteret) || 0.02) * 100).toFixed(2), 'number', 'step="0.1" min="0" max="100"')}
    ${inputField('mensualite', 'Mensualité (€)', item.mensualite || '', 'number', 'step="10"')}
    ${inputField('dureeRestanteMois', 'Durée restante (mois)', item.dureeRestanteMois || '', 'number', 'step="1"')}
    ${inputField('dateDebut', 'Date de début', item.dateDebut || '', 'date')}
  `;

  document.getElementById('btn-add-emprunt')?.addEventListener('click', () => {
    openModal('Ajouter un emprunt', empruntForm(), () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.tauxInteret = (data.tauxInteret || 0) / 100;
      store.addItem('passifs.emprunts', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-emprunt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editEmprunt;
      const item = store.get('passifs.emprunts').find(i => i.id === id);
      if (!item) return;
      openModal("Modifier l'emprunt", empruntForm(item), () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.tauxInteret = (data.tauxInteret || 0) / 100;
        store.updateItem('passifs.emprunts', id, data);
        navigate('actifs');
      });
    });
  });

  content.querySelectorAll('[data-del-emprunt]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cet emprunt ?')) {
        store.removeItem('passifs.emprunts', btn.dataset.delEmprunt);
        navigate('actifs');
      }
    });
  });

  // --- Héritage ---
  const heritageForm = (item = {}) => `
    ${inputField('nom', 'Nom / Description', item.nom || '', 'text', 'placeholder="Ex: Maison familiale"')}
    ${selectField('type', 'Type', [
      { value: 'Immobilier', label: 'Immobilier' },
      { value: 'Liquidité', label: 'Liquidité' }
    ], item.type || 'Immobilier')}
    ${inputField('montant', 'Montant estimé (€)', item.montant || '', 'number', 'min="0" step="1000"')}
    ${inputField('provenance', 'Provenance', item.provenance || '', 'text', 'placeholder="Ex: Parents"')}
    ${inputField('dateInjection', "Date estimée d'injection", item.dateInjection || '', 'date')}
  `;

  document.getElementById('btn-add-heritage')?.addEventListener('click', () => {
    openModal('Ajouter un héritage', heritageForm(), () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.nom || !data.montant) return;
      store.addItem('heritage', data);
      navigate('actifs');
    });
  });

  content.querySelectorAll('[data-edit-heritage]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editHeritage;
      const item = (store.get('heritage') || []).find(i => i.id === id);
      if (!item) return;
      openModal("Modifier l'héritage", heritageForm(item), () => {
        const data = getFormData(document.getElementById('modal-body'));
        if (!data.nom || !data.montant) return;
        store.updateItem('heritage', id, data);
        navigate('actifs');
      });
    });
  });

  content.querySelectorAll('[data-del-heritage]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cet héritage ?')) {
        store.removeItem('heritage', btn.dataset.delHeritage);
        navigate('actifs');
      }
    });
  });
}
