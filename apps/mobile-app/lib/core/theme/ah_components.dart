import 'package:flutter/material.dart';

import 'ah_colors.dart';
import 'ah_spacing.dart';

/// Academia Helm shared component styles.
///
/// Provides reusable style definitions for buttons, cards, inputs, and chips
/// to maintain visual consistency across the entire application.
class AHButtonStyle {
  AHButtonStyle._();

  // ── Primary Button ────────────────────────────────────────────────────

  static ButtonStyle primary({bool enabled = true}) {
    return ElevatedButton.styleFrom(
      backgroundColor: enabled ? AHColors.navy : AHColors.grey300,
      foregroundColor: AHColors.white,
      disabledBackgroundColor: AHColors.grey300,
      disabledForegroundColor: AHColors.grey500,
      elevation: AHSpacing.elevationNone,
      shadowColor: Colors.transparent,
      minimumSize: const Size(double.infinity, AHSpacing.buttonHeight),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.buttonHorizontalPadding,
        vertical: AHSpacing.s12,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
      ),
      textStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }

  // ── Secondary Button ──────────────────────────────────────────────────

  static ButtonStyle secondary({bool enabled = true}) {
    return ElevatedButton.styleFrom(
      backgroundColor: enabled ? AHColors.gold : AHColors.grey300,
      foregroundColor: enabled ? AHColors.navy : AHColors.grey500,
      disabledBackgroundColor: AHColors.grey300,
      disabledForegroundColor: AHColors.grey500,
      elevation: AHSpacing.elevationNone,
      shadowColor: Colors.transparent,
      minimumSize: const Size(double.infinity, AHSpacing.buttonHeight),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.buttonHorizontalPadding,
        vertical: AHSpacing.s12,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
      ),
      textStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }

  // ── Outline Button ────────────────────────────────────────────────────

  static ButtonStyle outline({bool enabled = true}) {
    return OutlinedButton.styleFrom(
      backgroundColor: Colors.transparent,
      foregroundColor: enabled ? AHColors.navy : AHColors.grey500,
      disabledForegroundColor: AHColors.grey500,
      side: BorderSide(
        color: enabled ? AHColors.navy : AHColors.grey300,
        width: 1.5,
      ),
      minimumSize: const Size(double.infinity, AHSpacing.buttonHeight),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.buttonHorizontalPadding,
        vertical: AHSpacing.s12,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
      ),
      textStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }

  // ── Ghost Button ──────────────────────────────────────────────────────

  static ButtonStyle ghost({bool enabled = true}) {
    return TextButton.styleFrom(
      backgroundColor: Colors.transparent,
      foregroundColor: enabled ? AHColors.navy : AHColors.grey500,
      disabledForegroundColor: AHColors.grey500,
      minimumSize: const Size(double.infinity, AHSpacing.buttonHeight),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.buttonHorizontalPadding,
        vertical: AHSpacing.s12,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
      ),
      textStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }

  // ── Danger Button ─────────────────────────────────────────────────────

  static ButtonStyle danger({bool enabled = true}) {
    return ElevatedButton.styleFrom(
      backgroundColor: enabled ? AHColors.error : AHColors.grey300,
      foregroundColor: AHColors.white,
      disabledBackgroundColor: AHColors.grey300,
      disabledForegroundColor: AHColors.grey500,
      elevation: AHSpacing.elevationNone,
      shadowColor: Colors.transparent,
      minimumSize: const Size(double.infinity, AHSpacing.buttonHeight),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.buttonHorizontalPadding,
        vertical: AHSpacing.s12,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
      ),
      textStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }

  // ── Small Button Variant ──────────────────────────────────────────────

  static ButtonStyle primarySmall() {
    return ElevatedButton.styleFrom(
      backgroundColor: AHColors.navy,
      foregroundColor: AHColors.white,
      elevation: AHSpacing.elevationNone,
      shadowColor: Colors.transparent,
      minimumSize: const Size(0, AHSpacing.buttonHeightSmall),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.s16,
        vertical: AHSpacing.s8,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
      ),
      textStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.5,
      ),
    );
  }
}

