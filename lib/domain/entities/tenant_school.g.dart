// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'tenant_school.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TenantSchoolImpl _$$TenantSchoolImplFromJson(Map<String, dynamic> json) =>
    _$TenantSchoolImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      logoUrl: json['logoUrl'] as String?,
      primaryColor: json['primaryColor'] as String?,
      secondaryColor: json['secondaryColor'] as String?,
      schoolAcronym: json['schoolAcronym'] as String?,
      schoolType: json['schoolType'] as String?,
      city: json['city'] as String?,
      country: json['country'] as String?,
      slogan: json['slogan'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      websiteUrl: json['websiteUrl'] as String?,
      enabledModules: (json['enabledModules'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
      isActive: json['isActive'] as bool?,
    );

Map<String, dynamic> _$$TenantSchoolImplToJson(_$TenantSchoolImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'slug': instance.slug,
      'logoUrl': instance.logoUrl,
      'primaryColor': instance.primaryColor,
      'secondaryColor': instance.secondaryColor,
      'schoolAcronym': instance.schoolAcronym,
      'schoolType': instance.schoolType,
      'city': instance.city,
      'country': instance.country,
      'slogan': instance.slogan,
      'phone': instance.phone,
      'email': instance.email,
      'websiteUrl': instance.websiteUrl,
      'enabledModules': instance.enabledModules,
      'isActive': instance.isActive,
    };
