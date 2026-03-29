import { formatCurrency, formatPercent, parseNumberInput } from '../utils.js?v=7';
import { createChart, createVerticalGradient, COLORS } from '../charts/chart-config.js';

// ─── FIRE Simulator ─────────────────────────────────────────────────────────
// Standalone tool — not connected to user patrimoine data.
// Inspired by sinvestir.fr/simulateur-independance-financiere

const STORAGE_KEY = 'sim-fire-saves';

const DEFAULTS = {
  age: 30,
  capitalActuel: 50000,
  revenusMensuelNets: 3500,
  depensesMensuelles: 2000,
  epargneMensuelle: 1000,
  rendementAnnuel: 7,
  inflation: 2,
  tauxRetrait: 4,
  depensesRetraite: 2000,
  revenusPassifsRetraite: 0,
  ageRetraiteLegale: 64,
  pensionMensuelle: 0,
};

const FIELD_IDS = [
  'fire-age', 'fire-capital', 'fire-revenus', 'fire-depenses', 'fire-epargne',
  'fire-rendement', 'fire-inflation', 'fire-swr',
  'fire-depenses-retraite', 'fire-revenus-passifs', 'fire-age-retraite-legale', 'fire-pension',
];

// ─── Save / Load helpers ─────────────────────────────────────────────────────

function getSaves() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function writeSaves(saves) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
}

function saveCurrentInputs(name) {
  const inputs = getInputs();
  const saves = getSaves();
  saves.push({ name, date: new Date().toISOString(), inputs });
  writeSaves(saves);
}

function deleteSave(index) {
  const saves = getSaves();
  saves.splice(index, 1);
  writeSaves(saves);
}

function loadSave(index) {
  const saves = getSaves();
  const save = saves[index];
  if (!save) return;
  applyInputs(save.inputs);
}

function applyInputs(values) {
  const map = {
    'fire-age': values.age,
    'fire-capital': values.capitalActuel,
    'fire-revenus': values.revenusMensuelNets,
    'fire-depenses': values.depensesMensuelles,
    'fire-epargne': values.epargneMensuelle,
    'fire-rendement': values.rendementAnnuel,
    'fire-inflation': values.inflation,
    'fire-swr': values.tauxRetrait,
    'fire-depenses-retraite': values.depensesRetraite,
    'fire-revenus-passifs': values.revenusPassifsRetraite,
    'fire-age-retraite-legale': values.ageRetraiteLegale,
    'fire-pension': values.pensionMensuelle,
  };
  for (const [id, val] of Object.entries(map)) {
    const input = document.getElementById(id);
    const range = document.getElementById(id + '-range');
    if (input && val !== undefined) { input.value = val; if (range) range.value = val; }
  }
}

function getInputs() {
  const v = (id) => parseNumberInput(document.getElementById(id)?.value);
  return {
    age: v('fire-age'),
    capitalActuel: v('fire-capital'),
    revenusMensuelNets: v('fire-revenus'),
    depensesMensuelles: v('fire-depenses'),
    epargneMensuelle: v('fire-epargne'),
    rendementAnnuel: v('fire-rendement'),
    inflation: v('fire-inflation'),
    tauxRetrait: v('fire-swr'),
    depensesRetraite: v('fire-depenses-retraite'),
    revenusPassifsRetraite: v('fire-revenus-passifs'),
    ageRetraiteLegale: v('fire-age-retraite-legale'),
    pensionMensuelle: v('fire-pension'),
  };
}

