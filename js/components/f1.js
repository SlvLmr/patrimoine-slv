import { openModal, inputField, selectField, getFormData, showToast, showModalError, confirmModal, promptModal } from '../utils.js?v=20260809m';
import { getCurrentUser, saveSharedDoc, loadSharedDoc, subscribeSharedDoc, isConfigured } from '../firebase-config.js';

// ============================================================
// PADDOCK F1 — univers séparé d'Horizon (duel Sylvain / Florian sur PS5)
// Saison 2025, courses classiques (pas de sprint), barème FIA 25-18-15…
// Classement COMMUN via document Firestore partagé shared/f1-championnat ;
// setups & stratégies INDIVIDUELS (store perso). Aucune dépendance Horizon.
// ============================================================

const BAREME = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Favicon propre à l'univers F1 : drapeau à damier sur fond nuit, liseré et traînées néon
export const F1_FAVICON = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#00e5ff'/><stop offset='100%' stop-color='#ff2d95'/></linearGradient></defs><rect width='32' height='32' rx='7' fill='#0d0221'/><rect x='1' y='1' width='30' height='30' rx='6' fill='none' stroke='url(#g)' stroke-width='1.5' stroke-opacity='0.85'/><path d='M8 5v22' stroke='#e5e7eb' stroke-width='2' stroke-linecap='round'/><rect x='10' y='5' width='16' height='12' fill='#1a0533' stroke='#ffffff' stroke-opacity='0.25' stroke-width='0.5'/><g fill='#ffffff'><rect x='10' y='5' width='4' height='4'/><rect x='18' y='5' width='4' height='4'/><rect x='14' y='9' width='4' height='4'/><rect x='22' y='9' width='4' height='4'/><rect x='10' y='13' width='4' height='4'/><rect x='18' y='13' width='4' height='4'/></g><rect x='12' y='21' width='16' height='2.2' rx='1.1' fill='#ff2d95'/><rect x='16' y='25' width='12' height='2.2' rx='1.1' fill='#00e5ff'/></svg>`);

