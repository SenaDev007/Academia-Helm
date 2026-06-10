/**
 * Analyseur de Schéma Prisma
 * 
 * OBJECTIF : Analyser le schema.prisma pour identifier :
 * - Nouvelles tables
 * - Relations (FK)
 * - Index manquants
 * - Contraintes de conformité
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { getDMMF } from '@prisma/internals';

interface TableAnalysis {
  name: string;
  hasTenantId: boolean;
  hasAcademicYearId: boolean;
  hasSchoolLevelId: boolean;
  hasAcademicTrackId: boolean;
  hasCreatedAt: boolean;
  hasUpdatedAt: boolean;
  indexes: string[];
  foreignKeys: Array<{
    field: string;
    references: string;
    table: string;
  }>;
  isBusinessTable: boolean;
  isReadOnly: boolean;
}

interface SchemaAnalysis {
  tables: TableAnalysis[];
  errors: string[];
  warnings: string[];
  missingIndexes: Array<{ table: string; columns: string[] }>;
  missingConstraints: Array<{ table: string; constraint: string }>;
}

/**
 * Analyse le schéma Prisma
 */
async function analyzeSchema(schemaPath: string): Promise<SchemaAnalysis> {
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const dmmf = await getDMMF({ datamodel: schemaContent });

  const analysis: SchemaAnalysis = {
    tables: [],
    errors: [],
    warnings: [],
    missingIndexes: [],
    missingConstraints: [],
  };

  // Tables techniques (exemptées des contraintes)
  const technicalTables = [
    'sync_operations',
    'sync_conflicts',
    'sync_logs',
    'schema_version',
    'audit_logs',
    'activity_logs',
  ];

  // Tables d'agrégation/lecture seule
  const readOnlyTables = [
    'general_module_views', // Si elle existe
  ];

  for (const model of dmmf.datamodel.models) {
    const tableName = model.dbName || model.name.toLowerCase();
    const isTechnical = technicalTables.includes(tableName);
    const isReadOnly = readOnlyTables.includes(tableName);
    const isBusinessTable = !isTechnical && !isReadOnly;

    const tableAnalysis: TableAnalysis = {
      name: tableName,
      hasTenantId: false,
      hasAcademicYearId: false,
      hasSchoolLevelId: false,
      hasAcademicTrackId: false,
      hasCreatedAt: false,
      hasUpdatedAt: false,
      indexes: [],
      foreignKeys: [],
      isBusinessTable,
      isReadOnly,
    };

    // Analyser les champs
    for (const field of model.fields) {
      const fieldName = field.dbName || field.name;

      // Vérifier les colonnes structurantes
      if (fieldName === 'tenantId' || fieldName === 'tenant_id') {
        tableAnalysis.hasTenantId = true;
      }
      if (fieldName === 'academicYearId' || fieldName === 'academic_year_id') {
        tableAnalysis.hasAcademicYearId = true;
      }
      if (fieldName === 'schoolLevelId' || fieldName === 'school_level_id') {
        tableAnalysis.hasSchoolLevelId = true;
      }
      if (fieldName === 'academicTrackId' || fieldName === 'academic_track_id') {
        tableAnalysis.hasAcademicTrackId = true;
      }
      if (fieldName === 'createdAt' || fieldName === 'created_at') {
        tableAnalysis.hasCreatedAt = true;
      }
      if (fieldName === 'updatedAt' || fieldName === 'updated_at') {
        tableAnalysis.hasUpdatedAt = true;
      }

      // Analyser les relations (FK)
      if (field.relationName) {
        const relationField = model.fields.find(f => f.relationName === field.relationName && f !== field);
        if (relationField) {
          const relationModel = dmmf.datamodel.models.find(m => m.name === relationField.type);
          if (relationModel) {
            tableAnalysis.foreignKeys.push({
              field: fieldName,
              references: relationModel.dbName || relationModel.name.toLowerCase(),
              table: tableName,
            });
          }
        }
      }
    }

    // Analyser les index
    for (const index of model.indexes || []) {
      const indexFields = index.fields.map(f => f.name).join(', ');
      tableAnalysis.indexes.push(indexFields);
    }

    // Vérifier les contraintes pour les tables métier
    if (isBusinessTable) {
      const missingConstraints: string[] = [];

      if (!tableAnalysis.hasTenantId) {
        missingConstraints.push('tenant_id');
        analysis.errors.push(`Table métier ${tableName} manque tenant_id`);
      }

      // academic_year_id peut être nullable selon le contexte
      if (!tableAnalysis.hasAcademicYearId) {
        analysis.warnings.push(`Table ${tableName} n'a pas academic_year_id (peut être intentionnel)`);
      }

      // school_level_id peut être nullable selon le contexte
      if (!tableAnalysis.hasSchoolLevelId) {
        analysis.warnings.push(`Table ${tableName} n'a pas school_level_id (peut être intentionnel)`);
      }

      if (!tableAnalysis.hasCreatedAt) {
        missingConstraints.push('created_at');
        analysis.warnings.push(`Table ${tableName} manque created_at`);
      }

      if (!tableAnalysis.hasUpdatedAt) {
        missingConstraints.push('updated_at');
        analysis.warnings.push(`Table ${tableName} manque updated_at`);
      }

      if (missingConstraints.length > 0) {
        analysis.missingConstraints.push({
          table: tableName,
          constraint: missingConstraints.join(', '),
        });
      }

      // Vérifier les index composés
      const hasCompositeIndex = tableAnalysis.indexes.some(idx =>
        idx.includes('tenantId') && (idx.includes('academicYearId') || idx.includes('schoolLevelId'))
      );

      if (!hasCompositeIndex && tableAnalysis.hasTenantId) {
        const indexColumns: string[] = ['tenantId'];
        if (tableAnalysis.hasAcademicYearId) indexColumns.push('academicYearId');
        if (tableAnalysis.hasSchoolLevelId) indexColumns.push('schoolLevelId');

        analysis.missingIndexes.push({
          table: tableName,
          columns: indexColumns,
        });
      }
    }

    analysis.tables.push(tableAnalysis);
  }

  return analysis;
}

