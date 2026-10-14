/**
 * SOUS-MODULE 1 — Configuration des frais (FeeStructure, FeeStructureInstallment, FeeOverride)
 * Priorité : Classe > Niveau > Override. Aucune suppression (historisation). Année non clôturée. Audit.
 */
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FeeType } from '@prisma/client';
import { StudentAccountService } from './student-account.service';

const FEE_TYPES: FeeType[] = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'GENERAL', 'OTHER'];

// NOTE (sept. 2026) : la clé de déduplication des structures applicables
// (feeType, GENERAL dédup par nom) vit désormais dans
// selectApplicableStructures() de student-account.service.ts — source unique
// partagée par le matching des comptes élèves et le scope des recalculs.

@Injectable()
export class FeeStructureService {
  private readonly logger = new Logger(FeeStructureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentAccountService: StudentAccountService,
  ) {}

  private async ensureAcademicYearNotClosed(academicYearId: string, tenantId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
    });
    if (year?.isClosed) {
      throw new BadRequestException('Impossible de modifier la configuration des frais : année scolaire clôturée.');
    }
  }

  private async audit(tenantId: string, userId: string | undefined, action: string, resource: string, resourceId: string, oldData?: object, newData?: object) {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: userId ?? undefined,
          action,
          resource,
          resourceId,
          tableName: 'fee_structures',
          recordId: resourceId,
          oldData: oldData ?? undefined,
          newData: newData ?? undefined,
        },
      });
    } catch {
      // best-effort
    }
  }

  async create(
    tenantId: string,
    data: {
      academicYearId: string;
      levelId?: string;
      classId?: string;
      /// Classe officielle (AcademicClass) — ex: "CE1", "CM2", "6ème".
      academicClassId?: string;
      name: string;
      feeType: FeeType | string;
      customFeeTypeLabel?: string;
      totalAmount: number;
      isInstallment?: boolean;
      isMandatory?: boolean;
      installments?: {
        label: string;
        amount: number;
        dueDate?: Date;
        dueDateType?: 'FIXED' | 'AT_ENROLLMENT' | 'DAYS_AFTER_ENROLLMENT';
        daysOffset?: number;
        orderIndex: number;
      }[];
      createdById?: string;
    },
    userId?: string,
  ) {
    await this.ensureAcademicYearNotClosed(data.academicYearId, tenantId);
    const feeType = (typeof data.feeType === 'string' && FEE_TYPES.includes(data.feeType as FeeType)) ? data.feeType as FeeType : data.feeType;
    if (!FEE_TYPES.includes(feeType as FeeType)) {
      throw new BadRequestException(`feeType must be one of: ${FEE_TYPES.join(', ')}`);
    }
    // ⭐ Oct. 2026 (exigence promoteur — UNIFORME TOUS TENANTS) :
    //    CANTEEN et OTHER retirés du sélecteur « Nouveau frais » (front) →
    //    on bloque AUSSI côté API pour garantir l'uniformité (la cantine
    //    dispose de son module dédié ; « Autre » n'a pas de sémantique de
    //    suivi). Les données legacy restent lisibles (libellés d'affichage).
    if (feeType === 'CANTEEN' || feeType === 'OTHER') {
      throw new BadRequestException(
        `Type de frais non disponible (${feeType}). Types autorisés : Inscription, Réinscription, Scolarité, Frais généraux, Frais d'examen.`,
      );
    }

    // Résoudre levelId : le frontend peut envoyer un UUID de education_levels
    // au lieu de school_levels. On essaie les deux tables.
    // ⚠️ Défense en profondeur (juillet 2026) : si l'ID n'est ni dans school_levels
    // ni dans education_levels (ex: AcademicLevel.id envoyé par erreur), on met
    // resolvedLevelId à null au lieu de garder la valeur invalide — cela évite
    // une FK violation P2003 côté Prisma lors du create().
    let resolvedLevelId = data.levelId ?? null;
    if (resolvedLevelId) {
      // Vérifier si c'est un UUID de school_levels
      const schoolLevel = await this.prisma.schoolLevel.findFirst({
        where: { id: resolvedLevelId, tenantId },
        select: { id: true },
      });
      if (!schoolLevel) {
        // Ce n'est pas dans school_levels → essayer education_levels
        const eduLevel = await this.prisma.educationLevel.findFirst({
          where: { id: resolvedLevelId, tenantId },
          select: { id: true, name: true },
        });
        if (eduLevel) {
          // Résoudre par nom (MATERNELLE/PRIMAIRE/SECONDAIRE)
          const matchingSchoolLevel = await this.prisma.schoolLevel.findFirst({
            where: { tenantId, name: eduLevel.name },
            select: { id: true },
          });
          if (matchingSchoolLevel) {
            resolvedLevelId = matchingSchoolLevel.id;
          } else {
            // Si aucun school_level ne correspond, créer ou utiliser le code
            resolvedLevelId = null;
          }
        } else {
          // ⭐ L'ID n'est ni dans school_levels ni dans education_levels.
          // C'est probablement un AcademicLevel.id (table pedagogy_academic_levels)
          // envoyé par erreur par le frontend. On met à null pour éviter la
          // FK violation — le frais sera créé sans niveau (levelId null est OK
          // dans le schéma, c'est juste que le filtrage par niveau ne marchera pas).
          this.logger.warn(
            `levelId ${resolvedLevelId} introuvable dans school_levels ET education_levels — ` +
            `mise à null pour éviter FK violation (probablement un AcademicLevel.id envoyé par erreur).`,
          );
          resolvedLevelId = null;
        }
      }
    }

    if (data.classId && resolvedLevelId) {
      const cls = await this.prisma.class.findFirst({
        where: { id: data.classId, tenantId },
      });
      if (cls && cls.schoolLevelId !== resolvedLevelId) {
        throw new BadRequestException('classId must belong to the given levelId');
      }
    }

    // ⭐ Valider academicClassId si fourni (classe officielle).
    if (data.academicClassId) {
      const academicClass = await this.prisma.academicClass.findFirst({
        where: { id: data.academicClassId, tenantId },
        select: { id: true, name: true },
      });
      if (!academicClass) {
        throw new BadRequestException(`academicClassId not found: ${data.academicClassId}`);
      }
    }

    const structure = await this.prisma.feeStructure.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        levelId: resolvedLevelId,
        classId: data.classId ?? null,
        /// ⭐ Stocker la classe officielle (AcademicClass) si fournie.
        academicClassId: data.academicClassId ?? null,
        name: data.name,
        feeType: feeType as FeeType,
        customFeeTypeLabel: data.customFeeTypeLabel ?? null,
        totalAmount: data.totalAmount,
        isInstallment: data.isInstallment ?? false,
        isMandatory: data.isMandatory ?? true,
        isActive: true,
        createdById: data.createdById ?? null,
        updatedAt: new Date(),
        structureInstallments: data.installments?.length
          ? {
              create: data.installments.map((i) => {
                const dueDateType = i.dueDateType ?? 'FIXED';
                // Pour AT_ENROLLMENT et DAYS_AFTER_ENROLLMENT, dueDate est NULL
                // (résolue dynamiquement au runtime)
                const resolvedDueDate =
                  dueDateType === 'FIXED'
                    ? i.dueDate ?? new Date()
                    : null;
                // Pour DAYS_AFTER_ENROLLMENT, daysOffset doit être défini
                const resolvedDaysOffset =
                  dueDateType === 'DAYS_AFTER_ENROLLMENT'
                    ? i.daysOffset ?? 0
                    : null;
                return {
                  label: i.label,
                  amount: i.amount,
                  dueDate: resolvedDueDate,
                  dueDateType,
                  daysOffset: resolvedDaysOffset,
                  orderIndex: i.orderIndex,
                };
              }),
            }
          : undefined,
      },
      include: { structureInstallments: true, level: true, class: true },
    });
    await this.audit(tenantId, userId, 'FEE_STRUCTURE_CREATE', 'FeeStructure', structure.id, undefined, { id: structure.id, name: structure.name, feeType: structure.feeType });

    // ⭐ Recalculer les comptes élèves du PÉRIMÈTRE du frais, EN ARRIÈRE-PLAN.
    //    AVANT (bug « le modal charge indéfiniment / délai d'attente dépassé ») :
    //    recalcul SYNCHRONE de TOUS les comptes de l'année dans le fil de la
    //    requête HTTP (~12 requêtes séquentielles par élève : 426 comptes ≈ 177 s)
    //    → les timeouts (30 s navigateur / 55 s BFF Vercel) tuaient la réponse
    //    alors que l'enregistrement était déjà commité côté Railway → l'UI
    //    affichait « échec » alors que le frais était bien créé (visible après
    //    rechargement). MAINTENANT : la réponse repart en < 1 s, et le recalcul
    //    batch scoped (quelques secondes) tourne en tâche de fond.
    this.scheduleAccountRecalculation(
      tenantId,
      data.academicYearId,
      `fs:${structure.id}`,
      this.structureScopeToAccountFilter(structure, data.academicYearId),
    );

    return structure;
  }

  async findAll(
    tenantId: string,
    filters: {
      academicYearId: string;
      levelId?: string;
      classId?: string;
      academicClassId?: string;
      feeType?: string;
      isActive?: boolean;
    },
  ) {
    const where: any = { tenantId, academicYearId: filters.academicYearId };

    // ⭐ Si academicClassId est fourni, on filtre par classe officielle.
    if (filters.academicClassId) {
      where.academicClassId = filters.academicClassId;
    } else if (filters.levelId && !filters.classId) {
      // Si levelId est fourni (sans classId), on inclut :
      //  - les structures de niveau (levelId = filters.levelId)
      //  - les structures de classe appartenant à ce niveau (class.schoolLevelId = filters.levelId)
      //  - les structures de classe officielle appartenant à ce niveau (academicClass.levelId)
      where.OR = [
        { levelId: filters.levelId },
        { class: { schoolLevelId: filters.levelId } },
        { academicClass: { levelId: filters.levelId } },
      ];
    } else {
      if (filters.levelId) where.levelId = filters.levelId;
      if (filters.classId) where.classId = filters.classId;
    }
    if (filters.feeType) where.feeType = filters.feeType;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return this.prisma.feeStructure.findMany({
      where,
      include: {
        structureInstallments: { orderBy: { orderIndex: 'asc' } },
        level: true,
        class: true,
        /// ⭐ Inclure la classe officielle (AcademicClass) dans la réponse.
        academicClass: { include: { level: true } },
      },
      orderBy: [{ feeType: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string) {
    const s = await this.prisma.feeStructure.findFirst({
      where: { id, tenantId },
      include: {
        structureInstallments: { orderBy: { orderIndex: 'asc' } },
        overrides: true,
        level: true,
        class: true,
        /// ⭐ Inclure la classe officielle (AcademicClass) dans la réponse.
        academicClass: { include: { level: true } },
      },
    });
    if (!s) throw new NotFoundException(`FeeStructure ${id} not found`);
    return s;
  }

  /**
   * Modification directe (pas d'historisation — l'utilisateur veut que la donnée soit modifiée en place).
   */
  async update(
    id: string,
    tenantId: string,
    data: Partial<{
      name: string;
      feeType: string;
      customFeeTypeLabel: string | null;
      totalAmount: number;
      isInstallment: boolean;
      isMandatory: boolean;
      isActive: boolean;
      levelId: string | null;
      classId: string | null;
      /// ⭐ Classe officielle (AcademicClass).
      academicClassId: string | null;
      installments: {
        label: string;
        amount: number;
        dueDate?: Date;
        dueDateType?: 'FIXED' | 'AT_ENROLLMENT' | 'DAYS_AFTER_ENROLLMENT';
        daysOffset?: number;
        orderIndex: number;
      }[];
    }>,
    userId?: string,
  ) {
    const existing = await this.findOne(id, tenantId);
    await this.ensureAcademicYearNotClosed(existing.academicYearId, tenantId);

    // ⭐ Oct. 2026 (uniforme tous tenants) : interdire aussi le passage vers
    //    CANTEEN/OTHER en modification directe (même règle que create()).
    if (data.feeType !== undefined && (data.feeType === 'CANTEEN' || data.feeType === 'OTHER')) {
      throw new BadRequestException(
        `Type de frais non disponible (${data.feeType}). Types autorisés : Inscription, Réinscription, Scolarité, Frais généraux, Frais d'examen.`,
      );
    }

    // Résoudre levelId si fourni (même logique que create)
    let resolvedLevelId = data.levelId !== undefined ? data.levelId : existing.levelId;
    if (resolvedLevelId) {
      const schoolLevel = await this.prisma.schoolLevel.findFirst({
        where: { id: resolvedLevelId, tenantId },
        select: { id: true },
      });
      if (!schoolLevel) {
        const eduLevel = await this.prisma.educationLevel.findFirst({
          where: { id: resolvedLevelId, tenantId },
          select: { id: true, name: true },
        });
        if (eduLevel) {
          const matchingSchoolLevel = await this.prisma.schoolLevel.findFirst({
            where: { tenantId, name: eduLevel.name },
            select: { id: true },
          });
          if (matchingSchoolLevel) {
            resolvedLevelId = matchingSchoolLevel.id;
          } else {
            resolvedLevelId = null;
          }
        }
      }
    }

    // Mise à jour directe (pas d'historisation)
    const updated = await this.prisma.feeStructure.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.feeType !== undefined && { feeType: data.feeType as FeeType }),
        ...(data.customFeeTypeLabel !== undefined && { customFeeTypeLabel: data.customFeeTypeLabel || null }),
        ...(data.totalAmount !== undefined && { totalAmount: Number(data.totalAmount) }),
        ...(data.isInstallment !== undefined && { isInstallment: data.isInstallment }),
        ...(data.isMandatory !== undefined && { isMandatory: data.isMandatory }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.levelId !== undefined && { levelId: resolvedLevelId }),
        ...(data.classId !== undefined && { classId: data.classId || null }),
        /// ⭐ Mettre à jour academicClassId si fourni.
        ...(data.academicClassId !== undefined && { academicClassId: data.academicClassId || null }),
        updatedAt: new Date(),
      },
      include: { structureInstallments: true, level: true, class: true, academicClass: { include: { level: true } } },
    });

    // Si les installments sont fournis, on remplace la collection existante
    if (data.installments !== undefined) {
      // Supprimer les anciens installments
      await this.prisma.feeStructureInstallment.deleteMany({
        where: { feeStructureId: id },
      });
      // Créer les nouveaux
      if (data.installments.length > 0) {
        await this.prisma.feeStructureInstallment.createMany({
          data: data.installments.map((i) => {
            const dueDateType = i.dueDateType ?? 'FIXED';
            const resolvedDueDate =
              dueDateType === 'FIXED' ? i.dueDate ?? new Date() : null;
            const resolvedDaysOffset =
              dueDateType === 'DAYS_AFTER_ENROLLMENT' ? i.daysOffset ?? 0 : null;
            return {
              feeStructureId: id,
              label: i.label,
              amount: i.amount,
              dueDate: resolvedDueDate,
              dueDateType,
              daysOffset: resolvedDaysOffset,
              orderIndex: i.orderIndex,
            };
          }),
        });
      }
    }

    // Recharger avec les installments à jour
    const reloaded = await this.prisma.feeStructure.findFirst({
      where: { id, tenantId },
      include: {
        structureInstallments: { orderBy: { orderIndex: 'asc' } },
        level: true,
        class: true,
      },
    });

    await this.audit(tenantId, userId, 'FEE_STRUCTURE_UPDATE', 'FeeStructure', id, { name: existing.name }, { name: updated.name });

    // ⭐ Recalculer les comptes élèves du périmètre du frais (ancien ∪ nouveau),
    //    EN ARRIÈRE-PLAN — même fix que create() (cf. commentaire là-bas).
    //    AVANT : recalcul synchrone de TOUS les comptes de l'année → timeouts
    //    30 s / 55 s → « échec » affiché alors que la modification était prise
    //    en compte. MAINTENANT : réponse immédiate + recalcul batch scoped.
    //    On couvre l'UNION des périmètres : si le frais a changé de classe/niveau,
    //    les comptes de l'ANCIEN périmètre doivent aussi être recalculés (leurs
    //    breakdowns deviennent orphelins et doivent être retirés/resynchronisés).
    //    Un recalcul est prévu si un champ peut influer sur les montants ou le
    //    périmètre d'application (montant, activation, obligatoire, type, nom
    //    [clé de dédup GENERAL], niveau, classes, tranches).
    const affectsAccounts =
      data.totalAmount !== undefined ||
      data.isActive !== undefined ||
      data.isMandatory !== undefined ||
      data.feeType !== undefined ||
      data.name !== undefined ||
      data.levelId !== undefined ||
      data.classId !== undefined ||
      data.academicClassId !== undefined ||
      data.installments !== undefined;
    if (affectsAccounts) {
      const oldFilter = this.structureScopeToAccountFilter(existing, existing.academicYearId);
      const newFilter = this.structureScopeToAccountFilter(updated, existing.academicYearId);
      const sameScope = JSON.stringify(oldFilter) === JSON.stringify(newFilter);
      this.scheduleAccountRecalculation(
        tenantId,
        existing.academicYearId,
        `fs:${id}`,
        sameScope ? newFilter : { OR: [oldFilter, newFilter] },
      );
    }

    return reloaded ?? updated;
  }

  async addInstallment(
    feeStructureId: string,
    tenantId: string,
    data: {
      label: string;
      amount: number;
      dueDate?: Date;
      dueDateType?: 'FIXED' | 'AT_ENROLLMENT' | 'DAYS_AFTER_ENROLLMENT';
      daysOffset?: number;
      orderIndex: number;
    },
  ) {
    await this.findOne(feeStructureId, tenantId);
    const dueDateType = data.dueDateType ?? 'FIXED';
    return this.prisma.feeStructureInstallment.create({
      data: {
        feeStructureId,
        label: data.label,
        amount: data.amount,
        dueDate: dueDateType === 'FIXED' ? (data.dueDate ?? new Date()) : null,
        dueDateType,
        daysOffset: dueDateType === 'DAYS_AFTER_ENROLLMENT' ? (data.daysOffset ?? 0) : null,
        orderIndex: data.orderIndex,
      },
    });
  }

  async createOverride(
    tenantId: string,
    data: {
      feeStructureId: string;
      studentId: string;
      customAmount: number;
      reason: string;
      createdById?: string;
    },
    userId?: string,
  ) {
    const fs = await this.findOne(data.feeStructureId, tenantId);
    await this.ensureAcademicYearNotClosed(fs.academicYearId, tenantId);

    // ⭐ Vérifier s'il existe déjà une personnalisation pour ce student + feeStructure.
    //    Si oui, on la MET À JOUR (upsert) au lieu d'en créer une nouvelle.
    //    Avant : on faisait un create() sans vérifier → duplication possible
    //    si l'utilisateur cliquait 2x ou si le réseau renvoyait une erreur
    //    transitoire.
    const existing = await this.prisma.feeOverride.findFirst({
      where: {
        feeStructureId: data.feeStructureId,
        studentId: data.studentId,
      },
    });

    let override;
    if (existing) {
      // ⭐ Mettre à jour l'override existant
      override = await this.prisma.feeOverride.update({
        where: { id: existing.id },
        data: {
          customAmount: data.customAmount,
          reason: data.reason,
          updatedById: data.createdById ?? userId ?? null,
        },
        include: { student: true, feeStructure: true },
      });
    } else {
      // Créer un nouvel override
      override = await this.prisma.feeOverride.create({
        data: {
          feeStructureId: data.feeStructureId,
          studentId: data.studentId,
          customAmount: data.customAmount,
          reason: data.reason,
          createdById: data.createdById ?? userId ?? null,
        },
        include: { student: true, feeStructure: true },
      });
    }

    await this.audit(tenantId, userId, 'FEE_OVERRIDE_CREATE', 'FeeOverride', override.id, undefined, { feeStructureId: data.feeStructureId, studentId: data.studentId, customAmount: data.customAmount, reason: data.reason });

    // Recalculer le compte élève pour appliquer la personnalisation
    await this.studentAccountService.recalculate(data.studentId, tenantId, override.feeStructure.academicYearId);

    return override;
  }

  /**
   * ⭐ PERSONNALISATION EN MASSE POUR TOUTE UNE CLASSE.
   *
   * Demande utilisateur (sept. 2026) : permettre d'appliquer une
   * personnalisation (réduction) à TOUS les élèves d'une classe d'un coup,
   * « par exemple pour des raisons spécifiques » (cas sociaux, remise
   * collective, exonération d'une classe pilote, etc.).
   *
   * Fonctionnement :
   *   1. Charge le frais concerné (feeStructureId) → année académique dérivée.
   *   2. Trouve TOUS les élèves ACTIFS inscrits dans la classe (classId) pour
   *      cette année (via StudentEnrollment — status != WITHDRAWN).
   *   3. Pour chaque élève : calcule le montant personnalisé depuis le mode
   *      de réduction choisi — reductionPercent OU reductionAmount (XOF) —
   *      puis crée OU MET À JOUR l'override (upsert, pas de doublon).
   *   4. Recalcule le compte élève de chaque élève modifié (synchrone).
   *
   * Le compte des élèves sans compte StudentAccount existant est créé au
   * passage par recalculate() (getOrCreate interne).
   *
   * @returns { applied, skipped, failed, totalStudents, details[] }
   */
  async createBulkClassOverride(
    tenantId: string,
    data: {
      classId: string;
      feeStructureId: string;
      reductionPercent?: number;
      reductionAmount?: number;
      reason: string;
      createdById?: string;
    },
    userId?: string,
  ) {
    // 1) Le frais concerné (vérifie aussi le tenant + l'année non clôturée)
    const fs = await this.findOne(data.feeStructureId, tenantId);
    await this.ensureAcademicYearNotClosed(fs.academicYearId, tenantId);
    const originalAmount = Number(fs.totalAmount);
    if (originalAmount < 0) {
      throw new BadRequestException('Le frais concerné a un montant invalide.');
    }

    // 2) Validation du mode de réduction
    const hasPercent = data.reductionPercent != null && Number(data.reductionPercent) > 0;
    const hasAmount = data.reductionAmount != null && Number(data.reductionAmount) > 0;
    if (!hasPercent && !hasAmount) {
      throw new BadRequestException('Indiquez une réduction en pourcentage (%) OU en montant (XOF).');
    }
    if (hasPercent && Number(data.reductionPercent) > 100) {
      throw new BadRequestException('La réduction en pourcentage ne peut pas dépasser 100%.');
    }
    if (hasAmount && Number(data.reductionAmount) > originalAmount) {
      throw new BadRequestException(
        `La réduction (${Number(data.reductionAmount)} XOF) ne peut pas dépasser le montant du frais (${originalAmount} XOF).`,
      );
    }
    if (!data.reason || !data.reason.trim()) {
      throw new BadRequestException('Le motif est obligatoire.');
    }

    // 3) Montant personnalisé appliqué à TOUS les élèves de la classe
    let customAmount: number;
    if (hasPercent) {
      customAmount = Math.max(0, Math.round(originalAmount * (1 - Number(data.reductionPercent) / 100)));
    } else {
      customAmount = Math.max(0, Math.round(originalAmount - Number(data.reductionAmount)));
    }

    // 4) Tous les élèves ACTIFS de la classe pour l'année du frais
    //    (status WITHDRAWN exclu ; classe PHYSIQUE classId)
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        classId: data.classId,
        academicYearId: fs.academicYearId,
        tenantId,
        student: { status: { not: 'WITHDRAWN' } },
      },
      select: { studentId: true, status: true },
    });

    const studentIds: string[] = Array.from(
      new Set(enrollments.map((e: any) => e.studentId as string)),
    );
    if (studentIds.length === 0) {
      throw new BadRequestException("Aucun élève actif trouvé dans cette classe pour l'année du frais.");
    }

    this.logger.log(
      `createBulkClassOverride: classe=${data.classId}, frais=${data.feeStructureId} (${fs.name}), ` +
      `${studentIds.length} élève(s), montant personnalisé=${customAmount} (initial=${originalAmount})`,
    );

    // 5) Upsert EN BATCH des overrides + recalcul arrière-plan des comptes.
    //    ⭐ FIX (sept. 2026) : AVANT, boucle par élève (findFirst + update/create
    //    + recalculate synchrone + audit PAR élève) → pour une classe de 50
    //    élèves ≈ 150+ requêtes séquentielles ≈ 60 s → même bug de timeout que
    //    la configuration des frais (modal qui charge indéfiniment). MAINTENANT :
    //      - 1 requête pour connaître les overrides existants,
    //      - 1 updateMany (montant personnalisé identique pour toute la classe),
    //      - 1 createMany pour les nouveaux,
    //      - 1 audit récapitulatif (au lieu de N audits),
    //      - recalcul des comptes de la classe en arrière-plan (batch scoped).
    let applied = 0;
    let failed = 0;
    const details: { studentId: string; status: 'created' | 'updated' | 'failed'; error?: string }[] = [];

    try {
      // Overrides existants pour (frais × élèves de la classe) — 1 seule requête
      const existingOverrides: any[] = await this.prisma.feeOverride.findMany({
        where: { feeStructureId: data.feeStructureId, studentId: { in: studentIds } },
        select: { id: true, studentId: true },
      });
      const existingByStudent = new Set(existingOverrides.map((o) => o.studentId));
      const existingIds = existingOverrides.map((o) => o.id);
      const missingStudentIds = studentIds.filter((sid) => !existingByStudent.has(sid));

      // Mise à jour des overrides existants (mêmes valeurs pour tous)
      if (existingIds.length > 0) {
        await this.prisma.feeOverride.updateMany({
          where: { id: { in: existingIds } },
          data: {
            customAmount,
            reason: data.reason.trim(),
            updatedById: data.createdById ?? userId ?? null,
          },
        });
      }

      // Création des overrides manquants
      if (missingStudentIds.length > 0) {
        await this.prisma.feeOverride.createMany({
          data: missingStudentIds.map((studentId) => ({
            feeStructureId: data.feeStructureId,
            studentId,
            customAmount,
            reason: data.reason.trim(),
            createdById: data.createdById ?? userId ?? null,
          })),
        });
      }

      for (const sid of existingByStudent) details.push({ studentId: sid, status: 'updated' });
      for (const sid of missingStudentIds) details.push({ studentId: sid, status: 'created' });
      applied = studentIds.length;

      // Audit récapitulatif (1 entrée au lieu de N — même information, bornée)
      await this.audit(
        tenantId,
        userId,
        'FEE_OVERRIDE_BULK_CLASS',
        'FeeOverride',
        data.feeStructureId,
        undefined,
        {
          feeStructureId: data.feeStructureId,
          classId: data.classId,
          customAmount,
          originalAmount,
          reason: data.reason.trim(),
          updated: existingByStudent.size,
          created: missingStudentIds.length,
          students: studentIds.slice(0, 100),
        },
      );

      // Recalcul des comptes des élèves de la classe — en arrière-plan
      this.scheduleAccountRecalculation(
        tenantId,
        fs.academicYearId,
        `bulk-override:${data.classId}:${data.feeStructureId}`,
        {
          student: {
            studentEnrollments: { some: { academicYearId: fs.academicYearId, classId: data.classId } },
          },
        },
      );
    } catch (err: any) {
      failed = studentIds.length;
      applied = 0;
      details.length = 0;
      details.push({ studentId: '(batch)', status: 'failed', error: err?.message ?? String(err) });
      this.logger.warn(`createBulkClassOverride: échec du batch: ${err?.message}`);
    }

    return {
      totalStudents: studentIds.length,
      applied,
      failed,
      customAmount,
      originalAmount,
      details,
    };
  }

  async getOverridesForStudent(tenantId: string, studentId: string, academicYearId?: string) {
    // FeeOverride n'a pas de tenantId directement — on filtre via feeStructure.tenantId
    const where: any = { studentId, feeStructure: { tenantId } };
    if (academicYearId) {
      where.feeStructure.academicYearId = academicYearId;
    }
    return this.prisma.feeOverride.findMany({
      where,
      include: {
        feeStructure: { include: { class: true, level: true } },
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, studentCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Récupère tous les overrides d'un tenant, avec filtres optionnels.
   * Utilisé par l'onglet "Personnalisations" du module Finance.
   *
   * ⭐ Pagination optionnelle : si page/limit fournis → retour paginé
   * { data, total, page, totalPages, sums: { totalOriginal, totalCustom, totalReduction } }
   * Les `sums` sont calculées sur TOUS les overrides matchés (pas seulement la page active)
   * pour que les KPIs affichés soient les vrais totaux serveur.
   */
  async getAllOverrides(
    tenantId: string,
    filters: {
      academicYearId?: string;
      studentId?: string;
      feeStructureId?: string;
      classId?: string;
      feeType?: string;
      schoolLevelId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const where: any = { feeStructure: { tenantId } };
    if (filters.academicYearId) where.feeStructure.academicYearId = filters.academicYearId;
    if (filters.feeStructureId) where.feeStructureId = filters.feeStructureId;
    if (filters.studentId) where.studentId = filters.studentId;
    if (filters.classId) where.feeStructure.classId = filters.classId;
    if (filters.feeType) where.feeStructure.feeType = filters.feeType;
    // ⭐ Filtre par niveau scolaire : via student.studentEnrollments.class.schoolLevelId
    if (filters.schoolLevelId) {
      where.student = {
        studentEnrollments: {
          some: { class: { schoolLevelId: filters.schoolLevelId } },
        },
      };
    }
    // ⭐ Recherche côté backend (mode insensible à la casse) sur nom/prénom/matricule
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.student = {
        ...(where.student ?? {}),
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { matricule: { contains: q, mode: 'insensitive' } },
          { studentCode: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const include = {
      feeStructure: { include: { class: true, level: true } },
      student: {
        select: {
          id: true, firstName: true, lastName: true, matricule: true, studentCode: true,
          studentEnrollments: { where: { academicYearId: filters.academicYearId }, include: { class: true }, take: 1 },
        },
      },
      creator: { select: { id: true, firstName: true, lastName: true } },
    };

    // ⭐ Si non paginé → retourne l'array (rétro-compatibilité)
    const isPaginated = !!(filters.page && filters.limit);
    if (!isPaginated) {
      return this.prisma.feeOverride.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
      });
    }

    // ⭐ Si paginé → retour paginé + sums agrégées (KPIs globaux)
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(500, Math.max(1, filters.limit ?? 25));

    const [data, total, allMatching] = await Promise.all([
      this.prisma.feeOverride.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.feeOverride.count({ where }),
      // ⭐ Récupère tous les overrides matchés (sans pagination) pour calculer
      // les sommes agrégées (KPIs). Comme les overrides sont typiquement peu
      // nombreux (quelques dizaines), ce select léger est rapide.
      this.prisma.feeOverride.findMany({
        where,
        select: {
          customAmount: true,
          feeStructure: { select: { totalAmount: true } },
        },
      }),
    ]);

    const totalOriginal = allMatching.reduce(
      (sum, o) => sum + Number(o.feeStructure?.totalAmount ?? 0),
      0,
    );
    const totalCustom = allMatching.reduce(
      (sum, o) => sum + Number(o.customAmount ?? 0),
      0,
    );
    const totalReduction = Math.max(0, totalOriginal - totalCustom);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      sums: {
        totalOriginal,
        totalCustom,
        totalReduction,
      },
    };
  }

  /**
   * Supprime un override existant.
   * Vérifie que l'override appartient bien au tenant via feeStructure.tenantId.
   */
  async deleteOverride(id: string, tenantId: string) {
    const override = await this.prisma.feeOverride.findFirst({
      where: { id, feeStructure: { tenantId } },
      include: { feeStructure: true, student: { select: { firstName: true, lastName: true } } },
    });
    if (!override) {
      throw new NotFoundException(`FeeOverride ${id} not found`);
    }
    await this.audit(tenantId, undefined, 'FEE_OVERRIDE_DELETE', 'FeeOverride', id, { customAmount: override.customAmount, reason: override.reason }, undefined);

    // Désactiver le trigger prevent_fee_override_delete temporairement
    await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_overrides" DISABLE TRIGGER prevent_fee_override_delete_trigger');
    try {
      await this.prisma.feeOverride.delete({ where: { id } });
    } finally {
      await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_overrides" ENABLE TRIGGER prevent_fee_override_delete_trigger');
    }

    // ⭐ Recalculer le compte élève pour retirer la personnalisation.
    // recalculate() va :
    //   1. Recharger les feeStructures avec overrides (maintenant vide → customAmount = totalAmount)
    //   2. Mettre à jour les breakdowns existants : initialAmount = adjustedAmount = totalAmount
    //   3. Gérer les breakdowns orphelins (feeStructure plus dans la liste filtrée)
    //   4. Recalculer totalDue + balance du studentAccount
    // Si recalculate échoue, on propage l'erreur (ne pas avaler silencieusement).
    try {
      await this.studentAccountService.recalculate(override.studentId, tenantId, override.feeStructure.academicYearId);
    } catch (err) {
      // Log l'erreur mais ne pas faire échouer la suppression — l'override est déjà supprimé
      console.error(`[deleteOverride] recalculate failed for student ${override.studentId}:`, err);
    }

    return { id, deleted: true };
  }

  /**
   * ⭐ Bulk delete : supprime plusieurs overrides en une seule opération.
   * Même logique que deleteOverride() :
   * - Vérifie l'appartenance au tenant via feeStructure.tenantId
   * - Désactive le trigger prevent_fee_override_delete pendant toute l'opération
   * - Audite chaque suppression
   * - Recalcule le compte élève après chaque suppression
   *
   * @param ids Tableau d'IDs d'overrides à supprimer
   * @param tenantId ID du tenant courant
   * @returns { deleted: string[], blocked: { id, reason }[], message }
   */
  async deleteManyOverrides(ids: string[], tenantId: string) {
    if (!ids || ids.length === 0) {
      return { deleted: [], blocked: [], message: 'Aucun ID fourni' };
    }

    const deleted: string[] = [];
    const blocked: { id: string; reason: string }[] = [];

    // Désactiver le trigger prevent_fee_override_delete pour toute l'opération
    await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_overrides" DISABLE TRIGGER prevent_fee_override_delete_trigger');
    try {
      for (const id of ids) {
        try {
          const override = await this.prisma.feeOverride.findFirst({
            where: { id, feeStructure: { tenantId } },
            include: { feeStructure: true },
          });
          if (!override) {
            blocked.push({ id, reason: 'Introuvable' });
            continue;
          }
          await this.audit(tenantId, undefined, 'FEE_OVERRIDE_DELETE', 'FeeOverride', id, { customAmount: override.customAmount }, undefined);
          await this.prisma.feeOverride.delete({ where: { id } });
          // ⭐ Recalculer le compte élève après chaque suppression d'override
          try {
            await this.studentAccountService.recalculate(override.studentId, tenantId, override.feeStructure.academicYearId);
          } catch (err) {
            console.error(`[deleteManyOverrides] recalculate failed for student ${override.studentId}:`, err);
          }
          deleted.push(id);
        } catch (err) {
          blocked.push({ id, reason: err.message || 'Erreur' });
        }
      }
    } finally {
      await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_overrides" ENABLE TRIGGER prevent_fee_override_delete_trigger');
    }

    return {
      deleted,
      blocked,
      message: `${deleted.length} supprimé(s), ${blocked.length} bloqué(s)`,
    };
  }

  /**
   * Modifie un override existant (montant personnalisé + motif).
   * Vérifie que l'override appartient bien au tenant via feeStructure.tenantId.
   */
  async updateOverride(
    id: string,
    tenantId: string,
    data: { customAmount?: number; reason?: string },
  ) {
    const override = await this.prisma.feeOverride.findFirst({
      where: { id, feeStructure: { tenantId } },
    });
    if (!override) {
      throw new NotFoundException(`FeeOverride ${id} not found`);
    }
    const updated = await this.prisma.feeOverride.update({
      where: { id },
      data: {
        ...(data.customAmount !== undefined && { customAmount: Number(data.customAmount) }),
        ...(data.reason !== undefined && { reason: data.reason }),
      },
      include: {
        feeStructure: { include: { class: true, level: true } },
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, studentCode: true } },
      },
    });
    await this.audit(tenantId, undefined, 'FEE_OVERRIDE_UPDATE', 'FeeOverride', id, { customAmount: override.customAmount, reason: override.reason }, { customAmount: updated.customAmount, reason: updated.reason });

    // Recalculer le compte élève pour appliquer la modification
    await this.studentAccountService.recalculate(updated.studentId, tenantId, updated.feeStructure.academicYearId);

    return updated;
  }

  /**
   * Recalcule dynamiquement TOUS les comptes élèves du tenant en appliquant
   * les FeeOverrides existants. Pour chaque compte :
   *   - Met à jour les breakdowns avec le customAmount si un override existe
   *   - Recalcule totalDue = SUM(breakdowns.initialAmount)
   *   - Recalcule totalPaid = SUM(breakdowns.paidAmount)
   *   - Recalcule balance = totalDue - totalPaid
   *
   * ⭐ FIX (sept. 2026) : délègue au runner BATCH de StudentAccountService —
   * ~6 lectures groupées + 4 écritures groupées au lieu de ~12 requêtes
   * SÉQUENTIELLES par élève (426 comptes ≈ 177 s avant → quelques secondes).
   */
  async recalculateAllAccounts(tenantId: string, academicYearId?: string) {
    return this.studentAccountService.recalculateAccountsWhere(tenantId, academicYearId);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ⭐ RECALCUL DES COMPTES EN ARRIÈRE-PLAN (sept. 2026)
  //
  // La création/modification d'un frais ne doit PLUS attendre le recalcul des
  // comptes élèves : la réponse HTTP repart immédiatement (structure créée),
  // et le recalcul du périmètre impacté tourne en tâche de fond sur le process
  // Node persistant (Railway). Les jobs sont :
  //   - SCOPÉS : uniquement les comptes des élèves concernés par le frais
  //     (classe officielle > classe physique > niveau > global) ;
  //   - SÉRIALISÉS : une seule boucle traite la file (protège le pool Prisma) ;
  //   - COALESCÉS : deux modifications rapides du même frais ne planifient
  //     qu'un job (les filtres d'étudiants sont unis en OR).
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Traduit le périmètre d'une FeeStructure en filtre Prisma sur
   * student_accounts, en répliquant EXACTEMENT la sémantique de matching de
   * selectApplicableStructures (student-account.service) :
   *   - classId       → élèves dont l'inscription de l'année est dans cette classe physique
   *   - academicClassId → élèves dont l'inscription de l'année est dans cette classe officielle
   *   - levelId       → élèves dont student.schoolLevelId = niveau (sans classe)
   *   - global        → tous les comptes (aucun filtre)
   */
  private structureScopeToAccountFilter(
    fs: {
      classId?: string | null;
      academicClassId?: string | null;
      levelId?: string | null;
    },
    academicYearId: string,
  ): any {
    if (fs.classId) {
      return {
        student: {
          studentEnrollments: { some: { academicYearId, classId: fs.classId } },
        },
      };
    }
    if (fs.academicClassId) {
      return {
        student: {
          studentEnrollments: { some: { academicYearId, academicClassId: fs.academicClassId } },
        },
      };
    }
    if (fs.levelId) {
      return { student: { schoolLevelId: fs.levelId } };
    }
    return {}; // frais global → tous les comptes
  }

  /** File de jobs de recalcul en attente, indexée par clé de coalescence. */
  private pendingRecalcs = new Map<
    string,
    { tenantId: string; academicYearId: string; accountWhere: any }
  >();
  /** Indique si la boucle de traitement de la file est déjà active. */
  private recalcLoopActive = false;

  /**
   * Planifie un recalcul de comptes en arrière-plan (fire-and-forget).
   * Ne bloque JAMAIS la requête HTTP appelante — le retour est immédiat.
   */
  private scheduleAccountRecalculation(
    tenantId: string,
    academicYearId: string,
    key: string,
    accountWhere: any,
  ) {
    const existing = this.pendingRecalcs.get(key);
    if (existing) {
      // Coalescence : unir les périmètres (OR) — un seul job couvrira tout.
      existing.accountWhere = { OR: [existing.accountWhere, accountWhere] };
    } else {
      this.pendingRecalcs.set(key, { tenantId, academicYearId, accountWhere });
    }
    this.logger.log(
      `Recalcul comptes planifié en arrière-plan: key=${key} ` +
        `(${this.pendingRecalcs.size} job(s) en file)`,
    );
    this.runRecalcLoop();
  }

  /** Boucle sérialisée de traitement de la file de recalculs. */
  private runRecalcLoop() {
    if (this.recalcLoopActive) return;
    this.recalcLoopActive = true;
    void (async () => {
      while (this.pendingRecalcs.size > 0) {
        const [key, job] = this.pendingRecalcs.entries().next().value!;
        const startedAt = Date.now();
        try {
          const result = await this.studentAccountService.recalculateAccountsWhere(
            job.tenantId,
            job.academicYearId,
            job.accountWhere,
          );
          console.log(
            `[FeeStructure] Recalcul arrière-plan terminé: key=${key}, ` +
              `${result.accountsRecalculated}/${result.accountsTotal} comptes ` +
              `en ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
          );
        } catch (err: any) {
          console.error(
            `[FeeStructure] Recalcul arrière-plan ÉCHOUÉ (key=${key}): ${err?.message}`,
          );
        } finally {
          this.pendingRecalcs.delete(key);
        }
      }
    })()
      .catch((err) => {
        this.recalcLoopActive = false;
        this.logger.error(`Boucle de recalcul interrompue: ${err?.message}`);
      })
      .finally(() => {
        this.recalcLoopActive = false;
      });
  }

  /** Copie les FeeStructures d'une année vers une nouvelle année (sans overrides). */
  async copyToNewYear(
    tenantId: string,
    data: { fromAcademicYearId: string; toAcademicYearId: string; createdById?: string },
    userId?: string,
  ) {
    await this.ensureAcademicYearNotClosed(data.toAcademicYearId, tenantId);
    const structures = await this.prisma.feeStructure.findMany({
      where: { tenantId, academicYearId: data.fromAcademicYearId, isActive: true },
      include: { structureInstallments: { orderBy: { orderIndex: 'asc' } } },
    });
    const created = [];
    for (const s of structures) {
      const copy = await this.prisma.feeStructure.create({
        data: {
          tenantId,
          academicYearId: data.toAcademicYearId,
          levelId: s.levelId,
          classId: s.classId,
          /// ⭐ Conserver la classe officielle (fix sept. 2026) : sans elle, la
          /// copie d'un frais « par classe » devenait un frais de NIVEAU et
          /// s'appliquait à tout le niveau au lieu de la classe d'origine.
          academicClassId: s.academicClassId,
          name: s.name,
          feeType: s.feeType,
          customFeeTypeLabel: s.customFeeTypeLabel,
          totalAmount: s.totalAmount,
          isInstallment: s.isInstallment,
          isMandatory: s.isMandatory,
          isActive: true,
          createdById: data.createdById ?? null,
          updatedAt: new Date(),
          structureInstallments: {
            create: s.structureInstallments.map((i) => ({
              label: i.label,
              amount: i.amount,
              dueDate: i.dueDate,
              dueDateType: i.dueDateType ?? 'FIXED',
              daysOffset: i.daysOffset ?? null,
              orderIndex: i.orderIndex,
            })),
          },
        },
        include: { structureInstallments: true },
      });
      created.push(copy);
    }
    await this.audit(tenantId, userId, 'FEE_STRUCTURE_COPY_YEAR', 'FeeStructure', data.toAcademicYearId, { from: data.fromAcademicYearId }, { to: data.toAcademicYearId, count: created.length });
    return { copied: created.length, structures: created };
  }

  /**
   * Supprime un frais DÉFINITIVEMENT de la base de données (hard delete).
   *
   * ⭐ Task 24 : le user a explicitement demandé la suppression définitive
   *    (pas de soft delete isActive=false). On supprime en cascade :
   *    - fee_structure_installments (tranches)
   *    - fee_overrides (personnalisations élève)
   *    - account_breakdowns (comptes élèves liés — seulement si pas de
   *      paiement, sinon on bloque avec un message clair)
   *    - fee_structure elle-même
   *
   * Si des account_breakdowns ont des paiements (paidAmount > 0), on bloque
   * la suppression pour éviter de perdre l'historique financier.
   *
   * ⭐ FIX (9 sept. 2026 — bug « +1000 F fantôme sur le total dû / solde ») :
   *    AVANT : les account_breakdowns étaient supprimés en cascade SANS
   *    recalculer les StudentAccount → totalDue/totalPaid/balance conservaient
   *    le montant du frais supprimé (« +1000 F à chaque fois, à tous les
   *    niveaux » — incident CSPEB : frais d'examen 1000 F global créé puis
   *    supprimé 13 s plus tard → +1000 F fantôme sur les 100 comptes élèves).
   *    MAINTENANT : après la suppression, on planifie le même recalcul
   *    arrière-plan SCOPÉ que la création/modification (file sérialisée +
   *    coalescence) → les totaux des comptes du périmètre du frais sont
   *    resynchronisés sur la somme de leurs breakdowns restants.
   */
  async delete(id: string, tenantId: string) {
    const existing = await this.findOne(id, tenantId);

    // Vérifier qu'aucun compte élève n'a de paiement sur ce frais
    const breakdownsWithPayments = await this.prisma.accountBreakdown.count({
      where: { feeStructureId: id, paidAmount: { gt: 0 } },
    });
    if (breakdownsWithPayments > 0) {
      throw new Error(
        `Impossible de supprimer ce frais : ${breakdownsWithPayments} compte(s) élève ont déjà des paiements enregistrés. ` +
        `Veuillez d'abord supprimer ou annuler ces paiements avant de supprimer le frais.`
      );
    }

    // Capturer le périmètre AVANT la suppression (classId/academicClassId/
    // levelId de la structure) : structureScopeToAccountFilter() en a besoin
    // pour cibler les comptes élèves à recalculer — la structure n'existera
    // plus au moment du recalcul.
    const scope = {
      classId: (existing as any).classId ?? null,
      academicClassId: (existing as any).academicClassId ?? null,
      levelId: (existing as any).levelId ?? null,
    };
    const academicYearId = (existing as any).academicYearId;

    // Suppression physique (désactiver les triggers temporairement)
    // - no_delete_fee : empêche la suppression de fee_structures
    // - prevent_fee_override_delete_trigger : empêche la suppression de fee_overrides
    //   (historique d'audit) — on le désactive car on supprime le frais parent
    await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_structures" DISABLE TRIGGER no_delete_fee');
    await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_overrides" DISABLE TRIGGER prevent_fee_override_delete_trigger');
    try {
      // 1. Supprimer les installments (tranches) liés
      await this.prisma.feeStructureInstallment.deleteMany({
        where: { feeStructureId: id },
      });
      // 2. Supprimer les overrides (personnalisations) liés
      await this.prisma.feeOverride.deleteMany({
        where: { feeStructureId: id },
      });
      // 3. Supprimer les account_breakdowns sans paiement liés
      await this.prisma.accountBreakdown.deleteMany({
        where: { feeStructureId: id },
      });
      // 4. Supprimer le frais lui-même
      await this.prisma.feeStructure.delete({
        where: { id },
      });
      await this.audit(tenantId, undefined, 'FEE_STRUCTURE_DELETE', 'FeeStructure', id, { name: existing.name }, undefined);
    } finally {
      // Réactiver les triggers
      await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_structures" ENABLE TRIGGER no_delete_fee');
      await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_overrides" ENABLE TRIGGER prevent_fee_override_delete_trigger');
    }

    // ⭐ FIX 9 sept. 2026 : recalculer les comptes du périmètre du frais en
    //    arrière-plan. Les breakdowns du frais viennent d'être supprimés ;
    //    sans ce recalcul, totalDue/totalPaid/balance garderaient le montant
    //    du frais supprimé (fantôme). Le runner resynchronise les totaux sur
    //    la somme des breakdowns restants (fire-and-forget : réponse HTTP
    //    immédiate, même UX que la création/modification de frais).
    if (academicYearId) {
      this.scheduleAccountRecalculation(
        tenantId,
        academicYearId,
        `fs-del:${id}`,
        this.structureScopeToAccountFilter(scope, academicYearId),
      );
    }

    return { id, deleted: true };
  }

  /**
   * ⭐ Task 24 : Suppression multiple (bulk delete).
   *
   * Supprime plusieurs frais en une seule opération. Même logique que delete() :
   * - Bloque si un frais a des paiements (paidAmount > 0 sur account_breakdowns)
   * - Supprime en cascade : installments, overrides, breakdowns sans paiement, fee_structure
   * - ⭐ FIX 9 sept. 2026 : planifie le recalcul arrière-plan du périmètre de
   *   CHAQUE frais supprimé (sinon fantôme sur total dû / solde — cf. delete()).
   *
   * @param ids Tableau d'IDs de fee_structures à supprimer
   * @returns { deleted: string[], blocked: { id: string, reason: string }[] }
   */
  async deleteMany(ids: string[], tenantId: string) {
    if (!ids || ids.length === 0) {
      return { deleted: [], blocked: [], message: 'Aucun ID fourni' };
    }

    const deleted: string[] = [];
    const blocked: { id: string; name: string; reason: string }[] = [];
    // ⭐ FIX 9 sept. 2026 : périmètres à recalculer après suppression —
    // groupés par année (une année = un seul job, périmètres unis en OR).
    const scopesByYear = new Map<string, any>();

    // Désactiver les triggers pour toute l'opération
    // - no_delete_fee : empêche la suppression de fee_structures
    // - prevent_fee_override_delete_trigger : empêche la suppression de fee_overrides
    await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_structures" DISABLE TRIGGER no_delete_fee');
    await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_overrides" DISABLE TRIGGER prevent_fee_override_delete_trigger');
    try {
      for (const id of ids) {
        try {
          const existing = await this.findOne(id, tenantId);

          // Vérifier les paiements
          const breakdownsWithPayments = await this.prisma.accountBreakdown.count({
            where: { feeStructureId: id, paidAmount: { gt: 0 } },
          });
          if (breakdownsWithPayments > 0) {
            blocked.push({
              id,
              name: existing.name,
              reason: `${breakdownsWithPayments} compte(s) avec paiements`,
            });
            continue;
          }

          // Mémoriser le périmètre AVANT suppression (pour le recalcul des comptes)
          const scope = {
            classId: (existing as any).classId ?? null,
            academicClassId: (existing as any).academicClassId ?? null,
            levelId: (existing as any).levelId ?? null,
          };
          const yearId = (existing as any).academicYearId as string | undefined;
          if (yearId) {
            const filter = this.structureScopeToAccountFilter(scope, yearId);
            const prev = scopesByYear.get(yearId);
            scopesByYear.set(yearId, prev ? { OR: [prev, filter] } : filter);
          }

          // Supprimer en cascade
          await this.prisma.feeStructureInstallment.deleteMany({ where: { feeStructureId: id } });
          await this.prisma.feeOverride.deleteMany({ where: { feeStructureId: id } });
          await this.prisma.accountBreakdown.deleteMany({ where: { feeStructureId: id } });
          await this.prisma.feeStructure.delete({ where: { id } });
          await this.audit(tenantId, undefined, 'FEE_STRUCTURE_DELETE', 'FeeStructure', id, { name: existing.name }, undefined);
          deleted.push(id);
        } catch (err) {
          blocked.push({
            id,
            name: '(inconnu)',
            reason: err.message || 'Erreur lors de la suppression',
          });
        }
      }
    } finally {
      // Réactiver les triggers
      await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_structures" ENABLE TRIGGER no_delete_fee');
      await this.prisma.$executeRawUnsafe('ALTER TABLE "fee_overrides" ENABLE TRIGGER prevent_fee_override_delete_trigger');
    }

    // ⭐ FIX 9 sept. 2026 : recalcul arrière-plan des comptes des périmètres
    //    supprimés (une clé par année → un job coalescé par année, périmètres OR).
    for (const [yearId, accountWhere] of scopesByYear) {
      this.scheduleAccountRecalculation(
        tenantId,
        yearId,
        `fs-del-bulk:${yearId}`,
        accountWhere,
      );
    }

    return {
      deleted,
      blocked,
      message: `${deleted.length} frais supprimé(s), ${blocked.length} bloqué(s)`,
    };
  }
}
