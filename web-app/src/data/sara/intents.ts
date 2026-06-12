/**
 * SARA Intents - Détection d'intention intelligente
 * 
 * Système de détection d'intention basé sur les mots-clés,
 * synonymes et contexte de conversation
 */

export interface Intent {
  id: string;
  description: string;
  keywords: string[];
  priority: number;
}

export const intents: Intent[] = [
  {
    id: "greeting",
    description: "Salutations et politesse",
    keywords: ["bonjour", "salut", "bonsoir", "bonne journée", "bonne soirée", "hello", "hi", "coucou", "bon matin"],
    priority: 0
  },
  {
    id: "about_product",
    description: "Comprendre ce qu'est Academia Helm",
    keywords: ["academia helm", "academia hub", "plateforme", "logiciel", "solution", "c'est quoi", "présentation", "qu'est-ce", "définition"],
    priority: 1
  },
  {
    id: "free_trial",
    description: "Questions liées au free trial",
    keywords: ["tester", "essayer", "trial", "gratuit", "démo", "avant de payer", "sans engagement", "découvrir"],
    priority: 2
  },
  {
    id: "pricing_general",
    description: "Questions sur les prix",
    keywords: ["prix", "coût", "combien", "tarif", "cher", "payer", "montant", "facturation"],
    priority: 3
  },
  {
    id: "pricing_objection",
    description: "Objection sur le prix",
    keywords: ["trop cher", "cher", "coûteux", "budget", "pas maintenant", "trop élevé", "hors budget"],
    priority: 4
  },
  {
    id: "subscription_initial",
    description: "Souscription initiale",
    keywords: ["100000", "souscription", "activation", "une seule fois", "100 000", "premier paiement"],
    priority: 5
  },
  {
    id: "billing_cycle",
    description: "Mensuel vs Annuel",
    keywords: ["mensuel", "annuel", "abonnement", "par mois", "par an", "mois", "année"],
    priority: 6
  },
  {
    id: "grace_period",
    description: "30 jours sans abonnement",
    keywords: ["30 jours", "sans payer", "période", "grâce", "exploitation", "essai réel"],
    priority: 7
  },
  {
    id: "group_two_schools",
    description: "Cas de 2 écoles",
    keywords: ["2 écoles", "deux écoles", "groupe scolaire", "plusieurs établissements"],
    priority: 8
  },
  {
    id: "enterprise_quote",
    description: "Cas de 3 écoles ou plus",
    keywords: ["3 écoles", "plusieurs écoles", "réseau", "sur devis", "enterprise", "plus de 3"],
    priority: 9
  },
  {
    id: "payment_fedapay",
    description: "Paiement Fedapay",
    keywords: ["fedapay", "paiement", "carte", "mobile money", "moyen de paiement", "comment payer"],
    priority: 10
  },
  {
    id: "payment_reminders",
    description: "Rappels de paiement",
    keywords: ["rappel", "notification", "retard", "échéance", "oublier", "expiration"],
    priority: 11
  },
  {
    id: "offline_mode",
    description: "Mode hors ligne",
    keywords: ["offline", "hors ligne", "sans internet", "connexion", "déconnecté"],
    priority: 12
  },
  {
    id: "ai_orion_atlas",
    description: "Questions IA",
    keywords: ["ia", "orion", "atlas", "intelligence artificielle", "assistant", "robot"],
    priority: 13
  },
  {
    id: "security_data",
    description: "Sécurité et données",
    keywords: ["sécurité", "données", "perte", "suspendu", "conservation", "protégé", "rgpd"],
    priority: 14
  },
  {
    id: "human_support",
    description: "Parler à un humain",
    keywords: ["conseiller", "humain", "appeler", "whatsapp", "contact", "parler à quelqu'un"],
    priority: 15
  }
];

