const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');
const http      = require('http');
const { setupFirstRun } = require('./setup');
require('./ipc');

// ─── Paths ────────────────────────────────────────────────────────────────────

const isDev       = !app.isPackaged;
const RESOURCES   = isDev ? path.join(__dirname, '../..') : process.resourcesPath;
const BACKEND_DIR = path.join(RESOURCES, 'backend');
const FRONTEND_DIST = isDev ? null : path.join(RESOURCES, 'frontend', 'dist');

const API_PORT  = 3001;
const API_URL   = `http://localhost:${API_PORT}`;

// Em produção: carrega via file://
// Em dev: carrega do servidor Vite
const FRONTEND_URL = isDev
  ? 'http://localhost:5173'
  : `file://${FRONTEND_DIST}/index.html`.replace(/\\/g, '/');

// ─── Encontrar o executável Node.js ──────────────────────────────────────────
// Em produção, o electron-builder empacota o node.exe junto com o app

function findNodeExecutable() {
  // Locais comuns onde o Node.js é instalado no Windows
  const winPaths = [
    // PATH do sistema (funciona se Node.js está instalado)
    'node.exe',
    // Instalações padrão do Node.js no Windows
    path.join(process.env.ProgramFiles || 'C:\Program Files', 'nodejs', 'node.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\Program Files (x86)', 'nodejs', 'node.exe'),
    path.join(process.env.APPDATA || '', '..', 'Local', 'Programs', 'node', 'node.exe'),
    // NVM para Windows
    path.join(process.env.NVM_HOME || '', 'node.exe'),
  ];

  const unixPaths = ['node', '/usr/bin/node', '/usr/local/bin/node'];

  const candidates = process.platform === 'win32' ? winPaths : unixPaths;

  for (const candidate of candidates) {
    try {
      if (candidate === 'node.exe' || candidate === 'node') return candidate;
      if (fs.existsSync(candidate)) return candidate;
    } catch {}
  }

  return process.platform === 'win32' ? 'node.exe' : 'node';
}

// ─── Estado global ────────────────────────────────────────────────────────────

let mainWindow  = null;
let backendProc = null;
let tray        = null;

// ─── Instância única ──────────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── Iniciar backend ──────────────────────────────────────────────────────────

function startBackend() {
  return new Promise((resolve, reject) => {
    const nodeExe    = findNodeExecutable();
    const serverFile = path.join(BACKEND_DIR, 'dist', 'server.js');
    const envFile    = path.join(app.getPath('userData'), '.env');

    // Lê o .env do usuário
    const userEnv = loadEnvFile(envFile);

    backendProc = spawn(nodeExe, [serverFile], {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        NODE_ENV:  'production',
        PORT:      String(API_PORT),
        ...userEnv,
      },
      shell: false,
      windowsHide: true, // esconde a janela do cmd no Windows
    });

    backendProc.stdout?.on('data', d => {
      const msg = d.toString().trim();
      console.log('[backend]', msg);
    });

    backendProc.stderr?.on('data', d => {
      console.error('[backend]', d.toString().trim());
    });

    backendProc.on('error', err => {
      console.error('[backend] Erro ao iniciar:', err);
      reject(err);
    });

    // Aguarda o backend responder no /health
    waitForBackend(25, 600).then(resolve).catch(reject);
  });
}

function waitForBackend(retries = 25, delay = 600) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      http.get(`${API_URL}/health`, res => {
        if (res.statusCode === 200) {
          console.log('[main] Backend pronto!');
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };

    const retry = () => {
      attempts++;
      if (attempts >= retries) {
        return reject(new Error(
          `Backend não respondeu após ${retries} tentativas.\n` +
          `Verifique se o arquivo .env está configurado corretamente.`
        ));
      }
      setTimeout(check, delay);
    };

    // Primeira tentativa após 1s (tempo para o Node iniciar)
    setTimeout(check, 1000);
  });
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  try {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx < 0) return;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (key) vars[key] = val;
    });
  } catch {}
  return vars;
}

