/**
 * ACADEMIC STRUCTURE PRISMA SERVICE - MODULE 2
 * Structure académique : Niveaux → Cycles → Classes (par année scolaire).
 */

import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';
import { randomUUID as cryptoRandomUUID } from 'crypto';
import { BilingualStructureService } from '../bilingual-structure/bilingual-structure.service';

export interface DuplicateStructureResult {
  fromAcademicYearId: string;
  toAcademicYearId: string;
  levelsCopied: number;
  cyclesCopied: number;
  classesCopied: number;
  seriesCopied: number;
  seriesSubjectsCopied: number;
  roomsCopied: number;
  subjectsCopied: number;
  profilesCopied: number;
  timetablesCopied: number;
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

/**
 * Ordre d’affichage global (tous niveaux) : Maternelle → Primaire → Secondaire (réf. Bénin / Educmaster).
 * Les `orderIndex` des cycles pédagogiques alignés sur les paramètres reprennent ces positions pour un tri unique.
 */
const CANONICAL_CYCLE_GLOBAL_ORDER: readonly string[] = [
  'maternelle 1',
  'maternelle 2',
  'ci',
  'cp',
  'ce1',
  'ce2',
  'cm1',
  'cm2',
  '1er cycle',
  '2nd cycle',
];

function normalizeCycleNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Index 0..9 pour l’ordre global, ou null si le libellé n’est pas reconnu comme cycle canonique. */
function globalOrderIndexForCanonicalCycleName(name: string): number | null {
  const key = normalizeCycleNameKey(name);
  const direct = CANONICAL_CYCLE_GLOBAL_ORDER.indexOf(key);
  if (direct >= 0) return direct;

  const compact = key.replace(/\s/g, '');
  const compactOrder = CANONICAL_CYCLE_GLOBAL_ORDER.map((c) => c.replace(/\s/g, ''));
  const ci = compactOrder.indexOf(compact);
  if (ci >= 0) return ci;

  if (compact === 'maternelle1' || key === 'mat1' || key === 'ps' || key === 'ms' || key.includes('petite section') || key.includes('moyenne section')) return 0;
  if (compact === 'maternelle2' || key === 'mat2' || key === 'gs' || key.includes('grande section')) return 1;
  if (key.includes('1er') && key.includes('cycle')) return 8;
  if (
    (key.includes('2nd') || key.includes('2eme') || key.includes('2ème')) &&
    key.includes('cycle')
  ) {
    return 9;
  }

  return null;
}

function normalizeCycleNameForProduction(name: string): string {
  const key = normalizeCycleNameKey(name);
  if (key === 'ps' || key === 'ms' || key.includes('petite section') || key.includes('moyenne section') || key === 'maternelle 1' || key === 'maternelle1') {
    return 'Maternelle 1';
  }
  if (key === 'gs' || key.includes('grande section') || key === 'maternelle 2' || key === 'maternelle2') {
    return 'Maternelle 2';
  }
  return name.trim();
}


/** Cycles hors liste canonique : placer après 0–9, par niveau puis ordre paramètres. */
function fallbackGlobalOrderIndexForCycle(
  educationLevelCode: string,
  intraLevelOrder: number,
): number {
  const levelOrder = EDUCATION_CODE_TO_PEDAGOGY[educationLevelCode]?.orderIndex ?? 0;
  return 100 + levelOrder * 20 + intraLevelOrder;
}

@Injectable()
export class AcademicStructurePrismaService {
  private readonly logger = new Logger(AcademicStructurePrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BilingualStructureService))
    private readonly bilingualStructureService: BilingualStructureService,
  ) {}

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
                ...prismaUpdateDefaults(),
                isActive: el.isEnabled,
                orderIndex: mapped.orderIndex,
              },
            });
          } else {
            await tx.academicLevel.create({
              data: {
                ...prismaCreateDefaults(),
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
              data: { ...prismaUpdateDefaults(), isActive: true },
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

  /**
   * Recopie les cycles depuis Paramètres (EducationCycle sous EducationLevel)
   * vers les cycles pédagogiques de l’année (AcademicCycle), alignés sur le niveau
   * Module 2 (Maternelle / Primaire / Secondaire).
   * Idempotent — appelée à chaque lecture des cycles.
   */
  private async syncAcademicCyclesFromEducationSettings(
    tenantId: string,
    academicYearId: string,
  ): Promise<void> {
    try {
      await this.syncAcademicLevelsFromEducationSettings(tenantId, academicYearId);

      const eduLevels = await this.prisma.educationLevel.findMany({
        where: { tenantId },
        include: { cycles: { orderBy: { order: 'asc' } } },
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

          const academicLevel = await tx.academicLevel.findFirst({
            where: {
              tenantId,
              academicYearId,
              name: mapped.name,
            },
          });
          if (!academicLevel) continue;

          for (const ec of el.cycles) {
            const normalizedName = normalizeCycleNameForProduction(ec.name);
            const existing = await tx.academicCycle.findFirst({
              where: {
                tenantId,
                academicYearId,
                levelId: academicLevel.id,
                name: normalizedName,
              },
            });
            const canonical = globalOrderIndexForCanonicalCycleName(normalizedName);
            const orderIndex =
              canonical !== null
                ? canonical
                : fallbackGlobalOrderIndexForCycle(el.name, ec.order);
            const cyclePayload = {
              name: normalizedName,
              orderIndex,
              isActive: el.isEnabled,
            };
            if (existing) {
              await tx.academicCycle.update({
                where: { id: existing.id },
                data: { ...prismaUpdateDefaults(), ...cyclePayload },
              });
            } else {
              await tx.academicCycle.create({
                data: {
                  ...prismaCreateDefaults(),
                  tenantId,
                  academicYearId,
                  levelId: academicLevel.id,
                  name: normalizedName,
                  orderIndex,
                  isActive: el.isEnabled,
                },
              });
            }
          }

        }

        const activeCount = await tx.academicCycle.count({
          where: { tenantId, academicYearId, isActive: true },
        });
        if (activeCount === 0) {
          const firstUnderActiveLevel = await tx.academicCycle.findFirst({
            where: {
              tenantId,
              academicYearId,
              level: { isActive: true },
            },
            orderBy: [{ level: { orderIndex: 'asc' } }, { orderIndex: 'asc' }],
          });
          if (firstUnderActiveLevel) {
            await tx.academicCycle.update({
              where: { id: firstUnderActiveLevel.id },
              data: { ...prismaUpdateDefaults(), isActive: true },
            });
          }
        }
      });
    } catch (e) {
      this.logger.warn(
        `syncAcademicCyclesFromEducationSettings: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /** Aligné sur `createClass` : code unique par année. */
  private normalizePedagogyClassCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s/g, '');
  }

  /**
   * Capacités : somme des capacités des classes physiques (paramètres → Classroom) pour ce grade et cette année.
   * Si aucune classe physique n’existe, on ne modifie pas la capacité existante en pédagogie (update).
   */
  private capacityFromEducationClassrooms(
    physicalClassrooms: { capacity: number | null }[],
  ): number | null | undefined {
    if (physicalClassrooms.length === 0) return undefined;
    if (physicalClassrooms.every((r) => r.capacity == null)) return null;
    return physicalClassrooms.reduce((s, r) => s + (r.capacity ?? 0), 0);
  }

  /**
   * Recopie les classes pédagogiques depuis Paramètres (EducationGrade sous EducationCycle)
   * vers AcademicClass (libellé + code + rattachement niveau/cycle + actif + capacité depuis les classes physiques).
   * Ne supprime pas les classes créées manuellement en pédagogie (codes absents des paramètres).
   * Idempotent — appelée à chaque lecture des classes.
   */
  private async syncAcademicClassesFromEducationSettings(
    tenantId: string,
    academicYearId: string,
  ): Promise<void> {
    try {
      await this.syncAcademicCyclesFromEducationSettings(tenantId, academicYearId);
      await this.syncAcademicSeriesFromEducationSettings(tenantId, academicYearId);

      const eduLevels = await this.prisma.educationLevel.findMany({
        where: { tenantId },
        include: {
          cycles: {
            orderBy: { order: 'asc' },
            include: {
              grades: {
                orderBy: { order: 'asc' },
                include: { series: true }
              },
            },
          },
        },
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

          const academicLevel = await tx.academicLevel.findFirst({
            where: {
              tenantId,
              academicYearId,
              name: mapped.name,
            },
          });
          if (!academicLevel) continue;

          for (const ec of el.cycles) {
            const academicCycle = await tx.academicCycle.findFirst({
              where: {
                tenantId,
                academicYearId,
                levelId: academicLevel.id,
                name: ec.name,
              },
            });
            if (!academicCycle) continue;

            for (const eg of ec.grades) {
              const code = this.normalizePedagogyClassCode(eg.code);
              if (!code) continue;

              const className = eg.name.trim();
              // ⭐ Propager isEnabled du EducationGrade vers AcademicClass.isActive.
              //    Un grade désactivé dans Paramètres > Structure (ex: 2nde A si la série A
              //    n'est pas ouverte) doit rendre l'AcademicClass inactive, pour qu'elle
              //    soit exclue de tous les sélecteurs (findAllClasses, /api/all-classes, etc.).
              const gradeEnabled = eg.isEnabled !== false;
              const isActive = el.isEnabled && gradeEnabled && academicCycle.isActive;

              const physicalClassrooms = await tx.classroom.findMany({
                where: {
                  tenantId,
                  academicYearId,
                  gradeId: eg.id,
                  isArchived: false,
                  isActive: true,
                },
                select: { capacity: true },
              });
              const capacitySync = this.capacityFromEducationClassrooms(physicalClassrooms);

              let seriesId: string | null = null;
              if (eg.seriesId && eg.series?.code) {
                const academicSeries = await tx.academicSeries.findFirst({
                  where: {
                    tenantId,
                    academicYearId,
                    levelId: academicLevel.id,
                    name: eg.series.code,
                  },
                });
                if (academicSeries) {
                  seriesId = academicSeries.id;
                }
              }

              const existing = await tx.academicClass.findFirst({
                where: { tenantId, academicYearId, code },
              });

              if (existing) {
                await tx.academicClass.update({
                  where: { id: existing.id },
                  data: {
                    ...prismaUpdateDefaults(),
                    levelId: academicLevel.id,
                    cycleId: academicCycle.id,
                    name: className,
                    isActive,
                    seriesId,
                    ...(capacitySync !== undefined ? { capacity: capacitySync } : {}),
                  },
                });
              } else {
                await tx.academicClass.create({
                  data: {
                    ...prismaCreateDefaults(),
                    tenantId,
                    academicYearId,
                    levelId: academicLevel.id,
                    cycleId: academicCycle.id,
                    name: className,
                    code,
                    isActive,
                    seriesId,
                    ...(capacitySync !== undefined ? { capacity: capacitySync } : {}),
                  },
                });
              }
            }
          }
        }
      });
    } catch (e) {
      this.logger.warn(
        `syncAcademicClassesFromEducationSettings: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private normalizeDefaultLanguageTrack(defaultLanguage: string | null | undefined): 'FR' | 'EN' {
    const u = (defaultLanguage ?? 'FR').trim().toUpperCase();
    return u === 'EN' ? 'EN' : 'FR';
  }

  /**
   * Aligne `languageTrack` (piste FR/EN) sur Paramètres → Option bilingue.
   * - Bilingue désactivé : toutes les classes → langue par défaut (souvent FR).
   * - Bilingue activé : seules les pistes vides reçoivent la langue par défaut.
   */
  private async syncAcademicClassLanguageTracksFromBilingualSettings(
    tenantId: string,
    academicYearId: string,
  ): Promise<void> {
    try {
      const settings = await this.prisma.settingsBilingual.findUnique({
        where: { tenantId },
      });
      if (!settings) return;

      const defaultLang = this.normalizeDefaultLanguageTrack(settings.defaultLanguage);
      const classes = await this.prisma.academicClass.findMany({
        where: { tenantId, academicYearId },
        select: { id: true, languageTrack: true },
      });
      if (classes.length === 0) return;

      await this.prisma.$transaction(async (tx) => {
        for (const c of classes) {
          const empty = c.languageTrack == null || String(c.languageTrack).trim() === '';
          if (!settings.isEnabled) {
            await tx.academicClass.update({
              where: { id: c.id },
              data: { ...prismaUpdateDefaults(), languageTrack: defaultLang },
            });
          } else if (empty) {
            await tx.academicClass.update({
              where: { id: c.id },
              data: { ...prismaUpdateDefaults(), languageTrack: defaultLang },
            });
          }
        }
      });
    } catch (e) {
      this.logger.warn(
        `syncAcademicClassLanguageTracksFromBilingualSettings: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * SYNCHRONISATION DES SECTIONS PHYSIQUES (table `classes` / modèle `Class`)
   * ─────────────────────────────────────────────────────────────────────────
   *
   * ARCHITECTURE 3 COUCHES (comprendre avant de modifier) :
   *
   *  1. Classroom (Paramètres > Structure > « Classe officielle par année »)
   *     ─ déclaration annuelle d'une classe par grade (ex : « CE1 » pour 2026-2027)
   *     ─ liée à EducationGrade via gradeId
   *
   *  2. AcademicClass (table pedagogy_academic_classes, sync auto depuis Classroom)
   *     ─ abstraction pédagogique utilisée par Matière & Programme, Emplois du temps
   *     ─ sync via syncAcademicClassesFromEducationSettings()
   *
   *  3. Class (table `classes`, subdivisions physiques A/B/C)
   *     ─ sections réelles : « CE1 A », « CE1 B », « CE1 C »
   *     ─ utilisée par Élèves, Bulletins, Affectation enseignants, etc.
   *     ─ officialClassId → AcademicClass.id (la classe officielle dont découle la section)
   *
   * Cette méthode assure que CHAQUE AcademicClass active ait au moins UNE section
   * Class correspondante. Si aucune section n'existe, on en crée une par défaut
   * (sans suffixe A/B) — cas des écoles avec une seule section par classe.
   *
   * Les écoles avec plusieurs sections (CE1 A, CE1 B) peuvent en ajouter via
   * l'UI « Sections par classe » dans Paramètres > Structure.
   */
  async syncClassSectionsFromAcademicClasses(
    tenantId: string,
    academicYearId: string,
  ): Promise<{ created: number; existing: number; synced: number }> {
    let created = 0;
    let existing = 0;
    let synced = 0;
    try {
      // ⚠️ ÉTAPE 1 : Synchroniser les Classroom → AcademicClass
      // Les Classroom créés via l'onglet Structure (settings) n'ont pas d'AcademicClass
      // correspondante. On les crée ici pour que la sync des sections fonctionne.
      const classrooms = await this.prisma.classroom.findMany({
        where: { tenantId, academicYearId, isActive: true, isArchived: false },
        include: { grade: { include: { cycle: { include: { level: true } }, series: true } } },
      });
      for (const cr of classrooms) {
        // Vérifier si une AcademicClass avec le même nom existe déjà
        const existingAC = await this.prisma.academicClass.findFirst({
          where: { tenantId, academicYearId, name: cr.name, isActive: true },
          select: { id: true },
        });
        if (existingAC) continue; // Déjà synchronisé

        const grade = cr.grade;
        const cycle = grade?.cycle;
        const level = cycle?.level;
        if (!level || !cycle) {
          this.logger.warn(`syncClassSections: Classroom ${cr.name} sans grade/cycle/level — ignoré.`);
          continue;
        }

        // Créer l'AcademicClass manquante
        await this.prisma.academicClass.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            academicYearId,
            levelId: level.id,
            cycleId: cycle.id,
            name: cr.name,
            code: cr.code || cr.name.replace(/\s/g, '').toUpperCase(),
            capacity: cr.capacity,
            isActive: true,
            ...(grade.seriesId ? { seriesId: grade.seriesId } : {}),
          },
        });
        synced++;
        this.logger.log(`syncClassSections: AcademicClass créée depuis Classroom: ${cr.name}`);
      }

      // ÉTAPE 2 : Synchroniser les sections depuis les AcademicClass
      // (y compris celles nouvellement créées depuis les Classroom)
      const academicClasses = await this.prisma.academicClass.findMany({
        where: { tenantId, academicYearId, isActive: true },
        include: {
          level: { select: { id: true, name: true } },
        },
      });
      if (academicClasses.length === 0) return { created, existing, synced };

      // Charger tous les SchoolLevels du tenant pour résoudre level.name → schoolLevelId
      // (ex : « Maternelle » → SchoolLevel.code='MATERNELLE')
      const schoolLevels = await this.prisma.schoolLevel.findMany({
        where: { tenantId },
        select: { id: true, code: true, name: true, label: true },
      });

      // Map : level.name normalisé → schoolLevel.id
      // On essaie plusieurs variantes : code exact, name exact, label exact,
      // puis matching partiel bidirectionnel (ex: « Secondaire » dans
      // « Secondaire 1er cycle » ou inverse).
      const resolveSchoolLevelId = (levelName: string): string | null => {
        const ln = (levelName || '').trim().toUpperCase();
        if (!ln) return null;
        // 1. Match exact sur code
        let sl = schoolLevels.find(s => (s.code || '').toUpperCase() === ln);
        if (sl) return sl.id;
        // 2. Match exact sur name
        sl = schoolLevels.find(s => (s.name || '').toUpperCase() === ln);
        if (sl) return sl.id;
        // 3. Match exact sur label
        sl = schoolLevels.find(s => (s.label || '').toUpperCase() === ln);
        if (sl) return sl.id;
        // 4. Match partiel : schoolLevel.code/name inclus dans level.name
        //    (ex: ln="SECONDAIRE 1ER CYCLE" contient sc="SECONDAIRE")
        sl = schoolLevels.find(s => {
          const sc = (s.code || '').toUpperCase();
          const sn = (s.name || '').toUpperCase();
          const slbl = (s.label || '').toUpperCase();
          return (sc && ln.includes(sc)) || (sn && ln.includes(sn)) || (slbl && ln.includes(slbl));
        });
        if (sl) return sl.id;
        // 5. Match partiel inverse : level.name inclus dans schoolLevel.code/name
        //    (ex: ln="PRIM" inclus dans sc="PRIMAIRE")
        sl = schoolLevels.find(s => {
          const sc = (s.code || '').toUpperCase();
          const sn = (s.name || '').toUpperCase();
          return (sc && sc.includes(ln)) || (sn && sn.includes(ln));
        });
        return sl?.id ?? null;
      };

      await this.prisma.$transaction(async (tx) => {
        for (const ac of academicClasses) {
          // Vérifier s'il existe déjà au moins une section pour cette AcademicClass
          const existingSection = await tx.class.findFirst({
            where: { tenantId, academicYearId, officialClassId: ac.id },
            select: { id: true },
          });
          if (existingSection) {
            existing++;
            continue;
          }

          // Résoudre schoolLevelId depuis level.name
          const schoolLevelId = resolveSchoolLevelId(ac.level?.name || '');
          if (!schoolLevelId) {
            this.logger.warn(
              `syncClassSections: impossible de résoudre schoolLevelId pour le niveau "${ac.level?.name}" (AcademicClass ${ac.code}). Section non créée.`,
            );
            continue;
          }

          // Créer une section par défaut (sans suffixe A/B)
          await tx.class.create({
            data: {
              ...prismaCreateDefaults(),
              tenantId,
              academicYearId,
              schoolLevelId,
              officialClassId: ac.id,
              name: ac.name,
              code: ac.code,
              capacity: ac.capacity,
              ...(ac.languageTrack ? { language: ac.languageTrack } : {}),
            },
          });
          created++;
        }
      });

      if (created > 0) {
        this.logger.log(
          `syncClassSections: ${created} section(s) créée(s), ${existing} existante(s) pour le tenant ${tenantId} / année ${academicYearId}.`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `syncClassSectionsFromAcademicClasses: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return { created, existing, synced };
  }

  /**
   * Crée manuellement une nouvelle section (subdivision A/B/C) rattachée à une AcademicClass.
   * Utilisé par l'UI « Sections par classe » dans Paramètres > Structure.
   */
  async createClassSection(data: {
    tenantId: string;
    academicYearId: string;
    academicClassId: string;
    name: string; // ex : « CE1 A »
    code: string; // ex : « CE1_A »
    capacity?: number;
    language?: string;
  }): Promise<any> {
    // Vérifier que l'AcademicClass existe et appartient au tenant
    let academicClass = await this.prisma.academicClass.findFirst({
      where: { id: data.academicClassId, tenantId: data.tenantId },
      include: { level: { select: { name: true } } },
    });

    // ⚠️ Fallback : si l'AcademicClass n'existe pas, chercher dans Classroom
    // (table `classrooms` créée par le settings controller via education/classrooms).
    // Les deux tables coexistent : AcademicClass (pedagogy) et Classroom (settings).
    // L'onglet Structure du module Paramètres crée des Classrooms, pas des AcademicClasses.
    if (!academicClass) {
      const classroom = await this.prisma.classroom.findFirst({
        where: { id: data.academicClassId, tenantId: data.tenantId },
        include: { grade: { include: { cycle: { include: { level: true } } } } },
      });
      if (classroom) {
        // Simuler la structure d'AcademicClass pour la suite du code
        academicClass = {
          id: classroom.id,
          tenantId: classroom.tenantId,
          academicYearId: classroom.academicYearId,
          name: classroom.name,
          code: classroom.code || classroom.name,
          level: classroom.grade?.cycle?.level || { name: 'PRIMAIRE' },
        } as any;
        this.logger?.log?.(`createClassSection: AcademicClass introuvable, fallback vers Classroom ${classroom.id} (${classroom.name})`);
      }
    }

    if (!academicClass) {
      throw new NotFoundException(`Classe officielle introuvable (id=${data.academicClassId}).`);
    }

    // Vérifier l'unicité du code de section pour cette année + tenant
    const existing = await this.prisma.class.findFirst({
      where: { tenantId: data.tenantId, academicYearId: data.academicYearId, code: data.code },
    });
    if (existing) {
      throw new BadRequestException(`Une section avec le code "${data.code}" existe déjà pour cette année.`);
    }

    // Résoudre schoolLevelId depuis level.name
    // (ex: AcademicLevel.name = "Maternelle" → SchoolLevel.code = "MATERNELLE")
    // Plusieurs stratégies : match exact code, match exact name, puis match
    // partiel bidirectionnel (ex: "Secondaire" dans "Secondaire 1er cycle").
    const schoolLevels = await this.prisma.schoolLevel.findMany({
      where: { tenantId: data.tenantId },
      select: { id: true, code: true, name: true, label: true },
    });
    const ln = (academicClass.level?.name || '').trim().toUpperCase();
    let schoolLevelId: string | null = null;
    if (ln && schoolLevels.length > 0) {
      // 1. Match exact sur code (ex: ln="MATERNELLE", sc="MATERNELLE")
      let sl = schoolLevels.find(s => (s.code || '').toUpperCase() === ln);
      if (!sl) {
        // 2. Match exact sur name
        sl = schoolLevels.find(s => (s.name || '').toUpperCase() === ln);
      }
      if (!sl) {
        // 3. Match exact sur label
        sl = schoolLevels.find(s => (s.label || '').toUpperCase() === ln);
      }
      if (!sl) {
        // 4. Match partiel : schoolLevel.code/name inclus dans level.name
        //    (ex: ln="SECONDAIRE 1ER CYCLE" contient sc="SECONDAIRE")
        sl = schoolLevels.find(s => {
          const sc = (s.code || '').toUpperCase();
          const sn = (s.name || '').toUpperCase();
          const slbl = (s.label || '').toUpperCase();
          return (sc && ln.includes(sc)) || (sn && ln.includes(sn)) || (slbl && ln.includes(slbl));
        });
      }
      if (!sl) {
        // 5. Match partiel inverse : level.name inclus dans schoolLevel.code/name
        //    (ex: ln="PRIM" inclus dans sc="PRIMAIRE" — utile pour abréviations)
        sl = schoolLevels.find(s => {
          const sc = (s.code || '').toUpperCase();
          const sn = (s.name || '').toUpperCase();
          return (sc && sc.includes(ln)) || (sn && sn.includes(ln));
        });
      }
      schoolLevelId = sl?.id ?? null;
    }
    if (!schoolLevelId) {
      throw new BadRequestException(
        `Impossible de résoudre le niveau scolaire pour "${academicClass.level?.name || '(inconnu)'}". ` +
        `Vérifiez la configuration des SchoolLevels (codes attendus : MATERNELLE, PRIMAIRE, SECONDAIRE). ` +
        `Niveaux disponibles : ${schoolLevels.map(s => s.code).join(', ') || '(aucun)'}.`,
      );
    }

    // ⚠️ Si l'academicClass vient d'un fallback Classroom, il faut créer
    // l'AcademicClass correspondante pour que la FK officialClassId fonctionne.
    // Si on ne peut pas créer l'AcademicClass (grade/cycle/level manquant),
    // on met officialClassId à null pour éviter la violation de FK.
    //
    // BUGFIX : Si l'AcademicClass existe déjà (créée par syncClassSections),
    // il faut utiliser SON id, pas le Classroom.id — sinon la FK officialClassId
    // fait référence à un Classroom.id qui n'est pas dans pedagogy_academic_classes
    // → P2003 "référence est valide, l'entité liée n'existe pas".
    let effectiveOfficialClassId: string | null = data.academicClassId;
    const existingAcademicClass = await this.prisma.academicClass.findFirst({
      where: { id: data.academicClassId, tenantId: data.tenantId },
      select: { id: true },
    });

    if (existingAcademicClass) {
      // L'ID fourni EST un AcademicClass.id — tout est bon.
      effectiveOfficialClassId = existingAcademicClass.id;
    } else {
      // L'ID vient d'un Classroom — il faut soit trouver l'AcademicClass
      // correspondante (déjà créée par sync), soit la créer.
      const classroom = await this.prisma.classroom.findFirst({
        where: { id: data.academicClassId, tenantId: data.tenantId },
        include: { grade: { include: { cycle: { include: { level: true } }, series: true } } },
      });

      if (classroom) {
        // 1. Chercher si une AcademicClass existe déjà pour ce Classroom
        // (par nom + tenantId + academicYearId — la sync crée avec ce mapping)
        const existingAc = await this.prisma.academicClass.findFirst({
          where: {
            tenantId: data.tenantId,
            academicYearId: data.academicYearId,
            name: classroom.name,
            isActive: true,
          },
          select: { id: true },
        });

        if (existingAc) {
          // L'AcademicClass existe déjà (créée par sync) — utiliser son id
          effectiveOfficialClassId = existingAc.id;
          this.logger?.log?.(`createClassSection: AcademicClass déjà existante pour Classroom ${classroom.name} → id=${existingAc.id}`);
        } else {
          // 2. Créer l'AcademicClass manquante
          const grade = classroom.grade;
          const cycle = grade?.cycle;
          const level = cycle?.level;
          if (level && cycle) {
            const newAcademicClass = await this.prisma.academicClass.create({
              data: {
                ...prismaCreateDefaults(),
                tenantId: data.tenantId,
                academicYearId: data.academicYearId,
                levelId: level.id,
                cycleId: cycle.id,
                name: classroom.name,
                code: classroom.code || classroom.name.replace(/\s/g, '').toUpperCase(),
                capacity: classroom.capacity,
                isActive: true,
                ...(grade.seriesId ? { seriesId: grade.seriesId } : {}),
              },
            });
            effectiveOfficialClassId = newAcademicClass.id;
            this.logger?.log?.(`createClassSection: AcademicClass créée depuis Classroom: ${newAcademicClass.id} (${newAcademicClass.name})`);
          } else {
            // Impossible de créer l'AcademicClass (grade/cycle/level manquant)
            // → officialClassId à null pour éviter la violation de FK
            effectiveOfficialClassId = null;
            this.logger?.warn?.(`createClassSection: Impossible de créer AcademicClass depuis Classroom (grade/cycle/level manquant). Section créée sans lien officialClassId.`);
          }
        }
      } else {
        // Classroom introuvable aussi → null
        effectiveOfficialClassId = null;
      }
    }

    const createdSection = await this.prisma.class.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId,
        officialClassId: effectiveOfficialClassId,
        name: data.name,
        code: data.code,
        capacity: data.capacity ?? null,
        ...(data.language ? { language: data.language } : {}),
      },
      include: {
        officialClass: { select: { id: true, name: true, code: true } },
        schoolLevel: { select: { id: true, code: true, name: true } },
      },
    });

    // ⭐ Phase 2 — Auto-création de la section EN miroir si mode bilingue activé
    //    ET la section créée est FR (pas déjà EN) ET dans le scope (MATERNELLE+PRIMAIRE).
    //    Non-bloquant : si l'auto-création échoue, la section FR reste créée.
    //    ⚠️ NE duplique PAS les élèves — la section EN est un miroir vide.
    if (!data.language || data.language === 'FR') {
      try {
        await this.bilingualStructureService.autoCreateEnSectionForFrSection(data.tenantId, {
          id: createdSection.id,
          name: createdSection.name,
          code: createdSection.code,
          officialClassId: createdSection.officialClassId,
          schoolLevelId: createdSection.schoolLevelId,
          academicYearId: createdSection.academicYearId,
          capacity: createdSection.capacity,
        });
      } catch (e: any) {
        this.logger?.warn?.(`Failed to auto-create EN section for ${createdSection.name}: ${e.message}`);
      }
    }

    return createdSection;
  }

  /**
   * Supprime une section (subdivision A/B/C).
   *
   * Règle métier (juillet 2026) : la règle « au moins une section par classe
   * officielle » a été retirée — il est désormais possible de supprimer toutes
   * les sections d'une classe officielle. L'utilisateur pourra ensuite :
   *   - soit re-synchroniser les sections via l'action « sync » (qui recrée
   *     une section par défaut par AcademicClass),
   *   - soit supprimer définitivement la classe officielle si elle n'est plus
   *     utilisée cette année.
   *
   * On vérifie simplement qu'aucun élève n'est actuellement affecté à cette
   * section (StudentEnrollment) pour éviter une suppression incohérente. Si
   * des élèves y sont affectés, on lève une BadRequestException avec un
   * message clair invitant à les réaffecter d'abord.
   */
  async deleteClassSection(id: string, tenantId: string): Promise<{ success: boolean }> {
    const section = await this.prisma.class.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        officialClassId: true,
        academicYearId: true,
        name: true,
        _count: { select: { studentEnrollments: true } },
      },
    });
    if (!section) {
      throw new NotFoundException(`Section introuvable (id=${id}).`);
    }

    // Sécurité : refuser la suppression si des élèves sont actuellement
    // affectés à cette section (cela évite des données orphelines).
    const enrollmentCount = (section as any)._count?.studentEnrollments ?? 0;
    if (enrollmentCount > 0) {
      throw new BadRequestException(
        `Impossible de supprimer la section « ${section.name} » : ` +
        `${enrollmentCount} élève(s) y sont affectés. ` +
        `Réaffectez ces élèves à une autre section avant de la supprimer.`,
      );
    }

    await this.prisma.class.delete({ where: { id } });
    this.logger.log(
      `Section ${id} (« ${section.name} ») supprimée par le tenant ${tenantId}. ` +
      `(officialClassId=${section.officialClassId ?? 'null'})`,
    );
    return { success: true };
  }

  /**
   * Met à jour une section (subdivision A/B/C) — name, code, capacity.
   */
  async updateClassSection(
    id: string,
    tenantId: string,
    data: { name?: string; code?: string; capacity?: number | null },
  ): Promise<any> {
    const section = await this.prisma.class.findFirst({
      where: { id, tenantId },
      select: { id: true, name: true, code: true, capacity: true },
    });
    if (!section) {
      throw new NotFoundException(`Section introuvable (id=${id}).`);
    }

    // Vérifier l'unicité du code si modifié
    if (data.code && data.code !== section.code) {
      const existing = await this.prisma.class.findFirst({
        where: { tenantId, code: data.code, id: { not: id } },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException(`Une autre section avec le code "${data.code}" existe déjà.`);
      }
    }

    return this.prisma.class.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      },
      include: {
        officialClass: { select: { id: true, name: true, code: true } },
        schoolLevel: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * Liste toutes les sections (Class) d'une année scolaire, groupées par AcademicClass.
   */
  async findAllClassSections(tenantId: string, academicYearId: string) {
    return this.prisma.class.findMany({
      where: { tenantId, academicYearId },
      include: {
        officialClass: {
          select: {
            id: true,
            name: true,
            code: true,
            level: { select: { id: true, name: true } },
            cycle: { select: { id: true, name: true } },
          },
        },
        schoolLevel: { select: { id: true, code: true, name: true } },
      },
      orderBy: [
        { officialClass: { level: { orderIndex: 'asc' } } },
        { officialClass: { cycle: { orderIndex: 'asc' } } },
        { name: 'asc' },
      ],
    });
  }

  /** 2nd cycle du secondaire (Paramètres) : libellés type « 2nd cycle », « 2ème cycle ». */
  private isEducationSecondCycleCycleName(cycleName: string): boolean {
    const key = normalizeCycleNameKey(cycleName);
    if (key.includes('2nd') && key.includes('cycle')) return true;
    if (key.includes('2ème') && key.includes('cycle')) return true;
    if (key.includes('2eme') && key.includes('cycle')) return true;
    const compact = key.replace(/\s/g, '');
    return (
      compact === '2ndcycle' ||
      compact === '2èmecycle' ||
      compact === '2emecycle' ||
      globalOrderIndexForCanonicalCycleName(cycleName) === 9
    );
  }

  /**
   * Recopie les séries Paramètres (EducationSeries référencées par les grades du 2nd cycle secondaire)
   * vers pedagogy_academic_series pour l’année. Création / mise à jour du libellé (description) ; ne supprime pas
   * les séries pédagogiques existantes (préservation des liens matières). Idempotent — à appeler avant lecture des séries.
   */
  async syncAcademicSeriesFromEducationSettings(
    tenantId: string,
    academicYearId: string,
  ): Promise<void> {
    try {
      await this.syncAcademicLevelsFromEducationSettings(tenantId, academicYearId);

      const secondaryLevel = await this.prisma.academicLevel.findFirst({
        where: { tenantId, academicYearId, name: 'Secondaire' },
      });
      if (!secondaryLevel) return;

      const eduSecondary = await this.prisma.educationLevel.findFirst({
        where: { tenantId, name: 'SECONDAIRE' },
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
      if (!eduSecondary) return;

      const year = await this.prisma.academicYear.findFirst({
        where: { id: academicYearId, tenantId },
      });
      if (!year) return;

      const byCode = new Map<string, { code: string; label: string | null }>();
      for (const ec of eduSecondary.cycles) {
        if (!this.isEducationSecondCycleCycleName(ec.name)) continue;
        for (const eg of ec.grades) {
          const s = eg.series;
          if (!s?.code) continue;
          const code = s.code.trim();
          if (!code) continue;
          byCode.set(code, { code, label: s.name ?? null });
        }
      }

      await this.prisma.$transaction(async (tx) => {
        for (const { code, label } of byCode.values()) {
          const existing = await tx.academicSeries.findFirst({
            where: {
              tenantId,
              academicYearId,
              levelId: secondaryLevel.id,
              name: code,
            },
          });
          if (existing) {
            if (label != null && existing.description !== label) {
              await tx.academicSeries.update({
                where: { id: existing.id },
                data: { ...prismaUpdateDefaults(), description: label },
              });
            }
          } else {
            await tx.academicSeries.create({
              data: {
                ...prismaCreateDefaults(),
                tenantId,
                academicYearId,
                levelId: secondaryLevel.id,
                name: code,
                description: label,
                isActive: true,
              },
            });
          }
        }
      });
    } catch (e) {
      this.logger.warn(
        `syncAcademicSeriesFromEducationSettings: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private async assertEnglishTrackAllowedIfNeeded(
    tenantId: string,
    languageTrack: string | null | undefined,
  ): Promise<void> {
    const raw = (languageTrack ?? '').trim().toUpperCase();
    if (raw !== 'EN') return;
    const settings = await this.prisma.settingsBilingual.findUnique({
      where: { tenantId },
      select: { isEnabled: true },
    });
    if (!settings?.isEnabled) {
      throw new BadRequestException(
        "La piste anglaise (EN) nécessite l'option bilingue activée dans Paramètres.",
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
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        name: data.name,
        orderIndex: data.orderIndex ?? 0,
      },
    });
  }

  async updateLevel(id: string, tenantId: string, data: { name?: string; orderIndex?: number; isActive?: boolean }) {
    await this.getLevelOrThrow(id, tenantId);
    return this.prisma.academicLevel.update({ where: { id }, data: { ...prismaUpdateDefaults(), ...data } });
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
    await this.syncAcademicCyclesFromEducationSettings(tenantId, academicYearId);
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (levelId) where.levelId = levelId;
    return this.prisma.academicCycle.findMany({
      where,
      include: { level: true, classes: { where: { isActive: true } } },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    });
  }

  async createCycle(data: {
    tenantId: string;
    academicYearId: string;
    levelId: string;
    name: string;
    orderIndex?: number;
    isActive?: boolean;
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
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        levelId: data.levelId,
        name: data.name,
        orderIndex: data.orderIndex ?? 0,
        isActive: data.isActive ?? true,
      },
      include: { level: true },
    });
  }

  async updateCycle(id: string, tenantId: string, data: { name?: string; orderIndex?: number; isActive?: boolean }) {
    await this.getCycleOrThrow(id, tenantId);
    return this.prisma.academicCycle.update({
      where: { id },
      data: { ...prismaUpdateDefaults(), ...data },
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
    filters?: { levelId?: string; cycleId?: string; isActive?: boolean; includeInactive?: boolean }
  ) {
    await this.syncAcademicClassesFromEducationSettings(tenantId, academicYearId);
    await this.syncAcademicClassLanguageTracksFromBilingualSettings(tenantId, academicYearId);
    // NOTE : syncClassSectionsFromAcademicClasses() n'est PLUS appelé automatiquement ici.
    // Les sections physiques (table `classes`) ne doivent être créées QUE par action
    // explicite de l'utilisateur via :
    //   - le bouton « Synchroniser » dans Paramètres > Sections par classe,
    //   - le formulaire « Ajouter une section »,
    //   - ou le bouton « Création multiple ».
    // L'auto-création était trop agressive et donnait l'impression que les
    // sections existaient sans que l'utilisateur ne les ait créées.
    const where: Record<string, unknown> = { tenantId, academicYearId };
    if (filters?.levelId) where.levelId = filters.levelId;
    if (filters?.cycleId) where.cycleId = filters.cycleId;
    // ⭐ Par défaut, ne retourner QUE les classes actives (isActive=true).
    //    Une classe est désactivée quand son EducationGrade.isEnabled=false
    //    (propagé par syncAcademicClassesFromEducationSettings).
    //    Si l'appelant veut TOUT (vue admin Paramètres), il passe includeInactive=true.
    //    Si l'appelant veut uniquement les inactives, il passe isActive=false.
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    } else if (!filters?.includeInactive) {
      where.isActive = true;
    }
    return this.prisma.academicClass.findMany({
      where,
      include: {
        level: true,
        cycle: true,
        room: true,
        series: true,
        mainTeacher: { select: { id: true, firstName: true, lastName: true, matricule: true } },
        // Sections physiques rattachées (table `classes`, modèle `Class`).
        // Sert à afficher les chips CE1 A, CE1 B... dans le sous-onglet Classes
        // et à calculer la capacité totale (somme des sections).
        // ⚠️ Le modèle Class n'a pas de champ `isActive` (contrairement à
        // AcademicClass). Toutes les sections sont actives par défaut.
        physicalClasses: {
          select: {
            id: true,
            name: true,
            code: true,
            capacity: true,
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ cycle: { orderIndex: 'asc' } }, { name: 'asc' }],
    });
  }

  async createClass(data: {
    tenantId: string;
    academicYearId: string;
    levelId: string;
    cycleId?: string;
    name: string;
    code: string;
    capacity?: number;
    roomId?: string;
    mainTeacherId?: string;
    languageTrack?: string;
  }) {
    // If no cycleId provided, find or create the default cycle for this level
    let cycleId = data.cycleId;
    if (!cycleId) {
      const defaultCycle = await this.prisma.academicCycle.findFirst({
        where: { tenantId: data.tenantId, academicYearId: data.academicYearId, levelId: data.levelId },
        orderBy: { orderIndex: 'asc' },
      });
      if (defaultCycle) {
        cycleId = defaultCycle.id;
      } else {
        // Auto-create a default cycle
        const newCycle = await this.prisma.academicCycle.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId: data.tenantId,
            academicYearId: data.academicYearId,
            levelId: data.levelId,
            name: `Cycle ${data.name}`,
            orderIndex: 0,
          },
        });
        cycleId = newCycle.id;
      }
    }
    const code = data.code.trim().toUpperCase().replace(/\s/g, '');
    const existing = await this.prisma.academicClass.findFirst({
      where: { tenantId: data.tenantId, academicYearId: data.academicYearId, code },
    });
    if (existing) {
      throw new BadRequestException(`Une classe avec le code "${data.code}" existe déjà pour cette année.`);
    }
    await this.assertEnglishTrackAllowedIfNeeded(data.tenantId, data.languageTrack);
    const created = await this.prisma.academicClass.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        levelId: data.levelId,
        cycleId,
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

    // ⭐ Phase 2 — Auto-création de l'AcademicClass EN miroir si mode bilingue activé
    //    ET la classe créée est FR (pas déjà EN) ET dans le scope (MATERNELLE+PRIMAIRE).
    //    Non-bloquant : si l'auto-création échoue, la classe FR reste créée.
    if (!data.languageTrack || data.languageTrack === 'FR') {
      try {
        await this.bilingualStructureService.autoCreateEnAcademicClassForFrAcademicClass(data.tenantId, {
          id: created.id,
          levelId: created.levelId,
          cycleId: created.cycleId,
          name: created.name,
          code: created.code,
          capacity: created.capacity,
          academicYearId: created.academicYearId,
        });
      } catch (e: any) {
        this.logger?.warn?.(`Failed to auto-create EN AcademicClass for ${created.name}: ${e.message}`);
      }
    }

    return created;
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
    if (data.languageTrack !== undefined) {
      await this.assertEnglishTrackAllowedIfNeeded(tenantId, data.languageTrack);
    }
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
      data: { ...prismaUpdateDefaults(), ...updateData },
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
      include: { level: true, cycle: true, room: true, series: true, mainTeacher: true },
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

    // Vérifier si l'année cible a déjà une structure — si oui, on continue quand même
    // (upsert mode : on duplique seulement ce qui manque)
    const existingTargetLevels = await this.prisma.academicLevel.count({
      where: { tenantId, academicYearId: toAcademicYearId },
    });
    const structureAlreadyExists = existingTargetLevels > 0;
    // Ne plus bloquer — on continue et on duplique les salles même si la structure existe

    const sourceLevels = await this.prisma.academicLevel.findMany({
      where: { tenantId, academicYearId: fromAcademicYearId },
      orderBy: { orderIndex: 'asc' },
    });
    if (sourceLevels.length === 0) {
      throw new BadRequestException("L'année source ne contient aucun niveau à copier.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const levelMap = new Map<string, string>();

      // ─── Dupliquer les salles (Room) vers la nouvelle année ──
      // Les salles de l'année source (ou globales avec academicYearId=null) sont copiées
      // vers l'année cible avec le même roomCode, roomName, capacity, etc.
      const sourceRooms = await tx.room.findMany({
        where: {
          tenantId,
          OR: [
            { academicYearId: fromAcademicYearId },
            { academicYearId: null }, // salles globales
          ],
        },
      });
      const roomMap = new Map<string, string>();
      let roomsCopied = 0;

      for (const r of sourceRooms) {
        // Vérifier si une salle avec le même roomCode existe déjà pour l'année cible
        const existingRoom = await tx.room.findFirst({
          where: { tenantId, academicYearId: toAcademicYearId, roomCode: r.roomCode },
        });
        if (existingRoom) {
          roomMap.set(r.id, existingRoom.id);
          continue; // skip — déjà existe
        }

        const newRoom = await tx.room.create({
          data: {
            tenantId,
            academicYearId: toAcademicYearId,
            roomCode: r.roomCode,
            roomName: r.roomName,
            roomType: r.roomType,
            capacity: r.capacity,
            schoolLevelId: r.schoolLevelId,
            equipment: r.equipment,
            status: r.status,
            description: r.description,
          },
        });
        roomMap.set(r.id, newRoom.id);
        roomsCopied++;
      }

      // ─── Dupliquer les niveaux (si pas déjà existants) ──
      if (!structureAlreadyExists) {
        for (const l of sourceLevels) {
          const created = await tx.academicLevel.create({
            data: {
              ...prismaCreateDefaults(),
              tenantId,
              academicYearId: toAcademicYearId,
              name: l.name,
              orderIndex: l.orderIndex,
              isActive: l.isActive,
            },
          });
          levelMap.set(l.id, created.id);
        }
      } else {
        // La structure existe déjà — on mappe les niveaux source → cible par nom
        const targetLevels = await tx.academicLevel.findMany({
          where: { tenantId, academicYearId: toAcademicYearId },
        });
        for (const l of sourceLevels) {
          const match = targetLevels.find(tl => tl.name === l.name);
          if (match) levelMap.set(l.id, match.id);
        }
      }

      const sourceCycles = await tx.academicCycle.findMany({
        where: { tenantId, academicYearId: fromAcademicYearId },
        orderBy: { orderIndex: 'asc' },
      });
      const cycleMap = new Map<string, string>();
      // Si la structure existe déjà, récupérer les cycles cibles existants
      const targetCycles = structureAlreadyExists
        ? await tx.academicCycle.findMany({ where: { tenantId, academicYearId: toAcademicYearId } })
        : [];
      for (const c of sourceCycles) {
        const newLevelId = levelMap.get(c.levelId);
        if (!newLevelId) continue; // skip au lieu de throw

        if (structureAlreadyExists) {
          // Chercher un cycle existant avec le même nom + niveau
          const existing = targetCycles.find(tc => tc.name === c.name && tc.levelId === newLevelId);
          if (existing) {
            cycleMap.set(c.id, existing.id);
            continue; // skip
          }
        }

        const created = await tx.academicCycle.create({
          data: {
            ...prismaCreateDefaults(),
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
      const targetSeries = structureAlreadyExists
        ? await tx.academicSeries.findMany({ where: { tenantId, academicYearId: toAcademicYearId } })
        : [];
      for (const s of sourceSeries) {
        const newLevelId = levelMap.get(s.levelId);
        if (!newLevelId) continue;

        if (structureAlreadyExists) {
          const existing = targetSeries.find(ts => ts.name === s.name && ts.levelId === newLevelId);
          if (existing) { seriesMap.set(s.id, existing.id); continue; }
        }
        const created = await tx.academicSeries.create({
          data: {
            ...prismaCreateDefaults(),
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
            ...prismaCreateDefaults(),
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
      const targetClasses = structureAlreadyExists
        ? await tx.academicClass.findMany({ where: { tenantId, academicYearId: toAcademicYearId } })
        : [];
      for (const cl of sourceClasses) {
        const newLevelId = levelMap.get(cl.levelId);
        const newCycleId = cycleMap.get(cl.cycleId);
        if (!newLevelId || !newCycleId) continue;

        if (structureAlreadyExists) {
          // Skip si une classe avec le même code existe déjà
          const existing = targetClasses.find(tc => tc.code === cl.code);
          if (existing) continue;
        }
        await tx.academicClass.create({
          data: {
            ...prismaCreateDefaults(),
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

      // ─── Si aucune salle n'a été copiée, créer une salle par classe ──
      // (cas typique : l'école n'a pas créé de salles dans l'onglet Salles,
      // mais chaque classe a besoin d'une salle pour l'EDT)
      if (roomsCopied === 0) {
        const targetClassesForRooms = await tx.academicClass.findMany({
          where: { tenantId, academicYearId: toAcademicYearId },
        });
        for (const cl of targetClassesForRooms) {
          const roomCode = `ROOM-${cl.code}`;
          // Vérifier si la salle existe déjà
          const existing = await tx.room.findFirst({
            where: { tenantId, academicYearId: toAcademicYearId, roomCode },
          });
          if (existing) continue;

          const newRoom = await tx.room.create({
            data: {
              tenantId,
              academicYearId: toAcademicYearId,
              roomCode,
              roomName: `Salle ${cl.name}`,
              roomType: 'CLASSROOM',
              capacity: cl.capacity || 40,
              schoolLevelId: cl.levelId,
              status: 'ACTIVE',
            },
          });
          roomsCopied++;

          // Lier la classe à cette salle
          await tx.academicClass.update({
            where: { id: cl.id },
            data: { roomId: newRoom.id },
          });
        }
      }

      // ─── Dupliquer les matières (Subjects) ──
      const sourceSubjects = await tx.subject.findMany({
        where: { tenantId, academicYearId: fromAcademicYearId },
      });
      let subjectsCopied = 0;
      for (const s of sourceSubjects) {
        // Skip si déjà existant (même code + schoolLevelId)
        const existing = await tx.subject.findFirst({
          where: { tenantId, academicYearId: toAcademicYearId, schoolLevelId: s.schoolLevelId, code: s.code },
        });
        if (existing) continue;
        await tx.subject.create({
          data: {
            tenantId,
            academicYearId: toAcademicYearId,
            schoolLevelId: s.schoolLevelId,
            academicTrackId: s.academicTrackId,
            name: s.name,
            code: s.code,
            abbreviation: s.abbreviation,
            coefficient: s.coefficient,
            language: s.language,
            weeklyHours: s.weeklyHours,
            description: s.description,
          },
        });
        subjectsCopied++;
      }

      // ─── Dupliquer les profils académiques enseignants ──
      const sourceProfiles = await tx.teacherAcademicProfile.findMany({
        where: { tenantId, academicYearId: fromAcademicYearId },
        include: {
          subjectQualifications: true,
          levelAuthorizations: true,
          availabilities: true,
        },
      });
      let profilesCopied = 0;
      for (const p of sourceProfiles) {
        // Skip si déjà existant
        const existing = await tx.teacherAcademicProfile.findFirst({
          where: { tenantId, academicYearId: toAcademicYearId, teacherId: p.teacherId },
        });
        if (existing) continue;

        const newProfile = await tx.teacherAcademicProfile.create({
          data: {
            tenantId,
            academicYearId: toAcademicYearId,
            teacherId: p.teacherId,
            maxWeeklyHours: p.maxWeeklyHours,
            isSemainier: p.isSemainier,
            isActive: p.isActive,
          },
        });

        // Dupliquer les qualifications
        for (const q of p.subjectQualifications) {
          await tx.teacherSubjectQualification.create({
            data: {
              tenantId,
              profileId: newProfile.id,
              subjectId: q.subjectId,
              isAuthorized: q.isAuthorized,
            },
          });
        }

        // Dupliquer les autorisations de niveau
        for (const la of p.levelAuthorizations) {
          await tx.teacherLevelAuthorization.create({
            data: {
              tenantId,
              profileId: newProfile.id,
              levelId: la.levelId,
            },
          });
        }

        // Dupliquer les disponibilités
        for (const av of p.availabilities) {
          await tx.teacherAvailability.create({
            data: {
              tenantId,
              profileId: newProfile.id,
              dayOfWeek: av.dayOfWeek,
              startTime: av.startTime,
              endTime: av.endTime,
              isAvailable: av.isAvailable,
            },
          });
        }

        profilesCopied++;
      }

      // ─── Dupliquer les configs d'emploi du temps (timetable_configs) ──
      let timetablesCopied = 0;
      try {
        const sourceConfigs = await tx.$queryRawUnsafe<any[]>(`
          SELECT * FROM "timetable_configs"
          WHERE "tenantId" = $1 AND "academicYearId" = $2
        `, tenantId, fromAcademicYearId);

        for (const c of sourceConfigs) {
          // Skip si déjà existant
          const existing = await tx.$queryRawUnsafe<any[]>(`
            SELECT id FROM "timetable_configs"
            WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "schoolLevelId" = $3
            LIMIT 1
          `, tenantId, toAcademicYearId, c.schoolLevelId);
          if (existing.length > 0) continue;

          const newId = cryptoRandomUUID();
          await tx.$executeRawUnsafe(`
            INSERT INTO "timetable_configs"
            ("id", "tenantId", "schoolLevelId", "academicYearId", "schoolDays", "timeBlocks",
             "dayStartTime", "dayEndTime", "defaultSessionDuration", "lunchBreakStart", "lunchBreakEnd",
             "saturdayEnabled", "eveningEnabled", "eveningStart", "eveningEnd")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `, newId, tenantId, c.schoolLevelId, toAcademicYearId,
            c.schoolDays || '[1,2,3,4,5]', c.timeBlocks || '[]',
            c.dayStartTime || '08:00', c.dayEndTime || '18:00',
            c.defaultSessionDuration || 120,
            c.lunchBreakStart, c.lunchBreakEnd,
            c.saturdayEnabled || false, c.eveningEnabled || false,
            c.eveningStart, c.eveningEnd);
          timetablesCopied++;
        }
      } catch (e: any) {
        this.logger.warn(`Failed to duplicate timetable configs: ${e.message}`);
      }

      return {
        levelsCopied: structureAlreadyExists ? 0 : sourceLevels.length,
        cyclesCopied: structureAlreadyExists ? 0 : sourceCycles.length,
        classesCopied: structureAlreadyExists ? 0 : sourceClasses.length,
        seriesCopied: structureAlreadyExists ? 0 : sourceSeries.length,
        seriesSubjectsCopied: structureAlreadyExists ? 0 : seriesSubjectsCopied,
        roomsCopied,
        subjectsCopied,
        profilesCopied,
        timetablesCopied,
      };
    });

    await this.syncAcademicLevelsFromEducationSettings(tenantId, toAcademicYearId);
    await this.syncAcademicCyclesFromEducationSettings(tenantId, toAcademicYearId);
    await this.syncAcademicClassesFromEducationSettings(tenantId, toAcademicYearId);
    await this.syncAcademicClassLanguageTracksFromBilingualSettings(tenantId, toAcademicYearId);

    try {
      await this.prisma.auditLog.create({
        data: {
          ...prismaCreateDefaults(),
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
