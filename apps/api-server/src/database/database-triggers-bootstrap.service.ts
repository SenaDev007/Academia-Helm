/**
 * Exécution automatique des triggers SQL (Module 1 — Élèves) au démarrage.
 * Idempotent : CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS, CREATE TRIGGER.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class DatabaseTriggersBootstrapService {
  private readonly logger = new Logger(DatabaseTriggersBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applique les triggers Module 1 (students, student_enrollments).
   * Appelé au bootstrap de l'application.
   */
  async runModule1Triggers(): Promise<void> {
    const statements = this.getModule1TriggerStatements();
    for (let i = 0; i < statements.length; i++) {
      try {
        await this.prisma.$executeRawUnsafe(statements[i]);
      } catch (e) {
        this.logger.warn(`Trigger statement ${i + 1}/${statements.length} failed (non-blocking):`, (e as Error)?.message);
      }
    }
    this.logger.debug('Module 1 triggers applied');
  }

  private getModule1TriggerStatements(): string[] {
    return [
      `CREATE OR REPLACE FUNCTION prevent_student_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Suppression physique interdite. Utiliser is_active = false ou status = WITHDRAWN';
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_prevent_student_delete ON "students"`,
      `CREATE TRIGGER trg_prevent_student_delete BEFORE DELETE ON "students" FOR EACH ROW EXECUTE FUNCTION prevent_student_delete()`,
      `CREATE OR REPLACE FUNCTION prevent_academic_year_update_enrollment()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."academicYearId" IS DISTINCT FROM NEW."academicYearId" THEN
    RAISE EXCEPTION 'Changement d''année scolaire interdit sur un enrollment';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_prevent_year_change ON "student_enrollments"`,
      `CREATE TRIGGER trg_prevent_year_change BEFORE UPDATE ON "student_enrollments" FOR EACH ROW EXECUTE FUNCTION prevent_academic_year_update_enrollment()`,
      `CREATE OR REPLACE FUNCTION prevent_class_change_if_grades()
RETURNS TRIGGER AS $$
DECLARE grade_count INT;
BEGIN
  IF OLD."classId" IS NOT DISTINCT FROM NEW."classId" THEN RETURN NEW; END IF;
  SELECT COUNT(*)::INT INTO grade_count FROM "grades"
  WHERE "studentId" = OLD."studentId" AND "academicYearId" = OLD."academicYearId";
  IF grade_count > 0 THEN RAISE EXCEPTION 'Impossible de changer de classe : notes existantes'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_prevent_class_change_if_grades ON "student_enrollments"`,
      `CREATE TRIGGER trg_prevent_class_change_if_grades BEFORE UPDATE ON "student_enrollments" FOR EACH ROW EXECUTE FUNCTION prevent_class_change_if_grades()`,
      `CREATE OR REPLACE FUNCTION prevent_update_if_year_closed()
RETURNS TRIGGER AS $$
DECLARE
  locked BOOLEAN;
BEGIN
  IF NEW."academicYearId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(ac."isLocked", ay."isClosed") INTO locked
  FROM "academic_years" ay
  LEFT JOIN "academic_year_closures" ac ON ac."academicYearId" = ay."id"
  WHERE ay."id" = NEW."academicYearId";

  IF locked THEN
    RAISE EXCEPTION 'Année scolaire clôturée : modifications interdites pour cette année';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_prevent_update_if_year_closed_enrollments ON "student_enrollments"`,
      `CREATE TRIGGER trg_prevent_update_if_year_closed_enrollments BEFORE INSERT OR UPDATE ON "student_enrollments" FOR EACH ROW EXECUTE FUNCTION prevent_update_if_year_closed()`,
      `DROP TRIGGER IF EXISTS trg_prevent_update_if_year_closed_grades ON "grades"`,
      `CREATE TRIGGER trg_prevent_update_if_year_closed_grades BEFORE INSERT OR UPDATE ON "grades" FOR EACH ROW EXECUTE FUNCTION prevent_update_if_year_closed()`,
      `DROP TRIGGER IF EXISTS trg_prevent_update_if_year_closed_fee_arrears ON "fee_arrears"`,
      `CREATE TRIGGER trg_prevent_update_if_year_closed_fee_arrears BEFORE INSERT OR UPDATE ON "fee_arrears" FOR EACH ROW EXECUTE FUNCTION prevent_update_if_year_closed()`,
    ];
  }

  /**
   * Applique les triggers Module 7 (Finance).
   */
  async runFinanceTriggers(): Promise<void> {
    const statements = this.getFinanceTriggerStatements();
    for (let i = 0; i < statements.length; i++) {
      try {
        await this.prisma.$executeRawUnsafe(statements[i]);
      } catch (e) {
        this.logger.warn(`Finance trigger statement ${i + 1}/${statements.length} failed:`, (e as Error)?.message);
      }
    }
    this.logger.debug('Finance triggers applied');
  }

  /**
   * Corrige les statuts Staff/Contract incohérents en base de données.
   * - Contrats non signés mais marqués ACTIVE → PENDING
   * - Staff sans contrat signé mais marqué ACTIVE → PENDING_SIGNATURE
   * - Staff avec contrat signé mais marqué PENDING_SIGNATURE → ACTIVE
   * Idempotent : peut être relancé sans effet secondaire.
   */
  async runHrStatusDataFix(): Promise<void> {
    this.logger.log('Running HR status data fix...');

    try {
      // 1. Unsigned contracts marked as ACTIVE → PENDING
      const contractsFixed = await this.prisma.$executeRawUnsafe(`
        UPDATE employment_contracts
        SET status = 'PENDING', "updatedAt" = NOW()
        WHERE status = 'ACTIVE'
          AND "signedAt" IS NULL
      `);
      this.logger.log(`HR data fix: ${contractsFixed} unsigned contracts changed from ACTIVE → PENDING`);

      // 2. Staff without signed contract but marked ACTIVE → PENDING_SIGNATURE
      const staffDemoted = await this.prisma.$executeRawUnsafe(`
        UPDATE staff s
        SET status = 'PENDING_SIGNATURE', "updatedAt" = NOW()
        WHERE s.status = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM employment_contracts c
            WHERE c."staffId" = s.id
              AND c.status = 'ACTIVE'
              AND c."signedAt" IS NOT NULL
          )
      `);
      this.logger.log(`HR data fix: ${staffDemoted} staff changed from ACTIVE → PENDING_SIGNATURE (no signed contract)`);

      // 3. Staff with signed contract but marked PENDING_SIGNATURE → ACTIVE
      const staffPromoted = await this.prisma.$executeRawUnsafe(`
        UPDATE staff s
        SET status = 'ACTIVE', "updatedAt" = NOW()
        WHERE s.status = 'PENDING_SIGNATURE'
          AND EXISTS (
            SELECT 1 FROM employment_contracts c
            WHERE c."staffId" = s.id
              AND c.status = 'ACTIVE'
              AND c."signedAt" IS NOT NULL
          )
      `);
      this.logger.log(`HR data fix: ${staffPromoted} staff changed from PENDING_SIGNATURE → ACTIVE (has signed contract)`);
    } catch (e) {
      this.logger.warn('HR status data fix failed (non-blocking):', (e as Error)?.message);
    }
  }

  private getFinanceTriggerStatements(): string[] {
    return [
      // 1. Interdiction de suppression physique des transactions
      `CREATE OR REPLACE FUNCTION prevent_finance_transaction_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Suppression de transaction interdite. Academia Hub impose l''immutabilité financière. Utilisez une écriture inverse (REVERSAL).';
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_no_delete_finance_transaction ON "finance_transactions"`,
      `CREATE TRIGGER trg_no_delete_finance_transaction BEFORE DELETE ON "finance_transactions" FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()`,

      // 2. Mise à jour atomique du solde StudentAccount après chaque transaction
      `CREATE OR REPLACE FUNCTION update_account_balance_after_tx()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "student_accounts"
  SET 
    "totalPaid" = "totalPaid" + NEW.amount,
    "balance" = "balance" - NEW.amount,
    "updatedAt" = NOW()
  WHERE "id" = NEW."studentAccountId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_update_balance_after_tx ON "finance_transactions"`,
      `CREATE TRIGGER trg_update_balance_after_tx AFTER INSERT ON "finance_transactions" FOR EACH ROW EXECUTE FUNCTION update_account_balance_after_tx()`,

      // 3. Audit log automatique sur changement de statut sensible (Blocage)
      `CREATE OR REPLACE FUNCTION audit_account_blocking()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."isBlocked" IS DISTINCT FROM NEW."isBlocked" THEN
    INSERT INTO "financial_audit_logs" ("id", "tenantId", "academicYearId", "entityType", "entityId", "action", "details", "performedAt")
    VALUES (gen_random_uuid(), NEW."tenantId", NEW."academicYearId", 'StudentAccount', NEW."id", 
            CASE WHEN NEW."isBlocked" THEN 'BLOCK' ELSE 'UNBLOCK' END,
            jsonb_build_object('old_status', OLD."status", 'new_status', NEW."status", 'balance', NEW."balance"),
            NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_audit_account_blocking ON "student_accounts"`,
      `CREATE TRIGGER trg_audit_account_blocking AFTER UPDATE ON "student_accounts" FOR EACH ROW EXECUTE FUNCTION audit_account_blocking()`,
    ];
  }
}
