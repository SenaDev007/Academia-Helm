# Prisma 7 / @prisma/streams-local exigent Node >= 22
# IMPORTANT: éviter Alpine (musl) car `bcrypt` (module natif) crash souvent en prod.
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
# `npm ci` exécute `postinstall` (prisma generate) → éviter la double génération au build
RUN npm ci --ignore-scripts
COPY . .
# Générer Prisma une seule fois (nécessaire pour `npm run build`)
RUN npx prisma generate --schema=prisma/schema.prisma
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
