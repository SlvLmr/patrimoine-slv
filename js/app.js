import { Store } from './store.js';
import { isConfigured, loadFirebaseSDK, onAuth, getCurrentUser, logout as firebaseLogout, testCloudConnection } from './firebase-config.js';
import { destroyAllCharts } from './charts/chart-config.js';
import { renderLoginScreen, mountLoginScreen, renderUserBar } from './components/auth.js';
import * as RevenusDepenses from './components/revenus-depenses.js?v=20260330a';
import * as Projection from './components/projection.js?v=20260401d';
import * as SuiviDepenses from './components/suivi-depenses.js?v=20260330a';
import * as PortefeuilleLive from './components/portefeuille-live.js';
import * as Compte from './components/compte.js?v=20260329h';
import * as Repartition from './components/repartition.js?v=20260331o';
import * as SimulateurFire from './components/simulateur-fire.js?v=20260330a';
import * as SimulateurCredit from './components/simulateur-credit.js?v=20260330a';
import * as SimulateurInterets from './components/simulateur-interets.js?v=20260330a';
import * as SimulateurAuto from './components/simulateur-auto.js?v=20260330a';
import * as SimulateurSalaire from './components/simulateur-salaire.js?v=20260330a';
import * as Hypotheses from './components/hypotheses.js?v=20260329b';
import * as SimulateurSuccession from './components/simulateur-succession.js?v=20260330a';
import { saveToDrive, isGdriveConfigured, setClientId } from './gdrive.js?v=20260329a';

// Auto-configure Google Drive Client ID
setClientId('594473713679-k6olf2a2ig455b7b6ilpjgq9anoircao.apps.googleusercontent.com');


const store = Store.init();

// Toast notification system — visible on mobile and desktop
function showToast(message, type = 'error', duration = 8000) {
  // Remove existing toast
  document.getElementById('sync-toast')?.remove();
  const colors = {
    error: 'bg-red-500/90 text-white',
    success: 'bg-accent-green/90 text-dark-900',
    warning: 'bg-amber-500/90 text-dark-900',
    info: 'bg-blue-500/90 text-white'
  };
  const toast = document.createElement('div');
  toast.id = 'sync-toast';
  toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-medium max-w-sm text-center ${colors[type] || colors.error}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
}

// Custom prompt modal (replaces native prompt())
function promptModal(title, defaultValue, onConfirm) {
  const existing = document.getElementById('app-prompt-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'app-prompt-modal';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-dark-700 rounded-2xl shadow-2xl w-full max-w-sm border border-dark-400/50">
      <div class="p-5 border-b border-dark-400/50">
        <h3 class="text-base font-semibold text-gray-100">${title}</h3>
      </div>
      <div class="p-5">
        <input id="prompt-input" type="text" value="${(defaultValue || '').replace(/"/g, '&quot;')}"
          class="w-full bg-dark-800 border border-dark-400/50 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:border-accent-green/50 focus:outline-none transition" autofocus />
      </div>
      <div class="p-4 border-t border-dark-400/50 flex justify-end gap-3">
        <button id="prompt-cancel" class="px-4 py-2 text-gray-400 hover:text-gray-200 transition rounded-lg hover:bg-dark-500 text-sm">Annuler</button>
        <button id="prompt-confirm" class="px-5 py-2 bg-gradient-to-r from-accent-green to-accent-blue text-white rounded-lg hover:opacity-90 transition font-medium text-sm">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const input = modal.querySelector('#prompt-input');
  input.focus();
  input.select();
  const close = () => modal.remove();
  const confirm = () => { const v = input.value; close(); if (v && v.trim()) onConfirm(v.trim()); };
  modal.querySelector('#prompt-cancel').addEventListener('click', close);
  modal.querySelector('#prompt-confirm').addEventListener('click', confirm);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); confirm(); } });
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

const routes = {
  'revenus-depenses': RevenusDepenses,
  'suivi-depenses': SuiviDepenses,
  'portefeuille-live': PortefeuilleLive,
  projection: Projection,
  repartition: Repartition,
  compte: Compte,
  'simulateur-fire': SimulateurFire,
  'simulateur-credit': SimulateurCredit,
  'simulateur-interets': SimulateurInterets,
  'simulateur-auto': SimulateurAuto,
  'simulateur-salaire': SimulateurSalaire,
  hypotheses: Hypotheses,
  'simulateur-succession': SimulateurSuccession,
};

