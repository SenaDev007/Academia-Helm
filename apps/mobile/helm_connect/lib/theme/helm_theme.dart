// ============================================================================
// HELM CONNECT — Flutter Mobile App Theme (V3-10)
// ============================================================================
// Identité visuelle : Royal Blue + Living Gold (Academia Helm palette)
//   Primary:      #0A2A5E (Royal Blue night)
//   Primary Mid:  #114FC4 (Royal Blue mid)
//   Primary Vivid: #1C6FE8 (Royal Blue vivid)
//   Gold:         #CFA63A (Academia Helm gold)
//   Gold Light:   #FFE08A (bright gold)
//   Background:   #F5F7FA
//   Surface:      #FFFFFF
//   Text:         #172033
//
// Dark Mode :
//   Background: #0B1220
//   Surface:    #111827
//   Primary:    #1C6FE8
//   Gold:       #F5B335
// ============================================================================

import 'package:flutter/material.dart';

class HelmColors {
  // Light theme — Academia Helm Royal Blue + Gold
  static const Color primary = Color(0xFF0A2A5E);     // Royal Blue night
  static const Color primaryMid = Color(0xFF114FC4);   // Royal Blue mid
  static const Color primaryVivid = Color(0xFF1C6FE8); // Royal Blue vivid
  static const Color gold = Color(0xFFCFA63A);         // Academia Helm gold
  static const Color goldLight = Color(0xFFFFE08A);   // Bright gold
  static const Color accent = Color(0xFF1C6FE8);       // Same as primaryVivid
  static const Color background = Color(0xFFF5F7FA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color text = Color(0xFF172033);
  static const Color textMuted = Color(0xFF667085);

  // Dark theme
  static const Color darkPrimary = Color(0xFF1C6FE8);
  static const Color darkGold = Color(0xFFF5B335);
  static const Color darkBackground = Color(0xFF0B1220);
  static const Color darkSurface = Color(0xFF111827);
  static const Color darkSurface2 = Color(0xFF182235);
  static const Color darkText = Color(0xFFF8FAFC);
  static const Color darkTextMuted = Color(0xFF94A3B8);

  // Functional colors
  static const Color success = Color(0xFF16A34A);
  static const Color danger = Color(0xFFDC2626);
  static const Color warning = Color(0xFFF59E0B);

  // Bubble colors
  static const Color bubbleReceived = surface;
  static const Color bubbleSent = Color(0xFFE6F4FF);
}

class HelmThemes {
  static ThemeData lightTheme() {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: HelmColors.primary,
      onPrimary: Colors.white,
      secondary: HelmColors.accent,
      onSecondary: Colors.white,
      surface: HelmColors.surface,
      onSurface: HelmColors.text,
      error: HelmColors.danger,
      onError: Colors.white,
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: HelmColors.background,
      appBarTheme: const AppBarTheme(
        backgroundColor: HelmColors.primary,    // Royal Blue #0A2A5E
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: HelmColors.primaryVivid, // #1C6FE8
        foregroundColor: Colors.white,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: HelmColors.primary,     // Royal Blue
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
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: HelmColors.surface,
      ),
    );
  }

  static ThemeData darkTheme() {
    const colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: HelmColors.darkPrimary,     // #1C6FE8
      onPrimary: Colors.white,
      secondary: HelmColors.darkGold,      // #F5B335
      onSecondary: Color(0xFF0A2A5E),
      surface: HelmColors.darkSurface,
      onSurface: HelmColors.darkText,
      error: HelmColors.danger,
      onError: Colors.white,
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: HelmColors.darkBackground,
      appBarTheme: const AppBarTheme(
        backgroundColor: HelmColors.darkSurface,
        foregroundColor: HelmColors.darkText,
        elevation: 0,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: HelmColors.darkPrimary,
        foregroundColor: Colors.white,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: HelmColors.darkSurface,
      ),
    );
  }
}
