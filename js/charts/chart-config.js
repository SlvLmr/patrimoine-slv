const chartInstances = new Map();

// Plugin to draw strikethrough on hidden legend labels (used per-chart, not globally)
export const legendStrikethroughPlugin = {
  id: 'legendStrikethrough',
  afterDraw(chart) {
    const legend = chart.legend;
    if (!legend || !legend.legendItems) return;
    const ctx = chart.ctx;
    legend.legendItems.forEach((item, i) => {
      const meta = chart.getDatasetMeta(i);
      if (!meta.hidden) return;
      const hitBox = legend.legendHitBoxes[i];
      if (!hitBox) return;
      const textX = hitBox.left + 14;
      const textEndX = hitBox.left + hitBox.width;
      const y = hitBox.top + hitBox.height / 2;
      ctx.save();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(textX, y);
      ctx.lineTo(textEndX, y);
      ctx.stroke();
      ctx.restore();
    });
  }
};


// Palette canonique des actifs — UNIQUE source de vérité pour associer
// un support (PEA ETF, CTO, Crypto…) à sa couleur, partout dans l'app.
export const ASSET_COLORS = {
  'PEA ETF':       { color: '#3b82f6', text: 'text-blue-400',    bg: 'bg-blue-500/15',    bgSoft: 'bg-blue-500/5',    border: 'border-blue-500/30',    borderSoft: 'border-blue-500/20',    dot: 'bg-blue-400' },
  'PEA Actions':   { color: '#f59e0b', text: 'text-amber-400',   bg: 'bg-amber-500/15',   bgSoft: 'bg-amber-500/5',   border: 'border-amber-500/30',   borderSoft: 'border-amber-500/20',   dot: 'bg-amber-400' },
  'PEA Autre':     { color: '#eab308', text: 'text-yellow-400',  bg: 'bg-yellow-500/15',  bgSoft: 'bg-yellow-500/5',  border: 'border-yellow-500/30',  borderSoft: 'border-yellow-500/20',  dot: 'bg-yellow-400' },
  'Assurance Vie': { color: '#06b6d4', text: 'text-cyan-400',    bg: 'bg-cyan-500/15',    bgSoft: 'bg-cyan-500/5',    border: 'border-cyan-500/30',    borderSoft: 'border-cyan-500/20',    dot: 'bg-cyan-400' },
  'CTO':           { color: '#a855f7', text: 'text-purple-400',  bg: 'bg-purple-500/15',  bgSoft: 'bg-purple-500/5',  border: 'border-purple-500/30',  borderSoft: 'border-purple-500/20',  dot: 'bg-purple-400' },
  'CTO TR':        { color: '#a855f7', text: 'text-purple-400',  bg: 'bg-purple-500/15',  bgSoft: 'bg-purple-500/5',  border: 'border-purple-500/30',  borderSoft: 'border-purple-500/20',  dot: 'bg-purple-400' },
  'CTO BB':        { color: '#c084fc', text: 'text-violet-400',  bg: 'bg-violet-500/15',  bgSoft: 'bg-violet-500/5',  border: 'border-violet-500/30',  borderSoft: 'border-violet-500/20',  dot: 'bg-violet-400' },
  'Crypto':        { color: '#f97316', text: 'text-orange-400',  bg: 'bg-orange-500/15',  bgSoft: 'bg-orange-500/5',  border: 'border-orange-500/30',  borderSoft: 'border-orange-500/20',  dot: 'bg-orange-400' },
  'PEE':           { color: '#14b8a6', text: 'text-teal-400',    bg: 'bg-teal-500/15',    bgSoft: 'bg-teal-500/5',    border: 'border-teal-500/30',    borderSoft: 'border-teal-500/20',    dot: 'bg-teal-400' },
  'PER':           { color: '#ec4899', text: 'text-pink-400',    bg: 'bg-pink-500/15',    bgSoft: 'bg-pink-500/5',    border: 'border-pink-500/30',    borderSoft: 'border-pink-500/20',    dot: 'bg-pink-400' },
  'Or':            { color: '#eab308', text: 'text-yellow-400',  bg: 'bg-yellow-500/15',  bgSoft: 'bg-yellow-500/5',  border: 'border-yellow-500/30',  borderSoft: 'border-yellow-500/20',  dot: 'bg-yellow-400' },
  'Argent':        { color: '#94a3b8', text: 'text-slate-400',   bg: 'bg-slate-400/15',   bgSoft: 'bg-slate-400/5',   border: 'border-slate-400/30',   borderSoft: 'border-slate-400/20',   dot: 'bg-slate-400' },
  'Livrets':       { color: '#38bdf8', text: 'text-sky-400',     bg: 'bg-sky-500/15',     bgSoft: 'bg-sky-500/5',     border: 'border-sky-500/30',     borderSoft: 'border-sky-500/20',     dot: 'bg-sky-400' },
  'Autre':         { color: '#9ca3af', text: 'text-gray-400',    bg: 'bg-gray-500/15',    bgSoft: 'bg-gray-500/5',    border: 'border-gray-500/30',    borderSoft: 'border-gray-500/20',    dot: 'bg-gray-400' },
};

export const COLORS = {
  immobilier: '#7c3aed',
  placements: '#c084fc',
  epargne: '#e9d5ff',
  dette: '#ff4757',
  patrimoine: '#e9d5ff',
  revenus: '#c084fc',
  depenses: '#ff4757',
  primary: '#c084fc',
  secondary: '#9b7cb8',
  grid: 'rgba(72, 72, 82, 0.25)',
  gridText: '#7a7a88',
  actions: '#d8b4fe',
  etf: '#c084fc',
  crypto: '#f59e0b',
  obligations: '#6b8aae'
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
  '#c084fc', '#d8b4fe', '#9b7cb8', '#6b8aae', '#e9d5ff',
  '#5ea3a3', '#f59e0b', '#a855f7', '#7c3aed', '#e9d5ff'
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
        backgroundColor: 'rgba(30, 30, 40, 0.95)',
        titleColor: '#e9d5ff',
        bodyColor: '#a0a0a5',
        borderColor: 'rgba(72, 72, 82, 0.6)',
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
