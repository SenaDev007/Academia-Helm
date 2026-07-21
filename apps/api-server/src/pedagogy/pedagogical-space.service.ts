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

@Injectable()
export class PedagogicalSpaceService {
  private readonly logger = new Logger(PedagogicalSpaceService.name);

  constructor(private readonly prisma: PrismaService) {}

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
  ): Promise<{ teacherId: string | null; userRole: string | null }> {
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
  ): Promise<
    | { mode: 'teacher'; teacherId: string }
    | { mode: 'all' }
    | { mode: 'none' }
  > {
    const { teacherId, userRole } = await this.resolveTeacherId(tenantId, rawTeacherId);
    if (teacherId) return { mode: 'teacher', teacherId };
    if (userRole && PedagogicalSpaceService.DIRECTION_ROLES.has(userRole)) {
      return { mode: 'all' };
    }
    return { mode: 'none' };
  }

  /**
   * Rôles "direction" qui peuvent voir TOUTES les classes de l'école
   * dans l'Espace Pédagogique (vue superviseur/directeur).
   * Utilisé quand resolveTeacherId ne trouve pas de Teacher lié au User.
   */
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
  async getMyClasses(tenantId: string, teacherId: string, academicYearId: string) {
    // ⭐ Résoudre l'ID du Teacher (le frontend passe user.id, pas teacher.id)
    const { teacherId: resolvedTeacherId, userRole } = await this.resolveTeacherId(
      tenantId,
      teacherId,
    );

    // ⭐ TEMPORAIRE (TEST PROMOTEUR/DIRECTION) :
    // Si l'utilisateur n'a PAS de profil Teacher mais possède un rôle
    // "direction" (PROMOTER, SCHOOL_OWNER, DIRECTEUR_*, ADMIN, etc.),
    // on renvoie TOUTES les classes du tenant/année pour lui permettre
    // de tester/valider l'Espace Pédagogique.
    // ⚠️ À remettre en mode "restreint" une fois les tests terminés :
    //    il suffit de commenter le bloc `if (!resolvedTeacherId && ...)` ci-dessous.
    if (!resolvedTeacherId && userRole && PedagogicalSpaceService.DIRECTION_ROLES.has(userRole)) {
      this.logger.log(
        `[getMyClasses] Aucun profil Teacher pour user.role=${userRole} — renvoi de TOUTES les classes du tenant (mode test direction)`,
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
            subject: { select: { id: true, name: true, code: true } },
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
    const dateObj = new Date(date);
    const records = await this.prisma.attendanceRecord.findMany({
      where: { tenantId, classId, date: dateObj },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, gender: true, matricule: true, photoUrl: true },
        },
      },
    });

    // Si pas d'enregistrements, retourner la liste des élèves avec statut par défaut
    if (records.length === 0) {
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
      return enrollments
        .filter(e => e.student?.id) // ⭐ Filtrer les inscriptions orphelines
        .map(e => ({
          studentId: e.student?.id,
          firstName: e.student?.firstName,
          lastName: e.student?.lastName,
          gender: e.student?.gender,
          matricule: e.student?.matricule,
          photoUrl: e.student?.photoUrl,
          status: 'PRESENT', // par défaut
          attendanceId: null,
        }));
    }

    return records.map(r => ({
      studentId: r.student?.id,
      firstName: r.student?.firstName,
      lastName: r.student?.lastName,
      gender: r.student?.gender,
      matricule: r.student?.matricule,
      photoUrl: r.student?.photoUrl,
      status: r.status,
      attendanceId: r.id,
      notes: r.notes,
    }));
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
    records: { studentId: string; status: string; notes?: string }[],
    recordedBy: string,
  ) {
    const dateObj = new Date(date);
    const results = [];

    // ⭐ Si schoolLevelId est vide ou invalide (par exemple quand "Tous les
    // niveaux" est sélectionné côté frontend), on le résout depuis la classe.
    // Évite l'erreur FK violation sur attendance_records_schoolLevelId_fkey.
    let resolvedSchoolLevelId = schoolLevelId;
    if (!resolvedSchoolLevelId || resolvedSchoolLevelId.trim() === '') {
      const cls = await this.prisma.class.findFirst({
        where: { id: classId, tenantId },
        select: { schoolLevelId: true },
      });
      if (cls?.schoolLevelId) {
        resolvedSchoolLevelId = cls.schoolLevelId;
      } else {
        // Dernier recours : chercher via AcademicClass (cas où classId est
        // en réalité un AcademicClass.id)
        const ac = await this.prisma.academicClass.findFirst({
          where: { id: classId, tenantId },
          select: { schoolLevelId: true },
        });
        resolvedSchoolLevelId = ac?.schoolLevelId || '';
      }
      if (!resolvedSchoolLevelId) {
        throw new BadRequestException(
          `Impossible de résoudre le niveau scolaire pour la classe ${classId}. Sélectionnez un niveau scolaire dans le menu global.`,
        );
      }
    }

    for (const record of records) {
      // ⭐ Skip les records invalides (studentId null/undefined) pour éviter
      // l'erreur P2003 "référence invalide" (Foreign key constraint).
      if (!record.studentId || typeof record.studentId !== 'string') {
        this.logger.warn(
          `[saveDailyAttendance] Record ignoré : studentId invalide (null/undefined)`,
        );
        continue;
      }
      // Vérifier si un enregistrement existe déjà
      const existing = await this.prisma.attendanceRecord.findFirst({
        where: { tenantId, classId, studentId: record.studentId, date: dateObj },
      });

      if (existing) {
        // Mettre à jour
        const updated = await this.prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status: record.status,
            notes: record.notes || null,
            recordedBy,
          },
        });
        results.push(updated);
      } else {
        // Créer
        const created = await this.prisma.attendanceRecord.create({
          data: {
            tenantId,
            academicYearId,
            schoolLevelId: resolvedSchoolLevelId,
            classId,
            studentId: record.studentId,
            date: dateObj,
            status: record.status,
            notes: record.notes || null,
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

    // Si studentsData est vide, initialiser depuis les inscriptions
    if (studentsData.length === 0) {
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
    }

    // ⭐ 6. Reconstruire les absences pour chaque élève à partir de tous les
    // AttendanceRecord du mois. On groupe par studentId puis on mappe chaque
    // record vers (weekInMonth, dayInWeek) en utilisant dateToCell.
    const recordsByStudent = new Map<string, typeof allRecords>();
    for (const r of allRecords) {
      const arr = recordsByStudent.get(r.studentId) || [];
      arr.push(r);
      recordsByStudent.set(r.studentId, arr);
    }

    for (const student of studentsData) {
      const studentRecords = recordsByStudent.get(student.studentId) || [];
      const newAbsences: any[] = [];

      for (const r of studentRecords) {
        const dateStr = r.date.toISOString().split('T')[0];
        const cell = dateToCell.get(dateStr);
        if (!cell) continue; // record hors lundi-vendredi ou hors mois → skip

        // Mapper le status à un "marked" du registre
        // PRESENT → "" (pas d'absence marquée — case vide)
        // ABSENT → "A"
        // LATE → "R" (retard)
        // autres → "E" (excusé)
        let marked = '';
        if (r.status === 'ABSENT') marked = 'A';
        else if (r.status === 'LATE') marked = 'R';
        else if (r.status === 'EXCUSED') marked = 'E';
        // PRESENT → "" (présent, pas de marqueur)

        if (marked) {
          newAbsences.push({
            week: cell.weekInMonth,
            day: cell.dayInWeek,
            marked,
          });
        }
      }

      // Recalculer les totaux
      const totalAbsences = newAbsences.filter(a => a.marked === 'A' || a.marked === 'E').length;
      const totalRetards = newAbsences.filter(a => a.marked === 'R').length;
      // nbDemiJournees = nombre de jours où l'appel a été fait pour CET élève
      // (= nombre de records pour cet élève ce mois-ci)
      const nbDemiJournees = studentRecords.length;
      const totalPresencesPossibles = nbDemiJournees;
      const totalPresenceEffectif = totalPresencesPossibles - totalAbsences;

      student.absences = newAbsences;
      student.totalAbsences = totalAbsences;
      student.totalPresencesPossibles = totalPresencesPossibles;
      student.totalPresenceEffectif = totalPresenceEffectif;
      student.nbDemiJournees = nbDemiJournees;
      student.observation = totalRetards > 0 ? `${totalRetards} retard(s)` : (student.observation || '');
    }

    // ⭐ 7. Recalculer les totaux globaux du mois
    const totalAbs = studentsData.reduce((sum, s) => sum + (s.totalAbsences || 0), 0);
    const totalPoss = studentsData.reduce((sum, s) => sum + (s.totalPresencesPossibles || 0), 0);
    const totalEff = studentsData.reduce((sum, s) => sum + (s.totalPresenceEffectif || 0), 0);
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
  ) {
    // ⭐ TEST PROMOTEUR/DIRECTION : si l'utilisateur n'a pas de profil Teacher
    // mais a un rôle direction, on ne filtre PAS par teacherId (vue superviseur).
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
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
      taskType?: string; // EXERCISE | HOMEWORK | RESEARCH | EXPOSE | LESSON | RECITATION | READING | PRACTICAL | PROJECT
    },
  ) {
    // Créer le HomeworkEntry
    const homework = await this.prisma.homeworkEntry.create({
      data: {
        tenantId,
        academicYearId,
        schoolLevelId,
        classId: data.classId,
        subjectId: data.subjectId || null,
        title: data.title,
        description: data.description,
        dueDate: new Date(data.dueDate),
        maxScore: data.maxScore || null,
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
          teacherId,
          status: 'PENDING',
        })),
      });
    }

    this.logger.log(`✅ Devoir créé: ${homework.title} — ${enrollments.length} élèves initialisés`);

    return {
      ...homework,
      studentCount: enrollments.length,
    };
  }

  /**
   * Liste les devoirs d'un enseignant.
   */
  async getHomeworks(
    tenantId: string,
    academicYearId: string,
    teacherId: string,
    classId?: string,
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
    const tasks = await this.prisma.pedagogicalTaskStudent.findMany({
      where: { tenantId, homeworkEntryId },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, gender: true, matricule: true, photoUrl: true },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    return tasks;
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

    // Vérifier si une entrée existe
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries"
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classId" = $3 AND "weekStartDate" = $4
       LIMIT 1`,
      tenantId, academicYearId, classId, startDate,
    );

    if (existing && existing.length > 0) {
      return existing[0];
    }

    // Créer une nouvelle entrée
    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "cahier_journal_entries"
       ("id", "tenantId", "academicYearId", "teacherId", "classId",
        "weekStartDate", "weekEndDate", "className", "entries", "observations",
        "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, 'DRAFT', NOW(), NOW())`,
      id, tenantId, academicYearId, teacherId, classId,
      startDate, endDate, className || null, JSON.stringify({}),
    );

    const created: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries" WHERE "id" = $1`,
      id,
    );
    return created[0];
  }

  /// Liste les cahiers journal d'un enseignant.
  async getCahierJournals(
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
          `SELECT * FROM "cahier_journal_entries"
           WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "teacherId" = $3 AND "classId" = $4
           ORDER BY "weekStartDate" DESC`,
          tenantId, academicYearId, filter.teacherId, classId,
        );
      }
      // Mode direction : pas de filtre teacherId
      return this.prisma.$queryRawUnsafe(
        `SELECT * FROM "cahier_journal_entries"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classId" = $3
         ORDER BY "weekStartDate" DESC`,
        tenantId, academicYearId, classId,
      );
    }
    if (filter.mode === 'teacher') {
      return this.prisma.$queryRawUnsafe(
        `SELECT * FROM "cahier_journal_entries"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "teacherId" = $3
         ORDER BY "weekStartDate" DESC`,
        tenantId, academicYearId, filter.teacherId,
      );
    }
    // Mode direction : toutes les entrées du tenant/année
    return this.prisma.$queryRawUnsafe(
      `SELECT * FROM "cahier_journal_entries"
       WHERE "tenantId" = $1 AND "academicYearId" = $2
       ORDER BY "weekStartDate" DESC`,
      tenantId, academicYearId,
    );
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
  // FICHES PÉDAGOGIQUES PRIMAIRE (5 types: MATH/FRANCAIS/EST/ES/EA)
  // ===========================================================================

  /// Liste les fiches pédagogiques d'un enseignant.
  async getPedagogicalFiches(
    tenantId: string,
    teacherId: string,
    academicYearId: string,
    sheetType?: string,
    classId?: string,
  ) {
    // ⭐ TEST PROMOTEUR/DIRECTION : vue superviseur si rôle direction sans profil Teacher
    const filter = await this.resolveTeacherFilter(tenantId, teacherId);
    if (filter.mode === 'none') return [];

    // Construction dynamique de la requête selon le mode
    let query: string;
    const params: any[] = [];

    if (filter.mode === 'teacher') {
      query = `SELECT * FROM "primary_pedagogical_fiches"
               WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "teacherId" = $3`;
      params.push(tenantId, academicYearId, filter.teacherId);
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
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined && data[key] !== null) {
        fields.push(`"${col}"`);
        if (key === 'deroulement') {
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

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "primary_pedagogical_fiches" (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
      ...params,
    );

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
      status: 'string', submittedAt: 'date', validatedAt: 'date',
      validatedBy: 'string', rejectionReason: 'string',
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

    await this.prisma.$executeRawUnsafe(
      `UPDATE "primary_pedagogical_fiches" SET ${updates.join(', ')} WHERE "id" = $${lastIdx} AND "tenantId" = $${lastIdx + 1}`,
      ...params,
    );

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

  /// Récupère tous les cahiers journal soumis (en attente de validation direction).
  async getPendingCahierJournals(tenantId: string, academicYearId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT cj.*, c."name" as "classNameResolved", t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "cahier_journal_entries" cj
       LEFT JOIN "classes" c ON c."id" = cj."classId"
       LEFT JOIN "teachers" t ON t."id" = cj."teacherId"
       WHERE cj."tenantId" = $1 AND cj."academicYearId" = $2 AND cj."status" = 'SUBMITTED'
       ORDER BY cj."submittedAt" DESC`,
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

  /// Récupère toutes les fiches pédagogiques soumises (en attente de validation).
  async getPendingPedagogicalFiches(tenantId: string, academicYearId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT pf.*, c."name" as "classNameResolved", t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "primary_pedagogical_fiches" pf
       LEFT JOIN "classes" c ON c."id" = pf."classId"
       LEFT JOIN "teachers" t ON t."id" = pf."teacherId"
       WHERE pf."tenantId" = $1 AND pf."academicYearId" = $2 AND pf."status" = 'SUBMITTED'
       ORDER BY pf."submittedAt" DESC`,
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

  /// Récupère tous les registres d'appel soumis (en attente de validation).
  async getPendingAttendanceRegisters(tenantId: string, academicYearId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT ar.*, c."name" as "classNameResolved", t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "attendance_registers" ar
       LEFT JOIN "classes" c ON c."id" = ar."classId"
       LEFT JOIN "teachers" t ON t."id" = ar."teacherId"
       WHERE ar."tenantId" = $1 AND ar."academicYearId" = $2 AND ar."status" = 'SUBMITTED'
       ORDER BY ar."submittedAt" DESC`,
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

  /// Récupère toutes les évaluations mensuelles soumises (en attente de validation).
  async getPendingMonthlyEvaluations(tenantId: string, academicYearId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT me.*, c."name" as "classNameResolved",
              ar."month" as "registerMonth", ar."year" as "registerYear"
       FROM "monthly_evaluations" me
       LEFT JOIN "attendance_registers" ar ON ar."id" = me."attendanceRegisterId"
       LEFT JOIN "classes" c ON c."id" = me."classId"
       WHERE me."tenantId" = $1 AND me."academicYearId" = $2 AND me."status" = 'SUBMITTED'
       ORDER BY me."submittedAt" DESC`,
      tenantId, academicYearId,
    );
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
    const [
      pendingCahierJournals,
      pendingFiches,
      pendingRegisters,
      pendingEvaluations,
      pendingWeeklyLogs,
      pendingWeeklySummaries,
      pendingCahierTests,
    ] = await Promise.all([
      this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "cahier_journal_entries"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'SUBMITTED'`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count, "sheetType" FROM "primary_pedagogical_fiches"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'SUBMITTED'
         GROUP BY "sheetType"`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "attendance_registers"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'SUBMITTED'`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "monthly_evaluations"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'SUBMITTED'`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "pedagogical_weekly_logs"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'SUBMITTED'`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "weekly_log_summaries"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'SUBMITTED'`,
        tenantId, academicYearId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as count FROM "cahier_de_textes"
         WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'SUBMITTED'`,
        tenantId, academicYearId,
      ),
    ]);

    const cahierCount = pendingCahierJournals[0]?.count || 0;
    const fichesByType = (pendingFiches as any[]).reduce((acc, row) => {
      acc[row.sheetType] = row.count;
      return acc;
    }, {} as Record<string, number>);
    const fichesCount = Object.values(fichesByType).reduce((s, c) => s + (c as number), 0);
    const registersCount = pendingRegisters[0]?.count || 0;
    const evaluationsCount = pendingEvaluations[0]?.count || 0;
    const weeklyLogsCount = pendingWeeklyLogs[0]?.count || 0;
    const weeklySummariesCount = pendingWeeklySummaries[0]?.count || 0;
    const cahierTestsCount = pendingCahierTests[0]?.count || 0;

    return {
      pendingCahierJournals: cahierCount,
      pendingFiches: fichesCount,
      pendingFichesByType: fichesByType,
      pendingAttendanceRegisters: registersCount,
      pendingMonthlyEvaluations: evaluationsCount,
      pendingWeeklyLogs: weeklyLogsCount,
      pendingWeeklySummaries: weeklySummariesCount,
      pendingCahierTests: cahierTestsCount,
      totalPending: cahierCount + fichesCount + registersCount + evaluationsCount + weeklyLogsCount + weeklySummariesCount + cahierTestsCount,
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
    if (teacherId) {
      const { teacherId: resolvedTid } = await this.resolveTeacherId(tenantId, teacherId);
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
    // Si on n'a pas pu résoudre les langues de l'enseignant, on ne filtre pas
    // (fail-open : on affiche toutes les matières).
    const langFilterActive = teacherLanguages.length > 0;

    // ─── Étape 1 : résoudre l'AcademicClass.id (officiel) depuis le classId
    // passé par le frontend. Le frontend peut passer soit un physical class ID
    // (table `classes`), soit directement un AcademicClass ID.
    let academicClassId: string | null = null;
    let physicalClassId: string | null = null;

    // Vérifier si classId est une classe physique (table classes)
    const physicalClass: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, "officialClassId" FROM "classes" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
      classId, tenantId,
    );
    if (physicalClass && physicalClass.length > 0) {
      physicalClassId = physicalClass[0].id;
      academicClassId = physicalClass[0].officialClassId || null;
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

    // ─── Étape 2 : chercher les matières via academicClassId (source principale)
    // C'est le cas normal : les class_subjects sont rattachés à l'AcademicClass.
    if (academicClassId) {
      let subjects: any;
      if (langFilterActive) {
        // ⭐ Filtre par piste linguistique de l'enseignant (FR ou EN)
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
      if (langFilterActive) {
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
      if (langFilterActive) {
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
    if (langFilterActive) {
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
    const evalResult: any = await this.prisma.$queryRawUnsafe(
      `SELECT me.*, c."name" as "classNameResolved",
              ar."month" as "registerMonth", ar."year" as "registerYear",
              ar."id" as "registerId", ar."teacherId" as "registerTeacherId",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
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
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT cj.*, c."name" as "classNameResolved",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "cahier_journal_entries" cj
       LEFT JOIN "classes" c ON c."id" = cj."classId"
       LEFT JOIN "teachers" t ON t."id" = cj."teacherId"
       WHERE cj."id" = $1 AND cj."tenantId" = $2`,
      journalId, tenantId,
    );
    if (!result || result.length === 0) {
      throw new NotFoundException('Cahier journal non trouvé');
    }
    return result[0];
  }

  /// Récupère le détail d'une fiche pédagogique (vue direction).
  async getPedagogicalFicheDetail(tenantId: string, ficheId: string) {
    const result: any = await this.prisma.$queryRawUnsafe(
      `SELECT pf.*, c."name" as "classNameResolved",
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "primary_pedagogical_fiches" pf
       LEFT JOIN "classes" c ON c."id" = pf."classId"
       LEFT JOIN "teachers" t ON t."id" = pf."teacherId"
       WHERE pf."id" = $1 AND pf."tenantId" = $2`,
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
              t."firstName" as "teacherFirstName", t."lastName" as "teacherLastName"
       FROM "attendance_registers" ar
       LEFT JOIN "classes" c ON c."id" = ar."classId"
       LEFT JOIN "teachers" t ON t."id" = ar."teacherId"
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
      query = `SELECT ct.*, c."name" as "classNameResolved", s."name" as "subjectName", s."code" as "subjectCode"
               FROM "cahier_de_textes" ct
               LEFT JOIN "classes" c ON c."id" = ct."classId"
               LEFT JOIN "subjects" s ON s."id" = ct."subjectId"
               WHERE ct."tenantId" = $1 AND ct."academicYearId" = $2 AND ct."teacherId" = $3`;
      params.push(tenantId, academicYearId, filter.teacherId);
    } else {
      // Mode direction : toutes les entrées du tenant/année
      query = `SELECT ct.*, c."name" as "classNameResolved", s."name" as "subjectName", s."code" as "subjectCode"
               FROM "cahier_de_textes" ct
               LEFT JOIN "classes" c ON c."id" = ct."classId"
               LEFT JOIN "subjects" s ON s."id" = ct."subjectId"
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
      id, tenantId, academicYearId, teacherId,
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
}
