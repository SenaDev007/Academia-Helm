import 'package:freezed_annotation/freezed_annotation.dart';

part 'academic_year.freezed.dart';
part 'academic_year.g.dart';

@freezed
class AcademicYear with _$AcademicYear {
  const factory AcademicYear({
    required String id,
    required String name,
    required DateTime startDate,
    required DateTime endDate,
    bool? isCurrent,
    String? status,
  }) = _AcademicYear;

  factory AcademicYear.fromJson(Map<String, dynamic> json) =>
      _$AcademicYearFromJson(json);
}
