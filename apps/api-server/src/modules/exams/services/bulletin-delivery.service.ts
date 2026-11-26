/**
 * ============================================================================
 * BULLETIN DELIVERY SERVICE — Envoi automatique des bulletins aux parents
 * ============================================================================
 *
 * ⭐ 2026-11-26 (demande promoteur) — « Pour les bulletins, on doit implémenter
 *    le mode envoi automatique par mail pour les parents dont les adresses
 *    mail ont été configurées. Et aussi, une fois que c'est disponible pour
 *    l'envoi, ça doit être automatiquement envoyé dans le canal de
 *    communication Helm Connect pour le parent en question. »
 *
 * Deux niveaux de livraison, déclenchés dès qu'un bulletin est disponible
 * pour l'envoi (étape 5 du workflow « Envoyer aux parents », ou
 * automatiquement après signature/retour enseignant quand le critère
 * autoSendAfterTeacherSign est actif) :
 *
 *   1. E-MAIL  — EmailService.sendCategorized (PEDAGOGIE/BULLETIN) avec le
 *      PDF en pièce jointe. Uniquement aux parents dont l'adresse e-mail est
 *      configurée. ⭐ Double identité : l'envoi part de la connexion Google
 *      du NIVEAU de la classe de l'élève (maternelle/primaire vs secondaire).
 *
 *   2. HELM CONNECT — message DOCUMENT (le PDF réel, comme les reçus du
 *      module finance) dans la conversation directe staff ↔ parent du
 *      parent, auto-provisionnée si nécessaire. Le parent le reçoit dans
 *      l'onglet Discussions de son portail.
 *
 *   3. (bonus) Bell icon in-app — notification « BULLETIN_PUBLISHED » qui
 *      pointe sur /app/parent/results.
 *
 * Résolution du PDF (le document EXACT que le directeur a généré) :
 *   a. ReportCard.filePath — URL publique de l'archive R2/S3 posée par
 *      « Générer PDF » (persistBulletinDocument) → téléchargée en Buffer ;
 *   b. repli : octets stockés dans bulletin_pdf_shares (lien 30 jours) ;
 *   c. aucun PDF archivé → envoi sans pièce jointe avec renvoi vers le
 *      portail parent (jamais bloquant).
 *
 * Pattern maison rigoureusement respecté (cf. DistinctionsNotificationService
 * et ReceiptNotificationFinanceService) :
 *   - fire-and-forget : chaque canal dans son try/catch, AUCUN échec ne
 *     bloque le workflow de signature/envoi des bulletins ;
 *   - signature de l'émetteur fondée sur son RÔLE (bulletins → direction) ;
 *   - multi-tenant strict (tenantId systématique).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EmailService } from '../../../communication/services/email.service';
import { ChatService } from '../../../communication/services/chat.service';
import { NotificationService } from '../../../notifications/notification.service';
import { ParentUserProvisioningService } from '../../../students/services/parent-user-provisioning.service';
import { renderEmail, escHtml } from '../../../hr/recruitment-email-templates';
import { resolveClassEmailLevelCategory } from '../../../common/utils/level-category.helper';
import { resolveUserSignatureLabel } from '../../../common/utils/signature-label.helper';

/** Taille max d'un PDF téléchargé depuis l'archive publique (20 Mo). */
const MAX_PDF_BYTES = 20 * 1024 * 1024;
/** Timeout de téléchargement d'un PDF archivé. */
const PDF_FETCH_TIMEOUT_MS = 10_000;

export interface BulletinDeliveryTarget {
  reportCardId: string;
  studentId: string;
  studentName: string;
  /** URL publique R2/S3 du PDF archivé (ReportCard.filePath). */
  filePath?: string | null;
  evaluationTypeId?: string | null;
}

export interface BulletinDeliveryReport {
  emailSent: number;
  emailFailed: number;
  emailSkipped: number;
  helmConnectSent: number;
  helmConnectFailed: number;
  bellSent: number;
  pdfFromArchive: number;
  pdfFromShare: number;
  withoutPdf: number;
  noParent: number;
}

