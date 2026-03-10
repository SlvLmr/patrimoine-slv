import { formatCurrency, formatDate, openModal, inputField, selectField, getFormData } from '../utils.js';

const CATEGORIES = [
  'Alimentation', 'Achats divers', 'Santé', 'Vêtements',
  'Loisirs - Plaisirs', 'Petits travaux', 'Autre - Imprévu'
];

const COMPTES = ['CIC', 'Trade Republic'];

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

  // Archive data
  const archives = store.get('archiveDepenses') || [];
  const currentYear = new Date().getFullYear().toString();

  // Cumulé annuel = archives de cette année + dépenses du mois en cours
  const yearArchives = archives.filter(a => a.mois.startsWith(currentYear));
  const yearArchiveTotal = yearArchives.reduce((s, a) => s + (a.total || 0), 0);
  const yearTotal = yearArchiveTotal + monthTotal;
  const yearCount = yearArchives.reduce((s, a) => s + (a.count || 0), 0) + monthItems.length;

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-100">Suivi Live</h1>
        <button id="btn-add-expense" class="px-4 py-2 bg-gradient-to-r from-accent-red to-accent-red text-white text-sm rounded-lg hover:opacity-90 transition font-medium">+ Ajouter une dépense</button>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Aujourd'hui</p>
          <p class="text-2xl font-bold text-accent-red">${formatCurrency(todayTotal)}</p>
          <p class="text-xs text-gray-500 mt-1">${todayItems.length} dépense${todayItems.length > 1 ? 's' : ''}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">${monthLabel}</p>
          <p class="text-2xl font-bold text-accent-amber">${formatCurrency(monthTotal)}</p>
          <p class="text-xs text-gray-500 mt-1">${monthItems.length} dépense${monthItems.length > 1 ? 's' : ''}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Moy. journalière (mois)</p>
          <p class="text-2xl font-bold text-gray-200">${formatCurrency(monthItems.length > 0 ? monthTotal / new Date().getDate() : 0)}</p>
        </div>
        <div class="card-dark rounded-xl p-5 kpi-card">
          <p class="text-sm text-gray-400 mb-2">Cumulé ${currentYear}</p>
          <p class="text-2xl font-bold text-purple-400">${formatCurrency(yearTotal)}</p>
          <p class="text-xs text-gray-500 mt-1">${yearCount} dépense${yearCount > 1 ? 's' : ''}</p>
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
                <div class="h-full bg-gradient-to-r from-accent-red to-accent-amber rounded-full" style="width:${pct}%"></div>
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
                <span class="text-xs text-gray-500">${i.categorie || ''}${i.compte ? ` · ${i.compte}` : ''}</span>
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

      ${months.length === 0 && archives.length === 0 ? `
      <div class="card-dark rounded-xl p-8 text-center">
        <p class="text-gray-500">Aucune dépense enregistrée. Cliquez sur "+ Ajouter une dépense" pour commencer.</p>
      </div>
      ` : ''}

      ${archives.length > 0 ? `
      <!-- Archives -->
      <details class="card-dark rounded-xl group">
        <summary class="flex items-center justify-between px-5 py-4 cursor-pointer select-none">
          <h2 class="text-sm font-semibold text-gray-400">Archives mensuelles</h2>
          <svg class="w-4 h-4 text-gray-600 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </summary>
        <div class="divide-y divide-dark-400/20">
          ${archives.sort((a, b) => b.mois.localeCompare(a.mois)).map(a => {
            const label = new Date(a.mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            const cats = Object.entries(a.categories || {}).sort((x, y) => y[1] - x[1]);
            return `
          <div class="px-5 py-3">
            <div class="flex justify-between items-center mb-1">
              <span class="text-sm text-gray-300 capitalize">${label}</span>
              <div class="flex items-center gap-3">
                <span class="text-xs text-gray-500">${a.count} dépense${a.count > 1 ? 's' : ''}</span>
                <span class="text-sm font-semibold text-accent-red">${formatCurrency(a.total)}</span>
              </div>
            </div>
            ${cats.length > 0 ? `<div class="flex flex-wrap gap-1 mt-1">${cats.map(([cat, val]) =>
              `<span class="text-[10px] px-1.5 py-0.5 rounded bg-dark-600/50 text-gray-500">${cat} ${formatCurrency(val)}</span>`
            ).join('')}</div>` : ''}
          </div>`;
          }).join('')}
        </div>
      </details>
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
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-300 mb-1.5">Compte</label>
        <div class="flex gap-3">
          ${COMPTES.map((c, i) => `
            <label class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dark-400/50 bg-dark-800 hover:border-accent-blue/40 transition has-[:checked]:border-accent-blue has-[:checked]:bg-accent-blue/10">
              <input type="radio" name="compte" value="${c}" ${i === 0 ? 'checked' : ''} class="w-4 h-4 text-accent-blue bg-dark-800 border-dark-400 focus:ring-accent-blue/40">
              <span class="text-sm text-gray-200">${c}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    openModal('Ajouter une dépense', body, () => {
      const data = getFormData(document.getElementById('modal-body'));
      data.compte = document.querySelector('input[name="compte"]:checked')?.value || COMPTES[0];
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
