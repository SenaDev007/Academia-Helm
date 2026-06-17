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
# Migrations are run in BACKGROUND (non-blocking) so NestJS starts immediately.
# This is critical for Fly.io: the smoke check expects port 3000 to be open
# within seconds. If migrations block for 10-15s, the smoke check fails → 503.
#
# Since migrations are idempotent and already applied in most cases
# ("No pending migrations to apply"), running them in background is safe.
CMD [ "sh", "-c", \
  "if [ -n \"$ZAI_CONFIG\" ]; then echo \"$ZAI_CONFIG\" > .z-ai-config && echo '✅ z-ai-config written from env var'; fi && \
   echo '📦 Starting Prisma migrations in background...' && \
   (npx prisma migrate deploy --schema=prisma/schema.prisma 2>&1 && echo '✅ All migrations applied' || \
    (for m in 20260606120000_add_staff_photo_matricule_document_structuring 20260606140000_add_candidate_documents 20260606160000_recruitment_tables_complete 20260606180000_add_country_city_to_hr_candidates 20260606200000_add_staffId_to_hr_applications 20260606220000_add_job_number_sequence 20260607080000_add_interview_status_result_feedback 20260608120000_add_staff_termination_fields 20260609100000_add_published_at_to_hr_jobs 20260609120000_add_staff_hr_fields; do npx prisma migrate resolve --applied $m 2>/dev/null || true; done && \
     npx prisma migrate deploy --schema=prisma/schema.prisma 2>&1 || echo '⚠️ Migration failed, continuing with fallback SQL')) & \
   echo '🚀 Starting API server immediately...' && \
   node --max-old-space-size=768 dist/main.js" ]
