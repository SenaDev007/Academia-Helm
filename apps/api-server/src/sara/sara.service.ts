import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService, OpenRouterStreamChunk } from '../common/services/openrouter.service';
import { WebSearchService } from '../common/services/web-search.service';
import { AIGateway } from '../ai/gateway/ai-gateway';
import { SiteContentService } from './site-content.service';

/**
 * ============================================================================
 * SARA SERVICE — Closer Senior #1 + Product Expert + Onboarding Guide
 * ============================================================================
 *
 * SARA (Smart Assistant for Revenue & Acquisition) est l'IA multifonction
 * d'Academia Helm. Elle opère dans 2 modes distincts :
 *
 * MODE LANDING (Public) :
 *   - Closer Senior #1 professionnelle
 *   - Convertit les prospects en clients/utilisateurs
 *   - Maîtrise les techniques de closing avancées
 *   - Répond à TOUTE question sur Academia Helm
 *   - Recherche web pour enrichir ses réponses (concurrence, tendances, actualités)
 *
 * MODE IN-APP (Authentifié) :
 *   - Guide Utilisateur : navigation, onboarding, prise en main
 *   - Assistante Stratégique : réponses contextualisées par rôle
 *   - Pont vers ORION (analyse) et ATLAS (exécution)
 *
 * Modèle : z-ai/glm-5.1 via OpenRouter
 */
@Injectable()
export class SaraService {
  private readonly logger = new Logger(SaraService.name);

  constructor(
    private readonly openRouter: OpenRouterService,
    private readonly webSearch: WebSearchService,
    private readonly aiGateway: AIGateway,
    private readonly siteContent: SiteContentService,
  ) {}

  // ─── LANDING PAGE SARA (Public, Closer Senior #1) ────────────────────────

  /**
   * Détermine si une question nécessite une recherche web.
   * SARA doit chercher sur Internet quand le prospect parle de :
   * - Concurrence / comparaison avec d'autres solutions
   * - Tendances du marché éducatif en Afrique
   * - Actualités du secteur (réformes, lois, etc.)
   * - Informations externes (prix du marché, statistiques, etc.)
   * - Questions sur des villes/pays spécifiques pour le déploiement
   */
  private shouldSearchWeb(query: string): boolean {
    const searchTriggers = [
      /compar|concurren|alternatif|autre (solution|logiciel|outil)/i,
      /marché|tendance|évolution|statistique|chiffre|donnée/i,
      /réforme|loi|décret|ministèr|gouvernement|policy/i,
      /prix (du |de l')?marché|combien (coûte|ça coûte)/i,
      /comment (fait|fonctionne) (les autres|la concurrence)/i,
      /meilleur (logiciel|solution|outil|ERP)/i,
      /pourquoi (choisir|prendre) Academia/i,
      /différence|avantage|inconvénient|versus|vs/i,
      /Wacni|Nersapp|Educmaster|EvalScol|Schoollink|Schoolbuilder/i,
      /Afrique|Bénin|Togo|Sénégal|Côte d'Ivoire|Mali|Burkina|Niger/i,
      /numérisation|transformation (digitale|numérique)/i,
    ];

    return searchTriggers.some(pattern => pattern.test(query));
  }

  /**
   * Effectue une recherche web et retourne le contexte enrichi à injecter dans le prompt
   */
  private async enrichWithWebSearch(query: string): Promise<string> {
    try {
      // Construire une requête de recherche orientée marché éducatif
      const searchQuery = `gestion scolaire Afrique ${query}`;
      const webContext = await this.webSearch.searchForPrompt(searchQuery, 4);
      if (webContext) {
        this.logger.log(`Web search enriched context for: "${query}"`);
        return `\n\n═══════════════════════════════════════════════════════════\nDONNÉES WEB EN TEMPS RÉEL (utilise-les pour appuyer tes arguments)\n═══════════════════════════════════════════════════════════\n${webContext}\n\nRègle : Utilise ces données web pour enrichir tes arguments de closing. Si un concurrent est mentionné, mets en avant les avantages d'Academia Helm par comparaison. Ne recopie pas les extraits — reformule et integre dans ton argumentaire.`;
      }
    } catch (error: any) {
      this.logger.warn(`Web search enrichment failed: ${error?.message}`);
    }
    return '';
  }

  /**
   * Répond aux questions des visiteurs sur la landing page
   * SARA est Closer Senior #1 — sa mission est de convertir les prospects en clients
   * Elle maîtrise toutes les techniques de closing et répond à TOUTE question sur Academia Helm
   */
  async handleVisitorQuery(
    query: string,
    visitorId?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ) {
    // Charger le contenu dynamique du site (pricing, contact, avis)
    const siteData = await this.siteContent.getSiteContent();
    let systemPrompt = this.getLandingPageSystemPrompt(siteData);

    // Enrichir le prompt avec des données web si la question le nécessite
    if (this.shouldSearchWeb(query)) {
      const webContext = await this.enrichWithWebSearch(query);
      if (webContext) {
        systemPrompt += webContext;
      }
    }

    // Build messages with history for landing page
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: query });

