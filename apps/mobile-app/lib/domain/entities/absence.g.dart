// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'absence.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AbsenceImpl _$$AbsenceImplFromJson(Map<String, dynamic> json) =>
    _$AbsenceImpl(
      id: json['id'] as String,
      studentId: json['studentId'] as String,
      type: $enumDecode(_$AbsenceTypeEnumMap, json['type']),
      date: DateTime.parse(json['date'] as String),
      time: json['time'] as String?,
      subjectName: json['subjectName'] as String?,
      justification: json['justification'] as String?,
      isJustified: json['isJustified'] as bool? ?? false,
      reportedBy: json['reportedBy'] as String?,
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$AbsenceImplToJson(_$AbsenceImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'studentId': instance.studentId,
      'type': _$AbsenceTypeEnumMap[instance.type]!,
      'date': instance.date.toIso8601String(),
      'time': instance.time,
      'subjectName': instance.subjectName,
      'justification': instance.justification,
      'isJustified': instance.isJustified,
      'reportedBy': instance.reportedBy,
      'createdAt': instance.createdAt?.toIso8601String(),
    };

const _$AbsenceTypeEnumMap = {
  AbsenceType.absence: 'ABSENCE',
  AbsenceType.tardiness: 'TARDINESS',
};
