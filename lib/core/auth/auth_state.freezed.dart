// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

TenantBasic _$TenantBasicFromJson(Map<String, dynamic> json) {
  return _TenantBasic.fromJson(json);
}

/// @nodoc
mixin _$TenantBasic {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get acronym => throw _privateConstructorUsedError;
  String? get logoUrl => throw _privateConstructorUsedError;
  String? get type => throw _privateConstructorUsedError;
  String? get subdomain => throw _privateConstructorUsedError;

  /// Serializes this TenantBasic to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of TenantBasic
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TenantBasicCopyWith<TenantBasic> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TenantBasicCopyWith<$Res> {
  factory $TenantBasicCopyWith(
          TenantBasic value, $Res Function(TenantBasic) then) =
      _$TenantBasicCopyWithImpl<$Res, TenantBasic>;
  @useResult
  $Res call(
      {String id,
      String name,
      String? acronym,
      String? logoUrl,
      String? type,
      String? subdomain});
}

/// @nodoc
class _$TenantBasicCopyWithImpl<$Res, $Val extends TenantBasic>
    implements $TenantBasicCopyWith<$Res> {
  _$TenantBasicCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TenantBasic
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? acronym = freezed,
    Object? logoUrl = freezed,
    Object? type = freezed,
    Object? subdomain = freezed,
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
      acronym: freezed == acronym
          ? _value.acronym
          : acronym // ignore: cast_nullable_to_non_nullable
              as String?,
      logoUrl: freezed == logoUrl
          ? _value.logoUrl
          : logoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String?,
      subdomain: freezed == subdomain
          ? _value.subdomain
          : subdomain // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$TenantBasicImplCopyWith<$Res>
    implements $TenantBasicCopyWith<$Res> {
  factory _$$TenantBasicImplCopyWith(
          _$TenantBasicImpl value, $Res Function(_$TenantBasicImpl) then) =
      __$$TenantBasicImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      String? acronym,
      String? logoUrl,
      String? type,
      String? subdomain});
}

/// @nodoc
class __$$TenantBasicImplCopyWithImpl<$Res>
    extends _$TenantBasicCopyWithImpl<$Res, _$TenantBasicImpl>
    implements _$$TenantBasicImplCopyWith<$Res> {
  __$$TenantBasicImplCopyWithImpl(
      _$TenantBasicImpl _value, $Res Function(_$TenantBasicImpl) _then)
      : super(_value, _then);

  /// Create a copy of TenantBasic
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? acronym = freezed,
    Object? logoUrl = freezed,
    Object? type = freezed,
    Object? subdomain = freezed,
  }) {
    return _then(_$TenantBasicImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      acronym: freezed == acronym
          ? _value.acronym
          : acronym // ignore: cast_nullable_to_non_nullable
              as String?,
      logoUrl: freezed == logoUrl
          ? _value.logoUrl
          : logoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String?,
      subdomain: freezed == subdomain
          ? _value.subdomain
          : subdomain // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$TenantBasicImpl extends _TenantBasic {
  const _$TenantBasicImpl(
      {required this.id,
      required this.name,
      this.acronym,
      this.logoUrl,
      this.type,
      this.subdomain})
      : super._();

  factory _$TenantBasicImpl.fromJson(Map<String, dynamic> json) =>
      _$$TenantBasicImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String? acronym;
  @override
  final String? logoUrl;
  @override
  final String? type;
  @override
  final String? subdomain;

  @override
  String toString() {
    return 'TenantBasic(id: $id, name: $name, acronym: $acronym, logoUrl: $logoUrl, type: $type, subdomain: $subdomain)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TenantBasicImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.acronym, acronym) || other.acronym == acronym) &&
            (identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.subdomain, subdomain) ||
                other.subdomain == subdomain));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, name, acronym, logoUrl, type, subdomain);

  /// Create a copy of TenantBasic
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TenantBasicImplCopyWith<_$TenantBasicImpl> get copyWith =>
      __$$TenantBasicImplCopyWithImpl<_$TenantBasicImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TenantBasicImplToJson(
      this,
    );
  }
}

abstract class _TenantBasic extends TenantBasic {
  const factory _TenantBasic(
      {required final String id,
      required final String name,
      final String? acronym,
      final String? logoUrl,
      final String? type,
      final String? subdomain}) = _$TenantBasicImpl;
  const _TenantBasic._() : super._();

