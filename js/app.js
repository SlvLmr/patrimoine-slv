import { Store } from './store.js';
import { destroyAllCharts } from './charts/chart-config.js';
import * as Dashboard from './components/dashboard.js';
import * as Heritage from './components/heritage.js';
import * as Actifs from './components/actifs.js';
import * as Passifs from './components/passifs.js';
import * as RevenusDepenses from './components/revenus-depenses.js';
import * as Projection from './components/projection.js';
import * as Fiscalite from './components/fiscalite.js';

const store = Store.init();

const routes = {
  dashboard: Dashboard,
  heritage: Heritage,
  actifs: Actifs,
  passifs: Passifs,
  'revenus-depenses': RevenusDepenses,
  projection: Projection,
  fiscalite: Fiscalite
};

const navItems = [
  { id: 'dashboard', label: 'Tableau de bord', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { id: 'heritage', label: 'Héritage', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'actifs', label: 'Actifs', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'passifs', label: 'Passifs', icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' },
  { id: 'revenus-depenses', label: 'Revenus & Dépenses', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'projection', label: 'Projection', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'fiscalite', label: 'Fiscalité', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' }
];

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
}

// Logo SVG
function getLogo() {
  return `
    <svg viewBox="0 0 40 40" class="w-9 h-9" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logo-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#00d4aa"/>
          <stop offset="100%" style="stop-color:#5b7fff"/>
        </linearGradient>
        <linearGradient id="logo-grad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#a855f7"/>
          <stop offset="100%" style="stop-color:#ec4899"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="#161631" stroke="url(#logo-grad1)" stroke-width="2"/>
      <path d="M12 28 L12 18 L16 14 L20 20 L24 12 L28 16 L28 28" fill="url(#logo-grad1)" fill-opacity="0.2" stroke="url(#logo-grad1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 24 L17 19 L21 22 L28 15" stroke="url(#logo-grad2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="28" cy="15" r="2.5" fill="url(#logo-grad2)"/>
      <circle cx="12" cy="24" r="2" fill="url(#logo-grad1)"/>
    </svg>
  `;
}

// Build sidebar navigation
function initNav() {
  const nav = document.getElementById('nav-links');
  nav.innerHTML = navItems.map(item => `
    <a href="#${item.id}" data-nav="${item.id}"
      class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm hover:bg-dark-600 hover:text-accent-green transition-colors text-gray-300">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${item.icon}"/>
      </svg>
      <span>${item.label}</span>
    </a>
  `).join('');
}

// Profile switcher
function updateProfileDisplay() {
  const el = document.getElementById('profile-name');
  if (el) {
    const profile = store.getActiveProfile();
    el.textContent = profile?.name || 'Mon patrimoine';
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
      <div class="border-t border-dark-400">
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

// Initialize logo
function initLogo() {
  const logoContainer = document.getElementById('sidebar-logo');
  if (logoContainer) {
    logoContainer.innerHTML = `
      <div class="flex items-center gap-3">
        ${getLogo()}
        <div>
          <h1 class="text-lg font-bold bg-gradient-to-r from-accent-green to-accent-blue bg-clip-text text-transparent">Patrimoine SLV</h1>
          <p class="text-xs text-gray-500">Simulateur patrimonial</p>
        </div>
      </div>
    `;
  }
  // Mobile logo
  const mobileLogo = document.getElementById('mobile-logo');
  if (mobileLogo) {
    mobileLogo.innerHTML = `
      <div class="flex items-center gap-2">
        <svg viewBox="0 0 40 40" class="w-7 h-7" fill="none">
          <defs>
            <linearGradient id="mlogo-g1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#00d4aa"/><stop offset="100%" style="stop-color:#5b7fff"/>
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="36" height="36" rx="10" fill="#161631" stroke="url(#mlogo-g1)" stroke-width="2"/>
          <path d="M12 28 L12 18 L16 14 L20 20 L24 12 L28 16 L28 28" fill="url(#mlogo-g1)" fill-opacity="0.2" stroke="url(#mlogo-g1)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="text-lg font-bold bg-gradient-to-r from-accent-green to-accent-blue bg-clip-text text-transparent">Patrimoine SLV</span>
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

// Init
document.addEventListener('DOMContentLoaded', () => {
  initLogo();
  initNav();
  initProfileSwitcher();
  initMobileMenu();
  initDataManagement();
  renderPage();
});

window.addEventListener('hashchange', renderPage);
