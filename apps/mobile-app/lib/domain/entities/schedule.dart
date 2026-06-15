import 'package:freezed_annotation/freezed_annotation.dart';

part 'schedule.freezed.dart';
part 'schedule.g.dart';

/// Represents a weekly schedule for a student.
@freezed
class ScheduleEntry with _$ScheduleEntry {
  const factory ScheduleEntry({
    required String id,
    required String subjectName,
    required String teacherName,
    required String room,
    required int dayOfWeek, // 1=Monday, 5=Friday
    required TimeSlot timeSlot,
    @Default('COURS') String entryType, // 'COURS', 'TD', 'TP'
    String? subjectColor, // Hex color for the subject
  }) = _ScheduleEntry;

  const ScheduleEntry._();

  /// Day name in French.
  String get dayName {
    const days = [
      '',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi'
    ];
    return dayOfWeek >= 0 && dayOfWeek < days.length ? days[dayOfWeek] : '';
  }

  /// Short day name.
  String get shortDayName {
    const days = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return dayOfWeek >= 0 && dayOfWeek < days.length ? days[dayOfWeek] : '';
  }

  /// Time display string.
  String get timeDisplay => '${timeSlot.startDisplay} - ${timeSlot.endDisplay}';

  factory ScheduleEntry.fromJson(Map<String, dynamic> json) =>
      _$ScheduleEntryFromJson(json);
}

/// Time slot for a schedule entry.
@freezed
class TimeSlot with _$TimeSlot {
  const factory TimeSlot({
    required String startTime, // HH:mm format
    required String endTime, // HH:mm format
  }) = _TimeSlot;

  const TimeSlot._();

  String get startDisplay => startTime;
  String get endDisplay => endTime;

  factory TimeSlot.fromJson(Map<String, dynamic> json) =>
      _$TimeSlotFromJson(json);
}
