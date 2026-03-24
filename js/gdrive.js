// Google Drive integration via Google Identity Services + Drive API v3
// Uses OAuth2 popup — no backend needed

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const APP_FOLDER = 'Patrimoine SLV';
const AUTOSAVE_KEY = 'patrimoine-slv-gdrive-autosave';
const AUTOSAVE_DEBOUNCE_MS = 5000; // 5 seconds debounce

let gapiLoaded = false;
let gisLoaded = false;
let tokenClient = null;
let gdriveClientId = null;
let _autoSaveTimer = null;
let _autoSaveListeners = [];

// Load Google API scripts dynamically
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensureGapiLoaded() {
  if (gapiLoaded) return;
  await loadScript('https://apis.google.com/js/api.js');
  await new Promise((resolve) => gapi.load('client', resolve));
  await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
  gapiLoaded = true;
}

async function ensureGisLoaded() {
  if (gisLoaded) return;
  await loadScript('https://accounts.google.com/gsi/client');
  gisLoaded = true;
}

function getClientId() {
  if (gdriveClientId) return gdriveClientId;
  // Try to read from localStorage config
  gdriveClientId = localStorage.getItem('patrimoine-slv-gdrive-client-id') || '';
  return gdriveClientId;
}

export function setClientId(id) {
  gdriveClientId = id;
  localStorage.setItem('patrimoine-slv-gdrive-client-id', id);
}

export function isGdriveConfigured() {
  return !!getClientId();
}

// Get OAuth token via popup
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const clientId = getClientId();
    if (!clientId) {
      reject(new Error('Google Drive non configuré'));
      return;
    }

    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) reject(new Error(resp.error));
          else resolve(resp.access_token);
        },
      });
    }

    // Check if we already have a valid token
    const token = gapi.client.getToken();
    if (token && token.access_token) {
      resolve(token.access_token);
    } else {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  });
}

// Find or create the app folder
async function getAppFolderId() {
  const resp = await gapi.client.drive.files.list({
    q: `name='${APP_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (resp.result.files && resp.result.files.length > 0) {
    return resp.result.files[0].id;
  }
  // Create folder
  const create = await gapi.client.drive.files.create({
    resource: { name: APP_FOLDER, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  return create.result.id;
}

// Save JSON to Google Drive
export async function saveToDrive(jsonString, filename) {
  await ensureGapiLoaded();
  await ensureGisLoaded();
  await getAccessToken();

  const folderId = await getAppFolderId();

  // Check if file already exists
  const existing = await gapi.client.drive.files.list({
    q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  const metadata = { name: filename, mimeType: 'application/json' };
  const blob = new Blob([jsonString], { type: 'application/json' });

  const form = new FormData();

  if (existing.result.files && existing.result.files.length > 0) {
    // Update existing file
    const fileId = existing.result.files[0].id;
    const controller1 = new AbortController();
    const tid1 = setTimeout(() => controller1.abort(), 30000);
    let resp;
    try {
      resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
          'Content-Type': 'application/json',
        },
        body: jsonString,
        signal: controller1.signal,
      });
    } finally {
      clearTimeout(tid1);
    }
    if (!resp.ok) throw new Error('Upload failed');
    return await resp.json();
  } else {
    // Create new file in folder
    metadata.parents = [folderId];
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const controller2 = new AbortController();
    const tid2 = setTimeout(() => controller2.abort(), 30000);
    let resp2;
    try {
      resp2 = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${gapi.client.getToken().access_token}` },
        body: form,
        signal: controller2.signal,
      });
    } finally {
      clearTimeout(tid2);
    }
    if (!resp2.ok) throw new Error('Upload failed');
    return await resp2.json();
  }
}

// List JSON files from app folder on Drive
export async function listDriveFiles() {
  await ensureGapiLoaded();
  await ensureGisLoaded();
  await getAccessToken();

  const folderId = await getAppFolderId();
  const resp = await gapi.client.drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/json' and trashed=false`,
    fields: 'files(id, name, modifiedTime, size)',
    orderBy: 'modifiedTime desc',
    spaces: 'drive',
  });
  return resp.result.files || [];
}

// Download a file from Drive by ID
export async function loadFromDrive(fileId) {
  await ensureGapiLoaded();
  const resp = await gapi.client.drive.files.get({
    fileId,
    alt: 'media',
  });
  return typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.result);
}

// --- Auto-save to Google Drive ---

export function isAutoSaveEnabled() {
  return localStorage.getItem(AUTOSAVE_KEY) === 'true';
}

export function setAutoSaveEnabled(enabled) {
  localStorage.setItem(AUTOSAVE_KEY, enabled ? 'true' : 'false');
  if (!enabled && _autoSaveTimer) {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = null;
  }
  _notifyAutoSaveListeners(enabled ? 'enabled' : 'disabled');
}

export function onAutoSaveStatus(listener) {
  _autoSaveListeners.push(listener);
  return () => { _autoSaveListeners = _autoSaveListeners.filter(l => l !== listener); };
}

function _notifyAutoSaveListeners(status, detail) {
  _autoSaveListeners.forEach(l => l(status, detail));
}

// Called by Store after each save — debounced
export function scheduleAutoSave(profileName, exportDataFn) {
  if (!isAutoSaveEnabled() || !isGdriveConfigured()) return;

  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);

  _autoSaveTimer = setTimeout(async () => {
    _autoSaveTimer = null;
    _notifyAutoSaveListeners('saving');
    try {
      const filename = `patrimoine-${profileName.toLowerCase().replace(/\s+/g, '-')}.json`;
      const data = exportDataFn();
      await saveToDrive(data, filename);
      _notifyAutoSaveListeners('saved', new Date());
    } catch (err) {
      console.error('Auto-save Drive error:', err);
      _notifyAutoSaveListeners('error', err.message);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}
