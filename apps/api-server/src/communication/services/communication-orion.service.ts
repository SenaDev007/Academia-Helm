import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface OrionCommunicationAlert {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  recommendation?: string;
  count?: number;
  timestamp: Date;
}

@Injectable()
export class CommunicationOrionService {
  private readonly logger = new Logger(CommunicationOrionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates communication-specific ORION alerts
   */
  async generateAlerts(tenantId: string): Promise<OrionCommunicationAlert[]> {
    const alerts: OrionCommunicationAlert[] = [];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Channel Failure Detection (CRITICAL)
    const channelFailures = await this.detectChannelFailures(tenantId, twentyFourHoursAgo);
    alerts.push(...channelFailures);

    // 2. Low Delivery Rate Detection (HIGH)
    const lowDeliveryAlerts = await this.detectLowDeliveryRates(tenantId, twentyFourHoursAgo);
    alerts.push(...lowDeliveryAlerts);

    // 3. Low Engagement for Critical Notifications (MEDIUM)
    const engagementAlerts = await this.detectLowEngagement(tenantId);
    alerts.push(...engagementAlerts);

    return alerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private async detectChannelFailures(tenantId: string, since: Date): Promise<OrionCommunicationAlert[]> {
    const alerts: OrionCommunicationAlert[] = [];

    // Check for failed recipients via messageRecipient (using status field, not channel+deliveryStatus)
    const failedRecipients = await this.prisma.messageRecipient.count({
      where: { tenantId, status: 'FAILED', createdAt: { gte: since } }
    });
    const totalRecipients = await this.prisma.messageRecipient.count({
      where: { tenantId, createdAt: { gte: since } }
    });

    if (totalRecipients > 10 && failedRecipients / totalRecipients > 0.3) {
      alerts.push({
        severity: 'CRITICAL',
        category: 'HIGH_FAILURE_RATE',
        title: 'Taux d\'échec élevé détecté',
        description: `Le taux d'échec est de ${(failedRecipients / totalRecipients * 100).toFixed(1)}% sur les dernières 24h (${failedRecipients}/${totalRecipients}).`,
        recommendation: 'Vérifiez la configuration des canaux et le solde de crédit. Envisagez de basculer vers un canal de secours.',
        count: failedRecipients,
        timestamp: new Date()
      });
    }

    return alerts;
  }

  private async detectLowDeliveryRates(tenantId: string, since: Date): Promise<OrionCommunicationAlert[]> {
    const alerts: OrionCommunicationAlert[] = [];
    const totalSent = await this.prisma.messageRecipient.count({
      where: { tenantId, createdAt: { gte: since } }
    });
    const totalDelivered = await this.prisma.messageRecipient.count({
      where: { tenantId, status: 'DELIVERED', createdAt: { gte: since } }
    });

    if (totalSent > 50 && totalDelivered / totalSent < 0.85) {
      alerts.push({
        severity: 'HIGH',
        category: 'LOW_DELIVERY_RATE',
        title: 'Baisse significative de la joignabilité',
        description: `Seulement ${(totalDelivered / totalSent * 100).toFixed(1)}% des messages ont été livrés avec succès.`,
        recommendation: 'Nettoyez la base de données des contacts (numéros invalides, emails erronés) ou changez de plage horaire d\'envoi.',
        count: totalSent - totalDelivered,
        timestamp: new Date()
      });
    }
    return alerts;
  }

  private async detectLowEngagement(tenantId: string): Promise<OrionCommunicationAlert[]> {
    const alerts: OrionCommunicationAlert[] = [];
    // Check for unread messages older than 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const unreadCritical = await this.prisma.messageRecipient.count({
      where: {
        tenantId,
        readAt: null,
        status: 'DELIVERED',
        createdAt: { lt: twelveHoursAgo, gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      }
    });

    if (unreadCritical > 5) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'LOW_ENGAGEMENT',
        title: 'Messages non consultés',
        description: `${unreadCritical} messages n'ont pas encore été lus après 12h.`,
        recommendation: 'Utilisez le rappel par SMS ou appel vocal pour les informations urgentes.',
        count: unreadCritical,
        timestamp: new Date()
      });
    }
    return alerts;
  }
}
