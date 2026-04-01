function fmt(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
}

function computeLiveSoldes(store) {
  return store.computeLiveSoldes();
}

export function render(store) {
  const bankNames = store.getBankNames();
  const comptes = store.get('actifs.comptesCourants') || [];
  const epargne = store.get('actifs.epargne') || [];
  const placements = store.get('actifs.placements') || [];
  const immobilier = store.get('actifs.immobilier') || [];
  const emprunts = store.get('passifs.emprunts') || [];

  const liveSoldes = computeLiveSoldes(store);
  const extraBanks = bankNames.extra || [];
  const comptesLive = comptes.map(c => {
    if (c.id === 'cc-cic') return { ...c, solde: liveSoldes.cic };
    if (c.id === 'cc-trade') return { ...c, solde: liveSoldes.tr };
    const extraId = c.id.replace('cc-', '');
    if (liveSoldes[extraId] !== undefined) return { ...c, solde: liveSoldes[extraId] };
    return { ...c, solde: Number(c.solde) || 0 };
  });

  // Build bank cards list: CIC, TR, then extra banks
  const bankCards = [
    { id: 'cc-cic', label: bankNames.primary, solde: comptesLive.find(c => c.id === 'cc-cic')?.solde || 0 },
    { id: 'cc-trade', label: bankNames.secondary, solde: comptesLive.find(c => c.id === 'cc-trade')?.solde || 0 },
    ...extraBanks.map(b => ({
      id: 'cc-' + b.id, label: b.name, solde: comptesLive.find(c => c.id === 'cc-' + b.id)?.solde || 0
    }))
  ];

  const totalCC = comptesLive.reduce((s, c) => s + c.solde, 0);
  const totalEpargne = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
  const totalPlac = placements.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalImmo = immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const totalDette = emprunts.reduce((s, e) => s + (Number(e.capitalRestant) || 0), 0);
  const totalLiquidites = totalCC + totalEpargne;
  const totalActifs = totalLiquidites + totalPlac + totalImmo;
  const patrimoineNet = totalActifs - totalDette;

  // Group placements by envelope
  const peaPlac = placements.filter(p => (p.enveloppe || '').startsWith('PEA'));
  const ctoPlac = placements.filter(p => (p.enveloppe || '').startsWith('CTO'));
  const cryptoPlac = placements.filter(p => (p.categorie || '') === 'Crypto' || (p.enveloppe || '') === 'Crypto');
  const avPlac = placements.filter(p => (p.enveloppe || '') === 'AV');
  const peePlac = placements.filter(p => (p.enveloppe || '') === 'PEE');
  const categorizedEnv = new Set([...peaPlac, ...ctoPlac, ...cryptoPlac, ...avPlac, ...peePlac]);
  const otherPlac = placements.filter(p => !categorizedEnv.has(p));

  // Sub-groups under PEA
  const peaActions = peaPlac.filter(p => (p.categorie || '').includes('Action'));
  const peaETF = peaPlac.filter(p => (p.categorie || '').includes('ETF'));
  const peaOther = peaPlac.filter(p => !peaActions.includes(p) && !peaETF.includes(p));

  const totalPEA = peaPlac.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalCTO = ctoPlac.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalCrypto = cryptoPlac.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalAV = avPlac.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalPEE = peePlac.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalOtherPlac = otherPlac.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalPeaActions = peaActions.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalPeaETF = peaETF.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);
  const totalPeaOther = peaOther.reduce((s, p) => s + (Number(p.valeur) || Number(p.apport) || 0), 0);

  // Level 2 envelopes (PEA, CTO, Crypto, AV, PEE always visible; Autres only if > 0)
  const l2Envelopes = [
    { id: 'pea', label: 'PEA', total: totalPEA },
    { id: 'cto', label: 'CTO', total: totalCTO },
    { id: 'crypto', label: 'Crypto', total: totalCrypto },
    { id: 'av', label: 'Ass. Vie', total: totalAV },
    { id: 'pee', label: 'PEE', total: totalPEE },
    { id: 'otherplac', label: 'Autres', total: totalOtherPlac },
  ].filter(e => ['pea', 'cto', 'crypto', 'av', 'pee'].includes(e.id) || e.total > 0);

  // Level 3 under PEA (only show if total > 0)
  const l3PEA = [
    { id: 'pea-actions', label: 'Actions', items: peaActions, total: totalPeaActions },
    { id: 'pea-etf', label: 'ETF', items: peaETF, total: totalPeaETF },
    { id: 'pea-other', label: 'Autres PEA', items: peaOther, total: totalPeaOther },
  ].filter(e => e.total > 0);

  function placList(items, color) {
    if (items.length === 0) return '<p class="text-[10px] text-gray-600">Aucun</p>';
    return items.map(p => `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 min-w-0">
          <div class="w-1 h-1 rounded-full ${color} flex-shrink-0"></div>
          <span class="text-[10px] text-gray-400 truncate">${p.nom}</span>
        </div>
        <span class="text-[10px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(Number(p.valeur) || Number(p.apport) || 0)}</span>
      </div>`).join('');
  }

  return `
    <div class="space-y-0">
      <div class="mb-4">
        <h2 class="text-xl sm:text-2xl font-bold text-gray-100 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
            </svg>
          </div>
          Portefeuille
        </h2>
        <p class="text-gray-500 text-sm mt-1">Vue détaillée de tous tes actifs et placements</p>
      </div>

      <!-- LEVEL 1 — Patrimoine net -->
      <div class="flex justify-center">
        <div class="card-dark rounded-2xl px-4 sm:px-6 py-3 text-center inline-block">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Patrimoine net</p>
          <p class="text-2xl sm:text-3xl font-extrabold text-accent-amber tracking-tight">${fmt(patrimoineNet)}</p>
          ${totalDette > 0 ? `
          <div class="flex items-center justify-center gap-3 sm:gap-4 mt-1">
            <span class="text-[10px] text-gray-500">Actifs <span class="text-gray-300 font-medium">${fmt(totalActifs)}</span></span>
            <span class="text-[10px] text-gray-500">Dettes <span class="text-red-400 font-medium">−${fmt(totalDette)}</span></span>
          </div>` : ''}
        </div>
      </div>

      <!-- SVG Level 1 → 2 -->
      <div id="ptf-svg-L1" class="hidden lg:block" style="height:40px;">
        <svg id="ptf-svg-L1-svg" class="w-full" style="height:40px;" fill="none">
          <defs>
            <filter id="glow-indigo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
            <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
            <filter id="glow-brown" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
          </defs>
        </svg>
      </div>

      <!-- LEVEL 2 — Liquidités + Investissements + Immobilier -->
      <div id="ptf-L2" class="grid grid-cols-3 lg:grid-cols-[4fr_6fr_2fr] gap-2 sm:gap-3">

        <!-- Liquidités -->
        <div id="ptf-card-liq" class="card-dark rounded-xl sm:rounded-2xl p-2 sm:p-3">
          <div class="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
            <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            <p class="text-[10px] sm:text-sm text-gray-500 uppercase tracking-wider font-bold">Liquidités</p>
          </div>
          <p class="text-base sm:text-xl font-bold text-indigo-400 mb-1 text-center">${fmt(totalLiquidites)}</p>
        </div>

        <!-- Investissements -->
        <div id="ptf-card-inv" class="card-dark rounded-xl sm:rounded-2xl p-2 sm:p-3">
          <div class="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
            <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-accent-amber/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-[10px] sm:text-sm text-gray-500 uppercase tracking-wider font-bold">Invest.</p>
          </div>
          <p class="text-base sm:text-xl font-bold text-accent-amber mb-1 text-center">${fmt(totalPlac)}</p>
        </div>

        <!-- Immobilier (compact, includes details) -->
        <div id="ptf-card-immo" class="card-dark rounded-xl sm:rounded-2xl p-2 sm:p-3">
          <div class="flex items-center gap-1 sm:gap-2 mb-1">
            <div class="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-rose-700/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-2 h-2 sm:w-2.5 sm:h-2.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <p class="text-[9px] sm:text-xs text-gray-500 uppercase tracking-wider font-bold">Immo.</p>
          </div>
          <p class="text-sm sm:text-lg font-bold text-rose-400 mb-1 text-center">${fmt(totalImmo)}</p>
          <div class="hidden sm:block space-y-1 mt-1 border-t border-dark-400/20 pt-1">
            ${immobilier.length > 0 ? immobilier.map(i => `
            <div class="flex items-center justify-center gap-1.5">
                <div class="w-1 h-1 rounded-full bg-rose-400/50 flex-shrink-0"></div>
                <span class="text-[9px] text-gray-400">${i.nom}</span>
            </div>`).join('') : '<p class="text-[9px] text-gray-600">Aucun bien</p>'}
          </div>
        </div>
      </div>

      <!-- SVG Level 2 → 3 -->
      <div class="hidden lg:grid lg:grid-cols-[4fr_6fr_2fr] gap-3">

        <!-- Left branch: Liquidités → Comptes Courants + Épargne → détails -->
        <div>
          <!-- SVG Liquidités → CC + Épargne -->
          <div id="ptf-svg-L2L" class="hidden lg:block" style="height:35px;">
            <svg id="ptf-svg-L2L-svg" class="w-full" style="height:35px;" fill="none">
              <defs>
                <filter id="glow-indigo2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
              </defs>
            </svg>
          </div>
          <!-- Ligne 2 : Comptes Courants + Épargne -->
          <div id="ptf-L3L" class="grid grid-cols-2 gap-2">
            <div id="ptf-card-cc" class="card-dark rounded-xl p-3">
              <div class="flex items-center gap-1.5 mb-1">
                <svg class="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Comptes courants</p>
              </div>
              <p class="text-base font-bold text-indigo-400 text-center">${fmt(totalCC)}</p>
            </div>
            <div id="ptf-card-ep" class="card-dark rounded-xl p-3">
              <div class="flex items-center gap-1.5 mb-1">
                <svg class="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                <p class="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Épargne</p>
              </div>
              <p class="text-base font-bold text-indigo-400 text-center">${fmt(totalEpargne)}</p>
            </div>
          </div>
          <!-- SVG CC → CIC + TR  |  Épargne → comptes épargne -->
          <div class="grid grid-cols-2 gap-2">
            <div id="ptf-svg-L3LL" class="hidden lg:block" style="height:30px;">
              <svg id="ptf-svg-L3LL-svg" class="w-full" style="height:30px;" fill="none">
                <defs><filter id="glow-indigo3a" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter></defs>
              </svg>
            </div>
            <div id="ptf-svg-L3LR" class="hidden lg:block" style="height:30px;">
              <svg id="ptf-svg-L3LR-svg" class="w-full" style="height:30px;" fill="none">
                <defs><filter id="glow-indigo3b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter></defs>
              </svg>
            </div>
          </div>
          <!-- Ligne 3 : CIC + TR | comptes épargne -->
          <div class="grid grid-cols-2 gap-2">
            <!-- Sous Comptes Courants -->
            <div class="grid grid-cols-${Math.min(bankCards.length, 2)} sm:grid-cols-${bankCards.length > 3 ? '3' : bankCards.length} gap-1">
              ${bankCards.map((b, i) => `
              <div id="ptf-card-bank-${i}" class="card-dark rounded-xl p-1.5 overflow-hidden">
                <p class="text-[9px] sm:text-[8px] text-gray-500 uppercase tracking-wider mb-0.5 font-semibold truncate">${b.label}</p>
                <p class="text-xs font-bold text-indigo-400 text-center whitespace-nowrap">${fmt(b.solde)}</p>
              </div>`).join('')}
            </div>
            <!-- Sous Épargne -->
            <div class="grid grid-cols-${epargne.length > 2 ? '3' : epargne.length || 1} gap-1.5">
              ${epargne.length > 0 ? epargne.map((e, idx) => `
              <div id="ptf-card-ep-${idx}" class="card-dark rounded-xl p-2.5">
                <p class="text-[8px] text-gray-500 uppercase tracking-wider mb-0.5 font-semibold truncate">${e.nom}</p>
                <p class="text-sm font-bold text-indigo-400 text-center">${fmt(Number(e.solde) || 0)}</p>
              </div>`).join('') : '<div class="card-dark rounded-xl p-2.5"><p class="text-[9px] text-gray-600">Aucun</p></div>'}
            </div>
          </div>
        </div>

        <!-- Center branch: Investissements → PEA + CTO + Crypto → sous-niveaux -->
        <div>
          <!-- SVG Investissements → enveloppes -->
          <div id="ptf-svg-L2C" class="hidden lg:block" style="height:35px;">
            <svg id="ptf-svg-L2C-svg" class="w-full" style="height:35px;" fill="none">
              <defs>
                <filter id="glow-amber2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
              </defs>
            </svg>
          </div>
          <!-- Ligne 2 investissements: enveloppes -->
          <div id="ptf-L3C" class="grid grid-cols-${Math.min(l2Envelopes.length, 2) || 1} sm:grid-cols-${Math.min(l2Envelopes.length, 3) || 1} lg:grid-cols-${l2Envelopes.length || 1} gap-1">
            ${l2Envelopes.map(env => {
              const envPlacMap = { cto: ctoPlac, crypto: cryptoPlac, av: avPlac, pee: peePlac, otherplac: otherPlac };
              return `
            <details id="ptf-card-${env.id}" class="card-dark rounded-xl p-2 group/env" ${env.id === 'pea' ? 'open' : ''}>
              <summary class="cursor-pointer select-none" style="list-style:none">
                <div class="flex items-center justify-between mb-0.5">
                  <p class="text-[8px] text-gray-500 uppercase tracking-wider font-semibold whitespace-nowrap">${env.label}</p>
                  <svg class="w-2.5 h-2.5 text-gray-600 transition-transform group-open/env:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
                <p class="text-sm font-bold text-accent-amber text-center whitespace-nowrap">${fmt(env.total)}</p>
              </summary>
              ${env.id !== 'pea' && envPlacMap[env.id] ? `<div class="space-y-1 mt-1">${placList(envPlacMap[env.id], 'bg-accent-amber/50')}</div>` : ''}
            </details>`;
            }).join('')}
          </div>
          ${totalPEA > 0 && l3PEA.length > 0 ? `
          <!-- SVG PEA → Actions + ETF -->
          <div id="ptf-svg-L3C-pea" class="hidden lg:block" style="height:30px;">
            <svg id="ptf-svg-L3C-pea-svg" class="w-full" style="height:30px;" fill="none">
              <defs><filter id="glow-amber3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter></defs>
            </svg>
          </div>
          <!-- Ligne 3 sous PEA: Actions + ETF (full width) -->
          <div class="grid grid-cols-${l3PEA.length} gap-1">
            ${l3PEA.map(sub => `
            <details id="ptf-card-${sub.id}" class="card-dark rounded-xl p-2 group/sub">
              <summary class="cursor-pointer select-none" style="list-style:none">
                <div class="flex items-center justify-between mb-0.5">
                  <p class="text-[8px] text-gray-500 uppercase tracking-wider font-semibold">${sub.label}</p>
                  <svg class="w-2.5 h-2.5 text-gray-600 transition-transform group-open/sub:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
                <p class="text-sm font-bold text-accent-amber text-center">${fmt(sub.total)}</p>
              </summary>
              <div class="space-y-1 mt-1">${placList(sub.items, 'bg-accent-amber/50')}</div>
            </details>`).join('')}
          </div>` : ''}
        </div>

        <!-- Right: empty spacer for Immobilier (no sub-level) -->
        <div></div>

      </div>

      <!-- MOBILE DETAIL VIEW — replaces the tree structure on small screens -->
      <div class="lg:hidden space-y-2 mt-3">

        <!-- Liquidités detail -->
        <details class="card-dark rounded-xl overflow-hidden group/mob">
          <summary class="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none" style="list-style:none">
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                <svg class="w-2.5 h-2.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
              </div>
              <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Liquidités</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-indigo-400">${fmt(totalLiquidites)}</span>
              <svg class="w-3 h-3 text-gray-600 transition-transform group-open/mob:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </summary>
          <div class="px-3 pb-3 space-y-2">
            <div class="flex items-center justify-between text-xs text-gray-500 border-b border-dark-400/20 pb-1.5">
              <span>Comptes courants</span>
              <span class="text-indigo-400 font-medium">${fmt(totalCC)}</span>
            </div>
            ${bankCards.map(b => `
            <div class="flex items-center justify-between pl-3">
              <span class="text-[10px] text-gray-500">${b.label}</span>
              <span class="text-[10px] text-gray-300 font-medium">${fmt(b.solde)}</span>
            </div>`).join('')}
            <div class="flex items-center justify-between text-xs text-gray-500 border-t border-dark-400/20 pt-1.5">
              <span>Épargne</span>
              <span class="text-indigo-400 font-medium">${fmt(totalEpargne)}</span>
            </div>
            ${epargne.map(e => `
            <div class="flex items-center justify-between pl-3">
              <span class="text-[10px] text-gray-500">${e.nom}</span>
              <span class="text-[10px] text-gray-300 font-medium">${fmt(Number(e.solde) || 0)}</span>
            </div>`).join('')}
          </div>
        </details>

        <!-- Investissements detail -->
        <details class="card-dark rounded-xl overflow-hidden group/inv">
          <summary class="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none" style="list-style:none">
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded-lg bg-accent-amber/15 flex items-center justify-center">
                <svg class="w-2.5 h-2.5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
              </div>
              <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Investissements</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-accent-amber">${fmt(totalPlac)}</span>
              <svg class="w-3 h-3 text-gray-600 transition-transform group-open/inv:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </summary>
          <div class="px-3 pb-3 space-y-1.5">
            ${l2Envelopes.map(env => {
              const envPlacMap = { pea: peaPlac, cto: ctoPlac, crypto: cryptoPlac, av: avPlac, pee: peePlac, otherplac: otherPlac };
              const items = env.id === 'pea' ? [...peaActions, ...peaETF, ...peaOther] : (envPlacMap[env.id] || []);
              return `
            <div class="border-b border-dark-400/15 pb-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500 font-medium">${env.label}</span>
                <span class="text-accent-amber font-bold">${fmt(env.total)}</span>
              </div>
              ${items.length > 0 ? items.map(p => `
              <div class="flex items-center justify-between pl-3 mt-0.5">
                <span class="text-[10px] text-gray-500 truncate mr-2">${p.nom}</span>
                <span class="text-[10px] text-gray-300 font-medium flex-shrink-0">${fmt(Number(p.valeur) || Number(p.apport) || 0)}</span>
              </div>`).join('') : ''}
            </div>`;
            }).join('')}
          </div>
        </details>

        <!-- Immobilier detail (only if items) -->
        ${immobilier.length > 0 ? `
        <details class="card-dark rounded-xl overflow-hidden group/imm">
          <summary class="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none" style="list-style:none">
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded-lg bg-rose-700/15 flex items-center justify-center">
                <svg class="w-2.5 h-2.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              </div>
              <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Immobilier</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-rose-400">${fmt(totalImmo)}</span>
              <svg class="w-3 h-3 text-gray-600 transition-transform group-open/imm:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </summary>
          <div class="px-3 pb-3 space-y-1">
            ${immobilier.map(i => `
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-gray-500">${i.nom}</span>
              <span class="text-[10px] text-gray-300 font-medium">${fmt(Number(i.valeurActuelle) || 0)}</span>
            </div>`).join('')}
          </div>
        </details>` : ''}

        ${totalDette > 0 ? `
        <!-- Dettes -->
        <div class="card-dark rounded-xl px-3 py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded-lg bg-red-500/15 flex items-center justify-center">
              <svg class="w-2.5 h-2.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"/></svg>
            </div>
            <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Dettes</span>
          </div>
          <span class="text-sm font-bold text-red-400">−${fmt(totalDette)}</span>
        </div>` : ''}
      </div>

    </div>
  `;
}

