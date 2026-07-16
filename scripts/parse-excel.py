#!/usr/bin/env python3
"""
Parse les 2 fichiers Excel Mon Avenir Plus / Ndali (Primaire + Secondaire)
et génère scripts/students-data.json (intermédiaire) à importer en DB Neon.

Structure Excel (par feuille = 1 classe physique) :
  - Row 1-2 : vides
  - Row 3 (index 2) : métadonnées (col J="ANNEE SCOLAIRE", col K=année, col O="Scolarité", col P=montant)
  - Row 4 (index 3) : en-têtes (N°, Noms, Arrière, Tél, Inscript, Unif, Tenue, Total, Scolarite P1-P6, Total, Reste, Total payé)
  - Row 5 (index 4) : sous-en-têtes (P1, P2, P3, P4, P5, P6)
  - Row 6+ (index 5+) : données élèves
  - Dernière ligne : TOTAL (à ignorer)

⚠️ La feuille "CM1 A" est décalée d'une ligne vers le haut (data commence row 4 / index 3).
On détecte donc dynamiquement la ligne d'en-tête.
"""
import json
import re
import unicodedata
from pathlib import Path
from openpyxl import load_workbook

UPLOAD_DIR = Path("/home/z/my-project/upload")
PRIMAIRE_FILE = UPLOAD_DIR / "POINT PRIMAIRE 2025-2026.xlsx"
SECONDAIRE_FILE = UPLOAD_DIR / "POINT SECONDAIRE  2025-2026.xlsx"
OUTPUT_FILE = Path("/home/z/my-project/scripts/students-data.json")


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def normalize_name(s: str) -> str:
    """Normalisation agressive d'un nom pour le matching :
       - lowercase
       - retire accents (NFKD)
       - retire ponctuation . , ' ’ - _
       - collapse espaces multiples
    """
    if s is None:
        return ""
    s = str(s)
    # NFKD puis on retire les combining marks (accents)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    # lowercase
    s = s.lower()
    # retire ponctuation courante
    s = re.sub(r"[.,;:'’`\"\-_()]+", " ", s)
    # collapse whitespace
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_amount(val) -> int:
    """Parse un montant depuis une cellule Excel :
       - int ou float direct
       - string "5,000" ou "5.000" ou "5000" ou "ABD" (texte non numérique → 0)
       Retourne toujours un entier (FCFA).
    """
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        if isinstance(val, float) and val != val:  # NaN
            return 0
        return int(val)
    s = str(val).strip()
    if not s:
        return 0
    # Si la chaîne contient des lettres uniquement (hors chiffres) → 0
    # (ex: "ABD" pour abandon)
    if not re.search(r"\d", s):
        return 0
    # Retire tout ce qui n'est pas chiffre
    digits = re.sub(r"[^\d]", "", s)
    if not digits:
        return 0
    return int(digits)


def find_header_row(ws, max_scan: int = 10) -> int:
    """Trouve l'index (0-based) de la ligne d'en-têtes contenant 'Noms'."""
    for row_idx in range(0, min(max_scan, ws.max_row)):
        for col_idx in range(0, min(5, ws.max_column)):
            v = ws.cell(row=row_idx + 1, column=col_idx + 1).value
            if v and isinstance(v, str) and "noms" in v.lower():
                return row_idx
    return None


def find_metadata_row(ws, max_scan: int = 8) -> tuple:
    """Trouve la ligne de métadonnées contenant 'ANNEE SCOLAIRE' et 'Scolarité'.
       Retourne (row_idx, scol_fee_col_idx) ou (None, None).
    """
    scol_fee_col = None
    scol_row = None
    for row_idx in range(0, min(max_scan, ws.max_row)):
        for col_idx in range(0, min(20, ws.max_column)):
            v = ws.cell(row=row_idx + 1, column=col_idx + 1).value
            if v and isinstance(v, str) and "scolarit" in v.lower():
                scol_row = row_idx
                scol_fee_col = col_idx
                break
        if scol_row is not None:
            break
    return (scol_row, scol_fee_col)


