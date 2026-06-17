-- ============================================================================
-- 20260617000000_delete_mock_reviews
-- ----------------------------------------------------------------------------
-- Supprime les anciens avis mock (seed-helm-review-*) de la table reviews.
-- Ces avis étaient insérés par prisma/seed.ts pour la démonstration, mais
-- l'utilisateur a demandé qu'aucune donnée mock ne figure sur le landing page.
-- La section "avis" du landing page est maintenant alimentée uniquement par
-- les avis réels déposés par les établissements (auto-approuvés quand
-- tenantId valide) ou par les enseignants/parents (modération admin).
-- ============================================================================

DELETE FROM "reviews"
WHERE "id" IN ('seed-helm-review-1', 'seed-helm-review-2', 'seed-helm-review-3');
