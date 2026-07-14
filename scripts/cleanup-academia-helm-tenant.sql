-- ============================================================================
-- Script de vérification et nettoyage du tenant "Academia Helm" de test
-- ============================================================================
--
-- ⚠️  À EXÉCUTER SUR NEON CONSOLE (https://console.neon.tech) >
--      sélectionner le projet > SQL Editor > coller ce script > Run.
--
-- Ce script :
--   1. Liste les tenants créés récemment (pour vérifier si Academia Helm existe)
--   2. Liste les paiements d'onboarding récents
--   3. Si demandé, supprime le tenant Academia Helm + toutes ses dépendances
--
-- ⚠️  NE PAS EXÉCUTER EN PRODUCTION RÉELLE — réservé aux tests.
-- ============================================================================

-- ─── ÉTAPE 1 : VÉRIFIER LES TENANTS RÉCENTS ─────────────────────────────────
SELECT
  id,
  name,
  slug,
  subdomain,
  "createdAt"
FROM tenants
ORDER BY "createdAt" DESC
LIMIT 10;

-- ─── ÉTAPE 2 : VÉRIFIER LES PAIEMENTS D'ONBOARDING RÉCENTS ─────────────────
SELECT
  p.id AS payment_id,
  p.reference,
  p.status,
  p.amount,
  p."createdAt",
  d."schoolName",
  d."promoterEmail",
  d."preferredSubdomain",
  (p.metadata->>'firstTenantSubdomain') AS activated_subdomain
FROM onboarding_payments p
JOIN onboarding_drafts d ON d.id = p."draftId"
ORDER BY p."createdAt" DESC
LIMIT 10;

-- ─── ÉTAPE 3 : VÉRIFIER LES DRAFTS D'ONBOARDING RÉCENTS ────────────────────
SELECT
  id,
  "schoolName",
  "promoterEmail",
  "preferredSubdomain",
  status,
  "createdAt"
FROM onboarding_drafts
ORDER BY "createdAt" DESC
LIMIT 10;

-- ============================================================================
-- ÉTAPE 4 (OPTIONNELLE) : SUPPRIMER LE TENANT "Academia Helm" DE TEST
-- ============================================================================
--
-- ⚠️  DÉCOMMENTER ET EXÉCUTER UNIQUEMENT SI VOUS VOULEZ SUPPRIMER LE TENANT.
-- Cette suppression est CASCADÉE : elle supprime aussi les écoles, users,
-- subscriptions, etc. liés à ce tenant.
--
-- Remplacez '<TENANT_ID>' par l'ID trouvé à l'étape 1 (ou utilisez le filtre
-- par name/subdomain).
--
-- ----------------------------------------------------------------------------

-- ⚠️  Activer d'abord les contraintes cascade si nécessaire (Neon gère ça
-- automatiquement avec onDelete: Cascade dans Prisma).
--
-- DELETE FROM tenants WHERE name ILIKE '%Academia Helm%' OR subdomain ILIKE '%academia%helm%';
--
-- ⚠️  Vérifier que le tenant a bien été supprimé :
-- SELECT id, name, subdomain FROM tenants WHERE name ILIKE '%Academia Helm%';

-- ============================================================================
-- ÉTAPE 5 (OPTIONNELLE) : NETTOYER LES DRAFTS DE TEST
-- ============================================================================
--
-- Si vous voulez aussi supprimer les drafts de test pour repartir de zéro :
--
-- DELETE FROM onboarding_otps WHERE "draftId" IN (
--   SELECT id FROM onboarding_drafts WHERE "promoterEmail" = 'VOTRE_EMAIL@test.com'
-- );
-- DELETE FROM onboarding_payments WHERE "draftId" IN (
--   SELECT id FROM onboarding_drafts WHERE "promoterEmail" = 'VOTRE_EMAIL@test.com'
-- );
-- DELETE FROM onboarding_drafts WHERE "promoterEmail" = 'VOTRE_EMAIL@test.com';

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================
