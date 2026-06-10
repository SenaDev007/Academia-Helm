/**
 * Script de migration SQLite → PostgreSQL
 * 
 * Migre les données d'une école depuis SQLite vers PostgreSQL SaaS
 * 
 * Usage:
 *   ts-node migrate-school.ts --sqlite-path ./academia-hub.db --tenant-id <uuid>
 */

import { Database } from 'better-sqlite3';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface MigrationConfig {
  sqlitePath: string;
  tenantId?: string;
  schoolName?: string;
  postgresUrl: string;
  dryRun?: boolean;
}

interface MigrationResult {
  success: boolean;
  tenantId: string;
  stats: {
    students: number;
    teachers: number;
    classes: number;
    subjects: number;
    payments: number;
    [key: string]: number;
  };
  errors: string[];
}

/**
 * Classe principale de migration
 */
class SchoolMigration {
  private sqliteDb: Database;
  private pgClient: Client;
  private tenantId: string;
  private config: MigrationConfig;
  private stats: Record<string, number> = {};
  private errors: string[] = [];

  constructor(config: MigrationConfig) {
    this.config = config;
    
    // Connexion SQLite
    if (!fs.existsSync(config.sqlitePath)) {
      throw new Error(`SQLite database not found: ${config.sqlitePath}`);
    }
    this.sqliteDb = new Database(config.sqlitePath, { readonly: true });

    // Connexion PostgreSQL
    this.pgClient = new Client({ connectionString: config.postgresUrl });
  }

  /**
   * Exécute la migration complète
   */
  async migrate(): Promise<MigrationResult> {
    try {
      await this.pgClient.connect();
      console.log('✅ Connected to PostgreSQL');

      // Début transaction
      await this.pgClient.query('BEGIN');

      // 1. Créer ou récupérer le tenant
      this.tenantId = await this.ensureTenant();

      // 2. Migrer les données dans l'ordre des dépendances
      await this.migrateAcademicYears();
      await this.migrateQuarters();
      await this.migrateSchools();
      await this.migrateSubjects();
      await this.migrateDepartments();
      await this.migrateTeachers();
      await this.migrateClasses();
      await this.migrateStudents();
      await this.migratePayments();
      await this.migrateExpenses();
      await this.migrateExams();
      await this.migrateGrades();
      await this.migrateAbsences();
      await this.migrateDiscipline();

      // Commit si pas de dry-run
      if (!this.config.dryRun) {
        await this.pgClient.query('COMMIT');
        console.log('✅ Migration committed');
      } else {
        await this.pgClient.query('ROLLBACK');
        console.log('⚠️  Dry-run: changes rolled back');
      }

      return {
        success: this.errors.length === 0,
        tenantId: this.tenantId,
        stats: this.stats,
        errors: this.errors,
      };
    } catch (error) {
      await this.pgClient.query('ROLLBACK');
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.pgClient.end();
      this.sqliteDb.close();
    }
  }

  /**
   * Crée ou récupère le tenant
   */
  private async ensureTenant(): Promise<string> {
    if (this.config.tenantId) {
      // Vérifier existence
      const result = await this.pgClient.query(
        'SELECT id FROM tenants WHERE id = $1',
        [this.config.tenantId],
      );
      if (result.rows.length > 0) {
        return this.config.tenantId;
      }
      throw new Error(`Tenant ${this.config.tenantId} not found`);
    }

    // Créer nouveau tenant
    const schoolName = this.config.schoolName || 'Migrated School';
    const subdomain = this.generateSubdomain(schoolName);
    const tenantId = uuidv4();

    await this.pgClient.query(
      `INSERT INTO tenants (id, name, subdomain, status, created_at)
       VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP)
       ON CONFLICT (subdomain) DO NOTHING
       RETURNING id`,
      [tenantId, schoolName, subdomain],
    );

    console.log(`✅ Tenant created: ${tenantId} (${subdomain})`);
    return tenantId;
  }

