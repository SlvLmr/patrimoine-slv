import { isConfigured, getCurrentUser, saveToCloud, loadFromCloud, saveProfilesToCloud, loadProfilesFromCloud } from './firebase-config.js';

const PROFILES_KEY = 'patrimoine-slv-profiles';
const ACTIVE_PROFILE_KEY = 'patrimoine-slv-active-profile';

const defaultState = {
  actifs: {
    immobilier: [],
    placements: [],
    epargne: []
  },
  passifs: {
    emprunts: []
  },
  heritage: [],
  revenus: [],
  depenses: [],
  suiviDepenses: [],
  parametres: {
    inflationRate: 0.02,
    projectionYears: 30,
    situationFamiliale: 'celibataire',
    nbParts: 1,
    rendementImmobilier: 0.02,
    rendementPlacements: 0.05,
    rendementEpargne: 0.02,
    ageFinAnnee: 43,
    ageRetraite: 64
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
    return this;
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
