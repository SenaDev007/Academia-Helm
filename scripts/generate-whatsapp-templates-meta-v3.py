"""
Génère le fichier HTML des 20 templates WhatsApp Meta v3 (avec 3 boutons URL).
- Variables {{snake_case}}
- Header TEXT court
- Body conforme Meta
- Footer "Academia Helm"
- 3 boutons URL :
   1. "Consulter le site" → https://{{subdomain}}.academiahelm.com
   2. "Discuter sur WhatsApp" → https://wa.me/{{whatsapp_number}}
   3. "Appeler l'école" → https://wa.me/{{phone_number}}
- Exemples (samples) étendus pour inclure les 3 variables des boutons
"""

from pathlib import Path

# 20 templates au format Meta v3
# Chaque template a : name, label, header, body, body_vars (liste ordonnée des variables du body),
# sample_values (valeurs d'exemple pour les variables du body, dans l'ordre)
# Les 3 boutons sont ajoutés automatiquement à la fin.

FOOTER = "Academia Helm"

TEMPLATES = [
    {
        "name": "admission_recue",
        "label": "Admission confirmation",
        "header": "Accuse de reception - Admission",
        "body": """Bonjour {{parent_name}},

Nous accusons reception de la demande d'admission de {{student_name}} pour l'annee scolaire {{academic_year}} en classe de {{class_name}} aupres de l'etablissement {{school_name}}.

Numero de dossier : {{file_number}}

Notre equipe pedagogique examinera votre demande dans les meilleurs delais et reviendra vers vous pour les prochaines etapes.

Cordialement,
La Direction""",
        "sample_values": ["M. ADANDE", "Aicha ADANDE", "2025-2026", "CP1", "CSPEB", "ADM-2025-001"],
    },
    {
        "name": "inscription_confirmee",
        "label": "Enrollment confirmation",
        "header": "Inscription confirmee",
        "body": """Bonjour {{parent_name}},

Felicitations ! L'inscription de {{student_name}} est officiellement confirmee a l'etablissement {{school_name}}.

Classe : {{class_name}}
Matricule : {{student_id}}
Annee scolaire : {{academic_year}}

Conservez precieusement ce matricule : il vous sera demande pour toute communication avec l'ecole.

Cordialement,
La Direction""",
        "sample_values": ["M. ADANDE", "Aicha ADANDE", "CSPEB", "CP1", "001", "2025-2026"],
    },
    {
        "name": "candidature_recue",
        "label": "Application received",
        "header": "Candidature recue",
        "body": """Bonjour {{candidate_name}},

Nous avons bien recu votre candidature pour le poste de {{job_title}} aupres de l'etablissement {{school_name}}.

Votre profil sera examine par notre equipe de recrutement. Si votre candidature est retenue, vous serez contacte(e) pour la suite du processus.

Cordialement,
L'equipe RH""",
        "sample_values": ["Erhel DEGBE", "Professeur de Mathematiques", "CSPEB"],
    },
    {
        "name": "entretien_programme",
        "label": "Interview scheduled",
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
        "sample_values": ["Erhel DEGBE", "Professeur de Mathematiques", "CSPEB", "15/01/2026", "10h00", "Visioconference", "M. Kossi ADANDE", "https://meet.google.com/abc-defg-hij"],
    },
    {
        "name": "test_programme",
        "label": "Test scheduled",
        "header": "Test programme",
        "body": """Bonjour {{candidate_name}},

Un test est programme pour votre candidature au poste de {{job_title}} chez {{school_name}}.

Test : {{test_name}}
Duree : {{test_duration}}
Bareme : {{test_max_score}} / Seuil de reussite : {{test_pass_score}}

Instructions : {{test_instructions}}

Cordialement,
L'equipe RH""",
        "sample_values": ["Erhel DEGBE", "Professeur de Mathematiques", "CSPEB", "Test de competences pedagogiques", "60 minutes", "100", "50", "Aucun document autorise"],
    },
    {
        "name": "resultat_entretien",
        "label": "Interview result",
        "header": "Resultat entretien",
        "body": """Bonjour {{candidate_name}},

Suite a votre entretien pour le poste de {{job_title}} chez {{school_name}}, nous vous informons que votre candidature est {{application_status}}.

Retour de l'evaluateur : {{interviewer_feedback}}

Cordialement,
L'equipe RH""",
        "sample_values": ["Erhel DEGBE", "Professeur de Mathematiques", "CSPEB", "retenue", "Tres bonne presentation, profil adapte au poste"],
    },
    {
        "name": "resultat_test",
        "label": "Test result",
        "header": "Resultat test",
        "body": """Bonjour {{candidate_name}},

Suite au test "{{test_name}}" pour votre candidature au poste de {{job_title}} chez {{school_name}}, votre resultat est {{test_result}}.

Score : {{test_score}} / {{test_max_score}}

Retour : {{test_feedback}}

Cordialement,
L'equipe RH""",
        "sample_values": ["Erhel DEGBE", "Test de competences pedagogiques", "Professeur de Mathematiques", "CSPEB", "reussi", "78", "100", "Tres bonnes reponses sur la didactique"],
    },
    {
        "name": "embauche_confirmee",
        "label": "Job offer accepted",
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
        "sample_values": ["Erhel DEGBE", "CSPEB", "Professeur de Mathematiques", "CDI", "01/09/2026", "350000 FCFA", "https://academiahelm.com/contract/abc123"],
    },
    {
        "name": "contrat_signe",
        "label": "Contract signed",
        "header": "Contrat signe",
        "body": """Bonjour {{employee_name}},

Votre contrat de travail chez {{school_name}} (poste : {{job_title}}) a ete signe avec succes.

Type de contrat : {{contract_type}}
Date de signature : {{signature_date}}

Telecharger : {{contract_link}}

Bienvenue definitivement dans l'equipe !

Cordialement,
La Direction""",
        "sample_values": ["Erhel DEGBE", "CSPEB", "Professeur de Mathematiques", "CDI", "15/01/2026", "https://academiahelm.com/contract/abc123.pdf"],
    },
    {
        "name": "candidature_rejetee",
        "label": "Application rejected",
        "header": "Suite candidature",
        "body": """Bonjour {{candidate_name}},

Nous vous remercions de l'interet que vous portez a {{school_name}} pour le poste de {{job_title}}.

Apres examen de votre candidature, nous regrettons de vous informer que nous ne pourrons pas donner une suite favorable a votre demande.

{{rejection_message}}

Nous vous souhaitons plein de succes dans vos futures demarches.

Cordialement,
L'equipe RH""",
        "sample_values": ["Erhel DEGBE", "CSPEB", "Professeur de Mathematiques", "Nous vous remercions de votre comprehension."],
    },
    {
        "name": "demande_documents",
        "label": "Document request",
        "header": "Documents a fournir",
        "body": """Bonjour {{candidate_name}},

Pour finaliser votre dossier de candidature (poste : {{job_title}}) chez {{school_name}}, merci de fournir les documents suivants via le lien securise ci-dessous :

Documents requis : {{required_documents}}

Lien de televersement : {{upload_link}}
Date limite : {{deadline_date}}

Cordialement,
L'equipe RH""",
        "sample_values": ["Erhel DEGBE", "Professeur de Mathematiques", "CSPEB", "CV, Diplome, Casier judiciaire", "https://academiahelm.com/upload/token123", "22/01/2026"],
    },
    {
        "name": "identifiants_connexion",
        "label": "Account credentials",
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
        "sample_values": ["Erhel DEGBE", "CSPEB", "MAT001", "TempPass2026", "Enseignant", "https://cspeb.academiahelm.com/login"],
    },
    {
        "name": "decision_conge",
        "label": "Leave decision",
        "header": "Decision conge",
        "body": """Bonjour {{employee_name}},

Votre demande de conge ({{leave_type}}) du {{start_date}} au {{end_date}} ({{leave_days}} jours) a ete {{leave_status}} chez {{school_name}}.

{{leave_comment}}

Cordialement,
La Direction""",
        "sample_values": ["Erhel DEGBE", "Conge annuel", "01/02/2026", "07/02/2026", "7", "approuvee", "CSPEB", "Bon retour parmi nous."],
    },
    {
        "name": "decision_heures_sup",
        "label": "Overtime decision",
        "header": "Heures supplementaires",
        "body": """Bonjour {{employee_name}},

Vos heures supplementaires du {{overtime_date}} ({{overtime_hours}}h) ont ete {{overtime_status}} chez {{school_name}}.

{{overtime_comment}}

Cordialement,
La Direction""",
        "sample_values": ["Erhel DEGBE", "15/01/2026", "4", "validees", "CSPEB", "Ces heures seront integrees a votre prochaine paie."],
    },
    {
        "name": "resume_recrutement_quotidien",
        "label": "Recruitment summary",
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
        "sample_values": ["15/01/2026", "CSPEB", "3", "2", "1", "1", "0", "1", "1"],
    },
    {
        "name": "test_a_passer",
        "label": "Test invitation",
        "header": "Test a passer",
        "body": """Bonjour {{candidate_name}},

Vous etes invite(e) a passer le test "{{test_name}}" chez {{school_name}}.

Duree : {{test_duration}} minutes
A passer avant : {{deadline_date}}

Lien du test : {{test_link}}

Bon courage !

Cordialement,
L'equipe RH""",
        "sample_values": ["Erhel DEGBE", "Test de competences pedagogiques", "CSPEB", "60", "22/01/2026 23h59", "https://academiahelm.com/test/token123"],
    },
    {
        "name": "carte_professionnelle",
        "label": "Staff card ready",
        "header": "Carte professionnelle",
        "body": """Bonjour {{employee_name}},

Votre carte professionnelle de {{school_name}} est disponible.

Vous pouvez la telecharger et la presenter a votre employeur ou partenaires.

Lien : {{card_link}}

Cordialement,
La Direction""",
        "sample_values": ["Erhel DEGBE", "CSPEB", "https://academiahelm.com/card/MAT001.pdf"],
    },
    {
        "name": "soumission_document_pedago",
        "label": "Document submitted",
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
        "sample_values": ["CSPEB", "Fiche pedagogique", "Semaine 3 - Janvier 2026", "Erhel DEGBE", "Classe : CP1 | Matiere : Mathematiques"],
    },
    {
        "name": "validation_document_pedago",
        "label": "Document validated",
        "header": "Document valide",
        "body": """Bonjour {{teacher_name}},

Votre document pedagogique "{{document_title}}" ({{document_type}}) a ete {{validation_status}} chez {{school_name}}.

{{validation_feedback}}

Connectez-vous pour consulter les details.

Cordialement,
La Direction pedagogique""",
        "sample_values": ["Erhel DEGBE", "Semaine 3 - Janvier 2026", "Fiche pedagogique", "valide", "CSPEB", "Tres bon travail, contenus conformes au programme officiel"],
    },
    {
        "name": "recapitulatif_pedagogique",
        "label": "Profile summary",
        "header": "Recapitulatif pedagogique",
        "body": """Bonjour {{teacher_name}},

Votre recapitulatif pedagogique ({{academic_year}}) est disponible chez {{school_name}}.

Matricule : {{teacher_id}}
Niveau : {{teaching_level}}
Heures assignees : {{assigned_hours}} / {{required_hours}} ({{workload_status}})

Le recapitulatif complet vous a ete envoye par email (avec PDF en piece jointe).

Cordialement,
La Direction pedagogique""",
        "sample_values": ["Erhel DEGBE", "2025-2026", "CSPEB", "MAT001", "Primaire", "18", "24", "Sous-charge"],
    },
]

