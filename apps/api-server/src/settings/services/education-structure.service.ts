import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
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

/** Séries du 2nd cycle secondaire (Bénin).
 *  Inclut les séries classiques (A1, A2, B, C, D) + séries techniques
 *  (G1, G2 — génie civil/bâtiment ; F1, F2, F3, F4 — industriel).
 *  L'utilisateur peut ajouter/supprimer des séries via l'UI Settings. */
const DEFAULT_SERIES = [
  { code: 'A1', name: 'Série A1', order: 1 },
  { code: 'A2', name: 'Série A2', order: 2 },
  { code: 'B', name: 'Série B', order: 3 },
  { code: 'C', name: 'Série C', order: 4 },
  { code: 'D', name: 'Série D', order: 5 },
  { code: 'G1', name: 'Série G1 (Génie Civil)', order: 6 },
  { code: 'G2', name: 'Série G2 (Bâtiment)', order: 7 },
  { code: 'F1', name: 'Série F1 (Électrotechnique)', order: 8 },
  { code: 'F2', name: 'Série F2 (Mécanique)', order: 9 },
  { code: 'F3', name: 'Série F3 (Électronique)', order: 10 },
  { code: 'F4', name: 'Série F4 (Maintenance)', order: 11 },
] as const;

/** Noms des 3 grades du 2nd cycle (2nde, 1ère, Terminale).
 *  Utilisé pour auto-créer les 3 grades quand on ajoute une nouvelle série. */
