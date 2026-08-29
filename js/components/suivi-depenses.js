import { formatCurrencyCents, formatDate, openModal, inputField, selectField, getFormData, confirmModal, promptModal, showToast, showModalError } from '../utils.js?v=20260809m';

const DEFAULT_CATEGORIES = [
  'Alimentation', 'Achats divers', 'Santé', 'Vêtements',
  'Loisirs - Plaisirs', 'Petits travaux', 'Virement', 'NDF', 'Investissement', 'Autre - Imprévu'
];

const DEFAULT_CATEGORIES_REVENUS = [
  'Salaire', 'Prime', 'Apport', 'Dividendes',
  'Remboursement', 'Vente', 'Autre'
];

// User-editable categories (stored in customCategories.{depenses,revenus})
function getCategories(store, type) {
  const cc = store.get('customCategories') || {};
  const list = cc[type];
  if (Array.isArray(list) && list.length > 0) return list;
  return type === 'revenus' ? DEFAULT_CATEGORIES_REVENUS : DEFAULT_CATEGORIES;
}

function saveCategories(store, type, list) {
  const cc = store.get('customCategories') || {};
  cc[type] = list;
  store.set('customCategories', cc);
}

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

// ---- Saveback Trade Republic : 1 % des dépenses CB sur TR, plafonné/mois, OFFERT (jamais déduit du solde) ----
const SAVEBACK_TAUX = 0.01;
const SAVEBACK_PLAFOND_MOIS = 15;

const MOYENS_PAIEMENT = [
  { value: 'cb', label: '💳 CB' },
  { value: 'prelevement', label: '🏦 Prélèvement' },
  { value: 'cheque', label: '🖋 Chèque' },
  { value: 'virement', label: '↔ Virement' },
  { value: 'investissement', label: '📈 Investissement' },
];

// Crédits Saveback / Round-up d'une ligne récurrente cochée (mémorisés dans trRecurringConfirmed[mois].sbCredits)
function crediterLigneRecurrente(store, month, id, item) {
  if (!item || item.paiement !== 'cb') return;
  const sb = crediterSaveback(store, item.montant);
  const ru = crediterRoundup(store, item.montant);
  if (sb > 0 || ru > 0) { month.sbCredits = month.sbCredits || {}; month.sbCredits[id] = { sb, ru }; }
}

function annulerLigneRecurrente(store, month, id) {
  const cr = month?.sbCredits?.[id];
  if (!cr) return;
  annulerSaveback(store, cr.sb);
  annulerRoundup(store, cr.ru);
  delete month.sbCredits[id];
}

function paiementFieldHtml(selected = 'cb') {
  return `
  <div class="mb-4">
    <label class="block text-sm font-medium text-gray-300 mb-1.5">Moyen de paiement</label>
    <div class="flex gap-2 flex-wrap">
      ${MOYENS_PAIEMENT.map(m => `
        <label class="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-accent-blue/40 transition has-[:checked]:border-accent-blue has-[:checked]:bg-accent-blue/10">
          <input type="radio" name="paiement" value="${m.value}" ${m.value === selected ? 'checked' : ''} class="w-3.5 h-3.5 text-accent-blue bg-dark-800 border-dark-400 focus:ring-accent-blue/40">
          <span class="text-xs text-gray-200">${m.label}</span>
        </label>`).join('')}
    </div>
  </div>`;
}

const savebackEligible = (paiement, compte, trName) => paiement === 'cb' && compte === trName;

// Crédite le Saveback pour une dépense CB sur Trade Republic ; retourne le montant réellement crédité (plafond respecté)
function crediterSaveback(store, montantDepense) {
  const trF = store.get('trFeatures') || {};
  const actuel = Number(trF.saveback) || 0;
  const brut = Math.round((Number(montantDepense) || 0) * SAVEBACK_TAUX * 100) / 100;
  const credit = Math.round(Math.min(brut, Math.max(0, SAVEBACK_PLAFOND_MOIS - actuel)) * 100) / 100;
  if (credit <= 0) return 0;
  trF.saveback = Math.round((actuel + credit) * 100) / 100;
  store.set('trFeatures', trF);
  return credit;
}

// Annule un crédit Saveback (suppression ou modification d'une dépense CB)
function annulerSaveback(store, credit) {
  if (!(Number(credit) > 0)) return;
  const trF = store.get('trFeatures') || {};
  trF.saveback = Math.max(0, Math.round(((Number(trF.saveback) || 0) - Number(credit)) * 100) / 100);
  store.set('trFeatures', trF);
}

// ---- Round-up Trade Republic : complément à l'euro supérieur sur les dépenses CB, boosté, DÉBITÉ du solde ----
const ROUNDUP_BOOSTS = [1, 2, 3, 4, 5, 10];

// 1,50 € → 0,50 € ; subtilité : une dépense « ronde » (10 €) investit quand même 1 €. Le tout × boost.
function calcRoundup(montant, boost) {
  const cents = Math.round((Number(montant) || 0) * 100);
  if (cents <= 0) return 0;
  const reste = cents % 100 === 0 ? 100 : 100 - (cents % 100);
  return Math.round(reste * (Number(boost) || 1)) / 100;
}

function crediterRoundup(store, montantDepense) {
  const trF = store.get('trFeatures') || {};
  if (trF.roundupActif === false) return 0;
  const credit = calcRoundup(montantDepense, trF.roundupBoost);
  if (credit <= 0) return 0;
  trF.roundup = Math.round(((Number(trF.roundup) || 0) + credit) * 100) / 100;
  store.set('trFeatures', trF);
  return credit;
}

function annulerRoundup(store, credit) {
  if (!(Number(credit) > 0)) return;
  const trF = store.get('trFeatures') || {};
  trF.roundup = Math.max(0, Math.round(((Number(trF.roundup) || 0) - Number(credit)) * 100) / 100);
  store.set('trFeatures', trF);
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

// Catégorie select + inline manager (add/rename/delete), type = 'depenses' | 'revenus'
function categorieFieldHtml(store, type, selected = '') {
  let cats = getCategories(store, type);
  // Keep the current value visible even if it was removed from the list
  if (selected && !cats.includes(selected)) cats = [selected, ...cats];
  return `
    <div class="mb-4" data-cat-field="${type}">
      <div class="flex items-center justify-between mb-1.5">
        <label for="field-categorie" class="block text-sm font-medium text-gray-300">Catégorie</label>
        <button type="button" data-cat-manage class="text-[11px] text-gray-500 hover:text-accent-blue transition">✎ Gérer</button>
      </div>
      <select name="categorie" id="field-categorie"
        class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200
        focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
        ${cats.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <div data-cat-panel class="hidden mt-2 p-2.5 bg-dark-800/60 border border-dark-400/30 rounded-lg">
        <div data-cat-list class="space-y-1 mb-2"></div>
        <div class="flex gap-1.5">
          <input type="text" data-cat-new placeholder="Nouvelle catégorie" class="flex-1 px-2 py-1 bg-dark-900 border border-dark-400/40 rounded text-xs text-gray-200 focus:ring-1 focus:ring-accent-blue/40">
          <button type="button" data-cat-add class="px-2.5 py-1 bg-accent-blue/20 text-accent-blue text-xs rounded hover:bg-accent-blue/30 transition">Ajouter</button>
        </div>
      </div>
    </div>`;
}

function wireCategoryManager(modal, store, type) {
  const field = modal.querySelector(`[data-cat-field="${type}"]`);
  if (!field) return;
  const select = field.querySelector('select[name="categorie"]');
  const panel = field.querySelector('[data-cat-panel]');
  const listEl = field.querySelector('[data-cat-list]');
  const newInput = field.querySelector('[data-cat-new]');

  const rebuildSelect = () => {
    const current = select.value;
    const cats = getCategories(store, type);
    select.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    if (cats.includes(current)) select.value = current;
  };

  const rebuildList = () => {
    const cats = getCategories(store, type);
    listEl.innerHTML = cats.map((c, i) => `
      <div class="flex items-center gap-1.5">
        <span class="flex-1 text-xs text-gray-300 truncate">${c}</span>
        <button type="button" data-cat-rename="${i}" class="text-gray-500 hover:text-accent-blue text-[11px] px-1 transition" title="Renommer">✎</button>
        <button type="button" data-cat-del="${i}" class="text-gray-500 hover:text-accent-red text-[11px] px-1 transition" title="Supprimer">✕</button>
      </div>`).join('');
    listEl.querySelectorAll('[data-cat-rename]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cats = [...getCategories(store, type)];
        const idx = Number(btn.dataset.catRename);
        const oldName = cats[idx];
        promptModal('Renommer la catégorie', oldName, (newName) => {
          if (newName === oldName) return;
          cats[idx] = newName;
          saveCategories(store, type, cats);
          // Update current-month operations using the old name
          const opsKey = type === 'revenus' ? 'suiviRevenus' : 'suiviDepenses';
          const ops = store.get(opsKey) || [];
          let touched = false;
          ops.forEach(op => { if (op.categorie === oldName) { op.categorie = newName; touched = true; } });
          if (touched) store.set(opsKey, ops);
          rebuildSelect(); rebuildList();
        });
      });
    });
    listEl.querySelectorAll('[data-cat-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cats = [...getCategories(store, type)];
        const idx = Number(btn.dataset.catDel);
        if (cats.length <= 1) { showToast('Il faut garder au moins une catégorie.', 'warning', 4000); return; }
        confirmModal(`Supprimer la catégorie « ${cats[idx]} » ?`, 'Les opérations existantes la conservent.', () => {
          cats.splice(idx, 1);
          saveCategories(store, type, cats);
          rebuildSelect(); rebuildList();
        });
      });
    });
  };

  field.querySelector('[data-cat-manage]')?.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) rebuildList();
  });

  field.querySelector('[data-cat-add]')?.addEventListener('click', () => {
    const name = (newInput.value || '').trim();
    if (!name) return;
    const cats = [...getCategories(store, type)];
    if (cats.includes(name)) { showToast('Cette catégorie existe déjà.', 'warning', 4000); return; }
    cats.push(name);
    saveCategories(store, type, cats);
    newInput.value = '';
    rebuildSelect(); rebuildList();
    select.value = name;
  });
  newInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); field.querySelector('[data-cat-add]')?.click(); }
  });
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

// Référence au store, posée par render()/mount(), pour calculer le mois de travail effectif
let _activeStore = null;

// Mois de travail effectif : si le mois calendaire est déjà clôturé (clôture anticipée le 29 par ex.),
// on travaille sur le mois suivant — les coches repartent à zéro sur une clé vierge, sans double comptage.
function getCurrentMonthKey() {
  const now = new Date();
  let d = new Date(now.getFullYear(), now.getMonth(), 1);
  let key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const archives = _activeStore?.get('archiveDepenses') || [];
  let garde = 0;
  while (archives.some(a => a.mois === key) && garde < 24) {
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    garde++;
  }
  return key;
}

