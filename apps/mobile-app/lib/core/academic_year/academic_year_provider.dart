/// ============================================================================
/// ACADEMIC YEAR PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for academic year context management.
/// Mirrors the AcademicYearContext from the web app with SharedPreferences
/// persistence.
///
/// Providers:
///   - academicYearsProvider      : FutureProvider fetching /academic-years
///   - currentAcademicYearProvider : StateProvider<AcademicYearModel?> with persistence
///   - setCurrentAcademicYearProvider : sets current year and persists it
///   - availableAcademicYearsProvider : derived from academicYearsProvider
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

const String _currentAcademicYearIdKey = 'ah_current_academic_year_id';
const String _currentAcademicYearJsonKey = 'ah_current_academic_year_json';

// ─── Academic Years List Provider ─────────────────────────────────────────────

/// Fetches the list of academic years from the API.
final academicYearsProvider =
    FutureProvider<List<AcademicYearModel>>((Ref ref) async {
  final ApiClient apiClient = ref.read(apiClientProvider);
  final ApiResult<Map<String, dynamic>> result =
      await apiClient.getRaw('/academic-years');

  return result.when(
    success: (Map<String, dynamic> data) {
      final dynamic yearsData = data['data'] ?? data['academicYears'] ?? data;
      if (yearsData is List) {
        return yearsData
            .cast<Map<String, dynamic>>()
            .map(AcademicYearModel.fromJson)
            .toList();
      }
      return <AcademicYearModel>[];
    },
    failure: (ApiError error) {
      if (kDebugMode) {
        debugPrint(
          '[AcademicYearProvider] Échec du chargement : ${error.displayMessage}',
        );
      }
      return <AcademicYearModel>[];
    },
    loading: () => <AcademicYearModel>[],
  );
});

// ─── Current Academic Year Provider ───────────────────────────────────────────

/// The currently selected academic year, persisted to SharedPreferences.
///
/// On first access, attempts to restore from SharedPreferences.
/// If none is stored, auto-selects the "current" year from the API list.
final currentAcademicYearProvider =
    StateProvider<AcademicYearModel?>((Ref ref) => null);

// ─── Initialize Current Academic Year ─────────────────────────────────────────

/// Provider that initializes the current academic year from SharedPreferences
/// on app startup. Must be watched/reads early in the app lifecycle.
final academicYearInitializerProvider = FutureProvider<void>((Ref ref) async {
  // First try to restore from SharedPreferences
  final prefs = await SharedPreferences.getInstance();
  final storedJson = prefs.getString(_currentAcademicYearJsonKey);

  if (storedJson != null) {
    try {
      final json = jsonDecode(storedJson) as Map<String, dynamic>;
      ref.read(currentAcademicYearProvider.notifier).state =
          AcademicYearModel.fromJson(json);
      return;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[AcademicYearProvider] Échec restauration : $e',
        );
      }
    }
  }

  // If no stored year, try to auto-select the "current" one from API
  final yearsAsync = ref.read(academicYearsProvider);
  yearsAsync.whenData((List<AcademicYearModel> years) {
    if (years.isNotEmpty && ref.read(currentAcademicYearProvider) == null) {
      final currentYear = years.where((y) => y.isCurrent).firstOrNull ??
          years.where((y) => y.isActive).firstOrNull ??
          years.first;
      ref.read(currentAcademicYearProvider.notifier).state = currentYear;
      _persistAcademicYear(currentYear);
    }
  });
});

// ─── Available Academic Years Provider ────────────────────────────────────────

/// Derived provider that returns available academic years from the API list.
final availableAcademicYearsProvider =
    Provider<List<AcademicYearModel>>((Ref ref) {
  final asyncYears = ref.watch(academicYearsProvider);
  return asyncYears.when(
    data: (List<AcademicYearModel> years) => years,
    loading: () => <AcademicYearModel>[],
    error: (_, __) => <AcademicYearModel>[],
  );
});

// ─── Set Current Academic Year ────────────────────────────────────────────────

/// Provider exposing a function to set the current academic year.
///
/// Usage:
/// ```dart
/// ref.read(setCurrentAcademicYearProvider)(selectedYear);
/// ```
final setCurrentAcademicYearProvider =
    Provider<Future<void> Function(AcademicYearModel)>((Ref ref) {
  return (AcademicYearModel year) async {
    ref.read(currentAcademicYearProvider.notifier).state = year;
    await _persistAcademicYear(year);

    // Invalidate dependent providers so they refetch with new context
    ref.invalidate(academicYearsProvider);

    if (kDebugMode) {
      debugPrint(
        '[AcademicYearProvider] Année scolaire changée : ${year.displayName}',
      );
    }
  };
});

// ─── Clear Academic Year ──────────────────────────────────────────────────────

/// Provider that clears the current academic year (e.g. on logout).
final clearAcademicYearProvider = Provider<Future<void> Function()>((Ref ref) {
  return () async {
    ref.read(currentAcademicYearProvider.notifier).state = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_currentAcademicYearIdKey);
    await prefs.remove(_currentAcademicYearJsonKey);
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Persists the selected academic year to SharedPreferences.
Future<void> _persistAcademicYear(AcademicYearModel year) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_currentAcademicYearIdKey, year.id);
    await prefs.setString(
      _currentAcademicYearJsonKey,
      jsonEncode(year.toJson()),
    );
  } catch (e) {
    if (kDebugMode) {
      debugPrint(
        '[AcademicYearProvider] Échec persistance : $e',
      );
    }
  }
}
