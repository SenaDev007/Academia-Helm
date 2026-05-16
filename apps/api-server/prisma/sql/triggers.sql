-- ============================================================================
-- TRIGGERS SQL CRITIQUES - ACADEMIA HUB
-- ============================================================================
-- 
-- Triggers pour appliquer les règles métier critiques qui ne peuvent pas
-- être gérées par Prisma :
-- 
-- 1. Priorité paiement arriérés (allocationOrder)
-- 2. Interdiction suppression paiements
-- 3. Obligation profil tarifaire élève
-- 
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER : Priorité Allocation Paiement (Arriérés en priorité)
-- ----------------------------------------------------------------------------
-- Garantit que les arriérés ont toujours priorité sur les autres allocations
-- RÈGLE : ARREAR (ordre 1) > INSCRIPTION/REINSCRIPTION (ordre 2-10) > SCOLARITE (ordre 11+)
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_check_payment_allocation_priority ON payment_allocations;
CREATE TRIGGER trigger_check_payment_allocation_priority
  BEFORE INSERT OR UPDATE ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION check_payment_allocation_priority();

-- ----------------------------------------------------------------------------
-- 2. TRIGGER : Interdiction Suppression Paiements
-- ----------------------------------------------------------------------------
-- Empêche la suppression de paiements qui ont des allocations ou un reçu
-- RÈGLE : Un paiement avec allocations/reçu ne peut pas être supprimé
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_prevent_payment_deletion ON payments;
CREATE TRIGGER trigger_prevent_payment_deletion
  BEFORE DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_payment_deletion();

-- ----------------------------------------------------------------------------
-- 3. TRIGGER : Obligation Profil Tarifaire Élève
-- ----------------------------------------------------------------------------
-- Garantit qu'un StudentFee ne peut être créé que si l'élève a un profil
-- tarifaire pour l'année scolaire
-- RÈGLE : Chaque élève doit avoir un StudentFeeProfile par année scolaire
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trigger_ensure_student_fee_profile_before_fee ON student_fees;
CREATE TRIGGER trigger_ensure_student_fee_profile_before_fee
  BEFORE INSERT ON student_fees
  FOR EACH ROW
  EXECUTE FUNCTION ensure_student_fee_profile_before_fee();

-- ----------------------------------------------------------------------------
-- 4. MODULE 2 : BIBLIOTHÈQUE PÉDAGOGIQUE GLOBALE
-- ----------------------------------------------------------------------------

-- Suppression interdite si publiée
DROP TRIGGER IF EXISTS trigger_prevent_library_resource_deletion ON global_pedagogical_resources;
CREATE TRIGGER trigger_prevent_library_resource_deletion
  BEFORE DELETE ON global_pedagogical_resources
  FOR EACH ROW
  EXECUTE FUNCTION prevent_published_resource_deletion();

-- Blocage modification et auto-incrément version
DROP TRIGGER IF EXISTS trigger_handle_library_resource_modification ON global_pedagogical_resources;
CREATE TRIGGER trigger_handle_library_resource_modification
  BEFORE UPDATE ON global_pedagogical_resources
  FOR EACH ROW
  EXECUTE FUNCTION handle_resource_modification();

-- ----------------------------------------------------------------------------
-- NOTES IMPORTANTES
-- ----------------------------------------------------------------------------
-- 
-- 1. Ces triggers sont idempotents : peuvent être relancés plusieurs fois
--    (DROP TRIGGER IF EXISTS puis CREATE TRIGGER)
-- 
-- 2. Les fonctions doivent être créées AVANT les triggers (voir functions.sql)
-- 
-- 3. Ordre d'exécution recommandé :
--    a. functions.sql (créer les fonctions)
--    b. triggers.sql (créer les triggers)
-- 
-- 4. Pour tester les triggers :
--    -- Test priorité arriérés
--    INSERT INTO payment_allocations ("id", "paymentId", "targetType", "targetId", "allocatedAmount", "allocationOrder")
--    VALUES ('test-1', 'payment-id', 'ARREAR', 'arrear-id', 100.00, 2); -- Erreur attendue
-- 
--    -- Test interdiction suppression
--    DELETE FROM payments WHERE id = 'payment-with-allocation-id'; -- Erreur attendue
-- 
--    -- Test obligation profil
--    INSERT INTO student_fees ("id", "tenantId", "studentId", "feeDefinitionId", "academicYearId", "totalAmount")
--    VALUES ('test-1', 'tenant-id', 'student-without-profile', 'fee-def-id', 'academic-year-id', 100.00); -- Erreur attendue
-- 
-- ============================================================================
