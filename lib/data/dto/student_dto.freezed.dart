// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'student_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

StudentDto _$StudentDtoFromJson(Map<String, dynamic> json) {
  return _StudentDto.fromJson(json);
}

/// @nodoc
mixin _$StudentDto {
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

  /// Serializes this StudentDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StudentDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StudentDtoCopyWith<StudentDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StudentDtoCopyWith<$Res> {
  factory $StudentDtoCopyWith(
          StudentDto value, $Res Function(StudentDto) then) =
      _$StudentDtoCopyWithImpl<$Res, StudentDto>;
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
class _$StudentDtoCopyWithImpl<$Res, $Val extends StudentDto>
    implements $StudentDtoCopyWith<$Res> {
  _$StudentDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StudentDto
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
abstract class _$$StudentDtoImplCopyWith<$Res>
    implements $StudentDtoCopyWith<$Res> {
  factory _$$StudentDtoImplCopyWith(
          _$StudentDtoImpl value, $Res Function(_$StudentDtoImpl) then) =
      __$$StudentDtoImplCopyWithImpl<$Res>;
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
class __$$StudentDtoImplCopyWithImpl<$Res>
    extends _$StudentDtoCopyWithImpl<$Res, _$StudentDtoImpl>
    implements _$$StudentDtoImplCopyWith<$Res> {
  __$$StudentDtoImplCopyWithImpl(
      _$StudentDtoImpl _value, $Res Function(_$StudentDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of StudentDto
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
    return _then(_$StudentDtoImpl(
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
class _$StudentDtoImpl extends _StudentDto {
  const _$StudentDtoImpl(
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

  factory _$StudentDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$StudentDtoImplFromJson(json);

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
    return 'StudentDto(id: $id, firstName: $firstName, lastName: $lastName, matricule: $matricule, tenantMatricule: $tenantMatricule, globalMatricule: $globalMatricule, classId: $classId, className: $className, schoolLevelId: $schoolLevelId, schoolLevelName: $schoolLevelName, photoUrl: $photoUrl, gender: $gender, dateOfBirth: $dateOfBirth, parentName: $parentName, parentPhone: $parentPhone, status: $status)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StudentDtoImpl &&
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

  /// Create a copy of StudentDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StudentDtoImplCopyWith<_$StudentDtoImpl> get copyWith =>
      __$$StudentDtoImplCopyWithImpl<_$StudentDtoImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StudentDtoImplToJson(
      this,
    );
  }
}

abstract class _StudentDto extends StudentDto {
  const factory _StudentDto(
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
      final String? status}) = _$StudentDtoImpl;
  const _StudentDto._() : super._();

  factory _StudentDto.fromJson(Map<String, dynamic> json) =
      _$StudentDtoImpl.fromJson;

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

  /// Create a copy of StudentDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StudentDtoImplCopyWith<_$StudentDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreateStudentRequest _$CreateStudentRequestFromJson(Map<String, dynamic> json) {
  return _CreateStudentRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateStudentRequest {
  String get firstName => throw _privateConstructorUsedError;
  String get lastName => throw _privateConstructorUsedError;
  String get matricule => throw _privateConstructorUsedError;
  String? get classId => throw _privateConstructorUsedError;
  String? get schoolLevelId => throw _privateConstructorUsedError;
  String? get gender => throw _privateConstructorUsedError;
  DateTime? get dateOfBirth => throw _privateConstructorUsedError;
  String? get parentName => throw _privateConstructorUsedError;
  String? get parentPhone => throw _privateConstructorUsedError;

  /// Serializes this CreateStudentRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateStudentRequestCopyWith<CreateStudentRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateStudentRequestCopyWith<$Res> {
  factory $CreateStudentRequestCopyWith(CreateStudentRequest value,
          $Res Function(CreateStudentRequest) then) =
      _$CreateStudentRequestCopyWithImpl<$Res, CreateStudentRequest>;
  @useResult
  $Res call(
      {String firstName,
      String lastName,
      String matricule,
      String? classId,
      String? schoolLevelId,
      String? gender,
      DateTime? dateOfBirth,
      String? parentName,
      String? parentPhone});
}

/// @nodoc
class _$CreateStudentRequestCopyWithImpl<$Res,
        $Val extends CreateStudentRequest>
    implements $CreateStudentRequestCopyWith<$Res> {
  _$CreateStudentRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = null,
    Object? lastName = null,
    Object? matricule = null,
    Object? classId = freezed,
    Object? schoolLevelId = freezed,
    Object? gender = freezed,
    Object? dateOfBirth = freezed,
    Object? parentName = freezed,
    Object? parentPhone = freezed,
  }) {
    return _then(_value.copyWith(
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
      classId: freezed == classId
          ? _value.classId
          : classId // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolLevelId: freezed == schoolLevelId
          ? _value.schoolLevelId
          : schoolLevelId // ignore: cast_nullable_to_non_nullable
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateStudentRequestImplCopyWith<$Res>
    implements $CreateStudentRequestCopyWith<$Res> {
  factory _$$CreateStudentRequestImplCopyWith(_$CreateStudentRequestImpl value,
          $Res Function(_$CreateStudentRequestImpl) then) =
      __$$CreateStudentRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String firstName,
      String lastName,
      String matricule,
      String? classId,
      String? schoolLevelId,
      String? gender,
      DateTime? dateOfBirth,
      String? parentName,
      String? parentPhone});
}

/// @nodoc
class __$$CreateStudentRequestImplCopyWithImpl<$Res>
    extends _$CreateStudentRequestCopyWithImpl<$Res, _$CreateStudentRequestImpl>
    implements _$$CreateStudentRequestImplCopyWith<$Res> {
  __$$CreateStudentRequestImplCopyWithImpl(_$CreateStudentRequestImpl _value,
      $Res Function(_$CreateStudentRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = null,
    Object? lastName = null,
    Object? matricule = null,
    Object? classId = freezed,
    Object? schoolLevelId = freezed,
    Object? gender = freezed,
    Object? dateOfBirth = freezed,
    Object? parentName = freezed,
    Object? parentPhone = freezed,
  }) {
    return _then(_$CreateStudentRequestImpl(
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
      classId: freezed == classId
          ? _value.classId
          : classId // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolLevelId: freezed == schoolLevelId
          ? _value.schoolLevelId
          : schoolLevelId // ignore: cast_nullable_to_non_nullable
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateStudentRequestImpl implements _CreateStudentRequest {
  const _$CreateStudentRequestImpl(
      {required this.firstName,
      required this.lastName,
      required this.matricule,
      this.classId,
      this.schoolLevelId,
      this.gender,
      this.dateOfBirth,
      this.parentName,
      this.parentPhone});

  factory _$CreateStudentRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateStudentRequestImplFromJson(json);

  @override
  final String firstName;
  @override
  final String lastName;
  @override
  final String matricule;
  @override
  final String? classId;
  @override
  final String? schoolLevelId;
  @override
  final String? gender;
  @override
  final DateTime? dateOfBirth;
  @override
  final String? parentName;
  @override
  final String? parentPhone;

  @override
  String toString() {
    return 'CreateStudentRequest(firstName: $firstName, lastName: $lastName, matricule: $matricule, classId: $classId, schoolLevelId: $schoolLevelId, gender: $gender, dateOfBirth: $dateOfBirth, parentName: $parentName, parentPhone: $parentPhone)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateStudentRequestImpl &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.matricule, matricule) ||
                other.matricule == matricule) &&
            (identical(other.classId, classId) || other.classId == classId) &&
            (identical(other.schoolLevelId, schoolLevelId) ||
                other.schoolLevelId == schoolLevelId) &&
            (identical(other.gender, gender) || other.gender == gender) &&
            (identical(other.dateOfBirth, dateOfBirth) ||
                other.dateOfBirth == dateOfBirth) &&
            (identical(other.parentName, parentName) ||
                other.parentName == parentName) &&
            (identical(other.parentPhone, parentPhone) ||
                other.parentPhone == parentPhone));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, firstName, lastName, matricule,
      classId, schoolLevelId, gender, dateOfBirth, parentName, parentPhone);

  /// Create a copy of CreateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateStudentRequestImplCopyWith<_$CreateStudentRequestImpl>
      get copyWith =>
          __$$CreateStudentRequestImplCopyWithImpl<_$CreateStudentRequestImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateStudentRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateStudentRequest implements CreateStudentRequest {
  const factory _CreateStudentRequest(
      {required final String firstName,
      required final String lastName,
      required final String matricule,
      final String? classId,
      final String? schoolLevelId,
      final String? gender,
      final DateTime? dateOfBirth,
      final String? parentName,
      final String? parentPhone}) = _$CreateStudentRequestImpl;

  factory _CreateStudentRequest.fromJson(Map<String, dynamic> json) =
      _$CreateStudentRequestImpl.fromJson;

  @override
  String get firstName;
  @override
  String get lastName;
  @override
  String get matricule;
  @override
  String? get classId;
  @override
  String? get schoolLevelId;
  @override
  String? get gender;
  @override
  DateTime? get dateOfBirth;
  @override
  String? get parentName;
  @override
  String? get parentPhone;

  /// Create a copy of CreateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateStudentRequestImplCopyWith<_$CreateStudentRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}

UpdateStudentRequest _$UpdateStudentRequestFromJson(Map<String, dynamic> json) {
  return _UpdateStudentRequest.fromJson(json);
}

/// @nodoc
mixin _$UpdateStudentRequest {
  String? get firstName => throw _privateConstructorUsedError;
  String? get lastName => throw _privateConstructorUsedError;
  String? get classId => throw _privateConstructorUsedError;
  String? get schoolLevelId => throw _privateConstructorUsedError;
  String? get gender => throw _privateConstructorUsedError;
  DateTime? get dateOfBirth => throw _privateConstructorUsedError;
  String? get parentName => throw _privateConstructorUsedError;
  String? get parentPhone => throw _privateConstructorUsedError;
  String? get status => throw _privateConstructorUsedError;

  /// Serializes this UpdateStudentRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UpdateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UpdateStudentRequestCopyWith<UpdateStudentRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UpdateStudentRequestCopyWith<$Res> {
  factory $UpdateStudentRequestCopyWith(UpdateStudentRequest value,
          $Res Function(UpdateStudentRequest) then) =
      _$UpdateStudentRequestCopyWithImpl<$Res, UpdateStudentRequest>;
  @useResult
  $Res call(
      {String? firstName,
      String? lastName,
      String? classId,
      String? schoolLevelId,
      String? gender,
      DateTime? dateOfBirth,
      String? parentName,
      String? parentPhone,
      String? status});
}

/// @nodoc
class _$UpdateStudentRequestCopyWithImpl<$Res,
        $Val extends UpdateStudentRequest>
    implements $UpdateStudentRequestCopyWith<$Res> {
  _$UpdateStudentRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UpdateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? classId = freezed,
    Object? schoolLevelId = freezed,
    Object? gender = freezed,
    Object? dateOfBirth = freezed,
    Object? parentName = freezed,
    Object? parentPhone = freezed,
    Object? status = freezed,
  }) {
    return _then(_value.copyWith(
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      classId: freezed == classId
          ? _value.classId
          : classId // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolLevelId: freezed == schoolLevelId
          ? _value.schoolLevelId
          : schoolLevelId // ignore: cast_nullable_to_non_nullable
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
abstract class _$$UpdateStudentRequestImplCopyWith<$Res>
    implements $UpdateStudentRequestCopyWith<$Res> {
  factory _$$UpdateStudentRequestImplCopyWith(_$UpdateStudentRequestImpl value,
          $Res Function(_$UpdateStudentRequestImpl) then) =
      __$$UpdateStudentRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? firstName,
      String? lastName,
      String? classId,
      String? schoolLevelId,
      String? gender,
      DateTime? dateOfBirth,
      String? parentName,
      String? parentPhone,
      String? status});
}

/// @nodoc
class __$$UpdateStudentRequestImplCopyWithImpl<$Res>
    extends _$UpdateStudentRequestCopyWithImpl<$Res, _$UpdateStudentRequestImpl>
    implements _$$UpdateStudentRequestImplCopyWith<$Res> {
  __$$UpdateStudentRequestImplCopyWithImpl(_$UpdateStudentRequestImpl _value,
      $Res Function(_$UpdateStudentRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of UpdateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? classId = freezed,
    Object? schoolLevelId = freezed,
    Object? gender = freezed,
    Object? dateOfBirth = freezed,
    Object? parentName = freezed,
    Object? parentPhone = freezed,
    Object? status = freezed,
  }) {
    return _then(_$UpdateStudentRequestImpl(
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      classId: freezed == classId
          ? _value.classId
          : classId // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolLevelId: freezed == schoolLevelId
          ? _value.schoolLevelId
          : schoolLevelId // ignore: cast_nullable_to_non_nullable
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
class _$UpdateStudentRequestImpl implements _UpdateStudentRequest {
  const _$UpdateStudentRequestImpl(
      {this.firstName,
      this.lastName,
      this.classId,
      this.schoolLevelId,
      this.gender,
      this.dateOfBirth,
      this.parentName,
      this.parentPhone,
      this.status});

  factory _$UpdateStudentRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$UpdateStudentRequestImplFromJson(json);

  @override
  final String? firstName;
  @override
  final String? lastName;
  @override
  final String? classId;
  @override
  final String? schoolLevelId;
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
    return 'UpdateStudentRequest(firstName: $firstName, lastName: $lastName, classId: $classId, schoolLevelId: $schoolLevelId, gender: $gender, dateOfBirth: $dateOfBirth, parentName: $parentName, parentPhone: $parentPhone, status: $status)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UpdateStudentRequestImpl &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.classId, classId) || other.classId == classId) &&
            (identical(other.schoolLevelId, schoolLevelId) ||
                other.schoolLevelId == schoolLevelId) &&
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
  int get hashCode => Object.hash(runtimeType, firstName, lastName, classId,
      schoolLevelId, gender, dateOfBirth, parentName, parentPhone, status);

  /// Create a copy of UpdateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UpdateStudentRequestImplCopyWith<_$UpdateStudentRequestImpl>
      get copyWith =>
          __$$UpdateStudentRequestImplCopyWithImpl<_$UpdateStudentRequestImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UpdateStudentRequestImplToJson(
      this,
    );
  }
}

abstract class _UpdateStudentRequest implements UpdateStudentRequest {
  const factory _UpdateStudentRequest(
      {final String? firstName,
      final String? lastName,
      final String? classId,
      final String? schoolLevelId,
      final String? gender,
      final DateTime? dateOfBirth,
      final String? parentName,
      final String? parentPhone,
      final String? status}) = _$UpdateStudentRequestImpl;

  factory _UpdateStudentRequest.fromJson(Map<String, dynamic> json) =
      _$UpdateStudentRequestImpl.fromJson;

  @override
  String? get firstName;
  @override
  String? get lastName;
  @override
  String? get classId;
  @override
  String? get schoolLevelId;
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

  /// Create a copy of UpdateStudentRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UpdateStudentRequestImplCopyWith<_$UpdateStudentRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}

StudentListResponse _$StudentListResponseFromJson(Map<String, dynamic> json) {
  return _StudentListResponse.fromJson(json);
}

/// @nodoc
mixin _$StudentListResponse {
  List<StudentDto> get data => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this StudentListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StudentListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StudentListResponseCopyWith<StudentListResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StudentListResponseCopyWith<$Res> {
  factory $StudentListResponseCopyWith(
          StudentListResponse value, $Res Function(StudentListResponse) then) =
      _$StudentListResponseCopyWithImpl<$Res, StudentListResponse>;
  @useResult
  $Res call({List<StudentDto> data, int total, int page, int limit});
}

/// @nodoc
class _$StudentListResponseCopyWithImpl<$Res, $Val extends StudentListResponse>
    implements $StudentListResponseCopyWith<$Res> {
  _$StudentListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StudentListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as List<StudentDto>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as int,
      limit: null == limit
          ? _value.limit
          : limit // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StudentListResponseImplCopyWith<$Res>
    implements $StudentListResponseCopyWith<$Res> {
  factory _$$StudentListResponseImplCopyWith(_$StudentListResponseImpl value,
          $Res Function(_$StudentListResponseImpl) then) =
      __$$StudentListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<StudentDto> data, int total, int page, int limit});
}

/// @nodoc
class __$$StudentListResponseImplCopyWithImpl<$Res>
    extends _$StudentListResponseCopyWithImpl<$Res, _$StudentListResponseImpl>
    implements _$$StudentListResponseImplCopyWith<$Res> {
  __$$StudentListResponseImplCopyWithImpl(_$StudentListResponseImpl _value,
      $Res Function(_$StudentListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of StudentListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$StudentListResponseImpl(
      data: null == data
          ? _value._data
          : data // ignore: cast_nullable_to_non_nullable
              as List<StudentDto>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as int,
      limit: null == limit
          ? _value.limit
          : limit // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StudentListResponseImpl implements _StudentListResponse {
  const _$StudentListResponseImpl(
      {required final List<StudentDto> data,
      required this.total,
      required this.page,
      required this.limit})
      : _data = data;

  factory _$StudentListResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$StudentListResponseImplFromJson(json);

  final List<StudentDto> _data;
  @override
  List<StudentDto> get data {
    if (_data is EqualUnmodifiableListView) return _data;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_data);
  }

  @override
  final int total;
  @override
  final int page;
  @override
  final int limit;

  @override
  String toString() {
    return 'StudentListResponse(data: $data, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StudentListResponseImpl &&
            const DeepCollectionEquality().equals(other._data, _data) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_data), total, page, limit);

  /// Create a copy of StudentListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StudentListResponseImplCopyWith<_$StudentListResponseImpl> get copyWith =>
      __$$StudentListResponseImplCopyWithImpl<_$StudentListResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StudentListResponseImplToJson(
      this,
    );
  }
}

abstract class _StudentListResponse implements StudentListResponse {
  const factory _StudentListResponse(
      {required final List<StudentDto> data,
      required final int total,
      required final int page,
      required final int limit}) = _$StudentListResponseImpl;

  factory _StudentListResponse.fromJson(Map<String, dynamic> json) =
      _$StudentListResponseImpl.fromJson;

  @override
  List<StudentDto> get data;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of StudentListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StudentListResponseImplCopyWith<_$StudentListResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
