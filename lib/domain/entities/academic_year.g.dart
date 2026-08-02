// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'academic_year.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AcademicYearImpl _$$AcademicYearImplFromJson(Map<String, dynamic> json) =>
    _$AcademicYearImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: DateTime.parse(json['endDate'] as String),
      isCurrent: json['isCurrent'] as bool?,
      status: json['status'] as String?,
    );

Map<String, dynamic> _$$AcademicYearImplToJson(_$AcademicYearImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'startDate': instance.startDate.toIso8601String(),
      'endDate': instance.endDate.toIso8601String(),
      'isCurrent': instance.isCurrent,
      'status': instance.status,
    };
