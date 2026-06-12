#!/usr/bin/env python3
"""
Fix mobile table responsiveness: Add overflow-x-auto wrapper to tables
that are missing horizontal scroll capability.

Strategy:
1. Find all <table> tags
2. Check if they already have an overflow-x-auto parent
3. If not, wrap them in <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
   right inside the overflow-hidden container
"""

import re
import os

BASE = "/home/z/my-project/Academia-Helm/apps/web-app/src"

HIGH_RISK_FILES = [
    "components/federis/FederisSchoolsPage.tsx",
    "components/federis/FederisConnectDocuments.tsx",
    "components/federis/FederisSettingsPage.tsx",
    "components/pedagogy/tasks/TeacherTasksWorkspace.tsx",
    "components/students/StudentRegimeFinanceContent.tsx",
    "components/library/LibraryWorkspace.tsx",
    "components/admin/PricingManagement.tsx",
    "components/pilotage/modules/qhse/QHSEHealth.tsx",
    "components/pilotage/modules/qhse/QHSEAudits.tsx",
    "components/pilotage/modules/qhse/QHSEIncidents.tsx",
    "components/pilotage/modules/qhse/QHSECompliance.tsx",
    "components/pilotage/modules/infirmary/Emergencies.tsx",
    "components/pilotage/modules/infirmary/MedicalRecords.tsx",
    "components/pilotage/modules/educast/EduCastResources.tsx",
    "components/pilotage/modules/educast/EduCastModeration.tsx",
    "components/pilotage/modules/educast/EduCastLibrary.tsx",
    "components/pilotage/modules/educast/EduCastMonetization.tsx",
    "components/pilotage/modules/laboratory/SafetyIncidents.tsx",
    "components/pilotage/modules/laboratory/StocksApprovisionnement.tsx",
    "components/pilotage/modules/laboratory/PracticalSessions.tsx",
    "components/pilotage/modules/laboratory/EquipmentsInventory.tsx",
    "components/pilotage/modules/library/LibraryResources.tsx",
    "components/pilotage/modules/library/LibraryReturns.tsx",
    "components/pilotage/modules/library/LibraryPenalties.tsx",
    "components/pilotage/modules/StudentsModulePage.tsx",
    "components/pilotage/modules/shop/ShopDiscounts.tsx",
    "components/pilotage/modules/shop/ShopReports.tsx",
    "components/platform/billing/PlatformPaymentsWorkspace.tsx",
    "components/platform/billing/PlatformBillingWorkspace.tsx",
    "components/platform/users/PlatformUsersWorkspace.tsx",
    "components/platform/support/PlatformSupportWorkspace.tsx",
    "components/platform/audit/PlatformAuditWorkspace.tsx",
    "app/app/students/documents/page.tsx",
    "app/app/students/transfers/page.tsx",
    "app/app/students/discipline/page.tsx",
    "app/app/students/enrollments/page.tsx",
    "app/app/students/attendance/page.tsx",
    "app/app/pedagogy/class-diaries/page.tsx",
    "app/app/pedagogy/orion/page.tsx",
    "app/app/communication/administration/page.tsx",
    "app/app/communication/history/page.tsx",
    "app/app/hr/payroll/page.tsx",
    "app/app/hr/payroll/[id]/page.tsx",
    "app/app/hr/_components/workspaces/RecruitmentWorkspace.tsx",
    "app/app/hr/_components/workspaces/LeavesWorkspace.tsx",
]

# Also scan for any other files with raw <table> that might be missing overflow-x-auto
def scan_for_unfixed_files():
    """Scan the entire src directory for files with <table but no overflow-x-auto nearby."""
    unfixed = []
    for root, dirs, files in os.walk(BASE):
        # Skip node_modules and .next
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '__pycache__')]
        for f in files:
            if not f.endswith('.tsx'):
                continue
            filepath = os.path.join(root, f)
            try:
                with open(filepath, 'r', encoding='utf-8') as fh:
                    content = fh.read()
            except:
                continue
            
            # Check if file has raw <table (not <Table from shadcn)
            if not re.search(r'<table[\s>]', content):
                continue
            
            # Check if file already has overflow-x-auto
            if 'overflow-x-auto' in content:
                continue
            
            # This file has <table> but no overflow-x-auto
            relpath = os.path.relpath(filepath, BASE)
            if relpath not in HIGH_RISK_FILES:
                unfixed.append(relpath)
    
    return unfixed

def fix_file(filepath):
    """Add overflow-x-auto wrapper around <table> elements in a file."""
    fullpath = os.path.join(BASE, filepath)
    if not os.path.exists(fullpath):
        return False, "File not found"
    
    with open(fullpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: <div className="... overflow-hidden ..."> followed by <table
    # We insert <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"> between them
    # This handles the most common pattern
    
    # Strategy: Find lines with <table that are preceded by a line with overflow-hidden
    # and insert the scroll wrapper
    
    lines = content.split('\n')
    new_lines = []
    i = 0
    changes = 0
    
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Check if this line starts a <table tag and there's no overflow-x-auto wrapper already
        if re.search(r'<table[\s>]', line) and 'overflow-x-auto' not in line:
            # Look backward to find the enclosing div
            # Check if the previous non-empty line is a container div
            found_wrapper = False
            for j in range(max(0, i-3), i):
                if 'overflow-x-auto' in lines[j]:
                    found_wrapper = True
                    break
            
            if not found_wrapper:
                # Insert the scroll wrapper before the <table line
                # Match the indentation of the table line
                indent = len(line) - len(line.lstrip())
                indent_str = line[:indent]
                
                new_lines.append(f'{indent_str}<div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">')
                new_lines.append(line)
                changes += 1
                i += 1
                
                # Now find the closing </table> tag and add </div> after it
                # We need to find the matching </table>
                depth = 1
                while i < len(lines):
                    tline = lines[i]
                    if re.search(r'<table[\s>]', tline) and not re.search(r'</table>', tline):
                        depth += 1
                    if '</table>' in tline:
                        depth -= 1
                        if depth == 0:
                            new_lines.append(tline)
                            new_lines.append(f'{indent_str}</div>')
                            i += 1
                            break
                    new_lines.append(tline)
                    i += 1
                continue
        
        new_lines.append(line)
        i += 1
    
    if changes > 0:
        new_content = '\n'.join(new_lines)
        with open(fullpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True, f"Added {changes} overflow-x-auto wrapper(s)"
    
    return False, "No changes needed"

# First, scan for any additional files not in our list
additional = scan_for_unfixed_files()
if additional:
    print(f"Found {len(additional)} additional files with <table> but no overflow-x-auto:")
    for f in additional:
        print(f"  + {f}")
    HIGH_RISK_FILES.extend(additional)

# Fix all files
fixed = 0
skipped = 0
errors = 0

for filepath in HIGH_RISK_FILES:
    ok, msg = fix_file(filepath)
    if ok:
        fixed += 1
        print(f"✅ {filepath}: {msg}")
    elif "not found" in msg:
        errors += 1
        print(f"❌ {filepath}: {msg}")
    else:
        skipped += 1
        print(f"⏭️  {filepath}: {msg}")

print(f"\n📊 Results: {fixed} fixed, {skipped} skipped, {errors} errors out of {len(HIGH_RISK_FILES)} files")
