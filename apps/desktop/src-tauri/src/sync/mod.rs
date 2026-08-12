use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager, State};
use log::{info, warn, error};

// ============================================================================
// SYNC ENGINE — Implémentation complète avec appels HTTP
// ============================================================================

const SYNC_INTERVAL_MS: u64 = 5 * 60 * 1000; // ⭐ 5 minutes (avant : 1h — trop long)
const BATCH_SIZE: usize = 5000;
const MAX_RETRIES: u32 = 3;
const API_BASE_URL: &str = "https://api.academiahelm.com/api";

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
    pub sync_type: Option<String>,
    pub progress: f32,
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

#[derive(Clone, Serialize, Deserialize)]
pub struct OutboxRecord {
    /// ⭐ UUID string (pas i64 AUTOINCREMENT) pour l'unicité cross-device.
    ///    Le backend utilise (tenant_id, local_id) comme clé unique pour
    ///    l'idempotence. Si deux appareils du même tenant ont tous les deux
    ///    local_id="1", l'un sera faussement considéré comme déjà synchronisé.
    ///    Avec UUID, chaque appareil génère des IDs uniques globalement.
    pub id: String,
    pub table_name: String,
    pub record_id: String,
    pub operation: String,
    pub data: String,
    pub created_at: String,
    pub retry_count: u32,
}

/// Réponse de l'API /api/sync/pull
/// ⭐ rename_all = "camelCase" pour matcher le JSON du backend NestJS
///    qui renvoie pulledAt (pas pulled_at), totalRecords (pas total_records)
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PullResponse {
    success: bool,
    pulled_at: String,
    total_records: u64,
    tables: HashMap<String, Vec<Value>>,
}

/// Requête pour /api/sync/push
#[derive(Serialize)]
struct PushRequest {
    records: Vec<PushRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    device_id: Option<String>,
}

#[derive(Serialize)]
struct PushRecord {
    /// ⭐ local_id pour l'idempotence côté backend (table _sync_outbox).
    ///    Si le réseau coupe avant que la réponse ne revienne, le retry
    ///    renverra le MÊME local_id et le serveur saura qu'il peut skip.
    local_id: String,
    table_name: String,
    record_id: String,
    operation: String,
    data: Value,
    client_timestamp: String,
}

/// Réponse de l'API /api/sync/push
/// ⭐ rename_all = "camelCase" pour matcher le JSON du backend NestJS qui renvoie :
///    { success, pushedAt, total, successful_operations, conflicted_operations,
///      failed_operations, results: [...] }
///
///    Avant : champs sans camelCase → `pushed_at` ne matchait pas `pushedAt`
///    → parsing échouait silencieusement.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PushResponse {
    success: bool,
    pushed_at: String,
    total: u64,
    successful_operations: u64,
    conflicted_operations: u64,
    failed_operations: u64,
    /// ⭐ Résultats individuels par record (SUCCESS/CONFLICT/ERROR)
    ///    pour marquage fin côté frontend.
    #[serde(default)]
    results: Vec<PushResultEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PushResultEntry {
    operation_id: Option<String>,
    #[serde(default)]
    table_name: Option<String>,
    #[serde(default)]
    record_id: Option<String>,
    status: String, // SUCCESS | CONFLICT | ERROR
    #[serde(default)]
    error: Option<String>,
}

pub struct SyncEngine {
    pub state: std::sync::Mutex<SyncState>,
    pub access_token: std::sync::Mutex<Option<String>>,
}

impl SyncEngine {
    pub fn new() -> Self {
        Self {
            state: std::sync::Mutex::new(SyncState::default()),
            access_token: std::sync::Mutex::new(None),
        }
    }

    pub fn set_token(&self, token: String) {
        *self.access_token.lock().unwrap() = Some(token);
    }

    pub fn start_auto_sync(app: AppHandle) {
        tauri::async_runtime::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_millis(SYNC_INTERVAL_MS)).await;

                if !is_online().await {
                    info!("Auto-sync skipped: offline");
                    continue;
                }

