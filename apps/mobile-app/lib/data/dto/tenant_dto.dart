import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:academia_helm_mobile/domain/entities/tenant_school.dart';

part 'tenant_dto.freezed.dart';
part 'tenant_dto.g.dart';

@freezed
class TenantSchoolDto with _$TenantSchoolDto {
  const factory TenantSchoolDto({
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
  }) = _TenantSchoolDto;

  const TenantSchoolDto._();

  /// Converts this DTO into a domain [TenantSchool] entity.
  TenantSchool toDomain() => TenantSchool(
        id: id,
        name: name,
        slug: slug,
        logoUrl: logoUrl,
        primaryColor: primaryColor,
        secondaryColor: secondaryColor,
        schoolAcronym: schoolAcronym,
        schoolType: schoolType,
        city: city,
        country: country,
        slogan: slogan,
        phone: phone,
        email: email,
        websiteUrl: websiteUrl,
        enabledModules: enabledModules,
        isActive: isActive,
      );

  factory TenantSchoolDto.fromJson(Map<String, dynamic> json) =>
      _$TenantSchoolDtoFromJson(json);
}
