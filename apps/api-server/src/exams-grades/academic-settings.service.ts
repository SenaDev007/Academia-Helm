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
   * ⭐ Returns the ACTIVE settings record for a tenant + school year, scoped by
   * level/cycle/language. Uses a cascade to find the most specific config:
   *   1. Exact match on (levelCode + language + secondaryCycle)
   *   2. Match on (levelCode + language)
   *   3. Match on (levelCode only)
   *   4. Match on (language only)
   *   5. Global (no levelCode, no language)
   *   6. First ACTIVE found
   *
   * @throws NotFoundException if no ACTIVE settings exist for the tenant+year.
   */
  async findActive(
    tenantId: string,
    schoolYearId: string,
    scope?: {
      levelCode?: string;
      cycleCode?: string;
      language?: string;
      secondaryCycle?: string;
      classId?: string;
    },
  ) {
    const { levelCode, language, secondaryCycle, classId } = scope || {};

    // Récupérer tous les ACTIVE pour ce tenant + year
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
        `No active academic settings found for school year ${schoolYearId}`,
      );
    }

    // ⭐ Cascade de sélection par spécificité décroissante
    const settings =
      // 1. classId + levelCode + language + secondaryCycle (le plus spécifique)
      (classId && candidates.find(s =>
        s.classId === classId &&
        s.levelCode === levelCode &&
        s.language === language
      )) ||
      // 2. levelCode + language + secondaryCycle
      (levelCode && language && secondaryCycle && candidates.find(s =>
        s.levelCode === levelCode &&
        s.language === language &&
        s.secondaryCycle === secondaryCycle &&
        !s.classId
      )) ||
      // 3. levelCode + language
      (levelCode && language && candidates.find(s =>
        s.levelCode === levelCode &&
        s.language === language &&
        !s.classId
      )) ||
      // 4. levelCode only (commun aux deux pistes)
      (levelCode && candidates.find(s =>
        s.levelCode === levelCode &&
        !s.language &&
        !s.classId
      )) ||
      // 5. language only (commun à tous les niveaux de cette piste)
      (language && candidates.find(s =>
        !s.levelCode &&
        s.language === language &&
        !s.classId
      )) ||
      // 6. Global (ni levelCode ni language)
      candidates.find(s => !s.levelCode && !s.language && !s.classId) ||
      // 7. Fallback: premier trouvé
      candidates[0];

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
        // ⭐ Nouveaux champs pour le scoping multi-dimensionnel
        language: dto.language ?? null,
        secondaryCycle: dto.secondaryCycle ?? null,
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
    // ⭐ Nouveaux champs de scoping
    if (dto.language !== undefined) data.language = dto.language;
    if (dto.secondaryCycle !== undefined) data.secondaryCycle = dto.secondaryCycle;
    if (dto.schoolYearId !== undefined) data.schoolYearId = dto.schoolYearId;
    if (dto.config !== undefined) data.config = dto.config;

    const result = await this.prisma.schoolAcademicSettings.update({
      where: { id },
      data,
    });

    // ⭐ Synchroniser evaluation_types depuis config.assessmentTypes
    if (dto.config !== undefined) {
      await this.syncEvaluationTypes(result);
    }

    return result;
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

    // ⭐ Désactiver uniquement les configs ACTIVE du MÊME scope dimensionnel
    // (même levelCode + même language + même secondaryCycle + même classId)
    // pour permettre la coexistence de configs par niveau scolaire et par piste linguistique
    await this.prisma.schoolAcademicSettings.updateMany({
      where: {
        tenantId,
        schoolYearId: settings.schoolYearId,
        status: 'ACTIVE',
        id: { not: id },
        // ⭐ Scope strict : même niveau + même piste linguistique + même cycle secondaire
        levelCode: settings.levelCode,
        language: settings.language,
        secondaryCycle: settings.secondaryCycle,
        classId: settings.classId,
      },
      data: { status: 'DRAFT' },
    });

    const result = await this.prisma.schoolAcademicSettings.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        activatedById: userId,
        activatedAt: new Date(),
      },
    });

    // ⭐ Synchroniser evaluation_types depuis config.assessmentTypes
    await this.syncEvaluationTypes(result);

    return result;
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

  // -------------------------------------------------------------------------
  // syncEvaluationTypes — synchronise evaluation_types depuis config.assessmentTypes
  // -------------------------------------------------------------------------

  /**
   * ⭐ Synchronise la table evaluation_types avec config.assessmentTypes
   * du school_academic_settings. Garantit que les types d'évaluation sont
   * persistés dans une vraie table SQL (pour le backup et les requêtes),
   * EN PLUS du JSON school_academic_settings.config.
   *
   * Appelée automatiquement après update() et activate().
   */
  private async syncEvaluationTypes(settings: any) {
    try {
      const config = settings.config as any;
      const assessmentTypes = config?.assessmentTypes || [];
      const tenantId = settings.tenantId;
      const levelCode = (settings.levelCode || '').toUpperCase();

      if (assessmentTypes.length === 0 || !levelCode) return;

      // Résoudre le schoolLevelId depuis le levelCode
      const schoolLevel = await this.prisma.schoolLevel.findFirst({
        where: { tenantId, code: levelCode },
      });
      if (!schoolLevel) return;

      const schoolLevelId = schoolLevel.id;
      const scoreMax = config?.scoreMax || 20;

      for (const at of assessmentTypes) {
        const code = at.code;
        const name = at.label || at.code;
        const defaultMaxScore = scoreMax;
        const defaultCoefficient = at.includedInAverage ? 1 : 0;

        // Vérifier si existe déjà
        const existing = await this.prisma.evaluationType.findFirst({
          where: { tenantId, code, schoolLevelId },
        });

        if (existing) {
          // Mettre à jour
          await this.prisma.evaluationType.update({
            where: { id: existing.id },
            data: { name, defaultMaxScore, defaultCoefficient },
          });
        } else {
          // Créer
          await this.prisma.evaluationType.create({
            data: {
              tenantId,
              name,
              code,
              schoolLevelId,
              isSystem: false,
              defaultMaxScore,
              defaultCoefficient,
            },
          });
        }
      }
    } catch (err) {
      // Ne pas bloquer l'opération principale si la sync échoue
      console.warn('[AcademicSettings] syncEvaluationTypes failed:', err.message);
    }
  }
}
