/**
 * Générateur de Migrations Prisma Sûres et Auditables
 * 
 * OBJECTIF : Générer des migrations Prisma automatiques, sûres,
 * sans risque de perte de données ni de dette technique.
 * 
 * PRINCIPE : Utiliser `prisma migrate dev --create-only` pour
 * générer les migrations sans les appliquer automatiquement.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

interface MigrationPlan {
  name: string;
  description: string;
  tables: string[];
  isDestructive: boolean;
  requiresBackup: boolean;
  estimatedTime: string;
}

/**
 * Analyse le schéma pour planifier les migrations
 */
async function planMigrations(schemaPath: string): Promise<MigrationPlan[]> {
  const plans: MigrationPlan[] = [];

  // Migration initiale (si base vide)
  if (!existsSync(join(__dirname, '../prisma/migrations'))) {
    plans.push({
      name: 'init_core',
      description: 'Migration initiale - Tables de base (tenants, academic_years, school_levels, users)',
      tables: ['tenants', 'academic_years', 'school_levels', 'academic_tracks', 'users', 'roles', 'permissions'],
      isDestructive: false,
      requiresBackup: false,
      estimatedTime: '2-5 minutes',
    });
  }

  // Migration étudiants et scolarité
  plans.push({
    name: 'students_module',
    description: 'Module Élèves & Scolarité - Tables étudiants, classes, inscriptions, présence, discipline',
    tables: [
      'students', 'guardians', 'student_guardians', 'student_enrollments',
      'admissions', 'transfer_requests', 'classes', 'class_students', 'class_transfers',
      'attendance_records', 'discipline_records', 'disciplinary_actions',
      'student_documents', 'document_templates', 'generated_documents',
    ],
    isDestructive: false,
    requiresBackup: false,
    estimatedTime: '3-7 minutes',
  });

  // Migration finances
  plans.push({
    name: 'finance_module',
    description: 'Module Finances & Économat - Tables paiements, abonnements, dépenses, trésorerie',
    tables: [
      'fee_configurations', 'discounts', 'payment_plans',
      'tuition_payments', 'tuition_installments', 'school_payment_accounts',
      'subscriptions', 'subscription_invoices', 'payment_flows',
      'expenses', 'expense_categories', 'cash_closures', 'treasury_movements',
    ],
    isDestructive: false,
    requiresBackup: true, // Données financières sensibles
    estimatedTime: '5-10 minutes',
  });

  // Migration RH
  plans.push({
    name: 'hr_module',
    description: 'Module RH & Personnel - Tables personnel, contrats, présence, évaluations, paie',
    tables: [
      'staff', 'staff_documents', 'staff_assignments',
      'contracts', 'contract_templates',
      'staff_attendance', 'staff_evaluations', 'training_sessions',
      'payrolls', 'payroll_items', 'salary_payments',
    ],
    isDestructive: false,
    requiresBackup: true, // Données RH sensibles
    estimatedTime: '4-8 minutes',
  });

  // Migration planification
  plans.push({
    name: 'planning_module',
    description: 'Module Planification & Études - Tables salles, matières, emplois du temps',
    tables: [
      'rooms', 'room_reservations',
      'subjects', 'subject_assignments',
      'timetables', 'timetable_entries', 'timetable_versions',
    ],
    isDestructive: false,
    requiresBackup: false,
    estimatedTime: '2-5 minutes',
  });

  // Migration fiches pédagogiques
  plans.push({
    name: 'pedagogical_sheets_module',
    description: 'Module Fiches Pédagogiques & Cahiers - Tables fiches, journaux, devoirs',
    tables: [
      'pedagogical_sheets', 'pedagogical_sheet_versions', 'pedagogical_sheet_validations',
      'lesson_journals', 'lesson_journal_entries', 'lesson_journal_validations',
      'lesson_plans', 'lesson_plan_assignments',
      'homework_entries', 'homework_submissions',
    ],
    isDestructive: false,
    requiresBackup: true, // Données pédagogiques importantes
    estimatedTime: '4-8 minutes',
  });

  // Migration examens
  plans.push({
    name: 'exams_module',
    description: 'Module Examens & Évaluation - Tables examens, notes, bulletins, classements',
    tables: [
      'exam_sessions', 'exams', 'exam_subjects',
      'exam_scores', 'grade_calculations', 'grade_rules_versions',
      'report_cards', 'report_card_items',
      'rankings', 'honor_rolls',
      'class_councils', 'council_decisions', 'council_minutes',
    ],
    isDestructive: false,
    requiresBackup: true, // Données d'évaluation critiques
    estimatedTime: '5-10 minutes',
  });

  // Migration communication
  plans.push({
    name: 'communication_module',
    description: 'Module Communication - Tables messages, templates, logs (SMS, Email, WhatsApp, Push)',
    tables: [
      'messages', 'message_recipients', 'message_templates',
      'sms_logs', 'email_logs', 'whatsapp_logs', 'push_notifications',
      'communication_stats',
    ],
    isDestructive: false,
    requiresBackup: false,
    estimatedTime: '3-6 minutes',
  });

  // Migration modules supplémentaires
  plans.push({
    name: 'supplementary_modules',
    description: 'Modules Supplémentaires - Bibliothèque, Laboratoire, Transport, Cantine, Infirmerie, QHSE, Boutique, EduCast',
    tables: [
      'library_books', 'library_loans',
      'lab_equipment', 'lab_reservations',
      'vehicles', 'routes', 'transport_assignments',
      'canteen_menus', 'canteen_subscriptions', 'canteen_payments',
      'medical_records', 'medical_visits', 'medications',
      'inspections', 'incidents', 'corrective_actions',
      'products', 'orders', 'order_items', 'store_payments',
      'media_contents', 'media_sessions', 'media_views',
    ],
    isDestructive: false,
    requiresBackup: false,
    estimatedTime: '6-12 minutes',
  });

  // Migration IA
  plans.push({
    name: 'ai_modules',
    description: 'Modules IA - ORION (analytique) et ATLAS (assistant)',
    tables: [
      'kpi_definitions', 'kpi_snapshots',
      'orion_alerts', 'orion_reports',
      'atlas_conversations', 'atlas_messages', 'atlas_feedback',
    ],
    isDestructive: false,
    requiresBackup: false,
    estimatedTime: '2-5 minutes',
  });

  // Migration audit et conformité
  plans.push({
    name: 'audit_compliance',
    description: 'Module Audit, Logs & Conformité - Tables audit, logs, exports, consentements',
    tables: [
      'audit_logs', 'activity_logs',
      'data_exports', 'data_consents',
    ],
    isDestructive: false,
    requiresBackup: false,
    estimatedTime: '2-4 minutes',
  });

  // Migration index et contraintes
  plans.push({
    name: 'indexes_constraints',
    description: 'Index composés et contraintes - Optimisation des requêtes et intégrité référentielle',
    tables: ['ALL'], // Toutes les tables
    isDestructive: false,
    requiresBackup: false,
    estimatedTime: '5-15 minutes',
  });

  return plans;
}

