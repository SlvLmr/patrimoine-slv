/**
 * PDF Export for Projection page
 * Uses jsPDF + jsPDF-AutoTable loaded from CDN
 */

const CDN_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
const CDN_AUTOTABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js';

let loaded = false;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureLibs() {
  if (loaded) return;
  await loadScript(CDN_JSPDF);
  await loadScript(CDN_AUTOTABLE);
  loaded = true;
}

function fmt(v) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
}

function fmtPct(v) {
  return (v * 100).toFixed(1) + '%';
}

// Dark theme colors
const DARK_BG = [24, 24, 32];       // page background
const CARD_BG = [32, 32, 44];       // card / header bg
const ROW_ALT = [28, 28, 38];       // alternating rows
const TEXT_LIGHT = [230, 230, 240];  // primary text
const TEXT_DIM = [140, 140, 160];    // secondary text
const ACCENT_GREEN = [74, 222, 128];
const ACCENT_AMBER = [251, 191, 36];
const ACCENT_ORANGE = [251, 146, 60];
const ACCENT_LILAC = [192, 132, 252];
const BORDER = [50, 50, 65];

export async function exportProjectionPDF(store, computeProjection, formatCurrency, getPlacementGroupKey) {
  await ensureLibs();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  // ── Compute data ──
  const state = store.getAll();
  const params = state.parametres || {};
  const snapshots = computeProjection(store);
  const groupKeys = snapshots.groupKeys || [];
  const placements = state.actifs?.placements || [];

  // FIRE data
  const fireSwr = (params.swr || 4) / 100;
  const fireDepBase = (params.fireDepensesMensuelles || 1750) * 12;
  const fireInflation = params.inflationRate || 0.02;
  const firePensionLegal = (params.pensionTauxLegal || 2442) * 12;
  const firePensionPlein = (params.pensionTauxPlein || 2642) * 12;
  const fireAgeLegal = params.ageRetraiteTauxLegal || 64;
  const fireAgePlein = params.ageRetraiteTauxPlein || 65;
  let fireFirstIdx = -1;
  const fireData = snapshots.map((s, idx) => {
    const depenses = fireDepBase * Math.pow(1 + fireInflation, s.annee);
    const rente = s.totalLiquiditesNettes * fireSwr;
    let pension = 0;
    if (s.age >= fireAgePlein) pension = firePensionPlein;
    else if (s.age >= fireAgeLegal) pension = firePensionLegal;
    const totalRevenu = rente + pension;
    const couverture = depenses > 0 ? totalRevenu / depenses : 0;
    const isFire = couverture >= 1;
    if (isFire && fireFirstIdx === -1) fireFirstIdx = idx;
    return { rente, pension, depenses, couverture, isFire };
  });

  // ── Helper: dark background on every page ──
  function drawPageBg() {
    doc.setFillColor(...DARK_BG);
    doc.rect(0, 0, pageW, pageH, 'F');
  }

  // ── Helper: section title ──
  function sectionTitle(y, title) {
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(margin, y, pageW - 2 * margin, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT_LILAC);
    doc.text(title, margin + 4, y + 5.5);
    return y + 12;
  }

  // ══════════════════════════════════════════════════
  // PAGE 1 — Header + Summary + Parameters
  // ══════════════════════════════════════════════════
  drawPageBg();

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...ACCENT_LILAC);
  const userInfo = state.userInfo || {};
  const prenom = (userInfo.prenom || '').trim() || 'Mon';
  doc.text(`${prenom} — Projection patrimoniale`, margin, 15);

  // Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DIM);
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — Horizon ${params.projectionYears || 30} ans`, margin, 21);

  // ── Parameters summary ──
  let y = 28;
  y = sectionTitle(y, 'PARAMETRES');

  const paramLines = [
    ['Horizon', `${params.projectionYears || 30} ans`],
    ['Age actuel', `${params.ageFinAnnee || 43} ans`],
    ['Inflation', `${((params.inflationRate || 0) * 100).toFixed(1)}%`],
    ['Age retraite', `${params.ageRetraite || 64} ans`],
    ['Pension legale', `${fmt(firePensionLegal)} /an (${fireAgeLegal} ans)`],
    ['Pension taux plein', `${fmt(firePensionPlein)} /an (${fireAgePlein} ans)`],
    ['SWR (FIRE)', `${(fireSwr * 100).toFixed(1)}%`],
    ['Depenses mensuelles', `${fmt(fireDepBase / 12)} /mois`],
  ];

  doc.setFontSize(8.5);
  const colW = (pageW - 2 * margin) / 4;
  paramLines.forEach((p, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = margin + col * colW;
    const py = y + row * 5;
    doc.setTextColor(...TEXT_DIM);
    doc.text(p[0], x, py + 3.5);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(p[1], x + 35, py + 3.5);
  });
  y += Math.ceil(paramLines.length / 4) * 5 + 4;

  // ── Placements list ──
  y = sectionTitle(y, 'PLACEMENTS');

  const rendementPlacements = params.rendementPlacements || {};
  const placRows = placements.map(p => {
    const gk = getPlacementGroupKey(p);
    const rend = rendementPlacements[p.id] !== undefined ? rendementPlacements[p.id] : (Number(p.rendement) || 0.05);
    const val = Number(p.valeur) || Number(p.apport) || 0;
    const dca = Number(p.dcaMensuel) || 0;
    return [p.nom || '?', gk, fmt(val), dca > 0 ? dca + ' €/m' : '-', (rend * 100).toFixed(1) + '%'];
  });

  doc.autoTable({
    startY: y,
    head: [['Placement', 'Enveloppe', 'Valeur', 'DCA', 'Rend.']],
    body: placRows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      textColor: TEXT_LIGHT,
      cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 },
    },
    headStyles: {
      fillColor: CARD_BG,
      textColor: ACCENT_LILAC,
      fontSize: 7,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 55 },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });
  y = doc.lastAutoTable.finalY + 4;

  // ── Summary KPIs ──
  y = sectionTitle(y, 'RESUME');

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const kpis = [
    ['Patrimoine initial', fmt(first?.patrimoineNet || 0)],
    ['Patrimoine final', fmt(last?.patrimoineNet || 0)],
    ['Immo. final', fmt(last?.immobilier || 0)],
    ['Liquidites finales', fmt(last?.totalLiquiditesNettes || 0)],
    ['Interets cumules', fmt(last?.interetsCumules || 0)],
    ['Impots cumules', fmt(last?.totalTaxes || 0)],
  ];

  doc.setFontSize(8.5);
  kpis.forEach((k, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * ((pageW - 2 * margin) / 3);
    const py = y + row * 6;
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(x, py, (pageW - 2 * margin) / 3 - 3, 5, 1, 1, 'F');
    doc.setTextColor(...TEXT_DIM);
    doc.text(k[0], x + 2, py + 3.5);
    doc.setTextColor(...ACCENT_GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text(k[1], x + (pageW - 2 * margin) / 3 - 5, py + 3.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  });
  y += Math.ceil(kpis.length / 3) * 6 + 4;

  // ── FIRE summary ──
  if (fireFirstIdx >= 0) {
    y = sectionTitle(y, 'FIRE');
    const fs = snapshots[fireFirstIdx];
    const fd = fireData[fireFirstIdx];
    const fireKpis = [
      ['Date FIRE', `${fs.calendarYear} (${fs.age} ans)`],
      ['Patrimoine necessaire', fmt(fd.depenses / fireSwr)],
      ['Patrimoine au FIRE', fmt(fs.totalLiquiditesNettes)],
      ['Rente annuelle', fmt(fd.rente + fd.pension)],
    ];
    doc.setFontSize(8.5);
    fireKpis.forEach((k, i) => {
      const x = margin + i * ((pageW - 2 * margin) / 4);
      doc.setFillColor(60, 30, 10);
      doc.roundedRect(x, y, (pageW - 2 * margin) / 4 - 3, 5, 1, 1, 'F');
      doc.setTextColor(...TEXT_DIM);
      doc.text(k[0], x + 2, y + 3.5);
      doc.setTextColor(...ACCENT_ORANGE);
      doc.setFont('helvetica', 'bold');
      doc.text(k[1], x + (pageW - 2 * margin) / 4 - 5, y + 3.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    });
    y += 10;
  }

  // ══════════════════════════════════════════════════
  // PAGE 2+ — Main projection table
  // ══════════════════════════════════════════════════
  doc.addPage('a4', 'landscape');
  drawPageBg();

  let ty = 8;
  ty = sectionTitle(ty, 'PROJECTION ANNEE PAR ANNEE');

  // Build table columns
  const headers = ['Annee', 'Age', ...groupKeys, 'Apports', 'Gain', 'Net imp.', 'Epargne', 'Herit.', 'Immo.', 'Liq.', 'Rente', 'Dep.', 'FIRE'];

  const bodyRows = snapshots.map((s, sIdx) => {
    const fire = fireData[sIdx];
    const totalGain = s.cashApresImpot - s.totalApports;
    const row = [
      s.calendarYear,
      s.age,
      ...groupKeys.map(gk => s.placementDetail[gk] || 0).map(v => v > 0 ? fmt(v) : '-'),
      fmt(s.totalApports),
      fmt(totalGain),
      fmt(s.cashApresImpot),
      fmt(s.epargne),
      s.heritage > 0 ? fmt(s.heritage) : '-',
      fmt(s.immobilier),
      fmt(s.totalLiquiditesNettes),
      fmt(fire.rente + fire.pension),
      fmt(fire.depenses),
      (fire.couverture * 100).toFixed(0) + '%',
    ];
    return row;
  });

  // Dynamic column widths
  const fixedCols = 2; // Annee, Age
  const placCols = groupKeys.length;
  const dataCols = 10; // Apports..FIRE
  const totalCols = fixedCols + placCols + dataCols;
  const availW = pageW - 2 * margin;
  const baseColW = availW / totalCols;

  const colStyles = {};
  colStyles[0] = { cellWidth: 14, halign: 'center' }; // Annee
  colStyles[1] = { cellWidth: 10, halign: 'center' }; // Age
  for (let i = 0; i < placCols; i++) {
    colStyles[fixedCols + i] = { halign: 'right' };
  }
  for (let i = 0; i < dataCols; i++) {
    colStyles[fixedCols + placCols + i] = { halign: 'right' };
  }

  doc.autoTable({
    startY: ty,
    head: [headers],
    body: bodyRows,
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 6,
      textColor: TEXT_LIGHT,
      cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 },
      overflow: 'ellipsize',
    },
    headStyles: {
      fillColor: CARD_BG,
      textColor: ACCENT_LILAC,
      fontSize: 5.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: colStyles,
    didDrawPage: (data) => {
      // Draw dark bg on new pages
      if (data.pageNumber > 1) {
        // bg already drawn via willDrawPage
      }
    },
    willDrawPage: () => {
      drawPageBg();
    },
    didParseCell: (data) => {
      const col = data.column.index;
      const row = data.row.index;
      if (data.section !== 'body') return;

      // Highlight FIRE row
      if (row === fireFirstIdx) {
        data.cell.styles.fillColor = [60, 30, 10];
      }

      // Retirement row
      const s = snapshots[row];
      if (s && s.isRetraite) {
        data.cell.styles.fillColor = [50, 40, 10];
      }

      // FIRE % column coloring
      if (col === headers.length - 1 && row >= 0 && row < fireData.length) {
        const couv = fireData[row].couverture;
        if (couv >= 1) data.cell.styles.textColor = ACCENT_ORANGE;
        else if (couv >= 0.8) data.cell.styles.textColor = ACCENT_AMBER;
        else data.cell.styles.textColor = TEXT_DIM;
      }

      // Liquidités column (bold green)
      const liqCol = fixedCols + placCols + 6; // Liq.
      if (col === liqCol) {
        data.cell.styles.textColor = ACCENT_GREEN;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ══════════════════════════════════════════════════
  // PAGE 3 — Synthèse fiscale
  // ══════════════════════════════════════════════════
  doc.addPage('a4', 'landscape');
  drawPageBg();

  let fy = 8;
  const fiscalSnap = last;
  fy = sectionTitle(fy, `SYNTHESE FISCALE — Fin ${fiscalSnap.calendarYear} (${fiscalSnap.age} ans)`);

  // Build fiscal rows
  const PFU_RATE = params.tauxPFU || 0.314;
  const PS_RATE = params.tauxPS || 0.172;
  const fiscalRows = groupKeys.map(gk => {
    const valeur = fiscalSnap.placementDetail[gk] || 0;
    const apports = fiscalSnap.placementApports[gk] || 0;
    const gains = fiscalSnap.placementGains[gk] || 0;
    const impot = fiscalSnap.placementTaxes[gk] || 0;
    const rate = fiscalSnap.placementTaxRates[gk] || 0;
    let regime = 'PFU 31,4%';
    if (gk.startsWith('PEA')) regime = rate <= PS_RATE + 0.001 ? 'PS 17,2% (>5 ans)' : 'PFU 31,4% (<5 ans)';
    else if (gk === 'Assurance Vie') regime = rate < PFU_RATE ? 'PS+IR 24,7% (>8 ans)' : 'PFU 31,4% (<8 ans)';
    else if (gk === 'PEE') regime = 'PS 17,2%';
    else if (gk === 'Livrets') regime = 'Exonere';
    return [gk, fmt(valeur), fmt(apports), (gains >= 0 ? '+' : '') + fmt(gains), regime, '-' + fmt(impot), fmt(valeur - impot)];
  }).filter(r => r[1] !== fmt(0));

  const totVal = groupKeys.reduce((s, gk) => s + (fiscalSnap.placementDetail[gk] || 0), 0);
  const totAp = groupKeys.reduce((s, gk) => s + (fiscalSnap.placementApports[gk] || 0), 0);
  const totGains = groupKeys.reduce((s, gk) => s + (fiscalSnap.placementGains[gk] || 0), 0);
  const totImpot = groupKeys.reduce((s, gk) => s + (fiscalSnap.placementTaxes[gk] || 0), 0);
  const totNet = totVal - totImpot;

  doc.autoTable({
    startY: fy,
    head: [['Enveloppe', 'Valeur', 'Apports', 'Plus-value', 'Regime fiscal', 'Impot estime', 'Net apres impot']],
    body: fiscalRows,
    foot: [['TOTAL', fmt(totVal), fmt(totAp), (totGains >= 0 ? '+' : '') + fmt(totGains), '', '-' + fmt(totImpot), fmt(totNet)]],
    theme: 'plain',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      textColor: TEXT_LIGHT,
      cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 },
    },
    headStyles: {
      fillColor: CARD_BG,
      textColor: ACCENT_LILAC,
      fontSize: 7.5,
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [40, 40, 55],
      textColor: TEXT_LIGHT,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: { fillColor: ROW_ALT },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'center' },
      5: { halign: 'right', textColor: [248, 113, 113] },
      6: { halign: 'right', fontStyle: 'bold' },
    },
  });

  fy = doc.lastAutoTable.finalY + 6;

  // ── FIRE Withdrawal Strategy ──
  if (fireFirstIdx >= 0) {
    fy = sectionTitle(fy, 'STRATEGIE DE RETRAIT FIRE');

    const refSnap = snapshots[fireFirstIdx] || last;
    const withdrawalOrder = [];
    const epar = refSnap.epargne || 0;
    if (epar > 0) withdrawalOrder.push(['1', 'Epargne (Livrets)', fmt(epar), 'Exonere', '0%', 'Pas de plus-value']);

    const gkData = groupKeys.map(gk => ({
      gk, valeur: refSnap.placementDetail[gk] || 0,
      gains: refSnap.placementGains[gk] || 0,
      rate: refSnap.placementTaxRates[gk] || 0,
    })).filter(g => g.valeur > 0).sort((a, b) => a.rate - b.rate);

    gkData.forEach(g => {
      const ratePct = (g.rate * 100).toFixed(1) + '%';
      let regime = 'PFU';
      if (g.gk.startsWith('PEA')) regime = g.rate < 0.2 ? 'PS seuls (>5a)' : 'PFU (<5a)';
      else if (g.gk === 'Assurance Vie') regime = g.rate < 0.3 ? 'PS+IR (>8a)' : 'PFU (<8a)';
      else if (g.gk === 'PEE') regime = 'PS seuls';
      withdrawalOrder.push([String(withdrawalOrder.length + 1), g.gk, fmt(g.valeur), regime, ratePct, 'Fiscalite favorable']);
    });

    doc.autoTable({
      startY: fy,
      head: [['#', 'Source', 'Valeur', 'Regime', 'Taux', 'Raison']],
      body: withdrawalOrder,
      theme: 'plain',
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        textColor: TEXT_LIGHT,
        cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 },
      },
      headStyles: {
        fillColor: [60, 30, 10],
        textColor: ACCENT_ORANGE,
        fontSize: 7,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        2: { halign: 'right' },
        4: { halign: 'right' },
      },
    });
  }

  // ── Footer on all pages ──
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_DIM);
    doc.text(`Page ${i}/${totalPages}`, pageW - margin, pageH - 5, { align: 'right' });
    doc.text('Patrimoine SLV — Projection', margin, pageH - 5);
  }

  // ── Save ──
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`projection-${dateStr}.pdf`);
}
