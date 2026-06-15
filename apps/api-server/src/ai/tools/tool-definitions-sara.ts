/**
 * ============================================================================
 * SARA PRODUCT KNOWLEDGE TOOLS — Outils spécifiques à SARA
 * ============================================================================
 *
 * SARA est l'ambassadrice du PRODUIT Academia Helm. Elle connaît :
 *   - Le produit : modules, fonctionnalités, tarifs, architecture
 *   - Les témoignages : parents, enseignants, directeurs
 *   - L'entreprise : YEHI OR Tech, l'équipe fondatrice
 *   - La navigation : comment utiliser chaque module
 *   - La FAQ : questions fréquentes des prospects et utilisateurs
 *
 * IMPORTANT : SARA n'a AUCUN accès aux données opérationnelles des écoles.
 * Ces outils ne requièrent PAS de tenantId — ce sont des données produit globales.
 */

import {
  ToolDefinition,
  MCPContext,
  ToolResult,
} from '../types/ai.types';

// ─── SHARED HELPER ───────────────────────────────────────────────────────

function createToolResult(data: unknown, source: string, startTime: number): ToolResult {
  return {
    success: true,
    data,
    metadata: {
      queryTime: Date.now() - startTime,
      source,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BASE DE CONNAISSANCES PRODUIT — Academia Helm
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Données complètes sur le produit Academia Helm.
 * Cette base de connaissances est utilisée par les outils SARA
 * pour fournir des réponses précises et détaillées.
 *
 * Quand une base de données RAG sera disponible, ces données
 * pourront être migrées vers pgvector/Qdrant.
 */
const PRODUCT_KNOWLEDGE = {
  // ─── IDENTITÉ PRODUIT ────────────────────────────────────────────────────
  product: {
    name: 'Academia Helm',
    tagline: 'Le ERP éducatif qui transforme la gestion de votre école',
    description: 'Academia Helm est un ERP éducatif SaaS multi-tenant, offline-first, mobile-first, conçu spécifiquement pour les écoles privées d\'Afrique de l\'Ouest. Il centralise la gestion complète d\'un établissement scolaire : de l\'inscription des élèves à la génération des bulletins, en passant par la gestion financière, les ressources humaines et la communication avec les parents.',
    target: 'Écoles privées (maternelle, primaire, secondaire) — Bénin et Afrique de l\'Ouest',
    editor: 'YEHI OR Tech',
    architecture: 'Cloud (Next.js + NestJS + PostgreSQL/Neon + Supabase) + Mobile (Flutter) + IA (3 agents via GLM 5.1)',
    deployment: 'Déploiement rapide : opérationnel en 48h',
    philosophy: 'Tout inclus. Un seul prix. Zéro surprise.',
    security: 'Chiffrement de bout en bout, RBAC granulaire, audit logs complets, conformité RGPD',
    offline: 'Fonctionne même sans connexion Internet. Synchronisation automatique quand le réseau revient.',
    mobile: 'Application Flutter native disponible sur Android et iOS',
    multiTenant: 'Gérez plusieurs campus depuis une seule plateforme avec isolation complète des données',
  },

  // ─── CRÉATEURS ────────────────────────────────────────────────────────────
  company: {
    name: 'YEHI OR Tech',
    description: 'YEHI OR Tech est une entreprise technologique béninoise spécialisée dans les solutions logicielles pour l\'éducation en Afrique. Fondée par des passionnés de la tech et de l\'éducation, elle développe des outils qui répondent aux réalités du terrain africain : connectivité limitée, besoins de mobilité, et gestion multi-campus.',
    mission: 'Démocratiser l\'accès à une gestion scolaire moderne et efficace pour toutes les écoles privées d\'Afrique de l\'Ouest',
    vision: 'Devenir la plateforme de référence pour la gestion éducative en Afrique francophone',
    values: [
      'Innovation adaptée au contexte africain',
      'Accessibilité financière pour toutes les écoles',
      'Excellence technique et fiabilité',
      'Impact social mesurable sur l\'éducation',
      'Proximité avec les utilisateurs',
    ],
    founded: 'Bénin, Afrique de l\'Ouest',
    team: 'Une équipe pluridisciplinaire d\'ingénieurs, designers et experts en éducation',
    contact: 'contact@yehiortech.com',
    website: 'https://academiahelm.com',
  },

  // ─── TARIFICATION ─────────────────────────────────────────────────────────
  pricing: {
    philosophy: 'Tous les plans incluent les 9 modules. Aucun module verrouillé. Aucune surprise.',
    plans: [
      {
        name: 'HELM SEED',
        target: 'Petites écoles (1-150 élèves)',
        subscription: 75000,
        monthly: 14900,
        annual: 149000,
        currency: 'FCFA',
        highlights: ['Idéal pour démarrer', '9 modules inclus', '3 agents IA', 'Support dédié'],
        dailyCost: 'Moins de 500 FCFA/jour',
      },
      {
        name: 'HELM GROW',
        target: 'Écoles en croissance (151-400 élèves)',
        subscription: 100000,
        monthly: 24900,
        annual: 249000,
        currency: 'FCFA',
        recommended: true,
        highlights: ['Le plus populaire', '9 modules inclus', '3 agents IA', 'Support prioritaire', 'Formation avancée'],
        dailyCost: 'Moins de 830 FCFA/jour',
      },
      {
        name: 'HELM LEAD',
        target: 'Grands établissements (401-800 élèves)',
        subscription: 150000,
        monthly: 39900,
        annual: 399000,
        currency: 'FCFA',
        highlights: ['Pour les leaders', '9 modules inclus', '3 agents IA', 'Support VIP', 'Formation complète', 'Consultant dédié'],
        dailyCost: 'Moins de 1 330 FCFA/jour',
      },
      {
        name: 'HELM NETWORK',
        target: 'Réseau multi-campus',
        subscription: 200000,
        monthly: null,
        annual: null,
        currency: 'FCFA',
        customPricing: true,
        highlights: ['Multi-campus', '9 modules inclus', '3 agents IA', 'Account manager dédié', 'SLA personnalisé', 'API avancée'],
        dailyCost: 'Sur devis',
      },
    ],
    addOns: [
      { name: 'Fédération FEDERIS', description: 'Intégration avec la Fédération Patronat pour les écoles sous convention' },
      { name: 'Export Educmaster', description: 'Export natif vers le format ministériel Educmaster (Bénin)' },
      { name: 'Paiement en ligne FedaPay', description: 'Intégration FedaPay pour les paiements en ligne des frais de scolarité' },
      { name: 'WhatsApp Business API', description: 'Connexion directe avec WhatsApp Business pour les communications automatiques' },
    ],
    paymentMethods: ['Virement bancaire', 'Mobile Money', 'FedaPay (en ligne)', 'Espèces'],
    gracePeriod: 'Période de grâce de 7 jours après expiration pour récupérer vos données',
    trial: 'Essai gratuit de 7 jours — aucun engagement, aucune carte bancaire requise',
  },

  // ─── MODULES DÉTAILLÉS ────────────────────────────────────────────────────
  modules: [
    {
      id: 'students',
      name: 'Élèves & Inscriptions',
      icon: '🎓',
      description: 'Gestion complète du cycle de vie des élèves : dossier administratif, admissions, transferts, export Educmaster, attestations de scolarité.',
      features: [
        'Dossier élève complet (informations personnelles, médicales, contacts d\'urgence)',
        'Gestion des admissions et pré-inscriptions en ligne',
        'Transferts entrants et sortants',
        'Export natif vers Educmaster (conformité ministérielle Bénin)',
        'Génération d\'attestations de scolarité et certificats',
        'Recherche avancée multi-critères',
        'Historique complet des modifications',
        'Suivi des dossiers incomplets',
      ],
      navigation: 'Dashboard → Élèves & Inscriptions',
      useCase: 'La secrétaire de scolarité gère les inscriptions, les dossiers élèves et les exports Educmaster en quelques clics.',
    },
    {
      id: 'pedagogy',
      name: 'Pédagogie',
      icon: '📚',
      description: 'Organisation pédagogique complète : emplois du temps, matières, affectations, bibliothèque pédagogique, espace enseignant.',
      features: [
        'Création et gestion des emplois du temps (EDT)',
        'Gestion des matières et programmes',
        'Affectation enseignants-classes-matières',
        'Bibliothèque pédagogique collaborative',
        'Espace enseignant dédié',
        'Génération d\'exercices et d\'évaluations par IA',
        'Progression pédagogique',
        'Compétences et savoir-faire',
      ],
      navigation: 'Dashboard → Organisation Pédagogique',
      useCase: 'Le directeur pédagogique planifie l\'EDT, affecte les enseignants et suit la progression pédagogique de chaque classe.',
    },
    {
      id: 'exams',
      name: 'Examens & Bulletins',
      icon: '📝',
      description: 'Saisie des notes, calcul automatique des moyennes, génération de bulletins PDF, statistiques en temps réel.',
      features: [
        'Saisie des notes par matière et par période',
        'Calcul automatique des moyennes (arithmétique, pondérée, par coefficient)',
        'Génération de bulletins PDF personnalisables',
        'Statistiques d\'examen en temps réel',
        'Publication des résultats aux parents',
        'Gestion des compositions et examens blancs',
        'Classement automatique',
        'Conseils de classe numériques',
      ],
      navigation: 'Dashboard → Examens, Notes & Bulletins',
      useCase: 'L\'enseignant saisit les notes, le système calcule les moyennes automatiquement et génère les bulletins PDF pour les parents.',
    },
    {
      id: 'finance',
      name: 'Finance & Économat',
      icon: '💰',
      description: 'Gestion financière complète : frais de scolarité, recouvrement, dépenses, caisse, rapports financiers détaillés.',
      features: [
        'Configuration des frais de scolarité par classe et catégorie',
        'Suivi des paiements et reçus',
        'Gestion du recouvrement et des impayés',
        'Tableau de bord financier en temps réel',
        'Gestion des dépenses et de la caisse',
        'Rapports financiers détaillés',
        'Paiement en ligne via FedaPay',
        'Relances automatiques (SMS, WhatsApp, email)',
      ],
      navigation: 'Dashboard → Finance & Économat',
      useCase: 'Le comptable suit les paiements, identifie les impayés et lance des campagnes de recouvrement automatiques.',
    },
    {
      id: 'hr',
      name: 'RH & Paie',
      icon: '👔',
      description: 'Gestion des ressources humaines : contrats, congés, calcul des salaires, CNSS, attestations de travail.',
      features: [
        'Gestion des contrats enseignants et personnel',
        'Suivi des congés et absences',
        'Calcul automatique des salaires',
        'Gestion des cotisations CNSS',
        'Génération d\'attestations de travail',
        'Fiches de paie détaillées',
        'Historique des augmentations',
        'Tableau de bord RH',
      ],
      navigation: 'Dashboard → RH & Paie',
      useCase: 'Le directeur gère les contrats, les salaires et les congés du personnel depuis un tableau de bord unifié.',
    },
    {
      id: 'communication',
      name: 'Communication',
      icon: '📢',
      description: 'Communication multicanale : SMS, WhatsApp, email, notifications push, campagnes automatisées.',
      features: [
        'Envoi de SMS groupés ou individuels',
        'Messages WhatsApp Business',
        'Emails automatisés et modèles',
        'Notifications push mobiles',
        'Création de campagnes de communication',
        'Historique complet des échanges',
        'Modèles de messages prédéfinis',
        'Planification d\'envois différés',
      ],
      navigation: 'Dashboard → Communication',
      useCase: 'La secrétaire envoie des SMS de rappel aux parents pour les réunions et les paiements en un clic.',
    },
    {
      id: 'qhse',
      name: 'QHSE',
      icon: '🛡️',
      description: 'Qualité, Hygiène, Sécurité, Environnement : gestion des incidents, traçabilité, contrôles réglementaires.',
      features: [
        'Signalement et suivi des incidents',
        'Traçabilité complète des événements',
        'Contrôles réglementaires',
        'Plans d\'action correctifs',
        'Tableau de bord QHSE',
        'Rapports d\'inspection',
        'Gestion des risques',
        'Conformité réglementaire',
      ],
      navigation: 'Dashboard → QHSE & Incidents',
      useCase: 'Le surveillant signale un incident, le directeur suit la résolution et le plan d\'action dans le tableau QHSE.',
    },
    {
      id: 'orion',
      name: 'ORION (IA)',
      icon: '🧠',
      description: 'Agent IA analytique : alertes intelligentes, KPIs, recommandations, cockpit direction, prédictions.',
      features: [
        'Score ORION (santé globale de l\'établissement, 0-100)',
        'Alertes intelligentes en temps réel',
        'KPIs automatisés (académique, finance, RH)',
        'Recommandations actionnables',
        'Cockpit directionnel',
        'Prédictions (risque d\'abandon, impayés, sous-effectif)',
        'Analyse par domaine (Academic, Finance, RH, Compliance, Security)',
        'Rapports IA mensuels',
      ],
      navigation: 'Dashboard → ORION',
      useCase: 'Le directeur consulte ORION chaque matin : alertes sur les impayés critiques, prédictions de risques élèves, recommandations d\'action.',
    },
    {
      id: 'complementaires',
      name: 'Modules Complémentaires',
      icon: '🔌',
      description: 'Intégrations et extensions : Federis, EducMaster, exports, API avancée.',
      features: [
        'Intégration Fédération FEDERIS',
        'Export Educmaster natif (conformité Bénin)',
        'Intégrations tierces via API',
        'Export PDF et Excel',
        'Synchronisation mobile',
        'Webhooks',
      ],
      navigation: 'Dashboard → Paramètres → Intégrations',
      useCase: 'L\'école exporte ses données au format Educmaster pour les transmissions ministérielles en un clic.',
    },
  ],

  // ─── AGENTS IA ────────────────────────────────────────────────────────────
  aiAgents: [
    {
      name: 'ORION',
      role: 'L\'Analyste',
      description: 'ORION est le cerveau analytique de la plateforme. Il observe, analyse, prédit et recommande. En LECTURE SEULE — il ne modifie jamais aucune donnée. Il calcule le Score ORION (0-100), génère des alertes intelligentes et des prédictions sur la santé de l\'établissement.',
      capabilities: ['Analyse multi-domaine', 'Score ORION', 'Alertes temps réel', 'Prédictions', 'KPIs automatisés', 'Recommandations'],
    },
    {
      name: 'ATLAS',
      role: 'L\'Exécutant',
      description: 'ATLAS est le bras opérationnel. Il prépare et exécute les actions autorisées : génération de documents (attestations, bulletins, reçus), envoi de notifications (SMS, WhatsApp, email), lancement de workflows automatisés (campagnes de recouvrement, génération de bulletins).',
      capabilities: ['Génération de documents', 'Notifications multicanal', 'Workflows automatisés', 'Campagnes', 'Exports'],
    },
    {
      name: 'SARA',
      role: 'L\'Assistante & Closer',
      description: 'SARA est l\'ambassadrice du produit. Sur le site public, elle est Closer Senior #1 et convertit les prospects en clients. Dans l\'application, elle guide les utilisateurs et répond aux questions sur le produit et ses fonctionnalités.',
      capabilities: ['Closing commercial', 'Guide utilisateur', 'Connaissances produit', 'Navigation', 'FAQ', 'Témoignages clients'],
    },
  ],

  // ─── TÉMOIGNAGES CLIENTS ──────────────────────────────────────────────────
  testimonials: [
    {
      id: 'testimony-1',
      type: 'PARENT',
      name: 'Mme Adjo Dossou',
      role: 'Parent d\'élève',
      school: 'École La Pépinière, Cotonou',
      content: 'Depuis que l\'école de mon fils utilise Academia Helm, je reçois ses notes et ses bulletins directement sur mon téléphone. Plus besoin d\'attendre la fin du trimestre pour savoir comment il s\'en sort. Je peux suivre sa progression en temps réel !',
      highlight: 'Suivi en temps réel des résultats scolaires',
      rating: 5,
    },
    {
      id: 'testimony-2',
      type: 'PARENT',
      name: 'M. Kofi Mensah',
      role: 'Parent d\'élève',
      school: 'Complexe Scolaire Les Étoiles, Parakou',
      content: 'Le paiement en ligne des frais de scolarité a changé notre vie. Plus de files d\'attente, plus de stress. Je paie depuis mon salon et je reçois le reçu instantanément. Même à l\'étranger, je peux régler les frais de mes enfants sans problème.',
      highlight: 'Paiement en ligne facile et rapide',
      rating: 5,
    },
    {
      id: 'testimony-3',
      type: 'ENSEIGNANT',
      name: 'M. Aimé Hounsou',
      role: 'Professeur de Mathématiques',
      school: 'Collège Privé Saint-Michel, Porto-Novo',
      content: 'La saisie des notes est devenue un jeu d\'enfant. Avant, je passais des heures à calculer les moyennes et à remplir les bulletins à la main. Maintenant, le système fait tout automatiquement et les bulletins sont prêts en un clic. Je peux enfin me concentrer sur l\'essentiel : enseigner.',
      highlight: 'Automatisation du calcul des moyennes et bulletins',
      rating: 5,
    },
    {
      id: 'testimony-4',
      type: 'ENSEIGNANT',
      name: 'Mme Rachida Bello',
      role: 'Professeure de Français',
      school: 'École Primaire Le Palmier, Abomey-Calavi',
      content: 'La bibliothèque pédagogique et l\'espace enseignant me permettent de partager des ressources avec mes collègues. L\'IA génère même des exercices personnalisés pour mes élèves selon leur niveau. C\'est un assistant pédagogique qui ne dort jamais !',
      highlight: 'Bibliothèque pédagogique et génération IA d\'exercices',
      rating: 5,
    },
    {
      id: 'testimony-5',
      type: 'DIRECTEUR',
      name: 'M. Pascal Agossa',
      role: 'Directeur d\'établissement',
      school: 'Institut Scolaire Les Savanes, Cotonou',
      content: 'ORION a révolutionné ma gestion quotidienne. Chaque matin, je consulte mon Score ORION et les alertes prioritaires. Les impayés ont baissé de 40% grâce aux campagnes de recouvrement automatiques. C\'est comme avoir un assistant directeur qui ne rate rien.',
      highlight: 'Score ORION et réduction de 40% des impayés',
      rating: 5,
    },
    {
      id: 'testimony-6',
      type: 'DIRECTEUR',
      name: 'Mme Clarisse Houéssou',
      role: 'Directrice d\'école primaire',
      school: 'École Montessori Les Petits Génies, Cotonou',
      content: 'En 48h, mon école était opérationnelle sur Academia Helm. L\'interface est intuitive, mon équipe a été formée rapidement. Le support est exceptionnel — ils répondent toujours dans l\'heure. Et le mode offline nous sauve quand le réseau est instable.',
      highlight: 'Déploiement en 48h et support réactif',
      rating: 5,
    },
    {
      id: 'testimony-7',
      type: 'COMPTABLE',
      name: 'M. Thierno Diallo',
      role: 'Comptable',
      school: 'Lycée Privé L\'Avenir, Cotonou',
      content: 'La gestion financière est devenue transparente. Je vois les encaissements, les impayés, les dépenses en un coup d\'œil. Les rapports financiers se génèrent automatiquement et les reçus sont envoyés aux parents instantanément. Fini les fichiers Excel interminables !',
      highlight: 'Rapports financiers automatiques et reçus instantanés',
      rating: 5,
    },
    {
      id: 'testimony-8',
      type: 'PARENT',
      name: 'Mme Fatou Ouédraogo',
      role: 'Parent d\'élève',
      school: 'École Les Cactus, Parakou',
      content: 'Je reçois des notifications WhatsApp quand mon enfant est absent ou quand ses notes sont publiées. Cette transparence me rassure énormément. Je me sens vraiment impliquée dans le suivi de sa scolarité, même quand je suis au travail.',
      highlight: 'Notifications WhatsApp en temps réel',
      rating: 5,
    },
  ],

  // ─── FAQ ──────────────────────────────────────────────────────────────────
  faq: [
    {
      question: 'Combien coûte Academia Helm ?',
      answer: 'Academia Helm propose 4 plans : HELM SEED à partir de 14 900 FCFA/mois (1-150 élèves), HELM GROW à 24 900 FCFA/mois (151-400 élèves, le plus populaire), HELM LEAD à 39 900 FCFA/mois (401-800 élèves), et HELM NETWORK sur devis pour les multi-campus. Tous les plans incluent les 9 modules et les 3 agents IA. Un essai gratuit de 7 jours est disponible.',
      category: 'PRICING',
    },
    {
      question: 'Y a-t-il un essai gratuit ?',
      answer: 'Oui ! Vous pouvez essayer Academia Helm gratuitement pendant 7 jours. Aucun engagement, aucune carte bancaire requise. Vous accédez à toutes les fonctionnalités pendant la période d\'essai.',
      category: 'PRICING',
    },
    {
      question: 'Que se passe-t-il si je ne paie pas à temps ?',
      answer: 'Vous bénéficiez d\'une période de grâce de 7 jours après l\'expiration de votre abonnement. Pendant cette période, vous pouvez toujours accéder à vos données et effectuer un paiement. Après la période de grâce, l\'accès est suspendu mais vos données restent sécurisées pendant 30 jours.',
      category: 'PRICING',
    },
    {
      question: 'Est-ce que ça fonctionne sans Internet ?',
      answer: 'Oui ! Academia Helm est offline-first. Vous pouvez continuer à travailler normalement même sans connexion Internet. Dès que le réseau revient, vos données se synchronisent automatiquement avec le cloud.',
      category: 'TECHNICAL',
    },
    {
      question: 'Mes données sont-elles sécurisées ?',
      answer: 'Absolument. Academia Helm utilise un chiffrement de bout en bout, un contrôle d\'accès granulaire (RBAC), des audit logs complets, et est conforme au RGPD. Chaque école a ses données strictement isolées (multi-tenant). Nous utilisons PostgreSQL sur Neon avec des sauvegardes automatiques.',
      category: 'SECURITY',
    },
    {
      question: 'Combien de temps prend le déploiement ?',
      answer: 'Votre école peut être opérationnelle en 48h seulement. Notre équipe vous accompagne dans la configuration initiale, l\'import de vos données existantes, et la formation de votre équipe.',
      category: 'ONBOARDING',
    },
    {
      question: 'Quels moyens de paiement acceptez-vous ?',
      answer: 'Nous acceptons les virements bancaires, le Mobile Money (MTN, Moov), FedaPay pour les paiements en ligne, et les espèces. Les parents peuvent aussi payer les frais de scolarité en ligne via FedaPay.',
      category: 'PRICING',
    },
    {
      question: 'Puis-je gérer plusieurs écoles ?',
      answer: 'Oui, avec le plan HELM NETWORK. Vous gérez tous vos campus depuis une seule plateforme avec un tableau de bord multi-établissements. Chaque campus a ses données isolées, mais vous avez une vue consolidée.',
      category: 'FEATURES',
    },
    {
      question: 'Qu\'est-ce que ORION ?',
      answer: 'ORION est l\'agent IA analytique d\'Academia Helm. Il calcule le Score ORION (santé globale de votre école de 0 à 100), génère des alertes intelligentes, des prédictions (risque d\'abandon, impayés), et des recommandations actionnables. C\'est votre assistant directeur intelligent.',
      category: 'FEATURES',
    },
    {
      question: 'Qu\'est-ce que ATLAS ?',
      answer: 'ATLAS est l\'agent IA d\'exécution. Il génère des documents (attestations, bulletins, reçus), envoie des notifications (SMS, WhatsApp, email), et automatise des workflows (campagnes de recouvrement, génération de bulletins, rapports mensuels). Il agit toujours avec votre confirmation pour les actions critiques.',
      category: 'FEATURES',
    },
    {
      question: 'Comment fonctionne l\'export Educmaster ?',
      answer: 'Academia Helm offre un export natif au format Educmaster, le standard ministériel du Bénin. En un clic, vous générez le fichier conforme pour vos transmissions au ministère. Plus besoin de doubles saisies !',
      category: 'FEATURES',
    },
    {
      question: 'Les parents ont-ils accès à une application ?',
      answer: 'Oui ! Les parents ont accès à un portail dédié et à l\'application mobile Academia Helm. Ils peuvent consulter les notes, les absences, les bulletins, payer en ligne, et communiquer avec l\'école. Ils reçoivent aussi des notifications en temps réel par SMS, WhatsApp ou email.',
      category: 'FEATURES',
    },
  ],

  // ─── AVANTAGES CONCURRENTIELS ─────────────────────────────────────────────
  competitiveAdvantages: [
    { title: 'Multi-tenant', description: 'Gérez plusieurs campus depuis une seule plateforme avec isolation complète des données' },
    { title: 'Offline-first', description: 'Fonctionne même sans Internet, synchronisation automatique quand le réseau revient' },
    { title: 'Mobile-first', description: 'Application Flutter native disponible sur Android et iOS pour tous les utilisateurs' },
    { title: '3 Agents IA intégrés', description: 'ORION (analyse), ATLAS (exécution), SARA (assistance) propulsés par GLM 5.1' },
    { title: '9 modules inclus', description: 'Quel que soit le plan, vous accédez à tous les modules — zéro fonctionnalité verrouillée' },
    { title: 'Export Educmaster natif', description: 'Conformité ministérielle Bénin assurée, export en un clic' },
    { title: 'Sécurité bancaire', description: 'Chiffrement, RBAC, audit logs, conformité RGPD' },
    { title: 'Support dédié', description: 'Assistance réactive, formation incluse, répond dans l\'heure' },
    { title: 'Déploiement rapide', description: 'Opérationnel en 48h, configuration et formation incluses' },
    { title: 'Rapport qualité-prix imbattable', description: 'À partir de 14 900 FCFA/mois pour un ERP complet avec IA intégrée' },
  ],

  // ─── GUIDE DE NAVIGATION ──────────────────────────────────────────────────
  navigationGuides: [
    { module: 'students', path: 'Dashboard → Élèves & Inscriptions', description: 'Dossiers, admissions, transferts, export Educmaster' },
    { module: 'pedagogy', path: 'Dashboard → Organisation Pédagogique', description: 'EDT, matières, affectations, bibliothèque pédagogique' },
    { module: 'exams', path: 'Dashboard → Examens, Notes & Bulletins', description: 'Saisie, calcul automatique, publication bulletins' },
    { module: 'finance', path: 'Dashboard → Finance & Économat', description: 'Frais, recouvrement, dépenses, caisse, rapports' },
    { module: 'hr', path: 'Dashboard → RH & Paie', description: 'Contrats, congés, paie, CNSS, attestations' },
    { module: 'communication', path: 'Dashboard → Communication', description: 'SMS, WhatsApp, email, notifications push, campagnes' },
    { module: 'qhse', path: 'Dashboard → QHSE & Incidents', description: 'Signalement, traçabilité, contrôles' },
    { module: 'orion', path: 'Dashboard → ORION', description: 'Alertes intelligentes, KPIs, recommandations, cockpit direction' },
    { module: 'atlas', path: 'Dashboard → ATLAS', description: 'Chat assistant, automatisations, génération de documents, workflows' },
    { module: 'settings', path: 'Dashboard → Paramètres', description: 'Configuration école, rôles, modules, facturation' },
  ],

  // ─── GUIDE D'ONBOARDING ──────────────────────────────────────────────────
  onboardingSteps: [
    { step: 1, action: 'Configurer votre école', path: 'Dashboard → Paramètres → Configuration', description: 'Nom de l\'école, logo, année académique, périodes' },
    { step: 2, action: 'Créer vos classes', path: 'Dashboard → Pédagogie → Classes', description: 'Ajoutez vos classes avec les niveaux et les options' },
    { step: 3, action: 'Inscrire vos élèves', path: 'Dashboard → Élèves & Inscriptions → Nouvelle inscription', description: 'Ajoutez les élèves ou importez depuis un fichier' },
    { step: 4, action: 'Configurer les frais de scolarité', path: 'Dashboard → Finance → Configuration des frais', description: 'Définissez les montants par classe et catégorie' },
    { step: 5, action: 'Découvrir ORION', path: 'Dashboard → ORION', description: 'Consultez votre Score ORION et les premières alertes' },
    { step: 6, action: 'Essayer ATLAS', path: 'Dashboard → ATLAS', description: 'Générez votre premier document ou lancez un workflow' },
  ],
};


// ═══════════════════════════════════════════════════════════════════════════
// OUTILS SARA — Fonctions de recherche dans la base de connaissances
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Recherche dans la base de connaissances produit d'Academia Helm.
 * Couvre : FAQ, guides, fonctionnalités, procédures.
 */
export function createProductKnowledgeTool(): ToolDefinition {
  return {
    name: 'search_product_knowledge',
    description: 'Recherche dans la base de connaissances Academia Helm : FAQ, guides d\'utilisation, fonctionnalités, procédures, architecture technique, et informations produit.',
    version: '1.0.0',
    agent: 'SARA',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Question ou sujet de recherche (requis)' },
        category: { type: 'string', enum: ['FAQ', 'FEATURES', 'PRICING', 'TECHNICAL', 'SECURITY', 'ONBOARDING', 'ALL'], description: 'Catégorie de recherche (optionnel)' },
      },
      required: ['query'],
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, _context) => {
      const start = Date.now();
      const query = (params.query as string).toLowerCase();
      const category = (params.category as string) || 'ALL';

      // Recherche dans la FAQ
      const faqResults = PRODUCT_KNOWLEDGE.faq
        .filter(item => category === 'ALL' || item.category === category)
        .filter(item =>
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query) ||
          query.split(' ').some(word => word.length > 2 && (item.question.toLowerCase().includes(word) || item.answer.toLowerCase().includes(word)))
        )
        .map(item => ({ question: item.question, answer: item.answer, category: item.category }));

      // Recherche dans les modules
      const moduleResults = PRODUCT_KNOWLEDGE.modules.filter(module =>
        module.name.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query) ||
        module.features.some(f => f.toLowerCase().includes(query)) ||
        query.split(' ').some(word => word.length > 2 && (module.name.toLowerCase().includes(word) || module.description.toLowerCase().includes(word)))
      ).map(m => ({ name: m.name, description: m.description, features: m.features, navigation: m.navigation }));

      // Recherche dans les avantages concurrentiels
      const advantageResults = PRODUCT_KNOWLEDGE.competitiveAdvantages.filter(adv =>
        adv.title.toLowerCase().includes(query) ||
        adv.description.toLowerCase().includes(query) ||
        query.split(' ').some(word => word.length > 2 && (adv.title.toLowerCase().includes(word) || adv.description.toLowerCase().includes(word)))
      );

      return createToolResult({
        query: params.query,
        faqResults,
        moduleResults,
        advantageResults,
        totalResults: faqResults.length + moduleResults.length + advantageResults.length,
      }, 'search_product_knowledge', start);
    },
  };
}

