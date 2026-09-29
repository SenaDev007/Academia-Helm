-- ═════════════════════════════════════════════════════════════════
--  ⭐ CRÉNEAUX DE DISPONIBILITÉ (Helm Connect — parité web)
--    Chaque utilisateur publie des créneaux hebdomadaires récurrents
--    (dayOfWeek 1=Lundi … 7=Dimanche, HH:MM→HH:MM + libellé optionnel)
--    visibles par les membres de ses conversations (fiche membre).
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "chat_availability_slots" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT,
    "userId"      TEXT NOT NULL,
    "dayOfWeek"   INT  NOT NULL,            -- 1 = Lundi … 7 = Dimanche
    "startTime"   TEXT NOT NULL,            -- 'HH:MM' (heure locale)
    "endTime"     TEXT NOT NULL,            -- 'HH:MM'
    "label"       TEXT,                     -- ex. 'Permanence pédagogique'
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "chat_availability_slots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "chat_availability_slots_user_idx"
    ON "chat_availability_slots" ("userId", "dayOfWeek");
