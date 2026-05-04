import { formatCurrencyCents, formatDate, openModal, inputField, selectField, getFormData } from '../utils.js?v=10';

const CATEGORIES = [
  'Alimentation', 'Achats divers', 'Santé', 'Vêtements',
  'Loisirs - Plaisirs', 'Petits travaux', 'Virement', 'NDF', 'Investissement', 'Autre - Imprévu'
];

const CATEGORIES_REVENUS = [
  'Salaire', 'Prime', 'Apport', 'Dividendes',
  'Remboursement', 'Vente', 'Autre'
];

const BANK_ICON_SVG = `<path stroke-linecap="round" stroke-linejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21"/>`;
const BANK_ICON_PRIMARY = `<svg class="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">${BANK_ICON_SVG}</svg>`;
const BANK_ICON_SECONDARY = `<svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">${BANK_ICON_SVG}</svg>`;
const BANK_ICON_EXTRA = `<svg class="w-7 h-7 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">${BANK_ICON_SVG}</svg>`;
const PENCIL_ICON = `<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>`;

const AFFECTATIONS = [
  { value: 'depense',        label: 'Dépense',       border: 'border-red-500',     bg: 'bg-red-500/10',        text: 'text-red-400',     ring: 'focus:ring-red-500/40',     radio: 'text-red-500' },
  { value: 'investissement',  label: 'Invest.',       border: 'border-blue-500',    bg: 'bg-blue-500/10',       text: 'text-blue-400',    ring: 'focus:ring-blue-500/40',    radio: 'text-blue-500' },
  { value: 'virement',        label: 'Virement',      border: 'border-amber-500',   bg: 'bg-amber-500/10',      text: 'text-amber-400',   ring: 'focus:ring-amber-500/40',   radio: 'text-amber-500' },
  { value: 'ndf',             label: 'NDF',           border: 'border-purple-500',  bg: 'bg-purple-500/10',     text: 'text-purple-400',  ring: 'focus:ring-purple-500/40',  radio: 'text-purple-500' },
  { value: 'autre',           label: 'Autre',         border: 'border-gray-500',    bg: 'bg-gray-500/10',       text: 'text-gray-400',    ring: 'focus:ring-gray-500/40',    radio: 'text-gray-500' },
  { value: 'revenu',          label: 'Revenu',        border: 'border-emerald-500', bg: 'bg-emerald-500/10',    text: 'text-emerald-400', ring: 'focus:ring-emerald-500/40', radio: 'text-emerald-500' },
];

function affectationField(currentValue) {
  return `
    <div class="mb-3">
      <label class="block text-xs font-medium text-gray-300 mb-1">Affectation</label>
      <div class="flex gap-1.5">
        ${AFFECTATIONS.map(a => `
          <label class="flex items-center gap-1 cursor-pointer px-2 py-1 rounded-md border border-dark-400/50 bg-dark-800 hover:${a.border}/40 transition has-[:checked]:${a.border} has-[:checked]:${a.bg}">
            <input type="radio" name="affectation" value="${a.value}" ${a.value === currentValue ? 'checked' : ''} class="w-3 h-3 ${a.radio} bg-dark-800 border-dark-400 ${a.ring}">
            <span class="text-[11px] font-medium ${a.text}">${a.label}</span>
          </label>
        `).join('')}
      </div>
    </div>`;
}