/**
 * Récupère les témoignages clients (parents, enseignants, directeurs).
 */
export function createTestimonialsTool(): ToolDefinition {
  return {
    name: 'get_testimonials',
    description: 'Récupère les témoignages de clients Academia Helm : parents d\'élèves, enseignants, directeurs, comptables. Utile pour rassurer les prospects avec des retours d\'expérience réels.',
    version: '1.0.0',
    agent: 'SARA',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['PARENT', 'ENSEIGNANT', 'DIRECTEUR', 'COMPTABLE', 'ALL'], description: 'Type de témoignage (défaut: ALL)' },
        limit: { type: 'number', description: 'Nombre max de témoignages (défaut: 5)' },
      },
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, _context) => {
      const start = Date.now();
      const type = (params.type as string) || 'ALL';
      const limit = (params.limit as number) || 5;

      let testimonials = PRODUCT_KNOWLEDGE.testimonials;
      if (type !== 'ALL') {
        testimonials = testimonials.filter(t => t.type === type);
      }

      return createToolResult(
        testimonials.slice(0, limit).map(t => ({
          name: t.name,
          role: t.role,
          school: t.school,
          content: t.content,
          highlight: t.highlight,
          rating: t.rating,
        })),
        'get_testimonials',
        start,
      );
    },
  };
}

