-- ⭐ Academia Federis — Règle d'unicité : UN SEUL patronat national par pays
--
-- Règle métier (utilisateur, 2026-09-28) : on ne peut pas créer deux patronats
-- nationaux pour un même pays. Pour un pays il existe un patronat national
-- unique, et c'est à ce patronat national unique que sont rattachés tous les
-- patronats départementaux / territoriaux.
--
-- L'index unique partiel garantit la règle au niveau base (défense en
-- profondeur) : toute insertion d'un second NATIONAL pour un pays déjà
-- pourvu échoue (P2002 côté Prisma), même en cas de course concurrente
-- entre deux inscriptions simultanées.
--
-- Les patronats TERRITORIAUX ne sont pas concernés (plusieurs départements
-- par pays) : la condition partielle WHERE "orgLevel" = 'NATIONAL' ne
-- contraint qu'eux.

CREATE UNIQUE INDEX IF NOT EXISTS "patronats_unique_national_per_country"
    ON "patronats"("countryId")
    WHERE "orgLevel" = 'NATIONAL';