const navItems = [
  { id: '_title_compte', sectionTitle: 'Compte' },
  { id: 'compte', label: '_profile_', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', isProfile: true },
  { id: '_title_quotidien', sectionTitle: 'Quotidien' },
  { id: 'revenus-depenses', label: 'Revenus & dépenses', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'suivi-depenses', label: 'Vie quotidienne', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: '_title_investissement', sectionTitle: 'Investissement' },
  { id: 'portefeuille-live', label: 'Portefeuille', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { id: 'repartition', label: 'Répartition', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { id: '_title_demain', sectionTitle: 'Demain' },
  { id: 'projection', label: 'Projection', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'hypotheses', label: 'Hypothèses', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { id: '_title_outils', sectionTitle: 'Outils', collapsible: true },
  { id: 'simulateur-interets', label: 'Intérêts composés', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', outilsGroup: true },
  { id: 'simulateur-succession', label: 'Cap Succession', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z', outilsGroup: true },
  { id: 'simulateur-fire', label: 'Simulateur FIRE', icon: 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z', outilsGroup: true },
  { id: 'simulateur-credit', label: 'Crédit immobilier', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2', outilsGroup: true },
  { id: 'simulateur-auto', label: 'Crédit voiture', icon: 'M5 17a2 2 0 104 0 2 2 0 00-4 0zm10 0a2 2 0 104 0 2 2 0 00-4 0zM3 9l2-5h14l2 5M3 9h18v6a1 1 0 01-1 1h-1a3 3 0 00-6 0H11a3 3 0 00-6 0H4a1 1 0 01-1-1V9z', outilsGroup: true },
  { id: 'simulateur-salaire', label: 'Salaire brut/net', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', outilsGroup: true },
];

let appStarted = false;
let _currentHash = '';
const SIMULATOR_PAGES = new Set([
  'simulateur-fire', 'simulateur-credit', 'simulateur-interets',
  'simulateur-auto', 'simulateur-salaire', 'simulateur-succession'
]);

const SIM_LABELS = {
  'simulateur-fire': 'FIRE',
  'simulateur-credit': 'Crédit immobilier',
  'simulateur-interets': 'Intérêts composés',
  'simulateur-auto': 'Crédit voiture',
  'simulateur-salaire': 'Salaire brut/net',
  'simulateur-succession': 'Cap Succession'
};

const SIM_SAVE_KEYS = {
  'simulateur-fire': 'sim-fire-saves',
  'simulateur-credit': 'sim-credit-saves',
  'simulateur-interets': 'sim-interets-saves',
  'simulateur-auto': 'sim-auto-saves',
  'simulateur-salaire': null, // no named saves
  'simulateur-succession': 'sim-succession-saves'
};

function showSimLeaveModal(fromPage, onContinue) {
  const existing = document.getElementById('sim-leave-modal');
  if (existing) existing.remove();

  const label = SIM_LABELS[fromPage] || 'Simulateur';
  const storageKey = SIM_SAVE_KEYS[fromPage];
  const canSave = !!storageKey;

  const modal = document.createElement('div');
  modal.id = 'sim-leave-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  modal.style.background = 'rgba(0,0,0,0.6)';
  modal.style.backdropFilter = 'blur(4px)';
  modal.style.animation = 'fadeIn 0.15s ease-out';
  modal.innerHTML = `
    <div class="card-dark rounded-2xl p-6 max-w-sm w-full border border-dark-400/30" style="animation: slideUp 0.2s ease-out">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-accent-green/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
          </svg>
        </div>
        <div>
          <h3 class="text-base font-semibold text-gray-100">Quitter ${label} ?</h3>
          <p class="text-xs text-gray-500 mt-0.5">Vos paramètres sont conservés automatiquement.</p>
        </div>
      </div>
      ${canSave ? `
      <p class="text-sm text-gray-400 mb-4">Souhaitez-vous sauvegarder votre simulation avant de quitter la page ?</p>
      <div class="flex gap-2 mb-4">
        <input id="sim-leave-name" type="text" class="input-field flex-1 text-sm" placeholder="Nom du scénario…" />
        <button id="sim-leave-save" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition whitespace-nowrap">Sauvegarder</button>
      </div>
      ` : ''}
      <div class="flex gap-2 justify-end">
        <button id="sim-leave-cancel" class="px-4 py-2 text-sm font-medium rounded-lg bg-dark-600 text-gray-300 hover:bg-dark-500 transition">Rester</button>
        <button id="sim-leave-go" class="px-4 py-2 text-sm font-medium rounded-lg bg-accent-green/15 text-accent-green hover:bg-accent-green/25 transition">Quitter</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Focus name input if present
  const nameInput = document.getElementById('sim-leave-name');
  nameInput?.focus();

  // Save scenario then leave
  document.getElementById('sim-leave-save')?.addEventListener('click', () => {
    const name = nameInput?.value?.trim();
    if (!name) { nameInput?.classList.add('ring-2', 'ring-accent-red/50'); return; }
    try {
      const saves = JSON.parse(localStorage.getItem(storageKey)) || [];
      // Get current inputs from the simulator's getInputs
      const component = routes[fromPage];
      if (component?.getInputs) {
        saves.push({ name, date: new Date().toISOString(), inputs: component.getInputs() });
      } else {
        // Fallback: collect all inputs from the page
        const inputs = {};
        document.querySelectorAll('#app-content input[type="number"], #app-content input[type="range"], #app-content select').forEach(el => {
          if (el.id) inputs[el.id] = el.value;
        });
        saves.push({ name, date: new Date().toISOString(), inputs });
      }
      localStorage.setItem(storageKey, JSON.stringify(saves));
    } catch (e) { console.error('Save error:', e); }
    modal.remove();
    onContinue();
  });

  // Enter key in name input = save
  nameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('sim-leave-save')?.click();
  });

  // Just leave
  document.getElementById('sim-leave-go').addEventListener('click', () => { modal.remove(); onContinue(); });

  // Stay
  document.getElementById('sim-leave-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function navigate(page) {
  // Close mobile sidebar on navigation
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
    sidebar.classList.add('-translate-x-full');
    overlay?.classList.add('hidden');
  }

  const current = window.location.hash.slice(1);

  // Show save prompt when leaving a simulator page
  if (SIMULATOR_PAGES.has(current) && page !== current) {
    showSimLeaveModal(current, () => {
      if (page && page === current) renderPage();
      else window.location.hash = page;
    });
    return;
  }

  if (page && page === current) {
    // Same page — re-render directly
    renderPage();
  } else {
    window.location.hash = page;
  }
}

function renderPage() {
  destroyAllCharts();

  let hash = window.location.hash.slice(1) || 'revenus-depenses';
  _currentHash = hash;
  // Redirect legacy routes
  if (hash === 'actifs' || hash === 'passifs' || hash === 'heritage') { hash = 'projection'; window.location.hash = 'projection'; return; }
  if (hash === 'dashboard') { hash = 'revenus-depenses'; window.location.hash = 'revenus-depenses'; return; }
  if (hash === 'enfants' || hash === 'fiscalite' || hash === 'objectifs' || hash === 'strategie') { hash = 'projection'; window.location.hash = 'projection'; return; }
  if (hash === 'projection-enfants') { hash = 'projection'; window.location.hash = 'projection'; store.set('_projTab', 'child-0'); return; }
  const component = routes[hash] || routes['revenus-depenses'];
  const contentEl = document.getElementById('app-content');

  contentEl.innerHTML = component.render(store);
  component.mount(store, navigate);

  // Update active nav
  document.querySelectorAll('[data-nav]').forEach(el => {
    const isActive = el.dataset.nav === hash;
    el.classList.toggle('bg-dark-600', isActive);
    el.classList.toggle('text-accent-green', isActive);
    el.classList.toggle('font-semibold', isActive);
    el.classList.toggle('text-gray-300', !isActive);
  });

  // Close mobile menu
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.add('-translate-x-full', 'lg:translate-x-0');
  if (overlay) overlay.classList.add('hidden');

  // Update profile display
  updateProfileDisplay();

  // Update profile name in nav
  const profileNavLabel = document.querySelector('.nav-profile-name');
  if (profileNavLabel) profileNavLabel.textContent = getProfileDisplayName();

  // Update user bar
  updateUserBar();
}


function getProfileDisplayName() {
  const state = store.getAll();
  const info = state.userInfo || {};
  const prenom = (info.prenom || '').trim();
  const nom = (info.nom || '').trim();
  if (prenom || nom) return [prenom, nom].filter(Boolean).join(' ');
  return 'Mon profil';
}

// Build sidebar navigation
function initNav() {
  const nav = document.getElementById('nav-links');
  let inOutilsGroup = false;
  nav.innerHTML = navItems.map(item => {
    if (item.sectionTitle) {
      if (item.collapsible) {
        inOutilsGroup = true;
        return `<div class="mt-3 mb-0.5 mx-3">
          <button id="outils-toggle" class="flex items-center gap-1.5 w-full text-left">
            <span class="section-title text-[10px] uppercase tracking-widest font-semibold text-gray-600">${item.sectionTitle}</span>
            <svg id="outils-chevron" class="w-3 h-3 text-gray-600 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
        </div>
        <div id="outils-items">`;
      }
      inOutilsGroup = false;
      return `<div class="section-title-wrap mt-3 mb-0.5 mx-3"><span class="section-title text-[10px] uppercase tracking-widest font-semibold text-gray-600">${item.sectionTitle}</span></div>`;
    }
    if (item.separator) {
      return `<div class="my-1.5 mx-3 h-px bg-gradient-to-r from-transparent via-dark-300/50 to-transparent"></div>`;
    }
    const label = item.isProfile ? getProfileDisplayName() : item.label;
    return `
    <a href="#${item.id}" data-nav="${item.id}"
      class="flex items-center gap-3 px-4 py-1.5 rounded-xl text-sm hover:bg-dark-600 hover:text-accent-green transition-colors text-gray-300">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${item.icon}"/>
      </svg>
      <span class="nav-label${item.isProfile ? ' nav-profile-name' : ''}">${label}</span>
      ${item.live ? '<span class="live-dot"></span>' : ''}
    </a>`;
  }).join('') + (inOutilsGroup ? '</div>' : '');

  // Intercept nav links so they go through navigate() (needed for sim leave prompt)
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.nav);
    });
  });

  // Outils toggle
  document.getElementById('outils-toggle')?.addEventListener('click', () => {
    const items = document.getElementById('outils-items');
    const chevron = document.getElementById('outils-chevron');
    if (items) {
      items.classList.toggle('hidden');
      chevron?.classList.toggle('rotate-180');
    }
  });
}

// Profile switcher
function updateProfileDisplay() {
  const el = document.getElementById('profile-name');
  if (el) {
    const profile = store.getActiveProfile();
    el.textContent = profile?.name || 'Mon patrimoine';
  }
}

// User bar (connected user info + logout)
function updateUserBar() {
  const container = document.getElementById('user-bar');
  if (!container) return;
  const user = getCurrentUser();
  if (user) {
    container.innerHTML = renderUserBar(user);
    container.style.cursor = 'pointer';
    container.addEventListener('click', () => navigate('compte'));
    // Show last sync time
    updateSyncStatus();
  } else {
    // Show login button (works whether Firebase is configured or not — setup flow handles unconfigured state)
    container.innerHTML = `
      <button id="btn-login-sidebar" class="w-full flex items-center gap-2 px-4 py-2 text-sm text-accent-blue hover:bg-dark-600 rounded-lg transition">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
        </svg>
        Se connecter
      </button>
    `;
    container.querySelector('#btn-login-sidebar')?.addEventListener('click', () => {
      showLoginScreen();
    });
  }
}

function updateSyncStatus(msg) {
  const el = document.getElementById('cloud-sync-status');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    return;
  }
  const { pending, failed } = store.getSyncStatus();
  if (failed) {
    el.innerHTML = `<svg class="w-3 h-3 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="text-red-400 cursor-pointer" id="retry-sync-btn">Erreur sync — Réessayer</span>`;
    el.querySelector('#retry-sync-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      el.innerHTML = `<span class="text-yellow-400 text-xs">Synchronisation...</span>`;
      const ok = await store.forceSyncToCloud();
      if (ok) {
        updateSyncStatus();
        renderPage();
      } else {
        updateSyncStatus();
      }
    });
    return;
  }
  if (pending > 0) {
    el.innerHTML = `<svg class="w-3 h-3 text-yellow-400 flex-shrink-0 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg><span class="text-yellow-400">Sauvegarde...</span>`;
    return;
  }
  const lastSync = localStorage.getItem('patrimoine-slv-last-sync');
  if (lastSync) {
    const time = new Date(lastSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `<svg class="w-3 h-3 text-accent-green/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg><span class="text-accent-green/60">Synchronisé</span><span class="text-gray-600">— ${time}</span>`;
  }
}

function initProfileSwitcher() {
  const container = document.getElementById('profile-switcher');
  if (!container) return;

  // Click on dropdown arrow → open dropdown
  document.getElementById('profile-dropdown-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = document.getElementById('profile-dropdown');
    if (existing) { existing.remove(); return; }

    const profiles = store.getProfiles();
    const active = store.getActiveProfile();

    const dropdown = document.createElement('div');
    dropdown.id = 'profile-dropdown';
    dropdown.className = 'absolute left-0 right-0 bottom-full mb-1 bg-dark-700 border border-dark-400 rounded-xl shadow-2xl z-50 overflow-hidden';
    dropdown.innerHTML = `
      <div class="max-h-48 overflow-y-auto">
        ${profiles.map(p => `
          <div class="flex items-center hover:bg-dark-600 transition group/prof">
            <button data-switch-profile="${p.id}"
              class="flex-1 text-left px-4 py-2.5 text-sm flex items-center justify-between ${p.id === active.id ? 'text-accent-green' : 'text-gray-300'}">
              <span>${p.name}</span>
              ${p.id === active.id ? '<span class="w-2 h-2 rounded-full bg-accent-green"></span>' : ''}
            </button>
            ${profiles.length > 1 ? `<button data-delete-profile="${p.id}" class="opacity-0 group-hover/prof:opacity-100 text-red-400/60 hover:text-red-400 px-3 py-2 transition" title="Supprimer">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>` : ''}
          </div>
        `).join('')}
      </div>
      <div class="border-t border-dark-400 space-y-0">
        <button id="btn-rename-profile" class="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Renommer le profil
        </button>
        <button id="btn-new-profile" class="w-full text-left px-4 py-2.5 text-sm text-accent-blue hover:bg-dark-600 transition flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Nouveau profil
        </button>
      </div>
      <div class="border-t border-dark-400 space-y-0">
        <button id="dd-export" class="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Exporter
        </button>
        <button id="dd-import" class="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          Importer
        </button>
        <button id="dd-logout" class="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Déconnexion
        </button>
      </div>
      <div class="border-t border-dark-400">
        <button id="dd-reset" class="w-full text-left px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          Réinitialiser
        </button>
      </div>
    `;

    container.appendChild(dropdown);

    // Switch profile
    dropdown.querySelectorAll('[data-switch-profile]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = btn.dataset.switchProfile;
        if (store.switchProfile(id)) {
          dropdown.remove();
          renderPage();
        }
      });
    });

    // Delete profile
    dropdown.querySelectorAll('[data-delete-profile]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = btn.dataset.deleteProfile;
        const prof = profiles.find(p => p.id === id);
        dropdown.remove();
        showConfirmModal({
          title: 'Supprimer le profil',
          message: `Le profil « ${prof?.name} » et toutes ses données seront supprimés définitivement.`,
          icon: 'danger',
          confirmLabel: 'Supprimer',
          confirmClass: 'bg-red-500 hover:bg-red-600',
          onConfirm: () => { if (store.deleteProfile(id)) renderPage(); }
        });
      });
    });

    // Rename profile
    dropdown.querySelector('#btn-rename-profile')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      dropdown.remove();
      promptModal('Renommer le profil', active.name, (newName) => {
        store.renameProfile(active.id, newName);
        updateProfileDisplay();
      });
    });

    // New profile
    dropdown.querySelector('#btn-new-profile')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      dropdown.remove();
      promptModal('Nom du nouveau profil', '', (name) => {
        const id = store.createProfile(name);
        store.switchProfile(id);
        renderPage();
      });
    });

    // Export
    dropdown.querySelector('#dd-export')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      dropdown.remove();
      exportLocal();
    });

    // Import
    dropdown.querySelector('#dd-import')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      dropdown.remove();
      importLocal();
    });

    // Reset
    dropdown.querySelector('#dd-reset')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const profile = store.getActiveProfile();
      dropdown.remove();
      showConfirmModal({
        title: 'Réinitialiser le profil',
        message: `Toutes les données du profil « ${profile.name} » seront supprimées. Cette action est irréversible.`,
        icon: 'danger',
        confirmLabel: 'Réinitialiser',
        confirmClass: 'bg-red-500 hover:bg-red-600',
        onConfirm: () => { store.reset(); renderPage(); }
      });
    });

    // Logout
    dropdown.querySelector('#dd-logout')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      dropdown.remove();
      showConfirmModal({
        title: 'Se déconnecter',
        message: 'Tes données locales seront conservées.',
        icon: 'info',
        confirmLabel: 'Déconnexion',
        confirmClass: 'bg-dark-500 hover:bg-dark-400',
        onConfirm: async () => { await firebaseLogout(); window.location.reload(); }
      });
    });

    // Close on outside click
    setTimeout(() => {
      const closeHandler = (ev) => {
        if (!dropdown.contains(ev.target) && !container.contains(ev.target)) {
          dropdown.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 10);
  });
}