/**
 * Récupère les informations sur l'entreprise et les créateurs.
 */
export function createCompanyInfoTool(): ToolDefinition {
  return {
    name: 'get_company_info',
    description: 'Récupère les informations sur YEHI OR Tech, l\'entreprise qui a créé Academia Helm : histoire, mission, vision, valeurs, équipe.',
    version: '1.0.0',
    agent: 'SARA',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', enum: ['ALL', 'MISSION', 'TEAM', 'VALUES', 'CONTACT'], description: 'Section spécifique (défaut: ALL)' },
      },
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, _context) => {
      const start = Date.now();
      const section = (params.section as string) || 'ALL';
      const company = PRODUCT_KNOWLEDGE.company;

      if (section === 'MISSION') {
        return createToolResult({ name: company.name, mission: company.mission, vision: company.vision }, 'get_company_info', start);
      }
      if (section === 'TEAM') {
        return createToolResult({ name: company.name, team: company.team, founded: company.founded }, 'get_company_info', start);
      }
      if (section === 'VALUES') {
        return createToolResult({ name: company.name, values: company.values }, 'get_company_info', start);
      }
      if (section === 'CONTACT') {
        return createToolResult({ name: company.name, contact: company.contact, website: company.website }, 'get_company_info', start);
      }

      return createToolResult(company, 'get_company_info', start);
    },
  };
}

