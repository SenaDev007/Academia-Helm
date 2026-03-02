/**
 * CLASS LOGS PRISMA SERVICE - SM6
 * Cahier de texte (seance) : enseignant, classe, matiere, date, theme, devoirs, duree.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ClassLogsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    tenantId: string,
    academicYearId: string,
    filters?: { teacherId?: string; classId?: string; subjectId?: string; from?: string; to?: string }
  ) {
    if (!academicYearId) return [];
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.teacherId) where.teacherId = filters.teacherId;
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.subjectId) where.subjectId = filters.subjectId;
    if (filters?.from) {
      where.lessonDate = { ...((where.lessonDate as object) || {}), gte: new Date(filters.from) };
    }
    if (filters?.to) {
      where.lessonDate = { ...((where.lessonDate as object) || {}), lte: new Date(filters.to) };
    }
    return this.prisma.classLog.findMany({
      where,
      include: this.include,
      orderBy: { lessonDate: 'desc' },
    });
  }

  async getOne(id: string, tenantId: string) {
    const log = await this.prisma.classLog.findFirst({
      where: { id, tenantId },
    });
    if (!log) throw new NotFoundException('Entree de cahier de texte non trouvee.');
    return log;
  }

  async create(data: {
    tenantId: string;
    academicYearId: string;
    teacherId: string;
    classId: string;
    subjectId: string;
    lessonDate: string;
    topic: string;
    homework?: string | null;
    durationHours: number;
  }) {
    return this.prisma.classLog.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        classId: data.classId,
        subjectId: data.subjectId,
        lessonDate: new Date(data.lessonDate),
        topic: data.topic,
        homework: data.homework ?? null,
        durationHours: data.durationHours,
      },
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: { topic?: string; homework?: string | null; durationHours?: number; lessonDate?: string }
  ) {
    await this.getOne(id, tenantId);
    const updateData: Record<string, unknown> = {};
    if (data.topic !== undefined) updateData.topic = data.topic;
    if (data.homework !== undefined) updateData.homework = data.homework;
    if (data.durationHours !== undefined) updateData.durationHours = data.durationHours;
    if (data.lessonDate !== undefined) updateData.lessonDate = new Date(data.lessonDate);
    return this.prisma.classLog.update({
      where: { id },
      data: updateData,
      include: this.include,
    });
  }

  async delete(id: string, tenantId: string) {
    await this.getOne(id, tenantId);
    await this.prisma.classLog.delete({ where: { id } });
    return { deleted: true };
  }
}
