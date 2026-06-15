import 'package:flutter/material.dart';

import 'ah_colors.dart';
import 'ah_spacing.dart';
import 'ah_typography.dart';
import 'ah_components.dart';

/// Academia Helm theme configuration.
///
/// Provides complete [ThemeData] for light and dark modes using Material 3,
/// seeded from the AH brand colors.
class AHTheme {
  AHTheme._();

  // ── Seed Color ────────────────────────────────────────────────────────

  static const Color _seedColor = AHColors.navy;

  // ── Light Theme ───────────────────────────────────────────────────────

  static ThemeData lightTheme() {
    final ColorScheme colorScheme = ColorScheme.fromSeed(
      seedColor: _seedColor,
      brightness: Brightness.light,
      primary: AHColors.navy,
      onPrimary: AHColors.white,
      primaryContainer: AHColors.blue,
      onPrimaryContainer: AHColors.white,
      secondary: AHColors.gold,
      onSecondary: AHColors.navy,
      secondaryContainer: AHColors.goldLight,
      onSecondaryContainer: AHColors.navyDark,
      tertiary: AHColors.blue,
      onTertiary: AHColors.white,
      error: AHColors.error,
      onError: AHColors.white,
      errorContainer: AHColors.errorLight,
      onErrorContainer: AHColors.errorDark,
      surface: AHColors.lightSurface,
      onSurface: AHColors.lightOnSurface,
      surfaceContainerHighest: AHColors.lightSurfaceContainerHighest,
      surfaceContainerHigh: AHColors.lightSurfaceVariant,
      surfaceContainerMedium: AHColors.lightSurfaceVariant,
      surfaceContainerLow: AHColors.lightSurface,
      surfaceContainerLowest: AHColors.white,
      outline: AHColors.lightOutline,
      outlineVariant: AHColors.lightOutlineVariant,
      inverseSurface: AHColors.lightInverseSurface,
      onInverseSurface: AHColors.lightInverseOnSurface,
    );

    return _buildTheme(colorScheme, Brightness.light);
  }

  // ── Dark Theme ────────────────────────────────────────────────────────

  static ThemeData darkTheme() {
    final ColorScheme colorScheme = ColorScheme.fromSeed(
      seedColor: _seedColor,
      brightness: Brightness.dark,
      primary: AHColors.gold,
      onPrimary: AHColors.navyDark,
      primaryContainer: AHColors.navy,
      onPrimaryContainer: AHColors.goldLight,
      secondary: AHColors.goldLight,
      onSecondary: AHColors.navyDark,
      secondaryContainer: AHColors.navy,
      onSecondaryContainer: AHColors.goldLight,
      tertiary: AHColors.blue,
      onTertiary: AHColors.white,
      error: AHColors.errorLight,
      onError: AHColors.navyDark,
      errorContainer: AHColors.errorDark,
      onErrorContainer: AHColors.errorLight,
      surface: AHColors.darkSurface,
      onSurface: AHColors.darkOnSurface,
      surfaceContainerHighest: AHColors.darkSurfaceContainerHighest,
      surfaceContainerHigh: AHColors.darkSurfaceVariant,
      surfaceContainerMedium: AHColors.darkSurfaceVariant,
      surfaceContainerLow: AHColors.darkSurface,
      surfaceContainerLowest: AHColors.darkBackground,
      outline: AHColors.darkOutline,
      outlineVariant: AHColors.darkOutlineVariant,
      inverseSurface: AHColors.darkInverseSurface,
      onInverseSurface: AHColors.darkInverseOnSurface,
    );

    return _buildTheme(colorScheme, Brightness.dark);
  }

  // ── Shared Theme Builder ──────────────────────────────────────────────

  static ThemeData _buildTheme(ColorScheme colorScheme, Brightness brightness) {
    final bool isLight = brightness == Brightness.light;

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      brightness: brightness,

      // ── Typography ──────────────────────────────────────────────────
      textTheme: AHTypography.buildTextTheme(),
      primaryTextTheme: AHTypography.buildTextTheme(),

      // ── Scaffold ────────────────────────────────────────────────────
      scaffoldBackgroundColor:
          isLight ? AHColors.lightBackground : AHColors.darkBackground,

      // ── AppBar ──────────────────────────────────────────────────────
      appBarTheme: AppBarTheme(
        backgroundColor: isLight ? AHColors.navy : AHColors.darkSurface,
        foregroundColor: AHColors.white,
        elevation: AHSpacing.elevationNone,
        scrolledUnderElevation: AHSpacing.elevationLow,
        centerTitle: false,
        titleTextStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: AHColors.white,
          letterSpacing: 0.15,
        ),
        iconTheme: const IconThemeData(
          color: AHColors.white,
          size: AHSpacing.icon24,
        ),
      ),

      // ── Card ────────────────────────────────────────────────────────
      cardTheme: CardTheme(
        color: colorScheme.surface,
        elevation: AHSpacing.elevationNone,
        shape: AHCardStyle.cardShape(),
        margin: const EdgeInsets.symmetric(
          horizontal: AHSpacing.s16,
          vertical: AHSpacing.s4,
        ),
        clipBehavior: Clip.antiAlias,
      ),

