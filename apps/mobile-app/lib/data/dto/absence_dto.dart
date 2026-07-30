import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/absence.dart';

part 'absence_dto.g.dart';

/// DTO for [Absence] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class AbsenceDto {
  final String id;
  final String studentId;
  final String type; // API returns string, convert to enum
  final String date;
  final String? time;
  final String? subjectName;
  final String? justification;
  final bool? isJustified;
  final String? reportedBy;
  final String? createdAt;

  AbsenceDto({
    required this.id,
    required this.studentId,
    required this.type,
    required this.date,
    this.time,
    this.subjectName,
    this.justification,
    this.isJustified,
    this.reportedBy,
    this.createdAt,
  });

  factory AbsenceDto.fromJson(Map<String, dynamic> json) =>
      _$AbsenceDtoFromJson(json);

  Map<String, dynamic> toJson() => _$AbsenceDtoToJson(this);

  /// Converts the API type string to [AbsenceType] enum.
  AbsenceType _parseType(String typeStr) {
    switch (typeStr.toUpperCase()) {
      case 'ABSENCE':
        return AbsenceType.absence;
      case 'TARDINESS':
        return AbsenceType.tardiness;
      default:
        return AbsenceType.absence;
    }
  }

  Absence toDomain() => Absence(
        id: id,
        studentId: studentId,
        type: _parseType(type),
        date: DateTime.tryParse(date) ?? DateTime.now(),
        time: time,
        subjectName: subjectName,
        justification: justification,
        isJustified: isJustified ?? false,
        reportedBy: reportedBy,
        createdAt: createdAt != null ? DateTime.tryParse(createdAt!) : null,
      );
}