function drawConnectors(svgId, wrapId, cardIds, colors, filterIds, sourceId) {
  const svg = document.getElementById(svgId);
  const wrap = document.getElementById(wrapId);
  if (!svg || !wrap) return;

  const cards = cardIds.map(id => document.getElementById(id)).filter(Boolean);
  if (cards.length === 0) return;

  const wrapRect = wrap.getBoundingClientRect();
  const w = wrapRect.width;
  if (w <= 0) return;
  const h = parseInt(svg.style.height) || 40;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  let mid = w / 2;
  if (sourceId) {
    const srcEl = document.getElementById(sourceId);
    if (srcEl) {
      const srcRect = srcEl.getBoundingClientRect();
      mid = srcRect.left + srcRect.width / 2 - wrapRect.left;
    }
  }
  const centers = cards.map(card => {
    const r = card.getBoundingClientRect();
    return r.left + r.width / 2 - wrapRect.left;
  });

  svg.querySelectorAll('path, circle').forEach(el => el.remove());

  centers.forEach((cx, i) => {
    const color = colors[i % colors.length];
    const filter = filterIds[i % filterIds.length];
    const d = `M ${mid} 0 C ${mid} ${h * 0.55}, ${cx} ${h * 0.55}, ${cx} ${h}`;

    // Outer glow
    const glow2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow2.setAttribute('d', d);
    glow2.setAttribute('stroke', color);
    glow2.setAttribute('stroke-width', '6');
    glow2.setAttribute('fill', 'none');
    glow2.setAttribute('opacity', '0.15');
    glow2.setAttribute('filter', `url(#${filter})`);
    svg.appendChild(glow2);

    // Inner glow
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', d);
    glow.setAttribute('stroke', color);
    glow.setAttribute('stroke-width', '3');
    glow.setAttribute('fill', 'none');
    glow.setAttribute('opacity', '0.35');
    glow.setAttribute('filter', `url(#${filter})`);
    svg.appendChild(glow);

    // Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', d);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('fill', 'none');
    line.setAttribute('opacity', '0.6');
    svg.appendChild(line);

    // Bottom dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', h);
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', color);
    dot.setAttribute('opacity', '0.7');
    svg.appendChild(dot);
  });

  // Top dot
  const topDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  topDot.setAttribute('cx', mid);
  topDot.setAttribute('cy', '0');
  topDot.setAttribute('r', '2.5');
  topDot.setAttribute('fill', colors[0]);
  topDot.setAttribute('opacity', '0.7');
  svg.appendChild(topDot);
}