// Initialize app title
function initLogo() {
  const logoContainer = document.getElementById('sidebar-logo');
  if (logoContainer) {
    logoContainer.innerHTML = `
      <div class="logo-with-bars" style="cursor:pointer">
        <span class="logo-bar logo-bar-left"></span>
        <h1 style="letter-spacing:-0.5px" class="logo-text text-4xl font-bold text-center logo-gradient-text logo-text-halo logo-heartbeat"><span style="font-family:'Bodoni Moda',Georgia,serif">H</span>orizon</h1>
        <span class="logo-bar logo-bar-right"></span>
      </div>
      <span style="font-family:'Bodoni Moda',Georgia,serif;cursor:pointer" class="logo-icon hidden text-2xl font-bold logo-gradient-text">H</span>
    `;
    logoContainer.style.cursor = 'pointer';
    logoContainer.addEventListener('click', () => navigate('revenus-depenses'));
  }
  // Mobile
  const mobileLogo = document.getElementById('mobile-logo');
  if (mobileLogo) {
    mobileLogo.innerHTML = `
      <div class="logo-with-bars logo-with-bars-sm">
        <span class="logo-bar logo-bar-left"></span>
        <span style="letter-spacing:-0.5px" class="text-lg font-bold logo-gradient-text logo-text-halo logo-heartbeat"><span style="font-family:'Bodoni Moda',Georgia,serif">H</span>orizon</span>
        <span class="logo-bar logo-bar-right"></span>
      </div>
    `;
  }
}

