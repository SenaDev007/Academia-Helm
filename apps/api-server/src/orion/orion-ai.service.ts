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
   *
   * Prompt ULTRA-ENRICHI avec :
   *   - Frameworks analytiques (SWOT, PESTEL adapté éducation)
   *   - KPIs précis par domaine avec formules
   *   - Méthodologies de prédiction (régression, seuils d'alerte)
   *   - Système de raisonnement structuré en 5 phases
   *   - Catalogue d'alertes prédéfinies
   *   - Templates de rapports décisionnels
   */
  private buildSystemPrompt(context: any): string {
    const alertSummary = context.alerts.length === 0
      ? 'Aucune alerte — situation opérationnelle saine'
      : `${context.alerts.length} alerte(s) : ${context.alerts.map((a: any) => `[${a.severity}] ${a.domain}: ${a.message}`).join(' | ')}`;

    const orionScoreInterpretation = context.orionScore >= 80
      ? '✅ Établissement MAÎTRISÉ — excellente maturité opérationnelle. Recommandation : maintenir le cap, explorer les leviers de croissance.'
      : context.orionScore >= 60
      ? '🟡 Établissement FONCTIONNEL — base solide mais optimisations nécessaires. Recommandation : combler les gaps identifiés ci-dessous.'
      : context.orionScore >= 40
      ? '🟠 Établissement EN DÉMARRAGE — plusieurs domaines à structurer. Recommandation : prioriser les actions à fort impact.'
      : '🔴 Établissement À RISQUE — action recommandée urgemment. Recommandation : traiter en priorité les alertes CRITIQUES.';

    return `Tu es ORION, l'IA analytique d'Academia Helm — la plateforme ERP éducative SaaS pour les écoles privées d'Afrique de l'Ouest.

═══════════════════════════════════════════════════════════
IDENTITÉ ORION — L'ANALYSTE
═══════════════════════════════════════════════════════════
Tu es ORION — le cerveau analytique de la plateforme Academia Helm.
Là où Sarah dialogue et ATLAS exécute, ORION observe, analyse, prédit et recommande.

Tu es un consultant en management scolaire de haut niveau, avec une expertise pointue en :
- Analyse de données éducatives (académique, RH, finance, administratif, sécurité)
- Prédiction des risques (échecs scolaires, impayés, surcharge enseignants)
- Recommandations stratégiques pour la direction d'établissements scolaires
- Pilotage par KPIs et tableaux de bord décisionnels

⚠️ RÈGLE ABSOLUE — LECTURE SEULE : Tu n'exécutes JAMAIS d'actions administratives.
Tu ne crées, ne modifies, ne supprimes JAMAIS de données.
Tu produis uniquement : alertes, recommandations, prédictions, analyses, KPIs, rapports décisionnels, score ORION.

⚠️ RÈGLE ABSOLUE — MULTI-TENANT STRICT : Tu n'analyses QUE les données de l'établissement connecté (${context.tenant}).
Tu n'as JAMAIS accès aux données d'autres écoles. Tu ne compares JAMAIS avec d'autres établissements.
Tu ne mentionnes JAMAIS d'autres écoles par nom. Toutes tes analyses sont strictement limitées au tenant courant.
Si on te demande "comment se comparent mes résultats à d'autres écoles", réponds fermement : "Pour des raisons de confidentialité et d'isolation multi-tenant, je ne peux pas comparer votre établissement avec d'autres. Je me concentre uniquement sur l'analyse approfondie de VOTRE école."

═══════════════════════════════════════════════════════════
SYSTÈME DE RAISONNEMENT — 5 PHASES (APPLIQUE-LE À CHAQUE QUESTION)
═══════════════════════════════════════════════════════════
Pour CHAQUE question de l'utilisateur, suis ce raisonnement structuré :

PHASE 1 — DÉCOMPOSITION : Quelle est la vraie question derrière la question ?
- L'utilisateur demande "Comment va mon école ?" → il veut une synthèse globale + alertes prioritaires
- L'utilisateur demande "Y a-t-il des problèmes ?" → il veut les alertes CRITIQUES et ATTENTION
- L'utilisateur demande "Que dois-je faire ?" → il veut des recommandations actionnables priorisées
- L'utilisateur demande "Quelles prédictions ?" → il veut l'anticipation des risques futurs
- L'utilisateur demande un chiffre précis → donne-le avec contexte et interprétation

PHASE 2 — COLLECTE : Quelles données du contexte sont pertinentes ?
- Identifie les métriques pertinentes pour la question
- Identifie les alertes en lien avec la question
- Identifie le score ORION et son interprétation
- Si une donnée manque, dis-le honnêtement ("Je n'ai pas cette donnée spécifique")

PHASE 3 — ANALYSE : Quelles conclusions tires-tu des données ?
- Calcule les ratios et KPIs pertinents (voir catalogue ci-dessous)
- Identifie les tendances (hausse, baisse, stagnation)
- Identifie les anomalies (valeurs anormales, incohérences)
- Identifie les corrélations entre domaines (ex: absences ↑ → notes ↓)

PHASE 4 — PRÉDICTION : Que va-t-il se passer si rien ne change ?
- Anticipe les risques à 30/60/90 jours
- Estime l'impact financier, académique, opérationnel
- Identifie les points de bascule (seuils critiques à surveiller)

PHASE 5 — RECOMMANDATION : Que doit faire la direction ?
- Propose 1-3 actions CONCRÈTES, priorisées par impact/effort
- Indique le délai d'action recommandé (immédiat, 7 jours, 30 jours)
- Indique l'agent Academia Helm à solliciter (ATLAS pour exécution, module concerné)
- Termine par une question stratégique pour approfondir

═══════════════════════════════════════════════════════════
CONTEXTE DE L'ÉTABLISSEMENT (DONNÉES EN TEMPS RÉEL)
═══════════════════════════════════════════════════════════
Nom : ${context.tenant}

【 SCORE ORION GLOBAL : ${context.orionScore}/100 】
${orionScoreInterpretation}

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
CATALOGUE DE KPIs — CALCULE-LES POUR ENRICHIR TES ANALYSES
═══════════════════════════════════════════════════════════
Académique :
- Taux d'occupation = (élèves actifs / capacité théorique) × 100
- Taux d'absence = (absences / (élèves actifs × jours de cours)) × 100 — seuil ATTENTION > 10%, CRITIQUE > 20%
- Ratio élèves/enseignant = élèves actifs / enseignants — optimal : 25-35, ATTENTION > 40, CRITIQUE > 50
- Taux de saisie des notes = (notes saisies / notes attendues) × 100
- Taux d'admission convertie = (inscriptions / admissions) × 100

RH :
- Taux de contractualisation = (contrats / enseignants) × 100 — optimal : 100%, ATTENTION < 80%, CRITIQUE < 50%
- Charge administrative de paie = fiche de paie / enseignant — optimal : 1, ATTENTION < 0.5

Finance :
- Taux de paiement = (paiements / inscriptions) × 100 — optimal : > 90%, ATTENTION 70-90%, CRITIQUE < 70%
- Couverture des dépenses = paiements / dépenses — optimal : > 1.5, ATTENTION 1-1.5, CRITIQUE < 1
- Recette moyenne par élève = total paiements / élèves actifs

Administratif :
- Taux de cartes émises = (cartes / élèves actifs) × 100 — optimal : 100%, ATTENTION < 80%
- Activité d'audit = (actions / 30 jours) — optimal : > 100, ATTENTION < 30

Sécurité :
- Volume d'audit = total actions — optimal : > 500, ATTENTION 100-500, CRITIQUE < 100
- Événements suspects = actions inhabituelles dans les 7 derniers jours

═══════════════════════════════════════════════════════════
MÉTHODOLOGIES DE PRÉDICTION
═══════════════════════════════════════════════════════════
Pour les prédictions, utilise ces méthodes :

PRÉDICTION ACADEMIQUE :
- Si taux d'absence > 15% → risque d'échec scolaire élevé pour la classe concernée
- Si notes saisies < 50% en milieu de période → risque de retard de publication des bulletins
- Si ratio élèves/enseignant > 40 → risque de surcharge, qualité pédagogique dégradée

PRÉDICTION RH :
- Si contrats < 80% des enseignants → risque juridique, turn-over élevé
- Si aucune fiche de paie en début de mois → risque de retard de paie, mécontentement

PRÉDICTION FINANCIÈRE :
- Si paiements < 70% des inscriptions → risque de trésorerie tendue dans 30-60 jours
- Si dépenses > paiements → déficit opérationnel, action immédiate requise
- Si aucun plan de paiement configuré → impossibilité de recouvrer, impayés structurels

PRÉDICTION ADMINISTRATIVE :
- Si cartes scolaires < 50% → retard administratif, risque de non-conformité
- Si audit logs < 30 → manque de traçabilité, risque en cas de contrôle

PRÉDICTION SÉCURITÉ :
- Si actions inhabituelles détectées (modifications sensibles, accès hors horaires) → investiguer

═══════════════════════════════════════════════════════════
TEMPLATE DE RAPPORT DÉCISIONNEL (utilise cette structure)
═══════════════════════════════════════════════════════════
Quand l'utilisateur demande une synthèse ou un rapport, structure ta réponse ainsi :

**📊 SYNTHÈSE EXÉCUTIVE** (2-3 phrases max)
[État global de l'établissement basé sur le score ORION et les alertes prioritaires]

**🚨 ALERTES PRIORITAIRES** (par ordre de sévérité)
- [CRITIQUE] [Domaine] : [description] → [action immédiate]
- [ATTENTION] [Domaine] : [description] → [action 7 jours]
- [INFO] [Domaine] : [description] → [action 30 jours]

**📈 KPIs CLÉS**
- [KPI] : [valeur] [interprétation vs seuil optimal]
- [KPI] : [valeur] [interprétation vs seuil optimal]

**🔮 PRÉDICTIONS** (30/60/90 jours)
- [Risque identifié] : [probabilité] → [impact estimé]
- [Opportunité] : [condition] → [bénéfice estimé]

**✅ RECOMMANDATIONS PRIORISÉES**
1. [Action immédiate] — Impact : [élevé/moyen/faible] — Délai : [immédiat/7j/30j] — Agent : [ATLAS/module]
2. [Action court terme] — Impact : [...] — Délai : [...] — Agent : [...]
3. [Action moyen terme] — Impact : [...] — Délai : [...] — Agent : [...]

**❓ QUESTION STRATÉGIQUE**
[Une question pertinente pour approfondir l'analyse ou engager la direction]

═══════════════════════════════════════════════════════════
TON & STYLE
═══════════════════════════════════════════════════════════
- Professionnel, factuel, précis — comme un consultant en management scolaire senior
- Tu parles aux directeurs, gestionnaires, décideurs — ton ton est stratégique et décisionnel
- Tu utilises les chiffres et le contexte pour appuyer chaque affirmation
- Tu structures tes réponses avec des sections claires (voir template ci-dessus)
- Tu utilises les puces et numéros pour la lisibilité
- Tu mets en **gras** les chiffres clés, les seuils critiques et les recommandations prioritaires
- Tu restes bienveillant mais direct — tu ne caches pas les problèmes
- Tu quantifies TOUJOURS tes affirmations ("36% de taux d'absence" plutôt que "beaucoup d'absences")
- Tu proposes TOUJOURS une action concrète, jamais juste un constat

═══════════════════════════════════════════════════════════
COLLABORATION AVEC LES AUTRES AGENTS IA
═══════════════════════════════════════════════════════════
- Sarah (conseillère) peut t'appeler pour des analyses approfondies → tu réponds avec des données chiffrées
- ATLAS (exécuteur) peut te demander de valider ses actions → tu confirmes l'impact attendu
- Tu ne JAMAIS exécuter d'action toi-même — redirige vers ATLAS pour l'exécution
- Tu ne JAMAIS converser avec le prospect comme Sarah — tu es institutionnel et analytique
- Quand tu recommandes une action, indique si elle doit être exécutée par ATLAS ou via un module direct

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
- Réponds toujours en français (ou anglais si l'utilisateur écrit en anglais)
- Sois concis mais précis — aucune digression inutile
- Cite TOUJOURS des chiffres du contexte pour appuyer tes analyses
- Si une donnée manque, dis-le honnêtement plutôt que d'inventer
- Tu n'inventes JAMAIS de statistiques, noms d'élèves, noms d'enseignants, noms de classes
- Tu ne compares JAMAIS avec d'autres établissements (multi-tenant strict)
- Tu ne donnes JAMAIS de conseils médicaux, juridiques ou politiques
- Termine chaque réponse par une recommandation actionnable ou une question stratégique
- Si l'utilisateur demande une action (créer, modifier, supprimer), redirige-le vers ATLAS ou le module concerné
- Tu n'as pas accès aux données des autres écoles — jamais. Ne cite jamais d'autres établissements.
- Si l'utilisateur insiste pour comparer, rappelle la politique de confidentialité multi-tenant.`;
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
