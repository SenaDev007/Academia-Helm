use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};
use tauri_plugin_store::StoreExt;
use log::{info, warn, error};

/// ============================================================================
/// SYNC ENGINE — Moteur de synchronisation Neon ↔ SQLite
/// ============================================================================
///
/// Architecture :
///   1. PULL  : Neon → SQLite (télécharge les modifications depuis le serveur)
///   2. PUSH  : SQLite → Neon (envoie l'outbox — écritures locales en attente)
///   3. CONFLICT : last-write-wins (sauf finances = server-wins)
///
/// Sync automatique : toutes les 1 heure
/// Sync manuel : bouton "Synchroniser" dans l'UI
/// Sync initial : au premier lancement (télécharge toutes les données)
/// ============================================================================

const SYNC_INTERVAL_MS: u64 = 60 * 60 * 1000; // 1 heure
const BATCH_SIZE: usize = 500; // Records per batch
const MAX_RETRIES: u32 = 3;

/// État de la synchronisation
#[derive(Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub is_syncing: bool,
    pub last_sync_at: Option<String>,
    pub last_sync_status: Option<String>,
    pub records_pulled: u64,
    pub records_pushed: u64,
    pub pending_outbox: u64,
    pub is_online: bool,
    pub sync_type: Option<String>, // "initial", "pull", "push", "manual"
    pub progress: f32, // 0.0 → 1.0
    pub current_table: Option<String>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            is_syncing: false,
            last_sync_at: None,
            last_sync_status: None,
            records_pulled: 0,
            records_pushed: 0,
            pending_outbox: 0,
            is_online: true,
            sync_type: None,
            progress: 0.0,
            current_table: None,
        }
    }
}

/// Configuration de sync pour une table
#[derive(Clone)]
pub struct TableSyncConfig {
    pub name: String,
    pub pull_query: String,
    pub push_table: String,
}

/// Moteur de synchronisation principal
pub struct SyncEngine {
    pub state: std::sync::Mutex<SyncState>,
}

impl SyncEngine {
    pub fn new() -> Self {
        Self {
            state: std::sync::Mutex::new(SyncState::default()),
        }
    }

    /// Démarre la boucle de sync automatique (toutes les 1 heure)
    pub fn start_auto_sync(app: AppHandle) {
        tauri::async_runtime::spawn(async move {
            loop {
                // Attendre 1 heure
                tokio::time::sleep(std::time::Duration::from_millis(SYNC_INTERVAL_MS)).await;

                // Vérifier si online
                if !is_online().await {
                    info!("Auto-sync skipped: offline");
                    continue;
                }

                info!("Auto-sync starting...");
                let _ = run_sync(app.clone(), SyncType::Auto).await;
            }
        });
    }

    /// Sync initial (au premier lancement)
    pub async fn initial_sync(app: AppHandle) -> Result<SyncState, String> {
        run_sync(app, SyncType::Initial).await
    }

    /// Sync manuel (bouton "Synchroniser")
    pub async fn manual_sync(app: AppHandle) -> Result<SyncState, String> {
        run_sync(app, SyncType::Manual).await
    }
}

#[derive(Clone)]
pub enum SyncType {
    Initial,
    Auto,
    Manual,
}

