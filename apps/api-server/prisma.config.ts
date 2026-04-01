import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * `prisma generate` ne se connecte pas à la base, mais Prisma charge quand même
 * prisma.config.ts — sur Docker/Railway, DATABASE_URL n’existe pas au build.
 */
const BUILD_TIME_URL =
  'postgresql://prisma_build:prisma_build@127.0.0.1:5432/prisma_build?schema=public'

const databaseUrl = process.env.DATABASE_URL || BUILD_TIME_URL
const directUrl =
  process.env.DIRECT_URL || process.env.DATABASE_URL || BUILD_TIME_URL

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
    // Prisma 7 : URL directe (migrations) — même repli que pour le build CI
    directUrl,
  },
})
