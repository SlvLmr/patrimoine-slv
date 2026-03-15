import { isConfigured, login, register, resetPassword, logout, getCurrentUser } from '../firebase-config.js';

function renderLoginScreen() {
  return `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="logo-with-bars logo-with-bars-lg justify-center mb-3">
            <span class="logo-bar logo-bar-left"></span>
            <h1 class="text-3xl font-bold logo-gradient-text logo-text-halo logo-heartbeat" style="letter-spacing:-0.5px"><span style="font-family:'Bodoni Moda',Georgia,serif">H</span>orizon</h1>
            <span class="logo-bar logo-bar-right"></span>
          </div>
          <p class="text-gray-500 text-sm">Simulateur patrimonial</p>
        </div>

        ${renderAuthCard()}
      </div>
    </div>
  `;
}

function renderAuthCard() {
  return `
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
        <div class="text-center mt-3">
          <button type="button" id="forgot-password-link" class="text-xs text-gray-500 hover:text-accent-green transition cursor-pointer">
            Mot de passe oublié ?
          </button>
        </div>
      </form>

      <!-- Forgot password form (hidden) -->
      <form id="forgot-password-form" class="space-y-4 hidden">
        <p class="text-sm text-gray-400 mb-2">Entre ton adresse email pour recevoir un lien de réinitialisation.</p>
        <div>
          <label class="block text-sm text-gray-400 mb-1.5">Email</label>
          <input type="email" id="reset-email" required
            class="w-full bg-dark-800 border border-dark-400/30 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green/40 transition"
            placeholder="ton@email.com">
        </div>
        <button type="submit" id="reset-btn"
          class="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-accent-green to-accent-amber text-dark-900 hover:opacity-90 transition flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          Envoyer le lien
        </button>
        <div class="text-center">
          <button type="button" id="back-to-login-link" class="text-xs text-gray-500 hover:text-accent-green transition cursor-pointer">
            Retour à la connexion
          </button>
        </div>
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
  `;
}

function mountLoginScreen(onSuccess, onSkip) {
  // Skip
  document.getElementById('auth-skip')?.addEventListener('click', onSkip);

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
      document.getElementById('forgot-password-form').classList.add('hidden');
      hideMessages();
    });
  });

  // Forgot password link
  document.getElementById('forgot-password-link')?.addEventListener('click', () => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.remove('hidden');
    document.getElementById('auth-tabs').classList.add('hidden');
    // Pre-fill email if already typed
    const loginEmail = document.getElementById('login-email').value.trim();
    if (loginEmail) document.getElementById('reset-email').value = loginEmail;
    hideMessages();
  });

  // Back to login from forgot password
  document.getElementById('back-to-login-link')?.addEventListener('click', () => {
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('auth-tabs').classList.remove('hidden');
    // Re-activate login tab
    document.querySelectorAll('.auth-tab').forEach(t => {
      t.classList.remove('bg-dark-600', 'text-accent-green');
      t.classList.add('text-gray-400');
    });
    document.querySelector('[data-tab="login"]').classList.add('bg-dark-600', 'text-accent-green');
    document.querySelector('[data-tab="login"]').classList.remove('text-gray-400');
    hideMessages();
  });

  // Forgot password submit
  document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    const btn = document.getElementById('reset-btn');

    hideMessages();
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-pulse">Envoi...</span>';

    try {
      await resetPassword(email);
      showSuccess('Un email de réinitialisation a été envoyé. Vérifie ta boîte de réception.');
    } catch (err) {
      showError(getFirebaseErrorMessage(err.code));
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> Envoyer le lien`;
    }
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
}

function showError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function showSuccess(msg) {
  const el = document.getElementById('auth-success');
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
    <div class="px-4 py-3 space-y-1 hover:bg-dark-700 transition rounded-lg cursor-pointer">
      <div class="flex items-center gap-2 text-xs text-gray-400">
        <div class="w-5 h-5 rounded-full bg-accent-green/20 flex items-center justify-center flex-shrink-0">
          <svg class="w-3 h-3 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <span class="truncate flex-1">${user.email}</span>
      </div>
      <div id="cloud-sync-status" class="flex items-center gap-2 text-xs text-gray-600 pl-7"></div>
    </div>
  `;
}

export { renderLoginScreen, mountLoginScreen, renderUserBar, logout };
