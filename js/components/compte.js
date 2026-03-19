import { getCurrentUser } from '../firebase-config.js';

function getUserInfo(store) {
  return store.get('userInfo') || { prenom: '', nom: '', telephone: '', dateNaissance: '', photo: '' };
}

function getParametres(store) {
  return store.get('parametres') || {};
}

function getEnfants(store) {
  const cfg = store.get('donationConfig') || { enfants: [] };
  return cfg.enfants || [];
}

function saveEnfants(store, enfants) {
  const cfg = store.get('donationConfig') || { enfants: [], donations: [] };
  cfg.enfants = enfants;
  store.set('donationConfig', cfg);
}

function computeAge(dateNaissance) {
  if (!dateNaissance) return null;
  return Math.floor((Date.now() - new Date(dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000));
}

function renderChildCard(child, index) {
  const age = computeAge(child.dateNaissance);
  const initials = (child.prenom?.[0] || '?').toUpperCase();

  return `
    <div class="flex items-center gap-4 p-4 bg-dark-800 rounded-xl border border-dark-400/20 group" data-child-idx="${index}">
      <div class="relative">
        <label for="child-photo-${index}" class="cursor-pointer block">
          ${child.photo
            ? `<img src="${child.photo}" alt="${child.prenom}" class="w-14 h-14 rounded-full object-cover border-2 border-dark-400 group-hover:border-accent-green transition"/>`
            : `<div class="w-14 h-14 rounded-full bg-dark-600 border-2 border-dark-400 group-hover:border-accent-green transition flex items-center justify-center">
                <span class="text-lg font-bold text-gray-400">${initials}</span>
              </div>`
          }
          <div class="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
        </label>
        <input type="file" id="child-photo-${index}" accept="image/*" class="hidden child-photo-input" data-idx="${index}"/>
      </div>
      <div class="flex-1 min-w-0">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" value="${child.prenom || ''}" placeholder="Prénom"
            class="child-prenom bg-transparent border-b border-dark-400/30 focus:border-accent-green px-0 py-1 text-sm text-gray-200 focus:outline-none transition placeholder-gray-600" data-idx="${index}"/>
          <div class="flex items-center gap-2">
            <input type="date" value="${child.dateNaissance || ''}"
              class="child-dob bg-transparent border-b border-dark-400/30 focus:border-accent-green px-0 py-1 text-sm text-gray-200 focus:outline-none transition flex-1" data-idx="${index}"/>
            ${age !== null ? `<span class="text-xs text-gray-500 whitespace-nowrap">${age} ans</span>` : ''}
          </div>
        </div>
      </div>
      <button class="child-delete opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 p-1.5 transition" data-idx="${index}" title="Supprimer">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;
}

export function render(store) {
  const info = getUserInfo(store);
  const params = getParametres(store);
  const enfants = getEnfants(store);
  const epargne = store.get('actifs.epargne') || [];
  const immobilier = store.get('actifs.immobilier') || [];
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

      <!-- Famille / Enfants -->
      <div class="bg-dark-700 rounded-2xl border border-dark-400/30 overflow-hidden">
        <div class="px-6 py-4 border-b border-dark-400/20 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider">Famille</h2>
          <button id="btn-add-child" class="text-xs text-accent-green hover:text-accent-amber transition flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/>
            </svg>
            Ajouter un enfant
          </button>
        </div>
        <div class="p-6">
          ${enfants.length === 0
            ? `<p class="text-sm text-gray-600 text-center py-4">Aucun enfant ajouté</p>`
            : `<div id="children-list" class="space-y-3">${enfants.map((c, i) => renderChildCard(c, i)).join('')}</div>`
          }
        </div>
      </div>

      <!-- Situation fiscale -->
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

      <!-- Valeurs patrimoniales éditables -->
      <div class="bg-dark-700 rounded-2xl border border-dark-400/30 overflow-hidden">
        <div class="px-6 py-4 border-b border-dark-400/20">
          <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider">Mes valeurs patrimoniales</h2>
          <p class="text-xs text-gray-600 mt-1">Modifiez ici vos soldes et estimations — les changements se reflètent dans Portefeuille et Projection</p>
        </div>
        <div class="p-6 space-y-5">
          <!-- Immobilier -->
          <div>
            <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              Immobilier — Estimation actuelle
              <span class="text-[10px] text-gray-500 ml-2 flex items-center gap-1">Rdt
                <input id="param-rend-immo-inline" type="number" step="0.1" min="0" max="50" value="${((params.rendementImmobilier || 0.02) * 100).toFixed(1)}"
                  class="w-12 bg-dark-900 border border-dark-400/50 rounded px-1 py-0.5 text-[11px] text-gray-300 text-center focus:outline-none focus:border-accent-green transition"/>
                %
              </span>
            </h3>
            <div class="space-y-2">
              ${immobilier.map(i => `
              <div class="flex items-center gap-3 bg-dark-800/50 rounded-lg px-4 py-2.5">
                <input type="text" value="${i.nom}"
                  data-immo-nom-id="${i.id}"
                  class="immo-nom bg-transparent border-b border-transparent hover:border-dark-400/50 focus:border-accent-green text-sm text-gray-300 flex-1 min-w-0 truncate focus:outline-none transition px-0 py-0"/>
                <div class="relative w-36">
                  <input type="number" step="1000" min="0" value="${Number(i.valeurActuelle) || 0}"
                    data-immo-id="${i.id}" data-field="valeurActuelle"
                    class="asset-val w-full bg-dark-900 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-gray-200 text-right focus:outline-none focus:border-accent-green transition pr-7"/>
                  <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500">\u20ac</span>
                </div>
                <button data-del-immo-inline="${i.id}" class="text-red-400/40 hover:text-red-400 transition ml-1" title="Supprimer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>`).join('')}
              <button id="btn-add-immo-inline" class="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-accent-green border border-dashed border-dark-400/30 hover:border-accent-green/40 rounded-lg transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
                Ajouter un bien immobilier
              </button>
            </div>
          </div>

          <!-- Épargne -->
          <div>
            <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              Épargne
              <span class="text-[10px] text-gray-500 ml-2 flex items-center gap-1">Rdt
                <input id="param-rend-epargne-inline" type="number" step="0.1" min="0" max="50" value="${((params.rendementEpargne || 0.02) * 100).toFixed(1)}"
                  class="w-12 bg-dark-900 border border-dark-400/50 rounded px-1 py-0.5 text-[11px] text-gray-300 text-center focus:outline-none focus:border-accent-amber transition"/>
                %
              </span>
            </h3>
            <div class="space-y-2">
              ${epargne.map(e => `
              <div class="flex items-center gap-3 bg-dark-800/50 rounded-lg px-4 py-2.5">
                <input type="text" value="${e.nom}"
                  data-epar-nom-id="${e.id}"
                  class="epar-nom bg-transparent border-b border-transparent hover:border-dark-400/50 focus:border-accent-amber text-sm text-gray-300 flex-1 min-w-0 truncate focus:outline-none transition px-0 py-0"/>
                <div class="relative w-36">
                  <input type="number" step="0.01" min="0" value="${Number(e.solde) || 0}"
                    data-epargne-id="${e.id}" data-field="solde"
                    class="asset-val w-full bg-dark-900 border border-dark-400/50 rounded-lg px-3 py-2 text-sm text-gray-200 text-right focus:outline-none focus:border-accent-amber transition pr-7"/>
                  <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500">\u20ac</span>
                </div>
                <button data-del-epar-inline="${e.id}" class="text-red-400/40 hover:text-red-400 transition ml-1" title="Supprimer">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>`).join('')}
              <button id="btn-add-epar-inline" class="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-500 hover:text-accent-amber border border-dashed border-dark-400/30 hover:border-accent-amber/40 rounded-lg transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"/></svg>
                Ajouter un livret
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Paramètres financiers (avancé) -->
      <details class="bg-dark-700 rounded-2xl border border-dark-400/30 overflow-hidden">
        <summary class="px-6 py-4 cursor-pointer select-none flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider">Paramètres avancés</h2>
            <p class="text-xs text-gray-600 mt-1">Taux de rendement, fiscalité</p>
          </div>
          <svg class="w-4 h-4 text-gray-500 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-6 pb-6 space-y-6 border-t border-dark-400/20 pt-4">
          <!-- Rendements + Fiscalité on one line -->
          <div>
            <h3 class="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Rendements & Fiscalité</h3>
            <div class="flex flex-wrap items-end gap-3">
              ${[
                ['param-inflation', 'Inflation', ((params.inflationRate || 0.02) * 100).toFixed(1), '%'],
                ['param-pfu', 'Flat Tax', ((params.tauxPFU || 0.314) * 100).toFixed(1), '%'],
                ['param-ps', 'PS (CSG)', ((params.tauxPS || 0.172) * 100).toFixed(1), '%'],
                ['param-av-ir', 'AV IR 8a', ((params.tauxAVIR || 0.075) * 100).toFixed(1), '%'],
              ].map(([id, label, val, suffix]) => `
              <div class="flex items-center gap-1">
                <span class="text-[11px] text-gray-500 whitespace-nowrap">${label}</span>
                <div class="relative">
                  <input id="${id}" type="number" step="0.1" min="0" max="50" value="${val}"
                    class="w-16 bg-dark-800 border border-dark-400/50 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-accent-green transition pr-5 text-center"/>
                  <span class="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">${suffix}</span>
                </div>
              </div>`).join('')}
            </div>
          </div>
        </div>
      </details>

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

  function refresh() {
    const contentEl = document.getElementById('app-content');
    if (contentEl) {
      contentEl.innerHTML = render(store);
      mount(store, navigate);
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

  // Asset values (épargne soldes + immobilier estimations)
  document.querySelectorAll('[data-epargne-id]').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.epargneId;
      const val = parseFloat(e.target.value) || 0;
      store.updateItem('actifs.epargne', id, { solde: val });
      showSaved();
    });
  });

  document.querySelectorAll('[data-immo-id]').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.immoId;
      const val = parseFloat(e.target.value) || 0;
      store.updateItem('actifs.immobilier', id, { valeurActuelle: val });
      showSaved();
    });
  });

  // Inline name editing for immobilier
  document.querySelectorAll('[data-immo-nom-id]').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.immoNomId;
      const val = e.target.value.trim();
      if (val) {
        store.updateItem('actifs.immobilier', id, { nom: val });
        showSaved();
      }
    });
  });

  // Inline name editing for épargne
  document.querySelectorAll('[data-epar-nom-id]').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.eparNomId;
      const val = e.target.value.trim();
      if (val) {
        store.updateItem('actifs.epargne', id, { nom: val });
        showSaved();
      }
    });
  });

  // Inline delete immobilier
  document.querySelectorAll('[data-del-immo-inline]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer ce bien immobilier ?')) {
        store.removeItem('actifs.immobilier', btn.dataset.delImmoInline);
        refresh();
      }
    });
  });

  // Inline delete épargne
  document.querySelectorAll('[data-del-epar-inline]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer ce compte d\'épargne ?')) {
        store.removeItem('actifs.epargne', btn.dataset.delEparInline);
        refresh();
      }
    });
  });

  // Add immobilier inline
  document.getElementById('btn-add-immo-inline')?.addEventListener('click', () => {
    store.addItem('actifs.immobilier', { nom: 'Nouveau bien', valeurAchat: 0, valeurActuelle: 0 });
    refresh();
  });

  // Add épargne inline
  document.getElementById('btn-add-epar-inline')?.addEventListener('click', () => {
    store.addItem('actifs.epargne', { nom: 'Nouveau livret', solde: 0, tauxInteret: 0.03, plafond: 22950 });
    refresh();
  });

  // Financial parameters (percentages → stored as decimals)
  document.getElementById('param-inflation')?.addEventListener('input', (e) => saveParam('inflationRate', (parseFloat(e.target.value) || 0) / 100));
  document.getElementById('param-rend-immo-inline')?.addEventListener('input', (e) => saveParam('rendementImmobilier', (parseFloat(e.target.value) || 0) / 100));
  document.getElementById('param-rend-epargne-inline')?.addEventListener('input', (e) => saveParam('rendementEpargne', (parseFloat(e.target.value) || 0) / 100));
  // Tax rates
  document.getElementById('param-pfu')?.addEventListener('input', (e) => saveParam('tauxPFU', (parseFloat(e.target.value) || 0) / 100));
  document.getElementById('param-ps')?.addEventListener('input', (e) => saveParam('tauxPS', (parseFloat(e.target.value) || 0) / 100));
  document.getElementById('param-av-ir')?.addEventListener('input', (e) => saveParam('tauxAVIR', (parseFloat(e.target.value) || 0) / 100));


  // Photo upload (main user)
  document.getElementById('photo-upload')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resizeAndSavePhoto(file, (dataUrl) => {
      saveUserInfo('photo', dataUrl);
      refresh();
    });
  });

  // --- Children ---
  // Add child
  document.getElementById('btn-add-child')?.addEventListener('click', () => {
    const enfants = getEnfants(store);
    enfants.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      prenom: '',
      dateNaissance: '',
      photo: ''
    });
    saveEnfants(store, enfants);
    refresh();
  });

  // Child prenom
  document.querySelectorAll('.child-prenom').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const enfants = getEnfants(store);
      if (enfants[idx]) {
        enfants[idx].prenom = e.target.value;
        saveEnfants(store, enfants);
        showSaved();
      }
    });
  });

  // Child date of birth
  document.querySelectorAll('.child-dob').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const enfants = getEnfants(store);
      if (enfants[idx]) {
        enfants[idx].dateNaissance = e.target.value;
        saveEnfants(store, enfants);
        refresh();
      }
    });
  });

  // Child delete
  document.querySelectorAll('.child-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.idx);
      const enfants = getEnfants(store);
      const child = enfants[idx];
      if (child && confirm(`Supprimer ${child.prenom || 'cet enfant'} ?`)) {
        enfants.splice(idx, 1);
        saveEnfants(store, enfants);
        refresh();
      }
    });
  });

  // Child photo upload
  document.querySelectorAll('.child-photo-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      const idx = parseInt(e.target.dataset.idx);
      if (!file) return;
      resizeAndSavePhoto(file, (dataUrl) => {
        const enfants = getEnfants(store);
        if (enfants[idx]) {
          enfants[idx].photo = dataUrl;
          saveEnfants(store, enfants);
          refresh();
        }
      });
    });
  });
}

function resizeAndSavePhoto(file, callback) {
  if (file.size > 2000000) {
    alert('Image trop lourde (max 2 Mo)');
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
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
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
