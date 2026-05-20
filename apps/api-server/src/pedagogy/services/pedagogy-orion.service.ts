/**
 * ============================================================================
 * PEDAGOGY ORION SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service ORION pour alertes pédagogiques
 * Observation et alertes (lecture seule)
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PedagogyOrionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère les KPIs pédagogiques pour ORION
   */
  async getPedagogicalKPIs(tenantId: string, academicYearId?: string) {
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    // Statistiques des documents pédagogiques
    const documents = await this.prisma.pedagogicalDocument.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const totalDocuments = documents.length;
    const submittedDocuments = documents.filter((d) => d.status === 'SUBMITTED').length;
    const approvedDocuments = documents.filter((d) => d.status === 'APPROVED').length;
    const rejectedDocuments = documents.filter((d) => d.status === 'REJECTED').length;
    const acknowledgedDocuments = documents.filter((d) => d.status === 'ACKNOWLEDGED').length;

    // Statistiques par type
    const byType = documents.reduce((acc, doc) => {
      acc[doc.documentType] = (acc[doc.documentType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Statistiques par enseignant
    const byTeacher = documents.reduce((acc, doc) => {
      if (doc.teacher) {
        const teacherId = doc.teacher.id;
        acc[teacherId] = acc[teacherId] || {
          teacher: doc.teacher,
          total: 0,
          submitted: 0,
          approved: 0,
          rejected: 0,
        };
        acc[teacherId].total += 1;
        if (doc.status === 'SUBMITTED') acc[teacherId].submitted += 1;
        if (doc.status === 'APPROVED') acc[teacherId].approved += 1;
        if (doc.status === 'REJECTED') acc[teacherId].rejected += 1;
      }
      return acc;
    }, {} as Record<string, any>);

    // Statistiques du semainier
    const semainiers = await this.prisma.weeklySemainier.findMany({
      where: {
        tenantId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        incidents: true,
      },
    });

    const totalSemainiers = semainiers.length;
    const submittedSemainiers = semainiers.filter((s) => s.status === 'SOUMIS').length;
    const validatedSemainiers = semainiers.filter((s) => s.status === 'VALIDATED').length;
    const totalIncidents = semainiers.reduce((sum, s) => sum + s.incidents.length, 0);
    const criticalIncidents = semainiers.reduce(
      (sum, s) => sum + s.incidents.filter((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH').length,
      0,
    );

    return {
      documents: {
        total: totalDocuments,
        submitted: submittedDocuments,
        approved: approvedDocuments,
        rejected: rejectedDocuments,
        acknowledged: acknowledgedDocuments,
        submissionRate: totalDocuments > 0 ? (submittedDocuments / totalDocuments) * 100 : 0,
        approvalRate: submittedDocuments > 0 ? (approvedDocuments / submittedDocuments) * 100 : 0,
        rejectionRate: submittedDocuments > 0 ? (rejectedDocuments / submittedDocuments) * 100 : 0,
        byType,
        byTeacher: Object.values(byTeacher),
      },
      semainier: {
        total: totalSemainiers,
        submitted: submittedSemainiers,
        validated: validatedSemainiers,
        validationRate: submittedSemainiers > 0 ? (validatedSemainiers / submittedSemainiers) * 100 : 0,
        totalIncidents,
        criticalIncidents,
        incidentRate: totalSemainiers > 0 ? (totalIncidents / totalSemainiers) : 0,
      },
      alerts: await this.generateAlerts(tenantId, academicYearId),
    };
  }

  /**
   * Génère les alertes ORION pour le workflow pédagogique
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

    // 1. Retards de soumission (documents en DRAFT depuis plus de 7 jours)
    const oldDrafts = await this.prisma.pedagogicalDocument.findMany({
      where: {
        ...where,
        status: 'DRAFT',
        createdAt: {
          lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 jours
        },
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (oldDrafts.length > 0) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'SUBMISSION_DELAY',
        title: 'Retards de soumission',
        description: `${oldDrafts.length} document(s) pédagogique(s) en brouillon depuis plus de 7 jours`,
        recommendation:
          'Rappeler aux enseignants concernés de finaliser et soumettre leurs documents pédagogiques',
        count: oldDrafts.length,
      });
    }

    // 2. Taux de rejet élevé (plus de 30% de rejet)
    const submittedDocuments = await this.prisma.pedagogicalDocument.findMany({
      where: {
        ...where,
        status: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] },
      },
    });

    if (submittedDocuments.length > 0) {
      const rejectedCount = submittedDocuments.filter((d) => d.status === 'REJECTED').length;
      const rejectionRate = (rejectedCount / submittedDocuments.length) * 100;

      if (rejectionRate > 30) {
        alerts.push({
          severity: 'HIGH',
          category: 'HIGH_REJECTION_RATE',
          title: 'Taux de rejet élevé',
          description: `${rejectionRate.toFixed(1)}% de rejet sur ${submittedDocuments.length} document(s) soumis`,
          recommendation:
            'Analyser les motifs de rejet et organiser une session de formation ou de clarification avec les enseignants',
          count: rejectedCount,
        });
      }
    }

    // 3. Enseignants non conformes (plus de 50% de documents rejetés)
    const teacherStats = await this.prisma.pedagogicalDocument.groupBy({
      by: ['teacherId'],
      where: {
        ...where,
        status: { in: ['APPROVED', 'REJECTED'] },
      },
      _count: true,
      _max: {
        status: true,
      },
    });

    const nonConformTeachers = teacherStats.filter((stat) => {
      // Calculer le taux de rejet pour chaque enseignant
      const teacherDocs = submittedDocuments.filter((d) => d.teacherId === stat.teacherId);
      const rejectedCount = teacherDocs.filter((d) => d.status === 'REJECTED').length;
      return teacherDocs.length > 0 && (rejectedCount / teacherDocs.length) * 100 > 50;
    });

    if (nonConformTeachers.length > 0) {
      alerts.push({
        severity: 'HIGH',
        category: 'NON_CONFORM_TEACHERS',
        title: 'Enseignants non conformes',
        description: `${nonConformTeachers.length} enseignant(s) avec plus de 50% de documents rejetés`,
        recommendation:
          'Planifier un accompagnement individuel pour les enseignants concernés',
        count: nonConformTeachers.length,
      });
    }

    // 4. Surcharge pédagogique (enseignants avec beaucoup de documents)
    const teacherDocumentCounts = await this.prisma.pedagogicalDocument.groupBy({
      by: ['teacherId'],
      where,
      _count: true,
    });

    const overloadedTeachers = teacherDocumentCounts.filter((stat) => stat._count > 20);

    if (overloadedTeachers.length > 0) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'PEDAGOGICAL_OVERLOAD',
        title: 'Surcharge pédagogique',
        description: `${overloadedTeachers.length} enseignant(s) avec plus de 20 documents pédagogiques`,
        recommendation: 'Répartir la charge pédagogique de manière plus équitable',
        count: overloadedTeachers.length,
      });
    }

    // 5. Incidents récurrents (via semainier)
    const recentSemainiers = await this.prisma.weeklySemainier.findMany({
      where: {
        ...where,
        weekStartDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 derniers jours
        },
      },
      include: {
        incidents: true,
      },
    });

    const incidentTypes = recentSemainiers.reduce((acc, s) => {
      s.incidents.forEach((incident) => {
        acc[incident.type] = (acc[incident.type] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const recurringIncidentTypes = Object.entries(incidentTypes).filter(([, count]) => count >= 5);

    if (recurringIncidentTypes.length > 0) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'RECURRING_INCIDENTS',
        title: 'Incidents récurrents',
        description: `Types d'incidents récurrents détectés: ${recurringIncidentTypes.map(([type]) => type).join(', ')}`,
        recommendation:
          'Analyser les causes des incidents récurrents et mettre en place des mesures préventives',
        count: recurringIncidentTypes.reduce((sum, [, count]) => sum + count, 0),
      });
    }

    // 6. Semainiers non soumis (en retard)
    const overdueSemainiers = await this.prisma.weeklySemainier.findMany({
      where: {
        ...where,
        status: 'EN_COURS',
        weekEndDate: {
          lt: new Date(), // Semaine terminée mais non soumis
        },
      },
      include: {
        assignment: {
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (overdueSemainiers.length > 0) {
      alerts.push({
        severity: 'LOW',
        category: 'OVERDUE_SEMAINIER',
        title: 'Semainiers non soumis en retard',
        description: `${overdueSemainiers.length} semainier(s) non soumis après la fin de la semaine`,
        recommendation: 'Rappeler aux enseignants de soumettre leur semainier en fin de semaine',
        count: overdueSemainiers.length,
      });
    }

    // 7. Documents soumis non traités (plus de 5 jours)
    const pendingValidation = await this.prisma.pedagogicalDocument.findMany({
      where: {
        ...where,
        status: 'SUBMITTED',
        submittedAt: {
          lte: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 jours
        },
      },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (pendingValidation.length > 0) {
      alerts.push({
        severity: 'HIGH',
        category: 'PENDING_VALIDATION',
        title: 'Documents soumis non traités',
        description: `${pendingValidation.length} document(s) soumis depuis plus de 5 jours en attente de validation`,
        recommendation:
          'Traiter les documents pédagogiques soumis dans les délais pour maintenir la fluidité du workflow',
        count: pendingValidation.length,
      });
    }

    // 8. Ressources de la bibliothèque jamais consultées (Insight Institutionnel)
    const unusedResourcesCount = await this.prisma.globalPedagogicalResource.count({
      where: {
        isPublished: true,
        usages: { none: {} }
      }
    });

    if (unusedResourcesCount > 0) {
      alerts.push({
        severity: 'LOW',
        category: 'UNUSED_LIBRARY_RESOURCES',
        title: 'Ressources de bibliothèque inutilisées',
        description: `${unusedResourcesCount} ressource(s) de la bibliothèque n''ont jamais été consultées par aucun établissement`,
        recommendation: 'Revoir la pertinence de ces ressources ou encourager leur utilisation lors des conseils pédagogiques.',
        count: unusedResourcesCount,
      });
    }

    // 9. Enseignants n'utilisant pas la bibliothèque (Par Tenant)
    const teachersWithoutLibraryUsage = await this.prisma.staff.findMany({
      where: {
        tenantId,
        category: 'PEDAGOGICAL',
        status: 'ACTIVE',
        globalResourceUsages: { none: {} }
      }
    });

    if (teachersWithoutLibraryUsage.length > 0) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'TEACHERS_WITHOUT_LIBRARY_USAGE',
        title: 'Enseignants sous-exploitants la bibliothèque',
        description: `${teachersWithoutLibraryUsage.length} enseignant(s) actif(s) n'ont consulté aucune ressource globale ce trimestre`,
        recommendation: "Encourager les enseignants à s'appuyer sur les ressources institutionnelles pour enrichir leurs cours.",
        count: teachersWithoutLibraryUsage.length,
      });
    }

    return alerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
}

