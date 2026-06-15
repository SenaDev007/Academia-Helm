# ============================================================================
# DOCKERFILE PRODUCTION - FRONTEND (Next.js standalone)
# ============================================================================
# Build multi-stage : build Next.js en mode standalone puis image minimale
# ============================================================================

# -----------------------------------------------------------------------------
# Étape 1 : Build
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Variables requises au build (les NEXT_PUBLIC_* sont injectées au build)
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BASE_DOMAIN
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENV=production
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_BASE_DOMAIN=${NEXT_PUBLIC_BASE_DOMAIN}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}

RUN npm run build

# -----------------------------------------------------------------------------
# Étape 2 : Image de production (standalone)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copier le build standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Utilisateur non-root
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
