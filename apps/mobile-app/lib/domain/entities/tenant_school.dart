import 'package:freezed_annotation/freezed_annotation.dart';

part 'tenant_school.freezed.dart';
part 'tenant_school.g.dart';

@freezed
class TenantSchool with _$TenantSchool {
  const factory TenantSchool({
    required String id,
    required String name,
    required String slug,
    String? logoUrl,
    String? primaryColor,
    String? secondaryColor,
    String? schoolAcronym,
    String? schoolType,
    String? city,
    String? country,
    String? slogan,
    String? phone,
    String? email,
    String? websiteUrl,
    List<String>? enabledModules,
    bool? isActive,
  }) = _TenantSchool;

  factory TenantSchool.fromJson(Map<String, dynamic> json) =>
      _$TenantSchoolFromJson(json);
}
