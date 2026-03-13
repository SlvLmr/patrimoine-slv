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

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ⬇️ REMPLACE CETTE CONFIG PAR LA TIENNE (ou configure via l'interface) ⬇️
const hardcodedConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const FIREBASE_CONFIG_KEY = 'patrimoine-slv-firebase-config';

let app = null;
let auth = null;
let db = null;
let initialized = false;

function getConfig() {
  // Priority: hardcoded > localStorage
  if (hardcodedConfig.apiKey && hardcodedConfig.projectId) return hardcodedConfig;
  try {
    const stored = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return hardcodedConfig;
}

function isConfigured() {
  const config = getConfig();
  return !!(config.apiKey && config.projectId);
}

function saveFirebaseConfig(config) {
  localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
  // Reset so next call re-initializes with new config
  initialized = false;
  app = null;
  auth = null;
  db = null;
}

function initFirebase() {
  if (initialized) return { auth, db };
  if (!isConfigured()) return { auth: null, db: null };

  try {
    const config = getConfig();
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
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
  return createUserWithEmailAndPassword(auth, email, password);
}

async function login(email, password) {
  const { auth } = initFirebase();
  if (!auth) throw new Error('Firebase non configuré');
  return signInWithEmailAndPassword(auth, email, password);
}

async function logout() {
  const { auth } = initFirebase();
  if (!auth) return;
  return signOut(auth);
}

function onAuth(callback) {
  const { auth } = initFirebase();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

function getCurrentUser() {
  const { auth } = initFirebase();
  return auth?.currentUser || null;
}

// Firestore sync functions
async function saveToCloud(userId, profileId, data) {
  const { db } = initFirebase();
  if (!db || !userId) return false;
  try {
    await setDoc(doc(db, 'users', userId, 'profiles', profileId), {
      data: JSON.stringify(data),
      updatedAt: new Date().toISOString()
    });
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
    const snap = await getDoc(doc(db, 'users', userId, 'profiles', profileId));
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
    await setDoc(doc(db, 'users', userId, 'meta'), {
      profiles: JSON.stringify(profiles),
      updatedAt: new Date().toISOString()
    });
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
    const snap = await getDoc(doc(db, 'users', userId, 'meta'));
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
  initFirebase,
  saveFirebaseConfig,
  register,
  login,
  logout,
  onAuth,
  getCurrentUser,
  saveToCloud,
  loadFromCloud,
  saveProfilesToCloud,
  loadProfilesFromCloud
};
