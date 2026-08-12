-- ============================================================================
-- _SYNC_OUTBOX — Table d'idempotence pour la sync push (multi-tenant)
-- ============================================================================
--
-- ⭐ Rôle : empêcher les doublons quand le réseau coupe pendant que le
--    serveur a déjà traité un lot push mais avant que la confirmation
--    ne revienne au client.
--
-- Scénario sans cette table :
--   1. Client envoie POST /api/sync/push avec 50 événements (local_id=1..50)
--   2. Serveur applique les 50 écritures sur Postgres
--   3. Le réseau coupe AVANT que la réponse 200 ne revienne
--   4. Client retry (backoff) → renvoie les MÊMES 50 événements
--   5. Serveur les applique DEUX FOIS → doublons potentiels (selon l'operation)
--
-- Solution :
--   - Avant chaque applyRecord, vérifier si local_id existe déjà avec status='synced'
--   - Si oui, skip (renvoyer SUCCESS sans réappliquer)
--   - Si non, appliquer puis INSERT dans _sync_outbox avec local_id + tenant_id
--
-- Note : cette table est DISTINCTE de l'outbox client (qui est locale à
--        SQLite/IndexedDB). C'est l'outbox SERVEUR, qui ne stocke que les
--        local_ids déjà traités pour l'idempotence.
-- ============================================================================

CREATE TABLE IF NOT EXISTS _sync_outbox (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL,                       -- isolation multi-tenant
    local_id        TEXT NOT NULL,                       -- ID côté client (outbox.id)
    table_name      VARCHAR(128) NOT NULL,               -- table affectée
    record_id       TEXT,                                -- ID de l'enregistrement
    operation       VARCHAR(16) NOT NULL,                -- INSERT | UPDATE | DELETE
    status          VARCHAR(16) NOT NULL DEFAULT 'synced', -- synced | failed
    error_message   TEXT,
    device_id       VARCHAR(128),                        -- quel appareil a poussé
    client_timestamp TIMESTAMPTZ,                        -- timestamp client
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- ⭐ Unicité : un local_id ne peut être traité qu'une fois par tenant
    --    (si le client retry avec le même local_id, on skip)
    CONSTRAINT uq_sync_outbox_tenant_local UNIQUE (tenant_id, local_id),

    -- Validation du statut
    CONSTRAINT chk_sync_outbox_status CHECK (
        status IN ('synced', 'failed')
    ),

    -- Validation de l'opération
    CONSTRAINT chk_sync_outbox_operation CHECK (
        operation IN ('INSERT', 'UPDATE', 'DELETE')
    )
);

-- Index pour la recherche d'idempotence (très fréquente : 1 requête par push event)
CREATE INDEX IF NOT EXISTS idx_sync_outbox_tenant_local
    ON _sync_outbox (tenant_id, local_id)
    WHERE status = 'synced';

-- Index pour le nettoyage périodique (les entrées > 30 jours peuvent être purgées)
CREATE INDEX IF NOT EXISTS idx_sync_outbox_synced_at
    ON _sync_outbox (synced_at);

-- Index pour les analytics (compter les syncs par tenant / device)
CREATE INDEX IF NOT EXISTS idx_sync_outbox_tenant_device
    ON _sync_outbox (tenant_id, device_id, synced_at DESC);

-- ============================================================================
-- Function : cleanup_old_sync_outbox_entries
-- ============================================================================
-- À appeler via un cron job (pg_cron ou scheduler externe) pour purger les
-- entrées > 30 jours. Garde la table petite et rapide.
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_sync_outbox_entries(days_to_keep INT DEFAULT 30)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM _sync_outbox
    WHERE synced_at < now() - (days_to_keep || ' days')::INTERVAL
      AND status = 'synced';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE _sync_outbox IS
'Table d''idempotence pour la sync push. Stocke les local_ids déjà traités pour éviter les doublons lors des retries réseau.';

COMMENT ON COLUMN _sync_outbox.local_id IS
'ID côté client (outbox SQLite/IndexedDB). Unicité par tenant pour éviter les collisions entre clients.';

COMMENT ON COLUMN _sync_outbox.status IS
'synced = écriture appliquée avec succès sur Postgres. failed = écriture en erreur (ne devrait pas être insérée ici, mais utile pour debug).';
