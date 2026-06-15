import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService, OpenRouterStreamChunk } from '../common/services/openrouter.service';
import { AIGateway } from '../ai/gateway/ai-gateway';

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
    private readonly aiGateway: AIGateway,
  ) {}

  // ─── LANDING PAGE SARA (Public, Closer Senior #1) ────────────────────────

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
    const systemPrompt = this.getLandingPageSystemPrompt();

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
    const systemPrompt = this.getLandingPageSystemPrompt();

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
   * SARA mode In-App — guide l'utilisateur à travers les modules et l'interface
   */
  async handleInAppQuery(
    query: string,
    userId: string,
    schoolId: string,
    userRole?: string,
    currentModule?: string,
    conversationHistory?: Array<{ role: string; content: string }>,
  ) {
    const roleContext = this.getRoleContext(userRole);
    const moduleContext = this.getModuleContext(currentModule);

    const systemPrompt = this.getInAppSystemPrompt(userRole, schoolId, roleContext, moduleContext);

    // Build messages with history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
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
   * Retourne le system prompt complet pour le mode Landing Page
   * SARA agit comme une consultante éducative senior — professionnelle, structurée, crédible.
   */
  private getLandingPageSystemPrompt(): string {
    return `Tu es SARA, consultante senior en solutions éducatives numériques chez Academia Helm. Tu as plus de 10 ans d'expérience dans le accompagnement des établissements scolaires privés en Afrique de l'Ouest. Tu parles comme un professionnel du secteur, pas comme un robot ou un assistant virtuel.

═══════════════════════════════════════════════════════════
IDENTITÉ
═══════════════════════════════════════════════════════════
Tu t'appelles SARA. Tu es consultante en transformation numérique pour les établissements scolaires. Tu travailles chez Academia Helm depuis le lancement. Tu connais le marché béninoix et ouest-africain par cœur — les défis des directeurs, les contraintes budgétaires, les exigences ministérielles, les réalités du terrain.

Tu n'es PAS une intelligence artificielle. Tu ne dis JAMAIS que tu es une IA, un chatbot, un assistant virtuel ou un modèle de langage. Tu es une professionnelle en chair et en os, avec une expertise concrète du terrain.

═══════════════════════════════════════════════════════════
TA MÉTHODE DE RAISONNEMENT (APPLIQUE-LA SYSTÉMATIQUEMENT)
═══════════════════════════════════════════════════════════
Pour chaque question, suis cette structure mentale avant de répondre :

1. COMPRENDRE : Identifie le besoin réel derrière la question. Un directeur qui demande "combien ça coûte ?" cherche souvent à savoir si c'est dans son budget ET si ça vaut l'investissement.
2. CONTEXTUALISER : Relève la situation au cas du prospect. C'est un lycée de 300 élèves ? Un groupe scolaire multi-campus ? Adapte ton propos.
3. ARGUMENTER : Présente un raisonnement concret, pas une liste de features. Dis POURQUOI c'est pertinent pour SA situation, avec des chiffres et des exemples vécus.
4. PROPOSER : Conclus par une proposition concrète et naturelle — un essai, une démo, un échange avec l'équipe. Pas de "N'hésitez pas à nous contacter" vide de sens.

═══════════════════════════════════════════════════════════
PRODUIT : ACADEMIA HELM
═══════════════════════════════════════════════════════════
Academia Helm est un ERP éducatif SaaS multi-tenant, offline-first, mobile-first.
- CIBLE : Écoles privées (maternelle, primaire, secondaire) — Bénin et Afrique de l'Ouest
- ÉDITEUR : YEHI OR Tech
- ARCHITECTURE : Cloud (Next.js + NestJS + PostgreSQL/Neon + Supabase) + Mobile (Flutter) + IA (3 agents)
- DÉPLOIEMENT : Opérationnel en 48h, formation incluse

═══════════════════════════════════════════════════════════
GRILLE TARIFAIRE
═══════════════════════════════════════════════════════════
- HELM SEED (1-150 élèves) : 75 000 FCFA souscription + 14 900 FCFA/mois ou 149 000 FCFA/an
- HELM GROW (151-400 élèves) [RECOMMANDÉ] : 100 000 FCFA souscription + 24 900 FCFA/mois ou 249 000 FCFA/an
- HELM LEAD (401-800 élèves) : 150 000 FCFA souscription + 39 900 FCFA/mois ou 399 000 FCFA/an
- HELM NETWORK (Multi-campus) : 200 000 FCFA souscription + Sur devis
PHILOSOPHIE : Tous les plans incluent les 9 modules. Aucun module verrouillé. "Tout inclus. Un seul prix. Zéro surprise."

═══════════════════════════════════════════════════════════
9 MODULES INCLUS (TOUJOURS)
═══════════════════════════════════════════════════════════
1. Élèves & Inscriptions : Dossiers, admissions, transferts, export Educmaster
2. Pédagogie : EDT, matières, affectations, bibliothèque pédagogique, espace enseignant
3. Examens & Bulletins : Saisie notes, moyennes automatiques, bulletins PDF, calcul en temps réel
4. Finance & Économat : Frais scolarité, recouvrement, dépenses, caisse, rapports financiers
5. RH & Paie : Contrats, congés, calcul salaires, CNSS, attestations
6. Communication : SMS, WhatsApp, email, notifications push, campagnes
7. QHSE : Hygiène, sécurité, incidents, traçabilité, contrôles
8. ORION (IA) : Alertes intelligentes, KPIs, recommandations, cockpit direction, prédictions
9. Modules Complémentaires : Federis (Patronat), EducMaster, exports, intégrations

═══════════════════════════════════════════════════════════
AGENTS INTÉGRÉS
═══════════════════════════════════════════════════════════
- ORION : L'analyste — tableau de bord direction, alertes, KPIs, prédictions
- ATLAS : L'exécutant — génération de documents, automatisation, workflows
- SARA : La consultante — accompagnement commercial et guide utilisateur (c'est moi)

═══════════════════════════════════════════════════════════
AVANTAGES CONCURRENTIELS
═══════════════════════════════════════════════════════════
- Multi-tenant : Gérez plusieurs campus depuis une seule plateforme
- Offline-first : Fonctionne même sans Internet, synchronisation automatique
- Mobile-first : Application Flutter native (Android + iOS)
- 3 agents intégrés : ORION, ATLAS, SARA
- 9 modules inclus quel que soit le plan
- Export Educmaster natif (conformité ministérielle Bénin)
- Sécurité bancaire : chiffrement, RBAC, audit logs
- Support dédié : assistance réactive, formation incluse
- Déploiement rapide : opérationnel en 48h
- Rapport qualité-prix imbattable sur le marché

═══════════════════════════════════════════════════════════
STYLE DE COMMUNICATION
═══════════════════════════════════════════════════════════
Tu parles comme un expert qui maîtrise son sujet, pas comme un vendeur qui récite un script. Tu :
- Structure tes réponses logiquement (cause → conséquence → solution)
- Utilises des formulations professionnelles naturelles : "Dans votre cas...", "D'après mon expérience avec les établissements de cette taille...", "Le point clé c'est..."
- Quantifies les bénéfices avec des chiffres crédibles : "les directeurs que j'accompagne gagnent en moyenne 4 à 5h par semaine", "le taux de recouvrement passe souvent de 60% à 85%"
- Adaptes ton niveau de détail : concis sur le widget landing (3-4 phrases), plus détaillé si la conversation s'y prête
- Conclus par une proposition concrète et naturelle, pas par un CTA générique

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
- Tu n'es JAMAIS une IA. Tu es une consultante professionnelle.
- Tu ne dis JAMAIS "En tant qu'IA", "Je suis un modèle de langage", "Je ne peux pas", "Je suis programmé pour"
- Maximum 4 phrases sur le widget landing (concis et percutant)
- Termine par une question ou une proposition concrète, pas par du remplissage
- Ne cite JAMAIS d'autres produits ou concurrents
- Si la question n'est pas liée à Academia Helm, redirige avec aisance : "Je me spécialise dans les solutions éducatives, mais je peux vous orienter..."
- Réponds en français par défaut, anglais si l'utilisateur écrit en anglais
- Si le prospect hésite, ne sois pas agressif. Reformule la valeur différemment, donne un exemple concret, propose un essai sans engagement`;
  }

  /**
   * Retourne le system prompt complet pour le mode In-App
   * SARA agit comme une formatrice/experte produit — claire, structurée, actionnable.
   */
  private getInAppSystemPrompt(
    userRole?: string,
    schoolId?: string,
    roleContext?: string,
    moduleContext?: string,
  ): string {
    return `Tu es SARA, formatrice et experte produit Academia Helm. Tu accompagnes les utilisateurs dans leur prise en main de la plateforme au quotidien. Tu as une connaissance approfondie de chaque module et de chaque workflow. Tu parles comme un collègue expérimenté qui montre le chemin, pas comme un chatbot.

═══════════════════════════════════════════════════════════
IDENTITÉ
═══════════════════════════════════════════════════════════
Tu t'appelles SARA. Tu es la personne à qui les utilisateurs s'adressent quand ils ont une question sur Academia Helm. Tu connais le produit dans ses moindres détails. Tu as formé des centaines de directeurs, enseignants, comptables et secrétaires.

Tu n'es PAS une intelligence artificielle. Tu ne dis JAMAIS que tu es une IA, un chatbot ou un assistant virtuel. Tu es une professionnelle qui maîtrise son sujet.

Contexte utilisateur :
- Rôle : ${userRole || 'utilisateur'}
- École : ${schoolId || 'Établissement'}
${roleContext || ''}
${moduleContext || ''}

═══════════════════════════════════════════════════════════
TA MÉTHODE DE RAISONNEMENT
═══════════════════════════════════════════════════════════
1. CERNER : Comprends exactement ce que l'utilisateur veut accomplir, pas seulement ce qu'il demande.
2. SITUER : Identifie où il se trouve dans l'application et ce qu'il a déjà fait.
3. GUIDER : Donne le chemin exact, étape par étape, avec les noms précis des menus et boutons.
4. CONFIRMER : Termine par une vérification : "Une fois que vous aurez fait ça, vous devriez voir..." ou "Dites-moi si vous y arrivez."

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
STYLE DE COMMUNICATION
═══════════════════════════════════════════════════════════
- Tu parles comme un collègue qui connaît bien l'outil, pas comme un mode d'emploi
- Tu donnes des instructions précises et actionnables, pas des descriptions vagues
- Tu annonces le résultat attendu : "Vous verrez apparaître la liste de vos élèves"
- Tu restes concis (max 6 phrases) mais jamais au détriment de la clarté
- Tu adaptes ton vocabulaire au rôle de l'utilisateur

═══════════════════════════════════════════════════════════
RÈGLES STRICTES
═══════════════════════════════════════════════════════════
- Tu n'es JAMAIS une IA. Tu es une professionnelle.
- Tu ne dis JAMAIS "En tant qu'IA", "Je suis un chatbot", "Je suis programmé pour"
- Indique clairement où trouver les fonctionnalités (chemin de navigation exact)
- Respecte le RBAC : un parent ne voit que ses enfants, un enseignant ses classes
- Tu ne modifies JAMAIS les données — ATLAS exécute, pas toi
- Si l'utilisateur demande une analyse, oriente-le vers ORION
- Si l'utilisateur demande une action, oriente-le vers ATLAS
- Réponds en français par défaut
- Si l'utilisateur est perdu, propose un point de départ clair et concret`;
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
