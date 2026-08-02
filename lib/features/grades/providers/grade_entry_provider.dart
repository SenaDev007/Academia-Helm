/// ============================================================================
/// GRADE ENTRY PROVIDER — Provider pour la saisie de notes (enseignant)
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';

/// Provider pour l'API de saisie de notes
final gradeEntryApiProvider = Provider<GradeEntryApi>((ref) {
  return GradeEntryApi(ref.read(apiClientProvider));
});

class GradeEntryApi {
  final ApiClient _client;
  GradeEntryApi(this._client);

  /// GET /api/exams/evaluations/{evaluationId}/students
  /// Récupère la liste des élèves avec leurs notes pour une évaluation
  Future<ApiResult<List<Map<String, dynamic>>>> getEvaluationGrades(
    String evaluationId,
  ) async {
    final result = await _client.getRaw('/api/exams/evaluations/$evaluationId/grades');

    return result.when(
      success: (data) {
        final items = data['data'] ?? data['grades'] ?? <dynamic>[];
        return ApiResult.success((items as List).cast<Map<String, dynamic>>());
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// POST /api/exams/evaluations/{evaluationId}/grades
  /// Sauvegarde les notes saisies
  Future<ApiResult<void>> saveGrades({
    required String evaluationId,
    required List<Map<String, dynamic>> grades,
  }) async {
    final result = await _client.post(
      '/api/exams/evaluations/$evaluationId/grades',
      data: {'grades': grades},
      fromJson: (_) => <String, dynamic>{},
    );

    return result.when(
      success: (_) => const ApiResult.success(null),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }
}

/// Provider pour les notes d'une évaluation
final evaluationGradesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, evaluationId) async {
  final api = ref.watch(gradeEntryApiProvider);
  final result = await api.getEvaluationGrades(evaluationId);

  return result.when(
    success: (grades) => grades,
    failure: (error) => throw Exception(error.message),
    loading: () => [],
  );
});
