const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadURL: (url) => ipcRenderer.send('load-url', url),
  launchURL: (url) => ipcRenderer.send('launch-url', url),
  openSettings: () => ipcRenderer.send('open-settings'),
  getSavedUrl: () => ipcRenderer.invoke('get-saved-url'),
  getDefaultUrl: () => ipcRenderer.invoke('get-default-url')
});