const SECOND_CYCLE_GRADE_TEMPLATES = [
  { namePrefix: '2nde', codePrefix: '2NDE' },
  { namePrefix: '1ère', codePrefix: '1ERE' },
  { namePrefix: 'Terminale', codePrefix: 'TLE' },
];

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
      // 2nd cycle : chaque grade est lié à une série (EducationSeries).
      // Les grades sont générés dynamiquement à partir de DEFAULT_SERIES
      // (3 grades par série : 2nde X, 1ère X, Terminale X).
      // Cela permet d'avoir toutes les séries (A1, A2, B, C, D, G1, G2, F1-F4)
      // et toute série ajoutée manuellement via createSeries().
      {
        name: '2nd cycle',
        order: 2,
        grades: DEFAULT_SERIES.flatMap((series, seriesIdx) =>
          SECOND_CYCLE_GRADE_TEMPLATES.map((tpl, tplIdx) => ({
            name: `${tpl.namePrefix} ${series.code}`,
            code: `${tpl.codePrefix}_${series.code}`,
            // Ordre : 2nde A1 (1), 2nde A2 (2), ..., 2nde F4 (11),
            //          1ère A1 (12), 1ère A2 (13), ..., 1ère F4 (22),
            //          Terminale A1 (23), ..., Terminale F4 (33)
            order: seriesIdx + 1 + tplIdx * DEFAULT_SERIES.length,
            seriesCode: series.code,
          })),
        ),
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
        create: { ...prismaCreateDefaults(), tenantId, name, isEnabled, order },
        update: { ...prismaUpdateDefaults(), isEnabled, order },
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
        create: { ...prismaCreateDefaults(), tenantId, code: s.code, name: s.name, order: s.order },
        update: { ...prismaUpdateDefaults(), name: s.name, order: s.order },
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
            data: { ...prismaCreateDefaults(), levelId: level.id, name: cy.name, order: cy.order },
          });
        } else {
          await this.prisma.educationCycle.update({
            where: { id: cycle.id },
            data: { ...prismaUpdateDefaults(), order: cy.order },
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
        ...prismaCreateDefaults(),
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
              data: { ...prismaUpdateDefaults(), name: gr.name, order: gr.order, seriesId: seriesId ?? undefined },
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
   * Le nom doit être unique par (tenant, année) — voir @@unique sur Classroom.
   * Si le nom proposé existe déjà, on suffixe " (2)", " (3)", …
   */
  private async allocateUniqueClassroomName(
    tenantId: string,
    academicYearId: string,
    baseName: string,
  ): Promise<string> {
    let candidate = baseName;
    let n = 2;
    for (;;) {
      const clash = await this.prisma.classroom.findFirst({
        where: { tenantId, academicYearId, name: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      candidate = `${baseName} (${n})`;
      n += 1;
    }
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

    const rawName = (data.name || '').trim() || `${grade.name} A`;
    const name = await this.allocateUniqueClassroomName(tenantId, academicYearId, rawName);
    const code = (data.code || '').trim() || name.replace(/\s+/g, '_').toUpperCase();

    return this.prisma.classroom.create({
      data: {
        ...prismaCreateDefaults(),
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
        ...prismaUpdateDefaults(),
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
        ...prismaCreateDefaults(),
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
      data: { ...prismaUpdateDefaults(), isEnabled },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SÉRIES DU 2ND CYCLE SECONDAIRE — CRUD
  // ═══════════════════════════════════════════════════════════════════════
  //
  // Les séries (EducationSeries) sont des catalogues tenant-level (pas par année).
  // Elles sont liées aux grades (EducationGrade.seriesId) du 2nd cycle secondaire.
  //
  // Flux quand on ajoute une série :
  //   1. Crée la EducationSeries
  //   2. Auto-crée les 3 grades (2nde X, 1ère X, Terminale X) dans le cycle
  //      "2nd cycle" du niveau SECONDAIRE
  //   3. La sync auto (syncAcademicSeriesFromEducationSettings + syncAcademicClassesFromEducationSettings)
  //      propagera vers AcademicSeries + AcademicClass pour chaque année scolaire.
  //
  // Flux quand on supprime une série :
  //   1. Vérifie qu'aucune Classroom n'est liée aux grades de cette série
  //   2. Supprime les 3 grades (EducationGrade)
  //   3. Supprime la EducationSeries
  //   4. La sync auto nettoiera les AcademicSeries/AcademicClass orphelins
  //      (à condition qu'aucun StudentEnrollment ne soit lié).

  /**
   * Liste toutes les séries du 2nd cycle secondaire pour ce tenant.
   * Triées par `order` puis `code`.
   */
  async listSeries(tenantId: string) {
    return this.prisma.educationSeries.findMany({
      where: { tenantId },
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
    });
  }

  /**
   * Crée une nouvelle série + auto-crée les 3 grades (2nde X, 1ère X, Terminale X).
   *
   * @param tenantId - ID du tenant
   * @param data - { code, name?, order? }
   * @returns La série créée + les 3 grades créés
   */
  async createSeries(
    tenantId: string,
    data: { code: string; name?: string; order?: number },
  ) {
    const code = (data.code || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('Le code de la série est requis.');

    // Vérifier l'unicité du code
    const existing = await this.prisma.educationSeries.findFirst({
      where: { tenantId, code },
    });
    if (existing) {
      throw new BadRequestException(`Une série avec le code "${code}" existe déjà.`);
    }

    // Calculer l'order si non fourni (à la fin)
    const order =
      data.order ??
      (await this.prisma.educationSeries.count({ where: { tenantId } })) + 1;

    // 1. Créer la série
    const series = await this.prisma.educationSeries.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        code,
        name: data.name?.trim() || `Série ${code}`,
        order,
      },
    });

    // 2. Auto-créer les 3 grades (2nde X, 1ère X, Terminale X) dans le 2nd cycle
    //    du niveau SECONDAIRE
    const secondaryLevel = await this.prisma.educationLevel.findFirst({
      where: { tenantId, name: 'SECONDAIRE' },
    });
    if (!secondaryLevel) {
      // Si le niveau SECONDAIRE n'existe pas, on crée juste la série sans grades
      return { series, gradesCreated: [] };
    }

    const secondCycle = await this.prisma.educationCycle.findFirst({
      where: { levelId: secondaryLevel.id, name: '2nd cycle' },
    });
    if (!secondCycle) {
      return { series, gradesCreated: [] };
    }

    // Calculer l'ordre initial (à la suite des grades existants)
    const maxOrder = await this.prisma.educationGrade
      .findFirst({
        where: { cycleId: secondCycle.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      .then((g) => g?.order ?? 0);

    const gradesCreated = [];
    for (let i = 0; i < SECOND_CYCLE_GRADE_TEMPLATES.length; i++) {
      const tpl = SECOND_CYCLE_GRADE_TEMPLATES[i];
      const gradeName = `${tpl.namePrefix} ${code}`;
      const gradeCode = `${tpl.codePrefix}_${code}`;
      const gradeOrder = maxOrder + 1 + i;

      // Vérifier l'unicité du code dans ce cycle
      const existingGrade = await this.prisma.educationGrade.findFirst({
        where: { cycleId: secondCycle.id, code: gradeCode },
      });
      if (existingGrade) continue; // Déjà existe — skip

      const grade = await this.prisma.educationGrade.create({
        data: {
          ...prismaCreateDefaults(),
          cycleId: secondCycle.id,
          seriesId: series.id,
          name: gradeName,
          code: gradeCode,
          order: gradeOrder,
        },
      });
      gradesCreated.push(grade);
    }

    return { series, gradesCreated };
  }

  /**
   * Supprime une série + ses 3 grades (si aucune classe physique n'y est liée).
   *
   * @param tenantId - ID du tenant
   * @param seriesId - ID de la série à supprimer
   * @returns { success: true, gradesDeleted: number }
   */
  async deleteSeries(tenantId: string, seriesId: string) {
    const series = await this.prisma.educationSeries.findFirst({
      where: { id: seriesId, tenantId },
      include: { grades: { include: { classrooms: { select: { id: true } } } } },
    });
    if (!series) throw new NotFoundException('Série non trouvée.');

    // Vérifier qu'aucune classe physique n'est liée aux grades de cette série
    const classroomsCount = series.grades.reduce(
      (sum, g) => sum + g.classrooms.length,
      0,
    );
    if (classroomsCount > 0) {
      throw new BadRequestException(
        `Impossible de supprimer la série "${series.code}" : ${classroomsCount} classe(s) physique(s) y sont liées. ` +
          'Archivez ou supprimez ces classes d\'abord.',
      );
    }

    // Supprimer les grades
    const gradesDeleted = series.grades.length;
    if (gradesDeleted > 0) {
      await this.prisma.educationGrade.deleteMany({
        where: { seriesId: series.id },
      });
    }

    // Supprimer la série
    await this.prisma.educationSeries.delete({ where: { id: series.id } });

    return { success: true, gradesDeleted };
  }
}
