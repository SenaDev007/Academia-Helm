/**
 * SARA Objections - Gestion des objections B2B
 * 
 * Système de contre-arguments professionnels
 */

export interface Objection {
  objection: string;
  response: string;
}

export const objections: Objection[] = [
  {
    objection: "C'est trop cher",
    response: "💬 Je comprends cette réaction. En réalité, Academia Helm remplace plusieurs outils à la fois : gestion scolaire, finances, IA, offline, support. Et tous les modules sont inclus dans le même prix, sans options cachées. Sur le long terme, c'est une économie réelle."
  },
  {
    objection: "Je veux réfléchir",
    response: "⏳ C'est tout à fait normal. Le free trial de 3 jours est justement là pour vous permettre de découvrir sans engagement. Voulez-vous l'essayer tranquillement ?"
  },
  {
    objection: "Je n'ai pas internet en permanence",
    response: "🌍 Justement, Academia Helm fonctionne en mode offline-first. Vous continuez à travailler normalement et les données se synchronisent dès que la connexion revient."
  },
  {
    objection: "Et si je ne paie pas à temps ?",
    response: "🔒 Vos données ne sont jamais perdues. En cas de retard, l'accès est suspendu, mais tout est conservé jusqu'au paiement."
  },
  {
    objection: "Je gère plusieurs écoles",
    response: "🏫 Dans ce cas, vous entrez dans notre offre groupe ou sur devis. Cela vous permet d'avoir une tarification plus adaptée et un pilotage centralisé."
  }
];

