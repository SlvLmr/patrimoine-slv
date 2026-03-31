import { formatCurrency, formatCurrencyCents, parseNumberInput } from '../utils.js?v=10';
import { createChart, COLORS } from '../charts/chart-config.js';

// ─── Simulateur Auto : Crédit vs LOA vs LLD ─────────────────────────────────
// Standalone — compare the true cost of car financing options.

const STORAGE_KEY = 'sim-auto-saves';

const DEFAULTS = {
  prixVehicule: 30000,
  apport: 5000,
  duree: 48,           // mois
  tauxCredit: 5.5,     // %
  assuranceCredit: 30,  // €/mois
  // LOA
  loyerLOA: 350,
  apportLOA: 3000,
  dureeLOA: 48,
  kmAnnuelLOA: 15000,
  valeurRachatLOA: 8000,
  // LLD
  loyerLLD: 400,
  apportLLD: 0,
  dureeLLD: 48,
  kmAnnuelLLD: 15000,
  // Common
  entretienCredit: 100,  // €/mois (entretien + assurance auto pour crédit)
  decoteAnnuelle: 15,    // %
  dureeDetention: 48,    // mois — durée pour comparer
};

const FIELD_MAP = {
  'auto-prix': 'prixVehicule', 'auto-apport': 'apport', 'auto-duree-credit': 'duree',
  'auto-taux': 'tauxCredit', 'auto-assurance-credit': 'assuranceCredit',
  'auto-loyer-loa': 'loyerLOA', 'auto-apport-loa': 'apportLOA', 'auto-duree-loa': 'dureeLOA',
  'auto-km-loa': 'kmAnnuelLOA', 'auto-rachat-loa': 'valeurRachatLOA',
  'auto-loyer-lld': 'loyerLLD', 'auto-apport-lld': 'apportLLD', 'auto-duree-lld': 'dureeLLD',
  'auto-km-lld': 'kmAnnuelLLD',
  'auto-entretien': 'entretienCredit', 'auto-decote': 'decoteAnnuelle', 'auto-duree-detention': 'dureeDetention',
};

const FIELD_IDS = Object.keys(FIELD_MAP);

// ─── Save / Load ─────────────────────────────────────────────────────────────