  factory _TenantBasic.fromJson(Map<String, dynamic> json) =
      _$TenantBasicImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String? get acronym;
  @override
  String? get logoUrl;
  @override
  String? get type;
  @override
  String? get subdomain;

  /// Create a copy of TenantBasic
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TenantBasicImplCopyWith<_$TenantBasicImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AuthUser _$AuthUserFromJson(Map<String, dynamic> json) {
  return _AuthUser.fromJson(json);
}

/// @nodoc
mixin _$AuthUser {
  String get id => throw _privateConstructorUsedError;
  String get email => throw _privateConstructorUsedError;
  String get firstName => throw _privateConstructorUsedError;
  String get lastName => throw _privateConstructorUsedError;
  String? get avatarUrl => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get role => throw _privateConstructorUsedError;
  bool get isActive => throw _privateConstructorUsedError;
  List<String> get permissions => throw _privateConstructorUsedError;
  DateTime? get lastLoginAt => throw _privateConstructorUsedError;
  DateTime? get createdAt => throw _privateConstructorUsedError;
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this AuthUser to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthUserCopyWith<AuthUser> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthUserCopyWith<$Res> {
  factory $AuthUserCopyWith(AuthUser value, $Res Function(AuthUser) then) =
      _$AuthUserCopyWithImpl<$Res, AuthUser>;
  @useResult
  $Res call(
      {String id,
      String email,
      String firstName,
      String lastName,
      String? avatarUrl,
      String? phone,
      String? role,
      bool isActive,
      List<String> permissions,
      DateTime? lastLoginAt,
      DateTime? createdAt,
      DateTime? updatedAt});
}

/// @nodoc
class _$AuthUserCopyWithImpl<$Res, $Val extends AuthUser>
    implements $AuthUserCopyWith<$Res> {
  _$AuthUserCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? email = null,
    Object? firstName = null,
    Object? lastName = null,
    Object? avatarUrl = freezed,
    Object? phone = freezed,
    Object? role = freezed,
    Object? isActive = null,
    Object? permissions = null,
    Object? lastLoginAt = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: null == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      avatarUrl: freezed == avatarUrl
          ? _value.avatarUrl
          : avatarUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      role: freezed == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as String?,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
      permissions: null == permissions
          ? _value.permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<String>,
      lastLoginAt: freezed == lastLoginAt
          ? _value.lastLoginAt
          : lastLoginAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthUserImplCopyWith<$Res>
    implements $AuthUserCopyWith<$Res> {
  factory _$$AuthUserImplCopyWith(
          _$AuthUserImpl value, $Res Function(_$AuthUserImpl) then) =
      __$$AuthUserImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String email,
      String firstName,
      String lastName,
      String? avatarUrl,
      String? phone,
      String? role,
      bool isActive,
      List<String> permissions,
      DateTime? lastLoginAt,
      DateTime? createdAt,
      DateTime? updatedAt});
}

/// @nodoc
class __$$AuthUserImplCopyWithImpl<$Res>
    extends _$AuthUserCopyWithImpl<$Res, _$AuthUserImpl>
    implements _$$AuthUserImplCopyWith<$Res> {
  __$$AuthUserImplCopyWithImpl(
      _$AuthUserImpl _value, $Res Function(_$AuthUserImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthUser
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? email = null,
    Object? firstName = null,
    Object? lastName = null,
    Object? avatarUrl = freezed,
    Object? phone = freezed,
    Object? role = freezed,
    Object? isActive = null,
    Object? permissions = null,
    Object? lastLoginAt = freezed,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_$AuthUserImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: null == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
      avatarUrl: freezed == avatarUrl
          ? _value.avatarUrl
          : avatarUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      role: freezed == role
          ? _value.role
          : role // ignore: cast_nullable_to_non_nullable
              as String?,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
      permissions: null == permissions
          ? _value._permissions
          : permissions // ignore: cast_nullable_to_non_nullable
              as List<String>,
      lastLoginAt: freezed == lastLoginAt
          ? _value.lastLoginAt
          : lastLoginAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthUserImpl extends _AuthUser {
  const _$AuthUserImpl(
      {required this.id,
      required this.email,
      required this.firstName,
      required this.lastName,
      this.avatarUrl,
      this.phone,
      this.role,
      this.isActive = true,
      final List<String> permissions = const [],
      this.lastLoginAt,
      this.createdAt,
      this.updatedAt})
      : _permissions = permissions,
        super._();

  factory _$AuthUserImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthUserImplFromJson(json);

  @override
  final String id;
  @override
  final String email;
  @override
  final String firstName;
  @override
  final String lastName;
  @override
  final String? avatarUrl;
  @override
  final String? phone;
  @override
  final String? role;
  @override
  @JsonKey()
  final bool isActive;
  final List<String> _permissions;
  @override
  @JsonKey()
  List<String> get permissions {
    if (_permissions is EqualUnmodifiableListView) return _permissions;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_permissions);
  }

  @override
  final DateTime? lastLoginAt;
  @override
  final DateTime? createdAt;
  @override
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'AuthUser(id: $id, email: $email, firstName: $firstName, lastName: $lastName, avatarUrl: $avatarUrl, phone: $phone, role: $role, isActive: $isActive, permissions: $permissions, lastLoginAt: $lastLoginAt, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthUserImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.avatarUrl, avatarUrl) ||
                other.avatarUrl == avatarUrl) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.role, role) || other.role == role) &&
            (identical(other.isActive, isActive) ||
                other.isActive == isActive) &&
            const DeepCollectionEquality()
                .equals(other._permissions, _permissions) &&
            (identical(other.lastLoginAt, lastLoginAt) ||
                other.lastLoginAt == lastLoginAt) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      email,
      firstName,
      lastName,
      avatarUrl,
      phone,
      role,
      isActive,
      const DeepCollectionEquality().hash(_permissions),
      lastLoginAt,
      createdAt,
      updatedAt);

  /// Create a copy of AuthUser
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthUserImplCopyWith<_$AuthUserImpl> get copyWith =>
      __$$AuthUserImplCopyWithImpl<_$AuthUserImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthUserImplToJson(
      this,
    );
  }
}

