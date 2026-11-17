-- ============================================================================
-- Verrou anti-exécutions simultanées de l'import en masse d'élèves
-- ----------------------------------------------------------------------------
-- Incident du 17/11/2026 (tenant MON AVENIR PLUS) : deux exécutions
-- CONCURRENTES de POST /students/import/run (double soumission / deux onglets)
-- ont créé 93 lignes en double — chaque preview voit « aucun élève existant »
-- avant que l'autre exécution n'ait créé les fiches, donc les deux créent tout.
--
-- Verrou applicatif par tenant : une ligne par tenant dans import_run_locks.
--   INSERT ... ON CONFLICT DO UPDATE ... WHERE (verrou périmé > 10 min)
--   → renvoie 1 = verrou acquis / rafraîchi ; 0 = un import est déjà en cours.
-- Le verrou est libéré (DELETE) en fin d'exécution ; un crash laisse un verrou
-- périmé qui se fait racheter automatiquement après 10 minutes.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "import_run_locks" (
    "tenantId"  TEXT PRIMARY KEY,
    "lockedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
