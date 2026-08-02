// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'academic_year.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AcademicYear _$AcademicYearFromJson(Map<String, dynamic> json) {
  return _AcademicYear.fromJson(json);
}

/// @nodoc
mixin _$AcademicYear {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  DateTime get startDate => throw _privateConstructorUsedError;
  DateTime get endDate => throw _privateConstructorUsedError;
  bool? get isCurrent => throw _privateConstructorUsedError;
  String? get status => throw _privateConstructorUsedError;

  /// Serializes this AcademicYear to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AcademicYear
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AcademicYearCopyWith<AcademicYear> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AcademicYearCopyWith<$Res> {
  factory $AcademicYearCopyWith(
          AcademicYear value, $Res Function(AcademicYear) then) =
      _$AcademicYearCopyWithImpl<$Res, AcademicYear>;
  @useResult
  $Res call(
      {String id,
      String name,
      DateTime startDate,
      DateTime endDate,
      bool? isCurrent,
      String? status});
}

/// @nodoc
class _$AcademicYearCopyWithImpl<$Res, $Val extends AcademicYear>
    implements $AcademicYearCopyWith<$Res> {
  _$AcademicYearCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AcademicYear
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? startDate = null,
    Object? endDate = null,
    Object? isCurrent = freezed,
    Object? status = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      startDate: null == startDate
          ? _value.startDate
          : startDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      endDate: null == endDate
          ? _value.endDate
          : endDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      isCurrent: freezed == isCurrent
          ? _value.isCurrent
          : isCurrent // ignore: cast_nullable_to_non_nullable
              as bool?,
      status: freezed == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AcademicYearImplCopyWith<$Res>
    implements $AcademicYearCopyWith<$Res> {
  factory _$$AcademicYearImplCopyWith(
          _$AcademicYearImpl value, $Res Function(_$AcademicYearImpl) then) =
      __$$AcademicYearImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      DateTime startDate,
      DateTime endDate,
      bool? isCurrent,
      String? status});
}

/// @nodoc
class __$$AcademicYearImplCopyWithImpl<$Res>
    extends _$AcademicYearCopyWithImpl<$Res, _$AcademicYearImpl>
    implements _$$AcademicYearImplCopyWith<$Res> {
  __$$AcademicYearImplCopyWithImpl(
      _$AcademicYearImpl _value, $Res Function(_$AcademicYearImpl) _then)
      : super(_value, _then);

  /// Create a copy of AcademicYear
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? startDate = null,
    Object? endDate = null,
    Object? isCurrent = freezed,
    Object? status = freezed,
  }) {
    return _then(_$AcademicYearImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      startDate: null == startDate
          ? _value.startDate
          : startDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      endDate: null == endDate
          ? _value.endDate
          : endDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      isCurrent: freezed == isCurrent
          ? _value.isCurrent
          : isCurrent // ignore: cast_nullable_to_non_nullable
              as bool?,
      status: freezed == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AcademicYearImpl implements _AcademicYear {
  const _$AcademicYearImpl(
      {required this.id,
      required this.name,
      required this.startDate,
      required this.endDate,
      this.isCurrent,
      this.status});

  factory _$AcademicYearImpl.fromJson(Map<String, dynamic> json) =>
      _$$AcademicYearImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final DateTime startDate;
  @override
  final DateTime endDate;
  @override
  final bool? isCurrent;
  @override
  final String? status;

  @override
  String toString() {
    return 'AcademicYear(id: $id, name: $name, startDate: $startDate, endDate: $endDate, isCurrent: $isCurrent, status: $status)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AcademicYearImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.startDate, startDate) ||
                other.startDate == startDate) &&
            (identical(other.endDate, endDate) || other.endDate == endDate) &&
            (identical(other.isCurrent, isCurrent) ||
                other.isCurrent == isCurrent) &&
            (identical(other.status, status) || other.status == status));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, name, startDate, endDate, isCurrent, status);

  /// Create a copy of AcademicYear
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AcademicYearImplCopyWith<_$AcademicYearImpl> get copyWith =>
      __$$AcademicYearImplCopyWithImpl<_$AcademicYearImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AcademicYearImplToJson(
      this,
    );
  }
}

abstract class _AcademicYear implements AcademicYear {
  const factory _AcademicYear(
      {required final String id,
      required final String name,
      required final DateTime startDate,
      required final DateTime endDate,
      final bool? isCurrent,
      final String? status}) = _$AcademicYearImpl;

  factory _AcademicYear.fromJson(Map<String, dynamic> json) =
      _$AcademicYearImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  DateTime get startDate;
  @override
  DateTime get endDate;
  @override
  bool? get isCurrent;
  @override
  String? get status;

  /// Create a copy of AcademicYear
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AcademicYearImplCopyWith<_$AcademicYearImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
