/// ============================================================================
/// PEDAGOGY PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Pedagogy module.
/// Uses [PedagogyService] for CRUD operations and returns [AsyncValue] states
/// that integrate seamlessly with [AsyncValueWidget] and [ModuleLoadingWrapper].
///
/// Providers:
/// - pedagogyServiceProvider            → Singleton for [PedagogyService]
/// - classDiariesProvider               → Family by classSubjectId
/// - lessonPlansProvider                → List of lesson plans
/// - lessonPlansByClassSubjectProvider  → Family by classSubjectId
/// - lessonJournalsProvider             → List of lesson journals
/// - lessonJournalsByDateProvider       → Family by date
/// - teacherAssignmentsProvider         → Family by TeacherAssignmentArgs
/// - subjectsProvider                   → Family by academicYearId
/// - seriesProvider                     → Family by academicYearId
/// - teachersProvider                   → List of teachers
/// - teacherProfilesProvider            → Family by academicYearId
/// - academicClassesProvider            → Family by academicYearId
/// - classSubjectsProvider              → Family by ClassSubjectsArgs
/// - timetablesProvider                 → List of timetables
/// - currentSemainierProvider           → Family by SemainierArgs
/// - homeworkEntriesProvider            → List of homework entries
/// - homeworkEntriesByClassProvider     → Family by classId
/// - pedagogicalMaterialsProvider       → Family by academicYearId
/// - pedagogyKpiDashboardProvider       → Family by academicYearId
/// - pedagogyOrionDashboardProvider     → Family by academicYearId
/// - PedagogyMutationNotifier           → create/update/delete mutations
///
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../../data/services/pedagogy_service.dart';

// ─── Service Provider ────────────────────────────────────────────────────────

/// Singleton provider for [PedagogyService].
final pedagogyServiceProvider = Provider<PedagogyService>((ref) {
  return PedagogyService();
});

// ─── Class Diaries Provider ──────────────────────────────────────────────────