// Mobile menu toggle
function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
    overlay.classList.toggle('hidden');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  });
}

// Sidebar collapse toggle
function initSidebarCollapse() {
  const btn = document.getElementById('sidebar-collapse-btn');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');
  if (!btn || !sidebar) return;

  const applySidebarState = (collapsed) => {
    if (collapsed) {
      sidebar.classList.add('sidebar-collapsed');
      sidebar.classList.remove('w-64');
      if (mainContent) {
        mainContent.classList.remove('lg:ml-64');
        mainContent.classList.add('lg:ml-16');
      }
    } else {
      sidebar.classList.remove('sidebar-collapsed');
      sidebar.classList.add('w-64');
      if (mainContent) {
        mainContent.classList.remove('lg:ml-16');
        mainContent.classList.add('lg:ml-64');
      }
    }
  };

  // Restore collapsed state from localStorage
  const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
  if (isCollapsed) applySidebarState(true);

  btn.addEventListener('click', () => {
    const willCollapse = !sidebar.classList.contains('sidebar-collapsed');
    applySidebarState(willCollapse);
    localStorage.setItem('sidebar-collapsed', willCollapse);
  });
}

// --- Save/Import choice modals ---

function createChoiceModal(html) {
  const existing = document.getElementById('choice-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'choice-modal';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.innerHTML = `<div class="bg-dark-700 rounded-2xl shadow-2xl w-full max-w-md border border-dark-400/50 overflow-hidden">${html}</div>`;
  document.body.appendChild(modal);
  return modal;
}

function closeChoiceModal() {
  document.getElementById('choice-modal')?.remove();
}

function showConfirmModal({ title, message, icon, confirmLabel = 'Confirmer', confirmClass = 'bg-red-500 hover:bg-red-600', onConfirm }) {
  const modal = createChoiceModal(`
    <div class="p-6 text-center">
      <div class="mx-auto w-14 h-14 rounded-full ${icon === 'danger' ? 'bg-red-500/15' : 'bg-accent-green/15'} flex items-center justify-center mb-4">
        ${icon === 'danger' ? `<svg class="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`
        : `<svg class="w-7 h-7 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7"/></svg>`}
      </div>
      <h3 class="text-lg font-semibold text-gray-100 mb-2">${title}</h3>
      <p class="text-sm text-gray-400 mb-6">${message}</p>
      <div class="flex gap-3">
        <button id="confirm-cancel" class="flex-1 px-4 py-2.5 text-sm text-gray-400 hover:text-gray-200 bg-dark-600 hover:bg-dark-500 rounded-xl transition font-medium">Annuler</button>
        <button id="confirm-ok" class="flex-1 px-4 py-2.5 text-sm text-white ${confirmClass} rounded-xl transition font-medium">${confirmLabel}</button>
      </div>
    </div>
  `);
  modal.querySelector('#confirm-cancel')?.addEventListener('click', closeChoiceModal);
  modal.querySelector('#confirm-ok')?.addEventListener('click', () => {
    closeChoiceModal();
    onConfirm();
  });
  // Close on backdrop click
  modal.addEventListener('click', (e) => { if (e.target === modal) closeChoiceModal(); });
}

async function exportLocal() {
  const data = store.exportData();
  const profile = store.getActiveProfile();
  const filename = `patrimoine-${profile.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;

  // Save to Google Drive
  try {
    showToast('Export vers Google Drive en cours...', 'info', 3000);
    await saveToDrive(data, filename);
    showToast('Exporté sur Google Drive ✓', 'success', 4000);
  } catch (err) {
    console.error('Google Drive export error:', err);
    showToast('Erreur Drive : ' + err.message + ' — Téléchargement local à la place', 'error', 6000);
    // Fallback: local download
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}

function importLocal() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (store.importData(ev.target.result)) {
        renderPage();
      } else {
        alert('Erreur: fichier invalide.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}



// Show login screen (replaces the whole page)
function showLoginScreen() {
  // Hide sidebar and main content
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('sidebar-overlay').style.display = 'none';

  const mainContent = document.getElementById('main-content');
  mainContent.classList.remove('lg:ml-64');
  mainContent.querySelector('header')?.classList.add('hidden');

  const contentEl = document.getElementById('app-content');
  contentEl.className = '';
  contentEl.innerHTML = renderLoginScreen();

  mountLoginScreen(
    // onSuccess: user logged in
    async () => {
      // Prevent onAuth callback from doing a duplicate sync
      _loginSyncInProgress = true;

      // Show loading state
      const contentEl = document.getElementById('app-content');
      contentEl.innerHTML = `
        <div class="min-h-screen flex items-center justify-center">
          <div class="text-center space-y-4">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-green/10">
              <svg class="w-8 h-8 text-accent-green animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
              </svg>
            </div>
            <p id="sync-progress-msg" class="text-gray-400 text-sm">Test de la connexion cloud...</p>
          </div>
        </div>
      `;

      // Test Firestore connection first
      const user = getCurrentUser();
      const testResult = await testCloudConnection(user.uid);
      if (!testResult.ok) {
        showToast(testResult.error, 'error', 0); // persistent toast
        contentEl.querySelector('#sync-progress-msg').textContent = 'Erreur de connexion cloud';
        contentEl.querySelector('#sync-progress-msg').classList.add('text-red-400');
        // Still show the app after a delay so user isn't stuck
        setTimeout(() => { store.init(); showApp(); updateUserBar(); }, 3000);
        setTimeout(() => { _loginSyncInProgress = false; }, 4000);
        return;
      }

      contentEl.querySelector('#sync-progress-msg').textContent = 'Synchronisation de tes données...';

      // Sync from cloud
      const synced = await store.syncFromCloud();
      // Re-init the app
      store.init();
      showApp();
      updateUserBar();
      // Flush any saves made before login + start real-time sync
      store.flushPendingSync();
      store.startRealtimeSync(() => { renderPage(); updateSyncStatus(); });

      if (synced) {
        showToast('Données synchronisées !', 'success', 3000);
        updateSyncStatus();
      } else {
        // No cloud data found — push local data
        showToast('Aucune donnée cloud trouvée. Tes données locales seront sauvegardées.', 'info', 5000);
      }

      // Release the guard after a short delay (let onAuth fire and skip)
      setTimeout(() => { _loginSyncInProgress = false; }, 2000);
    },
    // onSkip: continue without account
    () => {
      showApp();
    }
  );
}


// Show the main app (after login or skip)
function showApp() {
  document.getElementById('sidebar').style.display = '';
  document.getElementById('sidebar-overlay').style.display = '';

  const mainContent = document.getElementById('main-content');
  mainContent.classList.add('lg:ml-64');
  mainContent.querySelector('header')?.classList.remove('hidden');

  const contentEl = document.getElementById('app-content');
  contentEl.className = 'p-4 sm:p-6 lg:p-8 max-w-7xl';

  if (!appStarted) {
    initLogo();
    initNav();
    initProfileSwitcher();
    initMobileMenu();
    initSidebarCollapse();
    appStarted = true;


  }

  renderPage();
}

// Guard to prevent double sync when login triggers both onSuccess and onAuth
let _loginSyncInProgress = false;

// Init
document.addEventListener('DOMContentLoaded', () => {
  // Track sync status changes to update the UI indicator
  store.onSyncStatusChange(() => {
    updateSyncStatus();
    // Show toast on sync failure (visible on mobile unlike sidebar indicator)
    const { failed } = store.getSyncStatus();
    if (failed) {
      showToast('Erreur de synchronisation cloud. Vérifie ta connexion.', 'error');
    }
  });

  // Always show the app immediately with local data (never leave user on blank page)
  showApp();

  if (isConfigured()) {
    // Load Firebase SDK in background, then handle auth
    loadFirebaseSDK().then(() => {
      onAuth(async (user) => {
        if (user) {
          // If login screen already triggered a sync, skip duplicate
          if (_loginSyncInProgress) {
            updateUserBar();
            return;
          }

          // Test Firestore connection on first auth
          const testResult = await testCloudConnection(user.uid);
          if (!testResult.ok) {
            showToast(testResult.error, 'error', 15000);
            updateUserBar();
            return;
          }

          const synced = await store.syncFromCloud();
          if (synced) {
            store.init();
            renderPage();
            showToast('Données synchronisées', 'success', 3000);
          }
          // Flush any saves made before Firebase was ready + start real-time sync
          store.flushPendingSync();
          store.startRealtimeSync(() => { renderPage(); updateSyncStatus(); });
          updateSyncStatus();
        } else {
          // No user — check if this is a new/empty device
          const s = store.getAll();
          const hasLocalData = (s.actifs?.immobilier?.length > 0) ||
                   (s.actifs?.placements?.length > 0) ||
                   (s.actifs?.epargne?.length > 0) ||
                   (s.revenus?.length > 0) ||
                   (s.depenses?.length > 0) ||
                   (s.userInfo?.prenom);

          if (!hasLocalData) {
            // New device with no data — show login screen directly
            showLoginScreen();
          }
        }
        updateUserBar();
      });
    }).catch(e => {
      console.warn('Firebase SDK failed to load:', e);
      showToast('Impossible de charger Firebase. Synchronisation désactivée.', 'warning', 10000);
    });

    // Re-sync from cloud when tab becomes visible again (e.g. switching PCs)
    document.addEventListener('visibilitychange', async () => {
      if (!appStarted) return;
      const user = getCurrentUser();

      if (document.visibilityState === 'hidden') {
        // Flush any pending debounced saves before the tab goes to background
        if (user) store.flushImmediateSync();
        return;
      }

      // Tab became visible — re-sync and restart listener
      if (!user) return;
      const lastSync = localStorage.getItem('patrimoine-slv-last-sync');
      if (lastSync) {
        const elapsed = Date.now() - new Date(lastSync).getTime();
        if (elapsed < 5000) return;
      }
      // Restart real-time listener (it may have been disconnected while backgrounded)
      store.startRealtimeSync(() => { renderPage(); updateSyncStatus(); });
      const synced = await store.syncFromCloud();
      if (synced) {
        store.init();
        renderPage();
        updateSyncStatus();
      }
    });

    // Flush pending saves when the page is about to unload
    window.addEventListener('pagehide', () => {
      store.flushImmediateSync();
    });
  }
});

window.addEventListener('hashchange', () => {
  if (appStarted) renderPage();
});