function getSaves() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function writeSaves(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
function saveCurrentInputs(name) { const saves = getSaves(); saves.push({ name, date: new Date().toISOString(), inputs: getInputs() }); writeSaves(saves); }
function deleteSave(i) { const s = getSaves(); s.splice(i, 1); writeSaves(s); }
function loadSave(index) {
  const save = getSaves()[index];
  if (!save) return;
  for (const [id, key] of Object.entries(FIELD_MAP)) {
    const val = save.inputs[key];
    const input = document.getElementById(id);
    const range = document.getElementById(id + '-range');
    if (input && val !== undefined) { input.value = val; if (range) range.value = val; }
  }
}

// ─── Computation ─────────────────────────────────────────────────────────────

function getInputs() {
  const v = (id) => parseNumberInput(document.getElementById(id)?.value);
  const result = {};
  for (const [id, key] of Object.entries(FIELD_MAP)) result[key] = v(id);
  return result;
}

function compute(inp) {
  const mois = inp.dureeDetention;

  // ─── CRÉDIT CLASSIQUE ───
  const montantEmprunte = Math.max(inp.prixVehicule - inp.apport, 0);
  const tauxMensuel = (inp.tauxCredit / 100) / 12;
  const nbMens = inp.duree;
  let mensualiteCredit = 0;
  if (tauxMensuel > 0 && nbMens > 0) {
    mensualiteCredit = montantEmprunte * tauxMensuel / (1 - Math.pow(1 + tauxMensuel, -nbMens));
  } else if (nbMens > 0) {
    mensualiteCredit = montantEmprunte / nbMens;
  }

  const totalMensualitesCredit = mensualiteCredit * Math.min(nbMens, mois);
  const interetsCredit = mensualiteCredit * nbMens - montantEmprunte;
  const assuranceTotaleCredit = inp.assuranceCredit * mois;
  const entretienTotalCredit = inp.entretienCredit * mois;

  // Valeur résiduelle du véhicule après détention
  const annees = mois / 12;
  const valeurResiduelle = inp.prixVehicule * Math.pow(1 - inp.decoteAnnuelle / 100, annees);

  const coutTotalCredit = inp.apport + totalMensualitesCredit + assuranceTotaleCredit + entretienTotalCredit - valeurResiduelle;
  const coutMensuelCredit = coutTotalCredit / mois;

  // ─── LOA ───
  const totalLOA = inp.apportLOA + inp.loyerLOA * Math.min(inp.dureeLOA, mois);
  const coutTotalLOASansRachat = totalLOA;
  const coutTotalLOAAvecRachat = totalLOA + inp.valeurRachatLOA;
  // Si rachat : on possède le véhicule → valeur résiduelle post-rachat
  const valeurPostRachat = inp.valeurRachatLOA > 0 ? valeurResiduelle : 0;
  const coutNetLOARachat = coutTotalLOAAvecRachat - valeurPostRachat;
  const coutMensuelLOA = coutTotalLOASansRachat / mois;
  const coutMensuelLOARachat = coutNetLOARachat / mois;

  // ─── LLD ───
  const totalLLD = inp.apportLLD + inp.loyerLLD * Math.min(inp.dureeLLD, mois);
  const coutTotalLLD = totalLLD;
  const coutMensuelLLD = coutTotalLLD / mois;

  // ─── Comparaison mois par mois ───
  const timeline = [];
  let cumulCredit = inp.apport;
  let cumulLOA = inp.apportLOA;
  let cumulLLD = inp.apportLLD;

  for (let m = 0; m <= mois; m++) {
    timeline.push({ mois: m, credit: cumulCredit, loa: cumulLOA, lld: cumulLLD });
    if (m < mois) {
      if (m < nbMens) cumulCredit += mensualiteCredit + inp.assuranceCredit + inp.entretienCredit;
      else cumulCredit += inp.entretienCredit; // crédit fini, mais entretien continue
      if (m < inp.dureeLOA) cumulLOA += inp.loyerLOA;
      if (m < inp.dureeLLD) cumulLLD += inp.loyerLLD;
    }
  }

  // Best option
  const options = [
    { key: 'credit', label: 'Crédit classique', coutTotal: coutTotalCredit, coutMensuel: coutMensuelCredit },
    { key: 'loa', label: 'LOA (sans rachat)', coutTotal: coutTotalLOASansRachat, coutMensuel: coutMensuelLOA },
    { key: 'loa-rachat', label: 'LOA (avec rachat)', coutTotal: coutNetLOARachat, coutMensuel: coutMensuelLOARachat },
    { key: 'lld', label: 'LLD', coutTotal: coutTotalLLD, coutMensuel: coutMensuelLLD },
  ];
  options.sort((a, b) => a.coutTotal - b.coutTotal);

  return {
    credit: { mensualite: mensualiteCredit, interets: interetsCredit, coutTotal: coutTotalCredit, coutMensuel: coutMensuelCredit, valeurResiduelle, assurance: assuranceTotaleCredit, entretien: entretienTotalCredit, apport: inp.apport },
    loa: { loyer: inp.loyerLOA, coutSansRachat: coutTotalLOASansRachat, coutAvecRachat: coutNetLOARachat, rachat: inp.valeurRachatLOA, coutMensuel: coutMensuelLOA, apport: inp.apportLOA },
    lld: { loyer: inp.loyerLLD, coutTotal: coutTotalLLD, coutMensuel: coutMensuelLLD, apport: inp.apportLLD },
    options,
    timeline,
    mois,
    valeurResiduelle,
  };
}

// ─── Render ──────────────────────────────────────────────────────────────────

function inp(id, label, val, unit, min, max, step) {
  return `
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label for="${id}" class="text-sm text-gray-400">${label}</label>
        <div class="flex items-center gap-1.5">
          <input type="number" id="${id}" value="${val}" min="${min}" max="${max}" step="${step}"
            class="w-24 input-field [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
          <span class="text-xs text-gray-500 w-12">${unit}</span>
        </div>
      </div>
      <input type="range" id="${id}-range" min="${min}" max="${max}" step="${step}" value="${val}"
        class="w-full h-1.5 bg-dark-600 rounded-full appearance-none cursor-pointer accent-violet-500
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:shadow-lg
        [&::-webkit-slider-thumb]:cursor-pointer">
    </div>
  `;
}

export function render() {
  const d = DEFAULTS;
  return `
  <div class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 17h.01M16 17h.01M2 9h20M5 17h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
        </div>
        Crédit voiture
      </h2>
      <p class="text-gray-500 text-sm mt-1">Compare Crédit classique, LOA et LLD pour faire le meilleur choix</p>
      <div class="mt-3 p-3 rounded-xl bg-violet-500/5 border border-violet-500/10">
        <p class="text-xs text-violet-400/80"><span class="font-semibold">Outil autonome</span> — Indépendant de tes données personnelles.</p>
      </div>
    </div>

    <!-- Save bar -->
    <div class="card-dark rounded-2xl overflow-hidden">
      <button id="auto-save-toggle" class="w-full flex items-center justify-between px-4 py-3 hover:bg-dark-600/30 transition">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
          <span class="text-sm font-medium text-gray-400">Sauvegardes</span>
          <span id="auto-save-count" class="text-xs text-gray-600"></span>
        </div>
        <svg id="auto-save-chevron" class="w-4 h-4 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div id="auto-save-panel" class="hidden px-4 pb-4">
        <div id="auto-save-content" class="flex items-center gap-2 flex-wrap"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- LEFT: Inputs -->
      <div class="lg:col-span-5 space-y-4">

        <!-- Véhicule -->
        <div class="card-dark rounded-2xl p-3 sm:p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 17h.01M16 17h.01M2 9h20M5 17h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            Véhicule & général
          </h3>
          ${inp('auto-prix', 'Prix du véhicule', d.prixVehicule, '€', 5000, 200000, 500)}
          ${inp('auto-decote', 'Décote annuelle', d.decoteAnnuelle, '%', 5, 30, 1)}
          ${inp('auto-entretien', 'Entretien + assurance (crédit)', d.entretienCredit, '€/mois', 0, 500, 10)}
          ${inp('auto-duree-detention', 'Durée de comparaison', d.dureeDetention, 'mois', 12, 84, 6)}
        </div>

        <!-- Crédit -->
        <div class="card-dark rounded-2xl p-3 sm:p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-blue-500"></span>
            Crédit classique
          </h3>
          ${inp('auto-apport', 'Apport', d.apport, '€', 0, 100000, 500)}
          ${inp('auto-duree-credit', 'Durée du crédit', d.duree, 'mois', 12, 84, 6)}
          ${inp('auto-taux', 'Taux annuel', d.tauxCredit, '%', 0, 15, 0.1)}
          ${inp('auto-assurance-credit', 'Assurance emprunteur', d.assuranceCredit, '€/mois', 0, 100, 5)}
          <div class="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <p class="text-xs text-gray-500"><span class="text-blue-400 font-medium">Propriétaire</span> du véhicule dès l'achat. Frais d'entretien, assurance et revente à ta charge.</p>
          </div>
        </div>

        <!-- LOA -->
        <div class="card-dark rounded-2xl p-3 sm:p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-amber-500"></span>
            LOA (Location avec Option d'Achat)
          </h3>
          ${inp('auto-apport-loa', 'Premier loyer majoré', d.apportLOA, '€', 0, 50000, 500)}
          ${inp('auto-loyer-loa', 'Loyer mensuel', d.loyerLOA, '€/mois', 100, 2000, 10)}
          ${inp('auto-duree-loa', 'Durée', d.dureeLOA, 'mois', 12, 72, 6)}
          ${inp('auto-km-loa', 'Kilométrage annuel', d.kmAnnuelLOA, 'km/an', 5000, 50000, 1000)}
          ${inp('auto-rachat-loa', 'Option d\'achat (rachat)', d.valeurRachatLOA, '€', 0, 50000, 500)}
          <div class="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <p class="text-xs text-gray-500"><span class="text-amber-400 font-medium">Locataire</span> avec option de rachat en fin de contrat. Entretien souvent inclus. Pénalités si dépassement km.</p>
          </div>
        </div>

        <!-- LLD -->
        <div class="card-dark rounded-2xl p-3 sm:p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-pink-500"></span>
            LLD (Location Longue Durée)
          </h3>
          ${inp('auto-apport-lld', 'Premier loyer majoré', d.apportLLD, '€', 0, 20000, 500)}
          ${inp('auto-loyer-lld', 'Loyer mensuel', d.loyerLLD, '€/mois', 100, 2000, 10)}
          ${inp('auto-duree-lld', 'Durée', d.dureeLLD, 'mois', 12, 72, 6)}
          ${inp('auto-km-lld', 'Kilométrage annuel', d.kmAnnuelLLD, 'km/an', 5000, 50000, 1000)}
          <div class="p-2.5 rounded-lg bg-pink-500/5 border border-pink-500/10">
            <p class="text-xs text-gray-500"><span class="text-pink-400 font-medium">Locataire pur</span> — Entretien, assurance et assistance souvent inclus. Aucune option de rachat. Tu rends le véhicule.</p>
          </div>
        </div>
      </div>

      <!-- RIGHT: Results -->
      <div class="lg:col-span-7 space-y-4">

        <!-- Winner card -->
        <div id="auto-winner" class="card-dark rounded-2xl p-3 sm:p-5"></div>

        <!-- Comparison cards -->
        <div id="auto-compare" class="grid grid-cols-1 sm:grid-cols-3 gap-3"></div>

        <!-- Differences table -->
        <div class="card-dark rounded-2xl p-3 sm:p-5">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Comparatif détaillé</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm" id="auto-detail-table">
              <thead>
                <tr class="text-gray-500 text-xs uppercase border-b border-dark-400/30">
                  <th class="text-left py-2 px-2"></th>
                  <th class="text-center py-2 px-2"><span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>Crédit</th>
                  <th class="text-center py-2 px-2"><span class="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1"></span>LOA</th>
                  <th class="text-center py-2 px-2"><span class="inline-block w-2 h-2 rounded-full bg-pink-500 mr-1"></span>LLD</th>
                </tr>
              </thead>
              <tbody id="auto-detail-body"></tbody>
            </table>
          </div>
        </div>

        <!-- Chart -->
        <div class="card-dark rounded-2xl p-3 sm:p-5">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Coût cumulé dans le temps</h3>
          <div class="h-80">
            <canvas id="auto-chart"></canvas>
          </div>
        </div>

        <!-- Pros/Cons -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${prosConsCard('Crédit classique', 'blue', [
            'Propriétaire du véhicule',
            'Revente libre à tout moment',
            'Pas de limite de km',
          ], [
            'Décote à supporter',
            'Entretien à ta charge',
            'Apport souvent requis',
          ])}
          ${prosConsCard('LOA', 'amber', [
            'Loyers souvent plus bas',
            'Option de rachat en fin',
            'Entretien parfois inclus',
          ], [
            'Pas propriétaire pendant le contrat',
            'Pénalités km excédentaires',
            'Coût total souvent élevé',
          ])}
          ${prosConsCard('LLD', 'pink', [
            'Tout inclus (entretien, assurance)',
            'Budget prévisible',
            'Pas de risque de décote',
          ], [
            'Jamais propriétaire',
            'Loyer souvent le plus cher',
            'Pénalités km + état du véhicule',
          ])}
        </div>

        <div class="info-box">
          <p class="text-xs text-gray-600">Simulation indicative. Les loyers LOA/LLD réels dépendent du concessionnaire, du modèle et de votre profil. Les coûts d'entretien pour le crédit sont estimatifs.</p>
        </div>
      </div>
    </div>
  </div>
  `;
}

function prosConsCard(title, color, pros, cons) {
  return `
    <div class="card-dark rounded-2xl p-4">
      <h4 class="text-sm font-semibold text-${color}-400 mb-2">${title}</h4>
      <div class="space-y-1 mb-3">
        ${pros.map(p => `<div class="flex items-start gap-1.5"><span class="text-accent-green text-xs mt-0.5">+</span><span class="text-xs text-gray-400">${p}</span></div>`).join('')}
      </div>
      <div class="space-y-1">
        ${cons.map(c => `<div class="flex items-start gap-1.5"><span class="text-red-400 text-xs mt-0.5">-</span><span class="text-xs text-gray-500">${c}</span></div>`).join('')}
      </div>
    </div>
  `;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

let _store = null;

function saveState() {
  if (!_store) return;
  const data = {};
  FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) data[id] = el.value;
  });
  _store.set('simAuto', data);
}

