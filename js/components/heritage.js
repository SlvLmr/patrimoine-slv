import { formatCurrency, formatPercent, computeProjection } from '../utils.js';
import { createChart, COLORS, PALETTE } from '../charts/chart-config.js';

export function render(store) {
  const totalActifs = store.totalActifs();
  const totalPassifs = store.totalPassifs();
  const patrimoineNet = store.patrimoineNet();
  const state = store.getAll();
  const capacite = store.capaciteEpargne();

  const immoTotal = state.actifs.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const placTotal = state.actifs.placements.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const eparTotal = state.actifs.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);

  // Calculate total investment returns
  const totalPRU = state.actifs.placements.reduce((s, i) => s + (Number(i.pru || i.valeur) * (Number(i.quantite) || 1)), 0);
  const totalCurrentVal = state.actifs.placements.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const totalPV = totalCurrentVal - (totalPRU || totalCurrentVal);
  const pvPercent = totalPRU > 0 ? totalPV / totalPRU : 0;

  // Group placements by type
  const placByType = {};
  state.actifs.placements.forEach(p => {
    const type = p.type || 'Autre';
    if (!placByType[type]) placByType[type] = 0;
    placByType[type] += Number(p.valeur) || 0;
  });

  // Group placements by envelope
  const envelopes = {};
  state.actifs.placements.forEach(p => {
    const env = p.enveloppe || p.type || 'Autre';
    if (!envelopes[env]) envelopes[env] = { total: 0, items: [] };
    envelopes[env].total += Number(p.valeur) || 0;
    envelopes[env].items.push(p);
  });

  // Projection summary (5 years)
  const snapshots = computeProjection(store);
  const snap5 = snapshots.find(s => s.annee === 5) || snapshots[snapshots.length - 1];
  const snap10 = snapshots.find(s => s.annee === 10) || snapshots[snapshots.length - 1];

  const hasData = totalActifs > 0 || totalPassifs > 0;

  // Allocation data for breakdown
  const allAssets = [];
  state.actifs.immobilier.forEach(i => allAssets.push({ nom: i.nom, valeur: Number(i.valeurActuelle) || 0, type: 'Immobilier', color: COLORS.immobilier }));
  state.actifs.placements.forEach(i => allAssets.push({ nom: i.nom, valeur: Number(i.valeur) || 0, type: i.type || 'Placement', color: COLORS.placements }));
  state.actifs.epargne.forEach(i => allAssets.push({ nom: i.nom, valeur: Number(i.solde) || 0, type: 'Épargne', color: COLORS.epargne }));
  allAssets.sort((a, b) => b.valeur - a.valeur);

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-100">Héritage & Patrimoine</h1>
        <p class="text-sm text-gray-500">Vue complète de votre patrimoine</p>
      </div>

      <!-- Main Net Worth Hero -->
      <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-700 via-dark-600 to-dark-700 border border-dark-400/30 p-8">
        <div class="absolute inset-0 bg-gradient-to-br from-accent-green/5 via-transparent to-accent-blue/5"></div>
        <div class="relative z-10">
          <div class="text-center mb-8">
            <p class="text-sm text-gray-400 mb-2 uppercase tracking-widest font-medium">Patrimoine Net Total</p>
            <p class="text-6xl font-bold gradient-text mb-2">${formatCurrency(patrimoineNet)}</p>
            ${totalPV !== 0 ? `
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full ${totalPV >= 0 ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'} text-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${totalPV >= 0 ? 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' : 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6'}"/>
              </svg>
              <span>${totalPV >= 0 ? '+' : ''}${formatCurrency(totalPV)} (${formatPercent(pvPercent)})</span>
            </div>
            ` : ''}
          </div>

          <!-- Summary metrics -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="text-center p-4 rounded-xl bg-dark-800/50">
              <p class="text-xs text-gray-500 mb-1 uppercase">Actifs totaux</p>
              <p class="text-xl font-bold text-accent-green">${formatCurrency(totalActifs)}</p>
            </div>
            <div class="text-center p-4 rounded-xl bg-dark-800/50">
              <p class="text-xs text-gray-500 mb-1 uppercase">Dettes</p>
              <p class="text-xl font-bold text-accent-red">${formatCurrency(totalPassifs)}</p>
            </div>
            <div class="text-center p-4 rounded-xl bg-dark-800/50">
              <p class="text-xs text-gray-500 mb-1 uppercase">Dans 5 ans</p>
              <p class="text-xl font-bold text-accent-blue">${formatCurrency(snap5?.patrimoineNet || 0)}</p>
            </div>
            <div class="text-center p-4 rounded-xl bg-dark-800/50">
              <p class="text-xs text-gray-500 mb-1 uppercase">Dans 10 ans</p>
              <p class="text-xl font-bold text-purple-400">${formatCurrency(snap10?.patrimoineNet || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      ${hasData ? `
      <!-- Allocation Overview -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Doughnut -->
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Allocation globale</h2>
          <div class="h-56">
            <canvas id="chart-heritage-alloc"></canvas>
          </div>
        </div>

        <!-- Category bars -->
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Par catégorie</h2>
          <div class="space-y-4">
            ${[
              { label: 'Immobilier', val: immoTotal, color: COLORS.immobilier, icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3' },
              { label: 'Placements', val: placTotal, color: COLORS.placements, icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
              { label: 'Épargne', val: eparTotal, color: COLORS.epargne, icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' }
            ].map(cat => `
            <div class="group">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${cat.color}20">
                    <svg class="w-4 h-4" style="color: ${cat.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${cat.icon}"/>
                    </svg>
                  </div>
                  <span class="text-sm text-gray-300">${cat.label}</span>
                </div>
                <div class="text-right">
                  <span class="text-sm font-medium text-gray-200">${formatCurrency(cat.val)}</span>
                  <span class="text-xs text-gray-500 ml-1">${totalActifs > 0 ? ((cat.val / totalActifs) * 100).toFixed(0) + '%' : '0%'}</span>
                </div>
              </div>
              <div class="progress-bar h-1.5">
                <div class="progress-bar-fill h-full" style="width: ${totalActifs > 0 ? (cat.val / totalActifs) * 100 : 0}%; background: ${cat.color}"></div>
              </div>
            </div>
            `).join('')}
          </div>
        </div>

        <!-- Projection mini -->
        <div class="card-dark rounded-xl p-6">
          <h2 class="text-lg font-semibold text-gray-200 mb-4">Projection à 10 ans</h2>
          <div class="h-56">
            <canvas id="chart-heritage-projection"></canvas>
          </div>
        </div>
      </div>

      <!-- Type breakdown for placements -->
      ${Object.keys(placByType).length > 0 ? `
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Détail des placements par type</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${Object.entries(placByType).map(([type, val], i) => `
          <div class="bg-dark-800/50 rounded-xl p-4 border border-dark-400/20 hover:border-dark-300/40 transition">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-3 h-3 rounded-full" style="background: ${PALETTE[i % PALETTE.length]}"></div>
              <span class="text-sm font-medium text-gray-300">${type}</span>
            </div>
            <p class="text-xl font-bold text-gray-100">${formatCurrency(val)}</p>
            <p class="text-xs text-gray-500 mt-1">${totalActifs > 0 ? ((val / totalActifs) * 100).toFixed(1) : 0}% du patrimoine</p>
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Envelopes detail -->
      ${Object.keys(envelopes).length > 0 ? `
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Enveloppes d'investissement</h2>
        <div class="space-y-4">
          ${Object.entries(envelopes).map(([env, data], i) => `
          <div class="bg-dark-800/50 rounded-xl p-4 border border-dark-400/20">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg flex items-center justify-center" style="background: ${PALETTE[i % PALETTE.length]}20">
                  <span class="text-sm font-bold" style="color: ${PALETTE[i % PALETTE.length]}">${env.slice(0, 2).toUpperCase()}</span>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-200">${env}</p>
                  <p class="text-xs text-gray-500">${data.items.length} ligne${data.items.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <p class="text-lg font-bold text-gray-100">${formatCurrency(data.total)}</p>
            </div>
            ${data.items.length > 0 ? `
            <div class="space-y-2">
              ${data.items.map(item => {
                const pv = item.quantite && item.pru ? (Number(item.valeur) - Number(item.pru) * Number(item.quantite)) : 0;
                return `
                <div class="flex items-center justify-between py-2 border-t border-dark-400/20">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-400">${item.nom}</span>
                    ${item.isin ? `<span class="text-xs text-gray-600">${item.isin}</span>` : ''}
                  </div>
                  <div class="flex items-center gap-4">
                    ${pv !== 0 ? `
                    <span class="text-xs px-2 py-0.5 rounded-full ${pv >= 0 ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'}">${pv >= 0 ? '+' : ''}${formatCurrency(pv)}</span>
                    ` : ''}
                    <span class="text-sm font-medium text-gray-200">${formatCurrency(item.valeur)}</span>
                  </div>
                </div>
                `;
              }).join('')}
            </div>
            ` : ''}
          </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- All assets ranked -->
      <div class="card-dark rounded-xl p-6">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Tous vos actifs par valeur</h2>
        <div class="space-y-2">
          ${allAssets.slice(0, 15).map((asset, i) => `
          <div class="flex items-center gap-4 py-3 ${i > 0 ? 'border-t border-dark-400/20' : ''}">
            <span class="text-gray-600 text-sm w-6">#${i + 1}</span>
            <div class="w-3 h-3 rounded-full flex-shrink-0" style="background: ${asset.color}"></div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-200 truncate">${asset.nom}</p>
              <p class="text-xs text-gray-500">${asset.type}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-medium text-gray-200">${formatCurrency(asset.valeur)}</p>
              <p class="text-xs text-gray-500">${totalActifs > 0 ? ((asset.valeur / totalActifs) * 100).toFixed(1) : 0}%</p>
            </div>
          </div>
          `).join('')}
        </div>
      </div>

      <!-- Debt section -->
      ${totalPassifs > 0 ? `
      <div class="card-dark rounded-xl p-6 glow-red">
        <h2 class="text-lg font-semibold text-gray-200 mb-4">Endettement</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div class="text-center p-4 rounded-xl bg-dark-800/50">
            <p class="text-xs text-gray-500 mb-1 uppercase">Dette totale</p>
            <p class="text-xl font-bold text-accent-red">${formatCurrency(totalPassifs)}</p>
          </div>
          <div class="text-center p-4 rounded-xl bg-dark-800/50">
            <p class="text-xs text-gray-500 mb-1 uppercase">Ratio dette/actifs</p>
            <p class="text-xl font-bold ${totalActifs > 0 && totalPassifs / totalActifs > 0.5 ? 'text-accent-red' : 'text-accent-green'}">${totalActifs > 0 ? formatPercent(totalPassifs / totalActifs) : '0%'}</p>
          </div>
          <div class="text-center p-4 rounded-xl bg-dark-800/50">
            <p class="text-xs text-gray-500 mb-1 uppercase">Mensualités</p>
            <p class="text-xl font-bold text-gray-200">${formatCurrency(state.passifs.emprunts.reduce((s, e) => s + (Number(e.mensualite) || 0), 0))}<span class="text-sm font-normal text-gray-500">/mois</span></p>
          </div>
        </div>
        ${state.passifs.emprunts.map(e => `
        <div class="flex items-center justify-between py-3 border-t border-dark-400/20">
          <div>
            <p class="text-sm text-gray-200">${e.nom}</p>
            <p class="text-xs text-gray-500">${e.dureeRestanteMois || 0} mois restants — ${formatPercent(e.tauxInteret || 0)}</p>
          </div>
          <div class="text-right">
            <p class="text-sm font-medium text-accent-red">${formatCurrency(e.capitalRestant)}</p>
            <p class="text-xs text-gray-500">${formatCurrency(e.mensualite)}/mois</p>
          </div>
        </div>
        `).join('')}
      </div>
      ` : ''}
      ` : `
      <div class="card-dark rounded-xl p-12 text-center">
        <div class="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-accent-green/20 to-accent-blue/20 flex items-center justify-center mb-6">
          <svg class="w-10 h-10 text-accent-green/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-300 mb-2">Aucune donnée patrimoniale</h2>
        <p class="text-gray-500 max-w-md mx-auto">Commencez par ajouter vos actifs, passifs et revenus pour visualiser votre patrimoine global.</p>
      </div>
      `}
    </div>
  `;
}

export function mount(store) {
  const state = store.getAll();
  const totalActifs = store.totalActifs();
  const totalPassifs = store.totalPassifs();

  if (totalActifs === 0 && totalPassifs === 0) return;

  const immoTotal = state.actifs.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const placTotal = state.actifs.placements.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
  const eparTotal = state.actifs.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);

  // Allocation doughnut
  if (document.getElementById('chart-heritage-alloc')) {
    const data = [];
    const labels = [];
    const colors = [];
    if (immoTotal > 0) { data.push(immoTotal); labels.push('Immobilier'); colors.push(COLORS.immobilier); }
    if (placTotal > 0) { data.push(placTotal); labels.push('Placements'); colors.push(COLORS.placements); }
    if (eparTotal > 0) { data.push(eparTotal); labels.push('Épargne'); colors.push(COLORS.epargne); }
    if (totalPassifs > 0) { data.push(totalPassifs); labels.push('Dettes'); colors.push(COLORS.dette); }

    if (data.length > 0) {
      createChart('chart-heritage-alloc', {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 8,
            borderRadius: 4
          }]
        },
        options: {
          cutout: '70%',
          plugins: {
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = ((ctx.raw / total) * 100).toFixed(1);
                  return ` ${ctx.label}: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(ctx.raw)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  // Mini projection chart
  if (document.getElementById('chart-heritage-projection')) {
    const snapshots = computeProjection(store);
    const s10 = snapshots.filter(s => s.annee <= 10);
    const labels = s10.map(s => s.annee === 0 ? 'Auj.' : `+${s.annee}`);

    createChart('chart-heritage-projection', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Patrimoine net',
          data: s10.map(s => s.patrimoineNet),
          borderColor: COLORS.patrimoine,
          backgroundColor: COLORS.patrimoine + '15',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2.5
        }]
      },
      options: {
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: COLORS.gridText, font: { size: 10 } }
          },
          y: {
            grid: { color: COLORS.grid },
            ticks: {
              color: COLORS.gridText,
              font: { size: 10 },
              callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
            }
          }
        }
      }
    });
  }
}
