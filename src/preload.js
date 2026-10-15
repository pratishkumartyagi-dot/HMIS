const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskAPI', {
  load: () => ipcRenderer.invoke('tasks:load'),
  save: (tasks) => ipcRenderer.invoke('tasks:save', tasks),
  exportTasks: (tasks) => ipcRenderer.invoke('tasks:export', tasks),
  importTasks: () => ipcRenderer.invoke('tasks:import')
});
