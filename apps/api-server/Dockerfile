# ============================================================================
# DOCKERFILE PRODUCTION - API SERVER (NestJS)
# ============================================================================
# Build multi-stage : build puis image minimale pour l'exécution
# ============================================================================

# -----------------------------------------------------------------------------
# Étape 1 : Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Dépendances et Prisma
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev

# Générer le client Prisma
RUN npx prisma generate

# Code source et build
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Étape 2 : Image de production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copier depuis le builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

# Utilisateur non-root (sécurité)
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
RUN chmod +x /app/docker-entrypoint.sh
USER nestjs

EXPOSE 3000

# Entrypoint : migrations puis démarrage de l'API
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
