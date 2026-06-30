const BrowserWindow = jest.fn().mockImplementation(() => ({
  loadURL: jest.fn().mockResolvedValue(undefined),
  loadFile: jest.fn().mockResolvedValue(undefined),
  webContents: {
    on: jest.fn()
  }
}));

BrowserWindow.getAllWindows = jest.fn().mockReturnValue([]);

const app = {
  getPath: jest.fn().mockReturnValue('/tmp/test-user-data'),
  whenReady: jest.fn().mockResolvedValue(undefined),
  commandLine: {
    appendSwitch: jest.fn()
  },
  on: jest.fn(),
  quit: jest.fn()
};

const ipcMain = {
  on: jest.fn(),
  handle: jest.fn()
};

const globalShortcut = {
  register: jest.fn().mockReturnValue(true),
  unregisterAll: jest.fn()
};

const ipcRenderer = {
  send: jest.fn(),
  invoke: jest.fn()
};

const contextBridge = {
  exposeInMainWorld: jest.fn()
};

module.exports = {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  ipcRenderer,
  contextBridge
};
