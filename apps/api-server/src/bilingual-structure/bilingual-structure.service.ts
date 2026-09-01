import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults } from '../common/utils/prisma-helpers';

/**
 * ============================================================================
 * BilingualStructureService — Auto-création de la structure pédagogique EN
 * ============================================================================
 *
 * ⭐ BUT : Quand le mode bilingue est activé dans Settings → Bilingue, on
 *    crée automatiquement la structure pédagogique EN correspondante à la
 *    structure FR existante. Pareil quand l'utilisateur crée manuellement
 *    une nouvelle classe FR — l'équivalent EN est créé à la volée.
 *
 * ⭐ MAPPING FR → EN (conforme au système éducatif anglophone nigérian/béninois):
 *
 *    Classes (Grades) :
 *      Maternelle 1 → Nursery 1     (code MAT1 → NUR1)
 *      Maternelle 2 → Nursery 2     (code MAT2 → NUR2)
 *      CI           → Primary 1     (code CI   → P1)
 *      CP           → Primary 2     (code CP   → P2)
 *      CE1          → Primary 3     (code CE1  → P3)
 *      CE2          → Primary 4     (code CE2  → P4)
 *      CM1          → Primary 5     (code CM1  → P5)
 *      CM2          → Primary 6     (code CM2  → P6)
 *
 *    Niveaux :
 *      MATERNELLE → NURSERY
 *      PRIMAIRE   → PRIMARY
 *      (SECONDAIRE laissé pour plus tard — hors scope de cette V1)
 *
 * ⭐ AUCUNE duplication des élèves. Les élèves restent inscrits dans les
 *    sections FR. Les sections EN sont des miroirs vides (le teacher y
 *    saisit ses planifications/cahiers journal pour la piste EN, mais
 *    les effectifs restent comptabilisés dans la section FR).
 *
 * ⭐ OPÉRATIONS IDEMPOTENTES : si la structure EN existe déjà, on ne recrée
 *    pas. On peut appeler seedEnglishStructureForTenant() plusieurs fois.
 *
 * ⭐ AUCUNE OPÉRATION SUR LE SECONDAIRE dans cette V1. L'utilisateur a
 *    explicitement demandé de laisser le secondaire de côté pour l'instant.
 * ============================================================================
 */

