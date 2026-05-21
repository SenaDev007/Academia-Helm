import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class QHSEService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(tenantId: string, academicYearId: string) {
    const [incidents, risks, inspections, plans] = await Promise.all([
      this.prisma.qHSEIncident.findMany({
        where: { tenantId, academicYearId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { student: true, reporter: true },
      }),
      this.prisma.qHSERisk.findMany({
        where: { tenantId, criticite: { in: ['ELEVE', 'CRITIQUE'] } },
        take: 5,
      }),
      this.prisma.qHSEHygieneInspection.findMany({
        where: { tenantId, academicYearId },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      this.prisma.qHSEActionPlan.findMany({
        where: { tenantId, status: 'OUVERT' },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ]);

    const stats = {
      totalIncidents: await this.prisma.qHSEIncident.count({ where: { tenantId, academicYearId } }),
      criticalRisks: await this.prisma.qHSERisk.count({ where: { tenantId, criticite: 'CRITIQUE' } }),
      pendingPlans: await this.prisma.qHSEActionPlan.count({ where: { tenantId, status: 'OUVERT' } }),
      complianceRate: 95, // Mocked for now
      alertsCount: await this.prisma.qHSEAlert.count({ where: { tenantId, isRead: false } }),
    };

    const alerts = await this.prisma.qHSEAlert.findMany({
      where: { tenantId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return { stats, recentIncidents: incidents, risks, recentInspections: inspections, plans, alerts };
  }

  async findAllIncidents(tenantId: string, academicYearId: string) {
    return this.prisma.qHSEIncident.findMany({
      where: { tenantId, academicYearId },
      include: { student: true, reporter: true, staff: true, attachments: true },
      orderBy: { date: 'desc' },
    });
  }

  async addIncidentAttachment(incidentId: string, data: any) {
    return this.prisma.qHSEIncidentAttachment.create({
      data: { ...data, incidentId },
    });
  }

  async createIncident(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.qHSEIncident.create({
      data: { ...data, tenantId, academicYearId },
    });
  }

  async findAllRisks(tenantId: string) {
    return this.prisma.qHSERisk.findMany({
      where: { tenantId },
      include: { responsible: true },
    });
  }

  async createRisk(tenantId: string, data: any) {
    return this.prisma.qHSERisk.create({
      data: { ...data, tenantId },
    });
  }

  async findAllHygiene(tenantId: string, academicYearId: string) {
    return this.prisma.qHSEHygieneInspection.findMany({
      where: { tenantId, academicYearId },
      include: { inspector: true, checkItems: true },
    });
  }

  async addHygieneCheckItem(inspectionId: string, data: any) {
    return this.prisma.qHSEHygieneCheckItem.create({
      data: { ...data, inspectionId },
    });
  }

  async createHygieneInspection(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.qHSEHygieneInspection.create({
      data: { ...data, tenantId, academicYearId },
    });
  }

  async findAllSecurity(tenantId: string) {
    return this.prisma.qHSESecurityControl.findMany({
      where: { tenantId },
      include: { responsible: true },
    });
  }

  async findAllHealthVisits(tenantId: string, academicYearId: string) {
    return this.prisma.qHSEHealthVisit.findMany({
      where: { tenantId, academicYearId },
      include: { patient: true, responsible: true },
    });
  }

  async createHealthVisit(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.qHSEHealthVisit.create({
      data: { ...data, tenantId, academicYearId },
    });
  }

  async findAllAudits(tenantId: string, academicYearId: string) {
    return this.prisma.qHSEAudit.findMany({
      where: { tenantId, academicYearId },
      include: { auditor: true, findings: true },
    });
  }

  async addAuditFinding(auditId: string, data: any) {
    return this.prisma.qHSEAuditFinding.create({
      data: { ...data, auditId },
    });
  }

  async findAllActionPlans(tenantId: string) {
    return this.prisma.qHSEActionPlan.findMany({
      where: { tenantId },
      include: { responsible: true, items: { include: { responsible: true } } },
    });
  }

  async addActionPlanItem(planId: string, data: any) {
    return this.prisma.qHSEActionPlanItem.create({
      data: { ...data, planId },
    });
  }

  async findAllAlerts(tenantId: string) {
    return this.prisma.qHSEAlert.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAlertAsRead(id: string) {
    return this.prisma.qHSEAlert.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async findAllDocuments(tenantId: string) {
    return this.prisma.qHSEDocument.findMany({
      where: { tenantId },
    });
  }

  async findAllCompliance(tenantId: string) {
    return this.prisma.qHSECompliance.findMany({
      where: { tenantId },
    });
  }

  async getSettings(tenantId: string) {
    return this.prisma.qHSESetting.findMany({
      where: { tenantId },
    });
  }
}