function compute(inputs) {
  const {
    age, capitalActuel, epargneMensuelle,
    rendementAnnuel, inflation, tauxRetrait,
    depensesRetraite, revenusPassifsRetraite,
    revenusMensuelNets, depensesMensuelles,
    ageRetraiteLegale, pensionMensuelle,
  } = inputs;

  const rendementReel = (rendementAnnuel - inflation) / 100;
  const rendementMensuelReel = Math.pow(1 + rendementReel, 1 / 12) - 1;
  const depensesAnnuellesRetraite = depensesRetraite * 12;
  const revenusPassifsAnnuels = revenusPassifsRetraite * 12;

  // Besoin net annuel (ce qu'il faut couvrir avec le capital)
  const besoinNetAnnuel = Math.max(depensesAnnuellesRetraite - revenusPassifsAnnuels, 0);

  // Nombre FIRE = besoin net annuel / taux de retrait
  const nombreFIRE = tauxRetrait > 0 ? besoinNetAnnuel / (tauxRetrait / 100) : Infinity;

  // Taux d'épargne
  const tauxEpargne = revenusMensuelNets > 0 ? epargneMensuelle / revenusMensuelNets : 0;

  // ─── Phase d'accumulation (année par année, en réel) ───
  const annees = [];
  let capital = capitalActuel;
  let anneesFIRE = null;
  let ageFIRE = null;
  const maxYears = 80; // simulate up to 80 years

  for (let y = 0; y <= maxYears; y++) {
    const ageActuel = age + y;

    annees.push({
      annee: y,
      age: ageActuel,
      capital: capital,
      phase: anneesFIRE !== null ? 'retraite' : 'accumulation',
    });

    if (anneesFIRE === null) {
      // Check FIRE
      if (capital >= nombreFIRE && y > 0) {
        anneesFIRE = y;
        ageFIRE = ageActuel;
      }
      // Accumulation: grow + save
      for (let m = 0; m < 12; m++) {
        capital = capital * (1 + rendementMensuelReel) + epargneMensuelle;
      }
    } else {
      // FIRE atteint — phase de décumulation
      // Pension à partir de l'âge légal
      let retraitAnnuel = besoinNetAnnuel;
      if (ageActuel >= ageRetraiteLegale && pensionMensuelle > 0) {
        retraitAnnuel = Math.max(retraitAnnuel - pensionMensuelle * 12, 0);
      }

      capital = capital * (1 + rendementReel) - retraitAnnuel;
      if (capital < 0) capital = 0;
    }

    // Stop if too far
    if (ageActuel > 100) break;
  }

  // If never reached FIRE
  if (anneesFIRE === null) {
    // Try to find approximate by extrapolation
    anneesFIRE = Infinity;
    ageFIRE = null;
  }

  const dateEstimee = anneesFIRE !== Infinity
    ? new Date().getFullYear() + anneesFIRE
    : null;

  // Capital à la date FIRE
  const capitalFIRE = anneesFIRE !== Infinity ? nombreFIRE : null;

  // Durée de vie du capital (en phase de retrait)
  let dureeVieCapital = null;
  if (anneesFIRE !== Infinity) {
    const retraiteData = annees.filter(a => a.phase === 'retraite');
    const lastPositive = retraiteData.filter(a => a.capital > 0);
    dureeVieCapital = lastPositive.length > 0 ? lastPositive[lastPositive.length - 1].age - ageFIRE : 0;
  }

  return {
    nombreFIRE,
    tauxEpargne,
    anneesFIRE,
    ageFIRE,
    dateEstimee,
    capitalFIRE,
    dureeVieCapital,
    besoinNetAnnuel,
    annees,
  };
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function render() {
  const d = DEFAULTS;
  return `
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/>
          </svg>
        </div>
        Simulateur FIRE
      </h2>
      <p class="text-gray-500 text-sm mt-1">Financial Independence, Retire Early — Calcule ton indépendance financière</p>
      <div class="mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
        <p class="text-xs text-amber-400/80">
          <span class="font-semibold">Outil autonome</span> — Ce simulateur est indépendant de tes données personnelles. Saisis manuellement tes hypothèses pour simuler différents scénarios.
        </p>
      </div>
    </div>

    <!-- Save bar -->
    <div class="card-dark rounded-2xl overflow-hidden">
      <button id="fire-save-toggle" class="w-full flex items-center justify-between px-4 py-3 hover:bg-dark-600/30 transition">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
          </svg>
          <span class="text-sm font-medium text-gray-400">Sauvegardes</span>
          <span id="fire-save-count" class="text-xs text-gray-600"></span>
        </div>
        <svg id="fire-save-chevron" class="w-4 h-4 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div id="fire-save-panel" class="hidden px-4 pb-4">
        <div id="fire-save-content" class="flex items-center gap-2 flex-wrap">
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- LEFT: Inputs -->
      <div class="lg:col-span-5 space-y-4">

        <!-- Situation actuelle -->
        <div class="card-dark rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            Situation actuelle
          </h3>

          ${fireInput('fire-age', 'Âge actuel', d.age, 'ans', 18, 80, 1)}
          ${fireInput('fire-capital', 'Capital déjà investi', d.capitalActuel, '€', 0, 10000000, 1000)}
          ${fireInput('fire-revenus', 'Revenus mensuels nets', d.revenusMensuelNets, '€/mois', 0, 100000, 100)}
          ${fireInput('fire-depenses', 'Dépenses mensuelles actuelles', d.depensesMensuelles, '€/mois', 0, 50000, 100)}
          ${fireInput('fire-epargne', 'Épargne/investissement mensuel', d.epargneMensuelle, '€/mois', 0, 50000, 100)}
        </div>

        <!-- Hypothèses -->
        <div class="card-dark rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Hypothèses
          </h3>

          ${fireInput('fire-rendement', 'Rendement annuel brut espéré', d.rendementAnnuel, '%', 0, 30, 0.5)}
          ${fireInput('fire-inflation', 'Inflation annuelle', d.inflation, '%', 0, 15, 0.5)}
          ${fireInput('fire-swr', 'Taux de retrait sûr (SWR)', d.tauxRetrait, '%', 1, 10, 0.25)}

          <div class="info-box">
            <p class="text-xs text-gray-500">La <span class="text-gray-400 font-medium">règle des 4 %</span> stipule qu'on peut retirer 4 % de son capital par an sans l'épuiser sur 30+ ans. Un taux plus bas (3-3,5 %) est plus conservateur.</p>
          </div>
        </div>

        <!-- Retraite -->
        <div class="card-dark rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Phase FIRE (retraite anticipée)
          </h3>

          ${fireInput('fire-depenses-retraite', 'Dépenses mensuelles souhaitées', d.depensesRetraite, '€/mois', 0, 50000, 100)}
          ${fireInput('fire-revenus-passifs', 'Revenus passifs (loyers, dividendes...)', d.revenusPassifsRetraite, '€/mois', 0, 50000, 100)}
          ${fireInput('fire-age-retraite-legale', 'Âge retraite légale (pension)', d.ageRetraiteLegale, 'ans', 55, 70, 1)}
          ${fireInput('fire-pension', 'Pension retraite estimée', d.pensionMensuelle, '€/mois', 0, 10000, 100)}
        </div>
      </div>

      <!-- RIGHT: Results -->
      <div class="lg:col-span-7 space-y-4">

        <!-- Key metrics -->
        <div id="fire-results" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <!-- Filled by JS -->
        </div>

        <!-- Chart -->
        <div class="card-dark rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Évolution du capital</h3>
          <div class="h-80">
            <canvas id="fire-chart"></canvas>
          </div>
        </div>

        <!-- Breakdown table -->
        <div class="card-dark rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Détail par année</h3>
          <div class="overflow-x-auto max-h-72 overflow-y-auto">
            <table class="w-full text-sm" id="fire-table">
              <thead class="table-header">
                <tr class="text-gray-500 text-xs uppercase">
                  <th class="text-left py-2 px-2">Année</th>
                  <th class="text-left py-2 px-2">Âge</th>
                  <th class="text-right py-2 px-2">Capital</th>
                  <th class="text-center py-2 px-2">Phase</th>
                </tr>
              </thead>
              <tbody id="fire-table-body">
              </tbody>
            </table>
          </div>
        </div>

        <!-- Disclaimer -->
        <div class="info-box">
          <p class="text-xs text-gray-600">Les résultats sont fournis à titre indicatif. Ils reposent sur des hypothèses simplifiées et ne constituent ni un conseil en investissement, ni une promesse de résultat.</p>
        </div>
      </div>
    </div>
  </div>
  `;
}

function fireInput(id, label, defaultVal, unit, min, max, step) {
  return `
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label for="${id}" class="text-sm text-gray-400">${label}</label>
        <div class="flex items-center gap-1.5">
          <input type="number" id="${id}" value="${defaultVal}" min="${min}" max="${max}" step="${step}"
            class="w-24 input-field [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
          <span class="text-xs text-gray-500 w-12">${unit}</span>
        </div>
      </div>
      <input type="range" id="${id}-range" min="${min}" max="${max}" step="${step}" value="${defaultVal}"
        class="w-full h-1.5 bg-dark-600 rounded-full appearance-none cursor-pointer accent-amber-500
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500 [&::-webkit-slider-thumb]:shadow-lg
        [&::-webkit-slider-thumb]:cursor-pointer">
    </div>
  `;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mount() {
  // Sync range <-> input for all fields
  FIELD_IDS.forEach(id => {
    const input = document.getElementById(id);
    const range = document.getElementById(id + '-range');
    if (!input || !range) return;

    input.addEventListener('input', () => {
      range.value = input.value;
      recalculate();
    });

    range.addEventListener('input', () => {
      input.value = range.value;
      recalculate();
    });
  });

  // Save panel toggle
  document.getElementById('fire-save-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('fire-save-panel');
    const chevron = document.getElementById('fire-save-chevron');
    panel.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180');
  });

  // Render save bar content & initial calculation
  refreshSaveBar();
  recalculate();
}

function refreshSaveBar() {
  const container = document.getElementById('fire-save-content');
  const countEl = document.getElementById('fire-save-count');
  if (!container) return;

  const saves = getSaves();
  if (countEl) countEl.textContent = saves.length > 0 ? `(${saves.length})` : '';

  const options = saves.map((s, i) => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `<option value="${i}">${s.name} — ${dateStr}</option>`;
  }).join('');

  container.innerHTML = `
    <select id="fire-save-select" class="flex-1 min-w-0 input-field">
      <option value="">Choisir un scénario…</option>
      ${options}
    </select>
    <button id="fire-load-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 transition disabled:opacity-30" ${saves.length === 0 ? 'disabled' : ''}>Charger</button>
    <button id="fire-delete-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-30" ${saves.length === 0 ? 'disabled' : ''}>Suppr.</button>
    <span class="mx-1 h-5 w-px bg-dark-400/50 hidden sm:block"></span>
    <button id="fire-save-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition">Sauvegarder</button>
  `;

  // Wire buttons
  document.getElementById('fire-save-btn')?.addEventListener('click', () => {
    const name = prompt('Nom du scénario :');
    if (name && name.trim()) {
      saveCurrentInputs(name.trim());
      refreshSaveBar();
    }
  });

  document.getElementById('fire-load-btn')?.addEventListener('click', () => {
    const sel = document.getElementById('fire-save-select');
    const idx = parseInt(sel?.value);
    if (!isNaN(idx)) {
      loadSave(idx);
      recalculate();
    }
  });

  document.getElementById('fire-delete-btn')?.addEventListener('click', () => {
    const sel = document.getElementById('fire-save-select');
    const idx = parseInt(sel?.value);
    if (!isNaN(idx)) {
      deleteSave(idx);
      refreshSaveBar();
    }
  });
}

