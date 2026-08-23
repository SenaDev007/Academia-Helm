Helm Connect — Assets directory
=================================

Place app icons, splash screens, and other image assets here.

Recommended structure:
- assets/icons/
  - app_icon.png            (1024x1024 — source for launcher icons)
  - splash.png              (1284x2778 — iPhone 14 Pro Max splash)
- assets/images/
  - logo_helm_connect.svg   (Helm Connect logo SVG)
- assets/fonts/
  - Inter-Regular.ttf
  - Inter-SemiBold.ttf

To generate Android launcher icons from app_icon.png:
  flutter pub run flutter_launcher_icons

Configuration: see flutter_launcher_icons.yaml (to be created).
