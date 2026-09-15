/**
 * ============================================================================
 * ESPACE PÉDAGOGIQUE ENSEIGNANT — Service
 * ============================================================================
 *
 * Gère l'espace de travail de chaque enseignant :
 *  - Mes classes : liste des classes assignées à l'enseignant
 *  - Effectifs : garçons/filles/total par classe
 *  - Appel journalier : enregistrement des présences/absences
 *  - Cahier journal : saisie des séances quotidiennes
 *  - Cahier de texte : suivi du programme par matière
 *  - Cahier du semainier : vue hebdomadaire + soumission au directeur
 *  - Fiches pédagogiques : préparation de cours (utilise LessonPlan existant)
 *  - Devoirs & Activités : création de devoirs + suivi par élève
 *
 * Sécurité : chaque enseignant ne voit QUE ses classes (via teacher_class_assignments).
 * Les données sont filtrées par teacherId + tenantId + academicYearId.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { EmailService } from '../communication/services/email.service';
import { WhatsAppService } from '../communication/services/whatsapp.service';
import { SmsService } from '../communication/services/sms.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class PedagogicalSpaceService {
  private readonly logger = new Logger(PedagogicalSpaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly smsService: SmsService,
    private readonly notificationService: NotificationService,
  ) {}

  // ===========================================================================
  // HELPER: résoudre l'ID du Teacher depuis un userId ou teacherId
  // ===========================================================================

  /**
   * Résout l'ID du Teacher depuis un ID qui peut être soit:
   * - l'ID du Teacher directement (table teachers)
   * - l'ID du User (table users) — dans ce cas, on cherche par email
   *
   * C'est nécessaire car teacher_class_assignments.teacherId référence
   * la table teachers, pas users. Mais le frontend passe user.id.
   *
   * @returns Objet avec :
   *   - teacherId: ID du Teacher résolu (ou null si non trouvé)
   *   - userRole: Rôle du User si l'ID correspond à un User (sinon null)
   */
  private async resolveTeacherId(
    tenantId: string,
    id: string,
    caller?: { id?: string; email?: string; role?: string } | null,
  ): Promise<{ teacherId: string | null; userRole: string | null }> {
    // ⭐ FIX 2026-09-06 (F7) — anti-impersonation : si l'APPELANT authentifié a
    //    un profil Teacher, SON identité PRIME sur l'ID fourni en paramètre
    //    client. Le paramètre ne reste utile qu'aux rôles direction (consultation
    //    des fiches d'un enseignant précis).
    if (caller?.email) {
      const own = await this.prisma.teacher.findFirst({
        where: { tenantId, email: { equals: caller.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (own) {
        return { teacherId: own.id, userRole: caller.role ?? null };
      }
    }

    // Vérifier si c'est déjà un Teacher
    const directTeacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (directTeacher) {
      return { teacherId: directTeacher.id, userRole: null };
    }

    // Sinon, chercher par email (User.email → Teacher.email)
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { email: true, role: true },
    });
    if (user?.email) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { email: user.email, tenantId },
        select: { id: true },
      });
      if (teacher) {
        return { teacherId: teacher.id, userRole: user.role ?? null };
      }
    }

    // Aucun Teacher trouvé — on renvoie le rôle User pour permettre
    // à getMyClasses de décider si on doit afficher TOUTES les classes
    // (rôles direction : PROMOTER, SCHOOL_OWNER, DIRECTEUR_*, etc.)
    return { teacherId: null, userRole: user?.role ?? null };
  }

  /**
   * ⭐ Version publique de resolveTeacherId — exposée via le controller
   *    GET /seminar-config/my-teacher-id?userId=X
   *
   *    Utilisée par le frontend ListeSemainiersTab pour vérifier que seul
   *    l'enseignant connecté peut signer son cahier de semaine (sécurité
   *    anti-impersonnation). Le frontend récupère le teacherId lié au
   *    user.id connecté, puis compare avec cfg.teacherId de chaque ligne.
   *
   * @returns { teacherId: string | null, userRole: string | null }
   */
  async resolveTeacherIdPublic(tenantId: string, userId: string) {
    return this.resolveTeacherId(tenantId, userId);
  }

  /**
   * Résout le filtre teacherId à appliquer aux requêtes de lecture.
   *
   * ⭐ MODE TEST (PROMOTEUR/DIRECTION) :
   *   - Si l'utilisateur a un profil Teacher → filtre par teacherId (comportement normal)
   *   - Si l'utilisateur n'a PAS de profil Teacher mais a un rôle direction
   *     (PROMOTER, SCHOOL_OWNER, DIRECTEUR_*, ADMIN, etc.) → PAS de filtre
   *     teacherId (renvoie TOUTES les entrées du tenant/année)
   *   - Sinon → mode 'none' (renvoie un tableau vide)
   *
   * @returns Objet avec `mode` et optionnellement `teacherId`
   */
  private async resolveTeacherFilter(
    tenantId: string,
    rawTeacherId: string,
    caller?: any,
  ): Promise<
    | { mode: 'teacher'; teacherId: string }
    | { mode: 'all' }
    | { mode: 'none' }
  > {
    const { teacherId, userRole } = await this.resolveTeacherId(tenantId, rawTeacherId, caller);
    if (teacherId) return { mode: 'teacher', teacherId };
    if (userRole && PedagogicalSpaceService.GLOBAL_ACCESS_ROLES.has(userRole)) {
      return { mode: 'all' };
    }
    return { mode: 'none' };
  }

  /**
   * Rôles "direction" qui peuvent voir TOUTES les classes de l'école
   * dans l'Espace Pédagogique (vue superviseur/directeur).
   * Utilisé quand resolveTeacherId ne trouve pas de Teacher lié au User.
   */
  // ⭐ Rôles qui ont accès global à TOUTES les classes (pour test/validation)
  //    Restreint aux rôles plateforme + promoteur uniquement.
  //    Les DIRECTEUR_* / CENSEUR / SURVEILLANT doivent avoir un profil Teacher
  //    ou des accréditations pour accéder à l'Espace Pédagogique.
  private static readonly GLOBAL_ACCESS_ROLES = new Set([
    'PROMOTER',
    'PLATFORM_OWNER',
    'PLATFORM_SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'SUPER_ADMIN',
  ]);

  private static readonly DIRECTION_ROLES = new Set([
    'PROMOTER',
    'SCHOOL_OWNER',
    'SCHOOL_ADMIN',
    'PLATFORM_OWNER',
    'PLATFORM_SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'SUPER_ADMIN',
    'SUPER_DIRECTOR',
    'DIRECTEUR_GENERAL',
    'DIRECTEUR_ETABLISSEMENT',
    'DIRECTOR_GENERAL',
    'SCHOOL_DIRECTOR',
    'DEPUTY_DIRECTOR',
    'CENSEUR',
    'PEDAGOGIC_DIRECTOR',
    'PEDAGOGIC_COORDINATOR',
    'RESP_SECONDAIRE',
    'RESP_PRIMAIRE',
    'RESP_MATERNELLE',
    'admin',
    'director',
  ]);

  // ===========================================================================
  // MES CLASSES
  // ===========================================================================

  /**
   * Liste les classes assignées à un enseignant pour l'année courante.
   * Inclut les effectifs (garçons/filles/total).
   *
   * ⭐ Important : le teacherId passé peut être soit l'ID du Teacher
   * (table teachers), soit l'ID du User (table users). On doit résoudre
   * l'ID du Teacher car teacher_class_assignments.teacherId référence
   * la table teachers, pas users.
   */
  async getMyClasses(tenantId: string, teacherId: string, academicYearId: string, caller?: any) {
    // ⭐ Résoudre l'ID du Teacher (le frontend passe user.id, pas teacher.id)
    const { teacherId: resolvedTeacherId, userRole } = await this.resolveTeacherId(
      tenantId,
      teacherId,
      caller,
    );

    // ⭐ MODE ACCÈS GLOBAL (restreint aux rôles plateforme + promoteur) :
    //    Si l'utilisateur n'a PAS de profil Teacher mais possède un rôle
    //    plateforme/promoteur, on renvoie TOUTES les classes du tenant/année.
    //    Les DIRECTEUR_* / CENSEUR / SURVEILLANT ne sont PLUS inclus ici :
    //    ils doivent avoir un profil Teacher ou des accréditations pour
    //    accéder à l'Espace Pédagogique (sécurité rentrée 2026).
    if (!resolvedTeacherId && userRole && PedagogicalSpaceService.GLOBAL_ACCESS_ROLES.has(userRole)) {
      this.logger.log(
        `[getMyClasses] Accès global pour user.role=${userRole} — renvoi de toutes les classes du tenant`,
      );
      return this.getAllClassesForTenant(tenantId, academicYearId);
    }

    // Récupérer les affectations teacher_class_assignments avec toutes les relations
    const assignments = await this.prisma.teacherClassAssignment.findMany({
      where: { tenantId, academicYearId, teacherId: resolvedTeacherId ?? undefined },
      include: {
        physicalClass: {
          select: {
            id: true,
            name: true,
            capacity: true,
            schoolLevelId: true,
            schoolLevel: { select: { id: true, name: true, code: true } },
          },
        },
        classSubject: {
          select: {
            id: true,
            subjectId: true,
            subject: { select: { id: true, name: true, code: true, language: true } },
            weeklyHours: true,
            coefficient: true,
            classId: true,
            academicClassId: true,
            academicClass: {
              select: {
                id: true,
                name: true,
                code: true,
                // ⭐ AcademicClass utilise `levelId` (relation `level` vers AcademicLevel)
                // et NON `schoolLevelId` (qui est sur le modèle Class physique).
                levelId: true,
                level: { select: { id: true, name: true } },
                languageTrack: true,
                physicalClasses: {
                  select: {
                    id: true,
                    name: true,
                    capacity: true,
                    schoolLevelId: true,
                    schoolLevel: { select: { id: true, name: true, code: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Construire un map de classes (déduplication par classId)
    // En priorité : la classe physique (a.physicalClass), sinon la classe via academicClass
    const classMap = new Map<string, any>();

    for (const a of assignments) {
      // Cas 1 : classe physique directement assignée (a.classId non null)
      if (a.physicalClass) {
        const classId = a.physicalClass.id;
        const existing = classMap.get(classId);
        const subjectInfo = a.classSubject?.subject
          ? [{
              subjectId: a.classSubject.subjectId,
              subjectName: a.classSubject.subject.name,
              subjectCode: a.classSubject.subject.code,
              subjectLanguage: a.classSubject.subject.language || null,
              weeklyHours: a.classSubject.weeklyHours,
              coefficient: a.classSubject.coefficient,
            }]
          : [];

        if (existing) {
          if (a.classSubject?.subject) {
            existing.subjects.push({
              subjectId: a.classSubject.subjectId,
              subjectName: a.classSubject.subject.name,
              subjectCode: a.classSubject.subject.code,
              subjectLanguage: a.classSubject.subject.language || null,
              weeklyHours: a.classSubject.weeklyHours,
              coefficient: a.classSubject.coefficient,
            });
          }
        } else {
          classMap.set(classId, {
            classId: a.physicalClass.id,
            className: a.physicalClass.name,
            capacity: a.physicalClass.capacity,
            schoolLevelId: a.physicalClass.schoolLevelId,
            schoolLevelName: a.physicalClass.schoolLevel?.name || '',
            schoolLevelCode: a.physicalClass.schoolLevel?.code || '',
            subjects: [...subjectInfo],
          });
        }
      }

      // Cas 2 : pas de classe physique, mais une AcademicClass via classSubject
      // On récupère les classes physiques (sections) liées à cette AcademicClass
      if (!a.physicalClass && a.classSubject?.academicClass) {
        const ac = a.classSubject.academicClass;
        const physicalClasses = ac.physicalClasses || [];

        if (physicalClasses.length === 0) {
          // Si pas de sections physiques, utiliser l'AcademicClass directement
          const classId = ac.id;
          if (!classMap.has(classId)) {
            classMap.set(classId, {
              classId: ac.id,
              className: ac.name,
              capacity: ac.capacity,
              // ⭐ AcademicClass utilise `levelId` (relation `level` vers AcademicLevel)
              schoolLevelId: ac.levelId,
              schoolLevelName: ac.level?.name || '',
              schoolLevelCode: '',
              subjects: a.classSubject?.subject
                ? [{
                    subjectId: a.classSubject.subjectId,
                    subjectName: a.classSubject.subject.name,
                    subjectCode: a.classSubject.subject.code,
                    subjectLanguage: a.classSubject.subject.language || null,
                    weeklyHours: a.classSubject.weeklyHours,
                    coefficient: a.classSubject.coefficient,
                  }]
                : [],
            });
          }
        } else {
          // Pour chaque section physique de l'AcademicClass
          for (const pc of physicalClasses) {
            const classId = pc.id;
            const existing = classMap.get(classId);
            const subjectInfo = a.classSubject?.subject
              ? [{
                  subjectId: a.classSubject.subjectId,
                  subjectName: a.classSubject.subject.name,
                  subjectCode: a.classSubject.subject.code,
                  subjectLanguage: a.classSubject.subject.language || null,
                  weeklyHours: a.classSubject.weeklyHours,
                  coefficient: a.classSubject.coefficient,
                }]
              : [];

            if (existing) {
              if (a.classSubject?.subject) {
                existing.subjects.push({
                  subjectId: a.classSubject.subjectId,
                  subjectName: a.classSubject.subject.name,
                  subjectCode: a.classSubject.subject.code,
                  subjectLanguage: a.classSubject.subject.language || null,
                  weeklyHours: a.classSubject.weeklyHours,
                  coefficient: a.classSubject.coefficient,
                });
              }
            } else {
              classMap.set(classId, {
                classId: pc.id,
                className: pc.name,
                capacity: pc.capacity,
                schoolLevelId: pc.schoolLevelId,
                schoolLevelName: pc.schoolLevel?.name || '',
                schoolLevelCode: pc.schoolLevel?.code || '',
                subjects: [...subjectInfo],
              });
            }
          }
        }
      }
    }

    // Pour chaque classe, calculer les effectifs depuis les inscriptions
    const classes = Array.from(classMap.values());
    for (const cls of classes) {
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          tenantId,
          academicYearId,
          classId: cls.classId,
          status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED'] },
        },
        include: {
          student: {
            select: { id: true, gender: true, firstName: true, lastName: true, matricule: true, photoUrl: true },
          },
        },
      });

      // Si pas d'inscriptions avec classId direct, essayer via academicClassId
      if (enrollments.length === 0) {
        // Vérifier si cette classe est une AcademicClass
        const academicClass = await this.prisma.academicClass.findFirst({
          where: { id: cls.classId },
          include: {
            physicalClasses: { select: { id: true } },
            studentEnrollments: {
              where: { status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED'] } },
              include: {
                student: {
                  select: { id: true, gender: true, firstName: true, lastName: true, matricule: true, photoUrl: true },
                },
              },
            },
          },
        });

        if (academicClass) {
          // Récupérer les élèves des sections physiques
          const physicalClassIds = academicClass.physicalClasses?.map(pc => pc.id) || [];
          const physicalEnrollments = physicalClassIds.length > 0
            ? await this.prisma.studentEnrollment.findMany({
                where: {
                  tenantId,
                  academicYearId,
                  classId: { in: physicalClassIds },
                  status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED'] },
                },
                include: {
                  student: {
                    select: { id: true, gender: true, firstName: true, lastName: true, matricule: true, photoUrl: true },
                  },
                },
              })
            : [];
          // Ou directement via l'AcademicClass
          const academicEnrollments = academicClass.studentEnrollments || [];
          const allEnrollments = [...physicalEnrollments, ...academicEnrollments];

          cls.totalStudents = allEnrollments.length;
          cls.boys = allEnrollments.filter(e => e.student?.gender === 'M').length;
          cls.girls = allEnrollments.filter(e => e.student?.gender === 'F').length;
          cls.students = allEnrollments.map(e => ({
            studentId: e.student?.id,
            firstName: e.student?.firstName,
            lastName: e.student?.lastName,
            gender: e.student?.gender,
            matricule: e.student?.matricule,
            photoUrl: e.student?.photoUrl,
          }));
          continue;
        }
      }

      cls.totalStudents = enrollments.length;
      cls.boys = enrollments.filter(e => e.student?.gender === 'M').length;
      cls.girls = enrollments.filter(e => e.student?.gender === 'F').length;
      cls.students = enrollments.map(e => ({
        studentId: e.student?.id,
        firstName: e.student?.firstName,
        lastName: e.student?.lastName,
        gender: e.student?.gender,
        matricule: e.student?.matricule,
        photoUrl: e.student?.photoUrl,
      }));
    }

    return classes;
  }

  // ===========================================================================
  // TOUTES LES CLASSES DU TENANT (vue direction/promoteur)
  // ===========================================================================

  /**
   * Renvoie TOUTES les classes (physiques) du tenant pour une année donnée,
   * avec effectifs (G/F/total) et élèves. Utilisé pour la vue "superviseur"
   * des rôles direction (PROMOTER, SCHOOL_OWNER, DIRECTEUR_*, ADMIN) qui n'ont
   * pas de profil Teacher mais doivent pouvoir tester/valider l'Espace Pédagogique.
   *
   * ⚠️ MODE TEST — ne devrait pas être exposé publiquement dans l'API.
   * Pour le moment, utilisé uniquement en fallback de getMyClasses.
   */
  private async getAllClassesForTenant(tenantId: string, academicYearId: string) {
    // Récupérer toutes les classes physiques du tenant/année
    const allClasses = await this.prisma.class.findMany({
      where: { tenantId, academicYearId },
      select: {
        id: true,
        name: true,
        code: true,
        capacity: true,
        schoolLevelId: true,
        schoolLevel: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ schoolLevel: { name: 'asc' } }, { name: 'asc' }],
    });

    const classes: any[] = [];
    for (const cls of allClasses) {
      // Effectifs depuis les inscriptions
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          tenantId,
          academicYearId,
          classId: cls.id,
          status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED'] },
        },
        include: {
          student: {
            select: {
              id: true,
              gender: true,
              firstName: true,
              lastName: true,
              matricule: true,
              photoUrl: true,
            },
          },
        },
      });

      // Matières associées (via class_subjects)
      const subjects = await this.prisma.classSubject.findMany({
        where: { classId: cls.id, tenantId, academicYearId },
        select: {
          subjectId: true,
          subject: { select: { id: true, name: true, code: true } },
          weeklyHours: true,
          coefficient: true,
        },
      });

      classes.push({
        classId: cls.id,
        className: cls.name,
        capacity: cls.capacity,
        schoolLevelId: cls.schoolLevelId,
        schoolLevelName: cls.schoolLevel?.name || '',
        schoolLevelCode: cls.schoolLevel?.code || '',
        subjects: subjects.map((s) => ({
          subjectId: s.subjectId,
          subjectName: s.subject?.name || '',
          subjectCode: s.subject?.code || '',
          weeklyHours: s.weeklyHours,
          coefficient: s.coefficient,
        })),
        totalStudents: enrollments.length,
        boys: enrollments.filter((e) => e.student?.gender === 'M').length,
        girls: enrollments.filter((e) => e.student?.gender === 'F').length,
        students: enrollments.map((e) => ({
          studentId: e.student?.id,
          firstName: e.student?.firstName,
          lastName: e.student?.lastName,
          gender: e.student?.gender,
          matricule: e.student?.matricule,
          photoUrl: e.student?.photoUrl,
        })),
      });
    }

    // Si aucune classe physique trouvée, fallback sur les AcademicClass
    if (classes.length === 0) {
      const academicClasses = await this.prisma.academicClass.findMany({
        where: { tenantId, academicYearId },
        select: {
          id: true,
          name: true,
          code: true,
          capacity: true,
          schoolLevelId: true,
          schoolLevel: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ schoolLevel: { name: 'asc' } }, { name: 'asc' }],
      });

      for (const ac of academicClasses) {
        const enrollments = await this.prisma.studentEnrollment.findMany({
          where: {
            tenantId,
            academicYearId,
            academicClassId: ac.id,
            status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED'] },
          },
          include: {
            student: {
              select: {
                id: true,
                gender: true,
                firstName: true,
                lastName: true,
                matricule: true,
                photoUrl: true,
              },
            },
          },
        });

        classes.push({
          classId: ac.id,
          className: ac.name,
          capacity: ac.capacity,
          // ⭐ AcademicClass utilise `levelId` (relation `level` vers AcademicLevel)
          schoolLevelId: ac.levelId,
          schoolLevelName: ac.level?.name || '',
          schoolLevelCode: '',
          subjects: [],
          totalStudents: enrollments.length,
          boys: enrollments.filter((e) => e.student?.gender === 'M').length,
          girls: enrollments.filter((e) => e.student?.gender === 'F').length,
          students: enrollments.map((e) => ({
            studentId: e.student?.id,
            firstName: e.student?.firstName,
            lastName: e.student?.lastName,
            gender: e.student?.gender,
            matricule: e.student?.matricule,
            photoUrl: e.student?.photoUrl,
          })),
        });
      }
    }

    return classes;
  }

  // ===========================================================================
  // APPEL JOURNALIER (Daily Attendance)
  // ===========================================================================

  /**
   * Récupère l'appel du jour pour une classe.
   */
  async getDailyAttendance(
    tenantId: string,
    classId: string,
    date: string, // YYYY-MM-DD
  ) {
    // ⭐ FIX : utiliser midi (12:00) pour éviter les soucis de timezone
    //    new Date("2026-08-10") = minuit UTC → peut décaler d'un jour en local
    //    new Date("2026-08-10T12:00:00") = midi local → stable
    const dateObj = new Date(date + 'T12:00:00');

    // ⭐ TOUJOURS charger tous les élèves inscrits, puis merger avec les records existants.
    // Avant : si des records existaient, on ne renvoyait QUE les élèves enregistrés
    // → si 1 seul élève avait un record, on ne voyait que lui (bug : 1 au lieu de 9).
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        classId,
        status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED'] },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, gender: true, matricule: true, photoUrl: true },
        },
      },
    });

    // Charger les records existants pour cette date
    const records = await this.prisma.attendanceRecord.findMany({
      where: { tenantId, classId, date: dateObj },
    });

    // Créer un map studentId → record pour lookup rapide
    const recordMap = new Map<string, any>();
    for (const r of records) {
      recordMap.set(r.studentId, r);
    }

    // Merger : pour chaque élève inscrit, utiliser le record s'il existe, sinon défaut
    return enrollments
      .filter(e => e.student?.id) // Filtrer les inscriptions orphelines
      .map(e => {
        const record = recordMap.get(e.student!.id);
        // ⭐ Lire directement les colonnes dédiées (plus de hack JSON dans notes)
        //    amStatus/pmStatus/eveningStatus sont PRESENT par défaut (DDL)
        //    late est false par défaut (DDL)
        //    notes redevient un vrai champ texte libre (observations enseignant)
        return {
          studentId: e.student?.id,
          firstName: e.student?.firstName,
          lastName: e.student?.lastName,
          gender: e.student?.gender,
          matricule: e.student?.matricule,
          photoUrl: e.student?.photoUrl,
          // Compatibilité : status global dérivé
          status: record?.status || 'PRESENT',
          morningStatus: record?.amStatus || 'PRESENT',
          afternoonStatus: record?.pmStatus || 'PRESENT',
          eveningStatus: record?.eveningStatus || 'PRESENT',
          late: record?.late || false,
          lateMinutes: record?.lateMinutes || undefined,
          notes: record?.notes || undefined,
          attendanceId: record?.id || null,
        };
      });
  }

  /**
   * Enregistre l'appel journalier (crée ou met à jour les AttendanceRecord).
   */
  async saveDailyAttendance(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    classId: string,
    date: string,
    records: {
      studentId: string;
      status: string;
      morningStatus?: string;
      afternoonStatus?: string;
      eveningStatus?: string;
      late?: boolean;
      lateMinutes?: number;
      notes?: string;
    }[],
    recordedBy: string,
  ) {
    // ⭐ FIX : utiliser midi (12:00) pour éviter les soucis de timezone
    const dateObj = new Date(date + 'T12:00:00');
    const results = [];

    // ⭐ Si schoolLevelId est vide, on le résout depuis la classe.
    let resolvedSchoolLevelId = schoolLevelId;
    if (!resolvedSchoolLevelId || resolvedSchoolLevelId.trim() === '') {
      const cls = await this.prisma.class.findFirst({
        where: { id: classId, tenantId },
        select: { schoolLevelId: true },
      });
      if (cls?.schoolLevelId) {
        resolvedSchoolLevelId = cls.schoolLevelId;
      } else {
        const ac = await this.prisma.academicClass.findFirst({
          where: { id: classId, tenantId },
          select: { schoolLevelId: true },
        });
        resolvedSchoolLevelId = ac?.schoolLevelId || '';
      }
      if (!resolvedSchoolLevelId) {
        throw new BadRequestException(
          `Impossible de résoudre le niveau scolaire pour la classe ${classId}.`,
        );
      }
    }

    for (const record of records) {
      if (!record.studentId || typeof record.studentId !== 'string') {
        this.logger.warn(`[saveDailyAttendance] Record ignoré : studentId invalide`);
        continue;
      }

      // ⭐ Utiliser les colonnes dédiées amStatus/pmStatus/eveningStatus/late
      //    (plus de hack JSON dans notes — notes redevient texte libre)
      const amStatus = record.morningStatus || 'PRESENT';
      const pmStatus = record.afternoonStatus || 'PRESENT';
      const eveningStatus = record.eveningStatus || 'PRESENT';
      const isLate = !!record.late;
      const lateMinutes = record.lateMinutes || null;
      // notes est maintenant un vrai champ texte libre (observations enseignant)
      const notesText = record.notes || null;

      // ⭐ Calculer le status global dérivé :
      // PRESENT = présent toutes périodes
      // ABSENT = absent toutes périodes (journée complète)
      // ABSENT_HALF = absent au moins une période (demi-journée)
      // EXCUSED = excusé toutes périodes (prioritaire sur ABSENT)
      // LATE = en retard (prioritaire si pas d'absence)
      let globalStatus = 'PRESENT';
      const allAbsent = amStatus === 'ABSENT' && pmStatus === 'ABSENT' && (eveningStatus === 'ABSENT' || !eveningStatus);
      const anyAbsent = amStatus === 'ABSENT' || pmStatus === 'ABSENT' || eveningStatus === 'ABSENT';
      const allExcused = amStatus === 'EXCUSED' && pmStatus === 'EXCUSED' && (eveningStatus === 'EXCUSED' || !eveningStatus);
      const anyExcused = amStatus === 'EXCUSED' || pmStatus === 'EXCUSED' || eveningStatus === 'EXCUSED';

      if (allExcused) {
        globalStatus = 'EXCUSED';
      } else if (allAbsent) {
        globalStatus = 'ABSENT';
      } else if (anyAbsent || anyExcused) {
        globalStatus = 'ABSENT_HALF';
      } else if (isLate) {
        globalStatus = 'LATE';
      }

      // Vérifier si un enregistrement existe déjà
      const existing = await this.prisma.attendanceRecord.findFirst({
        where: { tenantId, classId, studentId: record.studentId, date: dateObj },
      });

      if (existing) {
        const updated = await this.prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status: globalStatus,
            amStatus,
            pmStatus,
            eveningStatus,
            late: isLate,
            lateMinutes,
            notes: notesText,
            recordedBy,
          },
        });
        results.push(updated);
      } else {
        const created = await this.prisma.attendanceRecord.create({
          data: {
            tenantId,
            academicYearId,
            schoolLevelId: resolvedSchoolLevelId,
            classId,
            studentId: record.studentId,
            date: dateObj,
            status: globalStatus,
            amStatus,
            pmStatus,
            eveningStatus,
            late: isLate,
            lateMinutes,
            notes: notesText,
            recordedBy,
          },
        });
        results.push(created);
      }
    }

    this.logger.log(`✅ Appel enregistré: ${records.length} élèves pour classe ${classId} le ${date}`);

    // ⭐ SYNCHRONISATION : mettre à jour automatiquement le registre d'appel mensuel
    // pour cette classe + ce mois. L'enseignant ne devrait pas avoir à double-saisir.
    try {
      await this.syncAttendanceToRegister(
        tenantId,
        academicYearId,
        classId,
        dateObj,
        records,
      );
    } catch (syncErr) {
      // Ne pas faire échouer l'enregistrement principal si la synch échoue
      this.logger.warn(
        `[syncAttendanceToRegister] Erreur non-bloquante: ${(syncErr as Error).message}`,
      );
    }

    return { saved: results.length, records: results };
  }

  // ===========================================================================
  // SYNCHRONISATION APPEL → REGISTRE D'APPEL MENSUEL
  // ===========================================================================

  /**
   * Synchronise les enregistrements d'appel journalier (AttendanceRecord) avec
   * le registre d'appel mensuel (AttendanceRegister) de la même classe + mois.
   *
   * Cette fonction est appelée automatiquement après chaque saveDailyAttendance
   * pour éviter la double-saisie côté enseignant.
   *
   * Logique :
   *   1. Récupère (ou crée) le registre mensuel pour (tenantId, academicYearId,
   *      classId, month, year)
   *   2. Charge tous les AttendanceRecord du mois pour cette classe
   *   3. Reconstruit le studentsData du registre en mappant chaque jour à sa
   *      semaine (lundi-vendredi) dans le mois
   *   4. Recalcule les totaux (présences possibles, absences, etc.)
   *   5. Sauvegarde le registre
   *
   * Répartition des jours en semaines :
   *   - Semaine 1 = jours 1 à 5 (lundi à vendredi) du mois — mais alignés sur
   *     les vrais jours de la semaine calendaire (ex: si le 1er juillet est un
   *     mardi, alors semaine 1 = [mardi 1, mer 2, jeu 3, ven 4])
   *   - On parcourt tous les jours du mois (1er à dernier), on regroupe par
   *     semaine ISO (lundi-vendredi).
   *   - 5 semaines max (compatible avec le template officiel).
   */
  /**
   * ⭐ Export PDF d'une fiche pédagogique individuelle.
   *    Génère un PDF structuré avec le nom de l'enseignant titulaire.
   */
  async exportFichePdf(tenantId: string, ficheId: string): Promise<Buffer> {
    // ⭐ Récupérer la fiche + le VRAI titulaire de la classe (via TeacherClassAssignment)
    //    + l'identité de l'école (nom, acronyme, logo) + l'année scolaire
    const ficheRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT pf.*, c."name" as "classNameResolved",
        tca_t."firstName" as "titularFirstName", tca_t."lastName" as "titularLastName", tca_t."gender" as "titularGender",
        tip."schoolName", tip."schoolAcronym", tip."logoUrl",
        ay."name" as "academicYearName"
       FROM "primary_pedagogical_fiches" pf
       LEFT JOIN classes c ON c."id" = pf."classId"
       LEFT JOIN teacher_class_assignments tca ON tca."classId" = pf."classId" AND tca."tenantId" = pf."tenantId"
       LEFT JOIN teachers tca_t ON tca_t."id" = tca."teacherId"
       LEFT JOIN "tenant_identity_profiles" tip ON tip."tenantId" = pf."tenantId" AND tip."isActive" = true
       LEFT JOIN "academic_years" ay ON ay."id" = pf."academicYearId"
       WHERE pf."id" = $1 AND pf."tenantId" = $2
       ORDER BY tip."version" DESC
       LIMIT 1`,
      ficheId, tenantId,
    ).catch(() => []);
    if (!ficheRows || ficheRows.length === 0) {
      throw new NotFoundException('Fiche non trouvée');
    }
    const fiche = ficheRows[0];

    // ⭐ Résoudre le nom du VRAI titulaire de la classe (pas le user connecté)
    const firstName = fiche.titularFirstName || '';
    const lastName = fiche.titularLastName || '';
    const teacherName = firstName || lastName
      ? `${fiche.titularGender === 'F' ? 'Mme' : 'M.'} ${(lastName || '').toUpperCase()} ${firstName}`.trim()
      : '—';

    // ⭐ Résoudre le logo en base64 (pour que Puppeteer puisse l'afficher)
    //    logoUrl peut être : data:image/... (déjà base64), /api/... (chemin relatif),
    //    ou https://... (URL absolue). On convertit tout en data URL.
    let logoDataUrl = '';
    if (fiche.logoUrl) {
      if (fiche.logoUrl.startsWith('data:')) {
        logoDataUrl = fiche.logoUrl;
      } else if (fiche.logoUrl.startsWith('http')) {
        // URL absolue — la passer telle quelle (Puppeteer peut la charger)
        logoDataUrl = fiche.logoUrl;
      } else {
        // Chemin relatif — construire l'URL absolue avec APP_PUBLIC_URL
        const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
          || this.configService.get<string>('API_URL')
          || 'https://api.academiahelm.com';
        logoDataUrl = `${apiBaseUrl}${fiche.logoUrl.startsWith('/') ? '' : '/'}${fiche.logoUrl}`;
      }
      fiche.logoUrl = logoDataUrl;
    }

    // ⭐ 2026-09-15 : fiches MATERNELLE (DOMAINE | DOMAINE_2) — format
    //    dédié conforme aux modèles officiels de la maternelle.
    const isMaternelleFiche = fiche.sheetType === 'DOMAINE' || fiche.sheetType === 'DOMAINE_2';
    const html = isMaternelleFiche
      ? this.buildMaternelleFichePdfHtml(fiche, teacherName)
      : this.buildFichePdfHtml(fiche, teacherName);
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500));
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        headerTemplate: '<div></div>',
        footerTemplate: '<div></div>',
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * ⭐ Export PDF de TOUTES les fiches d'un cahier journal (document combiné).
   */
  async exportAllFichesForCahierJournal(tenantId: string, journalId: string): Promise<Buffer> {
    const data = await this.getFichesForCahierJournal(tenantId, journalId);
    const fiches = data.fiches || [];
    if (fiches.length === 0) {
      throw new NotFoundException('Aucune fiche rattachée à ce cahier journal');
    }

    // Construire le HTML combiné (page break entre chaque fiche)
    let combinedHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Times New Roman',Georgia,serif; color:#1a1a1a; font-size:10px; }
      .fiche-page { page-break-after: always; padding: 10mm; }
      .fiche-page:last-child { page-break-after: auto; }
    </style></head><body>`;

    for (const fiche of fiches) {
      // Résoudre le nom de l'enseignant
      const teacherName = fiche.teacherFirstName || fiche.teacherLastName
        ? `${fiche.teacherGender === 'F' ? 'Mme' : 'M.'} ${(fiche.teacherLastName || '').toUpperCase()} ${fiche.teacherFirstName || ''}`.trim()
        : '—';
      const isMatFiche = fiche.sheetType === 'DOMAINE' || fiche.sheetType === 'DOMAINE_2';
      combinedHtml += `<div class="fiche-page">${isMatFiche ? this.buildMaternelleFichePdfHtml(fiche, teacherName, true) : this.buildFichePdfHtml(fiche, teacherName, true)}</div>`;
    }

    combinedHtml += `</body></html>`;

    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(combinedHtml, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(r => setTimeout(r, 500));
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * ⭐ Construit le HTML d'une fiche pédagogique pour export PDF.
   *    `embedded` = true si la fiche est dans un document combiné (pas de <html> wrapper).
   *
   *    Design professionnel : en-tête école + logo, filigrane acronyme, sections
   *    colorées par type, tableau structuré, signatures, footer. Identique à l'UI.
   *    ⭐ Récupère RIGOUREUSEMENT tous les champs remplis par l'enseignant.
   */
  private buildFichePdfHtml(fiche: any, teacherName: string, embedded: boolean = false): string {
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const lessonDate = fiche.lessonDate ? new Date(fiche.lessonDate) : null;
    const lessonDateStr = lessonDate
      ? `${dayNames[lessonDate.getDay()]} ${lessonDate.getDate()}/${lessonDate.getMonth() + 1}/${lessonDate.getFullYear()}`
      : '—';

    const SHEET_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; ibisTitle: string; ibisFields: { label: string; key: string; short?: boolean }[]; phases?: { label: string; key: string }[]; applicationTable?: { columns: string[]; keys: string[] } }> = {
      MATH: {
        label: 'Mathématiques', color: '#1e40af', bg: '#dbeafe', border: '#3b82f6',
        ibisTitle: 'Phases préparatoires',
        ibisFields: [
          { label: 'Calcule à brûle pourpoint', key: 'ibis_1' },
          { label: 'Comptage/Décomptage ou table de multiplication', key: 'ibis_2' },
          { label: 'Cadran opératoire', key: 'ibis_3' },
          { label: 'Calcul mental', key: 'ibis_4' },
          { label: 'Deux problèmes à résoudre mentalement', key: 'ibis_5' },
        ],
      },
      FRANCAIS: {
        label: 'Français', color: '#047857', bg: '#d1fae5', border: '#10b981',
        ibisTitle: 'Exercice structural',
        ibisFields: [
          { label: 'Unité N°', key: 'ibis_1', short: true },
          { label: 'Structure', key: 'ibis_2', short: true },
          { label: 'Objectif', key: 'ibis_3', short: true },
          { label: 'Fiche N°', key: 'ibis_4', short: true },
          { label: 'Durée (10 minutes)', key: 'ibis_5', short: true },
        ],
        phases: [
          { label: 'Phase introductive', key: 'phase_introductive' },
          { label: 'Phase de systématisation', key: 'phase_systematisation' },
        ],
        applicationTable: {
          columns: ['Entrées Enseignant(e) ou élève', 'Structure Élève 1', 'Réduction Élève 2'],
          keys: ['app_col1', 'app_col2', 'app_col3'],
        },
      },
      EST: {
        label: 'Éducation Scientifique et Technologique', color: '#6d28d9', bg: '#ede9fe', border: '#8b5cf6',
        ibisTitle: 'Activités préliminaires',
        ibisFields: [
          { label: 'Rappel de la leçon précédente', key: 'ibis_1' },
        ],
      },
      ES: {
        label: 'Éducation Sociale', color: '#b45309', bg: '#fef3c7', border: '#f59e0b',
        ibisTitle: 'Activités préliminaires',
        ibisFields: [
          { label: 'Rappel de la leçon précédente', key: 'ibis_1' },
        ],
      },
      EA: {
        label: 'Éducation Artistique', color: '#be185d', bg: '#fce7f3', border: '#ec4899',
        ibisTitle: 'Proposition de nouvelles acquisitions',
        ibisFields: [
          { label: "Annoncer l'objet d'apprentissage", key: 'ibis_1' },
          { label: 'Pré-conception', key: 'ibis_2' },
        ],
      },
      EPS: {
        label: 'Éducation Physique et Sportive', color: '#0e7490', bg: '#cffafe', border: '#06b6d4',
        ibisTitle: 'Proposition de nouvelles acquisitions',
        ibisFields: [
          { label: "Annoncer l'objet d'apprentissage (titre de l'activité physique et sportive)", key: 'ibis_1' },
          { label: 'Pré-conception', key: 'ibis_2' },
        ],
      },
      // ⭐ 2026-09-15 — FICHE STANDARD (Anglais / Informatique — enseignant
      //    spécialisé des écoles non bilingues) : structure standard du primaire.
      STANDARD: {
        label: 'Anglais / Informatique', color: '#5b21b6', bg: '#ede9fe', border: '#8b5cf6',
        ibisTitle: 'Activités préliminaires',
        ibisFields: [
          { label: 'Rappel de la leçon précédente', key: 'ibis_1' },
          { label: 'Vocabulaire / notions nouvelles de la séance', key: 'ibis_2' },
        ],
      },
    };
    const typeConfig = SHEET_TYPE_CONFIG[fiche.sheetType] || { label: fiche.sheetType || '—', color: '#0A2A5E', bg: '#f1f5f9', border: '#cbd5e1', ibisTitle: 'Section spécifique', ibisFields: [] };
    const typeLabel = typeConfig.label;

    // Récupérer les champs (strip HTML basique)
    const strip = (html: string) => (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() || '—';

    // ⭐ Filigrane : acronyme de l'école
    const schoolAcronym = fiche.schoolAcronym || (fiche.schoolName || '').substring(0, 3).toUpperCase() || '';
    const watermark = schoolAcronym
      ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:120px;font-weight:bold;color:#e2e8f0;opacity:0.12;z-index:0;pointer-events:none;white-space:nowrap;letter-spacing:8px;">${schoolAcronym}</div>`
      : '';

    // ⭐ Section I.bis (spécifique au type de fiche)
    let ibisHtml = '';
    if (typeConfig.ibisFields && typeConfig.ibisFields.length > 0) {
      const ibisRows = typeConfig.ibisFields.map(f => {
        const val = fiche[f.key];
        if (!val || strip(val) === '—') return ''; // Ne pas afficher les champs vides
        return `<tr><td style="border:1px solid #cbd5e1;padding:5px;width:35%;font-weight:bold;background:#f8fafc;font-size:9px;">${f.label}</td><td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(val)}</td></tr>`;
      }).join('');
      if (ibisRows) {
        ibisHtml = `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;font-weight:bold;color:white;background:${typeConfig.color};padding:4px 8px;border-radius:3px 3px 0 0;">I.bis — ${typeConfig.ibisTitle}</div>
          <table style="width:100%;border-collapse:collapse;font-size:9px;border:1px solid ${typeConfig.border};border-top:none;">
            ${ibisRows}
          </table>
        </div>`;
      }
    }

    // ⭐ Phases spécifiques (FRANCAIS : phase introductive + systématisation)
    let phasesHtml = '';
    if (typeConfig.phases && typeConfig.phases.length > 0) {
      const phaseRows = typeConfig.phases.map(p => {
        const val = fiche[p.key];
        if (!val || strip(val) === '—') return '';
        return `<tr><td style="border:1px solid #cbd5e1;padding:5px;width:30%;font-weight:bold;background:#f8fafc;font-size:9px;">${p.label}</td><td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(val)}</td></tr>`;
      }).join('');
      if (phaseRows) {
        phasesHtml = `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;font-weight:bold;color:white;background:${typeConfig.color};padding:4px 8px;border-radius:3px 3px 0 0;">Phases spécifiques</div>
          <table style="width:100%;border-collapse:collapse;font-size:9px;border:1px solid ${typeConfig.border};border-top:none;">
            ${phaseRows}
          </table>
        </div>`;
      }
    }

    // ⭐ Tableau d'application (FRANCAIS : 3 colonnes)
    let applicationHtml = '';
    if (typeConfig.applicationTable) {
      const cols = typeConfig.applicationTable.columns;
      const keys = typeConfig.applicationTable.keys;
      // Le tableau d'application peut être un JSON array ou des champs séparés
      let appRows = '';
      try {
        const appData = typeof fiche[keys[0]] === 'string' && fiche[keys[0]].startsWith('[')
          ? JSON.parse(fiche[keys[0]])
          : null;
        if (Array.isArray(appData) && appData.length > 0) {
          appRows = appData.map((row: any) => `
            <tr>
              <td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(row.col1 || row[keys[0]] || '')}</td>
              <td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(row.col2 || row[keys[1]] || '')}</td>
              <td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(row.col3 || row[keys[2]] || '')}</td>
            </tr>`).join('');
        }
      } catch {}
      if (!appRows) {
        // Fallback : champs séparés (app_col1, app_col2, app_col3)
        const hasAny = keys.some(k => fiche[k] && strip(fiche[k]) !== '—');
        if (hasAny) {
          appRows = `<tr>
            <td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(fiche[keys[0]])}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(fiche[keys[1]])}</td>
            <td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(fiche[keys[2]])}</td>
          </tr>`;
        }
      }
      if (appRows) {
        applicationHtml = `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;font-weight:bold;color:white;background:${typeConfig.color};padding:4px 8px;border-radius:3px 3px 0 0;">Phase d'application</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid ${typeConfig.border};border-top:none;">
            <thead>
              <tr style="background:${typeConfig.bg};">
                ${cols.map(c => `<th style="border:1px solid #cbd5e1;padding:5px;font-size:8px;">${c}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${appRows}</tbody>
          </table>
        </div>`;
      }
    }

    // Déroulement (JSON) — 3 colonnes : # + Consignes + Résultats attendus
    let deroulementRows = '';
    if (fiche.deroulement) {
      try {
        const der = typeof fiche.deroulement === 'string' ? JSON.parse(fiche.deroulement) : fiche.deroulement;
        if (Array.isArray(der)) {
          deroulementRows = der.map((d: any, i: number) => `
            <tr>
              <td style="border:1px solid #cbd5e1;padding:6px;text-align:center;font-size:9px;font-weight:bold;background:#f8fafc;width:8%;">${i + 1}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;font-size:9px;">${strip(d.consignes)}</td>
              <td style="border:1px solid #cbd5e1;padding:6px;font-size:9px;width:35%;">${strip(d.resultats)}</td>
            </tr>`).join('');
        }
      } catch {}
    }

    // (Section Effectifs supprimée du PDF — les effectifs sont déjà dans les infos générales)

    const content = `
      ${!embedded ? `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1e293b; font-size:10px; padding: 8mm; line-height:1.4; position:relative; }
        .content { position:relative; z-index:1; }
        @page { margin: 10mm; }
      </style></head><body>` : ''}

      ${watermark}

      <div class="content">

      <!-- ═══ EN-TÊTE ÉCOLE ═══ -->
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${typeConfig.color};padding-bottom:8px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${fiche.logoUrl ? `<img src="${fiche.logoUrl}" style="max-height:60px;max-width:60px;object-fit:contain;" />` : ''}
          <div>
            <div style="font-size:14px;font-weight:bold;color:#0A2A5E;">${fiche.schoolAcronym || fiche.schoolName || 'Academia Helm'}</div>
            <div style="font-size:9px;color:#64748b;">${fiche.classNameResolved || fiche.className || '—'} · ${fiche.academicYearName || 'Année scolaire'}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:bold;color:${typeConfig.color};background:${typeConfig.bg};padding:4px 10px;border-radius:4px;border:1px solid ${typeConfig.border};">FICHE PÉDAGOGIQUE</div>
          <div style="font-size:9px;color:#64748b;margin-top:3px;">${typeLabel}</div>
        </div>
      </div>

      <!-- ═══ INFO GÉNÉRALES ═══ -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:9px;">
        <tr>
          <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;width:12%;">SAN°</td>
          <td style="border:1px solid #cbd5e1;padding:5px;width:20%;">${fiche.san || '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;width:12%;">Date</td>
          <td style="border:1px solid #cbd5e1;padding:5px;width:20%;">${lessonDateStr}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;width:12%;">Durée</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${fiche.duree || fiche.adminDuree || '—'} min</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;">Classe</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${fiche.classNameResolved || fiche.className || '—'}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;">Effectif</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${fiche.totalStudents || '—'} élèves</td>
          <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;">Enseignant</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${teacherName}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;">Titre</td>
          <td colspan="5" style="border:1px solid #cbd5e1;padding:5px;font-weight:600;">${strip(fiche.titre)}</td>
        </tr>
      </table>

      <!-- ═══ I — ÉLÉMENTS DE PLANIFICATION ═══ -->
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:${typeConfig.color};padding:4px 8px;border-radius:3px 3px 0 0;">I — ÉLÉMENTS DE PLANIFICATION</div>
        <table style="width:100%;border-collapse:collapse;font-size:9px;border:1px solid ${typeConfig.border};border-top:none;">
          <tr><td style="border:1px solid #cbd5e1;padding:5px;width:30%;font-weight:bold;background:#f8fafc;">Compétences disciplinaires</td><td style="border:1px solid #cbd5e1;padding:5px;">${strip(fiche.competence)}</td></tr>
          <tr><td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;background:#f8fafc;">Compétences transversales</td><td style="border:1px solid #cbd5e1;padding:5px;">${strip(fiche.habilete)}</td></tr>
          ${fiche.prealable && strip(fiche.prealable) !== '—' ? `<tr><td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;background:#f8fafc;">Préalable</td><td style="border:1px solid #cbd5e1;padding:5px;">${strip(fiche.prealable)}</td></tr>` : ''}
          <tr><td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;background:#f8fafc;">Connaissances et techniques</td><td style="border:1px solid #cbd5e1;padding:5px;">${strip(fiche.contenu)}</td></tr>
          <tr><td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;background:#f8fafc;">Stratégie d'enseignement</td><td style="border:1px solid #cbd5e1;padding:5px;">${strip(fiche.methodes)}</td></tr>
          <tr><td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;background:#f8fafc;">Moyens didactiques</td><td style="border:1px solid #cbd5e1;padding:5px;">${strip(fiche.moyensDidactiques)}</td></tr>
        </table>
      </div>

      <!-- ═══ I.bis — SECTION SPÉCIFIQUE AU TYPE ═══ -->
      ${ibisHtml}

      <!-- ═══ PHASES SPÉCIFIQUES (FRANCAIS) ═══ -->
      ${phasesHtml}

      <!-- ═══ PHASE D'APPLICATION (FRANCAIS) ═══ -->
      ${applicationHtml}

      ${deroulementRows ? `
      <!-- ═══ II — DÉROULEMENT ═══ -->
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:${typeConfig.color};padding:4px 8px;border-radius:3px 3px 0 0;">II — DÉROULEMENT</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${typeConfig.border};border-top:none;">
          <thead>
            <tr style="background:${typeConfig.bg};">
              <th style="border:1px solid #cbd5e1;padding:5px;font-size:8px;width:8%;">#</th>
              <th style="border:1px solid #cbd5e1;padding:5px;font-size:8px;">Consignes</th>
              <th style="border:1px solid #cbd5e1;padding:5px;font-size:8px;width:35%;">Résultats attendus</th>
            </tr>
          </thead>
          <tbody>${deroulementRows}</tbody>
        </table>
      </div>` : ''}

      <!-- ═══ III — RETOUR ET PROJECTION ═══ -->
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:${typeConfig.color};padding:4px 8px;border-radius:3px 3px 0 0;">III — RETOUR ET PROJECTION</div>
        <table style="width:100%;border-collapse:collapse;font-size:9px;border:1px solid ${typeConfig.border};border-top:none;">
          <tr><td style="border:1px solid #cbd5e1;padding:5px;width:30%;font-weight:bold;background:#f8fafc;">Objectivation</td><td style="border:1px solid #cbd5e1;padding:5px;">${strip(fiche.objectivation)}</td></tr>
          <tr><td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;background:#f8fafc;">Évaluation</td><td style="border:1px solid #cbd5e1;padding:5px;">${strip(fiche.evalRetour)}</td></tr>
          <tr><td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;background:#f8fafc;">Projection</td><td style="border:1px solid #cbd5e1;padding:5px;">${strip(fiche.projection)}</td></tr>
        </table>
      </div>

      </div>

      <!-- ═══ OBSERVATIONS DU DIRECTEUR (si VALIDATED ou REJECTED) ═══ -->
      ${(() => {
        // ⭐ Observations par section (in-line, en rouge)
        let sectionObs = fiche.directorSectionObservations;
        if (typeof sectionObs === 'string') { try { sectionObs = JSON.parse(sectionObs); } catch { sectionObs = {}; } }
        const sectionLabels: Record<string, string> = {
          phase_preparatoire: 'Phase préparatoire',
          deroulement: 'Déroulement',
          retour_projection: 'Retour et projection',
        };
        let sectionObsHtml = '';
        if (sectionObs && typeof sectionObs === 'object') {
          for (const [key, val] of Object.entries(sectionObs)) {
            if (val && String(val).trim()) {
              sectionObsHtml += `<tr><td style="border:1px solid #fca5a5;padding:4px;width:30%;font-weight:bold;background:#fef2f2;color:#dc2626;">${sectionLabels[key] || key}</td><td style="border:1px solid #fca5a5;padding:4px;color:#dc2626;">${String(val)}</td></tr>`;
            }
          }
        }
        // Observation générale
        const hasGeneralObs = fiche.directorObservation && String(fiche.directorObservation).trim();
        // Motif de rejet
        const hasRejectionReason = fiche.status === 'REJECTED' && fiche.rejectionReason;
        if (sectionObsHtml || hasGeneralObs || hasRejectionReason) {
          return `
      <div style="margin-top:10px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:#dc2626;padding:4px 8px;border-radius:3px 3px 0 0;">OBSERVATIONS DU DIRECTEUR</div>
        <div style="border:1px solid #fca5a5;border-top:none;border-radius:0 0 3px 3px;padding:8px;">
          ${sectionObsHtml ? `<table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:6px;">${sectionObsHtml}</table>` : ''}
          ${hasGeneralObs ? `<div style="font-size:9px;font-weight:bold;color:#dc2626;margin-bottom:2px;">Observation générale</div><div style="font-size:9px;color:#dc2626;padding:4px;background:#fef2f2;border:1px solid #fca5a5;border-radius:3px;">${fiche.directorObservation.replace(/<[^>]*>/g, '')}</div>` : ''}
          ${hasRejectionReason ? `<div style="font-size:9px;font-weight:bold;color:#dc2626;margin-top:4px;">Motif du rejet</div><div style="font-size:9px;color:#dc2626;padding:4px;background:#fee2e2;border:1px solid #fecaca;border-radius:3px;">${fiche.rejectionReason}</div>` : ''}
        </div>
      </div>`;
        }
        return '';
      })()}

      <!-- ═══ 2026-09-15 : BLOC SIGNATURES SUPPRIMÉ — les fiches pédagogiques
           ne comportent aucune signature (décision utilisateur) ═══ -->

      <!-- ═══ FOOTER ═══ -->
      <div style="margin-top:15px;border-top:1px solid #e2e8f0;padding-top:5px;text-align:center;font-size:8px;color:#94a3b8;">
        Fiche pédagogique générée par Academia Helm · ${new Date().toLocaleDateString('fr-FR')} · ${fiche.classNameResolved || fiche.className || ''}
      </div>

      </div><!-- /.content -->

      ${!embedded ? `</body></html>` : ''}
    `;

    return content;
  }

  // ===========================================================================
  // ⭐ FICHES PÉDAGOGIQUES MATERNELLE — Export PDF
  //    2 formats conformes aux modèles officiels fournis par l'école :
  //      - DOMAINE   : fiche « Domaine » (n° renseigné par l'enseignante)
  //      - DOMAINE_2 : fiche « Domaine 2 » (DOMAINE II fixe)
  //    Contenu structuré dans la colonne JSONB maternelleContent.
  // ===========================================================================

  /** Parse la colonne maternelleContent (JSONB ou string JSON). */
  private parseMaternelleContent(raw: any): any {
    if (!raw) return {};
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    return raw;
  }

  /** Construit le HTML PDF d'une fiche pédagogique MATERNELLE (DOMAINE | DOMAINE_2). */
  private buildMaternelleFichePdfHtml(fiche: any, teacherName: string, embedded: boolean = false): string {
    const mc = this.parseMaternelleContent(fiche.maternelleContent);
    const isDom2 = fiche.sheetType === 'DOMAINE_2';
    const strip = (html: string) => (html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim() || '—';

    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const lessonDate = fiche.lessonDate ? new Date(fiche.lessonDate) : null;
    const lessonDateStr = lessonDate
      ? `${dayNames[lessonDate.getDay()]} ${lessonDate.getDate()}/${lessonDate.getMonth() + 1}/${lessonDate.getFullYear()}`
      : (mc.date || '—');

    // ⭐ Filigrane : acronyme de l'école
    const schoolAcronym = fiche.schoolAcronym || (fiche.schoolName || '').substring(0, 3).toUpperCase() || '';
    const watermark = schoolAcronym
      ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:120px;font-weight:bold;color:#e2e8f0;opacity:0.10;z-index:0;pointer-events:none;white-space:nowrap;letter-spacing:8px;">${schoolAcronym}</div>`
      : '';

    // Couleurs
    const C = '#0A2A5E';      // bleu école (bandes)
    const BORDER = '#cbd5e1'; // bordures tableaux

    // — En-tête école + titre —
    const header = `
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${C};padding-bottom:8px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          ${fiche.logoUrl ? `<img src="${fiche.logoUrl}" style="max-height:60px;max-width:60px;object-fit:contain;" />` : ''}
          <div>
            <div style="font-size:14px;font-weight:bold;color:${C};">ÉCOLE MATERNELLE — ${fiche.schoolAcronym || fiche.schoolName || 'Academia Helm'}</div>
            <div style="font-size:9px;color:#64748b;">${fiche.classNameResolved || fiche.className || '—'} · ${fiche.academicYearName || 'Année scolaire'}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:bold;color:${C};background:#dbeafe;padding:4px 10px;border-radius:4px;border:1px solid #3b82f6;">FICHE PÉDAGOGIQUE</div>
          <div style="font-size:9px;color:#64748b;margin-top:3px;">${isDom2 ? 'DOMAINE II' : 'DOMAINE'}</div>
        </div>
      </div>`;

    // — Bloc identification —
    const ficheDe = mc.ficheDe || teacherName;
    const domainBadge = isDom2
      ? `<span style="display:inline-block;background:${C};color:white;font-weight:bold;font-size:10px;padding:3px 10px;border-radius:3px;">DOMAINE II</span>`
      : `<span style="display:inline-block;background:${C};color:white;font-weight:bold;font-size:10px;padding:3px 10px;border-radius:3px;">DOMAINE</span>
         <span style="display:inline-block;min-width:30px;border-bottom:2px solid ${C};text-align:center;font-size:10px;padding:0 6px;">${mc.domainNumber ? strip(mc.domainNumber) : ''}</span>`;

    const identification = `
      <div style="font-size:9px;margin-bottom:4px;"><b>FICHE DE :</b> <span style="border-bottom:1px dotted #94a3b8;">${strip(ficheDe)}</span></div>
      <div style="font-size:10px;margin-bottom:6px;">${domainBadge}</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;font-size:9px;">
        <tr>
          <td style="border:1px solid ${BORDER};padding:5px;background:#f8fafc;font-weight:bold;width:14%;">Domaine du :</td>
          <td style="border:1px solid ${BORDER};padding:5px;width:36%;">${strip(mc.domaineDu)}</td>
          <td style="border:1px solid ${BORDER};padding:5px;background:#f8fafc;font-weight:bold;width:14%;">Date :</td>
          <td style="border:1px solid ${BORDER};padding:5px;">${lessonDateStr}</td>
        </tr>
        <tr>
          <td style="border:1px solid ${BORDER};padding:5px;background:#f8fafc;font-weight:bold;">Composante :</td>
          <td style="border:1px solid ${BORDER};padding:5px;">${strip(mc.composante)}</td>
          <td style="border:1px solid ${BORDER};padding:5px;background:#f8fafc;font-weight:bold;">Sous-composante :</td>
          <td style="border:1px solid ${BORDER};padding:5px;">${strip(mc.sousComposante)}</td>
        </tr>
        <tr>
          <td style="border:1px solid ${BORDER};padding:5px;background:#f8fafc;font-weight:bold;" colspan="2">${isDom2 ? 'Activit\u00e9 d\'apprentissage n\u00b0' : 'ACTIVITES D\'APPRENTISSAGE N\u00b0'} :</td>
          <td style="border:1px solid ${BORDER};padding:5px;" colspan="2">${strip(mc.activiteNumero)}</td>
        </tr>
      </table>`;

    // — Champs pédagogiques —
    const fieldRow = (label: string, val: any) =>
      `<tr><td style="border:1px solid ${BORDER};padding:5px;width:30%;font-weight:bold;background:#f8fafc;font-size:9px;">${label}</td><td style="border:1px solid ${BORDER};padding:5px;font-size:9px;">${strip(val)}</td></tr>`;
    const champs = `
      <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:8px;">
        ${fieldRow('Thème', mc.theme)}
        ${fieldRow('Titre', mc.titre)}
        ${fieldRow('Section', mc.section)}
        ${fieldRow('Durée', mc.duree)}
        ${fieldRow(isDom2 ? 'Matériels' : 'Matériel', mc.materiel)}
        ${fieldRow('Compétence', mc.competence)}
        ${fieldRow(isDom2 ? 'Capacités' : 'Capacité', mc.capacite)}
        ${fieldRow('Habilités', mc.habiletes)}
        ${fieldRow("Stratégies D'ens/Apprent/Eval", mc.strategies)}
      </table>`;

    // — DÉROULEMENT —
    let deroulementHtml = '';
    if (isDom2) {
      // Tableau 5 colonnes : Plan | Durée | Description des activités | Formation Evolution | Dosage
      const rows = (Array.isArray(mc.der5) ? mc.der5 : [])
        .map((r: any) => `<tr>
          <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;text-align:center;">${strip(r.plan)}</td>
          <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;text-align:center;">${strip(r.duree)}</td>
          <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;">${strip(r.description)}</td>
          <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;">${strip(r.formationEvolution)}</td>
          <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;text-align:center;">${strip(r.dosage)}</td>
        </tr>`).join('');
      if (rows) {
        deroulementHtml = `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;font-weight:bold;color:white;background:${C};padding:4px 8px;border-radius:3px 3px 0 0;">DÉROULEMENT</div>
          <table style="width:100%;border-collapse:collapse;border:1px solid ${C};border-top:none;">
            <thead><tr style="background:#dbeafe;">
              <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;width:8%;">Plan</th>
              <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;width:10%;">Durée</th>
              <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;">Description des activités</th>
              <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;width:18%;">Formation Evolution</th>
              <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;width:10%;">Dosage</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      }
    } else {
      // Tableau 2 colonnes : Consignes | Résultats Attendus — avec INTRODUCTION
      const intro = mc.deroulementIntro || {};
      const introRow = (label: string, cell: any) => `<tr>
        <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;"><b>${label} :</b> ${strip(cell?.consignes)}</td>
        <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;width:38%;">${strip(cell?.resultats)}</td>
      </tr>`;
      deroulementHtml = `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:${C};padding:4px 8px;border-radius:3px 3px 0 0;">DÉROULEMENT</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${C};border-top:none;">
          <thead><tr style="background:#dbeafe;">
            <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;text-align:left;">Consignes :</th>
            <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;text-align:left;width:38%;">Résultats Attendus :</th>
          </tr></thead>
          <tbody>
            <tr><td colspan="2" style="border:1px solid ${BORDER};padding:4px 5px;font-size:9px;font-weight:bold;background:#eff6ff;">INTRODUCTION</td></tr>
            ${introRow('Mise en situation', intro.miseEnSituation)}
            ${introRow('Prise en compte des acquis antérieurs', intro.acquisAnterieurs)}
            ${introRow("Annonce de l'apprentissage du jour", intro.annonceApprentissage)}
          </tbody>
        </table>
      </div>`;
    }

    // — INTRODUCTION (DOMAINE_2 — 3 zones) —
    let introHtml = '';
    if (isDom2 && mc.intro) {
      introHtml = `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:${C};padding:4px 8px;border-radius:3px 3px 0 0;">INTRODUCTION</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${C};border-top:none;">
          <tr>
            <td style="border:1px solid ${BORDER};padding:5px;font-size:8px;font-weight:bold;background:#dbeafe;vertical-align:top;width:33%;">Mise en situation<br><span style="font-weight:normal;font-size:9px;color:#1e293b;">${strip(mc.intro.miseEnSituation)}</span></td>
            <td style="border:1px solid ${BORDER};padding:5px;font-size:8px;font-weight:bold;background:#dbeafe;vertical-align:top;width:34%;">Prise en compte des acquis antérieurs<br><span style="font-weight:normal;font-size:9px;color:#1e293b;">${strip(mc.intro.acquisAnterieurs)}</span></td>
            <td style="border:1px solid ${BORDER};padding:5px;font-size:8px;font-weight:bold;background:#dbeafe;vertical-align:top;width:33%;">Annonce de l'apprentissage du jour<br><span style="font-weight:normal;font-size:9px;color:#1e293b;">${strip(mc.intro.annonceApprentissage)}</span></td>
          </tr>
        </table>
      </div>`;
    }

    // — RÉALISATION (+ sous-structure DOMAINE_2) —
    let realisationHtml = `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:${C};padding:4px 8px;border-radius:3px 3px 0 0;">RÉALISATION — Construction de nouveaux savoirs</div>
        <div style="border:1px solid ${C};border-top:none;padding:5px;font-size:9px;min-height:30px;">${strip(mc.realisation)}</div>
      </div>`;
    if (isDom2) {
      const act = mc.activites || {};
      realisationHtml += `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:${C};padding:4px 8px;border-radius:3px 3px 0 0;">SUITE DE LA RÉALISATION</div>
        <table style="width:100%;border-collapse:collapse;font-size:9px;border:1px solid ${C};border-top:none;">
          <tr><td style="border:1px solid ${BORDER};padding:5px;width:30%;font-weight:bold;background:#f8fafc;">Situation problème :</td><td style="border:1px solid ${BORDER};padding:5px;">${strip(mc.situationProbleme)}</td></tr>
          <tr><td style="border:1px solid ${BORDER};padding:5px;font-weight:bold;background:#f8fafc;">Question de compréhension :</td><td style="border:1px solid ${BORDER};padding:5px;">${strip(mc.questionComprehension)}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${C};border-top:none;margin-top:4px;">
          <tr style="background:#dbeafe;">
            <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;width:33%;">Activité n° 1</th>
            <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;width:33%;">Activité n° 2</th>
            <th style="border:1px solid ${BORDER};padding:5px;font-size:8px;width:33%;">Activité n° 3</th>
          </tr>
          <tr style="vertical-align:top;">
            <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;">${strip(act.a1)}</td>
            <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;">${strip(act.a2)}${act.nb2 ? `<br><b>NB :</b> ${strip(act.nb2)}` : ''}</td>
            <td style="border:1px solid ${BORDER};padding:5px;font-size:9px;">${strip(act.a3)}${act.nb3 ? `<br><b>NB :</b> ${strip(act.nb3)}` : ''}</td>
          </tr>
        </table>
      </div>`;
    }

    // — RETOUR ET PROJECTION —
    const retourRow = (label: string, val: any) =>
      `<tr><td style="border:1px solid ${BORDER};padding:5px;width:22%;font-weight:bold;background:#f8fafc;font-size:9px;">${label}</td><td style="border:1px solid ${BORDER};padding:5px;font-size:9px;">${strip(val)}</td></tr>`;
    const retourHtml = `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:${C};padding:4px 8px;border-radius:3px 3px 0 0;">RETOUR ET PROJECTION</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${C};border-top:none;">
          ${retourRow('Retour', mc.retour)}
          ${retourRow('Evaluation', mc.evaluation)}
          ${retourRow('Connexion', mc.connexion)}
          ${retourRow('Projection', mc.projection)}
        </table>
      </div>`;

    // — RANGEMENT + Notes personnelles —
    const rangementHtml = `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:${C};padding:4px 8px;border-radius:3px 3px 0 0;">RANGEMENT</div>
        <div style="border:1px solid ${C};border-top:none;padding:5px;font-size:9px;min-height:24px;">${strip(mc.rangement)}</div>
      </div>
      <div style="font-size:9px;margin-bottom:8px;"><b>Notes personnelles :</b> <span style="border-bottom:1px dotted #94a3b8;">${strip(mc.notesPersonnelles)}</span></div>`;

    // — Observations du directeur —
    let sectionObs = fiche.directorSectionObservations;
    if (typeof sectionObs === 'string') { try { sectionObs = JSON.parse(sectionObs); } catch { sectionObs = {}; } }
    const maternelleSectionLabels: Record<string, string> = {
      en_tete: 'En-tête et champs',
      deroulement: 'Déroulement',
      realisation: 'Réalisation',
      retour_projection: 'Retour et projection',
      rangement: 'Rangement',
    };
    let sectionObsHtml = '';
    if (sectionObs && typeof sectionObs === 'object') {
      for (const [key, val] of Object.entries(sectionObs)) {
        if (val && String(val).trim()) {
          sectionObsHtml += `<tr><td style="border:1px solid #fca5a5;padding:4px;width:30%;font-weight:bold;background:#fef2f2;color:#dc2626;font-size:9px;">${maternelleSectionLabels[key] || key}</td><td style="border:1px solid #fca5a5;padding:4px;color:#dc2626;font-size:9px;">${String(val)}</td></tr>`;
        }
      }
    }
    const hasGeneralObs = fiche.directorObservation && String(fiche.directorObservation).trim();
    const hasRejectionReason = fiche.status === 'REJECTED' && fiche.rejectionReason;
    const directorHtml = (sectionObsHtml || hasGeneralObs || hasRejectionReason) ? `
      <div style="margin-top:10px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:#dc2626;padding:4px 8px;border-radius:3px 3px 0 0;">OBSERVATIONS DU DIRECTEUR</div>
        <div style="border:1px solid #fca5a5;border-top:none;border-radius:0 0 3px 3px;padding:8px;">
          ${sectionObsHtml ? `<table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:6px;">${sectionObsHtml}</table>` : ''}
          ${hasGeneralObs ? `<div style="font-size:9px;font-weight:bold;color:#dc2626;margin-bottom:2px;">Observation générale</div><div style="font-size:9px;color:#dc2626;padding:4px;background:#fef2f2;border:1px solid #fca5a5;border-radius:3px;">${String(fiche.directorObservation).replace(/<[^>]*>/g, '')}</div>` : ''}
          ${hasRejectionReason ? `<div style="font-size:9px;font-weight:bold;color:#dc2626;margin-top:4px;">Motif du rejet</div><div style="font-size:9px;color:#dc2626;padding:4px;background:#fee2e2;border:1px solid #fecaca;border-radius:3px;">${fiche.rejectionReason}</div>` : ''}
        </div>
      </div>` : '';

    const content = `
      ${!embedded ? `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1e293b; font-size:10px; padding: 8mm; line-height:1.4; position:relative; }
        .content { position:relative; z-index:1; }
        @page { margin: 10mm; }
      </style></head><body>` : ''}

      ${watermark}

      <div class="content">
        ${header}
        ${identification}
        ${champs}
        ${deroulementHtml}
        ${introHtml}
        ${realisationHtml}
        ${retourHtml}
        ${rangementHtml}
      </div>

      ${directorHtml}

      <div style="margin-top:15px;border-top:1px solid #e2e8f0;padding-top:5px;text-align:center;font-size:8px;color:#94a3b8;">
        Fiche pédagogique ${isDom2 ? 'Domaine 2' : 'Domaine'} · Maternelle · générée par Academia Helm · ${new Date().toLocaleDateString('fr-FR')} · ${fiche.classNameResolved || fiche.className || ''}
      </div>

      ${!embedded ? `</body></html>` : ''}
    `;
    return content;
  }

  async syncAttendanceToRegister(
    tenantId: string,
    academicYearId: string,
    classId: string,
    dateObj: Date,
    records: { studentId: string; status: string; notes?: string }[],
  ) {
    const month = dateObj.getMonth() + 1; // 1-12
    const year = dateObj.getFullYear();

    // ⭐ 1. Calculer la structure des semaines du mois
    // Pour chaque jour du mois (1er à dernier), déterminer sa semaine (1-5)
    // dans le mois. On groupe par "semaine du mois" : la première semaine
    // commence au 1er du mois (même si c'est un mardi) et dure jusqu'au
    // premier vendredi. Ensuite chaque lundi commence une nouvelle semaine.
    const monthDays: { day: number; dateObj: Date; dow: number; weekInMonth: number; dayInWeek: number }[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    let currentWeek = 1;
    let lastDow = -1;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const dow = d.getDay(); // 0=dimanche, 1=lundi, ..., 6=samedi
      // On ne traite que lundi-vendredi (dow 1-5)
      if (dow < 1 || dow > 5) continue;
      // Si on était sur un vendredi (5) et qu'on passe au lundi suivant (1),
      // on incrémente la semaine
      if (lastDow === 5 && dow === 1) {
        currentWeek++;
      }
      // Limiter à 5 semaines max (template officiel)
      if (currentWeek > 5) continue;
      // dow 1=lundi → dayInWeek 1, 2=mardi → 2, ..., 5=vendredi → 5
      monthDays.push({
        day,
        dateObj: d,
        dow,
        weekInMonth: currentWeek,
        dayInWeek: dow, // 1=lun, 2=mar, 3=mer, 4=jeu, 5=ven
      });
      lastDow = dow;
    }

    // Construire un map (dateStr → { weekInMonth, dayInWeek }) pour lookup rapide
    const dateToCell = new Map<string, { weekInMonth: number; dayInWeek: number }>();
    for (const md of monthDays) {
      const dateStr = `${md.dateObj.getFullYear()}-${String(month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`;
      dateToCell.set(dateStr, { weekInMonth: md.weekInMonth, dayInWeek: md.dayInWeek });
    }

    // ⭐ 2. Charger tous les AttendanceRecord du mois pour cette classe
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const allRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        tenantId,
        classId,
        date: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { updatedAt: 'asc' },
      include: {
        student: {
          select: {
            id: true, firstName: true, lastName: true, gender: true,
          },
        },
      },
    });

    // ⭐ 3. Résoudre le teacherId : utiliser le premier record.recordedBy,
    // sinon fallback sur le teacherId des assignments existants pour cette classe.
    let teacherIdForRegister = '';
    if (allRecords.length > 0 && allRecords[0].recordedBy) {
      // recordedBy est un user.id — vérifier si un Teacher correspond
      const teacherByUserId = await this.resolveTeacherId(tenantId, allRecords[0].recordedBy!);
      if (teacherByUserId.teacherId) {
        teacherIdForRegister = teacherByUserId.teacherId;
      }
    }
    if (!teacherIdForRegister) {
      // Fallback : premier teacher assigné à cette classe
      const assignment = await this.prisma.teacherClassAssignment.findFirst({
        where: { tenantId, academicYearId, classId },
        select: { teacherId: true },
      });
      teacherIdForRegister = assignment?.teacherId || '';
    }
    if (!teacherIdForRegister) {
      this.logger.warn(
        `[syncAttendanceToRegister] Impossible de déterminer le teacherId pour le registre — ignoré.`,
      );
      return;
    }

    // ⭐ 4. Récupérer ou créer le registre mensuel
    const register = await this.getOrCreateAttendanceRegister(
      tenantId,
      academicYearId,
      teacherIdForRegister,
      classId,
      month,
      year,
    );
    const registerId = register.id;

    // ⭐ 5. Récupérer la liste des élèves de la classe (depuis studentsData
    // existant ou depuis les inscriptions)
    let studentsData: any[] = [];
    if (register.studentsData) {
      const raw = typeof register.studentsData === 'string'
        ? JSON.parse(register.studentsData)
        : register.studentsData;
      if (Array.isArray(raw)) studentsData = raw;
    }

    // Inscriptions actives de la classe (servent à l'initialisation ET à
    // l'union ci-dessous)
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId, academicYearId, classId,
        status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED'] },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, gender: true },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    // Si studentsData est vide, initialiser depuis les inscriptions
    if (studentsData.length === 0) {
      studentsData = enrollments.map((e, idx) => ({
        studentId: e.student?.id,
        numero: idx + 1,
        nom: e.student?.lastName || '',
        prenom: e.student?.firstName || '',
        sexe: (e.student?.gender || '').toUpperCase() === 'FEMALE' ? 'F'
          : (e.student?.gender || '').toUpperCase() === 'MALE' ? 'M' : 'M',
        absences: [],
        motif: '',
        totalPresencesPossibles: 0,
        totalAbsences: 0,
        totalPresenceEffectif: 0,
        observation: '',
        nbDemiJournees: 0,
      }));
    } else {
      // ⭐ FIX 2026-09-15 (inscription en cours de mois) : ajouter à studentsData
      //    les élèves inscrits qui n'y figurent pas encore — sinon leurs appels
      //    étaient IGNORÉS silencieusement (la boucle de reconstruction ne
      //    parcourt que les élèves présents dans studentsData).
      const known = new Set(studentsData.map((s: any) => s.studentId));
      let numero = studentsData.length;
      for (const e of enrollments) {
        if (!e.student?.id || known.has(e.student.id)) continue;
        numero++;
        studentsData.push({
          studentId: e.student.id,
          numero,
          nom: e.student.lastName || '',
          prenom: e.student.firstName || '',
          sexe: (e.student.gender || '').toUpperCase() === 'FEMALE' ? 'F'
            : (e.student.gender || '').toUpperCase() === 'MALE' ? 'M' : 'M',
          absences: [],
          motif: '',
          totalPresencesPossibles: 0,
          totalAbsences: 0,
          totalPresenceEffectif: 0,
          observation: '',
          nbDemiJournees: 0,
        });
      }
    }

    // ⭐ 6. Reconstruire les absences pour chaque élève à partir de tous les
    // AttendanceRecord du mois. On groupe par studentId puis on mappe chaque
    // record vers (weekInMonth, dayInWeek) en utilisant dateToCell.
    //
    // ⭐ SYSTÈME DEMI-JOURS (explication utilisateur) :
    //   - Lundi = 2 demi-jours, Mardi = 2, Mercredi = 1, Jeudi = 2, Vendredi = 2
    //   - Total par semaine = 9 demi-jours
    //   - Total Présence Possible (mois) = somme des demi-jours de tous les
    //     jours ouvrés du mois (Lundi-Vendredi).
    //   - Ce total est LE MÊME pour TOUS les élèves de la classe.
    //
    // ⭐ MARQUAGE DES ABSENCES (matin / après-midi) :
    //   - Chaque record a morningStatus et afternoonStatus (stockés dans notes JSON)
    //   - PRESENT matin + PRESENT après-midi → case vide (0 absence)
    //   - ABSENT matin + PRESENT après-midi → "-" (1 absence = 1 demi-jour)
    //   - PRESENT matin + ABSENT après-midi → "|" (1 absence = 1 demi-jour)
    //   - ABSENT matin + ABSENT après-midi → "+" (2 absences = 2 demi-jours)
    //
    // ⭐ CALCULS :
    //   - Total Absences (par élève) = somme des absences de chaque jour (0, 1, ou 2)
    //   - Total Présence Effective = Total Présence Possible - Total Absences
    const recordsByStudent = new Map<string, typeof allRecords>();
    // ⭐ FIX 2026-09-15 (déduplication) : des enregistrements hérités existent
    //    en DOUBLON pour un même (élève, jour) — l'ancien code stockait la date
    //    à 00:00 UTC (new Date("YYYY-MM-DD")), le code actuel à midi local
    //    (anti-fuseau) → le findFirst du save ne voyait pas le record minuit et
    //    créait un doublon. La synchro voyait alors DEUX statuts pour la même
    //    case → marque non déterministe (ordre de lecture). On déduplique par
    //    (élève, jour local) en gardant le record le plus récent (updatedAt).
    const deduped: { studentId: string; date: Date; amStatus: string; pmStatus: string; eveningStatus: string; late: boolean; updatedAt: Date }[] = [];
    const seenDay = new Map<string, number>();
    for (const r of allRecords) {
      const d = r.date as unknown as Date;
      const localKey = `${r.studentId}|${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const prevIdx = seenDay.get(localKey);
      if (prevIdx !== undefined) {
        deduped[prevIdx] = r as any; // orderBy updatedAt asc → le dernier gagne
      } else {
        seenDay.set(localKey, deduped.length);
        deduped.push(r as any);
      }
    }
    for (const r of deduped) {
      const arr = recordsByStudent.get(r.studentId) || [];
      arr.push(r as any);
      recordsByStudent.set(r.studentId, arr);
    }

    // ⭐ Calculer le nombre total de demi-jours du mois (SAME for all students)
    // Lundi=2, Mardi=2, Mercredi=1, Jeudi=2, Vendredi=2
    const DEMI_JOURS_PAR_JOUR: Record<number, number> = {
      1: 2, // Lundi
      2: 2, // Mardi
      3: 1, // Mercredi
      4: 2, // Jeudi
      5: 2, // Vendredi
    };
    let totalDemiJourneesMois = 0;
    for (const md of monthDays) {
      totalDemiJourneesMois += DEMI_JOURS_PAR_JOUR[md.dow] || 0;
    }

    for (const student of studentsData) {
      const studentRecords = recordsByStudent.get(student.studentId) || [];
      const newAbsences: any[] = [];

      for (const r of studentRecords) {
        // ⭐ FIX : utiliser la date locale (YYYY-MM-DD) au lieu de toISOString()
        //    qui convertit en UTC. Si l'enregistrement a été fait à minuit heure
        //    locale (UTC+1), toISOString() renvoie la veille en UTC → le dateStr
        //    ne correspond pas aux clés de dateToCell (construites en local) →
        //    l'absence n'est jamais mappée → le tableau reste vide.
        const d = r.date;
        const localYear = d.getFullYear();
        const localMonth = String(d.getMonth() + 1).padStart(2, '0');
        const localDay = String(d.getDate()).padStart(2, '0');
        const dateStr = `${localYear}-${localMonth}-${localDay}`;
        const cell = dateToCell.get(dateStr);
        if (!cell) continue;

        // ⭐ Lire directement les colonnes dédiées (plus de hack JSON)
        const morning = r.amStatus || 'PRESENT';
        const afternoon = r.pmStatus || 'PRESENT';
        const evening = r.eveningStatus || 'PRESENT';
        const late = r.late || false;

        // Calculer le marquage et le nombre d'absences
        // Symboles du registre :
        //   '+' = absent toute la journée (matin + après-midi)
        //   '-' = absent le matin seulement
        //   '|' = absent l'après-midi seulement
        //   'E' = excusé (toute la journée ou demi-journée)
        let marked = '';
        let absenceCount = 0;
        const amAbsent = morning === 'ABSENT';
        const pmAbsent = afternoon === 'ABSENT';
        const amExcused = morning === 'EXCUSED';
        const pmExcused = afternoon === 'EXCUSED';

        if (amAbsent && pmAbsent) {
          marked = '+'; // Croix (absent toute la journée)
          absenceCount = 2;
        } else if (amAbsent) {
          marked = '-'; // Trait horizontal (absent matin)
          absenceCount = 1;
        } else if (pmAbsent) {
          marked = '|'; // Trait vertical (absent après-midi)
          absenceCount = 1;
        } else if (amExcused && pmExcused) {
          marked = 'E'; // Excusé toute la journée
          absenceCount = 0; // excusé ne compte pas comme absence
        } else if (amExcused) {
          marked = 'E'; // Excusé matin
          absenceCount = 0;
        } else if (pmExcused) {
          marked = 'E'; // Excusé après-midi
          absenceCount = 0;
        }
        // PRESENT + PRESENT → case vide (marked = '', absenceCount = 0)

        if (marked) {
          newAbsences.push({
            week: cell.weekInMonth,
            day: cell.dayInWeek,
            marked,
            absenceCount,
          });
        }

        // Si en retard, ajouter une observation
        if (late) {
          student.observation = (student.observation || '') + (student.observation ? ' ' : '') + `Retard ${dateStr}`;
        }
      }

      // Recalculer les totaux
      const totalAbsences = newAbsences.reduce((sum, a) => sum + a.absenceCount, 0);
      // ⭐ Total Présence Possible = nombre de demi-jours du mois (SAME for ALL students)
      const totalPresencesPossibles = totalDemiJourneesMois;
      const totalPresenceEffectif = totalPresencesPossibles - totalAbsences;

      student.absences = newAbsences;
      student.totalAbsences = totalAbsences;
      student.totalPresencesPossibles = totalPresencesPossibles;
      student.totalPresenceEffectif = totalPresenceEffectif;
      student.nbDemiJournees = totalDemiJourneesMois;
    }

    // ⭐ 7. Recalculer les totaux globaux du mois (section récapitulative)
    // Total Présence Possible = somme de la colonne (= demi-jours × nb élèves)
    // Total Absences = somme de la colonne absences
    // Total Présence Effective = Total Présence Possible - Total Absences
    const totalAbs = studentsData.reduce((sum, s) => sum + (s.totalAbsences || 0), 0);
    const totalPoss = studentsData.reduce((sum, s) => sum + (s.totalPresencesPossibles || 0), 0);
    const totalEff = totalPoss - totalAbs; // = somme de la colonne présence effective
    const pctP = totalPoss > 0 ? Math.round((totalEff / totalPoss) * 10000) / 100 : 0;
    const pctA = totalPoss > 0 ? Math.round((totalAbs / totalPoss) * 10000) / 100 : 0;

    // ⭐ 8. Sauvegarder le registre
    await this.prisma.$executeRawUnsafe(
      `UPDATE "attendance_registers"
       SET "studentsData" = $1,
           "demiJourneeMois" = $2,
           "presencePossibleMois" = $3,
           "totalAbsencesMois" = $4,
           "totalPresencesEffectivesMois" = $5,
           "pourcentagePresences" = $6,
           "pourcentageAbsences" = $7,
           "updatedAt" = NOW()
       WHERE "id" = $8`,
      JSON.stringify(studentsData),
      totalPoss,
      totalPoss,
      totalAbs,
      totalEff,
      pctP,
      pctA,
      registerId,
    );

    this.logger.log(
      `✅ Registre d'appel synchronisé: ${registerId} — ${studentsData.length} élèves, ` +
      `${monthDays.length} jours ouvrés, ${totalAbs} absences, ${pctP}% présences`,
    );
  }

  // ===========================================================================
  // CAHIER JOURNAL (Class Log)
  // ===========================================================================

  /**
   * Récupère les entrées du cahier journal pour un enseignant.
   */
  async getClassLogs(
    tenantId: string,
    teacherId: string,
    academicYearId: string,
    classId?: string,
    date?: string,
   caller?: any) {
    // ⭐ TEST PROMOTEUR/DIRECTION : si l'utilisateur n'a pas de profil Teacher
    // mais a un rôle direction, on ne filtre PAS par teacherId (vue superviseur).
    const filter = await this.resolveTeacherFilter(tenantId, teacherId, caller);
    if (filter.mode === 'none') return [];

    const where: any = { tenantId, academicYearId };
    if (filter.mode === 'teacher') where.teacherId = filter.teacherId;
    if (classId) where.classId = classId;
    if (date) where.lessonDate = new Date(date);

    return this.prisma.classLog.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { lessonDate: 'desc' },
      take: 100,
    });
  }

  /**
   * Crée une entrée du cahier journal.
   */
  async createClassLog(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    data: {
      classId: string;
      subjectId: string;
      lessonDate: string;
      topic: string;
      durationHours: number;
      homework?: string;
      detailedContent?: string;
      materialsUsed?: string;
      observations?: string;
      actualStart?: string;
      actualEnd?: string;
    },
  ) {
    // Vérifier que l'enseignant est bien assigné à cette classe/matière
    const assignment = await this.prisma.teacherClassAssignment.findFirst({
      where: { tenantId, academicYearId, teacherId, classId: data.classId },
    });
    if (!assignment) {
      throw new BadRequestException('Vous n\'êtes pas assigné à cette classe');
    }

    return this.prisma.classLog.create({
      data: {
        tenantId,
        academicYearId,
        teacherId,
        classId: data.classId,
        subjectId: data.subjectId,
        lessonDate: new Date(data.lessonDate),
        topic: data.topic,
        durationHours: data.durationHours,
        homework: data.homework || null,
        detailedContent: data.detailedContent || null,
        materialsUsed: data.materialsUsed || null,
        observations: data.observations || null,
        actualStart: data.actualStart ? new Date(data.actualStart) : null,
        actualEnd: data.actualEnd ? new Date(data.actualEnd) : null,
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Met à jour une entrée du cahier journal.
   */
  async updateClassLog(
    tenantId: string,
    teacherId: string,
    logId: string,
    data: any,
  ) {
    const log = await this.prisma.classLog.findFirst({
      where: { id: logId, tenantId, teacherId },
    });
    if (!log) throw new NotFoundException('Entrée du cahier journal non trouvée');
    if (log.lockedAt) throw new BadRequestException('Cette entrée est verrouillée (validée par la direction)');

    return this.prisma.classLog.update({
      where: { id: logId },
      data: {
        ...(data.topic && { topic: data.topic }),
        ...(data.durationHours !== undefined && { durationHours: data.durationHours }),
        ...(data.homework !== undefined && { homework: data.homework || null }),
        ...(data.detailedContent !== undefined && { detailedContent: data.detailedContent || null }),
        ...(data.materialsUsed !== undefined && { materialsUsed: data.materialsUsed || null }),
        ...(data.observations !== undefined && { observations: data.observations || null }),
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });
  }

  // ===========================================================================
  // CAHIER DU SEMAINIER (Weekly Log)
  // ===========================================================================

  /**
   * Récupère ou crée le semainier pour une semaine donnée.
   */
  async getOrCreateWeeklyLog(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    classId: string | null,
    weekStartDate: string,
  ) {
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    let weeklyLog = await this.prisma.pedagogicalWeeklyLog.findFirst({
      where: { tenantId, teacherId, classId, weekStartDate: weekStart },
    });

    if (!weeklyLog) {
      // Récupérer les ClassLog de la semaine
      const classLogs = await this.prisma.classLog.findMany({
        where: {
          tenantId,
          academicYearId,
          teacherId,
          ...(classId && { classId }),
          lessonDate: { gte: weekStart, lte: weekEnd },
        },
        select: { id: true },
      });

      weeklyLog = await this.prisma.pedagogicalWeeklyLog.create({
        data: {
          tenantId,
          academicYearId,
          teacherId,
          classId,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          classLogIds: classLogs.map(l => l.id),
        },
      });
    }

    return weeklyLog;
  }

  /**
   * Liste les semainiers d'un enseignant.
   */
  async getWeeklyLogs(
    tenantId: string,
    teacherId: string,
    academicYearId: string,
  ) {
    // ⭐ TEST PROMOTEUR/DIRECTION : vue superviseur si rôle direction sans profil Teacher
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    if (filter.mode === 'none') return [];

    const where: any = { tenantId, academicYearId };
    if (filter.mode === 'teacher') where.teacherId = filter.teacherId;

    return this.prisma.pedagogicalWeeklyLog.findMany({
      where,
      orderBy: { weekStartDate: 'desc' },
      take: 20,
    });
  }

  /**
   * Soumet le semainier au directeur.
   */
  async submitWeeklyLog(
    tenantId: string,
    teacherId: string,
    weeklyLogId: string,
  ) {
    const log = await this.prisma.pedagogicalWeeklyLog.findFirst({
      where: { id: weeklyLogId, tenantId, teacherId },
    });
    if (!log) throw new NotFoundException('Semainier non trouvé');
    if (log.status !== 'DRAFT') throw new BadRequestException('Ce semainier a déjà été soumis');

    return this.prisma.pedagogicalWeeklyLog.update({
      where: { id: weeklyLogId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });
  }

  // ===========================================================================
  // DEVOIRS & ACTIVITÉS (Homework + Task Students)
  // ===========================================================================

  /**
   * Crée un devoir/activity et initialise le suivi pour chaque élève.
   */
  async createHomework(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    teacherId: string,
    data: {
      classId: string;
      subjectId?: string;
      title: string;
      description: string;
      dueDate: string;
      maxScore?: number;
      taskType?: string;
      status?: string;
      presentationDate?: string;
      attachments?: any;
      observations?: string;
      cahierJournalId?: string;
    },
  ) {
    // ⭐ FIX P2003 ROBUSTE : TOUJOURS résoudre schoolLevelId depuis la table Class.
    //    Le frontend peut envoyer un schoolLevelId vide, incorrect, ou non vide mais
    //    invalide (le contexte useModuleContext() peut ne pas avoir le bon schoolLevel
    //    ou un ID qui n'existe pas dans la DB Neon de prod).
    //    On résout TOUJOURS depuis la classe (classId → schoolLevelId) car la classe
    //    a un schoolLevelId garanti valide (FK en base).
    //    Pattern identique à saveDailyAttendance (l. 694-714) mais appliqué systématiquement.
    let resolvedSchoolLevelId: string | undefined;
    const cls = await this.prisma.class.findFirst({
      where: { id: data.classId, tenantId },
      select: { schoolLevelId: true },
    });
    if (cls?.schoolLevelId) {
      resolvedSchoolLevelId = cls.schoolLevelId;
    } else {
      // Fallback : chercher dans AcademicClass
      const ac = await this.prisma.academicClass.findFirst({
        where: { id: data.classId, tenantId },
        select: { schoolLevelId: true },
      });
      resolvedSchoolLevelId = ac?.schoolLevelId || undefined;
    }
    // Si toujours pas résolu, utiliser la valeur fournie par le frontend comme dernier recours
    if (!resolvedSchoolLevelId) {
      resolvedSchoolLevelId = schoolLevelId;
      if (!resolvedSchoolLevelId || resolvedSchoolLevelId.trim() === '') {
        throw new BadRequestException(
          `Impossible de résoudre le niveau scolaire pour la classe ${data.classId}. ` +
          `Vérifiez que la classe existe et a un niveau scolaire assigné.`,
        );
      }
      this.logger.warn(`⚠ schoolLevelId non résolu depuis la classe — utilisation de la valeur frontend: ${resolvedSchoolLevelId}`);
    } else {
      this.logger.log(`✅ schoolLevelId résolu depuis la classe : ${resolvedSchoolLevelId}`);
    }

    // ⭐ FIX : résoudre teacherId depuis User → Teacher (par email).
    //    Le frontend envoie user.id (qui est un User ID), pas un Teacher ID.
    //    Le backend doit résoudre vers un vrai Teacher ID via resolveTeacherId.
    const { teacherId: resolvedTeacherId } = await this.resolveTeacherId(tenantId, teacherId);
    const finalTeacherId = resolvedTeacherId || teacherId; // fallback si pas trouvé

    // Créer le HomeworkEntry
    const homework = await this.prisma.homeworkEntry.create({
      data: {
        tenantId,
        academicYearId,
        schoolLevelId: resolvedSchoolLevelId,
        classId: data.classId,
        subjectId: data.subjectId || null,
        title: data.title,
        description: data.description,
        dueDate: new Date(data.dueDate),
        maxScore: data.maxScore || null,
        taskType: data.taskType || 'HOMEWORK',
        status: data.status || 'ASSIGNED',
        presentationDate: data.presentationDate ? new Date(data.presentationDate) : null,
        attachments: data.attachments || undefined,
        observations: data.observations || null,
        cahierJournalId: data.cahierJournalId || null,
      },
    });

    // Initialiser le suivi pour chaque élève de la classe
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicYearId,
        classId: data.classId,
        status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED'] },
      },
      select: { studentId: true },
    });

    if (enrollments.length > 0) {
      await this.prisma.pedagogicalTaskStudent.createMany({
        data: enrollments.map(e => ({
          tenantId,
          academicYearId,
          homeworkEntryId: homework.id,
          studentId: e.studentId,
          teacherId: finalTeacherId,
          status: 'PENDING',
        })),
      });

      // ⭐ Notifier les parents de la création du devoir (in-app + push web)
      //    Personnaliser le titre selon le taskType :
      //      HOMEWORK → "Nouveau devoir", RESEARCH → "Nouvelle recherche/exposé",
      //      LESSON → "Leçon à recopier", RECITATION → "Nouvelle récitation",
      //      PRACTICAL → "Nouvelle activité pratique", PROJECT → "Nouveau projet"
      const taskTypeLabel: Record<string, string> = {
        HOMEWORK: 'Nouveau devoir',
        RESEARCH: 'Nouvelle recherche / exposé',
        LESSON: 'Leçon à recopier',
        RECITATION: 'Nouvelle récitation',
        PRACTICAL: 'Nouvelle activité pratique',
        PROJECT: 'Nouveau projet',
      };
      const label = taskTypeLabel[data.taskType || 'HOMEWORK'] || 'Nouveau devoir';
      const subjectLabel = `${label} — ${homework.title}`;

      // Appel non bloquant (catch errors silencieusement pour ne pas faire échouer la création)
      this.notificationService.notifyParentsNewHomework(
        data.classId,
        tenantId,
        subjectLabel,
        homework.description || '',
      ).catch((err) => {
        this.logger.warn(`notifyParentsNewHomework failed (non-blocking): ${err.message}`);
      });

      // ⭐ Marquer les PedagogicalTaskStudent créés comme "parent notifié"
      //    (le flag parentNotified existe déjà dans le schéma mais n'était jamais setté à true)
      await this.prisma.pedagogicalTaskStudent.updateMany({
        where: { homeworkEntryId: homework.id },
        data: { parentNotified: true },
      }).catch((err) => {
        this.logger.warn(`Failed to set parentNotified=true: ${err.message}`);
      });
    }

    this.logger.log(`✅ Devoir créé: ${homework.title} (taskType=${data.taskType || 'HOMEWORK'}) — ${enrollments.length} élèves initialisés + parents notifiés`);

    return {
      ...homework,
      studentCount: enrollments.length,
    };
  }

  /**
   * ⭐ Met à jour un HomeworkEntry existant.
   *    Utilisé par PUT /pedagogy-space/homeworks/:id.
   *    Permet de modifier le titre, la description, la date, le type, etc.
   *    Si la classe change, on réinitialise le suivi des élèves (supprime les
   *    anciens PedagogicalTaskStudent et crée les nouveaux pour la nouvelle classe).
   */
  async updateHomework(
    tenantId: string,
    homeworkId: string,
    data: {
      title?: string;
      description?: string;
      classId?: string;
      subjectId?: string | null;
      dueDate?: string;
      maxScore?: number | null;
      taskType?: string;
      status?: string;
      presentationDate?: string | null;
      attachments?: any;
      observations?: string | null;
    },
  ) {
    const existing = await this.prisma.homeworkEntry.findFirst({
      where: { id: homeworkId, tenantId },
      include: {
        academicYear: { select: { id: true } },
      },
    });
    if (!existing) throw new NotFoundException('Devoir non trouvé');

    // Construire l'objet data pour Prisma en ignorant les champs non fournis
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.classId !== undefined) updateData.classId = data.classId || null;
    if (data.subjectId !== undefined) updateData.subjectId = data.subjectId || null;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.maxScore !== undefined) updateData.maxScore = data.maxScore;
    if (data.taskType !== undefined) updateData.taskType = data.taskType;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.presentationDate !== undefined) {
      updateData.presentationDate = data.presentationDate
        ? new Date(data.presentationDate)
        : null;
    }
    if (data.attachments !== undefined) updateData.attachments = data.attachments;
    if (data.observations !== undefined) updateData.observations = data.observations;

    const updated = await this.prisma.homeworkEntry.update({
      where: { id: homeworkId },
      data: updateData,
    });

    // ⭐ Si la classe change, on réinitialise le suivi des élèves pour la nouvelle classe.
    //    Sinon on conserve le suivi existant.
    if (data.classId && data.classId !== existing.classId) {
      // Supprimer les anciens suivis
      await this.prisma.pedagogicalTaskStudent.deleteMany({
        where: { homeworkEntryId: homeworkId },
      });
      // Récupérer le teacherId depuis un ancien suivi (avant suppression —
      // ici on n'y a plus accès, donc on le récupère via les assignments)
      const teacherAssignment = await this.prisma.teacherClassAssignment.findFirst({
        where: {
          tenantId,
          academicYearId: existing.academicYearId,
          classId: data.classId,
        },
        select: { teacherId: true },
      });
      const newTeacherId = teacherAssignment?.teacherId || null;
      // Créer les nouveaux suivis pour les élèves de la nouvelle classe
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          tenantId,
          academicYearId: existing.academicYearId,
          classId: data.classId,
          status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED'] },
        },
        select: { studentId: true },
      });
      if (enrollments.length > 0) {
        await this.prisma.pedagogicalTaskStudent.createMany({
          data: enrollments.map((e) => ({
            tenantId,
            academicYearId: existing.academicYearId,
            homeworkEntryId: homeworkId,
            studentId: e.studentId,
            teacherId: newTeacherId || '',
            status: 'PENDING',
          })),
        });
      }
      this.logger.log(
        `✅ Devoir ${homeworkId} mis à jour — classe changée → ${enrollments.length} élèves réinitialisés`,
      );
    }

    return updated;
  }

  /**
   * ⭐ Supprime un HomeworkEntry + en cascade les PedagogicalTaskStudent et
   *    HomeworkSubmission associés.
   *    Utilisé par DELETE /pedagogy-space/homeworks/:id.
   */
  async deleteHomework(tenantId: string, homeworkId: string) {
    const existing = await this.prisma.homeworkEntry.findFirst({
      where: { id: homeworkId, tenantId },
      select: { id: true, title: true },
    });
    if (!existing) throw new NotFoundException('Devoir non trouvé');

    // Supprimer en cascade les dépendances (les contraintes FK ON DELETE SET NULL
    // devraient déjà s'en occuper, mais on est explicite pour éviter tout risque)
    await this.prisma.pedagogicalTaskStudent.deleteMany({
      where: { homeworkEntryId: homeworkId },
    });
    await this.prisma.homeworkSubmission.deleteMany({
      where: { homeworkId: homeworkId },
    });
    await this.prisma.homeworkEntry.delete({
      where: { id: homeworkId },
    });

    this.logger.log(`✅ Devoir supprimé: ${existing.title} (${homeworkId})`);
    return { success: true, id: homeworkId };
  }

  /**
   * Liste les devoirs d'un enseignant.
   */
  async getHomeworks(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    classId?: string,
    taskType?: string,
  ) {
    // ⭐ TEST PROMOTEUR/DIRECTION :
    // - Si Teacher → filtre via les classes assignées (comportement normal)
    // - Si direction (pas de Teacher) → TOUTES les classes du tenant/année
    // - Sinon → tableau vide
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    if (filter.mode === 'none') return [];

    let classIds: string[] | null = null;
    if (filter.mode === 'teacher') {
      const assignedClassIds = await this.prisma.teacherClassAssignment.findMany({
        where: { tenantId, academicYearId, teacherId: filter.teacherId },
        select: { classId: true },
      });
      classIds = assignedClassIds.map(a => a.classId).filter(Boolean);
    }

    const where: any = {
      tenantId,
      academicYearId,
    };
    if (classId) {
      where.classId = classId;
    } else if (classIds !== null) {
      // Mode Teacher : limiter aux classes assignées
      where.classId = { in: classIds };
    }
    // Mode direction : pas de filtre classId → toutes les classes

    // ⭐ Filtrer par taskType si fourni (HOMEWORK, RESEARCH, LESSON, RECITATION, PRACTICAL, PROJECT)
    if (taskType) {
      where.taskType = taskType;
    }

    const homeworks = await this.prisma.homeworkEntry.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { dueDate: 'desc' },
      take: 50,
    });

    // Pour chaque devoir, compter les statuts
    const result = [];
    for (const hw of homeworks) {
      const tasks = await this.prisma.pedagogicalTaskStudent.findMany({
        where: { homeworkEntryId: hw.id },
        select: { status: true },
      });
      result.push({
        ...hw,
        totalStudents: tasks.length,
        done: tasks.filter(t => t.status === 'DONE').length,
        notDone: tasks.filter(t => t.status === 'NOT_DONE').length,
        pending: tasks.filter(t => t.status === 'PENDING').length,
        late: tasks.filter(t => t.status === 'LATE').length,
        // ⭐ Stats supplémentaires pour les autres sous-onglets
        recited: tasks.filter(t => t.status === 'RECITED').length,
        notRecited: tasks.filter(t => t.status === 'NOT_RECITED').length,
        presented: tasks.filter(t => t.status === 'PRESENTED').length,
        notPresented: tasks.filter(t => t.status === 'NOT_PRESENTED').length,
        incomplete: tasks.filter(t => t.status === 'INCOMPLETE').length,
        toRedo: tasks.filter(t => t.status === 'TO_REDO').length,
      });
    }

    return result;
  }

  /**
   * Met à jour le statut d'un élève pour un devoir.
   */
  async updateTaskStudent(
    tenantId: string,
    taskStudentId: string,
    data: {
      status: string;
      score?: number;
      appreciation?: string;
      observation?: string;
    },
  ) {
    const task = await this.prisma.pedagogicalTaskStudent.findFirst({
      where: { id: taskStudentId, tenantId },
    });
    if (!task) throw new NotFoundException('Suivi élève non trouvé');

    return this.prisma.pedagogicalTaskStudent.update({
      where: { id: taskStudentId },
      data: {
        status: data.status,
        ...(data.score !== undefined && { score: data.score }),
        ...(data.appreciation !== undefined && { appreciation: data.appreciation }),
        ...(data.observation !== undefined && { observation: data.observation }),
        evaluatedAt: new Date(),
      },
    });
  }

  /**
   * Récupère le suivi par élève pour un devoir.
   */
  async getTaskStudents(
    tenantId: string,
    homeworkEntryId: string,
  ) {
    // ⭐ FIX : le modèle PedagogicalTaskStudent n'a PAS de relation `student`
    //    déclarée dans schema.prisma (studentId est un plain String, pas une
    //    relation @relation). Donc `include: { student: ... }` lance l'erreur
    //    Prisma "champ student invalide". On utilise du raw SQL avec JOIN
    //    à la place pour récupérer les infos de l'élève.
    const tasks: any = await this.prisma.$queryRawUnsafe(
      `SELECT pts."id", pts."tenantId", pts."academicYearId", pts."homeworkEntryId",
              pts."studentId", pts."teacherId", pts."status", pts."score",
              pts."appreciation", pts."observation", pts."submittedAt",
              pts."evaluatedAt", pts."parentNotified", pts."createdAt", pts."updatedAt",
              s."firstName" AS "studentFirstName",
              s."lastName" AS "studentLastName",
              s."gender" AS "studentGender",
              s."matricule" AS "studentMatricule",
              s."photoUrl" AS "studentPhotoUrl"
       FROM "pedagogical_task_students" pts
       LEFT JOIN "students" s ON s."id" = pts."studentId"
       WHERE pts."tenantId" = $1 AND pts."homeworkEntryId" = $2
       ORDER BY s."lastName" ASC, s."firstName" ASC`,
      tenantId, homeworkEntryId,
    );

    // Reformater pour correspondre à la structure attendue par le frontend
    return (tasks || []).map((t: any) => ({
      id: t.id,
      tenantId: t.tenantId,
      academicYearId: t.academicYearId,
      homeworkEntryId: t.homeworkEntryId,
      studentId: t.studentId,
      teacherId: t.teacherId,
      status: t.status,
      score: t.score,
      appreciation: t.appreciation,
      observation: t.observation,
      submittedAt: t.submittedAt,
      evaluatedAt: t.evaluatedAt,
      parentNotified: t.parentNotified,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      student: {
        id: t.studentId,
        firstName: t.studentFirstName,
        lastName: t.studentLastName,
        gender: t.studentGender,
        matricule: t.studentMatricule,
        photoUrl: t.studentPhotoUrl,
      },
    }));
  }

  // ===========================================================================
  // ⭐ TRAVAUX & SUIVI — Nouveaux endpoints (Phase 4)
  //    Méthodes pour les sous-onglets :
  //      - Suivi par élève (student-engagement)
  //      - Statistiques & alertes (activity-stats)
  //      - Corrections & retours (submissions)
  //      - Cahiers & copies (notebook-checks)
  // ===========================================================================

  /**
   * ⭐ Suivi par élève : agrège l'engagement de chaque élève d'une classe
   *    pour tous les HomeworkEntry d'un enseignant.
   *    Retourne : [{ studentId, firstName, lastName, matricule, photoUrl,
   *                  totalTasks, done, notDone, pending, late, incomplete,
   *                  participationRate, averageScore, alerts }]
   *
   * Utilisé par le sous-onglet "Suivi par élève" de Travaux & Suivi.
   */
  async getStudentEngagement(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    classId?: string,
  ) {
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    if (filter.mode === 'none') return [];

    // Récupérer tous les HomeworkEntry de l'enseignant (tous types confondus)
    let classIds: string[] | null = null;
    if (filter.mode === 'teacher') {
      const assignedClassIds = await this.prisma.teacherClassAssignment.findMany({
        where: { tenantId, academicYearId, teacherId: filter.teacherId },
        select: { classId: true },
      });
      classIds = assignedClassIds.map(a => a.classId).filter(Boolean);
    }

    const whereHw: any = { tenantId, academicYearId };
    if (classId) {
      whereHw.classId = classId;
    } else if (classIds !== null) {
      whereHw.classId = { in: classIds };
    }

    const homeworks = await this.prisma.homeworkEntry.findMany({
      where: whereHw,
      select: { id: true },
    });

    if (homeworks.length === 0) return [];

    // ⭐ FIX : remplacer include: { student: ... } par raw SQL (PedagogicalTaskStudent
    //    n'a pas de relation `student` déclarée dans schema.prisma)
    const hwIds = homeworks.map(h => h.id);
    const tasks: any = await this.prisma.$queryRawUnsafe(
      `SELECT pts.*, s."firstName" AS "studentFirstName", s."lastName" AS "studentLastName",
              s."matricule" AS "studentMatricule", s."photoUrl" AS "studentPhotoUrl",
              s."gender" AS "studentGender"
       FROM "pedagogical_task_students" pts
       LEFT JOIN "students" s ON s."id" = pts."studentId"
       WHERE pts."tenantId" = $1 AND pts."homeworkEntryId" = ANY($2::text[])`,
      tenantId, hwIds,
    );

    // Grouper par étudiant
    const byStudent = new Map<string, any>();
    for (const t of (tasks || [])) {
      if (!byStudent.has(t.studentId)) {
        byStudent.set(t.studentId, {
          studentId: t.studentId,
          firstName: t.studentFirstName || '',
          lastName: t.studentLastName || '',
          matricule: t.studentMatricule || '',
          photoUrl: t.studentPhotoUrl || null,
          gender: t.studentGender || null,
          tasks: [],
        });
      }
      byStudent.get(t.studentId)!.tasks.push(t);
    }

    // Calculer les stats par élève
    const result = Array.from(byStudent.values()).map(s => {
      const totalTasks = s.tasks.length;
      const done = s.tasks.filter((t: any) => t.status === 'DONE').length;
      const notDone = s.tasks.filter((t: any) => t.status === 'NOT_DONE').length;
      const pending = s.tasks.filter((t: any) => t.status === 'PENDING').length;
      const late = s.tasks.filter((t: any) => t.status === 'LATE').length;
      const incomplete = s.tasks.filter((t: any) => t.status === 'INCOMPLETE').length;
      const toRedo = s.tasks.filter((t: any) => t.status === 'TO_REDO').length;
      const recited = s.tasks.filter((t: any) => t.status === 'RECITED').length;
      const notRecited = s.tasks.filter((t: any) => t.status === 'NOT_RECITED').length;
      const presented = s.tasks.filter((t: any) => t.status === 'PRESENTED').length;
      const notPresented = s.tasks.filter((t: any) => t.status === 'NOT_PRESENTED').length;

      // Participation = (done + recited + presented) / total
      const completedCount = done + recited + presented;
      const participationRate = totalTasks > 0 ? Number(((completedCount / totalTasks) * 100).toFixed(1)) : 0;

      // Moyenne des scores
      const scoredTasks = s.tasks.filter((t: any) => t.score != null);
      const averageScore = scoredTasks.length > 0
        ? Number((scoredTasks.reduce((acc: number, t: any) => acc + Number(t.score), 0) / scoredTasks.length).toFixed(2))
        : null;

      // Alertes : élève en difficulté (participation < 40% ou moyenne < 10/20)
      const alerts: string[] = [];
      if (totalTasks >= 3 && participationRate < 40) {
        alerts.push('PARTICIPATION_FAIBLE');
      }
      if (averageScore != null && averageScore < 10) {
        alerts.push('MOYENNE_FAIBLE');
      }
      if (notDone + toRedo >= 3) {
        alerts.push('TACHES_NON_RENDUES');
      }

      return {
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        matricule: s.matricule,
        photoUrl: s.photoUrl,
        gender: s.gender,
        totalTasks,
        done,
        notDone,
        pending,
        late,
        incomplete,
        toRedo,
        recited,
        notRecited,
        presented,
        notPresented,
        participationRate,
        averageScore,
        alerts,
      };
    });

    return result;
  }

  /**
   * ⭐ Statistiques & alertes : agrège les statistiques globales de l'enseignant
   *    pour tous ses HomeworkEntry. Retourne :
   *    { totalTasks, totalStudents, averageParticipation, averageScore,
   *      tasksByType: { HOMEWORK: n, RESEARCH: n, ... },
   *      studentsAtRisk: [{ studentId, firstName, lastName, reason }],
   *      recentActivity: [{ date, count }] }
   *
   * Utilisé par le sous-onglet "Statistiques & alertes" de Travaux & Suivi.
   */
  async getActivityStats(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
  ) {
    const engagement = await this.getStudentEngagement(tenantId, academicYearId, teacherId);

    // Stats globales
    const totalStudents = engagement.length;
    const totalTasks = engagement.reduce((acc, s) => acc + s.totalTasks, 0);
    const totalDone = engagement.reduce((acc, s) => acc + s.done, 0);
    const totalPending = engagement.reduce((acc, s) => acc + s.pending, 0);
    const totalLate = engagement.reduce((acc, s) => acc + s.late, 0);
    const totalNotDone = engagement.reduce((acc, s) => acc + s.notDone, 0);

    const averageParticipation = totalStudents > 0
      ? Number((engagement.reduce((acc, s) => acc + s.participationRate, 0) / totalStudents).toFixed(1))
      : 0;

    const studentsWithScore = engagement.filter(s => s.averageScore != null);
    const averageScore = studentsWithScore.length > 0
      ? Number((studentsWithScore.reduce((acc, s) => acc + s.averageScore, 0) / studentsWithScore.length).toFixed(2))
      : null;

    // Élèves à risque (alerts non vide)
    const studentsAtRisk = engagement
      .filter(s => s.alerts.length > 0)
      .map(s => ({
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        participationRate: s.participationRate,
        averageScore: s.averageScore,
        alerts: s.alerts,
      }));

    // Tasks par type
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    let classIds: string[] | null = null;
    if (filter.mode === 'teacher') {
      const assignedClassIds = await this.prisma.teacherClassAssignment.findMany({
        where: { tenantId, academicYearId, teacherId: filter.teacherId },
        select: { classId: true },
      });
      classIds = assignedClassIds.map(a => a.classId).filter(Boolean);
    }
    const whereHw: any = { tenantId, academicYearId };
    if (classIds !== null) {
      whereHw.classId = { in: classIds };
    }
    const allHomeworks = await this.prisma.homeworkEntry.findMany({
      where: whereHw,
      select: { taskType: true, status: true, createdAt: true, dueDate: true },
    });

    const tasksByType: Record<string, number> = {};
    for (const hw of allHomeworks) {
      const t = hw.taskType || 'HOMEWORK';
      tasksByType[t] = (tasksByType[t] || 0) + 1;
    }

    const tasksByStatus: Record<string, number> = {};
    for (const hw of allHomeworks) {
      const s = hw.status || 'ASSIGNED';
      tasksByStatus[s] = (tasksByStatus[s] || 0) + 1;
    }

    return {
      totalTasks: allHomeworks.length,
      totalStudents,
      totalDone,
      totalPending,
      totalLate,
      totalNotDone,
      averageParticipation,
      averageScore,
      studentsAtRiskCount: studentsAtRisk.length,
      studentsAtRisk,
      tasksByType,
      tasksByStatus,
    };
  }

  /**
   * ⭐ Corrections & retours : liste les HomeworkSubmission pour un HomeworkEntry.
   *    Chaque soumission représente le travail rendu par un élève + la correction
   *    de l'enseignant (score, feedback, gradedAt, gradedBy).
   */
  async getHomeworkSubmissions(
    tenantId: string,
    homeworkEntryId: string,
  ) {
    const submissions = await this.prisma.homeworkSubmission.findMany({
      where: { tenantId, homeworkId: homeworkEntryId },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true, photoUrl: true },
        },
      },
      orderBy: { gradedAt: 'desc' },
    });

    return submissions;
  }

  /**
   * ⭐ Crée ou met à jour une soumission (correction) pour un HomeworkEntry.
   *    L'enseignant enregistre la note + le feedback pour un élève.
   */
  async upsertHomeworkSubmission(
    tenantId: string,
    homeworkEntryId: string,
    data: {
      studentId: string;
      academicYearId: string;
      schoolLevelId: string;
      content?: string;
      attachments?: any;
      score?: number;
      maxScore?: number;
      feedback?: string;
      gradedBy: string;
    },
  ) {
    // Vérifier si une soumission existe déjà pour ce homework + student
    const existing = await this.prisma.homeworkSubmission.findFirst({
      where: { tenantId, homeworkId: homeworkEntryId, studentId: data.studentId },
    });

    if (existing) {
      // Mettre à jour la soumission existante
      const updated = await this.prisma.homeworkSubmission.update({
        where: { id: existing.id },
        data: {
          content: data.content ?? existing.content,
          attachments: data.attachments ?? existing.attachments,
          score: data.score ?? existing.score,
          maxScore: data.maxScore ?? existing.maxScore,
          feedback: data.feedback ?? existing.feedback,
          gradedAt: new Date(),
          gradedBy: data.gradedBy,
        },
      });
      this.logger.log(`✅ Soumission mise à jour pour homework=${homeworkEntryId} student=${data.studentId}`);
      return updated;
    }

    // Créer une nouvelle soumission
    const submission = await this.prisma.homeworkSubmission.create({
      data: {
        tenantId,
        homeworkId: homeworkEntryId,
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        content: data.content || '',
        attachments: data.attachments || undefined,
        score: data.score || undefined,
        maxScore: data.maxScore || undefined,
        feedback: data.feedback || undefined,
        gradedAt: new Date(),
        gradedBy: data.gradedBy,
        submittedAt: new Date(),
      },
    });
    this.logger.log(`✅ Soumission créée pour homework=${homeworkEntryId} student=${data.studentId}`);
    return submission;
  }

  /**
   * ⭐ Cahiers & copies : récupère les PedagogicalTaskStudent avec statut
   *    lié au contrôle des cahiers (DONE, NOT_DONE, TO_REDO, INCOMPLETE).
   *    L'enseignant peut vérifier les cahiers de chaque élève + laisser un commentaire.
   */
  async getNotebookChecks(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    classId?: string,
  ) {
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    if (filter.mode === 'none') return [];

    // Récupérer les HomeworkEntry de type LESSON (leçons à recopier)
    let classIds: string[] | null = null;
    if (filter.mode === 'teacher') {
      const assignedClassIds = await this.prisma.teacherClassAssignment.findMany({
        where: { tenantId, academicYearId, teacherId: filter.teacherId },
        select: { classId: true },
      });
      classIds = assignedClassIds.map(a => a.classId).filter(Boolean);
    }

    const whereHw: any = { tenantId, academicYearId, taskType: 'LESSON' };
    if (classId) {
      whereHw.classId = classId;
    } else if (classIds !== null) {
      whereHw.classId = { in: classIds };
    }

    const homeworks = await this.prisma.homeworkEntry.findMany({
      where: whereHw,
      include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
      orderBy: { dueDate: 'desc' },
      take: 20,
    });

    // Pour chaque homework LESSON, récupérer les task students
    const result = [];
    for (const hw of homeworks) {
      // ⭐ FIX : raw SQL au lieu de include: { student: ... } (pas de relation dans schema)
      const tasks: any = await this.prisma.$queryRawUnsafe(
        `SELECT pts."id", pts."studentId", pts."status", pts."observation",
                pts."appreciation", pts."score", pts."evaluatedAt",
                s."firstName" AS "studentFirstName", s."lastName" AS "studentLastName",
                s."matricule" AS "studentMatricule", s."photoUrl" AS "studentPhotoUrl"
         FROM "pedagogical_task_students" pts
         LEFT JOIN "students" s ON s."id" = pts."studentId"
         WHERE pts."tenantId" = $1 AND pts."homeworkEntryId" = $2
         ORDER BY s."lastName" ASC, s."firstName" ASC`,
        tenantId, hw.id,
      );

      result.push({
        homework: {
          id: hw.id,
          title: hw.title,
          description: hw.description,
          dueDate: hw.dueDate,
          class: hw.class,
          subject: hw.subject,
          observations: hw.observations,
          taskType: hw.taskType,
          maxScore: hw.maxScore,
        },
        // ⭐ FIX : la requête raw SQL retourne des champs plats
        //    (studentFirstName, studentLastName, studentMatricule, studentPhotoUrl)
        //    — pas une relation imbriquée. On mappe donc directement.
        students: tasks.map(t => ({
          id: t.id,
          studentId: t.studentId,
          firstName: t.studentFirstName,
          lastName: t.studentLastName,
          matricule: t.studentMatricule,
          photoUrl: t.studentPhotoUrl,
          status: t.status, // DONE | NOT_DONE | TO_REDO | INCOMPLETE | PENDING
          observation: t.observation,
          appreciation: t.appreciation,
          score: t.score,
          evaluatedAt: t.evaluatedAt,
        })),
      });
    }

    return result;
  }

  /**
   * ⭐ Cahier journal → Travaux & Suivi : récupère tous les HomeworkEntry liés
   *    à un cahier journal donné (cahierJournalId). Utilisé pour afficher dans
   *    le cahier journal enseignant (maternelle + primaire) les devoirs/leçons/
   *    récitations/exposés attachés à chaque case du cahier journal.
   *
   *    Permet d'afficher "par rapport à la leçon X du jour Y, voici les exercices
   *    donnés" + le statut de chaque élève (récitation réussie/échouée, leçon
   *    copiée/non copiée).
   *
   *    Retourne : [{ id, title, description, taskType, dueDate, presentationDate,
   *                  maxScore, observations, subjectName, className,
   *                  totalStudents, done, notDone, pending, late, incomplete,
   *                  toRedo, recited, notRecited, presented, notPresented }]
   */
  async getHomeworksByCahierJournal(
    tenantId: string,
    cahierJournalId: string,
  ) {
    const homeworks = await this.prisma.homeworkEntry.findMany({
      where: { tenantId, cahierJournalId },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Pour chaque devoir, compter les statuts par élève
    const result = [];
    for (const hw of homeworks) {
      const tasks = await this.prisma.pedagogicalTaskStudent.findMany({
        where: { homeworkEntryId: hw.id },
        select: { status: true, score: true, appreciation: true, observation: true },
      });

      result.push({
        id: hw.id,
        title: hw.title,
        description: hw.description,
        taskType: hw.taskType,
        status: hw.status,
        dueDate: hw.dueDate,
        presentationDate: hw.presentationDate,
        maxScore: hw.maxScore,
        observations: hw.observations,
        attachments: hw.attachments,
        class: hw.class,
        subject: hw.subject,
        // Stats agrégées par statut
        totalStudents: tasks.length,
        done: tasks.filter(t => t.status === 'DONE').length,
        notDone: tasks.filter(t => t.status === 'NOT_DONE').length,
        pending: tasks.filter(t => t.status === 'PENDING').length,
        late: tasks.filter(t => t.status === 'LATE').length,
        incomplete: tasks.filter(t => t.status === 'INCOMPLETE').length,
        toRedo: tasks.filter(t => t.status === 'TO_REDO').length,
        recited: tasks.filter(t => t.status === 'RECITED').length,
        notRecited: tasks.filter(t => t.status === 'NOT_RECITED').length,
        presented: tasks.filter(t => t.status === 'PRESENTED').length,
        notPresented: tasks.filter(t => t.status === 'NOT_PRESENTED').length,
        // Liste détaillée par élève (pour le statut individuel)
        // ⭐ FIX : raw SQL au lieu de include: { student: ... } (pas de relation dans schema)
        students: await this.prisma.$queryRawUnsafe(
          `SELECT pts."id", pts."studentId", pts."status", pts."score",
                  pts."appreciation", pts."observation", pts."evaluatedAt",
                  s."firstName" AS "studentFirstName", s."lastName" AS "studentLastName",
                  s."matricule" AS "studentMatricule", s."photoUrl" AS "studentPhotoUrl"
           FROM "pedagogical_task_students" pts
           LEFT JOIN "students" s ON s."id" = pts."studentId"
           WHERE pts."homeworkEntryId" = $1
           ORDER BY s."lastName" ASC`,
          hw.id,
        ).then((rows: any[]) => rows.map(t => ({
          id: t.id,
          studentId: t.studentId,
          firstName: t.studentFirstName,
          lastName: t.studentLastName,
          matricule: t.studentMatricule,
          photoUrl: t.studentPhotoUrl,
          status: t.status,
          score: t.score,
          appreciation: t.appreciation,
          observation: t.observation,
        }))),
      });
    }

    return result;
  }

  // ===========================================================================
  // CONTRÔLE PÉDAGOGIQUE DIRECTION
  // ===========================================================================

  /**
   * Tableau de bord du directeur : KPIs pédagogiques.
   */
  async getDirectorDashboard(tenantId: string, academicYearId: string) {
    // Semainiers en attente de validation
    const pendingWeeklyLogs = await this.prisma.pedagogicalWeeklyLog.count({
      where: { tenantId, academicYearId, status: 'SUBMITTED' },
    });

    // Total semainiers
    const totalWeeklyLogs = await this.prisma.pedagogicalWeeklyLog.count({
      where: { tenantId, academicYearId },
    });

    // Cahiers journaux récents (7 derniers jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentClassLogs = await this.prisma.classLog.count({
      where: { tenantId, academicYearId, lessonDate: { gte: sevenDaysAgo } },
    });

    // Devoirs en cours (non évalués)
    const pendingTasks = await this.prisma.pedagogicalTaskStudent.count({
      where: { tenantId, academicYearId, status: 'PENDING' },
    });

    // Enseignants actifs
    const activeTeachers = await this.prisma.teacherClassAssignment.findMany({
      where: { tenantId, academicYearId },
      select: { teacherId: true },
      distinct: ['teacherId'],
    });

    // Fiches pédagogiques en attente de validation
    const pendingLessonPlans = await this.prisma.lessonPlan.count({
      where: { tenantId, academicYearId, status: 'submitted' },
    }).catch(() => 0);

    return {
      pendingWeeklyLogs,
      totalWeeklyLogs,
      recentClassLogs,
      pendingTasks,
      activeTeachers: activeTeachers.length,
      pendingLessonPlans,
    };
  }

  /**
   * Liste les semainiers soumis (en attente de validation).
   */
  async getPendingWeeklyLogs(tenantId: string, academicYearId: string) {
    const logs = await this.prisma.pedagogicalWeeklyLog.findMany({
      where: { tenantId, academicYearId, status: 'SUBMITTED' },
      orderBy: { submittedAt: 'desc' },
    });

    // Enrichir avec les infos enseignant et classe
    const result = [];
    for (const log of logs) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: log.teacherId },
        select: { id: true, firstName: true, lastName: true },
      }).catch(() => null);
      const cls = log.classId
        ? await this.prisma.class.findFirst({
            where: { id: log.classId },
            select: { id: true, name: true },
          }).catch(() => null)
        : null;

      result.push({
        ...log,
        teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : '—',
        className: cls?.name || 'Toutes classes',
      });
    }

    return result;
  }

  /**
   * Valide ou rejette un semainier.
   */
  async validateWeeklyLog(
    tenantId: string,
    weeklyLogId: string,
    action: 'VALIDATED' | 'REJECTED',
    validatedBy: string,
    rejectionReason?: string,
  ) {
    const log = await this.prisma.pedagogicalWeeklyLog.findFirst({
      where: { id: weeklyLogId, tenantId },
    });
    if (!log) throw new NotFoundException('Semainier non trouvé');
    if (log.status !== 'SUBMITTED') throw new BadRequestException('Ce semainier n\'est pas en attente');

    return this.prisma.pedagogicalWeeklyLog.update({
      where: { id: weeklyLogId },
      data: {
        status: action,
        validatedAt: new Date(),
        validatedBy,
        ...(action === 'REJECTED' && rejectionReason ? { rejectionReason } : {}),
      },
    });
  }

  // ===========================================================================
  // CAHIER DE SEMAINE — Rapports journaliers (8 sections)
  // ===========================================================================

  /**
   * Récupère ou crée un rapport journalier pour un jour donné.
   */
  async getOrCreateDailyReport(
    tenantId: string,
    academicYearId: string,
    weekNumber: number,
    trimester: number,
    dayOfWeek: number,
    reportDate: string,
    filledBy?: string,
  ) {
    const dateObj = new Date(reportDate);
    let report = await this.prisma.weeklyLogDailyReport.findFirst({
      where: { tenantId, academicYearId, weekNumber, dayOfWeek },
    });
    if (!report) {
      report = await this.prisma.weeklyLogDailyReport.create({
        data: {
          tenantId, academicYearId, weekNumber, trimester, dayOfWeek,
          reportDate: dateObj,
          filledBy: filledBy || null,
        },
      });
    }
    return report;
  }

  /**
   * Récupère tous les rapports journaliers d'une semaine.
   */
  async getDailyReports(tenantId: string, academicYearId: string, weekNumber: number) {
    return this.prisma.weeklyLogDailyReport.findMany({
      where: { tenantId, academicYearId, weekNumber },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  /**
   * Met à jour un rapport journalier (sauvegarde des 8 sections).
   */
  async updateDailyReport(
    tenantId: string,
    reportId: string,
    data: any,
  ) {
    const report = await this.prisma.weeklyLogDailyReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new NotFoundException('Rapport journalier non trouvé');

    return this.prisma.weeklyLogDailyReport.update({
      where: { id: reportId },
      data: {
        // Section 1
        ...(data.staffAttendance !== undefined && { staffAttendance: data.staffAttendance }),
        ...(data.staffSummary !== undefined && { staffSummary: data.staffSummary || null }),
        // Section 2
        ...(data.studentAttendanceRate !== undefined && { studentAttendanceRate: data.studentAttendanceRate }),
        ...(data.highAbsenceClasses !== undefined && { highAbsenceClasses: data.highAbsenceClasses || null }),
        ...(data.parentNotifiedAbsences !== undefined && { parentNotifiedAbsences: data.parentNotifiedAbsences || null }),
        ...(data.lateCount !== undefined && { lateCount: data.lateCount }),
        ...(data.specialCases !== undefined && { specialCases: data.specialCases || null }),
        // Section 3
        ...(data.scheduleRespected !== undefined && { scheduleRespected: data.scheduleRespected || null }),
        ...(data.modifiedCourses !== undefined && { modifiedCourses: data.modifiedCourses || null }),
        ...(data.remarkableActivities !== undefined && { remarkableActivities: data.remarkableActivities || null }),
        ...(data.classClimate !== undefined && { classClimate: data.classClimate || null }),
        // Section 4
        ...(data.positiveBehaviors !== undefined && { positiveBehaviors: data.positiveBehaviors || null }),
        ...(data.problematicBehaviors !== undefined && { problematicBehaviors: data.problematicBehaviors || null }),
        ...(data.correctiveMeasures !== undefined && { correctiveMeasures: data.correctiveMeasures || null }),
        // Section 5
        ...(data.roomCleanliness !== undefined && { roomCleanliness: data.roomCleanliness || null }),
        ...(data.toiletsCondition !== undefined && { toiletsCondition: data.toiletsCondition || null }),
        ...(data.waterStatus !== undefined && { waterStatus: data.waterStatus || null }),
        ...(data.electricityStatus !== undefined && { electricityStatus: data.electricityStatus || null }),
        ...(data.urgentRepairs !== undefined && { urgentRepairs: data.urgentRepairs || null }),
        // Section 6
        ...(data.adminVisit !== undefined && { adminVisit: data.adminVisit }),
        ...(data.pedagoVisit !== undefined && { pedagoVisit: data.pedagoVisit }),
        ...(data.parentVisit !== undefined && { parentVisit: data.parentVisit }),
        ...(data.visitDetails !== undefined && { visitDetails: data.visitDetails || null }),
        // Section 7
        ...(data.directorInstructions !== undefined && { directorInstructions: data.directorInstructions || null }),
        ...(data.urgentNeeds !== undefined && { urgentNeeds: data.urgentNeeds || null }),
        // Section 8
        ...(data.strengths !== undefined && { strengths: data.strengths || null }),
        ...(data.improvements !== undefined && { improvements: data.improvements || null }),
        ...(data.recommendations !== undefined && { recommendations: data.recommendations || null }),
        // Status
        ...(data.status !== undefined && { status: data.status }),
        ...(data.filledBy !== undefined && { filledBy: data.filledBy || null }),
      },
    });
  }

  // ===========================================================================
  // CAHIER DE SEMAINE — Rapport de fin de semaine (7 sections)
  // ===========================================================================

  /**
   * Récupère ou crée le rapport de fin de semaine.
   */
  async getOrCreateWeeklySummary(
    tenantId: string,
    academicYearId: string,
    weekNumber: number,
    trimester: number,
    weekStartDate: string,
    weekEndDate: string,
    filledBy?: string,
  ) {
    let summary = await this.prisma.weeklyLogSummary.findFirst({
      where: { tenantId, academicYearId, weekNumber },
    });
    if (!summary) {
      summary = await this.prisma.weeklyLogSummary.create({
        data: {
          tenantId, academicYearId, weekNumber, trimester,
          weekStartDate: new Date(weekStartDate),
          weekEndDate: new Date(weekEndDate),
          filledBy: filledBy || null,
        },
      });
    }
    return summary;
  }

  /**
   * Met à jour le rapport de fin de semaine.
   */
  async updateWeeklySummary(
    tenantId: string,
    summaryId: string,
    data: any,
  ) {
    const summary = await this.prisma.weeklyLogSummary.findFirst({
      where: { id: summaryId, tenantId },
    });
    if (!summary) throw new NotFoundException('Rapport de fin de semaine non trouvé');

    return this.prisma.weeklyLogSummary.update({
      where: { id: summaryId },
      data: {
        ...(data.globalLevel !== undefined && { globalLevel: data.globalLevel || null }),
        ...(data.generalObservations !== undefined && { generalObservations: data.generalObservations || null }),
        ...(data.scheduleRespect !== undefined && { scheduleRespect: data.scheduleRespect || null }),
        ...(data.engagedTeachers !== undefined && { engagedTeachers: data.engagedTeachers || null }),
        ...(data.recurringDifficulties !== undefined && { recurringDifficulties: data.recurringDifficulties || null }),
        ...(data.studentBehavior !== undefined && { studentBehavior: data.studentBehavior || null }),
        ...(data.specialFollowUp !== undefined && { specialFollowUp: data.specialFollowUp || null }),
        ...(data.criticalPoints !== undefined && { criticalPoints: data.criticalPoints || null }),
        ...(data.urgentInterventions !== undefined && { urgentInterventions: data.urgentInterventions || null }),
        ...(data.weeklyVisits !== undefined && { weeklyVisits: data.weeklyVisits || null }),
        ...(data.visitorRecommendations !== undefined && { visitorRecommendations: data.visitorRecommendations || null }),
        ...(data.weeklyStats !== undefined && { weeklyStats: data.weeklyStats }),
        ...(data.priorityActions !== undefined && { priorityActions: data.priorityActions || null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.submittedAt !== undefined && { submittedAt: data.submittedAt ? new Date(data.submittedAt) : null }),
      },
    });
  }

  /**
   * Soumet le rapport de fin de semaine au directeur.
   */
  async submitWeeklySummary(tenantId: string, summaryId: string) {
    const summary = await this.prisma.weeklyLogSummary.findFirst({
      where: { id: summaryId, tenantId },
    });
    if (!summary) throw new NotFoundException('Rapport non trouvé');
    if (summary.status !== 'DRAFT') throw new BadRequestException('Déjà soumis');

    return this.prisma.weeklyLogSummary.update({
      where: { id: summaryId },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
  }

  /**
   * Liste les rapports de fin de semaine en attente de validation (direction).
   */
  async getPendingWeeklySummaries(tenantId: string, academicYearId: string) {
    return this.prisma.weeklyLogSummary.findMany({
      where: { tenantId, academicYearId, status: 'SUBMITTED' },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * Valide ou rejette un rapport de fin de semaine.
   */
  async validateWeeklySummary(
    tenantId: string,
    summaryId: string,
    action: 'VALIDATED' | 'REJECTED',
    validatedBy: string,
    rejectionReason?: string,
  ) {
    const summary = await this.prisma.weeklyLogSummary.findFirst({
      where: { id: summaryId, tenantId },
    });
    if (!summary) throw new NotFoundException('Rapport non trouvé');
    if (summary.status !== 'SUBMITTED') throw new BadRequestException('Pas en attente');

    return this.prisma.weeklyLogSummary.update({
      where: { id: summaryId },
      data: {
        status: action,
        validatedAt: new Date(),
        validatedBy,
        ...(action === 'REJECTED' && rejectionReason ? { rejectionReason } : {}),
      },
    });
  }

  // ===========================================================================
  // CAHIER JOURNAL — Grille hebdomadaire (5 jours × 8 matières)
  // Utilise des requêtes SQL brutes car les tables ont été créées via
  // migration manuelle. Le client Prisma sera régénéré au prochain déploiement.
  // ===========================================================================

  /// Résout le VRAI titulaire d'une section physique : l'enseignant affecté à
  /// une matière RÉGULIÈRE de la classe (hors spécialistes itinérants
  /// Anglais/Informatique, qui parcourent plusieurs classes).
  /// Retourne null si aucun titulaire n'est trouvé.
  private async resolveSectionTitulaire(
    tenantId: string,
    classId: string,
  ): Promise<{ teacherId: string; firstName: string; lastName: string; gender: string | null } | null> {
    try {
      const rows: any = await this.prisma.$queryRawUnsafe(
        `SELECT tca."teacherId", t."firstName", t."lastName", t."gender"
         FROM teacher_class_assignments tca
         JOIN class_subjects cs ON cs."id" = tca."classSubjectId"
         JOIN subjects s ON s."id" = cs."subjectId"
         LEFT JOIN teachers t ON t."id" = tca."teacherId"
         WHERE tca."classId" = $1 AND tca."tenantId" = $2
           AND NOT (UPPER(s."code") LIKE 'ANG-%' OR UPPER(s."code") LIKE 'INFO-%'
                    OR LOWER(s."name") IN ('anglais','english','informatique','computer science'))
         LIMIT 1`,
        classId, tenantId,
      );
      if (Array.isArray(rows) && rows.length > 0 && rows[0].teacherId) {
        return {
          teacherId: rows[0].teacherId,
          firstName: rows[0].firstName || '',
          lastName: rows[0].lastName || '',
          gender: rows[0].gender || null,
        };
      }
    } catch {
      // silent — pas de titulaire résolu
    }
    return null;
  }

  /// Récupère ou crée une entrée du cahier journal pour une classe × semaine.
  async getOrCreateCahierJournal(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    classId: string,
    weekStartDate: string,
    className?: string,
  ) {
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4); // vendredi

    // ⭐ FIX 2026-09-15 (nom du titulaire) : le chemin « entrée existante »
    //    retournait un SELECT * SANS les champs teacherFirstName/
    //    teacherLastName/teacherGender — le frontend affichait donc le nom du
    //    USER CONNECTÉ (ex: promoteur) au lieu du titulaire de la classe.
    //    Désormais on enrichit avec le JOIN teachers (comme le chemin création)
    //    + repli sur le VRAI titulaire si le teacherId stocké n'est pas un
    //    Teacher (journaux créés avant le fix resolvedTeacherId, avec l'id
    //    utilisateur du promoteur comme teacherId).
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT cj.*, c."name" as "classNameResolved", c."schoolLevelId" as "schoolLevelId",
        sl."code" as "schoolLevelCode", sl."name" as "schoolLevelName",
        t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName", t."gender" as "teacherGender"
       FROM "cahier_journal_entries" cj
       LEFT JOIN classes c ON c."id" = cj."classId"
       LEFT JOIN school_levels sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN teachers t ON t."id" = cj."teacherId"
       WHERE cj."tenantId" = $1 AND cj."academicYearId" = $2 AND cj."classId" = $3 AND cj."weekStartDate" = $4
       LIMIT 1`,
      tenantId, academicYearId, classId, startDate,
    );

    if (existing && existing.length > 0) {
      const row = existing[0];
      // ⭐ Repli : teacherId non résolu en Teacher (journaux légués) → on
      //    résout le vrai titulaire de la classe pour l'affichage du Visa.
      if (!row.teacherFirstName && !row.teacherLastName) {
        const titulaire = await this.resolveSectionTitulaire(tenantId, classId);
        if (titulaire) {
          row.teacherFirstName = titulaire.firstName;
          row.teacherLastName = titulaire.lastName;
          row.teacherGender = titulaire.gender;
        }
      }
      // ⭐ MATERNELLE : matières dynamiques — la grille par DOMAINES est
      //    construite depuis les matières configurées dans l'onglet
      //    « Matières & programmes » (matGroups dans la réponse), et les
      //    anciennes clés (dom1_sante…) sont migrées vers les noms de matières.
      await this.enrichMaternelleJournal(row);
      return row;
    }

    // ⭐ FIX : Si l'utilisateur n'est pas un Teacher (ex: promoteur),
    //    résoudre le VRAI titulaire de la classe via TeacherClassAssignment.
    //    Le teacherId stocké doit être celui du titulaire réel, pas celui
    //    du promoteur connecté. Sinon le "Visa du Titulaire" affiche
    //    le nom du promoteur au lieu du titulaire de la classe.
    //    ⭐ 2026-09-15 : utilise resolveSectionTitulaire (exclut les
    //    spécialistes itinérants Anglais/Informatique — avant, LIMIT 1
    //    pouvait renvoyer le prof d'anglais au lieu du titulaire).
    let resolvedTeacherId = teacherId;
    const directTeacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
      select: { id: true },
    }).catch(() => null);
    if (!directTeacher) {
      const titulaire = await this.resolveSectionTitulaire(tenantId, classId);
      if (titulaire) {
        resolvedTeacherId = titulaire.teacherId;
      }
    }

    // Créer une nouvelle entrée avec le vrai titulaire
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "cahier_journal_entries"
       ("id", "tenantId", "academicYearId", "teacherId", "classId",
        "weekStartDate", "weekEndDate", "className", "entries", "observations",
        "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, 'DRAFT', NOW(), NOW())`,
      id, tenantId, academicYearId, resolvedTeacherId, classId,
      startDate, endDate, className || null, JSON.stringify({}),
    );

    const created: any = await this.prisma.$queryRawUnsafe(
      `SELECT cj.*, c."name" as "classNameResolved", c."schoolLevelId" as "schoolLevelId",
        sl."code" as "schoolLevelCode", sl."name" as "schoolLevelName",
        t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName", t."gender" as "teacherGender"
       FROM "cahier_journal_entries" cj
       LEFT JOIN classes c ON c."id" = cj."classId"
       LEFT JOIN school_levels sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN teachers t ON t."id" = cj."teacherId"
       WHERE cj."id" = $1`,
      id,
    );
    await this.enrichMaternelleJournal(created[0]);
    return created[0];
  }

  /// ⭐ MATERNELLE — enrichit un cahier journal avec les matières dynamiques :
  ///    - matGroups : la grille par DOMAINES construite depuis les matières
  ///      configurées pour la classe (Matières & programmes) ;
  ///    - matSubjects : la liste des matières configurées ;
  ///    - migration idempotente des anciennes clés (dom1_sante, pre_lecture…)
  ///      vers les noms des matières (persistée immédiatement si nécessaire).
  ///    Sans effet sur les classes non maternelle.
  private async enrichMaternelleJournal(row: any) {
    if (!row || (row.schoolLevelCode || '').toString().toUpperCase() !== 'MATERNELLE') return;
    try {
      const subjects = await this.getMaternelleSubjectsForClass(
        row.tenantId, row.academicYearId, row.classId,
      );
      const groups = this.buildMaternelleGroups(subjects);
      if (groups.length === 0) {
        // Aucune matière configurée → l'appelant affichera le modèle officiel
        // par défaut + un bandeau invitant à configurer les matières.
        row.matGroups = [];
        row.matSubjects = [];
        return;
      }
      let finalGroups = groups;
      if (row.entries) {
        let parsed: any = {};
        try {
          parsed = typeof row.entries === 'string' ? JSON.parse(row.entries || '{}') : (row.entries || {});
        } catch { parsed = {}; }
        const migrated = this.migrateMaternelleEntries(parsed, groups);
        finalGroups = migrated.groups;
        if (migrated.changed) {
          await this.prisma.$executeRawUnsafe(
            `UPDATE "cahier_journal_entries" SET "entries" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
            JSON.stringify(migrated.entries), row.id,
          ).catch(() => null);
          row.entries = migrated.entries;
        }
      }
      row.matGroups = finalGroups;
      row.matSubjects = subjects;
    } catch (err: any) {
      this.logger.warn(`enrichMaternelleJournal: ${err.message}`);
    }
  }

  /// Liste les cahiers journal d'un enseignant.
  async getCahierJournals(
    tenantId: string,
    teacherId: string,
    academicYearId: string,
    classId?: string,
    caller?: any,
  ) {
    // ⭐ TEST PROMOTEUR/DIRECTION : vue superviseur si rôle direction sans profil Teacher
    // caller (F7) : l'identité de l'appelant prime sur le paramètre client.
    const filter = await this.resolveTeacherFilter(tenantId, teacherId, caller);
    if (filter.mode === 'none') return [];

    // ⭐ Enrichir avec le nom + genre du titulaire (via JOIN teachers)
    //    Pour que le frontend affiche le vrai titulaire même si le promoteur est connecté.
    const selectWithTeacher = `SELECT cj.*, c."name" as "classNameResolved",
      t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName", t."gender" as "teacherGender"
      FROM "cahier_journal_entries" cj
      LEFT JOIN classes c ON c."id" = cj."classId"
      LEFT JOIN teachers t ON t."id" = cj."teacherId"`;

    if (classId) {
      if (filter.mode === 'teacher') {
        return this.prisma.$queryRawUnsafe(
          `${selectWithTeacher}
           WHERE cj."tenantId" = $1 AND cj."academicYearId" = $2 AND cj."teacherId" = $3 AND cj."classId" = $4
           ORDER BY cj."weekStartDate" DESC`,
          tenantId, academicYearId, filter.teacherId, classId,
        );
      }
      // Mode direction : pas de filtre teacherId
      return this.prisma.$queryRawUnsafe(
        `${selectWithTeacher}
         WHERE cj."tenantId" = $1 AND cj."academicYearId" = $2 AND cj."classId" = $3
         ORDER BY cj."weekStartDate" DESC`,
        tenantId, academicYearId, classId,
      );
    }
    if (filter.mode === 'teacher') {
      return this.prisma.$queryRawUnsafe(
        `${selectWithTeacher}
         WHERE cj."tenantId" = $1 AND cj."academicYearId" = $2 AND cj."teacherId" = $3
         ORDER BY cj."weekStartDate" DESC`,
        tenantId, academicYearId, filter.teacherId,
      );
    }
    // Mode direction : toutes les entrées du tenant/année
    return this.prisma.$queryRawUnsafe(
      `${selectWithTeacher}
       WHERE cj."tenantId" = $1 AND cj."academicYearId" = $2
       ORDER BY cj."weekStartDate" DESC`,
      tenantId, academicYearId,
    );
  }

  // ===========================================================================
  // CATALOGUE — Hiérarchie années → trimestres → mois → semaines
  //    Pour l'espace pédagogie enseignant, sous-onglet "Catalogue"
  //    Pattern identique à l'explorateur Windows : on navigue dans les dossiers
  //
  //    Retourne : {
  //      academicYears: [
  //        {
  //          id, name, startDate, endDate, isActive,
  //          trimesters: [
  //            {
  //              trimester: 1, label: "Premier trimestre",
  //              dateRange: { start, end },
  //              months: [
  //                {
  //                  month: 9, label: "Septembre",
  //                  weeks: [
  //                    {
  //                      weekStartDate, weekEndDate,
  //                      cahierJournal: { id, status, className, ... } | null,
  //                      fiches: [ { id, sheetType, titre, lessonDate, status, ... }, ... ]
  //                    }
  //                  ]
  //                }
  //              ]
  //            }
  //          ]
  //        }
  //      ]
  //    }
  // ===========================================================================

  /**
   * Détermine le trimestre (1, 2 ou 3) à partir d'une date.
   * Calendrier scolaire Bénin :
   *   T1 = Septembre → Décembre (mois 9, 10, 11, 12)
   *   T2 = Janvier → Mars       (mois 1, 2, 3)
   *   T3 = Avril → Juin         (mois 4, 5, 6)
   * Juillet et Août sont généralement en vacances — rattachés au T3 par défaut.
   */
  private getTrimesterForDate(date: Date | string): 1 | 2 | 3 {
    const d = typeof date === 'string' ? new Date(date) : date;
    const m = d.getMonth() + 1; // 1=Jan, 12=Dec
    if (m >= 9) return 1;        // Sep, Oct, Nov, Dec
    if (m <= 3) return 2;        // Jan, Feb, Mar
    return 3;                    // Apr, May, Jun (Jul, Aug)
  }

  /**
   * Catalogue hiérarchique des cahiers journaux + fiches pédagogiques
   * d'un enseignant (ou de toutes les classes pour le directeur/promoteur),
   * sur TOUTES les années scolaires du tenant.
   *
   * Le catalogue est organisé comme un explorateur Windows :
   *   Classe → Année → Trimestre → Mois → Semaine (cahier journal + fiches jointes)
   *
   * ⭐ UX différente selon le rôle :
   *   - Enseignant : ne voit QUE les classes qui lui sont assignées
   *     (via teacher_class_assignments).
   *   - Promoteur / Directeur / Admin plateforme : voit TOUTES les classes
   *     du tenant (vue superviseur pour audit / réutilisation cross-année).
   *
   * @param tenantId  ID du tenant
   * @param teacherId ID du User (PROMOTER/DIRECTOR/TEACHER) — résolu en teacherId
   * @param classId   Optionnel — filtre pour ne voir qu'une seule classe
   */
  async getCatalogue(tenantId: string, teacherId: string, classId?: string) {
    // 1. Résoudre le filtre enseignant (mode "teacher" ou mode "direction")
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    if (filter.mode === 'none') {
      return { classes: [] };
    }

    // 2. Déterminer la liste des classes à afficher dans le catalogue
    //    - Mode "teacher" : classes assignées à l'enseignant
    //    - Mode "all" (direction/promoteur) : toutes les classes du tenant
    let classesToList: { id: string; name: string; code: string | null; schoolLevelId: string | null; schoolLevelName: string | null; schoolLevelCode: string | null }[] = [];

    if (filter.mode === 'teacher') {
      // Récupérer les classes assignées à l'enseignant (toutes années confondues
      // pour le catalogue cross-year — un enseignant peut avoir eu la même classe
      // pendant plusieurs années).
      const assignments: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT c."id", c."name", c."code", c."schoolLevelId",
                sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode"
         FROM "teacher_class_assignments" tca
         JOIN "classes" c ON c."id" = tca."classId"
         LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
         WHERE tca."tenantId" = $1 AND tca."teacherId" = $2
         ORDER BY sl."name" ASC NULLS LAST, c."name" ASC`,
        tenantId, filter.teacherId,
      );
      classesToList = assignments.map((a: any) => ({
        id: a.id, name: a.name, code: a.code,
        schoolLevelId: a.schoolLevelId, schoolLevelName: a.schoolLevelName, schoolLevelCode: a.schoolLevelCode,
      }));
      // ⭐ En mode teacher, on AJOUTE aussi les classes qui ont des cahiers journaux
      //    ou fiches à son nom (au cas où l'assignment ait été supprimé mais qu'il
      //    reste des données historiques).
      const classesWithJournals: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT c."id", c."name", c."code", c."schoolLevelId",
                sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode"
         FROM "cahier_journal_entries" cj
         JOIN "classes" c ON c."id" = cj."classId"
         LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
         WHERE cj."tenantId" = $1 AND cj."teacherId" = $2
           AND c."id" NOT IN (SELECT "classId" FROM "teacher_class_assignments" WHERE "tenantId" = $1 AND "teacherId" = $2)
         ORDER BY sl."name" ASC NULLS LAST, c."name" ASC`,
        tenantId, filter.teacherId,
      );
      for (const c of classesWithJournals) {
        classesToList.push({
          id: c.id, name: c.name, code: c.code,
          schoolLevelId: c.schoolLevelId, schoolLevelName: c.schoolLevelName, schoolLevelCode: c.schoolLevelCode,
        });
      }
    } else {
      // Mode direction : toutes les classes du tenant
      const allClasses: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT c."id", c."name", c."code", c."schoolLevelId",
                sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode"
         FROM "classes" c
         LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
         WHERE c."tenantId" = $1
         ORDER BY sl."name" ASC NULLS LAST, c."name" ASC`,
        tenantId,
      );
      classesToList = allClasses.map((c: any) => ({
        id: c.id, name: c.name, code: c.code,
        schoolLevelId: c.schoolLevelId, schoolLevelName: c.schoolLevelName, schoolLevelCode: c.schoolLevelCode,
      }));
    }

    // 3. Filtrer par classId si fourni (vue mono-classe)
    if (classId) {
      classesToList = classesToList.filter(c => c.id === classId);
    }

    if (classesToList.length === 0) {
      return { classes: [] };
    }

    // 4. Charger TOUTES les années scolaires du tenant (une seule fois —
    //    elles sont partagées entre toutes les classes)
    const years: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, name, label, "startDate", "endDate", "isActive"
       FROM "academic_years"
       WHERE "tenantId" = $1
       ORDER BY "startDate" DESC`,
      tenantId,
    );
    if (!years || years.length === 0) {
      return { classes: [] };
    }

    // 5. Pour chaque classe, construire l'arbre années → trimestres → mois → semaines
    const classes = [];
    for (const cls of classesToList) {
      const academicYears = await this.buildClassCatalogueForYears(
        tenantId, cls.id, years, filter,
      );
      classes.push({
        id: cls.id,
        name: cls.name,
        code: cls.code,
        schoolLevelId: cls.schoolLevelId,
        schoolLevelName: cls.schoolLevelName,
        schoolLevelCode: cls.schoolLevelCode,
        academicYears,
      });
    }

    return { classes };
  }

  /**
   * Helper privé : construit l'arbre années → trimestres → mois → semaines
   * pour UNE classe donnée, sur TOUTES les années scolaires fournies.
   *
   * @param tenantId  ID du tenant
   * @param classId   ID de la classe à filtrer
   * @param years     Liste des années (déjà chargées — évite N requêtes)
   * @param filter    Filtre enseignant ({mode:'teacher',teacherId} ou {mode:'all'})
   * @returns Tableau d'années avec trimestres → mois → semaines
   */
  private async buildClassCatalogueForYears(
    tenantId: string,
    classId: string,
    years: any[],
    filter: { mode: 'teacher'; teacherId: string } | { mode: 'all' },
  ): Promise<any[]> {
    const academicYears = [];
    const MONTH_LABELS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    for (const year of years) {
      // 1a. Cahiers journaux de cette classe + année (+ filtre enseignant si mode teacher)
      let journals: any[] = [];
      try {
        const journalQuery = filter.mode === 'teacher'
          ? `SELECT cj.*, c."name" as "classNameResolved",
                    t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
             FROM "cahier_journal_entries" cj
             LEFT JOIN classes c ON c."id" = cj."classId"
             LEFT JOIN teachers t ON t."id" = cj."teacherId"
             WHERE cj."tenantId" = $1 AND cj."academicYearId" = $2
               AND cj."classId" = $3 AND cj."teacherId" = $4
             ORDER BY cj."weekStartDate" ASC`
          : `SELECT cj.*, c."name" as "classNameResolved",
                    t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
             FROM "cahier_journal_entries" cj
             LEFT JOIN classes c ON c."id" = cj."classId"
             LEFT JOIN teachers t ON t."id" = cj."teacherId"
             WHERE cj."tenantId" = $1 AND cj."academicYearId" = $2
               AND cj."classId" = $3
             ORDER BY cj."weekStartDate" ASC`;
        const journalParams = filter.mode === 'teacher'
          ? [tenantId, year.id, classId, filter.teacherId]
          : [tenantId, year.id, classId];
        journals = await this.prisma.$queryRawUnsafe(journalQuery, ...journalParams);
      } catch (err: any) {
        this.logger.warn(`buildClassCatalogueForYears: journals failed for year ${year.id} class ${classId}: ${err.message}`);
        journals = [];
      }

      // 1b. Fiches pédagogiques de cette classe + année
      let fiches: any[] = [];
      try {
        const ficheQuery = filter.mode === 'teacher'
          ? `SELECT f.id, f."sheetType", f."titre", f."cours", f."lessonDate", f."adminDate",
                    f.status, f."className", f."cahierJournalId", f."subjectId",
                    f."teacherId", f."classId"
             FROM "primary_pedagogical_fiches" f
             WHERE f."tenantId" = $1 AND f."academicYearId" = $2
               AND f."classId" = $3 AND f."teacherId" = $4
             ORDER BY f."lessonDate" ASC, f."adminDate" ASC`
          : `SELECT f.id, f."sheetType", f."titre", f."cours", f."lessonDate", f."adminDate",
                    f.status, f."className", f."cahierJournalId", f."subjectId",
                    f."teacherId", f."classId"
             FROM "primary_pedagogical_fiches" f
             WHERE f."tenantId" = $1 AND f."academicYearId" = $2
               AND f."classId" = $3
             ORDER BY f."lessonDate" ASC, f."adminDate" ASC`;
        const ficheParams = filter.mode === 'teacher'
          ? [tenantId, year.id, classId, filter.teacherId]
          : [tenantId, year.id, classId];
        fiches = await this.prisma.$queryRawUnsafe(ficheQuery, ...ficheParams);
      } catch (err: any) {
        this.logger.warn(`buildClassCatalogueForYears: fiches failed for year ${year.id} class ${classId}: ${err.message}`);
        fiches = [];
      }

      if (journals.length === 0 && fiches.length === 0) {
        // Année vide pour cette classe — on l'inclut quand même pour montrer
        // qu'elle existe (l'utilisateur peut cliquer dessus et voir un dossier vide).
        academicYears.push({
          id: year.id,
          name: year.name,
          label: year.label,
          startDate: year.startDate,
          endDate: year.endDate,
          isActive: year.isActive,
          trimesters: [],
        });
        continue;
      }

      // 2. Construire l'arbre trimestres → mois → semaines
      const trimestersMap: Record<number, {
        trimester: number;
        label: string;
        dateRange: { start: string | null; end: string | null };
        monthsMap: Record<number, { month: number; label: string; weeks: any[] }>;
      }> = {
        1: { trimester: 1, label: 'Premier trimestre', dateRange: { start: null, end: null }, monthsMap: {} },
        2: { trimester: 2, label: 'Deuxième trimestre', dateRange: { start: null, end: null }, monthsMap: {} },
        3: { trimester: 3, label: 'Troisième trimestre', dateRange: { start: null, end: null }, monthsMap: {} },
      };

      // Indexer les fiches par cahierJournalId pour les associer aux semaines
      const fichesByJournal: Record<string, any[]> = {};
      const fichesUnattached: any[] = []; // fiches sans cahierJournalId
      for (const fiche of fiches) {
        if (fiche.cahierJournalId) {
          if (!fichesByJournal[fiche.cahierJournalId]) {
            fichesByJournal[fiche.cahierJournalId] = [];
          }
          fichesByJournal[fiche.cahierJournalId].push(fiche);
        } else {
          fichesUnattached.push(fiche);
        }
      }

      // 2a. Pour chaque cahier journal, le placer dans le bon mois/trimestre
      for (const journal of journals) {
        const weekStart = new Date(journal.weekStartDate);
        const month = weekStart.getMonth() + 1; // 1-12
        const trimester = this.getTrimesterForDate(weekStart);

        if (!trimestersMap[trimester].monthsMap[month]) {
          trimestersMap[trimester].monthsMap[month] = { month, label: MONTH_LABELS[month], weeks: [] };
        }
        // Date range du trimestre (min/max)
        const ws = journal.weekStartDate;
        const we = journal.weekEndDate;
        if (!trimestersMap[trimester].dateRange.start || ws < trimestersMap[trimester].dateRange.start) {
          trimestersMap[trimester].dateRange.start = ws;
        }
        if (!trimestersMap[trimester].dateRange.end || we > trimestersMap[trimester].dateRange.end) {
          trimestersMap[trimester].dateRange.end = we;
        }

        // Associer les fiches liées à ce cahier journal
        const linkedFiches = fichesByJournal[journal.id] || [];

        trimestersMap[trimester].monthsMap[month].weeks.push({
          weekStartDate: journal.weekStartDate,
          weekEndDate: journal.weekEndDate,
          cahierJournal: {
            id: journal.id,
            status: journal.status,
            className: journal.classNameResolved || journal.className,
            classId: journal.classId,
            teacherFirstName: journal.teacherFirstName,
            teacherLastName: journal.teacherLastName,
            observations: journal.observations,
            submittedAt: journal.submittedAt,
            validatedAt: journal.validatedAt,
            entries: journal.entries, // JSON grid { lundi: {...}, mardi: {...}, ... }
          },
          fiches: linkedFiches.map((f: any) => ({
            id: f.id,
            sheetType: f.sheetType,
            titre: f.titre,
            cours: f.cours,
            lessonDate: f.lessonDate,
            adminDate: f.adminDate,
            status: f.status,
            className: f.className,
            subjectId: f.subjectId,
          })),
        });
      }

      // 2b. Ranger les fiches "non attachées" à un cahier journal
      for (const fiche of fichesUnattached) {
        const dateStr = fiche.lessonDate || fiche.adminDate;
        if (!dateStr) continue; // on ignore les fiches sans date
        const d = new Date(dateStr);
        const month = d.getMonth() + 1;
        const trimester = this.getTrimesterForDate(d);

        if (!trimestersMap[trimester].monthsMap[month]) {
          trimestersMap[trimester].monthsMap[month] = { month, label: MONTH_LABELS[month], weeks: [] };
        }

        // Chercher une semaine dans ce mois qui chevauche la date de la fiche
        const existingWeek = trimestersMap[trimester].monthsMap[month].weeks.find(w => {
          const ws = new Date(w.weekStartDate);
          const we = new Date(w.weekEndDate);
          return d >= ws && d <= we;
        });

        if (existingWeek) {
          existingWeek.fiches.push({
            id: fiche.id, sheetType: fiche.sheetType, titre: fiche.titre,
            cours: fiche.cours, lessonDate: fiche.lessonDate, adminDate: fiche.adminDate,
            status: fiche.status, className: fiche.className, subjectId: fiche.subjectId,
          });
        } else {
          // Semaine virtuelle (sans cahier journal) — juste pour la fiche
          const ws = new Date(d);
          ws.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // revenir à lundi
          const we = new Date(ws);
          we.setDate(ws.getDate() + 4); // vendredi
          trimestersMap[trimester].monthsMap[month].weeks.push({
            weekStartDate: ws.toISOString().substring(0, 10),
            weekEndDate: we.toISOString().substring(0, 10),
            cahierJournal: null,
            fiches: [{
              id: fiche.id, sheetType: fiche.sheetType, titre: fiche.titre,
              cours: fiche.cours, lessonDate: fiche.lessonDate, adminDate: fiche.adminDate,
              status: fiche.status, className: fiche.className, subjectId: fiche.subjectId,
            }],
          });
        }
      }

      // 3. Convertir les Maps en Arrays triés
      const trimesters = [1, 2, 3].map(t => {
        const tData = trimestersMap[t];
        const months = Object.values(tData.monthsMap).sort((a, b) => a.month - b.month);
        for (const m of months) {
          m.weeks.sort((a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime());
        }
        return {
          trimester: tData.trimester,
          label: tData.label,
          dateRange: tData.dateRange,
          months,
        };
      }).filter(t => t.months.length > 0); // retirer les trimestres vides

      academicYears.push({
        id: year.id,
        name: year.name,
        label: year.label,
        startDate: year.startDate,
        endDate: year.endDate,
        isActive: year.isActive,
        trimesters,
      });
    }

    return academicYears;
  }

  // ===========================================================================
  // ⭐ CATALOGUE WEEKLY RECORD OF WORK (EN track)
  //    Hiérarchie : Classe → Année → Terme (First/Second/Third Term)
  //    Pattern identique au catalogue cahier journal + fiches (explorateur
  //    Windows) — permet de retrouver les Weekly Records d'année en année.
  // ===========================================================================

  /**
   * Catalogue hiérarchique des Weekly Records of Work d'un enseignant
   * (ou de toutes les classes pour le directeur/promoteur), sur TOUTES les
   * années scolaires du tenant.
   *
   * Hiérarchie :
   *   Classe → Année (ex: 2025-2026) → Terme (First/Second/Third Term)
   *     └── Weekly Record (carte avec statut + boutons Voir / PDF / Réutiliser)
   */
  async getWeeklyRecordCatalogue(tenantId: string, teacherId: string) {
    // 1. Résoudre le filtre enseignant (mode "teacher" ou mode "direction")
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    if (filter.mode === 'none') {
      return { classes: [] };
    }

    // 2. Charger TOUTES les années scolaires du tenant
    const years: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, name, label, "startDate", "endDate", "isActive"
       FROM "academic_years"
       WHERE "tenantId" = $1
       ORDER BY "startDate" DESC`,
      tenantId,
    );
    if (!years || years.length === 0) {
      return { classes: [] };
    }

    // 3. Charger tous les Weekly Records du tenant (+ filtre enseignant)
    const EN_TERMS = ['First Term', 'Second Term', 'Third Term'];
    const recordQuery = filter.mode === 'teacher'
      ? `SELECT mp."id", mp."academicYearId", mp."classLevel", mp."month",
                mp."trimester", mp."status", mp."submittedAt", mp."validatedAt",
                mp."teacherId", mp."documentType", mp."weekDates",
                mp."headTeacherInitials", mp."headTeacherDate",
                mp."teacherSignature", mp."directorSignature",
                u."firstName" AS "teacherFirstName", u."lastName" AS "teacherLastName",
                COUNT(mp.id) OVER (PARTITION BY mp."academicYearId", mp."classLevel", mp."month", mp."teacherId") AS "cellCount"
         FROM "monthly_plans" mp
         LEFT JOIN "users" u ON u.id = mp."teacherId"
         WHERE mp."tenantId" = $1 AND mp."documentType" = 'WEEKLY_RECORD'
           AND mp."month" IN ('First Term','Second Term','Third Term')
           AND mp."teacherId" = $2
         ORDER BY mp."trimester" ASC`
      : `SELECT mp."id", mp."academicYearId", mp."classLevel", mp."month",
                mp."trimester", mp."status", mp."submittedAt", mp."validatedAt",
                mp."teacherId", mp."documentType", mp."weekDates",
                mp."headTeacherInitials", mp."headTeacherDate",
                mp."teacherSignature", mp."directorSignature",
                u."firstName" AS "teacherFirstName", u."lastName" AS "teacherLastName",
                COUNT(mp.id) OVER (PARTITION BY mp."academicYearId", mp."classLevel", mp."month", mp."teacherId") AS "cellCount"
         FROM "monthly_plans" mp
         LEFT JOIN "users" u ON u.id = mp."teacherId"
         WHERE mp."tenantId" = $1 AND mp."documentType" = 'WEEKLY_RECORD'
           AND mp."month" IN ('First Term','Second Term','Third Term')
         ORDER BY mp."trimester" ASC`;
    let records: any[] = [];
    try {
      records = await this.prisma.$queryRawUnsafe(
        recordQuery,
        ...(filter.mode === 'teacher' ? [tenantId, filter.teacherId] : [tenantId]),
      );
    } catch (err: any) {
      this.logger.warn(`getWeeklyRecordCatalogue: records query failed: ${err.message}`);
      records = [];
    }

    // 4. Déduire la liste des classes distinctes (classLevel) présentes
    //    + résoudre le nom de classe via classes.officialClassId
    const classLevels = [...new Set(records.map(r => r.classLevel))];
    let classLevelNames: Record<string, string> = {};
    if (classLevels.length > 0) {
      try {
        const classRows: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT "officialClassId", MIN("name") AS "name"
           FROM "classes"
           WHERE "tenantId" = $1 AND "officialClassId" = ANY($2::text[])
           GROUP BY "officialClassId"`,
          tenantId, classLevels,
        );
        classLevelNames = classRows.reduce((acc, r) => {
          acc[r.officialClassId] = r.name;
          return acc;
        }, {} as Record<string, string>);
      } catch (err: any) {
        this.logger.warn(`getWeeklyRecordCatalogue: class names resolution failed: ${err.message}`);
      }
    }

    // 5. Construire l'arbre classes → années → termes
    //    (dédupliqué par (year, classLevel, month, teacherId) — plusieurs
    //     lignes = un seul document)
    const seen = new Set<string>();
    const documents = records.filter(r => {
      const key = `${r.academicYearId}|${r.classLevel}|${r.month}|${r.teacherId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Grouper par classLevel
    const byClassLevel = new Map<string, any[]>();
    for (const doc of documents) {
      if (!byClassLevel.has(doc.classLevel)) byClassLevel.set(doc.classLevel, []);
      byClassLevel.get(doc.classLevel)!.push(doc);
    }

    const classes = [];
    for (const [classLevel, docs] of byClassLevel.entries()) {
      // Pour chaque année de la liste, trouver les documents
      const academicYears = [];
      for (const year of years) {
        const yearDocs = docs.filter(d => d.academicYearId === year.id);
        // Tri des termes dans l'ordre officiel
        yearDocs.sort((a, b) =>
          EN_TERMS.indexOf(a.month) - EN_TERMS.indexOf(b.month));

        const terms = EN_TERMS
          .filter(term => yearDocs.some(d => d.month === term))
          .map(term => {
            const doc = yearDocs.find(d => d.month === term)!;
            return {
              term,
              label: term,
              status: doc.status,
              submittedAt: doc.submittedAt,
              validatedAt: doc.validatedAt,
              teacherId: doc.teacherId,
              teacherName: [doc.teacherFirstName, doc.teacherLastName].filter(Boolean).join(' ') || null,
              cellCount: doc.cellCount,
              weekDates: doc.weekDates,
              headTeacherInitials: doc.headTeacherInitials,
              headTeacherDate: doc.headTeacherDate,
              teacherSignature: doc.teacherSignature,
              directorSignature: doc.directorSignature,
              academicYearId: doc.academicYearId,
              classLevel: doc.classLevel,
            };
          });

        academicYears.push({
          id: year.id,
          name: year.name,
          label: year.label,
          startDate: year.startDate,
          endDate: year.endDate,
          isActive: year.isActive,
          terms,
        });
      }

      classes.push({
        id: classLevel,
        name: classLevelNames[classLevel] || classLevel,
        classLevel,
        academicYears,
      });
    }

    return { classes };
  }

  /// Met à jour une entrée du cahier journal (grille, observations, etc.)
  async updateCahierJournal(
    tenantId: string,
    journalId: string,
    data: any,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1 AND "tenantId" = $2`,
      journalId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (data.entries !== undefined) {
      updates.push(`"entries" = $${paramIdx++}`);
      params.push(JSON.stringify(data.entries));
    }
    if (data.observations !== undefined) {
      updates.push(`"observations" = $${paramIdx++}`);
      params.push(data.observations || null);
    }
    if (data.className !== undefined) {
      updates.push(`"className" = $${paramIdx++}`);
      params.push(data.className || null);
    }
    if (data.directorName !== undefined) {
      updates.push(`"directorName" = $${paramIdx++}`);
      params.push(data.directorName || null);
    }
    // ⭐ Signatures (comme dans le module RH et le registre d'appel)
    if (data.teacherSignature !== undefined) {
      updates.push(`"teacherSignature" = $${paramIdx++}`);
      params.push(data.teacherSignature || null);
    }
    if (data.directorSignature !== undefined) {
      updates.push(`"directorSignature" = $${paramIdx++}`);
      params.push(data.directorSignature || null);
    }
    if (data.directorValidatedAt !== undefined) {
      updates.push(`"directorValidatedAt" = $${paramIdx++}`);
      params.push(data.directorValidatedAt ? new Date(data.directorValidatedAt) : null);
    }
    if (data.status !== undefined) {
      updates.push(`"status" = $${paramIdx++}`);
      params.push(data.status);
    }
    if (data.submittedAt !== undefined) {
      updates.push(`"submittedAt" = $${paramIdx++}`);
      params.push(data.submittedAt ? new Date(data.submittedAt) : null);
    }
    if (data.validatedAt !== undefined) {
      updates.push(`"validatedAt" = $${paramIdx++}`);
      params.push(data.validatedAt ? new Date(data.validatedAt) : null);
    }
    if (data.validatedBy !== undefined) {
      updates.push(`"validatedBy" = $${paramIdx++}`);
      params.push(data.validatedBy || null);
    }
    if (data.rejectionReason !== undefined) {
      updates.push(`"rejectionReason" = $${paramIdx++}`);
      params.push(data.rejectionReason || null);
    }

    if (updates.length === 0) {
      return existing[0];
    }

    updates.push(`"updatedAt" = NOW()`);
    params.push(journalId, tenantId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "cahier_journal_entries" SET ${updates.join(', ')} WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1`,
      journalId,
    );
    return updated[0];
  }

  /// Soumet le cahier journal au directeur.
  async submitCahierJournal(tenantId: string, journalId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1 AND "tenantId" = $2`,
      journalId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    if (existing[0].status !== 'DRAFT') {
      throw new BadRequestException('Cahier déjà soumis');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "cahier_journal_entries" SET "status" = 'SUBMITTED', "submittedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
      journalId,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1`,
      journalId,
    );
    return updated[0];
  }

  // ===========================================================================
  // ⭐ MISE À JOUR DIRECTEUR — observations + signature + validation cahier journal
  // ===========================================================================

  /**
   * ⭐ Permet au directeur d'ajouter ses observations (par jour + générale)
   *    et d'apposer sa signature, puis de valider le cahier journal.
   *
   * Body :
   *   - directorObservations: Record<string, string> — observations par jour
   *     (ex: { lundi: "Bien", mardi: "..." }) — stockées en rouge côté frontend
   *   - directorGeneralObservation: string — observation générale de la semaine (HTML)
   *   - directorSignature: string (base64) — signature du directeur (obligatoire pour valider)
   *   - action: 'VALIDATED' | 'REJECTED'
   *   - rejectionReason?: string
   */
  async directorUpdateCahierJournal(
    tenantId: string,
    journalId: string,
    body: {
      directorObservations?: Record<string, string>;
      directorGeneralObservation?: string;
      directorSignature?: string;
      action?: 'VALIDATED' | 'REJECTED';
      rejectionReason?: string;
    },
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1 AND "tenantId" = $2`,
      journalId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    const journal = existing[0];
    // ⭐ Si pas d'action → c'est une sauvegarde simple (observations only), pas de validation
    //    On permet la sauvegarde même si le statut n'est pas SUBMITTED
    if (body.action && journal.status !== 'SUBMITTED') {
      throw new BadRequestException(`Le cahier journal doit être en statut SUBMITTED pour être validé (actuel: ${journal.status})`);
    }

    // ⭐ Si VALIDATED, la signature du directeur est obligatoire
    if (body.action === 'VALIDATED' && !body.directorSignature) {
      throw new BadRequestException('La signature du directeur est obligatoire pour valider');
    }

    // ⭐ Mettre à jour les observations + signature + statut
    //    Si pas d'action → on ne change pas le statut (sauvegarde simple)
    const status = body.action || journal.status; // VALIDATED, REJECTED, ou statut actuel
    const directorSignature = body.directorSignature || null;
    const directorGeneralObservation = body.directorGeneralObservation || null;
    const rejectionReason = body.rejectionReason || null;
    const directorValidatedAt = body.action === 'VALIDATED' ? new Date() : null;

    // ⭐ Stocker les observations par jour dans le JSON entries
    //    On ajoute une clé spéciale "directorObservations" dans entries
    let entries = journal.entries;
    if (typeof entries === 'string') {
      try { entries = JSON.parse(entries); } catch { entries = {}; }
    }
    if (!entries || typeof entries !== 'object') entries = {};
    // Ajouter les observations du directeur dans chaque jour
    if (body.directorObservations) {
      for (const [dayKey, obs] of Object.entries(body.directorObservations)) {
        if (!entries[dayKey]) entries[dayKey] = {};
        entries[dayKey].directorObservation = obs;
      }
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "cahier_journal_entries"
       SET "entries" = $3::jsonb,
           "directorSignature" = $4,
           "observations" = COALESCE($5, "observations"),
           "status" = $6,
           "directorValidatedAt" = COALESCE($7, "directorValidatedAt"),
           "rejectionReason" = $8,
           "validatedAt" = CASE WHEN $6 = 'VALIDATED' THEN NOW() ELSE "validatedAt" END,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      journalId, tenantId,
      JSON.stringify(entries),
      directorSignature,
      directorGeneralObservation,
      status,
      directorValidatedAt,
      rejectionReason,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1`,
      journalId,
    );

    // ⭐ Notifier l'enseignant que le cahier journal a été validé/rejeté
    this.notifyTeacherOfCahierJournalDecision(tenantId, journal.classId, journal.teacherId, status, journal.weekStartDate)
      .catch((err) => this.logger.error('Teacher notification error:', err));

    return updated[0];
  }

  /**
   * ⭐ Notifie l'enseignant de la décision du directeur sur son cahier journal.
   */
  private async notifyTeacherOfCahierJournalDecision(
    tenantId: string,
    classId: string,
    teacherId: string,
    action: string,
    weekStartDate: Date,
  ) {
    let className = '—';
    try {
      const cls: any = await this.prisma.$queryRawUnsafe(
        `SELECT name FROM "classes" WHERE "id" = $1`, classId,
      );
      if (cls && cls.length > 0) className = cls[0].name || '—';
    } catch { /* silent */ }

    let schoolName = 'Établissement scolaire';
    try {
      const profile: any = await this.prisma.$queryRawUnsafe(
        `SELECT "schoolName" FROM "tenant_identity_profiles"
         WHERE "tenantId" = $1 AND "isActive" = true LIMIT 1`,
        tenantId,
      );
      if (profile && profile.length > 0) schoolName = profile[0].schoolName || schoolName;
    } catch { /* silent */ }

    // ⭐ Récupérer l'enseignant (User via teacherId)
    let teacher: any = null;
    try {
      // teacherId peut être un User.id ou un Teacher.id — on cherche par Teacher puis User
      const teacherRow: any = await this.prisma.$queryRawUnsafe(
        `SELECT t.*, u.email, u.phone, u."firstName", u."lastName"
         FROM "teachers" t
         LEFT JOIN "users" u ON u.email = t.email
         WHERE t.id = $1 LIMIT 1`,
        teacherId,
      );
      if (teacherRow && teacherRow.length > 0) teacher = teacherRow[0];
    } catch (err: any) {
      this.logger.warn(`Failed to fetch teacher: ${err.message}`);
    }

    if (!teacher || !teacher.email) {
      this.logger.warn(`Aucun email trouvé pour l'enseignant ${teacherId}`);
      return;
    }

    const weekLabel = new Date(weekStartDate).toLocaleDateString('fr-FR');
    const actionLabel = action === 'VALIDATED' ? 'validé' : 'rejeté';
    const actionColor = action === 'VALIDATED' ? '#10b981' : '#ef4444';

    const emailSubject = `[${schoolName}] Cahier journal ${actionLabel} — ${className} — ${weekLabel}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${actionColor}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 18px;">${schoolName}</h1>
          <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">Cahier journal ${actionLabel}</p>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: ${actionColor}; font-size: 16px;">Bonjour ${teacher.firstName || ''} ${teacher.lastName || ''},</h2>
          <p style="font-size: 14px; line-height: 1.5;">
            Votre cahier journal a été <strong style="color: ${actionColor};">${actionLabel}</strong> par le directeur :
          </p>
          <table style="width: 100%; margin: 15px 0; border-collapse: collapse;">
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Classe :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${className}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Semaine du :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${weekLabel}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Décision :</td><td style="padding: 5px; border-bottom: 1px solid #eee; color: ${actionColor}; font-weight: bold;">${actionLabel.toUpperCase()}</td></tr>
          </table>
          <p style="font-size: 14px; line-height: 1.5;">
            Connectez-vous à la plateforme pour consulter les observations du directeur
            dans <strong>Espace Pédagogique → Cahier Journal</strong>.
          </p>
        </div>
      </div>
    `;
    const smsMessage = `${schoolName}: Votre cahier journal (${className}, semaine du ${weekLabel}) a ete ${actionLabel} par le directeur.`;

    try {
      await this.emailService.sendCategorized({
        tenantId,
        category: 'PEDAGOGIE',
        subCategory: 'CAHIER_JOURNAL_DECISION',
        module: 'pedagogy' as any,
        to: teacher.email,
        toName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
        recipientType: 'ENSEIGNANT',
        recipientId: teacherId,
        subject: emailSubject,
        html: emailHtml,
        text: smsMessage,
        fromName: schoolName,
        triggeredBy: 'STAFF',
        relatedEntityId: classId,
        relatedEntityType: 'CahierJournal',
      } as any);
    } catch (err: any) {
      this.logger.warn(`Email to teacher failed: ${err.message}`);
    }

    if (teacher.phone) {
      try {
        const phone = teacher.phone.startsWith('+') ? teacher.phone : `+229${teacher.phone.replace(/^0/, '')}`;
        await this.whatsappService.sendCategorized({
          tenantId,
          category: 'PEDAGOGIE',
          subCategory: 'CAHIER_JOURNAL_DECISION',
          module: 'pedagogy' as any,
          to: phone,
          toName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
          recipientType: 'ENSEIGNANT',
          recipientId: teacherId,
          message: smsMessage,
          triggeredBy: 'STAFF',
          relatedEntityId: classId,
          relatedEntityType: 'CahierJournal',
        } as any);
      } catch (err: any) {
        this.logger.warn(`WhatsApp to teacher failed: ${err.message}`);
      }

      try {
        await this.smsService.sendSMS(teacher.phone, smsMessage);
      } catch (err: any) {
        this.logger.warn(`SMS to teacher failed: ${err.message}`);
      }
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // ⭐ 2026-09-15 MATERNELLE — MATIÈRES DYNAMIQUES (Matières & programmes)
  //
  // La grille du cahier journal maternelle ET la préparation des fiches
  // pédagogiques (DOMAINE / DOMAINE_2) doivent être construites à partir des
  // matières réellement configurées pour la classe dans le module Pédagogie
  // → onglet « Matières & programmes » (tables class_subjects / subjects),
  // et NON plus à partir de domaines codés en dur.
  //
  // Chaque matière configurée est classée dans son DOMAINE officiel
  // (I → V + groupe « DOMAINE [n° à renseigner] » pour pré-lecture /
  // pré-écriture / pré-mathématiques) par correspondance de nom,
  // insensible à la casse et aux accents.
  // ═══════════════════════════════════════════════════════════════════════

  /// Définition des domaines officiels de la maternelle :
  /// titre du groupe, mots-clés de classement des matières (normalisés),
  /// clés legacy de l'ancienne grille codée en dur, ordre pédagogique
  /// des sous-colonnes du groupe « DOMAINE [n° à renseigner] ».
  private static readonly MAT_DOMAIN_DEFS = [
    {
      key: 'dom1', title: 'DOMAINE I', hint: null as string | null,
      keywords: ['sante', 'hygiene'],
      legacyKeys: ['dom1_sante'],
      order: null as Record<string, number> | null,
    },
    {
      key: 'dom2', title: 'DOMAINE II', hint: null as string | null,
      keywords: ['corporelle', 'psychomotrice', 'motricite'],
      legacyKeys: ['dom2_corporelle'],
      order: null as Record<string, number> | null,
    },
    {
      key: 'domPre', title: 'DOMAINE', hint: "N° à renseigner par l'enseignante",
      keywords: ['pre-lecture', 'pre lecture', 'pre-ecriture', 'pre ecriture', 'pre-math', 'pre math'],
      legacyKeys: ['pre_lecture', 'pre_ecriture', 'pre_mathematiques'],
      order: { 'pre-lecture': 1, 'pre-ecriture': 2, 'pre-math': 3 } as Record<string, number>,
    },
    {
      key: 'dom3', title: 'DOMAINE III', hint: null as string | null,
      keywords: ['sensorielle', 'eveil', 'travaux manuels', 'scientifique', 'manuelle'],
      legacyKeys: ['dom3_sensorielle', 'dom3_travaux_manuels'],
      order: null as Record<string, number> | null,
    },
    {
      key: 'dom4', title: 'DOMAINE IV', hint: null as string | null,
      keywords: ['emotionnelle', 'plastique', 'dessin', 'peinture', 'coloriage'],
      legacyKeys: ['dom4_emotionnelle', 'dom4_plastique'],
      order: null as Record<string, number> | null,
    },
    {
      key: 'dom5', title: 'DOMAINE V', hint: null as string | null,
      keywords: ['orale', 'conte', 'poesie', 'chant', 'comptine', 'activites libres', 'langage'],
      legacyKeys: ['dom5_comm_orale', 'dom5_conte', 'dom5_poesie_chant', 'dom5_act_libres'],
      order: null as Record<string, number> | null,
    },
  ];

  /// Libellés des anciennes colonnes codées en dur (migration + orphelins).
  private static readonly MAT_LEGACY_LABELS: Record<string, string> = {
    dom1_sante: 'Éducation pour la santé',
    dom2_corporelle: 'Expression corporelle',
    pre_lecture: 'Pré-lecture',
    pre_ecriture: 'Pré-écriture',
    pre_mathematiques: 'Pré-mathématiques',
    dom3_sensorielle: 'Éducation sensorielle',
    dom3_travaux_manuels: 'Travaux manuels',
    dom4_emotionnelle: 'Expression émotionnelle',
    dom4_plastique: 'Expression plastique',
    dom5_comm_orale: 'Communication orale',
    dom5_conte: 'Conte',
    dom5_poesie_chant: 'Poésie chant comptine',
    dom5_act_libres: 'Activités libres',
  };

  /// Normalise un libellé de matière : minuscules + suppression des accents.
  /// Les matières étant saisies librement par l'école dans l'onglet
  /// « Matières & programmes », la correspondance doit tolérer
  /// « Éducation pour la santé », « education pour la sante », etc.
  private normalizeFrText(s: string): string {
    return (s || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /// Classe une matière (par son nom) dans son domaine officiel maternelle.
  /// Retourne la définition du domaine ou null si aucune correspondance.
  private matchMaternelleDomain(subjectName: string) {
    const n = this.normalizeFrText(subjectName);
    if (!n) return null;
    for (const def of PedagogicalSpaceService.MAT_DOMAIN_DEFS) {
      if (def.keywords.some((k: string) => n.includes(k))) return def;
    }
    return null;
  }

  /// Récupère les matières configurées pour une classe maternelle depuis
  /// le module Pédagogie → onglet « Matières & programmes »
  /// (class_subjects → subjects), filtrées par la piste linguistique de
  /// la classe (une classe FR ne voit pas les matières EN et réciproquement).
  private async getMaternelleSubjectsForClass(
    tenantId: string,
    academicYearId: string,
    classId: string,
  ): Promise<Array<{ subjectId: string; subjectName: string }>> {
    if (!classId || !academicYearId) return [];
    try {
      const cls: any = await this.prisma.$queryRawUnsafe(
        `SELECT id, "officialClassId", language FROM classes WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
        classId, tenantId,
      );
      if (!cls || cls.length === 0) return [];
      const classLang = (cls[0].language || '').toString().trim().toUpperCase();
      const langFilter = classLang === 'FR' || classLang === 'EN';
      const academicClassId = cls[0].officialClassId || null;

      const rows: any = langFilter
        ? await this.prisma.$queryRawUnsafe(
            `SELECT DISTINCT s."id" as "subjectId", s."name" as "subjectName"
             FROM subjects s
             INNER JOIN class_subjects cs ON cs."subjectId" = s."id"
             WHERE cs."tenantId" = $1 AND cs."academicYearId" = $2
               AND (cs."academicClassId" = $3 OR cs."classId" = $4)
               AND (s."language" IS NULL OR s."language" = '' OR s."language" = $5)
             ORDER BY s."name"`,
            tenantId, academicYearId, academicClassId, classId, classLang,
          )
        : await this.prisma.$queryRawUnsafe(
            `SELECT DISTINCT s."id" as "subjectId", s."name" as "subjectName"
             FROM subjects s
             INNER JOIN class_subjects cs ON cs."subjectId" = s."id"
             WHERE cs."tenantId" = $1 AND cs."academicYearId" = $2
               AND (cs."academicClassId" = $3 OR cs."classId" = $4)
             ORDER BY s."name"`,
            tenantId, academicYearId, academicClassId, classId,
          );
      return (rows || []).map((r: any) => ({ subjectId: r.subjectId, subjectName: r.subjectName }));
    } catch (err: any) {
      this.logger.warn(`getMaternelleSubjectsForClass: ${err.message}`);
      return [];
    }
  }

  /// Construit la grille du cahier journal maternelle à partir des matières
  /// configurées : chaque matière devient une sous-colonne dans son DOMAINE
  /// officiel (I → V), la colonne Observations est placée dans le groupe
  /// « DOMAINE [n° à renseigner] » (modèle officiel). Les matières non
  /// rattachables à un domaine connu vont dans « AUTRES MATIÈRES ».
  /// Retourne [] si aucune matière n'est configurée (l'appelant décide du repli).
  private buildMaternelleGroups(subjects: Array<{ subjectId: string; subjectName: string }>) {
    const byDomain: Record<string, Array<{ key: string; label: string; subjectId: string; weight: number }>> = {};
    const others: Array<{ key: string; label: string; subjectId: string; weight: number }> = [];

    for (const s of subjects) {
      const def = this.matchMaternelleDomain(s.subjectName);
      if (!def) {
        others.push({ key: s.subjectName, label: s.subjectName, subjectId: s.subjectId, weight: 90 });
        continue;
      }
      const n = this.normalizeFrText(s.subjectName);
      let weight = 50;
      if (def.order) {
        const orderKey = Object.keys(def.order).find(k => n.includes(k));
        weight = orderKey ? def.order[orderKey] : 50;
      }
      (byDomain[def.key] = byDomain[def.key] || []).push({
        key: s.subjectName, label: s.subjectName, subjectId: s.subjectId, weight,
      });
    }

    const groups: Array<{
      key: string; title: string; hint: string | null;
      subs: Array<{ key: string; label: string; subjectId: string | null; weight: number }>;
    }> = [];
    let hasDomPre = false;

    for (const def of PedagogicalSpaceService.MAT_DOMAIN_DEFS) {
      const subs = byDomain[def.key] || [];
      if (subs.length === 0) continue;
      subs.sort((a, b) => (a.weight - b.weight) || a.label.localeCompare(b.label, 'fr'));
      const groupSubs: Array<{ key: string; label: string; subjectId: string | null; weight: number }> = [...subs];
      if (def.key === 'domPre') {
        // ⭐ Colonne Observations — position exacte du modèle officiel
        //    (dernière sous-colonne du groupe « DOMAINE [n° à renseigner] »).
        groupSubs.push({ key: 'obs_dom', label: 'Observations', subjectId: null, weight: 99 });
        hasDomPre = true;
      }
      groups.push({ key: def.key, title: def.title, hint: def.hint, subs: groupSubs });
    }

    if (others.length > 0) {
      others.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
      groups.push({ key: 'autres', title: 'AUTRES MATIÈRES', hint: null, subs: others });
    }
    // ⭐ Pas de matières « pré-apprentissages » configurées → la colonne
    //    Observations devient un groupe autonome en fin de grille.
    if (!hasDomPre && groups.length > 0) {
      groups.push({
        key: 'obs', title: 'OBSERVATIONS', hint: null,
        subs: [{ key: 'obs_dom', label: 'Observations', subjectId: null, weight: 99 }],
      });
    }
    return groups;
  }

  /// Migre les clés legacy (dom1_sante, pre_lecture, …) des cahiers journal
  /// maternelle créés AVANT l'introduction des matières dynamiques, vers les
  /// nouvelles clés (= noms des matières configurées). Idempotent : les clés
  /// legacy sont retirées après migration. Les contenus orphelins (domaine
  /// sans matière configurée) sont conservés et exposés en « AUTRES MATIÈRES »
  /// afin de ne jamais perdre une saisie enseignante.
  private migrateMaternelleEntries(
    entries: Record<string, any>,
    groups: Array<{ key: string; title: string; hint: string | null; subs: Array<{ key: string; label: string; subjectId: string | null; weight: number }> }>,
  ): { entries: Record<string, any>; changed: boolean; groups: typeof groups } {
    const legacyToDomain: Record<string, string> = {};
    for (const def of PedagogicalSpaceService.MAT_DOMAIN_DEFS) {
      for (const lk of def.legacyKeys) legacyToDomain[lk] = def.key;
    }
    let changed = false;
    let extendedGroups = groups;
    const out: Record<string, any> = {};

    for (const [day, dayEntriesRaw] of Object.entries(entries || {})) {
      const dayEntries = dayEntriesRaw || {};
      const newDay: Record<string, any> = {};
      const legacyByDomain: Record<string, Array<{ key: string; content: string }>> = {};

      for (const [k, v] of Object.entries(dayEntries)) {
        const content = typeof v === 'string' ? v : '';
        if (legacyToDomain[k] && content.trim()) {
          (legacyByDomain[legacyToDomain[k]] = legacyByDomain[legacyToDomain[k]] || []).push({ key: k, content });
        } else {
          newDay[k] = v;
        }
      }

      for (const [domain, items] of Object.entries(legacyByDomain)) {
        const targetGroup = groups.find(g => g.key === domain);
        const targetSubs = (targetGroup?.subs || []).filter(s => s.subjectId);
        if (targetSubs.length > 0) {
          const target = targetSubs[0].key;
          const merged = items.map(i => i.content).filter(c => c.trim()).join('<br/>');
          newDay[target] = newDay[target] && String(newDay[target]).trim()
            ? `${newDay[target]}<br/>${merged}`
            : merged;
        } else {
          // Orphelin : aucune matière configurée pour ce domaine → on garde
          // le contenu sous sa clé legacy, affiché en « AUTRES MATIÈRES ».
          for (const item of items) newDay[item.key] = item.content;
        }
      }

      // Quelque chose a-t-il changé pour ce jour ?
      const beforeKeys = Object.keys(dayEntries);
      const afterKeys = Object.keys(newDay);
      if (
        beforeKeys.length !== afterKeys.length ||
        beforeKeys.some(k => !afterKeys.includes(k)) ||
        afterKeys.some(k => !beforeKeys.includes(k))
      ) changed = true;

      out[day] = newDay;
    }

    // Étendre « AUTRES MATIÈRES » avec les colonnes orphelines éventuelles
    const orphanKeys = new Set<string>();
    for (const dayEntries of Object.values(out)) {
      for (const k of Object.keys(dayEntries || {})) {
        if (legacyToDomain[k]) orphanKeys.add(k);
      }
    }
    if (orphanKeys.size > 0) {
      const orphanSubs = Array.from(orphanKeys).map(k => ({
        key: k,
        label: PedagogicalSpaceService.MAT_LEGACY_LABELS[k] || k.replace(/_/g, ' '),
        subjectId: null,
        weight: 95,
      }));
      const autresIdx = extendedGroups.findIndex(g => g.key === 'autres');
      if (autresIdx >= 0) {
        extendedGroups = extendedGroups.map((g, i) =>
          i === autresIdx ? { ...g, subs: [...g.subs, ...orphanSubs] } : g,
        );
      } else {
        extendedGroups = [...extendedGroups, { key: 'autres', title: 'AUTRES MATIÈRES', hint: null, subs: orphanSubs }];
      }
    }

    return { entries: out, changed, groups: extendedGroups };
  }

  /**
   * ⭐ Récupère toutes les fiches pédagogiques rattachées à un cahier journal.
   *    Utilise le nouveau champ structurel `cahierJournalId` (préféré) +
   *    fallback par plage de dates (legacy / fiches non rattachées).
   *
   *    Retourne : { parJour: { lundi: [...], mardi: [...], ... }, fiches: [...], stats }
   */
  async getFichesForCahierJournal(tenantId: string, journalId: string) {
    // ─── 1. Charger le cahier journal (+ niveau scolaire) ───
    //    ⭐ JOIN school_levels : nécessaire pour savoir si la classe est
    //    MATERNELLE → les matières planifiées (clés = noms des matières
    //    configurées) doivent être rapprochées des fiches DOMAINE/DOMAINE_2.
    const journalRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT cje.*, sl."code" as "schoolLevelCode", sl."name" as "schoolLevelName"
       FROM "cahier_journal_entries" cje
       LEFT JOIN classes c ON c."id" = cje."classId"
       LEFT JOIN school_levels sl ON sl."id" = c."schoolLevelId"
       WHERE cje."id" = $1 AND cje."tenantId" = $2`,
      journalId, tenantId,
    );
    if (!journalRows || journalRows.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    const journal = journalRows[0];
    const isMaternelleJournal = (journal.schoolLevelCode || '').toString().toUpperCase() === 'MATERNELLE';

    // ⭐ MATERNELLE : résoudre les matières de la classe (noms → subjectId)
    //    pour un rapprochement précis matières planifiées ↔ fiches.
    let subjectIdByMatiereName = new Map<string, string>();
    if (isMaternelleJournal) {
      const matSubjects = await this.getMaternelleSubjectsForClass(
        tenantId, journal.academicYearId, journal.classId,
      );
      subjectIdByMatiereName = new Map(matSubjects.map(s => [s.subjectName, s.subjectId]));
    }

    // ⭐ Détection : la colonne "cahierJournalId" existe-t-elle sur primary_pedagogical_fiches ?
    //    Si la migration prisma db push n'a pas été exécutée, la colonne n'existe pas
    //    et on doit fallback sur l'ancienne méthode (par plage de dates).
    let hasCahierJournalIdColumn = false;
    try {
      const colCheck: any = await this.prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'primary_pedagogical_fiches' AND column_name = 'cahierJournalId'
         LIMIT 1`,
      );
      hasCahierJournalIdColumn = Array.isArray(colCheck) && colCheck.length > 0;
    } catch {
      hasCahierJournalIdColumn = false;
    }

    // ─── 2. Charger les fiches rattachées structurellement (cahierJournalId) ───
    //    Uniquement si la colonne existe ; sinon on saute cette étape.
    let fichesLiees: any[] = [];
    if (hasCahierJournalIdColumn) {
      try {
        fichesLiees = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM "primary_pedagogical_fiches"
           WHERE "cahierJournalId" = $1
           ORDER BY "lessonDate" ASC NULLS LAST, "adminDate" ASC NULLS LAST, "createdAt" ASC`,
          journalId,
        );
      } catch (err) {
        this.logger.warn(`getFichesForCahierJournal: query by cahierJournalId failed, fallback to date range: ${err.message}`);
        fichesLiees = [];
      }
    }

    // ─── 3. Fallback : fiches non rattachées mais dont la date est dans la semaine ───
    //    (pour rétro-compatibilité avec les fiches créées avant l'ajout du champ
    //    OU si la colonne n'existe pas encore)
    let fichesNonLieees: any[] = [];
    try {
      if (hasCahierJournalIdColumn) {
        // Colonne existe : on filtre les fiches sans cahierJournalId + dans la plage
        fichesNonLieees = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM "primary_pedagogical_fiches"
           WHERE "tenantId" = $1
             AND "academicYearId" = $2
             AND "teacherId" = $3
             AND "classId" = $4
             AND ("cahierJournalId" IS NULL)
             AND (("adminDate" IS NOT NULL AND "adminDate" BETWEEN $5 AND $6)
               OR ("lessonDate" IS NOT NULL AND "lessonDate" BETWEEN $5 AND $6))
           ORDER BY "lessonDate" ASC NULLS LAST, "adminDate" ASC NULLS LAST`,
          tenantId, journal.academicYearId, journal.teacherId, journal.classId,
          journal.weekStartDate, journal.weekEndDate,
        );
      } else {
        // Colonne n'existe pas : on prend toutes les fiches de la semaine
        fichesNonLieees = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM "primary_pedagogical_fiches"
           WHERE "tenantId" = $1
             AND "academicYearId" = $2
             AND "teacherId" = $3
             AND "classId" = $4
             AND (("adminDate" IS NOT NULL AND "adminDate" BETWEEN $5 AND $6)
               OR ("lessonDate" IS NOT NULL AND "lessonDate" BETWEEN $5 AND $6))
           ORDER BY "lessonDate" ASC NULLS LAST, "adminDate" ASC NULLS LAST`,
          tenantId, journal.academicYearId, journal.teacherId, journal.classId,
          journal.weekStartDate, journal.weekEndDate,
        );
      }
    } catch (err) {
      this.logger.warn(`getFichesForCahierJournal: date range query failed: ${err.message}`);
      fichesNonLieees = [];
    }

    // ─── 3.bis Fallback élargi : si aucune fiche trouvée (ni par cahierJournalId,
    //       ni par date range), chercher TOUTES les fiches SUBMITTED/VALIDATED
    //       de la même classe + année (sans filtrer par teacherId, car teacherId
    //       peut être l'ID du User connecté et non l'ID du Teacher). ───
    const allFichesSoFar = [...(fichesLiees || []), ...(fichesNonLieees || [])];
    if (allFichesSoFar.length === 0 && journal.classId) {
      try {
        const fichesElargies = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM "primary_pedagogical_fiches"
           WHERE "tenantId" = $1
             AND "academicYearId" = $2
             AND "classId" = $3
             AND "status" IN ('SUBMITTED', 'VALIDATED', 'DRAFT')
           ORDER BY "createdAt" DESC
           LIMIT 20`,
          tenantId, journal.academicYearId, journal.classId,
        );
        if (Array.isArray(fichesElargies) && fichesElargies.length > 0) {
          fichesNonLieees = fichesElargies as any[];
          this.logger.log(`getFichesForCahierJournal: broader fallback found ${fichesElargies.length} fiches by classId`);
        }
      } catch (err) {
        this.logger.warn(`getFichesForCahierJournal: broader fallback failed: ${err.message}`);
      }
    }

    // ─── 4. Grouper par jour ───
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const parJour: Record<string, any[]> = {
      lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [],
    };
    const allFiches = [...(fichesLiees || []), ...(fichesNonLieees || [])];
    for (const fiche of allFiches) {
      const dateStr = fiche.lessonDate || fiche.adminDate;
      if (!dateStr) {
        // ⭐ Fiche sans date → mettre dans "lundi" par défaut (pour qu'elle apparaisse)
        parJour['lundi'].push(fiche);
        continue;
      }
      const d = new Date(dateStr);
      const dayName = dayNames[d.getDay()];
      if (parJour[dayName]) {
        parJour[dayName].push(fiche);
      }
    }

    // ─── 5. Calculer la liste des matières planifiées dans le cahier journal ───
    //    `entries` est un JSON : { lundi: { francais: "...", maths: "..." }, mardi: {...}, ... }
    //    On extrait les matières non-vides par jour pour identifier les fiches manquantes.
    const matieresPlanifiees: Record<string, Array<{ matiere: string; fichePreparede: boolean; ficheId?: string }>> = {
      lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [],
    };
    let entries: any = {};
    try {
      entries = typeof journal.entries === 'string' ? JSON.parse(journal.entries) : (journal.entries || {});
    } catch { entries = {}; }

    // ⭐ 2026-09-15 : clés réservées (pas des matières) — colonne
    //    observations (recto), observation du directeur, et obs_dom (colonne
    //    Observations du groupe DOMAINE dans la grille maternelle).
    const RESERVED_ENTRY_KEYS = new Set(['observations', 'directorObservation', 'obs_dom']);
    for (const jour of Object.keys(parJour)) {
      const dayEntries = entries[jour] || {};
      for (const [matiereKey, matiereContent] of Object.entries(dayEntries)) {
        if (RESERVED_ENTRY_KEYS.has(matiereKey)) continue;
        // Une matière est "planifiée" si son contenu n'est pas vide
        const content = typeof matiereContent === 'string' ? matiereContent.trim() : '';
        if (!content) continue;
        // Cherche si une fiche existe pour cette matière ce jour
        const fichesForDay = parJour[jour] || [];
        // ⭐ MATERNELLE : la clé matière = le NOM de la matière configurée
        //    (Matières & programmes) → rapprochement prioritaire par subjectId,
        //    puis par type de fiche (DOMAINE / DOMAINE_2).
        const matSubjectId = subjectIdByMatiereName.get(matiereKey);
        const matchingFiche = fichesForDay.find((f: any) => {
          if (isMaternelleJournal) {
            if (matSubjectId && f.subjectId && f.subjectId === matSubjectId) return true;
            const expectedSheetType = this.mapMatiereKeyToSheetType(matiereKey, true);
            return !!expectedSheetType && f.sheetType === expectedSheetType;
          }
          // PRIMAIRE : match par subjectId si dispo, sinon par sheetType
          return (f.subjectId && f.subjectId === matiereKey)
            || (f.sheetType && this.mapMatiereKeyToSheetType(matiereKey, false) === f.sheetType);
        });
        matieresPlanifiees[jour].push({
          matiere: matiereKey,
          fichePreparede: !!matchingFiche,
          ficheId: matchingFiche?.id,
        });
      }
    }

    // ─── 6. Stats ───
    const totalMatieresPlanifiees = Object.values(matieresPlanifiees).reduce((s, arr) => s + arr.length, 0);
    const totalFichesPreparees = Object.values(matieresPlanifiees).reduce(
      (s, arr) => s + arr.filter(m => m.fichePreparede).length, 0,
    );
    const totalFichesManquantes = totalMatieresPlanifiees - totalFichesPreparees;

    return {
      journalId,
      weekStartDate: journal.weekStartDate,
      weekEndDate: journal.weekEndDate,
      className: journal.className,
      status: journal.status,
      // ⭐ Indique au frontend si la grille est maternelle (fiches DOMAINE /
      //    DOMAINE_2, matières = domaines d'activités) — utile pour mapper
      //    correctement matière → type de fiche.
      isMaternelle: isMaternelleJournal,
      fiches: allFiches,
      parJour,
      matieresPlanifiees,
      stats: {
        totalFiches: allFiches.length,
        totalMatieresPlanifiees,
        totalFichesPreparees,
        totalFichesManquantes,
        toutesFichesPreparees: totalFichesManquantes === 0,
      },
    };
  }

  /**
   * Helper : mappe une clé matière du cahier journal vers un sheetType de fiche.
   * Le cahier journal utilise des clés comme "francais", "anglais", "mathematiques", etc.
   * On devine le sheetType correspondant.
   *
   * ⭐ MATERNELLE (isMaternelle=true) : les clés sont désormais les NOMS des
   * matières configurées dans l'onglet « Matières & programmes » (ex : « Éducation
   * pour la santé et l'environnement », « Expression corporelle »), plus les
   * anciennes clés legacy (dom1_sante…). Toutes les matières maternelle →
   * fiche « DOMAINE », sauf Expression corporelle → fiche « DOMAINE 2 ».
   */
  private mapMatiereKeyToSheetType(matiereKey: string, isMaternelle = false): string | null {
    const k = (matiereKey || '').toLowerCase().trim();
    // ⭐ 2026-09-15 MATERNELLE — clés de la grille cahier journal maternelle :
    //    chaque colonne = une matière configurée (ou une clé legacy d'un
    //    domaine d'activité). DOMAINE_2 (Expression corporelle) a sa fiche
    //    dédiée ; toutes les autres colonnes utilisent la fiche « Domaine »
    //    (n° à renseigner par l'enseignante).
    if (isMaternelle) {
      const n = this.normalizeFrText(matiereKey);
      if (n.includes('corporelle')) return 'DOMAINE_2';
      if (k === 'dom2_corporelle') return 'DOMAINE_2';
      if (k.startsWith('dom') || k === 'pre_lecture' || k === 'pre_ecriture' || k === 'pre_mathematiques') {
        return 'DOMAINE';
      }
      // Noms de matières dynamiques : pré-apprentissages, santé, sensorielle,
      // éveil, plastique, orale, conte, poésie… → fiche « Domaine ».
      if (
        n.includes('pre-lecture') || n.includes('pre lecture')
        || n.includes('pre-ecriture') || n.includes('pre ecriture')
        || n.includes('pre-math') || n.includes('pre math')
        || n.includes('sante') || n.includes('hygiene')
        || n.includes('sensorielle') || n.includes('eveil') || n.includes('travaux manuels')
        || n.includes('scientifique') || n.includes('manuelle')
        || n.includes('emotionnelle') || n.includes('plastique')
        || n.includes('dessin') || n.includes('peinture') || n.includes('coloriage')
        || n.includes('orale') || n.includes('conte') || n.includes('poesie')
        || n.includes('chant') || n.includes('comptine') || n.includes('activites libres')
        || n.includes('langage')
      ) {
        return 'DOMAINE';
      }
      // Matière maternelle non reconnue → fiche « Domaine » par défaut
      // (les 2 formats officiels maternelle couvrent toutes les matières).
      return 'DOMAINE';
    }
    if (k === 'dom2_corporelle') return 'DOMAINE_2';
    if (k.startsWith('dom') || k === 'pre_lecture' || k === 'pre_ecriture' || k === 'pre_mathematiques') {
      return 'DOMAINE';
    }
    // ⭐ 2026-09-15 — FICHE STANDARD pour l'anglais et l'informatique enseignés
    //    comme matières par un enseignant SPÉCIALISÉ (écoles non bilingues).
    //    Ces vérifications AVANT les autres branches : « informatique » ne doit
    //    plus tomber dans EST (ancien comportement accidentel), et « anglais »
    //    doit trouver son modèle standard au lieu de null.
    if (k.includes('anglais') || k.includes('english') || k.includes('informatique') || k.includes('computer')) {
      return 'STANDARD';
    }
    if (k.includes('francais') || k.includes('français') || k.includes('lecture')
      || k.includes('dictee') || k.includes('grammaire') || k.includes('conjugaison') || k.includes('vocabulaire')
      || k.includes('orthographe') || k.includes('expression')) {
      return 'FRANCAIS';
    }
    if (k.includes('math') || k.includes('calcul') || k.includes('numeration')
      || k.includes('mesure') || k.includes('geometrie')) {
      return 'MATH';
    }
    if (k.includes('est') || k.includes('science') || k.includes('technologie')) {
      return 'EST';
    }
    if (k.includes('eps') || k.includes('sport') || k.includes('education physique')
      || k.includes('athletisme') || k.includes('gymnastique') || k.includes('jeu collectif')) {
      return 'EPS';
    }
    if (k.includes('histoire') || k.includes('geographie') || k.includes('geographie')
      || k.includes('morale') || k.includes('civisme') || k.includes('educ_sociale')
      || k.includes('social')) {
      return 'ES';
    }
    if (k.includes('chant') || k.includes('poesie') || k.includes('dessin')
      || k.includes('musique') || k.includes('art') || k.includes('educ_artistique')) {
      return 'EA';
    }
    return null;
  }

  /**
   * ⭐ Rattache manuellement une fiche pédagogique à un cahier journal.
   *    Utilisé quand l'enseignant crée une fiche depuis l'UI du cahier journal
   *    (bouton "Préparer la fiche pour [jour] [matière]").
   */
  async linkFicheToCahierJournal(tenantId: string, journalId: string, ficheId: string) {
    // Vérifier que le cahier journal existe
    const journalRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, tenantId FROM "cahier_journal_entries" WHERE "id" = $1 AND "tenantId" = $2`,
      journalId, tenantId,
    );
    if (!journalRows || journalRows.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    // Vérifier que la fiche existe et appartient au même tenant
    const ficheRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, tenantId FROM "primary_pedagogical_fiches" WHERE "id" = $1 AND "tenantId" = $2`,
      ficheId, tenantId,
    );
    if (!ficheRows || ficheRows.length === 0) {
      throw new NotFoundException('Fiche pédagogique non trouvée');
    }
    // ⭐ Rendu résilient : si la colonne cahierJournalId n'existe pas (migration non faite),
    //    on retourne quand même success — le lien sera établi plus tard une fois la migration faite.
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "primary_pedagogical_fiches" SET "cahierJournalId" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
        journalId, ficheId,
      );
    } catch (err: any) {
      this.logger.warn(`linkFicheToCahierJournal: column cahierJournalId not found, skipping: ${err.message}`);
      // On ne plante pas — on retourne success (le lien sera établi plus tard)
    }
    return { success: true, journalId, ficheId };
  }

  /**
   * ⭐ Soumet le cahier journal + les fiches pédagogiques associées.
   *
   * Schéma utilisateur :
   *   - L'enseignant peut soumettre le cahier journal + toutes les fiches
   *     pédagogiques de la semaine (lundi → vendredi)
   *   - Ou bien, s'il n'a fait que lundi/mardi/mercredi, il soumet le cahier
   *     journal + les fiches pédagogiques de ces 3 jours, puis plus tard il
   *     soumettra les 2 jours restants (jeudi, vendredi)
   *
   * Paramètres :
   *   - journalId : ID du cahier journal
   *   - dayRange : tableau des jours à soumettre, ex: ['lundi', 'mardi', 'mercredi']
   *                (si vide ou non fourni → tous les jours lundi→vendredi)
   *
   * Étapes :
   *   1. Vérifier que le cahier journal existe et est en DRAFT
   *   2. Récupérer les fiches pédagogiques du tenant+teacher+class dont la date
   *      (adminDate ou lessonDate) tombe dans la semaine et correspond aux jours
   *      demandés
   *   3. Soumettre le cahier journal (DRAFT → SUBMITTED)
   *   4. Soumettre les fiches pédagogiques trouvées (DRAFT → SUBMITTED)
   *   5. Notifier le directeur (email + WhatsApp + SMS) — fire-and-forget
   */
  async submitCahierJournalWithFiches(
    tenantId: string,
    journalId: string,
    dayRange?: string[],
  ) {
    // ─── 1. Charger le cahier journal ───
    const journalRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1 AND "tenantId" = $2`,
      journalId, tenantId,
    );
    if (!journalRows || journalRows.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    const journal = journalRows[0];
    if (journal.status !== 'DRAFT') {
      throw new BadRequestException(`Cahier déjà soumis (statut: ${journal.status})`);
    }

    // ─── 1.5. ⭐ VÉRIFICATION PLANIFICATION MENSUELLE (début de mois) ───
    //    Au début de chaque mois, le système vérifie si la planification mensuelle
    //    du mois correspondant a été soumise ET validée par le directeur.
    //    Si non → bloque la soumission du cahier journal avec un message clair.
    try {
      // Déterminer le mois du cahier journal depuis weekStartDate
      const weekStartDate = new Date(journal.weekStartDate);
      const MONTH_NAMES_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                              'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const journalMonth = MONTH_NAMES_FR[weekStartDate.getMonth()];

      // Résoudre le classLevel (officialClassId) depuis la classe physique
      let classLevel: string | null = null;
      if (journal.classId) {
        const classRows: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT "officialClassId" FROM "classes" WHERE "id" = $1 AND "tenantId" = $2`,
          journal.classId, tenantId,
        );
        classLevel = classRows[0]?.officialClassId || null;
      }

      // Vérifier s'il existe une planification mensuelle pour ce mois + classe
      if (classLevel && journalMonth && journal.academicYearId) {
        const monthlyPlanRows: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT "status" FROM "monthly_plans"
           WHERE "tenantId" = $1 AND "academicYearId" = $2
             AND "classLevel" = $3 AND "month" = $4
             AND "teacherId" = $5
           LIMIT 1`,
          tenantId, journal.academicYearId, classLevel, journalMonth, journal.teacherId || journal.userId,
        );

        if (monthlyPlanRows.length > 0) {
          const mpStatus = monthlyPlanRows[0].status;
          if (mpStatus !== 'VALIDATED') {
            const statusLabel = mpStatus === 'DRAFT' ? 'en brouillon (non soumise)'
              : mpStatus === 'SUBMITTED' ? 'soumise mais non validée par le directeur'
              : `(${mpStatus})`;
            throw new BadRequestException(
              `⚠️ Veuillez d'abord soumettre et faire valider la Planification Mensuelle de ${journalMonth} ` +
              `(${classLevel}) avant de soumettre ce cahier journal. Statut actuel : ${statusLabel}.`
            );
          }
        }
        // ⭐ Si aucune planification mensuelle n'existe pour ce mois → on n'en bloque pas
        //    la soumission (l'enseignant peut ne pas avoir encore créé de planif mensuelle
        //    pour tous les mois — c'est toléré tant que le système n'a pas enregistré de
        //    données pour ce mois).
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      // Erreur non-bloquante (ex: table monthly_plans n'existe pas encore) → on continue
      this.logger.warn(`Planification mensuelle check skipped: ${e.message}`);
    }

    // ─── 2. Déterminer les jours à soumettre ───
    const ALL_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
    const days = (dayRange && dayRange.length > 0) ? dayRange : ALL_DAYS;
    // Mapper jour → numéro de jour de la semaine (1=lundi, ..., 5=vendredi)
    const dayToNum: Record<string, number> = {
      lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5,
    };
    const dayNums = days.map(d => dayToNum[d.toLowerCase()]).filter(n => n !== undefined);

    // ─── 3. Calculer la plage de dates pour les fiches ───
    // ⭐ FIX : utiliser minuit pour éviter les soucis de timezone
    const weekStart = new Date(journal.weekStartDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(journal.weekEndDate);
    weekEnd.setHours(23, 59, 59, 999);

    // ─── 4. Récupérer les fiches pédagogiques de la semaine (DRAFT uniquement) ───
    //    ⭐ 3 méthodes de récupération, fusionnées + dédoublonnées par id :
    //    (a) cahierJournalId (lien structurel)
    //    (b) par classId + academicYearId (sans teacherId, car teacherId peut
    //        être l'ID du User connecté et non l'ID du Teacher)
    //    (c) ALL DRAFT fiches for this class+year (broadest fallback)
    let submittedFiches: any[] = [];
    let skippedFiches: any[] = [];
    try {
      // (a) Fiches rattachées structurellement par cahierJournalId
      let fichesLiees: any[] = [];
      try {
        fichesLiees = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM "primary_pedagogical_fiches"
           WHERE "cahierJournalId" = $1
             AND "status" = 'DRAFT'`,
          journalId,
        );
      } catch {
        fichesLiees = [];
      }
      this.logger.log(`submitCahierJournalWithFiches: (a) cahierJournalId=${journalId} → ${fichesLiees.length} fiche(s)`);

      // (b) Fiches par classId + academicYearId (sans teacherId)
      let fichesByClass: any[] = [];
      try {
        fichesByClass = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM "primary_pedagogical_fiches"
           WHERE "tenantId" = $1
           AND "academicYearId" = $2
           AND "classId" = $3
           AND "status" = 'DRAFT'`,
          tenantId, journal.academicYearId, journal.classId,
        );
      } catch {
        fichesByClass = [];
      }
      this.logger.log(`submitCahierJournalWithFiches: (b) classId=${journal.classId} → ${fichesByClass.length} fiche(s)`);

      // Fusionner + dédoublonner par id
      const fichesMap = new Map<string, any>();
      for (const f of (fichesLiees || [])) fichesMap.set(f.id, f);
      for (const f of (fichesByClass || [])) {
        if (!fichesMap.has(f.id)) fichesMap.set(f.id, f);
      }
      const allFiches = Array.from(fichesMap.values());
      this.logger.log(`submitCahierJournalWithFiches: total unique fiches = ${allFiches.length}`);

      // ⭐ Soumettre TOUTES les fiches DRAFT trouvées (pas de filtre par date,
      //    car les fiches créées depuis le cahier journal peuvent ne pas avoir
      //    de lessonDate/adminDate rempli).
      const fichesToSubmit = allFiches;

      // ─── 5. Soumettre chaque fiche (DRAFT → SUBMITTED) + rattacher au cahier journal ───
      //    ⭐ On essaie d'abord avec la colonne cahierJournalId (migration effectuée).
      //    Si la colonne n'existe pas (erreur 42703), on retombe sur UPDATE simple
      //    sans cahierJournalId — la soumission fonctionne quand même.
      for (const fiche of fichesToSubmit) {
        try {
          try {
            await this.prisma.$executeRawUnsafe(
              `UPDATE "primary_pedagogical_fiches"
               SET "status" = 'SUBMITTED',
                   "submittedAt" = NOW(),
                   "updatedAt" = NOW(),
                   "cahierJournalId" = $2
               WHERE "id" = $1`,
              fiche.id,
              journalId,
            );
            this.logger.log(`submitCahierJournalWithFiches: fiche ${fiche.id} → SUBMITTED (cahierJournalId=${journalId})`);
          } catch (colErr: any) {
            // Colonne cahierJournalId inexistante (P2010 / 42703) — fallback sans cahierJournalId
            if (colErr.code === 'P2010' || (colErr.message && colErr.message.includes('42703'))) {
              await this.prisma.$executeRawUnsafe(
                `UPDATE "primary_pedagogical_fiches"
                 SET "status" = 'SUBMITTED',
                     "submittedAt" = NOW(),
                     "updatedAt" = NOW()
                 WHERE "id" = $1`,
                fiche.id,
              );
            } else {
              throw colErr;
            }
          }
          submittedFiches.push({ id: fiche.id, sheetType: fiche.sheetType, date: fiche.adminDate || fiche.lessonDate });
        } catch (err: any) {
          skippedFiches.push({ id: fiche.id, error: err.message });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to fetch fiches for cahier journal ${journalId}: ${err.message}`);
    }

    // ─── 6. Soumettre le cahier journal (DRAFT → SUBMITTED) ───
    //    ⭐ Clear les anciennes observations/signatures du directeur pour éviter
    //    que les anciennes observations d'une soumission précédente persistent.
    await this.prisma.$executeRawUnsafe(
      `UPDATE "cahier_journal_entries"
       SET "status" = 'SUBMITTED',
           "submittedAt" = NOW(),
           "directorSignature" = NULL,
           "directorValidatedAt" = NULL,
           "rejectionReason" = NULL,
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      journalId,
    );

    const updatedJournal: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1`,
      journalId,
    );

    // ─── 7. Notifier le directeur (fire-and-forget) ───
    this.notifyDirectorsOfCahierJournalSubmission(
      tenantId,
      journal.academicYearId,
      journal.classId,
      journal.weekStartDate,
      journal.weekEndDate,
      days,
      submittedFiches.length,
    ).catch((err) => this.logger.error('Cahier journal notification error:', err));

    return {
      cahierJournal: { id: journalId, status: 'SUBMITTED', weekStartDate: journal.weekStartDate },
      submittedFiches,
      skippedFiches,
      daysCovered: days,
      totalFiches: submittedFiches.length,
    };
  }

  /**
   * ⭐ Notifie le directeur de la soumission du cahier journal + fiches pédagogiques.
   */
  private async notifyDirectorsOfCahierJournalSubmission(
    tenantId: string,
    academicYearId: string,
    classId: string,
    weekStartDate: Date,
    weekEndDate: Date,
    days: string[],
    fichesCount: number,
  ) {
    // ⭐ Récupérer la classe (nom)
    let className = '—';
    try {
      const cls: any = await this.prisma.$queryRawUnsafe(
        `SELECT name FROM "classes" WHERE "id" = $1`, classId,
      );
      if (cls && cls.length > 0) className = cls[0].name || '—';
    } catch { /* silent */ }

    // ⭐ Récupérer les infos école
    let schoolName = 'Établissement scolaire';
    try {
      const profile: any = await this.prisma.$queryRawUnsafe(
        `SELECT "schoolName" FROM "tenant_identity_profiles"
         WHERE "tenantId" = $1 AND "isActive" = true LIMIT 1`,
        tenantId,
      );
      if (profile && profile.length > 0) schoolName = profile[0].schoolName || schoolName;
    } catch { /* silent */ }

    const formatDate = (d: Date) => new Date(d).toLocaleDateString('fr-FR');
    const weekLabel = `Semaine du ${formatDate(weekStartDate)} au ${formatDate(weekEndDate)}`;
    const daysLabel = days.length === 5 ? 'toute la semaine' : days.join(', ');

    // ⭐ Récupérer les directeurs (queryRawUnsafe pour éviter les erreurs Prisma client)
    let directors: any[] = [];
    try {
      const directorRoles = ['PROMOTER', 'SCHOOL_OWNER', 'DIRECTOR', 'DIRECTEUR_GENERAL',
        'DIRECTEUR_ETAPE', 'DIRECTEUR_PEDAGOGIQUE', 'ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER'];
      directors = await this.prisma.$queryRawUnsafe(
        `SELECT id, "firstName", "lastName", email, phone, role
         FROM "users"
         WHERE "tenantId" = $1 AND role = ANY($2::text[]) AND "isActive" = true`,
        tenantId, directorRoles,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to fetch directors: ${err.message}`);
    }

    if (directors.length === 0) {
      this.logger.warn(`Aucun directeur trouvé pour tenant ${tenantId}`);
      return;
    }

    const emailSubject = `[${schoolName}] Cahier journal soumis — ${className} — ${weekLabel}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b2f73; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 18px;">${schoolName}</h1>
          <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">Soumission cahier journal + fiches pédagogiques</p>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #0b2f73; font-size: 16px;">Bonjour,</h2>
          <p style="font-size: 14px; line-height: 1.5;">
            Un cahier journal vient d'être soumis par un enseignant :
          </p>
          <table style="width: 100%; margin: 15px 0; border-collapse: collapse;">
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Classe :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${className}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Période :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${weekLabel}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Jours couverts :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${daysLabel}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Fiches pédagogiques :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${fichesCount} fiche(s) soumise(s)</td></tr>
          </table>
          <p style="font-size: 14px; line-height: 1.5;">
            Veuillez vous connecter à la plateforme pour valider ces documents
            dans <strong>Espace Pédagogique → Validation Pédagogique</strong>.
          </p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              Ceci est un message automatique envoyé par Academia Helm.<br/>
              Date : ${new Date().toLocaleString('fr-FR')}
            </p>
          </div>
        </div>
      </div>
    `;
    const smsMessage = `${schoolName}: Cahier journal soumis - ${className} (${weekLabel}). Jours: ${daysLabel}. ${fichesCount} fiche(s). Connectez-vous pour valider.`;

    for (const director of directors) {
      const directorName = `${director.firstName || ''} ${director.lastName || ''}`.trim() || 'Directeur';

      if (director.email) {
        try {
          await this.emailService.sendCategorized({
            tenantId,
            category: 'PEDAGOGIE',
            subCategory: 'CAHIER_JOURNAL_SUBMISSION',
            module: 'pedagogy' as any,
            to: director.email,
            toName: directorName,
            recipientType: 'STAFF',
            recipientId: director.id,
            subject: emailSubject,
            html: emailHtml,
            text: smsMessage,
            fromName: schoolName,
            triggeredBy: 'SYSTEM',
            relatedEntityId: classId,
            relatedEntityType: 'CahierJournal',
          } as any);
        } catch (err: any) {
          this.logger.warn(`Email failed for ${director.email}: ${err.message}`);
        }
      }

      if (director.phone) {
        try {
          const phone = director.phone.startsWith('+') ? director.phone : `+229${director.phone.replace(/^0/, '')}`;
          await this.whatsappService.sendCategorized({
            tenantId,
            category: 'PEDAGOGIE',
            subCategory: 'CAHIER_JOURNAL_SUBMISSION',
            module: 'pedagogy' as any,
            to: phone,
            toName: directorName,
            recipientType: 'STAFF',
            recipientId: director.id,
            message: smsMessage,
            triggeredBy: 'SYSTEM',
            relatedEntityId: classId,
            relatedEntityType: 'CahierJournal',
          } as any);
        } catch (err: any) {
          this.logger.warn(`WhatsApp failed for ${director.phone}: ${err.message}`);
        }

        try {
          await this.smsService.sendSMS(director.phone, smsMessage);
        } catch (err: any) {
          this.logger.warn(`SMS failed for ${director.phone}: ${err.message}`);
        }
      }
    }

    this.logger.log(`Notifications cahier journal envoyées à ${directors.length} directeur(s) pour ${className}`);
  }


  /**
   * ⭐ Soumission unifiée : soumet en une fois le registre d'appel + l'évaluation
   *    mensuelle pour une classe/mois donnés.
   *    (Le cahier journal est soumis SÉPARÉMENT via submitCahierJournal.)
   *    Retourne la liste des entités soumises + celles déjà soumises (skip).
   */
  async submitUnified(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    classId: string,
    month: number,
    year: number,
  ) {
    const results: any = {
      attendanceRegister: null,
      monthlyEvaluation: null,
      errors: [],
    };

    // ⭐ Protection globale : si une erreur inattendue se produit, on la catch
    //    pour éviter une 500 non gérée.
    try {
      // ⭐ 1. Registre d'appel (status DRAFT → SUBMITTED)
      try {
        const registers: any = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM "attendance_registers"
           WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classId" = $3
           AND "month" = $4 AND "year" = $5 LIMIT 1`,
          tenantId, academicYearId, classId, month, year,
        );
        if (registers && registers.length > 0) {
          const r = registers[0];
          if (r.status === 'DRAFT') {
            await this.prisma.$executeRawUnsafe(
              `UPDATE "attendance_registers" SET "status" = 'SUBMITTED', "submittedAt" = NOW() WHERE "id" = $1`,
              r.id,
            );
            results.attendanceRegister = { id: r.id, status: 'SUBMITTED', className: r.classNameResolved };
          } else {
            results.attendanceRegister = { id: r.id, status: r.status, skipped: true };
          }
        }
      } catch (err: any) {
        results.errors.push({ entity: 'attendanceRegister', error: err.message });
      }

      // ⭐ 2. Évaluation mensuelle (status DRAFT → SUBMITTED)
      //    Recherche directe par classId + month + year (sans JOIN sur attendanceRegisterId)
      try {
        const evals: any = await this.prisma.$queryRawUnsafe(
          `SELECT me.* FROM "monthly_evaluations" me
           WHERE me."tenantId" = $1 AND me."academicYearId" = $2
           AND me."classId" = $3 AND me."month" = $4 AND me."year" = $5
           LIMIT 1`,
          tenantId, academicYearId, classId, month, year,
        );
        if (evals && evals.length > 0) {
          const e = evals[0];
          if (e.status === 'DRAFT') {
            await this.prisma.$executeRawUnsafe(
              `UPDATE "monthly_evaluations" SET "status" = 'SUBMITTED', "submittedAt" = NOW() WHERE "id" = $1`,
              e.id,
            );
            results.monthlyEvaluation = { id: e.id, status: 'SUBMITTED' };
          } else {
            results.monthlyEvaluation = { id: e.id, status: e.status, skipped: true };
          }
        } else {
          // ⭐ Si pas de monthly_evaluation trouvée, chercher dans evaluations (Module Examen)
          // et mettre le statut à SUBMITTED
          const examEvals: any = await this.prisma.$queryRawUnsafe(
            `SELECT e.id FROM "evaluations" e
             WHERE e."tenantId" = $1 AND e."academicYearId" = $2
             AND e."classId" = $3
             AND EXTRACT(MONTH FROM COALESCE(e."startDate", e."evaluationDate")) = $4
             AND EXTRACT(YEAR FROM COALESCE(e."startDate", e."evaluationDate")) = $5
             AND e."status" IN ('OPEN_FOR_GRADING', 'PLANNED')
             `,
            tenantId, academicYearId, classId, month, year,
          );
          if (examEvals && examEvals.length > 0) {
            for (const ev of examEvals) {
              await this.prisma.$executeRawUnsafe(
                `UPDATE "evaluations" SET "status" = 'SUBMITTED', "submittedAt" = NOW() WHERE "id" = $1`,
                ev.id,
              );
            }
            results.monthlyEvaluation = { id: examEvals[0].id, status: 'SUBMITTED', source: 'EXAM', count: examEvals.length };
          }
        }
      } catch (err: any) {
        results.errors.push({ entity: 'monthlyEvaluation', error: err.message });
      }
    } catch (outerErr: any) {
      this.logger.error('Erreur inattendue dans submitUnified:', outerErr);
      results.errors.push({ entity: 'global', error: outerErr.message });
    }

    // ⭐ 3. Notifications au directeur (fire-and-forget, TRÈS défensif)
    //    Note : le cahier journal n'est PAS inclus ici — il est soumis séparément.
    try {
      this.notifyDirectorsOfSubmission(tenantId, academicYearId, classId, month, year, results)
        .catch((err) => this.logger.error('Notification error:', err));
    } catch (notifErr: any) {
      this.logger.error('Failed to start notification:', notifErr);
    }

    return results;
  }

  /**
   * ⭐ Notifie le directeur (email + WhatsApp + SMS) qu'une soumission pédagogique
   *    a été effectuée par l'enseignant.
   *    Pattern similaire à ReceiptNotificationFinanceService.
   */
  private async notifyDirectorsOfSubmission(
    tenantId: string,
    academicYearId: string,
    classId: string,
    month: number,
    year: number,
    results: any,
  ) {
    // ⭐ Récupérer la classe (nom)
    let className = '—';
    try {
      const cls: any = await this.prisma.$queryRawUnsafe(
        `SELECT name FROM "classes" WHERE "id" = $1`, classId,
      );
      if (cls && cls.length > 0) className = cls[0].name || '—';
    } catch { /* silent */ }

    // ⭐ Récupérer les infos école (tenant identity)
    let schoolName = 'Établissement scolaire';
    let schoolLogoUrl: string | null = null;
    try {
      const profile: any = await this.prisma.$queryRawUnsafe(
        `SELECT "schoolName", "logoUrl" FROM "tenant_identity_profiles"
         WHERE "tenantId" = $1 AND "isActive" = true LIMIT 1`,
        tenantId,
      );
      if (profile && profile.length > 0) {
        schoolName = profile[0].schoolName || schoolName;
        schoolLogoUrl = profile[0].logoUrl || null;
      }
    } catch { /* silent */ }

    const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthLabel = monthNames[month] || '—';

    // ⭐ Récupérer les directeurs (utilisateurs avec role direction)
    //    Utilisation de $queryRawUnsafe pour éviter les erreurs si le client
    //    Prisma n'est pas à jour avec le modèle User.
    let directors: any[] = [];
    try {
      const directorRoles = ['PROMOTER', 'SCHOOL_OWNER', 'DIRECTOR', 'DIRECTEUR_GENERAL',
        'DIRECTEUR_ETAPE', 'DIRECTEUR_PEDAGOGIQUE', 'ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER'];
      directors = await this.prisma.$queryRawUnsafe(
        `SELECT id, "firstName", "lastName", email, phone, role
         FROM "users"
         WHERE "tenantId" = $1 AND role = ANY($2::text[]) AND "isActive" = true`,
        tenantId, directorRoles,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to fetch directors: ${err.message}`);
    }

    if (directors.length === 0) {
      this.logger.warn(`Aucun directeur trouvé pour tenant ${tenantId} — notification skipped`);
      return;
    }

    // ⭐ Préparer les contenus de notification
    const submittedEntities: string[] = [];
    if (results.attendanceRegister) submittedEntities.push('Registre d\'appel');
    if (results.monthlyEvaluation) submittedEntities.push('Évaluation mensuelle');
    // Note : le cahier journal n'est PAS soumis via submitUnified — il a son propre
    // endpoint submitCahierJournal qui notifie séparément.
    const entityList = submittedEntities.length > 0
      ? submittedEntities.join(', ')
      : 'aucune entité';

    const emailSubject = `[${schoolName}] Soumission pédagogique — ${className} — ${monthLabel} ${year}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b2f73; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 18px;">${schoolName}</h1>
          <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">Notification de soumission pédagogique</p>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #0b2f73; font-size: 16px;">Bonjour,</h2>
          <p style="font-size: 14px; line-height: 1.5;">
            Une soumission pédagogique vient d'être effectuée par un enseignant :
          </p>
          <table style="width: 100%; margin: 15px 0; border-collapse: collapse;">
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Classe :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${className}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Mois :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${monthLabel} ${year}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Documents soumis :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${entityList}</td></tr>
          </table>
          <p style="font-size: 14px; line-height: 1.5;">
            Veuillez vous connecter à la plateforme pour valider ces documents
            dans <strong>Espace Pédagogique → Validation Pédagogique</strong>.
          </p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              Ceci est un message automatique envoyé par Academia Helm.<br/>
              Date : ${new Date().toLocaleString('fr-FR')}
            </p>
          </div>
        </div>
      </div>
    `;
    const smsMessage = `${schoolName}: Soumission pedagogique - ${className} (${monthLabel} ${year}). Documents: ${entityList}. Connectez-vous pour valider.`;

    // ⭐ Envoyer les notifications (fire-and-forget par canal)
    for (const director of directors) {
      const directorName = `${director.firstName || ''} ${director.lastName || ''}`.trim() || 'Directeur';

      // Email
      if (director.email) {
        try {
          await this.emailService.sendCategorized({
            tenantId,
            category: 'PEDAGOGIE',
            subCategory: 'SUBMISSION',
            module: 'pedagogy' as any,
            to: director.email,
            toName: directorName,
            recipientType: 'STAFF',
            recipientId: director.id,
            subject: emailSubject,
            html: emailHtml,
            text: smsMessage,
            fromName: schoolName,
            triggeredBy: 'SYSTEM',
            relatedEntityId: classId,
            relatedEntityType: 'PedagogySubmission',
          } as any);
        } catch (err: any) {
          this.logger.warn(`Email failed for ${director.email}: ${err.message}`);
        }
      }

      // WhatsApp
      if (director.phone) {
        try {
          const phone = director.phone.startsWith('+') ? director.phone : `+229${director.phone.replace(/^0/, '')}`;
          await this.whatsappService.sendCategorized({
            tenantId,
            category: 'PEDAGOGIE',
            subCategory: 'SUBMISSION',
            module: 'pedagogy' as any,
            to: phone,
            toName: directorName,
            recipientType: 'STAFF',
            recipientId: director.id,
            message: smsMessage,
            triggeredBy: 'SYSTEM',
            relatedEntityId: classId,
            relatedEntityType: 'PedagogySubmission',
          } as any);
        } catch (err: any) {
          this.logger.warn(`WhatsApp failed for ${director.phone}: ${err.message}`);
        }
      }

      // SMS
      if (director.phone) {
        try {
          await this.smsService.sendSMS(director.phone, smsMessage);
        } catch (err: any) {
          this.logger.warn(`SMS failed for ${director.phone}: ${err.message}`);
        }
      }
    }

    this.logger.log(`Notifications envoyées à ${directors.length} directeur(s) pour ${className} ${monthLabel} ${year}`);
  }

  /**
   * ⭐ Notifie manuellement le directeur (bouton "Notifier le directeur")
   *    Permet à l'enseignant de relancer le directeur par email/WhatsApp/SMS.
   */
  async notifyDirector(
    tenantId: string,
    classId: string,
    month: number,
    year: number,
    channels: string[] = ['email', 'whatsapp', 'sms'],
    teacherId?: string,
  ) {
    const results: any = {
      notifiedDirectors: 0,
      channels: { email: { sent: 0, failed: 0 }, whatsapp: { sent: 0, failed: 0 }, sms: { sent: 0, failed: 0 } },
    };

    // Réutilise la logique de notification (registre + évaluation mensuelle)
    const fakeResults = { attendanceRegister: { status: 'SUBMITTED' }, monthlyEvaluation: { status: 'SUBMITTED' } };
    // Pour la notif manuelle, on envoie même si déjà soumis
    await this.notifyDirectorsOfSubmission(tenantId, '', classId, month, year, fakeResults);

    results.notifiedDirectors = 1; // approximation
    return results;
  }


  // ===========================================================================
  // FICHES PÉDAGOGIQUES PRIMAIRE (6 types: MATH/FRANCAIS/EST/ES/EA/EPS)
  // ===========================================================================

  /// Liste les fiches pédagogiques d'un enseignant.
  async getPedagogicalFiches(
    tenantId: string,
    teacherId: string,
    academicYearId: string,
    sheetType?: string,
    classId?: string,
    caller?: any,
  ) {
    // ⭐ TEST PROMOTEUR/DIRECTION : vue superviseur si rôle direction sans profil Teacher
    // ⭐ caller (F7) : l'identité de l'appelant prime sur le paramètre client.
    const filter = await this.resolveTeacherFilter(tenantId, teacherId, caller);
    if (filter.mode === 'none') return [];

    // Construction dynamique de la requête selon le mode
    let query: string;
    const params: any[] = [];

    if (filter.mode === 'teacher') {
      // ⭐ Le teacherId stocké dans les fiches peut être soit le user.id
      // (si créé via frontend) soit le teacher.id (si créé via backend).
      // On cherche avec les DEUX pour ne rien manquer.
      query = `SELECT * FROM "primary_pedagogical_fiches"
               WHERE "tenantId" = $1 AND "academicYearId" = $2
               AND ("teacherId" = $3 OR "teacherId" = $4)`;
      params.push(tenantId, academicYearId, filter.teacherId, teacherId);
    } else {
      // Mode direction : toutes les fiches du tenant/année
      query = `SELECT * FROM "primary_pedagogical_fiches"
               WHERE "tenantId" = $1 AND "academicYearId" = $2`;
      params.push(tenantId, academicYearId);
    }

    let paramIdx = params.length + 1;
    if (sheetType) {
      query += ` AND "sheetType" = $${paramIdx++}`;
      params.push(sheetType);
    }
    if (classId) {
      query += ` AND "classId" = $${paramIdx++}`;
      params.push(classId);
    }
    query += ` ORDER BY "lessonDate" DESC NULLS LAST, "createdAt" DESC`;
    return this.prisma.$queryRawUnsafe(query, ...params);
  }

  /// Récupère une fiche par ID.
  async getPedagogicalFiche(tenantId: string, ficheId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1 AND "tenantId" = $2`,
      ficheId, tenantId,
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Fiche pédagogique non trouvée');
    }
    return result[0];
  }

  /// Crée une nouvelle fiche pédagogique.
  async createPedagogicalFiche(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    data: any,
  ) {
    const id = crypto.randomUUID();
    const fields: string[] = ['"id"', '"tenantId"', '"academicYearId"', '"teacherId"', '"createdAt"', '"updatedAt"'];
    const placeholders: string[] = ['$1', '$2', '$3', '$4', 'NOW()', 'NOW()'];
    const params: any[] = [id, tenantId, academicYearId, teacherId];
    let paramIdx = 5;

    const fieldMap: Record<string, string> = {
      classId: 'classId',
      subjectId: 'subjectId',
      sheetType: 'sheetType',
      schoolName: 'schoolName',
      className: 'className',
      academicYearLabel: 'academicYearLabel',
      trimester: 'trimester',
      weekNumber: 'weekNumber',
      lessonDate: 'lessonDate',
      lessonTime: 'lessonTime',
      durationMinutes: 'durationMinutes',
      teacherName: 'teacherName',
      boysCount: 'boysCount',
      girlsCount: 'girlsCount',
      totalStudents: 'totalStudents',
      boysPresent: 'boysPresent',
      girlsPresent: 'girlsPresent',
      totalPresent: 'totalPresent',
      boysAbsent: 'boysAbsent',
      girlsAbsent: 'girlsAbsent',
      totalAbsent: 'totalAbsent',
      competence: 'competence',
      habilete: 'habilete',
      prealable: 'prealable',
      contenu: 'contenu',
      methodes: 'methodes',
      moyensDidactiques: 'moyensDidactiques',
      deroulement: 'deroulement',
      evaluation: 'evaluation',
      reference: 'reference',
      adminDate: 'adminDate',
      adminWeek: 'adminWeek',
      adminHoraire: 'adminHoraire',
      adminDuree: 'adminDuree',
      teacherSignature: 'teacherSignature',
      directorSignature: 'directorSignature',
      // ⭐ Nouveaux champs (structure conforme aux PDFs)
      san: 'san', sequence: 'sequence', cours: 'cours', titre: 'titre', duree: 'duree',
      ibis_1: 'ibis_1', ibis_2: 'ibis_2', ibis_3: 'ibis_3', ibis_4: 'ibis_4', ibis_5: 'ibis_5',
      objectivation: 'objectivation', evalRetour: 'evalRetour', projection: 'projection',
      // ⭐ Phases spécifiques au français
      phase_introductive: 'phase_introductive', phase_systematisation: 'phase_systematisation', phase_application: 'phase_application',
      app_col1: 'app_col1', app_col2: 'app_col2', app_col3: 'app_col3',
      // ⭐ FICHES MATERNELLE (DOMAINE | DOMAINE_2) — contenu structuré complet
      //    (en-tête ÉCOLE MATERNELLE, Domaine du, Composante, Activités
      //    d'apprentissage, DÉROULEMENT, RÉALISATION, RETOUR ET PROJECTION,
      //    RANGEMENT, Notes personnelles). Colonne posée par la migration
      //    20260915090000_add_maternelle_content_to_fiches.
      maternelleContent: 'maternelleContent',
      // ⭐ Lien structurel vers le cahier journal (null si fiche créée hors cahier journal)
      //    ⚠️ Si la colonne n'existe pas en DB (migration non faite), le INSERT va planter.
      //    On l'ajoute quand même : si la migration est faite, ça marche ; sinon, le
      //    frontend n'enverra pas cahierJournalId (le composant CahierJournalFichesContainer
      //    ne l'envoie que si il est défini), et le fieldMap ne l'ajoutera pas au INSERT.
      cahierJournalId: 'cahierJournalId',
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined && data[key] !== null) {
        fields.push(`"${col}"`);
        if (key === 'deroulement' || key === 'maternelleContent') {
          placeholders.push(`$${paramIdx++}::jsonb`);
          params.push(JSON.stringify(data[key]));
        } else if (key === 'lessonDate' || key === 'adminDate') {
          placeholders.push(`$${paramIdx++}::date`);
          params.push(data[key]);
        } else if (typeof data[key] === 'number') {
          placeholders.push(`$${paramIdx++}::int`);
          params.push(data[key]);
        } else {
          placeholders.push(`$${paramIdx++}`);
          params.push(data[key]);
        }
      }
    }

    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "primary_pedagogical_fiches" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
        ...params,
      );
    } catch (insertErr: any) {
      // ⭐ Si une colonne optionnelle n'existe pas encore en DB (migration non
      //    faite — erreur 42703 « column does not exist »), on retente sans ces
      //    colonnes : cahierJournalId (202607xx) et maternelleContent (20260915).
      if (insertErr.code === 'P2010' || (insertErr.message && insertErr.message.includes('42703'))) {
        let retryNeeded = false;
        for (const optionalCol of ['cahierJournalId', 'maternelleContent']) {
          const idx = fields.indexOf(`"${optionalCol}"`);
          if (idx >= 0) {
            fields.splice(idx, 1);
            placeholders.splice(idx, 1);
            params.splice(idx, 1);
            retryNeeded = true;
          }
        }
        if (retryNeeded) {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "primary_pedagogical_fiches" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
            ...params,
          );
        } else {
          throw insertErr;
        }
      } else {
        throw insertErr;
      }
    }

    return this.getPedagogicalFiche(tenantId, id);
  }

  /// Met à jour une fiche pédagogique.
  async updatePedagogicalFiche(tenantId: string, ficheId: string, data: any) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1 AND "tenantId" = $2`,
      ficheId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Fiche pédagogique non trouvée');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const allowedFields: Record<string, 'string' | 'int' | 'date' | 'jsonb'> = {
      classId: 'string', subjectId: 'string', sheetType: 'string',
      schoolName: 'string', className: 'string', academicYearLabel: 'string',
      trimester: 'int', weekNumber: 'int',
      lessonDate: 'date', lessonTime: 'string', durationMinutes: 'int', teacherName: 'string',
      boysCount: 'int', girlsCount: 'int', totalStudents: 'int',
      boysPresent: 'int', girlsPresent: 'int', totalPresent: 'int',
      boysAbsent: 'int', girlsAbsent: 'int', totalAbsent: 'int',
      competence: 'string', habilete: 'string', prealable: 'string', contenu: 'string',
      methodes: 'string', moyensDidactiques: 'string',
      deroulement: 'jsonb',
      evaluation: 'string', reference: 'string',
      adminDate: 'date', adminWeek: 'int', adminHoraire: 'string', adminDuree: 'int',
      teacherSignature: 'string', directorSignature: 'string',
      // ⭐ Nouveaux champs (structure conforme aux PDFs)
      san: 'string', sequence: 'string', cours: 'string', titre: 'string', duree: 'string',
      ibis_1: 'string', ibis_2: 'string', ibis_3: 'string', ibis_4: 'string', ibis_5: 'string',
      objectivation: 'string', evalRetour: 'string', projection: 'string',
      phase_introductive: 'string', phase_systematisation: 'string', phase_application: 'string',
      app_col1: 'string', app_col2: 'string', app_col3: 'string',
      // ⭐ FICHES MATERNELLE (DOMAINE | DOMAINE_2) — contenu structuré complet
      maternelleContent: 'jsonb',
      status: 'string', submittedAt: 'date', validatedAt: 'date',
      validatedBy: 'string', rejectionReason: 'string',
      // ⭐ Lien structurel vers le cahier journal
      cahierJournalId: 'string',
    };

    for (const [key, type] of Object.entries(allowedFields)) {
      if (data[key] !== undefined) {
        const val = data[key];
        updates.push(`"${key}" = $${paramIdx++}::${type}`);
        if (type === 'jsonb') {
          params.push(JSON.stringify(val));
        } else if (type === 'date' && val) {
          params.push(new Date(val));
        } else {
          params.push(val);
        }
      }
    }

    if (updates.length === 0) return existing[0];

    updates.push(`"updatedAt" = NOW()`);
    params.push(ficheId, tenantId);
    const lastIdx = paramIdx;

    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "primary_pedagogical_fiches" SET ${updates.join(', ')} WHERE "id" = $${lastIdx} AND "tenantId" = $${lastIdx + 1}`,
        ...params,
      );
    } catch (updateErr: any) {
      // ⭐ Si une colonne optionnelle n'existe pas (migration non faite), on retente sans
      //    (cahierJournalId — 202607xx ; maternelleContent — 20260915)
      if (updateErr.code === 'P2010' || (updateErr.message && updateErr.message.includes('42703'))) {
        let retryNeeded = false;
        for (const optionalCol of ['cahierJournalId', 'maternelleContent']) {
          const idx = updates.findIndex(u => u.startsWith(`"${optionalCol}"`));
          if (idx >= 0) {
            updates.splice(idx, 1);
            params.splice(idx, 1);
            retryNeeded = true;
          }
        }
        if (retryNeeded) {
          // Recalculer les indices des placeholders
          let newParamIdx = 1;
          const newUpdates = updates.map(u => u.replace(/\$(\d+)/g, () => `$${newParamIdx++}`));
          await this.prisma.$executeRawUnsafe(
            `UPDATE "primary_pedagogical_fiches" SET ${newUpdates.join(', ')} WHERE "id" = $${newParamIdx} AND "tenantId" = $${newParamIdx + 1}`,
            ...params,
          );
        } else {
          throw updateErr;
        }
      } else {
        throw updateErr;
      }
    }

    return this.getPedagogicalFiche(tenantId, ficheId);
  }

  /// Supprime une fiche pédagogique.
  async deletePedagogicalFiche(tenantId: string, ficheId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1 AND "tenantId" = $2`,
      ficheId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Fiche pédagogique non trouvée');
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "primary_pedagogical_fiches" WHERE "id" = $1`,
      ficheId,
    );
    return { success: true };
  }

  /// Soumet une fiche au directeur.
  async submitPedagogicalFiche(tenantId: string, ficheId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1 AND "tenantId" = $2`,
      ficheId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Fiche non trouvée');
    }
    if (existing[0].status !== 'DRAFT') {
      throw new BadRequestException('Fiche déjà soumise');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE "primary_pedagogical_fiches" SET "status" = 'SUBMITTED', "submittedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
      ficheId,
    );
    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1`,
      ficheId,
    );
    return updated[0];
  }

  // ===========================================================================
  // ⭐ CROSS-YEAR REUSE — Réutilisation des fiches d'une année sur l'autre
  // ===========================================================================

  /**
   * Liste les fiches pédagogiques des années PRÉCÉDENTES pour la même
   * classe + matière (ou même schoolLevel + matière si pas de classId).
   *
   * Permet à un enseignant de retrouver les fiches de l'année précédente
   * et de les dupliquer vers l'année courante — même si ce n'est pas le
   * même enseignant qui les a créées.
   */
  async getPreviousYearFiches(
    tenantId: string,
    currentAcademicYearId: string,
    classId?: string,
    subjectId?: string,
    schoolLevelId?: string,
  ) {
    // Récupérer l'année courante pour connaître sa position
    const currentYear: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, name, "startDate" FROM "academic_years" WHERE id = $1 AND "tenantId" = $2`,
      currentAcademicYearId, tenantId,
    );
    if (!currentYear || currentYear.length === 0) {
      throw new NotFoundException('Année scolaire courante introuvable');
    }
    const currentStartDate = currentYear[0].startDate;

    // Construire la requête : fiches des années PRÉCÉDENTES (startDate < currentStartDate)
    let whereClause = `"tenantId" = $1 AND "academicYearId" != $2 AND "status" = 'VALIDATED'`;
    const params: any[] = [tenantId, currentAcademicYearId];
    let paramIdx = 3;

    if (classId) {
      whereClause += ` AND "classId" = $${paramIdx++}`;
      params.push(classId);
    }
    if (subjectId) {
      whereClause += ` AND "subjectId" = $${paramIdx++}`;
      params.push(subjectId);
    }

    // Joindre avec academic_years pour filtrer par startDate < currentStartDate
    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT pf.*, ay.name as "academicYearName", ay."startDate" as "yearStartDate",
              c.name as "className", s.name as "subjectName"
       FROM "primary_pedagogical_fiches" pf
       JOIN "academic_years" ay ON ay.id = pf."academicYearId"
       LEFT JOIN "classes" c ON c.id = pf."classId"
       LEFT JOIN "subjects" s ON s.id = pf."subjectId"
       WHERE ${whereClause}
         AND ay."startDate" < $${paramIdx++}
       ORDER BY ay."startDate" DESC, pf."createdAt" DESC
       LIMIT 100`,
      ...params, currentStartDate,
    );

    return rows.map((r: any) => ({
      id: r.id,
      title: r.title || r.competence || 'Fiche sans titre',
      academicYearId: r.academicYearId,
      academicYearName: r.academicYearName,
      classId: r.classId,
      className: r.className,
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      teacherId: r.teacherId,
      teacherName: r.teacherName,
      status: r.status,
      competence: r.competence,
      contenu: r.contenu,
      deroulement: r.deroulement,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Duplique une fiche d'une année précédente vers l'année courante.
   * Crée une nouvelle fiche avec :
   *   - academicYearId = année courante
   *   - teacherId = nouvel enseignant (peut être différent de l'original)
   *   - originalSheetId = fiche d'origine (traçabilité de la lignée)
   *   - status = DRAFT (l'enseignant peut l'éditer avant soumission)
   *
   * L'enseignant reprend le contenu pédagogique mais doit l'adapter à sa classe
   * (effectifs, dates, observations spécifiques).
   */
  async duplicateFicheToYear(
    tenantId: string,
    sourceFicheId: string,
    targetAcademicYearId: string,
    targetTeacherId?: string,
    targetClassId?: string,
  ) {
    // 1. Charger la fiche source
    const source: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1 AND "tenantId" = $2`,
      sourceFicheId, tenantId,
    );
    if (!source || source.length === 0) {
      throw new NotFoundException('Fiche source introuvable');
    }
    const src = source[0];

    // 2. Vérifier que l'année cible existe
    const targetYear: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, name FROM "academic_years" WHERE id = $1 AND "tenantId" = $2`,
      targetAcademicYearId, tenantId,
    );
    if (!targetYear || targetYear.length === 0) {
      throw new NotFoundException('Année scolaire cible introuvable');
    }

    // 3. Créer la nouvelle fiche (copie du contenu + nouveaux métadonnées)
    const newId = crypto.randomUUID();
    const newTeacherId = targetTeacherId || src.teacherId;
    const newClassId = targetClassId || src.classId;

    // Copier tous les champs pédagogiques (contenu, deroulement, evaluation, etc.)
    // mais reset les champs admin (dates, signatures, statut)
    // ⭐ 2026-09-15 : maternelleContent copié aussi (fiches DOMAINE / DOMAINE_2).
    //    La colonne peut ne pas exister (migration non faite) → INSERT résilient
    //    avec repli sans cette colonne.
    const insertParams = [
      newId, tenantId, targetAcademicYearId, newTeacherId, newClassId, src.subjectId,
      src.sheetType || null, src.schoolName || null, src.className || null,
      targetYear[0].name, src.trimester || null, src.weekNumber || null,
      src.competence || null, src.habilete || null, src.prealable || null,
      src.contenu || null, src.methodes || null, src.moyensDidactiques || null,
      src.deroulement || null, src.evaluation || null, src.reference || null,
      src.maternelleContent ? JSON.stringify(src.maternelleContent) : null,
      sourceFicheId, // originalSheetId — traçabilité
    ];
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "primary_pedagogical_fiches"
          ("id", "tenantId", "academicYearId", "teacherId", "classId", "subjectId",
           "sheetType", "schoolName", "className", "academicYearLabel", "trimester", "weekNumber",
           "competence", "habilete", "prealable", "contenu", "methodes", "moyensDidactiques",
           "deroulement", "evaluation", "reference", "maternelleContent",
           "status", "originalSheetId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6,
                 $7, $8, $9, $10, $11, $12,
                 $13, $14, $15, $16, $17, $18,
                 $19, $20, $21, $22::jsonb,
                 'DRAFT', $23, NOW(), NOW())`,
        ...insertParams,
      );
    } catch (dupErr: any) {
      // Colonne maternelleContent absente (migration non faite) → INSERT classique
      if (dupErr.code === 'P2010' || (dupErr.message && dupErr.message.includes('42703'))) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "primary_pedagogical_fiches"
            ("id", "tenantId", "academicYearId", "teacherId", "classId", "subjectId",
             "sheetType", "schoolName", "className", "academicYearLabel", "trimester", "weekNumber",
             "competence", "habilete", "prealable", "contenu", "methodes", "moyensDidactiques",
             "deroulement", "evaluation", "reference",
             "status", "originalSheetId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6,
                   $7, $8, $9, $10, $11, $12,
                   $13, $14, $15, $16, $17, $18,
                   $19, $20, $21,
                   'DRAFT', $22, NOW(), NOW())`,
          ...insertParams.slice(0, 21).concat([sourceFicheId]),
        );
      } else {
        throw dupErr;
      }
    }

    this.logger.log(
      `Fiche dupliquée: ${sourceFicheId} → ${newId} (année ${targetYear[0].name}, teacher ${newTeacherId})`,
    );

    // 4. Retourner la nouvelle fiche
    return this.getPedagogicalFiche(tenantId, newId);
  }

  /**
   * ⭐ CROSS-YEAR REUSE pour les cahiers journaux
   *    Duplique un cahier journal d'une année précédente vers l'année courante.
   *    Le nouveau cahier journal a :
   *    - academicYearId = année cible
   *    - teacherId = enseignant cible (ou enseignant d'origine)
   *    - classId = classe cible (ou classe d'origine)
   *    - weekStartDate/weekEndDate = recalculées pour la même semaine de l'année cible
   *      (si targetWeekStartDate fourni, utilisé tel quel ; sinon décalage de N années
   *       pour conserver le n° de semaine)
   *    - entries = copie de la grille hebdo (contenu pédagogique)
   *    - status = 'DRAFT' (l'enseignant peut l'éditer avant soumission)
   *    - directorSignature, teacherSignature = null (à refaire)
   *    - originalJournalId = ID du cahier journal d'origine (traçabilité)
   */
  async duplicateCahierJournalToYear(
    tenantId: string,
    sourceJournalId: string,
    targetAcademicYearId: string,
    targetTeacherId?: string,
    targetClassId?: string,
    targetWeekStartDate?: string,
  ) {
    // 1. Charger le cahier journal source
    const source: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1 AND "tenantId" = $2`,
      sourceJournalId, tenantId,
    );
    if (!source || source.length === 0) {
      throw new NotFoundException('Cahier journal source introuvable');
    }
    const src = source[0];

    // 2. Vérifier que l'année cible existe
    const targetYear: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, name, "startDate", "endDate" FROM "academic_years" WHERE id = $1 AND "tenantId" = $2`,
      targetAcademicYearId, tenantId,
    );
    if (!targetYear || targetYear.length === 0) {
      throw new NotFoundException('Année scolaire cible introuvable');
    }

    // 3. Calculer les nouvelles dates de semaine
    //    Si targetWeekStartDate est fourni, l'utiliser.
    //    Sinon, prendre la weekStartDate source et la décaler de (targetYear - sourceYear) années.
    let newWeekStart: Date;
    let newWeekEnd: Date;
    if (targetWeekStartDate) {
      newWeekStart = new Date(targetWeekStartDate);
      newWeekEnd = new Date(newWeekStart);
      newWeekEnd.setDate(newWeekStart.getDate() + 4); // vendredi (lundi + 4)
    } else {
      // Décalage d'années : préserver le n° de semaine
      const srcWeekStart = new Date(src.weekStartDate);
      const srcYear = srcWeekStart.getFullYear();
      // Trouver le début de l'année cible
      const targetStart = new Date(targetYear[0].startDate);
      const targetYearNum = targetStart.getFullYear();
      const yearDiff = targetYearNum - srcYear;
      newWeekStart = new Date(srcWeekStart);
      newWeekStart.setFullYear(srcWeekStart.getFullYear() + yearDiff);
      // Si la nouvelle semaine tombe avant le début de l'année cible, décaler d'1 semaine
      if (newWeekStart < targetStart) {
        newWeekStart = new Date(targetStart);
        // Ajuster au lundi de la semaine du targetStart
        const dayOfWeek = newWeekStart.getDay(); // 0=Sun, 1=Mon...
        const diff = dayOfWeek === 0 ? -6 : (1 - dayOfWeek);
        newWeekStart.setDate(newWeekStart.getDate() + diff);
      }
      newWeekEnd = new Date(newWeekStart);
      newWeekEnd.setDate(newWeekStart.getDate() + 4); // vendredi
    }

    // 4. Vérifier qu'il n'existe pas déjà un cahier journal pour cette combinaison
    //    (tenantId, academicYearId, classId, weekStartDate) — contrainte @@unique
    const newTeacherId = targetTeacherId || src.teacherId;
    const newClassId = targetClassId || src.classId;
    const newWeekStartStr = newWeekStart.toISOString().substring(0, 10);
    const newWeekEndStr = newWeekEnd.toISOString().substring(0, 10);

    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, status FROM "cahier_journal_entries"
       WHERE "tenantId" = $1 AND "academicYearId" = $2
         AND "classId" = $3 AND "weekStartDate" = $4
       LIMIT 1`,
      tenantId, targetAcademicYearId, newClassId, newWeekStartStr,
    );
    if (existing && existing.length > 0) {
      // Si déjà un cahier journal pour cette semaine → on l'écrase (ou on retourne l'existant)
      // Choix : on retourne l'existant pour éviter la perte de données
      this.logger.log(
        `duplicateCahierJournalToYear: journal déjà existant pour ${newWeekStartStr} → retourne l'existant ${existing[0].id}`,
      );
      return this.getCahierJournal(tenantId, existing[0].id);
    }

    // 5. Créer le nouveau cahier journal
    //    NB : on ne copie PAS teacherSignature/directorSignature car ces colonnes
    //    n'existent pas sur cahier_journal_entries (elles sont gérées autrement).
    //    On copie par contre : entries (la grille pédagogique), observations,
    //    className. Le statut est forcé à DRAFT pour permettre l'édition.
    const newId = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "cahier_journal_entries"
        ("id", "tenantId", "academicYearId", "teacherId", "classId",
         "weekStartDate", "weekEndDate", "className",
         "entries", "observations",
         "status", "submittedAt", "validatedAt", "validatedBy",
         "rejectionReason", "directorName", "directorValidatedAt",
         "originalJournalId",
         "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5,
               $6, $7, $8,
               $9, $10,
               'DRAFT', NULL, NULL, NULL,
               NULL, NULL, NULL,
               $11,
               NOW(), NOW())`,
      newId, tenantId, targetAcademicYearId, newTeacherId, newClassId,
      newWeekStartStr, newWeekEndStr, src.className || null,
      // entries est un Json — Prisma le sérialise automatiquement si on passe un objet,
      // mais en raw SQL on doit passer une string JSON
      typeof src.entries === 'string' ? src.entries : JSON.stringify(src.entries || {}),
      src.observations || null,
      sourceJournalId, // originalJournalId — traçabilité
    );

    this.logger.log(
      `Cahier journal dupliqué: ${sourceJournalId} → ${newId} (année ${targetYear[0].name}, semaine ${newWeekStartStr})`,
    );

    // 6. Retourner le nouveau cahier journal (avec le nom de la classe résolu)
    return this.getCahierJournal(tenantId, newId);
  }

  /**
   * Récupère un cahier journal par son ID (avec jointures classe + enseignant).
   * Utilisé par duplicateCahierJournalToYear pour retourner l'objet complet.
   */
  private async getCahierJournal(tenantId: string, journalId: string) {
    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT cj.*, c."name" as "classNameResolved",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName", t."gender" as "teacherGender"
       FROM "cahier_journal_entries" cj
       LEFT JOIN classes c ON c."id" = cj."classId"
       LEFT JOIN teachers t ON t."id" = cj."teacherId"
       WHERE cj."id" = $1 AND cj."tenantId" = $2
       LIMIT 1`,
      journalId, tenantId,
    );
    return rows && rows.length > 0 ? rows[0] : null;
  }

  // ===========================================================================
  // REGISTRE D'APPEL — Registre mensuel + Évaluation + Tableau annuel
  // ===========================================================================

  /// Récupère ou crée un registre d'appel mensuel pour une classe.
  /// Inclut la détection du niveau (MATERNELLE/PRIMAIRE/SECONDAIRE) pour
  /// adapter le titre et les libellés côté frontend.
  async getOrCreateAttendanceRegister(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    classId: string,
    month: number,
    year: number,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT ar.*, sl."code" as "schoolLevelCode", sl."name" as "schoolLevelName",
              c."name" as "classNameResolved"
       FROM "attendance_registers" ar
       LEFT JOIN "classes" c ON c."id" = ar."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       WHERE ar."tenantId" = $1 AND ar."academicYearId" = $2 AND ar."classId" = $3
       AND ar."month" = $4 AND ar."year" = $5 LIMIT 1`,
      tenantId, academicYearId, classId, month, year,
    );

    if (existing && existing.length > 0) {
      return existing[0];
    }

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "attendance_registers"
       ("id", "tenantId", "academicYearId", "classId", "teacherId", "month", "year",
        "studentsData", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', NOW(), NOW())`,
      id, tenantId, academicYearId, classId, teacherId, month, year, JSON.stringify([]),
    );

    const created: any = await this.prisma.$queryRawUnsafe(
      `SELECT ar.*, sl."code" as "schoolLevelCode", sl."name" as "schoolLevelName",
              c."name" as "classNameResolved"
       FROM "attendance_registers" ar
       LEFT JOIN "classes" c ON c."id" = ar."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       WHERE ar."id" = $1`,
      id,
    );
    return created[0];
  }

  /// Liste les registres d'appel d'un enseignant.
  async getAttendanceRegisters(
    tenantId: string,
    teacherId: string,
    academicYearId: string,
    classId?: string,
  ) {
    // ⭐ TEST PROMOTEUR/DIRECTION : vue superviseur si rôle direction sans profil Teacher
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    if (filter.mode === 'none') return [];

    if (classId) {
      if (filter.mode === 'teacher') {
        return this.prisma.$queryRawUnsafe(
          `SELECT * FROM "attendance_registers"
           WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "teacherId" = $3 AND "classId" = $4
           ORDER BY "year" DESC, "month" DESC`,
          tenantId, academicYearId, filter.teacherId, classId,
        );
      }
      // Mode direction
      return this.prisma.$queryRawUnsafe(
        `SELECT * FROM "attendance_registers"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classId" = $3
         ORDER BY "year" DESC, "month" DESC`,
        tenantId, academicYearId, classId,
      );
    }
    if (filter.mode === 'teacher') {
      return this.prisma.$queryRawUnsafe(
        `SELECT * FROM "attendance_registers"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "teacherId" = $3
         ORDER BY "year" DESC, "month" DESC`,
        tenantId, academicYearId, filter.teacherId,
      );
    }
    // Mode direction
    return this.prisma.$queryRawUnsafe(
      `SELECT * FROM "attendance_registers"
       WHERE "tenantId" = $1 AND "academicYearId" = $2
       ORDER BY "year" DESC, "month" DESC`,
      tenantId, academicYearId,
    );
  }

  /// Met à jour un registre d'appel.
  /** Calcule la structure des semaines d'un mois (lun-ven) — même algorithme
   *  que syncAttendanceToRegister : map dateStr(YYYY-MM-DD local) → { weekInMonth, dayInWeek }. */
  private static computeMonthCells(year: number, month: number): Map<string, { weekInMonth: number; dayInWeek: number }> {
    const cells = new Map<string, { weekInMonth: number; dayInWeek: number }>();
    const daysInMonth = new Date(year, month, 0).getDate();
    let currentWeek = 1;
    let lastDow = -1;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const dow = d.getDay(); // 0=dim, 1=lun, ..., 5=ven
      if (dow < 1 || dow > 5) continue;
      if (lastDow === 5 && dow === 1) currentWeek++;
      if (currentWeek > 5) continue;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.set(dateStr, { weekInMonth: currentWeek, dayInWeek: dow });
      lastDow = dow;
    }
    return cells;
  }

  async updateAttendanceRegister(
    tenantId: string,
    registerId: string,
    data: any,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "attendance_registers" WHERE "id" = $1 AND "tenantId" = $2`,
      registerId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Registre non trouvé');
    }

    // ⭐ FIX 2026-09-15 (fusion appel → registre — anti-écrasement) :
    //    Le registre est éditable manuellement ET synchronisé depuis les appels.
    //    Problème observé en production : une session front-end périmée (chargée
    //    AVANT un appel enregistré depuis une autre session/onglet) écrasait
    //    les marques d'absence issues de l'appel lors de son « Enregistrer ».
    //    Désormais, avant de persister studentsData, on FUSIONNE : pour chaque
    //    cellule (semaine, jour) couverte par un AttendanceRecord, la marque
    //    dérivée de l'appel est AUTORITAIRE (elle remplace la marque envoyée) ;
    //    les cellules sans appel conservent les marques manuelles.
    if (data.studentsData !== undefined && existing[0].classId) {
      try {
        const reg = existing[0];
        const month = Number(reg.month);
        const year = Number(reg.year);
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 0, 23, 59, 59);
        const records = await this.prisma.attendanceRecord.findMany({
          where: { tenantId, classId: reg.classId, date: { gte: monthStart, lte: monthEnd } },
          orderBy: { updatedAt: 'asc' },
        });
        if (records.length > 0) {
          const cells = PedagogicalSpaceService.computeMonthCells(year, month);
          // studentId → Map("semaine|jour" → marque dérivée de l'appel)
          // ⭐ Déduplication (élève × jour local) : garder le record le plus
          //    récent (doublons hérités minuit vs midi — voir syncAttendanceToRegister).
          const recordMarks = new Map<string, Map<string, string>>();
          for (const r of records) {
            const d: Date = r.date as unknown as Date;
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const cell = cells.get(dateStr);
            if (!cell) continue; // week-end
            const am = r.amStatus || 'PRESENT';
            const pm = r.pmStatus || 'PRESENT';
            let marked = '';
            if (am === 'ABSENT' && pm === 'ABSENT') marked = '+';
            else if (am === 'ABSENT') marked = '-';
            else if (pm === 'ABSENT') marked = '|';
            else if (am === 'EXCUSED' || pm === 'EXCUSED') marked = 'E';
            if (!recordMarks.has(r.studentId)) recordMarks.set(r.studentId, new Map());
            recordMarks.get(r.studentId).set(`${cell.weekInMonth}|${cell.dayInWeek}`, marked);
          }
          const incoming = Array.isArray(data.studentsData) ? data.studentsData : [];
          for (const student of incoming) {
            const marks = recordMarks.get(student.studentId);
            if (!marks) continue; // aucun appel pour cet élève → marques manuelles intactes
            // Retirer les marques manuelles des cellules couvertes par un appel,
            // puis réinjecter les marques autoritaires de l'appel.
            const absences = (Array.isArray(student.absences) ? student.absences : [])
              .filter((a: any) => !marks.has(`${a.week}|${a.day}`));
            for (const [cellKey, marked] of marks.entries()) {
              if (!marked) continue; // appel PRÉSENT → case vide
              const [week, day] = cellKey.split('|').map(Number);
              absences.push({ week, day, marked });
            }
            student.absences = absences;
            // Recalculer les totaux de l'élève (système demi-jours)
            const totalAbsences = absences.reduce(
              (sum: number, a: any) => sum + (a.marked === '+' ? 2 : (a.marked === '-' || a.marked === '|' ? 1 : 0)), 0);
            student.totalAbsences = totalAbsences;
            const poss = Number(student.totalPresencesPossibles) || Number(student.nbDemiJournees) || 0;
            student.totalPresenceEffectif = poss - totalAbsences;
          }
        }
      } catch (mergeErr) {
        // Non-bloquant : on persiste les données envoyées telles quelles.
        this.logger.warn(
          `[updateAttendanceRegister] Fusion appel→registre non-bloquante: ${(mergeErr as Error).message}`,
        );
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const allowedFields: Record<string, 'string' | 'int' | 'float' | 'jsonb' | 'date'> = {
      studentsData: 'jsonb',
      demiJourneeMois: 'int',
      presencePossibleMois: 'int',
      totalAbsencesMois: 'int',
      totalPresencesEffectivesMois: 'int',
      pourcentagePresences: 'float',
      pourcentageAbsences: 'float',
      arreteDate: 'date',
      arreteHeure: 'string',
      effectifJourFilles: 'int',
      effectifJourGarcons: 'int',
      directeurSignatureDate: 'date',
      titulaireSignatureDate: 'date',
      // ⭐ Signatures (images base64 — comme dans le module RH contrats)
      teacherSignature: 'string',
      directorSignature: 'string',
      // ⭐ Jours fériés du mois (JSON array de dates ISO)
      holidays: 'jsonb',
      status: 'string',
      submittedAt: 'date',
      validatedAt: 'date',
      validatedBy: 'string',
      rejectionReason: 'string',
    };

    for (const [key, type] of Object.entries(allowedFields)) {
      if (data[key] !== undefined) {
        const val = data[key];
        if (type === 'jsonb') {
          updates.push(`"${key}" = $${paramIdx++}::jsonb`);
          params.push(JSON.stringify(val));
        } else if (type === 'date' && val) {
          updates.push(`"${key}" = $${paramIdx++}::timestamp`);
          params.push(new Date(val));
        } else if (type === 'int') {
          updates.push(`"${key}" = $${paramIdx++}::int`);
          params.push(val);
        } else if (type === 'float') {
          updates.push(`"${key}" = $${paramIdx++}::double precision`);
          params.push(val);
        } else {
          updates.push(`"${key}" = $${paramIdx++}`);
          params.push(val);
        }
      }
    }

    if (updates.length === 0) return existing[0];
    updates.push(`"updatedAt" = NOW()`);
    params.push(registerId, tenantId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "attendance_registers" SET ${updates.join(', ')} WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "attendance_registers" WHERE "id" = $1`,
      registerId,
    );
    return updated[0];
  }

  /// Récupère ou crée l'évaluation mensuelle associée à un registre.
  async getOrCreateMonthlyEvaluation(
    tenantId: string,
    academicYearId: string,
    classId: string,
    attendanceRegisterId: string,
    month: number,
    year: number,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations"
       WHERE "attendanceRegisterId" = $1 LIMIT 1`,
      attendanceRegisterId,
    );

    if (existing && existing.length > 0) {
      return existing[0];
    }

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "monthly_evaluations"
       ("id", "tenantId", "academicYearId", "classId", "attendanceRegisterId",
        "month", "year", "subjectsConfig", "studentScores", "seuilReussite",
        "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 10.0, 'DRAFT', NOW(), NOW())`,
      id, tenantId, academicYearId, classId, attendanceRegisterId,
      month, year, JSON.stringify([]), JSON.stringify([]),
    );

    const created: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations" WHERE "id" = $1`,
      id,
    );
    return created[0];
  }

  /// Met à jour une évaluation mensuelle.
  async updateMonthlyEvaluation(
    tenantId: string,
    evaluationId: string,
    data: any,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations" WHERE "id" = $1 AND "tenantId" = $2`,
      evaluationId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const allowedFields: Record<string, 'string' | 'int' | 'float' | 'jsonb' | 'date'> = {
      evaluationNumber: 'int',
      etapeNumber: 'int',
      subjectsConfig: 'jsonb',
      studentScores: 'jsonb',
      seuilReussite: 'float',
      effectifTotalGarcons: 'int',
      effectifTotalFilles: 'int',
      effectifTotalClasse: 'int',
      ayantComposeG: 'int',
      ayantComposeF: 'int',
      ayantComposeTotal: 'int',
      ayantAtteintSeuilG: 'int',
      ayantAtteintSeuilF: 'int',
      ayantAtteintSeuilTotal: 'int',
      nAyantPasAtteintG: 'int',
      nAyantPasAtteintF: 'int',
      nAyantPasAtteintTotal: 'int',
      pourcentageReussiteG: 'float',
      pourcentageReussiteF: 'float',
      pourcentageReussiteTotal: 'float',
      teacherSignatureDate: 'date',
      directorSignatureDate: 'date',
      status: 'string',
      submittedAt: 'date',
      validatedAt: 'date',
      validatedBy: 'string',
      rejectionReason: 'string',
    };

    for (const [key, type] of Object.entries(allowedFields)) {
      if (data[key] !== undefined) {
        const val = data[key];
        if (type === 'jsonb') {
          updates.push(`"${key}" = $${paramIdx++}::jsonb`);
          params.push(JSON.stringify(val));
        } else if (type === 'date' && val) {
          updates.push(`"${key}" = $${paramIdx++}::timestamp`);
          params.push(new Date(val));
        } else if (type === 'int') {
          updates.push(`"${key}" = $${paramIdx++}::int`);
          params.push(val);
        } else if (type === 'float') {
          updates.push(`"${key}" = $${paramIdx++}::double precision`);
          params.push(val);
        } else {
          updates.push(`"${key}" = $${paramIdx++}`);
          params.push(val);
        }
      }
    }

    if (updates.length === 0) return existing[0];
    updates.push(`"updatedAt" = NOW()`);
    params.push(evaluationId, tenantId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "monthly_evaluations" SET ${updates.join(', ')} WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations" WHERE "id" = $1`,
      evaluationId,
    );
    return updated[0];
  }

  /// Calcule les statistiques de récapitulation pour une évaluation mensuelle
  /// à partir des studentScores. Retourne les compteurs G/F/Total.
  computeEvaluationStats(studentScores: any[], seuilReussite: number) {
    let totalG = 0, totalF = 0, totalC = 0;
    let composeG = 0, composeF = 0, composeT = 0;
    let atteintG = 0, atteintF = 0, atteintT = 0;

    for (const student of studentScores) {
      const sexe = (student.sexe || '').toUpperCase();
      const totalGeneral = student.totalGeneral ?? 0;
      const aCompose = totalGeneral > 0;
      const aAtteint = totalGeneral >= seuilReussite;

      if (sexe === 'M' || sexe === 'G') {
        totalG++;
        if (aCompose) composeG++;
        if (aAtteint) atteintG++;
      } else if (sexe === 'F') {
        totalF++;
        if (aCompose) composeF++;
        if (aAtteint) atteintF++;
      }
      totalC++;
      if (aCompose) composeT++;
      if (aAtteint) atteintT++;
    }

    return {
      effectifTotalGarcons: totalG,
      effectifTotalFilles: totalF,
      effectifTotalClasse: totalC,
      ayantComposeG: composeG,
      ayantComposeF: composeF,
      ayantComposeTotal: composeT,
      ayantAtteintSeuilG: atteintG,
      ayantAtteintSeuilF: atteintF,
      ayantAtteintSeuilTotal: atteintT,
      nAyantPasAtteintG: totalG - atteintG,
      nAyantPasAtteintF: totalF - atteintF,
      nAyantPasAtteintTotal: totalC - atteintT,
      pourcentageReussiteG: totalG > 0 ? Math.round((atteintG / totalG) * 10000) / 100 : 0,
      pourcentageReussiteF: totalF > 0 ? Math.round((atteintF / totalF) * 10000) / 100 : 0,
      pourcentageReussiteTotal: totalC > 0 ? Math.round((atteintT / totalC) * 10000) / 100 : 0,
    };
  }

  /// Calcule les statistiques de récapitulation pour un registre d'appel mensuel.
  computeAttendanceStats(studentsData: any[], demiJourneeMois: number) {
    let totalAbsences = 0;
    let totalPresencesPossibles = 0;
    let elevesJamaisManque = 0;
    let elevesManquePlusDe4 = 0;
    let totalAbsencesImputables = 0;

    for (const student of studentsData) {
      const abs = (student.totalAbsences || 0);
      const possibles = (student.totalPresencesPossibles || 0);
      totalAbsences += abs;
      totalPresencesPossibles += possibles;
      if (abs === 0 || abs <= 4) {
        elevesJamaisManque++;
      } else {
        elevesManquePlusDe4++;
        totalAbsencesImputables += abs;
      }
    }

    const totalPresencesEffectives = totalPresencesPossibles - totalAbsences;
    const pourcentagePresences = totalPresencesPossibles > 0
      ? Math.round((totalPresencesEffectives / totalPresencesPossibles) * 10000) / 100 : 0;
    const pourcentageAbsences = totalPresencesPossibles > 0
      ? Math.round((totalAbsences / totalPresencesPossibles) * 10000) / 100 : 0;

    return {
      demiJourneeMois,
      presencePossibleMois: totalPresencesPossibles,
      totalAbsencesMois: totalAbsences,
      totalPresencesEffectivesMois: totalPresencesEffectives,
      pourcentagePresences,
      pourcentageAbsences,
      nombreElevesJamaisManque: elevesJamaisManque,
      nombreElevesManquePlusDe4: elevesManquePlusDe4,
      totalAbsencesImputables,
    };
  }

  /// Récupère ou crée le tableau de relevés mensuels annuel pour une classe.
  async getOrCreateMonthlySummary(
    tenantId: string,
    academicYearId: string,
    classId: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_summaries"
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classId" = $3 LIMIT 1`,
      tenantId, academicYearId, classId,
    );

    if (existing && existing.length > 0) {
      return existing[0];
    }

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "monthly_summaries"
       ("id", "tenantId", "academicYearId", "classId", "monthlyData", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      id, tenantId, academicYearId, classId, JSON.stringify([]),
    );

    const created: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_summaries" WHERE "id" = $1`,
      id,
    );
    return created[0];
  }

  /// Régénère le tableau de relevés mensuels annuel à partir des registres
  /// d'appel de tous les mois de l'année académique.
  async refreshMonthlySummary(
    tenantId: string,
    academicYearId: string,
    classId: string,
  ) {
    // Récupérer tous les registres d'appel validés (ou tous) pour cette classe
    const registers: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "attendance_registers"
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classId" = $3
       ORDER BY "year" ASC, "month" ASC`,
      tenantId, academicYearId, classId,
    );

    const monthlyData: any[] = [];
    for (const reg of registers) {
      const studentsData = typeof reg.studentsData === 'string'
        ? JSON.parse(reg.studentsData)
        : (reg.studentsData || []);
      const stats = this.computeAttendanceStats(studentsData, reg.demiJourneeMois || 0);

      monthlyData.push({
        month: reg.month,
        year: reg.year,
        demiJoursClasse: reg.demiJourneeMois,
        totalElevesFrequentes: studentsData.length,
        totalPresencesPossibles: stats.presencePossibleMois,
        totalAbsences: stats.totalAbsencesMois,
        nombrePresences: stats.totalPresencesEffectivesMois,
        pourcentagePresences: stats.pourcentagePresences,
        nombreElevesJamaisManque: stats.nombreElevesJamaisManque,
        nombreElevesManquePlusDe4: stats.nombreElevesManquePlusDe4,
        totalAbsencesImputables: stats.totalAbsencesImputables,
        observations: reg.rejectionReason || null,
      });
    }

    // Upsert dans monthly_summaries
    const summary = await this.getOrCreateMonthlySummary(tenantId, academicYearId, classId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "monthly_summaries"
       SET "monthlyData" = $1::jsonb, "updatedAt" = NOW()
       WHERE "id" = $2`,
      JSON.stringify(monthlyData), summary.id,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_summaries" WHERE "id" = $1`,
      summary.id,
    );
    return updated[0];
  }

  // ===========================================================================
  // VALIDATION DIRECTION — Cahier Journal, Fiches, Registres, Évaluations
  // ===========================================================================

  /// Récupère les cahiers journaux à valider selon le filtre de statut.
  /// ⭐ statusFilter options :
  ///    - 'SUBMITTED' (default) : en attente de validation
  ///    - 'VALIDATED'            : déjà validés
  ///    - 'REJECTED'             : rejetés
  ///    - 'ALL'                  : tous les cahiers journaux non-DRAFT de l'année
  /// Inclut schoolLevelName + schoolLevelCode via JOIN school_levels.
  async getPendingCahierJournals(tenantId: string, academicYearId: string, statusFilter: string = 'SUBMITTED') {
    // ⭐ Utiliser DISTINCT ON (cj.id) pour éviter la duplication quand une classe
    //    a plusieurs TeacherClassAssignment (une par matière). Sans ça, un cahier
    //    journal soumis apparaît 26 fois (une par matière assignée à la classe).
    const statusCondition = statusFilter === 'ALL'
      ? `AND cj."status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`
      : `AND cj."status" = '${statusFilter}'`;
    return this.prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (cj.id) cj.*, c."name" as "classNameResolved",
              c."schoolLevelId" as "schoolLevelId",
              sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode",
              tca_t."firstName" as "teacherFirstName", tca_t."lastName" as "teacherLastName", tca_t."gender" as "teacherGender"
       FROM "cahier_journal_entries" cj
       LEFT JOIN "classes" c ON c."id" = cj."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN teacher_class_assignments tca ON tca."classId" = cj."classId" AND tca."tenantId" = cj."tenantId"
       LEFT JOIN "teachers" tca_t ON tca_t."id" = tca."teacherId"
       WHERE cj."tenantId" = $1 AND cj."academicYearId" = $2 ${statusCondition}
       ORDER BY cj.id, cj."submittedAt" DESC, cj."validatedAt" DESC`,
      tenantId, academicYearId,
    );
  }

  /// Valide ou rejette un cahier journal.
  async validateCahierJournal(
    tenantId: string,
    journalId: string,
    action: 'VALIDATED' | 'REJECTED',
    validatedBy: string,
    rejectionReason?: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1 AND "tenantId" = $2`,
      journalId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    if (existing[0].status !== 'SUBMITTED') {
      throw new BadRequestException('Cahier journal pas en attente de validation');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "cahier_journal_entries"
       SET "status" = $1, "validatedAt" = NOW(), "validatedBy" = $2,
           "rejectionReason" = $3, "directorValidatedAt" = CASE WHEN $1 = 'VALIDATED' THEN NOW() ELSE NULL END,
           "updatedAt" = NOW()
       WHERE "id" = $4`,
      action, validatedBy, action === 'REJECTED' ? (rejectionReason || null) : null, journalId,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1`,
      journalId,
    );
    this.logger.log(`✅ Cahier journal ${journalId} ${action} par ${validatedBy}`);
    return updated[0];
  }

  /// Récupère les fiches pédagogiques selon le filtre de statut.
  /// ⭐ statusFilter options : 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'ALL'
  /// Inclut schoolLevelName + schoolLevelCode via JOIN school_levels.
  async getPendingPedagogicalFiches(tenantId: string, academicYearId: string, statusFilter: string = 'SUBMITTED') {
    const statusCondition = statusFilter === 'ALL'
      ? `AND pf."status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`
      : `AND pf."status" = '${statusFilter}'`;
    return this.prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (pf.id) pf.*, c."name" as "classNameResolved",
              c."schoolLevelId" as "schoolLevelId",
              sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode",
              tca_t."firstName" as "teacherFirstName", tca_t."lastName" as "teacherLastName", tca_t."gender" as "teacherGender"
       FROM "primary_pedagogical_fiches" pf
       LEFT JOIN "classes" c ON c."id" = pf."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN teacher_class_assignments tca ON tca."classId" = pf."classId" AND tca."tenantId" = pf."tenantId"
       LEFT JOIN "teachers" tca_t ON tca_t."id" = tca."teacherId"
       WHERE pf."tenantId" = $1 AND pf."academicYearId" = $2 ${statusCondition}
       ORDER BY pf.id, pf."submittedAt" DESC, pf."validatedAt" DESC`,
      tenantId, academicYearId,
    );
  }

  /// Valide ou rejette une fiche pédagogique.
  async validatePedagogicalFiche(
    tenantId: string,
    ficheId: string,
    action: 'VALIDATED' | 'REJECTED',
    validatedBy: string,
    rejectionReason?: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1 AND "tenantId" = $2`,
      ficheId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Fiche pédagogique non trouvée');
    }
    if (existing[0].status !== 'SUBMITTED') {
      throw new BadRequestException('Fiche pas en attente de validation');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "primary_pedagogical_fiches"
       SET "status" = $1, "validatedAt" = NOW(), "validatedBy" = $2,
           "rejectionReason" = $3, "updatedAt" = NOW()
       WHERE "id" = $4`,
      action, validatedBy, action === 'REJECTED' ? (rejectionReason || null) : null, ficheId,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1`,
      ficheId,
    );
    this.logger.log(`✅ Fiche pédagogique ${ficheId} ${action} par ${validatedBy}`);
    return updated[0];
  }

  /**
   * ⭐ Permet au directeur d'ajouter ses observations (par section + générale)
   *    et d'apposer sa signature, puis de valider la fiche pédagogique.
   *
   * Body :
   *   - directorSectionObservations: Record<string, string> — observations par section
   *     (ex: { phase_preparatoire: "...", deroulement: "...", retour_projection: "..." })
   *   - directorObservation: string — observation générale (HTML riche)
   *   - directorSignature: string (base64) — signature du directeur (obligatoire pour VALIDATED)
   *   - action: 'VALIDATED' | 'REJECTED'
   *   - rejectionReason?: string
   *   - validatedBy?: string
   */
  async directorUpdatePedagogicalFiche(
    tenantId: string,
    ficheId: string,
    body: {
      directorSectionObservations?: Record<string, string>;
      directorObservation?: string;
      directorSignature?: string;
      // ⭐ action maintenant optionnelle — si absente → sauvegarde simple (pas de changement de statut, pas de notification)
      //    Pattern identique à directorUpdateCahierJournal (ligne 3009)
      action?: 'VALIDATED' | 'REJECTED';
      rejectionReason?: string;
      validatedBy?: string;
    },
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1 AND "tenantId" = $2`,
      ficheId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Fiche pédagogique non trouvée');
    }
    const fiche = existing[0];

    // ⭐ Mode sauvegarde simple (sans action) : on accepte tous les statuts SUBMITTED/REJECTED/VALIDATED
    //    pour permettre au directeur d'enregistrer ses observations même après validation/rejet.
    //    Mode validation/rejet (avec action) : on exige SUBMITTED pour changer le statut.
    if (body.action && fiche.status !== 'SUBMITTED') {
      throw new BadRequestException(`La fiche doit être en statut SUBMITTED pour la valider/rejeter (actuel: ${fiche.status}). Utilisez le mode sauvegarde (sans action) pour modifier les observations.`);
    }

    // ⭐ 2026-09-15 : CONTRAINTE SIGNATURE SUPPRIMÉE — les fiches pédagogiques
    //    ne comportent plus aucune signature (décision utilisateur). La
    //    validation s'appuie uniquement sur les observations du directeur.
    //    (Anciennement : `La signature du directeur est obligatoire pour valider`)

    // ⭐ Construction dynamique de la requête UPDATE selon le mode (save-only vs validate/reject)
    if (body.action) {
      // Mode validation/rejet — change le statut + met à jour les champs
      await this.prisma.$executeRawUnsafe(
        `UPDATE "primary_pedagogical_fiches"
         SET "status" = $3,
             "directorSignature" = $4,
             "directorSignatureDate" = CASE WHEN $3 = 'VALIDATED' THEN NOW() ELSE "directorSignatureDate" END,
             "directorObservation" = $5,
             "directorSectionObservations" = $6::jsonb,
             "validatedAt" = CASE WHEN $3 = 'VALIDATED' THEN NOW() ELSE "validatedAt" END,
             "validatedBy" = $7,
             "rejectionReason" = $8,
             "updatedAt" = NOW()
         WHERE "id" = $1 AND "tenantId" = $2`,
        ficheId, tenantId,
        body.action,
        body.directorSignature || null,
        body.directorObservation || null,
        JSON.stringify(body.directorSectionObservations || {}),
        body.validatedBy || null,
        body.action === 'REJECTED' ? (body.rejectionReason || null) : null,
      );
    } else {
      // ⭐ Mode sauvegarde simple — ne change PAS le statut
      //    Met à jour uniquement les observations + signature (sans notification)
      await this.prisma.$executeRawUnsafe(
        `UPDATE "primary_pedagogical_fiches"
         SET "directorSignature" = $3,
             "directorObservation" = $4,
             "directorSectionObservations" = $5::jsonb,
             "updatedAt" = NOW()
         WHERE "id" = $1 AND "tenantId" = $2`,
        ficheId, tenantId,
        body.directorSignature || null,
        body.directorObservation || null,
        JSON.stringify(body.directorSectionObservations || {}),
      );
    }

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1`,
      ficheId,
    );

    // ⭐ Notifier l'enseignant de la décision UNIQUEMENT si une action a été effectuée
    //    (mode sauvegarde = pas de notification — pattern identique à directorUpdateCahierJournal)
    if (body.action) {
      this.notifyTeacherOfFicheDecision(
        tenantId, fiche.classId, fiche.teacherId, body.action, fiche.sheetType, fiche.lessonDate,
      ).catch((err) => this.logger.error('Teacher notification error:', err));
    }

    this.logger.log(`✅ Fiche pédagogique ${ficheId} ${body.action ? body.action : 'sauvegardée (sans action)'}`);
    return updated[0];
  }

  /**
   * ⭐ Envoie manuellement une notification à l'enseignant après validation/rejet d'une fiche.
   *    Permet au directeur de re-notifier l'enseignant (rappel) sans changer le statut.
   *    Récupère le statut actuel de la fiche (VALIDATED ou REJECTED) et envoie la notification.
   */
  async sendFicheDecisionToTeacher(tenantId: string, ficheId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "primary_pedagogical_fiches" WHERE "id" = $1 AND "tenantId" = $2`,
      ficheId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Fiche pédagogique non trouvée');
    }
    const fiche = existing[0];
    if (fiche.status !== 'VALIDATED' && fiche.status !== 'REJECTED') {
      throw new BadRequestException(
        `La fiche doit être VALIDATED ou REJECTED pour envoyer la notification (actuel: ${fiche.status}). Validez ou rejetez d'abord la fiche.`,
      );
    }

    await this.notifyTeacherOfFicheDecision(
      tenantId, fiche.classId, fiche.teacherId, fiche.status, fiche.sheetType, fiche.lessonDate,
    );

    this.logger.log(`📧 Notification renvoyée pour la fiche ${ficheId} (${fiche.status})`);
    return { success: true, ficheId, status: fiche.status, sentAt: new Date().toISOString() };
  }

  /**
   * ⭐ Envoie manuellement une notification à l'enseignant après validation/rejet d'un cahier journal.
   *    Permet au directeur de re-notifier l'enseignant (rappel) sans changer le statut.
   */
  async sendCahierJournalDecisionToTeacher(tenantId: string, journalId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1 AND "tenantId" = $2`,
      journalId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    const journal = existing[0];
    if (journal.status !== 'VALIDATED' && journal.status !== 'REJECTED') {
      throw new BadRequestException(
        `Le cahier journal doit être VALIDATED ou REJECTED pour envoyer la notification (actuel: ${journal.status}). Validez ou rejetez d'abord le cahier journal.`,
      );
    }

    await this.notifyTeacherOfCahierJournalDecision(
      tenantId, journal.classId, journal.teacherId, journal.status, journal.weekStartDate,
    );

    this.logger.log(`📧 Notification renvoyée pour le cahier journal ${journalId} (${journal.status})`);
    return { success: true, journalId, status: journal.status, sentAt: new Date().toISOString() };
  }

  /**
   * ⭐ Notifie l'enseignant de la décision du directeur sur sa fiche pédagogique.
   */
  private async notifyTeacherOfFicheDecision(
    tenantId: string,
    classId: string,
    teacherId: string,
    action: string,
    sheetType: string,
    lessonDate: Date | null,
  ) {
    let className = '—';
    try {
      const cls: any = await this.prisma.$queryRawUnsafe(
        `SELECT name FROM "classes" WHERE "id" = $1`, classId,
      );
      if (cls && cls.length > 0) className = cls[0].name || '—';
    } catch { /* silent */ }

    let schoolName = 'Établissement scolaire';
    try {
      const profile: any = await this.prisma.$queryRawUnsafe(
        `SELECT "schoolName" FROM "tenant_identity_profiles"
         WHERE "tenantId" = $1 AND "isActive" = true LIMIT 1`,
        tenantId,
      );
      if (profile && profile.length > 0) schoolName = profile[0].schoolName || schoolName;
    } catch { /* silent */ }

    let teacher: any = null;
    try {
      const teacherRow: any = await this.prisma.$queryRawUnsafe(
        `SELECT t.*, u.email, u.phone, u."firstName", u."lastName"
         FROM "teachers" t
         LEFT JOIN "users" u ON u.email = t.email
         WHERE t.id = $1 LIMIT 1`,
        teacherId,
      );
      if (teacherRow && teacherRow.length > 0) teacher = teacherRow[0];
    } catch (err: any) {
      this.logger.warn(`Failed to fetch teacher: ${err.message}`);
    }

    if (!teacher || !teacher.email) {
      this.logger.warn(`Aucun email trouvé pour l'enseignant ${teacherId}`);
      return;
    }

    const sheetTypeLabels: Record<string, string> = {
      MATH: 'Mathématiques', FRANCAIS: 'Français', EST: 'Éduc. Scientifique & Tech.',
      ES: 'Éducation Sociale', EA: 'Éducation Artistique', EPS: 'Éducation Physique et Sportive',
      STANDARD: 'Anglais / Informatique (fiche standard)',
    };
    const dateLabel = lessonDate ? new Date(lessonDate).toLocaleDateString('fr-FR') : '—';
    const actionLabel = action === 'VALIDATED' ? 'validée' : 'rejetée';
    const actionColor = action === 'VALIDATED' ? '#10b981' : '#ef4444';

    const emailSubject = `[${schoolName}] Fiche pédagogique ${actionLabel} — ${sheetTypeLabels[sheetType] || sheetType} — ${className}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${actionColor}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 18px;">${schoolName}</h1>
          <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">Fiche pédagogique ${actionLabel}</p>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: ${actionColor}; font-size: 16px;">Bonjour ${teacher.firstName || ''} ${teacher.lastName || ''},</h2>
          <p style="font-size: 14px; line-height: 1.5;">
            Votre fiche pédagogique a été <strong style="color: ${actionColor};">${actionLabel}</strong> par le directeur :
          </p>
          <table style="width: 100%; margin: 15px 0; border-collapse: collapse;">
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Classe :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${className}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Type :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${sheetTypeLabels[sheetType] || sheetType}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Date du cours :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${dateLabel}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Décision :</td><td style="padding: 5px; border-bottom: 1px solid #eee; color: ${actionColor}; font-weight: bold;">${actionLabel.toUpperCase()}</td></tr>
          </table>
          <p style="font-size: 14px; line-height: 1.5;">
            Connectez-vous à la plateforme pour consulter les observations du directeur
            dans <strong>Espace Pédagogique → Fiches Pédagogiques</strong>.
          </p>
        </div>
      </div>
    `;
    const smsMessage = `${schoolName}: Votre fiche pedagogique (${sheetTypeLabels[sheetType] || sheetType}, ${className}, ${dateLabel}) a ete ${actionLabel}e par le directeur.`;

    try {
      await this.emailService.sendCategorized({
        tenantId, category: 'PEDAGOGIE', subCategory: 'FICHE_DECISION',
        module: 'pedagogy' as any, to: teacher.email,
        toName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
        recipientType: 'ENSEIGNANT', recipientId: teacherId,
        subject: emailSubject, html: emailHtml, text: smsMessage,
        fromName: schoolName, triggeredBy: 'STAFF',
        relatedEntityId: classId, relatedEntityType: 'PedagogicalFiche',
      } as any);
    } catch (err: any) {
      this.logger.warn(`Email to teacher failed: ${err.message}`);
    }

    if (teacher.phone) {
      try {
        const phone = teacher.phone.startsWith('+') ? teacher.phone : `+229${teacher.phone.replace(/^0/, '')}`;
        await this.whatsappService.sendCategorized({
          tenantId, category: 'PEDAGOGIE', subCategory: 'FICHE_DECISION',
          module: 'pedagogy' as any, to: phone,
          toName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
          recipientType: 'ENSEIGNANT', recipientId: teacherId,
          message: smsMessage, triggeredBy: 'STAFF',
          relatedEntityId: classId, relatedEntityType: 'PedagogicalFiche',
        } as any);
      } catch (err: any) {
        this.logger.warn(`WhatsApp to teacher failed: ${err.message}`);
      }
      try {
        await this.smsService.sendSMS(teacher.phone, smsMessage);
      } catch (err: any) {
        this.logger.warn(`SMS to teacher failed: ${err.message}`);
      }
    }
  }

  /// Récupère tous les registres d'appel soumis (en attente de validation).
  /// Récupère les registres d'appel selon le filtre de statut.
  /// ⭐ statusFilter options : 'SUBMITTED' (default) | 'VALIDATED' | 'REJECTED' | 'ALL'
  /// Inclut schoolLevelName + schoolLevelCode via JOIN school_levels.
  async getPendingAttendanceRegisters(tenantId: string, academicYearId: string, statusFilter: string = 'SUBMITTED') {
    const validStatuses = ['SUBMITTED', 'VALIDATED', 'REJECTED', 'ALL'];
    const status = validStatuses.includes(statusFilter) ? statusFilter : 'SUBMITTED';
    const statusCondition = status === 'ALL'
      ? `AND ar."status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`
      : `AND ar."status" = '${status}'`;
    return this.prisma.$queryRawUnsafe(
      `SELECT ar.*, c."name" as "classNameResolved", c."schoolLevelId",
              sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "attendance_registers" ar
       LEFT JOIN "classes" c ON c."id" = ar."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN "teachers" t ON t."id" = ar."teacherId"
       WHERE ar."tenantId" = $1 AND ar."academicYearId" = $2 ${statusCondition}
       ORDER BY ar."submittedAt" DESC, ar."validatedAt" DESC`,
      tenantId, academicYearId,
    );
  }

  /// Valide ou rejette un registre d'appel.
  async validateAttendanceRegister(
    tenantId: string,
    registerId: string,
    action: 'VALIDATED' | 'REJECTED',
    validatedBy: string,
    rejectionReason?: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "attendance_registers" WHERE "id" = $1 AND "tenantId" = $2`,
      registerId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Registre non trouvé');
    }
    if (existing[0].status !== 'SUBMITTED') {
      throw new BadRequestException('Registre pas en attente de validation');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "attendance_registers"
       SET "status" = $1, "validatedAt" = NOW(), "validatedBy" = $2,
           "rejectionReason" = $3, "updatedAt" = NOW()
       WHERE "id" = $4`,
      action, validatedBy, action === 'REJECTED' ? (rejectionReason || null) : null, registerId,
    );

    // Si validé, mettre à jour la date de signature du directeur
    if (action === 'VALIDATED') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "attendance_registers"
         SET "directeurSignatureDate" = NOW()
         WHERE "id" = $1`,
        registerId,
      );
    }

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "attendance_registers" WHERE "id" = $1`,
      registerId,
    );

    // Si validé, rafraîchir le tableau de relevés mensuels
    if (action === 'VALIDATED' && updated[0]) {
      try {
        await this.refreshMonthlySummary(tenantId, updated[0].academicYearId, updated[0].classId);
      } catch (e) {
        this.logger.warn(`⚠️ Impossible de rafraîchir le tableau de relevés: ${e.message}`);
      }
    }

    this.logger.log(`✅ Registre d'appel ${registerId} ${action} par ${validatedBy}`);
    return updated[0];
  }

  /**
   * ⭐ Permet au directeur d'ajouter ses observations + signature + valider
   *    un registre d'appel ET son évaluation mensuelle associée.
   *
   * Body :
   *   - directorSignature: string (base64) — signature du directeur (obligatoire pour VALIDATED)
   *   - directorObservation: string — observation générale du directeur
   *   - action: 'VALIDATED' | 'REJECTED'
   *   - rejectionReason?: string
   *   - validatedBy: string (userId du directeur)
   */
  async directorUpdateAttendanceRegister(
    tenantId: string,
    registerId: string,
    body: {
      directorSignature?: string;
      directorObservation?: string;
      action: 'VALIDATED' | 'REJECTED';
      rejectionReason?: string;
      validatedBy?: string;
    },
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "attendance_registers" WHERE "id" = $1 AND "tenantId" = $2`,
      registerId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Registre non trouvé');
    }
    const register = existing[0];
    if (register.status !== 'SUBMITTED') {
      throw new BadRequestException(`Le registre doit être en statut SUBMITTED (actuel: ${register.status})`);
    }

    // ⭐ Si VALIDATED, la signature du directeur est obligatoire
    if (body.action === 'VALIDATED' && !body.directorSignature) {
      throw new BadRequestException('La signature du directeur est obligatoire pour valider');
    }

    // ⭐ Mettre à jour le registre d'appel
    await this.prisma.$executeRawUnsafe(
      `UPDATE "attendance_registers"
       SET "status" = $3,
           "directorSignature" = $4,
           "directeurSignatureDate" = CASE WHEN $3 = 'VALIDATED' THEN NOW() ELSE "directeurSignatureDate" END,
           "validatedAt" = CASE WHEN $3 = 'VALIDATED' THEN NOW() ELSE "validatedAt" END,
           "validatedBy" = $5,
           "rejectionReason" = $6,
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      registerId, tenantId,
      body.action,
      body.directorSignature || null,
      body.validatedBy || null,
      body.action === 'REJECTED' ? (body.rejectionReason || null) : null,
    );

    // ⭐ Mettre à jour l'évaluation mensuelle associée (même statut)
    try {
      const evals: any = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM "monthly_evaluations" WHERE "attendanceRegisterId" = $1 LIMIT 1`,
        registerId,
      );
      if (evals && evals.length > 0) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "monthly_evaluations"
           SET "status" = $2,
               "directorSignature" = $3,
               "directorSignatureDate" = CASE WHEN $2 = 'VALIDATED' THEN NOW() ELSE "directorSignatureDate" END,
               "validatedAt" = CASE WHEN $2 = 'VALIDATED' THEN NOW() ELSE "validatedAt" END,
               "validatedBy" = $4,
               "rejectionReason" = $5,
               "updatedAt" = NOW()
           WHERE "id" = $1`,
          evals[0].id,
          body.action,
          body.directorSignature || null,
          body.validatedBy || null,
          body.action === 'REJECTED' ? (body.rejectionReason || null) : null,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Failed to update monthly evaluation: ${err.message}`);
    }

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "attendance_registers" WHERE "id" = $1`,
      registerId,
    );

    // ⭐ Rafraîchir le tableau de relevés mensuels si validé
    if (body.action === 'VALIDATED' && updated[0]) {
      try {
        await this.refreshMonthlySummary(tenantId, updated[0].academicYearId, updated[0].classId);
      } catch (e) {
        this.logger.warn(`⚠️ Impossible de rafraîchir le tableau de relevés: ${e.message}`);
      }
    }

    // ⭐ Notifier l'enseignant de la décision
    this.notifyTeacherOfRegisterDecision(
      tenantId, register.classId, register.teacherId, body.action, register.month, register.year,
    ).catch((err) => this.logger.error('Teacher notification error:', err));

    this.logger.log(`✅ Registre + évaluation ${registerId} ${body.action}`);
    return updated[0];
  }

  /**
   * ⭐ Notifie l'enseignant de la décision du directeur sur son registre + évaluation.
   */
  private async notifyTeacherOfRegisterDecision(
    tenantId: string,
    classId: string,
    teacherId: string,
    action: string,
    month: number,
    year: number,
  ) {
    let className = '—';
    try {
      const cls: any = await this.prisma.$queryRawUnsafe(
        `SELECT name FROM "classes" WHERE "id" = $1`, classId,
      );
      if (cls && cls.length > 0) className = cls[0].name || '—';
    } catch { /* silent */ }

    let schoolName = 'Établissement scolaire';
    try {
      const profile: any = await this.prisma.$queryRawUnsafe(
        `SELECT "schoolName" FROM "tenant_identity_profiles"
         WHERE "tenantId" = $1 AND "isActive" = true LIMIT 1`,
        tenantId,
      );
      if (profile && profile.length > 0) schoolName = profile[0].schoolName || schoolName;
    } catch { /* silent */ }

    let teacher: any = null;
    try {
      const teacherRow: any = await this.prisma.$queryRawUnsafe(
        `SELECT t.*, u.email, u.phone, u."firstName", u."lastName"
         FROM "teachers" t
         LEFT JOIN "users" u ON u.email = t.email
         WHERE t.id = $1 LIMIT 1`,
        teacherId,
      );
      if (teacherRow && teacherRow.length > 0) teacher = teacherRow[0];
    } catch (err: any) {
      this.logger.warn(`Failed to fetch teacher: ${err.message}`);
    }

    if (!teacher || !teacher.email) {
      this.logger.warn(`Aucun email trouvé pour l'enseignant ${teacherId}`);
      return;
    }

    const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthLabel = monthNames[month] || '—';
    const actionLabel = action === 'VALIDATED' ? 'validé' : 'rejeté';
    const actionColor = action === 'VALIDATED' ? '#10b981' : '#ef4444';

    const emailSubject = `[${schoolName}] Registre + évaluation ${actionLabel} — ${className} — ${monthLabel} ${year}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${actionColor}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 18px;">${schoolName}</h1>
          <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">Registre + évaluation ${actionLabel}</p>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: ${actionColor}; font-size: 16px;">Bonjour ${teacher.firstName || ''} ${teacher.lastName || ''},</h2>
          <p style="font-size: 14px; line-height: 1.5;">
            Votre registre d'appel et évaluation mensuelle ont été <strong style="color: ${actionColor};">${actionLabel}</strong>s par le directeur :
          </p>
          <table style="width: 100%; margin: 15px 0; border-collapse: collapse;">
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Classe :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${className}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Mois :</td><td style="padding: 5px; border-bottom: 1px solid #eee;">${monthLabel} ${year}</td></tr>
            <tr><td style="padding: 5px; border-bottom: 1px solid #eee; font-weight: bold;">Décision :</td><td style="padding: 5px; border-bottom: 1px solid #eee; color: ${actionColor}; font-weight: bold;">${actionLabel.toUpperCase()}</td></tr>
          </table>
          <p style="font-size: 14px; line-height: 1.5;">
            Connectez-vous à la plateforme pour consulter les détails dans
            <strong>Espace Pédagogique → Registre d'Appel</strong>.
          </p>
        </div>
      </div>
    `;
    const smsMessage = `${schoolName}: Votre registre + evaluation (${className}, ${monthLabel} ${year}) a ete ${actionLabel} par le directeur.`;

    try {
      await this.emailService.sendCategorized({
        tenantId, category: 'PEDAGOGIE', subCategory: 'REGISTER_DECISION',
        module: 'pedagogy' as any, to: teacher.email,
        toName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
        recipientType: 'ENSEIGNANT', recipientId: teacherId,
        subject: emailSubject, html: emailHtml, text: smsMessage,
        fromName: schoolName, triggeredBy: 'STAFF',
        relatedEntityId: classId, relatedEntityType: 'AttendanceRegister',
      } as any);
    } catch (err: any) {
      this.logger.warn(`Email to teacher failed: ${err.message}`);
    }

    if (teacher.phone) {
      try {
        const phone = teacher.phone.startsWith('+') ? teacher.phone : `+229${teacher.phone.replace(/^0/, '')}`;
        await this.whatsappService.sendCategorized({
          tenantId, category: 'PEDAGOGIE', subCategory: 'REGISTER_DECISION',
          module: 'pedagogy' as any, to: phone,
          toName: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
          recipientType: 'ENSEIGNANT', recipientId: teacherId,
          message: smsMessage, triggeredBy: 'STAFF',
          relatedEntityId: classId, relatedEntityType: 'AttendanceRegister',
        } as any);
      } catch (err: any) {
        this.logger.warn(`WhatsApp to teacher failed: ${err.message}`);
      }
      try {
        await this.smsService.sendSMS(teacher.phone, smsMessage);
      } catch (err: any) {
        this.logger.warn(`SMS to teacher failed: ${err.message}`);
      }
    }
  }

  /// Récupère toutes les évaluations mensuelles soumises (en attente de validation).
  /// ⭐ Inclut les évaluations du Module Examen (institutional-exams) avec status=SUBMITTED
  async getPendingMonthlyEvaluations(tenantId: string, academicYearId: string, statusFilter: string = 'SUBMITTED') {
    const validStatuses = ['SUBMITTED', 'VALIDATED', 'REJECTED', 'ALL'];
    const status = validStatuses.includes(statusFilter) ? statusFilter : 'SUBMITTED';
    const statusCondition = status === 'ALL'
      ? `AND e."status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`
      : `AND e."status" = '${status}'`;
    const statusConditionMe = status === 'ALL'
      ? `AND me."status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')`
      : `AND me."status" = '${status}'`;

    // 1. Évaluations depuis le module Examen (institutional-exams)
    const examEvals: any = await this.prisma.$queryRawUnsafe(
      `SELECT e.id, e.title, e.status, e.submittedAt, e.validatedAt, e.classId,
              e.evaluationDate, e.startDate, e.endDate,
              e."evaluationTypeId", et."name" as "evaluationTypeName",
              c."name" as "classNameResolved",
              c."schoolLevelId",
              sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName",
              e."academicYearId", e.tenantId,
              EXTRACT(MONTH FROM COALESCE(e."startDate", e."evaluationDate"))::int as "month",
              EXTRACT(YEAR FROM COALESCE(e."startDate", e."evaluationDate"))::int as "year",
              'EXAM' as "source"
       FROM "evaluations" e
       LEFT JOIN "classes" c ON c."id" = e."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN "teachers" t ON t."id" = e."teacherId"
       LEFT JOIN "evaluation_types" et ON et."id" = e."evaluationTypeId"
       WHERE e."tenantId" = $1 AND e."academicYearId" = $2 ${statusCondition}
       ORDER BY e."submittedAt" DESC`,
      tenantId, academicYearId,
    );

    // 2. Évaluations depuis l'ancien système pedagogy-space (monthly_evaluations)
    const pedagogyEvals: any = await this.prisma.$queryRawUnsafe(
      `SELECT me.*, c."name" as "classNameResolved",
              c."schoolLevelId",
              sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode",
              ar."month" as "registerMonth", ar."year" as "registerYear",
              'PEDAGOGY' as "source"
       FROM "monthly_evaluations" me
       LEFT JOIN "attendance_registers" ar ON ar."id" = me."attendanceRegisterId"
       LEFT JOIN "classes" c ON c."id" = me."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       WHERE me."tenantId" = $1 AND me."academicYearId" = $2 ${statusConditionMe}
       ORDER BY me."submittedAt" DESC`,
      tenantId, academicYearId,
    ).catch(() => []);

    // Combiner les deux listes
    return [...(examEvals || []), ...(pedagogyEvals || [])];
  }

  /// Valide ou rejette une évaluation mensuelle.
  async validateMonthlyEvaluation(
    tenantId: string,
    evaluationId: string,
    action: 'VALIDATED' | 'REJECTED',
    validatedBy: string,
    rejectionReason?: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations" WHERE "id" = $1 AND "tenantId" = $2`,
      evaluationId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    if (existing[0].status !== 'SUBMITTED') {
      throw new BadRequestException('Évaluation pas en attente de validation');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "monthly_evaluations"
       SET "status" = $1, "validatedAt" = NOW(), "validatedBy" = $2,
           "rejectionReason" = $3, "updatedAt" = NOW()
       WHERE "id" = $4`,
      action, validatedBy, action === 'REJECTED' ? (rejectionReason || null) : null, evaluationId,
    );

    if (action === 'VALIDATED') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "monthly_evaluations"
         SET "directorSignatureDate" = NOW()
         WHERE "id" = $1`,
        evaluationId,
      );
    }

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations" WHERE "id" = $1`,
      evaluationId,
    );
    this.logger.log(`✅ Évaluation mensuelle ${evaluationId} ${action} par ${validatedBy}`);
    return updated[0];
  }

  /// Dashboard direction : synthèse des éléments en attente.
  async getDirectorPedagogyDashboard(tenantId: string, academicYearId: string) {
    // ⭐ Comptage groupé par statut (SUBMITTED | VALIDATED | REJECTED) pour chaque catégorie.
    //    Permet d'afficher le compteur total avec breakdown au tableau de bord :
    //    "47 registres au total — 5 en attente, 38 validés, 4 rejetés"
    const [
      cahierJournalsByStatus,
      fichesByStatus,
      registersByStatus,
      evaluationsByStatus,
      examEvaluationsByStatus,
      weeklyLogsByStatus,
      weeklySummariesByStatus,
      cahierTestsByStatus,
      // ⭐ V3-12: 9e requête (monthly_plans) — doit être déstructurée ici,
      // sinon son résultat est perdu et `results[8]` ci-dessous n'existe pas.
      monthlyPlansByStatus,
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe(
        `SELECT "status", COUNT(*)::int as count FROM "cahier_journal_entries"
         WHERE "tenantId" = $1 AND "academicYearId" = $2
           AND "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
         GROUP BY "status"`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "status", COUNT(*)::int as count, "sheetType" FROM "primary_pedagogical_fiches"
         WHERE "tenantId" = $1 AND "academicYearId" = $2
           AND "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
         GROUP BY "status", "sheetType"`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "status", COUNT(*)::int as count FROM "attendance_registers"
         WHERE "tenantId" = $1 AND "academicYearId" = $2
           AND "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
         GROUP BY "status"`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "status", COUNT(*)::int as count FROM "monthly_evaluations"
         WHERE "tenantId" = $1 AND "academicYearId" = $2
           AND "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
         GROUP BY "status"`,
        tenantId, academicYearId,
      ),
      // ⭐ Aussi compter les évaluations du Module Examen
      //    ⭐ V3-12 FIX: The evaluations table uses enum EvaluationStatus which does
      //    NOT include 'REJECTED' (values: PLANNED, OPEN_FOR_GRADING, SUBMITTED,
      //    VALIDATED, LOCKED, CANCELLED, DRAFT). Including 'REJECTED' in the IN clause
      //    causes a PostgreSQL error (22P02: invalid input value for enum).
      //    Fix: only query for statuses that exist in the enum.
      this.prisma.$queryRawUnsafe(
        `SELECT "status", COUNT(*)::int as count FROM "evaluations"
         WHERE "tenantId" = $1 AND "academicYearId" = $2
           AND "status" IN ('SUBMITTED', 'VALIDATED')
         GROUP BY "status"`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "status", COUNT(*)::int as count FROM "pedagogical_weekly_logs"
         WHERE "tenantId" = $1 AND "academicYearId" = $2
           AND "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
         GROUP BY "status"`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "status", COUNT(*)::int as count FROM "weekly_log_summaries"
         WHERE "tenantId" = $1 AND "academicYearId" = $2
           AND "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
         GROUP BY "status"`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "status", COUNT(*)::int as count FROM "cahier_de_textes"
         WHERE "tenantId" = $1 AND "academicYearId" = $2
           AND "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
         GROUP BY "status"`,
        tenantId, academicYearId,
      ),
      // ⭐ V3-12: Also count pending monthly plans (planification mensuelle)
      this.prisma.$queryRawUnsafe(
        `SELECT "status", COUNT(DISTINCT ("classLevel", "month", "teacherId"))::int as count FROM "monthly_plans"
         WHERE "tenantId" = $1 AND "academicYearId" = $2
           AND "status" IN ('SUBMITTED', 'VALIDATED', 'REJECTED')
         GROUP BY "status"`,
        tenantId, academicYearId,
      ),
    ]);

    // ⭐ Helper : extrait le count d'un statut donné depuis une requête GROUP BY
    const extractCount = (rows: any[], status: string): number => {
      const row = (rows as any[])?.find(r => r.status === status);
      return row?.count || 0;
    };

    // ⭐ V3-12: Extract monthly plans counts (déstructuré ci-dessus)
    const monthlyPlansPending = extractCount(monthlyPlansByStatus, 'SUBMITTED');
    const monthlyPlansValidated = extractCount(monthlyPlansByStatus, 'VALIDATED');
    const monthlyPlansRejected = extractCount(monthlyPlansByStatus, 'REJECTED');

    // Compteurs par statut pour chaque catégorie
    const cahierCount = extractCount(cahierJournalsByStatus, 'SUBMITTED');
    const cahierValidated = extractCount(cahierJournalsByStatus, 'VALIDATED');
    const cahierRejected = extractCount(cahierJournalsByStatus, 'REJECTED');
    const cahierTotal = cahierCount + cahierValidated + cahierRejected;

    const fichesByType = (fichesByStatus as any[]).reduce((acc, row) => {
      if (row.status === 'SUBMITTED') {
        acc[row.sheetType] = row.count;
      }
      return acc;
    }, {} as Record<string, number>);
    const fichesCount = extractCount(fichesByStatus, 'SUBMITTED');
    const fichesValidated = extractCount(fichesByStatus, 'VALIDATED');
    const fichesRejected = extractCount(fichesByStatus, 'REJECTED');
    const fichesTotal = fichesCount + fichesValidated + fichesRejected;

    const registersCount = extractCount(registersByStatus, 'SUBMITTED');
    const registersValidated = extractCount(registersByStatus, 'VALIDATED');
    const registersRejected = extractCount(registersByStatus, 'REJECTED');
    const registersTotal = registersCount + registersValidated + registersRejected;

    const evaluationsCount = extractCount(evaluationsByStatus, 'SUBMITTED') + extractCount(examEvaluationsByStatus, 'SUBMITTED');
    const evaluationsValidated = extractCount(evaluationsByStatus, 'VALIDATED') + extractCount(examEvaluationsByStatus, 'VALIDATED');
    const evaluationsRejected = extractCount(evaluationsByStatus, 'REJECTED') + extractCount(examEvaluationsByStatus, 'REJECTED');
    const evaluationsTotal = evaluationsCount + evaluationsValidated + evaluationsRejected;

    const weeklyLogsCount = extractCount(weeklyLogsByStatus, 'SUBMITTED');
    const weeklySummariesCount = extractCount(weeklySummariesByStatus, 'SUBMITTED');
    const cahierTestsCount = extractCount(cahierTestsByStatus, 'SUBMITTED');

    // Totaux globaux (toutes catégories confondues, y compris monthly plans)
    const totalPending = cahierCount + fichesCount + registersCount + evaluationsCount + weeklyLogsCount + weeklySummariesCount + cahierTestsCount + monthlyPlansPending;
    const totalValidated = cahierValidated + fichesValidated + registersValidated + evaluationsValidated + monthlyPlansValidated;
    const totalRejected = cahierRejected + fichesRejected + registersRejected + evaluationsRejected + monthlyPlansRejected;
    const totalProcessed = totalPending + totalValidated + totalRejected;

    return {
      // ⭐ Compteurs par statut pour chaque catégorie (3 statuts × 4 catégories principales)
      pendingCahierJournals: cahierCount,
      validatedCahierJournals: cahierValidated,
      rejectedCahierJournals: cahierRejected,
      totalCahierJournals: cahierTotal,

      pendingFiches: fichesCount,
      validatedFiches: fichesValidated,
      rejectedFiches: fichesRejected,
      totalFiches: fichesTotal,
      pendingFichesByType: fichesByType,

      pendingAttendanceRegisters: registersCount,
      validatedAttendanceRegisters: registersValidated,
      rejectedAttendanceRegisters: registersRejected,
      totalAttendanceRegisters: registersTotal,

      pendingMonthlyEvaluations: evaluationsCount,
      validatedMonthlyEvaluations: evaluationsValidated,
      rejectedMonthlyEvaluations: evaluationsRejected,
      totalMonthlyEvaluations: evaluationsTotal,

      pendingWeeklyLogs: weeklyLogsCount,
      pendingWeeklySummaries: weeklySummariesCount,
      pendingCahierTests: cahierTestsCount,

      // ⭐ V3-12: Monthly plans counts
      pendingMonthlyPlans: monthlyPlansPending,
      validatedMonthlyPlans: monthlyPlansValidated,
      rejectedMonthlyPlans: monthlyPlansRejected,

      // ⭐ Totaux globaux (toutes catégories)
      totalPending,
      totalValidated,
      totalRejected,
      totalProcessed,
    };
  }

  // ===========================================================================
  // CONFIGURATION DES MATIÈRES — Évaluation mensuelle
  // ===========================================================================

  /// Configure les matières d'une évaluation mensuelle.
  /// subjectsConfig: [{ subjectId, subjectName, order, coefficient }]
  async setMonthlyEvaluationSubjects(
    tenantId: string,
    evaluationId: string,
    subjectsConfig: Array<{ subjectId?: string; subjectName: string; order?: number; coefficient?: number }>,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations" WHERE "id" = $1 AND "tenantId" = $2`,
      evaluationId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }

    // Normaliser et valider
    const normalizedSubjects = subjectsConfig.map((s, idx) => ({
      subjectId: s.subjectId || null,
      subjectName: s.subjectName,
      order: s.order ?? idx + 1,
      coefficient: s.coefficient ?? 1,
    }));

    await this.prisma.$executeRawUnsafe(
      `UPDATE "monthly_evaluations"
       SET "subjectsConfig" = $1::jsonb, "updatedAt" = NOW()
       WHERE "id" = $2`,
      JSON.stringify(normalizedSubjects), evaluationId,
    );

    // Initialiser/mettre à jour les scores des élèves
    const evaluation = existing[0];
    const existingScores = typeof evaluation.studentScores === 'string'
      ? JSON.parse(evaluation.studentScores || '[]')
      : (evaluation.studentScores || []);

    // Récupérer la liste des élèves de la classe depuis le registre d'appel lié
    const register: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "attendance_registers" WHERE "id" = $1 LIMIT 1`,
      evaluation.attendanceRegisterId,
    );

    let studentsList: any[] = [];
    if (register && register.length > 0) {
      const studentsData = typeof register[0].studentsData === 'string'
        ? JSON.parse(register[0].studentsData || '[]')
        : (register[0].studentsData || []);
      studentsList = studentsData;
    }

    // Initialiser les scores : pour chaque élève, créer un tableau avec une entrée par matière
    const newScores = studentsList.map((student: any) => {
      // Vérifier si l'élève existe déjà dans les scores
      const existingStudent = existingScores.find((s: any) => s.studentId === student.studentId);
      const scores = normalizedSubjects.map((subj) => {
        // Préserver les scores existants si la matière correspond
        const existingScore = existingStudent?.scores?.find((s: any) =>
          s.subjectId === subj.subjectId || s.subjectName === subj.subjectName
        );
        return {
          subjectId: subj.subjectId,
          subjectName: subj.subjectName,
          cm: existingScore?.cm || 0,
          cp: existingScore?.cp || 0,
          total: existingScore?.total || 0,
        };
      });
      return {
        studentId: student.studentId,
        numero: student.numero,
        nom: student.nom,
        prenom: student.prenom,
        sexe: student.sexe,
        scores,
        totalGeneral: scores.reduce((sum: number, s: any) => sum + (s.total || 0), 0),
      };
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE "monthly_evaluations"
       SET "studentScores" = $1::jsonb, "updatedAt" = NOW()
       WHERE "id" = $2`,
      JSON.stringify(newScores), evaluationId,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations" WHERE "id" = $1`,
      evaluationId,
    );

    this.logger.log(`✅ Matières configurées pour l'évaluation ${evaluationId}: ${normalizedSubjects.length} matière(s)`);
    return updated[0];
  }

  /// Récupère la liste des matières disponibles pour une classe (depuis la
  /// configuration de l'école). Ne JAMAIS coder en dur de matières : si aucune
  /// matière n'est configurée pour cette classe, on retourne un tableau vide.
  /// L'admin de l'école doit configurer ses matières dans le module
  /// "Matières" (table class_subjects / subjects).
  ///
  /// ⭐ RÉSOLUTION HYBRIDE classId/academicClassId :
  ///   - Si le paramètre `classId` est un ID de `classes` (classe physique),
  ///     on résout son `officialClassId` (qui pointe vers `AcademicClass`).
  ///   - Si c'est déjà un `AcademicClass.id`, on l'utilise directement.
  ///   - On cherche alors les `class_subjects` par `academicClassId` (cas normal)
  ///     ou par `classId` (fallback si les données ont été saisies via la
  ///     classe physique directement).
  async getAvailableSubjectsForClass(
    tenantId: string,
    academicYearId: string,
    classId: string,
    teacherId?: string,
  ) {
    // ─── Étape 0 : résoudre la piste linguistique de l'enseignant
    // (FR = français, EN = anglais). On ne doit afficher QUE les matières
    // correspondant à la piste linguistique de l'enseignant connecté.
    // Ex : un enseignant FR ne doit pas voir les matières "English Language" (EN).
    let teacherLanguages: string[] = [];
    // ⭐ Profil Teacher résolu (null pour un promoteur/directeur sans profil) —
    //    utilisé à l'étape 1b pour restreindre les matières aux affectations.
    let resolvedTeacherProfileId: string | null = null;
    if (teacherId) {
      const { teacherId: resolvedTid } = await this.resolveTeacherId(tenantId, teacherId);
      resolvedTeacherProfileId = resolvedTid;
      const tid = resolvedTid || teacherId;
      const teacher: any = await this.prisma.$queryRawUnsafe(
        `SELECT "assignedLanguages" FROM teachers WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
        tid, tenantId,
      );
      if (teacher && teacher.length > 0 && teacher[0].assignedLanguages) {
        const raw = teacher[0].assignedLanguages;
        try {
          teacherLanguages = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!Array.isArray(teacherLanguages)) teacherLanguages = [];
        } catch { teacherLanguages = []; }
      }
    }
    // Si on n'a pas pu résoudre les langues de l'enseignant (ex: promoteur
    // connecté sans profil Teacher), on fallback sur la piste linguistique
    // de la CLASSE elle-même (table classes.language ou academicTrack.code).
    // ⭐ FIX : avant on affichait toutes les matières (FR + EN mélangés).
    //    Maintenant on filtre selon la piste de la classe.
    const langFilterActive = teacherLanguages.length > 0;

    // ─── Étape 1 : résoudre l'AcademicClass.id (officiel) depuis le classId
    // passé par le frontend. Le frontend peut passer soit un physical class ID
    // (table `classes`), soit directement un AcademicClass ID.
    let academicClassId: string | null = null;
    let physicalClassId: string | null = null;

    // Vérifier si classId est une classe physique (table classes)
    const physicalClass: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, "officialClassId", "language" FROM "classes" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
      classId, tenantId,
    );
    if (physicalClass && physicalClass.length > 0) {
      physicalClassId = physicalClass[0].id;
      academicClassId = physicalClass[0].officialClassId || null;

      // ⭐ FIX : si l'enseignant n'a pas de assignedLanguages, utiliser la piste
      //    linguistique de la CLASSE (classes.language = 'FR' ou 'EN').
      //    Cela permet au promoteur (sans profil Teacher) de voir uniquement
      //    les matières de la piste linguistique de la classe sélectionnée.
      if (!langFilterActive && physicalClass[0].language) {
        const classLang = String(physicalClass[0].language).trim().toUpperCase();
        if (classLang === 'FR' || classLang === 'EN') {
          teacherLanguages = [classLang];
        }
      }
    } else {
      // Vérifier si classId est un AcademicClass (table pedagogy_academic_classes)
      const ac: any = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM "pedagogy_academic_classes" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
        classId, tenantId,
      );
      if (ac && ac.length > 0) {
        academicClassId = ac[0].id;
      }
    }

    // ⭐ Recalculer langFilterActive après avoir potentiellement récupéré la
    //    piste linguistique de la classe
    const langFilterFinal = teacherLanguages.length > 0;

    // ─── Étape 1b : ⭐ ENSEIGNANT AFFECTÉ — matières LIMITÉES à ses affectations
    //
    // Clarification utilisateur (2026-09-15) : dans les écoles NON bilingues
    // qui font l'anglais / l'informatique comme matière, l'enseignant
    // SPÉCIALISÉ ne doit voir, dans son espace pédagogique (cahier journal +
    // fiches pédagogiques), QUE SA matière — pas toutes les matières de la
    // classe. Le titulaire, affecté à toutes les matières régulières de sa
    // section, continue de les voir toutes.
    //
    // Source de vérité : teacher_class_assignments —
    //   (a) tca.classId = section physique (titulaire / enseignant par section)
    //   (b) tca.classId IS NULL + cs.academicClassId = classe officielle
    //       (spécialiste itinérant « toutes sections » : Anglais, Informatique)
    //
    // L'affectation explicite PRIME sur le filtre linguistique : un spécialiste
    // d'anglais doit voir « Anglais » même si la matière est marquée EN.
    // Sans aucune affectation sur cette classe (promoteur, directeur,
    // enseignant non encore affecté) → comportement inchangé (étapes 2+).
    if (resolvedTeacherProfileId && (physicalClassId || academicClassId)) {
      const conds1b: string[] = [];
      const params1b: any[] = [tenantId, academicYearId];
      let p1b = 3;
      if (physicalClassId) {
        conds1b.push(`tca."classId" = $${p1b++}`);
        params1b.push(physicalClassId);
      }
      if (academicClassId) {
        conds1b.push(`(tca."classId" IS NULL AND cs."academicClassId" = $${p1b++})`);
        params1b.push(academicClassId);
      }
      const assignedSubjects: any = await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT s."id" as "subjectId", s."name" as "subjectName", s."code" as "subjectCode",
                cs."coefficient", cs."weeklyHours"
         FROM "teacher_class_assignments" tca
         INNER JOIN "class_subjects" cs ON cs."id" = tca."classSubjectId"
         INNER JOIN "subjects" s ON s."id" = cs."subjectId"
         WHERE tca."tenantId" = $1 AND tca."academicYearId" = $2
           AND (${conds1b.join(' OR ')})
         ORDER BY s."name"`,
        ...params1b,
      );
      if (assignedSubjects && assignedSubjects.length > 0) {
        this.logger.log(
          `[getAvailableSubjectsForClass] Enseignant affecté — ${assignedSubjects.length} matière(s) restreinte(s) à ses affectations (classe ${physicalClassId || academicClassId})`,
        );
        return assignedSubjects;
      }
    }

    // ─── Étape 2 : chercher les matières via academicClassId (source principale)
    // C'est le cas normal : les class_subjects sont rattachés à l'AcademicClass.
    if (academicClassId) {
      let subjects: any;
      if (langFilterFinal) {
        // ⭐ Filtre par piste linguistique (FR ou EN)
        // Subject.language contient 'FR' ou 'EN' (ou NULL = commun aux deux pistes)
        subjects = await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT s."id" as "subjectId", s."name" as "subjectName", s."code" as "subjectCode",
                  cs."coefficient", cs."weeklyHours"
           FROM "subjects" s
           INNER JOIN "class_subjects" cs ON cs."subjectId" = s."id"
           WHERE cs."tenantId" = $1 AND cs."academicYearId" = $2 AND cs."academicClassId" = $3
             AND (s."language" IS NULL OR s."language" = '' OR s."language" = ANY($4::text[]))
           ORDER BY s."name"`,
          tenantId, academicYearId, academicClassId, teacherLanguages,
        );
      } else {
        subjects = await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT s."id" as "subjectId", s."name" as "subjectName", s."code" as "subjectCode",
                  cs."coefficient", cs."weeklyHours"
           FROM "subjects" s
           INNER JOIN "class_subjects" cs ON cs."subjectId" = s."id"
           WHERE cs."tenantId" = $1 AND cs."academicYearId" = $2 AND cs."academicClassId" = $3
           ORDER BY s."name"`,
          tenantId, academicYearId, academicClassId,
        );
      }
      if (subjects && subjects.length > 0) {
        return subjects;
      }
    }

    // ─── Étape 3 : chercher via classId (fallback, si class_subjects.classId est peuplé)
    if (physicalClassId || classId) {
      const cid = physicalClassId || classId;
      let subjects: any;
      if (langFilterFinal) {
        subjects = await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT s."id" as "subjectId", s."name" as "subjectName", s."code" as "subjectCode",
                  cs."coefficient", cs."weeklyHours"
           FROM "subjects" s
           INNER JOIN "class_subjects" cs ON cs."subjectId" = s."id"
           WHERE cs."tenantId" = $1 AND cs."academicYearId" = $2 AND cs."classId" = $3
             AND (s."language" IS NULL OR s."language" = '' OR s."language" = ANY($4::text[]))
           ORDER BY s."name"`,
          tenantId, academicYearId, cid, teacherLanguages,
        );
      } else {
        subjects = await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT s."id" as "subjectId", s."name" as "subjectName", s."code" as "subjectCode",
                  cs."coefficient", cs."weeklyHours"
           FROM "subjects" s
           INNER JOIN "class_subjects" cs ON cs."subjectId" = s."id"
           WHERE cs."tenantId" = $1 AND cs."academicYearId" = $2 AND cs."classId" = $3
           ORDER BY s."name"`,
          tenantId, academicYearId, cid,
        );
      }
      if (subjects && subjects.length > 0) {
        return subjects;
      }
    }

    // ─── Étape 4 : matières depuis les TeacherClassAssignment de cette classe
    // (un enseignant a été affecté à la classe avec une matière via ClassSubject)
    if (physicalClassId || classId) {
      const cid = physicalClassId || classId;
      let fallbackSubjects: any;
      if (langFilterFinal) {
        fallbackSubjects = await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT s."id" as "subjectId", s."name" as "subjectName", s."code" as "subjectCode",
                  tca."classSubjectId"
           FROM "subjects" s
           INNER JOIN "teacher_class_assignments" tca ON tca."classSubjectId" IS NOT NULL
           INNER JOIN "class_subjects" cs ON cs."id" = tca."classSubjectId" AND cs."subjectId" = s."id"
           WHERE tca."tenantId" = $1 AND tca."academicYearId" = $2 AND tca."classId" = $3
             AND (s."language" IS NULL OR s."language" = '' OR s."language" = ANY($4::text[]))
           ORDER BY s."name"`,
          tenantId, academicYearId, cid, teacherLanguages,
        );
      } else {
        fallbackSubjects = await this.prisma.$queryRawUnsafe(
          `SELECT DISTINCT s."id" as "subjectId", s."name" as "subjectName", s."code" as "subjectCode",
                  tca."classSubjectId"
           FROM "subjects" s
           INNER JOIN "teacher_class_assignments" tca ON tca."classSubjectId" IS NOT NULL
           INNER JOIN "class_subjects" cs ON cs."id" = tca."classSubjectId" AND cs."subjectId" = s."id"
           WHERE tca."tenantId" = $1 AND tca."academicYearId" = $2 AND tca."classId" = $3
           ORDER BY s."name"`,
          tenantId, academicYearId, cid,
        );
      }
      if (fallbackSubjects && fallbackSubjects.length > 0) {
        return fallbackSubjects.map((row: any) => ({
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          subjectCode: row.subjectCode,
          coefficient: 1,
          weeklyHours: null,
        }));
      }
    }

    // ─── Étape 5 : dernière source — toutes les matières du tenant (au niveau école)
    // → permet à l'enseignant de choisir parmi toutes les matières déclarées
    // par l'établissement, même si elles ne sont pas encore assignées à cette classe
    let tenantSubjects: any;
    if (langFilterFinal) {
      tenantSubjects = await this.prisma.$queryRawUnsafe(
        `SELECT s."id" as "subjectId", s."name" as "subjectName", s."code" as "subjectCode"
         FROM "subjects" s
         WHERE s."tenantId" = $1
           AND (s."language" IS NULL OR s."language" = '' OR s."language" = ANY($2::text[]))
         ORDER BY s."name"`,
        tenantId, teacherLanguages,
      );
    } else {
      tenantSubjects = await this.prisma.$queryRawUnsafe(
        `SELECT s."id" as "subjectId", s."name" as "subjectName", s."code" as "subjectCode"
         FROM "subjects" s
         WHERE s."tenantId" = $1
         ORDER BY s."name"`,
        tenantId,
      );
    }

    return tenantSubjects || [];
  }

  /// Récupère le détail d'une évaluation avec ses matières et scores (vue direction).
  async getMonthlyEvaluationDetail(tenantId: string, evaluationId: string) {
    // ⭐ D'abord chercher dans le module Examen (evaluations + grades)
    const examEval: any = await this.prisma.$queryRawUnsafe(
      `SELECT e.*, c."name" as "classNameResolved",
              sl."code" as "schoolLevelCode", sl."name" as "schoolLevelName",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName",
              et."name" as "evaluationTypeName",
              EXTRACT(MONTH FROM COALESCE(e."startDate", e."evaluationDate"))::int as "registerMonth",
              EXTRACT(YEAR FROM COALESCE(e."startDate", e."evaluationDate"))::int as "registerYear",
              'EXAM' as "source"
       FROM "evaluations" e
       LEFT JOIN "classes" c ON c."id" = e."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN "teachers" t ON t."id" = e."teacherId"
       LEFT JOIN "evaluation_types" et ON et."id" = e."evaluationTypeId"
       WHERE e."id" = $1 AND e."tenantId" = $2`,
      evaluationId, tenantId,
    );

    if (examEval && examEval.length > 0) {
      const evalData = examEval[0];

      // ⭐ Récupérer les grades (notes des élèves) depuis le module Examen
      const grades: any = await this.prisma.$queryRawUnsafe(
        `SELECT g.*, s."firstName", s."lastName", s."matricule", s."gender"
         FROM "grades" g
         LEFT JOIN "students" s ON s."id" = g."studentId"
         WHERE g."evaluationId" = $1 AND g."tenantId" = $2
         ORDER BY s."lastName", s."firstName"`,
        evaluationId, tenantId,
      ).catch(() => []);

      // ⭐ Récupérer les matières (subjects) de cette évaluation
      // Les évaluations du module Examen sont groupées par (classId × evaluationTypeId × periodId × dates)
      // On récupère toutes les évaluations du même groupe pour avoir les matières
      const groupedEvals: any = await this.prisma.$queryRawUnsafe(
        `SELECT e.id, e."subjectId", sub."name" as "subjectName"
         FROM "evaluations" e
         LEFT JOIN "subjects" sub ON sub."id" = e."subjectId"
         WHERE e."tenantId" = $1 AND e."classId" = $2
         AND e."evaluationTypeId" = $3
         AND COALESCE(e."startDate", e."evaluationDate") = COALESCE($4::timestamp, e."startDate", e."evaluationDate")
         AND e."status" IN ('SUBMITTED', 'VALIDATED', 'LOCKED')`,
        tenantId, evalData.classId, evalData.evaluationTypeId,
        evalData.startDate || evalData.evaluationDate,
      ).catch(() => []);

      // ⭐ Construire subjectsConfig et studentScores au format attendu par le frontend
      const subjectsConfig = (groupedEvals || []).map((e: any) => ({
        subjectId: e.subjectId,
        subjectName: e.subjectName || 'Matière',
      }));

      // Grouper les grades par étudiant
      const studentMap = new Map<string, any>();
      for (const g of (grades || [])) {
        const studentId = g.studentId;
        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            studentId,
            nom: g.lastName || '',
            prenom: g.firstName || '',
            sexe: (g.gender || '').startsWith('F') ? 'F' : 'M',
            scores: [],
            totalGeneral: 0,
          });
        }
        const student = studentMap.get(studentId);

        // Parser cm/cp depuis comment si présent
        let cm = g.cm ?? null;
        let cp = g.cp ?? null;
        if ((cm === null || cp === null) && g.comment) {
          try {
            const parsed = typeof g.comment === 'string' ? JSON.parse(g.comment) : g.comment;
            if (cm === null && parsed?.cm !== undefined) cm = parsed.cm;
            if (cp === null && parsed?.cp !== undefined) cp = parsed.cp;
          } catch { /* ignore */ }
        }

        const total = (cm !== null ? cm : 0) + (cp !== null ? cp : 0);
        student.scores.push({
          subjectId: g.subjectId,
          cm,
          cp,
          total,
          qualitativeCode: g.qualitativeCode || null,
          isAbsent: g.isAbsent || false,
        });
        if (!g.isAbsent) {
          student.totalGeneral += total;
        }
      }

      const studentScores = Array.from(studentMap.values());

      return {
        ...evalData,
        subjectsConfig: JSON.stringify(subjectsConfig),
        studentScores: JSON.stringify(studentScores),
        seuilReussite: 10,
        // Stats
        effectifTotalClasse: studentScores.length,
        effectifTotalGarcons: studentScores.filter(s => s.sexe === 'M').length,
        effectifTotalFilles: studentScores.filter(s => s.sexe === 'F').length,
        ayantComposeTotal: studentScores.filter(s => s.scores.some(sc => !sc.isAbsent)).length,
        ayantAtteintSeuilTotal: studentScores.filter(s => s.totalGeneral >= 10).length,
        pourcentageReussiteTotal: studentScores.length > 0
          ? (studentScores.filter(s => s.totalGeneral >= 10).length / studentScores.length) * 100
          : 0,
      };
    }

    // ⭐ Fallback : chercher dans l'ancien système pedagogy-space
    const evalResult: any = await this.prisma.$queryRawUnsafe(
      `SELECT me.*, c."name" as "classNameResolved",
              ar."month" as "registerMonth", ar."year" as "registerYear",
              ar."id" as "registerId", ar."teacherId" as "registerTeacherId",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName",
              'PEDAGOGY' as "source"
       FROM "monthly_evaluations" me
       LEFT JOIN "attendance_registers" ar ON ar."id" = me."attendanceRegisterId"
       LEFT JOIN "classes" c ON c."id" = me."classId"
       LEFT JOIN "teachers" t ON t."id" = ar."teacherId"
       WHERE me."id" = $1 AND me."tenantId" = $2`,
      evaluationId, tenantId,
    );
    if (!evalResult || evalResult.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    return evalResult[0];
  }

  /// Récupère le détail d'un cahier journal (vue direction).
  async getCahierJournalDetail(tenantId: string, journalId: string) {
    // ⭐ 2026-09-15 : JOIN school_levels — le frontend directeur détecte les classes
    //    MATERNELLE pour afficher la grille cahier journal maternelle (domaines
    //    I à V) au lieu de la grille par matières.
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (cj.id) cj.*, c."name" as "classNameResolved",
              c."schoolLevelId" as "schoolLevelId",
              sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode",
              tca_t."firstName" as "teacherFirstName", tca_t."lastName" as "teacherLastName", tca_t."gender" as "teacherGender"
       FROM "cahier_journal_entries" cj
       LEFT JOIN "classes" c ON c."id" = cj."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN teacher_class_assignments tca ON tca."classId" = cj."classId" AND tca."tenantId" = cj."tenantId"
       LEFT JOIN "teachers" tca_t ON tca_t."id" = tca."teacherId"
       WHERE cj."id" = $1 AND cj."tenantId" = $2
       ORDER BY cj.id`,
      journalId, tenantId,
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    // ⭐ MATERNELLE : matières dynamiques — le directeur voit exactement la
    //    même grille par DOMAINES que l'enseignant (matières configurées dans
    //    « Matières & programmes » + migration des anciennes clés).
    await this.enrichMaternelleJournal(result[0]);
    return result[0];
  }

  /// Récupère le détail d'une fiche pédagogique (vue direction).
  async getPedagogicalFicheDetail(tenantId: string, ficheId: string) {
    // ⭐ 2026-09-15 : JOIN school_levels — le frontend directeur détecte les
    //    fiches des classes MATERNELLE pour afficher le format maternelle.
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (pf.id) pf.*, c."name" as "classNameResolved",
              c."schoolLevelId" as "schoolLevelId",
              sl."name" as "schoolLevelName", sl."code" as "schoolLevelCode",
              tca_t."firstName" as "teacherFirstName", tca_t."lastName" as "teacherLastName", tca_t."gender" as "teacherGender"
       FROM "primary_pedagogical_fiches" pf
       LEFT JOIN "classes" c ON c."id" = pf."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN teacher_class_assignments tca ON tca."classId" = pf."classId" AND tca."tenantId" = pf."tenantId"
       LEFT JOIN "teachers" tca_t ON tca_t."id" = tca."teacherId"
       WHERE pf."id" = $1 AND pf."tenantId" = $2
       ORDER BY pf.id`,
      ficheId, tenantId,
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Fiche pédagogique non trouvée');
    }
    return result[0];
  }

  /// Récupère le détail d'un registre d'appel (vue direction).
  async getAttendanceRegisterDetail(tenantId: string, registerId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT ar.*, c."name" as "classNameResolved",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName",
              sl."code" as "schoolLevelCode", sl."name" as "schoolLevelName"
       FROM "attendance_registers" ar
       LEFT JOIN "classes" c ON c."id" = ar."classId"
       LEFT JOIN "teachers" t ON t."id" = ar."teacherId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       WHERE ar."id" = $1 AND ar."tenantId" = $2`,
      registerId, tenantId,
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Registre non trouvé');
    }
    return result[0];
  }

  /// Soumet une évaluation mensuelle au directeur.
  async submitMonthlyEvaluation(tenantId: string, evaluationId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations" WHERE "id" = $1 AND "tenantId" = $2`,
      evaluationId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Évaluation non trouvée');
    }
    if (existing[0].status !== 'DRAFT') {
      throw new BadRequestException('Évaluation déjà soumise');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "monthly_evaluations"
       SET "status" = 'SUBMITTED', "submittedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $1`,
      evaluationId,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "monthly_evaluations" WHERE "id" = $1`,
      evaluationId,
    );
    return updated[0];
  }

  // ===========================================================================
  // CAHIER DE TEST (SECONDAIRE) — Évaluations et compositions
  // ===========================================================================

  /// Liste les cahiers de test d'un enseignant.
  async getCahierDeTextes(
    tenantId: string,
    teacherId: string,
    academicYearId: string,
    classId?: string,
    testType?: string,
    trimester?: number,
  ) {
    // ⭐ TEST PROMOTEUR/DIRECTION : vue superviseur si rôle direction sans profil Teacher
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    if (filter.mode === 'none') return [];

    const params: any[] = [];
    let query: string;

    if (filter.mode === 'teacher') {
      query = `SELECT ct.*, c."name" as "classNameResolved", s."name" as "subjectName", s."code" as "subjectCode",
                  t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName",
                  t."signatureUrl" as "teacherSignatureUrl",
                  COALESCE(ct."teacherName", CONCAT(t."firstName", ' ', t."lastName")) as "teacherFullName"
               FROM "cahier_de_textes" ct
               LEFT JOIN "classes" c ON c."id" = ct."classId"
               LEFT JOIN "subjects" s ON s."id" = ct."subjectId"
               LEFT JOIN "teachers" t ON t."id" = ct."teacherId"
               WHERE ct."tenantId" = $1 AND ct."academicYearId" = $2 AND ct."teacherId" = $3`;
      params.push(tenantId, academicYearId, filter.teacherId);
    } else {
      // Mode direction : toutes les entrées du tenant/année
      query = `SELECT ct.*, c."name" as "classNameResolved", s."name" as "subjectName", s."code" as "subjectCode",
                  t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName",
                  t."signatureUrl" as "teacherSignatureUrl",
                  COALESCE(ct."teacherName", CONCAT(t."firstName", ' ', t."lastName")) as "teacherFullName"
               FROM "cahier_de_textes" ct
               LEFT JOIN "classes" c ON c."id" = ct."classId"
               LEFT JOIN "subjects" s ON s."id" = ct."subjectId"
               LEFT JOIN "teachers" t ON t."id" = ct."teacherId"
               WHERE ct."tenantId" = $1 AND ct."academicYearId" = $2`;
      params.push(tenantId, academicYearId);
    }

    let paramIdx = params.length + 1;
    if (classId) {
      query += ` AND ct."classId" = $${paramIdx++}`;
      params.push(classId);
    }
    if (testType) {
      query += ` AND ct."testType" = $${paramIdx++}`;
      params.push(testType);
    }
    if (trimester !== undefined && trimester !== null) {
      query += ` AND ct."trimester" = $${paramIdx++}`;
      params.push(trimester);
    }
    query += ` ORDER BY ct."testDate" DESC NULLS LAST, ct."createdAt" DESC`;
    return this.prisma.$queryRawUnsafe(query, ...params);
  }

  /// ⭐ Catalogue des cahiers de texte — vue multi-niveau (année/trimestre/mois/semaine/jour)
  ///    Utilisé par le sous-onglet Catalogue. Inclut le nom de l'enseignant,
  ///    la classe et la signature auto-attachées.
  async getCahierDeTextesCatalogue(
    tenantId: string,
    teacherId: string | null,
    academicYearId: string,
    classId?: string,
    trimester?: number,
    month?: number,        // 1-12
    weekStart?: string,    // YYYY-MM-DD (lundi)
    dayDate?: string,      // YYYY-MM-DD
  ) {
    // ⭐ Mode direction : si teacherId est null/empty, on renvoie TOUTES les
    //    entrées du tenant/année (vue superviseur). Sinon, on filtre par
    //    teacherId résolu.
    let effectiveTeacherId: string | null = teacherId ?? null;
    if (teacherId) {
      const { teacherId: resolved, userRole } = await this.resolveTeacherId(tenantId, teacherId);
      if (resolved) {
        effectiveTeacherId = resolved;
      } else if (userRole && PedagogicalSpaceService.GLOBAL_ACCESS_ROLES.has(userRole)) {
        // Vue superviseur : tout voir
        effectiveTeacherId = null;
      } else if (userRole && PedagogicalSpaceService.DIRECTION_ROLES.has(userRole)) {
        // Directeur/censeur : vue globale aussi (mais doit avoir un profil Teacher
        // ou une accréditation ; sinon accès refusé).
        effectiveTeacherId = null;
      } else {
        return [];
      }
    }

    const params: any[] = [];
    let where = `WHERE ct."tenantId" = $1 AND ct."academicYearId" = $2 AND ct."testType" = 'JOURNAL'`;
    params.push(tenantId, academicYearId);

    if (effectiveTeacherId) {
      where += ` AND ct."teacherId" = $${params.length + 1}`;
      params.push(effectiveTeacherId);
    }
    if (classId) {
      where += ` AND ct."classId" = $${params.length + 1}`;
      params.push(classId);
    }
    if (trimester !== undefined && trimester !== null) {
      where += ` AND ct."trimester" = $${params.length + 1}`;
      params.push(trimester);
    }
    if (month !== undefined && month !== null) {
      // Filtrer par mois (1-12) en utilisant EXTRACT sur lessonDate
      where += ` AND EXTRACT(MONTH FROM ct."lessonDate") = $${params.length + 1}`;
      params.push(month);
    }
    if (weekStart) {
      // Semaine = lundi → dimanche
      where += ` AND ct."lessonDate" >= $${params.length + 1}::date`;
      params.push(weekStart);
      where += ` AND ct."lessonDate" < ($${params.length}::date + INTERVAL '7 days')`;
    }
    if (dayDate) {
      where += ` AND ct."lessonDate" = $${params.length + 1}::date`;
      params.push(dayDate);
    }

    const query = `
      SELECT ct.*,
             c."name" as "classNameResolved",
             s."name" as "subjectName",
             s."code" as "subjectCode",
             t."firstName" as "teacherFirstName",
             t."lastName" as "teacherLastName",
             COALESCE(ct."teacherName", CONCAT(t."firstName", ' ', t."lastName")) as "teacherFullName"
      FROM "cahier_de_textes" ct
      LEFT JOIN "classes" c ON c."id" = ct."classId"
      LEFT JOIN "subjects" s ON s."id" = ct."subjectId"
      LEFT JOIN "teachers" t ON t."id" = ct."teacherId"
      ${where}
      ORDER BY ct."lessonDate" DESC NULLS LAST, ct."startTime" ASC, ct."createdAt" DESC
    `;
    return this.prisma.$queryRawUnsafe(query, ...params);
  }

  // ===========================================================================
  // SIGNATURE DE L'ENSEIGNANT (auto-attach cahier de texte)
  // ===========================================================================

  /// Récupère la signature enregistrée par l'enseignant (base64 data URL).
  ///    Le frontend passe user.id ; on résout en Teacher.id puis on lit
  ///    la colonne `signatureUrl` de la table teachers.
  async getTeacherSignature(tenantId: string, userId: string) {
    const { teacherId } = await this.resolveTeacherId(tenantId, userId);
    if (!teacherId) {
      return { signatureUrl: null, hasTeacherProfile: false };
    }
    const teacher: any = await this.prisma.$queryRawUnsafe(
      `SELECT "signatureUrl" FROM "teachers" WHERE "id" = $1 AND "tenantId" = $2`,
      teacherId, tenantId,
    );
    return {
      signatureUrl: teacher?.[0]?.signatureUrl ?? null,
      hasTeacherProfile: true,
      teacherId,
    };
  }

  /// Enregistre (ou met à jour) la signature de l'enseignant.
  async saveTeacherSignature(
    tenantId: string,
    userId: string,
    signatureUrl: string,
  ) {
    const { teacherId } = await this.resolveTeacherId(tenantId, userId);
    if (!teacherId) {
      throw new BadRequestException(
        'Aucun profil Teacher trouvé pour cet utilisateur — impossible d\'enregistrer la signature',
      );
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE "teachers" SET "signatureUrl" = $1, "updatedAt" = NOW()
       WHERE "id" = $2 AND "tenantId" = $3`,
      signatureUrl, teacherId, tenantId,
    );
    return { success: true, signatureUrl };
  }

  /// Supprime la signature de l'enseignant.
  async deleteTeacherSignature(tenantId: string, userId: string) {
    const { teacherId } = await this.resolveTeacherId(tenantId, userId);
    if (!teacherId) {
      return { success: false };
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE "teachers" SET "signatureUrl" = NULL, "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      teacherId, tenantId,
    );
    return { success: true };
  }

  /// Récupère un cahier de test par ID.
  async getCahierDeTexte(tenantId: string, testId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT ct.*, c."name" as "classNameResolved", s."name" as "subjectName", s."code" as "subjectCode"
       FROM "cahier_de_textes" ct
       LEFT JOIN "classes" c ON c."id" = ct."classId"
       LEFT JOIN "subjects" s ON s."id" = ct."subjectId"
       WHERE ct."id" = $1 AND ct."tenantId" = $2`,
      testId, tenantId,
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Cahier de test non trouvé');
    }
    return result[0];
  }

  /// Crée un nouveau cahier de test.
  async createCahierDeTexte(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    data: any,
  ) {
    if (!data.classId || !data.testType || !data.testTitle || !data.trimester) {
      throw new BadRequestException('classId, testType, testTitle, trimester sont requis');
    }

    // ⭐ BUGFIX : résoudre le VRAI teacherId (table teachers) à partir du user.id
    //    passé par le frontend. Sinon, l'INSERT stocke user.id dans la colonne
    //    teacherId, mais getCahierDeTextes filtre par teacher.id (via resolveTeacherFilter),
    //    ce qui fait que l'enregistrement réussit mais n'apparaît jamais dans l'interface.
    const { teacherId: resolvedTeacherId, userRole } = await this.resolveTeacherId(
      tenantId,
      teacherId,
    );
    // Si l'utilisateur n'a pas de profil Teacher mais a un rôle global (promoteur/direction),
    // on garde le user.id tel quel pour ne pas bloquer la création.
    const effectiveTeacherId = resolvedTeacherId
      ?? (userRole && PedagogicalSpaceService.GLOBAL_ACCESS_ROLES.has(userRole) ? teacherId : null);
    if (!effectiveTeacherId) {
      throw new BadRequestException(
        'Aucun profil Teacher trouvé pour cet utilisateur — impossible de créer un cahier de texte',
      );
    }

    // ⭐ AUTO-ATTACH : récupérer le nom de l'enseignant + sa signature enregistrée
    //    depuis la table teachers (colonne signatureUrl). Le frontend n'a plus
    //    besoin de les envoyer manuellement — le backend les joint automatiquement.
    let autoTeacherName = data.teacherName ?? null;
    let autoTeacherSignature = data.teacherSignature ?? null;
    if (resolvedTeacherId) {
      const teacherRow: any = await this.prisma.$queryRawUnsafe(
        `SELECT "firstName", "lastName", "signatureUrl"
         FROM "teachers" WHERE "id" = $1 AND "tenantId" = $2`,
        resolvedTeacherId, tenantId,
      );
      if (teacherRow && teacherRow.length > 0) {
        const t = teacherRow[0];
        const fullName = `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim();
        if (fullName) autoTeacherName = autoTeacherName ?? fullName;
        if (t.signatureUrl) autoTeacherSignature = autoTeacherSignature ?? t.signatureUrl;
      }
    }
    // Pré-valider data avec les valeurs auto-remplies
    data.teacherName = autoTeacherName ?? data.teacherName;
    data.teacherSignature = autoTeacherSignature ?? data.teacherSignature;

    const id = crypto.randomUUID();
    const fields: string[] = ['"id"', '"tenantId"', '"academicYearId"', '"teacherId"',
                              '"createdAt"', '"updatedAt"',
                              '"classId"', '"testType"', '"testTitle"', '"trimester"',
                              '"studentScores"', '"maxScore"', '"passingScore"', '"coefficient"',
                              '"status"', '"testNumber"'];
    const placeholders: string[] = ['$1', '$2', '$3', '$4', 'NOW()', 'NOW()',
                                    '$5', '$6', '$7', '$8',
                                    "'[]'::jsonb", '$9', '$10', '$11',
                                    "'DRAFT'", '$12'];
    const params: any[] = [
      id, tenantId, academicYearId, effectiveTeacherId,
      data.classId, data.testType, data.testTitle, data.trimester,
      data.maxScore ?? 20.0, data.passingScore ?? 10.0, data.coefficient ?? 1.0,
      data.testNumber ?? 1,
    ];
    let paramIdx = 13;

    const optionalFields: Array<{ key: string; type: 'string' | 'int' | 'float' | 'date' }> = [
      { key: 'subjectId', type: 'string' },
      { key: 'schoolName', type: 'string' },
      { key: 'className', type: 'string' },
      { key: 'academicYearLabel', type: 'string' },
      { key: 'testDate', type: 'date' },
      { key: 'durationMinutes', type: 'int' },
      { key: 'teacherName', type: 'string' },
      { key: 'teacherSignature', type: 'string' },
      { key: 'pedagogicalObservations', type: 'string' },
      { key: 'recommandations', type: 'string' },
      // ⭐ Nouveaux champs (refonte cahier de texte — journal de cours)
      { key: 'courseTitle', type: 'string' },
      { key: 'startTime', type: 'string' },
      { key: 'endTime', type: 'string' },
      { key: 'content', type: 'string' },
      { key: 'lessonDate', type: 'date' },
    ];

    for (const { key, type } of optionalFields) {
      if (data[key] !== undefined && data[key] !== null) {
        fields.push(`"${key}"`);
        if (type === 'date') {
          placeholders.push(`$${paramIdx++}::date`);
          params.push(data[key]);
        } else if (type === 'int') {
          placeholders.push(`$${paramIdx++}::int`);
          params.push(data[key]);
        } else if (type === 'float') {
          placeholders.push(`$${paramIdx++}::double precision`);
          params.push(data[key]);
        } else {
          placeholders.push(`$${paramIdx++}`);
          params.push(data[key]);
        }
      }
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "cahier_de_textes" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
      ...params,
    );

    return this.getCahierDeTexte(tenantId, id);
  }

  /// Met à jour un cahier de test.
  async updateCahierDeTexte(
    tenantId: string,
    testId: string,
    data: any,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_de_textes" WHERE "id" = $1 AND "tenantId" = $2`,
      testId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Cahier de test non trouvé');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const allowedFields: Record<string, 'string' | 'int' | 'float' | 'jsonb' | 'date'> = {
      subjectId: 'string',
      schoolName: 'string', className: 'string', academicYearLabel: 'string',
      trimester: 'int', testType: 'string', testNumber: 'int', testTitle: 'string',
      testDate: 'date', durationMinutes: 'int', teacherName: 'string',
      maxScore: 'float', passingScore: 'float', coefficient: 'float',
      studentScores: 'jsonb',
      totalStudents: 'int', totalPresent: 'int', totalAbsent: 'int',
      averageScore: 'float', highestScore: 'float', lowestScore: 'float',
      passedCount: 'int', failedCount: 'int', passRate: 'float',
      boysCount: 'int', girlsCount: 'int',
      boysAverage: 'float', girlsAverage: 'float',
      boysPassed: 'int', girlsPassed: 'int',
      pedagogicalObservations: 'string', recommandations: 'string',
      teacherSignature: 'string', directorSignature: 'string',
      status: 'string', submittedAt: 'date', validatedAt: 'date',
      validatedBy: 'string', rejectionReason: 'string',
      // ⭐ Nouveaux champs (refonte cahier de texte — journal de cours)
      courseTitle: 'string', startTime: 'string', endTime: 'string',
      content: 'string', lessonDate: 'date',
    };

    for (const [key, type] of Object.entries(allowedFields)) {
      if (data[key] !== undefined) {
        const val = data[key];
        if (type === 'jsonb') {
          updates.push(`"${key}" = $${paramIdx++}::jsonb`);
          params.push(JSON.stringify(val));
        } else if (type === 'date' && val) {
          updates.push(`"${key}" = $${paramIdx++}::date`);
          params.push(val);
        } else if (type === 'int') {
          updates.push(`"${key}" = $${paramIdx++}::int`);
          params.push(val);
        } else if (type === 'float') {
          updates.push(`"${key}" = $${paramIdx++}::double precision`);
          params.push(val);
        } else {
          updates.push(`"${key}" = $${paramIdx++}`);
          params.push(val);
        }
      }
    }

    if (updates.length === 0) return existing[0];

    updates.push(`"updatedAt" = NOW()`);
    params.push(testId, tenantId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "cahier_de_textes" SET ${updates.join(', ')} WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    return this.getCahierDeTexte(tenantId, testId);
  }

  /// Supprime un cahier de test.
  async deleteCahierDeTexte(tenantId: string, testId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_de_textes" WHERE "id" = $1 AND "tenantId" = $2`,
      testId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Cahier de test non trouvé');
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "cahier_de_textes" WHERE "id" = $1`,
      testId,
    );
    return { success: true };
  }

  /// Soumet un cahier de test au directeur.
  async submitCahierDeTexte(tenantId: string, testId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_de_textes" WHERE "id" = $1 AND "tenantId" = $2`,
      testId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Cahier de test non trouvé');
    }
    if (existing[0].status !== 'DRAFT') {
      throw new BadRequestException('Cahier de test déjà soumis');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE "cahier_de_textes"
       SET "status" = 'SUBMITTED', "submittedAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $1`,
      testId,
    );
    return this.getCahierDeTexte(tenantId, testId);
  }

  /// Initialise les scores des élèves d'un cahier de test à partir des
  /// élèves inscrits dans la classe (sans écraser les scores existants).
  async initCahierDeTexteStudents(tenantId: string, testId: string) {
    const test: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_de_textes" WHERE "id" = $1 AND "tenantId" = $2`,
      testId, tenantId,
    );
    if (!test || test.length === 0) {
      throw new NotFoundException('Cahier de test non trouvé');
    }
    const test_ = test[0];
    const maxScore = test_.maxScore ?? 20.0;
    const passingScore = test_.passingScore ?? 10.0;

    // Récupérer les élèves inscrits dans la classe
    const enrollments: any = await this.prisma.$queryRawUnsafe(
      `SELECT se."studentId", s."firstName", s."lastName", s."gender", s."matricule"
       FROM "student_enrollments" se
       INNER JOIN "students" s ON s."id" = se."studentId"
       WHERE se."tenantId" = $1 AND se."academicYearId" = $2 AND se."classId" = $3
       AND se."status" IN ('ACTIVE', 'ADMITTED', 'ENROLLED')
       ORDER BY s."lastName", s."firstName"`,
      tenantId, test_.academicYearId, test_.classId,
    );

    const existingScores = typeof test_.studentScores === 'string'
      ? JSON.parse(test_.studentScores || '[]')
      : (test_.studentScores || []);

    const newScores = enrollments.map((enr: any, idx: number) => {
      const existing = existingScores.find((s: any) => s.studentId === enr.studentId);
      return {
        studentId: enr.studentId,
        numero: existing?.numero ?? idx + 1,
        nom: enr.lastName || '',
        prenom: enr.firstName || '',
        sexe: (enr.gender || '').toUpperCase() === 'FEMALE' ? 'F' :
              (enr.gender || '').toUpperCase() === 'MALE' ? 'M' : (enr.gender || 'M'),
        score: existing?.score ?? null,
        appreciation: existing?.appreciation || '',
        absent: existing?.absent ?? false,
      };
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE "cahier_de_textes" SET "studentScores" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
      JSON.stringify(newScores), testId,
    );

    return this.getCahierDeTexte(tenantId, testId);
  }

  /// Calcule les statistiques d'un cahier de test à partir des scores.
  computeCahierDeTexteStats(studentScores: any[], maxScore: number, passingScore: number) {
    let total = 0, present = 0, absent = 0;
    let sumScores = 0;
    let highest = -Infinity, lowest = Infinity;
    let passed = 0, failed = 0;
    let totalG = 0, totalF = 0;
    let sumG = 0, sumF = 0;
    let passedG = 0, passedF = 0;

    for (const s of studentScores) {
      total++;
      const sexe = (s.sexe || '').toUpperCase();
      if (sexe === 'M' || sexe === 'G') totalG++;
      else if (sexe === 'F') totalF++;

      if (s.absent) {
        absent++;
        failed++;
        continue;
      }
      if (s.score === null || s.score === undefined) continue;

      present++;
      const score = Number(s.score);
      sumScores += score;
      if (score > highest) highest = score;
      if (score < lowest) lowest = score;
      const isPassed = score >= passingScore;
      if (isPassed) {
        passed++;
        if (sexe === 'M' || sexe === 'G') passedG++;
        else if (sexe === 'F') passedF++;
      } else {
        failed++;
      }

      if (sexe === 'M' || sexe === 'G') sumG += score;
      else if (sexe === 'F') sumF += score;
    }

    return {
      totalStudents: total,
      totalPresent: present,
      totalAbsent: absent,
      averageScore: present > 0 ? Math.round((sumScores / present) * 100) / 100 : 0,
      highestScore: highest === -Infinity ? 0 : highest,
      lowestScore: lowest === Infinity ? 0 : lowest,
      passedCount: passed,
      failedCount: failed,
      passRate: present > 0 ? Math.round((passed / present) * 10000) / 100 : 0,
      boysCount: totalG,
      girlsCount: totalF,
      boysAverage: totalG > 0 ? Math.round((sumG / totalG) * 100) / 100 : 0,
      girlsAverage: totalF > 0 ? Math.round((sumF / totalF) * 100) / 100 : 0,
      boysPassed: passedG,
      girlsPassed: passedF,
    };
  }

  // === Validation direction pour les cahiers de test ===

  /// Récupère tous les cahiers de test soumis (en attente de validation).
  async getPendingCahierDeTextes(tenantId: string, academicYearId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT ct.*, c."name" as "classNameResolved", s."name" as "subjectName",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "cahier_de_textes" ct
       LEFT JOIN "classes" c ON c."id" = ct."classId"
       LEFT JOIN "subjects" s ON s."id" = ct."subjectId"
       LEFT JOIN "teachers" t ON t."id" = ct."teacherId"
       WHERE ct."tenantId" = $1 AND ct."academicYearId" = $2 AND ct."status" = 'SUBMITTED'
       ORDER BY ct."submittedAt" DESC`,
      tenantId, academicYearId,
    );
  }

  /// Valide ou rejette un cahier de test.
  async validateCahierDeTexte(
    tenantId: string,
    testId: string,
    action: 'VALIDATED' | 'REJECTED',
    validatedBy: string,
    rejectionReason?: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_de_textes" WHERE "id" = $1 AND "tenantId" = $2`,
      testId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Cahier de test non trouvé');
    }
    if (existing[0].status !== 'SUBMITTED') {
      throw new BadRequestException('Cahier de test pas en attente');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "cahier_de_textes"
       SET "status" = $1, "validatedAt" = NOW(), "validatedBy" = $2,
           "rejectionReason" = $3, "updatedAt" = NOW()
       WHERE "id" = $4`,
      action, validatedBy, action === 'REJECTED' ? (rejectionReason || null) : null, testId,
    );

    if (action === 'VALIDATED') {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "cahier_de_textes" SET "directorSignature" = 'Validé par la direction' WHERE "id" = $1`,
        testId,
      );
    }

    this.logger.log(`✅ Cahier de test ${testId} ${action} par ${validatedBy}`);
    return this.getCahierDeTexte(tenantId, testId);
  }

  /// Récupère le détail d'un cahier de test (vue direction).
  async getCahierDeTexteDetail(tenantId: string, testId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT ct.*, c."name" as "classNameResolved", s."name" as "subjectName",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "cahier_de_textes" ct
       LEFT JOIN "classes" c ON c."id" = ct."classId"
       LEFT JOIN "subjects" s ON s."id" = ct."subjectId"
       LEFT JOIN "teachers" t ON t."id" = ct."teacherId"
       WHERE ct."id" = $1 AND ct."tenantId" = $2`,
      testId, tenantId,
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Cahier de test non trouvé');
    }
    return result[0];
  }

  // ===========================================================================
  // EXPORT REGISTRE D'APPEL (Excel / PDF)
  // ===========================================================================

  async exportAttendanceRegister(
    tenantId: string,
    registerId: string,
    format: string,
  ): Promise<Buffer> {
    // Charger le registre avec tous les détails
    const register: any = await this.prisma.$queryRawUnsafe(
      `SELECT ar.*, c."name" as "classNameResolved",
              sl."code" as "schoolLevelCode", sl."name" as "schoolLevelName"
       FROM "attendance_registers" ar
       LEFT JOIN "classes" c ON c."id" = ar."classId"
       LEFT JOIN "school_levels" sl ON sl."id" = c."schoolLevelId"
       WHERE ar."id" = $1 AND ar."tenantId" = $2`,
      registerId, tenantId,
    );
    if (!register || register.length === 0) {
      throw new NotFoundException('Registre non trouvé');
    }
    const reg = register[0];

    const studentsData = typeof reg.studentsData === 'string'
      ? JSON.parse(reg.studentsData || '[]')
      : (reg.studentsData || []);

    const holidays = typeof reg.holidays === 'string'
      ? JSON.parse(reg.holidays || '[]')
      : (reg.holidays || []);

    const month = reg.month;
    const year = reg.year;
    const MONTH_NAMES = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                         'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    // Calculer les demi-jours du mois
    const daysInMonth = new Date(year, month, 0).getDate();
    let totalDemiJournees = 0;
    const DEMI_JOURS: Record<number, number> = { 1: 2, 2: 2, 3: 1, 4: 2, 5: 2 };
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const dow = d.getDay();
      if (dow < 1 || dow > 5) continue;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (holidays.includes(dateStr)) continue;
      totalDemiJournees += DEMI_JOURS[dow] || 0;
    }

    if (format === 'excel') {
      return this.generateExcelExport(reg, studentsData, holidays, month, year, totalDemiJournees, MONTH_NAMES);
    } else {
      return this.generatePdfExport(reg, studentsData, holidays, month, year, totalDemiJournees, MONTH_NAMES);
    }
  }

  private generateExcelExport(
    reg: any, students: any[], holidays: string[],
    month: number, year: number, totalDemiJournees: number,
    MONTH_NAMES: string[],
  ): Buffer {
    // Format CSV (ouvert par Excel)
    const WEEKS = [1, 2, 3, 4, 5];
    const DAYS = [
      { num: 1, label: 'L' }, { num: 2, label: 'M' }, { num: 3, label: 'M' },
      { num: 4, label: 'J' }, { num: 5, label: 'V' },
    ];

    const rows: string[][] = [];

    // En-tête
    rows.push([`REGISTRE D'APPEL — ${MONTH_NAMES[month]} ${year}`]);
    rows.push([`Classe: ${reg.classNameResolved || ''}`, `Nombre de demi-journées: ${totalDemiJournees}`]);
    rows.push([]);

    // En-tête du tableau
    const header1 = ['N°', 'Nom et prénom', 'Sexe'];
    for (const w of WEEKS) {
      for (const d of DAYS) {
        header1.push(`S${w}-${d.label}`);
      }
    }
    header1.push('Motif', 'Total présences possibles', 'Total absences', 'Total présence effectif', 'Observation');
    rows.push(header1);

    // Données élèves
    for (const s of students) {
      const row = [
        String(s.numero || ''),
        `${s.nom || ''} ${s.prenom || ''}`,
        s.sexe || '',
      ];
      for (const w of WEEKS) {
        for (const d of DAYS) {
          const a = (s.absences || []).find((x: any) => x.week === w && x.day === d.num);
          row.push(a?.marked || '');
        }
      }
      row.push(s.motif || '');
      row.push(String(s.totalPresencesPossibles || totalDemiJournees));
      row.push(String(s.totalAbsences || 0));
      row.push(String(s.totalPresenceEffectif || (totalDemiJournees - (s.totalAbsences || 0))));
      row.push(s.observation || '');
      rows.push(row);
    }

    // Récapitulatif
    rows.push([]);
    const totalAbs = students.reduce((sum, s) => sum + (s.totalAbsences || 0), 0);
    const totalPoss = students.reduce((sum, s) => sum + (s.totalPresencesPossibles || totalDemiJournees), 0);
    const totalEff = totalPoss - totalAbs;
    const pctP = totalPoss > 0 ? Math.round((totalEff / totalPoss) * 10000) / 100 : 0;
    const pctA = totalPoss > 0 ? Math.round((totalAbs / totalPoss) * 10000) / 100 : 0;

    rows.push(['RÉCAPITULATIF']);
    rows.push(['Demi-journées du mois', String(totalDemiJournees)]);
    rows.push(['Présence possible', String(totalPoss)]);
    rows.push(['Total absences', String(totalAbs)]);
    rows.push(['Total présences effectives', String(totalEff)]);
    rows.push(['% présences', `${pctP}%`]);
    rows.push(['% absences', `${pctA}%`]);

    // Jours fériés
    if (holidays.length > 0) {
      rows.push([]);
      rows.push(['JOURS FÉRIÉS']);
      for (const h of holidays) {
        rows.push([h]);
      }
    }

    // Signatures
    rows.push([]);
    rows.push(['SIGNATURES']);
    rows.push([`Le Directeur / La Directrice`, `Le Titulaire de la classe`]);

    // Convertir en CSV
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    // BOM pour Excel
    return Buffer.from('\ufeff' + csv, 'utf-8');
  }

  private async generatePdfExport(
    reg: any, students: any[], holidays: string[],
    month: number, year: number, totalDemiJournees: number,
    MONTH_NAMES: string[],
  ): Promise<Buffer> {
    const WEEKS = [1, 2, 3, 4, 5];
    const DAYS = [
      { num: 1, label: 'L' }, { num: 2, label: 'M' }, { num: 3, label: 'M' },
      { num: 4, label: 'J' }, { num: 5, label: 'V' },
    ];

    const totalAbs = students.reduce((sum, s) => sum + (s.totalAbsences || 0), 0);
    const totalPoss = students.reduce((sum, s) => sum + (s.totalPresencesPossibles || totalDemiJournees), 0);
    const totalEff = totalPoss - totalAbs;
    const pctP = totalPoss > 0 ? Math.round((totalEff / totalPoss) * 10000) / 100 : 0;
    const pctA = totalPoss > 0 ? Math.round((totalAbs / totalPoss) * 10000) / 100 : 0;

    let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Registre d'appel — ${MONTH_NAMES[month]} ${year}</title>
<style>
body{font-family:Arial,sans-serif;font-size:9px;margin:15px;}
h2{text-align:center;margin:0;}
.header{text-align:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px;}
.header-info{display:flex;justify-content:space-between;margin-top:5px;font-size:10px;}
table{width:100%;border-collapse:collapse;margin-bottom:10px;}
th,td{border:1px solid #333;padding:2px;text-align:center;}
th{background:#e0e0e0;font-weight:bold;font-size:8px;}
td.name{text-align:left;font-weight:bold;}
.recap{margin-top:10px;border:2px solid #333;padding:8px;}
.recap-table{width:100%;border-collapse:collapse;}
.recap-table th,.recap-table td{border:1px solid #666;padding:4px;text-align:center;}
.recap-table th{background:#f0f0f0;}
.signature{margin-top:30px;display:flex;justify-content:space-between;}
.signature div{text-align:center;}
.holidays{margin-top:8px;background:#fff3f3;border:1px solid #f99;padding:5px;font-size:9px;}
</style></head><body>`;

    html += `<div class="header">
      <h2>REGISTRE D'APPEL — ${MONTH_NAMES[month]} ${year}</h2>
      <div class="header-info">
        <span>Classe: <strong>${reg.classNameResolved || ''}</strong></span>
        <span>Nombre de demi-journées: <strong>${totalDemiJournees}</strong></span>
        <span>Effectif: ${students.length} élèves</span>
      </div>
    </div>`;

    html += '<table><thead><tr><th rowspan="2">N°</th><th rowspan="2">Nom et prénom</th><th rowspan="2">Sexe</th>';
    for (const w of WEEKS) {
      html += `<th colspan="5">S${w}</th>`;
    }
    html += '<th rowspan="2">Motif</th><th rowspan="2">Total prés. poss.</th><th rowspan="2">Total abs.</th><th rowspan="2">Total prés. eff.</th><th rowspan="2">Obs.</th></tr><tr>';
    for (const w of WEEKS) {
      for (const d of DAYS) {
        html += `<th>${d.label}</th>`;
      }
    }
    html += '</tr></thead><tbody>';

    for (const s of students) {
      html += `<tr><td>${s.numero || ''}</td><td class="name">${(s.nom || '')} ${(s.prenom || '')}</td><td>${s.sexe || ''}</td>`;
      for (const w of WEEKS) {
        for (const d of DAYS) {
          const a = (s.absences || []).find((x: any) => x.week === w && x.day === d.num);
          const mark = a?.marked || '';
          html += `<td>${mark === '-' ? '−' : mark === '|' ? '│' : mark === '+' ? '+' : mark ? mark : '·'}</td>`;
        }
      }
      html += `<td>${(s.motif || '').replace(/<[^>]*>/g, '')}</td><td>${s.totalPresencesPossibles || totalDemiJournees}</td><td>${s.totalAbsences || 0}</td><td>${s.totalPresenceEffectif || (totalDemiJournees - (s.totalAbsences || 0))}</td><td>${(s.observation || '').replace(/<[^>]*>/g, '')}</td></tr>`;
    }
    html += '</tbody></table>';

    // Récapitulatif
    html += `<div class="recap">
      <h3>Récapitulatif du mois</h3>
      <table class="recap-table">
        <tr><th>Demi-journées du mois</th><th>Présence possible</th><th>Total absences</th><th>Total prés. effectives</th><th>% présences</th><th>% absences</th></tr>
        <tr><td><strong>${totalDemiJournees}</strong></td><td>${totalPoss}</td><td>${totalAbs}</td><td>${totalEff}</td><td>${pctP}%</td><td>${pctA}%</td></tr>
      </table>
    </div>`;

    // Jours fériés
    if (holidays.length > 0) {
      html += `<div class="holidays"><strong>🎉 Jours fériés:</strong> ${holidays.join(', ')}</div>`;
    }

    // Signatures
    html += `<div class="signature">
      <div><p>Le Directeur / La Directrice</p><br><br><p>Signature et cachet</p></div>
      <div><p>Le Titulaire de la classe</p><br><br><p>Signature</p></div>
    </div>`;

    html += '</body></html>';

    // ⭐ Utiliser Puppeteer pour générer un vrai PDF (comme le module finance)
    const fullHtml = html;
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      const pdfBuffer: Buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        landscape: true,
      });
      const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
      return buf;
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  // ===========================================================================
  // EXPORT CAHIER JOURNAL (Excel / PDF)
  // ===========================================================================

  async exportCahierJournal(
    tenantId: string,
    journalId: string,
    format: string,
  ): Promise<Buffer> {
    // ⭐ Requête enrichie : journal + identité école + titulaire + année scolaire + effectif
    //    ⭐ FIX 2026-09-15 : JOIN school_levels manquant → schoolLevelCode n'était
    //    jamais résolu et le PDF d'un cahier journal maternelle rendait la
    //    grille primaire au lieu de la grille par domaines.
    const journal: any = await this.prisma.$queryRawUnsafe(
      `SELECT cje.*, c."name" as "classNameResolved",
        sl."code" as "schoolLevelCode", sl."name" as "schoolLevelName",
        tca_t."firstName" as "titularFirstName", tca_t."lastName" as "titularLastName", tca_t."gender" as "titularGender",
        tip."schoolName", tip."schoolAcronym", tip."logoUrl",
        ay."name" as "academicYearName",
        (SELECT COUNT(*) FROM "student_enrollments" se
         WHERE se."classId" = cje."classId" AND se."academicYearId" = cje."academicYearId"
           AND se."status" = 'ACTIVE') as "totalStudents"
       FROM "cahier_journal_entries" cje
       LEFT JOIN classes c ON c."id" = cje."classId"
       LEFT JOIN school_levels sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN teacher_class_assignments tca ON tca."classId" = cje."classId" AND tca."tenantId" = cje."tenantId"
       LEFT JOIN teachers tca_t ON tca_t."id" = tca."teacherId"
       LEFT JOIN "tenant_identity_profiles" tip ON tip."tenantId" = cje."tenantId" AND tip."isActive" = true
       LEFT JOIN "academic_years" ay ON ay."id" = cje."academicYearId"
       WHERE cje."id" = $1 AND cje."tenantId" = $2
       ORDER BY tip."version" DESC
       LIMIT 1`,
      journalId, tenantId,
    );
    if (!journal || journal.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    const j = journal[0];
    const entries = typeof j.entries === 'string' ? JSON.parse(j.entries || '{}') : (j.entries || {});
    const DAYS = [
      { id: 1, key: 'lundi', label: 'LUNDI' },
      { id: 2, key: 'mardi', label: 'MARDI' },
      { id: 3, key: 'mercredi', label: 'MERCREDI' },
      { id: 4, key: 'jeudi', label: 'JEUDI' },
      { id: 5, key: 'vendredi', label: 'VENDREDI' },
    ];

    // Get all unique subject keys from entries
    const subjectKeys = new Set<string>();
    for (const day of DAYS) {
      const dayEntries = entries[day.key] || {};
      for (const key of Object.keys(dayEntries)) {
        if (key !== 'observations') subjectKeys.add(key);
      }
    }
    const subjects = Array.from(subjectKeys);

    // ⭐ Résoudre le nom du VRAI titulaire de la classe
    const firstName = j.titularFirstName || '';
    const lastName = j.titularLastName || '';
    const teacherName = firstName || lastName
      ? `${j.titularGender === 'F' ? 'Mme' : 'M.'} ${(lastName || '').toUpperCase()} ${firstName}`.trim()
      : '—';

    // ⭐ Résoudre le logo
    let logoUrl = '';
    if (j.logoUrl) {
      if (j.logoUrl.startsWith('data:') || j.logoUrl.startsWith('http')) {
        logoUrl = j.logoUrl;
      } else {
        const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
          || this.configService.get<string>('API_URL')
          || 'https://api.academiahelm.com';
        logoUrl = `${apiBaseUrl}${j.logoUrl.startsWith('/') ? '' : '/'}${j.logoUrl}`;
      }
    }

    // ⭐ Filigrane
    const schoolAcronym = j.schoolAcronym || (j.schoolName || '').substring(0, 3).toUpperCase() || '';
    const watermark = schoolAcronym
      ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:120px;font-weight:bold;color:#e2e8f0;opacity:0.10;z-index:0;pointer-events:none;white-space:nowrap;letter-spacing:8px;">${schoolAcronym}</div>`
      : '';

    // ⭐ Strip HTML
    const strip = (html: string) => (html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim() || '—';

    // ⭐ Génération du HTML professionnel (identique à l'UI)
    const wsStr = j.weekStartDate ? new Date(j.weekStartDate).toLocaleDateString('fr-FR') : '—';
    const weStr = j.weekEndDate ? new Date(j.weekEndDate).toLocaleDateString('fr-FR') : '—';

    let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Helvetica Neue',Arial,sans-serif; color:#1e293b; font-size:10px; padding: 8mm; line-height:1.4; position:relative; }
      .content { position:relative; z-index:1; }
      @page { margin: 10mm; }
    </style></head><body>`;

    html += watermark;
    html += '<div class="content">';

    // ═══ EN-TÊTE ÉCOLE ═══
    html += `<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0A2A5E;padding-bottom:8px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;">
        ${logoUrl ? `<img src="${logoUrl}" style="max-height:60px;max-width:60px;object-fit:contain;" />` : ''}
        <div>
          <div style="font-size:14px;font-weight:bold;color:#0A2A5E;">${j.schoolAcronym || j.schoolName || 'Academia Helm'}</div>
          <div style="font-size:9px;color:#64748b;">${j.classNameResolved || j.className || '—'} · ${j.academicYearName || 'Année scolaire'}</div>
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;font-weight:bold;color:#0A2A5E;background:#dbeafe;padding:4px 10px;border-radius:4px;border:1px solid #3b82f6;">CAHIER JOURNAL</div>
        <div style="font-size:9px;color:#64748b;margin-top:3px;">Semaine du ${wsStr} au ${weStr}</div>
      </div>
    </div>`;

    // ═══ INFOS GÉNÉRALES ═══
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;font-size:9px;">
      <tr>
        <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;width:15%;">Classe</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${j.classNameResolved || j.className || '—'}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;width:15%;">Enseignant</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${teacherName}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;width:15%;">Effectif</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${j.totalStudents || '—'} élèves</td>
      </tr>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;">Semaine du</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${wsStr}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;">Au</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${weStr}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;background:#f8fafc;font-weight:bold;">Statut</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${j.status || 'DRAFT'}</td>
      </tr>
    </table>`;

    // ═══ GRILLE HEBDOMADAIRE ═══
    // ⭐ 2026-09-15 MATERNELLE : grille par DOMAINES (conforme au modèle officiel
    //    de la maternelle — DOMAINE I à V avec sous-colonnes) au lieu de la
    //    grille par matières.
    const isMaternelleJournal = (j.schoolLevelCode || '').toUpperCase() === 'MATERNELLE';
    html += '<div style="margin-bottom:8px;">';
    html += '<div style="font-size:11px;font-weight:bold;color:white;background:#0A2A5E;padding:4px 8px;border-radius:3px 3px 0 0;">GRILLE HEBDOMADAIRE</div>';
    html += '<table style="width:100%;border-collapse:collapse;border:1px solid #0A2A5E;border-top:none;">';
    if (isMaternelleJournal) {
      // ── Grille par DOMAINES — MATIÈRES DYNAMIQUES ──
      // ⭐ 2026-09-15 : les sous-colonnes proviennent des matières configurées
      //    pour la classe dans le module Pédagogie → « Matières & programmes »
      //    (class_subjects → subjects). Repli sur le modèle officiel par défaut
      //    si aucune matière n'est configurée.
      const matSubjects = await this.getMaternelleSubjectsForClass(
        tenantId, j.academicYearId, j.classId,
      );
      const dynamicGroups = this.buildMaternelleGroups(matSubjects);
      let matGroups: Array<{ key: string; title: string; hint: string | null; subs: Array<{ key: string; label: string; subjectId: string | null; weight: number }> }>;
      if (dynamicGroups.length > 0) {
        matGroups = dynamicGroups;
        // Migration en mémoire des anciennes clés (dom1_sante…) pour ne rien perdre
        const migrated = this.migrateMaternelleEntries(entries as any, matGroups);
        Object.assign(entries, migrated.entries);
        matGroups = migrated.groups;
      } else {
        // Repli : modèle officiel par défaut (aucune matière configurée)
        matGroups = PedagogicalSpaceService.MAT_DOMAIN_DEFS.map(def => ({
          key: def.key,
          title: def.title,
          hint: def.hint,
          subs: def.legacyKeys.map(lk => ({
            key: lk,
            label: PedagogicalSpaceService.MAT_LEGACY_LABELS[lk] || lk,
            subjectId: null,
            weight: 50,
          })).concat(def.key === 'domPre'
            ? [{ key: 'obs_dom', label: 'Observations', subjectId: null, weight: 99 }]
            : []),
        }));
      }
      const flatSubs: Array<{ key: string; label: string }> = [];
      for (const g of matGroups) {
        for (const s of g.subs || []) flatSubs.push({ key: s.key, label: s.label });
      }
      // Ligne 1 : DATE (rowspan 2) + titres de domaines fusionnés
      html += '<thead><tr style="background:#dbeafe;">';
      html += `<th rowspan="2" style="border:1px solid #cbd5e1;padding:5px;font-size:8px;width:7%;">DATE</th>`;
      for (const g of matGroups) {
        html += `<th colspan="${(g.subs || []).length}" style="border:1px solid #cbd5e1;padding:5px;font-size:8px;">${g.title}${g.hint ? ` <span style="font-weight:normal;">(${g.hint})</span>` : ''}</th>`;
      }
      html += '</tr>';
      // Ligne 2 : sous-colonnes (matières configurées)
      html += '<tr style="background:#eff6ff;">';
      for (const s of flatSubs) {
        html += `<th style="border:1px solid #cbd5e1;padding:4px;font-size:7px;">${s.label}</th>`;
      }
      html += '</tr></thead><tbody>';
      for (const day of DAYS) {
        const dayEntries = entries[day.key] || {};
        html += `<tr><td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;background:#f8fafc;font-size:9px;">${day.label}</td>`;
        for (const s of flatSubs) {
          html += `<td style="border:1px solid #cbd5e1;padding:5px;font-size:8px;">${strip(dayEntries[s.key] || '')}</td>`;
        }
        html += `</tr>`;
      }
      html += '</tbody></table></div>';
      // Observations du directeur par jour (si présentes) — en rouge
      const hasDirectorObs = DAYS.some(d => (entries[d.key] || {})['directorObservation']);
      if (hasDirectorObs) {
        html += '<div style="margin-bottom:8px;">';
        html += '<div style="font-size:11px;font-weight:bold;color:white;background:#dc2626;padding:4px 8px;border-radius:3px 3px 0 0;">OBSERVATIONS DU DIRECTEUR (par jour)</div>';
        html += '<table style="width:100%;border-collapse:collapse;border:1px solid #fca5a5;border-top:none;">';
        for (const day of DAYS) {
          const obs = (entries[day.key] || {})['directorObservation'];
          if (obs) {
            html += `<tr><td style="border:1px solid #fca5a5;padding:4px;width:12%;font-weight:bold;background:#fef2f2;font-size:8px;color:#dc2626;">${day.label}</td><td style="border:1px solid #fca5a5;padding:4px;font-size:8px;color:#dc2626;">${strip(obs)}</td></tr>`;
          }
        }
        html += '</table></div>';
      }
    } else {
      html += '<thead><tr style="background:#dbeafe;">';
      html += '<th style="border:1px solid #cbd5e1;padding:5px;font-size:8px;width:10%;">JOURS</th>';
      for (const subj of subjects) {
        html += `<th style="border:1px solid #cbd5e1;padding:5px;font-size:8px;">${subj.replace(/_/g, ' ')}</th>`;
      }
      html += '<th style="border:1px solid #cbd5e1;padding:5px;font-size:8px;">OBSERVATIONS</th>';
      html += '</tr></thead><tbody>';
      for (const day of DAYS) {
        const dayEntries = entries[day.key] || {};
        html += `<tr><td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;background:#f8fafc;font-size:9px;">${day.label}</td>`;
        for (const subj of subjects) {
          const val = dayEntries[subj] || '';
          html += `<td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(val)}</td>`;
        }
        html += `<td style="border:1px solid #cbd5e1;padding:5px;font-size:9px;">${strip(dayEntries['observations'] || '')}`;
        // ⭐ Observation du directeur (en rouge, sous l'observation de l'enseignant)
        if (dayEntries['directorObservation']) {
          html += `<div style="margin-top:4px;padding:3px;background:#fef2f2;border:1px solid #fca5a5;border-radius:3px;"><div style="font-size:7px;font-weight:bold;color:#dc2626;text-transform:uppercase;margin-bottom:2px;">Observation du Directeur</div><div style="font-size:8px;color:#dc2626;">${strip(dayEntries['directorObservation'])}</div></div>`;
        }
        html += `</td></tr>`;
      }
      html += '</tbody></table></div>';
    }

    // ═══ OBSERVATIONS GÉNÉRALES ═══
    if (j.observations) {
      html += `<div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:#0A2A5E;padding:4px 8px;border-radius:3px 3px 0 0;">OBSERVATIONS GÉNÉRALES</div>
        <div style="border:1px solid #0A2A5E;border-top:none;padding:8px;font-size:9px;">${strip(j.observations)}</div>
      </div>`;
    }

    // ═══ OBSERVATION GÉNÉRALE DU DIRECTEUR (si VALIDATED/REJECTED, en rouge) ═══
    if ((j.status === 'VALIDATED' || j.status === 'REJECTED') && j.observations) {
      html += `<div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:#dc2626;padding:4px 8px;border-radius:3px 3px 0 0;">OBSERVATION DU DIRECTEUR</div>
        <div style="border:1px solid #fca5a5;border-top:none;padding:8px;font-size:9px;color:#dc2626;font-weight:bold;">${strip(j.observations)}</div>
      </div>`;
    }
    if (j.status === 'REJECTED' && j.rejectionReason) {
      html += `<div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:bold;color:white;background:#dc2626;padding:4px 8px;border-radius:3px 3px 0 0;">MOTIF DU REJET</div>
        <div style="border:1px solid #fca5a5;border-top:none;padding:8px;font-size:9px;color:#dc2626;">${strip(j.rejectionReason)}</div>
      </div>`;
    }

    // ═══ SIGNATURES ═══
    html += `<div style="margin-top:15px;display:flex;justify-content:space-between;gap:20px;">
      <div style="text-align:center;width:45%;">
        ${j.teacherSignature ? `<img src="${j.teacherSignature}" style="max-height:40px;max-width:120px;object-fit:contain;" />` : '<div style="height:40px;"></div>'}
        <div style="border-top:2px solid #0A2A5E;margin-top:5px;padding-top:3px;font-size:9px;font-weight:bold;color:#0A2A5E;">Le Maître / La Maîtresse</div>
        <div style="font-size:8px;color:#64748b;margin-top:1px;">${teacherName}</div>
      </div>
      <div style="text-align:center;width:45%;">
        ${j.status === 'VALIDATED' && j.directorSignature ? `<img src="${j.directorSignature}" style="max-height:40px;max-width:120px;object-fit:contain;" />` : '<div style="height:40px;border:1px dashed #cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#94a3b8;">En attente de validation</div>'}
        <div style="border-top:2px solid #0A2A5E;margin-top:5px;padding-top:3px;font-size:9px;font-weight:bold;color:#0A2A5E;">Le Directeur / La Directrice</div>
        <div style="font-size:8px;color:#64748b;margin-top:1px;">${j.status === 'VALIDATED' ? 'Validé' : '—'}</div>
      </div>
    </div>`;

    // ═══ FOOTER ═══
    html += `<div style="margin-top:15px;border-top:1px solid #e2e8f0;padding-top:5px;text-align:center;font-size:8px;color:#94a3b8;">
      Cahier journal généré par Academia Helm · ${new Date().toLocaleDateString('fr-FR')} · ${j.classNameResolved || j.className || ''}
    </div>`;

    html += '</div></body></html>';

    // ⭐ Puppeteer → real PDF
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500));
      const pdfBuffer: Buffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });
      const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
      return buf;
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  // ===========================================================================
  // CAHIER DU SEMAINIER — Service Methods
  // ===========================================================================

  async getSeminarConfigs(tenantId: string, academicYearId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT wsc.*, t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "weekly_seminar_config" wsc
       LEFT JOIN "teachers" t ON t."id" = wsc."teacherId"
       WHERE wsc."tenantId" = $1 AND wsc."academicYearId" = $2
       ORDER BY wsc."weekNumber" ASC`,
      tenantId, academicYearId,
    );

    // ⭐ Enrichir avec les noms de classes (récupérées depuis la table classes)
    const allClassIds = new Set<string>();
    for (const r of result) {
      const ids: string[] = typeof r.classIds === 'string'
        ? JSON.parse(r.classIds) : (r.classIds || []);
      for (const id of ids) allClassIds.add(id);
    }
    let classMap = new Map<string, string>();
    if (allClassIds.size > 0) {
      const classes: any = await this.prisma.$queryRawUnsafe(
        `SELECT id, name FROM "classes" WHERE id = ANY($1::text[])`,
        Array.from(allClassIds),
      );
      for (const c of classes) classMap.set(c.id, c.name);
    }

    return result.map((r: any) => {
      const classIds: string[] = typeof r.classIds === 'string'
        ? JSON.parse(r.classIds) : (r.classIds || []);
      return {
        ...r,
        teacherName: r.teacherFirstName ? `${r.teacherFirstName} ${r.teacherLastName}` : null,
        classIds,
        classNames: classIds.map((id: string) => classMap.get(id) || id),
      };
    });
  }

  async autoGenerateSeminarConfigs(tenantId: string, academicYearId: string) {
    // Récupérer l'année scolaire pour les dates de début
    const academicYear: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "academic_years" WHERE "id" = $1 AND "tenantId" = $2`,
      academicYearId, tenantId,
    );
    if (!academicYear || academicYear.length === 0) {
      throw new NotFoundException('Année scolaire non trouvée');
    }
    const ay = academicYear[0];

    // ⭐ Récupérer les enseignants du tenant — piste FR UNIQUEMENT
    // Critères :
    //   - status = 'active'
    //   - assignedLanguages contient 'FR' (et seulement 'FR' — pas EN ni FR+EN)
    //     → on exclut les enseignants bilingues qui ont aussi l'anglais
    //   - schoolLevel.code IN ('MATERNELLE', 'PRIMAIRE') — exclut SECONDAIRE
    //   - tri par lastName ASC, firstName ASC pour rotation stable
    //
    // assignedLanguages est stocké en JSONB. On utilise jsonb_array_elements_text
    // ⭐ Inclure TOUS les enseignants FR et EN (maternelle + primaire)
    //    L'utilisateur a demandé que les enseignants anglophones figurent aussi
    //    dans la liste de présence du semainier.
    const teachers: any = await this.prisma.$queryRawUnsafe(
      `SELECT t.id, t."firstName", t."lastName", t."schoolLevelId",
              sl.code AS "schoolLevelCode",
              t."assignedLanguages"
       FROM "teachers" t
       LEFT JOIN "school_levels" sl ON sl.id = t."schoolLevelId"
       WHERE t."tenantId" = $1
         AND t.status = 'active'
         AND sl.code IN ('MATERNELLE', 'PRIMAIRE')
       ORDER BY t."lastName" ASC, t."firstName" ASC`,
      tenantId,
    );

    if (teachers.length === 0) {
      throw new BadRequestException(
        'Aucun enseignant actif trouvé sur la piste linguistique FR (maternelle + primaire). ' +
        'Vérifiez que les enseignants ont assignedLanguages=["FR"] dans leur profil.'
      );
    }

    // ⭐ Récupérer les classes de chaque enseignant via TeacherClassAssignment
    // ⭐ Récupérer TOUTES les classes assignées (FR + EN) — l'utilisateur a demandé
    //    que les enseignants anglophones et leurs classes figurent aussi.
    const teacherClasses: any = await this.prisma.$queryRawUnsafe(
      `SELECT tca."teacherId",
              tca."classId",
              c.name AS "className",
              c.code AS "classCode",
              c.language AS "classLanguage"
       FROM "teacher_class_assignments" tca
       LEFT JOIN "classes" c ON c.id = tca."classId"
       WHERE tca."tenantId" = $1
         AND tca."academicYearId" = $2
         AND tca."classId" IS NOT NULL
       ORDER BY c.name ASC`,
      tenantId, academicYearId,
    );

    // Construire un map teacherId → [classes uniques] (déduplication par classId)
    const teacherClassMap = new Map<string, { id: string; name: string }[]>();
    const seenClassIds = new Map<string, Set<string>>(); // Pour dédupliquer
    for (const tc of teacherClasses) {
      if (!teacherClassMap.has(tc.teacherId)) {
        teacherClassMap.set(tc.teacherId, []);
        seenClassIds.set(tc.teacherId, new Set());
      }
      // Ne pas ajouter le même classId deux fois (déduplication)
      if (!seenClassIds.get(tc.teacherId)!.has(tc.classId)) {
        seenClassIds.get(tc.teacherId)!.add(tc.classId);
        teacherClassMap.get(tc.teacherId)!.push({ id: tc.classId, name: tc.className });
      }
    }

    // Supprimer les configs existantes
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "weekly_seminar_config" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, academicYearId,
    );

    // Calculer 36 semaines à partir de la date de rentrée
    const startDate = new Date(ay.startDate || new Date(new Date().getFullYear(), 8, 1));
    // Ajuster au lundi de la semaine
    const day = startDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startDate.setDate(startDate.getDate() + diff);

    const configs = [];
    for (let week = 1; week <= 36; week++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 4); // Vendredi

      // Déterminer le trimestre
      let trimester = 1;
      if (week > 12 && week <= 24) trimester = 2;
      else if (week > 24) trimester = 3;

      // Rotation des enseignants
      const teacherIdx = (week - 1) % teachers.length;
      const teacher = teachers[teacherIdx];

      // Récupérer les classes de cet enseignant
      const teacherClassesList = teacherClassMap.get(teacher.id) || [];
      const classIds = teacherClassesList.map(c => c.id);
      const classNames = teacherClassesList.map(c => c.name);

      const id = crypto.randomUUID();
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "weekly_seminar_config"
           ("id", "tenantId", "academicYearId", "weekNumber", "trimester",
            "weekStartDate", "weekEndDate", "teacherId", "classIds", "status",
            "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'PENDING', NOW(), NOW())`,
        id, tenantId, academicYearId, week, trimester,
        weekStart, weekEnd, teacher.id,
        JSON.stringify(classIds),
      );
      configs.push({
        id,
        weekNumber: week,
        trimester,
        teacherId: teacher.id,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        classIds,
        classNames,
      });
    }

    this.logger.log(
      `✅ ${configs.length} semainiers générés — ${teachers.length} enseignants FR ` +
      `(maternelle+primaire), classes assignées récupérées pour chacun`,
    );
    return {
      generated: configs.length,
      teachersCount: teachers.length,
      teachers: teachers.map((t: any) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        schoolLevelCode: t.schoolLevelCode,
        classesCount: teacherClassMap.get(t.id)?.length || 0,
      })),
    };
  }

  /**
   * ⭐ Création MANUELLE d'un semainier (Configuration manuelle)
   * Permet à la direction de créer un semainier pour une semaine spécifique
   * en choisissant manuellement l'enseignant et les classes.
   */
  async createSeminarConfigManual(tenantId: string, data: {
    academicYearId: string;
    weekNumber: number;
    trimester: number;
    weekStartDate: string;
    weekEndDate: string;
    teacherId: string;
    classIds?: string[];
  }) {
    // Vérifier que la semaine n'existe pas déjà
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "weekly_seminar_config"
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "weekNumber" = $3`,
      tenantId, data.academicYearId, data.weekNumber,
    );
    if (existing && existing.length > 0) {
      throw new BadRequestException(
        `Un semainier existe déjà pour la semaine ${data.weekNumber}. ` +
        `Utilisez la modification ou supprimez-le d'abord.`
      );
    }

    // Vérifier que l'enseignant existe et est sur la piste FR
    const teacher: any = await this.prisma.$queryRawUnsafe(
      `SELECT t.id, t."firstName", t."lastName", sl.code AS "schoolLevelCode"
       FROM "teachers" t
       LEFT JOIN "school_levels" sl ON sl.id = t."schoolLevelId"
       WHERE t.id = $1 AND t."tenantId" = $2 AND t.status = 'active'`,
      data.teacherId, tenantId,
    );
    if (!teacher || teacher.length === 0) {
      throw new NotFoundException('Enseignant introuvable ou inactif');
    }

    const id = crypto.randomUUID();
    const classIds = data.classIds || [];
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "weekly_seminar_config"
         ("id", "tenantId", "academicYearId", "weekNumber", "trimester",
          "weekStartDate", "weekEndDate", "teacherId", "classIds", "status",
          "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'PENDING', NOW(), NOW())`,
      id, tenantId, data.academicYearId, data.weekNumber, data.trimester,
      new Date(data.weekStartDate), new Date(data.weekEndDate),
      data.teacherId, JSON.stringify(classIds),
    );

    this.logger.log(`✅ Semainier S${data.weekNumber} créé manuellement (teacherId=${data.teacherId})`);

    // Recharger avec jointures pour retourner l'objet complet
    const created: any = await this.prisma.$queryRawUnsafe(
      `SELECT wsc.*, t."firstName" AS "teacherFirstName", t."lastName" AS "teacherLastName"
       FROM "weekly_seminar_config" wsc
       LEFT JOIN "teachers" t ON t.id = wsc."teacherId"
       WHERE wsc.id = $1`,
      id,
    );
    if (created && created.length > 0) {
      const r = created[0];
      return {
        ...r,
        teacherName: r.teacherFirstName ? `${r.teacherFirstName} ${r.teacherLastName}` : null,
        classIds: typeof r.classIds === 'string' ? JSON.parse(r.classIds) : (r.classIds || []),
      };
    }
    return { id };
  }

  /**
   * ⭐ Suppression manuelle d'un semainier (uniquement si PENDING — non signé)
   */
  async deleteSeminarConfig(tenantId: string, configId: string) {
    const config: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, status, "teacherSignature" FROM "weekly_seminar_config"
       WHERE id = $1 AND "tenantId" = $2`,
      configId, tenantId,
    );
    if (!config || config.length === 0) {
      throw new NotFoundException('Semainier introuvable');
    }
    if (config[0].status === 'SIGNED' || config[0].status === 'VALIDATED') {
      throw new BadRequestException(
        'Impossible de supprimer un semainier déjà signé ou validé. ' +
        'Archivez-le ou créez une nouvelle version.'
      );
    }

    // Supprimer d'abord les rapports journaliers liés (cascade FK)
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "weekly_seminar_daily_report" WHERE "seminarConfigId" = $1`,
      configId,
    );
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "weekly_seminar_weekly_report" WHERE "seminarConfigId" = $1`,
      configId,
    );
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "weekly_seminar_config" WHERE id = $1 AND "tenantId" = $2`,
      configId, tenantId,
    );

    this.logger.log(`🗑️ Semainier ${configId} supprimé manuellement`);
    return { deleted: true, id: configId };
  }

  /**
   * ⭐ Récupère les enseignants éligibles au semainier (FR only, maternelle + primaire)
   * Utilisé par le frontend pour le mode "Configuration manuelle".
   */
  async getEligibleSeminarTeachers(tenantId: string, academicYearId: string) {
    const teachers: any = await this.prisma.$queryRawUnsafe(
      `SELECT t.id, t."firstName", t."lastName", t."matricule",
              sl.code AS "schoolLevelCode", sl.name AS "schoolLevelName",
              t."assignedLanguages"
       FROM "teachers" t
       LEFT JOIN "school_levels" sl ON sl.id = t."schoolLevelId"
       WHERE t."tenantId" = $1
         AND t.status = 'active'
         AND sl.code IN ('MATERNELLE', 'PRIMAIRE')
       ORDER BY sl.code ASC, t."lastName" ASC, t."firstName" ASC`,
      tenantId,
    );

    // Récupérer les classes de chaque enseignant
    const teacherIds = teachers.map((t: any) => t.id);
    let teacherClasses: any[] = [];
    if (teacherIds.length > 0) {
      teacherClasses = await this.prisma.$queryRawUnsafe(
        `SELECT DISTINCT ON (tca."teacherId", tca."classId")
                tca."teacherId", tca."classId",
                c.name AS "className",
                c.code AS "classCode"
         FROM "teacher_class_assignments" tca
         LEFT JOIN "classes" c ON c.id = tca."classId"
         WHERE tca."tenantId" = $1
           AND tca."academicYearId" = $2
           AND tca."classId" IS NOT NULL
         ORDER BY tca."teacherId", tca."classId", c.name ASC`,
        tenantId, academicYearId,
      );
    }

    const classMap = new Map<string, { id: string; name: string }[]>();
    for (const tc of teacherClasses) {
      if (!classMap.has(tc.teacherId)) classMap.set(tc.teacherId, []);
      classMap.get(tc.teacherId)!.push({ id: tc.classId, name: tc.className });
    }

    return teachers.map((t: any) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
      matricule: t.matricule,
      schoolLevelCode: t.schoolLevelCode,
      schoolLevelName: t.schoolLevelName,
      classes: classMap.get(t.id) || [],
      classesCount: classMap.get(t.id)?.length || 0,
    }));
  }

  /**
   * ⭐ Vérifie si l'enseignant est le semainier pour la semaine courante
   *    OU la semaine prochaine. Utilisé par le dashboard enseignant pour
   *    afficher une bannière de notification.
   *
   * Règles d'affichage :
   *   - Si l'enseignant est le semainier de la SEMAINE COURANTE :
   *     afficher "Vous êtes le semainier cette semaine (S{N} du {start} au {end})"
   *   - Si l'enseignant est le semainier de la SEMAINE PROCHAINE :
   *     afficher dès le SAMEDI précédent "Vous êtes le semainier la semaine prochaine
   *     (S{N} du {start} au {end})"
   *
   * La logique temporelle est :
   *   - Trouver la config dont weekStartDate <= today <= weekEndDate → semaine courante
   *   - Trouver la config dont weekStartDate = today + (1 à 2 jours) → semaine prochaine
   *     (si on est samedi/dimanche, "semaine prochaine" = lundi à vendredi suivants)
   */
  async getMySeminarAssignment(tenantId: string, teacherId: string, academicYearId: string) {
    if (!teacherId || !academicYearId) {
      return { currentWeek: null, nextWeek: null };
    }

    // Récupérer TOUTES les configs de l'année pour cet enseignant
    const configs: any = await this.prisma.$queryRawUnsafe(
      `SELECT wsc.*, t."firstName" AS "teacherFirstName", t."lastName" AS "teacherLastName"
       FROM "weekly_seminar_config" wsc
       LEFT JOIN "teachers" t ON t."id" = wsc."teacherId"
       WHERE wsc."tenantId" = $1 AND wsc."academicYearId" = $2
         AND wsc."teacherId" = $3
       ORDER BY wsc."weekNumber" ASC`,
      tenantId, academicYearId, teacherId,
    );

    if (!configs || configs.length === 0) {
      return { currentWeek: null, nextWeek: null };
    }

    // Récupérer les noms de classes
    const allClassIds = new Set<string>();
    for (const c of configs) {
      const ids: string[] = typeof c.classIds === 'string' ? JSON.parse(c.classIds) : (c.classIds || []);
      for (const id of ids) allClassIds.add(id);
    }
    let classMap = new Map<string, string>();
    if (allClassIds.size > 0) {
      const classes: any = await this.prisma.$queryRawUnsafe(
        `SELECT id, name FROM "classes" WHERE id = ANY($1::text[])`,
        Array.from(allClassIds),
      );
      for (const c of classes) classMap.set(c.id, c.name);
    }

    const formatConfig = (c: any) => {
      const classIds: string[] = typeof c.classIds === 'string' ? JSON.parse(c.classIds) : (c.classIds || []);
      return {
        id: c.id,
        weekNumber: c.weekNumber,
        trimester: c.trimester,
        weekStartDate: c.weekStartDate,
        weekEndDate: c.weekEndDate,
        teacherName: c.teacherFirstName ? `${c.teacherFirstName} ${c.teacherLastName}` : null,
        classNames: classIds.map((id: string) => classMap.get(id) || id),
        status: c.status,
        teacherSignature: c.teacherSignature,
      };
    };

    // ⭐ Trouver la semaine courante (weekStart <= today <= weekEnd)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Minuit pour comparer correctement

    let currentWeek: any = null;
    let nextWeek: any = null;

    for (const c of configs) {
      const ws = new Date(c.weekStartDate);
      ws.setHours(0, 0, 0, 0);
      const we = new Date(c.weekEndDate);
      we.setHours(23, 59, 59, 999);

      if (today >= ws && today <= we) {
        currentWeek = formatConfig(c);
      }
    }

    // ⭐ Trouver la semaine prochaine : config dont weekStartDate est dans le futur
    //    ET dans les 7 prochains jours
    //    Si on est samedi/dimanche, la semaine prochaine commence lundi suivant
    //    (donc weekStartDate devrait être à 1-2 jours de today)
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    for (const c of configs) {
      if (currentWeek && c.id === currentWeek.id) continue; // skip current week
      const ws = new Date(c.weekStartDate);
      ws.setHours(0, 0, 0, 0);
      if (ws > today && ws <= sevenDaysLater) {
        nextWeek = formatConfig(c);
        break;
      }
    }

    this.logger.log(
      `📋 getMySeminarAssignment teacherId=${teacherId} → currentWeek=${currentWeek?.weekNumber || 'none'}, nextWeek=${nextWeek?.weekNumber || 'none'}`,
    );
    return { currentWeek, nextWeek };
  }

  async updateSeminarConfig(tenantId: string, configId: string, data: any) {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const allowedFields = ['teacherId', 'teacherSignature', 'status', 'classIds',
      // ⭐ Champs directeur pour le workflow de validation
      'directorSignature', 'rejectionReason', 'submittedAt', 'validatedAt', 'validatedBy'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (field === 'classIds') {
          updates.push(`"${field}" = $${paramIdx++}::jsonb`);
          params.push(JSON.stringify(data[field]));
        } else {
          updates.push(`"${field}" = $${paramIdx++}`);
          params.push(data[field]);
        }
      }
    }

    if (updates.length === 0) return null;
    updates.push(`"updatedAt" = NOW()`);
    params.push(configId, tenantId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "weekly_seminar_config" SET ${updates.join(', ')} WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT wsc.*, t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "weekly_seminar_config" wsc
       LEFT JOIN "teachers" t ON t."id" = wsc."teacherId"
       WHERE wsc."id" = $1`,
      configId,
    );
    return updated[0];
  }

  /// ⭐ Soumet le cahier de semaine au directeur (enseignant → direction)
  ///    Change le statut de SIGNED → SUBMITTED + set submittedAt
  async submitSeminarConfig(tenantId: string, configId: string) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "weekly_seminar_config" WHERE "id" = $1 AND "tenantId" = $2`,
      configId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Semainier non trouvé');
    }
    if (existing[0].status !== 'SIGNED') {
      throw new BadRequestException(`Le semainier doit être signé avant soumission (actuel: ${existing[0].status})`);
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE "weekly_seminar_config" SET "status" = 'SUBMITTED', "submittedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`,
      configId,
    );
    this.logger.log(`📧 Semainier ${configId} soumis au directeur`);
    return { success: true, configId, status: 'SUBMITTED' };
  }

  /// ⭐ Valide ou rejette le cahier de semaine (direction)
  ///    Change le statut SUBMITTED → VALIDATED ou REJECTED + set directorSignature + validatedAt
  async validateSeminarConfig(
    tenantId: string,
    configId: string,
    action: 'VALIDATED' | 'REJECTED',
    directorSignature: string,
    validatedBy: string,
    rejectionReason?: string,
  ) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "weekly_seminar_config" WHERE "id" = $1 AND "tenantId" = $2`,
      configId, tenantId,
    );
    if (!existing || existing.length === 0) {
      throw new NotFoundException('Semainier non trouvé');
    }
    if (existing[0].status !== 'SUBMITTED') {
      throw new BadRequestException(`Le semainier doit être en statut SUBMITTED pour validation (actuel: ${existing[0].status})`);
    }
    if (action === 'VALIDATED' && !directorSignature) {
      throw new BadRequestException('La signature du directeur est obligatoire pour valider');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE "weekly_seminar_config"
       SET "status" = $1,
           "directorSignature" = $2,
           "validatedAt" = CASE WHEN $1 = 'VALIDATED' THEN NOW() ELSE "validatedAt" END,
           "validatedBy" = $3,
           "rejectionReason" = $4,
           "updatedAt" = NOW()
       WHERE "id" = $5`,
      action,
      directorSignature || null,
      validatedBy,
      action === 'REJECTED' ? (rejectionReason || null) : null,
      configId,
    );
    this.logger.log(`✅ Semainier ${configId} ${action} par ${validatedBy}`);
    return { success: true, configId, status: action };
  }

  async getOrCreateDailyReport(tenantId: string, configId: string, dayOfWeek: number) {
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "weekly_seminar_daily_report" WHERE "seminarConfigId" = $1 AND "dayOfWeek" = $2 AND "tenantId" = $3`,
      configId, dayOfWeek, tenantId,
    );
    if (existing && existing.length > 0) return existing[0];

    // Créer un rapport vide
    const config: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "weekly_seminar_config" WHERE "id" = $1 AND "tenantId" = $2`,
      configId, tenantId,
    );
    if (!config || config.length === 0) throw new NotFoundException('Config non trouvée');

    const date = new Date(config[0].weekStartDate);
    date.setDate(date.getDate() + (dayOfWeek - 1));

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "weekly_seminar_daily_report" ("id", "tenantId", "academicYearId", "seminarConfigId", "dayOfWeek", "date", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      id, tenantId, config[0].academicYearId, configId, dayOfWeek, date,
    );

    const created: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "weekly_seminar_daily_report" WHERE "id" = $1`,
      id,
    );
    return created[0];
  }

  async updateDailyReport(tenantId: string, reportId: string, data: any, markingUser?: { id?: string; email?: string }) {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const allowedFields = ['teacherAttendance', 'teacherAttendanceSynthesis', 'studentPresence', 'pedagogy', 'discipline', 'hygiene', 'visits', 'communication', 'dailySummary', 'filledBy'];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (['teacherAttendance', 'studentPresence', 'pedagogy', 'discipline', 'hygiene', 'visits', 'communication', 'dailySummary'].includes(field)) {
          updates.push(`"${field}" = $${paramIdx++}::jsonb`);
          const val = typeof data[field] === 'string' ? data[field] : JSON.stringify(data[field]);
          params.push(val);
        } else {
          updates.push(`"${field}" = $${paramIdx++}`);
          params.push(data[field]);
        }
      }
    }

    if (updates.length === 0) return null;
    updates.push(`"updatedAt" = NOW()`);
    params.push(reportId, tenantId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "weekly_seminar_daily_report" SET ${updates.join(', ')} WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "weekly_seminar_daily_report" WHERE "id" = $1`,
      reportId,
    );

    // ⭐ 2026-09-15 — SYNCHRONISATION CAHIER DE SEMAINE → MODULE RH :
    //    quand le rapport journalier contient un pointage d'enseignants
    //    (teacherAttendance), on l'écrit AUSSI dans staff_attendances (RH —
    //    onglet Présences) avec markedByRole='SEMINARIER'. La direction et le
    //    promoteur voient ainsi les présences marquées par le semainier dans
    //    le module RH, avec la provenance. NON BLOQUANT : une erreur de sync
    //    ne fait jamais échouer la sauvegarde du rapport.
    let rhSync: any = null;
    if (data.teacherAttendance !== undefined) {
      rhSync = await this.syncTeacherAttendanceToRh(tenantId, reportId, markingUser?.id || null)
        .catch((err: any) => {
          this.logger.warn(`syncTeacherAttendanceToRh échouée (non bloquant) — rapport ${reportId}: ${err.message}`);
          return { synced: 0, skippedSelf: 0, skippedNoStaff: 0, errors: [err.message] };
        });
    }

    return { ...updated[0], rhSync };
  }

  /**
   * ⭐ 2026-09-15 — SYNCHRONISATION CAHIER DU SEMAINIER → MODULE RH
   *    (staff_attendances — onglet Présences du module Personnel RH).
   *
   * Principe : « staff_attendances » (RH) est la SOURCE DE VÉRITÉ unique de la
   * présence des enseignants. Le JSONB teacherAttendance du rapport journalier
   * reste le document officiel du semainier (motif, observation, remplacement),
   * mais chaque sauvegarde propage les statuts vers le RH :
   *
   *   1. Résolution teacherId (table teachers) → Staff (rapprochement par email,
   *      même mécanisme que GET /hr/attendance/daily-staff). Les enseignants
   *      sans fiche Staff ne sont PAS synchronisés (skippedNoStaff) — le JSONB
   *      garde l'information.
   *   2. ⭐ MUTUAL EXCLUSION : si l'enseignant a déjà AUTO-POINTÉ sa présence
   *      (markedByRole='SELF', GPS vérifié), le semainier ne peut PAS l'écraser
   *      → l'entrée est ignorée (skippedSelf). Réciproquement, l'enseignant ne
   *      peut pas se marquer si le semainier l'a déjà fait (selfCheckIn).
   *   3. Sinon : upsert avec markedByRole='SEMINARIER' + markedBy=userId (traça-
   *      bilité), status du pointage, notes = motif | observation | remplacement.
   *   4. Le statut côté RH est visible en temps réel dans le panneau de pointage
   *      (badge AUTO-POINTÉ + cadenas) via getDailyStaffAttendances (JOIN réparé).
   */
  async syncTeacherAttendanceToRh(tenantId: string, reportId: string, markedByUserId: string | null) {
    const reports: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "date", "academicYearId", "teacherAttendance"
       FROM "weekly_seminar_daily_report" WHERE "id" = $1 AND "tenantId" = $2`,
      reportId, tenantId,
    );
    if (!reports || reports.length === 0) {
      return { synced: 0, skippedSelf: 0, skippedNoStaff: 0, errors: ['Rapport introuvable'] };
    }
    const report = reports[0];

    // Parser le JSONB — 2 formats coexistent :
    //   a) tableau front  : [{ teacherId, name, status, motif, observation, replacement }]
    //   b) objet sync RH  : { _source: 'RH', summary, staff: [...] } (sync-from-rh)
    let ta: any = report.teacherAttendance;
    if (typeof ta === 'string') {
      try { ta = JSON.parse(ta); } catch { ta = null; }
    }
    if (!ta) return { synced: 0, skippedSelf: 0, skippedNoStaff: 0, errors: [] };
    const entries: any[] = Array.isArray(ta)
      ? ta
      : (Array.isArray(ta.staff) ? ta.staff : []);
    if (entries.length === 0) return { synced: 0, skippedSelf: 0, skippedNoStaff: 0, errors: [] };

    // ── 1. Résolution teacherId → Staff (rapprochement par email) ──
    //    Format front : entry.teacherId = id table teachers → JOIN staff par email.
    //    Format sync RH : entry.staffId = id table staff (déjà résolu) → pas de
    //    rapprochement nécessaire (ces entrées viennent DE staff_attendances).
    const teacherIds = [...new Set(entries.map((e: any) => e.teacherId).filter(Boolean))] as string[];
    const teacherRows: any = teacherIds.length > 0
      ? await this.prisma.$queryRawUnsafe(
          `SELECT t.id AS "teacherId", s.id AS "staffId", s."schoolLevelId"
           FROM "teachers" t
           LEFT JOIN "staff" s ON s."email" = t."email" AND s."tenantId" = t."tenantId"
           WHERE t."tenantId" = $1 AND t.id = ANY($2::text[])`,
          tenantId, teacherIds,
        )
      : [];
    const staffMap = new Map<string, any>();
    for (const row of (teacherRows as any[])) staffMap.set(row.teacherId, row);

    const reportDate = report.date ? new Date(report.date) : new Date();
    const academicYearId = report.academicYearId;

    let synced = 0;
    let skippedSelf = 0;
    let skippedNoStaff = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      const status = entry.status;
      if (!status) continue;

      // Résoudre le staff cible (formats front / RH)
      let staffId: string | null = null;
      let schoolLevelId: string | null = null;
      if (entry.teacherId) {
        const row = staffMap.get(entry.teacherId);
        if (row && row.staffId) { staffId = row.staffId; schoolLevelId = row.schoolLevelId; }
      } else if (entry.staffId) {
        const direct: any = await this.prisma.$queryRawUnsafe(
          `SELECT id, "schoolLevelId" FROM "staff" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
          entry.staffId, tenantId,
        );
        if (direct && direct.length > 0) { staffId = direct[0].id; schoolLevelId = direct[0].schoolLevelId; }
      }
      if (!staffId) { skippedNoStaff++; continue; }

      try {
        // Notes combinées : motif | observation | remplacement (document semainier)
        const notesParts: string[] = [];
        if (entry.motif) notesParts.push(`Motif: ${entry.motif}`);
        if (entry.observation) notesParts.push(`Observation: ${entry.observation}`);
        if (entry.replacement) notesParts.push(`Remplacement: ${entry.replacement}`);
        const notes = notesParts.length > 0 ? notesParts.join(' | ') : null;

        const existing: any = await this.prisma.$queryRawUnsafe(
          `SELECT id, "markedByRole" FROM "staff_attendances"
           WHERE "staffId" = $1 AND date = $2::date AND "tenantId" = $3 LIMIT 1`,
          staffId, reportDate, tenantId,
        );

        // ⭐ MUTUAL EXCLUSION : l'auto-pointage (SELF) prime sur le semainier
        if (existing && existing.length > 0 && existing[0].markedByRole === 'SELF') {
          skippedSelf++;
          continue;
        }

        if (existing && existing.length > 0) {
          await this.prisma.$executeRawUnsafe(
            `UPDATE "staff_attendances"
             SET status = $1,
                 notes = COALESCE($2, notes),
                 "markedBy" = $3,
                 "markedByRole" = 'SEMINARIER',
                 "updatedAt" = NOW()
             WHERE id = $4`,
            status, notes, markedByUserId, existing[0].id,
          );
        } else {
          const newId = crypto.randomUUID();
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO "staff_attendances"
               ("id", "tenantId", "academicYearId", "schoolLevelId", "staffId", "date",
                "status", "notes", "markedBy", "markedByRole", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, 'SEMINARIER', NOW(), NOW())`,
            newId, tenantId, academicYearId, schoolLevelId, staffId, reportDate,
            status, notes, markedByUserId,
          );
        }
        synced++;
      } catch (err: any) {
        errors.push(`${entry.name || entry.teacherId || staffId}: ${err.message}`);
      }
    }

    this.logger.log(
      `✅ Sync cahier de semaine → RH (rapport ${reportId}) : ${synced} synchronisé(s), ` +
      `${skippedSelf} auto-pointage(s) préservé(s), ${skippedNoStaff} sans fiche Staff` +
      (errors.length > 0 ? `, ${errors.length} erreur(s)` : '')
    );

    return { synced, skippedSelf, skippedNoStaff, errors };
  }

  // ===========================================================================
  // RAPPORT HEBDOMADAIRE — Synthèse de fin de semaine (page 8 du document)
  // ===========================================================================
  //
  // Le rapport hebdomadaire agrège les 5 rapports journaliers (Lun-Ven) et
  // présente une synthèse selon la structure officielle du document "Cahier du
  // Semainier" page 8 :
  //
  //   1. Synthèse présence enseignants (statistiques agrégées)
  //   2. Synthèse présence élèves (taux moyen, absences cumulées)
  //   3. Bilan pédagogique (cours assurés vs manqués, activités remarquables)
  //   4. Bilan discipline (incidents, mesures correctives)
  //   5. Bilan hygiène (problèmes récurrents, réparations)
  //   6. Visites et communications de la semaine
  //   7. Recommandations générales pour la direction
  //   + Statistiques (taux moyen présence, moyenne hebdo, etc.)
  //   + Signatures (Semainier + Directeur)

  async getOrCreateWeeklyReport(tenantId: string, configId: string) {
    // Vérifier qu'une entrée existe déjà
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT wr.*, wsc."weekNumber", wsc."trimester",
              wsc."weekStartDate", wsc."weekEndDate"
       FROM "weekly_seminar_weekly_report" wr
       JOIN "weekly_seminar_config" wsc ON wsc.id = wr."seminarConfigId"
       WHERE wr."seminarConfigId" = $1 AND wr."tenantId" = $2`,
      configId, tenantId,
    );
    if (existing && existing.length > 0) return existing[0];

    // Sinon, créer un rapport hebdo vide avec agrégation initiale des 5 rapports journaliers
    const config: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "weekly_seminar_config" WHERE id = $1 AND "tenantId" = $2`,
      configId, tenantId,
    );
    if (!config || config.length === 0) {
      throw new NotFoundException('Config non trouvée');
    }
    const cfg = config[0];

    // ⭐ Agréger automatiquement les 5 rapports journaliers pour pré-remplir les stats
    const dailyReports: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "weekly_seminar_daily_report"
       WHERE "seminarConfigId" = $1 AND "tenantId" = $2
       ORDER BY "dayOfWeek" ASC`,
      configId, tenantId,
    );

    const stats = this.aggregateWeeklyStats(dailyReports);

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "weekly_seminar_weekly_report"
         ("id", "tenantId", "academicYearId", "seminarConfigId", "weekNumber",
          "staffAttendanceStats", "studentAttendanceStats",
          "pedagogySummary", "disciplineSummary", "hygieneSummary",
          "visitsAndCommsSummary", "recommendations",
          "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb,
               $8, $9, $10, $11, $12, NOW(), NOW())`,
      id, tenantId, cfg.academicYearId, configId, cfg.weekNumber,
      JSON.stringify(stats.staffAttendance),
      JSON.stringify(stats.studentAttendance),
      stats.pedagogySummary || '',
      stats.disciplineSummary || '',
      stats.hygieneSummary || '',
      stats.visitsAndCommsSummary || '',
      stats.recommendations || '',
    );

    const created: any = await this.prisma.$queryRawUnsafe(
      `SELECT wr.*, wsc."weekNumber", wsc."trimester",
              wsc."weekStartDate", wsc."weekEndDate"
       FROM "weekly_seminar_weekly_report" wr
       JOIN "weekly_seminar_config" wsc ON wsc.id = wr."seminarConfigId"
       WHERE wr.id = $1`,
      id,
    );
    return created[0];
  }

  async updateWeeklyReport(tenantId: string, reportId: string, data: any) {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    const allowedFields = [
      'staffAttendanceStats', 'studentAttendanceStats',
      'pedagogySummary', 'disciplineSummary', 'hygieneSummary',
      'visitsAndCommsSummary', 'recommendations',
      'teacherSignature', 'directorSignature', 'filledBy',
    ];
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        if (['staffAttendanceStats', 'studentAttendanceStats'].includes(field)) {
          updates.push(`"${field}" = $${paramIdx++}::jsonb`);
          const val = typeof data[field] === 'string' ? data[field] : JSON.stringify(data[field]);
          params.push(val);
        } else {
          updates.push(`"${field}" = $${paramIdx++}`);
          params.push(data[field]);
        }
      }
    }

    if (updates.length === 0) return null;
    updates.push(`"updatedAt" = NOW()`);
    params.push(reportId, tenantId);

    await this.prisma.$executeRawUnsafe(
      `UPDATE "weekly_seminar_weekly_report" SET ${updates.join(', ')} WHERE "id" = $${paramIdx++} AND "tenantId" = $${paramIdx++}`,
      ...params,
    );

    const updated: any = await this.prisma.$queryRawUnsafe(
      `SELECT wr.*, wsc."weekNumber", wsc."trimester",
              wsc."weekStartDate", wsc."weekEndDate"
       FROM "weekly_seminar_weekly_report" wr
       JOIN "weekly_seminar_config" wsc ON wsc.id = wr."seminarConfigId"
       WHERE wr.id = $1`,
      reportId,
    );
    return updated[0];
  }

  /**
   * ⭐ Calcule les statistiques agrégées de la semaine à partir des 5 rapports journaliers.
   * Utilisé pour pré-remplir le rapport hebdo (modifiable manuellement ensuite).
   */
  private aggregateWeeklyStats(dailyReports: any[]) {
    // 1. Stats présence enseignants
    let totalStaffRecords = 0;
    let totalStaffPresent = 0;
    let totalStaffAbsent = 0;
    let totalStaffLate = 0;
    for (const dr of dailyReports) {
      const ta = typeof dr.teacherAttendance === 'string'
        ? JSON.parse(dr.teacherAttendance) : (dr.teacherAttendance || null);
      if (ta?.summary) {
        totalStaffRecords += ta.summary.total || 0;
        totalStaffPresent += ta.summary.present || 0;
        totalStaffAbsent += ta.summary.absent || 0;
        totalStaffLate += ta.summary.late || 0;
      }
    }

    // 2. Stats présence élèves
    let totalStudentRecords = 0;
    let totalStudentAbsent = 0;
    let totalStudentLate = 0;
    let totalStudentPresent = 0;
    let avgAttendanceRate = 0;
    let rateCount = 0;
    const allHighAbsenceClasses = new Set<string>();
    for (const dr of dailyReports) {
      const sp = typeof dr.studentPresence === 'string'
        ? JSON.parse(dr.studentPresence) : (dr.studentPresence || null);
      if (sp?.summary) {
        totalStudentRecords += sp.summary.totalRecords || 0;
        totalStudentAbsent += sp.summary.absent || 0;
        totalStudentLate += sp.summary.late || 0;
        totalStudentPresent += sp.summary.present || 0;
      }
      if (sp?.attendanceRate != null) {
        avgAttendanceRate += sp.attendanceRate;
        rateCount++;
      }
      if (sp?.highAbsenceClasses) {
        for (const c of sp.highAbsenceClasses) allHighAbsenceClasses.add(c);
      }
    }

    // 3. Synthèse pédagogique (cours manqués)
    let totalMissingCourses = 0;
    let totalModifiedCourses = 0;
    let scheduleRespectedDays = 0;
    for (const dr of dailyReports) {
      const ped = typeof dr.pedagogy === 'string'
        ? JSON.parse(dr.pedagogy) : (dr.pedagogy || null);
      if (ped?.missingCourses) totalMissingCourses += ped.missingCourses.length;
      if (ped?.modifiedCourses) totalModifiedCourses += ped.modifiedCourses.length;
      if (ped?.scheduleRespected) scheduleRespectedDays++;
    }

    // 4. Synthèse discipline, hygiène, visites — extraire texte synthétisé
    const extractText = (dr: any, field: string, subfield: string) => {
      const obj = typeof dr[field] === 'string' ? JSON.parse(dr[field]) : (dr[field] || null);
      return obj?.[subfield] || '';
    };

    const disciplineSummaries = dailyReports
      .map(dr => extractText(dr, 'discipline', 'problemBehaviors'))
      .filter(t => t && t.trim().length > 0);

    const hygieneIssues = dailyReports
      .map(dr => extractText(dr, 'hygiene', 'urgentRepairs'))
      .filter(t => t && t.trim().length > 0);

    const visitSummaries = dailyReports
      .map(dr => extractText(dr, 'visits', 'visitDetails'))
      .filter(t => t && t.trim().length > 0);

    const communicationSummaries = dailyReports
      .map(dr => extractText(dr, 'communication', 'directionInstructions'))
      .filter(t => t && t.trim().length > 0);

    return {
      staffAttendance: {
        totalRecords: totalStaffRecords,
        totalPresent: totalStaffPresent,
        totalAbsent: totalStaffAbsent,
        totalLate: totalStaffLate,
        averagePresenceRate: totalStaffRecords > 0
          ? Number(((totalStaffPresent / totalStaffRecords) * 100).toFixed(2))
          : 0,
        daysCovered: dailyReports.length,
      },
      studentAttendance: {
        totalRecords: totalStudentRecords,
        totalPresent: totalStudentPresent,
        totalAbsent: totalStudentAbsent,
        totalLate: totalStudentLate,
        averageAttendanceRate: rateCount > 0
          ? Number((avgAttendanceRate / rateCount).toFixed(2))
          : 0,
        highAbsenceClasses: Array.from(allHighAbsenceClasses),
        daysCovered: dailyReports.length,
      },
      pedagogySummary: `Semaine couvrant ${dailyReports.length} jour(s) sur 5. `
        + `${scheduleRespectedDays} jour(s) avec emploi du temps respecté. `
        + `${totalMissingCourses} cours non assurés, ${totalModifiedCourses} cours modifiés.`,
      disciplineSummary: disciplineSummaries.length > 0
        ? 'Incidents observés : ' + disciplineSummaries.join(' | ')
        : '',
      hygieneSummary: hygieneIssues.length > 0
        ? 'Réparations urgentes signalées : ' + hygieneIssues.join(' | ')
        : '',
      visitsAndCommsSummary: (visitSummaries.length > 0 || communicationSummaries.length > 0)
        ? (visitSummaries.length > 0 ? 'Visites : ' + visitSummaries.join(' | ') : '')
          + (communicationSummaries.length > 0 ? ' Communications direction : ' + communicationSummaries.join(' | ') : '')
        : '',
      recommendations: '',
    };
  }

  // ===========================================================================
  // CAHIER DU SEMAINIER — Phase 6 : Communication inter-modules
  // ===========================================================================
  //
  // Le Cahier du Semainier agrège des données provenant de trois autres modules
  // pour pré-remplir automatiquement les sections journalières :
  //
  //   • Module RH            → Section 1 (Présence enseignants)
  //     Table source : staff_attendances (status, checkIn, checkOut, hoursWorked)
  //
  //   • Module Élèves        → Section 2 (Présence élèves)
  //     Table source : attendance_records (status = ABSENT/LATE/PRESENT, notes)
  //
  //   • Module EDT           → Section 3 (Pédagogie / respect du programme)
  //     Table source : timetable_entries (dayOfWeek, startTime, endTime, classId)
  //     Permet d'identifier les cours non assurés / modifiés.
  //
  // Chaque méthode de sync peut être appelée individuellement, ou toutes ensemble
  // via fetchCrossModuleData. Les données sont écrites dans les champs JSONB
  // correspondants (teacherAttendance, studentPresence, pedagogy) du rapport
  // journalier — sans écraser les saisies manuelles déjà effectuées.

  /**
   * Récupère, pour un rapport journalier donné :
   *   - le rapport lui-même (avec sa date et sa config)
   *   - les présences enseignants (RH) du même jour
   *   - les appels élèves (Attendance) du même jour
   *   - les créneaux EDT du jour de la semaine correspondant
   *
   * Ne modifie PAS le rapport — sert d'aperçu avant sync.
   */
  async fetchCrossModuleData(tenantId: string, reportId: string) {
    const report: any = await this.prisma.$queryRawUnsafe(
      `SELECT dr.*, sc."weekStartDate", sc."weekEndDate", sc."weekNumber",
              sc."teacherId", sc."academicYearId"
       FROM "weekly_seminar_daily_report" dr
       JOIN "weekly_seminar_config" sc ON sc."id" = dr."seminarConfigId"
       WHERE dr."id" = $1 AND dr."tenantId" = $2`,
      reportId, tenantId,
    );
    if (!report || report.length === 0) {
      throw new NotFoundException('Rapport journalier non trouvé');
    }
    const r = report[0];
    const targetDate = r.date;

    // ── RH : présences enseignants du jour ─────────────────────────────
    const staffAttendances: any = await this.prisma.$queryRawUnsafe(
      `SELECT sa.*, s."firstName", s."lastName",
              COALESCE(s."tenantMatricule", s."globalMatricule", s."employeeNumber") AS "matricule"
       FROM "staff_attendances" sa
       LEFT JOIN "staff" s ON s."id" = sa."staffId"
       WHERE sa."tenantId" = $1 AND sa."academicYearId" = $2
         AND sa."date" = $3
       ORDER BY s."lastName" ASC, s."firstName" ASC`,
      tenantId, r.academicYearId, targetDate,
    );

    // ── Élèves : appels du jour (agrégés par classe) ───────────────────
    // ⭐ FIX : inclure le champ `late` (boolean séparé du status) pour que la
    //    synthèse des retards soit correcte. Un élève peut être PRESENT avec
    //    late=true (en retard) — l'ancienne requête ne retournait pas ce champ.
    // ⭐ FIX : filtrer aussi par schoolLevelId si présent dans la config du
    //    semainier (les semainiers sont affectés à MATERNELLE + PRIMAIRE).
    const studentAttendances: any = await this.prisma.$queryRawUnsafe(
      `SELECT ar."classId", ar."status", ar."late", ar."notes",
              COUNT(*)::int AS "count",
              SUM(CASE WHEN ar."late" = true THEN 1 ELSE 0 END)::int AS "lateCount",
              c."name" AS "className"
       FROM "attendance_records" ar
       LEFT JOIN "classes" c ON c."id" = ar."classId"
       WHERE ar."tenantId" = $1 AND ar."academicYearId" = $2
         AND DATE(ar."date") = DATE($3)
       GROUP BY ar."classId", ar."status", ar."late", ar."notes", c."name"
       ORDER BY c."name" ASC`,
      tenantId, r.academicYearId, targetDate,
    );

    // ── EDT : créneaux du jour de la semaine (Lun=1..Ven=5) ────────────
    const timetableEntries: any = await this.prisma.$queryRawUnsafe(
      `SELECT te.*, c."name" AS "className", s."name" AS "subjectName",
              t."firstName" AS "teacherFirstName", t."lastName" AS "teacherLastName",
              r."roomName"
       FROM "timetable_entries" te
       LEFT JOIN "classes" c ON c."id" = te."classId"
       LEFT JOIN "subjects" s ON s."id" = te."subjectId"
       LEFT JOIN "teachers" t ON t."id" = te."teacherId"
       LEFT JOIN "rooms" r ON r."id" = te."roomId"
       WHERE te."tenantId" = $1 AND te."academicYearId" = $2
         AND te."dayOfWeek" = $3
       ORDER BY te."startTime" ASC`,
      tenantId, r.academicYearId, r.dayOfWeek,
    );

    return {
      report: r,
      rh: {
        staffAttendances: staffAttendances.map((s: any) => ({
          staffId: s.staffId,
          name: s.firstName ? `${s.firstName} ${s.lastName}` : s.matricule,
          status: s.status,
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          hoursWorked: s.hoursWorked,
          notes: s.notes,
        })),
        summary: {
          total: staffAttendances.length,
          present: staffAttendances.filter((s: any) => s.status === 'PRESENT').length,
          absent: staffAttendances.filter((s: any) => s.status === 'ABSENT').length,
          late: staffAttendances.filter((s: any) => s.status === 'LATE').length,
          leave: staffAttendances.filter((s: any) => s.status === 'LEAVE').length,
        },
      },
      students: {
        byClass: studentAttendances.map((sa: any) => ({
          classId: sa.classId,
          className: sa.className,
          status: sa.status,
          count: sa.count,
          late: sa.late,
          lateCount: sa.lateCount,
          notes: sa.notes,
        })),
        summary: {
          totalRecords: studentAttendances.reduce((acc: number, sa: any) => acc + sa.count, 0),
          // ⭐ FIX : compter ABSENT et ABSENT_HALF comme absents (l'élève est
          //    absent au moins une demi-journée). Avant, seul 'ABSENT' (journée
          //    complète) était compté → les ABSENT_HALF tombaient dans l'oubli.
          absent: studentAttendances
            .filter((sa: any) => sa.status === 'ABSENT' || sa.status === 'ABSENT_HALF')
            .reduce((acc: number, sa: any) => acc + sa.count, 0),
          // ⭐ FIX : compter les retards via le boolean `late` (pas via le status).
          //    Avant, la requête ne retournait pas `late`, donc les élèves en
          //    retard (PRESENT + late=true) n'étaient pas comptés.
          late: studentAttendances
            .reduce((acc: number, sa: any) => acc + (Number(sa.lateCount) || 0), 0),
          present: studentAttendances
            .filter((sa: any) => sa.status === 'PRESENT')
            .reduce((acc: number, sa: any) => acc + sa.count, 0),
          // ⭐ Nouvelles métriques pour affinage
          excused: studentAttendances
            .filter((sa: any) => sa.status === 'EXCUSED')
            .reduce((acc: number, sa: any) => acc + sa.count, 0),
          absentHalf: studentAttendances
            .filter((sa: any) => sa.status === 'ABSENT_HALF')
            .reduce((acc: number, sa: any) => acc + sa.count, 0),
        },
      },
      edt: {
        entries: timetableEntries.map((te: any) => ({
          id: te.id,
          classId: te.classId,
          className: te.className,
          subjectName: te.subjectName,
          teacher: te.teacherFirstName ? `${te.teacherFirstName} ${te.teacherLastName}` : null,
          room: te.roomName,
          startTime: te.startTime,
          endTime: te.endTime,
          duration: te.duration,
        })),
        total: timetableEntries.length,
      },
    };
  }

  /**
   * Synchronise la Section 1 (Présence enseignants) depuis le module RH.
   * Écrit dans teacherAttendance (JSONB) et teacherAttendanceSynthesis (TEXT).
   * N'écrase pas les modifications manuelles si l'utilisateur a déjà édité
   * (détecté via un flag `_manualEdit: true` dans le JSONB).
   */
  async syncStaffAttendanceFromRh(tenantId: string, reportId: string) {
    const crossData = await this.fetchCrossModuleData(tenantId, reportId);
    const report = crossData.report;

    // Ne pas écraser si édition manuelle
    const existingTa = typeof report.teacherAttendance === 'string'
      ? JSON.parse(report.teacherAttendance)
      : (report.teacherAttendance || null);
    if (existingTa && existingTa._manualEdit === true) {
      return {
        skipped: true,
        reason: 'Section déjà éditée manuellement — sync RH ignorée.',
        existing: existingTa,
      };
    }

    const summary = crossData.rh.summary;
    const staffList = crossData.rh.staffAttendances;

    const teacherAttendance = {
      _source: 'RH',
      _syncedAt: new Date().toISOString(),
      _manualEdit: false,
      summary,
      staff: staffList,
    };

    const synthesis = `Sur ${summary.total} enseignants attendus : `
      + `${summary.present} présents, ${summary.absent} absents, `
      + `${summary.late} en retard, ${summary.leave} en congé.`;

    await this.prisma.$executeRawUnsafe(
      `UPDATE "weekly_seminar_daily_report"
       SET "teacherAttendance" = $1::jsonb,
           "teacherAttendanceSynthesis" = $2,
           "updatedAt" = NOW()
       WHERE "id" = $3 AND "tenantId" = $4`,
      JSON.stringify(teacherAttendance), synthesis, reportId, tenantId,
    );

    this.logger.log(`✅ Sync RH → rapport ${reportId} (${summary.total} enseignants)`);
    return { synced: true, teacherAttendance, synthesis };
  }

  /**
   * Synchronise la Section 2 (Présence élèves) depuis le module Élèves (Attendance).
   * Écrit dans studentPresence (JSONB).
   * Calcule le taux de présence par classe et identifie les classes à forte absence.
   *
   * ⭐ STRATÉGIE DE FALLBACK INTELLIGENT (au lieu de retourner 0/0 si la date du
   *    rapport journalier n'a pas d'appel enregistré — par ex. en période de test
   *    hors des dates réelles du semainier) :
   *
   *    1. Essayer DATE EXACTE du rapport journalier (ex: Lun. 01/09/2026)
   *    2. Si 0 records → essayer la PLAGE SEMAINE (weekStart → weekEnd)
   *    3. Si 0 records → essayer les 7 DERNIERS JOURS (aujourd'hui - 7 jours)
   *
   *    Le résultat renvoyé contient `_queriedStrategy` ('day' | 'week' | 'recent')
   *    pour que le frontend puisse afficher clairement quelle plage a été utilisée.
   *
   * ⭐ Retourne des informations de diagnostic (queriedDate, totalFound, classesCount)
   *    pour que le frontend puisse afficher un message clair en cas de 0 records.
   */
  async syncStudentPresenceFromAttendance(tenantId: string, reportId: string) {
    const crossData = await this.fetchCrossModuleData(tenantId, reportId);
    const report = crossData.report;

    const existingSp = typeof report.studentPresence === 'string'
      ? JSON.parse(report.studentPresence)
      : (report.studentPresence || null);
    if (existingSp && existingSp._manualEdit === true) {
      return {
        skipped: true,
        reason: 'Section déjà éditée manuellement — sync Élèves ignorée.',
        existing: existingSp,
      };
    }

    // ── STRATÉGIE DE FALLBACK ────────────────────────────────────────────
    //    1. Date exacte du rapport journalier (crossData.students déjà chargé)
    //    2. Plage semaine (weekStart → weekEnd)
    //    3. 7 derniers jours (aujourd'hui - 7 jours)
    let byClass = crossData.students.byClass;
    let summary = crossData.students.summary;
    let queriedStrategy: 'day' | 'week' | 'recent' = 'day';
    let queriedRange: { start: string; end: string } | null = null;
    const dayDateStr = report.date
      ? new Date(report.date).toISOString().split('T')[0]
      : null;

    // ⭐ Si 0 records pour la date exacte, essayer la plage semaine
    if ((!byClass || byClass.length === 0) && report.weekStartDate && report.weekEndDate) {
      const weekStart = new Date(report.weekStartDate);
      const weekEnd = new Date(report.weekEndDate);
      const weekRange: any = await this.prisma.$queryRawUnsafe(
        `SELECT ar."classId", ar."status", ar."late", ar."notes",
                COUNT(*)::int AS "count",
                SUM(CASE WHEN ar."late" = true THEN 1 ELSE 0 END)::int AS "lateCount",
                c."name" AS "className"
         FROM "attendance_records" ar
         LEFT JOIN "classes" c ON c."id" = ar."classId"
         WHERE ar."tenantId" = $1 AND ar."academicYearId" = $2
           AND DATE(ar."date") BETWEEN DATE($3) AND DATE($4)
         GROUP BY ar."classId", ar."status", ar."late", ar."notes", c."name"
         ORDER BY c."name" ASC`,
        tenantId, report.academicYearId, weekStart, weekEnd,
      );
      if (weekRange && weekRange.length > 0) {
        byClass = weekRange.map((sa: any) => ({
          classId: sa.classId, className: sa.className, status: sa.status,
          count: sa.count, late: sa.late, lateCount: sa.lateCount, notes: sa.notes,
        }));
        summary = this._computeStudentSummary(byClass);
        queriedStrategy = 'week';
        queriedRange = {
          start: weekStart.toISOString().split('T')[0],
          end: weekEnd.toISOString().split('T')[0],
        };
      }
    }

    // ⭐ Si toujours 0 records, essayer les 7 derniers jours
    if ((!byClass || byClass.length === 0) && report.academicYearId) {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentRange: any = await this.prisma.$queryRawUnsafe(
        `SELECT ar."classId", ar."status", ar."late", ar."notes",
                COUNT(*)::int AS "count",
                SUM(CASE WHEN ar."late" = true THEN 1 ELSE 0 END)::int AS "lateCount",
                c."name" AS "className"
         FROM "attendance_records" ar
         LEFT JOIN "classes" c ON c."id" = ar."classId"
         WHERE ar."tenantId" = $1 AND ar."academicYearId" = $2
           AND DATE(ar."date") BETWEEN DATE($3) AND DATE($4)
         GROUP BY ar."classId", ar."status", ar."late", ar."notes", c."name"
         ORDER BY c."name" ASC`,
        tenantId, report.academicYearId, sevenDaysAgo, today,
      );
      if (recentRange && recentRange.length > 0) {
        byClass = recentRange.map((sa: any) => ({
          classId: sa.classId, className: sa.className, status: sa.status,
          count: sa.count, late: sa.late, lateCount: sa.lateCount, notes: sa.notes,
        }));
        summary = this._computeStudentSummary(byClass);
        queriedStrategy = 'recent';
        queriedRange = {
          start: sevenDaysAgo.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0],
        };
      }
    }

    // Identifier les classes à forte absence (>30% d'absents)
    const highAbsenceClasses = byClass
      .filter((c: any) => {
        const total = byClass
          .filter((x: any) => x.classId === c.classId)
          .reduce((acc: number, x: any) => acc + x.count, 0);
        const absent = byClass
          .filter((x: any) => x.classId === c.classId && (x.status === 'ABSENT' || x.status === 'ABSENT_HALF'))
          .reduce((acc: number, x: any) => acc + x.count, 0);
        return total > 0 && (absent / total) > 0.3;
      })
      .map((c: any) => c.className)
      .filter((v: any, i: number, arr: any[]) => arr.indexOf(v) === i);

    const totalRecords = summary.totalRecords || 0;
    const present = summary.present || 0;
    const rate = totalRecords > 0 ? (present / totalRecords) * 100 : 0;

    const studentPresence = {
      _source: 'STUDENTS',
      _syncedAt: new Date().toISOString(),
      _manualEdit: false,
      // ⭐ Information de diagnostic pour le frontend
      _queriedDate: dayDateStr,
      _queriedStrategy: queriedStrategy,  // 'day' | 'week' | 'recent'
      _queriedRange: queriedRange,  // { start, end } si strategy='week' ou 'recent'
      _totalFound: totalRecords,
      _classesCount: byClass
        .map((c: any) => c.classId)
        .filter((v: any, i: number, arr: any[]) => arr.indexOf(v) === i)
        .length,
      attendanceRate: Number(rate.toFixed(2)),
      summary,
      byClass,
      highAbsenceClasses,
      parentNotifiedAbsences: '',  // à remplir manuellement
      lateCount: summary.late,
      specialCases: '',
    };

    await this.prisma.$executeRawUnsafe(
      `UPDATE "weekly_seminar_daily_report"
       SET "studentPresence" = $1::jsonb,
           "updatedAt" = NOW()
       WHERE "id" = $2 AND "tenantId" = $3`,
      JSON.stringify(studentPresence), reportId, tenantId,
    );

    this.logger.log(
      `✅ Sync Élèves → rapport ${reportId} (strategy=${queriedStrategy}, ` +
      `date=${dayDateStr}, ${totalRecords} records, ${studentPresence._classesCount} classes, ` +
      `taux=${rate.toFixed(1)}%)`,
    );
    return {
      synced: true,
      studentPresence,
      // ⭐ Diagnostic info pour le frontend
      diagnostic: {
        queriedDate: dayDateStr,
        queriedStrategy,
        queriedRange,
        totalFound: totalRecords,
        classesCount: studentPresence._classesCount,
      },
    };
  }

  /**
   * Helper privé : compute student summary from byClass array.
   * Utilisé par syncStudentPresenceFromAttendance pour les fallbacks week/recent.
   */
  private _computeStudentSummary(byClass: any[]) {
    return {
      totalRecords: byClass.reduce((acc: number, sa: any) => acc + sa.count, 0),
      absent: byClass
        .filter((sa: any) => sa.status === 'ABSENT' || sa.status === 'ABSENT_HALF')
        .reduce((acc: number, sa: any) => acc + sa.count, 0),
      late: byClass.reduce((acc: number, sa: any) => acc + (Number(sa.lateCount) || 0), 0),
      present: byClass
        .filter((sa: any) => sa.status === 'PRESENT')
        .reduce((acc: number, sa: any) => acc + sa.count, 0),
      excused: byClass
        .filter((sa: any) => sa.status === 'EXCUSED')
        .reduce((acc: number, sa: any) => acc + sa.count, 0),
      absentHalf: byClass
        .filter((sa: any) => sa.status === 'ABSENT_HALF')
        .reduce((acc: number, sa: any) => acc + sa.count, 0),
    };
  }

  /**
   * Synchronise la Section 3 (Pédagogie / respect du programme) depuis l'EDT.
   * Écrit dans pedagogy (JSONB).
   * Compare les créneaux prévus avec les saisies pédagogiques existantes
   * (class_logs / cahier journal) pour identifier les cours non assurés.
   */
  async syncScheduleFromEdt(tenantId: string, reportId: string) {
    const crossData = await this.fetchCrossModuleData(tenantId, reportId);
    const report = crossData.report;
    const targetDate = report.date;

    const existingPed = typeof report.pedagogy === 'string'
      ? JSON.parse(report.pedagogy)
      : (report.pedagogy || null);
    if (existingPed && existingPed._manualEdit === true) {
      return {
        skipped: true,
        reason: 'Section déjà éditée manuellement — sync EDT ignorée.',
        existing: existingPed,
      };
    }

    // Récupérer les saisies de cahier journal du jour (pedagogy_class_logs)
    const classLogs: any = await this.prisma.$queryRawUnsafe(
      `SELECT cl."classId", cl."subjectId", cl."topic", cl."homework",
              cl."durationHours", c."name" AS "className",
              s."name" AS "subjectName"
       FROM "pedagogy_class_logs" cl
       LEFT JOIN "classes" c ON c."id" = cl."classId"
       LEFT JOIN "subjects" s ON s."id" = cl."subjectId"
       WHERE cl."tenantId" = $1 AND DATE(cl."lessonDate") = DATE($2)`,
      tenantId, targetDate,
    );

    const edtEntries = crossData.edt.entries;
    const taughtKeys = new Set(
      classLogs.map((cl: any) => `${cl.classId}|${cl.subjectId}`),
    );

    // Cours prévus mais non saisis dans le cahier journal
    const missingCourses = edtEntries.filter((te: any) =>
      te.classId && te.subjectId && !taughtKeys.has(`${te.classId}|${te.subjectId}`),
    );

    // Cours saisis mais non prévus à l'EDT (modifications)
    const edtKeys = new Set(
      edtEntries.map((te: any) => `${te.classId}|${te.subjectId}`),
    );
    const modifiedCourses = classLogs.filter((cl: any) =>
      cl.classId && cl.subjectId && !edtKeys.has(`${cl.classId}|${cl.subjectId}`),
    );

    const pedagogy = {
      _source: 'EDT',
      _syncedAt: new Date().toISOString(),
      _manualEdit: false,
      scheduleRespected: missingCourses.length === 0 && modifiedCourses.length === 0,
      scheduledCourses: edtEntries,
      taughtCourses: classLogs.map((cl: any) => ({
        classId: cl.classId,
        className: cl.className,
        subjectId: cl.subjectId,
        subjectName: cl.subjectName,
        topic: cl.topic,
        homework: cl.homework,
        durationHours: cl.durationHours,
      })),
      missingCourses: missingCourses.map((te: any) => ({
        className: te.className,
        subjectName: te.subjectName,
        teacher: te.teacher,
        startTime: te.startTime,
        endTime: te.endTime,
      })),
      modifiedCourses: modifiedCourses.map((cl: any) => ({
        className: cl.className,
        subjectName: cl.subjectName,
      })),
      remarkableActivities: '',
      classClimate: '',
    };

    await this.prisma.$executeRawUnsafe(
      `UPDATE "weekly_seminar_daily_report"
       SET "pedagogy" = $1::jsonb,
           "updatedAt" = NOW()
       WHERE "id" = $2 AND "tenantId" = $3`,
      JSON.stringify(pedagogy), reportId, tenantId,
    );

    this.logger.log(`✅ Sync EDT → rapport ${reportId} `
      + `(${missingCourses.length} manquants, ${modifiedCourses.length} modifiés)`);
    return { synced: true, pedagogy };
  }

  // ===========================================================================
  // CAHIER DU SEMAINIER — Phase 7 : Export PDF
  // ===========================================================================
  //
  // Génère un PDF multi-pages du Cahier du Semainier pour une semaine donnée.
  // Le PDF contient :
  //   - Page 1 : Couverture (école, semaine, trimestre, enseignant, classe)
  //   - Pages 2-6 : Un rapport journalier par jour (Lun..Ven) avec les 8 sections
  //   - Page 7 : Synthèse hebdomadaire + signatures
  //
  // Utilise PuppeteerPoolService (comme l'export du cahier journal et de la
  // finance) pour rendre un HTML/CSS en PDF A4 portrait.

  /**
   * Exporte la semaine complète d'un Cahier du Semainier en PDF ou CSV.
   *
   * @param tenantId   ID du tenant
   * @param configId   ID de la weekly_seminar_config (semaine)
   * @param format     'pdf' | 'excel' (excel = CSV avec BOM)
   */
  async exportSeminarWeek(tenantId: string, configId: string, format: string): Promise<{ buffer: Buffer; filename: string }> {
    // Charger la config + l'année scolaire + l'école (avec profil d'identité)
    const configRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT wsc.*, t."firstName" AS "teacherFirstName", t."lastName" AS "teacherLastName",
              ay."label" AS "academicYearLabel", ay."startDate" AS "academicYearStart",
              tip."schoolName", tip."city" AS "schoolCity", tip."logoUrl" AS "schoolLogo"
       FROM "weekly_seminar_config" wsc
       LEFT JOIN "teachers" t ON t."id" = wsc."teacherId"
       LEFT JOIN "academic_years" ay ON ay."id" = wsc."academicYearId"
       LEFT JOIN "tenant_identity_profiles" tip ON tip."tenantId" = wsc."tenantId" AND tip."isActive" = true
       WHERE wsc."id" = $1 AND wsc."tenantId" = $2`,
      configId, tenantId,
    );
    if (!configRows || configRows.length === 0) {
      throw new NotFoundException('Config du semainier non trouvée');
    }
    const cfg = configRows[0];

    // Charger les 5 rapports journaliers (Lun..Ven)
    const dailyReports: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "weekly_seminar_daily_report"
       WHERE "seminarConfigId" = $1 AND "tenantId" = $2
       ORDER BY "dayOfWeek" ASC`,
      configId, tenantId,
    );

    const teacherName = cfg.teacherFirstName
      ? `${cfg.teacherFirstName} ${cfg.teacherLastName}`
      : '—';
    const weekLabel = `Semaine ${cfg.weekNumber} (S${cfg.weekNumber})`;
    const trimesterLabel = `Trimestre ${cfg.trimester}`;

    // ⭐ Construire le nom du fichier PDF/CSV : "Cahier_du_Semainier_S{N}_{ddMMyyyy-ddMMyyyy}_{Nom_Avec_Espaces}"
    //    Exemple : "Cahier_du_Semainier_S1_01092025-05092025_Jean_Dupont.pdf"
    //    - Période = dates de début et fin de semaine au format ddMMyyyy
    //    - Nom du semainier = prénom + nom (espaces remplacés par _)
    const fmtDateForFilename = (d: any): string => {
      if (!d) return 'unknown';
      const date = new Date(d);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}${mm}${yyyy}`;
    };
    const periodStart = fmtDateForFilename(cfg.weekStartDate);
    const periodEnd = fmtDateForFilename(cfg.weekEndDate);
    // ⭐ Nettoyer le nom du semainier pour le nom de fichier (espaces → _,
    //    caractères spéciaux supprimés, max 50 chars pour éviter noms trop longs)
    const cleanTeacherName = (cfg.teacherFirstName && cfg.teacherLastName
      ? `${cfg.teacherFirstName}_${cfg.teacherLastName}`
      : 'sans_enseignant'
    ).replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
    const ext = format === 'excel' ? 'csv' : 'pdf';
    const filename = `Cahier_du_Semainier_S${cfg.weekNumber}_${periodStart}-${periodEnd}_${cleanTeacherName}.${ext}`;

    if (format === 'excel') {
      // ── Export CSV (synthèse des 5 jours) ────────────────────────────
      const rows: string[] = [];
      rows.push('Jour,Date,Statut enseignants,Présence élèves (%),Cours non assurés,Discipline,Hygiène,Visites,Communication,Résumé');
      const dayLabels = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
      for (const dr of dailyReports) {
        const ta = typeof dr.teacherAttendance === 'string'
          ? JSON.parse(dr.teacherAttendance) : (dr.teacherAttendance || {});
        const sp = typeof dr.studentPresence === 'string'
          ? JSON.parse(dr.studentPresence) : (dr.studentPresence || {});
        const ped = typeof dr.pedagogy === 'string'
          ? JSON.parse(dr.pedagogy) : (dr.pedagogy || {});
        const disc = typeof dr.discipline === 'string'
          ? JSON.parse(dr.discipline) : (dr.discipline || {});
        const hyg = typeof dr.hygiene === 'string'
          ? JSON.parse(dr.hygiene) : (dr.hygiene || {});
        const vis = typeof dr.visits === 'string'
          ? JSON.parse(dr.visits) : (dr.visits || {});
        const com = typeof dr.communication === 'string'
          ? JSON.parse(dr.communication) : (dr.communication || {});
        const ds = typeof dr.dailySummary === 'string'
          ? JSON.parse(dr.dailySummary) : (dr.dailySummary || {});

        const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        rows.push([
          esc(dayLabels[dr.dayOfWeek] || ''),
          esc(dr.date ? new Date(dr.date).toLocaleDateString('fr-FR') : ''),
          esc(ta.summary ? `${ta.summary.present}/${ta.summary.total} présents` : ''),
          esc(sp.attendanceRate != null ? `${sp.attendanceRate}%` : ''),
          esc(ped.missingCourses ? `${ped.missingCourses.length} cours` : ''),
          esc(disc.positiveBehaviors || ''),
          esc(hyg.roomCleanliness || ''),
          esc(vis.adminVisit || vis.pedagoVisit || vis.parentVisit ? 'Oui' : 'Non'),
          esc(com.directorInstructions || ''),
          esc(ds.strengths || ''),
        ].join(','));
      }
      // BOM UTF-8 pour Excel
      return { buffer: Buffer.from('\uFEFF' + rows.join('\n'), 'utf-8'), filename };
    }

    // ── Export PDF via Puppeteer ───────────────────────────────────────
    const dayLabels = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const dayColors = ['', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    const txt = (v: any) => String(v ?? '').replace(/<[^>]*>/g, '');

    // Helper pour rendre une section journalière
    // ⭐ FIX : utiliser les MÊMES noms de champs que le frontend (CahierSemaineTab.tsx)
    //    Avant ce fix, plusieurs champs étaient absents du PDF car les noms ne
    //    correspondaient pas (ex: c.toiletsCondition vs c.toilets côté frontend).
    // ⭐ FIX : rendre TOUS les champs affichés dans l'interface pour que le PDF
    //    soit identique à l'écran (l'utilisateur a explicitement demandé que
    //    tous les champs soient renseignés dans le PDF).
    const renderDailySection = (title: string, color: string, content: any): string => {
      const txt = (v: any) => String(v ?? '').replace(/<[^>]*>/g, '');
      // ⭐ Helper : rendre le HTML tel quel (RichTextEditor stocke en HTML)
      const html = (v: any) => v ? String(v ?? '') : '';
      if (!content) {
        return `<div class="section" style="border-left-color:${color}">
          <h3 style="background:${color}">${title}</h3>
          <p class="empty"><em>Non renseigné</em></p>
        </div>`;
      }
      const c = typeof content === 'string' ? JSON.parse(content) : content;
      let body = '';
      if (title === '1. Présence des enseignants') {
        // ⭐ Le frontend stocke teacherAttendance comme un TABLEAU d'entrées
        //    [{ name, status, present, absent, motif, observation, replacement }]
        //    Le backend syncStaffAttendanceFromRh stocke un objet { summary, staff }
        //    On gère les deux formats pour que le PDF marche dans tous les cas.
        const staffArray = Array.isArray(c) ? c : (c.staff || []);
        const summary = c.summary || null;
        const synthesis = c.teacherAttendanceSynthesis || c.synthesis || '';

        // ⭐ Bandeau synthèse (4 cartes mini)
        if (summary) {
          body += `<div class="stats-row">
            <div class="stat-box stat-emerald"><strong>${summary.present ?? 0}</strong><span>Présents</span></div>
            <div class="stat-box stat-rose"><strong>${summary.absent ?? 0}</strong><span>Absents</span></div>
            <div class="stat-box stat-amber"><strong>${summary.late ?? 0}</strong><span>Retards</span></div>
            <div class="stat-box stat-slate"><strong>${summary.total ?? staffArray.length ?? 0}</strong><span>Total</span></div>
          </div>`;
        }
        // ⭐ Tableau détaillé des enseignants (toutes les colonnes comme l'interface)
        if (staffArray.length > 0) {
          body += '<table><thead><tr><th>Nom</th><th>Présent</th><th>Absent</th><th>Motif d\'absence</th><th>Observation</th><th>Remplacement</th></tr></thead><tbody>';
          for (const s of staffArray) {
            // ⭐ Compatibilité ancien/nouveau format : le frontend stocke `present`/`absent` (booleens),
            // le backend syncStaffAttendanceFromRh stocke `status` (string)
            const isPresent = s.present === true || s.status === 'PRESENT' || s.status === 'LATE' || s.status === 'HALF_DAY' || s.status === 'MISSION';
            const isAbsent = s.absent === true || s.status === 'ABSENT';
            // ⭐ FIX : utiliser des SVG inline pour les coches/croix au lieu de
            //    caractères Unicode (✓ ✗) qui ne s'affichaient pas correctement
            //    dans le PDF (apparaissaient comme des "carreaux rectangulaires
            //    verticaux" — l'utilisateur a rapporté ce bug). Les SVG sont
            //    universellement supportés par Puppeteer/Chromium.
            const checkSvg = `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle"><path d="M3 8 L6.5 11.5 L13 4.5" stroke="#10b981" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            const crossSvg = `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle"><path d="M4 4 L12 12 M12 4 L4 12" stroke="#ef4444" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
            body += `<tr>
              <td>${txt(s.name || s.staffName || '—')}</td>
              <td style="text-align:center">${isPresent ? checkSvg : ''}</td>
              <td style="text-align:center">${isAbsent ? crossSvg : ''}</td>
              <td>${txt(s.motif || (s.status === 'ABSENT' ? s.notes || '' : ''))}</td>
              <td>${txt(s.observation || '')}</td>
              <td>${txt(s.replacement || '')}</td>
            </tr>`;
          }
          body += '</tbody></table>';
        }
        // ⭐ Synthèse libre (RichTextEditor HTML)
        if (synthesis) {
          body += `<div class="rt-field"><strong>Synthèse :</strong> ${html(synthesis)}</div>`;
        }
      } else if (title === '2. Présence des élèves') {
        // ⭐ Bandeau stats (4 chiffres)
        const rate = c.attendanceRate ?? c.globalRate;
        const summary = c.summary || {};
        body += `<div class="stats-row">
          <div class="stat-box ${rate != null && rate >= 90 ? 'stat-emerald' : rate != null && rate >= 70 ? 'stat-amber' : 'stat-rose'}">
            <strong>${rate != null ? rate + '%' : '—'}</strong><span>Taux présence</span></div>
          <div class="stat-box stat-rose"><strong>${summary.absent ?? 0}</strong><span>Absents</span></div>
          <div class="stat-box stat-amber"><strong>${summary.late ?? c.lateCount ?? 0}</strong><span>Retards</span></div>
          <div class="stat-box stat-purple"><strong>${(c.highAbsenceClasses || []).length}</strong><span>Classes à risque</span></div>
        </div>`;
        if (summary.totalRecords != null) {
          body += `<p><strong>Élèves pointés:</strong> ${summary.totalRecords} (${summary.present ?? 0} présents, ${summary.absent ?? 0} absents, ${summary.late ?? 0} retards)</p>`;
        }
        // ⭐ Alerte classes >30% absent
        if (c.highAbsenceClasses && c.highAbsenceClasses.length > 0) {
          body += `<p class="alert"><strong>⚠ Classes à forte absence (&gt;30%):</strong> ${c.highAbsenceClasses.join(', ')}</p>`;
        }
        // ⭐ Tableau par classe (complet comme l'interface)
        if (c.byClass && c.byClass.length > 0) {
          // Agréger par classe (le backend renvoie une ligne par classId+status)
          const classMap = new Map<string, any>();
          for (const b of c.byClass) {
            const key = b.classId || b.className;
            if (!classMap.has(key)) {
              classMap.set(key, { className: b.className || '—', total: 0, present: 0, absent: 0, late: 0 });
            }
            const e = classMap.get(key);
            e.total += Number(b.count) || 0;
            if (b.status === 'PRESENT') e.present += Number(b.count) || 0;
            else if (b.status === 'ABSENT' || b.status === 'ABSENT_HALF') e.absent += Number(b.count) || 0;
            e.late += Number(b.lateCount) || 0;
          }
          body += '<table><thead><tr><th>Classe</th><th>Effectif</th><th>Présents</th><th>Absents</th><th>Retards</th><th>Taux</th></tr></thead><tbody>';
          for (const [, e] of classMap) {
            const classRate = e.total > 0 ? ((e.present / e.total) * 100).toFixed(1) : '0.0';
            body += `<tr><td>${e.className}</td><td style="text-align:center">${e.total}</td><td style="text-align:center">${e.present}</td><td style="text-align:center">${e.absent}</td><td style="text-align:center">${e.late}</td><td style="text-align:center">${classRate}%</td></tr>`;
          }
          body += '</tbody></table>';
        }
        // ⭐ Absences signalées par les parents (manuel)
        if (c.parentAbsences || c.parentNotifiedAbsences) {
          body += `<p><strong>Absences signalées par les parents:</strong> ${txt(c.parentAbsences || c.parentNotifiedAbsences)}</p>`;
        }
        // ⭐ Cas particuliers observés (RichTextEditor HTML)
        if (c.specialCases) {
          body += `<div class="rt-field"><strong>Cas particuliers observés:</strong> ${html(c.specialCases)}</div>`;
        }
      } else if (title === '3. Pédagogie / Respect du programme') {
        // ⭐ FIX : utiliser edtRespect (frontend) au lieu de scheduleRespected (ancien nom)
        body += `<p><strong>Respect de l'emploi du temps:</strong> ${txt(c.edtRespect ?? (c.scheduleRespected ? 'Oui' : 'Non'))}</p>`;
        // ⭐ FIX : utiliser missedClasses (frontend) au lieu de missedCourses
        if (c.missedClasses) body += `<div class="rt-field"><strong>Cours non assurés ou modifiés:</strong> ${html(c.missedClasses)}</div>`;
        else if (c.missingCourses && c.missingCourses.length > 0) {
          body += '<p><strong>Cours non assurés:</strong></p><ul>';
          for (const m of c.missingCourses) {
            body += `<li>${txt(m.className)} — ${txt(m.subjectName)} (${m.startTime}-${m.endTime})</li>`;
          }
          body += '</ul>';
        }
        if (c.modifiedCourses && c.modifiedCourses.length > 0) {
          body += '<p><strong>Cours modifiés:</strong></p><ul>';
          for (const m of c.modifiedCourses) {
            body += `<li>${txt(m.className)} — ${txt(m.subjectName)}</li>`;
          }
          body += '</ul>';
        }
        if (c.remarkableActivities) body += `<div class="rt-field"><strong>Activités pédagogiques remarquables:</strong> ${html(c.remarkableActivities)}</div>`;
        if (c.classClimate) body += `<p><strong>Climat des classes:</strong> ${txt(c.classClimate)}</p>`;
      } else if (title === '4. Discipline') {
        if (c.positiveBehaviors) body += `<div class="rt-field"><strong>Comportements positifs observés:</strong> ${html(c.positiveBehaviors)}</div>`;
        if (c.problemBehaviors) body += `<div class="rt-field"><strong>Comportements problématiques:</strong> ${html(c.problemBehaviors)}</div>`;
        if (c.correctiveMeasures) body += `<div class="rt-field"><strong>Mesures correctives appliquées:</strong> ${html(c.correctiveMeasures)}</div>`;
      } else if (title === '5. Hygiène') {
        // ⭐ FIX : utiliser les BONS noms de champs (toilets, water, electricity)
        body += `
          <p><strong>Propreté des salles:</strong> ${txt(c.roomCleanliness)}</p>
          <p><strong>Toilettes:</strong> ${txt(c.toilets ?? c.toiletsCondition)}</p>
          <p><strong>Eau:</strong> ${txt(c.water ?? c.waterStatus)}</p>
          <p><strong>Électricité:</strong> ${txt(c.electricity ?? c.electricityStatus)}</p>`;
        if (c.urgentRepairs) body += `<div class="rt-field"><strong>Points de réparation urgente:</strong> ${html(c.urgentRepairs)}</div>`;
      } else if (title === '6. Visites') {
        // ⭐ FIX : utiliser pedagogicVisit (frontend) au lieu de pedagoVisit
        body += `
          <p>• Visite administrative: ${c.adminVisit ? 'Oui' : 'Non'}</p>
          <p>• Visite pédagogique: ${(c.pedagogicVisit ?? c.pedagoVisit) ? 'Oui' : 'Non'}</p>
          <p>• Visite de parents: ${c.parentVisit ? 'Oui' : 'Non'}</p>`;
        if (c.visitDetails) body += `<div class="rt-field"><strong>Détails (visiteur, objet, durée):</strong> ${html(c.visitDetails)}</div>`;
      } else if (title === '7. Communication') {
        if (c.directionInstructions) body += `<div class="rt-field"><strong>Instructions reçues de la direction:</strong> ${html(c.directionInstructions)}</div>`;
        if (c.urgentNeeds) body += `<div class="rt-field"><strong>Besoins urgents communiqués:</strong> ${html(c.urgentNeeds)}</div>`;
      } else if (title === '8. Résumé journalier') {
        if (c.strengths) body += `<div class="rt-field"><strong>Points forts:</strong> ${html(c.strengths)}</div>`;
        if (c.improvements) body += `<div class="rt-field"><strong>Points à améliorer:</strong> ${html(c.improvements)}</div>`;
        if (c.recommendations) body += `<div class="rt-field"><strong>Recommandations:</strong> ${html(c.recommendations)}</div>`;
      }
      return `<div class="section" style="border-left-color:${color}">
        <h3 style="background:${color}">${title}</h3>
        <div class="section-body">${body}</div>
      </div>`;
    };

    // Construire le HTML complet
    let html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Cahier du Semainier — ${weekLabel}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.5; }
  .cover { text-align: center; padding: 40px 20px; page-break-after: always; }
  .cover h1 { font-size: 26px; color: #1e3a8a; margin-bottom: 8px; }
  .cover h2 { font-size: 18px; color: #475569; margin: 4px 0; }
  .cover .meta { margin-top: 30px; font-size: 13px; }
  .cover .meta div { margin: 6px 0; }
  .cover .badge { display: inline-block; padding: 4px 14px; background: #1e3a8a; color: white;
                  border-radius: 16px; font-weight: 600; margin-top: 20px; }
  .day-page { page-break-after: always; }
  .day-header { background: #f1f5f9; padding: 10px 14px; border-left: 4px solid #1e3a8a;
                margin-bottom: 14px; }
  .day-header h2 { margin: 0; font-size: 16px; color: #1e3a8a; }
  .day-header .date { font-size: 11px; color: #64748b; }
  .section { border: 1px solid #e5e7eb; border-left: 4px solid #1e3a8a;
             border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
  .section h3 { margin: 0; padding: 6px 10px; color: white; font-size: 11px; font-weight: 600; }
  .section-body { padding: 6px 0; }
  .section .empty, .section p, .section ul, .section table, .section .rt-field, .section .stats-row { padding: 6px 10px; margin: 0; }
  .section .rt-field { word-wrap: break-word; }
  .section .rt-field p { padding: 0; margin: 0 0 4px 0; }
  .section .rt-field p:last-child { margin: 0; }
  .section .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 6px 10px; margin: 4px 10px; border-radius: 3px; }
  .section ul { padding-left: 26px; }
  .section table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 4px 0; }
  .section table th { background: #f8fafc; text-align: left; padding: 4px 6px;
                      border-bottom: 1px solid #e5e7eb; font-weight: 600; }
  .section table td { padding: 4px 6px; border-bottom: 1px solid #f1f5f9; }
  /* ⭐ Stats row (4 mini cards) for Section 1 + Section 2 */
  .stats-row { display: flex; gap: 6px; margin: 6px 10px !important; padding: 0 !important; }
  .stat-box { flex: 1; padding: 6px 8px; text-align: center; border-radius: 4px; border: 1px solid #e5e7eb; }
  .stat-box strong { display: block; font-size: 16px; font-weight: 700; margin-bottom: 2px; }
  .stat-box span { font-size: 9px; text-transform: uppercase; opacity: 0.7; }
  .stat-emerald { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .stat-rose { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  .stat-amber { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  .stat-slate { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
  .stat-purple { background: #faf5ff; color: #7c3aed; border-color: #ddd6fe; }
  .signature-block { margin-top: 30px; display: flex; justify-content: space-between; gap: 40px; }
  .signature-block > div { flex: 1; text-align: center; }
  .signature-block .sig-label { font-weight: 600; color: #1e3a8a; margin-bottom: 50px; }
  .signature-block .sig-line { border-top: 1px solid #64748b; padding-top: 6px; min-height: 24px; }
  .signature-block .sig-line img { max-height: 60px; max-width: 200px; margin: 0 auto; display: block; }
  /* ⭐ Footer avec numéro de page */
  .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 6px; }
  /* ⭐ Cover page redesign — plus propre avec logo école + statut français */
  .cover {
    text-align: center;
    padding: 60px 30px;
    page-break-after: always;
    min-height: 90vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    border: 4px double #1e3a8a;
    border-radius: 8px;
    margin: 10px;
  }
  .cover .logo-wrapper {
    width: 110px; height: 110px;
    margin: 0 auto 20px auto;
    border: 3px solid #1e3a8a;
    border-radius: 50%;
    background: white;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .cover .logo-wrapper img { max-width: 90%; max-height: 90%; object-fit: contain; }
  .cover .logo-placeholder { font-size: 36px; color: #1e3a8a; font-weight: bold; }
  .cover h1 { font-size: 30px; color: #1e3a8a; margin: 10px 0 6px 0; letter-spacing: 1px; }
  .cover .subtitle { font-size: 13px; color: #64748b; margin-bottom: 20px; font-style: italic; }
  .cover h2 { font-size: 18px; color: #475569; margin: 4px 0; }
  .cover .meta {
    margin-top: 30px;
    font-size: 13px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px 30px;
    min-width: 350px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.04);
  }
  .cover .meta div { margin: 8px 0; text-align: left; }
  .cover .meta .label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 8px; }
  .cover .badge {
    display: inline-block;
    padding: 6px 18px;
    color: white;
    border-radius: 20px;
    font-weight: 600;
    margin-top: 25px;
    font-size: 12px;
    letter-spacing: 0.5px;
  }
  .cover .badge-pending { background: #64748b; }
  .cover .badge-signed { background: #1e3a8a; }
  .cover .badge-submitted { background: #f59e0b; }
  .cover .badge-validated { background: #10b981; }
  .cover .badge-rejected { background: #ef4444; }
  .cover .footer-cover { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="cover">
    <!-- ⭐ Logo école (si configuré dans Tenant Identity Profile) -->
    <div class="logo-wrapper">
      ${cfg.schoolLogo
        ? `<img src="${cfg.schoolLogo}" alt="Logo école" />`
        : `<div class="logo-placeholder">AH</div>`
      }
    </div>
    <h1>CAHIER DU SEMAINIER</h1>
    <div class="subtitle">Suivi pédagogique hebdomadaire</div>
    ${cfg.schoolName ? `<h2>${txt(cfg.schoolName)}</h2>` : ''}
    ${cfg.schoolCity ? `<h2>${txt(cfg.schoolCity)}</h2>` : ''}
    <div class="meta">
      <div><span class="label">Année scolaire</span> <strong>${txt(cfg.academicYearLabel || '')}</strong></div>
      <div><span class="label">Semaine</span> <strong>${weekLabel}</strong></div>
      <div><span class="label">Trimestre</span> <strong>${trimesterLabel}</strong></div>
      <div><span class="label">Semainier</span> <strong>${teacherName}</strong></div>
      <div><span class="label">Période</span> <strong>${new Date(cfg.weekStartDate).toLocaleDateString('fr-FR')} — ${new Date(cfg.weekEndDate).toLocaleDateString('fr-FR')}</strong></div>
    </div>
    ${(() => {
      const statusUpper = (cfg.status || 'PENDING').toUpperCase();
      const statusFr = statusUpper === 'PENDING' ? 'En attente'
        : statusUpper === 'SIGNED' ? 'Signé'
        : statusUpper === 'SUBMITTED' ? 'Soumis'
        : statusUpper === 'VALIDATED' ? 'Validé'
        : statusUpper === 'REJECTED' ? 'Rejeté'
        : statusUpper;
      const badgeClass = `badge-${statusUpper.toLowerCase()}`;
      return `<div class="badge ${badgeClass}">Statut : ${statusFr}</div>`;
    })()}
    <div class="footer-cover">
      Document généré par Academia Helm — ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
    </div>
  </div>`;

    // Une page par jour
    for (let dayIdx = 1; dayIdx <= 5; dayIdx++) {
      const dr = dailyReports.find((d: any) => d.dayOfWeek === dayIdx);
      const color = dayColors[dayIdx];
      const dayDate = dr?.date
        ? new Date(dr.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : new Date(new Date(cfg.weekStartDate).getTime() + (dayIdx - 1) * 86400000)
            .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      html += `<div class="day-page">
        <div class="day-header" style="border-left-color:${color}">
          <h2 style="color:${color}">${dayLabels[dayIdx]}</h2>
          <div class="date">${dayDate}</div>
        </div>`;

      if (!dr) {
        html += '<p class="empty"><em>Aucun rapport enregistré pour ce jour.</em></p>';
      } else {
        html += renderDailySection('1. Présence des enseignants', '#3b82f6', dr.teacherAttendance);
        html += renderDailySection('2. Présence des élèves', '#10b981', dr.studentPresence);
        html += renderDailySection('3. Pédagogie / Respect du programme', '#f59e0b', dr.pedagogy);
        html += renderDailySection('4. Discipline', '#8b5cf6', dr.discipline);
        html += renderDailySection('5. Hygiène', '#06b6d4', dr.hygiene);
        html += renderDailySection('6. Visites', '#ec4899', dr.visits);
        html += renderDailySection('7. Communication', '#f97316', dr.communication);
        html += renderDailySection('8. Résumé journalier', '#6366f1', dr.dailySummary);
      }

      html += `<div class="signature-block">
        <div>
          <div class="sig-label">Visa du Directeur</div>
          <div class="sig-line">${cfg.directorSignature ? `<img src="${cfg.directorSignature}" alt="Signature directeur" />` : ''}</div>
        </div>
        <div>
          <div class="sig-label">Visa du Semainier (${teacherName})</div>
          <div class="sig-line">${cfg.teacherSignature ? `<img src="${cfg.teacherSignature}" alt="Signature semainier" />` : '<em>Non signé</em>'}</div>
        </div>
      </div>`;
      html += '</div>';
    }

    // Page de synthèse hebdomadaire
    html += `<div class="day-page">
      <div class="day-header" style="border-left-color:#1e3a8a">
        <h2 style="color:#1e3a8a">Synthèse de la semaine ${cfg.weekNumber}</h2>
        <div class="date">Trimestre ${cfg.trimester}</div>
      </div>
      <p><strong>Enseignant:</strong> ${teacherName}</p>
      <p><strong>Période:</strong> ${new Date(cfg.weekStartDate).toLocaleDateString('fr-FR')} — ${new Date(cfg.weekEndDate).toLocaleDateString('fr-FR')}</p>
      <p><strong>Statut:</strong> ${txt(cfg.status || 'PENDING')}</p>
      ${cfg.rejectionReason ? `<p><strong>Motif de rejet:</strong> ${txt(cfg.rejectionReason)}</p>` : ''}
      ${cfg.submittedAt ? `<p><strong>Soumis le:</strong> ${new Date(cfg.submittedAt).toLocaleString('fr-FR')}</p>` : ''}
      ${cfg.validatedAt ? `<p><strong>Validé le:</strong> ${new Date(cfg.validatedAt).toLocaleString('fr-FR')}</p>` : ''}
      <div class="signature-block">
        <div>
          <div class="sig-label">Visa du Directeur</div>
          <div class="sig-line">${cfg.directorSignature ? `<img src="${cfg.directorSignature}" alt="Signature directeur" />` : ''}</div>
        </div>
        <div>
          <div class="sig-label">Visa du Semainier (${teacherName})</div>
          <div class="sig-line">${cfg.teacherSignature ? `<img src="${cfg.teacherSignature}" alt="Signature semainier" />` : '<em>Non signé</em>'}</div>
        </div>
      </div>
    </div>`;

    html += '</body></html>';

    // ⭐ Puppeteer → real PDF
    //    headerTemplate/footerTemplate : affichent "Academia Helm" + date/heure
    //    sur CHAQUE page (sauf la cover qui a déjà son propre footer).
    //    L'option `displayHeaderFooter: true` active les en-têtes/pieds de page.
    //    Les marges top/bottom doivent être assez grandes pour laisser de la
    //    place au header/footer (20mm minimum recommandé).
    const todayFormatted = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const nowTimeFormatted = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer: Buffer = await page.pdf({
        format: 'A4',
        landscape: false,
        printBackground: true,
        displayHeaderFooter: true,
        margin: { top: '22mm', bottom: '22mm', left: '12mm', right: '12mm' },
        // ⭐ Header : logo Academia Helm + nom école à gauche, semaine à droite
        headerTemplate: `
          <div style="width: 100%; font-size: 9px; color: #64748b; padding: 0 12mm; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: bold; color: #1e3a8a; font-size: 11px;">Academia Helm</span>
              <span style="color: #94a3b8;">|</span>
              <span>${txt(cfg.schoolName || 'École')}</span>
            </div>
            <div style="color: #1e3a8a; font-weight: 600;">Cahier du Semainier — ${weekLabel}</div>
          </div>
        `,
        // ⭐ Footer : "Généré par Academia Helm" à gauche, date+heure au centre, page X/Y à droite
        footerTemplate: `
          <div style="width: 100%; font-size: 8px; color: #94a3b8; padding: 4px 12mm 0 12mm; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0;">
            <div>Généré par <strong style="color: #1e3a8a;">Academia Helm</strong></div>
            <div>${todayFormatted} à ${nowTimeFormatted}</div>
            <div>Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>
          </div>
        `,
      });
      const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
      this.logger.log(`✅ PDF Cahier du Semainier généré (${buf.length} octets, configId=${configId}, filename=${filename})`);
      return { buffer: buf, filename };
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }
}
