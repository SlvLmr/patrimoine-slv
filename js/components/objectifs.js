import { formatCurrency, openModal, inputField, selectField, getFormData } from '../utils.js?v=5';
import { createChart, COLORS } from '../charts/chart-config.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAllActifs(store) {
  const state = store.getAll();
  const items = [];

  // Épargne (Livrets, comptes courants)
  (state.actifs.epargne || []).forEach(a => {
    items.push({ id: a.id, path: 'actifs.epargne', nom: a.nom, valeur: Number(a.solde) || 0, type: 'epargne', icon: 'epargne' });
  });
  const liveSoldes = store.computeLiveSoldes();
  (state.actifs.comptesCourants || []).forEach(a => {
    const liveVal = a.id === 'cc-cic' ? liveSoldes.cic : a.id === 'cc-trade' ? liveSoldes.tr : (Number(a.solde) || 0);
    items.push({ id: a.id, path: 'actifs.comptesCourants', nom: a.nom, valeur: liveVal, type: 'courant', icon: 'courant' });
  });

  // Placements
  (state.actifs.placements || []).forEach(p => {
    items.push({ id: p.id, path: 'actifs.placements', nom: p.nom, valeur: Number(p.valeur) || 0, type: 'placement', enveloppe: p.enveloppe, icon: p.enveloppe || 'placement' });
  });

  // Immobilier
  (state.actifs.immobilier || []).forEach(a => {
    items.push({ id: a.id, path: 'actifs.immobilier', nom: a.nom, valeur: Number(a.valeurActuelle) || 0, type: 'immobilier', icon: 'immobilier' });
  });

  return items;
}

function getActifValeur(store, actifId) {
  if (!actifId) return null;
  const all = getAllActifs(store);
  const found = all.find(a => a.id === actifId);
  return found ? found.valeur : null;
}

function getPatrimoineNet(store) {
  return store.totalActifs() - store.totalPassifs();
}

function computeProgress(obj, store) {
  const cible = Number(obj.montantCible) || 0;
  if (cible <= 0) return { pct: 0, actuel: 0, reste: 0, mensuel: 0 };

  let actuel = 0;
  if (obj.type === 'patrimoine_net') {
    actuel = getPatrimoineNet(store);
  } else if (obj.actifId) {
    actuel = getActifValeur(store, obj.actifId) ?? (Number(obj.montantActuel) || 0);
  } else {
    actuel = Number(obj.montantActuel) || 0;
  }

  const pct = Math.min((actuel / cible) * 100, 100);
  const reste = Math.max(cible - actuel, 0);

  // Effort mensuel pour atteindre l'objectif
  let mensuel = 0;
  if (obj.anneeObjectif && reste > 0) {
    const now = new Date();
    const deadline = new Date(obj.anneeObjectif, 11, 31); // fin de l'année cible
    const moisRestants = Math.max(
      (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth()),
      1
    );
    mensuel = reste / moisRestants;
  }

  return { pct, actuel, reste, mensuel };
}

function getStatusInfo(pct, anneeObjectif) {
  const now = new Date().getFullYear();
  if (pct >= 100) return { label: 'Atteint', color: 'accent-green', bg: 'bg-accent-green/15', text: 'text-accent-green', ring: 'ring-accent-green/20' };
  if (!anneeObjectif) return { label: 'En cours', color: 'accent-amber', bg: 'bg-accent-amber/10', text: 'text-accent-amber', ring: 'ring-accent-amber/20' };

  const yearsLeft = anneeObjectif - now;
  // Rythme attendu : on devrait être à (elapsed / total) * 100%
  // Simplifié: si > 75% et deadline proche → en bonne voie
  if (pct >= 75) return { label: 'Bientôt', color: 'accent-green', bg: 'bg-accent-green/10', text: 'text-accent-green', ring: 'ring-accent-green/20' };
  if (yearsLeft <= 1 && pct < 50) return { label: 'En retard', color: 'accent-red', bg: 'bg-accent-red/10', text: 'text-accent-red', ring: 'ring-accent-red/20' };
  if (yearsLeft <= 2 && pct < 30) return { label: 'En retard', color: 'accent-red', bg: 'bg-accent-red/10', text: 'text-accent-red', ring: 'ring-accent-red/20' };
  return { label: 'En cours', color: 'accent-amber', bg: 'bg-accent-amber/10', text: 'text-accent-amber', ring: 'ring-accent-amber/20' };
}

