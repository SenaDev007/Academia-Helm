/// Academia Helm spacing, border radius, and icon size constants.
///
/// Provides a consistent spacing scale, border radius values, and icon size
/// constants to ensure visual uniformity across the entire application.
class AHSpacing {
  AHSpacing._();

  // ── Spacing Scale (in logical pixels) ─────────────────────────────────

  static const double s4 = 4.0;
  static const double s8 = 8.0;
  static const double s12 = 12.0;
  static const double s16 = 16.0;
  static const double s20 = 20.0;
  static const double s24 = 24.0;
  static const double s32 = 32.0;
  static const double s40 = 40.0;
  static const double s48 = 48.0;
  static const double s64 = 64.0;

  // ── Semantic Spacing Aliases ──────────────────────────────────────────

  static const double none = 0.0;
  static const double xxs = s4;
  static const double xs = s8;
  static const double sm = s12;
  static const double md = s16;
  static const double lg = s20;
  static const double xl = s24;
  static const double xxl = s32;
  static const double xxxl = s40;

  // ── Page / Content Padding ────────────────────────────────────────────

  static const double pagePaddingHorizontal = s16;
  static const double pagePaddingVertical = s16;
  static const double cardPadding = s16;
  static const double cardPaddingSmall = s12;
  static const double sectionGap = s24;
  static const double itemGap = s12;
  static const double innerGap = s8;

  // ── Border Radius ─────────────────────────────────────────────────────

  static const double r4 = 4.0;
  static const double r8 = 8.0;
  static const double r12 = 12.0;
  static const double r16 = 16.0;
  static const double r20 = 20.0;
  static const double r24 = 24.0;

  static const double radiusSmall = r4;
  static const double radiusMedium = r8;
  static const double radiusLarge = r12;
  static const double radiusXLarge = r16;
  static const double radiusXXLarge = r20;
  static const double radiusFull = r24;

  // ── Icon Sizes ────────────────────────────────────────────────────────

  static const double icon16 = 16.0;
  static const double icon20 = 20.0;
  static const double icon24 = 24.0;
  static const double icon32 = 32.0;
  static const double icon48 = 48.0;

  static const double iconSmall = icon16;
  static const double iconMedium = icon20;
  static const double iconDefault = icon24;
  static const double iconLarge = icon32;
  static const double iconXLarge = icon48;

  // ── Elevation Values ──────────────────────────────────────────────────

  static const double elevationNone = 0.0;
  static const double elevationLow = 1.0;
  static const double elevationMedium = 3.0;
  static const double elevationHigh = 6.0;
  static const double elevationXHigh = 12.0;

  // ── Button Dimensions ─────────────────────────────────────────────────

  static const double buttonHeight = 48.0;
  static const double buttonHeightSmall = 36.0;
  static const double buttonHeightLarge = 56.0;
  static const double buttonHorizontalPadding = s24;

  // ── Input Dimensions ──────────────────────────────────────────────────

  static const double inputHeight = 48.0;
  static const double inputHeightSmall = 40.0;
  static const double inputHorizontalPadding = s16;
  static const double inputBorderWidth = 1.0;
  static const double inputFocusBorderWidth = 2.0;

  // ── Avatar Sizes ──────────────────────────────────────────────────────

  static const double avatarSmall = 32.0;
  static const double avatarMedium = 40.0;
  static const double avatarLarge = 56.0;
  static const double avatarXLarge = 80.0;

  // ── Divider ───────────────────────────────────────────────────────────

  static const double dividerThickness = 1.0;
  static const double dividerThickThickness = 2.0;
}

/// Academia Helm border radius constants with semantic naming.
///
/// Used across the app for consistent corner radii.
class AHRadius {
  AHRadius._();

  static const double sm = AHSpacing.r4;
  static const double md = AHSpacing.r8;
  static const double lg = AHSpacing.r12;
  static const double xl = AHSpacing.r16;
  static const double xxl = AHSpacing.r20;
  static const double full = AHSpacing.r24;
}
