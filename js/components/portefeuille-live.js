import { createChart, createVerticalGradient, COLORS } from '../charts/chart-config.js';

function formatCurrency(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v || 0);
}

function formatPct(v) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(2)} %`;
}

export function render(store) {
  const comptes = store.get('actifs.comptesCourants') || [];
  const epargne = store.get('actifs.epargne') || [];
  const placements = store.get('actifs.placements') || [];

  const totalCC = comptes.reduce((s, c) => s + (Number(c.solde) || 0), 0);
  const totalEpargne = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
  const totalPlacements = placements.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalInvesti = placements.reduce((s, p) => s + (Number(p.quantite) || 0) * (Number(p.pru) || 0), 0);
  const totalGlobal = totalCC + totalEpargne + totalPlacements;

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h1 class="text-2xl font-bold text-gray-100">Portefeuille Live</h1>
        <div class="text-xs text-gray-500">Valeurs déclarées — mise à jour manuelle</div>
      </div>

      <!-- Total global -->
      <div class="card-dark rounded-xl p-5 relative overflow-hidden" id="total-global-card" style="box-shadow: 0 0 40px rgba(201,167,108,0.1), 0 0 80px rgba(201,167,108,0.05)">
        <div class="absolute inset-0 bg-gradient-to-r from-accent-amber/5 via-transparent to-accent-green/5 pointer-events-none"></div>
        <div class="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-1">Patrimoine financier total</p>
            <p class="text-3xl font-bold text-accent-amber">${formatCurrency(totalGlobal)}</p>
          </div>
          <div class="flex gap-6">
            <div class="text-right">
              <p class="text-[10px] text-gray-500 uppercase tracking-wider">Liquidités</p>
              <p class="text-sm font-semibold text-indigo-400">${formatCurrency(totalCC)}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] text-gray-500 uppercase tracking-wider">Épargne</p>
              <p class="text-sm font-semibold text-accent-green">${formatCurrency(totalEpargne)}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] text-gray-500 uppercase tracking-wider">Placements</p>
              <p class="text-sm font-semibold text-accent-amber">${formatCurrency(totalPlacements)}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Allocation chart + Comptes courants -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <!-- Allocation donut -->
        <div class="card-dark rounded-xl p-4" style="box-shadow: 0 0 25px rgba(201,167,108,0.08)">
          <h2 class="text-sm font-semibold text-gray-200 mb-3">Allocation</h2>
          <div class="h-[200px]">
            <canvas id="chart-alloc-live"></canvas>
          </div>
        </div>

        <!-- Comptes courants -->
        <div class="card-dark rounded-xl p-4" style="box-shadow: 0 0 25px rgba(99,102,241,0.1)">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            <h2 class="text-sm font-semibold text-gray-200">Comptes courants</h2>
          </div>
          <p class="text-2xl font-bold text-indigo-400 mb-3">${formatCurrency(totalCC)}</p>
          <div class="space-y-2">
            ${comptes.map(c => {
              const solde = Number(c.solde) || 0;
              const pct = totalCC > 0 ? (solde / totalCC * 100) : 0;
              return `
              <div class="flex items-center justify-between py-2 border-b border-dark-400/20">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0"></div>
                  <span class="text-xs text-gray-300 truncate">${c.nom}</span>
                </div>
                <div class="flex items-center gap-3 flex-shrink-0">
                  <span class="text-xs text-gray-500">${pct.toFixed(0)}%</span>
                  <span class="text-sm font-medium text-indigo-300">${formatCurrency(solde)}</span>
                </div>
              </div>`;
            }).join('')}
            ${comptes.length === 0 ? '<p class="text-xs text-gray-600">Aucun compte courant.</p>' : ''}
          </div>
        </div>

        <!-- Livrets / Épargne -->
        <div class="card-dark rounded-xl p-4" style="box-shadow: 0 0 25px rgba(34,197,94,0.08)">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-lg bg-accent-green/20 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1"/>
              </svg>
            </div>
            <h2 class="text-sm font-semibold text-gray-200">Livrets & Épargne</h2>
          </div>
          <p class="text-2xl font-bold text-accent-green mb-3">${formatCurrency(totalEpargne)}</p>
          <div class="space-y-2">
            ${epargne.map(e => {
              const solde = Number(e.solde) || 0;
              const taux = Number(e.tauxInteret) || 0;
              const plafond = Number(e.plafond) || 0;
              const remplissage = plafond > 0 ? Math.min(solde / plafond * 100, 100) : 0;
              return `
              <div class="py-2 border-b border-dark-400/20">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-1.5 h-1.5 rounded-full bg-accent-green flex-shrink-0"></div>
                    <span class="text-xs text-gray-300 truncate">${e.nom}</span>
                    ${taux > 0 ? `<span class="text-[10px] text-accent-green/60">${(taux * 100).toFixed(1)}%</span>` : ''}
                  </div>
                  <span class="text-sm font-medium text-accent-green flex-shrink-0">${formatCurrency(solde)}</span>
                </div>
                ${plafond > 0 ? `
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-1 rounded-full bg-dark-600 overflow-hidden">
                    <div class="h-full rounded-full bg-accent-green/40 transition-all" style="width: ${remplissage}%"></div>
                  </div>
                  <span class="text-[9px] text-gray-600 flex-shrink-0">${remplissage.toFixed(0)}%</span>
                </div>` : ''}
              </div>`;
            }).join('')}
            ${epargne.length === 0 ? '<p class="text-xs text-gray-600">Aucun livret d\'épargne.</p>' : ''}
          </div>
        </div>
      </div>

      <!-- Placements -->
      <div class="card-dark rounded-xl overflow-hidden" style="box-shadow: 0 0 25px rgba(201,167,108,0.08)">
        <div class="flex items-center justify-between px-4 py-3 border-b border-dark-400/30">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-lg bg-accent-amber/20 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <h2 class="text-sm font-semibold text-gray-200">Placements</h2>
          </div>
          <div class="flex items-center gap-4 text-xs">
            <span class="text-gray-500">Investi : <span class="text-gray-300 font-medium">${formatCurrency(totalInvesti)}</span></span>
            <span class="text-gray-500">Valeur : <span class="text-accent-amber font-semibold">${formatCurrency(totalPlacements)}</span></span>
            ${totalInvesti > 0 ? `<span class="${totalPlacements >= totalInvesti ? 'text-accent-green' : 'text-red-400'} font-semibold">${formatPct((totalPlacements - totalInvesti) / totalInvesti * 100)}</span>` : ''}
          </div>
        </div>
        ${placements.length > 0 ? `
        <div class="grid grid-cols-[1fr_5rem_5rem_5.5rem_5.5rem_4.5rem] items-center px-4 py-1.5 border-b border-dark-400/20">
          <span class="text-[10px] text-gray-500 uppercase tracking-wider">Nom</span>
          <span class="text-[10px] text-gray-500 uppercase tracking-wider text-right">Qté</span>
          <span class="text-[10px] text-gray-500 uppercase tracking-wider text-right">PRU</span>
          <span class="text-[10px] text-gray-500 uppercase tracking-wider text-right">Investi</span>
          <span class="text-[10px] text-gray-500 uppercase tracking-wider text-right">Valeur</span>
          <span class="text-[10px] text-gray-500 uppercase tracking-wider text-right">+/-</span>
        </div>
        <div class="divide-y divide-dark-400/15">
          ${placements.map(p => {
            const qty = Number(p.quantite) || 0;
            const pru = Number(p.pru) || 0;
            const val = Number(p.valeur) || 0;
            const investi = qty * pru;
            const gain = val - investi;
            const gainPct = investi > 0 ? (gain / investi * 100) : 0;
            const positive = gain >= 0;
            const cat = p.categorie || p.enveloppe || '';
            return `
          <div class="grid grid-cols-[1fr_5rem_5rem_5.5rem_5.5rem_4.5rem] items-center px-4 py-2 hover:bg-dark-600/30 transition">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-1.5 h-1.5 rounded-full bg-accent-amber flex-shrink-0"></div>
              <p class="text-xs text-gray-200 truncate">${p.nom}</p>
              ${cat ? `<span class="text-[10px] text-gray-600 flex-shrink-0">${cat}</span>` : ''}
            </div>
            <span class="text-xs text-gray-400 text-right">${qty > 0 ? (Number.isInteger(qty) ? qty : qty.toFixed(4)) : '—'}</span>
            <span class="text-xs text-gray-400 text-right">${pru > 0 ? formatCurrency(pru) : '—'}</span>
            <span class="text-xs text-gray-300 text-right">${investi > 0 ? formatCurrency(investi) : '—'}</span>
            <span class="text-xs font-medium text-accent-amber text-right">${formatCurrency(val)}</span>
            <span class="text-xs font-medium text-right ${positive ? 'text-accent-green' : 'text-red-400'}">${investi > 0 ? formatPct(gainPct) : '—'}</span>
          </div>`;
          }).join('')}
        </div>
        <div class="grid grid-cols-[1fr_5rem_5rem_5.5rem_5.5rem_4.5rem] items-center px-4 py-2.5 border-t border-dark-400/40 bg-dark-700/30">
          <span class="text-xs font-bold text-gray-300 uppercase">Total</span>
          <span></span>
          <span></span>
          <span class="text-xs font-bold text-gray-100 text-right">${formatCurrency(totalInvesti)}</span>
          <span class="text-xs font-bold text-accent-amber text-right">${formatCurrency(totalPlacements)}</span>
          <span class="text-xs font-bold text-right ${totalPlacements >= totalInvesti ? 'text-accent-green' : 'text-red-400'}">${totalInvesti > 0 ? formatPct((totalPlacements - totalInvesti) / totalInvesti * 100) : '—'}</span>
        </div>
        ` : '<p class="px-4 py-4 text-xs text-gray-600">Aucun placement.</p>'}
      </div>
    </div>
  `;
}

