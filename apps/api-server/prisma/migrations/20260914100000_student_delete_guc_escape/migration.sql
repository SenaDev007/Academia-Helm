-- ============================================================================
-- Migration : Autoriser la suppression physique d'élèves via drapeau applicatif
-- Date : 2026-09-14
-- Contexte (retour terrain CSPEB) :
--   Le wizard d'inscription est une orchestration frontend en 3 appels
--   (preRegister → admit → guardians). Si la connexion tombe entre deux
--   appels, l'élève reste dans un état incomplet (pas de matricule, pas de
--   compte financier, pas de statut ADMITTED). La secrétaire doit alors
--   SUPPRIMER l'élève pour reprendre le processus.
--
--   Or le trigger trg_prevent_student_delete bloque INCONDITIONNELLEMENT
--   tout DELETE sur students → l'endpoint /students/delete-student échoue
--   toujours en production (erreur 500) et l'élève « revient » car il n'a
--   jamais été supprimé.
--
-- Stratégie (identique à app.allow_balance_update / app.allow_transaction_delete) :
--   Le service deleteStudent vérifie d'abord les garde-fous métier
--   (statuts PRE_REGISTERED/ADMITTED uniquement, zéro paiement) puis pose
--   le drapeau transaction-local `app.allow_student_delete = 'true'` avant
--   le DELETE. Le trigger honore ce drapeau ; tout autre DELETE direct
--   (psql, script, erreur humaine) reste bloqué.
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_student_delete()
RETURNS TRIGGER AS $$
DECLARE
  allow_delete text;
BEGIN
  -- Drapeau posé UNIQUEMENT par le service applicatif deleteStudent,
  -- à l'intérieur de sa transaction, après les vérifications métier.
  allow_delete := current_setting('app.allow_student_delete', true);

  IF allow_delete IS NOT NULL AND allow_delete = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Suppression physique interdite. Utiliser is_active = false ou status = WITHDRAWN. La suppression définitive passe exclusivement par le service applicatif (POST /students/delete-student).';
END;
$$ LANGUAGE plpgsql;
