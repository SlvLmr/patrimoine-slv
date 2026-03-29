import { formatCurrency, parseNumberInput } from '../utils.js?v=8';

// ─── Simulateur Salaire : Brut → Net ────────────────────────────────────────
// Calculates net salary from gross based on French social contributions.

const STATUTS = [
  { id: 'non-cadre', label: 'Salarié non-cadre', taux: 0.22 },
  { id: 'cadre', label: 'Salarié cadre', taux: 0.25 },
  { id: 'public', label: 'Fonction publique', taux: 0.15 },
  { id: 'liberal', label: 'Profession libérale', taux: 0.45 },
  { id: 'portage', label: 'Portage salarial', taux: 0.50 },
];

const MOIS_OPTIONS = [12, 13, 14, 15, 16];
const HEURES_MOIS = 151.67; // 35h × 52/12

function compute(brutMensuel, statut, tempsTravail, moisPrime, tauxPAS) {
  const tp = tempsTravail / 100;
  const brutAjuste = brutMensuel * tp;
  const tauxCotis = statut.taux;

  const netMensuel = brutAjuste * (1 - tauxCotis);
  const brutAnnuel = brutAjuste * moisPrime;
  const netAnnuel = netMensuel * moisPrime;

  const brutHoraire = brutAjuste / HEURES_MOIS;
  const netHoraire = netMensuel / HEURES_MOIS;

  const netApresIR_mensuel = netMensuel * (1 - tauxPAS / 100);
  const netApresIR_annuel = netAnnuel * (1 - tauxPAS / 100);

  return {
    brutHoraire, netHoraire,
    brutMensuel: brutAjuste, netMensuel,
    brutAnnuel, netAnnuel,
    netApresIR_mensuel, netApresIR_annuel,
    tauxCotis,
  };
}

