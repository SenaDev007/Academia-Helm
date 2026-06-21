/**
 * ============================================================================
 * RECRUITMENT NOTIFICATION SERVICE
 * ============================================================================
 *
 * Envoi d'emails aux candidats tout au long du cycle de recrutement :
 *   1. Candidature reçue              → notifyApplicationReceived
 *   2. Entretien programmé            → notifyInterviewScheduled
 *   3. Test programmé                 → notifyTestScheduled
 *   4. Résultat entretien             → notifyInterviewResult
 *   5. Résultat test                  → notifyTestResult
 *   6. Embauché (contrat à signer)    → notifyHired
 *   7. Contrat signé                  → notifyContractSigned
 *   8. Candidature rejetée            → notifyRejected
 *
 * RÈGLES :
 *   - Toutes les notifications sont FIRE-AND-FORGET (.catch(log))
 *     → elles ne bloquent jamais l'action métier
 *   - Chaque email est personnalisé pour l'école tenante :
 *     * Header : logo + nom de l'école (depuis TenantIdentityProfile)
 *     * Footer : signature Academia Helm
 *   - Si l'email échoue (provider mal configuré, adresse invalide, etc.),
 *     on log l'erreur et on continue — la candidature n'est pas affectée
 *
 * DEPENDENCIES :
 *   - EmailService (CommunicationModule)
 *   - PrismaService (DB access pour récupérer tenant, job, branding)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../communication/services/email.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { compressLogoForEmail } from './logo-compressor';
import {
  renderApplicationReceived,
  renderInterviewScheduled,
  renderTestScheduled,
  renderInterviewResult,
  renderTestResult,
  renderHired,
  renderContractSigned,
  renderRejected,
  TenantBranding,
} from './recruitment-email-templates';

@Injectable()
export class RecruitmentNotificationService {
  private readonly logger = new Logger(RecruitmentNotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Récupère le branding (logo + nom + contact) du tenant.
   * Cherche d'abord dans `recruiter_profiles` (config recruteur) pour l'email
   * et la signature, puis dans `tenant_identity_profiles` (identité école)
   * pour le logo et le nom, puis fallback sur le `Tenant.name`.
   *
   * Si un `RecruiterProfile` est configuré, son email/signature sont utilisés
   * pour personnaliser l'envoi (from, signature dans le footer).
   */
  private async getTenantBranding(tenantId: string): Promise<TenantBranding> {
    try {
      // 0. Récupérer le RecruiterProfile (config recruteur) pour l'email + signature
      const recruiterProfile = await this.prisma.recruiterProfile
        .findFirst({
          where: { tenantId, isActive: true },
          select: {
            fullName: true,
            email: true,
            phone: true,
            functionLabel: true,
            signatureText: true,
            signatureLogoUrl: true,
          },
        })
        .catch(() => null);

      // 1. Essayer tenant_identity_profiles (identité école)
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true,
          logoUrl: true,
          address: true,
          phonePrimary: true,
          email: true,
        },
      });

      if (profile?.schoolName) {
        // Utiliser l'URL publique du logo au lieu du base64.
        // L'API backend sert le logo via GET /api/tenants/:tenantId/logo
        // qui retourne l'image directement (Buffer) avec le bon Content-Type.
        // Ça permet à Gmail/Outlook de charger l'image comme une URL normale
        // au lieu d'un base64 volumineux (115KB) qui est souvent bloqué.
        const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
          || 'https://academia-helm-api.fly.dev';
        const logoUrl = profile.logoUrl
          ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
          : null;

        return {
          schoolName: profile.schoolName,
          schoolLogo: logoUrl,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
          // RecruiterProfile fields (optional — may be null)
          recruiterName: recruiterProfile?.fullName,
          recruiterEmail: recruiterProfile?.email,
          recruiterFunction: recruiterProfile?.functionLabel,
          recruiterPhone: recruiterProfile?.phone,
          signatureText: recruiterProfile?.signatureText,
          signatureLogoUrl: recruiterProfile?.signatureLogoUrl,
        };
      }

      // 2. Fallback sur le tenant directement
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      return {
        schoolName: tenant?.name || 'Établissement',
        recruiterName: recruiterProfile?.fullName,
        recruiterEmail: recruiterProfile?.email,
        recruiterFunction: recruiterProfile?.functionLabel,
        recruiterPhone: recruiterProfile?.phone,
        signatureText: recruiterProfile?.signatureText,
        signatureLogoUrl: recruiterProfile?.signatureLogoUrl,
      };
    } catch (err: any) {
      this.logger.warn(`getTenantBranding failed for tenant ${tenantId}: ${err.message}`);
      return { schoolName: 'Établissement' };
    }
  }

  /**
   * Récupère le titre du poste depuis un jobId.
   */
  private async getJobTitle(jobId: string): Promise<string> {
    try {
      const job = await this.prisma.hrJob.findUnique({
        where: { id: jobId },
        select: { title: true },
      });
      return job?.title || 'Poste non spécifié';
    } catch {
      return 'Poste non spécifié';
    }
  }

  /**
   * Récupère les infos candidat (nom, prénom, email).
   */
  private async getCandidateInfo(candidateId: string): Promise<{
    firstName: string;
    lastName: string;
    email: string;
    name: string;
  } | null> {
    try {
      const c = await this.prisma.hrCandidate.findUnique({
        where: { id: candidateId },
        select: { firstName: true, lastName: true, email: true },
      });
      if (!c) return null;
      return {
        firstName: c.firstName || '',
        lastName: c.lastName || '',
        email: c.email,
        name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
      };
    } catch {
      return null;
    }
  }

  /**
   * Envoie un email via EmailService — wrapper qui log les erreurs.
   * Ne JAMAIS throw — les erreurs sont catchées et loggées.
   *
   * Le fromName affiche le nom de l'école (pas Academia Helm) car c'est
   * l'école qui recrute. Academia Helm apparaît dans le footer de l'email.
   *
   * ─── TRAÇABILITÉ (Volet 1) ───
   * Si `category` est fournie, l'email est envoyé via `sendCategorized()`
   * ce qui crée une entrée EmailLog (catégorisée + reply-to personnalisé).
   * Sinon, fallback vers `sendEmail()` simple (legacy, non tracé).
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: {
      fromName?: string;
      fromEmail?: string;
      // ─── Traçabilité (Volet 1) ───
      category?: 'RECRUTEMENT' | 'PEDAGOGIE' | 'FINANCE' | 'ADMINISTRATIF' | 'COMMUNICATION' | 'SYSTEM';
      subCategory?: string;
      module?: string;
      tenantId?: string;
      recipientName?: string;
      recipientType?: 'CANDIDAT' | 'PARENT' | 'STAFF' | 'ENSEIGNANT' | 'EXTERNE';
      recipientId?: string;
      relatedEntityId?: string;
      relatedEntityType?: string;
    },
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('EMAIL_FROM_NOREPLY') ||
      'noreply@academiahelm.com';
    const fromName = options?.fromName || 'Academia Helm — Recrutement';

    // ⚠️ IMPORTANT : Resend exige que l'expéditeur (from) soit sur un domaine
    // vérifié (academiahelm.com). On NE JAMAIS utiliser l'email du promoteur
    // (ex: salumerhel2036@gmail.com) comme fromEmail car gmail.com n'est pas
    // vérifié sur Resend → erreur "domain is not verified".
    // Si un recruiterEmail est fourni, on l'utilise comme replyTo à la place.
    const replyToEmail = options?.fromEmail || undefined;
    const safeFromEmail = fromEmail; // Toujours noreply@academiahelm.com

    // ─── Voie tracée (catégorisée) ───
    // On utilise sendCategorized si la category est fournie ET le tenantId est dispo
    if (options?.category && options?.tenantId) {
      try {
        const result = await this.emailService.sendCategorized({
          tenantId: options.tenantId,
          category: options.category,
          subCategory: options.subCategory,
          module: options.module || 'hr',
          to,
          toName: options.recipientName,
          recipientType: options.recipientType || 'CANDIDAT',
          recipientId: options.recipientId,
          fromEmail: safeFromEmail,
          fromName,
          subject,
          html,
          triggeredBy: 'SYSTEM',
          relatedEntityId: options.relatedEntityId,
          relatedEntityType: options.relatedEntityType,
        });

        if (result.success) {
          this.logger.log(
            `📧 Email categorisé envoyé à ${to} — subject: "${subject.substring(0, 80)}" — ` +
              `category=${options.category}, subCategory=${options.subCategory || '-'}, ` +
              `logId=${result.logId}, providerId=${result.providerId || 'N/A'}`,
          );
          return; // ✅ Email envoyé avec succès, on sort
        } else {
          this.logger.error(
            `📧 Email categorisé FAILED pour ${to}: ${result.error} — ` +
              `category=${options.category}, subCategory=${options.subCategory || '-'}, ` +
              `logId=${result.logId || 'N/A'} — fallback vers sendEmail`,
          );
          // ⚠️ Ne pas return ici — continuer vers le fallback sendEmail
        }
      } catch (err: any) {
        this.logger.error(
          `sendCategorized threw (will fallback to plain sendEmail): ${err.message}`,
          err.stack,
        );
        // On continue vers le fallback sendEmail — l'email doit partir même si le log échoue
      }
    }

    // ─── Voie legacy (non tracée) ───
    // Utilisée pour les tests (testSendInterviewResultDirect, etc.) ou si
    // le caller n'a pas fourni de category.
    await this.emailService.sendEmail({
      to,
      subject,
      html,
      from: safeFromEmail,
      fromName,
      replyTo: replyToEmail,
    });
    this.logger.log(
      `📧 Email envoyé (legacy, non tracé) à ${to} — subject: "${subject.substring(0, 80)}" — fromName=${fromName}, replyTo=${replyToEmail || 'N/A'}`,
    );
  }

  // ─── 1. CANDIDATURE REÇUE ──────────────────────────────────────────────────
  async notifyApplicationReceived(params: {
    candidateId: string;
    tenantId: string;
    jobId: string;
    experiences: any[];
    education: any[];
    skills: string[];
    pitch?: string;
    documentsSubmitted: Array<{ type: string; fileName: string }>;
  }): Promise<void> {
    try {
      const [branding, jobTitle, candidate] = await Promise.all([
        this.getTenantBranding(params.tenantId),
        this.getJobTitle(params.jobId),
        this.getCandidateInfo(params.candidateId),
      ]);
      if (!candidate) return;

      const { subject, html } = renderApplicationReceived({
        branding,
        candidateName: candidate.name,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle,
        experiences: params.experiences,
        education: params.education,
        skills: params.skills,
        pitch: params.pitch,
        documentsSubmitted: params.documentsSubmitted,
      });
      await this.sendEmail(candidate.email, subject, html, {
        fromName: branding.schoolName,
        fromEmail: branding.recruiterEmail || undefined,
        category: 'RECRUTEMENT',
        subCategory: 'candidature_recue',
        tenantId: params.tenantId,
        recipientName: candidate.name,
        recipientType: 'CANDIDAT',
        recipientId: params.candidateId,
        relatedEntityId: params.candidateId,
        relatedEntityType: 'HrCandidate',
      });
    } catch (err: any) {
      this.logger.error(`notifyApplicationReceived failed: ${err.message}`, err.stack);
    }
  }

  // ─── 2. ENTRETIEN PROGRAMMÉ ────────────────────────────────────────────────
  async notifyInterviewScheduled(params: {
    candidateId: string;
    tenantId: string;
    jobId: string;
    interviewDate: Date | string;
    interviewTime?: string;
    format: string;
    evaluator?: string;
    type?: string;
    meetingLink?: string;
    phoneNumber?: string;
  }): Promise<void> {
    try {
      const [branding, jobTitle, candidate] = await Promise.all([
        this.getTenantBranding(params.tenantId),
        this.getJobTitle(params.jobId),
        this.getCandidateInfo(params.candidateId),
      ]);
      if (!candidate) return;

      const { subject, html } = renderInterviewScheduled({
        branding,
        candidateName: candidate.name,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle,
        interviewDate: params.interviewDate,
        interviewTime: params.interviewTime,
        format: params.format,
        evaluator: params.evaluator,
        type: params.type,
        meetingLink: params.meetingLink,
        phoneNumber: params.phoneNumber,
      });
      await this.sendEmail(candidate.email, subject, html, {
        fromName: branding.schoolName,
        category: 'RECRUTEMENT',
        subCategory: 'entretien_planifie',
        tenantId: params.tenantId,
        recipientName: candidate.name,
        recipientType: 'CANDIDAT',
        recipientId: params.candidateId,
        relatedEntityId: params.candidateId,
        relatedEntityType: 'HrCandidate',
      });
    } catch (err: any) {
      this.logger.error(`notifyInterviewScheduled failed: ${err.message}`, err.stack);
    }
  }

  // ─── 3. TEST PROGRAMMÉ ─────────────────────────────────────────────────────
  async notifyTestScheduled(params: {
    candidateId: string;
    tenantId: string;
    jobId: string;
    testName: string;
    testType?: string;
    description?: string;
    duration?: number;
    instructions?: string;
    maxScore?: number;
    passingScore?: number;
  }): Promise<void> {
    try {
      const [branding, jobTitle, candidate] = await Promise.all([
        this.getTenantBranding(params.tenantId),
        this.getJobTitle(params.jobId),
        this.getCandidateInfo(params.candidateId),
      ]);
      if (!candidate) return;

      const { subject, html } = renderTestScheduled({
        branding,
        candidateName: candidate.name,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle,
        testName: params.testName,
        testType: params.testType,
        description: params.description,
        duration: params.duration,
        instructions: params.instructions,
        maxScore: params.maxScore,
        passingScore: params.passingScore,
      });
      await this.sendEmail(candidate.email, subject, html, {
        fromName: branding.schoolName,
        category: 'RECRUTEMENT',
        subCategory: 'test_planifie',
        tenantId: params.tenantId,
        recipientName: candidate.name,
        recipientType: 'CANDIDAT',
        recipientId: params.candidateId,
        relatedEntityId: params.candidateId,
        relatedEntityType: 'HrCandidate',
      });
    } catch (err: any) {
      this.logger.error(`notifyTestScheduled failed: ${err.message}`, err.stack);
    }
  }

  // ─── 4. RÉSULTAT ENTRETIEN ─────────────────────────────────────────────────
  async notifyInterviewResult(params: {
    candidateId: string;
    tenantId: string;
    jobId: string;
    result: string;
    score?: number;
    feedback?: string;
    evaluator?: string;
    interviewDate?: Date | string;
  }): Promise<void> {
    try {
      const [branding, jobTitle, candidate] = await Promise.all([
        this.getTenantBranding(params.tenantId),
        this.getJobTitle(params.jobId),
        this.getCandidateInfo(params.candidateId),
      ]);
      if (!candidate) return;

      const { subject, html } = renderInterviewResult({
        branding,
        candidateName: candidate.name,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle,
        result: params.result,
        score: params.score,
        feedback: params.feedback,
        evaluator: params.evaluator,
        interviewDate: params.interviewDate,
      });
      await this.sendEmail(candidate.email, subject, html, {
        fromName: branding.schoolName,
        category: 'RECRUTEMENT',
        subCategory: 'resultat_entretien',
        tenantId: params.tenantId,
        recipientName: candidate.name,
        recipientType: 'CANDIDAT',
        recipientId: params.candidateId,
        relatedEntityId: params.candidateId,
        relatedEntityType: 'HrCandidate',
      });
    } catch (err: any) {
      this.logger.error(`notifyInterviewResult failed: ${err.message}`, err.stack);
    }
  }

  // ─── 5. RÉSULTAT TEST ──────────────────────────────────────────────────────
  async notifyTestResult(params: {
    candidateId: string;
    tenantId: string;
    jobId: string;
    result: string;
    score?: number;
    maxScore?: number;
    passingScore?: number;
    testName?: string;
    feedback?: string;
  }): Promise<void> {
    try {
      const [branding, jobTitle, candidate] = await Promise.all([
        this.getTenantBranding(params.tenantId),
        this.getJobTitle(params.jobId),
        this.getCandidateInfo(params.candidateId),
      ]);
      if (!candidate) return;

      const { subject, html } = renderTestResult({
        branding,
        candidateName: candidate.name,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle,
        result: params.result,
        score: params.score,
        maxScore: params.maxScore,
        passingScore: params.passingScore,
        testName: params.testName,
        feedback: params.feedback,
      });
      await this.sendEmail(candidate.email, subject, html, {
        fromName: branding.schoolName,
        category: 'RECRUTEMENT',
        subCategory: 'resultat_test',
        tenantId: params.tenantId,
        recipientName: candidate.name,
        recipientType: 'CANDIDAT',
        recipientId: params.candidateId,
        relatedEntityId: params.candidateId,
        relatedEntityType: 'HrCandidate',
      });
    } catch (err: any) {
      this.logger.error(`notifyTestResult failed: ${err.message}`, err.stack);
    }
  }

  // ─── 6. EMBAUCHÉ ───────────────────────────────────────────────────────────
  async notifyHired(params: {
    candidateId: string;
    tenantId: string;
    jobId: string;
    contractType?: string;
    startDate?: Date | string;
    salary?: string;
    contractUrl?: string;
  }): Promise<void> {
    try {
      const [branding, jobTitle, candidate] = await Promise.all([
        this.getTenantBranding(params.tenantId),
        this.getJobTitle(params.jobId),
        this.getCandidateInfo(params.candidateId),
      ]);
      if (!candidate) return;

      const { subject, html } = renderHired({
        branding,
        candidateName: candidate.name,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle,
        contractType: params.contractType,
        startDate: params.startDate,
        salary: params.salary,
        contractUrl: params.contractUrl,
      });
      await this.sendEmail(candidate.email, subject, html, {
        fromName: branding.schoolName,
        category: 'RECRUTEMENT',
        subCategory: 'embauche',
        tenantId: params.tenantId,
        recipientName: candidate.name,
        recipientType: 'CANDIDAT',
        recipientId: params.candidateId,
        relatedEntityId: params.candidateId,
        relatedEntityType: 'HrCandidate',
      });
    } catch (err: any) {
      this.logger.error(`notifyHired failed: ${err.message}`, err.stack);
    }
  }

  // ─── 7. CONTRAT SIGNÉ ──────────────────────────────────────────────────────
  async notifyContractSigned(params: {
    candidateId: string;
    tenantId: string;
    jobId: string;
    contractType?: string;
    signedAt?: Date | string;
    contractUrl?: string;
  }): Promise<void> {
    try {
      const [branding, jobTitle, candidate] = await Promise.all([
        this.getTenantBranding(params.tenantId),
        this.getJobTitle(params.jobId),
        this.getCandidateInfo(params.candidateId),
      ]);
      if (!candidate) return;

      const { subject, html } = renderContractSigned({
        branding,
        candidateName: candidate.name,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle,
        contractType: params.contractType,
        signedAt: params.signedAt,
        contractUrl: params.contractUrl,
      });
      await this.sendEmail(candidate.email, subject, html, {
        fromName: branding.schoolName,
        category: 'RECRUTEMENT',
        subCategory: 'contrat_signe',
        tenantId: params.tenantId,
        recipientName: candidate.name,
        recipientType: 'CANDIDAT',
        recipientId: params.candidateId,
        relatedEntityId: params.candidateId,
        relatedEntityType: 'HrCandidate',
      });
    } catch (err: any) {
      this.logger.error(`notifyContractSigned failed: ${err.message}`, err.stack);
    }
  }

  // ─── 8. CANDIDATURE REJETÉE ────────────────────────────────────────────────
  async notifyRejected(params: {
    candidateId: string;
    tenantId: string;
    jobId: string;
    reason?: string;
  }): Promise<void> {
    try {
      const [branding, jobTitle, candidate] = await Promise.all([
        this.getTenantBranding(params.tenantId),
        this.getJobTitle(params.jobId),
        this.getCandidateInfo(params.candidateId),
      ]);
      if (!candidate) return;

      const { subject, html } = renderRejected({
        branding,
        candidateName: candidate.name,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle,
        reason: params.reason,
      });
      await this.sendEmail(candidate.email, subject, html, {
        fromName: branding.schoolName,
        category: 'RECRUTEMENT',
        subCategory: 'candidature_rejetee',
        tenantId: params.tenantId,
        recipientName: candidate.name,
        recipientType: 'CANDIDAT',
        recipientId: params.candidateId,
        relatedEntityId: params.candidateId,
        relatedEntityType: 'HrCandidate',
      });
    } catch (err: any) {
      this.logger.error(`notifyRejected failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Helper pour récupérer le jobId d'un candidat via sa première application.
   * Utilisé par les hooks qui n'ont pas le jobId directement (ex: updateInterview).
   */
  async getJobIdForCandidate(candidateId: string): Promise<string | null> {
    try {
      const app = await this.prisma.hrApplication.findFirst({
        where: { candidateId },
        select: { jobId: true },
        orderBy: { createdAt: 'desc' },
      });
      return app?.jobId || null;
    } catch {
      return null;
    }
  }
}
