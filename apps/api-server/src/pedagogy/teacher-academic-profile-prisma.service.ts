/**
 * TEACHER ACADEMIC PROFILE PRISMA SERVICE - SM3
 * Profils académiques enseignants : qualifications matières, niveaux autorisés, disponibilités.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TeacherAcademicProfilePrismaService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly profileInclude = {
    teacher: { select: { id: true, firstName: true, lastName: true, matricule: true, email: true } },
    academicYear: { select: { id: true, label: true } },
    subjectQualifications: { include: { subject: { select: { id: true, name: true, code: true } } } },
    levelAuthorizations: { include: { level: { select: { id: true, name: true } } } },
    availabilities: true,
  };

  async findAllProfiles(tenantId: string, academicYearId: string) {
    if (!academicYearId) return [];
    return this.prisma.teacherAcademicProfile.findMany({
      where: { tenantId, academicYearId },
      include: this.profileInclude,
      orderBy: { teacher: { lastName: 'asc' } },
    });
  }

  async findProfileByTeacher(tenantId: string, academicYearId: string, teacherId: string) {
    const profile = await this.prisma.teacherAcademicProfile.findFirst({
      where: { tenantId, academicYearId, teacherId },
      include: this.profileInclude,
    });
    if (!profile) throw new NotFoundException('Profil académique non trouvé pour cet enseignant et cette année.');
    return profile;
  }

  async getProfileOrThrow(profileId: string, tenantId: string) {
    const profile = await this.prisma.teacherAcademicProfile.findFirst({
      where: { id: profileId, tenantId },
      include: this.profileInclude,
    });
    if (!profile) throw new NotFoundException('Profil académique non trouvé.');
    return profile;
  }

  async createProfile(data: {
    tenantId: string;
    academicYearId: string;
    teacherId: string;
    maxWeeklyHours: number;
    isSemainier?: boolean;
  }) {
    const existing = await this.prisma.teacherAcademicProfile.findUnique({
      where: {
        tenantId_academicYearId_teacherId: {
          tenantId: data.tenantId,
          academicYearId: data.academicYearId,
          teacherId: data.teacherId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Un profil académique existe déjà pour cet enseignant et cette année.');
    }
    return this.prisma.teacherAcademicProfile.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        teacherId: data.teacherId,
        maxWeeklyHours: data.maxWeeklyHours,
        isSemainier: data.isSemainier ?? false,
      },
      include: this.profileInclude,
    });
  }

  async updateProfile(
    profileId: string,
    tenantId: string,
    data: { maxWeeklyHours?: number; isSemainier?: boolean; isActive?: boolean }
  ) {
    await this.getProfileOrThrow(profileId, tenantId);
    return this.prisma.teacherAcademicProfile.update({
      where: { id: profileId },
      data,
      include: this.profileInclude,
    });
  }

  async addSubjectQualification(data: {
    tenantId: string;
    academicYearId: string;
    profileId: string;
    subjectId: string;
    certified?: boolean;
  }) {
    await this.getProfileOrThrow(data.profileId, data.tenantId);
    const existing = await this.prisma.teacherSubjectQualification.findUnique({
      where: { profileId_subjectId: { profileId: data.profileId, subjectId: data.subjectId } },
    });
    if (existing) throw new BadRequestException('Cette matière est déjà qualifiée pour ce profil.');
    return this.prisma.teacherSubjectQualification.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        profileId: data.profileId,
        subjectId: data.subjectId,
        certified: data.certified ?? false,
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });
  }

  async removeSubjectQualification(profileId: string, subjectId: string, tenantId: string) {
    await this.getProfileOrThrow(profileId, tenantId);
    const q = await this.prisma.teacherSubjectQualification.findFirst({
      where: { profileId, subjectId, tenantId },
    });
    if (!q) throw new NotFoundException('Qualification matière non trouvée.');
    await this.prisma.teacherSubjectQualification.delete({ where: { id: q.id } });
    return { deleted: true };
  }

  async addLevelAuthorization(data: {
    tenantId: string;
    academicYearId: string;
    profileId: string;
    levelId: string;
  }) {
    await this.getProfileOrThrow(data.profileId, data.tenantId);
    const existing = await this.prisma.teacherLevelAuthorization.findUnique({
      where: { profileId_levelId: { profileId: data.profileId, levelId: data.levelId } },
    });
    if (existing) throw new BadRequestException('Ce niveau est déjà autorisé pour ce profil.');
    return this.prisma.teacherLevelAuthorization.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        profileId: data.profileId,
        levelId: data.levelId,
      },
      include: { level: { select: { id: true, name: true } } },
    });
  }

  async removeLevelAuthorization(profileId: string, levelId: string, tenantId: string) {
    await this.getProfileOrThrow(profileId, tenantId);
    const la = await this.prisma.teacherLevelAuthorization.findFirst({
      where: { profileId, levelId, tenantId },
    });
    if (!la) throw new NotFoundException('Autorisation niveau non trouvée.');
    await this.prisma.teacherLevelAuthorization.delete({ where: { id: la.id } });
    return { deleted: true };
  }

  async listAvailabilities(profileId: string, tenantId: string) {
    await this.getProfileOrThrow(profileId, tenantId);
    return this.prisma.teacherAvailability.findMany({
      where: { profileId, tenantId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createAvailability(data: {
    tenantId: string;
    academicYearId: string;
    profileId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) {
    await this.getProfileOrThrow(data.profileId, data.tenantId);
    if (data.dayOfWeek < 0 || data.dayOfWeek > 6) {
      throw new BadRequestException('dayOfWeek doit être entre 0 (dimanche) et 6 (samedi).');
    }
    return this.prisma.teacherAvailability.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        profileId: data.profileId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });
  }

  async updateAvailability(
    availabilityId: string,
    tenantId: string,
    data: { dayOfWeek?: number; startTime?: string; endTime?: string }
  ) {
    const av = await this.prisma.teacherAvailability.findFirst({
      where: { id: availabilityId, tenantId },
    });
    if (!av) throw new NotFoundException('Disponibilité non trouvée.');
    if (data.dayOfWeek !== undefined && (data.dayOfWeek < 0 || data.dayOfWeek > 6)) {
      throw new BadRequestException('dayOfWeek doit être entre 0 et 6.');
    }
    return this.prisma.teacherAvailability.update({
      where: { id: availabilityId },
      data,
    });
  }

  async deleteAvailability(availabilityId: string, tenantId: string) {
    const av = await this.prisma.teacherAvailability.findFirst({
      where: { id: availabilityId, tenantId },
    });
    if (!av) throw new NotFoundException('Disponibilité non trouvée.');
    await this.prisma.teacherAvailability.delete({ where: { id: availabilityId } });
    return { deleted: true };
  }
}