function getIconSvg(icon) {
  const icons = {
    epargne: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    courant: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>',
    placement: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>',
    PEA: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>',
    AV: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>',
    CTO: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>',
    PEE: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>',
    PER: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    Crypto: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>',
    immobilier: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>',
    patrimoine: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>',
    custom: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>',
  };
  return icons[icon] || icons.custom;
}

function getPriorityInfo(p) {
  if (p === 'haute') return { label: 'Haute', class: 'bg-accent-red/10 text-accent-red', sort: 0 };
  if (p === 'basse') return { label: 'Basse', class: 'bg-dark-500/50 text-gray-400', sort: 2 };
  return { label: 'Moyenne', class: 'bg-accent-amber/10 text-accent-amber', sort: 1 };
}

// ─── Render ─────────────────────────────────────────────────────────────────

export function render(store) {
  const objectifs = store.get('objectifs') || [];
  const now = new Date().getFullYear();

  // Compute all progress
  const withProgress = objectifs.map(obj => {
    const progress = computeProgress(obj, store);
    const status = getStatusInfo(progress.pct, obj.anneeObjectif);
    return { ...obj, progress, status };
  }).sort((a, b) => {
    // Sort: priorité haute d'abord, puis par % restant
    const pa = getPriorityInfo(a.priorite).sort;
    const pb = getPriorityInfo(b.priorite).sort;
    if (pa !== pb) return pa - pb;
    return a.progress.pct - b.progress.pct; // les moins avancés en premier
  });

  const totalObjectifs = withProgress.length;
  const atteints = withProgress.filter(o => o.progress.pct >= 100).length;
  const enRetard = withProgress.filter(o => o.status.label === 'En retard').length;
  const avgPct = totalObjectifs > 0 ? withProgress.reduce((s, o) => s + o.progress.pct, 0) / totalObjectifs : 0;

  // Prochain objectif (le plus proche dans le temps, non atteint)
  const prochains = withProgress
    .filter(o => o.anneeObjectif && o.progress.pct < 100)
    .sort((a, b) => a.anneeObjectif - b.anneeObjectif);
  const prochain = prochains[0];

  // Effort mensuel total
  const effortTotal = withProgress.reduce((s, o) => s + o.progress.mensuel, 0);

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
              </svg>
            </div>
            Objectifs
          </h2>
          <p class="text-gray-500 text-sm mt-1">Définis tes cibles et suis ta progression</p>
        </div>
        <button id="btn-add-objectif"
          class="px-4 py-2.5 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 rounded-lg hover:opacity-90 transition font-medium text-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Nouvel objectif
        </button>
      </div>

      ${totalObjectifs > 0 ? `
      <!-- KPI Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Progression globale</p>
          <p class="text-2xl font-bold gradient-text">${avgPct.toFixed(0)}%</p>
          <div class="mt-2 h-1.5 bg-dark-600 rounded-full overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-accent-green to-accent-amber transition-all duration-700" style="width: ${avgPct}%"></div>
          </div>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card glow-green">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Atteints</p>
          <p class="text-2xl font-bold text-accent-green">${atteints}<span class="text-base font-normal text-gray-500"> / ${totalObjectifs}</span></p>
          <p class="text-xs text-gray-600 mt-1">${totalObjectifs > 0 ? ((atteints / totalObjectifs) * 100).toFixed(0) : 0}% complétés</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Effort mensuel</p>
          <p class="text-2xl font-bold text-accent-amber">${formatCurrency(effortTotal)}</p>
          <p class="text-xs text-gray-600 mt-1">pour tous les objectifs</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card ${enRetard > 0 ? '' : 'glow-green'}">
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">${prochain ? 'Prochaine échéance' : 'Statut'}</p>
          ${prochain
            ? `<p class="text-2xl font-bold text-gray-100">${prochain.anneeObjectif}</p><p class="text-xs text-gray-500 mt-1 truncate">${prochain.nom}</p>`
            : `<p class="text-2xl font-bold ${enRetard > 0 ? 'text-accent-red' : 'text-accent-green'}">${enRetard > 0 ? enRetard + ' en retard' : 'En bonne voie'}</p>`
          }
        </div>
      </div>

      <!-- Radar/Overview chart -->
      ${withProgress.length >= 3 ? `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Vue d'ensemble</h2>
          <div class="h-64">
            <canvas id="chart-objectifs-radar"></canvas>
          </div>
        </div>
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Progression par objectif</h2>
          <div class="h-64">
            <canvas id="chart-objectifs-bar"></canvas>
          </div>
        </div>
      </div>
      ` : `
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Progression par objectif</h2>
        <div class="h-56">
          <canvas id="chart-objectifs-bar"></canvas>
        </div>
      </div>
      `}

      <!-- Objectif Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${withProgress.map(obj => {
          const { pct, actuel, reste, mensuel } = obj.progress;
          const status = obj.status;
          const priority = getPriorityInfo(obj.priorite);
          const yearsLeft = obj.anneeObjectif ? obj.anneeObjectif - now : null;
          const iconPath = getIconSvg(obj.icon || 'custom');

          // Ring progress (SVG circle)
          const radius = 36;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (pct / 100) * circumference;

          return `
        <div class="card-dark rounded-xl overflow-hidden hover:border-dark-300/40 transition group" data-objectif-id="${obj.id}">
          <div class="p-5">
            <div class="flex items-start gap-4">
              <!-- Ring Progress -->
              <div class="relative flex-shrink-0">
                <svg width="88" height="88" viewBox="0 0 88 88" class="transform -rotate-90">
                  <circle cx="44" cy="44" r="${radius}" stroke-width="5" fill="none" class="stroke-dark-500"/>
                  <circle cx="44" cy="44" r="${radius}" stroke-width="5" fill="none"
                    class="stroke-${status.color} transition-all duration-1000"
                    stroke-linecap="round"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"/>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-lg font-bold ${status.text}">${pct.toFixed(0)}%</span>
                </div>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <h3 class="text-base font-semibold text-gray-100 truncate">${obj.nom}</h3>
                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                      <span class="text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.text}">${status.label}</span>
                      <span class="text-xs px-2 py-0.5 rounded-full ${priority.class}">${priority.label}</span>
                      ${obj.anneeObjectif ? `<span class="text-xs text-gray-500">${yearsLeft > 0 ? yearsLeft + ' an' + (yearsLeft > 1 ? 's' : '') : yearsLeft === 0 ? 'Cette année' : 'Dépassé'}</span>` : ''}
                    </div>
                  </div>
                  <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                    <button data-edit-objectif="${obj.id}" class="p-1.5 rounded-lg hover:bg-dark-500 transition text-gray-500 hover:text-accent-green" title="Modifier">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button data-delete-objectif="${obj.id}" class="p-1.5 rounded-lg hover:bg-dark-500 transition text-gray-500 hover:text-accent-red" title="Supprimer">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Amounts -->
                <div class="mt-3 space-y-1.5">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-400">Actuel</span>
                    <span class="font-semibold text-gray-200">${formatCurrency(actuel)}</span>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-400">Cible</span>
                    <span class="font-semibold gradient-text">${formatCurrency(obj.montantCible)}</span>
                  </div>

                  <!-- Progress bar -->
                  <div class="h-2 bg-dark-600 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-accent-green' : 'bg-gradient-to-r from-accent-green to-accent-amber'}" style="width: ${Math.min(pct, 100)}%"></div>
                  </div>

                  <div class="flex items-center justify-between text-xs text-gray-500">
                    <span>Reste ${formatCurrency(reste)}</span>
                    ${mensuel > 0 ? `<span>${formatCurrency(mensuel)}/mois</span>` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
          `;
        }).join('')}
      </div>

      ` : `
      <!-- Empty state -->
      <div class="card-dark rounded-xl p-12 text-center">
        <div class="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent-green/20 to-accent-amber/20 flex items-center justify-center mb-6">
          <svg class="w-10 h-10 text-accent-green/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-300 mb-2">Aucun objectif défini</h2>
        <p class="text-gray-500 max-w-lg mx-auto mb-6">
          Fixez-vous des objectifs financiers pour chacun de vos actifs : combien voulez-vous sur votre Livret A ? Quel montant cible pour votre PEA ? Suivez votre progression avec des jauges visuelles et un effort mensuel estimé.
        </p>
        <button id="btn-add-objectif-empty"
          class="px-5 py-2.5 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 rounded-lg hover:opacity-90 transition font-medium text-sm inline-flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Créer mon premier objectif
        </button>
      </div>
      `}
    </div>
  `;
}

// ─── Modal ──────────────────────────────────────────────────────────────────

function openObjectifModal(store, navigate, editItem = null) {
  const actifs = getAllActifs(store);
  const title = editItem ? 'Modifier l\'objectif' : 'Nouvel objectif';

  const actifOptions = [
    { value: '', label: '— Aucun (saisie manuelle) —' },
    { value: '__patrimoine_net__', label: 'Patrimoine net total' },
    ...actifs.map(a => ({ value: a.id, label: `${a.nom} (${formatCurrency(a.valeur)})` }))
  ];

  const iconOptions = [
    { value: 'epargne', label: 'Épargne (livret)' },
    { value: 'courant', label: 'Compte courant' },
    { value: 'PEA', label: 'PEA' },
    { value: 'AV', label: 'Assurance Vie' },
    { value: 'CTO', label: 'CTO' },
    { value: 'PEE', label: 'PEE' },
    { value: 'PER', label: 'PER' },
    { value: 'Crypto', label: 'Crypto' },
    { value: 'immobilier', label: 'Immobilier' },
    { value: 'patrimoine', label: 'Patrimoine global' },
    { value: 'custom', label: 'Autre' },
  ];

  const prioriteOptions = [
    { value: 'haute', label: 'Haute' },
    { value: 'moyenne', label: 'Moyenne' },
    { value: 'basse', label: 'Basse' },
  ];

  const linkedValue = editItem?.type === 'patrimoine_net' ? '__patrimoine_net__' : (editItem?.actifId || '');

  const body = `
    ${inputField('nom', 'Nom de l\'objectif', editItem?.nom || '', 'text', 'placeholder="Ex: Livret A rempli, PEA à 50k€..."')}
    ${selectField('actifId', 'Lier à un actif', actifOptions, linkedValue)}
    <div id="manual-amount-field" class="${linkedValue ? 'hidden' : ''}">
      ${inputField('montantActuel', 'Montant actuel (€)', editItem?.montantActuel || '', 'number', 'min="0" step="100" placeholder="5000"')}
    </div>
    ${inputField('montantCible', 'Montant cible (€)', editItem?.montantCible || '', 'number', 'min="0" step="100" placeholder="23000"')}
    ${inputField('anneeObjectif', 'Année cible', editItem?.anneeObjectif || '', 'number', `min="${new Date().getFullYear()}" max="2080" step="1" placeholder="${new Date().getFullYear() + 5}"`)}
    ${selectField('icon', 'Icône', iconOptions, editItem?.icon || 'epargne')}
    ${selectField('priorite', 'Priorité', prioriteOptions, editItem?.priorite || 'moyenne')}
  `;

  openModal(title, body, () => {
    const modal = document.getElementById('app-modal');
    const data = getFormData(modal.querySelector('#modal-body'));

    if (!data.nom || !data.montantCible) return;

    // Handle linked asset
    if (data.actifId === '__patrimoine_net__') {
      data.type = 'patrimoine_net';
      data.actifId = '';
    } else if (data.actifId) {
      data.type = 'linked';
    } else {
      data.type = 'manual';
    }

    if (editItem) {
      store.updateItem('objectifs', editItem.id, data);
    } else {
      store.addItem('objectifs', data);
    }
    navigate('objectifs');
  });

  // Toggle manual amount field visibility
  setTimeout(() => {
    const actifSelect = document.getElementById('field-actifId');
    const manualField = document.getElementById('manual-amount-field');
    if (actifSelect && manualField) {
      actifSelect.addEventListener('change', () => {
        manualField.classList.toggle('hidden', !!actifSelect.value);
      });
    }
  }, 100);
}

// ─── Mount ──────────────────────────────────────────────────────────────────

export function mount(store, navigate) {
  const objectifs = store.get('objectifs') || [];

  // Add buttons
  const openAdd = () => openObjectifModal(store, navigate);
  document.getElementById('btn-add-objectif')?.addEventListener('click', openAdd);
  document.getElementById('btn-add-objectif-empty')?.addEventListener('click', openAdd);

  // Edit / Delete
  document.querySelectorAll('[data-edit-objectif]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = objectifs.find(o => o.id === btn.dataset.editObjectif);
      if (item) openObjectifModal(store, navigate, item);
    });
  });

  document.querySelectorAll('[data-delete-objectif]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cet objectif ?')) {
        store.removeItem('objectifs', btn.dataset.deleteObjectif);
        navigate('objectifs');
      }
    });
  });

  // Charts
  if (objectifs.length > 0) {
    const withProgress = objectifs.map(obj => ({
      ...obj,
      progress: computeProgress(obj, store),
      status: getStatusInfo(computeProgress(obj, store).pct, obj.anneeObjectif)
    }));

    // Bar chart - progression
    if (document.getElementById('chart-objectifs-bar')) {
      const labels = withProgress.map(o => o.nom.length > 20 ? o.nom.slice(0, 18) + '…' : o.nom);
      const pcts = withProgress.map(o => o.progress.pct);
      const bgColors = withProgress.map(o => {
        if (o.progress.pct >= 100) return '#c9a76c';
        if (o.status.label === 'En retard') return '#ff4757';
        return '#dbb88a';
      });

      createChart('chart-objectifs-bar', {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Progression',
            data: pcts,
            backgroundColor: bgColors.map(c => c + 'cc'),
            borderColor: bgColors,
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 40
          }]
        },
        options: {
          indexAxis: 'y',
          scales: {
            x: {
              max: 100,
              grid: { color: COLORS.grid },
              ticks: { color: COLORS.gridText, callback: v => v + '%' }
            },
            y: {
              grid: { display: false },
              ticks: { color: COLORS.gridText, font: { size: 11 } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.raw.toFixed(1)}%`
              }
            }
          }
        }
      });
    }

    // Radar chart
    if (document.getElementById('chart-objectifs-radar') && withProgress.length >= 3) {
      const labels = withProgress.map(o => o.nom.length > 15 ? o.nom.slice(0, 13) + '…' : o.nom);
      const pcts = withProgress.map(o => Math.min(o.progress.pct, 100));

      createChart('chart-objectifs-radar', {
        type: 'radar',
        data: {
          labels,
          datasets: [{
            label: 'Progression',
            data: pcts,
            backgroundColor: 'rgba(201, 167, 108, 0.15)',
            borderColor: '#c9a76c',
            borderWidth: 2,
            pointBackgroundColor: withProgress.map(o => o.progress.pct >= 100 ? '#c9a76c' : '#dbb88a'),
            pointBorderColor: '#1a1a1f',
            pointBorderWidth: 2,
            pointRadius: 5
          }]
        },
        options: {
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              ticks: { display: false, stepSize: 25 },
              grid: { color: 'rgba(74, 74, 82, 0.3)' },
              angleLines: { color: 'rgba(74, 74, 82, 0.3)' },
              pointLabels: { color: '#9ca3af', font: { size: 11 } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.raw.toFixed(1)}%`
              }
            }
          }
        }
      });
    }
  }
}
