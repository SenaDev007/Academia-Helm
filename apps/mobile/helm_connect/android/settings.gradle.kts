// ============================================================================
// Helm Connect — Settings Gradle (AGP 8.x + Flutter declarative plugins)
// ============================================================================
// ⚠️ Flutter's app_plugin_loader is no longer applied imperatively.
//    We use the declarative plugins block instead.
// ============================================================================

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }

    // ⭐ Declarative Flutter Gradle plugin (replaces app_plugin_loader.gradle)
    val flutterSdkPath = run {
        val properties = java.util.Properties()
        file("local.properties").inputStream().use { properties.load(it) }
        val sdk = properties.getProperty("flutter.sdk")
            ?: throw RuntimeException("flutter.sdk not set in local.properties")
        sdk
    }
    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "8.3.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.10" apply false
}

include ":app"