// Tracés : silhouettes SVG stylisées (viewBox 0 0 100 60), pas des relevés exacts
const GP_2025 = [
  { id: 'aus', nom: 'Australie', circuit: 'Albert Park · Melbourne', iso: 'au', date: '16 mars',
    trace: 'M16 46 C8 42 8 34 15 31 C21 28 26 30 31 26 C36 22 34 16 42 13 C50 10 57 14 65 12 C72 10 78 7 87 10 C96 14 98 21 92 25 C86 29 78 25 72 29 C67 32 70 38 63 42 C56 46 47 42 38 46 C30 49 23 49 16 46 Z',
    km: 5.278, tours: 58, virages: 14, drs: 4,
    drsInfo: "4 zones — ligne droite des stands, T2→T3, T8→T9 et T10→T11. Le circuit le plus généreux du calendrier en DRS." },
  { id: 'chn', nom: 'Chine', circuit: 'Shanghai International', iso: 'cn', date: '23 mars',
    trace: 'M18 50 C9 48 7 41 13 37 L28 30 C35 26 37 19 32 15 C27 11 20 14 22 21 C24 27 33 27 40 25 L88 20 C97 19 99 27 91 30 L54 41 C44 44 30 53 18 50 Z',
    km: 5.451, tours: 56, virages: 16, drs: 2,
    drsInfo: "2 zones — l'immense ligne droite arrière (1,2 km, gros point de dépassement au bout) et la ligne des stands." },
  { id: 'jpn', nom: 'Japon', circuit: 'Suzuka', iso: 'jp', date: '6 avril',
    trace: 'M18 48 C9 43 10 33 20 29 L36 24 C43 22 46 16 53 12 C60 8 72 6 79 12 C86 18 82 27 73 27 C64 27 61 20 54 24 C47 28 44 35 36 39 L28 42 C23 44 25 48 32 48 L72 43 C81 41 87 46 80 51 L30 55 C21 57 26 51 18 48 Z',
    km: 5.807, tours: 53, virages: 18, drs: 1,
    drsInfo: "1 seule zone — ligne droite des stands. Dépassements rares : la qualif et l'undercut font la course." },
  { id: 'bhr', nom: 'Bahreïn', circuit: 'Sakhir', iso: 'bh', date: '13 avril',
    trace: 'M15 51 L21 32 C22 28 25 26 29 26 L42 26 L46 13 C47 9 52 7 56 9 L62 13 C66 15 66 19 62 23 L56 29 L76 31 C82 31 84 35 82 39 L78 46 C76 50 72 52 66 52 L22 54 C17 55 14 54 15 51 Z',
    km: 5.412, tours: 57, virages: 15, drs: 3,
    drsInfo: "3 zones — ligne des stands (vers T1, gros freinage), T3→T4 et T10→T11. Dépassements faciles." },
  { id: 'sau', nom: 'Arabie saoudite', circuit: 'Djeddah Corniche', iso: 'sa', date: '20 avril',
    trace: 'M9 46 C5 40 9 36 15 34 L32 29 L36 21 L47 18 L51 10 C53 6 59 4 63 8 C67 12 63 16 57 18 L82 14 C92 12 100 18 94 24 C90 28 82 26 74 28 L49 35 L45 43 L26 47 C18 51 13 52 9 46 Z',
    km: 6.174, tours: 50, virages: 27, drs: 3,
    drsInfo: "3 zones — dont la ligne des stands et la portion avant le dernier virage. Circuit le plus rapide du calendrier en moyenne." },
  { id: 'mia', nom: 'Miami', circuit: 'Miami International', iso: 'us', date: '4 mai',
    trace: 'M13 43 C7 37 11 29 21 27 L55 22 C61 21 63 14 69 11 C75 8 85 8 89 14 C93 20 87 26 79 26 L71 28 C77 34 73 40 65 40 L49 38 C43 44 37 42 31 46 C23 50 19 49 13 43 Z',
    km: 5.412, tours: 57, virages: 19, drs: 3,
    drsInfo: "3 zones — dont la longue ligne arrière vers T17 (gros freinage) et la ligne des stands." },
  { id: 'emi', nom: 'Émilie-Romagne', circuit: 'Imola', iso: 'it', date: '18 mai',
    trace: 'M11 47 C5 43 7 37 15 33 L26 29 C32 27 34 21 38 17 C42 13 48 11 54 13 L68 17 C74 19 76 25 74 29 L84 33 C92 37 90 45 80 45 L58 43 L38 49 C28 53 17 51 11 47 Z',
    km: 4.909, tours: 63, virages: 19, drs: 1,
    drsInfo: "1 zone — ligne des stands vers le freinage de Tamburello. Piste étroite : difficile de doubler, l'undercut est roi." },
  { id: 'mon', nom: 'Monaco', circuit: 'Monte-Carlo', iso: 'mc', date: '25 mai',
    trace: 'M13 43 C9 39 11 35 17 33 L32 29 C38 27 40 21 44 17 C48 13 56 11 58 15 C60 19 54 21 50 23 L62 25 C68 25 72 21 78 21 C86 21 90 27 84 31 C80 34 74 31 68 33 L58 37 C52 43 42 41 36 43 L21 47 C15 48 15 45 13 43 Z',
    km: 3.337, tours: 78, virages: 19, drs: 1,
    drsInfo: "1 zone — ligne des stands, quasi inutile. On double au stand ou pas du tout : soigne la qualif et la fenêtre d'arrêt." },
  { id: 'esp', nom: 'Espagne', circuit: 'Barcelona-Catalunya', iso: 'es', date: '1 juin',
    trace: 'M12 47 C6 43 8 37 16 33 L34 27 C40 25 44 19 50 15 C56 11 66 9 72 13 C78 17 74 23 66 25 L58 27 L76 31 C86 33 88 41 78 45 C70 47 64 43 56 45 L24 51 C16 53 14 49 12 47 Z',
    km: 4.657, tours: 66, virages: 14, drs: 2,
    drsInfo: "2 zones — ligne des stands et ligne arrière. Le DRS ne suffit pas toujours : l'aéro sale gêne derrière." },
  { id: 'can', nom: 'Canada', circuit: 'Gilles-Villeneuve · Montréal', iso: 'ca', date: '15 juin',
    trace: 'M7 41 C3 37 7 33 13 31 L67 17 C75 15 81 11 87 15 C93 19 89 25 81 25 L73 27 L85 31 C91 33 89 39 81 39 L57 37 L21 45 C13 47 9 45 7 41 Z',
    km: 4.361, tours: 70, virages: 14, drs: 3,
    drsInfo: "3 zones — dont la ligne droite du Casino vers la chicane finale (mur des champions). Beaucoup de dépassements." },
  { id: 'aut', nom: 'Autriche', circuit: 'Red Bull Ring · Spielberg', iso: 'at', date: '29 juin',
    trace: 'M16 51 L26 23 C28 17 32 15 38 15 L76 11 C86 10 92 17 86 23 C82 27 74 25 68 29 L34 47 C26 53 20 55 16 51 Z',
    km: 4.318, tours: 71, virages: 10, drs: 3,
    drsInfo: "3 zones — les trois lignes droites du haut du circuit. Tour court, trafic permanent, DRS très puissant ici." },
  { id: 'gbr', nom: 'Grande-Bretagne', circuit: 'Silverstone', iso: 'gb', date: '6 juillet',
    trace: 'M12 41 C6 35 10 27 20 25 L31 23 C37 22 39 15 45 12 C51 9 57 11 59 15 C61 19 55 23 49 23 L61 25 C67 25 71 19 79 19 C89 19 95 27 89 33 C85 37 77 35 71 37 L51 43 C41 49 31 47 23 45 C17 43 16 45 12 41 Z',
    km: 5.891, tours: 52, virages: 18, drs: 2,
    drsInfo: "2 zones — Wellington Straight et Hangar Straight. Les enchaînements Maggotts-Becketts se prennent à fond avec un bon train avant." },
  { id: 'bel', nom: 'Belgique', circuit: 'Spa-Francorchamps', iso: 'be', date: '27 juillet',
    trace: 'M10 51 L20 29 C22 23 26 19 32 17 L55 8 C61 5 67 6 71 12 L89 41 C93 47 89 53 81 53 L26 57 C14 58 6 57 10 51 Z',
    km: 7.004, tours: 44, virages: 19, drs: 2,
    drsInfo: "2 zones — la ligne de Kemmel après Eau Rouge (LE point de dépassement) et la ligne des stands. Aileron : compromis Kemmel / secteur 2." },
  { id: 'hun', nom: 'Hongrie', circuit: 'Hungaroring · Budapest', iso: 'hu', date: '3 août',
    trace: 'M12 45 C6 39 10 31 20 29 C28 27 32 21 38 17 C44 13 52 13 56 17 C60 21 56 27 48 27 C56 31 64 29 72 27 C80 25 88 29 86 37 C84 43 74 45 66 43 L28 49 C20 51 16 49 12 45 Z',
    km: 4.381, tours: 70, virages: 14, drs: 2,
    drsInfo: "2 zones — ligne des stands et courte ligne vers T2. Doubler est dur : un « Monaco sans les murs », la stratégie fait tout." },
  { id: 'ned', nom: 'Pays-Bas', circuit: 'Zandvoort', iso: 'nl', date: '31 août',
    trace: 'M14 45 C6 41 6 33 14 29 C20 25 28 27 34 23 C40 19 40 11 50 9 C60 7 68 11 68 19 C68 25 60 27 54 27 L66 31 C74 33 76 41 68 45 C60 47 54 41 46 43 L26 49 C20 51 18 47 14 45 Z',
    km: 4.259, tours: 72, virages: 14, drs: 2,
    drsInfo: "2 zones — la dernière courbe relevée (18°) se prend à fond, DRS ouvert dans le banking vers la ligne des stands." },
  { id: 'ita', nom: 'Italie', circuit: 'Monza', iso: 'it', date: '7 septembre',
    trace: 'M12 51 L20 17 C21 13 24 11 28 11 L86 7 C94 6 98 13 92 17 L86 21 L88 27 C88 31 84 33 78 33 L44 37 L76 41 C84 43 82 49 74 49 L20 55 C14 56 11 55 12 51 Z',
    km: 5.793, tours: 53, virages: 11, drs: 2,
    drsInfo: "2 zones — ligne des stands (freinage de la première chicane) et ligne arrière avant Parabolica. Aileron minimal obligatoire." },
  { id: 'aze', nom: 'Azerbaïdjan', circuit: 'Bakou City', iso: 'az', date: '21 septembre',
    trace: 'M8 47 L12 31 C13 27 16 25 20 25 L36 23 L38 15 L48 13 L50 21 L64 19 L66 11 L76 9 L78 19 L92 17 C100 16 102 23 96 27 L86 31 L78 43 C74 49 66 49 58 47 L18 51 C12 52 7 51 8 47 Z',
    km: 6.003, tours: 51, virages: 20, drs: 2,
    drsInfo: "2 zones — dont la ligne droite de 2,2 km le long de la mer Caspienne : aspiration + DRS = dépassements garantis." },
  { id: 'sgp', nom: 'Singapour', circuit: 'Marina Bay', iso: 'sg', date: '5 octobre',
    trace: 'M10 45 L14 27 L26 25 L30 15 L44 13 L46 21 L62 19 L64 11 L78 9 L82 19 L94 23 L90 33 L74 35 L70 45 L50 43 L42 51 L22 49 L10 45 Z',
    km: 4.94, tours: 62, virages: 19, drs: 3,
    drsInfo: "3 zones sur ce circuit urbain. Chaleur et murs : la course la plus physique, safety car quasi garanti (planifie un arrêt flexible)." },
  { id: 'usa', nom: 'États-Unis', circuit: 'COTA · Austin', iso: 'us', date: '19 octobre',
    trace: 'M14 49 C8 43 10 37 18 33 L30 29 L32 13 C33 7 40 5 44 11 L50 21 C54 27 62 23 70 19 C78 15 88 17 88 25 C88 31 80 33 72 33 L58 35 C66 41 62 47 52 47 L26 51 C18 53 16 51 14 49 Z',
    km: 5.513, tours: 56, virages: 20, drs: 2,
    drsInfo: "2 zones — la ligne arrière vers T12 (gros freinage) et la ligne des stands après la montée de T1." },
  { id: 'mex', nom: 'Mexique', circuit: 'Hermanos Rodríguez', iso: 'mx', date: '26 octobre',
    trace: 'M10 47 L14 31 C15 27 18 25 24 25 L82 19 C92 18 96 25 90 29 C86 32 78 29 72 31 L56 35 C50 37 48 43 40 41 L36 47 C32 51 26 49 24 45 L18 49 C14 51 9 50 10 47 Z',
    km: 4.304, tours: 71, virages: 17, drs: 3,
    drsInfo: "3 zones — dont l'énorme ligne des stands (1,2 km). Altitude 2 200 m : moteur et freins souffrent, appui aéro réduit d'office." },
  { id: 'bra', nom: 'Brésil', circuit: 'Interlagos · São Paulo', iso: 'br', date: '9 novembre',
    trace: 'M16 43 C8 39 8 31 16 27 C22 23 28 25 32 19 C36 13 44 9 52 11 C58 13 58 19 52 21 L64 19 C74 17 82 21 82 29 C82 35 74 37 66 37 L56 39 C48 47 36 45 28 43 C22 43 20 45 16 43 Z',
    km: 4.309, tours: 71, virages: 15, drs: 2,
    drsInfo: "2 zones — Reta Oposta et la ligne des stands après la montée finale. Anti-horaire, pluie fréquente : garde un setup Pluie prêt." },
  { id: 'las', nom: 'Las Vegas', circuit: 'Las Vegas Strip', iso: 'us', date: '22 novembre',
    trace: 'M12 49 L16 37 C17 33 20 31 26 31 L72 29 L76 13 C78 7 86 5 90 11 C92 15 88 19 86 23 L82 41 C80 47 74 49 66 49 L20 53 C14 54 11 53 12 49 Z',
    km: 6.201, tours: 50, virages: 17, drs: 2,
    drsInfo: "2 zones — dont le Strip (1,9 km) vers le freinage de T14. Piste froide la nuit : chauffe des pneus difficile." },
  { id: 'qat', nom: 'Qatar', circuit: 'Losail', iso: 'qa', date: '30 novembre',
    trace: 'M12 45 C6 39 10 31 20 29 L36 25 C44 23 48 17 56 13 C64 9 74 11 76 17 C78 23 70 27 62 27 L74 31 C84 33 86 41 76 45 C68 47 62 43 54 45 L26 49 C18 51 16 49 12 45 Z',
    km: 5.419, tours: 57, virages: 16, drs: 1,
    drsInfo: "1 zone — ligne des stands. Enchaînements rapides très exigeants pour les pneus : dégradation élevée, surveille les relais." },
  { id: 'abu', nom: 'Abou Dabi', circuit: 'Yas Marina', iso: 'ae', date: '7 décembre',
    trace: 'M10 43 C6 37 10 33 18 31 L34 27 L38 15 C40 9 48 7 52 13 L56 21 C58 25 56 29 50 31 L76 27 C86 25 92 31 88 37 C84 41 76 39 70 41 L58 43 C52 49 42 47 34 47 L18 47 C12 47 12 45 10 43 Z',
    km: 5.281, tours: 58, virages: 16, drs: 2,
    drsInfo: "2 zones — les deux longues lignes droites après l'épingle T7. Course de nuit, piste qui refroidit : la fenêtre pneus évolue." },
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

const traceSvg = (gp, cls = 'w-16 h-10', couleur = '#00e5ff', larg = 320) => `
  <span class="${cls} flex-shrink-0 inline-block">
    <img src="https://media.formula1.com/image/upload/f_auto,q_auto,w_${larg}/content/dam/fom-website/2018-redesign-assets/Circuit%20maps%2016x9/${F1_MAPS[gp.id]}_Circuit.png"
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
  { value: 'S', label: 'Soft', couleur: '#e10600' },
  { value: 'M', label: 'Medium', couleur: '#ffd12e' },
  { value: 'H', label: 'Hard', couleur: '#f0f0f0' },
  { value: 'I', label: 'Inter', couleur: '#43b02a' },
  { value: 'W', label: 'Pluie', couleur: '#00a3e0' },
];

// Sélecteur de pneus visuel : disque noir, flanc coloré, lettre du composé, coche sur la sélection
function pneuSelecteur(champ, valeur, taille = 36, avecAucun = false) {
  return `<div class="flex items-center gap-2 flex-wrap" data-f1-pneu-groupe="${champ}">
    <input type="hidden" data-f1-strat="${champ}" value="${valeur || ''}">
    ${avecAucun ? `<button type="button" data-f1-pneu="" title="Aucun arrêt" class="f1-pneu ${!valeur ? 'f1-pneu-on' : ''}" style="width:${taille}px;height:${taille}px;border:3px dashed #6b7280;--pneu-c:#6b7280;color:#9ca3af;font-size:${Math.round(taille * 0.4)}px">–</button>` : ''}
    ${PNEUS.map(p => `
    <button type="button" data-f1-pneu="${p.value}" title="${p.label}" class="f1-pneu ${valeur === p.value ? 'f1-pneu-on' : ''}" style="width:${taille}px;height:${taille}px;border:3.5px solid ${p.couleur};--pneu-c:${p.couleur};color:${p.couleur};font-size:${Math.round(taille * 0.4)}px">${p.value}</button>`).join('')}
  </div>`;
}

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
  const t = {
    p1: { pts: 0, wins: 0, podiums: 0, courses: 0, poles: 0, mt: 0, dnf: 0 },
    p2: { pts: 0, wins: 0, podiums: 0, courses: 0, poles: 0, mt: 0, dnf: 0 },
  };
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
      if (pos === 'DNF') t[k].dnf++;
    });
    if (r.pole && t[r.pole]) t[r.pole].poles++;
    if (r.mtour && t[r.mtour]) t[r.mtour].mt++;
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
          <button id="f1-nom-serie" class="f1-titre text-2xl sm:text-3xl leading-none text-left uppercase" title="Renommer la série (nom commun aux deux pilotes)">${champ.nomSerie || 'NIGHT SERIES'}</button>
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
            <p class="text-[10px] uppercase tracking-widest mt-0.5 flex items-center gap-1.5" style="color:#ded5f2"><span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${e.couleur};box-shadow:0 0 6px ${e.couleur}"></span>${e.label} · ${p.nom}</p>
          </div>
          <div class="ml-auto text-right">
            <p class="f1-titre text-3xl leading-none" style="color:#ffffff;text-shadow:0 0 16px ${e.couleur}">${s.pts}</p>
            <p class="text-[9px] uppercase tracking-widest text-gray-500">pts</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] uppercase tracking-wider text-gray-400">
          <span>🏆 ${s.wins} victoire${s.wins > 1 ? 's' : ''}</span>
          <span>🚀 ${s.poles} pole${s.poles > 1 ? 's' : ''}</span>
          <span>⏱ ${s.mt} best lap${s.mt > 1 ? 's' : ''}</span>
          <span>🍾 ${s.podiums} podium${s.podiums > 1 ? 's' : ''}</span>
          <span>💥 ${s.dnf} DNF</span>
          <span>🏁 ${s.courses} course${s.courses > 1 ? 's' : ''}</span>
          ${rang === 2 ? `<span style="color:#ff9dc4">+${ecart} pts d'écart</span>` : ''}
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
      return `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold ${couru ? '' : 'opacity-40'}"
        style="background:${e.couleur}30;border:1px solid ${e.couleur}99;color:#ffffff">
        ${p.tri} ${posTxt(pos)}${couru && ptsPour(pos) > 0 ? ` · +${ptsPour(pos)}` : ''}${r.pole === slot ? ' · P' : ''}${r.mtour === slot ? ' · MT' : ''}</span>`;
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
// Setups de référence codés en dur par circuit (remplis au fur et à mesure) :
// servent de base pré-remplie tant que le pilote n'a rien sauvegardé ; dès qu'il
// enregistre, sa copie personnelle prend le dessus (la référence reste intacte).
// Règle immuable : rouge (Esports Quali) → ⏱ Qualif · jaune (Esports Race) → ☀️ Course · bleu (Wet) → 🌧️ Course.
// Valeurs calées sur un format course 50 % (source simracingsetup, F1 25).
// Ordres : aéro av/ar · diff accél/décél · carrossage av/ar, pince av/ar · susp av/ar, anti-roulis av/ar, hauteur av/ar · freins répartition ← pression · pneus psi av (G/D), ar (G/D).
const SETUPS_REFERENCE = {
  aus: [
    { id: 'ref-qualif', nom: '⏱ Qualif', aeroAv: '18', aeroAr: '8', diffAccel: '100', diffFrein: '25',
      carrossAv: '-3.50', carrossAr: '-2.00', pinceAv: '0.00', pinceAr: '0.10',
      suspAv: '41', suspAr: '1', antiRoulisAv: '1', antiRoulisAr: '21', hautAv: '20', hautAr: '40',
      pressionFreins: '100', repartFreins: '53', psiAv: '29.5 / 29.5', psiAr: '21.0 / 21.0' },
    { id: 'ref-course-sec', nom: '☀️ Course', aeroAv: '15', aeroAr: '9', diffAccel: '100', diffFrein: '30',
      carrossAv: '-3.50', carrossAr: '-2.00', pinceAv: '0.00', pinceAr: '0.10',
      suspAv: '41', suspAr: '1', antiRoulisAv: '1', antiRoulisAr: '16', hautAv: '21', hautAr: '40',
      pressionFreins: '100', repartFreins: '53', psiAv: '29.5 / 29.5', psiAr: '26.5 / 26.5' },
    { id: 'ref-course-pluie', nom: '🌧️ Course', aeroAv: '32', aeroAr: '28', diffAccel: '90', diffFrein: '30',
      carrossAv: '-3.50', carrossAr: '-2.00', pinceAv: '0.00', pinceAr: '0.10',
      suspAv: '41', suspAr: '8', antiRoulisAv: '10', antiRoulisAr: '21', hautAv: '20', hautAr: '48',
      pressionFreins: '100', repartFreins: '54', psiAv: '29.5 / 29.5', psiAr: '26.5 / 26.5' },
  ],
};

function getSetups(fiche, gpId) {
  if (Array.isArray(fiche.setups) && fiche.setups.length) return fiche.setups;
  if (fiche.setup && Object.keys(fiche.setup).length) return [{ id: 'std', nom: 'Course', ...fiche.setup }];
  const ref = SETUPS_REFERENCE[gpId];
  if (ref && ref.length) return JSON.parse(JSON.stringify(ref));
  // Variantes proposées d'office : qualif, course sur le sec, course sous la pluie
  return [{ id: 'qualif', nom: '⏱ Qualif' }, { id: 'course-sec', nom: '☀️ Course' }, { id: 'course-pluie', nom: '🌧️ Course' }];
}

function vuePaddock(store) {
  const garage = store.get('f1Garage') || {};
  const gp = GP_2025.find(g => g.id === gpActif) || GP_2025[0];
  const fiche = garage[gp.id] || {};
  const setups = getSetups(fiche, gp.id);
  const setupActif = setups.find(s => s.id === varianteActive) || setups[0];
  const strat = fiche.strat || {};
  const chronos = fiche.chronos || {};

  const selecteur = `
    <div class="f1-scroll flex gap-1.5 overflow-x-auto pb-2 mb-4">
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
        <p class="text-[10px] text-gray-500 uppercase tracking-widest">${gp.circuit} · ${gp.date} · ${gp.km} km · ${gp.virages} virages · ${gp.drs} zone${gp.drs > 1 ? 's' : ''} DRS</p>
      </div>
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
          <label class="block text-[10px] uppercase tracking-wide text-gray-100 mb-0.5">${label}</label>
          <input data-f1-setup="${id}" type="text" inputmode="decimal" value="${setupActif[id] ?? ''}" class="f1-input w-full">
        </div>`).join('')}
      </div>
    </div>`).join('');

  const blocChronos = `
    <div class="f1-carte p-4 mb-3">
      <div class="flex flex-wrap items-end gap-3">
        <p class="f1-sous-titre text-[11px] tracking-[0.15em] w-full sm:w-auto sm:mr-2 sm:pb-2">⏱ CHRONOS DE RÉFÉRENCE</p>
        <div class="flex-1 min-w-[130px]">
          <label class="block text-[10px] uppercase tracking-wide text-gray-100 mb-0.5">Temps qualif</label>
          <input data-f1-chrono="qualif" type="text" value="${chronos.qualif || ''}" class="f1-input w-full" placeholder="1:29.347">
        </div>
        <div class="flex-1 min-w-[130px]">
          <label class="block text-[10px] uppercase tracking-wide text-gray-100 mb-0.5">Temps course (meilleur tour)</label>
          <input data-f1-chrono="course" type="text" value="${chronos.course || ''}" class="f1-input w-full" placeholder="1:32.108">
        </div>
        <button id="f1-save-chrono" class="f1-bouton" style="padding:0.5rem 1rem" title="Enregistrer les chronos">💾</button>
      </div>
      <p class="text-[9px] mt-1.5" style="color:#8d7fb3">Tes références personnelles sur ce circuit — à battre. Propres à chaque pilote.</p>
    </div>`;

  return `${selecteur}${entete}${blocChronos}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
      <div class="f1-carte p-4">
        <p class="f1-sous-titre text-[11px] tracking-[0.15em] mb-2">🔧 SETUP</p>
        ${ongletsVariantes}
        ${blocsSetup}
        <button id="f1-save-setup" class="f1-bouton mt-3">💾 Enregistrer</button>
        <p class="text-[9px] mt-2" style="color:#8d7fb3">Références pro calées sur un format course 50 % — en 35 % ou 100 %, adapte surtout essence et arrêts.</p>
      </div>
      <div class="flex flex-col gap-3">
      <div class="f1-carte p-3 flex-1 flex">
        <button data-f1-zoom="${gp.id}" class="w-full text-left flex flex-col" title="Agrandir : zones DRS, données circuit">
          ${traceSvg(gp, 'block w-full flex-1 min-h-[200px]', '#9fd8e8', 1024)}
          <p class="text-[9px] uppercase tracking-wide text-center mt-1.5" style="color:#b1a2d6">🔍 agrandir · zones DRS &amp; données circuit</p>
        </button>
      </div>
      <div class="f1-carte p-4">
        <p class="f1-sous-titre text-[11px] tracking-[0.15em] mb-3">📋 STRATÉGIE</p>
        <label class="block text-[10px] uppercase tracking-wide text-gray-100 mb-1.5">Pneus de départ</label>
        ${pneuSelecteur('depart', strat.depart, 40)}
        <div class="grid grid-cols-2 gap-2 mt-3 mb-3">
          <div>
            <label class="block text-[10px] uppercase tracking-wide text-gray-100 mb-0.5">⛽ Plein d'essence (%)</label>
            <input data-f1-strat="essence" type="text" inputmode="decimal" value="${strat.essence ?? ''}" class="f1-input w-full" placeholder="Ex: 105">
          </div>
          <div>
            <label class="block text-[10px] uppercase tracking-wide text-gray-100 mb-0.5">🌡 Météo / température</label>
            <input data-f1-strat="meteo" type="text" value="${strat.meteo || ''}" class="f1-input w-full" placeholder="Sec, piste 34°">
          </div>
        </div>
        <p class="f1-sous-titre text-[10px] tracking-[0.15em] mb-1.5">ARRÊTS AUX STANDS</p>
        ${[1, 2, 3].map(n => `
        <div class="rounded-xl px-3 py-2.5 mb-1.5 flex items-center gap-3 flex-wrap" style="background:rgba(255,255,255,0.04);border:1px solid rgba(160,130,220,0.22)">
          <span class="f1-titre text-[13px] flex-shrink-0 w-16" style="color:#7fe7f7">ARRÊT ${n}</span>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="text-[9px] uppercase tracking-wide text-gray-100">Tour</span>
            <input data-f1-strat="a${n}Tour" type="text" inputmode="numeric" value="${strat['a' + n + 'Tour'] ?? ''}" class="f1-input w-14 text-center" placeholder="${n === 1 ? '18' : '—'}">
          </div>
          ${pneuSelecteur('a' + n + 'Pneu', strat['a' + n + 'Pneu'], 30, true)}
        </div>`).join('')}
        <label class="block text-[10px] uppercase tracking-wide text-gray-100 mb-0.5">ERS / essence</label>
        <input data-f1-strat="ers" type="text" value="${strat.ers || ''}" class="f1-input w-full mb-2" placeholder="ERS hotlap T1, essence standard">
        <label class="block text-[10px] uppercase tracking-wide text-gray-100 mb-0.5">Débrief après course</label>
        <textarea data-f1-strat="debrief" rows="3" class="f1-input w-full" placeholder="Undercut gagnant au tour 17…">${strat.debrief || ''}</textarea>
        <button id="f1-save-strat" class="f1-bouton mt-3">💾 Enregistrer la stratégie</button>
      </div>
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
  let poles1 = 0, poles2 = 0, mt1 = 0, mt2 = 0;
  GP_2025.forEach(gp => {
    const r = champ.resultats[gp.id] || {};
    if (r.pole === 'p1') poles1++; else if (r.pole === 'p2') poles2++;
    if (r.mtour === 'p1') mt1++; else if (r.mtour === 'p2') mt2++;
  });
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
      <span class="w-14 text-right f1-titre text-lg" style="color:#fff;text-shadow:0 0 10px ${c1}">${va}</span>
      <span class="flex-1 text-center text-[10px] uppercase tracking-widest text-gray-400">${label}</span>
      <span class="w-14 text-left f1-titre text-lg" style="color:#fff;text-shadow:0 0 10px ${c2}">${vb}</span>
    </div>`;

  const historique = (champ.historique || []).slice().reverse();

  return `
    <div class="f1-carte p-4 mb-4">
      <div class="flex items-center justify-between mb-2">
        <p class="f1-sous-titre text-[11px] tracking-[0.15em]">FACE-À-FACE · SAISON ${champ.saison}</p>
        <span class="text-[9px] text-gray-500 uppercase">${duels1 + duels2} GP disputés</span>
      </div>
      <div class="flex items-center justify-between px-2 pb-1">
        <span class="f1-titre text-xl" style="color:#fff;text-shadow:0 0 12px ${c1}">${p1.tri}</span>
        <span class="f1-titre text-xl" style="color:#fff;text-shadow:0 0 12px ${c2}">${p2.tri}</span>
      </div>
      ${ligneStat('Points', cl.p1.pts, cl.p2.pts)}
      ${ligneStat('Victoires (P1)', cl.p1.wins, cl.p2.wins)}
      ${ligneStat('Pole positions', poles1, poles2)}
      ${ligneStat('Meilleurs tours', mt1, mt2)}
      ${ligneStat('Podiums', cl.p1.podiums, cl.p2.podiums)}
      ${ligneStat('Abandons (DNF)', cl.p1.dnf, cl.p2.dnf)}
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

