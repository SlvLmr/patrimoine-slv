import { Store } from './store.js';
import { isConfigured, onAuth, getCurrentUser, logout as firebaseLogout } from './firebase-config.js';
import { destroyAllCharts } from './charts/chart-config.js';
import { renderLoginScreen, mountLoginScreen, renderUserBar } from './components/auth.js';
import * as Heritage from './components/heritage.js';
import * as RevenusDepenses from './components/revenus-depenses.js';
import * as Projection from './components/projection.js?v=5';
import * as Fiscalite from './components/fiscalite.js';
import * as Enfants from './components/enfants.js';
import * as SuiviDepenses from './components/suivi-depenses.js';
import * as PortefeuilleLive from './components/portefeuille-live.js';
import * as Bourse from './components/bourse.js';
import * as Reel from './components/reel.js';
import { isGdriveConfigured, setClientId, saveToDrive, listDriveFiles, loadFromDrive } from './gdrive.js';

const store = Store.init();

const routes = {
  heritage: Heritage,
  'revenus-depenses': RevenusDepenses,
  'suivi-depenses': SuiviDepenses,
  'portefeuille-live': PortefeuilleLive,
  projection: Projection,
  reel: Reel,
  bourse: Bourse,
  fiscalite: Fiscalite,
  enfants: Enfants
};

