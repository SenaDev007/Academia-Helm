use tauri::Manager;

/// Initializes the Tauri application.
///
/// The desktop app loads the `/desktop` route of the Next.js frontend,
/// which handles:
///   1. School selection (first launch) — user searches for their school
///   2. Auto-redirect (subsequent launches) — goes directly to the saved school URL
///   3. Login — user authenticates with their existing credentials
///
/// The school selection is persisted in localStorage by the frontend.
/// No native Rust logic is needed — everything is handled by the web app.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .setup(|_app| {
            // The window URL is configured in tauri.conf.json
            // By default it loads the devUrl (localhost:3000) in dev
            // or the frontendDist (static build) in production
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