/// Academia Helm card styles.
class AHCardStyle {
  AHCardStyle._();

  // ── Elevated Card ─────────────────────────────────────────────────────

  static BoxDecoration elevated({Color? backgroundColor}) {
    return BoxDecoration(
      color: backgroundColor ?? AHColors.white,
      borderRadius: BorderRadius.circular(AHSpacing.r12),
      boxShadow: [
        BoxShadow(
          color: AHColors.navy.withOpacity(0.06),
          offset: const Offset(0, 2),
          blurRadius: 8,
          spreadRadius: 0,
        ),
        BoxShadow(
          color: AHColors.navy.withOpacity(0.04),
          offset: const Offset(0, 1),
          blurRadius: 4,
          spreadRadius: 0,
        ),
      ],
    );
  }

  // ── Outlined Card ─────────────────────────────────────────────────────

  static BoxDecoration outlined({Color? borderColor}) {
    return BoxDecoration(
      color: AHColors.white,
      borderRadius: BorderRadius.circular(AHSpacing.r12),
      border: Border.all(
        color: borderColor ?? AHColors.lightOutline,
        width: 1,
      ),
    );
  }

  // ── Filled Card ───────────────────────────────────────────────────────

  static BoxDecoration filled({Color? fillColor}) {
    return BoxDecoration(
      color: fillColor ?? AHColors.lightSurfaceVariant,
      borderRadius: BorderRadius.circular(AHSpacing.r12),
    );
  }

  // ── Dark Mode Variants ────────────────────────────────────────────────

  static BoxDecoration elevatedDark({Color? backgroundColor}) {
    return BoxDecoration(
      color: backgroundColor ?? AHColors.darkSurface,
      borderRadius: BorderRadius.circular(AHSpacing.r12),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.2),
          offset: const Offset(0, 2),
          blurRadius: 8,
          spreadRadius: 0,
        ),
      ],
    );
  }

  static BoxDecoration outlinedDark({Color? borderColor}) {
    return BoxDecoration(
      color: AHColors.darkSurface,
      borderRadius: BorderRadius.circular(AHSpacing.r12),
      border: Border.all(
        color: borderColor ?? AHColors.darkOutline,
        width: 1,
      ),
    );
  }

  static BoxDecoration filledDark({Color? fillColor}) {
    return BoxDecoration(
      color: fillColor ?? AHColors.darkSurfaceVariant,
      borderRadius: BorderRadius.circular(AHSpacing.r12),
    );
  }

  // ── Card Shape ────────────────────────────────────────────────────────

  static ShapeBorder cardShape() {
    return RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AHSpacing.r12),
    );
  }

  static ShapeBorder cardShapeWithBorder({Color? borderColor}) {
    return RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(AHSpacing.r12),
      side: BorderSide(
        color: borderColor ?? AHColors.lightOutline,
        width: 1,
      ),
    );
  }
}

/// Academia Helm input field styles.
class AHInputStyle {
  AHInputStyle._();

  // ── Default Input ─────────────────────────────────────────────────────

