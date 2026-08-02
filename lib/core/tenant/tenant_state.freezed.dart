// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'tenant_state.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Tenant _$TenantFromJson(Map<String, dynamic> json) {
  return _Tenant.fromJson(json);
}

/// @nodoc
mixin _$Tenant {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get slug => throw _privateConstructorUsedError;
  String? get logoUrl => throw _privateConstructorUsedError;
  String? get primaryColor => throw _privateConstructorUsedError;
  String? get schoolAcronym => throw _privateConstructorUsedError;
  String? get address => throw _privateConstructorUsedError;
  String? get country => throw _privateConstructorUsedError;
  String? get plan => throw _privateConstructorUsedError;
  bool get isActive => throw _privateConstructorUsedError;
  DateTime? get createdAt => throw _privateConstructorUsedError;
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this Tenant to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Tenant
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TenantCopyWith<Tenant> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TenantCopyWith<$Res> {
  factory $TenantCopyWith(Tenant value, $Res Function(Tenant) then) =
      _$TenantCopyWithImpl<$Res, Tenant>;
  @useResult
  $Res call(
      {String id,
      String name,
      String slug,
      String? logoUrl,
      String? primaryColor,
      String? schoolAcronym,
      String? address,
      String? country,
      String? plan,
      bool isActive,
      DateTime? createdAt,
      DateTime? updatedAt});
}

/// @nodoc
class _$TenantCopyWithImpl<$Res, $Val extends Tenant>
    implements $TenantCopyWith<$Res> {
  _$TenantCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Tenant
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? slug = null,
    Object? logoUrl = freezed,
    Object? primaryColor = freezed,
    Object? schoolAcronym = freezed,
    Object? address = freezed,
    Object? country = freezed,
    Object? plan = freezed,
    Object? isActive = null,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
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
      slug: null == slug
          ? _value.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      logoUrl: freezed == logoUrl
          ? _value.logoUrl
          : logoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      primaryColor: freezed == primaryColor
          ? _value.primaryColor
          : primaryColor // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolAcronym: freezed == schoolAcronym
          ? _value.schoolAcronym
          : schoolAcronym // ignore: cast_nullable_to_non_nullable
              as String?,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      plan: freezed == plan
          ? _value.plan
          : plan // ignore: cast_nullable_to_non_nullable
              as String?,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
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
abstract class _$$TenantImplCopyWith<$Res> implements $TenantCopyWith<$Res> {
  factory _$$TenantImplCopyWith(
          _$TenantImpl value, $Res Function(_$TenantImpl) then) =
      __$$TenantImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      String slug,
      String? logoUrl,
      String? primaryColor,
      String? schoolAcronym,
      String? address,
      String? country,
      String? plan,
      bool isActive,
      DateTime? createdAt,
      DateTime? updatedAt});
}

/// @nodoc
class __$$TenantImplCopyWithImpl<$Res>
    extends _$TenantCopyWithImpl<$Res, _$TenantImpl>
    implements _$$TenantImplCopyWith<$Res> {
  __$$TenantImplCopyWithImpl(
      _$TenantImpl _value, $Res Function(_$TenantImpl) _then)
      : super(_value, _then);

  /// Create a copy of Tenant
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? slug = null,
    Object? logoUrl = freezed,
    Object? primaryColor = freezed,
    Object? schoolAcronym = freezed,
    Object? address = freezed,
    Object? country = freezed,
    Object? plan = freezed,
    Object? isActive = null,
    Object? createdAt = freezed,
    Object? updatedAt = freezed,
  }) {
    return _then(_$TenantImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      slug: null == slug
          ? _value.slug
          : slug // ignore: cast_nullable_to_non_nullable
              as String,
      logoUrl: freezed == logoUrl
          ? _value.logoUrl
          : logoUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      primaryColor: freezed == primaryColor
          ? _value.primaryColor
          : primaryColor // ignore: cast_nullable_to_non_nullable
              as String?,
      schoolAcronym: freezed == schoolAcronym
          ? _value.schoolAcronym
          : schoolAcronym // ignore: cast_nullable_to_non_nullable
              as String?,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      plan: freezed == plan
          ? _value.plan
          : plan // ignore: cast_nullable_to_non_nullable
              as String?,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
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
class _$TenantImpl extends _Tenant {
  const _$TenantImpl(
      {required this.id,
      required this.name,
      required this.slug,
      this.logoUrl,
      this.primaryColor,
      this.schoolAcronym,
      this.address,
      this.country,
      this.plan,
      this.isActive = true,
      this.createdAt,
      this.updatedAt})
      : super._();

  factory _$TenantImpl.fromJson(Map<String, dynamic> json) =>
      _$$TenantImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String slug;
  @override
  final String? logoUrl;
  @override
  final String? primaryColor;
  @override
  final String? schoolAcronym;
  @override
  final String? address;
  @override
  final String? country;
  @override
  final String? plan;
  @override
  @JsonKey()
  final bool isActive;
  @override
  final DateTime? createdAt;
  @override
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'Tenant(id: $id, name: $name, slug: $slug, logoUrl: $logoUrl, primaryColor: $primaryColor, schoolAcronym: $schoolAcronym, address: $address, country: $country, plan: $plan, isActive: $isActive, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TenantImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.slug, slug) || other.slug == slug) &&
            (identical(other.logoUrl, logoUrl) || other.logoUrl == logoUrl) &&
            (identical(other.primaryColor, primaryColor) ||
                other.primaryColor == primaryColor) &&
            (identical(other.schoolAcronym, schoolAcronym) ||
                other.schoolAcronym == schoolAcronym) &&
            (identical(other.address, address) || other.address == address) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.plan, plan) || other.plan == plan) &&
            (identical(other.isActive, isActive) ||
                other.isActive == isActive) &&
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
      name,
      slug,
      logoUrl,
      primaryColor,
      schoolAcronym,
      address,
      country,
      plan,
      isActive,
      createdAt,
      updatedAt);

  /// Create a copy of Tenant
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TenantImplCopyWith<_$TenantImpl> get copyWith =>
      __$$TenantImplCopyWithImpl<_$TenantImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TenantImplToJson(
      this,
    );
  }
}

