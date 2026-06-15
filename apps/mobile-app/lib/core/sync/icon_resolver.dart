/// ============================================================================
/// ICON RESOLVER — Academia Hub Mobile
/// ============================================================================
///
/// Maps icon name strings from the backend API to Flutter IconData objects.
/// This allows the backend to change icons dynamically without requiring
/// mobile app code changes.
///
/// The API sends icon names as strings (e.g., "school", "payment", "dashboard")
/// matching Lucide icon names used in the web app. This resolver translates
/// them to the closest Material Icons equivalent.
///
/// If an icon name is not found, falls back to [Icons.circle].
/// ============================================================================

import 'package:flutter/material.dart';

// ─── Icon Resolver ───────────────────────────────────────────────────────────

/// Resolves a string icon name from the API to a Flutter [IconData].
///
/// The mapping covers all icon names used in the module configuration
/// and can be extended without code changes by adding entries to [_iconMap].
class IconResolver {
  /// Singleton instance.
  static final IconResolver instance = IconResolver._();

  IconResolver._();

  /// The mapping from API icon names to Flutter IconData.
  /// Organized alphabetically for easy lookup.
  static final Map<String, IconData> _iconMap = {
    // ─── A ────────────────────────────────────────────────────────────────
    'activity': Icons.local_activity,
    'alert-circle': Icons.error_outline,
    'alert-triangle': Icons.warning_amber,
    'archive': Icons.archive,
    'arrow-left': Icons.arrow_back,
    'arrow-right': Icons.arrow_forward,
    'assignment': Icons.assignment,

    // ─── B ────────────────────────────────────────────────────────────────
    'badge': Icons.badge,
    'bar-chart': Icons.bar_chart,
    'bar-chart-2': Icons.bar_chart,
    'bar-chart-3': Icons.bar_chart,
    'bell': Icons.notifications,
    'book': Icons.book,
    'book-open': Icons.menu_book,
    'briefcase': Icons.work,
    'building': Icons.business,
    'banknote': Icons.account_balance_wallet,

    // ─── C ────────────────────────────────────────────────────────────────
    'calendar': Icons.calendar_today,
    'calendar-check': Icons.event_available,
    'calendar-days': Icons.calendar_month,
    'check': Icons.check,
    'check-circle': Icons.check_circle,
    'chevron-down': Icons.keyboard_arrow_down,
    'chevron-left': Icons.chevron_left,
    'chevron-right': Icons.chevron_right,
    'chevron-up': Icons.keyboard_arrow_up,
    'circle': Icons.circle,
    'clipboard-list': Icons.assignment,
    'clock': Icons.access_time,
    'credit-card': Icons.credit_card,

    // ─── D ────────────────────────────────────────────────────────────────
    'dashboard': Icons.dashboard,
    'download': Icons.download,

    // ─── E ────────────────────────────────────────────────────────────────
    'edit': Icons.edit,
    'eye': Icons.visibility,
    'eye-off': Icons.visibility_off,

    // ─── F ────────────────────────────────────────────────────────────────
    'file': Icons.insert_drive_file,
    'file-badge': Icons.workspace_premium,
    'file-check': Icons.task,
    'file-text': Icons.description,
    'filter': Icons.filter_list,

    // ─── G ────────────────────────────────────────────────────────────────
    'globe': Icons.public,
    'graduation-cap': Icons.school,

    // ─── H ────────────────────────────────────────────────────────────────
    'heart': Icons.favorite,
    'home': Icons.home,

    // ─── I ────────────────────────────────────────────────────────────────
    'inbox': Icons.inbox,
    'info': Icons.info,

    // ─── L ────────────────────────────────────────────────────────────────
    'layout-dashboard': Icons.dashboard,
    'layout-grid': Icons.grid_view,
    'list': Icons.list,

    // ─── M ────────────────────────────────────────────────────────────────
    'mail': Icons.mail,
    'map': Icons.map,
    'megaphone': Icons.campaign,
    'message-circle': Icons.chat_bubble,
    'message-square': Icons.chat,
    'minus': Icons.remove,

    // ─── N ────────────────────────────────────────────────────────────────
    'notification': Icons.notifications_active,

    // ─── P ────────────────────────────────────────────────────────────────
    'pencil': Icons.edit,
    'phone': Icons.phone,
    'pie-chart': Icons.pie_chart,
    'plus': Icons.add,
    'printer': Icons.print,

    // ─── Q ────────────────────────────────────────────────────────────────
    'quiz': Icons.quiz,

    // ─── R ────────────────────────────────────────────────────────────────
    'receipt': Icons.receipt_long,
    'refresh-cw': Icons.refresh,
    'rss': Icons.rss_feed,

    // ─── S ────────────────────────────────────────────────────────────────
    'save': Icons.save,
    'search': Icons.search,
    'send': Icons.send,
    'settings': Icons.settings,
    'shield': Icons.security,
    'shield-check': Icons.verified_user,
    'star': Icons.star,
    'sun': Icons.wb_sunny,

    // ─── T ────────────────────────────────────────────────────────────────
    'target': Icons.my_location,
    'trending-up': Icons.trending_up,
    'trending-down': Icons.trending_down,
    'trash': Icons.delete,

    // ─── U ────────────────────────────────────────────────────────────────
    'upload': Icons.upload,
    'user': Icons.person,
    'user-check': Icons.person_outline,
    'user-plus': Icons.person_add,
    'user-x': Icons.person_off,
    'users': Icons.people,

    // ─── X ────────────────────────────────────────────────────────────────
    'x': Icons.close,

    // ─── W ────────────────────────────────────────────────────────────────
    'wifi': Icons.wifi,
    'wifi-off': Icons.wifi_off,
  };

