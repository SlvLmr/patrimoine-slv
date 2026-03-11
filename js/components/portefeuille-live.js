import { createChart, COLORS } from '../charts/chart-config.js';

function fmt(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
}

export function render(store) {
  const comptes = store.get('actifs.comptesCourants') || [];
  const epargne = store.get('actifs.epargne') || [];
  const placements = store.get('actifs.placements') || [];
  const immobilier = store.get('actifs.immobilier') || [];
  const emprunts = store.get('passifs.emprunts') || [];

  const totalCC = comptes.reduce((s, c) => s + (Number(c.solde) || 0), 0);
  const totalEpargne = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
  const totalPlac = placements.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalImmo = immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
  const totalDette = emprunts.reduce((s, e) => s + (Number(e.capitalRestant) || 0), 0);
  const totalActifs = totalCC + totalEpargne + totalPlac + totalImmo;
  const patrimoineNet = totalActifs - totalDette;

  // Cards config
  const cards = [
    {
      label: 'Comptes courants', total: totalCC, color: 'indigo', hex: '#6366f1',
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      items: comptes.map(c => ({ nom: c.nom, val: Number(c.solde) || 0 }))
    },
    {
      label: 'Épargne', total: totalEpargne, color: 'green', hex: '#22c55e',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1',
      items: epargne.map(e => ({ nom: e.nom, val: Number(e.solde) || 0, extra: e.tauxInteret ? `${(Number(e.tauxInteret) * 100).toFixed(1)}%` : '' }))
    },
    {
      label: 'Placements', total: totalPlac, color: 'amber', hex: '#c9a76c',
      icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
      items: placements.map(p => ({ nom: p.nom, val: Number(p.valeur) || 0 }))
    },
    {
      label: 'Immobilier', total: totalImmo, color: 'amber-dark', hex: '#8b6914',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      items: immobilier.map(i => ({ nom: i.nom, val: Number(i.valeurActuelle) || 0 }))
    },
  ];

  const colorMap = {
    indigo: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', glow: 'rgba(99,102,241,0.12)' },
    green: { bg: 'bg-accent-green/15', text: 'text-accent-green', glow: 'rgba(34,197,94,0.12)' },
    amber: { bg: 'bg-accent-amber/15', text: 'text-accent-amber', glow: 'rgba(201,167,108,0.12)' },
    'amber-dark': { bg: 'bg-amber-700/15', text: 'text-amber-500', glow: 'rgba(139,105,20,0.15)' },
  };

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-100">Portefeuille Live</h1>

      <!-- Patrimoine net hero -->
      <div class="card-dark rounded-2xl p-6 relative overflow-hidden" style="box-shadow: 0 0 50px rgba(201,167,108,0.1), 0 0 100px rgba(201,167,108,0.04)">
        <div class="absolute inset-0 bg-gradient-to-br from-accent-amber/5 via-transparent to-purple-500/5 pointer-events-none"></div>
        <div class="relative flex flex-col lg:flex-row items-center justify-between gap-6">
          <div class="text-center lg:text-left">
            <p class="text-xs text-gray-500 uppercase tracking-widest mb-2">Patrimoine net</p>
            <p class="text-4xl font-extrabold text-accent-amber tracking-tight">${fmt(patrimoineNet)}</p>
            ${totalDette > 0 ? `
            <div class="flex items-center gap-4 mt-2">
              <span class="text-xs text-gray-500">Actifs <span class="text-gray-300 font-medium">${fmt(totalActifs)}</span></span>
              <span class="text-xs text-gray-500">Dettes <span class="text-red-400 font-medium">−${fmt(totalDette)}</span></span>
            </div>` : ''}
          </div>
          <div class="w-[180px] h-[180px] flex-shrink-0">
            <canvas id="chart-alloc-live"></canvas>
          </div>
        </div>
      </div>

      <!-- 4 asset cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${cards.map(c => {
          const cm = colorMap[c.color];
          const pct = totalActifs > 0 ? (c.total / totalActifs * 100).toFixed(0) : 0;
          return `
          <div class="card-dark rounded-xl p-4 relative overflow-hidden group" style="box-shadow: 0 0 28px ${cm.glow}">
            <div class="flex items-center gap-2.5 mb-3">
              <div class="w-8 h-8 rounded-lg ${cm.bg} flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4 ${cm.text}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${c.icon}"/>
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider">${c.label}</p>
                <p class="text-xl font-bold ${cm.text} leading-tight">${fmt(c.total)}</p>
              </div>
              <span class="ml-auto text-xs text-gray-600 font-medium">${pct}%</span>
            </div>
            ${c.items.length > 0 ? `
            <div class="space-y-1.5">
              ${c.items.map(it => `
              <div class="flex items-center justify-between">
                <span class="text-[11px] text-gray-400 truncate">${it.nom}${it.extra ? ` <span class="text-gray-600">${it.extra}</span>` : ''}</span>
                <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(it.val)}</span>
              </div>`).join('')}
            </div>` : '<p class="text-[11px] text-gray-600">Aucun élément</p>'}
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

export function mount(store) {
  const comptes = store.get('actifs.comptesCourants') || [];
  const epargne = store.get('actifs.epargne') || [];
  const placements = store.get('actifs.placements') || [];
  const immobilier = store.get('actifs.immobilier') || [];

  const totalCC = comptes.reduce((s, c) => s + (Number(c.solde) || 0), 0);
  const totalEpargne = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
  const totalPlac = placements.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalImmo = immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);

  const allocData = [];
  const allocLabels = [];
  const allocColors = [];
  if (totalCC > 0) { allocData.push(totalCC); allocLabels.push('Liquidités'); allocColors.push('#6366f1'); }
  if (totalEpargne > 0) { allocData.push(totalEpargne); allocLabels.push('Épargne'); allocColors.push('#22c55e'); }
  if (totalPlac > 0) { allocData.push(totalPlac); allocLabels.push('Placements'); allocColors.push('#c9a76c'); }
  if (totalImmo > 0) { allocData.push(totalImmo); allocLabels.push('Immobilier'); allocColors.push('#8b6914'); }

  if (allocData.length === 0) return;

  const total = allocData.reduce((s, v) => s + v, 0);

  const glowPlugin = {
    id: 'doughnutGlow',
    beforeDraw(chart) {
      chart.ctx.save();
      chart.ctx.shadowBlur = 14;
      chart.ctx.shadowOffsetY = 2;
    },
    afterDraw(chart) {
      chart.ctx.restore();
    }
  };

  const centerPlugin = {
    id: 'allocCenter',
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillStyle = '#e8d5b0';
      ctx.fillText(fmt(total), cx, cy);
      ctx.restore();
    }
  };

  createChart('chart-alloc-live', {
    type: 'doughnut',
    data: {
      labels: allocLabels,
      datasets: [{ data: allocData, backgroundColor: allocColors, borderWidth: 0, hoverOffset: 6, borderRadius: 2 }]
    },
    plugins: [centerPlugin, glowPlugin],
    options: {
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 8, usePointStyle: true, pointStyle: 'circle', boxWidth: 6, color: '#88888a', font: { size: 9, family: 'Inter' } }
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}