const navItems = [
  { id: '_title_quotidien', sectionTitle: 'Quotidien' },
  { id: 'revenus-depenses', label: 'Revenus et dépenses', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'suivi-depenses', label: 'Quotidien Live', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'portefeuille-live', label: 'Portefeuille Live', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { id: 'bourse', label: 'Bourse Live', icon: 'M3 3v18h18M9 17V9m4 8V5m4 12v-4' },
  { id: '_title_demain', sectionTitle: 'Demain' },
  { id: 'projection', label: 'Projection', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'reel', label: 'Réel', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'fiscalite', label: 'Donations', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
  { id: 'enfants', label: 'Enfants', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' }
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

  // Update user bar
  updateUserBar();
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
    return `
    <a href="#${item.id}" data-nav="${item.id}"
      class="flex items-center gap-3 px-4 py-2 rounded-xl text-sm hover:bg-dark-600 hover:text-accent-green transition-colors text-gray-300">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${item.icon}"/>
      </svg>
      <span class="nav-label">${item.label}</span>
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
        const profile = profiles.find(p => p.id === id);
        if (confirm(`Êtes-vous sûr de vouloir supprimer le profil "${profile?.name}" ? Cette action est irréversible.`)) {
          if (store.deleteProfile(id)) {
            dropdown.remove();
            renderPage();
          }
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
      <h1 style="font-family:'Space Grotesk',sans-serif;letter-spacing:-1.5px" class="logo-text text-4xl font-bold text-center bg-gradient-to-r from-accent-green via-accent-cyan to-accent-amber bg-clip-text text-transparent logo-text-halo logo-heartbeat">Horizon</h1>
      <span style="font-family:'Space Grotesk',sans-serif" class="logo-icon hidden text-2xl font-bold bg-gradient-to-r from-accent-green to-accent-amber bg-clip-text text-transparent">H</span>
    `;
  }
  // Mobile
  const mobileLogo = document.getElementById('mobile-logo');
  if (mobileLogo) {
    mobileLogo.innerHTML = `
      <span style="font-family:'Space Grotesk',sans-serif;letter-spacing:-0.5px" class="text-lg font-bold bg-gradient-to-r from-accent-green via-accent-cyan to-accent-amber bg-clip-text text-transparent logo-text-halo logo-heartbeat">Horizon</span>
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

async function exportToDrive() {
  if (!isGdriveConfigured()) {
    promptGdriveSetup(() => exportToDrive());
    return;
  }
  const profile = store.getActiveProfile();
  const filename = `patrimoine-${profile.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  const data = store.exportData();
  const statusEl = document.getElementById('gdrive-status');
  if (statusEl) { statusEl.textContent = 'Envoi en cours...'; statusEl.className = 'text-sm text-accent-amber mt-3 text-center'; }
  try {
    await saveToDrive(data, filename);
    if (statusEl) { statusEl.textContent = 'Sauvegardé sur Google Drive !'; statusEl.className = 'text-sm text-accent-green mt-3 text-center'; }
    setTimeout(closeChoiceModal, 1500);
  } catch (err) {
    console.error('Google Drive save error:', err);
    if (statusEl) { statusEl.textContent = 'Erreur : ' + err.message; statusEl.className = 'text-sm text-red-400 mt-3 text-center'; }
  }
}

async function importFromDrive() {
  if (!isGdriveConfigured()) {
    promptGdriveSetup(() => importFromDrive());
    return;
  }
  const statusEl = document.getElementById('gdrive-status');
  if (statusEl) { statusEl.textContent = 'Chargement...'; statusEl.className = 'text-sm text-accent-amber mt-3 text-center'; }
  try {
    const files = await listDriveFiles();
    if (!files.length) {
      if (statusEl) { statusEl.textContent = 'Aucun fichier trouvé sur Drive.'; statusEl.className = 'text-sm text-gray-400 mt-3 text-center'; }
      return;
    }
    // Show file picker
    closeChoiceModal();
    showDriveFilePicker(files);
  } catch (err) {
    console.error('Google Drive list error:', err);
    if (statusEl) { statusEl.textContent = 'Erreur : ' + err.message; statusEl.className = 'text-sm text-red-400 mt-3 text-center'; }
  }
}

function showDriveFilePicker(files) {
  const modal = createChoiceModal(`
    <div class="p-6 border-b border-dark-400/50">
      <h3 class="text-lg font-semibold text-gray-100">Importer depuis Google Drive</h3>
      <p class="text-xs text-gray-500 mt-1">Dossier : Patrimoine SLV</p>
    </div>
    <div class="p-4 space-y-2 max-h-64 overflow-y-auto">
      ${files.map(f => `
        <button class="gdrive-pick-file w-full text-left px-4 py-3 rounded-lg hover:bg-dark-500 transition flex items-center justify-between" data-id="${f.id}">
          <div>
            <p class="text-sm font-medium text-gray-200">${f.name}</p>
            <p class="text-xs text-gray-500">${new Date(f.modifiedTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
        </button>
      `).join('')}
    </div>
    <div class="p-4 border-t border-dark-400/50">
      <button id="gdrive-picker-cancel" class="w-full px-4 py-2 text-gray-400 hover:text-gray-200 transition rounded-lg hover:bg-dark-500 text-sm">Annuler</button>
    </div>
  `);

  modal.querySelector('#gdrive-picker-cancel')?.addEventListener('click', closeChoiceModal);
  modal.querySelectorAll('.gdrive-pick-file').forEach(btn => {
    btn.addEventListener('click', async () => {
      const fileId = btn.dataset.id;
      btn.innerHTML = '<span class="text-sm text-accent-amber">Chargement...</span>';
      try {
        const json = await loadFromDrive(fileId);
        if (store.importData(json)) {
          closeChoiceModal();
          renderPage();
        } else {
          alert('Erreur: fichier invalide.');
        }
      } catch (err) {
        alert('Erreur: ' + err.message);
      }
    });
  });
}

function promptGdriveSetup(onDone) {
  closeChoiceModal();
  const modal = createChoiceModal(`
    <div class="p-6 border-b border-dark-400/50">
      <h3 class="text-lg font-semibold text-gray-100">Configurer Google Drive</h3>
    </div>
    <div class="p-6 space-y-4">
      <p class="text-sm text-gray-400">Pour utiliser Google Drive, entre ton <strong class="text-gray-200">Client ID Google OAuth</strong>.</p>
      <p class="text-xs text-gray-500">Crée un projet sur <span class="text-accent-amber">console.cloud.google.com</span>, active l'API Drive et crée un ID client OAuth (type Web).</p>
      <input id="input-gdrive-clientid" type="text" placeholder="xxxxx.apps.googleusercontent.com" class="w-full bg-dark-800 border border-dark-400/50 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
      <div id="gdrive-setup-error" class="text-sm text-red-400 hidden"></div>
    </div>
    <div class="p-4 border-t border-dark-400/50 flex gap-3">
      <button id="gdrive-setup-cancel" class="flex-1 px-4 py-2 text-gray-400 hover:text-gray-200 transition rounded-lg hover:bg-dark-500 text-sm">Annuler</button>
      <button id="gdrive-setup-save" class="flex-1 px-4 py-2 bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 text-sm rounded-lg hover:opacity-90 transition font-medium">Enregistrer</button>
    </div>
  `);

  modal.querySelector('#gdrive-setup-cancel')?.addEventListener('click', closeChoiceModal);
  modal.querySelector('#gdrive-setup-save')?.addEventListener('click', () => {
    const val = modal.querySelector('#input-gdrive-clientid')?.value?.trim();
    if (!val || !val.includes('.apps.googleusercontent.com')) {
      const err = modal.querySelector('#gdrive-setup-error');
      if (err) { err.textContent = 'Client ID invalide.'; err.classList.remove('hidden'); }
      return;
    }
    setClientId(val);
    closeChoiceModal();
    if (onDone) onDone();
  });
}

function showSaveChoiceModal() {
  const modal = createChoiceModal(`
    <div class="p-6 border-b border-dark-400/50">
      <h3 class="text-lg font-semibold text-gray-100">Sauvegarder</h3>
      <p class="text-xs text-gray-500 mt-1">Choisis où enregistrer tes données</p>
    </div>
    <div class="p-4 space-y-2">
      <button id="save-local" class="w-full flex items-center gap-4 px-5 py-4 rounded-xl hover:bg-dark-500 transition text-left">
        <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-200">Fichier local (JSON)</p>
          <p class="text-xs text-gray-500">Télécharge sur ton ordinateur</p>
        </div>
      </button>
      <button id="save-gdrive" class="w-full flex items-center gap-4 px-5 py-4 rounded-xl hover:bg-dark-500 transition text-left">
        <div class="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.433 22l3.069-5.32h12.932l-3.069 5.32H4.433zm7.065-12.283L4.49 22.001 1.42 16.68 8.427 4.397l3.07 5.32zm1.07-1.846L15.636 2h6.14l-7.009 12.154-3.199-6.283z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-200">Google Drive</p>
          <p class="text-xs text-gray-500">${isGdriveConfigured() ? 'Dossier : Patrimoine SLV' : 'Configuration requise'}</p>
        </div>
      </button>
      <div id="gdrive-status"></div>
    </div>
    <div class="p-4 border-t border-dark-400/50">
      <button id="save-cancel" class="w-full px-4 py-2 text-gray-400 hover:text-gray-200 transition rounded-lg hover:bg-dark-500 text-sm">Annuler</button>
    </div>
  `);

  modal.querySelector('#save-cancel')?.addEventListener('click', closeChoiceModal);
  modal.querySelector('#save-local')?.addEventListener('click', () => { closeChoiceModal(); exportLocal(); });
  modal.querySelector('#save-gdrive')?.addEventListener('click', () => exportToDrive());
}

function showImportChoiceModal() {
  const modal = createChoiceModal(`
    <div class="p-6 border-b border-dark-400/50">
      <h3 class="text-lg font-semibold text-gray-100">Importer</h3>
      <p class="text-xs text-gray-500 mt-1">Choisis d'où charger tes données</p>
    </div>
    <div class="p-4 space-y-2">
      <button id="import-local" class="w-full flex items-center gap-4 px-5 py-4 rounded-xl hover:bg-dark-500 transition text-left">
        <div class="w-10 h-10 rounded-lg bg-accent-green/20 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-200">Fichier local (JSON)</p>
          <p class="text-xs text-gray-500">Depuis ton ordinateur</p>
        </div>
      </button>
      <button id="import-gdrive" class="w-full flex items-center gap-4 px-5 py-4 rounded-xl hover:bg-dark-500 transition text-left">
        <div class="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.433 22l3.069-5.32h12.932l-3.069 5.32H4.433zm7.065-12.283L4.49 22.001 1.42 16.68 8.427 4.397l3.07 5.32zm1.07-1.846L15.636 2h6.14l-7.009 12.154-3.199-6.283z"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-200">Google Drive</p>
          <p class="text-xs text-gray-500">${isGdriveConfigured() ? 'Dossier : Patrimoine SLV' : 'Configuration requise'}</p>
        </div>
      </button>
      <div id="gdrive-status"></div>
    </div>
    <div class="p-4 border-t border-dark-400/50">
      <button id="import-cancel" class="w-full px-4 py-2 text-gray-400 hover:text-gray-200 transition rounded-lg hover:bg-dark-500 text-sm">Annuler</button>
    </div>
  `);

  modal.querySelector('#import-cancel')?.addEventListener('click', closeChoiceModal);
  modal.querySelector('#import-local')?.addEventListener('click', () => { closeChoiceModal(); importLocal(); });
  modal.querySelector('#import-gdrive')?.addEventListener('click', () => importFromDrive());
}

// Data management
function initDataManagement() {
  // --- Export ---
  document.getElementById('btn-export')?.addEventListener('click', () => {
    showSaveChoiceModal();
  });

  // --- Import ---
  document.getElementById('btn-import')?.addEventListener('click', () => {
    showImportChoiceModal();
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
    initDataManagement();
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
