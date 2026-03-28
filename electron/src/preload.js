const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs seguras para o frontend React
contextBridge.exposeInMainWorld('electronAPI', {
  // Versão do app
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Abre link externo no navegador do sistema
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Plataforma
  platform: process.platform,

  // Indica que está rodando dentro do Electron
  isElectron: true,
});
