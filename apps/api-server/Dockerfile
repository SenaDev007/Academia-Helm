# ---- Build Stage ----
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y \
  --no-install-recommends \
  openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Installation sans scripts natifs
RUN npm ci

# Générer le client Prisma
RUN npx prisma generate

# Copier le reste et builder
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y \
  --no-install-recommends \
  openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/main.js"]
