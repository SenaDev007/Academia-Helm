import '../../../core/network/api_result.dart';
import '../../../domain/entities/absence.dart';
import '../../../domain/repositories/absence_repository.dart';
import '../datasources/remote/absence_api.dart';

/// Concrete implementation of [AbsenceRepository] that delegates to [AbsenceApi].
class AbsenceRepositoryImpl implements AbsenceRepository {
  final AbsenceApi _absenceApi;

  AbsenceRepositoryImpl(this._absenceApi);

  @override
  Future<ApiResult<List<Absence>>> getAbsences(
    String studentId, {
    String? type,
    DateTime? startDate,
    DateTime? endDate,
  }) {
    return _absenceApi.getAbsences(
      studentId,
      type: type,
      startDate: startDate,
      endDate: endDate,
    );
  }
}