abstract class _AuthUser extends AuthUser {
  const factory _AuthUser(
      {required final String id,
      required final String email,
      required final String firstName,
      required final String lastName,
      final String? avatarUrl,
      final String? phone,
      final String? role,
      final bool isActive,
      final List<String> permissions,
      final DateTime? lastLoginAt,
      final DateTime? createdAt,
      final DateTime? updatedAt}) = _$AuthUserImpl;
  const _AuthUser._() : super._();

  factory _AuthUser.fromJson(Map<String, dynamic> json) =
      _$AuthUserImpl.fromJson;

  @override
  String get id;
  @override
  String get email;
  @override
  String get firstName;
  @override
  String get lastName;
  @override
  String? get avatarUrl;
  @override
  String? get phone;
  @override
  String? get role;
  @override
  bool get isActive;
  @override
  List<String> get permissions;
  @override
  DateTime? get lastLoginAt;
  @override
  DateTime? get createdAt;
  @override
  DateTime? get updatedAt;

  /// Create a copy of AuthUser
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthUserImplCopyWith<_$AuthUserImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$AuthState {
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)
        authenticated,
    required TResult Function() unauthenticated,
    required TResult Function() loading,
    required TResult Function() loginLoading,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult? Function()? unauthenticated,
    TResult? Function()? loading,
    TResult? Function()? loginLoading,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult Function()? unauthenticated,
    TResult Function()? loading,
    TResult Function()? loginLoading,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(AuthInitial value) initial,
    required TResult Function(AuthAuthenticated value) authenticated,
    required TResult Function(AuthUnauthenticated value) unauthenticated,
    required TResult Function(AuthLoading value) loading,
    required TResult Function(AuthLoginLoading value) loginLoading,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(AuthInitial value)? initial,
    TResult? Function(AuthAuthenticated value)? authenticated,
    TResult? Function(AuthUnauthenticated value)? unauthenticated,
    TResult? Function(AuthLoading value)? loading,
    TResult? Function(AuthLoginLoading value)? loginLoading,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(AuthInitial value)? initial,
    TResult Function(AuthAuthenticated value)? authenticated,
    TResult Function(AuthUnauthenticated value)? unauthenticated,
    TResult Function(AuthLoading value)? loading,
    TResult Function(AuthLoginLoading value)? loginLoading,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthStateCopyWith<$Res> {
  factory $AuthStateCopyWith(AuthState value, $Res Function(AuthState) then) =
      _$AuthStateCopyWithImpl<$Res, AuthState>;
}

/// @nodoc
class _$AuthStateCopyWithImpl<$Res, $Val extends AuthState>
    implements $AuthStateCopyWith<$Res> {
  _$AuthStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$AuthInitialImplCopyWith<$Res> {
  factory _$$AuthInitialImplCopyWith(
          _$AuthInitialImpl value, $Res Function(_$AuthInitialImpl) then) =
      __$$AuthInitialImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$AuthInitialImplCopyWithImpl<$Res>
    extends _$AuthStateCopyWithImpl<$Res, _$AuthInitialImpl>
    implements _$$AuthInitialImplCopyWith<$Res> {
  __$$AuthInitialImplCopyWithImpl(
      _$AuthInitialImpl _value, $Res Function(_$AuthInitialImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$AuthInitialImpl implements AuthInitial {
  const _$AuthInitialImpl();

  @override
  String toString() {
    return 'AuthState.initial()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is _$AuthInitialImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)
        authenticated,
    required TResult Function() unauthenticated,
    required TResult Function() loading,
    required TResult Function() loginLoading,
  }) {
    return initial();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult? Function()? unauthenticated,
    TResult? Function()? loading,
    TResult? Function()? loginLoading,
  }) {
    return initial?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult Function()? unauthenticated,
    TResult Function()? loading,
    TResult Function()? loginLoading,
    required TResult orElse(),
  }) {
    if (initial != null) {
      return initial();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(AuthInitial value) initial,
    required TResult Function(AuthAuthenticated value) authenticated,
    required TResult Function(AuthUnauthenticated value) unauthenticated,
    required TResult Function(AuthLoading value) loading,
    required TResult Function(AuthLoginLoading value) loginLoading,
  }) {
    return initial(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(AuthInitial value)? initial,
    TResult? Function(AuthAuthenticated value)? authenticated,
    TResult? Function(AuthUnauthenticated value)? unauthenticated,
    TResult? Function(AuthLoading value)? loading,
    TResult? Function(AuthLoginLoading value)? loginLoading,
  }) {
    return initial?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(AuthInitial value)? initial,
    TResult Function(AuthAuthenticated value)? authenticated,
    TResult Function(AuthUnauthenticated value)? unauthenticated,
    TResult Function(AuthLoading value)? loading,
    TResult Function(AuthLoginLoading value)? loginLoading,
    required TResult orElse(),
  }) {
    if (initial != null) {
      return initial(this);
    }
    return orElse();
  }
}

abstract class AuthInitial implements AuthState {
  const factory AuthInitial() = _$AuthInitialImpl;
}

/// @nodoc
abstract class _$$AuthAuthenticatedImplCopyWith<$Res> {
  factory _$$AuthAuthenticatedImplCopyWith(_$AuthAuthenticatedImpl value,
          $Res Function(_$AuthAuthenticatedImpl) then) =
      __$$AuthAuthenticatedImplCopyWithImpl<$Res>;
  @useResult
  $Res call(
      {AuthUser user,
      String accessToken,
      List<TenantBasic> availableTenants,
      String? selectedTenantId,
      PortalType? selectedPortal});

  $AuthUserCopyWith<$Res> get user;
}

/// @nodoc
class __$$AuthAuthenticatedImplCopyWithImpl<$Res>
    extends _$AuthStateCopyWithImpl<$Res, _$AuthAuthenticatedImpl>
    implements _$$AuthAuthenticatedImplCopyWith<$Res> {
  __$$AuthAuthenticatedImplCopyWithImpl(_$AuthAuthenticatedImpl _value,
      $Res Function(_$AuthAuthenticatedImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? user = null,
    Object? accessToken = null,
    Object? availableTenants = null,
    Object? selectedTenantId = freezed,
    Object? selectedPortal = freezed,
  }) {
    return _then(_$AuthAuthenticatedImpl(
      null == user
          ? _value.user
          : user // ignore: cast_nullable_to_non_nullable
              as AuthUser,
      null == accessToken
          ? _value.accessToken
          : accessToken // ignore: cast_nullable_to_non_nullable
              as String,
      availableTenants: null == availableTenants
          ? _value._availableTenants
          : availableTenants // ignore: cast_nullable_to_non_nullable
              as List<TenantBasic>,
      selectedTenantId: freezed == selectedTenantId
          ? _value.selectedTenantId
          : selectedTenantId // ignore: cast_nullable_to_non_nullable
              as String?,
      selectedPortal: freezed == selectedPortal
          ? _value.selectedPortal
          : selectedPortal // ignore: cast_nullable_to_non_nullable
              as PortalType?,
    ));
  }

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthUserCopyWith<$Res> get user {
    return $AuthUserCopyWith<$Res>(_value.user, (value) {
      return _then(_value.copyWith(user: value));
    });
  }
}

/// @nodoc

class _$AuthAuthenticatedImpl implements AuthAuthenticated {
  const _$AuthAuthenticatedImpl(this.user, this.accessToken,
      {final List<TenantBasic> availableTenants = const [],
      this.selectedTenantId,
      this.selectedPortal})
      : _availableTenants = availableTenants;

  @override
  final AuthUser user;
  @override
  final String accessToken;
  final List<TenantBasic> _availableTenants;
  @override
  @JsonKey()
  List<TenantBasic> get availableTenants {
    if (_availableTenants is EqualUnmodifiableListView)
      return _availableTenants;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_availableTenants);
  }

  @override
  final String? selectedTenantId;
  @override
  final PortalType? selectedPortal;

  @override
  String toString() {
    return 'AuthState.authenticated(user: $user, accessToken: $accessToken, availableTenants: $availableTenants, selectedTenantId: $selectedTenantId, selectedPortal: $selectedPortal)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthAuthenticatedImpl &&
            (identical(other.user, user) || other.user == user) &&
            (identical(other.accessToken, accessToken) ||
                other.accessToken == accessToken) &&
            const DeepCollectionEquality()
                .equals(other._availableTenants, _availableTenants) &&
            (identical(other.selectedTenantId, selectedTenantId) ||
                other.selectedTenantId == selectedTenantId) &&
            (identical(other.selectedPortal, selectedPortal) ||
                other.selectedPortal == selectedPortal));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      user,
      accessToken,
      const DeepCollectionEquality().hash(_availableTenants),
      selectedTenantId,
      selectedPortal);

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthAuthenticatedImplCopyWith<_$AuthAuthenticatedImpl> get copyWith =>
      __$$AuthAuthenticatedImplCopyWithImpl<_$AuthAuthenticatedImpl>(
          this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)
        authenticated,
    required TResult Function() unauthenticated,
    required TResult Function() loading,
    required TResult Function() loginLoading,
  }) {
    return authenticated(
        user, accessToken, availableTenants, selectedTenantId, selectedPortal);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult? Function()? unauthenticated,
    TResult? Function()? loading,
    TResult? Function()? loginLoading,
  }) {
    return authenticated?.call(
        user, accessToken, availableTenants, selectedTenantId, selectedPortal);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult Function()? unauthenticated,
    TResult Function()? loading,
    TResult Function()? loginLoading,
    required TResult orElse(),
  }) {
    if (authenticated != null) {
      return authenticated(user, accessToken, availableTenants,
          selectedTenantId, selectedPortal);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(AuthInitial value) initial,
    required TResult Function(AuthAuthenticated value) authenticated,
    required TResult Function(AuthUnauthenticated value) unauthenticated,
    required TResult Function(AuthLoading value) loading,
    required TResult Function(AuthLoginLoading value) loginLoading,
  }) {
    return authenticated(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(AuthInitial value)? initial,
    TResult? Function(AuthAuthenticated value)? authenticated,
    TResult? Function(AuthUnauthenticated value)? unauthenticated,
    TResult? Function(AuthLoading value)? loading,
    TResult? Function(AuthLoginLoading value)? loginLoading,
  }) {
    return authenticated?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(AuthInitial value)? initial,
    TResult Function(AuthAuthenticated value)? authenticated,
    TResult Function(AuthUnauthenticated value)? unauthenticated,
    TResult Function(AuthLoading value)? loading,
    TResult Function(AuthLoginLoading value)? loginLoading,
    required TResult orElse(),
  }) {
    if (authenticated != null) {
      return authenticated(this);
    }
    return orElse();
  }
}

