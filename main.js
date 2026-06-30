// noinspection JSIgnoredPromiseFromCall

const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { DEFAULT_URL, SETTINGS_PAGE } = require('./config');

let mainWindow;
const STORAGE_FILE = path.join(app.getPath('userData'), 'settings.json');

function getSavedUrl() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
      return data.url || DEFAULT_URL;
    }
  } catch (error) {
    console.error('Error reading settings:', error);
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
    console.error('Error saving settings:', error);
  }
}

function showSettings() {
  if (mainWindow) {
    mainWindow.loadFile(SETTINGS_PAGE);
  }
}

function loadUrlWithFallback(url) {
  if (mainWindow) {
    mainWindow.loadURL(url).catch(() => {
      showSettings();
    });
  }
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

  const savedUrl = getSavedUrl();
  loadUrlWithFallback(savedUrl);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load URL:', errorDescription);
    showSettings();
  });
}

app.whenReady().then(() => {
  // Disable web security (CORS) for all requests
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('allow-running-insecure-content');

  createWindow();

  const f10Registered = globalShortcut.register('F10', () => {
    showSettings();
  });
  console.log('F10 shortcut registered:', f10Registered);

  const f8Registered = globalShortcut.register('F8', () => {
    app.quit();
  });
  console.log('F8 shortcut registered:', f8Registered);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Save URL and load it
ipcMain.on('load-url', (event, url) => {
  saveUrl(url);
  loadUrlWithFallback(url);
});

// Load URL without saving
ipcMain.on('launch-url', (event, url) => {
  loadUrlWithFallback(url);
});

// Open settings page
ipcMain.on('open-settings', () => {
  showSettings();
});

// Get saved URL
ipcMain.handle('get-saved-url', () => {
  return getSavedUrl();
});

// Get default URL so the renderer doesn't need its own copy
ipcMain.handle('get-default-url', () => {
  return DEFAULT_URL;
});
