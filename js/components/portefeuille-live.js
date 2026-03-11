function fmt(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function computeLiveSoldes(store) {
  const comptes = store.get('actifs')?.comptesCourants || [];
  const baseCIC = Number(comptes.find(c => c.id === 'cc-cic')?.solde) || 0;
  const baseTR = Number(comptes.find(c => c.id === 'cc-trade')?.solde) || 0;

  const soldePrecedent = store.get('soldeMoisPrecedent') || {};
  const prevCIC = Number(soldePrecedent.cic) || 0;
  const prevTR = Number(soldePrecedent.tr) || 0;

  const items = store.get('suiviDepenses') || [];
  const revenus = store.get('suiviRevenus') || [];

  const revCIC = revenus.filter(r => r.compte === 'CIC').reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depCIC = items.filter(i => i.compte === 'CIC').reduce((s, i) => s + (Number(i.montant) || 0), 0);

  const monthKey = getCurrentMonthKey();
  const depMensuelles = store.get('depensesMensuellesCIC') || [];
  const cicCochees = store.get('cicMensuellesCochees') || {};
  const cocheesThisMonth = cicCochees[monthKey] || [];
  const totalCochees = depMensuelles.filter(d => cocheesThisMonth.includes(d.id)).reduce((s, d) => s + d.montant, 0);

  const revTR = revenus.filter(r => r.compte === 'Trade Republic').reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depTR = items.filter(i => i.compte === 'Trade Republic').reduce((s, i) => s + (Number(i.montant) || 0), 0);

  return {
    cic: baseCIC + prevCIC + revCIC - depCIC - totalCochees,
    tr: baseTR + prevTR + revTR - depTR
  };
}

export function render(store) {
  const comptes = store.get('actifs.comptesCourants') || [];
  const epargne = store.get('actifs.epargne') || [];
  const placements = store.get('actifs.placements') || [];
  const immobilier = store.get('actifs.immobilier') || [];
  const emprunts = store.get('passifs.emprunts') || [];

  // Soldes live des comptes courants (même calcul que Quotidien Live)
  const liveSoldes = computeLiveSoldes(store);
  const comptesLive = comptes.map(c => ({
    nom: c.nom,
    solde: c.id === 'cc-cic' ? liveSoldes.cic : c.id === 'cc-trade' ? liveSoldes.tr : (Number(c.solde) || 0)
  }));
  const totalCC = comptesLive.reduce((s, c) => s + c.solde, 0);
  const totalEpargne = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
  const totalPlac = placements.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalImmo = immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const totalDette = emprunts.reduce((s, e) => s + (Number(e.capitalRestant) || 0), 0);
  const totalLiquidites = totalCC + totalEpargne;
  const totalActifs = totalLiquidites + totalPlac + totalImmo;
  const patrimoineNet = totalActifs - totalDette;

  // Percentages for donut legend
  const pctLiq = totalActifs > 0 ? (totalLiquidites / totalActifs * 100).toFixed(0) : 0;
  const pctInv = totalActifs > 0 ? (totalPlac / totalActifs * 100).toFixed(0) : 0;
  const pctImmo = totalActifs > 0 ? (totalImmo / totalActifs * 100).toFixed(0) : 0;

  return `
    <div class="space-y-0">
      <h1 class="text-2xl font-bold text-gray-100 mb-6">Portefeuille Live</h1>

      <!-- Patrimoine net — centered top node -->
      <div class="flex justify-center">
        <div class="card-dark rounded-2xl px-8 py-5 relative overflow-hidden text-center inline-block" style="box-shadow: 0 0 50px rgba(201,167,108,0.12), 0 0 100px rgba(201,167,108,0.05)">
          <div class="absolute inset-0 bg-gradient-to-br from-accent-amber/5 via-transparent to-purple-500/5 pointer-events-none"></div>
          <div class="relative">
            <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Patrimoine net</p>
            <p class="text-4xl font-extrabold text-accent-amber tracking-tight">${fmt(patrimoineNet)}</p>
            ${totalDette > 0 ? `
            <div class="flex items-center justify-center gap-4 mt-1.5">
              <span class="text-[10px] text-gray-500">Actifs <span class="text-gray-300 font-medium">${fmt(totalActifs)}</span></span>
              <span class="text-[10px] text-gray-500">Dettes <span class="text-red-400 font-medium">−${fmt(totalDette)}</span></span>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- SVG tree connectors -->
      <div class="hidden lg:block">
        <svg class="w-full" viewBox="0 0 600 55" fill="none" preserveAspectRatio="xMidYMid meet" style="height: 55px;">
          <defs>
            <filter id="glow-indigo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
            <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
            <filter id="glow-brown" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
          </defs>
          <!-- Glow layer -->
          <path d="M 300 0 C 300 30, 100 30, 100 55" stroke="#6366f1" stroke-width="3" opacity="0.3" filter="url(#glow-indigo)"/>
          <path d="M 300 0 C 300 30, 300 30, 300 55" stroke="#c9a76c" stroke-width="3" opacity="0.3" filter="url(#glow-amber)"/>
          <path d="M 300 0 C 300 30, 500 30, 500 55" stroke="#8b6914" stroke-width="3" opacity="0.3" filter="url(#glow-brown)"/>
          <!-- Visible lines -->
          <path d="M 300 0 C 300 30, 100 30, 100 55" stroke="#6366f1" stroke-width="1.5" opacity="0.5"/>
          <path d="M 300 0 C 300 30, 300 30, 300 55" stroke="#c9a76c" stroke-width="1.5" opacity="0.5"/>
          <path d="M 300 0 C 300 30, 500 30, 500 55" stroke="#8b6914" stroke-width="1.5" opacity="0.5"/>
          <!-- Junction dots -->
          <circle cx="300" cy="0" r="3" fill="#c9a76c" opacity="0.6"/>
          <circle cx="100" cy="55" r="3" fill="#6366f1" opacity="0.6"/>
          <circle cx="300" cy="55" r="3" fill="#c9a76c" opacity="0.6"/>
          <circle cx="500" cy="55" r="3" fill="#8b6914" opacity="0.6"/>
        </svg>
      </div>

      <!-- 3 KPI cards -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <!-- Liquidités -->
        <div class="card-dark rounded-2xl p-5" style="box-shadow: 0 0 28px rgba(99,102,241,0.10)">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                </svg>
              </div>
              <p class="text-[10px] text-gray-500 uppercase tracking-wider">Liquidités</p>
            </div>
            <span class="text-xs text-indigo-400/50 font-medium">${pctLiq}%</span>
          </div>
          <p class="text-2xl font-bold text-indigo-400 mb-4">${fmt(totalLiquidites)}</p>
          <div class="space-y-2.5">
            <p class="text-[9px] text-gray-600 uppercase tracking-wider">Comptes courants</p>
            ${comptesLive.map(c => `
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-1.5 h-1.5 rounded-full bg-indigo-400/50 flex-shrink-0"></div>
                <span class="text-[11px] text-gray-400 truncate">${c.nom}</span>
              </div>
              <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(c.solde)}</span>
            </div>`).join('')}
            ${epargne.length > 0 ? `
            <p class="text-[9px] text-gray-600 uppercase tracking-wider pt-1">Épargne</p>
            ${epargne.map(e => `
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-1.5 h-1.5 rounded-full bg-indigo-400/50 flex-shrink-0"></div>
                <span class="text-[11px] text-gray-400 truncate">${e.nom}${e.tauxInteret ? ` <span class="text-gray-600">${(Number(e.tauxInteret) * 100).toFixed(1)}%</span>` : ''}</span>
              </div>
              <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(Number(e.solde) || 0)}</span>
            </div>`).join('')}` : ''}
          </div>
        </div>

        <!-- Investissements -->
        <div class="card-dark rounded-2xl p-5" style="box-shadow: 0 0 28px rgba(201,167,108,0.10)">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-accent-amber/15 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </div>
              <p class="text-[10px] text-gray-500 uppercase tracking-wider">Investissements</p>
            </div>
            <span class="text-xs text-accent-amber/50 font-medium">${pctInv}%</span>
          </div>
          <p class="text-2xl font-bold text-accent-amber mb-4">${fmt(totalPlac)}</p>
          <div class="space-y-2.5">
            ${placements.length > 0 ? placements.map(p => `
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-1.5 h-1.5 rounded-full bg-accent-amber/50 flex-shrink-0"></div>
                <span class="text-[11px] text-gray-400 truncate">${p.nom}</span>
              </div>
              <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(Number(p.valeur) || 0)}</span>
            </div>`).join('') : '<p class="text-[11px] text-gray-600">Aucun placement</p>'}
          </div>
        </div>

        <!-- Immobilier -->
        <div class="card-dark rounded-2xl p-5" style="box-shadow: 0 0 28px rgba(139,105,20,0.12)">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-amber-700/15 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
              </div>
              <p class="text-[10px] text-gray-500 uppercase tracking-wider">Immobilier</p>
            </div>
            <span class="text-xs text-amber-500/50 font-medium">${pctImmo}%</span>
          </div>
          <p class="text-2xl font-bold text-amber-500 mb-4">${fmt(totalImmo)}</p>
          <div class="space-y-2.5">
            ${immobilier.length > 0 ? immobilier.map(i => `
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-1.5 h-1.5 rounded-full bg-amber-500/50 flex-shrink-0"></div>
                <span class="text-[11px] text-gray-400 truncate">${i.nom}</span>
              </div>
              <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(Number(i.valeurActuelle) || 0)}</span>
            </div>`).join('') : '<p class="text-[11px] text-gray-600">Aucun bien</p>'}
          </div>
        </div>

      </div>
    </div>
  `;
}

export function mount() {
  // No chart — pure HTML tree layout
}
