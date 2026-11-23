-- ============================================================================
-- 2026-11-23 — Deux ajouts :
--
-- 1) bulletin_pdf_shares — partage WhatsApp des bulletins (module Examen)
--    Même pattern que le module finance encaissement : le PDF généré par le
--    moteur Puppeteer (POST /institutional-exams/bulletins/generate-pdf) est
--    stocké avec un token public ; le parent le télécharge via la page
--    publique /bulletin/[token] (route @Public). Une ligne par élève+période
--    (régénération = remplacement) + expiration 30 jours.
--
-- 2) tenant_websites.logo_palette — palette AUTO dérivée du logo de l'école
--    (Paramètres → Identité). Même format JSON que customColors
--    ([{name,value}] ×4 : primary, accent, secondary, dark). Le site
--    institutionnel du sous-domaine l'utilise en fallback de customColors.
--    Priorité : thème officiel > customColors (manuel) > logoPalette (auto)
--    > palette Helm par défaut.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "bulletin_pdf_shares" (
    "id"              TEXT PRIMARY KEY,
    "tenantId"        TEXT NOT NULL,
    "academicYearId"  TEXT NOT NULL,
    "studentId"       TEXT NOT NULL,
    "periodId"        TEXT,
    "shareToken"      TEXT NOT NULL UNIQUE,
    "fileName"        TEXT,
    "pdf"             BYTEA NOT NULL,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "expiresAt"       TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS "bulletin_pdf_shares_tenant_student_period_idx"
    ON "bulletin_pdf_shares" ("tenantId", "studentId", "periodId");

CREATE INDEX IF NOT EXISTS "bulletin_pdf_shares_expires_idx"
    ON "bulletin_pdf_shares" ("expiresAt");

ALTER TABLE "tenant_websites"
    ADD COLUMN IF NOT EXISTS "logoPalette" JSONB;
