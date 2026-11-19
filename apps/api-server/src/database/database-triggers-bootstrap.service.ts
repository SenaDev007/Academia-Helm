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
      // ⭐ FIX 2026-09-14 : bypass contrôlé — la suppression définitive d'un élève
      //    (StudentsLifecycleService.deleteStudent, réservée aux statuts
      //    PRE_REGISTERED/ADMITTED sans paiements) pose le flag transaction-local
      //    app.allow_student_delete='true' DANS la même transaction que le DELETE.
      //    Aucune autre voie ne peut le poser. Pattern identique à
      //    app.allow_transaction_delete (finance) — voir getFinanceTriggerStatements().
      //    ⚠ Ce bootstrap ré-applique les triggers à CHAQUE démarrage : toute
      //    modification du function doit être faite ICI ET dans la migration
      //    20260914100000_student_delete_guc_escape (les deux doivent rester
      //    synchronisées).
      `CREATE OR REPLACE FUNCTION prevent_student_delete()
RETURNS TRIGGER AS $$
DECLARE
  allow_delete text;
BEGIN
  allow_delete := current_setting('app.allow_student_delete', true);
  IF allow_delete IS NOT NULL AND allow_delete = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Suppression physique interdite. Utiliser is_active = false ou status = WITHDRAWN. La suppression définitive passe exclusivement par le service applicatif (POST /students/delete-student).';
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
  -- ⭐ FIX 2026-09-06 : l'AFFECTATION INITIALE (classId NULL → classe) est
  -- toujours autorisée. Le blocage ne concerne que le CHANGEMENT entre deux
  -- classes déjà assignées (pour garder les notes rattachées à la bonne
  -- classe). Avant ce correctif, les élèves inscrits sans section physique
  -- (ex : 22 élèves CP de CSPEB) ne pouvaient plus être affectés dès qu'ils
  -- avaient des notes — verrouillage injustifié.
  IF OLD."classId" IS NULL THEN RETURN NEW; END IF;
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
      //    ⭐ Sept. 2026 : bypass contrôlé — la correction de données par le
      //    promoteur (FinanceTransactionService.remove, opération réservée à ce
      //    rôle) pose le flag session app.allow_transaction_delete='true' DANS la
      //    même transaction que le DELETE. Aucune autre voie ne peut le poser.
      `CREATE OR REPLACE FUNCTION prevent_finance_transaction_delete()
RETURNS TRIGGER AS $$
DECLARE
  allow_delete text;
BEGIN
  allow_delete := current_setting('app.allow_transaction_delete', true);
  IF allow_delete IS NOT NULL AND allow_delete = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Suppression de transaction interdite. Academia Hub impose l''immutabilité financière. Utilisez une écriture inverse (REVERSAL).';
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS trg_no_delete_finance_transaction ON "finance_transactions"`,
      `CREATE TRIGGER trg_no_delete_finance_transaction BEFORE DELETE ON "finance_transactions" FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()`,

      // 2. ⭐ MOTEUR UNIFIÉ DU COMPTE DE L'ÉLÈVE (nov. 2026, build 1.0.29) —
      //    remplace l'ancien incrément aveugle update_account_balance_after_tx
      //    (totalPaid += montant COMPLET, y compris la part FIFO des arriérés →
      //    double comptage). RÈGLE IDENTIQUE POUR TOUS LES TENANTS :
      //    compte de l'élève = INSCRIPTION + RÉINSCRIPTION + SCOLARITÉ
      //    (+ arriérés à l'affichage) ; frais généraux / examens / cantine
      //    À PART, jamais additionnés. Les totaux sont DÉRIVÉS des lignes et du
      //    ledger par UNE seule fonction (source de vérité unique).
      //    ⚠ Ce bootstrap ré-applique les triggers à CHAQUE démarrage : toute
      //    modification du moteur doit être faite ICI ET dans la migration
      //    prisma/migrations/unify_compte_eleve_engine.sql (les deux doivent
      //    rester synchronisées).
      `ALTER TABLE "finance_transactions" ADD COLUMN IF NOT EXISTS "arrearsApplied" DECIMAL(10,2) NOT NULL DEFAULT 0`,
      `DROP FUNCTION IF EXISTS student_account_advance(uuid)`,
      `DROP FUNCTION IF EXISTS student_account_advance(text)`,
      `CREATE OR REPLACE FUNCTION student_account_advance(p_account_id text)
