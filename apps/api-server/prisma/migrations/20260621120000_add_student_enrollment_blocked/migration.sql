-- ============================================================================
-- Migration: 20260621080000_add_student_enrollment_blocked
-- ============================================================================
-- Ajoute un champ `studentEnrollmentBlocked` au modèle Tenant (table "tenants").
--
-- Ce champ est utilisé par StudentCountVerifierService pour bloquer l'ajout
-- de nouveaux élèves lorsque le nombre réel d'élèves dépasse la limite du plan
-- d'abonnement ET que la période de grâce de 7 jours est expirée sans upgrade.
--
-- Contrairement à `tenant.status = 'suspended'` (utilisé pour le blocage
-- billing), ce champ est orthogonal : il ne bloque QUE l'ajout d'élèves,
-- pas l'accès à la plateforme.
--
-- Valeurs :
--   false (défaut) — ajout d'élèves autorisé
--   true            — ajout d'élèves bloqué (l'école doit upgrader son plan)
-- ============================================================================

-- Note: la table s'appelle "tenants" (minuscules) en DB car le modèle Prisma
-- `Tenant` est mappé via @@map("tenants") dans le schema.prisma.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "studentEnrollmentBlocked" BOOLEAN NOT NULL DEFAULT false;

-- Index pour permettre une vérification rapide
CREATE INDEX IF NOT EXISTS "tenants_studentEnrollmentBlocked_idx" ON "tenants"("studentEnrollmentBlocked");
