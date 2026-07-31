import 'package:academia_helm_mobile/domain/entities/academic_year.dart';

abstract class AcademicYearRepository {
  /// Retrieves all academic years for the current tenant.
  Future<List<AcademicYear>> getAcademicYears();

  /// Retrieves the currently active academic year.
  Future<AcademicYear> getCurrentAcademicYear();
}
