// ============================================================================
// HELM CONNECT — Flutter Mobile App
// ============================================================================
// Identité visuelle : Azure + Cyan (cf. helm-theme web)
//   Primary:   #1677FF
//   Primary Dark: #0958D9
//   Primary Light: #E6F4FF
//   Accent:    #13C2C2
//   Background: #F5F7FA
//   Surface:   #FFFFFF
//   Text:      #172033
//
// Dark Mode :
//   Background: #0B1220
//   Surface:    #111827
//   Primary:    #3B9EFF
//   Accent:     #22D3EE
// ============================================================================

import 'package:flutter/material.dart';

class HelmColors {
  // Light theme
  static const Color primary = Color(0xFF1677FF);
  static const Color primaryDark = Color(0xFF0958D9);
  static const Color primaryLight = Color(0xFFE6F4FF);
  static const Color accent = Color(0xFF13C2C2);
  static const Color background = Color(0xFFF5F7FA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color text = Color(0xFF172033);
  static const Color textMuted = Color(0xFF667085);

  // Dark theme
  static const Color darkPrimary = Color(0xFF3B9EFF);
  static const Color darkAccent = Color(0xFF22D3EE);
  static const Color darkBackground = Color(0xFF0B1220);
  static const Color darkSurface = Color(0xFF111827);
  static const Color darkSurface2 = Color(0xFF182235);
  static const Color darkText = Color(0xFFF8FAFC);
  static const Color darkTextMuted = Color(0xFF94A3B8);

  // Functional colors (always the same)
  static const Color success = Color(0xFF16A34A);
  static const Color danger = Color(0xFFDC2626);
  static const Color warning = Color(0xFFF59E0B);

  // Bubble colors
  static const Color bubbleReceived = surface; // white
  static const Color bubbleSent = primaryLight; // #E6F4FF
  static const Color bubbleSentDark = Color(0xFF1E3A8A); // dark blue
}

class HelmThemes {
  static ThemeData lightTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: HelmColors.primary,
      scaffoldBackgroundColor: HelmColors.background,
      colorScheme: const ColorScheme.light(
        primary: HelmColors.primary,
        onPrimary: Colors.white,
        secondary: HelmColors.accent,
        onSecondary: Colors.white,
        surface: HelmColors.surface,
        onSurface: HelmColors.text,
        background: HelmColors.background,
        onBackground: HelmColors.text,
        error: HelmColors.danger,
        onError: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: HelmColors.primaryDark,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: HelmColors.primary,
        foregroundColor: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: HelmColors.primary,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: HelmColors.background,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: HelmColors.primary, width: 2),
        ),
      ),
      cardTheme: CardTheme(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: HelmColors.surface,
      ),
    );
  }

  static ThemeData darkTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: HelmColors.darkBackground,
      colorScheme: const ColorScheme.dark(
        primary: HelmColors.darkPrimary,
        onPrimary: Colors.white,
        secondary: HelmColors.darkAccent,
        onSecondary: Colors.white,
        surface: HelmColors.darkSurface,
        onSurface: HelmColors.darkText,
        background: HelmColors.darkBackground,
        onBackground: HelmColors.darkText,
        error: HelmColors.danger,
        onError: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: HelmColors.darkSurface,
        foregroundColor: HelmColors.darkText,
        elevation: 0,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: HelmColors.darkPrimary,
        foregroundColor: Colors.white,
      ),
      cardTheme: CardTheme(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: HelmColors.darkSurface,
      ),
    );
  }
}
