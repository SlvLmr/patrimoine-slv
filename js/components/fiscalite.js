import { formatCurrency, formatPercent, computeTax, inputField, selectField, parseNumberInput } from '../utils.js';
import { createChart, COLORS, PALETTE } from '../charts/chart-config.js';

let taxResult = null;

export function render(store) {
  const params = store.get('parametres');
  const revenuAnnuel = store.totalRevenus() * 12;

  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-800">Estimation fiscale</h1>

      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        Cette estimation est fournie à titre indicatif uniquement et ne constitue pas un conseil fiscal.
        Consultez un professionnel pour votre situation réelle.
      </div>

      <!-- Input form -->
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold text-gray-700 mb-4">Paramètres</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Revenu net imposable annuel (€)</label>
            <input type="number" id="tax-revenu" value="${Math.round(revenuAnnuel)}" step="100"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Situation familiale</label>
            <select id="tax-situation"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="celibataire" ${params.situationFamiliale === 'celibataire' ? 'selected' : ''}>Célibataire</option>
              <option value="couple" ${params.situationFamiliale === 'couple' ? 'selected' : ''}>Couple (2 parts)</option>
              <option value="couple1" ${params.situationFamiliale === 'couple1' ? 'selected' : ''}>Couple + 1 enfant</option>
              <option value="couple2" ${params.situationFamiliale === 'couple2' ? 'selected' : ''}>Couple + 2 enfants</option>
              <option value="couple3" ${params.situationFamiliale === 'couple3' ? 'selected' : ''}>Couple + 3 enfants</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre de parts</label>
            <input type="number" id="tax-parts" value="${params.nbParts}" step="0.25" min="1" max="10"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
          </div>
          <div class="flex items-end">
            <button id="btn-calc-tax" class="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              Calculer
            </button>
          </div>
        </div>
      </div>

      <!-- Results placeholder -->
      <div id="tax-results"></div>
    </div>
  `;
}

function renderResults(result) {
  if (!result) return '';
  return `
    <!-- KPI -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500 mb-1">Impôt net</p>
        <p class="text-2xl font-bold text-red-500">${formatCurrency(result.impotNet)}</p>
      </div>
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500 mb-1">Taux moyen d'imposition</p>
        <p class="text-2xl font-bold text-gray-800">${formatPercent(result.tauxMoyen)}</p>
      </div>
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500 mb-1">Taux marginal</p>
        <p class="text-2xl font-bold text-indigo-600">${formatPercent(result.tauxMarginal)}</p>
      </div>
      <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <p class="text-sm text-gray-500 mb-1">Quotient familial</p>
        <p class="text-2xl font-bold text-gray-800">${formatCurrency(result.quotientFamilial)}</p>
      </div>
    </div>

    <!-- Detail -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 class="font-semibold text-gray-700 mb-4">Détail du calcul</h3>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between py-2 border-b border-gray-50">
            <span class="text-gray-600">Revenu net imposable</span>
            <span class="font-medium">${formatCurrency(result.revenuImposable)}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-gray-50">
            <span class="text-gray-600">Nombre de parts</span>
            <span class="font-medium">${result.nbParts}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-gray-50">
            <span class="text-gray-600">Quotient familial</span>
            <span class="font-medium">${formatCurrency(result.quotientFamilial)}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-gray-50">
            <span class="text-gray-600">Impôt brut</span>
            <span class="font-medium">${formatCurrency(result.impotBrut)}</span>
          </div>
          ${result.decote > 0 ? `
          <div class="flex justify-between py-2 border-b border-gray-50">
            <span class="text-gray-600">Décote</span>
            <span class="font-medium text-emerald-600">-${formatCurrency(result.decote)}</span>
          </div>
          ` : ''}
          <div class="flex justify-between py-2 border-t-2 border-gray-200">
            <span class="font-semibold text-gray-800">Impôt net à payer</span>
            <span class="font-bold text-red-500">${formatCurrency(result.impotNet)}</span>
          </div>
          <div class="flex justify-between py-2">
            <span class="text-gray-600">Revenu après impôt (mensuel)</span>
            <span class="font-medium text-emerald-600">${formatCurrency((result.revenuImposable - result.impotNet) / 12)}</span>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 class="font-semibold text-gray-700 mb-4">Barème par tranche</h3>
        <div class="h-64">
          <canvas id="chart-tax-tranches"></canvas>
        </div>
      </div>
    </div>

    <!-- PFU Info -->
    <div class="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 class="font-semibold text-gray-700 mb-2">Prélèvement Forfaitaire Unique (PFU)</h3>
      <p class="text-sm text-gray-600">
        Les revenus du capital (dividendes, plus-values, intérêts) sont soumis au PFU de
        <span class="font-semibold">${formatPercent(result.pfu)}</span>
        (12,8% d'IR + 17,2% de prélèvements sociaux).
        Si votre taux marginal est inférieur à 12,8%, l'option pour le barème progressif peut être plus avantageuse.
      </p>
    </div>
  `;
}

export function mount(store, navigate) {
  const situationToPartsMap = {
    celibataire: 1,
    couple: 2,
    couple1: 2.5,
    couple2: 3,
    couple3: 4
  };

  const situationSelect = document.getElementById('tax-situation');
  const partsInput = document.getElementById('tax-parts');

  situationSelect?.addEventListener('change', () => {
    const parts = situationToPartsMap[situationSelect.value] || 1;
    partsInput.value = parts;
  });

  document.getElementById('btn-calc-tax')?.addEventListener('click', async () => {
    const revenu = parseNumberInput(document.getElementById('tax-revenu').value);
    const nbParts = parseFloat(partsInput.value) || 1;
    const situation = situationSelect.value;

    store.set('parametres.situationFamiliale', situation);
    store.set('parametres.nbParts', nbParts);

    const result = await computeTax(revenu, nbParts);
    if (!result) {
      document.getElementById('tax-results').innerHTML = '<p class="text-red-500">Erreur lors du calcul.</p>';
      return;
    }

    taxResult = result;
    document.getElementById('tax-results').innerHTML = renderResults(result);

    // Chart
    if (document.getElementById('chart-tax-tranches')) {
      const tranches = result.tranches;
      createChart('chart-tax-tranches', {
        type: 'bar',
        data: {
          labels: tranches.map(t => `${formatPercent(t.taux)}`),
          datasets: [{
            label: 'Plafond de tranche',
            data: tranches.map(t => t.max || 250000),
            backgroundColor: tranches.map((t, i) => PALETTE[i]),
            borderRadius: 6
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const t = tranches[ctx.dataIndex];
                  return `${formatCurrency(t.min)} - ${t.max ? formatCurrency(t.max) : '∞'} → ${formatPercent(t.taux)}`;
                }
              }
            }
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: COLORS.grid },
              ticks: {
                callback: v => new Intl.NumberFormat('fr-FR', { notation: 'compact', style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
              }
            }
          }
        }
      });
    }
  });

  // Auto-calculate on load
  document.getElementById('btn-calc-tax')?.click();
}
