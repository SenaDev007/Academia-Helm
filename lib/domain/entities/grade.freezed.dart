// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'grade.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Grade _$GradeFromJson(Map<String, dynamic> json) {
  return _Grade.fromJson(json);
}

/// @nodoc
mixin _$Grade {
  String get id => throw _privateConstructorUsedError;
  String get studentId => throw _privateConstructorUsedError;
  String get subjectId => throw _privateConstructorUsedError;
  String get subjectName => throw _privateConstructorUsedError;
  double get score => throw _privateConstructorUsedError;
  double get maxScore => throw _privateConstructorUsedError;
  double get coefficient => throw _privateConstructorUsedError;
  String? get evaluationType =>
      throw _privateConstructorUsedError; // 'DEVOIR', 'EXAMEN', 'COMPOSITION', 'INTERROGATION'
  String? get period =>
      throw _privateConstructorUsedError; // 'TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3', 'SEMESTRE_1', 'SEMESTRE_2'
  String? get periodLabel =>
      throw _privateConstructorUsedError; // Display label like "1er Trimestre"
  String? get comment => throw _privateConstructorUsedError;
  DateTime? get evaluatedAt => throw _privateConstructorUsedError;
  DateTime? get createdAt => throw _privateConstructorUsedError;

  /// Serializes this Grade to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Grade
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GradeCopyWith<Grade> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GradeCopyWith<$Res> {
  factory $GradeCopyWith(Grade value, $Res Function(Grade) then) =
      _$GradeCopyWithImpl<$Res, Grade>;
  @useResult
  $Res call(
      {String id,
      String studentId,
      String subjectId,
      String subjectName,
      double score,
      double maxScore,
      double coefficient,
      String? evaluationType,
      String? period,
      String? periodLabel,
      String? comment,
      DateTime? evaluatedAt,
      DateTime? createdAt});
}

/// @nodoc
class _$GradeCopyWithImpl<$Res, $Val extends Grade>
    implements $GradeCopyWith<$Res> {
  _$GradeCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Grade
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? studentId = null,
    Object? subjectId = null,
    Object? subjectName = null,
    Object? score = null,
    Object? maxScore = null,
    Object? coefficient = null,
    Object? evaluationType = freezed,
    Object? period = freezed,
    Object? periodLabel = freezed,
    Object? comment = freezed,
    Object? evaluatedAt = freezed,
    Object? createdAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      studentId: null == studentId
          ? _value.studentId
          : studentId // ignore: cast_nullable_to_non_nullable
              as String,
      subjectId: null == subjectId
          ? _value.subjectId
          : subjectId // ignore: cast_nullable_to_non_nullable
              as String,
      subjectName: null == subjectName
          ? _value.subjectName
          : subjectName // ignore: cast_nullable_to_non_nullable
              as String,
      score: null == score
          ? _value.score
          : score // ignore: cast_nullable_to_non_nullable
              as double,
      maxScore: null == maxScore
          ? _value.maxScore
          : maxScore // ignore: cast_nullable_to_non_nullable
              as double,
      coefficient: null == coefficient
          ? _value.coefficient
          : coefficient // ignore: cast_nullable_to_non_nullable
              as double,
      evaluationType: freezed == evaluationType
          ? _value.evaluationType
          : evaluationType // ignore: cast_nullable_to_non_nullable
              as String?,
      period: freezed == period
          ? _value.period
          : period // ignore: cast_nullable_to_non_nullable
              as String?,
      periodLabel: freezed == periodLabel
          ? _value.periodLabel
          : periodLabel // ignore: cast_nullable_to_non_nullable
              as String?,
      comment: freezed == comment
          ? _value.comment
          : comment // ignore: cast_nullable_to_non_nullable
              as String?,
      evaluatedAt: freezed == evaluatedAt
          ? _value.evaluatedAt
          : evaluatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$GradeImplCopyWith<$Res> implements $GradeCopyWith<$Res> {
  factory _$$GradeImplCopyWith(
          _$GradeImpl value, $Res Function(_$GradeImpl) then) =
      __$$GradeImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String studentId,
      String subjectId,
      String subjectName,
      double score,
      double maxScore,
      double coefficient,
      String? evaluationType,
      String? period,
      String? periodLabel,
      String? comment,
      DateTime? evaluatedAt,
      DateTime? createdAt});
}

