-- ============================================================================
-- PROMOTER_PAYMENT_ELIGIBILITY — Élèves dont les parents paient directement
-- le fondateur/promoteur (caisse FONDE)
-- ============================================================================
--
-- ⭐ Rôle : marquer certains élèves comme "paiement direct au fondateur".
--    Ces élèves sont exclus du sous-onglet "Encaissements standard" et
--    apparaissent dans un sous-onglet dédié "Reçu par le fondateur".
--
--    Scénario :
--    - Le parent est ami du fondateur et paie la scolarité directement
--      entre ses mains (pas via le caissier)
--    - La secrétaire ou le caissier active le toggle sur la ligne de l'élève
--    - Un modal de justification s'affiche pour saisir le motif
--    - L'élève est "déclassifié" de la liste standard des encaissements
--    - Il apparaît dans le sous-onglet "Reçu par le fondateur"
--
-- ⭐ Multi-tenant strict : tenantId obligatoire, isolé par école.
-- ⭐ Unicité : un élève ne peut être marqué qu'une seule fois par année scolaire.
-- ============================================================================

CREATE TABLE IF NOT EXISTS promoter_payment_eligibility (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenantId        TEXT NOT NULL,
    studentId       TEXT NOT NULL,
    academicYearId  TEXT NOT NULL,
    isActive        BOOLEAN NOT NULL DEFAULT TRUE,   -- false si désactivé (toggle off)
    motif           TEXT NOT NULL,                   -- justification obligatoire
    expectedDate    TIMESTAMPTZ,                     -- date d'échéance prévue (optionnel)
    createdById     TEXT,                            -- User.id (secrétaire/caissier qui a activé)
    createdAt       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updatedById     TEXT,
    updatedAt       TIMESTAMPTZ,
    deactivatedAt   TIMESTAMPTZ,                     -- quand le toggle a été désactivé
    deactivatedById TEXT,

    -- ⭐ Unicité : un élève ne peut avoir qu'une seule eligibility active par année
    CONSTRAINT uq_promoter_eligibility_student_year UNIQUE (tenantId, studentId, academicYearId),

    -- Index pour requêtes fréquentes
    CONSTRAINT chk_promoter_eligibility_active CHECK (isActive IN (TRUE, FALSE))
);

-- Index pour filtrer par tenant + année (liste du sous-onglet)
CREATE INDEX IF NOT EXISTS idx_promoter_eligibility_tenant_year
    ON promoter_payment_eligibility (tenantId, academicYearId, isActive)
    WHERE isActive = TRUE;

-- Index pour vérifier si un élève spécifique est éligible (toggle sur ligne)
CREATE INDEX IF NOT EXISTS idx_promoter_eligibility_student
    ON promoter_payment_eligibility (tenantId, studentId, academicYearId);

-- Index pour historique (qui a activé/désactivé)
CREATE INDEX IF NOT EXISTS idx_promoter_eligibility_created
    ON promoter_payment_eligibility (tenantId, createdById, createdAt);

COMMENT ON TABLE promoter_payment_eligibility IS
'Élèves dont les parents paient directement le fondateur/promoteur. Marqués via toggle dans Compte Élèves avec justification obligatoire.';

COMMENT ON COLUMN promoter_payment_eligibility.motif IS
'Justification obligatoire saisie dans le modal (ex: parent ami du fondateur, arrangement particulier, etc.)';

COMMENT ON COLUMN promoter_payment_eligibility.expectedDate IS
'Date d''échéance prévue pour le paiement (optionnel) — affichée dans le sous-onglet Reçu par le fondateur';

COMMENT ON COLUMN promoter_payment_eligibility.isActive IS
'TRUE = élève marqué comme paiement fondateur (exclu du sous-onglet standard). FALSE = désactivé (élève revient dans la liste standard).';
