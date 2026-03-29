/**
 * ACADEMIC STRUCTURE PRISMA SERVICE - MODULE 2
 * Structure académique : Niveaux → Cycles → Classes (par année scolaire).
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface DuplicateStructureResult {
  fromAcademicYearId: string;
  toAcademicYearId: string;
  levelsCopied: number;
  cyclesCopied: number;
  classesCopied: number;
  seriesCopied: number;
  seriesSubjectsCopied: number;
}

/**
 * Niveaux Paramètres (education_levels.name) → libellés Module 2 (pedagogy_academic_levels.name).
 * Doit rester aligné avec EducationStructureService (MATERNELLE, PRIMAIRE, SECONDAIRE).
 */
const EDUCATION_CODE_TO_PEDAGOGY: Record<string, { name: string; orderIndex: number }> = {
  MATERNELLE: { name: 'Maternelle', orderIndex: 0 },
  PRIMAIRE: { name: 'Primaire', orderIndex: 1 },
  SECONDAIRE: { name: 'Secondaire', orderIndex: 2 },
};

@Injectable()
export class AcademicStructurePrismaService {
  private readonly logger = new Logger(AcademicStructurePrismaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recopie l’activation des niveaux depuis Paramètres (EducationLevel.isEnabled)
   * vers les niveaux pédagogiques de l’année (AcademicLevel.isActive).
   * Idempotent — appelée à chaque lecture des niveaux.
   */
  private async syncAcademicLevelsFromEducationSettings(
    tenantId: string,
    academicYearId: string,
  ): Promise<void> {
    try {
      const eduLevels = await this.prisma.educationLevel.findMany({
        where: { tenantId },
        orderBy: { order: 'asc' },
      });
      if (eduLevels.length === 0) return;

      const year = await this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
      });
      if (!year) return;

      await this.prisma.$transaction(async (tx) => {
        for (const el of eduLevels) {
          const mapped = EDUCATION_CODE_TO_PEDAGOGY[el.name];
          if (!mapped) continue;

          const existing = await tx.academicLevel.findFirst({
            where: {
              tenantId,
              academicYearId,
              name: mapped.name,
            },
          });

          if (existing) {
            await tx.academicLevel.update({
              where: { id: existing.id },
              data: {
                isActive: el.isEnabled,
                orderIndex: mapped.orderIndex,
              },
            });
          } else {
            await tx.academicLevel.create({
              data: {
                tenantId,
                academicYearId,
                name: mapped.name,
                orderIndex: mapped.orderIndex,
                isActive: el.isEnabled,
              },
            });
          }
        }

        const activeCount = await tx.academicLevel.count({
          where: { tenantId, academicYearId, isActive: true },
        });
        if (activeCount === 0) {
          const first = await tx.academicLevel.findFirst({
            where: { tenantId, academicYearId },
            orderBy: { orderIndex: 'asc' },
          });
          if (first) {
            await tx.academicLevel.update({
              where: { id: first.id },
              data: { isActive: true },
            });
          }
        }
      });
    } catch (e) {
      this.logger.warn(
        `syncAcademicLevelsFromEducationSettings: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async findAllLevels(tenantId: string, academicYearId: string) {
    await this.syncAcademicLevelsFromEducationSettings(tenantId, academicYearId);
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

  /**
   * Copie la structure pédagogique (niveaux, cycles, classes, séries, matières par série)
   * d'une année source vers une année cible. Les salles et responsables de classe ne sont pas recopiés.
   */
  async duplicateStructure(
    tenantId: string,
    fromAcademicYearId: string,
    toAcademicYearId: string,
    userId?: string | null,
  ): Promise<DuplicateStructureResult> {
    if (fromAcademicYearId === toAcademicYearId) {
      throw new BadRequestException("L'année source et l'année cible doivent être différentes.");
    }

    const [fromYear, toYear] = await Promise.all([
      this.prisma.academicYear.findFirst({ where: { id: fromAcademicYearId, tenantId } }),
      this.prisma.academicYear.findFirst({ where: { id: toAcademicYearId, tenantId } }),
    ]);
    if (!fromYear) {
      throw new NotFoundException('Année source introuvable pour ce tenant.');
    }
    if (!toYear) {
      throw new NotFoundException('Année cible introuvable pour ce tenant.');
    }

    const existingTargetLevels = await this.prisma.academicLevel.count({
      where: { tenantId, academicYearId: toAcademicYearId },
    });
    if (existingTargetLevels > 0) {
      throw new BadRequestException(
        "L'année cible contient déjà une structure pédagogique. Supprimez ou videz-la avant duplication.",
      );
    }

    const sourceLevels = await this.prisma.academicLevel.findMany({
      where: { tenantId, academicYearId: fromAcademicYearId },
      orderBy: { orderIndex: 'asc' },
    });
    if (sourceLevels.length === 0) {
      throw new BadRequestException("L'année source ne contient aucun niveau à copier.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const levelMap = new Map<string, string>();
      for (const l of sourceLevels) {
        const created = await tx.academicLevel.create({
          data: {
            tenantId,
            academicYearId: toAcademicYearId,
            name: l.name,
            orderIndex: l.orderIndex,
            isActive: l.isActive,
          },
        });
        levelMap.set(l.id, created.id);
      }

      const sourceCycles = await tx.academicCycle.findMany({
        where: { tenantId, academicYearId: fromAcademicYearId },
        orderBy: { orderIndex: 'asc' },
      });
      const cycleMap = new Map<string, string>();
      for (const c of sourceCycles) {
        const newLevelId = levelMap.get(c.levelId);
        if (!newLevelId) {
          throw new BadRequestException(
            `Cycle "${c.name}" : niveau source introuvable (données incohérentes).`,
          );
        }
        const created = await tx.academicCycle.create({
          data: {
            tenantId,
            academicYearId: toAcademicYearId,
            levelId: newLevelId,
            name: c.name,
            orderIndex: c.orderIndex,
            isActive: c.isActive,
          },
        });
        cycleMap.set(c.id, created.id);
      }

      const sourceSeries = await tx.academicSeries.findMany({
        where: { tenantId, academicYearId: fromAcademicYearId },
        orderBy: { name: 'asc' },
      });
      const seriesMap = new Map<string, string>();
      for (const s of sourceSeries) {
        const newLevelId = levelMap.get(s.levelId);
        if (!newLevelId) {
          throw new BadRequestException(
            `Série "${s.name}" : niveau source introuvable (données incohérentes).`,
          );
        }
        const created = await tx.academicSeries.create({
          data: {
            tenantId,
            academicYearId: toAcademicYearId,
            levelId: newLevelId,
            name: s.name,
            description: s.description,
            isActive: s.isActive,
          },
        });
        seriesMap.set(s.id, created.id);
      }

      const sourceSeriesSubjects = await tx.seriesSubject.findMany({
        where: { tenantId, academicYearId: fromAcademicYearId },
      });
      let seriesSubjectsCopied = 0;
      for (const ss of sourceSeriesSubjects) {
        const newSeriesId = seriesMap.get(ss.seriesId);
        if (!newSeriesId) continue;
        await tx.seriesSubject.create({
          data: {
            tenantId,
            academicYearId: toAcademicYearId,
            seriesId: newSeriesId,
            subjectId: ss.subjectId,
            coefficient: ss.coefficient,
            weeklyHours: ss.weeklyHours,
          },
        });
        seriesSubjectsCopied += 1;
      }

      const sourceClasses = await tx.academicClass.findMany({
        where: { tenantId, academicYearId: fromAcademicYearId },
        orderBy: [{ cycle: { orderIndex: 'asc' } }, { name: 'asc' }],
      });
      for (const cl of sourceClasses) {
        const newLevelId = levelMap.get(cl.levelId);
        const newCycleId = cycleMap.get(cl.cycleId);
        if (!newLevelId || !newCycleId) {
          throw new BadRequestException(
            `Classe "${cl.name}" : niveau ou cycle source introuvable (données incohérentes).`,
          );
        }
        await tx.academicClass.create({
          data: {
            tenantId,
            academicYearId: toAcademicYearId,
            levelId: newLevelId,
            cycleId: newCycleId,
            name: cl.name,
            code: cl.code,
            capacity: cl.capacity,
            roomId: null,
            mainTeacherId: null,
            languageTrack: cl.languageTrack,
            isActive: cl.isActive,
          },
        });
      }

      return {
        levelsCopied: sourceLevels.length,
        cyclesCopied: sourceCycles.length,
        classesCopied: sourceClasses.length,
        seriesCopied: sourceSeries.length,
        seriesSubjectsCopied,
      };
    });

    await this.syncAcademicLevelsFromEducationSettings(tenantId, toAcademicYearId);

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: userId ?? null,
          action: 'DUPLICATE',
          resource: 'pedagogy/academic-structure',
          resourceId: toAcademicYearId,
          tableName: 'pedagogy_structure_duplicate',
          recordId: toAcademicYearId,
          changes: {
            fromAcademicYearId,
            toAcademicYearId,
            ...result,
          },
        },
      });
    } catch (e) {
      this.logger.warn(
        `Audit log duplicate structure failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return {
      fromAcademicYearId,
      toAcademicYearId,
      ...result,
    };
  }
}
