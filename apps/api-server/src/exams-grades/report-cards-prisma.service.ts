/**
 * ============================================================================
 * REPORT CARDS PRISMA SERVICE - MODULE 3
 * ============================================================================
 *
 * Service pour la génération des bulletins officiels
 *
 * 🔹 BILINGUE (FR/EN)
 * ------------------
 * Le service accepte désormais un paramètre optionnel `language` :
 *   - Si `language` est fourni ('FR' ou 'EN'), les notes et matières sont
 *     filtrées par langue : on ne calcule que la moyenne de la track FR ou EN.
 *     Le bulletin créé a `language = 'FR' | 'EN'`.
 *   - Si `language` n'est PAS fourni ET que l'option bilingue est activée avec
 *     `separateGrades=true` dans les settings du tenant, alors on divise le
 *     bulletin en deux sections : `frenchSection` et `englishSection`.
 *     Aucun ReportCard n'est créé dans ce mode lecture-only ; on retourne
 *     simplement la structure double pour prévisualisation.
 *   - Si `language` n'est PAS fourni ET que l'option bilingue n'est PAS
 *     activée (ou `separateGrades=false`), comportement historique inchangé.
 *
 * Le filtre `language` s'applique sur :
 *   - `ExamScore.language` (note saisie dans la langue)
 *   - `ExamScore.exam.language` (langue de l'évaluation)
 *   - `Subject.language` (matière exclusivement FR/EN)
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReportCardsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère les paramètres bilingues du tenant.
   * Retourne null si l'option bilingue n'est pas activée.
   */
  private async getBilingualSettings(tenantId: string) {
    const settings = await this.prisma.settingsBilingual.findUnique({
      where: { tenantId },
    });
    if (!settings || !settings.isEnabled) return null;
    return settings;
  }

  /**
   * Génère un bulletin pour un élève
   *
   * @param data.language  Optionnel ('FR' | 'EN'). Si fourni, génère un bulletin
   *                       filtré sur cette langue. Sinon, en mode bilingue
   *                       separateGrades=true, lève une erreur demandant de
   *                       spécifier une langue (utilisez generateBilingualReportCardPreview
   *                       pour la prévisualisation double-section).
   */
  async generateReportCard(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    studentId: string;
    quarterId?: string;
    type: string; // QUARTERLY | SEMESTER | ANNUAL
    language?: string; // 'FR' | 'EN' — nouveau (bilingue)
  }) {
    // ── Vérifier que l'élève existe ─────────────────────────────────────────
    const student = await this.prisma.student.findFirst({
      where: {
        id: data.studentId,
        tenantId: data.tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    // ── Valider la cohérence du paramètre language en mode bilingue ─────────
    const bilingualSettings = await this.getBilingualSettings(data.tenantId);
    if (bilingualSettings?.separateGrades && !data.language) {
      throw new BadRequestException(
        'Bilingual mode with separateGrades requires a language parameter (FR or EN). ' +
          'Use generateBilingualReportCardPreview for a double-section preview.'
      );
    }

    // ── Vérifier qu'un bulletin n'existe pas déjà (pour la même langue) ─────
    const existing = await this.prisma.reportCard.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        studentId: data.studentId,
        quarterId: data.quarterId || null,
        type: data.type,
        ...(data.language ? { language: data.language } : { language: null }),
      },
    });

    if (existing) {
      throw new BadRequestException('Report card already exists for this period');
    }

    // ── Calculer la moyenne générale et le classement ───────────────────────
    const averages = await this.calculateAverages(
      data.studentId,
      data.tenantId,
      data.academicYearId,
      data.schoolLevelId,
      data.academicTrackId,
      data.quarterId,
      data.language
    );

    // ── Créer le bulletin (avec langue si fournie) ──────────────────────────
    const reportCard = await this.prisma.reportCard.create({
      data: {
        ...data,
        overallAverage: averages.generalAverage,
        rank: averages.rank,
        status: 'DRAFT',
      },
      include: {
        student: true,
        quarter: true,
        academicYear: true,
        schoolLevel: true,
      },
    });

    // ── Créer les items du bulletin (par matière) ───────────────────────────
    const items = await Promise.all(
      averages.subjectAverages.map((avg) =>
        this.prisma.reportCardItem.create({
          data: {
            tenantId: data.tenantId,
            academicYearId: data.academicYearId,
            schoolLevelId: data.schoolLevelId,
            reportCardId: reportCard.id,
            subjectId: avg.subjectId,
            average: avg.average,
            coefficient: avg.coefficient,
            rank: avg.rank,
          },
        })
      )
    );

    return {
      ...reportCard,
      items,
    };
  }

  /**
   * Prévisualisation d'un bulletin bilingue séparé (FR + EN).
   *
   * Retourne deux sections : `frenchSection` et `englishSection`, chacune
   * contenant les moyennes calculées dans sa langue. Aucun ReportCard n'est
   * persisté en base — c'est une lecture-only.
   *
   * À utiliser quand `separateGrades=true` et qu'aucune `language` n'est
   * spécifiée (par exemple pour afficher un bulletin double-face).
   */
  async generateBilingualReportCardPreview(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    studentId: string;
    quarterId?: string;
    type: string;
  }) {
    const bilingualSettings = await this.getBilingualSettings(data.tenantId);
    if (!bilingualSettings?.separateGrades) {
      throw new BadRequestException(
        'Bilingual preview requires separateGrades=true in bilingual settings.'
      );
    }

    const [frenchSection, englishSection] = await Promise.all([
      this.calculateAverages(
        data.studentId,
        data.tenantId,
        data.academicYearId,
        data.schoolLevelId,
        data.academicTrackId,
        data.quarterId,
        'FR'
      ),
      this.calculateAverages(
        data.studentId,
        data.tenantId,
        data.academicYearId,
        data.schoolLevelId,
        data.academicTrackId,
        data.quarterId,
        'EN'
      ),
    ]);

    return {
      frenchSection,
      englishSection,
      separateGrades: true,
    };
  }

  /**
   * Valide un bulletin
   */
  async validateReportCard(
    reportCardId: string,
    tenantId: string,
    validatedBy: string
  ) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId,
      },
    });

    if (!reportCard) {
      throw new NotFoundException(`Report card with ID ${reportCardId} not found`);
    }

    if (reportCard.status !== 'DRAFT') {
      throw new BadRequestException('Report card is not in DRAFT status');
    }

    return this.prisma.reportCard.update({
      where: { id: reportCardId },
      data: {
        status: 'VALIDATED',
        validatedBy,
        validatedAt: new Date(),
      },
      include: {
        student: true,
        quarter: true,
        items: {
          include: {
            subject: true,
          },
        },
      },
    });
  }

  /**
   * Publie un bulletin (génère le PDF)
   */
  async publishReportCard(
    reportCardId: string,
    tenantId: string,
    filePath: string
  ) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId,
        status: 'VALIDATED',
      },
    });

    if (!reportCard) {
      throw new NotFoundException(
        `Validated report card with ID ${reportCardId} not found`
      );
    }

    return this.prisma.reportCard.update({
      where: { id: reportCardId },
      data: {
        status: 'PUBLISHED',
        filePath,
        generatedAt: new Date(),
        publishedAt: new Date(),
      },
      include: {
        student: true,
        quarter: true,
        items: {
          include: {
            subject: true,
          },
        },
      },
    });
  }

  /**
   * Récupère les bulletins d'un élève
   *
   * @param filters.language  Optionnel — filtre par langue ('FR' | 'EN')
   *                          Si non fourni et separateGrades=true, retourne
   *                          { frenchSection, englishSection } à la place d'un
   *                          tableau.
   */
  async findReportCardsByStudent(
    studentId: string,
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      quarterId?: string;
      type?: string;
      status?: string;
      language?: string; // 'FR' | 'EN' — nouveau (bilingue)
    }
  ): Promise<any> {
    // ── Mode bilingue separateGrades sans language → double-section ─────────
    const bilingualSettings = await this.getBilingualSettings(tenantId);
    if (
      bilingualSettings?.separateGrades &&
      !filters?.language &&
      filters?.academicYearId &&
      filters?.schoolLevelId
    ) {
      const [frenchCards, englishCards] = await Promise.all([
        this.findReportCardsByStudent(studentId, tenantId, {
          ...filters,
          language: 'FR',
        }),
        this.findReportCardsByStudent(studentId, tenantId, {
          ...filters,
          language: 'EN',
        }),
      ]);
      return {
        frenchSection: frenchCards,
        englishSection: englishCards,
        separateGrades: true,
      };
    }

    // ── Construction du WHERE ───────────────────────────────────────────────
    const where: any = {
      studentId,
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.quarterId) {
      where.quarterId = filters.quarterId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    // Filtre par langue : si fourni, on filtre sur la langue exacte.
    // Si non fourni en mode non-bilingue, on prend tous les bulletins
    // (y compris ceux dont language est NULL — rétro-compatibilité).
    if (filters?.language) {
      where.language = filters.language;
    }

    return this.prisma.reportCard.findMany({
      where,
      include: {
        quarter: true,
        items: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: [
        { quarter: { number: 'asc' } },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Calcule les moyennes pour un bulletin
   *
   * @param language  Optionnel ('FR' | 'EN'). Si fourni, filtre les notes
   *                  par langue (ExamScore.language OU ExamScore.exam.language
   *                  OU Subject.language).
   */
  private async calculateAverages(
    studentId: string,
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    academicTrackId?: string,
    quarterId?: string,
    language?: string
  ) {
    // ── Construire le filtre des notes ──────────────────────────────────────
    const scoreWhere: any = {
      studentId,
      tenantId,
      academicYearId,
      schoolLevelId,
      isValidated: true,
    };

    if (academicTrackId) {
      scoreWhere.academicTrackId = academicTrackId;
    }

    if (quarterId) {
      scoreWhere.exam = { quarterId };
    }

    // Filtre bilingue : on accepte une note si l'une des conditions suivantes
    // est vraie :
    //   1. ExamScore.language === language
    //   2. ExamScore.exam.language === language
    //   3. ExamScore.subject.language === language
    // On utilise OR pour couvrir les notes saisies avant l'ajout du champ
    // language sur ExamScore mais dont l'Exam ou le Subject a une langue.
    if (language) {
      scoreWhere.OR = [
        { language },
        { exam: { language } },
        { subject: { language } },
      ];
    }

    // ── Récupérer toutes les notes validées de l'élève ──────────────────────
    const scores = await this.prisma.examScore.findMany({
      where: scoreWhere,
      include: {
        exam: {
          include: {
            quarter: true,
          },
        },
        subject: true,
      },
    });

    // Calculer les moyennes par matière
    const subjectMap = new Map<string, { scores: number[]; coefficients: number[] }>();

    scores.forEach((score) => {
      const subjectId = score.subjectId;
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, { scores: [], coefficients: [] });
      }
      const subjectData = subjectMap.get(subjectId)!;
      subjectData.scores.push(score.score);
      subjectData.coefficients.push(score.coefficient);
    });

    const subjectAverages = Array.from(subjectMap.entries()).map(([subjectId, data]) => {
      const total = data.scores.reduce((sum, score, i) => sum + score * data.coefficients[i], 0);
      const totalCoeff = data.coefficients.reduce((sum, coeff) => sum + coeff, 0);
      return {
        subjectId,
        average: totalCoeff > 0 ? total / totalCoeff : 0,
        coefficient: totalCoeff,
        rank: 0, // À calculer avec les autres élèves
      };
    });

    // Calculer la moyenne générale
    const totalAverage = subjectAverages.reduce(
      (sum, subj) => sum + subj.average * subj.coefficient,
      0
    );
    const totalCoeff = subjectAverages.reduce((sum, subj) => sum + subj.coefficient, 0);
    const generalAverage = totalCoeff > 0 ? totalAverage / totalCoeff : 0;

    // Calculer le classement (simplifié - à améliorer)
    const rank = 1; // TODO: Calculer le vrai classement

    return {
      generalAverage,
      rank,
      subjectAverages,
      language: language ?? null,
    };
  }
}
