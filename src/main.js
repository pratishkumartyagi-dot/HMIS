const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = app.getPath('userData');
const dataFile = path.join(dataDir, 'tasks.json');

function readTasks() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeTasks(tasks) {
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(tasks, null, 2), 'utf8');
  fs.renameSync(tmp, dataFile);
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 560,
    minHeight: 420,
    backgroundColor: '#12141c',
    title: 'TaskDeck',
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

ipcMain.handle('tasks:load', () => readTasks());

ipcMain.handle('tasks:save', (_event, tasks) => {
  if (!Array.isArray(tasks)) return { ok: false, error: 'Invalid payload' };
  try {
    writeTasks(tasks);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tasks:export', async (_event, tasks) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export tasks',
    defaultPath: 'tasks.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2), 'utf8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tasks:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import tasks',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || filePaths.length === 0) return { ok: false, canceled: true };
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { ok: false, error: 'File is not a task array' };
    return { ok: true, tasks: parsed };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
