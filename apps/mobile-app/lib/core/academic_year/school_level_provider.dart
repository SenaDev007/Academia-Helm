/// ============================================================================
/// SCHOOL LEVEL PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for school level context management.
/// Mirrors the SchoolLevelContext from the web app with SharedPreferences
/// persistence.
///
/// Providers:
///   - schoolLevelsProvider          : FutureProvider fetching /school-levels
///   - currentSchoolLevelProvider    : StateProvider<SchoolLevelModel?> with persistence
///   - setCurrentSchoolLevelProvider : sets current level and persists it
///   - availableSchoolLevelsProvider : derived from schoolLevelsProvider
///
/// All user-facing strings are in FRENCH.
/// ============================================================================

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';
import '../network/api_result.dart';
import 'academic_year_model.dart';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const String _currentSchoolLevelIdKey = 'ah_current_school_level_id';
const String _currentSchoolLevelJsonKey = 'ah_current_school_level_json';

// ─── School Levels List Provider ──────────────────────────────────────────────

/// Fetches the list of school levels from the API.
final schoolLevelsProvider =
    FutureProvider<List<SchoolLevelModel>>((Ref ref) async {
  final ApiClient apiClient = ref.read(apiClientProvider);
  final ApiResult<Map<String, dynamic>> result =
      await apiClient.getRaw('/school-levels');

  return result.when(
    success: (Map<String, dynamic> data) {
      final dynamic levelsData = data['data'] ?? data['schoolLevels'] ?? data;
      if (levelsData is List) {
        return levelsData
            .cast<Map<String, dynamic>>()
            .map(SchoolLevelModel.fromJson)
            .toList();
      }
      return <SchoolLevelModel>[];
    },
    failure: (ApiError error) {
      if (kDebugMode) {
        debugPrint(
          '[SchoolLevelProvider] Échec du chargement : ${error.displayMessage}',
        );
      }
      return <SchoolLevelModel>[];
    },
    loading: () => <SchoolLevelModel>[],
  );
});

// ─── Current School Level Provider ────────────────────────────────────────────

/// The currently selected school level, persisted to SharedPreferences.
///
/// On first access, attempts to restore from SharedPreferences.
/// If none is stored, auto-selects the first active level from the API list.
final currentSchoolLevelProvider =
    StateProvider<SchoolLevelModel?>((Ref ref) => null);

// ─── Initialize Current School Level ──────────────────────────────────────────

/// Provider that initializes the current school level from SharedPreferences
/// on app startup. Must be watched/reads early in the app lifecycle.
final schoolLevelInitializerProvider = FutureProvider<void>((Ref ref) async {
  // First try to restore from SharedPreferences
  final prefs = await SharedPreferences.getInstance();
  final storedJson = prefs.getString(_currentSchoolLevelJsonKey);

  if (storedJson != null) {
    try {
      final json = jsonDecode(storedJson) as Map<String, dynamic>;
      ref.read(currentSchoolLevelProvider.notifier).state =
          SchoolLevelModel.fromJson(json);
      return;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SchoolLevelProvider] Échec restauration : $e',
        );
      }
    }
  }

  // If no stored level, try to auto-select the first active one from API
  final levelsAsync = ref.read(schoolLevelsProvider);
  levelsAsync.whenData((List<SchoolLevelModel> levels) {
    if (levels.isNotEmpty && ref.read(currentSchoolLevelProvider) == null) {
      final activeLevel =
          levels.where((l) => l.isActive).firstOrNull ?? levels.first;
      ref.read(currentSchoolLevelProvider.notifier).state = activeLevel;
      _persistSchoolLevel(activeLevel);
    }
  });
});

// ─── Available School Levels Provider ─────────────────────────────────────────

/// Derived provider that returns available school levels from the API list.
final availableSchoolLevelsProvider =
    Provider<List<SchoolLevelModel>>((Ref ref) {
  final asyncLevels = ref.watch(schoolLevelsProvider);
  return asyncLevels.when(
    data: (List<SchoolLevelModel> levels) => levels,
    loading: () => <SchoolLevelModel>[],
    error: (_, __) => <SchoolLevelModel>[],
  );
});

// ─── Set Current School Level ─────────────────────────────────────────────────

/// Provider exposing a function to set the current school level.
///
/// Usage:
/// ```dart
/// ref.read(setCurrentSchoolLevelProvider)(selectedLevel);
/// ```
final setCurrentSchoolLevelProvider =
    Provider<Future<void> Function(SchoolLevelModel)>((Ref ref) {
  return (SchoolLevelModel level) async {
    ref.read(currentSchoolLevelProvider.notifier).state = level;
    await _persistSchoolLevel(level);

    // Invalidate dependent providers so they refetch with new context
    ref.invalidate(schoolLevelsProvider);

    if (kDebugMode) {
      debugPrint(
        '[SchoolLevelProvider] Niveau scolaire changé : ${level.label}',
      );
    }
  };
});

// ─── Clear School Level ───────────────────────────────────────────────────────

/// Provider that clears the current school level (e.g. on logout).
final clearSchoolLevelProvider = Provider<Future<void> Function()>((Ref ref) {
  return () async {
    ref.read(currentSchoolLevelProvider.notifier).state = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_currentSchoolLevelIdKey);
    await prefs.remove(_currentSchoolLevelJsonKey);
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Persists the selected school level to SharedPreferences.
Future<void> _persistSchoolLevel(SchoolLevelModel level) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_currentSchoolLevelIdKey, level.id);
    await prefs.setString(
      _currentSchoolLevelJsonKey,
      jsonEncode(level.toJson()),
    );
  } catch (e) {
    if (kDebugMode) {
      debugPrint(
        '[SchoolLevelProvider] Échec persistance : $e',
      );
    }
  }
}
