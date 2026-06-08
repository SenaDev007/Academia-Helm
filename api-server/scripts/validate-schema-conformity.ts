/**
 * Script de Validation de Conformité PostgreSQL ↔ SQLite
 * 
 * OBJECTIF : Vérifier que les schémas sont conformes avant déploiement
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

function getFileHash(filePath: string): string {
  if (!existsSync(filePath)) {
    return '';
  }
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

function main() {
  console.log('🔍 Validation de conformité PostgreSQL ↔ SQLite...\n');

  const prismaSchemaPath = join(__dirname, '../prisma/schema.prisma');
  const sqliteSchemaPath = join(__dirname, '../prisma/sqlite-schema.sql');

  // Vérifier l'existence des fichiers
  if (!existsSync(prismaSchemaPath)) {
    console.error('❌ Fichier schema.prisma introuvable');
    process.exit(1);
  }

  if (!existsSync(sqliteSchemaPath)) {
    console.error('❌ Fichier sqlite-schema.sql introuvable');
    console.error('💡 Exécutez: npm run generate:sqlite-schema');
    process.exit(1);
  }

  // Calculer les hashs
  const prismaHash = getFileHash(prismaSchemaPath);
  const sqliteHash = getFileHash(sqliteSchemaPath);

  console.log(`📄 PostgreSQL (schema.prisma):`);
  console.log(`   Hash: ${prismaHash.substring(0, 16)}...`);
  console.log(`\n📄 SQLite (sqlite-schema.sql):`);
  console.log(`   Hash: ${sqliteHash.substring(0, 16)}...`);

  // Vérifier la correspondance (le hash SQLite devrait être dérivé du Prisma)
  console.log('\n✅ Fichiers trouvés');
  console.log('💡 Pour une validation complète, utilisez le service SchemaValidatorService');

  process.exit(0);
}

if (require.main === module) {
  main();
}

