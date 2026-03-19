import { formatCurrency, openModal, inputField, getFormData, computeProjection } from '../utils.js?v=5';

const ABATTEMENT_PARENT_ENFANT = 100000;
const DON_FAMILIAL_TEPA = 31865;

function getConfig(store) {
  return store.get('donationConfig') || { enfants: [], donations: [] };
}

function saveConfig(store, cfg) {
  store.set('donationConfig', cfg);
}

function getPatrimoineNet(store) {
  const state = store.getAll();
  const actifs = state.actifs || {};
  const passifs = state.passifs || {};
  const immobilier = (actifs.immobilier || []).reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const placements = (actifs.placements || []).reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const epargne = (actifs.epargne || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const comptes = store.totalComptesCourantsLive();
  const emprunts = (passifs.emprunts || []).reduce((s, i) => s + (Number(i.capitalRestant) || 0), 0);
  return immobilier + placements + epargne + comptes - emprunts;
}

function childAge(dateNaissance) {
  if (!dateNaissance) return null;
  return Math.floor((Date.now() - new Date(dateNaissance).getTime()) / (365.25 * 24 * 3600 * 1000));
}

const CHILD_COLORS = ['accent-purple', 'accent-cyan', 'accent-green', 'accent-amber', 'accent-blue', 'accent-red'];

export function render(store) {
  const params = store.get('parametres') || {};
  const ageDonateur = params.ageFinAnnee || 43;
  const patrimoine = getPatrimoineNet(store);
  const cfg = getConfig(store);
  const enfants = cfg.enfants || [];
  const donations = cfg.donations || [];
  const nbEnfants = enfants.length;

  return `
    <div class="max-w-6xl mx-auto space-y-6">

      <!-- FAMILLE -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-9 h-9 rounded-xl bg-accent-purple/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div>
            <h1 class="text-lg font-bold text-gray-100">Famille</h1>
            <p class="text-xs text-gray-500">${ageDonateur} ans · Patrimoine net : ${formatCurrency(patrimoine)}</p>
          </div>
          <button id="btn-add-enfant" class="ml-auto px-3 py-1.5 bg-accent-purple text-dark-900 text-xs font-bold rounded-lg hover:opacity-90 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Ajouter un enfant
          </button>
        </div>

        ${nbEnfants === 0 ? `
          <div class="text-center py-8">
            <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-dark-600/50 flex items-center justify-center">
              <svg class="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-400">Ajoutez vos enfants pour simuler les donations et la transmission</p>
          </div>
        ` : `
          <div class="grid grid-cols-1 ${nbEnfants >= 2 ? 'sm:grid-cols-2' : ''} ${nbEnfants >= 3 ? 'lg:grid-cols-3' : ''} gap-4">
            ${enfants.map((enf, i) => {
              const age = childAge(enf.dateNaissance);
              const color = CHILD_COLORS[i % CHILD_COLORS.length];
              const enfDons = donations.filter(d => d.enfantId === enf.id);
              const totalDonne = enfDons.reduce((s, d) => s + (Number(d.montant) || 0), 0);
              const nbDons = enfDons.length;
              const abattRestant = Math.max(0, ABATTEMENT_PARENT_ENFANT - totalDonne);
              const tepaUsed = enfDons.some(d => d.type === 'don_tepa');
              const partHeritage = patrimoine / Math.max(1, nbEnfants);

              return `
              <div class="bg-dark-800/40 rounded-xl p-4 border border-dark-400/10 hover:border-${color}/30 transition group relative">
                <button class="enfant-delete absolute top-2 right-2 w-5 h-5 rounded-full bg-dark-600/60 text-gray-500 hover:bg-accent-red/20 hover:text-accent-red transition opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs" data-id="${enf.id}">&times;</button>

                <div class="flex items-center gap-3 mb-3">
                  <div class="w-10 h-10 rounded-full bg-${color}/20 border-2 border-${color}/30 flex items-center justify-center text-sm font-bold text-${color}">
                    ${(enf.prenom || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 class="text-sm font-bold text-gray-100">${enf.prenom || 'Sans nom'}</h3>
                    <p class="text-[10px] text-gray-500">${age !== null ? `${age} ans` : 'Âge inconnu'}${enf.dateNaissance ? ` · né(e) le ${new Date(enf.dateNaissance).toLocaleDateString('fr-FR')}` : ''}</p>
                  </div>
                  <button class="enfant-edit ml-auto text-gray-500 hover:text-${color} transition opacity-0 group-hover:opacity-100" data-id="${enf.id}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                </div>

                <div class="space-y-2">
                  <!-- Donations -->
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-500 flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>
                      Donations
                    </span>
                    <span class="font-medium ${totalDonne > 0 ? 'text-accent-green' : 'text-gray-400'}">${nbDons > 0 ? `${formatCurrency(totalDonne)} (${nbDons})` : 'Aucune'}</span>
                  </div>

                  <!-- Abattement restant -->
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-500 flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                      Abattement restant
                    </span>
                    <span class="font-medium ${abattRestant >= ABATTEMENT_PARENT_ENFANT ? 'text-accent-green' : abattRestant > 0 ? 'text-accent-amber' : 'text-accent-red'}">${formatCurrency(abattRestant)}</span>
                  </div>

                  <!-- TEPA -->
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-500 flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      TEPA
                    </span>
                    <span class="font-medium ${tepaUsed ? 'text-gray-400' : 'text-accent-cyan'}">${tepaUsed ? 'Utilisé' : formatCurrency(DON_FAMILIAL_TEPA) + ' disponible'}</span>
                  </div>

                  <!-- Part héritage estimée -->
                  <div class="flex items-center justify-between text-xs pt-1 border-t border-dark-400/10">
                    <span class="text-gray-500 flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                      Part estimée
                    </span>
                    <span class="font-medium text-gray-300">${formatCurrency(partHeritage)}</span>
                  </div>
                </div>

                <!-- Progression abattement -->
                <div class="mt-3 pt-2">
                  <div class="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Abattement utilisé</span>
                    <span>${Math.round((1 - abattRestant / ABATTEMENT_PARENT_ENFANT) * 100)}%</span>
                  </div>
                  <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <div class="h-full bg-${color} rounded-full transition-all" style="width: ${Math.min(100, (1 - abattRestant / ABATTEMENT_PARENT_ENFANT) * 100)}%"></div>
                  </div>
                </div>

                <!-- Bouton ajouter donation -->
                <button class="btn-add-donation mt-3 w-full py-1.5 bg-${color}/10 hover:bg-${color}/20 text-${color} text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 border border-${color}/20" data-id="${enf.id}" data-prenom="${enf.prenom || ''}">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                  Donation
                </button>
              </div>`;
            }).join('')}
          </div>
        `}
      </div>

      ${nbEnfants > 0 ? `
      <!-- CAPACITÉ GLOBALE DE TRANSMISSION -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
            <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-200">Capacité de transmission exonérée</h2>
            <p class="text-[10px] text-gray-500">Montants transmissibles sans payer de droits (par cycle de 15 ans)</p>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="bg-dark-800/40 rounded-lg p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase mb-1">Abattement / enfant</p>
            <p class="text-lg font-bold text-accent-green">${formatCurrency(ABATTEMENT_PARENT_ENFANT)}</p>
            <p class="text-[9px] text-gray-600">renouvelable / 15 ans</p>
          </div>
          <div class="bg-dark-800/40 rounded-lg p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase mb-1">TEPA / enfant</p>
            <p class="text-lg font-bold text-accent-cyan">${formatCurrency(DON_FAMILIAL_TEPA)}</p>
            <p class="text-[9px] text-gray-600">avant 80 ans</p>
          </div>
          <div class="bg-dark-800/40 rounded-lg p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase mb-1">Total / enfant</p>
            <p class="text-lg font-bold text-accent-amber">${formatCurrency(ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA)}</p>
            <p class="text-[9px] text-gray-600">par cycle</p>
          </div>
          <div class="bg-dark-800/40 rounded-lg p-3 text-center">
            <p class="text-[10px] text-gray-500 uppercase mb-1">Total famille</p>
            <p class="text-lg font-bold text-white">${formatCurrency((ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA) * nbEnfants)}</p>
            <p class="text-[9px] text-gray-600">${nbEnfants} enfant${nbEnfants > 1 ? 's' : ''} × ${formatCurrency(ABATTEMENT_PARENT_ENFANT + DON_FAMILIAL_TEPA)}</p>
          </div>
        </div>
      </div>
      ` : ''}

    </div>
  `;
}

export function mount(store, navigate) {
  const cfg = getConfig(store);
  const enfants = cfg.enfants || [];

  // --- Ajouter enfant ---
  document.getElementById('btn-add-enfant')?.addEventListener('click', () => {
    openModal('Ajouter un enfant', `
      ${inputField('prenom', 'Prénom', '', 'text')}
      ${inputField('dateNaissance', 'Date de naissance', '', 'date')}
    `, () => {
      const data = getFormData(document.getElementById('modal-body'));
      if (!data.prenom) return;
      const c = getConfig(store);
      if (!c.enfants) c.enfants = [];
      c.enfants.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        prenom: data.prenom,
        dateNaissance: data.dateNaissance
      });
      saveConfig(store, c);
      navigate('enfants');
    });
  });

  // --- Modifier enfant ---
  document.querySelectorAll('.enfant-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const c = getConfig(store);
      const enf = (c.enfants || []).find(e => e.id === id);
      if (!enf) return;
      openModal("Modifier l'enfant", `
        ${inputField('prenom', 'Prénom', enf.prenom || '', 'text')}
        ${inputField('dateNaissance', 'Date de naissance', enf.dateNaissance || '', 'date')}
      `, () => {
        const data = getFormData(document.getElementById('modal-body'));
        enf.prenom = data.prenom || enf.prenom;
        enf.dateNaissance = data.dateNaissance || enf.dateNaissance;
        saveConfig(store, c);
        navigate('enfants');
      });
    });
  });

  // --- Ajouter donation ---
  document.querySelectorAll('.btn-add-donation').forEach(btn => {
    btn.addEventListener('click', () => {
      const enfantId = btn.dataset.id;
      const prenom = btn.dataset.prenom;
      const c = getConfig(store);
      const enfDons = (c.donations || []).filter(d => d.enfantId === enfantId);
      const tepaUsed = enfDons.some(d => d.type === 'don_tepa');
      openModal(`Donation pour ${prenom}`, `
        ${inputField('montant', 'Montant (€)', '', 'number')}
        <div class="mt-3">
          <label class="block text-xs text-gray-400 mb-1">Type</label>
          <select id="field-type" class="w-full px-3 py-2 bg-dark-700 border border-dark-400/30 rounded-lg text-sm text-gray-200">
            <option value="donation">Donation classique (abattement 100 000 €)</option>
            <option value="don_tepa" ${tepaUsed ? 'disabled' : ''}>Don familial TEPA (31 865 €)${tepaUsed ? ' — déjà utilisé' : ''}</option>
          </select>
        </div>
        ${inputField('annee', 'Année', new Date().getFullYear().toString(), 'number')}
      `, () => {
        const body = document.getElementById('modal-body');
        const data = getFormData(body);
        const type = body.querySelector('#field-type')?.value || 'donation';
        const montant = Number(data.montant);
        if (!montant || montant <= 0) return;
        const cfg2 = getConfig(store);
        if (!cfg2.donations) cfg2.donations = [];
        cfg2.donations.push({
          enfantId,
          montant,
          type,
          annee: Number(data.annee) || new Date().getFullYear()
        });
        saveConfig(store, cfg2);
        navigate('enfants');
      });
    });
  });

  // --- Supprimer enfant ---
  document.querySelectorAll('.enfant-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const c = getConfig(store);
      c.enfants = (c.enfants || []).filter(e => e.id !== id);
      c.donations = (c.donations || []).filter(d => d.enfantId !== id);
      saveConfig(store, c);
      navigate('enfants');
    });
  });
}
