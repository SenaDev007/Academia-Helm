import 'package:flutter/services.dart';

/// Input formatters for Academia Helm.
///
/// Provides [TextInputFormatter] implementations for phone numbers, currency,
/// dates, and student matricules.
class AHFormatters {
  AHFormatters._();

  // ── Phone Number Formatter ────────────────────────────────────────────

  /// Formats a phone number as the user types.
  ///
  /// Supports Cameroon format: +237 6XX XXX XXX
  /// Automatically inserts spaces and the country code prefix.
  static TextInputFormatter phoneNumber() {
    return _PhoneNumberFormatter();
  }

  // ── Currency Formatter (FCFA) ─────────────────────────────────────────

  /// Formats a numeric input as FCFA currency with thousands separators.
  ///
  /// Example: 1 234 567
  static TextInputFormatter currency() {
    return _CurrencyFormatter();
  }

  // ── Date Formatter (dd/MM/yyyy) ───────────────────────────────────────

  /// Formats a date input as dd/MM/yyyy, automatically inserting slashes.
  static TextInputFormatter date() {
    return _DateFormatter();
  }

  // ── Student Matricule Formatter ───────────────────────────────────────

  /// Formats a student matricule.
  ///
  /// Converts to uppercase and strips non-alphanumeric characters.
  static TextInputFormatter matricule() {
    return _MatriculeFormatter();
  }

  // ── Display Formatting ────────────────────────────────────────────────

  /// Formats a numeric string as FCFA with thousands separators for display.
  ///
  /// Example: `formatCurrency(1234567)` → `"1 234 567 FCFA"`
  static String formatCurrency(num amount) {
    final String formatted = amount.toInt().toString().replaceAllMapped(
          RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
          (Match match) => '${match[1]} ',
        );
    return '$formatted FCFA';
  }

  /// Formats a numeric string as compact FCFA for display.
  ///
  /// Example: `formatCurrencyCompact(1234567)` → `"1.2M FCFA"`
  static String formatCurrencyCompact(num amount) {
    if (amount >= 1000000000) {
      return '${(amount / 1000000000).toStringAsFixed(1)}B FCFA';
    } else if (amount >= 1000000) {
      return '${(amount / 1000000).toStringAsFixed(1)}M FCFA';
    } else if (amount >= 1000) {
      return '${(amount / 1000).toStringAsFixed(1)}K FCFA';
    }
    return '${amount.toInt()} FCFA';
  }

  /// Formats a phone number string for display.
  ///
  /// Example: `formatPhoneDisplay('+237612345678')` → `"+237 6 12 34 56 78"`
  static String formatPhoneDisplay(String phone) {
    String digits = phone.replaceAll(RegExp(r'[^\d]'), '');

    // Remove leading country code if present.
    if (digits.startsWith('237') && digits.length > 10) {
      digits = digits.substring(3);
    }

    if (digits.length != 9) return phone;

    // Format: 6 12 34 56 78
    return '+237 ${digits.substring(0, 1)} ${digits.substring(1, 3)} ${digits.substring(3, 5)} ${digits.substring(5, 7)} ${digits.substring(7, 9)}';
  }

  /// Formats a date string as dd/MM/yyyy for display.
  static String formatDateDisplay(DateTime date) {
    final String day = date.day.toString().padLeft(2, '0');
    final String month = date.month.toString().padLeft(2, '0');
    final String year = date.year.toString();
    return '$day/$month/$year';
  }

  /// Formats a student matricule for display (uppercase with hyphen).
  static String formatMatriculeDisplay(String matricule) {
    final String upper = matricule.toUpperCase().trim();
    // Insert hyphen between letters and digits: AH2024001 → AH-2024001
    final RegExpMatch? match =
        RegExp(r'^([A-Z]+)(\d+)$').firstMatch(upper);
    if (match != null) {
      return '${match.group(1)}-${match.group(2)}';
    }
    return upper;
  }
}

// ── Private Formatter Implementations ────────────────────────────────────

class _PhoneNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    // Strip non-digits.
    String digits = newValue.text.replaceAll(RegExp(r'[^\d+]'), '');

    // If user types a 6 at the start (without +237), prepend +237.
    if (digits.startsWith('6') && digits.length <= 9) {
      digits = '+237$digits';
    }

    // Format: +237 6XX XXX XXX
    final StringBuffer buffer = StringBuffer();
    for (int i = 0; i < digits.length; i++) {
      if (i == 4 || i == 7 || i == 10) {
        buffer.write(' ');
      }
      buffer.write(digits[i]);
    }

    final String formatted = buffer.toString();

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

class _CurrencyFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    // Strip non-digits.
    String digits = newValue.text.replaceAll(RegExp(r'[^\d]'), '');

    if (digits.isEmpty) {
      return const TextEditingValue(
        text: '',
        selection: TextSelection.collapsed(offset: 0),
      );
    }

    // Remove leading zeros.
    digits = digits.replaceFirst(RegExp(r'^0+'), '');
    if (digits.isEmpty) digits = '0';

    // Add thousands separators (space).
    final String formatted = digits.replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match match) => '${match[1]} ',
    ).trim();

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

class _DateFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    // Strip non-digits.
    String digits = newValue.text.replaceAll(RegExp(r'[^\d]'), '');

    // Limit to 8 digits (ddMMyyyy).
    if (digits.length > 8) {
      digits = digits.substring(0, 8);
    }

    final StringBuffer buffer = StringBuffer();

    for (int i = 0; i < digits.length; i++) {
      if (i == 2 || i == 4) {
        buffer.write('/');
      }
      buffer.write(digits[i]);
    }

    final String formatted = buffer.toString();

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

class _MatriculeFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    // Convert to uppercase and strip non-alphanumeric characters.
    final String formatted =
        newValue.text.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
