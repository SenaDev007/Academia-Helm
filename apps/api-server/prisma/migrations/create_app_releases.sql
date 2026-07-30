-- ============================================================================
-- APP_RELEASES — Table de métadonnées pour les installables (APK, EXE, MSI)
-- ============================================================================
--
-- Stocke uniquement les MÉTADonnées (version, taille, URL de téléchargement).
-- Les fichiers binaires sont stockés sur Cloudflare R2 (stockage objet).
--
-- Schéma :
--   app_releases
--     ├── id (UUID, PK)
--     ├── version (semver, ex: "1.2.8")
--     ├── platform (android | windows | ios | macos | linux)
--     ├── arch (x64 | arm64 | universal)
--     ├── filename (ex: "academia-helm-v1.2.8.apk")
--     ├── file_size (bytes)
--     ├── download_url (URL R2 publique ou pré-signée)
--     ├── checksum_sha256 (pour vérification d'intégrité)
--     ├── release_channel (stable | beta | dev)
--     ├── is_latest (bool — true pour la dernière version de cette platform)
--     ├── release_notes (TEXT — notes de version)
--     ├── min_os_version (ex: "Android 7.0", "Windows 10")
--     ├── uploaded_at (timestamp)
--     ├── created_at (timestamp)
--     └── updated_at (timestamp)
--
-- Index :
--   - (platform, is_latest) pour récupérer rapidement les dernières versions
--   - (platform, version) pour vérifier si une version existe déjà
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_releases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version         VARCHAR(32)  NOT NULL,          -- ex: "1.2.8"
    platform        VARCHAR(16)  NOT NULL,          -- android, windows, ios, macos, linux
    arch            VARCHAR(16)  NOT NULL DEFAULT 'universal',  -- x64, arm64, universal
    filename        VARCHAR(255) NOT NULL,          -- ex: "academia-helm-v1.2.8.apk"
    file_size       BIGINT       NOT NULL,          -- taille en bytes
    download_url    TEXT         NOT NULL,          -- URL R2 publique
    checksum_sha256 VARCHAR(64),                    -- hash SHA-256 pour vérification
    release_channel VARCHAR(16)  NOT NULL DEFAULT 'stable',  -- stable, beta, dev
    is_latest       BOOLEAN      NOT NULL DEFAULT FALSE,
    release_notes   TEXT,
    min_os_version  VARCHAR(32),                    -- ex: "Android 7.0", "Windows 10"
    uploaded_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- Contrainte : une seule combinaison platform + version + arch
    CONSTRAINT uq_releases_platform_version_arch UNIQUE (platform, version, arch),

    -- Contraintes de validation
    CONSTRAINT chk_releases_platform CHECK (
        platform IN ('android', 'windows', 'ios', 'macos', 'linux')
    ),
    CONSTRAINT chk_releases_channel CHECK (
        release_channel IN ('stable', 'beta', 'dev')
    ),
    CONSTRAINT chk_releases_file_size CHECK (file_size > 0)
);

-- Index pour récupérer rapidement les dernières versions par plateforme
CREATE INDEX IF NOT EXISTS idx_app_releases_platform_latest
    ON app_releases (platform, is_latest)
    WHERE is_latest = TRUE;

-- Index pour rechercher par version
CREATE INDEX IF NOT EXISTS idx_app_releases_platform_version
    ON app_releases (platform, version);

-- Index pour filtrer par canal de release
CREATE INDEX IF NOT EXISTS idx_app_releases_channel
    ON app_releases (release_channel, platform);

-- ============================================================================
-- Fonction : set_latest_release
-- ============================================================================
-- Quand on marque une release comme "latest", cette fonction s'assure
-- que les autres releases de la même plateforme ne sont plus "latest".
-- Garantit qu'il n'y a qu'une seule version "latest" par plateforme.
-- ============================================================================

CREATE OR REPLACE FUNCTION set_latest_release()
RETURNS TRIGGER AS $$
BEGIN
    -- Si on marque une release comme latest, démarquer les autres
    IF NEW.is_latest = TRUE THEN
        UPDATE app_releases
        SET is_latest = FALSE, updated_at = now()
        WHERE platform = NEW.platform
          AND id != NEW.id
          AND is_latest = TRUE;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_releases_set_latest ON app_releases;
CREATE TRIGGER trg_app_releases_set_latest
    BEFORE INSERT OR UPDATE OF is_latest ON app_releases
    FOR EACH ROW
    EXECUTE FUNCTION set_latest_release();

-- ============================================================================
-- Commentaires pour la documentation
-- ============================================================================

COMMENT ON TABLE app_releases IS
'Métadonnées des installables Academia Helm (APK, EXE, MSI). Les fichiers sont stockés sur Cloudflare R2.';

COMMENT ON COLUMN app_releases.download_url IS
'URL publique de téléchargement (Cloudflare R2 ou CDN). Pas de BLOB en base.';

COMMENT ON COLUMN app_releases.is_latest IS
'TRUE pour la version la plus récente de cette plateforme. Un trigger garantit qu''il n''y en a qu''une seule.';

COMMENT ON COLUMN app_releases.checksum_sha256 IS
'Hash SHA-256 du fichier pour vérification d''intégrité lors du téléchargement.';
