import 'package:freezed_annotation/freezed_annotation.dart';

part 'school_level.freezed.dart';
part 'school_level.g.dart';

@freezed
class SchoolLevel with _$SchoolLevel {
  const factory SchoolLevel({
    required String id,
    required String code,
    required String name,
    required String label,
    required int order,
    bool? isActive,
  }) = _SchoolLevel;

  factory SchoolLevel.fromJson(Map<String, dynamic> json) =>
      _$SchoolLevelFromJson(json);
}
