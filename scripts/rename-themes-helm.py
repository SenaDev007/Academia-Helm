"""
Rename all themes in themes.config.ts by prefixing them with "Helm ".
- "Ocean Breeze" → "Helm Ocean Breeze"
- "Academia Helm (par défaut)" → stays unchanged (already has Helm)
- Default theme is preserved
"""

import re

PATH = '/home/z/my-project/apps/web-app/src/lib/themes/themes.config.ts'

with open(PATH, 'r') as f:
    content = f.read()

# Pattern: name: 'Some Name',
# We need to prefix with "Helm " only if not already prefixed
def rename(match):
    name = match.group(1)
    # Skip if already starts with "Helm " or contains "Academia Helm"
    if name.startswith('Helm ') or 'Academia Helm' in name:
        return f"name: '{name}',"
    new_name = f'Helm {name}'
    return f"name: '{new_name}',"

# Match: name: 'XYZ',  (with single quotes and trailing comma)
new_content = re.sub(r"name: '([^']+)',", rename, content)

# Count changes
original_names = re.findall(r"name: '([^']+)',", content)
new_names = re.findall(r"name: '([^']+)',", new_content)
changes = sum(1 for o, n in zip(original_names, new_names) if o != n)

with open(PATH, 'w') as f:
    f.write(new_content)

print(f'Renamed {changes} themes with "Helm " prefix')
print()
print('Sample renamed themes:')
for n in new_names[:10]:
    print(f'  - {n}')
