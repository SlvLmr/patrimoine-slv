import { getConseilsTransmission } from './hypotheses.js?v=20260809m';
import { getConseilsLiberte } from './liberte.js?v=20260809m';
import { getConseilsContrats } from './contrats.js?v=20260809m';

// ============================================================
// LE CONSEILLER — le tableau de bord des décisions : agrège les
// recommandations de Transmission, Liberté financière et
// Contrats & garanties, sans les retirer de leurs pages.
// ============================================================

const SOURCES = [
  {
    id: 'liberte', nav: 'liberte', titre: 'Liberté financière & fiscalité', court: 'Liberté',
    accent: '#fb923c',
    icon: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
    get: getConseilsLiberte,
  },
  {
    id: 'transmission', nav: 'hypotheses', titre: 'Transmission', court: 'Transmission',
    accent: '#c084fc',
    icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
    get: getConseilsTransmission,
  },
  {
    id: 'contrats', nav: 'contrats', titre: 'Contrats & garanties', court: 'Protection',
    accent: '#34d399',
    icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    get: getConseilsContrats,
  },
];

const PRIO = {
  1: { color: '#f87171', label: 'Prioritaire', text: 'text-red-400', bg: 'bg-red-500/10' },
  2: { color: '#fbbf24', label: 'Important', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  3: { color: '#60a5fa', label: 'Optimisation', text: 'text-blue-400', bg: 'bg-blue-500/10' },
};

function badgePrio(prio) {
  const p = PRIO[prio] || PRIO[3];
  return `<span class="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider ${p.text} ${p.bg} px-2 py-0.5 rounded-full">
    <span class="w-1.5 h-1.5 rounded-full" style="background:${p.color}"></span>${p.label}
  </span>`;
}

function carteConseil(r, src) {
  const p = PRIO[r.prio] || PRIO[3];
  return `
  <button class="cons-nav group text-left rounded-xl bg-dark-800/60 border border-dark-400/20 hover:border-dark-300/40 hover:bg-dark-700/60 transition-all px-4 py-3.5 relative overflow-hidden" data-nav-to="${src.nav}">
    <span class="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style="background:${p.color};opacity:0.7"></span>
    <div class="flex items-center gap-2 mb-1.5">
      ${badgePrio(r.prio)}
    </div>
    <p class="text-sm font-semibold text-gray-100 leading-snug">${r.titre}</p>
    <p class="text-[11px] text-gray-400 mt-1.5 leading-relaxed">${r.texte}</p>
    <span class="absolute right-3 top-3.5 text-gray-600 group-hover:text-gray-300 group-hover:translate-x-0.5 transition-all">
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </span>
  </button>`;
}

export function render(store) {
  const sections = SOURCES.map(src => {
    let conseils = [];
    try { conseils = src.get(store) || []; } catch (e) { conseils = []; }
    return { ...src, conseils };
  });

  const tous = sections.flatMap(sec => sec.conseils.map(r => ({ ...r, src: sec })));
  const nb1 = tous.filter(r => r.prio === 1).length;
  const nb2 = tous.filter(r => r.prio === 2).length;
  const nb3 = tous.filter(r => r.prio === 3).length;
  const top = [...tous].sort((a, b) => a.prio - b.prio).slice(0, 3);

  return `
    <div class="space-y-6">
      <!-- ═ HÉRO ═ -->
      <div class="card-dark rounded-xl overflow-hidden" style="background: linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(26,26,34,0) 45%, rgba(168,85,247,0.06) 100%);">
        <div class="p-5 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div class="flex items-center gap-3 flex-1">
              <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-purple-500/25 flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>
                </svg>
              </div>
              <div>
                <h1 class="text-xl font-bold text-gray-100">Conseiller Horizon</h1>
                <p class="text-xs text-gray-500 mt-0.5">${tous.length} recommandation${tous.length > 1 ? 's' : ''} générée${tous.length > 1 ? 's' : ''} depuis tes chiffres réels — mises à jour en continu</p>
              </div>
            </div>
            <div class="flex gap-2">
              <div class="rounded-xl px-4 py-2.5 text-center border ${nb1 > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-dark-400/20 bg-dark-800/40'}">
                <p class="text-lg font-extrabold ${nb1 > 0 ? 'text-red-400' : 'text-gray-600'} leading-none">${nb1}</p>
                <p class="text-[9px] uppercase tracking-wider ${nb1 > 0 ? 'text-red-400/70' : 'text-gray-600'} mt-1">à traiter</p>
              </div>
              <div class="rounded-xl px-4 py-2.5 text-center border ${nb2 > 0 ? 'border-amber-500/30 bg-amber-500/10' : 'border-dark-400/20 bg-dark-800/40'}">
                <p class="text-lg font-extrabold ${nb2 > 0 ? 'text-amber-400' : 'text-gray-600'} leading-none">${nb2}</p>
                <p class="text-[9px] uppercase tracking-wider ${nb2 > 0 ? 'text-amber-400/70' : 'text-gray-600'} mt-1">à surveiller</p>
              </div>
              <div class="rounded-xl px-4 py-2.5 text-center border ${nb3 > 0 ? 'border-blue-500/30 bg-blue-500/10' : 'border-dark-400/20 bg-dark-800/40'}">
                <p class="text-lg font-extrabold ${nb3 > 0 ? 'text-blue-400' : 'text-gray-600'} leading-none">${nb3}</p>
                <p class="text-[9px] uppercase tracking-wider ${nb3 > 0 ? 'text-blue-400/70' : 'text-gray-600'} mt-1">optimisations</p>
              </div>
            </div>
          </div>

          ${top.length > 0 ? `
          <div class="mt-6">
            <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2.5">⚡ À regarder en premier</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              ${top.map((r, i) => {
                const p = PRIO[r.prio] || PRIO[3];
                return `
              <button class="cons-nav group text-left rounded-xl border border-dark-400/25 hover:border-dark-300/50 transition-all p-4 relative overflow-hidden" data-nav-to="${r.src.nav}"
                style="background: linear-gradient(160deg, ${p.color}14 0%, rgba(26,26,34,0.4) 55%);">
                <span class="absolute -right-2 -top-4 text-[64px] font-black leading-none select-none" style="color:${p.color};opacity:0.09">${i + 1}</span>
                <div class="flex items-center gap-2 mb-2">
                  ${badgePrio(r.prio)}
                  <span class="inline-flex items-center gap-1 text-[9px] text-gray-500 bg-dark-600/60 px-2 py-0.5 rounded-full">
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${r.src.icon}"/></svg>
                    ${r.src.court}
                  </span>
                </div>
                <p class="text-sm font-bold text-gray-100 leading-snug pr-4">${r.titre}</p>
                <p class="text-[11px] text-gray-400 mt-1.5 leading-relaxed">${r.texte.length > 150 ? r.texte.slice(0, 150) + '…' : r.texte}</p>
                <p class="text-[10px] font-medium mt-2.5 group-hover:translate-x-0.5 transition-transform" style="color:${p.color}">Voir dans ${r.src.court} →</p>
              </button>`;
              }).join('')}
            </div>
          </div>` : ''}
        </div>
      </div>

      <!-- ═ PAR UNIVERS ═ -->
      ${sections.map(sec => `
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-3.5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:${sec.accent}1c">
              <svg class="w-4 h-4" style="color:${sec.accent}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${sec.icon}"/></svg>
            </div>
            <div>
              <h2 class="text-sm font-bold text-gray-100">${sec.titre}</h2>
              <p class="text-[10px] text-gray-600">${sec.conseils.length} conseil${sec.conseils.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button class="cons-nav btn-secondary" data-nav-to="${sec.nav}">Ouvrir <span style="color:${sec.accent}">→</span></button>
        </div>
        ${sec.conseils.length > 0
          ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">${sec.conseils.map(r => carteConseil(r, sec)).join('')}</div>`
          : `<div class="rounded-xl border border-dashed border-dark-400/30 px-4 py-5 text-center">
              <p class="text-xs text-gray-500">Rien à signaler pour le moment ✓</p>
            </div>`}
      </div>`).join('')}

      <p class="text-[10px] text-gray-600 text-center pb-2">Chaque carte est cliquable et t'amène à la page concernée, où le conseil vit avec son contexte complet.</p>
    </div>
  `;
}

export function mount(store, navigate) {
  document.querySelectorAll('.cons-nav').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.navTo));
  });
}
