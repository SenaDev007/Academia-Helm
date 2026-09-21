/**
 * ============================================================================
 * GRADES SERVICE - MODULE 3
 * ============================================================================
 * 
 * Gestion de la saisie des notes et des barèmes.
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère les notes pour une évaluation donnée
   */
  async findByEvaluation(evaluationId: string, tenantId: string) {
    return this.prisma.grade.findMany({
      where: { evaluationId, tenantId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: { student: { lastName: 'asc' } },
    });
  }

  /**
   * Sauvegarde massive de notes (Bulk Save)
   */
  async bulkSave(tenantId: string, academicYearId: string, evaluationId: string, grades: any[]) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, tenantId },
      include: { class: { select: { id: true, schoolLevelId: true } } },
    });

    if (!evaluation) throw new NotFoundException('Evaluation not found');

    // ⭐ V1 audit — garde-fou de statut : le verrouillage des notes n'était
    //    garanti que côté frontend (isLocked). Une fois l'évaluation SUBMITTED
    //    (en attente de validation) ou VALIDATED (verrouillée), toute écriture
    //    directe de notes doit être refusée côté serveur.
    //    (PLANNED/DRAFT/OPEN_FOR_GRADING restent bien sûr autorisés.)
    if (evaluation.status === 'SUBMITTED' || evaluation.status === 'VALIDATED') {
      throw new BadRequestException(
        `Les notes ne peuvent plus être modifiées : l'évaluation est ${evaluation.status === 'VALIDATED' ? 'validée (verrouillée)' : 'soumise à validation'}. ${
          evaluation.status === 'SUBMITTED'
            ? "Utilisez « Annuler la soumission » ou une demande de déverrouillage."
            : "Une demande de déverrouillage est nécessaire."
        }`
      );
    }

    // ⭐ Vérifier que tous les students existent avant d'upsert
    // (évite l'erreur P2003 si un studentId vient de StudentEnrollment mais
    // n'existe pas dans la table Student)
    const studentIds = grades.map((g) => g.studentId).filter(Boolean);
    const validStudents = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true },
    });
    const validStudentIds = new Set(validStudents.map((s) => s.id));

    // On utilise une transaction pour tout mettre à jour d'un coup
    return this.prisma.$transaction(
      grades
        .filter((g) => validStudentIds.has(g.studentId)) // Skip invalid students
        .map((g) => {
          // ⭐ Stocker cm/cp dans le champ comment au format JSON si présents
          let commentToStore = g.comment || '';
          if (g.cm !== undefined || g.cp !== undefined) {
            const metadata = { cm: g.cm ?? null, cp: g.cp ?? null, comment: g.comment || '' };
            commentToStore = JSON.stringify(metadata);
          }

          return this.prisma.grade.upsert({
            where: {
              tenantId_evaluationId_studentId: {
                tenantId,
                evaluationId,
                studentId: g.studentId,
              }
            },
            update: {
              score: g.score,
              qualitativeCode: g.qualitativeCode,
              isAbsent: g.isAbsent || false,
              comment: commentToStore,
              status: g.status || 'DRAFT',
              updatedAt: new Date(),
            },
            create: {
              tenantId,
              academicYearId,
              evaluationId,
              studentId: g.studentId,
              classId: evaluation.classId,
              subjectId: evaluation.subjectId,
              // ⭐ periodId du Grade référence Quarter, pas AcademicPeriod.
              // Ne pas copier evaluation.periodId car ils ne référencent
              // pas la même table — laisser null pour éviter P2003.
              periodId: null,
              schoolLevelId: evaluation.class?.schoolLevelId || null,
              score: g.score,
              qualitativeCode: g.qualitativeCode,
              isAbsent: g.isAbsent || false,
              comment: commentToStore,
              status: g.status || 'DRAFT',
            }
          });
        })
    );
  }

  /**
   * Récupère la liste des élèves pour initialiser une grille de saisie.
   *
   * ⭐ Les élèves peuvent venir de 2 sources :
   *   1. ClassStudent (relation directe classe → élève)
   *   2. StudentEnrollment (élève inscrit dans l'année avec classId optionnel)
   *
   * On fusionne les 2 sources (déduplication par studentId) pour maximiser
   * les chances d'afficher tous les élèves de la classe.
   *
   * ⭐ FIX 2026-09-12 « la liste des élèves ne s'affiche pas » :
   *   Le filtre historique n'acceptait que ACTIVE/ENROLLED/CONFIRMED/PENDING.
   *   Or le flux d'admission standard pose status=ADMITTED (et RE_ENROLLED
   *   à la réinscription) → la quasi-totalité des élèves admis étaient
   *   INVISIBLES dans la fiche de saisie dès que ClassStudent était vide.
   *   On s'aligne sur la définition « élèves de la classe » du module Élèves
   *   (students-lifecycle.service.ts) : ADMITTED, PRE_REGISTERED, ACTIVE,
   *   ENROLLED (+ RE_ENROLLED / VALIDATED / historiques par sécurité).
   *   Seuls WITHDRAWN (radié) et TRANSFERRED (sorti) sont exclus, ainsi que
   *   les élèves inactifs (Student.isActive=false — archivés/tests).
   */
  async getGradingSheet(evaluationId: string, tenantId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({
      where: { id: evaluationId, tenantId },
      include: {
        class: {
          include: {
            classStudents: {
              where: { student: { isActive: true } },
              include: { student: true },
            },
          },
        },
      },
    });

    if (!evaluation) throw new NotFoundException('Evaluation not found');

    // Source 1 : ClassStudent (relation directe) — élèves actifs uniquement
    const studentsFromClassStudents = evaluation.class?.classStudents?.map(cs => cs.student) || [];

    // Source 2 : StudentEnrollment (élèves inscrits dans cette classe pour cette année)
    let studentsFromEnrollment: any[] = [];
    try {
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          classId: evaluation.classId,
          tenantId,
          academicYearId: evaluation.academicYearId,
          status: {
            in: [
              'ACTIVE', 'ADMITTED', 'ENROLLED', 'PRE_REGISTERED',
              'RE_ENROLLED', 'VALIDATED', 'CONFIRMED', 'PENDING',
            ],
          },
          student: { isActive: true },
        },
        include: { student: true },
      });
      studentsFromEnrollment = enrollments
        .map(e => e.student)
        .filter(s => s != null);
    } catch (err) {
      console.warn('[getGradingSheet] StudentEnrollment fetch failed:', err);
    }

    // Fusionner + dédupliquer par studentId
    const studentMap = new Map<string, any>();
    [...studentsFromClassStudents, ...studentsFromEnrollment].forEach(student => {
      if (student && !studentMap.has(student.id)) {
        studentMap.set(student.id, student);
      }
    });
    const students = Array.from(studentMap.values());

    const existingGrades = await this.findByEvaluation(evaluationId, tenantId);

    return students.map(student => {
      const grade = existingGrades.find(g => g.studentId === student.id);

      // ⭐ Parser cm/cp depuis le champ comment (stocké en JSON)
      let cm: number | null = null;
      let cp: number | null = null;
      let comment = grade?.comment ?? '';
      if (comment && comment.startsWith('{') && comment.includes('"cm"')) {
        try {
          const parsed = JSON.parse(comment);
          cm = parsed.cm ?? null;
          cp = parsed.cp ?? null;
          comment = parsed.comment ?? '';
        } catch {
          // Si le JSON est invalide, garder le comment tel quel
        }
      }

      return {
        studentId: student.id,
        studentName: `${student.lastName} ${student.firstName}`.trim(),
        matricule: student.matricule ?? null,
        gender: student.gender ?? null,
        birthDate: student.dateOfBirth ?? null,   // ⭐ V10h — âge du Report Book EN
        score: grade?.score ?? null,
        cm,
        cp,
        qualitativeCode: grade?.qualitativeCode ?? null,
        isAbsent: grade?.isAbsent ?? false,
        comment,
        status: grade?.status ?? 'NEW',
      };
    });
  }

  /**
   * ⭐ FIX PERF (2026-09-21 — module Examen lent, fan-out N+1 sur HTTP) :
   *    les onglets Validation, Registre des notes, Récapitulatif et Bulletins
   *    chargeaient la grille de notes ÉVALUATION PAR ÉVALUATION (jusqu'à 30+
   *    requêtes HTTP parallèles, chacune avec 3 requêtes Prisma incluant les
   *    élèves COMPLETS). Sur réseau lent (Bénin 300-600 ms RTT) + saturation
   *    du navigateur et du Service Worker → temps de chargement > 1 minute
   *    et toasts « délai dépassé ».
   *    Cette version BATCHÉE fait exactement 3 requêtes Prisma au total, quel
   *    que soit le nombre d'évaluations, et renvoie un mapping
   *    evaluationId → grille (exactement le format de getGradingSheet).
   */
  async getGradingSheetsBatch(evaluationIds: string[], tenantId: string) {
    const ids = Array.from(new Set((evaluationIds || []).filter(Boolean)));
    if (ids.length === 0) return {};

    // 1) Les évaluations + élèves de leurs classes (source ClassStudent) — 1 requête
    const evaluations = await this.prisma.evaluation.findMany({
      where: { id: { in: ids }, tenantId },
      select: {
        id: true,
        classId: true,
        academicYearId: true,
        class: {
          select: {
            classStudents: {
              where: { student: { isActive: true } },
              select: { student: true },
            },
          },
        },
      },
    });

    const classIds = Array.from(new Set(evaluations.map((e) => e.classId)));
    // Clé de regroupement classe × année (les inscriptions sont annuelles)
    const yearsByClass = new Map<string, Set<string>>();
    for (const ev of evaluations) {
      if (!yearsByClass.has(ev.classId)) yearsByClass.set(ev.classId, new Set());
      yearsByClass.get(ev.classId)!.add(ev.academicYearId);
    }

    // 2) Les inscriptions de TOUTES les classes concernées — 1 requête
    let enrollmentRows: any[] = [];
    try {
      enrollmentRows = await this.prisma.studentEnrollment.findMany({
        where: {
          classId: { in: classIds },
          tenantId,
          status: {
            in: [
              'ACTIVE', 'ADMITTED', 'ENROLLED', 'PRE_REGISTERED',
              'RE_ENROLLED', 'VALIDATED', 'CONFIRMED', 'PENDING',
            ],
          },
          student: { isActive: true },
        },
        select: { classId: true, academicYearId: true, student: true },
      });
    } catch (err) {
      console.warn('[getGradingSheetsBatch] StudentEnrollment fetch failed:', err);
    }

    // Fusion des 2 sources par (classId × année), dédup par studentId —
    // même logique que getGradingSheet (ClassStudent d'abord, puis inscriptions).
    const studentsByClassYear = new Map<string, Map<string, any>>();
    const key = (classId: string, yearId: string) => `${classId}|${yearId}`;
    for (const ev of evaluations) {
      const k = key(ev.classId, ev.academicYearId);
      if (!studentsByClassYear.has(k)) studentsByClassYear.set(k, new Map());
      const m = studentsByClassYear.get(k)!;
      for (const cs of ev.class?.classStudents || []) {
        if (cs.student && !m.has(cs.student.id)) m.set(cs.student.id, cs.student);
      }
    }
    for (const row of enrollmentRows) {
      // Ne compter l'inscription que si son année correspond à une année
      // d'évaluation de cette classe (une inscription d'une autre année ne
      // fait pas partie de la grille).
      const years = yearsByClass.get(row.classId);
      if (!years || !years.has(row.academicYearId)) continue;
      const k = key(row.classId, row.academicYearId);
      if (!studentsByClassYear.has(k)) studentsByClassYear.set(k, new Map());
      const m = studentsByClassYear.get(k)!;
      if (row.student && !m.has(row.student.id)) m.set(row.student.id, row.student);
    }

    // 3) TOUTES les notes des évaluations demandées — 1 requête
    const allGrades = await this.prisma.grade.findMany({
      where: { evaluationId: { in: ids }, tenantId },
      select: {
        evaluationId: true,
        studentId: true,
        score: true,
        qualitativeCode: true,
        isAbsent: true,
        comment: true,
        status: true,
      },
    });
    const gradesByEval = new Map<string, any[]>();
    for (const g of allGrades) {
      if (!gradesByEval.has(g.evaluationId)) gradesByEval.set(g.evaluationId, []);
      gradesByEval.get(g.evaluationId)!.push(g);
    }

    // 4) Construire les grilles (format IDENTIQUE à getGradingSheet)
    const evalById = new Map(evaluations.map((e) => [e.id, e]));
    const result: Record<string, any[]> = {};
    for (const id of ids) {
      const ev = evalById.get(id);
      if (!ev) {
        result[id] = [];
        continue;
      }
      const students = Array.from((studentsByClassYear.get(key(ev.classId, ev.academicYearId)) || new Map()).values());
      const grades = gradesByEval.get(id) || [];
      result[id] = students.map(student => {
        const grade = grades.find(g => g.studentId === student.id);

        // ⭐ Parser cm/cp depuis le champ comment (stocké en JSON) — comme
        //    getGradingSheet.
        let cm: number | null = null;
        let cp: number | null = null;
        let comment = grade?.comment ?? '';
        if (comment && comment.startsWith('{') && comment.includes('"cm"')) {
          try {
            const parsed = JSON.parse(comment);
            cm = parsed.cm ?? null;
            cp = parsed.cp ?? null;
            comment = parsed.comment ?? '';
          } catch {
            // JSON invalide → garder le comment tel quel
          }
        }

        return {
          studentId: student.id,
          studentName: `${student.lastName} ${student.firstName}`.trim(),
          matricule: student.matricule ?? null,
          gender: student.gender ?? null,
          birthDate: student.dateOfBirth ?? null,
          score: grade?.score ?? null,
          cm,
          cp,
          qualitativeCode: grade?.qualitativeCode ?? null,
          isAbsent: grade?.isAbsent ?? false,
          comment,
          status: grade?.status ?? 'NEW',
        };
      });
    }
    return result;
  }
}