// ─── Janela principal ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1200,
    height: 760,
    minWidth:  900,
    minHeight: 600,
    title: 'AuraBot',
    backgroundColor: '#080809',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(FRONTEND_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimiza para bandeja ao clicar em fechar
  mainWindow.on('close', e => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Bandeja do sistema ───────────────────────────────────────────────────────

function createTray() {
  const iconFile = path.join(__dirname, '..', 'assets',
    process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  );

  const icon = fs.existsSync(iconFile)
    ? nativeImage.createFromPath(iconFile)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('AuraBot — clique para abrir');

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '🎵 Abrir AuraBot', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Sair',             click: () => { app.isQuitting = true; app.quit(); } },
  ]));

  tray.on('double-click', () => mainWindow?.show());
}

// ─── Tela de configuração (primeira execução) ─────────────────────────────────

function needsSetup() {
  const envPath = path.join(app.getPath('userData'), '.env');
  if (!fs.existsSync(envPath)) return true;

  const content = fs.readFileSync(envPath, 'utf-8');
  const hasSpotify  = content.includes('SPOTIFY_CLIENT_ID=') && 
                      !content.includes('SPOTIFY_CLIENT_ID=seu_');
  const hasYoutube  = content.includes('YOUTUBE_API_KEY=') && 
                      !content.includes('YOUTUBE_API_KEY=sua_');
  return !(hasSpotify && hasYoutube);
}

function openConfigScreen() {
  return new Promise(resolve => {
    const configWin = new BrowserWindow({
      width:  580,
      height: 700,
      resizable: false,
      title: 'AuraBot — Configuração inicial',
      backgroundColor: '#080809',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    configWin.loadFile(path.join(__dirname, 'config-screen.html'));

    const { ipcMain } = require('electron');
    ipcMain.once('config-saved',   () => { configWin.close(); resolve(true); });
    ipcMain.once('config-skipped', () => { configWin.close(); resolve(false); });
    configWin.on('closed', () => resolve(false));
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    // 1. Gera JWT secrets na primeira execução
    setupFirstRun();

    // 2. Tela de configuração de APIs (se necessário)
    if (needsSetup()) {
      await openConfigScreen();
    }

    // 3. Inicia o backend Node.js em segundo plano
    console.log('[main] Iniciando backend...');

    const splash = createSplash();

    try {
      await startBackend();
    } finally {
      splash.close();
    }

    // 4. Abre janela principal e bandeja
    createWindow();
    createTray();

  } catch (err) {
    console.error('[main] Erro fatal:', err);
    dialog.showErrorBox(
      'AuraBot — Erro ao iniciar',
      `Não foi possível iniciar o AuraBot.\n\n${err.message}\n\n` +
      `Verifique se o arquivo de configuração está correto.\n` +
      `Localização: ${path.join(app.getPath('userData'), '.env')}`
    );
    app.quit();
  }
});

// ─── Splash screen (carregando...) ───────────────────────────────────────────

function createSplash() {
  const splash = new BrowserWindow({
    width: 380, height: 220,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: false },
  });

  splash.loadURL(`data:text/html,
    <html><body style="background:#080809;display:flex;flex-direction:column;
      align-items:center;justify-content:center;height:100vh;margin:0;
      font-family:system-ui;color:#f0ede8;border-radius:16px;">
      <div style="font-size:48px;margin-bottom:16px">🎵</div>
      <div style="font-size:22px;font-weight:700;margin-bottom:8px">AuraBot</div>
      <div style="font-size:13px;color:#8a8880">Iniciando...</div>
    </body></html>
  `);

  return splash;
}

app.on('window-all-closed', () => {
  // No macOS mantém na bandeja
  if (process.platform !== 'darwin') {
    // Mantém na bandeja — não fecha
  }
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
  else mainWindow.show();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (backendProc && !backendProc.killed) {
    backendProc.kill();
  }
});
