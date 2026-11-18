/**
 * ============================================================================
 * COLLECTION PRISMA SERVICE - MODULE 4 (SOUS-MODULE RECOUVREMENT)
 * ============================================================================
 * 
 * Service pour le recouvrement des impayés
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ArrearsMirrorService } from './arrears-mirror.service';

@Injectable()
export class CollectionPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly arrearsMirror: ArrearsMirrorService,
  ) {}

  /**
   * Détecte et crée les impayés automatiquement.
   *
   * ⚠️ Stratégie multi-source (depuis la refonte multi-année) :
   *   1. Source principale : StudentAccount.balance > 0 (déclenché par trigger SQL)
   *      → crée un FeeArrear GLOBAL (sans studentFeeId) pour l'année courante
   *   2. Source secondaire : AccountBreakdown.remainingAmount > 0
   *      → crée un FeeArrear PAR FRAIS (avec studentFeeId si lié à un StudentFee)
   *   3. Source legacy : PaymentSummary (si la table est alimentée — rare)
   *
   * L'ancienne version ne lisait QUE PaymentSummary → 0 résultat si la table
   * n'était pas alimentée. Désormais on lit StudentAccount qui est TOUJOURS
   * à jour grâce au trigger SQL `update_balance_after_transaction`.
   */
  async detectArrears(tenantId: string, academicYearId: string) {
    const arrears: any[] = [];

    // ─── Stratégie : ne détecter que les VRAIS arriérés ───
    // Règle métier (confirmée par l'utilisateur) :
    //   - Année courante = année avec isActive = true (ex: 2026-2027)
    //   - Années antérieures = années avec isActive = false (ex: 2024-2025, 2025-2026)
    //   - Les années antérieures sont considérées comme clôturées
    //
    // Un vrai arriéré est :
    //   1. Un solde reporté d'une année antérieure (carriedArrears > 0 sur l'année active)
    //   2. OU un solde > 0 sur une année NON active (année antérieure)
    //
    // Pour l'année courante (active), on ne crée PAS d'arriéré automatique pour
    // le solde de l'année — un élève qui n'a pas encore payé sa scolarité 2026-2027
    // n'a pas d'arriéré, il a juste un solde à payer.

    // Vérifier l'année passée en paramètre
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      select: { id: true, name: true, isActive: true, isClosed: true, startDate: true, endDate: true },
    });

    if (!academicYear) {
      return arrears;
    }

    // ─── Source 1 : élèves avec carriedArrears > 0 sur l'année active ───
    // Ces élèves ont des arriérés d'années antérieures reportés sur l'année courante.
    if (academicYear.isActive) {
      const accountsWithCarriedArrears = await this.prisma.studentAccount.findMany({
        where: {
          tenantId,
          academicYearId,
          carriedArrears: { gt: 0 },
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // ⭐ BRIEF PERF 3.4 — Batchs (N+1 éliminés) : arriérés existants +
      // dates de dernier paiement chargés en 2 requêtes globales au lieu
      // de 2 requêtes PAR compte (findMany IN + jointure studentAccount).
      const studentIds1 = accountsWithCarriedArrears.map((acc) => acc.studentId);
      const [existingGlobalArrears, lastPaymentDates1] = await Promise.all([
        this.prisma.feeArrear.findMany({
          where: {
            studentId: { in: studentIds1 },
            academicYearId,
            tenantId,
            studentFeeId: null,
            notes: { contains: 'reporté' },
          },
        }).catch(() => []),
        this.getLastPaymentDates(studentIds1, academicYearId),
      ]);
      const existingByStudent1 = new Map<string, any>();
      for (const ea of existingGlobalArrears) existingByStudent1.set(ea.studentId, ea);

      for (const account of accountsWithCarriedArrears) {
        const carriedArrears = Number(account.carriedArrears ?? 0);

        const existing = existingByStudent1.get(account.studentId);

        const lastPaymentDate = lastPaymentDates1.get(account.studentId) ?? null;
        const arrearsLevel = this.calculateArrearsLevel(carriedArrears, lastPaymentDate);

        if (existing) {
          // ⭐ Correctif moteur de calcul (nov. 2026) : ne JAMAIS écraser un
          //    arriéré qui a un historique de paiements (totalPaid > 0) —
          //    AVANT, la re-détection remettait totalPaid à 0 et gonflait
          //    balanceDue au montant d'origine → l'argent encaissé disparaissait
          //    du recouvrement et les totaux divergeaient.
          if (Number(existing.totalPaid ?? 0) > 0) {
            continue;
          }
          await this.prisma.feeArrear.update({
            where: { id: existing.id },
            data: {
              totalDue: carriedArrears,
              totalPaid: 0,
              balanceDue: carriedArrears,
              arrearsLevel,
              lastPaymentDate,
            },
          });
          arrears.push({ ...existing, updated: true });
        } else {
          const arrear = await this.prisma.feeArrear.create({
            data: {
              tenantId,
              academicYearId,
              studentId: account.studentId,
              studentFeeId: null,
              totalDue: carriedArrears,
              totalPaid: 0,
              balanceDue: carriedArrears,
              arrearsLevel,
              lastPaymentDate,
              notes: `Arriéré reporté — ${academicYear.name} (détecté automatiquement)`,
            },
            include: { student: true },
          });
          arrears.push(arrear);
        }
      }
    }

    // ─── Source 2 : si l'année n'est PAS active (année antérieure), ───
    // tous les soldes > 0 sont des arriérés
    if (!academicYear.isActive) {
      const accountsWithBalance = await this.prisma.studentAccount.findMany({
        where: {
          tenantId,
          academicYearId,
          balance: { gt: 0 },
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // ⭐ Anti-double-comptage (bug constaté sur CSP Mon Avenir Plus N'Dali) :
      // le contrôleur détecte l'année active ET toutes les années antérieures.
      // Un solde 2025-2026 déjà REPORTÉ sur 2026-2027 (Source 1 → « Arriéré
      // reporté » sur le compte actif via carriedArrears) ne doit PAS être
      // re-créé ici en « Solde impayé » : l'agrégation actualArrears (somme de
      // TOUS les FeeArrear ouverts, toutes années) compterait le même solde
      // DEUX FOIS dans les KPIs et le « dont arriérés » des comptes élèves.
      const carriedForwardStudentIds = new Set(
        (
          await this.prisma.studentAccount.findMany({
            where: {
              tenantId,
              carriedArrears: { gt: 0 },
              academicYear: { startDate: { gt: academicYear.startDate } },
            },
            select: { studentId: true },
          })
        ).map((a) => a.studentId),
      );

      // ⭐ BRIEF PERF 3.4 — Batchs (N+1 éliminés), identiques à la source 1 :
      // arriérés existants + dates de dernier paiement en 2 requêtes globales
      // (les élèves déjà reportés sont exclus du batch — ils sont skippés).
      const studentIds2 = accountsWithBalance
        .map((acc) => acc.studentId)
        .filter((sid) => !carriedForwardStudentIds.has(sid));
      const [existingGlobalArrears2, lastPaymentDates2] = await Promise.all([
        this.prisma.feeArrear.findMany({
          where: {
            studentId: { in: studentIds2 },
            academicYearId,
            tenantId,
            studentFeeId: null,
          },
        }).catch(() => []),
        this.getLastPaymentDates(studentIds2, academicYearId),
      ]);
      const existingByStudent2 = new Map<string, any>();
      for (const ea of existingGlobalArrears2) existingByStudent2.set(ea.studentId, ea);

      for (const account of accountsWithBalance) {
        const balance = Number(account.balance ?? 0);
        if (balance <= 0) continue;

        // Solde déjà matérialisé comme « Arriéré reporté » sur une année
        // postérieure → ne pas dupliquer côté année source.
        if (carriedForwardStudentIds.has(account.studentId)) {
          continue;
        }

        const existing = existingByStudent2.get(account.studentId);

        const lastPaymentDate = lastPaymentDates2.get(account.studentId) ?? null;
        const arrearsLevel = this.calculateArrearsLevel(balance, lastPaymentDate);

        if (existing) {
          // ⭐ Correctif moteur de calcul (nov. 2026) : idem Source 1 — ne pas
          //    écraser un arriéré avec historique de paiements.
          if (Number(existing.totalPaid ?? 0) > 0) {
            continue;
          }
          await this.prisma.feeArrear.update({
            where: { id: existing.id },
            data: {
              totalDue: balance,
              // ⚠️ totalPaid = 0 : l'arriéré EST le solde restant (net des
              // paiements déjà reçus). Copier account.totalPaid (souvent >
              // totalDue, non plafonné) produisait des lignes incohérentes
              // (N'Dali : paid=60 000 pour un arriéré de 10 000).
              totalPaid: 0,
              balanceDue: balance,
              arrearsLevel,
              lastPaymentDate,
            },
          });
          arrears.push({ ...existing, updated: true });
        } else {
          const arrear = await this.prisma.feeArrear.create({
            data: {
              tenantId,
              academicYearId,
              studentId: account.studentId,
              studentFeeId: null,
              totalDue: balance,
              totalPaid: 0,
              balanceDue: balance,
              arrearsLevel,
              lastPaymentDate,
              notes: `Solde impayé — ${academicYear.name} (année antérieure, détection auto)`,
            },
            include: { student: true },
          });
          arrears.push(arrear);
        }
      }
    }

    // ─── Source 3 (legacy, non bloquant) : PaymentSummary si la table est alimentée ───
    try {
      const BATCH_SIZE = 200;
      let skip = 0;
      while (true) {
        const summaries = await this.prisma.paymentSummary.findMany({
          where: {
            tenantId,
            academicYearId,
            balance: { gt: 0 },
          },
          include: {
            studentFee: { include: { feeDefinition: { select: { id: true, label: true } } } },
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          take: BATCH_SIZE,
          skip,
        });

        if (summaries.length === 0) break;

        // ⭐ BRIEF PERF 3.4 — Batch (N+1 éliminé) : arriérés existants du
        // batch chargés en 1 requête IN (tous studentFeeId confondus, y
        // compris null — comme le findFirst d'origine), clé composite en mémoire
        const existingFeeArrears3 = await this.prisma.feeArrear.findMany({
          where: {
            studentId: { in: summaries.map((s) => s.studentId) },
            academicYearId,
            tenantId,
          },
          select: { studentId: true, studentFeeId: true },
        }).catch(() => []);
        const existingKeys3 = new Set(
          existingFeeArrears3.map((ea) => `${ea.studentId}|${ea.studentFeeId ?? 'null'}`),
        );

        for (const summary of summaries) {
          const existing = existingKeys3.has(`${summary.studentId}|${summary.studentFeeId ?? 'null'}`);

          if (existing) continue;

          const arrearsLevel = this.calculateArrearsLevel(
            Number(summary.balance),
            summary.lastPaymentDate,
          );

          const arrear = await this.prisma.feeArrear.create({
            data: {
              tenantId,
              academicYearId,
              studentId: summary.studentId,
              studentFeeId: summary.studentFeeId,
              totalDue: Number(summary.expectedAmount),
              totalPaid: Number(summary.paidAmount),
              balanceDue: Number(summary.balance),
              arrearsLevel,
              lastPaymentDate: summary.lastPaymentDate,
            },
            include: {
              student: true,
              studentFee: { include: { feeDefinition: true } },
            },
          });
          arrears.push(arrear);
        }

        skip += BATCH_SIZE;
        if (global.gc) global.gc();
      }
    } catch (err) {
      // PaymentSummary peut ne pas exister — non bloquant
    }

    // ⭐ Correctif moteur de calcul (nov. 2026) : resynchroniser les miroirs
    //    des comptes des élèves touchés par la détection (arrearsAmount /
    //    carriedArrears := Σ FeeArrear ouverts) — une seule source de vérité.
    const detectedStudentIds = [...new Set(arrears.map((a: any) => a.studentId).filter(Boolean))];
    if (detectedStudentIds.length > 0) {
      await this.arrearsMirror.syncForStudents(tenantId, detectedStudentIds);
    }

    return arrears;
  }

  /**
   * Récupère la date du dernier paiement d'un élève pour une année donnée.
   */
  private async getLastPaymentDate(studentId: string, academicYearId: string): Promise<Date | null> {
    const lastTx = await this.prisma.financeTransaction.findFirst({
      where: {
        studentAccount: { studentId, academicYearId },
        type: 'PAYMENT',
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return lastTx?.createdAt ?? null;
  }

  /**
   * ⭐ BRIEF PERF 3.4 — Batch de getLastPaymentDate (N+1 éliminé).
   *
   * 1 requête groupBy (max createdAt par studentAccount) remplace N appels
   * individuels à getLastPaymentDate (1 requête par élève).
   * `WHERE type='PAYMENT' AND "studentAccount"."academicYearId" = …`
   */
  private async getLastPaymentDates(
    studentIds: string[],
    academicYearId: string,
  ): Promise<Map<string, Date | null>> {
    const map = new Map<string, Date | null>();
    for (const id of studentIds) map.set(id, null);
    if (studentIds.length === 0) return map;

    const rows = await this.prisma.financeTransaction.findMany({
      where: {
        type: 'PAYMENT',
        studentAccount: { studentId: { in: studentIds }, academicYearId },
      },
      select: { studentAccount: { select: { studentId: true } }, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }).catch(() => []);

    // Ascending order → le dernier enregistrement vu par élève = max
    for (const row of rows) {
      const sid = (row as any).studentAccount?.studentId;
      if (sid) map.set(sid, row.createdAt);
    }
    return map;
  }

  /**
   * Calcule le niveau de gravité d'un impayé
   */
  private calculateArrearsLevel(
    balance: number,
    lastPaymentDate: Date | null
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (!lastPaymentDate) {
      return 'CRITICAL'; // Aucun paiement jamais effectué
    }

    const daysSinceLastPayment = Math.floor(
      (new Date().getTime() - new Date(lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastPayment > 30) {
      return 'CRITICAL';
    } else if (daysSinceLastPayment > 15) {
      return 'HIGH';
    } else if (daysSinceLastPayment > 7) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Récupère tous les impayés
   */
  async findAllArrears(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      arrearsLevel?: string;
      studentId?: string;
      search?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    // ⭐ Nettoyage 2026-11 (onglet Arriérés) : ne renvoyer QUE les élèves qui
    //    ont réellement des arriérés à payer — même définition de « vrai
    //    arriéré » que getCollectionStatistics et ArrearsMirrorService
    //    (source unique de vérité des miroirs du compte élève) :
    //      - status OPEN | PARTIALLY_PAID (ni PAID, ni WRITTEN_OFF, ni TRANSFERRED)
    //      - balanceDue > 0
    //    Un arriéré soldé ou abandonné ne doit PLUS figurer dans l'onglet.
    where.status = { in: ['OPEN', 'PARTIALLY_PAID'] };
    where.balanceDue = { gt: 0 };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.arrearsLevel) {
      where.arrearsLevel = filters.arrearsLevel;
    }

    if (filters?.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.student = {
        schoolLevelId: filters.schoolLevelId,
      };
    }

    if (filters?.search) {
      where.OR = [
        {
          student: {
            firstName: { contains: filters.search, mode: 'insensitive' },
          },
        },
        {
          student: {
            lastName: { contains: filters.search, mode: 'insensitive' },
          },
        },
      ];
    }

    return this.prisma.feeArrear.findMany({
      where,
      include: {
        academicYear: { select: { id: true, name: true } },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            schoolLevelId: true,
            schoolLevel: { select: { id: true, code: true, name: true } },
            studentEnrollments: {
              // Si academicYearId est fourni, filtrer par année. Sinon, prendre
              // l'inscription la plus récente (toutes années confondues).
              ...(filters?.academicYearId ? { where: { academicYearId: filters.academicYearId } } : {}),
              select: { id: true, classId: true, class: { select: { id: true, name: true } } },
              take: 1,
              orderBy: { enrollmentDate: 'desc' },
            },
          },
        },
        studentFee: {
          include: {
            feeDefinition: {
              include: {
                feeCategory: { select: { id: true, name: true } },
              },
            },
          },
        },
        reminders: {
          orderBy: { sentAt: 'desc' },
          take: 5,
        },
        // ⭐ Nettoyage 2026-11 : includes promises/actions retirés (onglets
        //    Promesses/Actions supprimés — données mortes non chargées).
      },
      orderBy: [
        { student: { lastName: 'asc' } },
        { student: { firstName: 'asc' } },
        { balanceDue: 'desc' },
      ],
      // ⭐ FIX 2026-11 (liste complète) : l'ancien take: 500 tronquait
      //    silencieusement la liste. L'onglet Arriérés pagine désormais 50
      //    lignes par page côté interface et doit recevoir la liste COMPLETE
      //    des arriérés ouverts du tenant (aucun plafond).
    });
  }

  /**
   * Enregistre un rappel de recouvrement
   */
  async createReminder(data: {
    feeArrearId: string;
    channel: string; // SMS | EMAIL | WHATSAPP | PUSH
    reminderStage: string; // J3 | J7 | J15 | J30
    message?: string;
    metadata?: any;
  }) {
    const arrear = await this.prisma.feeArrear.findFirst({
      where: { id: data.feeArrearId },
    });

    if (!arrear) {
      throw new NotFoundException(`Fee arrear with ID ${data.feeArrearId} not found`);
    }

    return this.prisma.collectionReminder.create({
      data: {
        ...data,
        status: 'SENT',
      },
      include: {
        feeArrear: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  /**
   * Liste toutes les relances (CollectionReminder) d'un tenant.
   */
  async findAllCollectionReminders(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      feeArrearId?: string;
      status?: string;
    },
  ) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.feeArrearId) where.feeArrearId = filters.feeArrearId;
    if (filters?.academicYearId) {
      where.feeArrear = { academicYearId: filters.academicYearId, tenantId };
    } else {
      where.feeArrear = { tenantId };
    }

    return this.prisma.collectionReminder.findMany({
      where,
      include: {
        feeArrear: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [
        { feeArrear: { student: { lastName: 'asc' } } },
        { feeArrear: { student: { firstName: 'asc' } } },
        { sentAt: 'desc' },
      ],
    });
  }

  /**
   * ⭐ Suppression MULTIPLE d'arriérés (correction d'erreurs de saisie en masse).
   *
   * Même sémantique que la suppression unitaire (DELETE /arrears/:id), avec
   * une cohérence renforcée :
   *   - Tout est exécuté dans UNE transaction (tout ou rien)
   *   - L'ajustement du StudentAccount est ADAPTATIF : il n'est appliqué que
   *     si le compte reflète réellement l'arriéré dans son champ arrearsAmount
   *     (écoles qui comptabilisent les arriérés dans le compte). Si le compte
   *     ne reflète pas l'arriéré (arrearsAmount=0 — affichage par agrégation
   *     FeeArrear), AUCUNE écriture sur le compte : l'affichage « dont
   *     arriérés » se recalcule automatiquement à partir des FeeArrear restants.
   *     → évite le bug de la suppression unitaire qui décrémentait totalDue
   *     d'un montant qui n'y avait jamais été ajouté (silencieusement bloqué
   *     par le trigger prevent_balance_update).
   *   - previousArrears de l'inscription décrémenté uniquement s'il est > 0.
   *   - Trace d'audit groupée dans financial_audit_logs.
   */
  async bulkDeleteArrears(tenantId: string, ids: string[], userId?: string) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('La liste des arriérés à supprimer est vide.');
    }
    if (ids.length > 500) {
      throw new BadRequestException('Maximum 500 arriérés par lot de suppression.');
    }
    // Dédupliquer les ids
    const uniqueIds = Array.from(new Set(ids));

    // Charger les arriérés du tenant (périmètre strict)
    const arrears = await this.prisma.feeArrear.findMany({
      where: { id: { in: uniqueIds }, tenantId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
        academicYear: { select: { id: true, name: true } },
      },
    });
    const foundIds = new Set(arrears.map((a) => a.id));
    const notFoundIds = uniqueIds.filter((id) => !foundIds.has(id));

    const results: Array<{
      arrearId: string;
      studentName: string;
      academicYear: string;
      balanceDue: number;
      success: boolean;
      error?: string;
    }> = [];

    const deleted: any[] = [];
    const deletedStudentIds = new Set<string>();
    let totalDeletedAmount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const arrear of arrears) {
        try {
          const balanceDue = Number(arrear.balanceDue);
          const studentName = arrear.student
            ? `${arrear.student.lastName} ${arrear.student.firstName}`.trim()
            : 'Élève';

          // ── 1. ⭐ Moteur unifié (nov. 2026) : PLUS AUCUNE écriture manuelle de
          //    totalDue/balance ici. La suppression d'un FeeArrear ne touche PAS
          //    aux totaux du compte (périmètre compte de l'élève = frais de
          //    l'année uniquement, arriérés suivis en FeeArrear) — seuls les
          //    MIROIRS d'arriérés sont resynchronisés après la transaction
          //    (cf. arrearsMirror.syncForStudent ci-dessous, depuis les
          //    FeeArrear restants — l'ancien décrément « adaptatif » des
          //    totaux datait de l'ère pré-moteur et corrompait les soldes).

          // ── 2. Ajustement previousArrears de l'inscription (si > 0) ──
          const enrollment = await tx.studentEnrollment.findFirst({
            where: {
              studentId: arrear.studentId,
              tenantId,
              academicYearId: arrear.academicYearId,
            },
            select: { id: true, previousArrears: true },
          });
          if (enrollment && Number(enrollment.previousArrears) > 0) {
            await tx.studentEnrollment.update({
              where: { id: enrollment.id },
              data: {
                previousArrears: {
                  decrement: Math.min(Number(enrollment.previousArrears), balanceDue),
                },
              },
            });
          }

          // ── 3. Supprimer les dépendances (relances, promesses, actions) ──
          await tx.collectionReminder.deleteMany({ where: { feeArrearId: arrear.id } });
          await tx.paymentPromise.deleteMany({ where: { feeArrearId: arrear.id } });
          await tx.collectionAction.deleteMany({ where: { feeArrearId: arrear.id } });

          // ── 4. Supprimer l'arriéré ──
          await tx.feeArrear.delete({ where: { id: arrear.id } });
          deletedStudentIds.add(arrear.studentId);

          deleted.push({
            arrearId: arrear.id,
            studentName,
            matricule: arrear.student?.matricule,
            academicYear: arrear.academicYear?.name || arrear.academicYearId,
            balanceDue,
          });
          totalDeletedAmount += balanceDue;
          results.push({
            arrearId: arrear.id,
            studentName,
            academicYear: arrear.academicYear?.name || arrear.academicYearId,
            balanceDue,
            success: true,
          });
        } catch (e: any) {
          results.push({
            arrearId: arrear.id,
            studentName: arrear.student
              ? `${arrear.student.lastName} ${arrear.student.firstName}`.trim()
              : arrear.id,
            academicYear: arrear.academicYear?.name || arrear.academicYearId,
            balanceDue: Number(arrear.balanceDue),
            success: false,
            error: e?.message || 'Erreur inconnue',
          });
          // Une erreur sur un arriéré fait échouer TOUTE la transaction :
          // cohérence "tout ou rien" — on remonte l'erreur.
          throw e;
        }
      }

      // ── 5. Trace d'audit groupée ──
      // performedById a une FK vers User — on ne trace que si l'utilisateur est connu.
      if (deleted.length > 0 && userId) {
        await tx.financialAuditLog.create({
          data: {
            tenantId,
            entityType: 'FeeArrear',
            entityId: `bulk-delete-${deleted.length}`,
            action: 'ARREAR_BULK_DELETE',
            oldValue: { deletedCount: deleted.length, deletedAmount: totalDeletedAmount },
            newValue: {
              items: deleted,
              requestedCount: uniqueIds.length,
              notFoundIds,
              performedVia: 'POST /finance/collection/arrears/bulk-delete',
            },
            performedById: userId || '',
          },
        });
      }
    });

    // ⭐ Moteur unifié : resynchroniser les miroirs d'arriérés des élèves
    //    concernés (Σ FeeArrear ouverts — seule source de vérité ; remplace
    //    l'ancien décrément manuel « adaptatif » des totaux du compte).
    await this.resyncArrearsMirrors(tenantId, deletedStudentIds);

    return {
      success: true,
      requested: uniqueIds.length,
      deleted: deleted.length,
      deletedAmount: totalDeletedAmount,
      notFound: notFoundIds,
      results,
    };
  }

  /**
   * ⭐ Moteur unifié (nov. 2026) : resynchronise les miroirs d'arriérés
   * (arrearsAmount / carriedArrears) d'une liste d'élèves depuis les FeeArrear
   * ouverts — via ArrearsMirrorService (seule source de vérité des arriérés).
   * Utilisé par les suppressions d'arriérés (unitaire et groupée).
   */
  async resyncArrearsMirrors(tenantId: string, studentIds: Iterable<string>): Promise<void> {
    for (const studentId of new Set(studentIds)) {
      try {
        await this.arrearsMirror.syncForStudent(tenantId, studentId);
      } catch (e: any) {
        console.warn(`Miroirs arriérés non resynchronisés pour ${studentId} (non bloquant): ${e?.message}`);
      }
    }
  }

  /**
   * Saisie manuelle d'un arriéré pour un élève (onboarding nouveaux clients).
   *
   * Permet aux écoles qui débutent avec Academia Helm en cours d'année de
   * saisir les arriérés existants (sur papier) dans le système.
   *
   * ⚠️ FLEXIBILITÉ : Si l'année scolaire n'existe pas dans la base (année
   * antérieure non créée), elle est créée automatiquement avec isAutoGenerated=true.
   * Si l'élève n'a pas d'inscription pour cette année, l'arriéré est quand
   * même enregistré (sans mise à jour de StudentEnrollment).
   *
   * Étapes :
   *   1. Résoudre/créer l'année scolaire
   *   2. Mettre à jour StudentEnrollment.previousArrears si l'inscription existe
   *   3. Mettre à jour StudentAccount.arrearsAmount si le compte existe
   *   4. Créer un FeeArrear pour visibilité dans le tableau de recouvrement
   */
  async createManualArrear(
    tenantId: string,
    data: {
      studentId: string;
      academicYearId?: string;        // ID de l'année (si déjà en base)
      academicYearName?: string;      // Nom de l'année (ex: "2024-2025") — si academicYearId absent, cherche/crée par nom
      amount: number;
      reason?: string;
    },
    userId?: string,
  ) {
    const { studentId, amount, reason } = data;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Le montant de l\'arriéré doit être positif.');
    }

    // 1. Résoudre ou créer l'année scolaire
    let academicYearId = data.academicYearId;

    if (!academicYearId && data.academicYearName) {
      // Chercher par nom pour ce tenant
      const existingYear = await this.prisma.academicYear.findFirst({
        where: { tenantId, name: data.academicYearName },
      });
      if (existingYear) {
        academicYearId = existingYear.id;
      } else {
        // Auto-créer l'année scolaire (année antérieure non enregistrée)
        // Date de début : 1er octobre de la première année (ex: 2024-2025 → 2024-10-01)
        const yearParts = data.academicYearName.match(/(\d{4})/g);
        const startYear = yearParts ? parseInt(yearParts[0], 10) : new Date().getFullYear() - 1;
        const startDate = new Date(startYear, 9, 1); // 1er octobre
        const endDate = new Date(startYear + 1, 8, 30); // 30 septembre

        const newYear = await this.prisma.academicYear.create({
          data: {
            tenantId,
            name: data.academicYearName,
            label: data.academicYearName,
            startDate,
            endDate,
            isActive: false,
            isAutoGenerated: true,
            // ⚠️ NE PAS mettre isClosed = true : un trigger SQL sur fee_arrears
            // (trg_prevent_update_if_year_closed_fee_arrears) empêche tout INSERT
            // sur fee_arrears si l'année est clôturée. L'année antérieure est juste
            // inactive (isActive = false), pas clôturée — on peut y enregistrer
            // des arriérés sans déclencher le verrou.
            isClosed: false,
            createdBy: userId,
          },
        });
        academicYearId = newYear.id;
      }
    }

    if (!academicYearId) {
      throw new BadRequestException('academicYearId ou academicYearName requis.');
    }

    // Vérifier que l'année existe
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
    });
    if (!academicYear) {
      throw new NotFoundException('Année scolaire non trouvée.');
    }

    // 2. Mettre à jour StudentEnrollment.previousArrears si l'inscription existe
    let newPreviousArrears = amount;
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId, tenantId, academicYearId },
      orderBy: { enrollmentDate: 'desc' },
    });

    if (enrollment) {
      const currentPreviousArrears = Number(enrollment.previousArrears ?? 0);
      newPreviousArrears = currentPreviousArrears + amount;
      await this.prisma.studentEnrollment.update({
        where: { id: enrollment.id },
        data: { previousArrears: newPreviousArrears },
      });
    }

    // 3. ⭐ Correctif moteur de calcul (nov. 2026) : PLUS d'incrément direct de
    //    totalDue/balance/arrearsAmount sur le compte — la saisie manuelle
    //    matérialise l'arriéré en FeeArrear (ci-dessous), l'affichage de
    //    Comptes élèves le somme au total dû, et les miroirs sont
    //    resynchronisés après création. AVANT : double comptage (FeeArrear +
    //    champs du compte incrémentés).

    // 4. Créer un FeeArrear pour visibilité dans le tableau de recouvrement
    const arrear = await this.prisma.feeArrear.create({
      data: {
        tenantId,
        academicYearId,
        studentId,
        studentFeeId: null,
        totalDue: amount,
        totalPaid: 0,
        balanceDue: amount,
        arrearsLevel: this.calculateArrearsLevel(amount, null),
        lastPaymentDate: null,
        notes: reason || `Arriéré antérieur — ${academicYear.name} (saisie manuelle)`,
      },
    });

    // ⭐ 5. Resynchroniser les miroirs du compte (moteur de calcul unifié)
    try {
      await this.arrearsMirror.syncForStudent(tenantId, studentId);
    } catch (e: any) {
      // non bloquant : les miroirs seront resynchronisés au prochain flux
    }

    return {
      success: true,
      arrearId: arrear.id,
      studentId,
      academicYearId,
      academicYearName: academicYear.name,
      amount,
      reason: reason || `Arriéré antérieur — ${academicYear.name} (saisie manuelle)`,
      newPreviousArrears,
      yearCreated: !data.academicYearId && !!data.academicYearName,
    };
  }
}

