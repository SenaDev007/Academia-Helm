# Platform Configuration — Academia Helm Mobile

> Reference document for Android and iOS platform configuration.
> These settings must be applied when the Flutter project generates
> the native platform directories (`android/`, `ios/`).

---

## 1. Android Configuration

### 1.1 `android/app/build.gradle`

```gradle
android {
    namespace "com.yehior.academiahelm"
    compileSdkVersion 34

    defaultConfig {
        applicationId "com.yehior.academiahelm"
        minSdkVersion 24
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
        multiDexEnabled true
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
        debug {
            debuggable true
            applicationIdSuffix ".debug"
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }

    // Product flavors (optional, for white-label builds)
    flavorDimensions = ["tenant"]
    productFlavors {
        defaultSchool {
            dimension "tenant"
            applicationId "com.yehior.academiahelm"
        }
        customSchool {
            dimension "tenant"
            applicationId "com.yehior.academiahelm.custom"
        }
    }
}

dependencies {
    implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk7:$kotlin_version"
    implementation 'androidx.multidex:multidex:2.0.1'
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
}
```

### 1.2 `android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Network -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Camera & Media -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />

    <!-- Notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <!-- Biometric -->
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />

    <!-- Background -->
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher"
        android:label="Academia Helm"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/LaunchTheme"
        android:usesCleartextTraffic="false"
        android:networkSecurityConfig="@xml/network_security_config"
        android:enableOnBackInvokedCallback="true">

        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:exported="true"
            android:hardwareAccelerated="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:windowSoftInputMode="adjustResize">

            <meta-data
                android:name="io.flutter.embedding.android.NormalTheme"
                android:resource="@style/NormalTheme" />

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Firebase Messaging -->
        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>

        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />

        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="academia_helm_notifications" />

        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_notification" />

        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/ah_navy" />
    </application>
</manifest>
```

### 1.3 `android/app/src/main/res/xml/network_security_config.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
    </domain-config>
</network-security-config>
```

### 1.4 `android/app/src/main/res/values/colors.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ah_navy">#0B2F73</color>
    <color name="ah_gold">#F5B335</color>
    <color name="ah_navy_dark">#081F4C</color>
</resources>
```

---

## 2. iOS Configuration

### 2.1 `ios/Runner/Info.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>fr</string>
    <key>CFBundleDisplayName</key>
    <string>Academia Helm</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>com.yehior.academiahelm</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>Academia Helm</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleVersion</key>
    <string>1</string>

    <!-- App Transport Security -->
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <false/>
        <key>NSExceptionDomains</key>
        <dict>
            <key>localhost</key>
            <dict>
                <key>NSExceptionAllowsInsecureHTTPLoads</key>
                <true/>
            </dict>
        </dict>
    </dict>

    <!-- Camera Permission -->
    <key>NSCameraUsageDescription</key>
    <string>Academia Helm a besoin d'accéder à votre appareil photo pour prendre des photos de profil et scanner des documents.</string>

    <!-- Photo Library Permission -->
    <key>NSPhotoLibraryUsageDescription</key>
    <string>Academia Helm a besoin d'accéder à votre galerie pour sélectionner des photos et des documents.</string>

    <!-- Notifications -->
    <key>UIBackgroundModes</key>
    <array>
        <string>fetch</string>
        <string>remote-notification</string>
    </array>

    <!-- Status Bar -->
    <key>UIStatusBarStyle</key>
    <string>UIStatusBarStyleLightContent</string>
    <key>UIViewControllerBasedStatusBarAppearance</key>
    <false/>

    <!-- Interface Orientations (iPhone) -->
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
    </array>

    <!-- Interface Orientations (iPad) -->
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationPortraitUpsideDown</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>

    <!-- Launch Screen -->
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>

    <!-- Requires full screen -->
    <key>UIRequiresFullScreen</key>
    <false/>

    <!-- Supports opening documents -->
    <key>CFBundleDocumentTypes</key>
    <array/>
</dict>
</plist>
```

### 2.2 `ios/Runner/AppDelegate.swift`

```swift
import UIKit
import Flutter

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        GeneratedPluginRegistrant.register(with: self)
        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
}
```

---

## 3. Signing & Release

### 3.1 Android Signing

Create a keystore:
```bash
keytool -genkey -v -keystore academia-helm-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias academia-helm
```

Create `android/key.properties`:
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=academia-helm
storeFile=/path/to/academia-helm-release.jks
```

### 3.2 iOS Signing

- Open `ios/Runner.xcworkspace` in Xcode
- Set Team to your Apple Developer account
- Set Bundle Identifier to `com.yehior.academiahelm`
- Configure provisioning profiles for Development & Distribution

---

## 4. Firebase Configuration

### 4.1 Android

Place `google-services.json` in `android/app/`.

### 4.2 iOS

Place `GoogleService-Info.plist` in `ios/Runner/`.

### 4.3 Flutter

The `firebase_core` and `firebase_messaging` packages are already in `pubspec.yaml`.
Initialize Firebase in `main.dart` before `runApp()` if push notifications are needed.

---

## 5. Build Commands

```bash
# Android APK (debug)
flutter build apk --debug

# Android APK (release)
flutter build apk --release

# Android App Bundle (release, for Play Store)
flutter build appbundle --release

# iOS (requires macOS + Xcode)
flutter build ios --release

# Run on connected device
flutter run
```

---

## 6. Key Version Requirements

| Item                | Version |
|---------------------|---------|
| minSdkVersion       | 24      |
| targetSdkVersion    | 34      |
| compileSdkVersion   | 34      |
| iOS Deployment Target | 13.0  |
| Kotlin              | 1.9.x   |
| Gradle              | 8.x     |
| Java                | 17      |
| Flutter             | 3.22+   |
| Dart                | 3.2+    |

---

*Document version: 1.0.0*
*Last updated: 2025*
