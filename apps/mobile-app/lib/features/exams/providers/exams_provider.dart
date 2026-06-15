/// ============================================================================
/// EXAMS PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Exams module.
/// Uses [ExamsService] for CRUD operations and returns [AsyncValue] states
/// that integrate seamlessly with [AsyncValueWidget] and [ModuleLoadingWrapper].
///
/// Providers:
/// - examsServiceProvider                → Singleton for [ExamsService]
/// - evaluationsProvider                 → List of evaluations
/// - evaluationDetailProvider            → Family by id
/// - gradesByEvaluationProvider          → Family by evaluationId
/// - bulletinsProvider                   → Family by classId
/// - councilsProvider                    → List of class councils
/// - councilDetailProvider               → Family by id
/// - examsConfigProvider                 → Exams configuration (detail)
/// - examsDashboardProvider              → Family by academicYearId
/// - institutionalExamsProvider          → List of institutional exams
/// - ExamsMutationNotifier               → create/update/save mutations
///
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/services/exams_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────────

/// Singleton provider for [ExamsService].
final examsServiceProvider = Provider<ExamsService>((ref) {
  return ExamsService();
});

// ─── Evaluations Provider ────────────────────────────────────────────────────

/// Fetches the list of evaluations.
final evaluationsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(examsServiceProvider);
  final result = await service.getEvaluations();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Evaluation Detail Provider ──────────────────────────────────────────────

/// Fetches a single evaluation by ID.
///
/// Usage:
/// ```dart
/// final evalAsync = ref.watch(evaluationDetailProvider(evaluationId));
/// ```
final evaluationDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final service = ref.read(examsServiceProvider);
  final result = await service.getEvaluationById(id);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Grades By Evaluation Provider ───────────────────────────────────────────

/// Fetches grades for a given evaluation.
///
/// Usage:
/// ```dart
/// final gradesAsync = ref.watch(gradesByEvaluationProvider(evaluationId));
/// ```
final gradesByEvaluationProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, evaluationId) async {
  final service = ref.read(examsServiceProvider);
  final result = await service.getGradesByEvaluation(evaluationId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Bulletins Provider ──────────────────────────────────────────────────────

/// Fetches bulletins for a given class.
///
/// Usage:
/// ```dart
/// final bulletinsAsync = ref.watch(bulletinsProvider(classId));
/// ```
final bulletinsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, classId) async {
  final service = ref.read(examsServiceProvider);
  final result = await service.getBulletins(classId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Councils Provider ───────────────────────────────────────────────────────

/// Fetches the list of class councils.
final councilsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(examsServiceProvider);
  final result = await service.getCouncils();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Council Detail Provider ─────────────────────────────────────────────────

/// Fetches a single class council by ID.
///
/// Usage:
/// ```dart
/// final councilAsync = ref.watch(councilDetailProvider(councilId));
/// ```
final councilDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final service = ref.read(examsServiceProvider);
  final result = await service.getCouncilById(id);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Exams Config Provider ───────────────────────────────────────────────────

/// Fetches the exams configuration.
final examsConfigProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final service = ref.read(examsServiceProvider);
  final result = await service.getConfig();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Exams Dashboard Provider ────────────────────────────────────────────────

/// Fetches the exams dashboard for a given academic year.
///
/// Usage:
/// ```dart
/// final dashboardAsync = ref.watch(examsDashboardProvider(academicYearId));
/// ```
final examsDashboardProvider =
    FutureProvider.family<Map<String, dynamic>, String>(
        (ref, academicYearId) async {
  final service = ref.read(examsServiceProvider);
  final result = await service.getDashboard(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Institutional Exams Provider ────────────────────────────────────────────

/// Fetches the list of institutional exams.
final institutionalExamsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(examsServiceProvider);
  final result = await service.getInstitutionalExams();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Mutation Notifier ───────────────────────────────────────────────────────

/// Notifier for exams CRUD mutations that automatically invalidates
/// relevant providers on success.
class ExamsMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  final ExamsService _service;

  ExamsMutationNotifier(this._ref, this._service)
      : super(const AsyncValue.data(null));

  /// Creates an evaluation and refreshes the list.
  Future<bool> createEvaluation(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createEvaluation(data);
      return result.when(
        success: (_) {
          _ref.invalidate(evaluationsProvider);
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

  /// Updates an evaluation and refreshes the list.
  Future<bool> updateEvaluation(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateEvaluation(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(evaluationsProvider);
          _ref.invalidate(evaluationDetailProvider(id));
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

  /// Saves grades in batch.
  Future<bool> saveGrades(List<Map<String, dynamic>> grades) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.saveGrades(grades);
      return result.when(
        success: (_) {
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

  /// Saves a single grade (offline-first).
  Future<bool> saveGrade(Map<String, dynamic> gradeData) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.saveGrade(gradeData);
      return result.when(
        success: (_) {
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

  /// Generates a bulletin for a student.
  Future<bool> generateBulletin(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.generateBulletin(data);
      return result.when(
        success: (_) {
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

  /// Creates a class council and refreshes the list.
  Future<bool> createCouncil(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createCouncil(data);
      return result.when(
        success: (_) {
          _ref.invalidate(councilsProvider);
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

  /// Updates the exams configuration.
  Future<bool> updateExamsConfig(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateConfig(data);
      return result.when(
        success: (_) {
          _ref.invalidate(examsConfigProvider);
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

/// Provider for exams mutation operations.
final examsMutationProvider =
    StateNotifierProvider<ExamsMutationNotifier, AsyncValue<void>>((ref) {
  final service = ref.read(examsServiceProvider);
  return ExamsMutationNotifier(ref, service);
});
