import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import 'package:academia_helm_mobile/data/dto/auth_dto.dart';
import 'package:academia_helm_mobile/data/dto/tenant_dto.dart';

part 'auth_api.g.dart';

@RestApi(baseUrl: '/auth')
abstract class AuthApi {
  factory AuthApi(Dio dio, {String? baseUrl}) = _AuthApi;

  @POST('/login')
  Future<LoginResponse> login(@Body() LoginRequest request);

  @POST('/refresh')
  Future<RefreshResponse> refreshToken(@Body() RefreshRequest request);

  @POST('/logout')
  Future<void> logout();

  @POST('/forgot-password')
  Future<void> forgotPassword(@Body() ForgotPasswordRequest request);

  @POST('/reset-password')
  Future<void> resetPassword(@Body() ResetPasswordRequest request);

  @GET('/me')
  Future<UserDto> getCurrentUser();

  @GET('/available-tenants')
  Future<List<TenantSchoolDto>> getAvailableTenants();

  @POST('/select-tenant')
  Future<void> selectTenant(@Body() SelectTenantRequest request);
}
