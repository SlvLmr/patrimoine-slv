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

  // Update active nav - dark theme
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
}

// Build sidebar navigation - dark theme
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
    a.download = `patrimoine-slv-${new Date().toISOString().slice(0, 10)}.json`;
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
    if (confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) {
      store.reset();
      renderPage();
    }
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initMobileMenu();
  initDataManagement();
  renderPage();
});

window.addEventListener('hashchange', renderPage);