function getCurrentAffectation(item) {
  if (item.type === 'revenu') return 'revenu';
  const cat = (item.categorie || '').toLowerCase();
  if (cat === 'investissement') return 'investissement';
  if (cat === 'virement') return 'virement';
  if (cat === 'ndf') return 'ndf';
  if (cat === 'autre') return 'autre';
  return 'depense';
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const DEPENSES_MENSUELLES_CIC = [];

// Recurring DCA/Invest expenses for TR (checked=pending, unchecked=debited)
const DCA_MENSUELS_TR = [];

// Recurring revenues for TR (checked=pending, unchecked=credited)
const REVENUS_MENSUELS_TR = [];


export function render(store) {
  const bankNames = store.getBankNames();
  const extraBanks = bankNames.extra || [];
  const COMPTES = [bankNames.primary, bankNames.secondary, ...extraBanks.map(b => b.name)];
  if (!store.get('suiviDepenses')) store.set('suiviDepenses', []);
  if (!store.get('suiviRevenus')) store.set('suiviRevenus', []);

  // Migration: fix soldeMoisPrecedent that was saved WITH baseSolde (old bug)
  const _prev = store.get('soldeMoisPrecedent') || {};
  if (_prev && !_prev._migrated) {
    const _actifs = store.get('actifs') || {};
    const _ccs = _actifs.comptesCourants || [];
    const _baseCIC = Number(_ccs.find(c => c.id === 'cc-cic')?.solde) || 0;
    const _baseTR = Number(_ccs.find(c => c.id === 'cc-trade')?.solde) || 0;
    if (_prev.cic) _prev.cic = Number(_prev.cic) - _baseCIC;
    if (_prev.tr) _prev.tr = Number(_prev.tr) - _baseTR;
    for (const bank of (bankNames.extra || [])) {
      if (_prev[bank.id]) _prev[bank.id] = Number(_prev[bank.id]) - (Number(_ccs.find(c => c.id === 'cc-' + bank.id)?.solde) || 0);
    }
    _prev._migrated = true;
    store.set('soldeMoisPrecedent', _prev);
  }

  // Migration v2: TR features were baked into soldePrev but not reset
  // → subtract them from soldePrev and zero them out
  const _prev2 = store.get('soldeMoisPrecedent') || {};
  if (!_prev2._migratedTR) {
    const _trF = store.get('trFeatures') || {};
    const _trInt = Number(_trF.interets) || 0;
    const _trRnd = Number(_trF.roundup) || 0;
    if (_trInt || _trRnd) {
      _prev2.tr = (Number(_prev2.tr) || 0) - _trInt + _trRnd;
      _trF.interets = 0;
      _trF.saveback = 0;
      _trF.roundup = 0;
      store.set('trFeatures', _trF);
    }
    _prev2._migratedTR = true;
    store.set('soldeMoisPrecedent', _prev2);
  }
  // Init depenses mensuelles from defaults if not present
  if (!store.get('depensesMensuellesCIC')) {
    store.set('depensesMensuellesCIC', JSON.parse(JSON.stringify(DEPENSES_MENSUELLES_CIC)));
  }
  const depMensuelles = store.get('depensesMensuellesCIC') || [];

  // Init TR recurring DCA & revenues from defaults if not present
  if (!store.get('dcaMensuelsTR')) {
    store.set('dcaMensuelsTR', JSON.parse(JSON.stringify(DCA_MENSUELS_TR)));
  }
  if (!store.get('revenusMensuelsTR')) {
    store.set('revenusMensuelsTR', JSON.parse(JSON.stringify(REVENUS_MENSUELS_TR)));
  }
  const dcaTR = store.get('dcaMensuelsTR') || [];
  const revMensuelsTR = store.get('revenusMensuelsTR') || [];

  // Section names & collapsed state
  const sectionNames = store.get('sectionNames') || {};
  const sectionCollapsed = store.get('sectionCollapsed') || {};
  const secNameDep = sectionNames.depMensuelles || 'Dépenses mensuelles';
  const secNameDca = sectionNames.dcaTR || 'DCA & Investissements';
  const secNameRev = sectionNames.revMensuels || 'Apports mensuels';
  const secCollDep = !!sectionCollapsed.depMensuelles;
  const secCollDca = !!sectionCollapsed.dcaTR;
  const secCollRev = !!sectionCollapsed.revMensuels;

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
  const lblNDF = labels.aRecupererNDF || 'Pocket 3';
  const lblEnveloppe = labels.enveloppeQuotidien || 'Pocket 4';
  const lblRestantInvest = labels.restantInvestissement || 'Pocket 1';
  const lblRestantPEA = labels.restantPEA || 'Pocket 2';

  // Solde début de mois
  const soldePrecedent = store.get('soldeMoisPrecedent') || {};
  const soldePrevCIC = Number(soldePrecedent.cic) || 0;
  const soldePrevTR = Number(soldePrecedent.tr) || 0;

  // Solde obligatoire
  const soldeObligatoire = store.get('soldeObligatoire') || {};
  const soldeObligCIC = Number(soldeObligatoire.cic) || 0;
  // soldeObligTR will be computed after restantInvest, restantPEA and NDF values are available

  // Restant pour investissement
  const restantInvest = store.get('restantInvestissement') || {};
  const restantInvestTR = Number(restantInvest.tr) || 0;

  // Restant pour PEA
  const restantPEA = store.get('restantPEA') || {};
  const restantPEATR = Number(restantPEA.tr) || 0;

  // A récupérer NDF = budget NDF - somme NDF
  const paramètres = store.get('parametres') || {};
  const budgetNDF = paramètres.budgetNDF !== undefined ? Number(paramètres.budgetNDF) : (store.get('budgetNDF') !== undefined ? Number(store.get('budgetNDF')) : 0);
  const ndfTR = items.filter(i => i.compte === bankNames.secondary && i.categorie === 'NDF').reduce((s, i) => s + (Number(i.montant) || 0), 0);
  const aRecupererNDF = budgetNDF - ndfTR;
  const sommeARecuperer = 39.99 + ndfTR;

  // Budget quotidien (moved up so soldeObligTR can use it)
  const budgetQuotidien = paramètres.budgetQuotidien !== undefined ? Number(paramètres.budgetQuotidien) : (store.get('budgetQuotidien') !== undefined ? Number(store.get('budgetQuotidien')) : 0);

  // Dynamic custom pockets (unlimited)
  const allPockets = store.get('budgetPockets') || {};
  const pocketsTR = allPockets.tr || [];
  const pocketsCIC = allPockets.cic || [];
  const pocketsTRTotal = pocketsTR.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pocketsCICTotal = pocketsCIC.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const hasRestantInvest = 'tr' in restantInvest;
  const hasRestantPEA = 'tr' in restantPEA;
  const hasBudgetNDF = budgetNDF > 0 || 'budgetNDF' in paramètres;
  const hasBudgetQuotidien = budgetQuotidien > 0 || 'budgetQuotidien' in paramètres;
  const hasSoldeObligCIC = soldeObligCIC > 0 || 'cic' in soldeObligatoire;

  // Solde obligatoire TR = sum of all active budget lines (hors quotidien)
  const soldeObligTR = restantInvestTR + restantPEATR + budgetNDF + pocketsTRTotal;

  // Monthly checklist state
  const monthKey = getCurrentMonthKey();
  const cicCochees = store.get('cicMensuellesCochees') || {};
  const cocheesThisMonth = cicCochees[monthKey] || [];
  const totalCochees = depMensuelles
    .filter(d => cocheesThisMonth.includes(d.id))
    .reduce((s, d) => s + d.montant, 0);

  // TR recurring state: confirmed (unchecked) items are counted in balance
  const trConfirmed = store.get('trRecurringConfirmed') || {};
  const trConfirmedThisMonth = trConfirmed[monthKey] || { expenses: [], revenues: [] };
  const confirmedDcaIds = trConfirmedThisMonth.expenses || [];
  const confirmedRevIds = trConfirmedThisMonth.revenues || [];
  const totalDcaConfirmed = dcaTR
    .filter(d => confirmedDcaIds.includes(d.id))
    .reduce((s, d) => s + d.montant, 0);
  const totalRevConfirmed = revMensuelsTR
    .filter(r => confirmedRevIds.includes(r.id))
    .reduce((s, r) => s + r.montant, 0);

  // Compute live solde = base + revenus - depenses - checked monthly
  const revCIC = revenus.filter(r => r.compte === bankNames.primary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depCIC = items.filter(i => i.compte === bankNames.primary).reduce((s, i) => s + (Number(i.montant) || 0), 0);
  const soldeCIC = baseSoldeCIC + soldePrevCIC + revCIC - depCIC - totalCochees;

  const revTR = revenus.filter(r => r.compte === bankNames.secondary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depTR = items.filter(i => i.compte === bankNames.secondary).reduce((s, i) => s + (Number(i.montant) || 0), 0);

  // Enveloppe restante pour quotidien
  const depensesRougesTR = items.filter(i => i.compte === bankNames.secondary && (i.categorie || '') !== 'NDF' && (i.categorie || '') !== 'Investissement' && (i.categorie || '') !== 'Autre').reduce((s, i) => s + (Number(i.montant) || 0), 0);
  const resteADepenser = budgetQuotidien - depensesRougesTR;

  // Trade Republic features (editable values)
  const trFeatures = store.get('trFeatures') || {};
  const trInterets = Number(trFeatures.interets) || 0;
  const lblInterets = trFeatures.lblInterets || 'Intérêts (2%/an)';
  const trSaveback = Number(trFeatures.saveback) || 0;
  const lblSaveback = trFeatures.lblSaveback || 'Saveback 1% → Bitcoin';
  const trRoundup = Number(trFeatures.roundup) || 0;
  const lblRoundup = trFeatures.lblRoundup || 'Round-up → CTO';

  const soldeTR = baseSoldeTR + soldePrevTR + revTR + trInterets - depTR - trRoundup - totalDcaConfirmed + totalRevConfirmed;

  // Extra banks computation
  const extraBankData = extraBanks.map(bank => {
    const ccId = 'cc-' + bank.id;
    const baseSolde = Number(comptesCourants.find(c => c.id === ccId)?.solde) || 0;
    const prevSolde = Number(soldePrecedent[bank.id]) || 0;
    const obligSolde = Number(soldeObligatoire[bank.id]) || 0;
    const rev = revenus.filter(r => r.compte === bank.name).reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const dep = items.filter(i => i.compte === bank.name).reduce((s, i) => s + (Number(i.montant) || 0), 0);
    const solde = baseSolde + prevSolde + rev - dep;
    const ops = [
      ...items.filter(i => i.compte === bank.name).map(i => ({ ...i, type: 'depense' })),
      ...revenus.filter(r => r.compte === bank.name).map(r => ({ ...r, type: 'revenu' }))
    ];
    const lblPrev = labels[`soldeDebutMois_${bank.id}`] || 'Solde début de mois';
    const lblOblig = labels[`soldeObligatoire_${bank.id}`] || 'Solde obligatoire';
    return { ...bank, ccId, baseSolde, prevSolde, obligSolde, solde, ops, lblPrev, lblOblig };
  });

  // Archive data
  const archives = store.get('archiveDepenses') || [];

  // Merge revenus + depenses into unified operations per bank, sorted by date desc
  const opsCIC = [
    ...items.filter(i => i.compte === bankNames.primary).map(i => ({ ...i, type: 'depense' })),
    ...revenus.filter(r => r.compte === bankNames.primary).map(r => ({ ...r, type: 'revenu' }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const opsTR = [
    ...items.filter(i => i.compte === bankNames.secondary).map(i => ({ ...i, type: 'depense' })),
    ...revenus.filter(r => r.compte === bankNames.secondary).map(r => ({ ...r, type: 'revenu' }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const renderOp = (op) => {
    const isRevenu = op.type === 'revenu';
    const isVirement = !isRevenu && (op.categorie || '') === 'Virement';
    const isNDF = !isRevenu && (op.categorie || '') === 'NDF';
    const isInvest = !isRevenu && (op.categorie || '') === 'Investissement';
    const isAutre = !isRevenu && (op.categorie || '') === 'Autre';
    const arrowColor = isRevenu ? 'text-emerald-400' : isInvest ? 'text-blue-400' : isVirement ? 'text-amber-400' : isNDF ? 'text-purple-400' : isAutre ? 'text-gray-400' : 'text-accent-red';
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
          <span class="ml-2 text-[11px] text-gray-200 truncate">${op.description || '—'}</span>
          ${op.categorie ? `<span class="text-[9px] font-light text-gray-500 flex-shrink-0">${op.categorie}</span>` : ''}
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-[11px] font-medium text-gray-100">${sign}${formatCurrencyCents(op.montant)}</span>
          <button ${delAttr} class="btn-delete text-xs" onclick="event.stopPropagation()">✕</button>
        </div>
      </div>`;
  };

  const noOps = opsCIC.length === 0 && opsTR.length === 0 && extraBankData.every(b => b.ops.length === 0) && archives.length === 0;

  return `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-100 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-sky-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            Vie quotidienne
          </h2>
          <p class="text-gray-500 text-sm mt-1">Suivi de tes opérations bancaires au quotidien</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <button id="btn-archive-month" class="px-3 sm:px-4 py-1.5 sm:py-2 bg-dark-600/60 border border-dark-400/40 text-gray-400 text-xs sm:text-sm rounded-lg hover:bg-dark-600 hover:text-gray-200 transition font-medium flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
            Clôturer le mois
          </button>
          <button id="btn-add-revenu" class="px-2.5 sm:px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs sm:text-sm rounded-lg hover:bg-emerald-500/30 transition font-medium">+ Revenu</button>
          <button id="btn-add-expense" class="px-2.5 sm:px-3 py-1.5 bg-accent-red/20 text-accent-red text-xs sm:text-sm rounded-lg hover:bg-accent-red/30 transition font-medium">+ Dépense</button>
          <button id="btn-add-virement" class="px-2.5 sm:px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs sm:text-sm rounded-lg hover:bg-amber-500/30 transition font-medium">+ Virement</button>
          <button id="btn-add-invest" class="px-2.5 sm:px-3 py-1.5 bg-blue-500/20 text-blue-400 text-xs sm:text-sm rounded-lg hover:bg-blue-500/30 transition font-medium">+ Invest.</button>
          <button id="btn-add-ndf" class="px-2.5 sm:px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs sm:text-sm rounded-lg hover:bg-purple-500/30 transition font-medium">+ NDF</button>
        </div>
      </div>

      <div class="grid grid-cols-1 ${extraBanks.length > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-3">
        <!-- Primary bank -->
        <div class="card-dark rounded-xl overflow-hidden">
          <div class="px-4 py-2.5 flex items-center gap-3 border-b border-dark-400/30">
            ${BANK_ICON_PRIMARY}
            <div class="flex items-center gap-1.5 min-w-0">
              <p class="text-sm text-gray-400 whitespace-nowrap">${bankNames.primary}</p>
              <button data-rename-bank="primary" class="text-gray-600 hover:text-accent-blue transition p-0.5 rounded hover:bg-dark-600/50 flex-shrink-0" title="Renommer">${PENCIL_ICON}</button>
            </div>
            <p class="text-lg font-bold text-gray-100 ml-auto whitespace-nowrap">${formatCurrencyCents(soldeCIC)}</p>
            <button data-edit-solde="cc-cic" class="text-xs text-gray-500 hover:text-accent-blue transition px-2 py-1 rounded hover:bg-dark-600/50 flex-shrink-0">Modifier</button>
          </div>
          <div class="flex items-center justify-between px-4 py-1 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-prev="cic">
            <span class="text-xs text-gray-500">${lblSoldeDebutCIC}</span>
            <span class="text-xs font-medium text-gray-400">${formatCurrencyCents(soldePrevCIC)}</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 px-3 py-1.5 border-b border-dark-400/20">
            ${hasSoldeObligCIC ? `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-dark-600/40 border border-dark-400/20 cursor-pointer hover:bg-dark-500/40 transition group/pk relative" data-edit-oblig="cic">
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${lblSoldeObligCIC}</span>
              <span class="text-[10px] font-semibold text-amber-400">${formatCurrencyCents(soldeObligCIC)}</span>
              <button data-del-budget="oblig-cic" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>` : ''}
            ${pocketsCIC.map(p => `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-dark-600/40 border border-dark-400/20 cursor-pointer hover:bg-dark-500/40 transition group/pk relative" data-edit-pocket="${p.id}" data-pocket-bank="cic">
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${p.label}</span>
              <span class="text-[10px] font-semibold text-accent-blue">${formatCurrencyCents(p.amount)}</span>
              <button data-del-pocket="${p.id}" data-pocket-bank="cic" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>`).join('')}
            <div class="flex flex-col items-center justify-center px-1 py-1 rounded-md border border-dashed border-dark-400/30 cursor-pointer hover:border-accent-blue/40 hover:bg-dark-600/20 transition" data-add-budget="cic" title="Ajouter une ligne">
              <span class="text-[10px] text-gray-600 hover:text-accent-blue">+</span>
            </div>
          </div>
          ${opsCIC.length > 0 ? `
          <div class="divide-y divide-dark-400/20" id="ops-drop-cic">
            ${opsCIC.map(renderOp).join('')}
          </div>
          ` : `<div class="px-5 py-4 text-sm text-gray-500">Aucune opération</div>`}

          <!-- Dépenses mensuelles fixes -->
          <div class="border-t border-dark-400/30">
            <div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/30 cursor-pointer select-none" data-section-toggle="depMensuelles">
              <div class="flex items-center gap-2">
                <svg class="w-3 h-3 text-gray-500 flex-shrink-0 transition-transform ${secCollDep ? '-rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                <svg class="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                <span class="text-xs font-semibold text-gray-300 cursor-text" data-section-rename="depMensuelles">${secNameDep}</span>
                <span class="text-[10px] text-gray-500">${cocheesThisMonth.length}/${depMensuelles.length}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-accent-red">${formatCurrencyCents(totalCochees)}</span>
                <button id="btn-add-mensuel-cic" class="text-accent-amber hover:text-accent-amber/80 text-sm font-bold transition ml-2" title="Ajouter">+</button>
              </div>
            </div>
            <div class="divide-y divide-dark-400/10 ${secCollDep ? 'hidden' : ''}" data-section-body="depMensuelles">
              ${depMensuelles.map((d, idx) => {
                const checked = cocheesThisMonth.includes(d.id);
                return `
              <div class="flex items-center justify-between pl-8 pr-3 py-px hover:bg-dark-600/30 transition group/mc cursor-grab active:cursor-grabbing mc-drag-row" draggable="true" data-drag-mc-id="${d.id}">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-3 h-4 text-gray-600 flex-shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
                    <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
                    <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
                  </svg>
                  <input type="checkbox" data-cic-mensuel="${d.id}" ${checked ? 'checked' : ''} class="w-3.5 h-3.5 rounded border-dark-400 bg-dark-900 text-accent-amber focus:ring-accent-amber/40 cursor-pointer">
                  <span class="text-[11px] ${checked ? 'text-gray-500 line-through' : 'text-gray-200'} cursor-pointer" data-mc-edit="${d.id}">${d.nom}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-[11px] font-medium ${checked ? 'text-gray-600' : 'text-gray-300'} cursor-pointer" data-mc-edit="${d.id}">${formatCurrencyCents(d.montant)}</span>
                  <button data-mc-del="${d.id}" class="btn-delete text-xs">✕</button>
                </div>
              </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Secondary bank -->
        <div class="card-dark rounded-xl overflow-hidden">
          <div class="px-4 py-2.5 flex items-center gap-3 border-b border-dark-400/30">
            ${BANK_ICON_SECONDARY}
            <div class="flex items-center gap-1.5 min-w-0">
              <p class="text-sm text-gray-400 whitespace-nowrap">${bankNames.secondary}</p>
              <button data-rename-bank="secondary" class="text-gray-600 hover:text-accent-blue transition p-0.5 rounded hover:bg-dark-600/50 flex-shrink-0" title="Renommer">${PENCIL_ICON}</button>
            </div>
            <p class="text-lg font-bold text-gray-100 ml-auto whitespace-nowrap">${formatCurrencyCents(soldeTR)}</p>
            <button data-edit-solde="cc-trade" class="text-xs text-gray-500 hover:text-accent-blue transition px-2 py-1 rounded hover:bg-dark-600/50 flex-shrink-0">Modifier</button>
          </div>
          <div class="flex items-center justify-between px-4 py-1 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-prev="tr">
            <span class="text-xs text-gray-500">${lblSoldeDebutTR}</span>
            <span class="text-xs font-medium text-gray-400">${formatCurrencyCents(soldePrevTR)}</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 px-3 py-1.5 border-b border-dark-400/20">
            ${trFeatures.lblSaveback || trSaveback > 0 ? `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition group/pk relative" data-edit-tr-feature="saveback">
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${lblSaveback}</span>
              <span class="text-[10px] font-semibold text-amber-400">${formatCurrencyCents(trSaveback)}</span>
              <button data-del-budget="feat-saveback" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>` : ''}
            ${trFeatures.lblRoundup || trRoundup > 0 ? `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-red-500/10 border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition group/pk relative" data-edit-tr-feature="roundup">
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${lblRoundup}</span>
              <span class="text-[10px] font-semibold text-accent-red">-${formatCurrencyCents(trRoundup)}</span>
              <button data-del-budget="feat-roundup" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>` : ''}
            ${trFeatures.lblInterets || trInterets > 0 ? `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition group/pk relative" data-edit-tr-feature="interets">
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${lblInterets}</span>
              <span class="text-[10px] font-semibold text-emerald-400">+${formatCurrencyCents(trInterets)}</span>
              <button data-del-budget="feat-interets" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>` : ''}
            ${hasRestantInvest ? `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-dark-600/40 border border-dark-400/20 cursor-pointer hover:bg-dark-500/40 transition group/pk relative" data-edit-restant-invest>
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${lblRestantInvest}</span>
              <span class="text-[10px] font-semibold text-accent-blue">${formatCurrencyCents(restantInvestTR)}</span>
              <button data-del-budget="invest" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>` : ''}
            ${hasRestantPEA ? `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-dark-600/40 border border-dark-400/20 cursor-pointer hover:bg-dark-500/40 transition group/pk relative" data-edit-restant-pea>
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${lblRestantPEA}</span>
              <span class="text-[10px] font-semibold text-accent-blue">${formatCurrencyCents(restantPEATR)}</span>
              <button data-del-budget="pea" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>` : ''}
            ${hasBudgetNDF ? `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-dark-600/40 border border-dark-400/20 cursor-pointer hover:bg-dark-500/40 transition group/pk relative" data-edit-budget-ndf>
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${lblNDF}</span>
              <span class="text-[10px] font-semibold text-purple-400">${formatCurrencyCents(aRecupererNDF)}</span>
              <button data-del-budget="ndf" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>` : ''}
            ${hasBudgetQuotidien ? `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-dark-600/40 border border-dark-400/20 cursor-pointer hover:bg-dark-500/40 transition group/pk relative" data-edit-budget-quotidien>
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${lblEnveloppe}</span>
              <span class="text-[10px] font-semibold ${resteADepenser >= 0 ? 'text-emerald-400' : 'text-accent-red'}">${formatCurrencyCents(resteADepenser)}</span>
              <button data-del-budget="quotidien" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>` : ''}
            ${pocketsTR.map(p => `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-dark-600/40 border border-dark-400/20 cursor-pointer hover:bg-dark-500/40 transition group/pk relative" data-edit-pocket="${p.id}" data-pocket-bank="tr">
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${p.label}</span>
              <span class="text-[10px] font-semibold text-accent-blue">${formatCurrencyCents(p.amount)}</span>
              <button data-del-pocket="${p.id}" data-pocket-bank="tr" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>`).join('')}
            <div class="flex flex-col items-center justify-center px-1 py-1 rounded-md border border-dashed border-dark-400/30 cursor-pointer hover:border-accent-blue/40 hover:bg-dark-600/20 transition" data-add-budget="tr" title="Ajouter une ligne">
              <span class="text-[10px] text-gray-600 hover:text-accent-blue">+</span>
            </div>
          </div>

          ${opsTR.length > 0 ? `
          <div class="divide-y divide-dark-400/20" id="ops-drop-tr">
            ${opsTR.map(renderOp).join('')}
          </div>
          ` : `<div class="px-5 py-4 text-sm text-gray-500">Aucune opération</div>`}

          <!-- DCA & Investissements récurrents TR -->
          <div class="border-t border-dark-400/30">
            <div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/30 cursor-pointer select-none" data-section-toggle="dcaTR">
              <div class="flex items-center gap-2">
                <svg class="w-3 h-3 text-gray-500 flex-shrink-0 transition-transform ${secCollDca ? '-rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                <svg class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m0 0l5-5m-5 5l-5-5"/></svg>
                <span class="text-xs font-semibold text-gray-300 cursor-text" data-section-rename="dcaTR">${secNameDca}</span>
                <span class="text-[10px] text-gray-500">${confirmedDcaIds.length}/${dcaTR.length}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-blue-400">-${formatCurrencyCents(totalDcaConfirmed)}</span>
                <button id="btn-add-dca-tr" class="text-blue-400 hover:text-blue-400/80 text-sm font-bold transition ml-2" title="Ajouter">+</button>
              </div>
            </div>
            <div class="divide-y divide-dark-400/10 ${secCollDca ? 'hidden' : ''}" data-section-body="dcaTR">
              ${dcaTR.map(d => {
                const confirmed = confirmedDcaIds.includes(d.id);
                return `
              <div class="flex items-center justify-between pl-4 pr-3 py-px hover:bg-dark-600/30 transition group/tr-dca cursor-grab active:cursor-grabbing tr-dca-drag-row" draggable="true" data-drag-dca-id="${d.id}">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-3 h-4 text-gray-600 flex-shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
                  <input type="checkbox" data-tr-dca-recurring="${d.id}" ${confirmed ? 'checked' : ''} class="w-3.5 h-3.5 rounded border-dark-400 bg-dark-900 text-blue-500 focus:ring-blue-500/40 cursor-pointer">
                  <span class="text-[11px] ${confirmed ? 'text-gray-200' : 'text-gray-500 line-through'} cursor-pointer" data-tr-dca-edit="${d.id}">${d.nom}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-[11px] font-medium ${confirmed ? 'text-gray-300' : 'text-gray-600 line-through'} cursor-pointer" data-tr-dca-edit="${d.id}">-${formatCurrencyCents(d.montant)}</span>
                  <button data-tr-dca-del="${d.id}" class="btn-delete text-xs">✕</button>
                </div>
              </div>`;
              }).join('')}
            </div>
          </div>

          <!-- Apports mensuels récurrents TR -->
          <div class="border-t border-dark-400/30">
            <div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/30 cursor-pointer select-none" data-section-toggle="revMensuels">
              <div class="flex items-center gap-2">
                <svg class="w-3 h-3 text-gray-500 flex-shrink-0 transition-transform ${secCollRev ? '-rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                <svg class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0l-5 5m5-5l5 5"/></svg>
                <span class="text-xs font-semibold text-gray-300 cursor-text" data-section-rename="revMensuels">${secNameRev}</span>
                <span class="text-[10px] text-gray-500">${confirmedRevIds.length}/${revMensuelsTR.length}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-emerald-400">+${formatCurrencyCents(totalRevConfirmed)}</span>
                <button id="btn-add-rev-tr" class="text-emerald-400 hover:text-emerald-400/80 text-sm font-bold transition ml-2" title="Ajouter">+</button>
              </div>
            </div>
            <div class="divide-y divide-dark-400/10 ${secCollRev ? 'hidden' : ''}" data-section-body="revMensuels">
              ${revMensuelsTR.map(r => {
                const confirmed = confirmedRevIds.includes(r.id);
                return `
              <div class="flex items-center justify-between pl-4 pr-3 py-px hover:bg-dark-600/30 transition group/tr-rev cursor-grab active:cursor-grabbing tr-rev-drag-row" draggable="true" data-drag-rev-id="${r.id}">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-3 h-4 text-gray-600 flex-shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
                  <input type="checkbox" data-tr-rev-recurring="${r.id}" ${confirmed ? 'checked' : ''} class="w-3.5 h-3.5 rounded border-dark-400 bg-dark-900 text-emerald-500 focus:ring-emerald-500/40 cursor-pointer">
                  <span class="text-[11px] ${confirmed ? 'text-gray-200' : 'text-gray-500 line-through'} cursor-pointer" data-tr-rev-edit="${r.id}">${r.nom}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-[11px] font-medium ${confirmed ? 'text-emerald-400' : 'text-gray-600 line-through'} cursor-pointer" data-tr-rev-edit="${r.id}">+${formatCurrencyCents(r.montant)}</span>
                  <button data-tr-rev-del="${r.id}" class="btn-delete text-xs">✕</button>
                </div>
              </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        ${extraBankData.map(bank => `
        <!-- Extra bank: ${bank.name} -->
        <div class="card-dark rounded-xl overflow-hidden">
          <div class="px-4 py-2.5 flex items-center gap-3 border-b border-dark-400/30">
            ${BANK_ICON_EXTRA}
            <div class="flex items-center gap-1.5 min-w-0">
              <p class="text-sm text-gray-400 whitespace-nowrap">${bank.name}</p>
              <button data-rename-bank="extra-${bank.id}" class="text-gray-600 hover:text-cyan-400 transition p-0.5 rounded hover:bg-dark-600/50 flex-shrink-0" title="Renommer">${PENCIL_ICON}</button>
            </div>
            <p class="text-lg font-bold text-gray-100 ml-auto whitespace-nowrap">${formatCurrencyCents(bank.solde)}</p>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button data-edit-solde="${bank.ccId}" class="text-xs text-gray-500 hover:text-cyan-400 transition px-2 py-1 rounded hover:bg-dark-600/50">Modifier</button>
              <button data-remove-bank="${bank.id}" class="text-xs text-gray-500 hover:text-accent-red transition px-2 py-1 rounded hover:bg-dark-600/50" title="Supprimer cette banque">✕</button>
            </div>
          </div>
          <div class="flex items-center justify-between px-4 py-1 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-prev="${bank.id}">
            <span class="text-xs text-gray-500">${bank.lblPrev}</span>
            <span class="text-xs font-medium text-gray-400">${formatCurrencyCents(bank.prevSolde)}</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 px-3 py-1.5 border-b border-dark-400/20">
            ${bank.obligSolde > 0 || soldeObligatoire[bank.id] !== undefined ? `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-dark-600/40 border border-dark-400/20 cursor-pointer hover:bg-dark-500/40 transition group/pk relative" data-edit-oblig="${bank.id}">
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${bank.lblOblig}</span>
              <span class="text-[10px] font-semibold text-amber-400">${formatCurrencyCents(bank.obligSolde)}</span>
              <button data-del-budget="oblig-${bank.id}" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>` : ''}
            ${(allPockets[bank.id] || []).map(p => `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md bg-dark-600/40 border border-dark-400/20 cursor-pointer hover:bg-dark-500/40 transition group/pk relative" data-edit-pocket="${p.id}" data-pocket-bank="${bank.id}">
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${p.label}</span>
              <span class="text-[10px] font-semibold text-accent-blue">${formatCurrencyCents(p.amount)}</span>
              <button data-del-pocket="${p.id}" data-pocket-bank="${bank.id}" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[8px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>
            </div>`).join('')}
            <div class="flex flex-col items-center justify-center px-1 py-1 rounded-md border border-dashed border-dark-400/30 cursor-pointer hover:border-accent-blue/40 hover:bg-dark-600/20 transition" data-add-budget="${bank.id}" title="Ajouter une ligne">
              <span class="text-[10px] text-gray-600 hover:text-accent-blue">+</span>
            </div>
          </div>
          ${bank.ops.length > 0 ? `
          <div class="divide-y divide-dark-400/20" id="ops-drop-${bank.id}">
            ${bank.ops.map(renderOp).join('')}
          </div>
          ` : `<div class="px-5 py-4 text-sm text-gray-500">Aucune opération</div>`}
        </div>
        `).join('')}

        ${extraBanks.length === 0 ? `
        <!-- Add bank button -->
        <div id="btn-add-bank" class="card-dark rounded-xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-cyan-400/30 hover:bg-dark-600/20 transition min-h-[120px] border border-dashed border-dark-400/30">
          <svg class="w-10 h-10 text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
          </svg>
          <span class="text-sm text-gray-500">Ajouter une banque</span>
        </div>
        ` : ''}
      </div>

      ${noOps ? `
      <div class="card-dark rounded-xl p-8 text-center">
        <p class="text-gray-500">Aucune opération enregistrée. Cliquez sur "+ Ajouter un revenu" ou "+ Ajouter une dépense" pour commencer.</p>
      </div>
      ` : ''}

      ${archives.length > 0 ? `
      <!-- Archives -->
      <div class="card-dark rounded-xl px-5 py-4">
        <h2 class="text-sm font-semibold text-gray-400 mb-3">Archives mensuelles</h2>
        <div class="space-y-1">
          ${archives.sort((a, b) => b.mois.localeCompare(a.mois)).map(a => {
            const label = new Date(a.mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            return `
          <div class="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-dark-600/30 transition cursor-pointer archive-row" data-mois="${a.mois}">
            <span class="text-sm text-gray-200 capitalize font-medium">${label}</span>
            <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </div>`;
          }).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

export function mount(store, navigate) {
  const bankNames = store.getBankNames();
  const extraBanks = bankNames.extra || [];
  const COMPTES = [bankNames.primary, bankNames.secondary, ...extraBanks.map(b => b.name)];

  // Rename bank
  document.querySelectorAll('[data-rename-bank]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.renameBank; // 'primary', 'secondary', or 'extra-{id}'
      let currentName;
      if (key.startsWith('extra-')) {
        const bankId = key.replace('extra-', '');
        currentName = (extraBanks.find(b => b.id === bankId) || {}).name || '';
      } else {
        currentName = bankNames[key];
      }
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

  // Section collapse/expand toggle
  document.querySelectorAll('[data-section-toggle]').forEach(header => {
    header.addEventListener('click', (e) => {
      // Don't toggle if clicking the + button or rename span
      if (e.target.closest('button') || e.target.closest('[data-section-rename]')) return;
      const key = header.dataset.sectionToggle;
      const collapsed = store.get('sectionCollapsed') || {};
      collapsed[key] = !collapsed[key];
      store.set('sectionCollapsed', collapsed);
      const body = document.querySelector(`[data-section-body="${key}"]`);
      const chevron = header.querySelector('svg');
      if (body) body.classList.toggle('hidden');
      if (chevron) chevron.classList.toggle('-rotate-90');
    });
  });

  // Section rename (double-click on title)
  document.querySelectorAll('[data-section-rename]').forEach(span => {
    span.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const key = span.dataset.sectionRename;
      const names = store.get('sectionNames') || {};
      const defaults = { depMensuelles: 'Dépenses mensuelles', dcaTR: 'DCA & Investissements', revMensuels: 'Apports mensuels' };
      const current = names[key] || defaults[key] || '';
      const body = inputField('nom', 'Nom de la section', current);
      openModal('Renommer la section', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const newName = (data.nom || '').trim();
        if (!newName || newName === current) return;
        names[key] = newName;
        store.set('sectionNames', names);
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
    const trFeats = store.get('trFeatures') || {};
    const trInt = Number(trFeats.interets) || 0;
    const trRnd = Number(trFeats.roundup) || 0;
    const finalSoldeTR = baseSoldeTR + soldePrevTR + revTR + trInt - depTR - trRnd;

    // Extra banks final soldes
    const extraFinals = {};
    for (const bank of extraBanks) {
      const base = Number(comptesCourants.find(c => c.id === 'cc-' + bank.id)?.solde) || 0;
      const prev = Number(soldePrecedent[bank.id]) || 0;
      const rev = revenus.filter(r => r.compte === bank.name).reduce((s, r) => s + (Number(r.montant) || 0), 0);
      const dep = items.filter(i => i.compte === bank.name).reduce((s, i) => s + (Number(i.montant) || 0), 0);
      extraFinals[bank.id] = base + prev + rev - dep;
    }

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
          <div class="flex justify-between"><span class="text-gray-400">Total revenus</span><span class="text-emerald-400 font-medium">${formatCurrencyCents(totalRevenus)}</span></div>
          <div class="flex justify-between"><span class="text-gray-400">Total dépenses</span><span class="text-accent-red font-medium">${formatCurrencyCents(totalDepenses)}</span></div>
          <div class="border-t border-dark-400/30 my-1"></div>
          <div class="flex justify-between"><span class="text-gray-400">Solde final ${bankNames.primary}</span><span class="text-gray-200 font-medium">${formatCurrencyCents(finalSoldeCIC)}</span></div>
          <div class="flex justify-between"><span class="text-gray-400">Solde final ${bankNames.secondary}</span><span class="text-gray-200 font-medium">${formatCurrencyCents(finalSoldeTR)}</span></div>
          ${extraBanks.map(bank => `<div class="flex justify-between"><span class="text-gray-400">Solde final ${bank.name}</span><span class="text-gray-200 font-medium">${formatCurrencyCents(extraFinals[bank.id])}</span></div>`).join('')}
        </div>
        <p class="text-[11px] text-gray-500">Les soldes finaux deviendront les "soldes mois précédent" du mois suivant. Les opérations et coches seront remises à zéro.</p>
      </div>
    `;

    openModal('Clôturer le mois', body, () => {
      // Save archive — include full operations for later review
      const archives = store.get('archiveDepenses') || [];
      // Snapshot all sub-line values for archive review
      const trFeatsSnap = store.get('trFeatures') || {};
      const paramsSnap = store.get('parametres') || {};
      const restInvSnap = store.get('restantInvestissement') || {};
      const restPeaSnap = store.get('restantPEA') || {};
      const soldeObligSnap = store.get('soldeObligatoire') || {};
      const labelsSnap = store.get('customLabels') || {};
      const archiveEntry = {
        mois: monthKey,
        total: totalDepenses,
        totalRevenus,
        count: items.length,
        categories,
        soldeFinalCIC: finalSoldeCIC,
        soldeFinalTR: finalSoldeTR,
        operations: JSON.parse(JSON.stringify(items)),
        revenus: JSON.parse(JSON.stringify(revenus)),
        cochees: [...cocheesThisMonth],
        depMensuelles: JSON.parse(JSON.stringify(depMensuelles)),
        dcaTR: JSON.parse(JSON.stringify(store.get('dcaMensuelsTR') || [])),
        revMensuelsTR: JSON.parse(JSON.stringify(store.get('revenusMensuelsTR') || [])),
        trRecurringConfirmed: JSON.parse(JSON.stringify((store.get('trRecurringConfirmed') || {})[monthKey] || { expenses: [], revenues: [] })),
        // Sub-line snapshots
        meta: {
          soldePrevCIC, soldePrevTR,
          soldeObligCIC: Number(soldeObligSnap.cic) || 0,
          restantInvestTR: Number(restInvSnap.tr) || 0,
          restantPEATR: Number(restPeaSnap.tr) || 0,
          budgetNDF: paramsSnap.budgetNDF !== undefined ? Number(paramsSnap.budgetNDF) : 0,
          budgetQuotidien: paramsSnap.budgetQuotidien !== undefined ? Number(paramsSnap.budgetQuotidien) : 0,
          trInterets: Number(trFeatsSnap.interets) || 0,
          trSaveback: Number(trFeatsSnap.saveback) || 0,
          trRoundup: Number(trFeatsSnap.roundup) || 0,
          lblInterets: trFeatsSnap.lblInterets || 'Intérêts (2%/an)',
          lblSaveback: trFeatsSnap.lblSaveback || 'Saveback 1% → Bitcoin',
          lblRoundup: trFeatsSnap.lblRoundup || 'Round-up → CTO',
          lblSoldeDebutCIC: labelsSnap.soldeDebutMois_cic || 'Solde début de mois',
          lblSoldeDebutTR: labelsSnap.soldeDebutMois_tr || 'Solde début de mois',
          lblSoldeObligCIC: labelsSnap.soldeObligatoire_cic || 'Solde obligatoire',
          lblSoldeObligTR: labelsSnap.soldeObligatoire_tr || 'Solde obligatoire fin de mois',
          lblRestantInvest: labelsSnap.restantInvestissement || 'Pocket 1',
          lblRestantPEA: labelsSnap.restantPEA || 'Pocket 2',
          lblNDF: labelsSnap.aRecupererNDF || 'Pocket 3',
          lblEnveloppe: labelsSnap.enveloppeQuotidien || 'Pocket 4',
          extraPrev: {},
          extraOblig: {},
          budgetPockets: JSON.parse(JSON.stringify(store.get('budgetPockets') || {})),
        },
      };
      for (const bank of extraBanks) {
        archiveEntry['soldeFinal_' + bank.id] = extraFinals[bank.id];
        archiveEntry.meta.extraPrev[bank.id] = Number(soldePrecedent[bank.id]) || 0;
        const extraObligStore = store.get('soldeObligatoire') || {};
        archiveEntry.meta.extraOblig[bank.id] = Number(extraObligStore[bank.id]) || 0;
      }
      archives.push(archiveEntry);
      store.set('archiveDepenses', archives);

      // Set solde mois précédent — subtract baseSolde to avoid double-counting
      // (baseSolde is always re-added from actifs on each render)
      const newPrev = {
        cic: finalSoldeCIC - baseSoldeCIC,
        tr: finalSoldeTR - baseSoldeTR,
      };
      for (const bank of extraBanks) {
        const baseExtra = Number(comptesCourants.find(c => c.id === 'cc-' + bank.id)?.solde) || 0;
        newPrev[bank.id] = extraFinals[bank.id] - baseExtra;
      }
      store.set('soldeMoisPrecedent', newPrev);

      // Clear operations
      store.set('suiviDepenses', []);
      store.set('suiviRevenus', []);

      // Clear checked monthly items for this month
      const allCochees = store.get('cicMensuellesCochees') || {};
      delete allCochees[monthKey];
      store.set('cicMensuellesCochees', allCochees);

      // Reset TR features (monthly values already baked into soldePrev)
      const trF = store.get('trFeatures') || {};
      trF.interets = 0;
      trF.saveback = 0;
      trF.roundup = 0;
      store.set('trFeatures', trF);

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
      let label = ccId === 'cc-cic' ? bankNames.primary : ccId === 'cc-trade' ? bankNames.secondary : (cc?.nom || 'Banque');
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
      const key = el.dataset.editPrev; // 'cic', 'tr', or extra bank id
      const extraBank = extraBanks.find(b => b.id === key);
      const bankLabel = key === 'cic' ? bankNames.primary : key === 'tr' ? bankNames.secondary : (extraBank?.name || 'Banque');
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
      const key = el.dataset.editOblig; // 'cic', 'tr', or extra bank id
      const extraBankO = extraBanks.find(b => b.id === key);
      const bankLabel = key === 'cic' ? bankNames.primary : key === 'tr' ? bankNames.secondary : (extraBankO?.name || 'Banque');
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

  // Edit restant investissement
  document.querySelectorAll('[data-edit-restant-invest]').forEach(el => {
    el.addEventListener('click', () => {
      const labels = store.get('customLabels') || {};
      const currentLabel = labels.restantInvestissement || 'Pocket 1';
      const invest = store.get('restantInvestissement') || {};
      const current = Number(invest.tr) || 0;
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('montant', `Montant (€)`, current, 'number', 'step="0.01"');
      openModal(`${currentLabel} — ${bankNames.secondary}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        invest.tr = Number(data.montant) || 0;
        store.set('restantInvestissement', invest);
        if (data.libelle && data.libelle !== currentLabel) {
          labels.restantInvestissement = data.libelle;
          store.set('customLabels', labels);
        }
        navigate('suivi-depenses');
      });
    });
  });

  // Edit restant PEA
  document.querySelectorAll('[data-edit-restant-pea]').forEach(el => {
    el.addEventListener('click', () => {
      const labels = store.get('customLabels') || {};
      const currentLabel = labels.restantPEA || 'Pocket 2';
      const pea = store.get('restantPEA') || {};
      const current = Number(pea.tr) || 0;
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('montant', `Montant (€)`, current, 'number', 'step="0.01"');
      openModal(`${currentLabel} — ${bankNames.secondary}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        pea.tr = Number(data.montant) || 0;
        store.set('restantPEA', pea);
        if (data.libelle && data.libelle !== currentLabel) {
          labels.restantPEA = data.libelle;
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
      const currentLabel = labels.aRecupererNDF || 'Pocket 3';
      const params = store.get('parametres') || {};
      const current = params.budgetNDF !== undefined ? Number(params.budgetNDF) : (store.get('budgetNDF') !== undefined ? Number(store.get('budgetNDF')) : 0);
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('budget', 'Montant (€)', current, 'number', 'step="0.01"');
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
      const currentLabel = labels.enveloppeQuotidien || 'Pocket 4';
      const paramsQ = store.get('parametres') || {};
      const current = paramsQ.budgetQuotidien !== undefined ? Number(paramsQ.budgetQuotidien) : (store.get('budgetQuotidien') !== undefined ? Number(store.get('budgetQuotidien')) : 0);
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('budget', 'Montant (€)', current, 'number', 'step="0.01"');
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

  // Delete budget line
  document.querySelectorAll('[data-del-budget]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.delBudget;
      if (key.startsWith('oblig-')) {
        const bankKey = key.replace('oblig-', '');
        const oblig = store.get('soldeObligatoire') || {};
        delete oblig[bankKey];
        store.set('soldeObligatoire', oblig);
      } else if (key === 'invest') {
        const inv = store.get('restantInvestissement') || {};
        delete inv.tr;
        store.set('restantInvestissement', inv);
      } else if (key === 'pea') {
        const pea = store.get('restantPEA') || {};
        delete pea.tr;
        store.set('restantPEA', pea);
      } else if (key === 'ndf') {
        const p = store.get('parametres') || {};
        delete p.budgetNDF;
        store.set('parametres', p);
      } else if (key === 'quotidien') {
        const p = store.get('parametres') || {};
        delete p.budgetQuotidien;
        store.set('parametres', p);
      } else if (key.startsWith('feat-')) {
        const feat = key.replace('feat-', '');
        const trFeatures = store.get('trFeatures') || {};
        delete trFeatures[feat];
        const lblKey = 'lbl' + feat.charAt(0).toUpperCase() + feat.slice(1);
        delete trFeatures[lblKey];
        store.set('trFeatures', trFeatures);
      }
      navigate('suivi-depenses');
    });
  });

  // Add budget line — always opens a create form for a new pocket
  document.querySelectorAll('[data-add-budget]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bankKey = btn.dataset.addBudget;
      const body = inputField('libelle', 'Nom', '', 'text', 'placeholder="Ex: Vacances, Épargne..."') + inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 500"');
      openModal('Nouveau pocket', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const label = (data.libelle || '').trim();
        const amount = Number(data.montant) || 0;
        if (!label) return;
        const pockets = store.get('budgetPockets') || {};
        if (!pockets[bankKey]) pockets[bankKey] = [];
        pockets[bankKey].push({ id: 'pocket-' + Date.now(), label, amount });
        store.set('budgetPockets', pockets);
        navigate('suivi-depenses');
      });
    });
  });

  // Edit custom pocket
  document.querySelectorAll('[data-edit-pocket]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-del-pocket]')) return;
      const pocketId = el.dataset.editPocket;
      const bankKey = el.dataset.pocketBank;
      const pockets = store.get('budgetPockets') || {};
      const arr = pockets[bankKey] || [];
      const pocket = arr.find(p => p.id === pocketId);
      if (!pocket) return;
      const body = inputField('libelle', 'Nom', pocket.label) + inputField('montant', 'Montant (€)', pocket.amount, 'number', 'step="0.01"');
      openModal('Modifier le pocket', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        pocket.label = (data.libelle || '').trim() || pocket.label;
        pocket.amount = Number(data.montant) || 0;
        store.set('budgetPockets', pockets);
        navigate('suivi-depenses');
      });
    });
  });

  // Delete custom pocket
  document.querySelectorAll('[data-del-pocket]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pocketId = btn.dataset.delPocket;
      const bankKey = btn.dataset.pocketBank;
      const pockets = store.get('budgetPockets') || {};
      if (pockets[bankKey]) {
        pockets[bankKey] = pockets[bankKey].filter(p => p.id !== pocketId);
        store.set('budgetPockets', pockets);
      }
      navigate('suivi-depenses');
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
      const curAff = getCurrentAffectation(item);
      const body = `
        ${affectationField(curAff)}
        <div class="grid grid-cols-2 gap-2">
          <div>${inputField('date', 'Date', item.date, 'date')}</div>
          <div>${inputField('montant', 'Montant (€)', item.montant, 'number', 'step="0.01"')}</div>
        </div>
        ${inputField('description', 'Description', item.description || '', 'text')}
        <div class="grid grid-cols-2 gap-2">
          <div>${selectField('categorie', 'Catégorie', CATEGORIES, item.categorie)}</div>
          <div class="mb-3">
            <label class="block text-xs font-medium text-gray-300 mb-1">Compte</label>
            <div class="flex gap-1.5">
              ${COMPTES.map(c => `
                <label class="flex items-center gap-1 cursor-pointer px-2 py-1.5 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-accent-blue/40 transition has-[:checked]:border-accent-blue has-[:checked]:bg-accent-blue/10">
                  <input type="radio" name="compte" value="${c}" ${c === item.compte ? 'checked' : ''} class="w-3 h-3 text-accent-blue bg-dark-800 border-dark-400 focus:ring-accent-blue/40">
                  <span class="text-[11px] text-gray-200">${c}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      openModal('Modifier l\'opération', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.compte = document.querySelector('input[name="compte"]:checked')?.value || item.compte;
        const newAff = document.querySelector('input[name="affectation"]:checked')?.value || curAff;

        // If switched to revenu → move from suiviDepenses to suiviRevenus
        if (newAff === 'revenu') {
          store.set('suiviDepenses', items.filter(i => i.id !== id));
          const revenus = store.get('suiviRevenus') || [];
          revenus.unshift({ id: item.id, type: 'revenu', date: data.date, description: data.description, montant: data.montant, compte: data.compte, categorie: data.categorie });
          store.set('suiviRevenus', revenus);
        } else {
          // Map affectation to categorie
          if (newAff === 'investissement') data.categorie = 'Investissement';
          else if (newAff === 'virement') data.categorie = 'Virement';
          else if (newAff === 'ndf') data.categorie = 'NDF';
          else if (newAff === 'autre') data.categorie = 'Autre';
          Object.assign(item, data);
          store.set('suiviDepenses', items);
        }
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
        ${affectationField('revenu')}
        <div class="grid grid-cols-2 gap-2">
          <div>${inputField('date', 'Date', rev.date, 'date')}</div>
          <div>${inputField('montant', 'Montant (€)', rev.montant, 'number', 'step="0.01"')}</div>
        </div>
        ${inputField('description', 'Description', rev.description || '', 'text')}
        <div class="grid grid-cols-2 gap-2">
          <div>${selectField('categorie', 'Catégorie', CATEGORIES_REVENUS, rev.categorie)}</div>
          <div class="mb-3">
            <label class="block text-xs font-medium text-gray-300 mb-1">Compte</label>
            <div class="flex gap-1.5">
              ${COMPTES.map(c => `
                <label class="flex items-center gap-1 cursor-pointer px-2 py-1.5 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-green-500/40 transition has-[:checked]:border-green-500 has-[:checked]:bg-green-500/10">
                  <input type="radio" name="compte" value="${c}" ${c === rev.compte ? 'checked' : ''} class="w-3 h-3 text-green-500 bg-dark-800 border-dark-400 focus:ring-green-500/40">
                  <span class="text-[11px] text-gray-200">${c}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      openModal('Modifier l\'opération', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.compte = document.querySelector('input[name="compte"]:checked')?.value || rev.compte;
        const newAff = document.querySelector('input[name="affectation"]:checked')?.value || 'revenu';

        // If switched away from revenu → move to suiviDepenses
        if (newAff !== 'revenu') {
          store.set('suiviRevenus', revenus.filter(r => r.id !== id));
          if (newAff === 'investissement') data.categorie = 'Investissement';
          else if (newAff === 'virement') data.categorie = 'Virement';
          else if (newAff === 'ndf') data.categorie = 'NDF';
          else if (newAff === 'autre') data.categorie = 'Autre';
          const items = store.get('suiviDepenses') || [];
          items.unshift({ id: rev.id, date: data.date, description: data.description, montant: data.montant, compte: data.compte, categorie: data.categorie });
          store.set('suiviDepenses', items);
        } else {
          Object.assign(rev, data);
          store.set('suiviRevenus', revenus);
        }
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

  // Drag-and-drop reorder monthly expenses
  {
    let draggedMcId = null;
    document.querySelectorAll('.mc-drag-row').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        draggedMcId = row.dataset.dragMcId;
        row.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.style.opacity = '';
        document.querySelectorAll('.mc-drag-row').forEach(r => r.classList.remove('drag-over'));
      });
      row.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => { row.classList.remove('drag-over'); });
      row.addEventListener('drop', (e) => {
        e.preventDefault(); row.classList.remove('drag-over');
        const targetId = row.dataset.dragMcId;
        if (!draggedMcId || draggedMcId === targetId) return;
        const list = store.get('depensesMensuellesCIC') || [];
        const fromIdx = list.findIndex(d => d.id === draggedMcId);
        const toIdx = list.findIndex(d => d.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        store.set('depensesMensuellesCIC', list);
        navigate('suivi-depenses');
      });
    });
  }

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

  // --- TR Recurring DCA toggle (unchecked=pending/barré, checked=confirmed/debited) ---
  document.querySelectorAll('[data-tr-dca-recurring]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.trDcaRecurring;
      const monthKey = getCurrentMonthKey();
      const all = store.get('trRecurringConfirmed') || {};
      const month = all[monthKey] || { expenses: [], revenues: [] };
      if (cb.checked) {
        // Checked = confirmed = debited
        if (!month.expenses.includes(id)) month.expenses.push(id);
      } else {
        // Unchecked = back to pending
        month.expenses = month.expenses.filter(x => x !== id);
      }
      all[monthKey] = month;
      store.set('trRecurringConfirmed', all);
      navigate('suivi-depenses');
    });
  });

  // --- TR Recurring Revenue toggle (unchecked=pending/barré, checked=confirmed/credited) ---
  document.querySelectorAll('[data-tr-rev-recurring]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.trRevRecurring;
      const monthKey = getCurrentMonthKey();
      const all = store.get('trRecurringConfirmed') || {};
      const month = all[monthKey] || { expenses: [], revenues: [] };
      if (cb.checked) {
        if (!month.revenues.includes(id)) month.revenues.push(id);
      } else {
        month.revenues = month.revenues.filter(x => x !== id);
      }
      all[monthKey] = month;
      store.set('trRecurringConfirmed', all);
      navigate('suivi-depenses');
    });
  });

  // Edit TR DCA recurring item
  document.querySelectorAll('[data-tr-dca-edit]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.trDcaEdit;
      const list = store.get('dcaMensuelsTR') || [];
      const item = list.find(d => d.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Nom', item.nom)}
        ${inputField('montant', 'Montant (€)', item.montant, 'number', '0.01')}
      `;
      openModal('Modifier le DCA', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        item.nom = data.nom || item.nom;
        item.montant = Number(data.montant) || item.montant;
        store.set('dcaMensuelsTR', list);
        navigate('suivi-depenses');
      });
    });
  });

  // Edit TR Revenue recurring item
  document.querySelectorAll('[data-tr-rev-edit]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.trRevEdit;
      const list = store.get('revenusMensuelsTR') || [];
      const item = list.find(r => r.id === id);
      if (!item) return;
      const body = `
        ${inputField('nom', 'Nom', item.nom)}
        ${inputField('montant', 'Montant (€)', item.montant, 'number', '0.01')}
      `;
      openModal('Modifier le revenu mensuel', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        item.nom = data.nom || item.nom;
        item.montant = Number(data.montant) || item.montant;
        store.set('revenusMensuelsTR', list);
        navigate('suivi-depenses');
      });
    });
  });

  // Delete TR DCA recurring item
  document.querySelectorAll('[data-tr-dca-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.trDcaDel;
      const list = store.get('dcaMensuelsTR') || [];
      store.set('dcaMensuelsTR', list.filter(d => d.id !== id));
      navigate('suivi-depenses');
    });
  });

  // Delete TR Revenue recurring item
  document.querySelectorAll('[data-tr-rev-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.trRevDel;
      const list = store.get('revenusMensuelsTR') || [];
      store.set('revenusMensuelsTR', list.filter(r => r.id !== id));
      navigate('suivi-depenses');
    });
  });

  // Add new TR DCA recurring
  document.getElementById('btn-add-dca-tr')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Nom', '')}
      ${inputField('montant', 'Montant (€)', '', 'number', '0.01')}
    `;
    openModal('Ajouter un DCA mensuel', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.nom || !data.montant) return;
      const list = store.get('dcaMensuelsTR') || [];
      list.push({ id: 'dca-' + Date.now().toString(36), nom: data.nom, montant: Number(data.montant) });
      store.set('dcaMensuelsTR', list);
      navigate('suivi-depenses');
    });
  });

  // Add new TR Revenue recurring
  document.getElementById('btn-add-rev-tr')?.addEventListener('click', () => {
    const body = `
      ${inputField('nom', 'Nom', '')}
      ${inputField('montant', 'Montant (€)', '', 'number', '0.01')}
    `;
    openModal('Ajouter un revenu mensuel', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.nom || !data.montant) return;
      const list = store.get('revenusMensuelsTR') || [];
      list.push({ id: 'rev-' + Date.now().toString(36), nom: data.nom, montant: Number(data.montant) });
      store.set('revenusMensuelsTR', list);
      navigate('suivi-depenses');
    });
  });

  // Drag-and-drop reorder TR DCA recurring
  {
    let draggedId = null;
    document.querySelectorAll('.tr-dca-drag-row').forEach(row => {
      row.addEventListener('dragstart', (e) => { draggedId = row.dataset.dragDcaId; row.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', () => { row.style.opacity = ''; document.querySelectorAll('.tr-dca-drag-row').forEach(r => r.classList.remove('drag-over')); });
      row.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => { row.classList.remove('drag-over'); });
      row.addEventListener('drop', (e) => {
        e.preventDefault(); row.classList.remove('drag-over');
        const targetId = row.dataset.dragDcaId;
        if (!draggedId || draggedId === targetId) return;
        const list = store.get('dcaMensuelsTR') || [];
        const fromIdx = list.findIndex(d => d.id === draggedId);
        const toIdx = list.findIndex(d => d.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        store.set('dcaMensuelsTR', list);
        navigate('suivi-depenses');
      });
    });
  }

  // Drag-and-drop reorder TR Revenue recurring
  {
    let draggedId = null;
    document.querySelectorAll('.tr-rev-drag-row').forEach(row => {
      row.addEventListener('dragstart', (e) => { draggedId = row.dataset.dragRevId; row.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', () => { row.style.opacity = ''; document.querySelectorAll('.tr-rev-drag-row').forEach(r => r.classList.remove('drag-over')); });
      row.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => { row.classList.remove('drag-over'); });
      row.addEventListener('drop', (e) => {
        e.preventDefault(); row.classList.remove('drag-over');
        const targetId = row.dataset.dragRevId;
        if (!draggedId || draggedId === targetId) return;
        const list = store.get('revenusMensuelsTR') || [];
        const fromIdx = list.findIndex(r => r.id === draggedId);
        const toIdx = list.findIndex(r => r.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        store.set('revenusMensuelsTR', list);
        navigate('suivi-depenses');
      });
    });
  }

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
  extraBanks.forEach(bank => setupDragDrop('ops-drop-' + bank.id));

  // Add bank
  document.getElementById('btn-add-bank')?.addEventListener('click', () => {
    const body = inputField('nom', 'Nom de la banque', '', 'text', 'placeholder="Ex: Boursorama"');
    openModal('Ajouter une banque', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      const name = (data.nom || '').trim();
      if (!name) return;
      store.addBank(name);
      navigate('suivi-depenses');
    });
  });

  // Remove bank
  document.querySelectorAll('[data-remove-bank]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bankId = btn.dataset.removeBank;
      const bank = extraBanks.find(b => b.id === bankId);
      if (!bank) return;
      const body = `<p class="text-gray-300 text-sm">Supprimer le compte <span class="font-semibold text-gray-100">${bank.name}</span> et toutes ses opérations ?</p>`;
      openModal('Supprimer la banque', body, () => {
        store.removeBank(bankId);
        navigate('suivi-depenses');
      });
    });
  });

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

  // Add Investissement (shortcut)
  document.getElementById('btn-add-invest')?.addEventListener('click', () => {
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', 'placeholder="Ex: DCA PEA, Achat Bitcoin..."')}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 300"')}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
        <div class="flex gap-3">
          ${COMPTES.map(c => `
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-blue-400/40 transition has-[:checked]:border-blue-400 has-[:checked]:bg-blue-400/10">
              <input type="radio" name="compte" value="${c}" ${c === bankNames.secondary ? 'checked' : ''} class="w-4 h-4 text-blue-400 bg-dark-800 border-dark-400 focus:ring-blue-400/40">
              <span class="text-sm text-gray-200">${c}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    openModal('Ajouter un investissement', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.secondary;
      data.categorie = 'Investissement';
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

  // Archive row click — show past month details
  function showArchiveDetail(mois) {
    const archives = store.get('archiveDepenses') || [];
    const a = archives.find(ar => ar.mois === mois);
    if (!a) return;
    const label = new Date(mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const allOps = (a.operations || []).map(o => ({ ...o, type: 'depense' }));
    const allRevs = (a.revenus || []).map(r => ({ ...r, type: 'revenu' }));
    const allItems = [...allRevs, ...allOps].sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    const cochees = a.cochees || [];
    const depMensuelles = store.get('depensesMensuellesCIC') || [];

    // Group by bank
    const bankGroups = {};
    COMPTES.forEach(c => { bankGroups[c] = []; });
    allItems.forEach(item => {
      const c = item.compte || COMPTES[0];
      if (!bankGroups[c]) bankGroups[c] = [];
      bankGroups[c].push(item);
    });

    const renderArchiveOp = (op) => {
      const isRev = op.type === 'revenu';
      const isVirement = !isRev && (op.categorie || '') === 'Virement';
      const isNDF = !isRev && (op.categorie || '') === 'NDF';
      const isInvest = !isRev && (op.categorie || '') === 'Investissement';
      const isAutre = !isRev && (op.categorie || '') === 'Autre';
      const color = isRev ? 'text-emerald-400' : isInvest ? 'text-blue-400' : isVirement ? 'text-amber-400' : isNDF ? 'text-purple-400' : isAutre ? 'text-gray-400' : 'text-accent-red';
      const icon = isRev
        ? `<svg class="w-3 h-3 ${color} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5m0 0l-5 5m5-5l5 5"/></svg>`
        : `<svg class="w-3 h-3 ${color} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m0 0l5-5m-5 5l-5-5"/></svg>`;
      const sign = isRev ? '+' : '-';
      return `
        <div class="flex items-center justify-between py-px">
          <div class="flex items-center gap-1.5 min-w-0">
            ${icon}
            <span class="text-[10px] text-gray-600 w-12 flex-shrink-0">${(op.date || '').slice(5)}</span>
            <span class="text-[12px] text-gray-200 truncate">${op.description || '—'}</span>
            ${op.categorie ? `<span class="text-[9px] text-gray-600 flex-shrink-0">${op.categorie}</span>` : ''}
          </div>
          <span class="text-[12px] font-medium ${color} ml-2 whitespace-nowrap">${sign}${formatCurrencyCents(Number(op.montant) || 0)}</span>
        </div>`;
    };

    const renderBankCol = (bankName, idx) => {
      const items = bankGroups[bankName] || [];
      const soldeKey = idx === 0 ? 'soldeFinalCIC' : idx === 1 ? 'soldeFinalTR' : null;
      const solde = soldeKey ? a[soldeKey] : a['soldeFinal_' + (extraBanks.find(b => b.name === bankName)?.id || '')];
      const isPrimary = idx === 0;
      const isSecondary = idx === 1;
      const isExtra = idx >= 2;
      const m = a.meta || {};
      const extraBankObj = isExtra ? extraBanks.find(b => b.name === bankName) : null;

      // Build sub-lines
      const subLine = (label, value, color = 'text-gray-400') =>
        `<div class="flex items-center justify-between px-2 py-0.5 bg-dark-700/40 border-b border-dark-400/10">
          <span class="text-[10px] text-gray-500">${label}</span>
          <span class="text-[10px] font-medium ${color}">${formatCurrencyCents(value)}</span>
        </div>`;

      let subLines = '';
      if (isPrimary) {
        subLines = subLine(m.lblSoldeDebutCIC || 'Solde début de mois', m.soldePrevCIC || 0);
        if (m.soldeObligCIC) subLines += subLine(m.lblSoldeObligCIC || 'Solde obligatoire', m.soldeObligCIC, 'text-amber-400');
        ((m.budgetPockets || {}).cic || []).forEach(p => { subLines += subLine(p.label, p.amount); });
      } else if (isSecondary) {
        subLines = subLine(m.lblSoldeDebutTR || 'Solde début de mois', m.soldePrevTR || 0);
        const archPocketsTR = ((m.budgetPockets || {}).tr || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const soldeObligTR = (m.restantInvestTR || 0) + (m.restantPEATR || 0) + (m.budgetNDF || 0) + archPocketsTR;
        if (soldeObligTR) subLines += subLine(m.lblSoldeObligTR || 'Solde obligatoire fin de mois', soldeObligTR, 'text-accent-red');
        if (m.restantInvestTR) subLines += subLine(m.lblRestantInvest || 'Pocket 1', m.restantInvestTR);
        if (m.restantPEATR) subLines += subLine(m.lblRestantPEA || 'Pocket 2', m.restantPEATR);
        if (m.budgetNDF) subLines += subLine(m.lblNDF || 'Pocket 3', m.budgetNDF, 'text-purple-400');
        if (m.budgetQuotidien) subLines += subLine(m.lblEnveloppe || 'Pocket 4', m.budgetQuotidien);
        ((m.budgetPockets || {}).tr || []).forEach(p => { subLines += subLine(p.label, p.amount); });
      } else if (isExtra && extraBankObj) {
        const prevExtra = (m.extraPrev || {})[extraBankObj.id] || 0;
        const obligExtra = (m.extraOblig || {})[extraBankObj.id] || 0;
        subLines = subLine('Solde début de mois', prevExtra)
                 + subLine('Solde obligatoire', obligExtra, 'text-amber-400');
      }

      // TR features
      let trFeatHtml = '';
      if (isSecondary && m.trInterets !== undefined) {
        trFeatHtml = `
          <div class="border-t border-dark-400/20 mt-1 pt-0.5">
            ${subLine(m.lblInterets || 'Intérêts', m.trInterets || 0, 'text-emerald-400')}
            ${subLine(m.lblSaveback || 'Saveback', m.trSaveback || 0, 'text-accent-amber')}
            ${subLine(m.lblRoundup || 'Round-up', m.trRoundup || 0, 'text-accent-red')}
          </div>`;
      }

      // Mensuelles cochées (primary bank)
      const archDepMensuelles = a.depMensuelles || depMensuelles;
      let mensuellesHtml = '';
      if (isPrimary && archDepMensuelles.length > 0) {
        const totalCochees = archDepMensuelles.filter(d => cochees.includes(d.id)).reduce((s, d) => s + d.montant, 0);
        mensuellesHtml = `
          <div class="border-t border-dark-400/20 mt-1 pt-1">
            <div class="flex items-center justify-between mb-0.5 px-1">
              <span class="text-[10px] text-gray-500 font-medium">Dépenses mensuelles ${cochees.length}/${archDepMensuelles.length}</span>
              <span class="text-[11px] font-medium text-accent-red">${formatCurrencyCents(totalCochees)}</span>
            </div>
            ${archDepMensuelles.map(d => {
              const checked = cochees.includes(d.id);
              return `
              <div class="flex items-center justify-between py-px pl-3 pr-1">
                <span class="text-[10px] ${checked ? 'text-gray-500 line-through' : 'text-gray-400'}">${d.nom}</span>
                <span class="text-[10px] text-gray-600">${formatCurrencyCents(d.montant)}</span>
              </div>`;
            }).join('')}
          </div>`;
      }

      return `
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-gray-300">${bankName}</span>
            <span class="text-sm font-bold text-gray-100">${solde !== undefined ? formatCurrencyCents(solde) : '—'}</span>
          </div>
          ${subLines}
          <div class="mt-1 space-y-0">
            ${items.map(renderArchiveOp).join('')}
            ${items.length === 0 ? '<p class="text-[10px] text-gray-600 py-1">Aucune opération</p>' : ''}
          </div>
          ${trFeatHtml}
          ${mensuellesHtml}
        </div>`;
    };

    // Custom wide modal (bypass openModal which is max-w-lg)
    const existing = document.getElementById('app-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'app-modal';
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-dark-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-dark-400/50 flex flex-col">
        <div class="px-6 py-4 border-b border-dark-400/50 flex items-center justify-between flex-shrink-0">
          <h3 class="text-lg font-semibold text-gray-100 capitalize">${label}</h3>
          <button id="modal-close-x" class="text-gray-400 hover:text-gray-100 transition text-2xl leading-none px-1">&times;</button>
        </div>
        <div class="overflow-x-auto overflow-y-auto flex-1 p-5">
          <div class="grid grid-cols-${COMPTES.length} gap-5" style="min-width: ${COMPTES.length * 280}px;">
            ${COMPTES.map((c, i) => renderBankCol(c, i)).join('')}
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#modal-close-x').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  document.querySelectorAll('.archive-row').forEach(row => {
    row.addEventListener('click', () => showArchiveDetail(row.dataset.mois));
  });
}