@Injectable()
export class BilingualStructureService {
  private readonly logger = new Logger(BilingualStructureService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Mapping FR → EN (constantes)
  // ─────────────────────────────────────────────────────────────────────────

  /** Mapping code de grade FR → (nom EN, code EN). Seulement MATERNELLE + PRIMAIRE. */
  private static readonly GRADE_FR_TO_EN: Record<string, { name: string; code: string }> = {
    MAT1: { name: 'Nursery 1', code: 'NUR1' },
    MAT2: { name: 'Nursery 2', code: 'NUR2' },
    CI:   { name: 'Primary 1', code: 'P1' },
    CP:   { name: 'Primary 2', code: 'P2' },
    CE1:  { name: 'Primary 3', code: 'P3' },
    CE2:  { name: 'Primary 4', code: 'P4' },
    CM1:  { name: 'Primary 5', code: 'P5' },
    CM2:  { name: 'Primary 6', code: 'P6' },
  };

  /** Mapping inverse code EN → code FR (pour retrouver la classe FR jumelle). */
  private static readonly GRADE_EN_TO_FR: Record<string, string> = Object.entries(
    BilingualStructureService.GRADE_FR_TO_EN,
  ).reduce((acc, [frCode, en]) => {
    acc[en.code] = frCode;
    return acc;
  }, {} as Record<string, string>);

  /** Mapping nom de niveau FR → EN. */
  private static readonly LEVEL_FR_TO_EN: Record<string, string> = {
    MATERNELLE: 'NURSERY',
    PRIMAIRE: 'PRIMARY',
  };

  /** Mapping nom de cycle FR → EN (les cycles correspondent 1:1 aux grades pour MATERNELLE+PRIMAIRE). */
  private static readonly CYCLE_FR_TO_EN: Record<string, string> = {
    'Maternelle 1': 'Nursery 1',
    'Maternelle 2': 'Nursery 2',
    CI: 'Primary 1',
    CP: 'Primary 2',
    CE1: 'Primary 3',
    CE2: 'Primary 4',
    CM1: 'Primary 5',
    CM2: 'Primary 6',
  };

  /**
   * Traduit un nom de classe FR en nom EN.
   * Ex: "Sil CP A" → "Sil Primary 2 A"
   *     "CE1 B" → "Primary 3 B"
   *     "Maternelle 1" → "Nursery 1"
   *     "CM2 A" → "Primary 6 A"
   * Si la classe ne contient pas un code de niveau reconnu, on retourne le nom tel quel.
   */
  static translateClassNameFrToEn(frName: string): string {
    if (!frName) return '';
    let enName = frName;
    // Remplacer par ordre de longueur décroissante pour éviter les conflits
    // (ex: "CM1" avant "CM2" pour ne pas matcher "CM" puis "1")
    const orderedKeys = ['Maternelle 1', 'Maternelle 2', 'CM1', 'CM2', 'CE1', 'CE2', 'CP', 'CI'];
    for (const frKey of orderedKeys) {
      const en = BilingualStructureService.CYCLE_FR_TO_EN[frKey];
      if (en && enName.includes(frKey)) {
        // Remplacement global, case-sensitive (les noms officiels sont en majuscules ou title case)
        enName = enName.split(frKey).join(en);
        break; // Un seul remplacement par nom (le premier match gagne)
      }
    }
    return enName;
  }

  /**
   * Traduit un code de classe FR en code EN.
   * Ex: "CI" → "P1", "MAT1" → "NUR1", "CE1_A" → "P3_A"
   * Si le code ne correspond à aucun grade FR reconnu, retourne le code tel quel.
   */
  static translateClassCodeFrToEn(frCode: string): string {
    if (!frCode) return '';
    // Chercher un match exact d'abord
    if (BilingualStructureService.GRADE_FR_TO_EN[frCode]) {
      return BilingualStructureService.GRADE_FR_TO_EN[frCode].code;
    }
    // Chercher un match avec préfixe (ex: "CE1_A" → on cherche "CE1")
    for (const [frGrade, en] of Object.entries(BilingualStructureService.GRADE_FR_TO_EN)) {
      if (frCode.startsWith(frGrade)) {
        return frCode.replace(frGrade, en.code);
      }
    }
    return frCode;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 1 — Seed de la structure EN complète (appelé à l'activation bilingue)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * ⭐ Méthode principale — appelée quand le mode bilingue est activé.
   *    Crée l'ensemble de la structure EN miroir pour le tenant.
   *
   * Étapes (idempotentes — ne recrée pas ce qui existe déjà) :
   *   1. EducationLevel EN (NURSERY, PRIMARY)
   *   2. EducationCycle EN (Nursery 1, Nursery 2, Primary 1-6)
   *   3. EducationGrade EN (NUR1, NUR2, P1-P6)
   *   4. Classroom EN (pour chaque FR Classroom avec un grade dans le scope)
   *   5. AcademicLevel EN (NURSERY, PRIMARY)
   *   6. AcademicCycle EN (Nursery 1, Nursery 2, Primary 1-6)
   *   7. AcademicClass EN (languageTrack='EN', code P1-P6/NUR1-NUR2)
   *
   * ⚠️ Ne crée PAS :
   *   - Les sections physiques (Class) — créées à la volée par l'utilisateur
   *   - Les élèves (les élèves restent inscrits en section FR — ils sont reconnus
   *     automatiquement dans la section EN jumelle via le système de piste)
   *   - Les TeacherClassAssignment — l'utilisateur assigne les teachers manuellement
   *   - Les Subjects EN — les matières anglophones sont SPÉCIFIQUES à la piste EN
   *     et créées manuellement par l'admin (elles ne sont PAS des traductions des
   *     matières FR). Ne PAS créer de matières EN automatiquement.
   *   - Les ClassSubject EN — liés aux matières EN créées manuellement par l'admin.
   */
  async seedEnglishStructureForTenant(tenantId: string): Promise<{
    educationLevelsCreated: number;
    educationCyclesCreated: number;
    educationGradesCreated: number;
    classroomsCreated: number;
    academicLevelsCreated: number;
    academicCyclesCreated: number;
    academicClassesCreated: number;
    skipped: number;
  }> {
    this.logger.log(`[BilingualStructure] Seeding EN structure for tenant ${tenantId}`);

    const stats = {
      educationLevelsCreated: 0,
      educationCyclesCreated: 0,
      educationGradesCreated: 0,
      classroomsCreated: 0,
      academicLevelsCreated: 0,
      academicCyclesCreated: 0,
      academicClassesCreated: 0,
      skipped: 0,
    };

    // ─── Étape 1-3 : EducationLevel + EducationCycle + EducationGrade EN ───
    for (const [frLevelName, enLevelName] of Object.entries(BilingualStructureService.LEVEL_FR_TO_EN)) {
      const frLevel = await this.prisma.educationLevel.findFirst({
        where: { tenantId, name: frLevelName },
        include: { cycles: { include: { grades: true } } },
      });
      if (!frLevel) {
        this.logger.debug(`[BilingualStructure] FR level ${frLevelName} not found — skipping`);
        continue;
      }

      // 1. Créer ou récupérer le niveau EN
      let enLevel = await this.prisma.educationLevel.findFirst({
        where: { tenantId, name: enLevelName },
      });
      if (!enLevel) {
        enLevel = await this.prisma.educationLevel.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            name: enLevelName,
            order: frLevel.order,
            isActive: true,
          },
        });
        stats.educationLevelsCreated++;
        this.logger.debug(`[BilingualStructure] Created EducationLevel EN: ${enLevelName}`);
      }

      // 2-3. Pour chaque cycle FR, créer le cycle EN + son grade EN
      for (const frCycle of frLevel.cycles) {
        const enCycleName = BilingualStructureService.CYCLE_FR_TO_EN[frCycle.name];
        if (!enCycleName) {
          stats.skipped++;
          continue;
        }

        let enCycle = await this.prisma.educationCycle.findFirst({
          where: { tenantId, levelId: enLevel.id, name: enCycleName },
        });
        if (!enCycle) {
          enCycle = await this.prisma.educationCycle.create({
            data: {
              ...prismaCreateDefaults(),
              tenantId,
              levelId: enLevel.id,
              name: enCycleName,
              order: frCycle.order,
              isActive: true,
            },
          });
          stats.educationCyclesCreated++;
        }

        for (const frGrade of frCycle.grades) {
          const enGradeInfo = BilingualStructureService.GRADE_FR_TO_EN[frGrade.code];
          if (!enGradeInfo) {
            stats.skipped++;
            continue;
          }
          const existingEnGrade = await this.prisma.educationGrade.findFirst({
            where: { tenantId, code: enGradeInfo.code },
          });
          if (existingEnGrade) continue;
          await this.prisma.educationGrade.create({
            data: {
              ...prismaCreateDefaults(),
              tenantId,
              cycleId: enCycle.id,
              name: enGradeInfo.name,
              code: enGradeInfo.code,
              order: frGrade.order,
              isActive: true,
            },
          });
          stats.educationGradesCreated++;
        }
      }
    }

