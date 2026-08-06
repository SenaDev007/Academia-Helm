/// ============================================================================
/// ORION PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the ORION module (AI assistant).
/// Uses [OrionService] for read-only operations and returns [AsyncValue] states
/// that integrate seamlessly with [AsyncValueWidget] and [ModuleLoadingWrapper].
///
/// NOTE: ORION is 100% read-only except for:
/// - acknowledgeAlert (acquit an alert)
/// - updateConfig (update ORION configuration)
///
/// Providers:
/// - orionServiceProvider              → Singleton for [OrionService]
/// - orionMonthlySummaryProvider       → Monthly summary (optionally by period)
/// - orionAlertsProvider               → Family by OrionAlertsArgs
/// - orionHistoryProvider              → Family by OrionHistoryArgs
/// - orionConfigProvider               → ORION configuration (detail)
/// - orionKpisProvider                 → KPIs list
/// - orionInsightsProvider             → Insights list
/// - OrionMutationNotifier             → acknowledge/updateConfig only
///
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/services/orion_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────────

/// Singleton provider for [OrionService].
final orionServiceProvider = Provider<OrionService>((ref) {
  return OrionService();
});

// ─── Monthly Summary Provider ────────────────────────────────────────────────

/// Fetches the ORION monthly summary.
final orionMonthlySummaryProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(orionServiceProvider);
  final result = await service.getMonthlySummary();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

/// Fetches the ORION monthly summary for a specific period.
///
/// Usage:
/// ```dart
/// final summaryAsync = ref.watch(orionMonthlySummaryByPeriodProvider('2024-01'));
/// ```
final orionMonthlySummaryByPeriodProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, period) async {
  final service = ref.read(orionServiceProvider);
  final result = await service.getMonthlySummary(period: period);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Alerts Provider ─────────────────────────────────────────────────────────

/// Fetches ORION alerts with the default filter (acknowledged=true).
final orionAlertsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(orionServiceProvider);
  final result = await service.getAlerts();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

/// Fetches ORION alerts with custom filters.
///
/// Usage:
/// ```dart
/// final alertsAsync = ref.watch(orionAlertsFilteredProvider(
///   OrionAlertsArgs(level: 'CRITIQUE', acknowledged: false, academicYearId: ayid),
/// ));
/// ```
final orionAlertsFilteredProvider =
    FutureProvider.family<List<Map<String, dynamic>>, OrionAlertsArgs>(
        (ref, args) async {
  final service = ref.read(orionServiceProvider);
  final result = await service.getAlerts(
    level: args.level,
    acknowledged: args.acknowledged,
    alertType: args.alertType,
    academicYearId: args.academicYearId,
  );

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── History Provider ────────────────────────────────────────────────────────

/// Fetches ORION analysis history with default limit.
final orionHistoryProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(orionServiceProvider);
  final result = await service.getHistory();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

/// Fetches ORION analysis history with custom filters.
///
/// Usage:
/// ```dart
/// final historyAsync = ref.watch(orionHistoryFilteredProvider(
///   OrionHistoryArgs(limit: 20, type: 'KPI', startDate: '2024-01-01'),
/// ));
/// ```
final orionHistoryFilteredProvider =
    FutureProvider.family<List<Map<String, dynamic>>, OrionHistoryArgs>(
        (ref, args) async {
  final service = ref.read(orionServiceProvider);
  final result = await service.getHistory(
    limit: args.limit,
    type: args.type,
    startDate: args.startDate,
    endDate: args.endDate,
  );

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Config Provider ─────────────────────────────────────────────────────────

/// Fetches the ORION configuration.
final orionConfigProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(orionServiceProvider);
  final result = await service.getConfig();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── KPIs Provider ───────────────────────────────────────────────────────────

/// Fetches ORION KPIs.
final orionKpisProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(orionServiceProvider);
  final result = await service.getKPIs();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Insights Provider ───────────────────────────────────────────────────────

/// Fetches ORION insights.
final orionInsightsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(orionServiceProvider);
  final result = await service.getInsights();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Mutation Notifier ───────────────────────────────────────────────────────

/// Notifier for ORION mutations (acknowledge alert, update config).
/// ORION is otherwise 100% read-only.
class OrionMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  final OrionService _service;

  OrionMutationNotifier(this._ref, this._service)
      : super(const AsyncValue.data(null));

  /// Acknowledges an alert and refreshes the alerts provider.
  Future<bool> acknowledgeAlert(String alertId) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.acknowledgeAlert(alertId);
      return result.when(
        success: (_) {
          _ref.invalidate(orionAlertsProvider);
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

  /// Updates the ORION configuration and refreshes the config provider.
  Future<bool> updateConfig(Map<String, dynamic> config) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateConfig(config);
      return result.when(
        success: (_) {
          _ref.invalidate(orionConfigProvider);
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

  /// Asks ORION a question. Returns the response data directly.
  Future<Map<String, dynamic>?> ask(Map<String, dynamic> request) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.ask(request);
      return result.when(
        success: (data) {
          state = const AsyncValue.data(null);
          return data;
        },
        failure: (error) {
          state = AsyncValue.error(
              Exception(error.displayMessage), StackTrace.current);
          return null;
        },
        loading: () => null,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return null;
    }
  }
}

/// Provider for ORION mutation operations.
final orionMutationProvider =
    StateNotifierProvider<OrionMutationNotifier, AsyncValue<void>>((ref) {
  final service = ref.read(orionServiceProvider);
  return OrionMutationNotifier(ref, service);
});

// ─── Argument Classes ────────────────────────────────────────────────────────

/// Arguments for the [orionAlertsFilteredProvider].
class OrionAlertsArgs {
  final String? level;
  final bool? acknowledged;
  final String? alertType;
  final String? academicYearId;

  const OrionAlertsArgs({
    this.level,
    this.acknowledged,
    this.alertType,
    this.academicYearId,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrionAlertsArgs &&
          runtimeType == other.runtimeType &&
          level == other.level &&
          acknowledged == other.acknowledged &&
          alertType == other.alertType &&
          academicYearId == other.academicYearId;

  @override
  int get hashCode =>
      (level?.hashCode ?? 0) ^
      (acknowledged?.hashCode ?? 0) ^
      (alertType?.hashCode ?? 0) ^
      (academicYearId?.hashCode ?? 0);
}

/// Arguments for the [orionHistoryFilteredProvider].
class OrionHistoryArgs {
  final int limit;
  final String? type;
  final String? startDate;
  final String? endDate;

  const OrionHistoryArgs({
    this.limit = 50,
    this.type,
    this.startDate,
    this.endDate,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OrionHistoryArgs &&
          runtimeType == other.runtimeType &&
          limit == other.limit &&
          type == other.type &&
          startDate == other.startDate &&
          endDate == other.endDate;

  @override
  int get hashCode =>
      limit.hashCode ^
      (type?.hashCode ?? 0) ^
      (startDate?.hashCode ?? 0) ^
      (endDate?.hashCode ?? 0);
}
