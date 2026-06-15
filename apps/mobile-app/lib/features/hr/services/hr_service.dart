/// ============================================================================
/// HR SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Ressources Humaines, miroir du web app
/// (hr.service.ts).
///
/// Étend [BaseCrudService] et fournit les méthodes spécifiques au module :
/// - CRUD de base (getAll, create, update, delete)
/// - Personnel (Staff) avec CRUD
/// - Contrats (Contracts) avec CRUD
/// - Paie (Payroll) avec CRUD
/// - Congés (Leaves) avec CRUD
///
/// Pattern offline-first :
/// - Lectures → apiGetWithFallback (API avec fallback local)
/// - Écritures → apiPostWithOfflineFallback / apiUpdateWithOfflineFallback
///   (API avec outbox pattern hors ligne)
/// ============================================================================

import '../../../core/crud/base_crud_service.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/api_result.dart';
import '../../../core/offline/offline_service.dart';

class HrService extends BaseCrudService {
  // ─── Singleton ────────────────────────────────────────────────────────────

  static HrService? _instance;

  /// Instance singleton du service.
  static HrService get instance => _instance ??= HrService._();

  HrService._() : super(
    endpoint: ApiConfig.hr,
    collection: 'hr',
    entityType: SyncEntityType.staff,
  );

  // ─── CRUD de base ────────────────────────────────────────────────────────

  /// Récupère toutes les entités RH avec filtres optionnels.
  ///
  /// Miroir de `hrService.getAll()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAll({
    Map<String, dynamic>? params,
  }) => super.getAll(params: params);

  /// Crée une nouvelle entité RH.
  ///
  /// Miroir de `hrService.create(data)` du web app.
  /// Hors ligne → outbox pattern (SyncEntityType.staff).
  Future<ApiResult<Map<String, dynamic>>> create(
    Map<String, dynamic> data,
  ) => super.create(data);

  /// Met à jour une entité RH existante.
  ///
  /// Miroir de `hrService.update(id, data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> update(
    String id,
    Map<String, dynamic> data,
  ) => super.update(id, data);

  /// Supprime une entité RH.
  ///
  /// Miroir de `hrService.delete(id)` du web app.
  /// Hors ligne → soft delete + outbox pattern.
  Future<ApiResult<void>> delete(String id) => super.delete(id);

  // ─── Personnel (Staff) ───────────────────────────────────────────────────

  /// Récupère tout le personnel.
  ///
  /// Miroir de `hrService.getStaff()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getStaff({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.hrStaff,
        params: params,
        localCollection: 'hr',
        localFilters: {'type': 'staff'},
      );

  /// Crée un nouveau membre du personnel.
  ///
  /// Miroir de `hrService.createStaff(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createStaff(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.hrStaff,
        data,
        offlineEntityType: SyncEntityType.staff,
      );

  // ─── Contrats (Contracts) ────────────────────────────────────────────────

  /// Récupère tous les contrats.
  ///
  /// Miroir de `hrService.getContracts()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getContracts({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.hrContracts,
        params: params,
        localCollection: 'hr',
        localFilters: {'type': 'contract'},
      );

  /// Crée un nouveau contrat.
  ///
  /// Miroir de `hrService.createContract(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createContract(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.hrContracts,
        data,
        offlineEntityType: SyncEntityType.contract,
      );

  // ─── Paie (Payroll) ──────────────────────────────────────────────────────

  /// Récupère toutes les fiches de paie.
  ///
  /// Miroir de `hrService.getPayroll()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getPayroll({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.hrPayroll,
        params: params,
        localCollection: 'hr',
        localFilters: {'type': 'payroll'},
      );

  /// Crée une nouvelle fiche de paie.
  ///
  /// Miroir de `hrService.createPayroll(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createPayroll(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.hrPayroll,
        data,
        offlineEntityType: SyncEntityType.staff,
      );

  // ─── Congés (Leaves) ─────────────────────────────────────────────────────

  /// Récupère toutes les demandes de congé.
  ///
  /// Miroir de `hrService.getLeaves()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getLeaves({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.hrLeaves,
        params: params,
        localCollection: 'hr',
        localFilters: {'type': 'leave'},
      );

  /// Crée une nouvelle demande de congé.
  ///
  /// Miroir de `hrService.createLeave(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createLeave(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.hrLeaves,
        data,
        offlineEntityType: SyncEntityType.leave,
      );
}
