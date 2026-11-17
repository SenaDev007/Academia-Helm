import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
import { Injectable, BadRequestException, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BilingualStructureService } from '../../bilingual-structure/bilingual-structure.service';

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

/**
 * ⭐ Mapping EducationLevel.name → SchoolLevel.code.
 *    Les DEUX tables coexistent : education_levels (structure pédagogique,
 *    consommée par Settings → Structure et les sélecteurs de classes) et
 *    school_levels (niveaux « administratifs », consommés par AdminStructureService
 *    (unités administratives du module RH → onglet Administration), le
 *    SchoolLevelSelector de la topbar et les guards LevelScopeGuard).
 *    ⚠️ Sans synchronisation, activer « Secondaire » dans Settings → Structure
 *    n'active PAS school_levels → l'onglet Administration du module Personnel
 *    n'affiche que Maternelle(+Primaire) alors que le niveau est « activé ».
 *    Les noms anglais (piste EN bilingue : NURSERY/PRIMARY/SECONDARY) sont mappés
 *    vers les codes français canoniques de school_levels.
 */
const EDUCATION_NAME_TO_SCHOOL_CODE: Record<string, string> = {
  MATERNELLE: 'MATERNELLE',
  PRIMAIRE: 'PRIMAIRE',
  SECONDAIRE: 'SECONDAIRE',
  NURSERY: 'MATERNELLE',
  PRIMARY: 'PRIMAIRE',
  SECONDARY: 'SECONDAIRE',
};

/**
 * ⭐ `gradesDisabledByDefault` : les grades du cycle sont créés DÉSACTIVÉS par défaut.
 * Utilisé pour le « 2nd cycle » du SECONDAIRE : une école qui active le niveau
 * secondaire (souvent 1er cycle uniquement, ex. collège) ne doit pas voir les
 * 2nde/1ère/Terminale polluer tous les sélecteurs. L'école active ensuite
 * manuellement les classes/séries qu'elle propose réellement.
 */
