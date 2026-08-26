import { formatCurrency, computeProjection, showToast } from '../utils.js?v=20260808f';
import { createChart } from '../charts/chart-config.js';

// ============================================================
// LIBERTÉ FINANCIÈRE — quand puis-je vivre de mon capital,
// qu'est-ce qui avance cette date, et que paiera ma rente ?
// Page de stratégie : ne modifie rien tant qu'on n'enregistre pas.
// ============================================================

// État exploratoire des leviers (non persisté tant que « Enregistrer » n'est pas cliqué)
let expSwr = null;      // en %
let expDep = null;      // €/mois

function getParams(store) { return store.get('parametres') || {}; }

function depensesReelles(store) {
  // Dépenses récurrentes des Flux mensuels + mensualités de crédit
  const dep = (store.get('depenses') || []).reduce((s, i) => {
    const m = Number(i.montantMensuel) || 0;
    return s + (i.frequence === 'Annuel' ? m / 12 : m);
  }, 0);
  return Math.round(dep);
}

function computeFire(store, swrPct, depMensuel) {
  const params = getParams(store);
  const snapshots = computeProjection(store);
  const swr = swrPct / 100;
  const depBase = depMensuel * 12;
  const inflation = params.inflationRate || 0.02;
  const salaires = store.get('salairesParAnnee') || {};
  const pensions = store.get('pensionsParAnnee') || {};
  const autres = store.get('autresRevenusParAnnee') || {};
  let firstIdx = -1;
  let firstIdxAvecRevenus = -1;
  const data = snapshots.map((s, idx) => {
    const depenses = depBase * Math.pow(1 + inflation, s.annee);
    const rente = s.totalLiquiditesNettes * swr;
    const complements = (Number(salaires[s.calendarYear]) || 0) + (Number(pensions[s.calendarYear]) || 0) + (Number(autres[s.calendarYear]) || 0);
    const couvertureFire = depenses > 0 ? rente / depenses : 0;
    const couverture = depenses > 0 ? (rente + complements) / depenses : 0;
    if (couvertureFire >= 1 && firstIdx === -1) firstIdx = idx;
    if (couverture >= 1 && firstIdxAvecRevenus === -1) firstIdxAvecRevenus = idx;
    return { depenses, rente, complements, couvertureFire, couverture, necessaire: depenses / swr };
  });
  return { snapshots, data, firstIdx, firstIdxAvecRevenus, swr, depBase, inflation };
}

// Simulation d'une année type de retraits à l'année 🔥 (ou en fin de projection)
function simulerAnneeType(fire, store) {
  const idx = fire.firstIdx >= 0 ? fire.firstIdx : fire.snapshots.length - 1;
  const snap = fire.snapshots[idx];
  const besoinNet = fire.data[idx].depenses;
  const det = snap.placementDetail || {};
  const gains = snap.placementGains || {};
  const rates = snap.placementTaxRates || {};

  // Ordre de retrait optimal : épargne, PEE, PEA, AV, CTO/Crypto, reste
  const ordre = [];
  if ((snap.epargne || 0) > 0) ordre.push({ source: 'Épargne (livrets)', valeur: snap.epargne, gainShare: 0, taux: 0, raison: 'Aucune plus-value taxable, liquidité immédiate' });
  const pushGroup = (gk, raison) => {
    const v = det[gk] || 0;
    if (v <= 0) return;
    const g = Math.max(0, gains[gk] || 0);
    ordre.push({ source: gk, valeur: v, gainShare: v > 0 ? Math.min(1, g / v) : 0, taux: rates[gk] || 0, raison });
  };
  Object.keys(det).filter(k => k === 'PEE').forEach(k => pushGroup(k, 'Débloqué à la retraite, prélèvements sociaux seuls'));
  Object.keys(det).filter(k => k.startsWith('PEA')).forEach(k => pushGroup(k, 'PEA mûr : prélèvements sociaux seuls sur les gains'));
  Object.keys(det).filter(k => k === 'Assurance Vie').forEach(k => pushGroup(k, 'Après 8 ans : abattement annuel puis fiscalité douce'));
  Object.keys(det).filter(k => !k.startsWith('PEA') && k !== 'PEE' && k !== 'Assurance Vie').forEach(k => pushGroup(k, 'Flat tax (PFU) sur la part de gains'));

  // Retirer dans l'ordre jusqu'à couvrir le besoin net
  const lignes = [];
  let resteNet = besoinNet;
  let totalBrut = 0, totalImpots = 0;
  for (const o of ordre) {
    if (resteNet <= 0) break;
    const netParEuro = 1 - o.gainShare * o.taux;   // net perçu pour 1 € retiré
    const brutDispo = o.valeur;
    const netDispo = brutDispo * netParEuro;
    const netPris = Math.min(resteNet, netDispo);
    const brutPris = netParEuro > 0 ? netPris / netParEuro : netPris;
    const impots = brutPris - netPris;
    lignes.push({ ...o, brut: brutPris, impots, net: netPris });
    totalBrut += brutPris; totalImpots += impots;
    resteNet -= netPris;
  }
  const tauxEffectif = totalBrut > 0 ? totalImpots / totalBrut : 0;
  return { idx, snap, besoinNet, lignes, totalBrut, totalImpots, tauxEffectif, couvert: resteNet <= 1 };
}

