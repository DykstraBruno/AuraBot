const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require('electron');
const { spawn }  = require('child_process');
const path       = require('path');
const fs         = require('fs');
const http       = require('http');
const { setupFirstRun } = require('./setup');
require('./ipc'); // registra handlers IPC

// ─── Paths ────────────────────────────────────────────────────────────────────

const isDev        = !app.isPackaged;
const ROOT         = isDev ? path.join(__dirname, '../..') : process.resourcesPath;
const BACKEND_DIR  = isDev ? path.join(ROOT, 'backend')       : path.join(ROOT, 'backend');
const FRONTEND_DIR = isDev ? null                              : path.join(ROOT, 'frontend', 'dist');

const API_PORT     = 3001;
const API_URL      = `http://localhost:${API_PORT}`;
const FRONTEND_URL = isDev ? 'http://localhost:5173' : `file://${FRONTEND_DIR}/index.html`;

// ─── Estado global ────────────────────────────────────────────────────────────

let mainWindow   = null;
let backendProc  = null;
let tray         = null;
let backendReady = false;

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

// ─── Iniciar backend Node.js ──────────────────────────────────────────────────

function startBackend() {
  return new Promise((resolve, reject) => {
    // Encontra o executável node
    const nodeBin = process.execPath.includes('electron')
      ? (process.platform === 'win32' ? 'node.exe' : 'node')
      : process.execPath;

    const entryPoint = path.join(BACKEND_DIR, 'dist', 'server.js');

    // Em dev: usa tsx direto
    const args = isDev
      ? [path.join(BACKEND_DIR, 'src', 'server.ts')]
      : [entryPoint];

    const cmd = isDev ? 'npx' : nodeBin;
    const finalArgs = isDev ? ['tsx', ...args] : args;

    backendProc = spawn(cmd, finalArgs, {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        NODE_ENV: isDev ? 'development' : 'production',
        PORT: String(API_PORT),
        // Em produção, usa o .env dentro da pasta de recursos
        ...(isDev ? {} : loadEnvFile()),
      },
      shell: process.platform === 'win32',
    });

    backendProc.stdout?.on('data', d => {
      const msg = d.toString().trim();
      console.log('[backend]', msg);
      if (msg.includes(`port ${API_PORT}`) || msg.includes('rodando na porta')) {
        backendReady = true;
        resolve();
      }
    });

    backendProc.stderr?.on('data', d => console.error('[backend]', d.toString().trim()));
    backendProc.on('error', reject);

    // Timeout de segurança — tenta conectar após 8s mesmo sem log
    setTimeout(() => {
      waitForBackend().then(resolve).catch(reject);
    }, 8000);
  });
}

// Aguarda a API responder no /health
function waitForBackend(retries = 20, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      http.get(`${API_URL}/health`, res => {
        if (res.statusCode === 200) {
          backendReady = true;
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };

    const retry = () => {
      attempts++;
      if (attempts >= retries) return reject(new Error('Backend não respondeu a tempo'));
      setTimeout(check, delay);
    };

    check();
  });
}

// Lê o .env do diretório de dados do usuário (produção)
function loadEnvFile() {
  const envPath = path.join(app.getPath('userData'), '.env');
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && !key.startsWith('#')) {
      vars[key.trim()] = val.join('=').trim();
    }
  });
  return vars;
}

// ─── Janela principal ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width:          1100,
    height:         720,
    minWidth:       800,
    minHeight:      560,
    title:          'AuraBot',
    backgroundColor: '#080809',
    show:           false, // mostra só depois de carregar
    webPreferences: {
      nodeIntegration:    false,
      contextIsolation:   true,
      preload:            path.join(__dirname, 'preload.js'),
    },
    // Remove a barra de menus padrão
    autoHideMenuBar: true,
  });

  // Carrega a URL
  mainWindow.loadURL(FRONTEND_URL);

  // Mostra a janela ao terminar de carregar (evita flash branco)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  // Links externos abrem no navegador do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimiza para bandeja ao fechar (não encerra o app)
  mainWindow.on('close', e => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Bandeja do sistema (system tray) ────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets',
    process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  );

  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip('AuraBot');

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir AuraBot', click: () => { mainWindow?.show(); } },
    { type: 'separator' },
    { label: 'Sair', click: () => { app.isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow?.show(); });
}

// ─── Ciclo de vida do app ─────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    // 0. Configura na primeira execução (gera JWT secrets, cria .env)
    setupFirstRun();

    // 1. Inicia backend em segundo plano
    console.log('Iniciando backend...');
    await startBackend();
    console.log('Backend pronto!');

    // 2. Cria janela e bandeja
    createWindow();
    createTray();

  } catch (err) {
    console.error('Erro ao iniciar:', err);
    dialog.showErrorBox(
      'AuraBot — Erro ao iniciar',
      `Não foi possível iniciar o servidor interno.\n\n${err.message}\n\nVerifique se o arquivo .env está configurado.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // No macOS mantém o app ativo mesmo sem janelas abertas (comportamento padrão)
  if (process.platform !== 'darwin') {
    // Mantém na bandeja em vez de fechar
  }
});

app.on('activate', () => {
  // macOS: reabre a janela ao clicar no dock
  if (mainWindow === null) createWindow();
  else mainWindow.show();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  // Encerra o backend ao fechar o app
  if (backendProc && !backendProc.killed) {
    backendProc.kill();
  }
});
