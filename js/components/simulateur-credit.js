import { formatCurrency, formatCurrencyCents, formatPercent, parseNumberInput } from '../utils.js?v=5';
import { createChart, COLORS } from '../charts/chart-config.js';

// ─── Simulateur de Crédit Immobilier ─────────────────────────────────────────
// Standalone tool — not connected to user patrimoine data.

const DEFAULTS = {
  montantBien: 300000,
  apport: 50000,
  duree: 20,
  tauxNominal: 3.5,
  tauxAssurance: 0.34,
  fraisNotaire: 8,
  fraisDossier: 1000,
  fraisGarantie: 2500,
  revenusMensuels: 4500,
};

function getInputs() {
  const v = (id) => parseNumberInput(document.getElementById(id)?.value);
  return {
    montantBien: v('credit-montant-bien'),
    apport: v('credit-apport'),
    duree: v('credit-duree'),
    tauxNominal: v('credit-taux'),
    tauxAssurance: v('credit-assurance'),
    fraisNotaire: v('credit-frais-notaire'),
    fraisDossier: v('credit-frais-dossier'),
    fraisGarantie: v('credit-frais-garantie'),
    revenusMensuels: v('credit-revenus'),
  };
}

function compute(inputs) {
  const {
    montantBien, apport, duree, tauxNominal, tauxAssurance,
    fraisNotaire, fraisDossier, fraisGarantie, revenusMensuels,
  } = inputs;

  // Frais de notaire
  const montantFraisNotaire = montantBien * (fraisNotaire / 100);

  // Montant emprunté
  const montantEmprunte = Math.max(montantBien - apport, 0);

  // Coût total du projet
  const coutProjet = montantBien + montantFraisNotaire + fraisDossier + fraisGarantie;

  // Mensualité hors assurance (formule d'annuité constante)
  const tauxMensuel = (tauxNominal / 100) / 12;
  const nbMensualites = duree * 12;
  let mensualiteHorsAssurance = 0;
  if (tauxMensuel > 0 && nbMensualites > 0) {
    mensualiteHorsAssurance = montantEmprunte * tauxMensuel / (1 - Math.pow(1 + tauxMensuel, -nbMensualites));
  } else if (nbMensualites > 0) {
    mensualiteHorsAssurance = montantEmprunte / nbMensualites;
  }

  // Assurance mensuelle (sur capital initial)
  const assuranceMensuelle = montantEmprunte * (tauxAssurance / 100) / 12;

  // Mensualité totale
  const mensualiteTotale = mensualiteHorsAssurance + assuranceMensuelle;

  // Taux d'endettement
  const tauxEndettement = revenusMensuels > 0 ? mensualiteTotale / revenusMensuels : 0;

  // Reste à vivre
  const resteAVivre = revenusMensuels - mensualiteTotale;

  // Coût total du crédit
  const coutTotalCredit = mensualiteHorsAssurance * nbMensualites - montantEmprunte;
  const coutTotalAssurance = assuranceMensuelle * nbMensualites;
  const coutTotal = coutTotalCredit + coutTotalAssurance + fraisDossier + fraisGarantie + montantFraisNotaire;

  // TAEG approximatif (simplifié — inclut assurance)
  // On cherche le taux r tel que montantEmprunte = sum mensualiteTotale / (1+r)^k
  const taeg = computeTAEG(montantEmprunte, mensualiteTotale, nbMensualites);

  // Tableau d'amortissement
  const echeances = [];
  let capitalRestant = montantEmprunte;
  let totalInterets = 0;
  let totalAssurance = 0;
  let totalCapitalRembourse = 0;

  for (let m = 1; m <= nbMensualites; m++) {
    const interets = capitalRestant * tauxMensuel;
    const capitalRembourse = mensualiteHorsAssurance - interets;
    capitalRestant = Math.max(capitalRestant - capitalRembourse, 0);
    totalInterets += interets;
    totalAssurance += assuranceMensuelle;
    totalCapitalRembourse += capitalRembourse;

    echeances.push({
      mois: m,
      annee: Math.ceil(m / 12),
      mensualite: mensualiteTotale,
      capital: capitalRembourse,
      interets,
      assurance: assuranceMensuelle,
      capitalRestant,
      totalInterets,
      totalCapitalRembourse,
    });
  }

  // Résumé annuel pour le graphique
  const annuel = [];
  for (let y = 1; y <= duree; y++) {
    const mensualitesAnnee = echeances.filter(e => e.annee === y);
    const dernierMois = mensualitesAnnee[mensualitesAnnee.length - 1];
    annuel.push({
      annee: y,
      capitalRestant: dernierMois?.capitalRestant || 0,
      capitalRembourse: mensualitesAnnee.reduce((s, e) => s + e.capital, 0),
      interets: mensualitesAnnee.reduce((s, e) => s + e.interets, 0),
      assurance: mensualitesAnnee.reduce((s, e) => s + e.assurance, 0),
      totalInteretsCumul: dernierMois?.totalInterets || 0,
      totalCapitalCumul: dernierMois?.totalCapitalRembourse || 0,
    });
  }

  return {
    montantEmprunte,
    montantFraisNotaire,
    coutProjet,
    mensualiteHorsAssurance,
    assuranceMensuelle,
    mensualiteTotale,
    tauxEndettement,
    resteAVivre,
    coutTotalCredit,
    coutTotalAssurance,
    coutTotal,
    taeg,
    echeances,
    annuel,
    nbMensualites,
  };
}

