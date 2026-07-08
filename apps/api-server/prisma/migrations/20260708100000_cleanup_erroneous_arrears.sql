-- ============================================================================
-- Migration : Nettoyage des FeeArrear erronés créés par l'ancienne détection
-- ============================================================================
-- L'ancienne version de detectArrears() créait un FeeArrear pour CHAQUE élève
-- avec balance > 0 sur l'année courante (94 élèves), ce qui faussait toutes
-- les statistiques du tableau de bord Recouvrement.
--
-- Cette migration supprime ces FeeArrear erronés (identifiés par leur note)
-- pour ne garder que les VRAIS arriérés :
--   - Arriérés manuels (saisis par l'utilisateur)
--   - Arriérés reportés d'années antérieures (carriedArrears)
--   - Arriérés sur années clôturées
-- ============================================================================

-- Supprimer les FeeArrear créés par l'ancienne détection automatique
-- (note : 'Détecté automatiquement depuis le solde du compte élève')
DELETE FROM fee_arrears
WHERE notes = 'Détecté automatiquement depuis le solde du compte élève';

-- Aussi supprimer ceux qui n'ont ni studentFeeId ni carriedArrears associé
-- et qui ont été créés sur l'année courante (non clôturée)
-- Attention : on ne supprime que ceux sans studentFeeId (arriérés globaux)
-- qui sont sur une année NON clôturée et sans carriedArrears sur le StudentAccount
DELETE FROM fee_arrears
WHERE student_fee_id IS NULL
  AND notes LIKE 'Détecté automatiquement%'
  AND academic_year_id IN (
    SELECT id FROM academic_years WHERE is_closed = false
  );