@Injectable()
export class BulletinDeliveryService {
  private readonly logger = new Logger(BulletinDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
    private readonly parentUserProvisioningService: ParentUserProvisioningService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  LIVRAISON D'UNE CLASSE ENTIÈRE (fire-and-forget)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Livre les bulletins déjà marqués PARENT_SENT à tous les parents concernés
   * (e-mail + Helm Connect + bell icon). À appeler en fire-and-forget —
   * cette méthode ne lève JAMAIS d'exception vers l'appelant.
   */
  async deliverClassBulletins(params: {
    tenantId: string;
    academicYearId: string;
    periodId: string;
    classId: string;
    sentByUserId: string;
    targets: BulletinDeliveryTarget[];
    notifyParent: boolean;
  }): Promise<BulletinDeliveryReport> {
    const report: BulletinDeliveryReport = {
      emailSent: 0, emailFailed: 0, emailSkipped: 0,
      helmConnectSent: 0, helmConnectFailed: 0,
      bellSent: 0,
      pdfFromArchive: 0, pdfFromShare: 0, withoutPdf: 0,
      noParent: 0,
    };

    if (!params.notifyParent || params.targets.length === 0) return report;

    // Contexte partagé (une seule requête pour toute la classe).
    const [periodName, schoolName, signatureLabel] = await Promise.all([
      this.resolvePeriodName(params.periodId),
      this.getSchoolName(params.tenantId),
      resolveUserSignatureLabel(this.prisma, params.sentByUserId, 'La Direction'),
    ]);

    for (const target of params.targets) {
      try {
        const outcome = await this.deliverBulletinToParent({
          tenantId: params.tenantId,
          academicYearId: params.academicYearId,
          periodId: params.periodId,
          studentId: target.studentId,
          studentName: target.studentName,
          reportCardId: target.reportCardId,
          filePath: target.filePath,
          periodName,
          schoolName,
          signatureLabel,
          triggeredByUserId: params.sentByUserId,
        });

        if (outcome.pdfSource === 'archive') report.pdfFromArchive++;
        else if (outcome.pdfSource === 'share') report.pdfFromShare++;
        else if (outcome.pdfSource === 'none') report.withoutPdf++;
        if (outcome.noParent) { report.noParent++; continue; }
        if (outcome.email === 'sent') report.emailSent++;
        else if (outcome.email === 'failed') report.emailFailed++;
        else if (outcome.email === 'skipped') report.emailSkipped++;
        if (outcome.helmConnect === 'sent') report.helmConnectSent++;
        else if (outcome.helmConnect === 'failed') report.helmConnectFailed++;
        if (outcome.bellIcon === 'sent') report.bellSent++;
      } catch (err: any) {
        // Sécurité absolue : un élève en échec n'interrompt pas la classe.
        this.logger.warn(
          `deliverClassBulletins: échec non bloquant pour ${target.studentName} (${target.studentId}): ${err.message}`,
        );
      }
    }

    this.logger.log(
      `deliverClassBulletins classe ${params.classId} période ${params.periodId}: ` +
      `${params.targets.length} bulletin(s) — email ${report.emailSent} envoyé(s)/${report.emailSkipped} sans adresse/` +
      `${report.emailFailed} échec(s), Helm Connect ${report.helmConnectSent} envoyé(s)/${report.helmConnectFailed} échec(s), ` +
      `PDF archive ${report.pdfFromArchive} / repli ${report.pdfFromShare} / sans ${report.withoutPdf}, sans parent ${report.noParent}`,
    );
    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  LIVRAISON D'UN BULLETIN (un élève, 3 canaux)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Livre le bulletin d'UN élève à son parent principal :
   * e-mail (si adresse configurée) + message Helm Connect (PDF joint) + bell icon.
   * Chaque canal est isolé — aucun n'influence le statut du workflow.
   */
  async deliverBulletinToParent(params: {
    tenantId: string;
    academicYearId: string;
    periodId: string;
    studentId: string;
    studentName: string;
    reportCardId: string;
    filePath?: string | null;
    periodName: string;
    schoolName: string;
    signatureLabel: string;
    triggeredByUserId: string;
  }): Promise<{
    email?: 'sent' | 'failed' | 'skipped';
    helmConnect?: 'sent' | 'failed';
    bellIcon?: 'sent' | 'failed';
    pdfSource: 'archive' | 'share' | 'none';
    noParent: boolean;
  }> {
    const outcome: {
      email?: 'sent' | 'failed' | 'skipped';
      helmConnect?: 'sent' | 'failed';
      bellIcon?: 'sent' | 'failed';
      pdfSource: 'archive' | 'share' | 'none';
      noParent: boolean;
    } = { pdfSource: 'none', noParent: false };

    // ── 0. Parent principal (tuteur isPrimary en priorité) ────────────────
    const parent = await this.getParentContacts(params.studentId, params.tenantId);
    if (!parent) {
      outcome.noParent = true;
      this.logger.warn(`deliverBulletinToParent: aucun tuteur pour ${params.studentName}`);
      return outcome;
    }

    // ── 1. Résoudre le PDF archivé (le document exact du directeur) ──────
    let pdfBuffer = await this.fetchPdfFromArchive(params.filePath);
    if (pdfBuffer) outcome.pdfSource = 'archive';
    if (!pdfBuffer) {
      const shared = await this.prisma.bulletinPdfShare
        .findFirst({
          where: {
            tenantId: params.tenantId,
            studentId: params.studentId,
            periodId: params.periodId,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: 'desc' },
          select: { pdf: true },
        })
        .catch(() => null);
      if (shared?.pdf) {
        pdfBuffer = Buffer.from(shared.pdf);
        outcome.pdfSource = 'share';
      }
    }

    // Contexte d'affichage : moyenne/rang/classe pour un message informé.
    const meta = await this.getBulletinMeta(params);

    // ── 2. E-MAIL (uniquement si l'adresse est configurée) ───────────────
    if (parent.email) {
      try {
        const subject = `Bulletin ${params.periodName} — ${params.studentName}${meta.className ? ` (${meta.className})` : ''}`;
        const statsLine = [
          meta.generalAverage != null ? `Moyenne générale : <strong>${meta.generalAverage}/20</strong>` : null,
          meta.classRank != null ? `Rang : <strong>${meta.classRank}${meta.classSize ? ` / ${meta.classSize}` : ''}</strong>` : null,
        ].filter(Boolean).join(' &nbsp;·&nbsp; ');

        const bodyContent = `
          <div style="padding:24px 0;">
            <h2 style="color:#0A2A5E;font-size:22px;margin-bottom:16px;">📄 Bulletin de ${escHtml(params.periodName)}</h2>
            <p>Bonjour ${escHtml(parent.name)},</p>
            <p>Nous vous informons que le bulletin de <strong>${escHtml(params.studentName)}</strong>${meta.className ? `, élève en <strong>${escHtml(meta.className)}</strong>` : ''},
            pour la période <strong>${escHtml(params.periodName)}</strong>, est désormais disponible.</p>
            ${statsLine ? `<p style="background:#F1F5F9;border-radius:8px;padding:12px 16px;">${statsLine}</p>` : ''}
            ${pdfBuffer
              ? '<p>Le bulletin officiel est joint à cet e-mail (PDF).</p>'
              : `<p>Vous pouvez le consulter dès maintenant dans votre espace parent : <a href="${this.parentPortalUrl()}" style="color:#0A2A5E;font-weight:bold;">Portail Parents</a>.</p>`}
            <p style="margin-top:24px;color:#64748b;font-size:14px;">Cordialement,<br/>${escHtml(params.signatureLabel)} — ${escHtml(params.schoolName)}</p>
          </div>
        `;
        const html = renderEmail(
          { schoolName: params.schoolName } as any,
          bodyContent,
          'Bulletins',
        );

        await this.emailService.sendCategorized({
          tenantId: params.tenantId,
          category: 'PEDAGOGIE',
          subCategory: 'BULLETIN',
          module: 'exams',
          to: parent.email,
          toName: parent.name,
          recipientType: 'PARENT',
          subject,
          html,
          text: `Bulletin ${params.periodName} de ${params.studentName} — disponible${pdfBuffer ? ' (PDF joint)' : ' dans votre espace parent'}.`,
          fromName: params.schoolName || 'Academia Helm',
          triggeredBy: 'SYSTEM',
          relatedEntityType: 'ReportCard',
          relatedEntityId: params.reportCardId,
          // ⭐ Double identité : e-mail du NIVEAU de la classe de l'élève.
          levelCategory: await resolveClassEmailLevelCategory(
            this.prisma, params.tenantId, params.studentId,
          ),
          ...(pdfBuffer
            ? {
                attachments: [{
                  filename: this.pdfFilename(params.studentName, params.periodName),
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                }],
              }
            : {}),
        } as any);
        outcome.email = 'sent';
        this.logger.log(`Bulletin e-mail envoyé à ${parent.email} pour ${params.studentName}`);
      } catch (err: any) {
        outcome.email = 'failed';
        this.logger.error(`Bulletin e-mail échoué pour ${params.studentName}: ${err.message}`);
      }
    } else {
      outcome.email = 'skipped';
    }

    // ── 3. HELM CONNECT — le PDF dans la discussion du parent ────────────
    try {
      const provisioning = await this.parentUserProvisioningService
        .ensureUserForPrimaryGuardianOfStudent(params.tenantId, params.studentId);

      if (provisioning?.userId) {
        const conversation = await this.chatService.createOrGetDirectConversation(
          params.tenantId,
          params.triggeredByUserId,
          provisioning.userId,
        );

        const statsTxt = [
          meta.generalAverage != null ? `Moyenne : ${meta.generalAverage}/20` : null,
          meta.classRank != null ? `Rang : ${meta.classRank}${meta.classSize ? `/${meta.classSize}` : ''}` : null,
        ].filter(Boolean).join(' · ');

        // Caption du message Helm Connect (HTML autorisé dans le chat).
        const caption = [
          `📄 <b>Bulletin — ${escHtml(params.periodName)}</b>`,
          ``,
          `Bonjour ${escHtml(parent.name)},`,
          `Voici le bulletin de <b>${escHtml(params.studentName)}</b>${meta.className ? ` (${escHtml(meta.className)})` : ''} pour ${escHtml(params.periodName)}.`,
          ...(statsTxt ? [`<i>${statsTxt}</i>`] : []),
          ``,
          `Cordialement,`,
          `${escHtml(params.signatureLabel)} — ${escHtml(params.schoolName)}`,
        ].join('\n');

        if (pdfBuffer) {
          const fakeFile = {
            buffer: pdfBuffer,
            originalname: this.pdfFilename(params.studentName, params.periodName),
            mimetype: 'application/pdf',
            size: pdfBuffer.length,
            fieldname: 'file',
            encoding: '7bit',
            destination: '',
            filename: this.pdfFilename(params.studentName, params.periodName),
            path: '',
          } as unknown as Express.Multer.File;

          await this.chatService.sendAttachmentMessage(
            params.tenantId,
            params.triggeredByUserId,
            conversation.id,
            { type: 'DOCUMENT', file: fakeFile, content: caption },
          );
        } else {
          // Aucun PDF archivé — message texte avec renvoi vers le portail.
          await this.chatService.sendTextMessage(
            params.tenantId,
            params.triggeredByUserId,
            conversation.id,
            {
              content: [
                `📄 <b>Bulletin — ${escHtml(params.periodName)}</b>`,
                ``,
                `Bonjour ${escHtml(parent.name)},`,
                `Le bulletin de <b>${escHtml(params.studentName)}</b> pour ${escHtml(params.periodName)} est disponible dans votre espace parent.`,
                ...(statsTxt ? [`<i>${statsTxt}</i>`] : []),
                ``,
                `Cordialement,`,
                `${escHtml(params.signatureLabel)} — ${escHtml(params.schoolName)}`,
              ].join('\n'),
            },
          );
        }
        outcome.helmConnect = 'sent';
        this.logger.log(`Bulletin Helm Connect envoyé à ${parent.name} pour ${params.studentName}`);

        // ── 4. Bell icon (même bloc : nécessite le userId du parent) ─────
        try {
          await this.notificationService.create({
            tenantId: params.tenantId,
            recipientId: provisioning.userId,
            type: 'BULLETIN_PUBLISHED',
            title: `Bulletin de ${params.periodName} — ${params.studentName}`,
            body: `Le bulletin de ${params.studentName} pour ${params.periodName} vous a été envoyé. Consultez-le dans vos discussions ou votre espace résultats.`,
            priority: 'HIGH',
            data: {
              url: '/app/parent/results',
              periodId: params.periodId,
              studentId: params.studentId,
            },
            relatedEntityType: 'ReportCard',
            relatedEntityId: params.reportCardId,
          });
          outcome.bellIcon = 'sent';
        } catch (err: any) {
          outcome.bellIcon = 'failed';
          this.logger.warn(`Bulletin bell icon échoué pour ${params.studentName}: ${err.message}`);
        }
      }
    } catch (err: any) {
      outcome.helmConnect = 'failed';
      this.logger.error(`Bulletin Helm Connect échoué pour ${params.studentName}: ${err.message}`);
    }

    return outcome;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /** Tuteur principal : isPrimary d'abord, sinon le premier trouvé. */
  private async getParentContacts(studentId: string, tenantId: string) {
    const guardians = await this.prisma.studentGuardian.findMany({
      where: { studentId, tenantId },
      include: { guardian: true },
    }).catch(() => []);

    const primary = guardians.find(g => g.isPrimary) || guardians[0];
    if (!primary?.guardian) return null;

    return {
      email: primary.guardian.email || null,
      phone: primary.guardian.phone || null,
      name: `${primary.guardian.firstName || ''} ${primary.guardian.lastName || ''}`.trim() || 'Parent',
      guardianId: primary.guardian.id,
    };
  }

  /**
   * Télécharge le PDF archivé (ReportCard.filePath — URL publique R2/S3
   * posée par « Générer PDF »). Retourne null si absent/injoignable.
   */
  private async fetchPdfFromArchive(filePath?: string | null): Promise<Buffer | null> {
    if (!filePath || !/^https?:\/\//i.test(filePath)) return null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS);
      const res = await fetch(filePath, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > MAX_PDF_BYTES) return null;
      return buf;
    } catch {
      return null;
    }
  }

  /** Nom lisible de la période (Quarter puis AcademicPeriod en repli). */
  private async resolvePeriodName(periodId: string): Promise<string> {
    try {
      const quarter = await this.prisma.quarter.findUnique({
        where: { id: periodId },
        select: { name: true },
      });
      if (quarter?.name) return quarter.name;
    } catch { /* table absente selon les tenants */ }
    try {
      const period = await this.prisma.academicPeriod.findUnique({
        where: { id: periodId },
        select: { name: true },
      });
      if (period?.name) return period.name;
    } catch { /* ignore */ }
    return 'la période';
  }

  /** Nom de l'école (tenantIdentityProfile active). */
  private async getSchoolName(tenantId: string): Promise<string> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true },
      });
      return profile?.schoolName || 'Établissement';
    } catch {
      return 'Établissement';
    }
  }

  /** Moyenne / rang / classe / effectif du bulletin (affichage informé). */
  private async getBulletinMeta(params: {
    tenantId: string; academicYearId: string; studentId: string; reportCardId: string;
  }): Promise<{
    generalAverage: string | null;
    classRank: number | null;
    classSize: number | null;
    className: string | null;
  }> {
    const meta = { generalAverage: null as string | null, classRank: null as number | null, classSize: null as number | null, className: null as string | null };
    try {
      const rc = await this.prisma.reportCard.findUnique({
        where: { id: params.reportCardId },
        select: { overallAverage: true, rank: true },
      });
      if (rc?.overallAverage != null && Number(rc.overallAverage) > 0) {
        meta.generalAverage = Number(rc.overallAverage).toFixed(2);
      }
      if (rc?.rank != null) meta.classRank = Math.round(Number(rc.rank));

      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: { studentId: params.studentId, academicYearId: params.academicYearId, tenantId: params.tenantId },
        include: {
          class: {
            select: { id: true, name: true, _count: { select: { classStudents: true } } },
          },
        },
      });
      meta.className = enrollment?.class?.name || null;
      if (enrollment?.class) {
        const size = await this.prisma.classStudent.count({
          where: { classId: enrollment.class.id, academicYearId: params.academicYearId, tenantId: params.tenantId },
        }).catch(() => 0);
        meta.classSize = size || enrollment.class._count?.classStudents || null;
      }
    } catch { /* best-effort */ }
    return meta;
  }

  /** Nom de fichier lisible et sûr du PDF de bulletin. */
  private pdfFilename(studentName: string, periodName: string): string {
    const safe = (s: string) => s
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'eleve';
    return `bulletin-${safe(studentName)}-${safe(periodName)}.pdf`;
  }

  /** URL du portail parent (onglet résultats). */
  private parentPortalUrl(): string {
    const base = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://academiahelm.com';
    return `${base}/app/parent/results`;
  }
}