export function mount(store) {
  const comptes = store.get('actifs.comptesCourants') || [];
  const epargne = store.get('actifs.epargne') || [];
  const placements = store.get('actifs.placements') || [];

  const totalCC = comptes.reduce((s, c) => s + (Number(c.solde) || 0), 0);
  const totalEpargne = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
  const totalPlacements = placements.reduce((s, p) => s + (Number(p.valeur) || 0), 0);

  // Allocation donut chart
  const allocData = [];
  const allocLabels = [];
  const allocColors = [];

  if (totalCC > 0) { allocData.push(totalCC); allocLabels.push('Comptes courants'); allocColors.push('#6366f1'); }
  if (totalEpargne > 0) { allocData.push(totalEpargne); allocLabels.push('Épargne'); allocColors.push('#22c55e'); }
  if (totalPlacements > 0) { allocData.push(totalPlacements); allocLabels.push('Placements'); allocColors.push('#c9a76c'); }

  if (allocData.length > 0) {
    const total = allocData.reduce((s, v) => s + v, 0);
    const centerPlugin = {
      id: 'allocCenter',
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillStyle = '#e8d5b0';
        ctx.fillText(formatCurrency(total), cx, cy - 6);
        ctx.font = '9px Inter, sans-serif';
        ctx.fillStyle = '#6b6b75';
        ctx.fillText('Total', cx, cy + 10);
        ctx.restore();
      }
    };

    createChart('chart-alloc-live', {
      type: 'doughnut',
      data: {
        labels: allocLabels,
        datasets: [{
          data: allocData,
          backgroundColor: allocColors,
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      plugins: [centerPlugin],
      options: {
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 8, usePointStyle: true, pointStyle: 'circle', boxWidth: 6, color: '#88888a', font: { size: 10, family: 'Inter' } }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }
}
