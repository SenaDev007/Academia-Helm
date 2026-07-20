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
  // MES CLASSES
  // ===========================================================================

  /**
   * Liste les classes assignées à un enseignant pour l'année courante.
   * Inclut les effectifs (garçons/filles/total).
   */
  async getMyClasses(tenantId: string, teacherId: string, academicYearId: string) {
    // Récupérer les affectations teacher_class_assignments
    const assignments = await this.prisma.teacherClassAssignment.findMany({
      where: { tenantId, academicYearId, teacherId },
      include: {
        class: {
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
          },
        },
      },
    });

    // Grouper par classe (un enseignant peut avoir plusieurs matières dans la même classe)
    const classMap = new Map<string, any>();
    for (const a of assignments) {
      if (!a.class) continue;
      const existing = classMap.get(a.class.id);
      if (existing) {
        // Ajouter la matière à la classe existante
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
        classMap.set(a.class.id, {
          classId: a.class.id,
          className: a.class.name,
          capacity: a.class.capacity,
          schoolLevelId: a.class.schoolLevelId,
          schoolLevelName: a.class.schoolLevel?.name || '',
          schoolLevelCode: a.class.schoolLevel?.code || '',
          subjects: a.classSubject?.subject
            ? [{
                subjectId: a.classSubject.subjectId,
                subjectName: a.classSubject.subject.name,
                subjectName: a.classSubject.subject.name,
                subjectCode: a.classSubject.subject.code,
                weeklyHours: a.classSubject.weeklyHours,
                coefficient: a.classSubject.coefficient,
              }]
            : [],
        });
      }
    }

    // Pour chaque classe, calculer les effectifs
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
      return enrollments.map(e => ({
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

    for (const record of records) {
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
            schoolLevelId,
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
    return { saved: results.length, records: results };
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
    const where: any = { tenantId, academicYearId, teacherId };
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
    return this.prisma.pedagogicalWeeklyLog.findMany({
      where: { tenantId, academicYearId, teacherId },
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
    // HomeworkEntry n'a pas de teacherId direct, on filtre via les classes assignées
    const assignedClassIds = await this.prisma.teacherClassAssignment.findMany({
      where: { tenantId, academicYearId, teacherId },
      select: { classId: true },
    });
    const classIds = assignedClassIds.map(a => a.classId).filter(Boolean);

    const where: any = {
      tenantId,
      academicYearId,
      classId: classId ? classId : { in: classIds },
    };

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
}
