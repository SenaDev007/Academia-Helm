import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SaraService {
  private readonly logger = new Logger(SaraService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
  }

  /**
   * Répond aux questions des visiteurs sur la landing page
   */
  async handleVisitorQuery(query: string, visitorId?: string) {
    // SARA est orientée "conversion" et "vente"
    const systemPrompt = `Tu es SARA (School Administration Robotic Assistant), l'IA commerciale d'Academia Helm. 
    Ton but est de convaincre les directeurs d'école et promoteurs d'adopter notre solution. 
    Sois professionnelle, rassurante et mets en avant les bénéfices : gain de temps, sécurité, multi-tenant, offline-first.`;

    const response = await this.callClaude(query, systemPrompt);
    
    return {
      reply: response,
      visitorId,
      timestamp: new Date(),
    };
  }

  private async callClaude(prompt: string, systemPrompt: string): Promise<string> {
    if (!this.apiKey) {
      return "Bonjour ! Je suis SARA. Academia Helm est la solution complète pour votre école. Souhaitez-vous une démonstration ?";
    }
    // Simulation d'appel
    return `[SARA AI] Merci pour votre intérêt pour Academia Helm. Concernant "${prompt}", notre solution permet justement de résoudre ce point grâce à notre architecture moderne. Souhaitez-vous voir nos tarifs ?`;
  }
}
