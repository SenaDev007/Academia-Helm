#!/usr/bin/env python3
"""
Update all pedagogy sub-pages to use the role-aware filtering helper.

For each sub-page, this script:
1. Replaces `import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';`
   with `import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';`
2. Adds `import { useAppSession } from '@/contexts/AppSessionContext';` if not present.
3. Adds `const { user } = useAppSession();` and `const userRole = user?.role || '';`
   inside the component function if not already present.
4. Replaces `PEDAGOGY_SUBMODULE_TABS.map(` with `getVisiblePedagogyTabs(userRole).map(`

Idempotent: re-running it on already-updated files is a no-op.
"""

import re
import sys
from pathlib import Path

PEDAGOGY_DIR = Path("/home/z/my-project/repo/Academia-Helm/apps/web-app/src/app/app/pedagogy")

# Sub-pages to update (not the dashboard page, which is already updated manually)
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

OLD_IMPORT = "import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';"
NEW_IMPORT = "import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';"

SESSION_IMPORT = "import { useAppSession } from '@/contexts/AppSessionContext';"

OLD_MAP_PREFIX = "PEDAGOGY_SUBMODULE_TABS.map("
NEW_MAP_PREFIX = "getVisiblePedagogyTabs(userRole).map("


def update_file(path: Path) -> bool:
    """Returns True if file was modified, False if no-op."""
    text = path.read_text(encoding="utf-8")
    original = text

    # 1. Replace import
    text = text.replace(OLD_IMPORT, NEW_IMPORT)

    # 2. Add useAppSession import (if not present and the file references userRole)
    if SESSION_IMPORT not in text and "useAppSession" not in text:
        # Insert after the new pedagogy-tabs import
        text = text.replace(
            NEW_IMPORT,
            NEW_IMPORT + "\n" + SESSION_IMPORT,
            1,
        )

    # 3. Add userRole hook inside component (only if userRole is referenced and not yet declared)
    if "getVisiblePedagogyTabs(userRole)" in text and "const userRole" not in text:
        # Find the component function body start — first `return (` after `export default function`
        # We insert before the first `return (` statement.
        # Pattern: `export default function XxxPage() {\n  return (`
        match = re.search(
            r"(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{)",
            text,
        )
        if match:
            insert_pos = match.end()
            # Insert newline + the two const declarations, indented to match
            # Detect indentation: usually 2 spaces
            insertion = (
                "\n  const { user } = useAppSession();\n  const userRole = user?.role || '';\n"
            )
            text = text[:insert_pos] + insertion + text[insert_pos:]

    # 4. Replace `.map(` calls
    text = text.replace(OLD_MAP_PREFIX, NEW_MAP_PREFIX)

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
        if update_file(path):
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