  /// Resolves an icon name string from the API to a Flutter [IconData].
  ///
  /// Falls back to [Icons.circle] if the icon name is not recognized.
  /// The lookup is case-insensitive for robustness.
  IconData resolve(String iconName) {
    // Try exact match first
    final icon = _iconMap[iconName];
    if (icon != null) return icon;

    // Try lowercase match
    final lowerIcon = _iconMap[iconName.toLowerCase()];
    if (lowerIcon != null) return lowerIcon;

    // Try with common suffixes stripped (e.g., "-outline", "-filled")
    final baseName = iconName.replaceAll(RegExp(r'-outline$|-filled$'), '');
    final baseIcon = _iconMap[baseName];
    if (baseIcon != null) return baseIcon;

    // Fallback: return a generic circle icon
    return Icons.circle;
  }

  /// Checks if an icon name is recognized.
  bool isRecognized(String iconName) {
    return _iconMap.containsKey(iconName) ||
        _iconMap.containsKey(iconName.toLowerCase());
  }

  /// Returns all available icon names (for debugging / admin UI).
  List<String> get availableIcons => _iconMap.keys.toList()..sort();

  /// Resolves an icon for a module ID using the built-in mapping.
  /// This is used as a secondary fallback if the API doesn't provide an icon.
  IconData resolveForModuleId(String moduleId) {
    switch (moduleId) {
      case 'dashboard':
        return Icons.dashboard;
      case 'platform':
        return Icons.admin_panel_settings;
      case 'students':
        return Icons.school;
      case 'grades':
        return Icons.assignment;
      case 'finance':
        return Icons.account_balance_wallet;
      case 'pedagogy':
        return Icons.menu_book;
      case 'schedule':
        return Icons.calendar_month;
      case 'messages':
        return Icons.message;
      case 'exams':
        return Icons.quiz;
      case 'absences':
        return Icons.person_off;
      case 'hr':
        return Icons.people;
      case 'settings':
        return Icons.settings;
      case 'profile':
        return Icons.person;
      default:
        return Icons.circle;
    }
  }
}
