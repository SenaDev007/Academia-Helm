import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Official brand SVG icons for social media.
///
/// Reproduces the exact SVG paths used by the web app's footer
/// (apps/web-app/src/components/ui/footer-2.tsx lines 69-99).
/// Each icon is rendered via flutter_svg from the official brand SVG.
class SocialIcons {
  SocialIcons._();

  /// Facebook logo (official 24x24 path).
  /// Brand color: #1877F2
  static const String facebookSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073c0 6.025 4.388 11.02 10.125 11.927V15.56H7.078v-3.487h3.047V9.414c0-3.007 1.792-4.669 4.533-4.669 1.313 0 2.686.236 2.686.236v2.953h-1.514c-1.491 0-1.956.93-1.956 1.885v2.254h3.328l-.532 3.487h-2.796V24C19.612 23.093 24 18.098 24 12.073z"/>
</svg>
''';

  /// LinkedIn logo (official 24x24 path).
  /// Brand color: #0A66C2
  static const String linkedInSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M20.447 20.452H16.89v-5.569c0-1.328-.025-3.037-1.851-3.037-1.854 0-2.136 1.446-2.136 2.939v5.667H9.346V9h3.415v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.603 0 4.268 2.372 4.268 5.455v6.286zM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126zM7.119 20.452H3.553V9H7.12v11.452z"/>
</svg>
''';

  /// X (Twitter) logo (official 24x24 path).
  /// Brand color: #000000
  static const String xSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M18.244 2H21l-6.56 7.496L22.15 22H16.11l-4.73-6.186L5.97 22H3.21l7.014-8.013L1.85 2h6.194l4.274 5.648L18.244 2zm-.967 18.35h1.53L7.206 3.565H5.564L17.277 20.35z"/>
</svg>
''';

  /// YouTube logo (official 24x24 path).
  /// Brand color: #FF0000
  static const String youTubeSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M23.498 6.186a2.997 2.997 0 0 0-2.11-2.12C19.503 3.5 12 3.5 12 3.5s-7.504 0-9.388.565a2.997 2.997 0 0 0-2.11 2.12A31.21 31.21 0 0 0 0 12a31.21 31.21 0 0 0 .502 5.814 2.997 2.997 0 0 0 2.11 2.12C4.496 20.5 12 20.5 12 20.5s7.503 0 9.388-.565a2.997 2.997 0 0 0 2.11-2.12A31.21 31.21 0 0 0 24 12a31.21 31.21 0 0 0-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
</svg>
''';

  /// Builds a circular social icon button with the brand color background.
  static Widget buildSocialIcon({
    required String svgString,
    required Color brandColor,
    required String url,
    required String label,
    double size = 36,
  }) {
    return Builder(
      builder: (context) => Material(
        color: brandColor,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () async {
            final uri = Uri.parse(url);
            if (await canLaunchUrl(uri)) {
              await launchUrl(uri, mode: LaunchMode.externalApplication);
            }
          },
          child: SizedBox(
            width: size,
            height: size,
            child: Center(
              child: SvgPicture.string(
                svgString,
                width: size * 0.45,
                height: size * 0.45,
                colorFilter: const ColorFilter.mode(
                  Colors.white,
                  BlendMode.srcIn,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// Re-export launchUrl for convenience
export 'package:url_launcher/url_launcher.dart' show canLaunchUrl, launchUrl, LaunchMode;
