/// Form field validators for Academia Helm.
///
/// All validators return `null` when the input is valid, or a descriptive
/// error string when invalid. They are designed to be used directly with
/// Flutter's `TextFormField.validator`.
class Validators {
  Validators._();

  // ── Email ─────────────────────────────────────────────────────────────

  /// Validates that [value] is a properly formatted email address.
  static String? email(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Email is required';
    }

    // Comprehensive email regex.
    final RegExp emailRegex = RegExp(
      r'^[a-zA-Z0-9.!#$%&*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,253}[a-zA-Z0-9])?)*$',
    );

    if (!emailRegex.hasMatch(value.trim())) {
      return 'Please enter a valid email address';
    }

    return null;
  }

  // ── Password ──────────────────────────────────────────────────────────

  /// Validates that [value] meets the minimum password requirements.
  ///
  /// Minimum requirements:
  /// - At least 8 characters
  /// - Contains at least one uppercase letter
  /// - Contains at least one lowercase letter
  /// - Contains at least one digit
  static String? password(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }

    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }

    if (!value.contains(RegExp(r'[A-Z]'))) {
      return 'Password must contain at least one uppercase letter';
    }

    if (!value.contains(RegExp(r'[a-z]'))) {
      return 'Password must contain at least one lowercase letter';
    }

    if (!value.contains(RegExp(r'[0-9]'))) {
      return 'Password must contain at least one digit';
    }

    return null;
  }

  /// Validates a password with only the minimum length requirement.
  static String? passwordSimple(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }

    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }

    return null;
  }

  // ── Required ──────────────────────────────────────────────────────────

  /// Validates that [value] is not null or empty.
  static String? required(String? value, [String? fieldName]) {
    if (value == null || value.trim().isEmpty) {
      return '${fieldName ?? 'This field'} is required';
    }

    return null;
  }

  // ── Phone ─────────────────────────────────────────────────────────────

  /// Validates that [value] is a properly formatted phone number.
  ///
  /// Accepts formats:
  /// - +237 6XX XXX XXX
  /// - 6XX XXX XXX
  /// - +2376XXXXXXXX
  /// - 6XXXXXXXX
  static String? phone(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Phone number is required';
    }

    // Strip all non-digit characters for validation.
    final String digits = value.replaceAll(RegExp(r'[^\d+]'), '');

    // Cameroon phone number patterns.
    final RegExp cameroonPhone = RegExp(
      r'^(\+237|237)?6[0-9]{8}$',
    );

    if (!cameroonPhone.hasMatch(digits)) {
      return 'Please enter a valid phone number';
    }

    return null;
  }

  // ── Matricule ─────────────────────────────────────────────────────────

  /// Validates that [value] is a properly formatted student matricule.
  ///
  /// Common format: 2-3 letters followed by digits (e.g. AH2024001).
  static String? matricule(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Matricule is required';
    }

    final String trimmed = value.trim().toUpperCase();

    // Format: 2-5 uppercase letters followed by 4-10 digits.
    final RegExp matriculeRegex = RegExp(
      r'^[A-Z]{2,5}\d{4,10}$',
    );

    if (!matriculeRegex.hasMatch(trimmed)) {
      return 'Please enter a valid matricule (e.g. AH2024001)';
    }

    return null;
  }

  // ── Confirm Password ──────────────────────────────────────────────────

  /// Returns a validator that checks that the value matches [password].
  static String? Function(String?) confirmPassword(String password) {
    return (String? value) {
      if (value == null || value.isEmpty) {
        return 'Please confirm your password';
      }

      if (value != password) {
        return 'Passwords do not match';
      }

      return null;
    };
  }

  // ── Min Length ────────────────────────────────────────────────────────

  /// Returns a validator that checks a minimum length.
  static String? Function(String?) minLength(int min, [String? fieldName]) {
    return (String? value) {
      if (value == null || value.length < min) {
        return '${fieldName ?? 'This field'} must be at least $min characters';
      }
      return null;
    };
  }

  // ── Max Length ────────────────────────────────────────────────────────

  /// Returns a validator that checks a maximum length.
  static String? Function(String?) maxLength(int max, [String? fieldName]) {
    return (String? value) {
      if (value != null && value.length > max) {
        return '${fieldName ?? 'This field'} must be at most $max characters';
      }
      return null;
    };
  }

  // ── Combine Validators ────────────────────────────────────────────────

  /// Combines multiple validators into one. Validators are run in order and
  /// the first error is returned.
  static String? Function(String?) combine(
    List<String? Function(String?)> validators,
  ) {
    return (String? value) {
      for (final String? Function(String?) validator in validators) {
        final String? result = validator(value);
        if (result != null) return result;
      }
      return null;
    };
  }
}