function fmt(v) { return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// ─── Render ──────────────────────────────────────────────────────────────────

export function render() {
  const statutRadios = STATUTS.map((s, i) => `
    <label class="flex flex-col items-center gap-2 cursor-pointer group">
      <input type="radio" name="sal-statut" value="${s.id}" ${i === 0 ? 'checked' : ''}
        class="w-5 h-5 accent-accent-green cursor-pointer" />
      <span class="text-xs text-center text-gray-400 group-hover:text-gray-200 transition leading-tight">${s.label}</span>
    </label>
  `).join('');

  const moisRadios = MOIS_OPTIONS.map((m, i) => `
    <label class="flex flex-col items-center gap-2 cursor-pointer group">
      <input type="radio" name="sal-mois" value="${m}" ${i === 0 ? 'checked' : ''}
        class="w-5 h-5 accent-accent-green cursor-pointer" />
      <span class="text-xs text-gray-400 group-hover:text-gray-200 transition">${m} mois</span>
    </label>
  `).join('');

  return `
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        Salaire brut → net
      </h2>
      <p class="text-gray-500 text-sm mt-1">Estimez votre salaire net à partir du brut selon votre statut et vos paramètres</p>
      <div class="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
        <p class="text-xs text-emerald-400/80">
          <span class="font-semibold">Outil autonome</span> — Ce simulateur est indépendant de tes données personnelles. Saisis manuellement tes hypothèses.
        </p>
      </div>
    </div>

    <!-- Main grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

      <!-- Col 1: Saisie brut -->
      <div class="card-dark rounded-2xl p-5 space-y-5">
        <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          Salaire brut
        </h2>
        <div class="space-y-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Horaire brut</label>
            <input id="sal-brut-h" type="text" inputmode="decimal" placeholder="0"
              class="w-full input-field" />
          </div>
          <div>
            <div class="flex items-center gap-2 mb-1">
              <label class="text-xs text-gray-500">Mensuel brut</label>
              <span id="sal-badge-statut" class="text-[10px] px-1.5 py-0.5 rounded bg-accent-green/15 text-accent-green font-medium">Non-cadre −22%</span>
            </div>
            <input id="sal-brut-m" type="text" inputmode="decimal" placeholder="0"
              class="w-full input-field" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Annuel brut</label>
            <input id="sal-brut-a" type="text" inputmode="decimal" placeholder="0"
              class="w-full input-field" />
          </div>
        </div>
      </div>

      <!-- Col 2: Résultat net -->
      <div class="card-dark rounded-2xl p-5 space-y-5">
        <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Salaire net
        </h2>
        <div class="space-y-4">
          <div>
            <label class="block text-xs text-gray-500 mb-1">Horaire net</label>
            <div id="sal-net-h" class="w-full bg-dark-700/50 border border-accent-green/20 rounded-lg px-3 py-2.5 text-accent-green text-sm font-medium">0</div>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Mensuel net</label>
            <div id="sal-net-m" class="w-full bg-dark-700/50 border border-accent-green/20 rounded-lg px-3 py-2.5 text-accent-green text-sm font-medium">0</div>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Annuel net</label>
            <div id="sal-net-a" class="w-full bg-dark-700/50 border border-accent-green/20 rounded-lg px-3 py-2.5 text-accent-green text-sm font-medium">0</div>
          </div>
        </div>
      </div>

      <!-- Col 3: Paramètres -->
      <div class="card-dark rounded-2xl p-5 space-y-5">
        <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          Paramètres
        </h2>

        <!-- Temps de travail -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-500">Temps de travail</label>
            <span id="sal-tp-val" class="text-sm font-semibold text-white">100 %</span>
          </div>
          <input id="sal-tp" type="range" min="10" max="100" step="5" value="100"
            class="w-full h-1.5 rounded-full appearance-none bg-dark-600 accent-accent-green cursor-pointer" />
        </div>

        <!-- Mois de prime -->
        <div>
          <label class="block text-xs text-gray-500 mb-3">Nombre de mois de prime</label>
          <div class="flex justify-between gap-2">${moisRadios}</div>
        </div>

        <!-- Taux PAS -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-500">Prélèvement à la source</label>
            <span id="sal-pas-val" class="text-sm font-semibold text-white">0 %</span>
          </div>
          <input id="sal-pas" type="range" min="0" max="45" step="0.5" value="0"
            class="w-full h-1.5 rounded-full appearance-none bg-dark-600 accent-accent-green cursor-pointer" />
        </div>
      </div>
    </div>

    <!-- Statut -->
    <div class="card-dark rounded-2xl p-5">
      <label class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg class="w-4 h-4 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        Statut
      </label>
      <div class="flex justify-around gap-4">${statutRadios}</div>
    </div>

    <!-- Net après impôts -->
    <div class="card-dark rounded-2xl border-accent-green/20 p-5">
      <h2 class="text-sm font-semibold text-accent-green uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg class="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        Estimation nette après prélèvement à la source
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-gray-500 mb-1">Mensuel net après impôts</label>
          <div id="sal-net-ir-m" class="w-full bg-dark-700/50 border border-accent-green/30 rounded-lg px-3 py-2.5 text-accent-green text-sm font-bold">0</div>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Annuel net après impôts</label>
          <div id="sal-net-ir-a" class="w-full bg-dark-700/50 border border-accent-green/30 rounded-lg px-3 py-2.5 text-accent-green text-sm font-bold">0</div>
        </div>
      </div>
    </div>

    <!-- Tableau récap -->
    <div class="card-dark rounded-2xl p-5">
      <h2 class="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
        <svg class="w-4 h-4 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        Récapitulatif
      </h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-gray-500 text-xs border-b border-dark-400/20">
              <th class="text-left py-2 pr-4"></th>
              <th class="text-right py-2 px-3">Horaire</th>
              <th class="text-right py-2 px-3">Mensuel</th>
              <th class="text-right py-2 px-3">Annuel</th>
            </tr>
          </thead>
          <tbody id="sal-recap-body" class="text-gray-300">
          </tbody>
        </table>
      </div>
    </div>

    <!-- Reset -->
    <div class="flex justify-end">
      <button id="sal-reset" class="px-4 py-2 text-xs rounded-lg border border-dark-400/30 text-gray-400 hover:text-accent-red hover:border-accent-red/30 transition">
        Effacer les champs
      </button>
    </div>
  </div>`;
}

// ─── Mount ───────────────────────────────────────────────────────────────────

export function mount() {
  const brutH = document.getElementById('sal-brut-h');
  const brutM = document.getElementById('sal-brut-m');
  const brutA = document.getElementById('sal-brut-a');
  const netH = document.getElementById('sal-net-h');
  const netM = document.getElementById('sal-net-m');
  const netA = document.getElementById('sal-net-a');
  const netIR_M = document.getElementById('sal-net-ir-m');
  const netIR_A = document.getElementById('sal-net-ir-a');
  const badge = document.getElementById('sal-badge-statut');
  const tpRange = document.getElementById('sal-tp');
  const tpVal = document.getElementById('sal-tp-val');
  const pasRange = document.getElementById('sal-pas');
  const pasVal = document.getElementById('sal-pas-val');
  const recapBody = document.getElementById('sal-recap-body');

  let lastEdited = 'm'; // which brut field was last edited: h, m, a

  function getStatut() {
    const checked = document.querySelector('input[name="sal-statut"]:checked');
    return STATUTS.find(s => s.id === checked?.value) || STATUTS[0];
  }

  function getMois() {
    const checked = document.querySelector('input[name="sal-mois"]:checked');
    return parseInt(checked?.value) || 12;
  }

  function recalculate() {
    const statut = getStatut();
    const tp = parseFloat(tpRange.value) || 100;
    const mois = getMois();
    const pas = parseFloat(pasRange.value) || 0;

    // Get brut mensuel from whichever field was last edited
    let brutMensuel = 0;
    if (lastEdited === 'h') {
      const h = parseNumberInput(brutH.value);
      brutMensuel = h * HEURES_MOIS;
    } else if (lastEdited === 'a') {
      const a = parseNumberInput(brutA.value);
      brutMensuel = a / mois;
    } else {
      brutMensuel = parseNumberInput(brutM.value);
    }

    const r = compute(brutMensuel, statut, tp, mois, pas);

    // Update brut fields (except the one being edited)
    if (lastEdited !== 'h') brutH.value = r.brutHoraire > 0 ? fmt(r.brutHoraire) : '';
    if (lastEdited !== 'm') brutM.value = r.brutMensuel > 0 ? fmt(r.brutMensuel) : '';
    if (lastEdited !== 'a') brutA.value = r.brutAnnuel > 0 ? fmt(r.brutAnnuel) : '';

    // Update net displays
    netH.textContent = r.netHoraire > 0 ? fmt(r.netHoraire) + ' \u20ac' : '0';
    netM.textContent = r.netMensuel > 0 ? fmt(r.netMensuel) + ' \u20ac' : '0';
    netA.textContent = r.netAnnuel > 0 ? fmt(r.netAnnuel) + ' \u20ac' : '0';

    // Net after PAS
    netIR_M.textContent = r.netApresIR_mensuel > 0 ? fmt(r.netApresIR_mensuel) + ' \u20ac' : '0';
    netIR_A.textContent = r.netApresIR_annuel > 0 ? fmt(r.netApresIR_annuel) + ' \u20ac' : '0';

    // Badge
    badge.textContent = `${statut.label.split(' ').pop()} −${Math.round(statut.taux * 100)}%`;

    // Sliders
    tpVal.textContent = tp + ' %';
    pasVal.textContent = pas.toFixed(1) + ' %';

    // Recap table
    recapBody.innerHTML = `
      <tr class="border-b border-dark-400/10">
        <td class="py-2 pr-4 text-gray-400 font-medium">Brut</td>
        <td class="text-right py-2 px-3">${r.brutHoraire > 0 ? fmt(r.brutHoraire) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3">${r.brutMensuel > 0 ? fmt(r.brutMensuel) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3">${r.brutAnnuel > 0 ? fmt(r.brutAnnuel) + ' \u20ac' : '–'}</td>
      </tr>
      <tr class="border-b border-dark-400/10">
        <td class="py-2 pr-4 text-gray-400 font-medium">Cotisations <span class="text-gray-500 text-xs">(−${Math.round(r.tauxCotis * 100)}%)</span></td>
        <td class="text-right py-2 px-3 text-accent-red">${r.brutHoraire > 0 ? '−' + fmt(r.brutHoraire * r.tauxCotis) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3 text-accent-red">${r.brutMensuel > 0 ? '−' + fmt(r.brutMensuel * r.tauxCotis) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3 text-accent-red">${r.brutAnnuel > 0 ? '−' + fmt(r.brutAnnuel * r.tauxCotis) + ' \u20ac' : '–'}</td>
      </tr>
      <tr class="border-b border-dark-400/10">
        <td class="py-2 pr-4 text-accent-green font-medium">Net</td>
        <td class="text-right py-2 px-3 text-accent-green font-medium">${r.netHoraire > 0 ? fmt(r.netHoraire) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3 text-accent-green font-medium">${r.netMensuel > 0 ? fmt(r.netMensuel) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3 text-accent-green font-medium">${r.netAnnuel > 0 ? fmt(r.netAnnuel) + ' \u20ac' : '–'}</td>
      </tr>
      ${pas > 0 ? `
      <tr class="border-b border-dark-400/10">
        <td class="py-2 pr-4 text-gray-400 font-medium">PAS <span class="text-gray-500 text-xs">(−${pas.toFixed(1)}%)</span></td>
        <td class="text-right py-2 px-3 text-accent-red">${r.netHoraire > 0 ? '−' + fmt(r.netHoraire * pas / 100) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3 text-accent-red">${r.netMensuel > 0 ? '−' + fmt(r.netMensuel * pas / 100) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3 text-accent-red">${r.netAnnuel > 0 ? '−' + fmt(r.netAnnuel * pas / 100) + ' \u20ac' : '–'}</td>
      </tr>
      <tr>
        <td class="py-2 pr-4 text-accent-green font-bold">Net après impôts</td>
        <td class="text-right py-2 px-3 text-accent-green font-bold">${r.netHoraire > 0 ? fmt(r.netHoraire * (1 - pas / 100)) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3 text-accent-green font-bold">${r.netApresIR_mensuel > 0 ? fmt(r.netApresIR_mensuel) + ' \u20ac' : '–'}</td>
        <td class="text-right py-2 px-3 text-accent-green font-bold">${r.netApresIR_annuel > 0 ? fmt(r.netApresIR_annuel) + ' \u20ac' : '–'}</td>
      </tr>` : ''}
    `;
  }

  // Brut field listeners
  brutH.addEventListener('input', () => { lastEdited = 'h'; recalculate(); });
  brutM.addEventListener('input', () => { lastEdited = 'm'; recalculate(); });
  brutA.addEventListener('input', () => { lastEdited = 'a'; recalculate(); });

  // Statut radios
  document.querySelectorAll('input[name="sal-statut"]').forEach(r => r.addEventListener('change', recalculate));
  // Mois radios
  document.querySelectorAll('input[name="sal-mois"]').forEach(r => r.addEventListener('change', recalculate));

  // Sliders
  tpRange.addEventListener('input', recalculate);
  pasRange.addEventListener('input', recalculate);

  // Reset
  document.getElementById('sal-reset')?.addEventListener('click', () => {
    brutH.value = ''; brutM.value = ''; brutA.value = '';
    tpRange.value = 100; pasRange.value = 0;
    document.querySelector('input[name="sal-statut"][value="non-cadre"]').checked = true;
    document.querySelector('input[name="sal-mois"][value="12"]').checked = true;
    lastEdited = 'm';
    recalculate();
  });

  recalculate();
}
