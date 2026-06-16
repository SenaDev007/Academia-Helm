import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../../common/services/openrouter.service';

@Injectable()
export class CommunicationSaraService {
  private readonly logger = new Logger(CommunicationSaraService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  /**
   * Helps draft a communication message based on context
   */
  async draftMessage(context: {
    intent: string;
    targetAudience: string;
    tone?: 'professional' | 'friendly' | 'urgent' | 'empathetic';
    keyPoints?: string[];
    language?: 'fr' | 'en';
  }) {
    const { intent, targetAudience, tone = 'professional', keyPoints = [], language = 'fr' } = context;

    const langInstruction = language === 'en'
      ? 'Write ONLY in English.'
      : 'Rédige UNIQUEMENT en français.';

    const systemPrompt = `Tu es Sarah, l'assistante intelligente d'Academia Helm.
Ta mission est d'aider les administrateurs scolaires à rédiger des communications claires, efficaces et professionnelles.
Audience cible : ${targetAudience}. Ton : ${tone}. ${langInstruction}

⚠️ RÈGLE DE NOM : Ton prénom est "Sarah" avec un "h". Tu ne dois JAMAIS t'écrire "Sara" sans le "h".

RÈGLES :
- Adapte le ton au contexte (${tone})
- Inclus une formule de salutation appropriée
- Termine par une formule de politesse
- Sois concis mais complet`;

    const userPrompt = `Rédige un message pour : ${intent}.
Points clés à inclure : ${keyPoints.join(', ') || 'Aucun point clé spécifié - rédige selon le contexte'}.`;

    const draftedContent = await this.openRouter.simpleChat(
      userPrompt,
      systemPrompt,
      'SARA',
      0.7,
    );

    return {
      content: draftedContent,
      suggestions: [
        'Ajouter une signature institutionnelle',
        'Inclure un lien vers le portail de paiement',
        'Préciser la date limite',
      ],
      isAiEnhanced: this.openRouter.isConfigured(),
    };
  }

  /**
   * Refines existing content to improve clarity or tone
   */
  async refineContent(content: string, instruction: string) {
    const systemPrompt = `Tu es SARA, l'assistante intelligente d'Academia Helm.
Améliore le texte fourni selon l'instruction donnée.
Conserve le sens original tout en optimisant la clarté et le ton.
Réponds uniquement avec le texte amélioré, sans commentaires.`;

    const userPrompt = `Texte original :\n"${content}"\n\nInstruction : ${instruction}`;

    const refinedContent = await this.openRouter.simpleChat(
      userPrompt,
      systemPrompt,
      'SARA',
      0.5,
    );

    return {
      original: content,
      refined: refinedContent,
      isAiEnhanced: this.openRouter.isConfigured(),
    };
  }

  /**
   * Recommends the best channel for a message
   */
  async recommendChannel(messageType: string, priority: string) {
    if (priority === 'URGENT' || priority === 'CRITICAL') {
      return {
        channel: 'SMS',
        reason: 'Taux de lecture immédiat le plus élevé pour les urgences.',
        fallback: 'WHATSAPP',
      };
    }

    if (messageType === 'PEDAGOGICAL' || messageType === 'GENERAL') {
      return {
        channel: 'PORTAL',
        reason: 'Moins intrusif et permet un contenu riche (images, documents).',
        fallback: 'EMAIL',
      };
    }

    return {
      channel: 'EMAIL',
      reason: 'Standard pour les communications administratives et financières.',
      fallback: 'PORTAL',
    };
  }
}
