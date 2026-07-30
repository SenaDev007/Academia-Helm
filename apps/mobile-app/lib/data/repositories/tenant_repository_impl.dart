import 'package:academia_helm_mobile/domain/entities/tenant_school.dart';
import 'package:academia_helm_mobile/domain/repositories/tenant_repository.dart';
import 'package:academia_helm_mobile/data/datasources/remote/tenant_api.dart';

/// Concrete implementation of [TenantRepository] that delegates to
/// [TenantApi] for remote tenant data retrieval.
class TenantRepositoryImpl implements TenantRepository {
  final TenantApi _tenantApi;

  TenantRepositoryImpl({
    required TenantApi tenantApi,
  }) : _tenantApi = tenantApi;

  @override
  Future<TenantSchool> getTenantById(String id) async {
    final dto = await _tenantApi.getTenantById(id);
    return dto.toDomain();
  }

  @override
  Future<TenantSchool> getTenantBySlug(String slug) async {
    final dto = await _tenantApi.getTenantBySlug(slug);
    return dto.toDomain();
  }
}
