import 'package:freezed_annotation/freezed_annotation.dart';

part 'absence.freezed.dart';
part 'absence.g.dart';

/// Represents an absence or tardiness record.
@freezed
class Absence with _$Absence {
  const factory Absence({
    required String id,
    required String studentId,
    required AbsenceType type,
    required DateTime date,
    String? time, // For tardiness: "08:15"
    String? subjectName,
    String? justification,
    @Default(false) bool isJustified,
    String? reportedBy,
    DateTime? createdAt,
  }) = _Absence;

  const Absence._();

  /// Display date in French format.
  String get displayDate =>
      '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';

  /// Type label in French.
  String get typeLabel => type == AbsenceType.absence ? 'Absence' : 'Retard';

  factory Absence.fromJson(Map<String, dynamic> json) =>
      _$AbsenceFromJson(json);
}

/// Absence type enum.
enum AbsenceType {
  @JsonValue('ABSENCE')
  absence,
  @JsonValue('TARDINESS')
  tardiness,
}