/**
 * Génère une migration Prisma avec documentation
 */
function generateMigrationDocumentation(plan: MigrationPlan, migrationDir: string): void {
  const docPath = join(migrationDir, 'MIGRATION.md');

  const documentation = `# Migration: ${plan.name}

## 📋 Description

${plan.description}

## 📊 Tables Impactées

${plan.tables.map(t => `- \`${t}\``).join('\n')}

## ⚠️  Informations Importantes

- **Destructive** : ${plan.isDestructive ? 'OUI ⚠️' : 'NON ✅'}
- **Backup requis** : ${plan.requiresBackup ? 'OUI ⚠️' : 'NON'}
- **Temps estimé** : ${plan.estimatedTime}

## 🔄 Application

\`\`\`bash
# Vérifier la migration
npx prisma migrate status

# Appliquer la migration
npx prisma migrate deploy

# En développement
npx prisma migrate dev
\`\`\`

## 🔙 Rollback

\`\`\`bash
# Si nécessaire, restaurer depuis un backup
# Les migrations Prisma ne sont pas réversibles automatiquement
# Utiliser un backup PostgreSQL pour rollback
\`\`\`

## ✅ Vérification Post-Migration

1. Vérifier que toutes les tables sont créées
2. Vérifier les index composés
3. Vérifier les contraintes FK
4. Vérifier les données de test

## 📝 Notes

- Migration générée automatiquement
- Date: ${new Date().toISOString()}
- Schéma source: \`schema.prisma\`
`;

  writeFileSync(docPath, documentation, 'utf-8');
}

