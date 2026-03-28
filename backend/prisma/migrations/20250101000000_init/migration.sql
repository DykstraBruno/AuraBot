-- Migration inicial para SQLite
-- AuraBot v1.0.0

CREATE TABLE IF NOT EXISTS "User" (
    "id"                  TEXT NOT NULL PRIMARY KEY,
    "email"               TEXT NOT NULL UNIQUE,
    "username"            TEXT NOT NULL UNIQUE,
    "passwordHash"        TEXT NOT NULL,
    "displayName"         TEXT,
    "avatarUrl"           TEXT,
    "isActive"            INTEGER NOT NULL DEFAULT 1,
    "emailVerified"       INTEGER NOT NULL DEFAULT 0,
    "loginAttempts"       INTEGER NOT NULL DEFAULT 0,
    "lockedUntil"         DATETIME,
    "spotifyId"           TEXT UNIQUE,
    "spotifyAccessToken"  TEXT,
    "spotifyRefreshToken" TEXT,
    "spotifyTokenExpiry"  DATETIME,
    "createdAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "userId"     TEXT NOT NULL,
    "token"      TEXT NOT NULL UNIQUE,
    "platform"   TEXT NOT NULL DEFAULT 'web',
    "userAgent"  TEXT,
    "ipAddress"  TEXT,
    "expiresAt"  DATETIME NOT NULL,
    "isRevoked"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "PasswordReset" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "userId"    TEXT NOT NULL,
    "token"     TEXT NOT NULL UNIQUE,
    "expiresAt" DATETIME NOT NULL,
    "usedAt"    DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "EmailVerification" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "userId"     TEXT NOT NULL,
    "token"      TEXT NOT NULL UNIQUE,
    "expiresAt"  DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Track" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "title"      TEXT NOT NULL,
    "artist"     TEXT NOT NULL,
    "album"      TEXT,
    "duration"   INTEGER,
    "coverUrl"   TEXT,
    "spotifyId"  TEXT UNIQUE,
    "youtubeId"  TEXT UNIQUE,
    "previewUrl" TEXT,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "QueueItem" (
    "id"       TEXT NOT NULL PRIMARY KEY,
    "userId"   TEXT NOT NULL,
    "trackId"  TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "source"   TEXT NOT NULL DEFAULT 'spotify',
    "addedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("trackId") REFERENCES "Track"("id")
);

CREATE TABLE IF NOT EXISTS "Playlist" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "isPublic"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlaylistTrack" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "trackId"    TEXT NOT NULL,
    "position"   INTEGER NOT NULL,
    "addedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE,
    FOREIGN KEY ("trackId") REFERENCES "Track"("id")
);

CREATE TABLE IF NOT EXISTS "PlayHistory" (
    "id"       TEXT NOT NULL PRIMARY KEY,
    "userId"   TEXT NOT NULL,
    "trackId"  TEXT NOT NULL,
    "source"   TEXT NOT NULL DEFAULT 'spotify',
    "platform" TEXT NOT NULL DEFAULT 'web',
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("trackId") REFERENCES "Track"("id")
);

CREATE TABLE IF NOT EXISTS "UserPreferences" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "userId"          TEXT NOT NULL UNIQUE,
    "language"        TEXT NOT NULL DEFAULT 'pt-BR',
    "preferredSource" TEXT NOT NULL DEFAULT 'spotify',
    "audioQuality"    TEXT NOT NULL DEFAULT 'high',
    "volume"          INTEGER NOT NULL DEFAULT 80,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