  static InputDecoration defaultStyle({
    String? hintText,
    String? labelText,
    Widget? prefixIcon,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: hintText,
      labelText: labelText,
      prefixIcon: prefixIcon,
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: AHColors.lightSurface,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.inputHorizontalPadding,
        vertical: AHSpacing.s12,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.lightOutline,
          width: AHSpacing.inputBorderWidth,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.lightOutline,
          width: AHSpacing.inputBorderWidth,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.navy,
          width: AHSpacing.inputFocusBorderWidth,
        ),
      ),
      hintStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AHColors.grey400,
      ),
      labelStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AHColors.grey500,
      ),
      floatingLabelStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AHColors.navy,
      ),
    );
  }

  // ── Error Input ───────────────────────────────────────────────────────

  static InputDecoration error({
    String? hintText,
    String? labelText,
    String? errorText,
    Widget? prefixIcon,
    Widget? suffixIcon,
  }) {
    return InputDecoration(
      hintText: hintText,
      labelText: labelText,
      errorText: errorText,
      prefixIcon: prefixIcon,
      suffixIcon: suffixIcon,
      filled: true,
      fillColor: AHColors.errorLight.withOpacity(0.3),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.inputHorizontalPadding,
        vertical: AHSpacing.s12,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.error,
          width: AHSpacing.inputBorderWidth,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.error,
          width: AHSpacing.inputBorderWidth,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.errorDark,
          width: AHSpacing.inputFocusBorderWidth,
        ),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.error,
          width: AHSpacing.inputBorderWidth,
        ),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.errorDark,
          width: AHSpacing.inputFocusBorderWidth,
        ),
      ),
      hintStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AHColors.grey400,
      ),
      errorStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: AHColors.error,
      ),
    );
  }

  // ── Disabled Input ────────────────────────────────────────────────────

  static InputDecoration disabled({
    String? hintText,
    String? labelText,
    Widget? prefixIcon,
  }) {
    return InputDecoration(
      hintText: hintText,
      labelText: labelText,
      prefixIcon: prefixIcon,
      filled: true,
      fillColor: AHColors.grey100,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.inputHorizontalPadding,
        vertical: AHSpacing.s12,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.grey200,
          width: AHSpacing.inputBorderWidth,
        ),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.grey200,
          width: AHSpacing.inputBorderWidth,
        ),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        borderSide: const BorderSide(
          color: AHColors.grey200,
          width: AHSpacing.inputBorderWidth,
        ),
      ),
      hintStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AHColors.grey400,
      ),
      labelStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AHColors.grey400,
      ),
    );
  }
}

/// Academia Helm chip styles.
class AHChipStyle {
  AHChipStyle._();

  // ── Default Chip ──────────────────────────────────────────────────────

  static ChipThemeData defaultStyle() {
    return ChipThemeData(
      backgroundColor: AHColors.lightSurfaceVariant,
      selectedColor: AHColors.navy.withOpacity(0.12),
      deleteIconColor: AHColors.grey500,
      disabledColor: AHColors.grey200,
      labelStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AHColors.grey700,
      ),
      secondaryLabelStyle: const TextStyle(
        fontFamily: 'Inter',
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AHColors.navy,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AHSpacing.r8),
        side: BorderSide.none,
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: AHSpacing.s12,
        vertical: AHSpacing.s4,
      ),
      side: BorderSide.none,
    );
  }

  // ── Status Chip Styles ────────────────────────────────────────────────

  static BoxDecoration successChip() {
    return BoxDecoration(
      color: AHColors.successLight,
      borderRadius: BorderRadius.circular(AHSpacing.r8),
    );
  }

  static BoxDecoration warningChip() {
    return BoxDecoration(
      color: AHColors.warningLight,
      borderRadius: BorderRadius.circular(AHSpacing.r8),
    );
  }

  static BoxDecoration errorChip() {
    return BoxDecoration(
      color: AHColors.errorLight,
      borderRadius: BorderRadius.circular(AHSpacing.r8),
    );
  }

  static BoxDecoration infoChip() {
    return BoxDecoration(
      color: AHColors.infoLight,
      borderRadius: BorderRadius.circular(AHSpacing.r8),
    );
  }

  // ── Status Chip Text Styles ───────────────────────────────────────────

  static const TextStyle successTextStyle = TextStyle(
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AHColors.successDark,
  );

  static const TextStyle warningTextStyle = TextStyle(
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AHColors.warningDark,
  );

  static const TextStyle errorTextStyle = TextStyle(
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AHColors.errorDark,
  );

  static const TextStyle infoTextStyle = TextStyle(
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AHColors.infoDark,
  );
}
