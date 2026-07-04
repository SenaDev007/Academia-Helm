#!/usr/bin/env python3
"""
Academia Helm - Generate HTML reference document for Gupshup templates (v2)
==========================================================================
Génère un fichier HTML imprimable avec tous les 20 templates formatés
pour faciliter la saisie manuelle dans le dashboard Gupshup.

VERSION 2.0 : Pas de header paramétré (Meta refuse les variables en
début/fin de template). Le nom de l'école est intégré dans le body.

Usage:
  python gupshup-templates-html.py
  → Génère /home/z/my-project/download/gupshup-templates-guide.html
"""

import json
import html
import re
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent.resolve()
TEMPLATES_FILE = SCRIPT_DIR / "gupshup-templates.json"
OUTPUT_FILE = Path("/home/z/my-project/download/gupshup-templates-guide.html")


def load_templates() -> dict:
    with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_sample_body(sample_body_str: str) -> list:
    """
    Parse '[val1],[val2],[val3]' → ['val1', 'val2', 'val3']
    """
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
    """
    Remplace {{1}}, {{2}}, ... dans le body par les valeurs d'exemple.
    """
    result = body
    for i, value in enumerate(sample_values, start=1):
        result = result.replace(f"{{{{{i}}}}}", value)
    return result


def render_template_card(t: dict, index: int) -> str:
    """Génère le HTML pour une carte template (v2 - sans header)."""
    name = html.escape(t["elementName"])
    use_case = html.escape(t["useCase"])
    body = t["body"]
    body_html = html.escape(body).replace("\n", "<br>")
    footer = html.escape(t.get("footer", ""))
    sample_body_raw = t["sampleBody"]

    # Generate the substituted body for the Sample Body field
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
          <div class="label">Template Type</div>
          <div class="value">TEXT</div>
        </div>
        <div class="field">
          <div class="label">Language</div>
          <div class="value">French (fr)</div>
        </div>
        <div class="field">
          <div class="label">Template Label</div>
          <div class="value copyable" onclick="copyText(this)">{use_case}</div>
        </div>
        <div class="field">
          <div class="label">Header</div>
          <div class="value" style="background:#fef3c7;color:#92400e;">AUCUN (ne pas configurer)</div>
        </div>
      </div>

      <div class="field">
        <div class="label">Body <span class="hint">(cliquer pour copier)</span></div>
        <div class="value body-text copyable" onclick="copyText(this)">{body_html}</div>
      </div>

      <div class="fields-grid">
        <div class="field">
          <div class="label">Footer</div>
          <div class="value copyable" onclick="copyText(this)">{footer}</div>
        </div>
      </div>

      <div class="samples">
        <h3>📋 Samples pour validation Meta — OBLIGATOIRE</h3>
        <div class="field">
          <div class="label">⚠️ Sample Body (format TEXTE COMPLET) <span class="hint">— Copier ce bloc entier</span></div>
          <div class="value sample sample-body-text copyable" onclick="copyText(this)">{sample_body_full_html}</div>
          <div class="sample-help">
            💡 Ce bloc représente le body avec les variables <code>{{{{1}}}}</code>, <code>{{{{2}}}}</code>... remplacées par des valeurs d'exemple réelles.
            Meta utilise cet exemple pour valider le template.
          </div>
        </div>
      </div>
    </div>
    """


def generate_html(templates_data: dict) -> str:
    templates = templates_data["templates"]

    cards_html = "\n".join(render_template_card(t, i + 1) for i, t in enumerate(templates))

    # Index list
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
  <title>Academia Helm - Templates WhatsApp Gupshup (v2)</title>
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

    .samples {{
      margin-top: 20px;
      padding: 15px;
      background: #f0fdf4;
      border-radius: 8px;
      border: 1px solid #bbf7d0;
    }}
    .samples h3 {{
      color: #065f46;
      font-size: 14px;
      margin-bottom: 12px;
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
      <h1>📋 Academia Helm - Templates WhatsApp Gupshup (v2)</h1>
      <div class="subtitle">Guide de saisie pour le dashboard Gupshup — {len(templates)} templates à créer</div>
      <div class="meta">
        Généré le {datetime.now().strftime("%d/%m/%Y à %H:%M")} ·
        Langue: Français · Catégorie: UTILITY ·
        Personnalisation: Nom école en body (position 1)
      </div>
    </header>

    <div class="warning-box">
      <h2>⚠️ VERSION 2.0 - Changement important</h2>
      <p>
        Cette version <strong>supprime le header paramétré</strong> qui causait le rejet Meta
        <code>Variables can't be at the start or end of the template</code>.
      </p>
      <p>
        Le nom de l'école est maintenant <strong>intégré dans le body</strong> en première ligne :
        <code>Etablissement : &#123;&#123;1&#125;&#125;</code>
      </p>
      <p>
        Ne configurez <strong>PAS de header</strong> dans le dashboard Gupshup pour ces templates.
      </p>
    </div>

    <div class="instructions">
      <h2>📝 Procédure pour chaque template</h2>
      <ol>
        <li> Aller sur <a href="https://portal.gupshup.io" target="_blank">https://portal.gupshup.io</a> → Dashboard → WhatsApp → Votre App → Templates → <strong>Create Template</strong></li>
        <li> Selectionner <strong>Category = UTILITY</strong> et <strong>Message Type = Custom Message</strong></li>
        <li> Renseigner les champs depuis la carte du template ci-dessous (cliquer sur chaque valeur pour copier)</li>
        <li> <strong>Header</strong>: NE PAS configurer de header (laisser vide)</li>
        <li> <strong>Body</strong>: Coller le bloc "Body" (les variables <code>{{{{1}}}}, {{{{2}}}}...</code> sont déjà placées)</li>
        <li> <strong>Footer</strong>: Coller le footer statique</li>
        <li> <strong>Sample Body</strong>: Coller le bloc <strong>"Sample Body (format TEXTE COMPLET)"</strong> — c'est le body avec les valeurs d'exemple substituées</li>
        <li> Cliquer <strong>Preview and Submit</strong></li>
        <li> Répéter pour chaque template — Meta valide en 24-48h</li>
      </ol>
    </div>

    <div class="index">
      <h2>📑 Index des templates</h2>
      <ul>
        {index_html}
      </ul>
    </div>

    {cards_html}

    <footer>
      Academia Helm — Plateforme éducative SaaS · {len(templates)} templates WhatsApp (v2)<br>
      Personnalisation par école tenante via <code>tenant_identity_profiles</code> (schoolName injecté en position 1)<br>
      Footer statique obligatoire: "Academia Helm - Plateforme educative" (60 car. max)
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
    print(f"📊 {len(data['templates'])} templates inclus (v2 - sans header)")
    print(f"\n🌐 Ouvrez ce fichier dans votre navigateur pour un guide interactif")
    print(f"   avec copier-coller en un clic pour chaque champ.")
    print(f"\n💡 IMPORTANT v2:")
    print(f"   - PAS de header (laissait Meta rejeter le template)")
    print(f"   - Le nom de l'école est dans le body en position 1")
    print(f"   - Le Sample Body contient le body complet substitué")


if __name__ == "__main__":
    main()
