-- ============================================================================
-- Migration : contract_document_configs — Configuration visuelle des contrats
-- ============================================================================
-- Permet à chaque école de configurer UNE FOIS l'apparence de ses contrats :
--   - En-tête (logo, nom, adresse, contact, n° autorisation, ligne décorative)
--   - Pied de page (signature Academia Helm, n° page, réf contrat, QR code)
--   - Filigrane (texte personnalisable, opacité, rotation)
--   - Style (couleurs thème, police, tailles, marges)
--
-- Cette config est appliquée à TOUS les contrats de l'école automatiquement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "contract_document_configs" (
    "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenant_id"       TEXT NOT NULL UNIQUE,  -- Une config par école

    -- ─── En-tête ───
    "header_logo_url"         TEXT,           -- URL du logo (résolu via StorageService)
    "header_logo_position"    TEXT DEFAULT 'left',  -- left | center | right
    "header_logo_max_height"  INT DEFAULT 60,       -- px
    "header_show_school_name" BOOLEAN DEFAULT true,
    "header_show_address"     BOOLEAN DEFAULT true,
    "header_show_contact"     BOOLEAN DEFAULT true,  -- téléphone + email
    "header_show_authorization_number" BOOLEAN DEFAULT true,
    "header_show_decorative_line" BOOLEAN DEFAULT true,
    "header_decorative_line_color" TEXT DEFAULT '#F5A623',  -- gold par défaut
    "header_background_color" TEXT DEFAULT '#0D1F6E',       -- navy par défaut

    -- ─── Filigrane ───
    "watermark_text"          TEXT,            -- Texte du filigrane (ex: nom école, CONFIDENTIEL)
    "watermark_opacity"       DECIMAL(3,2) DEFAULT 0.05,   -- 5% par défaut
    "watermark_font_size"     INT DEFAULT 72,              -- pt
    "watermark_rotation"      INT DEFAULT -45,             -- degrés
    "watermark_color"         TEXT DEFAULT '#1A2BA6',      -- navy par défaut

    -- ─── Pied de page ───
    "footer_show_academia_signature" BOOLEAN DEFAULT true,
    "footer_show_page_number"        BOOLEAN DEFAULT true,
    "footer_show_contract_ref"       BOOLEAN DEFAULT true,
    "footer_show_qr_code"            BOOLEAN DEFAULT true,
    "footer_background_color"        TEXT DEFAULT '#0D1F6E',
    "footer_accent_color"            TEXT DEFAULT '#F5A623',

    -- ─── Style global ───
    "style_primary_color"     TEXT DEFAULT '#0D1F6E',   -- Couleur principale (titres, en-têtes)
    "style_accent_color"      TEXT DEFAULT '#F5A623',   -- Couleur accent (lignes, badges)
    "style_font_family"       TEXT DEFAULT 'Times New Roman, serif',
    "style_title_font_size"   INT DEFAULT 15,           -- pt (titres d'articles)
    "style_body_font_size"    INT DEFAULT 12,           -- pt (corps de texte)
    "style_line_height"       DECIMAL(3,2) DEFAULT 1.7,
    "style_margin_top"        INT DEFAULT 20,           -- mm
    "style_margin_bottom"     INT DEFAULT 20,           -- mm
    "style_margin_left"       INT DEFAULT 15,           -- mm
    "style_margin_right"      INT DEFAULT 15,           -- mm

    -- ─── Métadonnées ───
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- ─── Relations ───
    CONSTRAINT "contract_document_configs_tenant_id_fkey"
        FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_contract_document_configs_tenant"
    ON "contract_document_configs" ("tenant_id");
