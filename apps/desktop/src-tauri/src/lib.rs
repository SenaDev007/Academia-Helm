use tauri::Manager;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

mod sync;

use sync::{SyncEngine, get_sync_state, trigger_sync, trigger_initial_sync, set_sync_token};

/// Initializes the Tauri application.
///
/// Architecture offline-first :
///   - L'app desktop charge une interface LOCALE (bundlée dans l'exe)
///   - SQLite locale (624 tables, schéma complet comme Neon)
///   - Sync automatique toutes les 1 heure (Neon ↔ SQLite)
///   - Bouton "Synchroniser" manuel dans le header
///   - Outbox : les écritures offline sont mises en file d'attente
///   - Sync initiale au premier lancement (télécharge toutes les données)
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:academia_helm.db", vec![
                    tauri_plugin_sql::Migration {
                        version: 1,
                        description: "create_offline_cache_tables",
                        sql: include_str!("../migrations/001_init_offline_cache.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    },
                    tauri_plugin_sql::Migration {
                        version: 2,
                        description: "create_full_schema",
                        sql: include_str!("../migrations/002_full_schema_sqlite.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    },
                    tauri_plugin_sql::Migration {
                        version: 3,
                        description: "create_outbox_triggers",
                        sql: include_str!("../migrations/003_outbox_triggers.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    },
                ])
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(SyncEngine::new())
        .invoke_handler(tauri::generate_handler![
            get_sync_state,
            trigger_sync,
            trigger_initial_sync,
            set_sync_token,
        ])
        .setup(|app| {
            // ── Démarrer la sync automatique (toutes les 1 heure) ──
            let handle = app.handle().clone();
            SyncEngine::start_auto_sync(handle);

            // ── Vérifier les mises à jour au démarrage ──
            let update_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(update_handle).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Vérifie si une mise à jour est disponible.
async fn check_for_updates(app: tauri::AppHandle) {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    log::info!(
                        "Mise à jour disponible: {} → {}",
                        update.current_version,
                        update.version
                    );

                    app.notification()
                        .builder()
                        .title("Mise à jour Academia Helm disponible")
                        .body(format!(
                            "Version {} disponible (actuel: {}). Cliquez pour installer.",
                            update.version, update.current_version
                        ))
                        .show()
                        .ok();
                }
                Ok(None) => {
                    log::info!("Academia Helm est à jour");
                }
                Err(e) => {
                    log::warn!("Erreur lors de la vérification des mises à jour: {}", e);
                }
            }
        }
        Err(e) => {
            log::warn!("Updater non configuré: {}", e);
        }
    }
}
