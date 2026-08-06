# iOS Project — Temporary Removal

The `ios/` folder was removed on 2026-08-05 because it was incomplete
(missing `xcshareddata/xcschemes/Runner.xcscheme`, `Flutter/Debug.xcconfig`,
`Podfile`, `Runner.xcworkspace/`, `Main.storyboard`, `Assets.xcassets/`),
which caused Codemagic to fail with:

```
Cannot initialize iOS project, no schemes available for Runner.xcodeproj
```

This blocked the Android build from even starting on Codemagic.

## What was backed up

The following files from the original `ios/` folder are preserved in this
directory (`docs/ios-backup/`) for reference:

- `AppDelegate.swift` — custom Flutter app delegate (currently empty, standard
  Flutter template)
- `Info.plist` — iOS app configuration
- `LaunchScreen.storyboard` — launch screen layout
- `project.pbxproj` — original Xcode project file (incomplete)

## How to restore iOS later

When you are ready to build for iOS (typically on a macOS machine with
Xcode installed), run from the project root:

```bash
flutter create --platforms=ios --project-name=academia_helm_mobile .
```

This will regenerate a complete, valid `ios/` folder with:
- `Runner.xcodeproj/xcshareddata/xcschemes/Runner.xcscheme`
- `Flutter/Debug.xcconfig` and `Release.xcconfig`
- `Podfile` (standard Flutter template)
- `Runner.xcworkspace/`
- `Runner/Base.lproj/Main.storyboard`
- `Runner/Assets.xcassets/`

Then customize the regenerated files with any specific values from the
backed-up files (Info.plist keys, AppDelegate customizations, etc.).

After that:

```bash
cd ios
pod install
cd ..
flutter build ios --release
```

## Recommendation

Prefer building iOS on Codemagic's macOS instances (they have Xcode
preinstalled) rather than locally, unless you have a Mac with Xcode.
