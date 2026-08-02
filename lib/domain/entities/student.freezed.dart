// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'student.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Student _$StudentFromJson(Map<String, dynamic> json) {
  return _Student.fromJson(json);
}

/// @nodoc
mixin _$Student {
  String get id => throw _privateConstructorUsedError;
  String get firstName => throw _privateConstructorUsedError;
  String get lastName => throw _privateConstructorUsedError;
  String get matricule => throw _privateConstructorUsedError;
  String? get tenantMatricule => throw _privateConstructorUsedError;
  String? get globalMatricule => throw _privateConstructorUsedError;
  String? get classId => throw _privateConstructorUsedError;
  String? get className => throw _privateConstructorUsedError;
  String? get schoolLevelId => throw _privateConstructorUsedError;
  String? get schoolLevelName => throw _privateConstructorUsedError;
  String? get photoUrl => throw _privateConstructorUsedError;
  String? get gender => throw _privateConstructorUsedError;
  DateTime? get dateOfBirth => throw _privateConstructorUsedError;
  String? get parentName => throw _privateConstructorUsedError;
  String? get parentPhone => throw _privateConstructorUsedError;
  String? get status => throw _privateConstructorUsedError;

  /// Serializes this Student to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Student
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StudentCopyWith<Student> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StudentCopyWith<$Res> {
  factory $StudentCopyWith(Student value, $Res Function(Student) then) =
      _$StudentCopyWithImpl<$Res, Student>;
  @useResult
  $Res call(
      {String id,
      String firstName,
      String lastName,
      String matricule,
      String? tenantMatricule,
      String? globalMatricule,
      String? classId,
      String? className,
      String? schoolLevelId,
      String? schoolLevelName,
      String? photoUrl,
      String? gender,
      DateTime? dateOfBirth,
      String? parentName,
      String? parentPhone,
      String? status});
}

/// @nodoc
class _$StudentCopyWithImpl<$Res, $Val extends Student>
    implements $StudentCopyWith<$Res> {
  _$StudentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Student
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? firstName = null,
    Object? lastName = null,
    Object? matricule = null,
    Object? tenantMatricule = freezed,
    Object? globalMatricule = freezed,
    Object? classId = freezed,
    Object? className = freezed,
    Object? schoolLevelId = freezed,
    Object? schoolLevelName = freezed,
    Object? photoUrl = freezed,
    Object? gender = freezed,
    Object? dateOfBirth = freezed,
    Object? parentName = freezed,
    Object? parentPhone = freezed,
    Object? status = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: null == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      matricule: null == matricule
          ? _value.matricule
          : matricule // ignore: cast_nullable_to_non_nullable
              as String,
      tenantMatricule: freezed == tenantMatricule
          ? _value.tenantMatricule
          : tenantMatricule // ignore: cast_nullable_to_non_nullable
              as String?,
      globalMatricule: freezed == globalMatricule
          ? _value.globalMatricule
          : globalMatricule // ignore: cast_nullable_to_non_nullable
              as String?,
      classId: freezed == classId
          ? _value.classId
          : classId // ignore: cast_nullable_to_non_nullable
              as String?,
      className: freezed == className
          ? _value.className
          : className // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolLevelId: freezed == schoolLevelId
          ? _value.schoolLevelId
          : schoolLevelId // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolLevelName: freezed == schoolLevelName
          ? _value.schoolLevelName
          : schoolLevelName // ignore: cast_nullable_to_non_nullable
              as String?,
      photoUrl: freezed == photoUrl
          ? _value.photoUrl
          : photoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      gender: freezed == gender
          ? _value.gender
          : gender // ignore: cast_nullable_to_non_nullable
              as String?,
      dateOfBirth: freezed == dateOfBirth
          ? _value.dateOfBirth
          : dateOfBirth // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      parentName: freezed == parentName
          ? _value.parentName
          : parentName // ignore: cast_nullable_to_non_nullable
              as String?,
      parentPhone: freezed == parentPhone
          ? _value.parentPhone
          : parentPhone // ignore: cast_nullable_to_non_nullable
              as String?,
      status: freezed == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StudentImplCopyWith<$Res> implements $StudentCopyWith<$Res> {
  factory _$$StudentImplCopyWith(
          _$StudentImpl value, $Res Function(_$StudentImpl) then) =
      __$$StudentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String firstName,
      String lastName,
      String matricule,
      String? tenantMatricule,
      String? globalMatricule,
      String? classId,
      String? className,
      String? schoolLevelId,
      String? schoolLevelName,
      String? photoUrl,
      String? gender,
      DateTime? dateOfBirth,
      String? parentName,
      String? parentPhone,
      String? status});
}

