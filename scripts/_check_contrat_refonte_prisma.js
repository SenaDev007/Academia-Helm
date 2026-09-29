/**
 * Prisma validate — Refonte CDC « étape Contrat »
 * Valide le schéma APRÈS retrait des partialIndexes/partial-unique de la COPIE
 * uniquement (prisma 6.19 du sandbox ne les supporte pas — pattern Task 11 ;
 * le schéma réel du repo les garde pour prisma ≥ 6.7 en prod).
 * La copie vit DANS prisma/ pour conserver la résolution prisma.config.ts + .env.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PRISMA_DIR = path.join(ROOT, 'apps/api-server/prisma');
const schemaSrc = path.join(PRISMA_DIR, 'schema.prisma');
const schemaCopy = path.join(PRISMA_DIR, '_validate_copy.prisma');

let src = fs.readFileSync(schemaSrc, 'utf8');
// Retrait des index partiels (non supportés par le prisma local) — COPIE ONLY
src = src.replace('previewFeatures = ["postgresqlExtensions", "partialIndexes"]', 'previewFeatures = ["postgresqlExtensions"]');
src = src.replace(/^\s*partialIndexes\s*=\s*true\s*$/gm, '');
src = src.replace(/@@unique\(\[([^\]]+)\],\s*where:.*\)/gm, '@@unique([$1])');
// Le datasource url vient de prisma.config.ts (schema réel uniquement) → injecte
// une URL factice dans la COPIE (validate ne se connecte pas)
src = src.replace(
  'datasource db {\n  provider   = "postgresql"',
  'datasource db {\n  provider   = "postgresql"\n  url        = "postgresql://validate_build:validate_build@127.0.0.1:5432/validate_build"',
);

try {
  fs.writeFileSync(schemaCopy, src);
  execSync(
    `npx prisma validate --schema prisma/_validate_copy.prisma`,
    { cwd: path.join(ROOT, 'apps/api-server'), stdio: 'pipe' },
  );
  console.log('✓ Schéma Prisma VALIDE (copie patchée — partialIndexes retirés de la copie uniquement)');
} catch (err) {
  console.error('✗ Schéma invalide :');
  console.error(String(err.stdout || err.message));
  process.exit(1);
} finally {
  try { fs.rmSync(schemaCopy, { force: true }); } catch {}
}