/**
 * Récupère les informations tarifaires détaillées.
 */
export function createPricingTool(): ToolDefinition {
  return {
    name: 'get_pricing_details',
    description: 'Récupère la grille tarifaire complète d\'Academia Helm : plans, prix, add-ons, méthodes de paiement, essai gratuit, période de grâce.',
    version: '1.0.0',
    agent: 'SARA',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        planName: { type: 'string', enum: ['ALL', 'SEED', 'GROW', 'LEAD', 'NETWORK'], description: 'Plan spécifique (défaut: ALL)' },
        includeAddOns: { type: 'boolean', description: 'Inclure les add-ons (défaut: true)' },
      },
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, _context) => {
      const start = Date.now();
      const planName = (params.planName as string) || 'ALL';
      const includeAddOns = params.includeAddOns !== false;

      let plans = PRODUCT_KNOWLEDGE.pricing.plans;
      if (planName !== 'ALL') {
        plans = plans.filter(p => p.name === `HELM ${planName}`);
      }

      const result: any = {
        philosophy: PRODUCT_KNOWLEDGE.pricing.philosophy,
        plans,
        paymentMethods: PRODUCT_KNOWLEDGE.pricing.paymentMethods,
        gracePeriod: PRODUCT_KNOWLEDGE.pricing.gracePeriod,
        trial: PRODUCT_KNOWLEDGE.pricing.trial,
      };

      if (includeAddOns) {
        result.addOns = PRODUCT_KNOWLEDGE.pricing.addOns;
      }

      return createToolResult(result, 'get_pricing_details', start);
    },
  };
}

