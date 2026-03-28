import { formatCurrency, openModal, computeProjection, getPlacementGroupKey } from '../utils.js?v=6';
import { createChart, destroyChart, legendStrikethroughPlugin } from '../charts/chart-config.js';

// ============================================================================
// HYPOTHÈSES — Plan théorique éditable
// ============================================================================

const ABATTEMENT_PARENT_ENFANT = 100000;
const DON_FAMILIAL_TEPA = 31865;
const AV_ABATTEMENT_PAR_BENEFICIAIRE = 152500;
const AGE_MAX_DONATEUR_TEPA = 80;
const AGE_MAX_DONATEUR_AV = 70;
const RENOUVELLEMENT_ANNEES = 15;

function getDonationConfig(store) {
  return store.get('donationConfig') || { enfants: [], donations: [] };
}

function childAge(dateNaissance) {
  if (!dateNaissance) return null;
  return Math.floor((Date.now() - new Date(dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000));
}

const DEFAULT_THEMES = [
  { id: 'donation',   label: 'Donation',   color: 'purple', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
  { id: 'evenement',  label: 'Événement',  color: 'cyan',   icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
];

// ─── Notary fees estimation ──────────────────────────────────────────────────
// Barème proportionnel des émoluments notariés (donations / actes immobiliers)
function estimerFraisNotaire(montant, theme, donationType) {
  if (!montant || montant <= 0) return null;

  if (theme === 'donation') {
    // Émoluments proportionnels du notaire pour acte de donation
    // Barème dégressif officiel (Art. A444-67 Code de commerce)
    let emoluments = 0;
    const tranches = [
      { max: 6500, taux: 0.04837 },
      { max: 17000, taux: 0.01995 },
      { max: 60000, taux: 0.01330 },
      { max: Infinity, taux: 0.00998 }
    ];
    let reste = montant;
    let prev = 0;
    for (const t of tranches) {
      const tranche = Math.min(reste, t.max - prev);
      if (tranche <= 0) break;
      emoluments += tranche * t.taux;
      reste -= tranche;
      prev = t.max;
    }
    // Taxe de publicité foncière (si donation immobilière) : 0.715%
    const isImmo = donationType === 'abatt_immo';
    const tpf = isImmo ? montant * 0.00715 : 0;
    // Contribution de sécurité immobilière : 0.10% (min 15€)
    const csi = isImmo ? Math.max(15, montant * 0.001) : 0;
    // Frais divers (copies, débours, etc.) : ~150-300€
    const divers = 200;
    // TVA sur émoluments : 20%
    const tva = emoluments * 0.20;

    const total = Math.round(emoluments + tva + tpf + csi + divers);
    const detail = isImmo
      ? `Émol. ${Math.round(emoluments)}€ + TVA ${Math.round(tva)}€ + TPF ${Math.round(tpf)}€ + CSI ${Math.round(csi)}€`
      : `Émol. ${Math.round(emoluments)}€ + TVA ${Math.round(tva)}€ + débours ~${divers}€`;

    if (donationType === 'don_tepa') {
      // Don manuel TEPA : pas d'acte notarié obligatoire, juste déclaration
      return { total: 0, detail: 'Don manuel : pas de frais de notaire (déclaration 2735 gratuite)' };
    }
    if (donationType === 'av_donation') {
      // Assurance Vie : modification de clause bénéficiaire, pas d'acte notarié
      return { total: 0, detail: 'AV : pas de frais de notaire (modification clause bénéficiaire)' };
    }
    return { total, detail };
  }

  if (theme === 'immobilier') {
    // Frais de notaire classiques pour achat immobilier (ancien : ~7-8%)
    const droitsMutation = montant * 0.0580; // DMTO 5.80%
    let emoluments = 0;
    const tranches = [
      { max: 6500, taux: 0.03870 },
      { max: 17000, taux: 0.01596 },
      { max: 60000, taux: 0.01064 },
      { max: Infinity, taux: 0.00799 }
    ];
    let reste = montant;
    let prev = 0;
    for (const t of tranches) {
      const tranche = Math.min(reste, t.max - prev);
      if (tranche <= 0) break;
      emoluments += tranche * t.taux;
      reste -= tranche;
      prev = t.max;
    }
    const csi = Math.max(15, montant * 0.001);
    const tva = emoluments * 0.20;
    const divers = 800;
    const total = Math.round(droitsMutation + emoluments + tva + csi + divers);
    return { total, detail: `DMTO ${Math.round(droitsMutation)}€ + émol. ${Math.round(emoluments)}€ + TVA + CSI + débours` };
  }

  return null;
}

// Color mapping for Tailwind classes
const COLOR_MAP = {
  emerald: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', ring: 'ring-emerald-400/30', glow: 'shadow-emerald-500/20', line: '#34d399' },
  amber:   { dot: 'bg-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   ring: 'ring-amber-400/30',   glow: 'shadow-amber-500/20',   line: '#fbbf24' },
  purple:  { dot: 'bg-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-400',  ring: 'ring-purple-400/30',  glow: 'shadow-purple-500/20',  line: '#a78bfa' },
  blue:    { dot: 'bg-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    ring: 'ring-blue-400/30',    glow: 'shadow-blue-500/20',    line: '#60a5fa' },
  cyan:    { dot: 'bg-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    ring: 'ring-cyan-400/30',    glow: 'shadow-cyan-500/20',    line: '#22d3ee' },
  rose:    { dot: 'bg-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    ring: 'ring-rose-400/30',    glow: 'shadow-rose-500/20',    line: '#fb7185' },
  sky:     { dot: 'bg-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-400',     ring: 'ring-sky-400/30',     glow: 'shadow-sky-500/20',     line: '#38bdf8' },
  orange:  { dot: 'bg-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-400',  ring: 'ring-orange-400/30',  glow: 'shadow-orange-500/20',  line: '#fb923c' },
  teal:    { dot: 'bg-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    text: 'text-teal-400',    ring: 'ring-teal-400/30',    glow: 'shadow-teal-500/20',    line: '#2dd4bf' },
  indigo:  { dot: 'bg-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  ring: 'ring-indigo-400/30',  glow: 'shadow-indigo-500/20',  line: '#818cf8' },
  pink:    { dot: 'bg-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    text: 'text-pink-400',    ring: 'ring-pink-400/30',    glow: 'shadow-pink-500/20',    line: '#f472b6' },
};

const ALL_COLORS = Object.keys(COLOR_MAP);

function getThemes(store) {
  return store.get('hypothesesThemes') || JSON.parse(JSON.stringify(DEFAULT_THEMES));
}

function getHypotheses(store) {
  return store.get('hypotheses') || [];
}

function saveHypotheses(store, items) {
  store.set('hypotheses', items);
}

function saveThemes(store, themes) {
  store.set('hypothesesThemes', themes);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function c(color) {
  return COLOR_MAP[color] || COLOR_MAP.emerald;
}

// ─── Rendement profiles & Scenarios ──────────────────────────────────────────

const DEFAULT_PROFILES = {
  faible: {
    label: 'Faible', icon: '🐻',
    rendementImmobilier: 0.01, rendementEpargne: 0.015, inflation: 0.025,
    rendementGroupes: { 'PEA ETF': 0.065, 'PEA Actions': 0.08, 'Crypto': 0, 'PEE': 0.05, 'Assurance Vie': 0.04, 'CTO': 0.065 }
  },
  modere: {
    label: 'Modéré', icon: '📊',
    rendementImmobilier: 0.02, rendementEpargne: 0.02, inflation: 0.02,
    rendementGroupes: { 'PEA ETF': 0.10, 'PEA Actions': 0.12, 'Crypto': 0.08, 'PEE': 0.07, 'Assurance Vie': 0.065, 'CTO': 0.08 }
  },
  eleve: {
    label: 'Élevé', icon: '🚀',
    rendementImmobilier: 0.03, rendementEpargne: 0.025, inflation: 0.015,
    rendementGroupes: { 'PEA ETF': 0.125, 'PEA Actions': 0.15, 'Crypto': 0.30, 'PEE': 0.09, 'Assurance Vie': 0.08, 'CTO': 0.125 }
  }
};

const DEFAULT_SCENARIOS = [
  { id: 'reel', nom: 'Réel', color: 'blue', description: '900€/mois investis. Pension État à 64 ans. Gap FIRE→pension : 3 ans.', dcaMensuelTotal: 900, pensionAge: 64, rachatTrimestres: 0 },
  { id: 'ideal', nom: 'Idéal', color: 'emerald', description: '1 050€/mois investis. Même pension à 64 ans. 2e cycle donation CTO possible.', dcaMensuelTotal: 1050, pensionAge: 64, rachatTrimestres: 0 },
  { id: 'liberte', nom: 'Liberté', color: 'amber', description: 'Rachat 12 trimestres (~46 000€). Pension à ~62 ans (taux plein). Gap FIRE→pension : 1 an.', dcaMensuelTotal: 900, pensionAge: 62, rachatTrimestres: 12, coutRachat: 46000 }
];

const RENDEMENT_GROUP_LABELS = {
  'PEA ETF': 'PEA ETF',
  'PEA Actions': 'PEA Actions',
  'Crypto': 'Crypto',
  'PEE': 'PEE',
  'Assurance Vie': 'Assurance Vie',
  'CTO': 'CTO'
};

function getProfiles(store) {
  return store.get('profilsRendement') || JSON.parse(JSON.stringify(DEFAULT_PROFILES));
}

function getActiveProfile(store) {
  return store.get('profilRendement') || 'modere';
}

function getScenarios(store) {
  const sc = store.get('scenarios');
  return (sc && sc.length > 0) ? sc : JSON.parse(JSON.stringify(DEFAULT_SCENARIOS));
}

function getActiveScenario(store) {
  return store.get('scenarioActif') || null;
}

function saveScenarios(store, scenarios) {
  store.set('scenarios', scenarios);
}

function saveActiveScenario(store, id) {
  store.set('scenarioActif', id);
}

function saveProfiles(store, profiles) {
  store.set('profilsRendement', profiles);
}

function saveActiveProfile(store, id) {
  store.set('profilRendement', id);
}

// Build overrides object from a profile
function profileToOverrides(profiles, profileId) {
  const p = profiles[profileId];
  if (!p) return {};
  return {
    rendementGroupes: p.rendementGroupes || {},
    rendementImmobilier: p.rendementImmobilier,
    rendementEpargne: p.rendementEpargne,
    inflation: p.inflation
  };
}

// Compute projection for a specific scenario + profile combo
function computeScenarioProjection(store, scenario, profileId) {
  const profiles = getProfiles(store);
  const base = profileToOverrides(profiles, profileId || getActiveProfile(store));
  // Scenario can override DCA, transfers, etc.
  const overrides = { ...base };
  if (scenario) {
    if (scenario.dcaMultiplier !== undefined) overrides.dcaMultiplier = scenario.dcaMultiplier;
    if (scenario.extraInflation !== undefined) overrides.inflation = scenario.extraInflation;
    if (scenario.rendementPlacements !== undefined) overrides.rendementPlacements = scenario.rendementPlacements;
    if (scenario.rendementImmobilier !== undefined) overrides.rendementImmobilier = scenario.rendementImmobilier;
  }
  return computeProjection(store, overrides);
}

// ─── Scenario selector + comparison table ────────────────────────────────────

function renderScenarioSection(store) {
  const scenarios = getScenarios(store);
  const activeId = getActiveScenario(store);
  const profiles = getProfiles(store);
  const activeProfile = getActiveProfile(store);
  const params = store.get('parametres') || {};
  const ageFinAnnee = params.ageFinAnnee || 43;
  const cfg = getDonationConfig(store);
  const nbEnfants = (cfg.enfants || []).length || 1;

  // Build comparison table: 3 columns = 3 profiles, for the active scenario
  let comparisonHtml = '';
  try { throw 0; // Comparison table now uses boussole-data.json — see fillComparisonTable()
    const profileKeys = ['faible', 'modere', 'eleve'];
    const profileColors = { faible: 'cyan', modere: 'amber', eleve: 'emerald' };
    const projByProfile = {};
    profileKeys.forEach(pk => {
      try {
        projByProfile[pk] = computeProjection(store, profileToOverrides(profiles, pk));
      } catch(e) { projByProfile[pk] = []; }
    });

    // Find the FIRE year snapshot (age 61 = ageFinAnnee + offset)
    const fireAge = 61;
    const fireOffset = fireAge - ageFinAnnee;
    // Find age 70 offset for AV
    const av70Offset = 70 - ageFinAnnee;

    // Extract key data from each profile projection
    function extractData(snaps, offset) {
      const snap = snaps[Math.min(Math.max(0, offset), snaps.length - 1)];
      if (!snap) return null;
      const pd = snap.placementDetail || {};
      const pea = (pd['PEA'] || 0) + (pd['PEA ETF'] || 0) + (pd['PEA Actions'] || 0);
      const pee = pd['PEE'] || 0;
      const crypto = pd['Crypto'] || 0;
      const av = pd['Assurance Vie'] || 0;
      const cto = pd['CTO'] || 0;
      // Capital rente = PEA + PEE + Crypto (net PS 17.2% on gains for PEA/PEE, 30% flat for crypto)
      const capitalRente = pea + pee + crypto;
      const renteMois = Math.round(capitalRente * 0.035 / 12);
      return { pea, pee, crypto, av, cto, capitalRente, renteMois, patrimoineNet: snap.patrimoineNet || 0 };
    }

    const dataByProfile = {};
    profileKeys.forEach(pk => {
      dataByProfile[pk] = {
        fire: extractData(projByProfile[pk], fireOffset),
        av70: extractData(projByProfile[pk], av70Offset)
      };
    });

    const rows = [
      { label: 'Capital FIRE (61 ans)', key: 'patrimoineNet', source: 'fire', icon: '🏖️' },
      { label: 'Capital rente (PEA+PEE+Crypto)', key: 'capitalRente', source: 'fire', icon: '💰' },
      { label: 'Rente nette/mois (3,5%)', key: 'renteMois', source: 'fire', icon: '📈', suffix: '/mois' },
      { label: 'PEA à 61 ans', key: 'pea', source: 'fire', icon: '📊' },
      { label: 'Assurance Vie à 61 ans', key: 'av', source: 'fire', icon: '🛡️' },
      { label: 'AV à 70 ans', key: 'av', source: 'av70', icon: '🛡️' },
      { label: 'PEE net à 61 ans', key: 'pee', source: 'fire', icon: '🏢' },
      { label: 'Crypto à 61 ans', key: 'crypto', source: 'fire', icon: '₿' },
    ];

    comparisonHtml = `
      <div class="overflow-x-auto mt-4 -mx-1">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-dark-400/20">
              <th class="text-left py-2 px-2 text-gray-500 font-medium text-[10px] uppercase tracking-wider"></th>
              ${profileKeys.map(pk => {
                const p = profiles[pk];
                const clr = profileColors[pk];
                const isActive = pk === activeProfile;
                return `<th class="text-right py-2 px-2 font-medium text-[10px] uppercase tracking-wider ${isActive ? `text-${clr}-400` : 'text-gray-500'}">
                  ${p?.icon || ''} ${p?.label || pk}
                </th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr class="border-b border-dark-400/10 hover:bg-dark-700/20 transition">
                <td class="py-2.5 px-2 text-gray-400 font-medium whitespace-nowrap">
                  <span class="mr-1">${row.icon}</span>${row.label}
                </td>
                ${profileKeys.map(pk => {
                  const d = dataByProfile[pk]?.[row.source];
                  const val = d ? d[row.key] : 0;
                  const clr = profileColors[pk];
                  const isActive = pk === activeProfile;
                  return `<td class="py-2.5 px-2 text-right tabular-nums ${isActive ? `text-${clr}-400 font-bold` : 'text-gray-300 font-medium'}">
                    ${formatCurrency(val)}${row.suffix || ''}
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="text-[9px] text-gray-600 mt-2 italic">AV et CTO sont exclus de la rente — réservés à la transmission.</p>`;
  } catch(e) { console.error('Comparison table error:', e); }

  const profileKeys = Object.keys(profiles);
  const profileColors = { faible: 'cyan', modere: 'amber', eleve: 'emerald' };

  // Scenario subtitles
  const scenarioSubtitles = {
    reel: 'Invest. actuels · Retraite à 64 ans',
    ideal: 'Invest. idéaux · Retraite à 64 ans',
    liberte: 'Retraite à 61 ans'
  };

  return `
    <div class="card-dark rounded-2xl border border-dark-400/15 p-5">
      <!-- Header row -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-amber-500/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          Scénarios & Rendement
        </h2>
        <div class="flex items-center gap-2">
          <button id="btn-edit-profiles" class="text-[10px] text-gray-500 hover:text-amber-400 transition flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Personnaliser
          </button>
          <button id="btn-add-scenario" class="text-[10px] text-gray-500 hover:text-blue-400 transition flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
            Ajouter
          </button>
        </div>
      </div>

      <!-- 6 cards grid: 3 scenarios + 3 profiles, same size -->
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        <!-- Scenarios -->
        ${scenarios.slice(0, 3).map(sc => {
          const isActive = sc.id === activeId;
          const scColor = sc.color || 'blue';
          const subtitle = scenarioSubtitles[sc.id] || sc.description || '';
          return `
          <button class="scenario-tab relative rounded-xl border p-3 transition-all duration-200 text-center flex flex-col items-center justify-center min-h-[90px]
            ${isActive
              ? `border-${scColor}-500/40 bg-${scColor}-500/10 shadow-lg shadow-${scColor}-500/10`
              : 'border-dark-400/20 hover:border-dark-400/40 bg-dark-800/30'}" data-scenario-id="${sc.id}">
            <p class="text-xs font-bold ${isActive ? `text-${scColor}-400` : 'text-gray-400'}">${sc.nom}</p>
            <p class="text-[8px] ${isActive ? 'text-gray-300' : 'text-gray-600'} mt-1 leading-tight">${subtitle}</p>
            ${isActive ? `<div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-${scColor}-500 flex items-center justify-center shadow-lg"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></div>` : ''}
            <span class="scenario-edit absolute top-1 right-1 p-0.5 rounded opacity-0 hover:opacity-100 hover:bg-dark-600/80 transition cursor-pointer" data-scenario-id="${sc.id}" title="Modifier">
              <svg class="w-2.5 h-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </span>
          </button>`;
        }).join('')}
        <!-- Profiles -->
        ${profileKeys.map(key => {
          const p = profiles[key];
          const isActive = key === activeProfile;
          const clr = profileColors[key] || 'gray';
          const icon = p.icon || '';
          const rg = p.rendementGroupes || {};
          return `
          <button class="profil-btn relative rounded-xl border p-3 transition-all duration-200 text-center flex flex-col items-center justify-center min-h-[90px]
            ${isActive
              ? `border-${clr}-500/40 bg-${clr}-500/10 shadow-lg shadow-${clr}-500/10`
              : 'border-dark-400/20 hover:border-dark-400/40 bg-dark-800/30'}" data-profil="${key}">
            <span class="text-sm leading-none">${icon}</span>
            <p class="text-xs font-bold ${isActive ? `text-${clr}-400` : 'text-gray-400'} mt-1">${p.label}</p>
            <p class="text-[8px] ${isActive ? 'text-gray-300' : 'text-gray-600'} mt-1 leading-tight">ETF ${((rg['PEA ETF'] || 0) * 100).toFixed(0)}% · Crypto ${((rg['Crypto'] || 0) * 100).toFixed(0)}%</p>
            ${isActive ? `<div class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-${clr}-500 flex items-center justify-center shadow-lg"><svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg></div>` : ''}
          </button>`;
        }).join('')}
      </div>

      <!-- Labels row -->
      <div class="grid grid-cols-6 gap-2 -mt-4 mb-4 hidden sm:grid">
        <div class="col-span-3 text-center"><span class="text-[9px] text-gray-600 uppercase tracking-widest font-semibold">Scénarios de vie</span></div>
        <div class="col-span-3 text-center"><span class="text-[9px] text-gray-600 uppercase tracking-widest font-semibold">Hypothèses de rendement</span></div>
      </div>

    </div>`;
}

// ─── Boussole data loader ───────────────────────────────────────────────────

let _boussoleData = null;
async function loadBoussoleData() {
  if (_boussoleData) return _boussoleData;
  try {
    const resp = await fetch('./data/boussole-data.json');
    _boussoleData = await resp.json();
  } catch (e) { console.error('Boussole data load error:', e); }
  return _boussoleData;
}

// ─── Projection chart (Chart.js) ────────────────────────────────────────────

function buildProjectionChart(store, boussole, activeProfileKey) {
  const canvas = document.getElementById('hyp-proj-chart');
  if (!canvas) return;

  const profiles = getProfiles(store);
  const overrides = profileToOverrides(profiles, activeProfileKey);
  let snapshots = [];
  try { snapshots = computeProjection(store, overrides); } catch (e) { /* no data */ }

  const currentYear = new Date().getFullYear();
  const startYear = 2026;
  const endYear = 2047;

  let labels = [];
  let peaData = [], avData = [], ctoData = [], peeData = [], btcData = [];

  const hasStoreData = snapshots.length > 0 && snapshots.some(s => (s.placements || 0) > 100);

  if (hasStoreData) {
    for (let y = startYear; y <= endYear; y++) {
      const offset = y - currentYear;
      if (offset < 0 || offset >= snapshots.length) continue;
      const snap = snapshots[offset];
      labels.push(y);
      const pd = snap.placementDetail || {};
      peaData.push(Math.round((pd['PEA'] || 0) + (pd['PEA ETF'] || 0) + (pd['PEA Actions'] || 0) + (pd['PEA Autre'] || 0)));
      avData.push(Math.round(pd['Assurance Vie'] || 0));
      ctoData.push(Math.round(pd['CTO'] || 0));
      peeData.push(Math.round(pd['PEE'] || 0));
      btcData.push(Math.round(pd['Crypto'] || 0));
    }
  } else if (boussole.frise_projections?.annees) {
    // Fallback: use JSON frise data (modéré reference)
    boussole.frise_projections.annees.forEach(f => {
      if (f.annee < startYear || f.annee > endYear) return;
      labels.push(f.annee);
      peaData.push(f.PEA || 0);
      avData.push(f.AV || 0);
      ctoData.push(f.CTO || 0);
      peeData.push(f.PEE || 0);
      btcData.push(f.BTC || 0);
    });
  }

  if (labels.length === 0) return;

  // Profile label
  const profileLabel = document.getElementById('hyp-proj-profile-label');
  if (profileLabel) {
    const p = profiles[activeProfileKey];
    profileLabel.textContent = `${p?.icon || ''} ${p?.label || activeProfileKey}${hasStoreData ? '' : ' (réf. boussole)'}`;
  }

  // Jalons annotations
  const jalons = boussole.frise_projections?.jalons_cles || [];
  const annotations = {};
  jalons.forEach((j, i) => {
    if (j.annee < startYear || j.annee > endYear) return;
    annotations[`j${i}`] = {
      type: 'line',
      xMin: String(j.annee),
      xMax: String(j.annee),
      borderColor: j.color + '88',
      borderWidth: 2,
      borderDash: [6, 3],
      label: {
        display: true,
        content: j.label,
        position: i % 2 === 0 ? 'start' : 'end',
        backgroundColor: 'rgba(26,26,34,0.95)',
        color: j.color,
        font: { size: 10, family: 'Inter', weight: '600' },
        padding: { top: 3, bottom: 3, left: 6, right: 6 },
        borderRadius: 6
      }
    };
  });

  destroyChart('hyp-proj-chart');
  createChart('hyp-proj-chart', {
    type: 'line',
    data: {
      labels: labels.map(String),
      datasets: [
        { label: 'PEA', data: peaData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill: true, tension: 0.3, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'Assurance Vie', data: avData, borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.08)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'CTO', data: ctoData, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'PEE', data: peeData, borderColor: '#14b8a6', backgroundColor: 'rgba(20,184,166,0.08)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'Bitcoin', data: btcData, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5 },
      ]
    },
    options: {
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: { grid: { color: 'rgba(72,72,82,0.2)' }, ticks: { color: '#7a7a88', font: { size: 10, family: 'Inter' }, maxRotation: 0 } },
        y: { grid: { color: 'rgba(72,72,82,0.2)' }, ticks: { color: '#7a7a88', font: { size: 10, family: 'Inter' }, callback: v => v >= 1000 ? `${Math.round(v / 1000)}K` : v }, beginAtZero: true }
      },
      plugins: {
        annotation: { annotations },
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, color: '#e5e7eb', font: { size: 11, family: 'Inter' } } }
      }
    },
    plugins: [legendStrikethroughPlugin]
  });
}

// ─── Comparison table from boussole-data.json ───────────────────────────────

function fillComparisonTable(boussole, activeProfile) {
  const container = document.getElementById('hyp-comparison-body');
  if (!container || !boussole?.hypotheses) return;

  const hyp = boussole.hypotheses;
  const keys = ['faible', 'modere', 'eleve'];
  const colorMap = { faible: 'cyan', modere: 'amber', eleve: 'emerald' };

  const rows = [
    { label: 'PEA total', key: 'PEA_total', icon: '📊' },
    { label: 'PEE net', key: 'PEE_net', icon: '🏢' },
    { label: 'Bitcoin', key: 'Bitcoin', icon: '₿' },
    { label: 'Capital rente (PEA+PEE+BTC)', key: 'capital_rente_net', icon: '💰', highlight: true },
    { label: 'Rente nette/mois (3,5%)', key: 'rente_mensuelle_nette', icon: '📈', suffix: '/mois', highlight: true },
    { label: 'AV à 61 ans', key: 'AV_61_ans', icon: '🛡️' },
    { label: 'AV à 70 ans', key: 'AV_70_ans', icon: '🛡️' },
    { label: 'Transmis par enfant', key: 'total_transmis_par_enfant', icon: '🎁', highlight: true },
  ];

  container.innerHTML = `
    <div class="overflow-x-auto -mx-1">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-dark-400/20">
            <th class="text-left py-2.5 px-2 text-gray-500 font-medium text-[10px] uppercase tracking-wider"></th>
            ${keys.map(k => {
              const p = hyp[k];
              const clr = colorMap[k];
              const isActive = k === activeProfile;
              return `<th class="text-right py-2.5 px-3 font-medium text-[10px] uppercase tracking-wider ${isActive ? `text-${clr}-400` : 'text-gray-500'}">
                ${p.label}${isActive ? ' ✓' : ''}
              </th>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr class="border-b border-dark-400/10 ${row.highlight ? 'bg-dark-700/20' : ''} hover:bg-dark-700/30 transition">
              <td class="py-2.5 px-2 text-gray-400 font-medium whitespace-nowrap">
                <span class="mr-1.5">${row.icon}</span>${row.label}
              </td>
              ${keys.map(k => {
                const d = hyp[k].resultats_61_ans;
                const val = d?.[row.key] || 0;
                const clr = colorMap[k];
                const isActive = k === activeProfile;
                return `<td class="py-2.5 px-3 text-right tabular-nums ${isActive ? `text-${clr}-400 font-bold` : 'text-gray-300 font-medium'} ${row.highlight ? 'text-sm' : ''}">
                  ${formatCurrency(val)}${row.suffix || ''}
                </td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="mt-3 space-y-0.5">
      ${keys.map(k => `<p class="text-[9px] text-gray-600 italic">${hyp[k].label} : ${hyp[k].note}</p>`).join('')}
    </div>
    <p class="text-[9px] text-gray-500 mt-2 font-medium">Rente 3,5 % sur PEA + PEE + Bitcoin uniquement — AV et CTO exclus (réservés transmission). Montants nets de taxes.</p>`;
}

// ─── Transmission section from boussole-data.json ───────────────────────────

let _transmissionTab = null;

function fillTransmissionSection(boussole, store) {
  const container = document.getElementById('hyp-transmission-body');
  if (!container || !boussole?.scenarios) return;

  const scenarios = boussole.scenarios;
  const scenarioKeys = ['reel', 'ideal', 'liberte'];
  const activeKey = _transmissionTab || getActiveScenario(store) || 'reel';
  const colorMap = { reel: 'blue', ideal: 'emerald', liberte: 'amber' };

  const tabsHtml = scenarioKeys.map(k => {
    const sc = scenarios[k];
    const isActive = k === activeKey;
    const clr = colorMap[k];
    return `<button class="hyp-tr-tab px-4 py-2 rounded-lg text-xs font-semibold transition-all
      ${isActive ? `bg-${clr}-500/15 text-${clr}-400 border border-${clr}-500/30` : 'text-gray-500 hover:text-gray-300 border border-transparent hover:border-dark-400/30'}" data-sc="${k}">
      ${sc.label}
    </button>`;
  }).join('');

  const sc = scenarios[activeKey];
  const clr = colorMap[activeKey];
  let contentHtml = '';

  // Pension info badges
  contentHtml += `
    <div class="flex flex-wrap gap-2 mb-4">
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/40 border border-dark-400/10">
        <span class="text-[10px] text-gray-500">DCA</span>
        <span class="text-xs font-bold text-${clr}-400">${formatCurrency(sc.dca_mensuel)}/mois</span>
      </div>
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/40 border border-dark-400/10">
        <span class="text-[10px] text-gray-500">Pension État</span>
        <span class="text-xs font-bold text-${clr}-400">${sc.pension_age} ans</span>
        ${sc.pension_montant_net ? `<span class="text-[10px] text-gray-400">(${formatCurrency(sc.pension_montant_net)}/mois)</span>` : ''}
      </div>
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/40 border border-dark-400/10">
        <span class="text-[10px] text-gray-500">Gap FIRE→pension</span>
        <span class="text-xs font-bold text-${clr}-400">${sc.gap_fire_pension_ans} an${sc.gap_fire_pension_ans > 1 ? 's' : ''}</span>
      </div>
      ${sc.rachat_trimestres ? `
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <span class="text-[10px] text-gray-500">Rachat</span>
        <span class="text-xs font-bold text-amber-400">${sc.rachat_trimestres} trim. (${formatCurrency(sc.cout_rachat_net)})</span>
      </div>` : ''}
    </div>`;

  // Donations du vivant
  if (sc.donations_vivant?.length) {
    contentHtml += `
      <h4 class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Donations du vivant</h4>
      <div class="space-y-2 mb-4">
        ${sc.donations_vivant.map(d => `
          <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-dark-800/30 border border-dark-400/10">
            <div class="flex items-center gap-3">
              <span class="text-xs font-bold tabular-nums text-gray-300">${d.annee}</span>
              <span class="text-xs text-gray-400">${d.operation}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-purple-400 tabular-nums">${formatCurrency(d.total)}</span>
              <span class="text-[10px] text-gray-600">(${formatCurrency(d.par_enfant)}/enf.)</span>
              ${d.droits === 0 ? '<span class="text-[9px] text-emerald-400 font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10">0€ droits</span>' : ''}
            </div>
          </div>`).join('')}
      </div>`;
  }

  // Transmission au décès
  if (sc.transmission_deces?.length) {
    contentHtml += `
      <h4 class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Au décès</h4>
      <div class="space-y-2 mb-4">
        ${sc.transmission_deces.map(t => {
          const isNeg = t.total < 0;
          return `
          <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-dark-800/30 border border-dark-400/10">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xs text-gray-400 truncate">${t.enveloppe}</span>
              ${t.note ? `<span class="text-[9px] text-gray-600 hidden sm:inline">${t.note}</span>` : ''}
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs font-bold ${isNeg ? 'text-red-400' : 'text-gray-300'} tabular-nums">${isNeg ? '' : '+'}${formatCurrency(t.total)}</span>
              <span class="text-[10px] text-gray-600">(${formatCurrency(t.par_enfant)}/enf.)</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  // Total par enfant
  if (sc.total_par_enfant_modere) {
    contentHtml += `
      <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-dark-700 via-dark-600 to-dark-700 border border-dark-400/20">
        <span class="text-sm font-bold text-gray-200">Total transmis par enfant <span class="text-[10px] text-gray-500 font-normal">(hyp. modérée)</span></span>
        <span class="text-lg font-black text-emerald-400 tabular-nums">${formatCurrency(sc.total_par_enfant_modere)}</span>
      </div>`;
  }

  if (sc.note) {
    contentHtml += `<p class="text-[10px] text-gray-500 mt-3 italic">${sc.note}</p>`;
  }

  container.innerHTML = `
    <div class="flex gap-2 mb-4">${tabsHtml}</div>
    <div>${contentHtml}</div>`;

  // Mount tab clicks
  container.querySelectorAll('.hyp-tr-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _transmissionTab = btn.dataset.sc;
      fillTransmissionSection(boussole, store);
    });
  });
}

// ─── Budget section from boussole-data.json ─────────────────────────────────

function fillBudgetSection(boussole) {
  const container = document.getElementById('hyp-budget-body');
  if (!container || !boussole?.budget) return;

  const b = boussole.budget;
  const b2026 = b['2026'];
  const b2027 = b['2027'];

  const budgetLabels = {
    depenses_fixes_dont_credit_652: 'Dépenses fixes (dont crédit 652€)',
    depenses_fixes_sans_credit: 'Dépenses fixes (hors crédit)',
    abonnements: 'Abonnements',
    vie_quotidienne_vacances: 'Vie quotidienne & vacances',
    investissements_CIC: 'Investissements CIC',
    PEA_TR: 'PEA Trade Republic',
    AV_Linxea: 'AV Linxea Spirit 2',
    CTO_BoursoBank: 'CTO BoursoBank',
    Bitcoin: 'Bitcoin',
    PEE_enfants: 'PEE Amundi',
    PEE_enfants_TR: 'PEE Amundi',
    Livret_A_enfants: 'Livret A enfants'
  };

  function renderBudgetCard(data, year, color) {
    return `
      <div class="rounded-xl border border-${color}-500/20 p-4 bg-${color}-500/5">
        <div class="flex items-center justify-between mb-3">
          <span class="text-sm font-bold text-${color}-400">${year}</span>
          <span class="text-xs px-2.5 py-1 rounded-full font-bold tabular-nums
            ${data.solde_mensuel >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}">
            ${data.solde_mensuel >= 0 ? '+' : ''}${data.solde_mensuel}€/mois
          </span>
        </div>
        <div class="space-y-1.5">
          ${Object.entries(data.detail).map(([k, v]) => `
            <div class="flex justify-between text-xs">
              <span class="text-gray-400">${budgetLabels[k] || k.replace(/_/g, ' ')}</span>
              <span class="text-gray-300 tabular-nums font-medium">${formatCurrency(v)}</span>
            </div>`).join('')}
        </div>
        <div class="h-px bg-dark-400/20 my-2.5"></div>
        <div class="flex justify-between text-xs font-bold">
          <span class="text-gray-300">Sorties totales</span>
          <span class="text-${color}-400 tabular-nums">${formatCurrency(data.sorties_totales)}</span>
        </div>
        <p class="text-[9px] text-gray-600 mt-2.5 italic">${data.note}</p>
      </div>`;
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${renderBudgetCard(b2026, '2026', 'blue')}
      ${renderBudgetCard(b2027, '2027', 'emerald')}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      <div class="px-3 py-2.5 rounded-lg bg-dark-800/30 border border-dark-400/10 flex items-center justify-between">
        <span class="text-[10px] text-gray-500">Salaire net mensuel</span>
        <span class="text-xs font-bold text-gray-300 tabular-nums">${formatCurrency(b.salaire_mensuel_reel)}</span>
      </div>
      <div class="px-3 py-2.5 rounded-lg bg-dark-800/30 border border-dark-400/10">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-gray-500">Bonus annuel (13e + prime)</span>
          <span class="text-xs font-bold text-gray-300 tabular-nums">${formatCurrency(b.bonus_annuel.total)}</span>
        </div>
        <div class="text-[9px] text-gray-600 mt-1">→ CTO ${formatCurrency(b.bonus_annuel.affectation_recommandee.CTO_BoursoBank)} · Livret A ${formatCurrency(b.bonus_annuel.affectation_recommandee.Livret_A_frais_notaire)}</div>
      </div>
    </div>`;
}

// ─── Scenario form HTML ──────────────────────────────────────────────────────

function getScenarioFormHtml(scenario = null) {
  const isEdit = !!scenario;
  const scColors = ['blue', 'emerald', 'amber', 'purple', 'cyan', 'rose'];
  return `
    <div class="space-y-4">
      <div>
        <label class="block text-xs text-gray-500 mb-1.5">Nom du scénario *</label>
        <input id="sc-form-nom" type="text" value="${scenario?.nom || ''}" placeholder="Ex: Réel, Idéal, Liberté financière..."
          class="w-full input-field placeholder-gray-600"/>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1.5">Description</label>
        <textarea id="sc-form-desc" rows="3" placeholder="Décris ce scénario : objectif, hypothèses clés..."
          class="w-full input-field resize-none placeholder-gray-600">${scenario?.description || ''}</textarea>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1.5">Couleur</label>
        <div id="sc-form-colors" class="flex flex-wrap gap-2">
          ${scColors.map(clr => `
            <button type="button" class="sc-color-btn w-8 h-8 rounded-lg border-2 transition-all duration-150
              ${(scenario?.color || 'blue') === clr ? `border-${clr}-400 bg-${clr}-500/20 ring-2 ring-${clr}-400/30` : `border-dark-400/30 bg-${clr}-500/10 hover:border-${clr}-400/50`}" data-color="${clr}">
              <span class="block w-3 h-3 mx-auto rounded-full bg-${clr}-400"></span>
            </button>`).join('')}
        </div>
        <input type="hidden" id="sc-form-color" value="${scenario?.color || 'blue'}"/>
      </div>
      <div class="h-px bg-dark-400/20"></div>
      <p class="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">Ajustements (optionnel — laisse vide pour utiliser tes données actuelles)</p>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-500 mb-1.5">Rendement placements (%)</label>
          <input id="sc-form-rend" type="number" step="0.5" min="0" max="30" value="${scenario?.rendementPlacements !== undefined ? (scenario.rendementPlacements * 100).toFixed(1) : ''}" placeholder="Profil actif"
            class="w-full input-field placeholder-gray-600"/>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1.5">Rendement immobilier (%)</label>
          <input id="sc-form-rend-immo" type="number" step="0.5" min="0" max="20" value="${scenario?.rendementImmobilier !== undefined ? (scenario.rendementImmobilier * 100).toFixed(1) : ''}" placeholder="Profil actif"
            class="w-full input-field placeholder-gray-600"/>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-500 mb-1.5">Multiplicateur DCA</label>
          <input id="sc-form-dca-mult" type="number" step="0.1" min="0" max="10" value="${scenario?.dcaMultiplier ?? ''}" placeholder="1.0 = inchangé"
            class="w-full input-field placeholder-gray-600"/>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1.5">Inflation (%)</label>
          <input id="sc-form-inflation" type="number" step="0.1" min="0" max="10" value="${scenario?.extraInflation !== undefined ? (scenario.extraInflation * 100).toFixed(1) : ''}" placeholder="Profil actif"
            class="w-full input-field placeholder-gray-600"/>
        </div>
      </div>
    </div>`;
}

// ─── Profile edit form HTML ──────────────────────────────────────────────────

function getProfileEditHtml(profiles) {
  const keys = Object.keys(profiles);
  const groupOrder = ['PEA ETF', 'PEA Actions', 'Crypto', 'PEE', 'Assurance Vie', 'CTO'];
  return `
    <div class="space-y-4">
      ${keys.map(key => {
        const p = profiles[key];
        const rg = p.rendementGroupes || {};
        return `
        <div class="rounded-xl border border-dark-400/15 bg-dark-800/30 p-4">
          <h3 class="text-sm font-bold text-gray-200 mb-3">${p.icon || ''} ${p.label}</h3>
          <p class="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mb-2">Rendement par enveloppe</p>
          <div class="grid grid-cols-3 gap-2">
            ${groupOrder.map(gk => `
            <div>
              <label class="block text-[9px] text-gray-500 mb-0.5">${gk}</label>
              <input type="number" step="0.5" min="0" max="50" value="${((rg[gk] || 0) * 100).toFixed(1)}"
                class="w-full input-field text-xs" data-profil="${key}" data-group="${gk}"/>
            </div>`).join('')}
          </div>
          <div class="grid grid-cols-3 gap-2 mt-2">
            <div>
              <label class="block text-[9px] text-gray-500 mb-0.5">Immobilier</label>
              <input type="number" step="0.5" min="0" max="20" value="${((p.rendementImmobilier || 0) * 100).toFixed(1)}"
                class="w-full input-field text-xs" data-profil="${key}" data-field="rendementImmobilier"/>
            </div>
            <div>
              <label class="block text-[9px] text-gray-500 mb-0.5">Épargne</label>
              <input type="number" step="0.1" min="0" max="10" value="${((p.rendementEpargne || 0) * 100).toFixed(1)}"
                class="w-full input-field text-xs" data-profil="${key}" data-field="rendementEpargne"/>
            </div>
            <div>
              <label class="block text-[9px] text-gray-500 mb-0.5">Inflation</label>
              <input type="number" step="0.1" min="0" max="10" value="${((p.inflation || 0) * 100).toFixed(1)}"
                class="w-full input-field text-xs" data-profil="${key}" data-field="inflation"/>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// ─── Timeline rendering ─────────────────────────────────────────────────────

function renderTimeline(hypotheses, themes) {
  if (hypotheses.length === 0) {
    return `
      <div class="px-6 py-10 text-center">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-3">
          <svg class="w-7 h-7 text-purple-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <p class="text-gray-400 text-sm font-medium">Aucune hypothèse pour le moment</p>
        <p class="text-gray-600 text-xs mt-1">Ajoute ta première hypothèse pour construire ta timeline</p>
      </div>`;
  }

  const sorted = [...hypotheses].sort((a, b) => (a.annee || 0) - (b.annee || 0));
  const themeMap = {};
  themes.forEach(t => { themeMap[t.id] = t; });

  // Fixed timeline range: 2026 — 2066
  const TIMELINE_START = 2026;
  const TIMELINE_END = 2066;
  const TIMELINE_SPAN = TIMELINE_END - TIMELINE_START;

  // Group by year for stacking
  const yearGroups = {};
  sorted.forEach(h => {
    if (!yearGroups[h.annee]) yearGroups[h.annee] = [];
    yearGroups[h.annee].push(h);
  });

  const years = Object.keys(yearGroups).map(Number).sort((a, b) => a - b);

  // Theme icons for timeline events
  const themeIcons = {
    investissement: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>',
    immobilier: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
    donation: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/>',
    succession: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
    retraite: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    fiscalite: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>',
    note: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>',
  };

  return `
    <div class="px-6 pt-6 pb-2">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          Timeline
        </h2>
        <span class="text-[11px] font-mono text-purple-400/60 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/15">${TIMELINE_START} — ${TIMELINE_END}</span>
      </div>

      <!-- Creative timeline with connecting path -->
      <div class="overflow-visible pb-2">
        <div class="relative" style="min-width: 600px; min-height: 120px; padding: 0 3%;">
          <!-- Animated gradient line -->
          <div class="absolute top-[70px] h-[3px] rounded-full overflow-hidden" style="left: 3%; right: 3%;">
            <div class="w-full h-full bg-gradient-to-r from-emerald-500/20 via-purple-500/40 to-amber-500/20"></div>
          </div>
          <!-- Glow effect on line -->
          <div class="absolute top-[68px] h-[7px] rounded-full bg-gradient-to-r from-emerald-500/5 via-purple-500/15 to-amber-500/5 blur-sm" style="left: 3%; right: 3%;"></div>

          <!-- Fixed year markers on the line -->
          ${[TIMELINE_START, TIMELINE_START + 10, TIMELINE_START + 20, TIMELINE_START + 30, TIMELINE_END].map(y => {
            const mPct = 3 + ((y - TIMELINE_START) / TIMELINE_SPAN) * 94;
            return `<div class="absolute" style="left: ${mPct}%; top: 78px; transform: translateX(-50%);">
              <div class="w-1 h-1 rounded-full bg-gray-600 mx-auto"></div>
              <span class="text-[9px] text-gray-600 mt-0.5 block text-center">${y}</span>
            </div>`;
          }).join('')}

          ${years.map((year, yi) => {
            const items = yearGroups[year];
            // Position based on absolute year within 2026-2066 range, mapped to 3%-97%
            const rawPct = Math.max(0, Math.min(1, (year - TIMELINE_START) / TIMELINE_SPAN));
            const pct = 3 + rawPct * 94;
            const leftPx = `${pct}%`;
            const isFirst = year === TIMELINE_START;
            const isLast = year === TIMELINE_END;

            return `
              <div class="absolute flex flex-col items-center" style="left: ${leftPx}; transform: translateX(-50%); top: 0; width: 120px;">
                <!-- Year label with badge -->
                <div class="flex flex-col items-center mb-2.5">
                  <span class="text-[11px] font-bold ${isFirst ? 'text-emerald-400' : isLast ? 'text-amber-400' : 'text-gray-300'} tabular-nums">${year}</span>
                </div>

                <!-- Dots stack with glow -->
                <div class="flex flex-col items-center gap-2 relative">
                  ${items.map((item, di) => {
                    const theme = themeMap[item.theme] || { color: 'emerald', id: 'investissement' };
                    const cc = c(theme.color);
                    const iconPath = themeIcons[theme.id] || themeIcons.investissement;
                    return `
                      <button class="hyp-tl-dot group relative flex items-center justify-center w-8 h-8 rounded-xl ${cc.bg} border-2 ${cc.border} transition-all duration-300 hover:scale-110 hover:shadow-xl ${cc.glow} cursor-pointer" data-scroll-to="${item.id}" title="${item.titre}">
                        <svg class="w-4 h-4 ${cc.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconPath}</svg>
                        <span class="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-2 bg-dark-800/95 border ${cc.border} rounded-xl text-[10px] text-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all pointer-events-none shadow-2xl z-30 backdrop-blur-sm">
                          <div class="absolute bottom-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-dark-800/95 border-l border-t ${cc.border}"></div>
                          <span class="font-semibold ${cc.text}">${item.titre}</span>
                          ${item.montant ? `<br/><span class="text-gray-400">${formatCurrency(item.montant)}</span>` : ''}
                        </span>
                      </button>`;
                  }).join('')}
                </div>

                <!-- Count & type label below -->
                <div class="mt-2 text-center">
                  ${items.length > 1 ? `<span class="text-[9px] text-gray-500 bg-dark-600/50 px-2 py-0.5 rounded-full">${items.length} hyp.</span>` : `<span class="text-[9px] text-gray-600">${(themeMap[items[0].theme] || { label: '' }).label}</span>`}
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Legend pills -->
      <div class="flex flex-wrap gap-2 mt-1">
        ${themes.filter(t => hypotheses.some(h => h.theme === t.id)).map(t => {
          const cc = c(t.color);
          return `<span class="flex items-center gap-1.5 text-[10px] text-gray-400 bg-dark-600/30 px-2.5 py-1 rounded-lg border border-dark-400/10">
            <span class="w-2 h-2 rounded-full ${cc.dot}"></span>
            ${t.label}
          </span>`;
        }).join('')}
      </div>
    </div>`;
}

// renderSlider is now integrated directly into the render function (no separate function needed)

// ─── Hypothesis card ─────────────────────────────────────────────────────────

function renderCard(item, themes, enfants = []) {
  const themeMap = {};
  themes.forEach(t => { themeMap[t.id] = t; });
  const theme = themeMap[item.theme] || { label: 'Autre', color: 'emerald', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };
  const cc = c(theme.color);
  // Build child badges for donation cards
  const isDonation = item.theme === 'donation';
  const isEvenement = item.theme === 'evenement';
  const enfantIds = item.enfantIds || [];
  let extraBadges = '';
  if (isDonation && enfants.length > 0) {
    if (enfantIds.length === 0 || enfantIds.length === enfants.length) {
      extraBadges = `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">Tous les enfants</span>`;
    } else {
      extraBadges = enfantIds.map(eid => {
        const enf = enfants.find(e => e.id === eid);
        return enf ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">${enf.prenom}</span>` : '';
      }).join('');
    }
    if (item.donationType) {
      const typeLabels = { abatt_immo: 'Nue-propriété', abatt_cash: 'Cash', abatt_cto: 'CTO', don_tepa: 'Sarkozy', av_donation: 'Assurance Vie' };
      extraBadges += `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">${typeLabels[item.donationType] || 'Abattement'}</span>`;
    }
  }
  if (isEvenement && item.eventType) {
    const eventLabels = { retraite: 'Retraite', projet: 'Projet', divers: 'Divers' };
    extraBadges += `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">${eventLabels[item.eventType] || 'Divers'}</span>`;
  }

  // Notary fees estimation
  const fraisNotaire = estimerFraisNotaire(item.montant, item.theme, item.donationType);

  return `
    <div id="hyp-${item.id}" class="group rounded-xl border ${cc.border} ${cc.bg} transition-all duration-200 hover:shadow-lg overflow-hidden">
      <div class="px-5 py-4 flex items-start gap-4">
        <!-- Theme icon -->
        <div class="flex-shrink-0 w-12 h-12 rounded-xl ${cc.bg} border ${cc.border} flex items-center justify-center">
          <svg class="w-6 h-6 ${cc.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${theme.icon}"/>
          </svg>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <!-- Row 1: Year + Amount — big hero numbers -->
          <div class="flex items-baseline gap-4 mb-2">
            <span class="text-2xl font-black text-white">${item.annee}</span>
            ${item.montant ? `<span class="text-2xl font-black ${cc.text}">${formatCurrency(item.montant)}</span>` : ''}
          </div>
          <!-- Row 2: Title + badges -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[11px] font-semibold ${cc.text} px-2.5 py-1 rounded-full ${cc.bg} border ${cc.border}">${theme.label}</span>
            <h3 class="text-sm font-bold text-gray-200">${item.titre}</h3>
            ${extraBadges}
          </div>
          ${item.description ? `<p class="text-xs text-gray-500 mt-2 leading-relaxed">${item.description}</p>` : ''}
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button class="hyp-edit p-1.5 rounded-lg hover:bg-dark-600 text-gray-500 hover:text-accent-green transition" data-id="${item.id}" title="Modifier">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="hyp-delete p-1.5 rounded-lg btn-delete transition" data-id="${item.id}" title="Supprimer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
      ${fraisNotaire ? `
      <div class="px-5 pb-4 -mt-1">
        <div class="flex items-center gap-3 px-4 py-3 rounded-lg row-item border border-amber-500/15">
          <svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
          </svg>
          <span class="text-xs text-gray-300">Frais de notaire estimés</span>
          <span class="text-sm font-bold ${fraisNotaire.total > 0 ? 'text-amber-400' : 'text-emerald-400'}">${fraisNotaire.total > 0 ? formatCurrency(fraisNotaire.total) : 'Aucun'}</span>
          <span class="text-[10px] text-gray-500 ml-auto hidden sm:block">${fraisNotaire.detail}</span>
        </div>
      </div>
      ` : ''}
    </div>`;
}

// ─── Modal form HTML ─────────────────────────────────────────────────────────

function getFormHtml(themes, item = null, enfants = []) {
  const isEdit = !!item;
  const isDonationTheme = item?.theme === 'donation';
  const isEvenementTheme = item?.theme === 'evenement';
  const currentEnfantIds = item?.enfantIds || [];
  return `
    <div class="space-y-4">
      <div>
        <label class="block text-xs text-gray-500 mb-1.5">Titre *</label>
        <input id="hyp-form-titre" type="text" value="${item?.titre || ''}" placeholder="Ex: Donation Sarkozy enfants"
          class="w-full input-field placeholder-gray-600"/>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1.5">Année *</label>
          <input id="hyp-form-annee" type="number" min="2000" max="2100" value="${item?.annee || new Date().getFullYear()}"
            class="w-full input-field"/>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1.5">Montant estimé</label>
          <div class="relative">
            <input id="hyp-form-montant" type="number" step="100" min="0" value="${item?.montant || ''}" placeholder="Optionnel"
              class="w-full input-field pr-7 placeholder-gray-600"/>
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">\u20ac</span>
          </div>
        </div>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1.5">Thème *</label>
        <div id="hyp-form-themes" class="flex flex-wrap gap-2">
          ${themes.map(t => {
            const cc = c(t.color);
            const selected = item?.theme === t.id;
            return `
              <button type="button" class="hyp-theme-btn px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150
                ${selected
                  ? `${cc.bg} ${cc.border} ${cc.text} ring-2 ${cc.ring}`
                  : `border-dark-400/30 text-gray-500 hover:${cc.text} hover:${cc.border}`
                }" data-theme-id="${t.id}">
                ${t.label}
              </button>`;
          }).join('')}
        </div>
        <input type="hidden" id="hyp-form-theme" value="${item?.theme || themes[0]?.id || ''}"/>
      </div>
      <!-- Donation type (shown only for donation theme) -->
      <div id="hyp-form-donation-type-row" class="${isDonationTheme ? '' : 'hidden'}">
        <label class="block text-xs text-gray-500 mb-1.5">Type de donation</label>
        <select id="hyp-form-donation-type"
          class="w-full input-field">
          <option value="abatt_immo" ${(item?.donationType || 'abatt_immo') === 'abatt_immo' ? 'selected' : ''}>Abattement Immobilier — nue-propriété (100 000 \u20ac cumulés)</option>
          <option value="abatt_cash" ${item?.donationType === 'abatt_cash' ? 'selected' : ''}>Abattement Cash (100 000 \u20ac cumulés)</option>
          <option value="abatt_cto" ${item?.donationType === 'abatt_cto' ? 'selected' : ''}>Abattement CTO (100 000 \u20ac cumulés)</option>
          <option value="don_tepa" ${item?.donationType === 'don_tepa' ? 'selected' : ''}>Donation Loi Sarkozy (31 865 \u20ac, renouvelable /15 ans, < 80 ans)</option>
          <option value="av_donation" ${item?.donationType === 'av_donation' ? 'selected' : ''}>Donation Assurance Vie (152 500 \u20ac au décès, primes < 70 ans)</option>
        </select>
      </div>
      <!-- Child assignment (shown only for donation theme) -->
      <div id="hyp-form-enfant-row" class="${isDonationTheme ? '' : 'hidden'}">
        ${enfants.length > 0 ? `
        <label class="block text-xs text-gray-500 mb-1.5">Bénéficiaire(s)</label>
        <div id="hyp-form-enfants" class="flex flex-wrap gap-2">
          <button type="button" class="hyp-enfant-btn px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150
            ${currentEnfantIds.length === 0 || currentEnfantIds.length === enfants.length
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 ring-2 ring-purple-400/30'
              : 'border-dark-400/30 text-gray-500 hover:text-purple-400 hover:border-purple-500/30'
            }" data-enfant-id="all">
            Tous mes enfants
          </button>
          ${enfants.map(enf => {
            const selected = currentEnfantIds.includes(enf.id) && currentEnfantIds.length < enfants.length;
            return `
            <button type="button" class="hyp-enfant-btn px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150
              ${selected
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 ring-2 ring-cyan-400/30'
                : 'border-dark-400/30 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30'
              }" data-enfant-id="${enf.id}">
              ${enf.prenom || 'Sans nom'}
            </button>`;
          }).join('')}
        </div>
        <input type="hidden" id="hyp-form-enfant-ids" value="${JSON.stringify(currentEnfantIds)}"/>
        ` : `
        <p class="text-xs text-gray-500 italic">Ajoutez des enfants dans la page Famille pour affecter les donations</p>
        `}
      </div>
      <!-- Event type (shown only for evenement theme) -->
      <div id="hyp-form-event-type-row" class="${isEvenementTheme ? '' : 'hidden'}">
        <label class="block text-xs text-gray-500 mb-1.5">Type d'événement</label>
        <select id="hyp-form-event-type"
          class="w-full input-field">
          <option value="retraite" ${(item?.eventType || 'retraite') === 'retraite' ? 'selected' : ''}>Retraite</option>
          <option value="projet" ${item?.eventType === 'projet' ? 'selected' : ''}>Projet</option>
          <option value="divers" ${item?.eventType === 'divers' ? 'selected' : ''}>Divers</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1.5">Description</label>
        <textarea id="hyp-form-desc" rows="3" placeholder="Notes, détails, conditions..."
          class="w-full input-field resize-none placeholder-gray-600">${item?.description || ''}</textarea>
      </div>
    </div>`;
}

// ─── Theme manager modal ─────────────────────────────────────────────────────

function getThemeManagerHtml(themes) {
  return `
    <div class="space-y-3" id="theme-manager-list">
      ${themes.map((t, i) => {
        const cc = c(t.color);
        return `
          <div class="flex items-center gap-3 row-item rounded-lg px-3 py-2.5 group" data-theme-idx="${i}">
            <span class="w-4 h-4 rounded-full ${cc.dot} flex-shrink-0"></span>
            <input type="text" value="${t.label}" data-field="label"
              class="tm-label flex-1 bg-transparent border-b border-transparent hover:border-dark-400/50 focus:border-accent-green text-sm text-gray-200 focus:outline-none transition px-0 py-0" data-idx="${i}"/>
            <select data-field="color" data-idx="${i}"
              class="tm-color input-field rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-accent-green transition">
              ${ALL_COLORS.map(clr => `<option value="${clr}" ${t.color === clr ? 'selected' : ''}>${clr}</option>`).join('')}
            </select>
            <button class="tm-delete opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 transition p-1" data-idx="${i}" title="Supprimer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>`;
      }).join('')}
      <button id="tm-add" class="btn-add w-full flex items-center justify-center gap-2 py-2 text-xs">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
        Ajouter un thème
      </button>
    </div>`;
}

// ─── Per-child gauge rendering ──────────────────────────────────────────────

function computeChildGaugesAtYear(enfant, hypotheses, enfants, calendarYear, ageDonateur, currentYear, avParEnfant) {
  // Filter donation-type hypotheses assigned to this child, up to calendarYear
  const donHyps = hypotheses.filter(h => {
    if (h.theme !== 'donation') return false;
    if (h.annee > calendarYear) return false;
    const ids = h.enfantIds || [];
    // If no enfantIds specified, or all enfants, it applies to this child
    if (ids.length === 0 || ids.length === enfants.length || ids.includes(enfant.id)) return true;
    return false;
  });

  let abattementUtilise = 0;
  let tepaUtilise = 0;
  let avUtilise = 0;

  // Sort by year
  const sortedDons = [...donHyps].sort((a, b) => (a.annee || 0) - (b.annee || 0));
  const firstDonYear = sortedDons.length > 0 ? sortedDons[0].annee : null;

  // Track the start of each 15-year cycle
  let cycleStart = firstDonYear;

  for (const h of sortedDons) {
    // Check 15-year renewal: reset when a new cycle begins
    if (cycleStart && (h.annee - cycleStart) >= RENOUVELLEMENT_ANNEES) {
      abattementUtilise = 0;
      tepaUtilise = 0;
      // Advance cycle start to this donation's year
      cycleStart = h.annee;
    }

    // Per-child share: if hypothesis applies to multiple children, split the amount
    const ids = h.enfantIds || [];
    const nbBeneficiaires = (ids.length === 0 || ids.length === enfants.length) ? enfants.length : ids.length;
    const montantPerChild = (h.montant || 0) / nbBeneficiaires;
    const donType = h.donationType || 'abatt_immo';
    const ageDon = ageDonateur + (h.annee - currentYear);

    if (donType === 'don_tepa') {
      if (ageDon < AGE_MAX_DONATEUR_TEPA) {
        const tepaDisp = DON_FAMILIAL_TEPA - tepaUtilise;
        const tepaUse = Math.min(montantPerChild, tepaDisp);
        tepaUtilise += tepaUse;
        const rest = montantPerChild - tepaUse;
        if (rest > 0) {
          const abattDisp = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
          abattementUtilise += Math.min(rest, abattDisp);
        }
      }
    } else if (donType === 'av_donation') {
      if (ageDon < AGE_MAX_DONATEUR_AV) {
        avUtilise += montantPerChild;
      }
    } else {
      // Classic donation
      const abattDisp = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
      abattementUtilise += Math.min(montantPerChild, abattDisp);
    }
  }

  // After processing all donations, check if the current calendar year
  // is 15+ years past the last cycle start — if so, abattements have renewed
  if (cycleStart && (calendarYear - cycleStart) >= RENOUVELLEMENT_ANNEES) {
    abattementUtilise = 0;
    tepaUtilise = 0;
  }

  const abattRestant = Math.max(0, ABATTEMENT_PARENT_ENFANT - abattementUtilise);
  const tepaRestant = Math.max(0, DON_FAMILIAL_TEPA - tepaUtilise);
  const avRestant = Math.max(0, AV_ABATTEMENT_PAR_BENEFICIAIRE - avUtilise);
  const ageCurrent = ageDonateur + (calendarYear - currentYear);

  return {
    abattementUtilise, abattRestant,
    abattPct: Math.round((abattementUtilise / ABATTEMENT_PARENT_ENFANT) * 100),
    tepaUtilise, tepaRestant,
    tepaPct: Math.round((tepaUtilise / DON_FAMILIAL_TEPA) * 100),
    avUtilise, avRestant,
    avPct: Math.round((avUtilise / AV_ABATTEMENT_PAR_BENEFICIAIRE) * 100),
    donataireAge: ageCurrent,
    isTepaAvailable: ageCurrent < AGE_MAX_DONATEUR_TEPA,
    isAVAvailable: ageCurrent < AGE_MAX_DONATEUR_AV
  };
}

// ─── Donation tax brackets (Art. 777 CGI) ───────────────────────────────────
const TRANCHES_DONATION = [
  { min: 0,       max: 8072,    taux: 0.05 },
  { min: 8072,    max: 12109,   taux: 0.10 },
  { min: 12109,   max: 15932,   taux: 0.15 },
  { min: 15932,   max: 552324,  taux: 0.20 },
  { min: 552324,  max: 902838,  taux: 0.30 },
  { min: 902838,  max: 1805677, taux: 0.40 },
  { min: 1805677, max: Infinity, taux: 0.45 }
];

const AV_TAUX_1 = 0.20;
const AV_SEUIL_1 = 700000;
const AV_TAUX_2 = 0.3125;

function calculerDroitsDonation(montantTaxable) {
  if (montantTaxable <= 0) return 0;
  let droits = 0;
  for (const t of TRANCHES_DONATION) {
    if (montantTaxable <= t.min) break;
    droits += (Math.min(montantTaxable, t.max) - t.min) * t.taux;
  }
  return Math.round(droits);
}

function calculerDroitsAV(avTaxable) {
  if (avTaxable <= 0) return 0;
  const tranche1 = Math.min(avTaxable, AV_SEUIL_1);
  const tranche2 = Math.max(0, avTaxable - AV_SEUIL_1);
  return Math.round(tranche1 * AV_TAUX_1 + tranche2 * AV_TAUX_2);
}

function renderChildGauges(enfant, gauges, color) {
  const age = childAge(enfant.dateNaissance);
  // Compute taxes for each category
  const abattTaxable = Math.max(0, gauges.abattementUtilise - ABATTEMENT_PARENT_ENFANT);
  const abattDroits = calculerDroitsDonation(abattTaxable);
  const tepaTaxable = Math.max(0, gauges.tepaUtilise - DON_FAMILIAL_TEPA);
  const tepaDroits = calculerDroitsDonation(tepaTaxable);
  const avTaxable = Math.max(0, gauges.avUtilise - AV_ABATTEMENT_PAR_BENEFICIAIRE);
  const avDroits = calculerDroitsAV(avTaxable);
  const totalDonations = gauges.abattementUtilise + gauges.tepaUtilise + gauges.avUtilise;
  const totalDroits = abattDroits + tepaDroits + avDroits;

  return `
    <div class="bg-dark-800/30 rounded-2xl p-5 border border-dark-400/10 backdrop-blur-sm">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-${color}/20 to-${color}/10 border border-${color}/20 flex items-center justify-center text-sm font-bold text-${color} shadow-lg shadow-${color}/5">
          ${(enfant.prenom || '?')[0].toUpperCase()}
        </div>
        <div class="flex-1">
          <h4 class="text-sm font-bold text-gray-100">${enfant.prenom || 'Sans nom'}</h4>
          <p class="text-[10px] text-gray-500">${age !== null ? `${age} ans` : ''}</p>
        </div>
        ${totalDonations > 0 ? `
        <div class="text-right">
          <p class="text-[10px] text-gray-500">Droits estimés</p>
          <p class="text-xs font-bold ${totalDroits > 0 ? 'text-red-400' : 'text-emerald-400'}">${totalDroits > 0 ? formatCurrency(totalDroits) : 'Exonéré'}</p>
        </div>` : ''}
      </div>
      <div class="space-y-4">
        <!-- Abattement Immo / Cash / CTO (cumulés) -->
        <div>
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="text-gray-300 flex items-center gap-1.5 font-medium">
              <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              Abattement Immo / Cash / CTO
            </span>
            <span class="text-gray-400 font-mono text-[11px]">${formatCurrency(gauges.abattementUtilise)} / ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}</span>
          </div>
          <div class="h-2.5 bg-dark-600/80 rounded-full overflow-hidden shadow-inner">
            <div class="h-full rounded-full transition-all duration-500 ${gauges.abattPct >= 100 ? 'bg-gradient-to-r from-red-500 to-red-400' : gauges.abattPct >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-emerald-500 to-emerald-400'}" style="width: ${Math.min(100, gauges.abattPct)}%"></div>
          </div>
          <div class="flex items-center justify-between mt-1">
            <p class="text-[10px] font-medium ${gauges.abattRestant > 0 ? 'text-emerald-400' : 'text-red-400'}">${formatCurrency(gauges.abattRestant)} restant</p>
            <p class="text-[9px] text-gray-600">Renouvelable tous les 15 ans</p>
          </div>
          ${abattDroits > 0 ? `<p class="text-[9px] text-red-400/70 mt-0.5">Droits sur excédent : ${formatCurrency(abattDroits)}</p>` : ''}
        </div>

        <!-- Donation Loi Sarkozy -->
        <div>
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="text-gray-300 flex items-center gap-1.5 font-medium">
              <svg class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Donation Loi Sarkozy
            </span>
            <span class="text-gray-400 font-mono text-[11px]">${formatCurrency(gauges.tepaUtilise)} / ${formatCurrency(DON_FAMILIAL_TEPA)}</span>
          </div>
          <div class="h-2.5 bg-dark-600/80 rounded-full overflow-hidden shadow-inner">
            <div class="h-full rounded-full transition-all duration-500 ${gauges.tepaPct >= 100 ? 'bg-gradient-to-r from-red-500 to-red-400' : gauges.tepaPct >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-cyan-500 to-cyan-400'}" style="width: ${Math.min(100, gauges.tepaPct)}%"></div>
          </div>
          <div class="flex items-center justify-between mt-1">
            <p class="text-[10px] font-medium ${gauges.isTepaAvailable ? 'text-cyan-400' : 'text-gray-500'}">${formatCurrency(gauges.tepaRestant)} disponible ${gauges.isTepaAvailable ? '' : '<span class="text-red-400/70">(donateur > 80 ans)</span>'}</p>
            <p class="text-[9px] text-gray-600">Renouvelable tous les 15 ans</p>
          </div>
          ${tepaDroits > 0 ? `<p class="text-[9px] text-red-400/70 mt-0.5">Droits sur excédent : ${formatCurrency(tepaDroits)}</p>` : ''}
        </div>

        <!-- Donation Assurance Vie -->
        <div>
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="text-gray-300 flex items-center gap-1.5 font-medium">
              <svg class="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              Donation Assurance Vie <span class="text-[9px] text-gray-500 font-normal ml-1">(au décès)</span>
            </span>
            <span class="text-gray-400 font-mono text-[11px]">${formatCurrency(gauges.avUtilise)} / ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}</span>
          </div>
          <div class="h-2.5 bg-dark-600/80 rounded-full overflow-hidden shadow-inner">
            <div class="h-full rounded-full transition-all duration-500 ${gauges.avPct >= 100 ? 'bg-gradient-to-r from-red-500 to-red-400' : gauges.avPct >= 50 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-purple-500 to-purple-400'}" style="width: ${Math.min(100, gauges.avPct)}%"></div>
          </div>
          <div class="flex items-center justify-between mt-1">
            <p class="text-[10px] font-medium ${gauges.isAVAvailable ? 'text-purple-400' : 'text-gray-500'}">${formatCurrency(gauges.avRestant)} disponible</p>
            <p class="text-[9px] text-gray-600">Primes versées avant 70 ans</p>
          </div>
          ${avDroits > 0 ? `<p class="text-[9px] text-red-400/70 mt-0.5">Droits sur excédent : ${formatCurrency(avDroits)} (prélèvement spécifique AV)</p>` : ''}
        </div>
      </div>
    </div>`;
}

// ─── Main render ─────────────────────────────────────────────────────────────

export function render(store) {
  const hypotheses = getHypotheses(store);
  const themes = getThemes(store);
  const sorted = [...hypotheses].sort((a, b) => (a.annee || 0) - (b.annee || 0));
  const cfg = getDonationConfig(store);
  const enfants = cfg.enfants || [];
  const params = store.get('parametres') || {};
  const ageDonateur = params.ageFinAnnee || 43;
  const currentYear = new Date().getFullYear();
  const projectionYears = params.projectionYears || 30;

  // Group by theme for display
  const themeMap = {};
  themes.forEach(t => { themeMap[t.id] = t; });

  // Compute initial gauges for each child (at current year)
  const childColors = ['accent-purple', 'accent-cyan', 'accent-green', 'accent-amber', 'accent-blue', 'accent-red'];

  // Compute projection snapshots for the patrimoine indicator
  let snapshots = [];
  try { snapshots = computeProjection(store, profileToOverrides(getProfiles(store), getActiveProfile(store))); } catch(e) { console.error('Projection error in hypotheses:', e); }

  const getAV = (snap) => {
    if (!snap.placementDetail) return 0;
    return snap.placementDetail['Assurance Vie'] || 0;
  };
  const getPlacementsHorsAV = (snap) => {
    if (!snap.placementDetail) return 0;
    let total = 0;
    for (const [k, v] of Object.entries(snap.placementDetail)) {
      if (k !== 'Assurance Vie') total += v;
    }
    return total;
  };

  const nbEnfants = enfants.length || 1;

  // Build snapshot data for patrimoine indicator
  const snapshotsData = snapshots.map((snap, i) => ({
    year: snap.calendarYear,
    age: snap.age,
    immobilier: snap.immobilier || 0,
    placementsHorsAV: getPlacementsHorsAV(snap),
    assuranceVie: getAV(snap),
    epargne: snap.epargne || 0,
    patrimoineNet: snap.patrimoineNet || 0
  }));

  const firstSnap = snapshotsData[0] || { immobilier: 0, placementsHorsAV: 0, assuranceVie: 0, epargne: 0, patrimoineNet: 0 };

  return `
    <div class="max-w-5xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-amber-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-100">Hypothèses</h1>
            <p class="text-xs text-gray-500">Plan théorique · ${hypotheses.length} hypothèse${hypotheses.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button id="btn-add-hyp" class="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-accent-green to-accent-blue text-white hover:opacity-90 transition flex items-center gap-1.5 shadow-lg shadow-accent-green/10">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
            Ajouter
          </button>
        </div>
      </div>

      <!-- ═══ SCENARIOS + RENDEMENT ═══ -->
      ${renderScenarioSection(store)}

      <!-- ═══ PROJECTION CHART ═══ -->
      <div class="card-dark rounded-2xl border border-dark-400/15 p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-emerald-500/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>
            </div>
            Projection 2026 → 2047
          </h2>
          <span id="hyp-proj-profile-label" class="text-[10px] text-gray-500 bg-dark-800/50 px-2.5 py-1 rounded-lg border border-dark-400/15"></span>
        </div>
        <div class="relative" style="height:380px">
          <canvas id="hyp-proj-chart"></canvas>
        </div>
      </div>

      <!-- ═══ COMPARISON TABLE ═══ -->
      <div class="card-dark rounded-2xl border border-dark-400/15 p-5">
        <div class="flex items-center gap-2.5 mb-4">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-amber-500/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </div>
          <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider">Comparatif à 61 ans — 3 hypothèses</h2>
        </div>
        <div id="hyp-comparison-body" class="text-center text-gray-600 text-xs py-6">Chargement…</div>
      </div>

      <!-- ═══ TRANSMISSION ═══ -->
      <div class="card-dark rounded-2xl border border-dark-400/15 p-5">
        <div class="flex items-center gap-2.5 mb-4">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>
          </div>
          <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider">Transmission par scénario</h2>
        </div>
        <div id="hyp-transmission-body" class="text-center text-gray-600 text-xs py-6">Chargement…</div>
      </div>

      <!-- ═══ BUDGET ═══ -->
      <div class="card-dark rounded-2xl border border-dark-400/15 p-5">
        <div class="flex items-center gap-2.5 mb-4">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          </div>
          <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider">Budget 2026 vs 2027</h2>
        </div>
        <div id="hyp-budget-body" class="text-center text-gray-600 text-xs py-6">Chargement…</div>
      </div>

      <!-- ═══ UNIFIED MEGA BLOCK: Timeline + Patrimoine + Abattements ═══ -->
      <div class="card-dark rounded-3xl border border-purple-500/15 overflow-hidden shadow-2xl shadow-purple-500/5" style="background: linear-gradient(180deg, rgba(88,28,135,0.06) 0%, rgba(15,23,42,0) 40%);">

        <!-- ── Timeline Section ── -->
        ${renderTimeline(sorted, themes)}

        <!-- ── Slider (directly under timeline, same block) ── -->
        ${enfants.length > 0 || snapshots.length > 0 ? `
        <div class="px-6 pt-3 pb-2">
          <div class="h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent mb-4"></div>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Suivi des abattements par enfant
            </h2>
            <span id="hyp-gauges-year-label" class="text-xs font-medium text-purple-400/80 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">Aujourd'hui (${currentYear})</span>
          </div>
          <div class="relative mt-3 mb-1" style="padding: 0 3%;">
            <input type="range" id="hyp-gauges-slider" min="0" max="40" value="0" step="1"
              class="w-full h-2.5 bg-dark-600/80 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-purple-400 [&::-webkit-slider-thumb]:to-purple-600
              [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/40 [&::-webkit-slider-thumb]:cursor-grab
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-purple-300/50
              [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-purple-300/50 [&::-moz-range-thumb]:cursor-grab">
          </div>
          <div class="flex justify-between mt-0.5 text-[10px] text-gray-600 font-medium" style="padding: 0 3%;">
            <span>2026</span>
            <span>2036</span>
            <span>2046</span>
            <span>2056</span>
            <span>2066</span>
          </div>
        </div>
        ` : ''}

        <!-- ── Patrimoine Indicator Cards (updated by slider) ── -->
        ${snapshots.length > 0 ? `
        <div class="px-6 py-4">
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2" id="hyp-patrimoine-cards">
            <div class="rounded-xl border border-amber-500/20 p-3 text-center bg-amber-500/5 hover:bg-amber-500/10 transition">
              <p class="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Immobilier</p>
              <p class="text-base font-bold text-amber-400 mt-1 tabular-nums" id="hyp-pat-immo">${formatCurrency(firstSnap.immobilier)}</p>
              <p class="text-[9px] text-gray-600 mt-0.5" id="hyp-pat-immo-delta">—</p>
            </div>
            <div class="rounded-xl border border-blue-500/20 p-3 text-center bg-blue-500/5 hover:bg-blue-500/10 transition">
              <p class="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Invest. (PEA, CTO, Crypto)</p>
              <p class="text-base font-bold text-blue-400 mt-1 tabular-nums" id="hyp-pat-plac">${formatCurrency(firstSnap.placementsHorsAV)}</p>
              <p class="text-[9px] text-gray-600 mt-0.5" id="hyp-pat-plac-delta">—</p>
            </div>
            <div class="rounded-xl border border-purple-500/20 p-3 text-center bg-purple-500/5 hover:bg-purple-500/10 transition">
              <p class="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Assurance Vie</p>
              <p class="text-base font-bold text-purple-400 mt-1 tabular-nums" id="hyp-pat-av">${formatCurrency(firstSnap.assuranceVie)}</p>
              <p class="text-[9px] text-gray-600 mt-0.5" id="hyp-pat-av-delta">—</p>
            </div>
            <div class="rounded-xl border border-emerald-500/20 p-3 text-center bg-emerald-500/5 hover:bg-emerald-500/10 transition">
              <p class="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Épargne</p>
              <p class="text-base font-bold text-emerald-400 mt-1 tabular-nums" id="hyp-pat-epar">${formatCurrency(firstSnap.epargne)}</p>
              <p class="text-[9px] text-gray-600 mt-0.5" id="hyp-pat-epar-delta">—</p>
            </div>
            <div class="rounded-xl border border-gray-500/20 p-3 text-center bg-gray-500/5 hover:bg-gray-500/10 transition col-span-2 sm:col-span-1">
              <p class="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Patrimoine net</p>
              <p class="text-base font-bold text-gray-100 mt-1 tabular-nums" id="hyp-pat-net">${formatCurrency(firstSnap.patrimoineNet)}</p>
              <p class="text-[9px] text-gray-600 mt-0.5" id="hyp-pat-net-delta">—</p>
            </div>
          </div>

          <!-- Succession comparison (compact: amount on the right) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3" id="hyp-succession-compare">
            <div class="rounded-xl border border-red-500/15 px-4 py-3 bg-red-500/5 flex items-center gap-3">
              <div class="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-200">Sans optimisation</p>
                <p class="text-[10px] text-gray-500" id="hyp-droits-detail">${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} — abattement ${formatCurrency(ABATTEMENT_PARENT_ENFANT)} chacun</p>
              </div>
              <p class="text-xl font-bold text-red-400 tabular-nums flex-shrink-0" id="hyp-droits-bruts">0 \u20ac</p>
            </div>
            <div class="rounded-xl border border-emerald-500/15 px-4 py-3 bg-emerald-500/5 flex items-center gap-3">
              <div class="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-200">Avec votre stratégie</p>
                <p class="text-[10px] text-gray-500" id="hyp-droits-opti-detail">Ajoute des donations pour réduire les droits</p>
              </div>
              <p class="text-xl font-bold text-emerald-400 tabular-nums flex-shrink-0" id="hyp-droits-opti">0 \u20ac</p>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- ── Children Gauges ── -->
        ${enfants.length > 0 ? `
        <div class="px-6 pb-6">
          <div id="hyp-gauges-container" class="grid grid-cols-1 ${enfants.length >= 2 ? 'md:grid-cols-2' : ''} gap-4">
            ${enfants.map((enf, i) => {
              const color = childColors[i % childColors.length];
              const gauges = computeChildGaugesAtYear(enf, hypotheses, enfants, currentYear, ageDonateur, currentYear, 0);
              return renderChildGauges(enf, gauges, color);
            }).join('')}
          </div>
        </div>
        ` : ''}
      </div>

      <!-- Filter chips -->
      ${themes.length > 0 && hypotheses.length > 0 ? `
      <div class="flex flex-wrap gap-2 items-center">
        <span class="text-[10px] text-gray-600 uppercase tracking-wider font-semibold mr-1">Filtrer</span>
        <button class="hyp-filter-btn px-3 py-1 rounded-full text-[11px] font-medium border border-accent-green/30 bg-accent-green/10 text-accent-green transition" data-filter="all">Tous</button>
        ${themes.filter(t => hypotheses.some(h => h.theme === t.id)).map(t => {
          const cc = c(t.color);
          return `<button class="hyp-filter-btn px-3 py-1 rounded-full text-[11px] font-medium border border-dark-400/30 text-gray-500 hover:${cc.text} hover:${cc.border} transition" data-filter="${t.id}">${t.label}</button>`;
        }).join('')}
      </div>` : ''}

      <!-- Cards list -->
      <div id="hyp-cards-list" class="space-y-3">
        ${sorted.length === 0
          ? ''
          : sorted.map(item => renderCard(item, themes, enfants)).join('')
        }
      </div>

      <!-- Bloc règles fiscales (collapsible) -->
      <details class="mt-10 rounded-xl border border-dark-400/20 bg-dark-800/40 overflow-hidden group">
        <summary class="px-6 py-4 cursor-pointer flex items-center justify-between hover:bg-dark-700/30 transition select-none">
          <h2 class="text-sm font-bold text-gray-200">Règles de donation et fiscalité</h2>
          <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-6 py-5 space-y-5 text-xs text-gray-400 leading-relaxed border-t border-dark-400/15">

          <!-- Abattement classique -->
          <div>
            <h3 class="text-gray-200 font-semibold mb-1.5 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              Abattement en ligne directe (Immo / Cash / CTO)
            </h3>
            <ul class="space-y-1 ml-4 list-disc marker:text-gray-600">
              <li>Chaque parent peut donner jusqu'à <span class="text-gray-200 font-medium">100 000 \u20ac par enfant</span>, en franchise de droits.</li>
              <li>Ce plafond est <span class="text-gray-200 font-medium">commun</span> aux donations immobilières (nue-propriété), cash et CTO : la somme des trois ne peut pas dépasser 100 000 \u20ac.</li>
              <li>L'abattement se renouvelle tous les <span class="text-gray-200 font-medium">15 ans</span>.</li>
              <li>Au-delà de l'abattement, les droits de donation s'appliquent selon un barème progressif de <span class="text-gray-200 font-medium">5 % à 45 %</span>.</li>
              <li>Référence : art. 779-I du Code général des impôts (CGI).</li>
            </ul>
          </div>

          <!-- Donation Sarkozy -->
          <div>
            <h3 class="text-gray-200 font-semibold mb-1.5 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
              Don familial dit « Sarkozy »
            </h3>
            <ul class="space-y-1 ml-4 list-disc marker:text-gray-600">
              <li>Don de somme d'argent, exonéré dans la limite de <span class="text-gray-200 font-medium">31 865 \u20ac par enfant</span>.</li>
              <li>Conditions : le donateur doit avoir <span class="text-gray-200 font-medium">moins de 80 ans</span> et le bénéficiaire doit être majeur.</li>
              <li>Cet abattement est <span class="text-gray-200 font-medium">distinct</span> de l'abattement classique de 100 000 \u20ac (ils se cumulent).</li>
              <li>Renouvelable tous les <span class="text-gray-200 font-medium">15 ans</span>.</li>
              <li>Pas de frais de notaire : simple déclaration (formulaire 2735).</li>
              <li>Référence : art. 790 G du CGI.</li>
            </ul>
          </div>

          <!-- Assurance Vie -->
          <div>
            <h3 class="text-gray-200 font-semibold mb-1.5 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-purple-400"></span>
              Assurance Vie — Transmission avant 70 ans
            </h3>
            <ul class="space-y-1 ml-4 list-disc marker:text-gray-600">
              <li>Les primes versées <span class="text-gray-200 font-medium">avant les 70 ans</span> du souscripteur bénéficient d'un abattement de <span class="text-gray-200 font-medium">152 500 \u20ac par bénéficiaire</span>.</li>
              <li>Au-delà : taxation forfaitaire de <span class="text-gray-200 font-medium">20 %</span> jusqu'à 700 000 \u20ac, puis <span class="text-gray-200 font-medium">31,25 %</span>.</li>
              <li>Les primes versées <span class="text-gray-200 font-medium">après 70 ans</span> relèvent d'un régime différent : abattement global de 30 500 \u20ac (tous bénéficiaires confondus), puis droits de succession classiques.</li>
              <li>Cet abattement est <span class="text-gray-200 font-medium">distinct</span> des abattements classiques et Sarkozy.</li>
              <li>Référence : art. 990 I du CGI (avant 70 ans) et art. 757 B (après 70 ans).</li>
            </ul>
          </div>

          <!-- Barème droits de donation -->
          <div>
            <h3 class="text-gray-200 font-semibold mb-1.5 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
              Barème des droits de donation en ligne directe
            </h3>
            <div class="overflow-x-auto mt-2">
              <table class="text-[11px] w-full">
                <thead>
                  <tr class="border-b border-dark-400/20 text-gray-500">
                    <th class="text-left py-1.5 pr-4 font-medium">Tranche</th>
                    <th class="text-right py-1.5 font-medium">Taux</th>
                  </tr>
                </thead>
                <tbody class="text-gray-400">
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">Jusqu'à 8 072 \u20ac</td><td class="text-right">5 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">8 072 \u20ac à 12 109 \u20ac</td><td class="text-right">10 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">12 109 \u20ac à 15 932 \u20ac</td><td class="text-right">15 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">15 932 \u20ac à 552 324 \u20ac</td><td class="text-right">20 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">552 324 \u20ac à 902 838 \u20ac</td><td class="text-right">30 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">902 838 \u20ac à 1 805 677 \u20ac</td><td class="text-right">40 %</td></tr>
                  <tr><td class="py-1.5 pr-4">Au-delà de 1 805 677 \u20ac</td><td class="text-right">45 %</td></tr>
                </tbody>
              </table>
            </div>
            <p class="mt-2 text-gray-500">Ce barème s'applique après déduction de l'abattement de 100 000 \u20ac. Référence : art. 777 du CGI.</p>
          </div>

          <!-- Barème usufruit -->
          <div>
            <h3 class="text-gray-200 font-semibold mb-1.5 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-rose-400"></span>
              Barème de l'usufruit (art. 669 CGI)
            </h3>
            <p class="mb-2">Lors d'une donation en démembrement, seule la <span class="text-gray-200 font-medium">nue-propriété</span> est taxée. Sa valeur dépend de l'âge du donateur au moment de la donation :</p>
            <div class="overflow-x-auto mt-2">
              <table class="text-[11px] w-full">
                <thead>
                  <tr class="border-b border-dark-400/20 text-gray-500">
                    <th class="text-left py-1.5 pr-4 font-medium">Âge du donateur</th>
                    <th class="text-right py-1.5 pr-4 font-medium">Usufruit</th>
                    <th class="text-right py-1.5 font-medium">Nue-propriété</th>
                  </tr>
                </thead>
                <tbody class="text-gray-400">
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">< 21 ans</td><td class="text-right pr-4">90 %</td><td class="text-right text-rose-400 font-medium">10 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">21 – 30 ans</td><td class="text-right pr-4">80 %</td><td class="text-right text-rose-400 font-medium">20 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">31 – 40 ans</td><td class="text-right pr-4">70 %</td><td class="text-right text-rose-400 font-medium">30 %</td></tr>
                  <tr class="border-b border-dark-400/10 bg-dark-600/20"><td class="py-1.5 pr-4 text-gray-200">41 – 50 ans</td><td class="text-right pr-4 text-gray-200">60 %</td><td class="text-right text-rose-400 font-bold">40 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">51 – 60 ans</td><td class="text-right pr-4">50 %</td><td class="text-right text-rose-400 font-medium">50 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">61 – 70 ans</td><td class="text-right pr-4">40 %</td><td class="text-right text-rose-400 font-medium">60 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">71 – 80 ans</td><td class="text-right pr-4">30 %</td><td class="text-right text-rose-400 font-medium">70 %</td></tr>
                  <tr class="border-b border-dark-400/10"><td class="py-1.5 pr-4">81 – 90 ans</td><td class="text-right pr-4">20 %</td><td class="text-right text-rose-400 font-medium">80 %</td></tr>
                  <tr><td class="py-1.5 pr-4">91 ans et +</td><td class="text-right pr-4">10 %</td><td class="text-right text-rose-400 font-medium">90 %</td></tr>
                </tbody>
              </table>
            </div>
            <p class="mt-2 text-gray-500">Plus le donateur est jeune, plus l'usufruit est élevé et donc la nue-propriété (base taxable) est faible. C'est pourquoi il est avantageux de donner tôt.</p>
          </div>

        </div>
      </details>
    </div>`;
}

// ─── Mount (event handlers) ──────────────────────────────────────────────────

export function mount(store, navigate) {
  const themes = () => getThemes(store);
  const cfg = getDonationConfig(store);
  const enfants = cfg.enfants || [];
  const params = store.get('parametres') || {};
  const ageDonateur = params.ageFinAnnee || 43;
  const currentYear = new Date().getFullYear();
  const projectionYears = params.projectionYears || 30;
  const childColors = ['accent-purple', 'accent-cyan', 'accent-green', 'accent-amber', 'accent-blue', 'accent-red'];

  function refresh() {
    const el = document.getElementById('app-content');
    if (el) { el.innerHTML = render(store); mount(store, navigate); }
  }

  // ── Profile selector
  document.querySelectorAll('.profil-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const profilId = btn.dataset.profil;
      if (profilId) {
        saveActiveProfile(store, profilId);
        refresh();
      }
    });
  });

  // ── Edit profiles modal
  document.getElementById('btn-edit-profiles')?.addEventListener('click', () => {
    const profiles = getProfiles(store);
    openModal('Personnaliser les profils de rendement', getProfileEditHtml(profiles), () => {
      const updated = JSON.parse(JSON.stringify(profiles));
      // Save per-field values (immobilier, épargne, inflation)
      document.querySelectorAll('[data-profil][data-field]').forEach(input => {
        const key = input.dataset.profil;
        const field = input.dataset.field;
        const val = parseFloat(input.value);
        if (!isNaN(val) && updated[key]) {
          updated[key][field] = val / 100;
        }
      });
      // Save per-group rendement values
      document.querySelectorAll('[data-profil][data-group]').forEach(input => {
        const key = input.dataset.profil;
        const group = input.dataset.group;
        const val = parseFloat(input.value);
        if (!isNaN(val) && updated[key]) {
          if (!updated[key].rendementGroupes) updated[key].rendementGroupes = {};
          updated[key].rendementGroupes[group] = val / 100;
        }
      });
      saveProfiles(store, updated);
      refresh();
    });
  });

  // ── Scenario tabs
  document.querySelectorAll('.scenario-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.closest('.scenario-edit')) return;
      const scId = btn.dataset.scenarioId;
      const current = getActiveScenario(store);
      saveActiveScenario(store, current === scId ? null : scId);
      refresh();
    });
  });

  // ── Scenario edit buttons
  document.querySelectorAll('.scenario-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const scId = btn.dataset.scenarioId;
      const scenarios = getScenarios(store);
      const sc = scenarios.find(s => s.id === scId);
      if (!sc) return;

      const formHtml = getScenarioFormHtml(sc) + `
        <div class="mt-4 pt-4 border-t border-dark-400/20">
          <button id="sc-form-delete" class="btn-delete text-xs px-3 py-1.5 rounded-lg transition">Supprimer ce scénario</button>
        </div>`;
      const modal = openModal('Modifier le scénario', formHtml, () => {
        sc.nom = document.getElementById('sc-form-nom')?.value.trim() || sc.nom;
        sc.description = document.getElementById('sc-form-desc')?.value.trim() || '';
        sc.color = document.getElementById('sc-form-color')?.value || 'blue';
        const rend = parseFloat(document.getElementById('sc-form-rend')?.value);
        sc.rendementPlacements = !isNaN(rend) ? rend / 100 : undefined;
        const rendImmo = parseFloat(document.getElementById('sc-form-rend-immo')?.value);
        sc.rendementImmobilier = !isNaN(rendImmo) ? rendImmo / 100 : undefined;
        const dcaMult = parseFloat(document.getElementById('sc-form-dca-mult')?.value);
        sc.dcaMultiplier = !isNaN(dcaMult) ? dcaMult : undefined;
        const infl = parseFloat(document.getElementById('sc-form-inflation')?.value);
        sc.extraInflation = !isNaN(infl) ? infl / 100 : undefined;
        saveScenarios(store, scenarios);
        refresh();
      });
      mountScenarioColorSelector(modal);
      setTimeout(() => {
        document.getElementById('sc-form-delete')?.addEventListener('click', () => {
          if (confirm(`Supprimer le scénario « ${sc.nom} » ?`)) {
            modal.remove();
            saveScenarios(store, scenarios.filter(s => s.id !== scId));
            if (getActiveScenario(store) === scId) saveActiveScenario(store, null);
            refresh();
          }
        });
      }, 50);
    });
  });

  // ── Add scenario
  document.getElementById('btn-add-scenario')?.addEventListener('click', () => {
    const modal = openModal('Nouveau scénario', getScenarioFormHtml(), () => {
      const nom = document.getElementById('sc-form-nom')?.value.trim();
      if (!nom) return;
      const color = document.getElementById('sc-form-color')?.value || 'blue';
      const description = document.getElementById('sc-form-desc')?.value.trim() || '';
      const rend = parseFloat(document.getElementById('sc-form-rend')?.value);
      const rendImmo = parseFloat(document.getElementById('sc-form-rend-immo')?.value);
      const dcaMult = parseFloat(document.getElementById('sc-form-dca-mult')?.value);
      const infl = parseFloat(document.getElementById('sc-form-inflation')?.value);
      const newScenario = {
        id: generateId(),
        nom, description, color,
        rendementPlacements: !isNaN(rend) ? rend / 100 : undefined,
        rendementImmobilier: !isNaN(rendImmo) ? rendImmo / 100 : undefined,
        dcaMultiplier: !isNaN(dcaMult) ? dcaMult : undefined,
        extraInflation: !isNaN(infl) ? infl / 100 : undefined,
      };
      const scenarios = getScenarios(store);
      scenarios.push(newScenario);
      saveScenarios(store, scenarios);
      saveActiveScenario(store, newScenario.id);
      refresh();
    });
    mountScenarioColorSelector(modal);
  });

  // ── Gauge slider + Patrimoine indicator + Succession comparison
  const gaugeSlider = document.getElementById('hyp-gauges-slider');
  if (gaugeSlider) {
    const gaugeLabel = document.getElementById('hyp-gauges-year-label');
    const gaugeContainer = document.getElementById('hyp-gauges-container');

    // Compute projection snapshots for patrimoine cards
    let snapshots = [];
    try { snapshots = computeProjection(store, profileToOverrides(getProfiles(store), getActiveProfile(store))); } catch(e) {}

    const getAV = (snap) => {
      if (!snap.placementDetail) return 0;
      return snap.placementDetail['Assurance Vie'] || 0;
    };
    const getPlacementsHorsAV = (snap) => {
      if (!snap.placementDetail) return 0;
      let total = 0;
      for (const [k, v] of Object.entries(snap.placementDetail)) {
        if (k !== 'Assurance Vie') total += v;
      }
      return total;
    };

    const snapshotsData = snapshots.map((snap, i) => ({
      immobilier: snap.immobilier || 0,
      placementsHorsAV: getPlacementsHorsAV(snap),
      assuranceVie: getAV(snap),
      epargne: snap.epargne || 0,
      patrimoineNet: snap.patrimoineNet || 0
    }));
    const firstSnap = snapshotsData[0] || { immobilier: 0, placementsHorsAV: 0, assuranceVie: 0, epargne: 0, patrimoineNet: 0 };
    const nbEnfants = enfants.length || 1;

    // Succession tax calculation (same as fiscalite.js)
    const TRANCHES = [
      { min: 0, max: 8072, taux: 0.05 }, { min: 8072, max: 12109, taux: 0.10 },
      { min: 12109, max: 15932, taux: 0.15 }, { min: 15932, max: 552324, taux: 0.20 },
      { min: 552324, max: 902838, taux: 0.30 }, { min: 902838, max: 1805677, taux: 0.40 },
      { min: 1805677, max: Infinity, taux: 0.45 }
    ];
    function calcDroits(taxable) {
      if (taxable <= 0) return 0;
      let d = 0;
      for (const t of TRANCHES) { if (taxable <= t.min) break; d += (Math.min(taxable, t.max) - t.min) * t.taux; }
      return Math.round(d);
    }
    function calcSuccession(patrimoineHorsAV, avTotal) {
      const partBrute = patrimoineHorsAV / nbEnfants;
      const taxable = Math.max(0, partBrute - 100000);
      const droitsHorsAV = calcDroits(taxable);
      const avParEnfant = avTotal / nbEnfants;
      const avTaxable = Math.max(0, avParEnfant - 152500);
      const avDroits = avTaxable > 0 ? Math.round(Math.min(avTaxable, 700000) * 0.20 + Math.max(0, avTaxable - 700000) * 0.3125) : 0;
      return (droitsHorsAV + avDroits) * nbEnfants;
    }
    function calcSuccessionOpti(patrimoineHorsAV, avTotal, yearOffset) {
      const calYear = currentYear + yearOffset;
      const hyps = getHypotheses(store);
      let totalDonated = 0;
      let totalAVDonated = 0;
      hyps.filter(h => h.theme === 'donation' && h.annee <= calYear).forEach(h => {
        const donType = h.donationType || 'abatt_immo';
        if (donType === 'av_donation') { totalAVDonated += (h.montant || 0); }
        else { totalDonated += (h.montant || 0); }
      });
      const adjHorsAV = Math.max(0, patrimoineHorsAV - totalDonated);
      const adjAV = Math.max(0, avTotal - totalAVDonated);
      return calcSuccession(adjHorsAV, adjAV);
    }

    // Initial succession calculation
    if (snapshotsData.length > 0) {
      const s = snapshotsData[0];
      const brutEl = document.getElementById('hyp-droits-bruts');
      const optiEl = document.getElementById('hyp-droits-opti');
      const horsAV = s.immobilier + s.placementsHorsAV + s.epargne;
      if (brutEl) brutEl.textContent = formatCurrency(calcSuccession(horsAV, s.assuranceVie));
      if (optiEl) optiEl.textContent = formatCurrency(calcSuccessionOpti(horsAV, s.assuranceVie, 0));
    }

    const updateAll = (yearOffset) => {
      const calYear = currentYear + yearOffset;
      const hypotheses = getHypotheses(store);

      // Update year label
      if (gaugeLabel) {
        gaugeLabel.textContent = yearOffset === 0
          ? `Aujourd'hui (${currentYear})`
          : `Fin ${calYear} (+${yearOffset} an${yearOffset > 1 ? 's' : ''})`;
      }

      // Update child gauges
      if (gaugeContainer && enfants.length > 0) {
        gaugeContainer.innerHTML = enfants.map((enf, i) => {
          const color = childColors[i % childColors.length];
          const gauges = computeChildGaugesAtYear(enf, hypotheses, enfants, calYear, ageDonateur, currentYear, 0);
          return renderChildGauges(enf, gauges, color);
        }).join('');
      }

      // Update patrimoine indicator cards
      const snapIdx = Math.min(yearOffset, snapshotsData.length - 1);
      const s = snapshotsData[snapIdx];
      if (s) {
        const updateCard = (id, value, deltaId, baseValue) => {
          const el = document.getElementById(id);
          const dEl = document.getElementById(deltaId);
          if (el) el.textContent = formatCurrency(value);
          if (dEl) {
            if (yearOffset === 0) { dEl.textContent = '—'; dEl.className = 'text-[9px] text-gray-600 mt-0.5'; }
            else {
              const delta = value - baseValue;
              const sign = delta >= 0 ? '+' : '';
              dEl.textContent = `${sign}${formatCurrency(delta)}`;
              dEl.className = `text-[9px] mt-0.5 font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
            }
          }
        };
        updateCard('hyp-pat-immo', s.immobilier, 'hyp-pat-immo-delta', firstSnap.immobilier);
        updateCard('hyp-pat-plac', s.placementsHorsAV, 'hyp-pat-plac-delta', firstSnap.placementsHorsAV);
        updateCard('hyp-pat-av', s.assuranceVie, 'hyp-pat-av-delta', firstSnap.assuranceVie);
        updateCard('hyp-pat-epar', s.epargne, 'hyp-pat-epar-delta', firstSnap.epargne);
        updateCard('hyp-pat-net', s.patrimoineNet, 'hyp-pat-net-delta', firstSnap.patrimoineNet);

        // Update succession comparison
        const horsAV = s.immobilier + s.placementsHorsAV + s.epargne;
        const brutEl = document.getElementById('hyp-droits-bruts');
        const optiEl = document.getElementById('hyp-droits-opti');
        if (brutEl) brutEl.textContent = formatCurrency(calcSuccession(horsAV, s.assuranceVie));
        if (optiEl) optiEl.textContent = formatCurrency(calcSuccessionOpti(horsAV, s.assuranceVie, yearOffset));
      }
    };

    gaugeSlider.addEventListener('input', (e) => updateAll(parseInt(e.target.value)));
  }

  // ── Add hypothesis
  document.getElementById('btn-add-hyp')?.addEventListener('click', () => {
    const modal = openModal('Nouvelle hypothèse', getFormHtml(themes(), null, enfants), () => {
      const titre = document.getElementById('hyp-form-titre')?.value.trim();
      const annee = parseInt(document.getElementById('hyp-form-annee')?.value) || new Date().getFullYear();
      const montant = parseFloat(document.getElementById('hyp-form-montant')?.value) || null;
      const theme = document.getElementById('hyp-form-theme')?.value || themes()[0]?.id;
      const description = document.getElementById('hyp-form-desc')?.value.trim();
      const donationType = document.getElementById('hyp-form-donation-type')?.value || 'abatt_immo';
      let enfantIds = [];
      try { enfantIds = JSON.parse(document.getElementById('hyp-form-enfant-ids')?.value || '[]'); } catch(e) {}
      if (!titre) return;

      const eventType = document.getElementById('hyp-form-event-type')?.value || 'retraite';
      const newItem = { id: generateId(), titre, annee, montant, theme, description };
      if (theme === 'donation') {
        newItem.donationType = donationType;
        newItem.enfantIds = enfantIds;
      } else if (theme === 'evenement') {
        newItem.eventType = eventType;
      }
      const items = getHypotheses(store);
      items.push(newItem);
      saveHypotheses(store, items);
      refresh();
    });
    mountThemeSelector(modal);
    mountEnfantSelector(modal, enfants);
    mountDonationThemeToggle(modal);
  });

  // ── Edit hypothesis
  document.querySelectorAll('.hyp-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const items = getHypotheses(store);
      const item = items.find(i => i.id === id);
      if (!item) return;

      const modal = openModal('Modifier l\'hypothèse', getFormHtml(themes(), item, enfants), () => {
        item.titre = document.getElementById('hyp-form-titre')?.value.trim() || item.titre;
        item.annee = parseInt(document.getElementById('hyp-form-annee')?.value) || item.annee;
        item.montant = parseFloat(document.getElementById('hyp-form-montant')?.value) || null;
        item.theme = document.getElementById('hyp-form-theme')?.value || item.theme;
        item.description = document.getElementById('hyp-form-desc')?.value.trim();
        if (item.theme === 'donation') {
          item.donationType = document.getElementById('hyp-form-donation-type')?.value || 'abatt_immo';
          try { item.enfantIds = JSON.parse(document.getElementById('hyp-form-enfant-ids')?.value || '[]'); } catch(e) {}
          delete item.eventType;
        } else if (item.theme === 'evenement') {
          item.eventType = document.getElementById('hyp-form-event-type')?.value || 'retraite';
          delete item.donationType;
          delete item.enfantIds;
        } else {
          delete item.donationType;
          delete item.enfantIds;
          delete item.eventType;
        }
        saveHypotheses(store, items);
        refresh();
      });
      mountThemeSelector(modal);
      mountEnfantSelector(modal, enfants);
      mountDonationThemeToggle(modal);
    });
  });

  // ── Delete hypothesis
  document.querySelectorAll('.hyp-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const items = getHypotheses(store);
      const item = items.find(i => i.id === id);
      if (item && confirm(`Supprimer « ${item.titre} » ?`)) {
        saveHypotheses(store, items.filter(i => i.id !== id));
        refresh();
      }
    });
  });

  // ── Timeline dot scroll
  document.querySelectorAll('.hyp-tl-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const target = document.getElementById(`hyp-${dot.dataset.scrollTo}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('ring-2', 'ring-accent-green/40');
        setTimeout(() => target.classList.remove('ring-2', 'ring-accent-green/40'), 1500);
      }
    });
  });

  // ── Filter
  document.querySelectorAll('.hyp-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // Update button styles
      document.querySelectorAll('.hyp-filter-btn').forEach(b => {
        b.classList.remove('bg-accent-green/10', 'border-accent-green/30', 'text-accent-green');
        b.classList.add('border-dark-400/30', 'text-gray-500');
      });
      btn.classList.add('bg-accent-green/10', 'border-accent-green/30', 'text-accent-green');
      btn.classList.remove('border-dark-400/30', 'text-gray-500');

      // Show/hide cards
      document.querySelectorAll('#hyp-cards-list > div').forEach(card => {
        if (filter === 'all') {
          card.style.display = '';
        } else {
          const items = getHypotheses(store);
          const cardId = card.id?.replace('hyp-', '');
          const item = items.find(i => i.id === cardId);
          card.style.display = item?.theme === filter ? '' : 'none';
        }
      });
    });
  });

  // ── Manage themes
  document.getElementById('btn-manage-themes')?.addEventListener('click', () => {
    let localThemes = JSON.parse(JSON.stringify(themes()));

    openModal('Gérer les thèmes', getThemeManagerHtml(localThemes), () => {
      // Read updated values from DOM
      document.querySelectorAll('#theme-manager-list [data-theme-idx]').forEach(row => {
        const idx = parseInt(row.dataset.themeIdx);
        if (localThemes[idx]) {
          const labelInput = row.querySelector('[data-field="label"]');
          const colorSelect = row.querySelector('[data-field="color"]');
          if (labelInput) localThemes[idx].label = labelInput.value.trim() || localThemes[idx].label;
          if (colorSelect) localThemes[idx].color = colorSelect.value;
        }
      });
      saveThemes(store, localThemes);
      refresh();
    });

    // Mount theme manager interactions
    setTimeout(() => {
      document.getElementById('tm-add')?.addEventListener('click', () => {
        const newTheme = { id: generateId(), label: 'Nouveau thème', color: ALL_COLORS[localThemes.length % ALL_COLORS.length], icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };
        localThemes.push(newTheme);
        const list = document.getElementById('theme-manager-list');
        if (list) { list.innerHTML = getThemeManagerHtml(localThemes); mountThemeManagerEvents(localThemes); }
      });
      mountThemeManagerEvents(localThemes);
    }, 100);

    function mountThemeManagerEvents(lt) {
      document.querySelectorAll('.tm-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          lt.splice(idx, 1);
          const list = document.getElementById('theme-manager-list');
          if (list) { list.innerHTML = getThemeManagerHtml(lt); mountThemeManagerEvents(lt); }
        });
      });
      document.getElementById('tm-add')?.addEventListener('click', () => {
        const newTheme = { id: generateId(), label: 'Nouveau thème', color: ALL_COLORS[lt.length % ALL_COLORS.length], icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };
        lt.push(newTheme);
        const list = document.getElementById('theme-manager-list');
        if (list) { list.innerHTML = getThemeManagerHtml(lt); mountThemeManagerEvents(lt); }
      });
    }
  });

  // ── Load boussole data and fill dynamic sections
  loadBoussoleData().then(boussole => {
    if (!boussole) return;
    const activeProfile = getActiveProfile(store);
    buildProjectionChart(store, boussole, activeProfile);
    fillComparisonTable(boussole, activeProfile);
    _transmissionTab = null; // reset to follow scenario selector
    fillTransmissionSection(boussole, store);
    fillBudgetSection(boussole);
  });
}

// ── Theme selector in modal
function mountThemeSelector(modal) {
  setTimeout(() => {
    modal?.querySelectorAll('.hyp-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const themeId = btn.dataset.themeId;
        const hiddenInput = document.getElementById('hyp-form-theme');
        if (hiddenInput) hiddenInput.value = themeId;

        // Reset all buttons
        modal.querySelectorAll('.hyp-theme-btn').forEach(b => {
          b.className = b.className.replace(/ring-2\s+\S+/g, '').replace(/bg-\S+\/10/g, '').replace(/border-\S+\/30/g, '');
          b.classList.add('border-dark-400/30', 'text-gray-500');
          b.classList.remove('ring-2');
        });
        // Activate clicked
        btn.classList.remove('border-dark-400/30', 'text-gray-500');
        btn.classList.add('ring-2');

        // Toggle donation-specific fields
        const donTypeRow = document.getElementById('hyp-form-donation-type-row');
        const enfantRow = document.getElementById('hyp-form-enfant-row');
        const eventTypeRow = document.getElementById('hyp-form-event-type-row');
        if (donTypeRow) donTypeRow.classList.toggle('hidden', themeId !== 'donation');
        if (enfantRow) enfantRow.classList.toggle('hidden', themeId !== 'donation');
        if (eventTypeRow) eventTypeRow.classList.toggle('hidden', themeId !== 'evenement');
      });
    });
  }, 50);
}

