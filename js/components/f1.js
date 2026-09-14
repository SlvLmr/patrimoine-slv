import { openModal, inputField, selectField, getFormData, showToast, showModalError } from '../utils.js?v=20260809m';
import { getCurrentUser, saveSharedDoc, loadSharedDoc, subscribeSharedDoc, isConfigured } from '../firebase-config.js';

// ============================================================
// PADDOCK F1 — univers séparé d'Horizon (duel Sylvain / Florian sur PS5)
// Saison 2025, courses classiques (pas de sprint), barème FIA 25-18-15…
// Classement COMMUN via document Firestore partagé shared/f1-championnat ;
// setups & stratégies INDIVIDUELS (store perso). Aucune dépendance Horizon.
// ============================================================

const BAREME = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

const GP_2025 = [
  { id: 'aus', nom: 'Australie', circuit: 'Albert Park · Melbourne', drapeau: '🇦🇺', date: '16 mars' },
  { id: 'chn', nom: 'Chine', circuit: 'Shanghai International', drapeau: '🇨🇳', date: '23 mars' },
  { id: 'jpn', nom: 'Japon', circuit: 'Suzuka', drapeau: '🇯🇵', date: '6 avril' },
  { id: 'bhr', nom: 'Bahreïn', circuit: 'Sakhir', drapeau: '🇧🇭', date: '13 avril' },
  { id: 'sau', nom: 'Arabie saoudite', circuit: 'Djeddah Corniche', drapeau: '🇸🇦', date: '20 avril' },
  { id: 'mia', nom: 'Miami', circuit: 'Miami International', drapeau: '🇺🇸', date: '4 mai' },
  { id: 'emi', nom: 'Émilie-Romagne', circuit: 'Imola', drapeau: '🇮🇹', date: '18 mai' },
  { id: 'mon', nom: 'Monaco', circuit: 'Monte-Carlo', drapeau: '🇲🇨', date: '25 mai' },
  { id: 'esp', nom: 'Espagne', circuit: 'Barcelona-Catalunya', drapeau: '🇪🇸', date: '1 juin' },
  { id: 'can', nom: 'Canada', circuit: 'Gilles-Villeneuve · Montréal', drapeau: '🇨🇦', date: '15 juin' },
  { id: 'aut', nom: 'Autriche', circuit: 'Red Bull Ring · Spielberg', drapeau: '🇦🇹', date: '29 juin' },
  { id: 'gbr', nom: 'Grande-Bretagne', circuit: 'Silverstone', drapeau: '🇬🇧', date: '6 juillet' },
  { id: 'bel', nom: 'Belgique', circuit: 'Spa-Francorchamps', drapeau: '🇧🇪', date: '27 juillet' },
  { id: 'hun', nom: 'Hongrie', circuit: 'Hungaroring · Budapest', drapeau: '🇭🇺', date: '3 août' },
  { id: 'ned', nom: 'Pays-Bas', circuit: 'Zandvoort', drapeau: '🇳🇱', date: '31 août' },
  { id: 'ita', nom: 'Italie', circuit: 'Monza', drapeau: '🇮🇹', date: '7 septembre' },
  { id: 'aze', nom: 'Azerbaïdjan', circuit: 'Bakou City', drapeau: '🇦🇿', date: '21 septembre' },
  { id: 'sgp', nom: 'Singapour', circuit: 'Marina Bay', drapeau: '🇸🇬', date: '5 octobre' },
  { id: 'usa', nom: 'États-Unis', circuit: 'COTA · Austin', drapeau: '🇺🇸', date: '19 octobre' },
  { id: 'mex', nom: 'Mexique', circuit: 'Hermanos Rodríguez', drapeau: '🇲🇽', date: '26 octobre' },
  { id: 'bra', nom: 'Brésil', circuit: 'Interlagos · São Paulo', drapeau: '🇧🇷', date: '9 novembre' },
  { id: 'las', nom: 'Las Vegas', circuit: 'Las Vegas Strip', drapeau: '🇺🇸', date: '22 novembre' },
  { id: 'qat', nom: 'Qatar', circuit: 'Losail', drapeau: '🇶🇦', date: '30 novembre' },
  { id: 'abu', nom: 'Abou Dabi', circuit: 'Yas Marina', drapeau: '🇦🇪', date: '7 décembre' },
];

