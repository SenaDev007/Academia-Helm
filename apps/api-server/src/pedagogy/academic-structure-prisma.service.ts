/**
 * ACADEMIC STRUCTURE PRISMA SERVICE - MODULE 2
 * Structure académique : Niveaux → Cycles → Classes (par année scolaire).
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AcademicStructurePrismaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllLevels(tenantId: string, academicYearId: string) {
    return this.prisma.academicLevel.findMany({
      where: { tenantId, academicYearId },
      include: { cycles: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async createLevel(data: {
    tenantId: string;
    academicYearId: string;
    name: string;
    orderIndex?: number;
  }) {
    const existing = await this.prisma.academicLevel.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        name: data.name,
      },
    });
    if (existing) {
      throw new BadRequestException(`Le niveau "${data.name}" existe déjà pour cette année.`);
    }
    return this.prisma.academicLevel.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        name: data.name,
        orderIndex: data.orderIndex ?? 0,
      },
    });
  }

  async updateLevel(id: string, tenantId: string, data: { name?: string; orderIndex?: number; isActive?: boolean }) {
    await this.getLevelOrThrow(id, tenantId);
    return this.prisma.academicLevel.update({ where: { id }, data });
  }

  async getLevelOrThrow(id: string, tenantId: string) {
    const level = await this.prisma.academicLevel.findFirst({
      where: { id, tenantId },
      include: { cycles: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!level) throw new NotFoundException('Niveau non trouvé.');
    return level;
  }

  async findAllCycles(tenantId: string, academicYearId: string, levelId?: string) {
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (levelId) where.levelId = levelId;
    return this.prisma.academicCycle.findMany({
      where,
      include: { level: true, classes: { where: { isActive: true } } },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async createCycle(data: {
    tenantId: string;
    academicYearId: string;
    levelId: string;
    name: string;
    orderIndex?: number;
  }) {
    const existing = await this.prisma.academicCycle.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        levelId: data.levelId,
        name: data.name,
      },
    });
    if (existing) {
      throw new BadRequestException(`Le cycle "${data.name}" existe déjà pour ce niveau.`);
    }
    return this.prisma.academicCycle.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        levelId: data.levelId,
        name: data.name,
        orderIndex: data.orderIndex ?? 0,
      },
      include: { level: true },
    });
  }

  async updateCycle(id: string, tenantId: string, data: { name?: string; orderIndex?: number; isActive?: boolean }) {
    await this.getCycleOrThrow(id, tenantId);
    return this.prisma.academicCycle.update({
      where: { id },
      data,
      include: { level: true },
    });
  }

  async getCycleOrThrow(id: string, tenantId: string) {
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id, tenantId },
      include: { level: true, classes: true },
    });
    if (!cycle) throw new NotFoundException('Cycle non trouvé.');
    return cycle;
  }

  async findAllClasses(
    tenantId: string,
    academicYearId: string,
    filters?: { levelId?: string; cycleId?: string; isActive?: boolean }
  ) {
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.levelId) where.levelId = filters.levelId;
    if (filters?.cycleId) where.cycleId = filters.cycleId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    return this.prisma.academicClass.findMany({
      where,
      include: {
        level: true,
        cycle: true,
        room: true,
        mainTeacher: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      },
      orderBy: [{ cycle: { orderIndex: 'asc' } }, { name: 'asc' }],
    });
  }

  async createClass(data: {
    tenantId: string;
    academicYearId: string;
    levelId: string;
    cycleId: string;
    name: string;
    code: string;
    capacity?: number;
    roomId?: string;
    mainTeacherId?: string;
    languageTrack?: string;
  }) {
    const code = data.code.trim().toUpperCase().replace(/\s/g, '');
    const existing = await this.prisma.academicClass.findFirst({
      where: { tenantId: data.tenantId, academicYearId: data.academicYearId, code },
    });
    if (existing) {
      throw new BadRequestException(`Une classe avec le code "${data.code}" existe déjà pour cette année.`);
    }
    return this.prisma.academicClass.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        levelId: data.levelId,
        cycleId: data.cycleId,
        name: data.name,
        code,
        capacity: data.capacity,
        roomId: data.roomId || null,
        mainTeacherId: data.mainTeacherId || null,
        languageTrack: data.languageTrack || null,
      },
      include: {
        level: true,
        cycle: true,
        room: true,
        mainTeacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateClass(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      code?: string;
      capacity?: number;
      roomId?: string | null;
      mainTeacherId?: string | null;
      languageTrack?: string | null;
      isActive?: boolean;
    }
  ) {
    const existing = await this.prisma.academicClass.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Classe non trouvée.');
    if (data.code && data.code !== existing.code) {
      const code = data.code.trim().toUpperCase().replace(/\s/g, '');
      const duplicate = await this.prisma.academicClass.findFirst({
        where: { tenantId, academicYearId: existing.academicYearId, code },
      });
      if (duplicate) throw new BadRequestException(`Le code "${data.code}" est déjà utilisé.`);
    }
    const updateData: Record<string, unknown> = { ...data };
    if (data.code) (updateData as { code: string }).code = data.code.trim().toUpperCase().replace(/\s/g, '');
    return this.prisma.academicClass.update({
      where: { id },
      data: updateData,
      include: {
        level: true,
        cycle: true,
        room: true,
        mainTeacher: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getClassOrThrow(id: string, tenantId: string) {
    const cls = await this.prisma.academicClass.findFirst({
      where: { id, tenantId },
      include: { level: true, cycle: true, room: true, mainTeacher: true },
    });
    if (!cls) throw new NotFoundException('Classe non trouvée.');
    return cls;
  }

  async deactivateClass(id: string, tenantId: string) {
    return this.updateClass(id, tenantId, { isActive: false });
  }
}
