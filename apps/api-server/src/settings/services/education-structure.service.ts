import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Structure pédagogique hiérarchique :
 * Tenant → Niveau (MATERNELLE, PRIMAIRE, SECONDAIRE) → Cycle → Grade (classe pédagogique) → Classroom (classe physique, par année)
 */

const DEFAULT_LEVELS: { name: string; order: number }[] = [
  { name: 'MATERNELLE', order: 1 },
  { name: 'PRIMAIRE', order: 2 },
  { name: 'SECONDAIRE', order: 3 },
];

/** Séries du 2nd cycle secondaire (Bénin). */
const DEFAULT_SERIES = [
  { code: 'A1', name: 'Série A1', order: 1 },
  { code: 'A2', name: 'Série A2', order: 2 },
  { code: 'B', name: 'Série B', order: 3 },
  { code: 'C', name: 'Série C', order: 4 },
  { code: 'D', name: 'Série D', order: 5 },
] as const;

/** Aligné plateforme nationale Bénin Educmaster : Maternelle 1 et Maternelle 2 (au lieu de PS, MS, GS). */
const DEFAULT_CYCLES_AND_GRADES: Record<
  string,
  { cycles: { name: string; order: number; grades: { name: string; code: string; order: number; seriesCode?: string }[] }[] }
> = {
  MATERNELLE: {
    cycles: [
      { name: 'Maternelle 1', order: 1, grades: [{ name: 'Maternelle 1', code: 'MAT1', order: 1 }] },
      { name: 'Maternelle 2', order: 2, grades: [{ name: 'Maternelle 2', code: 'MAT2', order: 1 }] },
    ],
  },
  PRIMAIRE: {
    cycles: [
      { name: 'CI', order: 1, grades: [{ name: 'CI', code: 'CI', order: 1 }] },
      { name: 'CP', order: 2, grades: [{ name: 'CP', code: 'CP', order: 1 }] },
      { name: 'CE1', order: 3, grades: [{ name: 'CE1', code: 'CE1', order: 1 }] },
      { name: 'CE2', order: 4, grades: [{ name: 'CE2', code: 'CE2', order: 1 }] },
      { name: 'CM1', order: 5, grades: [{ name: 'CM1', code: 'CM1', order: 1 }] },
      { name: 'CM2', order: 6, grades: [{ name: 'CM2', code: 'CM2', order: 1 }] },
    ],
  },
  SECONDAIRE: {
    cycles: [
      {
        name: '1er cycle',
        order: 1,
        grades: [
          { name: '6ème', code: '6EME', order: 1 },
          { name: '5ème', code: '5EME', order: 2 },
          { name: '4ème', code: '4EME', order: 3 },
          { name: '3ème', code: '3EME', order: 4 },
        ],
      },
      // 2nd cycle : chaque grade est lié à une série (EducationSeries). Les classes physiques peuvent avoir un suffixe (ex. Terminale C 1).
      {
        name: '2nd cycle',
        order: 2,
        grades: [
          { name: '2nde A1', code: '2NDE_A1', order: 1, seriesCode: 'A1' },
          { name: '2nde A2', code: '2NDE_A2', order: 2, seriesCode: 'A2' },
          { name: '2nde B', code: '2NDE_B', order: 3, seriesCode: 'B' },
          { name: '2nde C', code: '2NDE_C', order: 4, seriesCode: 'C' },
          { name: '2nde D', code: '2NDE_D', order: 5, seriesCode: 'D' },
          { name: '1ère A1', code: '1ERE_A1', order: 6, seriesCode: 'A1' },
          { name: '1ère A2', code: '1ERE_A2', order: 7, seriesCode: 'A2' },
          { name: '1ère B', code: '1ERE_B', order: 8, seriesCode: 'B' },
          { name: '1ère C', code: '1ERE_C', order: 9, seriesCode: 'C' },
          { name: '1ère D', code: '1ERE_D', order: 10, seriesCode: 'D' },
          { name: 'Terminale A1', code: 'TLE_A1', order: 11, seriesCode: 'A1' },
          { name: 'Terminale A2', code: 'TLE_A2', order: 12, seriesCode: 'A2' },
          { name: 'Terminale B', code: 'TLE_B', order: 13, seriesCode: 'B' },
          { name: 'Terminale C', code: 'TLE_C', order: 14, seriesCode: 'C' },
          { name: 'Terminale D', code: 'TLE_D', order: 15, seriesCode: 'D' },
        ],
      },
    ],
  },
};

