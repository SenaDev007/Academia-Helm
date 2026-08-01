// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_state.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TenantBasicImpl _$$TenantBasicImplFromJson(Map<String, dynamic> json) =>
    _$TenantBasicImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      acronym: json['acronym'] as String?,
      logoUrl: json['logoUrl'] as String?,
      type: json['type'] as String?,
      subdomain: json['subdomain'] as String?,
    );

Map<String, dynamic> _$$TenantBasicImplToJson(_$TenantBasicImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'acronym': instance.acronym,
      'logoUrl': instance.logoUrl,
      'type': instance.type,
      'subdomain': instance.subdomain,
    };

_$AuthUserImpl _$$AuthUserImplFromJson(Map<String, dynamic> json) =>
    _$AuthUserImpl(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      phone: json['phone'] as String?,
      role: json['role'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      lastLoginAt: json['lastLoginAt'] == null
          ? null
          : DateTime.parse(json['lastLoginAt'] as String),
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$$AuthUserImplToJson(_$AuthUserImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'avatarUrl': instance.avatarUrl,
      'phone': instance.phone,
      'role': instance.role,
      'isActive': instance.isActive,
      'permissions': instance.permissions,
      'lastLoginAt': instance.lastLoginAt?.toIso8601String(),
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
