use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager, State};
use log::{info, warn, error};

// ============================================================================
// SYNC ENGINE — Implémentation complète avec appels HTTP
// ============================================================================

const SYNC_INTERVAL_MS: u64 = 60 * 60 * 1000; // 1 heure
const BATCH_SIZE: usize = 500;
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
    pub id: i64,
    pub table_name: String,
    pub record_id: String,
    pub operation: String,
    pub data: String,
    pub created_at: String,
    pub retry_count: u32,
}

/// Réponse de l'API /api/sync/pull
#[derive(Deserialize)]
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
}

#[derive(Serialize)]
struct PushRecord {
    table_name: String,
    record_id: String,
    operation: String,
    data: Value,
    client_timestamp: String,
}

/// Réponse de l'API /api/sync/push
#[derive(Deserialize)]
struct PushResponse {
    success: bool,
    pushed_at: String,
    total: u64,
    #[serde(rename = "success")]
    success_count: u64,
    conflicts: u64,
    errors: u64,
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
                let _ = run_sync(app.clone(), "auto").await;
            }
        });
    }

    pub async fn initial_sync(app: AppHandle) -> Result<SyncState, String> {
        run_sync(app, "initial").await
    }

    pub async fn manual_sync(app: AppHandle) -> Result<SyncState, String> {
        run_sync(app, "manual").await
    }
}

