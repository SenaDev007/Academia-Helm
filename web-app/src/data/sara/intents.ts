/**
 * SARA Intents - Détection d'intention intelligente
 * 
 * Système de détection d'intention basé sur les mots-clés,
 * synonymes et contexte de conversation.
 * 
 * Intentions enrichies pour le Closer Senior #1 :
 * - Closing & conversion intents
 * - In-app guide intents
 * - Product knowledge intents
 * - Objection handling intents
 */

export interface Intent {
  id: string;
  description: string;
  keywords: string[];
  priority: number;
  /** Closing technique to apply when this intent is detected */
  closingTechnique?: 'assumptive' | 'urgency' | 'alternative' | 'summary' | 'puppy_dog' | 'pain' | 'social_proof';
}

export const intents: Intent[] = [
  // === CLOSING & CONVERSION INTENTS ===
  {
    id: "greeting",
    description: "Salutations et premier contact",
    keywords: ["bonjour", "salut", "bonsoir", "bonne journée", "bonne soirée", "hello", "hi", "coucou", "bon matin"],
    priority: 0,
    closingTechnique: 'assumptive',
  },
  {
    id: "about_product",
    description: "Comprendre ce qu'est Academia Helm",
    keywords: ["academia helm", "academia hub", "plateforme", "logiciel", "solution", "c'est quoi", "présentation", "qu'est-ce", "définition", "erp", "saas"],
    priority: 1,
    closingTechnique: 'summary',
  },
  {
    id: "free_trial",
    description: "Questions liées à l'essai gratuit",
    keywords: ["tester", "essayer", "trial", "gratuit", "démo", "avant de payer", "sans engagement", "découvrir", "démonstration"],
    priority: 2,
    closingTechnique: 'puppy_dog',
  },
  {
    id: "pricing_general",
    description: "Questions sur les prix",
    keywords: ["prix", "coût", "combien", "tarif", "cher", "payer", "montant", "facturation", "abonnement"],
    priority: 3,
    closingTechnique: 'alternative',
  },
  {
    id: "pricing_objection",
    description: "Objection sur le prix",
    keywords: ["trop cher", "cher", "coûteux", "budget", "pas maintenant", "trop élevé", "hors budget", "je ne peux pas"],
    priority: 4,
    closingTechnique: 'pain',
  },
  {
    id: "subscription_initial",
    description: "Souscription initiale",
    keywords: ["100000", "souscription", "activation", "une seule fois", "100 000", "premier paiement", "frais de démarrage", "75 000", "150 000", "200 000"],
    priority: 5,
    closingTechnique: 'assumptive',
  },
  {
    id: "billing_cycle",
    description: "Mensuel vs Annuel",
    keywords: ["mensuel", "annuel", "abonnement", "par mois", "par an", "mois", "année", "2 mois offerts"],
    priority: 6,
    closingTechnique: 'alternative',
  },
  {
    id: "grace_period",
    description: "30 jours sans abonnement",
    keywords: ["30 jours", "sans payer", "période", "grâce", "exploitation", "essai réel"],
    priority: 7,
    closingTechnique: 'puppy_dog',
  },
  {
    id: "group_two_schools",
    description: "Cas de 2 écoles",
    keywords: ["2 écoles", "deux écoles", "groupe scolaire", "plusieurs établissements"],
    priority: 8,
    closingTechnique: 'alternative',
  },
  {
    id: "enterprise_quote",
    description: "Cas de 3 écoles ou plus",
    keywords: ["3 écoles", "plusieurs écoles", "réseau", "sur devis", "enterprise", "plus de 3", "network"],
    priority: 9,
    closingTechnique: 'social_proof',
  },

  // === PRODUCT KNOWLEDGE INTENTS ===
  {
    id: "modules_all",
    description: "Questions sur les 9 modules",
    keywords: ["modules", "fonctionnalités", "ce qui est inclus", "contenu", "9 modules", "qu'est-ce qui est inclus"],
    priority: 10,
    closingTechnique: 'summary',
  },
  {
    id: "module_students",
    description: "Module Élèves & Inscriptions",
    keywords: ["élèves", "inscriptions", "admissions", "dossiers", "scolarité", "educmaster", "export", "npI"],
    priority: 11,
  },
  {
    id: "module_pedagogy",
    description: "Module Pédagogie",
    keywords: ["pédagogie", "emploi du temps", "edt", "matières", "affectations", "enseignant", "bibliothèque"],
    priority: 12,
  },
  {
    id: "module_exams",
    description: "Module Examens & Bulletins",
    keywords: ["examens", "notes", "bulletins", "moyennes", "évaluations", "composition"],
    priority: 13,
  },
  {
    id: "module_finance",
    description: "Module Finance",
    keywords: ["finance", "impayés", "recouvrement", "dépenses", "caisse", "facturation", "paiement"],
    priority: 14,
  },
  {
    id: "module_hr",
    description: "Module RH & Paie",
    keywords: ["rh", "paie", "salaires", "contrats", "congés", "cnss", "personnel"],
    priority: 15,
  },
  {
    id: "module_communication",
    description: "Module Communication",
    keywords: ["communication", "sms", "whatsapp", "email", "notification", "push"],
    priority: 16,
  },
  {
    id: "module_qhse",
    description: "Module QHSE",
    keywords: ["qhse", "hygiène", "sécurité", "incident", "traçabilité"],
    priority: 17,
  },

  // === AI AGENTS INTENTS ===
  {
    id: "ai_orion",
    description: "Questions sur ORION",
    keywords: ["orion", "analytique", "alertes", "kpi", "prédiction", "recommandation", "tableau de bord", "cockpit"],
    priority: 18,
    closingTechnique: 'summary',
  },
  {
    id: "ai_atlas",
    description: "Questions sur ATLAS",
    keywords: ["atlas", "automatisation", "workflow", "génération", "exécution", "document"],
    priority: 19,
    closingTechnique: 'summary',
  },
  {
    id: "ai_sara",
    description: "Questions sur SARA",
    keywords: ["sara", "assistante", "chatbot", "guide", "closer", "conversation"],
    priority: 20,
  },

  // === TECHNICAL INTENTS ===
  {
    id: "payment_fedapay",
    description: "Paiement Fedapay",
    keywords: ["fedapay", "paiement", "carte", "mobile money", "moyen de paiement", "comment payer", "wave", "mtn", "moov"],
    priority: 21,
    closingTechnique: 'assumptive',
  },
  {
    id: "payment_reminders",
    description: "Rappels de paiement",
    keywords: ["rappel", "notification", "retard", "échéance", "oublier", "expiration"],
    priority: 22,
  },
  {
    id: "offline_mode",
    description: "Mode hors ligne",
    keywords: ["offline", "hors ligne", "sans internet", "connexion", "déconnecté", "synchro"],
    priority: 23,
    closingTechnique: 'summary',
  },
  {
    id: "security_data",
    description: "Sécurité et données",
    keywords: ["sécurité", "données", "perte", "suspendu", "conservation", "protégé", "rgpd", "isolement", "multi-tenant"],
    priority: 24,
  },
  {
    id: "onboarding",
    description: "Processus d'onboarding",
    keywords: ["onboarding", "démarrage", "configuration", "mise en place", "installation", "premiers pas"],
    priority: 25,
    closingTechnique: 'assumptive',
  },
  {
    id: "support",
    description: "Support technique",
    keywords: ["support", "aide", "problème", "bug", "erreur", "assistance", "technique"],
    priority: 26,
  },
  {
    id: "roi",
    description: "Retour sur investissement",
    keywords: ["roi", "rentabilité", "valeur", "bénéfice", "économie", "gain", "retour", "investissement"],
    priority: 27,
    closingTechnique: 'social_proof',
  },
  {
    id: "competitors",
    description: "Questions sur les concurrents",
    keywords: ["concurrent", "alternative", "comparaison", "vs", "concurrence", "autre solution"],
    priority: 28,
    closingTechnique: 'summary',
  },
  {
    id: "human_support",
    description: "Parler à un humain",
    keywords: ["conseiller", "humain", "appeler", "whatsapp", "contact", "parler à quelqu'un", "téléphone"],
    priority: 29,
    closingTechnique: 'social_proof',
  },
];
