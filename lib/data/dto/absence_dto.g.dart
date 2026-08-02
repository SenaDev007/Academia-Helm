// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'absence_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AbsenceDto _$AbsenceDtoFromJson(Map<String, dynamic> json) => AbsenceDto(
      id: json['id'] as String,
      studentId: json['student_id'] as String,
      type: json['type'] as String,
      date: json['date'] as String,
      time: json['time'] as String?,
      subjectName: json['subject_name'] as String?,
      justification: json['justification'] as String?,
      isJustified: json['is_justified'] as bool?,
      reportedBy: json['reported_by'] as String?,
      createdAt: json['created_at'] as String?,
    );

Map<String, dynamic> _$AbsenceDtoToJson(AbsenceDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'student_id': instance.studentId,
      'type': instance.type,
      'date': instance.date,
      'time': instance.time,
      'subject_name': instance.subjectName,
      'justification': instance.justification,
      'is_justified': instance.isJustified,
      'reported_by': instance.reportedBy,
      'created_at': instance.createdAt,
    };
