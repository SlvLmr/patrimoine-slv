import { createChart, COLORS } from '../charts/chart-config.js';

function fmt(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
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

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-100">Portefeuille Live</h1>

      <!-- Hero: Patrimoine net + 3 KPI -->
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_1fr] gap-4">

        <!-- Patrimoine net -->
        <div class="card-dark rounded-2xl p-5 relative overflow-hidden" style="box-shadow: 0 0 50px rgba(201,167,108,0.1), 0 0 100px rgba(201,167,108,0.04)">
          <div class="absolute inset-0 bg-gradient-to-br from-accent-amber/5 via-transparent to-purple-500/5 pointer-events-none"></div>
          <div class="relative">
            <p class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Patrimoine net</p>
            <p class="text-3xl font-extrabold text-accent-amber tracking-tight">${fmt(patrimoineNet)}</p>
            ${totalDette > 0 ? `
            <div class="flex items-center gap-3 mt-2">
              <span class="text-[10px] text-gray-500">Actifs <span class="text-gray-300 font-medium">${fmt(totalActifs)}</span></span>
              <span class="text-[10px] text-gray-500">Dettes <span class="text-red-400 font-medium">−${fmt(totalDette)}</span></span>
            </div>` : ''}
            <div class="mt-4 h-[120px]">
              <canvas id="chart-alloc-live"></canvas>
            </div>
          </div>
        </div>

        <!-- Liquidités (CC + Épargne) -->
        <div class="card-dark rounded-2xl p-5" style="box-shadow: 0 0 28px rgba(99,102,241,0.10)">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Liquidités</p>
          </div>
          <p class="text-2xl font-bold text-indigo-400 mb-3">${fmt(totalLiquidites)}</p>
          <div class="space-y-2">
            <p class="text-[9px] text-gray-600 uppercase tracking-wider">Comptes courants</p>
            ${comptesLive.map(c => `
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-gray-400 truncate">${c.nom}</span>
              <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(c.solde)}</span>
            </div>`).join('')}
            ${epargne.length > 0 ? `
            <p class="text-[9px] text-gray-600 uppercase tracking-wider pt-1">Épargne</p>
            ${epargne.map(e => `
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-gray-400 truncate">${e.nom}${e.tauxInteret ? ` <span class="text-gray-600">${(Number(e.tauxInteret) * 100).toFixed(1)}%</span>` : ''}</span>
              <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(Number(e.solde) || 0)}</span>
            </div>`).join('')}` : ''}
          </div>
        </div>

        <!-- Investissements -->
        <div class="card-dark rounded-2xl p-5" style="box-shadow: 0 0 28px rgba(201,167,108,0.10)">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-7 h-7 rounded-lg bg-accent-amber/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-accent-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
              </svg>
            </div>
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Investissements</p>
          </div>
          <p class="text-2xl font-bold text-accent-amber mb-3">${fmt(totalPlac)}</p>
          <div class="space-y-2">
            ${placements.length > 0 ? placements.map(p => `
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-gray-400 truncate">${p.nom}</span>
              <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(Number(p.valeur) || 0)}</span>
            </div>`).join('') : '<p class="text-[11px] text-gray-600">Aucun placement</p>'}
          </div>
        </div>

        <!-- Immobilier -->
        <div class="card-dark rounded-2xl p-5" style="box-shadow: 0 0 28px rgba(139,105,20,0.12)">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-7 h-7 rounded-lg bg-amber-700/15 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <p class="text-[10px] text-gray-500 uppercase tracking-wider">Immobilier</p>
          </div>
          <p class="text-2xl font-bold text-amber-500 mb-3">${fmt(totalImmo)}</p>
          <div class="space-y-2">
            ${immobilier.length > 0 ? immobilier.map(i => `
            <div class="flex items-center justify-between">
              <span class="text-[11px] text-gray-400 truncate">${i.nom}</span>
              <span class="text-[11px] text-gray-300 font-medium flex-shrink-0 ml-2">${fmt(Number(i.valeurActuelle) || 0)}</span>
            </div>`).join('') : '<p class="text-[11px] text-gray-600">Aucun bien</p>'}
          </div>
        </div>

      </div>
    </div>
  `;
}

export function mount(store) {
  const epargne = store.get('actifs.epargne') || [];
  const placements = store.get('actifs.placements') || [];
  const immobilier = store.get('actifs.immobilier') || [];

  const liveSoldes = computeLiveSoldes(store);
  const totalCC = liveSoldes.cic + liveSoldes.tr;
  const totalEpargne = epargne.reduce((s, e) => s + (Number(e.solde) || 0), 0);
  const totalPlac = placements.reduce((s, p) => s + (Number(p.valeur) || 0), 0);
  const totalImmo = immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);

  const totalLiquidites = totalCC + totalEpargne;
  const allocData = [];
  const allocLabels = [];
  const allocColors = [];
  if (totalLiquidites > 0) { allocData.push(totalLiquidites); allocLabels.push('Liquidités'); allocColors.push('#6366f1'); }
  if (totalPlac > 0) { allocData.push(totalPlac); allocLabels.push('Investissements'); allocColors.push('#c9a76c'); }
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
