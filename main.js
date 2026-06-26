const { app, BrowserWindow, session, ipcMain, globalShortcut } = require('electron');
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
  mainWindow.loadURL(savedUrl).catch(() => {
    // If URL fails to load, show settings
    mainWindow.loadFile('index.html');
  });

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load URL:', errorDescription);
    mainWindow.loadFile('index.html');
  });
}

app.whenReady().then(() => {
  // Configure session for persistent cookies
  const defaultSession = session.defaultSession;
  
  // Cookies are automatically persisted by Electron session
  
  // Disable web security (CORS) for all requests
  app.commandLine.appendSwitch('disable-web-security');
  app.commandLine.appendSwitch('allow-running-insecure-content');

  createWindow();

  // Register F10 to open settings
  globalShortcut.register('F10', () => {
    if (mainWindow) {
      mainWindow.loadFile('index.html');
    }
  });

  // Register F12 to quit application
  globalShortcut.register('F12', () => {
    app.quit();
  });

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
  saveUrl(url);
  if (mainWindow) {
    mainWindow.loadURL(url).catch(() => {
      mainWindow.loadFile('index.html');
    });
  }
});

// IPC handler to open settings
ipcMain.on('open-settings', () => {
  if (mainWindow) {
    mainWindow.loadFile('index.html');
  }
});

// IPC handler to get saved URL
ipcMain.handle('get-saved-url', () => {
  return getSavedUrl();
});
