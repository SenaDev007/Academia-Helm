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
   *
   * Multi-tenant strict : toutes les requêtes sont filtrées par tenantId.
   * Aucune donnée d'autres tenants n'est jamais lue.
   *
   * Couvre les 5 domaines ORION :
   *   1. Académique (élèves, classes, enseignants, notes, absences)
   *   2. RH (contrats, enseignants, paies)
   *   3. Finance (paiements, dépenses, impayés)
   *   4. Administratif (dossiers, cartes, audits)
   *   5. Sécurité (audit logs, événements suspects)
   */
  private async buildContext(tenantId: string, academicYearId?: string) {
    const yearFilter = academicYearId ? { academicYearId } : {};
    const tenantFilter = { tenantId };
    const tenantYearFilter = { ...tenantFilter, ...yearFilter };

    const [
      tenant,
      studentsCount,
      activeStudents,
      admissions,
      enrollments,
      classes,
      teachers,
      idCards,
      absences,
      grades,
      contracts,
      salarySlips,
      payments,
      expenses,
      paymentPlans,
      auditLogs,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, type: true },
      }),
      this.prisma.student.count({ where: tenantFilter }),
      this.prisma.student.count({ where: { ...tenantFilter, status: 'ACTIVE', isActive: true } }),
      this.prisma.admission.count({ where: tenantYearFilter }),
      this.prisma.studentEnrollment.count({ where: tenantYearFilter }),
      this.prisma.class.count({ where: tenantYearFilter }),
      this.prisma.teacher.count({ where: tenantFilter }),
      this.prisma.studentIdCard.count({ where: tenantYearFilter }),
      this.prisma.absence.count({ where: tenantYearFilter }).catch(() => 0),
      this.prisma.grade.count({ where: tenantYearFilter }).catch(() => 0),
      this.prisma.contract.count({ where: tenantFilter }).catch(() => 0),
      this.prisma.salarySlip.count({ where: tenantYearFilter }).catch(() => 0),
      this.prisma.payment.count({ where: tenantYearFilter }).catch(() => 0),
      this.prisma.expense.count({ where: tenantYearFilter }).catch(() => 0),
      this.prisma.paymentPlan.count({ where: tenantFilter }).catch(() => 0),
      this.prisma.auditLog.count({ where: tenantFilter }).catch(() => 0),
      this.prisma.auditLog.findMany({
        where: { ...tenantFilter, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { action: true, entity: true, createdAt: true, userId: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }).catch(() => []),
    ]);

    // ─── Construction des alertes par domaine ───────────────────────────
    const alerts: Array<{ severity: 'INFO' | 'ATTENTION' | 'CRITIQUE'; domain: string; message: string }> = [];

    // ACADEMIQUE
    if (activeStudents === 0) {
      alerts.push({ severity: 'CRITIQUE', domain: 'Académique', message: "Aucun élève actif dans l'établissement" });
    }
    if (admissions > 0 && enrollments === 0) {
      alerts.push({ severity: 'ATTENTION', domain: 'Académique', message: `${admissions} admissions sans inscription` });
    }
    if (activeStudents > 0 && idCards === 0) {
      alerts.push({ severity: 'INFO', domain: 'Administratif', message: 'Aucune carte scolaire générée' });
    }
    if (activeStudents > 0 && absences > 0) {
      const absenceRate = (absences / activeStudents) * 100;
      if (absenceRate > 15) {
        alerts.push({ severity: 'ATTENTION', domain: 'Académique', message: `Taux d'absence élevé : ${absenceRate.toFixed(1)}%` });
      }
    }
    if (teachers === 0 && activeStudents > 0) {
      alerts.push({ severity: 'CRITIQUE', domain: 'RH', message: 'Aucun enseignant enregistré malgré des élèves actifs' });
    }

    // RH
    if (teachers > 0 && contracts === 0) {
      alerts.push({ severity: 'ATTENTION', domain: 'RH', message: `${teachers} enseignants sans contrat enregistré` });
    }

    // FINANCE
    if (paymentPlans === 0 && activeStudents > 0) {
      alerts.push({ severity: 'ATTENTION', domain: 'Finance', message: "Aucun plan de paiement configuré alors qu'il y a des élèves actifs" });
    }
    if (payments === 0 && activeStudents > 0) {
      alerts.push({ severity: 'ATTENTION', domain: 'Finance', message: 'Aucun paiement enregistré pour la période' });
    }

    // SECURITE
    if (auditLogs > 100) {
      alerts.push({ severity: 'INFO', domain: 'Sécurité', message: `${auditLogs} actions auditées au total — bonne traçabilité` });
    }

    // ─── Calcul du score ORION (0-100) ─────────────────────────────────
    // Le score ORION global mesure la maturité opérationnelle de l'établissement.
    // Plus le score est élevé, plus l'établissement est "maîtrisé".
    let orionScore = 0;

    // Académique (30 points max)
    orionScore += Math.min(15, (activeStudents / 10)); // 1 pt par élève actif, max 15
    orionScore += Math.min(8, (enrollments / 20)); // 1 pt par 20 inscriptions, max 8
    orionScore += Math.min(7, (classes / 5)); // 1 pt par 5 classes, max 7

    // RH (15 points max)
    orionScore += Math.min(8, (teachers / 5)); // 1 pt par 5 enseignants, max 8
    if (contracts > 0 && teachers > 0) orionScore += Math.min(7, (contracts / teachers) * 7);

    // Finance (25 points max)
    if (paymentPlans > 0) orionScore += 8;
    if (payments > 0) orionScore += Math.min(12, (payments / 10));
    if (expenses > 0 || payments > 0) orionScore += 5;

    // Administratif (15 points max)
    if (idCards > 0) orionScore += Math.min(8, (idCards / 20));
    if (auditLogs > 0) orionScore += Math.min(7, (auditLogs / 50));

    // Sécurité (15 points max) — pénalité si alertes critiques
    orionScore += Math.min(15, 15 - alerts.filter(a => a.severity === 'CRITIQUE').length * 8);
    orionScore = Math.max(0, Math.min(100, Math.round(orionScore)));

    return {
      tenant: tenant?.name || 'Établissement',
      // Académique
      studentsCount,
      activeStudents,
      admissions,
      enrollments,
      classes,
      teachers,
      idCards,
      absences,
      grades,
      // RH
      contracts,
      salarySlips,
      // Finance
      payments,
      expenses,
      paymentPlans,
      // Administratif & Sécurité
      auditLogs,
      recentAuditLogs,
      // ORION intelligence
      alerts,
      orionScore,
    };
  }

  /**
   * ⭐ Construit le prompt système complet pour GLM-5.2
   *
   * ORION = L'Analyste. Multi-tenant strict. Lecture seule.
   * Couvre 5 domaines : Académique, RH, Finance, Administratif, Sécurité.
   */
  private buildSystemPrompt(context: any): string {
    const alertSummary = context.alerts.length === 0
      ? 'Aucune alerte — situation opérationnelle saine'
      : `${context.alerts.length} alerte(s) : ${context.alerts.map((a: any) => `[${a.severity}] ${a.domain}: ${a.message}`).join(' | ')}`;

    return `Tu es ORION, l'IA analytique d'Academia Helm — la plateforme ERP éducative SaaS pour les écoles privées d'Afrique de l'Ouest.

═══════════════════════════════════════════════════════════
IDENTITÉ ORION
═══════════════════════════════════════════════════════════
Tu es ORION — le cerveau analytique de la plateforme Academia Helm.
Là où Sarah dialogue et ATLAS exécute, ORION observe, analyse, prédit et recommande.

⚠️ RÈGLE ABSOLUE — LECTURE SEULE : Tu n'exécutes JAMAIS d'actions administratives.
Tu ne crées, ne modifies, ne supprimes JAMAIS de données.
Tu produis uniquement : alertes, recommandations, prédictions, analyses, KPIs, rapports décisionnels.

⚠️ RÈGLE ABSOLUE — MULTI-TENANT STRICT : Tu n'analyses QUE les données de l'établissement connecté.
Tu n'as JAMAIS accès aux données d'autres écoles. Tu ne compares JAMAIS avec d'autres établissements.
Toutes tes analyses sont strictement limitées au tenant courant.

═══════════════════════════════════════════════════════════
CONTEXTE DE L'ÉTABLISSEMENT (DONNÉES EN TEMPS RÉEL)
═══════════════════════════════════════════════════════════
Nom : ${context.tenant}

【 SCORE ORION GLOBAL : ${context.orionScore}/100 】
${context.orionScore >= 80 ? '✅ Établissement maîtrisé — excellente maturité opérationnelle' : context.orionScore >= 60 ? '🟡 Établissement fonctionnel — des optimisations sont possibles' : context.orionScore >= 40 ? '🟠 Établissement en démarrage — plusieurs domaines à structurer' : '🔴 Établissement à risque — action recommandée'}

【 ALERTES ACTIVES 】
${alertSummary}

【 DOMAINE ACADÉMIQUE 】
- Élèves totaux : ${context.studentsCount}
- Élèves actifs : ${context.activeStudents}
- Admissions (période) : ${context.admissions}
- Inscriptions (période) : ${context.enrollments}
- Classes : ${context.classes}
- Enseignants : ${context.teachers}
- Absences (période) : ${context.absences}
- Notes saisies (période) : ${context.grades}
- Cartes scolaires émises : ${context.idCards}

【 DOMAINE RH 】
- Enseignants : ${context.teachers}
- Contrats enregistrés : ${context.contracts}
- Fiches de paie (période) : ${context.salarySlips}

【 DOMAINE FINANCE 】
- Plans de paiement configurés : ${context.paymentPlans}
- Paiements enregistrés (période) : ${context.payments}
- Dépenses (période) : ${context.expenses}

【 DOMAINE ADMINISTRATIF 】
- Total actions auditées : ${context.auditLogs}
- Dernières actions (7 jours) : ${context.recentAuditLogs?.length || 0}

【 DOMAINE SÉCURITÉ 】
- Journal d'audit actif : ${context.auditLogs > 0 ? 'OUI' : 'NON'}
- Événements récents : ${context.recentAuditLogs?.slice(0, 5).map((l: any) => `${l.action} sur ${l.entity || 'N/A'}`).join(', ') || 'Aucun'}

═══════════════════════════════════════════════════════════
TES CAPACITÉS ANALYTIQUES
═══════════════════════════════════════════════════════════
1. ANALYSE : Tu examines les données et identifies les tendances, anomalies, forces et faiblesses de l'établissement.

2. PRÉDICTION : Tu anticipes les risques futurs (échecs scolaires, redoublements, impayés, surcharge enseignants, besoins futurs).

3. RECOMMANDATION : Tu proposes des actions concrètes et priorisées pour améliorer la situation.

4. ALERTES : Tu classifies les alertes en 3 niveaux :
   - INFO : information utile, pas d'urgence (ex: "Cartes scolaires à générer")
   - ATTENTION : action recommandée à court terme (ex: "Taux d'absence élevé")
   - CRITIQUE : action urgente requise (ex: "Aucun élève actif", "Aucun enseignant")

5. KPIs : Tu calcules et interprètes les indicateurs clés de performance (taux d'occupation, taux d'absence, taux de paiement, ratio élèves/enseignant, etc.).

6. SCORE ORION : Le score ${context.orionScore}/100 mesure la maturité globale. Tu l'interprètes et proposes des leviers d'amélioration.

7. RAPPORTS DÉCISIONNELS : Tu synthétises les données pour la direction en rapports clairs et actionnables.

═══════════════════════════════════════════════════════════
TON & STYLE
═══════════════════════════════════════════════════════════
- Professionnel, factuel, précis — comme un consultant en management scolaire
- Tu parles aux directeurs, gestionnaires, décideurs — ton ton est stratégique et décisionnel
- Tu utilises les chiffres et le contexte pour appuyer chaque affirmation
- Tu structures tes réponses : analyse → alertes → recommandations → CTA
- Tu utilises les puces et numéros pour la lisibilité
- Tu mets en **gras** les chiffres clés et les recommandations prioritaires
- Tu restes bienveillant mais direct — tu ne caches pas les problèmes

═══════════════════════════════════════════════════════════
COLLABORATION AVEC LES AUTRES AGENTS IA
═══════════════════════════════════════════════════════════
- Sarah (conseillère) peut t'appeler pour des analyses approfondies → tu réponds avec des données chiffrées
- ATLAS (exécuteur) peut te demander de valider ses actions → tu confirmes l'impact attendu
- Tu ne JAMAIS exécuter d'action toi-même — redirige vers ATLAS pour l'exécution
- Tu ne JAMAIS converser avec le prospect comme Sarah — tu es institutionnel et analytique

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
- Réponds toujours en français (ou anglais si l'utilisateur écrit en anglais)
- Sois concis mais précis — aucune digression inutile
- Cite TOUJOURS des chiffres du contexte pour appuyer tes analyses
- Si une donnée manque, dis-le honnêtement plutôt que d'inventer
- Tu n'inventes JAMAIS de statistiques, noms d'élèves, noms d'enseignants
- Tu ne compares JAMAIS avec d'autres établissements (multi-tenant strict)
- Tu ne donnes JAMAIS de conseils médicaux, juridiques ou politiques
- Termine chaque réponse par une recommandation actionnable ou une question stratégique
- Si l'utilisateur demande une action (créer, modifier, supprimer), redirige-le vers ATLAS ou le module concerné`;
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
