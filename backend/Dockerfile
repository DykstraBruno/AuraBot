# ─── Base ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
COPY prisma ./prisma/

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npx prisma generate

# ─── Development ──────────────────────────────────────────────────────────────
FROM base AS development
RUN npm ci && npm cache clean --force
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["npx", "tsx", "watch", "src/server.ts"]

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
RUN npm ci && npm cache clean --force
COPY . .
RUN npx prisma generate && npm run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache curl && addgroup -S aurabot && adduser -S aurabot -G aurabot

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY --from=build /app/dist ./dist

RUN mkdir -p logs && chown -R aurabot:aurabot /app
USER aurabot

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
