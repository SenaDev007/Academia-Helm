"""
Investigation : lister toutes les tables qui ont à la fois tenantId et academicYearId
pour le tenant Academia Helm, année 2025-2026.
Identifier aussi les tables RH à EXCLURE.
"""
import psycopg2

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
TENANT_ID = "4246cd3c-518a-44bb-a5e0-4109b8eca372"  # Academia Helm

# Tables du module RH à PRÉSERVER (ne JAMAIS toucher)
# Inclut : staff, hr_*, recruitment, contracts, payroll, taxes, attendance RH, etc.
HR_TABLES_PATTERNS = [
    'hr_%',
    'staff_%',
    'staffs',
    'staff_number_sequences',
    'staff_documents',
    'staff_photos',
    'staff_attendances',
    'staff_evaluations',
    'staff_trainings',
    'staff_allowances',
    'staff_schedules',
    'staff_assignments',
    'contracts',
    'contract_%',
    'payroll_%',
    'salary_%',
    'tax_%',
    'taxes',
    'tax_rates',
    'tax_withholdings',
    'recruitment_%',
    'hr_candidate_%',
    'hr_talent_%',
    'hr_teaching_%',
    'hr_academic_%',
    'hr_job_%',
    'hr_offer_%',
    'hr_interview_%',
    'leave_requests',
    'job_number_sequences',
    'payroll_periods',
    'cnss_declarations',
    'cnss_%',
    'staff_admin_assignments',
    'job_offers',
    'interviews',
    'candidates',
    'recruitment_applications',
]

def main():
    conn = psycopg2.connect(CONN_STR)
    conn.set_session(readonly=True)
    cur = conn.cursor()

    print("=" * 75)
    print(f"TENANT : Academia Helm ({TENANT_ID})")
    print("=" * 75)

    # 1. Trouver l'année 2025-2026 du tenant
    print("\n--- 1. Années scolaires du tenant Academia Helm ---")
    cur.execute("""
        SELECT id, name, "isActive", "startDate", "endDate"
        FROM "academic_years"
        WHERE "tenantId" = %s
        ORDER BY "startDate" DESC
    """, (TENANT_ID,))
    years = cur.fetchall()
    year_2025_2026_id = None
    for y in years:
        marker = ""
        if "2025" in (y[1] or ""):
            year_2025_2026_id = y[0]
            marker = " ← CIBLE"
        print(f"  {y[0]} | {y[1]} | active={y[2]} | {y[3]} → {y[4]}{marker}")

    if not year_2025_2026_id:
        print("\n  ⚠️  Aucune année 2025-2026 trouvée pour ce tenant !")
        return

    print(f"\n  → Année 2025-2026 ID = {year_2025_2026_id}")

    # 2. Lister toutes les tables qui ont une colonne tenantId ET academicYearId
    print("\n--- 2. Tables avec tenantId + academicYearId ---")
    cur.execute("""
        SELECT t1.table_name
        FROM information_schema.columns t1
        JOIN information_schema.columns t2
          ON t1.table_name = t2.table_name
         AND t1.table_schema = t2.table_schema
        WHERE t1.table_schema = 'public'
          AND t1.column_name = 'tenantId'
          AND t2.column_name = 'academicYearId'
        ORDER BY t1.table_name
    """)
    all_tables = [r[0] for r in cur.fetchall()]
    print(f"  Total tables avec tenantId + academicYearId: {len(all_tables)}")

    # 3. Séparer tables RH vs tables à nettoyer
    def is_hr_table(name):
        for pattern in HR_TABLES_PATTERNS:
            if pattern.endswith('%') and name.startswith(pattern[:-1]):
                return True
            if name == pattern:
                return True
        return False

    hr_tables = [t for t in all_tables if is_hr_table(t)]
    non_hr_tables = [t for t in all_tables if not is_hr_table(t)]

    print(f"\n--- 3. Tables RH à PRÉSERVER ({len(hr_tables)}) ---")
    for t in hr_tables:
        print(f"  ✓ PRÉSERVÉ : {t}")

    print(f"\n--- 4. Tables à nettoyer (non-RH, {len(non_hr_tables)}) ---")
    print(f"  → Comptage pour tenant={TENANT_ID} AND year={year_2025_2026_id}")
    print()

    tables_to_clean = []
    for t in non_hr_tables:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE "tenantId" = %s AND "academicYearId" = %s',
                        (TENANT_ID, year_2025_2026_id))
            count = cur.fetchone()[0]
            if count > 0:
                tables_to_clean.append((t, count))
                print(f"  • {t:<50} → {count} lignes")
        except Exception as e:
            # La colonne academicYearId peut ne pas exister sur cette table
            # (parfois c'est academicYearId_string ou autre)
            conn.rollback()

    print(f"\n--- 5. Récapitulatif ---")
    total_rows = sum(c for _, c in tables_to_clean)
    print(f"  Tables à nettoyer : {len(tables_to_clean)}")
    print(f"  Total lignes à supprimer : {total_rows}")
    print(f"  Tables RH préservées : {len(hr_tables)}")

    # 6. Écrire la liste dans un fichier pour le script de suppression
    with open('/tmp/tables_to_clean.txt', 'w') as f:
        for t, _ in tables_to_clean:
            f.write(f"{t}\n")
    print(f"\n  Liste écrite dans /tmp/tables_to_clean.txt")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
