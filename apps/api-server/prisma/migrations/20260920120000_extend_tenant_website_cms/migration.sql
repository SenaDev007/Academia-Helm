-- ============================================================================
-- 20260920120000_extend_tenant_website_cms
-- ============================================================================
-- Étend le modèle TenantWebsite pour rendre TOUT le site institutionnel
-- modifiable depuis le CMS : programmes, corps enseignant, étapes
-- d'admission, documents requis, logos partenaires, navigation, horaires,
-- titres/sous-titres de toutes les sections, et stats dynamiques.
--
-- Toutes les colonnes sont ajoutées avec IF NOT EXISTS pour rendre la
-- migration idempotente (ré-exécutable sans erreur).
-- ============================================================================

-- ─── Programmes (Maternelle / Primaire / Secondaire) ──────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "programs" JSONB DEFAULT '[]';
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "programsTitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "programsSubtitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "programsIsActive" BOOLEAN DEFAULT true;

-- ─── Points de différenciation ────────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "differentiators" JSONB DEFAULT '[]';
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "differentiatorsIsActive" BOOLEAN DEFAULT true;

-- ─── Corps enseignant ─────────────────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "faculty" JSONB DEFAULT '[]';
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "facultyTitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "facultySubtitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "facultyIsActive" BOOLEAN DEFAULT true;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "facultyRatio" TEXT;

-- ─── Étapes d'admission + Documents requis ─────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "admissionSteps" JSONB DEFAULT '[]';
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "admissionTitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "admissionSubtitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "admissionDocuments" JSONB DEFAULT '[]';

-- ─── Logos partenaires ─────────────────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "partnerLogos" JSONB DEFAULT '[]';
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "partnerLogosIsActive" BOOLEAN DEFAULT true;

-- ─── Liens de navigation (navbar) ──────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "navLinks" JSONB DEFAULT '[]';

-- ─── Horaires d'ouverture ──────────────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "schoolHoursWeekdays" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "schoolHoursSaturday" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "schoolHoursIsActive" BOOLEAN DEFAULT true;

-- ─── Section Témoignages — titres ─────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "testimonialsTitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "testimonialsSubtitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "testimonialsIsActive" BOOLEAN DEFAULT true;

-- ─── Section Contact — titres ─────────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "contactTitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "contactSubtitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "contactIsActive" BOOLEAN DEFAULT true;

-- ─── Section Actualités — titres ──────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "newsTitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "newsSubtitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "newsIsActive" BOOLEAN DEFAULT true;

-- ─── Section Galerie — titres ─────────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "galleryTitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "gallerySubtitle" TEXT;
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "galleryIsActive" BOOLEAN DEFAULT true;

-- ─── Sous-titre de la section Présentation ────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "presentationSubtitle" TEXT;

-- ─── Statistiques dynamiques ──────────────────────────────────────────────
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "statsMode" TEXT DEFAULT 'manual';
ALTER TABLE tenant_websites ADD COLUMN IF NOT EXISTS "dynamicStatsConfig" JSONB DEFAULT '[]';

-- ============================================================================
-- Index secondaires (none needed — all access goes through tenantId which is
-- already uniquely indexed via @unique).
-- ============================================================================
