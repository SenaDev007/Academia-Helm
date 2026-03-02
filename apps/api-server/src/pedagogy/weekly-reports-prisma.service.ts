/**
 * WEEKLY REPORTS PRISMA SERVICE - SM6
 * Semainier : résumé, difficultés, recommandations. Statut DRAFT/SUBMITTED/APPROVED/REJECTED.
 * Après APPROVED : lecture seule.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const APPROVED = 'APPROVED';

@Injectable()
export class WeeklyReportsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    tenantId: string,
    academicYearId: string,
    filters?: { teacherId?: string; status?: string; fromWeek?: string; toWeek?: string }
  ) {
    if (!academicYearId) return [];
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.teacherId) where.teacherId = filters.teacherId;
    if (filters?.status) where.status = filters.status;
    if (filters?.fromWeek) {
      where.weekStartDate = { ...((where.weekStartDate as object) || {}), gte: new Date(filters.fromWeek) };
    }
    if (filters?.toWeek) {
      where.weekStartDate = { ...((where.weekStartDate as object) || {}), lte: new Date(filters.toWeek) };
    }
    return this.prisma.weeklyReport.findMany({
      where,
      orderBy: [{ weekStartDate: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getOne(id: string, tenantId: string) {
    const r = await this.prisma.weeklyReport.findFirst({
      where: { id, tenantId },
    });
    if (!r) throw new NotFoundException('Semainier non trouvé.');
    return r;
  }

  async create(data: {
    tenantId: string;
    academicYearId: string;
    teacherId: string;
    weekStartDate: string;
    summary: string;
    issues?: string | null;
    recommendations?: string | null;
  }) {
    const existing = await this.prisma.weeklyReport.findUnique({
      where: {
        tenantId_academicYearId_teacherId_weekStartDate: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          teacherId: data.teacherId,
          weekStartDate: new Date(data.weekStartDate),
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Un semainier existe déjà pour cet enseignant et cette semaine.');
    }
    return this.prisma.weeklyReport.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        weekStartDate: new Date(data.weekStartDate),
        summary: data.summary,
        issues: data.issues ?? null,
        recommendations: data.recommendations ?? null,
        status: 'DRAFT',
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: { summary?: string; issues?: string | null; recommendations?: string | null; status?: string }
  ) {
    const existing = await this.getOne(id, tenantId);
    if (existing.status === APPROVED) {
      throw new BadRequestException('Un semainier approuvé ne peut plus être modifié.');
    }
    const updateData: { summary?: string; issues?: string | null; recommendations?: string | null; status?: string; submittedAt?: Date; approvedAt?: Date; approvedById?: string } = {};
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.issues !== undefined) updateData.issues = data.issues;
    if (data.recommendations !== undefined) updateData.recommendations = data.recommendations;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'SUBMITTED') updateData.submittedAt = new Date();
    }
    return this.prisma.weeklyReport.update({
      where: { id },
      data: updateData,
    });
  }

  async approve(id: string, tenantId: string, approvedById: string) {
    const existing = await this.getOne(id, tenantId);
    if (existing.status === APPROVED) {
      throw new BadRequestException('Semainier déjà approuvé.');
    }
    return this.prisma.weeklyReport.update({
      where: { id },
      data: { status: APPROVED, approvedAt: new Date(), approvedById },
    });
  }

  async reject(id: string, tenantId: string) {
    const existing = await this.getOne(id, tenantId);
    if (existing.status === APPROVED) {
      throw new BadRequestException('Un semainier approuvé ne peut pas être rejeté.');
    }
    return this.prisma.weeklyReport.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }
}
