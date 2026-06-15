/// ============================================================================
/// SETTINGS PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Settings module.
/// Uses [SettingsService] for CRUD operations and returns [AsyncValue] states
/// that integrate seamlessly with [AsyncValueWidget] and [ModuleLoadingWrapper].
///
/// Providers:
/// - settingsServiceProvider           → Singleton for [SettingsService]
/// - generalSettingsProvider           → General settings (detail)
/// - academicYearsProvider             → List of academic years
/// - currentAcademicYearProvider       → Current academic year (detail)
/// - classesProvider                   → List of classes
/// - settingsSubjectsProvider          → List of subjects
/// - rolesProvider                     → List of roles
/// - permissionsProvider               → List of permissions
/// - featuresProvider                  → List of feature flags
/// - securitySettingsProvider          → Security settings (detail)
/// - billingSettingsProvider           → Billing settings (detail)
/// - communicationSettingsProvider     → Communication settings (detail)
/// - sealsProvider                     → Seals & signatures (detail)
/// - SettingsMutationNotifier          → create/update/delete mutations
///
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/services/settings_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────────

/// Singleton provider for [SettingsService].
final settingsServiceProvider = Provider<SettingsService>((ref) {
  return SettingsService();
});

// ─── General Settings Provider ───────────────────────────────────────────────

/// Fetches general settings.
final generalSettingsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getGeneral();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Academic Years Provider ─────────────────────────────────────────────────

/// Fetches the list of academic years.
final academicYearsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getAcademicYears();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Current Academic Year Provider ──────────────────────────────────────────

/// Fetches the current academic year.
final currentAcademicYearProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getCurrentAcademicYear();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Classes Provider ────────────────────────────────────────────────────────

/// Fetches the list of classes.
final classesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getClasses();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Settings Subjects Provider ──────────────────────────────────────────────

/// Fetches the list of subjects (settings context).
final settingsSubjectsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getSubjects();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Roles Provider ──────────────────────────────────────────────────────────

/// Fetches the list of roles.
final rolesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getRoles();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Permissions Provider ────────────────────────────────────────────────────

/// Fetches the list of permissions.
final permissionsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getPermissions();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Features Provider ───────────────────────────────────────────────────────

/// Fetches the list of feature flags.
final featuresProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getFeatures();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Security Settings Provider ──────────────────────────────────────────────

/// Fetches security settings.
final securitySettingsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getSecuritySettings();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Billing Settings Provider ───────────────────────────────────────────────

/// Fetches billing settings.
final billingSettingsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getBillingSettings();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Communication Settings Provider ─────────────────────────────────────────

/// Fetches communication settings.
final communicationSettingsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getCommunicationSettings();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Seals Provider ──────────────────────────────────────────────────────────

/// Fetches seals and signatures.
final sealsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(settingsServiceProvider);
  final result = await service.getSeals();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Mutation Notifier ───────────────────────────────────────────────────────

/// Notifier for settings CRUD mutations that automatically invalidates
/// relevant providers on success.
class SettingsMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  final SettingsService _service;

  SettingsMutationNotifier(this._ref, this._service)
      : super(const AsyncValue.data(null));

  /// Updates general settings and refreshes the provider.
  Future<bool> updateGeneralSettings(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateGeneral(data);
      return result.when(
        success: (_) {
          _ref.invalidate(generalSettingsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Creates a class and refreshes the list.
  Future<bool> createClass(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createClass(data);
      return result.when(
        success: (_) {
          _ref.invalidate(classesProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Updates a class and refreshes the list.
  Future<bool> updateClass(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateClass(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(classesProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Deletes a class and refreshes the list.
  Future<bool> deleteClass(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.deleteClass(id);
      return result.when(
        success: (_) {
          _ref.invalidate(classesProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Creates a subject and refreshes the list.
  Future<bool> createSubject(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createSubject(data);
      return result.when(
        success: (_) {
          _ref.invalidate(settingsSubjectsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Enables a feature and refreshes the list.
  Future<bool> enableFeature(String featureId) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.enableFeature(featureId);
      return result.when(
        success: (_) {
          _ref.invalidate(featuresProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Disables a feature and refreshes the list.
  Future<bool> disableFeature(String featureId) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.disableFeature(featureId);
      return result.when(
        success: (_) {
          _ref.invalidate(featuresProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

/// Provider for settings mutation operations.
final settingsMutationProvider =
    StateNotifierProvider<SettingsMutationNotifier, AsyncValue<void>>((ref) {
  final service = ref.read(settingsServiceProvider);
  return SettingsMutationNotifier(ref, service);
});
