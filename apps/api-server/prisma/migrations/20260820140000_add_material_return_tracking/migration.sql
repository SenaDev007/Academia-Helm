-- ⭐ Suivi des retours de matériel pédagogique en fin d'année
--    Permet à l'enseignant de :
--    1. Voir tout le matériel qu'il a reçu en début d'année
--    2. Cocher ce qu'il a retourné (par item, avec quantité + état)
--    3. Signer (signature pad → base64)
--    4. Cliquer "Envoyer" → notifie la direction
--    5. La direction valide / refuse dans son UI
--
--    Workflow de retour :
--      PENDING (par défaut) → SUBMITTED (enseignant a cliqué Envoyer)
--                          → VALIDATED / REJECTED (direction)
--
--    Champs ajoutés à teacher_material_assignments :
--    - returnQuantity       : combien d'items retournés
--    - returnCondition     : état au retour (NEW | GOOD | USED | DAMAGED | LOST)
--    - returnStatus        : PENDING | SUBMITTED | VALIDATED | REJECTED
--    - returnNotes         : notes de l'enseignant
--    - returnSignatureUrl : signature base64 de l'enseignant (confirmation retour)
--    - returnSentAt        : date du clic "Envoyer"
--    - returnValidatedAt   : date de validation direction
--    - returnValidatedBy   : userId du directeur
--    - returnRejectionReason : motif de refus
--    - lostQuantity        : calculé = quantity - returnQuantity (matériel non rendu)
--    - lostNotes           : notes du directeur sur les pertes

ALTER TABLE "teacher_material_assignments"
  ADD COLUMN IF NOT EXISTS "returnQuantity" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "returnCondition" TEXT,
  ADD COLUMN IF NOT EXISTS "returnStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "returnNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "returnSignatureUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "returnSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "returnValidatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "returnValidatedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "returnRejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "lostQuantity" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lostNotes" TEXT;

-- Index pour filtrer rapidement les retours par statut
CREATE INDEX IF NOT EXISTS "teacher_material_assignments_return_status_idx"
  ON "teacher_material_assignments" ("returnStatus");

-- Index pour la vue "à valider" côté direction
CREATE INDEX IF NOT EXISTS "teacher_material_assignments_return_pending_idx"
  ON "teacher_material_assignments" ("tenantId", "academicYearId", "returnStatus")
  WHERE "returnStatus" = 'SUBMITTED';