/**
 * Récupère les détails d'un module spécifique ou la liste de tous les modules.
 */
export function createModuleGuideTool(): ToolDefinition {
  return {
    name: 'get_module_guide',
    description: 'Récupère les détails d\'un module Academia Helm : fonctionnalités, chemin de navigation, cas d\'usage. Utile pour guider un utilisateur dans l\'application.',
    version: '1.0.0',
    agent: 'SARA',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        moduleId: { type: 'string', enum: ['students', 'pedagogy', 'exams', 'finance', 'hr', 'communication', 'qhse', 'orion', 'complementaires', 'ALL'], description: 'ID du module (défaut: ALL)' },
      },
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, _context) => {
      const start = Date.now();
      const moduleId = (params.moduleId as string) || 'ALL';

      if (moduleId === 'ALL') {
        return createToolResult(
          PRODUCT_KNOWLEDGE.modules.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
            navigation: m.navigation,
            featureCount: m.features.length,
          })),
          'get_module_guide',
          start,
        );
      }

      const module = PRODUCT_KNOWLEDGE.modules.find(m => m.id === moduleId);
      if (!module) {
        return {
          success: false,
          data: null,
          error: `Module "${moduleId}" not found`,
          metadata: { queryTime: Date.now() - start, source: 'get_module_guide' },
        };
      }

      return createToolResult(module, 'get_module_guide', start);
    },
  };
}

