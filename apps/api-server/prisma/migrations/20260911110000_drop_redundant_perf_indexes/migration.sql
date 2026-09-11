-- ⭐ BRIEF PERF — Nettoyage des index redondants introduits par 20260911100000
--
-- 1. finance_transactions_tenantId_academicYearId_createdAt_idx : DOUBLON de
--    finance_transactions_tenant_year_created_idx (20260907120000 — mêmes
--    colonnes, tri DESC). Un seul index suffit pour la pagination.
-- 2. finance_transactions_tenantId_receiptNumber_idx : redondant avec
--    l'index UNIQUE finance_transactions_receiptNumber_key (receiptNumber
--    seul est déjà totalement sélectif).
-- 3. grades_classId_idx : redondant avec grades_classId_status_idx
--    (préfixe identique — un composite (classId, status) couvre classId seul).
--
-- Chaque index redondant = une écriture supplémentaire par INSERT/UPDATE
-- (WAL + maintenance VACUUM) — contraire à l'objectif performance.
--
-- ⚠️ Index déjà supprimés en production Neon le 2026-09-11 (script
-- scripts/drop_redundant_indexes.js) — cette migration documente l'opération
-- pour les environnements neufs (idempotent).
DROP INDEX IF EXISTS "finance_transactions_tenantId_academicYearId_createdAt_idx";
DROP INDEX IF EXISTS "finance_transactions_tenantId_receiptNumber_idx";
DROP INDEX IF EXISTS "grades_classId_idx";