// Mois précédent relatif au mois de travail effectif (et non au calendrier)
function getPreviousMonthKey() {
  const [y, m] = getCurrentMonthKey().split('-').map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

const POCKET_COLORS = [
  { name: 'gray',    bg: 'bg-dark-600/40',       border: 'border-dark-400/20',     text: 'text-gray-400',    dot: '#9ca3af' },
  { name: 'blue',    bg: 'bg-blue-500/10',       border: 'border-blue-500/20',     text: 'text-blue-400',    dot: '#60a5fa' },
  { name: 'emerald', bg: 'bg-emerald-500/10',    border: 'border-emerald-500/20',  text: 'text-emerald-400', dot: '#34d399' },
  { name: 'amber',   bg: 'bg-amber-500/10',      border: 'border-amber-500/20',    text: 'text-amber-400',   dot: '#fbbf24' },
  { name: 'red',     bg: 'bg-red-500/10',        border: 'border-red-500/20',      text: 'text-red-400',     dot: '#f87171' },
  { name: 'purple',  bg: 'bg-purple-500/10',     border: 'border-purple-500/20',   text: 'text-purple-400',  dot: '#c084fc' },
  { name: 'orange',  bg: 'bg-orange-500/10',     border: 'border-orange-500/20',   text: 'text-orange-400',  dot: '#fb923c' },
  { name: 'cyan',    bg: 'bg-cyan-500/10',       border: 'border-cyan-500/20',     text: 'text-cyan-400',    dot: '#22d3ee' },
  { name: 'pink',    bg: 'bg-pink-500/10',       border: 'border-pink-500/20',     text: 'text-pink-400',    dot: '#f472b6' },
  { name: 'yellow',  bg: 'bg-yellow-500/10',     border: 'border-yellow-500/20',   text: 'text-yellow-400',  dot: '#facc15' },
];

function getPocketColor(name) {
  return POCKET_COLORS.find(c => c.name === name) || POCKET_COLORS[0];
}

function colorPickerHtml(label, fieldName, selected) {
  return `<div class="mb-3">
    <label class="block text-xs font-medium text-gray-300 mb-1.5">${label}</label>
    <div class="flex gap-2 flex-wrap">
      ${POCKET_COLORS.map(c => `
        <label class="cursor-pointer">
          <input type="radio" name="${fieldName}" value="${c.name}" ${c.name === selected ? 'checked' : ''} class="sr-only peer">
          <div class="w-6 h-6 rounded-full border-2 peer-checked:border-white border-transparent transition" style="background:${c.dot}"></div>
        </label>
      `).join('')}
    </div>
  </div>`;
}

function obligatoireCheckboxHtml(checked) {
  return `<div class="mb-3 flex items-center gap-2"><input type="checkbox" name="obligatoire" id="field-obligatoire" ${checked ? 'checked' : ''} class="w-4 h-4 rounded bg-dark-800 border-dark-400/50 text-amber-500 focus:ring-amber-500/40"><label for="field-obligatoire" class="text-xs text-gray-300">Inclure dans le solde obligatoire</label></div>`;
}

function getBankPockets(store, bankNames, bankName) {
  const pockets = [];
  const allPockets = store.get('budgetPockets') || {};
  const labels = store.get('customLabels') || {};
  const extraBanks = bankNames.extra || [];

  if (bankName === bankNames.primary) {
    const soldeObligatoire = store.get('soldeObligatoire') || {};
    if ('cic' in soldeObligatoire) {
      pockets.push({ id: 'oblig-cic', label: labels.soldeObligatoire_cic || 'Solde obligatoire' });
    }
    (allPockets.cic || []).forEach(p => pockets.push({ id: p.id, label: p.label }));
  } else if (bankName === bankNames.secondary) {
    const parametres = store.get('parametres') || {};
    const restantInvest = store.get('restantInvestissement') || {};
    const restantPEA = store.get('restantPEA') || {};
    if ('budgetQuotidien' in parametres) pockets.push({ id: 'quotidien', label: labels.enveloppeQuotidien || 'Pocket Quotidien' });
    if ('budgetNDF' in parametres) pockets.push({ id: 'ndf', label: labels.aRecupererNDF || 'Pocket NDF' });
    if ('tr' in restantPEA) pockets.push({ id: 'pea', label: labels.restantPEA || 'Pocket PEA' });
    if ('tr' in restantInvest) pockets.push({ id: 'invest', label: labels.restantInvestissement || 'Pocket Invest' });
    (allPockets.tr || []).forEach(p => pockets.push({ id: p.id, label: p.label }));
  } else {
    const bank = extraBanks.find(b => b.name === bankName);
    if (bank) {
      const soldeObligatoire = store.get('soldeObligatoire') || {};
      if (bank.id in soldeObligatoire) {
        pockets.push({ id: `oblig-${bank.id}`, label: labels[`soldeObligatoire_${bank.id}`] || 'Solde obligatoire' });
      }
      (allPockets[bank.id] || []).forEach(p => pockets.push({ id: p.id, label: p.label }));
    }
  }
  return pockets;
}

function deductFromPocket(store, bankNames, bankName, pocketId, amount) {
  if (!pocketId || pocketId === 'aucun') return;
  const amt = Number(amount) || 0;
  if (amt === 0) return;

  if (bankName === bankNames.primary) {
    if (pocketId === 'oblig-cic') {
      const oblig = store.get('soldeObligatoire') || {};
      oblig.cic = (Number(oblig.cic) || 0) - amt;
      store.set('soldeObligatoire', oblig);
    } else {
      const ap = store.get('budgetPockets') || {};
      const p = (ap.cic || []).find(x => x.id === pocketId);
      if (p) { p.amount = (Number(p.amount) || 0) - amt; store.set('budgetPockets', ap); }
    }
  } else if (bankName === bankNames.secondary) {
    if (pocketId === 'quotidien') {
      const params = store.get('parametres') || {};
      params.budgetQuotidien = (Number(params.budgetQuotidien) || 0) - amt;
      store.set('parametres', params);
    } else if (pocketId === 'ndf') {
      const params = store.get('parametres') || {};
      params.budgetNDF = (Number(params.budgetNDF) || 0) - amt;
      store.set('parametres', params);
    } else if (pocketId === 'pea') {
      const pea = store.get('restantPEA') || {};
      pea.tr = (Number(pea.tr) || 0) - amt;
      store.set('restantPEA', pea);
    } else if (pocketId === 'invest') {
      const inv = store.get('restantInvestissement') || {};
      inv.tr = (Number(inv.tr) || 0) - amt;
      store.set('restantInvestissement', inv);
    } else {
      const ap = store.get('budgetPockets') || {};
      const p = (ap.tr || []).find(x => x.id === pocketId);
      if (p) { p.amount = (Number(p.amount) || 0) - amt; store.set('budgetPockets', ap); }
    }
  } else {
    const bank = (bankNames.extra || []).find(b => b.name === bankName);
    if (!bank) return;
    if (pocketId === `oblig-${bank.id}`) {
      const oblig = store.get('soldeObligatoire') || {};
      oblig[bank.id] = (Number(oblig[bank.id]) || 0) - amt;
      store.set('soldeObligatoire', oblig);
    } else {
      const ap = store.get('budgetPockets') || {};
      const p = (ap[bank.id] || []).find(x => x.id === pocketId);
      if (p) { p.amount = (Number(p.amount) || 0) - amt; store.set('budgetPockets', ap); }
    }
  }
}

function pocketSelectHtml(pockets, selected = 'aucun', label = 'Déduire du pocket') {
  const opts = pockets.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${p.label}</option>`).join('');
  return `
    <div class="mb-4" id="pocket-selector-wrap">
      <label class="block text-sm font-medium text-gray-300 mb-1.5">${label}</label>
      <select name="pocket" id="pocket-select"
        class="w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200
        focus:ring-2 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition">
        <option value="aucun">Aucun</option>
        ${opts}
      </select>
    </div>`;
}

function setupPocketBankSync(store, bankNames) {
  const radios = document.querySelectorAll('#modal-body input[name="compte"]');
  radios.forEach(r => {
    r.addEventListener('change', () => {
      const sel = document.getElementById('pocket-select');
      if (!sel) return;
      const pockets = getBankPockets(store, bankNames, r.value);
      sel.innerHTML = '<option value="aucun">Aucun</option>' + pockets.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
    });
  });
}

const DEPENSES_MENSUELLES_CIC = [];

// Recurring DCA/Invest expenses for TR (checked=pending, unchecked=debited)
const DCA_MENSUELS_TR = [];

// Recurring revenues for TR (checked=pending, unchecked=credited)
const REVENUS_MENSUELS_TR = [];


export function render(store) {
  _activeStore = store;
  const bankNames = store.getBankNames();
  const extraBanks = bankNames.extra || [];
  const COMPTES = [bankNames.secondary, bankNames.primary, ...extraBanks.map(b => b.name)];
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
  const prelevTR = store.get('prelevementsTR') || [];

  // Section names & collapsed state
  const sectionNames = store.get('sectionNames') || {};
  const sectionCollapsed = store.get('sectionCollapsed') || {};
  const secNameDep = sectionNames.depMensuelles || 'Dépenses mensuelles';
  const secNameDca = sectionNames.dcaTR || 'DCA & Investissements';
  const secNameRev = sectionNames.revMensuels || 'Apports mensuels';
  const secNamePrelev = sectionNames.prelevTR || 'Abonnements';
  const secCollDep = !!sectionCollapsed.depMensuelles;
  const secCollDca = !!sectionCollapsed.dcaTR;
  const secCollRev = !!sectionCollapsed.revMensuels;
  const secCollPrelev = !!sectionCollapsed.prelevTR;

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

  // A récupérer NDF = running balance (adjusted by deductFromPocket)
  const paramètres = store.get('parametres') || {};
  const budgetNDF = paramètres.budgetNDF !== undefined ? Number(paramètres.budgetNDF) : (store.get('budgetNDF') !== undefined ? Number(store.get('budgetNDF')) : 0);

  // Budget quotidien (moved up so soldeObligTR can use it)
  const budgetQuotidien = paramètres.budgetQuotidien !== undefined ? Number(paramètres.budgetQuotidien) : (store.get('budgetQuotidien') !== undefined ? Number(store.get('budgetQuotidien')) : 0);

  // Dynamic custom pockets (unlimited)
  const allPockets = store.get('budgetPockets') || {};
  const pocketsTR = allPockets.tr || [];
  const pocketsCIC = allPockets.cic || [];
  const pocketsTRTotal = pocketsTR.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pocketsTROblig = pocketsTR.filter(p => p.obligatoire !== false).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const pocketsCICTotal = pocketsCIC.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const hasRestantInvest = 'tr' in restantInvest;
  const hasRestantPEA = 'tr' in restantPEA;
  const hasBudgetNDF = budgetNDF > 0 || 'budgetNDF' in paramètres;
  const hasBudgetQuotidien = budgetQuotidien > 0 || 'budgetQuotidien' in paramètres;
  const hasSoldeObligCIC = soldeObligCIC > 0 || 'cic' in soldeObligatoire;

  // Pocket colors
  const pocketColorsStore = store.get('pocketColors') || {};

  const pocketOblig = store.get('pocketObligatoire') || {};
  const soldeObligTR = (pocketOblig.ndf !== false && hasBudgetNDF ? budgetNDF : 0)
    + (pocketOblig.quotidien === true && hasBudgetQuotidien ? budgetQuotidien : 0)
    + (pocketOblig.pea === true && hasRestantPEA ? restantPEATR : 0)
    + (pocketOblig.invest === true && hasRestantInvest ? restantInvestTR : 0)
    + pocketsTROblig;

  // Monthly checklist state
  const monthKey = getCurrentMonthKey();
  const closedArchives = store.get('archiveDepenses') || [];
  const monthIsClosed = closedArchives.some(a => a.mois === monthKey);
  const prevMonthKey = getPreviousMonthKey();
  const prevMonthIsClosed = closedArchives.some(a => a.mois === prevMonthKey);
  // Previous month left unclosed: ops dated in a past month, or checkboxes recorded for prev month
  const allCochees = store.get('cicMensuellesCochees') || {};
  const allTrConfirmed = store.get('trRecurringConfirmed') || {};
  const prevTrConf = allTrConfirmed[prevMonthKey] || {};
  const hasPrevMonthData =
    items.some(i => (i.date || '').slice(0, 7) <= prevMonthKey) ||
    revenus.some(r => (r.date || '').slice(0, 7) <= prevMonthKey) ||
    (allCochees[prevMonthKey] || []).length > 0 ||
    (prevTrConf.expenses || []).length > 0 ||
    (prevTrConf.revenues || []).length > 0 ||
    (prevTrConf.prelevements || []).length > 0;
  const needsPrevMonthClosure = !prevMonthIsClosed && hasPrevMonthData;
  const cicCochees = store.get('cicMensuellesCochees') || {};
  const cocheesThisMonth = cicCochees[monthKey] || [];
  // Prev-month unclosed: its coches still count in the live solde until closure
  const prevCocheesIds = prevMonthIsClosed ? [] : (allCochees[prevMonthKey] || []);
  const totalCocheesPrev = depMensuelles
    .filter(d => prevCocheesIds.includes(d.id))
    .reduce((s, d) => s + d.montant, 0);
  const totalCochees = (monthIsClosed ? 0 : depMensuelles
    .filter(d => cocheesThisMonth.includes(d.id))
    .reduce((s, d) => s + d.montant, 0)) + totalCocheesPrev;

  // TR recurring state: confirmed (unchecked) items are counted in balance
  const trConfirmed = store.get('trRecurringConfirmed') || {};
  const trConfirmedThisMonth = trConfirmed[monthKey] || { expenses: [], revenues: [] };
  const confirmedDcaIds = trConfirmedThisMonth.expenses || [];
  const confirmedRevIds = trConfirmedThisMonth.revenues || [];
  const confirmedPrelevIds = trConfirmedThisMonth.prelevements || [];
  const prevConf = prevMonthIsClosed ? {} : (allTrConfirmed[prevMonthKey] || {});
  const prevDcaIds = prevConf.expenses || [];
  const prevRevIds = prevConf.revenues || [];
  const prevPrelevIds = prevConf.prelevements || [];
  const totalDcaConfirmed = (monthIsClosed ? 0 : dcaTR
    .filter(d => confirmedDcaIds.includes(d.id))
    .reduce((s, d) => s + d.montant, 0))
    + dcaTR.filter(d => prevDcaIds.includes(d.id)).reduce((s, d) => s + d.montant, 0);
  const totalRevConfirmed = (monthIsClosed ? 0 : revMensuelsTR
    .filter(r => confirmedRevIds.includes(r.id))
    .reduce((s, r) => s + r.montant, 0))
    + revMensuelsTR.filter(r => prevRevIds.includes(r.id)).reduce((s, r) => s + r.montant, 0);
  const totalPrelevConfirmed = (monthIsClosed ? 0 : prelevTR
    .filter(p => confirmedPrelevIds.includes(p.id))
    .reduce((s, p) => s + (Number(p.montant) || 0), 0))
    + prelevTR.filter(p => prevPrelevIds.includes(p.id)).reduce((s, p) => s + (Number(p.montant) || 0), 0);

  // Compute live solde = base + revenus - depenses - checked monthly
  const revCIC = revenus.filter(r => r.compte === bankNames.primary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depCIC = items.filter(i => i.compte === bankNames.primary).reduce((s, i) => s + (Number(i.montant) || 0), 0);
  const soldeCIC = baseSoldeCIC + soldePrevCIC + revCIC - depCIC - totalCochees;

  const revTR = revenus.filter(r => r.compte === bankNames.secondary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depTR = items.filter(i => i.compte === bankNames.secondary).reduce((s, i) => s + (Number(i.montant) || 0), 0);

  // Trade Republic features (editable values)
  const trFeatures = store.get('trFeatures') || {};
  const trInterets = Number(trFeatures.interets) || 0;
  const lblInterets = trFeatures.lblInterets || 'Intérêts (2%/an)';
  const trSaveback = Number(trFeatures.saveback) || 0;
  const lblSaveback = trFeatures.lblSaveback || 'Saveback 1% → Bitcoin';
  const trRoundup = Number(trFeatures.roundup) || 0;
  const lblRoundup = trFeatures.lblRoundup || 'Round-up → CTO';

  const soldeTR = baseSoldeTR + soldePrevTR + revTR + trInterets - depTR - trRoundup - totalDcaConfirmed + totalRevConfirmed - totalPrelevConfirmed;

  // Build unified TR pocket items for ordered rendering
  const pocketOrderTR = store.get('pocketOrderTR') || [];
  const trPocketItems = [];
  if (trFeatures.lblSaveback || trSaveback > 0) trPocketItems.push({ id: 'saveback', label: lblSaveback, amount: trSaveback, prefix: '', editAttr: 'data-edit-tr-feature="saveback"', delKey: 'feat-saveback', defaultBg: 'amber', defaultText: 'amber' });
  if (trFeatures.lblRoundup || trRoundup > 0) trPocketItems.push({ id: 'roundup', label: lblRoundup, amount: trRoundup, prefix: '-', editAttr: 'data-edit-tr-feature="roundup"', delKey: 'feat-roundup', defaultBg: 'red', defaultText: 'red' });
  if (trFeatures.lblInterets || trInterets > 0) trPocketItems.push({ id: 'interets', label: lblInterets, amount: trInterets, prefix: '+', editAttr: 'data-edit-tr-feature="interets"', delKey: 'feat-interets', defaultBg: 'emerald', defaultText: 'emerald' });
  if (hasBudgetQuotidien) trPocketItems.push({ id: 'quotidien', label: lblEnveloppe, amount: budgetQuotidien, prefix: '', editAttr: 'data-edit-budget-quotidien', delKey: 'quotidien', defaultBg: 'gray', defaultText: budgetQuotidien >= 0 ? 'emerald' : 'red' });
  if (hasBudgetNDF) trPocketItems.push({ id: 'ndf', label: lblNDF, amount: budgetNDF, prefix: '', editAttr: 'data-edit-budget-ndf', delKey: 'ndf', defaultBg: 'gray', defaultText: 'purple' });
  if (hasRestantPEA) trPocketItems.push({ id: 'pea', label: lblRestantPEA, amount: restantPEATR, prefix: '', editAttr: 'data-edit-restant-pea', delKey: 'pea', defaultBg: 'gray', defaultText: 'blue' });
  pocketsTR.forEach(p => trPocketItems.push({ id: p.id, label: p.label, amount: p.amount, prefix: '', editAttr: `data-edit-pocket="${p.id}" data-pocket-bank="tr"`, delKey: null, delPocket: p.id, defaultBg: 'gray', defaultText: 'blue' }));
  if (hasRestantInvest) trPocketItems.push({ id: 'invest', label: lblRestantInvest, amount: restantInvestTR, prefix: '', editAttr: 'data-edit-restant-invest', delKey: 'invest', defaultBg: 'gray', defaultText: 'blue' });

  // Sort by stored order
  if (pocketOrderTR.length > 0) {
    trPocketItems.sort((a, b) => {
      const ia = pocketOrderTR.indexOf(a.id);
      const ib = pocketOrderTR.indexOf(b.id);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }

  // Build CIC pocket items for ordered rendering
  const pocketOrderCIC = store.get('pocketOrderCIC') || [];
  const cicPocketItems = [];
  if (hasSoldeObligCIC) cicPocketItems.push({ id: 'oblig-cic', label: lblSoldeObligCIC, amount: soldeObligCIC, editAttr: 'data-edit-oblig="cic"', delKey: 'oblig-cic', defaultBg: 'gray', defaultText: 'amber' });
  pocketsCIC.forEach(p => cicPocketItems.push({ id: p.id, label: p.label, amount: p.amount, editAttr: `data-edit-pocket="${p.id}" data-pocket-bank="cic"`, delKey: null, delPocket: p.id, defaultBg: 'gray', defaultText: 'blue' }));
  if (pocketOrderCIC.length > 0) {
    cicPocketItems.sort((a, b) => {
      const ia = pocketOrderCIC.indexOf(a.id);
      const ib = pocketOrderCIC.indexOf(b.id);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }

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
    const orderKey = 'pocketOrder_' + bank.id;
    const bankOrder = store.get(orderKey) || [];
    const bankPocketItems = [];
    if (obligSolde > 0 || soldeObligatoire[bank.id] !== undefined) bankPocketItems.push({ id: 'oblig-' + bank.id, label: lblOblig, amount: obligSolde, editAttr: `data-edit-oblig="${bank.id}"`, delKey: 'oblig-' + bank.id, defaultBg: 'gray', defaultText: 'amber' });
    (allPockets[bank.id] || []).forEach(p => bankPocketItems.push({ id: p.id, label: p.label, amount: p.amount, editAttr: `data-edit-pocket="${p.id}" data-pocket-bank="${bank.id}"`, delKey: null, delPocket: p.id, defaultBg: 'gray', defaultText: 'blue' }));
    if (bankOrder.length > 0) {
      bankPocketItems.sort((a, b) => {
        const ia = bankOrder.indexOf(a.id);
        const ib = bankOrder.indexOf(b.id);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }
    return { ...bank, ccId, baseSolde, prevSolde, obligSolde, solde, ops, lblPrev, lblOblig, pocketItems: bankPocketItems };
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
          <span class="text-[11px] text-gray-200 truncate">${op.description || '—'}</span>
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
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 class="text-xl sm:text-2xl font-bold text-gray-100 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            Vie quotidienne
          </h2>
          <p class="text-gray-500 text-sm mt-1">Suivi de tes opérations bancaires au quotidien</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button id="btn-add-revenu" class="btn-secondary"><span class="btn-dot" style="background:#34d399"></span><span class="text-emerald-400 font-bold">+</span> Revenu</button>
          <button id="btn-add-expense" class="btn-secondary"><span class="btn-dot" style="background:rgb(var(--accent-red))"></span><span class="text-red-400 font-bold">−</span> Dépense</button>
          <button id="btn-add-virement" class="btn-secondary"><span class="btn-dot" style="background:#fbbf24"></span><span class="text-amber-400 font-bold">→</span> Virement</button>
          <button id="btn-add-invest" class="btn-secondary"><span class="btn-dot" style="background:#60a5fa"></span><span class="text-blue-400 font-bold">↗</span> Invest.</button>
          <button id="btn-add-ndf" class="btn-secondary"><span class="btn-dot" style="background:#c084fc"></span><span class="text-purple-400 font-bold">⟳</span> NDF</button>
          <button id="btn-transfer" class="btn-secondary"><span class="btn-dot" style="background:#22d3ee"></span><span class="text-cyan-400 font-bold">⇄</span> Transfert</button>
          <button id="btn-archive-month" class="btn-ghost">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
            Clôturer le mois
          </button>
        </div>
      </div>

      ${needsPrevMonthClosure ? `
      <div class="flex flex-wrap items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
        <p class="text-sm text-amber-300 flex-1">Le mois de <span class="font-semibold capitalize">${new Date(prevMonthKey + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span> n'a pas été clôturé. Les coches de ce mois sont conservées et seront prises en compte.</p>
        <button id="btn-archive-prev-month" class="px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm rounded-lg hover:bg-amber-500/30 transition font-medium whitespace-nowrap">Clôturer ${new Date(prevMonthKey + '-01').toLocaleDateString('fr-FR', { month: 'long' })}</button>
      </div>` : ''}

      <div class="grid grid-cols-1 ${extraBanks.length > 0 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-3">
        <!-- Primary bank -->
        <div class="card-dark rounded-xl overflow-hidden order-2">
          <div class="px-4 py-2.5 flex items-center gap-3 border-b border-dark-400/30">
            ${BANK_ICON_PRIMARY}
            <div class="flex items-center gap-1.5 min-w-0">
              <p class="text-sm text-gray-400 whitespace-nowrap">${bankNames.primary}</p>
              <button data-rename-bank="primary" class="text-gray-600 hover:text-accent-blue transition p-0.5 rounded hover:bg-dark-600/50 flex-shrink-0" title="Renommer">${PENCIL_ICON}</button>
            </div>
            <p class="text-lg font-bold text-gray-100 ml-auto whitespace-nowrap">${formatCurrencyCents(soldeCIC)}</p>
            <button data-edit-solde="cc-cic" class="text-xs text-gray-500 hover:text-accent-blue transition px-2 py-1 rounded hover:bg-dark-600/50 flex-shrink-0">Modifier</button>
          </div>
          <div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-prev="cic">
            <span class="text-[10px] text-gray-500">${lblSoldeDebutCIC}</span>
            <span class="text-[10px] font-medium text-gray-400">${formatCurrencyCents(baseSoldeCIC + soldePrevCIC)}</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 px-3 py-1.5 border-b border-dark-400/20" id="pocket-grid-cic">
            ${cicPocketItems.map(pk => {
              const bgC = getPocketColor((pocketColorsStore[pk.id] || {}).bg || pk.defaultBg);
              const txC = getPocketColor((pocketColorsStore[pk.id] || {}).text || pk.defaultText);
              const delBtn = pk.delPocket
                ? `<button data-del-pocket="${pk.delPocket}" data-pocket-bank="cic" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[9px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>`
                : `<button data-del-budget="${pk.delKey}" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[9px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>`;
              return `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md ${bgC.bg} ${bgC.border} cursor-pointer hover:bg-dark-500/40 transition group/pk relative pk-drag-item" draggable="true" data-pk-drag-id="${pk.id}" ${pk.editAttr}>
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${pk.label}</span>
              <span class="text-[10px] font-semibold ${txC.text}">${formatCurrencyCents(pk.amount)}</span>
              ${delBtn}
            </div>`;
            }).join('')}
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
                <span class="text-[11px] font-semibold text-gray-300 cursor-text" data-section-rename="depMensuelles">${secNameDep}</span>
                <span class="text-[10px] text-gray-500">${cocheesThisMonth.length}/${depMensuelles.length}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-medium text-accent-red">${formatCurrencyCents(totalCochees)}</span>
                <button id="btn-add-mensuel-cic" class="text-accent-amber hover:text-accent-amber/80 text-[11px] font-bold transition ml-2" title="Ajouter">+</button>
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
                  <input type="checkbox" data-cic-mensuel="${d.id}" ${checked ? 'checked' : ''} ${monthIsClosed ? 'disabled' : ''} class="w-3.5 h-3.5 rounded border-dark-400 bg-dark-900 text-accent-amber focus:ring-accent-amber/40 cursor-pointer">
                  <span class="text-[11px] ${checked ? 'text-gray-500 line-through' : 'text-gray-200'} cursor-pointer" data-mc-edit="${d.id}">${d.nom}</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-[11px] font-medium ${checked ? 'text-gray-600' : 'text-gray-100'} cursor-pointer" data-mc-edit="${d.id}">${formatCurrencyCents(d.montant)}</span>
                  <button data-mc-del="${d.id}" class="btn-delete text-xs">✕</button>
                </div>
              </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Secondary bank -->
        <div class="card-dark rounded-xl overflow-hidden order-1">
          <div class="px-4 py-2.5 flex items-center gap-3 border-b border-dark-400/30">
            ${BANK_ICON_SECONDARY}
            <div class="flex items-center gap-1.5 min-w-0">
              <p class="text-sm text-gray-400 whitespace-nowrap">${bankNames.secondary}</p>
              <button data-rename-bank="secondary" class="text-gray-600 hover:text-accent-blue transition p-0.5 rounded hover:bg-dark-600/50 flex-shrink-0" title="Renommer">${PENCIL_ICON}</button>
            </div>
            <p class="text-lg font-bold text-gray-100 ml-auto whitespace-nowrap">${formatCurrencyCents(soldeTR)}</p>
            <button data-edit-solde="cc-trade" class="text-xs text-gray-500 hover:text-accent-blue transition px-2 py-1 rounded hover:bg-dark-600/50 flex-shrink-0">Modifier</button>
          </div>
          <div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-prev="tr">
            <span class="text-[10px] text-gray-500">${lblSoldeDebutTR}</span>
            <span class="text-[10px] font-medium text-gray-400">${formatCurrencyCents(baseSoldeTR + soldePrevTR)}</span>
          </div>
          ${soldeObligTR > 0 ? `<div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/40 border-b border-dark-400/20">
            <span class="text-[10px] text-gray-500">${lblSoldeObligTR}</span>
            <span class="text-[10px] font-medium text-amber-400">${formatCurrencyCents(soldeObligTR)}</span>
          </div>` : ''}
          <div class="grid grid-cols-3 gap-1.5 px-3 py-1.5 border-b border-dark-400/20" id="pocket-grid-tr">
            ${trPocketItems.map(pk => {
              const bgC = getPocketColor((pocketColorsStore[pk.id] || {}).bg || pk.defaultBg);
              const txC = getPocketColor((pocketColorsStore[pk.id] || {}).text || pk.defaultText);
              const delBtn = pk.delPocket
                ? `<button data-del-pocket="${pk.delPocket}" data-pocket-bank="tr" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[9px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>`
                : `<button data-del-budget="${pk.delKey}" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[9px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>`;
              return `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md ${bgC.bg} ${bgC.border} cursor-pointer hover:bg-dark-500/40 transition group/pk relative pk-drag-item" draggable="true" data-pk-drag-id="${pk.id}" ${pk.editAttr}>
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${pk.label}</span>
              <span class="text-[10px] font-semibold ${txC.text}">${pk.prefix}${formatCurrencyCents(pk.amount)}</span>
              ${delBtn}
            </div>`;
            }).join('')}
            <div class="flex flex-col items-center justify-center px-1 py-1 rounded-md border border-dashed border-dark-400/30 cursor-pointer hover:border-accent-blue/40 hover:bg-dark-600/20 transition" data-add-budget="tr" title="Ajouter une ligne">
              <span class="text-[10px] text-gray-600 hover:text-accent-blue">+</span>
            </div>
          </div>

          ${opsTR.length > 0 ? `
          <div class="divide-y divide-dark-400/20" id="ops-drop-tr">
            ${opsTR.map(renderOp).join('')}
          </div>
          ` : `<div class="px-5 py-4 text-sm text-gray-500">Aucune opération</div>`}

          <!-- Abonnements TR -->
          <div class="border-t border-dark-400/30">
            <div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/30 cursor-pointer select-none" data-section-toggle="prelevTR">
              <div class="flex items-center gap-2">
                <svg class="w-3 h-3 text-gray-500 flex-shrink-0 transition-transform ${secCollPrelev ? '-rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                <svg class="w-3.5 h-3.5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
                <span class="text-[11px] font-semibold text-gray-300 cursor-text" data-section-rename="prelevTR">${secNamePrelev}</span>
                <span class="text-[10px] text-gray-500">${confirmedPrelevIds.length}/${prelevTR.length}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-medium text-orange-400">-${formatCurrencyCents(totalPrelevConfirmed)}</span>
                <button id="btn-add-prelev-tr" class="text-orange-400 hover:text-orange-400/80 text-[11px] font-bold transition ml-2" title="Ajouter">+</button>
              </div>
            </div>
            <div class="divide-y divide-dark-400/10 ${secCollPrelev ? 'hidden' : ''}" data-section-body="prelevTR">
              ${prelevTR.map(p => {
                const confirmed = confirmedPrelevIds.includes(p.id);
                const pocketLabel = p.pocket && p.pocket !== 'aucun' ? (() => {
                  const pks = getBankPockets(store, bankNames, bankNames.secondary);
                  const pk = pks.find(x => x.id === p.pocket);
                  return pk ? pk.label : '';
                })() : '';
                return `
              <div class="flex items-center justify-between pl-4 pr-3 py-px hover:bg-dark-600/30 transition group/tr-prelev cursor-grab active:cursor-grabbing tr-prelev-drag-row" draggable="true" data-drag-prelev-id="${p.id}">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-3 h-4 text-gray-600 flex-shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
                  <input type="checkbox" data-tr-prelev-recurring="${p.id}" ${confirmed ? 'checked' : ''} ${monthIsClosed ? 'disabled' : ''} class="w-3.5 h-3.5 rounded border-dark-400 bg-dark-900 text-orange-500 focus:ring-orange-500/40 cursor-pointer">
                  <span class="text-[11px] ${confirmed ? 'text-gray-200' : 'text-gray-500 line-through'} cursor-pointer" data-tr-prelev-edit="${p.id}">${p.nom}</span>
                  ${pocketLabel ? `<span class="text-[9px] text-gray-600">${pocketLabel}</span>` : ''}
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-[11px] font-medium ${confirmed ? 'text-gray-100' : 'text-gray-600 line-through'} cursor-pointer" data-tr-prelev-edit="${p.id}">-${formatCurrencyCents(p.montant)}</span>
                  <button data-tr-prelev-del="${p.id}" class="btn-delete text-xs">✕</button>
                </div>
              </div>`;
              }).join('')}
            </div>
          </div>

          <!-- DCA & Investissements récurrents TR -->
          <div class="border-t border-dark-400/30">
            <div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/30 cursor-pointer select-none" data-section-toggle="dcaTR">
              <div class="flex items-center gap-2">
                <svg class="w-3 h-3 text-gray-500 flex-shrink-0 transition-transform ${secCollDca ? '-rotate-90' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                <svg class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m0 0l5-5m-5 5l-5-5"/></svg>
                <span class="text-[11px] font-semibold text-gray-300 cursor-text" data-section-rename="dcaTR">${secNameDca}</span>
                <span class="text-[10px] text-gray-500">${confirmedDcaIds.length}/${dcaTR.length}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-medium text-blue-400">-${formatCurrencyCents(totalDcaConfirmed)}</span>
                <button id="btn-add-dca-tr" class="text-blue-400 hover:text-blue-400/80 text-[11px] font-bold transition ml-2" title="Ajouter">+</button>
              </div>
            </div>
            <div class="divide-y divide-dark-400/10 ${secCollDca ? 'hidden' : ''}" data-section-body="dcaTR">
              ${dcaTR.map(d => {
                const confirmed = confirmedDcaIds.includes(d.id);
                const dcaPocketLabel = d.pocket && d.pocket !== 'aucun' ? (() => {
                  const pks = getBankPockets(store, bankNames, bankNames.secondary);
                  const pk = pks.find(x => x.id === d.pocket);
                  return pk ? pk.label : '';
                })() : '';
                return `
              <div class="flex items-center justify-between pl-4 pr-3 py-px hover:bg-dark-600/30 transition group/tr-dca cursor-grab active:cursor-grabbing tr-dca-drag-row" draggable="true" data-drag-dca-id="${d.id}">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-3 h-4 text-gray-600 flex-shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
                  <input type="checkbox" data-tr-dca-recurring="${d.id}" ${confirmed ? 'checked' : ''} ${monthIsClosed ? 'disabled' : ''} class="w-3.5 h-3.5 rounded border-dark-400 bg-dark-900 text-blue-500 focus:ring-blue-500/40 cursor-pointer">
                  <span class="text-[11px] ${confirmed ? 'text-gray-200' : 'text-gray-500 line-through'} cursor-pointer" data-tr-dca-edit="${d.id}">${d.nom}</span>
                  ${dcaPocketLabel ? `<span class="text-[9px] text-gray-600">${dcaPocketLabel}</span>` : ''}
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-[11px] font-medium ${confirmed ? 'text-gray-100' : 'text-gray-600 line-through'} cursor-pointer" data-tr-dca-edit="${d.id}">-${formatCurrencyCents(d.montant)}</span>
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
                <span class="text-[11px] font-semibold text-gray-300 cursor-text" data-section-rename="revMensuels">${secNameRev}</span>
                <span class="text-[10px] text-gray-500">${confirmedRevIds.length}/${revMensuelsTR.length}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-medium text-emerald-400">+${formatCurrencyCents(totalRevConfirmed)}</span>
                <button id="btn-add-rev-tr" class="text-emerald-400 hover:text-emerald-400/80 text-[11px] font-bold transition ml-2" title="Ajouter">+</button>
              </div>
            </div>
            <div class="divide-y divide-dark-400/10 ${secCollRev ? 'hidden' : ''}" data-section-body="revMensuels">
              ${revMensuelsTR.map(r => {
                const confirmed = confirmedRevIds.includes(r.id);
                const revPocketLabel = r.pocket && r.pocket !== 'aucun' ? (() => {
                  const pks = getBankPockets(store, bankNames, bankNames.secondary);
                  const pk = pks.find(x => x.id === r.pocket);
                  return pk ? pk.label : '';
                })() : '';
                return `
              <div class="flex items-center justify-between pl-4 pr-3 py-px hover:bg-dark-600/30 transition group/tr-rev cursor-grab active:cursor-grabbing tr-rev-drag-row" draggable="true" data-drag-rev-id="${r.id}">
                <div class="flex items-center gap-2 min-w-0">
                  <svg class="w-3 h-4 text-gray-600 flex-shrink-0 pointer-events-none" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
                  <input type="checkbox" data-tr-rev-recurring="${r.id}" ${confirmed ? 'checked' : ''} ${monthIsClosed ? 'disabled' : ''} class="w-3.5 h-3.5 rounded border-dark-400 bg-dark-900 text-emerald-500 focus:ring-emerald-500/40 cursor-pointer">
                  <span class="text-[11px] ${confirmed ? 'text-gray-200' : 'text-gray-500 line-through'} cursor-pointer" data-tr-rev-edit="${r.id}">${r.nom}</span>
                  ${revPocketLabel ? `<span class="text-[9px] text-gray-600">${revPocketLabel}</span>` : ''}
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
        <div class="card-dark rounded-xl overflow-hidden order-3">
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
          <div class="flex items-center justify-between px-3 py-0.5 bg-dark-700/40 border-b border-dark-400/20 cursor-pointer hover:bg-dark-600/30 transition" data-edit-prev="${bank.id}">
            <span class="text-[10px] text-gray-500">${bank.lblPrev}</span>
            <span class="text-[10px] font-medium text-gray-400">${formatCurrencyCents(bank.baseSolde + bank.prevSolde)}</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 px-3 py-1.5 border-b border-dark-400/20" id="pocket-grid-${bank.id}">
            ${bank.pocketItems.map(pk => {
              const bgC = getPocketColor((pocketColorsStore[pk.id] || {}).bg || pk.defaultBg);
              const txC = getPocketColor((pocketColorsStore[pk.id] || {}).text || pk.defaultText);
              const delBtn = pk.delPocket
                ? `<button data-del-pocket="${pk.delPocket}" data-pocket-bank="${bank.id}" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[9px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>`
                : `<button data-del-budget="${pk.delKey}" class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-dark-800 border border-dark-400/30 text-gray-600 hover:text-accent-red text-[9px] flex items-center justify-center opacity-0 group-hover/pk:opacity-100 transition-opacity">✕</button>`;
              return `<div class="flex flex-col items-center justify-center px-1 py-1 rounded-md ${bgC.bg} ${bgC.border} cursor-pointer hover:bg-dark-500/40 transition group/pk relative pk-drag-item" draggable="true" data-pk-drag-id="${pk.id}" ${pk.editAttr}>
              <span class="text-[9px] text-gray-500 truncate w-full text-center leading-tight">${pk.label}</span>
              <span class="text-[10px] font-semibold ${txC.text}">${formatCurrencyCents(pk.amount)}</span>
              ${delBtn}
            </div>`;
            }).join('')}
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
        <div id="btn-add-bank" class="card-dark rounded-xl overflow-hidden order-4 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-400/30 hover:bg-dark-600/20 transition min-h-[120px] border border-dashed border-dark-400/30">
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
      <!-- Archives groupées par année -->
      <div class="card-dark rounded-xl px-5 py-4">
        <h2 class="text-sm font-semibold text-gray-400 mb-3">Archives mensuelles</h2>
        <div class="space-y-2">
          ${(() => {
            const sorted = [...archives].sort((a, b) => b.mois.localeCompare(a.mois));
            const byYear = {};
            sorted.forEach(a => {
              const y = a.mois.slice(0, 4);
              (byYear[y] = byYear[y] || []).push(a);
            });
            const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a));
            return years.map((y, yi) => `
          <details class="group/arch" ${yi === 0 ? 'open' : ''}>
            <summary class="flex items-center gap-2 cursor-pointer select-none py-1" style="list-style:none">
              <svg class="w-3 h-3 text-gray-600 transition-transform group-open/arch:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              <span class="text-sm font-semibold text-gray-300">${y}</span>
              <span class="text-[10px] text-gray-600">${byYear[y].length} mois</span>
            </summary>
            <div class="flex flex-wrap gap-1.5 pl-5 pt-1.5 pb-1">
              ${byYear[y].map(a => `
              <button class="archive-row px-3 py-1.5 rounded-lg bg-dark-600/40 border border-dark-400/20 text-xs text-gray-300 capitalize hover:bg-dark-600 hover:text-gray-100 hover:border-dark-300/40 transition" data-mois="${a.mois}">
                ${new Date(a.mois + '-01').toLocaleDateString('fr-FR', { month: 'long' })}
              </button>`).join('')}
            </div>
          </details>`).join('');
          })()}
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

export function mount(store, navigate) {
  _activeStore = store;
  const bankNames = store.getBankNames();
  const extraBanks = bankNames.extra || [];
  const COMPTES = [bankNames.secondary, bankNames.primary, ...extraBanks.map(b => b.name)];

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
      const defaults = { depMensuelles: 'Dépenses mensuelles', dcaTR: 'DCA & Investissements', revMensuels: 'Apports mensuels', prelevTR: 'Abonnements' };
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

  // Transfert d'argent : pocket → pocket, banque → banque, ou mixte
  document.getElementById('btn-transfer')?.addEventListener('click', () => {
    const selectClasses = 'w-full px-3 py-2.5 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition';
    const buildOptions = (selected) => {
      let html = `<optgroup label="Comptes">${COMPTES.map(b => `<option value="bank::${b}" ${`bank::${b}` === selected ? 'selected' : ''}>${b}</option>`).join('')}</optgroup>`;
      for (const b of COMPTES) {
        const pk = getBankPockets(store, bankNames, b);
        if (pk.length > 0) {
          html += `<optgroup label="Pockets — ${b}">${pk.map(p => `<option value="pocket::${b}::${p.id}" ${`pocket::${b}::${p.id}` === selected ? 'selected' : ''}>${p.label}</option>`).join('')}</optgroup>`;
        }
      }
      return html;
    };
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 100"')}
      ${inputField('description', 'Description (optionnel)', '', 'text', 'placeholder="Ex: Réallocation budget"')}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">De</label>
        <select name="src" id="field-src" class="${selectClasses}">${buildOptions()}</select>
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Vers</label>
        <select name="dst" id="field-dst" class="${selectClasses}">${buildOptions()}</select>
      </div>
      <p class="text-[11px] text-gray-500">Entre deux banques : deux opérations "Virement" sont créées (débit / crédit). Entre pockets d'une même banque : seuls les pockets sont ajustés, le solde de la banque ne bouge pas.</p>
    `;
    openModal('Transférer de l\'argent', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      const montant = Number(data.montant) || 0;
      if (montant <= 0) { showModalError('Indique un montant supérieur à 0.'); return false; }
      if (!data.src || !data.dst || data.src === data.dst) { showModalError('Choisis une source et une destination différentes.'); return false; }
      const parse = (v) => {
        const parts = v.split('::');
        return parts[0] === 'bank' ? { bank: parts[1], pocket: null } : { bank: parts[1], pocket: parts[2] };
      };
      const src = parse(data.src);
      const dst = parse(data.dst);
      // Ajustements de pockets (montant positif = débit, négatif = crédit)
      if (src.pocket) deductFromPocket(store, bankNames, src.bank, src.pocket, montant);
      if (dst.pocket) deductFromPocket(store, bankNames, dst.bank, dst.pocket, -montant);
      // Banques différentes : matérialiser le mouvement par deux opérations
      if (src.bank !== dst.bank) {
        const mkId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const items = store.get('suiviDepenses') || [];
        items.unshift({ id: mkId(), date: data.date, description: data.description || `Transfert vers ${dst.bank}`, categorie: 'Virement', montant, compte: src.bank });
        store.set('suiviDepenses', items);
        const revenus = store.get('suiviRevenus') || [];
        revenus.unshift({ id: mkId(), type: 'revenu', date: data.date, description: data.description || `Transfert depuis ${src.bank}`, categorie: 'Virement', montant, compte: dst.bank });
        store.set('suiviRevenus', revenus);
      }
      showToast('Transfert effectué ✓', 'success', 2500);
      navigate('suivi-depenses');
    });
  });

  // Archive month (clôture) — retroactive=true closes the previous month:
  // only ops dated up to that month are archived, later ops are kept
  const openClosureFlow = (monthKey, retroactive) => {
    const existingArchives = store.get('archiveDepenses') || [];
    if (existingArchives.some(a => a.mois === monthKey)) {
      openModal('Mois déjà clôturé', '<p class="text-gray-300 text-sm">Ce mois a déjà été clôturé.</p>', null);
      return;
    }
    const label = new Date(monthKey + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    // Compute current final soldes
    const allItems = store.get('suiviDepenses') || [];
    const allRevenus = store.get('suiviRevenus') || [];
    const inScope = (op) => !retroactive || (op.date || '').slice(0, 7) <= monthKey;
    const items = allItems.filter(inScope);
    const revenus = allRevenus.filter(inScope);
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
    const trConfirmedStore = store.get('trRecurringConfirmed') || {};
    const trConfMonth = trConfirmedStore[monthKey] || { expenses: [], revenues: [], prelevements: [] };
    const dcaList = store.get('dcaMensuelsTR') || [];
    const revMensList = store.get('revenusMensuelsTR') || [];
    const prelevList = store.get('prelevementsTR') || [];
    const archDcaConfirmed = dcaList.filter(d => (trConfMonth.expenses || []).includes(d.id)).reduce((s, d) => s + (Number(d.montant) || 0), 0);
    const archRevConfirmed = revMensList.filter(r => (trConfMonth.revenues || []).includes(r.id)).reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const archPrelevConfirmed = prelevList.filter(p => (trConfMonth.prelevements || []).includes(p.id)).reduce((s, p) => s + (Number(p.montant) || 0), 0);
    const finalSoldeTR = baseSoldeTR + soldePrevTR + revTR + trInt - depTR - trRnd - archDcaConfirmed + archRevConfirmed - archPrelevConfirmed;

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
        <p class="text-[11px] text-gray-500">Les soldes finaux deviendront les "soldes mois précédent" du mois suivant. ${retroactive ? `Seules les opérations datées jusqu'à fin ${label} seront archivées — celles du mois en cours sont conservées.` : 'Les opérations et coches seront remises à zéro.'}</p>
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
        prelevTR: JSON.parse(JSON.stringify(store.get('prelevementsTR') || [])),
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

      // Carry forward pocket remaining balances before clearing ops
      // budgetNDF and budgetQuotidien carry as-is (already adjusted by deductFromPocket)
      const carryParams = store.get('parametres') || {};
      store.set('parametres', carryParams);

      // Clear archived operations (retroactive: keep current-month ops)
      store.set('suiviDepenses', retroactive ? allItems.filter(op => !inScope(op)) : []);
      store.set('suiviRevenus', retroactive ? allRevenus.filter(op => !inScope(op)) : []);

      // Keep cicMensuellesCochees and trRecurringConfirmed for the closed month
      // (their effects are baked into soldePrev; clearing them would allow
      // double-crediting pockets if the user re-checks items before the monthKey changes)

      // Reset TR features (monthly values already baked into soldePrev)
      const trF = store.get('trFeatures') || {};
      trF.interets = 0;
      trF.saveback = 0;
      trF.roundup = 0;
      store.set('trFeatures', trF);

      showToast(`Mois de ${label} clôturé ✓`, 'success', 3500);
      navigate('suivi-depenses');
    });
  };

  document.getElementById('btn-archive-month')?.addEventListener('click', () => {
    openClosureFlow(getCurrentMonthKey(), false);
  });

  document.getElementById('btn-archive-prev-month')?.addEventListener('click', () => {
    openClosureFlow(getPreviousMonthKey(), true);
  });

  // Add revenu
  document.getElementById('btn-add-revenu')?.addEventListener('click', () => {
    const revDefaultBank = COMPTES[0];
    const revPockets = getBankPockets(store, bankNames, revDefaultBank);
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', 'placeholder="Ex: Salaire mars"')}
      ${categorieFieldHtml(store, 'revenus')}
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
      ${pocketSelectHtml(revPockets, 'aucun', 'Ajouter au pocket')}
    `;
    openModal('Ajouter un revenu', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!(Number(data.montant) > 0)) { showModalError('Indique un montant supérieur à 0.'); return false; }
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.primary;
      const pocketId = document.getElementById('pocket-select')?.value || 'aucun';
      const revenus = store.get('suiviRevenus') || [];
      revenus.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pocket: pocketId !== 'aucun' ? pocketId : undefined, ...data });
      store.set('suiviRevenus', revenus);
      if (pocketId !== 'aucun') deductFromPocket(store, bankNames, data.compte, pocketId, -(Number(data.montant) || 0));
      showToast('Revenu ajouté ✓', 'success', 2000);
      navigate('suivi-depenses');
    });
    setupPocketBankSync(store, bankNames);
    wireCategoryManager(document.getElementById('app-modal'), store, 'revenus');
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
        const oldSolde = cc ? Number(cc.solde) || 0 : 0;
        const delta = newSolde - oldSolde;
        if (cc) {
          cc.solde = newSolde;
        } else {
          ccs.push({ id: ccId, nom: label, solde: newSolde });
        }
        actifs.comptesCourants = ccs;
        store.set('actifs', actifs);
        if (delta !== 0) {
          const prevKey = ccId === 'cc-cic' ? 'cic' : ccId === 'cc-trade' ? 'tr' : ccId.replace('cc-', '');
          const prev = store.get('soldeMoisPrecedent') || {};
          prev[prevKey] = (Number(prev[prevKey]) || 0) - delta;
          store.set('soldeMoisPrecedent', prev);
        }
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
      const comptes = store.get('actifs')?.comptesCourants || [];
      const ccId = key === 'cic' ? 'cc-cic' : key === 'tr' ? 'cc-trade' : 'cc-' + key;
      const baseSolde = Number(comptes.find(c => c.id === ccId)?.solde) || 0;
      const labels = store.get('customLabels') || {};
      const lblKey = `soldeDebutMois_${key}`;
      const currentLabel = labels[lblKey] || 'Solde début de mois';
      const current = baseSolde + (Number(prev[key]) || 0);
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('solde', `Montant ${bankLabel} (€)`, current, 'number', 'step="0.01"');
      openModal(`${currentLabel} — ${bankLabel}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        prev[key] = (Number(data.solde) || 0) - baseSolde;
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
      const key = el.dataset.editOblig;
      const obligPkId = 'oblig-' + key;
      const extraBankO = extraBanks.find(b => b.id === key);
      const bankLabel = key === 'cic' ? bankNames.primary : key === 'tr' ? bankNames.secondary : (extraBankO?.name || 'Banque');
      const oblig = store.get('soldeObligatoire') || {};
      const labels = store.get('customLabels') || {};
      const lblKey = `soldeObligatoire_${key}`;
      const currentLabel = labels[lblKey] || 'Solde obligatoire';
      const current = Number(oblig[key]) || 0;
      const pc = store.get('pocketColors') || {};
      const curBg = (pc[obligPkId] || {}).bg || 'gray';
      const curTx = (pc[obligPkId] || {}).text || 'amber';
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('solde', `Montant ${bankLabel} (€)`, current, 'number', 'step="0.01"')
        + colorPickerHtml('Couleur fond', 'color_bg', curBg)
        + colorPickerHtml('Couleur contenu', 'color_text', curTx);
      openModal(`${currentLabel} — ${bankLabel}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        oblig[key] = Number(data.solde) || 0;
        store.set('soldeObligatoire', oblig);
        if (data.libelle && data.libelle !== currentLabel) {
          labels[lblKey] = data.libelle;
          store.set('customLabels', labels);
        }
        const bgVal = document.querySelector('input[name="color_bg"]:checked')?.value || curBg;
        const txVal = document.querySelector('input[name="color_text"]:checked')?.value || curTx;
        const colors = store.get('pocketColors') || {};
        colors[obligPkId] = { bg: bgVal, text: txVal };
        store.set('pocketColors', colors);
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
      const pc = store.get('pocketColors') || {};
      const curBg = (pc.invest || {}).bg || 'gray';
      const curTx = (pc.invest || {}).text || 'blue';
      const pOblig = store.get('pocketObligatoire') || {};
      const isObligInvest = pOblig.invest === true;
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('montant', `Montant (€)`, current, 'number', 'step="0.01"')
        + obligatoireCheckboxHtml(isObligInvest)
        + colorPickerHtml('Couleur fond', 'color_bg', curBg) + colorPickerHtml('Couleur contenu', 'color_text', curTx);
      openModal(`${currentLabel} — ${bankNames.secondary}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        invest.tr = Number(data.montant) || 0;
        store.set('restantInvestissement', invest);
        if (data.libelle && data.libelle !== currentLabel) { labels.restantInvestissement = data.libelle; store.set('customLabels', labels); }
        const ob = store.get('pocketObligatoire') || {};
        ob.invest = document.getElementById('field-obligatoire')?.checked === true;
        store.set('pocketObligatoire', ob);
        const colors = store.get('pocketColors') || {};
        colors.invest = { bg: document.querySelector('input[name="color_bg"]:checked')?.value || curBg, text: document.querySelector('input[name="color_text"]:checked')?.value || curTx };
        store.set('pocketColors', colors);
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
      const pc = store.get('pocketColors') || {};
      const curBg = (pc.pea || {}).bg || 'gray';
      const curTx = (pc.pea || {}).text || 'blue';
      const pOblig = store.get('pocketObligatoire') || {};
      const isObligPea = pOblig.pea === true;
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('montant', `Montant (€)`, current, 'number', 'step="0.01"')
        + obligatoireCheckboxHtml(isObligPea)
        + colorPickerHtml('Couleur fond', 'color_bg', curBg) + colorPickerHtml('Couleur contenu', 'color_text', curTx);
      openModal(`${currentLabel} — ${bankNames.secondary}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        pea.tr = Number(data.montant) || 0;
        store.set('restantPEA', pea);
        if (data.libelle && data.libelle !== currentLabel) { labels.restantPEA = data.libelle; store.set('customLabels', labels); }
        const ob = store.get('pocketObligatoire') || {};
        ob.pea = document.getElementById('field-obligatoire')?.checked === true;
        store.set('pocketObligatoire', ob);
        const colors = store.get('pocketColors') || {};
        colors.pea = { bg: document.querySelector('input[name="color_bg"]:checked')?.value || curBg, text: document.querySelector('input[name="color_text"]:checked')?.value || curTx };
        store.set('pocketColors', colors);
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
      const pc = store.get('pocketColors') || {};
      const curBg = (pc.ndf || {}).bg || 'gray';
      const curTx = (pc.ndf || {}).text || 'purple';
      const pOblig = store.get('pocketObligatoire') || {};
      const isObligNdf = pOblig.ndf !== false;
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('budget', 'Montant (€)', current, 'number', 'step="0.01"')
        + obligatoireCheckboxHtml(isObligNdf)
        + colorPickerHtml('Couleur fond', 'color_bg', curBg) + colorPickerHtml('Couleur contenu', 'color_text', curTx);
      openModal(`${currentLabel} — ${bankNames.secondary}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const p = store.get('parametres') || {};
        p.budgetNDF = Number(data.budget) || 0;
        store.set('parametres', p);
        if (data.libelle && data.libelle !== currentLabel) { labels.aRecupererNDF = data.libelle; store.set('customLabels', labels); }
        const ob = store.get('pocketObligatoire') || {};
        ob.ndf = document.getElementById('field-obligatoire')?.checked !== false;
        store.set('pocketObligatoire', ob);
        const colors = store.get('pocketColors') || {};
        colors.ndf = { bg: document.querySelector('input[name="color_bg"]:checked')?.value || curBg, text: document.querySelector('input[name="color_text"]:checked')?.value || curTx };
        store.set('pocketColors', colors);
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
      const pc = store.get('pocketColors') || {};
      const curBg = (pc.quotidien || {}).bg || 'gray';
      const curTx = (pc.quotidien || {}).text || 'gray';
      const pOblig = store.get('pocketObligatoire') || {};
      const isObligQuot = pOblig.quotidien === true;
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('budget', 'Montant (€)', current, 'number', 'step="0.01"')
        + obligatoireCheckboxHtml(isObligQuot)
        + colorPickerHtml('Couleur fond', 'color_bg', curBg)
        + colorPickerHtml('Couleur contenu', 'color_text', curTx);
      openModal(`${currentLabel} — ${bankNames.secondary}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const pQ = store.get('parametres') || {};
        pQ.budgetQuotidien = Number(data.budget) || 0;
        store.set('parametres', pQ);
        const ob = store.get('pocketObligatoire') || {};
        ob.quotidien = document.getElementById('field-obligatoire')?.checked === true;
        store.set('pocketObligatoire', ob);
        if (data.libelle && data.libelle !== currentLabel) {
          labels.enveloppeQuotidien = data.libelle;
          store.set('customLabels', labels);
        }
        const bgVal = document.querySelector('input[name="color_bg"]:checked')?.value || curBg;
        const txVal = document.querySelector('input[name="color_text"]:checked')?.value || curTx;
        const colors = store.get('pocketColors') || {};
        colors.quotidien = { bg: bgVal, text: txVal };
        store.set('pocketColors', colors);
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
      const pc = store.get('pocketColors') || {};
      const defaultColors = { saveback: { bg: 'amber', text: 'amber' }, roundup: { bg: 'red', text: 'red' }, interets: { bg: 'emerald', text: 'emerald' } };
      const curBg = (pc[feat] || defaultColors[feat] || {}).bg || 'gray';
      const curTx = (pc[feat] || defaultColors[feat] || {}).text || 'gray';
      const body = inputField('libelle', 'Libellé', currentLabel) + inputField('montant', 'Montant (€)', currentValue, 'number', 'step="0.01"')
        + (feat === 'saveback' ? `
          <div class="rounded-lg bg-amber-500/5 border border-amber-500/15 p-3 mb-4">
            <p class="text-[11px] text-amber-300/90 font-semibold mb-2">Saveback automatique</p>
            <p class="text-[10px] text-gray-500 leading-relaxed mb-3">1 % de chaque dépense <b class="text-gray-400">CB</b> sur ${bankNames.secondary} est ajouté ici automatiquement — offert par Trade Republic (jamais déduit du solde), plafonné à ${SAVEBACK_PLAFOND_MOIS} €/mois. À la clôture, le montant repart à zéro : il a été investi dans le produit cible.</p>
            ${inputField('produit', 'Produit cible', trFeatures.savebackProduit || '', 'text', 'placeholder="Ex: Bitcoin, ETF MSCI World, action…"')}
            ${inputField('isin', 'ISIN (optionnel)', trFeatures.savebackIsin || '', 'text', 'placeholder="Ex: IE00B4L5Y983"')}
          </div>` : '')
        + (feat === 'roundup' ? `
          <div class="rounded-lg bg-red-500/5 border border-red-500/15 p-3 mb-4">
            <p class="text-[11px] text-red-300/90 font-semibold mb-2">Round-up automatique</p>
            <p class="text-[10px] text-gray-500 leading-relaxed mb-3">Chaque dépense <b class="text-gray-400">CB</b> sur ${bankNames.secondary} investit le complément à l'euro supérieur (1,50 € → 0,50 €) — une dépense ronde (10 €) investit 1 €. Le tout multiplié par le boost, <b class="text-gray-400">débité de ton solde</b>. À la clôture, le montant repart à zéro : il a été investi dans le produit cible.</p>
            <label class="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" id="ru-actif" ${trFeatures.roundupActif === false ? '' : 'checked'} class="w-4 h-4 rounded border-dark-400 bg-dark-900 text-red-500 focus:ring-red-500/40">
              <span class="text-xs text-gray-200">Round-up automatique activé</span>
            </label>
            <div class="mb-3">
              <label class="block text-xs font-medium text-gray-300 mb-1">Boost</label>
              <div class="flex gap-1.5 flex-wrap">
                ${ROUNDUP_BOOSTS.map(b => `
                <label class="cursor-pointer px-3 py-1.5 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-red-500/40 has-[:checked]:border-red-500 has-[:checked]:bg-red-500/10 transition">
                  <input type="radio" name="ru_boost" value="${b}" ${b === (Number(trFeatures.roundupBoost) || 1) ? 'checked' : ''} class="sr-only">
                  <span class="text-xs text-gray-200 font-medium">x${b}</span>
                </label>`).join('')}
              </div>
            </div>
            ${inputField('produit', 'Produit cible', trFeatures.roundupProduit || '', 'text', 'placeholder="Ex: ETF S&P 500, action, crypto…"')}
            ${inputField('isin', 'ISIN (optionnel)', trFeatures.roundupIsin || '', 'text', 'placeholder="Ex: IE00B5BMR087"')}
          </div>` : '')
        + colorPickerHtml('Couleur fond', 'color_bg', curBg)
        + colorPickerHtml('Couleur contenu', 'color_text', curTx);
      openModal(currentLabel, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        trFeatures[meta.valueKey] = Number(data.montant) || 0;
        if (data.libelle) trFeatures[meta.lblKey] = data.libelle;
        if (feat === 'saveback') {
          trFeatures.savebackProduit = (data.produit || '').trim();
          trFeatures.savebackIsin = (data.isin || '').trim().toUpperCase();
          // Le produit cible pilote le libellé du bloc (sauf si laissé vide)
          if (trFeatures.savebackProduit) trFeatures.lblSaveback = `Saveback 1% → ${trFeatures.savebackProduit}`;
        }
        if (feat === 'roundup') {
          trFeatures.roundupActif = !!document.getElementById('ru-actif')?.checked;
          trFeatures.roundupBoost = Number(document.querySelector('input[name="ru_boost"]:checked')?.value) || 1;
          trFeatures.roundupProduit = (data.produit || '').trim();
          trFeatures.roundupIsin = (data.isin || '').trim().toUpperCase();
          if (trFeatures.roundupProduit) trFeatures.lblRoundup = `Round-up${trFeatures.roundupBoost > 1 ? ' x' + trFeatures.roundupBoost : ''} → ${trFeatures.roundupProduit}`;
        }
        store.set('trFeatures', trFeatures);
        const bgVal = document.querySelector('input[name="color_bg"]:checked')?.value || curBg;
        const txVal = document.querySelector('input[name="color_text"]:checked')?.value || curTx;
        const colors = store.get('pocketColors') || {};
        colors[feat] = { bg: bgVal, text: txVal };
        store.set('pocketColors', colors);
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
      const body = inputField('libelle', 'Nom', '', 'text', 'placeholder="Ex: Vacances, Épargne..."') + inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 500"')
        + obligatoireCheckboxHtml(true)
        + colorPickerHtml('Couleur fond', 'color_bg', 'gray')
        + colorPickerHtml('Couleur contenu', 'color_text', 'blue');
      openModal('Nouveau pocket', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const label = (data.libelle || '').trim();
        const amount = Number(data.montant) || 0;
        if (!label) return;
        const pockets = store.get('budgetPockets') || {};
        if (!pockets[bankKey]) pockets[bankKey] = [];
        const newId = 'pocket-' + Date.now();
        const oblig = document.getElementById('field-obligatoire')?.checked !== false;
        pockets[bankKey].push({ id: newId, label, amount, obligatoire: oblig });
        store.set('budgetPockets', pockets);
        const bgVal = document.querySelector('input[name="color_bg"]:checked')?.value || 'gray';
        const txVal = document.querySelector('input[name="color_text"]:checked')?.value || 'blue';
        const colors = store.get('pocketColors') || {};
        colors[newId] = { bg: bgVal, text: txVal };
        store.set('pocketColors', colors);
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
      const pc = store.get('pocketColors') || {};
      const curBg = (pc[pocketId] || {}).bg || 'gray';
      const curTx = (pc[pocketId] || {}).text || 'blue';
      const isOblig = pocket.obligatoire !== false;
      const body = inputField('libelle', 'Nom', pocket.label) + inputField('montant', 'Montant (€)', pocket.amount, 'number', 'step="0.01"')
        + obligatoireCheckboxHtml(isOblig)
        + colorPickerHtml('Couleur fond', 'color_bg', curBg)
        + colorPickerHtml('Couleur contenu', 'color_text', curTx);
      openModal('Modifier le pocket', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        pocket.label = (data.libelle || '').trim() || pocket.label;
        pocket.amount = Number(data.montant) || 0;
        pocket.obligatoire = document.getElementById('field-obligatoire')?.checked !== false;
        store.set('budgetPockets', pockets);
        const bgVal = document.querySelector('input[name="color_bg"]:checked')?.value || curBg;
        const txVal = document.querySelector('input[name="color_text"]:checked')?.value || curTx;
        const colors = store.get('pocketColors') || {};
        colors[pocketId] = { bg: bgVal, text: txVal };
        store.set('pocketColors', colors);
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
    const defaultBank = COMPTES[0];
    const defaultPockets = getBankPockets(store, bankNames, defaultBank);
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', 'placeholder="Ex: Courses Carrefour"')}
      ${categorieFieldHtml(store, 'depenses')}
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
      ${paiementFieldHtml('cb')}
      ${pocketSelectHtml(defaultPockets)}
    `;
    openModal('Ajouter une dépense', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!(Number(data.montant) > 0)) { showModalError('Indique un montant supérieur à 0.'); return false; }
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.primary;
      data.paiement = document.querySelector('input[name="paiement"]:checked')?.value || 'cb';
      const pocketId = document.getElementById('pocket-select')?.value || 'aucun';
      const items = store.get('suiviDepenses') || [];
      const op = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pocket: pocketId !== 'aucun' ? pocketId : undefined, ...data };
      // Saveback (offert, hors solde) + Round-up (débité du solde) sur les dépenses CB Trade Republic
      if (savebackEligible(op.paiement, op.compte, bankNames.secondary)) {
        const sb = crediterSaveback(store, op.montant);
        if (sb > 0) op.sb = sb;
        const ru = crediterRoundup(store, op.montant);
        if (ru > 0) op.ru = ru;
      }
      items.unshift(op);
      store.set('suiviDepenses', items);
      deductFromPocket(store, bankNames, data.compte, pocketId, data.montant);
      const bonus = [op.sb ? `Saveback +${op.sb.toFixed(2).replace('.', ',')} €` : '', op.ru ? `Round-up ${op.ru.toFixed(2).replace('.', ',')} € investis` : ''].filter(Boolean).join(' · ');
      showToast(bonus ? `Dépense ajoutée ✓ · ${bonus}` : 'Dépense ajoutée ✓', 'success', 2500);
      navigate('suivi-depenses');
    });
    setupPocketBankSync(store, bankNames);
    wireCategoryManager(document.getElementById('app-modal'), store, 'depenses');
  });

  // Edit expense
  document.querySelectorAll('[data-edit-expense]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editExpense;
      const items = store.get('suiviDepenses') || [];
      const item = items.find(i => i.id === id);
      if (!item) return;
      const curAff = getCurrentAffectation(item);
      const editPockets = getBankPockets(store, bankNames, item.compte || bankNames.primary);
      const body = `
        ${affectationField(curAff)}
        <div class="grid grid-cols-2 gap-2">
          <div>${inputField('date', 'Date', item.date, 'date')}</div>
          <div>${inputField('montant', 'Montant (€)', item.montant, 'number', 'step="0.01"')}</div>
        </div>
        ${inputField('description', 'Description', item.description || '', 'text')}
        <div class="grid grid-cols-2 gap-2">
          <div>${categorieFieldHtml(store, 'depenses', item.categorie)}</div>
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
        ${paiementFieldHtml(item.paiement || 'cb')}
        ${pocketSelectHtml(editPockets, item.pocket || 'aucun')}
      `;
      openModal('Modifier l\'opération', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.compte = document.querySelector('input[name="compte"]:checked')?.value || item.compte;
        const newAff = document.querySelector('input[name="affectation"]:checked')?.value || curAff;
        const pocketId = document.getElementById('pocket-select')?.value || 'aucun';
        const oldPocket = item.pocket;
        const oldMontant = Number(item.montant) || 0;
        const oldCompte = item.compte || bankNames.secondary;

        // Reverse old pocket deduction
        if (oldPocket) deductFromPocket(store, bankNames, oldCompte, oldPocket, -oldMontant);

        // If switched to revenu → move from suiviDepenses to suiviRevenus
        if (newAff === 'revenu') {
          annulerSaveback(store, item.sb);
          annulerRoundup(store, item.ru);
          store.set('suiviDepenses', items.filter(i => i.id !== id));
          const revenus = store.get('suiviRevenus') || [];
          revenus.unshift({ id: item.id, type: 'revenu', date: data.date, description: data.description, montant: data.montant, compte: data.compte, categorie: data.categorie, pocket: pocketId !== 'aucun' ? pocketId : undefined });
          store.set('suiviRevenus', revenus);
          // Apply new pocket deduction if assigned
          if (pocketId !== 'aucun') deductFromPocket(store, bankNames, data.compte, pocketId, data.montant);
        } else {
          // Map affectation to categorie
          if (newAff === 'investissement') data.categorie = 'Investissement';
          else if (newAff === 'virement') data.categorie = 'Virement';
          else if (newAff === 'ndf') data.categorie = 'NDF';
          else if (newAff === 'autre') data.categorie = 'Autre';
          data.pocket = pocketId !== 'aucun' ? pocketId : undefined;
          data.paiement = document.querySelector('input[name="paiement"]:checked')?.value || item.paiement || 'cb';
          // Saveback / Round-up : on annule les anciens crédits puis on recrédite selon les nouvelles valeurs
          annulerSaveback(store, item.sb);
          annulerRoundup(store, item.ru);
          delete item.sb;
          delete item.ru;
          Object.assign(item, data);
          if (savebackEligible(item.paiement, item.compte, bankNames.secondary)) {
            const sb = crediterSaveback(store, item.montant);
            if (sb > 0) item.sb = sb;
            const ru = crediterRoundup(store, item.montant);
            if (ru > 0) item.ru = ru;
          }
          store.set('suiviDepenses', items);
          // Apply new pocket deduction if assigned
          if (data.pocket) deductFromPocket(store, bankNames, data.compte, data.pocket, data.montant);
        }
        navigate('suivi-depenses');
      });
      setupPocketBankSync(store, bankNames);
      wireCategoryManager(document.getElementById('app-modal'), store, 'depenses');
    });
  });

  // Edit revenu
  document.querySelectorAll('[data-edit-revenu]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.editRevenu;
      const revenus = store.get('suiviRevenus') || [];
      const rev = revenus.find(r => r.id === id);
      if (!rev) return;
      const editRevPockets = getBankPockets(store, bankNames, rev.compte || bankNames.primary);
      const body = `
        ${affectationField('revenu')}
        <div class="grid grid-cols-2 gap-2">
          <div>${inputField('date', 'Date', rev.date, 'date')}</div>
          <div>${inputField('montant', 'Montant (€)', rev.montant, 'number', 'step="0.01"')}</div>
        </div>
        ${inputField('description', 'Description', rev.description || '', 'text')}
        <div class="grid grid-cols-2 gap-2">
          <div>${categorieFieldHtml(store, 'revenus', rev.categorie)}</div>
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
        ${pocketSelectHtml(editRevPockets, rev.pocket || 'aucun', 'Ajouter au pocket')}
      `;
      openModal('Modifier l\'opération', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        data.compte = document.querySelector('input[name="compte"]:checked')?.value || rev.compte;
        const newAff = document.querySelector('input[name="affectation"]:checked')?.value || 'revenu';
        const pocketId = document.getElementById('pocket-select')?.value || 'aucun';
        const oldPocket = rev.pocket;
        const oldMontant = Number(rev.montant) || 0;
        const oldCompte = rev.compte || bankNames.primary;

        // Reverse old pocket credit
        if (oldPocket) deductFromPocket(store, bankNames, oldCompte, oldPocket, oldMontant);

        // If switched away from revenu → move to suiviDepenses
        if (newAff !== 'revenu') {
          store.set('suiviRevenus', revenus.filter(r => r.id !== id));
          if (newAff === 'investissement') data.categorie = 'Investissement';
          else if (newAff === 'virement') data.categorie = 'Virement';
          else if (newAff === 'ndf') data.categorie = 'NDF';
          else if (newAff === 'autre') data.categorie = 'Autre';
          const items = store.get('suiviDepenses') || [];
          items.unshift({ id: rev.id, date: data.date, description: data.description, montant: data.montant, compte: data.compte, categorie: data.categorie, pocket: pocketId !== 'aucun' ? pocketId : undefined });
          store.set('suiviDepenses', items);
          if (pocketId !== 'aucun') deductFromPocket(store, bankNames, data.compte, pocketId, data.montant);
        } else {
          data.pocket = pocketId !== 'aucun' ? pocketId : undefined;
          Object.assign(rev, data);
          store.set('suiviRevenus', revenus);
          if (data.pocket) deductFromPocket(store, bankNames, data.compte, data.pocket, -(Number(data.montant) || 0));
        }
        navigate('suivi-depenses');
      });
      setupPocketBankSync(store, bankNames);
      wireCategoryManager(document.getElementById('app-modal'), store, 'revenus');
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
        ${paiementFieldHtml(dep.paiement || 'prelevement')}
      `;
      openModal('Modifier la dépense mensuelle', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        dep.nom = data.nom || dep.nom;
        dep.montant = Number(data.montant) || dep.montant;
        dep.paiement = document.querySelector('input[name="paiement"]:checked')?.value || dep.paiement || 'prelevement';
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
      ${paiementFieldHtml('prelevement')}
    `;
    openModal('Ajouter une dépense mensuelle', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.nom || !data.montant) return;
      const list = store.get('depensesMensuellesCIC') || [];
      list.push({ id: 'mc-' + Date.now().toString(36), nom: data.nom, montant: Number(data.montant), paiement: document.querySelector('input[name="paiement"]:checked')?.value || 'prelevement' });
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
      const dcaList = store.get('dcaMensuelsTR') || [];
      const dcaItem = dcaList.find(d => d.id === id);
      if (cb.checked) {
        if (!month.expenses.includes(id)) month.expenses.push(id);
        if (dcaItem && dcaItem.pocket) deductFromPocket(store, bankNames, bankNames.secondary, dcaItem.pocket, dcaItem.montant);
        crediterLigneRecurrente(store, month, id, dcaItem);
      } else {
        month.expenses = month.expenses.filter(x => x !== id);
        if (dcaItem && dcaItem.pocket) deductFromPocket(store, bankNames, bankNames.secondary, dcaItem.pocket, -dcaItem.montant);
        annulerLigneRecurrente(store, month, id);
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
      const revList = store.get('revenusMensuelsTR') || [];
      const revItem = revList.find(r => r.id === id);
      if (cb.checked) {
        if (!month.revenues.includes(id)) month.revenues.push(id);
        if (revItem && revItem.pocket) deductFromPocket(store, bankNames, bankNames.secondary, revItem.pocket, -revItem.montant);
      } else {
        month.revenues = month.revenues.filter(x => x !== id);
        if (revItem && revItem.pocket) deductFromPocket(store, bankNames, bankNames.secondary, revItem.pocket, revItem.montant);
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
      const pockets = getBankPockets(store, bankNames, bankNames.secondary);
      const body = `
        ${inputField('nom', 'Nom', item.nom)}
        ${inputField('montant', 'Montant (€)', item.montant, 'number', '0.01')}
        ${paiementFieldHtml(item.paiement || 'investissement')}
        ${pocketSelectHtml(pockets, item.pocket || 'aucun')}
      `;
      openModal('Modifier le DCA', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const oldPocket = item.pocket;
        const oldMontant = Number(item.montant) || 0;
        item.nom = data.nom || item.nom;
        item.montant = Number(data.montant) || item.montant;
        item.paiement = document.querySelector('input[name="paiement"]:checked')?.value || item.paiement || 'investissement';
        const pk = document.getElementById('pocket-select')?.value || 'aucun';
        if (pk !== 'aucun') item.pocket = pk; else delete item.pocket;
        const mk = getCurrentMonthKey();
        const allConf = store.get('trRecurringConfirmed') || {};
        const conf = allConf[mk] || {};
        if ((conf.expenses || []).includes(id)) {
          if (oldPocket) deductFromPocket(store, bankNames, bankNames.secondary, oldPocket, -oldMontant);
          if (item.pocket) deductFromPocket(store, bankNames, bankNames.secondary, item.pocket, item.montant);
          annulerLigneRecurrente(store, conf, id);
          crediterLigneRecurrente(store, conf, id, item);
          allConf[mk] = conf;
          store.set('trRecurringConfirmed', allConf);
        }
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
      const pockets = getBankPockets(store, bankNames, bankNames.secondary);
      const body = `
        ${inputField('nom', 'Nom', item.nom)}
        ${inputField('montant', 'Montant (€)', item.montant, 'number', '0.01')}
        ${paiementFieldHtml(item.paiement || 'virement')}
        ${pocketSelectHtml(pockets, item.pocket || 'aucun', 'Ajouter au pocket')}
      `;
      openModal('Modifier le revenu mensuel', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const oldPocket = item.pocket;
        const oldMontant = Number(item.montant) || 0;
        item.nom = data.nom || item.nom;
        item.montant = Number(data.montant) || item.montant;
        item.paiement = document.querySelector('input[name="paiement"]:checked')?.value || item.paiement || 'virement';
        const pk = document.getElementById('pocket-select')?.value || 'aucun';
        if (pk !== 'aucun') item.pocket = pk; else delete item.pocket;
        // If confirmed, adjust pocket balances
        const mk = getCurrentMonthKey();
        const conf = (store.get('trRecurringConfirmed') || {})[mk] || {};
        if ((conf.revenues || []).includes(id)) {
          if (oldPocket) deductFromPocket(store, bankNames, bankNames.secondary, oldPocket, oldMontant);
          if (item.pocket) deductFromPocket(store, bankNames, bankNames.secondary, item.pocket, -item.montant);
        }
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
      const allConf = store.get('trRecurringConfirmed') || {};
      const conf = allConf[getCurrentMonthKey()];
      if (conf?.sbCredits?.[id]) { annulerLigneRecurrente(store, conf, id); store.set('trRecurringConfirmed', allConf); }
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
    const pockets = getBankPockets(store, bankNames, bankNames.secondary);
    const body = `
      ${inputField('nom', 'Nom', '')}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01"')}
      ${paiementFieldHtml('investissement')}
      ${pocketSelectHtml(pockets)}
    `;
    openModal('Ajouter un DCA mensuel', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.nom || !data.montant) return;
      const pk = document.getElementById('pocket-select')?.value || 'aucun';
      const list = store.get('dcaMensuelsTR') || [];
      const entry = { id: 'dca-' + Date.now().toString(36), nom: data.nom, montant: Number(data.montant), paiement: document.querySelector('input[name="paiement"]:checked')?.value || 'investissement' };
      if (pk !== 'aucun') entry.pocket = pk;
      list.push(entry);
      store.set('dcaMensuelsTR', list);
      navigate('suivi-depenses');
    });
  });

  // Add new TR Revenue recurring
  document.getElementById('btn-add-rev-tr')?.addEventListener('click', () => {
    const pockets = getBankPockets(store, bankNames, bankNames.secondary);
    const body = `
      ${inputField('nom', 'Nom', '')}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01"')}
      ${paiementFieldHtml('virement')}
      ${pocketSelectHtml(pockets, 'aucun', 'Ajouter au pocket')}
    `;
    openModal('Ajouter un revenu mensuel', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.nom || !data.montant) return;
      const pk = document.getElementById('pocket-select')?.value || 'aucun';
      const list = store.get('revenusMensuelsTR') || [];
      const entry = { id: 'rev-' + Date.now().toString(36), nom: data.nom, montant: Number(data.montant), paiement: document.querySelector('input[name="paiement"]:checked')?.value || 'virement' };
      if (pk !== 'aucun') entry.pocket = pk;
      list.push(entry);
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

  // --- Prélèvements automatiques toggle (checked=debited, unchecked=pending/barré) ---
  document.querySelectorAll('[data-tr-prelev-recurring]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.trPrelevRecurring;
      const monthKey = getCurrentMonthKey();
      const all = store.get('trRecurringConfirmed') || {};
      const month = all[monthKey] || { expenses: [], revenues: [], prelevements: [] };
      if (!month.prelevements) month.prelevements = [];
      const list = store.get('prelevementsTR') || [];
      const item = list.find(p => p.id === id);
      if (cb.checked) {
        if (!month.prelevements.includes(id)) month.prelevements.push(id);
        if (item && item.pocket) deductFromPocket(store, bankNames, bankNames.secondary, item.pocket, item.montant);
        crediterLigneRecurrente(store, month, id, item);
      } else {
        month.prelevements = month.prelevements.filter(x => x !== id);
        if (item && item.pocket) deductFromPocket(store, bankNames, bankNames.secondary, item.pocket, -item.montant);
        annulerLigneRecurrente(store, month, id);
      }
      all[monthKey] = month;
      store.set('trRecurringConfirmed', all);
      navigate('suivi-depenses');
    });
  });

  // Edit prélèvement
  document.querySelectorAll('[data-tr-prelev-edit]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.trPrelevEdit;
      const list = store.get('prelevementsTR') || [];
      const item = list.find(p => p.id === id);
      if (!item) return;
      const pockets = getBankPockets(store, bankNames, bankNames.secondary);
      const body = `
        ${inputField('nom', 'Nom', item.nom)}
        ${inputField('montant', 'Montant (€)', item.montant, 'number', '0.01')}
        ${paiementFieldHtml(item.paiement || 'prelevement')}
        ${pocketSelectHtml(pockets, item.pocket || 'aucun')}
      `;
      openModal('Modifier le prélèvement', body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        const oldPocket = item.pocket;
        const oldMontant = Number(item.montant) || 0;
        item.nom = data.nom || item.nom;
        item.montant = Number(data.montant) || item.montant;
        item.paiement = document.querySelector('input[name="paiement"]:checked')?.value || item.paiement || 'prelevement';
        const pk = document.getElementById('pocket-select')?.value || 'aucun';
        if (pk !== 'aucun') item.pocket = pk; else delete item.pocket;
        const mk = getCurrentMonthKey();
        const allConf = store.get('trRecurringConfirmed') || {};
        const conf = allConf[mk] || {};
        if ((conf.prelevements || []).includes(id)) {
          if (oldPocket) deductFromPocket(store, bankNames, bankNames.secondary, oldPocket, -oldMontant);
          if (item.pocket) deductFromPocket(store, bankNames, bankNames.secondary, item.pocket, item.montant);
          annulerLigneRecurrente(store, conf, id);
          crediterLigneRecurrente(store, conf, id, item);
          allConf[mk] = conf;
          store.set('trRecurringConfirmed', allConf);
        }
        store.set('prelevementsTR', list);
        navigate('suivi-depenses');
      });
    });
  });

  // Delete prélèvement
  document.querySelectorAll('[data-tr-prelev-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.trPrelevDel;
      const list = store.get('prelevementsTR') || [];
      const allConf = store.get('trRecurringConfirmed') || {};
      const conf = allConf[getCurrentMonthKey()];
      if (conf?.sbCredits?.[id]) { annulerLigneRecurrente(store, conf, id); store.set('trRecurringConfirmed', allConf); }
      store.set('prelevementsTR', list.filter(p => p.id !== id));
      navigate('suivi-depenses');
    });
  });

  // Add new prélèvement
  document.getElementById('btn-add-prelev-tr')?.addEventListener('click', () => {
    const pockets = getBankPockets(store, bankNames, bankNames.secondary);
    const body = `
      ${inputField('nom', 'Nom', '', 'text', 'placeholder="Ex: Netflix, Assurance..."')}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01"')}
      ${paiementFieldHtml('prelevement')}
      ${pocketSelectHtml(pockets)}
    `;
    openModal('Ajouter un prélèvement', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.nom || !data.montant) return;
      const pocketId = document.getElementById('pocket-select')?.value || 'aucun';
      const list = store.get('prelevementsTR') || [];
      const entry = { id: 'prelev-' + Date.now().toString(36), nom: data.nom, montant: Number(data.montant), paiement: document.querySelector('input[name="paiement"]:checked')?.value || 'prelevement' };
      if (pocketId !== 'aucun') entry.pocket = pocketId;
      list.push(entry);
      store.set('prelevementsTR', list);
      navigate('suivi-depenses');
    });
  });

  // Drag-and-drop reorder prélèvements
  {
    let draggedId = null;
    document.querySelectorAll('.tr-prelev-drag-row').forEach(row => {
      row.addEventListener('dragstart', (e) => { draggedId = row.dataset.dragPrelevId; row.style.opacity = '0.4'; e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', () => { row.style.opacity = ''; document.querySelectorAll('.tr-prelev-drag-row').forEach(r => r.classList.remove('drag-over')); });
      row.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => { row.classList.remove('drag-over'); });
      row.addEventListener('drop', (e) => {
        e.preventDefault(); row.classList.remove('drag-over');
        const targetId = row.dataset.dragPrelevId;
        if (!draggedId || draggedId === targetId) return;
        const list = store.get('prelevementsTR') || [];
        const fromIdx = list.findIndex(p => p.id === draggedId);
        const toIdx = list.findIndex(p => p.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        store.set('prelevementsTR', list);
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

  // Pocket grid drag-and-drop
  function setupPocketGridDrag(gridId, orderKey) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    let draggedPkId = null;
    grid.querySelectorAll('.pk-drag-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedPkId = item.dataset.pkDragId;
        item.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        item.style.opacity = '';
        grid.querySelectorAll('.pk-drag-item').forEach(i => i.classList.remove('ring-2', 'ring-accent-blue'));
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('ring-2', 'ring-accent-blue');
      });
      item.addEventListener('dragleave', () => {
        item.classList.remove('ring-2', 'ring-accent-blue');
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('ring-2', 'ring-accent-blue');
        const targetId = item.dataset.pkDragId;
        if (!draggedPkId || draggedPkId === targetId) return;
        const items = [...grid.querySelectorAll('.pk-drag-item')];
        const order = items.map(i => i.dataset.pkDragId);
        const fromIdx = order.indexOf(draggedPkId);
        const toIdx = order.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = order.splice(fromIdx, 1);
        order.splice(toIdx, 0, moved);
        store.set(orderKey, order);
        navigate('suivi-depenses');
      });
    });
  }
  setupPocketGridDrag('pocket-grid-tr', 'pocketOrderTR');
  setupPocketGridDrag('pocket-grid-cic', 'pocketOrderCIC');
  extraBanks.forEach(bank => setupPocketGridDrag('pocket-grid-' + bank.id, 'pocketOrder_' + bank.id));

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
    const virDefaultBank = bankNames.secondary;
    const virPockets = getBankPockets(store, bankNames, virDefaultBank);
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', `placeholder="Ex: Virement vers ${bankNames.primary}"`)}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 500"')}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
        <div class="flex gap-3">
          ${COMPTES.map(c => `
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-amber-400/40 transition has-[:checked]:border-amber-400 has-[:checked]:bg-amber-400/10">
              <input type="radio" name="compte" value="${c}" ${c === virDefaultBank ? 'checked' : ''} class="w-4 h-4 text-amber-400 bg-dark-800 border-dark-400 focus:ring-amber-400/40">
              <span class="text-sm text-gray-200">${c}</span>
            </label>
          `).join('')}
        </div>
      </div>
      ${pocketSelectHtml(virPockets)}
    `;
    openModal('Ajouter un virement', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.secondary;
      data.categorie = 'Virement';
      if (!(Number(data.montant) > 0)) { showModalError('Indique un montant supérieur à 0.'); return false; }
      const pocketId = document.getElementById('pocket-select')?.value || 'aucun';
      const items = store.get('suiviDepenses') || [];
      items.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pocket: pocketId !== 'aucun' ? pocketId : undefined, ...data });
      store.set('suiviDepenses', items);
      deductFromPocket(store, bankNames, data.compte, pocketId, data.montant);
      showToast('Virement ajouté ✓', 'success', 2000);
      navigate('suivi-depenses');
    });
    setupPocketBankSync(store, bankNames);
  });

  // Add Investissement (shortcut)
  document.getElementById('btn-add-invest')?.addEventListener('click', () => {
    const invDefaultBank = bankNames.secondary;
    const invPockets = getBankPockets(store, bankNames, invDefaultBank);
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', 'placeholder="Ex: DCA PEA, Achat Bitcoin..."')}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 300"')}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
        <div class="flex gap-3">
          ${COMPTES.map(c => `
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-blue-400/40 transition has-[:checked]:border-blue-400 has-[:checked]:bg-blue-400/10">
              <input type="radio" name="compte" value="${c}" ${c === invDefaultBank ? 'checked' : ''} class="w-4 h-4 text-blue-400 bg-dark-800 border-dark-400 focus:ring-blue-400/40">
              <span class="text-sm text-gray-200">${c}</span>
            </label>
          `).join('')}
        </div>
      </div>
      ${pocketSelectHtml(invPockets)}
    `;
    openModal('Ajouter un investissement', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.secondary;
      data.categorie = 'Investissement';
      if (!(Number(data.montant) > 0)) { showModalError('Indique un montant supérieur à 0.'); return false; }
      const pocketId = document.getElementById('pocket-select')?.value || 'aucun';
      const items = store.get('suiviDepenses') || [];
      items.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pocket: pocketId !== 'aucun' ? pocketId : undefined, ...data });
      store.set('suiviDepenses', items);
      deductFromPocket(store, bankNames, data.compte, pocketId, data.montant);
      showToast('Investissement ajouté ✓', 'success', 2000);
      navigate('suivi-depenses');
    });
    setupPocketBankSync(store, bankNames);
  });

  // Add NDF (shortcut)
  document.getElementById('btn-add-ndf')?.addEventListener('click', () => {
    const ndfDefaultBank = bankNames.secondary;
    const ndfPockets = getBankPockets(store, bankNames, ndfDefaultBank);
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', 'placeholder="Ex: Restaurant client"')}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 35.50"')}
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
        <div class="flex gap-3">
          ${COMPTES.map(c => `
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-purple-400/40 transition has-[:checked]:border-purple-400 has-[:checked]:bg-purple-400/10">
              <input type="radio" name="compte" value="${c}" ${c === ndfDefaultBank ? 'checked' : ''} class="w-4 h-4 text-purple-400 bg-dark-800 border-dark-400 focus:ring-purple-400/40">
              <span class="text-sm text-gray-200">${c}</span>
            </label>
          `).join('')}
        </div>
      </div>
      ${pocketSelectHtml(ndfPockets)}
    `;
    openModal('Ajouter une NDF', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || bankNames.secondary;
      data.categorie = 'NDF';
      if (!(Number(data.montant) > 0)) { showModalError('Indique un montant supérieur à 0.'); return false; }
      const pocketId = document.getElementById('pocket-select')?.value || 'aucun';
      const items = store.get('suiviDepenses') || [];
      items.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pocket: pocketId !== 'aucun' ? pocketId : undefined, ...data });
      store.set('suiviDepenses', items);
      deductFromPocket(store, bankNames, data.compte, pocketId, data.montant);
      showToast('NDF ajoutée ✓', 'success', 2000);
      navigate('suivi-depenses');
    });
    setupPocketBankSync(store, bankNames);
  });

  document.querySelectorAll('[data-del-expense]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delExpense;
      const items = store.get('suiviDepenses') || [];
      const item = items.find(i => i.id === id);
      if (item && item.pocket) deductFromPocket(store, bankNames, item.compte || bankNames.secondary, item.pocket, -(Number(item.montant) || 0));
      if (item) { annulerSaveback(store, item.sb); annulerRoundup(store, item.ru); }
      store.set('suiviDepenses', items.filter(i => i.id !== id));
      navigate('suivi-depenses');
    });
  });

  document.querySelectorAll('[data-del-revenu]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delRevenu;
      const revenus = store.get('suiviRevenus') || [];
      const rev = revenus.find(r => r.id === id);
      if (rev && rev.pocket) deductFromPocket(store, bankNames, rev.compte || bankNames.primary, rev.pocket, Number(rev.montant) || 0);
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
