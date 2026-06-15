/// ============================================================================
/// FINANCE SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Finance, miroir du web app (finance.service.ts).
///
/// Étend [BaseCrudService] et fournit les méthodes spécifiques au module :
/// - CRUD de base (getAll, create, update, delete)
/// - Structures de frais (Fee Structures)
/// - Dépenses (Expenses) avec approbation / rejet
/// - Trésorerie (Treasury Closures) avec validation
/// - Comptes élèves (Student Accounts) avec déblocage
/// - Transactions
/// - Relances (Recovery Reminders)
/// - Rapports KPI
/// - Anomalies & Audit
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

class FinanceService extends BaseCrudService {
  // ─── Singleton ────────────────────────────────────────────────────────────

  static FinanceService? _instance;

  /// Instance singleton du service.
  static FinanceService get instance => _instance ??= FinanceService._();

  FinanceService._() : super(
    endpoint: ApiConfig.finance,
    collection: 'finance',
    entityType: SyncEntityType.feeStructure,
  );

  // ─── CRUD de base ────────────────────────────────────────────────────────

  /// Récupère toutes les entités finance avec filtres optionnels.
  ///
  /// Miroir de `financeService.getAll()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAll({
    Map<String, dynamic>? params,
  }) => super.getAll(params: params);

  /// Crée une nouvelle entité finance.
  ///
  /// Miroir de `financeService.create(data)` du web app.
  /// Hors ligne → outbox pattern (SyncEntityType.feeStructure).
  Future<ApiResult<Map<String, dynamic>>> create(
    Map<String, dynamic> data,
  ) => super.create(data);

  /// Met à jour une entité finance existante.
  ///
  /// Miroir de `financeService.update(id, data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> update(
    String id,
    Map<String, dynamic> data,
  ) => super.update(id, data);

  /// Supprime une entité finance.
  ///
  /// Miroir de `financeService.delete(id)` du web app.
  /// Hors ligne → soft delete + outbox pattern.
  Future<ApiResult<void>> delete(String id) => super.delete(id);

  // ─── Structures de frais (Fee Structures) ─────────────────────────────────

  /// Récupère toutes les structures de frais.
  ///
  /// Miroir de `financeService.getFeeStructures()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getFeeStructures({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.financeFeeStructures,
        params: params,
        localCollection: 'finance',
        localFilters: {'type': 'feeStructure'},
      );

  /// Crée une nouvelle structure de frais.
  ///
  /// Miroir de `financeService.createFeeStructure(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createFeeStructure(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.financeFeeStructures,
        data,
        offlineEntityType: SyncEntityType.feeStructure,
      );

  // ─── Dépenses (Expenses) ─────────────────────────────────────────────────

  /// Récupère toutes les dépenses.
  ///
  /// Miroir de `financeService.getExpenses()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getExpenses({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.financeExpenses,
        params: params,
        localCollection: 'finance',
        localFilters: {'type': 'expense'},
      );

  /// Crée une nouvelle dépense.
  ///
  /// Miroir de `financeService.createExpense(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createExpense(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.financeExpenses,
        data,
        offlineEntityType: SyncEntityType.expense,
      );

  /// Approuve une dépense.
  ///
  /// Miroir de `financeService.approveExpense(id)` du web app.
  Future<ApiResult<Map<String, dynamic>>> approveExpense(String id) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.financeExpenseApprove(id),
        {'id': id},
        offlineEntityType: SyncEntityType.expense,
      );

  /// Rejette une dépense.
  ///
  /// Miroir de `financeService.rejectExpense(id, data)` du web app.
  Future<ApiResult<Map<String, dynamic>>> rejectExpense(
    String id,
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.financeExpenseReject(id),
        data,
        offlineEntityType: SyncEntityType.expense,
      );

  // ─── Trésorerie (Treasury Closures) ──────────────────────────────────────

  /// Récupère toutes les clôtures de trésorerie.
  ///
  /// Miroir de `financeService.getTreasuryClosures()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getTreasuryClosures({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.financeTreasuryClosures,
        params: params,
        localCollection: 'finance',
        localFilters: {'type': 'treasuryClosure'},
      );

  /// Valide une clôture de trésorerie.
  ///
  /// Miroir de `financeService.validateTreasuryClosure(id)` du web app.
  Future<ApiResult<Map<String, dynamic>>> validateTreasuryClosure(String id) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.financeTreasuryClosureValidate(id),
        {'id': id},
      );

  // ─── Comptes élèves (Student Accounts) ────────────────────────────────────

  /// Récupère tous les comptes élèves.
  ///
  /// Miroir de `financeService.getStudentAccounts()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getStudentAccounts({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.financeStudentAccounts,
        params: params,
        localCollection: 'finance',
        localFilters: {'type': 'studentAccount'},
      );

  /// Débloque le compte d'un élève.
  ///
  /// Miroir de `financeService.unblockStudentAccount(id)` du web app.
  Future<ApiResult<Map<String, dynamic>>> unblockStudentAccount(String id) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.financeStudentAccountUnblock(id),
        {'id': id},
      );

  // ─── Transactions ────────────────────────────────────────────────────────

  /// Récupère toutes les transactions financières.
  ///
  /// Miroir de `financeService.getTransactions()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getTransactions({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.financeTransactions,
        params: params,
        localCollection: 'finance',
        localFilters: {'type': 'transaction'},
      );

  // ─── Relances (Recovery Reminders) ───────────────────────────────────────

  /// Récupère les relances de paiement pour une année académique.
  ///
  /// Miroir de `financeService.getRecoveryReminders(academicYearId)`
  /// du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getRecoveryReminders(
    String academicYearId,
  ) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.financeRecoveryReminders(academicYearId),
        localCollection: 'finance',
        localFilters: {'type': 'recoveryReminder'},
      );

  // ─── Rapports KPI ────────────────────────────────────────────────────────

  /// Récupère les rapports KPI financiers.
  ///
  /// Miroir de `financeService.getKpiReports()` du web app.
  Future<ApiResult<Map<String, dynamic>>> getKpiReports() =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.financeKpiReports,
      );

  // ─── Anomalies & Audit ──────────────────────────────────────────────────

  /// Récupère les anomalies financières.
  ///
  /// Miroir de `financeService.getAnomalies(limit)` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAnomalies({
    int limit = 30,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.financeAnomalies(limit: limit),
        localCollection: 'finance',
        localFilters: {'type': 'anomaly'},
      );

  /// Récupère les logs d'audit financiers.
  ///
  /// Miroir de `financeService.getAuditLogs(limit)` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAuditLogs({
    int limit = 30,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.financeAuditLogs(limit: limit),
        localCollection: 'finance',
        localFilters: {'type': 'auditLog'},
      );
}
