/**
 * Génère automatiquement une migration Prisma à partir du diff
 * entre l'état actuel des migrations et le schéma (schema.prisma).
 *
 * Usage: npm run migrate:auto
 * Ou: npx ts-node scripts/migrate-auto-generate.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prismaDir = path.join(__dirname, '..');
const migrationsDir = path.join(prismaDir, 'prisma', 'migrations');

function run() {
  const now = new Date();
  const timestamp =
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const migrationName = `${timestamp}_auto`;
  const migrationDir = path.join(migrationsDir, migrationName);

  try {
    const script = execSync(
      `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script --schema=prisma/schema.prisma`,
      {
        cwd: prismaDir,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }
    ).trim();

    if (!script || script === '') {
      console.log('Aucun changement détecté entre les migrations et le schéma. Rien à générer.');
      return 0;
    }

    if (!fs.existsSync(migrationDir)) {
      fs.mkdirSync(migrationDir, { recursive: true });
    }

    const migrationFile = path.join(migrationDir, 'migration.sql');
    fs.writeFileSync(migrationFile, script + '\n', 'utf-8');
    console.log(`Migration générée : prisma/migrations/${migrationName}/migration.sql`);
    return 0;
  } catch (err: any) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    console.error('Erreur lors de la génération de la migration:', err.message);
    return 1;
  }
}

process.exit(run());