/// @nodoc
class __$$GradeImplCopyWithImpl<$Res>
    extends _$GradeCopyWithImpl<$Res, _$GradeImpl>
    implements _$$GradeImplCopyWith<$Res> {
  __$$GradeImplCopyWithImpl(
      _$GradeImpl _value, $Res Function(_$GradeImpl) _then)
      : super(_value, _then);

  /// Create a copy of Grade
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? studentId = null,
    Object? subjectId = null,
    Object? subjectName = null,
    Object? score = null,
    Object? maxScore = null,
    Object? coefficient = null,
    Object? evaluationType = freezed,
    Object? period = freezed,
    Object? periodLabel = freezed,
    Object? comment = freezed,
    Object? evaluatedAt = freezed,
    Object? createdAt = freezed,
  }) {
    return _then(_$GradeImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      studentId: null == studentId
          ? _value.studentId
          : studentId // ignore: cast_nullable_to_non_nullable
              as String,
      subjectId: null == subjectId
          ? _value.subjectId
          : subjectId // ignore: cast_nullable_to_non_nullable
              as String,
      subjectName: null == subjectName
          ? _value.subjectName
          : subjectName // ignore: cast_nullable_to_non_nullable
              as String,
      score: null == score
          ? _value.score
          : score // ignore: cast_nullable_to_non_nullable
              as double,
      maxScore: null == maxScore
          ? _value.maxScore
          : maxScore // ignore: cast_nullable_to_non_nullable
              as double,
      coefficient: null == coefficient
          ? _value.coefficient
          : coefficient // ignore: cast_nullable_to_non_nullable
              as double,
      evaluationType: freezed == evaluationType
          ? _value.evaluationType
          : evaluationType // ignore: cast_nullable_to_non_nullable
              as String?,
      period: freezed == period
          ? _value.period
          : period // ignore: cast_nullable_to_non_nullable
              as String?,
      periodLabel: freezed == periodLabel
          ? _value.periodLabel
          : periodLabel // ignore: cast_nullable_to_non_nullable
              as String?,
      comment: freezed == comment
          ? _value.comment
          : comment // ignore: cast_nullable_to_non_nullable
              as String?,
      evaluatedAt: freezed == evaluatedAt
          ? _value.evaluatedAt
          : evaluatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$GradeImpl extends _Grade {
  const _$GradeImpl(
      {required this.id,
      required this.studentId,
      required this.subjectId,
      required this.subjectName,
      required this.score,
      required this.maxScore,
      this.coefficient = 1.0,
      this.evaluationType,
      this.period,
      this.periodLabel,
      this.comment,
      this.evaluatedAt,
      this.createdAt})
      : super._();

  factory _$GradeImpl.fromJson(Map<String, dynamic> json) =>
      _$$GradeImplFromJson(json);

  @override
  final String id;
  @override
  final String studentId;
  @override
  final String subjectId;
  @override
  final String subjectName;
  @override
  final double score;
  @override
  final double maxScore;
  @override
  @JsonKey()
  final double coefficient;
  @override
  final String? evaluationType;
// 'DEVOIR', 'EXAMEN', 'COMPOSITION', 'INTERROGATION'
  @override
  final String? period;
// 'TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3', 'SEMESTRE_1', 'SEMESTRE_2'
  @override
  final String? periodLabel;
// Display label like "1er Trimestre"
  @override
  final String? comment;
  @override
  final DateTime? evaluatedAt;
  @override
  final DateTime? createdAt;

  @override
  String toString() {
    return 'Grade(id: $id, studentId: $studentId, subjectId: $subjectId, subjectName: $subjectName, score: $score, maxScore: $maxScore, coefficient: $coefficient, evaluationType: $evaluationType, period: $period, periodLabel: $periodLabel, comment: $comment, evaluatedAt: $evaluatedAt, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GradeImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.studentId, studentId) ||
                other.studentId == studentId) &&
            (identical(other.subjectId, subjectId) ||
                other.subjectId == subjectId) &&
            (identical(other.subjectName, subjectName) ||
                other.subjectName == subjectName) &&
            (identical(other.score, score) || other.score == score) &&
            (identical(other.maxScore, maxScore) ||
                other.maxScore == maxScore) &&
            (identical(other.coefficient, coefficient) ||
                other.coefficient == coefficient) &&
            (identical(other.evaluationType, evaluationType) ||
                other.evaluationType == evaluationType) &&
            (identical(other.period, period) || other.period == period) &&
            (identical(other.periodLabel, periodLabel) ||
                other.periodLabel == periodLabel) &&
            (identical(other.comment, comment) || other.comment == comment) &&
            (identical(other.evaluatedAt, evaluatedAt) ||
                other.evaluatedAt == evaluatedAt) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      studentId,
      subjectId,
      subjectName,
      score,
      maxScore,
      coefficient,
      evaluationType,
      period,
      periodLabel,
      comment,
      evaluatedAt,
      createdAt);

  /// Create a copy of Grade
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GradeImplCopyWith<_$GradeImpl> get copyWith =>
      __$$GradeImplCopyWithImpl<_$GradeImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GradeImplToJson(
      this,
    );
  }
}

