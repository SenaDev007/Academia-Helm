#!/usr/bin/env python3
"""
Academia Helm - Gupshup Dashboard Helper
=========================================
Affiche chaque template dans un format facile à copier-coller dans le dashboard Gupshup.
Fournit aussi un mode "clipboard" qui copie chaque champ un par un.

Usage:
  # Afficher tous les templates formatés:
  python gupshup-dashboard-helper.py

  # Afficher un seul template:
  python gupshup-dashboard-helper.py --only admission_recue

  # Mode clipboard (copie chaque champ dans le presse-papiers):
  python gupshup-dashboard-helper.py --clipboard --only admission_recue
"""

import argparse
import json
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
TEMPLATES_FILE = SCRIPT_DIR / "gupshup-templates.json"


def load_templates() -> dict:
    if not TEMPLATES_FILE.exists():
        print(f"ERROR: {TEMPLATES_FILE} not found")
        sys.exit(1)
    with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def display_template(t: dict, index: int, total: int) -> None:
    """Affiche un template dans un format facile à copier-coller."""
    print("\n" + "=" * 80)
    print(f"📋 TEMPLATE {index}/{total}: {t['elementName']}")
    print("=" * 80)

    print("\n┌─ Champs dashboard Gupshup ─────────────────────────────────")
    print(f"│ Template Name    : {t['elementName']}")
    print(f"│ Category         : {t['category']}")
    print(f"│ Template Type    : {t['templateType']}")
    print(f"│ Language         : fr (French)")
    print(f"│ Template Label   : {t['useCase']}")

    print("\n┌─ Header (TEXT) ────────────────────────────────────────────")
    print(f"│ Header Type      : TEXT")
    print(f"│ Header Text      : {{{{1}}}}")

    print("\n┌─ Body ─────────────────────────────────────────────────────")
    print("│ (copier le bloc ci-dessous)")
    print("└────────────────────────────────────────────────────────────")
    print()
    # Add visual markers around the body
    print("┌──── BODY START ────┐")
    for line in t["body"].split("\n"):
        print(f"│ {line}")
    print("└──── BODY END ──────┘")

    print("\n┌─ Footer ───────────────────────────────────────────────────")
    print(f"│ Footer Text      : {t.get('footer', '')}")

    if "buttons" in t:
        print("\n┌─ Buttons ──────────────────────────────────────────────────")
        for i, btn in enumerate(t["buttons"], 1):
            print(f"│ Button {i}: {btn['type']} - {btn['text']}")
            print(f"│   URL/text: {btn.get('url', btn.get('text', ''))}")

    print("\n┌─ Sample Header (pour validation Meta) ─────────────────────")
    print(f"│ {t['sampleHeader']}")

    print("\n┌─ Sample Body (pour validation Meta) ───────────────────────")
    print("│ Format: [value1],[value2],[value3],...")
    print(f"│ {t['sampleBody']}")

    print("\n" + "=" * 80)
    print(f"✅ Template {t['elementName']} prêt à copier")
    print("=" * 80)


def clipboard_mode(t: dict, index: int, total: int) -> None:
    """Mode clipboard - copie chaque champ dans le presse-papiers (Linux/macOS)."""
    try:
        import subprocess
    except ImportError:
        print("subprocess non disponible")
        return

    def copy(text: str, label: str) -> None:
        try:
            # Try pbcopy (macOS) first, then xclip (Linux)
            if sys.platform == "darwin":
                proc = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE)
                proc.communicate(text.encode())
            else:
                proc = subprocess.Popen(["xclip", "-selection", "clipboard"], stdin=subprocess.PIPE)
                proc.communicate(text.encode())
            print(f"✓ Copied: {label}")
        except FileNotFoundError:
            # Fall back to just printing
            print(f"\n--- {label} ---")
            print(text)
            print(f"--- (copier manuellement ci-dessus) ---\n")

    print(f"\n📋 Template {index}/{total}: {t['elementName']}")
    print("Appuyez sur Entrée après chaque copie pour passer au champ suivant.\n")

    fields = [
        ("Template Name", t["elementName"]),
        ("Template Label (use case)", t["useCase"]),
        ("Header Text", "{{1}}"),
        ("Body", t["body"]),
        ("Footer", t.get("footer", "")),
        ("Sample Header", t["sampleHeader"]),
        ("Sample Body", t["sampleBody"]),
    ]

    if "buttons" in t:
        for i, btn in enumerate(t["buttons"], 1):
            fields.append((f"Button {i} text", btn["text"]))
            if "url" in btn:
                fields.append((f"Button {i} URL", btn["url"]))

    for label, value in fields:
        copy(value, label)
        input(f"  → {label} copié. Appuyez sur Entrée pour le champ suivant...")


def main():
    parser = argparse.ArgumentParser(description="Gupshup Dashboard Helper")
    parser.add_argument("--only", type=str, help="Comma-separated template names to display")
    parser.add_argument("--clipboard", action="store_true", help="Mode copie dans presse-papiers")
    args = parser.parse_args()

    data = load_templates()
    templates = data["templates"]

    if args.only:
        wanted = set(n.strip() for n in args.only.split(","))
        templates = [t for t in templates if t["elementName"] in wanted]
        if not templates:
            print(f"No templates matched: {args.only}")
            sys.exit(1)

    total = len(templates)

    print("\n" + "🌟" * 40)
    print(f"  ACADEMIA HELM - GUPSHUP DASHBOARD HELPER")
    print(f"  {total} template(s) à créer sur https://portal.gupshup.io")
    print("🌟" * 40)
    print("\n📋 Procédure pour chaque template:")
    print("  1. Aller sur Dashboard > WhatsApp > Votre App > Templates > Create Template")
    print("  2. Template Name: copier le nom en bas")
    print("  3. Category: UTILITY")
    print("  4. Template Type: TEXT")
    print("  5. Language: French (fr)")
    print("  6. Template Label: copier le label")
    print("  7. Header: Type=TEXT, Text={{1}}")
    print("  8. Body: coller le bloc BODY")
    print("  9. Footer: coller le footer")
    print(" 10. Buttons (si applicable): ajouter URL button")
    print(" 11. Sample Header: coller la valeur d'exemple")
    print(" 12. Sample Body: coller [val1],[val2],...")
    print(" 13. Preview and Submit")

    for i, t in enumerate(templates, 1):
        if args.clipboard:
            clipboard_mode(t, i, total)
        else:
            display_template(t, i, total)
            if i < total:
                input("\n⏸ Appuyez sur Entrée pour le template suivant (Ctrl+C pour quitter)...")

    print("\n✅ Tous les templates ont été affichés.")
    print(f"📊 Total: {total}")
    print("\n⏰ N'oubliez pas: Meta prend 24-48h pour valider chaque template.")


if __name__ == "__main__":
    main()
