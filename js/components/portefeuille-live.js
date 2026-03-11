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

  return `
    <div class="space-y-0">
      <h1 class="text-2xl font-bold text-gray-100 mb-6">Portefeuille Live</h1>

      <!-- LEVEL 1 — Patrimoine net -->
      <div class="flex justify-center">
        <div class="card-dark rounded-2xl px-8 py-5 text-center inline-block">
          <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Patrimoine net</p>
          <p class="text-4xl font-extrabold text-accent-amber tracking-tight">${fmt(patrimoineNet)}</p>
          ${totalDette > 0 ? `
          <div class="flex items-center justify-center gap-4 mt-1.5">
            <span class="text-[10px] text-gray-500">Actifs <span class="text-gray-300 font-medium">${fmt(totalActifs)}</span></span>
            <span class="text-[10px] text-gray-500">Dettes <span class="text-red-400 font-medium">−${fmt(totalDette)}</span></span>
          </div>` : ''}
        </div>
      </div>

      <!-- SVG Level 1 → 2 -->
      <div id="ptf-svg-L1" class="hidden lg:block" style="height:55px;">
        <svg id="ptf-svg-L1-svg" class="w-full" style="height:55px;" fill="none">
          <defs>
            <filter id="glow-indigo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
            <filter id="glow-amber" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
            <filter id="glow-brown" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
          </defs>
        </svg>
      </div>

      <!-- LEVEL 2 — Liquidités + Investissements + Immobilier -->
      <div id="ptf-L2" class="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <!-- Liquidités -->
        <div id="ptf-card-liq" class="card-dark rounded-2xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Liquidités</p>
          </div>
          <p class="text-2xl font-bold text-indigo-400 mb-2 text-center">${fmt(totalLiquidites)}</p>
        </div>

        <!-- Investissements -->
        <div id="ptf-card-inv" class="card-dark rounded-2xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-7 h-7 rounded-lg bg-accent-amber/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Investissements</p>
          </div>
          <p class="text-2xl font-bold text-accent-amber mb-2 text-center">${fmt(totalPlac)}</p>
        </div>

        <!-- Immobilier -->
        <div id="ptf-card-immo" class="card-dark rounded-2xl p-5">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-7 h-7 rounded-lg bg-amber-700/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Immobilier</p>
          </div>
          <p class="text-2xl font-bold text-amber-500 mb-2 text-center">${fmt(totalImmo)}</p>
        </div>
      </div>

      <!-- SVG Level 2 → 3 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <!-- Left branch: Liquidités → CC + Épargne -->
        <div>
          <div id="ptf-svg-L2L" class="hidden lg:block" style="height:45px;">
            <svg id="ptf-svg-L2L-svg" class="w-full" style="height:45px;" fill="none">
              <defs>
                <filter id="glow-indigo2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
              </defs>
            </svg>
          </div>
          <div id="ptf-L3L" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Comptes Courants -->
            <div id="ptf-card-cc" class="card-dark rounded-2xl p-4">
              <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Comptes courants</p>
              <p class="text-lg font-bold text-indigo-400 text-center mb-3">${fmt(totalCC)}</p>
              <div class="space-y-2">
                ${comptesLive.map(c => `
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-1.5 h-1.5 rounded-full bg-indigo-400/50 flex-shrink-0"></div>
                    <span class="text-[11px] text-gray-400 truncate">${c.nom}</span>
                  </div>
                  <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(c.solde)}</span>
                </div>`).join('')}
              </div>
            </div>
            <!-- Épargne -->
            <div id="ptf-card-ep" class="card-dark rounded-2xl p-4">
              <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Épargne</p>
              <p class="text-lg font-bold text-indigo-400 text-center mb-3">${fmt(totalEpargne)}</p>
              <div class="space-y-2">
                ${epargne.length > 0 ? epargne.map(e => `
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-1.5 h-1.5 rounded-full bg-indigo-400/50 flex-shrink-0"></div>
                    <span class="text-[11px] text-gray-400 truncate">${e.nom}${e.tauxInteret ? ` <span class="text-gray-600">${(Number(e.tauxInteret) * 100).toFixed(1)}%</span>` : ''}</span>
                  </div>
                  <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(Number(e.solde) || 0)}</span>
                </div>`).join('') : '<p class="text-[11px] text-gray-600">Aucun compte</p>'}
              </div>
            </div>
          </div>
        </div>

        <!-- Center branch: Investissements → Placements -->
        <div>
          <div id="ptf-svg-L2C" class="hidden lg:block" style="height:45px;">
            <svg id="ptf-svg-L2C-svg" class="w-full" style="height:45px;" fill="none">
              <defs>
                <filter id="glow-amber2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
              </defs>
            </svg>
          </div>
          <div id="ptf-card-plac" class="card-dark rounded-2xl p-4">
            <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Placements</p>
            <p class="text-lg font-bold text-accent-amber text-center mb-3">${fmt(totalPlac)}</p>
            <div class="space-y-2">
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
        </div>

        <!-- Right branch: Immobilier → Biens -->
        <div>
          <div id="ptf-svg-L2R" class="hidden lg:block" style="height:45px;">
            <svg id="ptf-svg-L2R-svg" class="w-full" style="height:45px;" fill="none">
              <defs>
                <filter id="glow-brown2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="2"/></filter>
              </defs>
            </svg>
          </div>
          <div id="ptf-card-biens" class="card-dark rounded-2xl p-4">
            <p class="text-[9px] text-gray-500 uppercase tracking-wider mb-2">Biens immobiliers</p>
            <p class="text-lg font-bold text-amber-500 text-center mb-3">${fmt(totalImmo)}</p>
            <div class="space-y-2">
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
  const h = parseInt(svg.style.height) || 55;
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

    // Glow
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', d);
    glow.setAttribute('stroke', color);
    glow.setAttribute('stroke-width', '3');
    glow.setAttribute('fill', 'none');
    glow.setAttribute('opacity', '0.3');
    glow.setAttribute('filter', `url(#${filter})`);
    svg.appendChild(glow);

    // Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', d);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('fill', 'none');
    line.setAttribute('opacity', '0.5');
    svg.appendChild(line);

    // Bottom dot
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', cx);
    dot.setAttribute('cy', h);
    dot.setAttribute('r', '3');
    dot.setAttribute('fill', color);
    dot.setAttribute('opacity', '0.6');
    svg.appendChild(dot);
  });

  // Top dot
  const topDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  topDot.setAttribute('cx', mid);
  topDot.setAttribute('cy', '0');
  topDot.setAttribute('r', '3');
  topDot.setAttribute('fill', colors[0]);
  topDot.setAttribute('opacity', '0.6');
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
  const h = parseInt(svg.style.height) || 45;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

  const mid = w / 2;
  const cardRect = card.getBoundingClientRect();
  const cx = cardRect.left + cardRect.width / 2 - wrapRect.left;

  svg.querySelectorAll('path, circle, line').forEach(el => el.remove());

  const d = `M ${mid} 0 C ${mid} ${h * 0.55}, ${cx} ${h * 0.55}, ${cx} ${h}`;

  // Glow
  const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  glow.setAttribute('d', d);
  glow.setAttribute('stroke', color);
  glow.setAttribute('stroke-width', '3');
  glow.setAttribute('fill', 'none');
  glow.setAttribute('opacity', '0.3');
  glow.setAttribute('filter', `url(#${filterId})`);
  svg.appendChild(glow);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', d);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('fill', 'none');
  line.setAttribute('opacity', '0.5');
  svg.appendChild(line);

  // Dots
  const topDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  topDot.setAttribute('cx', mid);
  topDot.setAttribute('cy', '0');
  topDot.setAttribute('r', '3');
  topDot.setAttribute('fill', color);
  topDot.setAttribute('opacity', '0.6');
  svg.appendChild(topDot);

  const botDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  botDot.setAttribute('cx', cx);
  botDot.setAttribute('cy', h);
  botDot.setAttribute('r', '3');
  botDot.setAttribute('fill', color);
  botDot.setAttribute('opacity', '0.6');
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

    // Level 2 → 3 Left: Liquidités → CC + Épargne
    drawConnectors('ptf-svg-L2L-svg', 'ptf-svg-L2L',
      ['ptf-card-cc', 'ptf-card-ep'],
      ['#6366f1', '#6366f1'],
      ['glow-indigo2', 'glow-indigo2']
    );

    // Level 2 → 3 Center: Investissements → Placements
    drawStraightConnector('ptf-svg-L2C-svg', 'ptf-svg-L2C', 'ptf-card-plac', '#c9a76c', 'glow-amber2');

    // Level 2 → 3 Right: Immobilier → Biens
    drawStraightConnector('ptf-svg-L2R-svg', 'ptf-svg-L2R', 'ptf-card-biens', '#8b6914', 'glow-brown2');
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      drawAll();
    });
  });
  window.addEventListener('resize', drawAll);
}
