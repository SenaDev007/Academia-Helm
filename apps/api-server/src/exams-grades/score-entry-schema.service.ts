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
  /** Data type expected for the input ('number' | 'text' | 'qualitative') */
  type: 'number' | 'text' | 'qualitative';
  /** Maximum achievable score for this assessment */
  max: number;
  /** Whether this column must be filled before saving */
  required: boolean;
  /** Whether this score is included in the subject average calculation */
  includedInAverage: boolean;
  /** Whether this column should appear on the printed report card */
  visibleOnReportCard: boolean;
  /** Pour le mode qualitatif : liste des codes autorisés (ex: ['TS','S','PS']) */
  qualitativeOptions?: string[];
  /** Coefficient de l'évaluation (1 par défaut, peut être surchargé) */
  weight?: number;
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

    // ⭐ Détection du mode d'évaluation selon le niveau scolaire
    // MATERNELLE → qualitatif (TS/S/PS)
    // PRIMAIRE → quantitatif /20 avec coef 1 partout
    // SECONDAIRE → quantitatif /20 avec coef variable
    const levelCodeUpper = (levelCode || '').toUpperCase();
    const isMaternelle = levelCodeUpper === 'MATERNELLE' ||
      levelCodeUpper.includes('MATERN') ||
      (cycleCode || '').toUpperCase().includes('MATERN');
    const isPrimaire = levelCodeUpper === 'PRIMAIRE' ||
      levelCodeUpper.includes('PRIM') ||
      (cycleCode || '').toUpperCase().includes('PRIM');

    // ⭐ Mode qualitatif pour la MATERNELLE — retourne des colonnes TS/S/PS
    // au lieu de colonnes numériques
    if (isMaternelle) {
      // Récupérer les domaines maternelle depuis la config ou utiliser les 9 domaines par défaut
      const kindergartenDomains = config.kindergartenDomains || [
        { code: 'SANTE', label: 'Éducation pour la santé' },
        { code: 'REFLEXES', label: 'Éducation aux réflexes de santé' },
        { code: 'ORALE', label: 'Expression orale' },
        { code: 'CORPORELLE', label: 'Expression corporelle' },
        { code: 'PLASTIQUE', label: 'Expression plastique' },
        { code: 'EVEIL', label: 'Éveil scientifique et technologique' },
        { code: 'LECTURE', label: 'Pré-lecture' },
        { code: 'MATH', label: 'Pré-mathématique' },
        { code: 'ECRITURE', label: 'Pré-écriture' },
      ];

      const qualitativeOptions = config.qualitativeOptions || ['TS', 'S', 'PS'];

      const columns: ScoreColumn[] = kindergartenDomains.map((domain: any) => ({
        key: domain.code,
        label: domain.label,
        type: 'qualitative',
        max: 0, // Pas de note numérique
        required: true,
        includedInAverage: false, // Pas de moyenne — synthèse qualitative
        visibleOnReportCard: true,
        qualitativeOptions,
        weight: 1,
      }));

      // Pour la maternelle, la "formule" est la règle de synthèse qualitative
      const formula = `Synthèse qualitative : Réussite si (TS + S) ≥ seuil fixé (${config.qualitativeThreshold || 6}/${kindergartenDomains.length} domaines)`;

      return { columns, formula };
    }

    // ⭐ Mode quantitatif (PRIMAIRE et SECONDAIRE) — notes /20
    // Pour le PRIMAIRE : toutes les matières ont coef 1 (poids identique)
    // Pour le SECONDAIRE : coef variable par matière

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

    // ⭐ Si aucune config assessmentTypes, utiliser les valeurs par défaut
    // selon le niveau scolaire
    if (assessmentTypes.length === 0) {
      if (isPrimaire) {
        // PRIMAIRE : CM (Contrôle Mensuel) + CP (Contrôle Ponctuel) + Total, /20, coef 1
        assessmentTypes = [
          { code: 'CM', label: 'Contrôle Mensuel', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
          { code: 'CP', label: 'Contrôle Ponctuel', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
        ];
      } else {
        // SECONDAIRE : Devoir + Composition, /20, coef variable (configurable)
        assessmentTypes = [
          { code: 'DEVOIR', label: 'Devoir', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
          { code: 'COMPOSITION', label: 'Composition', maxScore: 20, weight: 2, required: true, includedInAverage: true, visibleOnReportCard: true },
        ];
      }
    }

    // Build the column descriptors
    const columns: ScoreColumn[] = assessmentTypes.map((at: any) => ({
      key: at.code,
      label: at.label,
      type: 'number',
      max: at.maxScore ?? 20,
      required: at.required !== false,
      includedInAverage: at.includedInAverage !== false,
      visibleOnReportCard: at.visibleOnReportCard !== false,
      // ⭐ Pour le PRIMAIRE, forcer le poids à 1 (toutes matières coef 1)
      // Pour le SECONDAIRE, utiliser le poids configuré
      weight: isPrimaire ? 1 : (at.weight ?? 1),
    }));

    // Extract the subject-average formula expression
    let formula: string = config.calculationRules?.subjectAverage?.expression ?? '';

    // ⭐ Formule par défaut selon le niveau scolaire
    if (!formula) {
      if (isPrimaire) {
        // PRIMAIRE : moyenne arithmétique simple (coef 1 partout)
        formula = '(CM + CP) / 2';
      } else {
        // SECONDAIRE : moyenne pondérée (Devoir × 1 + Composition × 2) / 3
        formula = '((DEVOIR * 1) + (COMPOSITION * 2)) / 3';
      }
    }

    return { columns, formula };
  }
}