    // ─── Étape 4 : Classroom EN — pour chaque FR Classroom dans le scope ───
    const academicYears = await this.prisma.academicYear.findMany({
      where: { tenantId },
      select: { id: true },
    });

    for (const year of academicYears) {
      const frClassrooms = await this.prisma.classroom.findMany({
        where: {
          tenantId,
          academicYearId: year.id,
          isArchived: false,
          grade: { code: { in: Object.keys(BilingualStructureService.GRADE_FR_TO_EN) } },
        },
        include: { grade: true },
      });

      for (const frClassroom of frClassrooms) {
        const enGradeInfo = BilingualStructureService.GRADE_FR_TO_EN[frClassroom.grade.code];
        if (!enGradeInfo) continue;

        const enGrade = await this.prisma.educationGrade.findFirst({
          where: { tenantId, code: enGradeInfo.code },
        });
        if (!enGrade) continue;

        const enName = BilingualStructureService.translateClassNameFrToEn(frClassroom.name);
        const enCode = BilingualStructureService.translateClassCodeFrToEn(frClassroom.code || frClassroom.name);

        const existing = await this.prisma.classroom.findFirst({
          where: { tenantId, academicYearId: year.id, name: enName },
        });
        if (existing) continue;

        await this.prisma.classroom.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            academicYearId: year.id,
            gradeId: enGrade.id,
            name: enName,
            code: enCode,
            capacity: frClassroom.capacity,
            isActive: true,
            isArchived: false,
          },
        });
        stats.classroomsCreated++;
      }
    }

    // ─── Étape 5-7 : AcademicLevel + AcademicCycle + AcademicClass EN ───
    for (const year of academicYears) {
      const frAcademicLevels = await this.prisma.academicLevel.findMany({
        where: { tenantId, academicYearId: year.id },
        include: {
          cycles: {
            include: {
              classes: true,
            },
          },
        },
      });

      for (const frAcademicLevel of frAcademicLevels) {
        const enLevelName = BilingualStructureService.LEVEL_FR_TO_EN[frAcademicLevel.name];
        if (!enLevelName) continue;

        // 5. Créer AcademicLevel EN
        let enAcademicLevel = await this.prisma.academicLevel.findFirst({
          where: { tenantId, academicYearId: year.id, name: enLevelName },
        });
        if (!enAcademicLevel) {
          enAcademicLevel = await this.prisma.academicLevel.create({
            data: {
              ...prismaCreateDefaults(),
              tenantId,
              academicYearId: year.id,
              name: enLevelName,
              code: enLevelName,
              order: frAcademicLevel.order,
              isActive: true,
            },
          });
          stats.academicLevelsCreated++;
        }

        // 6-7. Pour chaque cycle FR, créer l'AcademicCycle EN + AcademicClass EN
        for (const frAcademicCycle of frAcademicLevel.cycles) {
          const enCycleName = BilingualStructureService.CYCLE_FR_TO_EN[frAcademicCycle.name];
          if (!enCycleName) continue;

          let enAcademicCycle = await this.prisma.academicCycle.findFirst({
            where: { tenantId, academicYearId: year.id, levelId: enAcademicLevel.id, name: enCycleName },
          });
          if (!enAcademicCycle) {
            enAcademicCycle = await this.prisma.academicCycle.create({
              data: {
                ...prismaCreateDefaults(),
                tenantId,
                academicYearId: year.id,
                levelId: enAcademicLevel.id,
                name: enCycleName,
                code: BilingualStructureService.translateClassCodeFrToEn(frAcademicCycle.code || frAcademicCycle.name),
                order: frAcademicCycle.order,
                isActive: true,
              },
            });
            stats.academicCyclesCreated++;
          }

          // Pour chaque AcademicClass FR, créer l'AcademicClass EN
          for (const frAcademicClass of frAcademicCycle.classes) {
            const frGradeCode = frAcademicClass.code?.split('_')[0] || frAcademicClass.code;
            const enGradeInfo = BilingualStructureService.GRADE_FR_TO_EN[frGradeCode];
            if (!enGradeInfo) continue;

            const enClassName = BilingualStructureService.translateClassNameFrToEn(frAcademicClass.name);
            const enClassCode = BilingualStructureService.translateClassCodeFrToEn(frAcademicClass.code);

            const existing = await this.prisma.academicClass.findFirst({
              where: { tenantId, academicYearId: year.id, code: enClassCode },
            });
            if (existing) continue;

            await this.prisma.academicClass.create({
              data: {
                ...prismaCreateDefaults(),
                tenantId,
                academicYearId: year.id,
                levelId: enAcademicLevel.id,
                cycleId: enAcademicCycle.id,
                name: enClassName,
                code: enClassCode,
                capacity: frAcademicClass.capacity,
                languageTrack: 'EN',
                isActive: true,
              },
            });
            stats.academicClassesCreated++;
          }
        }
      }
    }

    // ⭐ NOTE : On ne crée PAS automatiquement les Subjects EN ni les ClassSubject EN.
    //    Les matières anglophones sont SPÉCIFIQUES à la piste EN et sont créées
    //    manuellement par l'admin dans le module Pédagogie (section Matières).
    //    Elles ne sont PAS des traductions des matières FR.
    //    Une fois les matières EN créées manuellement, l'admin peut les lier aux
    //    AcademicClass EN via l'interface de gestion des matières.

    this.logger.log(
      `[BilingualStructure] Seed complete for tenant ${tenantId}: ` +
      `${stats.educationLevelsCreated} levels, ${stats.educationCyclesCreated} cycles, ` +
      `${stats.educationGradesCreated} grades, ${stats.classroomsCreated} classrooms, ` +
      `${stats.academicLevelsCreated} academic levels, ${stats.academicCyclesCreated} academic cycles, ` +
      `${stats.academicClassesCreated} academic classes, ` +
      `${stats.skipped} skipped (out of scope)`,
    );

    return stats;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 2 — Auto-création à la volée
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * À appeler APRÈS création d'un Classroom FR (dans education-structure.service.ts → createClassroom).
   * Crée le Classroom EN miroir si le grade FR est dans le scope (MATERNELLE+PRIMAIRE).
   */
  async autoCreateEnClassroomForFrClassroom(
    tenantId: string,
    frClassroom: { id: string; gradeId: string; name: string; code: string | null; capacity: number | null; academicYearId: string },
  ): Promise<{ id: string; name: string; code: string | null } | null> {
    const bilingualEnabled = await this.isBilingualEnabled(tenantId);
    if (!bilingualEnabled) return null;

    const frGrade = await this.prisma.educationGrade.findUnique({
      where: { id: frClassroom.gradeId },
      include: { cycle: { include: { level: true } } },
    });
    if (!frGrade) return null;

    const enGradeInfo = BilingualStructureService.GRADE_FR_TO_EN[frGrade.code];
    if (!enGradeInfo) return null;

    const enGrade = await this.prisma.educationGrade.findFirst({
      where: { tenantId, code: enGradeInfo.code },
    });
    if (!enGrade) {
      this.logger.warn(`[BilingualStructure] EN grade ${enGradeInfo.code} not found — run seedEnglishStructureForTenant first`);
      return null;
    }

    const enName = BilingualStructureService.translateClassNameFrToEn(frClassroom.name);
    const enCode = BilingualStructureService.translateClassCodeFrToEn(frClassroom.code || frClassroom.name);

    const existing = await this.prisma.classroom.findFirst({
      where: { tenantId, academicYearId: frClassroom.academicYearId, name: enName },
    });
    if (existing) return existing;

    const enClassroom = await this.prisma.classroom.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        academicYearId: frClassroom.academicYearId,
        gradeId: enGrade.id,
        name: enName,
        code: enCode,
        capacity: frClassroom.capacity,
        isActive: true,
        isArchived: false,
      },
    });
    this.logger.log(`[BilingualStructure] Auto-created EN Classroom ${enName} for FR ${frClassroom.name}`);
    return enClassroom;
  }

  /**
   * À appeler APRÈS création d'une AcademicClass FR.
   * Crée l'AcademicClass EN miroir si elle est dans le scope.
   */
  async autoCreateEnAcademicClassForFrAcademicClass(
    tenantId: string,
    frAcademicClass: { id: string; levelId: string; cycleId: string; name: string; code: string; capacity: number | null; academicYearId: string },
  ): Promise<{ id: string; name: string; code: string } | null> {
    const bilingualEnabled = await this.isBilingualEnabled(tenantId);
    if (!bilingualEnabled) return null;

    const frLevel = await this.prisma.academicLevel.findUnique({
      where: { id: frAcademicClass.levelId },
    });
    if (!frLevel) return null;
    const enLevelName = BilingualStructureService.LEVEL_FR_TO_EN[frLevel.name];
    if (!enLevelName) return null;

    const frCycle = await this.prisma.academicCycle.findUnique({
      where: { id: frAcademicClass.cycleId },
    });
    if (!frCycle) return null;
    const enCycleName = BilingualStructureService.CYCLE_FR_TO_EN[frCycle.name];
    if (!enCycleName) return null;

    const enAcademicLevel = await this.prisma.academicLevel.findFirst({
      where: { tenantId, academicYearId: frAcademicClass.academicYearId, name: enLevelName },
    });
    if (!enAcademicLevel) return null;

    const enAcademicCycle = await this.prisma.academicCycle.findFirst({
      where: { tenantId, academicYearId: frAcademicClass.academicYearId, levelId: enAcademicLevel.id, name: enCycleName },
    });
    if (!enAcademicCycle) return null;

    const enClassName = BilingualStructureService.translateClassNameFrToEn(frAcademicClass.name);
    const enClassCode = BilingualStructureService.translateClassCodeFrToEn(frAcademicClass.code);

    const existing = await this.prisma.academicClass.findFirst({
      where: { tenantId, academicYearId: frAcademicClass.academicYearId, code: enClassCode },
    });
    if (existing) return existing;

    const enAcademicClass = await this.prisma.academicClass.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        academicYearId: frAcademicClass.academicYearId,
        levelId: enAcademicLevel.id,
        cycleId: enAcademicCycle.id,
        name: enClassName,
        code: enClassCode,
        capacity: frAcademicClass.capacity,
        languageTrack: 'EN',
        isActive: true,
      },
    });
    this.logger.log(`[BilingualStructure] Auto-created EN AcademicClass ${enClassName} for FR ${frAcademicClass.name}`);
    return enAcademicClass;
  }

  /**
   * À appeler APRÈS création d'une section physique FR (Class).
   * Crée la section EN miroir si l'AcademicClass FR est dans le scope.
   *
   * ⚠️ NE duplique PAS les élèves. La section EN est vide.
   */
  async autoCreateEnSectionForFrSection(
    tenantId: string,
    frSection: { id: string; name: string; code: string; officialClassId: string | null; schoolLevelId: string; academicYearId: string; capacity: number | null },
  ): Promise<{ id: string; name: string; code: string } | null> {
    const bilingualEnabled = await this.isBilingualEnabled(tenantId);
    if (!bilingualEnabled) return null;

    if (!frSection.officialClassId) return null;

    const frAcademicClass = await this.prisma.academicClass.findFirst({
      where: { id: frSection.officialClassId, tenantId },
    });
    if (!frAcademicClass) return null;

    const frGradeCode = frAcademicClass.code?.split('_')[0] || frAcademicClass.code;
    const enGradeInfo = BilingualStructureService.GRADE_FR_TO_EN[frGradeCode];
    if (!enGradeInfo) return null;

    const enClassCode = BilingualStructureService.translateClassCodeFrToEn(frAcademicClass.code);
    const enAcademicClass = await this.prisma.academicClass.findFirst({
      where: { tenantId, academicYearId: frSection.academicYearId, code: enClassCode },
    });
    if (!enAcademicClass) return null;

    const enTrack = await this.prisma.academicTrack.findFirst({
      where: { tenantId, code: 'EN' },
    });

    const enName = BilingualStructureService.translateClassNameFrToEn(frSection.name);
    const enCode = BilingualStructureService.translateClassCodeFrToEn(frSection.code);

    const existing = await this.prisma.class.findFirst({
      where: { tenantId, academicYearId: frSection.academicYearId, code: enCode, language: 'EN' },
    });
    if (existing) return existing;

    const enSection = await this.prisma.class.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        academicYearId: frSection.academicYearId,
        schoolLevelId: frSection.schoolLevelId,
        academicTrackId: enTrack?.id || null,
        officialClassId: enAcademicClass.id,
        language: 'EN',
        name: enName,
        code: enCode,
        capacity: frSection.capacity,
      },
    });
    this.logger.log(`[BilingualStructure] Auto-created EN section ${enName} for FR ${frSection.name}`);
    return enSection;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper — vérifier si le mode bilingue est activé
  // ─────────────────────────────────────────────────────────────────────────

  private async isBilingualEnabled(tenantId: string): Promise<boolean> {
    const settings = await this.prisma.settingsBilingual.findUnique({
      where: { tenantId },
      select: { isEnabled: true },
    });
    return !!settings?.isEnabled;
  }
}
