/**
 * ============================================================================
 * EVALUATIONS SERVICE - MODULE 3
 * ============================================================================
 *
 * Gestion du cycle de vie des évaluations (devoirs, compositions, examens
 * blancs, épreuves pratiques, oraux, évaluations mensuelles/certificatives).
 *
 * Cycle de vie :
 *   DRAFT → PLANNED → OPEN_FOR_GRADING → SUBMITTED → VALIDATED → LOCKED
 *                                                ↘ CANCELLED (depuis n'importe quel état)
 *
 * Endpoints supportés :
 *   - findAll (GET /evaluations)
 *   - findOne (GET /evaluations/:id)
 *   - create (POST /evaluations) → status=PLANNED
 *   - update (PATCH /evaluations/:id) — bloqué si VALIDATED/LOCKED/CANCELLED
 *   - remove (DELETE /evaluations/:id) — soft-cancel si notes, sinon hard delete
 *   - open (POST /evaluations/:id/open) — PLANNED → OPEN_FOR_GRADING
 *   - submitForValidation (PATCH /evaluations/:id/submit)
 *   - validate (PATCH /evaluations/:id/validate)
 *   - cancel (POST /evaluations/:id/cancel) — any → CANCELLED
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liste les évaluations filtrées
   */
  async findAll(tenantId: string, academicYearId: string, filters: any) {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (filters.schoolLevelId) where.class = { schoolLevelId: filters.schoolLevelId };
    if (filters.classId) where.classId = filters.classId;
    if (filters.status) where.status = filters.status;
    if (filters.periodId) where.periodId = filters.periodId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.teacherId) where.teacherId = filters.teacherId;
    if (filters.evaluationTypeId) where.evaluationTypeId = filters.evaluationTypeId;
    if (filters.language) {
      // Filtrage par piste linguistique (FR/EN) via la classe
      where.class = { ...where.class, language: filters.language };
    }

    return this.prisma.evaluation.findMany({
      where,
      include: {
        class: true,
        subject: true,
        evaluationType: true,
        period: true,
        gradeScale: true,
        _count: {
          select: { grades: true }
        }
      },
      orderBy: { evaluationDate: 'desc' },
    });
  }

  /**
   * Récupère une évaluation par son ID
   */
  async findOne(id: string, tenantId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id, tenantId },
      include: {
        class: true,
        subject: true,
        evaluationType: true,
        period: true,
        gradeScale: true,
        grades: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                matricule: true,
              }
            }
          }
        },
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        validator: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        _count: { select: { grades: true } }
      }
    });

    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');
    return evaluation;
  }

  /**
   * Crée une nouvelle évaluation
   */
  async create(tenantId: string, academicYearId: string, data: any) {
    // Validation du type d'évaluation pour le barème par défaut
    const type = await this.prisma.evaluationType.findUnique({
      where: { id: data.evaluationTypeId },
    });

    if (!type) throw new NotFoundException('Type d\'évaluation non trouvé');

    // Vérifier que la période n'est pas clôturée
    if (data.periodId) {
      const period = await this.prisma.academicPeriod.findUnique({
        where: { id: data.periodId },
      });
      if (period?.isClosed) {
        throw new BadRequestException('La période est clôturée — impossible de créer une nouvelle évaluation.');
      }
    }

    return this.prisma.evaluation.create({
      data: {
        tenantId,
        academicYearId,
        classId: data.classId,
        subjectId: data.subjectId,
        periodId: data.periodId,
        evaluationTypeId: data.evaluationTypeId,
        title: data.title || null,
        description: data.description || null,
        evaluationDate: data.evaluationDate ? new Date(data.evaluationDate) : new Date(),
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        maxScore: data.maxScore ?? type.defaultMaxScore ?? 20,
        coefficient: data.coefficient ?? type.defaultCoefficient ?? 1,
        teacherId: data.teacherId || null,
        gradeScaleId: data.gradeScaleId || null,
        status: 'PLANNED',
        createdBy: data.createdBy || null,
      },
      include: {
        class: true,
        subject: true,
        evaluationType: true,
        period: true,
        gradeScale: true,
      },
    });
  }

  /**
   * ⭐ Crée plusieurs évaluations en une seule transaction (bulk create).
   * Utilisé quand l'admin sélectionne plusieurs classes + plusieurs matières
   * dans le modal de création — on génère une évaluation par combinaison.
   *
   * Exemple : 2 classes × 3 matières = 6 évaluations créées.
   *
   * Le teacherId est résolu automatiquement via TeacherClassAssignment :
   * pour chaque (classe × matière), on cherche l'enseignant assigné.
   */
  async createBulk(tenantId: string, academicYearId: string, data: {
    classIds: string[];
    subjectIds: string[];
    periodId: string;
    evaluationTypeId: string;
    title?: string;
    description?: string;
    evaluationDate: string;
    maxScore?: number;
    coefficient?: number;
    createdBy?: string;
  }) {
    // Validation du type
    const type = await this.prisma.evaluationType.findUnique({
      where: { id: data.evaluationTypeId },
    });
    if (!type) throw new NotFoundException('Type d\'évaluation non trouvé');

    // Vérifier que la période n'est pas clôturée
    const period = await this.prisma.academicPeriod.findUnique({
      where: { id: data.periodId },
    });
    if (period?.isClosed) {
      throw new BadRequestException('La période est clôturée — impossible de créer des évaluations.');
    }

    if (!data.classIds?.length || !data.subjectIds?.length) {
      throw new BadRequestException('Au moins une classe et une matière sont requises.');
    }

    // ⭐ Résoudre les enseignants assignés pour chaque (classe × matière)
    // via TeacherClassAssignment
    const assignments = await this.prisma.teacherClassAssignment.findMany({
      where: {
        tenantId,
        academicYearId,
        classId: { in: data.classIds },
        subjectId: { in: data.subjectIds },
      },
      select: { classId: true, subjectId: true, teacherId: true },
    });

    // Construire une map : `${classId}|${subjectId}` → teacherId
    const teacherMap = new Map<string, string>();
    for (const a of assignments) {
      const key = `${a.classId}|${a.subjectId}`;
      // Si plusieurs enseignants pour la même combo, on prend le premier
      if (!teacherMap.has(key)) {
        teacherMap.set(key, a.teacherId);
      }
    }

    // Générer toutes les combinaisons
    const evaluationsToCreate: Array<{
      tenantId: string;
      academicYearId: string;
      classId: string;
      subjectId: string;
      periodId: string;
      evaluationTypeId: string;
      title: string | null;
      description: string | null;
      evaluationDate: Date;
      maxScore: number;
      coefficient: number;
      teacherId: string | null;
      status: string;
      createdBy: string | null;
    }> = [];

    for (const classId of data.classIds) {
      for (const subjectId of data.subjectIds) {
        const teacherId = teacherMap.get(`${classId}|${subjectId}`) || null;
        evaluationsToCreate.push({
          tenantId,
          academicYearId,
          classId,
          subjectId,
          periodId: data.periodId,
          evaluationTypeId: data.evaluationTypeId,
          title: data.title || null,
          description: data.description || null,
          evaluationDate: data.evaluationDate ? new Date(data.evaluationDate) : new Date(),
          maxScore: data.maxScore ?? type.defaultMaxScore ?? 20,
          coefficient: data.coefficient ?? type.defaultCoefficient ?? 1,
          teacherId,
          status: 'PLANNED',
          createdBy: data.createdBy || null,
        });
      }
    }

    // Créer toutes les évaluations en transaction
    const result = await this.prisma.$transaction(
      evaluationsToCreate.map((evalData) =>
        this.prisma.evaluation.create({ data: evalData })
      )
    );

    return {
      created: result.length,
      evaluations: result,
      teachersAssigned: teacherMap.size,
      message: `${result.length} évaluation(s) créée(s) pour ${data.classIds.length} classe(s) × ${data.subjectIds.length} matière(s). ${teacherMap.size} enseignant(s) auto-assigné(s).`,
    };
  }

  /**
   * Met à jour une évaluation
   * Bloqué si status ∈ {VALIDATED, LOCKED, CANCELLED}
   */
  async update(id: string, tenantId: string, data: any) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id, tenantId },
    });

    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    const lockedStatuses = ['VALIDATED', 'LOCKED', 'CANCELLED'];
    if (lockedStatuses.includes(evaluation.status)) {
      throw new BadRequestException(
        `Impossible de modifier une évaluation avec le statut "${evaluation.status}".`
      );
    }

    // Champs autorisés à la mise à jour
    const allowedFields = [
      'title', 'description', 'evaluationDate', 'startDate', 'endDate',
      'maxScore', 'coefficient',
      'teacherId', 'gradeScaleId', 'classId', 'subjectId', 'periodId', 'evaluationTypeId',
    ];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if ((field === 'evaluationDate' || field === 'startDate' || field === 'endDate') && data[field]) {
          updateData[field] = new Date(data[field]);
        } else {
          updateData[field] = data[field];
        }
      }
    }

    return this.prisma.evaluation.update({
      where: { id },
      data: updateData,
      include: {
        class: true,
        subject: true,
        evaluationType: true,
        period: true,
        gradeScale: true,
      },
    });
  }

  /**
   * Supprime une évaluation
   * - Si l'évaluation a des notes → soft-cancel (status=CANCELLED)
   * - Sinon → hard delete
   */
  async remove(id: string, tenantId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { grades: true } } }
    });

    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    if (evaluation.status === 'VALIDATED' || evaluation.status === 'LOCKED') {
      throw new BadRequestException(
        `Impossible de supprimer une évaluation ${evaluation.status}. Annulez-la d'abord.`
      );
    }

    if (evaluation._count.grades > 0) {
      // Soft-cancel : l'évaluation reste visible dans l'historique
      return this.prisma.evaluation.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    }

    // Hard delete — aucune note associée
    await this.prisma.evaluation.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Ouvre une évaluation pour la saisie des notes
   * Transition : PLANNED → OPEN_FOR_GRADING
   */
  async open(id: string, tenantId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id, tenantId },
    });

    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    if (evaluation.status !== 'PLANNED' && evaluation.status !== 'DRAFT') {
      throw new BadRequestException(
        `L'évaluation doit être en statut PLANNED ou DRAFT pour être ouverte. Statut actuel: ${evaluation.status}`
      );
    }

    return this.prisma.evaluation.update({
      where: { id },
      data: { status: 'OPEN_FOR_GRADING' },
      include: {
        class: true,
        subject: true,
        evaluationType: true,
      },
    });
  }

  /**
   * Soumet une évaluation pour validation
   * Transition : OPEN_FOR_GRADING → SUBMITTED
   */
  async submitForValidation(id: string, tenantId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id, tenantId },
      include: { grades: true }
    });

    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    if (evaluation.status !== 'OPEN_FOR_GRADING') {
      throw new BadRequestException(
        `L'évaluation doit être ouverte à la saisie pour être soumise. Statut actuel: ${evaluation.status}`
      );
    }

    // Vérifier que toutes les notes sont saisies
    const studentCount = await this.prisma.classStudent.count({
      where: { classId: evaluation.classId, academicYearId: evaluation.academicYearId }
    });

    if (evaluation.grades.length < studentCount) {
      throw new BadRequestException(`Saisie incomplète : ${evaluation.grades.length}/${studentCount} notes saisies.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Mettre à jour l'évaluation
      const updatedEval = await tx.evaluation.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      });

      // 2. Créer le lot de validation (si pas déjà existant)
      const existingBatch = await tx.gradeValidationBatch.findFirst({
        where: { evaluationId: evaluation.id }
      });

      if (!existingBatch) {
        await tx.gradeValidationBatch.create({
          data: {
            tenantId: evaluation.tenantId,
            academicYearId: evaluation.academicYearId,
            periodId: evaluation.periodId,
            evaluationId: evaluation.id,
            classId: evaluation.classId,
            subjectId: evaluation.subjectId,
            status: 'PENDING',
            submittedById: evaluation.createdBy || 'SYSTEM',
            submittedAt: new Date(),
          },
        });
      }

      return updatedEval;
    });
  }

  /**
   * Valide une évaluation (Admin/Directeur)
   * Transition : SUBMITTED → VALIDATED
   */
  async validate(id: string, tenantId: string, validatedBy: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id, tenantId },
    });

    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    if (evaluation.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `L'évaluation doit être soumise pour être validée. Statut actuel: ${evaluation.status}`
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedEval = await tx.evaluation.update({
        where: { id },
        data: {
          status: 'VALIDATED',
          validatedById: validatedBy,
          validatedAt: new Date(),
        },
      });

      // Verrouiller les notes associées
      await tx.grade.updateMany({
        where: { evaluationId: id },
        data: { status: 'VALIDATED' },
      });

      return updatedEval;
    });
  }

  /**
   * Annule une évaluation
   * Transition : any → CANCELLED
   * L'évaluation reste visible dans l'historique.
   */
  async cancel(id: string, tenantId: string, reason?: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id, tenantId },
    });

    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    if (evaluation.status === 'CANCELLED') {
      throw new BadRequestException('L\'évaluation est déjà annulée.');
    }

    if (evaluation.status === 'VALIDATED' || evaluation.status === 'LOCKED') {
      throw new BadRequestException(
        `Impossible d'annuler une évaluation ${evaluation.status}. Contactez un administrateur.`
      );
    }

    const updated = await this.prisma.evaluation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        // ⚠️ On conserve l'évaluation dans l'historique — elle reste visible
        // avec le badge "Annulée". La raison peut être ajoutée dans description.
        ...(reason ? { description: `[ANNULÉE — ${reason}] ${evaluation.description || ''}` } : {}),
      },
    });

    return updated;
  }
}
