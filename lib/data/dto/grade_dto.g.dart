// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'grade_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GradeDto _$GradeDtoFromJson(Map<String, dynamic> json) => GradeDto(
      id: json['id'] as String,
      studentId: json['student_id'] as String,
      subjectId: json['subject_id'] as String,
      subjectName: json['subject_name'] as String,
      score: (json['score'] as num).toDouble(),
      maxScore: (json['max_score'] as num).toDouble(),
      coefficient: (json['coefficient'] as num?)?.toDouble(),
      evaluationType: json['evaluation_type'] as String?,
      period: json['period'] as String?,
      periodLabel: json['period_label'] as String?,
      comment: json['comment'] as String?,
      evaluatedAt: json['evaluated_at'] as String?,
      createdAt: json['created_at'] as String?,
    );

Map<String, dynamic> _$GradeDtoToJson(GradeDto instance) => <String, dynamic>{
      'id': instance.id,
      'student_id': instance.studentId,
      'subject_id': instance.subjectId,
      'subject_name': instance.subjectName,
      'score': instance.score,
      'max_score': instance.maxScore,
      'coefficient': instance.coefficient,
      'evaluation_type': instance.evaluationType,
      'period': instance.period,
      'period_label': instance.periodLabel,
      'comment': instance.comment,
      'evaluated_at': instance.evaluatedAt,
      'created_at': instance.createdAt,
    };

SubjectAverageDto _$SubjectAverageDtoFromJson(Map<String, dynamic> json) =>
    SubjectAverageDto(
      subjectId: json['subject_id'] as String,
      subjectName: json['subject_name'] as String,
      average: (json['average'] as num).toDouble(),
      maxAverage: (json['max_average'] as num).toDouble(),
      gradeCount: (json['grade_count'] as num?)?.toInt(),
      classAverage: (json['class_average'] as num?)?.toDouble(),
      rank: (json['rank'] as num?)?.toDouble(),
      classSize: (json['class_size'] as num?)?.toInt(),
    );

Map<String, dynamic> _$SubjectAverageDtoToJson(SubjectAverageDto instance) =>
    <String, dynamic>{
      'subject_id': instance.subjectId,
      'subject_name': instance.subjectName,
      'average': instance.average,
      'max_average': instance.maxAverage,
      'grade_count': instance.gradeCount,
      'class_average': instance.classAverage,
      'rank': instance.rank,
      'class_size': instance.classSize,
    };

PeriodReportDto _$PeriodReportDtoFromJson(Map<String, dynamic> json) =>
    PeriodReportDto(
      id: json['id'] as String,
      studentId: json['student_id'] as String,
      period: json['period'] as String,
      periodLabel: json['period_label'] as String,
      generalAverage: (json['general_average'] as num).toDouble(),
      maxAverage: (json['max_average'] as num).toDouble(),
      classAverage: (json['class_average'] as num?)?.toDouble(),
      rank: (json['rank'] as num?)?.toInt(),
      classSize: (json['class_size'] as num?)?.toInt(),
      subjectAverages: (json['subject_averages'] as List<dynamic>)
          .map((e) => SubjectAverageDto.fromJson(e as Map<String, dynamic>))
          .toList(),
      appreciation: json['appreciation'] as String?,
      generatedAt: json['generated_at'] as String?,
    );

Map<String, dynamic> _$PeriodReportDtoToJson(PeriodReportDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'student_id': instance.studentId,
      'period': instance.period,
      'period_label': instance.periodLabel,
      'general_average': instance.generalAverage,
      'max_average': instance.maxAverage,
      'class_average': instance.classAverage,
      'rank': instance.rank,
      'class_size': instance.classSize,
      'subject_averages': instance.subjectAverages,
      'appreciation': instance.appreciation,
      'generated_at': instance.generatedAt,
    };
