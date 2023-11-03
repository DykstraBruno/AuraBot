const { app }  = require('electron');
const crypto   = require('crypto');
const path     = require('path');
const fs       = require('fs');

/**
 * Executado na primeira vez que o app abre.
 * - Gera JWT secrets automaticamente
 * - Configura DATABASE_URL para SQLite local
 * - Cria o arquivo .env no diretório do usuário
 */
function setupFirstRun() {
  const userDataPath = app.getPath('userData');
  const envPath      = path.join(userDataPath, '.env');

  fs.mkdirSync(userDataPath, { recursive: true });

  // Ler .env existente ou começar do zero
  let vars = {};
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx < 0) return;
      vars[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    });
  }

  let changed = false;

  // Gerar JWT secrets se não existirem
  if (!vars['JWT_SECRET'] || vars['JWT_SECRET'].length < 20) {
    vars['JWT_SECRET'] = crypto.randomBytes(64).toString('base64');
    changed = true;
  }
  if (!vars['JWT_REFRESH_SECRET'] || vars['JWT_REFRESH_SECRET'].length < 20) {
    vars['JWT_REFRESH_SECRET'] = crypto.randomBytes(64).toString('base64');
    changed = true;
  }

  // Configurar DATABASE_URL para SQLite local
  const dbPath = path.join(userDataPath, 'aurabot.db').replace(/\\/g, '/');
  const expectedUrl = `file:${dbPath}`;
  if (vars['DATABASE_URL'] !== expectedUrl) {
    vars['DATABASE_URL'] = expectedUrl;
    changed = true;
  }

  // Defaults necessários
  const defaults = {
    NODE_ENV:          'production',
    PORT:              '3001',
    FRONTEND_URL:      'http://localhost:3001',
    ALLOWED_ORIGINS:   'http://localhost:3001',
    LOG_LEVEL:         'error',
    JWT_EXPIRES_IN:    '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  for (const [k, v] of Object.entries(defaults)) {
    if (!vars[k]) { vars[k] = v; changed = true; }
  }

  // Salvar .env se houve mudanças
  if (changed) {
    const content = Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n';
    fs.writeFileSync(envPath, content, 'utf-8');
    console.log('[setup] .env criado/atualizado em:', envPath);
  }
}

module.exports = { setupFirstRun };
