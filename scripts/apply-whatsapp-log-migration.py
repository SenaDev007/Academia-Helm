#!/usr/bin/env python3
"""
Academia Helm - Migration WhatsappLog
======================================
Applique la migration pour étendre la table whatsapp_logs avec les nouveaux
champs de catégorisation (mirror EmailLog).

Run:
  DATABASE_URL="postgresql://..." python3 apply-whatsapp-log-migration.py
"""

import os
import sys
import psycopg2

# Lire l'URL depuis env
DB_URL = os.environ.get('DATABASE_URL')
if not DB_URL:
    print("ERROR: DATABASE_URL env var required")
    sys.exit(1)

# SQL de migration (idempotent - utilise IF NOT EXISTS)
MIGRATION_SQL = """
-- ============================================================================
-- Migration: Extend WhatsappLog with categorization fields (mirror EmailLog)
-- Date: 2026-07-02
-- Purpose: Add tracing/categorization fields to whatsapp_logs table
-- ============================================================================

-- Add new columns (idempotent - using IF NOT EXISTS for safety)
ALTER TABLE "whatsapp_logs"
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "subCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "module" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientName" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientType" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientId" TEXT,
  ADD COLUMN IF NOT EXISTS "fromPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "templateId" TEXT,
  ADD COLUMN IF NOT EXISTS "templateLanguage" TEXT,
  ADD COLUMN IF NOT EXISTS "threadId" TEXT,
  ADD COLUMN IF NOT EXISTS "triggeredBy" TEXT,
  ADD COLUMN IF NOT EXISTS "triggeredByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedEntityType" TEXT;

-- Update default for status (was TEXT NOT NULL, ensure default PENDING)
ALTER TABLE "whatsapp_logs"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Add new indexes (idempotent)
CREATE INDEX IF NOT EXISTS "whatsapp_logs_tenantId_category_idx"
  ON "whatsapp_logs" ("tenantId", "category");

CREATE INDEX IF NOT EXISTS "whatsapp_logs_tenantId_recipient_idx"
  ON "whatsapp_logs" ("tenantId", "recipient");

CREATE INDEX IF NOT EXISTS "whatsapp_logs_tenantId_module_idx"
  ON "whatsapp_logs" ("tenantId", "module");

CREATE INDEX IF NOT EXISTS "whatsapp_logs_threadId_idx"
  ON "whatsapp_logs" ("threadId");

CREATE INDEX IF NOT EXISTS "whatsapp_logs_tenantId_createdAt_idx"
  ON "whatsapp_logs" ("tenantId", "createdAt");
"""


def main():
    print(f"Connecting to: {DB_URL.split('@')[1].split('/')[0]}")
    try:
        conn = psycopg2.connect(DB_URL, connect_timeout=15)
        conn.autocommit = False
    except Exception as e:
        print(f"ERROR: Connection failed: {e}")
        sys.exit(1)

    cur = conn.cursor()

    try:
        # Execute the entire migration as one transaction (psycopg2 handles multi-statement)
        # Just filter out comment-only lines for cleaner logging
        print(f"\nExecuting migration SQL...\n")
        print(MIGRATION_SQL)

        try:
            cur.execute(MIGRATION_SQL)
        except Exception as e:
            print(f"ERROR: {e}")
            conn.rollback()
            sys.exit(1)

        conn.commit()
        print(f"\n✅ Migration appliquée avec succès")

    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()

    # ─── Vérification post-migration ──────────────────────────────────────
    print("\n" + "=" * 60)
    print("VÉRIFICATION POST-MIGRATION")
    print("=" * 60)

    conn = psycopg2.connect(DB_URL, connect_timeout=15)
    cur = conn.cursor()

    # Vérifier les colonnes
    cur.execute("""
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'whatsapp_logs'
        ORDER BY ordinal_position;
    """)
    cols = cur.fetchall()
    print(f"\n📊 Colonnes ({len(cols)}):")
    for col_name, col_type, col_default in cols:
        default_str = f" DEFAULT={col_default}" if col_default else ""
        print(f"  • {col_name}: {col_type}{default_str}")

    # Vérifier les indexes
    cur.execute("""
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'whatsapp_logs'
        ORDER BY indexname;
    """)
    indexes = cur.fetchall()
    print(f"\n📊 Indexes ({len(indexes)}):")
    for (idx_name,) in indexes:
        print(f"  • {idx_name}")

    cur.close()
    conn.close()

    print("\n🎉 Migration terminée avec succès !")


if __name__ == "__main__":
    main()
