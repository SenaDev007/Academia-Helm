-- ⭐ Ajoute une colonne signatureUrl à la table teachers
--    Permet à un enseignant du secondaire d'enregistrer UNE FOIS sa signature
--    (base64 data URL, dessinée sur canvas) puis de la réutiliser automatiquement
--    pour chaque entrée du cahier de texte (au lieu de signer à chaque saisie).
--
--    Utilisé par :
--    - Le bouton "Ma signature" dans l'onglet Cahier de Texte (enregistrement)
--    - Le backend createCahierDeTexte (auto-attach : teacherName + teacherSignature)

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;
