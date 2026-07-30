import '../entities/grade.dart';
import '../../../core/network/api_result.dart';

abstract class GradeRepository {
  /// Retrieves the list of grades for a given student.
  ///
  /// [studentId] - The student's unique identifier.
  /// [period] - Optional period filter (e.g. 'TRIMESTRE_1').
  /// [subjectId] - Optional subject filter.
  Future<ApiResult<List<Grade>>> getGrades(
    String studentId, {
    String? period,
    String? subjectId,
  });

  /// Retrieves a single grade detail.
  ///
  /// [studentId] - The student's unique identifier.
  /// [gradeId] - The grade's unique identifier.
  Future<ApiResult<Grade>> getGradeDetail(String studentId, String gradeId);

  /// Retrieves subject averages for a student.
  ///
  /// [studentId] - The student's unique identifier.
  /// [period] - Optional period filter.
  Future<ApiResult<List<SubjectAverage>>> getSubjectAverages(
    String studentId, {
    String? period,
  });

  /// Retrieves the period report (bulletin) for a student.
  ///
  /// [studentId] - The student's unique identifier.
  /// [period] - The period identifier (e.g. 'TRIMESTRE_1').
  Future<ApiResult<PeriodReport>> getPeriodReport(
    String studentId,
    String period,
  );
}