// Straight vertical connector (single child)
function drawStraightConnector(svgId, wrapId, cardId, color, filterId) {
  const svg = document.getElementById(svgId);
  const wrap = document.getElementById(wrapId);
  const card = document.getElementById(cardId);
  if (!svg || !wrap || !card) return;

  const wrapRect = wrap.getBoundingClientRect();
  const w = wrapRect.width;
  if (w <= 0) return;
  const h = parseInt(svg.style.height) || 35;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const mid = w / 2;
  const cardRect = card.getBoundingClientRect();
  const cx = cardRect.left + cardRect.width / 2 - wrapRect.left;

  svg.querySelectorAll('path, circle, line').forEach(el => el.remove());

  const d = `M ${mid} 0 C ${mid} ${h * 0.55}, ${cx} ${h * 0.55}, ${cx} ${h}`;

  // Outer glow
  const glow2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  glow2.setAttribute('d', d);
  glow2.setAttribute('stroke', color);
  glow2.setAttribute('stroke-width', '6');
  glow2.setAttribute('fill', 'none');
  glow2.setAttribute('opacity', '0.15');
  glow2.setAttribute('filter', `url(#${filterId})`);
  svg.appendChild(glow2);

  // Inner glow
  const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  glow.setAttribute('d', d);
  glow.setAttribute('stroke', color);
  glow.setAttribute('stroke-width', '3');
  glow.setAttribute('fill', 'none');
  glow.setAttribute('opacity', '0.35');
  glow.setAttribute('filter', `url(#${filterId})`);
  svg.appendChild(glow);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', d);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('fill', 'none');
  line.setAttribute('opacity', '0.6');
  svg.appendChild(line);

  // Dots
  const topDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  topDot.setAttribute('cx', mid);
  topDot.setAttribute('cy', '0');
  topDot.setAttribute('r', '2.5');
  topDot.setAttribute('fill', color);
  topDot.setAttribute('opacity', '0.7');
  svg.appendChild(topDot);

  const botDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  botDot.setAttribute('cx', cx);
  botDot.setAttribute('cy', h);
  botDot.setAttribute('r', '2.5');
  botDot.setAttribute('fill', color);
  botDot.setAttribute('opacity', '0.7');
  svg.appendChild(botDot);
}

