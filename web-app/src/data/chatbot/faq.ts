/**
 * FAQ Data for Chatbot - Academia Helm
 * 
 * Base de connaissances structurée pour le chatbot de support
 * Utilisable tel quel (clé → réponse)
 */

export interface FAQQuestion {
  q: string;
  a: string;
}

export interface FAQCategory {
  title: string;
  questions: FAQQuestion[];
}

export interface FAQData {
  about: FAQCategory;
  trial: FAQCategory;
  subscription: FAQCategory;
  billing: FAQCategory;
  groups: FAQCategory;
  payment: FAQCategory;
  ai: FAQCategory;
  security: FAQCategory;
  features?: FAQCategory; // Optionnel pour compatibilité
  contact?: FAQCategory; // Optionnel pour compatibilité
}

export const faqData: FAQData = {
  about: {
    title: "🏫 À propos d'Academia Helm",
    questions: [
      {
        q: "Qu'est-ce qu'Academia Helm ?",
        a: "🎓 Academia Helm est une plateforme SaaS complète de gestion scolaire (administration, finances, pédagogie, RH), conçue pour les écoles africaines modernes."
      },
      {
        q: "À qui s'adresse la plateforme ?",
        a: "🏫 Academia Helm s'adresse aux directeurs, promoteurs et équipes administratives d'écoles privées ou publiques."
      },
      {
        q: "Est-ce une application installable ?",
        a: "🌍 Academia Helm est une application web SaaS utilisable en ligne et hors ligne. Les données sont synchronisées automatiquement dès que la connexion est rétablie."
      }
    ]
  },
  trial: {
    title: "🧪 Free trial (3 jours)",
    questions: [
      {
        q: "Le free trial est-il gratuit ?",
        a: "🧪 Oui. Le free trial est 100 % gratuit et dure 3 jours."
      },
      {
        q: "Que puis-je faire pendant le trial ?",
        a: "🤖 Vous pouvez explorer toutes les fonctionnalités avec des données fictives, accompagné par ATLAS."
      },
      {
        q: "Puis-je utiliser mes vraies données ?",
        a: "🔒 Non. Le free trial est une démonstration guidée sans données réelles."
      }
    ]
  },
  subscription: {
    title: "💼 Souscription initiale",
    questions: [
      {
        q: "Pourquoi une souscription initiale ?",
        a: "🚀 Elle permet l'activation réelle de votre établissement : données réelles, sous-domaine, modules complets, mode offline et accès aux IA. Le montant varie selon le plan (75 000 à 200 000 FCFA)."
      },
      {
        q: "Est-ce payé une seule fois ?",
        a: "✅ Oui. La souscription initiale est payée une seule fois à l'activation, quel que soit le plan."
      }
    ]
  },
  billing: {
    title: "💰 Abonnements",
    questions: [
      {
        q: "Quand commence l'abonnement ?",
        a: "⏳ Après la souscription initiale, vous bénéficiez de 30 jours d'exploitation réelle sans abonnement à payer. L'abonnement commence après ces 30 jours."
      },
      {
        q: "Quelle est la différence entre mensuel et annuel ?",
        a: "💡 L'abonnement annuel offre 2 mois gratuits par rapport au mensuel."
      }
    ]
  },
  groups: {
    title: "🏫 Groupes scolaires",
    questions: [
      {
        q: "J'ai 2 écoles, combien je paie ?",
        a: "🏫🏫 Vous payez 25 000 FCFA par mois ou 250 000 FCFA par an."
      },
      {
        q: "J'ai 3 écoles ou plus, comment ça fonctionne ?",
        a: "📄 Vous passez automatiquement en mode « Sur devis » avec une offre personnalisée."
      }
    ]
  },
  payment: {
    title: "💳 Paiement & Fedapay",
    questions: [
      {
        q: "Y a-t-il un prélèvement automatique ?",
        a: "❌ Non. Il n'y a aucun prélèvement automatique. Les paiements se font manuellement via Fedapay."
      },
      {
        q: "Vais-je recevoir des rappels ?",
        a: "⏰ Oui. Vous recevez des rappels automatiques à J-7, J-3 et 24h avant échéance."
      }
    ]
  },
  ai: {
    title: "🤖 IA — ORION & ATLAS",
    questions: [
      {
        q: "ORION et ATLAS sont-ils inclus ?",
        a: "✨ Oui. ORION et ATLAS sont inclus sans surcoût."
      },
      {
        q: "L'IA prend-elle des décisions ?",
        a: "🔐 Non. Les IA assistent et analysent, mais ne modifient jamais vos données."
      }
    ]
  },
  security: {
    title: "🔒 Sécurité & données",
    questions: [
      {
        q: "Que se passe-t-il si je ne paie pas ?",
        a: "🔒 Vos données sont conservées. L'accès est suspendu jusqu'au paiement."
      }
    ]
  }
};

