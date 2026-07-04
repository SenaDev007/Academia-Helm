#!/usr/bin/env python3
"""Replace hardcoded CSS values in buildHtmlFromArticles with config variables."""

import re

filepath = '/home/z/my-project/repo/Academia-Helm/apps/api-server/src/hr/services/contract-pdf.service.ts'

with open(filepath, 'r') as f:
    content = f.read()

# Find the buildHtmlFromArticles method (the second occurrence of the CSS)
# We need to target only the CSS within this method, not getDefaultTemplate

# Find the start of buildHtmlFromArticles's return template
# Look for the pattern after "let articlesHtml = '';" in buildHtmlFromArticles
method_start = content.find("buildHtmlFromArticles(articles: any[], contractType: string, docConfig?: any)")
if method_start == -1:
    print("ERROR: Could not find buildHtmlFromArticles method")
    exit(1)

# Find the return statement with the HTML template
return_start = content.find("return `<!DOCTYPE html>", method_start)
if return_start == -1:
    print("ERROR: Could not find return template in buildHtmlFromArticles")
    exit(1)

# Find the end of the return template (closing backtick + semicolon)
return_end = content.find("`;", return_start)
if return_end == -1:
    print("ERROR: Could not find end of return template")
    exit(1)

template_section = content[return_start:return_end]

# Make replacements in the template section
replacements = [
    # Watermark CSS
    ("transform: translate(-50%, -50%) rotate(-45deg);",
     "transform: translate(-50%, -50%) rotate(${watermarkRotation}deg);"),
    ("font-size: 72pt;",
     "font-size: ${watermarkFontSize}pt;"),
    ("color: rgba(26, 43, 166, 0.04);",
     "color: ${watermarkColor};\n      opacity: ${watermarkOpacity};"),

    # Header border
    ("border-bottom: 3px solid #1A2BA6;",
     "border-bottom: ${showDecoLine ? `3px solid ${accentColor}` : 'none'};"),

    # School info h1 color
    (".school-info h1 { font-size: 18pt; color: #1A2BA6; font-weight: bold; }",
     ".school-info h1 { font-size: 18pt; color: ${primaryColor}; font-weight: bold; }"),

    # Contract title h2
    ("border: 2px solid #1A2BA6;\n      display: inline-block;\n      padding: 8px 32px;\n      color: #1A2BA6;",
     "border: 2px solid ${primaryColor};\n      display: inline-block;\n      padding: 8px 32px;\n      color: ${primaryColor};"),

    # Section title
    (".section-title {\n      font-size: 11pt;\n      font-weight: bold;\n      color: #1A2BA6;",
     ".section-title {\n      font-size: ${titleFontSize}pt;\n      font-weight: bold;\n      color: ${primaryColor};"),

    # Article p font size
    (".article p { font-size: 10.5pt; text-align: justify; margin-top: 4px; }",
     ".article p { font-size: ${bodyFontSize}pt; text-align: justify; margin-top: 4px; }"),

    # Watermark text in HTML body
    ('<div class="watermark">ACADEMIA HELM</div>',
     '<div class="watermark">${watermarkText}</div>'),
]

modified_template = template_section
for old, new in replacements:
    if old in modified_template:
        modified_template = modified_template.replace(old, new, 1)
        print(f"✅ Replaced: {old[:60]}...")
    else:
        print(f"⚠️  Not found: {old[:60]}...")

# Replace the section in the full content
content = content[:return_start] + modified_template + content[return_end:]

with open(filepath, 'w') as f:
    f.write(content)

print("\n✅ All replacements done!")
