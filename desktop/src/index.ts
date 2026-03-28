import 'dotenv/config';
import * as readline from 'readline';
import axios from 'axios';
import { CrossPlatformPlayer, detectPlatform } from './audio/player';
import { isYtDlpAvailable, getInstallInstructions } from './audio/ytdlp';

// ─── Config ───────────────────────────────────────────────────────────────────

const API_URL = process.env.AURABOT_API_URL ?? 'http://localhost:3001/api';
const os = detectPlatform();

// ─── API Client simples ───────────────────────────────────────────────────────

async function login(emailOrUsername: string, password: string) {
  const { data } = await axios.post(`${API_URL}/auth/login`, {
    emailOrUsername, password, platform: `desktop-${os}`,
  });
  return data.data;
}

async function apiPost(endpoint: string, body: object, token: string) {
  const { data } = await axios.post(`${API_URL}${endpoint}`, body, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data;
}

async function apiGet(endpoint: string, token: string) {
  const { data } = await axios.get(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data;
}

// ─── CLI colors ───────────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  amber:  '\x1b[33m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
  bold:   '\x1b[1m',
  cyan:   '\x1b[36m',
};

function log(msg: string) { process.stdout.write(msg + '\n'); }
function info(msg: string)  { log(`${c.amber}♪${c.reset} ${msg}`); }
function ok(msg: string)    { log(`${c.green}✓${c.reset} ${msg}`); }
function err(msg: string)   { log(`${c.red}✗${c.reset} ${msg}`); }
function muted(msg: string) { log(`${c.gray}${msg}${c.reset}`); }

function formatDuration(secs?: number | null): string {
  if (!secs) return '';
  return ` (${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')})`;
}

// ─── Parser de comandos (mesmo do backend) ────────────────────────────────────

function parseCommand(input: string): { cmd: string; args: string } {
  const trimmed = input.trim();

  const prefixMap = [
    { prefix: /^play:\s*/i,     cmd: 'play' },
    { prefix: /^stop\s*/i,      cmd: 'stop' },
    { prefix: /^next\s*/i,      cmd: 'next' },
    { prefix: /^turn up\s*/i,   cmd: 'turnup' },
    { prefix: /^turn down\s*/i, cmd: 'turndown' },
    { prefix: /^queue\s*/i,     cmd: 'queue' },
    { prefix: /^lang\s*/i,      cmd: 'lang' },
    { prefix: /^help\s*/i,      cmd: 'help' },
    { prefix: /^exit\s*/i,      cmd: 'exit' },
    { prefix: /^logout\s*/i,    cmd: 'logout' },
    { prefix: /^diag\s*/i,      cmd: 'diag' },
  ];

  for (const { prefix, cmd } of prefixMap) {
    if (prefix.test(trimmed)) {
      return { cmd, args: trimmed.replace(prefix, '').trim() };
    }
  }

  // Entrada sem prefixo → tenta play
  if (trimmed.length > 0) return { cmd: 'play', args: trimmed };
  return { cmd: '', args: '' };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('');
  log(`${c.amber}${c.bold}  ♪ AuraBot Desktop${c.reset}  ${c.gray}v1.0.0 — ${os}${c.reset}`);
  log(`${c.gray}  ${'─'.repeat(40)}${c.reset}`);
  log('');

  // Login
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise(res => rl.question(q, res));

  let token = '';
  let username = '';
  let language: 'pt' | 'en' = 'pt'; // idioma padrão: português

  // Tenta até autenticar
  while (!token) {
    const emailOrUsername = await ask(`${c.amber}Email ou usuário:${c.reset} `);
    const password = await ask(`${c.amber}Senha:${c.reset} `);

    try {
      const auth = await login(emailOrUsername, password);
      token    = auth.tokens.accessToken;
      username = auth.user.username;
      ok(`Olá, ${c.bold}@${username}${c.reset}${c.green}! Bem-vindo ao AuraBot.${c.reset}`);
    } catch (e: any) {
      const msg = e.response?.data?.error?.message ?? e.message;
      err(msg);
      if (msg.toLowerCase().includes('bloqueada')) {
        log('');
        process.exit(1);
      }
    }
  }

  const player = new CrossPlatformPlayer();
  info(`Player: ${c.gray}${player.playerName}${c.reset}`);

  // Avisa se yt-dlp não está instalado (necessário para YouTube)
  if (!isYtDlpAvailable()) {
    log('');
    log(`${c.amber}⚠  yt-dlp não encontrado — reprodução do YouTube desativada.${c.reset}`);
    log(`${c.gray}   ${getInstallInstructions().split('\n')[1]}${c.reset}`);
  }
  log('');
  muted('  Comandos: play: <música> | stop | next | turn up | turn down | queue | lang pt/en | help | exit');
  log('');

  // REPL principal
  // Prompt dinâmico mostra idioma atual
  const getPrompt = () => {
    const langFlag = language === 'pt' ? '🇧🇷' : '🇺🇸';
    return `${c.amber}${c.bold}aura${c.reset} ${c.gray}[${langFlag}] ›${c.reset} `;
  };

  const processLine = async (line: string) => {
    const { cmd, args } = parseCommand(line);
    if (!cmd) return;

    try {
      switch (cmd) {
        case 'play': {
          if (!args) { err('Informe o nome da música. Ex: play: Bohemian Rhapsody'); break; }
          info(`Buscando: ${c.bold}${args}${c.reset}...`);
          const result = await apiPost('/music/play', { query: args, language }, token);

          const t = result.track?.track;
          if (t) {
            const icon = result.action === 'playing' ? '▶' : `#${result.queuePosition}`;
            ok(`${icon} ${c.bold}${t.title}${c.reset} — ${t.artist}${formatDuration(t.duration)}`);

            // Reproduz localmente via yt-dlp → player nativo
            if (t.youtubeId) {
              if (!player.ytDlpAvailable()) {
                muted(`  ⚠  Instale yt-dlp para reprodução local. Apenas metadados salvos.`);
              } else {
                muted(`  Extraindo stream do YouTube via yt-dlp...`);
                player.playYouTube(t.youtubeId, {
                  onEnd:   () => muted('  ✓ Faixa concluída'),
                  onError: (e) => err(`Player: ${e.message}`),
                });
              }
            } else if (t.spotifyId) {
              // Spotify: só preview de 30s disponível sem OAuth do usuário
              muted(`  ℹ  Spotify não disponível no desktop sem autenticação OAuth.`);
              muted(`  ℹ  Dica: use a plataforma Web para ouvir via Spotify.`);
            }
          } else {
            ok(result.message);
          }
          break;
        }

        case 'stop': {
          player.stop();
          const result = await apiPost('/music/stop', {}, token);
          ok(result.message);
          break;
        }

        case 'next': {
          player.stop();
          const result = await apiPost('/music/next', {}, token);
          if (result.track) {
            ok(`⏭ ${result.track.track.title} — ${result.track.track.artist}`);
            if (result.track.track.youtubeId) {
              if (player.ytDlpAvailable()) {
                player.playYouTube(result.track.track.youtubeId, {
                  onEnd: () => muted('  ✓ Faixa concluída'),
                });
              }
            }
          } else {
            ok(result.message);
          }
          break;
        }

        case 'turnup': {
          const result = await apiPost('/music/volume', { direction: 'up' }, token);
          const localVol = player.turnUp();
          ok(`🔊 Volume: ${result.volume ?? localVol}%`);
          break;
        }

        case 'turndown': {
          const result = await apiPost('/music/volume', { direction: 'down' }, token);
          const localVol = player.turnDown();
          ok(`🔉 Volume: ${result.volume ?? localVol}%`);
          break;
        }

        case 'queue': {
          const state = await apiGet('/music/queue', token);
          if (!state.current) { muted('  Fila vazia.'); break; }

          const cur = state.current.track;
          log(`\n  ${c.amber}▶ Tocando agora${c.reset}`);
          log(`  ${c.bold}${cur.title}${c.reset} — ${cur.artist}${formatDuration(cur.duration)}`);

          if (state.queue.length > 0) {
            log(`\n  ${c.amber}Na fila (${state.queue.length}):${c.reset}`);
            state.queue.slice(0, 10).forEach((item: any, i: number) => {
              const t = item.track;
              log(`  ${c.gray}${i + 2}.${c.reset} ${t.title} — ${t.artist}`);
            });
          }

          log(`\n  ${c.gray}Volume: ${state.volume}%${c.reset}\n`);
          break;
        }

        case 'diag': {
          const info_ = player.diagnose();
          log(`\n  ${c.amber}Diagnóstico:${c.reset}`);
          log(`  Plataforma: ${info_.platform}`);
          log(`  Player ativo: ${info_.player}`);
          if (info_.available.length > 0) {
            log(`  Players disponíveis: ${info_.available.join(', ')}`);
          }
          const ytdlpOk = player.ytDlpAvailable();
          log(`  yt-dlp: ${ytdlpOk ? `${c.green}✓ instalado${c.reset}` : `${c.red}✗ não encontrado${c.reset}`}`);
          if (!ytdlpOk) {
            log(`\n  ${c.amber}Para instalar yt-dlp:${c.reset}`);
            getInstallInstructions().split('\n').forEach(l => log(`  ${c.gray}${l}${c.reset}`));
          }
          log(`  Idioma atual: ${language === 'pt' ? '🇧🇷 Português' : '🇺🇸 English'}`);
          log('');
          break;
        }

        case 'lang': {
          const input = args.toLowerCase().trim();
          if (input === 'pt' || input === 'português' || input === 'portuguese') {
            language = 'pt';
            ok('Idioma: 🇧🇷 Português');
          } else if (input === 'en' || input === 'english' || input === 'inglês') {
            language = 'en';
            ok('Language: 🇺🇸 English');
          } else {
            err('Idioma inválido. Use: lang pt  ou  lang en');
          }
          break;
        }

        case 'help': {
          log(`\n  ${c.amber}Comandos disponíveis:${c.reset}`);
          log(`  ${c.bold}play: <música>${c.reset}   — Toca ou enfileira uma música`);
          log(`  ${c.bold}stop${c.reset}             — Para a reprodução`);
          log(`  ${c.bold}next${c.reset}             — Próxima música`);
          log(`  ${c.bold}turn up${c.reset}          — Aumenta volume`);
          log(`  ${c.bold}turn down${c.reset}        — Diminui volume`);
          log(`  ${c.bold}queue${c.reset}            — Exibe a fila`);
          log(`  ${c.bold}lang pt${c.reset} / ${c.bold}lang en${c.reset}  — Muda o idioma dos comandos`);
          log(`  ${c.bold}diag${c.reset}             — Diagnóstico do player e yt-dlp`);
          log(`  ${c.bold}exit${c.reset}             — Sair\n`);
          break;
        }

        case 'logout':
        case 'exit': {
          player.stop();
          ok('Até logo! 🎵');
          rl.close();
          process.exit(0);
        }
      }
    } catch (e: any) {
      const msg = e.response?.data?.error?.message ?? e.message;
      err(msg);
    }

    process.stdout.write(getPrompt());
  };

  process.stdout.write(getPrompt());

  rl.on('line', processLine);
  rl.on('close', () => { player.stop(); process.exit(0); });
}

main().catch(e => { console.error(e); process.exit(1); });