/// Fetches class diaries entries for a given classSubjectId.
///
/// Usage:
/// ```dart
/// final diariesAsync = ref.watch(classDiariesProvider(classSubjectId));
/// ```
final classDiariesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, classSubjectId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getClassDiaries(classSubjectId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Lesson Plans Provider ───────────────────────────────────────────────────

/// Fetches the list of all lesson plans.
final lessonPlansProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getLessonPlans();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

/// Fetches lesson plans filtered by classSubjectId.
///
/// Usage:
/// ```dart
/// final plansAsync = ref.watch(lessonPlansByClassSubjectProvider(classSubjectId));
/// ```
final lessonPlansByClassSubjectProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, classSubjectId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getLessonPlans(classSubjectId: classSubjectId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Lesson Journals Provider ────────────────────────────────────────────────

/// Fetches the list of all lesson journals.
final lessonJournalsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getLessonJournals();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

/// Fetches lesson journals filtered by date.
///
/// Usage:
/// ```dart
/// final journalsAsync = ref.watch(lessonJournalsByDateProvider('2024-01-15'));
/// ```
final lessonJournalsByDateProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, date) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getLessonJournals(date: date);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Teacher Assignments Provider ────────────────────────────────────────────

/// Fetches teacher assignments for a given teacher and academic year.
///
/// Usage:
/// ```dart
/// final assignmentsAsync = ref.watch(teacherAssignmentsProvider(
///   TeacherAssignmentArgs(teacherId: tid, academicYearId: ayid),
/// ));
/// ```
final teacherAssignmentsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, TeacherAssignmentArgs>(
        (ref, args) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getTeacherAssignments(
    args.teacherId,
    args.academicYearId,
  );

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Subjects Provider ───────────────────────────────────────────────────────

/// Fetches subjects for a given academic year.
///
/// Usage:
/// ```dart
/// final subjectsAsync = ref.watch(subjectsProvider(academicYearId));
/// ```
final subjectsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, academicYearId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getSubjects(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Series Provider ─────────────────────────────────────────────────────────

/// Fetches academic series for a given academic year.
///
/// Usage:
/// ```dart
/// final seriesAsync = ref.watch(seriesProvider(academicYearId));
/// ```
final seriesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, academicYearId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getSeries(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Teachers Provider ───────────────────────────────────────────────────────

/// Fetches the list of all teachers.
final teachersProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getTeachers();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Teacher Profiles Provider ───────────────────────────────────────────────

/// Fetches teacher profiles for a given academic year.
///
/// Usage:
/// ```dart
/// final profilesAsync = ref.watch(teacherProfilesProvider(academicYearId));
/// ```
final teacherProfilesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, academicYearId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getTeacherProfiles(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Academic Classes Provider ───────────────────────────────────────────────

/// Fetches academic classes for a given academic year.
///
/// Usage:
/// ```dart
/// final classesAsync = ref.watch(academicClassesProvider(academicYearId));
/// ```
final academicClassesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, academicYearId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getAcademicClasses(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Class Subjects Provider ─────────────────────────────────────────────────

/// Fetches subjects for a given class and academic year.
///
/// Usage:
/// ```dart
/// final classSubjectsAsync = ref.watch(classSubjectsProvider(
///   ClassSubjectsArgs(classId: cid, academicYearId: ayid),
/// ));
/// ```
final classSubjectsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, ClassSubjectsArgs>(
        (ref, args) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getClassSubjects(
    args.classId,
    args.academicYearId,
  );

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Timetables Provider ─────────────────────────────────────────────────────

/// Fetches the list of timetables.
final timetablesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getTimetables();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Semainier Provider ──────────────────────────────────────────────────────

/// Fetches the current semainier for a given academic year and school level.
///
/// Usage:
/// ```dart
/// final semainierAsync = ref.watch(currentSemainierProvider(
///   SemainierArgs(academicYearId: ayid, schoolLevelId: slid),
/// ));
/// ```
final currentSemainierProvider =
    FutureProvider.family<Map<String, dynamic>?, SemainierArgs>(
        (ref, args) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getCurrentSemainier(
    args.academicYearId,
    args.schoolLevelId,
  );

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => null,
  );
});

// ─── Homework Entries Provider ───────────────────────────────────────────────

/// Fetches the list of all homework entries.
final homeworkEntriesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getHomeworkEntries();

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

/// Fetches homework entries filtered by classId.
///
/// Usage:
/// ```dart
/// final homeworkAsync = ref.watch(homeworkEntriesByClassProvider(classId));
/// ```
final homeworkEntriesByClassProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, classId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getHomeworkEntries(classId: classId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── Pedagogical Materials Provider ──────────────────────────────────────────

/// Fetches pedagogical materials for a given academic year.
///
/// Usage:
/// ```dart
/// final materialsAsync = ref.watch(pedagogicalMaterialsProvider(academicYearId));
/// ```
final pedagogicalMaterialsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
        (ref, academicYearId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getPedagogicalMaterials(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => [],
  );
});

// ─── KPI Dashboard Provider ──────────────────────────────────────────────────

/// Fetches the pedagogy KPI dashboard for a given academic year.
///
/// Usage:
/// ```dart
/// final kpiAsync = ref.watch(pedagogyKpiDashboardProvider(academicYearId));
/// ```
final pedagogyKpiDashboardProvider =
    FutureProvider.family<Map<String, dynamic>, String>(
        (ref, academicYearId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getKpiDashboard(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Orion Dashboard Provider ────────────────────────────────────────────────

/// Fetches the ORION pedagogy dashboard for a given academic year.
///
/// Usage:
/// ```dart
/// final orionAsync = ref.watch(pedagogyOrionDashboardProvider(academicYearId));
/// ```
final pedagogyOrionDashboardProvider =
    FutureProvider.family<Map<String, dynamic>, String>(
        (ref, academicYearId) async {
  final service = ref.read(pedagogyServiceProvider);
  final result = await service.getOrionDashboard(academicYearId);

  return result.when(
    success: (data) => data,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <String, dynamic>{},
  );
});

// ─── Mutation Notifier ───────────────────────────────────────────────────────

/// Notifier for pedagogy CRUD mutations that automatically invalidates
/// relevant providers on success.
class PedagogyMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  final PedagogyService _service;

  PedagogyMutationNotifier(this._ref, this._service)
      : super(const AsyncValue.data(null));

  /// Creates a class diary.
  Future<bool> createClassDiary(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createClassDiary(data);
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

  /// Updates a class diary.
  Future<bool> updateClassDiary(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateClassDiary(id, data);
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

  /// Creates a lesson plan.
  Future<bool> createLessonPlan(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createLessonPlan(data);
      return result.when(
        success: (_) {
          _ref.invalidate(lessonPlansProvider);
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

  /// Updates a lesson plan.
  Future<bool> updateLessonPlan(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateLessonPlan(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(lessonPlansProvider);
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

  /// Creates a lesson journal.
  Future<bool> createLessonJournal(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createLessonJournal(data);
      return result.when(
        success: (_) {
          _ref.invalidate(lessonJournalsProvider);
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

  /// Updates a lesson journal.
  Future<bool> updateLessonJournal(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateLessonJournal(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(lessonJournalsProvider);
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

  /// Creates a teacher assignment.
  Future<bool> createTeacherAssignment(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createTeacherAssignment(data);
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

  /// Deletes a teacher assignment.
  Future<bool> deleteTeacherAssignment(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.deleteTeacherAssignment(id);
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

  /// Creates a subject.
  Future<bool> createSubject(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createSubject(data);
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

  /// Updates a subject.
  Future<bool> updateSubject(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateSubject(id, data);
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

  /// Deletes a subject.
  Future<bool> deleteSubject(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.deleteSubject(id);
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

  /// Creates an academic series.
  Future<bool> createSeries(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createSeries(data);
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

  /// Updates an academic series.
  Future<bool> updateSeries(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateSeries(id, data);
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

  /// Adds a subject to a series.
  Future<bool> addSubjectToSeries(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.addSubjectToSeries(data);
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

  /// Removes a subject from a series.
  Future<bool> removeSubjectFromSeries(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.removeSubjectFromSeries(id);
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

  /// Creates a teacher.
  Future<bool> createTeacher(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createTeacher(data);
      return result.when(
        success: (_) {
          _ref.invalidate(teachersProvider);
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

  /// Updates a teacher.
  Future<bool> updateTeacher(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateTeacher(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(teachersProvider);
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

  /// Creates a teacher profile.
  Future<bool> createTeacherProfile(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createTeacherProfile(data);
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

  /// Updates a teacher profile.
  Future<bool> updateTeacherProfile(
      String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateTeacherProfile(id, data);
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

  /// Removes a class subject.
  Future<bool> removeClassSubject(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.removeClassSubject(id);
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

  /// Creates a semainier.
  Future<bool> createSemainier(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createSemainier(data);
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

  /// Adds a daily entry to a semainier.
  Future<bool> addSemainierDailyEntry(
      String semainierId, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.addSemainierDailyEntry(semainierId, data);
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

  /// Reports an incident in a semainier.
  Future<bool> reportSemainierIncident(
      String semainierId, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result =
          await _service.reportSemainierIncident(semainierId, data);
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

  /// Submits a semainier.
  Future<bool> submitSemainier(String semainierId) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.submitSemainier(semainierId);
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

  /// Creates a homework entry.
  Future<bool> createHomeworkEntry(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createHomeworkEntry(data);
      return result.when(
        success: (_) {
          _ref.invalidate(homeworkEntriesProvider);
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

  /// Updates a homework entry.
  Future<bool> updateHomeworkEntry(
      String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updateHomeworkEntry(id, data);
      return result.when(
        success: (_) {
          _ref.invalidate(homeworkEntriesProvider);
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

  /// Deletes a homework entry.
  Future<bool> deleteHomeworkEntry(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.deleteHomeworkEntry(id);
      return result.when(
        success: (_) {
          _ref.invalidate(homeworkEntriesProvider);
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

  /// Creates a pedagogical material.
  Future<bool> createPedagogicalMaterial(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.createPedagogicalMaterial(data);
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

  /// Updates a pedagogical material.
  Future<bool> updatePedagogicalMaterial(
      String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.updatePedagogicalMaterial(id, data);
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

  /// Deletes a pedagogical material.
  Future<bool> deletePedagogicalMaterial(String id) async {
    state = const AsyncValue.loading();
    try {
      final result = await _service.deletePedagogicalMaterial(id);
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
}

/// Provider for pedagogy mutation operations.
final pedagogyMutationProvider =
    StateNotifierProvider<PedagogyMutationNotifier, AsyncValue<void>>((ref) {
  final service = ref.read(pedagogyServiceProvider);
  return PedagogyMutationNotifier(ref, service);
});

// ─── Argument Classes ────────────────────────────────────────────────────────

/// Arguments for the [teacherAssignmentsProvider].
class TeacherAssignmentArgs {
  final String teacherId;
  final String academicYearId;

  const TeacherAssignmentArgs({
    required this.teacherId,
    required this.academicYearId,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TeacherAssignmentArgs &&
          runtimeType == other.runtimeType &&
          teacherId == other.teacherId &&
          academicYearId == other.academicYearId;

  @override
  int get hashCode => teacherId.hashCode ^ academicYearId.hashCode;
}

/// Arguments for the [classSubjectsProvider].
class ClassSubjectsArgs {
  final String classId;
  final String academicYearId;

  const ClassSubjectsArgs({
    required this.classId,
    required this.academicYearId,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ClassSubjectsArgs &&
          runtimeType == other.runtimeType &&
          classId == other.classId &&
          academicYearId == other.academicYearId;

  @override
  int get hashCode => classId.hashCode ^ academicYearId.hashCode;
}

/// Arguments for the [currentSemainierProvider].
class SemainierArgs {
  final String academicYearId;
  final String schoolLevelId;

  const SemainierArgs({
    required this.academicYearId,
    required this.schoolLevelId,
  });

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SemainierArgs &&
          runtimeType == other.runtimeType &&
          academicYearId == other.academicYearId &&
          schoolLevelId == other.schoolLevelId;

  @override
  int get hashCode => academicYearId.hashCode ^ schoolLevelId.hashCode;
}
