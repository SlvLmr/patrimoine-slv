const chartInstances = new Map();

export const COLORS = {
  immobilier: '#8b6914',
  placements: '#c9a76c',
  epargne: '#e8d5b0',
  dette: '#ff4757',
  patrimoine: '#e8d5b0',
  revenus: '#c9a76c',
  depenses: '#ff4757',
  primary: '#c9a76c',
  secondary: '#b8976c',
  grid: 'rgba(56, 56, 63, 0.25)',
  gridText: '#6b6b75',
  actions: '#dbb88a',
  etf: '#c9a76c',
  crypto: '#f59e0b',
  obligations: '#a08553'
};

// Warm gradient pairs for charts
export const GRADIENT_PAIRS = [
  ['#3b82f6', '#60a5fa'],   // blue
  ['#f59e0b', '#fbbf24'],   // amber
  ['#a855f7', '#c084fc'],   // purple
  ['#06b6d4', '#22d3ee'],   // cyan
  ['#ec4899', '#f472b6'],   // pink
  ['#f97316', '#fb923c'],   // orange
  ['#6366f1', '#818cf8'],   // indigo
  ['#14b8a6', '#2dd4bf'],   // teal
];

export const PALETTE = [
  '#c9a76c', '#dbb88a', '#b8976c', '#a08553', '#e8d5b0',
  '#d4b07a', '#f59e0b', '#c4985a', '#8b7355', '#d9c4a0'
];

// Vivid, high-contrast palette for multi-line charts (no green/red)
export const VIVID_PALETTE = [
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#eab308', // yellow
  '#8b5cf6', // violet
];

// Create vertical gradient for line/area fills
export function createVerticalGradient(ctx, color, alphaTop = 0.4, alphaBottom = 0.0) {
  const canvas = ctx.canvas || ctx;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 300);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  gradient.addColorStop(0, `rgba(${r},${g},${b},${alphaTop})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},${alphaBottom})`);
  return gradient;
}

// Create gradient between two colors for pie/doughnut slices
export function createSliceGradient(ctx, color1, color2) {
  const canvas = ctx.canvas || ctx;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width || 300, canvas.height || 300);
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
      duration: 1000,
      easing: 'easeInOutQuart'
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          color: '#e5e7eb',
          font: { size: 12, family: 'Inter' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(11, 11, 15, 0.95)',
        titleColor: '#e8d5b0',
        bodyColor: '#a0a0a5',
        borderColor: 'rgba(56, 56, 63, 0.6)',
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
