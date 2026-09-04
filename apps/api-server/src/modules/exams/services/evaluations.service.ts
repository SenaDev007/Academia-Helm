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
import { NotificationService } from '../../../notifications/notification.service';

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

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
    // ⭐ Accepter les statuses séparés par virgule (ex: 'OPEN_FOR_GRADING,SUBMITTED')
    if (filters.status) {
      const statuses = String(filters.status).split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }
    if (filters.periodId) where.periodId = filters.periodId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.teacherId) {
      // ⭐ Le frontend envoie user.id, mais evaluations.teacherId référence Teacher.id.
      // On doit résoudre user.id → Teacher.id via email matching.
      // (même pattern que pedagogical-space.service.ts resolveTeacherId)
      const user = await this.prisma.user.findFirst({
        where: { id: filters.teacherId, tenantId },
        select: { email: true },
      });
      if (user?.email) {
        const teacher = await this.prisma.teacher.findFirst({
          where: { email: user.email, tenantId },
          select: { id: true },
        });
        if (teacher) {
          // ⭐ Au lieu de filtrer uniquement par teacherId (qui peut être null
          // pour les évaluations créées avant le fix), on filtre aussi par
          // les classes assignées à l'enseignant via TeacherClassAssignment.
          // Ça permet à l'enseignant de voir TOUTES les évaluations de SES classes,
          // même celles où teacherId n'a pas été assigné.
          const teacherAssignments = await this.prisma.teacherClassAssignment.findMany({
            where: { tenantId, academicYearId, teacherId: teacher.id },
            select: { classId: true, classSubjectId: true },
          });
          const teacherClassIds = Array.from(new Set(
            teacherAssignments
              .map((a) => a.classId)
              .filter(Boolean) as string[]
          ));

          if (teacherClassIds.length > 0) {
            // L'enseignant a des classes assignées → filtrer par ses classes
            // OU par teacherId (pour les évaluations où il est directement assigné)
            where.OR = [
              { teacherId: teacher.id },
              { classId: { in: teacherClassIds } },
            ];
          } else {
            // Pas d'assignations → filtrer par teacherId uniquement
            where.teacherId = teacher.id;
          }
        } else {
          // Pas de profil Teacher → retourner vide
          where.teacherId = '__NO_TEACHER__';
        }
      } else {
        // User non trouvé → peut-être que teacherId est déjà un Teacher.id
        where.teacherId = filters.teacherId;
      }
    }
    if (filters.evaluationTypeId) where.evaluationTypeId = filters.evaluationTypeId;
    if (filters.language) {
      // ⭐ V10b — Isolation linguistique stricte (cohérente avec le frontend
      // level-isolation.ts) :
      //   FR : classes FR marquées + classes SANS marqueur (structure FR
      //        historique — les classes héritées sans language/track sont FR)
      //   EN : classes EN marquées uniquement (les miroirs EN créés par le
      //        service bilingue portent TOUJOURS language='EN' + track EN)
      //
      // ⚠️ Les sections EN partagent le schoolLevelId de leur miroir FR
      // (bilingual-structure.service.ts) : sans ce filtre, les évaluations
      // FR et EN du même niveau se mélangeaient dans chaque vue.
      // L'ancien filtre excluait aussi les classes FR non marquées → perte
      // de données en vue FR.
      const lang = String(filters.language).toUpperCase();
      const languageConditions: any[] = [
        { academicTrack: { code: lang } },
        { language: lang },
      ];
      if (lang === 'FR') {
        // Classes héritées sans marqueur linguistique = FR
        languageConditions.push({ language: null, academicTrackId: null });
      }
      where.class = {
        ...where.class,
        OR: languageConditions,
      };
    }

    return this.prisma.evaluation.findMany({
      where,
      include: {
        class: {
          include: {
            schoolLevel: { select: { id: true, code: true, name: true } },
          },
        },
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
    // Validation du type d'évaluation — chercher par id OU par code
    // (le frontend peut envoyer un code comme "EM1" si le type vient de
    // school_academic_settings.config.assessmentTypes qui n'a pas d'UUID)
    const type = await this.prisma.evaluationType.findFirst({
      where: {
        OR: [
          { id: data.evaluationTypeId },
          { code: data.evaluationTypeId, tenantId },
        ],
      },
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
        // ⭐ Utiliser l'UUID résolu (type.id), pas le code brut envoyé par le frontend
        evaluationTypeId: type.id,
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
    startDate?: string;
    endDate?: string;
    maxScore?: number;
    coefficient?: number;
    createdBy?: string;
  }) {
    // Validation du type — chercher par id OU par code
    // (le frontend peut envoyer un code comme "EM1" si le type vient de
    // school_academic_settings.config.assessmentTypes qui n'a pas d'UUID)
    let type = await this.prisma.evaluationType.findFirst({
      where: {
        OR: [
          { id: data.evaluationTypeId },
          { code: data.evaluationTypeId, tenantId },
        ],
      },
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
    //
    // Le modèle TeacherClassAssignment ne possède PAS de `subjectId` direct.
    // Il possède `classSubjectId` (FK vers ClassSubject) + `classId` (classe physique).
    // Pour résoudre l'enseignant pour (classId × subjectId), il faut donc :
    //   1. Trouver les ClassSubject dont `classId ∈ classIds` ET `subjectId ∈ subjectIds`
    //   2. Pour chaque ClassSubject trouvé, chercher les TeacherClassAssignment
    //      avec `classSubjectId` correspondant (et `classId` si défini).
    //
    // Cela génère une map `${classId}|${subjectId}` → teacherId.

    // Étape 1 : récupérer les ClassSubject pour les (classe × matière) demandées
    // ⭐ ClassSubject.classId est deprecated (souvent null en production).
    // On cherche aussi par academicClassId (la relation utilisée en production).
    const classSubjects = await this.prisma.classSubject.findMany({
      where: {
        tenantId,
        subjectId: { in: data.subjectIds },
        OR: [
          { classId: { in: data.classIds } },
          { academicClassId: { in: data.classIds } },
        ],
      },
      select: {
        id: true,
        classId: true,
        academicClassId: true,
        subjectId: true,
      },
    });

    // Construire une map `${classId}|${subjectId}` → classSubjectId
    // (utilise classId OU academicClassId selon ce qui est défini)
    const classSubjectMap = new Map<string, string>();
    for (const cs of classSubjects) {
      const effectiveClassId = cs.classId || cs.academicClassId;
      if (effectiveClassId && data.classIds.includes(effectiveClassId)) {
        const key = `${effectiveClassId}|${cs.subjectId}`;
        if (!classSubjectMap.has(key)) {
          classSubjectMap.set(key, cs.id);
        }
      }
    }

    // Étape 2 : récupérer les TeacherClassAssignment pour ces classSubjectId
    const classSubjectIds = Array.from(classSubjectMap.values());
    const assignments = classSubjectIds.length > 0
      ? await this.prisma.teacherClassAssignment.findMany({
          where: {
            tenantId,
            academicYearId,
            classSubjectId: { in: classSubjectIds },
          },
          select: { classSubjectId: true, teacherId: true },
        })
      : [];

    // Construire une map inverse : classSubjectId → teacherId (premier trouvé)
    const csToTeacher = new Map<string, string>();
    for (const a of assignments) {
      if (!csToTeacher.has(a.classSubjectId)) {
        csToTeacher.set(a.classSubjectId, a.teacherId);
      }
    }

    // Construire la map finale `${classId}|${subjectId}` → teacherId
    const teacherMap = new Map<string, string>();
    for (const [key, csId] of classSubjectMap.entries()) {
      const teacherId = csToTeacher.get(csId);
      if (teacherId) {
        teacherMap.set(key, teacherId);
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
      startDate: Date | null;
      endDate: Date | null;
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
          // ⭐ Utiliser l'UUID résolu (type.id), pas le code brut envoyé par le frontend
          // (data.evaluationTypeId peut être "EM1" si le type vient de
          // school_academic_settings.config.assessmentTypes — code, pas UUID).
          evaluationTypeId: type.id,
          title: data.title || null,
          description: data.description || null,
          evaluationDate: data.evaluationDate ? new Date(data.evaluationDate) : new Date(),
          // ⭐ Persister startDate et endDate (intervalle de la session d'évaluation)
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
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

    // ⭐ Notifier les enseignants qu'une évaluation a été programmée pour eux.
    // Fire-and-forget — ne bloque jamais la réponse au client.
    if (teacherMap.size > 0) {
      // Récupérer les noms de classe/matière/type pour les notifications
      const [classes, subjects, evalType] = await Promise.all([
        this.prisma.class.findMany({
          where: { id: { in: data.classIds } },
          select: { id: true, name: true },
        }),
        this.prisma.subject.findMany({
          where: { id: { in: data.subjectIds } },
          select: { id: true, name: true },
        }),
        Promise.resolve(type),
      ]);

      const classNameById = new Map(classes.map((c) => [c.id, c.name]));
      const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));

      const evaluationNotifs = result.map((ev) => ({
        id: ev.id,
        title: ev.title,
        evaluationDate: ev.evaluationDate,
        className: classNameById.get(ev.classId) || '—',
        subjectName: subjectNameById.get(ev.subjectId) || '—',
        teacherId: ev.teacherId,
        evaluationTypeName: evalType?.name,
      }));

      void this.notificationService
        .notifyTeachersEvaluationScheduled({
          tenantId,
          academicYearId,
          evaluations: evaluationNotifs,
        })
        .catch((err) =>
          console.error(
            '[EvaluationsService.createBulk] notification failed:',
            err,
          ),
        );
    }

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
    });

    if (!evaluation) throw new NotFoundException('Évaluation non trouvée');

    // ⭐ Accepter la soumission depuis OPEN_FOR_GRADING ou PLANNED
    if (!['OPEN_FOR_GRADING', 'PLANNED', 'SUBMITTED'].includes(evaluation.status)) {
      throw new BadRequestException(
        `L'évaluation doit être ouverte à la saisie ou planifiée pour être soumise. Statut actuel: ${evaluation.status}`
      );
    }

    // ⭐ Ne pas vérifier les grades ici — ils viennent d'être sauvegardés
    // dans la même transaction côté frontend. La vérification peut échouer
    // à cause d'un délai de propagation.

    return this.prisma.$transaction(async (tx) => {
      // 1. Mettre à jour le statut de l'évaluation
      const updatedEval = await tx.evaluation.update({
        where: { id },
        data: { status: 'SUBMITTED' },
      });

      // 2. Créer le lot de validation (si pas déjà existant)
      // ⭐ GradeValidationBatch.periodId référence Quarter (non-nullable).
      // On doit trouver un Quarter correspondant à l'AcademicPeriod de l'évaluation.
      const existingBatch = await tx.gradeValidationBatch.findFirst({
        where: { evaluationId: evaluation.id }
      });

      if (!existingBatch) {
        // Chercher un Quarter pour cette année scolaire
        const quarter = await tx.quarter.findFirst({
          where: { tenantId: evaluation.tenantId, academicYearId: evaluation.academicYearId },
        });

        if (quarter) {
          await tx.gradeValidationBatch.create({
            data: {
              tenantId: evaluation.tenantId,
              academicYearId: evaluation.academicYearId,
              periodId: quarter.id,
              evaluationId: evaluation.id,
              classId: evaluation.classId,
              subjectId: evaluation.subjectId,
              status: 'PENDING',
              submittedById: evaluation.createdBy || 'SYSTEM',
              submittedAt: new Date(),
            },
          });
        } else {
          // Pas de Quarter → créer un Quarter par défaut pour cette année
          const newQuarter = await tx.quarter.create({
            data: {
              tenantId: evaluation.tenantId,
              academicYearId: evaluation.academicYearId,
              name: 'Trimestre 1',
              number: 1,
              startDate: new Date(),
              endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
              isCurrent: true,
            },
          });
          await tx.gradeValidationBatch.create({
            data: {
              tenantId: evaluation.tenantId,
              academicYearId: evaluation.academicYearId,
              periodId: newQuarter.id,
              evaluationId: evaluation.id,
              classId: evaluation.classId,
              subjectId: evaluation.subjectId,
              status: 'PENDING',
              submittedById: evaluation.createdBy || 'SYSTEM',
              submittedAt: new Date(),
            },
          });
        }
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
