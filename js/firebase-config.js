// ============================================
// CONFIGURATION FIREBASE
// ============================================
// Pour activer la synchronisation cloud :
// 1. Va sur https://console.firebase.google.com
// 2. Crée un nouveau projet (ou utilise un existant)
// 3. Active Authentication > Email/Mot de passe
// 4. Crée une base Firestore (mode production)
// 5. Copie ta config Firebase ci-dessous
// ============================================

// Firebase SDK loaded lazily to avoid blocking app startup
let _firebaseApp = null;
let _firebaseAuth = null;
let _firebaseFirestore = null;
let _sdkLoadPromise = null;

async function loadFirebaseSDK() {
  if (_sdkLoadPromise) return _sdkLoadPromise;
  _sdkLoadPromise = Promise.all([
    import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js')
  ]).then(([appMod, authMod, firestoreMod]) => {
    _firebaseApp = appMod;
    _firebaseAuth = authMod;
    _firebaseFirestore = firestoreMod;
  });
  return _sdkLoadPromise;
}

const firebaseConfig = {
  apiKey: "AIzaSyADxr-G7gcQDDPEcNkxiMCCCnfeuaJ48p0",
  authDomain: "horizon-4389d.firebaseapp.com",
  projectId: "horizon-4389d",
  storageBucket: "horizon-4389d.firebasestorage.app",
  messagingSenderId: "210773564839",
  appId: "1:210773564839:web:0fceb43e58c913ff002a82"
};

let app = null;
let auth = null;
let db = null;
let initialized = false;

function isConfigured() {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
}

function initFirebase() {
  if (initialized) return { auth, db };
  if (!isConfigured() || !_firebaseApp) return { auth: null, db: null };

  try {
    app = _firebaseApp.initializeApp(firebaseConfig);
    auth = _firebaseAuth.getAuth(app);
    db = _firebaseFirestore.getFirestore(app);
    initialized = true;
  } catch (e) {
    console.error('Firebase init error:', e);
    return { auth: null, db: null };
  }
  return { auth, db };
}

// Auth functions
async function register(email, password) {
  const { auth } = initFirebase();
  if (!auth) throw new Error('Firebase non configuré');
  return _firebaseAuth.createUserWithEmailAndPassword(auth, email, password);
}

async function login(email, password) {
  const { auth } = initFirebase();
  if (!auth) throw new Error('Firebase non configuré');
  return _firebaseAuth.signInWithEmailAndPassword(auth, email, password);
}

async function logout() {
  const { auth } = initFirebase();
  if (!auth) return;
  return _firebaseAuth.signOut(auth);
}

async function resetPassword(email) {
  const { auth } = initFirebase();
  if (!auth) throw new Error('Firebase non configuré');
  return _firebaseAuth.sendPasswordResetEmail(auth, email);
}

function onAuth(callback) {
  const { auth } = initFirebase();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return _firebaseAuth.onAuthStateChanged(auth, callback);
}

function getCurrentUser() {
  const { auth } = initFirebase();
  return auth?.currentUser || null;
}

// Retry helper for cloud operations (with 15s timeout per attempt)
async function withRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 15000))
      ]);
      return result;
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// Firestore sync functions
async function saveToCloud(userId, profileId, data, deviceId) {
  const { db } = initFirebase();
  if (!db || !userId) {
    console.warn('Cloud save skipped: db=', !!db, 'userId=', !!userId);
    return false;
  }
  try {
    await withRetry(() => _firebaseFirestore.setDoc(
      _firebaseFirestore.doc(db, 'users', userId, 'profiles', profileId), {
      data: JSON.stringify(data),
      updatedAt: new Date().toISOString(),
      deviceId: deviceId || null
    }));
    return true;
  } catch (e) {
    console.error('Cloud save error:', e.code, e.message);
    return false;
  }
}

async function loadFromCloud(userId, profileId) {
  const { db } = initFirebase();
  if (!db || !userId) return null;
  try {
    const snap = await withRetry(() => _firebaseFirestore.getDoc(
      _firebaseFirestore.doc(db, 'users', userId, 'profiles', profileId)));
    if (snap.exists()) {
      return JSON.parse(snap.data().data);
    }
    return null;
  } catch (e) {
    console.error('Cloud load error:', e);
    return null;
  }
}

