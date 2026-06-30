// noinspection JSIgnoredPromiseFromCall

const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const DEFAULT_URL = 'http://lampa.mx';
const STORAGE_FILE = path.join(app.getPath('userData'), 'settings.json');

function getSavedUrl() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
      return data.url || DEFAULT_URL;
    }
  } catch (error) {
    console.error(`Error reading settings from ${STORAGE_FILE}:`, error.message);
    notifyRenderer('settings-error', `Failed to read settings: ${error.message}`);
  }
  return DEFAULT_URL;
}

function saveUrl(url) {
  try {
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({ url }), 'utf8');
  } catch (error) {
    console.error(`Error saving settings to ${STORAGE_FILE}:`, error.message);
    notifyRenderer('settings-error', `Failed to save settings: ${error.message}`);
  }
}

function notifyRenderer(channel, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, message);
  }
}

function loadFileSafe(filePath) {
  return mainWindow.loadFile(filePath).catch((err) => {
    console.error(`Critical: failed to load fallback file "${filePath}":`, err.message);
    dialog.showErrorBox(
      'Lampa Launcher Error',
      `Could not load the settings page (${filePath}).\n\n${err.message}`
    );
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, 
    height: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disable CORS
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Try to load saved URL, fallback to settings on error
  const savedUrl = getSavedUrl();
  mainWindow.loadURL(savedUrl).catch((error) => {
    console.error(`Failed to load URL "${savedUrl}":`, error.message);
    loadFileSafe('index.html');
  });

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load URL "${validatedURL}" (code ${errorCode}): ${errorDescription}`);
    notifyRenderer('load-error', {
      url: validatedURL,
      code: errorCode,
      description: errorDescription
    });
    loadFileSafe('index.html');
  });
}

app.whenReady().then(() => {
  // Cookies are automatically persisted by Electron session
  
  // Disable web security (CORS) for all requests
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('allow-running-insecure-content');

  createWindow();

  // Register keyboard shortcuts
  const shortcuts = [
    { key: 'F10', action: () => { if (mainWindow) loadFileSafe('index.html'); }, label: 'open settings' },
    { key: 'F8', action: () => { app.quit(); }, label: 'quit application' }
  ];

  for (const { key, action, label } of shortcuts) {
    const registered = globalShortcut.register(key, action);
    if (!registered) {
      console.error(`Failed to register shortcut ${key} (${label}). The key may be in use by another application.`);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// IPC handler to load URL
ipcMain.on('load-url', (event, url) => {
  if (!url || typeof url !== 'string') {
    console.error('load-url: received invalid URL:', url);
    notifyRenderer('load-error', { url, code: -1, description: 'Invalid URL provided' });
    return;
  }

  saveUrl(url);
  if (mainWindow) {
    mainWindow.loadURL(url).catch((error) => {
      console.error(`load-url: failed to load "${url}":`, error.message);
      notifyRenderer('load-error', {
        url,
        code: -1,
        description: error.message
      });
      loadFileSafe('index.html');
    });
  }
});

// IPC handler to open settings
ipcMain.on('open-settings', () => {
  if (mainWindow) {
    loadFileSafe('index.html');
  }
});

// IPC handler to get saved URL
ipcMain.handle('get-saved-url', () => {
  return getSavedUrl();
});
