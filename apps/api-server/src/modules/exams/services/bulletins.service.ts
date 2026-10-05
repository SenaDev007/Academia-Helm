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

import { Injectable, NotFoundException, BadRequestException, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AcademicRulesEngine, SubjectAverageRule, AppreciationScale, PromotionRule } from '../../../exams-grades/academic-rules-engine.service';
import { AcademicSettingsService } from '../../../exams-grades/academic-settings.service';
import { HelmConnectNotificationBridgeService } from '../../../communication/services/helm-connect-bridge.service';

@Injectable()
export class BulletinsService {
  private readonly logger = new Logger(BulletinsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEngine: AcademicRulesEngine,
    private readonly academicSettingsService: AcademicSettingsService,
    @Optional() @Inject(HelmConnectNotificationBridgeService)
    private readonly bridge?: HelmConnectNotificationBridgeService,
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
   * ⭐ V3-4: Émet aussi une notification Helm Connect multi-canal aux parents.
   */
  async publishClassBulletins(tenantId: string, academicYearId: string, periodId: string, classId: string, publishedBy: string) {
    const result = await this.prisma.studentPeriodAverage.updateMany({
      where: { tenantId, academicYearId, periodId, classId },
      data: {
        isPublished: true,
      },
    });

    // ⭐ V3-4: Helm Connect notification (fire-and-forget) — prévient tous les parents
    if (this.bridge) {
      this.bridge
        .notifyBulletinPublished({
          tenantId,
          classId,
          periodId,
          academicYearId,
          publishedByUserId: publishedBy,
        })
        .then((r) =>
          this.logger.log(
            `notifyBulletinPublished: inApp=${r.channels.inApp?.status} whatsapp=${r.channels.whatsapp?.status} helm=${r.channels.helmConnectMessage?.status}`,
          ),
        )
        .catch((err) =>
          this.logger.warn(`notifyBulletinPublished non-bloquant échoué: ${err.message}`),
        );
    }

    return result;
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

  // ============================================================================
  // ⭐ WORKFLOW DE SIGNATURE + DISTRIBUTION DES BULLETINS
  // ============================================================================
  // États : DRAFT → DIRECTOR_SIGNED → TEACHER_DISTRIBUTED → TEACHER_SIGNED → PARENT_SENT
  // ============================================================================

  /**
   * Étape 1 : Le directeur/promoteur signe TOUS les bulletins d'une classe
   * La signature (base64) est appliquée à tous les ReportCards de la classe.
   */
  async directorSignAllBulletins(
    tenantId: string,
    academicYearId: string,
    periodId: string,
    classId: string,
    directorSignature: string,
    directorUserId: string,
    evalTypeInfo?: {
      evaluationTypeId?: string;
      evaluationTypeName?: string;
      evaluationTypeCode?: string;
    },
  ) {
    // Récupérer tous les élèves de la classe
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, academicYearId, classId, status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED'] } },
      select: { studentId: true, schoolLevelId: true },
    });

    if (enrollments.length === 0) {
      throw new NotFoundException('Aucun élève actif dans cette classe');
    }

    const now = new Date();
    const results = { signed: 0, created: 0, errors: [] as string[] };

    for (const enrollment of enrollments) {
      try {
        // Upsert ReportCard — la clé d'unicité est désormais
        // (tenantId, academicYearId, studentId, quarterId, evaluationTypeId)
        // pour permettre plusieurs bulletins par période (un par type d'éval).
        const where: any = {
          tenantId,
          academicYearId,
          studentId: enrollment.studentId,
          quarterId: periodId,
        };
        if (evalTypeInfo?.evaluationTypeId) {
          where.evaluationTypeId = evalTypeInfo.evaluationTypeId;
        } else {
          // Pour rétro-compat : si pas d'eval type fourni, on match aussi les
          // anciens bulletins sans eval type (NULL).
          where.OR = [
            { evaluationTypeId: null },
            { evaluationTypeId: '' },
          ];
        }

        const existing = await this.prisma.reportCard.findFirst({ where });

        if (existing) {
          await this.prisma.reportCard.update({
            where: { id: existing.id },
            data: {
              directorSignature,
              directorSignedAt: now,
              directorSignedBy: directorUserId,
              status: 'DIRECTOR_SIGNED',
              // ⭐ Mettre à jour les infos du type d'éval si elles sont fournies
              ...(evalTypeInfo?.evaluationTypeId ? {
                evaluationTypeId: evalTypeInfo.evaluationTypeId,
                evaluationTypeName: evalTypeInfo.evaluationTypeName,
                evaluationTypeCode: evalTypeInfo.evaluationTypeCode,
              } : {}),
            },
          });
          results.signed++;
        } else {
          await this.prisma.reportCard.create({
            data: {
              tenantId,
              academicYearId,
              schoolLevelId: enrollment.schoolLevelId,
              studentId: enrollment.studentId,
              quarterId: periodId,
              type: 'BULLETIN',
              overallAverage: 0,
              status: 'DIRECTOR_SIGNED',
              directorSignature,
              directorSignedAt: now,
              directorSignedBy: directorUserId,
              // ⭐ Stocker le type d'évaluation (nullable pour rétro-compat)
              evaluationTypeId: evalTypeInfo?.evaluationTypeId || null,
              evaluationTypeName: evalTypeInfo?.evaluationTypeName || null,
              evaluationTypeCode: evalTypeInfo?.evaluationTypeCode || null,
            },
          });
          results.created++;
        }
      } catch (err: any) {
        results.errors.push(`${enrollment.studentId}: ${err.message}`);
      }
    }

    return {
      success: true,
      message: `${results.signed + results.created} bulletin(s) signés par le directeur`,
      ...results,
    };
  }

