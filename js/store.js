import { isConfigured, getCurrentUser, saveToCloud, loadFromCloud, saveProfilesToCloud, loadProfilesFromCloud } from './firebase-config.js';


const PROFILES_KEY = 'patrimoine-slv-profiles';
const ACTIVE_PROFILE_KEY = 'patrimoine-slv-active-profile';

const defaultState = {
  actifs: {
    immobilier: [],
    placements: [],
    epargne: [],
    comptesCourants: []
  },
  passifs: {
    emprunts: []
  },
  heritage: [],
  objectifs: [],
  revenus: [],
  depenses: [],
  suiviDepenses: [],
  archiveDepenses: [],
  userInfo: {
    prenom: '',
    nom: '',
    telephone: '',
    dateNaissance: '',
    photo: ''
  },
  bankNames: {
    primary: 'CIC',
    secondary: 'Trade Republic'
  },
  parametres: {
    inflationRate: 0.02,
    projectionYears: 30,
    situationFamiliale: 'celibataire',
    nbParts: 1,
    rendementImmobilier: 0.02,
    rendementPlacements: 0.05,
    rendementGroupes: {},
    rendementEpargne: 0.02,
    ageFinAnnee: 30,
    ageRetraite: 64,
    ageRetraiteTauxPlein: 65,
    pensionTauxPlein: 0,
    ageRetraiteTauxLegal: 64,
    pensionTauxLegal: 0,
    ageRetraiteSouhaitee: 62
  }
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Profile management (local)
function getProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  // Cloud sync (fire and forget)
  const user = getCurrentUser();
  if (user) saveProfilesToCloud(user.uid, profiles);
}

function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY) || null;
}

function setActiveProfileId(id) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
}

function getStorageKey(profileId) {
  return `patrimoine-slv-data-${profileId}`;
}

// Migrate old single-profile data to multi-profile
function migrateOldData() {
  const oldKey = 'patrimoine-slv-data';
  const oldData = localStorage.getItem(oldKey);
  const profiles = getProfiles();

  if (oldData && profiles.length === 0) {
    const profileId = generateId();
    const profile = { id: profileId, name: 'Mon patrimoine', createdAt: new Date().toISOString() };
    localStorage.setItem(PROFILES_KEY, JSON.stringify([profile]));
    setActiveProfileId(profileId);
    localStorage.setItem(getStorageKey(profileId), oldData);
    localStorage.removeItem(oldKey);
    return profileId;
  }

  return null;
}

