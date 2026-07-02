/**
 * ============================================================================
 * WHATSAPP TEMPLATE REGISTRY - GUPSHUP TEMPLATES (v2.0)
 * ============================================================================
 *
 * Registre des 20 templates WhatsApp pré-approuvés pour Academia Helm.
 *
 * ─── Version 2.0 ────────────────────────────────────────────────────────
 * - SUPPRESSION du header paramétré (Meta refuse les variables en début/fin
 *   de template)
 * - Le nom de l'école est intégré dans le BODY en première ligne :
 *     "Etablissement : {{1}}"
 * - {{1}} = schoolName (injecté automatiquement par sendForTenant())
 * - {{1}} est réutilisé dans la signature (Meta permet la réutilisation)
 * - Suppression des boutons URL (complexité API)
 *
 * ─── Convention de variables ────────────────────────────────────────────
 * - {{1}} : schoolName (automatique)
 * - {{2}}, {{3}}, ... : variables métier (fournies par le caller)
 * - callerParamCount = bodyPlaceholderCount - 1 (car {{1}} est auto)
 *
 * Source : scripts/gupshup-templates.json (v2)
 *
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';

/**
 * Représentation normalisée d'un template WhatsApp Gupshup (v2).
 */
export interface GupshupTemplate {
  /** Nom unique du template (Gupshup elementName). */
  elementName: string;
  /** Catégorie Meta (UTILITY, MARKETING, AUTHENTICATION). */
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  /** Type de template (TEXT pour l'instant). */
  templateType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  /** Cas d'usage court (2-3 mots) pour labellisation Meta. */
  useCase: string;
  /** Corps du message avec placeholders {{1}}, {{2}}... */
  body: string;
  /** Footer statique (max 60 caractères). */
  footer?: string;
  /** Langue ISO 639-1 (fr par défaut). */
  language: string;
  /**
   * Nombre total de variables UNIQUES dans le body ({{1}}, {{2}}, etc.).
   * Note : {{1}} peut être réutilisé plusieurs fois dans le body, mais ne
   * compte que pour 1 dans bodyPlaceholderCount.
   */
  bodyPlaceholderCount: number;
  /**
   * Nombre de paramètres que le caller doit fournir (hors schoolName qui est
   * injecté automatiquement en position 1).
   * = bodyPlaceholderCount - 1
   */
  callerParamCount: number;
  /** Valeurs d'exemple pour validation Meta (format [val1],[val2],...). */
  sampleBody?: string;
  /** Module d'origine (hr, students, pedagogy). */
  module: 'hr' | 'students' | 'pedagogy';
}

/**
 * Résumé d'un template pour listage API.
 */
export interface TemplateSummary {
  elementName: string;
  useCase: string;
  category: string;
  module: string;
  bodyPlaceholderCount: number;
  callerParamCount: number;
}

// ============================================================================
// DÉFINITION DES 20 TEMPLATES (v2 - sans header)
// ============================================================================

const FOOTER = 'Academia Helm - Plateforme educative';