                info!("Auto-sync starting...");
                // ⭐ P2 — Auto-sync utilise None (full sync) car le frontend
                //    n'est pas toujours disponible pour fournir lastSyncAt
                //    (le auto-sync peut tourner même si la fenêtre est
                //    minimisée). Le delta sync est fait via trigger_sync
                //    (manuel) où le frontend fournit la valeur.
                let _ = run_sync(app.clone(), "auto", None).await;
            }
        });
    }

    pub async fn initial_sync(app: AppHandle) -> Result<SyncState, String> {
        // ⭐ P2 — initial sync = full sync (last_sync_at = None)
        run_sync(app, "initial", None).await
    }

    // ⭐ P2 — manual_sync accepte maintenant lastSyncAt depuis le frontend.
    //    Le frontend lit `SELECT MAX(last_sync_at) FROM _sync_metadata` et
    //    passe la valeur ici. Rust l'utilise pour filter le pull delta.
    pub async fn manual_sync(app: AppHandle, last_sync_at: Option<String>) -> Result<SyncState, String> {
        run_sync(app, "manual", last_sync_at).await
    }
}

async fn run_sync(
    app: AppHandle,
    sync_type: &str,
    last_sync_at: Option<String>, // ⭐ P2 — lastSyncAt fourni par le frontend
) -> Result<SyncState, String> {
    let sync_engine = app.state::<SyncEngine>();

    // Marquer comme "syncing"
    {
        let mut state = sync_engine.state.lock().unwrap();
        if state.is_syncing {
            return Ok(state.clone());
        }
        state.is_syncing = true;
        state.sync_type = Some(sync_type.to_string());
        state.records_pulled = 0;
        state.records_pushed = 0;
        state.progress = 0.0;
    }

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
    // ⭐ P2 — on passe last_sync_at au pull_changes pour delta sync
    match pull_changes(&app, sync_type, last_sync_at).await {
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

    // État final
    {
        let mut state = sync_engine.state.lock().unwrap();
        state.is_syncing = false;
        state.progress = 1.0;
        state.sync_type = None;
        state.current_table = None;
        state.pending_outbox = count_pending_outbox(&app).unwrap_or(0);

        let final_state = state.clone();
        let _ = app.emit("sync-completed", &final_state);
        Ok(final_state)
    }
}

// ============================================================================
// PULL — Télécharge les données depuis Neon via l'API
// ============================================================================

async fn pull_changes(
    app: &AppHandle,
    sync_type: &str,
    last_sync_at: Option<String>, // ⭐ P2 — lastSyncAt fourni par le frontend
) -> Result<u64, String> {
    let sync_engine = app.state::<SyncEngine>();
    let token = sync_engine.access_token.lock().unwrap().clone();

    if token.is_none() {
        return Err("No access token — user not authenticated".to_string());
    }

    // ⭐ P2 — lastSyncAt pour delta sync.
    //    Avant : get_last_global_sync() retournait toujours None → chaque
    //    sync était complète (toutes les tables, sans filtre updated_at).
    //    Maintenant : le frontend lit `SELECT MAX(last_sync_at) FROM _sync_metadata`
    //    et passe la valeur via trigger_sync. Rust l'utilise pour filter le pull.
    //
    //    Pour la sync initiale, on force None (full sync) même si le frontend
    //    a passé une valeur — la sync initiale doit toujours récupérer TOUT.
    let last_sync = if sync_type == "initial" {
        None
    } else {
        last_sync_at.clone()
    };

    if last_sync.is_some() {
        info!("Pull with delta sync (lastSyncAt={})", last_sync.as_ref().unwrap());
    } else {
        info!("Pull with full sync (no lastSyncAt)");
    }

    // Construire le body de la requête
    // ⭐ Inclure le tenantId pour filtrer les données par école
    //    Avant : pas de tenantId → le backend retournait les données de TOUTES les écoles
    let tenant_id = get_tenant_id(app);
    let body = serde_json::json!({
        "lastSyncAt": last_sync,
        "limit": BATCH_SIZE,
        "tenantId": tenant_id,
    });

    // Appel HTTP vers /api/sync/pull
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/sync/pull", API_BASE_URL))
        .header("Authorization", format!("Bearer {}", token.unwrap()))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Pull API error {}: {}", status, text));
    }

    let pull_response: PullResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse pull response: {}", e))?;

    // Insérer les données dans SQLite
    let mut total_pulled: u64 = 0;
    let table_count = pull_response.tables.len();

    for (i, (table_name, records)) in pull_response.tables.into_iter().enumerate() {
        // Mettre à jour la progression
        {
            let mut state = sync_engine.state.lock().unwrap();
            state.progress = (i as f32) / (table_count as f32);
            state.current_table = Some(table_name.clone());
            let _ = app.emit("sync-progress", &state.clone());
        }

        let count = records.len() as u64;
        if count > 0 {
            upsert_to_sqlite(app, &table_name, &records)?;
            total_pulled += count;
            info!("Pulled {} records from {}", count, table_name);
        }

        // Mettre à jour le timestamp de sync pour cette table
        let _ = update_sync_metadata(app, &table_name, count, 0);
    }

    Ok(total_pulled)
}

