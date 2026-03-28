const { app }  = require('electron');
const crypto   = require('crypto');
const path     = require('path');
const fs       = require('fs');

/**
 * Executado na primeira vez que o app abre.
 * Gera JWT secrets automaticamente e cria o arquivo .env
 * no diretório de dados do usuário.
 */
function setupFirstRun() {
  const userDataPath = app.getPath('userData');
  const envPath      = path.join(userDataPath, '.env');
  const examplePath  = path.join(__dirname, '..', '.env.example');

  // Garante que o diretório existe
  fs.mkdirSync(userDataPath, { recursive: true });

  // Se já existe .env, não sobrescreve
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    // Verifica se os secrets já foram gerados
    if (!content.includes('JWT_SECRET=\n') && content.includes('JWT_SECRET=')) {
      return; // tudo ok
    }
  }

  // Gera secrets aleatórios
  const jwtSecret        = crypto.randomBytes(64).toString('base64');
  const jwtRefreshSecret = crypto.randomBytes(64).toString('base64');

  // Lê o template
  let template = fs.existsSync(examplePath)
    ? fs.readFileSync(examplePath, 'utf-8')
    : '';

  // Substitui os placeholders pelos secrets gerados
  template = template
    .replace('JWT_SECRET=',         `JWT_SECRET=${jwtSecret}`)
    .replace('JWT_REFRESH_SECRET=', `JWT_REFRESH_SECRET=${jwtRefreshSecret}`)
    .replace('DATABASE_URL=file:./aurabot.db',
             `DATABASE_URL=file:${path.join(userDataPath, 'aurabot.db').replace(/\\/g, '/')}`);

  fs.writeFileSync(envPath, template, 'utf-8');
  console.log('[setup] .env criado em:', envPath);
  console.log('[setup] JWT secrets gerados automaticamente');
}

module.exports = { setupFirstRun };