const ECURIES = [
  { value: 'mclaren', label: 'McLaren', couleur: '#FF8000' },
  { value: 'ferrari', label: 'Ferrari', couleur: '#E8002D' },
  { value: 'redbull', label: 'Red Bull', couleur: '#3671C6' },
  { value: 'mercedes', label: 'Mercedes', couleur: '#27F4D2' },
  { value: 'astonmartin', label: 'Aston Martin', couleur: '#229971' },
  { value: 'alpine', label: 'Alpine', couleur: '#0093CC' },
  { value: 'haas', label: 'Haas', couleur: '#B6BABD' },
  { value: 'racingbulls', label: 'Racing Bulls', couleur: '#6692FF' },
  { value: 'williams', label: 'Williams', couleur: '#64C4FF' },
  { value: 'sauber', label: 'Kick Sauber', couleur: '#52E252' },
];

const ecurieDe = (id) => ECURIES.find(e => e.value === id) || ECURIES[1];

const PNEUS = [
  { value: 'S', label: '🔴 Soft' }, { value: 'M', label: '🟡 Medium' }, { value: 'H', label: '⚪ Hard' },
  { value: 'I', label: '🟢 Inter' }, { value: 'W', label: '🔵 Pluie' },
];

// ---- state ----
let ongletActif = 'championnat'; // championnat | garage | strat
let gpActif = GP_2025[0].id;
let _unsubShared = null;
const surPageF1 = () => window.location.hash.slice(1) === 'f1';

const DEFAUT_CHAMP = () => ({
  saison: 2025,
  updatedAt: '1970-01-01T00:00:00.000Z',
  pilotes: {
    p1: { nom: 'Sylvain', tri: 'SYL', ecurie: 'ferrari', nat: '🇫🇷', casque: '#E10600', email: '' },
    p2: { nom: 'Florian', tri: 'FLO', ecurie: 'mclaren', nat: '🇫🇷', casque: '#FF8000', email: '' },
  },
  resultats: {},
});

function getChamp(store) {
  const c = store.get('f1Champ');
  return c && c.pilotes ? c : DEFAUT_CHAMP();
}

// Écrit localement ET pousse vers le document partagé (classement commun)
function pousserChamp(store, champ) {
  champ.updatedAt = new Date().toISOString();
  store.set('f1Champ', champ);
  if (isConfigured()) {
    saveSharedDoc('f1-championnat', champ).then(ok => {
      if (!ok) showToast('Classement non synchronisé (hors ligne ou règle Firestore manquante)', 'error', 4000);
    });
  }
}

function adopterSiPlusRecent(store, distant) {
  if (!distant || !distant.pilotes) return false;
  const local = getChamp(store);
  if ((distant.updatedAt || '') > (local.updatedAt || '')) {
    store.set('f1Champ', distant);
    return true;
  }
  return false;
}

function getMonSlot(store) {
  const s = store.get('f1MonSlot');
  if (s === 'p1' || s === 'p2') return s;
  const email = (getCurrentUser?.()?.email || '').toLowerCase();
  const champ = getChamp(store);
  if (email && (champ.pilotes.p2.email || '').toLowerCase() === email) return 'p2';
  return 'p1';
}

const ptsPour = (pos) => (typeof pos === 'number' && pos >= 1 && pos <= 10) ? BAREME[pos - 1] : 0;

function classement(champ) {
  const t = { p1: { pts: 0, wins: 0, podiums: 0, courses: 0 }, p2: { pts: 0, wins: 0, podiums: 0, courses: 0 } };
  GP_2025.forEach(gp => {
    const r = champ.resultats[gp.id];
    if (!r) return;
    ['p1', 'p2'].forEach(k => {
      const pos = r[k];
      if (pos === undefined || pos === null || pos === '') return;
      t[k].courses++;
      t[k].pts += ptsPour(pos);
      if (pos === 1) t[k].wins++;
      if (typeof pos === 'number' && pos <= 3) t[k].podiums++;
    });
  });
  return t;
}

const posTxt = (pos) => pos === 'DNF' ? 'DNF' : (pos ? 'P' + pos : '—');

// ============================================================
// RENDER
// ============================================================
export function render(store) {
  const champ = getChamp(store);
  const contenu = ongletActif === 'championnat' ? vueChampionnat(store, champ)
    : ongletActif === 'garage' ? vueGarage(store, 'setup')
    : vueGarage(store, 'strat');
  const onglet = (id, label) => `
    <button data-f1-tab="${id}" class="f1-tab ${ongletActif === id ? 'f1-tab-on' : ''}">${label}</button>`;
  return `
  <div class="f1-monde">
    <div class="f1-grille"></div>
    <div class="relative z-10 max-w-5xl mx-auto px-4 pb-16">
      <!-- Top bar -->
      <div class="flex flex-wrap items-center gap-3 pt-5 pb-6">
        <div>
          <p class="f1-titre text-2xl sm:text-3xl leading-none">NIGHT&nbsp;SERIES</p>
          <p class="f1-sous-titre text-[11px] tracking-[0.35em] mt-1">SAISON ${champ.saison} · DUEL PS5</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          ${onglet('championnat', '🏆 Championnat')}
          ${onglet('garage', '🔧 Garage')}
          ${onglet('strat', '📋 Stratégie')}
          <button id="f1-retour" class="f1-tab" style="border-color:rgba(255,255,255,0.15);color:#9ca3af">← Horizon</button>
        </div>
      </div>
      ${contenu}
      <p class="text-center text-[10px] mt-10" style="color:#6d5a8f">NIGHT SERIES · classement commun synchronisé · setups &amp; stratégies personnels</p>
    </div>
  </div>`;
}

