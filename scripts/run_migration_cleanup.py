#!/usr/bin/env python3
"""
Exécute les migrations SQL de nettoyage sur la BDD Neon.
⚠️ Les colonnes Prisma sont en camelCase (studentId, balanceDue, etc.)
"""
import psycopg2
import sys

DATABASE_URL = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"

def run_migration():
    try:
        print("🔌 Connexion à la base Neon...")
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cursor = conn.cursor()

        # 1. Compter les FeeArrear avant nettoyage
        print("\n📊 AVANT nettoyage :")
        cursor.execute('SELECT COUNT(*) FROM fee_arrears')
        total_before = cursor.fetchone()[0]
        print(f"   Total FeeArrear : {total_before}")

        cursor.execute('SELECT COUNT(DISTINCT "studentId") FROM fee_arrears')
        students_before = cursor.fetchone()[0]
        print(f"   Élèves distincts : {students_before}")

        cursor.execute("SELECT COUNT(*) FROM fee_arrears WHERE notes = 'Détecté automatiquement depuis le solde du compte élève'")
        erroneous = cursor.fetchone()[0]
        print(f"   FeeArrear erronés (ancienne détection) : {erroneous}")

        # 2. Exécuter le nettoyage
        print("\n🧹 Nettoyage en cours...")

        # Supprimer les FeeArrear erronés (note exacte)
        cursor.execute("""
            DELETE FROM fee_arrears
            WHERE notes = 'Détecté automatiquement depuis le solde du compte élève'
        """)
        deleted_count = cursor.rowcount
        print(f"   ✅ {deleted_count} FeeArrear erronés supprimés (note exacte)")

        # Supprimer aussi ceux avec note commençant par 'Détecté automatiquement' sur année non clôturée
        cursor.execute("""
            DELETE FROM fee_arrears
            WHERE "studentFeeId" IS NULL
              AND notes LIKE 'Détecté automatiquement%'
              AND "academicYearId" IN (
                SELECT id FROM academic_years WHERE "isClosed" = false
              )
        """)
        deleted_count_2 = cursor.rowcount
        print(f"   ✅ {deleted_count_2} FeeArrear supplémentaires supprimés (année courante non clôturée)")

        # 3. Compter après nettoyage
        print("\n📊 APRÈS nettoyage :")
        cursor.execute('SELECT COUNT(*) FROM fee_arrears')
        total_after = cursor.fetchone()[0]
        print(f"   Total FeeArrear : {total_after}")

        cursor.execute('SELECT COUNT(DISTINCT "studentId") FROM fee_arrears')
        students_after = cursor.fetchone()[0]
        print(f"   Élèves distincts : {students_after}")

        # Détail par statut
        cursor.execute("""
            SELECT status, COUNT(*), COALESCE(SUM("balanceDue"), 0)
            FROM fee_arrears
            GROUP BY status
            ORDER BY COUNT(*) DESC
        """)
        print("\n   Détail par statut :")
        for row in cursor.fetchall():
            print(f"     {row[0]}: {row[1]} arriérés, {float(row[2]):,.0f} FCFA")

        # Détail par niveau
        cursor.execute("""
            SELECT "arrearsLevel", COUNT(*), COALESCE(SUM("balanceDue"), 0)
            FROM fee_arrears
            GROUP BY "arrearsLevel"
            ORDER BY COUNT(*) DESC
        """)
        print("\n   Détail par niveau de gravité :")
        for row in cursor.fetchall():
            print(f"     {row[0]}: {row[1]} arriérés, {float(row[2]):,.0f} FCFA")

        # Vérifier les arriérés restants avec leur note
        cursor.execute("""
            SELECT notes, COUNT(*)
            FROM fee_arrears
            GROUP BY notes
            ORDER BY COUNT(*) DESC
            LIMIT 10
        """)
        print("\n   Top 10 des notes des arriérés restants :")
        for row in cursor.fetchall():
            notes_preview = (row[0] or 'NULL')[:80]
            print(f"     [{row[1]}] {notes_preview}")

        cursor.close()
        conn.close()
        print("\n✅ Migration terminée avec succès !")

    except Exception as e:
        print(f"\n❌ Erreur : {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_migration()
