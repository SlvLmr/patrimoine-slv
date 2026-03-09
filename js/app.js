import { Store } from './store.js';
import { isConfigured, onAuth, getCurrentUser, logout as firebaseLogout } from './firebase-config.js';
import { destroyAllCharts } from './charts/chart-config.js';
import { renderLoginScreen, mountLoginScreen, renderUserBar } from './components/auth.js';
import * as Dashboard from './components/dashboard.js';
import * as Heritage from './components/heritage.js';
import * as Actifs from './components/actifs.js';
import * as Passifs from './components/passifs.js';
import * as RevenusDepenses from './components/revenus-depenses.js';
import * as Projection from './components/projection.js';
import * as Fiscalite from './components/fiscalite.js';
import * as Enfants from './components/enfants.js';
import * as SuiviDepenses from './components/suivi-depenses.js';
import * as Bourse from './components/bourse.js';

const store = Store.init();

const routes = {
  dashboard: Dashboard,
  heritage: Heritage,
  actifs: Actifs,
  passifs: Passifs,
  'revenus-depenses': RevenusDepenses,
  'suivi-depenses': SuiviDepenses,
  projection: Projection,
  bourse: Bourse,
  fiscalite: Fiscalite,
  enfants: Enfants
};

const navItems = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'bourse', label: 'Bourse Live', icon: 'M3 3v18h18M9 17V9m4 8V5m4 12v-4', live: true },
  { id: '_title_quotidien', sectionTitle: 'Quotidien' },
  { id: 'revenus-depenses', label: 'Revenus et dépenses', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'suivi-depenses', label: 'Suivi de dépenses', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { id: '_title_patrimoine', sectionTitle: 'Patrimoine' },
  { id: 'actifs', label: 'Actifs', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'passifs', label: 'Passifs', icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' },
  { id: 'heritage', label: 'Héritage', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: '_title_demain', sectionTitle: 'Demain' },
  { id: 'projection', label: 'Projection', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'fiscalite', label: 'Fiscalité', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { id: 'enfants', label: 'Enfants', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' }
];

let appStarted = false;

function navigate(page) {
  window.location.hash = page;
}

function renderPage() {
  destroyAllCharts();

  const hash = window.location.hash.slice(1) || 'dashboard';
  const component = routes[hash] || routes.dashboard;
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

  // Update user bar
  updateUserBar();
}


// Build sidebar navigation
function initNav() {
  const nav = document.getElementById('nav-links');
  nav.innerHTML = navItems.map(item => {
    if (item.sectionTitle) {
      return `<div class="mt-4 mb-1.5 mx-3"><span class="text-[10px] uppercase tracking-widest font-semibold text-gray-600">${item.sectionTitle}</span></div>`;
    }
    if (item.separator) {
      return `<div class="my-1.5 mx-3 h-px bg-gradient-to-r from-transparent via-dark-300/50 to-transparent"></div>`;
    }
    return `
    <a href="#${item.id}" data-nav="${item.id}"
      class="flex items-center gap-3 px-4 py-2 rounded-xl text-sm hover:bg-dark-600 hover:text-accent-green transition-colors text-gray-300">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${item.icon}"/>
      </svg>
      <span>${item.label}</span>
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
    container.querySelector('#btn-logout')?.addEventListener('click', async () => {
      if (confirm('Se déconnecter ? Tes données locales seront conservées.')) {
        await firebaseLogout();
        window.location.reload();
      }
    });
  } else {
    // Show login button if Firebase is configured but user not logged in
    if (isConfigured()) {
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
    } else {
      container.innerHTML = '';
    }
  }
}

function initProfileSwitcher() {
  const container = document.getElementById('profile-switcher');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const existing = document.getElementById('profile-dropdown');
    if (existing) { existing.remove(); return; }

    const profiles = store.getProfiles();
    const active = store.getActiveProfile();

    const dropdown = document.createElement('div');
    dropdown.id = 'profile-dropdown';
    dropdown.className = 'absolute left-0 right-0 top-full mt-1 bg-dark-700 border border-dark-400 rounded-xl shadow-2xl z-50 overflow-hidden';
    dropdown.innerHTML = `
      <div class="max-h-48 overflow-y-auto">
        ${profiles.map(p => `
          <button data-switch-profile="${p.id}"
            class="w-full text-left px-4 py-2.5 text-sm hover:bg-dark-600 transition flex items-center justify-between ${p.id === active.id ? 'text-accent-green' : 'text-gray-300'}">
            <span>${p.name}</span>
            ${p.id === active.id ? '<span class="w-2 h-2 rounded-full bg-accent-green"></span>' : ''}
          </button>
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
      <div class="flex items-center gap-3">
        <div class="logo-halo w-10 h-10 rounded-xl bg-gradient-to-br from-accent-green to-accent-amber flex items-center justify-center flex-shrink-0 relative">
          <span class="logo-symbol text-dark-900 font-bold text-lg select-none" style="font-family:'Space Grotesk',sans-serif"></span>
        </div>
        <h1 style="font-family:'Space Grotesk',sans-serif;letter-spacing:-1px" class="text-2xl font-bold bg-gradient-to-r from-accent-green via-accent-cyan to-accent-amber bg-clip-text text-transparent logo-text-halo">Horizon</h1>
      </div>
    `;
    // Cycle currency symbols
    const symbols = ['€', '$', '₿', '¥', '£'];
    let idx = 0;
    const symbolEl = logoContainer.querySelector('.logo-symbol');
    if (symbolEl) {
      symbolEl.textContent = symbols[0];
      setInterval(() => {
        idx = (idx + 1) % symbols.length;
        symbolEl.style.opacity = '0';
        setTimeout(() => {
          symbolEl.textContent = symbols[idx];
          symbolEl.style.opacity = '1';
        }, 200);
      }, 2500);
    }
  }
  // Mobile
  const mobileLogo = document.getElementById('mobile-logo');
  if (mobileLogo) {
    mobileLogo.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="logo-halo w-8 h-8 rounded-lg bg-gradient-to-br from-accent-green to-accent-amber flex items-center justify-center flex-shrink-0">
          <span class="text-dark-900 font-bold text-sm select-none" style="font-family:'Space Grotesk',sans-serif">€</span>
        </div>
        <span style="font-family:'Space Grotesk',sans-serif;letter-spacing:-0.5px" class="text-lg font-bold bg-gradient-to-r from-accent-green via-accent-cyan to-accent-amber bg-clip-text text-transparent logo-text-halo">Horizon</span>
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

// Data management
function initDataManagement() {
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const data = store.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const profile = store.getActiveProfile();
    a.download = `patrimoine-${profile.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-import')?.addEventListener('click', () => {
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
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    const profile = store.getActiveProfile();
    if (confirm(`Réinitialiser le profil "${profile.name}" ? Cette action est irréversible.`)) {
      store.reset();
      renderPage();
    }
  });
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
      // Sync from cloud
      const synced = await store.syncFromCloud();
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
    initDataManagement();
    appStarted = true;
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
        store.init();
        showApp();
      } else {
        // Not logged in — show login screen
        showLoginScreen();
      }
    });
  } else {
    // No Firebase — go straight to app (local only)
    showApp();
  }
});

window.addEventListener('hashchange', () => {
  if (appStarted) renderPage();
});