  /**
   * Étape 2 : Le directeur/promoteur active (distribue) les bulletins aux enseignants
   * Chaque enseignant titulaire de classe reçoit les bulletins dans son UI.
   */
  async activateBulletinsForTeachers(
    tenantId: string,
    academicYearId: string,
    periodId: string,
    classId: string,
    activatedBy: string,
  ) {
    const now = new Date();
    // ⭐ Filter by classId — only distribute bulletins for students in THIS class
    const result = await this.prisma.reportCard.updateMany({
      where: {
        tenantId,
        academicYearId,
        quarterId: periodId,
        status: 'DIRECTOR_SIGNED',
        student: {
          studentEnrollments: {
            some: { classId, academicYearId, tenantId },
          },
        },
      },
      data: {
        status: 'TEACHER_DISTRIBUTED',
        distributedToTeacherAt: now,
        distributedToTeacherBy: activatedBy,
      },
    });

    return {
      success: true,
      message: `${result.count} bulletin(s) distribué(s) aux enseignants`,
      distributedCount: result.count,
    };
  }

  /**
   * Étape 3 : L'enseignant signe TOUS les bulletins d'une classe
   * La signature (base64) est appliquée à tous les ReportCards TEACHER_DISTRIBUTED
   * de la classe spécifiée (filtre par student.studentEnrollments.classId).
   *
   * ⭐ La signature est sauvegardée sur chaque ReportCard individuellement
   *    afin d'être visible sur le bulletin PDF et dans l'UI du directeur
   *    après le renvoi (étape 4).
   */
  async teacherSignAllBulletins(
    tenantId: string,
    academicYearId: string,
    periodId: string,
    classId: string,
    teacherSignature: string,
    teacherUserId: string,
    evaluationTypeId?: string,
  ) {
    const now = new Date();
    // ⭐ Construction du WHERE : par classe (via enrollment) + optionnellement
    //    par evaluationTypeId (si fourni — permet de signer un type d'éval précis)
    const where: any = {
      tenantId,
      academicYearId,
      quarterId: periodId,
      status: 'TEACHER_DISTRIBUTED',
      student: {
        studentEnrollments: {
          some: { classId, academicYearId, tenantId },
        },
      },
    };
    if (evaluationTypeId) {
      where.evaluationTypeId = evaluationTypeId;
    }
    const result = await this.prisma.reportCard.updateMany({
      where,
      data: {
        teacherSignature,
        teacherSignedAt: now,
        teacherSignedBy: teacherUserId,
        status: 'TEACHER_SIGNED',
      },
    });

    return {
      success: true,
      message: `${result.count} bulletin(s) signés par l'enseignant`,
      signedCount: result.count,
    };
  }

