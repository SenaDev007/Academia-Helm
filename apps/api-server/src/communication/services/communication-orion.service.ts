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

    // 3. Campaign Performance Anomalies (MEDIUM)
    const campaignAlerts = await this.detectCampaignAnomalies(tenantId);
    alerts.push(...campaignAlerts);

    // 4. Low Engagement for Critical Notifications (MEDIUM)
    const engagementAlerts = await this.detectLowEngagement(tenantId);
    alerts.push(...engagementAlerts);

    return alerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private async detectChannelFailures(tenantId: string, since: Date): Promise<OrionCommunicationAlert[]> {
    const alerts: OrionCommunicationAlert[] = [];
    const channels = ['EMAIL', 'SMS', 'WHATSAPP'];

    for (const channel of channels) {
      const failed = await this.prisma.communicationRecipient.count({
        where: { tenantId, channel: channel as any, deliveryStatus: 'FAILED', createdAt: { gte: since } }
      });
      const total = await this.prisma.communicationRecipient.count({
        where: { tenantId, channel: channel as any, createdAt: { gte: since } }
      });

      if (total > 10 && (failed / total) > 0.3) {
        alerts.push({
          severity: 'CRITICAL',
          category: `CHANNEL_DOWN_${channel}`,
          title: `Panne critique détectée : ${channel}`,
          description: `Le canal ${channel} présente un taux d'échec de ${(failed / total * 100).toFixed(1)}% sur les dernières 24h.`,
          recommendation: `Vérifiez la configuration du fournisseur et le solde de crédit. Envisagez de basculer vers un canal de secours.`,
          count: failed,
          timestamp: new Date()
        });
      }
    }
    return alerts;
  }

  private async detectLowDeliveryRates(tenantId: string, since: Date): Promise<OrionCommunicationAlert[]> {
    const alerts: OrionCommunicationAlert[] = [];
    const totalSent = await this.prisma.communicationRecipient.count({
      where: { tenantId, createdAt: { gte: since } }
    });
    const totalDelivered = await this.prisma.communicationRecipient.count({
      where: { tenantId, deliveryStatus: 'DELIVERED', createdAt: { gte: since } }
    });

    if (totalSent > 50 && (totalDelivered / totalSent) < 0.85) {
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

  private async detectCampaignAnomalies(tenantId: string): Promise<OrionCommunicationAlert[]> {
    const alerts: OrionCommunicationAlert[] = [];
    const failedCampaigns = await this.prisma.communicationCampaign.findMany({
      where: { tenantId, status: 'FAILED' },
      take: 3,
      orderBy: { updatedAt: 'desc' }
    });

    for (const campaign of failedCampaigns) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'CAMPAIGN_FAILED',
        title: `Échec de campagne : ${campaign.name}`,
        description: `La campagne "${campaign.name}" s'est arrêtée prématurément.`,
        recommendation: 'Analysez les journaux d\'erreurs de la campagne et relancez les destinataires restants.',
        timestamp: campaign.updatedAt
      });
    }
    return alerts;
  }

  private async detectLowEngagement(tenantId: string): Promise<OrionCommunicationAlert[]> {
    const alerts: OrionCommunicationAlert[] = [];
    // Example: Critical notifications not read after 12h
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const unreadCritical = await this.prisma.communicationRecipient.count({
      where: {
        tenantId,
        message: { priority: 'CRITICAL' },
        readAt: null,
        deliveryStatus: 'DELIVERED',
        createdAt: { lt: twelveHoursAgo, gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
      }
    });

    if (unreadCritical > 5) {
      alerts.push({
        severity: 'MEDIUM',
        category: 'LOW_CRITICAL_ENGAGEMENT',
        title: 'Alertes critiques non consultées',
        description: `${unreadCritical} notifications critiques n'ont pas encore été lues après 12h.`,
        recommendation: 'Utilisez le rappel par SMS ou appel vocal pour les informations urgentes.',
        count: unreadCritical,
        timestamp: new Date()
      });
    }
    return alerts;
  }
}
