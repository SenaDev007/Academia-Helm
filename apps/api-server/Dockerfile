# syntax = docker/dockerfile:1
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL runtime="NestJS/Prisma"
WORKDIR /app
ENV NODE_ENV="production"

FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential node-gyp openssl \
    pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists

COPY package-lock.json package.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN test -f prisma/schema.prisma

ENV PUPPETEER_SKIP_DOWNLOAD=true

# --ignore-scripts : évite postinstall (prisma generate) avant que prisma soit copié si l'ordre des layers diverge
RUN npm ci --ignore-scripts --include=dev

RUN npx prisma generate

COPY . .

RUN npm run build

FROM base

# Install Chromium for Puppeteer PDF generation + openssl for Prisma
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    openssl \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Puppeteer: use system Chromium (installed above)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./

# z-ai-web-dev-sdk config for Voice ASR/TTS
# If ZAI_CONFIG env var is set, write it to .z-ai-config at startup
# Otherwise, fall back to any .z-ai-config file copied from the build
COPY --from=build /app/.z-ai-config* ./

EXPOSE 3000

# TypeORM removed — but Prisma with 270+ models still needs ~2GB during startup
# Run migrations BEFORE starting the server (non-blocking: separate process)
# If migrations fail, the server still starts (fallback SQL in main.ts covers critical columns)
#
# MIGRATION STRATEGY:
# Migrations are NOT run at container startup. They are run separately via:
#   fly ssh console -C "npx prisma migrate deploy --schema=prisma/schema.prisma"
# Or via a CI/CD step before deployment.
#
# This is critical: running `npx prisma` consumes CPU and memory that slows
# down Node.js startup. On Fly.io shared-cpu-1x, every second counts —
# the health check has a 60s grace period and NestJS needs all of it.
CMD [ "node", "--max-old-space-size=768", "dist/main.js" ]