const TEMPLATES: GupshupTemplate[] = [
  // ─── MODULE ÉLÈVES (2) ──────────────────────────────────────────────────
  {
    elementName: 'admission_recue',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Admission confirmation',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Nous accusons reception de la demande d'admission de {{3}} pour l'annee scolaire {{4}} en classe de {{5}}.

Numero de dossier : {{6}}

Notre equipe pedagogique examinera votre demande dans les meilleurs delais et reviendra vers vous pour les prochaines etapes.

Cordialement,
La Direction de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'students',
    bodyPlaceholderCount: 6,
    callerParamCount: 5,
    sampleBody:
      '[CSPEB],[Marie ADANDE],[Jean ADANDE],[2025-2026],[CP1],[ADM-2025-001]',
  },
  {
    elementName: 'inscription_confirmee',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Enrollment confirmation',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Felicitations ! L'inscription de {{3}} est officiellement confirmee a {{1}}.

Classe : {{4}}
Matricule : {{5}}
Annee scolaire : {{6}}

Conservez precieusement ce matricule : il vous sera demande pour toute communication avec l'ecole.

Cordialement,
La Direction de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'students',
    bodyPlaceholderCount: 6,
    callerParamCount: 5,
    sampleBody: '[CSPEB],[Marie ADANDE],[Jean ADANDE],[CP1],[001],[2025-2026]',
  },

  // ─── MODULE RH (15) ─────────────────────────────────────────────────────
  {
    elementName: 'candidature_recue',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Application received',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Nous avons bien recu votre candidature pour le poste de {{3}} chez {{1}}.

Votre profil sera examine par notre equipe de recrutement. Si votre candidature est retenue, vous serez contacte(e) pour la suite du processus.

Cordialement,
L'equipe RH de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 3,
    callerParamCount: 2,
    sampleBody: '[CSPEB],[Erhel DEGBE],[Professeur de Mathematiques]',
  },
  {
    elementName: 'entretien_programme',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Interview scheduled',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Un entretien est programme pour votre candidature au poste de {{3}} chez {{1}}.

Date : {{4}}
Heure : {{5}}
Format : {{6}}
Evaluateur : {{7}}

Lien / Contact : {{8}}

Merci de confirmer votre presence.

Cordialement,
L'equipe RH de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 8,
    callerParamCount: 7,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Professeur de Mathematiques],[15/01/2026],[10h00],[Visioconference],[M. Kossi ADANDE],[https://meet.google.com/abc-defg-hij]',
  },
  {
    elementName: 'test_programme',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Test scheduled',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Un test est programme pour votre candidature au poste de {{3}} chez {{1}}.

Test : {{4}}
Duree : {{5}}
Bareme : {{6}} / Seuil de reussite : {{7}}

Instructions : {{8}}

Cordialement,
L'equipe RH de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 8,
    callerParamCount: 7,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Professeur de Mathematiques],[Test de competences pedagogiques],[60 minutes],[100],[50],[Aucun document autorise]',
  },
  {
    elementName: 'resultat_entretien',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Interview result',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Suite a votre entretien pour le poste de {{3}} chez {{1}}, nous vous informons que votre candidature est {{4}}.

Retour de l'evaluateur : {{5}}

Cordialement,
L'equipe RH de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 5,
    callerParamCount: 4,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Professeur de Mathematiques],[retenue],[Tres bonne presentation, profil adapte au poste]',
  },
  {
    elementName: 'resultat_test',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Test result',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Suite au test "{{3}}" pour votre candidature au poste de {{4}} chez {{1}}, votre resultat est {{5}}.

Score : {{6}} / {{7}}

Retour : {{8}}

Cordialement,
L'equipe RH de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 8,
    callerParamCount: 7,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Test de competences pedagogiques],[Professeur de Mathematiques],[reussi],[78],[100],[Tres bonnes reponses sur la didactique]',
  },
  {
    elementName: 'embauche_confirmee',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Job offer accepted',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Felicitations ! Vous etes officiellement embauche(e) chez {{1}} pour le poste de {{3}}.

Type de contrat : {{4}}
Date de prise de fonction : {{5}}
Salaire : {{6}}

Votre contrat : {{7}}

Bienvenue dans l'equipe !

Cordialement,
La Direction de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 7,
    callerParamCount: 6,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Professeur de Mathematiques],[CDI],[01/09/2026],[350000 FCFA],[https://academiahelm.com/contract/abc123]',
  },
  {
    elementName: 'contrat_signe',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Contract signed',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Votre contrat de travail chez {{1}} (poste : {{3}}) a ete signe avec succes.

Type de contrat : {{4}}
Date de signature : {{5}}

Telecharger : {{6}}

Bienvenue definitivement dans l'equipe !

Cordialement,
La Direction de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 6,
    callerParamCount: 5,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Professeur de Mathematiques],[CDI],[15/01/2026],[https://academiahelm.com/contract/abc123.pdf]',
  },
  {
    elementName: 'candidature_rejetee',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Application rejected',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Nous vous remercions de l'interet que vous portez a {{1}} pour le poste de {{3}}.

Apres examen de votre candidature, nous regrettons de vous informer que nous ne pourrons pas donner une suite favorable a votre demande.

{{4}}

Nous vous souhaitons plein de succes dans vos futures demarches.

Cordialement,
L'equipe RH de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 4,
    callerParamCount: 3,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Professeur de Mathematiques],[Nous vous remercions de votre comprehension.]',
  },
  {
    elementName: 'demande_documents',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Document request',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Pour finaliser votre dossier de candidature (poste : {{3}}) chez {{1}}, merci de fournir les documents suivants via le lien securise ci-dessous :

Documents requis : {{4}}

Lien de televersement : {{5}}
Date limite : {{6}}

Cordialement,
L'equipe RH de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 6,
    callerParamCount: 5,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Professeur de Mathematiques],[CV, Diplome, Casier judiciaire],[https://academiahelm.com/upload/token123],[22/01/2026]',
  },
  {
    elementName: 'identifiants_connexion',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Account credentials',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Vos identifiants de connexion a la plateforme de {{1}} ont ete crees.

Identifiant : {{3}}
Mot de passe temporaire : {{4}}
Role : {{5}}
Portail : {{6}}

Pour des raisons de securite, veuillez changer ce mot de passe lors de votre premiere connexion.

Cordialement,
L'administration de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 6,
    callerParamCount: 5,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[MAT001],[TempPass2026],[Enseignant],[https://cspeb.academiahelm.com/login]',
  },
  {
    elementName: 'decision_conge',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Leave decision',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Votre demande de conge ({{3}}) du {{4}} au {{5}} ({{6}} jours) a ete {{7}} chez {{1}}.

{{8}}

Cordialement,
La Direction de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 8,
    callerParamCount: 7,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Conge annuel],[01/02/2026],[07/02/2026],[7],[approuvee],[Bon retour parmi nous.]',
  },
  {
    elementName: 'decision_heures_sup',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Overtime decision',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Vos heures supplementaires du {{3}} ({{4}}h) ont ete {{5}} chez {{1}}.

{{6}}

Cordialement,
La Direction de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 6,
    callerParamCount: 5,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[15/01/2026],[4],[validees],[Ces heures seront integrees a votre prochaine paie.]',
  },
  {
    elementName: 'resume_recrutement_quotidien',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Recruitment summary',
    body: `Etablissement : {{1}}

Bonjour,

Resume recrutement du {{2}} - {{1}} :

Nouvelles candidatures : {{3}}
Entretiens programmés : {{4}}
Entretiens realises : {{5}}
Tests programmés : {{6}}
Tests realises : {{7}}
Embauches : {{8}}
Rejets : {{9}}

Connectez-vous a votre espace pour le detail.

Cordialement,
L'equipe RH de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 9,
    callerParamCount: 8,
    sampleBody: '[CSPEB],[15/01/2026],[3],[2],[1],[1],[0],[1],[1]',
  },
  {
    elementName: 'test_a_passer',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Test invitation',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Vous etes invite(e) a passer le test "{{3}}" chez {{1}}.

Duree : {{4}} minutes
A passer avant : {{5}}

Lien du test : {{6}}

Bon courage !

Cordialement,
L'equipe RH de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 6,
    callerParamCount: 5,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Test de competences pedagogiques],[60],[22/01/2026 23h59],[https://academiahelm.com/test/token123]',
  },
  {
    elementName: 'carte_professionnelle',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Staff card ready',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Votre carte professionnelle de {{1}} est disponible.

Vous pouvez la telecharger et la presenter a votre employeur ou partenaires.

Lien : {{3}}

Cordialement,
La Direction de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'hr',
    bodyPlaceholderCount: 3,
    callerParamCount: 2,
    sampleBody: '[CSPEB],[Erhel DEGBE],[https://academiahelm.com/card/MAT001.pdf]',
  },

  // ─── MODULE PÉDAGOGIE (3) ───────────────────────────────────────────────
  {
    elementName: 'soumission_document_pedago',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Document submitted',
    body: `Etablissement : {{1}}

Bonjour,

Une nouvelle soumission pedagogique a ete effectuee chez {{1}} :

Type : {{2}}
Titre : {{3}}
Enseignant : {{4}}
{{5}}

Connectez-vous a votre espace pour valider.

Cordialement,
La Direction pedagogique de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'pedagogy',
    bodyPlaceholderCount: 5,
    callerParamCount: 4,
    sampleBody:
      '[CSPEB],[Fiche pedagogique],[Semaine 3 - Janvier 2026],[Erhel DEGBE],[Classe : CP1 | Matiere : Mathematiques]',
  },
  {
    elementName: 'validation_document_pedago',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Document validated',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Votre document pedagogique "{{3}}" ({{4}}) a ete {{5}} chez {{1}}.

{{6}}

Connectez-vous pour consulter les details.

Cordialement,
La Direction pedagogique de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'pedagogy',
    bodyPlaceholderCount: 6,
    callerParamCount: 5,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[Semaine 3 - Janvier 2026],[Fiche pedagogique],[valide],[Tres bon travail, contenus conformes au programme officiel]',
  },
  {
    elementName: 'recapitulatif_pedagogique',
    category: 'UTILITY',
    templateType: 'TEXT',
    useCase: 'Profile summary',
    body: `Etablissement : {{1}}

Bonjour {{2}},

Votre recapitulatif pedagogique ({{3}}) est disponible chez {{1}}.

Matricule : {{4}}
Niveau : {{5}}
Heures assignees : {{6}} / {{7}} ({{8}})

Le recapitulatif complet vous a ete envoye par email (avec PDF en piece jointe).

Cordialement,
La Direction pedagogique de {{1}}`,
    footer: FOOTER,
    language: 'fr',
    module: 'pedagogy',
    bodyPlaceholderCount: 8,
    callerParamCount: 7,
    sampleBody:
      '[CSPEB],[Erhel DEGBE],[2025-2026],[MAT001],[Primaire],[18],[24],[Sous-charge]',
  },
];

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class WhatsAppTemplateRegistry {
  private readonly logger = new Logger(WhatsAppTemplateRegistry.name);
  private readonly templates: Map<string, GupshupTemplate> = new Map();

  constructor() {
    for (const t of TEMPLATES) {
      this.templates.set(t.elementName, t);
    }
    this.logger.log(`📋 ${this.templates.size} templates WhatsApp v2 chargés (sans header, école en body position 1)`);
  }

  /**
   * Récupère un template par son elementName.
   */
  get(elementName: string): GupshupTemplate | undefined {
    return this.templates.get(elementName);
  }

  /**
   * Récupère un template ou lance une erreur s'il n'existe pas.
   */
  require(elementName: string): GupshupTemplate {
    const t = this.templates.get(elementName);
    if (!t) {
      throw new Error(
        `Template WhatsApp inconnu: "${elementName}". ` +
          `Templates disponibles: ${Array.from(this.templates.keys()).join(', ')}`,
      );
    }
    return t;
  }

  /**
   * Liste tous les templates (résumé).
   */
  list(): TemplateSummary[] {
    return Array.from(this.templates.values()).map((t) => ({
      elementName: t.elementName,
      useCase: t.useCase,
      category: t.category,
      module: t.module,
      bodyPlaceholderCount: t.bodyPlaceholderCount,
      callerParamCount: t.callerParamCount,
    }));
  }

  /**
   * Liste les templates par module.
   */
  listByModule(module: 'hr' | 'students' | 'pedagogy'): TemplateSummary[] {
    return this.list().filter((t) => t.module === module);
  }

  /**
   * Valide que le tableau de bodyParams (INCLUANT schoolName en position 1)
   * correspond au nombre attendu de placeholders dans le template.
   *
   * @param elementName - Nom du template
   * @param totalParams - Tableau INCLUANT schoolName à la position 1
   * @returns true si valide
   */
  validateBodyParams(elementName: string, totalParams: string[]): boolean {
    const t = this.get(elementName);
    if (!t) return false;
    return totalParams.length === t.bodyPlaceholderCount;
  }

  /**
   * Valide que le tableau de callerParams (SANS schoolName) correspond au
   * nombre attendu.
   *
   * @param elementName - Nom du template
   * @param callerParams - Tableau SANS schoolName (juste les variables métier)
   * @returns true si valide
   */
  validateCallerParams(elementName: string, callerParams: string[]): boolean {
    const t = this.get(elementName);
    if (!t) return false;
    return callerParams.length === t.callerParamCount;
  }

  /**
   * Génère le body complet avec variables substituées.
   *
   * @param elementName - Nom du template
   * @param totalParams - Tableau INCLUANT schoolName en position 1
   * @returns Body avec variables substituées
   */
  renderBody(elementName: string, totalParams: string[]): string {
    const t = this.require(elementName);
    if (totalParams.length !== t.bodyPlaceholderCount) {
      throw new Error(
        `Nombre de paramètres incorrect pour "${elementName}": ` +
          `attendu ${t.bodyPlaceholderCount} (incluant schoolName en position 1), reçu ${totalParams.length}`,
      );
    }
    let rendered = t.body;
    totalParams.forEach((value, i) => {
      rendered = rendered.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), value);
    });
    return rendered;
  }

  /**
   * Construit le tableau final de bodyParams pour Gupshup en injectant
   * automatiquement schoolName en position 1.
   *
   * @param elementName - Nom du template
   * @param schoolName - Nom de l'école (depuis tenant_identity_profiles)
   * @param callerParams - Variables métier (sans schoolName)
   * @returns Tableau complet [schoolName, ...callerParams]
   */
  buildBodyParams(
    elementName: string,
    schoolName: string,
    callerParams: string[],
  ): string[] {
    const t = this.require(elementName);
    if (callerParams.length !== t.callerParamCount) {
      throw new Error(
        `Nombre de callerParams incorrect pour "${elementName}": ` +
          `attendu ${t.callerParamCount}, reçu ${callerParams.length}`,
      );
    }
    return [schoolName, ...callerParams];
  }
}