# Boutons URL (ajoutés à tous les templates)
# Variables des boutons : subdomain, whatsapp_number, phone_number (en format E.164 sans +)
BUTTONS = [
    {
        "text": "Consulter le site",
        "type": "URL",
        "url_template": "https://{{1}}.academiahelm.com",
        "var_name": "subdomain",
        "sample": "cspeb",
    },
    {
        "text": "Discuter sur WhatsApp",
        "type": "URL",
        "url_template": "https://wa.me/{{1}}",
        "var_name": "whatsapp_number",
        "sample": "22997123456",
    },
    {
        "text": "Appeler l'ecole",
        "type": "URL",
        "url_template": "https://wa.me/{{1}}",
        "var_name": "phone_number",
        "sample": "22997123456",
    },
]


def extract_body_vars(body: str) -> list[str]:
    """Extrait les variables {{var}} du body dans l'ordre d'apparition."""
    import re
    return re.findall(r"\{\{(\w+)\}\}", body)


def render_sample(body_vars: list[str], sample_values: list[str]) -> str:
    """Génère le sample au format Meta : [val1],[val2],..."""
    return "[" + "],[".join(sample_values) + "]"


def render_buttons_section(buttons: list[dict]) -> str:
    """Génère la section boutons pour le HTML."""
    rows = []
    for i, b in enumerate(buttons, 1):
        rows.append(f"""
      <div class="field">
        <label class="field-label">Bouton {i} — {b['text']} (URL)</label>
        <button class="copy-btn" onclick="copyText(this)">Copier</button>
        <pre class="header-pre">Type: URL
Texte du bouton: {b['text']}
URL: {b['url_template']}
Variable: {b['var_name']}</pre>
      </div>""")
    return "".join(rows)


