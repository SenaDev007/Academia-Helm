import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FederisService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le profil du patronat pour un tenant donné
   */
  async getPatronatProfile(tenantId: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      include: {
        bureau: true,
        tenant: {
          select: {
            name: true,
            slug: true,
            subdomain: true,
            logo: true,
          },
        },
      },
    });

    if (!patronat) {
      throw new NotFoundException('Patronat profile not found');
    }

    return patronat;
  }

  /**
   * Récupère la liste des écoles affiliées au patronat
   */
  async getAffiliatedSchools(tenantId: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (!patronat) {
      throw new NotFoundException('Patronat not found');
    }

    const schools = await this.prisma.patronatSchool.findMany({
      where: { patronatId: patronat.id, status: 'JOINED' },
      include: {
        schoolTenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            subdomain: true,
            logo: true,
          },
        },
      },
    });

    return schools.map(s => s.schoolTenant);
  }

  /**
   * Récupère les statistiques consolidées pour le patronat
   */
  async getConsolidatedStats(tenantId: string) {
    const schools = await this.getAffiliatedSchools(tenantId);
    const schoolIds = schools.map(s => s.id);

    // Exemple de stats consolidées (à enrichir selon le CDC)
    const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
      this.prisma.student.count({ where: { tenantId: { in: schoolIds }, isActive: true } }),
      this.prisma.teacher.count({ where: { tenantId: { in: schoolIds }, isActive: true } }),
      this.prisma.class.count({ where: { tenantId: { in: schoolIds }, isActive: true } }),
    ]);

    return {
      totalSchools: schools.length,
      totalStudents,
      totalTeachers,
      totalClasses,
    };
  }

  /**
   * Récupère les membres du bureau
   */
  async getBureauMembers(tenantId: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (!patronat) throw new NotFoundException('Patronat not found');

    return this.prisma.patronatBureauMember.findMany({
      where: { patronatId: patronat.id, isActive: true },
    });
  }

  /**
   * Récupère le résumé des compositions d'examens
   */
  async getExamsCompositionSummary(tenantId: string) {
    return this.prisma.examComposition.findMany({
      where: { tenantId },
      include: {
        exam: true,
        center: true,
        subject: true,
      },
      orderBy: { date: 'desc' },
      take: 10,
    });
  }

  /**
   * Récupère les dernières délibérations
   */
  async getExamsDeliberationSummary(tenantId: string) {
    return this.prisma.examDeliberation.findMany({
      where: { tenantId },
      include: {
        exam: true,
        cases: true,
      },
      orderBy: { deliberatedAt: 'desc' },
      take: 5,
    });
  }

  /**
   * Gestion des Incidents (Module 10/11)
   */
  async getIncidents(tenantId: string, examId?: string) {
    return this.prisma.examIncident.findMany({
      where: { 
        tenantId,
        ...(examId && { examId }),
      },
      include: {
        exam: true,
        center: true,
        candidate: true,
      },
      orderBy: { reportedAt: 'desc' },
    });
  }

  /**
   * Coffre-fort des Sujets (Module 9)
   */
  async getSubjectVault(tenantId: string, examId: string) {
    return this.prisma.examSubjectFile.findMany({
      where: { 
        tenantId,
        subject: { examId },
      },
      include: {
        subject: true,
      },
      orderBy: { subject: { order: 'asc' } },
    });
  }

  /**
   * Gestion du personnel des centres (Module 7)
   */
  async getCenterStaff(tenantId: string, centerId: string) {
    return this.prisma.examStaff.findMany({
      where: { tenantId, centerId },
      include: { center: true },
    });
  }

  /**
   * Facturation et Redevances (Module 19)
   */
  async getInvoices(tenantId: string) {
    return this.prisma.federisInvoice.findMany({
      where: { tenantId },
      include: { 
        payments: true,
        patronat: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Écoles Manuelles (Module 3)
   */
  async getManualSchools(tenantId: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (!patronat) throw new NotFoundException('Patronat not found');

    return this.prisma.patronatManualSchool.findMany({
      where: { patronatId: patronat.id },
    });
  }
}
