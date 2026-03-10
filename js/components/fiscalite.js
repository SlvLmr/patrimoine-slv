export function render(store) {
  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-100">Fiscalité</h1>
      <div class="card-dark rounded-xl p-8 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-600 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-gray-300 mb-2">Section en construction</h2>
        <p class="text-gray-500 text-sm">Cette section sera bientôt disponible pour simuler votre fiscalité en détail.</p>
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  // Will be implemented later
}
