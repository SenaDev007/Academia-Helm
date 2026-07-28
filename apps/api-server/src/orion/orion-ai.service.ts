/**
 * ============================================================================
 * ORION AI SERVICE — Intelligence artificielle propulsée par GLM-5.2
 * ============================================================================
 *
 * Service backend qui connecte ORION au modèle GLM-5.2 ZAI via l'API NVIDIA
 * (integrate.api.nvidia.com/v1 — endpoint OpenAI-compatible).
 *
 * Permet à ORION d'analyser les données de l'établissement en langage naturel.
 *
 * Fonctionnalités :
 *   - Chat naturel avec ORION (questions/réponses sur les données)
 *   - Analyse prédictive (alertes, recommandations)
 *   - Génération de rapports
 *   - Disponible dans toute l'application via widget flottant
 *
 * Endpoint : POST /api/orion/chat
 * Body : { message: string, context?: any }
 *
 * Variables d'environnement (priorité NVIDIA_* > OPENROUTER_*) :
 *   - NVIDIA_API_KEY  / OPENROUTER_API_KEY : Clé API NVIDIA
 *   - NVIDIA_MODEL     / OPENROUTER_MODEL  : Modèle (défaut: z-ai/glm-5.2)
 *   - NVIDIA_BASE_URL  / OPENROUTER_BASE_URL : URL base (défaut: https://integrate.api.nvidia.com/v1)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OrionAiService {
  private readonly logger = new Logger(OrionAiService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // ⭐ Migration vers NVIDIA GLM-5.2 — priorité NVIDIA_* > OPENROUTER_*
    this.apiKey =
      this.configService.get<string>('NVIDIA_API_KEY') ||
      this.configService.get<string>('OPENROUTER_API_KEY') ||
      '';
    this.model =
      this.configService.get<string>('NVIDIA_MODEL') ||
      this.configService.get<string>('OPENROUTER_MODEL') ||
      'z-ai/glm-5.2';
    this.baseUrl =
      this.configService.get<string>('NVIDIA_BASE_URL') ||
      this.configService.get<string>('OPENROUTER_BASE_URL') ||
      'https://integrate.api.nvidia.com/v1';

    if (this.apiKey) {
      this.logger.log(`ORION AI configured — model: ${this.model}, baseUrl: ${this.baseUrl}`);
    } else {
      this.logger.warn('NVIDIA_API_KEY not configured. ORION will use fallback responses.');
    }
  }

  /**
   * ⭐ Chat avec ORION — envoie une question à GLM-5.2 avec le contexte de l'école
   */
  async chat(tenantId: string, message: string, academicYearId?: string): Promise<any> {
    this.logger.log(`🤖 ORION chat request: "${message.substring(0, 100)}..."`);

    try {
      // 1. Récupérer le contexte de l'établissement
      const context = await this.buildContext(tenantId, academicYearId);

      // 2. Construire le prompt système
      const systemPrompt = this.buildSystemPrompt(context);

      // 3. Appeler GLM-5.2 via l'API NVIDIA (integrate.api.nvidia.com/v1)
      const response = await this.callGlmModel(systemPrompt, message, context);

      // 4. Logger l'interaction
      this.logger.log(`✅ ORION response generated (${response.length} chars)`);

      return {
        success: true,
        response,
        context: {
          studentsCount: context.studentsCount,
          activeStudents: context.activeStudents,
          alerts: context.alerts.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`❌ ORION chat failed: ${error.message}`);
      return {
        success: false,
        response: "Je suis désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * ⭐ Analyse prédictive — ORION génère des alertes et recommandations
   */
  async analyze(tenantId: string, academicYearId?: string): Promise<any> {
    this.logger.log('🔍 ORION predictive analysis requested');

    try {
      const context = await this.buildContext(tenantId, academicYearId);
      const systemPrompt = this.buildSystemPrompt(context);
      const analysisPrompt = `Analyse les données de l'établissement et génère :
1. Un résumé de la situation actuelle (effectifs, taux d'occupation, finances)
2. Les 3 alertes les plus importantes
3. 3 recommandations actionnables

Format ta réponse en JSON structuré avec les clés: summary, alerts (array), recommendations (array).`;

      const response = await this.callGlmModel(systemPrompt, analysisPrompt, context);

      // Essayer de parser le JSON
      try {
        const parsed = JSON.parse(response);
        return {
          success: true,
          analysis: parsed,
          timestamp: new Date().toISOString(),
        };
      } catch {
        // Si pas du JSON, retourner le texte brut
        return {
          success: true,
          analysis: { summary: response, alerts: [], recommendations: [] },
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error: any) {
      this.logger.error(`❌ ORION analysis failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * ⭐ Récupère les données de l'établissement pour le contexte
   */
  private async buildContext(tenantId: string, academicYearId?: string) {
    const [
      tenant,
      studentsCount,
      activeStudents,
      admissions,
      enrollments,
      classes,
      teachers,
      idCards,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, type: true },
      }),
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.student.count({ where: { tenantId, status: 'ACTIVE', isActive: true } }),
      this.prisma.admission.count({
        where: { tenantId, ...(academicYearId && { academicYearId }) },
      }),
      this.prisma.studentEnrollment.count({
        where: { tenantId, ...(academicYearId && { academicYearId }) },
      }),
      this.prisma.class.count({
        where: { tenantId, ...(academicYearId && { academicYearId }) },
      }),
      this.prisma.teacher.count({ where: { tenantId } }),
      this.prisma.studentIdCard.count({
        where: { tenantId, ...(academicYearId && { academicYearId }) },
      }),
    ]);

    // Récupérer les alertes ORION existantes
    const alerts: any[] = [];

    if (activeStudents === 0) {
      alerts.push({ severity: 'CRITICAL', message: 'Aucun élève actif dans l\'établissement' });
    }
    if (admissions > 0 && enrollments === 0) {
      alerts.push({ severity: 'HIGH', message: `${admissions} admissions sans inscription` });
    }
    if (activeStudents > 0 && idCards === 0) {
      alerts.push({ severity: 'MEDIUM', message: 'Aucune carte scolaire générée' });
    }

    return {
      tenant: tenant?.name || 'Établissement',
      studentsCount,
      activeStudents,
      admissions,
      enrollments,
      classes,
      teachers,
      idCards,
      alerts,
    };
  }

  /**
   * ⭐ Construit le prompt système pour GLM-5.2
   */
  private buildSystemPrompt(context: any): string {
    return `Tu es ORION, l'assistant IA d'Academia Helm, une plateforme de gestion scolaire.

CONTEXTE DE L'ÉTABLISSEMENT :
- Nom : ${context.tenant}
- Élèves totaux : ${context.studentsCount}
- Élèves actifs : ${context.activeStudents}
- Admissions : ${context.admissions}
- Inscriptions : ${context.enrollments}
- Classes : ${context.classes}
- Enseignants : ${context.teachers}
- Cartes scolaires : ${context.idCards}
- Alertes actuelles : ${context.alerts.length}

RÔLE :
- Tu analyses les données de l'établissement et réponds en français
- Tu donnes des conseils pratiques et actionnables
- Tu identifies les problèmes et proposes des solutions
- Tu es bienveillant, professionnel et concis
- Tu utilise les données du contexte pour appuyer tes réponses

IMPORTANT :
- Réponds toujours en français
- Sois concis mais précis
- Cite des chiffres quand pertinent
- Si tu ne sais pas, dis-le honnêtement`;
  }

  /**
   * ⭐ Appelle le modèle GLM-5.2 via l'API NVIDIA (OpenAI-compatible endpoint)
   *
   * Utilise fetch() natif vers ${NVIDIA_BASE_URL}/chat/completions
   * avec Authorization: Bearer ${NVIDIA_API_KEY}.
   *
   * Fallback : si l'API n'est pas configurée ou échoue, on retourne une
   * réponse basique construite à partir du contexte (sans IA).
   */
  private async callGlmModel(
    systemPrompt: string,
    userMessage: string,
    context?: any,
  ): Promise<string> {
    // Si pas de clé API configurée → fallback sans IA
    if (!this.apiKey) {
      this.logger.warn('NVIDIA_API_KEY not configured — using fallback response');
      return this.buildFallbackResponse(context);
    }

    try {
      const url = `${this.baseUrl}/chat/completions`;
      const body = {
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        top_p: 1,
        max_tokens: 2000,
        stream: false,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        this.logger.error(
          `GLM-5.2 (NVIDIA) call failed: ${response.status} ${response.statusText} — ${errText.substring(0, 200)}`,
        );
        return this.buildFallbackResponse(context);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      return content || 'Je n\'ai pas de réponse à vous fournir.';
    } catch (error: any) {
      this.logger.error(`GLM-5.2 (NVIDIA) call failed: ${error.message}`);
      return this.buildFallbackResponse(context);
    }
  }

  /**
   * Construit une réponse de fallback sans IA (quand NVIDIA n'est pas configuré
   * ou quand l'appel échoue).
   */
  private buildFallbackResponse(context?: any): string {
    return `Je suis ORION, l'assistant d'Academia Helm. Je ne peux pas actuellement me connecter au modèle d'IA. Voici ce que je peux vous dire avec les données disponibles :\n\nL'établissement compte ${context?.activeStudents || 0} élèves actifs sur ${context?.studentsCount || 0} au total, avec ${context?.classes || 0} classes et ${context?.teachers || 0} enseignants.`;
  }
}
