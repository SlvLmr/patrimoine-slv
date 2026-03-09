import { formatCurrency, formatDate, openModal, inputField, selectField, getFormData } from '../utils.js';

const CATEGORIES = [
  'Alimentation', 'Transport', 'Logement', 'Santé', 'Loisirs',
  'Shopping', 'Restaurant', 'Abonnements', 'Éducation', 'Autre'
];

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function render(store) {
  if (!store.get('suiviDepenses')) store.set('suiviDepenses', []);
  const items = store.get('suiviDepenses') || [];
  const today = getToday();
  const currentMonth = getMonthKey(today);

  // Group by month
  const byMonth = {};
  items.forEach(item => {
    const mk = getMonthKey(item.date);
    if (!byMonth[mk]) byMonth[mk] = [];
    byMonth[mk].push(item);
  });

  // Sort months descending
  const months = Object.keys(byMonth).sort((a, b) => b.localeCompare(a));

  // Today's total
  const todayItems = items.filter(i => i.date === today);
  const todayTotal = todayItems.reduce((s, i) => s + (Number(i.montant) || 0), 0);

  // This month total
  const monthItems = byMonth[currentMonth] || [];
  const monthTotal = monthItems.reduce((s, i) => s + (Number(i.montant) || 0), 0);

  // Category breakdown for current month
  const catBreakdown = {};
  monthItems.forEach(i => {
    const cat = i.categorie || 'Autre';
    catBreakdown[cat] = (catBreakdown[cat] || 0) + (Number(i.montant) || 0);
  });

  const monthLabel = new Date(currentMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-100">Suivi de dépenses</h1>
        <button id="btn-add-expense" class="px-4 py-2 bg-gradient-to-r from-accent-red to-rose-500 text-white text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter une dépense</button>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Aujourd'hui</p>
          <p class="text-2xl font-bold text-accent-red">${formatCurrency(todayTotal)}</p>
          <p class="text-xs text-gray-500 mt-1">${todayItems.length} dépense${todayItems.length > 1 ? 's' : ''}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">${monthLabel}</p>
          <p class="text-2xl font-bold text-amber-400">${formatCurrency(monthTotal)}</p>
          <p class="text-xs text-gray-500 mt-1">${monthItems.length} dépense${monthItems.length > 1 ? 's' : ''}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Moy. journalière (mois)</p>
          <p class="text-2xl font-bold text-gray-200">${formatCurrency(monthItems.length > 0 ? monthTotal / new Date().getDate() : 0)}</p>
        </div>
      </div>

      <!-- Category breakdown -->
      ${Object.keys(catBreakdown).length > 0 ? `
      <div class="card-dark rounded-xl p-5">
        <h2 class="text-sm font-semibold text-gray-300 mb-3">Répartition du mois</h2>
        <div class="space-y-2">
          ${Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
            const pct = monthTotal > 0 ? (total / monthTotal * 100) : 0;
            return `
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-400 w-24 truncate">${cat}</span>
              <div class="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-accent-red to-amber-400 rounded-full" style="width:${pct}%"></div>
              </div>
              <span class="text-xs font-medium text-gray-300 w-20 text-right">${formatCurrency(total)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Expense list by month -->
      ${months.map(mk => {
        const mItems = byMonth[mk].sort((a, b) => b.date.localeCompare(a.date) || b.id?.localeCompare(a.id));
        const mTotal = mItems.reduce((s, i) => s + (Number(i.montant) || 0), 0);
        const label = new Date(mk + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        return `
      <div class="card-dark rounded-xl overflow-hidden">
        <div class="p-4 border-b border-dark-400/30 flex justify-between items-center">
          <h2 class="text-sm font-semibold text-gray-300 capitalize">${label}</h2>
          <span class="text-sm font-semibold text-accent-red">${formatCurrency(mTotal)}</span>
        </div>
        <div class="divide-y divide-dark-400/20">
          ${mItems.map(i => `
          <div class="flex items-center justify-between px-4 py-3 hover:bg-dark-600/30 transition group">
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-500 w-16">${formatDate(i.date)}</span>
              <div>
                <p class="text-sm text-gray-200">${i.description || '—'}</p>
                <span class="text-xs text-gray-500">${i.categorie || ''}</span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-accent-red">-${formatCurrency(i.montant)}</span>
              <button data-del-expense="${i.id}" class="opacity-0 group-hover:opacity-100 text-accent-red/60 hover:text-accent-red text-xs transition">Suppr.</button>
            </div>
          </div>
          `).join('')}
        </div>
      </div>`;
      }).join('')}

      ${months.length === 0 ? `
      <div class="card-dark rounded-xl p-8 text-center">
        <p class="text-gray-500">Aucune dépense enregistrée. Cliquez sur "+ Ajouter une dépense" pour commencer.</p>
      </div>
      ` : ''}
    </div>
  `;
}

export function mount(store, navigate) {
  document.getElementById('btn-add-expense')?.addEventListener('click', () => {
    const body = `
      ${inputField('date', 'Date', getToday(), 'date')}
      ${inputField('description', 'Description', '', 'text', 'placeholder="Ex: Courses Carrefour"')}
      ${selectField('categorie', 'Catégorie', CATEGORIES)}
      ${inputField('montant', 'Montant (€)', '', 'number', 'step="0.01" placeholder="Ex: 45.50"')}
    `;
    openModal('Ajouter une dépense', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      const items = store.get('suiviDepenses') || [];
      items.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
      store.set('suiviDepenses', items);
      navigate('suivi-depenses');
    });
  });

  document.querySelectorAll('[data-del-expense]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.delExpense;
      const items = (store.get('suiviDepenses') || []).filter(i => i.id !== id);
      store.set('suiviDepenses', items);
      navigate('suivi-depenses');
    });
  });
}
