import 'package:freezed_annotation/freezed_annotation.dart';

part 'student.freezed.dart';
part 'student.g.dart';

@freezed
class Student with _$Student {
  const factory Student({
    required String id,
    required String firstName,
    required String lastName,
    required String matricule,
    String? tenantMatricule,
    String? globalMatricule,
    String? classId,
    String? className,
    String? schoolLevelId,
    String? schoolLevelName,
    String? photoUrl,
    String? gender,
    DateTime? dateOfBirth,
    String? parentName,
    String? parentPhone,
    String? status,
  }) = _Student;

  const Student._();

  String get fullName => '$firstName $lastName';
  String get initials => '${firstName[0]}${lastName[0]}'.toUpperCase();
  bool get isActive => status == 'ACTIVE';

  factory Student.fromJson(Map<String, dynamic> json) => _$StudentFromJson(json);
}
