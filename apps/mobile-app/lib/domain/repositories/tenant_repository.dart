import 'package:academia_helm_mobile/domain/entities/tenant_school.dart';

abstract class TenantRepository {
  /// Retrieves a tenant school by its unique identifier.
  Future<TenantSchool> getTenantById(String id);

  /// Retrieves a tenant school by its URL slug.
  Future<TenantSchool> getTenantBySlug(String slug);
}