  /**
   * Migre les années académiques
   */
  private async migrateAcademicYears(): Promise<void> {
    const rows = this.sqliteDb
      .prepare('SELECT * FROM academic_years')
      .all() as any[];

    for (const row of rows) {
      try {
        await this.pgClient.query(
          `INSERT INTO academic_years (
            id, tenant_id, name, start_date, end_date, is_current,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (tenant_id, name) DO UPDATE SET
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            is_current = EXCLUDED.is_current`,
          [
            row.id || uuidv4(),
            this.tenantId,
            row.name,
            row.start_date || row.startDate,
            row.end_date || row.endDate,
            row.is_current || false,
          ],
        );
      } catch (error) {
        this.errors.push(`Academic year ${row.id}: ${error.message}`);
      }
    }

    this.stats.academicYears = rows.length;
    console.log(`✅ Migrated ${rows.length} academic years`);
  }

  /**
   * Migre les élèves
   */
  private async migrateStudents(): Promise<void> {
    const rows = this.sqliteDb
      .prepare('SELECT * FROM students')
      .all() as any[];

    for (const row of rows) {
      try {
        await this.pgClient.query(
          `INSERT INTO students (
            id, tenant_id, educmaster_number, first_name, last_name,
            gender, date_of_birth, address, phone, email,
            parent_phone, parent_email, parent_name, class_id,
            enrollment_date, enrollment_status, photo_url,
            identity_document_type, identity_document_number, notes,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (id) DO NOTHING`,
          [
            row.id || uuidv4(),
            this.tenantId,
            row.educmaster_number || row.educmasterNumber,
            row.first_name || row.firstName,
            row.last_name || row.lastName,
            row.gender,
            row.date_of_birth || row.dateOfBirth,
            row.address,
            row.phone,
            row.email,
            row.parent_phone || row.parentPhone,
            row.parent_email || row.parentEmail,
            row.parent_name || row.parentName,
            row.class_id || row.classId,
            row.enrollment_date || row.enrollmentDate,
            row.enrollment_status || row.enrollmentStatus || 'active',
            row.photo_url || row.photoUrl,
            row.identity_document_type || row.identityDocumentType,
            row.identity_document_number || row.identityDocumentNumber,
            row.notes,
          ],
        );
      } catch (error) {
        this.errors.push(`Student ${row.id}: ${error.message}`);
      }
    }

    this.stats.students = rows.length;
    console.log(`✅ Migrated ${rows.length} students`);
  }

  /**
   * Migre les enseignants
   */
  private async migrateTeachers(): Promise<void> {
    const rows = this.sqliteDb
      .prepare('SELECT * FROM teachers')
      .all() as any[];

    for (const row of rows) {
      try {
        await this.pgClient.query(
          `INSERT INTO teachers (
            id, tenant_id, matricule, first_name, last_name,
            gender, date_of_birth, address, phone, email,
            department_id, position, specialization, subject_id,
            academic_year_id, hire_date, contract_type, status,
            working_hours, salary, bank_details, emergency_contact,
            qualifications, notes, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (tenant_id, matricule) DO NOTHING`,
          [
            row.id || uuidv4(),
            this.tenantId,
            row.matricule,
            row.first_name || row.firstName,
            row.last_name || row.lastName,
            row.gender,
            row.date_of_birth || row.dateOfBirth,
            row.address,
            row.phone,
            row.email,
            row.department_id || row.departmentId,
            row.position,
            row.specialization,
            row.subject_id || row.subjectId,
            row.academic_year_id || row.academicYearId,
            row.hire_date || row.hireDate,
            row.contract_type || row.contractType,
            row.status || 'active',
            row.working_hours || row.workingHours,
            row.salary,
            row.bank_details || row.bankDetails,
            row.emergency_contact || row.emergencyContact,
            row.qualifications,
            row.notes,
          ],
        );
      } catch (error) {
        this.errors.push(`Teacher ${row.id}: ${error.message}`);
      }
    }

    this.stats.teachers = rows.length;
    console.log(`✅ Migrated ${rows.length} teachers`);
  }

