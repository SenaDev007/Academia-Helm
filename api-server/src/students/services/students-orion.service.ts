/**
 * ============================================================================
 * STUDENTS ORION SERVICE - MODULE 1
 * ============================================================================
 * 
 * Service ORION pour alertes matricule et cartes scolaires
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentIdentifierService } from './student-identifier.service';
import { StudentIdCardService } from './student-id-card.service';

@Injectable()
export class StudentsOrionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identifierService: StudentIdentifierService,
    private readonly idCardService: StudentIdCardService,
  ) {}

  /**
   * Récupère les KPIs pour ORION (matricule et cartes)
   */
  /**
   * FIX OOM: Use count() and groupBy() instead of loading all students into memory.
   * Previously loaded ALL active students + identifiers → OOM.
   */
  async getStudentIdentificationKPIs(tenantId: string, academicYearId?: string) {
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    // Statistiques des matricules
    const matriculeStats = await this.identifierService.getMatriculeStats(tenantId, academicYearId);

    // Statistiques des cartes
    const idCardStats = await this.idCardService.getIdCardStats(tenantId, academicYearId);

    // FIX OOM: Use counts instead of loading all students
    const [totalActiveStudents, studentsWithoutMatriculeCount, activeCards, studentsWithoutIdCardCount] = await Promise.all([
      this.prisma.student.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.student.count({ where: { ...where, status: 'ACTIVE', identifier: null } }),
      this.prisma.studentIdCard.findMany({
        where: {
          tenantId,
          ...(academicYearId && { academicYearId }),
          isActive: true,
          isRevoked: false,
        },
        select: { studentId: true },
      }),
      // Count students without ID cards using a subquery approach
      this.prisma.student.count({ where: { ...where, status: 'ACTIVE', idCards: { none: { isActive: true, isRevoked: false } } } }),
    ]);

    return {
      matricule: {
        ...matriculeStats,
        studentsWithoutMatricule: studentsWithoutMatriculeCount,
        coverageRate:
          totalActiveStudents > 0
            ? ((totalActiveStudents - studentsWithoutMatriculeCount) / totalActiveStudents) * 100
            : 0,
      },
      idCard: {
        ...idCardStats,
        studentsWithoutIdCard: studentsWithoutIdCardCount,
        coverageRate:
          totalActiveStudents > 0 ? ((totalActiveStudents - studentsWithoutIdCardCount) / totalActiveStudents) * 100 : 0,
      },
      alerts: await this.generateAlerts(tenantId, academicYearId),
    };
  }

  /**
   * Génère les alertes ORION pour matricule et cartes
   */
  async generateAlerts(tenantId: string, academicYearId?: string) {
    const alerts: Array<{
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      category: string;
      title: string;
      description: string;
      recommendation?: string;
      count?: number;
    }> = [];

    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    // Récupérer les cartes actives pour réutilisation
    const activeCards = await this.prisma.studentIdCard.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        isActive: true,
        isRevoked: false,
      },
      select: {
        studentId: true,
      },
    });

    const studentsWithActiveCards = new Set(activeCards.map((c) => c.studentId));

    // 1. Élèves actifs sans matricule (CRITICAL) — FIX OOM: use count
    const studentsWithoutMatriculeCount = await this.prisma.student.count({
      where: {
        ...where,
        status: 'ACTIVE',
        identifier: null,
      },
    });

    if (studentsWithoutMatriculeCount > 0) {
      alerts.push({
        severity: 'CRITICAL',
        category: 'MISSING_MATRICULE',
        title: 'Élèves actifs sans matricule',
        description: `${studentsWithoutMatriculeCount} élève(s) actif(s) sans matricule global unique`,
        recommendation:
          'Générer les matricules pour tous les élèves actifs. Le matricule est obligatoire pour les examens et la conformité institutionnelle.',
        count: studentsWithoutMatriculeCount,
      });
    }

    // 2. Matricules temporaires non synchronisés (HIGH) — FIX OOM: use count + limited sample
    const temporaryMatriculesCount = await this.prisma.studentIdentifier.count({
      where: {
        tenantId,
        isOfflineGenerated: true,
        synchronizedAt: null,
      },
    });

    if (temporaryMatriculesCount > 0) {
      alerts.push({
        severity: 'HIGH',
        category: 'UNSYNCHRONIZED_MATRICULE',
        title: 'Matricules temporaires non synchronisés',
        description: `${temporaryMatriculesCount} matricule(s) temporaire(s) en attente de synchronisation`,
        recommendation:
          'Synchroniser les matricules temporaires avec les matricules définitifs. Ces élèves ont été créés en mode offline.',
        count: temporaryMatriculesCount,
      });
    }

    // 3. Doublons bloqués (peut arriver en cas de collision, mais normalement bloqué par contrainte SQL)
    // Cette alerte serait loggée si une collision était détectée lors de la génération

    // 4. Cartes non générées pour élèves examinés (HIGH) — FIX OOM: use count
    const studentsWithExamsButNoCard = await this.prisma.student.count({
      where: {
        ...where,
        status: 'ACTIVE',
        examScores: {
          some: academicYearId ? { academicYearId } : {},
        },
        idCards: {
          none: { isActive: true, isRevoked: false },
        },
      },
    });

    if (studentsWithExamsButNoCard > 0) {
      alerts.push({
        severity: 'HIGH',
        category: 'MISSING_ID_CARD_FOR_EXAM',
        title: 'Cartes non générées pour élèves examinés',
        description: `${studentsWithExamsButNoCard} élève(s) ayant passé des examens sans carte scolaire active`,
        recommendation:
          'Générer les cartes scolaires pour les élèves concernés. La carte est obligatoire pour les examens officiels.',
        count: studentsWithExamsButNoCard,
      });
    }

    // 5. Cartes expirées (MEDIUM) — FIX OOM: use count
    const expiredCardsCount = await this.prisma.studentIdCard.count({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        isActive: true,
        isRevoked: false,
        validUntil: { lt: new Date() },
      },
    });

    if (expiredCardsCount > 0) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'EXPIRED_ID_CARDS',
        title: 'Cartes scolaires expirées',
        description: `${expiredCardsCount} carte(s) scolaire(s) expirée(s) (fin d'année scolaire)`,
        recommendation:
          'Générer de nouvelles cartes pour l\'année scolaire en cours pour les élèves concernés.',
        count: expiredCardsCount,
      });
    }

    // 6. Incohérence identité / classe (LOW) — FIX OOM: use count instead of loading all students
    const inconsistenciesCount = await this.prisma.student.count({
      where: {
        ...where,
        status: 'ACTIVE',
        studentEnrollments: {
          none: { status: 'ACTIVE', ...(academicYearId && { academicYearId }) },
        },
        idCards: { some: { isActive: true, isRevoked: false } },
      },
    });

    if (inconsistenciesCount > 0) {
      alerts.push({
        severity: 'LOW',
        category: 'IDENTITY_INCONSISTENCY',
        title: 'Incohérences identité / classe',
        description: `${inconsistenciesCount} élève(s) avec incohérence entre statut d'inscription et carte scolaire`,
        recommendation: 'Vérifier et corriger les incohérences dans les données des élèves.',
        count: inconsistenciesCount,
      });
    }

    // 7. Cartes révoquées nombreuses (LOW) — FIX OOM: use count
    const revokedCardsCount = await this.prisma.studentIdCard.count({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
        isRevoked: true,
      },
    });

    if (revokedCardsCount > 10) {
      alerts.push({
        severity: 'LOW',
        category: 'HIGH_REVOCATION_RATE',
        title: 'Taux de révocation élevé',
        description: `${revokedCardsCount} carte(s) scolaire(s) révoquée(s) (perdues, volées, etc.)`,
        recommendation:
          'Analyser les motifs de révocation et mettre en place des mesures préventives (laminage, protections, etc.).',
        count: revokedCardsCount,
      });
    }

    return alerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
}


