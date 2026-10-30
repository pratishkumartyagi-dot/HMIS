const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskAPI', {
  load: () => ipcRenderer.invoke('cases:load'),
  save: (cases) => ipcRenderer.invoke('cases:save', cases),
  exportCases: (cases) => ipcRenderer.invoke('cases:export', cases),
  importCases: () => ipcRenderer.invoke('cases:import'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  // Backward compatibility
  loadTasks: () => ipcRenderer.invoke('cases:load'),
  saveTasks: (tasks) => ipcRenderer.invoke('cases:save', tasks),
  exportTasks: (tasks) => ipcRenderer.invoke('cases:export', tasks),
  importTasks: () => ipcRenderer.invoke('cases:import')
});


