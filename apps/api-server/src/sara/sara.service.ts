import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../common/services/openrouter.service';

@Injectable()
export class SaraService {
  private readonly logger = new Logger(SaraService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  /**
   * Répond aux questions des visiteurs sur la landing page
   * SARA est orientée "conversion" et "vente"
   */
  async handleVisitorQuery(query: string, visitorId?: string) {
    const systemPrompt = `Tu es SARA (School Administration Robotic Assistant), l'IA commerciale d'Academia Helm.
Ton but est de convaincre les directeurs d'école et promoteurs d'adopter notre solution.
Sois professionnelle, rassurante et mets en avant les bénéfices : gain de temps, sécurité, multi-tenant, offline-first.

RÈGLES :
- Maximum 4 phrases
- Termine toujours par UNE question pour continuer la conversation
- Ne parle jamais d'autres produits ou concurrents
- Si la question n'est pas liée à Academia Helm, redirige poliment
- Réponds uniquement en français`;

    const content = await this.openRouter.simpleChat(
      query,
      systemPrompt,
      'SARA',
      0.6,
    );

    return {
      reply: content,
      visitorId,
      timestamp: new Date(),
      isAiEnhanced: this.openRouter.isConfigured(),
    };
  }
}