  /**
   * Étape 4 : L'enseignant renvoie les bulletins au directeur
   * Les bulletins TEACHER_SIGNED sont à nouveau visibles dans l'UI du directeur.
   * L'enseignant ne voit plus les bulletins (statut = TEACHER_RETURNED).
   *
   * ⭐ Vérifie que chaque bulletin a bien une teacherSignature avant de le renvoyer
   *    (sécurité : si la signature est manquante pour une raison quelconque,
   *    on la ré-applique avec la dernière signature connue de la classe).
   *
   * ⭐ Si evaluationTypeId est fourni, ne renvoie QUE les bulletins de ce type d'éval.
   */
  async teacherReturnBulletins(
    tenantId: string,
    academicYearId: string,
    periodId: string,
    classId: string,
    teacherUserId: string,
    evaluationTypeId?: string,
  ) {
    const now = new Date();

    // Construction du WHERE de base : par classe + optionnellement par eval type
    const baseWhere: any = {
      tenantId,
      academicYearId,
      quarterId: periodId,
      status: 'TEACHER_SIGNED',
      student: {
        studentEnrollments: {
          some: { classId, academicYearId, tenantId },
        },
      },
    };
    if (evaluationTypeId) {
      baseWhere.evaluationTypeId = evaluationTypeId;
    }

    // ⭐ Étape 4a : vérifier qu'aucun bulletin n'est sans signature.
    const signedBulletins = await this.prisma.reportCard.findFirst({
      where: { ...baseWhere, teacherSignature: { not: null } },
      select: { teacherSignature: true },
    });

    const missingSignaturesCount = await this.prisma.reportCard.count({
      where: {
        ...baseWhere,
        OR: [
          { teacherSignature: null },
          { teacherSignature: '' },
        ],
      },
    }).catch(() => 0);

    if (missingSignaturesCount > 0 && signedBulletins?.teacherSignature) {
      // Ré-appliquer la signature sur les bulletins sans signature
      await this.prisma.reportCard.updateMany({
        where: {
          ...baseWhere,
          OR: [
            { teacherSignature: null },
            { teacherSignature: '' },
          ],
        },
        data: {
          teacherSignature: signedBulletins.teacherSignature,
          teacherSignedAt: now,
          teacherSignedBy: teacherUserId,
        },
      });
    }

    // ⭐ Étape 4b : changer le statut à TEACHER_RETURNED
    const result = await this.prisma.reportCard.updateMany({
      where: baseWhere,
      data: {
        status: 'TEACHER_RETURNED',
        updatedAt: now,
      },
    });

    return {
      success: true,
      message: `${result.count} bulletin(s) renvoyé(s) au directeur`,
      returnedCount: result.count,
      signaturesReapplied: missingSignaturesCount,
    };
  }

