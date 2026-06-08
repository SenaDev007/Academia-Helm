/**
 * Validateur de Migrations Prisma
 * 
 * OBJECTIF : Valider que les migrations générées sont sûres
 * et ne contiennent pas d'opérations destructives
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

interface MigrationValidation {
  migrationName: string;
  isSafe: boolean;
  errors: string[];
  warnings: string[];
  hasDestructiveOperations: boolean;
  hasBackupRecommendation: boolean;
}

/**
 * Analyse une migration SQL pour détecter les opérations destructives
 */
function analyzeMigrationSQL(sqlContent: string): {
  isDestructive: boolean;
  operations: string[];
  errors: string[];
  warnings: string[];
} {
  const operations: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let isDestructive = false;

  // Détecter les opérations destructives
  const destructivePatterns = [
    /DROP\s+TABLE\s+IF\s+EXISTS/i,
    /DROP\s+TABLE/i,
    /TRUNCATE\s+TABLE/i,
    /DELETE\s+FROM/i,
    /ALTER\s+TABLE.*DROP\s+COLUMN/i,
    /ALTER\s+TABLE.*DROP\s+CONSTRAINT/i,
  ];

  for (const pattern of destructivePatterns) {
    const matches = sqlContent.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      isDestructive = true;
      operations.push(...matches);
      errors.push(`Opération destructive détectée: ${matches[0]}`);
    }
  }

  // Détecter les opérations risquées
  const riskyPatterns = [
    /ALTER\s+TABLE.*ALTER\s+COLUMN/i,
    /ALTER\s+TABLE.*RENAME/i,
  ];

  for (const pattern of riskyPatterns) {
    const matches = sqlContent.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      operations.push(...matches);
      warnings.push(`Opération risquée détectée: ${matches[0]}`);
    }
  }

  // Vérifier la présence de IF NOT EXISTS pour les CREATE
  const createTableMatches = sqlContent.match(/CREATE\s+TABLE[^;]+/gi);
  if (createTableMatches) {
    for (const match of createTableMatches) {
      if (!match.includes('IF NOT EXISTS')) {
        warnings.push(`CREATE TABLE sans IF NOT EXISTS: ${match.substring(0, 50)}...`);
      }
    }
  }

  return {
    isDestructive,
    operations,
    errors,
    warnings,
  };
}

/**
 * Valide toutes les migrations
 */
function validateAllMigrations(migrationsDir: string): MigrationValidation[] {
  if (!existsSync(migrationsDir)) {
    return [];
  }

  const validations: MigrationValidation[] = [];
  const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  for (const migrationDir of migrationDirs) {
    const migrationPath = join(migrationsDir, migrationDir, 'migration.sql');
    
    if (!existsSync(migrationPath)) {
      continue;
    }

    const sqlContent = readFileSync(migrationPath, 'utf-8');
    const analysis = analyzeMigrationSQL(sqlContent);

    // Vérifier si un backup est recommandé
    const hasBackupRecommendation = analysis.isDestructive || 
      sqlContent.toLowerCase().includes('financial') ||
      sqlContent.toLowerCase().includes('payment') ||
      sqlContent.toLowerCase().includes('student') ||
      sqlContent.toLowerCase().includes('grade');

    validations.push({
      migrationName: migrationDir,
      isSafe: !analysis.isDestructive && analysis.errors.length === 0,
      errors: analysis.errors,
      warnings: analysis.warnings,
      hasDestructiveOperations: analysis.isDestructive,
      hasBackupRecommendation,
    });
  }

  return validations;
}

/**
 * Génère un rapport de validation
 */
function generateValidationReport(validations: MigrationValidation[]): string {
  const report: string[] = [];

  report.push('='.repeat(80));
  report.push('RAPPORT DE VALIDATION DES MIGRATIONS');
  report.push('='.repeat(80));
  report.push('');

  const safeMigrations = validations.filter(v => v.isSafe);
  const unsafeMigrations = validations.filter(v => !v.isSafe);

  report.push(`📊 Total de migrations: ${validations.length}`);
  report.push(`   ✅ Sûres: ${safeMigrations.length}`);
  report.push(`   ❌ Non sûres: ${unsafeMigrations.length}`);
  report.push('');

  if (unsafeMigrations.length > 0) {
    report.push('❌ MIGRATIONS NON SÛRES:');
    report.push('');
    for (const validation of unsafeMigrations) {
      report.push(`Migration: ${validation.migrationName}`);
      if (validation.hasDestructiveOperations) {
        report.push('  ⚠️  Contient des opérations destructives');
      }
      if (validation.errors.length > 0) {
        report.push('  Erreurs:');
        validation.errors.forEach(error => report.push(`    - ${error}`));
      }
      if (validation.warnings.length > 0) {
        report.push('  Avertissements:');
        validation.warnings.forEach(warning => report.push(`    - ${warning}`));
      }
      report.push('');
    }
  }

  report.push('📋 DÉTAIL PAR MIGRATION:');
  report.push('');
  for (const validation of validations) {
    const status = validation.isSafe ? '✅' : '❌';
    report.push(`${status} ${validation.migrationName}`);
    if (validation.hasBackupRecommendation) {
      report.push('  💾 Backup recommandé avant application');
    }
    if (validation.warnings.length > 0) {
      report.push(`  ⚠️  ${validation.warnings.length} avertissement(s)`);
    }
    report.push('');
  }

  return report.join('\n');
}

/**
 * Point d'entrée principal
 */
function main() {
  const migrationsDir = join(__dirname, '../prisma/migrations');

  console.log('🔍 Validation des migrations Prisma...\n');

  const validations = validateAllMigrations(migrationsDir);
  const report = generateValidationReport(validations);

  console.log(report);

  // Écrire le rapport
  const reportPath = join(__dirname, '../prisma/migrations-validation-report.txt');
  require('fs').writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📄 Rapport sauvegardé: ${reportPath}`);

  // Code de sortie
  const hasUnsafeMigrations = validations.some(v => !v.isSafe);
  if (hasUnsafeMigrations) {
    console.log('\n❌ Des migrations non sûres ont été détectées.');
    console.log('   Vérifiez-les avant de les appliquer en production.');
    process.exit(1);
  } else {
    console.log('\n✅ Toutes les migrations sont sûres.');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { validateAllMigrations, analyzeMigrationSQL, generateValidationReport };