export function mount() {
  function drawAll() {
    // Level 1 → 2: Patrimoine → Liquidités + Investissements + Immobilier
    drawConnectors('ptf-svg-L1-svg', 'ptf-svg-L1',
      ['ptf-card-liq', 'ptf-card-inv', 'ptf-card-immo'],
      ['#6366f1', '#c084fc', '#f43f5e'],
      ['glow-indigo', 'glow-amber', 'glow-brown']
    );

    // Level 2 → 3 Left: Liquidités → Comptes Courants + Épargne
    drawConnectors('ptf-svg-L2L-svg', 'ptf-svg-L2L',
      ['ptf-card-cc', 'ptf-card-ep'],
      ['#6366f1', '#6366f1'],
      ['glow-indigo2', 'glow-indigo2']
    );

    // Level 3 → 4 Left-Left: Comptes Courants → bank cards (dynamic)
    const bankCardIds = [...document.querySelectorAll('[id^="ptf-card-bank-"]')].map(el => el.id);
    drawConnectors('ptf-svg-L3LL-svg', 'ptf-svg-L3LL',
      bankCardIds,
      bankCardIds.map(() => '#6366f1'),
      bankCardIds.map(() => 'glow-indigo3a')
    );

    // Level 3 → 4 Left-Right: Épargne → individual savings accounts
    const epCards = [...document.querySelectorAll('[id^="ptf-card-ep-"]')].map(el => el.id);
    if (epCards.length > 0) {
      drawConnectors('ptf-svg-L3LR-svg', 'ptf-svg-L3LR',
        epCards,
        epCards.map(() => '#6366f1'),
        epCards.map(() => 'glow-indigo3b')
      );
    }

    // Level 2 → 3 Center: Investissements → enveloppes (dynamic)
    const envCards = [...document.querySelectorAll('#ptf-L3C > [id^="ptf-card-"]')].map(el => el.id);
    if (envCards.length > 0) {
      drawConnectors('ptf-svg-L2C-svg', 'ptf-svg-L2C',
        envCards,
        envCards.map(() => '#c084fc'),
        envCards.map(() => 'glow-purple2')
      );
    }

    // Level 3 → 4 Center: PEA → Actions + ETF (dynamic)
    const peaSubCards = [...document.querySelectorAll('[id^="ptf-card-pea-"]')].map(el => el.id);
    if (peaSubCards.length > 0) {
      drawConnectors('ptf-svg-L3C-pea-svg', 'ptf-svg-L3C-pea',
        peaSubCards,
        peaSubCards.map(() => '#c084fc'),
        peaSubCards.map(() => 'glow-purple3'),
        'ptf-card-pea'
      );
    }

    // Immobilier has no sub-level — details are inline
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      drawAll();
    });
  });
  window.addEventListener('resize', drawAll);
}