// ── Enfant selector in modal
function mountEnfantSelector(modal, enfants) {
  setTimeout(() => {
    modal?.querySelectorAll('.hyp-enfant-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const enfantId = btn.dataset.enfantId;
        const hiddenInput = document.getElementById('hyp-form-enfant-ids');
        if (!hiddenInput) return;

        let selectedIds = [];
        try { selectedIds = JSON.parse(hiddenInput.value || '[]'); } catch(e) {}

        if (enfantId === 'all') {
          // Select all
          selectedIds = enfants.map(e => e.id);
        } else {
          // Toggle individual child
          if (selectedIds.includes(enfantId)) {
            selectedIds = selectedIds.filter(id => id !== enfantId);
          } else {
            selectedIds.push(enfantId);
          }
        }

        hiddenInput.value = JSON.stringify(selectedIds);

        // Update button styles
        modal.querySelectorAll('.hyp-enfant-btn').forEach(b => {
          b.className = b.className
            .replace(/bg-\S+\/10/g, '')
            .replace(/border-\S+\/30/g, '')
            .replace(/text-\S+/g, '')
            .replace(/ring-2\s*\S*/g, '');
          b.classList.add('border-dark-400/30', 'text-gray-500');
          b.classList.remove('ring-2');
        });

        const isAll = selectedIds.length === 0 || selectedIds.length === enfants.length;
        // Style "all" button
        const allBtn = modal.querySelector('.hyp-enfant-btn[data-enfant-id="all"]');
        if (allBtn && isAll) {
          allBtn.classList.remove('border-dark-400/30', 'text-gray-500');
          allBtn.classList.add('bg-purple-500/10', 'border-purple-500/30', 'text-purple-400', 'ring-2', 'ring-purple-400/30');
        }
        // Style individual buttons
        if (!isAll) {
          selectedIds.forEach(id => {
            const b = modal.querySelector(`.hyp-enfant-btn[data-enfant-id="${id}"]`);
            if (b) {
              b.classList.remove('border-dark-400/30', 'text-gray-500');
              b.classList.add('bg-cyan-500/10', 'border-cyan-500/30', 'text-cyan-400', 'ring-2', 'ring-cyan-400/30');
            }
          });
        }
      });
    });
  }, 50);
}

// ── Toggle donation fields when theme changes
function mountDonationThemeToggle(modal) {
  // Already handled via mountThemeSelector — the toggle logic is inside the theme button click
}

// ── Scenario color selector in modal
function mountScenarioColorSelector(modal) {
  setTimeout(() => {
    modal?.querySelectorAll('.sc-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        const hiddenInput = document.getElementById('sc-form-color');
        if (hiddenInput) hiddenInput.value = color;
        modal.querySelectorAll('.sc-color-btn').forEach(b => {
          b.classList.remove('ring-2');
          b.className = b.className.replace(/border-\S+-400/g, 'border-dark-400/30');
        });
        btn.classList.add('ring-2');
      });
    });
  }, 50);
}
