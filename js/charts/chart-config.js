const chartInstances = new Map();

export const COLORS = {
  immobilier: '#a855f7',
  placements: '#00d4aa',
  epargne: '#f59e0b',
  dette: '#ff4757',
  patrimoine: '#5b7fff',
  revenus: '#00d4aa',
  depenses: '#ff4757',
  primary: '#5b7fff',
  secondary: '#a855f7',
  grid: 'rgba(58, 58, 98, 0.25)',
  gridText: '#6b6b8d',
  actions: '#06d6a0',
  etf: '#38bdf8',
  crypto: '#f97316',
  obligations: '#818cf8'
};

// Vibrant gradient pairs for charts (like the reference image)
export const GRADIENT_PAIRS = [
  ['#00d4aa', '#38bdf8'],   // green → cyan
  ['#a855f7', '#ec4899'],   // purple → pink
  ['#f59e0b', '#ff4757'],   // amber → red
  ['#5b7fff', '#a855f7'],   // blue → purple
  ['#06d6a0', '#00d4aa'],   // teal → green
  ['#ec4899', '#f97316'],   // pink → orange
  ['#38bdf8', '#5b7fff'],   // cyan → blue
  ['#f97316', '#f59e0b'],   // orange → amber
];

export const PALETTE = [
  '#a855f7', '#00d4aa', '#f59e0b', '#ff4757', '#5b7fff',
  '#38bdf8', '#ec4899', '#06d6a0', '#f97316', '#818cf8'
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
