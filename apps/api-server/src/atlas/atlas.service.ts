import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OpenRouterService } from '../common/services/openrouter.service';

@Injectable()
export class AtlasService {
  private readonly logger = new Logger(AtlasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouter: OpenRouterService,
  ) {}

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

    // 2. Récupérer l'historique récent pour le contexte
    const history = await this.prisma.atlasMessage.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'asc' },
      take: 20, // Derniers 20 messages pour le contexte
    });

    // 3. Appeler l'IA via OpenRouter
    const systemPrompt = `Tu es ATLAS, l'assistant IA d'Academia Helm intégré dans l'application.
Tu aides les administrateurs scolaires dans leur quotidien :
- Gestion des élèves, enseignants, classes
- Suivi financier et recouvrement
- Communication avec les parents
- Organisation pédagogique

RÈGLES :
- Tu as accès aux données du tenant mais tu es en lecture seule
- Sois concis et professionnel
- Propose des actions concrètes quand c'est pertinent
- Réponds en français par défaut
- Si tu ne connais pas la réponse, dis-le honnêtement`;

    // Construire les messages avec l'historique
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Ajouter l'historique (max 10 messages précédents)
    const recentHistory = history.slice(-11, -1); // Exclure le message qu'on vient de sauvegarder
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    // Ajouter le message actuel
    messages.push({ role: 'user', content: message });

    const response = await this.openRouter.chat({
      messages,
      temperature: 0.6,
      maxTokens: 800,
      persona: 'ATLAS',
    });

    // 4. Sauvegarder la réponse de l'IA
    const savedResponse = await this.prisma.atlasMessage.create({
      data: {
        tenantId,
        userId,
        content: response.content,
        role: 'assistant',
      },
    });

    return savedResponse;
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