function restoreState() {
  if (!_store) return;
  const data = _store.get('simAuto');
  if (!data) return;
  FIELD_IDS.forEach(id => {
    const val = data[id];
    if (val === undefined) return;
    const input = document.getElementById(id);
    const range = document.getElementById(id + '-range');
    if (input) { input.value = val; if (range) range.value = val; }
  });
}

export function mount(store) {
  _store = store || null;

  FIELD_IDS.forEach(id => {
    const input = document.getElementById(id);
    const range = document.getElementById(id + '-range');
    if (!input || !range) return;
    input.addEventListener('input', () => { range.value = input.value; recalculate(); });
    range.addEventListener('input', () => { input.value = range.value; recalculate(); });
  });

  document.getElementById('auto-save-toggle')?.addEventListener('click', () => {
    document.getElementById('auto-save-panel').classList.toggle('hidden');
    document.getElementById('auto-save-chevron').classList.toggle('rotate-180');
  });

  refreshSaveBar();
  restoreState();
  recalculate();
}

function refreshSaveBar() {
  const container = document.getElementById('auto-save-content');
  const countEl = document.getElementById('auto-save-count');
  if (!container) return;
  const saves = getSaves();
  if (countEl) countEl.textContent = saves.length > 0 ? `(${saves.length})` : '';

  const options = saves.map((s, i) => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `<option value="${i}">${s.name} — ${dateStr}</option>`;
  }).join('');

  container.innerHTML = `
    <select id="auto-save-select" class="flex-1 min-w-0 input-field">
      <option value="">Choisir un scénario…</option>${options}
    </select>
    <button id="auto-load-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 transition disabled:opacity-30" ${saves.length === 0 ? 'disabled' : ''}>Charger</button>
    <button id="auto-delete-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-30" ${saves.length === 0 ? 'disabled' : ''}>Suppr.</button>
    <span class="mx-1 h-5 w-px bg-dark-400/50 hidden sm:block"></span>
    <button id="auto-save-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition">Sauvegarder</button>
  `;

  document.getElementById('auto-save-btn')?.addEventListener('click', () => {
    const name = prompt('Nom du scénario :');
    if (name && name.trim()) { saveCurrentInputs(name.trim()); refreshSaveBar(); }
  });
  document.getElementById('auto-load-btn')?.addEventListener('click', () => {
    const idx = parseInt(document.getElementById('auto-save-select')?.value);
    if (!isNaN(idx)) { loadSave(idx); recalculate(); }
  });
  document.getElementById('auto-delete-btn')?.addEventListener('click', () => {
    const idx = parseInt(document.getElementById('auto-save-select')?.value);
    if (!isNaN(idx)) { deleteSave(idx); refreshSaveBar(); }
  });
}

