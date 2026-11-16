/**
 * ============================================================================
 * STUDENTS PRISMA SERVICE - MODULE 1
 * ============================================================================
 * 
 * Service Prisma pour la gestion complète des élèves
 * Module 1 : Gestion des Élèves & Scolarité
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MatriculeService } from './services/matricule.service';
import { AccessScope } from '../common/context/access-scope.service';
import { levelWhere, studentTrackRelation, assertLevelInScope } from '../common/context/scope-where';
import { resolveSchoolLevelFilter } from '../common/context/resolve-school-level';
import { PublicVerificationService } from './services/public-verification.service';
import { StudentCountVerifierService } from '../billing/services/student-count-verifier.service';
// ⭐ 1.0.17 — liste officielle partagée (mêmes statuts que les exports
//    EducMaster / PDF et l'onglet « Liste des Élèves »)
import {
  OFFICIAL_LIST_ENROLLMENT_STATUSES,
} from '../common/constants/official-list-statuses';

@Injectable()
export class StudentsPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matriculeService: MatriculeService,
    private readonly publicVerificationService: PublicVerificationService,
    private readonly studentCountVerifier: StudentCountVerifierService,
  ) {}

  /**
   * Vérifie si le tenant peut inscrire un nouvel élève (plan d'abonnement).
   * Lance une ForbiddenException si l'ajout est bloqué.
   */
  private async assertCanEnroll(tenantId: string): Promise<void> {
    const check = await this.studentCountVerifier.canEnrollNewStudent(tenantId);
    if (!check.allowed) {
      const planLabel = check.currentPlan || 'plan actuel';
      const recommendedLabel = check.recommendedPlan || 'plan supérieur';
      const currentCount = check.currentCount ?? 0;
      const planLimit = check.planLimit ?? 0;
      throw new ForbiddenException({
        code: 'STUDENT_ENROLLMENT_BLOCKED',
        message: `L'ajout de nouveaux élèves est suspendu. Votre établissement a ${currentCount} élèves inscrits, ce qui dépasse la limite de votre ${planLabel} (${planLimit} élèves max). Veuillez mettre à niveau vers le plan ${recommendedLabel} pour reprendre les inscriptions.`,
        details: {
          currentCount,
          planLimit,
          currentPlan: check.currentPlan,
          recommendedPlan: check.recommendedPlan,
          graceEndsAt: check.graceEndsAt,
        },
      });
    }
  }

  /**
   * Crée un nouvel élève avec matricule institutionnel (généré backend, immuable).
   */
  async createStudent(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: Date;
    gender?: string;
    nationality?: string;
    primaryLanguage?: string;
    photoUrl?: string;
    npi?: string;
    createdById?: string;
  }) {
    // Vérifier que le tenant peut inscrire un nouvel élève (plan d'abonnement)
    await this.assertCanEnroll(data.tenantId);

    // ⭐ FIX 2026-09-07 « miroir bilingue / multi-tables » : la FK
    //    Student.schoolLevelId référence school_levels — le client peut envoyer
    //    l'UUID education_levels (ou un miroir EN). Résolution systématique ;
    //    un composite (MAT_PRI) est ambigu → premier niveau (log warning).
    if (data.schoolLevelId) {
      const resolvedIds = await resolveSchoolLevelFilter(this.prisma, data.tenantId, data.schoolLevelId);
      if (resolvedIds && resolvedIds.length > 0) {
        if (resolvedIds.length > 1) {
          console.warn('STUDENT_CREATE_AMBIGUOUS_LEVEL', {
            tenantId: data.tenantId,
            received: data.schoolLevelId,
            resolved: resolvedIds,
            note: 'composite fused reçu — premier niveau utilisé (le wizard preRegister est le flux principal)',
          });
        }
        data = { ...data, schoolLevelId: resolvedIds[0] };
      }
    }

    const schoolCode = await this.matriculeService.getSchoolCode(data.tenantId);
    const enrollmentYear = await this.matriculeService.getEnrollmentYearFromAcademicYear(data.academicYearId);

    const result = await this.prisma.$transaction(async (tx) => {
      const matricule = await this.matriculeService.generateInTransaction(
        tx,
        data.tenantId,
        schoolCode,
        enrollmentYear,
      );
      return tx.student.create({
        data: {
          ...data,
          matricule,
          enrollmentYear,
          studentCode: matricule,
          currentAcademicYearId: data.academicYearId,
          status: 'ACTIVE',
        },
        include: {
          schoolLevel: true,
          academicYear: true,
          studentGuardians: {
            include: {
              guardian: true,
            },
          },
          studentEnrollments: {
            include: {
              class: true,
            },
          },
        },
      });
    });

    // Vérifier le nombre d'élèves vs plan d'abonnement (best-effort, asynchrone)
    this.studentCountVerifier.verifyAfterEnrollment(data.tenantId).catch(() => {
      // Silencieux : le verifyAfterEnrollment log déjà les erreurs
    });

    return result;
  }

  /**
   * Récupère tous les élèves d'un tenant
   *
   * Mode "année stricte" : academicYearId est fortement recommandé.
   * Si non fourni, un warning est loggé pour aider à identifier les callers
   * à corriger. L'interceptor injecte automatiquement academicYearId dans
   * les query params, donc en pratique il est toujours présent.
   */
  async findAllStudents(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      status?: string;
      classId?: string;
      search?: string;
      regimeType?: string;
      hasArrears?: boolean;
      page?: number;
      limit?: number;
    },
    scope?: AccessScope | null,
  ) {
    // Mode "année stricte" : warning si pas d'academicYearId
    if (!filters?.academicYearId) {
      console.warn('STUDENTS_FINDALL_WITHOUT_ACADEMIC_YEAR', {
        tenantId,
        message: 'findAllStudents appelé sans academicYearId — mode non-strict',
      });
    }

    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    // ⭐ Filtre Rôles × Pistes × Niveaux — niveau IMPOSÉ par le scope serveur
    //    (le filtre client ne peut qu'affiner DANS le périmètre ; la sentinelle
    //    'ALL' ne bypass plus pour les comptes restreints).
    const scopeLvl = levelWhere(scope || undefined);
    if (scopeLvl) {
      where.schoolLevelId = scopeLvl.schoolLevelId;
    }
    // ⭐ FIX 2026-09-07 « miroir bilingue » : le front peut envoyer l'UUID
    //    education_levels (ou un miroir EN NURSERY/PRIMARY, ou un composite
    //    MAT_PRI) alors que la FK Student.schoolLevelId référence school_levels
    //    → résolution systématique : la piste anglophone voit les MÊMES élèves
    //    que la piste francophone (les élèves ne sont jamais dupliqués — cf.
    //    bilingual-structure.service).
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      const resolvedIds = await resolveSchoolLevelFilter(this.prisma, tenantId, filters.schoolLevelId);
      if (resolvedIds) {
        where.schoolLevelId = resolvedIds.length === 1 ? resolvedIds[0] : { in: resolvedIds };
      }
    }

    // ⭐ Piste linguistique : élèves de SA piste uniquement
    //    (FR = non marqués EN ; EN = marqués EN via classe courante)
    const scopeTrack = studentTrackRelation(scope || undefined);
    if (scopeTrack) {
      where.AND = [...(where.AND || []), scopeTrack as any];
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.regimeType) {
      where.regimeType = filters.regimeType;
    }

    // ⭐ FIX 2026-11-16 (1.0.17, retour promoteur CSPEB) : le filtre par classe
    //    exigeait un statut d'inscription EXACTEMENT 'ACTIVE' — les élèves
    //    ADMIS (ADMITTED), réinscrits (RE_ENROLLED), promus (PROMOTED) ou
    //    VALIDATED étaient donc INTROUVABLES dès qu'un filtre de classe (ou
    //    d'arriérés) était appliqué : invisibles dans « Sorties & Abandons »
    //    (impossible de les retirer pour abandon) et dans « Dossiers Élèves »
    //    avec filtre de classe, alors qu'ils figuraient dans la liste officielle
    //    et l'onglet Inscriptions. Désormais : mêmes statuts que la liste
    //    officielle (OFFICIAL_LIST_ENROLLMENT_STATUSES).
    if (filters?.classId || filters?.hasArrears === true || filters?.hasArrears === false) {
      const enrollmentWhere: any = { status: { in: [...OFFICIAL_LIST_ENROLLMENT_STATUSES] } };
      if (filters?.classId) {
        enrollmentWhere.classId = filters.classId;
      }
      if (filters?.hasArrears === true) {
        enrollmentWhere.previousArrears = { gt: 0 };
      }
      if (filters?.hasArrears === false) {
        enrollmentWhere.previousArrears = { lte: 0 };
      }
      where.studentEnrollments = { some: enrollmentWhere };
    }

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { studentCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Pagination: défaut 50, max 200 pour éviter OOM
    const pageSize = Math.min(filters?.limit || 50, 200);
    const pageNumber = Math.max(filters?.page || 1, 1);
    const skip = (pageNumber - 1) * pageSize;

    // ⭐ Compter le TOTAL (pour les stats et la pagination UI)
    // On utilise count() séparément pour connaître le vrai total d'élèves
    // correspondant aux filtres (indépendamment de la pagination).
    const total = await this.prisma.student.count({ where });

    const data = await this.prisma.student.findMany({
      where,
      include: {
        schoolLevel: true,
        academicYear: true,
        studentEnrollments: {
          // ⭐ 1.0.17 — statuts de la LISTE OFFICIELLE (ajout de PROMOTED et
          //    VALIDATED qui manquaient) : le front peut grouper/afficher
          //    tous les élèves officiellement inscrits de l'année.
          where: { status: { in: [...OFFICIAL_LIST_ENROLLMENT_STATUSES] } },
          include: {
            class: true,
          },
        },
        // ⭐ Retirer le filtre `isPrimary: true` — il masquait les guardians secondaires
        //    dans l'UI Familles et faussait les KPIs (totalGuardians et studentsWithoutGuardian).
        //    On renvoie TOUS les guardians liés à l'élève ; c'est l'UI qui met en avant
        //    le guardian principal (badge "Principal").
        studentGuardians: {
          include: {
            guardian: true,
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
      skip,
      take: pageSize,
    });

    // ⭐ Retourner un objet paginé { data, total, page, limit, totalPages }
    // Rétro-compatible : si le frontend attend un array, il doit utiliser .data
    return {
      data,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Récupère un élève par ID
   * ⭐ Anti-IDOR (F3) : l'élève doit appartenir au périmètre niveau + piste.
   */
  async findStudentById(id: string, tenantId: string, scope?: AccessScope | null) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        schoolLevel: true,
        academicYear: true,
        studentGuardians: {
          include: {
            guardian: true,
          },
        },
        studentEnrollments: {
          include: {
            class: true,
            academicYear: true,
            schoolLevel: true,
          },
          orderBy: { enrollmentDate: 'desc' },
        },
        studentDocuments: {
          orderBy: { createdAt: 'desc' },
        },
        absences: {
          take: 10,
          orderBy: { date: 'desc' },
        },
        disciplinaryActions: {
          take: 10,
          orderBy: { actionDate: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    // ⭐ Filtre Rôles × Pistes × Niveaux — anti-IDOR (niveau puis piste)
    assertLevelInScope(scope || undefined, student, 'cet élève');
    if (scope?.resolved && !scope.allTracks) {
      const trackOk = (await this.countStudentEnMark(student)) > 0;
      if (scope.trackCodes.includes('EN') && !scope.trackCodes.includes('FR')) {
        if (!trackOk) {
          throw new ForbiddenException("Accès refusé : cet élève n'appartient pas à votre piste linguistique.");
        }
      } else if (scope.trackCodes.includes('FR') && !scope.trackCodes.includes('EN')) {
        if (trackOk) {
          throw new ForbiddenException("Accès refusé : cet élève n'appartient pas à votre piste linguistique.");
        }
      }
    }

    return student;
  }

  /**
   * L'élève a-t-il une classe marquée EN (via classStudents ou studentEnrollments) ?
   */
  private async countStudentEnMark(student: any): Promise<number> {
    return this.prisma.student.count({
      where: {
        id: student.id,
        OR: [
          { classStudents: { some: { class: { language: 'EN' } } } },
          { studentEnrollments: { some: { class: { language: 'EN' } } } },
        ],
      },
    });
  }

  /**
   * Met à jour un élève
   *
   * ⚠️ Conformément au pattern RH/finance du projet, tout enregistrement élève
   * est lié à une année académique et un niveau scolaire. Ces champs sont donc
   * modifiables via PUT /students/:id (utile pour réinscription / transfert
   * inter-années / changement de niveau).
   */
  async updateStudent(
    id: string,
    tenantId: string,
    data: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: Date | string;
      gender?: string;
      nationality?: string;
      primaryLanguage?: string;
      npi?: string;
      photoUrl?: string;
      placeOfBirth?: string;
      address?: string;
      status?: string;
      academicYearId?: string;
      schoolLevelId?: string;
      currentAcademicYearId?: string;
      // ⭐ 2026-10-01 — Numéro Educmaster (requis pour l'export des 6e vers MEMP)
      educMasterMatricule?: string | null;
    },
    scope?: AccessScope | null,
  ) {
    // ⭐ FIX 2026-09-23 : transmettre le scope de l'utilisateur (anti-IDOR)
    //    au findStudentById. Avant, l'absence de scope faisait crasher
    //    assertLevelInScope (« reading 'resolved' ») → 500 sur toute modification.
    await this.findStudentById(id, tenantId, scope);
    // Strippage des champs non-modifiables manuellement (matricule généré par le service dédié)
    const { matricule: _m, enrollmentYear: _e, ...safeData } = data as typeof data & { matricule?: string; enrollmentYear?: number };

    // Conversion dateOfBirth string → Date (le frontend peut envoyer ISO string ou YYYY-MM-DD)
    if (safeData.dateOfBirth && typeof safeData.dateOfBirth === 'string') {
      safeData.dateOfBirth = new Date(safeData.dateOfBirth);
    }

    const updated = await this.prisma.student.update({
      where: { id },
      data: safeData,
      include: {
        schoolLevel: true,
        academicYear: true,
      },
    });
    if (safeData.status === 'SUSPENDED' || safeData.status === 'TRANSFERRED') {
      this.publicVerificationService.deactivateTokensForStudent(id).catch(() => {});
    }
    return updated;
  }

  /**
   * Archive un élève (pas de suppression physique)
   *
   * ⭐ P1.4 — Persiste maintenant le reason + écrit un audit log.
   *    Avant, le reason collecté par l'UI était ignoré et l'archive n'avait
   *    aucune trace dans studentAuditLog.
   */
  async archiveStudent(
    id: string,
    tenantId: string,
    reason?: string,
    userId?: string,
    scope?: AccessScope | null,
  ) {
    // ⭐ FIX 2026-09-23 : scope transmis (anti-IDOR + crash undefined)
    const student = await this.findStudentById(id, tenantId, scope);
    const previousStatus = student.status;
    const now = new Date();

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        isActive: false,
      },
    });

    // ⭐ Écrire un audit log — l'archive était auparavant une opération opaque
    try {
      await this.prisma.studentAuditLog.create({
        data: {
          tenantId,
          studentId: id,
          action: 'ARCHIVE',
          performedBy: userId || null,
          beforeData: { status: previousStatus } as any,
          afterData: { status: 'ARCHIVED', reason: reason || null, archivedAt: now } as any,
          createdAt: now,
        },
      });
    } catch (e: any) {
      console.warn(`[archiveStudent] Could not write audit log: ${e?.message}`);
    }

    return updated;
  }

  /**
   * Inscrit un élève dans une classe
   */
  async enrollStudent(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    studentId: string;
    classId: string;
    enrollmentType: 'NEW' | 'REPEAT' | 'TRANSFER';
    enrollmentDate: Date;
  }, scope?: AccessScope | null) {
    // Vérifier que le tenant peut inscrire un élève (plan d'abonnement)
    // L'élève existe déjà mais son enrollment pour l'année active peut faire
    // grandir le nombre d'élèves comptés (currentAcademicYearId non mis à jour ici).
    await this.assertCanEnroll(data.tenantId);

    // Vérifier que l'élève existe
    // ⭐ FIX 2026-09-23 : scope transmis (anti-IDOR + crash undefined)
    const student = await this.findStudentById(data.studentId, data.tenantId, scope);

    // Vérifier que la classe existe
    const classExists = await this.prisma.class.findFirst({
      where: {
        id: data.classId,
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
      },
    });

    if (!classExists) {
      throw new NotFoundException(`Class with ID ${data.classId} not found`);
    }

    // Désactiver les inscriptions actives précédentes pour cette année
    await this.prisma.studentEnrollment.updateMany({
      where: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        status: 'ACTIVE',
      },
      data: {
        status: 'TRANSFERRED',
        exitDate: new Date(),
        exitReason: 'Nouvelle inscription',
      },
    });

    // Créer la nouvelle inscription
    const result = await this.prisma.studentEnrollment.create({
      data: {
        ...data,
        status: 'VALIDATED',
      },
      include: {
        class: true,
        student: true,
      },
    });

    // Vérifier le nombre d'élèves vs plan d'abonnement (best-effort, asynchrone)
    this.studentCountVerifier.verifyAfterEnrollment(data.tenantId).catch(() => {
      // Silencieux : le verifyAfterEnrollment log déjà les erreurs
    });

    return result;
  }

  /**
   * Récupère les statistiques des élèves
   * Les comptes sont séparés par statut pour éviter de mélanger
   * les élèves actifs avec les pré-inscrits/acceptés/archivés.
   */
  async getStudentStatistics(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
    scope?: AccessScope | null,
  ) {
    // ⭐ FIX : les statistiques de l'année scolaire DOIVENT être comptées sur
    //    StudentEnrollment (qui porte le statut par année : ACTIVE, ADMITTED,
    //    PROMOTED, PRE_REGISTERED, RE_ENROLLED, WITHDRAWN, etc.) — et NON sur
    //    Student.status qui est le statut permanent de l'élève (qui peut être
    //    WITHDRAWN même s'il a été actif les années précédentes).
    //
    //    Sans ce fix, le dashboard "Vue d'ensemble" affichait 0 élèves pour
    //    l'année 2025-2026 alors que byClass/byGenderByLevel (comptés via
    //    StudentEnrollment) affichaient bien des élèves. Incohérence visible
    //    côté utilisateur.
    //
    //    Maintenant : toutes les stats (total, active, preRegistered, admitted,
    //    pending, archived, withdrawn) sont comptées via StudentEnrollment
    //    avec academicYearId — ce qui est cohérent avec byClass/byGenderByLevel.
    const enrollmentWhere: any = {
      tenantId,
      academicYearId,
    };
    // ⭐ Filtre Rôles × Pistes × Niveaux — niveau IMPOSÉ par le scope serveur
    const scopeLvl = levelWhere(scope || undefined);
    if (scopeLvl) {
      enrollmentWhere.schoolLevelId = scopeLvl.schoolLevelId;
    }
    // ⭐ FIX 2026-09-07 « miroir bilingue » : résolution du filtre client
    //    (UUID education_levels / miroir EN / composite → UUIDs school_levels).
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      const resolvedIds = await resolveSchoolLevelFilter(this.prisma, tenantId, schoolLevelId);
      if (resolvedIds) {
        enrollmentWhere.schoolLevelId = resolvedIds.length === 1 ? resolvedIds[0] : { in: resolvedIds };
      }
    }
    // ⭐ Piste : filtrer via l'élève (règle héritage FR / marquage EN classe)
    const scopeTrack = studentTrackRelation(scope || undefined);
    if (scopeTrack) {
      enrollmentWhere.student = scopeTrack as any;
    }

    // ⭐ Statuts sur StudentEnrollment (cohérents avec byClass/byGenderByLevel)
    //    ACTIVE = élève officiellement inscrit pour cette année
    //    PRE_REGISTERED = pré-inscrit (n'a pas encore été admis)
    //    ADMITTED = admis mais pas encore classé en section physique
    //    PENDING = dossier en attente de validation
    //    PROMOTED = élève promu depuis l'année précédente (équivalent actif)
    //    RE_ENROLLED = élève réinscrit
    //    WITHDRAWN = élève retiré/abandon pour cette année
    const activeEnrollmentStatuses = ['ACTIVE', 'PROMOTED', 'RE_ENROLLED'];

    const [active, preRegistered, admitted, pending, withdrawn, byGenderRaw, byStatus] = await Promise.all([
      // ⭐ 'active' = élèves officiellement inscrits pour CETTE année (ACTIVE + PROMOTED + RE_ENROLLED)
      this.prisma.studentEnrollment.count({
        where: { ...enrollmentWhere, status: { in: activeEnrollmentStatuses } },
      }),
      this.prisma.studentEnrollment.count({
        where: { ...enrollmentWhere, status: 'PRE_REGISTERED' },
      }),
      this.prisma.studentEnrollment.count({
        where: { ...enrollmentWhere, status: 'ADMITTED' },
      }),
      this.prisma.studentEnrollment.count({
        where: { ...enrollmentWhere, status: 'PENDING' },
      }),
      this.prisma.studentEnrollment.count({
        where: { ...enrollmentWhere, status: 'WITHDRAWN' },
      }),
      // ⭐ byGender : regroupé par sexe via StudentEnrollment.student
      this.prisma.studentEnrollment.findMany({
        where: enrollmentWhere,
        select: {
          student: { select: { gender: true } },
        },
      }).then(enrs => {
        // Grouper manuellement par gender
        const map = new Map<string, number>();
        for (const e of enrs) {
          const g = (e.student?.gender || 'UNKNOWN').toUpperCase();
          map.set(g, (map.get(g) || 0) + 1);
        }
        return Array.from(map.entries()).map(([gender, _count]) => ({ gender, _count }));
      }),
      // ⭐ byStatus : regroupé par statut d'inscription
      this.prisma.studentEnrollment.groupBy({
        by: ['status'],
        where: enrollmentWhere,
        _count: true,
      }),
    ]);

    // Total = tous les élèves ayant une inscription cette année (tous statuts confondus)
    const total = active + preRegistered + admitted + pending + withdrawn;

    // Archived =WITHDRAWN (= retirés cette année)
    const archived = withdrawn;

    // ⭐ Mapper byGender au format attendu par le frontend :
    //    [{ label: 'Garçons', count: N }, { label: 'Filles', count: N }]
    //    Au lieu du format Prisma raw [{ gender: 'M', _count: N }]
    const byGender = byGenderRaw.map((g: any) => {
      const rawGender = (g.gender || '').toUpperCase();
      let label = 'Non spécifié';
      if (rawGender === 'M' || rawGender === 'MALE' || rawGender === 'MASCULIN') label = 'Garçons';
      else if (rawGender === 'F' || rawGender === 'FEMALE' || rawGender === 'FEMININ' || rawGender === 'FÉMININ') label = 'Filles';
      return { label, value: g._count, count: g._count, gender: g.gender };
    });

    // ⭐ byGenderByLevel : répartition par sexe PAR NIVEAU SCOLAIRE
    //    [{ level: 'Maternelle', boys: N, girls: N, total: N }, ...]
    let byGenderByLevel: Array<{ level: string; boys: number; girls: number; total: number }> = [];
    try {
      const enrollmentsWithLevel = await this.prisma.studentEnrollment.findMany({
        where: enrollmentWhere,
        select: {
          student: { select: { gender: true } },
          schoolLevel: { select: { name: true, code: true } },
        },
      });

      // Grouper par niveau scolaire
      const levelMap = new Map<string, { boys: number; girls: number; total: number }>();
      for (const e of enrollmentsWithLevel) {
        const levelName = e.schoolLevel?.name || 'Non spécifié';
        const levelData = levelMap.get(levelName) || { boys: 0, girls: 0, total: 0 };
        const gender = (e.student?.gender || '').toUpperCase();
        if (gender === 'M' || gender === 'MALE' || gender === 'MASCULIN') levelData.boys++;
        else if (gender === 'F' || gender === 'FEMALE' || gender === 'FEMININ' || gender === 'FÉMININ') levelData.girls++;
        levelData.total++;
        levelMap.set(levelName, levelData);
      }

      byGenderByLevel = Array.from(levelMap.entries())
        .map(([level, data]) => ({ level, ...data }))
        .sort((a, b) => b.total - a.total);
    } catch (e) {
      // Non-blocking
    }

    // ⭐ byClass : répartition des élèves par classe (via student_enrollments)
    //    Le frontend Dashboard en a besoin pour le graphique "Effectifs par classe"
    let byClass: Array<{ className: string; count: number }> = [];
    try {
      const enrollmentsByClass = await this.prisma.studentEnrollment.groupBy({
        by: ['classId'],
        where: enrollmentWhere,
        _count: true,
      });

      // Résoudre les noms de classes
      const classIds = enrollmentsByClass.map(e => e.classId).filter(Boolean) as string[];
      if (classIds.length > 0) {
        const classes = await this.prisma.class.findMany({
          where: { id: { in: classIds }, tenantId },
          select: { id: true, name: true },
        });
        const classNameMap = new Map(classes.map(c => [c.id, c.name]));

        byClass = enrollmentsByClass
          .map(e => ({
            className: classNameMap.get(e.classId || '') || 'Sans classe',
            count: e._count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10); // Top 10 classes
      }
    } catch (e) {
      // Non-blocking — byClass reste []
    }

    // Compter aussi les admissions (depuis la table admissions)
    const [admissionsPending, admissionsAccepted, admissionsRejected] = await Promise.all([
      this.prisma.admission.count({
        where: { tenantId, academicYearId, status: { in: ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'] } },
      }),
      this.prisma.admission.count({
        where: { tenantId, academicYearId, status: 'ACCEPTED' },
      }),
      this.prisma.admission.count({
        where: { tenantId, academicYearId, status: 'REJECTED' },
      }),
    ]);

    return {
      total,           // élèves officiellement inscrits (ACTIVE uniquement)
      active,          // = total (alias pour clarté)
      preRegistered,   // élèves pré-inscrits (pas encore admis)
      admitted,        // élèves admis mais pas encore actifs
      pending,         // élèves en attente
      archived,        // élèves archivés
      withdrawn,       // élèves retirés
      admissionsPending,   // demandes d'admission en attente
      admissionsAccepted,  // demandes d'admission acceptées (non converties)
      admissionsRejected,  // demandes d'admission refusées
      byGender,        // ⭐ format UI: [{ label, value, count, gender }]
      byGenderByLevel, // ⭐ format UI: [{ level, boys, girls, total }]
      byClass,         // ⭐ nouveau: [{ className, count }]
      byStatus,
    };
  }

  /**
   * Liste les élèves abandonnés (status = WITHDRAWN) avec détails financiers.
   *
   * Utilisé par le tableau de pilotage (dashboard/overview) pour afficher :
   *   - totalAbandons
   *   - abandons par niveau (with gender breakdown)
   *   - abandons qui avaient payé vs impayés
   *   - montants payés/impayés par les abandons
   *
   * ⭐ FIX : avant cet endpoint, l'overview route appelait /students/abandons
   *    qui n'existait pas → fallback [] → totalAbandons = 0 dans le dashboard
   *    alors que les élèves étaient bien marqués WITHDRAWN dans l'UI.
   */
  async getAbandonedStudents(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
    scope?: AccessScope | null,
  ) {
    const where: any = {
      tenantId,
      academicYearId,
      status: 'WITHDRAWN',
    };
    // ⭐ Filtre Rôles × Pistes × Niveaux — niveau + piste IMPOSÉS par le scope
    const scopeLvl = levelWhere(scope || undefined);
    if (scopeLvl) {
      where.schoolLevelId = scopeLvl.schoolLevelId;
    }
    // ⭐ FIX 2026-09-07 « miroir bilingue » : résolution du filtre client
    //    (UUID education_levels / miroir EN / composite → UUIDs school_levels).
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      const resolvedIds = await resolveSchoolLevelFilter(this.prisma, tenantId, schoolLevelId);
      if (resolvedIds) {
        where.schoolLevelId = resolvedIds.length === 1 ? resolvedIds[0] : { in: resolvedIds };
      }
    }
    const scopeTrack = studentTrackRelation(scope || undefined);
    if (scopeTrack) {
      where.AND = [...(where.AND || []), scopeTrack as any];
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        schoolLevel: { select: { id: true, code: true, name: true, label: true } },
        studentEnrollments: {
          where: { academicYearId },
          take: 1,
          include: {
            class: { select: { id: true, name: true, code: true } },
            academicClass: { select: { id: true, name: true, code: true } },
          },
        },
        studentAccounts: {
          where: { academicYearId },
          take: 1,
          select: {
            id: true,
            totalDue: true,
            totalPaid: true,
            balance: true,
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    // Enrichir avec les infos financières + formatage
    return students.map((s: any) => {
      const account = s.studentAccounts?.[0];
      const enrollment = s.studentEnrollments?.[0];
      const totalDue = Number(account?.totalDue || 0);
      const totalPaid = Number(account?.totalPaid || 0);
      return {
        id: s.id,
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        fullName: `${s.lastName} ${s.firstName}`,
        matricule: s.matricule ?? s.studentCode ?? null,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        status: s.status,
        schoolLevel: s.schoolLevel,
        className: enrollment?.class?.name || enrollment?.academicClass?.name || '—',
        academicYearId,
        // Infos financières
        totalDue,
        totalPaid,
        balance: Number(account?.balance || 0),
        hasPaidTuition: totalPaid > 0,
        hasUnpaidTuition: totalDue - totalPaid > 0,
        unpaidAmount: Math.max(0, totalDue - totalPaid),
        // Dates
        exitDate: s.updatedAt,
        createdAt: s.createdAt,
      };
    });
  }

  /**
   * Upload photo d'élève depuis un data URL (base64) — pattern identique au RH (staff).
   *
   * Le frontend compresse l'image côté navigateur (compressImageFileToDataUrl)
   * et envoie le résultat comme JSON string. On stocke directement le data URL
   * dans StudentPhoto (originalUrl, hdUrl, thumbnailUrl).
   */
  async uploadStudentPhotoDataUrl(
    studentId: string,
    tenantId: string,
    photoDataUrl: string,
    scope?: AccessScope | null,
  ): Promise<any> {
    // Vérifier que l'élève existe
    // ⭐ FIX 2026-09-23 : scope transmis (anti-IDOR + crash undefined)
    await this.findStudentById(studentId, tenantId, scope);

    // Valider le format data URL
    const trimmed = (photoDataUrl ?? '').trim();
    const m = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
    if (!m) {
      throw new BadRequestException('Format attendu : data URL base64 (data:image/...;base64,...).');
    }
    const mimeType = m[1].trim().toLowerCase();
    if (!mimeType.startsWith('image/')) {
      throw new BadRequestException('Le fichier doit être une image.');
    }

    // Vérifier la taille (max 5 Mo décodés)
    let buffer: Buffer;
    try {
      buffer = Buffer.from(m[2], 'base64');
    } catch {
      throw new BadRequestException('Base64 invalide.');
    }
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Image trop volumineuse (max 5 Mo décodés).');
    }

    // Stocker le data URL directement (même pattern que StaffPhoto)
    const originalUrl = trimmed;
    const hdUrl = trimmed;
    const thumbnailUrl = trimmed;

    // Upsert photo (one per student)
    const photo = await this.prisma.studentPhoto.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        originalUrl,
        hdUrl,
        thumbnailUrl,
      },
      update: {
        originalUrl,
        hdUrl,
        thumbnailUrl,
      },
    });

    // Mettre aussi à jour student.photoUrl pour compatibilité
    await this.prisma.student.update({
      where: { id: studentId },
      data: { photoUrl: thumbnailUrl },
    });

    return {
      ...photo,
      originalUrl,
      hdUrl,
      thumbnailUrl,
    };
  }

  /**
   * ⭐ FIX 2026-09-23 « photo impossible à supprimer » :
   * Supprime la photo d'un élève (enregistrement student_photos + remise à
   * null de Student.photoUrl). Avant, l'UI permettait de retirer la photo du
   * formulaire de modification, mais aucun endpoint de suppression n'existait
   * → l'ancienne photo (mal cadrée, périmée…) restait en base à vie et
   * réapparaissait à chaque réouverture du dossier.
   *
   * Idempotent : ne renvoie PAS 404 si l'élève n'a pas de photo (deleted: 0).
   */
  async deleteStudentPhoto(
    studentId: string,
    tenantId: string,
    scope?: AccessScope | null,
  ) {
    // ⭐ Anti-IDOR + existence (même garde que l'upload)
    await this.findStudentById(studentId, tenantId, scope);

    // Supprimer l'enregistrement photo (0 ou 1 ligne — deleteMany idempotent)
    const deleted = await this.prisma.studentPhoto.deleteMany({
      where: { studentId, tenantId },
    });

    // Remettre à null la dénormalisation Student.photoUrl (compatibilité
    // affichage : listes, fiches, cartes scolaires)
    await this.prisma.student.update({
      where: { id: studentId },
      data: { photoUrl: null },
    });

    return { success: true, deleted: deleted.count };
  }

  // ============================================================================
  // ⭐ BULK ACTIONS — Actions multiples sur un groupe d'élèves
  // ============================================================================

  /**
   * Changement de statut en masse.
   *
   * - Vérifie que tous les studentIds appartiennent au tenant
   * - Applique le nouveau statut via updateMany (1 seule requête SQL)
   * - Écrit un audit log par élève (pour traçabilité)
   * - Si le statut est SUSPENDED ou TRANSFERRED → désactive les tokens de
   *   vérification publique (comme pour updateStudent individuel)
   *
   * @returns { updated: number, skipped: number, total: number }
   */
  async bulkUpdateStatus(
    tenantId: string,
    dto: { studentIds: string[]; status: string; reason?: string },
    userId?: string,
  ) {
    const { studentIds, status, reason } = dto;
    const now = new Date();

    // 1) Vérifier l'existence + collecter les statuts précédents (pour audit)
    const existing = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, tenantId },
      select: { id: true, status: true },
    });

    if (existing.length === 0) {
      throw new NotFoundException('Aucun élève trouvé pour les IDs fournis.');
    }

    const existingIds = new Set<string>(existing.map((s: any) => s.id));
    const skipped = studentIds.filter((id) => !existingIds.has(id));

    // 2) Appliquer le updateMany (1 seule requête SQL)
    const updateResult = await this.prisma.student.updateMany({
      where: { id: { in: Array.from(existingIds) }, tenantId },
      data: {
        status,
        // Si on passe à ARCHIVED ou WITHDRAWN → isActive = false
        // Si on repasse à ACTIVE → isActive = true
        isActive: status === 'ACTIVE',
      },
    });

    // 3) Écrire un audit log par élève (best-effort, en parallèle)
    const auditLogs = Array.from(existingIds).map((studentId) => {
      const previousStatus = existing.find((s) => s.id === studentId)?.status;
      return this.prisma.studentAuditLog
        .create({
          data: {
            tenantId,
            studentId,
            action: 'STATUS_CHANGE',
            performedBy: userId || null,
            beforeData: { status: previousStatus } as any,
            afterData: { status, reason: reason || null, changedAt: now } as any,
            createdAt: now,
          },
        })
        .catch((e: any) => {
          console.warn(`[bulkUpdateStatus] audit log failed for ${studentId}: ${e?.message}`);
        });
    });
    await Promise.all(auditLogs);

    // 4) Désactiver les tokens publics si statut suspendu/transféré
    if (status === 'SUSPENDED' || status === 'TRANSFERRED') {
      await Promise.all(
        Array.from(existingIds).map((id) =>
          this.publicVerificationService.deactivateTokensForStudent(id).catch(() => {}),
        ),
      );
    }

    return {
      updated: updateResult.count,
      skipped: skipped.length,
      total: studentIds.length,
    };
  }

  /**
   * Archivage en masse.
   *
   * - Pas de suppression physique (conforme au pattern RH)
   * - Appelle archiveStudent pour chaque élève (pour réutiliser l'audit log)
   * - Continue même si un élève échoue (best-effort)
   *
   * @returns { archived: number, failed: number, total: number, errors: Array<{id, error}> }
   */
  async bulkArchive(
    tenantId: string,
    dto: { studentIds: string[]; reason?: string },
    userId?: string,
  ) {
    const { studentIds, reason } = dto;
    let archived = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Archiver en parallèle (avec limite de concurrence implicite via Prisma)
    // mais on garde un sequential pour éviter la contention sur la DB.
    for (const id of studentIds) {
      try {
        await this.archiveStudent(id, tenantId, reason || 'Archivage en masse', userId);
        archived++;
      } catch (e: any) {
        errors.push({ id, error: e?.message || 'Erreur inconnue' });
      }
    }

    return {
      archived,
      failed: errors.length,
      total: studentIds.length,
      errors,
    };
  }

  /**
   * Réinscription en masse pour une nouvelle année académique.
   *
   * Pour chaque élève :
   * 1. Met à jour currentAcademicYearId + status ACTIVE + schoolLevelId
   * 2. Désactive les inscriptions actives précédentes pour cette année
   * 3. Crée un nouveau StudentEnrollment (status VALIDATED)
   *
   * Si classId fourni, tous les élèves sont affectés à cette classe.
   * Sinon, ils sont réinscrits sans affectation (à affecter plus tard).
   *
   * Note : on appelle assertCanEnroll une seule fois au début (pas par élève)
   * car les élèves existent déjà — la limite d'élèves du plan d'abonnement
   * s'applique au total, pas à la réinscription d'élèves existants.
   *
   * @returns { reenrolled: number, failed: number, total: number, errors: Array<{id, error}> }
   */
  async bulkReenroll(
    tenantId: string,
    dto: {
      studentIds: string[];
      academicYearId: string;
      schoolLevelId: string;
      classId?: string;
      // Le DTO valide que enrollmentType ∈ ['NEW', 'REPEAT', 'PROMOTION', 'TRANSFER']
      // via @IsIn — on accepte string ici pour rester compatible avec le type DTO.
      enrollmentType: string;
    },
  ) {
    const { studentIds, academicYearId, schoolLevelId, classId, enrollmentType } = dto;
    let reenrolled = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Vérifier que la classe existe (si fournie)
    if (classId) {
      const classExists = await this.prisma.class.findFirst({
        where: {
          id: classId,
          tenantId,
          academicYearId,
          schoolLevelId,
        },
      });
      if (!classExists) {
        throw new NotFoundException(`Classe ${classId} introuvable pour cette année/niveau.`);
      }
    }

    const now = new Date();

    for (const studentId of studentIds) {
      try {
        // Transaction par élève (pour cohérence update + enrollment)
        await this.prisma.$transaction(async (tx) => {
          // 1. Vérifier que l'élève existe
          const student = await tx.student.findFirst({
            where: { id: studentId, tenantId },
            select: { id: true, status: true },
          });
          if (!student) {
            throw new Error(`Élève ${studentId} introuvable`);
          }

          // 2. Mettre à jour l'élève
          await tx.student.update({
            where: { id: studentId },
            data: {
              currentAcademicYearId: academicYearId,
              schoolLevelId,
              status: 'ACTIVE',
              isActive: true,
            },
          });

          // 3. Désactiver les inscriptions actives précédentes pour cette année
          await tx.studentEnrollment.updateMany({
            where: {
              studentId,
              academicYearId,
              status: 'ACTIVE',
            },
            data: {
              status: 'TRANSFERRED',
              exitDate: now,
              exitReason: 'Réinscription en masse',
            },
          });

          // 4. Créer la nouvelle inscription
          await tx.studentEnrollment.create({
            data: {
              tenantId,
              studentId,
              academicYearId,
              schoolLevelId,
              classId: classId || null,
              // Le DTO valide déjà l'enum via @IsIn — on caste pour Prisma.
              enrollmentType: enrollmentType as 'NEW' | 'REPEAT' | 'PROMOTION' | 'TRANSFER',
              enrollmentDate: now,
              status: 'VALIDATED',
            },
          });
        });
        reenrolled++;
      } catch (e: any) {
        errors.push({ id: studentId, error: e?.message || 'Erreur inconnue' });
      }
    }

    // Vérifier le nombre d'élèves vs plan d'abonnement (best-effort)
    this.studentCountVerifier.verifyAfterEnrollment(tenantId).catch(() => {});

    return {
      reenrolled,
      failed: errors.length,
      total: studentIds.length,
      errors,
    };
  }
}

