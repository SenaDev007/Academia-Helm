import 'package:flutter/widgets.dart';

/// Academia Helm responsive breakpoints and helpers.
///
/// Defines breakpoints for phone, tablet, and desktop layouts, and provides
/// static helper methods to determine the current form factor from a
/// [BuildContext].
class AHBreakpoints {
  AHBreakpoints._();

  // ── Breakpoint Values ─────────────────────────────────────────────────

  /// Maximum width for phone layout.
  static const double phone = 600;

  /// Maximum width for tablet layout.
  static const double tablet = 1024;

  /// Minimum width for desktop layout (anything above tablet).
  // desktop is > 1024; no upper bound.

  // ── Helper Methods ────────────────────────────────────────────────────

  /// Returns `true` when the screen width is less than [phone] (600 px).
  static bool isPhone(BuildContext context) {
    return MediaQuery.sizeOf(context).width < phone;
  }

  /// Returns `true` when the screen width is between [phone] and [tablet]
  /// (600–1024 px inclusive of lower bound).
  static bool isTablet(BuildContext context) {
    final double width = MediaQuery.sizeOf(context).width;
    return width >= phone && width <= tablet;
  }

  /// Returns `true` when the screen width exceeds [tablet] (> 1024 px).
  static bool isDesktop(BuildContext context) {
    return MediaQuery.sizeOf(context).width > tablet;
  }

  /// Returns the current layout type as a [LayoutType] enum.
  static LayoutType getLayoutType(BuildContext context) {
    if (isPhone(context)) return LayoutType.phone;
    if (isTablet(context)) return LayoutType.tablet;
    return LayoutType.desktop;
  }

  /// Returns a value based on the current screen size.
  ///
  /// Useful for choosing different padding, font sizes, etc. without
  /// branching in the widget tree.
  static T responsiveValue<T>(
    BuildContext context, {
    required T phone,
    T? tablet,
    T? desktop,
  }) {
    if (isDesktop(context)) return desktop ?? tablet ?? phone;
    if (isTablet(context)) return tablet ?? phone;
    return phone;
  }

  // ── Grid Column Counts ────────────────────────────────────────────────

  /// Number of grid columns for the current layout type.
  static int gridColumns(BuildContext context) {
    if (isDesktop(context)) return 4;
    if (isTablet(context)) return 3;
    return 1;
  }

  // ── Content Max Width ─────────────────────────────────────────────────

  /// Maximum content width for readable / focused layouts.
  static const double contentMaxWidth = 840;

  /// Returns `true` when the screen width exceeds [contentMaxWidth],
  /// indicating that content should be constrained and centered.
  static bool shouldConstrainContent(BuildContext context) {
    return MediaQuery.sizeOf(context).width > contentMaxWidth;
  }

  // ── Sidebar ───────────────────────────────────────────────────────────

  static const double sidebarWidth = 280;
  static const double sidebarCollapsedWidth = 72;

  static double sidebarEffectiveWidth(BuildContext context) {
    if (isPhone(context)) return 0;
    return sidebarWidth;
  }
}

/// Enum representing the current layout type.
enum LayoutType {
  phone,
  tablet,
  desktop,
}