  /**
   * Migre les classes
   */
  private async migrateClasses(): Promise<void> {
    const rows = this.sqliteDb
      .prepare('SELECT * FROM classes')
      .all() as any[];

    for (const row of rows) {
      try {
        await this.pgClient.query(
          `INSERT INTO classes (
            id, tenant_id, name, level, academic_year_id,
            capacity, main_teacher_id, room_id, description,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (tenant_id, name, academic_year_id) DO NOTHING`,
          [
            row.id || uuidv4(),
            this.tenantId,
            row.name,
            row.level,
            row.academic_year_id || row.academicYearId,
            row.capacity,
            row.main_teacher_id || row.mainTeacherId,
            row.room_id || row.roomId,
            row.description,
          ],
        );
      } catch (error) {
        this.errors.push(`Class ${row.id}: ${error.message}`);
      }
    }

    this.stats.classes = rows.length;
    console.log(`✅ Migrated ${rows.length} classes`);
  }

  /**
   * Migre les paiements
   */
  private async migratePayments(): Promise<void> {
    const rows = this.sqliteDb
      .prepare('SELECT * FROM payments')
      .all() as any[];

    for (const row of rows) {
      try {
        await this.pgClient.query(
          `INSERT INTO payments (
            id, tenant_id, student_id, fee_configuration_id,
            amount, payment_method, payment_date, reference,
            receipt_number, status, notes, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (id) DO NOTHING`,
          [
            row.id || uuidv4(),
            this.tenantId,
            row.student_id || row.studentId,
            row.fee_configuration_id || row.feeConfigurationId,
            row.amount,
            row.payment_method || row.paymentMethod,
            row.payment_date || row.paymentDate,
            row.reference,
            row.receipt_number || row.receiptNumber,
            row.status || 'completed',
            row.notes,
          ],
        );
      } catch (error) {
        this.errors.push(`Payment ${row.id}: ${error.message}`);
      }
    }

    this.stats.payments = rows.length;
    console.log(`✅ Migrated ${rows.length} payments`);
  }

  // Méthodes similaires pour les autres tables...
  private async migrateQuarters(): Promise<void> {
    // Implémentation similaire
  }

  private async migrateSchools(): Promise<void> {
    // Implémentation similaire
  }

  private async migrateSubjects(): Promise<void> {
    // Implémentation similaire
  }

  private async migrateDepartments(): Promise<void> {
    // Implémentation similaire
  }

  private async migrateExpenses(): Promise<void> {
    // Implémentation similaire
  }

  private async migrateExams(): Promise<void> {
    // Implémentation similaire
  }

  private async migrateGrades(): Promise<void> {
    // Implémentation similaire
  }

  private async migrateAbsences(): Promise<void> {
    // Implémentation similaire
  }

  private async migrateDiscipline(): Promise<void> {
    // Implémentation similaire
  }

  /**
   * Génère un sous-domaine unique depuis le nom de l'école
   */
  private generateSubdomain(schoolName: string): string {
    return schoolName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 50);
  }
}

// Point d'entrée
async function main() {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    sqlitePath: args.find((a) => a.startsWith('--sqlite-path='))?.split('=')[1] || './academia-hub.db',
    tenantId: args.find((a) => a.startsWith('--tenant-id='))?.split('=')[1],
    schoolName: args.find((a) => a.startsWith('--school-name='))?.split('=')[1],
    postgresUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/academiahub',
    dryRun: args.includes('--dry-run'),
  };

  const migration = new SchoolMigration(config);
  const result = await migration.migrate();

  console.log('\n📊 Migration Summary:');
  console.log(`Tenant ID: ${result.tenantId}`);
  console.log(`Success: ${result.success}`);
  console.log(`Stats:`, result.stats);
  if (result.errors.length > 0) {
    console.log(`Errors:`, result.errors);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { SchoolMigration, MigrationConfig, MigrationResult };