function loadState(profileId) {
  try {
    const key = getStorageKey(profileId);
    const raw = localStorage.getItem(key);
    if (!raw) return JSON.parse(JSON.stringify(defaultState));
    const parsed = JSON.parse(raw);
    const mergedParams = { ...defaultState.parametres, ...(parsed.parametres || {}) };
    // Migrate old year-based retirement keys to age-based
    if (mergedParams.anneeRetraiteTauxLegal && !parsed.parametres?.ageRetraiteTauxLegal) {
      const age = mergedParams.ageFinAnnee || 43;
      const currentYear = new Date().getFullYear();
      mergedParams.ageRetraiteTauxLegal = age + (mergedParams.anneeRetraiteTauxLegal - currentYear);
    }
    if (mergedParams.anneeRetraiteTauxPlein && !parsed.parametres?.ageRetraiteTauxPlein) {
      const age = mergedParams.ageFinAnnee || 43;
      const currentYear = new Date().getFullYear();
      mergedParams.ageRetraiteTauxPlein = age + (mergedParams.anneeRetraiteTauxPlein - currentYear);
    }
    delete mergedParams.anneeRetraiteTauxLegal;
    delete mergedParams.anneeRetraiteTauxPlein;
    // Merge suiviDepenses: inject default seed items that don't exist yet
    const existingDepenses = parsed.suiviDepenses || [];
    const existingIds = new Set(existingDepenses.map(d => d.id));
    const seedDepenses = defaultState.suiviDepenses.filter(d => !existingIds.has(d.id));
    const mergedDepenses = [...seedDepenses, ...existingDepenses];

    return {
      ...JSON.parse(JSON.stringify(defaultState)),
      ...parsed,
      suiviDepenses: mergedDepenses,
      actifs: { ...defaultState.actifs, ...(parsed.actifs || {}) },
      passifs: { ...defaultState.passifs, ...(parsed.passifs || {}) },
      parametres: mergedParams
    };
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState(profileId, state) {
  try {
    localStorage.setItem(getStorageKey(profileId), JSON.stringify(state));
    // Cloud sync (fire and forget)
    const user = getCurrentUser();
    if (user) saveToCloud(user.uid, profileId, state);
  } catch (e) {
    console.error('Erreur de sauvegarde:', e);
    alert('Erreur: espace de stockage insuffisant.');
  }
}

const Store = {
  _state: null,
  _profileId: null,
  _onChangeCallbacks: [],

  init() {
    // Migrate old data if needed
    migrateOldData();

    let profiles = getProfiles();
    let activeId = getActiveProfileId();

    // Create default profile if none exist
    if (profiles.length === 0) {
      const id = generateId();
      profiles = [{ id, name: 'Mon patrimoine', createdAt: new Date().toISOString() }];
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      activeId = id;
      setActiveProfileId(id);
    }

    // Ensure active profile exists
    if (!activeId || !profiles.find(p => p.id === activeId)) {
      activeId = profiles[0].id;
      setActiveProfileId(activeId);
    }

    this._profileId = activeId;
    this._state = loadState(activeId);
    this._migrateInformatif();
    this._applyMonthlyDCA();
    this._archivePastExpenses();
    return this;
  },

  // Migrate: flag known informatif revenue types
  _migrateInformatif() {
    const revenus = this._state.revenus || [];
    const informatifTypes = ['Intéressement', 'Participation'];
    const informatifNames = ['tickets restaurants', 'ticket restaurant', 'tickets restau'];
    let changed = false;
    revenus.forEach(r => {
      if (r.informatif !== undefined) return;
      const isType = informatifTypes.includes(r.type);
      const isName = informatifNames.includes((r.nom || '').toLowerCase());
      if (isType || isName) {
        r.informatif = true;
        changed = true;
      }
    });
    if (changed) saveState(this._profileId, this._state);
  },

  // Auto-apply DCA on the 2nd of each month
  _applyMonthlyDCA() {
    const now = new Date();
    if (now.getDate() < 2) return; // before the 2nd, skip

    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastDCA = this._state.parametres._lastDCAMonth;
    if (lastDCA === monthKey) return; // already applied this month

    const placements = this._state.actifs?.placements || [];
    const comptesCourants = this._state.actifs?.comptesCourants || [];
    const tradeCc = comptesCourants.find(c => c.id === 'cc-trade');
    let changed = false;

    placements.forEach(p => {
      const dca = Number(p.dcaMensuel) || 0;
      if (dca <= 0) return;

      const pru = Number(p.pru) || 0;
      const qty = Number(p.quantite) || 0;
      const val = Number(p.valeur) || 0;
      const env = (p.enveloppe || p.type || '').toUpperCase();
      const isPEA = env.startsWith('PEA');

      if (pru > 0) {
        if (isPEA) {
          // PEA: only whole shares, remainder goes to Live Trade
          const wholeParts = Math.floor(dca / pru);
          const remainder = dca - (wholeParts * pru);
          if (wholeParts > 0) {
            p.quantite = qty + wholeParts;
            p.valeur = (qty + wholeParts) * pru;
          }
          if (remainder > 0 && tradeCc) {
            tradeCc.solde = (Number(tradeCc.solde) || 0) + remainder;
          }
        } else {
          // CTO/Crypto: fractional shares allowed
          const newParts = dca / pru;
          p.quantite = qty + newParts;
          p.valeur = (qty + newParts) * pru;
        }
      } else {
        // No PRU: just add the amount
        p.valeur = val + dca;
      }
      changed = true;
    });

    if (changed) {
      this._state.parametres._lastDCAMonth = monthKey;
      saveState(this._profileId, this._state);
    }
  },

  // Archive past months' expenses into archiveDepenses summaries
  _archivePastExpenses() {
    const items = this._state.suiviDepenses || [];
    if (items.length === 0) return;

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Find items from past months (not current month)
    const pastItems = items.filter(i => {
      const d = new Date(i.date);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mk < currentMonthKey;
    });

    if (pastItems.length === 0) return;

    // Group past items by month
    const byMonth = {};
    pastItems.forEach(i => {
      const d = new Date(i.date);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[mk]) byMonth[mk] = { total: 0, count: 0, categories: {} };
      const montant = Number(i.montant) || 0;
      byMonth[mk].total += montant;
      byMonth[mk].count++;
      const cat = i.categorie || 'Autre';
      byMonth[mk].categories[cat] = (byMonth[mk].categories[cat] || 0) + montant;
    });

    // Merge into archiveDepenses
    if (!this._state.archiveDepenses) this._state.archiveDepenses = [];
    const archive = this._state.archiveDepenses;

    for (const [mk, data] of Object.entries(byMonth)) {
      const existing = archive.find(a => a.mois === mk);
      if (existing) {
        existing.total += data.total;
        existing.count += data.count;
        for (const [cat, val] of Object.entries(data.categories)) {
          existing.categories[cat] = (existing.categories[cat] || 0) + val;
        }
      } else {
        archive.push({ mois: mk, total: data.total, count: data.count, categories: data.categories });
      }
    }

    // Remove archived items from suiviDepenses (keep only current month)
    this._state.suiviDepenses = items.filter(i => {
      const d = new Date(i.date);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return mk >= currentMonthKey;
    });

    saveState(this._profileId, this._state);
  },

  // Cloud sync: load all data from cloud and replace local
  async syncFromCloud() {
    const user = getCurrentUser();
    if (!user) return false;

    try {
      // Load profiles from cloud
      const cloudProfiles = await loadProfilesFromCloud(user.uid);
      if (cloudProfiles && cloudProfiles.length > 0) {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(cloudProfiles));

        // Load each profile's data
        for (const p of cloudProfiles) {
          const cloudData = await loadFromCloud(user.uid, p.id);
          if (cloudData) {
            localStorage.setItem(getStorageKey(p.id), JSON.stringify(cloudData));
          }
        }

        // Re-init with cloud data
        const activeId = cloudProfiles[0].id;
        this._profileId = activeId;
        setActiveProfileId(activeId);
        this._state = loadState(activeId);
        localStorage.setItem('patrimoine-slv-last-sync', new Date().toISOString());
        return true;
      }

      // No cloud data yet — push local to cloud
      await this.syncToCloud();
      return false;
    } catch (e) {
      console.error('Sync from cloud error:', e);
      return false;
    }
  },

  // Push all local data to cloud
  async syncToCloud() {
    const user = getCurrentUser();
    if (!user) return false;

    try {
      const profiles = getProfiles();
      await saveProfilesToCloud(user.uid, profiles);

      for (const p of profiles) {
        const data = loadState(p.id);
        await saveToCloud(user.uid, p.id, data);
      }
      localStorage.setItem('patrimoine-slv-last-sync', new Date().toISOString());
      return true;
    } catch (e) {
      console.error('Sync to cloud error:', e);
      return false;
    }
  },

  // Profile methods
  getProfiles() {
    return getProfiles();
  },

  getActiveProfile() {
    const profiles = getProfiles();
    return profiles.find(p => p.id === this._profileId) || profiles[0];
  },

  createProfile(name) {
    const profiles = getProfiles();
    const id = generateId();
    profiles.push({ id, name, createdAt: new Date().toISOString() });
    saveProfiles(profiles);
    saveState(id, JSON.parse(JSON.stringify(defaultState)));
    return id;
  },

  switchProfile(id) {
    const profiles = getProfiles();
    if (!profiles.find(p => p.id === id)) return false;
    this._profileId = id;
    setActiveProfileId(id);
    this._state = loadState(id);
    return true;
  },

  renameProfile(id, newName) {
    const profiles = getProfiles();
    const p = profiles.find(pr => pr.id === id);
    if (p) {
      p.name = newName;
      saveProfiles(profiles);
    }
  },

  deleteProfile(id) {
    let profiles = getProfiles();
    if (profiles.length <= 1) return false;
    profiles = profiles.filter(p => p.id !== id);
    saveProfiles(profiles);
    localStorage.removeItem(getStorageKey(id));
    if (this._profileId === id) {
      this.switchProfile(profiles[0].id);
    }
    return true;
  },

  // Data methods
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
    saveState(this._profileId, this._state);
  },

  addItem(path, item) {
    const list = this.get(path);
    list.push({ id: generateId(), ...item });
    saveState(this._profileId, this._state);
  },

  updateItem(path, id, updates) {
    const list = this.get(path);
    const idx = list.findIndex(item => item.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      saveState(this._profileId, this._state);
    }
  },

  removeItem(path, id) {
    const list = this.get(path);
    const idx = list.findIndex(item => item.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      saveState(this._profileId, this._state);
    }
  },

  // Compute live soldes for comptes courants (accounting for transactions from vie quotidienne)
  computeLiveSoldes() {
    const comptes = this._state.actifs?.comptesCourants || [];
    const bankNames = this.getBankNames();
    const baseCIC = Number(comptes.find(c => c.id === 'cc-cic')?.solde) || 0;
    const baseTR = Number(comptes.find(c => c.id === 'cc-trade')?.solde) || 0;

    const soldePrecedent = this._state.soldeMoisPrecedent || {};
    const prevCIC = Number(soldePrecedent.cic) || 0;
    const prevTR = Number(soldePrecedent.tr) || 0;

    const items = this._state.suiviDepenses || [];
    const revenus = this._state.suiviRevenus || [];

    const revCIC = revenus.filter(r => r.compte === bankNames.primary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const depCIC = items.filter(i => i.compte === bankNames.primary).reduce((s, i) => s + (Number(i.montant) || 0), 0);

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const depMensuelles = this._state.depensesMensuellesCIC || [];
    const cicCochees = this._state.cicMensuellesCochees || {};
    const cocheesThisMonth = cicCochees[monthKey] || [];
    const totalCochees = depMensuelles.filter(d => cocheesThisMonth.includes(d.id)).reduce((s, d) => s + d.montant, 0);

    const revTR = revenus.filter(r => r.compte === bankNames.secondary).reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const depTR = items.filter(i => i.compte === bankNames.secondary).reduce((s, i) => s + (Number(i.montant) || 0), 0);

    const trFeatures = this._state.trFeatures || {};
    const trInterets = Number(trFeatures.interets) || 0;
    const trRoundup = Number(trFeatures.roundup) || 0;

    return {
      cic: baseCIC + prevCIC + revCIC - depCIC - totalCochees,
      tr: baseTR + prevTR + revTR + trInterets - depTR - trRoundup
    };
  },

  // Get total live CC balance (accounting for transactions)
  totalComptesCourantsLive() {
    const liveSoldes = this.computeLiveSoldes();
    const comptes = this._state.actifs?.comptesCourants || [];
    if (comptes.length === 0) {
      // Even without explicit accounts, include live soldes from transactions
      return liveSoldes.cic + liveSoldes.tr;
    }
    return comptes.reduce((s, c) => {
      if (c.id === 'cc-cic') return s + liveSoldes.cic;
      if (c.id === 'cc-trade') return s + liveSoldes.tr;
      return s + (Number(c.solde) || 0);
    }, 0);
  },

  // Computed values
  totalActifs() {
    const a = this._state.actifs;
    const immo = a.immobilier.reduce((s, i) => s + (Number(i.valeurActuelle) || 0), 0);
    const plac = a.placements.reduce((s, i) => s + (Number(i.valeur) || 0), 0);
    const epar = a.epargne.reduce((s, i) => s + (Number(i.solde) || 0), 0);
    const cc = this.totalComptesCourantsLive();
    return immo + plac + epar + cc;
  },

  totalPassifs() {
    return this._state.passifs.emprunts.reduce((s, i) => s + (Number(i.capitalRestant) || 0), 0);
  },

  patrimoineNet() {
    return this.totalActifs() - this.totalPassifs();
  },

  totalRevenus() {
    return this._state.revenus.filter(i => !i.informatif).reduce((s, i) => {
      const montant = Number(i.montantMensuel) || 0;
      return s + (i.frequence === 'Annuel' ? montant / 12 : montant);
    }, 0);
  },

  totalDepenses() {
    return this._state.depenses.reduce((s, i) => {
      const montant = Number(i.montantMensuel) || 0;
      return s + (i.frequence === 'Annuel' ? montant / 12 : montant);
    }, 0);
  },

  capaciteEpargne() {
    const mensualites = this._state.passifs.emprunts.reduce((s, i) => s + (Number(i.mensualite) || 0), 0);
    return this.totalRevenus() - this.totalDepenses() - mensualites;
  },

  getDefaults(path) {
    return JSON.parse(JSON.stringify(path.split('.').reduce((obj, key) => obj?.[key], defaultState)));
  },

  resetSection(path) {
    const defaults = this.getDefaults(path);
    this.set(path, defaults);
  },

  reset() {
    this._state = JSON.parse(JSON.stringify(defaultState));
    saveState(this._profileId, this._state);
  },

  getBankNames() {
    return this._state.bankNames || { primary: 'CIC', secondary: 'Trade Republic' };
  },

  renameBank(key, newName) {
    const names = this.getBankNames();
    const oldName = names[key];
    if (!oldName || oldName === newName) return;
    names[key] = newName;
    this.set('bankNames', names);
    // Migrate all suiviDepenses/suiviRevenus entries
    (this._state.suiviDepenses || []).forEach(i => { if (i.compte === oldName) i.compte = newName; });
    (this._state.suiviRevenus || []).forEach(i => { if (i.compte === oldName) i.compte = newName; });
    saveState(this._profileId, this._state);
  },

  exportData() {
    const profile = this.getActiveProfile();
    return JSON.stringify({ profile, data: this._state }, null, 2);
  },

  exportAllProfiles() {
    const profiles = getProfiles();
    const allData = profiles.map(p => ({
      profile: p,
      data: loadState(p.id)
    }));
    return JSON.stringify({ profiles: allData }, null, 2);
  },

  importData(json) {
    try {
      const parsed = JSON.parse(json);
      const data = parsed.data || parsed;
      this._state = { ...JSON.parse(JSON.stringify(defaultState)), ...data };
      saveState(this._profileId, this._state);
      return true;
    } catch {
      return false;
    }
  }
};

export { Store, generateId };
