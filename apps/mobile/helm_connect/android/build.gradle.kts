// ============================================================================
// Helm Connect — Project-level Gradle build file (Kotlin DSL)
// ============================================================================
// ⭐ FIX V3-7: Added buildscript block (matching apps/mobile-app pattern)
//    so that subprojects like audioplayers_android can resolve
//    kotlin-gradle-plugin + android-junit5 from the correct repos.
// ============================================================================

buildscript {
    // ⭐ V3-11: Upgrade Kotlin to 2.2.20 (Flutter requires ≥2.2.20)
    val kotlinVersion by extra("2.2.20")
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://maven.google.com") }
        maven { url = uri("https://repo1.maven.org/maven2") }
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")
        classpath("com.android.tools.build:gradle:8.11.1")
        classpath("com.google.gms:google-services:4.4.2")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://maven.google.com") }
        maven { url = uri("https://repo1.maven.org/maven2") }
    }
}

val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

subprojects {
    project.evaluationDependsOn(":app")
}

// ⭐ FIX: Force all subprojects' buildscript repositories to include our repos
//    This is needed because flutter_webrtc + audioplayers_android have their own
//    build.gradle files with buildscript blocks that reference Maven Central
//    (repo.maven.apache.org) which may fail DNS resolution.
subprojects {
    project.buildscript {
        repositories {
            google()
            mavenCentral()
            maven { url = uri("https://maven.google.com") }
            maven { url = uri("https://repo1.maven.org/maven2") }
        }
    }
    project.repositories {
        google()
        mavenCentral()
        maven { url = uri("https://maven.google.com") }
        maven { url = uri("https://repo1.maven.org/maven2") }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
