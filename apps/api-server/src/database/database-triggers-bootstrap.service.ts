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

  SELECT COALESCE(ac."is_locked", ay."isClosed") INTO locked
  FROM "academic_years" ay
  LEFT JOIN "academic_year_closures" ac ON ac."academic_year_id" = ay."id"
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
}
