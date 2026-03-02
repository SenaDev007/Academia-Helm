/**
 * TEACHING ASSIGNMENT PRISMA SERVICE - SM4
 * Affectations enseignant, classe, matiere, volume horaire. Validation surcharge, qualification, niveau.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TeachingAssignmentPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly assignmentInclude = {
    profile: {
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      },
    },
    academicClass: {
      include: {
        level: { select: { id: true, name: true } },
        cycle: { select: { id: true, name: true } },
      },
    },
    subject: { select: { id: true, name: true, code: true } },
    series: { select: { id: true, name: true, description: true } },
  };

  async getCurrentWeeklyHours(profileId: string, excludeAssignmentId?: string): Promise<number> {
    const where: { profileId: string; isActive: boolean; id?: { not: string } } = {
      profileId,
      isActive: true,
    };
    if (excludeAssignmentId) where.id = { not: excludeAssignmentId };
    const assignments = await this.prisma.teachingAssignment.findMany({
      where,
      select: { weeklyHours: true },
    });
    return assignments.reduce((sum, a) => sum + a.weeklyHours, 0);
  }

  async validateAssignment(
    tenantId: string,
    profileId: string,
    classId: string,
    subjectId: string,
    weeklyHours: number,
    excludeAssignmentId?: string
  ): Promise<{ ok: boolean; error?: string }> {
    const profile = await this.prisma.teacherAcademicProfile.findFirst({
      where: { id: profileId, tenantId },
      include: {
        subjectQualifications: { select: { subjectId: true } },
        levelAuthorizations: { select: { levelId: true } },
      },
    });
    if (!profile) return { ok: false, error: 'Profil academique non trouve.' };

    const currentHours = await this.getCurrentWeeklyHours(profileId, excludeAssignmentId);
    const newTotal = currentHours + weeklyHours;
    if (newTotal > profile.maxWeeklyHours) {
      return {
        ok: false,
        error: 'Surcharge: charge actuelle ' + currentHours + 'h + ' + weeklyHours + 'h = ' + newTotal + 'h > max ' + profile.maxWeeklyHours + 'h.',
      };
    }

    const hasSubject = profile.subjectQualifications.some((q) => q.subjectId === subjectId);
    if (!hasSubject) {
      return { ok: false, error: "L'enseignant n'est pas qualifie pour cette matiere." };
    }

    const cls = await this.prisma.academicClass.findFirst({
      where: { id: classId, tenantId },
      select: { levelId: true },
    });
    if (!cls) return { ok: false, error: 'Classe non trouvee.' };
    const hasLevel = profile.levelAuthorizations.some((la) => la.levelId === cls.levelId);
    if (!hasLevel) {
      return { ok: false, error: "L'enseignant n'est pas autorise pour le niveau de cette classe." };
    }

    return { ok: true };
  }

  async findAll(
    tenantId: string,
    academicYearId: string,
    filters?: { profileId?: string; classId?: string; isActive?: boolean }
  ) {
    if (!academicYearId) return [];
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.profileId) where.profileId = filters.profileId;
    if (filters?.classId) where.classId = filters.classId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    return this.prisma.teachingAssignment.findMany({
      where,
      include: this.assignmentInclude,
      orderBy: [
        { profile: { teacher: { lastName: 'asc' } } },
        { academicClass: { name: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });
  }

  async getOne(id: string, tenantId: string) {
    const a = await this.prisma.teachingAssignment.findFirst({
      where: { id, tenantId },
      include: this.assignmentInclude,
    });
    if (!a) throw new NotFoundException('Affectation non trouvee.');
    return a;
  }

  async create(data: {
    tenantId: string;
    academicYearId: string;
    profileId: string;
    classId: string;
    subjectId: string;
    seriesId?: string | null;
    weeklyHours: number;
    startDate: Date | string;
    endDate?: Date | string | null;
  }) {
    const validation = await this.validateAssignment(
      data.tenantId,
      data.profileId,
      data.classId,
      data.subjectId,
      data.weeklyHours
    );
    if (!validation.ok) throw new BadRequestException(validation.error);

    const existing = await this.prisma.teachingAssignment.findUnique({
      where: {
        tenantId_academicYearId_profileId_classId_subjectId: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          profileId: data.profileId,
          classId: data.classId,
          subjectId: data.subjectId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'Une affectation identique (meme enseignant, classe, matiere) existe deja pour cette annee.'
      );
    }

    return this.prisma.teachingAssignment.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        profileId: data.profileId,
        classId: data.classId,
        subjectId: data.subjectId,
        seriesId: data.seriesId ?? null,
        weeklyHours: data.weeklyHours,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
      include: this.assignmentInclude,
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      seriesId?: string | null;
      weeklyHours?: number;
      startDate?: Date | string;
      endDate?: Date | string | null;
      isActive?: boolean;
    }
  ) {
    const existing = await this.getOne(id, tenantId);
    if (data.weeklyHours !== undefined) {
      const validation = await this.validateAssignment(
        tenantId,
        existing.profileId,
        existing.classId,
        existing.subjectId,
        data.weeklyHours,
        id
      );
      if (!validation.ok) throw new BadRequestException(validation.error);
    }

    const updateData: Record<string, unknown> = {};
    if (data.seriesId !== undefined) updateData.seriesId = data.seriesId;
    if (data.weeklyHours !== undefined) updateData.weeklyHours = data.weeklyHours;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.teachingAssignment.update({
      where: { id },
      data: updateData,
      include: this.assignmentInclude,
    });
  }

  async delete(id: string, tenantId: string) {
    await this.getOne(id, tenantId);
    await this.prisma.teachingAssignment.delete({ where: { id } });
    return { deleted: true };
  }

  async getChargeSummary(profileId: string, tenantId: string) {
    const profile = await this.prisma.teacherAcademicProfile.findFirst({
      where: { id: profileId, tenantId },
      include: { teacher: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!profile) throw new NotFoundException('Profil non trouve.');
    const currentHours = await this.getCurrentWeeklyHours(profileId);
    return {
      profileId,
      teacher: profile.teacher,
      maxWeeklyHours: profile.maxWeeklyHours,
      currentWeeklyHours: currentHours,
      overload: currentHours > profile.maxWeeklyHours,
    };
  }
}
