import { prisma } from '../config/database';
import { ExternalAPIError, AppError } from '../utils/errors';
import { logger } from '../utils/logger';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface SpotifyUserProfile {
  id: string;
  display_name: string;
  email: string;
  product: 'free' | 'premium' | 'open'; // product = plano do usuário
  images: Array<{ url: string }>;
}

// Escopos necessários para reprodução e leitura de playlists
const SPOTIFY_SCOPES = [
  'streaming',                    // Web Playback SDK
  'user-read-email',              // perfil
  'user-read-private',            // checar se é Premium
  'user-read-playback-state',     // estado do player
  'user-modify-playback-state',   // play/pause/skip via Connect
  'user-read-currently-playing',  // música atual
  'playlist-read-private',        // playlists pessoais
  'playlist-read-collaborative',
].join(' ');

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class SpotifyOAuthService {
  private get clientId() {
    const v = process.env.SPOTIFY_CLIENT_ID;
    if (!v) throw new AppError('SPOTIFY_CLIENT_ID não configurado', 500);
    return v;
  }

  private get clientSecret() {
    const v = process.env.SPOTIFY_CLIENT_SECRET;
    if (!v) throw new AppError('SPOTIFY_CLIENT_SECRET não configurado', 500);
    return v;
  }

  private get redirectUri() {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    return `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/api/spotify/callback`;
  }

  // ─── Gera URL de autorização ───────────────────────────────────────────────

  getAuthUrl(userId: string): string {
    // state = userId codificado — usado para vincular o callback ao usuário correto
    const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     this.clientId,
      scope:         SPOTIFY_SCOPES,
      redirect_uri:  this.redirectUri,
      state,
    });

    return `https://accounts.spotify.com/authorize?${params}`;
  }

  // ─── Troca code pelo par de tokens ────────────────────────────────────────

  async exchangeCode(code: string, state: string): Promise<{ userId: string; tokens: SpotifyTokens }> {
    // Decodifica o state para recuperar userId
    let userId: string;
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
      userId = parsed.userId;
      // Rejeita states com mais de 10 minutos (proteção CSRF)
      if (Date.now() - parsed.ts > 10 * 60 * 1000) {
        throw new Error('State expirado');
      }
    } catch {
      throw new AppError('Parâmetro state inválido ou expirado', 400, 'INVALID_STATE');
    }

    const tokens = await this.fetchTokens('authorization_code', { code });

    // Busca perfil do usuário Spotify para verificar plano
    const profile = await this.fetchProfile(tokens.accessToken);

    // Atualiza o usuário com tokens e ID Spotify
    await prisma.user.update({
      where: { id: userId },
      data: {
        spotifyId:           profile.id,
        spotifyAccessToken:  tokens.accessToken,
        spotifyRefreshToken: tokens.refreshToken,
        spotifyTokenExpiry:  tokens.expiresAt,
        // Atualiza avatar se o usuário ainda não tem um
        ...(profile.images[0]?.url ? {} : {}),
      },
    });

    logger.info(`Spotify vinculado: userId=${userId} spotifyId=${profile.id} plano=${profile.product}`);

    return { userId, tokens };
  }

  // ─── Retorna access token válido (renova se necessário) ───────────────────

  async getValidToken(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        spotifyAccessToken:  true,
        spotifyRefreshToken: true,
        spotifyTokenExpiry:  true,
      },
    });

    if (!user?.spotifyRefreshToken) {
      throw new AppError(
        'Conta Spotify não vinculada. Conecte sua conta em Configurações.',
        401,
        'SPOTIFY_NOT_LINKED'
      );
    }

    // Token ainda válido (com margem de 60s)
    if (
      user.spotifyAccessToken &&
      user.spotifyTokenExpiry &&
      user.spotifyTokenExpiry > new Date(Date.now() + 60_000)
    ) {
      return user.spotifyAccessToken;
    }

    // Renova o token
    logger.debug(`Renovando token Spotify para userId=${userId}`);
    const tokens = await this.fetchTokens('refresh_token', {
      refresh_token: user.spotifyRefreshToken,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        spotifyAccessToken: tokens.accessToken,
        spotifyTokenExpiry: tokens.expiresAt,
        // refresh_token pode ou não vir no response de renovação
        ...(tokens.refreshToken ? { spotifyRefreshToken: tokens.refreshToken } : {}),
      },
    });

    return tokens.accessToken;
  }

  // ─── Desvincula conta Spotify ─────────────────────────────────────────────

  async disconnect(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        spotifyId:           null,
        spotifyAccessToken:  null,
        spotifyRefreshToken: null,
        spotifyTokenExpiry:  null,
      },
    });
    logger.info(`Spotify desvinculado: userId=${userId}`);
  }

  // ─── Status da vinculação ─────────────────────────────────────────────────

  async getStatus(userId: string): Promise<{
    linked: boolean;
    spotifyId: string | null;
    isPremium: boolean | null;
    tokenValid: boolean;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        spotifyId:          true,
        spotifyAccessToken: true,
        spotifyRefreshToken: true,
        spotifyTokenExpiry: true,
      },
    });

    if (!user?.spotifyId) {
      return { linked: false, spotifyId: null, isPremium: null, tokenValid: false };
    }

    const tokenValid =
      !!user.spotifyAccessToken &&
      !!user.spotifyTokenExpiry &&
      user.spotifyTokenExpiry > new Date();

    // Verifica se é Premium tentando buscar o perfil
    let isPremium: boolean | null = null;
    if (tokenValid && user.spotifyAccessToken) {
      try {
        const profile = await this.fetchProfile(user.spotifyAccessToken);
        isPremium = profile.product === 'premium';
      } catch {
        isPremium = null;
      }
    }

    return {
      linked: true,
      spotifyId: user.spotifyId,
      isPremium,
      tokenValid,
    };
  }

  // ─── Controle de reprodução via Spotify Connect ───────────────────────────
  // Requer: conta Premium + app Spotify aberto em algum dispositivo

  async play(userId: string, spotifyUri: string, deviceId?: string): Promise<void> {
    const token = await this.getValidToken(userId);

    const params = deviceId ? `?device_id=${deviceId}` : '';
    const res = await fetch(`https://api.spotify.com/v1/me/player/play${params}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [spotifyUri] }),
    });

    if (res.status === 403) {
      throw new AppError(
        'Reprodução via Spotify requer conta Premium.',
        403,
        'SPOTIFY_PREMIUM_REQUIRED'
      );
    }
    if (res.status === 404) {
      throw new AppError(
        'Nenhum dispositivo Spotify ativo. Abra o Spotify em algum dispositivo primeiro.',
        404,
        'SPOTIFY_NO_DEVICE'
      );
    }
    if (!res.ok && res.status !== 204) {
      throw new ExternalAPIError('Spotify', `Play falhou: ${res.status}`);
    }
  }

  async pause(userId: string): Promise<void> {
    const token = await this.getValidToken(userId);
    await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async skipNext(userId: string): Promise<void> {
    const token = await this.getValidToken(userId);
    await fetch('https://api.spotify.com/v1/me/player/next', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async setVolume(userId: string, volumePercent: number): Promise<void> {
    const token = await this.getValidToken(userId);
    const vol = Math.max(0, Math.min(100, Math.round(volumePercent)));
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${vol}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async getDevices(userId: string): Promise<Array<{ id: string; name: string; type: string; is_active: boolean }>> {
    const token = await this.getValidToken(userId);
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.devices ?? [];
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  private async fetchTokens(
    grantType: 'authorization_code' | 'refresh_token',
    extra: Record<string, string>
  ): Promise<SpotifyTokens> {
    const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type:   grantType,
      redirect_uri: this.redirectUri,
      ...extra,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization:  `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ExternalAPIError('Spotify', `OAuth falhou: ${err.error_description ?? res.status}`);
    }

    const data = await res.json();
    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token ?? extra.refresh_token ?? '',
      expiresAt:    new Date(Date.now() + (data.expires_in - 30) * 1000),
    };
  }

  private async fetchProfile(accessToken: string): Promise<SpotifyUserProfile> {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new ExternalAPIError('Spotify', 'Falha ao buscar perfil');
    return res.json();
  }
}

export const spotifyOAuthService = new SpotifyOAuthService();
