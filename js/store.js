import { isConfigured, getCurrentUser, saveToCloud, loadFromCloud, saveProfilesToCloud, loadProfilesFromCloud, discoverProfilesFromCloud, subscribeToProfile } from './firebase-config.js';


const PROFILES_KEY = 'patrimoine-slv-profiles';
const ACTIVE_PROFILE_KEY = 'patrimoine-slv-active-profile';

// Unique device ID per browser session — used to ignore our own onSnapshot echoes
const DEVICE_ID = sessionStorage.getItem('_slv_device') || (() => {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  sessionStorage.setItem('_slv_device', id);
  return id;
})();

// Track cloud sync status
let _cloudSyncPending = 0;
let _cloudSyncFailed = false;
let _onSyncStatusChange = null;
let _metaSyncedThisSession = false;

// Save queue: tracks whether local data is ahead of cloud
let _hasPendingSave = false;
let _cloudSaveTimer = null;
let _cloudRetryTimer = null;

// Real-time sync
let _unsubscribeRealtime = null;
let _onRemoteChangeCallback = null;
let _realtimeRetryTimer = null;
let _realtimeRetryCount = 0;

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
  surplusAnnuel: [],
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
  },
  // Rendement profiles: Faible / Modéré / Élevé — taux par groupe d'enveloppe
  profilRendement: 'modere',
  profilsRendement: {
    faible: {
      label: 'Faible', icon: '🐻',
      rendementImmobilier: 0.01, rendementEpargne: 0.015, inflation: 0.025,
      rendementGroupes: {
        'PEA ETF': 0.065, 'PEA Actions': 0.08, 'Crypto': 0, 'PEE': 0.05, 'Assurance Vie': 0.04, 'CTO': 0.065
      }
    },
    modere: {
      label: 'Modéré', icon: '📊',
      rendementImmobilier: 0.02, rendementEpargne: 0.02, inflation: 0.02,
      rendementGroupes: {
        'PEA ETF': 0.10, 'PEA Actions': 0.12, 'Crypto': 0.08, 'PEE': 0.07, 'Assurance Vie': 0.065, 'CTO': 0.08
      }
    },
    eleve: {
      label: 'Élevé', icon: '🚀',
      rendementImmobilier: 0.03, rendementEpargne: 0.025, inflation: 0.015,
      rendementGroupes: {
        'PEA ETF': 0.125, 'PEA Actions': 0.15, 'Crypto': 0.30, 'PEE': 0.09, 'Assurance Vie': 0.08, 'CTO': 0.125
      }
    }
  },
  // Scenarios: named configurations with overrides
  scenarioActif: 'reel',
  scenarios: [
    {
      id: 'reel', nom: 'Réel', color: 'blue',
      description: '900€/mois investis. Pension État à 64 ans. Gap FIRE→pension : 3 ans.',
      dcaMensuelTotal: 900, pensionAge: 64, rachatTrimestres: 0
    },
    {
      id: 'ideal', nom: 'Idéal', color: 'emerald',
      description: '1 050€/mois investis. Même pension à 64 ans. 2e cycle donation CTO possible.',
      dcaMensuelTotal: 1050, pensionAge: 64, rachatTrimestres: 0
    },
    {
      id: 'liberte', nom: 'Liberté', color: 'amber',
      description: 'Rachat 12 trimestres (~46 000€). Pension à ~62 ans (taux plein). Gap FIRE→pension : 1 an.',
      dcaMensuelTotal: 900, pensionAge: 62, rachatTrimestres: 12, coutRachat: 46000
    }
  ]
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
  const user = getCurrentUser();
  if (user) {
    _cloudSyncPending++;
    _notifySyncStatus();
    saveProfilesToCloud(user.uid, profiles).then(ok => {
      _cloudSyncPending--;
      if (!ok) _cloudSyncFailed = true;
      _notifySyncStatus();
    }).catch(() => {
      _cloudSyncPending--;
      _cloudSyncFailed = true;
      _notifySyncStatus();
    });
  } else {
    _hasPendingSave = true;
  }
}

function _notifySyncStatus() {
  if (_onSyncStatusChange) _onSyncStatusChange({ pending: _cloudSyncPending, failed: _cloudSyncFailed });
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
    const user = getCurrentUser();
    if (user) {
      // Debounce cloud saves: wait 500ms for rapid successive changes
      if (_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
      _cloudSaveTimer = setTimeout(() => {
        _pushToCloud(user.uid, profileId, state);
      }, 500);
    } else {
      // Firebase not ready yet — flag for later flush
      _hasPendingSave = true;
    }
  } catch (e) {
    console.error('Erreur de sauvegarde:', e);
    alert('Erreur: espace de stockage insuffisant.');
  }
}

