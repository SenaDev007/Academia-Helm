/**
 * ============================================================================
 * PEDAGOGICAL NOTIFICATION SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour notifications événementielles SMS/WhatsApp/Email
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PedagogicalNotificationService {
  private readonly logger = new Logger(PedagogicalNotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Notifie la direction lors d'une soumission de document
   */
  async notifySubmission(documentId: string, tenantId: string) {
    try {
      const document = await this.prisma.pedagogicalDocument.findFirst({
        where: { id: documentId, tenantId },
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!document) {
        throw new Error(`Document with ID ${documentId} not found`);
      }

      // Récupérer les directeurs du tenant/niveau
      const directors = await this.prisma.user.findMany({
        where: {
          tenantId,
          role: { in: ['DIRECTOR', 'ADMIN'] },
          status: 'active',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      if (directors.length === 0) {
        this.logger.warn(`No directors found for tenant ${tenantId}`);
        return;
      }

      // Type de document en français
      const documentTypeNames = {
        FICHE_PEDAGOGIQUE: 'Fiche pédagogique',
        CAHIER_JOURNAL: 'Cahier journal',
        CAHIER_TEXTE: 'Cahier de textes',
        SEMAINIER: 'Cahier du semainier',
      };

      const documentTypeName = documentTypeNames[document.documentType] || document.documentType;

      // Message pour notification
      const message = `📚 Nouvelle soumission pédagogique\n\n` +
        `Type: ${documentTypeName}\n` +
        `Titre: ${document.title}\n` +
        `Enseignant: ${document.teacher.firstName} ${document.teacher.lastName}\n` +
        (document.class ? `Classe: ${document.class.name}\n` : '') +
        (document.subject ? `Matière: ${document.subject.name}\n` : '') +
        `\nConnectez-vous à Academia Hub pour valider.`;

      // Créer les notifications pour chaque directeur
      const notifications = await Promise.allSettled(
        directors.map(async (director) => {
          // Créer la notification dans la base
          const notification = await this.prisma.pedagogicalDocumentNotification.create({
            data: {
              tenantId: document.tenantId,
              academicYearId: document.academicYearId,
              schoolLevelId: document.schoolLevelId,
              documentId,
              recipientId: director.id,
              notificationType: 'SUBMISSION',
              title: `Nouvelle soumission: ${documentTypeName}`,
              message,
            },
          });

          // Note: User n'a pas de champ phone dans le schéma Prisma
          // Les notifications SMS/WhatsApp doivent utiliser un autre mécanisme
          // Pour l'instant, on envoie uniquement par email

          // Envoyer Email si email disponible
          if (director.email) {
            try {
              await this.sendEmail(director.email, `Nouvelle soumission: ${documentTypeName}`, message);
              await this.prisma.pedagogicalDocumentNotification.update({
                where: { id: notification.id },
                data: {
                  emailSent: true,
                  emailSentAt: new Date(),
                },
              });
            } catch (error) {
              this.logger.error(`Failed to send email to ${director.email}:`, error);
            }
          }

          return notification;
        }),
      );

      this.logger.log(`Sent submission notifications for document ${documentId} to ${directors.length} directors`);
    } catch (error) {
      this.logger.error(`Error sending submission notification for document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Notifie l'enseignant après validation/rejet
   */
  async notifyValidation(
    documentId: string,
    tenantId: string,
    decision: 'APPROVED' | 'REJECTED' | 'ACKNOWLEDGED',
    comments?: string,
  ) {
    try {
      const document = await this.prisma.pedagogicalDocument.findFirst({
        where: { id: documentId, tenantId },
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          validator: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          acknowledger: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!document || !document.teacher) {
        throw new Error(`Document or teacher not found for document ${documentId}`);
      }

      const documentTypeNames = {
        FICHE_PEDAGOGIQUE: 'Fiche pédagogique',
        CAHIER_JOURNAL: 'Cahier journal',
        CAHIER_TEXTE: 'Cahier de textes',
        SEMAINIER: 'Cahier du semainier',
      };

      const documentTypeName = documentTypeNames[document.documentType] || document.documentType;
      const validatorName = document.validator || document.acknowledger;

      let title = '';
      let message = '';

      if (decision === 'APPROVED') {
        title = `✅ Validation: ${documentTypeName}`;
        message = `Bonjour ${document.teacher.firstName},\n\n` +
          `Votre ${documentTypeName.toLowerCase()} "${document.title}" a été validée par ${validatorName?.firstName} ${validatorName?.lastName}.\n` +
          (comments ? `Commentaires:\n${comments}\n\n` : '') +
          `Connectez-vous à Academia Hub pour consulter.`;
      } else if (decision === 'REJECTED') {
        title = `❌ Rejet: ${documentTypeName}`;
        message = `Bonjour ${document.teacher.firstName},\n\n` +
          `Votre ${documentTypeName.toLowerCase()} "${document.title}" a été rejetée par ${validatorName?.firstName} ${validatorName?.lastName}.\n` +
          `Motif: ${document.rejectionReason || 'Non spécifié'}\n` +
          (comments ? `Commentaires:\n${comments}\n\n` : '') +
          `Veuillez consulter Academia Hub pour plus de détails et modifier si nécessaire.`;
      } else if (decision === 'ACKNOWLEDGED') {
        title = `✓ Prise en compte: ${documentTypeName}`;
        message = `Bonjour ${document.teacher.firstName},\n\n` +
          `Votre ${documentTypeName.toLowerCase()} "${document.title}" a été prise en compte par ${validatorName?.firstName} ${validatorName?.lastName}.\n` +
          (comments ? `Commentaires:\n${comments}\n\n` : '') +
          `Connectez-vous à Academia Hub pour consulter.`;
      }

      // Créer la notification
      const notification = await this.prisma.pedagogicalDocumentNotification.create({
        data: {
          tenantId: document.tenantId,
          academicYearId: document.academicYearId,
          schoolLevelId: document.schoolLevelId,
          documentId,
          recipientId: document.teacher.id,
          notificationType: decision === 'APPROVED' ? 'VALIDATION' : decision === 'REJECTED' ? 'REJECTION' : 'ACKNOWLEDGMENT',
          title,
          message,
        },
      });

      // Envoyer SMS
      if (document.teacher.phone) {
        try {
          await this.sendSMS(document.teacher.phone, message);
          await this.prisma.pedagogicalDocumentNotification.update({
            where: { id: notification.id },
            data: {
              smsSent: true,
              smsSentAt: new Date(),
            },
          });
        } catch (error) {
          this.logger.error(`Failed to send SMS to ${document.teacher.phone}:`, error);
        }
      }

      // Envoyer WhatsApp
      if (document.teacher.phone) {
        try {
          await this.sendWhatsApp(document.teacher.phone, message);
          await this.prisma.pedagogicalDocumentNotification.update({
            where: { id: notification.id },
            data: {
              whatsappSent: true,
              whatsappSentAt: new Date(),
            },
          });
        } catch (error) {
          this.logger.error(`Failed to send WhatsApp to ${document.teacher.phone}:`, error);
        }
      }

      // Envoyer Email
      if (document.teacher.email) {
        try {
          await this.sendEmail(document.teacher.email, title, message);
          await this.prisma.pedagogicalDocumentNotification.update({
            where: { id: notification.id },
            data: {
              emailSent: true,
              emailSentAt: new Date(),
            },
          });
        } catch (error) {
          this.logger.error(`Failed to send email to ${document.teacher.email}:`, error);
        }
      }

      this.logger.log(`Sent ${decision} notification for document ${documentId} to teacher ${document.teacher.id}`);
    } catch (error) {
      this.logger.error(`Error sending validation notification for document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Notifie lors d'un nouveau commentaire
   */
  async notifyComment(
    documentId: string,
    tenantId: string,
    commentId: string,
    authorRole: 'TEACHER' | 'DIRECTOR',
  ) {
    try {
      const comment = await this.prisma.pedagogicalDocumentComment.findFirst({
        where: { id: commentId, documentId },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          document: {
            include: {
              teacher: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      if (!comment || !comment.document) {
        throw new Error(`Comment or document not found for comment ${commentId}`);
      }

      // Déterminer le destinataire (opposé de l'auteur)
      let recipientId: string;
      if (authorRole === 'TEACHER') {
        // Si c'est l'enseignant qui commente, notifier la direction
        const directors = await this.prisma.user.findMany({
          where: {
            tenantId,
            role: { in: ['DIRECTOR', 'ADMIN'] },
            status: 'active',
          },
          select: { id: true },
        });
        recipientId = directors[0]?.id;
      } else {
        // Si c'est la direction qui commente, notifier l'enseignant
        recipientId = comment.document.teacherId || '';
      }

      if (!recipientId) {
        this.logger.warn(`No recipient found for comment notification ${commentId}`);
        return;
      }

      const recipient = await this.prisma.user.findUnique({
        where: { id: recipientId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      if (!recipient) {
        this.logger.warn(`Recipient ${recipientId} not found`);
        return;
      }

      const title = `💬 Nouveau commentaire sur "${comment.document.title}"`;
      const message = `${authorRole === 'TEACHER' ? 'L\'enseignant' : 'La direction'} ${comment.author.firstName} ${comment.author.lastName} a ajouté un commentaire:\n\n${comment.comment}\n\nConnectez-vous à Academia Hub pour répondre.`;

      // Créer la notification
      const notification = await this.prisma.pedagogicalDocumentNotification.create({
        data: {
          tenantId: comment.document.tenantId,
          academicYearId: comment.document.academicYearId,
          schoolLevelId: comment.document.schoolLevelId,
          documentId,
          recipientId,
          notificationType: 'COMMENT',
          title,
          message,
        },
      });

      // Note: User n'a pas de champ phone dans le schéma Prisma
      // Les notifications SMS/WhatsApp doivent utiliser un autre mécanisme
      // Pour l'instant, on envoie uniquement par email

      this.logger.log(`Sent comment notification for document ${documentId}`);
    } catch (error) {
      this.logger.error(`Error sending comment notification:`, error);
      throw error;
    }
  }

  /**
   * Envoie un SMS (à implémenter selon le fournisseur)
   */
  private async sendSMS(phone: string, message: string): Promise<void> {
    this.logger.log(`[SMS] Would send to ${phone}: ${message.substring(0, 50)}...`);
    // Pour l'instant, juste log
  }

  /**
   * Envoie un WhatsApp (à implémenter selon le fournisseur)
   */
  private async sendWhatsApp(phone: string, message: string): Promise<void> {
    this.logger.log(`[WhatsApp] Would send to ${phone}: ${message.substring(0, 50)}...`);
    // Pour l'instant, juste log
  }

  /**
   * Envoie un Email (à implémenter selon le service)
   */
  private async sendEmail(email: string, subject: string, message: string): Promise<void> {
    this.logger.log(`[Email] Would send to ${email}: ${subject}`);
    // Pour l'instant, juste log
  }

  /**
   * Marque une notification comme lue
   */
  async markNotificationAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.pedagogicalDocumentNotification.findFirst({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification) {
      throw new Error(`Notification ${notificationId} not found for user ${userId}`);
    }

    return this.prisma.pedagogicalDocumentNotification.update({
      where: { id: notificationId },
      data: {
        inAppRead: true,
        inAppReadAt: new Date(),
      },
    });
  }

  /**
   * Récupère les notifications non lues d'un utilisateur
   */
  async getUnreadNotifications(userId: string, tenantId: string) {
    return this.prisma.pedagogicalDocumentNotification.findMany({
      where: {
        recipientId: userId,
        tenantId,
        inAppRead: false,
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            documentType: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

