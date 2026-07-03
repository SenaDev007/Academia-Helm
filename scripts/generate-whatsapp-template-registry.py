"""
Génère le nouveau whatsapp-template.registry.ts (v3) avec:
- Variables nommées {{snake_case}} au lieu de {{1}}
- Header TEXT court
- Body Meta-conforme (variables jamais en début/fin)
- Footer "Academia Helm"
- 3 boutons URL (subdomain, whatsapp_number, phone_number)
- Méthodes renderBody / buildBodyParams adaptées aux variables nommées
- sampleBody étendu avec les 3 variables de boutons
"""

from pathlib import Path

# 20 templates au format Meta v3 (variables snake_case + 3 boutons URL)
# callerParamCount = nombre de vars métier SANS schoolName (qui est auto-injecté dans le body)
# bodyPlaceholderCount = nombre total de vars dans le body (incluant school_name)
# buttonParams = 3 (subdomain + whatsapp_number + phone_number)

FOOTER = 'Academia Helm'

TEMPLATES = [
    {
        "elementName": "admission_recue",
        "category": "UTILITY",
        "useCase": "Admission confirmation",
        "module": "students",
        "header": "Accuse de reception - Admission",
        "body": """Bonjour {{parent_name}},

Nous accusons reception de la demande d'admission de {{student_name}} pour l'annee scolaire {{academic_year}} en classe de {{class_name}} aupres de l'etablissement {{school_name}}.

Numero de dossier : {{file_number}}

Notre equipe pedagogique examinera votre demande dans les meilleurs delais et reviendra vers vous pour les prochaines etapes.

Cordialement,
La Direction""",
        "vars": ["parent_name", "student_name", "academic_year", "class_name", "school_name", "file_number"],
        "sampleBody": "[M. ADANDE],[Aicha ADANDE],[2025-2026],[CP1],[CSPEB],[ADM-2025-001]",
    },
    {
        "elementName": "inscription_confirmee",
        "category": "UTILITY",
        "useCase": "Enrollment confirmation",
        "module": "students",
        "header": "Inscription confirmee",
        "body": """Bonjour {{parent_name}},

Felicitations ! L'inscription de {{student_name}} est officiellement confirmee a l'etablissement {{school_name}}.

Classe : {{class_name}}
Matricule : {{student_id}}
Annee scolaire : {{academic_year}}

Conservez precieusement ce matricule : il vous sera demande pour toute communication avec l'ecole.

Cordialement,
La Direction""",
        "vars": ["parent_name", "student_name", "school_name", "class_name", "student_id", "academic_year"],
        "sampleBody": "[M. ADANDE],[Aicha ADANDE],[CSPEB],[CP1],[001],[2025-2026]",
    },
    {
        "elementName": "candidature_recue",
        "category": "UTILITY",
        "useCase": "Application received",
        "module": "hr",
        "header": "Candidature recue",
        "body": """Bonjour {{candidate_name}},

Nous avons bien recu votre candidature pour le poste de {{job_title}} aupres de l'etablissement {{school_name}}.

Votre profil sera examine par notre equipe de recrutement. Si votre candidature est retenue, vous serez contacte(e) pour la suite du processus.

Cordialement,
L'equipe RH""",
        "vars": ["candidate_name", "job_title", "school_name"],
        "sampleBody": "[Erhel DEGBE],[Professeur de Mathematiques],[CSPEB]",
    },
    {
        "elementName": "entretien_programme",
        "category": "UTILITY",
        "useCase": "Interview scheduled",
        "module": "hr",
        "header": "Entretien programme",
        "body": """Bonjour {{candidate_name}},

Un entretien est programme pour votre candidature au poste de {{job_title}} chez {{school_name}}.

Date : {{interview_date}}
Heure : {{interview_time}}
Format : {{interview_format}}
Evaluateur : {{interviewer_name}}

Lien / Contact : {{contact_link}}

Merci de confirmer votre presence.

Cordialement,
L'equipe RH""",
        "vars": ["candidate_name", "job_title", "school_name", "interview_date", "interview_time", "interview_format", "interviewer_name", "contact_link"],
        "sampleBody": "[Erhel DEGBE],[Professeur de Mathematiques],[CSPEB],[15/01/2026],[10h00],[Visioconference],[M. Kossi ADANDE],[https://meet.google.com/abc-defg-hij]",
    },
    {
        "elementName": "test_programme",
        "category": "UTILITY",
        "useCase": "Test scheduled",
        "module": "hr",
        "header": "Test programme",
        "body": """Bonjour {{candidate_name}},

Un test est programme pour votre candidature au poste de {{job_title}} chez {{school_name}}.

Test : {{test_name}}
Duree : {{test_duration}}
Bareme : {{test_max_score}} / Seuil de reussite : {{test_pass_score}}

Instructions : {{test_instructions}}

Cordialement,
L'equipe RH""",
        "vars": ["candidate_name", "job_title", "school_name", "test_name", "test_duration", "test_max_score", "test_pass_score", "test_instructions"],
        "sampleBody": "[Erhel DEGBE],[Professeur de Mathematiques],[CSPEB],[Test de competences pedagogiques],[60 minutes],[100],[50],[Aucun document autorise]",
    },
    {
        "elementName": "resultat_entretien",
        "category": "UTILITY",
        "useCase": "Interview result",
        "module": "hr",
        "header": "Resultat entretien",
        "body": """Bonjour {{candidate_name}},

Suite a votre entretien pour le poste de {{job_title}} chez {{school_name}}, nous vous informons que votre candidature est {{application_status}}.

Retour de l'evaluateur : {{interviewer_feedback}}

Cordialement,
L'equipe RH""",
        "vars": ["candidate_name", "job_title", "school_name", "application_status", "interviewer_feedback"],
        "sampleBody": "[Erhel DEGBE],[Professeur de Mathematiques],[CSPEB],[retenue],[Tres bonne presentation, profil adapte au poste]",
    },
    {
        "elementName": "resultat_test",
        "category": "UTILITY",
        "useCase": "Test result",
        "module": "hr",
        "header": "Resultat test",
        "body": """Bonjour {{candidate_name}},

Suite au test "{{test_name}}" pour votre candidature au poste de {{job_title}} chez {{school_name}}, votre resultat est {{test_result}}.

Score : {{test_score}} / {{test_max_score}}

Retour : {{test_feedback}}

Cordialement,
L'equipe RH""",
        "vars": ["candidate_name", "test_name", "job_title", "school_name", "test_result", "test_score", "test_max_score", "test_feedback"],
        "sampleBody": "[Erhel DEGBE],[Test de competences pedagogiques],[Professeur de Mathematiques],[CSPEB],[reussi],[78],[100],[Tres bonnes reponses sur la didactique]",
    },
    {
        "elementName": "embauche_confirmee",
        "category": "UTILITY",
        "useCase": "Job offer accepted",
        "module": "hr",
        "header": "Embauche confirmee",
        "body": """Bonjour {{candidate_name}},

Felicitations ! Vous etes officiellement embauche(e) chez {{school_name}} pour le poste de {{job_title}}.

Type de contrat : {{contract_type}}
Date de prise de fonction : {{start_date}}
Salaire : {{salary_amount}}

Votre contrat : {{contract_link}}

Bienvenue dans l'equipe !

Cordialement,
La Direction""",
        "vars": ["candidate_name", "school_name", "job_title", "contract_type", "start_date", "salary_amount", "contract_link"],
        "sampleBody": "[Erhel DEGBE],[CSPEB],[Professeur de Mathematiques],[CDI],[01/09/2026],[350000 FCFA],[https://academiahelm.com/contract/abc123]",
    },
    {
        "elementName": "contrat_signe",
        "category": "UTILITY",
        "useCase": "Contract signed",
        "module": "hr",
        "header": "Contrat signe",
        "body": """Bonjour {{employee_name}},

Votre contrat de travail chez {{school_name}} (poste : {{job_title}}) a ete signe avec succes.

Type de contrat : {{contract_type}}
Date de signature : {{signature_date}}

Telecharger : {{contract_link}}

Bienvenue definitivement dans l'equipe !

Cordialement,
La Direction""",
        "vars": ["employee_name", "school_name", "job_title", "contract_type", "signature_date", "contract_link"],
        "sampleBody": "[Erhel DEGBE],[CSPEB],[Professeur de Mathematiques],[CDI],[15/01/2026],[https://academiahelm.com/contract/abc123.pdf]",
    },
    {
        "elementName": "candidature_rejetee",
        "category": "UTILITY",
        "useCase": "Application rejected",
        "module": "hr",
        "header": "Suite candidature",
        "body": """Bonjour {{candidate_name}},

Nous vous remercions de l'interet que vous portez a {{school_name}} pour le poste de {{job_title}}.

Apres examen de votre candidature, nous regrettons de vous informer que nous ne pourrons pas donner une suite favorable a votre demande.

{{rejection_message}}

Nous vous souhaitons plein de succes dans vos futures demarches.

Cordialement,
L'equipe RH""",
        "vars": ["candidate_name", "school_name", "job_title", "rejection_message"],
        "sampleBody": "[Erhel DEGBE],[CSPEB],[Professeur de Mathematiques],[Nous vous remercions de votre comprehension.]",
    },
    {
        "elementName": "demande_documents",
        "category": "UTILITY",
        "useCase": "Document request",
        "module": "hr",
        "header": "Documents a fournir",
        "body": """Bonjour {{candidate_name}},

Pour finaliser votre dossier de candidature (poste : {{job_title}}) chez {{school_name}}, merci de fournir les documents suivants via le lien securise ci-dessous :

Documents requis : {{required_documents}}

Lien de televersement : {{upload_link}}
Date limite : {{deadline_date}}

Cordialement,
L'equipe RH""",
        "vars": ["candidate_name", "job_title", "school_name", "required_documents", "upload_link", "deadline_date"],
        "sampleBody": "[Erhel DEGBE],[Professeur de Mathematiques],[CSPEB],[CV, Diplome, Casier judiciaire],[https://academiahelm.com/upload/token123],[22/01/2026]",
    },
    {
        "elementName": "identifiants_connexion",
        "category": "UTILITY",
        "useCase": "Account credentials",
        "module": "hr",
        "header": "Vos identifiants",
        "body": """Bonjour {{user_name}},

Vos identifiants de connexion a la plateforme de {{school_name}} ont ete crees.

Identifiant : {{username}}
Mot de passe temporaire : {{temp_password}}
Role : {{user_role}}
Portail : {{portal_url}}

Pour des raisons de securite, veuillez changer ce mot de passe lors de votre premiere connexion.

Cordialement,
L'administration""",
        "vars": ["user_name", "school_name", "username", "temp_password", "user_role", "portal_url"],
        "sampleBody": "[Erhel DEGBE],[CSPEB],[MAT001],[TempPass2026],[Enseignant],[https://cspeb.academiahelm.com/login]",
    },
    {
        "elementName": "decision_conge",
        "category": "UTILITY",
        "useCase": "Leave decision",
        "module": "hr",
        "header": "Decision conge",
        "body": """Bonjour {{employee_name}},

Votre demande de conge ({{leave_type}}) du {{start_date}} au {{end_date}} ({{leave_days}} jours) a ete {{leave_status}} chez {{school_name}}.

{{leave_comment}}

Cordialement,
La Direction""",
        "vars": ["employee_name", "leave_type", "start_date", "end_date", "leave_days", "leave_status", "school_name", "leave_comment"],
        "sampleBody": "[Erhel DEGBE],[Conge annuel],[01/02/2026],[07/02/2026],[7],[approuvee],[CSPEB],[Bon retour parmi nous.]",
    },
    {
        "elementName": "decision_heures_sup",
        "category": "UTILITY",
        "useCase": "Overtime decision",
        "module": "hr",
        "header": "Heures supplementaires",
        "body": """Bonjour {{employee_name}},

Vos heures supplementaires du {{overtime_date}} ({{overtime_hours}}h) ont ete {{overtime_status}} chez {{school_name}}.

{{overtime_comment}}

Cordialement,
La Direction""",
        "vars": ["employee_name", "overtime_date", "overtime_hours", "overtime_status", "school_name", "overtime_comment"],
        "sampleBody": "[Erhel DEGBE],[15/01/2026],[4],[validees],[CSPEB],[Ces heures seront integrees a votre prochaine paie.]",
    },
    {
        "elementName": "resume_recrutement_quotidien",
        "category": "UTILITY",
        "useCase": "Recruitment summary",
        "module": "hr",
        "header": "Recap recrutement",
        "body": """Bonjour,

Resume recrutement du {{summary_date}} - {{school_name}} :

Nouvelles candidatures : {{new_applications}}
Entretiens programmes : {{scheduled_interviews}}
Entretiens realises : {{completed_interviews}}
Tests programmes : {{scheduled_tests}}
Tests realises : {{completed_tests}}
Embauches : {{hires_count}}
Rejets : {{rejections_count}}

Connectez-vous a votre espace pour le detail.

Cordialement,
L'equipe RH""",
        "vars": ["summary_date", "school_name", "new_applications", "scheduled_interviews", "completed_interviews", "scheduled_tests", "completed_tests", "hires_count", "rejections_count"],
        "sampleBody": "[15/01/2026],[CSPEB],[3],[2],[1],[1],[0],[1],[1]",
    },
    {
        "elementName": "test_a_passer",
        "category": "UTILITY",
        "useCase": "Test invitation",
        "module": "hr",
        "header": "Test a passer",
        "body": """Bonjour {{candidate_name}},

Vous etes invite(e) a passer le test "{{test_name}}" chez {{school_name}}.

Duree : {{test_duration}} minutes
A passer avant : {{deadline_date}}

Lien du test : {{test_link}}

Bon courage !

Cordialement,
L'equipe RH""",
        "vars": ["candidate_name", "test_name", "school_name", "test_duration", "deadline_date", "test_link"],
        "sampleBody": "[Erhel DEGBE],[Test de competences pedagogiques],[CSPEB],[60],[22/01/2026 23h59],[https://academiahelm.com/test/token123]",
    },
    {
        "elementName": "carte_professionnelle",
        "category": "UTILITY",
        "useCase": "Staff card ready",
        "module": "hr",
        "header": "Carte professionnelle",
        "body": """Bonjour {{employee_name}},

Votre carte professionnelle de {{school_name}} est disponible.

Vous pouvez la telecharger et la presenter a votre employeur ou partenaires.

Lien : {{card_link}}

Cordialement,
La Direction""",
        "vars": ["employee_name", "school_name", "card_link"],
        "sampleBody": "[Erhel DEGBE],[CSPEB],[https://academiahelm.com/card/MAT001.pdf]",
    },
    {
        "elementName": "soumission_document_pedago",
        "category": "UTILITY",
        "useCase": "Document submitted",
        "module": "pedagogy",
        "header": "Soumission pedagogique",
        "body": """Bonjour,

Une nouvelle soumission pedagogique a ete effectuee chez {{school_name}} :

Type : {{document_type}}
Titre : {{document_title}}
Enseignant : {{teacher_name}}
{{document_metadata}}

Connectez-vous a votre espace pour valider.

Cordialement,
La Direction pedagogique""",
        "vars": ["school_name", "document_type", "document_title", "teacher_name", "document_metadata"],
        "sampleBody": "[CSPEB],[Fiche pedagogique],[Semaine 3 - Janvier 2026],[Erhel DEGBE],[Classe : CP1 | Matiere : Mathematiques]",
    },
    {
        "elementName": "validation_document_pedago",
        "category": "UTILITY",
        "useCase": "Document validated",
        "module": "pedagogy",
        "header": "Document valide",
        "body": """Bonjour {{teacher_name}},

Votre document pedagogique "{{document_title}}" ({{document_type}}) a ete {{validation_status}} chez {{school_name}}.

{{validation_feedback}}

Connectez-vous pour consulter les details.

Cordialement,
La Direction pedagogique""",
        "vars": ["teacher_name", "document_title", "document_type", "validation_status", "school_name", "validation_feedback"],
        "sampleBody": "[Erhel DEGBE],[Semaine 3 - Janvier 2026],[Fiche pedagogique],[valide],[CSPEB],[Tres bon travail, contenus conformes au programme officiel]",
    },
    {
        "elementName": "recapitulatif_pedagogique",
        "category": "UTILITY",
        "useCase": "Profile summary",
        "module": "pedagogy",
        "header": "Recapitulatif pedagogique",
        "body": """Bonjour {{teacher_name}},

Votre recapitulatif pedagogique ({{academic_year}}) est disponible chez {{school_name}}.

Matricule : {{teacher_id}}
Niveau : {{teaching_level}}
Heures assignees : {{assigned_hours}} / {{required_hours}} ({{workload_status}})

Le recapitulatif complet vous a ete envoye par email (avec PDF en piece jointe).

Cordialement,
La Direction pedagogique""",
        "vars": ["teacher_name", "academic_year", "school_name", "teacher_id", "teaching_level", "assigned_hours", "required_hours", "workload_status"],
        "sampleBody": "[Erhel DEGBE],[2025-2026],[CSPEB],[MAT001],[Primaire],[18],[24],[Sous-charge]",
    },
]