/// @nodoc
class __$$StudentImplCopyWithImpl<$Res>
    extends _$StudentCopyWithImpl<$Res, _$StudentImpl>
    implements _$$StudentImplCopyWith<$Res> {
  __$$StudentImplCopyWithImpl(
      _$StudentImpl _value, $Res Function(_$StudentImpl) _then)
      : super(_value, _then);

  /// Create a copy of Student
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? firstName = null,
    Object? lastName = null,
    Object? matricule = null,
    Object? tenantMatricule = freezed,
    Object? globalMatricule = freezed,
    Object? classId = freezed,
    Object? className = freezed,
    Object? schoolLevelId = freezed,
    Object? schoolLevelName = freezed,
    Object? photoUrl = freezed,
    Object? gender = freezed,
    Object? dateOfBirth = freezed,
    Object? parentName = freezed,
    Object? parentPhone = freezed,
    Object? status = freezed,
  }) {
    return _then(_$StudentImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: null == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      matricule: null == matricule
          ? _value.matricule
          : matricule // ignore: cast_nullable_to_non_nullable
              as String,
      tenantMatricule: freezed == tenantMatricule
          ? _value.tenantMatricule
          : tenantMatricule // ignore: cast_nullable_to_non_nullable
              as String?,
      globalMatricule: freezed == globalMatricule
          ? _value.globalMatricule
          : globalMatricule // ignore: cast_nullable_to_non_nullable
              as String?,
      classId: freezed == classId
          ? _value.classId
          : classId // ignore: cast_nullable_to_non_nullable
              as String?,
      className: freezed == className
          ? _value.className
          : className // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolLevelId: freezed == schoolLevelId
          ? _value.schoolLevelId
          : schoolLevelId // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolLevelName: freezed == schoolLevelName
          ? _value.schoolLevelName
          : schoolLevelName // ignore: cast_nullable_to_non_nullable
              as String?,
      photoUrl: freezed == photoUrl
          ? _value.photoUrl
          : photoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      gender: freezed == gender
          ? _value.gender
          : gender // ignore: cast_nullable_to_non_nullable
              as String?,
      dateOfBirth: freezed == dateOfBirth
          ? _value.dateOfBirth
          : dateOfBirth // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      parentName: freezed == parentName
          ? _value.parentName
          : parentName // ignore: cast_nullable_to_non_nullable
              as String?,
      parentPhone: freezed == parentPhone
          ? _value.parentPhone
          : parentPhone // ignore: cast_nullable_to_non_nullable
              as String?,
      status: freezed == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StudentImpl extends _Student {
  const _$StudentImpl(
      {required this.id,
      required this.firstName,
      required this.lastName,
      required this.matricule,
      this.tenantMatricule,
      this.globalMatricule,
      this.classId,
      this.className,
      this.schoolLevelId,
      this.schoolLevelName,
      this.photoUrl,
      this.gender,
      this.dateOfBirth,
      this.parentName,
      this.parentPhone,
      this.status})
      : super._();

  factory _$StudentImpl.fromJson(Map<String, dynamic> json) =>
      _$$StudentImplFromJson(json);

  @override
  final String id;
  @override
  final String firstName;
  @override
  final String lastName;
  @override
  final String matricule;
  @override
  final String? tenantMatricule;
  @override
  final String? globalMatricule;
  @override
  final String? classId;
  @override
  final String? className;
  @override
  final String? schoolLevelId;
  @override
  final String? schoolLevelName;
  @override
  final String? photoUrl;
  @override
  final String? gender;
  @override
  final DateTime? dateOfBirth;
  @override
  final String? parentName;
  @override
  final String? parentPhone;
  @override
  final String? status;

  @override
  String toString() {
    return 'Student(id: $id, firstName: $firstName, lastName: $lastName, matricule: $matricule, tenantMatricule: $tenantMatricule, globalMatricule: $globalMatricule, classId: $classId, className: $className, schoolLevelId: $schoolLevelId, schoolLevelName: $schoolLevelName, photoUrl: $photoUrl, gender: $gender, dateOfBirth: $dateOfBirth, parentName: $parentName, parentPhone: $parentPhone, status: $status)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StudentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.matricule, matricule) ||
                other.matricule == matricule) &&
            (identical(other.tenantMatricule, tenantMatricule) ||
                other.tenantMatricule == tenantMatricule) &&
            (identical(other.globalMatricule, globalMatricule) ||
                other.globalMatricule == globalMatricule) &&
            (identical(other.classId, classId) || other.classId == classId) &&
            (identical(other.className, className) ||
                other.className == className) &&
            (identical(other.schoolLevelId, schoolLevelId) ||
                other.schoolLevelId == schoolLevelId) &&
            (identical(other.schoolLevelName, schoolLevelName) ||
                other.schoolLevelName == schoolLevelName) &&
            (identical(other.photoUrl, photoUrl) ||
                other.photoUrl == photoUrl) &&
            (identical(other.gender, gender) || other.gender == gender) &&
            (identical(other.dateOfBirth, dateOfBirth) ||
                other.dateOfBirth == dateOfBirth) &&
            (identical(other.parentName, parentName) ||
                other.parentName == parentName) &&
            (identical(other.parentPhone, parentPhone) ||
                other.parentPhone == parentPhone) &&
            (identical(other.status, status) || other.status == status));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      firstName,
      lastName,
      matricule,
      tenantMatricule,
      globalMatricule,
      classId,
      className,
      schoolLevelId,
      schoolLevelName,
      photoUrl,
      gender,
      dateOfBirth,
      parentName,
      parentPhone,
      status);

  /// Create a copy of Student
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StudentImplCopyWith<_$StudentImpl> get copyWith =>
      __$$StudentImplCopyWithImpl<_$StudentImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StudentImplToJson(
      this,
    );
  }
}

abstract class _Student extends Student {
  const factory _Student(
      {required final String id,
      required final String firstName,
      required final String lastName,
      required final String matricule,
      final String? tenantMatricule,
      final String? globalMatricule,
      final String? classId,
      final String? className,
      final String? schoolLevelId,
      final String? schoolLevelName,
      final String? photoUrl,
      final String? gender,
      final DateTime? dateOfBirth,
      final String? parentName,
      final String? parentPhone,
      final String? status}) = _$StudentImpl;
  const _Student._() : super._();

  factory _Student.fromJson(Map<String, dynamic> json) = _$StudentImpl.fromJson;

  @override
  String get id;
  @override
  String get firstName;
  @override
  String get lastName;
  @override
  String get matricule;
  @override
  String? get tenantMatricule;
  @override
  String? get globalMatricule;
  @override
  String? get classId;
  @override
  String? get className;
  @override
  String? get schoolLevelId;
  @override
  String? get schoolLevelName;
  @override
  String? get photoUrl;
  @override
  String? get gender;
  @override
  DateTime? get dateOfBirth;
  @override
  String? get parentName;
  @override
  String? get parentPhone;
  @override
  String? get status;

  /// Create a copy of Student
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StudentImplCopyWith<_$StudentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
