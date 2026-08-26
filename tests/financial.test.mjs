// Tests des calculs financiers d'Horizon — sans build ni dépendance.
// Lancer :  node --test tests/
// Ces tests vérifient des INVARIANTS (relations toujours vraies), pas des
// valeurs absolues, pour rester stables quel que soit le mois d'exécution.
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeProjection, parseNumberInput, getDcaForYear } from '../js/utils.js';

const CUR_YEAR = new Date().getFullYear();

function makeStore(patch = {}) {
  const state = {
    parametres: {
      projectionYears: 10,
      inflationRate: 0.02,
      ageFinAnnee: 40,
      ageRetraite: 64,
      rendementImmobilier: 0.02,
      rendementPlacements: {},
      rendementGroupes: {},
      actualisations: {},
      ...(patch.parametres || {}),
    },
    actifs: {
      immobilier: [],
      placements: [],
      epargne: [],
      comptesCourants: [],
      ...(patch.actifs || {}),
    },
    passifs: { emprunts: [], ...(patch.passifs || {}) },
    revenus: patch.revenus || [],
    depenses: patch.depenses || [],
    heritage: patch.heritage || [],
    surplusAnnuel: patch.surplusAnnuel || [],
    mouvementsParAnnee: patch.mouvementsParAnnee || {},
    actualisationsMensuelles: {},
  };
  for (const k of Object.keys(patch)) {
    if (!['parametres', 'actifs', 'passifs'].includes(k)) state[k] = patch[k];
  }
  return { getAll: () => state };
}

// ---------- parseNumberInput ----------
test('parseNumberInput : formats français et cas limites', () => {
  assert.equal(parseNumberInput('1234,56'), 1234.56);
  assert.equal(parseNumberInput('1 234,56'), 1234.56);
  assert.equal(parseNumberInput('1000'), 1000);
  assert.equal(parseNumberInput(''), 0);
  assert.equal(parseNumberInput('abc'), 0);
  assert.equal(parseNumberInput(12.345), 12.35); // arrondi au centime
});

// ---------- getDcaForYear ----------
test('getDcaForYear : montant de base, fin de DCA, overrides', () => {
  const p = { dcaMensuel: 100 };
  assert.equal(getDcaForYear(p, CUR_YEAR), 100);
  const pFin = { dcaMensuel: 100, dcaFinAnnee: CUR_YEAR + 2 };
  assert.equal(getDcaForYear(pFin, CUR_YEAR + 1), 100);
  assert.equal(getDcaForYear(pFin, CUR_YEAR + 5), 0, 'après dcaFinAnnee le DCA doit être nul');
  const pOv = { dcaMensuel: 100, dcaOverrides: [{ fromYear: CUR_YEAR + 3, endYear: CUR_YEAR + 4, dcaMensuel: 250 }] };
  assert.equal(getDcaForYear(pOv, CUR_YEAR + 3), 250, "l'override doit s'appliquer dans sa fenêtre");
  // Comportement actuel du moteur : un override s'applique « à partir de fromYear »
  // et PERSISTE au-delà de son endYear (endYear n'est pas lu par getDcaForYear).
  assert.equal(getDcaForYear(pOv, CUR_YEAR + 6), 250, "comportement actuel : l'override persiste après endYear");
  assert.equal(getDcaForYear(pOv, CUR_YEAR + 1), 100, 'avant fromYear, DCA de base');
});

// ---------- computeProjection : invariants ----------
test('projection : sans DCA, aucun apport fantôme et croissance des valeurs', () => {
  const store = makeStore({
    actifs: {
      placements: [{ id: 'p1', nom: 'ETF Monde', enveloppe: 'PEA', categorie: 'ETF', valeur: 10000, dcaMensuel: 0 }],
      immobilier: [], epargne: [], comptesCourants: [],
    },
  });
  const snaps = computeProjection(store);
  assert.ok(snaps.length >= 10);
  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  // Sans DCA ni injection, les apports restent constants (la valeur initiale compte comme apport)
  assert.equal(last.totalApports, first.totalApports, 'les apports ne doivent pas bouger sans DCA');
  assert.ok(last.placements > first.placements, 'les placements doivent croître avec le rendement');
});

test('projection : le plafond des apports PEA (150 000 €) est respecté', () => {
  const store = makeStore({
    actifs: {
      placements: [{ id: 'p1', nom: 'ETF PEA', enveloppe: 'PEA', categorie: 'ETF', valeur: 100000, dcaMensuel: 5000 }],
      immobilier: [], epargne: [], comptesCourants: [],
    },
    parametres: { projectionYears: 20 },
  });
  const snaps = computeProjection(store);
  const last = snaps[snaps.length - 1];
  // Apports PEA = valeur initiale (100k) + DCA versés, plafonnés à 150k au total
  const apportsPEA = last.placementApports['PEA ETF'] ?? Object.values(last.placementApports)[0];
  assert.ok(apportsPEA <= 150000 + 1, `apports PEA ${apportsPEA} > plafond 150 000`);
});

