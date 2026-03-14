import { Store } from './store.js';
import { isConfigured, onAuth, getCurrentUser, logout as firebaseLogout } from './firebase-config.js';
import { destroyAllCharts } from './charts/chart-config.js';
import { renderLoginScreen, mountLoginScreen, renderUserBar } from './components/auth.js';
import * as Heritage from './components/heritage.js';
import * as RevenusDepenses from './components/revenus-depenses.js';
import * as Projection from './components/projection.js?v=5';
import * as Fiscalite from './components/fiscalite.js';
import * as SuiviDepenses from './components/suivi-depenses.js';
import * as PortefeuilleLive from './components/portefeuille-live.js';
import * as Bourse from './components/bourse.js';
import * as Compte from './components/compte.js';
import * as Objectifs from './components/objectifs.js';
import * as Repartition from './components/repartition.js';

const store = Store.init();

const routes = {
  heritage: Heritage,
  'revenus-depenses': RevenusDepenses,
  'suivi-depenses': SuiviDepenses,
  'portefeuille-live': PortefeuilleLive,
  projection: Projection,
  repartition: Repartition,

  bourse: Bourse,
  fiscalite: Fiscalite,
  objectifs: Objectifs,
  compte: Compte
};

const navItems = [
  { id: '_title_compte', sectionTitle: 'Compte' },
  { id: 'compte', label: '_profile_', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', isProfile: true },
  { id: '_title_quotidien', sectionTitle: 'Quotidien' },
  { id: 'revenus-depenses', label: 'Revenus & Dépenses', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'suivi-depenses', label: 'Vie quotidienne', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: '_title_investissement', sectionTitle: 'Investissement' },
  { id: 'portefeuille-live', label: 'Portefeuille', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { id: 'repartition', label: 'Répartition', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
  { id: 'bourse', label: 'Bourse', icon: 'M3 3v18h18M9 17V9m4 8V5m4 12v-4' },
  { id: '_title_demain', sectionTitle: 'Demain' },
  { id: 'projection', label: 'Projection', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: '_title_outils', sectionTitle: 'Outils' },
  { id: 'objectifs', label: 'Objectifs', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' }
];

let appStarted = false;

function navigate(page) {
  const current = window.location.hash.slice(1);
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
  // Redirect legacy routes
  if (hash === 'actifs' || hash === 'passifs' || hash === 'heritage') { hash = 'projection'; window.location.hash = 'projection'; return; }
  if (hash === 'dashboard') { hash = 'revenus-depenses'; window.location.hash = 'revenus-depenses'; return; }
  if (hash === 'enfants') { hash = 'fiscalite'; window.location.hash = 'fiscalite'; return; }
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
  nav.innerHTML = navItems.map(item => {
    if (item.sectionTitle) {
      return `<div class="section-title-wrap mt-4 mb-1.5 mx-3"><span class="section-title text-[10px] uppercase tracking-widest font-semibold text-gray-600">${item.sectionTitle}</span></div>`;
    }
    if (item.separator) {
      return `<div class="my-1.5 mx-3 h-px bg-gradient-to-r from-transparent via-dark-300/50 to-transparent"></div>`;
    }
    const label = item.isProfile ? getProfileDisplayName() : item.label;
    return `
    <a href="#${item.id}" data-nav="${item.id}"
      class="flex items-center gap-3 px-4 py-2 rounded-xl text-sm hover:bg-dark-600 hover:text-accent-green transition-colors text-gray-300">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${item.icon}"/>
      </svg>
      <span class="nav-label${item.isProfile ? ' nav-profile-name' : ''}">${label}</span>
      ${item.live ? '<span class="live-dot"></span>' : ''}
    </a>`;
  }).join('');
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
      const newName = prompt('Nouveau nom du profil :', active.name);
      if (newName && newName.trim()) {
        store.renameProfile(active.id, newName.trim());
        dropdown.remove();
        updateProfileDisplay();
      }
    });

    // New profile
    dropdown.querySelector('#btn-new-profile')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const name = prompt('Nom du nouveau profil :');
      if (name && name.trim()) {
        const id = store.createProfile(name.trim());
        store.switchProfile(id);
        dropdown.remove();
        renderPage();
      }
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

function exportLocal() {
  const data = store.exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const profile = store.getActiveProfile();
  a.download = `patrimoine-${profile.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
            <p class="text-gray-400 text-sm">Synchronisation de tes données...</p>
          </div>
        </div>
      `;
      // Sync from cloud
      await store.syncFromCloud();
      // Re-init the app
      store.init();
      showApp();
    },
    // onSkip: continue without account
    () => {
      showApp();
    }
  );
}

// Background Bourse refresh scheduler
let bourseTimerId = null;
function scheduleBourseRefresh() {
  if (bourseTimerId) clearTimeout(bourseTimerId);
  const next = Bourse.getNextRefreshTime();
  const delay = Math.max(next.getTime() - Date.now(), 60000); // min 1 min
  bourseTimerId = setTimeout(async () => {
    try { await Bourse.backgroundRefresh(); } catch (e) { console.warn('Bourse background refresh failed:', e); }
    scheduleBourseRefresh(); // schedule next
  }, delay);
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

    // Start background Bourse refresh & do initial fetch
    Bourse.backgroundRefresh().catch(() => {});
    scheduleBourseRefresh();
  }

  renderPage();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  if (isConfigured()) {
    // Firebase is configured: check auth state
    onAuth(async (user) => {
      if (user) {
        // Already logged in — sync and show app
        await store.syncFromCloud();
        localStorage.setItem('patrimoine-slv-last-sync', new Date().toISOString());
        store.init();
        showApp();
      } else {
        // Not logged in — show login screen
        showLoginScreen();
      }
    });
  } else {
    // No Firebase configured — go straight to app (local only)
    showApp();
  }
});

window.addEventListener('hashchange', () => {
  if (appStarted) renderPage();
});
