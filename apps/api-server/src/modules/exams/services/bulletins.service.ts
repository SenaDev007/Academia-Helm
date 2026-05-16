/**
 * ============================================================================
 * BULLETINS SERVICE - MODULE 3
 * ============================================================================
 * 
 * Moteur de calcul des moyennes, classements et génération de bulletins.
 * Supporte les pondérations par matière et les décisions de conseil.
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class BulletinsService {
  private readonly logger = new Logger(BulletinsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère les moyennes pour toute une classe pour une période donnée
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
      include: { subject: true },
    });

    const results = [];

    // 3. Calculer pour chaque élève
    for (const cs of classStudents) {
      const studentGrades = grades.filter(g => g.studentId === cs.studentId);
      const studentResult = await this.calculateStudentPeriodPerformance(tenantId, academicYearId, periodId, cs.studentId, classId, studentGrades);
      results.push(studentResult);
    }

    // 4. Calculer les rangs (Tri par moyenne générale décroissante)
    const sortedResults = [...results].sort((a, b) => Number(b.generalAverage) - Number(a.generalAverage));
    
    const finalResults = sortedResults.map((res, index) => ({
      ...res,
      classRank: index + 1,
    }));

    // 5. Sauvegarder les résultats (StudentPeriodAverage)
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
   * Calcule la performance d'un élève sur une période
   */
  private async calculateStudentPeriodPerformance(tenantId: string, academicYearId: string, periodId: string, studentId: string, classId: string, grades: any[]) {
    // Récupérer le niveau scolaire de la classe pour appliquer la bonne logique
    const classInfo = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { level: true }
    });

    const subjectsMap = new Map();

    // Grouper par matière
    grades.forEach(g => {
      if (!subjectsMap.has(g.subjectId)) {
        subjectsMap.set(g.subjectId, {
          subject: g.subject,
          scores: [],
          qualitativeCodes: [],
          coefficient: classInfo?.level?.stage === 'PRIMAIRE' ? 1 : Number(g.subject.coefficient || 1),
        });
      }
      if (g.score !== null) subjectsMap.get(g.subjectId).scores.push(Number(g.score));
      if (g.qualitativeCode) subjectsMap.get(g.subjectId).qualitativeCodes.push(g.qualitativeCode);
    });

    let totalWeighted = 0;
    let totalCoefficient = 0;
    const subjectDetails = [];

    for (const [subjectId, data] of subjectsMap.entries()) {
      let average = 0;
      let appreciation = '';

      if (classInfo?.level?.stage === 'MATERNELLE') {
        // Synthèse qualitative : Code majoritaire
        const counts = data.qualitativeCodes.reduce((acc: any, code: string) => {
          acc[code] = (acc[code] || 0) + 1;
          return acc;
        }, {});
        appreciation = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 'N/A';
      } else {
        average = data.scores.length > 0 
          ? data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length 
          : 0;
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

    const generalAverage = totalCoefficient > 0 ? totalWeighted / totalCoefficient : 0;

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
        enrollments: { 
          where: { academicYearId, tenantId },
          include: { class: { include: { level: true } } }
        }
      }
    });

    if (!student) throw new NotFoundException('Élève non trouvé');
    const enrollment = student.enrollments[0];
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

    // 6. Formater pour le template PDF
    return {
      bulletinId: `BUL-${studentId.substring(0,8)}-${periodId}`,
      schoolName: tenant?.name || 'Academia Helm Institutional',
      schoolAddress: tenant?.address || 'Bénin, Afrique de l\'Ouest',
      schoolLogo: tenant?.logo || 'https://via.placeholder.com/150',
      academicYear: academicYear?.name || '2025-2026',
      periodName: periodId === 'T1' ? '1er Trimestre' : periodId === 'T2' ? '2ème Trimestre' : '3ème Trimestre',
      studentName: `${student.lastName} ${student.firstName}`,
      studentBirthDate: student.birthDate ? new Date(student.birthDate).toLocaleDateString('fr-FR') : 'N/A',
      studentSex: student.gender === 'MALE' ? 'Masculin' : 'Féminin',
      studentId: student.code || student.id.substring(0, 8),
      className: enrollment.class.name,
      classSize,
      isRepeater: enrollment.isRepeater ? 'Oui' : 'Non',
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
        appreciation: sa.appreciation || this.getGradeAppreciation(Number(sa.average)),
      }))
    };
  }

  private getGradeAppreciation(average: number): string {
    if (average >= 16) return 'Très Bien';
    if (average >= 14) return 'Bien';
    if (average >= 12) return 'Assez Bien';
    if (average >= 10) return 'Passable';
    return 'Insuffisant';
  }
}
