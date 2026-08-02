// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'schedule_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ScheduleEntryDto _$ScheduleEntryDtoFromJson(Map<String, dynamic> json) =>
    ScheduleEntryDto(
      id: json['id'] as String,
      subjectName: json['subject_name'] as String,
      teacherName: json['teacher_name'] as String,
      room: json['room'] as String,
      dayOfWeek: (json['day_of_week'] as num).toInt(),
      timeSlot: TimeSlotDto.fromJson(json['time_slot'] as Map<String, dynamic>),
      entryType: json['entry_type'] as String?,
      subjectColor: json['subject_color'] as String?,
    );

Map<String, dynamic> _$ScheduleEntryDtoToJson(ScheduleEntryDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'subject_name': instance.subjectName,
      'teacher_name': instance.teacherName,
      'room': instance.room,
      'day_of_week': instance.dayOfWeek,
      'time_slot': instance.timeSlot,
      'entry_type': instance.entryType,
      'subject_color': instance.subjectColor,
    };

TimeSlotDto _$TimeSlotDtoFromJson(Map<String, dynamic> json) => TimeSlotDto(
      startTime: json['start_time'] as String,
      endTime: json['end_time'] as String,
    );

Map<String, dynamic> _$TimeSlotDtoToJson(TimeSlotDto instance) =>
    <String, dynamic>{
      'start_time': instance.startTime,
      'end_time': instance.endTime,
    };