function recalculate() {
  const inputs = getInputs();
  const result = compute(inputs);
  renderResults(result);
  renderChart(result);
  renderTable(result);
}

// ─── Render Results Cards ────────────────────────────────────────────────────

function renderResults(r) {
  const container = document.getElementById('fire-results');
  if (!container) return;

  const isReachable = r.anneesFIRE !== Infinity;

  container.innerHTML = `
    <!-- FIRE Number -->
    <div class="card-dark rounded-2xl p-4 col-span-2 sm:col-span-3 bg-gradient-to-r from-orange-500/5 to-amber-500/5 border border-orange-500/10">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wider">Nombre FIRE</p>
          <p class="text-2xl font-bold text-orange-400 mt-1">${formatCurrency(r.nombreFIRE)}</p>
          <p class="text-xs text-gray-500 mt-1">Capital nécessaire pour vivre de tes rentes</p>
        </div>
        <div class="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center">
          <svg class="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Taux d'épargne -->
    ${metricCard('Taux d\'épargne', formatPercent(r.tauxEpargne), r.tauxEpargne >= 0.5 ? 'text-accent-green' : r.tauxEpargne >= 0.25 ? 'text-accent-amber' : 'text-red-400', 'Part des revenus épargnée')}

    <!-- Années restantes -->
    ${metricCard('Années restantes', isReachable ? r.anneesFIRE + ' ans' : '—', isReachable ? 'text-accent-blue' : 'text-gray-500', isReachable ? 'Avant l\'indépendance' : 'Non atteignable')}

    <!-- Âge FIRE -->
    ${metricCard('Âge FIRE', isReachable ? r.ageFIRE + ' ans' : '—', isReachable ? 'text-accent-cyan' : 'text-gray-500', isReachable ? ('En ' + r.dateEstimee) : '')}

    <!-- Besoin net annuel -->
    ${metricCard('Besoin net / an', formatCurrency(r.besoinNetAnnuel), 'text-accent-purple', 'Dépenses - revenus passifs')}

    <!-- Durée de vie du capital -->
    ${metricCard('Durée du capital', r.dureeVieCapital !== null ? (r.dureeVieCapital >= 50 ? '50+ ans' : r.dureeVieCapital + ' ans') : '—', r.dureeVieCapital !== null && r.dureeVieCapital >= 30 ? 'text-accent-green' : 'text-accent-amber', 'Après le FIRE')}
  `;
}

