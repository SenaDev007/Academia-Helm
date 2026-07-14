#!/usr/bin/env python3
"""Vérifie les plans de tarification dans la DB Neon."""

import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require"

def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    # Trouver la table pricing_plans (peut être "PricingPlan" ou "pricing_plans")
    print("=" * 70)
    print("Recherche de la table pricing_plans")
    print("=" * 70)
    for table_name in ['pricing_plans', '"PricingPlan"', '"pricing_plans"']:
        try:
            cur.execute(f"SELECT id, code, name, student_min, student_max FROM {table_name} ORDER BY student_min;")
            rows = cur.fetchall()
            if rows:
                print(f"\n✅ Table trouvée : {table_name}")
                print(f"{'ID':<40} {'CODE':<10} {'NAME':<50} {'MIN':<5} {'MAX':<5}")
                print("-" * 115)
                for r in rows:
                    max_str = str(r[4]) if r[4] else '∞'
                    print(f"{str(r[0]):<40} {str(r[1] or ''):<10} {str(r[2] or ''):<50} {str(r[3] or ''):<5} {max_str:<5}")
                break
        except Exception as e:
            pass
    else:
        print("❌ Table pricing_plans introuvable. Recherche de tables contenant 'plan'...")
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name ILIKE '%plan%';
        """)
        for r in cur.fetchall():
            print(f"  → {r[0]}")

    # Vérifier aussi le priceSnapshot du draft Academia Helm (s'il existe encore)
    print("\n" + "=" * 70)
    print("priceSnapshot des drafts récents")
    print("=" * 70)
    try:
        cur.execute("""
            SELECT school_name, preferred_subdomain, price_snapshot
            FROM onboarding_drafts
            ORDER BY created_at DESC LIMIT 3;
        """)
        rows = cur.fetchall()
        import json
        for r in rows:
            print(f"\n  school_name: {r[0]}")
            print(f"  preferred_subdomain: {r[1]}")
            if r[2]:
                snap = r[2] if isinstance(r[2], dict) else json.loads(r[2])
                print(f"  priceSnapshot:")
                print(f"    planCode: {snap.get('planCode', 'N/A')}")
                print(f"    planName: {snap.get('planName', 'N/A')}")
                print(f"    planId: {snap.get('planId', 'N/A')}")
                print(f"    periodType: {snap.get('periodType', 'N/A')}")
                print(f"    schoolsCount: {snap.get('schoolsCount', 'N/A')}")
                print(f"    initialPayment: {snap.get('initialPayment', 'N/A')}")
                print(f"    monthlyPrice: {snap.get('monthlyPrice', 'N/A')}")
                print(f"    yearlyPrice: {snap.get('yearlyPrice', 'N/A')}")
            else:
                print(f"  priceSnapshot: NULL")
    except Exception as e:
        print(f"❌ Erreur: {e}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