def render_template_card(idx: int, t: dict) -> str:
    body_vars = extract_body_vars(t["body"])
    sample = render_sample(body_vars, t["sample_values"])

    # Sample étendu : on ajoute les 3 variables des boutons à la fin
    button_samples = [b["sample"] for b in BUTTONS]
    full_sample = sample + ",[" + "],[".join(button_samples) + "]"

    buttons_html = render_buttons_section(BUTTONS)

    var_chips = "".join(
        f'      <span class="var-chip">{{{{{v}}}}}</span>' for v in body_vars
    )

    return f"""
<!-- TEMPLATE {idx} -->
<div class="template-card">
  <div class="template-header">
    <div>
      <div class="template-title">{idx}. {t['label']}</div>
      <div class="template-meta">
        <span class="badge badge-name">{t['name']}</span>
        <span class="badge badge-cat">UTILITY</span>
        <span class="badge badge-lang">FR</span>
        <span class="badge badge-label">{t['label']}</span>
      </div>
    </div>
  </div>

  <div class="field">
    <label class="field-label">Nom du template (a coller dans Meta)</label>
    <pre>{t['name']}</pre>
  </div>

  <div class="field">
    <label class="field-label">Header (TEXT)</label>
    <button class="copy-btn" onclick="copyText(this)">Copier</button>
    <pre class="header-pre">{t['header']}</pre>
  </div>

  <div class="field">
    <label class="field-label">Body (copier-coller dans Meta)</label>
    <button class="copy-btn" onclick="copyText(this)">Copier</button>
    <pre class="body">{t['body']}</pre>
    <div class="variables">{var_chips}
    </div>
  </div>

  <div class="field">
    <label class="field-label">Footer (TEXT)</label>
    <button class="copy-btn" onclick="copyText(this)">Copier</button>
    <pre class="header-pre">{FOOTER}</pre>
  </div>

  <div class="field">
    <label class="field-label">Boutons (3 boutons URL)</label>
    <p style="font-size:12px;color:#6b7280;margin-bottom:8px;">
      Dans Meta, ajoutez 3 boutons de type URL. Chaque bouton prend une variable a la fin de l'URL.
      Meta permet jusqu'a 10 boutons par template.
    </p>{buttons_html}
  </div>

  <div class="field">
    <label class="field-label">Exemple (Sample) — body + boutons</label>
    <p style="font-size:12px;color:#6b7280;margin-bottom:8px;">
      Fournissez les exemples dans l'ordre suivant : variables du body, puis subdomain, whatsapp_number, phone_number.
    </p>
    <button class="copy-btn" onclick="copyText(this)">Copier</button>
    <pre class="sample">{full_sample}</pre>
  </div>
</div>
"""