      // ── Elevated Button ─────────────────────────────────────────────
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: AHButtonStyle.primary(),
      ),

      // ── Outlined Button ─────────────────────────────────────────────
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: AHButtonStyle.outline(),
      ),

      // ── Text Button ─────────────────────────────────────────────────
      textButtonTheme: TextButtonThemeData(
        style: AHButtonStyle.ghost(),
      ),

      // ── Input Decoration ────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AHSpacing.inputHorizontalPadding,
          vertical: AHSpacing.s12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r8),
          borderSide: BorderSide(
            color: colorScheme.outline,
            width: AHSpacing.inputBorderWidth,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r8),
          borderSide: BorderSide(
            color: colorScheme.outline,
            width: AHSpacing.inputBorderWidth,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r8),
          borderSide: BorderSide(
            color: colorScheme.primary,
            width: AHSpacing.inputFocusBorderWidth,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r8),
          borderSide: BorderSide(
            color: colorScheme.error,
            width: AHSpacing.inputBorderWidth,
          ),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r8),
          borderSide: BorderSide(
            color: colorScheme.error,
            width: AHSpacing.inputFocusBorderWidth,
          ),
        ),
        hintStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: isLight ? AHColors.grey400 : AHColors.grey600,
        ),
        labelStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: colorScheme.onSurfaceVariant,
        ),
        floatingLabelStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: colorScheme.primary,
        ),
      ),

      // ── Chip ────────────────────────────────────────────────────────
      chipTheme: AHChipStyle.defaultStyle().copyWith(
        backgroundColor:
            isLight ? AHColors.lightSurfaceVariant : AHColors.darkSurfaceVariant,
        selectedColor: colorScheme.primary.withOpacity(0.12),
        labelStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: isLight ? AHColors.grey700 : AHColors.grey300,
        ),
      ),

      // ── Divider ─────────────────────────────────────────────────────
      dividerTheme: DividerThemeData(
        color: isLight ? AHColors.lightDivider : AHColors.darkDivider,
        thickness: AHSpacing.dividerThickness,
        space: AHSpacing.s1,
      ),

      // ── Bottom Navigation Bar ───────────────────────────────────────
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: isLight ? AHColors.white : AHColors.darkSurface,
        selectedItemColor: AHColors.navy,
        unselectedItemColor: AHColors.grey500,
        type: BottomNavigationBarType.fixed,
        elevation: AHSpacing.elevationMedium,
        selectedLabelStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 10,
          fontWeight: FontWeight.w400,
        ),
      ),

      // ── Navigation Bar (M3) ─────────────────────────────────────────
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isLight ? AHColors.white : AHColors.darkSurface,
        indicatorColor: AHColors.navy.withOpacity(0.12),
        elevation: AHSpacing.elevationNone,
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),

      // ── Floating Action Button ──────────────────────────────────────
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AHColors.navy,
        foregroundColor: AHColors.white,
        elevation: AHSpacing.elevationMedium,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r16),
        ),
      ),

      // ── Dialog ──────────────────────────────────────────────────────
      dialogTheme: DialogTheme(
        backgroundColor: isLight ? AHColors.white : AHColors.darkSurface,
        elevation: AHSpacing.elevationHigh,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r16),
        ),
        titleTextStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: isLight ? AHColors.navy : AHColors.goldLight,
        ),
      ),

      // ── SnackBar ────────────────────────────────────────────────────
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r8),
        ),
        backgroundColor: isLight ? AHColors.grey800 : AHColors.grey200,
        contentTextStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w400,
          color: isLight ? AHColors.white : AHColors.grey900,
        ),
      ),

      // ── Tab Bar ─────────────────────────────────────────────────────
      tabBarTheme: TabBarTheme(
        labelColor: isLight ? AHColors.navy : AHColors.goldLight,
        unselectedLabelColor: AHColors.grey500,
        indicatorColor: AHColors.gold,
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: const TextStyle(
          fontFamily: 'Inter',
          fontSize: 14,
          fontWeight: FontWeight.w400,
        ),
      ),

      // ── Progress Indicator ──────────────────────────────────────────
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: AHColors.navy,
        linearTrackColor:
            isLight ? AHColors.grey200 : AHColors.darkSurfaceVariant,
      ),

      // ── Switch ──────────────────────────────────────────────────────
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AHColors.white;
          }
          return isLight ? AHColors.grey200 : AHColors.grey600;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AHColors.navy;
          }
          return isLight ? AHColors.grey300 : AHColors.grey700;
        }),
      ),

      // ── Checkbox ────────────────────────────────────────────────────
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AHColors.navy;
          }
          return Colors.transparent;
        }),
        checkColor: WidgetStateProperty.all(AHColors.white),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AHSpacing.r4),
        ),
      ),

      // ── Radio ───────────────────────────────────────────────────────
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AHColors.navy;
          }
          return isLight ? AHColors.grey400 : AHColors.grey600;
        }),
      ),

      // ── Bottom Sheet ────────────────────────────────────────────────
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: isLight ? AHColors.white : AHColors.darkSurface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AHSpacing.r20),
          ),
        ),
        showDragHandle: true,
      ),

      // ── Tooltip ─────────────────────────────────────────────────────
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: isLight ? AHColors.grey800 : AHColors.grey200,
          borderRadius: BorderRadius.circular(AHSpacing.r4),
        ),
        textStyle: TextStyle(
          fontFamily: 'Inter',
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: isLight ? AHColors.white : AHColors.grey900,
        ),
        waitDuration: const Duration(milliseconds: 500),
      ),

      // ── Scrollbar ───────────────────────────────────────────────────
      scrollbarTheme: ScrollbarThemeData(
        thumbColor: WidgetStateProperty.all(
          isLight ? AHColors.grey400 : AHColors.grey600,
        ),
        radius: const Radius.circular(AHSpacing.r4),
        thickness: WidgetStateProperty.all(6),
      ),

      // ── Page Transitions ────────────────────────────────────────────
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: CupertinoPageTransitionsBuilder(),
          TargetPlatform.linux: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }
}
