import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/schedule.dart';

part 'schedule_dto.g.dart';

/// DTO for [ScheduleEntry] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class ScheduleEntryDto {
  final String id;
  final String subjectName;
  final String teacherName;
  final String room;
  final int dayOfWeek;
  final TimeSlotDto timeSlot;
  final String? entryType;
  final String? subjectColor;

  ScheduleEntryDto({
    required this.id,
    required this.subjectName,
    required this.teacherName,
    required this.room,
    required this.dayOfWeek,
    required this.timeSlot,
    this.entryType,
    this.subjectColor,
  });

  factory ScheduleEntryDto.fromJson(Map<String, dynamic> json) =>
      _$ScheduleEntryDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ScheduleEntryDtoToJson(this);

  ScheduleEntry toDomain() => ScheduleEntry(
        id: id,
        subjectName: subjectName,
        teacherName: teacherName,
        room: room,
        dayOfWeek: dayOfWeek,
        timeSlot: timeSlot.toDomain(),
        entryType: entryType ?? 'COURS',
        subjectColor: subjectColor,
      );
}

/// DTO for [TimeSlot] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class TimeSlotDto {
  final String startTime;
  final String endTime;

  TimeSlotDto({
    required this.startTime,
    required this.endTime,
  });

  factory TimeSlotDto.fromJson(Map<String, dynamic> json) =>
      _$TimeSlotDtoFromJson(json);

  Map<String, dynamic> toJson() => _$TimeSlotDtoToJson(this);

  TimeSlot toDomain() => TimeSlot(
        startTime: startTime,
        endTime: endTime,
      );
}
