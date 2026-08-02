// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UserImpl _$$UserImplFromJson(Map<String, dynamic> json) => _$UserImpl(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      role: json['role'] as String,
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      tenantId: json['tenantId'] as String?,
      permissions: (json['permissions'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      isActive: json['isActive'] as bool?,
      lastLoginAt: json['lastLoginAt'] == null
          ? null
          : DateTime.parse(json['lastLoginAt'] as String),
    );

Map<String, dynamic> _$$UserImplToJson(_$UserImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'role': instance.role,
      'phone': instance.phone,
      'avatarUrl': instance.avatarUrl,
      'tenantId': instance.tenantId,
      'permissions': instance.permissions,
      'isActive': instance.isActive,
      'lastLoginAt': instance.lastLoginAt?.toIso8601String(),
    };
