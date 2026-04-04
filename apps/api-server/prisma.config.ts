import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Neon / P1001 « Can’t reach database server » :
 * - Ajoutez `?sslmode=require` (souvent `&channel_binding=require` si Neon le fournit).
 * - Augmentez le délai cold start : `&connect_timeout=60` (ou 120).
 * - Définissez `DIRECT_URL` avec l’hôte **sans** `-pooler` (onglet Neon « direct ») pour
 *   `migrate deploy` ; gardez le pooler dans `DATABASE_URL` pour l’app.
 * - Sous Git Bash Windows, si ça échoue encore, testez la même commande dans **PowerShell**.
 *
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
  // Prisma 7 : `prisma db seed` lit la commande ici (plus seulement package.json)
  migrations: {
    seed: 'npx ts-node prisma/seed.ts',
  },
})
