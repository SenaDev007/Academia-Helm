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

@Injectable()
export class CollectionPrismaService {
  constructor(private readonly prisma: PrismaService) {}

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
      select: { id: true, name: true, isActive: true, isClosed: true, endDate: true },
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

      for (const account of accountsWithCarriedArrears) {
        const carriedArrears = Number(account.carriedArrears ?? 0);

        // Vérifier si un FeeArrear GLOBAL existe déjà pour cet élève/année
        const existing = await this.prisma.feeArrear.findFirst({
          where: {
            studentId: account.studentId,
            academicYearId,
            tenantId,
            studentFeeId: null,
            notes: { contains: 'reporté' },
          },
        });

        const lastPaymentDate = await this.getLastPaymentDate(account.studentId, academicYearId);
        const arrearsLevel = this.calculateArrearsLevel(carriedArrears, lastPaymentDate);

        if (existing) {
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

      for (const account of accountsWithBalance) {
        const balance = Number(account.balance ?? 0);
        if (balance <= 0) continue;

        // Vérifier si un FeeArrear GLOBAL existe déjà
        const existing = await this.prisma.feeArrear.findFirst({
          where: {
            studentId: account.studentId,
            academicYearId,
            tenantId,
            studentFeeId: null,
          },
        });

        const lastPaymentDate = await this.getLastPaymentDate(account.studentId, academicYearId);
        const arrearsLevel = this.calculateArrearsLevel(balance, lastPaymentDate);

        if (existing) {
          await this.prisma.feeArrear.update({
            where: { id: existing.id },
            data: {
              totalDue: balance,
              totalPaid: Number(account.totalPaid ?? 0),
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
              totalPaid: Number(account.totalPaid ?? 0),
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

        for (const summary of summaries) {
          const existing = await this.prisma.feeArrear.findFirst({
            where: {
              studentId: summary.studentId,
              studentFeeId: summary.studentFeeId,
              academicYearId,
              tenantId,
            },
          });

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
        promises: {
          where: {
            status: 'PENDING',
          },
          orderBy: { promisedDate: 'asc' },
        },
        actions: {
          orderBy: { performedAt: 'desc' },
          take: 10,
        },
      },
      orderBy: [
        { student: { lastName: 'asc' } },
        { student: { firstName: 'asc' } },
        { balanceDue: 'desc' },
      ],
      take: 500,
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
   * Enregistre une promesse de paiement
   */
  async createPaymentPromise(data: {
    feeArrearId: string;
    promisedAmount: number;
    promisedDate: Date;
    notes?: string;
    createdBy?: string;
  }) {
    const arrear = await this.prisma.feeArrear.findFirst({
      where: { id: data.feeArrearId },
    });

    if (!arrear) {
      throw new NotFoundException(`Fee arrear with ID ${data.feeArrearId} not found`);
    }

    if (data.promisedAmount > Number(arrear.balanceDue)) {
      throw new BadRequestException(
        'Promised amount cannot exceed the balance due'
      );
    }

    return this.prisma.paymentPromise.create({
      data,
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
   * Enregistre une action de recouvrement
   */
  async createCollectionAction(data: {
    feeArrearId: string;
    actionType: string; // CALL | MEETING | SUSPENSION | OTHER
    notes?: string;
    performedBy?: string;
  }) {
    const arrear = await this.prisma.feeArrear.findFirst({
      where: { id: data.feeArrearId },
    });

    if (!arrear) {
      throw new NotFoundException(`Fee arrear with ID ${data.feeArrearId} not found`);
    }

    return this.prisma.collectionAction.create({
      data: {
        ...data,
        performedAt: new Date(),
      },
      include: {
        feeArrear: {
          include: {
            student: true,
          },
        },
        performer: true,
      },
    });
  }

  /**
   * Récupère les statistiques de recouvrement
   */
  async getCollectionStatistics(
    tenantId: string,
    academicYearId?: string
  ) {
    // ─── Ne compter que les VRAIS arriérés ───
    // Un arriéré est un FeeArrear avec :
    //   - status OPEN ou PARTIALLY_PAID (pas PAID, WRITTEN_OFF, TRANSFERRED)
    //   - balanceDue > 0 (il reste quelque chose à payer)
    const where: any = {
      tenantId,
      status: { in: ['OPEN', 'PARTIALLY_PAID'] },
      balanceDue: { gt: 0 },
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const [totalArrears, byLevel, totalDue, totalPaid, studentsWithArrears] = await Promise.all([
      this.prisma.feeArrear.count({ where }),
      this.prisma.feeArrear.groupBy({
        by: ['arrearsLevel'],
        where,
        _count: true,
        _sum: {
          balanceDue: true,
        },
      }),
      this.prisma.feeArrear.aggregate({
        where,
        _sum: {
          balanceDue: true,
        },
      }),
      this.prisma.feeArrear.aggregate({
        where,
        _sum: {
          totalPaid: true,
        },
      }),
      // Compter le nombre d'élèves distincts avec arriérés
      this.prisma.feeArrear.groupBy({
        by: ['studentId'],
        where,
      }),
    ]);

    const totalBalanceDue = Number(totalDue._sum.balanceDue || 0);
    const totalPaidAmount = Number(totalPaid._sum.totalPaid || 0);
    const totalExpected = totalBalanceDue + totalPaidAmount;
    const collectionRate =
      totalExpected > 0 ? (totalPaidAmount / totalExpected) * 100 : 0;

    return {
      totalArrears,
      byLevel,
      totals: {
        expected: totalExpected,
        paid: totalPaidAmount,
        balanceDue: totalBalanceDue,
        collectionRate: parseFloat(collectionRate.toFixed(2)),
      },
      studentsWithArrears: studentsWithArrears.length,
    };
  }

  /**
   * Liste toutes les promesses de paiement d'un tenant (avec filtres).
   * ⚠️ Les promesses sont liées à des FeeArrear qui peuvent être d'années antérieures.
   * On filtre donc par tenantId (toutes années confondues) sauf si academicYearId
   * est explicitement demandé.
   */
  async findAllPaymentPromises(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      status?: string;
      feeArrearId?: string;
    },
  ) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.feeArrearId) where.feeArrearId = filters.feeArrearId;

    // ⚠️ Ne pas filtrer par academicYearId sur le feeArrear — les promesses peuvent
    // être liées à des arriérés d'années antérieures. On filtre seulement par tenantId.
    // L'academicYearId est utilisé uniquement pour les studentEnrollments (filtre classe).
    where.feeArrear = { tenantId };

    return this.prisma.paymentPromise.findMany({
      where,
      include: {
        feeArrear: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                // Inclure les inscriptions pour le filtre par classe côté frontend
                studentEnrollments: {
                  where: { academicYearId: filters?.academicYearId },
                  select: { id: true, classId: true, class: { select: { id: true, name: true } } },
                },
              },
            },
            studentFee: { include: { feeDefinition: { select: { id: true, label: true } } } },
            academicYear: { select: { id: true, name: true } },
          },
        },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { feeArrear: { student: { lastName: 'asc' } } },
        { feeArrear: { student: { firstName: 'asc' } } },
        { promisedDate: 'asc' },
      ],
    });
  }

  /**
   * Marque une promesse comme honorée ou rompue.
   */
  async updatePaymentPromiseStatus(
    promiseId: string,
    status: 'HONORED' | 'BROKEN' | 'PENDING',
  ) {
    return this.prisma.paymentPromise.update({
      where: { id: promiseId },
      data: { status },
      include: {
        feeArrear: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  /**
   * Supprime une promesse de paiement.
   */
  async deletePaymentPromise(tenantId: string, promiseId: string) {
    const promise = await this.prisma.paymentPromise.findFirst({
      where: { id: promiseId, feeArrear: { tenantId } },
    });
    if (!promise) {
      throw new NotFoundException('Promesse introuvable');
    }
    await this.prisma.paymentPromise.delete({ where: { id: promiseId } });
    return { success: true, deleted: true };
  }

  /**
   * Supprime une action de recouvrement.
   */
  async deleteCollectionAction(tenantId: string, actionId: string) {
    const action = await this.prisma.collectionAction.findFirst({
      where: { id: actionId, feeArrear: { tenantId } },
    });
    if (!action) {
      throw new NotFoundException('Action introuvable');
    }
    await this.prisma.collectionAction.delete({ where: { id: actionId } });
    return { success: true, deleted: true };
  }

  /**
   * Liste toutes les actions de recouvrement d'un tenant (avec filtres).
   */
  async findAllCollectionActions(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      actionType?: string;
      feeArrearId?: string;
    },
  ) {
    const where: any = {};
    if (filters?.actionType) where.actionType = filters.actionType;
    if (filters?.feeArrearId) where.feeArrearId = filters.feeArrearId;

    // ⚠️ Ne pas filtrer par academicYearId sur le feeArrear — les actions peuvent
    // être liées à des arriérés d'années antérieures. On filtre seulement par tenantId.
    where.feeArrear = { tenantId };

    return this.prisma.collectionAction.findMany({
      where,
      include: {
        feeArrear: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                // Inclure les inscriptions pour le filtre par classe côté frontend
                studentEnrollments: {
                  where: { academicYearId: filters?.academicYearId },
                  select: { id: true, classId: true, class: { select: { id: true, name: true } } },
                },
              },
            },
            studentFee: { include: { feeDefinition: { select: { id: true, label: true } } } },
            academicYear: { select: { id: true, name: true } },
          },
        },
        performer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { feeArrear: { student: { lastName: 'asc' } } },
        { feeArrear: { student: { firstName: 'asc' } } },
        { performedAt: 'desc' },
      ],
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

    // 3. Mettre à jour le StudentAccount si le compte existe
    const account = await this.prisma.studentAccount.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId } },
    });

    if (account) {
      const currentArrears = Number(account.arrearsAmount ?? 0);
      const currentTotalDue = Number(account.totalDue ?? 0);
      const currentBalance = Number(account.balance ?? 0);
      await this.prisma.studentAccount.update({
        where: { id: account.id },
        data: {
          arrearsAmount: currentArrears + amount,
          totalDue: currentTotalDue + amount,
          balance: currentBalance + amount,
        },
      });
    }

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