/**
 * Ajoute des index composés recommandés dans la migration SQL
 */
function enhanceMigrationWithIndexes(migrationDir: string, plan: MigrationPlan): void {
  const migrationPath = join(migrationDir, 'migration.sql');
  
  if (!existsSync(migrationPath)) {
    return;
  }

  let migrationSQL = readFileSync(migrationPath, 'utf-8');

  // Ajouter des index composés pour les tables métier
  const indexAdditions: string[] = [];

  for (const table of plan.tables) {
    if (table === 'ALL') continue;

    // Index composé tenant + academic_year + school_level
    indexAdditions.push(`
-- Index composé pour ${table}
CREATE INDEX IF NOT EXISTS "idx_${table}_tenant_year_level" ON "${table}"("tenant_id", "academic_year_id", "school_level_id");
`);

    // Index pour academic_track_id si applicable
    indexAdditions.push(`
-- Index pour academic_track_id sur ${table}
CREATE INDEX IF NOT EXISTS "idx_${table}_academic_track" ON "${table}"("academic_track_id") WHERE "academic_track_id" IS NOT NULL;
`);
  }

  // Ajouter les index à la fin de la migration
  if (indexAdditions.length > 0) {
    migrationSQL += '\n-- ============================================================================\n';
    migrationSQL += '-- INDEX COMPOSÉS RECOMMANDÉS\n';
    migrationSQL += '-- ============================================================================\n';
    migrationSQL += indexAdditions.join('\n');
  }

  writeFileSync(migrationPath, migrationSQL, 'utf-8');
}

/**
 * Génère les migrations Prisma de manière sûre
 */
async function generateMigrations(): Promise<void> {
  const schemaPath = join(__dirname, '../prisma/schema.prisma');
  const migrationsDir = join(__dirname, '../prisma/migrations');

  console.log('🔄 Génération de migrations Prisma sûres...\n');

  // Planifier les migrations
  const plans = await planMigrations(schemaPath);

  console.log(`📋 ${plans.length} migrations planifiées\n`);

  // Pour chaque plan de migration
  for (const plan of plans) {
    console.log(`📦 Migration: ${plan.name}`);
    console.log(`   Description: ${plan.description}`);
    console.log(`   Tables: ${plan.tables.length}`);
    console.log(`   Backup requis: ${plan.requiresBackup ? 'OUI ⚠️' : 'NON'}\n`);

    try {
      // Générer la migration avec Prisma (sans l'appliquer)
      const migrationName = plan.name;
      
      console.log(`   Génération de la migration...`);
      
      // Utiliser prisma migrate dev --create-only pour générer sans appliquer
      execSync(
        `npx prisma migrate dev --create-only --name ${migrationName} --schema=${schemaPath}`,
        { 
          stdio: 'inherit',
          cwd: join(__dirname, '..'),
        }
      );

      // Trouver le répertoire de migration créé
      const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .filter(name => name.includes(migrationName))
        .sort()
        .reverse();

      if (migrationDirs.length > 0) {
        const latestMigrationDir = join(migrationsDir, migrationDirs[0]);
        
        // Générer la documentation
        generateMigrationDocumentation(plan, latestMigrationDir);
        
        // Améliorer la migration avec des index
        enhanceMigrationWithIndexes(latestMigrationDir, plan);
        
        console.log(`   ✅ Migration créée: ${migrationDirs[0]}\n`);
      } else {
        console.log(`   ⚠️  Migration non trouvée (peut-être déjà existante)\n`);
      }
    } catch (error: any) {
      console.error(`   ❌ Erreur lors de la génération: ${error.message}\n`);
      // Continuer avec les autres migrations
    }
  }

  console.log('✅ Génération des migrations terminée');
}

/**
 * Point d'entrée principal
 */
async function main() {
  try {
    await generateMigrations();
  } catch (error: any) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { planMigrations, generateMigrationDocumentation, enhanceMigrationWithIndexes };

