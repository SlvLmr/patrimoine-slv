import { formatCurrency, formatPercent, computeProjection } from '../utils.js?v=8';
import { createChart, COLORS, PALETTE, GRADIENT_PAIRS, createVerticalGradient, createSliceGradient } from '../charts/chart-config.js';

// Generate financial advisor timeline events from projection snapshots
function generateTimelineEvents(snapshots, store) {
  const events = [];
  const state = store.getAll();
  const params = state.parametres;
  const currentYear = new Date().getFullYear();
  const ageFinAnnee = params.ageFinAnnee || 30;
  const groupKeys = snapshots.groupKeys || [];

  // Track thresholds already triggered
  let avDonationTriggered = false;
  let peaCeilingTriggered = false;
  let millionTriggered = false;
  let halfMillionTriggered = false;
  let twoMillionTriggered = false;
  let debtFreeTriggered = false;
  let fireTriggered = false;

  // Find PEA opening date for 5-year milestone
  const peaPlacements = (state.actifs.placements || []).filter(p => (p.enveloppe || '').startsWith('PEA'));
  const peaDates = peaPlacements.map(p => p.dateOuverture).filter(Boolean).map(d => new Date(d));
  const earliestPEA = peaDates.length > 0 ? new Date(Math.min(...peaDates)) : null;
  if (earliestPEA) {
    const pea5Year = earliestPEA.getFullYear() + 5;
    if (pea5Year >= currentYear && pea5Year <= currentYear + (params.projectionYears || 30)) {
      events.push({
        year: pea5Year,
        age: ageFinAnnee + (pea5Year - currentYear),
        type: 'fiscal',
        icon: 'shield',
        color: 'emerald',
        title: 'PEA : fiscalite avantageuse',
        desc: `Ton PEA aura 5 ans. Les retraits ne seront plus soumis qu'aux prelevements sociaux (17.2% au lieu de 31.4%). Conserve-le absolument.`
      });
    }
  }

  // Find AV opening date for 8-year milestone
  const avPlacements = (state.actifs.placements || []).filter(p => (p.enveloppe || '') === 'AV');
  const avDates = avPlacements.map(p => p.dateOuverture).filter(Boolean).map(d => new Date(d));
  const earliestAV = avDates.length > 0 ? new Date(Math.min(...avDates)) : null;
  if (earliestAV) {
    const av8Year = earliestAV.getFullYear() + 8;
    if (av8Year >= currentYear && av8Year <= currentYear + (params.projectionYears || 30)) {
      events.push({
        year: av8Year,
        age: ageFinAnnee + (av8Year - currentYear),
        type: 'fiscal',
        icon: 'clock',
        color: 'amber',
        title: 'Assurance Vie : maturite fiscale',
        desc: `Ton AV aura 8 ans. Tu beneficies d'un abattement annuel de 4 600 EUR sur les gains et d'une fiscalite reduite (24.7% vs 31.4%).`
      });
    }
  }

  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i];
    const prevS = i > 0 ? snapshots[i - 1] : null;

    // AV reaching 300K -> donation time
    const avTotal = groupKeys.filter(k => k === 'Assurance Vie').reduce((sum, k) => sum + (s.placementDetail[k] || 0), 0);
    if (!avDonationTriggered && avTotal >= 300000) {
      avDonationTriggered = true;
      events.push({
        year: s.calendarYear,
        age: s.age,
        type: 'donation',
        icon: 'gift',
        color: 'purple',
        title: 'Donation via Assurance Vie',
        desc: `L'AV atteint ${formatCurrency(avTotal)}. C'est le moment d'envisager des donations aux enfants : 150 000 EUR par enfant via le cadre fiscal avantageux de l'AV (abattement de 152 500 EUR par beneficiaire). Pense a mettre a jour les clauses beneficiaires.`,
        montant: 300000
      });
    }

    // PEA ceiling reached
    if (!peaCeilingTriggered && s.totalApports) {
      const peaApports = groupKeys.filter(k => k.startsWith('PEA')).reduce((sum, k) => sum + (s.placementApports[k] || 0), 0);
      if (peaApports >= 145000) {
        peaCeilingTriggered = true;
        const peaValue = groupKeys.filter(k => k.startsWith('PEA')).reduce((sum, k) => sum + (s.placementDetail[k] || 0), 0);
        events.push({
          year: s.calendarYear,
          age: s.age,
          type: 'strategy',
          icon: 'flag',
          color: 'blue',
          title: 'Plafond PEA atteint',
          desc: `Tes apports PEA approchent le plafond de 150 000 EUR (valeur du PEA : ${formatCurrency(peaValue)}). Les futurs versements seront rediriges vers tes enveloppes de debordement. Ne casse surtout pas ton PEA, ses gains continueront de composer en franchise d'impot.`
        });
      }
    }

    // Patrimoine milestones
    if (!halfMillionTriggered && s.patrimoineNet >= 500000) {
      halfMillionTriggered = true;
      events.push({
        year: s.calendarYear,
        age: s.age,
        type: 'milestone',
        icon: 'star',
        color: 'amber',
        title: 'Cap des 500 000 EUR',
        desc: `Ton patrimoine net atteint ${formatCurrency(s.patrimoineNet)}. A ce stade, pense a diversifier entre classes d'actifs et a verifier ton allocation cible. Les interets composes commencent a vraiment travailler pour toi.`
      });
    }
    if (!millionTriggered && s.patrimoineNet >= 1000000) {
      millionTriggered = true;
      events.push({
        year: s.calendarYear,
        age: s.age,
        type: 'milestone',
        icon: 'trophy',
        color: 'amber',
        title: 'Millionnaire !',
        desc: `Patrimoine net de ${formatCurrency(s.patrimoineNet)}. C'est le moment de consulter un CGP (Conseiller en Gestion de Patrimoine) pour optimiser ta fiscalite, anticiper la transmission et proteger ton capital. Envisage une strategie de rente.`
      });
    }
    if (!twoMillionTriggered && s.patrimoineNet >= 2000000) {
      twoMillionTriggered = true;
      events.push({
        year: s.calendarYear,
        age: s.age,
        type: 'milestone',
        icon: 'trophy',
        color: 'purple',
        title: 'Cap des 2 000 000 EUR',
        desc: `Ton patrimoine depasse les 2M EUR. Attention a l'IFI si ta part immobiliere depasse 1.3M EUR net. Pense aussi a des donations anticipees pour reduire les droits de succession (abattement de 100 000 EUR par parent/enfant, renouvelable tous les 15 ans).`
      });
    }

    // Debt-free milestone
    if (!debtFreeTriggered && prevS && prevS.totalDette > 0 && s.totalDette <= 0) {
      debtFreeTriggered = true;
      events.push({
        year: s.calendarYear,
        age: s.age,
        type: 'milestone',
        icon: 'check',
        color: 'emerald',
        title: 'Plus aucune dette !',
        desc: `Tous tes emprunts sont rembourses. Ta capacite d'epargne augmente de ${formatCurrency(prevS.mensualites)}/mois. Redirige ce montant vers tes placements pour accelerer la croissance.`
      });
    }

    // FIRE milestone (liquidites nettes > 25x depenses annuelles)
    if (!fireTriggered && s.depensesMensuelles > 0) {
      const depensesAnnuelles = s.depensesMensuelles * 12;
      if (s.totalLiquiditesNettes >= depensesAnnuelles * 25) {
        fireTriggered = true;
        events.push({
          year: s.calendarYear,
          age: s.age,
          type: 'strategy',
          icon: 'fire',
          color: 'orange',
          title: 'Independance financiere (FIRE)',
          desc: `Tes liquidites nettes (${formatCurrency(s.totalLiquiditesNettes)}) representent 25x tes depenses annuelles (${formatCurrency(depensesAnnuelles)}). En theorie, tu pourrais vivre de tes placements avec la regle des 4%.`
        });
      }
    }

    // Retirement
    if (s.isRetraite) {
      events.push({
        year: s.calendarYear,
        age: s.age,
        type: 'retirement',
        icon: 'sun',
        color: 'cyan',
        title: 'Depart a la retraite',
        desc: `A ${s.age} ans, patrimoine net de ${formatCurrency(s.patrimoineNet)}, dont ${formatCurrency(s.totalLiquiditesNettes)} en liquidites nettes apres impots. ${s.capaciteEpargne > 0 ? `Capacite d'epargne mensuelle restante : ${formatCurrency(s.capaciteEpargne)}.` : ''}`
      });
    }
  }

  // Sort by year
  events.sort((a, b) => a.year - b.year);
  return events;
}

