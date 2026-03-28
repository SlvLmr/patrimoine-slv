import { formatCurrency, parseNumberInput } from '../utils.js?v=5';
import { createChart, COLORS } from '../charts/chart-config.js';

// ─── Simulateur d'Intérêts Composés ─────────────────────────────────────────
// Standalone tool — not connected to user patrimoine data.

const STORAGE_KEY = 'sim-interets-saves';

const DEFAULTS = {
  capitalInitial: 10000,
  versementMensuel: 500,
  duree: 20,
  tauxAnnuel: 7,
  inflation: 2,
  frequenceComposition: 12, // mensuel
};

const FIELD_IDS = [
  'ic-capital', 'ic-versement', 'ic-duree', 'ic-taux', 'ic-inflation',
];

// ─── Save / Load ─────────────────────────────────────────────────────────────

function getSaves() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function writeSaves(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

function saveCurrentInputs(name) {
  const inputs = getInputs();
  const saves = getSaves();
  saves.push({ name, date: new Date().toISOString(), inputs });
  writeSaves(saves);
}
function deleteSave(i) { const s = getSaves(); s.splice(i, 1); writeSaves(s); }

function loadSave(index) {
  const save = getSaves()[index];
  if (!save) return;
  const map = {
    'ic-capital': save.inputs.capitalInitial,
    'ic-versement': save.inputs.versementMensuel,
    'ic-duree': save.inputs.duree,
    'ic-taux': save.inputs.tauxAnnuel,
    'ic-inflation': save.inputs.inflation,
  };
  const freqEl = document.getElementById('ic-frequence');
  if (freqEl && save.inputs.frequenceComposition) freqEl.value = save.inputs.frequenceComposition;
  for (const [id, val] of Object.entries(map)) {
    const input = document.getElementById(id);
    const range = document.getElementById(id + '-range');
    if (input && val !== undefined) { input.value = val; if (range) range.value = val; }
  }
}

// ─── Computation ─────────────────────────────────────────────────────────────

function getInputs() {
  const v = (id) => parseNumberInput(document.getElementById(id)?.value);
  return {
    capitalInitial: v('ic-capital'),
    versementMensuel: v('ic-versement'),
    duree: v('ic-duree'),
    tauxAnnuel: v('ic-taux'),
    inflation: v('ic-inflation'),
    frequenceComposition: parseInt(document.getElementById('ic-frequence')?.value) || 12,
  };
}

function compute(inputs) {
  const { capitalInitial, versementMensuel, duree, tauxAnnuel, inflation, frequenceComposition } = inputs;

  const tauxPeriodique = (tauxAnnuel / 100) / frequenceComposition;
  const tauxReelAnnuel = (tauxAnnuel - inflation) / 100;
  const versementParPeriode = versementMensuel * (12 / frequenceComposition);
  const totalPeriodes = duree * frequenceComposition;

  // Year-by-year breakdown
  const annees = [];
  let capitalNominal = capitalInitial;
  let capitalReel = capitalInitial;
  let totalVerse = capitalInitial;
  let totalInteretsNominal = 0;

  const tauxReelPeriodique = Math.pow(1 + tauxReelAnnuel, 1 / frequenceComposition) - 1;

  for (let y = 0; y <= duree; y++) {
    annees.push({
      annee: y,
      capitalNominal: capitalNominal,
      capitalReel: capitalReel,
      totalVerse: totalVerse,
      interetsCumules: totalInteretsNominal,
      gainNet: capitalNominal - totalVerse,
    });

    if (y < duree) {
      for (let p = 0; p < frequenceComposition; p++) {
        const interetsNom = capitalNominal * tauxPeriodique;
        capitalNominal += interetsNom + versementParPeriode;
        totalInteretsNominal += interetsNom;

        const interetsReel = capitalReel * tauxReelPeriodique;
        capitalReel += interetsReel + versementParPeriode;

        totalVerse += versementParPeriode;
      }
    }
  }

  const capitalFinal = capitalNominal;
  const capitalFinalReel = capitalReel;
  const totalVerseTotal = totalVerse;
  const totalInterets = capitalFinal - totalVerseTotal;
  const multiplicateur = totalVerseTotal > 0 ? capitalFinal / totalVerseTotal : 0;

  return {
    capitalFinal,
    capitalFinalReel,
    totalVerse: totalVerseTotal,
    totalInterets,
    multiplicateur,
    annees,
  };
}

// ─── Render ──────────────────────────────────────────────────────────────────

function simInput(id, label, defaultVal, unit, min, max, step) {
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
        class="w-full h-1.5 bg-dark-600 rounded-full appearance-none cursor-pointer accent-emerald-500
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:shadow-lg
        [&::-webkit-slider-thumb]:cursor-pointer">
    </div>
  `;
}

export function render() {
  const d = DEFAULTS;
  return `
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
          </svg>
        </div>
        Intérêts composés
      </h2>
      <p class="text-gray-500 text-sm mt-1">Visualise la puissance des intérêts composés sur ton épargne</p>
      <div class="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
        <p class="text-xs text-emerald-400/80">
          <span class="font-semibold">Outil autonome</span> — Ce simulateur est indépendant de tes données personnelles.
        </p>
      </div>
    </div>

    <!-- Save bar -->
    <div class="card-dark rounded-2xl overflow-hidden">
      <button id="ic-save-toggle" class="w-full flex items-center justify-between px-4 py-3 hover:bg-dark-600/30 transition">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
          </svg>
          <span class="text-sm font-medium text-gray-400">Sauvegardes</span>
          <span id="ic-save-count" class="text-xs text-gray-600"></span>
        </div>
        <svg id="ic-save-chevron" class="w-4 h-4 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div id="ic-save-panel" class="hidden px-4 pb-4">
        <div id="ic-save-content" class="flex items-center gap-2 flex-wrap"></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- LEFT: Inputs -->
      <div class="lg:col-span-5 space-y-4">

        <div class="card-dark rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Paramètres
          </h3>

          ${simInput('ic-capital', 'Capital initial', d.capitalInitial, '€', 0, 5000000, 1000)}
          ${simInput('ic-versement', 'Versement mensuel', d.versementMensuel, '€/mois', 0, 50000, 50)}
          ${simInput('ic-duree', 'Durée', d.duree, 'ans', 1, 60, 1)}
          ${simInput('ic-taux', 'Taux de rendement annuel', d.tauxAnnuel, '%', 0, 30, 0.5)}
          ${simInput('ic-inflation', 'Inflation annuelle', d.inflation, '%', 0, 15, 0.5)}

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-sm text-gray-400">Fréquence de composition</label>
              <select id="ic-frequence" class="input-field">
                <option value="1">Annuelle</option>
                <option value="4">Trimestrielle</option>
                <option value="12" selected>Mensuelle</option>
                <option value="365">Journalière</option>
              </select>
            </div>
          </div>

          <div class="p-2.5 rounded-lg bg-dark-800/50 border border-dark-400/30">
            <p class="text-xs text-gray-500">Les <span class="text-gray-400 font-medium">intérêts composés</span> génèrent des intérêts sur les intérêts déjà gagnés. Plus la durée est longue, plus l'effet boule de neige est puissant.</p>
          </div>
        </div>
      </div>

      <!-- RIGHT: Results -->
      <div class="lg:col-span-7 space-y-4">

        <!-- Key metrics -->
        <div id="ic-results" class="grid grid-cols-2 sm:grid-cols-3 gap-3"></div>

        <!-- Chart -->
        <div class="card-dark rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Évolution du capital</h3>
          <div class="h-80">
            <canvas id="ic-chart"></canvas>
          </div>
        </div>

        <!-- Table -->
        <div class="card-dark rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">Détail par année</h3>
          <div class="overflow-x-auto max-h-72 overflow-y-auto">
            <table class="w-full text-sm">
              <thead class="sticky top-0 bg-dark-700">
                <tr class="text-gray-500 text-xs uppercase">
                  <th class="text-left py-2 px-2">Année</th>
                  <th class="text-right py-2 px-2">Capital</th>
                  <th class="text-right py-2 px-2">Versé</th>
                  <th class="text-right py-2 px-2">Intérêts cumulés</th>
                  <th class="text-right py-2 px-2">Gain net</th>
                </tr>
              </thead>
              <tbody id="ic-table-body"></tbody>
            </table>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-dark-800/30 border border-dark-400/20">
          <p class="text-xs text-gray-600">Simulation indicative. Les rendements passés ne préjugent pas des rendements futurs.</p>
        </div>
      </div>
    </div>
  </div>
  `;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mount() {
  FIELD_IDS.forEach(id => {
    const input = document.getElementById(id);
    const range = document.getElementById(id + '-range');
    if (!input || !range) return;
    input.addEventListener('input', () => { range.value = input.value; recalculate(); });
    range.addEventListener('input', () => { input.value = range.value; recalculate(); });
  });

  document.getElementById('ic-frequence')?.addEventListener('change', recalculate);

  // Save panel toggle
  document.getElementById('ic-save-toggle')?.addEventListener('click', () => {
    document.getElementById('ic-save-panel').classList.toggle('hidden');
    document.getElementById('ic-save-chevron').classList.toggle('rotate-180');
  });

  refreshSaveBar();
  recalculate();
}

function refreshSaveBar() {
  const container = document.getElementById('ic-save-content');
  const countEl = document.getElementById('ic-save-count');
  if (!container) return;

  const saves = getSaves();
  if (countEl) countEl.textContent = saves.length > 0 ? `(${saves.length})` : '';

  const options = saves.map((s, i) => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `<option value="${i}">${s.name} — ${dateStr}</option>`;
  }).join('');

  container.innerHTML = `
    <select id="ic-save-select" class="flex-1 min-w-0 input-field">
      <option value="">Choisir un scénario…</option>
      ${options}
    </select>
    <button id="ic-load-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 transition disabled:opacity-30" ${saves.length === 0 ? 'disabled' : ''}>Charger</button>
    <button id="ic-delete-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-30" ${saves.length === 0 ? 'disabled' : ''}>Suppr.</button>
    <span class="mx-1 h-5 w-px bg-dark-400/50 hidden sm:block"></span>
    <button id="ic-save-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition">Sauvegarder</button>
  `;

  document.getElementById('ic-save-btn')?.addEventListener('click', () => {
    const name = prompt('Nom du scénario :');
    if (name && name.trim()) { saveCurrentInputs(name.trim()); refreshSaveBar(); }
  });
  document.getElementById('ic-load-btn')?.addEventListener('click', () => {
    const idx = parseInt(document.getElementById('ic-save-select')?.value);
    if (!isNaN(idx)) { loadSave(idx); recalculate(); }
  });
  document.getElementById('ic-delete-btn')?.addEventListener('click', () => {
    const idx = parseInt(document.getElementById('ic-save-select')?.value);
    if (!isNaN(idx)) { deleteSave(idx); refreshSaveBar(); }
  });
}

function recalculate() {
  const inputs = getInputs();
  const result = compute(inputs);
  renderResults(result);
  renderChart(result);
  renderTable(result);
}

// ─── Results ─────────────────────────────────────────────────────────────────

function renderResults(r) {
  const container = document.getElementById('ic-results');
  if (!container) return;

  container.innerHTML = `
    <div class="card-dark rounded-2xl p-4 col-span-2 sm:col-span-3 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-500/10">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wider">Capital final</p>
          <p class="text-2xl font-bold text-emerald-400 mt-1">${formatCurrency(Math.round(r.capitalFinal))}</p>
          <p class="text-xs text-gray-500 mt-1">soit ${formatCurrency(Math.round(r.capitalFinalReel))} en euros constants (après inflation)</p>
        </div>
        <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <svg class="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
          </svg>
        </div>
      </div>
    </div>

    ${mc('Total versé', formatCurrency(Math.round(r.totalVerse)), 'text-accent-blue', 'Capital + versements')}
    ${mc('Intérêts gagnés', formatCurrency(Math.round(r.totalInterets)), 'text-accent-amber', 'Intérêts composés')}
    ${mc('Multiplicateur', 'x ' + r.multiplicateur.toFixed(2), r.multiplicateur >= 2 ? 'text-accent-green' : 'text-gray-300', 'Capital final / versé')}
  `;
}

function mc(label, value, color, sub) {
  return `<div class="card-dark rounded-2xl p-4">
    <p class="text-xs text-gray-500 uppercase tracking-wider">${label}</p>
    <p class="text-lg font-bold ${color} mt-1">${value}</p>
    ${sub ? `<p class="text-xs text-gray-600 mt-0.5">${sub}</p>` : ''}
  </div>`;
}

// ─── Chart ───────────────────────────────────────────────────────────────────

function renderChart(r) {
  const canvas = document.getElementById('ic-chart');
  if (!canvas) return;

  const labels = r.annees.map(a => a.annee === 0 ? 'Début' : 'An ' + a.annee);
  const versements = r.annees.map(a => Math.round(a.totalVerse));
  const capitaux = r.annees.map(a => Math.round(a.capitalNominal));
  const reels = r.annees.map(a => Math.round(a.capitalReel));

  createChart('ic-chart', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Versements cumulés',
          data: versements,
          backgroundColor: 'rgba(59,130,246,0.5)',
          borderRadius: 3,
          order: 2,
        },
        {
          type: 'bar',
          label: 'Intérêts cumulés',
          data: r.annees.map(a => Math.round(a.capitalNominal - a.totalVerse)),
          backgroundColor: 'rgba(245,158,11,0.5)',
          borderRadius: 3,
          order: 2,
        },
        {
          type: 'line',
          label: 'Capital réel (après inflation)',
          data: reels,
          borderColor: '#14b8a6',
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: false,
          order: 1,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: {
          stacked: true,
          grid: { color: COLORS.grid },
          ticks: { color: COLORS.gridText, font: { size: 11 }, maxTicksLimit: 15 },
        },
        y: {
          stacked: true,
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
          labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, color: '#e5e7eb', font: { size: 12, family: 'Inter' } },
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
            label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          }
        },
      }
    }
  });
}

// ─── Table ───────────────────────────────────────────────────────────────────

function renderTable(r) {
  const tbody = document.getElementById('ic-table-body');
  if (!tbody) return;

  tbody.innerHTML = r.annees.map((a, i) => `
    <tr class="${i % 2 === 0 ? '' : 'bg-dark-800/30'} hover:bg-dark-600/30 transition">
      <td class="py-1.5 px-2 text-gray-400">${a.annee === 0 ? 'Début' : 'An ' + a.annee}</td>
      <td class="py-1.5 px-2 text-right font-mono text-emerald-400">${formatCurrency(Math.round(a.capitalNominal))}</td>
      <td class="py-1.5 px-2 text-right font-mono text-blue-400">${formatCurrency(Math.round(a.totalVerse))}</td>
      <td class="py-1.5 px-2 text-right font-mono text-amber-400">${formatCurrency(Math.round(a.interetsCumules))}</td>
      <td class="py-1.5 px-2 text-right font-mono ${a.gainNet >= 0 ? 'text-accent-green' : 'text-red-400'}">${formatCurrency(Math.round(a.gainNet))}</td>
    </tr>
  `).join('');
}
