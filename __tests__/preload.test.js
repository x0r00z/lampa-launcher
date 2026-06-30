jest.mock('electron');

describe('preload.js', () => {
  let contextBridge;
  let ipcRenderer;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    const electron = require('electron');
    contextBridge = electron.contextBridge;
    ipcRenderer = electron.ipcRenderer;
  });

  function loadPreload() {
    require('../preload.js');
    return require('electron');
  }

  it('should call contextBridge.exposeInMainWorld with electronAPI', () => {
    const { contextBridge: cb } = loadPreload();

    expect(cb.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.any(Object)
    );
  });

  it('should expose loadURL function that sends load-url IPC message', () => {
    const { contextBridge: cb, ipcRenderer: ipc } = loadPreload();

    const exposedAPI = cb.exposeInMainWorld.mock.calls[0][1];
    exposedAPI.loadURL('http://test.url');

    expect(ipc.send).toHaveBeenCalledWith('load-url', 'http://test.url');
  });

  it('should expose openSettings function that sends open-settings IPC message', () => {
    const { contextBridge: cb, ipcRenderer: ipc } = loadPreload();

    const exposedAPI = cb.exposeInMainWorld.mock.calls[0][1];
    exposedAPI.openSettings();

    expect(ipc.send).toHaveBeenCalledWith('open-settings');
  });

  it('should expose getSavedUrl function that invokes get-saved-url IPC handler', () => {
    const { contextBridge: cb, ipcRenderer: ipc } = loadPreload();
    ipc.invoke.mockResolvedValue('http://saved.url');

    const exposedAPI = cb.exposeInMainWorld.mock.calls[0][1];
    const result = exposedAPI.getSavedUrl();

    expect(ipc.invoke).toHaveBeenCalledWith('get-saved-url');
    return expect(result).resolves.toBe('http://saved.url');
  });

  it('should expose exactly three API methods', () => {
    const { contextBridge: cb } = loadPreload();

    const exposedAPI = cb.exposeInMainWorld.mock.calls[0][1];
    const methods = Object.keys(exposedAPI);

    expect(methods).toHaveLength(3);
    expect(methods).toContain('loadURL');
    expect(methods).toContain('openSettings');
    expect(methods).toContain('getSavedUrl');
  });

  it('should pass URL argument correctly to loadURL', () => {
    const { contextBridge: cb, ipcRenderer: ipc } = loadPreload();

    const exposedAPI = cb.exposeInMainWorld.mock.calls[0][1];
    exposedAPI.loadURL('http://example.com/path?query=1');

    expect(ipc.send).toHaveBeenCalledWith('load-url', 'http://example.com/path?query=1');
  });
});
