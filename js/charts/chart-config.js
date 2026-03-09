const chartInstances = new Map();

export const COLORS = {
  immobilier: '#a855f7',    // purple
  placements: '#00d4aa',    // green accent
  epargne: '#f59e0b',       // amber
  dette: '#ff4757',         // red
  patrimoine: '#5b7fff',    // blue accent
  revenus: '#00d4aa',       // green
  depenses: '#ff4757',      // red
  primary: '#5b7fff',
  secondary: '#a855f7',
  grid: 'rgba(58, 58, 98, 0.3)',
  gridText: '#6b6b8d',
  actions: '#06d6a0',
  etf: '#38bdf8',
  crypto: '#f97316',
  obligations: '#818cf8'
};

export const PALETTE = [
  '#a855f7', '#00d4aa', '#f59e0b', '#ff4757', '#5b7fff',
  '#38bdf8', '#ec4899', '#06d6a0', '#f97316', '#818cf8'
];

// Create gradient helper for charts
export function createGradient(ctx, color1, color2, height = 300) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

export function createChart(canvasId, config) {
  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
    chartInstances.delete(canvasId);
  }

  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const defaults = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: 'easeInOutQuart'
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10,
          color: '#8888aa',
          font: { size: 12, family: 'Inter' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(10, 10, 26, 0.95)',
        titleColor: '#e0e0f0',
        bodyColor: '#a0a0c0',
        borderColor: 'rgba(58, 58, 98, 0.6)',
        borderWidth: 1,
        titleFont: { size: 13, family: 'Inter', weight: '600' },
        bodyFont: { size: 12, family: 'Inter' },
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
        callbacks: {
          label: function(ctx) {
            const value = ctx.parsed.y ?? ctx.parsed ?? ctx.raw;
            return ` ${ctx.dataset.label || ctx.label}: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)}`;
          }
        }
      }
    }
  };

  const mergedConfig = {
    ...config,
    options: {
      ...defaults,
      ...config.options,
      plugins: {
        ...defaults.plugins,
        ...(config.options?.plugins || {})
      }
    }
  };

  const instance = new Chart(canvas, mergedConfig);
  chartInstances.set(canvasId, instance);
  return instance;
}

export function destroyChart(canvasId) {
  if (chartInstances.has(canvasId)) {
    chartInstances.get(canvasId).destroy();
    chartInstances.delete(canvasId);
  }
}

export function destroyAllCharts() {
  chartInstances.forEach(instance => instance.destroy());
  chartInstances.clear();
}
