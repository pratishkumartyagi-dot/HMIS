const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = app.getPath ? app.getPath('userData') : (process.env.APPDATA || process.env.HOME || '/tmp');
const casesFile = path.join(dataDir, 'icd11-cases.json');
const settingsFile = path.join(dataDir, 'icd11-settings.json');
const legacyTasksFile = path.join(dataDir, 'tasks.json');

function readCases() {
  try {
    const raw = fs.readFileSync(casesFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {}
  // Try to migrate from legacy
  try {
    const raw = fs.readFileSync(legacyTasksFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? [] : [];
  } catch (err) {
    return [];
  }
}

function writeCases(cases) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const tmp = casesFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cases, null, 2), 'utf8');
    fs.renameSync(tmp, casesFile);
  } catch (e) {
    throw e;
  }
}

function readSettings() {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {
      clientId: '',
      clientSecret: '',
      apiRelease: '2026-01',
      apiLanguage: 'en'
    };
  }
}

function writeSettings(settings) {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const tmp = settingsFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8');
    fs.renameSync(tmp, settingsFile);
  } catch (e) {
    throw e;
  }
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 900,
    minHeight: 700,
    backgroundColor: '#0f1419',
    title: 'ICD-11 Coder',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('cases:load', () => readCases());
ipcMain.handle('tasks:load', () => readCases());

ipcMain.handle('cases:save', (_event, cases) => {
  if (!Array.isArray(cases)) return { ok: false, error: 'Invalid payload' };
  try {
    writeCases(cases);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle('tasks:save', (_event, cases) => {
  if (!Array.isArray(cases)) return { ok: false, error: 'Invalid payload' };
  try {
    writeCases(cases);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cases:export', async (_event, cases) => {
  if (!mainWindow) return { ok: false, error: 'No window' };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export ICD-11 Cases',
    defaultPath: 'icd11-cases.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify(cases, null, 2), 'utf8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle('tasks:export', async (_event, cases) => {
  if (!mainWindow) return { ok: false, error: 'No window' };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export ICD-11 Cases',
    defaultPath: 'icd11-cases.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify(cases, null, 2), 'utf8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cases:import', async () => {
  if (!mainWindow) return { ok: false, error: 'No window' };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import ICD-11 Cases',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || filePaths.length === 0) return { ok: false, canceled: true };
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: false, error: 'File is not a cases array' };
    return { ok: true, cases: parsed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
ipcMain.handle('tasks:import', async () => {
  if (!mainWindow) return { ok: false, error: 'No window' };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import ICD-11 Cases',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || filePaths.length === 0) return { ok: false, canceled: true };
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: false, error: 'File is not a cases array' };
    return { ok: true, cases: parsed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('settings:load', () => readSettings());

ipcMain.handle('settings:save', (_event, settings) => {
  try {
    writeSettings(settings);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

if (app.whenReady) {
  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
} else {
  // For some environments
  app.on('ready', () => {
    createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