RETURNS double precision
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_money       double precision;
  v_alloc       double precision;
  v_arrears     double precision;
  v_lines_paid  double precision;
BEGIN
  SELECT coalesce(sum(ft."amount"), 0) INTO v_money
  FROM "finance_transactions" ft
  WHERE ft."studentAccountId" = p_account_id;

  SELECT coalesce(sum(a."amount"), 0) INTO v_alloc
  FROM "finance_transaction_allocations" a
  JOIN "finance_transactions" ft ON ft.id = a."financeTransactionId"
  WHERE ft."studentAccountId" = p_account_id
    AND ft."type" = 'PAYMENT'
    AND NOT EXISTS (
      SELECT 1 FROM "finance_transactions" r
      WHERE r."reversedFromId" = ft.id AND r."type" = 'REVERSAL'
    );

  SELECT coalesce(sum(ft."arrearsApplied"), 0) INTO v_arrears
  FROM "finance_transactions" ft
  WHERE ft."studentAccountId" = p_account_id
    AND ft."type" = 'PAYMENT'
    AND NOT EXISTS (
      SELECT 1 FROM "finance_transactions" r
      WHERE r."reversedFromId" = ft.id AND r."type" = 'REVERSAL'
    );

  SELECT coalesce(sum(ab."paidAmount"), 0) INTO v_lines_paid
  FROM "account_breakdowns" ab
  WHERE ab."studentAccountId" = p_account_id;

  RETURN greatest(0, least(
    v_money - v_alloc - v_arrears,
    v_money - v_lines_paid
  ))::double precision;
