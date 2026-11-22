#!/usr/bin/env python3
"""
TASK PAIE — Mode de calcul « présences » (22/11/2026).

Retour promoteur : « les RH doivent être capables de tenir compte des
présences des enseignants pour que le calcul des salaires soit bien fait.
[...] il doit également avoir cette libre possibilité de ne pas en tenir
compte et de tenir compte du salaire de base et puis des autres indemnités. »

Migration :
  payroll_periods.attendanceBased  boolean NOT NULL DEFAULT false
      → false (défaut) : base + indemnités, SANS les présences (comportement actuel) ;
      → true           : la base est proratée par les présences pointées.
  payroll_items.attendanceDetail    jsonb NULL
      → { mode, daysPresent, daysExpected, ratio, fullBase, noRecords } figé au calcul.

Idempotent (ADD COLUMN IF NOT EXISTS). Backup de l'état (aucune donnée
altérée : colonnes additives, defaults neutres).

Usage :
  python3 payroll_attendance_mode.py           # dry-run (inspection)
  python3 payroll_attendance_mode.py --apply   # backup → DDL → vérification
"""
import json
import os
import sys
from datetime import datetime

import psycopg2

DSN = (
    open("/home/z/my-project/scripts/_working_dsn.txt").read().strip()
    if os.path.exists("/home/z/my-project/scripts/_working_dsn.txt")
    else os.environ.get("DATABASE_URL", "")
)
APPLY = "--apply" in sys.argv
TS = datetime.now().strftime("%Y%m%d_%H%M")
BACKUP_PATH = f"/home/z/my-project/download/backup_payroll_attendance_mode_{TS}.json"

DDL = [
    (
        "payroll_periods.attendanceBased",
        'ALTER TABLE payroll_periods ADD COLUMN IF NOT EXISTS "attendanceBased" '
        "boolean NOT NULL DEFAULT false",
    ),
    (
        "payroll_items.attendanceDetail",
        "ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS \"attendanceDetail\" jsonb",
    ),
]


def main():
    conn = psycopg2.connect(DSN)
    conn.autocommit = False
    cur = conn.cursor()
    print("== Mode de calcul « présences » — migration payroll ==")
    print(f"   apply={APPLY}\n")

    # 0. Backup de l'état courant (inventaire périodes / lignes)
    cur.execute(
        "SELECT count(*), count(*) FILTER (WHERE status='OPEN') FROM payroll_periods"
    )
    total_p, open_p = cur.fetchone()
    cur.execute("SELECT count(*) FROM payroll_items")
    total_i = cur.fetchone()[0]
    state = {
        "generatedAt": datetime.now().isoformat(),
        "periods": {"total": total_p, "open": open_p},
        "payrollItems": total_i,
        "ddl": [name for name, _ in DDL],
    }
    print(f"   périodes de paie : {total_p} (dont {open_p} OPEN) · lignes : {total_i}")

    # 1. Colonnes existantes ?
    existing = {}
    for table, col in (
        ("payroll_periods", "attendanceBased"),
        ("payroll_items", "attendanceDetail"),
    ):
        cur.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name=%s AND column_name=%s
            """,
            (table, col),
        )
        existing[f"{table}.{col}"] = bool(cur.fetchone())
    for key, present in existing.items():
        print(f"   {key : <40} {'PRÉSENTE' if present else 'absente'}")

    todo = [(name, ddl) for name, ddl in DDL if not existing.get(name, False)]

    if not todo:
        print("\n   Rien à faire — colonnes déjà présentes (idempotent).")
    elif APPLY:
        with open(BACKUP_PATH, "w") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
        for name, ddl in todo:
            print(f"   → {ddl}")
            cur.execute(ddl)
        conn.commit()
        print(f"\n   Backup : {BACKUP_PATH}")
        print("   DDL appliqué et COMMIT.")
    else:
        print("\n   DRY-RUN — colonnes à créer (relancez avec --apply) :")
        for name, ddl in todo:
            print(f"     {ddl}")

    # 2. Vérification finale
    cur.execute(
        """
        SELECT
          (SELECT count(*) FROM information_schema.columns
           WHERE table_name='payroll_periods' AND column_name='attendanceBased'),
          (SELECT count(*) FROM information_schema.columns
           WHERE table_name='payroll_items' AND column_name='attendanceDetail')
        """
    )
    ok_p, ok_i = cur.fetchone()
    try:
        cur.execute('SELECT count(*) FROM payroll_periods WHERE "attendanceBased" IS NULL')
        nulls = cur.fetchone()[0]
    except psycopg2.errors.UndefinedColumn:
        nulls = "n/a (colonne absente — dry-run)"
    print(
        f"\n   VÉRIFICATION : attendanceBased={'OK' if ok_p else 'MANQUANTE'} · "
        f"attendanceDetail={'OK' if ok_i else 'MANQUANTE'} · "
        f"périodes NULL sur le flag : {nulls}"
    )
    cur.close()
    conn.close()
    print("   Terminé.")


if __name__ == "__main__":
    main()
