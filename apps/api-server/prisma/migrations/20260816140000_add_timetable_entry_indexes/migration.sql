-- ============================================================================
-- Migration : Index sur TimetableEntry pour détection de conflits
-- ============================================================================
--
-- Contexte :
-- La détection de conflits d'emploi du temps (classe/enseignant/salle + jour +
-- chevauchement horaire) faisait des findFirst sans index adapté → scans de
-- toute la table à chaque création de créneau.
--
-- Ces index couvrent les 3 types de conflit :
--   - (tenantId, classId, dayOfWeek)    → conflit classe
--   - (tenantId, teacherId, dayOfWeek)  → conflit enseignant (cross-timetable)
--   - (tenantId, roomId, dayOfWeek)     → conflit salle (cross-timetable)
--
-- Le chevauchement horaire (startTime/endTime) reste filtré côté applicatif
-- car PostgreSQL ne peut pas indexer un intervalle textuel simplement.
-- Pour de meilleures perfs, on pourrait utiliser le type EXCLUSION CONSTRAINT
-- avec tstzrange, mais ça nécessite une refonte du schéma.
-- ============================================================================

CREATE INDEX IF NOT EXISTS "timetable_entries_tenant_class_day_idx"
    ON "timetable_entries"("tenantId", "classId", "dayOfWeek")
    WHERE "classId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "timetable_entries_tenant_teacher_day_idx"
    ON "timetable_entries"("tenantId", "teacherId", "dayOfWeek")
    WHERE "teacherId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "timetable_entries_tenant_room_day_idx"
    ON "timetable_entries"("tenantId", "roomId", "dayOfWeek")
    WHERE "roomId" IS NOT NULL;

-- Index sur timetableId pour les requêtes par EDT
CREATE INDEX IF NOT EXISTS "timetable_entries_timetableId_idx"
    ON "timetable_entries"("timetableId");

-- Index composite pour la requête de chevauchement horaire courante
-- (utile si on filtre d'abord par jour puis par horaire)
CREATE INDEX IF NOT EXISTS "timetable_entries_day_start_end_idx"
    ON "timetable_entries"("dayOfWeek", "startTime", "endTime");
