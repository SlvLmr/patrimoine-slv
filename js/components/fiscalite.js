import { formatCurrency, formatPercent, computeProjection, openModal, inputField, selectField, getFormData } from '../utils.js?v=5';
import { createChart, COLORS } from '../charts/chart-config.js';

// ============================================================================
// STRATEGIE PATRIMONIALE & SUCCESSION
// ============================================================================

// --- Constants fiscales ---
const ABATTEMENT_PARENT_ENFANT = 100000;
const RENOUVELLEMENT_ANNEES = 15;
const DON_FAMILIAL_TEPA = 31865;
const AGE_MAX_DONATEUR_TEPA = 80;
const AV_ABATTEMENT_PAR_BENEFICIAIRE = 152500;
const AV_TAUX_1 = 0.20;
const AV_SEUIL_1 = 700000;
const AV_TAUX_2 = 0.3125;

const TRANCHES_DONATION = [
  { min: 0,       max: 8072,    taux: 0.05 },
  { min: 8072,    max: 12109,   taux: 0.10 },
  { min: 12109,   max: 15932,   taux: 0.15 },
  { min: 15932,   max: 552324,  taux: 0.20 },
  { min: 552324,  max: 902838,  taux: 0.30 },
  { min: 902838,  max: 1805677, taux: 0.40 },
  { min: 1805677, max: Infinity, taux: 0.45 }
];

const BAREME_USUFRUIT = [
  { ageMax: 20, usufruit: 0.90, nuePropriete: 0.10 },
  { ageMax: 30, usufruit: 0.80, nuePropriete: 0.20 },
  { ageMax: 40, usufruit: 0.70, nuePropriete: 0.30 },
  { ageMax: 50, usufruit: 0.60, nuePropriete: 0.40 },
  { ageMax: 60, usufruit: 0.50, nuePropriete: 0.50 },
  { ageMax: 70, usufruit: 0.40, nuePropriete: 0.60 },
  { ageMax: 80, usufruit: 0.30, nuePropriete: 0.70 },
  { ageMax: 90, usufruit: 0.20, nuePropriete: 0.80 },
  { ageMax: Infinity, usufruit: 0.10, nuePropriete: 0.90 }
];

const ABATTEMENTS_REF = [
  { lien: 'Enfant', montant: 100000, renouvellement: '15 ans' },
  { lien: 'Don familial TEPA (< 80 ans)', montant: 31865, renouvellement: '15 ans, cumulable' },
  { lien: 'Petit-enfant', montant: 31865, renouvellement: '15 ans' },
  { lien: 'Conjoint / PACS', montant: 80724, renouvellement: '15 ans' },
  { lien: 'Frere / soeur', montant: 15932, renouvellement: '15 ans' },
  { lien: 'Neveu / niece', montant: 7967, renouvellement: '15 ans' },
  { lien: 'Arriere-petit-enfant', montant: 5310, renouvellement: '15 ans' },
];

const DONATION_TYPES = [
  { value: 'don_manuel', label: 'Don manuel' },
  { value: 'don_tepa', label: 'Don TEPA (Art. 790 G)' },
  { value: 'donation_nue_propriete', label: 'Donation nue-propriete' },
  { value: 'donation_cto', label: 'Donation titres CTO' },
];

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculerDroitsDonation(montantTaxable) {
  if (montantTaxable <= 0) return 0;
  let droits = 0;
  for (const t of TRANCHES_DONATION) {
    if (montantTaxable <= t.min) break;
    droits += (Math.min(montantTaxable, t.max) - t.min) * t.taux;
  }
  return Math.round(droits);
}

function getUsufruitRate(age) {
  for (const t of BAREME_USUFRUIT) {
    if (age <= t.ageMax) return t;
  }
  return BAREME_USUFRUIT[BAREME_USUFRUIT.length - 1];
}

function calculerSuccessionParEnfant(patrimoineHorsAV, nbEnfants, avParEnfant) {
  if (nbEnfants === 0) return { partBrute: 0, taxable: 0, droits: 0, avDroits: 0 };
  const partBrute = patrimoineHorsAV / nbEnfants;
  const taxable = Math.max(0, partBrute - ABATTEMENT_PARENT_ENFANT);
  const droits = calculerDroitsDonation(taxable);
  const avTaxable = Math.max(0, avParEnfant - AV_ABATTEMENT_PAR_BENEFICIAIRE);
  const avTranche1 = Math.min(avTaxable, AV_SEUIL_1);
  const avTranche2 = Math.max(0, avTaxable - AV_SEUIL_1);
  const avDroits = Math.round(avTranche1 * AV_TAUX_1 + avTranche2 * AV_TAUX_2);
  return { partBrute, taxable, droits, avDroits };
}

function donationTypeLabel(type) {
  return DONATION_TYPES.find(t => t.value === type)?.label || type;
}

function simulerDonations(enfant, donations, ageDonateur) {
  const currentYear = new Date().getFullYear();
  let abattementUtilise = 0;
  let tepaUtilise = 0;
  const results = [];
  for (const don of donations) {
    const yearsSinceFirst = don.annee - (donations[0]?.annee || currentYear);
    if (yearsSinceFirst >= RENOUVELLEMENT_ANNEES) { abattementUtilise = 0; tepaUtilise = 0; }
    const ageDon = ageDonateur + (don.annee - currentYear);
    let montantRestant = don.montant;
    let exonere = 0;
    let taxable = 0;
    let droits = 0;
    let detail = '';
    if (don.type === 'don_manuel' || don.type === 'don_tepa') {
      if (don.type === 'don_tepa' && ageDon < AGE_MAX_DONATEUR_TEPA) {
        const tepaDisponible = DON_FAMILIAL_TEPA - tepaUtilise;
        const tepaUse = Math.min(montantRestant, tepaDisponible);
        tepaUtilise += tepaUse; exonere += tepaUse; montantRestant -= tepaUse;
        detail = `TEPA: ${formatCurrency(tepaUse)} exonere`;
      }
      const abattDisponible = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
      const abattUse = Math.min(montantRestant, abattDisponible);
      abattementUtilise += abattUse; exonere += abattUse; montantRestant -= abattUse;
      if (abattUse > 0) detail += (detail ? ' + ' : '') + `Abatt.: ${formatCurrency(abattUse)}`;
      taxable = montantRestant; droits = calculerDroitsDonation(taxable);
    } else if (don.type === 'donation_nue_propriete') {
      const rate = getUsufruitRate(ageDon);
      const valeurNP = Math.round(don.montant * rate.nuePropriete);
      detail = `Nue-prop. ${(rate.nuePropriete * 100).toFixed(0)}% = ${formatCurrency(valeurNP)}`;
      montantRestant = valeurNP;
      const abattDisponible = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
      const abattUse = Math.min(montantRestant, abattDisponible);
      abattementUtilise += abattUse; exonere += abattUse; montantRestant -= abattUse;
      taxable = montantRestant; droits = calculerDroitsDonation(taxable);
    } else if (don.type === 'donation_cto') {
      detail = `CTO: purge des PV latentes`;
      const abattDisponible = ABATTEMENT_PARENT_ENFANT - abattementUtilise;
      const abattUse = Math.min(montantRestant, abattDisponible);
      abattementUtilise += abattUse; exonere += abattUse; montantRestant -= abattUse;
      taxable = montantRestant; droits = calculerDroitsDonation(taxable);
    }
    results.push({ ...don, ageDonateur: ageDon, exonere, taxable, droits, detail,
      abattementRestant: ABATTEMENT_PARENT_ENFANT - abattementUtilise,
      tepaRestant: DON_FAMILIAL_TEPA - tepaUtilise });
  }
  return results;
}