/// Exécute un cycle de sync complet (pull + push)
async fn run_sync(app: AppHandle, sync_type: SyncType) -> Result<SyncState, String> {
    let sync_engine = app.state::<SyncEngine>();

    // Marquer comme "syncing"
    {
        let mut state = sync_engine.state.lock().unwrap();
        if state.is_syncing {
            return Ok(state.clone());
        }
        state.is_syncing = true;
        state.sync_type = Some(match sync_type {
            SyncType::Initial => "initial".to_string(),
            SyncType::Auto => "auto".to_string(),
            SyncType::Manual => "manual".to_string(),
        });
        state.records_pulled = 0;
        state.records_pushed = 0;
        state.progress = 0.0;
    }

    // Émettre événement "sync-started" à l'UI
    let _ = app.emit("sync-started", &sync_engine.state.lock().unwrap().clone());

    // 1. PUSH : envoyer l'outbox vers Neon
    match push_outbox(&app).await {
        Ok(pushed) => {
            let mut state = sync_engine.state.lock().unwrap();
            state.records_pushed = pushed;
        }
        Err(e) => {
            error!("Push failed: {}", e);
            let mut state = sync_engine.state.lock().unwrap();
            state.last_sync_status = Some("partial".to_string());
        }
    }

    // 2. PULL : télécharger les modifications depuis Neon
    match pull_changes(&app, &sync_type).await {
        Ok(pulled) => {
            let mut state = sync_engine.state.lock().unwrap();
            state.records_pulled = pulled;
            state.last_sync_status = Some("success".to_string());
            state.last_sync_at = Some(chrono::Utc::now().to_rfc3339());
        }
        Err(e) => {
            error!("Pull failed: {}", e);
            let mut state = sync_engine.state.lock().unwrap();
            state.last_sync_status = Some("failed".to_string());
        }
    }

    // Mettre à jour l'état final
    {
        let mut state = sync_engine.state.lock().unwrap();
        state.is_syncing = false;
        state.progress = 1.0;
        state.sync_type = None;
        state.current_table = None;

        // Compter l'outbox restant
        state.pending_outbox = count_pending_outbox(&app).unwrap_or(0);

        let final_state = state.clone();
        let _ = app.emit("sync-completed", &final_state);
        Ok(final_state)
    }
}

/// PULL : télécharge les modifications depuis Neon vers SQLite
async fn pull_changes(app: &AppHandle, sync_type: &SyncType) -> Result<u64, String> {
    let tables = get_syncable_tables();
    let total_tables = tables.len() as u64;
    let mut total_pulled: u64 = 0;

    for (i, table) in tables.iter().enumerate() {
        // Mettre à jour la progression
        {
            let sync_engine = app.state::<SyncEngine>();
            let mut state = sync_engine.state.lock().unwrap();
            state.progress = (i as f32) / (total_tables as f32);
            state.current_table = Some(table.name.clone());
            let _ = app.emit("sync-progress", &state.clone());
        }

        // Récupérer le dernier sync timestamp pour cette table
        let last_sync = get_last_sync(app, &table.name).unwrap_or(None);

        // Construire la requête de pull
        let query = if matches!(sync_type, SyncType::Initial) || last_sync.is_none() {
            // Sync initial : tout télécharger
            format!("SELECT * FROM {} ORDER BY updated_at DESC", table.name)
        } else {
            // Sync delta : seulement les modifications depuis last_sync
            format!(
                "SELECT * FROM {} WHERE updated_at > '{}' ORDER BY updated_at DESC",
                table.name,
                last_sync.unwrap()
            )
        };

        // Exécuter via l'API (HTTP)
        match fetch_from_neon(&query).await {
            Ok(records) => {
                let count = records.len() as u64;
                upsert_to_sqlite(app, &table.name, &records)?;
                total_pulled += count;

                // Mettre à jour le timestamp de sync
                update_sync_metadata(app, &table.name, count, 0)?;
            }
            Err(e) => {
                warn!("Pull failed for table {}: {}", table.name, e);
            }
        }
    }

    Ok(total_pulled)
}

/// PUSH : envoie l'outbox (écritures locales) vers Neon
async fn push_outbox(app: &AppHandle) -> Result<u64, String> {
    let pending = get_pending_outbox_records(app)?;

    let mut pushed: u64 = 0;
    for record in pending {
        match push_record_to_neon(&record).await {
            Ok(_) => {
                mark_outbox_record_synced(app, record.id)?;
                pushed += 1;
            }
            Err(e) => {
                warn!("Push failed for record {}: {}", record.id, e);
                increment_outbox_retry(app, record.id)?;
            }
        }
    }

    Ok(pushed)
}

