/**
 * ============================================================================
 * ARREARS MIRROR SERVICE — Moteur de calcul unifié des arriérés
 * ============================================================================
 *
 * ⭐ Correctif « moteur de calcul » (nov. 2026 — retour promoteur) :
 *    « Le montant des arriérés n'est pas sommé dans le total dû… pour
 *    certains élèves le calcul est bien fait, pour d'autres non. »
 *
 * AVANT — QUATRE sources de vérité concurrentes désynchronisées :
 *   1. StudentAccount.totalDue / balance : les arriérés y étaient parfois
 *      incrustés (import, report d'année, inscription avec previousArrears,
 *      saisie manuelle) — parfois pas ;
 *   2. StudentAccount.arrearsAmount + carriedArrears : incrémentés DEUX FOIS
 *      par le report d'année (les deux champs pour le même arriéré) ;
 *   3. FeeArrear (lignes réelles par année) : la seule source sur laquelle
 *      opèrent le recouvrement, les encaissements FIFO et les abandons de
 *      créance — mais jamais reflétée dans les champs du compte ;
 *   4. La couche d'affichage (student-account.service) ajoute les FeeArrear
 *      ouverts au totalDue du compte.
 *
 * APRÈS — UNE SEULE source de vérité + miroirs synchronisés :
 *   - FeeArrear = SEULE source de vérité des arriérés ;
 *   - StudentAccount.totalDue / balance = frais de l'année EXCLUSIVEMENT
 *     (jamais d'arriérés incrustés — l'affichage les ajoute par-dessus) ;
 *   - StudentAccount.arrearsAmount  = miroir de Σ FeeArrear ouverts
 *     (toutes années) — pour bulletins, dossiers, portail parents,
 *     éligibilité promoteur ;
 *   - StudentAccount.carriedArrears = miroir de Σ FeeArrear ouverts des
 *     années ≠ celle du compte (arriérés « reportés »).
 *
 * Ce service est appelé par TOUS les flux qui touchent les arriérés
 * (report d'année, import Excel, détection automatique, saisie manuelle,
 * encaissement FIFO, abandon de créance, inscription avec previousArrears)
 * afin que les miroirs ne puissent plus jamais dériver.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ArrearsMirrorService {
  private readonly logger = new Logger(ArrearsMirrorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcule les miroirs d'arriérés (arrearsAmount + carriedArrears) de
   * TOUS les comptes d'un élève à partir des FeeArrear réels.
   * Idempotent : aucun changement si les miroirs sont déjà exacts.
   */
  async syncForStudent(tenantId: string, studentId: string): Promise<void> {
    const [openArrears, accounts] = await Promise.all([
      this.prisma.feeArrear.findMany({
        where: {
          tenantId,
          studentId,
          status: { in: ['OPEN', 'PARTIALLY_PAID'] },
          balanceDue: { gt: 0 },
        },
        select: { academicYearId: true, balanceDue: true },
      }),
      this.prisma.studentAccount.findMany({
        where: { tenantId, studentId },
        select: { id: true, academicYearId: true, arrearsAmount: true, carriedArrears: true },
      }),
    ]);

    const totalOpen = openArrears.reduce((s, a) => s + Number(a.balanceDue ?? 0), 0);

    for (const acc of accounts) {
      const otherYears = openArrears
        .filter((a) => a.academicYearId !== acc.academicYearId)
        .reduce((s, a) => s + Number(a.balanceDue ?? 0), 0);
      const currentAmount = Number(acc.arrearsAmount ?? 0);
      const currentCarried = Number(acc.carriedArrears ?? 0);
      if (
        Math.abs(currentAmount - totalOpen) < 0.01 &&
        Math.abs(currentCarried - otherYears) < 0.01
      ) {
        continue; // miroir déjà exact
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
        await tx.studentAccount.update({
          where: { id: acc.id },
          data: {
            arrearsAmount: totalOpen,
            carriedArrears: otherYears,
            updatedAt: new Date(),
          },
        });
      });
    }
  }

  /**
   * Variante batch (import / détection automatique) : resynchronise tous les
   * comptes d'une liste d'élèves — une transaction par élève, sans bloquer
   * le reste en cas d'erreur isolée.
   */
  async syncForStudents(tenantId: string, studentIds: string[]): Promise<void> {
    const unique = [...new Set(studentIds)];
    for (const studentId of unique) {
      try {
        await this.syncForStudent(tenantId, studentId);
      } catch (e: any) {
        this.logger.warn(`Miroirs non resynchronisés pour ${studentId}: ${e.message}`);
      }
    }
  }
}