// Actually push state to Firestore with retry on failure
function _pushToCloud(userId, profileId, state) {
  if (_cloudRetryTimer) { clearTimeout(_cloudRetryTimer); _cloudRetryTimer = null; }

  _cloudSyncPending++;
  _notifySyncStatus();

  // Ensure profiles metadata is pushed at least once per session
  const metaPromise = !_metaSyncedThisSession
    ? saveProfilesToCloud(userId, getProfiles()).then(ok => {
        if (ok) _metaSyncedThisSession = true;
      }).catch(() => {})
    : Promise.resolve();

  Promise.all([
    saveToCloud(userId, profileId, state, DEVICE_ID),
    metaPromise
  ]).then(([ok]) => {
    _cloudSyncPending--;
    if (!ok) {
      _cloudSyncFailed = true;
      _notifySyncStatus();
      // Retry in 5 seconds with current state from localStorage
      _cloudRetryTimer = setTimeout(() => {
        const user = getCurrentUser();
        if (user) {
          const freshState = loadState(profileId);
          _pushToCloud(user.uid, profileId, freshState);
        }
      }, 5000);
    } else {
      _cloudSyncFailed = false;
      _hasPendingSave = false;
      localStorage.setItem('patrimoine-slv-last-sync', new Date().toISOString());
      _notifySyncStatus();
    }
  }).catch(() => {
    _cloudSyncPending--;
    _cloudSyncFailed = true;
    _notifySyncStatus();
    // Retry in 5 seconds
    _cloudRetryTimer = setTimeout(() => {
      const user = getCurrentUser();
      if (user) {
        const freshState = loadState(profileId);
        _pushToCloud(user.uid, profileId, freshState);
      }
    }, 5000);
  });
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
      let cloudProfiles = await loadProfilesFromCloud(user.uid);

      // Fallback: if meta document is missing, try to discover profiles
      // from the subcollection directly (recovers orphaned data)
      if (!cloudProfiles || cloudProfiles.length === 0) {
        cloudProfiles = await discoverProfilesFromCloud(user.uid);
        // If discovered, rebuild the meta document so future syncs work
        if (cloudProfiles && cloudProfiles.length > 0) {
          await saveProfilesToCloud(user.uid, cloudProfiles);
        }
      }

      if (cloudProfiles && cloudProfiles.length > 0) {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(cloudProfiles));

        // Load each profile's data
        for (const p of cloudProfiles) {
          const cloudData = await loadFromCloud(user.uid, p.id);
          if (cloudData) {
            localStorage.setItem(getStorageKey(p.id), JSON.stringify(cloudData));
          }
        }

        // Re-init with cloud data, preserve active profile if it exists in cloud
        const currentActiveId = getActiveProfileId();
        const activeId = cloudProfiles.find(p => p.id === currentActiveId)
          ? currentActiveId
          : cloudProfiles[0].id;
        this._profileId = activeId;
        setActiveProfileId(activeId);
        this._state = loadState(activeId);
        localStorage.setItem('patrimoine-slv-last-sync', new Date().toISOString());
        _metaSyncedThisSession = true;
        _cloudSyncFailed = false;
        _notifySyncStatus();
        return true;
      }

      // No cloud data at all — push local profiles metadata so it exists for other devices
      // (only push metadata, not data, to avoid overwriting with empty defaults)
      const localProfiles = getProfiles();
      await saveProfilesToCloud(user.uid, localProfiles);
      _metaSyncedThisSession = true;

      // Also push profile data if local has real content
      const hasRealData = localProfiles.some(p => {
        const state = loadState(p.id);
        return (state.actifs?.immobilier?.length > 0) ||
               (state.actifs?.placements?.length > 0) ||
               (state.actifs?.epargne?.length > 0) ||
               (state.revenus?.length > 0) ||
               (state.depenses?.length > 0) ||
               (state.suiviDepenses?.length > 0) ||
               (state.suiviRevenus?.length > 0) ||
               (state.depensesMensuellesCIC?.length > 0) ||
               (state.surplusAnnuel?.length > 0) ||
               (state.userInfo?.prenom);
      });
      if (hasRealData) {
        await this.syncToCloud();
      }
      return false;
    } catch (e) {
      console.error('Sync from cloud error:', e);
      _cloudSyncFailed = true;
      _notifySyncStatus();
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
      _metaSyncedThisSession = true;

      for (const p of profiles) {
        const data = loadState(p.id);
        await saveToCloud(user.uid, p.id, data, DEVICE_ID);
      }
      localStorage.setItem('patrimoine-slv-last-sync', new Date().toISOString());
      _hasPendingSave = false;
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
    // Restart real-time listener on the new profile
    if (_unsubscribeRealtime) {
      this.startRealtimeSync(_onRemoteChangeCallback);
    }
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

    const result = {
      cic: baseCIC + prevCIC + revCIC - depCIC - totalCochees,
      tr: baseTR + prevTR + revTR + trInterets - depTR - trRoundup
    };

    // Extra banks
    const extraBanks = bankNames.extra || [];
    for (const bank of extraBanks) {
      const baseExtra = Number(comptes.find(c => c.id === 'cc-' + bank.id)?.solde) || 0;
      const prevExtra = Number(soldePrecedent[bank.id]) || 0;
      const revExtra = revenus.filter(r => r.compte === bank.name).reduce((s, r) => s + (Number(r.montant) || 0), 0);
      const depExtra = items.filter(i => i.compte === bank.name).reduce((s, i) => s + (Number(i.montant) || 0), 0);
      result[bank.id] = baseExtra + prevExtra + revExtra - depExtra;
    }

    return result;
  },

  // Get total live CC balance (accounting for transactions)
  totalComptesCourantsLive() {
    const liveSoldes = this.computeLiveSoldes();
    const comptes = this._state.actifs?.comptesCourants || [];
    if (comptes.length === 0) {
      return liveSoldes.cic + liveSoldes.tr;
    }
    return comptes.reduce((s, c) => {
      if (c.id === 'cc-cic') return s + liveSoldes.cic;
      if (c.id === 'cc-trade') return s + liveSoldes.tr;
      // Extra banks
      if (c.id.startsWith('cc-bank-') && liveSoldes[c.id.replace('cc-', '')] !== undefined) {
        return s + liveSoldes[c.id.replace('cc-', '')];
      }
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
    const names = this._state.bankNames || { primary: 'CIC', secondary: 'Trade Republic' };
    if (!names.extra) names.extra = [];
    return names;
  },

  addBank(name) {
    const names = this.getBankNames();
    const id = 'bank-' + Date.now().toString(36);
    if (!names.extra) names.extra = [];
    names.extra.push({ id, name });
    this.set('bankNames', names);
    // Create compte courant entry
    const actifs = this._state.actifs || {};
    const ccs = actifs.comptesCourants || [];
    ccs.push({ id: 'cc-' + id, nom: name, solde: 0 });
    actifs.comptesCourants = ccs;
    this.set('actifs', actifs);
    return id;
  },

  removeBank(bankId) {
    const names = this.getBankNames();
    const bank = (names.extra || []).find(b => b.id === bankId);
    if (!bank) return;
    names.extra = names.extra.filter(b => b.id !== bankId);
    this.set('bankNames', names);
    // Remove compte courant
    const actifs = this._state.actifs || {};
    actifs.comptesCourants = (actifs.comptesCourants || []).filter(c => c.id !== 'cc-' + bankId);
    this.set('actifs', actifs);
    // Remove related operations
    this.set('suiviDepenses', (this._state.suiviDepenses || []).filter(i => i.compte !== bank.name));
    this.set('suiviRevenus', (this._state.suiviRevenus || []).filter(i => i.compte !== bank.name));
    // Clean up prev/oblig
    const prev = this._state.soldeMoisPrecedent || {};
    delete prev[bankId];
    this.set('soldeMoisPrecedent', prev);
    const oblig = this._state.soldeObligatoire || {};
    delete oblig[bankId];
    this.set('soldeObligatoire', oblig);
    saveState(this._profileId, this._state);
  },

  renameBank(key, newName) {
    const names = this.getBankNames();
    // Handle extra banks
    if (key.startsWith('extra-')) {
      const bankId = key.replace('extra-', '');
      const bank = (names.extra || []).find(b => b.id === bankId);
      if (!bank || bank.name === newName) return;
      const oldName = bank.name;
      bank.name = newName;
      this.set('bankNames', names);
      // Migrate operations
      (this._state.suiviDepenses || []).forEach(i => { if (i.compte === oldName) i.compte = newName; });
      (this._state.suiviRevenus || []).forEach(i => { if (i.compte === oldName) i.compte = newName; });
      // Rename compte courant
      const actifs = this._state.actifs || {};
      const cc = (actifs.comptesCourants || []).find(c => c.id === 'cc-' + bankId);
      if (cc) { cc.nom = newName; this.set('actifs', actifs); }
      saveState(this._profileId, this._state);
      return;
    }
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
  },

  // Sync status tracking
  onSyncStatusChange(callback) {
    _onSyncStatusChange = callback;
  },

  getSyncStatus() {
    return { pending: _cloudSyncPending, failed: _cloudSyncFailed };
  },

  clearSyncError() {
    _cloudSyncFailed = false;
    _notifySyncStatus();
  },

  // Force push all data to cloud (retry mechanism)
  async forceSyncToCloud() {
    const user = getCurrentUser();
    if (!user) return false;

    try {
      const profiles = getProfiles();
      const profilesOk = await saveProfilesToCloud(user.uid, profiles);
      if (!profilesOk) throw new Error('Failed to save profiles');

      for (const p of profiles) {
        const data = loadState(p.id);
        const ok = await saveToCloud(user.uid, p.id, data, DEVICE_ID);
        if (!ok) throw new Error(`Failed to save profile ${p.id}`);
      }
      localStorage.setItem('patrimoine-slv-last-sync', new Date().toISOString());
      _cloudSyncFailed = false;
      _hasPendingSave = false;
      _notifySyncStatus();
      return true;
    } catch (e) {
      console.error('Force sync to cloud error:', e);
      _cloudSyncFailed = true;
      _notifySyncStatus();
      return false;
    }
  },

  // Flush saves that were queued before Firebase was ready
  flushPendingSync() {
    if (!_hasPendingSave) return;
    const user = getCurrentUser();
    if (!user) return;
    _pushToCloud(user.uid, this._profileId, this._state);
  },

  // Start real-time Firestore listener for cross-device sync
  startRealtimeSync(onRemoteChange) {
    this.stopRealtimeSync();
    _onRemoteChangeCallback = onRemoteChange || null;
    _realtimeRetryCount = 0;
    this._startRealtimeListener();
  },

  _startRealtimeListener() {
    const user = getCurrentUser();
    if (!user) return;

    // Pin profileId at subscription time to avoid race conditions
    const subscribedProfileId = this._profileId;

    _unsubscribeRealtime = subscribeToProfile(user.uid, subscribedProfileId, (docData) => {
      // Ignore our own writes
      if (docData.deviceId === DEVICE_ID) return;

      // Ignore if user switched to a different profile since subscription
      if (this._profileId !== subscribedProfileId) return;

      try {
        const remoteState = JSON.parse(docData.data);
        // Update localStorage and in-memory state
        localStorage.setItem(getStorageKey(subscribedProfileId), JSON.stringify(remoteState));
        this._state = loadState(subscribedProfileId);
        localStorage.setItem('patrimoine-slv-last-sync', new Date().toISOString());
        if (_onRemoteChangeCallback) _onRemoteChangeCallback();
      } catch (e) {
        console.error('Error applying remote state:', e);
      }
    }, (error) => {
      console.error('Realtime listener error, will retry:', error);
      _unsubscribeRealtime = null;
      // Retry with exponential backoff (2s, 4s, 8s, max 30s)
      if (_realtimeRetryCount < 5) {
        const delay = Math.min(2000 * Math.pow(2, _realtimeRetryCount), 30000);
        _realtimeRetryCount++;
        _realtimeRetryTimer = setTimeout(() => {
          this._startRealtimeListener();
        }, delay);
      }
    });
  },

  // Stop the real-time listener
  stopRealtimeSync() {
    if (_realtimeRetryTimer) {
      clearTimeout(_realtimeRetryTimer);
      _realtimeRetryTimer = null;
    }
    if (_unsubscribeRealtime) {
      _unsubscribeRealtime();
      _unsubscribeRealtime = null;
    }
  },

  // Flush pending cloud save immediately (best-effort, for beforeunload)
  flushImmediateSync() {
    if (!_cloudSaveTimer) return;
    clearTimeout(_cloudSaveTimer);
    _cloudSaveTimer = null;
    const user = getCurrentUser();
    if (user) {
      _pushToCloud(user.uid, this._profileId, this._state);
    }
  }
};

export { Store, generateId };
