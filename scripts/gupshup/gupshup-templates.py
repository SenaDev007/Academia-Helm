#!/usr/bin/env python3
"""
Academia Helm - Gupshup WhatsApp Templates Submission Script
=============================================================
Submits the 20 WhatsApp templates to Gupshup via API.

Usage:
  # Dry-run mode (no API call, just shows what would be sent):
  python gupshup-templates.py --dry-run

  # Submit only ONE template (test mode):
  python gupshup-templates.py --only admission_recue

  # Submit ALL templates:
  python gupshup-templates.py

  # Submit a subset:
  python gupshup-templates.py --only admission_recue,inscription_confirmee

  # Check status of all submitted templates:
  python gupshup-templates.py --status

  # Delete a template:
  python gupshup-templates.py --delete admission_recue

Prerequisites:
  - GUPSHUP_API_KEY environment variable set
  - Python 3.8+
  - requests library (pip install requests)
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' library not installed. Run: pip install requests")
    sys.exit(1)


# ============================================================
# Configuration
# ============================================================
SCRIPT_DIR = Path(__file__).parent.resolve()
TEMPLATES_FILE = SCRIPT_DIR / "gupshup-templates.json"
LOG_FILE = SCRIPT_DIR / "gupshup-templates.log"

GUPSHUP_API_BASE = "https://api.gupshup.io/sm/api/v2"
GUPSHUP_CREATE_URL = f"{GUPSHUP_API_BASE}/template"
GUPSHUP_LIST_URL = f"{GUPSHUP_API_BASE}/templates"
GUPSHUP_DELETE_URL = f"{GUPSHUP_API_BASE}/template"  # + /{elementName}

# Rate limiting: pause between submissions (seconds)
INTER_TEMPLATE_DELAY = 2.0
# Retry on failure
MAX_RETRIES = 3
RETRY_DELAY = 5.0


# ============================================================
# Logging
# ============================================================
def log(msg: str, level: str = "INFO") -> None:
    """Print to console + append to log file."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] [{level}] {msg}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def log_json(data: dict, label: str = "") -> None:
    """Log a JSON payload."""
    if label:
        log(f"--- {label} ---")
    log(json.dumps(data, indent=2, ensure_ascii=False))


# ============================================================
# Template loading
# ============================================================
def load_templates() -> dict:
    """Load the templates JSON file."""
    if not TEMPLATES_FILE.exists():
        log(f"ERROR: Templates file not found: {TEMPLATES_FILE}", "ERROR")
        sys.exit(1)
    with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_api_key() -> str:
    """Get the Gupshup API key from environment."""
    key = os.environ.get("GUPSHUP_API_KEY")
    if not key:
        log("ERROR: GUPSHUP_API_KEY environment variable not set.", "ERROR")
        log("Set it with: export GUPSHUP_API_KEY='your-key-here'", "ERROR")
        sys.exit(1)
    return key


# ============================================================
# Gupshup API calls
# ============================================================
def build_payload(template: dict) -> dict:
    """
    Build the form-encoded payload for the Gupshup API.
    Gupshup expects application/x-www-form-urlencoded.
    """
    header = template.get("header")
    buttons = template.get("buttons", [])

    payload = {
        "elementName": template["elementName"],
        "languageCode": "fr",
        "category": template["category"],
        "templateType": template["templateType"],
        "body": template["body"],
        "footer": template.get("footer", ""),
        "sampleBody": template["sampleBody"],
    }

    if header:
        payload["header"] = json.dumps(header, ensure_ascii=False)

    if "sampleHeader" in template:
        payload["sampleHeader"] = template["sampleHeader"]

    # Buttons (URL buttons)
    if buttons:
        # Gupshup expects buttons as a JSON array
        payload["buttons"] = json.dumps(buttons, ensure_ascii=False)

    return payload


