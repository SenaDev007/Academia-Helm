/**
 * TEACHING JOURNALS PRISMA SERVICE - SM6
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const APPROVED = 'APPROVED';

@Injectable()
export class TeachingJournalsPrismaService {
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
    return this.prisma.teachingJournal.findMany({
      where,
      orderBy: [{ weekStartDate: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getOne(id: string, tenantId: string) {
    const j = await this.prisma.teachingJournal.findFirst({
      where: { id, tenantId },
    });
    if (!j) throw new NotFoundException('Teaching journal not found');
    return j;
  }

  async create(data: {
    tenantId: string;
    academicYearId: string;
    teacherId: string;
    weekStartDate: string;
    content: string;
  }) {
    const existing = await this.prisma.teachingJournal.findUnique({
      where: {
        tenantId_academicYearId_teacherId_weekStartDate: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          teacherId: data.teacherId,
          weekStartDate: new Date(data.weekStartDate),
        },
      },
    });
    if (existing) throw new BadRequestException('Journal already exists for this teacher and week.');
    return this.prisma.teachingJournal.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        weekStartDate: new Date(data.weekStartDate),
        content: data.content,
        status: 'DRAFT',
      },
    });
  }

  async update(id: string, tenantId: string, data: { content?: string; status?: string }) {
    const existing = await this.getOne(id, tenantId);
    if (existing.status === APPROVED) throw new BadRequestException('Approved journal cannot be modified.');
    const updateData: { content?: string; status?: string; submittedAt?: Date } = {};
    if (data.content !== undefined) updateData.content = data.content;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'SUBMITTED') updateData.submittedAt = new Date();
    }
    return this.prisma.teachingJournal.update({
      where: { id },
      data: updateData,
    });
  }

  async approve(id: string, tenantId: string, approvedById: string) {
    const existing = await this.getOne(id, tenantId);
    if (existing.status === APPROVED) throw new BadRequestException('Already approved.');
    return this.prisma.teachingJournal.update({
      where: { id },
      data: { status: APPROVED, approvedAt: new Date(), approvedById },
    });
  }

  async reject(id: string, tenantId: string) {
    const existing = await this.getOne(id, tenantId);
    if (existing.status === APPROVED) throw new BadRequestException('Approved journal cannot be rejected.');
    return this.prisma.teachingJournal.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }
}
