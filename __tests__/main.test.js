const path = require('path');

jest.mock('electron');
jest.mock('fs');

describe('main.js', () => {
  let fs;
  let electron;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-require mocks after module reset to get fresh instances
    fs = require('fs');
    electron = require('electron');

    // Setup path mock
    const pathMock = require('path');
    jest.spyOn(pathMock, 'join').mockImplementation((...args) => args.join('/'));
    jest.spyOn(pathMock, 'dirname').mockImplementation((p) => p.split('/').slice(0, -1).join('/'));

    // Default mock setups
    electron.app.getPath.mockReturnValue('/tmp/test-user-data');
    // Return a synchronous thenable so .then() runs immediately during require
    electron.app.whenReady.mockReturnValue({
      then: (cb) => { cb(); return { catch: () => {} }; }
    });
    electron.globalShortcut.register.mockReturnValue(true);
    electron.BrowserWindow.getAllWindows.mockReturnValue([]);
  });

  function loadMainModule() {
    require('../main.js');
    // Re-require electron to get the same instance main.js used
    return require('electron');
  }

  describe('getSavedUrl', () => {
    it('should return saved URL from settings file when it exists', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ url: 'http://custom.url' }));

      const { ipcMain } = loadMainModule();

      const handleCall = ipcMain.handle.mock.calls.find(c => c[0] === 'get-saved-url');
      expect(handleCall).toBeDefined();

      const handler = handleCall[1];
      const result = handler();
      expect(result).toBe('http://custom.url');
    });

    it('should return DEFAULT_URL when settings file does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const { ipcMain } = loadMainModule();

      const handleCall = ipcMain.handle.mock.calls.find(c => c[0] === 'get-saved-url');
      const handler = handleCall[1];
      const result = handler();
      expect(result).toBe('http://lampa.mx');
    });

    it('should return DEFAULT_URL when settings file has no url field', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({}));

      const { ipcMain } = loadMainModule();

      const handleCall = ipcMain.handle.mock.calls.find(c => c[0] === 'get-saved-url');
      const handler = handleCall[1];
      const result = handler();
      expect(result).toBe('http://lampa.mx');
    });

    it('should return DEFAULT_URL when JSON parsing fails', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');

      const { ipcMain } = loadMainModule();

      const handleCall = ipcMain.handle.mock.calls.find(c => c[0] === 'get-saved-url');
      const handler = handleCall[1];
      const result = handler();
      expect(result).toBe('http://lampa.mx');
    });

    it('should return DEFAULT_URL when fs.existsSync throws', () => {
      fs.existsSync.mockImplementation(() => { throw new Error('fs error'); });

      const { ipcMain } = loadMainModule();

      const handleCall = ipcMain.handle.mock.calls.find(c => c[0] === 'get-saved-url');
      const handler = handleCall[1];
      const result = handler();
      expect(result).toBe('http://lampa.mx');
    });
  });

  describe('saveUrl (via load-url IPC)', () => {
    it('should save URL to settings file', () => {
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      const { ipcMain } = loadMainModule();

      const loadUrlCall = ipcMain.on.mock.calls.find(c => c[0] === 'load-url');
      const handler = loadUrlCall[1];

      handler({}, 'http://test.url');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({ url: 'http://test.url' }),
        'utf8'
      );
    });

    it('should create directory if it does not exist', () => {
      // First call for settings read (existsSync on STORAGE_FILE) = false
      // Second call inside saveUrl for dir check = false
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      const { ipcMain } = loadMainModule();

      const loadUrlCall = ipcMain.on.mock.calls.find(c => c[0] === 'load-url');
      loadUrlCall[1]({}, 'http://test.url');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should handle write errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => { throw new Error('write error'); });

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { ipcMain } = loadMainModule();

      const loadUrlCall = ipcMain.on.mock.calls.find(c => c[0] === 'load-url');

      expect(() => loadUrlCall[1]({}, 'http://test.url')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Error saving settings:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('createWindow', () => {
    it('should create a BrowserWindow with correct options', () => {
      fs.existsSync.mockReturnValue(false);

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      const { BrowserWindow } = loadMainModule();

      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1280,
          height: 720,
          fullscreen: true,
          autoHideMenuBar: true,
          webPreferences: expect.objectContaining({
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false
          })
        })
      );
    });

    it('should load saved URL on window creation', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ url: 'http://saved.url' }));

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      loadMainModule();

      expect(mockWindow.loadURL).toHaveBeenCalledWith('http://saved.url');
    });

    it('should fallback to settings page when URL fails to load', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ url: 'http://invalid.url' }));

      const mockWindow = {
        loadURL: jest.fn().mockRejectedValue(new Error('load failed')),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      loadMainModule();

      await new Promise(resolve => setImmediate(resolve));

      expect(mockWindow.loadFile).toHaveBeenCalledWith('index.html');
    });

    it('should register did-fail-load handler on webContents', () => {
      fs.existsSync.mockReturnValue(false);

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      loadMainModule();

      expect(mockWindow.webContents.on).toHaveBeenCalledWith(
        'did-fail-load',
        expect.any(Function)
      );
    });

    it('should load settings page on did-fail-load event', () => {
      fs.existsSync.mockReturnValue(false);

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      loadMainModule();

      const failLoadHandler = mockWindow.webContents.on.mock.calls.find(
        c => c[0] === 'did-fail-load'
      )[1];

      failLoadHandler({}, -6, 'ERR_CONNECTION_REFUSED');

      expect(mockWindow.loadFile).toHaveBeenCalledWith('index.html');
    });
  });

  describe('app lifecycle', () => {
    it('should call app.whenReady', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const { app } = loadMainModule();

      expect(app.whenReady).toHaveBeenCalled();
    });

    it('should append command line switches on ready', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const { app } = loadMainModule();

      expect(app.commandLine.appendSwitch).toHaveBeenCalledWith('disable-web-security');
      expect(app.commandLine.appendSwitch).toHaveBeenCalledWith('allow-running-insecure-content');
    });

    it('should register F10 shortcut to open settings', () => {
      fs.existsSync.mockReturnValue(false);

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      const { globalShortcut } = loadMainModule();

      const f10Call = globalShortcut.register.mock.calls.find(c => c[0] === 'F10');
      expect(f10Call).toBeDefined();

      // Trigger F10 callback
      f10Call[1]();
      expect(mockWindow.loadFile).toHaveBeenCalledWith('index.html');
    });

    it('should register F8 shortcut to quit app', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const { app, globalShortcut } = loadMainModule();

      const f8Call = globalShortcut.register.mock.calls.find(c => c[0] === 'F8');
      expect(f8Call).toBeDefined();

      f8Call[1]();
      expect(app.quit).toHaveBeenCalled();
    });

    it('should register window-all-closed handler', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const { app } = loadMainModule();

      const windowClosedCall = app.on.mock.calls.find(c => c[0] === 'window-all-closed');
      expect(windowClosedCall).toBeDefined();
    });

    it('should quit app on window-all-closed when not on macOS', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const { app, globalShortcut } = loadMainModule();

      const windowClosedCall = app.on.mock.calls.find(c => c[0] === 'window-all-closed');
      windowClosedCall[1]();

      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
      expect(app.quit).toHaveBeenCalled();

      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });

    it('should not quit app on window-all-closed on macOS', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const { app, globalShortcut } = loadMainModule();

      const windowClosedCall = app.on.mock.calls.find(c => c[0] === 'window-all-closed');
      app.quit.mockClear();
      windowClosedCall[1]();

      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
      expect(app.quit).not.toHaveBeenCalled();

      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    });

    it('should unregister shortcuts on will-quit', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const { app, globalShortcut } = loadMainModule();

      const willQuitCall = app.on.mock.calls.find(c => c[0] === 'will-quit');
      expect(willQuitCall).toBeDefined();

      globalShortcut.unregisterAll.mockClear();
      willQuitCall[1]();
      expect(globalShortcut.unregisterAll).toHaveBeenCalled();
    });

    it('should create window on activate when no windows exist', () => {
      fs.existsSync.mockReturnValue(false);

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);
      electron.BrowserWindow.getAllWindows.mockReturnValue([]);

      const { app, BrowserWindow } = loadMainModule();

      const activateCall = app.on.mock.calls.find(c => c[0] === 'activate');
      expect(activateCall).toBeDefined();

      BrowserWindow.mockClear();
      activateCall[1]();
      expect(BrowserWindow).toHaveBeenCalled();
    });
  });

  describe('IPC handlers', () => {
    it('should register load-url handler', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const { ipcMain } = loadMainModule();

      const loadUrlCall = ipcMain.on.mock.calls.find(c => c[0] === 'load-url');
      expect(loadUrlCall).toBeDefined();
    });

    it('should save and load URL on load-url event', () => {
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      const { ipcMain } = loadMainModule();

      const loadUrlCall = ipcMain.on.mock.calls.find(c => c[0] === 'load-url');
      loadUrlCall[1]({}, 'http://new.url');

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockWindow.loadURL).toHaveBeenCalledWith('http://new.url');
    });

    it('should fallback to settings on load-url failure', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});

      const mockWindow = {
        loadURL: jest.fn()
          .mockResolvedValueOnce(undefined) // first call from createWindow
          .mockRejectedValueOnce(new Error('fail')), // second call from IPC handler
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      const { ipcMain } = loadMainModule();

      const loadUrlCall = ipcMain.on.mock.calls.find(c => c[0] === 'load-url');
      loadUrlCall[1]({}, 'http://bad.url');

      await new Promise(resolve => setImmediate(resolve));

      expect(mockWindow.loadFile).toHaveBeenCalledWith('index.html');
    });

    it('should register open-settings handler', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const { ipcMain } = loadMainModule();

      const openSettingsCall = ipcMain.on.mock.calls.find(c => c[0] === 'open-settings');
      expect(openSettingsCall).toBeDefined();
    });

    it('should load settings page on open-settings event', () => {
      fs.existsSync.mockReturnValue(false);

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);

      const { ipcMain } = loadMainModule();

      const openSettingsCall = ipcMain.on.mock.calls.find(c => c[0] === 'open-settings');
      openSettingsCall[1]();

      expect(mockWindow.loadFile).toHaveBeenCalledWith('index.html');
    });

    it('should register get-saved-url handler', () => {
      fs.existsSync.mockReturnValue(false);
      electron.BrowserWindow.mockImplementation(() => ({
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      }));

      const { ipcMain } = loadMainModule();

      const getSavedUrlCall = ipcMain.handle.mock.calls.find(c => c[0] === 'get-saved-url');
      expect(getSavedUrlCall).toBeDefined();
    });

    it('should not crash load-url when mainWindow is null', () => {
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockImplementation(() => {});

      // Don't call createWindow by making whenReady a no-op
      electron.app.whenReady.mockReturnValue({ then: () => ({ catch: () => {} }) });

      const { ipcMain } = loadMainModule();

      const loadUrlCall = ipcMain.on.mock.calls.find(c => c[0] === 'load-url');
      expect(() => loadUrlCall[1]({}, 'http://test.url')).not.toThrow();
      // saveUrl should still be called
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should not crash open-settings when mainWindow is null', () => {
      fs.existsSync.mockReturnValue(false);

      // Don't call createWindow
      electron.app.whenReady.mockReturnValue({ then: () => ({ catch: () => {} }) });

      const { ipcMain } = loadMainModule();

      const openSettingsCall = ipcMain.on.mock.calls.find(c => c[0] === 'open-settings');
      expect(() => openSettingsCall[1]()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should not create window on activate when windows exist', () => {
      fs.existsSync.mockReturnValue(false);

      const mockWindow = {
        loadURL: jest.fn().mockResolvedValue(undefined),
        loadFile: jest.fn(),
        webContents: { on: jest.fn() }
      };
      electron.BrowserWindow.mockImplementation(() => mockWindow);
      electron.BrowserWindow.getAllWindows.mockReturnValue([mockWindow]);

      const { app, BrowserWindow } = loadMainModule();

      const activateCall = app.on.mock.calls.find(c => c[0] === 'activate');
      BrowserWindow.mockClear();
      activateCall[1]();
      expect(BrowserWindow).not.toHaveBeenCalled();
    });

  });
});
