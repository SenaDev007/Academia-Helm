#!/usr/bin/env python3
"""
Academia Helm - Guide ULTRA-SIMPLIFIÉ pour Gupshup
====================================================
Génère un guide HTML avec:
1. Un template TEST minimaliste (1 seule variable) pour valider le flux
2. Instructions pas-à-pas avec champs exacts
3. Checklist de validation
4. Les 20 templates complets en section de référence

Stratégie : faire valider d'abord le template minimaliste, puis créer les autres
une fois que le flux de validation Meta est compris.
"""

import json
import html
import re
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent.resolve()
TEMPLATES_FILE = SCRIPT_DIR / "gupshup-templates.json"
OUTPUT_FILE = Path("/home/z/my-project/download/gupshup-guide-simple.html")


def load_templates() -> dict:
    with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_sample_body(sample_body_str: str) -> list:
    s = sample_body_str.strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1]
    parts = re.split(r"\],\[", s)
    values = []
    for p in parts:
        p = p.strip()
        if p.startswith("[") and p.endswith("]"):
            p = p[1:-1]
        values.append(p)
    return values


def substitute_body_variables(body: str, sample_values: list) -> str:
    result = body
    for i, value in enumerate(sample_values, start=1):
        result = result.replace(f"{{{{{i}}}}}", value)
    return result


def render_test_template() -> str:
    """Le template TEST minimaliste - une seule variable, garantie d'approbation."""
    return """
    <div class="test-template-card">
      <div class="test-banner">
        <h2>🧪 ÉTAPE 1 — Template TEST (à créer en PREMIER)</h2>
        <p>Validez d'abord ce template simple. Une fois approuvé, vous saurez que le flux fonctionne.</p>
      </div>

      <div class="field">
        <div class="label">1. Template Name</div>
        <div class="value copyable" onclick="copyText(this)">test_bienvenue</div>
      </div>

      <div class="fields-grid">
        <div class="field">
          <div class="label">2. Category</div>
          <div class="value">UTILITY</div>
        </div>
        <div class="field">
          <div class="label">3. Template Type / Message Type</div>
          <div class="value">TEXT (ou "Custom Message")</div>
        </div>
        <div class="field">
          <div class="label">4. Language</div>
          <div class="value">French (fr)</div>
        </div>
        <div class="field">
          <div class="label">5. Template Label (use case)</div>
          <div class="value copyable" onclick="copyText(this)">Welcome message</div>
        </div>
      </div>

      <div class="field">
        <div class="label">6. Header</div>
        <div class="value" style="background:#fef3c7;color:#92400e;">
          ❌ NE PAS CONFIGURER DE HEADER (laisser vide / cliquer "Skip" si demandé)
        </div>
      </div>

      <div class="field">
        <div class="label">7. Body <span class="hint">(copier ce texte exactement)</span></div>
        <div class="value body-text copyable" onclick="copyText(this)">Bonjour {{1}},

Bienvenue sur la plateforme Academia Helm. Votre inscription a bien ete enregistree.

Cordialement,
L'equipe Academia Helm</div>
      </div>

      <div class="field">
        <div class="label">8. Footer</div>
        <div class="value copyable" onclick="copyText(this)">Academia Helm - Plateforme educative</div>
      </div>

      <div class="field">
        <div class="label">9. Buttons</div>
        <div class="value" style="background:#fef3c7;color:#92400e;">
          ❌ NE PAS AJOUTER DE BOUTONS (cliquer "Skip" / "None")
        </div>
      </div>

      <div class="field sample-body-field">
        <div class="label">⚠️ 10. Sample Body / Add Example <span class="hint">— OBLIGATOIRE</span></div>
        <div class="value sample sample-body-text copyable" onclick="copyText(this)">Bonjour Marie ADANDE,

Bienvenue sur la plateforme Academia Helm. Votre inscription a bien ete enregistree.

Cordialement,
L'equipe Academia Helm</div>
        <div class="sample-help">
          💡 Ce champ est OBLIGATOIRE. Meta le requiert pour valider le template.
          Il doit contenir le body complet avec la variable {{1}} remplacée par une valeur d'exemple.
        </div>
      </div>

      <div class="validation-checklist">
        <h3>✅ Checklist avant "Preview and Submit"</h3>
        <ul>
          <li>☐ Template Name = <code>test_bienvenue</code></li>
          <li>☐ Category = <strong>UTILITY</strong></li>
          <li>☐ Language = <strong>French</strong></li>
          <li>☐ Template Label = <code>Welcome message</code></li>
          <li>☐ Header = <strong>VIDE</strong> (ne rien mettre)</li>
          <li>☐ Body = copier le bloc de l'étape 7</li>
          <li>☐ Footer = <code>Academia Helm - Plateforme educative</code></li>
          <li>☐ Buttons = <strong>AUCUN</strong></li>
          <li>☐ Sample Body = copier le bloc de l'étape 10</li>
          <li>☐ Cliquer "Preview and Submit"</li>
        </ul>
      </div>
    </div>
    """


