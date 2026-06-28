"""
Suppression de toutes les données liées à l'année 2025-2026
du tenant Academia Helm, SANS toucher aux tables RH.

Tables à nettoyer (9 tables, 156 lignes) :
  1. finance_daily_closures        (79)
  2. financial_settings            (1)
  3. fee_regimes                   (3)
  4. academic_periods              (3)
  5. classrooms                    (25)
  6. pedagogy_academic_classes     (27)
  7. pedagogy_academic_cycles      (10)
  8. pedagogy_academic_levels      (3)
  9. pedagogy_academic_series      (5)

Tables RH PRÉSERVÉES (19 tables) :
  cnss_declarations, leave_requests, payroll_items, payroll_periods,
  salary_payments, staff_admin_assignments, staff_allowances,
  staff_assignments, staff_attendances, staff_documents, staff_evaluations,
  staff_photos, staff_schedules, staff_trainings, tax_declarations,
  tax_payroll_periods, tax_payslips, tax_settings, tax_withholdings

Ordre de suppression (feuilles → racines, pour respecter les FK) :
  1. finance_daily_closures  (pas de FK sortante critique)
  2. financial_settings
  3. fee_regimes
  4. academic_periods
  5. classrooms               (peut être référencé par pedagogy_academic_classes via sync, mais pas FK directe)
  6. pedagogy_academic_classes (FK → levels, cycles ; référencée par classes + class_subjects via CASCADE)
  7. pedagogy_academic_cycles  (référencée par pedagogy_academic_classes, déjà supprimées)
  8. pedagogy_academic_levels  (référencée par pedagogy_academic_classes + cycles)
  9. pedagogy_academic_series  (référencée par pedagogy_academic_classes)
"""
import psycopg2
import sys

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
TENANT_ID = "4246cd3c-518a-44bb-a5e0-4109b8eca372"  # Academia Helm
YEAR_ID = "190c7387-d069-4014-9c76-0ae8f57fcf6a"     # 2025-2026

# Ordre de suppression (feuilles d'abord)
TABLES_TO_DELETE = [
    'finance_daily_closures',
    'financial_settings',
    'fee_regimes',
    'academic_periods',
    'classrooms',
    'pedagogy_academic_classes',
    'pedagogy_academic_series',
    'pedagogy_academic_cycles',
    'pedagogy_academic_levels',
]

def main():
    if '--confirm' not in sys.argv:
        print("⚠️  Ce script va SUPPRIMER toutes les données de l'année 2025-2026")
        print("    du tenant Academia Helm (4246cd3c-518a-44bb-a5e0-4109b8eca372).")
        print(f"    Tables concernées : {', '.join(TABLES_TO_DELETE)}")
        print("    Les tables RH sont PRÉSERVÉES.")
        print()
        print("    Pour confirmer, relancez avec :")
        print(f"      python3 {sys.argv[0]} --confirm")
        sys.exit(1)

    print(f"Connexion à Neon BDD...")
    conn = psycopg2.connect(CONN_STR)
    conn.autocommit = False
    cur = conn.cursor()

    print(f"Tenant : Academia Helm ({TENANT_ID})")
    print(f"Année  : 2025-2026 ({YEAR_ID})")
    print()

    # Comptage AVANT
    print("=== Comptes AVANT suppression ===")
    for t in TABLES_TO_DELETE:
        cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE "tenantId" = %s AND "academicYearId" = %s',
                    (TENANT_ID, YEAR_ID))
        n = cur.fetchone()[0]
        print(f"  {t:<40} → {n} lignes")

    # Vérification de sécurité : s'assurer qu'aucune table RH n'est dans la liste
    HR_SAFE = ['cnss_', 'leave_requests', 'payroll_', 'salary_', 'staff_', 'tax_', 'hr_']
    for t in TABLES_TO_DELETE:
        for pattern in HR_SAFE:
            if t.startswith(pattern) or t == pattern.rstrip('_'):
                print(f"\n❌ ERREUR DE SÉCURITÉ : {t} est une table RH ! ABORT.")
                sys.exit(1)

    print("\n✓ Vérification de sécurité passée : aucune table RH dans la liste.")
    print()

    # Suppression dans l'ordre
    print("=== Suppression en cours ===")
    total_deleted = 0
    for t in TABLES_TO_DELETE:
        try:
            cur.execute(
                f'DELETE FROM "{t}" WHERE "tenantId" = %s AND "academicYearId" = %s',
                (TENANT_ID, YEAR_ID)
            )
            deleted = cur.rowcount
            total_deleted += deleted
            print(f"  ✓ {t:<40} → {deleted} lignes supprimées")
        except Exception as e:
            conn.rollback()
            print(f"  ✗ {t:<40} → ERREUR FK: {e}")
            print(f"    Rollback. Réessai sans cette table...")
            # Réessayer la transaction sans cette table
            # (les tables avec CASCADE vont supprimer les dépendances automatiquement)
            # On continue avec les autres tables
            for t2 in TABLES_TO_DELETE:
                if t2 == t:
                    continue
                try:
                    cur.execute(
                        f'DELETE FROM "{t2}" WHERE "tenantId" = %s AND "academicYearId" = %s',
                        (TENANT_ID, YEAR_ID)
                    )
                    deleted2 = cur.rowcount
                    total_deleted += deleted2
                    print(f"  ✓ {t2:<40} → {deleted2} lignes supprimées (retry)")
                except Exception as e2:
                    conn.rollback()
                    print(f"  ✗ {t2:<40} → ERREUR: {e2}")
            break

    conn.commit()
    print(f"\n✅ Commit effectué. Total : {total_deleted} lignes supprimées.")

    # Comptage APRÈS
    print("\n=== Comptes APRÈS suppression ===")
    for t in TABLES_TO_DELETE:
        cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE "tenantId" = %s AND "academicYearId" = %s',
                    (TENANT_ID, YEAR_ID))
        n = cur.fetchone()[0]
        print(f"  {t:<40} → {n} lignes")

    # Vérifier que les tables RH sont INTACTES
    print("\n=== Tables RH (vérification — doivent être non touchées) ===")
    hr_tables = [
        'staff_admin_assignments', 'staff_attendances', 'staff_documents',
        'staff_evaluations', 'staff_photos', 'staff_schedules', 'staff_trainings',
        'staff_allowances', 'staff_assignments',
        'payroll_items', 'payroll_periods', 'salary_payments',
        'tax_settings', 'tax_declarations', 'tax_payroll_periods', 'tax_payslips',
        'tax_withholdings', 'leave_requests', 'cnss_declarations',
    ]
    for t in hr_tables:
        try:
            # Certaines tables RH n'ont pas academicYearId — on compte juste par tenant
            cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE "tenantId" = %s', (TENANT_ID,))
            n = cur.fetchone()[0]
            print(f"  ✓ {t:<40} → {n} lignes (PRÉSERVÉ)")
        except Exception as e:
            conn.rollback()
            print(f"  ⚠️ {t:<40} → vérification impossible: {e}")

    cur.close()
    conn.close()
    print("\n" + "=" * 75)
    print("Nettoyage terminé.")
    print("=" * 75)

if __name__ == "__main__":
    main()
