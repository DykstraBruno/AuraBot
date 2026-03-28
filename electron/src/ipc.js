const { ipcMain, shell, app } = require('electron');

ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('open-external', (_event, url) => shell.openExternal(url));
