/**
 * PEDAGOGICAL WORKSPACE PRISMA SERVICE - SM6
 * Cahier journal, cahier de texte, semainier, pieces jointes, signatures.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const DRAFT = 'DRAFT';
const SUBMITTED = 'SUBMITTED';
const APPROVED = 'APPROVED';
const REJECTED = 'REJECTED';

@Injectable()
export class PedagogicalWorkspacePrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- TeachingJournal ----------
  async findJournals(
    tenantId: string,
    academicYearId: string,
    filters?: { teacherId?: string; status?: string }
  ) {
    if (!academicYearId) return [];
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.teacherId) where.teacherId = filters.teacherId;
    if (filters?.status) where.status = filters.status;
    return this.prisma.teachingJournal.findMany({
      where,
      orderBy: { weekStartDate: 'desc' },
    });
  }

  async getJournalOrThrow(id: string, tenantId: string) {
    const j = await this.prisma.teachingJournal.findFirst({ where: { id, tenantId } });
    if (!j) throw new NotFoundException('Cahier journal non trouve.');
    return j;
  }

  async createJournal(data: {
    tenantId: string;
    academicYearId: string;
    teacherId: string;
    weekStartDate: Date | string;
    content: string;
  }) {
    const weekStart = new Date(data.weekStartDate);
    const existing = await this.prisma.teachingJournal.findUnique({
      where: {
        tenantId_academicYearId_teacherId_weekStartDate: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          teacherId: data.teacherId,
          weekStartDate: weekStart,
        },
      },
    });
    if (existing) throw new BadRequestException('Un cahier journal existe deja pour cette semaine et cet enseignant.');
    return this.prisma.teachingJournal.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        weekStartDate: weekStart,
        content: data.content,
        status: DRAFT,
      },
    });
  }

  async updateJournal(id: string, tenantId: string, data: { content?: string }) {
    const j = await this.getJournalOrThrow(id, tenantId);
    if (j.status === APPROVED) throw new BadRequestException('Modification interdite apres approbation.');
    return this.prisma.teachingJournal.update({
      where: { id },
      data,
    });
  }

  async submitJournal(id: string, tenantId: string) {
    const j = await this.getJournalOrThrow(id, tenantId);
    if (j.status !== DRAFT) throw new BadRequestException('Seul un brouillon peut etre soumis.');
    return this.prisma.teachingJournal.update({
      where: { id },
      data: { status: SUBMITTED, submittedAt: new Date() },
    });
  }

  async approveJournal(id: string, tenantId: string, approvedById: string) {
    const j = await this.getJournalOrThrow(id, tenantId);
    if (j.status !== SUBMITTED) throw new BadRequestException('Seul un document soumis peut etre approuve.');
    return this.prisma.teachingJournal.update({
      where: { id },
      data: { status: APPROVED, approvedAt: new Date(), approvedById },
    });
  }

  async rejectJournal(id: string, tenantId: string) {
    const j = await this.getJournalOrThrow(id, tenantId);
    if (j.status !== SUBMITTED) throw new BadRequestException('Seul un document soumis peut etre rejete.');
    return this.prisma.teachingJournal.update({
      where: { id },
      data: { status: REJECTED },
    });
  }

  // ---------- ClassLog ----------
  async findClassLogs(
    tenantId: string,
    academicYearId: string,
    filters?: { teacherId?: string; classId?: string; from?: string; to?: string }
  ) {
    if (!academicYearId) return [];
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.teacherId) where.teacherId = filters.teacherId;
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.from || filters?.to) {
      where.lessonDate = {};
      if (filters.from) (where.lessonDate as Record<string, Date>).gte = new Date(filters.from);
      if (filters.to) (where.lessonDate as Record<string, Date>).lte = new Date(filters.to);
    }
    return this.prisma.classLog.findMany({
      where,
      include: {
        academicYear: { select: { label: true } },
      },
      orderBy: { lessonDate: 'desc' },
    });
  }

  async getClassLogOrThrow(id: string, tenantId: string) {
    const c = await this.prisma.classLog.findFirst({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Cahier de texte non trouve.');
    return c;
  }

  async createClassLog(data: {
    tenantId: string;
    academicYearId: string;
    teacherId: string;
    classId: string;
    subjectId: string;
    lessonDate: Date | string;
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

  async updateClassLog(
    id: string,
    tenantId: string,
    data: { topic?: string; homework?: string | null; durationHours?: number; lessonDate?: Date | string }
  ) {
    await this.getClassLogOrThrow(id, tenantId);
    const updateData: Record<string, unknown> = { ...data };
    if (data.lessonDate) updateData.lessonDate = new Date(data.lessonDate);
    return this.prisma.classLog.update({ where: { id }, data: updateData });
  }

  async deleteClassLog(id: string, tenantId: string) {
    await this.getClassLogOrThrow(id, tenantId);
    await this.prisma.classLog.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------- WeeklyReport ----------
  async findWeeklyReports(
    tenantId: string,
    academicYearId: string,
    filters?: { teacherId?: string; status?: string }
  ) {
    if (!academicYearId) return [];
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.teacherId) where.teacherId = filters.teacherId;
    if (filters?.status) where.status = filters.status;
    return this.prisma.weeklyReport.findMany({
      where,
      orderBy: { weekStartDate: 'desc' },
    });
  }

  async getWeeklyReportOrThrow(id: string, tenantId: string) {
    const w = await this.prisma.weeklyReport.findFirst({ where: { id, tenantId } });
    if (!w) throw new NotFoundException('Semainier non trouve.');
    return w;
  }

  async createWeeklyReport(data: {
    tenantId: string;
    academicYearId: string;
    teacherId: string;
    weekStartDate: Date | string;
    summary: string;
    issues?: string | null;
    recommendations?: string | null;
  }) {
    const weekStart = new Date(data.weekStartDate);
    const existing = await this.prisma.weeklyReport.findUnique({
      where: {
        tenantId_academicYearId_teacherId_weekStartDate: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          teacherId: data.teacherId,
          weekStartDate: weekStart,
        },
      },
    });
    if (existing) throw new BadRequestException('Un semainier existe deja pour cette semaine et cet enseignant.');
    return this.prisma.weeklyReport.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        weekStartDate: weekStart,
        summary: data.summary,
        issues: data.issues ?? null,
        recommendations: data.recommendations ?? null,
        status: DRAFT,
      },
    });
  }

  async updateWeeklyReport(
    id: string,
    tenantId: string,
    data: { summary?: string; issues?: string | null; recommendations?: string | null }
  ) {
    const w = await this.getWeeklyReportOrThrow(id, tenantId);
    if (w.status === APPROVED) throw new BadRequestException('Modification interdite apres approbation.');
    return this.prisma.weeklyReport.update({ where: { id }, data });
  }

  async submitWeeklyReport(id: string, tenantId: string) {
    const w = await this.getWeeklyReportOrThrow(id, tenantId);
    if (w.status !== DRAFT) throw new BadRequestException('Seul un brouillon peut etre soumis.');
    return this.prisma.weeklyReport.update({
      where: { id },
      data: { status: SUBMITTED, submittedAt: new Date() },
    });
  }

  async approveWeeklyReport(id: string, tenantId: string, approvedById: string) {
    const w = await this.getWeeklyReportOrThrow(id, tenantId);
    if (w.status !== SUBMITTED) throw new BadRequestException('Seul un document soumis peut etre approuve.');
    return this.prisma.weeklyReport.update({
      where: { id },
      data: { status: APPROVED, approvedAt: new Date(), approvedById },
    });
  }

  async rejectWeeklyReport(id: string, tenantId: string) {
    const w = await this.getWeeklyReportOrThrow(id, tenantId);
    if (w.status !== SUBMITTED) throw new BadRequestException('Seul un document soumis peut etre rejete.');
    return this.prisma.weeklyReport.update({
      where: { id },
      data: { status: REJECTED },
    });
  }

  // ---------- PedagogicalAttachment ----------
  async listAttachments(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.pedagogicalAttachment.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async createAttachment(data: {
    tenantId: string;
    entityType: string;
    entityId: string;
    fileUrl: string;
  }) {
    return this.prisma.pedagogicalAttachment.create({
      data: {
        tenantId: data.tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        fileUrl: data.fileUrl,
      },
    });
  }

  // ---------- PedagogicalSignature ----------
  async listSignatures(tenantId: string, entityType: string, entityId: string) {
    return this.prisma.pedagogicalSignature.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { signedAt: 'desc' },
    });
  }

  async createSignature(data: {
    tenantId: string;
    entityType: string;
    entityId: string;
    signedById: string;
    signatureHash: string;
  }) {
    return this.prisma.pedagogicalSignature.create({
      data: {
        tenantId: data.tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        signedById: data.signedById,
        signatureHash: data.signatureHash,
      },
    });
  }
}
