const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startSignaling: () => ipcRenderer.invoke('start-signaling'),
    stopSignaling: () => ipcRenderer.invoke('stop-signaling'),
    getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
});
