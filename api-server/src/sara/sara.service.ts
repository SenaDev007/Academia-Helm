import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../common/services/openrouter.service';

@Injectable()
export class SaraService {
  private readonly logger = new Logger(SaraService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  /**
   * Répond aux questions des visiteurs sur la landing page
   * SARA est Closer Senior #1 — sa mission est de convertir les prospects en clients
   * Elle maîtrise toutes les techniques de closing et répond à TOUTE question sur Academia Helm
   */
  async handleVisitorQuery(query: string, visitorId?: string) {
    const systemPrompt = `Tu es SARA (Smart Assistant for Revenue & Acquisition), Closer Senior #1 d'Academia Helm.

Tu portes 4 casquettes :
1. CLOSER SENIOR #1 : Tu convertis les prospects en clients. Tu maîtrises les techniques de closing : assumptive close, urgency close, alternative close, summary close, puppy dog close. Tu ne laisses jamais partir un prospect sans une action claire vers la conversion.
2. AGENT COMMERCIAL EXPERT : Tu réponds à TOUTE question sur Academia Helm — tarifs, modules, fonctionnalités, architecture, sécurité, déploiement, support, IA, offline, multi-tenant, export Educmaster.
3. GUIDE UTILISATEUR : À l'intérieur de l'app, tu guides l'utilisateur à travers les modules et l'interface.
4. ASSISTANTE STRATÉGIQUE : Tu assistes chaque rôle avec des réponses contextualisées.

PRODUIT : Academia Helm — ERP éducatif SaaS multi-tenant, offline-first, mobile-first
CIBLE : Écoles privées (maternelle, primaire, secondaire) — Bénin et Afrique de l'Ouest
ÉDITEUR : YEHI OR Tech

GRILLE TARIFAIRE :
- HELM SEED (1-150 élèves) : 75 000 FCFA souscription + 14 900 FCFA/mois ou 149 000 FCFA/an
- HELM GROW (151-400 élèves) [RECOMMANDÉ] : 100 000 FCFA souscription + 24 900 FCFA/mois ou 249 000 FCFA/an
- HELM LEAD (401-800 élèves) : 150 000 FCFA souscription + 39 900 FCFA/mois ou 399 000 FCFA/an
- HELM NETWORK (Multi-campus) : 200 000 FCFA souscription + Sur devis
PHILOSOPHIE : Tous les plans incluent les 9 modules. Aucun module verrouillé. "Tout inclus. Un seul prix. Zéro surprise."

9 MODULES INCLUS : Élèves & Inscriptions, Pédagogie, Examens & Bulletins, Finance & Économat, RH & Paie, Communication, QHSE, ORION (IA), Modules Complémentaires

3 AGENTS IA :
- ORION : L'Analyste — observe, analyse, prédit, recommande (lecture seule)
- ATLAS : L'Exécutant — génère documents, automatise workflows
- SARA : L'Assistante — closer commerciale, guide utilisateur (c'est moi)

RÈGLES :
- Maximum 4 phrases sur le landing page
- Termine toujours par UNE question ou un call-to-action vers la conversion
- Ne parle jamais d'autres produits ou concurrents
- Applique des techniques de closing dans chaque réponse
- Si la question n'est pas liée à Academia Helm, redirige poliment
- Réponds en français par défaut, anglais si l'utilisateur écrit en anglais
- Après chaque réponse, guide vers la conversion : démo, essai, choix de plan, contact conseiller`;

    const content = await this.openRouter.simpleChat(
      query,
      systemPrompt,
      'SARA',
      0.6,
    );

    return {
      reply: content,
      visitorId,
      timestamp: new Date(),
      isAiEnhanced: this.openRouter.isConfigured(),
    };
  }

  /**
   * Répond aux questions des utilisateurs dans l'application
   * SARA mode In-App — guide l'utilisateur à travers les modules
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

    const systemPrompt = `Tu es SARA, l'assistante intelligente d'Academia Helm en mode GUIDE UTILISATEUR.

Contexte utilisateur :
- Rôle : ${userRole || 'utilisateur'}
- École : ${schoolId}
${roleContext}
${moduleContext}

Tu portes 2 casquettes dans l'application :
1. GUIDE UTILISATEUR : Tu aides l'utilisateur à naviguer dans l'interface, à comprendre les fonctionnalités, à accomplir des tâches. Tu es le GPS de l'utilisateur.
2. ASSISTANTE STRATÉGIQUE : Tu réponds aux questions métier contextualisées selon le rôle de l'utilisateur.

Navigation par module :
- Élèves : Dashboard → Élèves & Inscriptions → Dossiers, admissions, transferts
- Pédagogie : Dashboard → Organisation Pédagogique → EDT, matières, affectations
- Examens : Dashboard → Examens, Notes & Bulletins → Saisie, calcul, publication
- Finance : Dashboard → Finance & Économat → Frais, recouvrement, dépenses
- RH : Dashboard → RH & Paie → Contrats, congés, paie, CNSS
- Communication : Dashboard → Communication → SMS, WhatsApp, email
- QHSE : Dashboard → QHSE & Incidents → Signalement, traçabilité
- ORION : Dashboard → ORION → Alertes, KPIs, recommandations, cockpit
- ATLAS : Dashboard → ATLAS → Chat assistant, automatisations

RÈGLES :
- Maximum 6 phrases en mode in-app
- Sois précise et actionnable dans tes réponses
- Indique clairement où trouver les fonctionnalités (chemin de navigation)
- Adapte ton vocabulaire au rôle de l'utilisateur
- Respecte le RBAC : un parent ne voit que ses enfants, un enseignant ses classes
- Tu ne modifies jamais les données — ATLAS exécute, pas toi
- Réponds en français par défaut`;

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
    };
  }

  /**
   * Retourne le contexte spécifique au rôle utilisateur
   */
  private getRoleContext(role?: string): string {
    switch (role) {
      case 'director':
      case 'SCHOOL_ADMIN':
        return 'Accès : données globales école, analyses ORION, tous les modules. Ton : stratégique, synthétique, décisionnel.';
      case 'teacher':
      case 'ENSEIGNANT':
        return 'Accès : ses classes uniquement, bibliothèque pédagogique, ses élèves. Ton : collaboratif, expert pédagogique.';
      case 'accountant':
      case 'CAISSIER':
        return 'Accès : module finance, impayés, reçus, rapports financiers. Ton : factuel, orienté données.';
      case 'parent':
      case 'PARENT':
        return 'Accès : ses enfants uniquement. Notes, absences, factures, communications. Ton : bienveillant, clair.';
      case 'secretary':
      case 'SCOLARITE':
        return 'Accès : dossiers élèves, inscriptions, export Educmaster. Ton : pratique, orienté procédure.';
      case 'SURVEILLANT':
        return 'Accès : appels, absences, discipline. Ton : direct, orienté action.';
      default:
        return 'Accès : selon les permissions du rôle. Ton : professionnel, aidant.';
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
      ],
      teacher: [
        "Comment saisir les notes ?",
        "Où trouver mon emploi du temps ?",
        "Comment générer des exercices ?",
        "Comment contacter les parents ?",
      ],
      accountant: [
        "Comment voir les impayés ?",
        "Comment enregistrer un paiement ?",
        "Où trouver le rapport financier ?",
        "Comment configurer les frais de scolarité ?",
      ],
      parent: [
        "Comment voir les notes de mon enfant ?",
        "Où trouver les factures ?",
        "Comment contacter l'école ?",
        "Comment voir les absences ?",
      ],
      secretary: [
        "Comment inscrire un nouvel élève ?",
        "Comment exporter vers Educmaster ?",
        "Où gérer les dossiers élèves ?",
        "Comment générer une attestation ?",
      ],
    };

    const moduleSuggestions: Record<string, string[]> = {
      students: ["Comment inscrire un élève ?", "Où exporter vers Educmaster ?", "Comment gérer les transferts ?"],
      pedagogy: ["Comment créer un EDT ?", "Où gérer les affectations ?", "Comment utiliser la bibliothèque ?"],
      exams: ["Comment saisir les notes ?", "Comment publier les bulletins ?", "Où voir les statistiques ?"],
      finance: ["Comment voir les impayés ?", "Comment enregistrer un paiement ?", "Où voir le rapport financier ?"],
      hr: ["Comment ajouter un enseignant ?", "Comment calculer la paie ?", "Où gérer les congés ?"],
      communication: ["Comment envoyer un SMS ?", "Comment configurer WhatsApp ?", "Où voir l'historique ?"],
      qhse: ["Comment signaler un incident ?", "Où voir les traçabilités ?", "Comment gérer les contrôles ?"],
      orion: ["Comment lire les alertes ?", "Où voir les KPIs ?", "Comment interpréter les recommandations ?"],
      atlas: ["Comment demander un document ?", "Comment automatiser une tâche ?", "Quelles actions ATLAS peut-il faire ?"],
      settings: ["Comment configurer l'école ?", "Où gérer les rôles ?", "Comment activer les modules ?"],
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
        return 'Module actuel : Élèves & Inscriptions — Gestion des dossiers, admissions, transferts, export Educmaster.';
      case 'pedagogy':
        return 'Module actuel : Pédagogie — EDT, matières, affectations, espace enseignant, bibliothèque.';
      case 'exams':
        return 'Module actuel : Examens & Bulletins — Saisie notes, moyennes auto, bulletins PDF.';
      case 'finance':
        return 'Module actuel : Finance & Économat — Frais scolarité, recouvrement, dépenses, caisse.';
      case 'hr':
        return 'Module actuel : RH & Paie — Contrats, congés, calcul salaires, CNSS.';
      case 'communication':
        return 'Module actuel : Communication — SMS, WhatsApp, email, notifications push.';
      case 'qhse':
        return 'Module actuel : QHSE & Incidents — Hygiène, sécurité, traçabilité.';
      case 'orion':
        return 'Module actuel : ORION — Alertes intelligentes, KPIs, recommandations, cockpit direction.';
      case 'atlas':
        return 'Module actuel : ATLAS — Chat assistant, automatisations, génération de documents.';
      default:
        return '';
    }
  }
}
