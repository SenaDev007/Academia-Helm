#!/usr/bin/env python3
"""
Nettoie les données de test "Academia Helm" dans la DB Neon :
- Supprime les paiements PENDING liés au draft Academia Helm
- Supprime les OTPs liés à ce draft
- Supprime le draft Academia Helm
- Supprime aussi le draft "Test Ecole Email OTP" (test précédent)
- Vérifie qu'aucun tenant Academia Helm n'existe
"""

import psycopg2
import sys

DATABASE_URL = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require"

def main():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        print("✅ Connexion à Neon réussie\n")
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        sys.exit(1)

    # ─── Vérifier qu'aucun tenant Academia Helm n'existe ──────────────
    print("=" * 70)
    print("Vérification : aucun tenant 'Academia Helm' ne doit exister")
    print("=" * 70)
    cur.execute("""
        SELECT id, name, subdomain FROM tenants
        WHERE name ILIKE '%academia helm%'
           OR subdomain ILIKE '%academia%helm%';
    """)
    tenants = cur.fetchall()
    if tenants:
        print(f"  ⚠️  {len(tenants)} tenant(s) trouvé(s) :")
        for t in tenants:
            print(f"    • id={t[0]} name={t[1]} subdomain={t[2]}")
        print("  → Suppression en cours...")
        # La suppression d'un tenant est cascade — supprime aussi les écoles,
        # users, subscriptions, etc. liés à ce tenant.
        cur.execute("""
            DELETE FROM tenants
            WHERE name ILIKE '%academia helm%'
               OR subdomain ILIKE '%academia%helm%';
        """)
        print(f"  ✅ {cur.rowcount} tenant(s) supprimé(s)")
    else:
        print("  ✅ Aucun tenant 'Academia Helm' trouvé — rien à supprimer.")
    print()

    # ─── Supprimer les paiements liés au draft Academia Helm ──────────
    print("=" * 70)
    print("Suppression des paiements de test 'Academia Helm'")
    print("=" * 70)
    cur.execute("""
        SELECT id, reference, status, amount FROM onboarding_payments
        WHERE draft_id IN (
            SELECT id FROM onboarding_drafts
            WHERE school_name ILIKE '%academia helm%'
               OR preferred_subdomain ILIKE '%academia%helm%'
        );
    """)
    payments = cur.fetchall()
    if payments:
        print(f"  {len(payments)} paiement(s) à supprimer :")
        for p in payments:
            print(f"    • id={p[0]} reference={p[1]} status={p[2]} amount={p[3]}")
        cur.execute("""
            DELETE FROM onboarding_payments
            WHERE draft_id IN (
                SELECT id FROM onboarding_drafts
                WHERE school_name ILIKE '%academia helm%'
                   OR preferred_subdomain ILIKE '%academia%helm%'
            );
        """)
        print(f"  ✅ {cur.rowcount} paiement(s) supprimé(s)")
    else:
        print("  ✅ Aucun paiement à supprimer.")
    print()

    # ─── Supprimer les OTPs liés au draft Academia Helm ───────────────
    print("=" * 70)
    print("Suppression des OTPs de test 'Academia Helm'")
    print("=" * 70)
    cur.execute("""
        DELETE FROM onboarding_otps
        WHERE draft_id IN (
            SELECT id FROM onboarding_drafts
            WHERE school_name ILIKE '%academia helm%'
               OR preferred_subdomain ILIKE '%academia%helm%'
        );
    """)
    print(f"  ✅ {cur.rowcount} OTP(s) supprimé(s)")
    print()

    # ─── Supprimer le draft Academia Helm ─────────────────────────────
    print("=" * 70)
    print("Suppression du draft 'Academia Helm'")
    print("=" * 70)
    cur.execute("""
        SELECT id, school_name, status FROM onboarding_drafts
        WHERE school_name ILIKE '%academia helm%'
           OR preferred_subdomain ILIKE '%academia%helm%';
    """)
    drafts = cur.fetchall()
    if drafts:
        for d in drafts:
            print(f"  • id={d[0]} school_name={d[1]} status={d[2]}")
        cur.execute("""
            DELETE FROM onboarding_drafts
            WHERE school_name ILIKE '%academia helm%'
               OR preferred_subdomain ILIKE '%academia%helm%';
        """)
        print(f"  ✅ {cur.rowcount} draft(s) supprimé(s)")
    else:
        print("  ✅ Aucun draft 'Academia Helm' à supprimer.")
    print()

    # ─── Bonus : supprimer aussi le draft "Test Ecole Email OTP" ──────
    print("=" * 70)
    print("Nettoyage bonus : draft 'Test Ecole Email OTP'")
    print("=" * 70)
    cur.execute("""
        SELECT id, school_name, status FROM onboarding_drafts
        WHERE school_name ILIKE '%test ecole email%';
    """)
    test_drafts = cur.fetchall()
    if test_drafts:
        for d in test_drafts:
            print(f"  • id={d[0]} school_name={d[1]} status={d[2]}")
        # D'abord supprimer les OTPs et paiements liés
        cur.execute("""
            DELETE FROM onboarding_otps
            WHERE draft_id IN (
                SELECT id FROM onboarding_drafts
                WHERE school_name ILIKE '%test ecole email%'
            );
        """)
        cur.execute("""
            DELETE FROM onboarding_payments
            WHERE draft_id IN (
                SELECT id FROM onboarding_drafts
                WHERE school_name ILIKE '%test ecole email%'
            );
        """)
        cur.execute("""
            DELETE FROM onboarding_drafts
            WHERE school_name ILIKE '%test ecole email%';
        """)
        print(f"  ✅ {cur.rowcount} draft(s) de test supprimé(s)")
    else:
        print("  ✅ Aucun draft de test à supprimer.")
    print()

    # ─── Vérification finale ──────────────────────────────────────────
    print("=" * 70)
    print("Vérification finale")
    print("=" * 70)
    cur.execute("""
        SELECT COUNT(*) FROM onboarding_drafts
        WHERE school_name ILIKE '%academia helm%';
    """)
    count = cur.fetchone()[0]
    print(f"  Drafts 'Academia Helm' restants : {count}")

    cur.execute("""
        SELECT COUNT(*) FROM onboarding_payments p
        JOIN onboarding_drafts d ON d.id = p.draft_id
        WHERE d.school_name ILIKE '%academia helm%';
    """)
    count = cur.fetchone()[0]
    print(f"  Paiements 'Academia Helm' restants : {count}")

    cur.execute("""
        SELECT COUNT(*) FROM tenants
        WHERE name ILIKE '%academia helm%';
    """)
    count = cur.fetchone()[0]
    print(f"  Tenants 'Academia Helm' restants : {count}")

    print("\n✅ Nettoyage terminé. La DB est prête pour un nouveau test.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
