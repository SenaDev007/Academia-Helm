-- ============================================================================
-- ANNEXES D'ONBOARDING — Multi-écoles dès le signup (promoteur groupe)
-- ============================================================================
--
-- Le promoteur peut déclarer ses écoles annexes DÈS l'onboarding (étape 1) :
-- chaque annexe a son propre nom et sa propre ville (quartier/ville différente
-- — exigence métier). Le champ `annexes` (JSON) stocke la liste déclarée :
--
--   annexes = [ { "name": "Annexe B", "city": "N'Dali" }, ... ]
--
-- Lu par OnboardingService.activate() : le tenant i (i > 0) prend le nom et la
-- ville de l'annexe i-1 si présents (fallback historique : nom principal +
-- suffixe « - Annexe N », ville du draft principal). Chaque école créée reste
-- un tenant isolé (miroir mono-école) et le promoteur est lié à chacune via
-- user_tenants (migration 20260908000000).
--
-- ⭐ Idempotent (ADD COLUMN IF NOT EXISTS) — sans risque si re-jouée.
-- ============================================================================

ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "annexes" JSONB;
