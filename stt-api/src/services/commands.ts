export type SupportedLanguage = 'pt' | 'en';
export type PlayerCommand = 'play' | 'stop' | 'next' | 'turnup' | 'turndown';

interface CommandPattern {
  pattern: RegExp;
  command: PlayerCommand;
  extractQuery?: boolean;
}

const PATTERNS: Record<SupportedLanguage, CommandPattern[]> = {
  pt: [
    { pattern: /^(play|toque|reproduza?|coloca?|bota|quero ouvir|me coloca|me bota|põe|ponha)\s+(.+)/i, command: 'play', extractQuery: true },
    { pattern: /^(stop|para(r)?|pausa(r)?|silêncio|chega|cancela(r)?|desliga(r)?)/i, command: 'stop' },
    { pattern: /^(próxima?|pula(r)?|avança(r)?|next|skip|passa(r)?|outra)/i, command: 'next' },
    { pattern: /^(mais alto|sobe(r)?( o)?( volume)?|aumenta(r)?( o)?( volume)?|volume (mais )?alto|turn up)/i, command: 'turnup' },
    { pattern: /^(mais baixo|baixa(r)?( o)?( volume)?|diminui(r)?( o)?( volume)?|volume (mais )?baixo|turn down)/i, command: 'turndown' },
  ],
  en: [
    { pattern: /^(start playing|can you play|play me|put on|i want to hear|play)\s+(.+)/i, command: 'play', extractQuery: true },
    { pattern: /^(stop|pause|quiet\b|enough|cancel|turn off|shut up)/i, command: 'stop' },
    { pattern: /^(next|skip|forward|next (one|song|track)|skip (this|it))/i, command: 'next' },
    { pattern: /^(turn up|volume up|louder|increase (the )?volume|make it louder)/i, command: 'turnup' },
    { pattern: /^(turn down|volume down|quieter|decrease (the )?volume|lower (the )?volume|make it quieter)/i, command: 'turndown' },
  ],
};

const ACTIONS: Record<SupportedLanguage, Record<PlayerCommand, string>> = {
  pt: {
    play:     'Reproduzindo a música solicitada',
    stop:     'Pausando a reprodução',
    next:     'Avançando para a próxima música',
    turnup:   'Aumentando o volume',
    turndown: 'Diminuindo o volume',
  },
  en: {
    play:     'Playing the requested song',
    stop:     'Pausing playback',
    next:     'Skipping to the next song',
    turnup:   'Turning up the volume',
    turndown: 'Turning down the volume',
  },
};

export interface CommandResult {
  command: PlayerCommand | null;
  query:   string | null;
  action:  string;
  language: SupportedLanguage;
}

function normalizeLanguage(lang: string): SupportedLanguage {
  const l = lang.toLowerCase();
  if (l.startsWith('pt') || l === 'portuguese') return 'pt';
  return 'en';
}

function cleanQuery(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function matchCommand(text: string, hint: SupportedLanguage = 'pt'): CommandResult {
  const normalized = text.trim();
  const other: SupportedLanguage = hint === 'pt' ? 'en' : 'pt';

  for (const lang of [hint, other] as SupportedLanguage[]) {
    for (const { pattern, command, extractQuery } of PATTERNS[lang]) {
      const match = normalized.match(pattern);
      if (match) {
        const query = extractQuery ? cleanQuery(match[match.length - 1]) : null;
        return { command, query, action: ACTIONS[lang][command], language: lang };
      }
    }
  }

  // Fallback: texto curto sem prefixo → play implícito
  if (normalized.length > 1 && normalized.length <= 200) {
    return {
      command:  'play',
      query:    cleanQuery(normalized),
      action:   ACTIONS[hint]['play'],
      language: hint,
    };
  }

  return { command: null, query: null, action: 'ask again', language: hint };
}

export { normalizeLanguage };
