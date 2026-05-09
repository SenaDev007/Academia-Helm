import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AtlasService {
  private readonly logger = new Logger(AtlasService.name);
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
  }

  /**
   * Envoie un message à l'IA ATLAS
   */
  async sendMessage(tenantId: string, userId: string, message: string) {
    // 1. Sauvegarder le message de l'utilisateur
    await this.prisma.atlasMessage.create({
      data: {
        tenantId,
        userId,
        content: message,
        role: 'user',
      },
    });

    // 2. Appeler l'API Anthropic (Simulé pour l'instant ou implémenté avec fetch)
    // En production, utiliser le SDK @anthropic-ai/sdk
    const responseContent = await this.callClaude(message);

    // 3. Sauvegarder la réponse de l'IA
    const response = await this.prisma.atlasMessage.create({
      data: {
        tenantId,
        userId,
        content: responseContent,
        role: 'assistant',
      },
    });

    return response;
  }

  /**
   * Simule un appel à Claude API
   */
  private async callClaude(prompt: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY not configured. ATLAS will return mock responses.');
      return "Désolé, mon moteur d'intelligence artificielle n'est pas encore configuré.";
    }

    // Ici on implémenterait l'appel réel
    return `[ATLAS AI] J'ai bien reçu votre message : "${prompt}". Comment puis-je vous aider davantage dans la gestion de votre établissement ?`;
  }

  /**
   * Récupère l'historique de conversation
   */
  async getHistory(tenantId: string, userId: string) {
    return this.prisma.atlasMessage.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }
}
