#!/usr/bin/env python3
"""175c — Excel : élèves actifs sans genre à renseigner (liste promoteur)."""
import json
import sys
import os
import datetime
import psycopg2

XLSX_SKILL_DIR = "/home/z/my-project/skills/xlsx"
for sub in [XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")]:
    if sub not in sys.path:
        sys.path.insert(0, sub)

from openpyxl import Workbook
import base
from base import (
    PRIMARY, NEUTRAL_900, NEUTRAL_600, NEUTRAL_200, NEUTRAL_100, NEUTRAL_0,
)
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

DB_URL = ('postgresql://neondb_owner:npg_cYiR2zofhs0v@'
          'ep-winter-firefly-b9dujjz5-pooler.c-7.eu-central-1.aws.neon.tech/'
          'academia%20helm?sslmode=require')

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("""
    SELECT t.name, c.name, s.matricule, s."firstName", s."lastName"
    FROM students s
    JOIN tenants t ON t.id = s."tenantId"
    LEFT JOIN LATERAL (
        SELECT cl.name FROM student_enrollments se
        JOIN classes cl ON cl.id = se."classId"
        WHERE se."studentId" = s.id
          AND se."academicYearId" = (SELECT id FROM academic_years WHERE "isActive" = true LIMIT 1)
        ORDER BY se."createdAt" DESC LIMIT 1
    ) c ON true
    WHERE s."isActive" = true AND s.gender IS NULL
    ORDER BY t.name, c.name NULLS LAST, s."lastName", s."firstName"
""")
rows = cur.fetchall()
conn.close()
print(f"élèves sans genre : {len(rows)}")

wb = Workbook()
ws = wb.active
ws.title = "Élèves sans genre"

thin_bottom = Border(bottom=Side(style="thin", color=NEUTRAL_200))

# ── Titre ──
ws.cell(row=2, column=2, value="Élèves sans genre à renseigner (bulletins « 1er/1ère »)")
ws.cell(row=2, column=2).font = Font(name=base.get_font().name if callable(getattr(base, 'get_font', None)) else 'Calibri',
                                     size=14, bold=True, color=PRIMARY)
ws.cell(row=3, column=2, value=f"Généré le {datetime.date.today().strftime('%d/%m/%Y')} — "
                               f"corriger via Élèves > fiche élève > champ Sexe (M ou F). "
                               f"Sans genre, les bulletins affichent « 1er » (masculin par défaut).")
ws.cell(row=3, column=2).font = Font(size=9, color=NEUTRAL_600)

# ── En-têtes ──
headers = ["École", "Classe", "Matricule", "Prénom", "Nom"]
HDR_ROW = 5
for ci, h in enumerate(headers, 2):
    c = ws.cell(row=HDR_ROW, column=ci, value=h)
    c.font = Font(bold=True, color="FFFFFF", size=10)
    c.fill = PatternFill("solid", fgColor=PRIMARY)
    c.alignment = Alignment(horizontal="left", vertical="center")
    c.border = thin_bottom

# ── Données ──
r = HDR_ROW + 1
for i, (school, classe, matricule, first, last) in enumerate(rows):
    fill = PatternFill("solid", fgColor=NEUTRAL_100) if i % 2 == 0 else PatternFill("solid", fgColor=NEUTRAL_0)
    vals = [school, classe or "—", matricule or "—", first or "", last or ""]
    for ci, v in enumerate(vals, 2):
        c = ws.cell(row=r, column=ci, value=v)
        c.font = Font(size=10, color=NEUTRAL_900)
        c.fill = fill
        c.alignment = Alignment(horizontal="left", vertical="center")
    r += 1

# ── Largeurs ──
widths = [38, 14, 18, 26, 26]
for ci, w in enumerate(widths, 2):
    ws.column_dimensions[get_column_letter(ci)].width = w
ws.freeze_panes = f"B{HDR_ROW + 1}"
ws.sheet_view.showGridLines = False

out = "/home/z/my-project/download/eleves_sans_genre_a_renseigner_20261124.xlsx"
wb.save(out)
print("Excel écrit :", out, f"({len(rows)} lignes)")