function metricCard(label, value, colorClass, sub) {
  return `
    <div class="card-dark rounded-2xl p-4">
      <p class="text-xs text-gray-500 uppercase tracking-wider">${label}</p>
      <p class="text-lg font-bold ${colorClass} mt-1">${value}</p>
      ${sub ? `<p class="text-xs text-gray-600 mt-0.5">${sub}</p>` : ''}
    </div>
  `;
}

// ─── Chart ───────────────────────────────────────────────────────────────────

function renderChart(r) {
  const canvas = document.getElementById('fire-chart');
  if (!canvas) return;

  const data = r.annees.filter(a => a.age <= 100);
  const labels = data.map(a => a.age + ' ans');
  const capitals = data.map(a => a.capital);

  // Find FIRE index
  const fireIdx = r.ageFIRE !== null ? data.findIndex(a => a.age === r.ageFIRE) : -1;

  // Colors: accumulation = blue, retraite = amber
  const pointColors = data.map(a => a.phase === 'retraite' ? '#f59e0b' : '#3b82f6');

  const ctx = canvas.getContext('2d');

  createChart('fire-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Capital',
          data: capitals,
          borderColor: (context) => {
            const idx = context.dataIndex ?? 0;
            return data[idx]?.phase === 'retraite' ? '#f59e0b' : '#3b82f6';
          },
          segment: {
            borderColor: (ctx2) => {
              const idx = ctx2.p0DataIndex;
              return data[idx]?.phase === 'retraite' ? '#f59e0b' : '#3b82f6';
            },
          },
          backgroundColor: function(context) {
            const chart = context.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(59,130,246,0.1)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(59,130,246,0.15)');
            gradient.addColorStop(1, 'rgba(59,130,246,0.0)');
            return gradient;
          },
          fill: true,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: pointColors,
          tension: 0.3,
        },
        // FIRE number horizontal line
        {
          label: 'Nombre FIRE',
          data: new Array(data.length).fill(r.nombreFIRE),
          borderColor: '#f97316',
          borderWidth: 1.5,
          borderDash: [8, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: {
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.gridText, font: { size: 11 }, maxTicksLimit: 15 },
        },
        y: {
          grid: { color: COLORS.grid },
          ticks: {
            color: COLORS.gridText,
            font: { size: 11 },
            callback: v => v >= 1000000 ? (v / 1000000).toFixed(1) + ' M€' : v >= 1000 ? Math.round(v / 1000) + ' k€' : v + ' €',
          },
          beginAtZero: true,
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16, usePointStyle: true, pointStyle: 'circle',
            boxWidth: 8, boxHeight: 8, color: '#e5e7eb',
            font: { size: 12, family: 'Inter' },
          }
        },
        tooltip: {
          backgroundColor: 'rgba(11,11,15,0.95)',
          titleColor: '#e8d5b0',
          bodyColor: '#a0a0a5',
          borderColor: 'rgba(56,56,63,0.6)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (ctx2) => {
              const val = ctx2.parsed.y;
              return ` ${ctx2.dataset.label}: ${formatCurrency(val)}`;
            }
          }
        },
        annotation: fireIdx >= 0 ? {
          annotations: {
            fireLine: {
              type: 'line',
              xMin: fireIdx,
              xMax: fireIdx,
              borderColor: '#f97316',
              borderWidth: 2,
              borderDash: [4, 4],
              label: {
                content: 'FIRE',
                display: true,
                position: 'start',
                backgroundColor: '#f97316',
                color: '#fff',
                font: { size: 11, weight: 'bold' },
                padding: 4,
                borderRadius: 4,
              }
            }
          }
        } : {}
      }
    }
  });
}