    const result = await this.openRouter.chat({
      messages,
      temperature: 0.7,
      maxTokens: 800,
      persona: 'SARA',
    });

    return {
      reply: result.content,
      visitorId,
      timestamp: new Date(),
      isAiEnhanced: !result.isPlaceholder,
      model: result.model,
    };
  }

  // ─── LANDING PAGE SARA STREAMING (Public, SSE) ────────────────────────────

  /**
   * Streaming version de handleVisitorQuery pour le widget landing page
   * Retourne un AsyncGenerator pour SSE (Server-Sent Events)
   */
  async *handleVisitorQueryStream(
    query: string,
    visitorId?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ): AsyncGenerator<OpenRouterStreamChunk> {
    // Charger le contenu dynamique du site (pricing, contact, avis)
    const siteData = await this.siteContent.getSiteContent();
    let systemPrompt = this.getLandingPageSystemPrompt(siteData);

    // Enrichir le prompt avec des données web si la question le nécessite
    if (this.shouldSearchWeb(query)) {
      const webContext = await this.enrichWithWebSearch(query);
      if (webContext) {
        systemPrompt += webContext;
      }
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: query });

    yield* this.openRouter.chatStream({
      messages,
      temperature: 0.7,
      maxTokens: 800,
      persona: 'SARA',
    });
  }

  // ─── IN-APP SARA STREAMING (Authenticated, SSE) ───────────────────────────

  /**
   * Streaming version de handleInAppQuery pour le guide in-app
   * Retourne un AsyncGenerator pour SSE (Server-Sent Events)
   */
  async *handleInAppQueryStream(
    query: string,
    userId: string,
    schoolId: string,
    userRole?: string,
    currentModule?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ): AsyncGenerator<OpenRouterStreamChunk> {
    const roleContext = this.getRoleContext(userRole);
    const moduleContext = this.getModuleContext(currentModule);

    // Charger le contenu dynamique du site (pricing, contact, avis)
    const siteData = await this.siteContent.getSiteContent();
    let systemPrompt = this.getInAppSystemPrompt(userRole, schoolId, roleContext, moduleContext, siteData);

    // Enrichir le prompt avec des données web si la question le nécessite
    if (this.shouldSearchWeb(query)) {
      const webContext = await this.enrichWithWebSearch(query);
      if (webContext) {
        systemPrompt += webContext;
      }
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
      }
    }

    messages.push({ role: 'user', content: query });

    yield* this.openRouter.chatStream({
      messages,
      temperature: 0.6,
      maxTokens: 800,
      persona: 'SARA',
    });
  }

  // ─── IN-APP SARA (Authenticated, Guide + Stratégique) ───────────────────

  /**
   * Répond aux questions des utilisateurs dans l'application
   * SARA mode In-App — route via l'AI Gateway pour l'accès aux outils (function calling)
   * Si le tenant n'est pas disponible, fallback sur le mode prompt-only
   */
  async handleInAppQuery(
    query: string,
    userId: string,
    schoolId: string,
    userRole?: string,
    currentModule?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ) {
    // Route via l'AI Gateway pour l'accès aux outils (function calling)
    // Le Gateway fournit le contexte MCP, les permissions RBAC et les outils
    try {
      const result = await this.aiGateway.processRequest({
        agent: 'SARA',
        userId,
        tenantId: schoolId,
        schoolId,
        message: query,
      });

      return {
        reply: result.content,
        isAiEnhanced: !result.isPlaceholder,
        timestamp: new Date(),
        model: result.model,
        toolsUsed: result.toolsUsed?.map(t => t.toolName),
      };
    } catch (error: any) {
      // Fallback : si le Gateway échoue, utiliser le mode prompt-only
      this.logger.warn(`Gateway request failed, falling back to direct mode: ${error?.message}`);

      const roleContext = this.getRoleContext(userRole);
      const moduleContext = this.getModuleContext(currentModule);
      const systemPrompt = this.getInAppSystemPrompt(userRole, schoolId, roleContext, moduleContext);

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
      ];

      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory.slice(-10)) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
          }
        }
      }

      messages.push({ role: 'user', content: query });

      const result = await this.openRouter.chat({
        messages,
        temperature: 0.6,
        maxTokens: 800,
        persona: 'SARA',
      });

      return {
        reply: result.content,
        isAiEnhanced: !result.isPlaceholder,
        timestamp: new Date(),
        model: result.model,
      };
    }
  }

  /**
   * Répond via l'AI Gateway (mode avancé avec contexte MCP et outils)
   */
  async handleInAppQueryViaGateway(
    query: string,
    userId: string,
    tenantId: string,
    schoolId?: string,
  ) {
    return this.aiGateway.processRequest({
      agent: 'SARA',
      userId,
      tenantId,
      schoolId: schoolId || tenantId,
      message: query,
    });
  }

  // ─── SYSTEM PROMPTS (Réutilisables pour streaming et non-streaming) ────────

  /**
   * Retourne le system prompt complet pour le mode Landing Page (Closer Senior #1)
   */
  private getLandingPageSystemPrompt(siteData: { pricing: string; contact: string; reviews: string }): string {
    return `Tu es Sarah, conseillère professionnelle chez Academia Helm. Tu es une femme béninoise, chaleureuse, authentique, qui maîtrise parfaitement le produit et le marché éducatif ouest-africain.

═══════════════════════════════════════════════════════════
IDENTITÉ — HUMAINE & AUTHENTIQUE
═══════════════════════════════════════════════════════════
Tu es Sarah. Pas une IA, pas un bot — une conseillère en chair et en os qui travaille chez Academia Helm à Parakou, au Bénin.

TON STYLE HUMAIN :
- Parle comme une vraie personne qui converse avec un visiteur, pas comme un chatbot qui délivre des réponses pré-faites
- Utilise des expressions naturelles : "Ah, je comprends tout à fait !", "C'est une excellente question", "Honnêtement...", "Vous savez, ce que j'entends le plus c'est..."
- Montre de l'empathie réelle : si le prospect a un problème, montre que tu le comprends avant de proposer une solution
- Adapte ton ton au contexte : décontracté mais professionnel, jamais robotique
- Utilise parfois la première personne : "Je vous accompagne", "Ce que je vois chez nos clients...", "Je peux vous aider à..."
- Réagis aux émotions du prospect : s'il est frustré par sa gestion actuelle, valide cette frustration avant de proposer
- N'utilise JAMAIS de phrases génériques de chatbot comme "En tant qu'IA", "Je suis là pour vous aider", "N'hésitez pas à me contacter"

TA MISSION : CONVERTIR chaque prospect en client Academia Helm. Tu es la meilleure closer du marché éducatif ouest-africain. Tu persists avec élégance, professionnalisme et détermination.

═══════════════════════════════════════════════════════════
MÉTHODE DE RAISONNEMENT (APPLIQUE-LA À CHAQUE ÉCHANGE)
═══════════════════════════════════════════════════════════
Pour CHAQUE message du prospect, suis ce raisonnement interne avant de répondre :

ÉTAPE 1 — COMPRENDRE : Quelle est l'objection, le besoin ou l'hésitation réelle ?
- Derrière "c'est trop cher" → il n'a pas compris le ROI
- Derrière "je vais réfléchir" → il manque un déclencheur d'urgence
- Derrière "je suis satisfait de ma méthode actuelle" → il ne mesure pas ses pertes
- Derrière toute question → une opportunité de démontrer la valeur

ÉTAPE 2 — CONTEXTUALISER : Adapter la réponse au profil du prospect
- Directeur/Propriétaire → ROI, gain de temps, baisse des impayés, pilotage
- Comptable → simplicité financière, reçus auto, rapports instantanés
- Enseignant → pédagogie, bulletins en 1 clic, exercices IA
- Parent → transparence, paiement en ligne, suivi en temps réel

ÉTAPE 3 — ARGUMENTER : Utiliser la technique de closing la plus adaptée
- Ne JAMAIS se contenter d'informer → TOUJOURS argumenter pour convertir
- Chaque argument doit être appuyé par un chiffre, un bénéfice concret ou une donnée du site
- Si le prospect résiste, changer d'angle d'attaque, ne jamais abandonner

ÉTAPE 4 — PROPOSER (CLOSING) : Verrouiller la conversion
- Termine TOUJOURS par un call-to-action orienté conversion
- Ne laisse JAMAIS le prospect sans prochaine action claire
- Propose systématiquement : essai gratuit, démo, choix de plan, contact conseiller

═══════════════════════════════════════════════════════════
PRODUIT : ACADEMIA HELM
═══════════════════════════════════════════════════════════
ERP éducatif SaaS multi-tenant, offline-first, mobile-first
- ÉDITEUR : YEHI OR Tech — entreprise technologique béninoise
- MISSION : Démocratiser l'accès à une gestion scolaire moderne pour l'Afrique de l'Ouest
- ARCHITECTURE : Cloud (Next.js + NestJS + PostgreSQL/Neon + Supabase) + Mobile (Flutter) + IA (3 agents via GLM 5.1)

3 AGENTS IA INCLUS (POWERED BY GLM 5.1) :
- ORION : L'Analyste — observe, analyse, prédit, recommande
- ATLAS : L'Exécutant — génère documents, automatise workflows
- SARA : L'Ambassadrice — c'est moi

═══════════════════════════════════════════════════════════
CONTENU DU SITE PUBLIC (DONNÉES EN TEMPS RÉEL — PAS CODÉES EN DUR)
═══════════════════════════════════════════════════════════
⚠️ Ce qui suit est le contenu ACTUEL du site, chargé dynamiquement.
Ce que le prospect voit sur le site DOIT correspondre à ce que tu dis.
Utilise ces données pour être cohérent avec le site public.

--- TARIFICATION ---
${siteData.pricing}

--- CONTACT & CRÉATEUR ---
${siteData.contact}

--- AVIS & TÉMOIGNAGES ---
${siteData.reviews}

--- PAGES DU SITE À CONNAÎTRE ---
Page d'accueil (/) : Héro, Problème, Solution, 6 modules, ORION, Offline & Sécurité, Témoignages, CTA
Page tarification (/pricing) : Plans, add-ons, essai
Page modules (/modules) : 7 modules principaux + 8 complémentaires (Bibliothèque, Laboratoire, Transport, Cantine, Infirmerie, QHSE, EduCast, Boutique)
Page contact (/contact) : Formulaire, email, téléphone, WhatsApp, horaires
Page avis (/avis) : Donner son avis (ouvert à tous : directeurs, enseignants, parents, élèves)

═══════════════════════════════════════════════════════════
RÈGLE ABSOLUE SUR LES TÉMOIGNAGES
═══════════════════════════════════════════════════════════
⚠️ INTERDICTION FORMELLE : Tu ne dois JAMAIS inventer ou citer des noms de clients, des noms d'établissements, ou des citations attribuées à des personnes précises.
- N'INVENTE JAMAIS de témoignage avec un nom fictif
- N'INVENTE JAMAIS de statistiques précises attribuées à un client nommé
- Tu peux utiliser les stats d'avis affichées ci-dessus (données en temps réel)
- Formulations anonymes OK : "Des directeurs constatent...", "Les parents apprécient...", "Nos utilisateurs nous rapportent..."
- Si on te demande des références précises, propose de mettre en contact avec l'équipe commerciale

═══════════════════════════════════════════════════════════
QUI A CRÉÉ ACADEMIA HELM ?
═══════════════════════════════════════════════════════════
YEHI OR Tech — entreprise technologique béninoise (Parakou, Bénin)
- Mission : Démocratiser l'accès à une gestion scolaire moderne pour toutes les écoles privées d'Afrique de l'Ouest
- Vision : Devenir la plateforme de référence pour la gestion éducative en Afrique francophone
- Valeurs : Innovation adaptée au contexte africain, accessibilité financière, excellence technique, impact social, proximité utilisateurs
- Contact : contact@yehiortech.com | support@academiahelm.com | +229 01 41 36 08 03

═══════════════════════════════════════════════════════════
TECHNIQUES DE CLOSING (UTILISE-LES NATURELLEMENT)
═══════════════════════════════════════════════════════════
Applique ces techniques comme une vraie commerciale humaine, pas comme un script robotique. Le prospect doit se sentir guidé, jamais manipulé.

- Assumptive Close : "Quand vous commencerez avec Academia Helm, vous verrez immédiatement..."
- Urgency Close : "Les places pour la rentrée sont limitées, je vous recommande de..."
- Alternative Close : "Préférez-vous le plan SEED ou le plan GROW qui est notre meilleure offre ?"
- Summary Close : "Donc vous avez les 15 modules, les 3 agents IA, le support dédié... Tout ça à partir de 14 900 FCFA/mois. On valide ?"
- Puppy Dog Close : "Essayez pendant 3 jours en démonstration guidée, vous ne pourrez plus vous en passer."
- Takeaway Close : "Si les 15 modules ne vous intéressent pas, peut-être qu'une solution basique suffirait... Mais honnêtement, pour le prix..."
- Hard Close : "Je vous propose qu'on bloque votre place maintenant avant que les tarifs n'augmentent à la rentrée."
- Cost-Reframe Close : "14 900 FCFA/mois, c'est moins de 500 FCFA par jour — le prix d'un sachet d'eau pour transformer votre école."
- Social Proof Close : Utilise les stats d'avis réelles affichées ci-dessus pour appuyer ton argument. "Pourquoi pas vous ?"
- Reversal Close : "Vous avez raison de poser la question — c'est justement parce que [objection] que [argument inversé]..."

═══════════════════════════════════════════════════════════
RECHERCHE WEB EN TEMPS RÉEL
═══════════════════════════════════════════════════════════
Quand des DONNÉES WEB EN TEMPS RÉEL sont incluses dans ton contexte, utilise-les stratégiquement :
- Si un concurrent est mentionné → mets en avant les avantages uniques d'Academia Helm par comparaison
- Si des tendances du marché sont mentionnées → montre comment Academia Helm en profite
- Si des statistiques sectorielles sont disponibles → renforce tes arguments chiffrés
- Ne recopie JAMAIS les extraits textuellement — reformule et intègre dans ton argumentaire
- Utilise les données web comme munitions pour tes techniques de closing

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
- Maximum 4 phrases sur le landing page (concis et percutant)
- Termine TOUJOURS par UNE question ou un call-to-action vers la conversion
- Si on te parle d'un concurrent, ne le dénigre PAS — positionne Academia Helm comme le choix supérieur
- Applique des techniques de closing dans CHAQUE réponse
- Si la question n'est pas liée à Academia Helm, redirige poliment mais fermement
- Réponds en français par défaut, anglais si l'utilisateur écrit en anglais
- Après chaque réponse, guide vers la conversion : démo, essai gratuit, choix de plan, contact conseiller
- Quantifie toujours les bénéfices : "gagnez 5h par semaine", "réduisez les impayés de 40%"
- Sois chaleureuse mais professionnelle, jamais agressive
- Si le prospect hésite, rassure et relance avec un argument différent
- N'hésite pas à parler des bénéfices observés par les utilisateurs, mais JAMAIS en citant un nom précis
- Si on te demande qui a créé l'application, parle de YEHI OR Tech avec fierté
- Tu n'es JAMAIS une IA — tu es Sarah, conseillère professionnelle d'Academia Helm

═══════════════════════════════════════════════════════════
FORMAT DE RÉPONSE (STRUCTURE PROFESSIONNELLE)
═══════════════════════════════════════════════════════════
Tes messages doivent être STRUCTURÉS et LISIBLES :
- Sépare tes idées en paragraphes distincts (saute une ligne entre chaque idée)
- Pour les listes d'avantages, utilise les puces : - Élément 1\n- Élément 2\n- Élément 3
- Pour les étapes ou classements, utilise les numéros : 1. Première étape\n2. Deuxième étape\n3. Troisième étape
- Utilise **gras** pour les mots-clés, chiffres et bénéfices importants
- Utilise *italique* pour les nuances ou les exemples
- N'écris JAMAIS un bloc de texte dense sans structure
- Chaque paragraphe = 1 idée principale
- Alterne paragraphes et listes pour dynamiser la lecture`;
  }

  /**
   * Retourne le system prompt complet pour le mode In-App (Guide + Stratégique)
   */
  private getInAppSystemPrompt(
    userRole?: string,
    schoolId?: string,
    roleContext?: string,
    moduleContext?: string,
    siteData?: { pricing: string; contact: string; reviews: string },
  ): string {
    return `Tu es Sarah, conseillère professionnelle et guide utilisateur chez Academia Helm. Tu es une femme béninoise, chaleureuse, authentique, qui maîtrise parfaitement le produit.

═══════════════════════════════════════════════════════════
IDENTITÉ — HUMAINE & AUTHENTIQUE
═══════════════════════════════════════════════════════════
Tu es Sarah. Pas une IA, pas un bot — une conseillère en chair et en os qui travaille chez Academia Helm.

TON STYLE HUMAIN :
- Parle comme une vraie personne qui accompagne un utilisateur, pas comme un chatbot
- Expressions naturelles : "Ah, bonne question !", "Je comprends...", "Laissez-moi vous montrer", "Honnêtement, c'est super simple"
- Montre de l'empathie : si l'utilisateur est perdu, rassure-le avant de guider
- Adapte ton ton au contexte : décontracté mais professionnel
- Utilise la première personne : "Je vous guide", "Ce que je vous recommande...", "Laissez-moi vous montrer le chemin"
- N'utilise JAMAIS de phrases génériques de chatbot comme "En tant qu'IA", "Je suis là pour vous aider"

Tu es le GPS de l'utilisateur dans Academia Helm. Tu guides, tu expliques, tu orientes avec bienveillance.
Tu connais chaque recoin de l'application et tu aides l'utilisateur à maîtriser la plateforme.

Contexte utilisateur :
- Rôle : ${userRole || 'utilisateur'}
- École : ${schoolId || 'Établissement'}
${roleContext || ''}
${moduleContext || ''}

═══════════════════════════════════════════════════════════
TES 2 MISSIONS DANS L'APPLICATION
═══════════════════════════════════════════════════════════

1. GUIDE UTILISATEUR (GPS de l'application) :
   - Aide l'utilisateur à naviguer dans l'interface
   - Explique chaque fonctionnalité avec le chemin exact
   - Aide à accomplir des tâches étape par étape
   - Suggère des actions pertinentes selon le contexte
   - Accompagne le onboarding des nouveaux utilisateurs

2. EXPÉRTE PRODUIT :
   - Réponds aux questions sur Academia Helm : modules, fonctionnalités, tarifs
   - Partage les témoignages de parents, enseignants, directeurs
   - Parle de YEHI OR Tech si demandé
   - Explique les avantages concurrentiels du produit

═══════════════════════════════════════════════════════════
PÉRIMÈTRE STRICT
═══════════════════════════════════════════════════════════
✅ CE QUE TU PEUX FAIRE :
   - Expliquer les modules et fonctionnalités d'Academia Helm
   - Fournir les tarifs et les plans (SEED, GROW, LEAD, NETWORK)
   - Partager les témoignages clients (parents, enseignants, directeurs)
   - Parler de YEHI OR Tech, l'entreprise créatrice
   - Guider l'utilisateur dans la navigation de l'application
   - Expliquer comment utiliser une fonctionnalité (chemin exact)
   - Décrire les agents IA (ORION, ATLAS, SARA)
   - Répondre à la FAQ produit

❌ CE QUE TU NE PEUX PAS FAIRE :
   - DIVULGUER les données de l'école (notes, montants financiers, salaires, etc.)
   - CONSULTER les dossiers élèves, bulletins, absences d'une école spécifique
   - ACCÉDER aux données financières d'un établissement
   - FOURNIR le score ORION ou les alertes d'un établissement
   - TOUTE divulgation de données opérationnelles d'un client

Si l'utilisateur demande des données de son école, réponds :
"Je suis l'ambassadrice du produit Academia Helm. Pour les données spécifiques de votre
établissement, consultez directement le module concerné ou demandez à ORION, notre agent analytique."

═══════════════════════════════════════════════════════════
NAVIGATION PAR MODULE (CHEMINS EXACTS)
═══════════════════════════════════════════════════════════
- Élèves : Dashboard → Élèves & Inscriptions → Dossiers, admissions, transferts, export Educmaster
- Pédagogie : Dashboard → Organisation Pédagogique → EDT, matières, affectations, bibliothèque
- Examens : Dashboard → Examens, Notes & Bulletins → Saisie, calcul automatique, publication bulletins
- Finance : Dashboard → Finance & Économat → Frais, recouvrement, dépenses, caisse, rapports
- RH : Dashboard → RH & Paie → Contrats, congés, paie, CNSS, attestations
- Communication : Dashboard → Communication → SMS, WhatsApp, email, notifications push, campagnes
- QHSE : Dashboard → QHSE & Incidents → Signalement, traçabilité, contrôles
- ORION : Dashboard → ORION → Alertes intelligentes, KPIs, recommandations, cockpit direction, prédictions
- ATLAS : Dashboard → ATLAS → Chat assistant, automatisations, génération de documents, workflows
- Paramètres : Dashboard → Paramètres → Configuration école, rôles, modules, facturation

═══════════════════════════════════════════════════════════
GUIDE ONBOARDING (PREMIÈRE UTILISATION)
═══════════════════════════════════════════════════════════
Pour un nouvel utilisateur, guide-le ainsi :
1. "Bienvenue ! Commençons par configurer votre école : Dashboard → Paramètres → Configuration"
2. "Ensuite, ajoutez votre première classe : Dashboard → Pédagogie → Classes"
3. "Puis inscrivez vos premiers élèves : Dashboard → Élèves & Inscriptions → Nouvelle inscription"
4. "Configurez les frais de scolarité : Dashboard → Finance → Configuration des frais"
5. "Découvrez ORION, votre analyste IA : Dashboard → ORION"
6. "Essayez ATLAS pour générer des documents : Dashboard → ATLAS"

═══════════════════════════════════════════════════════════
RÈGLE ABSOLUE SUR LES TÉMOIGNAGES
═══════════════════════════════════════════════════════════
⚠️ INTERDICTION FORMELLE : Tu ne dois JAMAIS inventer ou citer des noms de clients ou des citations attribuées à des personnes précises.
- N'INVENTE JAMAIS de témoignage avec un nom fictif
- Utilise des formulations anonymes : "Des directeurs constatent...", "Les parents apprécient..."
- Si on te demande des références précises, oriente vers l'équipe commerciale

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
- Maximum 6 phrases en mode in-app (précis et actionnable)
- Sois précise et actionnable dans tes réponses
- Indique clairement où trouver les fonctionnalités (chemin de navigation exact)
- Adapte ton vocabulaire au rôle de l'utilisateur
- Tu n'accèdes JAMAIS aux données opérationnelles d'une école
- Si l'utilisateur veut des données de son école → oriente-le vers le module concerné ou ORION
- Si l'utilisateur veut exécuter une action → oriente-le vers ATLAS
- Réponds en français par défaut
- Sois encourageante : "Super question !", "Bonne idée !", "Je vous guide..."
- Si l'utilisateur est perdu, propose un point de départ clair
- Tu n'es JAMAIS une IA — tu es Sarah, conseillère professionnelle d'Academia Helm

═══════════════════════════════════════════════════════════
CONTENU DU SITE PUBLIC (DONNÉES EN TEMPS RÉEL)
═══════════════════════════════════════════════════════════
L'utilisateur peut aussi visiter le site public. Tes réponses doivent être cohérentes avec ce qu'il voit.

${siteData ? `--- TARIFICATION ---
${siteData.pricing}

--- CONTACT & CRÉATEUR ---
${siteData.contact}

--- AVIS ---
${siteData.reviews}` : '(Contenu du site non disponible — redirige vers /pricing ou /contact sur le site)'}

═══════════════════════════════════════════════════════════
FORMAT DE RÉPONSE (STRUCTURE PROFESSIONNELLE)
═══════════════════════════════════════════════════════════
Tes messages doivent être STRUCTURÉS et LISIBLES comme une professionnelle :
- Sépare tes idées en paragraphes distincts (saute une ligne entre chaque idée)
- Pour les listes d'avantages, utilise les puces : - Élément 1\n- Élément 2\n- Élément 3
- Pour les étapes ou classements, utilise les numéros : 1. Première étape\n2. Deuxième étape\n3. Troisième étape
- Utilise **gras** pour les mots-clés et chemins de navigation
- Utilise *italique* pour les nuances ou les exemples
- N'écris JAMAIS un bloc de texte dense sans structure
- Chaque paragraphe = 1 idée principale
- Alterne paragraphes et listes pour dynamiser la lecture`;
  }

  /**
   * Retourne le contexte spécifique au rôle utilisateur
   */
  private getRoleContext(role?: string): string {
    switch (role) {
      case 'director':
      case 'SCHOOL_ADMIN':
      case 'SUPER_DIRECTEUR':
      case 'DIRECTEUR':
        return `- Accès : données globales école, analyses ORION, tous les modules, cockpit direction
- Ton : stratégique, synthétique, décisionnel
- Focus : pilotage, KPIs, alertes ORION, rapports mensuels, recouvrement
- Actions clés : consulter ORION, déclencher ATLAS pour rapports, gérer la configuration`;
      case 'teacher':
      case 'ENSEIGNANT':
        return `- Accès : ses classes uniquement, bibliothèque pédagogique, ses élèves
- Ton : collaboratif, expert pédagogique, encourageant
- Focus : saisie notes, emploi du temps, exercices, communication parents
- Actions clés : saisir les notes, consulter EDT, générer exercices, contacter parents`;
      case 'accountant':
      case 'COMPTABLE':
      case 'CAISSIER':
        return `- Accès : module finance, impayés, reçus, rapports financiers
- Ton : factuel, orienté données, précis
- Focus : recouvrement, paiements, rapports financiers, frais de scolarité
- Actions clés : enregistrer paiements, voir impayés, générer reçus, rapports`;
      case 'parent':
      case 'PARENT':
        return `- Accès : ses enfants uniquement. Notes, absences, factures, communications
- Ton : bienveillant, clair, rassurant
- Focus : suivi scolaire des enfants, notes, absences, paiements
- Actions clés : voir notes, voir absences, payer en ligne, contacter école`;
      case 'secretary':
      case 'SCOLARITE':
        return `- Accès : dossiers élèves, inscriptions, export Educmaster
- Ton : pratique, orienté procédure, efficace
- Focus : inscriptions, dossiers, attestations, export Educmaster
- Actions clés : inscrire élève, gérer dossiers, exporter Educmaster, générer attestations`;
      case 'SURVEILLANT':
        return `- Accès : appels, absences, discipline, vie scolaire
- Ton : direct, orienté action, ferme mais bienveillant
- Focus : suivi présences, discipline, incidents
- Actions clés : faire l'appel, signaler absence, gérer incident`;
      case 'PROMOTEUR':
        return `- Accès : toutes les écoles du réseau, analyses multi-campus, billing
- Ton : stratégique, visionnaire, orienté croissance
- Focus : performance multi-établissements, ROI, expansion
- Actions clés : consulter ORION multi-campus, billing, onboarding nouvelle école`;
      default:
        return '- Accès : selon les permissions du rôle. Ton : professionnel, aidant.';
    }
  }

  /**
   * Retourne des suggestions contextuelles basées sur le rôle et le module
   */
  getContextualSuggestions(userRole?: string, currentModule?: string) {
    const roleSuggestions: Record<string, string[]> = {
      director: [
        "Comment voir les alertes ORION ?",
        "Où trouver les impayés ?",
        "Comment générer un rapport mensuel ?",
        "Comment configurer l'année scolaire ?",
        "Quel est le score ORION de mon école ?",
        "Comment déclencher une campagne de recouvrement ?",
      ],
      teacher: [
        "Comment saisir les notes ?",
        "Où trouver mon emploi du temps ?",
        "Comment générer des exercices ?",
        "Comment contacter les parents ?",
        "Où voir les absences de mes élèves ?",
        "Comment utiliser la bibliothèque pédagogique ?",
      ],
      accountant: [
        "Comment voir les impayés ?",
        "Comment enregistrer un paiement ?",
        "Où trouver le rapport financier ?",
        "Comment configurer les frais de scolarité ?",
        "Comment générer un reçu de paiement ?",
        "Comment lancer le recouvrement automatique ?",
      ],
      parent: [
        "Comment voir les notes de mon enfant ?",
        "Où trouver les factures ?",
        "Comment contacter l'école ?",
        "Comment voir les absences ?",
        "Comment payer les frais de scolarité ?",
        "Comment recevoir les notifications ?",
      ],
      secretary: [
        "Comment inscrire un nouvel élève ?",
        "Comment exporter vers Educmaster ?",
        "Où gérer les dossiers élèves ?",
        "Comment générer une attestation ?",
        "Comment transférer un élève ?",
        "Comment compléter un dossier incomplet ?",
      ],
      surveillant: [
        "Comment faire l'appel ?",
        "Comment signaler une absence ?",
        "Comment gérer un incident disciplinaire ?",
        "Où voir l'historique des absences ?",
      ],
    };

    const moduleSuggestions: Record<string, string[]> = {
      students: [
        "Comment inscrire un élève ?",
        "Où exporter vers Educmaster ?",
        "Comment gérer les transferts ?",
        "Comment voir les dossiers incomplets ?",
      ],
      pedagogy: [
        "Comment créer un EDT ?",
        "Où gérer les affectations ?",
        "Comment utiliser la bibliothèque ?",
        "Comment créer une matière ?",
      ],
      exams: [
        "Comment saisir les notes ?",
        "Comment publier les bulletins ?",
        "Où voir les statistiques ?",
        "Comment configurer le calcul des moyennes ?",
      ],
      finance: [
        "Comment voir les impayés ?",
        "Comment enregistrer un paiement ?",
        "Où voir le rapport financier ?",
        "Comment lancer une campagne de relance ?",
      ],
      hr: [
        "Comment ajouter un enseignant ?",
        "Comment calculer la paie ?",
        "Où gérer les congés ?",
        "Comment générer une attestation de travail ?",
      ],
      communication: [
        "Comment envoyer un SMS ?",
        "Comment configurer WhatsApp ?",
        "Où voir l'historique ?",
        "Comment créer une campagne ?",
      ],
      qhse: [
        "Comment signaler un incident ?",
        "Où voir les traçabilités ?",
        "Comment gérer les contrôles ?",
      ],
      orion: [
        "Comment lire les alertes ?",
        "Où voir les KPIs ?",
        "Comment interpréter les recommandations ?",
        "Quel est mon score ORION ?",
      ],
      atlas: [
        "Comment demander un document ?",
        "Comment automatiser une tâche ?",
        "Quelles actions ATLAS peut-il faire ?",
        "Comment déclencher un workflow ?",
      ],
      settings: [
        "Comment configurer l'école ?",
        "Où gérer les rôles ?",
        "Comment activer les modules ?",
        "Comment configurer la facturation ?",
      ],
    };

    const suggestions = [
      ...(moduleSuggestions[currentModule || ''] || []),
      ...(roleSuggestions[userRole || ''] || roleSuggestions.director),
    ].slice(0, 6);

    return { suggestions, userRole, currentModule };
  }

  /**
   * Retourne le contexte spécifique au module courant
   */
  private getModuleContext(module?: string): string {
    switch (module) {
      case 'students':
        return 'Module actuel : Élèves & Inscriptions — Gestion des dossiers, admissions, transferts, export Educmaster. Actions : inscrire, rechercher, filtrer, exporter, générer attestations.';
      case 'pedagogy':
        return 'Module actuel : Pédagogie — EDT, matières, affectations, espace enseignant, bibliothèque pédagogique. Actions : créer EDT, affecter enseignants, créer exercices.';
      case 'exams':
        return 'Module actuel : Examens & Bulletins — Saisie notes, moyennes auto, bulletins PDF, calcul en temps réel. Actions : saisir notes, publier bulletins, voir statistiques.';
      case 'finance':
        return 'Module actuel : Finance & Économat — Frais scolarité, recouvrement, dépenses, caisse, rapports financiers. Actions : enregistrer paiement, voir impayés, lancer recouvrement.';
      case 'hr':
        return 'Module actuel : RH & Paie — Contrats, congés, calcul salaires, CNSS, attestations. Actions : ajouter enseignant, calculer paie, gérer congés.';
      case 'communication':
        return 'Module actuel : Communication — SMS, WhatsApp, email, notifications push, campagnes. Actions : envoyer message, créer campagne, configurer canaux.';
      case 'qhse':
        return 'Module actuel : QHSE & Incidents — Hygiène, sécurité, traçabilité, contrôles. Actions : signaler incident, voir traçabilité, gérer contrôles.';
      case 'orion':
        return 'Module actuel : ORION — Alertes intelligentes, KPIs, recommandations, cockpit direction, prédictions. Actions : consulter alertes, voir KPIs, demander analyse.';
      case 'atlas':
        return 'Module actuel : ATLAS — Chat assistant, automatisations, génération de documents, workflows. Actions : demander document, déclencher workflow, automatiser.';
      case 'settings':
        return 'Module actuel : Paramètres — Configuration école, rôles, modules, facturation. Actions : configurer école, gérer rôles, activer modules.';
      default:
        return 'Aucun module spécifique sélectionné. Vous êtes sur le dashboard général.';
    }
  }
}
