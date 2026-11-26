/**
 * ============================================================================
 * STUDENT COUNT VERIFIER — moteur de conformité effectif ↔ plan d'abonnement
 * ============================================================================
 *
 * Vérifie rigoureusement que le nombre d'élèves déclaré par l'école correspond
 * au nombre réel d'élèves en base de données, et que le plan d'abonnement
 * correspond bien à ce nombre.
 *
 * ⭐ 2026-11-26 — ALIGNEMENT NOUVELLE GRILLE DE TARIFICATION :
 *   La grille des plans n'est PLUS codée en dur. Elle vient de `pricing_plans`
 *   (source unique de vérité, éditable depuis le back-office
 *   /platform/subscriptions — plans « Helm Essentiel », « Helm Croissance »,
 *   « Helm Performance », « Helm Institution »), via PricingService.
 *   → Toute évolution de la grille (tranches, frais d'activation, frais
 *     annuels) est automatiquement respectée par les vérifications ET par
 *     l'e-mail d'upgrade (gabarit brandé Academia Helm avec logo, en-tête,
 *     pied de page et grille complète).
 *   Repli statique (contrat d'abonnement Article 4) uniquement si la base
 *   est momentanément indisponible.
 *
 * Règles comportementales (inchangées) :
 *   - Effectif > capacité du plan → notifier l'école (Email + WhatsApp),
 *     accorder 7 jours de grâce, puis suspendre l'AJOUT d'élèves
 *     (jamais l'accès ni les données).
 *   - Effectif < plan actuel → pas de downgrade automatique (pics saisonniers).
 *
 * Cette vérification s'exécute :
 *   - Quotidiennement via le cron (SubscriptionLifecycleService.runDailyCheck)
 *   - À chaque nouvelle inscription d'élève (déclenchement immédiat)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';
import { WhatsAppService } from '../../communication/services/whatsapp.service';
import { PricingService } from './pricing.service';

/** Entrée de la grille des plans (miroir de pricing_plans). */
export interface PlanGridEntry {
  code: string;
  name: string;
  studentMin: number;
  studentMax: number | null;
  initialFee: number;
  yearlyAmount: number | null;
}

/**
 * ⭐ Repli statique — contrat d'abonnement Academia Helm (Article 4),
 *    utilisé UNIQUEMENT si `pricing_plans` est momentanément indisponible.
 *    Les tranches réelles viennent toujours de la base en priorité.
 */
const CONTRACT_PLAN_FALLBACK: PlanGridEntry[] = [
  { code: 'SEED', name: 'Helm Essentiel', studentMin: 1, studentMax: 50, initialFee: 500000, yearlyAmount: 50000 },
  { code: 'GROW', name: 'Helm Croissance', studentMin: 51, studentMax: 150, initialFee: 500000, yearlyAmount: 75000 },
  { code: 'LEAD', name: 'Helm Performance', studentMin: 151, studentMax: 400, initialFee: 500000, yearlyAmount: 100000 },
  { code: 'NETWORK', name: 'Helm Institution', studentMin: 401, studentMax: null, initialFee: 500000, yearlyAmount: 150000 },
];

/** Délai de grâce avant suspension de l'ajout d'élèves (jours). */
const UPGRADE_GRACE_DAYS = 7;

@Injectable()
export class StudentCountVerifierService {
  private readonly logger = new Logger(StudentCountVerifierService.name);

  /** Cache mémoire de la grille (5 min) — évite une requête par vérification. */
  private plansGridCache: { grid: PlanGridEntry[]; expiresAt: number } | null = null;
  private static readonly GRID_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
    private readonly pricingService: PricingService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Grille des plans (NOUVELLE tarification — source : pricing_plans) ───