/// Vérifie si l'appareil est en ligne
async fn is_online() -> bool {
    // TODO: Implémenter la vérification de connectivité réelle
    // Pour l'instant, on suppose qu'on est online
    true
}

/// Liste des tables synchronisables (exclut les tables système)
fn get_syncable_tables() -> Vec<TableSyncConfig> {
    // Cette liste sera générée dynamiquement depuis le schéma
    // Pour l'instant, on retourne une liste vide
    // Le vrai code lira la liste des tables depuis postgres-schema.json
    vec![]
}

/// Récupère le dernier timestamp de sync pour une table
fn get_last_sync(app: &AppHandle, table_name: &str) -> Result<Option<String>, String> {
    // TODO: Query _sync_metadata table
    Ok(None)
}

/// Récupère les enregistrements en attente dans l'outbox
fn get_pending_outbox_records(app: &AppHandle) -> Result<Vec<OutboxRecord>, String> {
    // TODO: Query _sync_outbox table
    Ok(vec![])
}

/// Compte les enregistrements en attente dans l'outbox
fn count_pending_outbox(app: &AppHandle) -> Result<u64, String> {
    // TODO: SELECT COUNT(*) FROM _sync_outbox WHERE status = 'pending'
    Ok(0)
}

/// Insère ou met à jour des enregistrements dans SQLite
fn upsert_to_sqlite(app: &AppHandle, table: &str, records: &[serde_json::Value]) -> Result<(), String> {
    // TODO: INSERT OR REPLACE INTO table ...
    Ok(())
}

/// Met à jour les métadonnées de sync
fn update_sync_metadata(app: &AppHandle, table: &str, pulled: u64, pushed: u64) -> Result<(), String> {
    // TODO: INSERT OR REPLACE INTO _sync_metadata ...
    Ok(())
}

/// Récupère des données depuis Neon via l'API
async fn fetch_from_neon(query: &str) -> Result<Vec<serde_json::Value>, String> {
    // TODO: HTTP call to /api/sync/pull with the query
    Ok(vec![])
}

/// Envoie un enregistrement vers Neon
async fn push_record_to_neon(record: &OutboxRecord) -> Result<(), String> {
    // TODO: HTTP call to /api/sync/push
    Ok(())
}

/// Marque un enregistrement outbox comme synchronisé
fn mark_outbox_record_synced(app: &AppHandle, id: i64) -> Result<(), String> {
    // TODO: UPDATE _sync_outbox SET status = 'synced', synced_at = datetime('now')
    Ok(())
}

/// Incrémente le compteur de retry
fn increment_outbox_retry(app: &AppHandle, id: i64) -> Result<(), String> {
    // TODO: UPDATE _sync_outbox SET retry_count = retry_count + 1
    Ok(())
}

/// Structure d'un enregistrement outbox
#[derive(Clone, Serialize, Deserialize)]
pub struct OutboxRecord {
    pub id: i64,
    pub table_name: String,
    pub record_id: String,
    pub operation: String, // INSERT, UPDATE, DELETE
    pub data: String,      // JSON
    pub created_at: String,
    pub retry_count: u32,
}

// ============================================================================
// TAURI COMMANDS — Exposées au frontend
// ============================================================================

/// Récupère l'état de sync actuel
#[tauri::command]
pub fn get_sync_state(sync_engine: State<SyncEngine>) -> SyncState {
    sync_engine.state.lock().unwrap().clone()
}

/// Déclenche une sync manuelle
#[tauri::command]
pub async fn trigger_sync(app: AppHandle) -> Result<SyncState, String> {
    SyncEngine::manual_sync(app).await
}

/// Déclenche la sync initiale
#[tauri::command]
pub async fn trigger_initial_sync(app: AppHandle) -> Result<SyncState, String> {
    SyncEngine::initial_sync(app).await
}
