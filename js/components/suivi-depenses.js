import { formatCurrencyCents, formatDate, openModal, inputField, selectField, getFormData } from '../utils.js?v=5';

const CATEGORIES = [
  'Alimentation', 'Achats divers', 'Santé', 'Vêtements',
  'Loisirs - Plaisirs', 'Petits travaux', 'Virement', 'NDF', 'Autre - Imprévu'
];

const CATEGORIES_REVENUS = [
  'Salaire', 'Prime', 'Freelance', 'Dividendes',
  'Remboursement', 'Vente', 'Autre'
];

const BANK_ICON_PRIMARY = `<svg class="w-8 h-8 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21"/>
  </svg>`;
const BANK_ICON_SECONDARY = `<svg class="w-8 h-8 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/>
  </svg>`;
const PENCIL_ICON = `<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>`;

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const DEPENSES_MENSUELLES_CIC = [
  { id: 'mc-credit',     nom: 'Crédit maison',     montant: 652.55 },
  { id: 'mc-assurance',  nom: 'Assurance habitat',  montant: 51.88 },
  { id: 'mc-comptes',    nom: 'Comptes',            montant: 14.61 },
  { id: 'mc-elec',       nom: 'Electricité',        montant: 64.21 },
  { id: 'mc-gaz',        nom: 'Gaz',                montant: 116.95 },
  { id: 'mc-eau',        nom: 'Eau',                montant: 32.32 },
  { id: 'mc-taxe',       nom: 'Taxe foncière',      montant: 179.00 },
  { id: 'mc-freebox',    nom: 'Freebox Internet',   montant: 39.99 },
  { id: 'mc-tel-slv',    nom: 'Tél Sylvain',        montant: 15.99 },
  { id: 'mc-tel-gsp',    nom: 'Tel Gaspard',        montant: 15.99 },
  { id: 'mc-tel-agt',    nom: 'Tel Agathe',         montant: 15.99 },
  { id: 'mc-youtube',    nom: 'Youtube Premium',    montant: 12.99 },
  { id: 'mc-canal',      nom: 'Canal +',            montant: 19.99 },
  { id: 'mc-pel-gsp',    nom: 'PEL Gsp /CIC',      montant: 50.00 },
  { id: 'mc-pel-agt',    nom: 'PEL Agt /CIC',      montant: 50.00 },
  { id: 'mc-vacances',   nom: 'Vacances - WE',      montant: 200.00 },
  { id: 'mc-anniv',      nom: 'Anniv - Noël',       montant: 100.00 },
  { id: 'mc-clubs',      nom: 'Clubs - Cantine',    montant: 70.00 },
  { id: 'mc-quotidien',  nom: 'Quotidien /TRR',     montant: 700.00 },
  { id: 'mc-pea-slv',    nom: 'PEA Slv /TRR',      montant: 300.00 },
  { id: 'mc-btc-slv',    nom: 'BTC Slv /TRR',      montant: 50.00 },
  { id: 'mc-pea-gsp',    nom: 'PEA Gsp /TRR',      montant: 50.00 },
  { id: 'mc-pea-agt',    nom: 'PEA Agt /TRR',      montant: 50.00 },
];