abstract class _Grade extends Grade {
  const factory _Grade(
      {required final String id,
      required final String studentId,
      required final String subjectId,
      required final String subjectName,
      required final double score,
      required final double maxScore,
      final double coefficient,
      final String? evaluationType,
      final String? period,
      final String? periodLabel,
      final String? comment,
      final DateTime? evaluatedAt,
      final DateTime? createdAt}) = _$GradeImpl;
  const _Grade._() : super._();

  factory _Grade.fromJson(Map<String, dynamic> json) = _$GradeImpl.fromJson;

  @override
  String get id;
  @override
  String get studentId;
  @override
  String get subjectId;
  @override
  String get subjectName;
  @override
  double get score;
  @override
  double get maxScore;
  @override
  double get coefficient;
  @override
  String?
      get evaluationType; // 'DEVOIR', 'EXAMEN', 'COMPOSITION', 'INTERROGATION'
  @override
  String?
      get period; // 'TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3', 'SEMESTRE_1', 'SEMESTRE_2'
  @override
  String? get periodLabel; // Display label like "1er Trimestre"
  @override
  String? get comment;
  @override
  DateTime? get evaluatedAt;
  @override
  DateTime? get createdAt;

  /// Create a copy of Grade
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GradeImplCopyWith<_$GradeImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SubjectAverage _$SubjectAverageFromJson(Map<String, dynamic> json) {
  return _SubjectAverage.fromJson(json);
}

/// @nodoc
mixin _$SubjectAverage {
  String get subjectId => throw _privateConstructorUsedError;
  String get subjectName => throw _privateConstructorUsedError;
  double get average => throw _privateConstructorUsedError;
  double get maxAverage => throw _privateConstructorUsedError;
  int get gradeCount => throw _privateConstructorUsedError;
  double? get classAverage => throw _privateConstructorUsedError;
  double? get rank => throw _privateConstructorUsedError;
  int? get classSize => throw _privateConstructorUsedError;

  /// Serializes this SubjectAverage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SubjectAverage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SubjectAverageCopyWith<SubjectAverage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SubjectAverageCopyWith<$Res> {
  factory $SubjectAverageCopyWith(
          SubjectAverage value, $Res Function(SubjectAverage) then) =
      _$SubjectAverageCopyWithImpl<$Res, SubjectAverage>;
  @useResult
  $Res call(
      {String subjectId,
      String subjectName,
      double average,
      double maxAverage,
      int gradeCount,
      double? classAverage,
      double? rank,
      int? classSize});
}

/// @nodoc
class _$SubjectAverageCopyWithImpl<$Res, $Val extends SubjectAverage>
    implements $SubjectAverageCopyWith<$Res> {
  _$SubjectAverageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SubjectAverage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? subjectId = null,
    Object? subjectName = null,
    Object? average = null,
    Object? maxAverage = null,
    Object? gradeCount = null,
    Object? classAverage = freezed,
    Object? rank = freezed,
    Object? classSize = freezed,
  }) {
    return _then(_value.copyWith(
      subjectId: null == subjectId
          ? _value.subjectId
          : subjectId // ignore: cast_nullable_to_non_nullable
              as String,
      subjectName: null == subjectName
          ? _value.subjectName
          : subjectName // ignore: cast_nullable_to_non_nullable
              as String,
      average: null == average
          ? _value.average
          : average // ignore: cast_nullable_to_non_nullable
              as double,
      maxAverage: null == maxAverage
          ? _value.maxAverage
          : maxAverage // ignore: cast_nullable_to_non_nullable
              as double,
      gradeCount: null == gradeCount
          ? _value.gradeCount
          : gradeCount // ignore: cast_nullable_to_non_nullable
              as int,
      classAverage: freezed == classAverage
          ? _value.classAverage
          : classAverage // ignore: cast_nullable_to_non_nullable
              as double?,
      rank: freezed == rank
          ? _value.rank
          : rank // ignore: cast_nullable_to_non_nullable
              as double?,
      classSize: freezed == classSize
          ? _value.classSize
          : classSize // ignore: cast_nullable_to_non_nullable
              as int?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SubjectAverageImplCopyWith<$Res>
    implements $SubjectAverageCopyWith<$Res> {
  factory _$$SubjectAverageImplCopyWith(_$SubjectAverageImpl value,
          $Res Function(_$SubjectAverageImpl) then) =
      __$$SubjectAverageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String subjectId,
      String subjectName,
      double average,
      double maxAverage,
      int gradeCount,
      double? classAverage,
      double? rank,
      int? classSize});
}

/// @nodoc
class __$$SubjectAverageImplCopyWithImpl<$Res>
    extends _$SubjectAverageCopyWithImpl<$Res, _$SubjectAverageImpl>
    implements _$$SubjectAverageImplCopyWith<$Res> {
  __$$SubjectAverageImplCopyWithImpl(
      _$SubjectAverageImpl _value, $Res Function(_$SubjectAverageImpl) _then)
      : super(_value, _then);

  /// Create a copy of SubjectAverage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? subjectId = null,
    Object? subjectName = null,
    Object? average = null,
    Object? maxAverage = null,
    Object? gradeCount = null,
    Object? classAverage = freezed,
    Object? rank = freezed,
    Object? classSize = freezed,
  }) {
    return _then(_$SubjectAverageImpl(
      subjectId: null == subjectId
          ? _value.subjectId
          : subjectId // ignore: cast_nullable_to_non_nullable
              as String,
      subjectName: null == subjectName
          ? _value.subjectName
          : subjectName // ignore: cast_nullable_to_non_nullable
              as String,
      average: null == average
          ? _value.average
          : average // ignore: cast_nullable_to_non_nullable
              as double,
      maxAverage: null == maxAverage
          ? _value.maxAverage
          : maxAverage // ignore: cast_nullable_to_non_nullable
              as double,
      gradeCount: null == gradeCount
          ? _value.gradeCount
          : gradeCount // ignore: cast_nullable_to_non_nullable
              as int,
      classAverage: freezed == classAverage
          ? _value.classAverage
          : classAverage // ignore: cast_nullable_to_non_nullable
              as double?,
      rank: freezed == rank
          ? _value.rank
          : rank // ignore: cast_nullable_to_non_nullable
              as double?,
      classSize: freezed == classSize
          ? _value.classSize
          : classSize // ignore: cast_nullable_to_non_nullable
              as int?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SubjectAverageImpl extends _SubjectAverage {
  const _$SubjectAverageImpl(
      {required this.subjectId,
      required this.subjectName,
      required this.average,
      required this.maxAverage,
      this.gradeCount = 0,
      this.classAverage,
      this.rank,
      this.classSize})
      : super._();

  factory _$SubjectAverageImpl.fromJson(Map<String, dynamic> json) =>
      _$$SubjectAverageImplFromJson(json);

  @override
  final String subjectId;
  @override
  final String subjectName;
  @override
  final double average;
  @override
  final double maxAverage;
  @override
  @JsonKey()
  final int gradeCount;
  @override
  final double? classAverage;
  @override
  final double? rank;
  @override
  final int? classSize;

  @override
  String toString() {
    return 'SubjectAverage(subjectId: $subjectId, subjectName: $subjectName, average: $average, maxAverage: $maxAverage, gradeCount: $gradeCount, classAverage: $classAverage, rank: $rank, classSize: $classSize)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SubjectAverageImpl &&
            (identical(other.subjectId, subjectId) ||
                other.subjectId == subjectId) &&
            (identical(other.subjectName, subjectName) ||
                other.subjectName == subjectName) &&
            (identical(other.average, average) || other.average == average) &&
            (identical(other.maxAverage, maxAverage) ||
                other.maxAverage == maxAverage) &&
            (identical(other.gradeCount, gradeCount) ||
                other.gradeCount == gradeCount) &&
            (identical(other.classAverage, classAverage) ||
                other.classAverage == classAverage) &&
            (identical(other.rank, rank) || other.rank == rank) &&
            (identical(other.classSize, classSize) ||
                other.classSize == classSize));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, subjectId, subjectName, average,
      maxAverage, gradeCount, classAverage, rank, classSize);

  /// Create a copy of SubjectAverage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SubjectAverageImplCopyWith<_$SubjectAverageImpl> get copyWith =>
      __$$SubjectAverageImplCopyWithImpl<_$SubjectAverageImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SubjectAverageImplToJson(
      this,
    );
  }
}

abstract class _SubjectAverage extends SubjectAverage {
  const factory _SubjectAverage(
      {required final String subjectId,
      required final String subjectName,
      required final double average,
      required final double maxAverage,
      final int gradeCount,
      final double? classAverage,
      final double? rank,
      final int? classSize}) = _$SubjectAverageImpl;
  const _SubjectAverage._() : super._();

  factory _SubjectAverage.fromJson(Map<String, dynamic> json) =
      _$SubjectAverageImpl.fromJson;

  @override
  String get subjectId;
  @override
  String get subjectName;
  @override
  double get average;
  @override
  double get maxAverage;
  @override
  int get gradeCount;
  @override
  double? get classAverage;
  @override
  double? get rank;
  @override
  int? get classSize;

  /// Create a copy of SubjectAverage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SubjectAverageImplCopyWith<_$SubjectAverageImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PeriodReport _$PeriodReportFromJson(Map<String, dynamic> json) {
  return _PeriodReport.fromJson(json);
}

/// @nodoc
mixin _$PeriodReport {
  String get id => throw _privateConstructorUsedError;
  String get studentId => throw _privateConstructorUsedError;
  String get period => throw _privateConstructorUsedError;
  String get periodLabel => throw _privateConstructorUsedError;
  double get generalAverage => throw _privateConstructorUsedError;
  double get maxAverage => throw _privateConstructorUsedError;
  double? get classAverage => throw _privateConstructorUsedError;
  int? get rank => throw _privateConstructorUsedError;
  int? get classSize => throw _privateConstructorUsedError;
  List<SubjectAverage> get subjectAverages =>
      throw _privateConstructorUsedError;
  String? get appreciation => throw _privateConstructorUsedError;
  DateTime? get generatedAt => throw _privateConstructorUsedError;

  /// Serializes this PeriodReport to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PeriodReport
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PeriodReportCopyWith<PeriodReport> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PeriodReportCopyWith<$Res> {
  factory $PeriodReportCopyWith(
          PeriodReport value, $Res Function(PeriodReport) then) =
      _$PeriodReportCopyWithImpl<$Res, PeriodReport>;
  @useResult
  $Res call(
      {String id,
      String studentId,
      String period,
      String periodLabel,
      double generalAverage,
      double maxAverage,
      double? classAverage,
      int? rank,
      int? classSize,
      List<SubjectAverage> subjectAverages,
      String? appreciation,
      DateTime? generatedAt});
}

/// @nodoc
class _$PeriodReportCopyWithImpl<$Res, $Val extends PeriodReport>
    implements $PeriodReportCopyWith<$Res> {
  _$PeriodReportCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PeriodReport
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? studentId = null,
    Object? period = null,
    Object? periodLabel = null,
    Object? generalAverage = null,
    Object? maxAverage = null,
    Object? classAverage = freezed,
    Object? rank = freezed,
    Object? classSize = freezed,
    Object? subjectAverages = null,
    Object? appreciation = freezed,
    Object? generatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      studentId: null == studentId
          ? _value.studentId
          : studentId // ignore: cast_nullable_to_non_nullable
              as String,
      period: null == period
          ? _value.period
          : period // ignore: cast_nullable_to_non_nullable
              as String,
      periodLabel: null == periodLabel
          ? _value.periodLabel
          : periodLabel // ignore: cast_nullable_to_non_nullable
              as String,
      generalAverage: null == generalAverage
          ? _value.generalAverage
          : generalAverage // ignore: cast_nullable_to_non_nullable
              as double,
      maxAverage: null == maxAverage
          ? _value.maxAverage
          : maxAverage // ignore: cast_nullable_to_non_nullable
              as double,
      classAverage: freezed == classAverage
          ? _value.classAverage
          : classAverage // ignore: cast_nullable_to_non_nullable
              as double?,
      rank: freezed == rank
          ? _value.rank
          : rank // ignore: cast_nullable_to_non_nullable
              as int?,
      classSize: freezed == classSize
          ? _value.classSize
          : classSize // ignore: cast_nullable_to_non_nullable
              as int?,
      subjectAverages: null == subjectAverages
          ? _value.subjectAverages
          : subjectAverages // ignore: cast_nullable_to_non_nullable
              as List<SubjectAverage>,
      appreciation: freezed == appreciation
          ? _value.appreciation
          : appreciation // ignore: cast_nullable_to_non_nullable
              as String?,
      generatedAt: freezed == generatedAt
          ? _value.generatedAt
          : generatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PeriodReportImplCopyWith<$Res>
    implements $PeriodReportCopyWith<$Res> {
  factory _$$PeriodReportImplCopyWith(
          _$PeriodReportImpl value, $Res Function(_$PeriodReportImpl) then) =
      __$$PeriodReportImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String studentId,
      String period,
      String periodLabel,
      double generalAverage,
      double maxAverage,
      double? classAverage,
      int? rank,
      int? classSize,
      List<SubjectAverage> subjectAverages,
      String? appreciation,
      DateTime? generatedAt});
}

/// @nodoc
class __$$PeriodReportImplCopyWithImpl<$Res>
    extends _$PeriodReportCopyWithImpl<$Res, _$PeriodReportImpl>
    implements _$$PeriodReportImplCopyWith<$Res> {
  __$$PeriodReportImplCopyWithImpl(
      _$PeriodReportImpl _value, $Res Function(_$PeriodReportImpl) _then)
      : super(_value, _then);

  /// Create a copy of PeriodReport
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? studentId = null,
    Object? period = null,
    Object? periodLabel = null,
    Object? generalAverage = null,
    Object? maxAverage = null,
    Object? classAverage = freezed,
    Object? rank = freezed,
    Object? classSize = freezed,
    Object? subjectAverages = null,
    Object? appreciation = freezed,
    Object? generatedAt = freezed,
  }) {
    return _then(_$PeriodReportImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      studentId: null == studentId
          ? _value.studentId
          : studentId // ignore: cast_nullable_to_non_nullable
              as String,
      period: null == period
          ? _value.period
          : period // ignore: cast_nullable_to_non_nullable
              as String,
      periodLabel: null == periodLabel
          ? _value.periodLabel
          : periodLabel // ignore: cast_nullable_to_non_nullable
              as String,
      generalAverage: null == generalAverage
          ? _value.generalAverage
          : generalAverage // ignore: cast_nullable_to_non_nullable
              as double,
      maxAverage: null == maxAverage
          ? _value.maxAverage
          : maxAverage // ignore: cast_nullable_to_non_nullable
              as double,
      classAverage: freezed == classAverage
          ? _value.classAverage
          : classAverage // ignore: cast_nullable_to_non_nullable
              as double?,
      rank: freezed == rank
          ? _value.rank
          : rank // ignore: cast_nullable_to_non_nullable
              as int?,
      classSize: freezed == classSize
          ? _value.classSize
          : classSize // ignore: cast_nullable_to_non_nullable
              as int?,
      subjectAverages: null == subjectAverages
          ? _value._subjectAverages
          : subjectAverages // ignore: cast_nullable_to_non_nullable
              as List<SubjectAverage>,
      appreciation: freezed == appreciation
          ? _value.appreciation
          : appreciation // ignore: cast_nullable_to_non_nullable
              as String?,
      generatedAt: freezed == generatedAt
          ? _value.generatedAt
          : generatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PeriodReportImpl extends _PeriodReport {
  const _$PeriodReportImpl(
      {required this.id,
      required this.studentId,
      required this.period,
      required this.periodLabel,
      required this.generalAverage,
      required this.maxAverage,
      this.classAverage,
      this.rank,
      this.classSize,
      required final List<SubjectAverage> subjectAverages,
      this.appreciation,
      this.generatedAt})
      : _subjectAverages = subjectAverages,
        super._();

  factory _$PeriodReportImpl.fromJson(Map<String, dynamic> json) =>
      _$$PeriodReportImplFromJson(json);

  @override
  final String id;
  @override
  final String studentId;
  @override
  final String period;
  @override
  final String periodLabel;
  @override
  final double generalAverage;
  @override
  final double maxAverage;
  @override
  final double? classAverage;
  @override
  final int? rank;
  @override
  final int? classSize;
  final List<SubjectAverage> _subjectAverages;
  @override
  List<SubjectAverage> get subjectAverages {
    if (_subjectAverages is EqualUnmodifiableListView) return _subjectAverages;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_subjectAverages);
  }

  @override
  final String? appreciation;
  @override
  final DateTime? generatedAt;

  @override
  String toString() {
    return 'PeriodReport(id: $id, studentId: $studentId, period: $period, periodLabel: $periodLabel, generalAverage: $generalAverage, maxAverage: $maxAverage, classAverage: $classAverage, rank: $rank, classSize: $classSize, subjectAverages: $subjectAverages, appreciation: $appreciation, generatedAt: $generatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PeriodReportImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.studentId, studentId) ||
                other.studentId == studentId) &&
            (identical(other.period, period) || other.period == period) &&
            (identical(other.periodLabel, periodLabel) ||
                other.periodLabel == periodLabel) &&
            (identical(other.generalAverage, generalAverage) ||
                other.generalAverage == generalAverage) &&
            (identical(other.maxAverage, maxAverage) ||
                other.maxAverage == maxAverage) &&
            (identical(other.classAverage, classAverage) ||
                other.classAverage == classAverage) &&
            (identical(other.rank, rank) || other.rank == rank) &&
            (identical(other.classSize, classSize) ||
                other.classSize == classSize) &&
            const DeepCollectionEquality()
                .equals(other._subjectAverages, _subjectAverages) &&
            (identical(other.appreciation, appreciation) ||
                other.appreciation == appreciation) &&
            (identical(other.generatedAt, generatedAt) ||
                other.generatedAt == generatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      studentId,
      period,
      periodLabel,
      generalAverage,
      maxAverage,
      classAverage,
      rank,
      classSize,
      const DeepCollectionEquality().hash(_subjectAverages),
      appreciation,
      generatedAt);

  /// Create a copy of PeriodReport
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PeriodReportImplCopyWith<_$PeriodReportImpl> get copyWith =>
      __$$PeriodReportImplCopyWithImpl<_$PeriodReportImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PeriodReportImplToJson(
      this,
    );
  }
}

abstract class _PeriodReport extends PeriodReport {
  const factory _PeriodReport(
      {required final String id,
      required final String studentId,
      required final String period,
      required final String periodLabel,
      required final double generalAverage,
      required final double maxAverage,
      final double? classAverage,
      final int? rank,
      final int? classSize,
      required final List<SubjectAverage> subjectAverages,
      final String? appreciation,
      final DateTime? generatedAt}) = _$PeriodReportImpl;
  const _PeriodReport._() : super._();

  factory _PeriodReport.fromJson(Map<String, dynamic> json) =
      _$PeriodReportImpl.fromJson;

  @override
  String get id;
  @override
  String get studentId;
  @override
  String get period;
  @override
  String get periodLabel;
  @override
  double get generalAverage;
  @override
  double get maxAverage;
  @override
  double? get classAverage;
  @override
  int? get rank;
  @override
  int? get classSize;
  @override
  List<SubjectAverage> get subjectAverages;
  @override
  String? get appreciation;
  @override
  DateTime? get generatedAt;

  /// Create a copy of PeriodReport
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PeriodReportImplCopyWith<_$PeriodReportImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