const DEFAULT_CYCLES_AND_GRADES: Record<
  string,
  { cycles: { name: string; order: number; gradesDisabledByDefault?: boolean; grades: { name: string; code: string; order: number; seriesCode?: string }[] }[] }
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
        // ⭐ Grades du 2nd cycle créés désactivés par défaut (voir commentaire ci-dessus).
        gradesDisabledByDefault: true,
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
  private readonly logger = new Logger(EducationStructureService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BilingualStructureService))
    private readonly bilingualStructureService: BilingualStructureService,
  ) {}

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

      // ⭐ Sync school_levels.isActive (unités administratives RH + sélecteur de niveau)
      await this.syncSchoolLevelActive(tenantId, name, isEnabled);
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
          // ⭐ Grades du 2nd cycle SECONDAIRE : désactivés par défaut.
          //    (update path ci-dessous ne touche PAS isEnabled → choix explicite
          //    de l'école préservé lors d'une ré-initialisation idempotente)
          const gradeDefaultEnabled = cy.gradesDisabledByDefault !== true;
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
                isEnabled: gradeDefaultEnabled,
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
   *
   * ⭐ 2026-11-17 — UX SUPPRESSION : chaque classe est enrichie des compteurs
   * de blocage utilisés par deleteClassroom() (élèves inscrits sur la classe
   * officielle + sections physiques liées). L'UI « Paramètres > Structure >
   * Classes officielles » peut ainsi AFFICHER AVANT la tentative pourquoi une
   * classe ne peut pas être supprimée (au lieu d'un refus constaté après coup
   * dans un toast éphémère — perçu par l'école comme « la suppression ne
   * fonctionne pas »).
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

    // ⭐ Compteurs de blocage : mêmes règles que deleteClassroom() —
    // rapprochement de l'AcademicClass par (tenant, année, nom).
    const academicClasses = await this.prisma.academicClass.findMany({
      where: { tenantId, academicYearId },
      select: {
        id: true,
        name: true,
        _count: { select: { studentEnrollments: true, physicalClasses: true } },
      },
    });
    const academicClassesByName = new Map(academicClasses.map((ac) => [ac.name, ac]));

    return list.map((cr) => {
      const ac = academicClassesByName.get(cr.name);
      return {
        ...cr,
        /** Élèves inscrits sur la classe officielle correspondante (bloque la suppression si > 0). */
        linkedStudentEnrollmentsCount: ac?._count?.studentEnrollments ?? 0,
        /** Sections physiques (A/B/C…) rattachées à la classe officielle correspondante (bloque si > 0). */
        linkedSectionsCount: ac?._count?.physicalClasses ?? 0,
      };
    });
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

    const created = await this.prisma.classroom.create({
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

    // ⭐ Phase 2 — Auto-création du Classroom EN miroir si le mode bilingue est activé
    //    et que le grade FR est dans le scope (MATERNELLE+PRIMAIRE).
    //    Non-bloquant : si l'auto-création échoue, le Classroom FR reste créé.
    try {
      await this.bilingualStructureService.autoCreateEnClassroomForFrClassroom(tenantId, {
        id: created.id,
        gradeId: created.gradeId,
        name: created.name,
        code: created.code,
        capacity: created.capacity,
        academicYearId,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to auto-create EN classroom for ${created.name}: ${e.message}`);
    }

    return created;
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
   * Suppression définitive d'une classe officielle (Classroom).
   *
   * Cas d'usage : une école crée une classe officielle en début d'année puis
   * réalise qu'elle n'est finalement pas utilisée (pas d'élèves, pas de
   * section physique). Au lieu d'archiver (qui garde la classe visible dans
   * les listes), l'école peut la supprimer définitivement.
   *
   * Sécurités :
   *   1. Vérifie qu'aucune AcademicClass liée (par nom + année + tenant) n'a
   *      de StudentEnrollment actif — sinon refuse avec un message clair.
   *   2. Vérifie qu'aucune section physique (Class) n'est liée à cette classe
   *      officielle via AcademicClass — sinon refuse (l'utilisateur doit
   *      d'abord supprimer les sections).
   *   3. Désactive (sans supprimer) l'AcademicClass correspondante pour
   *      préserver l'historique pédagogique (matières, emplois du temps…).
   *
   * La suppression est irréversible.
   */
  async deleteClassroom(tenantId: string, id: string) {
    const classroom = await this.prisma.classroom.findFirst({
      where: { id, tenantId },
      include: {
        grade: { include: { cycle: { include: { level: true } }, series: true } },
      },
    });
    if (!classroom) {
      throw new NotFoundException('Classe officielle non trouvée.');
    }

    // 1. Chercher l'AcademicClass correspondante (par nom, tenant, année académique)
    const academicClass = await this.prisma.academicClass.findFirst({
      where: {
        tenantId,
        academicYearId: classroom.academicYearId,
        name: classroom.name,
      },
      include: {
        _count: {
          select: {
            studentEnrollments: true,
            physicalClasses: true,
          },
        },
      },
    });

    // 2. Sécurités : refuser si des élèves sont affectés à l'AcademicClass
    if (academicClass && (academicClass as any)._count?.studentEnrollments > 0) {
      throw new BadRequestException(
        `Impossible de supprimer la classe officielle « ${classroom.name} » : ` +
        `${(academicClass as any)._count.studentEnrollments} élève(s) y sont inscrits. ` +
        `Réaffectez ces élèves à une autre classe avant de la supprimer.`,
      );
    }

    // 3. Sécurité : refuser si des sections physiques existent
    if (academicClass && (academicClass as any)._count?.physicalClasses > 0) {
      throw new BadRequestException(
        `Impossible de supprimer la classe officielle « ${classroom.name} » : ` +
        `${(academicClass as any)._count.physicalClasses} section(s) physique(s) y sont liées. ` +
        `Supprimez d'abord ces sections dans l'onglet « Sections par classe » avant de supprimer la classe officielle.`,
      );
    }

    // 4. Supprimer le Classroom
    await this.prisma.classroom.delete({ where: { id, tenantId } });

    // 5. Désactiver l'AcademicClass correspondante (sans la supprimer pour
    // préserver l'historique pédagogique — matières, bulletins passés…)
    if (academicClass) {
      await this.prisma.academicClass.update({
        where: { id: academicClass.id },
        data: { isActive: false },
      }).catch((err) => {
        // Non bloquant : si l'update échoue pour quelque raison que ce soit,
        // on log mais on ne fait pas échouer la suppression du Classroom.
        this.logger.warn(
          `Impossible de désactiver l'AcademicClass ${academicClass.id} après suppression du Classroom ${id}: ${err.message}`,
        );
      });
    }

    this.logger.log(
      `Classroom ${id} (« ${classroom.name} ») supprimé définitivement par le tenant ${tenantId}.` +
      (academicClass ? ` AcademicClass ${academicClass.id} désactivée.` : ''),
    );

    return {
      success: true,
      message: `Classe officielle « ${classroom.name} » supprimée définitivement.`,
      classroomName: classroom.name,
    };
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
   *
   * ⭐ SECONDAIRE + activation : les grades du « 2nd cycle » (2nde, 1ère, Terminale)
   *    sont remis à DÉSACTIVÉ par défaut — même comportement qu'à l'initialisation.
   *    Une école (ex. collège 1er cycle) qui active le niveau secondaire ne doit
   *    pas voir les 33 classes du 2nd cycle apparaître activées d'office dans
   *    tous les sélecteurs ; elle active manuellement celles qu'elle propose.
   *
   *    Garde-fou : les grades du 2nd cycle qui ont déjà des classes physiques
   *    (non archivées) restent activés — l'école les utilise réellement.
   */
  async setLevelEnabled(tenantId: string, levelId: string, isEnabled: boolean) {
    const level = await this.prisma.educationLevel.findFirst({ where: { id: levelId, tenantId } });
    if (!level) throw new NotFoundException('Niveau non trouvé.');

    const updated = await this.prisma.educationLevel.update({
      where: { id: levelId },
      data: { ...prismaUpdateDefaults(), isEnabled },
    });

    // ⭐ Synchroniser school_levels.isActive (source des unités administratives
    //    du module RH → onglet Administration, du SchoolLevelSelector et des
    //    guards). Sans cette synchro, le niveau « activé » dans les paramètres
    //    n'apparaît pas dans l'onglet Administration du module Personnel.
    await this.syncSchoolLevelActive(tenantId, level.name, isEnabled);

    // ⭐ Transition OFF → ON du niveau SECONDAIRE : reset des grades 2nd cycle.
    if (level.name === 'SECONDAIRE' && isEnabled && !level.isEnabled) {
      try {
        await this.resetSecondCycleGradesToDefault(tenantId, levelId);
      } catch (e) {
        // Non-bloquant : l'activation du niveau prime sur le reset.
        this.logger.warn(
          `setLevelEnabled: reset 2nd cycle échoué (non-bloquant) — ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return updated;
  }

  /**
   * ⭐ Synchronise school_levels.isActive depuis un EducationLevel.
   *
   * education_levels (Settings → Structure) et school_levels (niveaux
   * administratifs) sont DEUX tables distinctes consommées par des modules
   * différents. Historiquement seule education_levels était mise à jour par
   * le toggle des paramètres → l'onglet Administration du module Personnel
   * (qui lit school_levels via AdminStructureService) n'affichait pas le
   * niveau activé. Cette synchro corrige la divergence à la source.
   *
   * Non-bloquante : une erreur ici n'empêche jamais le toggle principal.
   */
  private async syncSchoolLevelActive(tenantId: string, educationLevelName: string, isEnabled: boolean) {
    const code = EDUCATION_NAME_TO_SCHOOL_CODE[educationLevelName?.trim()?.toUpperCase?.() ?? ''];
    if (!code) return; // Niveau pédagogique sans équivalent administratif (ex: piste EN dupliquée)
    try {
      const res = await this.prisma.schoolLevel.updateMany({
        where: { tenantId, code },
        data: { isActive: isEnabled },
      });
      if (res.count > 0) {
        this.logger.log(
          `Sync school_levels: ${code}.isActive=${isEnabled} (${res.count} ligne(s)) — niveau « ${educationLevelName} » du tenant ${tenantId}`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `syncSchoolLevelActive(${tenantId}, ${educationLevelName}, ${isEnabled}) échoué (non-bloquant) — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * Remet les grades du « 2nd cycle » SECONDAIRE à l'état par défaut (désactivés),
   * sauf ceux ayant des classes physiques non archivées (réellement utilisés).
   * Propage ensuite la désactivation vers AcademicClass.isActive (effet immédiat
   * dans les sélecteurs, sans attendre la sync du prochain findAllClasses).
   */
  private async resetSecondCycleGradesToDefault(tenantId: string, levelId: string) {
    const secondCycle = await this.prisma.educationCycle.findFirst({
      where: { levelId, name: '2nd cycle' },
      select: { id: true },
    });
    if (!secondCycle) return;

    // Grades du 2nd cycle actuellement activés
    const enabledGrades = await this.prisma.educationGrade.findMany({
      where: { cycleId: secondCycle.id, isEnabled: true },
      select: { id: true, code: true, name: true },
    });
    if (enabledGrades.length === 0) return;

    // Garde-fou : exclure les grades liés à des classes physiques non archivées
    const usedGradeIds = new Set(
      (
        await this.prisma.classroom.findMany({
          where: { tenantId, gradeId: { in: enabledGrades.map((g) => g.id) }, isArchived: false },
          select: { gradeId: true },
          distinct: ['gradeId'],
        })
      ).map((c) => c.gradeId),
    );

    const toDisable = enabledGrades.filter((g) => !usedGradeIds.has(g.id));
    if (toDisable.length === 0) return;

    await this.prisma.educationGrade.updateMany({
      where: { id: { in: toDisable.map((g) => g.id) } },
      data: { ...prismaUpdateDefaults(), isEnabled: false },
    });
    this.logger.log(
      `Reset 2nd cycle → ${toDisable.length} grade(s) désactivé(s) par défaut : ${toDisable.map((g) => g.code).join(', ')}`,
    );

    // Propagation immédiate vers AcademicClass (toutes années du tenant)
    for (const g of toDisable) {
      const code = g.code?.trim();
      if (!code) continue;
      try {
        const res = await this.prisma.academicClass.updateMany({
          where: { tenantId, code },
          data: { ...prismaUpdateDefaults(), isActive: false },
        });
        if (res.count > 0) {
          this.logger.log(`AcademicClass (code=${code}) → isActive=false (${res.count} mise(s) à jour).`);
        }
      } catch {
        // Non-bloquant : la sync auto au prochain findAllClasses corrigera.
      }
    }
  }

  /**
   * ⭐ Activer/désactiver individuellement une classe pédagogique (EducationGrade).
   *    Permet à l'école de n'activer que les classes réellement disponibles
   *    au niveau Secondaire (ex: activer 6e+5e mais pas 2nde si pas de 2nd cycle).
   *
   *    Vérifie que le grade appartient bien au tenant (via cycle → level → tenantId).
   *
   *    Après la mise à jour, on déclenche une re-sync des AcademicClass pour
   *    propager immédiatement isEnabled vers AcademicClass.isActive (afin que
   *    les sélecteurs de classe dans tous les modules excluent la classe
   *    désactivée sans attendre le prochain findAllClasses).
   */
  async setGradeEnabled(tenantId: string, gradeId: string, isEnabled: boolean) {
    const grade = await this.prisma.educationGrade.findFirst({
      where: { id: gradeId },
      include: { cycle: { include: { level: true } } },
    });
    if (!grade) {
      throw new NotFoundException('Classe pédagogique non trouvée.');
    }
    // Vérifier que le grade appartient bien au tenant
    if (grade.cycle?.level?.tenantId !== tenantId) {
      throw new NotFoundException('Classe pédagogique non trouvée dans ce tenant.');
    }

    const updated = await this.prisma.educationGrade.update({
      where: { id: gradeId },
      data: { ...prismaUpdateDefaults(), isEnabled },
    });

    this.logger.log(
      `Grade ${grade.code} (${grade.name}) ${isEnabled ? 'activé' : 'désactivé'} pour tenant ${tenantId}`,
    );

    // ⭐ Re-sync immédiate : propager isEnabled vers AcademicClass.isActive
    //    pour TOUTES les années scolaires actives du tenant. Sans ça, les
    //    sélecteurs continueraient à afficher la classe désactivée jusqu'au
    //    prochain appel findAllClasses (qui sync), ce qui peut prêter à
    //    confusion pour l'utilisateur qui vient juste de toggler.
    try {
      const codeNormalized = grade.code?.trim();
      if (codeNormalized) {
        // La sync complète (syncAcademicClassesFromEducationSettings) est
        // déclenchée automatiquement au prochain findAllClasses. Ici on fait
        // une invalidation ciblée : on met à jour directement les AcademicClass
        // dont le code correspond au grade toggle, pour effet immédiat.
        const result = await this.prisma.academicClass.updateMany({
          where: { tenantId, code: codeNormalized },
          data: { ...prismaUpdateDefaults(), isActive: isEnabled },
        });
        this.logger.log(
          `AcademicClass (code=${codeNormalized}) → isActive=${isEnabled} synchronisé (${result.count} classe(s) mise(s) à jour).`,
        );
      }
    } catch (syncErr) {
      // Non-bloquant : la sync auto au prochain findAllClasses corrigera de toute façon
      this.logger.warn(
        `setGradeEnabled: sync AcademicClass échouée (non-bloquant) — ${syncErr instanceof Error ? syncErr.message : String(syncErr)}`,
      );
    }

    return updated;
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
          // ⭐ 2nd cycle : grades créés désactivés par défaut — l'école les
          //    active manuellement dans la section « Structure pédagogique ».
          isEnabled: false,
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
