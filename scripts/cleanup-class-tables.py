"""
Script de NETTOYAGE des tables de classes pour le tenant Eveil d'Afrique.
À n'exécuter qu'avec l'accord explicite de l'utilisateur.

Tables vidées (par ordre de dépendance pour éviter les conflits FK) :
  - class_subjects            (liens matière-classe)
  - classes                   (sections physiques, table `Class`)
  - classrooms                (classes officielles par année)
  - pedagogy_academic_classes (classes pédagogiques sync auto)
  - pedagogy_academic_cycles  (cycles sync auto)
  - pedagogy_academic_levels  (niveaux sync auto)
  - pedagogy_academic_series  (séries sync auto)
  - pedagogy_series_subjects  (liens série-matière)

Tables NON touchées (paramètres source, à conserver) :
  - education_levels          (MATERNELLE, PRIMAIRE, SECONDAIRE)
  - education_cycles          (CI, CP, CE1, ..., 1er cycle, 2nd cycle)
  - education_grades          (CI, CP, CE1, ..., 2nde A1, Terminale D, ...)
  - education_series          (A1, A2, B, C, D)
  - subjects                  (matières — non concernées par ce nettoyage)
  - rooms                     (salles — non concernées)
"""
import psycopg2
import sys

CONN_STR = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require"
TENANT_ID = "59b8c348-ae5f-4d67-8fbd-af6aefa1f394"

# Tables à vider, dans l'ordre (les dépendances en dernier)
TABLES_TO_TRUNCATE = [
    'class_subjects',
    'classes',
    'classrooms',
    'pedagogy_academic_classes',
    'pedagogy_academic_cycles',
    'pedagogy_academic_levels',
    'pedagogy_academic_series',
    'pedagogy_series_subjects',
]

def main():
    if '--confirm' not in sys.argv:
        print("⚠️  Ce script va SUPPRIMER définitivement les données de classes du tenant Eveil d'Afrique.")
        print(f"   Tables concernées : {', '.join(TABLES_TO_TRUNCATE)}")
        print()
        print("   Pour confirmer, relancez avec :")
        print(f"     python3 {sys.argv[0]} --confirm")
        sys.exit(1)

    print(f"Connexion à Neon BDD...")
    conn = psycopg2.connect(CONN_STR)
    conn.autocommit = False
    cur = conn.cursor()

    print(f"Tenant ciblé : {TENANT_ID} (Eveil d'Afrique)")
    print()

    # Vérifier les comptes avant suppression
    print("=== Comptes AVANT nettoyage ===")
    for t in TABLES_TO_TRUNCATE:
        cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE "tenantId" = %s', (TENANT_ID,))
        n = cur.fetchone()[0]
        print(f"  {t:<35} → {n} lignes")
    print()

    # Suppression dans l'ordre
    print("=== Suppression en cours ===")
    for t in TABLES_TO_TRUNCATE:
        cur.execute(f'DELETE FROM "{t}" WHERE "tenantId" = %s', (TENANT_ID,))
        deleted = cur.rowcount
        print(f"  ✓ {t:<35} → {deleted} lignes supprimées")

    conn.commit()
    print()
    print("✅ Commit effectué.")

    # Vérification après
    print()
    print("=== Comptes APRÈS nettoyage ===")
    for t in TABLES_TO_TRUNCATE:
        cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE "tenantId" = %s', (TENANT_ID,))
        n = cur.fetchone()[0]
        print(f"  {t:<35} → {n} lignes")

    # Vérifier que les tables Paramètres (education_*) sont INTACTES
    print()
    print("=== Tables Paramètres (NON touchées, doivent rester intactes) ===")
    for t in ['education_levels', 'education_cycles', 'education_grades', 'education_series']:
        cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE "tenantId" = %s', (TENANT_ID,))
        n = cur.fetchone()[0]
        print(f"  {t:<35} → {n} lignes (✓ conservées)")

    cur.close()
    conn.close()
    print()
    print("=" * 70)
    print("Nettoyage terminé.")
    print("Au prochain chargement de l'onglet Structure dans l'app, les tables")
    print("pedagogy_academic_levels / cycles / classes / series seront re-sync")
    print("automatiquement depuis les tables education_* intactes.")
    print("=" * 70)

if __name__ == "__main__":
    main()