function recalculate() {
  const inputs = getInputs();
  const r = compute(inputs);
  renderWinner(r);
  renderCompare(r);
  renderDetailTable(r, inputs);
  renderChart(r);
  saveState();
}

// ─── Winner ──────────────────────────────────────────────────────────────────

function renderWinner(r) {
  const el = document.getElementById('auto-winner');
  if (!el) return;
  const best = r.options[0];
  const worst = r.options[r.options.length - 1];
  const economy = worst.coutTotal - best.coutTotal;
  const colors = { credit: 'blue', loa: 'amber', 'loa-rachat': 'amber', lld: 'pink' };
  const c = colors[best.key] || 'blue';

  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <p class="text-xs text-gray-500 uppercase tracking-wider">Option la plus économique</p>
        <p class="text-lg sm:text-xl font-bold text-${c}-400 mt-1">${best.label}</p>
        <p class="text-sm text-gray-400 mt-1">Coût net : <span class="font-semibold text-gray-200">${formatCurrency(Math.round(best.coutTotal))}</span> sur ${r.mois} mois</p>
        ${economy > 0 ? `<p class="text-xs text-accent-green mt-1">Économie de ${formatCurrency(Math.round(economy))} vs la pire option</p>` : ''}
      </div>
      <div class="w-14 h-14 rounded-2xl bg-${c}-500/10 flex items-center justify-center">
        <svg class="w-7 h-7 text-${c}-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
    </div>
  `;
}

// ─── Compare Cards ───────────────────────────────────────────────────────────

function renderCompare(r) {
  const el = document.getElementById('auto-compare');
  if (!el) return;
  const bestTotal = r.options[0].coutTotal;

  el.innerHTML = `
    ${compareCard('Crédit', 'blue', r.credit.coutTotal, r.credit.coutMensuel, r.credit.coutTotal === bestTotal)}
    ${compareCard('LOA (sans rachat)', 'amber', r.loa.coutSansRachat, r.loa.coutMensuel, r.loa.coutSansRachat === bestTotal)}
    ${compareCard('LLD', 'pink', r.lld.coutTotal, r.lld.coutMensuel, r.lld.coutTotal === bestTotal)}
  `;
}

function compareCard(label, color, total, mensuel, isBest) {
  return `
    <div class="card-dark rounded-2xl p-4 ${isBest ? `ring-1 ring-${color}-500/30 bg-${color}-500/5` : ''}">
      <div class="flex items-center gap-2 mb-2">
        <span class="w-2 h-2 rounded-full bg-${color}-500"></span>
        <p class="text-xs text-gray-500 uppercase tracking-wider">${label}</p>
        ${isBest ? '<span class="text-[10px] text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded-full ml-auto">Meilleur</span>' : ''}
      </div>
      <p class="text-lg font-bold text-${color}-400">${formatCurrency(Math.round(total))}</p>
      <p class="text-xs text-gray-500">${formatCurrency(Math.round(mensuel))}/mois net</p>
    </div>
  `;
}

// ─── Detail Table ────────────────────────────────────────────────────────────

function renderDetailTable(r, inp) {
  const tbody = document.getElementById('auto-detail-body');
  if (!tbody) return;

  const row = (label, credit, loa, lld, isCurrency = true) => {
    const fmt = (v) => isCurrency ? formatCurrency(Math.round(v)) : v;
    return `<tr class="table-row">
      <td class="py-2 px-2 text-gray-400 text-xs">${label}</td>
      <td class="py-2 px-2 text-center font-mono text-sm text-blue-400">${fmt(credit)}</td>
      <td class="py-2 px-2 text-center font-mono text-sm text-amber-400">${fmt(loa)}</td>
      <td class="py-2 px-2 text-center font-mono text-sm text-pink-400">${fmt(lld)}</td>
    </tr>`;
  };

  tbody.innerHTML = `
    ${row('Apport / 1er loyer', r.credit.apport, r.loa.apport, r.lld.apport)}
    ${row('Mensualité / Loyer', r.credit.mensualite, r.loa.loyer, r.lld.loyer)}
    ${row('Entretien + assurance', inp.entretienCredit + '/mois', 'Inclus*', 'Inclus*', false)}
    ${row('Propriétaire', 'Oui', 'En option', 'Non', false)}
    ${row('Km limité', 'Non', inp.kmAnnuelLOA.toLocaleString('fr-FR') + ' km/an', inp.kmAnnuelLLD.toLocaleString('fr-FR') + ' km/an', false)}
    ${row('Valeur résiduelle', r.valeurResiduelle, 0, 0)}
    ${row('Coût net total', r.credit.coutTotal, r.loa.coutSansRachat, r.lld.coutTotal)}
    ${row('Coût mensuel net', r.credit.coutMensuel, r.loa.coutMensuel, r.lld.coutMensuel)}
  `;
}

// ─── Chart ───────────────────────────────────────────────────────────────────

function renderChart(r) {
  const canvas = document.getElementById('auto-chart');
  if (!canvas) return;

  // Downsample to every 3 months
  const data = r.timeline.filter((_, i) => i % 3 === 0 || i === r.timeline.length - 1);
  const labels = data.map(d => d.mois === 0 ? 'Début' : d.mois + ' mois');

  createChart('auto-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Crédit', data: data.map(d => Math.round(d.credit)), borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false },
        { label: 'LOA', data: data.map(d => Math.round(d.loa)), borderColor: '#f59e0b', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false },
        { label: 'LLD', data: data.map(d => Math.round(d.lld)), borderColor: '#ec4899', borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 4, tension: 0.3, fill: false },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.gridText, font: { size: 11 }, maxTicksLimit: 12 } },
        y: {
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.gridText, font: { size: 11 }, callback: v => v >= 1000 ? Math.round(v / 1000) + ' k€' : v + ' €' },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, color: '#e5e7eb', font: { size: 12, family: 'Inter' } } },
        tooltip: {
          backgroundColor: 'rgba(11,11,15,0.95)', titleColor: '#e9d5ff', bodyColor: '#a0a0a5',
          borderColor: 'rgba(56,56,63,0.6)', borderWidth: 1, padding: 12, cornerRadius: 10,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` },
        },
      }
    }
  });
}