  /**
   * Grille des plans actifs, triée par tranche croissante.
   *
   * ⭐ Source unique de vérité : `pricing_plans` (PricingService.
   *    getActivePlansGrid) — la NOUVELLE grille de tarification pilotée depuis
   *    le back-office. Exclut le pseudo-plan BILINGUAL (add-on, pas un plan).
   *    Repli : grille statique du contrat si la base ne répond pas.
   */
  private async getPlansGrid(): Promise<PlanGridEntry[]> {
    if (this.plansGridCache && Date.now() < this.plansGridCache.expiresAt) {
      return this.plansGridCache.grid;
    }
    try {
      const raw = await this.pricingService.getActivePlansGrid();
      const grid: PlanGridEntry[] = (raw || [])
        .filter((p) => p && p.code && p.name)
        .map((p) => ({
          code: p.code,
          name: p.name,
          studentMin: p.studentMin ?? 0,
          studentMax: p.studentMax ?? null,
          initialFee: p.initialFee ?? 0,
          yearlyAmount: p.yearlyAmount ?? null,
        }))
        .sort((a, b) => a.studentMin - b.studentMin);
      if (grid.length > 0) {
        this.plansGridCache = { grid, expiresAt: Date.now() + StudentCountVerifierService.GRID_CACHE_TTL_MS };
        return grid;
      }
      this.logger.warn('getPlansGrid: pricing_plans vide — repli sur la grille statique du contrat.');
    } catch (err: any) {
      this.logger.warn(`getPlansGrid: pricing_plans indisponible (${err?.message}) — repli grille contrat.`);
    }
    return CONTRACT_PLAN_FALLBACK;
  }