abstract class _Tenant extends Tenant {
  const factory _Tenant(
      {required final String id,
      required final String name,
      required final String slug,
      final String? logoUrl,
      final String? primaryColor,
      final String? schoolAcronym,
      final String? address,
      final String? country,
      final String? plan,
      final bool isActive,
      final DateTime? createdAt,
      final DateTime? updatedAt}) = _$TenantImpl;
  const _Tenant._() : super._();

  factory _Tenant.fromJson(Map<String, dynamic> json) = _$TenantImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String get slug;
  @override
  String? get logoUrl;
  @override
  String? get primaryColor;
  @override
  String? get schoolAcronym;
  @override
  String? get address;
  @override
  String? get country;
  @override
  String? get plan;
  @override
  bool get isActive;
  @override
  DateTime? get createdAt;
  @override
  DateTime? get updatedAt;

  /// Create a copy of Tenant
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TenantImplCopyWith<_$TenantImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$TenantState {
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(Tenant tenant) selected,
    required TResult Function() loading,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(Tenant tenant)? selected,
    TResult? Function()? loading,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(Tenant tenant)? selected,
    TResult Function()? loading,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(TenantInitial value) initial,
    required TResult Function(TenantSelected value) selected,
    required TResult Function(TenantLoading value) loading,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(TenantInitial value)? initial,
    TResult? Function(TenantSelected value)? selected,
    TResult? Function(TenantLoading value)? loading,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(TenantInitial value)? initial,
    TResult Function(TenantSelected value)? selected,
    TResult Function(TenantLoading value)? loading,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TenantStateCopyWith<$Res> {
  factory $TenantStateCopyWith(
          TenantState value, $Res Function(TenantState) then) =
      _$TenantStateCopyWithImpl<$Res, TenantState>;
}

/// @nodoc
class _$TenantStateCopyWithImpl<$Res, $Val extends TenantState>
    implements $TenantStateCopyWith<$Res> {
  _$TenantStateCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TenantState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$TenantInitialImplCopyWith<$Res> {
  factory _$$TenantInitialImplCopyWith(
          _$TenantInitialImpl value, $Res Function(_$TenantInitialImpl) then) =
      __$$TenantInitialImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$TenantInitialImplCopyWithImpl<$Res>
    extends _$TenantStateCopyWithImpl<$Res, _$TenantInitialImpl>
    implements _$$TenantInitialImplCopyWith<$Res> {
  __$$TenantInitialImplCopyWithImpl(
      _$TenantInitialImpl _value, $Res Function(_$TenantInitialImpl) _then)
      : super(_value, _then);

  /// Create a copy of TenantState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$TenantInitialImpl implements TenantInitial {
  const _$TenantInitialImpl();

  @override
  String toString() {
    return 'TenantState.initial()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is _$TenantInitialImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(Tenant tenant) selected,
    required TResult Function() loading,
  }) {
    return initial();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(Tenant tenant)? selected,
    TResult? Function()? loading,
  }) {
    return initial?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(Tenant tenant)? selected,
    TResult Function()? loading,
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
    required TResult Function(TenantInitial value) initial,
    required TResult Function(TenantSelected value) selected,
    required TResult Function(TenantLoading value) loading,
  }) {
    return initial(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(TenantInitial value)? initial,
    TResult? Function(TenantSelected value)? selected,
    TResult? Function(TenantLoading value)? loading,
  }) {
    return initial?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(TenantInitial value)? initial,
    TResult Function(TenantSelected value)? selected,
    TResult Function(TenantLoading value)? loading,
    required TResult orElse(),
  }) {
    if (initial != null) {
      return initial(this);
    }
    return orElse();
  }
}

abstract class TenantInitial implements TenantState {
  const factory TenantInitial() = _$TenantInitialImpl;
}

/// @nodoc
abstract class _$$TenantSelectedImplCopyWith<$Res> {
  factory _$$TenantSelectedImplCopyWith(_$TenantSelectedImpl value,
          $Res Function(_$TenantSelectedImpl) then) =
      __$$TenantSelectedImplCopyWithImpl<$Res>;
  @useResult
  $Res call({Tenant tenant});