// TAEG par dichotomie (Newton simplifié)
function computeTAEG(montant, mensualite, nbMois) {
  if (montant <= 0 || mensualite <= 0 || nbMois <= 0) return 0;
  let low = 0, high = 0.5;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const r = mid / 12;
    const pv = mensualite * (1 - Math.pow(1 + r, -nbMois)) / r;
    if (pv > montant) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function render() {
  const d = DEFAULTS;
  return `
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2"/>
          </svg>
        </div>
        Simulateur Crédit Immobilier
      </h2>
      <p class="text-gray-500 text-sm mt-1">Calcule ta mensualité, ton tableau d'amortissement et le coût total de ton emprunt</p>
      <div class="mt-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
        <p class="text-xs text-blue-400/80">
          <span class="font-semibold">Outil autonome</span> — Ce simulateur est indépendant de tes données personnelles. Saisis manuellement tes hypothèses.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- LEFT: Inputs -->
      <div class="lg:col-span-5 space-y-4">

        <!-- Projet -->
        <div class="card-dark rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            Le projet
          </h3>

          ${creditInput('credit-montant-bien', 'Prix du bien', d.montantBien, '€', 10000, 5000000, 5000)}
          ${creditInput('credit-apport', 'Apport personnel', d.apport, '€', 0, 2000000, 1000)}
          ${creditInput('credit-frais-notaire', 'Frais de notaire', d.fraisNotaire, '%', 0, 15, 0.5)}
        </div>

        <!-- Crédit -->
        <div class="card-dark rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
            Le crédit
          </h3>

          ${creditInput('credit-duree', 'Durée du prêt', d.duree, 'ans', 1, 30, 1)}
          ${creditInput('credit-taux', 'Taux nominal', d.tauxNominal, '%', 0, 15, 0.05)}
          ${creditInput('credit-assurance', 'Taux assurance', d.tauxAssurance, '%', 0, 2, 0.01)}
          ${creditInput('credit-frais-dossier', 'Frais de dossier', d.fraisDossier, '€', 0, 10000, 100)}
          ${creditInput('credit-frais-garantie', 'Frais de garantie', d.fraisGarantie, '€', 0, 20000, 100)}
        </div>

        <!-- Revenus -->
        <div class="card-dark rounded-2xl p-5 space-y-4">
          <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Capacité d'emprunt
          </h3>

          ${creditInput('credit-revenus', 'Revenus mensuels nets du foyer', d.revenusMensuels, '€/mois', 0, 50000, 100)}

          <div class="p-2.5 rounded-lg bg-dark-800/50 border border-dark-400/30">
            <p class="text-xs text-gray-500">Le <span class="text-gray-400 font-medium">taux d'endettement</span> recommandé est de <span class="text-gray-400 font-medium">35 % maximum</span> (HCSF). Au-delà, les banques refusent généralement le prêt.</p>
          </div>
        </div>
      </div>

      <!-- RIGHT: Results -->
      <div class="lg:col-span-7 space-y-4">

        <!-- Key metrics -->
        <div id="credit-results" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        </div>

        <!-- Charts -->
        <div class="card-dark rounded-2xl p-5">
          <div class="flex items-center gap-3 mb-4">
            <button id="credit-tab-amort" class="text-sm font-medium px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 transition">Amortissement</button>
            <button id="credit-tab-repartition" class="text-sm font-medium px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition">Répartition</button>
          </div>
          <div id="credit-chart-amort" class="h-80">
            <canvas id="credit-chart-stacked"></canvas>
          </div>
          <div id="credit-chart-repartition" class="h-80 hidden">
            <canvas id="credit-chart-pie"></canvas>
          </div>
        </div>

        <!-- Amortization table -->
        <div class="card-dark rounded-2xl p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider">Tableau d'amortissement</h3>
            <div class="flex items-center gap-2">
              <button id="credit-view-annuel" class="text-xs px-2.5 py-1 rounded-lg bg-dark-600 text-gray-300 transition">Annuel</button>
              <button id="credit-view-mensuel" class="text-xs px-2.5 py-1 rounded-lg text-gray-500 hover:text-gray-300 transition">Mensuel</button>
            </div>
          </div>
          <div class="overflow-x-auto max-h-80 overflow-y-auto">
            <table class="w-full text-sm" id="credit-table">
              <thead class="sticky top-0 bg-dark-700">
                <tr class="text-gray-500 text-xs uppercase">
                  <th class="text-left py-2 px-2" id="credit-th-period">Année</th>
                  <th class="text-right py-2 px-2">Capital</th>
                  <th class="text-right py-2 px-2">Intérêts</th>
                  <th class="text-right py-2 px-2">Assurance</th>
                  <th class="text-right py-2 px-2">Restant dû</th>
                </tr>
              </thead>
              <tbody id="credit-table-body">
              </tbody>
            </table>
          </div>
        </div>

        <!-- Disclaimer -->
        <div class="p-3 rounded-xl bg-dark-800/30 border border-dark-400/20">
          <p class="text-xs text-gray-600">Simulation indicative à titre d'information. Les résultats ne tiennent pas lieu d'offre de prêt. Consultez un professionnel pour une étude personnalisée.</p>
        </div>
      </div>
    </div>
  </div>
  `;
}

function creditInput(id, label, defaultVal, unit, min, max, step) {
  return `
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label for="${id}" class="text-sm text-gray-400">${label}</label>
        <div class="flex items-center gap-1.5">
          <input type="number" id="${id}" value="${defaultVal}" min="${min}" max="${max}" step="${step}"
            class="w-24 text-right px-2 py-1 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm
            focus:ring-1 focus:ring-accent-blue/40 focus:border-accent-blue/40 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
          <span class="text-xs text-gray-500 w-12">${unit}</span>
        </div>
      </div>
      <input type="range" id="${id}-range" min="${min}" max="${max}" step="${step}" value="${defaultVal}"
        class="w-full h-1.5 bg-dark-600 rounded-full appearance-none cursor-pointer accent-blue-500
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-lg
        [&::-webkit-slider-thumb]:cursor-pointer">
    </div>
  `;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

let currentView = 'annuel'; // 'annuel' | 'mensuel'
let currentTab = 'amort';   // 'amort' | 'repartition'
let lastResult = null;

export function mount() {
  currentView = 'annuel';
  currentTab = 'amort';

  const ids = [
    'credit-montant-bien', 'credit-apport', 'credit-frais-notaire',
    'credit-duree', 'credit-taux', 'credit-assurance',
    'credit-frais-dossier', 'credit-frais-garantie', 'credit-revenus',
  ];

  ids.forEach(id => {
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

  // Tab switching
  document.getElementById('credit-tab-amort')?.addEventListener('click', () => switchTab('amort'));
  document.getElementById('credit-tab-repartition')?.addEventListener('click', () => switchTab('repartition'));

  // View switching (annuel/mensuel)
  document.getElementById('credit-view-annuel')?.addEventListener('click', () => switchView('annuel'));
  document.getElementById('credit-view-mensuel')?.addEventListener('click', () => switchView('mensuel'));

  recalculate();
}

function switchTab(tab) {
  currentTab = tab;
  const tabAmort = document.getElementById('credit-tab-amort');
  const tabRepart = document.getElementById('credit-tab-repartition');
  const chartAmort = document.getElementById('credit-chart-amort');
  const chartRepart = document.getElementById('credit-chart-repartition');

  if (tab === 'amort') {
    tabAmort.className = 'text-sm font-medium px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 transition';
    tabRepart.className = 'text-sm font-medium px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition';
    chartAmort.classList.remove('hidden');
    chartRepart.classList.add('hidden');
  } else {
    tabRepart.className = 'text-sm font-medium px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 transition';
    tabAmort.className = 'text-sm font-medium px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition';
    chartRepart.classList.remove('hidden');
    chartAmort.classList.add('hidden');
  }

  if (lastResult) {
    if (tab === 'amort') renderStackedChart(lastResult);
    else renderPieChart(lastResult);
  }
}

function switchView(view) {
  currentView = view;
  const btnAnnuel = document.getElementById('credit-view-annuel');
  const btnMensuel = document.getElementById('credit-view-mensuel');
  const thPeriod = document.getElementById('credit-th-period');

  if (view === 'annuel') {
    btnAnnuel.className = 'text-xs px-2.5 py-1 rounded-lg bg-dark-600 text-gray-300 transition';
    btnMensuel.className = 'text-xs px-2.5 py-1 rounded-lg text-gray-500 hover:text-gray-300 transition';
    if (thPeriod) thPeriod.textContent = 'Année';
  } else {
    btnMensuel.className = 'text-xs px-2.5 py-1 rounded-lg bg-dark-600 text-gray-300 transition';
    btnAnnuel.className = 'text-xs px-2.5 py-1 rounded-lg text-gray-500 hover:text-gray-300 transition';
    if (thPeriod) thPeriod.textContent = 'Mois';
  }

  if (lastResult) renderTable(lastResult);
}

function recalculate() {
  const inputs = getInputs();
  const result = compute(inputs);
  lastResult = result;
  renderResults(result, inputs);
  if (currentTab === 'amort') renderStackedChart(result);
  else renderPieChart(result);
  renderTable(result);
}

// ─── Results Cards ───────────────────────────────────────────────────────────

function renderResults(r, inputs) {
  const container = document.getElementById('credit-results');
  if (!container) return;

  const endettementOk = r.tauxEndettement <= 0.35;
  const endettementColor = endettementOk ? 'text-accent-green' : 'text-red-400';
  const endettementBg = endettementOk ? 'bg-accent-green/15 border-accent-green/10' : 'bg-red-500/10 border-red-500/10';

  container.innerHTML = `
    <!-- Mensualité -->
    <div class="card-dark rounded-2xl p-4 col-span-2 sm:col-span-3 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border border-blue-500/10">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs text-gray-500 uppercase tracking-wider">Mensualité totale</p>
          <p class="text-2xl font-bold text-blue-400 mt-1">${formatCurrencyCents(r.mensualiteTotale)}<span class="text-sm text-gray-500 font-normal"> /mois</span></p>
          <p class="text-xs text-gray-500 mt-1">dont ${formatCurrencyCents(r.mensualiteHorsAssurance)} crédit + ${formatCurrencyCents(r.assuranceMensuelle)} assurance</p>
        </div>
        <div class="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <svg class="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Taux d'endettement -->
    <div class="card-dark rounded-2xl p-4 ${endettementBg}">
      <p class="text-xs text-gray-500 uppercase tracking-wider">Endettement</p>
      <p class="text-lg font-bold ${endettementColor} mt-1">${(r.tauxEndettement * 100).toFixed(1)} %</p>
      <p class="text-xs ${endettementOk ? 'text-accent-green/60' : 'text-red-400/60'} mt-0.5">${endettementOk ? '< 35 % — OK' : '> 35 % — Risqué'}</p>
    </div>

    <!-- Reste à vivre -->
    ${metricCard('Reste à vivre', formatCurrency(Math.round(r.resteAVivre)) + '/mois', r.resteAVivre > 0 ? 'text-accent-green' : 'text-red-400', '')}

    <!-- Montant emprunté -->
    ${metricCard('Montant emprunté', formatCurrency(r.montantEmprunte), 'text-gray-200', '')}

    <!-- Coût total du crédit -->
    ${metricCard('Coût total intérêts', formatCurrency(Math.round(r.coutTotalCredit)), 'text-accent-amber', '')}

    <!-- Coût assurance -->
    ${metricCard('Coût assurance', formatCurrency(Math.round(r.coutTotalAssurance)), 'text-accent-purple', '')}

    <!-- Coût total global -->
    ${metricCard('Coût total global', formatCurrency(Math.round(r.coutTotal)), 'text-red-400', 'Intérêts + assurance + frais')}

    <!-- TAEG -->
    ${metricCard('TAEG estimé', (r.taeg * 100).toFixed(2) + ' %', 'text-accent-cyan', 'Taux tout compris')}

    <!-- Frais de notaire -->
    ${metricCard('Frais de notaire', formatCurrency(Math.round(r.montantFraisNotaire)), 'text-gray-400', (inputs.fraisNotaire) + ' % du bien')}
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

// ─── Stacked Bar Chart (Capital vs Intérêts vs Assurance) ────────────────────

function renderStackedChart(r) {
  const canvas = document.getElementById('credit-chart-stacked');
  if (!canvas) return;

  const labels = r.annuel.map(a => 'An ' + a.annee);

  createChart('credit-chart-stacked', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Capital remboursé',
          data: r.annuel.map(a => Math.round(a.capitalRembourse)),
          backgroundColor: '#3b82f6',
          borderRadius: 2,
        },
        {
          label: 'Intérêts',
          data: r.annuel.map(a => Math.round(a.interets)),
          backgroundColor: '#f59e0b',
          borderRadius: 2,
        },
        {
          label: 'Assurance',
          data: r.annuel.map(a => Math.round(a.assurance)),
          backgroundColor: '#a855f7',
          borderRadius: 2,
        }
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
            callback: v => v >= 1000 ? Math.round(v / 1000) + ' k€' : v + ' €',
          },
          beginAtZero: true,
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, color: '#e5e7eb', font: { size: 12, family: 'Inter' } }
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

// ─── Pie Chart (Répartition du coût total) ───────────────────────────────────

function renderPieChart(r) {
  const canvas = document.getElementById('credit-chart-pie');
  if (!canvas) return;

  const montantEmprunte = r.montantEmprunte;

  createChart('credit-chart-pie', {
    type: 'doughnut',
    data: {
      labels: ['Capital emprunté', 'Intérêts', 'Assurance', 'Frais de notaire', 'Frais (dossier + garantie)'],
      datasets: [{
        data: [
          montantEmprunte,
          Math.round(r.coutTotalCredit),
          Math.round(r.coutTotalAssurance),
          Math.round(r.montantFraisNotaire),
          Math.round(r.coutTotal - r.coutTotalCredit - r.coutTotalAssurance - r.montantFraisNotaire),
        ],
        backgroundColor: ['#3b82f6', '#f59e0b', '#a855f7', '#06b6d4', '#6366f1'],
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 14, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, color: '#e5e7eb', font: { size: 12, family: 'Inter' } }
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
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${pct} %)`;
            }
          }
        },
      }
    }
  });
}

