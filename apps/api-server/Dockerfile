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
# 1. First, try `prisma migrate deploy` to apply all pending migrations.
# 2. If it fails, use `prisma migrate resolve --applied` to mark conflicted
#    migrations as applied (tables/columns may already exist from fallback SQL
#    in main.ts during previous server starts).
# 3. Retry `prisma migrate deploy` after resolving conflicts.
# 4. If still failing, continue with fallback SQL (non-blocking).
CMD [ "sh", "-c", "if [ -n \"$ZAI_CONFIG\" ]; then echo \"$ZAI_CONFIG\" > .z-ai-config && echo '✅ z-ai-config written from env var'; fi && echo '📦 Running Prisma migrations...' && if npx prisma migrate deploy --schema=prisma/schema.prisma 2>&1; then echo '✅ All migrations applied'; else echo '⚠️ Migration failed, resolving conflicts...'; for m in 20260606120000_add_staff_photo_matricule_document_structuring 20260606140000_add_candidate_documents 20260606160000_recruitment_tables_complete 20260606180000_add_country_city_to_hr_candidates 20260606200000_add_staffId_to_hr_applications 20260606220000_add_job_number_sequence 20260607080000_add_interview_status_result_feedback 20260608120000_add_staff_termination_fields 20260609100000_add_published_at_to_hr_jobs 20260609120000_add_staff_hr_fields; do npx prisma migrate resolve --applied $m 2>/dev/null || true; done; echo '📦 Retrying migrations after conflict resolution...'; npx prisma migrate deploy --schema=prisma/schema.prisma 2>&1 || echo '⚠️ Migration still failed, continuing with fallback SQL'; fi && echo '🚀 Starting API server...' && node --max-old-space-size=384 dist/main.js" ]
