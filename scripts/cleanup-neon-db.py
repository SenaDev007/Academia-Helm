#!/usr/bin/env python3
"""
Nettoie les données de test "Academia Helm" dans la DB Neon.
Supprime en cascade : HelmSubscription, School, User, OnboardingPayment,
OnboardingOTP, OnboardingDraft, et enfin le Tenant.
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

    # ─── Trouver les tenant IDs Academia Helm ──────────────────────────
    cur.execute("""
        SELECT id, name, subdomain FROM tenants
        WHERE name ILIKE '%academia helm%'
           OR subdomain ILIKE '%academia%helm%';
    """)
    tenants = cur.fetchall()
    if not tenants:
        print("✅ Aucun tenant 'Academia Helm' trouvé — rien à supprimer.")
        cur.close()
        conn.close()
        return

    tenant_ids = [t[0] for t in tenants]
    print(f"⚠️  {len(tenants)} tenant(s) à supprimer :")
    for t in tenants:
        print(f"  • id={t[0]} name={t[1]} subdomain={t[2]}")
    print()

    # ─── Supprimer en cascade (ordre inverse des dépendances) ──────────
    # On essaie chaque table — si elle n'existe pas ou n'a pas tenantId, on ignore.
    cleanup_steps = [
        ('"HelmSubscription"', '"tenantId"'),
        ('"BillingEvent"', '"tenantId"'),
        ('billing_events', '"tenantId"'),
        ('school_settings', '"tenantId"'),
        ('schools', '"tenantId"'),
        ('users', '"tenantId"'),
        ('school_subdomains', '"tenantId"'),
        ('subscription_plans', '"tenantId"'),
    ]
    for table, col in cleanup_steps:
        try:
            cur.execute(f"DELETE FROM {table} WHERE {col} = ANY(%s);", (tenant_ids,))
            if cur.rowcount > 0:
                print(f"  ✅ {cur.rowcount} enregistrement(s) supprimé(s) dans {table}")
        except Exception as e:
            # Table n'existe pas ou colonne absente — ignorer
            pass

    # OnboardingPayment, OnboardingOTP, OnboardingDraft (liés par draft, pas tenant)
    print("→ Suppression OnboardingPayment (via draft)...")
    cur.execute("""
        DELETE FROM onboarding_payments
        WHERE draft_id IN (
            SELECT id FROM onboarding_drafts
            WHERE school_name ILIKE '%academia helm%'
               OR preferred_subdomain ILIKE '%academia%helm%'
        );
    """)
    print(f"  ✅ {cur.rowcount} OnboardingPayment(s) supprimé(s)")

    print("→ Suppression OnboardingOTP...")
    cur.execute("""
        DELETE FROM onboarding_otps
        WHERE draft_id IN (
            SELECT id FROM onboarding_drafts
            WHERE school_name ILIKE '%academia helm%'
               OR preferred_subdomain ILIKE '%academia%helm%'
        );
    """)
    print(f"  ✅ {cur.rowcount} OnboardingOTP(s) supprimé(s)")

    print("→ Suppression OnboardingDraft...")
    cur.execute("""
        DELETE FROM onboarding_drafts
        WHERE school_name ILIKE '%academia helm%'
           OR preferred_subdomain ILIKE '%academia%helm%';
    """)
    print(f"  ✅ {cur.rowcount} OnboardingDraft(s) supprimé(s)")

    print("→ Suppression Tenant...")
    cur.execute("""
        DELETE FROM tenants
        WHERE name ILIKE '%academia helm%'
           OR subdomain ILIKE '%academia%helm%';
    """)
    print(f"  ✅ {cur.rowcount} Tenant(s) supprimé(s)")
    print()

    # ─── Vérification finale ──────────────────────────────────────────
    print("=" * 60)
    print("Vérification finale")
    print("=" * 60)
    cur.execute("SELECT COUNT(*) FROM tenants WHERE name ILIKE '%academia helm%';")
    print(f"  Tenants 'Academia Helm' restants : {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM onboarding_drafts WHERE school_name ILIKE '%academia helm%';")
    print(f"  Drafts 'Academia Helm' restants : {cur.fetchone()[0]}")
    cur.execute("""
        SELECT COUNT(*) FROM onboarding_payments p
        JOIN onboarding_drafts d ON d.id = p.draft_id
        WHERE d.school_name ILIKE '%academia helm%';
    """)
    print(f"  Paiements 'Academia Helm' restants : {cur.fetchone()[0]}")
    print("\n✅ Nettoyage terminé. La DB est prête pour un nouveau test.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
