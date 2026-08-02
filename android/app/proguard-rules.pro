# ============================================================================
# ProGuard / R8 Rules — Academia Helm Mobile
# ============================================================================
# These rules prevent R8 from stripping code that is needed at runtime
# via reflection (Riverpod, Freezed, json_serializable, Hive, etc.)
# ============================================================================

# ── Flutter ──────────────────────────────────────────────────────────────
# Flutter's main entry point and engine bindings
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.**  { *; }
-keep class io.flutter.plugins.**  { *; }
-dontwarn io.flutter.embedding.**

# ── Generated Code (Freezed / json_serializable) ────────────────────────
# Freezed generates classes that are accessed via reflection
-keep class **.g.dart { *; }
-keep class **.freezed.dart { *; }
-keep class **_freezed { *; }
-keep class **_$_ { *; }
-keep class **$* { *; }
-keepclassmembers class * {
  @com.google.gson.annotations.SerializedName <fields>;
}
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ── Riverpod ─────────────────────────────────────────────────────────────
# Riverpod providers are accessed via reflection
-keep class org.dartlang.riverpod.** { *; }
-keep class riverpod.** { *; }
-keep class **riverpod** { *; }
-keepclassmembers class * extends **riverpod**.** { *; }
-keep class * extends com.riverpod.** { *; }

# ── Hive ────────────────────────────────────────────────────────────────
# Hive type adapters are registered via reflection
-keep class com.hivedb.** { *; }
-keep class **.hive.dart { *; }
-keep class **TypeAdapter { *; }
-keepclassmembers class * implements org.apache.hive.** { *; }
-keep class * extends hive.TypeAdapter { *; }

# ── Retrofit ────────────────────────────────────────────────────────────
# Retrofit uses dynamic proxies and reflection
-keep class retrofit2.** { *; }
-keep interface retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-keepclasseswithmembers interface * {
    @retrofit2.http.* <methods>;
}

# ── Model / DTO classes ─────────────────────────────────────────────────
# Keep all model classes and their fields (used by json_serializable)
-keep class com.academiahelm.mobile.data.models.** { *; }
-keep class com.academiahelm.mobile.domain.entities.** { *; }
-keep class **.models.** { *; }
-keep class **.entities.** { *; }
-keep class **.dto.** { *; }
-keepclassmembers class * {
  @com.google.gson.annotations.Expose <fields>;
}

# ── GoRouter ────────────────────────────────────────────────────────────
# GoRouter routes are registered dynamically
-keep class com.go_router.** { *; }
-keep class go_router.** { *; }

# ── Secure Storage ──────────────────────────────────────────────────────
-keep class com.it_nomads.fluttersecurestorage.** { *; }
-keep class io.flutter.plugins.fluttersecurestorage.** { *; }

# ── Connectivity Plus ──────────────────────────────────────────────────
-keep class com.learnium.flutter_connectivity.** { *; }
-keep class dev.fluttercommunity.plus.connectivity.** { *; }

# ── AndroidX / Material ─────────────────────────────────────────────────
-keep class com.google.android.material.** { *; }
-dontwarn com.google.android.material.**
-keep class androidx.** { *; }
-dontwarn androidx.**

# ── Kotlin Coroutines ──────────────────────────────────────────────────
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}
-keep class kotlinx.coroutines.android.AndroidExceptionPreHandler { *; }
-keep class kotlinx.coroutines.android.AndroidDispatcherFactory { *; }

# ── Preserve enums and reflection data ──────────────────────────────────
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ── Suppress warnings ───────────────────────────────────────────────────
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
-dontwarn org.slf4j.**
-dontwarn javax.naming.**

# ── Google Play Core (referenced by Flutter but not always present) ─────
-dontwarn com.google.android.play.core.**
-dontwarn com.google.android.play.core.splitcompat.**
-keep class com.google.android.play.core.splitcompat.SplitCompatApplication { *; }

# ── Native libraries ────────────────────────────────────────────────────
-keepclasseswithmembernames class * {
    native <methods>;
}
