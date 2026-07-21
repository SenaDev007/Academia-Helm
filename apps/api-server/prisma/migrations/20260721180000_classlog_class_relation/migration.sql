-- Migration: ajout relation manquante ClassLog.class → Class
-- Aucune modification de colonne : la FK classId existe déjà dans pedagogy_class_logs.
-- Cette migration ne fait rien au niveau SQL, mais formalise la relation Prisma.

-- Aucune action SQL requise (la contrainte FK existe déjà).
-- Cette migration existe uniquement pour synchroniser le client Prisma.

SELECT 1;