// Échéances fiscales personnelles
function echeancesFiscales(store, fire) {
  const params = getParams(store);
  const placements = store.get('actifs.placements') || [];
  const currentYear = new Date().getFullYear();
  const age = params.ageFinAnnee || 43;
  const cards = [];

  const openYear = (envPrefix) => {
    const dates = placements
      .filter(p => (p.enveloppe || '').startsWith(envPrefix) && p.dateOuverture)
      .map(p => new Date(p.dateOuverture).getFullYear())
      .filter(y => !isNaN(y));
    return dates.length ? Math.min(...dates) : null;
  };

  const peaOpen = openYear('PEA');
  if (peaOpen) {
    const matur = peaOpen + 5;
    if (matur > currentYear) {
      const peaVal = Object.entries(fire.snapshots[0].placementDetail || {}).filter(([k]) => k.startsWith('PEA')).reduce((s, [, v]) => s + v, 0);
      const peaGains = Object.entries(fire.snapshots[0].placementGains || {}).filter(([k]) => k.startsWith('PEA')).reduce((s, [, v]) => s + Math.max(0, v), 0);
      const economie = Math.round(peaGains * 0.128);
      cards.push({ annee: matur, titre: `PEA : 5 ans en ${matur}`, texte: `Avant cette date, un retrait ferme le plan et les gains paient le PFU complet. Après, prélèvements sociaux seuls${economie > 0 ? ` — soit ~${formatCurrency(economie)} d'IR économisés sur tes gains actuels` : ''}.` });
    } else {
      cards.push({ annee: null, titre: 'PEA mûr ✓', texte: 'Tes 5 ans sont passés : les retraits ne paient plus que les prélèvements sociaux sur les gains, sans fermer le plan.' });
    }
  }
  const avOpen = openYear('AV');
  if (avOpen) {
    const matur = avOpen + 8;
    if (matur > currentYear) cards.push({ annee: matur, titre: `Assurance vie : 8 ans en ${matur}`, texte: `À partir de ${matur}, 4 600 € de gains rachetés par an (9 200 € en couple) échappent à l'impôt sur le revenu.` });
    else cards.push({ annee: null, titre: 'Assurance vie : 8 ans passés ✓', texte: 'Chaque année, 4 600 € de gains rachetés (9 200 € en couple) sont exonérés d\'IR.' });
  }
  if (age < 70) {
    const y70 = currentYear + (70 - age);
    cards.push({ annee: y70, titre: `70 ans en ${y70} : cap AV`, texte: 'Derniers versements d\'assurance vie transmis avec 152 500 € d\'abattement par enfant. Après 70 ans, l\'abattement tombe à 30 500 € au total. → voir Transmission' });
  }
  const hasPEE = placements.some(p => (p.enveloppe || '') === 'PEE');
  if (hasPEE) {
    const yRet = currentYear + Math.max(0, (params.ageRetraiteSouhaitee || params.ageRetraite || 64) - age);
    cards.push({ annee: yRet, titre: `PEE débloqué vers ${yRet}`, texte: 'Au départ en retraite, ton PEE devient entièrement disponible — prélèvements sociaux seuls sur les gains. Première source à consommer.' });
  }
  return cards.sort((a, b) => (a.annee || 0) - (b.annee || 0));
}

// Le conseiller — règles depuis le profil réel (investisseur, propriétaire, parent…)
function conseils(store, fire, annee) {
  const params = getParams(store);
  const placements = store.get('actifs.placements') || [];
  const epargneTotal = (store.get('actifs.epargne') || []).reduce((s, e) => s + (Number(e.solde) || 0), 0);
  const emprunts = store.get('passifs.emprunts') || [];
  const enfants = ((store.get('donationConfig') || {}).enfants || []);
  const depReelles = depensesReelles(store) || 1;
  const currentYear = new Date().getFullYear();
  const age = params.ageFinAnnee || 43;
  const recos = [];

  // 1. Matelas de sécurité
  const moisMatelas = epargneTotal / depReelles;
  if (moisMatelas < 3) {
    recos.push({ prio: 1, titre: `Matelas de sécurité : ${moisMatelas.toFixed(1)} mois de dépenses`, texte: `En dessous de 3 mois, un pépin (voiture, toiture, période sans revenu) t'obligerait à vendre des placements au mauvais moment. Vise 3 à 6 mois (${formatCurrency(depReelles * 3)} – ${formatCurrency(depReelles * 6)}) avant d'accélérer le DCA.` });
  } else if (moisMatelas > 12) {
    recos.push({ prio: 2, titre: `${Math.round(moisMatelas)} mois de dépenses dorment sur tes livrets`, texte: `Au-delà de ~6 mois de matelas (${formatCurrency(depReelles * 6)}), l'excédent (${formatCurrency(Math.round(epargneTotal - depReelles * 6))}) perd du pouvoir d'achat face à l'inflation. Un transfert progressif vers le PEA le met au travail.` });
  } else {
    recos.push({ prio: 3, titre: `Matelas de sécurité : ${Math.round(moisMatelas)} mois ✓`, texte: 'Entre 3 et 12 mois de dépenses en réserve : tu peux investir sereinement sans risquer de vendre au mauvais moment.' });
  }

  // 2. PEA d'abord (si DCA hors PEA et plafond non atteint)
  const dcaCTO = placements.filter(p => (p.enveloppe || '').startsWith('CTO') || (p.enveloppe || '') === 'Crypto').reduce((s, p) => s + (Number(p.dcaMensuel) || 0), 0);
  const apportsPEA = Object.entries(fire.snapshots[0].placementApports || {}).filter(([k]) => k.startsWith('PEA')).reduce((s, [, v]) => s + v, 0);
  if (dcaCTO > 0 && apportsPEA < 150000) {
    recos.push({ prio: 2, titre: `${formatCurrency(dcaCTO)}/mois investis hors PEA`, texte: `Sur le CTO/crypto, chaque euro de gain paiera ~31,4 % (PFU) contre 18,6 % dans un PEA mûr. Il te reste ${formatCurrency(150000 - Math.round(apportsPEA))} de plafond PEA : privilégier ce canal réduit la facture de ta future rente.` });
  }

  // 3. Parents : AV et transmission
  if (enfants.length > 0) {
    const avTotal = (fire.snapshots[0].placementDetail || {})['Assurance Vie'] || 0;
    const capacite = 152500 * enfants.length;
    if (avTotal < capacite && age < 70) {
      recos.push({ prio: 2, titre: `Parent de ${enfants.length} : l'AV couvre le volet transmission`, texte: `Pour la part de ton patrimoine destinée aux enfants, l'AV offre ${formatCurrency(capacite)} transmissibles hors succession si versés avant 70 ans (encours actuel : ${formatCurrency(avTotal)}). Elle complète tes PEA/CTO — qui gardent leur rôle de moteurs de croissance — sans les remplacer. → détails sur Transmission` });
    }
  }

  // 4. Propriétaire avec crédit : ne pas rembourser trop vite
  const credit = emprunts.find(e => (Number(e.capitalRestant) || 0) > 0);
  if (credit) {
    const taux = (Number(credit.tauxAnnuel) || 0) * 100;
    if (taux > 0 && taux < 5) {
      recos.push({ prio: 3, titre: `Ton crédit à ${taux.toFixed(2).replace('.', ',')} % est un allié`, texte: `Rembourser par anticipation « rapporte » ${taux.toFixed(1).replace('.', ',')} % garantis, mais tes placements long terme visent davantage. Tant que l'écart persiste, chaque euro disponible travaille mieux investi que remboursé.` });
    }
  }

  // 5. La retraite « officielle » comme filet
  const yRetraite = currentYear + Math.max(0, (params.ageRetraite || 64) - age);
  if (fire.firstIdx >= 0 && annee && annee < yRetraite) {
    recos.push({ prio: 3, titre: `Ta liberté (${annee}) arrive avant ta retraite légale (${yRetraite})`, texte: `Entre les deux, ta rente doit tout couvrir. À partir de ${yRetraite}, la pension prend le relais d'une partie des dépenses — le capital nécessaire diminue fortement après cette date.` });
  }

  return recos.sort((a, b) => a.prio - b.prio).slice(0, 6);
}

// Conseils exportés pour la page « Le conseiller » (paramètres enregistrés)
export function getConseilsLiberte(store) {
  try {
    const params = getParams(store);
    const swrPct = params.swr || 4;
    const depMens = params.fireDepensesMensuelles || depensesReelles(store) || 1750;
    const fire = computeFire(store, swrPct, depMens);
    const annee = fire.firstIdx >= 0 ? new Date().getFullYear() + fire.firstIdx : null;
    return conseils(store, fire, annee);
  } catch (e) { return []; }
}

// ============================================================
export function render(store) {
  const params = getParams(store);
  const swrPct = expSwr ?? (params.swr || 4);
  const depReel = depensesReelles(store);
  const depMens = expDep ?? (params.fireDepensesMensuelles || depReel || 1750);
  const currentYear = new Date().getFullYear();
  const age = params.ageFinAnnee || 43;

  const fire = computeFire(store, swrPct, depMens);
  const idx = fire.firstIdx;
  const anneeFire = idx >= 0 ? currentYear + idx : null;
  const snapFire = idx >= 0 ? fire.snapshots[idx] : fire.snapshots[fire.snapshots.length - 1];
  const dFire = idx >= 0 ? fire.data[idx] : fire.data[fire.data.length - 1];
  const anneeType = simulerAnneeType(fire, store);
  const echeances = echeancesFiscales(store, fire);
  const cartes = conseils(store, fire, anneeFire);

  const modifie = expSwr !== null || expDep !== null;

  return `
    <div class="space-y-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
          <svg class="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-100">Liberté financière</h1>
          <p class="text-xs text-gray-500">Quand ton capital pourra payer ta vie — et ce qu'il paiera d'impôts</p>
        </div>
      </div>

      <!-- ═ VERDICT ═ -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div class="card-dark rounded-xl px-4 py-3.5 border border-orange-500/25 bg-orange-500/5">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest">🔥 Ta liberté</p>
          <p class="text-xl font-extrabold text-orange-400 tabular-nums mt-1">${anneeFire ? anneeFire : 'au-delà'}</p>
          <p class="text-[10px] text-gray-600 mt-0.5">${anneeFire ? `à ${age + idx} ans — la rente couvre 100 % des dépenses` : 'de l\'horizon de projection actuel'}</p>
        </div>
        <div class="card-dark rounded-xl px-4 py-3.5">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest">Capital nécessaire</p>
          <p class="text-xl font-extrabold text-gray-100 tabular-nums mt-1">${formatCurrency(Math.round(dFire.necessaire))}</p>
          <p class="text-[10px] text-gray-600 mt-0.5">${formatCurrency(Math.round(dFire.depenses / 12))}/mois ÷ ${swrPct.toString().replace('.', ',')} % de retrait</p>
        </div>
        <div class="card-dark rounded-xl px-4 py-3.5">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest">Ton capital ${anneeFire ? `en ${anneeFire}` : 'projeté'}</p>
          <p class="text-xl font-extrabold text-accent-green tabular-nums mt-1">${formatCurrency(snapFire.totalLiquiditesNettes)}</p>
          <p class="text-[10px] text-gray-600 mt-0.5">net d'impôts, immobilier exclu</p>
        </div>
        <div class="card-dark rounded-xl px-4 py-3.5">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest">Créance fiscale latente</p>
          <p class="text-xl font-extrabold text-red-400/90 tabular-nums mt-1">${formatCurrency(snapFire.totalTaxes || 0)}</p>
          <p class="text-[10px] text-gray-600 mt-0.5">la part de l'État sur tes gains ${anneeFire ? `en ${anneeFire}` : 'projetés'} — déjà déduite ci-contre</p>
        </div>
      </div>

      <!-- ═ CROISEMENT ═ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Le croisement</h2>
          <span class="text-[10px] text-gray-600">quand la courbe verte dépasse la courbe rouge, tu es libre</span>
        </div>
        <div class="relative" style="height: 280px;"><canvas id="lf-chart"></canvas></div>
      </div>

      <!-- ═ LEVIERS ═ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"/></svg>
            <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Les leviers</h2>
            <span class="text-[10px] text-gray-600">exploratoire — rien n'est modifié tant que tu n'enregistres pas</span>
          </div>
          ${modifie ? `<button id="lf-save" class="btn-primary text-xs">Enregistrer ces hypothèses</button>` : ''}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p class="text-xs text-gray-400 mb-1.5">Taux de retrait (SWR) — la part du capital consommée chaque année</p>
            <div class="flex gap-1.5">
              ${[3, 3.5, 4].map(v => `
              <button class="lf-swr flex-1 px-3 py-2 rounded-lg border text-sm font-semibold transition ${swrPct === v ? 'border-orange-500/50 bg-orange-500/10 text-orange-400' : 'border-dark-400/30 bg-dark-800 text-gray-400 hover:border-dark-300/50'}" data-swr="${v}">${String(v).replace('.', ',')} %</button>`).join('')}
            </div>
            <p class="text-[10px] text-gray-600 mt-1.5">${swrPct <= 3 ? 'Très prudent : le capital survit à quasi tous les scénarios historiques, même sur 50 ans.' : swrPct <= 3.5 ? 'Prudent : adapté à une liberté précoce (40-50 ans), marge contre les mauvaises décennies.' : 'Classique (étude Trinity) : fiable sur ~30 ans de retraite, plus juste au-delà.'}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1.5">Dépenses mensuelles une fois libre</p>
            <div class="flex items-center gap-2">
              <input type="number" id="lf-dep" value="${depMens}" min="0" step="50" inputmode="decimal"
                class="w-32 px-3 py-2 bg-dark-800 border border-dark-400/50 rounded-lg text-gray-200 text-sm font-semibold focus:ring-2 focus:ring-orange-500/40">
              <span class="text-xs text-gray-500">€/mois</span>
              ${depReel > 0 && depMens !== depReel ? `<button id="lf-dep-reel" class="btn-ghost">Mes dépenses réelles (${formatCurrency(depReel)})</button>` : depReel > 0 ? `<span class="text-[10px] text-emerald-500">= tes dépenses réelles ✓</span>` : ''}
            </div>
            <p class="text-[10px] text-gray-600 mt-1.5">Préremplies depuis tes Flux mensuels. Le crédit maison sera peut-être soldé d'ici là — ajuste librement.</p>
          </div>
        </div>
        <div id="lf-impacts" class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2"></div>
      </div>

      <!-- ═ TA RENTE, MODE D'EMPLOI ═ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-1">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Ta rente, mode d'emploi</h2>
        </div>
        <p class="text-xs text-gray-500 mb-4">Une année type ${anneeFire ? `en ${anneeFire}` : 'en fin de projection'} : couvrir ${formatCurrency(Math.round(anneeType.besoinNet))} de dépenses, en piochant dans le bon ordre.</p>
        <div class="overflow-x-auto">
          <table class="w-full text-xs min-w-[560px]">
            <thead class="text-gray-500 text-[10px] uppercase tracking-wide border-b border-dark-400/30">
              <tr>
                <th class="text-left py-1.5 px-2">#</th>
                <th class="text-left py-1.5 px-2">Source</th>
                <th class="text-right py-1.5 px-2">Retiré</th>
                <th class="text-right py-1.5 px-2">Impôts &amp; PS</th>
                <th class="text-right py-1.5 px-2">Net perçu</th>
                <th class="text-left py-1.5 px-2">Pourquoi cet ordre</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dark-400/15">
              ${anneeType.lignes.map((l, i) => `
              <tr>
                <td class="py-2 px-2 text-gray-600">${i + 1}</td>
                <td class="py-2 px-2 text-gray-200 font-medium whitespace-nowrap">${l.source}</td>
                <td class="py-2 px-2 text-right text-gray-300 whitespace-nowrap">${formatCurrency(Math.round(l.brut))}</td>
                <td class="py-2 px-2 text-right ${l.impots > 0.5 ? 'text-red-400' : 'text-gray-600'} whitespace-nowrap">${l.impots > 0.5 ? '−' + formatCurrency(Math.round(l.impots)) : '0 €'}</td>
                <td class="py-2 px-2 text-right text-emerald-400 font-medium whitespace-nowrap">${formatCurrency(Math.round(l.net))}</td>
                <td class="py-2 px-2 text-gray-500">${l.raison}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot class="border-t border-dark-400/40">
              <tr class="font-semibold">
                <td class="py-2 px-2" colspan="2"><span class="text-gray-300">Total</span></td>
                <td class="py-2 px-2 text-right text-gray-200">${formatCurrency(Math.round(anneeType.totalBrut))}</td>
                <td class="py-2 px-2 text-right text-red-400">−${formatCurrency(Math.round(anneeType.totalImpots))}</td>
                <td class="py-2 px-2 text-right text-emerald-400">${formatCurrency(Math.round(anneeType.totalBrut - anneeType.totalImpots))}</td>
                <td class="py-2 px-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="mt-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-4 py-3">
          <p class="text-sm text-gray-200"><span class="font-bold text-emerald-400">Taux d'imposition réel de ta rente : ${(anneeType.tauxEffectif * 100).toFixed(1).replace('.', ',')} %</span></p>
          <p class="text-[11px] text-gray-400 mt-1 leading-relaxed">Bien loin des 30 % redoutés : chaque retrait est surtout composé de ton capital (non taxé) — seule la part de gains est imposée, aux taux doux des bonnes enveloppes. C'est l'intérêt d'avoir construit PEA, AV et PEE en amont.</p>
        </div>
      </div>

      <!-- ═ ÉCHÉANCIER FISCAL ═ -->
      ${echeances.length > 0 ? `
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
          <h2 class="text-base font-bold text-gray-300 uppercase tracking-wide">Tes échéances fiscales</h2>
          <span class="text-[10px] text-gray-600">chaque date change une règle du jeu</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${echeances.map(e => `
          <div class="rounded-lg bg-dark-800/50 border ${e.annee ? 'border-amber-500/20' : 'border-emerald-500/20'} px-3.5 py-3">
            <p class="text-xs font-semibold ${e.annee ? 'text-amber-400' : 'text-emerald-400'}">${e.titre}</p>
            <p class="text-[11px] text-gray-400 mt-1 leading-relaxed">${e.texte}</p>
          </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- ═ LE CONSEILLER ═ -->
      <div class="card-dark rounded-xl p-5">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
          <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider">Le conseiller</h2>
          <span class="text-[10px] text-gray-600">depuis ton profil : investisseur, propriétaire${((store.get('donationConfig') || {}).enfants || []).length > 0 ? ', parent' : ''}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${cartes.map(r => {
            const st = r.prio === 1 ? { border: 'border-red-500/25', bg: 'bg-red-500/5', text: 'text-red-400' }
              : r.prio === 2 ? { border: 'border-amber-500/25', bg: 'bg-amber-500/5', text: 'text-amber-400' }
              : { border: 'border-blue-500/20', bg: 'bg-blue-500/5', text: 'text-blue-400' };
            return `<div class="rounded-lg ${st.bg} border ${st.border} px-3.5 py-3">
              <p class="text-xs font-semibold ${st.text}">${r.titre}</p>
              <p class="text-[11px] text-gray-400 mt-1 leading-relaxed">${r.texte}</p>
            </div>`;
          }).join('')}
        </div>
      </div>

      <p class="text-[10px] text-gray-600 text-center">Mêmes moteur et hypothèses que la Projection · la fiscalité de transmission vit sur la page Transmission</p>
    </div>
  `;
}

// ============================================================
export function mount(store, navigate) {
  const params = getParams(store);
  const swrPct = expSwr ?? (params.swr || 4);
  const depReel = depensesReelles(store);
  const depMens = expDep ?? (params.fireDepensesMensuelles || depReel || 1750);
  const currentYear = new Date().getFullYear();

  const fire = computeFire(store, swrPct, depMens);

  // ── Graphique du croisement ──
  const labels = fire.snapshots.map(s => s.calendarYear);
  const anneeFire = fire.firstIdx >= 0 ? currentYear + fire.firstIdx : null;
  createChart('lf-chart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ton capital (net d\'impôts)',
          data: fire.snapshots.map(s => s.totalLiquiditesNettes),
          borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.08)',
          fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2,
        },
        {
          label: 'Capital nécessaire pour être libre',
          data: fire.data.map(d => d.necessaire),
          borderColor: '#f87171', borderDash: [6, 4],
          fill: false, tension: 0.35, pointRadius: 0, borderWidth: 2,
        }
      ]
    },
    options: {
      scales: {
        x: { grid: { color: 'rgba(72,72,82,0.15)' }, ticks: { color: '#7a7a88', font: { size: 10 }, maxTicksLimit: 10 } },
        y: { grid: { color: 'rgba(72,72,82,0.2)' }, ticks: { color: '#7a7a88', font: { size: 10 }, callback: (v) => (v / 1000) + ' k€' } }
      },
      plugins: {
        annotation: anneeFire ? {
          annotations: {
            fireline: {
              type: 'line', xMin: String(anneeFire), xMax: String(anneeFire),
              borderColor: '#fb923c', borderWidth: 1.5, borderDash: [4, 3],
              label: { display: true, content: '🔥 ' + anneeFire, position: 'start', backgroundColor: 'rgba(251,146,60,0.15)', color: '#fb923c', font: { size: 10, weight: 'bold' } }
            }
          }
        } : {}
      }
    }
  });

  // ── Impacts des leviers ──
  const yearOf = (swrV, depV) => {
    const f = computeFire(store, swrV, depV);
    return f.firstIdx >= 0 ? currentYear + f.firstIdx : null;
  };
  const base = anneeFire;
  const impacts = [];
  const fmtDelta = (autre, libelle) => {
    if (base === null && autre === null) return null;
    if (autre === null) return `${libelle} → liberté au-delà de l'horizon`;
    if (base === null) return `${libelle} → liberté en ${autre} 🎉`;
    const d = autre - base;
    if (d === 0) return `${libelle} → même année (${autre})`;
    return `${libelle} → ${d < 0 ? `${-d} an${-d > 1 ? 's' : ''} plus tôt` : `${d} an${d > 1 ? 's' : ''} plus tard`} (${autre})`;
  };
  const iDepMoins = fmtDelta(yearOf(swrPct, Math.max(0, depMens - 100)), '−100 €/mois de dépenses');
  const iDepPlus = fmtDelta(yearOf(swrPct, depMens + 100), '+100 €/mois de dépenses');
  const autreSwr = swrPct === 4 ? 3.5 : 4;
  const iSwr = fmtDelta(yearOf(autreSwr, depMens), `SWR à ${String(autreSwr).replace('.', ',')} %`);
  [iDepMoins, iDepPlus, iSwr].filter(Boolean).forEach(t => impacts.push(t));
  const impEl = document.getElementById('lf-impacts');
  if (impEl) impEl.innerHTML = impacts.map(t => `<div class="rounded-lg bg-dark-800/50 border border-dark-400/20 px-3 py-2 text-[11px] text-gray-400">${t}</div>`).join('');

  // ── Leviers ──
  document.querySelectorAll('.lf-swr').forEach(btn => {
    btn.addEventListener('click', () => {
      expSwr = Number(btn.dataset.swr);
      navigate('liberte');
    });
  });
  const depInput = document.getElementById('lf-dep');
  if (depInput) {
    depInput.addEventListener('change', () => {
      const v = Number(depInput.value);
      if (v > 0) { expDep = v; navigate('liberte'); }
    });
  }
  document.getElementById('lf-dep-reel')?.addEventListener('click', () => {
    expDep = depReel;
    navigate('liberte');
  });
  document.getElementById('lf-save')?.addEventListener('click', () => {
    const p = store.get('parametres') || {};
    p.swr = swrPct;
    p.fireDepensesMensuelles = depMens;
    store.set('parametres', p);
    expSwr = null; expDep = null;
    showToast('Hypothèses enregistrées — la Projection utilise désormais les mêmes ✓', 'success', 3500);
    navigate('liberte');
  });
}
