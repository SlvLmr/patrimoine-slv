const STORAGE_KEY = 'patrimoine-slv-data';

const defaultState = {
  actifs: {
    immobilier: [],
    placements: [],
    epargne: []
  },
  passifs: {
    emprunts: []
  },
  revenus: [],
  depenses: [],
  parametres: {
    inflationRate: 0.02,
    projectionYears: 20,
    situationFamiliale: 'celibataire',
    nbParts: 1,
    rendementImmobilier: 0.02,
    rendementPlacements: 0.05,
    rendementEpargne: 0.02
  }
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultState));
    const parsed = JSON.parse(raw);
    // Merge with defaults for any missing keys
    return {
      ...JSON.parse(JSON.stringify(defaultState)),
      ...parsed,
      actifs: { ...defaultState.actifs, ...(parsed.actifs || {}) },
      passifs: { ...defaultState.passifs, ...(parsed.passifs || {}) },
      parametres: { ...defaultState.parametres, ...(parsed.parametres || {}) }
    };
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Erreur de sauvegarde:', e);
    alert('Erreur: espace de stockage insuffisant.');
  }
}

const Store = {
  _state: null,

  init() {
    this._state = loadState();
    return this;
  },

  getAll() {
    return this._state;
  },

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this._state);
  },

  set(path, value) {
    const keys = path.split('.');
    let obj = this._state;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    saveState(this._state);
  },

  // CRUD helpers
  addItem(path, item) {
    const list = this.get(path);
    list.push({ id: generateId(), ...item });
    saveState(this._state);
  },

  updateItem(path, id, updates) {
    const list = this.get(path);
    const idx = list.findIndex(item => item.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      saveState(this._state);
    }
  },

  removeItem(path, id) {
    const list = this.get(path);
    const idx = list.findIndex(item => item.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      saveState(this._state);
    }
  },

  // Computed values
  totalActifs() {
    const a = this._state.actifs;
    const immo = a.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
    const plac = a.placements.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
    const epar = a.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);
    return immo + plac + epar;
  },

  totalPassifs() {
    return this._state.passifs.emprunts.reduce((s, i) => s + (Number(i.capitalRestant) || 0), 0);
  },

  patrimoineNet() {
    return this.totalActifs() - this.totalPassifs();
  },

  totalRevenus() {
    return this._state.revenus.reduce((s, i) => s + (Number(i.montantMensuel) || 0), 0);
  },

  totalDepenses() {
    return this._state.depenses.reduce((s, i) => s + (Number(i.montantMensuel) || 0), 0);
  },

  capaciteEpargne() {
    const mensualites = this._state.passifs.emprunts.reduce((s, i) => s + (Number(i.mensualite) || 0), 0);
    return this.totalRevenus() - this.totalDepenses() - mensualites;
  },

  reset() {
    this._state = JSON.parse(JSON.stringify(defaultState));
    saveState(this._state);
  },

  exportData() {
    return JSON.stringify(this._state, null, 2);
  },

  importData(json) {
    try {
      const data = JSON.parse(json);
      this._state = { ...JSON.parse(JSON.stringify(defaultState)), ...data };
      saveState(this._state);
      return true;
    } catch {
      return false;
    }
  }
};

export { Store, generateId };