export function render(store) {
  const totalActifs = store.totalActifs();
  const totalPassifs = store.totalPassifs();
  const patrimoineNet = store.patrimoineNet();
  const capacite = store.capaciteEpargne();
  const state = store.getAll();
  const params = state.parametres;
  const projYears = params.projectionYears || 30;

  const immoTotal = state.actifs.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const placTotal = state.actifs.placements.reduce((s, i) => s + (Number(i.valeur) || Number(i.apport) || 0), 0);
  const eparTotal = state.actifs.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const ccTotal = store.totalComptesCourantsLive();

  const hasData = totalActifs > 0 || totalPassifs > 0;

  // Calculate allocation percentages
  const allocItems = [];
  if (immoTotal > 0) allocItems.push({ label: 'Immobilier', value: immoTotal, color: COLORS.immobilier, pct: ((immoTotal / totalActifs) * 100).toFixed(1) });
  if (placTotal > 0) allocItems.push({ label: 'Placements', value: placTotal, color: COLORS.placements, pct: ((placTotal / totalActifs) * 100).toFixed(1) });
  if (eparTotal > 0) allocItems.push({ label: 'Épargne', value: eparTotal, color: COLORS.epargne, pct: ((eparTotal / totalActifs) * 100).toFixed(1) });
  if (ccTotal > 0) allocItems.push({ label: 'Comptes courants', value: ccTotal, color: '#6366f1', pct: ((ccTotal / totalActifs) * 100).toFixed(1) });

  return `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
            </svg>
          </div>
          Tableau de bord
        </h2>
        <p class="text-gray-500 text-sm mt-1">Vue d'ensemble de ton patrimoine</p>
      </div>

      <!-- Main patrimoine card -->
      <div class="net-worth-display rounded-2xl p-8 text-center">
        <p class="text-sm text-gray-400 mb-2 uppercase tracking-wider">Patrimoine Net</p>
        <p id="dash-patrimoine-net" class="text-5xl font-bold gradient-text mb-3">${formatCurrency(patrimoineNet)}</p>
        <div class="flex items-center justify-center gap-6 text-sm">
          <span class="text-gray-400">Actifs: <span id="dash-total-actifs" class="text-accent-green font-medium">${formatCurrency(totalActifs)}</span></span>
          <span class="text-gray-500">|</span>
          <span class="text-gray-400">Passifs: <span id="dash-total-passifs" class="text-accent-red font-medium">${formatCurrency(totalPassifs)}</span></span>
        </div>
      </div>

      ${hasData ? `
      <!-- Projection Slider -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
            <span class="text-sm font-semibold text-gray-300 uppercase tracking-wide">Projection dans le temps</span>
          </div>
          <div class="flex items-center gap-2">
            <span id="dash-slider-label" class="text-sm font-medium text-sky-400">Aujourd'hui</span>
            <span id="dash-slider-age" class="text-xs text-gray-500"></span>
          </div>
        </div>
        <input type="range" id="dash-year-slider" min="0" max="${projYears}" value="0" step="1"
          class="w-full h-2 bg-dark-600 rounded-lg appearance-none cursor-pointer accent-sky-500
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:shadow-lg
          [&::-webkit-slider-thumb]:shadow-sky-500/30 [&::-webkit-slider-thumb]:cursor-grab
          [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-sky-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab">
        <div class="flex justify-between mt-1 text-xs text-gray-600">
          <span>${new Date().getFullYear()}</span>
          <span>+5 ans</span>
          <span>+10 ans</span>
          <span>+15 ans</span>
          <span>+20 ans</span>
          <span>+${projYears} ans</span>
        </div>
      </div>

      <!-- KPI Cards (updated by slider) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Immobilier</p>
          </div>
          <p id="dash-kpi-immo" class="text-2xl font-bold text-accent-green">${formatCurrency(immoTotal)}</p>
          <p id="dash-kpi-immo-delta" class="text-xs text-gray-600 mt-1"></p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-blue">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-blue/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Placements</p>
          </div>
          <p id="dash-kpi-plac" class="text-2xl font-bold text-accent-blue">${formatCurrency(placTotal)}</p>
          <p id="dash-kpi-plac-delta" class="text-xs text-gray-600 mt-1"></p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-amber/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Épargne</p>
          </div>
          <p id="dash-kpi-epar" class="text-2xl font-bold text-accent-amber">${formatCurrency(eparTotal)}</p>
          <p id="dash-kpi-epar-delta" class="text-xs text-gray-600 mt-1"></p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Liquidites nettes</p>
          </div>
          <p id="dash-kpi-liq" class="text-2xl font-bold text-indigo-400">${formatCurrency(ccTotal + eparTotal + placTotal)}</p>
          <p id="dash-kpi-liq-delta" class="text-xs text-gray-600 mt-1"></p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Capacite d'epargne</p>
          </div>
          <p id="dash-kpi-capacite" class="text-2xl font-bold ${capacite >= 0 ? 'text-accent-green' : 'text-accent-red'}">${formatCurrency(capacite)}<span class="text-sm font-normal text-gray-500">/mois</span></p>
        </div>
      </div>

      <!-- Placement breakdown (updated by slider) -->
      <div id="dash-placement-breakdown" class="card-dark rounded-xl p-5" style="display:none">
        <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Detail des placements projetes</h3>
        <div id="dash-placement-bars" class="space-y-2"></div>
      </div>

      <!-- Financial Advisor Timeline -->
      <div class="card-dark rounded-xl p-6">
        <div class="flex items-center gap-2 mb-5">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <h2 class="text-base font-bold text-gray-200">Conseils financiers personnalises</h2>
        </div>
        <div id="dash-timeline" class="relative pl-6">
          <div class="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/40 via-sky-500/30 to-transparent"></div>
          <p class="text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Repartition des actifs</h2>
          <div class="h-64 relative">
            <canvas id="chart-repartition"></canvas>
          </div>
          <!-- Allocation bars -->
          <div class="mt-4 space-y-3">
            ${allocItems.map(item => `
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-400">${item.label}</span>
                <span class="text-gray-300 font-medium">${item.pct}% — ${formatCurrency(item.value)}</span>
              </div>
              <div class="progress-bar h-2">
                <div class="progress-bar-fill h-full" style="width: ${item.pct}%; background: ${item.color}"></div>
              </div>
            </div>
            `).join('')}
          </div>
        </div>
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Actifs vs Passifs</h2>
          <div class="h-64">
            <canvas id="chart-actifs-passifs"></canvas>
          </div>
        </div>
      </div>

      <!-- Detail Tables -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="card-dark rounded-xl p-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-3 h-3 rounded-full bg-accent-green"></div>
            <h3 class="font-semibold text-gray-200">Immobilier</h3>
          </div>
          ${state.actifs.immobilier.length > 0 ? state.actifs.immobilier.map(i => `
            <div class="flex justify-between py-2.5 border-b border-dark-400/30">
              <span class="text-gray-400 text-sm">${i.nom}</span>
              <span class="font-medium text-sm text-gray-200">${formatCurrency(i.valeurActuelle)}</span>
            </div>
          `).join('') : '<p class="text-gray-600 text-sm">Aucun bien</p>'}
        </div>
        <div class="card-dark rounded-xl p-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-3 h-3 rounded-full bg-accent-blue"></div>
            <h3 class="font-semibold text-gray-200">Placements</h3>
          </div>
          ${state.actifs.placements.length > 0 ? state.actifs.placements.map(i => `
            <div class="flex justify-between py-2.5 border-b border-dark-400/30">
              <div>
                <span class="text-gray-400 text-sm">${i.nom}</span>
                ${i.type ? `<span class="ml-2 text-xs px-1.5 py-0.5 rounded bg-dark-500 text-gray-500">${i.type}</span>` : ''}
              </div>
              <span class="font-medium text-sm text-gray-200">${formatCurrency(Number(i.valeur) || Number(i.apport) || 0)}</span>
            </div>
          `).join('') : '<p class="text-gray-600 text-sm">Aucun placement</p>'}
        </div>
        <div class="card-dark rounded-xl p-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-3 h-3 rounded-full bg-accent-amber"></div>
            <h3 class="font-semibold text-gray-200">Epargne</h3>
          </div>
          ${state.actifs.epargne.length > 0 ? state.actifs.epargne.map(i => `
            <div class="flex justify-between py-2.5 border-b border-dark-400/30">
              <span class="text-gray-400 text-sm">${i.nom}</span>
              <span class="font-medium text-sm text-gray-200">${formatCurrency(i.solde)}</span>
            </div>
          `).join('') : '<p class="text-gray-600 text-sm">Aucune epargne</p>'}
        </div>
        <div class="card-dark rounded-xl p-6">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-3 h-3 rounded-full bg-indigo-500"></div>
            <h3 class="font-semibold text-gray-200">Comptes courants</h3>
          </div>
          ${(state.actifs.comptesCourants || []).map(c => `
            <div class="flex justify-between items-center py-2.5 border-b border-dark-400/30">
              <span class="text-gray-400 text-sm">${c.nom}</span>
              <input type="number" data-cc-id="${c.id}" value="${Number(c.solde) || 0}" step="0.01"
                class="input-field w-28 text-indigo-400 font-medium">
            </div>
          `).join('')}
        </div>
      </div>
      ` : `
      <div class="card-dark rounded-xl p-12 text-center">
        <div class="mb-6">
          <div class="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent-green/20 to-accent-amber/20 flex items-center justify-center mb-4">
            <svg class="w-10 h-10 text-accent-green/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
          </div>
        </div>
        <h2 class="text-xl font-semibold text-gray-300 mb-2">Commencez par ajouter vos donnees</h2>
        <p class="text-gray-500 max-w-md mx-auto">Rendez-vous dans les sections Actifs, Passifs et Revenus & Depenses pour renseigner votre patrimoine.</p>
      </div>
      `}
    </div>
  `;
}

export function mount(store, navigate) {
  const state = store.getAll();
  const immoTotal = state.actifs.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const placTotal = state.actifs.placements.reduce((s, i) => s + (Number(i.valeur) || Number(i.apport) || 0), 0);
  const eparTotal = state.actifs.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const ccTotal = store.totalComptesCourantsLive();
  const totalActifs = store.totalActifs();
  const totalPassifs = store.totalPassifs();

  if (totalActifs === 0 && totalPassifs === 0) return;

  // Compute projection for slider
  let snapshots = [];
  let timelineEvents = [];
  try {
    snapshots = computeProjection(store);
    timelineEvents = generateTimelineEvents(snapshots, store);
  } catch (e) {
    console.error('Projection error:', e);
  }

  const params = state.parametres;
  const currentYear = new Date().getFullYear();
  const ageFinAnnee = params.ageFinAnnee || 30;
  const groupKeys = snapshots.groupKeys || [];

  // Color palette for placement groups
  const groupColorMap = {
    'PEA ETF': { bg: '#3b82f6', text: 'text-blue-400' },
    'PEA Actions': { bg: '#f59e0b', text: 'text-amber-400' },
    'Assurance Vie': { bg: '#06b6d4', text: 'text-cyan-400' },
    'CTO': { bg: '#a855f7', text: 'text-purple-400' },
    'PEE': { bg: '#14b8a6', text: 'text-teal-400' },
    'PER': { bg: '#ec4899', text: 'text-pink-400' },
    'Crypto': { bg: '#f97316', text: 'text-orange-400' },
  };
  const defaultGroupCol = { bg: '#6366f1', text: 'text-indigo-400' };

  // Slider update function
  const slider = document.getElementById('dash-year-slider');
  const sliderLabel = document.getElementById('dash-slider-label');
  const sliderAge = document.getElementById('dash-slider-age');

  function updateDashboardForYear(yearIdx) {
    const s = snapshots[yearIdx];
    if (!s) return;

    // Update slider label
    if (yearIdx === 0) {
      sliderLabel.textContent = "Aujourd'hui";
    } else {
      sliderLabel.textContent = `Fin ${s.calendarYear} (+${yearIdx} an${yearIdx > 1 ? 's' : ''})`;
    }
    sliderAge.textContent = `${s.age} ans`;

    // Update patrimoine net
    const patrimoineEl = document.getElementById('dash-patrimoine-net');
    const totalActifsEl = document.getElementById('dash-total-actifs');
    const totalPassifsEl = document.getElementById('dash-total-passifs');
    if (patrimoineEl) patrimoineEl.textContent = formatCurrency(s.patrimoineNet);
    if (totalActifsEl) totalActifsEl.textContent = formatCurrency(s.immobilier + s.placements + s.epargne);
    if (totalPassifsEl) totalPassifsEl.textContent = formatCurrency(s.totalDette);

    // Update KPI cards
    const first = snapshots[0];
    const updateKpi = (id, value, deltaId, baseValue) => {
      const el = document.getElementById(id);
      const deltaEl = document.getElementById(deltaId);
      if (el) el.textContent = formatCurrency(value);
      if (deltaEl) {
        if (yearIdx === 0) {
          deltaEl.textContent = '';
        } else {
          const delta = value - baseValue;
          const sign = delta >= 0 ? '+' : '';
          deltaEl.textContent = `${sign}${formatCurrency(delta)} vs aujourd'hui`;
          deltaEl.className = `text-xs mt-1 ${delta >= 0 ? 'text-emerald-500' : 'text-red-400'}`;
        }
      }
    };

    updateKpi('dash-kpi-immo', s.immobilier, 'dash-kpi-immo-delta', first?.immobilier || 0);
    updateKpi('dash-kpi-plac', s.placements, 'dash-kpi-plac-delta', first?.placements || 0);
    updateKpi('dash-kpi-epar', s.epargne, 'dash-kpi-epar-delta', first?.epargne || 0);
    updateKpi('dash-kpi-liq', s.totalLiquiditesNettes, 'dash-kpi-liq-delta', first?.totalLiquiditesNettes || 0);

    // Capacite
    const capEl = document.getElementById('dash-kpi-capacite');
    if (capEl) {
      const cap = s.capaciteEpargne;
      capEl.innerHTML = `${formatCurrency(cap)}<span class="text-sm font-normal text-gray-500">/mois</span>`;
      capEl.className = `text-2xl font-bold ${cap >= 0 ? 'text-accent-green' : 'text-accent-red'}`;
    }

    // Placement breakdown bars
    const breakdownSection = document.getElementById('dash-placement-breakdown');
    const barsContainer = document.getElementById('dash-placement-bars');
    if (breakdownSection && barsContainer && yearIdx > 0 && groupKeys.length > 0) {
      breakdownSection.style.display = '';
      const totalPlac = s.placements || 1;
      let barsHtml = '';
      groupKeys.forEach(k => {
        const val = s.placementDetail[k] || 0;
        if (val <= 0) return;
        const pct = ((val / totalPlac) * 100).toFixed(1);
        const col = groupColorMap[k] || defaultGroupCol;
        const gains = s.placementGains[k] || 0;
        const taxes = s.placementTaxes[k] || 0;
        barsHtml += `
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-400">${k}</span>
              <span class="text-gray-300">${formatCurrency(val)} <span class="text-gray-600">(${pct}%)</span></span>
            </div>
            <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300" style="width: ${pct}%; background: ${col.bg}"></div>
            </div>
            <div class="flex gap-3 mt-0.5 text-[10px]">
              <span class="text-emerald-500/70">+${formatCurrency(gains)} gains</span>
              <span class="text-red-400/70">-${formatCurrency(taxes)} impots</span>
            </div>
          </div>`;
      });
      barsContainer.innerHTML = barsHtml;
    } else if (breakdownSection) {
      breakdownSection.style.display = 'none';
    }
  }

  // Wire up slider
  if (slider && snapshots.length > 0) {
    slider.max = snapshots.length - 1;
    slider.addEventListener('input', (e) => {
      updateDashboardForYear(parseInt(e.target.value));
    });
  }

  // Render timeline
  const timelineContainer = document.getElementById('dash-timeline');
  if (timelineContainer && timelineEvents.length > 0) {
    const iconSvgs = {
      gift: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a4 4 0 00-4-4 4 4 0 014 4zm0 0V6a4 4 0 014-4 4 4 0 01-4 4zM5 8h14M5 8a2 2 0 00-2 2v1h18v-1a2 2 0 00-2-2M3 11v5a2 2 0 002 2h14a2 2 0 002-2v-5"/></svg>',
      flag: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z"/></svg>',
      star: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>',
      trophy: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>',
      check: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
      shield: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>',
      clock: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      sun: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>',
      fire: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/></svg>'
    };

    const colorClasses = {
      purple: { dot: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
      blue: { dot: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
      amber: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
      emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
      cyan: { dot: 'bg-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
      orange: { dot: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
    };

    let html = '';
    timelineEvents.forEach((evt) => {
      const cc = colorClasses[evt.color] || colorClasses.blue;
      const icon = iconSvgs[evt.icon] || iconSvgs.star;
      html += `
        <div class="relative mb-5 last:mb-0">
          <div class="absolute -left-[18px] top-1 w-5 h-5 rounded-full ${cc.dot} flex items-center justify-center text-white shadow-lg">
            ${icon}
          </div>
          <div class="${cc.bg} border ${cc.border} rounded-lg p-4 ml-2">
            <div class="flex items-center gap-2 mb-1">
              <span class="${cc.text} font-bold text-sm">${evt.year}</span>
              <span class="text-gray-500 text-xs">${evt.age} ans</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded ${cc.bg} ${cc.text} font-medium uppercase tracking-wider">${evt.type}</span>
            </div>
            <h4 class="text-gray-200 font-semibold text-sm mb-1">${evt.title}</h4>
            <p class="text-gray-400 text-xs leading-relaxed">${evt.desc}</p>
          </div>
        </div>`;
    });

    if (html) {
      timelineContainer.innerHTML = html;
    } else {
      timelineContainer.innerHTML = '<p class="text-gray-500 text-sm">Ajoute des placements et des parametres de projection pour voir les conseils personnalises.</p>';
    }
  } else if (timelineContainer) {
    timelineContainer.innerHTML = '<p class="text-gray-500 text-sm">Ajoute des placements et des parametres de projection pour voir les conseils personnalises.</p>';
  }

  // Doughnut chart with gradient slices
  if (document.getElementById('chart-repartition')) {
    const canvas = document.getElementById('chart-repartition');
    const ctx2d = canvas.getContext('2d');
    const data = [];
    const labels = [];
    const gradColors = [];
    const gradientPairsMap = [
      ['#8b6914', '#b8976c'],
      ['#c9a76c', '#dbb88a'],
      ['#e8d5b0', '#f5edd8'],
      ['#6366f1', '#818cf8'],
    ];
    if (immoTotal > 0) { data.push(immoTotal); labels.push('Immobilier'); gradColors.push(createSliceGradient(ctx2d, gradientPairsMap[0][0], gradientPairsMap[0][1])); }
    if (placTotal > 0) { data.push(placTotal); labels.push('Placements'); gradColors.push(createSliceGradient(ctx2d, gradientPairsMap[1][0], gradientPairsMap[1][1])); }
    if (eparTotal > 0) { data.push(eparTotal); labels.push('Epargne'); gradColors.push(createSliceGradient(ctx2d, gradientPairsMap[2][0], gradientPairsMap[2][1])); }
    if (ccTotal > 0) { data.push(ccTotal); labels.push('Comptes courants'); gradColors.push(createSliceGradient(ctx2d, gradientPairsMap[3][0], gradientPairsMap[3][1])); }

    if (data.length > 0) {
      createChart('chart-repartition', {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: gradColors,
            borderWidth: 0,
            hoverOffset: 10,
            borderRadius: 4
          }]
        },
        options: {
          cutout: '68%',
          plugins: {
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = ((ctx.raw / total) * 100).toFixed(1);
                  return ` ${ctx.label}: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(ctx.raw)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  // Bar chart with gradient fills
  if (document.getElementById('chart-actifs-passifs')) {
    const canvas = document.getElementById('chart-actifs-passifs');
    const ctx2d = canvas.getContext('2d');
    const gradActifs = ctx2d.createLinearGradient(0, 0, canvas.width, 0);
    gradActifs.addColorStop(0, '#c9a76c');
    gradActifs.addColorStop(1, '#dbb88a');
    const gradPassifs = ctx2d.createLinearGradient(0, 0, canvas.width, 0);
    gradPassifs.addColorStop(0, '#ff4757');
    gradPassifs.addColorStop(1, '#ff6b6b');

    createChart('chart-actifs-passifs', {
      type: 'bar',
      data: {
        labels: ['Actifs', 'Passifs'],
        datasets: [{
          data: [totalActifs, totalPassifs],
          backgroundColor: [gradActifs, gradPassifs],
          borderRadius: 8,
          barThickness: 60
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: COLORS.grid },
            ticks: {
              color: COLORS.gridText,
              callback: v => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: 'compact' }).format(v)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: COLORS.gridText }
          }
        }
      }
    });
  }

  // Live edit comptes courants
  document.querySelectorAll('[data-cc-id]').forEach(input => {
    input.addEventListener('change', () => {
      const ccId = input.dataset.ccId;
      const cc = (store.getAll().actifs.comptesCourants || []);
      const account = cc.find(c => c.id === ccId);
      if (account) {
        account.solde = parseFloat(input.value) || 0;
        store.set('actifs.comptesCourants', cc);
      }
    });
  });
}
