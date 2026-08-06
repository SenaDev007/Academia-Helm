import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:academia_helm_mobile/domain/entities/student.dart';

part 'student_dto.freezed.dart';
part 'student_dto.g.dart';

@freezed
class StudentDto with _$StudentDto {
  const factory StudentDto({
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
  }) = _StudentDto;

  const StudentDto._();

  /// Converts this DTO into a domain [Student] entity.
  Student toDomain() => Student(
        id: id,
        firstName: firstName,
        lastName: lastName,
        matricule: matricule,
        tenantMatricule: tenantMatricule,
        globalMatricule: globalMatricule,
        classId: classId,
        className: className,
        schoolLevelId: schoolLevelId,
        schoolLevelName: schoolLevelName,
        photoUrl: photoUrl,
        gender: gender,
        dateOfBirth: dateOfBirth,
        parentName: parentName,
        parentPhone: parentPhone,
        status: status,
      );

  factory StudentDto.fromJson(Map<String, dynamic> json) =>
      _$StudentDtoFromJson(json);
}

@freezed
class CreateStudentRequest with _$CreateStudentRequest {
  const factory CreateStudentRequest({
    required String firstName,
    required String lastName,
    required String matricule,
    String? classId,
    String? schoolLevelId,
    String? gender,
    DateTime? dateOfBirth,
    String? parentName,
    String? parentPhone,
  }) = _CreateStudentRequest;

  factory CreateStudentRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateStudentRequestFromJson(json);
}

@freezed
class UpdateStudentRequest with _$UpdateStudentRequest {
  const factory UpdateStudentRequest({
    String? firstName,
    String? lastName,
    String? classId,
    String? schoolLevelId,
    String? gender,
    DateTime? dateOfBirth,
    String? parentName,
    String? parentPhone,
    String? status,
  }) = _UpdateStudentRequest;

  factory UpdateStudentRequest.fromJson(Map<String, dynamic> json) =>
      _$UpdateStudentRequestFromJson(json);
}

@freezed
class StudentListResponse with _$StudentListResponse {
  const factory StudentListResponse({
    required List<StudentDto> data,
    required int total,
    required int page,
    required int limit,
  }) = _StudentListResponse;

  factory StudentListResponse.fromJson(Map<String, dynamic> json) =>
      _$StudentListResponseFromJson(json);
}
