function fmt(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function computeLiveSoldes(store) {
  const comptes = store.get('actifs')?.comptesCourants || [];
  const bankNames = store.getBankNames();
  const baseCIC = Number(comptes.find(c => c.id === 'cc-cic')?.solde) || 0;
  const baseTR = Number(comptes.find(c => c.id === 'cc-trade')?.solde) || 0;

  const soldePrecedent = store.get('soldeMoisPrecedent') || {};
  const prevCIC = Number(soldePrecedent.cic) || 0;
  const prevTR = Number(soldePrecedent.tr) || 0;

  const items = store.get('suiviDepenses') || [];
  const revenus = store.get('suiviRevenus') || [];

  const revCIC = revenus.filter(r => r.compte === bankNames.primary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depCIC = items.filter(i => i.compte === bankNames.primary).reduce((s, i) => s + (Number(i.montant) || 0), 0);

  const monthKey = getCurrentMonthKey();
  const depMensuelles = store.get('depensesMensuellesCIC') || [];
  const cicCochees = store.get('cicMensuellesCochees') || {};
  const cocheesThisMonth = cicCochees[monthKey] || [];
  const totalCochees = depMensuelles.filter(d => cocheesThisMonth.includes(d.id)).reduce((s, d) => s + d.montant, 0);

  const revTR = revenus.filter(r => r.compte === bankNames.secondary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const depTR = items.filter(i => i.compte === bankNames.secondary).reduce((s, i) => s + (Number(i.montant) || 0), 0);

  const trFeatures = store.get('trFeatures') || {};
  const trInterets = Number(trFeatures.interets) || 0;
  const trRoundup = Number(trFeatures.roundup) || 0;

  return {
    cic: baseCIC + prevCIC + revCIC - depCIC - totalCochees,
    tr: baseTR + prevTR + revTR + trInterets - depTR - trRoundup
  };
}

export function render(store) {
  const bankNames = store.getBankNames();
  const comptes = store.get('actifs.comptesCourants') || [];
  const epargne = store.get('actifs.epargne') || [];
  const placements = store.get('actifs.placements') || [];
  const immobilier = store.get('actifs.immobilier') || [];
  const emprunts = store.get('passifs.emprunts') || [];

  const liveSoldes = computeLiveSoldes(store);
  const comptesLive = comptes.map(c => ({
    nom: c.nom,
    id: c.id,
    solde: c.id === 'cc-cic' ? liveSoldes.cic : c.id === 'cc-trade' ? liveSoldes.tr : (Number(c.solde) || 0)
  }));

  // Split comptes by bank
  const cicComptes = comptesLive.filter(c => c.id === 'cc-cic');
  const trComptes = comptesLive.filter(c => c.id === 'cc-trade');
  const otherComptes = comptesLive.filter(c => c.id !== 'cc-cic' && c.id !== 'cc-trade');
  const totalCIC = cicComptes.reduce((s, c) => s + c.solde, 0);
  const totalTR = trComptes.reduce((s, c) => s + c.solde, 0);
  const totalOther = otherComptes.reduce((s, c) => s + c.solde, 0);

  const totalCC = comptesLive.reduce((s, c) => s + c.solde, 0);
  const totalEpargne = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
  const totalPlac = placements.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalImmo = immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const totalDette = emprunts.reduce((s, e) => s + (Number(e.capitalRestant) || 0), 0);
  const totalLiquidites = totalCC + totalEpargne;
  const totalActifs = totalLiquidites + totalPlac + totalImmo;
  const patrimoineNet = totalActifs - totalDette;

  // Group placements by envelope
  const peaPlac = placements.filter(p => (p.enveloppe || '').startsWith('PEA'));
  const ctoPlac = placements.filter(p => (p.enveloppe || '') === 'CTO');
  const cryptoPlac = placements.filter(p => (p.categorie || '') === 'Crypto');
  const categorizedEnv = new Set([...peaPlac, ...ctoPlac, ...cryptoPlac]);
  const otherPlac = placements.filter(p => !categorizedEnv.has(p));

  // Sub-groups under PEA
  const peaActions = peaPlac.filter(p => (p.categorie || '').includes('Action'));
  const peaETF = peaPlac.filter(p => (p.categorie || '').includes('ETF'));
  const peaOther = peaPlac.filter(p => !peaActions.includes(p) && !peaETF.includes(p));

  const totalPEA = peaPlac.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalCTO = ctoPlac.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalCrypto = cryptoPlac.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalOtherPlac = otherPlac.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalPeaActions = peaActions.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalPeaETF = peaETF.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalPeaOther = peaOther.reduce((s, p) => s + (Number(p.valeur) || 0), 0);

  // Level 2 envelopes (only show if total > 0)
  const l2Envelopes = [
    { id: 'pea', label: 'PEA', total: totalPEA },
    { id: 'cto', label: 'CTO', total: totalCTO },
    { id: 'crypto', label: 'Crypto', total: totalCrypto },
    { id: 'otherplac', label: 'Autres', total: totalOtherPlac },
  ].filter(e => e.total > 0);

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
        <span class="text-[10px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(Number(p.valeur) || 0)}</span>
      </div>`).join('');
  }

  return `
    <div class="space-y-0">
      <h1 class="text-2xl font-bold text-gray-100 mb-4">Portefeuille actuel</h1>

      <!-- LEVEL 1 — Patrimoine net -->
      <div class="flex justify-center">
        <div class="card-dark rounded-2xl px-6 py-3 text-center inline-block">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Patrimoine net</p>
          <p class="text-3xl font-extrabold text-accent-amber tracking-tight">${fmt(patrimoineNet)}</p>
          ${totalDette > 0 ? `
          <div class="flex items-center justify-center gap-4 mt-1">
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
      <div id="ptf-L2" class="grid grid-cols-1 lg:grid-cols-[5fr_5fr_2fr] gap-3">

        <!-- Liquidités -->
        <div id="ptf-card-liq" class="card-dark rounded-2xl p-3">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            <p class="text-sm text-gray-500 uppercase tracking-wider font-bold">Liquidités</p>
          </div>
          <p class="text-xl font-bold text-indigo-400 mb-1 text-center">${fmt(totalLiquidites)}</p>
        </div>

        <!-- Investissements -->
        <div id="ptf-card-inv" class="card-dark rounded-2xl p-3">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-6 h-6 rounded-lg bg-accent-amber/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-3 h-3 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-sm text-gray-500 uppercase tracking-wider font-bold">Investissements</p>
          </div>
          <p class="text-xl font-bold text-accent-amber mb-1 text-center">${fmt(totalPlac)}</p>
        </div>

        <!-- Immobilier (compact, includes details) -->
        <div id="ptf-card-immo" class="card-dark rounded-2xl p-3">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-5 h-5 rounded-lg bg-amber-700/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-2.5 h-2.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <p class="text-xs text-gray-500 uppercase tracking-wider font-bold">Immobilier</p>
          </div>
          <p class="text-lg font-bold text-amber-500 mb-1 text-center">${fmt(totalImmo)}</p>
          <div class="space-y-1 mt-1 border-t border-dark-400/20 pt-1">
            ${immobilier.length > 0 ? immobilier.map(i => `
            <div class="flex items-center justify-center gap-1.5">
                <div class="w-1 h-1 rounded-full bg-amber-500/50 flex-shrink-0"></div>
                <span class="text-[9px] text-gray-400">${i.nom}</span>
            </div>`).join('') : '<p class="text-[9px] text-gray-600">Aucun bien</p>'}
          </div>
        </div>
      </div>

      <!-- SVG Level 2 → 3 -->
      <div class="grid grid-cols-1 lg:grid-cols-[5fr_5fr_2fr] gap-3">

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
            <div class="grid grid-cols-2 gap-1.5">
              <div id="ptf-card-cic" class="card-dark rounded-xl p-2.5">
                <p class="text-[8px] text-gray-500 uppercase tracking-wider mb-0.5 font-semibold">${bankNames.primary}</p>
                <p class="text-sm font-bold text-indigo-400 text-center">${fmt(totalCIC)}</p>
              </div>
              <div id="ptf-card-tr" class="card-dark rounded-xl p-2.5">
                <p class="text-[8px] text-gray-500 uppercase tracking-wider mb-0.5 font-semibold">${bankNames.secondary}</p>
                <p class="text-sm font-bold text-indigo-400 text-center">${fmt(totalTR)}</p>
              </div>
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
          <!-- Ligne 2 investissements: enveloppes (PEA, CTO, Crypto) -->
          <div id="ptf-L3C" class="grid grid-cols-${l2Envelopes.length || 1} gap-2">
            ${l2Envelopes.map(env => `
            <details id="ptf-card-${env.id}" class="card-dark rounded-xl p-3 group/env" ${env.id === 'pea' ? 'open' : ''}>
              <summary class="cursor-pointer select-none" style="list-style:none">
                <div class="flex items-center justify-between mb-1">
                  <p class="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">${env.label}</p>
                  <svg class="w-3 h-3 text-gray-600 transition-transform group-open/env:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                </div>
                <p class="text-base font-bold text-accent-amber text-center">${fmt(env.total)}</p>
              </summary>
              ${env.id !== 'pea' ? `<div class="space-y-1 mt-1">${placList(
                env.id === 'cto' ? ctoPlac : env.id === 'crypto' ? cryptoPlac : otherPlac, 'bg-accent-amber/50'
              )}</div>` : ''}
            </details>`).join('')}
          </div>
          ${totalPEA > 0 && l3PEA.length > 0 ? `
          <!-- SVG PEA → Actions + ETF -->
          <div class="grid grid-cols-${l2Envelopes.length || 1} gap-2">
            <div id="ptf-svg-L3C-pea" class="hidden lg:block" style="height:30px;">
              <svg id="ptf-svg-L3C-pea-svg" class="w-full" style="height:30px;" fill="none">
                <defs><filter id="glow-amber3" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter></defs>
              </svg>
            </div>
          </div>
          <!-- Ligne 3 sous PEA: Actions + ETF -->
          <div class="grid grid-cols-${l2Envelopes.length || 1} gap-2">
            <div class="grid grid-cols-${l3PEA.length} gap-1.5">
              ${l3PEA.map(sub => `
              <details id="ptf-card-${sub.id}" class="card-dark rounded-xl p-2.5 group/sub">
                <summary class="cursor-pointer select-none" style="list-style:none">
                  <div class="flex items-center justify-between mb-0.5">
                    <p class="text-[8px] text-gray-500 uppercase tracking-wider font-semibold">${sub.label}</p>
                    <svg class="w-3 h-3 text-gray-600 transition-transform group-open/sub:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </div>
                  <p class="text-sm font-bold text-accent-amber text-center">${fmt(sub.total)}</p>
                </summary>
                <div class="space-y-1 mt-1">${placList(sub.items, 'bg-accent-amber/50')}</div>
              </details>`).join('')}
            </div>
          </div>` : ''}
        </div>

        <!-- Right: empty spacer for Immobilier (no sub-level) -->
        <div></div>

      </div>
    </div>
  `;
}

function drawConnectors(svgId, wrapId, cardIds, colors, filterIds) {
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

  const mid = w / 2;
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
      ['#6366f1', '#c9a76c', '#8b6914'],
      ['glow-indigo', 'glow-amber', 'glow-brown']
    );

    // Level 2 → 3 Left: Liquidités → Comptes Courants + Épargne
    drawConnectors('ptf-svg-L2L-svg', 'ptf-svg-L2L',
      ['ptf-card-cc', 'ptf-card-ep'],
      ['#6366f1', '#6366f1'],
      ['glow-indigo2', 'glow-indigo2']
    );

    // Level 3 → 4 Left-Left: Comptes Courants → CIC + Trade Republic
    drawConnectors('ptf-svg-L3LL-svg', 'ptf-svg-L3LL',
      ['ptf-card-cic', 'ptf-card-tr'],
      ['#6366f1', '#6366f1'],
      ['glow-indigo3a', 'glow-indigo3a']
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
        envCards.map(() => '#c9a76c'),
        envCards.map(() => 'glow-amber2')
      );
    }

    // Level 3 → 4 Center: PEA → Actions + ETF (dynamic)
    const peaSubCards = [...document.querySelectorAll('[id^="ptf-card-pea-"]')].map(el => el.id);
    if (peaSubCards.length > 0) {
      drawConnectors('ptf-svg-L3C-pea-svg', 'ptf-svg-L3C-pea',
        peaSubCards,
        peaSubCards.map(() => '#c9a76c'),
        peaSubCards.map(() => 'glow-amber3')
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
