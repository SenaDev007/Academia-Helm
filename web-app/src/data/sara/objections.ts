/**
 * SARA Objections - Gestion des objections B2B
 * 
 * Système de contre-arguments professionnels pour le Closer Senior #1
 * Chaque objection est traitée avec une technique de closing spécifique
 */

export interface Objection {
  objection: string;
  response: string;
  /** Closing technique to apply after handling the objection */
  closingTechnique: 'assumptive' | 'urgency' | 'alternative' | 'summary' | 'puppy_dog' | 'pain' | 'social_proof';
  /** Suggested next action */
  nextAction: string;
}

export const objections: Objection[] = [
  {
    objection: "C'est trop cher",
    response: "Je comprends cette réaction. En réalité, Academia Helm remplace plusieurs outils à la fois : gestion scolaire, finances, IA, offline, support. Et tous les modules sont inclus dans le même prix, sans options cachées. À 14 900 FCFA/mois pour le plan SEED, c'est moins de 500 FCFA par jour — le prix d'un sachet d'eau. Sur le long terme, c'est une économie réelle de 60% sur la charge administrative.",
    closingTechnique: 'pain',
    nextAction: "Quel est l'effectif de votre école ? Laissez-moi vous montrer le plan le plus adapté."
  },
  {
    objection: "Je veux réfléchir",
    response: "C'est tout à fait normal et c'est pourquoi nous proposons le free trial guidé. Vous découvrez Academia Helm sans engagement pendant 3 jours, avec tous les modules déjà actifs. Vous verrez par vous-même la différence que ça fait. Et notre équipe vous accompagne pendant tout l'essai.",
    closingTechnique: 'puppy_dog',
    nextAction: "Souhaitez-vous commencer l'essai gratuit maintenant ?"
  },
  {
    objection: "Je n'ai pas internet en permanence",
    response: "C'est justement l'un de nos plus grands avantages. Academia Helm fonctionne en mode offline-first : vous continuez à travailler normalement sans connexion, et les données se synchronisent automatiquement dès que la connexion revient. C'est conçu pour les réalités africaines.",
    closingTechnique: 'summary',
    nextAction: "Souhaitez-vous voir comment fonctionne le mode offline en démo ?"
  },
  {
    objection: "Et si je ne paie pas à temps ?",
    response: "Vos données ne sont jamais perdues, c'est notre engagement. En cas de retard, l'accès est temporairement suspendu, mais tout est conservé en sécurité. Dès le paiement, vous retrouvez l'accès complet instantanément. Et ORION, notre IA, vous envoie des rappels proactifs pour éviter les oublis.",
    closingTechnique: 'assumptive',
    nextAction: "Préférez-vous l'abonnement annuel avec 2 mois offerts pour plus de tranquillité ?"
  },
  {
    objection: "Je gère plusieurs écoles",
    response: "Dans ce cas, notre offre HELM NETWORK est exactement faite pour vous. Un seul tableau de bord pour piloter tout votre groupe scolaire, avec une tarification adaptée au nombre de campus. Plusieurs groupes scolaires au Bénin nous ont déjà fait confiance et ont vu leur taux de recouvrement augmenter de 40%.",
    closingTechnique: 'social_proof',
    nextAction: "Combien d'établissements gérez-vous ? Je peux vous préparer un devis personnalisé."
  },
  {
    objection: "On a déjà un système",
    response: "C'est bien d'avoir un système en place. Mais permettez-moi de vous poser une question : votre système actuel fait-il du recouvrement intelligent avec IA ? A-t-il un export Educmaster automatique en 1 clic ? Fonctionne-t-il offline ? Inclut-il 9 modules complets à un seul prix ? C'est souvent le moment où nos clients réalisent l'écart.",
    closingTechnique: 'pain',
    nextAction: "Souhaitez-vous comparer Academia Helm avec votre système actuel en démo ?"
  },
  {
    objection: "Je n'ai pas le temps pour la mise en place",
    response: "Nous avons pensé à ça. L'onboarding Academia Helm prend en moyenne 2 jours, avec un accompagnement personnalisé. Et une fois en place, vous gagnez 60% de temps sur les tâches administratives. C'est un investissement de temps qui se rentabilise dès la première semaine.",
    closingTechnique: 'urgency',
    nextAction: "Quand débute votre prochaine rentrée scolaire ? Plus tôt vous commencez, plus sereine sera la rentrée."
  },
  {
    objection: "Mes enseignants ne sont pas à l'aise avec la technologie",
    response: "C'est une préoccupation légitime. C'est pourquoi Academia Helm est conçu mobile-first avec une interface intuitive. Et nous proposons des formations on-site pour accompagner votre équipe. Nos écoles partenaires confirment : même les enseignants les plus réticents adoptent la plateforme en moins d'une semaine.",
    closingTechnique: 'social_proof',
    nextAction: "Souhaitez-vous planifier une formation pour votre équipe ?"
  },
];
