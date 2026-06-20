/**
 * ============================================================================
 * STUDENT COUNT VERIFIER
 * ============================================================================
 *
 * Vérifie rigoureusement que le nombre d'élèves déclaré par l'école correspond
 * au nombre réel d'élèves en base de données, et que le plan d'abonnement
 * correspond bien à ce nombre.
 *
 * Règles :
 *   - SEED : 1-150 élèves
 *   - GROW : 151-400 élèves
 *   - LEAD : 401-800 élèves
 *   - NETWORK : 800+ élèves
 *
 * Si le nombre réel d'élèves dépasse la limite du plan actuel :
 *   1. Notifier l'école (Email + WhatsApp) qu'elle doit upgrader
 *   2. Donner 7 jours de grâce pour upgrader
 *   3. Après 7 jours : suspendre l'ajout de nouveaux élèves (mais pas l'accès)
 *
 * Si le nombre réel d'élèves est inférieur au plan actuel :
 *   - Ne pas downgrader automatiquement (l'école peut avoir des pics saisonniers)
 *   - Proposer un downgrade dans les paramètres
 *
 * Cette vérification s'exécute :
 *   - Quotidiennement via le cron (SubscriptionLifecycleService.runDailyCheck)
 *   - À chaque nouvelle inscription d'élève (déclenchement immédiat)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';
import { WhatsAppService } from '../../communication/services/whatsapp.service';

interface PlanLimit {
  code: string;
  name: string;
  studentMin: number;
  studentMax: number | null;
}

const PLAN_LIMITS: PlanLimit[] = [
  { code: 'SEED', name: 'Helm Seed', studentMin: 1, studentMax: 150 },
  { code: 'GROW', name: 'Helm Grow', studentMin: 151, studentMax: 400 },
  { code: 'LEAD', name: 'Helm Lead', studentMin: 401, studentMax: 800 },
  { code: 'NETWORK', name: 'Helm Network', studentMin: 801, studentMax: null },
];

@Injectable()
export class StudentCountVerifierService {
  private readonly logger = new Logger(StudentCountVerifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsappService: WhatsAppService,
  ) {}

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
   * Détermine le plan recommandé en fonction du nombre d'élèves.
   */
  getRecommendedPlanCode(studentCount: number): string {
    for (const plan of PLAN_LIMITS) {
      const max = plan.studentMax ?? Infinity;
      if (studentCount >= plan.studentMin && studentCount <= max) {
        return plan.code;
      }
    }
    return 'NETWORK';
  }

  /**
   * Vérifie si le plan actuel correspond au nombre d'élèves.
   * Retourne le plan recommandé si un upgrade est nécessaire.
   */
  checkPlanAlignment(currentPlanCode: string, studentCount: number): {
    needsUpgrade: boolean;
    recommendedPlan: string;
    currentPlanLimit: PlanLimit;
    overBy: number;
  } {
    const currentPlan = PLAN_LIMITS.find(p => p.code === currentPlanCode) || PLAN_LIMITS[0];
    const recommendedCode = this.getRecommendedPlanCode(studentCount);

    const needsUpgrade = recommendedCode !== currentPlanCode &&
      PLAN_LIMITS.findIndex(p => p.code === recommendedCode) >
      PLAN_LIMITS.findIndex(p => p.code === currentPlanCode);

    const overBy = currentPlan.studentMax
      ? Math.max(0, studentCount - currentPlan.studentMax)
      : 0;

    return {
      needsUpgrade,
      recommendedPlan: recommendedCode,
      currentPlanLimit: currentPlan,
      overBy,
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
          const alignment = this.checkPlanAlignment(currentPlan, realCount);

          if (alignment.needsUpgrade) {
            stats.needUpgrade++;

            // Si pas déjà notifié (pas de pendingUpgradePlan ou grâce expirée)
            if (!sub.pendingUpgradePlan || sub.pendingUpgradePlan !== alignment.recommendedPlan) {
              // Notifier l'école
              await this.sendUpgradeNotification(
                tenant.id,
                tenant.name,
                currentPlan,
                alignment.recommendedPlan,
                realCount,
                alignment.currentPlanLimit.studentMax || 0,
              );

              // Mettre à jour l'abonnement avec le plan en attente + période de grâce
              const graceEnd = new Date();
              graceEnd.setDate(graceEnd.getDate() + 7);

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
              // Marquer le tenant comme "ajout d'élèves bloqué"
              await this.prisma.tenant.update({
                where: { id: tenant.id },
                data: { status: 'suspended' }, // 'suspended' bloque l'ajout mais pas l'accès
              });
              this.logger.warn(
                `Tenant ${tenant.name}: grace period expired — student enrollment blocked. Must upgrade to ${alignment.recommendedPlan}.`,
              );
            }
          } else {
            // Le plan correspond — réinitialiser les flags si nécessaire
            if (sub.pendingUpgradePlan) {
              await this.prisma.helmSubscription.update({
                where: { id: sub.id },
                data: {
                  pendingUpgradePlan: null,
                  upgradeGraceEnd: null,
                },
              });
            }
            // Restaurer le statut si suspended
            if (tenant.status === 'suspended' && sub.status === 'ACTIVE') {
              await this.prisma.tenant.update({
                where: { id: tenant.id },
                data: { status: 'active' },
              });
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

      const alignment = this.checkPlanAlignment(sub.plan || 'SEED', realCount);

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
          alignment.currentPlanLimit.studentMax || 0,
        );

        // Donner 7 jours de grâce
        const graceEnd = new Date();
        graceEnd.setDate(graceEnd.getDate() + 7);

        await this.prisma.helmSubscription.update({
          where: { id: sub.id },
          data: {
            pendingUpgradePlan: alignment.recommendedPlan as any,
            upgradeGraceEnd: graceEnd,
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`verifyAfterEnrollment failed for ${tenantId}: ${err.message}`);
    }
  }

  /**
   * Envoie une notification d'upgrade à l'école.
   */
  private async sendUpgradeNotification(
    tenantId: string,
    schoolName: string,
    currentPlan: string,
    recommendedPlan: string,
    actualCount: number,
    planLimit: number,
  ): Promise<void> {
    const recommendedPlanInfo = PLAN_LIMITS.find(p => p.code === recommendedPlan);
    const subject = `⚠️ Upgrade nécessaire — ${schoolName}`;
    const message = `Bonjour,

Le nombre d'élèves de votre établissement (${actualCount}) dépasse la limite de votre plan actuel (${currentPlan} : ${planLimit} élèves max).

Nous vous recommandons de passer au plan ${recommendedPlanInfo?.name || recommendedPlan} qui correspond à votre effectif réel.

Vous disposez de 7 jours pour effectuer cette mise à niveau. Passé ce délai, l'ajout de nouveaux élèves sera suspendu.

Connectez-vous à votre espace Academia Helm → Paramètres → Facturation pour mettre à niveau votre abonnement.

Cordialement,
L'équipe Academia Helm`;

    // Email
    try {
      const promoterEmail = await this.getPromoterEmail(tenantId);
      if (promoterEmail) {
        await this.emailService.sendEmail({
          to: promoterEmail,
          subject,
          html: `<p>Bonjour,</p>
<p>Le nombre d'élèves de votre établissement (<strong>${actualCount}</strong>) dépasse la limite de votre plan actuel (<strong>${currentPlan}</strong> : ${planLimit} élèves max).</p>
<p>Nous vous recommandons de passer au plan <strong>${recommendedPlanInfo?.name || recommendedPlan}</strong> qui correspond à votre effectif réel.</p>
<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px;margin:16px 0;">
<p style="margin:0;color:#92400e;"><strong>⚠️ Action requise :</strong> Vous disposez de <strong>7 jours</strong> pour effectuer cette mise à niveau. Passé ce délai, l'ajout de nouveaux élèves sera suspendu.</p>
</div>
<p>Connectez-vous à votre espace Academia Helm → Paramètres → Facturation pour mettre à niveau votre abonnement.</p>
<p>Cordialement,<br>L'équipe Academia Helm</p>`,
          fromName: 'Academia Helm',
        });
        this.logger.log(`Upgrade notification email sent to ${promoterEmail} for ${schoolName}`);
      }
    } catch (err: any) {
      this.logger.error(`Email upgrade notification failed: ${err.message}`);
    }

    // WhatsApp
    try {
      const promoterPhone = await this.getPromoterPhone(tenantId);
      if (promoterPhone) {
        await this.whatsappService.sendWhatsApp({
          to: promoterPhone,
          message: `⚠️ Academia Helm\n\nBonjour,\n\nVotre établissement ${schoolName} a ${actualCount} élèves, ce qui dépasse la limite de votre plan ${currentPlan} (${planLimit} max).\n\nPassez au plan ${recommendedPlanInfo?.name || recommendedPlan} dans les 7 jours.\n\nAprès 7 jours, l'ajout d'élèves sera suspendu.\n\nConnectez-vous: https://academiahelm.com/login`,
        });
        this.logger.log(`Upgrade notification WhatsApp sent to ${promoterPhone} for ${schoolName}`);
      }
    } catch (err: any) {
      this.logger.error(`WhatsApp upgrade notification failed: ${err.message}`);
    }
  }

  private async getPromoterEmail(tenantId: string): Promise<string | null> {
    try {
      const user = await this.prisma.user.findFirst({
        where: { tenantId, role: { in: ['PROMOTER', 'SCHOOL_OWNER', 'SUPER_DIRECTOR'] } },
        select: { email: true },
      });
      return user?.email || null;
    } catch { return null; }
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
    } catch { return null; }
  }
}
