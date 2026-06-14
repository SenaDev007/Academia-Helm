import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:academia_helm_mobile/domain/entities/user.dart';
import 'package:academia_helm_mobile/data/dto/tenant_dto.dart';

part 'auth_dto.freezed.dart';
part 'auth_dto.g.dart';

// ─── Request DTOs ────────────────────────────────────────────────────────────

@freezed
class LoginRequest with _$LoginRequest {
  const factory LoginRequest({
    required String email,
    required String password,
  }) = _LoginRequest;

  factory LoginRequest.fromJson(Map<String, dynamic> json) =>
      _$LoginRequestFromJson(json);
}

@freezed
class RefreshRequest with _$RefreshRequest {
  const factory RefreshRequest({
    required String refreshToken,
  }) = _RefreshRequest;

  factory RefreshRequest.fromJson(Map<String, dynamic> json) =>
      _$RefreshRequestFromJson(json);
}

@freezed
class ForgotPasswordRequest with _$ForgotPasswordRequest {
  const factory ForgotPasswordRequest({
    required String email,
  }) = _ForgotPasswordRequest;

  factory ForgotPasswordRequest.fromJson(Map<String, dynamic> json) =>
      _$ForgotPasswordRequestFromJson(json);
}

@freezed
class ResetPasswordRequest with _$ResetPasswordRequest {
  const factory ResetPasswordRequest({
    required String token,
    required String newPassword,
  }) = _ResetPasswordRequest;

  factory ResetPasswordRequest.fromJson(Map<String, dynamic> json) =>
      _$ResetPasswordRequestFromJson(json);
}

@freezed
class SelectTenantRequest with _$SelectTenantRequest {
  const factory SelectTenantRequest({
    required String tenantId,
  }) = _SelectTenantRequest;

  factory SelectTenantRequest.fromJson(Map<String, dynamic> json) =>
      _$SelectTenantRequestFromJson(json);
}

// ─── Response DTOs ───────────────────────────────────────────────────────────

@freezed
class LoginResponse with _$LoginResponse {
  const factory LoginResponse({
    required String accessToken,
    required String refreshToken,
    required UserDto user,
    required List<TenantSchoolDto> tenants,
  }) = _LoginResponse;

  factory LoginResponse.fromJson(Map<String, dynamic> json) =>
      _$LoginResponseFromJson(json);
}

@freezed
class RefreshResponse with _$RefreshResponse {
  const factory RefreshResponse({
    required String accessToken,
    required String refreshToken,
  }) = _RefreshResponse;

  factory RefreshResponse.fromJson(Map<String, dynamic> json) =>
      _$RefreshResponseFromJson(json);
}

// ─── User DTO ────────────────────────────────────────────────────────────────

@freezed
class UserDto with _$UserDto {
  const factory UserDto({
    required String id,
    required String email,
    required String firstName,
    required String lastName,
    required String role,
    String? phone,
    String? avatarUrl,
    String? tenantId,
    List<String>? permissions,
    bool? isActive,
    DateTime? lastLoginAt,
  }) = _UserDto;

  const UserDto._();

  /// Converts this DTO into a domain [User] entity.
  User toDomain() => User(
        id: id,
        email: email,
        firstName: firstName,
        lastName: lastName,
        role: role,
        phone: phone,
        avatarUrl: avatarUrl,
        tenantId: tenantId,
        permissions: permissions,
        isActive: isActive,
        lastLoginAt: lastLoginAt,
      );

  factory UserDto.fromJson(Map<String, dynamic> json) =>
      _$UserDtoFromJson(json);
}
