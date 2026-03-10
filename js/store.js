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
  revenus: [
    { id: 'rev1', nom: 'Salaire net', type: 'Salaire', frequence: 'Mensuel', montantMensuel: 2758.17 },
    { id: 'rev2', nom: '13ème mois', type: '13ème mois', frequence: 'Annuel', montantMensuel: 3000 },
    { id: 'rev3', nom: 'Participation', type: 'Participation', frequence: 'Annuel', montantMensuel: 2000 },
    { id: 'rev4', nom: 'Intéressement', type: 'Intéressement', frequence: 'Annuel', montantMensuel: 500 },
    { id: 'rev5', nom: 'Prime 1 nette', type: 'Prime', frequence: 'Annuel', montantMensuel: 750 },
    { id: 'rev6', nom: 'Prime 2 nette', type: 'Prime', frequence: 'Annuel', montantMensuel: 750 },
    { id: 'rev7', nom: 'NDF Internet', type: 'Autre', frequence: 'Annuel', montantMensuel: 439.89 },
    { id: 'rev8', nom: 'Tickets Restaurants', type: 'Autre', frequence: 'Annuel', montantMensuel: 1650 },
  ],
  depenses: [
    // Fixes
    { id: 'dep01', nom: 'Crédit maison', typeDepense: 'Fixe', categorie: 'Logement', frequence: 'Mensuel', montantMensuel: 652.55 },
    { id: 'dep02', nom: 'Assurance habitat', typeDepense: 'Fixe', categorie: 'Assurances', frequence: 'Mensuel', montantMensuel: 51.88 },
    { id: 'dep03', nom: 'Comptes', typeDepense: 'Fixe', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 14.61 },
    { id: 'dep04', nom: 'Electricité', typeDepense: 'Fixe', categorie: 'Logement', frequence: 'Mensuel', montantMensuel: 64.21 },
    { id: 'dep05', nom: 'Gaz', typeDepense: 'Fixe', categorie: 'Logement', frequence: 'Mensuel', montantMensuel: 116.95 },
    { id: 'dep06', nom: 'Eau', typeDepense: 'Fixe', categorie: 'Logement', frequence: 'Mensuel', montantMensuel: 32.32 },
    { id: 'dep07', nom: 'Taxe foncière', typeDepense: 'Fixe', categorie: 'Logement', frequence: 'Mensuel', montantMensuel: 179 },
    // Variables
    { id: 'dep10', nom: 'Courses', typeDepense: 'Variable', categorie: 'Alimentation', frequence: 'Mensuel', montantMensuel: 400 },
    { id: 'dep11', nom: 'Santé', typeDepense: 'Variable', categorie: 'Santé', frequence: 'Mensuel', montantMensuel: 15 },
    { id: 'dep12', nom: 'Vêtements', typeDepense: 'Variable', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 50 },
    { id: 'dep13', nom: 'Clubs - Cantine', typeDepense: 'Variable', categorie: 'Éducation', frequence: 'Mensuel', montantMensuel: 70 },
    { id: 'dep14', nom: 'Loisirs - Plaisirs', typeDepense: 'Variable', categorie: 'Loisirs', frequence: 'Mensuel', montantMensuel: 80 },
    { id: 'dep15', nom: 'Vacances - WE', typeDepense: 'Variable', categorie: 'Loisirs', frequence: 'Mensuel', montantMensuel: 200 },
    { id: 'dep16', nom: 'Petits travaux', typeDepense: 'Variable', categorie: 'Logement', frequence: 'Mensuel', montantMensuel: 50 },
    { id: 'dep17', nom: 'Achats divers', typeDepense: 'Variable', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 80 },
    { id: 'dep18', nom: 'Anniv - Noël', typeDepense: 'Variable', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 80 },
    // Abonnements
    { id: 'dep20', nom: 'Freebox Internet', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 39.99 },
    { id: 'dep21', nom: 'Tél Sylvain', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 15.99 },
    { id: 'dep22', nom: 'Tel Gaspard', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 15.99 },
    { id: 'dep23', nom: 'Tel Agathe', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 15.99 },
    { id: 'dep24', nom: 'Youtube Premium', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 12.99 },
    { id: 'dep25', nom: 'Canal +', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 19.99 },
    { id: 'dep26', nom: 'Gemini Pro', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 0 },
    { id: 'dep27', nom: 'Netflix (Incl. Free)', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 0 },
    { id: 'dep28', nom: 'Prime (Incl. Free)', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 0 },
    { id: 'dep29', nom: 'Disney + (Incl. Free)', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 0 },
    { id: 'dep30', nom: 'Zwift', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 0 },
    { id: 'dep31', nom: 'Playstation', typeDepense: 'Abonnement', categorie: 'Abonnements', frequence: 'Mensuel', montantMensuel: 6 },
    // Investissements
    { id: 'dep40', nom: 'PEA SLV /TRR', typeDepense: 'Investissement', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 300 },
    { id: 'dep41', nom: 'BTC SLV /TRR', typeDepense: 'Investissement', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 50 },
    { id: 'dep42', nom: 'VIE SLV /LXA', typeDepense: 'Investissement', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 0 },
    { id: 'dep43', nom: 'PER SLV /LXA', typeDepense: 'Investissement', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 0 },
    { id: 'dep44', nom: 'PEE GSP /TRR', typeDepense: 'Investissement', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 50 },
    { id: 'dep45', nom: 'PEE AGT /TRR', typeDepense: 'Investissement', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 50 },
    { id: 'dep46', nom: 'PEL GSP /CIC', typeDepense: 'Investissement', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 50 },
    { id: 'dep47', nom: 'PEL AGT /CIC', typeDepense: 'Investissement', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: 50 },
    { id: 'dep48', nom: 'Hélène part. PEL', typeDepense: 'Investissement', categorie: 'Autre', frequence: 'Mensuel', montantMensuel: -50 },
  ],
  suiviDepenses: [],
  parametres: {
    inflationRate: 0.02,
    projectionYears: 30,
    situationFamiliale: 'celibataire',
    nbParts: 1,
    rendementImmobilier: 0.02,
    rendementPlacements: 0.05,
    rendementGroupes: {},
    rendementEpargne: 0.02,
    ageFinAnnee: 43,
    ageRetraite: 64,
    anneeRetraiteTauxPlein: 2048,
    pensionTauxPlein: 2642,
    anneeRetraiteTauxLegal: 2047,
    pensionTauxLegal: 2442,
    ageRetraiteSouhaitee: 60
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
    return this._state.revenus.reduce((s, i) => {
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