END;
$$`,
      `DROP FUNCTION IF EXISTS recompute_student_account_totals(uuid)`,
      `DROP FUNCTION IF EXISTS recompute_student_account_totals(text)`,
      `CREATE OR REPLACE FUNCTION recompute_student_account_totals(p_account_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_core_due    double precision;
  v_core_paid   double precision;
  v_advance     double precision;
  v_total_due   double precision;
  v_total_paid  double precision;
  v_balance     double precision;
  v_blocked     boolean;
BEGIN
  -- Périmètre « compte de l'élève » : INSCRIPTION + RÉINSCRIPTION + SCOLARITÉ.
  -- (les frais généraux / examens / cantine / autres sont suivis à part)
  SELECT
    coalesce(sum(ab."initialAmount"), 0),
    coalesce(sum(ab."paidAmount"), 0)
  INTO v_core_due, v_core_paid
  FROM "account_breakdowns" ab
  JOIN "fee_structures" fs ON fs.id = ab."feeStructureId"
  WHERE ab."studentAccountId" = p_account_id
    AND fs."feeType" IN ('INSCRIPTION', 'REINSCRIPTION', 'TUITION');

  v_advance := public.student_account_advance(p_account_id);

  v_total_due := v_core_due;
  v_total_paid := v_core_paid + v_advance;
  v_balance := v_total_due - v_total_paid;

  SELECT sa."isBlocked" INTO v_blocked
  FROM "student_accounts" sa
  WHERE sa.id = p_account_id;

  PERFORM set_config('app.allow_balance_update', 'true', true);
  UPDATE "student_accounts"
  SET "totalDue"   = round(v_total_due::numeric, 2),
      "totalPaid"  = round(v_total_paid::numeric, 2),
      "balance"    = round(v_balance::numeric, 2),
      "status"     = CASE
                       WHEN v_blocked THEN "status"
                       WHEN v_balance <= 0.005 THEN 'PAID'::"AccountStatus"
                       WHEN v_total_paid > 0.005 THEN 'PARTIAL'::"AccountStatus"
                       ELSE 'ACTIVE'::"AccountStatus"
                     END,
      "updatedAt"  = now()
  WHERE id = p_account_id;
END;
$$`,
      `CREATE OR REPLACE FUNCTION recompute_after_finance_tx()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_account text;
BEGIN
  v_account := CASE WHEN TG_OP = 'DELETE' THEN OLD."studentAccountId"
                    ELSE NEW."studentAccountId" END;
  PERFORM public.recompute_student_account_totals(v_account);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$`,
      `DROP TRIGGER IF EXISTS trg_update_balance_after_tx ON "finance_transactions"`,
      `DROP FUNCTION IF EXISTS update_account_balance_after_tx()`,
      `DROP TRIGGER IF EXISTS trg_recompute_after_finance_tx ON "finance_transactions"`,
      `CREATE TRIGGER trg_recompute_after_finance_tx AFTER INSERT OR UPDATE OR DELETE ON "finance_transactions" FOR EACH ROW EXECUTE FUNCTION recompute_after_finance_tx()`,
      // ⚠ FIX 2026-11-19 : v_id est TEXT — account_breakdowns."studentAccountId"
      //    est une colonne text et la fonction moteur est (p_account_id text).
      //    Déclaré uuid, le PERFORM résolvait recompute_student_account_totals(uuid)
      //    → « function does not exist » sur CHAQUE écriture de ligne de frais
      //    (création du compte à l'inscription, overrides, encaissements).
      `CREATE OR REPLACE FUNCTION recompute_after_breakdown_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_id text;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    FOR v_id IN SELECT DISTINCT "studentAccountId" FROM new_rows LOOP
      PERFORM public.recompute_student_account_totals(v_id);
    END LOOP;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    FOR v_id IN SELECT DISTINCT "studentAccountId" FROM old_rows LOOP
      PERFORM public.recompute_student_account_totals(v_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$`,
      `DROP TRIGGER IF EXISTS trg_recompute_after_breakdown_insert ON "account_breakdowns"`,
      `CREATE TRIGGER trg_recompute_after_breakdown_insert AFTER INSERT ON "account_breakdowns" REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION recompute_after_breakdown_change()`,
      `DROP TRIGGER IF EXISTS trg_recompute_after_breakdown_update ON "account_breakdowns"`,
      `CREATE TRIGGER trg_recompute_after_breakdown_update AFTER UPDATE ON "account_breakdowns" REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION recompute_after_breakdown_change()`,
      `DROP TRIGGER IF EXISTS trg_recompute_after_breakdown_delete ON "account_breakdowns"`,
      `CREATE TRIGGER trg_recompute_after_breakdown_delete AFTER DELETE ON "account_breakdowns" REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION recompute_after_breakdown_change()`,
      // ⭐ Bypass contrôlé pour la maintenance du ledger (annotation
      //    rétroactive arrearsApplied) — même famille que
      //    app.allow_transaction_delete : JAMAIS posé par l'application,
      //    uniquement par scripts/finance/rescope_student_accounts.py.
      `CREATE OR REPLACE FUNCTION prevent_update_after_closure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allow text;
BEGIN
  allow := current_setting('app.allow_closure_override', true);
  IF allow IS NOT NULL AND allow = 'true' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM "finance_daily_closures" c
    WHERE c."tenantId" = NEW."tenantId"
      AND c."academicYearId" = NEW."academicYearId"
      AND c.date = DATE(NEW."createdAt")
  ) THEN
    RAISE EXCEPTION 'Transaction locked after daily closure';
  END IF;
  RETURN NEW;
END;
$$`,

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

      // 4. prevent_balance_update — block direct modification of balance fields
      // (only the engine recompute_student_account_totals is allowed via the
      //  app.allow_balance_update flag, set by the trigger itself)
      `CREATE OR REPLACE FUNCTION prevent_balance_update()
RETURNS TRIGGER AS $$
DECLARE
  allow_update text;
BEGIN
  allow_update := current_setting('app.allow_balance_update', true);
  IF allow_update IS NULL OR allow_update <> 'true' THEN
    IF (NEW."totalDue"   IS DISTINCT FROM OLD."totalDue") OR
       (NEW."totalPaid"  IS DISTINCT FROM OLD."totalPaid") OR
       (NEW."balance"    IS DISTINCT FROM OLD."balance") OR
       (NEW."arrearsAmount" IS DISTINCT FROM OLD."arrearsAmount") THEN
      RAISE EXCEPTION 'Direct modification of balance fields is forbidden. Use FinanceTransactionService.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON "student_accounts"`,
      `CREATE TRIGGER prevent_balance_update_trigger BEFORE UPDATE OF "totalDue", "totalPaid", "balance", "arrearsAmount" ON "student_accounts" FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()`,

      // 5. prevent_manual_block_update — STRICT block on isBlocked
      `CREATE OR REPLACE FUNCTION prevent_manual_block_update()
RETURNS TRIGGER AS $$
DECLARE
  allow_update text;
BEGIN
  allow_update := current_setting('app.allow_block_update', true);
  IF allow_update IS NULL OR allow_update <> 'true' THEN
    IF (NEW."isBlocked" IS DISTINCT FROM OLD."isBlocked") THEN
      RAISE EXCEPTION 'Direct modification of isBlocked is forbidden. Use StudentAccountService.unblock() or block().';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS prevent_manual_block_update_trigger ON "student_accounts"`,
      `CREATE TRIGGER prevent_manual_block_update_trigger BEFORE UPDATE OF "isBlocked" ON "student_accounts" FOR EACH ROW EXECUTE FUNCTION prevent_manual_block_update()`,

      // 6. verify_integrity_hash — BEFORE UPDATE on finance_transactions
      `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
      `CREATE OR REPLACE FUNCTION verify_integrity_hash()
RETURNS TRIGGER AS $$
DECLARE
  expected_hash text;
  stored_hash text;
BEGIN
  stored_hash := NEW."integrityHash";
  IF (NEW."amount"            IS DISTINCT FROM OLD."amount") OR
     (NEW."type"              IS DISTINCT FROM OLD."type") OR
     (NEW."studentAccountId"  IS DISTINCT FROM OLD."studentAccountId") OR
     (NEW."tenantId"          IS DISTINCT FROM OLD."tenantId") THEN
    expected_hash := encode(
      digest(
        NEW."tenantId" || '|' ||
        NEW."studentAccountId" || '|' ||
        NEW."amount"::text || '|' ||
        NEW."type" || '|' ||
        NEW."createdAt"::timestamptz::text,
        'sha256'
      ),
      'hex'
    );
    IF stored_hash IS NOT NULL AND stored_hash <> expected_hash THEN
      RAISE EXCEPTION 'Integrity hash mismatch on finance_transaction %. Tampering detected.', NEW."id";
    END IF;
    IF stored_hash IS NOT NULL THEN
      NEW."integrityHash" := expected_hash;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS verify_integrity_hash_trigger ON "finance_transactions"`,
      `CREATE TRIGGER verify_integrity_hash_trigger BEFORE UPDATE ON "finance_transactions" FOR EACH ROW EXECUTE FUNCTION verify_integrity_hash()`,

      // 7. prevent_fee_override_delete — BEFORE DELETE on fee_overrides
      `CREATE OR REPLACE FUNCTION prevent_fee_override_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Deletion of fee overrides is forbidden. Override history must be preserved.';
END;
$$ LANGUAGE plpgsql`,
      `DROP TRIGGER IF EXISTS prevent_fee_override_delete_trigger ON "fee_overrides"`,
      `CREATE TRIGGER prevent_fee_override_delete_trigger BEFORE DELETE ON "fee_overrides" FOR EACH ROW EXECUTE FUNCTION prevent_fee_override_delete()`,
    ];
  }
}
