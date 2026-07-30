import 'package:flutter/material.dart';

/// Academia Helm typography system using the Inter font family.
///
/// Defines text styles for display, headline, title, body, label, and caption
/// with appropriate font sizes, weights, line heights, and letter spacings.
class AHTypography {
  AHTypography._();

  static const String _fontFamily = 'Inter';

  // ── Display ───────────────────────────────────────────────────────────

  /// Display Large — 40px, bold, line height 48px
  static const TextStyle displayLarge = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 40,
    fontWeight: FontWeight.w700,
    height: 1.2,
    letterSpacing: -0.5,
  );

  /// Display Medium — 36px, bold, line height 44px
  static const TextStyle displayMedium = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 36,
    fontWeight: FontWeight.w700,
    height: 1.22,
    letterSpacing: -0.4,
  );

  /// Display Small — 32px, bold, line height 40px
  static const TextStyle displaySmall = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 32,
    fontWeight: FontWeight.w700,
    height: 1.25,
    letterSpacing: -0.3,
  );

  // ── Headline ──────────────────────────────────────────────────────────

  /// Headline Large — 28px, semi-bold, line height 36px
  static const TextStyle headlineLarge = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 28,
    fontWeight: FontWeight.w600,
    height: 1.29,
    letterSpacing: -0.2,
  );

  /// Headline Medium — 26px, semi-bold, line height 34px
  static const TextStyle headlineMedium = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 26,
    fontWeight: FontWeight.w600,
    height: 1.31,
    letterSpacing: -0.1,
  );

  /// Headline Small — 24px, semi-bold, line height 32px
  static const TextStyle headlineSmall = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 24,
    fontWeight: FontWeight.w600,
    height: 1.33,
    letterSpacing: 0,
  );

  // ── Title ─────────────────────────────────────────────────────────────

  /// Title Large — 22px, semi-bold, line height 28px
  static const TextStyle titleLarge = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 22,
    fontWeight: FontWeight.w600,
    height: 1.27,
    letterSpacing: 0,
  );

  /// Title Medium — 18px, semi-bold, line height 24px
  static const TextStyle titleMedium = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 18,
    fontWeight: FontWeight.w600,
    height: 1.33,
    letterSpacing: 0.15,
  );

  /// Title Small — 16px, semi-bold, line height 22px
  static const TextStyle titleSmall = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 16,
    fontWeight: FontWeight.w600,
    height: 1.375,
    letterSpacing: 0.1,
  );

  // ── Body ──────────────────────────────────────────────────────────────

  /// Body Large — 16px, regular, line height 24px
  static const TextStyle bodyLarge = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 16,
    fontWeight: FontWeight.w400,
    height: 1.5,
    letterSpacing: 0.5,
  );

  /// Body Medium — 14px, regular, line height 20px
  static const TextStyle bodyMedium = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    height: 1.43,
    letterSpacing: 0.25,
  );

  /// Body Small — 12px, regular, line height 16px
  static const TextStyle bodySmall = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    height: 1.33,
    letterSpacing: 0.4,
  );

  // ── Label ─────────────────────────────────────────────────────────────

  /// Label Large — 12px, medium, line height 16px
  static const TextStyle labelLarge = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.33,
    letterSpacing: 0.5,
  );

  /// Label Medium — 11px, medium, line height 16px
  static const TextStyle labelMedium = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 11,
    fontWeight: FontWeight.w500,
    height: 1.45,
    letterSpacing: 0.5,
  );

  /// Label Small — 10px, medium, line height 14px
  static const TextStyle labelSmall = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 10,
    fontWeight: FontWeight.w500,
    height: 1.4,
    letterSpacing: 0.5,
  );

  // ── Caption ───────────────────────────────────────────────────────────

  /// Caption — 10px, regular, line height 14px
  static const TextStyle caption = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 10,
    fontWeight: FontWeight.w400,
    height: 1.4,
    letterSpacing: 0.4,
  );

  // ── Helper: Build TextTheme ───────────────────────────────────────────

  /// Returns a complete [TextTheme] using AH typography mapped to
  /// Material 3 text theme slots.
  static TextTheme buildTextTheme() {
    return TextTheme(
      displayLarge: displayLarge,
      displayMedium: displayMedium,
      displaySmall: displaySmall,
      headlineLarge: headlineLarge,
      headlineMedium: headlineMedium,
      headlineSmall: headlineSmall,
      titleLarge: titleLarge,
      titleMedium: titleMedium,
      titleSmall: titleSmall,
      bodyLarge: bodyLarge,
      bodyMedium: bodyMedium,
      bodySmall: bodySmall,
      labelLarge: labelLarge,
      labelMedium: labelMedium,
      labelSmall: labelSmall,
    );
  }
}