/**
 * Récupère le guide de navigation pour une fonctionnalité donnée.
 */
export function createNavigationGuideTool(): ToolDefinition {
  return {
    name: 'get_navigation_guide',
    description: 'Récupère le chemin de navigation exact pour accéder à une fonctionnalité dans Academia Helm. Inclut les étapes d\'onboarding pour les nouveaux utilisateurs.',
    version: '1.0.0',
    agent: 'SARA',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        feature: { type: 'string', description: 'Fonctionnalité recherchée (ex: "inscrire élève", "bulletin", "impayés")' },
        includeOnboarding: { type: 'boolean', description: 'Inclure les étapes d\'onboarding (défaut: false)' },
      },
      required: ['feature'],
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, _context) => {
      const start = Date.now();
      const feature = (params.feature as string).toLowerCase();
      const includeOnboarding = params.includeOnboarding === true;

      // Recherche dans les guides de navigation
      const navResults = PRODUCT_KNOWLEDGE.navigationGuides.filter(g =>
        g.description.toLowerCase().includes(feature) ||
        g.module.toLowerCase().includes(feature) ||
        feature.split(' ').some(word => word.length > 2 && (g.description.toLowerCase().includes(word) || g.module.toLowerCase().includes(word)))
      );

      // Recherche dans les modules pour les features détaillées
      const moduleFeatureResults = PRODUCT_KNOWLEDGE.modules.filter(m =>
        m.features.some(f => f.toLowerCase().includes(feature)) ||
        m.name.toLowerCase().includes(feature) ||
        m.description.toLowerCase().includes(feature)
      ).map(m => ({
        module: m.name,
        navigation: m.navigation,
        matchingFeatures: m.features.filter(f => f.toLowerCase().includes(feature)),
      }));

      const result: any = {
        feature: params.feature,
        navigationPaths: navResults,
        moduleFeatures: moduleFeatureResults,
      };

      if (includeOnboarding) {
        result.onboardingSteps = PRODUCT_KNOWLEDGE.onboardingSteps;
      }

      return createToolResult(result, 'get_navigation_guide', start);
    },
  };
}

