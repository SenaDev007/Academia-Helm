# Prisma 7 / @prisma/streams-local exigent Node >= 22
# IMPORTANT: éviter Alpine (musl) car `bcrypt` (module natif) crash souvent en prod.
FROM node:22-slim AS builder
WORKDIR /app

# Compilateurs pour `npm rebuild` (bcrypt, better-sqlite3 optionnel, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/
# Pas de postinstall Prisma ici (évite double `prisma generate`) — les modules natifs
# ne seraient pas compilés sans `npm rebuild` ensuite.
RUN npm ci --ignore-scripts
COPY . .
RUN npm rebuild
# `npm run build` inclut déjà `prisma generate` + compilation Nest
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