// ─── Table ───────────────────────────────────────────────────────────────────

function renderTable(r) {
  const tbody = document.getElementById('fire-table-body');
  if (!tbody) return;

  const data = r.annees.filter(a => a.age <= 100);
  const currentYear = new Date().getFullYear();

  tbody.innerHTML = data.map((a, i) => {
    const isFIRE = r.ageFIRE !== null && a.age === r.ageFIRE;
    const rowClass = isFIRE ? 'bg-orange-500/10' : (i % 2 === 0 ? '' : 'table-row-alt');
    const phaseLabel = a.phase === 'retraite'
      ? '<span class="inline-block px-2 py-0.5 text-xs rounded-full bg-amber-500/15 text-amber-400">Retraite</span>'
      : '<span class="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-400">Épargne</span>';

    return `
      <tr class="table-row ${rowClass}">
        <td class="py-1.5 px-2 text-gray-400">${currentYear + a.annee}</td>
        <td class="py-1.5 px-2 ${isFIRE ? 'text-orange-400 font-semibold' : 'text-gray-300'}">${a.age} ans${isFIRE ? ' 🔥' : ''}</td>
        <td class="py-1.5 px-2 text-right font-mono ${a.capital >= r.nombreFIRE ? 'text-accent-green' : 'text-gray-300'}">${formatCurrency(Math.round(a.capital))}</td>
        <td class="py-1.5 px-2 text-center">${phaseLabel}</td>
      </tr>
    `;
  }).join('');
}