abstract class AuthAuthenticated implements AuthState {
  const factory AuthAuthenticated(final AuthUser user, final String accessToken,
      {final List<TenantBasic> availableTenants,
      final String? selectedTenantId,
      final PortalType? selectedPortal}) = _$AuthAuthenticatedImpl;

  AuthUser get user;
  String get accessToken;
  List<TenantBasic> get availableTenants;
  String? get selectedTenantId;
  PortalType? get selectedPortal;

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthAuthenticatedImplCopyWith<_$AuthAuthenticatedImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$AuthUnauthenticatedImplCopyWith<$Res> {
  factory _$$AuthUnauthenticatedImplCopyWith(_$AuthUnauthenticatedImpl value,
          $Res Function(_$AuthUnauthenticatedImpl) then) =
      __$$AuthUnauthenticatedImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$AuthUnauthenticatedImplCopyWithImpl<$Res>
    extends _$AuthStateCopyWithImpl<$Res, _$AuthUnauthenticatedImpl>
    implements _$$AuthUnauthenticatedImplCopyWith<$Res> {
  __$$AuthUnauthenticatedImplCopyWithImpl(_$AuthUnauthenticatedImpl _value,
      $Res Function(_$AuthUnauthenticatedImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$AuthUnauthenticatedImpl implements AuthUnauthenticated {
  const _$AuthUnauthenticatedImpl();

  @override
  String toString() {
    return 'AuthState.unauthenticated()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthUnauthenticatedImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)
        authenticated,
    required TResult Function() unauthenticated,
    required TResult Function() loading,
    required TResult Function() loginLoading,
  }) {
    return unauthenticated();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult? Function()? unauthenticated,
    TResult? Function()? loading,
    TResult? Function()? loginLoading,
  }) {
    return unauthenticated?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult Function()? unauthenticated,
    TResult Function()? loading,
    TResult Function()? loginLoading,
    required TResult orElse(),
  }) {
    if (unauthenticated != null) {
      return unauthenticated();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(AuthInitial value) initial,
    required TResult Function(AuthAuthenticated value) authenticated,
    required TResult Function(AuthUnauthenticated value) unauthenticated,
    required TResult Function(AuthLoading value) loading,
    required TResult Function(AuthLoginLoading value) loginLoading,
  }) {
    return unauthenticated(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(AuthInitial value)? initial,
    TResult? Function(AuthAuthenticated value)? authenticated,
    TResult? Function(AuthUnauthenticated value)? unauthenticated,
    TResult? Function(AuthLoading value)? loading,
    TResult? Function(AuthLoginLoading value)? loginLoading,
  }) {
    return unauthenticated?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(AuthInitial value)? initial,
    TResult Function(AuthAuthenticated value)? authenticated,
    TResult Function(AuthUnauthenticated value)? unauthenticated,
    TResult Function(AuthLoading value)? loading,
    TResult Function(AuthLoginLoading value)? loginLoading,
    required TResult orElse(),
  }) {
    if (unauthenticated != null) {
      return unauthenticated(this);
    }
    return orElse();
  }
}

abstract class AuthUnauthenticated implements AuthState {
  const factory AuthUnauthenticated() = _$AuthUnauthenticatedImpl;
}

/// @nodoc
abstract class _$$AuthLoadingImplCopyWith<$Res> {
  factory _$$AuthLoadingImplCopyWith(
          _$AuthLoadingImpl value, $Res Function(_$AuthLoadingImpl) then) =
      __$$AuthLoadingImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$AuthLoadingImplCopyWithImpl<$Res>
    extends _$AuthStateCopyWithImpl<$Res, _$AuthLoadingImpl>
    implements _$$AuthLoadingImplCopyWith<$Res> {
  __$$AuthLoadingImplCopyWithImpl(
      _$AuthLoadingImpl _value, $Res Function(_$AuthLoadingImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$AuthLoadingImpl implements AuthLoading {
  const _$AuthLoadingImpl();

  @override
  String toString() {
    return 'AuthState.loading()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is _$AuthLoadingImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)
        authenticated,
    required TResult Function() unauthenticated,
    required TResult Function() loading,
    required TResult Function() loginLoading,
  }) {
    return loading();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult? Function()? unauthenticated,
    TResult? Function()? loading,
    TResult? Function()? loginLoading,
  }) {
    return loading?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult Function()? unauthenticated,
    TResult Function()? loading,
    TResult Function()? loginLoading,
    required TResult orElse(),
  }) {
    if (loading != null) {
      return loading();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(AuthInitial value) initial,
    required TResult Function(AuthAuthenticated value) authenticated,
    required TResult Function(AuthUnauthenticated value) unauthenticated,
    required TResult Function(AuthLoading value) loading,
    required TResult Function(AuthLoginLoading value) loginLoading,
  }) {
    return loading(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(AuthInitial value)? initial,
    TResult? Function(AuthAuthenticated value)? authenticated,
    TResult? Function(AuthUnauthenticated value)? unauthenticated,
    TResult? Function(AuthLoading value)? loading,
    TResult? Function(AuthLoginLoading value)? loginLoading,
  }) {
    return loading?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(AuthInitial value)? initial,
    TResult Function(AuthAuthenticated value)? authenticated,
    TResult Function(AuthUnauthenticated value)? unauthenticated,
    TResult Function(AuthLoading value)? loading,
    TResult Function(AuthLoginLoading value)? loginLoading,
    required TResult orElse(),
  }) {
    if (loading != null) {
      return loading(this);
    }
    return orElse();
  }
}

abstract class AuthLoading implements AuthState {
  const factory AuthLoading() = _$AuthLoadingImpl;
}

/// @nodoc
abstract class _$$AuthLoginLoadingImplCopyWith<$Res> {
  factory _$$AuthLoginLoadingImplCopyWith(_$AuthLoginLoadingImpl value,
          $Res Function(_$AuthLoginLoadingImpl) then) =
      __$$AuthLoginLoadingImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$AuthLoginLoadingImplCopyWithImpl<$Res>
    extends _$AuthStateCopyWithImpl<$Res, _$AuthLoginLoadingImpl>
    implements _$$AuthLoginLoadingImplCopyWith<$Res> {
  __$$AuthLoginLoadingImplCopyWithImpl(_$AuthLoginLoadingImpl _value,
      $Res Function(_$AuthLoginLoadingImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$AuthLoginLoadingImpl implements AuthLoginLoading {
  const _$AuthLoginLoadingImpl();

  @override
  String toString() {
    return 'AuthState.loginLoading()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is _$AuthLoginLoadingImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)
        authenticated,
    required TResult Function() unauthenticated,
    required TResult Function() loading,
    required TResult Function() loginLoading,
  }) {
    return loginLoading();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult? Function()? unauthenticated,
    TResult? Function()? loading,
    TResult? Function()? loginLoading,
  }) {
    return loginLoading?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(
            AuthUser user,
            String accessToken,
            List<TenantBasic> availableTenants,
            String? selectedTenantId,
            PortalType? selectedPortal)?
        authenticated,
    TResult Function()? unauthenticated,
    TResult Function()? loading,
    TResult Function()? loginLoading,
    required TResult orElse(),
  }) {
    if (loginLoading != null) {
      return loginLoading();
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(AuthInitial value) initial,
    required TResult Function(AuthAuthenticated value) authenticated,
    required TResult Function(AuthUnauthenticated value) unauthenticated,
    required TResult Function(AuthLoading value) loading,
    required TResult Function(AuthLoginLoading value) loginLoading,
  }) {
    return loginLoading(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(AuthInitial value)? initial,
    TResult? Function(AuthAuthenticated value)? authenticated,
    TResult? Function(AuthUnauthenticated value)? unauthenticated,
    TResult? Function(AuthLoading value)? loading,
    TResult? Function(AuthLoginLoading value)? loginLoading,
  }) {
    return loginLoading?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(AuthInitial value)? initial,
    TResult Function(AuthAuthenticated value)? authenticated,
    TResult Function(AuthUnauthenticated value)? unauthenticated,
    TResult Function(AuthLoading value)? loading,
    TResult Function(AuthLoginLoading value)? loginLoading,
    required TResult orElse(),
  }) {
    if (loginLoading != null) {
      return loginLoading(this);
    }
    return orElse();
  }
}

abstract class AuthLoginLoading implements AuthState {
  const factory AuthLoginLoading() = _$AuthLoginLoadingImpl;
}
