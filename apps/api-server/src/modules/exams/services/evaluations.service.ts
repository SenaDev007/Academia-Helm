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
import { AcademicAuditService } from './academic-audit.service';

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly academicAuditService: AcademicAuditService,
  ) {}

  /**
   * ⭐ V1 audit — trace d'audit académique fire-and-forget : alimente
   *    academic_audit_logs (onglet Audit du module Examens, vide depuis
   *    la création car logAction n'était appelé nulle part).
   *    Ne doit JAMAIS bloquer l'opération métier.
   */
  private traceAudit(
    tenantId: string,
    academicYearId: string | null | undefined,
    action: string,
    evaluationId: string,
    oldValue: any,
    newValue: any,
    performedById?: string,
  ) {
    this.academicAuditService
      .logAction(tenantId, {
        academicYearId: academicYearId ?? undefined,
        entityType: 'EVALUATION',
        entityId: evaluationId,
        action,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
        performedById: performedById ?? undefined,
      })
      .catch((e: any) => {
        // silencieux — l'audit ne doit pas casser le flux métier
        console.warn(`[AcademicAudit] échec log ${action} eval=${evaluationId}: ${e?.message}`);
      });
  }

  /**
   * ⭐ V10e — Résolution d'un type d'évaluation PAR NIVEAU.
   *
   * Le frontend envoie souvent le CODE (ex. "EM1") car les types viennent de
   * school_academic_settings.config.assessmentTypes (sans UUID). Or un même
   * code existe pour PLUSIEURS niveaux (EM1 Maternelle, EM1 Primaire…).
   * L'ancienne résolution findFirst({ code }) renvoyait un type d'un AUTRE
   * niveau → les bulletins (qui listent les types filtrés par schoolLevelId)
   * ne trouvaient aucune évaluation → « Aucun élève / aucune note validée ».
   *
   * Ordre de résolution :
   *   1. UUID exact (si le frontend envoie l'id)
   *   2. Type scopé au schoolLevelId des classes ciblées (code + niveau)
   *   3. Type global du tenant (code, schoolLevelId null)
   *   4. Fallback historique (premier type du code, any niveau)
   */
  private async resolveEvaluationType(
    tenantId: string,
    evaluationTypeIdOrCode: string,
    classIds: string[],
  ) {
    // 1. UUID exact
    const byId = await this.prisma.evaluationType.findFirst({
      where: { id: evaluationTypeIdOrCode },
    });
    if (byId) return byId;

    // Niveau scolaire des classes ciblées (résolu une fois, réutilisé)
    let levelId: string | null = null;
    if (classIds.length > 0) {
      const targetClasses = await this.prisma.class.findMany({
        where: { id: { in: classIds }, tenantId },
        select: { schoolLevelId: true },
      });
      const levelIds = [
        ...new Set(targetClasses.map((c) => c.schoolLevelId).filter(Boolean)),
      ];
      if (levelIds.length === 1) {
        levelId = levelIds[0];
        // 2. Type scopé au schoolLevelId des classes ciblées
        const scopedType = await this.prisma.evaluationType.findFirst({
          where: {
            code: evaluationTypeIdOrCode,
            tenantId,
            schoolLevelId: levelId,
          },
        });
        if (scopedType) return scopedType;
      }
    }

    // 3. Type global du tenant (non scopé à un niveau)
    const globalType = await this.prisma.evaluationType.findFirst({
      where: {
        code: evaluationTypeIdOrCode,
        tenantId,
        schoolLevelId: null,
      },
    });
    if (globalType) return globalType;

    // 4. Fallback historique — MAIS jamais un type scopé à un AUTRE niveau :
    //    si les classes ciblent le niveau N, un type du code scopé à N'≠N
    //    casserait les écrans qui filtrent par schoolLevelId (bulletins,
    //    types par niveau). On n'accepte ici que global (null) ou même niveau.
    const fallback = await this.prisma.evaluationType.findFirst({
      where: {
        code: evaluationTypeIdOrCode,
        tenantId,
        ...(levelId
          ? { OR: [{ schoolLevelId: null }, { schoolLevelId: levelId }] }
          : {}),
      },
    });
    if (fallback) return fallback;

    // 5. ⭐ V10e — AUTO-CRÉATION pour la piste anglophone :
    //    les types EN (FIRST_CA / SECOND_CA / EXAM / FCA / SCA…) viennent de
    //    school_academic_settings.config.assessmentTypes et n'existent PAS
    //    dans evaluation_types → la création d'évaluations EN échouait avec
    //    « Type d'évaluation non trouvé ». On crée le type à la volée, scopé
    //    au niveau des classes ciblées (même logique que les types FR).
    // ⭐ V10g — Barèmes anglophones corrigés : First CA /20, Second CA /20,
    // Examination /60 → récapitulatif trimestriel = 20+20+60 = /100 par matière.
    const EN_TYPE_PRESETS: Record<string, { name: string; maxScore: number }> = {
      FIRST_CA: { name: 'First CA', maxScore: 20 },
      SECOND_CA: { name: 'Second CA', maxScore: 20 },
      FCA: { name: 'First CA', maxScore: 20 },
      SCA: { name: 'Second CA', maxScore: 20 },
      EXAM: { name: 'Examination', maxScore: 60 },
      EXAMINATION: { name: 'Examination', maxScore: 60 },
    };
    const preset = EN_TYPE_PRESETS[evaluationTypeIdOrCode.toUpperCase()];
    const prettified = preset?.name
      ?? evaluationTypeIdOrCode
        .toLowerCase()
        .split(/[_\s-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    return this.prisma.evaluationType.create({
      data: {
        tenantId,
        schoolLevelId: levelId,
        code: evaluationTypeIdOrCode,
        name: prettified,
        isSystem: false,
        defaultMaxScore: preset?.maxScore ?? 20,
        defaultCoefficient: 1,
      },
    });
  }

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
          // ⭐ Clarification utilisateur (2026-09-15) : l'enseignant SPÉCIALISÉ
          // (ex : Anglais / Informatique dans les écoles non bilingues) ne doit
          // voir, pour la saisie des notes, QUE les évaluations de SA matière —
          // pas toutes les évaluations de ses classes.
          //
          // On construit donc les couples (classe × matière) que l'enseignant
          // enseigne VRAIMENT depuis ses TeacherClassAssignment :
          //   - a.classId = section physique (titulaire : toutes ses matières)
          //   - a.classId NULL + cs.academicClassId (spécialiste itinérant
          //     « toutes sections » : Anglais, Informatique)
          // Le titulaire, affecté à toutes les matières régulières de sa
          // section, continue de voir toutes les évaluations de sa classe.
          //
          // On garde DEUX filets de sécurité :
          //   1. teacherId direct (évaluations où il est explicitement assigné) ;
          //   2. les évaluations de ses classes SANS enseignant assigné
          //      (teacherId null — personne d'autre ne les verrait sinon).
          //
          // ⚠️ Côté directeur / promoteur (pas de filtre teacherId ici), toutes
          // les matières restent visibles : le calcul des notes et des moyennes
          // tient compte de l'anglais et de l'informatique.
          const teacherAssignments = await this.prisma.teacherClassAssignment.findMany({
            where: { tenantId, academicYearId, teacherId: teacher.id },
            select: { classId: true, classSubjectId: true },
          });
          const teacherClassIds = Array.from(new Set(
            teacherAssignments
              .map((a) => a.classId)
              .filter(Boolean) as string[]
          ));

          if (teacherAssignments.length > 0) {
            // Résoudre les ClassSubject des affectations (subjectId + classes)
            const csIds = Array.from(new Set(teacherAssignments.map((a) => a.classSubjectId)));
            const classSubjects = await this.prisma.classSubject.findMany({
              where: { id: { in: csIds } },
              select: { id: true, subjectId: true, classId: true, academicClassId: true },
            });
            const csById = new Map(classSubjects.map((cs) => [cs.id, cs]));

            // ⭐ Résoudre les SECTIONS PHYSIQUES des classes officielles
            //    impliquées : les affectations itinérantes (classId NULL) sont
            //    posées au niveau de l'AcademicClass, mais les évaluations
            //    référencent les classes physiques (CE1 A, CE1 B…) — sans cette
            //    résolution, le spécialiste ne verrait pas les évaluations de
            //    sa matière créées pour une section précise.
            const academicClassIds = Array.from(new Set(
              classSubjects.map((cs) => cs.academicClassId).filter(Boolean) as string[]
            ));
            const physicalSections = academicClassIds.length > 0
              ? await this.prisma.academicClass.findMany({
                  where: { id: { in: academicClassIds } },
                  select: { id: true, physicalClasses: { select: { id: true } } },
                })
              : [];
            const sectionsByAcademic = new Map<string, string[]>();
            for (const ac of physicalSections) {
              sectionsByAcademic.set(ac.id, (ac.physicalClasses || []).map((pc) => pc.id));
            }

            // Couples (classId candidat × subjectId) — couvre sections physiques
            // ET classes officielles (les évaluations référencent les deux).
            const pairConditions: any[] = [];
            for (const a of teacherAssignments) {
              const cs = csById.get(a.classSubjectId);
              if (!cs) continue;
              const cids = new Set<string>();
              if (a.classId) cids.add(a.classId);
              if (cs.classId) cids.add(cs.classId);
              if (cs.academicClassId) {
                cids.add(cs.academicClassId);
                for (const sid of sectionsByAcademic.get(cs.academicClassId) || []) {
                  cids.add(sid);
                }
              }
              for (const cid of cids) {
                pairConditions.push({ AND: [{ classId: cid }, { subjectId: cs.subjectId }] });
              }
            }

            if (pairConditions.length > 0 || teacherClassIds.length > 0) {
              where.OR = [
                // (1) Évaluations où l'enseignant est directement assigné
                { teacherId: teacher.id },
                // (2) Évaluations correspondant à SES couples (classe × matière)
                ...pairConditions,
                // (3) Évaluations de ses classes SANS enseignant assigné
                ...(teacherClassIds.length > 0
                  ? [{ AND: [{ teacherId: null }, { classId: { in: teacherClassIds } }] }]
                  : []),
              ];
            } else {
              // Affectations sans classe résolue → filtrer par teacherId uniquement
              where.teacherId = teacher.id;
            }
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
    // ⭐ 2026-10-01 — Filtre par piste linguistique sur l'ÉVALUATION (pas sur
    //    la classe). Chaque évaluation porte son propre champ `language`
    //    ('FR' ou 'EN') défini au moment de la création. Cela permet de
    //    séparer les évaluations FR et EN même quand les classes sont partagées
    //    (miroirs Nursery/Maternelle). Avant, le filtre portait sur la classe
    //    (where.class.language=...) ce qui mélangeait les évaluations quand
    //    les classes étaient FR marquées mais utilisées comme miroirs EN.
    if (filters.language) {
      where.language = String(filters.language).toUpperCase();
    }

    // ⭐ FIX PERF (2026-09-21 — « plus d'une minute pour charger les
    //    évaluations », toasts « délai dépassé ») : la liste était renvoyée
    //    avec des relations COMPLÈTES (subject: true, evaluationType: true,
    //    period: true, gradeScale: true + classe entière) → payload de
    //    plusieurs Mo à l'échelle d'une école (des centaines d'évaluations ×
    //    toutes les colonnes de 5 tables), transferé puis re-parse à chaque
    //    ouverture d'onglet. Les 8 vues consommatrices (evaluations, grades,
    //    validation, registre, recap, bulletins, dashboard, espace enseignant)
    //    n'utilisent qu'une fraction de ces champs : on projète EXACTEMENT
    //    ce qui est consommé — payload divisé par ~10, plus aucun timeout.
    return this.prisma.evaluation.findMany({
      where,
      select: {
        id: true,
        classId: true,
        subjectId: true,
        evaluationTypeId: true,
        periodId: true,
        teacherId: true,
        title: true,
        description: true,
        evaluationDate: true,
        startDate: true,
        endDate: true,
        maxScore: true,
        coefficient: true,
        status: true,
        // ⭐ 2026-10-01 — Inclure le champ language de l'évaluation
        language: true,
        createdAt: true,
        updatedAt: true,
        class: {
          // schoolLevel.code : détection du niveau (maternelle/primaire) côté
          // espace enseignant (teacher/exams) — seuls id+code sont nécessaires.
          select: {
            id: true,
            name: true,
            schoolLevelId: true,
            schoolLevel: { select: { id: true, code: true, name: true } },
          },
        },
        subject: {
          // coefficient + language : utilisés par les bulletins (moyennes
          // pondérées + isolation linguistique)
          select: { id: true, name: true, coefficient: true, language: true },
        },
        evaluationType: {
          select: { id: true, name: true, code: true },
        },
        period: {
          select: { id: true, name: true },
        },
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
    // ⭐ V10e — Validation du type d'évaluation par id OU par code,
    // résolu PAR NIVEAU (le code "EM1" existe pour Maternelle ET Primaire).
    const type = await this.resolveEvaluationType(
      tenantId,
      data.evaluationTypeId,
      data.classId ? [data.classId] : [],
    );

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
        // ⭐ 2026-10-01 — Marquer la piste linguistique de l'évaluation
        language: (data as any).language || 'FR',
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
    subjectIds?: string[];
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
    /** ⭐ 2026-10-01 — Piste linguistique ('FR' ou 'EN'). Définit la piste
     *  de l'évaluation pour le filtrage. Par défaut 'FR'. */
    language?: string;
    /**
     * ⭐ FIX 2026-11-17 (« gymnastique » module Examens) :
     * Respecter les coefficients définis PAR MATIÈRE dans le module
     * Pédagogie (class_subjects.coefficient, affectés via
     * Pédagogie > Matières & Programmes). Quand ce flag est actif, chaque
     * évaluation créée reprend le coefficient de sa matière pour SA classe ;
     * en repli : data.coefficient, sinon defaultCoefficient du type, sinon 1.
     */
    respectSubjectCoefficients?: boolean;
    /**
     * ⭐ RÉORGANISATION 2026-11-17 (onglet Évaluations — vue par classe) :
     * Matières PROPRES À CHAQUE CLASSE — { [classId]: subjectId[] }.
     * Chaque classe du multi-select est évaluée sur SES matières affectées
     * dans Pédagogie > Matières & Programmes (plus d'intersection entre
     * classes : la 6e A peut composer 7 matières pendant que la 4e en compose 8).
     * Repli : data.subjectIds appliqué à toutes les classes (comportement
     * historique, rétro-compatible avec les autres appelants).
     */
    subjectsByClass?: Record<string, string[]>;
  }) {
    // ⭐ V10e — Validation du type par id OU par code, résolu PAR NIVEAU
    // (le code "EM1" existe pour Maternelle ET Primaire : sans le scope
    // par niveau, findFirst renvoyait le type d'un AUTRE niveau et les
    // bulletins — qui filtrent par schoolLevelId — ne trouvaient rien).
    const type = await this.resolveEvaluationType(
      tenantId,
      data.evaluationTypeId,
      data.classIds || [],
    );
    if (!type) throw new NotFoundException('Type d\'évaluation non trouvé');

    // Vérifier que la période n'est pas clôturée
    const period = await this.prisma.academicPeriod.findUnique({
      where: { id: data.periodId },
    });
    if (period?.isClosed) {
      throw new BadRequestException('La période est clôturée — impossible de créer des évaluations.');
    }

    // ⭐ RÉORGANISATION 2026-11-17 : avec subjectsByClass (matières propres à
    //    chaque classe), subjectIds n'est plus obligatoire — chaque classe
    //    apporte SA liste. Repli historique : subjectIds global.
    const hasSubjectsByClass =
      !!data.subjectsByClass &&
      Object.values(data.subjectsByClass).some((list) => Array.isArray(list) && list.length > 0);
    if (!data.classIds?.length || (!hasSubjectsByClass && !data.subjectIds?.length)) {
      throw new BadRequestException('Au moins une classe et une matière sont requises.');
    }

    // ⭐ Résoudre les enseignants assignés + les coefficients par matière
    //
    // Le modèle TeacherClassAssignment ne possède PAS de `subjectId` direct.
    // Il possède `classSubjectId` (FK vers ClassSubject) + `classId` (classe physique).
    // Pour résoudre l'enseignant et le coefficient pour (classId × subjectId), il faut donc :
    //   1. Trouver les ClassSubject dont classe ∈ classIds (directement OU via
    //      classes.officialClassId → pedagogy_academic_classes) ET subjectId ∈ subjectIds
    //   2. Pour chaque ClassSubject trouvé, chercher les TeacherClassAssignment
    //      avec `classSubjectId` correspondant (et `classId` si défini).
    //
    // ⭐ FIX 2026-11-17 : les évaluations sont créées pour les classes
    //    OPÉRATIONNELLES (table `classes`), mais les affectations
    //    Pédagogie > Matières & Programmes vivent dans class_subjects avec
    //    academicClassId = classe OFFICIELLE (pedagogy_academic_classes).
    //    Le lien opérationnel → officiel est classes.officialClassId.
    //    Avant ce fix, la correspondance ne matchait JAMAIS (academicClassId
    //    comparé aux IDs opérationnels) → aucun enseignant résolu, aucun
    //    coefficient de matière disponible.
    //    Ce bloc alimente aussi coefMap pour respectSubjectCoefficients.

    // Étape 0 : charger les classes opérationnelles + leur classe officielle
    const operationalClasses = await this.prisma.class.findMany({
      where: { id: { in: data.classIds } },
      select: { id: true, name: true, officialClassId: true },
    });
    const officialClassIds = Array.from(
      new Set(
        operationalClasses
          .map((c) => c.officialClassId)
          .filter((v): v is string => !!v),
      ),
    );

    // ⭐ RÉORGANISATION 2026-11-17 — résolution des matières PAR CLASSE :
    //    - subjectsByClass fourni (modal simplifié : classes + trimestre +
    //      types, matières auto) → chaque classe utilise SA liste propre ;
    //    - sinon → data.subjectIds appliqué à toutes (comportement historique).
    const subjectsForClass = (classId: string): string[] => {
      const own = data.subjectsByClass?.[classId];
      if (Array.isArray(own) && own.length > 0) {
        return Array.from(new Set(own.filter(Boolean)));
      }
      return Array.from(new Set((data.subjectIds || []).filter(Boolean)));
    };
    // Union de toutes les matières impliquées (pour les requêtes en aval)
    const allInvolvedSubjectIds = Array.from(
      new Set([
        ...(data.subjectIds || []),
        ...data.classIds.flatMap((cid) => subjectsForClass(cid)),
      ].filter(Boolean)),
    );

    // Étape 1 : récupérer les ClassSubject pour les (classe × matière) demandées
    // ⭐ ClassSubject.classId est deprecated (souvent null en production).
    // On cherche par academicClassId (la relation utilisée en production),
    // en incluant les classes officielles des classes opérationnelles demandées.
    const classSubjects = await this.prisma.classSubject.findMany({
      where: {
        tenantId,
        subjectId: { in: allInvolvedSubjectIds },
        OR: [
          { classId: { in: data.classIds } },
          { academicClassId: { in: [...data.classIds, ...officialClassIds] } },
        ],
      },
      select: {
        id: true,
        classId: true,
        academicClassId: true,
        subjectId: true,
        coefficient: true,
      },
    });

    // Étape 2 : construire les maps indexées par classe OPÉRATIONNELLE :
    //   csMap   : `${classId}|${subjectId}` → classSubjectId (résolution enseignant)
    //   coefMap : `${classId}|${subjectId}` → coefficient de la matière pour cette classe
    const csMap = new Map<string, string>();
    const coefMap = new Map<string, number>();
    for (const cs of classSubjects) {
      // Propriétaires opérationnels de ce ClassSubject :
      //  - la classe physique si cs.classId la référence directement
      //  - les classes opérationnelles dont officialClassId = cs.academicClassId
      //  - cs.academicClassId lui-même s'il fait partie des classIds demandés
      const owners = new Set<string>();
      if (cs.classId && data.classIds.includes(cs.classId)) owners.add(cs.classId);
      if (cs.academicClassId) {
        if (data.classIds.includes(cs.academicClassId)) owners.add(cs.academicClassId);
        for (const op of operationalClasses) {
          if (op.officialClassId === cs.academicClassId) owners.add(op.id);
        }
      }
      for (const opClassId of owners) {
        const key = `${opClassId}|${cs.subjectId}`;
        if (!csMap.has(key)) {
          csMap.set(key, cs.id);
          if (cs.coefficient !== null && cs.coefficient !== undefined) {
            coefMap.set(key, cs.coefficient);
          }
        }
      }
    }

    // Étape 3 : récupérer les TeacherClassAssignment pour ces classSubjectId
    const classSubjectIds = Array.from(csMap.values());
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
    for (const [key, csId] of csMap.entries()) {
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

    // ⭐ RÉORGANISATION 2026-11-17 — classes sans AUCUNE matière : on refuse
    //    TOUTE la requête avec un message explicite (le modal simplifié exige
    //    que chaque classe sélectionnée ait ses matières configurées dans
    //    Pédagogie > Matières & Programmes — l'école doit les y définir d'abord).
    const classNameById = new Map(
      operationalClasses.map((c) => [c.id, c.name] as [string, string]),
    );
    const classesWithoutSubjects = data.classIds.filter(
      (cid) => subjectsForClass(cid).length === 0,
    );
    if (classesWithoutSubjects.length > 0) {
      const displayNames = classesWithoutSubjects.map(
        (cid) => classNameById.get(cid) || cid,
      );
      throw new BadRequestException(
        `Aucune matière n'est affectée à : ${displayNames.join(', ')} — ` +
        'affectez d\'abord les matières de ces classes dans Pédagogie > Matières & Programmes.',
      );
    }

    for (const classId of data.classIds) {
      // ⭐ Matières PROPRES à cette classe (subjectsByClass) — une classe peut
      //    composer 7 matières pendant qu'une autre en compose 8.
      for (const subjectId of subjectsForClass(classId)) {
        const teacherId = teacherMap.get(`${classId}|${subjectId}`) || null;
        // ⭐ FIX 2026-11-17 : coefficient PAR MATIÈRE — quand
        //    respectSubjectCoefficients est actif, on reprend le coefficient
        //    configuré dans Pédagogie > Matières & Programmes pour cette
        //    matière DANS cette classe (class_subjects.coefficient via
        //    classes.officialClassId). Repli : coefficient global du
        //    formulaire, puis defaultCoefficient du type, puis 1.
        const subjectCoef = data.respectSubjectCoefficients
          ? coefMap.get(`${classId}|${subjectId}`)
          : undefined;
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
          coefficient:
            (subjectCoef !== undefined && !Number.isNaN(subjectCoef) ? subjectCoef : undefined) ??
            data.coefficient ??
            type.defaultCoefficient ??
            1,
          teacherId,
          status: 'PLANNED',
          createdBy: data.createdBy || null,
          // ⭐ 2026-10-01 — Marquer la piste linguistique de l'évaluation
          language: data.language || 'FR',
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
          where: { id: { in: allInvolvedSubjectIds } },
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
      // ⭐ RÉORGANISATION 2026-11-17 — avec subjectsByClass, le nombre de
      //    matières diffère PAR CLASSE (7 pour la 6e, 8 pour la 4e…) — on
      //    rapporte l'union des matières impliquées, pas une Croix produit.
      message: `${result.length} évaluation(s) créée(s) pour ${data.classIds.length} classe(s) × ${allInvolvedSubjectIds.length} matière(s) (union des matières par classe). ${teacherMap.size} enseignant(s) auto-assigné(s).`,
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

    // ⭐ FIX 2026-09-12 (modification multiple) : le frontend manipule les types
    // d'évaluation par CODE (EM1, FIRST_CA… — issus de school_academic_settings),
    // mais evaluation_types.id est un UUID. Sans résolution, un PATCH avec un
    // code cassait la FK (P2003). On résout code → UUID via la même logique que
    // create() (scoped au niveau de la classe de l'évaluation).
    if (updateData.evaluationTypeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updateData.evaluationTypeId)) {
      const resolvedType = await this.resolveEvaluationType(
        tenantId,
        updateData.evaluationTypeId,
        evaluation.classId ? [evaluation.classId] : [],
      );
      if (resolvedType) {
        updateData.evaluationTypeId = resolvedType.id;
      } else {
        delete updateData.evaluationTypeId;
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

    // ⭐ (sept. 2026 — retour promoteur « aucune évaluation supprimable dans
    //    la sélection ») : les évaluations VALIDÉES sont désormais supprimables
    //    — le workflow manuel suggéré (« Annulez-la d'abord ») est automatisé :
    //    avec notes → CANCELLED (conservée dans l'historique, comportement
    //    inchangé) ; sans note → suppression définitive. Seules les évaluations
    //    LOCKED (verrouillées par délibération/conseil — acte officiel) restent
    //    protégées : leur suppression passe par un déblocage explicite
    //    (exam_unlock_requests).
    if (evaluation.status === 'LOCKED') {
      throw new BadRequestException(
        `Impossible de supprimer une évaluation verrouillée (délibération). Débloquez-la d'abord via une demande de déblocage.`
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

    // ⭐ V1 audit — idempotence : GradingSheet « Enregistrer et valider »
    //    appelle POST /:id/open APRÈS la sauvegarde des notes. Au 2e passage
    //    (re-validation, correction après retour), l'évaluation est déjà
    //    OPEN_FOR_GRADING et le 400 « doit être en statut PLANNED ou DRAFT »
    //    bloquait le workflow alors que les notes étaient déjà sauvées.
    //    → on accepte désormais OPEN_FOR_GRADING comme no-op (réponse 200).
    if (evaluation.status === 'OPEN_FOR_GRADING') {
      return evaluation;
    }

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

    const result = await this.prisma.$transaction(async (tx) => {
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

      // ⭐ FIX 2026-11-19 — clôturer le lot de validation PENDING associé
      //    (miroir de approveBatch) : la validation directe via
      //    PATCH /evaluations/:id/validate (bouton « Valider toutes » de
      //    l'onglet Validation) laissait le lot « PENDING » pour toujours
      //    alors que l'évaluation venait d'être VALIDATED — 25 lots
      //    orphelins constatés le 2026-11-19 (Mon Avenir Plus) après les
      //    validations 6ème A / CP A / CP B.
      await tx.gradeValidationBatch.updateMany({
        where: { evaluationId: id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          reviewedById: validatedBy,
          reviewedAt: new Date(),
          reviewComment: 'Validation directe (PATCH /evaluations/:id/validate)',
        },
      });

      return updatedEval;
    });

    // ⭐ V1 audit — trace la validation (notes verrouillées)
    this.traceAudit(
      tenantId, (evaluation as any).academicYearId, 'GRADE_VALIDATE', id,
      { status: evaluation.status }, { status: 'VALIDATED' }, validatedBy,
    );

    return result;
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

    // ⭐ V1 audit — trace l'annulation/rejet avec son motif
    this.traceAudit(
      tenantId, (evaluation as any).academicYearId, 'GRADE_REJECT', id,
      { status: evaluation.status }, { status: 'CANCELLED', reason: reason ?? null }, undefined,
    );

    return updated;
  }
}
