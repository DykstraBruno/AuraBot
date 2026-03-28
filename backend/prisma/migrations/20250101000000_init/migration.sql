-- Migration inicial — gerada automaticamente
-- AuraBot v1.0.0

CREATE TABLE "User" (
    "id"                  TEXT NOT NULL,
    "email"               TEXT NOT NULL,
    "username"            TEXT NOT NULL,
    "passwordHash"        TEXT NOT NULL,
    "displayName"         TEXT,
    "emailVerified"       BOOLEAN NOT NULL DEFAULT false,
    "isActive"            BOOLEAN NOT NULL DEFAULT true,
    "loginAttempts"       INTEGER NOT NULL DEFAULT 0,
    "lockedUntil"         TIMESTAMP(3),
    "spotifyId"           TEXT,
    "spotifyAccessToken"  TEXT,
    "spotifyRefreshToken" TEXT,
    "spotifyTokenExpiry"  TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "platform"   TEXT NOT NULL DEFAULT 'web',
    "userAgent"  TEXT,
    "ipAddress"  TEXT,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "isRevoked"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordReset" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerification" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Track" (
    "id"         TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "artist"     TEXT NOT NULL,
    "album"      TEXT,
    "duration"   INTEGER,
    "coverUrl"   TEXT,
    "spotifyId"  TEXT,
    "youtubeId"  TEXT,
    "previewUrl" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QueueItem" (
    "id"       TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "trackId"  TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "source"   TEXT NOT NULL DEFAULT 'spotify',
    "addedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Playlist" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isPublic"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaylistTrack" (
    "id"         TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "trackId"    TEXT NOT NULL,
    "position"   INTEGER NOT NULL,
    "addedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayHistory" (
    "id"       TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "trackId"  TEXT NOT NULL,
    "source"   TEXT NOT NULL DEFAULT 'spotify',
    "platform" TEXT NOT NULL DEFAULT 'web',
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPreferences" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "language"        TEXT NOT NULL DEFAULT 'pt-BR',
    "preferredSource" TEXT NOT NULL DEFAULT 'spotify',
    "audioQuality"    TEXT NOT NULL DEFAULT 'high',
    "volume"          INTEGER NOT NULL DEFAULT 80,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- Índices únicos
CREATE UNIQUE INDEX "User_email_key"       ON "User"("email");
CREATE UNIQUE INDEX "User_username_key"    ON "User"("username");
CREATE UNIQUE INDEX "User_spotifyId_key"   ON "User"("spotifyId");
CREATE UNIQUE INDEX "Session_token_key"    ON "Session"("token");
CREATE UNIQUE INDEX "PasswordReset_token_key"      ON "PasswordReset"("token");
CREATE UNIQUE INDEX "EmailVerification_token_key"  ON "EmailVerification"("token");
CREATE UNIQUE INDEX "Track_spotifyId_key"  ON "Track"("spotifyId");
CREATE UNIQUE INDEX "Track_youtubeId_key"  ON "Track"("youtubeId");
CREATE UNIQUE INDEX "UserPreferences_userId_key"   ON "UserPreferences"("userId");

-- Foreign Keys
ALTER TABLE "Session"           ADD CONSTRAINT "Session_userId_fkey"           FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordReset"     ADD CONSTRAINT "PasswordReset_userId_fkey"     FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QueueItem"         ADD CONSTRAINT "QueueItem_userId_fkey"         FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QueueItem"         ADD CONSTRAINT "QueueItem_trackId_fkey"        FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON UPDATE CASCADE;
ALTER TABLE "Playlist"          ADD CONSTRAINT "Playlist_userId_fkey"          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistTrack"     ADD CONSTRAINT "PlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistTrack"     ADD CONSTRAINT "PlaylistTrack_trackId_fkey"    FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON UPDATE CASCADE;
ALTER TABLE "PlayHistory"       ADD CONSTRAINT "PlayHistory_userId_fkey"       FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayHistory"       ADD CONSTRAINT "PlayHistory_trackId_fkey"      FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON UPDATE CASCADE;
ALTER TABLE "UserPreferences"   ADD CONSTRAINT "UserPreferences_userId_fkey"   FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
