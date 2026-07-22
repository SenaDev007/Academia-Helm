/**
 * ============================================================================
 * BULLETINS SERVICE - MODULE 3
 * ============================================================================
 *
 * Moteur de calcul des moyennes, classements et génération de bulletins.
 *
 * ⭐ Phase 1 refactor :
 *   - Utilise désormais AcademicRulesEngine (moteur configurable) au lieu
 *     d'une moyenne arithmétique hardcodée.
 *   - Récupère la formule + l'échelle d'appréciation + les règles de promotion
 *     depuis SchoolAcademicSettings (config active du tenant).
 *   - Suppression du code en dur : coefficient PRIMAIRE=1, mentions
 *     "Très Bien/Bien/Assez Bien/Passable/Insuffisant".
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AcademicRulesEngine, SubjectAverageRule, AppreciationScale, PromotionRule } from '../../../exams-grades/academic-rules-engine.service';
import { AcademicSettingsService } from '../../../exams-grades/academic-settings.service';

@Injectable()
export class BulletinsService {
  private readonly logger = new Logger(BulletinsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEngine: AcademicRulesEngine,
    private readonly academicSettingsService: AcademicSettingsService,
  ) {}

  /**
   * Génère les moyennes pour toute une classe pour une période donnée.
   *
   * ⭐ Utilise AcademicRulesEngine + SchoolAcademicSettings (config active).
   */
  async generateClassAverages(tenantId: string, academicYearId: string, periodId: string, classId: string) {
    this.logger.log(`Calcul des moyennes : Classe ${classId}, Période ${periodId}`);

    // 1. Récupérer tous les élèves de la classe
    const classStudents = await this.prisma.classStudent.findMany({
      where: { classId, academicYearId, tenantId },
      include: { student: true },
    });

    if (classStudents.length === 0) throw new NotFoundException('Aucun élève trouvé dans cette classe');

    // 2. Récupérer toutes les notes validées de la période pour cette classe
    const grades = await this.prisma.grade.findMany({
      where: {
        tenantId,
        academicYearId,
        periodId,
        classId,
        status: 'VALIDATED',
      },
      include: { subject: true, evaluation: { include: { evaluationType: true } } },
    });

    // 3. ⭐ Récupérer la config académique active du tenant (formule, mentions, etc.)
    const academicConfig = await this.getActiveAcademicConfig(tenantId, academicYearId);
    const subjectFormula = academicConfig?.calculationRules?.subjectAverage?.expression;
    const subjectRule: SubjectAverageRule | undefined = subjectFormula
      ? { type: 'WEIGHTED_AVERAGE', expression: subjectFormula }
      : undefined;
    const appreciationScale: AppreciationScale[] = academicConfig?.mentions || [];

    const results = [];

    // 4. Calculer pour chaque élève
    for (const cs of classStudents) {
      const studentGrades = grades.filter(g => g.studentId === cs.studentId);
      const studentResult = await this.calculateStudentPeriodPerformance(
        tenantId, academicYearId, periodId,
        cs.studentId, classId, studentGrades,
        subjectRule, appreciationScale,
      );
      results.push(studentResult);
    }

    // 5. Calculer les rangs (Tri par moyenne générale décroissante)
    // ⭐ Utilise DENSE_RANK par défaut (configurable via rankingRules.tieMode)
    const tieMode = academicConfig?.rankingRules?.tieMode || 'DENSE_RANK';
    const sortedResults = [...results].sort((a, b) => Number(b.generalAverage) - Number(a.generalAverage));
    const finalResults = this.applyRanking(sortedResults, tieMode);

    // 6. Sauvegarder les résultats (StudentPeriodAverage)
    await this.prisma.$transaction(
      finalResults.map(res =>
        this.prisma.studentPeriodAverage.upsert({
          where: {
            tenantId_academicYearId_periodId_studentId: {
              tenantId, academicYearId, periodId, studentId: res.studentId
            }
          },
          update: {
            totalWeighted: res.totalWeighted,
            totalCoefficient: res.totalCoefficient,
            generalAverage: res.generalAverage,
            classRank: res.classRank,
            calculatedAt: new Date(),
          },
          create: {
            tenantId, academicYearId, periodId,
            studentId: res.studentId,
            classId,
            totalWeighted: res.totalWeighted,
            totalCoefficient: res.totalCoefficient,
            generalAverage: res.generalAverage,
            classRank: res.classRank,
          }
        })
      )
    );

    return { success: true, processedCount: finalResults.length };
  }

  /**
   * ⭐ Récupère la configuration académique active pour le tenant.
   * Retourne un objet structuré : calculationRules, mentions, rankingRules, promotionRules.
   * Si aucune config active → retourne un objet vide (fallback sur moyenne arithmétique).
   */
  private async getActiveAcademicConfig(tenantId: string, academicYearId: string): Promise<{
    calculationRules?: {
      subjectAverage?: { expression: string };
      generalAverage?: { method: string };
    };
    mentions?: AppreciationScale[];
    rankingRules?: { tieMode?: string; scope?: string };
    promotionRules?: PromotionRule[];
    scoreScale?: { min: number; max: number; passScore: number };
  } | null> {
    try {
      const settings = await this.academicSettingsService.findActive(tenantId, academicYearId);
      const config = settings.config as any;
      return {
        calculationRules: config.calculationRules,
        mentions: config.mentions || this.getDefaultMentions(),
        rankingRules: config.rankingRules,
        promotionRules: config.promotionRules?.rules || [],
        scoreScale: config.scoreScale,
      };
    } catch {
      // Aucune config active → fallback sur mentions par défaut
      this.logger.warn(`⚠️ Aucune config académique active pour tenant ${tenantId} — utilisation des valeurs par défaut`);
      return {
        mentions: this.getDefaultMentions(),
        rankingRules: { tieMode: 'DENSE_RANK' },
      };
    }
  }

  /**
   * ⭐ Mentions par défaut (utilisées si aucune config active n'est trouvée).
   * Cohérent avec le frontend useAcademicSettings.ts.
   */
  private getDefaultMentions(): AppreciationScale[] {
    return [
      { min: 16, max: 20, label: 'Très Bien', appreciation: 'Félicitations du jury' },
      { min: 14, max: 15.99, label: 'Bien', appreciation: 'Encouragements' },
      { min: 12, max: 13.99, label: 'Assez Bien', appreciation: "Tableau d'honneur" },
      { min: 10, max: 11.99, label: 'Passable', appreciation: '' },
      { min: 0, max: 9.99, label: 'Insuffisant', appreciation: 'Avertissement' },
    ];
  }

  /**
   * ⭐ Applique le classement selon le mode (DENSE_RANK / COMPETITION_RANK / UNIQUE).
   */
  private applyRanking(sortedResults: any[], tieMode: string): any[] {
    if (tieMode === 'COMPETITION_RANK') {
      // 1, 2, 2, 4 (saute les rangs)
      let prevAvg: number | null = null;
      let prevRank = 0;
      let count = 0;
      return sortedResults.map(res => {
        count++;
        if (prevAvg !== null && Number(res.generalAverage) === prevAvg) {
          return { ...res, classRank: prevRank };
        }
        prevRank = count;
        prevAvg = Number(res.generalAverage);
        return { ...res, classRank: prevRank };
      });
    }
    // DENSE_RANK (défaut) : 1, 2, 2, 3 (ne saute pas)
    let prevAvg: number | null = null;
    let currentRank = 0;
    return sortedResults.map(res => {
      if (prevAvg !== null && Number(res.generalAverage) === prevAvg) {
        return { ...res, classRank: currentRank };
      }
      currentRank++;
      prevAvg = Number(res.generalAverage);
      return { ...res, classRank: currentRank };
    });
  }

  /**
   * Calcule la performance d'un élève sur une période.
   *
   * ⭐ Utilise AcademicRulesEngine.evaluateSubjectAverage() si une formule
   * est configurée. Sinon fallback sur moyenne arithmétique simple.
   * ⭐ Le coefficient vient du subject.coefficient (plus de forçage PRIMAIRE=1).
   * ⭐ L'appréciation vient de AcademicRulesEngine.getAppreciation() avec
   * l'échelle configurée.
   */
  private async calculateStudentPeriodPerformance(
    tenantId: string,
    academicYearId: string,
    periodId: string,
    studentId: string,
    classId: string,
    grades: any[],
    subjectRule: SubjectAverageRule | undefined,
    appreciationScale: AppreciationScale[],
  ) {
    // Récupérer le niveau scolaire de la classe pour appliquer la bonne logique
    const classInfo = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { schoolLevel: true }
    });

    const subjectsMap = new Map();

    // Grouper par matière
    grades.forEach(g => {
      if (!subjectsMap.has(g.subjectId)) {
        // ⭐ Coefficient vient du subject (plus de forçage PRIMAIRE=1 hardcodé)
        const coefficient = Number(g.subject.coefficient || 1);
        subjectsMap.set(g.subjectId, {
          subject: g.subject,
          grades: [],
          scores: [],
          qualitativeCodes: [],
          assessmentScores: {} as Record<string, number>,
          coefficient,
        });
      }
      const entry = subjectsMap.get(g.subjectId);
      entry.grades.push(g);
      if (g.score !== null) {
        entry.scores.push(Number(g.score));
        // ⭐ Mapping score → code du type d'évaluation pour la formule
        const typeCode = g.evaluation?.evaluationType?.name?.toUpperCase().replace(/\s+/g, '_') || 'NOTE';
        entry.assessmentScores[typeCode] = Number(g.score);
      }
      if (g.qualitativeCode) entry.qualitativeCodes.push(g.qualitativeCode);
    });

    let totalWeighted = 0;
    let totalCoefficient = 0;
    const subjectDetails = [];

    for (const [subjectId, data] of subjectsMap.entries()) {
      let average = 0;
      let appreciation = '';

      if (classInfo?.schoolLevel?.code === 'MATERNELLE') {
        // Synthèse qualitative : Code majoritaire (échelle TS/S/PS/NS)
        const counts = data.qualitativeCodes.reduce((acc: any, code: string) => {
          acc[code] = (acc[code] || 0) + 1;
          return acc;
        }, {});
        appreciation = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'N/A';
        // Pas de moyenne numérique pour la maternelle
      } else {
        // ⭐ Utiliser AcademicRulesEngine si une formule est configurée
        if (subjectRule && Object.keys(data.assessmentScores).length > 0) {
          average = this.rulesEngine.evaluateSubjectAverage(data.assessmentScores, subjectRule);
        } else {
          // Fallback : moyenne arithmétique simple
          average = data.scores.length > 0
            ? data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length
            : 0;
        }

        // ⭐ Appreciation via AcademicRulesEngine.getAppreciation()
        appreciation = this.rulesEngine.getAppreciation(average, appreciationScale);
      }

      const weightedAverage = average * data.coefficient;
      totalWeighted += weightedAverage;
      totalCoefficient += data.coefficient;

      subjectDetails.push({
        subjectId,
        subjectName: data.subject.name,
        average,
        appreciation,
        coefficient: data.coefficient,
        weightedAverage
      });

      // Sauvegarder la moyenne par matière
      await this.prisma.studentSubjectAverage.upsert({
        where: {
          tenantId_academicYearId_periodId_studentId_subjectId: {
            tenantId, academicYearId, periodId, studentId, subjectId
          }
        },
        update: {
          average,
          coefficient: data.coefficient,
          weightedAverage,
          appreciation,
          calculatedAt: new Date(),
        },
        create: {
          tenantId, academicYearId, periodId, studentId, subjectId, classId,
          average,
          coefficient: data.coefficient,
          weightedAverage,
          appreciation,
        }
      });
    }

    // ⭐ Moyenne générale via AcademicRulesEngine.evaluateGeneralAverage()
    const generalAverage = this.rulesEngine.evaluateGeneralAverage(
      subjectDetails.map(s => ({ average: s.average, coefficient: s.coefficient })),
    );

    return {
      studentId,
      totalWeighted,
      totalCoefficient,
      generalAverage,
      subjectDetails
    };
  }

  /**
   * Récupère les bulletins d'une classe
   */
  async getClassBulletins(tenantId: string, academicYearId: string, periodId: string, classId: string) {
    return this.prisma.studentPeriodAverage.findMany({
      where: { tenantId, academicYearId, periodId, classId },
      include: {
        student: true,
      },
      orderBy: { classRank: 'asc' },
    });
  }

  /**
   * Publie les bulletins d'une classe (rend visible aux parents)
   */
  async publishClassBulletins(tenantId: string, academicYearId: string, periodId: string, classId: string, publishedBy: string) {
    return this.prisma.studentPeriodAverage.updateMany({
      where: { tenantId, academicYearId, periodId, classId },
      data: {
        isPublished: true,
      },
    });
  }

  /**
   * Récupère toutes les données nécessaires pour générer le bulletin PDF
   */
  async getBulletinFullData(tenantId: string, academicYearId: string, periodId: string, studentId: string) {
    // 1. Infos École & Année
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const academicYear = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });

    // 2. Infos Élève & Classe
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        studentEnrollments: {
          where: { academicYearId, tenantId },
          include: { class: { include: { schoolLevel: true } } }
        }
      }
    });

    if (!student) throw new NotFoundException('Élève non trouvé');
    const enrollment = student.studentEnrollments[0];
    const classId = enrollment.classId;

    // 3. Moyenne Générale & Rang
    const periodAverage = await this.prisma.studentPeriodAverage.findUnique({
      where: {
        tenantId_academicYearId_periodId_studentId: {
          tenantId, academicYearId, periodId, studentId
        }
      }
    });

    // 4. Moyennes par Matière
    const subjectAverages = await this.prisma.studentSubjectAverage.findMany({
      where: { tenantId, academicYearId, periodId, studentId },
      include: { subject: true }
    });

    // 5. Effectif de la classe
    const classSize = await this.prisma.classStudent.count({
      where: { classId, academicYearId, tenantId }
    });

    // 6. ⭐ Récupérer l'échelle d'appréciation configurée
    const academicConfig = await this.getActiveAcademicConfig(tenantId, academicYearId);
    const appreciationScale: AppreciationScale[] = academicConfig?.mentions || this.getDefaultMentions();

    // 7. Formater pour le template PDF
    return {
      bulletinId: `BUL-${studentId.substring(0,8)}-${periodId}`,
      schoolName: tenant?.name || 'Academia Helm Institutional',
      schoolAddress: tenant?.address || 'Bénin, Afrique de l\'Ouest',
      schoolLogo: tenant?.logo || 'https://via.placeholder.com/150',
      academicYear: academicYear?.name || '2025-2026',
      periodName: periodId === 'T1' ? '1er Trimestre' : periodId === 'T2' ? '2ème Trimestre' : '3ème Trimestre',
      studentName: `${student.lastName} ${student.firstName}`,
      studentBirthDate: student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('fr-FR') : 'N/A',
      studentSex: student.gender === 'MALE' ? 'Masculin' : 'Féminin',
      studentId: student.studentCode || student.id.substring(0, 8),
      className: enrollment.class.name,
      classSize,
      isRepeater: enrollment.enrollmentType === 'REPEAT' ? 'Oui' : 'Non',
      totalCoefficient: periodAverage?.totalCoefficient || 0,
      totalWeighted: periodAverage?.totalWeighted || 0,
      generalAverage: periodAverage?.generalAverage || '0.00',
      classRank: periodAverage?.classRank || '-',
      subjects: subjectAverages.map(sa => ({
        name: sa.subject.name,
        teacher: 'Professeur Titulaire', // À lier avec ClassSubjectTeacher si dispo
        coefficient: sa.coefficient,
        average: sa.average,
        weightedAverage: sa.weightedAverage,
        rank: '-', // À calculer si besoin spécifique
        // ⭐ Utilise l'appréciation stockée OU fallback via AcademicRulesEngine
        appreciation: sa.appreciation ||
          this.rulesEngine.getAppreciation(Number(sa.average), appreciationScale),
      }))
    };
  }
}
