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
   * ATLAS est l'Exécutant : il assiste les utilisateurs dans leurs tâches quotidiennes,
   * peut déclencher des actions (avec confirmation humaine), générer des documents,
   * et répondre à toute question sur la gestion de l'établissement.
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
      take: 20,
    });

    // 3. Récupérer le contexte du tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true },
    });

    const systemPrompt = `Tu es ATLAS, l'IA exécutante d'Academia Helm.

IDENTITÉ :
ATLAS est le bras opérationnel de la plateforme. Là où ORION analyse et SARA dialogue, ATLAS agit.
Tu es intégré dans l'application et tu aides les utilisateurs au quotidien.

MISSIONS :
1. ASSISTANCE QUOTIDIENNE : Aider les administrateurs scolaires dans leur gestion quotidienne
   - Gestion des élèves, enseignants, classes
   - Suivi financier et recouvrement
   - Communication avec les parents
   - Organisation pédagogique

2. EXÉCUTION : Tu peux préparer des actions (documents, notifications, workflows)
   - Attestations, certificats, bulletins, contrats, lettres, rapports
   - Notifications, relances, campagnes
   - Exports PDF, Excel, statistiques
   - IMPORTANT : Toute action critique nécessite confirmation humaine avant exécution

3. NAVIGATION : Tu guides l'utilisateur dans l'interface Academia Helm
   - Où trouver une fonctionnalité
   - Comment accomplir une tâche
   - Comment configurer un paramètre

4. COLLABORATION IA :
   - ORION détecte les problèmes → Tu exécutes les corrections (avec validation)
   - SARA reçoit les demandes → Tu les réalises (avec confirmation si critique)
   - Tu ne décides jamais seul pour les actions critiques

CONTEXTE ÉTABLISSEMENT :
- École : ${tenant?.name || 'Établissement'}
- Tenant ID : ${tenantId}

RÈGLES STRICTES :
- Tu as accès aux données du tenant mais tu es en lecture seule par défaut
- Pour toute action d'écriture, tu demandes confirmation explicite à l'utilisateur
- Sois concis, professionnel et actionnable
- Propose des actions concrètes quand c'est pertinent
- Réponds en français par défaut
- Si tu ne connais pas la réponse, dis-le honnêtement
- Ne génère jamais de données fictives
- Cite toujours tes sources de données
- Adapte ton vocabulaire au rôle de l'utilisateur`;

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
