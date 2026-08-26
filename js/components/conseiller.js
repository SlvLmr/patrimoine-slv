import { getConseilsTransmission } from './hypotheses.js?v=20260808f';
import { getConseilsLiberte } from './liberte.js?v=20260808f';
import { getConseilsContrats } from './contrats.js?v=20260808f';

// ============================================================
// LE CONSEILLER — le tableau de bord des décisions : agrège les
// recommandations de Transmission, Liberté financière et
// Contrats & garanties, sans les retirer de leurs pages.
// ============================================================

const SOURCES = [
  {
    id: 'liberte', nav: 'liberte', titre: 'Liberté financière & fiscalité',
    icon: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
    get: getConseilsLiberte,
  },
  {
    id: 'transmission', nav: 'hypotheses', titre: 'Transmission',
    icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
    get: getConseilsTransmission,
  },
  {
    id: 'contrats', nav: 'contrats', titre: 'Contrats & garanties',
    icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    get: getConseilsContrats,
  },
];

function prioStyle(prio) {
  return prio === 1 ? { border: 'border-red-500/25', bg: 'bg-red-500/5', text: 'text-red-400', label: 'Prioritaire' }
    : prio === 2 ? { border: 'border-amber-500/25', bg: 'bg-amber-500/5', text: 'text-amber-400', label: 'Important' }
    : { border: 'border-blue-500/20', bg: 'bg-blue-500/5', text: 'text-blue-400', label: 'Optimisation' };
}

function carte(r, sourceTitre = null) {
  const st = prioStyle(r.prio);
  return `<div class="rounded-lg ${st.bg} border ${st.border} px-3.5 py-3">
    <div class="flex items-start justify-between gap-2">
      <p class="text-xs font-semibold ${st.text}">${r.titre}</p>
      ${sourceTitre ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-dark-600/70 text-gray-500 flex-shrink-0 whitespace-nowrap">${sourceTitre}</span>` : ''}
    </div>
    <p class="text-[11px] text-gray-400 mt-1 leading-relaxed">${r.texte}</p>
  </div>`;
}

export function render(store) {
  // Collecte des conseils de chaque univers
  const sections = SOURCES.map(src => {
    let conseils = [];
    try { conseils = src.get(store) || []; } catch (e) { conseils = []; }
    return { ...src, conseils };
  });

  const tous = sections.flatMap(sec => sec.conseils.map(r => ({ ...r, source: sec.titre })));
  const nb1 = tous.filter(r => r.prio === 1).length;
  const nb2 = tous.filter(r => r.prio === 2).length;
  const top = [...tous].sort((a, b) => a.prio - b.prio).slice(0, 3);

  return `
    <div class="space-y-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-100">Le conseiller</h1>
          <p class="text-xs text-gray-500">Toutes tes recommandations, un seul endroit — ${tous.length} conseil${tous.length > 1 ? 's' : ''}${nb1 > 0 ? ` · <span class="text-red-400 font-semibold">${nb1} prioritaire${nb1 > 1 ? 's' : ''}</span>` : ''}${nb2 > 0 ? ` · <span class="text-amber-400 font-semibold">${nb2} important${nb2 > 1 ? 's' : ''}</span>` : ''}</p>
        </div>
      </div>

      ${top.length > 0 ? `
      <!-- ═ À FAIRE EN PREMIER ═ -->
      <div class="card-dark rounded-xl p-5 border border-indigo-500/15">
        <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider mb-3">À regarder en premier</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          ${top.map(r => carte(r, r.source)).join('')}
        </div>
      </div>` : ''}

      <!-- ═ PAR UNIVERS ═ -->
      ${sections.map(sec => `
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${sec.icon}"/></svg>
            <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider">${sec.titre}</h2>
            <span class="text-[10px] text-gray-600">${sec.conseils.length} conseil${sec.conseils.length > 1 ? 's' : ''}</span>
          </div>
          <button class="cons-nav btn-ghost" data-nav-to="${sec.nav}">Ouvrir la page →</button>
        </div>
        ${sec.conseils.length > 0
          ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-2">${sec.conseils.map(r => carte(r)).join('')}</div>`
          : '<p class="text-xs text-gray-600">Rien à signaler pour le moment.</p>'}
      </div>`).join('')}

      <p class="text-[10px] text-gray-600 text-center">Les conseils restent aussi affichés dans leurs pages respectives, avec leur contexte complet.</p>
    </div>
  `;
}

export function mount(store, navigate) {
  document.querySelectorAll('.cons-nav').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.navTo));
  });
}
