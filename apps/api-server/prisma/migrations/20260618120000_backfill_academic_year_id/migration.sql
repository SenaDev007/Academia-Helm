-- ============================================================================
-- Migration : backfill_academic_year_id
-- ============================================================================
-- Backfill les champs academicYearId NULL avec l'année active du tenant.
--
-- Cette migration prépare le terrain pour le mode "année stricte" en s'assurant
-- qu'aucune ligne métier n'a un academicYearId NULL.
--
-- ⚠️ ÉTAPE SÉCURISÉE : Cette migration ne fait que du backfill (UPDATE).
-- Elle ne modifie pas le schéma (pas de ALTER COLUMN SET NOT NULL).
-- Le NOT NULL sera appliqué dans une migration ultérieure après validation
-- que toutes les lignes ont bien été backfillées.
--
-- Stratégie :
-- 1. Pour chaque table avec academicYearId nullable, backfill avec l'année
--    active du tenant (celle qui a isActive=true).
-- 2. Si le tenant n'a pas d'année active, on prend la plus récente.
-- 3. Si le tenant n'a aucune année, on laisse NULL (cas exceptionnel).
-- ============================================================================

-- Helper : créer une fonction pour récupérer l'année active d'un tenant
CREATE OR REPLACE FUNCTION get_active_academic_year_id(p_tenant_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_year_id TEXT;
BEGIN
  -- Priorité 1 : année active (isActive = true)
  SELECT id INTO v_year_id
  FROM "academic_years"
  WHERE "tenantId" = p_tenant_id AND "isActive" = true
  LIMIT 1;

  -- Priorité 2 : année la plus récente si aucune active
  IF v_year_id IS NULL THEN
    SELECT id INTO v_year_id
    FROM "academic_years"
    WHERE "tenantId" = p_tenant_id
    ORDER BY "startDate" DESC
    LIMIT 1;
  END IF;

  RETURN v_year_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BACKFILL DES TABLES MÉTIER AVEC academicYearId NULL
-- ============================================================================

-- Payments (critique : un paiement sans année est incohérent)
UPDATE "payments" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- Fee configurations
UPDATE "fee_configurations" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- Expenses
UPDATE "finance_expenses" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- Expense categories
UPDATE "expense_categories" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- Messages
UPDATE "messages" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- Financial settings
UPDATE "financial_settings" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- Generated documents
UPDATE "generated_documents" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- GED documents
UPDATE "ged_documents" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- GED document versions
UPDATE "ged_document_versions" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- ============================================================================
-- MODULES COMPLÉMENTAIRES (cantine, transport, library, infirmary, etc.)
-- ============================================================================

-- Canteen
UPDATE "canteen_attendances" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "canteen_subscriptions" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "canteen_meal_services" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "canteen_reports" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- Transport
UPDATE "transport_zones" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "transport_trip_events" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- Library
UPDATE "library_reports" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- Infirmary
UPDATE "infirmary_reports" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- EduCast
UPDATE "educast_reports" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- QHSE
UPDATE "qhse_reports" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- ============================================================================
-- ORION / KPIs
-- ============================================================================

UPDATE "kpi_snapshots" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "orion_alerts" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "orion_reports" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "orion_insights" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- ============================================================================
-- STAFF / HR
-- ============================================================================

-- Note : Staff, Teacher, Room restent nullable car ce sont des ressources
-- permanentes qui ne sont pas liées à une année spécifique.
-- Seules les données opérationnelles (contracts, allowances, training) sont backfillées.

UPDATE "staff_allowances" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "staff_trainings" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "training_sessions" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- ============================================================================
-- ATLAS / SARA (chatbots IA)
-- ============================================================================

UPDATE "atlas_conversations" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "atlas_messages" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "atlas_feedback" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- ============================================================================
-- AUDIT / LOGS
-- ============================================================================

UPDATE "academic_audit_logs" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "activity_logs" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;
UPDATE "communication_stats" SET "academicYearId" = get_active_academic_year_id("tenantId")
WHERE "academicYearId" IS NULL AND "tenantId" IS NOT NULL;

-- ============================================================================
-- Nettoyage : supprimer la fonction helper
-- ============================================================================

DROP FUNCTION IF EXISTS get_active_academic_year_id(TEXT);

-- ============================================================================
-- VÉRIFICATION : compter les lignes encore NULL (devrait être 0 ou quasi 0)
-- ============================================================================

-- Cette requête de vérification peut être exécutée manuellement après la migration
-- pour s'assurer que le backfill a bien fonctionné :
--
-- SELECT
--   (SELECT COUNT(*) FROM payments WHERE "academicYearId" IS NULL) AS payments_null,
--   (SELECT COUNT(*) FROM fee_configurations WHERE "academicYearId" IS NULL) AS fee_configs_null,
--   (SELECT COUNT(*) FROM finance_expenses WHERE "academicYearId" IS NULL) AS expenses_null,
--   (SELECT COUNT(*) FROM messages WHERE "academicYearId" IS NULL) AS messages_null;