export function render(store) {
  const bankNames = store.getBankNames();
  const COMPTES = [bankNames.primary, bankNames.secondary];
  if (!store.get('suiviDepenses')) store.set('suiviDepenses', []);
  if (!store.get('suiviRevenus')) store.set('suiviRevenus', []);
  // Init depenses mensuelles from defaults if not present
  if (!store.get('depensesMensuellesCIC')) {
    store.set('depensesMensuellesCIC', JSON.parse(JSON.stringify(DEPENSES_MENSUELLES_CIC)));
  }
  const depMensuelles = store.get('depensesMensuellesCIC') || [];
  const items = store.get('suiviDepenses') || [];
  const revenus = store.get('suiviRevenus') || [];
  const comptesCourants = store.get('actifs')?.comptesCourants || [
    { id: 'cc-cic', nom: bankNames.primary, solde: 0 },
    { id: 'cc-trade', nom: bankNames.secondary, solde: 0 }
  ];
  const baseSoldeCIC = Number(comptesCourants.find(c => c.id === 'cc-cic')?.solde) || 0;
  const baseSoldeTR = Number(comptesCourants.find(c => c.id === 'cc-trade')?.solde) || 0;

  // Custom labels (per bank)
  const labels = store.get('customLabels') || {};
  const lblSoldeDebutCIC = labels.soldeDebutMois_cic || 'Solde début de mois';
  const lblSoldeDebutTR = labels.soldeDebutMois_tr || 'Solde début de mois';
  const lblSoldeObligCIC = labels.soldeObligatoire_cic || 'Solde obligatoire';
  const lblSoldeObligTR = labels.soldeObligatoire_tr || 'Solde obligatoire';
  const lblNDF = labels.aRecupererNDF || 'A récupérer NDF';
  const lblEnveloppe = labels.enveloppeQuotidien || 'Enveloppe restante pour quotidien';

  // Solde début de mois
  const soldePrecedent = store.get('soldeMoisPrecedent') || {};
  const soldePrevCIC = Number(soldePrecedent.cic) || 0;
  const soldePrevTR = Number(soldePrecedent.tr) || 0;

  // Solde obligatoire
  const soldeObligatoire = store.get('soldeObligatoire') || {};
  const soldeObligCIC = Number(soldeObligatoire.cic) || 0;
  const soldeObligTR = Number(soldeObligatoire.tr) || 0;

  // A récupérer NDF = budget NDF - somme NDF
  const paramètres = store.get('parametres') || {};
  const budgetNDF = paramètres.budgetNDF !== undefined ? Number(paramètres.budgetNDF) : (store.get('budgetNDF') !== undefined ? Number(store.get('budgetNDF')) : 789.99);
  const ndfTR = items.filter(i => i.compte === bankNames.secondary && i.categorie === 'NDF').reduce((s, i) => s + (Number(i.montant) || 0), 0);
  const aRecupererNDF = budgetNDF - ndfTR;
  const sommeARecuperer = 39.99 + ndfTR;

  // Monthly checklist state
  const monthKey = getCurrentMonthKey();
  const cicCochees = store.get('cicMensuellesCochees') || {};
  const cocheesThisMonth = cicCochees[monthKey] || [];
  const totalCochees = depMensuelles
    .filter(d => cocheesThisMonth.includes(d.id))
    .reduce((s, d) => s + d.montant, 0);

  // Compute live solde = base + revenus - depenses - checked monthly
  const revCIC = revenus.filter(r => r.compte === bankNames.primary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depCIC = items.filter(i => i.compte === bankNames.primary).reduce((s, i) => s + (Number(i.montant) || 0), 0);
  const soldeCIC = baseSoldeCIC + soldePrevCIC + revCIC - depCIC - totalCochees;

  const revTR = revenus.filter(r => r.compte === bankNames.secondary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depTR = items.filter(i => i.compte === bankNames.secondary).reduce((s, i) => s + (Number(i.montant) || 0), 0);

  // Enveloppe restante pour quotidien = budget quotidien - (dépenses rouges + virements sortants TR)
  const budgetQuotidien = paramètres.budgetQuotidien !== undefined ? Number(paramètres.budgetQuotidien) : (store.get('budgetQuotidien') !== undefined ? Number(store.get('budgetQuotidien')) : 700);
  const depensesRougesTR = items.filter(i => i.compte === bankNames.secondary && (i.categorie || '') !== 'NDF').reduce((s, i) => s + (Number(i.montant) || 0), 0);
  const resteADepenser = budgetQuotidien - depensesRougesTR;

  // Trade Republic features (editable values)
  const trFeatures = store.get('trFeatures') || {};
  const trInterets = Number(trFeatures.interets) || 0;
  const lblInterets = trFeatures.lblInterets || 'Intérêts (2%/an)';
  const trSaveback = Number(trFeatures.saveback) || 0;
  const lblSaveback = trFeatures.lblSaveback || 'Saveback 1% → Bitcoin';
  const trRoundup = Number(trFeatures.roundup) || 0;
  const lblRoundup = trFeatures.lblRoundup || 'Round-up → CTO';

  const soldeTR = baseSoldeTR + soldePrevTR + revTR + trInterets - depTR - trRoundup;
  // Archive data
  const archives = store.get('archiveDepenses') || [];

  // Merge revenus + depenses into unified operations per bank (no sort — manual order via arrows)
  const opsCIC = [
    ...items.filter(i => i.compte === bankNames.primary).map(i => ({ ...i, type: 'depense' })),
    ...revenus.filter(r => r.compte === bankNames.primary).map(r => ({ ...r, type: 'revenu' }))
  ];

  const opsTR = [
    ...items.filter(i => i.compte === bankNames.secondary).map(i => ({ ...i, type: 'depense' })),
    ...revenus.filter(r => r.compte === bankNames.secondary).map(r => ({ ...r, type: 'revenu' }))
  ];

  const renderOp = (op) => {
    const isRevenu = op.type === 'revenu';
    const isVirement = !isRevenu && (op.categorie || '') === 'Virement';
    const isNDF = !isRevenu && (op.categorie || '') === 'NDF';
    const arrowColor = isRevenu ? 'text-green-500' : isVirement ? 'text-accent-amber' : isNDF ? 'text-purple-400' : 'text-accent-red';
    const icon = isRevenu
      ? `<svg class="w-3.5 h-3.5 ${arrowColor} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0l-5 5m5-5l5 5"/></svg>`
      : `<svg class="w-3.5 h-3.5 ${arrowColor} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m0 0l5-5m-5 5l-5-5"/></svg>`;
    const sign = isRevenu ? '+' : '-';
    const editAttr = isRevenu ? `data-edit-revenu="${op.id}"` : `data-edit-expense="${op.id}"`;
    const delAttr = isRevenu ? `data-del-revenu="${op.id}"` : `data-del-expense="${op.id}"`;
    return `
      <div class="op-row flex items-center justify-between px-3 py-px hover:bg-dark-600/30 transition group cursor-grab active:cursor-grabbing"
           draggable="true" data-op-id="${op.id}" data-op-type="${op.type}" data-op-compte="${op.compte}" ${editAttr}>
        <div class="flex items-center gap-2 min-w-0">
          <svg class="w-3 h-4 text-gray-600 flex-shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
            <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
            <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
          </svg>
          ${icon}
          <span class="text-[11px] text-gray-500 w-14 flex-shrink-0">${formatDate(op.date)}</span>
          <span class="ml-2 text-[13px] text-gray-200 truncate">${op.description || '—'}</span>
          ${op.categorie ? `<span class="text-[10px] font-light text-gray-500 flex-shrink-0">${op.categorie}</span>` : ''}
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-[13px] font-medium text-gray-100">${sign}${formatCurrencyCents(op.montant)}</span>
          <button ${delAttr} class="opacity-0 group-hover:opacity-100 text-accent-red/60 hover:text-accent-red text-xs transition" onclick="event.stopPropagation()">✕</button>
        </div>
      </div>`;
  };

  const noOps = opsCIC.length === 0 && opsTR.length === 0 && archives.length === 0;

  return `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-sky-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            Vie quotidienne
          </h2>
          <p class="text-gray-500 text-sm mt-1">Suivi de tes opérations bancaires au quotidien</p>
        </div>
        <div class="flex items-center gap-3">
          <button id="btn-archive-month" class="px-4 py-2 bg-dark-600/60 border border-dark-400/40 text-gray-400 text-sm rounded-lg hover:bg-dark-600 hover:text-gray-200 transition font-medium flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
            Clôturer le mois
          </button>
          <button id="btn-add-revenu" class="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter un revenu</button>
          <button id="btn-add-expense" class="px-4 py-2 bg-gradient-to-r from-accent-red to-accent-red text-white text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter une dépense</button>
          <button id="btn-add-virement" class="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter un virement</button>
          <button id="btn-add-ndf" class="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter une NDF</button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <!-- Primary bank -->
        <div class="card-dark rounded-xl overflow-hidden">
          <div class="px-4 py-3 flex items-center gap-3 border-b border-dark-400/30">
            ${BANK_ICON_PRIMARY}
            <div class="flex-1">
              <div class="flex items-center gap-1.5">
                <p class="text-sm text-gray-400">Compte courant ${bankNames.primary}</p>
                <button data-rename-bank="primary" class="text-gray-600 hover:text-accent-blue transition p-0.5 rounded hover:bg-dark-600/50" title="Renommer">${PENCIL_ICON}</button>
              </div>
              <p class="text-xl font-bold text-gray-100">${formatCurrencyCents(soldeCIC)}</p>
            </div>
            <button data-edit-solde="cc-cic" class="text-xs text-gray-500 hover:text-accent-blue transition px-2 py-1 rounded hover:bg-dark-600/50">Modifier</button>
          </div>
          <div class="flex items-center justify-between px-4 py-1 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-prev="cic">
            <span class="text-xs text-gray-500">${lblSoldeDebutCIC}</span>
            <span class="text-xs font-medium text-gray-400">${formatCurrencyCents(soldePrevCIC)}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-1 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition mb-4" data-edit-oblig="cic">
            <span class="text-xs text-gray-500">${lblSoldeObligCIC}</span>
            <span class="text-xs font-medium text-amber-400">${formatCurrencyCents(soldeObligCIC)}</span>
          </div>
          ${opsCIC.length > 0 ? `
          <div class="divide-y divide-dark-400/20" id="ops-drop-cic">
            ${opsCIC.map(renderOp).join('')}
          </div>
          ` : `<div class="px-5 py-4 text-sm text-gray-500">Aucune opération</div>`}

          <!-- Dépenses mensuelles fixes -->
          <div class="border-t border-dark-400/30">
            <div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/30">
              <div class="flex items-center gap-2">
                <div class="flex flex-col gap-0.5 flex-shrink-0 invisible"><span class="leading-none text-[10px]">▲</span><span class="leading-none text-[10px]">▼</span></div>
                <svg class="w-3.5 h-3.5 text-accent-amber flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                <span class="text-xs font-semibold text-gray-300">Dépenses mensuelles</span>
                <span class="text-[10px] text-gray-500">${cocheesThisMonth.length}/${depMensuelles.length}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-accent-red">${formatCurrencyCents(totalCochees)}</span>
                <button id="btn-add-mensuel-cic" class="text-accent-amber hover:text-accent-amber/80 text-sm font-bold transition ml-2" title="Ajouter">+</button>
              </div>
            </div>
            <div class="divide-y divide-dark-400/10">
              ${depMensuelles.map((d, idx) => {
                const checked = cocheesThisMonth.includes(d.id);
                return `
              <div class="flex items-center justify-between pl-8 pr-3 py-px hover:bg-dark-600/30 transition group/mc">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="flex flex-col gap-0.5 flex-shrink-0">
                    <button data-mc-up="${d.id}" class="text-gray-600 hover:text-gray-200 active:text-accent-amber leading-none text-[10px] px-0.5">▲</button>
                    <button data-mc-down="${d.id}" class="text-gray-600 hover:text-gray-200 active:text-accent-amber leading-none text-[10px] px-0.5">▼</button>
                  </div>
                  <input type="checkbox" data-cic-mensuel="${d.id}" ${checked ? 'checked' : ''} class="w-3.5 h-3.5 rounded border-dark-400 bg-dark-700 text-accent-amber focus:ring-accent-amber/40 cursor-pointer">
                  <span class="text-[12px] ${checked ? 'text-gray-500 line-through' : 'text-gray-200'} cursor-pointer" data-mc-edit="${d.id}">${d.nom}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-[12px] font-medium ${checked ? 'text-gray-600' : 'text-gray-300'} cursor-pointer" data-mc-edit="${d.id}">${formatCurrencyCents(d.montant)}</span>
                  <button data-mc-del="${d.id}" class="opacity-0 group-hover/mc:opacity-100 text-accent-red/60 hover:text-accent-red text-xs transition">✕</button>
                </div>
              </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Secondary bank -->
        <div class="card-dark rounded-xl overflow-hidden">
          <div class="px-4 py-3 flex items-center gap-3 border-b border-dark-400/30">
            ${BANK_ICON_SECONDARY}
            <div class="flex-1">
              <div class="flex items-center gap-1.5">
                <p class="text-sm text-gray-400">Compte courant ${bankNames.secondary}</p>
                <button data-rename-bank="secondary" class="text-gray-600 hover:text-accent-blue transition p-0.5 rounded hover:bg-dark-600/50" title="Renommer">${PENCIL_ICON}</button>
              </div>
              <p class="text-xl font-bold text-gray-100">${formatCurrencyCents(soldeTR)}</p>
            </div>
            <button data-edit-solde="cc-trade" class="text-xs text-gray-500 hover:text-accent-blue transition px-2 py-1 rounded hover:bg-dark-600/50">Modifier</button>
          </div>
          <div class="flex items-center justify-between px-4 py-1 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-prev="tr">
            <span class="text-xs text-gray-500">${lblSoldeDebutTR}</span>
            <span class="text-xs font-medium text-gray-400">${formatCurrencyCents(soldePrevTR)}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-1 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-oblig="tr">
            <span class="text-xs text-gray-500">${lblSoldeObligTR}</span>
            <span class="text-xs font-medium text-amber-400">${formatCurrencyCents(soldeObligTR)}</span>
          </div>
          ${budgetNDF > 0 ? `<div class="flex items-center justify-between px-4 py-1 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-budget-ndf>
            <span class="text-xs text-gray-500">${lblNDF}</span>
            <span class="text-xs font-medium text-purple-400">${formatCurrencyCents(aRecupererNDF)} <span class="text-gray-400">(${formatCurrencyCents(sommeARecuperer)})</span></span>
          </div>` : ''}
          <div class="flex items-center justify-between px-4 py-1 bg-dark-700/40 border-b border-dark-400/20 mb-4 cursor-pointer hover:bg-dark-600/30 transition" data-edit-budget-quotidien>
            <span class="text-xs text-gray-500">${lblEnveloppe}</span>
            <span class="text-xs font-medium ${resteADepenser >= 0 ? 'text-accent-green' : 'text-accent-red'}">${formatCurrencyCents(resteADepenser)}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-0.5 bg-dark-700/20 border-b border-dark-400/10 cursor-pointer hover:bg-dark-600/30 transition" data-edit-tr-feature="interets">
            <span class="text-[11px] text-gray-500">${lblInterets}</span>
            <span class="text-[11px] font-medium text-accent-green">+${formatCurrencyCents(trInterets)}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-0.5 bg-dark-700/20 border-b border-dark-400/10 cursor-pointer hover:bg-dark-600/30 transition" data-edit-tr-feature="saveback">
            <span class="text-[11px] text-gray-500">${lblSaveback}</span>
            <span class="text-[11px] font-medium text-accent-amber">${formatCurrencyCents(trSaveback)}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-0.5 bg-dark-700/20 border-b border-dark-400/10 cursor-pointer hover:bg-dark-600/30 transition" data-edit-tr-feature="roundup">
            <span class="text-[11px] text-gray-500">${lblRoundup}</span>
            <span class="text-[11px] font-medium text-accent-red">-${formatCurrencyCents(trRoundup)}</span>
          </div>
          ${opsTR.length > 0 ? `
          <div class="divide-y divide-dark-400/20" id="ops-drop-tr">
            ${opsTR.map(renderOp).join('')}
          </div>
          ` : `<div class="px-5 py-4 text-sm text-gray-500">Aucune opération</div>`}
        </div>
      </div>

      ${noOps ? `
      <div class="card-dark rounded-xl p-8 text-center">
        <p class="text-gray-500">Aucune opération enregistrée. Cliquez sur "+ Ajouter un revenu" ou "+ Ajouter une dépense" pour commencer.</p>
      </div>
      ` : ''}

      ${archives.length > 0 ? `
      <!-- Archives -->
      <div class="card-dark rounded-xl">
        <div class="px-5 py-4">
          <h2 class="text-sm font-semibold text-gray-400">Archives mensuelles</h2>
        </div>
        <!-- Tableau récapitulatif -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-dark-400/30">
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mois</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenus</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Dépenses</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Solde ${bankNames.primary}</th>
                <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Solde ${bankNames.secondary}</th>
                <th class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ops</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/20">
              ${archives.sort((a, b) => b.mois.localeCompare(a.mois)).map(a => {
                const label = new Date(a.mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                const rev = a.totalRevenus || 0;
                const dep = a.total || 0;
                const balance = rev - dep;
                const cats = Object.entries(a.categories || {}).sort((x, y) => y[1] - x[1]);
                return `
              <tr class="hover:bg-dark-600/30 transition group">
                <td class="px-4 py-2.5">
                  <span class="text-gray-200 capitalize font-medium">${label}</span>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <span class="text-accent-green font-medium">${formatCurrencyCents(rev)}</span>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <span class="text-accent-red font-medium">${formatCurrencyCents(dep)}</span>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <span class="font-semibold ${balance >= 0 ? 'text-accent-green' : 'text-accent-red'}">${balance >= 0 ? '+' : ''}${formatCurrencyCents(balance)}</span>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <span class="text-gray-300 font-medium">${a.soldeFinalCIC !== undefined ? formatCurrencyCents(a.soldeFinalCIC) : '—'}</span>
                </td>
                <td class="px-4 py-2.5 text-right">
                  <span class="text-gray-300 font-medium">${a.soldeFinalTR !== undefined ? formatCurrencyCents(a.soldeFinalTR) : '—'}</span>
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span class="text-xs text-gray-500">${a.count}</span>
                </td>
              </tr>
              ${cats.length > 0 ? `
              <tr class="bg-dark-800/30">
                <td colspan="7" class="px-4 py-1.5">
                  <div class="flex flex-wrap gap-1">${cats.map(([cat, val]) =>
                    `<span class="text-[10px] px-1.5 py-0.5 rounded bg-dark-600/50 text-gray-500">${cat} ${formatCurrencyCents(val)}</span>`
                  ).join('')}</div>
                </td>
              </tr>` : ''}`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

export function mount(store, navigate) {
  const bankNames = store.getBankNames();
  const COMPTES = [bankNames.primary, bankNames.secondary];

  // Rename bank
  document.querySelectorAll('[data-rename-bank]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.renameBank; // 'primary' or 'secondary'
      const currentName = bankNames[key];
      const body = inputField('nom', 'Nom de la banque', currentName);
      openModal('Renommer la banque', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const newName = (data.nom || '').trim();
        if (!newName || newName === currentName) return;
        store.renameBank(key, newName);
        navigate('suivi-depenses');
      });
    });
  });

  // Archive month (clôture)
  document.getElementById('btn-archive-month')?.addEventListener('click', () => {
    const monthKey = getCurrentMonthKey();
    const label = new Date(monthKey + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // Compute current final soldes
    const items = store.get('suiviDepenses') || [];
    const revenus = store.get('suiviRevenus') || [];
    const depMensuelles = store.get('depensesMensuellesCIC') || [];
    const cicCochees = store.get('cicMensuellesCochees') || {};
    const cocheesThisMonth = cicCochees[monthKey] || [];
    const comptesCourants = store.get('actifs')?.comptesCourants || [];
    const baseSoldeCIC = Number(comptesCourants.find(c => c.id === 'cc-cic')?.solde) || 0;
    const baseSoldeTR = Number(comptesCourants.find(c => c.id === 'cc-trade')?.solde) || 0;
    const soldePrecedent = store.get('soldeMoisPrecedent') || {};
    const soldePrevCIC = Number(soldePrecedent.cic) || 0;
    const soldePrevTR = Number(soldePrecedent.tr) || 0;
    const totalCochees = depMensuelles.filter(d => cocheesThisMonth.includes(d.id)).reduce((s, d) => s + d.montant, 0);
    const revCIC = revenus.filter(r => r.compte === bankNames.primary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const depCIC = items.filter(i => i.compte === bankNames.primary).reduce((s, i) => s + (Number(i.montant) || 0), 0);
    const finalSoldeCIC = baseSoldeCIC + soldePrevCIC + revCIC - depCIC - totalCochees;
    const revTR = revenus.filter(r => r.compte === bankNames.secondary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const depTR = items.filter(i => i.compte === bankNames.secondary).reduce((s, i) => s + (Number(i.montant) || 0), 0);
    const finalSoldeTR = baseSoldeTR + soldePrevTR + revTR - depTR;

    // Build archive summary
    const totalDepenses = items.reduce((s, i) => s + (Number(i.montant) || 0), 0) + totalCochees;
    const totalRevenus = revenus.reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const categories = {};
    items.forEach(i => {
      const cat = i.categorie || 'Autre';
      categories[cat] = (categories[cat] || 0) + (Number(i.montant) || 0);
    });
    if (totalCochees > 0) categories['Mensuelles fixes'] = totalCochees;

    const body = `
      <div class="space-y-3 text-sm">
        <p class="text-gray-300">Archiver <span class="font-semibold text-gray-100 capitalize">${label}</span> et repartir sur un nouveau mois ?</p>
        <div class="bg-dark-700/50 rounded-lg p-3 space-y-1">
          <div class="flex justify-between"><span class="text-gray-400">Total revenus</span><span class="text-accent-green font-medium">${formatCurrencyCents(totalRevenus)}</span></div>
          <div class="flex justify-between"><span class="text-gray-400">Total dépenses</span><span class="text-accent-red font-medium">${formatCurrencyCents(totalDepenses)}</span></div>
          <div class="border-t border-dark-400/30 my-1"></div>
          <div class="flex justify-between"><span class="text-gray-400">Solde final ${bankNames.primary}</span><span class="text-gray-200 font-medium">${formatCurrencyCents(finalSoldeCIC)}</span></div>
          <div class="flex justify-between"><span class="text-gray-400">Solde final ${bankNames.secondary}</span><span class="text-gray-200 font-medium">${formatCurrencyCents(finalSoldeTR)}</span></div>
        </div>
        <p class="text-[11px] text-gray-500">Les soldes finaux deviendront les "soldes mois précédent" du mois suivant. Les opérations et coches seront remises à zéro.</p>
      </div>
    `;

    openModal('Clôturer le mois', body, () => {
      // Save archive
      const archives = store.get('archiveDepenses') || [];
      archives.push({
        mois: monthKey,
        total: totalDepenses,
        totalRevenus,
        count: items.length,
        categories,
        soldeFinalCIC: finalSoldeCIC,
        soldeFinalTR: finalSoldeTR
      });
      store.set('archiveDepenses', archives);

      // Set solde mois précédent to final computed soldes
      store.set('soldeMoisPrecedent', { cic: finalSoldeCIC, tr: finalSoldeTR });

      // Clear operations
      store.set('suiviDepenses', []);
      store.set('suiviRevenus', []);

      // Clear checked monthly items for this month
      const allCochees = store.get('cicMensuellesCochees') || {};
      delete allCochees[monthKey];
      store.set('cicMensuellesCochees', allCochees);

      navigate('suivi-depenses');
    });
  });

  // Add revenu
  document.getElementById('btn-add-revenu')?.addEventListener('click', () => {
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', 'placeholder="Ex: Salaire mars"')}
      ${selectField('categorie', 'Catégorie', CATEGORIES_REVENUS)}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 2500"')}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
        <div class="flex gap-3">
          ${COMPTES.map((c, i) => `
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-green-500/40 transition has-[:checked]:border-green-500 has-[:checked]:bg-green-500/10">
              <input type="radio" name="compte" value="${c}" ${i === 0 ? 'checked' : ''} class="w-4 h-4 text-green-500 bg-dark-800 border-dark-400 focus:ring-green-500/40">
              <span class="text-sm text-gray-200">${c}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    openModal('Ajouter un revenu', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.primary;
      const revenus = store.get('suiviRevenus') || [];
      revenus.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
      store.set('suiviRevenus', revenus);

      navigate('suivi-depenses');
    });
  });

  // Edit bank solde
  document.querySelectorAll('[data-edit-solde]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ccId = btn.dataset.editSolde;
      const actifs = store.get('actifs') || {};
      const ccs = actifs.comptesCourants || [];
      const cc = ccs.find(c => c.id === ccId);
      const currentSolde = cc ? Number(cc.solde) || 0 : 0;
      const label = ccId === 'cc-cic' ? bankNames.primary : bankNames.secondary;
      const body = inputField('solde', `Solde ${label} (€)`, currentSolde, 'number', 'step="0.01"');
      openModal(`Modifier le solde ${label}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const newSolde = Number(data.solde) || 0;
        if (cc) {
          cc.solde = newSolde;
        } else {
          ccs.push({ id: ccId, nom: label, solde: newSolde });
        }
        actifs.comptesCourants = ccs;
        store.set('actifs', actifs);
        navigate('suivi-depenses');
      });
    });
  });

  // Edit solde mois précédent
  document.querySelectorAll('[data-edit-prev]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.editPrev; // 'cic' or 'tr'
      const bankLabel = key === 'cic' ? bankNames.primary : bankNames.secondary;
      const prev = store.get('soldeMoisPrecedent') || {};
      const labels = store.get('customLabels') || {};
      const lblKey = `soldeDebutMois_${key}`;
      const currentLabel = labels[lblKey] || 'Solde début de mois';
      const current = Number(prev[key]) || 0;
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('solde', `Montant ${bankLabel} (€)`, current, 'number', 'step="0.01"');
      openModal(`${currentLabel} — ${bankLabel}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        prev[key] = Number(data.solde) || 0;
        store.set('soldeMoisPrecedent', prev);
        if (data.libelle && data.libelle !== currentLabel) {
          labels[lblKey] = data.libelle;
          store.set('customLabels', labels);
        }
        navigate('suivi-depenses');
      });
    });
  });

  // Edit solde obligatoire
  document.querySelectorAll('[data-edit-oblig]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.editOblig; // 'cic' or 'tr'
      const bankLabel = key === 'cic' ? bankNames.primary : bankNames.secondary;
      const oblig = store.get('soldeObligatoire') || {};
      const labels = store.get('customLabels') || {};
      const lblKey = `soldeObligatoire_${key}`;
      const currentLabel = labels[lblKey] || 'Solde obligatoire';
      const current = Number(oblig[key]) || 0;
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('solde', `Montant ${bankLabel} (€)`, current, 'number', 'step="0.01"');
      openModal(`${currentLabel} — ${bankLabel}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        oblig[key] = Number(data.solde) || 0;
        store.set('soldeObligatoire', oblig);
        if (data.libelle && data.libelle !== currentLabel) {
          labels[lblKey] = data.libelle;
          store.set('customLabels', labels);
        }
        navigate('suivi-depenses');
      });
    });
  });

  // Edit budget NDF
  document.querySelectorAll('[data-edit-budget-ndf]').forEach(el => {
    el.addEventListener('click', () => {
      const labels = store.get('customLabels') || {};
      const currentLabel = labels.aRecupererNDF || 'A récupérer NDF';
      const params = store.get('parametres') || {};
      const current = params.budgetNDF !== undefined ? Number(params.budgetNDF) : (store.get('budgetNDF') !== undefined ? Number(store.get('budgetNDF')) : 789.99);
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('budget', 'Budget NDF (€)', current, 'number', 'step="0.01"');
      openModal(`${currentLabel} — ${bankNames.secondary}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const p = store.get('parametres') || {};
        p.budgetNDF = Number(data.budget) || 0;
        store.set('parametres', p);
        if (data.libelle && data.libelle !== currentLabel) {
          labels.aRecupererNDF = data.libelle;
          store.set('customLabels', labels);
        }
        navigate('suivi-depenses');
      });
    });
  });

  // Edit budget quotidien
  document.querySelectorAll('[data-edit-budget-quotidien]').forEach(el => {
    el.addEventListener('click', () => {
      const labels = store.get('customLabels') || {};
      const currentLabel = labels.enveloppeQuotidien || 'Enveloppe restante pour quotidien';
      const paramsQ = store.get('parametres') || {};
      const current = paramsQ.budgetQuotidien !== undefined ? Number(paramsQ.budgetQuotidien) : (store.get('budgetQuotidien') !== undefined ? Number(store.get('budgetQuotidien')) : 700);
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('budget', 'Budget quotidien (€)', current, 'number', 'step="0.01"');
      openModal(`${currentLabel} — ${bankNames.secondary}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const pQ = store.get('parametres') || {};
        pQ.budgetQuotidien = Number(data.budget) || 0;
        store.set('parametres', pQ);
        if (data.libelle && data.libelle !== currentLabel) {
          labels.enveloppeQuotidien = data.libelle;
          store.set('customLabels', labels);
        }
        navigate('suivi-depenses');
      });
    });
  });

  // Edit TR features (Intérêts, Saveback, Round-up)
  const trFeatureMeta = {
    interets: { valueKey: 'interets', lblKey: 'lblInterets', defaultLbl: 'Intérêts (2%/an)' },
    saveback: { valueKey: 'saveback', lblKey: 'lblSaveback', defaultLbl: 'Saveback 1% → Bitcoin' },
    roundup: { valueKey: 'roundup', lblKey: 'lblRoundup', defaultLbl: 'Round-up → CTO' },
  };
  document.querySelectorAll('[data-edit-tr-feature]').forEach(el => {
    el.addEventListener('click', () => {
      const feat = el.dataset.editTrFeature;
      const meta = trFeatureMeta[feat];
      const trFeatures = store.get('trFeatures') || {};
      const currentLabel = trFeatures[meta.lblKey] || meta.defaultLbl;
      const currentValue = Number(trFeatures[meta.valueKey]) || 0;
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('montant', 'Montant (€)', currentValue, 'number', 'step="0.01"');
      openModal(currentLabel, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        trFeatures[meta.valueKey] = Number(data.montant) || 0;
        if (data.libelle) trFeatures[meta.lblKey] = data.libelle;
        store.set('trFeatures', trFeatures);
        navigate('suivi-depenses');
      });
    });
  });

  // Add expense
  document.getElementById('btn-add-expense')?.addEventListener('click', () => {
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', 'placeholder="Ex: Courses Carrefour"')}
      ${selectField('categorie', 'Catégorie', CATEGORIES)}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 45.50"')}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
        <div class="flex gap-3">
          ${COMPTES.map((c, i) => `
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-accent-blue/40 transition has-[:checked]:border-accent-blue has-[:checked]:bg-accent-blue/10">
              <input type="radio" name="compte" value="${c}" ${i === 0 ? 'checked' : ''} class="w-4 h-4 text-accent-blue bg-dark-800 border-dark-400 focus:ring-accent-blue/40">
              <span class="text-sm text-gray-200">${c}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    openModal('Ajouter une dépense', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.primary;
      const items = store.get('suiviDepenses') || [];
      items.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
      store.set('suiviDepenses', items);

      navigate('suivi-depenses');
    });
  });

  // Edit expense
  document.querySelectorAll('[data-edit-expense]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editExpense;
      const items = store.get('suiviDepenses') || [];
      const item = items.find(i => i.id === id);
      if (!item) return;
      const body = `
        ${inputField('date', 'Date', item.date, 'date')}
        ${inputField('description', 'Description', item.description || '', 'text')}
        ${selectField('categorie', 'Catégorie', CATEGORIES, item.categorie)}
        ${inputField('montant', 'Montant (€)', item.montant, 'number', 'step="0.01"')}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
          <div class="flex gap-3">
            ${COMPTES.map(c => `
              <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-accent-blue/40 transition has-[:checked]:border-accent-blue has-[:checked]:bg-accent-blue/10">
                <input type="radio" name="compte" value="${c}" ${c === item.compte ? 'checked' : ''} class="w-4 h-4 text-accent-blue bg-dark-800 border-dark-400 focus:ring-accent-blue/40">
                <span class="text-sm text-gray-200">${c}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
      openModal('Modifier la dépense', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.compte = document.querySelector('input[name="compte"]:checked')?.value || item.compte;
        Object.assign(item, data);
        store.set('suiviDepenses', items);
        navigate('suivi-depenses');
      });
    });
  });

  // Edit revenu
  document.querySelectorAll('[data-edit-revenu]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editRevenu;
      const revenus = store.get('suiviRevenus') || [];
      const rev = revenus.find(r => r.id === id);
      if (!rev) return;
      const body = `
        ${inputField('date', 'Date', rev.date, 'date')}
        ${inputField('description', 'Description', rev.description || '', 'text')}
        ${selectField('categorie', 'Catégorie', CATEGORIES_REVENUS, rev.categorie)}
        ${inputField('montant', 'Montant (€)', rev.montant, 'number', 'step="0.01"')}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
          <div class="flex gap-3">
            ${COMPTES.map(c => `
              <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-green-500/40 transition has-[:checked]:border-green-500 has-[:checked]:bg-green-500/10">
                <input type="radio" name="compte" value="${c}" ${c === rev.compte ? 'checked' : ''} class="w-4 h-4 text-green-500 bg-dark-800 border-dark-400 focus:ring-green-500/40">
                <span class="text-sm text-gray-200">${c}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
      openModal('Modifier le revenu', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.compte = document.querySelector('input[name="compte"]:checked')?.value || rev.compte;
        Object.assign(rev, data);
        store.set('suiviRevenus', revenus);
        navigate('suivi-depenses');
      });
    });
  });

  // Toggle CIC monthly expenses
  document.querySelectorAll('[data-cic-mensuel]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.cicMensuel;
      const monthKey = getCurrentMonthKey();
      const cicCochees = store.get('cicMensuellesCochees') || {};
      const list = cicCochees[monthKey] || [];
      if (cb.checked) {
        if (!list.includes(id)) list.push(id);
      } else {
        const idx = list.indexOf(id);
        if (idx !== -1) list.splice(idx, 1);
      }
      cicCochees[monthKey] = list;
      store.set('cicMensuellesCochees', cicCochees);
      navigate('suivi-depenses');
    });
  });

  // Edit monthly expense
  document.querySelectorAll('[data-mc-edit]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.mcEdit;
      const list = store.get('depensesMensuellesCIC') || [];
      const dep = list.find(d => d.id === id);
      if (!dep) return;
      const body = `
        ${inputField('nom', 'Nom', dep.nom)}
        ${inputField('montant', 'Montant (€)', dep.montant, 'number', '0.01')}
      `;
      openModal('Modifier la dépense mensuelle', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        dep.nom = data.nom || dep.nom;
        dep.montant = Number(data.montant) || dep.montant;
        store.set('depensesMensuellesCIC', list);
        navigate('suivi-depenses');
      });
    });
  });

  // Move monthly expense up
  document.querySelectorAll('[data-mc-up]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mcUp;
      const list = store.get('depensesMensuellesCIC') || [];
      const idx = list.findIndex(d => d.id === id);
      if (idx > 0) {
        [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
        store.set('depensesMensuellesCIC', list);
        navigate('suivi-depenses');
      }
    });
  });

  // Move monthly expense down
  document.querySelectorAll('[data-mc-down]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mcDown;
      const list = store.get('depensesMensuellesCIC') || [];
      const idx = list.findIndex(d => d.id === id);
      if (idx >= 0 && idx < list.length - 1) {
        [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
        store.set('depensesMensuellesCIC', list);
        navigate('suivi-depenses');
      }
    });
  });

  // Delete monthly expense
  document.querySelectorAll('[data-mc-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.mcDel;
      const list = store.get('depensesMensuellesCIC') || [];
      const idx = list.findIndex(d => d.id === id);
      if (idx !== -1) {
        list.splice(idx, 1);
        store.set('depensesMensuellesCIC', list);
        navigate('suivi-depenses');
      }
    });
  });

  // Add new monthly expense
  document.getElementById('btn-add-mensuel-cic')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Nom', '')}
      ${inputField('montant', 'Montant (€)', '', 'number', '0.01')}
    `;
    openModal('Ajouter une dépense mensuelle', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.nom || !data.montant) return;
      const list = store.get('depensesMensuellesCIC') || [];
      list.push({ id: 'mc-' + Date.now().toString(36), nom: data.nom, montant: Number(data.montant) });
      store.set('depensesMensuellesCIC', list);
      navigate('suivi-depenses');
    });
  });

  // Drag and drop for operations
  function setupDragDrop(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    let draggedEl = null;

    container.querySelectorAll('.op-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        draggedEl = row;
        row.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.opId);
      });

      row.addEventListener('dragend', () => {
        row.style.opacity = '';
        container.querySelectorAll('.op-row').forEach(r => {
          r.classList.remove('border-t-2', 'border-accent-green');
        });
        draggedEl = null;
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.querySelectorAll('.op-row').forEach(r => {
          r.classList.remove('border-t-2', 'border-accent-green');
        });
        row.classList.add('border-t-2', 'border-accent-green');
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('border-t-2', 'border-accent-green');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('border-t-2', 'border-accent-green');
        if (!draggedEl || draggedEl === row) return;

        const srcId = draggedEl.dataset.opId;
        const srcType = draggedEl.dataset.opType;
        const tgtId = row.dataset.opId;
        const tgtType = row.dataset.opType;
        const compte = row.dataset.opCompte;

        // Get current visual order from DOM
        const rows = [...container.querySelectorAll('.op-row')];
        const order = rows.map(r => ({ id: r.dataset.opId, type: r.dataset.opType }));

        // Move src to before tgt
        const srcIdx = order.findIndex(o => o.id === srcId);
        const tgtIdx = order.findIndex(o => o.id === tgtId);
        if (srcIdx === -1 || tgtIdx === -1) return;

        const [moved] = order.splice(srcIdx, 1);
        const newTgtIdx = order.findIndex(o => o.id === tgtId);
        order.splice(newTgtIdx, 0, moved);

        // Apply new order to store arrays
        const depenses = store.get('suiviDepenses') || [];
        const revenus = store.get('suiviRevenus') || [];

        const depOrder = order.filter(o => o.type === 'depense').map(o => o.id);
        const revOrder = order.filter(o => o.type === 'revenu').map(o => o.id);

        // Reorder depenses for this compte
        const otherDep = depenses.filter(d => d.compte !== compte);
        const compteDep = depenses.filter(d => d.compte === compte);
        compteDep.sort((a, b) => depOrder.indexOf(a.id) - depOrder.indexOf(b.id));
        store.set('suiviDepenses', [...otherDep, ...compteDep]);

        // Reorder revenus for this compte
        const otherRev = revenus.filter(r => r.compte !== compte);
        const compteRev = revenus.filter(r => r.compte === compte);
        compteRev.sort((a, b) => revOrder.indexOf(a.id) - revOrder.indexOf(b.id));
        store.set('suiviRevenus', [...otherRev, ...compteRev]);

        navigate('suivi-depenses');
      });
    });
  }

  setupDragDrop('ops-drop-cic');
  setupDragDrop('ops-drop-tr');

  // Add virement (shortcut)
  document.getElementById('btn-add-virement')?.addEventListener('click', () => {
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', `placeholder="Ex: Virement vers ${bankNames.primary}"`)}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 500"')}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
        <div class="flex gap-3">
          ${COMPTES.map(c => `
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-amber-400/40 transition has-[:checked]:border-amber-400 has-[:checked]:bg-amber-400/10">
              <input type="radio" name="compte" value="${c}" ${c === bankNames.secondary ? 'checked' : ''} class="w-4 h-4 text-amber-400 bg-dark-800 border-dark-400 focus:ring-amber-400/40">
              <span class="text-sm text-gray-200">${c}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    openModal('Ajouter un virement', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.secondary;
      data.categorie = 'Virement';
      const items = store.get('suiviDepenses') || [];
      items.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
      store.set('suiviDepenses', items);
      navigate('suivi-depenses');
    });
  });

  // Add NDF (shortcut)
  document.getElementById('btn-add-ndf')?.addEventListener('click', () => {
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', 'placeholder="Ex: Restaurant client"')}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 35.50"')}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
        <div class="flex gap-3">
          ${COMPTES.map(c => `
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-purple-400/40 transition has-[:checked]:border-purple-400 has-[:checked]:bg-purple-400/10">
              <input type="radio" name="compte" value="${c}" ${c === bankNames.secondary ? 'checked' : ''} class="w-4 h-4 text-purple-400 bg-dark-800 border-dark-400 focus:ring-purple-400/40">
              <span class="text-sm text-gray-200">${c}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    openModal('Ajouter une NDF', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.secondary;
      data.categorie = 'NDF';
      const items = store.get('suiviDepenses') || [];
      items.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
      store.set('suiviDepenses', items);
      navigate('suivi-depenses');
    });
  });

  document.querySelectorAll('[data-del-expense]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delExpense;
      const items = store.get('suiviDepenses') || [];
      store.set('suiviDepenses', items.filter(i => i.id !== id));
      navigate('suivi-depenses');
    });
  });

  document.querySelectorAll('[data-del-revenu]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delRevenu;
      const revenus = store.get('suiviRevenus') || [];
      store.set('suiviRevenus', revenus.filter(r => r.id !== id));
      navigate('suivi-depenses');
    });
  });
}
