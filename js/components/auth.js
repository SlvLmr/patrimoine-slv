import { isConfigured, login, register, logout, getCurrentUser } from '../firebase-config.js';

function renderLoginScreen() {
  return `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center gap-3 mb-3">
            <svg viewBox="0 0 28 28" class="w-8 h-8" fill="none">
              <defs>
                <linearGradient id="auth-logo" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#c9a76c"/>
                  <stop offset="100%" stop-color="#dbb88a"/>
                </linearGradient>
              </defs>
              <path d="M3 20 Q7 20 10 14 T17 8 Q20 6 25 4" stroke="url(#auth-logo)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
              <circle cx="25" cy="4" r="2" fill="#dbb88a"/>
            </svg>
            <h1 style="font-family:'Space Grotesk',sans-serif;letter-spacing:-0.5px" class="text-3xl font-bold bg-gradient-to-r from-accent-green via-accent-cyan to-accent-amber bg-clip-text text-transparent">
              Horizon
            </h1>
          </div>
          <p class="text-gray-500 text-sm">Simulateur patrimonial</p>
        </div>

        <!-- Auth card -->
        <div class="card-dark rounded-2xl p-8">
          <div id="auth-tabs" class="flex mb-6 bg-dark-800 rounded-xl p-1">
            <button data-tab="login" class="auth-tab flex-1 py-2.5 text-sm font-medium rounded-lg transition-all bg-dark-600 text-accent-green">
              Connexion
            </button>
            <button data-tab="register" class="auth-tab flex-1 py-2.5 text-sm font-medium rounded-lg transition-all text-gray-400 hover:text-gray-200">
              Inscription
            </button>
          </div>

          <div id="auth-error" class="hidden mb-4 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm"></div>
          <div id="auth-success" class="hidden mb-4 p-3 rounded-lg bg-accent-green/10 border border-accent-green/20 text-accent-green text-sm"></div>

          <!-- Login form -->
          <form id="login-form" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Email</label>
              <input type="email" id="login-email" required
                class="w-full bg-dark-800 border border-dark-400/30 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green/40 transition"
                placeholder="ton@email.com">
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Mot de passe</label>
              <input type="password" id="login-password" required minlength="6"
                class="w-full bg-dark-800 border border-dark-400/30 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green/40 transition"
                placeholder="••••••••">
            </div>
            <button type="submit" id="login-btn"
              class="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 hover:opacity-90 transition flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
              </svg>
              Se connecter
            </button>
          </form>

          <!-- Register form (hidden) -->
          <form id="register-form" class="space-y-4 hidden">
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Email</label>
              <input type="email" id="register-email" required
                class="w-full bg-dark-800 border border-dark-400/30 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green/40 transition"
                placeholder="ton@email.com">
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Mot de passe</label>
              <input type="password" id="register-password" required minlength="6"
                class="w-full bg-dark-800 border border-dark-400/30 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green/40 transition"
                placeholder="6 caractères minimum">
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">Confirmer le mot de passe</label>
              <input type="password" id="register-password-confirm" required minlength="6"
                class="w-full bg-dark-800 border border-dark-400/30 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green/40 transition"
                placeholder="••••••••">
            </div>
            <button type="submit" id="register-btn"
              class="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 hover:opacity-90 transition flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
              </svg>
              Créer mon compte
            </button>
          </form>
        </div>

        <!-- Skip option -->
        <div class="text-center mt-6">
          <button id="auth-skip" class="text-sm text-gray-500 hover:text-gray-300 transition underline underline-offset-4">
            Continuer sans compte (données locales uniquement)
          </button>
        </div>
      </div>
    </div>
  `;
}

function mountLoginScreen(onSuccess, onSkip) {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('bg-dark-600', 'text-accent-green');
        t.classList.add('text-gray-400');
      });
      tab.classList.add('bg-dark-600', 'text-accent-green');
      tab.classList.remove('text-gray-400');

      document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
      document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
      hideMessages();
    });
  });

  // Login
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    hideMessages();
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-pulse">Connexion...</span>';

    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      showError(getFirebaseErrorMessage(err.code));
      btn.disabled = false;
      btn.innerHTML = 'Se connecter';
    }
  });

  // Register
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-password-confirm').value;
    const btn = document.getElementById('register-btn');

    hideMessages();

    if (password !== confirm) {
      showError('Les mots de passe ne correspondent pas.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="animate-pulse">Création...</span>';

    try {
      await register(email, password);
      onSuccess();
    } catch (err) {
      showError(getFirebaseErrorMessage(err.code));
      btn.disabled = false;
      btn.innerHTML = 'Créer mon compte';
    }
  });

  // Skip
  document.getElementById('auth-skip')?.addEventListener('click', onSkip);
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function hideMessages() {
  document.getElementById('auth-error')?.classList.add('hidden');
  document.getElementById('auth-success')?.classList.add('hidden');
}

function getFirebaseErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/invalid-email': 'Email invalide.',
    'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
    'auth/user-not-found': 'Aucun compte trouvé avec cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/too-many-requests': 'Trop de tentatives. Réessaie plus tard.',
    'auth/network-request-failed': 'Erreur réseau. Vérifie ta connexion.',
  };
  return messages[code] || `Erreur d'authentification (${code || 'inconnue'}).`;
}

// User bar component for sidebar
function renderUserBar(user) {
  if (!user) return '';
  return `
    <div class="flex items-center gap-2 px-4 py-2 text-xs text-gray-500">
      <svg class="w-3.5 h-3.5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      <span class="truncate">${user.email}</span>
    </div>
    <button id="btn-logout" class="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-accent-red hover:bg-red-500/10 rounded-lg transition">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
      </svg>
      Déconnexion
    </button>
  `;
}

export { renderLoginScreen, mountLoginScreen, renderUserBar, logout };