@Injectable()
export class EducationStructureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Initialise la structure par défaut (niveaux + cycles + grades) pour un tenant.
   * Synchronise avec settings_pedagogical_structure (maternelleEnabled, etc.).
   */
  async initializeDefaultStructure(tenantId: string) {
    const settings = await this.prisma.settingsPedagogicalStructure.findUnique({
      where: { tenantId },
    });
    const maternelleEnabled = settings?.maternelleEnabled ?? false;
    const primaireEnabled = settings?.primaireEnabled ?? true;
    const secondaireEnabled = settings?.secondaireEnabled ?? true;

    for (const { name, order } of DEFAULT_LEVELS) {
      const isEnabled =
        name === 'MATERNELLE' ? maternelleEnabled : name === 'PRIMAIRE' ? primaireEnabled : secondaireEnabled;
      await this.prisma.educationLevel.upsert({
        where: { tenantId_name: { tenantId, name } },
        create: { tenantId, name, isEnabled, order },
        update: { isEnabled, order },
      });
    }

    const levels = await this.prisma.educationLevel.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
    });

    // Créer les séries par défaut (2nd cycle secondaire) pour ce tenant
    for (const s of DEFAULT_SERIES) {
      await this.prisma.educationSeries.upsert({
        where: { tenantId_code: { tenantId, code: s.code } },
        create: { tenantId, code: s.code, name: s.name, order: s.order },
        update: { name: s.name, order: s.order },
      });
    }

    const seriesByCode = await this.prisma.educationSeries.findMany({
      where: { tenantId },
    }).then((list) => new Map(list.map((s) => [s.code, s.id])));

    for (const level of levels) {
      const config = DEFAULT_CYCLES_AND_GRADES[level.name];
      if (!config) continue;
      for (const cy of config.cycles) {
        let cycle = await this.prisma.educationCycle.findFirst({
          where: { levelId: level.id, name: cy.name },
        });
        if (!cycle) {
          cycle = await this.prisma.educationCycle.create({
            data: { levelId: level.id, name: cy.name, order: cy.order },
          });
        } else {
          await this.prisma.educationCycle.update({
            where: { id: cycle.id },
            data: { order: cy.order },
          });
        }
        for (const gr of cy.grades) {
          const seriesId = gr.seriesCode ? seriesByCode.get(gr.seriesCode) ?? null : null;
          const existingGrade = await this.prisma.educationGrade.findFirst({
            where: { cycleId: cycle.id, code: gr.code },
          });
          if (!existingGrade) {
            await this.prisma.educationGrade.create({
              data: {
                cycleId: cycle.id,
                seriesId: seriesId ?? undefined,
                name: gr.name,
                code: gr.code,
                order: gr.order,
              },
            });
          } else {
            await this.prisma.educationGrade.update({
              where: { id: existingGrade.id },
              data: { name: gr.name, order: gr.order, seriesId: seriesId ?? undefined },
            });
          }
        }
      }
    }

    return this.getStructure(tenantId);
  }

  /**
   * Arbre complet : niveaux (avec isEnabled) → cycles → grades. Pas les classes physiques (par année).
   */
  async getStructure(tenantId: string) {
    await this.ensureStructureExists(tenantId);
    const levels = await this.prisma.educationLevel.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
      include: {
        cycles: {
          orderBy: { order: 'asc' },
          include: {
            grades: {
              orderBy: { order: 'asc' },
              include: { series: true },
            },
          },
        },
      },
    });
    return { levels };
  }

  private async ensureStructureExists(tenantId: string) {
    const count = await this.prisma.educationLevel.count({ where: { tenantId } });
    if (count === 0) await this.initializeDefaultStructure(tenantId);
  }

  /**
   * Liste des classes physiques pour une année scolaire.
   */
  async getClassrooms(tenantId: string, academicYearId: string) {
    const list = await this.prisma.classroom.findMany({
      where: { tenantId, academicYearId, isArchived: false },
      include: {
        grade: {
          include: {
            cycle: { include: { level: true } },
            series: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return list;
  }

  /**
   * Créer une classe physique (ex. CE1 A) pour une année.
   */
  async createClassroom(
    tenantId: string,
    academicYearId: string,
    data: { gradeId: string; name: string; code?: string; capacity?: number },
  ) {
    const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, tenantId } });
    if (!year) throw new NotFoundException('Année scolaire non trouvée.');
    const grade = await this.prisma.educationGrade.findFirst({
      where: { id: data.gradeId },
      include: { cycle: { include: { level: true } }, series: true },
    });
    if (!grade || grade.cycle.level.tenantId !== tenantId)
      throw new NotFoundException('Classe pédagogique (grade) non trouvée.');

    const name = (data.name || '').trim() || `${grade.name} A`;
    const code = (data.code || '').trim() || name.replace(/\s+/g, '_').toUpperCase();

    return this.prisma.classroom.create({
      data: {
        tenantId,
        academicYearId,
        gradeId: data.gradeId,
        name,
        code: code || null,
        capacity: data.capacity ?? null,
        isActive: true,
        isArchived: false,
      },
      include: {
        grade: { include: { cycle: { include: { level: true } }, series: true } },
      },
    });
  }

  /**
   * Mise à jour d'une classe physique (nom, code, capacité, isActive, gradeId pour changer la série).
   */
  async updateClassroom(
    tenantId: string,
    id: string,
    data: { name?: string; code?: string; capacity?: number; isActive?: boolean; gradeId?: string },
  ) {
    const existing = await this.prisma.classroom.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Classe non trouvée.');
    if (data.gradeId !== undefined) {
      const grade = await this.prisma.educationGrade.findFirst({
        where: { id: data.gradeId },
        include: { cycle: { include: { level: true } } },
      });
      if (!grade || grade.cycle.level.tenantId !== tenantId)
        throw new NotFoundException('Classe pédagogique (grade) non trouvée.');
    }
    return this.prisma.classroom.update({
      where: { id, tenantId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.code !== undefined && { code: data.code.trim() || null }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.gradeId !== undefined && { gradeId: data.gradeId }),
      },
      include: {
        grade: { include: { cycle: { include: { level: true } }, series: true } },
      },
    });
  }

  /**
   * Archiver une classe (pas de suppression physique).
   * Règle métier : une classe contenant des élèves ne peut être archivée — à appliquer quand ClassStudent sera lié à Classroom.
   */
  async archiveClassroom(tenantId: string, id: string) {
    const existing = await this.prisma.classroom.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Classe non trouvée.');
    // TODO: quand ClassStudent.classroomId existera : refuser si _count.classStudents > 0
    return this.prisma.classroom.update({
      where: { id, tenantId },
      data: { isArchived: true, isActive: false },
      include: {
        grade: { include: { cycle: { include: { level: true } }, series: true } },
      },
    });
  }

  /**
   * Dupliquer la structure des classes physiques d'une année vers une nouvelle (sans les élèves).
   */
  async duplicateStructureToNewYear(tenantId: string, oldAcademicYearId: string, newAcademicYearId: string) {
    const [oldYear, newYear] = await Promise.all([
      this.prisma.academicYear.findFirst({ where: { id: oldAcademicYearId, tenantId } }),
      this.prisma.academicYear.findFirst({ where: { id: newAcademicYearId, tenantId } }),
    ]);
    if (!oldYear || !newYear) throw new NotFoundException('Année scolaire non trouvée.');
    const classrooms = await this.prisma.classroom.findMany({
      where: { tenantId, academicYearId: oldAcademicYearId, isArchived: false },
    });
    const created = [];
    for (const c of classrooms) {
      const createdOne = await this.prisma.classroom.create({
        data: {
          tenantId,
          academicYearId: newAcademicYearId,
          gradeId: c.gradeId,
          name: c.name,
          code: c.code,
          capacity: c.capacity,
          isActive: true,
          isArchived: false,
        },
        include: {
          grade: { include: { cycle: { include: { level: true } }, series: true } },
        },
      });
      created.push(createdOne);
    }
    return { duplicated: created.length, classrooms: created };
  }

  /**
   * Activer/désactiver un niveau (MATERNELLE, PRIMAIRE, SECONDAIRE).
   */
  async setLevelEnabled(tenantId: string, levelId: string, isEnabled: boolean) {
    const level = await this.prisma.educationLevel.findFirst({ where: { id: levelId, tenantId } });
    if (!level) throw new NotFoundException('Niveau non trouvé.');
    return this.prisma.educationLevel.update({
      where: { id: levelId },
      data: { isEnabled },
    });
  }
}