// ─── Amortization Table ──────────────────────────────────────────────────────

function renderTable(r) {
  const tbody = document.getElementById('credit-table-body');
  if (!tbody) return;

  if (currentView === 'annuel') {
    tbody.innerHTML = r.annuel.map((a, i) => `
      <tr class="${i % 2 === 0 ? '' : 'bg-dark-800/30'} hover:bg-dark-600/30 transition">
        <td class="py-1.5 px-2 text-gray-400">An ${a.annee}</td>
        <td class="py-1.5 px-2 text-right font-mono text-blue-400">${formatCurrency(Math.round(a.capitalRembourse))}</td>
        <td class="py-1.5 px-2 text-right font-mono text-amber-400">${formatCurrency(Math.round(a.interets))}</td>
        <td class="py-1.5 px-2 text-right font-mono text-purple-400">${formatCurrency(Math.round(a.assurance))}</td>
        <td class="py-1.5 px-2 text-right font-mono text-gray-300">${formatCurrency(Math.round(a.capitalRestant))}</td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = r.echeances.map((e, i) => `
      <tr class="${i % 2 === 0 ? '' : 'bg-dark-800/30'} hover:bg-dark-600/30 transition">
        <td class="py-1.5 px-2 text-gray-400">${e.mois}</td>
        <td class="py-1.5 px-2 text-right font-mono text-blue-400">${formatCurrencyCents(e.capital)}</td>
        <td class="py-1.5 px-2 text-right font-mono text-amber-400">${formatCurrencyCents(e.interets)}</td>
        <td class="py-1.5 px-2 text-right font-mono text-purple-400">${formatCurrencyCents(e.assurance)}</td>
        <td class="py-1.5 px-2 text-right font-mono text-gray-300">${formatCurrency(Math.round(e.capitalRestant))}</td>
      </tr>
    `).join('');
  }
}