def render_template_card(t: dict, index: int) -> str:
    """Carte pour les 20 templates (référence)."""
    name = html.escape(t["elementName"])
    use_case = html.escape(t["useCase"])
    body = t["body"]
    body_html = html.escape(body).replace("\n", "<br>")
    footer = html.escape(t.get("footer", ""))
    sample_body_raw = t["sampleBody"]
    sample_values = parse_sample_body(sample_body_raw)
    sample_body_full = substitute_body_variables(body, sample_values)
    sample_body_full_html = html.escape(sample_body_full).replace("\n", "<br>")

    return f"""
    <div class="template-card" id="template-{index}">
      <div class="template-header">
        <span class="template-number">#{index}</span>
        <h2 class="template-name">{name}</h2>
        <span class="badge">{use_case}</span>
      </div>

      <div class="fields-grid">
        <div class="field">
          <div class="label">Template Name</div>
          <div class="value copyable" onclick="copyText(this)">{name}</div>
        </div>
        <div class="field">
          <div class="label">Category</div>
          <div class="value">UTILITY</div>
        </div>
        <div class="field">
          <div class="label">Template Label</div>
          <div class="value copyable" onclick="copyText(this)">{use_case}</div>
        </div>
        <div class="field">
          <div class="label">Language</div>
          <div class="value">French (fr)</div>
        </div>
      </div>

      <div class="field">
        <div class="label">Header</div>
        <div class="value" style="background:#fef3c7;color:#92400e;">AUCUN (ne pas configurer)</div>
      </div>

      <div class="field">
        <div class="label">Body <span class="hint">(cliquer pour copier)</span></div>
        <div class="value body-text copyable" onclick="copyText(this)">{body_html}</div>
      </div>

      <div class="field">
        <div class="label">Footer</div>
        <div class="value copyable" onclick="copyText(this)">{footer}</div>
      </div>

      <div class="field">
        <div class="label">Buttons</div>
        <div class="value" style="background:#fef3c7;color:#92400e;">AUCUN</div>
      </div>

      <div class="field sample-body-field">
        <div class="label">⚠️ Sample Body (OBLIGATOIRE) <span class="hint">— Copier ce bloc entier</span></div>
        <div class="value sample sample-body-text copyable" onclick="copyText(this)">{sample_body_full_html}</div>
        <div class="sample-help">
          💡 Doit être le body COMPLET avec toutes les variables <code>{{{{1}}}}, {{{{2}}}}...</code> substituées par les valeurs d'exemple.
        </div>
      </div>
    </div>
    """


