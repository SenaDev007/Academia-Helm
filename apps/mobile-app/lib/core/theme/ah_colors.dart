import 'package:flutter/material.dart';

/// Academia Helm brand color palette and semantic colors.
///
/// Provides static const colors for the AH brand (navy, blue, gold),
/// semantic colors (success, warning, error, info), and surface/background
/// colors for both light and dark modes.
class AHColors {
  AHColors._();

  // ── Brand Colors ──────────────────────────────────────────────────────

  static const Color navy = Color(0xFF0B2F73);
  static const Color navyDark = Color(0xFF071D4A);
  static const Color navyLight = Color(0xFF1A3F8B);
  static const Color blue = Color(0xFF1D4FA5);
  static const Color gold = Color(0xFFF5B335);
  static const Color goldLight = Color(0xFFFCD779);
  static const Color white = Color(0xFFFFFFFF);

  // ── Brand Aliases (for semantic clarity) ──────────────────────────────

  static const Color primary = navy;
  static const Color primaryDark = navyDark;
  static const Color secondary = blue;
  static const Color accent = gold;
  static const Color accentLight = goldLight;

  // ── Semantic Colors ───────────────────────────────────────────────────

  static const Color success = Color(0xFF16A34A);
  static const Color successLight = Color(0xFFDCFCE7);
  static const Color successDark = Color(0xFF15803D);

  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color warningDark = Color(0xFFD97706);

  static const Color error = Color(0xFFDC2626);
  static const Color errorLight = Color(0xFFFEE2E2);
  static const Color errorDark = Color(0xFFB91C1C);

  static const Color info = Color(0xFF2563EB);
  static const Color infoLight = Color(0xFFDBEAFE);
  static const Color infoDark = Color(0xFF1D4ED8);

  // ── Light Mode Surface & Background ───────────────────────────────────

  static const Color lightBackground = Color(0xFFF8FAFC);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightSurfaceVariant = Color(0xFFF1F5F9);
  static const Color lightSurfaceContainerHighest = Color(0xFFE2E8F0);
  static const Color lightOutline = Color(0xFFCBD5E1);
  static const Color lightOutlineVariant = Color(0xFFE2E8F0);
  static const Color lightOnBackground = Color(0xFF0F172A);
  static const Color lightOnSurface = Color(0xFF0F172A);
  static const Color lightOnSurfaceVariant = Color(0xFF475569);
  static const Color lightInverseSurface = Color(0xFF1E293B);
  static const Color lightInverseOnSurface = Color(0xFFF1F5F9);

  // ── Dark Mode Surface & Background ────────────────────────────────────

  static const Color darkBackground = Color(0xFF0F172A);
  static const Color darkSurface = Color(0xFF1E293B);
  static const Color darkSurfaceVariant = Color(0xFF334155);
  static const Color darkSurfaceContainerHighest = Color(0xFF475569);
  static const Color darkOutline = Color(0xFF475569);
  static const Color darkOutlineVariant = Color(0xFF334155);
  static const Color darkOnBackground = Color(0xFFF1F5F9);
  static const Color darkOnSurface = Color(0xFFF1F5F9);
  static const Color darkOnSurfaceVariant = Color(0xFFCBD5E1);
  static const Color darkInverseSurface = Color(0xFFF1F5F9);
  static const Color darkInverseOnSurface = Color(0xFF1E293B);

  // ── Neutral Greys ─────────────────────────────────────────────────────

  static const Color grey50 = Color(0xFFF8FAFC);
  static const Color grey100 = Color(0xFFF1F5F9);
  static const Color grey200 = Color(0xFFE2E8F0);
  static const Color grey300 = Color(0xFFCBD5E1);
  static const Color grey400 = Color(0xFF94A3B8);
  static const Color grey500 = Color(0xFF64748B);
  static const Color grey600 = Color(0xFF475569);
  static const Color grey700 = Color(0xFF334155);
  static const Color grey800 = Color(0xFF1E293B);
  static const Color grey900 = Color(0xFF0F172A);

  // ── Grey Aliases (American spelling) ─────────────────────────────────

  static const Color gray50 = grey50;
  static const Color gray100 = grey100;
  static const Color gray200 = grey200;
  static const Color gray300 = grey300;
  static const Color gray400 = grey400;
  static const Color gray500 = grey500;
  static const Color gray600 = grey600;
  static const Color gray700 = grey700;
  static const Color gray800 = grey800;
  static const Color gray900 = grey900;

  // ── Overlay & Scrim ───────────────────────────────────────────────────

  static const Color overlay = Color(0x52000000);
  static const Color scrim = Color(0xBF000000);
  static const Color disabled = Color(0x61000000);
  static const Color disabledBackground = Color(0x1F000000);

  // ── Divider ───────────────────────────────────────────────────────────

  static const Color lightDivider = Color(0xFFE2E8F0);
  static const Color darkDivider = Color(0xFF334155);

  // ── Transparent ───────────────────────────────────────────────────────

  static const Color transparent = Color(0x00000000);
}
