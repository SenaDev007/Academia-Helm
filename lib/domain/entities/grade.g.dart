// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'grade.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$GradeImpl _$$GradeImplFromJson(Map<String, dynamic> json) => _$GradeImpl(
      id: json['id'] as String,
      studentId: json['studentId'] as String,
      subjectId: json['subjectId'] as String,
      subjectName: json['subjectName'] as String,
      score: (json['score'] as num).toDouble(),
      maxScore: (json['maxScore'] as num).toDouble(),
      coefficient: (json['coefficient'] as num?)?.toDouble() ?? 1.0,
      evaluationType: json['evaluationType'] as String?,
      period: json['period'] as String?,
      periodLabel: json['periodLabel'] as String?,
      comment: json['comment'] as String?,
      evaluatedAt: json['evaluatedAt'] == null
          ? null
          : DateTime.parse(json['evaluatedAt'] as String),
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$$GradeImplToJson(_$GradeImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'studentId': instance.studentId,
      'subjectId': instance.subjectId,
      'subjectName': instance.subjectName,
      'score': instance.score,
      'maxScore': instance.maxScore,
      'coefficient': instance.coefficient,
      'evaluationType': instance.evaluationType,
      'period': instance.period,
      'periodLabel': instance.periodLabel,
      'comment': instance.comment,
      'evaluatedAt': instance.evaluatedAt?.toIso8601String(),
      'createdAt': instance.createdAt?.toIso8601String(),
    };

_$SubjectAverageImpl _$$SubjectAverageImplFromJson(Map<String, dynamic> json) =>
    _$SubjectAverageImpl(
      subjectId: json['subjectId'] as String,
      subjectName: json['subjectName'] as String,
      average: (json['average'] as num).toDouble(),
      maxAverage: (json['maxAverage'] as num).toDouble(),
      gradeCount: (json['gradeCount'] as num?)?.toInt() ?? 0,
      classAverage: (json['classAverage'] as num?)?.toDouble(),
      rank: (json['rank'] as num?)?.toDouble(),
      classSize: (json['classSize'] as num?)?.toInt(),
    );

Map<String, dynamic> _$$SubjectAverageImplToJson(
        _$SubjectAverageImpl instance) =>
    <String, dynamic>{
      'subjectId': instance.subjectId,
      'subjectName': instance.subjectName,
      'average': instance.average,
      'maxAverage': instance.maxAverage,
      'gradeCount': instance.gradeCount,
      'classAverage': instance.classAverage,
      'rank': instance.rank,
      'classSize': instance.classSize,
    };

_$PeriodReportImpl _$$PeriodReportImplFromJson(Map<String, dynamic> json) =>
    _$PeriodReportImpl(
      id: json['id'] as String,
      studentId: json['studentId'] as String,
      period: json['period'] as String,
      periodLabel: json['periodLabel'] as String,
      generalAverage: (json['generalAverage'] as num).toDouble(),
      maxAverage: (json['maxAverage'] as num).toDouble(),
      classAverage: (json['classAverage'] as num?)?.toDouble(),
      rank: (json['rank'] as num?)?.toInt(),
      classSize: (json['classSize'] as num?)?.toInt(),
      subjectAverages: (json['subjectAverages'] as List<dynamic>)
          .map((e) => SubjectAverage.fromJson(e as Map<String, dynamic>))
          .toList(),
      appreciation: json['appreciation'] as String?,
      generatedAt: json['generatedAt'] == null
          ? null
          : DateTime.parse(json['generatedAt'] as String),
    );

Map<String, dynamic> _$$PeriodReportImplToJson(_$PeriodReportImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'studentId': instance.studentId,
      'period': instance.period,
      'periodLabel': instance.periodLabel,
      'generalAverage': instance.generalAverage,
      'maxAverage': instance.maxAverage,
      'classAverage': instance.classAverage,
      'rank': instance.rank,
      'classSize': instance.classSize,
      'subjectAverages': instance.subjectAverages,
      'appreciation': instance.appreciation,
      'generatedAt': instance.generatedAt?.toIso8601String(),
    };
