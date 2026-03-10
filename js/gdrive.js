// Google Drive integration via Google Identity Services + Drive API v3
// Uses OAuth2 popup — no backend needed

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const APP_FOLDER = 'Patrimoine SLV';

let gapiLoaded = false;
let gisLoaded = false;
let tokenClient = null;
let gdriveClientId = null;

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
    const resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${gapi.client.getToken().access_token}`,
        'Content-Type': 'application/json',
      },
      body: jsonString,
    });
    if (!resp.ok) throw new Error('Upload failed');
    return await resp.json();
  } else {
    // Create new file in folder
    metadata.parents = [folderId];
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${gapi.client.getToken().access_token}` },
      body: form,
    });
    if (!resp.ok) throw new Error('Upload failed');
    return await resp.json();
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