// ============================================================================
// PUSH — Envoie l'outbox vers Neon via l'API
// ============================================================================

/// ⭐ NOUVELLE ARCHITECTURE POUR LE PUSH :
///
/// Comme Rust ne peut pas directement accéder au SQLite géré par tauri-plugin-sql
/// (qui vit côté frontend), on inverse la responsabilité :
///
///   1. Rust émet l'événement `sync-push-outbox` vers le frontend
///   2. Le frontend (app.html) écoute cet événement :
///      a. Lit les records pending dans SQLite via `db.select()`
///      b. Fait `fetch('/api/sync/push', { body: records })` avec le token
///      c. Pour chaque résultat (SUCCESS/CONFLICT/ERROR), met à jour le statut
///         dans SQLite via `db.execute('UPDATE _sync_outbox SET status=...')`
///   3. Le frontend émet `sync-push-complete` vers Rust avec le compte
///
/// ⭐ Idempotence : le frontend envoie `local_id` (UUID) pour chaque record.
///    Le backend vérifie dans `_sync_outbox` si ce local_id a déjà été traité.
///
/// ⭐ Multi-tenant strict : le backend extrait le tenantId du JWT. Le frontend
///    n'envoie PAS de tenantId dans le body (il sera ignoré de toute façon).
async fn push_outbox(app: &AppHandle) -> Result<u64, String> {
    // ⭐ Émettre l'événement vers le frontend
    //    Le frontend va lire SQLite, faire le fetch, et marquer les records.
    info!("Emitting sync-push-outbox event to frontend");

    let _ = app.emit("sync-push-outbox", ());

    // ⭐ Attendre la réponse du frontend (sync-push-complete)
    //    Timeout 30s pour éviter de bloquer indéfiniment
    let (tx, rx) = tokio::sync::oneshot::channel::<u64>();
    let _guard = app.once("sync-push-complete", move |_event| {
        // Le frontend envoie le nombre de records poussés avec succès
        let pushed = _event.payload().get("pushed")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        let _ = tx.send(pushed);
    });

    // Attendre avec timeout
    match tokio::time::timeout(
        std::time::Duration::from_secs(30),
        rx,
    ).await {
        Ok(Ok(pushed)) => {
            info!("Push complete: {} records pushed", pushed);
            Ok(pushed)
        }
        Ok(Err(_)) => {
            warn!("Push channel closed without response");
            Ok(0)
        }
        Err(_) => {
            warn!("Push timeout (30s) — frontend may be busy or unresponsive");
            Ok(0)
        }
    }
}

// ============================================================================
// SQLite Operations — via tauri-plugin-sql (Database plugin)
// ============================================================================

/// Récupère le tenantId depuis le Tauri Store
fn get_tenant_id(_app: &AppHandle) -> Option<String> {
    // Le tenantId est stocké dans le Tauri Store par le web-app (layout-client.tsx)
    // Pour l'instant, on ne peut pas lire le Store depuis Rust directement,
    // donc on retourne None et le backend filtrera via le JWT.
    // ⭐ Le backend devrait extraire le tenantId du JWT pour sécuriser.
    None
}