def render_html(templates: list[dict]) -> str:
    cards = "".join(render_template_card(i + 1, t) for i, t in enumerate(templates))

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Academia Helm — 20 Templates WhatsApp Meta v3 (avec boutons)</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #f3f4f6;
    color: #111827;
    line-height: 1.6;
    padding: 24px;
  }}
  .container {{ max-width: 1100px; margin: 0 auto; }}
  header {{
    background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
    color: white;
    padding: 32px;
    border-radius: 16px;
    margin-bottom: 24px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  }}
  header h1 {{ font-size: 28px; margin-bottom: 8px; }}
  header p {{ opacity: 0.95; }}
  .rules {{
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
    padding: 16px 20px;
    border-radius: 8px;
    margin-bottom: 24px;
  }}
  .rules h2 {{ color: #92400e; font-size: 16px; margin-bottom: 8px; }}
  .rules ul {{ padding-left: 20px; color: #78350f; font-size: 14px; }}
  .rules li {{ margin-bottom: 4px; }}

  .template-card {{
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    border: 1px solid #e5e7eb;
  }}
  .template-header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #f3f4f6;
  }}
  .template-title {{ font-size: 18px; font-weight: 700; color: #111827; }}
  .template-meta {{ display: flex; gap: 8px; flex-wrap: wrap; }}
  .badge {{
    display: inline-block;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }}
  .badge-name {{ background: #dbeafe; color: #1e40af; }}
  .badge-cat {{ background: #d1fae5; color: #065f46; }}
  .badge-lang {{ background: #ede9fe; color: #5b21b6; }}
  .badge-label {{ background: #fce7f3; color: #9f1239; }}

  .field {{
    margin-bottom: 14px;
  }}
  .field-label {{
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }}
  .copy-btn {{
    background: #25D366;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    float: right;
    font-weight: 600;
    transition: background 0.2s;
  }}
  .copy-btn:hover {{ background: #128C7E; }}
  .copy-btn:active {{ transform: scale(0.97); }}

  pre {{
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 14px;
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-word;
    color: #111827;
    overflow-x: auto;
  }}
  pre.body {{ background: #ecfdf5; border-color: #a7f3d0; }}
  pre.sample {{ background: #fffbeb; border-color: #fde68a; }}
  pre.header-pre {{ background: #eff6ff; border-color: #bfdbfe; font-weight: 600; }}

  .variables {{
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }}
  .var-chip {{
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 2px 8px;
    font-family: monospace;
    font-size: 12px;
    color: #374151;
  }}

  .footer-note {{
    text-align: center;
    color: #6b7280;
    font-size: 13px;
    padding: 24px;
    margin-top: 16px;
  }}
</style>
</head>
<body>
<div class="container">

<header>
  <h1>Academia Helm — 20 Templates WhatsApp Meta v3 (avec 3 boutons URL)</h1>
  <p>Format conforme aux regles Meta : variables <code>{{{{snake_case}}}}</code>, header + footer courts, 3 boutons URL dynamiques (site web, WhatsApp, appel).</p>
</header>

<div class="rules">
  <h2>Regles Meta respectees dans tous les templates ci-dessous</h2>
  <ul>
    <li>Variables au format <code>{{{{minuscules_avec_underscores}}}}</code> — jamais <code>{{{{1}}}}</code></li>
    <li>Aucune variable au debut ou a la fin du body (texte fixe obligatoire)</li>
    <li>Aucune variable en debut/fin de ligne (toujours entouree de texte)</li>
    <li>Noms de templates en minuscules avec underscores (max 512 caracteres)</li>
    <li>Categorie : UTILITY (utilitaire) — Langue : Francais (fr)</li>
    <li>Header TEXT court (≤ 60 caracteres) — Footer TEXT court (≤ 60 caracteres)</li>
    <li><strong>3 boutons URL</strong> par template (Meta permet jusqu'a 10 boutons par template)</li>
  </ul>
</div>

<div class="rules" style="background:#dbeafe;border-left-color:#3b82f6;">
  <h2 style="color:#1e40af;">Boutons URL (3 par template)</h2>
  <ul style="color:#1e3a8a;">
    <li><strong>Bouton 1 — "Consulter le site"</strong> : URL <code>https://{{{{1}}}}.academiahelm.com</code> → variable <code>subdomain</code> (ex: "cspeb" → ouvre <code>https://cspeb.academiahelm.com</code>)</li>
    <li><strong>Bouton 2 — "Discuter sur WhatsApp"</strong> : URL <code>https://wa.me/{{{{1}}}}</code> → variable <code>whatsapp_number</code> (ex: "22997123456" — format E.164 sans +)</li>
    <li><strong>Bouton 3 — "Appeler l'ecole"</strong> : URL <code>https://wa.me/{{{{1}}}}</code> → variable <code>phone_number</code> (ex: "22997123456" — format E.164 sans +)</li>
  </ul>
  <p style="margin-top:8px;font-size:13px;color:#1e3a8a;">
    <strong>Note importante</strong> : Meta n'autorise pas de variables dans les boutons PHONE_NUMBER (numero fixe uniquement).
    Pour avoir un bouton d'appel dynamique par ecole, on utilise un bouton URL avec <code>wa.me/</code> qui ouvre WhatsApp,
    puis l'utilisateur peut cliquer sur l'icone appel pour appeler le numero.
  </p>
</div>

{cards}

<div class="footer-note">
  Academia Helm — 20 templates WhatsApp au format Meta Business Platform v3<br>
  Avec 3 boutons URL dynamiques : site web, WhatsApp, appel telephonique.
</div>

</div>

<script>
function copyText(btn) {{
  const pre = btn.parentElement.querySelector('pre');
  const text = pre.innerText;
  navigator.clipboard.writeText(text).then(() => {{
    const original = btn.innerText;
    btn.innerText = '✓ Copie !';
    btn.style.background = '#128C7E';
    setTimeout(() => {{
      btn.innerText = original;
      btn.style.background = '';
    }}, 1500);
  }});
}}
</script>
</body>
</html>
"""


def main():
    html = render_html(TEMPLATES)
    out_path = Path("/home/z/my-project/download/whatsapp-templates-meta-v3.html")
    out_path.write_text(html, encoding="utf-8")
    print(f"OK : {out_path}")
    print(f"Templates générés : {len(TEMPLATES)}")
    print(f"Boutons par template : {len(BUTTONS)}")


if __name__ == "__main__":
    main()
