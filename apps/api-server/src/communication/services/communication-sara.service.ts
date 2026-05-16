import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CommunicationSaraService {
  private readonly logger = new Logger(CommunicationSaraService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ANTHROPIC_API_KEY') || this.configService.get<string>('OPENAI_API_KEY');
  }

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
    
    const systemPrompt = `Tu es SARA, l'assistant intelligent d'Academia Helm. 
    Ta mission est d'aider les administrateurs scolaires à rédiger des communications claires, efficaces et professionnelles.
    Audience : ${targetAudience}. Ton : ${tone}. Langue : ${language}.`;

    const userPrompt = `Rédige un message pour : ${intent}. 
    Points clés à inclure : ${keyPoints.join(', ')}.`;

    const draftedContent = await this.callAI(userPrompt, systemPrompt);

    return {
      content: draftedContent,
      suggestions: [
        "Ajouter une signature institutionnelle",
        "Inclure un lien vers le portail de paiement",
        "Préciser la date limite"
      ]
    };
  }

  /**
   * Refines existing content to improve clarity or tone
   */
  async refineContent(content: string, instruction: string) {
    const systemPrompt = "Tu es SARA. Améliore le texte suivant selon l'instruction fournie.";
    const userPrompt = `Texte original : "${content}"\nInstruction : ${instruction}`;

    const refinedContent = await this.callAI(userPrompt, systemPrompt);

    return {
      original: content,
      refined: refinedContent
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
        fallback: 'WHATSAPP'
      };
    }
    
    if (messageType === 'PEDAGOGICAL' || messageType === 'GENERAL') {
      return {
        channel: 'PORTAL',
        reason: 'Moins intrusif et permet un contenu riche (images, documents).',
        fallback: 'EMAIL'
      };
    }

    return {
      channel: 'EMAIL',
      reason: 'Standard pour les communications administratives et financières.',
      fallback: 'PORTAL'
    };
  }

  private async callAI(prompt: string, systemPrompt: string): Promise<string> {
    if (!this.apiKey) {
      // Return a high-quality template if no API key is available
      return `[SARA AI - Mode Template] \n\nCher(s) ${prompt.includes('parent') ? 'Parents' : 'Membres du personnel'},\n\nNous vous contactons concernant ${prompt}. \n\nNous restons à votre disposition pour toute information complémentaire.\n\nCordialement,\nLa Direction.`;
    }

    // In a real implementation, we would call Anthropic or OpenAI here.
    // For this demonstration, we'll return a simulated high-fidelity response.
    return `[SARA AI] Voici une proposition de rédaction :\n\nObjet : Communication Importante - Academia Hub\n\nMadame, Monsieur,\n\nNous tenons à vous informer que ${prompt}. \n\nCette mesure vise à garantir la continuité de nos services et l'excellence académique de notre établissement.\n\nNous vous remercions de votre confiance.\n\nL'administration d'Academia Helm.`;
  }
}