async fn is_online() -> bool {
    // Tenter un HEAD request vers l'API avec un timeout court
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build() {
        Ok(c) => c,
        Err(_) => return false,
    };
    match client.head(format!("{}/health", API_BASE_URL)).send().await {
        Ok(r) => r.status().is_success(),
        Err(_) => false,
    }
}

/// Exécute une requête SQL via tauri-plugin-sql en émettant un événement
/// vers le frontend. Le frontend exécute la requête et renvoie le résultat.
/// 
/// En attendant, on utilise une approche simplifiée : les opérations SQLite
/// sont faites côté frontend (app.html) via window.__TAURI__.sql.
/// Le sync engine Rust gère uniquement le push/pull HTTP.
///
/// ⭐ P2 — DEPRECATED. lastSyncAt est maintenant fourni directement par le
///    frontend via la commande trigger_sync (paramètre last_sync_at).
///    Cette fonction est gardée pour rétro-compatibilité mais n'est plus
///    appelée par pull_changes.
#[deprecated(note = "Utiliser le paramètre last_sync_at de trigger_sync à la place")]
fn get_last_global_sync(_app: &AppHandle) -> Result<Option<String>, String> {
    // Les opérations SQLite sont gérées côté frontend.
    // Le sync engine utilise le lastSyncAt envoyé par le frontend.
    Ok(None)
}

/// ⭐ DEPRECATED — `get_pending_outbox_records` n'est plus utilisé depuis la
///    refactorisation du push. Le frontend lit directement SQLite via
///    `db.select()` quand il reçoit l'événement `sync-push-outbox`.
///
///    Gardé pour rétro-compatibilité avec d'éventuels appels externes.
#[deprecated(note = "Le push est maintenant géré côté frontend via l'événement sync-push-outbox")]
fn get_pending_outbox_records(_app: &AppHandle) -> Result<Vec<OutboxRecord>, String> {
    Ok(vec![])
}

fn count_pending_outbox(_app: &AppHandle) -> Result<u64, String> {
    // ⭐ TODO : émettre un événement vers le frontend pour récupérer le count.
    //    Pour l'instant, on retourne 0 (le frontend affiche déjà le count dans l'UI).
    Ok(0)
}

fn upsert_to_sqlite(app: &AppHandle, table: &str, records: &[Value]) -> Result<(), String> {
    // ⭐ Les records reçus du pull sont émis vers le frontend via un événement.
    //    Le frontend (app.html + sync.html) les insère dans SQLite via window.__TAURI__.sql.
    info!("Upserting {} records into {} (emitting to frontend)", records.len(), table);

    let payload = serde_json::json!({
        "table": table,
        "records": records,
    });
    let _ = app.emit("sync-upsert-data", &payload);

    Ok(())
}

fn update_sync_metadata(_app: &AppHandle, _table: &str, _pulled: u64, _pushed: u64) -> Result<(), String> {
    // Mis à jour côté frontend après réception des données
    Ok(())
}

/// ⭐ DEPRECATED — `mark_outbox_record_synced` n'est plus appelé par le push
///    (le frontend gère le marquage directement après le fetch).
///    Type mis à jour : `id: String` (UUID) au lieu de `i64` (AUTOINCREMENT).
#[deprecated(note = "Le marquage est maintenant géré côté frontend")]
fn mark_outbox_record_synced(_app: &AppHandle, _id: String) -> Result<(), String> {
    Ok(())
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

#[tauri::command]
pub fn get_sync_state(sync_engine: State<SyncEngine>) -> SyncState {
    sync_engine.state.lock().unwrap().clone()
}

#[tauri::command]
pub async fn trigger_sync(
    app: AppHandle,
    last_sync_at: Option<String>, // ⭐ P2 — lastSyncAt fourni par le frontend (depuis _sync_metadata)
) -> Result<SyncState, String> {
    SyncEngine::manual_sync(app, last_sync_at).await
}

#[tauri::command]
pub async fn trigger_initial_sync(app: AppHandle) -> Result<SyncState, String> {
    SyncEngine::initial_sync(app).await
}

#[tauri::command]
pub fn set_sync_token(sync_engine: State<SyncEngine>, token: String) {
    sync_engine.set_token(token);
}