def generate_html(templates_data: dict) -> str:
    templates = templates_data["templates"]
    test_card = render_test_template()
    cards_html = "\n".join(render_template_card(t, i + 1) for i, t in enumerate(templates))

    index_html = "\n".join(
        f'<li><a href="#template-{i+1}">#{i+1} {html.escape(t["elementName"])}</a> '
        f'<span class="index-use-case">({html.escape(t["useCase"])})</span></li>'
        for i, t in enumerate(templates)
    )

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Academia Helm - Guide Simplifié Gupshup</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f3f4f6;
      padding: 20px;
    }}
    .container {{ max-width: 1100px; margin: 0 auto; }}
    header {{
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }}
    header h1 {{ font-size: 28px; margin-bottom: 10px; }}
    header .subtitle {{ opacity: 0.9; font-size: 14px; }}
    header .meta {{ margin-top: 15px; font-size: 13px; opacity: 0.85; }}

    .warning-box {{
      background: #fef2f2;
      border-left: 4px solid #dc2626;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }}
    .warning-box h2 {{ color: #991b1b; margin-bottom: 12px; font-size: 18px; }}
    .warning-box p {{ font-size: 14px; margin-bottom: 10px; }}
    .warning-box code {{
      background: #fef3c7;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }}

    .test-template-card {{
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
      border: 2px solid #6366f1;
    }}
    .test-banner {{
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 25px;
    }}
    .test-banner h2 {{ font-size: 20px; margin-bottom: 8px; }}
    .test-banner p {{ font-size: 14px; opacity: 0.95; }}

    .validation-checklist {{
      background: #f0fdf4;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #bbf7d0;
      margin-top: 25px;
    }}
    .validation-checklist h3 {{
      color: #065f46;
      font-size: 16px;
      margin-bottom: 12px;
    }}
    .validation-checklist ul {{ list-style: none; padding-left: 5px; }}
    .validation-checklist li {{
      padding: 6px 0;
      font-size: 14px;
      color: #064e3b;
    }}
    .validation-checklist code {{
      background: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 12px;
    }}

    .instructions {{
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }}
    .instructions h2 {{ color: #92400e; margin-bottom: 12px; font-size: 18px; }}
    .instructions ol {{ margin-left: 20px; }}
    .instructions li {{ margin-bottom: 8px; font-size: 14px; }}

    .index {{
      background: white;
      padding: 20px 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }}
    .index h2 {{ font-size: 18px; margin-bottom: 12px; color: #374151; }}
    .index ul {{ list-style: none; columns: 2; column-gap: 30px; }}
    .index li {{ padding: 6px 0; font-size: 14px; }}
    .index a {{ color: #6366f1; text-decoration: none; font-weight: 500; }}
    .index a:hover {{ text-decoration: underline; }}
    .index-use-case {{ color: #6b7280; font-size: 12px; }}

    .template-card {{
      background: white;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 25px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e5e7eb;
    }}
    .template-header {{
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
    }}
    .template-number {{
      background: #6366f1;
      color: white;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: bold;
    }}
    .template-name {{
      font-size: 22px;
      color: #111827;
      flex: 1;
    }}
    .badge {{
      background: #ede9fe;
      color: #6d28d9;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }}

    .fields-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-bottom: 15px;
    }}
    .field {{ margin-bottom: 12px; }}
    .field .label {{
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }}
    .field .hint {{
      font-weight: normal;
      color: #9ca3af;
      text-transform: none;
      letter-spacing: 0;
    }}
    .field .value {{
      padding: 8px 12px;
      background: #f9fafb;
      border-radius: 6px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      border: 1px solid #e5e7eb;
      word-break: break-word;
    }}
    .field .value.body-text {{
      white-space: pre-wrap;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      min-height: 80px;
    }}
    .field .value.sample {{
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #065f46;
    }}
    .field .value.sample-body-text {{
      background: #fff7ed;
      border-color: #fb923c;
      color: #9a3412;
      font-size: 13px;
      line-height: 1.6;
      min-height: 100px;
      white-space: pre-wrap;
    }}
    .field.sample-body-field {{
      background: #fffbeb;
      padding: 12px;
      border-radius: 8px;
      border: 2px solid #f59e0b;
    }}
    .sample-help {{
      margin-top: 8px;
      font-size: 12px;
      color: #92400e;
      padding: 8px;
      background: #fef3c7;
      border-radius: 4px;
    }}
    .sample-help code {{
      background: white;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 11px;
    }}
    .copyable {{
      cursor: pointer;
      transition: all 0.15s;
      position: relative;
    }}
    .copyable:hover {{
      background: #ede9fe !important;
      border-color: #c4b5fd !important;
    }}
    .copyable::after {{
      content: '📋 Copier';
      position: absolute;
      top: 4px;
      right: 8px;
      font-size: 10px;
      color: #6366f1;
      font-family: sans-serif;
      opacity: 0;
      transition: opacity 0.15s;
    }}
    .copyable:hover::after {{ opacity: 1; }}
    .copyable.copied::after {{
      content: '✓ Copié!';
      opacity: 1;
      color: #059669;
    }}

    footer {{
      text-align: center;
      padding: 30px;
      color: #6b7280;
      font-size: 13px;
    }}

    .toast {{
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #6366f1;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
    }}
    .toast.show {{ opacity: 1; }}

    @media print {{
      body {{ background: white; padding: 0; }}
      .template-card {{ break-inside: avoid; box-shadow: none; border: 1px solid #ddd; }}
      .copyable::after {{ display: none; }}
      header {{ box-shadow: none; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎯 Academia Helm — Guide Simplifié Gupshup</h1>
      <div class="subtitle">Approche en 2 étapes : template TEST minimaliste → 20 templates complets</div>
      <div class="meta">
        Généré le {datetime.now().strftime("%d/%m/%Y à %H:%M")} ·
        Stratégie : valider 1 template simple, puis créer les 20 autres
      </div>
    </header>

    <div class="warning-box">
      <h2>⚠️ Erreur Meta "component of type BODY is missing expected field(s) (example)"</h2>
      <p>
        Cette erreur signifie que Meta n'a pas reçu le <strong>sample body</strong> (exemple)
        pour le body de votre template. Le sample body est <strong>OBLIGATOIRE</strong> dès
        qu'une variable <code>{{{{1}}}}</code> est présente dans le body.
      </p>
      <p>
        👉 <strong>Solution :</strong> Suivez l'ÉTAPE 1 ci-dessous avec un template TEST
        ultra-simple (1 seule variable). Une fois ce template approuvé par Meta, vous saurez
        que le flux fonctionne et pourrez créer les 20 autres en toute confiance.
      </p>
    </div>

    <div class="instructions">
      <h2>📝 Procédure pas-à-pas</h2>
      <ol>
        <li> Aller sur <a href="https://portal.gupshup.io" target="_blank">https://portal.gupshup.io</a> → Dashboard → WhatsApp → Votre App → Templates → <strong>Create Template</strong></li>
        <li> Sélectionner <strong>Category = UTILITY</strong> et <strong>Message Type = Custom Message</strong> (ou TEXT)</li>
        <li> Suivre les champs un par un depuis la carte "ÉTAPE 1" ci-dessous</li>
        <li> <strong>Header</strong> : laisser VIDE (ne pas configurer)</li>
        <li> <strong>Buttons</strong> : laisser VIDE (ne pas ajouter)</li>
        <li> <strong>Sample Body</strong> : OBLIGATOIRE — copier le bloc complet fourni</li>
        <li> Cliquer <strong>Preview and Submit</strong></li>
        <li> Patienter 24-48h pour la validation Meta</li>
        <li> <strong>Une fois "test_bienvenue" approuvé</strong>, créer les 20 templates en suivant la section "ÉTAPE 2"</li>
      </ol>
    </div>

    {test_card}

    <h2 style="margin: 40px 0 20px; font-size: 24px; color: #6366f1;">📚 ÉTAPE 2 — Les 20 templates complets</h2>
    <p style="margin-bottom: 20px; color: #6b7280;">À créer APRÈS validation du template TEST. Même procédure, mais avec les bodies ci-dessous.</p>

    <div class="index">
      <h2>📑 Index des 20 templates</h2>
      <ul>
        {index_html}
      </ul>
    </div>

    {cards_html}

    <footer>
      Academia Helm — Plateforme éducative SaaS · {len(templates)} templates WhatsApp<br>
      Footer statique obligatoire: "Academia Helm - Plateforme educative" (60 car. max)<br>
      NE PAS configurer de header ni de buttons
    </footer>
  </div>

  <div id="toast" class="toast">✓ Copié dans le presse-papiers</div>

  <script>
    function copyText(element) {{
      const text = element.innerText.replace('📋 Copier', '').replace('✓ Copié!', '').trim();
      navigator.clipboard.writeText(text).then(() => {{
        element.classList.add('copied');
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1500);
        setTimeout(() => element.classList.remove('copied'), 1500);
      }}).catch(err => {{
        console.error('Copy failed:', err);
        const range = document.createRange();
        range.selectNode(element);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
      }});
    }}
  </script>
</body>
</html>
"""


def main():
    data = load_templates()
    html_content = generate_html(data)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"✅ Fichier HTML généré: {OUTPUT_FILE}")
    print(f"📊 Contenu:")
    print(f"   - 1 template TEST minimaliste (test_bienvenue)")
    print(f"   - {len(data['templates'])} templates complets en référence")
    print(f"\n🎯 Stratégie:")
    print(f"   1. Créer d'abord le template TEST (test_bienvenue)")
    print(f"   2. Attendre validation Meta (24-48h)")
    print(f"   3. Si approuvé → créer les 20 autres templates")


if __name__ == "__main__":
    main()
