// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'student_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$StudentDtoImpl _$$StudentDtoImplFromJson(Map<String, dynamic> json) =>
    _$StudentDtoImpl(
      id: json['id'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      matricule: json['matricule'] as String,
      tenantMatricule: json['tenantMatricule'] as String?,
      globalMatricule: json['globalMatricule'] as String?,
      classId: json['classId'] as String?,
      className: json['className'] as String?,
      schoolLevelId: json['schoolLevelId'] as String?,
      schoolLevelName: json['schoolLevelName'] as String?,
      photoUrl: json['photoUrl'] as String?,
      gender: json['gender'] as String?,
      dateOfBirth: json['dateOfBirth'] == null
          ? null
          : DateTime.parse(json['dateOfBirth'] as String),
      parentName: json['parentName'] as String?,
      parentPhone: json['parentPhone'] as String?,
      status: json['status'] as String?,
    );

Map<String, dynamic> _$$StudentDtoImplToJson(_$StudentDtoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'matricule': instance.matricule,
      'tenantMatricule': instance.tenantMatricule,
      'globalMatricule': instance.globalMatricule,
      'classId': instance.classId,
      'className': instance.className,
      'schoolLevelId': instance.schoolLevelId,
      'schoolLevelName': instance.schoolLevelName,
      'photoUrl': instance.photoUrl,
      'gender': instance.gender,
      'dateOfBirth': instance.dateOfBirth?.toIso8601String(),
      'parentName': instance.parentName,
      'parentPhone': instance.parentPhone,
      'status': instance.status,
    };

_$CreateStudentRequestImpl _$$CreateStudentRequestImplFromJson(
        Map<String, dynamic> json) =>
    _$CreateStudentRequestImpl(
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      matricule: json['matricule'] as String,
      classId: json['classId'] as String?,
      schoolLevelId: json['schoolLevelId'] as String?,
      gender: json['gender'] as String?,
      dateOfBirth: json['dateOfBirth'] == null
          ? null
          : DateTime.parse(json['dateOfBirth'] as String),
      parentName: json['parentName'] as String?,
      parentPhone: json['parentPhone'] as String?,
    );

Map<String, dynamic> _$$CreateStudentRequestImplToJson(
        _$CreateStudentRequestImpl instance) =>
    <String, dynamic>{
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'matricule': instance.matricule,
      'classId': instance.classId,
      'schoolLevelId': instance.schoolLevelId,
      'gender': instance.gender,
      'dateOfBirth': instance.dateOfBirth?.toIso8601String(),
      'parentName': instance.parentName,
      'parentPhone': instance.parentPhone,
    };

_$UpdateStudentRequestImpl _$$UpdateStudentRequestImplFromJson(
        Map<String, dynamic> json) =>
    _$UpdateStudentRequestImpl(
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      classId: json['classId'] as String?,
      schoolLevelId: json['schoolLevelId'] as String?,
      gender: json['gender'] as String?,
      dateOfBirth: json['dateOfBirth'] == null
          ? null
          : DateTime.parse(json['dateOfBirth'] as String),
      parentName: json['parentName'] as String?,
      parentPhone: json['parentPhone'] as String?,
      status: json['status'] as String?,
    );

Map<String, dynamic> _$$UpdateStudentRequestImplToJson(
        _$UpdateStudentRequestImpl instance) =>
    <String, dynamic>{
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'classId': instance.classId,
      'schoolLevelId': instance.schoolLevelId,
      'gender': instance.gender,
      'dateOfBirth': instance.dateOfBirth?.toIso8601String(),
      'parentName': instance.parentName,
      'parentPhone': instance.parentPhone,
      'status': instance.status,
    };

_$StudentListResponseImpl _$$StudentListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$StudentListResponseImpl(
      data: (json['data'] as List<dynamic>)
          .map((e) => StudentDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$StudentListResponseImplToJson(
        _$StudentListResponseImpl instance) =>
    <String, dynamic>{
      'data': instance.data,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };
