import { openModal, inputField, selectField, getFormData, showToast, showModalError, confirmModal, promptModal } from '../utils.js?v=20260809m';
import { getCurrentUser, saveSharedDoc, loadSharedDoc, subscribeSharedDoc, isConfigured } from '../firebase-config.js';

// ============================================================
// PADDOCK F1 — univers séparé d'Horizon (duel Sylvain / Florian sur PS5)
// Saison 2025, courses classiques (pas de sprint), barème FIA 25-18-15…
// Classement COMMUN via document Firestore partagé shared/f1-championnat ;
// setups & stratégies INDIVIDUELS (store perso). Aucune dépendance Horizon.
// ============================================================

const BAREME = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Tracés : silhouettes SVG stylisées (viewBox 0 0 100 60), pas des relevés exacts
const GP_2025 = [
  { id: 'aus', nom: 'Australie', circuit: 'Albert Park · Melbourne', iso: 'au', date: '16 mars',
    trace: 'M15 45 Q10 38 14 32 Q20 24 30 22 Q40 20 48 15 Q56 10 66 12 Q76 14 82 20 Q88 26 84 32 Q78 38 68 38 Q60 38 54 42 Q46 48 34 48 Q22 48 15 45 Z' },
  { id: 'chn', nom: 'Chine', circuit: 'Shanghai International', iso: 'cn', date: '23 mars',
    trace: 'M20 48 Q12 44 14 36 Q16 28 26 26 Q36 24 38 18 Q40 12 32 12 Q26 12 26 18 Q26 24 34 26 L78 26 Q88 26 88 34 Q88 42 78 44 L30 50 Q24 50 20 48 Z' },
  { id: 'jpn', nom: 'Japon', circuit: 'Suzuka', iso: 'jp', date: '6 avril',
    trace: 'M18 44 Q10 38 16 30 Q22 22 34 24 Q46 26 54 20 Q60 14 70 14 Q82 14 84 24 Q86 34 74 34 Q62 34 56 28 Q50 22 42 30 Q34 38 44 42 Q54 46 66 42 L74 40 Q82 38 84 44 Q84 50 74 50 L30 50 Q22 50 18 44 Z' },
  { id: 'bhr', nom: 'Bahreïn', circuit: 'Sakhir', iso: 'bh', date: '13 avril',
    trace: 'M16 46 L20 30 Q22 24 30 24 L44 24 L48 14 Q50 10 56 12 L64 16 Q70 18 68 24 L64 32 L78 34 Q86 36 84 42 Q82 48 72 48 L24 50 Q16 50 16 46 Z' },
  { id: 'sau', nom: 'Arabie saoudite', circuit: 'Djeddah Corniche', iso: 'sa', date: '20 avril',
    trace: 'M12 42 Q10 36 18 34 L36 30 L40 24 L52 22 L56 16 Q60 12 66 14 Q72 16 70 22 L84 24 Q90 28 86 34 Q82 38 74 36 L60 40 L56 46 L40 44 L30 48 Q16 52 12 42 Z' },
  { id: 'mia', nom: 'Miami', circuit: 'Miami International', iso: 'us', date: '4 mai',
    trace: 'M14 40 Q12 32 22 30 L60 26 Q66 26 68 20 Q70 14 78 16 Q86 18 84 26 Q82 32 74 32 L70 38 Q66 44 56 42 L40 40 Q34 46 26 46 Q16 46 14 40 Z' },
  { id: 'emi', nom: 'Émilie-Romagne', circuit: 'Imola', iso: 'it', date: '18 mai',
    trace: 'M14 44 Q10 38 18 34 L30 30 Q36 28 38 22 Q40 16 48 16 L62 18 Q70 18 72 24 L76 34 Q84 36 82 42 Q80 48 70 46 L26 48 Q18 48 14 44 Z' },
  { id: 'mon', nom: 'Monaco', circuit: 'Monte-Carlo', iso: 'mc', date: '25 mai',
    trace: 'M16 42 Q14 36 22 34 L36 32 Q42 30 44 24 Q46 18 54 18 Q62 18 62 24 Q62 28 56 30 L66 34 Q74 36 78 32 Q84 28 86 34 Q88 40 80 42 L60 44 Q52 50 42 48 L24 46 Q18 46 16 42 Z' },
  { id: 'esp', nom: 'Espagne', circuit: 'Barcelona-Catalunya', iso: 'es', date: '1 juin',
    trace: 'M16 44 Q12 36 22 32 L38 28 Q44 26 50 20 Q56 14 64 16 Q74 18 72 26 Q70 32 62 32 L74 38 Q82 42 76 46 Q70 50 60 46 L30 48 Q20 50 16 44 Z' },
  { id: 'can', nom: 'Canada', circuit: 'Gilles-Villeneuve · Montréal', iso: 'ca', date: '15 juin',
    trace: 'M10 40 Q8 34 16 32 L66 20 Q74 18 80 22 Q88 26 84 32 Q80 36 72 34 L60 38 L68 40 Q76 42 72 46 Q68 50 58 46 L20 44 Q12 44 10 40 Z' },
  { id: 'aut', nom: 'Autriche', circuit: 'Red Bull Ring · Spielberg', iso: 'at', date: '29 juin',
    trace: 'M18 46 L26 24 Q28 18 36 18 L66 16 Q76 16 78 24 Q80 30 70 32 L36 44 Q26 50 18 46 Z' },
  { id: 'gbr', nom: 'Grande-Bretagne', circuit: 'Silverstone', iso: 'gb', date: '6 juillet',
    trace: 'M14 38 Q12 30 22 28 L34 26 Q40 24 42 18 Q44 12 54 12 Q64 12 64 20 Q64 26 56 28 L70 30 Q80 30 82 38 Q84 46 72 46 L48 44 Q40 50 30 48 Q18 46 14 38 Z' },
  { id: 'bel', nom: 'Belgique', circuit: 'Spa-Francorchamps', iso: 'be', date: '27 juillet',
    trace: 'M12 46 L20 30 Q24 22 32 20 L54 14 Q62 12 66 18 L84 38 Q90 44 82 48 L26 50 Q14 52 12 46 Z' },
  { id: 'hun', nom: 'Hongrie', circuit: 'Hungaroring · Budapest', iso: 'hu', date: '3 août',
    trace: 'M16 42 Q12 34 22 30 Q30 26 36 20 Q42 14 52 16 Q62 18 60 26 Q58 32 50 32 Q60 36 70 34 Q80 32 82 38 Q84 46 72 46 L28 48 Q18 48 16 42 Z' },
  { id: 'ned', nom: 'Pays-Bas', circuit: 'Zandvoort', iso: 'nl', date: '31 août',
    trace: 'M18 44 Q12 38 18 32 Q24 26 34 26 Q40 26 44 20 Q48 14 58 14 Q70 14 72 22 Q74 30 64 32 L74 38 Q80 42 74 46 Q66 50 56 46 L28 48 Q20 48 18 44 Z' },
  { id: 'ita', nom: 'Italie', circuit: 'Monza', iso: 'it', date: '7 septembre',
    trace: 'M14 44 L20 22 Q22 16 30 16 L78 14 Q86 14 86 22 Q86 28 78 28 L40 32 L74 38 Q82 40 78 46 L24 48 Q14 50 14 44 Z' },
  { id: 'aze', nom: 'Azerbaïdjan', circuit: 'Bakou City', iso: 'az', date: '21 septembre',
    trace: 'M12 44 L16 30 Q18 26 24 26 L40 24 L42 16 L52 14 L54 22 L80 20 Q88 20 86 28 Q84 34 76 32 L70 42 Q66 48 56 46 L20 48 Q12 48 12 44 Z' },
  { id: 'sgp', nom: 'Singapour', circuit: 'Marina Bay', iso: 'sg', date: '5 octobre',
    trace: 'M14 42 L18 28 L30 26 L34 18 L48 16 L52 24 L72 22 L84 26 L80 36 L64 38 L60 46 L40 44 L24 48 L14 42 Z' },
  { id: 'usa', nom: 'États-Unis', circuit: 'COTA · Austin', iso: 'us', date: '19 octobre',
    trace: 'M16 44 Q12 36 20 32 L30 28 L34 16 Q36 10 44 14 L52 20 Q58 24 66 20 Q76 16 80 24 Q84 32 74 34 L62 36 Q70 42 62 46 L28 48 Q18 48 16 44 Z' },
  { id: 'mex', nom: 'Mexique', circuit: 'Hermanos Rodríguez', iso: 'mx', date: '26 octobre',
    trace: 'M14 42 L18 30 Q20 26 28 26 L74 22 Q84 22 84 30 Q84 36 74 36 L52 38 Q46 44 38 42 L34 48 L22 48 Q14 48 14 42 Z' },
  { id: 'bra', nom: 'Brésil', circuit: 'Interlagos · São Paulo', iso: 'br', date: '9 novembre',
    trace: 'M16 40 Q12 32 22 28 Q30 26 34 20 Q38 14 48 16 Q56 18 54 26 L64 24 Q74 22 78 28 Q82 36 72 40 L60 42 Q52 50 40 46 L24 46 Q18 44 16 40 Z' },
  { id: 'las', nom: 'Las Vegas', circuit: 'Las Vegas Strip', iso: 'us', date: '22 novembre',
    trace: 'M14 46 L18 36 Q20 32 28 32 L70 30 L74 18 Q76 12 84 14 Q90 16 86 24 L82 40 Q80 46 70 46 L22 50 Q14 50 14 46 Z' },
  { id: 'qat', nom: 'Qatar', circuit: 'Losail', iso: 'qa', date: '30 novembre',
    trace: 'M16 42 Q12 34 22 30 L36 26 Q44 24 50 18 Q56 12 66 14 Q76 16 74 24 Q72 30 62 30 L76 36 Q84 40 78 46 L28 48 Q18 48 16 42 Z' },
  { id: 'abu', nom: 'Abou Dabi', circuit: 'Yas Marina', iso: 'ae', date: '7 décembre',
    trace: 'M14 40 Q12 32 22 30 L34 28 L38 18 Q40 12 50 14 L58 18 Q64 20 62 26 L58 32 L74 30 Q84 30 84 38 Q84 46 72 46 L26 48 Q16 48 14 40 Z' },
];

// Drapeaux en images (les emoji drapeaux ne s'affichent pas sous Windows)
const drapeau = (iso, cls = 'w-6 h-4') => `<img src="https://flagcdn.com/w40/${iso}.png" alt="${iso}" loading="lazy" class="${cls} rounded-[2px] object-cover flex-shrink-0" style="box-shadow:0 0 4px rgba(0,0,0,0.5)">`;

// Nationalité : iso2 stocké ; convertit les anciens emoji drapeaux (🇫🇷 → fr)
function natIso(nat) {
  if (!nat) return 'fr';
  if (/^[a-z]{2}$/i.test(nat)) return nat.toLowerCase();
  const lettres = [...String(nat)].map(c => {
    const cp = c.codePointAt(0);
    return (cp >= 0x1F1E6 && cp <= 0x1F1FF) ? String.fromCharCode(97 + cp - 0x1F1E6) : '';
  }).join('');
  return /^[a-z]{2}$/.test(lettres) ? lettres : 'fr';
}

const NATIONS = [
  ['fr', 'France'], ['be', 'Belgique'], ['ch', 'Suisse'], ['mc', 'Monaco'], ['gb', 'Royaume-Uni'],
  ['it', 'Italie'], ['es', 'Espagne'], ['de', 'Allemagne'], ['nl', 'Pays-Bas'], ['pt', 'Portugal'],
  ['us', 'États-Unis'], ['ca', 'Canada'], ['br', 'Brésil'], ['ar', 'Argentine'], ['mx', 'Mexique'],
  ['jp', 'Japon'], ['au', 'Australie'], ['ma', 'Maroc'], ['dz', 'Algérie'], ['sn', 'Sénégal'],
];

// Vrais tracés : cartes officielles formula1.com (tracé blanc, fond transparent).
// Si l'image ne charge pas, repli sur la silhouette SVG stylisée.
const F1_MAPS = {
  aus: 'Australia', chn: 'China', jpn: 'Japan', bhr: 'Bahrain', sau: 'Saudi_Arabia', mia: 'Miami',
  emi: 'Emilia_Romagna', mon: 'Monaco', esp: 'Spain', can: 'Canada', aut: 'Austria', gbr: 'Great_Britain',
  bel: 'Belgium', hun: 'Hungary', ned: 'Netherlands', ita: 'Italy', aze: 'Baku', sgp: 'Singapore',
  usa: 'USA', mex: 'Mexico', bra: 'Brazil', las: 'Las_Vegas', qat: 'Qatar', abu: 'Abu_Dhabi',
};

const traceSvg = (gp, cls = 'w-16 h-10', couleur = '#00e5ff') => `
  <span class="${cls} flex-shrink-0 inline-block">
    <img src="https://media.formula1.com/image/upload/f_auto,q_auto,w_320/content/dam/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/${F1_MAPS[gp.id]}_Circuit.png"
      alt="Tracé ${gp.nom}" loading="lazy" class="w-full h-full object-contain"
      style="filter:drop-shadow(0 0 4px ${couleur}66)"
      onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
    <svg viewBox="0 0 100 60" fill="none" class="w-full h-full" style="display:none">
      <path d="${gp.trace}" stroke="rgba(255,255,255,0.12)" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${gp.trace}" stroke="${couleur}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
  </span>`;

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
// Couleur du pilote : personnalisée si définie, sinon celle de son écurie
const couleurPilote = (p) => p.couleur || ecurieDe(p.ecurie).couleur;

const PNEUS = [
  { value: 'S', label: '🔴 Soft' }, { value: 'M', label: '🟡 Medium' }, { value: 'H', label: '⚪ Hard' },
  { value: 'I', label: '🟢 Inter' }, { value: 'W', label: '🔵 Pluie' },
];

// ---- state ----
let ongletActif = 'championnat'; // championnat | paddock | palmares
let gpActif = GP_2025[0].id;
let varianteActive = null; // id de la variante de setup affichée (null = première)
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
  if (ongletActif === 'garage' || ongletActif === 'strat') ongletActif = 'paddock';
  const contenu = ongletActif === 'championnat' ? vueChampionnat(store, champ)
    : ongletActif === 'palmares' ? vuePalmares(store, champ)
    : vuePaddock(store);
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
          <p class="f1-sous-titre text-[11px] tracking-[0.2em] mt-1">SAISON ${champ.saison} · DUEL PS5</p>
        </div>
        <div class="ml-auto flex items-center gap-2">
          ${onglet('championnat', '🏆 Championnat')}
          ${onglet('paddock', '🔧 Paddock')}
          ${onglet('palmares', '🏅 Palmarès')}
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
    const e = { ...ecurieDe(p.ecurie), couleur: couleurPilote(p) };
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
            <p class="f1-titre text-xl leading-none tracking-wider flex items-center gap-2">${p.tri} ${drapeau(natIso(p.nat), 'w-5 h-3.5')}</p>
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
      const e = { ...ecurieDe(p.ecurie), couleur: couleurPilote(p) };
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
      ${drapeau(gp.iso, 'w-7 h-5')}
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-bold text-gray-100 uppercase tracking-wide truncate">${gp.nom}</p>
        <p class="text-[10px] text-gray-500 truncate">${gp.circuit} · ${gp.date}</p>
      </div>
      <span class="hidden md:block">${traceSvg(gp, 'w-14 h-9', dispute ? '#00e5ff' : '#5b4a7d')}</span>
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
        <span class="f1-titre text-sm tracking-[0.15em]">CALENDRIER · ${GP_2025.length} GP</span>
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

// Variantes de setup : migre l'ancien format { setup: {...} } vers { setups: [{id, nom, ...}] }
function getSetups(fiche) {
  if (Array.isArray(fiche.setups) && fiche.setups.length) return fiche.setups;
  if (fiche.setup && Object.keys(fiche.setup).length) return [{ id: 'std', nom: 'Course', ...fiche.setup }];
  return [{ id: 'std', nom: 'Course' }];
}

function vuePaddock(store) {
  const garage = store.get('f1Garage') || {};
  const gp = GP_2025.find(g => g.id === gpActif) || GP_2025[0];
  const fiche = garage[gp.id] || {};
  const setups = getSetups(fiche);
  const setupActif = setups.find(s => s.id === varianteActive) || setups[0];
  const strat = fiche.strat || {};

  const selecteur = `
    <div class="flex gap-1.5 overflow-x-auto pb-2 mb-4" style="scrollbar-width:thin">
      ${GP_2025.map(g => {
        const f = garage[g.id];
        const rempli = f && ((f.setups && f.setups.length) || f.setup || f.strat);
        return `
      <button data-f1-gp-select="${g.id}" title="${g.nom}" class="f1-puce-gp ${g.id === gpActif ? 'f1-puce-gp-on' : ''}">
        ${drapeau(g.iso, 'w-6 h-4')}
        <span class="text-[8px] uppercase font-bold tracking-wider">${g.id}</span>
        ${rempli ? '<span class="w-1 h-1 rounded-full" style="background:#00e5ff;box-shadow:0 0 5px #00e5ff"></span>' : ''}
      </button>`;
      }).join('')}
    </div>`;

  const entete = `
    <div class="flex flex-wrap items-center gap-3 mb-4">
      ${drapeau(gp.iso, 'w-10 h-7')}
      <div class="flex-1 min-w-[180px]">
        <p class="f1-titre text-xl uppercase">${gp.nom}</p>
        <p class="text-[10px] text-gray-500 uppercase tracking-widest">${gp.circuit} · ${gp.date} · fiche personnelle</p>
      </div>
      ${traceSvg(gp, 'w-28 h-16', '#ff2d95')}
    </div>`;

  const ongletsVariantes = `
    <div class="flex flex-wrap items-center gap-1.5 mb-3">
      ${setups.map(s => `
      <button data-f1-variante="${s.id}" class="f1-tab ${s.id === setupActif.id ? 'f1-tab-on' : ''}" style="font-size:10px;padding:0.25rem 0.6rem">${s.nom}</button>`).join('')}
      <button id="f1-add-variante" class="f1-tab" style="font-size:10px;padding:0.25rem 0.6rem;border-style:dashed" title="Nouvelle variante (Pluie, Qualif…)">+ variante</button>
      ${setups.length > 1 ? `<button id="f1-del-variante" class="f1-tab" style="font-size:10px;padding:0.25rem 0.6rem;border-color:rgba(255,45,149,0.4);color:#ff8fc0" title="Supprimer la variante affichée">✕</button>` : ''}
    </div>`;

  const blocsSetup = CHAMPS_SETUP.map(([titre, champs]) => `
    <div class="mb-3">
      <p class="f1-sous-titre text-[10px] tracking-[0.15em] mb-2">${titre.toUpperCase()}</p>
      <div class="grid grid-cols-2 gap-2">
        ${champs.map(([id, label]) => `
        <div>
          <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">${label}</label>
          <input data-f1-setup="${id}" type="text" inputmode="decimal" value="${setupActif[id] ?? ''}" class="f1-input w-full">
        </div>`).join('')}
      </div>
    </div>`).join('');

  return `${selecteur}${entete}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      <div class="f1-carte p-4">
        <p class="f1-sous-titre text-[11px] tracking-[0.15em] mb-2">🔧 SETUP</p>
        ${ongletsVariantes}
        ${blocsSetup}
        <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Notes</label>
        <textarea data-f1-setup="notes" rows="2" class="f1-input w-full" placeholder="Survirage T3, vibreur à éviter…">${setupActif.notes || ''}</textarea>
        <button id="f1-save-setup" class="f1-bouton mt-3">💾 Enregistrer « ${setupActif.nom} »</button>
      </div>
      <div class="f1-carte p-4">
        <p class="f1-sous-titre text-[11px] tracking-[0.15em] mb-3">📋 STRATÉGIE</p>
        <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Pneus de départ</label>
        <select data-f1-strat="depart" class="f1-input w-full mb-2">${PNEUS.map(p => `<option value="${p.value}" ${strat.depart === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}</select>
        <div class="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Nombre d'arrêts</label>
            <input data-f1-strat="arrets" type="text" inputmode="numeric" value="${strat.arrets ?? ''}" class="f1-input w-full">
          </div>
          <div>
            <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Météo / température</label>
            <input data-f1-strat="meteo" type="text" value="${strat.meteo || ''}" class="f1-input w-full" placeholder="Sec, piste 34°">
          </div>
        </div>
        <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Relais (composé + tours)</label>
        <textarea data-f1-strat="relais" rows="3" class="f1-input w-full mb-2" placeholder="M 1-18 → H 19-44">${strat.relais || ''}</textarea>
        <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">ERS / essence</label>
        <input data-f1-strat="ers" type="text" value="${strat.ers || ''}" class="f1-input w-full mb-2" placeholder="ERS hotlap T1, essence standard">
        <label class="block text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Débrief après course</label>
        <textarea data-f1-strat="debrief" rows="3" class="f1-input w-full" placeholder="Undercut gagnant au tour 17…">${strat.debrief || ''}</textarea>
        <button id="f1-save-strat" class="f1-bouton mt-3">💾 Enregistrer la stratégie</button>
      </div>
    </div>`;
}

// ---- Vue Palmarès ----
function vuePalmares(store, champ) {
  const cl = classement(champ);
  const p1 = champ.pilotes.p1, p2 = champ.pilotes.p2;
  const c1 = couleurPilote(p1), c2 = couleurPilote(p2);

  // Duels gagnés (meilleure position que l'autre sur un même GP) et séries
  let duels1 = 0, duels2 = 0, serieCour = { slot: null, n: 0 }, serieMax = { slot: null, n: 0 };
  GP_2025.forEach(gp => {
    const r = champ.resultats[gp.id];
    if (!r || (r.p1 === undefined && r.p2 === undefined)) return;
    const v1 = r.p1 === 'DNF' ? 99 : (r.p1 ?? 98);
    const v2 = r.p2 === 'DNF' ? 99 : (r.p2 ?? 98);
    if (v1 === v2) { serieCour = { slot: null, n: 0 }; return; }
    const gagnant = v1 < v2 ? 'p1' : 'p2';
    if (gagnant === 'p1') duels1++; else duels2++;
    serieCour = serieCour.slot === gagnant ? { slot: gagnant, n: serieCour.n + 1 } : { slot: gagnant, n: 1 };
    if (serieCour.n > serieMax.n) serieMax = { ...serieCour };
  });

  const ligneStat = (label, va, vb) => `
    <div class="flex items-center gap-3 py-2 border-b border-white/5">
      <span class="w-14 text-right f1-titre text-lg" style="color:${c1}">${va}</span>
      <span class="flex-1 text-center text-[10px] uppercase tracking-widest text-gray-400">${label}</span>
      <span class="w-14 text-left f1-titre text-lg" style="color:${c2}">${vb}</span>
    </div>`;

  const historique = (champ.historique || []).slice().reverse();

  return `
    <div class="f1-carte p-4 mb-4">
      <div class="flex items-center justify-between mb-2">
        <p class="f1-sous-titre text-[11px] tracking-[0.15em]">FACE-À-FACE · SAISON ${champ.saison}</p>
        <span class="text-[9px] text-gray-500 uppercase">${duels1 + duels2} GP disputés</span>
      </div>
      <div class="flex items-center justify-between px-2 pb-1">
        <span class="f1-titre text-xl" style="color:${c1}">${p1.tri}</span>
        <span class="f1-titre text-xl" style="color:${c2}">${p2.tri}</span>
      </div>
      ${ligneStat('Points', cl.p1.pts, cl.p2.pts)}
      ${ligneStat('Victoires (P1)', cl.p1.wins, cl.p2.wins)}
      ${ligneStat('Podiums', cl.p1.podiums, cl.p2.podiums)}
      ${ligneStat('Duels gagnés', duels1, duels2)}
      <div class="flex justify-between text-[10px] text-gray-400 mt-2 px-2">
        <span>Série en cours : ${serieCour.n > 0 ? `<b style="color:${serieCour.slot === 'p1' ? c1 : c2}">${champ.pilotes[serieCour.slot].tri} × ${serieCour.n}</b>` : '—'}</span>
        <span>Meilleure série : ${serieMax.n > 0 ? `<b style="color:${serieMax.slot === 'p1' ? c1 : c2}">${champ.pilotes[serieMax.slot].tri} × ${serieMax.n}</b>` : '—'}</span>
      </div>
    </div>

    <div class="f1-carte overflow-hidden mb-4">
      <div class="f1-bandeau px-4 py-2"><span class="f1-titre text-sm tracking-[0.15em]">PALMARÈS</span></div>
      ${historique.length === 0 ? `
      <p class="px-4 py-5 text-xs text-gray-500">Aucune saison terminée pour l'instant. Le premier titre s'écrira ici, en lettres néon.</p>` : historique.map(h => `
      <div class="flex items-center gap-4 px-4 py-3 border-b border-white/5">
        <span class="f1-titre text-2xl" style="color:#ffd54a;text-shadow:0 0 10px rgba(255,213,74,0.4)">${h.saison}</span>
        <div class="flex-1">
          <p class="f1-titre text-lg" style="color:${h.championCouleur || '#fff'}">🏆 ${h.championTri}</p>
          <p class="text-[10px] text-gray-500 uppercase tracking-wider">${h.score} · ${h.detail || ''}</p>
        </div>
      </div>`).join('')}
    </div>

    <button id="f1-fin-saison" class="f1-bouton" style="background:linear-gradient(90deg,#7c3aed,#ff2d95)">🏁 Clôturer la saison ${champ.saison}</button>
    <p class="text-[9px] text-gray-500 mt-2">Le champion entre au palmarès, les résultats repartent à zéro pour la saison ${champ.saison + 1}. Profils et setups conservés.</p>`;
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
    btn.addEventListener('click', () => { gpActif = btn.dataset.f1GpSelect; varianteActive = null; navigate('f1'); });
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
        const e = { ...ecurieDe(p.ecurie), couleur: couleurPilote(p) };
        const cur = r[slot];
        return `
        <div class="mb-3">
          <label class="block text-xs font-semibold mb-1" style="color:${e.couleur}">${p.tri} — ${p.nom}</label>
          <select id="f1-res-${slot}" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm">${options}</select>
        </div>`;
      };
      openModal(`🏁 ${gp.nom} — résultat`, sel('p1') + sel('p2') + '<p class="text-[10px] text-gray-500">Barème 2025 : 25-18-15-12-10-8-6-4-2-1, pas de point bonus. Résultat partagé entre les deux pilotes.</p>', () => {
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
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Nationalité</label>
            <select id="f1-nat" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm">
              ${NATIONS.map(([iso, nomPays]) => `<option value="${iso}" ${natIso(p.nat) === iso ? 'selected' : ''}>${nomPays}</option>`).join('')}
            </select>
          </div>
        </div>
        ${selectField('ecurie', 'Écurie', ECURIES, p.ecurie)}
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Couleur d'écurie</label>
            <input type="color" id="f1-couleur" value="${couleurPilote(p)}" class="w-full h-10 rounded-lg bg-dark-800 border border-dark-400/50 cursor-pointer">
            <p class="text-[9px] text-gray-600 mt-0.5">Personnalisable — teinte tes points, chips et liserés</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1.5">Couleur de casque</label>
            <input type="color" id="f1-casque" value="${p.casque || '#E10600'}" class="w-full h-10 rounded-lg bg-dark-800 border border-dark-400/50 cursor-pointer">
          </div>
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
        cible.nat = document.getElementById('f1-nat')?.value || natIso(cible.nat);
        cible.ecurie = document.getElementById('ecurie')?.value || cible.ecurie;
        cible.couleur = document.getElementById('f1-couleur')?.value || cible.couleur;
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

  // ---- Paddock : variantes de setup ----
  document.querySelectorAll('[data-f1-variante]').forEach(btn => {
    btn.addEventListener('click', () => { varianteActive = btn.dataset.f1Variante; navigate('f1'); });
  });

  const licherFiche = () => {
    const garage = store.get('f1Garage') || {};
    const fiche = garage[gpActif] || {};
    fiche.setups = getSetups(fiche);
    delete fiche.setup; // migration ancien format
    garage[gpActif] = fiche;
    return { garage, fiche };
  };

  const lireChamps = (attr) => {
    const obj = {};
    document.querySelectorAll(`[${attr}]`).forEach(el => {
      const v = (el.value || '').trim();
      if (v !== '') obj[el.getAttribute(attr)] = v;
    });
    return obj;
  };

  document.getElementById('f1-add-variante')?.addEventListener('click', () => {
    promptModal('Nouvelle variante de setup', '', (nom) => {
      if (!nom || !nom.trim()) return;
      const { garage, fiche } = licherFiche();
      // La nouvelle variante part d'une copie des valeurs affichées
      const base = lireChamps('data-f1-setup');
      const nv = { id: 'v' + Date.now().toString(36), nom: nom.trim(), ...base };
      fiche.setups.push(nv);
      store.set('f1Garage', garage);
      varianteActive = nv.id;
      navigate('f1');
    }, { label: 'Nom de la variante', placeholder: 'Pluie, Qualif, Faible appui…' });
  });

  document.getElementById('f1-del-variante')?.addEventListener('click', () => {
    const { garage, fiche } = licherFiche();
    const actif = fiche.setups.find(s => s.id === varianteActive) || fiche.setups[0];
    if (fiche.setups.length <= 1) return;
    confirmModal(`Supprimer le setup « ${actif.nom} » ?`, 'Les autres variantes sont conservées.', () => {
      fiche.setups = fiche.setups.filter(s => s.id !== actif.id);
      store.set('f1Garage', garage);
      varianteActive = fiche.setups[0]?.id || null;
      navigate('f1');
    });
  });

  document.getElementById('f1-save-setup')?.addEventListener('click', () => {
    const { garage, fiche } = licherFiche();
    const actif = fiche.setups.find(s => s.id === varianteActive) || fiche.setups[0];
    const valeurs = lireChamps('data-f1-setup');
    Object.keys(actif).forEach(k => { if (k !== 'id' && k !== 'nom') delete actif[k]; });
    Object.assign(actif, valeurs);
    store.set('f1Garage', garage);
    showToast(`Setup « ${actif.nom} » enregistré 🔧`, 'success', 2000);
    navigate('f1');
  });

  document.getElementById('f1-save-strat')?.addEventListener('click', () => {
    const { garage, fiche } = licherFiche();
    fiche.strat = lireChamps('data-f1-strat');
    store.set('f1Garage', garage);
    showToast('Stratégie enregistrée 📋', 'success', 2000);
    navigate('f1');
  });

  // ---- Palmarès : clôture de saison ----
  document.getElementById('f1-fin-saison')?.addEventListener('click', () => {
    const champ = getChamp(store);
    const cl = classement(champ);
    const slotChampion = cl.p1.pts >= cl.p2.pts ? 'p1' : 'p2';
    const ch = champ.pilotes[slotChampion];
    confirmModal(`Clôturer la saison ${champ.saison} ?`,
      `${ch.tri} est sacré champion (${Math.max(cl.p1.pts, cl.p2.pts)} pts contre ${Math.min(cl.p1.pts, cl.p2.pts)}). Les résultats repartent à zéro pour ${champ.saison + 1}.`,
      () => {
        const c = getChamp(store);
        c.historique = c.historique || [];
        c.historique.push({
          saison: c.saison,
          championTri: ch.tri,
          championCouleur: couleurPilote(ch),
          score: `${cl.p1.pts} – ${cl.p2.pts} (${c.pilotes.p1.tri} / ${c.pilotes.p2.tri})`,
          detail: `${Math.max(cl.p1.wins, cl.p2.wins)} victoires pour le champion · ${cl.p1.courses} GP disputés`,
          resultats: JSON.parse(JSON.stringify(c.resultats)),
        });
        c.saison = c.saison + 1;
        c.resultats = {};
        pousserChamp(store, c);
        showToast(`🏆 ${ch.tri} champion ! Place à la saison ${c.saison}`, 'success', 4000);
        navigate('f1');
      });
  });
}
