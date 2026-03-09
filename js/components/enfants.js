export function render(store) {
  return `
    <div class="space-y-6">
      <h1 class="text-2xl font-bold text-gray-100">Enfants</h1>
      <div class="card-dark rounded-xl p-8 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-600 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-gray-300 mb-2">Section en construction</h2>
        <p class="text-gray-500 text-sm">Cette section sera bientôt disponible pour configurer les paramètres liés à vos enfants.</p>
      </div>
    </div>
  `;
}

export function mount(store, navigate) {
  // Will be implemented later
}