// ============================================================================
// STORE HELPERS
// ============================================================================

function getPatrimoineFromStore(store) {
  const state = store.getAll();
  const actifs = state.actifs || {};
  const passifs = state.passifs || {};
  const immobilier = (actifs.immobilier || []).reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const allPlac = actifs.placements || [];
  const placements = allPlac.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const pea = allPlac.filter(p => { const e = (p.enveloppe || '').toUpperCase(); return e.startsWith('PEA') && e !== 'PEE'; }).reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const av = allPlac.filter(p => { const e = (p.enveloppe || '').toUpperCase(); return e.includes('AV') || e.includes('ASSURANCE') || e.includes('VIE'); }).reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const cto = allPlac.filter(p => (p.enveloppe || '').toUpperCase().includes('CTO')).reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const crypto = allPlac.filter(p => (p.enveloppe || '').toUpperCase().includes('CRYPTO')).reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const epargne = (actifs.epargne || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const comptesCourants = (actifs.comptesCourants || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
  const emprunts = (passifs.emprunts || []).reduce((s, i) => s + (Number(i.capitalRestant) || 0), 0);
  const totalActifs = immobilier + placements + epargne + comptesCourants;
  const patrimoineNet = totalActifs - emprunts;
  const patrimoineHorsAV = patrimoineNet - av;
  return { immobilier, placements, pea, av, cto, crypto, epargne, comptesCourants, emprunts, totalActifs, patrimoineNet, patrimoineHorsAV };
}

function getConfig(store) { return store.get('donationConfig') || { enfants: [], donations: [] }; }
function saveConfig(store, cfg) { store.set('donationConfig', cfg); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function getAge(dateNaissance) {
  if (!dateNaissance) return null;
  const born = new Date(dateNaissance);
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age--;
  return age;
}


// ============================================================================
// TIMELINE DATA
// ============================================================================

function getTimelineEvents(store, params, patrimoine, enfants, snapshots) {
  const currentYear = new Date().getFullYear();
  const ageDonateur = params.ageFinAnnee || 42;
  const events = [];

  // === HARDCODED STRATEGY EVENTS ===
  events.push({ year: 2026, age: ageDonateur + (2026 - currentYear), color: 'amber', icon: 'home',
    title: 'Demembrement maison (notaire)',
    desc: 'Donation nue-propriete 50/50 a Gaspard et Agathe. Usufruit conserve a vie. NP a 42 ans = 60% = ~198 000 EUR (99 000 EUR/enfant). Abattement 100 000 EUR/enfant → zero droit. Prevoir clause de report d\'usufruit.' });
  events.push({ year: 2026, age: ageDonateur + (2026 - currentYear), color: 'purple', icon: 'shield',
    title: 'Mise a jour clause beneficiaire Linxea',
    desc: 'Designeer Gaspard et Agathe comme beneficiaires de l\'assurance vie Linxea Spirit 2. Indispensable pour beneficier de l\'abattement 152 500 EUR/beneficiaire.' });
  events.push({ year: 2026, age: ageDonateur + (2026 - currentYear), color: 'emerald', icon: 'check',
    title: 'Credit solde (nov. 2026) → DCA Linxea 200 EUR/mois',
    desc: 'La mensualite de 650 EUR/mois liberee permet de lancer le DCA Linxea Spirit 2 a 200 EUR/mois. Rendement cible 5%/an, profil equilibre.' });
  events.push({ year: 2026, age: ageDonateur + (2026 - currentYear), color: 'green', icon: 'flag',
    title: 'DCA PEA 605 EUR/mois deja lance',
    desc: 'S&P 500 : 450 EUR/mois, STOXX 600 : 120 EUR/mois, Emerging : 35 EUR/mois. Rendement cible 7%/an. Plafond 150 000 EUR atteint ~2046.' });

  events.push({ year: 2030, age: ageDonateur + (2030 - currentYear), color: 'cyan', icon: 'gift',
    title: 'Don Sarkozy : 1er versement ~4 500 EUR/enfant',
    desc: 'Declenche le compteur 15 ans (art. 790 G CGI). 31 865 EUR/enfant en cash uniquement, cumulable avec l\'abattement classique. Donataire majeur obligatoire. Declaration formulaire 2735 sur impots.gouv.fr dans le mois.' });

  events.push({ year: 2038, age: ageDonateur + (2038 - currentYear), color: 'pink', icon: 'star',
    title: 'Heritage : 60k EUR Linxea / 50k EUR CTO / 40k EUR livrets',
    desc: 'Repartition decidee : 60 000 EUR versement exceptionnel Linxea Spirit 2, 50 000 EUR sur CTO perso (ETF World + Air Liquide, Schneider), 40 000 EUR livrets (securite + qualite de vie). Completer le don Sarkozy progressivement.' });

  events.push({ year: 2041, age: ageDonateur + (2041 - currentYear), color: 'emerald', icon: 'gift',
    title: 'Abattement 100k EUR recharge + Donation titres CTO',
    desc: '15 ans apres le demembrement de 2026. Donation titres CTO en nature vers CTO enfants (purge des plus-values latentes, pas de flat tax 30%). Don Sarkozy solde (~27 000 EUR/enfant restants).' });

  events.push({ year: 2042, age: ageDonateur + (2042 - currentYear), color: 'orange', icon: 'sun',
    title: 'Retraite — Mode croisiere',
    desc: 'Pension estimee ~2 640 EUR/mois. Linxea : rachats partiels uniquement si besoin (abattement 4 600 EUR/an sur gains apres 8 ans). PEA continue de composer jusqu\'au plafond.' });

  events.push({ year: 2046, age: ageDonateur + (2046 - currentYear), color: 'green', icon: 'flag',
    title: 'PEA plafonne (~327k EUR, dont 177k EUR PV)',
    desc: 'Plafond 150 000 EUR de versements atteint. Redirection des 605 EUR/mois : Linxea en priorite absolue (fenetre avant 70 ans = 7 ans restants pour l\'abattement 152 500 EUR), puis CTO si besoin.' });

  events.push({ year: 2055, age: ageDonateur + (2055 - currentYear), color: 'pink', icon: 'heart',
    title: 'Au deces — Bilan transmission',
    desc: 'Maison : pleine propriete automatique (~515 000 EUR, zero droit). Linxea : 152 500 EUR/enfant hors succession (zero droit si < 305 000 EUR). PEA + CTO + livrets : succession classique, abattements recharges disponibles.' });

  // === DYNAMIC EVENTS FROM PROJECTION ===
  if (snapshots && snapshots.length > 0) {
    const projGroupKeys = snapshots.groupKeys || [];
    let peaCeilingTriggered = false, debtFreeTriggered = false;

    for (let i = 0; i < snapshots.length; i++) {
      const s = snapshots[i];
      const prevS = i > 0 ? snapshots[i - 1] : null;

      // PEA ceiling
      if (!peaCeilingTriggered) {
        const peaApports = projGroupKeys.filter(k => k.startsWith('PEA')).reduce((sum, k) => sum + (s.placementApports?.[k] || 0), 0);
        if (peaApports >= 145000) {
          peaCeilingTriggered = true;
          // Only add if year differs from hardcoded 2046
          if (s.calendarYear !== 2046) {
            const peaValue = projGroupKeys.filter(k => k.startsWith('PEA')).reduce((sum, k) => sum + (s.placementDetail?.[k] || 0), 0);
            events.push({ year: s.calendarYear, age: s.age, color: 'blue', icon: 'flag',
              title: `Plafond PEA atteint (projection)`,
              desc: `Apports PEA ~150 000 EUR. Valeur projetee : ${formatCurrency(peaValue)}. Les versements seront rediriges automatiquement.` });
          }
        }
      }

      // Debt-free
      if (!debtFreeTriggered && prevS && prevS.totalDette > 0 && s.totalDette <= 0) {
        debtFreeTriggered = true;
        events.push({ year: s.calendarYear, age: s.age, color: 'emerald', icon: 'check',
          title: 'Plus aucune dette',
          desc: `Tous les emprunts sont rembourses. Capacite d'epargne supplementaire liberee.` });
      }
    }
  }

  events.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
  return events;
}


// ============================================================================
// RENDER
// ============================================================================

export function render(store) {
  const params = store.get('parametres') || {};
  const userInfo = store.get('userInfo') || {};
  const ageDonateur = params.ageFinAnnee || 42;
  const currentYear = new Date().getFullYear();
  const patrimoine = getPatrimoineFromStore(store);
  const cfg = getConfig(store);
  const enfants = cfg.enfants || [];
  const donations = cfg.donations || [];
  const nbEnfants = enfants.length;
  const pension = params.pensionTauxLegal || 2640;

  let snapshots = [];
  try { snapshots = computeProjection(store); } catch(e) { console.error('Projection error:', e); }
  const lastSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const projGroupKeys = snapshots.groupKeys || [];

  // Projected values at end of projection
  const projImmo = lastSnap ? lastSnap.immobilier : patrimoine.immobilier;
  const projAV = lastSnap ? projGroupKeys.filter(k => k === 'Assurance Vie').reduce((sum, k) => sum + (lastSnap.placementDetail?.[k] || 0), 0) : patrimoine.av;
  const projPEA = lastSnap ? projGroupKeys.filter(k => k.startsWith('PEA')).reduce((sum, k) => sum + (lastSnap.placementDetail?.[k] || 0), 0) : patrimoine.pea;
  const projCTO = lastSnap ? projGroupKeys.filter(k => k === 'CTO').reduce((sum, k) => sum + (lastSnap.placementDetail?.[k] || 0), 0) : patrimoine.cto;
  const projNet = lastSnap ? lastSnap.patrimoineNet : patrimoine.patrimoineNet;
  const projEpargne = lastSnap ? lastSnap.epargne : patrimoine.epargne;
  const projHorsAV = projNet - projAV;
  const projYear = lastSnap ? lastSnap.calendarYear : currentYear;
  const projAge = lastSnap ? lastSnap.age : ageDonateur;

  // Succession calculations
  const nbEnfantsCalc = Math.max(nbEnfants, 1);
  // Sans optimisation
  const succSans = calculerSuccessionParEnfant(projHorsAV, nbEnfantsCalc, projAV / nbEnfantsCalc);
  const totalDroitsSans = (succSans.droits + succSans.avDroits) * nbEnfantsCalc;
  // Avec strategie: maison sortie (demembrement), AV hors succession si < 305k
  const maisonProj = projImmo;
  const patrimoineApresStrat = Math.max(0, projHorsAV - maisonProj); // maison sortie par demembrement
  const avOptimise = Math.min(projAV, AV_ABATTEMENT_PAR_BENEFICIAIRE * nbEnfantsCalc);
  const avExcedent = Math.max(0, projAV - avOptimise);
  const succAvec = calculerSuccessionParEnfant(patrimoineApresStrat, nbEnfantsCalc, avExcedent / nbEnfantsCalc);
  const totalDroitsAvec = (succAvec.droits + succAvec.avDroits) * nbEnfantsCalc;
  const economie = totalDroitsSans - totalDroitsAvec;
  const economiePct = totalDroitsSans > 0 ? (economie / totalDroitsSans * 100).toFixed(0) : 0;

  // Timeline
  const timelineEvents = getTimelineEvents(store, params, patrimoine, enfants, snapshots);

  // Per-child gauges
  const avParEnfant = nbEnfants > 0 ? patrimoine.av / nbEnfants : 0;
  function childGauges(enfantId) {
    const results = (donations.filter(d => d.enfantId === enfantId).sort((a, b) => a.annee - b.annee));
    const simResults = simulerDonations({ id: enfantId }, results, ageDonateur);
    const lastResult = simResults[simResults.length - 1];
    const abattRestant = lastResult ? lastResult.abattementRestant : ABATTEMENT_PARENT_ENFANT;
    const abattUtilise = ABATTEMENT_PARENT_ENFANT - abattRestant;
    const abattPct = Math.round((abattUtilise / ABATTEMENT_PARENT_ENFANT) * 100);
    const tepaRestant = lastResult ? lastResult.tepaRestant : DON_FAMILIAL_TEPA;
    const tepaUtilise = DON_FAMILIAL_TEPA - tepaRestant;
    const tepaPct = Math.round((tepaUtilise / DON_FAMILIAL_TEPA) * 100);
    const avPct = Math.round((avParEnfant / AV_ABATTEMENT_PAR_BENEFICIAIRE) * 100);
    const avRestant = Math.max(0, AV_ABATTEMENT_PAR_BENEFICIAIRE - avParEnfant);
    const firstDonYear = results.length > 0 ? results[0].annee : null;
    const renewalYear = firstDonYear ? firstDonYear + RENOUVELLEMENT_ANNEES : null;
    return { abattRestant, abattUtilise, abattPct, tepaRestant, tepaUtilise, tepaPct, avPct, avRestant, firstDonYear, renewalYear };
  }

  // ─── Asset card helper ───
  function assetCard(color, icon, title, value, rules, strategy) {
    const colorMap = {
      amber: { bg: 'from-amber-500/10 to-amber-600/5', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' },
      green: { bg: 'from-emerald-500/10 to-green-600/5', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
      purple: { bg: 'from-purple-500/10 to-violet-600/5', border: 'border-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' },
      blue: { bg: 'from-blue-500/10 to-sky-600/5', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
      orange: { bg: 'from-orange-500/10 to-amber-600/5', border: 'border-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500' },
      emerald: { bg: 'from-emerald-500/10 to-teal-600/5', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
      cyan: { bg: 'from-cyan-500/10 to-sky-600/5', border: 'border-cyan-500/20', text: 'text-cyan-400', dot: 'bg-cyan-500' },
      pink: { bg: 'from-pink-500/10 to-rose-600/5', border: 'border-pink-500/20', text: 'text-pink-400', dot: 'bg-pink-500' },
    };
    const c = colorMap[color] || colorMap.blue;
    return `
      <div class="card-dark rounded-xl overflow-hidden border ${c.border}">
        <div class="p-4 bg-gradient-to-r ${c.bg}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full ${c.dot}"></div>
              <h4 class="text-sm font-semibold text-gray-200">${title}</h4>
            </div>
            <span class="text-lg font-bold ${c.text}">${formatCurrency(value)}</span>
          </div>
        </div>
        <div class="p-4 space-y-2">
          <p class="text-xs text-gray-400 leading-relaxed">${strategy}</p>
          ${rules.map(r => `
            <div class="flex items-start gap-2 p-2 rounded-lg bg-dark-800/60 border-l-2 ${c.border}">
              <svg class="w-3 h-3 ${c.text} mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span class="text-[11px] text-gray-500 leading-relaxed">${r}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  return `
    <div class="max-w-6xl mx-auto space-y-6">

      <!-- ═══════════════════════════════════════════════ -->
      <!-- HEADER -->
      <!-- ═══════════════════════════════════════════════ -->
      <div>
        <h2 class="text-2xl font-bold text-gray-100 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
            </svg>
          </div>
          Strategie Patrimoniale & Succession
        </h2>
        <p class="text-gray-500 text-sm mt-1">Ta feuille de route complete — donnees reelles, projections dynamiques</p>
      </div>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- PROFIL -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center text-2xl font-bold text-pink-300">
            ${(userInfo.prenom || 'S')[0].toUpperCase()}
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-200">${userInfo.prenom || 'Sylvain'}${userInfo.nom ? ' ' + userInfo.nom : ''}</h3>
            <p class="text-sm text-gray-500">${ageDonateur} ans — Celibataire — Garde alternee</p>
            <div class="flex flex-wrap gap-3 mt-2">
              <span class="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">Salaire : 2 800 EUR/mois</span>
              <span class="text-xs px-2 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/15">Retraite 2042 : ${formatCurrency(pension)}/mois</span>
              ${enfants.map(e => {
                const age = getAge(e.dateNaissance);
                return `<span class="text-xs px-2 py-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/15">${e.prenom}${age !== null ? ' (' + age + ' ans)' : ''}</span>`;
              }).join('')}
              ${enfants.length === 0 ? '<span class="text-xs text-gray-600">Aucun enfant enregistre</span>' : ''}
            </div>
          </div>
          <button id="btn-add-enfant" class="px-3 py-2 bg-pink-500/15 text-pink-300 rounded-lg hover:bg-pink-500/25 transition text-sm flex items-center gap-1.5 border border-pink-500/20 shrink-0">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            Enfant
          </button>
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- PATRIMOINE ACTUEL -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="card-dark rounded-xl p-5">
        <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2 mb-4">
          <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Patrimoine actuel
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="rounded-xl p-3 bg-amber-500/5 border border-amber-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Immobilier</p>
            <p class="text-lg font-bold text-amber-400 mt-1">${formatCurrency(patrimoine.immobilier)}</p>
          </div>
          <div class="rounded-xl p-3 bg-emerald-500/5 border border-emerald-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">PEA</p>
            <p class="text-lg font-bold text-emerald-400 mt-1">${formatCurrency(patrimoine.pea)}</p>
          </div>
          <div class="rounded-xl p-3 bg-purple-500/5 border border-purple-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Assurance Vie</p>
            <p class="text-lg font-bold text-purple-400 mt-1">${formatCurrency(patrimoine.av)}</p>
          </div>
          <div class="rounded-xl p-3 bg-blue-500/5 border border-blue-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">CTO</p>
            <p class="text-lg font-bold text-blue-400 mt-1">${formatCurrency(patrimoine.cto)}</p>
          </div>
          <div class="rounded-xl p-3 bg-orange-500/5 border border-orange-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Crypto</p>
            <p class="text-lg font-bold text-orange-400 mt-1">${formatCurrency(patrimoine.crypto)}</p>
          </div>
          <div class="rounded-xl p-3 bg-teal-500/5 border border-teal-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Epargne</p>
            <p class="text-lg font-bold text-teal-400 mt-1">${formatCurrency(patrimoine.epargne)}</p>
          </div>
          <div class="rounded-xl p-3 bg-red-500/5 border border-red-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Emprunts</p>
            <p class="text-lg font-bold text-red-400 mt-1">${patrimoine.emprunts > 0 ? '-' : ''}${formatCurrency(patrimoine.emprunts)}</p>
          </div>
          <div class="rounded-xl p-3 bg-gradient-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/20 text-center">
            <p class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Patrimoine Net</p>
            <p class="text-xl font-bold gradient-text mt-1">${formatCurrency(patrimoine.patrimoineNet)}</p>
          </div>
        </div>
      </div>


      <!-- ═══════════════════════════════════════════════ -->
      <!-- STRATEGIE PAR ACTIF -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="card-dark rounded-xl p-5">
        <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2 mb-4">
          <svg class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
          Strategie par actif
        </h3>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

          ${assetCard('amber', 'home', 'Maison', patrimoine.immobilier, [
            'Demembrement en 2026 : donation nue-propriete 50/50 aux enfants',
            'NP a 42 ans = 60% = ~198 000 EUR. Abattement 100k EUR/enfant → zero droit',
            'Au deces : usufruit eteint, pleine propriete restituee sans droits ni formalite',
            'Clause de report d\'usufruit a prevoir dans l\'acte notarie',
            'Hypothese de revalorisation : +1,5%/an → ~515 000 EUR au deces'
          ], 'La maison sort definitivement de la succession grace au demembrement. Toute la plus-value future est transmise gratuitement.')}

          ${assetCard('green', 'chart', 'PEA (Trade Republic)', patrimoine.pea, [
            'INTRANSMISSIBLE de son vivant — Au deces : cloture auto, titres sur CTO succession',
            'Ne pas cloturer avant la retraite. Pas de retrait avant 5 ans',
            'Apres 5 ans : retraits possibles mais bloquent les nouveaux versements',
            'Plafond versements : 150 000 EUR. Atteint ~2046'
          ], 'DCA 605 EUR/mois : S&P 500 (450 EUR), STOXX 600 (120 EUR), Emerging (35 EUR). Actions : Air Liquide (20), Schneider (5), Legrand (4). Rendement cible 7%/an. Valeur projetee retraite ~227 000 EUR, plafond ~327 000 EUR.')}

          ${assetCard('purple', 'shield', 'Assurance Vie — Linxea Spirit 2', patrimoine.av, [
            'Tous les versements AVANT 70 ans → abattement 152 500 EUR/beneficiaire au deces',
            'Ne JAMAIS cloturer ce contrat — rachats partiels uniquement',
            'Abattement annuel 4 600 EUR sur les gains apres 8 ans de contrat',
            'Seuil : ne pas depasser 305 000 EUR (2 x 152 500 EUR)',
            'En 2046 (PEA plafonne) : rediriger les 605 EUR/mois ici en priorite'
          ], 'DCA 200 EUR/mois a partir de nov. 2026. Versement exceptionnel heritage +60 000 EUR (2037-2040). Rendement cible 5%/an. Beneficiaires : Gaspard et Agathe. Capital hors succession.')}

          ${assetCard('blue', 'globe', 'CTO Perso (Trade Republic)', patrimoine.cto, [
            'Ne pas vendre les titres pour donner du cash — transferer en nature',
            'Donation en nature → purge des PV latentes (pas de flat tax 30%)',
            'Donation dans l\'abattement 100 000 EUR/enfant (recharge en 2040-2041)'
          ], 'Alimente avec l\'heritage : +50 000 EUR (2037-2040). ETF World + Air Liquide, Schneider. Objectif : faire fructifier ET transmettre par donation titres en nature vers les CTO enfants.')}

          ${assetCard('cyan', 'users', 'CTO Gaspard + CTO Agathe', 0, [
            'Recepteurs des donations de titres depuis le CTO perso',
            'Capital propre estime a 25-27 ans : ~35 000 - 45 000 EUR chacun'
          ], 'DCA 50 EUR/mois ETF chacun. Ouverts chez Trade Republic. Serviront de receptacle pour les donations titres CTO.')}

          ${assetCard('emerald', 'vault', 'Livrets', patrimoine.epargne, [
            'Ne pas descendre sous 25 000 EUR de matelas de securite',
            'Apres heritage : +40 000 EUR → total ~65 000 EUR'
          ], 'Role : securite + financement des dons Sarkozy progressifs (cash uniquement). Le matelas de securite est sacre.')}

          ${assetCard('orange', 'bitcoin', 'Bitcoin', patrimoine.crypto, [
            'Si valeur > 30-40k EUR : arbitrer vers Linxea (avant 70 ans) ou CTO',
            'Securiser les acces (seed phrase) dans un endroit connu des heritiers'
          ], 'DCA 60 EUR/mois. Actif speculatif, hors strategie de transmission. Simple diversification.')}

        </div>
      </div>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- HERITAGE ATTENDU -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="card-dark rounded-xl p-5 border border-pink-500/15">
        <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2 mb-3">
          <svg class="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a4 4 0 00-4-4 4 4 0 014 4zm0 0V6a4 4 0 014-4 4 4 0 01-4 4zM5 8h14M5 8a2 2 0 00-2 2v1h18v-1a2 2 0 00-2-2M3 11v5a2 2 0 002 2h14a2 2 0 002-2v-5"/></svg>
          Heritage attendu (~150 000 EUR)
        </h3>
        <p class="text-xs text-gray-500 mb-3">Date indeterminee — hypothese de travail : 2037-2040</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="rounded-xl p-3 bg-purple-500/5 border border-purple-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase">Linxea Spirit 2</p>
            <p class="text-lg font-bold text-purple-400">60 000 EUR</p>
            <p class="text-[10px] text-gray-600">Versement exceptionnel</p>
          </div>
          <div class="rounded-xl p-3 bg-blue-500/5 border border-blue-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase">CTO Perso</p>
            <p class="text-lg font-bold text-blue-400">50 000 EUR</p>
            <p class="text-[10px] text-gray-600">ETF World + actions</p>
          </div>
          <div class="rounded-xl p-3 bg-emerald-500/5 border border-emerald-500/15 text-center">
            <p class="text-[10px] text-gray-500 uppercase">Livrets</p>
            <p class="text-lg font-bold text-emerald-400">40 000 EUR</p>
            <p class="text-[10px] text-gray-600">Securite + qualite de vie</p>
          </div>
        </div>
      </div>


      <!-- ═══════════════════════════════════════════════ -->
      <!-- TIMELINE STRATEGIQUE -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="card-dark rounded-xl p-5">
        <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2 mb-4">
          <svg class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          Timeline strategique
        </h3>
        <div class="relative pl-6" id="strategy-timeline">
          <div class="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-pink-500/40 via-sky-500/30 to-transparent"></div>
          ${timelineEvents.map(evt => {
            const colorMap = {
              amber: { dot: 'bg-amber-500', bg: 'bg-amber-500/5', text: 'text-amber-400', border: 'border-amber-500/20' },
              green: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-400', border: 'border-emerald-500/20' },
              emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-400', border: 'border-emerald-500/20' },
              purple: { dot: 'bg-purple-500', bg: 'bg-purple-500/5', text: 'text-purple-400', border: 'border-purple-500/20' },
              blue: { dot: 'bg-blue-500', bg: 'bg-blue-500/5', text: 'text-blue-400', border: 'border-blue-500/20' },
              cyan: { dot: 'bg-cyan-500', bg: 'bg-cyan-500/5', text: 'text-cyan-400', border: 'border-cyan-500/20' },
              orange: { dot: 'bg-orange-500', bg: 'bg-orange-500/5', text: 'text-orange-400', border: 'border-orange-500/20' },
              pink: { dot: 'bg-pink-500', bg: 'bg-pink-500/5', text: 'text-pink-400', border: 'border-pink-500/20' },
            };
            const c = colorMap[evt.color] || colorMap.blue;
            return `
            <div class="relative mb-4 last:mb-0">
              <div class="absolute -left-[18px] top-1 w-5 h-5 rounded-full ${c.dot} flex items-center justify-center shadow-lg">
                <div class="w-2 h-2 rounded-full bg-white/80"></div>
              </div>
              <div class="${c.bg} border ${c.border} rounded-lg p-3 ml-2">
                <div class="flex items-center gap-2 mb-1">
                  <span class="${c.text} font-bold text-sm">${evt.year}</span>
                  <span class="text-gray-500 text-xs">${evt.age} ans</span>
                </div>
                <h4 class="text-gray-200 font-semibold text-sm mb-1">${evt.title}</h4>
                <p class="text-gray-400 text-xs leading-relaxed">${evt.desc}</p>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- BILAN SUCCESSION -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="card-dark rounded-xl p-5">
        <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2 mb-2">
          <svg class="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          Bilan succession projete (${projYear}, ${projAge} ans)
        </h3>
        <p class="text-xs text-gray-600 mb-4">Base : patrimoine projete avec les taux de rendement de ta page Projection</p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div class="rounded-xl p-4 bg-red-500/5 border border-red-500/20 text-center">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Sans optimisation</p>
            <p class="text-2xl font-bold text-red-400">${formatCurrency(totalDroitsSans)}</p>
            <p class="text-[10px] text-gray-600 mt-1">Droits bruts sur ${formatCurrency(projNet)}</p>
          </div>
          <div class="rounded-xl p-4 bg-emerald-500/5 border border-emerald-500/20 text-center">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Avec ta strategie</p>
            <p class="text-2xl font-bold text-emerald-400">${formatCurrency(Math.max(0, totalDroitsAvec))}</p>
            <p class="text-[10px] text-gray-600 mt-1">Demembrement + AV + donations</p>
          </div>
          <div class="rounded-xl p-4 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 text-center">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Economie</p>
            <p class="text-2xl font-bold text-cyan-400">${formatCurrency(Math.max(0, economie))}</p>
            <p class="text-[10px] text-emerald-400 mt-1">${economiePct}% de droits en moins</p>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between p-2.5 rounded-lg bg-dark-800/40">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-amber-500"></div>
              <span class="text-xs text-gray-400">Maison (~${formatCurrency(projImmo)})</span>
            </div>
            <span class="text-xs font-semibold text-emerald-400">0 EUR — demembrement 2026</span>
          </div>
          <div class="flex items-center justify-between p-2.5 rounded-lg bg-dark-800/40">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-purple-500"></div>
              <span class="text-xs text-gray-400">Assurance Vie (~${formatCurrency(projAV)})</span>
            </div>
            <span class="text-xs font-semibold ${projAV <= AV_ABATTEMENT_PAR_BENEFICIAIRE * nbEnfantsCalc ? 'text-emerald-400' : 'text-amber-400'}">${projAV <= AV_ABATTEMENT_PAR_BENEFICIAIRE * nbEnfantsCalc ? '0 EUR — dans l\'abattement 152 500 EUR/enf.' : formatCurrency((succAvec.avDroits) * nbEnfantsCalc) + ' — excedent hors abattement'}</span>
          </div>
          <div class="flex items-center justify-between p-2.5 rounded-lg bg-dark-800/40">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span class="text-xs text-gray-400">PEA + CTO + Livrets (~${formatCurrency(projPEA + projCTO + projEpargne)})</span>
            </div>
            <span class="text-xs font-semibold text-gray-300">Succession classique — abattements recharges</span>
          </div>
        </div>
      </div>


      <!-- ═══════════════════════════════════════════════ -->
      <!-- FAMILLE & DONATIONS -->
      <!-- ═══════════════════════════════════════════════ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg class="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Famille & Plan de donations
          </h3>
        </div>

        ${enfants.length === 0 ? `
          <p class="text-gray-500 text-sm text-center py-6">Ajoute tes enfants via le bouton ci-dessus pour simuler les donations.</p>
        ` : `
          <div class="space-y-4">
            ${enfants.map(enf => {
              const age = getAge(enf.dateNaissance);
              const g = childGauges(enf.id);
              const enfDons = donations.filter(d => d.enfantId === enf.id).sort((a, b) => a.annee - b.annee);
              const enfResults = simulerDonations(enf, enfDons, ageDonateur);
              return `
              <div class="bg-dark-800/50 rounded-lg border border-dark-400/20 group">
                <div class="flex flex-col md:flex-row">
                  <div class="p-4 md:w-64 md:min-w-[256px] md:border-r border-dark-400/15 flex-shrink-0">
                    <div class="flex items-center justify-between mb-3">
                      <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-full bg-pink-500/15 flex items-center justify-center text-pink-300 text-sm font-bold">
                          ${(enf.prenom || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p class="text-sm font-semibold text-gray-200">${enf.prenom || 'Sans nom'}</p>
                          <p class="text-[11px] text-gray-500">${age !== null ? age + ' ans' : 'Age inconnu'}</p>
                        </div>
                      </div>
                      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button data-edit-enfant="${enf.id}" class="p-1 rounded hover:bg-dark-500 text-gray-500 hover:text-pink-300 transition" title="Modifier">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button data-delete-enfant="${enf.id}" class="p-1 rounded hover:bg-dark-500 text-gray-500 hover:text-red-400 transition" title="Supprimer">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                    <!-- Gauge: Abattement -->
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-1">
                        <span class="text-gray-500">Abattement 100k</span>
                        <span class="text-gray-400">${formatCurrency(g.abattUtilise)} / ${formatCurrency(ABATTEMENT_PARENT_ENFANT)}</span>
                      </div>
                      <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all ${g.abattPct >= 100 ? 'bg-red-500' : g.abattPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${Math.min(100, g.abattPct)}%"></div>
                      </div>
                      <div class="flex justify-between mt-0.5">
                        <span class="text-[10px] ${g.abattRestant > 0 ? 'text-emerald-400' : 'text-red-400'}">${formatCurrency(g.abattRestant)} restant</span>
                        ${g.renewalYear ? `<span class="text-[10px] text-amber-400/70">Renouv. ${g.renewalYear}</span>` : ''}
                      </div>
                    </div>
                    <!-- Gauge: TEPA -->
                    <div class="mb-2.5">
                      <div class="flex justify-between text-[11px] mb-1">
                        <span class="text-gray-500">TEPA (Sarkozy)</span>
                        <span class="text-gray-400">${formatCurrency(g.tepaUtilise)} / ${formatCurrency(DON_FAMILIAL_TEPA)}</span>
                      </div>
                      <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all ${g.tepaPct >= 100 ? 'bg-red-500' : g.tepaPct >= 50 ? 'bg-amber-500' : 'bg-cyan-500'}" style="width: ${Math.min(100, g.tepaPct)}%"></div>
                      </div>
                      <span class="text-[10px] ${g.tepaRestant > 0 ? 'text-cyan-400' : 'text-red-400'}">${g.tepaRestant > 0 ? formatCurrency(g.tepaRestant) + ' disponible' : 'Utilise'}</span>
                    </div>
                    <!-- Gauge: AV -->
                    <div>
                      <div class="flex justify-between text-[11px] mb-1">
                        <span class="text-gray-500">Assurance Vie</span>
                        <span class="text-gray-400">${formatCurrency(Math.min(avParEnfant, AV_ABATTEMENT_PAR_BENEFICIAIRE))} / ${formatCurrency(AV_ABATTEMENT_PAR_BENEFICIAIRE)}</span>
                      </div>
                      <div class="h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all ${g.avPct >= 100 ? 'bg-red-500' : g.avPct >= 50 ? 'bg-amber-500' : 'bg-purple-500'}" style="width: ${Math.min(100, g.avPct)}%"></div>
                      </div>
                      <span class="text-[10px] ${g.avRestant > 0 ? 'text-purple-400' : 'text-red-400'}">${g.avRestant > 0 ? formatCurrency(g.avRestant) + ' disponible' : 'Sature'}</span>
                    </div>
                  </div>
                  <!-- Donation table -->
                  <div class="flex-1 p-4">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs text-gray-500 font-medium">Plan de donations</span>
                      <button data-add-donation-enfant="${enf.id}" class="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 transition text-[11px] flex items-center gap-1 border border-emerald-500/15">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                        Ajouter
                      </button>
                    </div>
                    ${enfDons.length === 0 ? `<p class="text-gray-600 text-xs text-center py-4">Aucune donation planifiee</p>` : `
                      <div class="overflow-x-auto">
                        <table class="w-full text-xs">
                          <thead><tr class="border-b border-dark-400/30 text-gray-500 text-[10px]">
                            <th class="text-left py-1.5 px-1.5 font-medium">Type</th>
                            <th class="text-right py-1.5 px-1.5 font-medium">Montant</th>
                            <th class="text-center py-1.5 px-1.5 font-medium">Annee</th>
                            <th class="text-right py-1.5 px-1.5 font-medium">Exonere</th>
                            <th class="text-right py-1.5 px-1.5 font-medium">Droits</th>
                            <th class="py-1.5 px-0.5"></th>
                          </tr></thead>
                          <tbody class="divide-y divide-dark-400/15">
                            ${enfDons.map(don => {
                              const r = enfResults.find(x => x.id === don.id);
                              return `<tr class="hover:bg-dark-600/20 transition group">
                                <td class="py-1.5 px-1.5"><span class="px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  don.type === 'don_tepa' ? 'bg-cyan-500/10 text-cyan-400' :
                                  don.type === 'donation_nue_propriete' ? 'bg-purple-500/10 text-purple-400' :
                                  don.type === 'donation_cto' ? 'bg-blue-500/10 text-blue-400' :
                                  'bg-emerald-500/10 text-emerald-400'
                                }">${donationTypeLabel(don.type)}</span></td>
                                <td class="py-1.5 px-1.5 text-right text-gray-200 font-medium">${formatCurrency(don.montant)}</td>
                                <td class="py-1.5 px-1.5 text-center text-gray-400">${don.annee}</td>
                                <td class="py-1.5 px-1.5 text-right text-emerald-400">${r ? formatCurrency(r.exonere) : '-'}</td>
                                <td class="py-1.5 px-1.5 text-right ${r && r.droits > 0 ? 'text-red-400' : 'text-emerald-400'} font-medium">${r ? formatCurrency(r.droits) : '-'}</td>
                                <td class="py-1.5 px-0.5">
                                  <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                                    <button data-edit-donation="${don.id}" class="p-0.5 rounded hover:bg-dark-500 text-gray-500 hover:text-emerald-300 transition"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                                    <button data-delete-donation="${don.id}" class="p-0.5 rounded hover:bg-dark-500 text-gray-500 hover:text-red-400 transition"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                                  </div>
                                </td>
                              </tr>`;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>
                    `}
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>
        `}
      </div>


      <!-- ═══════════════════════════════════════════════ -->
      <!-- MECANISMES FISCAUX (collapsible) -->
      <!-- ═══════════════════════════════════════════════ -->
      <details class="card-dark rounded-xl overflow-hidden group">
        <summary class="p-5 cursor-pointer flex items-center justify-between hover:bg-dark-600/20 transition">
          <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            Mecanismes fiscaux — Regles metier
          </h3>
          <svg class="w-5 h-5 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-5 space-y-6">
          <!-- Abattement classique -->
          <div>
            <h4 class="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
              Abattement classique donation (art. 784 CGI)
            </h4>
            <div class="text-xs text-gray-400 space-y-1 pl-4">
              <p>100 000 EUR/parent/enfant, renouvelable tous les 15 ans.</p>
              <p>S'applique a tout type de bien : cash, titres, immobilier.</p>
              <p class="text-amber-400">Consomme en 2026 par le demembrement (~99 000 EUR/enfant). Recharge en 2040-2041.</p>
            </div>
          </div>
          <!-- Don Sarkozy -->
          <div>
            <h4 class="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-cyan-500"></div>
              Don Sarkozy (art. 790 G CGI)
            </h4>
            <div class="text-xs text-gray-400 space-y-1 pl-4">
              <p>31 865 EUR/parent/enfant, renouvelable tous les 15 ans.</p>
              <p class="text-cyan-400 font-medium">CASH UNIQUEMENT. Pas de titres, pas d'immobilier.</p>
              <p>Cumulable avec l'abattement classique (deux enveloppes separees).</p>
              <p>Donateur < 80 ans. Donataire majeur.</p>
              <p>Declaration : formulaire 2735 en ligne sur impots.gouv.fr, dans le mois suivant le virement.</p>
              <p class="text-amber-400">Timing : 1er don ~2030 (~4 500 EUR/enfant, declenche compteur). Solde (~27 000 EUR/enfant) complete progressivement 2030-2041. Renouvellement possible des 2045.</p>
            </div>
          </div>
          <!-- AV -->
          <div>
            <h4 class="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-purple-500"></div>
              Assurance Vie — Abattement successoral
            </h4>
            <div class="text-xs text-gray-400 space-y-1 pl-4">
              <p>152 500 EUR/beneficiaire pour les primes versees avant 70 ans.</p>
              <p>Capital hors succession (ne passe pas par le notaire).</p>
              <p class="text-red-400 font-medium">Non renouvelable — unique, joue au deces. Si cloture du vivant : abattement perdu definitivement.</p>
              <p>Apres 70 ans : abattement reduit a 30 500 EUR global (tous beneficiaires confondus).</p>
            </div>
          </div>
          <!-- Demembrement -->
          <div>
            <h4 class="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-amber-500"></div>
              Demembrement de propriete
            </h4>
            <div class="text-xs text-gray-400 space-y-1 pl-4">
              <p>Nue-propriete (NP) + Usufruit (US) = Pleine propriete.</p>
              <p>A 42 ans : NP = 60% de la valeur selon bareme fiscal.</p>
              <p class="text-emerald-400">Au deces : usufruit s'eteint automatiquement. Pleine propriete restituee sans droits, sans formalite.</p>
              <p class="text-emerald-400">La plus-value entre la donation et le deces n'est jamais taxee.</p>
              <p>Clause de report d'usufruit : si vente du bien, l'usufruit se reporte sur le remploi.</p>
            </div>
          </div>
          <!-- Donation titres CTO -->
          <div>
            <h4 class="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-blue-500"></div>
              Donation de titres CTO
            </h4>
            <div class="text-xs text-gray-400 space-y-1 pl-4">
              <p>Transfert en nature (pas de vente prealable).</p>
              <p class="text-blue-400 font-medium">Purge des plus-values : la donation n'est pas une cession, pas de flat tax (30%) pour le donateur.</p>
              <p>Base fiscale des enfants = valeur au jour de la donation.</p>
              <p>Entre dans l'abattement classique 100 000 EUR/enfant.</p>
              <p>PEA non donnable de son vivant (uniquement CTO).</p>
            </div>
          </div>
        </div>
      </details>

      <!-- ═══════════════════════════════════════════════ -->
      <!-- BAREMES FISCAUX (collapsible) -->
      <!-- ═══════════════════════════════════════════════ -->
      <details class="card-dark rounded-xl overflow-hidden group">
        <summary class="p-5 cursor-pointer flex items-center justify-between hover:bg-dark-600/20 transition">
          <h3 class="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
            Baremes fiscaux de reference
          </h3>
          <svg class="w-5 h-5 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="px-5 pb-5 space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- Abattements -->
            <div>
              <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">Abattements par lien de parente</h4>
              <table class="w-full text-xs">
                <tbody class="divide-y divide-dark-400/15">
                  ${ABATTEMENTS_REF.map(a => `
                  <tr class="hover:bg-dark-600/20 transition">
                    <td class="py-1.5 text-gray-400">${a.lien}</td>
                    <td class="py-1.5 text-right font-medium text-emerald-400">${formatCurrency(a.montant)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
            <!-- Tranches -->
            <div>
              <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">Droits de donation (ligne directe)</h4>
              <table class="w-full text-xs">
                <tbody class="divide-y divide-dark-400/15">
                  ${TRANCHES_DONATION.map(t => `
                  <tr class="hover:bg-dark-600/20 transition">
                    <td class="py-1.5 text-gray-400">${formatCurrency(t.min)} - ${t.max === Infinity ? 'au-dela' : formatCurrency(t.max)}</td>
                    <td class="py-1.5 text-right font-medium text-amber-400">${(t.taux * 100).toFixed(0)}%</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
          <!-- Usufruit -->
          <div>
            <h4 class="text-xs font-semibold text-gray-500 uppercase mb-2">Bareme usufruit / nue-propriete (Art. 669 CGI)</h4>
            <table class="w-full text-xs">
              <thead><tr class="border-b border-dark-400/30 text-gray-500 text-[10px]">
                <th class="text-left py-1.5 font-medium">Age du donateur</th>
                <th class="text-right py-1.5 font-medium">Usufruit</th>
                <th class="text-right py-1.5 font-medium">Nue-propriete</th>
              </tr></thead>
              <tbody class="divide-y divide-dark-400/15">
                ${BAREME_USUFRUIT.filter(b => b.ageMax !== Infinity).map((b, i) => {
                  const prevMax = i > 0 ? BAREME_USUFRUIT[i-1].ageMax : 0;
                  const highlight = ageDonateur <= b.ageMax && ageDonateur > prevMax;
                  return `<tr class="${highlight ? 'bg-pink-500/5 border-l-2 border-pink-400' : ''} hover:bg-dark-600/20 transition">
                    <td class="py-1.5 text-gray-400">${prevMax + 1} - ${b.ageMax} ans</td>
                    <td class="py-1.5 text-right text-gray-400">${(b.usufruit * 100).toFixed(0)}%</td>
                    <td class="py-1.5 text-right font-medium text-pink-400">${(b.nuePropriete * 100).toFixed(0)}%</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <div class="p-3 rounded-xl bg-dark-800/30 border border-dark-400/20">
        <p class="text-xs text-gray-600">Simulation indicative basee sur le droit fiscal francais en vigueur et les taux de rendement configures dans ta page Projection. Ne constitue pas un conseil juridique ou fiscal. Consulte un notaire pour ta situation personnelle.</p>
      </div>

    </div>
  `;
}


// ============================================================================
// MOUNT — Event listeners
// ============================================================================

export function mount(store, navigate) {
  const cfg = getConfig(store);
  const enfants = cfg.enfants || [];
  const donations = cfg.donations || [];
  const params = store.get('parametres') || {};
  const ageDonateur = params.ageFinAnnee || 42;

  function refresh() { navigate('fiscalite'); }

  // --- Add child ---
  document.getElementById('btn-add-enfant')?.addEventListener('click', () => {
    openEnfantModal(store, refresh);
  });

  // --- Edit child ---
  document.querySelectorAll('[data-edit-enfant]').forEach(btn => {
    btn.addEventListener('click', () => {
      const enf = enfants.find(e => e.id === btn.dataset.editEnfant);
      if (enf) openEnfantModal(store, refresh, enf);
    });
  });

  // --- Delete child ---
  document.querySelectorAll('[data-delete-enfant]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cet enfant et toutes ses donations ?')) {
        const c = getConfig(store);
        c.enfants = (c.enfants || []).filter(e => e.id !== btn.dataset.deleteEnfant);
        c.donations = (c.donations || []).filter(d => d.enfantId !== btn.dataset.deleteEnfant);
        saveConfig(store, c);
        refresh();
      }
    });
  });

  // --- Add donation per child ---
  document.querySelectorAll('[data-add-donation-enfant]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getConfig(store);
      const enfantId = btn.dataset.addDonationEnfant;
      const enf = (c.enfants || []).find(e => e.id === enfantId);
      if (!enf) return;
      openDonationModal(store, refresh, c.enfants, null, enfantId);
    });
  });

  // --- Edit donation ---
  document.querySelectorAll('[data-edit-donation]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getConfig(store);
      const don = (c.donations || []).find(d => d.id === btn.dataset.editDonation);
      if (don) openDonationModal(store, refresh, c.enfants, don);
    });
  });

  // --- Delete donation ---
  document.querySelectorAll('[data-delete-donation]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Supprimer cette donation ?')) {
        const c = getConfig(store);
        c.donations = (c.donations || []).filter(d => d.id !== btn.dataset.deleteDonation);
        saveConfig(store, c);
        refresh();
      }
    });
  });
}

// ============================================================================
// MODAL: Add/Edit Child
// ============================================================================

function openEnfantModal(store, refresh, editEnfant = null) {
  const title = editEnfant ? 'Modifier l\'enfant' : 'Ajouter un enfant';
  const body = `
    ${inputField('prenom', 'Prenom', editEnfant?.prenom || '', 'text', 'placeholder="Ex: Gaspard, Agathe..."')}
    ${inputField('dateNaissance', 'Date de naissance', editEnfant?.dateNaissance || '', 'date')}
  `;
  openModal(title, body, () => {
    const modal = document.getElementById('app-modal');
    const data = getFormData(modal.querySelector('#modal-body'));
    if (!data.prenom) return;
    const c = getConfig(store);
    if (editEnfant) {
      c.enfants = (c.enfants || []).map(e =>
        e.id === editEnfant.id ? { ...e, prenom: data.prenom, dateNaissance: data.dateNaissance } : e
      );
    } else {
      c.enfants = c.enfants || [];
      c.enfants.push({ id: generateId(), prenom: data.prenom, dateNaissance: data.dateNaissance });
    }
    saveConfig(store, c);
    refresh();
  });
}

// ============================================================================
// MODAL: Add/Edit Donation
// ============================================================================

function openDonationModal(store, refresh, enfants, editDon = null, preselectedEnfantId = null) {
  const currentYear = new Date().getFullYear();
  const title = editDon ? 'Modifier la donation' : 'Planifier une donation';
  const enfantOptions = enfants.map(e => ({ value: e.id, label: e.prenom || 'Sans nom' }));
  const typeOptions = DONATION_TYPES;
  const selectedEnfantId = editDon?.enfantId || preselectedEnfantId || enfants[0]?.id || '';
  const body = `
    ${selectField('enfantId', 'Enfant', enfantOptions, selectedEnfantId)}
    ${selectField('type', 'Type de donation', typeOptions, editDon?.type || 'don_manuel')}
    ${inputField('montant', 'Montant (euros)', editDon?.montant || '', 'number', 'min="0" step="1000" placeholder="100000"')}
    ${inputField('annee', 'Annee cible', editDon?.annee || currentYear, 'number', `min="${currentYear}" max="${currentYear + 50}" step="1"`)}
    <p class="text-xs text-gray-600 mt-1">
      Les abattements se renouvellent tous les 15 ans. Le don TEPA necessite que le donateur ait moins de 80 ans.
    </p>
  `;
  openModal(title, body, () => {
    const modal = document.getElementById('app-modal');
    const data = getFormData(modal.querySelector('#modal-body'));
    if (!data.enfantId || !data.montant || !data.annee) return;
    const c = getConfig(store);
    c.donations = c.donations || [];
    if (editDon) {
      c.donations = c.donations.map(d =>
        d.id === editDon.id
          ? { ...d, enfantId: data.enfantId, type: data.type, montant: Number(data.montant), annee: Number(data.annee) }
          : d
      );
    } else {
      c.donations.push({
        id: generateId(), enfantId: data.enfantId, type: data.type,
        montant: Number(data.montant), annee: Number(data.annee)
      });
    }
    saveConfig(store, c);
    refresh();
  });
}
