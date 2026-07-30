import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import 'package:academia_helm_mobile/data/dto/tenant_dto.dart';

part 'tenant_api.g.dart';

@RestApi(baseUrl: '/tenants')
abstract class TenantApi {
  factory TenantApi(Dio dio, {String? baseUrl}) = _TenantApi;

  @GET('/{id}')
  Future<TenantSchoolDto> getTenantById(@Path('id') String id);

  @GET('/slug/{slug}')
  Future<TenantSchoolDto> getTenantBySlug(@Path('slug') String slug);
}
