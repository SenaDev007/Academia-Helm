#!/usr/bin/env python3
"""
Refactor the 4 aggregation pages (finance, exams, students, pedagogy) to wrap
their content in <AggregationPageShell> with the parent module's tab bar.

The pedagogy aggregation page is already done manually (it has additional
complexity with role-based tab filtering). This script handles the other 3.

For each page:
1. Add the AggregationPageShell import.
2. Add the parent module's tabs import (FINANCE_SUBMODULE_TABS / EXAMS_SUB_MODULES / etc.)
3. Extract the inner JSX content (loading + main render) into a `const content = (...)`.
4. Wrap the return value with <AggregationPageShell>.

Pattern: the page returns either:
  - `if (loading) { return <Loading/> }` then `return <MainJSX/>`
  - or just `return <MainJSX/>`

After refactor:
  - Build `content` variable with all the JSX (loading ? Loading : MainJSX)
  - Return `<AggregationPageShell ...>{content}</AggregationPageShell>`
"""

import re
from pathlib import Path

BASE = Path("/home/z/my-project/repo/Academia-Helm/apps/web-app/src/app/app")

# (file_path, tabs_import_line, tabs_const_name, module_title, module_description, module_icon, active_tab_id)
TARGETS = [
    (
        BASE / "finance" / "aggregation" / "page.tsx",
        "import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';",
        "FINANCE_SUBMODULE_TABS",
        "Finances & Économat",
        "Pilotage financier : frais, comptes élèves, encaissements, recouvrement, dépenses, clôture, rapports et paramétrage.",
        "finance",
        "aggregation",
    ),
    (
        BASE / "exams" / "aggregation" / "page.tsx",
        "import { EXAMS_SUB_MODULES } from '../../sub-modules';",
        "EXAMS_SUB_MODULES",
        "Examens & Notes",
        "Gestion des examens, évaluations, bulletins, moyennes et conseils de classe.",
        "fileText",
        "aggregation",
    ),
    (
        BASE / "students" / "aggregation" / "page.tsx",
        # Students module uses inline sub-modules; we'll define them inline below
        None,  # special handling
        "STUDENTS_SUB_MODULES_INLINE",
        "Module Élèves",
        "Gestion des élèves : admissions, inscriptions, dossiers, familles, affectations et historique scolaire.",
        "graduationCap",
        "aggregation",
    ),
]