  $TenantCopyWith<$Res> get tenant;
}

/// @nodoc
class __$$TenantSelectedImplCopyWithImpl<$Res>
    extends _$TenantStateCopyWithImpl<$Res, _$TenantSelectedImpl>
    implements _$$TenantSelectedImplCopyWith<$Res> {
  __$$TenantSelectedImplCopyWithImpl(
      _$TenantSelectedImpl _value, $Res Function(_$TenantSelectedImpl) _then)
      : super(_value, _then);

  /// Create a copy of TenantState
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? tenant = null,
  }) {
    return _then(_$TenantSelectedImpl(
      null == tenant
          ? _value.tenant
          : tenant // ignore: cast_nullable_to_non_nullable
              as Tenant,
    ));
  }

  /// Create a copy of TenantState
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $TenantCopyWith<$Res> get tenant {
    return $TenantCopyWith<$Res>(_value.tenant, (value) {
      return _then(_value.copyWith(tenant: value));
    });
  }
}

/// @nodoc

class _$TenantSelectedImpl implements TenantSelected {
  const _$TenantSelectedImpl(this.tenant);

  @override
  final Tenant tenant;

  @override
  String toString() {
    return 'TenantState.selected(tenant: $tenant)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TenantSelectedImpl &&
            (identical(other.tenant, tenant) || other.tenant == tenant));
  }

  @override
  int get hashCode => Object.hash(runtimeType, tenant);

  /// Create a copy of TenantState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TenantSelectedImplCopyWith<_$TenantSelectedImpl> get copyWith =>
      __$$TenantSelectedImplCopyWithImpl<_$TenantSelectedImpl>(
          this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(Tenant tenant) selected,
    required TResult Function() loading,
  }) {
    return selected(tenant);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(Tenant tenant)? selected,
    TResult? Function()? loading,
  }) {
    return selected?.call(tenant);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(Tenant tenant)? selected,
    TResult Function()? loading,
    required TResult orElse(),
  }) {
    if (selected != null) {
      return selected(tenant);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(TenantInitial value) initial,
    required TResult Function(TenantSelected value) selected,
    required TResult Function(TenantLoading value) loading,
  }) {
    return selected(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(TenantInitial value)? initial,
    TResult? Function(TenantSelected value)? selected,
    TResult? Function(TenantLoading value)? loading,
  }) {
    return selected?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(TenantInitial value)? initial,
    TResult Function(TenantSelected value)? selected,
    TResult Function(TenantLoading value)? loading,
    required TResult orElse(),
  }) {
    if (selected != null) {
      return selected(this);
    }
    return orElse();
  }
}

abstract class TenantSelected implements TenantState {
  const factory TenantSelected(final Tenant tenant) = _$TenantSelectedImpl;

  Tenant get tenant;

  /// Create a copy of TenantState
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TenantSelectedImplCopyWith<_$TenantSelectedImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$TenantLoadingImplCopyWith<$Res> {
  factory _$$TenantLoadingImplCopyWith(
          _$TenantLoadingImpl value, $Res Function(_$TenantLoadingImpl) then) =
      __$$TenantLoadingImplCopyWithImpl<$Res>;
}

/// @nodoc
class __$$TenantLoadingImplCopyWithImpl<$Res>
    extends _$TenantStateCopyWithImpl<$Res, _$TenantLoadingImpl>
    implements _$$TenantLoadingImplCopyWith<$Res> {
  __$$TenantLoadingImplCopyWithImpl(
      _$TenantLoadingImpl _value, $Res Function(_$TenantLoadingImpl) _then)
      : super(_value, _then);

  /// Create a copy of TenantState
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc

class _$TenantLoadingImpl implements TenantLoading {
  const _$TenantLoadingImpl();

  @override
  String toString() {
    return 'TenantState.loading()';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType && other is _$TenantLoadingImpl);
  }

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function() initial,
    required TResult Function(Tenant tenant) selected,
    required TResult Function() loading,
  }) {
    return loading();
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function()? initial,
    TResult? Function(Tenant tenant)? selected,
    TResult? Function()? loading,
  }) {
    return loading?.call();
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function()? initial,
    TResult Function(Tenant tenant)? selected,
    TResult Function()? loading,
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
    required TResult Function(TenantInitial value) initial,
    required TResult Function(TenantSelected value) selected,
    required TResult Function(TenantLoading value) loading,
  }) {
    return loading(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(TenantInitial value)? initial,
    TResult? Function(TenantSelected value)? selected,
    TResult? Function(TenantLoading value)? loading,
  }) {
    return loading?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(TenantInitial value)? initial,
    TResult Function(TenantSelected value)? selected,
    TResult Function(TenantLoading value)? loading,
    required TResult orElse(),
  }) {
    if (loading != null) {
      return loading(this);
    }
    return orElse();
  }
}

abstract class TenantLoading implements TenantState {
  const factory TenantLoading() = _$TenantLoadingImpl;
}
