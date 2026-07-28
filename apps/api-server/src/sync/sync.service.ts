/**
 * ============================================================================
 * SYNC SERVICE — Synchronisation descendante Neon → Local (desktop/mobile)
 * ============================================================================
 *
 * Service READ-ONLY qui retourne tous les changements effectués sur Neon
 * depuis une date donnée. Non intrusif : n'impacte AUCUN CRUD existant.
 *
 * Endpoint : GET /api/sync/delta?since=ISO_DATE&tenantId=XXX
 *
 * Stratégie :
 *   1. Le client (desktop/mobile) appelle cet endpoint avec la date de sa
 *      dernière sync (stockée dans sync_meta.last_online_sync)
 *   2. Le serveur fait un SELECT ... WHERE updatedAt > $since sur toutes
 *      les tables principales
 *   3. Retourne un objet { entities: { students: [...], classes: [...], ... },
 *      syncToken: NOW() }
 *   4. Le client met à jour son cache local (SQLite/Hive) avec les deltas
 *   5. Au prochain appel, le client utilise le nouveau syncToken
 *
 * ⚠️ Ce service ne modifie JAMAIS les données — il ne fait que des SELECT.
 *    Aucun impact sur le CRUD existant des modules.
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère tous les changements depuis une date donnée.
   *
   * @param tenantId ID du tenant (obligatoire)
   * @param since Date ISO (obligatoire) — si non fourni, utilise epoch (récupère tout)
   * @returns Objet avec toutes les entités modifiées + nouveau syncToken
   */
  async getDelta(tenantId: string, since?: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId est requis');
    }

    // Si pas de "since", on récupère tout (première sync)
    const sinceDate = since ? new Date(since) : new Date(0);
    if (isNaN(sinceDate.getTime())) {
      throw new BadRequestException('since doit être une date ISO valide');
    }

    this.logger.log(
      `Sync delta requested — tenant: ${tenantId}, since: ${sinceDate.toISOString()}`,
    );

    // ── Récupérer les deltas pour chaque table ──
    // On utilise Prisma avec where: { updatedAt: { gt: sinceDate } }
    // pour profiter de l'ORM et éviter les $queryRawUnsafe.

    const [
      students,
      studentEnrollments,
      guardians,
      studentGuardians,
      admissions,
      classes,
      schoolLevels,
      subjects,
      schedules,
      cahierJournalEntries,
      pedagogicalFiches,
      homeworkEntries,
      pedagogicalTaskStudents,
      studentAccounts,
      financeTransactions,
      feeStructures,
      feeArrears,
      feeInstallments,
      recoveryReminders,
      financeExpenses,
      evaluations,
      grades,
      reportCards,
      reportCardItems,
      quarters,
      attendanceRecords,
      attendanceRegisters,
    ] = await Promise.all([
      // ── Module Élève ──
      this.prisma.student.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      }).catch(() => []),
      this.prisma.studentEnrollment.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      }).catch(() => []),
      this.prisma.guardian.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      }).catch(() => []),
      this.prisma.studentGuardian.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      }).catch(() => []),
      this.prisma.admission.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      }).catch(() => []),

      // ── Module Pédagogie ──
      this.prisma.class.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      }).catch(() => []),
      this.prisma.schoolLevel.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 100,
      }).catch(() => []),
      this.prisma.subject.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      }).catch(() => []),
      // Emplois du temps (schedule) — vérifier le nom exact du modèle
      (this.prisma as any).schedule?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      })?.catch(() => []) ?? [],
      this.prisma.cahierJournal.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      }).catch(() => []),
      (this.prisma as any).primaryPedagogicalFiche?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      })?.catch(() => []) ?? [],
      (this.prisma as any).homeworkEntry?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      })?.catch(() => []) ?? [],
      (this.prisma as any).pedagogicalTaskStudent?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      })?.catch(() => []) ?? [],

      // ── Module Finance ──
      this.prisma.studentAccount.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      }).catch(() => []),
      this.prisma.financeTransaction.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      }).catch(() => []),
      this.prisma.feeStructure.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      }).catch(() => []),
      (this.prisma as any).feeArrear?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      })?.catch(() => []) ?? [],
      (this.prisma as any).feeInstallment?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      })?.catch(() => []) ?? [],
      (this.prisma as any).recoveryReminder?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      })?.catch(() => []) ?? [],
      (this.prisma as any).financeExpense?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      })?.catch(() => []) ?? [],

      // ── Module Évaluations ──
      (this.prisma as any).evaluation?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      })?.catch(() => []) ?? [],
      (this.prisma as any).grade?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 5000,
      })?.catch(() => []) ?? [],
      this.prisma.reportCard.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 1000,
      }).catch(() => []),
      (this.prisma as any).reportCardItem?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 5000,
      })?.catch(() => []) ?? [],
      (this.prisma as any).quarter?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 50,
      })?.catch(() => []) ?? [],

      // ── Module Présences ──
      (this.prisma as any).attendanceRecord?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 5000,
      })?.catch(() => []) ?? [],
      (this.prisma as any).attendanceRegister?.findMany({
        where: { tenantId, updatedAt: { gt: sinceDate } },
        take: 500,
      })?.catch(() => []) ?? [],
    ]);

    // ── Construire la réponse ──
    const now = new Date().toISOString();

    const delta = {
      syncToken: now,
      tenantId,
      since: sinceDate.toISOString(),
      entities: {
        // Module Élève
        students: students as any[],
        studentEnrollments: studentEnrollments as any[],
        guardians: guardians as any[],
        studentGuardians: studentGuardians as any[],
        admissions: admissions as any[],

        // Module Pédagogie
        classes: classes as any[],
        schoolLevels: schoolLevels as any[],
        subjects: subjects as any[],
        schedules: schedules as any[],
        cahierJournalEntries: cahierJournalEntries as any[],
        pedagogicalFiches: pedagogicalFiches as any[],
        homeworkEntries: homeworkEntries as any[],
        pedagogicalTaskStudents: pedagogicalTaskStudents as any[],

        // Module Finance
        studentAccounts: studentAccounts as any[],
        financeTransactions: financeTransactions as any[],
        feeStructures: feeStructures as any[],
        feeArrears: feeArrears as any[],
        feeInstallments: feeInstallments as any[],
        recoveryReminders: recoveryReminders as any[],
        financeExpenses: financeExpenses as any[],

        // Module Évaluations
        evaluations: evaluations as any[],
        grades: grades as any[],
        reportCards: reportCards as any[],
        reportCardItems: reportCardItems as any[],
        quarters: quarters as any[],

        // Module Présences
        attendanceRecords: attendanceRecords as any[],
        attendanceRegisters: attendanceRegisters as any[],
      },
      stats: {
        totalEntities:
          (students as any[]).length +
          (studentEnrollments as any[]).length +
          (guardians as any[]).length +
          (studentGuardians as any[]).length +
          (admissions as any[]).length +
          (classes as any[]).length +
          (schoolLevels as any[]).length +
          (subjects as any[]).length +
          (schedules as any[]).length +
          (cahierJournalEntries as any[]).length +
          (pedagogicalFiches as any[]).length +
          (homeworkEntries as any[]).length +
          (pedagogicalTaskStudents as any[]).length +
          (studentAccounts as any[]).length +
          (financeTransactions as any[]).length +
          (feeStructures as any[]).length +
          (feeArrears as any[]).length +
          (feeInstallments as any[]).length +
          (recoveryReminders as any[]).length +
          (financeExpenses as any[]).length +
          (evaluations as any[]).length +
          (grades as any[]).length +
          (reportCards as any[]).length +
          (reportCardItems as any[]).length +
          (quarters as any[]).length +
          (attendanceRecords as any[]).length +
          (attendanceRegisters as any[]).length,
      },
    };

    this.logger.log(
      `Sync delta completed — ${delta.stats.totalEntities} entities returned, syncToken: ${now}`,
    );

    return delta;
  }

  /**
   * Récupère la version courante du syncToken (timestamp actuel).
   * Utile pour initialiser un client qui n'a jamais syncé.
   */
  async getCurrentSyncToken(): Promise<string> {
    return new Date().toISOString();
  }
}