async function saveProfilesToCloud(userId, profiles) {
  const { db } = initFirebase();
  if (!db || !userId) return false;
  try {
    await withRetry(() => _firebaseFirestore.setDoc(
      _firebaseFirestore.doc(db, 'users', userId, 'meta', 'profiles'), {
      profiles: JSON.stringify(profiles),
      updatedAt: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    console.error('Cloud save profiles error:', e);
    return false;
  }
}

async function loadProfilesFromCloud(userId) {
  const { db } = initFirebase();
  if (!db || !userId) return null;
  try {
    const snap = await withRetry(() => _firebaseFirestore.getDoc(
      _firebaseFirestore.doc(db, 'users', userId, 'meta', 'profiles')));
    if (snap.exists()) {
      return JSON.parse(snap.data().profiles);
    }
    // Fallback: try the old (broken) path in case data was somehow saved there
    // This handles the transition period
    return null;
  } catch (e) {
    console.error('Cloud load profiles error:', e);
    return null;
  }
}

// Test Firestore connection by writing a test document
async function testCloudConnection(userId) {
  const { db } = initFirebase();
  if (!db || !userId) return { ok: false, error: 'Firebase non initialisé (db ou userId manquant)' };
  try {
    // Try to write a small test document
    const testRef = _firebaseFirestore.doc(db, 'users', userId, 'meta', '_ping');
    await _firebaseFirestore.setDoc(testRef, { t: Date.now() }, { merge: true });
    return { ok: true };
  } catch (e) {
    let msg;
    if (e.code === 'permission-denied') {
      msg = 'Accès refusé par Firestore. Les règles de sécurité bloquent l\'accès. Va dans la console Firebase > Firestore > Règles et autorise l\'accès pour les utilisateurs authentifiés.';
    } else if (e.code === 'unavailable' || e.code === 'failed-precondition') {
      msg = 'Firestore indisponible. Vérifie ta connexion internet.';
    } else if (e.code === 'not-found') {
      msg = 'Base Firestore introuvable. Vérifie que Firestore est activé dans ta console Firebase.';
    } else {
      msg = `Erreur Firestore: ${e.code || e.message}`;
    }
    return { ok: false, error: msg };
  }
}

// Discover profiles by listing documents in the profiles subcollection
// Used as fallback when meta document is missing
async function discoverProfilesFromCloud(userId) {
  const { db } = initFirebase();
  if (!db || !userId) return null;
  try {
    const colRef = _firebaseFirestore.collection(db, 'users', userId, 'profiles');
    const snap = await withRetry(() => _firebaseFirestore.getDocs(colRef));
    if (snap.empty) return null;
    const profiles = [];
    snap.forEach(doc => {
      const data = doc.data();
      let name = 'Mon patrimoine';
      try {
        const parsed = JSON.parse(data.data);
        if (parsed.userInfo?.prenom) name = `Profil de ${parsed.userInfo.prenom}`;
      } catch {}
      profiles.push({
        id: doc.id,
        name,
        createdAt: data.updatedAt || new Date().toISOString()
      });
    });
    return profiles.length > 0 ? profiles : null;
  } catch (e) {
    console.error('Cloud discover profiles error:', e);
    return null;
  }
}

// Real-time listener for profile data changes (cross-device sync)
function subscribeToProfile(userId, profileId, onChange, onError) {
  const { db } = initFirebase();
  if (!db || !userId) return () => {};

  const docRef = _firebaseFirestore.doc(db, 'users', userId, 'profiles', profileId);
  return _firebaseFirestore.onSnapshot(docRef, (snap) => {
    if (!snap.exists()) return;
    onChange(snap.data());
  }, (error) => {
    console.error('Realtime sync error:', error);
    if (onError) onError(error);
  });
}

export {
  isConfigured,
  loadFirebaseSDK,
  initFirebase,
  register,
  login,
  resetPassword,
  logout,
  onAuth,
  getCurrentUser,
  saveToCloud,
  loadFromCloud,
  saveProfilesToCloud,
  loadProfilesFromCloud,
  discoverProfilesFromCloud,
  testCloudConnection,
  subscribeToProfile
};