test("projection : l'Assurance Vie est taxée aux prélèvements sociaux seuls", () => {
  const store = makeStore({
    actifs: {
      placements: [{ id: 'av1', nom: 'AV Linxea', enveloppe: 'AV', categorie: 'Obligation', valeur: 50000, dcaMensuel: 0 }],
      immobilier: [], epargne: [], comptesCourants: [],
    },
    parametres: { projectionYears: 15, tauxPS: 0.186 },
  });
  const snaps = computeProjection(store);
  const last = snaps[snaps.length - 1];
  const key = Object.keys(last.placementDetail).find(k => k.includes('Assurance'));
  assert.ok(key, 'groupe Assurance Vie absent');
  const gains = last.placementGains[key];
  const taxes = last.placementTaxes[key];
  assert.ok(gains > 0, 'les gains AV doivent être positifs après 15 ans');
  // Taxe attendue = gains × 18,6 % (PS seuls, hypothèse transmission au décès)
  const attendu = gains * 0.186;
  assert.ok(Math.abs(taxes - attendu) <= Math.max(2, attendu * 0.01),
    `taxes AV ${taxes} ≠ gains × PS ${attendu.toFixed(0)}`);
});

test("projection : l'épargne croît à son taux et n'est jamais taxée", () => {
  const store = makeStore({
    actifs: {
      epargne: [{ id: 'e1', nom: 'Livret A', solde: 10000, tauxInteret: 0.03 }],
      placements: [], immobilier: [], comptesCourants: [],
    },
  });
  const snaps = computeProjection(store);
  assert.ok(snaps[snaps.length - 1].epargne > 10000, "l'épargne doit croître");
  assert.equal(snaps[snaps.length - 1].totalTaxes, 0, "aucune taxe sans gains de placement");
});

test('projection : un transfert de capital épargne → PEA débite et crédite', () => {
  const store = makeStore({
    actifs: {
      epargne: [{ id: 'e1', nom: 'Livret', solde: 50000, tauxInteret: 0 }],
      placements: [{ id: 'p1', nom: 'ETF PEA', enveloppe: 'PEA', categorie: 'ETF', valeur: 1000, dcaMensuel: 0 }],
      immobilier: [], comptesCourants: [],
    },
    parametres: {
      projectionYears: 5,
      capitalTransfers: [{ id: 't1', source: 'epargne', destinationId: '__cat_pea__', montant: 10000, frequency: 'once', startYear: CUR_YEAR + 1 }],
    },
  });
  const snaps = computeProjection(store);
  const before = snaps.find(s => s.calendarYear === CUR_YEAR);
  const after = snaps.find(s => s.calendarYear === CUR_YEAR + 1);
  assert.ok(before && after, 'snapshots introuvables');
  // Note : tauxInteret 0 retombe sur le défaut 2 % (0 est falsy dans le moteur) ;
  // on vérifie donc la relation : le débit de 10 000 € domine la croissance.
  assert.ok(after.epargne < before.epargne, `épargne ${before.epargne} → ${after.epargne} : le transfert doit la faire baisser`);
  assert.ok(before.epargne - after.epargne > 8000, 'environ 10 000 € doivent sortir de l\'épargne');
  assert.ok(after.totalApports >= 10000, 'les apports du placement doivent inclure le transfert');
});

test('projection : la dette est exposée dans le snapshot et s\'amortit', () => {
  const store = makeStore({
    actifs: {
      immobilier: [{ id: 'i1', nom: 'Maison', valeurActuelle: 300000 }],
      placements: [], epargne: [], comptesCourants: [],
    },
    passifs: { emprunts: [{ id: 'c1', capitalRestant: 100000, mensualite: 800, tauxAnnuel: 0.02, dureeRestanteMois: 240 }] },
  });
  const snaps = computeProjection(store);
  const first = snaps[0];
  // Convention actuelle du moteur de projection : patrimoineNet = immo + liquidités
  // nettes d'impôts, SANS déduire la dette (contrairement au patrimoineNet() du
  // dashboard, qui la déduit). totalDette est exposé séparément dans le snapshot.
  assert.equal(first.patrimoineNet, Math.round(first.immobilier + first.totalLiquiditesNettes));
  assert.ok(first.totalDette > 0, 'la dette doit être exposée dans le snapshot');
  const last = snaps[snaps.length - 1];
  assert.ok(last.totalDette < first.totalDette, "la dette doit s'amortir dans le temps");
});
