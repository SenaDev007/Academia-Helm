import 'package:intl/intl.dart';

/// Date utility helpers for Academia Helm.
///
/// Provides consistent date formatting, relative time strings, academic year
/// calculations, and school week helpers.
class DateHelpers {
  DateHelpers._();

  // ── Standard Date Formatting ──────────────────────────────────────────

  /// Formats a [DateTime] as `dd/MM/yyyy`.
  ///
  /// Example: `formatDate(DateTime(2024, 3, 15))` → `"15/03/2024"`
  static String formatDate(DateTime date) {
    return DateFormat('dd/MM/yyyy').format(date);
  }

  /// Formats a [DateTime] as `dd MMMM yyyy` (full month name).
  ///
  /// Example: `formatDateLong(DateTime(2024, 3, 15))` → `"15 March 2024"`
  static String formatDateLong(DateTime date) {
    return DateFormat('dd MMMM yyyy').format(date);
  }

  /// Formats a [DateTime] as `dd MMM yyyy` (abbreviated month name).
  ///
  /// Example: `formatDateMedium(DateTime(2024, 3, 15))` → `"15 Mar 2024"`
  static String formatDateMedium(DateTime date) {
    return DateFormat('dd MMM yyyy').format(date);
  }

  // ── Date-Time Formatting ──────────────────────────────────────────────

  /// Formats a [DateTime] as `dd/MM/yyyy HH:mm`.
  ///
  /// Example: `formatDateTime(DateTime(2024, 3, 15, 14, 30))`
  /// → `"15/03/2024 14:30"`
  static String formatDateTime(DateTime date) {
    return DateFormat('dd/MM/yyyy HH:mm').format(date);
  }

  /// Formats a [DateTime] as `dd MMM yyyy, HH:mm`.
  ///
  /// Example: `formatDateTimeMedium(DateTime(2024, 3, 15, 14, 30))`
  /// → `"15 Mar 2024, 14:30"`
  static String formatDateTimeMedium(DateTime date) {
    return DateFormat('dd MMM yyyy, HH:mm').format(date);
  }

  /// Formats a [DateTime] as `dd MMMM yyyy à HH:mm`.
  ///
  /// Example: `formatDateTimeLong(DateTime(2024, 3, 15, 14, 30))`
  /// → `"15 March 2024 à 14:30"`
  static String formatDateTimeLong(DateTime date) {
    return '${DateFormat('dd MMMM yyyy').format(date)} à ${DateFormat('HH:mm').format(date)}';
  }

  // ── Time Formatting ───────────────────────────────────────────────────

  /// Formats a [DateTime] as `HH:mm`.
  static String formatTime(DateTime date) {
    return DateFormat('HH:mm').format(date);
  }

  /// Formats a [DateTime] as `HH:mm:ss`.
  static String formatTimeWithSeconds(DateTime date) {
    return DateFormat('HH:mm:ss').format(date);
  }

  // ── Relative Time ─────────────────────────────────────────────────────

  /// Returns a human-readable relative time string.
  ///
  /// Examples:
  /// - Just now
  /// - 5 minutes ago
  /// - 3 hours ago
  /// - Yesterday
  /// - 2 days ago
  /// - 15 Mar 2024 (for dates older than 7 days)
  static String getRelativeTime(DateTime date) {
    final DateTime now = DateTime.now();
    final Duration difference = now.difference(date);

    if (difference.inSeconds < 60) {
      return 'Just now';
    }

    if (difference.inMinutes < 60) {
      final int minutes = difference.inMinutes;
      return minutes == 1 ? '1 minute ago' : '$minutes minutes ago';
    }

    if (difference.inHours < 24) {
      final int hours = difference.inHours;
      return hours == 1 ? '1 hour ago' : '$hours hours ago';
    }

    if (difference.inDays == 1) {
      return 'Yesterday';
    }

    if (difference.inDays < 7) {
      final int days = difference.inDays;
      return days == 1 ? '1 day ago' : '$days days ago';
    }

    // For dates older than 7 days, show the formatted date.
    return formatDateMedium(date);
  }

  /// Returns a short relative time string.
  ///
  /// Examples: `now`, `5m`, `3h`, `1d`, `2d`, `15/03/2024`
  static String getRelativeTimeShort(DateTime date) {
    final DateTime now = DateTime.now();
    final Duration difference = now.difference(date);

    if (difference.inSeconds < 60) return 'now';
    if (difference.inMinutes < 60) return '${difference.inMinutes}m';
    if (difference.inHours < 24) return '${difference.inHours}h';
    if (difference.inDays == 1) return '1d';
    if (difference.inDays < 7) return '${difference.inDays}d';

    return formatDate(date);
  }

  // ── Academic Year ─────────────────────────────────────────────────────

