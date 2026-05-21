/**
 * ============================================================================
 * ACADEMIC SETTINGS SERVICE
 * ============================================================================
 *
 * Manages SchoolAcademicSettings records per tenant.
 * Status lifecycle: DRAFT → ACTIVE → LOCKED → ARCHIVED
 *
 * ============================================================================
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateAcademicSettingsDto,
  UpdateAcademicSettingsDto,
} from './academic-settings.dto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettingsStatus = 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'ARCHIVED';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface SimulatedStudent {
  name: string;
  scores: Record<string, number>;
  average: number;
}

interface SimulationResult {
  students: SimulatedStudent[];
  generalAverage: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AcademicSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------------

  /**
   * Returns all SchoolAcademicSettings for a tenant, optionally filtered by
   * schoolYearId. Results are ordered newest-first.
   */
  async findAll(tenantId: string, schoolYearId?: string) {
    const where: any = { tenantId };
    if (schoolYearId) {
      where.schoolYearId = schoolYearId;
    }

    return this.prisma.schoolAcademicSettings.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // -------------------------------------------------------------------------
  // findActive
  // -------------------------------------------------------------------------

  /**
   * Returns the single ACTIVE settings record for a tenant + school year.
   * Throws NotFoundException if none exists.
   */
  async findActive(tenantId: string, schoolYearId: string) {
    const settings = await this.prisma.schoolAcademicSettings.findFirst({
      where: {
        tenantId,
        schoolYearId,
        status: 'ACTIVE',
      },
    });

    if (!settings) {
      throw new NotFoundException(
        `No active academic settings found for school year ${schoolYearId}`,
      );
    }

    return settings;
  }

  // -------------------------------------------------------------------------
  // findById
  // -------------------------------------------------------------------------

  /**
   * Returns a single settings record by ID, enforcing tenantId ownership.
   */
  async findById(id: string, tenantId: string) {
    const settings = await this.prisma.schoolAcademicSettings.findFirst({
      where: { id, tenantId },
    });

    if (!settings) {
      throw new NotFoundException(
        `Academic settings with ID ${id} not found`,
      );
    }

    return settings;
  }

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------

  /**
   * Creates a new settings record in DRAFT status with version 1.
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateAcademicSettingsDto,
  ) {
    return this.prisma.schoolAcademicSettings.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        countryCode: dto.countryCode,
        systemCode: dto.systemCode ?? null,
        cycleCode: dto.cycleCode ?? null,
        levelCode: dto.levelCode ?? null,
        classId: dto.classId ?? null,
        schoolYearId: dto.schoolYearId,
        config: dto.config,
        status: 'DRAFT' as SettingsStatus,
        version: 1,
        createdById: userId,
      },
    });
  }

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  /**
   * Updates an existing settings record.
   * LOCKED and ARCHIVED records cannot be modified.
   */
  async update(
    id: string,
    tenantId: string,
    dto: UpdateAcademicSettingsDto,
  ) {
    const settings = await this.findById(id, tenantId);

    if (settings.status === 'LOCKED') {
      throw new BadRequestException(
        'Cannot update a LOCKED settings record. Archive it first.',
      );
    }

    if (settings.status === 'ARCHIVED') {
      throw new BadRequestException(
        'Cannot update an ARCHIVED settings record.',
      );
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.countryCode !== undefined) data.countryCode = dto.countryCode;
    if (dto.systemCode !== undefined) data.systemCode = dto.systemCode;
    if (dto.cycleCode !== undefined) data.cycleCode = dto.cycleCode;
    if (dto.levelCode !== undefined) data.levelCode = dto.levelCode;
    if (dto.classId !== undefined) data.classId = dto.classId;
    if (dto.schoolYearId !== undefined) data.schoolYearId = dto.schoolYearId;
    if (dto.config !== undefined) data.config = dto.config;

    return this.prisma.schoolAcademicSettings.update({
      where: { id },
      data,
    });
  }

  // -------------------------------------------------------------------------
  // activate
  // -------------------------------------------------------------------------

  /**
   * Activates a settings record:
   * 1. Deactivates any currently ACTIVE record for the same tenant + schoolYear.
   * 2. Sets the target record to ACTIVE.
   *
   * Cannot activate a LOCKED or ARCHIVED record.
   */
  async activate(id: string, tenantId: string, userId: string) {
    const settings = await this.findById(id, tenantId);

    if (settings.status === 'LOCKED') {
      throw new BadRequestException('Cannot activate a LOCKED settings record.');
    }

    if (settings.status === 'ARCHIVED') {
      throw new BadRequestException(
        'Cannot activate an ARCHIVED settings record.',
      );
    }

    // Deactivate all currently ACTIVE settings for the same tenant + school year
    await this.prisma.schoolAcademicSettings.updateMany({
      where: {
        tenantId,
        schoolYearId: settings.schoolYearId,
        status: 'ACTIVE',
        id: { not: id },
      },
      data: { status: 'DRAFT' },
    });

    return this.prisma.schoolAcademicSettings.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        activatedById: userId,
        activatedAt: new Date(),
      },
    });
  }

  // -------------------------------------------------------------------------
  // lock
  // -------------------------------------------------------------------------

  /**
   * Locks a settings record to prevent further modifications.
   * Only ACTIVE records can be locked.
   */
  async lock(id: string, tenantId: string, userId: string) {
    const settings = await this.findById(id, tenantId);

    if (settings.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Only ACTIVE settings can be locked. Current status: ${settings.status}`,
      );
    }

    return this.prisma.schoolAcademicSettings.update({
      where: { id },
      data: {
        status: 'LOCKED',
        lockedById: userId,
        lockedAt: new Date(),
      },
    });
  }

  // -------------------------------------------------------------------------
  // archive
  // -------------------------------------------------------------------------

  /**
   * Archives a settings record. Any status can be archived.
   */
  async archive(id: string, tenantId: string) {
    await this.findById(id, tenantId);

    return this.prisma.schoolAcademicSettings.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  // -------------------------------------------------------------------------
  // duplicate
  // -------------------------------------------------------------------------

  /**
   * Creates a copy of an existing settings record as a new DRAFT with
   * version incremented by 1. The caller may override the name via dto.name.
   */
  async duplicate(
    id: string,
    tenantId: string,
    userId: string,
    overrideName?: string,
  ) {
    const source = await this.findById(id, tenantId);

    // Find the highest existing version for this tenant + schoolYear
    const maxVersionResult = await this.prisma.schoolAcademicSettings.aggregate(
      {
        where: {
          tenantId,
          schoolYearId: source.schoolYearId,
        },
        _max: { version: true },
      },
    );

    const nextVersion = (maxVersionResult._max.version ?? 0) + 1;
    const newName =
      overrideName ?? `${source.name} (copie v${nextVersion})`;

    return this.prisma.schoolAcademicSettings.create({
      data: {
        tenantId,
        name: newName,
        description: source.description,
        countryCode: source.countryCode,
        systemCode: source.systemCode,
        cycleCode: source.cycleCode,
        levelCode: source.levelCode,
        classId: source.classId,
        schoolYearId: source.schoolYearId,
        config: source.config as any,
        status: 'DRAFT',
        version: nextVersion,
        createdById: userId,
      },
    });
  }

  // -------------------------------------------------------------------------
  // validate
  // -------------------------------------------------------------------------

  /**
   * Validates that a config object contains all required structural fields.
   * Returns { valid, errors } without throwing so the caller can present
   * detailed feedback to the user.
   */
  validate(config: any): ValidationResult {
    const errors: string[] = [];

    if (!config || typeof config !== 'object') {
      return { valid: false, errors: ['config must be a non-null object'] };
    }

    // Validate periods
    if (!Array.isArray(config.periods) || config.periods.length === 0) {
      errors.push('config.periods must be a non-empty array');
    } else {
      config.periods.forEach((period: any, index: number) => {
        if (!period.code) {
          errors.push(`config.periods[${index}].code is required`);
        }
        if (!period.label) {
          errors.push(`config.periods[${index}].label is required`);
        }
      });
    }

    // Validate assessmentTypes
    if (
      !Array.isArray(config.assessmentTypes) ||
      config.assessmentTypes.length === 0
    ) {
      errors.push('config.assessmentTypes must be a non-empty array');
    } else {
      config.assessmentTypes.forEach((at: any, index: number) => {
        if (!at.code) {
          errors.push(`config.assessmentTypes[${index}].code is required`);
        }
        if (!at.label) {
          errors.push(`config.assessmentTypes[${index}].label is required`);
        }
        if (at.maxScore === undefined || at.maxScore === null) {
          errors.push(`config.assessmentTypes[${index}].maxScore is required`);
        }
      });
    }

    // Validate calculationRules
    if (
      !config.calculationRules ||
      typeof config.calculationRules !== 'object'
    ) {
      errors.push('config.calculationRules must be a non-null object');
    } else {
      const rules = config.calculationRules;

      if (
        !rules.subjectAverage ||
        typeof rules.subjectAverage.expression !== 'string'
      ) {
        errors.push(
          'config.calculationRules.subjectAverage.expression (string) is required',
        );
      }

      if (!rules.generalAverage || typeof rules.generalAverage !== 'object') {
        errors.push(
          'config.calculationRules.generalAverage must be a non-null object',
        );
      }

      if (!Array.isArray(rules.promotionRules)) {
        errors.push(
          'config.calculationRules.promotionRules must be an array',
        );
      }

      if (!Array.isArray(rules.appreciationScale)) {
        errors.push(
          'config.calculationRules.appreciationScale must be an array',
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // -------------------------------------------------------------------------
  // simulate
  // -------------------------------------------------------------------------

  /**
   * Generates a simulation with 3 mock students using random scores based on
   * the assessmentTypes declared in config. Averages are computed according to
   * config.calculationRules.subjectAverage.expression.
   */
  simulate(config: any): SimulationResult {
    const validation = this.validate(config);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid config for simulation',
        errors: validation.errors,
      });
    }

    const assessmentTypes: Array<{
      code: string;
      label: string;
      maxScore: number;
      weight?: number;
    }> = config.assessmentTypes;

    const expression: string =
      config.calculationRules?.subjectAverage?.expression ?? '';

    const mockNames = ['Alice Dupont', 'Brice Nkomo', 'Céleste Martin'];

    const students: SimulatedStudent[] = mockNames.map((name) => {
      // Generate a random score for each assessment type
      const scores: Record<string, number> = {};
      for (const at of assessmentTypes) {
        const max = at.maxScore ?? 20;
        scores[at.code] = parseFloat(
          (Math.random() * max).toFixed(2),
        );
      }

      const average = this.evaluateExpressionSafely(expression, scores);

      return { name, scores, average };
    });

    const generalAverage = parseFloat(
      (
        students.reduce((sum, s) => sum + s.average, 0) / students.length
      ).toFixed(2),
    );

    return { students, generalAverage };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Evaluates the subject-average expression by substituting assessment-type
   * codes with their numeric scores, then running the result through Function().
   * Falls back to arithmetic mean on error.
   */
  private evaluateExpressionSafely(
    expression: string,
    scores: Record<string, number>,
  ): number {
    try {
      let expr = expression;
      for (const [code, value] of Object.entries(scores)) {
        // Replace all occurrences of the code (word-boundary safe)
        expr = expr.replace(new RegExp(`\\b${code}\\b`, 'g'), String(value));
      }

      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${expr})`)() as number;
      if (typeof result !== 'number' || isNaN(result)) {
        throw new Error('Expression did not evaluate to a number');
      }
      return parseFloat(result.toFixed(2));
    } catch {
      // Fallback: arithmetic mean of all scores
      const values = Object.values(scores);
      if (values.length === 0) return 0;
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      return parseFloat(mean.toFixed(2));
    }
  }
}