/**
 * Récupère les informations sur les agents IA d'Academia Helm.
 */
export function createAIAgentsTool(): ToolDefinition {
  return {
    name: 'get_ai_agents_info',
    description: 'Récupère les informations sur les 3 agents IA d\'Academia Helm : ORION (analyste), ATLAS (exécutant), SARA (assistante).',
    version: '1.0.0',
    agent: 'SARA',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        agentName: { type: 'string', enum: ['ALL', 'ORION', 'ATLAS', 'SARA'], description: 'Agent spécifique (défaut: ALL)' },
      },
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, _context) => {
      const start = Date.now();
      const agentName = (params.agentName as string) || 'ALL';

      if (agentName === 'ALL') {
        return createToolResult(PRODUCT_KNOWLEDGE.aiAgents, 'get_ai_agents_info', start);
      }

      const agent = PRODUCT_KNOWLEDGE.aiAgents.find(a => a.name === agentName);
      if (!agent) {
        return {
          success: false,
          data: null,
          error: `Agent "${agentName}" not found`,
          metadata: { queryTime: Date.now() - start, source: 'get_ai_agents_info' },
        };
      }

      return createToolResult(agent, 'get_ai_agents_info', start);
    },
  };
}

/**
 * Récupère les avantages concurrentiels d'Academia Helm.
 */
export function createCompetitiveAdvantagesTool(): ToolDefinition {
  return {
    name: 'get_competitive_advantages',
    description: 'Récupère les avantages concurrentiels d\'Academia Helm par rapport aux autres solutions du marché.',
    version: '1.0.0',
    agent: 'SARA',
    category: 'KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    requiredPermissions: [],
    requiresTenant: false,
    isReadOnly: true,
    requiresConfirmation: false,
    execute: async (params, _context) => {
      const start = Date.now();
      return createToolResult(PRODUCT_KNOWLEDGE.competitiveAdvantages, 'get_competitive_advantages', start);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT GROUPÉ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crée et retourne tous les outils SARA (connaissances produit uniquement).
 * AUCUN accès aux données des écoles.
 */
export function createSaraProductTools(): ToolDefinition[] {
  return [
    createProductKnowledgeTool(),
    createTestimonialsTool(),
    createCompanyInfoTool(),
    createPricingTool(),
    createModuleGuideTool(),
    createNavigationGuideTool(),
    createAIAgentsTool(),
    createCompetitiveAdvantagesTool(),
  ];
}
