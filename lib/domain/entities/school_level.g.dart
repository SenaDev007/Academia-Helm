// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'school_level.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SchoolLevelImpl _$$SchoolLevelImplFromJson(Map<String, dynamic> json) =>
    _$SchoolLevelImpl(
      id: json['id'] as String,
      code: json['code'] as String,
      name: json['name'] as String,
      label: json['label'] as String,
      order: (json['order'] as num).toInt(),
      isActive: json['isActive'] as bool?,
    );

Map<String, dynamic> _$$SchoolLevelImplToJson(_$SchoolLevelImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'code': instance.code,
      'name': instance.name,
      'label': instance.label,
      'order': instance.order,
      'isActive': instance.isActive,
    };
