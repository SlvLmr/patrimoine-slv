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

// Retry helper for cloud operations
async function withRetry(fn, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

// Firestore sync functions
async function saveToCloud(userId, profileId, data) {
  const { db } = initFirebase();
  if (!db || !userId) return false;
  try {
    await withRetry(() => _firebaseFirestore.setDoc(
      _firebaseFirestore.doc(db, 'users', userId, 'profiles', profileId), {
      data: JSON.stringify(data),
      updatedAt: new Date().toISOString()
    }));
    return true;
  } catch (e) {
    console.error('Cloud save error:', e);
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
      _firebaseFirestore.doc(db, 'users', userId, 'meta'), {
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
      _firebaseFirestore.doc(db, 'users', userId, 'meta')));
    if (snap.exists()) {
      return JSON.parse(snap.data().profiles);
    }
    return null;
  } catch (e) {
    console.error('Cloud load profiles error:', e);
    return null;
  }
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
  loadProfilesFromCloud
};