/**
 * Génère un rapport d'analyse
 */
function generateReport(analysis: SchemaAnalysis): string {
  const report: string[] = [];

  report.push('='.repeat(80));
  report.push('RAPPORT D\'ANALYSE DU SCHÉMA PRISMA');
  report.push('='.repeat(80));
  report.push('');

  report.push(`📊 Total de tables: ${analysis.tables.length}`);
  report.push(`   - Tables métier: ${analysis.tables.filter(t => t.isBusinessTable).length}`);
  report.push(`   - Tables techniques: ${analysis.tables.filter(t => !t.isBusinessTable && !t.isReadOnly).length}`);
  report.push(`   - Tables lecture seule: ${analysis.tables.filter(t => t.isReadOnly).length}`);
  report.push('');

  // Erreurs
  if (analysis.errors.length > 0) {
    report.push('❌ ERREURS:');
    analysis.errors.forEach(error => report.push(`   - ${error}`));
    report.push('');
  }

  // Avertissements
  if (analysis.warnings.length > 0) {
    report.push('⚠️  AVERTISSEMENTS:');
    analysis.warnings.forEach(warning => report.push(`   - ${warning}`));
    report.push('');
  }

  // Index manquants
  if (analysis.missingIndexes.length > 0) {
    report.push('📇 INDEX COMPOSÉS RECOMMANDÉS:');
    analysis.missingIndexes.forEach(({ table, columns }) => {
      report.push(`   - ${table}: (${columns.join(', ')})`);
    });
    report.push('');
  }

  // Contraintes manquantes
  if (analysis.missingConstraints.length > 0) {
    report.push('🔒 CONTRAINTES MANQUANTES:');
    analysis.missingConstraints.forEach(({ table, constraint }) => {
      report.push(`   - ${table}: ${constraint}`);
    });
    report.push('');
  }

  // Résumé par table
  report.push('📋 DÉTAIL PAR TABLE:');
  report.push('');
  for (const table of analysis.tables) {
    if (table.isBusinessTable) {
      report.push(`Table: ${table.name}`);
      report.push(`  ✅ tenant_id: ${table.hasTenantId ? 'OUI' : 'NON'}`);
      report.push(`  ${table.hasAcademicYearId ? '✅' : '⚠️ '} academic_year_id: ${table.hasAcademicYearId ? 'OUI' : 'NON'}`);
      report.push(`  ${table.hasSchoolLevelId ? '✅' : '⚠️ '} school_level_id: ${table.hasSchoolLevelId ? 'OUI' : 'NON'}`);
      report.push(`  ${table.hasAcademicTrackId ? '✅' : '  '} academic_track_id: ${table.hasAcademicTrackId ? 'OUI' : 'NON'}`);
      report.push(`  ✅ created_at: ${table.hasCreatedAt ? 'OUI' : 'NON'}`);
      report.push(`  ✅ updated_at: ${table.hasUpdatedAt ? 'OUI' : 'NON'}`);
      report.push(`  📇 Index: ${table.indexes.length}`);
      report.push(`  🔗 FK: ${table.foreignKeys.length}`);
      report.push('');
    }
  }

  return report.join('\n');
}

/**
 * Point d'entrée principal
 */
async function main() {
  const schemaPath = join(__dirname, '../prisma/schema.prisma');

  console.log('🔍 Analyse du schéma Prisma...');
  console.log(`📄 Fichier: ${schemaPath}\n`);

  try {
    const analysis = await analyzeSchema(schemaPath);
    const report = generateReport(analysis);

    console.log(report);

    // Écrire le rapport dans un fichier
    const reportPath = join(__dirname, '../prisma/schema-analysis-report.txt');
    require('fs').writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n📄 Rapport sauvegardé: ${reportPath}`);

    // Code de sortie selon les erreurs
    if (analysis.errors.length > 0) {
      console.log('\n❌ Des erreurs ont été détectées. Corrigez-les avant de générer les migrations.');
      process.exit(1);
    } else {
      console.log('\n✅ Analyse terminée sans erreur.');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'analyse:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { analyzeSchema, generateReport, type SchemaAnalysis, type TableAnalysis };

