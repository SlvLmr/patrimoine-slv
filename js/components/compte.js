import { getCurrentUser } from '../firebase-config.js';

function getUserInfo(store) {
  return store.get('userInfo') || { prenom: '', nom: '', telephone: '', dateNaissance: '', photo: '' };
}

function getParametres(store) {
  return store.get('parametres') || {};
}

function computeAge(dateNaissance) {
  if (!dateNaissance) return null;
  return Math.floor((Date.now() - new Date(dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export function render(store) {
  const info = getUserInfo(store);
  const params = getParametres(store);
  const user = getCurrentUser();
  const email = user?.email || '';
  const age = computeAge(info.dateNaissance);
  const initials = (info.prenom?.[0] || email?.[0] || '?').toUpperCase();

  const situationOptions = [
    { value: 'celibataire', label: 'Célibataire' },
    { value: 'marie', label: 'Marié(e)' },
    { value: 'pacse', label: 'Pacsé(e)' },
    { value: 'divorce', label: 'Divorcé(e)' },
    { value: 'veuf', label: 'Veuf/Veuve' }
  ];

  return `
    <div class="max-w-2xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-4 mb-2">
        <div class="relative group">
          <label for="photo-upload" class="cursor-pointer block">
            ${info.photo
              ? `<img src="${info.photo}" alt="Photo" class="w-20 h-20 rounded-full object-cover border-2 border-dark-400 group-hover:border-accent-green transition"/>`
              : `<div class="w-20 h-20 rounded-full bg-dark-600 border-2 border-dark-400 group-hover:border-accent-green transition flex items-center justify-center">
                  <span class="text-2xl font-bold text-gray-400">${initials}</span>
                </div>`
            }
            <div class="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
          </label>
          <input type="file" id="photo-upload" accept="image/*" class="hidden"/>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-100">${info.prenom || info.nom ? `${info.prenom} ${info.nom}`.trim() : 'Mon compte'}</h1>
          <p class="text-sm text-gray-500">${email}</p>
          ${age !== null ? `<p class="text-xs text-gray-600 mt-0.5">${age} ans</p>` : ''}
        </div>
      </div>

      <!-- Informations personnelles -->
      <div class="bg-dark-700 rounded-2xl border border-dark-400/30 overflow-hidden">
        <div class="px-6 py-4 border-b border-dark-400/20">
          <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider">Informations personnelles</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Prénom</label>
              <input id="info-prenom" type="text" value="${info.prenom || ''}" placeholder="Ton prénom"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Nom</label>
              <input id="info-nom" type="text" value="${info.nom || ''}" placeholder="Ton nom"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Date de naissance</label>
              <input id="info-dob" type="date" value="${info.dateNaissance || ''}"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition"/>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Téléphone</label>
              <input id="info-tel" type="tel" value="${info.telephone || ''}" placeholder="06 12 34 56 78"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition placeholder-gray-600"/>
            </div>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1.5">Email</label>
            <div class="w-full bg-dark-800/50 border border-dark-400/30 rounded-xl px-4 py-2.5 text-sm text-gray-500">${email || 'Non connecté'}</div>
          </div>
        </div>
      </div>

      <!-- Situation -->
      <div class="bg-dark-700 rounded-2xl border border-dark-400/30 overflow-hidden">
        <div class="px-6 py-4 border-b border-dark-400/20">
          <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider">Situation fiscale</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Situation familiale</label>
              <select id="info-situation"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition">
                ${situationOptions.map(o => `<option value="${o.value}" ${params.situationFamiliale === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Parts fiscales</label>
              <input id="info-parts" type="number" step="0.5" min="1" value="${params.nbParts || 1}"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition"/>
            </div>
          </div>
        </div>
      </div>

      <!-- Retraite -->
      <div class="bg-dark-700 rounded-2xl border border-dark-400/30 overflow-hidden">
        <div class="px-6 py-4 border-b border-dark-400/20">
          <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider">Retraite</h2>
        </div>
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Age souhaité</label>
              <input id="info-retraite-souhaitee" type="number" min="50" max="75" value="${params.ageRetraiteSouhaitee || 60}"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition"/>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Age taux légal</label>
              <input id="info-retraite-legal" type="number" min="50" max="75" value="${params.ageRetraiteTauxLegal || 64}"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition"/>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Age taux plein</label>
              <input id="info-retraite-plein" type="number" min="50" max="75" value="${params.ageRetraiteTauxPlein || 65}"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition"/>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Pension taux légal (€/mois)</label>
              <input id="info-pension-legal" type="number" min="0" value="${params.pensionTauxLegal || 0}"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition"/>
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1.5">Pension taux plein (€/mois)</label>
              <input id="info-pension-plein" type="number" min="0" value="${params.pensionTauxPlein || 0}"
                class="w-full bg-dark-800 border border-dark-400/50 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition"/>
            </div>
          </div>
        </div>
      </div>

      <!-- Saved indicator -->
      <div id="save-indicator" class="text-center text-xs text-gray-600 opacity-0 transition-opacity duration-300">Sauvegardé</div>
    </div>
  `;
}

export function mount(store, navigate) {
  let saveTimeout = null;

  function showSaved() {
    const el = document.getElementById('save-indicator');
    if (el) {
      el.style.opacity = '1';
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => { el.style.opacity = '0'; }, 1500);
    }
  }

  function saveUserInfo(field, value) {
    const info = getUserInfo(store);
    info[field] = value;
    store.set('userInfo', info);
    showSaved();
  }

  function saveParam(field, value) {
    const params = getParametres(store);
    params[field] = value;
    store.set('parametres', params);
    showSaved();
  }

  // Personal info
  document.getElementById('info-prenom')?.addEventListener('input', (e) => saveUserInfo('prenom', e.target.value));
  document.getElementById('info-nom')?.addEventListener('input', (e) => saveUserInfo('nom', e.target.value));
  document.getElementById('info-dob')?.addEventListener('change', (e) => {
    saveUserInfo('dateNaissance', e.target.value);
    // Also update ageFinAnnee in params
    if (e.target.value) {
      const birthYear = new Date(e.target.value).getFullYear();
      const currentYear = new Date().getFullYear();
      saveParam('ageFinAnnee', currentYear - birthYear);
    }
  });
  document.getElementById('info-tel')?.addEventListener('input', (e) => saveUserInfo('telephone', e.target.value));

  // Situation
  document.getElementById('info-situation')?.addEventListener('change', (e) => saveParam('situationFamiliale', e.target.value));
  document.getElementById('info-parts')?.addEventListener('input', (e) => saveParam('nbParts', parseFloat(e.target.value) || 1));

  // Retirement
  document.getElementById('info-retraite-souhaitee')?.addEventListener('input', (e) => saveParam('ageRetraiteSouhaitee', parseInt(e.target.value) || 60));
  document.getElementById('info-retraite-legal')?.addEventListener('input', (e) => saveParam('ageRetraiteTauxLegal', parseInt(e.target.value) || 64));
  document.getElementById('info-retraite-plein')?.addEventListener('input', (e) => saveParam('ageRetraiteTauxPlein', parseInt(e.target.value) || 65));
  document.getElementById('info-pension-legal')?.addEventListener('input', (e) => saveParam('pensionTauxLegal', parseInt(e.target.value) || 0));
  document.getElementById('info-pension-plein')?.addEventListener('input', (e) => saveParam('pensionTauxPlein', parseInt(e.target.value) || 0));

  // Photo upload
  document.getElementById('photo-upload')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      alert('Image trop lourde (max 500 Ko)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Resize to max 200x200
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const x = (size - img.width * scale) / 2;
        const y = (size - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        saveUserInfo('photo', dataUrl);
        // Refresh the page to show the new photo
        const contentEl = document.getElementById('app-content');
        if (contentEl) {
          contentEl.innerHTML = render(store);
          mount(store, navigate);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
