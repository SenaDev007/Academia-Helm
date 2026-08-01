// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'schedule.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ScheduleEntryImpl _$$ScheduleEntryImplFromJson(Map<String, dynamic> json) =>
    _$ScheduleEntryImpl(
      id: json['id'] as String,
      subjectName: json['subjectName'] as String,
      teacherName: json['teacherName'] as String,
      room: json['room'] as String,
      dayOfWeek: (json['dayOfWeek'] as num).toInt(),
      timeSlot: TimeSlot.fromJson(json['timeSlot'] as Map<String, dynamic>),
      entryType: json['entryType'] as String? ?? 'COURS',
      subjectColor: json['subjectColor'] as String?,
    );

Map<String, dynamic> _$$ScheduleEntryImplToJson(_$ScheduleEntryImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'subjectName': instance.subjectName,
      'teacherName': instance.teacherName,
      'room': instance.room,
      'dayOfWeek': instance.dayOfWeek,
      'timeSlot': instance.timeSlot,
      'entryType': instance.entryType,
      'subjectColor': instance.subjectColor,
    };

_$TimeSlotImpl _$$TimeSlotImplFromJson(Map<String, dynamic> json) =>
    _$TimeSlotImpl(
      startTime: json['startTime'] as String,
      endTime: json['endTime'] as String,
    );

Map<String, dynamic> _$$TimeSlotImplToJson(_$TimeSlotImpl instance) =>
    <String, dynamic>{
      'startTime': instance.startTime,
      'endTime': instance.endTime,
    };
