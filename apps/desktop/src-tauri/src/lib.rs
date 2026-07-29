use tauri::Manager;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::UpdaterExt;

/// Initializes the Tauri application.
///
/// Architecture :
///   - L'app desktop charge https://app.academiahelm.com/desktop (URL distante)
///   - AUCUN rebuild nécessaire quand le web est mis à jour
///   - L'utilisateur voit toujours la dernière version du web
///   - Le binaire Tauri (.exe) ne change QUE pour les mises à jour natives
///     (Rust, permissions, configuration de la fenêtre)
///
/// Auto-update :
///   - Vérifie https://releases.academiahelm.com/desktop/... au démarrage
///   - Si une nouvelle version est disponible → notification + bouton "Mettre à jour"
///   - Le promoteur voit aussi un badge dans son interface web (header)
///
/// Base de données locale (SQLite) :
///   - tauri-plugin-sql embarque SQLite dans l'app desktop
///   - Synchronisation avec Neon PostgreSQL quand la connexion est rétablie
///   - Mode offline : lectures depuis SQLite local
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
                ])
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // ── Vérifier les mises à jour au démarrage ──
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(handle).await;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Vérifie si une mise à jour est disponible.
/// Si oui, affiche une notification native à l'utilisateur.
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

                    // Afficher une notification native
                    app.notification()
                        .builder()
                        .title("Mise à jour Academia Helm disponible")
                        .body(format!(
                            "Version {} disponible (actuel: {}). Cliquez pour installer.",
                            update.version, update.current_version
                        ))
                        .show()
                        .ok();

                    // TODO: émettre un événement au frontend pour afficher
                    // un badge "Mise à jour disponible" dans le header
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
