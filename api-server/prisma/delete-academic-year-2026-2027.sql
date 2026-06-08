-- ============================================================================
-- SUPPRIMER L'ANNÉE SCOLAIRE 2026-2027
-- ============================================================================
-- 
-- Script SQL pour supprimer l'année scolaire 2026-2027 du tenant CSPEB
-- Exécuter ce script dans pgAdmin 4 Query Tool
-- 
-- ============================================================================

-- Méthode 1: Supprimer par ID (plus sûr)
-- Si vous connaissez l'ID de l'année scolaire à supprimer
-- Décommentez la ligne suivante et remplacez 'academic-year-id' par l'ID réel:
-- DELETE FROM academic_years WHERE id = 'academic-year-id';

-- Méthode 2: Supprimer par nom et tenant (recommandé)
DELETE FROM academic_years 
WHERE "tenantId" = (SELECT id FROM tenants WHERE slug = 'cspeb-eveil-afrique')
  AND name = '2026-2027';

-- Vérifier la suppression
SELECT 
  '✅ Année scolaire 2026-2027 supprimée' as message,
  COUNT(*) as annees_scolaires_restantes
FROM academic_years 
WHERE "tenantId" = (SELECT id FROM tenants WHERE slug = 'cspeb-eveil-afrique');
