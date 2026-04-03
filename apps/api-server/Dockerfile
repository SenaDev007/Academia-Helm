# syntax = docker/dockerfile:1
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="NestJS/Prisma"
WORKDIR /app
ENV NODE_ENV="production"

FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential node-gyp openssl \
    pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists

COPY package-lock.json package.json ./

# ⚠️ CRITIQUE : copier prisma AVANT npm ci
# sinon postinstall échoue
COPY prisma ./prisma/

ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN npm ci --include=dev

RUN npx prisma generate

COPY . .

RUN npm run build

FROM base

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

CMD [ "node", "dist/main.js" ]
