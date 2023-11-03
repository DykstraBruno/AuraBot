import { vi, afterEach } from 'vitest';

process.env.DISCORD_TOKEN     = 'test-token';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
process.env.AURABOT_API_URL   = 'http://localhost:3001/api';
process.env.AURABOT_BOT_TOKEN = 'test-bot-token';

afterEach(() => {
  vi.clearAllMocks();
});