def refactor_page(path, tabs_import, tabs_const_name, module_title, module_description, module_icon, active_tab_id):
    """Refactor a single aggregation page."""
    text = path.read_text(encoding="utf-8")

    # Detect what's already in the file
    if "AggregationPageShell" in text:
        print(f"  SKIP (already refactored): {path}")
        return False

    # The pattern: find the `if (loading) { return (...) }` block and the final `return (...)`
    # We need to:
    # 1. Replace the `if (loading) { return <X/> }` with a const declaration
    # 2. Replace the final `return (...)` with a const declaration
    # 3. Add `<AggregationPageShell>{content}</AggregationPageShell>` as the new return

    # Strategy: simpler — find the `if (loading) {` line. Everything before is the
    # component logic (hooks, fetchAggregation, totals computation). Everything
    # from `if (loading)` onwards is JSX render. We split into:
    #   - preamble (kept as-is)
    #   - JSX (loading + main render) → wrapped in `const content = (...)`
    #   - new return with AggregationPageShell

    # Find the `if (loading) {` marker — it's our split point
    marker = re.search(r"\n  if \(loading\) \{", text)
    if not marker:
        # Try alternate: directly search for the `return (` after the function body
        # Some pages don't have an `if (loading)` early return — just a final return
        # We'll find the FIRST `return (` after the `async function fetchAggregation` block
        fetch_end = text.rfind("  const totals")
        if fetch_end == -1:
            print(f"  SKIP (no `if (loading)` and no `const totals`): {path}")
            return False
        # Find next `return (` after `const totals`
        return_match = re.search(r"\n  return \(", text[fetch_end:])
        if not return_match:
            print(f"  SKIP (no `return (` after totals): {path}")
            return False
        split_pos = fetch_end + return_match.start()
    else:
        split_pos = marker.start()

    preamble = text[:split_pos]
    jsx_block = text[split_pos:]

    # The jsx_block ends with the function's closing `}`
    # Find the LAST `}` (function close) — it should be at the very end of the file
    # or close to it (after trim of trailing whitespace)
    jsx_block_trimmed = jsx_block.rstrip()
    if not jsx_block_trimmed.endswith("}"):
        print(f"  SKIP (unexpected end of file): {path}")
        return False

    # Remove the final `}` (function close) — we'll add it back later
    jsx_inner = jsx_block_trimmed[:-1].rstrip()

    # Now wrap: change `if (loading) { return <X/> }` to `const loading_block = <X/>;`
    # And change `return <Y/>` to `const main_block = <Y/>;`
    # Then: `const content = loading ? loading_block : main_block;`
    # Then: `return <AggregationPageShell ...>{content}</AggregationPageShell>;`
    #
    # Simpler approach: just wrap the whole jsx_inner in `(loading ? <Loading/> : <MainJSX/>)`
    # No — easier to just wrap it as `const content = (...)`
    #
    # The jsx_inner currently looks like:
    #   if (loading) {
    #     return (
    #       <LoadingJSX/>
    #     );
    #   }
    #
    #   return (
    #     <MainJSX/>
    #   );
    #
    # We want:
    #   const content = loading ? (
    #     <LoadingJSX/>
    #   ) : (
    #     <MainJSX/>
    #   );

    # Replace `if (loading) {\n    return (\n` with `const content = loading ? (\n`
    # And `    );\n  }` (end of if-block) with `\n  ) : (`
    # And the final `  return (\n` becomes empty (already inside the `: (`)
    # And the final `  );` becomes `  );` (end of ternary)

    # Use regex for safer replacement
    # Step 1: Replace `if (loading) { return ( ... ); }` → `const content = loading ? ( ... ) : ( MAIN_JSX );`

    # If the file has the `if (loading)` early return:
    if "if (loading) {" in jsx_inner:
        # Replace `if (loading) {\n    return (\n` with `const content = loading ? (\n`
        new_jsx = re.sub(
            r"if \(loading\) \{\s*\n\s*return \(\s*\n",
            "const content = loading ? (\n",
            jsx_inner,
            count=1,
        )
        # Replace the closing of the if-block + start of main return:
        # `    );\n  }\n\n  return (\n` → `\n  ) : (\n`
        new_jsx = re.sub(
            r"\s*\);\s*\n\s*\}\s*\n\s*return \(\s*\n",
            "\n  ) : (\n",
            new_jsx,
            count=1,
        )
        # The final `  );` stays as the close of the ternary
    else:
        # No early return — just `return ( <MainJSX/> );`
        # Replace `return (\n` at the start with `const content = (\n`
        new_jsx = re.sub(
            r"^\s*return \(\s*\n",
            "const content = (\n",
            jsx_inner,
            count=1,
        )
        # The final `);` stays as the close of const

    # Build the new file
    new_imports = "import { AggregationPageShell } from '@/components/aggregation/AggregationPageShell';\n"
    if tabs_import:
        new_imports += tabs_import + "\n"

    # Find the last import line in the preamble and insert after it
    import_section_end = preamble.rfind("\nimport ")
    if import_section_end != -1:
        # Find the end of that import line
        end_of_line = preamble.find("\n", import_section_end + 1)
        if end_of_line == -1:
            end_of_line = len(preamble)
        new_preamble = preamble[:end_of_line] + "\n" + new_imports.rstrip() + preamble[end_of_line:]
    else:
        new_preamble = new_imports + preamble

    # Build the new return statement
    if tabs_const_name == "STUDENTS_SUB_MODULES_INLINE":
        # Students module uses inline sub-modules (no separate file)
        # We define them inline
        tabs_arg = """[
      { id: 'dashboard', label: 'Tableau de Bord', path: '/app/students', icon: LayoutDashboard },
      { id: 'admissions', label: 'Admissions', path: '/app/students/enrollments', icon: UserPlus },
      { id: 'enrollments', label: 'Inscriptions', path: '/app/students/enrollments', icon: GraduationCap },
      { id: 'dossiers', label: 'Dossiers Élèves', path: '/app/students/[studentId]/dossier', icon: FileText },
      { id: 'classes', label: 'Classes', path: '/app/students/classes', icon: Users },
      { id: 'attendance', label: 'Présences', path: '/app/students/attendance', icon: Calendar },
      { id: 'discipline', label: 'Discipline', path: '/app/students/discipline', icon: Shield },
      { id: 'documents', label: 'Documents', path: '/app/students/documents', icon: FileText },
      { id: 'matricules', label: 'Matricules', path: '/app/students/matricules', icon: IdCard },
      { id: 'transfers', label: 'Transferts', path: '/app/students/transfers', icon: ArrowRightLeft },
      { id: 'guardians', label: 'Tuteurs', path: '/app/students/guardians', icon: User },
      { id: 'id-cards', label: 'Cartes Scolaires', path: '/app/students/id-cards', icon: IdCard },
      { id: 'aggregation', label: 'Agrégation & Bilan Global', path: '/app/students/aggregation', icon: BarChart3 },
    ]"""
        # Also need to add the icons to the import line
        new_preamble = new_preamble.replace(
            "from 'lucide-react';",
            "LayoutDashboard, UserPlus, GraduationCap, FileText, Users, Calendar, Shield, IdCard, ArrowRightLeft, User, BarChart3 } from 'lucide-react';",
            1,
        )
    else:
        tabs_arg = tabs_const_name

    new_return = f"""
  return (
    <AggregationPageShell
      moduleTitle={repr(module_title)}
      moduleDescription={repr(module_description)}
      moduleIcon={repr(module_icon)}
      tabs={{{tabs_arg}}}
      activeTabId={repr(active_tab_id)}
    >
      {{content}}
    </AggregationPageShell>
  );
}}"""

    new_text = new_preamble + "\n" + new_jsx + new_return + "\n"

    # Sanity check: balanced braces
    open_b = new_text.count("{")
    close_b = new_text.count("}")
    if open_b != close_b:
        print(f"  ⚠️  Unbalanced braces after refactor: {open_b} {{ vs {close_b} }}")
        # Don't write — abort
        return False

    path.write_text(new_text, encoding="utf-8")
    print(f"  ✅ Refactored: {path}")
    return True


def main():
    print("=== Refactoring aggregation pages ===\n")
    changed = 0
    skipped = 0
    for target in TARGETS:
        path = target[0]
        if not path.exists():
            print(f"  MISSING: {path}")
            continue
        if refactor_page(*target):
            changed += 1
        else:
            skipped += 1
    print(f"\n=== Summary ===\n  Changed: {changed}\n  Skipped: {skipped}")


if __name__ == "__main__":
    main()
