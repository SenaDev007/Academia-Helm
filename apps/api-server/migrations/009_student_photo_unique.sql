-- ============================================================================
-- 009_student_photo_unique.sql
-- ============================================================================
-- Ajoute la contrainte @unique sur StudentPhoto.studentId pour permettre
-- l'upsert({ where: { studentId } }) comme dans StaffPhoto.
--
-- Pattern aligné sur le module RH (staff_photos.staffId @unique).
--
-- La table student_photos est actuellement VIDE (0 lignes) → pas de cleanup
-- préalable nécessaire.
-- ============================================================================

-- 1. Poser l'index unique sur studentId
CREATE UNIQUE INDEX IF NOT EXISTS "student_photos_studentId_key"
  ON "student_photos"("studentId");

-- 2. Vérification (sécurité) : si des doublons existaient déjà, l'index aurait échoué.
--    Dans ce cas, on les supprime en gardant le plus récent (max createdAt).
--    (Best-effort : ne plante pas la migration si déjà clean.)
DO $$
BEGIN
  -- Vérifier s'il reste des doublons (ne devrait pas arriver car la table est vide)
  IF EXISTS (
    SELECT 1 FROM (
      SELECT "studentId", COUNT(*) AS cnt
      FROM "student_photos"
      GROUP BY "studentId"
      HAVING COUNT(*) > 1
    ) dup
  ) THEN
    RAISE NOTICE 'Doublons détectés dans student_photos — suppression des anciens...';
    DELETE FROM "student_photos" p
    WHERE p.id NOT IN (
      SELECT DISTINCT ON ("studentId") id
      FROM "student_photos"
      ORDER BY "studentId", "createdAt" DESC
    );
  END IF;
END$$;
