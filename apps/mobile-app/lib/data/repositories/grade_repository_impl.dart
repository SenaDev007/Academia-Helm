import '../../../core/network/api_result.dart';
import '../../../domain/entities/grade.dart';
import '../../../domain/repositories/grade_repository.dart';
import '../datasources/remote/grade_api.dart';

/// Concrete implementation of [GradeRepository] that delegates to [GradeApi].
class GradeRepositoryImpl implements GradeRepository {
  final GradeApi _gradeApi;

  GradeRepositoryImpl(this._gradeApi);

  @override
  Future<ApiResult<List<Grade>>> getGrades(
    String studentId, {
    String? period,
    String? subjectId,
  }) {
    return _gradeApi.getGrades(
      studentId,
      period: period,
      subjectId: subjectId,
    );
  }

  @override
  Future<ApiResult<Grade>> getGradeDetail(String studentId, String gradeId) {
    return _gradeApi.getGradeDetail(studentId, gradeId);
  }

  @override
  Future<ApiResult<List<SubjectAverage>>> getSubjectAverages(
    String studentId, {
    String? period,
  }) {
    return _gradeApi.getSubjectAverages(studentId, period: period);
  }

  @override
  Future<ApiResult<PeriodReport>> getPeriodReport(
    String studentId,
    String period,
  ) {
    return _gradeApi.getPeriodReport(studentId, period);
  }
}
