#!/usr/bin/env python3
"""
Fix pedagogy sub-pages: ensure `const { user } = useAppSession();` and
`const userRole = user?.role || '';` are declared inside each component
function that references `userRole`.

Idempotent.
"""

import re
from pathlib import Path

PEDAGOGY_DIR = Path("/home/z/my-project/repo/Academia-Helm/apps/web-app/src/app/app/pedagogy")

SUB_PAGES = [
    "academic-structure/page.tsx",
    "subjects/page.tsx",
    "teachers/page.tsx",
    "timetables/page.tsx",
    "pedagogical-materials/page.tsx",
    "control/page.tsx",
    "orion/page.tsx",
    "global-library/page.tsx",
    "class-diaries/page.tsx",
    "production/page.tsx",
    "semainier/page.tsx",
]


def fix_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    # Only proceed if userRole is referenced but not declared
    if "getVisiblePedagogyTabs(userRole)" not in text:
        return False
    if "const userRole" in text:
        return False

    # Find the component function declaration. Pattern:
    #   export default function XxxPage() {
    #   ... (no const userRole yet)
    #     return (
    #
    # We insert the two const declarations right after the opening `{`.

    # Match `export default function XxxPage() {` (possibly with params)
    pattern = re.compile(
        r"(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{)",
        re.MULTILINE,
    )
    match = pattern.search(text)
    if not match:
        return False

    insert_pos = match.end()
    insertion = (
        "\n  const { user } = useAppSession();\n  const userRole = user?.role || '';\n"
    )
    text = text[:insert_pos] + insertion + text[insert_pos:]

    if text == original:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def main():
    changed = []
    skipped = []
    for rel in SUB_PAGES:
        path = PEDAGOGY_DIR / rel
        if not path.exists():
            print(f"MISSING: {rel}")
            continue
        if fix_file(path):
            changed.append(rel)
        else:
            skipped.append(rel)
    print("\n=== Summary ===")
    print(f"Changed ({len(changed)}):")
    for c in changed:
        print(f"  - {c}")
    print(f"Skipped (no-op) ({len(skipped)}):")
    for s in skipped:
        print(f"  - {s}")


if __name__ == "__main__":
    main()
