/**
 * PEDAGOGY KPI SERVICE - SM7
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PedagogyKpiService {
  constructor(private readonly prisma: PrismaService) {}

  async findSnapshots(
    tenantId: string,
    academicYearId: string,
    filters?: { teacherId?: string; classId?: string }
  ) {
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.teacherId) where.teacherId = filters.teacherId;
    if (filters?.classId) where.classId = filters.classId;
    return this.prisma.pedagogicalKpiSnapshot.findMany({
      where,
      orderBy: { calculatedAt: 'desc' },
      take: 100,
    });
  }

  async getDashboard(tenantId: string, academicYearId: string) {
    const [snapshots, assignmentCount, profileCount] = await Promise.all([
      this.prisma.pedagogicalKpiSnapshot.findMany({
        where: { tenantId, academicYearId },
        orderBy: { calculatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.teachingAssignment.count({
        where: { tenantId, academicYearId, isActive: true },
      }),
      this.prisma.teacherAcademicProfile.count({
        where: { tenantId, academicYearId, isActive: true },
      }),
    ]);

    const latest = snapshots[0];
    const lessonPlanRate = latest?.lessonPlanRate ?? 0;
    const journalRate = latest?.journalRate ?? 0;
    const classLogRate = latest?.classLogRate ?? 0;
    const weeklyReportRate = latest?.weeklyReportRate ?? 0;

    return {
      lessonPlanRate,
      journalRate,
      classLogRate,
      weeklyReportRate,
      overallRate: (lessonPlanRate + journalRate + classLogRate + weeklyReportRate) / 4,
      totalActiveAssignments: assignmentCount,
      totalActiveProfiles: profileCount,
      lastCalculatedAt: latest?.calculatedAt ?? null,
      snapshotsCount: snapshots.length,
    };
  }

  async createSnapshot(
    tenantId: string,
    academicYearId: string,
    data: {
      teacherId?: string | null;
      classId?: string | null;
      lessonPlanRate: number;
      journalRate: number;
      classLogRate: number;
      weeklyReportRate: number;
    }
  ) {
    return this.prisma.pedagogicalKpiSnapshot.create({
      data: {
        tenantId,
        academicYearId,
        teacherId: data.teacherId ?? null,
        classId: data.classId ?? null,
        lessonPlanRate: data.lessonPlanRate,
        journalRate: data.journalRate,
        classLogRate: data.classLogRate,
        weeklyReportRate: data.weeklyReportRate,
      },
    });
  }
}
