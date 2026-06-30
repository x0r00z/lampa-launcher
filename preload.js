const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadURL: (url) => ipcRenderer.send('load-url', url),
  openSettings: () => ipcRenderer.send('open-settings'),
  getSavedUrl: () => ipcRenderer.invoke('get-saved-url'),
  onLoadError: (callback) => {
    ipcRenderer.on('load-error', (_event, data) => callback(data));
  },
  onSettingsError: (callback) => {
    ipcRenderer.on('settings-error', (_event, message) => callback(message));
  }
});
