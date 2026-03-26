import { formatCurrency, openModal } from '../utils.js?v=5';

// ============================================================================
// HYPOTHÈSES — Plan théorique éditable
// ============================================================================

const DEFAULT_THEMES = [
  { id: 'investissement', label: 'Investissement', color: 'emerald', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'immobilier',     label: 'Immobilier',     color: 'amber',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'donation',       label: 'Donation',        color: 'purple',  icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
  { id: 'succession',     label: 'Succession',      color: 'blue',    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'retraite',       label: 'Retraite',        color: 'cyan',    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'fiscalite',      label: 'Fiscalité',       color: 'rose',    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
];

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

// ─── Timeline rendering ─────────────────────────────────────────────────────

function renderTimeline(hypotheses, themes) {
  if (hypotheses.length === 0) {
    return `
      <div class="card-dark rounded-2xl p-8 text-center border border-dark-400/20">
        <svg class="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-gray-500 text-sm">Aucune hypothèse pour le moment</p>
        <p class="text-gray-600 text-xs mt-1">Ajoute ta première hypothèse pour construire ta timeline</p>
      </div>`;
  }

  const sorted = [...hypotheses].sort((a, b) => (a.annee || 0) - (b.annee || 0));
  const themeMap = {};
  themes.forEach(t => { themeMap[t.id] = t; });

  const minYear = sorted[0].annee;
  const maxYear = sorted[sorted.length - 1].annee;
  const span = Math.max(maxYear - minYear, 1);

  // Group by year for stacking
  const yearGroups = {};
  sorted.forEach(h => {
    if (!yearGroups[h.annee]) yearGroups[h.annee] = [];
    yearGroups[h.annee].push(h);
  });

  const years = Object.keys(yearGroups).map(Number).sort((a, b) => a - b);

  return `
    <div class="card-dark rounded-2xl border border-dark-400/20 overflow-hidden">
      <div class="px-6 py-4 border-b border-dark-400/15 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Timeline
        </h2>
        <span class="text-xs text-gray-600">${minYear} — ${maxYear}</span>
      </div>
      <div class="p-6 overflow-x-auto scrollbar-hide">
        <div class="relative" style="min-width: ${Math.max(years.length * 120, 400)}px; height: 140px;">
          <!-- Main line -->
          <div class="absolute top-[60px] left-0 right-0 h-[2px] bg-gradient-to-r from-dark-400/20 via-dark-400/50 to-dark-400/20 rounded-full"></div>
          <div class="absolute top-[59px] left-0 right-0 h-[4px] hyp-timeline-glow rounded-full"></div>

          ${years.map((year, yi) => {
            const items = yearGroups[year];
            const pct = years.length === 1 ? 50 : (yi / (years.length - 1)) * 100;
            const leftPx = years.length === 1 ? '50%' : `${pct}%`;

            return `
              <div class="absolute flex flex-col items-center" style="left: ${leftPx}; transform: translateX(-50%); top: 0; width: 100px;">
                <!-- Year label -->
                <span class="text-[11px] font-bold text-gray-400 mb-2">${year}</span>

                <!-- Dots stack -->
                <div class="flex flex-col items-center gap-1.5">
                  ${items.map(item => {
                    const theme = themeMap[item.theme] || { color: 'emerald' };
                    const cc = c(theme.color);
                    return `
                      <button class="hyp-tl-dot group relative w-5 h-5 rounded-full ${cc.dot} ring-2 ${cc.ring} transition-all duration-200 hover:scale-125 hover:shadow-lg ${cc.glow} cursor-pointer" data-scroll-to="${item.id}" title="${item.titre}">
                        <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-dark-700 border border-dark-400/40 rounded-lg text-[10px] text-gray-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-10">
                          ${item.titre}${item.montant ? ` · ${formatCurrency(item.montant)}` : ''}
                        </span>
                      </button>`;
                  }).join('')}
                </div>

                <!-- Count label -->
                ${items.length > 1 ? `<span class="text-[9px] text-gray-600 mt-1">${items.length} hyp.</span>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Legend -->
      <div class="px-6 pb-4 flex flex-wrap gap-3">
        ${themes.filter(t => hypotheses.some(h => h.theme === t.id)).map(t => {
          const cc = c(t.color);
          return `<span class="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span class="w-2.5 h-2.5 rounded-full ${cc.dot}"></span>
            ${t.label}
          </span>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── Hypothesis card ─────────────────────────────────────────────────────────

function renderCard(item, themes) {
  const themeMap = {};
  themes.forEach(t => { themeMap[t.id] = t; });
  const theme = themeMap[item.theme] || { label: 'Autre', color: 'emerald', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' };
  const cc = c(theme.color);

  return `
    <div id="hyp-${item.id}" class="group rounded-xl border ${cc.border} ${cc.bg} transition-all duration-200 hover:shadow-lg overflow-hidden">
      <!-- Card header -->
      <div class="px-5 py-4 flex items-start gap-4">
        <!-- Theme icon -->
        <div class="flex-shrink-0 w-10 h-10 rounded-xl ${cc.bg} border ${cc.border} flex items-center justify-center mt-0.5">
          <svg class="w-5 h-5 ${cc.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${theme.icon}"/>
          </svg>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="text-xs font-semibold ${cc.text} px-2 py-0.5 rounded-full ${cc.bg} border ${cc.border}">${theme.label}</span>
            <span class="text-xs text-gray-500 font-medium">${item.annee}</span>
            ${item.montant ? `<span class="text-xs font-bold text-gray-300">${formatCurrency(item.montant)}</span>` : ''}
          </div>
          <h3 class="text-sm font-semibold text-gray-200 leading-snug">${item.titre}</h3>
          ${item.description ? `<p class="text-xs text-gray-500 mt-1.5 leading-relaxed">${item.description}</p>` : ''}
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button class="hyp-edit p-1.5 rounded-lg hover:bg-dark-600 text-gray-500 hover:text-accent-green transition" data-id="${item.id}" title="Modifier">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button class="hyp-delete p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition" data-id="${item.id}" title="Supprimer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
    </div>`;
}

// ─── Modal form HTML ─────────────────────────────────────────────────────────

function getFormHtml(themes, item = null) {
  const isEdit = !!item;
  return `
    <div class="space-y-4">
      <div>
        <label class="block text-xs text-gray-500 mb-1.5">Titre *</label>
        <input id="hyp-form-titre" type="text" value="${item?.titre || ''}" placeholder="Ex: Donation Sarkozy enfants"
          class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1.5">Année *</label>
          <input id="hyp-form-annee" type="number" min="2000" max="2100" value="${item?.annee || new Date().getFullYear()}"
            class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition"/>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1.5">Montant estimé</label>
          <div class="relative">
            <input id="hyp-form-montant" type="number" step="100" min="0" value="${item?.montant || ''}" placeholder="Optionnel"
              class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition pr-7 placeholder-gray-600"/>
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
      <div>
        <label class="block text-xs text-gray-500 mb-1.5">Description</label>
        <textarea id="hyp-form-desc" rows="3" placeholder="Notes, détails, conditions..."
          class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition resize-none placeholder-gray-600">${item?.description || ''}</textarea>
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
          <div class="flex items-center gap-3 bg-dark-800/50 rounded-lg px-3 py-2.5 group" data-theme-idx="${i}">
            <span class="w-4 h-4 rounded-full ${cc.dot} flex-shrink-0"></span>
            <input type="text" value="${t.label}" data-field="label"
              class="tm-label flex-1 bg-transparent border-b border-transparent hover:border-dark-400/50 focus:border-accent-green text-sm text-gray-200 focus:outline-none transition px-0 py-0" data-idx="${i}"/>
            <select data-field="color" data-idx="${i}"
              class="tm-color bg-dark-900 border border-dark-400/30 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-accent-green transition">
              ${ALL_COLORS.map(clr => `<option value="${clr}" ${t.color === clr ? 'selected' : ''}>${clr}</option>`).join('')}
            </select>
            <button class="tm-delete opacity-0 group-hover:opacity-100 text-red-400/40 hover:text-red-400 transition p-1" data-idx="${i}" title="Supprimer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>`;
      }).join('')}
      <button id="tm-add" class="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-accent-green border border-dashed border-dark-400/30 hover:border-accent-green/40 rounded-lg transition">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
        Ajouter un thème
      </button>
    </div>`;
}

// ─── Main render ─────────────────────────────────────────────────────────────

export function render(store) {
  const hypotheses = getHypotheses(store);
  const themes = getThemes(store);
  const sorted = [...hypotheses].sort((a, b) => (a.annee || 0) - (b.annee || 0));

  // Group by theme for display
  const themeMap = {};
  themes.forEach(t => { themeMap[t.id] = t; });

  return `
    <div class="max-w-4xl mx-auto space-y-6">
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
          <button id="btn-manage-themes" class="px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-gray-300 hover:bg-dark-600 border border-dark-400/20 hover:border-dark-400/40 transition flex items-center gap-1.5" title="Gérer les thèmes">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
            Thèmes
          </button>
          <button id="btn-add-hyp" class="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-accent-green to-accent-blue text-white hover:opacity-90 transition flex items-center gap-1.5 shadow-lg shadow-accent-green/10">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
            Ajouter
          </button>
        </div>
      </div>

      <!-- Timeline -->
      ${renderTimeline(sorted, themes)}

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
          : sorted.map(item => renderCard(item, themes)).join('')
        }
      </div>
    </div>`;
}

// ─── Mount (event handlers) ──────────────────────────────────────────────────

export function mount(store, navigate) {
  const themes = () => getThemes(store);

  function refresh() {
    const el = document.getElementById('app-content');
    if (el) { el.innerHTML = render(store); mount(store, navigate); }
  }

  // ── Add hypothesis
  document.getElementById('btn-add-hyp')?.addEventListener('click', () => {
    const modal = openModal('Nouvelle hypothèse', getFormHtml(themes()), () => {
      const titre = document.getElementById('hyp-form-titre')?.value.trim();
      const annee = parseInt(document.getElementById('hyp-form-annee')?.value) || new Date().getFullYear();
      const montant = parseFloat(document.getElementById('hyp-form-montant')?.value) || null;
      const theme = document.getElementById('hyp-form-theme')?.value || themes()[0]?.id;
      const description = document.getElementById('hyp-form-desc')?.value.trim();
      if (!titre) return;

      const items = getHypotheses(store);
      items.push({ id: generateId(), titre, annee, montant, theme, description });
      saveHypotheses(store, items);
      refresh();
    });
    mountThemeSelector(modal);
  });

  // ── Edit hypothesis
  document.querySelectorAll('.hyp-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const items = getHypotheses(store);
      const item = items.find(i => i.id === id);
      if (!item) return;

      const modal = openModal('Modifier l\'hypothèse', getFormHtml(themes(), item), () => {
        item.titre = document.getElementById('hyp-form-titre')?.value.trim() || item.titre;
        item.annee = parseInt(document.getElementById('hyp-form-annee')?.value) || item.annee;
        item.montant = parseFloat(document.getElementById('hyp-form-montant')?.value) || null;
        item.theme = document.getElementById('hyp-form-theme')?.value || item.theme;
        item.description = document.getElementById('hyp-form-desc')?.value.trim();
        saveHypotheses(store, items);
        refresh();
      });
      mountThemeSelector(modal);
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
      });
    });
  }, 50);
}
