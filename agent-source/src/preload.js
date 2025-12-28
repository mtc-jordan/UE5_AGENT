/**
 * Preload Script - Secure Bridge between Main and Renderer
 * 
 * Exposes safe APIs to the renderer process via contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Authentication
  saveToken: (token) => ipcRenderer.invoke('save-token', token),
  clearToken: () => ipcRenderer.invoke('clear-token'),
  
  // Connection
  getConnectionState: () => ipcRenderer.invoke('get-connection-state'),
  connectCloud: () => ipcRenderer.invoke('connect-cloud'),
  disconnectCloud: () => ipcRenderer.invoke('disconnect-cloud'),
  connectUE5: () => ipcRenderer.invoke('connect-ue5'),
  disconnectUE5: () => ipcRenderer.invoke('disconnect-ue5'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Event listeners
  onConnectionState: (callback) => {
    ipcRenderer.on('connection-state', (event, state) => callback(state));
  },
  onShowSettings: (callback) => {
    ipcRenderer.on('show-settings', () => callback());
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
