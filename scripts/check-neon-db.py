#!/usr/bin/env python3
"""
Vérifie si le tenant "Academia Helm" existe dans la DB Neon et affiche
les tenants / paiements / drafts récents pour diagnostic.
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

    # ─── ÉTAPE 1 : Lister les tenants récents ─────────────────────────
    print("=" * 70)
    print("ÉTAPE 1 : Tenants récents (10 derniers)")
    print("=" * 70)
    try:
        cur.execute("""
            SELECT id, name, slug, subdomain, "createdAt"
            FROM tenants
            ORDER BY "createdAt" DESC
            LIMIT 10;
        """)
        rows = cur.fetchall()
        if not rows:
            print("  (aucun tenant trouvé)")
        else:
            for r in rows:
                print(f"  • id={r[0]}")
                print(f"    name={r[1]}")
                print(f"    slug={r[2]}")
                print(f"    subdomain={r[3]}")
                print(f"    createdAt={r[4]}")
                print()
    except Exception as e:
        print(f"  ❌ Erreur: {e}\n")

    # ─── ÉTAPE 2 : Lister les paiements d'onboarding récents ─────────
    print("=" * 70)
    print("ÉTAPE 2 : Paiements d'onboarding récents (10 derniers)")
    print("=" * 70)
    try:
        cur.execute("""
            SELECT
                p.id,
                p.reference,
                p.status,
                p.amount,
                p.created_at,
                d.school_name,
                d.promoter_email,
                d.preferred_subdomain,
                (p.metadata->>'firstTenantSubdomain') AS activated_subdomain
            FROM onboarding_payments p
            JOIN onboarding_drafts d ON d.id = p.draft_id
            ORDER BY p.created_at DESC
            LIMIT 10;
        """)
        rows = cur.fetchall()
        if not rows:
            print("  (aucun paiement trouvé)")
        else:
            for r in rows:
                print(f"  • payment_id={r[0]}")
                print(f"    reference={r[1]}")
                print(f"    status={r[2]}")
                print(f"    amount={r[3]}")
                print(f"    createdAt={r[4]}")
                print(f"    schoolName={r[5]}")
                print(f"    promoterEmail={r[6]}")
                print(f"    preferredSubdomain={r[7]}")
                print(f"    activated_subdomain={r[8]}")
                print()
    except Exception as e:
        print(f"  ❌ Erreur: {e}\n")

    # ─── ÉTAPE 3 : Lister les drafts récents ──────────────────────────
    print("=" * 70)
    print("ÉTAPE 3 : Drafts d'onboarding récents (10 derniers)")
    print("=" * 70)
    try:
        cur.execute("""
            SELECT
                id,
                school_name,
                promoter_email,
                preferred_subdomain,
                status,
                created_at
            FROM onboarding_drafts
            ORDER BY created_at DESC
            LIMIT 10;
        """)
        rows = cur.fetchall()
        if not rows:
            print("  (aucun draft trouvé)")
        else:
            for r in rows:
                print(f"  • id={r[0]}")
                print(f"    schoolName={r[1]}")
                print(f"    promoterEmail={r[2]}")
                print(f"    preferredSubdomain={r[3]}")
                print(f"    status={r[4]}")
                print(f"    createdAt={r[5]}")
                print()
    except Exception as e:
        print(f"  ❌ Erreur: {e}\n")

    # ─── ÉTAPE 4 : Vérifier spécifiquement le tenant Academia Helm ────
    print("=" * 70)
    print("ÉTAPE 4 : Recherche du tenant 'Academia Helm'")
    print("=" * 70)
    try:
        cur.execute("""
            SELECT id, name, slug, subdomain, "createdAt"
            FROM tenants
            WHERE name ILIKE '%academia helm%'
               OR subdomain ILIKE '%academia%helm%'
               OR slug ILIKE '%academia%helm%';
        """)
        rows = cur.fetchall()
        if not rows:
            print("  ✅ Aucun tenant 'Academia Helm' trouvé — la DB est propre.")
        else:
            print(f"  ⚠️  {len(rows)} tenant(s) 'Academia Helm' trouvé(s) :")
            for r in rows:
                print(f"    • id={r[0]}")
                print(f"      name={r[1]}")
                print(f"      slug={r[2]}")
                print(f"      subdomain={r[3]}")
                print(f"      createdAt={r[4]}")
                print()
            print("  → Ces tenant(s) seront supprimés à l'étape 5.")
    except Exception as e:
        print(f"  ❌ Erreur: {e}\n")

    cur.close()
    conn.close()
    print("\n✅ Vérification terminée.")


if __name__ == "__main__":
    main()
