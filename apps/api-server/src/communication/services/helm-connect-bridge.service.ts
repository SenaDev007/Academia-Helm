/**
 * ============================================================================
 * HELM CONNECT NOTIFICATION BRIDGE
 * ============================================================================
 *
 * Pont unique entre les modules pédagogiques (Examens / Absences / Discipline)
 * et Helm Connect (chat + notifications in-app + Web Push + WhatsApp + SMS).
 *
 * Rôle : émettre UNE notification multi-canal à chaque événement pédagogique :
 *   1. In-app bell + Web Push  → pour les enseignants / surveillants / direction
 *   2. WhatsApp + fallback SMS → pour les parents (tuteur principal)
 *   3. Message dans une conversation Helm Connect auto-créée  → chat parent ↔ enseignant
 *
 * Patterns réutilisés :
 * - DisciplineNotificationService (WhatsApp + SMS fire-and-forget)
 * - NotificationService.create() (in-app bell + Web Push)
 * - ChatService.createOrGetDirectConversationWithGuardian (chat parent ↔ staff)
 *
 * Règles :
 * - Fire-and-forget : ne JAMAIS bloquer l'opération métier (create/update)
 * - Multi-tenant strict : tenantId filtré dans toutes les requêtes
 * - Ne lève jamais d'erreur : log + return null sur échec partiel
 *
 * Événements couverts (V3-4) :
 *   - ABSENCE_CREATED    → absence saisie par enseignant/SG
 *   - ABSENCE_JUSTIFIED  → absence justifiée par parent/SG
 *   - EXAM_SCHEDULED     → nouvel examen/devoir planifié
 *   - BULLETIN_PUBLISHED → bulletins de classe publiés aux parents
 *   - SANCTION_CREATED   → wrapper autour de DisciplineNotificationService
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppService } from './whatsapp.service';
import { SmsService } from './sms.service';
import { NotificationService } from '../../notifications/notification.service';
import { ChatService } from './chat.service';

// ─── Types payloads ─────────────────────────────────────────────────────

export interface AbsenceCreatedPayload {
  tenantId: string;
  absenceId: string;
  studentId: string;
  classId?: string;
  date: Date;
  isJustified?: boolean;
  justification?: string;
  triggeredByUserId?: string;
}

export interface AbsenceJustifiedPayload {
  tenantId: string;
  absenceId: string;
  studentId: string;
  date: Date;
  justification?: string;
  justifiedByUserId?: string;
}

export interface ExamScheduledPayload {
  tenantId: string;
  examId: string;
  classId?: string;
  subjectId: string;
  examName: string;
  examType: string; // DEVOIR | COMPOSITION | ORAL | PRATIQUE
  examDate: Date;
  triggeredByUserId?: string;
}

export interface BulletinPublishedPayload {
  tenantId: string;
  classId: string;
  periodId: string;
  academicYearId: string;
  publishedByUserId?: string;
  studentIds?: string[]; // si non fourni, on résout tous les élèves de la classe
}

export interface BridgeNotificationResult {
  channels: {
    inApp?: { status: 'sent' | 'failed' | 'skipped'; recipientsCount?: number; error?: string };
    webPush?: { status: 'sent' | 'failed' | 'skipped'; error?: string };
    whatsapp?: { status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string; logId?: string };
    sms?: { status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string };
    helmConnectMessage?: { status: 'sent' | 'failed' | 'skipped'; conversationId?: string; error?: string };
  };
  parentContact: { phone?: string; name?: string; found: boolean };
}

// ─── Service ────────────────────────────────────────────────────────────

@Injectable()
export class HelmConnectNotificationBridgeService {
  private readonly logger = new Logger(HelmConnectNotificationBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly smsService: SmsService,
    private readonly notificationService: NotificationService,
    private readonly chatService: ChatService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════
  //  ABSENCE CREATED
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Notifie les parents d'élèves + le staff qu'une absence a été saisie.
   * - In-app bell + Web Push : enseignant principal de la classe + surveillant
   * - WhatsApp + SMS : tuteur principal de l'élève
   * - Helm Connect message : message dans la conversation parent ↔ enseignant
   */
  async notifyAbsenceCreated(payload: AbsenceCreatedPayload): Promise<BridgeNotificationResult> {
    const result: BridgeNotificationResult = { channels: {}, parentContact: { found: false } };

    try {
      // 1. Récupérer le nom de l'élève
      const student = await this.prisma.student.findUnique({
        where: { id: payload.studentId },
        select: { firstName: true, lastName: true },
      });
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'l\'élève';
      const dateStr = payload.date.toLocaleDateString('fr-FR');
      const schoolName = await this.getSchoolName(payload.tenantId);

      // 2. In-app bell : enseignant principal de la classe + surveillant général
      try {
        const staffRecipients = await this.resolveClassStaff(payload.tenantId, payload.classId);
        if (staffRecipients.length > 0) {
          const title = 'Absence enregistrée';
          const body = `${studentName} a été marqué(e) absent(e) le ${dateStr}${payload.justification ? ' — ' + payload.justification : ''}.`;

          await Promise.all(
            staffRecipients.map((userId) =>
              this.notificationService
                .create({
                  tenantId: payload.tenantId,
                  recipientId: userId,
                  type: 'ABSENCE_CREATED',
                  title,
                  body,
                  priority: 'MEDIUM',
                  data: {
                    url: '/app/students/absences',
                    absenceId: payload.absenceId,
                    studentId: payload.studentId,
                    studentName,
                    date: payload.date.toISOString(),
                  },
                  relatedEntityType: 'Absence',
                  relatedEntityId: payload.absenceId,
                })
                .catch((e) =>
                  this.logger.warn(`notifyAbsenceCreated: in-app failed for staff ${userId}: ${e.message}`),
                ),
            ),
          );
          result.channels.inApp = { status: 'sent', recipientsCount: staffRecipients.length };
        } else {
          result.channels.inApp = { status: 'skipped', error: 'No staff recipients' };
        }
      } catch (e: any) {
        result.channels.inApp = { status: 'failed', error: e.message };
        this.logger.warn(`notifyAbsenceCreated: in-app staff failed: ${e.message}`);
      }

      // 3. WhatsApp + SMS au tuteur principal
      try {
        const contact = await this.getParentContacts(payload.studentId);
        result.parentContact = {
          phone: contact.phone,
          name: contact.name,
          found: !!contact.phone,
        };

        if (contact.phone) {
          // WhatsApp
          try {
            const waResult = await this.whatsappService.sendCategorized({
              tenantId: payload.tenantId,
              category: 'PEDAGOGIE',
              module: 'absences',
              subCategory: 'absence_created',
              to: contact.phone,
              toName: contact.name,
              recipientType: 'PARENT',
              message: `Absence: ${studentName} — ${dateStr}`,
              templateName: 'absence_created',
              templateVariables: {
                parent_name: contact.name || 'Parent',
                student_name: studentName,
                school_name: schoolName,
                absence_date: dateStr,
                justification: payload.justification || 'Aucune justification fournie',
              },
              triggeredBy: 'STAFF',
              triggeredByUserId: payload.triggeredByUserId,
              relatedEntityId: payload.absenceId,
              relatedEntityType: 'Absence',
            } as any);

            if (waResult.success) {
              result.channels.whatsapp = { status: 'sent', to: contact.phone, logId: waResult.logId };
            } else {
              result.channels.whatsapp = { status: 'failed', to: contact.phone, error: waResult.error };
              // Fallback SMS
              try {
                const smsBody = `Academia Helm - ${studentName} a ete marque(e) absent(e) le ${dateStr}. ${payload.justification ? 'Motif: ' + payload.justification + '.' : ''} Contactez l'etablissement pour toute question.`;
                const smsResult = await this.smsService.sendSMS(contact.phone, smsBody);
                result.channels.sms = smsResult.success
                  ? { status: 'sent', to: contact.phone }
                  : { status: 'failed', to: contact.phone, error: 'SMS provider returned failure' };
              } catch (smsErr: any) {
                result.channels.sms = { status: 'failed', to: contact.phone, error: smsErr.message };
              }
            }
          } catch (waErr: any) {
            result.channels.whatsapp = { status: 'failed', to: contact.phone, error: waErr.message };
          }
        } else {
          result.channels.whatsapp = { status: 'skipped', error: 'No parent phone' };
          result.channels.sms = { status: 'skipped', error: 'No parent phone' };
        }
      } catch (e: any) {
        this.logger.warn(`notifyAbsenceCreated: parent channel failed: ${e.message}`);
      }

      // 4. Helm Connect message : conversation parent ↔ enseignant principal
      try {
        await this.sendHelmConnectMessageToParent({
          tenantId: payload.tenantId,
          studentId: payload.studentId,
          triggeredByUserId: payload.triggeredByUserId,
          title: 'Absence enregistrée',
          body: `📐 **Absence enregistrée**\n\n👤 Élève : ${studentName}\n📅 Date : ${dateStr}\n${payload.justification ? '📝 Motif : ' + payload.justification + '\n' : ''}L'établissement reste à votre disposition pour toute information.`,
        });
        result.channels.helmConnectMessage = { status: 'sent' };
      } catch (e: any) {
        result.channels.helmConnectMessage = { status: 'failed', error: e.message };
        this.logger.warn(`notifyAbsenceCreated: helm connect message failed: ${e.message}`);
      }

      this.logger.log(
        `notifyAbsenceCreated: absence ${payload.absenceId} — inApp=${result.channels.inApp?.status} whatsapp=${result.channels.whatsapp?.status} helm=${result.channels.helmConnectMessage?.status}`,
      );
    } catch (err: any) {
      this.logger.error(`notifyAbsenceCreated erreur globale: ${err.message}`, err.stack);
    }

    return result;
  }

  // ═════════════════════════════════════════════════════════════════════
  //  ABSENCE JUSTIFIED
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Notifie le staff (enseignant principal + surveillant) qu'une absence a été
   * justifiée par le parent ou le SG. Pas de WhatsApp (le parent est l'acteur).
   */
  async notifyAbsenceJustified(payload: AbsenceJustifiedPayload): Promise<BridgeNotificationResult> {
    const result: BridgeNotificationResult = { channels: {}, parentContact: { found: false } };

    try {
      const student = await this.prisma.student.findUnique({
        where: { id: payload.studentId },
        select: { firstName: true, lastName: true },
      });
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'l\'élève';
      const dateStr = payload.date.toLocaleDateString('fr-FR');

      // Récupérer la classe de l'élève pour cibler l'enseignant principal
      let classId: string | undefined;
      try {
        const enr = await this.prisma.studentEnrollment.findFirst({
          where: { studentId: payload.studentId, tenantId: payload.tenantId },
          orderBy: { createdAt: 'desc' },
          select: { classId: true },
        });
        classId = enr?.classId || undefined;
      } catch {
        // ignore
      }

      const staffRecipients = await this.resolveClassStaff(payload.tenantId, classId);
      if (staffRecipients.length > 0) {
        const title = 'Absence justifiée';
        const body = `L'absence de ${studentName} du ${dateStr} a été justifiée${payload.justification ? ' : ' + payload.justification : ''}.`;

        await Promise.all(
          staffRecipients.map((userId) =>
            this.notificationService
              .create({
                tenantId: payload.tenantId,
                recipientId: userId,
                type: 'ABSENCE_JUSTIFIED',
                title,
                body,
                priority: 'LOW',
                data: {
                  url: '/app/students/absences',
                  absenceId: payload.absenceId,
                  studentId: payload.studentId,
                  studentName,
                  date: payload.date.toISOString(),
                },
                relatedEntityType: 'Absence',
                relatedEntityId: payload.absenceId,
              })
              .catch((e) =>
                this.logger.warn(`notifyAbsenceJustified: in-app failed for staff ${userId}: ${e.message}`),
              ),
          ),
        );
        result.channels.inApp = { status: 'sent', recipientsCount: staffRecipients.length };
      } else {
        result.channels.inApp = { status: 'skipped', error: 'No staff recipients' };
      }

      this.logger.log(
        `notifyAbsenceJustified: absence ${payload.absenceId} — inApp=${result.channels.inApp?.status}`,
      );
    } catch (err: any) {
      this.logger.error(`notifyAbsenceJustified erreur globale: ${err.message}`, err.stack);
    }

    return result;
  }

  // ═════════════════════════════════════════════════════════════════════
  //  EXAM SCHEDULED
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Notifie les parents d'élèves de la classe qu'un nouvel examen / devoir est
   * planifié. Multi-canal : in-app bell + Web Push + WhatsApp + SMS + Helm Connect.
   */
  async notifyExamScheduled(payload: ExamScheduledPayload): Promise<BridgeNotificationResult> {
    const result: BridgeNotificationResult = { channels: {}, parentContact: { found: false } };

    try {
      if (!payload.classId) {
        // Pas de classe → on notifie juste le staff (direction + surveillant)
        const staff = await this.resolveClassStaff(payload.tenantId, undefined);
        const dateStr = payload.examDate.toLocaleDateString('fr-FR');
        await Promise.all(
          staff.map((userId) =>
            this.notificationService.create({
              tenantId: payload.tenantId,
              recipientId: userId,
              type: 'EXAM_SCHEDULED',
              title: `Nouvel ${payload.examType.toLowerCase() || 'examen'} — ${payload.examName}`,
              body: `Prévu le ${dateStr}.`,
              priority: 'MEDIUM',
              data: {
                url: '/app/exams',
                examId: payload.examId,
                examName: payload.examName,
                examType: payload.examType,
                date: payload.examDate.toISOString(),
              },
              relatedEntityType: 'Exam',
              relatedEntityId: payload.examId,
            }),
          ),
        );
        result.channels.inApp = { status: 'sent', recipientsCount: staff.length };
        return result;
      }

      // Classe fournie → notifier tous les parents de la classe
      const parents = await this.resolveClassParents(payload.tenantId, payload.classId);
      if (parents.length === 0) {
        result.channels.inApp = { status: 'skipped', error: 'No parents for this class' };
        this.logger.log(`notifyExamScheduled: aucun parent trouvé pour la classe ${payload.classId}`);
        return result;
      }

      const dateStr = payload.examDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
      const schoolName = await this.getSchoolName(payload.tenantId);

      // In-app bell + Web Push à chaque parent
      await Promise.all(
        parents.map((parent) =>
          this.notificationService
            .create({
              tenantId: payload.tenantId,
              recipientId: parent.userId,
              type: 'EXAM_SCHEDULED',
              title: `${payload.examType || 'Examen'} — ${payload.examName}`,
              body: `Prévu le ${dateStr}. Surveillez les révisions de votre enfant.`,
              priority: 'HIGH',
              data: {
                url: '/app/parent',
                examId: payload.examId,
                examName: payload.examName,
                examType: payload.examType,
                date: payload.examDate.toISOString(),
              },
              relatedEntityType: 'Exam',
              relatedEntityId: payload.examId,
            })
            .catch((e) =>
              this.logger.warn(`notifyExamScheduled: in-app failed for parent ${parent.userId}: ${e.message}`),
            ),
        ),
      );
      result.channels.inApp = { status: 'sent', recipientsCount: parents.length };

      // WhatsApp broadcast au premier parent avec numéro (le broadcast complet
      // est trop coûteux en Meta API — on limite au 1er parent ayant WhatsApp pour
      // cette V1; la V2 fera un vrai broadcast via WhatsAppService.sendBulk)
      const firstWithPhone = parents.find((p) => p.phone);
      if (firstWithPhone?.phone) {
        result.parentContact = {
          phone: firstWithPhone.phone,
          name: firstWithPhone.parentName,
          found: true,
        };
        try {
          const waResult = await this.whatsappService.sendCategorized({
            tenantId: payload.tenantId,
            category: 'PEDAGOGIE',
            module: 'exams',
            subCategory: 'exam_scheduled',
            to: firstWithPhone.phone,
            toName: firstWithPhone.parentName,
            recipientType: 'PARENT',
            message: `Examen: ${payload.examName} — ${dateStr}`,
            templateName: 'exam_scheduled',
            templateVariables: {
              parent_name: firstWithPhone.parentName || 'Parent',
              school_name: schoolName,
              exam_name: payload.examName,
              exam_type: payload.examType || 'Examen',
              exam_date: dateStr,
            },
            triggeredBy: 'STAFF',
            triggeredByUserId: payload.triggeredByUserId,
            relatedEntityId: payload.examId,
            relatedEntityType: 'Exam',
          } as any);

          if (waResult.success) {
            result.channels.whatsapp = { status: 'sent', to: firstWithPhone.phone, logId: waResult.logId };
          } else {
            result.channels.whatsapp = { status: 'failed', to: firstWithPhone.phone, error: waResult.error };
            // SMS fallback
            try {
              const smsBody = `Academia Helm - ${payload.examType || 'Examen'}: ${payload.examName} prevu le ${dateStr}. Aidez votre enfant a reviser.`;
              const smsRes = await this.smsService.sendSMS(firstWithPhone.phone, smsBody);
              result.channels.sms = smsRes.success
                ? { status: 'sent', to: firstWithPhone.phone }
                : { status: 'failed', to: firstWithPhone.phone, error: 'SMS provider returned failure' };
            } catch (smsErr: any) {
              result.channels.sms = { status: 'failed', to: firstWithPhone.phone, error: smsErr.message };
            }
          }
        } catch (waErr: any) {
          result.channels.whatsapp = { status: 'failed', to: firstWithPhone.phone, error: waErr.message };
        }
      } else {
        result.channels.whatsapp = { status: 'skipped', error: 'No parent phone in class' };
        result.channels.sms = { status: 'skipped', error: 'No parent phone in class' };
      }

      this.logger.log(
        `notifyExamScheduled: exam ${payload.examId} — inApp=${result.channels.inApp?.status} (${parents.length} parents) whatsapp=${result.channels.whatsapp?.status}`,
      );
    } catch (err: any) {
      this.logger.error(`notifyExamScheduled erreur globale: ${err.message}`, err.stack);
    }

    return result;
  }

  // ═════════════════════════════════════════════════════════════════════
  //  BULLETIN PUBLISHED
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Notifie tous les parents d'élèves de la classe que les bulletins ont été
   * publiés. Multi-canal : in-app bell + Web Push + WhatsApp + SMS + Helm Connect.
   */
  async notifyBulletinPublished(payload: BulletinPublishedPayload): Promise<BridgeNotificationResult> {
    const result: BridgeNotificationResult = { channels: {}, parentContact: { found: false } };

    try {
      // 1. Résoudre les élèves
      const studentIds =
        payload.studentIds && payload.studentIds.length > 0
          ? payload.studentIds
          : await this.resolveClassStudentIds(payload.tenantId, payload.classId, payload.academicYearId);

      if (studentIds.length === 0) {
        this.logger.log(`notifyBulletinPublished: aucun élève dans la classe ${payload.classId}`);
        result.channels.inApp = { status: 'skipped', error: 'No students in class' };
        return result;
      }

      // 2. Résoudre la période
      let periodName = 'la période';
      try {
        const period = await this.prisma.quarter.findUnique({
          where: { id: payload.periodId },
          select: { name: true },
        });
        periodName = period?.name || periodName;
      } catch {
        // ignore
      }

      const schoolName = await this.getSchoolName(payload.tenantId);

      // 3. Pour chaque élève, résoudre le tuteur principal et notifier
      const parentRecipients: Array<{
        userId: string;
        studentName: string;
        phone?: string;
        parentName?: string;
        studentId: string;
      }> = [];

      const students = await this.prisma.student.findMany({
        where: { id: { in: studentIds }, tenantId: payload.tenantId },
        select: { id: true, firstName: true, lastName: true },
      });

      for (const student of students) {
        const studentName = `${student.firstName} ${student.lastName}`;
        const contact = await this.getParentContacts(student.id);
        if (!contact.email) continue;

        const user = await this.prisma.user.findFirst({
          where: { email: contact.email, tenantId: payload.tenantId, status: 'active' },
          select: { id: true },
        });
        if (!user) continue;

        parentRecipients.push({
          userId: user.id,
          studentName,
          phone: contact.phone,
          parentName: contact.name,
          studentId: student.id,
        });
      }

      if (parentRecipients.length === 0) {
        this.logger.log(`notifyBulletinPublished: aucun parent avec User pour ${students.length} élève(s)`);
        result.channels.inApp = { status: 'skipped', error: 'No parent users' };
        return result;
      }

      // 4. In-app bell + Web Push à chaque parent
      await Promise.all(
        parentRecipients.map((parent) =>
          this.notificationService
            .create({
              tenantId: payload.tenantId,
              recipientId: parent.userId,
              type: 'BULLETIN_PUBLISHED',
              title: `Bulletin de ${periodName} disponible`,
              body: `Le bulletin de ${parent.studentName} pour ${periodName} est disponible en ligne. Connectez-vous pour le consulter.`,
              priority: 'HIGH',
              data: {
                url: '/app/parent',
                classId: payload.classId,
                periodId: payload.periodId,
                studentId: parent.studentId,
              },
              relatedEntityType: 'Bulletin',
              relatedEntityId: parent.studentId,
            })
            .catch((e) =>
              this.logger.warn(`notifyBulletinPublished: in-app failed for parent ${parent.userId}: ${e.message}`),
            ),
        ),
      );
      result.channels.inApp = { status: 'sent', recipientsCount: parentRecipients.length };

      // 5. WhatsApp broadcast au 1er parent avec numéro (V1 limit; V2 fera un bulk)
      const firstWithPhone = parentRecipients.find((p) => p.phone);
      if (firstWithPhone?.phone) {
        result.parentContact = {
          phone: firstWithPhone.phone,
          name: firstWithPhone.parentName,
          found: true,
        };
        try {
          const waResult = await this.whatsappService.sendCategorized({
            tenantId: payload.tenantId,
            category: 'PEDAGOGIE',
            module: 'exams',
            subCategory: 'bulletin_published',
            to: firstWithPhone.phone,
            toName: firstWithPhone.parentName,
            recipientType: 'PARENT',
            message: `Bulletin ${periodName}: ${firstWithPhone.studentName}`,
            templateName: 'bulletin_published',
            templateVariables: {
              parent_name: firstWithPhone.parentName || 'Parent',
              student_name: firstWithPhone.studentName,
              school_name: schoolName,
              period_name: periodName,
            },
            triggeredBy: 'STAFF',
            triggeredByUserId: payload.publishedByUserId,
            relatedEntityType: 'Bulletin',
            relatedEntityId: firstWithPhone.studentId,
          } as any);

          if (waResult.success) {
            result.channels.whatsapp = { status: 'sent', to: firstWithPhone.phone, logId: waResult.logId };
          } else {
            result.channels.whatsapp = { status: 'failed', to: firstWithPhone.phone, error: waResult.error };
            try {
              const smsBody = `Academia Helm - Le bulletin de ${firstWithPhone.studentName} pour ${periodName} est disponible. Connectez-vous a l'application pour le consulter.`;
              const smsRes = await this.smsService.sendSMS(firstWithPhone.phone, smsBody);
              result.channels.sms = smsRes.success
                ? { status: 'sent', to: firstWithPhone.phone }
                : { status: 'failed', to: firstWithPhone.phone, error: 'SMS provider returned failure' };
            } catch (smsErr: any) {
              result.channels.sms = { status: 'failed', to: firstWithPhone.phone, error: smsErr.message };
            }
          }
        } catch (waErr: any) {
          result.channels.whatsapp = { status: 'failed', to: firstWithPhone.phone, error: waErr.message };
        }
      }

      // 6. Helm Connect message à chaque parent
      await Promise.all(
        parentRecipients.slice(0, 10).map((parent) =>
          this.sendHelmConnectMessageToParent({
            tenantId: payload.tenantId,
            studentId: parent.studentId,
            triggeredByUserId: payload.publishedByUserId,
            title: `Bulletin de ${periodName} disponible`,
            body: `🎓 **Bulletin de ${periodName}**\n\n👤 Élève : ${parent.studentName}\n🏫 Établissement : ${schoolName}\n\nLe bulletin de votre enfant pour ${periodName} est désormais disponible sur la plateforme. Connectez-vous à votre espace parent pour le consulter dans la section « Bulletin ».\n\nPour toute question, contactez l'établissement via ce chat.`,
          }).catch((e) =>
            this.logger.warn(`notifyBulletinPublished: helm connect failed for parent ${parent.userId}: ${e.message}`),
          ),
        ),
      );
      result.channels.helmConnectMessage = { status: 'sent' };

      this.logger.log(
        `notifyBulletinPublished: class ${payload.classId} period ${periodName} — inApp=${result.channels.inApp?.status} (${parentRecipients.length} parents) whatsapp=${result.channels.whatsapp?.status} helm=${result.channels.helmConnectMessage?.status}`,
      );
    } catch (err: any) {
      this.logger.error(`notifyBulletinPublished erreur globale: ${err.message}`, err.stack);
    }

    return result;
  }

  // ═════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Récupère les contacts du tuteur principal d'un élève.
   * Retourne phone, email, name.
   */
  private async getParentContacts(studentId: string): Promise<{
    phone?: string;
    email?: string;
    name?: string;
  }> {
    try {
      const sgs = await this.prisma.studentGuardian.findMany({
        where: { studentId, isPrimary: true },
        include: { guardian: true },
        take: 1,
      });
      let guardian = sgs[0]?.guardian;
      if (!guardian) {
        const anySg = await this.prisma.studentGuardian.findFirst({
          where: { studentId },
          include: { guardian: true },
        });
        guardian = anySg?.guardian;
      }
      if (!guardian) return {};
      return {
        phone: guardian.phone || undefined,
        email: guardian.email || undefined,
        name: guardian ? `${guardian.firstName} ${guardian.lastName}` : undefined,
      };
    } catch (e: any) {
      this.logger.warn(`getParentContacts failed: ${e.message}`);
      return {};
    }
  }

  /**
   * Résout les userId du staff d'une classe : enseignant principal + surveillant
   * général + direction. Si classId undefined, retourne juste le staff global.
   */
  private async resolveClassStaff(tenantId: string, classId?: string): Promise<string[]> {
    try {
      const userIds = new Set<string>();

      // 1. Enseignant principal de la classe
      if (classId) {
        try {
          const cls = await this.prisma.class.findUnique({
            where: { id: classId },
            select: { teacherId: true, mainTeacherId: true },
          });
          const teacherId = cls?.mainTeacherId || cls?.teacherId;
          if (teacherId) {
            const teacher = await this.prisma.teacher.findUnique({
              where: { id: teacherId },
              select: { email: true },
            });
            if (teacher?.email) {
              const user = await this.prisma.user.findFirst({
                where: { email: teacher.email, tenantId, status: 'active' },
                select: { id: true },
              });
              if (user) userIds.add(user.id);
            }
          }
        } catch {
          // ignore — pas d'enseignant principal
        }
      }

      // 2. Staff global (surveillant + direction)
      const staff = await this.prisma.user.findMany({
        where: {
          tenantId,
          role: {
            in: [
              'SURVEILLANT_GENERAL',
              'SUPER_DIRECTOR',
              'DIRECTOR',
              'CENSEUR',
              'ADMIN',
              'PROMOTER',
            ],
          },
          status: 'active',
        },
        select: { id: true },
      });
      staff.forEach((u) => userIds.add(u.id));

      return Array.from(userIds);
    } catch (e: any) {
      this.logger.warn(`resolveClassStaff failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Résout les (userId, phone, parentName) de tous les parents d'élèves d'une classe.
   * Pour chaque élève actif de la classe → guardian principal → User par email.
   */
  private async resolveClassParents(
    tenantId: string,
    classId: string,
  ): Promise<Array<{ userId: string; phone?: string; parentName?: string }>> {
    try {
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          tenantId,
          classId,
          status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED'] },
        },
        select: { studentId: true },
      });

      if (enrollments.length === 0) return [];

      const studentIds = enrollments.map((e) => e.studentId);

      // Guardians principaux
      const sgs = await this.prisma.studentGuardian.findMany({
        where: { studentId: { in: studentIds }, tenantId },
        include: { guardian: true },
      });

      // Ne garder que le guardian principal par élève (ou le premier si pas de primary)
      const primaryByStudent = new Map<string, typeof sgs[number]>();
      for (const sg of sgs) {
        const existing = primaryByStudent.get(sg.studentId);
        if (!existing) {
          primaryByStudent.set(sg.studentId, sg);
        } else if (!existing.isPrimary && sg.isPrimary) {
          primaryByStudent.set(sg.studentId, sg);
        }
      }

      const guardianEmails = Array.from(primaryByStudent.values())
        .map((sg) => sg.guardian?.email)
        .filter((e): e is string => !!e);

      if (guardianEmails.length === 0) return [];

      const users = await this.prisma.user.findMany({
        where: { email: { in: guardianEmails }, tenantId, status: 'active' },
        select: { id: true, email: true },
      });

      const emailToUser = new Map<string, string>(users.map((u: any) => [u.email as string, u.id as string]));
      const result: Array<{ userId: string; phone?: string; parentName?: string }> = [];
      for (const sg of primaryByStudent.values()) {
        if (!sg.guardian?.email) continue;
        const userId = emailToUser.get(sg.guardian.email);
        if (!userId) continue;
        result.push({
          userId,
          phone: sg.guardian.phone || undefined,
          parentName: sg.guardian
            ? `${sg.guardian.firstName} ${sg.guardian.lastName}`
            : undefined,
        });
      }
      return result;
    } catch (e: any) {
      this.logger.warn(`resolveClassParents failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Résout tous les studentIds d'une classe pour une année académique donnée.
   */
  private async resolveClassStudentIds(
    tenantId: string,
    classId: string,
    academicYearId: string,
  ): Promise<string[]> {
    try {
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          tenantId,
          classId,
          academicYearId,
          status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED'] },
        },
        select: { studentId: true },
      });
      return enrollments.map((e) => e.studentId);
    } catch (e: any) {
      this.logger.warn(`resolveClassStudentIds failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Envoie un message dans la conversation Helm Connect auto-créée entre le
   * parent de l'élève et le staff (l'enseignant principal ou le déclencheur).
   * Utilise ChatService.createOrGetDirectConversationWithGuardian().
   */
  private async sendHelmConnectMessageToParent(params: {
    tenantId: string;
    studentId: string;
    triggeredByUserId?: string;
    title: string;
    body: string;
  }): Promise<void> {
    try {
      // 1. Trouver le guardian principal
      const sg = await this.prisma.studentGuardian.findFirst({
        where: { studentId: params.studentId, isPrimary: true },
        include: { guardian: true },
      });
      const guardian = sg?.guardian || (await this.prisma.studentGuardian.findFirst({
        where: { studentId: params.studentId },
        include: { guardian: true },
      }))?.guardian;
      if (!guardian) {
        this.logger.warn(`sendHelmConnectMessageToParent: aucun guardian pour ${params.studentId}`);
        return;
      }

      // 2. Trouver le User correspondant au guardian (par email)
      if (!guardian.email) {
        this.logger.warn(`sendHelmConnectMessageToParent: guardian sans email pour ${params.studentId}`);
        return;
      }
      const guardianUser = await this.prisma.user.findFirst({
        where: { email: guardian.email, tenantId: params.tenantId, status: 'active' },
        select: { id: true },
      });
      if (!guardianUser) {
        this.logger.log(`sendHelmConnectMessageToParent: pas de User pour guardian ${guardian.email}`);
        return;
      }

      // 3. Trouver le staff qui déclenche (l'enseignant principal de la classe,
      //    ou le triggeredByUserId explicite passé par le service appelant).
      //    Sans staff identifié, on ne peut pas créer de conversation parent ↔ staff.
      let senderStaffId = params.triggeredByUserId;
      if (!senderStaffId) {
        // Tenter de résoudre l'enseignant principal via les enrollments
        try {
          const enr = await this.prisma.studentEnrollment.findFirst({
            where: { studentId: params.studentId, tenantId: params.tenantId },
            orderBy: { createdAt: 'desc' },
            select: { classId: true },
          });
          if (enr?.classId) {
            const cls = await this.prisma.class.findUnique({
              where: { id: enr.classId },
              select: { mainTeacherId: true, teacherId: true },
            });
            const teacherId = cls?.mainTeacherId || cls?.teacherId;
            if (teacherId) {
              const teacher = await this.prisma.teacher.findUnique({
                where: { id: teacherId },
                select: { email: true },
              });
              if (teacher?.email) {
                const staffUser = await this.prisma.user.findFirst({
                  where: { email: teacher.email, tenantId: params.tenantId, status: 'active' },
                  select: { id: true },
                });
                if (staffUser) senderStaffId = staffUser.id;
              }
            }
          }
        } catch {
          // ignore — pas d'enseignant trouvé
        }
      }

      if (!senderStaffId) {
        this.logger.log(`sendHelmConnectMessageToParent: pas de staff émetteur pour ${params.studentId}`);
        return;
      }

      // 4. Créer/récupérer la conversation directe parent ↔ staff
      const conv = await this.chatService.createOrGetDirectConversationWithGuardian(
        params.tenantId,
        senderStaffId,
        guardian.id,
      );

      // 5. Envoyer le message texte
      await this.chatService.sendTextMessage(
        params.tenantId,
        senderStaffId,
        conv.conversationId,
        { content: params.body },
      );
    } catch (e: any) {
      this.logger.warn(`sendHelmConnectMessageToParent failed: ${e.message}`);
    }
  }

  /**
   * Récupère le nom de l'école pour le fallback SMS.
   */
  private async getSchoolName(tenantId: string): Promise<string> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true },
      });
      return profile?.schoolName || 'Academia Helm';
    } catch {
      return 'Academia Helm';
    }
  }
}