// Fiche circuit plein écran : grand tracé, zones DRS, données clés
function ouvrirFicheCircuit(gpId) {
  const gp = GP_2025.find(g => g.id === gpId);
  if (!gp) return;
  document.getElementById('f1-zoom')?.remove();
  const tuile = (l, v) => `<div class="rounded-lg p-2.5 text-center" style="background:rgba(255,255,255,0.05);border:1px solid rgba(160,130,220,0.25)">
    <p class="f1-titre text-xl leading-none" style="color:#00e5ff">${v}</p>
    <p class="text-[9px] uppercase tracking-wide mt-1" style="color:#b1a2d6">${l}</p></div>`;
  const ov = document.createElement('div');
  ov.id = 'f1-zoom';
  ov.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto';
  ov.style.cssText = "background:rgba(5,1,15,0.93);backdrop-filter:blur(6px);font-family:'Titillium Web',sans-serif";
  ov.innerHTML = `
    <div class="f1-carte w-full max-w-3xl p-5 my-auto">
      <div class="flex items-center gap-3 mb-3">
        ${drapeau(gp.iso, 'w-9 h-6')}
        <div class="flex-1 min-w-0">
          <p class="f1-titre text-2xl uppercase">${gp.nom}</p>
          <p class="text-[11px] uppercase tracking-wide" style="color:#b1a2d6">${gp.circuit} · ${gp.date}</p>
        </div>
        <button id="f1-zoom-close" class="text-3xl leading-none px-2 hover:text-white" style="color:#b1a2d6">&times;</button>
      </div>
      ${traceSvg(gp, 'block w-full h-[300px]', '#00e5ff', 1280)}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        ${tuile('Longueur', gp.km + ' km')}
        ${tuile('Tours', gp.tours)}
        ${tuile('Virages', gp.virages)}
        ${tuile('Zones DRS', gp.drs)}
      </div>
      <p class="text-[13px] leading-relaxed mt-3" style="color:#cec4e6"><b style="color:#7fe7f7">DRS · </b>${gp.drsInfo}</p>
      <p class="text-[9px] mt-3" style="color:#8d7fb3">Tracé stylisé dessiné pour Night Series · données indicatives saison 2025.</p>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
  ov.querySelector('#f1-zoom-close').addEventListener('click', () => ov.remove());
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

  // Nom de la série (commun, synchronisé)
  document.getElementById('f1-nom-serie')?.addEventListener('click', () => {
    const c = getChamp(store);
    promptModal('Nom de la série', c.nomSerie || 'NIGHT SERIES', (nom) => {
      if (!nom || !nom.trim()) return;
      const c2 = getChamp(store);
      c2.nomSerie = nom.trim();
      pousserChamp(store, c2);
      navigate('f1');
    }, { label: 'Ce nom est partagé entre les deux pilotes', placeholder: 'NIGHT SERIES' });
  });
  document.querySelectorAll('[data-f1-tab]').forEach(btn => {
    btn.addEventListener('click', () => { ongletActif = btn.dataset.f1Tab; navigate('f1'); });
  });
  document.querySelectorAll('[data-f1-zoom]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirFicheCircuit(btn.dataset.f1Zoom));
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
      const extraSel = (id, label) => `
        <div class="mb-3">
          <label class="block text-xs font-semibold mb-1 text-gray-300">${label}</label>
          <select id="${id}" class="w-full px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm">
            <option value="">—</option>
            <option value="p1">${champ.pilotes.p1.tri}</option>
            <option value="p2">${champ.pilotes.p2.tri}</option>
          </select>
        </div>`;
      const extras = `<div class="grid grid-cols-2 gap-2">${extraSel('f1-res-pole', '🚀 Pole position')}${extraSel('f1-res-mtour', '⏱ Meilleur tour')}</div>`;
      openModal(`🏁 ${gp.nom} — résultat`, sel('p1') + sel('p2') + extras + '<p class="text-[10px] text-gray-500">Barème 2025 : 25-18-15-12-10-8-6-4-2-1, pas de point bonus. Résultat partagé entre les deux pilotes.</p>', () => {
        const lire = (slot) => {
          const v = document.getElementById(`f1-res-${slot}`)?.value;
          return v === '' ? undefined : (v === 'DNF' ? 'DNF' : Number(v));
        };
        const nv = {};
        const v1 = lire('p1'); if (v1 !== undefined) nv.p1 = v1;
        const v2 = lire('p2'); if (v2 !== undefined) nv.p2 = v2;
        const pole = document.getElementById('f1-res-pole')?.value; if (pole) nv.pole = pole;
        const mtour = document.getElementById('f1-res-mtour')?.value; if (mtour) nv.mtour = mtour;
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
        if (r.pole) { const el = document.getElementById('f1-res-pole'); if (el) el.value = r.pole; }
        if (r.mtour) { const el = document.getElementById('f1-res-mtour'); if (el) el.value = r.mtour; }
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
        const ancienneEcurie = cible.ecurie;
        cible.ecurie = data.ecurie || cible.ecurie;
        const couleurChoisie = document.getElementById('f1-couleur')?.value || '';
        // Couleur : si l'écurie change et que le sélecteur n'a pas été retouché, on adopte la couleur de la nouvelle écurie
        if (cible.ecurie !== ancienneEcurie && couleurChoisie.toLowerCase() === couleurPilote(p).toLowerCase()) {
          cible.couleur = ecurieDe(cible.ecurie).couleur;
        } else if (couleurChoisie) {
          cible.couleur = couleurChoisie;
        }
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
    fiche.setups = getSetups(fiche, gpActif);
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

  // Sélecteurs de pneus visuels (stratégie)
  document.querySelectorAll('[data-f1-pneu-groupe]').forEach(gr => {
    const cache = gr.querySelector('input[type="hidden"]');
    gr.querySelectorAll('[data-f1-pneu]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (cache) cache.value = btn.dataset.f1Pneu;
        gr.querySelectorAll('[data-f1-pneu]').forEach(b => b.classList.toggle('f1-pneu-on', b === btn));
      });
    });
  });

  document.getElementById('f1-save-chrono')?.addEventListener('click', () => {
    const { garage, fiche } = licherFiche();
    fiche.chronos = lireChamps('data-f1-chrono');
    store.set('f1Garage', garage);
    showToast('Chronos de référence enregistrés ⏱', 'success', 2000);
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
