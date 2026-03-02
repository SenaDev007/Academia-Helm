import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AcademicSeriesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllSeries(tenantId: string, academicYearId: string, levelId?: string) {
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (levelId) where.levelId = levelId;
    return this.prisma.academicSeries.findMany({
      where,
      include: { level: true, seriesSubjects: { include: { subject: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createSeries(data: {
    tenantId: string;
    academicYearId: string;
    levelId: string;
    name: string;
    description?: string;
  }) {
    const existing = await this.prisma.academicSeries.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        levelId: data.levelId,
        name: data.name,
      },
    });
    if (existing) throw new BadRequestException(`La série "${data.name}" existe déjà.`);
    return this.prisma.academicSeries.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        levelId: data.levelId,
        name: data.name,
        description: data.description ?? null,
      },
      include: { level: true },
    });
  }

  async updateSeries(id: string, tenantId: string, data: { name?: string; description?: string; isActive?: boolean }) {
    await this.getSeriesOrThrow(id, tenantId);
    return this.prisma.academicSeries.update({
      where: { id },
      data,
      include: { level: true, seriesSubjects: { include: { subject: true } } },
    });
  }

  async getSeriesOrThrow(id: string, tenantId: string) {
    const s = await this.prisma.academicSeries.findFirst({
      where: { id, tenantId },
      include: { level: true, seriesSubjects: { include: { subject: true } } },
    });
    if (!s) throw new NotFoundException('Série non trouvée.');
    return s;
  }

  async addSubjectToSeries(data: {
    tenantId: string;
    academicYearId: string;
    seriesId: string;
    subjectId: string;
    coefficient: number;
    weeklyHours: number;
  }) {
    const existing = await this.prisma.seriesSubject.findFirst({
      where: { seriesId: data.seriesId, subjectId: data.subjectId },
    });
    if (existing) throw new BadRequestException('Cette matière est déjà dans la série.');
    return this.prisma.seriesSubject.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        seriesId: data.seriesId,
        subjectId: data.subjectId,
        coefficient: data.coefficient,
        weeklyHours: data.weeklyHours,
      },
      include: { series: true, subject: true },
    });
  }

  async updateSeriesSubject(id: string, tenantId: string, data: { coefficient?: number; weeklyHours?: number }) {
    const ex = await this.prisma.seriesSubject.findFirst({ where: { id, tenantId } });
    if (!ex) throw new NotFoundException('Lien série-matière non trouvé.');
    return this.prisma.seriesSubject.update({
      where: { id },
      data,
      include: { series: true, subject: true },
    });
  }

  async removeSubjectFromSeries(id: string, tenantId: string) {
    const ex = await this.prisma.seriesSubject.findFirst({ where: { id, tenantId } });
    if (!ex) throw new NotFoundException('Lien non trouvé.');
    return this.prisma.seriesSubject.delete({ where: { id } });
  }

  async findProgramsBySubject(tenantId: string, academicYearId: string, subjectId: string) {
    return this.prisma.subjectProgram.findMany({
      where: { tenantId, academicYearId, subjectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubjectProgram(data: {
    tenantId: string;
    academicYearId: string;
    subjectId: string;
    documentUrl: string;
    version: string;
  }) {
    return this.prisma.subjectProgram.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        subjectId: data.subjectId,
        documentUrl: data.documentUrl,
        version: data.version,
      },
      include: { subject: true },
    });
  }

  async approveSubjectProgram(id: string, tenantId: string, approvedById: string) {
    const ex = await this.prisma.subjectProgram.findFirst({ where: { id, tenantId } });
    if (!ex) throw new NotFoundException('Programme non trouvé.');
    return this.prisma.subjectProgram.update({
      where: { id },
      data: { approvedById, approvedAt: new Date() },
      include: { subject: true },
    });
  }
}
