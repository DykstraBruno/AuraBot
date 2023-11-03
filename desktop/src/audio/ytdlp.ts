import { spawn } from 'child_process';
import { existsSync } from 'fs';

/**
 * yt-dlp wrapper — extrai URL de stream de áudio do YouTube
 * sem baixar o arquivo inteiro.
 *
 * Instalação:
 *   Windows:  winget install yt-dlp.yt-dlp
 *             (ou baixe yt-dlp.exe de https://github.com/yt-dlp/yt-dlp/releases)
 *   macOS:    brew install yt-dlp
 *   Linux:    sudo apt install yt-dlp
 *             (ou: sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp)
 */

// Nomes possíveis do executável por plataforma
const YTDLP_NAMES = ['yt-dlp', 'yt-dlp.exe', 'yt_dlp'];

export function findYtDlp(): string | null {
  const sep = process.platform === 'win32' ? ';' : ':';
  const dirs = (process.env.PATH ?? '').split(sep);

  for (const name of YTDLP_NAMES) {
    // Verifica no PATH
    for (const dir of dirs) {
      const full = `${dir}/${name}`;
      if (existsSync(full)) return full;
    }
    // Windows: verifica em locais comuns
    if (process.platform === 'win32') {
      const common = [
        `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe\\yt-dlp.exe`,
        `${process.env.USERPROFILE}\\scoop\\apps\\yt-dlp\\current\\yt-dlp.exe`,
        `C:\\tools\\yt-dlp\\yt-dlp.exe`,
      ];
      for (const p of common) {
        if (p && existsSync(p)) return p;
      }
    }
  }
  return null;
}

export function isYtDlpAvailable(): boolean {
  return findYtDlp() !== null;
}

/**
 * Extrai a URL de stream de áudio direto do YouTube.
 * Retorna a URL que pode ser passada para WMP, afplay, mpv etc.
 * Não baixa nada — apenas resolve a URL de stream.
 */
export function getAudioStreamUrl(youtubeUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytdlp = findYtDlp();
    if (!ytdlp) {
      return reject(new Error(
        'yt-dlp não encontrado. Instale em: https://github.com/yt-dlp/yt-dlp#installation'
      ));
    }

    const args = [
      '--get-url',          // só imprime a URL, não baixa
      '--format', 'bestaudio[ext=m4a]/bestaudio/best',  // melhor áudio disponível
      '--no-playlist',      // não expande playlists
      '--no-warnings',
      youtubeUrl,
    ];

    let stdout = '';
    let stderr = '';

    const proc = spawn(ytdlp, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stdout?.on('data', d => { stdout += d.toString(); });
    proc.stderr?.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      const url = stdout.trim().split('\n')[0]; // pega primeira URL se houver múltiplas
      if (code === 0 && url.startsWith('http')) {
        resolve(url);
      } else {
        const msg = stderr.trim() || `yt-dlp saiu com código ${code}`;
        // Erros comuns com mensagens legíveis
        if (msg.includes('Video unavailable')) {
          reject(new Error('Vídeo indisponível no YouTube (pode ser restrito ou removido)'));
        } else if (msg.includes('Sign in to confirm your age')) {
          reject(new Error('Vídeo requer verificação de idade — não suportado'));
        } else if (msg.includes('Private video')) {
          reject(new Error('Vídeo privado — sem acesso'));
        } else {
          reject(new Error(`Falha ao obter stream: ${msg.slice(0, 120)}`));
        }
      }
    });

    proc.on('error', err => {
      reject(new Error(`Erro ao executar yt-dlp: ${err.message}`));
    });

    // Timeout de 15 segundos
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill();
        reject(new Error('Timeout ao obter stream do YouTube (>15s)'));
      }
    }, 15_000);
  });
}

/**
 * Instrução de instalação por plataforma
 */
export function getInstallInstructions(): string {
  switch (process.platform) {
    case 'win32':
      return [
        'Instale yt-dlp (necessário para reprodução no Windows):',
        '  Opção 1 (winget):   winget install yt-dlp.yt-dlp',
        '  Opção 2 (scoop):    scoop install yt-dlp',
        '  Opção 3 (manual):   Baixe yt-dlp.exe de https://github.com/yt-dlp/yt-dlp/releases',
        '                      e coloque em C:\\Windows\\System32\\',
      ].join('\n');
    case 'darwin':
      return [
        'Instale yt-dlp (necessário para reprodução no macOS):',
        '  brew install yt-dlp',
      ].join('\n');
    default:
      return [
        'Instale yt-dlp (necessário para reprodução no Linux):',
        '  sudo apt install yt-dlp',
        '  # ou:',
        '  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \\',
        '    -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp',
      ].join('\n');
  }
}