  /**
   * Étape 5 : Le directeur envoie les bulletins aux parents
   * Seuls les élèves dont la scolarité est en règle reçoivent leur bulletin.
   * Les autres sont bloqués avec blockedReason = "ARREARS_UNPAID".
   */
  async sendBulletinsToParents(
    tenantId: string,
    academicYearId: string,
    periodId: string,
    classId: string,
    sentBy: string,
    criteria?: { blockIfArrears?: boolean; minPaymentPercentage?: number },
  ) {
    const blockIfArrears = criteria?.blockIfArrears !== false; // default true
    const minPct = criteria?.minPaymentPercentage ?? 100;

    // Récupérer tous les bulletins TEACHER_RETURNED ou TEACHER_SIGNED
    const bulletins = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        academicYearId,
        quarterId: periodId,
        status: { in: ['TEACHER_RETURNED', 'TEACHER_SIGNED'] },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true },
        },
      },
    });

    const now = new Date();
    const results = { sent: 0, blocked: 0, blockedStudents: [] as any[] };

    for (const bulletin of bulletins) {
      let isBlocked = false;
      let blockedReason: string | null = null;

      if (blockIfArrears) {
        // Vérifier les arriérés de scolarité
        const account = await this.prisma.studentAccount.findUnique({
          where: { studentId_academicYearId: { studentId: bulletin.studentId, academicYearId } },
        }).catch(() => null);

        if (account) {
          const arrears = Number(account.arrearsAmount || 0);
          const totalDue = Number(account.totalDue || 0);
          const totalPaid = Number(account.totalPaid || 0);
          const paymentPct = totalDue > 0 ? (totalPaid / totalDue) * 100 : 100;

          if (arrears > 0 || account.isBlocked || paymentPct < minPct) {
            isBlocked = true;
            blockedReason = arrears > 0
              ? `ARREARS_UNPAID:${arrears}`
              : account.isBlocked
                ? 'ACCOUNT_BLOCKED'
                : `INSUFFICIENT_PAYMENT:${paymentPct.toFixed(1)}%`;
          }
        }
      }

      await this.prisma.reportCard.update({
        where: { id: bulletin.id },
        data: isBlocked
          ? { blockedReason, status: 'BLOCKED' }
          : {
              status: 'PARENT_SENT',
              sentToParentAt: now,
              sentToParentBy: sentBy,
              blockedReason: null,
            },
      });

      if (isBlocked) {
        results.blocked++;
        results.blockedStudents.push({
          studentId: bulletin.studentId,
          studentName: `${bulletin.student.lastName} ${bulletin.student.firstName}`,
          reason: blockedReason,
        });
      } else {
        results.sent++;
      }
    }

    return {
      success: true,
      message: `${results.sent} bulletin(s) envoyé(s) aux parents, ${results.blocked} bloqué(s)`,
      ...results,
    };
  }

  /**
   * Récupère le statut du workflow pour une classe + période
   */
  async getWorkflowStatus(tenantId: string, academicYearId: string, periodId: string, classId: string) {
    // ⭐ Filter by classId — only return bulletins for students in THIS class
    // (not all students in the tenant, to avoid cross-level signature leakage)
    // ⭐ 2026-10-05 — ANGLOPHONE TRACK : les élèves peuvent être liés à la
    //    classe via class_students (ClassStudent) SANS StudentEnrollment.classId.
    //    Le filtre original (studentEnrollments.some + classId) manquait donc
    //    tous les élèves anglophones → summary.total sous-estimé (1 au lieu
    //    de N). On élargit le filtre pour inclure l'une OU l'autre relation.
    const bulletins = await this.prisma.reportCard.findMany({
      where: {
        tenantId,
        academicYearId,
        quarterId: periodId,
        // Filter by students enrolled in this specific class via EITHER
        // StudentEnrollment.classId (FR track) OR ClassStudent (EN track)
        student: {
          OR: [
            {
              studentEnrollments: {
                some: { classId, academicYearId, tenantId },
              },
            },
            {
              classStudents: {
                some: {
                  classId,
                  academicYearId,
                  tenantId,
                  status: 'ACTIVE',
                },
              },
            },
          ],
        },
      },
      select: {
        id: true,
        status: true,
        directorSignature: true,
        directorSignedAt: true,
        teacherSignature: true,
        teacherSignedAt: true,
        distributedToTeacherAt: true,
        sentToParentAt: true,
        blockedReason: true,
        student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      },
    });

    // ⭐ 2026-10-05 — EXPECTED TOTAL : compte le nombre d'élèves attendus dans
    //    la classe pour la période (élèves actifs via StudentEnrollment OU
    //    ClassStudent). Cela permet au frontend d'afficher un total correct
    //    même quand tous les bulletins n'ont pas encore été créés (ex: 30
    //    élèves dans la classe mais seulement 1 bulletin signé → on affiche
    //    "1 / 30" au lieu de "1 / 1").
    const [enrolledCount, classStudentCount] = await Promise.all([
      this.prisma.studentEnrollment.count({
        where: {
          tenantId, academicYearId, classId,
          status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED'] },
        },
      }),
      this.prisma.classStudent.count({
        where: {
          tenantId, academicYearId, classId,
          status: 'ACTIVE',
        },
      }),
    ]);
    // On prend le max des deux : si l'élève est dans les deux tables, il
    // n'est compté qu'une fois via le max (les deux tables ne sont pas
    // mutuellement exclusives en pratique).
    const expectedTotal = Math.max(enrolledCount, classStudentCount);

    const summary = {
      total: bulletins.length,
      expectedTotal,
      DRAFT: 0,
      DIRECTOR_SIGNED: 0,
      TEACHER_DISTRIBUTED: 0,
      TEACHER_SIGNED: 0,
      TEACHER_RETURNED: 0,
      PARENT_SENT: 0,
      BLOCKED: 0,
    };

    // ⭐ 2026-10-05 — expectedTotal et total sont des valeurs agrégées, pas des
    //    compteurs de statut. On itère donc sur une liste explicite de statuts
    //    valides (DRAFT, DIRECTOR_SIGNED, etc.) pour éviter d'incrémenter
    //    accidentellement les propriétés `expectedTotal` ou `total` si un
    //    statut inconnu apparaissait en base.
    const VALID_STATUSES = ['DRAFT', 'DIRECTOR_SIGNED', 'TEACHER_DISTRIBUTED', 'TEACHER_SIGNED', 'TEACHER_RETURNED', 'PARENT_SENT', 'BLOCKED'] as const;
    for (const b of bulletins) {
      if ((VALID_STATUSES as readonly string[]).includes(b.status)) {
        (summary as any)[b.status]++;
      }
    }

    return { summary, bulletins };
  }

  // ============================================================================
  // ⭐ CRITÈRES D'ENVOI DES BULLETINS AUX PARENTS
  // ============================================================================

  /**
   * Récupère les critères d'envoi configurés pour un tenant.
   * Si aucune config n'existe, retourne les valeurs par défaut.
   */
  async getSendingCriteria(tenantId: string) {
    const criteria = await this.prisma.bulletinSendingCriteria.findUnique({
      where: { tenantId },
    });

    if (!criteria) {
      // Retourne les valeurs par défaut sans créer en base
      return {
        tenantId,
        blockIfArrears: true,
        minPaymentPercentage: 100,
        allowDownloadByParents: true,
        requireDirectorSignature: true,
        requireTeacherSignature: true,
        autoSendAfterTeacherSign: false,
        notifyParentOnSend: true,
        reminderDaysBeforeBlock: 7,
        customMessage: null,
        isDefault: true,
      };
    }

    return { ...criteria, isDefault: false };
  }

  /**
   * Met à jour (ou crée) les critères d'envoi pour un tenant.
   */
  async updateSendingCriteria(
    tenantId: string,
    data: {
      blockIfArrears?: boolean;
      minPaymentPercentage?: number;
      allowDownloadByParents?: boolean;
      requireDirectorSignature?: boolean;
      requireTeacherSignature?: boolean;
      autoSendAfterTeacherSign?: boolean;
      notifyParentOnSend?: boolean;
      reminderDaysBeforeBlock?: number;
      customMessage?: string | null;
    },
    userId: string,
  ) {
    // Validation
    if (data.minPaymentPercentage !== undefined) {
      const v = Number(data.minPaymentPercentage);
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        throw new Error('minPaymentPercentage doit être un entier entre 0 et 100');
      }
    }
    if (data.reminderDaysBeforeBlock !== undefined) {
      const v = Number(data.reminderDaysBeforeBlock);
      if (!Number.isInteger(v) || v < 0 || v > 90) {
        throw new Error('reminderDaysBeforeBlock doit être un entier entre 0 et 90');
      }
    }

    const existing = await this.prisma.bulletinSendingCriteria.findUnique({
      where: { tenantId },
    });

    let result;
    if (existing) {
      result = await this.prisma.bulletinSendingCriteria.update({
        where: { tenantId },
        data,
      });
    } else {
      result = await this.prisma.bulletinSendingCriteria.create({
        data: {
          tenantId,
          ...data,
        },
      });
    }

    // Logger l'audit
    await this.prisma.authAuditLog.create({
      data: {
        tenantId,
        userId,
        action: 'BULLETIN_CRITERIA_UPDATED',
        status: 'SUCCESS',
        reason: `Critères d'envoi des bulletins mis à jour`,
        metadata: data as any,
      },
    }).catch(() => {}); // Non-blocking

    return { success: true, criteria: result };
  }

  // ============================================================================
  // ⭐ ANNOTATIONS PAR ÉLÈVE (page 2 du carnet)
  // ============================================================================

  /**
   * Sauvegarde les annotations d'un élève (assiduité, discipline, défauts, qualités, analyse)
   * + ⭐ Annotations anglophones (enTeacherComment, enDirectorComment, enAffectiveAssessment JSON, enPsychomotorAssessment JSON)
   */
  async saveAnnotations(
    tenantId: string,
    academicYearId: string,
    periodId: string,
    studentId: string,
    data: {
      assiduite?: string;
      discipline?: string;
      defautsMajeurs?: string;
      qualitesRemarquables?: string;
      analyseRecommandations?: string;
      directorVisa?: string;
      // ⭐ Champs anglophones
      enTeacherComment?: string;
      enDirectorComment?: string;
      enAffectiveAssessment?: string;    // JSON string
      enPsychomotorAssessment?: string;  // JSON string
    },
    userId: string,
  ) {
    const existing = await this.prisma.reportCard.findFirst({
      where: { tenantId, academicYearId, studentId, quarterId: periodId },
    });

    const now = new Date();
    if (existing) {
      const updated = await this.prisma.reportCard.update({
        where: { id: existing.id },
        data: {
          ...data,
          directorVisaUpdatedAt: data.directorVisa !== undefined ? now : existing.directorVisaUpdatedAt,
          updatedAt: now,
        },
      });
      return { success: true, reportCardId: updated.id };
    }

    // Get schoolLevelId from enrollment — ⭐ V10e : fallbacks robustes.
    // Ancienne logique : enrollment?.schoolLevelId || '' → chaîne vide sur
    // FK SchoolLevel → P2003 → 500 silencieux (élèves rattachés via
    // class_students sans StudentEnrollment, courant en piste EN).
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { tenantId, academicYearId, studentId },
      select: { schoolLevelId: true },
    });
    let schoolLevelId = enrollment?.schoolLevelId || null;
    if (!schoolLevelId) {
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        select: { schoolLevelId: true },
      });
      schoolLevelId = student?.schoolLevelId || null;
    }
    if (!schoolLevelId) {
      const classStudent = await this.prisma.classStudent.findFirst({
        where: { tenantId, studentId, academicYearId },
        select: { schoolLevelId: true },
      });
      schoolLevelId = classStudent?.schoolLevelId || null;
    }
    if (!schoolLevelId) {
      // Dernier recours : la classe de l'élève (sans filtre année)
      const anyClass = await this.prisma.classStudent.findFirst({
        where: { tenantId, studentId },
        select: { schoolLevelId: true },
      });
      schoolLevelId = anyClass?.schoolLevelId || null;
    }
    if (!schoolLevelId) {
      throw new BadRequestException(
        'Impossible de déterminer le niveau scolaire de l\'élève pour créer le bulletin — vérifiez son inscription.',
      );
    }

    const created = await this.prisma.reportCard.create({
      data: {
        tenantId,
        academicYearId,
        schoolLevelId,
        studentId,
        quarterId: periodId,
        type: 'BULLETIN',
        overallAverage: 0,
        status: 'DRAFT',
        ...data,
      },
    });
    return { success: true, reportCardId: created.id, created: true };
  }

  /**
   * Récupère les annotations d'un élève
   */
  async getAnnotations(
    tenantId: string,
    academicYearId: string,
    periodId: string,
    studentId: string,
  ) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: { tenantId, academicYearId, studentId, quarterId: periodId },
      select: {
        id: true,
        assiduite: true,
        discipline: true,
        defautsMajeurs: true,
        qualitesRemarquables: true,
        analyseRecommandations: true,
        directorVisa: true,
        status: true,
        // ⭐ Champs anglophones
        enTeacherComment: true,
        enDirectorComment: true,
        enAffectiveAssessment: true,
        enPsychomotorAssessment: true,
      },
    });

    return reportCard || {
      id: null,
      assiduite: null,
      discipline: null,
      defautsMajeurs: null,
      qualitesRemarquables: null,
      analyseRecommandations: null,
      directorVisa: null,
      status: null,
      enTeacherComment: null,
      enDirectorComment: null,
      enAffectiveAssessment: null,
      enPsychomotorAssessment: null,
    };
  }

  /**
   * ⭐ IA Auto-fill: Génère automatiquement les annotations basées sur
   * l'assiduité (absences/retards) et les performances (notes) de l'élève.
   * L'enseignant peut ensuite modifier ces suggestions.
   */
  async autoGenerateAnnotations(
    tenantId: string,
    academicYearId: string,
    periodId: string,
    studentId: string,
  ) {
    // 1. Récupérer les absences de l'élève pour cette période
    const absences = await this.prisma.absence.findMany({
      where: { tenantId, studentId, academicYearId },
      select: { type: true, justified: true, date: true },
    }).catch(() => []);

    // 2. Récupérer les enregistrements d'assiduité
    const attendanceRecords = await this.prisma.attendanceRecord.findMany({
      where: { tenantId, studentId },
      select: { status: true, date: true },
    }).catch(() => []);

    // 3. Récupérer les notes de l'élève (inclut qualitativeCode pour la maternelle)
    const grades = await this.prisma.grade.findMany({
      where: { tenantId, studentId },
      select: { score: true, isAbsent: true, qualitativeCode: true },
    }).catch(() => []);

    // 4. Récupérer les records disciplinaires
    const disciplines = await this.prisma.discipline.findMany({
      where: { tenantId, studentId },
      select: { type: true, severity: true, date: true },
    }).catch(() => []);

    // Calculer les statistiques
    const totalAbsences = absences.filter(a => !a.justified).length;
    const totalRetards = absences.filter(a => a.type === 'LATE' || a.type === 'RETARD').length;
    const totalAbsencesJustified = absences.filter(a => a.justified).length;
    const absentRecords = attendanceRecords.filter(r => r.status === 'ABSENT').length;
    const lateRecords = attendanceRecords.filter(r => r.status === 'LATE').length;

    // ⭐ Détection du mode maternelle : grades avec qualitativeCode (TS/S/PS)
    const qualitativeMap: Record<string, number> = { TS: 16, S: 12, PS: 8 };
    const isQualitativeMode = grades.some(g => g.qualitativeCode);

    // Pour la maternelle : on convertit TS/S/PS en équivalent numérique pour l'analyse
    const validGrades = grades
      .filter(g => !g.isAbsent)
      .map(g => {
        if (g.qualitativeCode && qualitativeMap[g.qualitativeCode] !== undefined) {
          return qualitativeMap[g.qualitativeCode];
        }
        if (g.score !== null && g.score !== undefined) {
          return Number(g.score);
        }
        return null;
      })
      .filter((v): v is number => v !== null);

    const avgScore = validGrades.length > 0
      ? validGrades.reduce((sum, v) => sum + v, 0) / validGrades.length
      : null;

    // ⭐ Pour la maternelle : compter les codes TS/S/PS pour une analyse qualitative
    const tsCount = grades.filter(g => g.qualitativeCode === 'TS').length;
    const sCount = grades.filter(g => g.qualitativeCode === 'S').length;
    const psCount = grades.filter(g => g.qualitativeCode === 'PS').length;
    const totalQualitative = tsCount + sCount + psCount;

    const disciplineIssues = disciplines.filter(d => d.severity === 'HIGH' || d.severity === 'CRITICAL').length;

    // 5. Générer les annotations automatiques
    let assiduite = '';
    let discipline = '';
    let defautsMajeurs = '';
    let qualitesRemarquables = '';
    let analyseRecommandations = '';

    // Assiduité — commune à maternelle et primaire
    if (totalAbsences === 0 && lateRecords === 0) {
      assiduite = 'Excellente assiduité. Aucune absence ni retard enregistré.';
    } else if (totalAbsences <= 2 && lateRecords <= 3) {
      assiduite = `Bonne assiduité. ${totalAbsences} absence(s) non justifiée(s), ${lateRecords} retard(s).`;
    } else if (totalAbsences <= 5) {
      assiduite = `Assiduité moyenne. ${totalAbsences} absence(s) non justifiée(s), ${lateRecords} retard(s). Peut mieux faire.`;
    } else {
      assiduite = `Assiduité insuffisante. ${totalAbsences} absence(s) non justifiée(s), ${lateRecords} retard(s). Une amélioration est nécessaire.`;
    }

    // Discipline — commune à maternelle et primaire
    if (disciplineIssues === 0) {
      discipline = 'Bonne discipline. Aucun incident majeur enregistré.';
    } else if (disciplineIssues <= 2) {
      discipline = `${disciplineIssues} incident(s) disciplinaire(s) enregistré(s). Comportement acceptable mais perfectible.`;
    } else {
      discipline = `${disciplineIssues} incidents disciplinaires enregistrés. Une attention particulière est requise.`;
    }

    if (isQualitativeMode) {
      // ─── MODE MATERNELLE (TS/S/PS) ────────────────────────────────────────
      // Analyse basée sur la répartition des codes qualitatifs
      const tsPct = totalQualitative > 0 ? (tsCount / totalQualitative) * 100 : 0;
      const psPct = totalQualitative > 0 ? (psCount / totalQualitative) * 100 : 0;

      // Défauts majeurs (maternelle)
      if (psPct >= 50) {
        defautsMajeurs = `Difficultés d'apprentissage observées sur plusieurs activités (${psCount} activité(s) notée(s) PS). Un accompagnement ciblé est recommandé.`;
      } else if (totalAbsences > 5) {
        defautsMajeurs = 'Absentéisme fréquent qui peut impacter les apprentissages de l\'enfant.';
      } else if (disciplineIssues > 2) {
        defautsMajeurs = 'Comportement à surveiller signalé à plusieurs reprises.';
      } else {
        defautsMajeurs = '';
      }

      // Qualités remarquables (maternelle)
      if (tsPct >= 60) {
        qualitesRemarquables = `Excellent développement. ${tsCount} activité(s) évaluée(s) « Très Satisfaisant ». L'enfant montre de belles dispositions.`;
      } else if (tsPct >= 30 || sCount >= tsCount) {
        qualitesRemarquables = `Bonnes progressions. L'enfant est investi dans les activités proposées et montre une attitude positive.`;
      } else if (totalAbsences === 0 && lateRecords === 0) {
        qualitesRemarquables = 'Enfant régulier et ponctuel. Efforts constants observés en classe.';
      } else {
        qualitesRemarquables = '';
      }

      // Analyse et recommandations (maternelle)
      if (tsPct >= 60) {
        analyseRecommandations = `Excellents résultats. L'enfant maîtrise la majorité des compétences attendues (${tsCount} TS sur ${totalQualitative}). Encourager et maintenir ce niveau d'engagement.`;
      } else if (psPct >= 50) {
        analyseRecommandations = `Résultats à améliorer. ${psCount} activité(s) évaluée(s) « Peu Satisfaisant ». Un renforcement à la maison et à l'école est recommandé pour soutenir l'enfant.`;
      } else if (tsCount + sCount > 0 && psPct < 30) {
        analyseRecommandations = `Résultats satisfaisants. L'enfant progresse bien (${tsCount} TS, ${sCount} S). Poursuivre le suivi et l'encouragement à la maison.`;
      } else if (totalQualitative === 0) {
        analyseRecommandations = 'Évaluation en cours. Suivre l\'évolution de l\'enfant durant la prochaine période d\'observation.';
      } else {
        analyseRecommandations = `Résultats mixtes. L'enfant montre des compétences dans certaines activités mais nécessite un accompagnement sur d'autres. Encourager la régularité.`;
      }
    } else {
      // ─── MODE PRIMAIRE/SECONDAIRE (notes /20) ──────────────────────────────
      // Défauts majeurs
      if (avgScore !== null && avgScore < 8) {
        defautsMajeurs = 'Difficultés d\'apprentissage dans plusieurs matières. Manque de concentration observé.';
      } else if (totalAbsences > 5) {
        defautsMajeurs = 'Absentéisme fréquent qui impacte les résultats scolaires.';
      } else if (disciplineIssues > 2) {
        defautsMajeurs = 'Comportement perturbateur en classe signalé à plusieurs reprises.';
      } else {
        defautsMajeurs = '';
      }

      // Qualités remarquables
      if (avgScore !== null && avgScore >= 14) {
        qualitesRemarquables = 'Élève brillant, sérieux et travailleur. Excellentes performances scolaires.';
      } else if (avgScore !== null && avgScore >= 10) {
        qualitesRemarquables = 'Élève appliqué, progresse régulièrement. Bonne attitude face au travail.';
      } else if (totalAbsences === 0 && lateRecords === 0) {
        qualitesRemarquables = 'Élève régulier et ponctuel. Efforts constants malgré les difficultés.';
      } else {
        qualitesRemarquables = '';
      }

      // Analyse et recommandations
      if (avgScore !== null && avgScore >= 14) {
        analyseRecommandations = 'Excellents résultats. Encourager l\'élève à maintenir ce niveau et à viser l\'excellence.';
      } else if (avgScore !== null && avgScore >= 10) {
        analyseRecommandations = 'Résultats satisfaisants. L\'élève peut progresser avec un accompagnement ciblé dans les matières faibles.';
      } else if (avgScore !== null && avgScore < 10) {
        analyseRecommandations = 'Résultats insuffisants. Un soutien pédagogique renforcé est recommandé. Organiser des séances de rattrapage.';
      } else {
        analyseRecommandations = 'Évaluation en cours. Suivre l\'évolution de l\'élève durant la prochaine période.';
      }
    }

    // ⭐ Visa du directeur auto-généré — format: "Vu ce JJ/MM/AAAA"
    const today = new Date();
    const dateStr = String(today.getDate()).padStart(2, '0') + '/' +
      String(today.getMonth() + 1).padStart(2, '0') + '/' +
      today.getFullYear();
    let directorVisa = `Vu ce ${dateStr}`;

    return {
      assiduite,
      discipline,
      defautsMajeurs,
      qualitesRemarquables,
      analyseRecommandations,
      directorVisa,
      stats: {
        totalAbsences,
        totalRetards,
        totalAbsencesJustified,
        lateRecords,
        absentRecords,
        avgScore: avgScore !== null ? Number(avgScore.toFixed(2)) : null,
        disciplineIssues,
        totalGrades: validGrades.length,
        // ⭐ Stats qualitatives (maternelle)
        qualitativeMode: isQualitativeMode,
        tsCount,
        sCount,
        psCount,
        totalQualitative,
      },
    };
  }
}
