// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'student.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$StudentImpl _$$StudentImplFromJson(Map<String, dynamic> json) =>
    _$StudentImpl(
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

Map<String, dynamic> _$$StudentImplToJson(_$StudentImpl instance) =>
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