def submit_template(api_key: str, template: dict, dry_run: bool = False) -> dict:
    """
    Submit one template to Gupshup API.
    Returns dict with: success (bool), status_code, response (dict), error (str|None)
    """
    payload = build_payload(template)

    if dry_run:
        log(f"[DRY-RUN] Would submit template '{template['elementName']}'")
        log(f"  URL: {GUPSHUP_CREATE_URL}")
        log(f"  Payload:")
        for k, v in payload.items():
            preview = v if len(v) < 200 else v[:200] + "..."
            log(f"    {k} = {preview}")
        return {
            "success": True,
            "status_code": 0,
            "response": {"dry_run": True},
            "error": None,
        }

    headers = {
        "apikey": api_key,
        "Content-Type": "application/x-www-form-urlencoded",
    }

    # URL-encode the payload
    encoded_payload = urllib.parse.urlencode(payload, quote_via=urllib.parse.quote)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            log(f"  Attempt {attempt}/{MAX_RETRIES} - POST {GUPSHUP_CREATE_URL}")
            response = requests.post(
                GUPSHUP_CREATE_URL,
                headers=headers,
                data=encoded_payload,
                timeout=30,
            )

            if response.status_code in (200, 201, 202):
                try:
                    resp_json = response.json()
                except ValueError:
                    resp_json = {"raw": response.text}
                log(f"  SUCCESS - HTTP {response.status_code}")
                return {
                    "success": True,
                    "status_code": response.status_code,
                    "response": resp_json,
                    "error": None,
                }
            else:
                log(
                    f"  HTTP {response.status_code} - {response.text[:500]}",
                    "WARN",
                )
                if response.status_code == 429:
                    # Rate limited - wait longer
                    log("  Rate limited (429). Waiting 10s before retry...", "WARN")
                    time.sleep(10)
                else:
                    time.sleep(RETRY_DELAY)

        except requests.exceptions.RequestException as e:
            log(f"  Request exception: {e}", "ERROR")
            time.sleep(RETRY_DELAY)

    return {
        "success": False,
        "status_code": response.status_code if "response" in locals() else 0,
        "response": {},
        "error": f"Failed after {MAX_RETRIES} attempts",
    }


def list_templates(api_key: str) -> dict:
    """List all templates and their approval status."""
    headers = {"apikey": api_key}
    try:
        response = requests.get(GUPSHUP_LIST_URL, headers=headers, timeout=30)
        if response.status_code == 200:
            return response.json()
        else:
            log(f"ERROR listing templates: HTTP {response.status_code} - {response.text[:500]}", "ERROR")
            return {}
    except requests.exceptions.RequestException as e:
        log(f"Request exception while listing: {e}", "ERROR")
        return {}


def delete_template(api_key: str, element_name: str) -> bool:
    """Delete a template by elementName."""
    headers = {"apikey": api_key}
    url = f"{GUPSHUP_DELETE_URL}/{element_name}"
    try:
        response = requests.delete(url, headers=headers, timeout=30)
        if response.status_code in (200, 202, 204):
            log(f"Template '{element_name}' deleted successfully.")
            return True
        else:
            log(f"ERROR deleting template: HTTP {response.status_code} - {response.text[:500]}", "ERROR")
            return False
    except requests.exceptions.RequestException as e:
        log(f"Request exception while deleting: {e}", "ERROR")
        return False


# ============================================================
# Main orchestration
# ============================================================
def cmd_submit(args, api_key: str, templates_data: dict) -> None:
    """Submit templates (all or filtered)."""
    all_templates = templates_data["templates"]
    total = len(all_templates)

    # Filter templates if --only is specified
    if args.only:
        wanted = set(t.strip() for t in args.only.split(","))
        templates_to_submit = [t for t in all_templates if t["elementName"] in wanted]
        if not templates_to_submit:
            log(f"ERROR: No templates matched --only '{args.only}'", "ERROR")
            sys.exit(1)
        log(f"Filtered to {len(templates_to_submit)} template(s): {[t['elementName'] for t in templates_to_submit]}")
    else:
        templates_to_submit = all_templates

    log(f"\n{'='*60}")
    log(f"ACADEMIA HELM - GUPSHUP TEMPLATES SUBMISSION")
    log(f"{'='*60}")
    log(f"Mode: {'DRY-RUN' if args.dry_run else 'LIVE SUBMISSION'}")
    log(f"Templates to submit: {len(templates_to_submit)} / {total}")
    log(f"Language: fr | Category: UTILITY")
    log(f"Delay between submissions: {INTER_TEMPLATE_DELAY}s")
    log(f"{'='*60}\n")

    results = []
    success_count = 0
    failure_count = 0

    for i, template in enumerate(templates_to_submit, start=1):
        element_name = template["elementName"]
        log(f"\n[{i}/{len(templates_to_submit)}] Submitting '{element_name}' ({template['useCase']})")

        result = submit_template(api_key, template, dry_run=args.dry_run)
        results.append({
            "elementName": element_name,
            "useCase": template["useCase"],
            **result,
        })

        if result["success"]:
            success_count += 1
        else:
            failure_count += 1

        # Pause between templates (rate limit) - except after the last one
        if i < len(templates_to_submit) and not args.dry_run:
            log(f"  Pausing {INTER_TEMPLATE_DELAY}s (rate limit)...")
            time.sleep(INTER_TEMPLATE_DELAY)

    # Final report
    log(f"\n{'='*60}")
    log(f"SUBMISSION REPORT")
    log(f"{'='*60}")
    log(f"Total: {len(templates_to_submit)}")
    log(f"Success: {success_count}")
    log(f"Failed:  {failure_count}")
    log(f"{'='*60}\n")

    # Save detailed report
    report_file = SCRIPT_DIR / f"gupshup-report-{time.strftime('%Y%m%d-%H%M%S')}.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "mode": "dry-run" if args.dry_run else "live",
            "total": len(templates_to_submit),
            "success": success_count,
            "failed": failure_count,
            "results": results,
        }, f, indent=2, ensure_ascii=False)
    log(f"Detailed report saved to: {report_file}")

    # List failed templates for retry
    if failure_count > 0:
        failed_names = [r["elementName"] for r in results if not r["success"]]
        log(f"\nFailed templates (retry with --only):")
        log(f"  python gupshup-templates.py --only {','.join(failed_names)}")
        sys.exit(1)


def cmd_status(api_key: str) -> None:
    """Check approval status of all templates."""
    log("\nFetching template status from Gupshup...")
    data = list_templates(api_key)
    if not data:
        log("No data returned.", "ERROR")
        return

    templates = data.get("templates", [])
    if not templates:
        log("No templates found in your Gupshup account yet.")
        return

    log(f"\n{'='*80}")
    log(f"{'elementName':<40} {'status':<25} {'category':<15} {'language'}")
    log(f"{'-'*80}")
    for t in templates:
        name = t.get("elementName", "?")
        status = t.get("status", "?")
        category = t.get("category", "?")
        language = t.get("languageCode", "?")
        log(f"{name:<40} {status:<25} {category:<15} {language}")
    log(f"{'='*80}")
    log(f"Total: {len(templates)} template(s)\n")


def cmd_delete(api_key: str, element_name: str) -> None:
    """Delete a single template."""
    log(f"\nDeleting template '{element_name}'...")
    if delete_template(api_key, element_name):
        log("Done.")
    else:
        sys.exit(1)


# ============================================================
# CLI
# ============================================================
def main():
    parser = argparse.ArgumentParser(
        description="Academia Helm - Gupshup WhatsApp Templates Submission",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run (preview only):
  python gupshup-templates.py --dry-run

  # Submit only the first template (test):
  python gupshup-templates.py --only admission_recue

  # Submit all 20 templates:
  python gupshup-templates.py

  # Check approval status:
  python gupshup-templates.py --status

  # Delete a template:
  python gupshup-templates.py --delete admission_recue
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be submitted without calling the API",
    )
    parser.add_argument(
        "--only",
        type=str,
        help="Comma-separated list of template elementNames to submit (default: all)",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="List all templates and their approval status",
    )
    parser.add_argument(
        "--delete",
        type=str,
        help="Delete a template by elementName",
    )

    args = parser.parse_args()

    # Commands that don't need templates file
    if args.status:
        api_key = get_api_key()
        cmd_status(api_key)
        return

    if args.delete:
        api_key = get_api_key()
        cmd_delete(api_key, args.delete)
        return

    # Submit command (default)
    api_key = get_api_key() if not args.dry_run else "dry-run-no-key-needed"
    templates_data = load_templates()
    cmd_submit(args, api_key, templates_data)


if __name__ == "__main__":
    main()
