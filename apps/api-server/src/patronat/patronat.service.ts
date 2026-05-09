import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PatronatService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le profil du patronat pour un tenant donné
   */
  async getPatronatProfile(tenantId: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      include: {
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
}
