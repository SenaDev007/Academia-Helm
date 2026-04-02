# ---- Dependencies Stage ----
FROM node:22-slim AS deps

RUN apt-get update && apt-get install -y \
  --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Installer UNIQUEMENT les deps de production
# puis générer Prisma
RUN npm ci --only=production \
  && npx prisma generate

# ---- Build Stage ----
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Installer toutes les deps pour le build
RUN npm ci --prefer-offline

COPY . .

RUN npx prisma generate
RUN npm run build

# ---- Production Stage ----
FROM node:22-slim AS production

RUN apt-get update && apt-get install -y \
  --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier uniquement ce qui est nécessaire
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main.js"]
