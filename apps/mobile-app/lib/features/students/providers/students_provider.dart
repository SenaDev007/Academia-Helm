/// ============================================================================
/// STUDENTS PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Students (Élèves) module.
/// Uses [StudentsService] for CRUD operations and returns [AsyncValue] states
/// that integrate seamlessly with [AsyncValueWidget] and [ModuleLoadingWrapper].
///
/// Providers:
/// - studentsProvider        → FutureProvider for fetching all students
/// - studentDetailProvider   → Family provider for a single student
/// - studentDossierProvider  → Family provider for a student's full dossier
/// - studentAdmissionsProvider → FutureProvider for admissions list
/// - studentsStatisticsProvider → Family provider for statistics
///
/// Usage with ModuleLoadingWrapper:
/// ```dart
/// class StudentsScreen extends ConsumerWidget {
///   @override
///   Widget build(BuildContext context, WidgetRef ref) {
///     final studentsAsync = ref.watch(studentsProvider);
///
///     return ModuleLoadingWrapper<List<Map<String, dynamic>>>(
///       value: studentsAsync,
///       moduleName: 'Élèves',
///       onRetry: () => ref.invalidate(studentsProvider),
///       builder: (students) => StudentsList(students: students),
///     );
///   }
/// }
/// ```
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/services/students_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────────

/// Singleton provider for [StudentsService].
final studentsServiceProvider = Provider<StudentsService>((ref) {
  return StudentsService();
});

// ─── Students List Provider ──────────────────────────────────────────────────

/// Fetches the list of all students.
///
/// Returns `List<Map<String, dynamic>>` on success.
/// On failure, throws an exception that Riverpod catches and exposes as
/// `AsyncValue.error`, which [AsyncValueWidget] / [ModuleLoadingWrapper] render
/// using [ErrorStateWidget].
final studentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(studentsServiceProvider);
  final result = await service.getAll();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.message),
    loading: () => [],
  );
});

// ─── Student Detail Provider ─────────────────────────────────────────────────

/// Fetches a single student by ID.
///
/// Usage:
/// ```dart
/// final studentAsync = ref.watch(studentDetailProvider(studentId));
/// ```
final studentDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final service = ref.read(studentsServiceProvider);
  final result = await service.getById(id);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.message),
    loading: () => <String, dynamic>{},
  );
});

// ─── Student Dossier Provider ────────────────────────────────────────────────

/// Fetches the full dossier for a student.
///
/// Usage:
/// ```dart
/// final dossierAsync = ref.watch(studentDossierProvider(
///   StudentDossierArgs(studentId: id, academicYearId: yearId),
/// ));
/// ```
final studentDossierProvider = FutureProvider.family<Map<String, dynamic>,
    StudentDossierArgs>((ref, args) async {
  final service = ref.read(studentsServiceProvider);
  final result = await service.getDossier(
    args.studentId,
    academicYearId: args.academicYearId,
  );

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.message),
    loading: () => <String, dynamic>{},
  );
});

// ─── Student Admissions Provider ─────────────────────────────────────────────

/// Fetches the list of admissions.
final studentAdmissionsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(studentsServiceProvider);
  final result = await service.getAdmissions();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.message),
    loading: () => [],
  );
});

// ─── Student Enrollments Provider ────────────────────────────────────────────

/// Fetches the list of enrollments.
final studentEnrollmentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(studentsServiceProvider);
  final result = await service.getEnrollments();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.message),
    loading: () => [],
  );
});

// ─── Student Statistics Provider ─────────────────────────────────────────────

/// Fetches statistics for the students module.
///
/// Usage:
/// ```dart
/// final statsAsync = ref.watch(studentsStatisticsProvider(
///   StudentStatsArgs(academicYearId: yearId, schoolLevelId: levelId),
/// ));
/// ```
final studentsStatisticsProvider = FutureProvider.family<Map<String, dynamic>,
    StudentStatsArgs>((ref, args) async {
  final service = ref.read(studentsServiceProvider);
  final result = await service.getStatistics(
    args.academicYearId,
    args.schoolLevelId,
  );

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.message),
    loading: () => <String, dynamic>{},
  );
});

// ─── Orion KPIs Provider ─────────────────────────────────────────────────────

/// Fetches Orion KPIs for the students module.
final studentsOrionKpisProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, academicYearId) async {
  final service = ref.read(studentsServiceProvider);
  final result = await service.getOrionKpis(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.message),
    loading: () => <String, dynamic>{},
  );
});

// ─── Orion Alerts Provider ───────────────────────────────────────────────────

/// Fetches Orion alerts for the students module.
final studentsOrionAlertsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, academicYearId) async {
  final service = ref.read(studentsServiceProvider);
  final result = await service.getOrionAlerts(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.message),
    loading: () => [],
  );
});

// ─── Mutation Helpers ────────────────────────────────────────────────────────

/// Notifier for student CRUD mutations that automatically invalidates
/// the [studentsProvider] on success.
class StudentMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  final StudentsService _service;

  StudentMutationNotifier(this._ref, this._service)
      : super(const AsyncValue.data(null));

  /// Creates a new student and refreshes the students list.
  Future<bool> createStudent(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.create(data);
      return result.when(
        success: (_) {
          _ref.invalidate(studentsProvider);
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(Exception(error.message), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Updates an existing student and refreshes the students list.
  Future<bool> updateStudent(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.update(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(studentsProvider);
          _ref.invalidate(studentDetailProvider(id));
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(Exception(error.message), StackTrace.current);
          return false;
        },
        loading: () => false,
      );
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }

  /// Deletes a student and refreshes the students list.
  Future<bool> deleteStudent(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.delete(id);
      return result.when(
        success: (_) {
          _ref.invalidate(studentsProvider);
          _ref.invalidate(studentDetailProvider(id));
          state = const AsyncValue.data(null);
          return true;
        },
        failure: (error) {
          state = AsyncValue.error(Exception(error.message), StackTrace.current);
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

/// Provider for student mutation operations.
final studentMutationProvider =
    StateNotifierProvider<StudentMutationNotifier, AsyncValue<void>>((ref) {
  final service = ref.read(studentsServiceProvider);
  return StudentMutationNotifier(ref, service);
});

// ─── Argument Classes ────────────────────────────────────────────────────────

/// Arguments for the [studentDossierProvider].
class StudentDossierArgs {
  final String studentId;
  final String? academicYearId;

  const StudentDossierArgs({
    required this.studentId,
    this.academicYearId,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is StudentDossierArgs &&
          runtimeType == other.runtimeType &&
          studentId == other.studentId &&
          academicYearId == other.academicYearId;

  @override
  int get hashCode => studentId.hashCode ^ academicYearId.hashCode;
}

/// Arguments for the [studentsStatisticsProvider].
class StudentStatsArgs {
  final String academicYearId;
  final String schoolLevelId;

  const StudentStatsArgs({
    required this.academicYearId,
    required this.schoolLevelId,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is StudentStatsArgs &&
          runtimeType == other.runtimeType &&
          academicYearId == other.academicYearId &&
          schoolLevelId == other.schoolLevelId;

  @override
  int get hashCode => academicYearId.hashCode ^ schoolLevelId.hashCode;
}
