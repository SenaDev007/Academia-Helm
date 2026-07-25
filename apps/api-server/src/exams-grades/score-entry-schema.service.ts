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
  /** ⭐ Piste linguistique : 'FR' ou 'EN' */
  language?: string;
  /** ⭐ Cycle secondaire : 'CYCLE_I' ou 'CYCLE_II' */
  secondaryCycle?: string;
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
    const { schoolYearId, cycleCode, levelCode, classId, periodId, language, secondaryCycle } = params;

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

    // Pick the most specific settings: prefer class-scoped, then level+language,
    // then level-scoped, then language-scoped, then global.
    const settings =
      // 1. classId + levelCode + language (most specific)
      (classId && language && candidates.find((s: any) =>
        s.classId === classId && s.language === language
      )) ||
      // 2. classId only (no language filter)
      (classId && candidates.find((s: any) => s.classId === classId)) ||
      // 3. levelCode + language + secondaryCycle
      (levelCode && language && secondaryCycle && candidates.find((s: any) =>
        s.levelCode === levelCode && s.language === language &&
        s.secondaryCycle === secondaryCycle && !s.classId
      )) ||
      // 4. levelCode + language
      (levelCode && language && candidates.find((s: any) =>
        s.levelCode === levelCode && s.language === language && !s.classId
      )) ||
      // 5. levelCode only (commun aux deux pistes)
      (levelCode && candidates.find((s: any) =>
        s.levelCode === levelCode && !s.language && !s.classId
      )) ||
      // 6. language only
      (language && candidates.find((s: any) =>
        !s.levelCode && s.language === language && !s.classId
      )) ||
      // 7. cycleCode only
      (cycleCode && candidates.find((s: any) =>
        s.cycleCode === cycleCode && !s.levelCode && !s.classId && !s.language
      )) ||
      // 8. Global
      candidates.find((s: any) => !s.classId && !s.levelCode && !s.cycleCode && !s.language) ||
      // 9. Fallback
      candidates[0];

    const config = settings.config as Record<string, any>;

    // ⭐ Détection du mode d'évaluation selon le niveau scolaire
    // MATERNELLE → qualitatif (TS/S/PS)
    // PRIMAIRE → quantitatif /20 avec coef 1 partout
    // SECONDAIRE → quantitatif /20 avec coef variable
    const levelCodeUpper = (levelCode || '').toUpperCase();
    const isAnglophone = (language || '').toUpperCase() === 'EN';
    const isMaternelle = levelCodeUpper === 'MATERNELLE' ||
      levelCodeUpper.includes('MATERN') ||
      (cycleCode || '').toUpperCase().includes('MATERN');
    const isPrimaire = levelCodeUpper === 'PRIMAIRE' ||
      levelCodeUpper.includes('PRIM') ||
      (cycleCode || '').toUpperCase().includes('PRIM');

    // ⭐ Mode qualitatif pour la MATERNELLE FRANCOPHONE uniquement — retourne des colonnes TS/S/PS
    // La maternelle ANGLOPHONE utilise le système quantitatif /100 (comme les autres niveaux EN)
    const isMaternelleFR = isMaternelle && !isAnglophone;
    if (isMaternelleFR) {
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

    // ⭐ Mode quantitatif (PRIMAIRE et SECONDAIRE)
    // Système FRANCOPHONE : notes /20 (CM/CP pour primaire, Interros/Devoirs pour secondaire)
    // Système ANGLOPHONE : notes /100 (First CA /40 + Second CA /40 + Exam /60)

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
    // selon le niveau scolaire ET la piste linguistique
    if (assessmentTypes.length === 0) {
      if (isAnglophone) {
        // ⭐ SYSTÈME ANGLOPHONE : First CA (/40) + Second CA (/40) + Exam (/60) = /100
        assessmentTypes = [
          { code: 'FIRST_CA', label: 'First CA', maxScore: 40, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
          { code: 'SECOND_CA', label: 'Second CA', maxScore: 40, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
          { code: 'EXAM', label: 'Exam', maxScore: 60, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
        ];
      } else if (isPrimaire) {
        // PRIMAIRE FRANCOPHONE : Éval. mensuelle 1, Éval. mensuelle 2, Éval. certificative — /20, coef 1
        // CM (Critère Maximal, sur 18) + CP (Critère de Perfectionnement, sur 2) = /20
        assessmentTypes = [
          { code: 'EM1', label: 'Évaluation mensuelle 1', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
          { code: 'EM2', label: 'Évaluation mensuelle 2', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
          { code: 'EC', label: 'Évaluation certificative', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
        ];
      } else {
        // SECONDAIRE FRANCOPHONE : Interrogation 1, Interrogation 2, Devoir surveillé 1, Devoir surveillé 2 — /20
        assessmentTypes = [
          { code: 'INT1', label: 'Interrogation 1', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
          { code: 'INT2', label: 'Interrogation 2', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
          { code: 'DS1', label: 'Devoir surveillé 1', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
          { code: 'DS2', label: 'Devoir surveillé 2', maxScore: 20, weight: 1, required: true, includedInAverage: true, visibleOnReportCard: true },
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
      // ⭐ Pour le PRIMAIRE francophone, forcer le poids à 1 (toutes matières coef 1)
      // Pour l'anglophone, le barème est /100 (First CA + Second CA + Exam)
      // Pour le SECONDAIRE francophone, utiliser le poids configuré
      weight: isPrimaire ? 1 : (at.weight ?? 1),
    }));

    // Extract the subject-average formula expression
    let formula: string = config.calculationRules?.subjectAverage?.expression ?? '';

    // ⭐ Formule par défaut selon le niveau scolaire ET la piste linguistique
    if (!formula) {
      if (isAnglophone) {
        // ANGLOPHONE : First CA + Second CA + Exam = Total /100
        formula = 'FIRST_CA + SECOND_CA + EXAM';
      } else if (isPrimaire) {
        // PRIMAIRE FRANCOPHONE : CM(18) + CP(2) = /20 (moyenne arithmétique, coef 1)
        formula = '(EM1 + EM2 + EC) / 3';
      } else {
        // SECONDAIRE FRANCOPHONE : (INT1 + INT2) / 2 puis (Moy_interros + DS1 + DS2) / 3
        formula = '((INT1 + INT2) / 2 + DS1 + DS2) / 3';
      }
    }

    return { columns, formula };
  }
}
