import { isConfigured, getCurrentUser, saveToCloud, loadFromCloud, saveProfilesToCloud, loadProfilesFromCloud } from './firebase-config.js';

const PROFILES_KEY = 'patrimoine-slv-profiles';
const ACTIVE_PROFILE_KEY = 'patrimoine-slv-active-profile';

const defaultState = {
  actifs: {
    immobilier: [],
    placements: [],
    epargne: [],
    comptesCourants: [
      { id: 'cc-cic', nom: 'Live CIC', solde: 0 },
      { id: 'cc-trade', nom: 'Live Trade Republic', solde: 0 }
    ]
  },
  passifs: {
    emprunts: []
  },
  heritage: [],
  revenus: [
    { id: 'rev1', nom: 'Salaire net', type: 'Salaire', frequence: 'Mensuel', montantMensuel: 2758.17 },
    { id: 'rev2', nom: '13ème mois', type: '13ème mois', frequence: 'Annuel', montantMensuel: 3000 },
    { id: 'rev3', nom: 'Participation', type: 'Participation', frequence: 'Annuel', montantMensuel: 2000, informatif: true },
    { id: 'rev4', nom: 'Intéressement', type: 'Intéressement', frequence: 'Annuel', montantMensuel: 500, informatif: true },
    { id: 'rev5', nom: 'Prime 1 nette', type: 'Prime', frequence: 'Annuel', montantMensuel: 750 },
    { id: 'rev6', nom: 'Prime 2 nette', type: 'Prime', frequence: 'Annuel', montantMensuel: 750 },
    { id: 'rev7', nom: 'NDF Internet', type: 'Autre', frequence: 'Annuel', montantMensuel: 439.89 },
    { id: 'rev8', nom: 'Tickets Restaurants', type: 'Autre', frequence: 'Annuel', montantMensuel: 1650, informatif: true },
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
  suiviDepenses: [
    { id: 'sd-01', date: '2026-03-02', description: 'La Poste LRAR', categorie: 'Achats divers', montant: 15.12, compte: 'Trade Republic' },
    { id: 'sd-02', date: '2026-03-02', description: 'Action Agathe Ski', categorie: 'Achats divers', montant: 5.78, compte: 'Trade Republic' },
    { id: 'sd-03', date: '2026-03-02', description: 'Gifi Agathe Ski', categorie: 'Achats divers', montant: 2.99, compte: 'Trade Republic' },
    { id: 'sd-04', date: '2026-03-02', description: 'La Poste', categorie: 'Achats divers', montant: 1.60, compte: 'Trade Republic' },
    { id: 'sd-05', date: '2026-03-02', description: 'La Poste', categorie: 'Achats divers', montant: 1.60, compte: 'Trade Republic' },
    { id: 'sd-06', date: '2026-03-02', description: 'La Poste', categorie: 'Achats divers', montant: 2.10, compte: 'Trade Republic' },
    { id: 'sd-07', date: '2026-03-10', description: 'Leclerc', categorie: 'Alimentation', montant: 388.17, compte: 'Trade Republic' },
    { id: 'sd-08', date: '2026-03-10', description: 'McDo', categorie: 'Alimentation', montant: 5.95, compte: 'Trade Republic' },
    { id: 'sd-09', date: '2026-03-10', description: 'Boulangerie', categorie: 'Alimentation', montant: 8.30, compte: 'Trade Republic' },
    { id: 'sd-10', date: '2026-03-10', description: 'Carrefour', categorie: 'Alimentation', montant: 0.89, compte: 'Trade Republic' },
    { id: 'sd-11', date: '2026-03-10', description: 'Boulangerie', categorie: 'Alimentation', montant: 4.30, compte: 'Trade Republic' },
    { id: 'sd-12', date: '2026-03-10', description: 'McDo', categorie: 'Alimentation', montant: 8.19, compte: 'Trade Republic' },
    { id: 'sd-13', date: '2026-03-10', description: 'Action', categorie: 'Achats divers', montant: 8.04, compte: 'Trade Republic' },
    { id: 'sd-14', date: '2026-03-10', description: 'Karting', categorie: 'Loisirs - Plaisirs', montant: 30.00, compte: 'Trade Republic' },
  ],
  archiveDepenses: [],
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
    ageRetraiteTauxPlein: 65,
    pensionTauxPlein: 2642,
    ageRetraiteTauxLegal: 64,
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
    this._applyMonthlyDCA();
    this._archivePastExpenses();
    return this;
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
    const cc = (a.comptesCourants || []).reduce((s, i) => s + (Number(i.solde) || 0), 0);
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
