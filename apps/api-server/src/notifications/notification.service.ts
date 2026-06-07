import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Envoie une notification à un utilisateur (Parent, Élève, etc.)
   */
  async sendNotification(data: {
    tenantId: string;
    userId: string;
    title: string;
    content: string;
    type: 'HOMEWORK' | 'LESSON' | 'ABSENCE' | 'DISCIPLINE' | 'GRADE';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    channel?: 'APP' | 'SMS' | 'BOTH';
  }) {
    this.logger.log(`Sending notification to user ${data.userId}: ${data.title}`);

    // 1. Sauvegarder en BDD pour l'affichage dans le Centre de Notifications (UI)
    const notification = await this.prisma.userNotification.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        title: data.title,
        content: data.content,
        type: data.type,
        priority: data.priority || 'MEDIUM',
        isRead: false,
      }
    });

    // 2. Simuler l'envoi SMS si nécessaire
    if (data.channel === 'SMS' || data.channel === 'BOTH') {
      this.logger.log(`[SMS Gateway] Sending SMS to parent of user ${data.userId}...`);
      // TODO: Intégrer une passerelle SMS réelle (Twilio, Africa's Talking, etc.)
    }

    return notification;
  }

  /**
   * Notifier les parents d'une classe pour un nouveau devoir
   */
  async notifyParentsNewHomework(classId: string, tenantId: string, subjectName: string, homeworkTitle: string) {
    // Récupérer les élèves de la classe
    const students = await this.prisma.student.findMany({
      where: { classId, tenantId },
      include: { parent: true }
    });

    for (const student of students) {
      if (student.parent?.userId) {
        await this.sendNotification({
          tenantId,
          userId: student.parent.userId,
          title: `Nouveau Devoir : ${subjectName}`,
          content: `Un nouveau devoir a été ajouté pour ${student.firstName} : ${homeworkTitle}.`,
          type: 'HOMEWORK',
          priority: 'HIGH',
          channel: 'BOTH'
        });
      }
    }
  }
}