// ---- Vue Championnat ----
function vueChampionnat(store, champ) {
  const cl = classement(champ);
  const ordre = cl.p1.pts >= cl.p2.pts ? ['p1', 'p2'] : ['p2', 'p1'];
  const ecart = Math.abs(cl.p1.pts - cl.p2.pts);

  const cartePilote = (slot, rang) => {
    const p = champ.pilotes[slot];
    const e = ecurieDe(p.ecurie);
    const s = cl[slot];
    const leader = rang === 1;
    return `
    <button data-f1-pilote="${slot}" class="f1-carte text-left relative overflow-hidden flex-1 min-w-[260px] p-0" style="border-color:${leader ? e.couleur : 'rgba(255,255,255,0.08)'};box-shadow:${leader ? `0 0 24px ${e.couleur}44` : 'none'}">
      <div class="absolute left-0 top-0 bottom-0 w-1.5" style="background:${e.couleur};box-shadow:0 0 12px ${e.couleur}"></div>
      ${leader ? '<div class="f1-damier absolute right-0 top-0 w-16 h-3 opacity-40"></div>' : ''}
      <div class="p-4 pl-6">
        <div class="flex items-center gap-3">
          <span class="f1-titre text-3xl" style="color:${leader ? '#fff' : '#9ca3af'}">P${rang}</span>
          <span class="w-7 h-7 rounded-full flex-shrink-0 border-2 border-white/30" title="Casque" style="background:${p.casque};box-shadow:0 0 10px ${p.casque}"></span>
          <div class="min-w-0">
            <p class="f1-titre text-xl leading-none tracking-wider">${p.tri} <span class="text-base">${p.nat}</span></p>
            <p class="text-[10px] uppercase tracking-widest mt-0.5" style="color:${e.couleur}">${e.label} · ${p.nom}</p>
          </div>
          <div class="ml-auto text-right">
            <p class="f1-titre text-3xl leading-none" style="color:${e.couleur};text-shadow:0 0 14px ${e.couleur}88">${s.pts}</p>
            <p class="text-[9px] uppercase tracking-widest text-gray-500">pts</p>
          </div>
        </div>
        <div class="flex gap-4 mt-3 text-[10px] uppercase tracking-wider text-gray-400">
          <span>🏆 ${s.wins} victoire${s.wins > 1 ? 's' : ''}</span>
          <span>🍾 ${s.podiums} podium${s.podiums > 1 ? 's' : ''}</span>
          <span>🏁 ${s.courses} course${s.courses > 1 ? 's' : ''}</span>
          ${rang === 2 ? `<span style="color:#ff2d95">+${ecart} pts d'écart</span>` : ''}
        </div>
        <p class="text-[9px] text-gray-600 mt-2">Modifier mon profil pilote →</p>
      </div>
    </button>`;
  };

  const lignesGP = GP_2025.map((gp, i) => {
    const r = champ.resultats[gp.id] || {};
    const chipRes = (slot) => {
      const p = champ.pilotes[slot];
      const e = ecurieDe(p.ecurie);
      const pos = r[slot];
      const couru = pos !== undefined && pos !== null && pos !== '';
      return `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${couru ? '' : 'opacity-30'}"
        style="background:${e.couleur}1a;border:1px solid ${e.couleur}55;color:${e.couleur}">
        ${p.tri} ${posTxt(pos)}${couru && ptsPour(pos) > 0 ? ` · +${ptsPour(pos)}` : ''}</span>`;
    };
    const dispute = r.p1 !== undefined || r.p2 !== undefined;
    return `
    <button data-f1-gp-resultat="${gp.id}" class="w-full flex items-center gap-3 px-3 sm:px-4 py-2 text-left transition hover:bg-white/5 ${i % 2 ? 'bg-white/[0.02]' : ''}">
      <span class="f1-titre text-sm w-7 text-right flex-shrink-0" style="color:${dispute ? '#00e5ff' : '#4b3a6b'}">${String(i + 1).padStart(2, '0')}</span>
      <span class="text-xl flex-shrink-0">${gp.drapeau}</span>
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-bold text-gray-100 uppercase tracking-wide truncate">${gp.nom}</p>
        <p class="text-[10px] text-gray-500 truncate">${gp.circuit} · ${gp.date}</p>
      </div>
      <div class="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
        ${chipRes('p1')}${chipRes('p2')}
      </div>
    </button>`;
  }).join('');

  return `
    <div class="flex flex-wrap gap-3 mb-6">
      ${cartePilote(ordre[0], 1)}
      ${cartePilote(ordre[1], 2)}
    </div>
    <div class="f1-carte overflow-hidden">
      <div class="f1-bandeau px-4 py-2 flex items-center justify-between">
        <span class="f1-titre text-sm tracking-[0.25em]">CALENDRIER · ${GP_2025.length} GP</span>
        <span class="text-[9px] uppercase tracking-widest text-white/70">clique une course pour saisir le résultat</span>
      </div>
      <div class="divide-y divide-white/5">${lignesGP}</div>
    </div>`;
}

// ---- Vue Garage / Stratégie ----
const CHAMPS_SETUP = [
  ['Aérodynamique', [['aeroAv', 'Aileron avant'], ['aeroAr', 'Aileron arrière']]],
  ['Transmission', [['diffAccel', 'Différentiel accél. (%)'], ['diffFrein', 'Différentiel décél. (%)'], ['freinMoteur', 'Frein moteur']]],
  ['Géométrie', [['carrossAv', 'Carrossage avant'], ['carrossAr', 'Carrossage arrière'], ['pinceAv', 'Pince avant'], ['pinceAr', 'Pince arrière']]],
  ['Suspension', [['suspAv', 'Suspension avant'], ['suspAr', 'Suspension arrière'], ['antiRoulisAv', 'Anti-roulis avant'], ['antiRoulisAr', 'Anti-roulis arrière'], ['hautAv', 'Hauteur avant'], ['hautAr', 'Hauteur arrière']]],
  ['Freins', [['pressionFreins', 'Pression (%)'], ['repartFreins', 'Répartition (%)']]],
  ['Pneus', [['psiAv', 'Pression avant (psi)'], ['psiAr', 'Pression arrière (psi)']]],
];

function vueGarage(store, mode) {
  const garage = store.get('f1Garage') || {};
  const gp = GP_2025.find(g => g.id === gpActif) || GP_2025[0];
  const fiche = garage[gp.id] || {};
  const setup = fiche.setup || {};
  const strat = fiche.strat || {};

  const selecteur = `
    <div class="flex gap-1.5 overflow-x-auto pb-2 mb-4" style="scrollbar-width:thin">
      ${GP_2025.map(g => {
        const rempli = garage[g.id] && (mode === 'setup' ? garage[g.id].setup : garage[g.id].strat);
        return `
      <button data-f1-gp-select="${g.id}" title="${g.nom}" class="f1-puce-gp ${g.id === gpActif ? 'f1-puce-gp-on' : ''}">
        <span class="text-base leading-none">${g.drapeau}</span>
        <span class="text-[8px] uppercase font-bold tracking-wider">${g.id}</span>
        ${rempli ? '<span class="w-1 h-1 rounded-full" style="background:#00e5ff;box-shadow:0 0 5px #00e5ff"></span>' : ''}
      </button>`;
      }).join('')}
    </div>`;

  const entete = `
    <div class="flex items-center gap-3 mb-4">
      <span class="text-3xl">${gp.drapeau}</span>
      <div>
        <p class="f1-titre text-xl uppercase">${gp.nom}</p>
        <p class="text-[10px] text-gray-500 uppercase tracking-widest">${gp.circuit} · ${gp.date} · fiche personnelle</p>
      </div>
    </div>`;

  if (mode === 'setup') {
    const blocs = CHAMPS_SETUP.map(([titre, champs]) => `
      <div class="f1-carte p-4">
        <p class="f1-sous-titre text-[10px] tracking-[0.3em] mb-3">${titre.toUpperCase()}</p>
        <div class="grid grid-cols-2 gap-2">
          ${champs.map(([id, label]) => `
          <div>
            <label class="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">${label}</label>
            <input data-f1-setup="${id}" type="text" inputmode="decimal" value="${setup[id] ?? ''}" class="f1-input w-full">
          </div>`).join('')}
        </div>
      </div>`).join('');
    return `${selecteur}${entete}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${blocs}
        <div class="f1-carte p-4 sm:col-span-2">
          <p class="f1-sous-titre text-[10px] tracking-[0.3em] mb-2">NOTES</p>
          <textarea data-f1-setup="notes" rows="2" class="f1-input w-full" placeholder="Survirage T3, prendre le vibreur à...">${setup.notes || ''}</textarea>
        </div>
      </div>
      <button id="f1-save-setup" class="f1-bouton mt-4">💾 Enregistrer le setup</button>`;
  }

  return `${selecteur}${entete}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="f1-carte p-4">
        <p class="f1-sous-titre text-[10px] tracking-[0.3em] mb-3">PLAN DE COURSE</p>
        <label class="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">Pneus de départ</label>
        <select data-f1-strat="depart" class="f1-input w-full mb-2">${PNEUS.map(p => `<option value="${p.value}" ${strat.depart === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
        <label class="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">Nombre d'arrêts</label>
        <input data-f1-strat="arrets" type="text" inputmode="numeric" value="${strat.arrets ?? ''}" class="f1-input w-full mb-2">
        <label class="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">Relais (composé + tours)</label>
        <textarea data-f1-strat="relais" rows="3" class="f1-input w-full" placeholder="M 1-18 → H 19-44">${strat.relais || ''}</textarea>
      </div>
      <div class="f1-carte p-4">
        <p class="f1-sous-titre text-[10px] tracking-[0.3em] mb-3">CONDITIONS &amp; DÉBRIEF</p>
        <label class="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">Météo / température</label>
        <input data-f1-strat="meteo" type="text" value="${strat.meteo || ''}" class="f1-input w-full mb-2" placeholder="Sec, piste 34°">
        <label class="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">ERS / essence</label>
        <input data-f1-strat="ers" type="text" value="${strat.ers || ''}" class="f1-input w-full mb-2" placeholder="ERS hotlap T1, essence standard">
        <label class="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">Débrief après course</label>
        <textarea data-f1-strat="debrief" rows="3" class="f1-input w-full" placeholder="Undercut gagnant au tour 17…">${strat.debrief || ''}</textarea>
      </div>
    </div>
    <button id="f1-save-strat" class="f1-bouton mt-4">💾 Enregistrer la stratégie</button>`;
}

// ============================================================
// MOUNT
// ============================================================
export function mount(store, navigate) {
  // Sync du championnat commun : charge puis écoute le document partagé.
  // Le rafraîchissement ne se déclenche que si on est toujours sur la page F1.
  if (isConfigured()) {
    loadSharedDoc('f1-championnat').then(distant => {
      if (adopterSiPlusRecent(store, distant) && surPageF1()) navigate('f1');
    });
    if (!_unsubShared) {
      _unsubShared = subscribeSharedDoc('f1-championnat', (distant) => {
        if (adopterSiPlusRecent(store, distant) && surPageF1()) navigate('f1');
      });
    }
  }

  document.getElementById('f1-retour')?.addEventListener('click', () => navigate('suivi-depenses'));
  document.querySelectorAll('[data-f1-tab]').forEach(btn => {
    btn.addEventListener('click', () => { ongletActif = btn.dataset.f1Tab; navigate('f1'); });
  });
  document.querySelectorAll('[data-f1-gp-select]').forEach(btn => {
    btn.addEventListener('click', () => { gpActif = btn.dataset.f1GpSelect; navigate('f1'); });
  });

  // ---- Saisie d'un résultat de course (commun) ----
  document.querySelectorAll('[data-f1-gp-resultat]').forEach(btn => {
    btn.addEventListener('click', () => {
      const gp = GP_2025.find(g => g.id === btn.dataset.f1GpResultat);
      if (!gp) return;
      const champ = getChamp(store);
      const r = champ.resultats[gp.id] || {};
      const options = ['<option value="">— non couru —</option>']
        .concat(Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">P${i + 1}${i < 10 ? ' · ' + BAREME[i] + ' pts' : ''}</option>`))
        .concat(['<option value="DNF">DNF · abandon</option>']).join('');
      const sel = (slot) => {
        const p = champ.pilotes[slot];
        const e = ecurieDe(p.ecurie);
        const cur = r[slot];
        return `
        <div class="mb-3">
          <label class="block text-xs font-semibold mb-1" style="color:${e.couleur}">${p.tri} — ${p.nom}</label>
          <select id="f1-res-${slot}" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm">${options}</select>
        </div>`;
      };
      openModal(`${gp.drapeau} ${gp.nom} — résultat`, sel('p1') + sel('p2') + '<p class="text-[10px] text-gray-500">Barème 2025 : 25-18-15-12-10-8-6-4-2-1, pas de point bonus. Résultat partagé entre les deux pilotes.</p>', () => {
        const lire = (slot) => {
          const v = document.getElementById(`f1-res-${slot}`)?.value;
          return v === '' ? undefined : (v === 'DNF' ? 'DNF' : Number(v));
        };
        const nv = {};
        const v1 = lire('p1'); if (v1 !== undefined) nv.p1 = v1;
        const v2 = lire('p2'); if (v2 !== undefined) nv.p2 = v2;
        const c = getChamp(store);
        if (Object.keys(nv).length === 0) delete c.resultats[gp.id];
        else c.resultats[gp.id] = nv;
        pousserChamp(store, c);
        showToast(`${gp.nom} enregistré 🏁`, 'success', 2500);
        navigate('f1');
      });
      // Pré-sélection
      setTimeout(() => {
        ['p1', 'p2'].forEach(slot => {
          const el = document.getElementById(`f1-res-${slot}`);
          if (el && r[slot] !== undefined) el.value = String(r[slot]);
        });
      }, 0);
    });
  });

  // ---- Profil pilote (écurie, trigramme, nationalité, casque) ----
  document.querySelectorAll('[data-f1-pilote]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = btn.dataset.f1Pilote;
      const champ = getChamp(store);
      const p = champ.pilotes[slot];
      const monSlot = getMonSlot(store);
      const body = `
        ${inputField('nom', 'Prénom', p.nom)}
        <div class="grid grid-cols-2 gap-2">
          <div>${inputField('tri', 'Trigramme (3 lettres)', p.tri, 'text', 'maxlength="3" style="text-transform:uppercase"')}</div>
          <div>${inputField('nat', 'Nationalité (emoji drapeau)', p.nat, 'text', 'placeholder="🇫🇷"')}</div>
        </div>
        ${selectField('ecurie', 'Écurie', ECURIES, p.ecurie)}
        <div class="mb-3">
          <label class="block text-sm font-medium text-gray-300 mb-1.5">Couleur de casque</label>
          <input type="color" id="f1-casque" value="${p.casque || '#E10600'}" class="w-full h-10 rounded-lg bg-dark-800 border border-dark-400/50 cursor-pointer">
        </div>
        <label class="flex items-center gap-2 cursor-pointer mb-1">
          <input type="checkbox" id="f1-cest-moi" ${monSlot === slot ? 'checked' : ''} class="w-4 h-4 rounded border-dark-400 bg-dark-900 text-red-500">
          <span class="text-xs text-gray-300">C'est moi (ce profil est le mien sur cet appareil)</span>
        </label>`;
      openModal(`Pilote ${p.tri}`, body, () => {
        const data = getFormData(document.getElementById('modal-body'));
        if (!data.tri || data.tri.length < 2) { showModalError('Trigramme : 2 ou 3 lettres.'); return false; }
        const c = getChamp(store);
        const cible = c.pilotes[slot];
        cible.nom = data.nom || cible.nom;
        cible.tri = (data.tri || cible.tri).toUpperCase().slice(0, 3);
        cible.nat = data.nat || cible.nat;
        cible.ecurie = document.getElementById('ecurie')?.value || cible.ecurie;
        cible.casque = document.getElementById('f1-casque')?.value || cible.casque;
        if (document.getElementById('f1-cest-moi')?.checked) {
          store.set('f1MonSlot', slot);
          const email = getCurrentUser?.()?.email || '';
          if (email) cible.email = email;
        }
        pousserChamp(store, c);
        showToast('Profil pilote mis à jour 🏎', 'success', 2000);
        navigate('f1');
      });
    });
  });

  // ---- Sauvegarde setup / stratégie (individuel) ----
  const sauverFiche = (mode, selecteurAttr) => {
    const garage = store.get('f1Garage') || {};
    const fiche = garage[gpActif] || {};
    const obj = {};
    document.querySelectorAll(`[${selecteurAttr}]`).forEach(el => {
      const cle = el.getAttribute(selecteurAttr);
      const v = (el.value || '').trim();
      if (v !== '') obj[cle] = v;
    });
    fiche[mode] = obj;
    garage[gpActif] = fiche;
    store.set('f1Garage', garage);
    showToast(mode === 'setup' ? 'Setup enregistré 🔧' : 'Stratégie enregistrée 📋', 'success', 2000);
    navigate('f1');
  };
  document.getElementById('f1-save-setup')?.addEventListener('click', () => sauverFiche('setup', 'data-f1-setup'));
  document.getElementById('f1-save-strat')?.addEventListener('click', () => sauverFiche('strat', 'data-f1-strat'));
}