  /// Returns the academic year string for the given [date].
  ///
  /// An academic year typically starts in September. If the month is
  /// September or later, the year spans [year]/[year+1]; otherwise it
  /// spans [year-1]/[year].
  ///
  /// Example: `getAcademicYear(DateTime(2024, 10, 1))` → `"2024/2025"`
  static String getAcademicYear([DateTime? date]) {
    final DateTime d = date ?? DateTime.now();
    final int year = d.year;
    final int month = d.month;

    // Academic year starts in September.
    if (month >= 9) {
      return '$year/${year + 1}';
    }
    return '${year - 1}/$year';
  }

  /// Returns the start date of the current academic year.
  ///
  /// Defaults to September 1st of the starting year.
  static DateTime getAcademicYearStart([DateTime? date]) {
    final DateTime d = date ?? DateTime.now();
    final int year = d.month >= 9 ? d.year : d.year - 1;
    return DateTime(year, 9, 1);
  }

  /// Returns the end date of the current academic year.
  ///
  /// Defaults to June 30th of the ending year.
  static DateTime getAcademicYearEnd([DateTime? date]) {
    final DateTime d = date ?? DateTime.now();
    final int year = d.month >= 9 ? d.year + 1 : d.year;
    return DateTime(year, 6, 30);
  }

  // ── School Week ───────────────────────────────────────────────────────

  /// Returns the week number within the academic year.
  ///
  /// Week 1 starts on the first Monday of September. Weeks are 1-indexed.
  static int getSchoolWeek([DateTime? date]) {
    final DateTime d = date ?? DateTime.now();
    final DateTime start = getAcademicYearStart(d);

    // Find the first Monday on or after September 1st.
    DateTime firstMonday = start;
    while (firstMonday.weekday != DateTime.monday) {
      firstMonday = firstMonday.add(const Duration(days: 1));
    }

    final int daysDiff = d.difference(firstMonday).inDays;
    if (daysDiff < 0) return 0;

    return (daysDiff / 7).floor() + 1;
  }

  /// Returns a descriptive label for the school week.
  ///
  /// Example: `"Week 12 of 2024/2025"`
  static String getSchoolWeekLabel([DateTime? date]) {
    final int week = getSchoolWeek(date);
    final String academicYear = getAcademicYear(date);
    return 'Week $week of $academicYear';
  }

  // ── Quarter / Term ────────────────────────────────────────────────────

  /// Returns the current academic term/quarter.
  ///
  /// Term 1: September – December
  /// Term 2: January – March
  /// Term 3: April – June
  static int getAcademicTerm([DateTime? date]) {
    final DateTime d = date ?? DateTime.now();
    final int month = d.month;

    if (month >= 9 && month <= 12) return 1;
    if (month >= 1 && month <= 3) return 2;
    return 3; // April – June
  }

  /// Returns a descriptive label for the current academic term.
  static String getAcademicTermLabel([DateTime? date]) {
    final int term = getAcademicTerm(date);
    final String academicYear = getAcademicYear(date);
    return 'Term $term, $academicYear';
  }

  // ── Utility ───────────────────────────────────────────────────────────

  /// Returns `true` if [date] is today (same year, month, day).
  static bool isToday(DateTime date) {
    final DateTime now = DateTime.now();
    return date.year == now.year &&
        date.month == now.month &&
        date.day == now.day;
  }

  /// Returns `true` if [date] is yesterday.
  static bool isYesterday(DateTime date) {
    final DateTime yesterday = DateTime.now().subtract(const Duration(days: 1));
    return date.year == yesterday.year &&
        date.month == yesterday.month &&
        date.day == yesterday.day;
  }

  /// Returns `true` if [date] is in the current week (Mon–Sun).
  static bool isThisWeek(DateTime date) {
    final DateTime now = DateTime.now();
    final DateTime startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final DateTime endOfWeek = startOfWeek.add(const Duration(days: 6));

    final DateTime dateOnly = DateTime(date.year, date.month, date.day);
    final DateTime startOnly =
        DateTime(startOfWeek.year, startOfWeek.month, startOfWeek.day);
    final DateTime endOnly =
        DateTime(endOfWeek.year, endOfWeek.month, endOfWeek.day);

    return (dateOnly.isAtSameMomentAs(startOnly) ||
            dateOnly.isAfter(startOnly)) &&
        (dateOnly.isAtSameMomentAs(endOnly) || dateOnly.isBefore(endOnly));
  }

  /// Parses a date string in `dd/MM/yyyy` format.
  static DateTime? parseDate(String dateStr) {
    try {
      return DateFormat('dd/MM/yyyy').parseStrict(dateStr);
    } catch (_) {
      return null;
    }
  }

  /// Parses an ISO 8601 date string.
  static DateTime? parseIsoDate(String dateStr) {
    try {
      return DateTime.parse(dateStr);
    } catch (_) {
      return null;
    }
  }
}