  /**
   * Compte le nombre réel d'élèves actifs pour un tenant.
   * Un élève est "actif" s'il est inscrit pour l'année scolaire en cours.
   */
  async countActiveStudents(tenantId: string): Promise<number> {
    try {
      // Trouver l'année scolaire active
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId, isActive: true },
        select: { id: true },
      });

      if (!activeYear) {
        // Pas d'année active → compter tous les élèves du tenant
        const count = await this.prisma.student.count({
          where: { tenantId },
        });
        return count;
      }

      // Compter les élèves inscrits pour l'année active
      const count = await this.prisma.student.count({
        where: {
          tenantId,
          OR: [
            { academicYearId: activeYear.id },
            { currentAcademicYearId: activeYear.id },
          ],
        },
      });

      return count;
    } catch (err: any) {
      this.logger.error(`countActiveStudents failed for tenant ${tenantId}: ${err.message}`);
      return 0;
    }
  }

  /**
   * Détermine le plan recommandé en fonction du nombre d'élèves
   * (grille passée en paramètre — nouvelle tarification).
   */
  getRecommendedPlanCode(studentCount: number, grid?: PlanGridEntry[]): string {
    const plans = (grid && grid.length > 0 ? grid : CONTRACT_PLAN_FALLBACK).slice()
      .sort((a, b) => a.studentMin - b.studentMin);
    for (const plan of plans) {
      const max = plan.studentMax ?? Infinity;
      if (studentCount >= plan.studentMin && studentCount <= max) {
        return plan.code;
      }
    }
    return plans.length > 0 ? plans[plans.length - 1].code : 'NETWORK';
  }

  /**
   * Vérifie si le plan actuel correspond au nombre d'élèves.
   * Retourne le plan recommandé si un upgrade est nécessaire.
   *
   * ⭐ 2026-11-26 — la grille vient de pricing_plans (nouvelle tarification) ;
   *    `overBy` et `currentPlanLimit` suivent la capacité RÉELLE du plan
   *    courant dans la grille (plus de constante figée).
   */
  async checkPlanAlignment(currentPlanCode: string, studentCount: number): Promise<{
    needsUpgrade: boolean;
    recommendedPlan: string;
    currentPlanLimit: PlanGridEntry;
    overBy: number;
    grid: PlanGridEntry[];
  }> {
    const grid = await this.getPlansGrid();
    const currentPlan =
      grid.find((p) => p.code === currentPlanCode) ||
      grid.find((p) => p.name === currentPlanCode) ||
      grid[0] ||
      CONTRACT_PLAN_FALLBACK[0];
    const recommendedCode = this.getRecommendedPlanCode(studentCount, grid);

    const indexOf = (code: string): number => grid.findIndex((p) => p.code === code);
    const needsUpgrade =
      recommendedCode !== currentPlan.code &&
      indexOf(recommendedCode) > indexOf(currentPlan.code);

    const overBy = currentPlan.studentMax
      ? Math.max(0, studentCount - currentPlan.studentMax)
      : 0;

    return {
      needsUpgrade,
      recommendedPlan: recommendedCode,
      currentPlanLimit: currentPlan,
      overBy,
      grid,
    };
  }

  /**
   * Vérifie tous les tenants et notifie ceux qui dépassent leur plan.
   * Appelé par le cron quotidien.
   */
  async runDailyVerification(): Promise<void> {
    this.logger.log('🔄 Running daily student count verification...');

    let stats = { checked: 0, needUpgrade: 0, notified: 0, studentsUpdated: 0 };

    try {
      // Récupérer tous les tenants actifs avec leur abonnement
      const tenants = await this.prisma.tenant.findMany({
        where: { status: { not: 'WITHDRAWN' } },
        include: {
          helmSubscriptions: {
            select: {
              id: true,
              plan: true,
              status: true,
              upgradeGraceEnd: true,
              pendingUpgradePlan: true,
            },
          },
        },
      });

      for (const tenant of tenants) {
        try {
          stats.checked++;

          // Compter les élèves réels
          const realCount = await this.countActiveStudents(tenant.id);

          // Mettre à jour le cache du nombre d'élèves
          if (tenant.studentCountCache !== realCount) {
            await this.prisma.tenant.update({
              where: { id: tenant.id },
              data: {
                studentCountCache: realCount,
                lastCountUpdate: new Date(),
                estimatedStudentCount: realCount,
              },
            });
            stats.studentsUpdated++;
          }

          const sub = tenant.helmSubscriptions;
          if (!sub || sub.status === 'BLOCKED' || sub.status === 'CANCELLED') continue;

          const currentPlan = sub.plan || 'SEED';
          const alignment = await this.checkPlanAlignment(currentPlan, realCount);

          if (alignment.needsUpgrade) {
            stats.needUpgrade++;

            // Si pas déjà notifié (pas de pendingUpgradePlan ou grâce expirée)
            if (!sub.pendingUpgradePlan || sub.pendingUpgradePlan !== alignment.recommendedPlan) {
              // Notifier l'école (e-mail brandé nouvelle grille + WhatsApp)
              await this.sendUpgradeNotification(
                tenant.id,
                tenant.name,
                currentPlan,
                alignment.recommendedPlan,
                realCount,
                alignment.currentPlanLimit.studentMax,
                alignment.grid,
                sub.id,
              );

              // Mettre à jour l'abonnement avec le plan en attente + période de grâce
              const graceEnd = new Date();
              graceEnd.setDate(graceEnd.getDate() + UPGRADE_GRACE_DAYS);

              await this.prisma.helmSubscription.update({
                where: { id: sub.id },
                data: {
                  pendingUpgradePlan: alignment.recommendedPlan as any,
                  upgradeGraceEnd: graceEnd,
                },
              });

              stats.notified++;
              this.logger.log(
                `Tenant ${tenant.name} (${tenant.id}): ${realCount} students, plan ${currentPlan} → ${alignment.recommendedPlan} recommended. Notified. Grace until ${graceEnd}.`,
              );
            }

            // Si la période de grâce est expirée → bloquer l'ajout d'élèves
            if (sub.upgradeGraceEnd && new Date() > sub.upgradeGraceEnd) {
              // Bloquer uniquement l'ajout d'élèves (pas l'accès global)
              // Utilise le champ dédié `studentEnrollmentBlocked` plutôt que
              // `tenant.status='suspended'` qui est utilisé par le billing BLOCKED.
              await this.prisma.tenant.update({
                where: { id: tenant.id },
                data: { studentEnrollmentBlocked: true },
              });
              this.logger.warn(
                `Tenant ${tenant.name}: grace period expired — student enrollment blocked. Must upgrade to ${alignment.recommendedPlan}.`,
              );
            }
          } else {
            // Le plan correspond — réinitialiser les flags si nécessaires
            if (sub.pendingUpgradePlan) {
              await this.prisma.helmSubscription.update({
                where: { id: sub.id },
                data: {
                  pendingUpgradePlan: null,
                  upgradeGraceEnd: null,
                },
              });
            }
            // Restaurer l'ajout d'élèves si bloqué
            if (tenant.studentEnrollmentBlocked) {
              await this.prisma.tenant.update({
                where: { id: tenant.id },
                data: { studentEnrollmentBlocked: false },
              });
              this.logger.log(`Tenant ${tenant.name}: enrollment unblocked (plan aligned).`);
            }
          }
        } catch (err: any) {
          this.logger.error(`Error verifying tenant ${tenant.id}: ${err.message}`);
        }
      }

      this.logger.log(`✅ Student count verification complete: ${JSON.stringify(stats)}`);
    } catch (err: any) {
      this.logger.error(`Daily student count verification failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Vérification immédiate après l'inscription d'un nouvel élève.
   * Si le nombre dépasse la limite du plan → notifier immédiatement.
   */
  async verifyAfterEnrollment(tenantId: string): Promise<void> {
    try {
      const realCount = await this.countActiveStudents(tenantId);

      // Mettre à jour le cache
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          studentCountCache: realCount,
          lastCountUpdate: new Date(),
          estimatedStudentCount: realCount,
        },
      });

      const sub = await this.prisma.helmSubscription.findUnique({
        where: { tenantId },
      });

      if (!sub) return;

      const alignment = await this.checkPlanAlignment(sub.plan || 'SEED', realCount);

      if (alignment.needsUpgrade) {
        this.logger.warn(
          `Tenant ${tenantId}: student count ${realCount} exceeds plan ${sub.plan} limit (${alignment.currentPlanLimit.studentMax}). Upgrade to ${alignment.recommendedPlan} needed.`,
        );

        // Notifier immédiatement
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });

        await this.sendUpgradeNotification(
          tenantId,
          tenant?.name || 'Établissement',
          sub.plan || 'SEED',
          alignment.recommendedPlan,
          realCount,
          alignment.currentPlanLimit.studentMax,
          alignment.grid,
          sub.id,
        );

        // Donner des jours de grâce (uniquement si pas déjà en grâce)
        if (!sub.upgradeGraceEnd) {
          const graceEnd = new Date();
          graceEnd.setDate(graceEnd.getDate() + UPGRADE_GRACE_DAYS);

          await this.prisma.helmSubscription.update({
            where: { id: sub.id },
            data: {
              pendingUpgradePlan: alignment.recommendedPlan as any,
              upgradeGraceEnd: graceEnd,
            },
          });
        }
      } else {
        // Le plan correspond — s'assurer que l'ajout d'élèves est débloqué
        // et réinitialiser les flags d'upgrade en attente
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { studentEnrollmentBlocked: true },
        });

        if (tenant?.studentEnrollmentBlocked || sub.pendingUpgradePlan) {
          await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { studentEnrollmentBlocked: false },
          });
          await this.prisma.helmSubscription.update({
            where: { id: sub.id },
            data: {
              pendingUpgradePlan: null,
              upgradeGraceEnd: null,
            },
          });
          this.logger.log(`Tenant ${tenantId}: enrollment unblocked, plan aligned (${realCount} students).`);
        }
      }
    } catch (err: any) {
      this.logger.error(`verifyAfterEnrollment failed for ${tenantId}: ${err.message}`);
    }
  }

  /**
   * Vérifie si un tenant peut inscrire un nouvel élève.
   * Retourne { allowed: true } si OK, sinon { allowed: false, reason, recommendedPlan, currentCount, planLimit }.
   *
   * À appeler AVANT toute création d'élève.
   */
  async canEnrollNewStudent(tenantId: string): Promise<{
    allowed: boolean;
    reason?: string;
    recommendedPlan?: string;
    currentCount?: number;
    planLimit?: number;
    currentPlan?: string;
    graceEndsAt?: Date;
  }> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          studentEnrollmentBlocked: true,
          name: true,
          helmSubscriptions: {
            select: {
              id: true,
              plan: true,
              status: true,
              upgradeGraceEnd: true,
              pendingUpgradePlan: true,
            },
          },
        },
      });

      if (!tenant) {
        return { allowed: true }; // Tenant introuvable — laisser passer (sera bloqué par TenantGuard)
      }

      // Si l'ajout d'élèves est explicitement bloqué
      if (tenant.studentEnrollmentBlocked) {
        const sub = tenant.helmSubscriptions;
        const currentCount = await this.countActiveStudents(tenantId);
        const currentPlan = sub?.plan || 'SEED';
        // ⭐ Capacité réelle depuis la NOUVELLE grille (pricing_plans)
        const grid = await this.getPlansGrid();
        const currentPlanEntry = grid.find((p) => p.code === currentPlan);
        return {
          allowed: false,
          reason: 'PLAN_LIMIT_EXCEEDED_GRACE_EXPIRED',
          recommendedPlan: sub?.pendingUpgradePlan || undefined,
          currentCount,
          planLimit: currentPlanEntry?.studentMax || 0,
          currentPlan,
          graceEndsAt: sub?.upgradeGraceEnd || undefined,
        };
      }

      return { allowed: true };
    } catch (err: any) {
      this.logger.error(`canEnrollNewStudent failed for ${tenantId}: ${err.message}`);
      // En cas d'erreur, on laisse passer (meilleure disponibilité)
      return { allowed: true };
    }
  }

  /**
   * Envoie une notification d'upgrade à l'école.
   *
   * ⭐ 2026-11-26 — NOUVEAU MOTEUR :
   *   - E-mail généré via EmailService.formatPlanUpgradeEmail : logo Academia
   *     Helm, en-tête/pied de page professionnels, bloc « Votre situation »,
   *     recommandation chiffrée, délai de grâce, CTA et grille tarifaire
   *     complète (plan recommandé mis en avant) — conforme à la NOUVELLE
   *     grille de tarification (pricing_plans, dynamique).
   *   - Envoi traçable via sendCategorized (journal des envois).
   *   - WhatsApp aligné : noms de plans lisibles + frais annuels réels.
   */
  private async sendUpgradeNotification(
    tenantId: string,
    schoolName: string,
    currentPlan: string,
    recommendedPlan: string,
    actualCount: number,
    planLimit: number | null,
    grid?: PlanGridEntry[],
    subscriptionId?: string,
  ): Promise<void> {
    const plansGrid = grid && grid.length > 0 ? grid : await this.getPlansGrid();
    const currentInfo = plansGrid.find((p) => p.code === currentPlan);
    const recommendedInfo = plansGrid.find((p) => p.code === recommendedPlan);
    const rangeOf = (p?: PlanGridEntry): string | null =>
      p ? (p.studentMax == null ? `${p.studentMin} élèves et plus` : `${p.studentMin} à ${p.studentMax} élèves`) : null;

    // ⭐ Lien de mise à niveau : page Facturation réelle (Paramètres → Facturation)
    const frontendUrl = (this.configService.get<string>('FRONTEND_URL') || 'https://app.academiahelm.com').trim().replace(/\/$/, '');
    const upgradeUrl = `${frontendUrl}/app/settings/billing`;

    // Email — gabarit brandé Academia Helm, nouvelle grille
    try {
      const promoter = await this.getPromoter(tenantId);
      if (promoter?.email) {
        const content = this.emailService.formatPlanUpgradeEmail({
          schoolName,
          currentPlanName: currentInfo?.name || currentPlan,
          currentPlanCode: currentPlan,
          currentPlanRange: rangeOf(currentInfo),
          recommendedPlanName: recommendedInfo?.name || recommendedPlan,
          recommendedPlanCode: recommendedPlan,
          recommendedPlanRange: rangeOf(recommendedInfo),
          recommendedYearlyFee: recommendedInfo?.yearlyAmount ?? null,
          actualStudentCount: actualCount,
          currentPlanLimit: planLimit,
          overBy: planLimit != null ? Math.max(0, actualCount - planLimit) : 0,
          graceDays: UPGRADE_GRACE_DAYS,
          upgradeUrl,
          plansGrid,
        });

        await this.emailService.sendCategorized({
          tenantId,
          category: 'FINANCE',
          subCategory: 'upgrade_plan_tarifaire',
          module: 'billing',
          to: promoter.email,
          toName: promoter.name || undefined,
          subject: content.subject,
          html: content.html,
          text: content.text,
          recipientType: 'STAFF',
          recipientId: promoter.id,
          triggeredBy: 'AUTOMATION',
          ...(subscriptionId ? { relatedEntityId: subscriptionId, relatedEntityType: 'HelmSubscription' } : {}),
        });
        this.logger.log(`Upgrade notification email sent to ${promoter.email} for ${schoolName}`);
      }
    } catch (err: any) {
      this.logger.error(`Email upgrade notification failed: ${err.message}`);
    }

    // WhatsApp — aligné nouvelle grille (noms lisibles + frais annuels réels)
    try {
      const promoterPhone = await this.getPromoterPhone(tenantId);
      if (promoterPhone) {
        const feeText =
          recommendedInfo?.yearlyAmount != null
            ? ` Frais annuels : ${Number(recommendedInfo.yearlyAmount).toLocaleString('fr-FR')} FCFA/an.`
            : '';
        await this.whatsappService.sendWhatsApp({
          to: promoterPhone,
          message:
            `Academia Helm\n\nBonjour,\n\nL'effectif de ${schoolName} (${actualCount} élèves) dépasse la capacité de votre plan ` +
            `${currentInfo?.name || currentPlan}${planLimit != null ? ` (${planLimit} élèves max)` : ''}.\n\n` +
            `Plan recommandé : ${recommendedInfo?.name || recommendedPlan}.${feeText}\n\n` +
            `Vous disposez de ${UPGRADE_GRACE_DAYS} jours pour mettre à niveau — ensuite l'ajout de nouveaux élèves sera suspendu.\n\n` +
            `Mettre à niveau : ${upgradeUrl}`,
        });
        this.logger.log(`Upgrade notification WhatsApp sent to ${promoterPhone} for ${schoolName}`);
      }
    } catch (err: any) {
      this.logger.error(`WhatsApp upgrade notification failed: ${err.message}`);
    }
  }

  /** Promoteur du tenant : e-mail, nom complet et id (destinataire notifiable). */
  private async getPromoter(tenantId: string): Promise<{ email: string; name?: string; id?: string } | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { tenantId, role: { in: ['PROMOTER', 'SCHOOL_OWNER', 'SUPER_DIRECTOR'] } },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      if (!user?.email) return null;
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined;
      return { email: user.email, name, id: user.id };
    } catch {
      return null;
    }
  }

  private async getPromoterPhone(tenantId: string): Promise<string | null> {
    try {
      const staff = await this.prisma.staff.findFirst({
        where: { tenantId, role: { in: ['PROMOTER', 'SUPER_DIRECTOR', 'DIRECTOR'] } },
        select: { phone: true },
      });
      if (staff?.phone) {
        let phone = staff.phone.replace(/[\s\-()]/g, '');
        if (!phone.startsWith('+')) phone = '+' + phone;
        return phone;
      }
      const user = await this.prisma.user.findFirst({
        where: { tenantId, role: { in: ['PROMOTER', 'SCHOOL_OWNER', 'SUPER_DIRECTOR'] } },
        select: { phone: true },
      });
      if (user?.phone) {
        let phone = user.phone.replace(/[\s\-()]/g, '');
        if (!phone.startsWith('+')) phone = '+' + phone;
        return phone;
      }
      return null;
    } catch {
      return null;
    }
  }
}
