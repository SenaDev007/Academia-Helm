/**
 * ============================================================================
 * SCORE ENTRY SCHEMA SERVICE
 * ============================================================================
 *
 * Derives the dynamic score-entry column schema for a given class/subject/period
 * from the active SchoolAcademicSettings config. Frontend grade-entry tables
 * call this endpoint to know which columns to render and which formula to use.
 *
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreColumn {
  /** Assessment-type code, used as the field key in score records */
  key: string;
  /** Human-readable column header */
  label: string;
  /** Data type expected for the input ('number' | 'text') */
  type: 'number' | 'text';
  /** Maximum achievable score for this assessment */
  max: number;
  /** Whether this column must be filled before saving */
  required: boolean;
  /** Whether this score is included in the subject average calculation */
  includedInAverage: boolean;
  /** Whether this column should appear on the printed report card */
  visibleOnReportCard: boolean;
}

export interface ScoreEntrySchema {
  /** Column descriptors for the grade-entry table */
  columns: ScoreColumn[];
  /** Subject-average formula expression for display / tooltip */
  formula: string;
}

export interface GetSchemaParams {
  schoolYearId: string;
  cycleCode?: string;
  levelCode?: string;
  classId?: string;
  subjectId?: string;
  periodId?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ScoreEntrySchemaService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // getSchema
  // -------------------------------------------------------------------------

  /**
   * Fetches the ACTIVE SchoolAcademicSettings for the given tenant + school year,
   * then derives a score-entry column schema from `config.assessmentTypes`.
   *
   * If a period filter is provided and the config contains period-specific
   * assessment-type overrides, those take precedence over the global list.
   *
   * @throws NotFoundException when no ACTIVE settings exist for the tenant + year.
   */
  async getSchema(
    tenantId: string,
    params: GetSchemaParams,
  ): Promise<ScoreEntrySchema> {
    const { schoolYearId, cycleCode, levelCode, classId, periodId } = params;

    // Build a where clause that progressively narrows to the most specific
    // settings record available. Order: classId > levelCode > cycleCode > global.
    const candidates = await this.prisma.schoolAcademicSettings.findMany({
      where: {
        tenantId,
        schoolYearId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!candidates || candidates.length === 0) {
      throw new NotFoundException(
        `No active academic settings found for tenant ${tenantId} and school year ${schoolYearId}`,
      );
    }

    // Pick the most specific settings: prefer class-scoped, then level-scoped,
    // then cycle-scoped, then global (classId === null).
    const settings =
      (classId && candidates.find((s: any) => s.classId === classId)) ||
      (levelCode && candidates.find((s: any) => s.levelCode === levelCode && !s.classId)) ||
      (cycleCode && candidates.find((s: any) => s.cycleCode === cycleCode && !s.levelCode && !s.classId)) ||
      candidates.find((s: any) => !s.classId && !s.levelCode && !s.cycleCode) ||
      candidates[0];

    const config = settings.config as Record<string, any>;

    // Resolve the assessment-type list — period-specific overrides first
    let assessmentTypes: any[] = [];

    if (periodId && Array.isArray(config.periodOverrides)) {
      const override = config.periodOverrides.find(
        (o: any) => o.periodId === periodId || o.periodCode === periodId,
      );
      if (override && Array.isArray(override.assessmentTypes)) {
        assessmentTypes = override.assessmentTypes;
      }
    }

    if (assessmentTypes.length === 0 && Array.isArray(config.assessmentTypes)) {
      assessmentTypes = config.assessmentTypes;
    }

    // Build the column descriptors
    const columns: ScoreColumn[] = assessmentTypes.map((at: any) => ({
      key: at.code,
      label: at.label,
      type: 'number',
      max: at.maxScore ?? 20,
      required: at.required !== false, // default true
      includedInAverage: at.includedInAverage !== false, // default true
      visibleOnReportCard: at.visibleOnReportCard !== false, // default true
    }));

    // Extract the subject-average formula expression
    const formula: string =
      config.calculationRules?.subjectAverage?.expression ?? '';

    return { columns, formula };
  }
}