async fn run_sync(app: AppHandle, sync_type: &str) -> Result<SyncState, String> {
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
    match pull_changes(&app, sync_type).await {
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

async fn pull_changes(app: &AppHandle, sync_type: &str) -> Result<u64, String> {
    let sync_engine = app.state::<SyncEngine>();
    let token = sync_engine.access_token.lock().unwrap().clone();

    if token.is_none() {
        return Err("No access token — user not authenticated".to_string());
    }

    // Pour la sync initiale, on n'envoie pas lastSyncAt
    let last_sync = if sync_type == "initial" {
        None
    } else {
        get_last_global_sync(app).ok().flatten()
    };

    // Construire le body de la requête
    let body = serde_json::json!({
        "lastSyncAt": last_sync,
        "limit": BATCH_SIZE,
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

async fn push_outbox(app: &AppHandle) -> Result<u64, String> {
    let pending = get_pending_outbox_records(app)?;
    if pending.is_empty() {
        return Ok(0);
    }

    let sync_engine = app.state::<SyncEngine>();
    let token = sync_engine.access_token.lock().unwrap().clone();

    if token.is_none() {
        return Err("No access token".to_string());
    }

    // Construire les records à pusher
    let push_records: Vec<PushRecord> = pending
        .iter()
        .map(|r| PushRecord {
            table_name: r.table_name.clone(),
            record_id: r.record_id.clone(),
            operation: r.operation.clone(),
            data: serde_json::from_str(&r.data).unwrap_or(Value::Null),
            client_timestamp: r.created_at.clone(),
        })
        .collect();

    let push_request = PushRequest { records: push_records };

    // Appel HTTP vers /api/sync/push
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/sync/push", API_BASE_URL))
        .header("Authorization", format!("Bearer {}", token.unwrap()))
        .header("Content-Type", "application/json")
        .json(&push_request)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Push API error {}: {}", status, text));
    }

    let push_response: PushResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse push response: {}", e))?;

    // Marquer les records comme synchronisés
    for record in &pending {
        let _ = mark_outbox_record_synced(app, record.id);
    }

    info!("Pushed {} records (success: {}, conflicts: {}, errors: {})",
          push_response.total, push_response.success_count, push_response.conflicts, push_response.errors);

    Ok(push_response.success_count)
}

// ============================================================================
// SQLite Operations (via tauri-plugin-sql)
// ============================================================================

async fn is_online() -> bool {
    // Tenter un HEAD request vers l'API avec un timeout court
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build();
    match client {
        Ok(c) => {
            match c.head(format!("{}/health", API_BASE_URL)).send().await {
                Ok(r) => r.status().is_success(),
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

fn get_last_global_sync(app: &AppHandle) -> Result<Option<String>, String> {
    let db = app.state::<tauri_plugin_sql::DbInstances>();
    let pool = db.get("sqlite:academia_helm.db", None)
        .map_err(|e| format!("DB pool error: {}", e))?;

    let row: Option<(String,)> = tauri::async_runtime::block_on(async move {
        sqlx::query_as("SELECT last_sync_at FROM _sync_metadata ORDER BY last_sync_at DESC LIMIT 1")
            .fetch_optional(&*pool.lock().await)
            .await
    })
    .map_err(|e| format!("SQL query failed: {}", e))?;

    Ok(row.map(|(ts,)| ts))
}

fn get_pending_outbox_records(app: &AppHandle) -> Result<Vec<OutboxRecord>, String> {
    let db = app.state::<tauri_plugin_sql::DbInstances>();
    let pool = db.get("sqlite:academia_helm.db", None)
        .map_err(|e| format!("DB pool error: {}", e))?;

    let rows: Vec<(i64, String, String, String, String, String, i32)> =
        tauri::async_runtime::block_on(async move {
            sqlx::query_as(
                "SELECT id, table_name, record_id, operation, data, created_at, retry_count \
                 FROM _sync_outbox WHERE status = 'pending' ORDER BY created_at LIMIT 500"
            )
            .fetch_all(&*pool.lock().await)
            .await
        })
        .map_err(|e| format!("SQL query failed: {}", e))?;

    Ok(rows.into_iter().map(|r| OutboxRecord {
        id: r.0,
        table_name: r.1,
        record_id: r.2,
        operation: r.3,
        data: r.4,
        created_at: r.5,
        retry_count: r.4.parse().unwrap_or(0),
    }).collect())
}

fn count_pending_outbox(app: &AppHandle) -> Result<u64, String> {
    let db = app.state::<tauri_plugin_sql::DbInstances>();
    let pool = db.get("sqlite:academia_helm.db", None)
        .map_err(|e| format!("DB pool error: {}", e))?;

    let count: (i64,) = tauri::async_runtime::block_on(async move {
        sqlx::query_as("SELECT COUNT(*) FROM _sync_outbox WHERE status = 'pending'")
            .fetch_one(&*pool.lock().await)
            .await
    })
    .map_err(|e| format!("SQL query failed: {}", e))?;

    Ok(count.0 as u64)
}

fn upsert_to_sqlite(app: &AppHandle, table: &str, records: &[Value]) -> Result<(), String> {
    if records.is_empty() {
        return Ok(());
    }

    let db = app.state::<tauri_plugin_sql::DbInstances>();
    let pool = db.get("sqlite:academia_helm.db", None)
        .map_err(|e| format!("DB pool error: {}", e))?;

    // Pour chaque record, faire INSERT OR REPLACE
    // On utilise une approche générique : convertir le record JSON en colonnes/valeurs
    for record in records {
        if let Some(obj) = record.as_object() {
            let columns: Vec<String> = obj.keys().cloned().collect();
            let placeholders: Vec<String> = (1..=columns.len())
                .map(|i| format!("?{}", i))
                .collect();
            let values: Vec<String> = obj.values()
                .map(|v| match v {
                    Value::String(s) => format!("'{}'", s.replace("'", "''")),
                    Value::Number(n) => n.to_string(),
                    Value::Bool(b) => if *b { "1".to_string() } else { "0".to_string() },
                    Value::Null => "NULL".to_string(),
                    _ => format!("'{}'", v.to_string().replace("'", "''")),
                })
                .collect();

            let sql = format!(
                "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                table,
                columns.join(", "),
                values.join(", ")
            );

            let pool_clone = pool.clone();
            let sql_clone = sql.clone();
            let table_clone = table.to_string();
            tauri::async_runtime::block_on(async move {
                let locked = pool_clone.lock().await;
                if let Err(e) = sqlx::query(&sql_clone).execute(&*locked).await {
                    warn!("Upsert failed for table {}: {}", table_clone, e);
                }
            });
        }
    }

    info!("Upserted {} records into {}", records.len(), table);
    Ok(())
}

fn update_sync_metadata(app: &AppHandle, table: &str, pulled: u64, pushed: u64) -> Result<(), String> {
    let db = app.state::<tauri_plugin_sql::DbInstances>();
    let pool = db.get("sqlite:academia_helm.db", None)
        .map_err(|e| format!("DB pool error: {}", e))?;

    let pool_clone = pool.clone();
    let table_clone = table.to_string();
    tauri::async_runtime::block_on(async move {
        let locked = pool_clone.lock().await;
        let sql = "INSERT OR REPLACE INTO _sync_metadata (table_name, last_sync_at, records_pulled, records_pushed) VALUES (?1, datetime('now'), ?2, ?3)";
        let _ = sqlx::query(sql)
            .bind(&table_clone)
            .bind(pulled as i64)
            .bind(pushed as i64)
            .execute(&*locked)
            .await;
    });

    Ok(())
}

fn mark_outbox_record_synced(app: &AppHandle, id: i64) -> Result<(), String> {
    let db = app.state::<tauri_plugin_sql::DbInstances>();
    let pool = db.get("sqlite:academia_helm.db", None)
        .map_err(|e| format!("DB pool error: {}", e))?;

    let pool_clone = pool.clone();
    tauri::async_runtime::block_on(async move {
        let locked = pool_clone.lock().await;
        let sql = "UPDATE _sync_outbox SET status = 'synced', synced_at = datetime('now') WHERE id = ?1";
        let _ = sqlx::query(sql).bind(id).execute(&*locked).await;
    });

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
pub async fn trigger_sync(app: AppHandle) -> Result<SyncState, String> {
    SyncEngine::manual_sync(app).await
}

#[tauri::command]
pub async fn trigger_initial_sync(app: AppHandle) -> Result<SyncState, String> {
    SyncEngine::initial_sync(app).await
}

#[tauri::command]
pub fn set_sync_token(sync_engine: State<SyncEngine>, token: String) {
    sync_engine.set_token(token);
}