# ----------------------------------------------------------------------------
# Parsing
# ----------------------------------------------------------------------------
def parse_sheet(ws, sheet_name: str, source_file: str) -> dict:
    """Parse une feuille Excel en dict {className, scolarityFee, students: [...]}"""
    # 1. Ligne d'en-têtes
    header_row_idx = find_header_row(ws)
    if header_row_idx is None:
        print(f"  ⚠️ Pas d'en-tête 'Noms' trouvée dans feuille '{sheet_name}' — skip")
        return None

    # 2. Ligne sous-en-têtes (P1..P6) = header_row_idx + 1
    sub_header_row_idx = header_row_idx + 1

    # 3. Métadonnées (scolarité fee) — recherche séparée
    scol_row, scol_col = find_metadata_row(ws)
    scolarity_fee = None
    if scol_row is not None and scol_col is not None:
        # Le montant est dans la colonne suivante
        scolarity_fee = parse_amount(ws.cell(row=scol_row + 1, column=scol_col + 2).value)
        if scolarity_fee == 0:
            # Fallback : parfois montant est dans la même colonne
            scolarity_fee = parse_amount(ws.cell(row=scol_row + 1, column=scol_col + 1).value)

    # 4. Données élèves : à partir de sub_header_row_idx + 1
    students = []
    data_start = sub_header_row_idx + 1
    for r in range(data_start, ws.max_row + 1):
        # Lecture colonnes 1-17 (0-indexed → 1-17 en openpyxl 1-based)
        num = ws.cell(row=r, column=1).value        # col 0: N°
        name = ws.cell(row=r, column=2).value       # col 1: Noms et Prénoms
        arrears = ws.cell(row=r, column=3).value    # col 2: Arriéré
        tel = ws.cell(row=r, column=4).value         # col 3: Tél
        inscript = ws.cell(row=r, column=5).value    # col 4: Inscript
        unif = ws.cell(row=r, column=6).value        # col 5: Unif
        tenue = ws.cell(row=r, column=7).value       # col 6: Tenue de Sport
        total_general = ws.cell(row=r, column=8).value  # col 7: Total frais Généraux
        p1 = ws.cell(row=r, column=9).value          # col 8: P1
        p2 = ws.cell(row=r, column=10).value         # col 9: P2
        p3 = ws.cell(row=r, column=11).value         # col 10: P3
        p4 = ws.cell(row=r, column=12).value         # col 11: P4
        p5 = ws.cell(row=r, column=13).value         # col 12: P5
        p6 = ws.cell(row=r, column=14).value         # col 13: P6
        total_scolarite = ws.cell(row=r, column=15).value  # col 14: Total Scolarité
        reste = ws.cell(row=r, column=16).value      # col 15: Reste
        total_paiements = ws.cell(row=r, column=17).value  # col 16: Total des payements

        # Skip si pas de nom ou nom == TOTAL
        if not name or not str(name).strip():
            continue
        name_str = str(name).strip()
        if name_str.upper() == "TOTAL":
            break  # fin des données (ligne TOTAL)

        # Skip si N° n'est pas numérique (autre ligne parasite)
        # (Mais on accepte N° null si le nom est valide)
        student = {
            "row": r,
            "excel_num": num,
            "raw_name": name_str,
            "normalizedName": normalize_name(name_str),
            "arrears": parse_amount(arrears),
            "tel": str(tel).strip() if tel else "",
            "inscript": parse_amount(inscript),
            "uniform": parse_amount(unif),
            "tenue_sport": parse_amount(tenue),
            "total_general": parse_amount(total_general),
            "p1": parse_amount(p1),
            "p2": parse_amount(p2),
            "p3": parse_amount(p3),
            "p4": parse_amount(p4),
            "p5": parse_amount(p5),
            "p6": parse_amount(p6),
            "total_scolarite": parse_amount(total_scolarite),
            "reste": parse_amount(reste),
            "total_paiements": parse_amount(total_paiements),
        }
        students.append(student)

    return {
        "sheetName": sheet_name,
        "sourceFile": source_file,
        "scolarityFee": scolarity_fee or 0,
        "headerRow": header_row_idx,
        "studentCount": len(students),
        "students": students,
    }


def parse_workbook(path: Path) -> list:
    """Parse toutes les feuilles (sauf RECAP) d'un workbook."""
    print(f"\n📂 Parsing : {path}")
    wb = load_workbook(filename=str(path), data_only=True, read_only=False)
    sheets_data = []
    for sn in wb.sheetnames:
        if sn.upper().startswith("RECAP") or sn.upper().startswith("RÉCAP"):
            print(f"  ↩️  Skip feuille RECAP: {sn}")
            continue
        ws = wb[sn]
        parsed = parse_sheet(ws, sn, path.name)
        if parsed:
            print(f"  ✅ {sn:<18} → {parsed['studentCount']} élèves | scolarité={parsed['scolarityFee']}")
            sheets_data.append(parsed)
    wb.close()
    return sheets_data


def main():
    print("=" * 70)
    print("PARSE EXCEL — Mon Avenir Plus / Ndali (Primaire + Secondaire)")
    print("=" * 70)

    primaire = parse_workbook(PRIMAIRE_FILE)
    secondaire = parse_workbook(SECONDAIRE_FILE)

    all_sheets = primaire + secondaire
    total_students = sum(s["studentCount"] for s in all_sheets)
    print("\n" + "=" * 70)
    print(f"TOTAL : {len(all_sheets)} feuilles, {total_students} élèves")
    print(f"  Primaire   : {len(primaire)} feuilles, {sum(s['studentCount'] for s in primaire)} élèves")
    print(f"  Secondaire : {len(secondaire)} feuilles, {sum(s['studentCount'] for s in secondaire)} élèves")
    print("=" * 70)

    output = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "tenantId": "e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb",
        "academicYearId": "78e862b0-ff11-49dc-9c5f-cc455b402c7b",
        "totalStudentsParsed": total_students,
        "sheets": all_sheets,
    }
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n💾 JSON écrit : {OUTPUT_FILE} ({OUTPUT_FILE.stat().st_size} octets)")


if __name__ == "__main__":
    main()