def render_template_entry(t: dict) -> str:
    vars_array = ", ".join(f'"{v}"' for v in t["vars"])
    body_escaped = t["body"].replace("`", "\\`").replace("${", "\\${")
    return f"""  {{
    elementName: '{t["elementName"]}',
    category: '{t["category"]}',
    templateType: 'TEXT',
    useCase: '{t["useCase"]}',
    module: '{t["module"]}',
    header: '{t["header"]}',
    body: `{body_escaped}`,
    footer: FOOTER,
    language: 'fr',
    // Variables dans l'ordre d'apparition dans le body (variables nommées Meta v3)
    bodyVariables: [{vars_array}],
    bodyPlaceholderCount: {len(t["vars"])},
    callerParamCount: {len(t["vars"]) - 1},  // bodyVariables sans school_name (auto-injecté)
    sampleBody: '{t["sampleBody"]}',
    // 3 boutons URL dynamiques (subdomain, whatsapp_number, phone_number)
    buttons: BUTTONS_URL,
    buttonParamCount: 3,
  }},"""


def render_typescript():
    entries = "\n".join(render_template_entry(t) for t in TEMPLATES)

    return f"""/**
 * ============================================================================
 * WHATSAPP TEMPLATE REGISTRY - META BUSINESS PLATFORM (v3.0)
 * ============================================================================
 *
 * Registre des 20 templates WhatsApp pour Academia Helm — format Meta.
 *
 * ─── Version 3.0 ────────────────────────────────────────────────────────
 * - Variables nommées {{{{snake_case}}}} (au lieu de {{{{1}}}}, {{{{2}}}}, ...)
 *   Meta exige des variables nommées (lettres minuscules + tirets bas + chiffres)
 * - Header TEXT court (≤ 60 caractères)
 * - Footer TEXT court "Academia Helm"
 * - 3 boutons URL par template (Meta permet jusqu'à 10 boutons par template):
 *     1. "Consulter le site" → https://{{{{1}}}}.academiahelm.com  (var = subdomain)
 *     2. "Discuter sur WhatsApp" → https://wa.me/{{{{1}}}}           (var = whatsapp_number)
 *     3. "Appeler l'école" → https://wa.me/{{{{1}}}}                  (var = phone_number)
 * - Variables jamais en début/fin de body ni de ligne (règle Meta)
 *
 * ─── Convention de variables ────────────────────────────────────────────
 * - {{{{school_name}}}} : nom de l'école (injecté automatiquement par sendForTenant())
 * - Les autres variables métier sont fournies par le caller via callerParams
 * - callerParams doit contenir UNIQUEMENT les variables métier (sans school_name)
 * - Au moment d'envoyer à Meta Graph API, le service :
 *     1. Associe chaque callerParam à sa variable nommée (via callerVarOrder)
 *     2. Ajoute school_name = tenantIdentityProfile.schoolName
 *     3. Ajoute subdomain / whatsapp_number / phone_number (via tenant identity)
 *
 * ─── Source ───────────────────────────────────────────────────────────
 * Templates Meta v3 — 20 templates créés dans Meta Business Platform.
 * Fichier de référence : download/whatsapp-templates-meta-v3.html
 *
 * ============================================================================
 */

import {{ Injectable, Logger }} from '@nestjs/common';

/**
 * Représentation normalisée d'un template WhatsApp Meta (v3).
 */
export interface MetaTemplate {{
  /** Nom unique du template (Meta elementName). */
  elementName: string;
  /** Catégorie Meta (UTILITY, MARKETING, AUTHENTICATION). */
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  /** Type de template (TEXT pour l'instant). */
  templateType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  /** Cas d'usage court (2-3 mots) pour labellisation Meta. */
  useCase: string;
  /** Module d'origine (hr, students, pedagogy). */
  module: 'hr' | 'students' | 'pedagogy';
  /** Header TEXT court (≤ 60 caractères). */
  header: string;
  /** Corps du message avec placeholders nommés {{{{var_name}}}}. */
  body: string;
  /** Footer statique (max 60 caractères). */
  footer?: string;
  /** Langue ISO 639-1 (fr par défaut). */
  language: string;
  /**
   * Liste ordonnée des variables dans le body (ex: ['parent_name', 'student_name', ...]).
   * L'ordre correspond à l'ordre d'apparition dans le body.
   * Sert à mapper callerParams (array) → variables nommées (object).
   */
  bodyVariables: string[];
  /**
   * Nombre total de variables uniques dans le body.
   * = bodyVariables.length
   */
  bodyPlaceholderCount: number;
  /**
   * Nombre de paramètres que le caller doit fournir (SANS school_name auto-injecté).
   * = bodyPlaceholderCount - 1
   */
  callerParamCount: number;
  /** Valeurs d'exemple pour validation Meta (format [val1],[val2],...). */
  sampleBody?: string;
  /** Boutons URL du template (3 boutons dynamiques). */
  buttons?: MetaTemplateButton[];
  /** Nombre de variables de boutons (toujours 3 : subdomain, whatsapp_number, phone_number). */
  buttonParamCount?: number;
}}

/**
 * Bouton URL dynamique pour template Meta.
 */
export interface MetaTemplateButton {{
  /** Type de bouton (toujours URL pour les boutons dynamiques). */
  type: 'URL';
  /** Texte affiché sur le bouton. */
  text: string;
  /** Template d'URL avec variable {{{{1}}}} (Meta utilise index 1-based pour les boutons). */
  urlTemplate: string;
  /** Nom logique de la variable (pour mapping). */
  varName: 'subdomain' | 'whatsapp_number' | 'phone_number';
}}

/**
 * Résumé d'un template pour listage API.
 */
export interface TemplateSummary {{
  elementName: string;
  useCase: string;
  category: string;
  module: string;
  bodyPlaceholderCount: number;
  callerParamCount: number;
  hasButtons: boolean;
  buttonParamCount: number;
}}

// ============================================================================
// CONSTANTES
// ============================================================================

const FOOTER = '{FOOTER}';

/**
 * 3 boutons URL standard pour tous les templates.
 * Meta utilise {{{{1}}}} (1-based) pour les variables de boutons.
 */
const BUTTONS_URL: MetaTemplateButton[] = [
  {{
    type: 'URL',
    text: 'Consulter le site',
    urlTemplate: 'https://{{{{1}}}}.academiahelm.com',
    varName: 'subdomain',
  }},
  {{
    type: 'URL',
    text: 'Discuter sur WhatsApp',
    urlTemplate: 'https://wa.me/{{{{1}}}}',
    varName: 'whatsapp_number',
  }},
  {{
    type: 'URL',
    text: "Appeler l'ecole",
    urlTemplate: 'https://wa.me/{{{{1}}}}',
    varName: 'phone_number',
  }},
];

// ============================================================================
// DÉFINITION DES 20 TEMPLATES (v3 - variables nommées Meta)
// ============================================================================

const TEMPLATES: MetaTemplate[] = [
{entries}
];

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class WhatsAppTemplateRegistry {{
  private readonly logger = new Logger(WhatsAppTemplateRegistry.name);
  private readonly templates: Map<string, MetaTemplate> = new Map();

  constructor() {{
    for (const t of TEMPLATES) {{
      this.templates.set(t.elementName, t);
    }}
    this.logger.log(
      `📋 ${{this.templates.size}} templates WhatsApp v3 chargés ` +
      `(Meta Business Platform, variables nommées, 3 boutons URL par template)`,
    );
  }}

  /**
   * Récupère un template par son elementName.
   */
  get(elementName: string): MetaTemplate | undefined {{
    return this.templates.get(elementName);
  }}

  /**
   * Récupère un template ou lance une erreur s'il n'existe pas.
   */
  require(elementName: string): MetaTemplate {{
    const t = this.templates.get(elementName);
    if (!t) {{
      throw new Error(
        `Template WhatsApp inconnu: "${{elementName}}". ` +
          `Templates disponibles: ${{Array.from(this.templates.keys()).join(', ')}}`,
      );
    }}
    return t;
  }}

  /**
   * Liste tous les templates (résumé).
   */
  list(): TemplateSummary[] {{
    return Array.from(this.templates.values()).map((t) => ({{
      elementName: t.elementName,
      useCase: t.useCase,
      category: t.category,
      module: t.module,
      bodyPlaceholderCount: t.bodyPlaceholderCount,
      callerParamCount: t.callerParamCount,
      hasButtons: !!t.buttons?.length,
      buttonParamCount: t.buttonParamCount ?? 0,
    }}));
  }}

  /**
   * Liste les templates par module.
   */
  listByModule(module: 'hr' | 'students' | 'pedagogy'): TemplateSummary[] {{
    return this.list().filter((t) => t.module === module);
  }}

  /**
   * Valide que le tableau de callerParams (SANS school_name) correspond au
   * nombre attendu.
   */
  validateCallerParams(elementName: string, callerParams: string[]): boolean {{
    const t = this.get(elementName);
    if (!t) return false;
    return callerParams.length === t.callerParamCount;
  }}

  /**
   * Génère le body complet avec variables nommées substituées.
   *
   * @param elementName - Nom du template
   * @param paramsByName - Objet {{ var_name: value }} (incluant school_name)
   * @returns Body avec variables substituées
   */
  renderBody(elementName: string, paramsByName: Record<string, string>): string {{
    const t = this.require(elementName);
    let rendered = t.body;
    for (const varName of t.bodyVariables) {{
      const value = paramsByName[varName] ?? '';
      // Échapper les $ pour éviter interpolation dans les regex
      const safeValue = String(value).replace(/\\$/g, '$$$$');
      rendered = rendered.replace(new RegExp(`\\{{\\{{${{varName}}\\}}\\}}`, 'g'), safeValue);
    }}
    return rendered;
  }}

  /**
   * Construit l'objet paramsByName pour le body à partir de callerParams.
   *
   * Le caller fournit un tableau de valeurs métier (sans school_name).
   * On mappe chaque valeur à sa variable nommée via bodyVariables,
   * en excluant 'school_name' (qui sera ajouté séparément).
   *
   * @param elementName - Nom du template
   * @param schoolName - Nom de l'école (depuis tenant_identity_profiles)
   * @param callerParams - Variables métier (sans school_name)
   * @returns Objet {{ school_name: '...', var1: '...', var2: '...', ... }}
   */
  buildBodyParamsByName(
    elementName: string,
    schoolName: string,
    callerParams: string[],
  ): Record<string, string> {{
    const t = this.require(elementName);
    if (callerParams.length !== t.callerParamCount) {{
      throw new Error(
        `Nombre de callerParams incorrect pour "${{elementName}}": ` +
          `attendu ${{t.callerParamCount}}, reçu ${{callerParams.length}}`,
      );
    }}

    const paramsByName: Record<string, string> = {{ school_name: schoolName }};
    let callerIdx = 0;
    for (const varName of t.bodyVariables) {{
      if (varName === 'school_name') continue;
      paramsByName[varName] = String(callerParams[callerIdx] ?? '');
      callerIdx++;
    }}
    return paramsByName;
  }}

  /**
   * Construit le tableau de paramètres pour les boutons URL.
   *
   * Ordre : [subdomain, whatsapp_number, phone_number]
   * Ces valeurs proviennent de TenantIdentityProfile + Tenant.subdomain.
   *
   * @returns Tableau [subdomain, whatsapp_number, phone_number]
   */
  buildButtonParams(branding: {{
    subdomain?: string | null;
    whatsappNumber?: string | null;
    phoneNumber?: string | null;
  }}): string[] {{
    return [
      branding.subdomain || 'academiahelm',
      this.normalizePhone(branding.whatsappNumber) || '0000000000',
      this.normalizePhone(branding.phoneNumber) || '0000000000',
    ];
  }}

  /**
   * Normalise un numéro de téléphone au format E.164 sans le '+'.
   * Ex: "+229 97 12 34 56" → "22997123456"
   * Requis par wa.me/{{phone}} (Meta exige E.164 sans '+').
   */
  private normalizePhone(phone: string | null | undefined): string {{
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  }}

  /**
   * Récupère la définition des boutons d'un template.
   */
  getButtons(elementName: string): MetaTemplateButton[] {{
    return this.require(elementName).buttons ?? [];
  }}
}}
"""


def main():
    ts = render_typescript()
    out_path = Path("/home/z/my-project/apps/api-server/src/communication/services/whatsapp-template.registry.ts")
    out_path.write_text(ts, encoding="utf-8")
    print(f"✓ Fichier généré : {out_path}")
    print(f"  Templates : {len(TEMPLATES)}")
    print(f"  Variables : snake_case (Meta v3)")
    print(f"  Boutons par template : 3 (subdomain, whatsapp_number, phone_number)")


if __name__ == "__main__":
    main()
